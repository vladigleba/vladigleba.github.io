// Usage: node smarten.js path/to/file-or-folder [-d] 
// -d for debug mode (prints output instead of writing files)

const fs = require('fs');
const path = require('path');

function isMarkdown(filePath) {
  return path.extname(filePath).toLowerCase() === '.md';
}

function smartenQuotes(text) {
  // Apostrophes (possessive uses positive lookahead (?=) to ensure it's followed by whitespace)
  text = text.replace(/(\w)'(\w)/g, '$1’$2'); // contractions like don’t, he’s
  text = text.replace(/(\w)'(?=\s|$)/g, '$1’'); // possessive at end of word, e.g. Severus'

  // Double quotes
  let isDoubleOpen = true;
  text = text.replace(/"/g, () => {
    const char = isDoubleOpen ? '“' : '”';
    isDoubleOpen = !isDoubleOpen;
    return char;
  });

  // Single quotes used as quotations
  // Only if they're surrounded by whitespace or parentheses, brackets, or braces
  // Uses negative lookahead (?!) to ensure not followed by a word character
  text = text.replace(/(^|[\s\(\[\{])'(.*?)'(?!\w)/g, (match, before, content) => {
    return before + '‘' + content + '’';
  });

  return text;
}

function replaceTypography(text, debugMode = false) {
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

  // Smart quotes with apostrophe handling
  text = smartenQuotes(text);

  // Debug mode: print and exit
  if (debugMode) {
    console.log('--- Debug Output ---\n');
    console.log(text);
    process.exit(0);
  }

  // Restore shortcodes
  placeholders.forEach((ph, i) => {
    text = text.replace(ph, shortcodes[i]);
  });

  // Restore frontmatter delimiters
  text = text.replace(new RegExp(fmPlaceholder, 'g'), fmDelimiter);

  return text;
}

function processFile(filePath, debugMode = false) {
  if (!isMarkdown(filePath)) {
    console.error(`❌ Only .md files are supported: ${filePath}`);
    return; // don't exit whole process, just skip this file
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const updated = replaceTypography(content, debugMode);
    if (!debugMode) {
      fs.writeFileSync(filePath, updated, 'utf8');
      // console.log(`✅ Processed file: ${filePath}`);
    }
  } catch (err) {
    console.error(`❌ Failed to process ${filePath}: ${err.message}`);
  }
}

function processPath(inputPath, debugMode = false) {
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Path does not exist: ${inputPath}`);
    process.exit(1);
  }

  const stats = fs.statSync(inputPath);

  if (stats.isFile()) {
    processFile(inputPath, debugMode);
  } else if (stats.isDirectory()) {
    if (debugMode) {
      console.error('❌ Debug mode only supports a single file.');
      process.exit(1);
    }
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
const args = process.argv.slice(2); // ignore first two args (node and script name)
const debugMode = args.includes('-d');
const inputPath = args.find(arg => arg !== '-d');

if (!inputPath) {
  console.error('Usage: node smarten.js path/to/file-or-folder [-d]');
  process.exit(1);
}

processPath(inputPath, debugMode);
