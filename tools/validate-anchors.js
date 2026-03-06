// usage: node validate-anchors.js
const fs = require('fs');
const path = require('path');

const POSTS_DIR = path.join(__dirname, '..', 'posts');
const SITE_DIR = path.join(__dirname, '..', '_site');

// matches /posts/path/file.md or /posts/path/file.md#anchor
const LINK_REGEX = /\/posts\/[^)#]+\.md(?:#[a-z0-9\-]+)?/g;
const ANCHOR_REGEX = /id="([a-z0-9\-]+)"/g;

// recursively get all .md files in a directory
const getAllMarkdownFiles = (dir) => {
  const files = [];
  for (const item of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, item);
    if (fs.statSync(fullPath).isDirectory()) files.push(...getAllMarkdownFiles(fullPath));
    else if (item.endsWith('.md')) files.push(fullPath);
  }
  return files;
};

// extract all internal links from all markdown files
const extractAllLinks = () => {
  const links = [];
  for (const filePath of getAllMarkdownFiles(POSTS_DIR)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const sourceFile = path.relative(__dirname, filePath);

    content.split('\n').forEach((line, index) => {
      for (const match of line.matchAll(LINK_REGEX)) {
        const fullLink = match[0];
        const hashIndex = fullLink.indexOf('#');
        const targetFile = hashIndex === -1 ? fullLink : fullLink.slice(0, hashIndex);
        const targetAnchor = hashIndex === -1 ? null : fullLink.slice(hashIndex);
        links.push({ 
          sourceFile, 
          lineNumber: index + 1, 
          targetFile, 
          targetAnchor, 
          fullLink 
        });
      }
    });
  }
  return links;
};

// /posts/category/filename.md → _site/category/filename/index.html
const convertMdPathToHtmlPath = (mdPath) => {
  const normalized = mdPath.replace(/^\/posts\//, '').replace(/\.md$/, '');
  return path.join(SITE_DIR, normalized, 'index.html');
};

// extract all anchor ids from an HTML file, or null if file doesn't exist
const getAnchorsFromHtml = (htmlPath) => {
  if (!fs.existsSync(htmlPath)) return null;
  return Array.from(fs.readFileSync(htmlPath, 'utf8').matchAll(ANCHOR_REGEX), m => `#${m[1]}`);
};

// find broken links due to missing files or missing anchors
const validateLinks = () => {
  const broken = [];
  for (const link of extractAllLinks()) {
    const anchors = getAnchorsFromHtml(convertMdPathToHtmlPath(link.targetFile));
    if (anchors === null) {
      broken.push({ ...link, reason: 'file not found' });
    } else if (link.targetAnchor && !anchors.includes(link.targetAnchor)) {
      broken.push({ ...link, reason: 'anchor not found', availableAnchors: anchors });
    }
  }
  return broken;
};

const main = () => {
  const brokenLinks = validateLinks();

  if (brokenLinks.length === 0) {
    console.log('✅ All article links valid.');
    process.exit(0);
  }

  brokenLinks.forEach(({ sourceFile, lineNumber, fullLink, reason }) => {
    console.error(`❌ Broken link in ${sourceFile} (line ${lineNumber})`);
    console.error(`   Target: ${fullLink}`);
    console.error(`   Problem: ${reason === 'file not found' ? 'file not found - check link path' : 'anchor does not exist'}`);
    console.error('');
  });

  const count = brokenLinks.length;
  console.error(`❌ Found ${count} broken link${count === 1 ? '' : 's'}. Build failed.`);
  process.exit(1);
};

main();