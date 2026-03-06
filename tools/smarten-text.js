// usage: node smarten-text.js path/to/file-or-folder [-d]
// -d for debug mode (prints output instead of writing files)
const fs = require('fs');
const path = require('path');

const isMarkdown = (filePath) => path.extname(filePath).toLowerCase() === '.md';

function smartenQuotes(text) {
  // contractions like don't, he's
  text = text.replace(/(\w)'(\w)/g, '$1’$2');
  // possessive at end of word, e.g. Severus'
  text = text.replace(/(\w)'(?=\s|$)/g, '$1’');

  // alternate open/close double quotes
  let isDoubleOpen = true;
  text = text.replace(/"/g, () => {
    const char = isDoubleOpen ? '“' : '”';
    isDoubleOpen = !isDoubleOpen;
    return char;
  });

  // Single quotes used as quotations
  // Only if they're surrounded by whitespace or parentheses, brackets, or braces
  // Uses negative lookahead (?!) to ensure not followed by a word character
  text = text.replace(/(^|[\s\(\[\{])'(.*?)'(?!\w)/g, (match, before, content) =>
    before + '‘' + content + '’'
  );

  return text;
}

function replaceTypography(text, debugMode = false) {
  const FM_PLACEHOLDER = '@@FRONTMATTER_DELIMITER@@';
  const SHORTCODE_REGEX = /{%\s*[^%]+?\s*%}/g;

  // protect frontmatter delimiters (first two occurrences of --- at line start)
  let fmCount = 0;
  text = text.replace(/^---$/gm, () => (++fmCount <= 2 ? FM_PLACEHOLDER : '---'));

  // protect Eleventy shortcodes
  const shortcodes = [];
  text = text.replace(SHORTCODE_REGEX, (match) => {
    shortcodes.push(match);
    return `@@SHORTCODE_${shortcodes.length - 1}@@`;
  });

  text = text
    .replace(/--/g, '—')           // em dash
    .replace(/(\S)\.{3}(\S)/g, '$1…$2') // tight ellipsis
    .replace(/\.{3}/g, '…');       // standard ellipsis

  text = smartenQuotes(text);

  if (debugMode) {
    console.log('--- Debug Output ---\n');
    console.log(text);
    process.exit(0);
  }

  // restore shortcodes
  shortcodes.forEach((sc, i) => { text = text.replace(`@@SHORTCODE_${i}@@`, sc); });

  // restore frontmatter delimiters
  text = text.replace(new RegExp(FM_PLACEHOLDER, 'g'), '---');

  return text;
}

function processFile(filePath, debugMode = false) {
  if (!isMarkdown(filePath)) {
    console.error(`❌ Only .md files are supported: ${filePath}`);
    return;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const updated = replaceTypography(content, debugMode);
    if (!debugMode) fs.writeFileSync(filePath, updated, 'utf8');
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
    return;
  }

  if (stats.isDirectory()) {
    if (debugMode) {
      console.error('❌ Debug mode only supports a single file.');
      process.exit(1);
    }
    fs.readdirSync(inputPath).forEach(entry => {
      const fullPath = path.join(inputPath, entry);
      const entryStats = fs.statSync(fullPath);
      if (entryStats.isDirectory()) processPath(fullPath);
      else if (entryStats.isFile() && isMarkdown(fullPath)) processFile(fullPath);
    });
    return;
  }

  console.error(`❌ Unsupported path type: ${inputPath}`);
}

const args = process.argv.slice(2); // ignore first two args (node and script name)
const debugMode = args.includes('-d');
const inputPath = args.find(arg => arg !== '-d');

if (!inputPath) {
  console.error('Usage: node smarten-text.js path/to/file-or-folder [-d]');
  process.exit(1);
}

processPath(inputPath, debugMode);
console.log('✅ Smartened text successfully.');