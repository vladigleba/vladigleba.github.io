// usage: node validate-anchors.js
const fs = require('fs');
const path = require('path');

// matches /posts/path/file.md or /posts/path/file.md#anchor
const LINK_REGEX = /\/posts\/[^)#]+\.md(?:#[a-z0-9\-]+)?/g;

// recursively get all .md files in the posts directory
const getAllMarkdownFiles = (dir) => {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    if (fs.statSync(fullPath).isDirectory()) {
      files.push(...getAllMarkdownFiles(fullPath));
    } else if (item.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  
  return files;
};

// extract all links from all markdown files
const extractAllLinks = () => {
  const links = [];
  const postsDir = path.join(__dirname, '..', 'posts');
  const mdFiles = getAllMarkdownFiles(postsDir);
  
  for (const filePath of mdFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(__dirname, filePath);
    
    content.split('\n').forEach((line, index) => {
      for (const match of line.matchAll(LINK_REGEX)) {
        const fullLink = match[0];
        const [targetFile, targetAnchor] = fullLink.includes('#')
          // split into file and anchor parts, keeping the anchor with the '#' prefix
          ? fullLink.split('#').map((part, i) => i === 1 ? `#${part}` : part)
          : [fullLink, null];
        
        links.push({
          sourceFile: relativePath,
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

// converts markdown file path to corresponding HTML file path in _site directory
const convertMdPathToHtmlPath = (mdPath) => {
  // /posts/category/filename.md → _site/category/filename/index.html
  const normalized = mdPath.replace(/^\/posts\//, '').replace(/\.md$/, '');
  return path.join(__dirname, '..', '_site', normalized, 'index.html');
};

// extract all anchors (ids) from the given HTML file
const getAnchorsFromHtml = (htmlPath) => {
  if (!fs.existsSync(htmlPath)) return null;
  
  const content = fs.readFileSync(htmlPath, 'utf8');
  return Array.from(content.matchAll(/id="([a-z0-9\-]+)"/g), m => `#${m[1]}`);
};

// find broken links due to missing files or missing anchors
const validateLinks = () => {
  const links = extractAllLinks();
  const broken = [];
  
  for (const link of links) {
    const htmlPath = convertMdPathToHtmlPath(link.targetFile);
    const anchors = getAnchorsFromHtml(htmlPath);
    
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
  
  brokenLinks.forEach(link => {
    console.error(`❌ Broken link in ${link.sourceFile} (line ${link.lineNumber})`);
    console.error(`   Target: ${link.fullLink}`);
    
    if (link.reason === 'file not found') {
      console.error(`   Problem: file not found - check link path`);
    } else {
      console.error(`   Problem: anchor does not exist`);
    }
    console.error('');
  });
  
  console.error(`❌ Found ${brokenLinks.length} broken link${brokenLinks.length === 1 ? '' : 's'}. Build failed.`);
  process.exit(1);
};

main();