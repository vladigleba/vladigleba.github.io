#!/usr/bin/env node
// Usage: node smarten.js path/to/file-or-folder

const fs = require('fs');
const path = require('path');

function isMarkdown(filePath) {
  return path.extname(filePath).toLowerCase() === '.md';
}

function smartenQuotes(text) {
  // Fix apostrophes in contractions and possessives: always use right single quote ’
  // Matches words with internal apostrophes (e.g., don't, Severus', he's)
  text = text.replace(/(\w)'(\w)/g, '$1’$2'); // contractions like don’t, he’s
  text = text.replace(/(\w)'(?=\s|$)/g, '$1’'); // possessive at end of word, e.g. Jesus'

  // Replace standalone double quotes with smart quotes (toggle)
  let isDoubleOpen = true;
  text = text.replace(/"/g, () => {
    const char = isDoubleOpen ? '“' : '”';
    isDoubleOpen = !isDoubleOpen;
    return char;
  });

  // Replace single quotes used as quotations (not apostrophes)
  // Toggle single quotes only if they're surrounded by whitespace or punctuation (approximate)
  let isSingleOpen = true;
  text = text.replace(/(^|[\s\(\[\{])'(.*?)'(?!\w)/g, (match, before, content) => {
    // Surrounding single quotes - replace with opening and closing quotes
    return before + '‘' + content + '’';
  });

  return text;
}

function replaceTypography(text) {
  // Protect frontmatter delimiter lines `---`
  // Replace them temporarily with placeholders so they're untouched
  const fmDelimiter = '---';
  const fmPlaceholder = '@@FRONTMATTER_DELIMITER@@';

  // Replace only the first two occurrences of '---' at start of lines
  let fmCount = 0;
  text = text.replace(/^---$/gm, (match) => {
    fmCount++;
    return fmCount <= 2 ? fmPlaceholder : match;
  });

  // Protect Eleventy shortcodes
  const shortcodeRegex = /{%\s*[^%]+?\s*%}/g;
  const shortcodes = [];
  const placeholders = [];

  text = text.replace(shortcodeRegex, (match) => {
    const key = `@@SHORTCODE_${shortcodes.length}@@`;
    shortcodes.push(match);
    placeholders.push(key);
    return key;
  });

  // Replace -- with literal em dash character
  text = text.replace(/--/g, '—');

  // Tight ellipses (e.g. "Go...now")
  text = text.replace(/(\S)\.{3}(\S)/g, '$1…$2');

  // Standard ellipses
  text = text.replace(/\.{3}/g, '…');

  // Smart quotes with improved apostrophe handling
  text = smartenQuotes(text);

  // Restore shortcodes
  placeholders.forEach((ph, i) => {
    text = text.replace(ph, shortcodes[i]);
  });

  // Smarten markdown link labels only (not URLs)
  text = text.replace(/\[(.*?)\]\((.*?)\)/g, (match, label, url) => {
    const smartLabel = smartenQuotes(label.replace(/--/g, '—'));
    return `[${smartLabel}](${url})`;
  });

  // Restore frontmatter delimiters
  text = text.replace(new RegExp(fmPlaceholder, 'g'), fmDelimiter);

  return text;
}

function processFile(filePath) {
  if (!isMarkdown(filePath)) {
    console.error(`❌ Only .md files are supported: ${filePath}`);
    return; // don't exit whole process, just skip this file
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const updated = replaceTypography(content);
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log(`✅ Processed file: ${filePath}`);
  } catch (err) {
    console.error(`❌ Failed to process ${filePath}: ${err.message}`);
  }
}

function processPath(inputPath) {
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Path does not exist: ${inputPath}`);
    process.exit(1);
  }

  const stats = fs.statSync(inputPath);

  if (stats.isFile()) {
    processFile(inputPath);
  } else if (stats.isDirectory()) {
    const entries = fs.readdirSync(inputPath);
    entries.forEach(entry => {
      const fullPath = path.join(inputPath, entry);
      const entryStats = fs.statSync(fullPath);
      if (entryStats.isDirectory()) {
        processPath(fullPath); // recurse
      } else if (entryStats.isFile() && isMarkdown(fullPath)) {
        processFile(fullPath);
      }
    });
  } else {
    console.error(`❌ Unsupported path type: ${inputPath}`);
  }
}

// Get file or folder path from command-line args
const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node smarten.js path/to/file-or-folder');
  process.exit(1);
}

processPath(inputPath);
