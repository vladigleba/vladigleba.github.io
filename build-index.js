// Usage: node build-index.js

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const MiniSearch = require('minisearch');

/**
 * Remove Liquid tags and footnote markers from markdown
 */
function cleanMarkdown(text) {
  return text
    .replace(/\s*\{%\s*ct\s*'([^']*)'\s*%\}/g, '” —$1') // remove ct tag 
    .replace(/\{%\s*rf\s*'([^']*)'\s+false\s*%\}/g, '$1') // remove rf tag (no parens)
    .replace(/\{%\s*rf\s*'([^']*)'\s*%\}/g, '($1)') // remove rf tag (with parens)
    .replace(/\[\^\d+\]:?/g, '') // remove footnote markers
    .replace(/>\s*/g, '“') // remove blockquote markers
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // remove markdown links
    .replace(/[#*_`]/g, '') // remove markdown symbols
    .replace(/\s+/g, ' ') // normalize whitespace
    .trim();
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
    description: frontmatter.description || '',
    body: cleanMarkdown(bodyText),
    url: buildUrlFromPath(filePath),
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
    // fields to index for full-text search
    fields: ['title', 'description', 'body'],
    // fields to return with search results
    storeFields: ['title', 'series', 'url', 'description', 'body']
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
 * Run the search index generation process
 */

if (require.main === module) { // node build-index.js
  const { index, options, documents } = generateSearchIndex();
  
  const outDir = path.join(__dirname, '_site', 'assets', 'js');
  fs.mkdirSync(outDir, { recursive: true });
  
  const indexPath = path.join(outDir, 'search-index.json');
  fs.writeFileSync(indexPath, JSON.stringify({ index, options, documents }, null, 2));
  
  console.log(`✅ Search index generated: ${documents.length} posts indexed.`);
}