const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const MiniSearch = require('minisearch');
const site = require('./_data/site.json');

/**
 * Remove Liquid tags and footnote markers from markdown
 */
function cleanMarkdown(text) {
  return text
    .replace(/\{%\s*ct\s*'([^']*)'\s*%\}/g, '$1') // remove ct liquid tag 
    .replace(/\{%\s*rf\s*'([^']*)'\s*(?:false\s*)?%\}/g, '$1') // remove rf liquid tag
    .replace(/\[\^\d+\]:?/g, '') // Remove footnote markers
    .replace(/>\s*/g, '') // Remove blockquote markers
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // remove markdown links
    .replace(/[#*_`[\]()]/g, '') // Remove markdown symbols
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Get user-facing series title from series key
 */
function getSeriesTitle(seriesKey) {
  return seriesKey && site.series[seriesKey]
    ? site.series[seriesKey].title
    : undefined;
}

/**
 * Extract all text content from markdown for search indexing
 */
function extractPostContent(bodyText, frontmatter) {
  const cleanedBody = cleanMarkdown(bodyText);
  
  // Combine frontmatter fields with body content
  const parts = [
    frontmatter.title,
    frontmatter.description,
    cleanedBody
  ].filter(Boolean); // Remove undefined/null
  
  return parts.join(' ');
}

/**
 * Determine category from file path
 */
function getCategoryFromPath(filePath) {
  const match = filePath.match(/posts\/([^/]+)\//);
  if (!match) return 'Other';
  
  const dirName = match[1];
  return dirName.charAt(0).toUpperCase() + dirName.slice(1);
}

/**
 * Build URL from file path
 */
function buildUrlFromPath(filePath) {
  const match = filePath.match(/posts\/([^/]+)\/([^.]+)/);
  return match ? `/${match[1]}/${match[2]}/` : '';
}

/**
 * Process a single markdown file into a search document
 */
function processMarkdownFile(filePath, docId) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const { data: frontmatter, content: bodyText } = matter(content);
  
  return {
    id: String(docId),
    title: frontmatter.title || '',
    series: getSeriesTitle(frontmatter.series),
    body: extractPostContent(bodyText, frontmatter),
    url: buildUrlFromPath(filePath),
    category: getCategoryFromPath(filePath),
    description: frontmatter.description || ''
  };
}

/**
 * Recursively collect all markdown files from directory
 */
function collectMarkdownFiles(dir, files = []) {
  fs.readdirSync(dir).forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      collectMarkdownFiles(filePath, files);
    } else if (file.endsWith('.md')) {
      files.push(filePath);
    }
  });
  
  return files;
}

/**
 * Generate search index from all posts
 */
function generateSearchIndex(postsDir = 'posts') {
  const miniSearchOptions = {
    fields: ['title', 'series', 'description', 'body'],
    storeFields: ['title', 'url', 'category', 'description', 'body', 'series']
  };

  const index = new MiniSearch(miniSearchOptions);
  const documents = [];
  
  const markdownFiles = collectMarkdownFiles(postsDir);
  
  markdownFiles.forEach((filePath, idx) => {
    try {
      const doc = processMarkdownFile(filePath, idx);
      documents.push(doc);
      index.add(doc);
    } catch (err) {
      console.error(`Error processing ${filePath}:`, err.message);
    }
  });
  
  return {
    index: JSON.stringify(index.toJSON()),
    options: miniSearchOptions,
    documents
  };
}

/**
 * Main export for Eleventy integration
 */
module.exports = {
  generateSearchIndex,
  extractPostContent,
  getCategoryFromPath
};

// Run directly if executed as script
if (require.main === module) { // node build-search-index.js
  const { index, options, documents } = generateSearchIndex();
  
  const outDir = path.join(__dirname, '_site', 'assets', 'js');
  fs.mkdirSync(outDir, { recursive: true });
  
  const indexPath = path.join(outDir, 'search-index.json');
  fs.writeFileSync(indexPath, JSON.stringify({ index, options, documents }, null, 2));
  
  console.log(`Search index generated: ${documents.length} posts indexed.`);
}