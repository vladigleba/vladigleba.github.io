// usage: node build-index.js
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const MiniSearch = require('minisearch');

const LIST_MARKER_REGEX = /^[-*+]\s|^\d+\.\s/;
const HEADING_REGEX = /^#+\s*/;
const BLOCKQUOTE_REGEX = />\s*/g;
const FOOTNOTE_REGEX = /^\[\^\d+\]:\s*/;
const FOOTNOTE_REF_REGEX = /\[\^\d+\]/g;

function cleanText(text, options = {}) {
  let result = text;
  
  if (options.removeHeadingMarkers) {
    result = result.replace(HEADING_REGEX, '');
  }
  if (options.removeBlockquoteMarkers) {
    result = result.replace(BLOCKQUOTE_REGEX, '');
  }
  if (options.removeListMarkers) {
    result = result.replace(LIST_MARKER_REGEX, '');
  }
  if (options.removeFootnoteMarkers) {
    result = result.replace(FOOTNOTE_REGEX, '');
  }
  if (options.removeFootnoteRefs) {
    result = result.replace(FOOTNOTE_REF_REGEX, '');
  }

  // apply universal cleaners
  return result
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // [text](url) → text
    .replace(/\s*\{%\s*ct\s*'([^']*)'\s*%\}/g, ' —$1') // {% ct 'ref' %} → —ref
    .replace(/\{%\s*rf\s*'([^']*)'\s+false\s*%\}/g, '$1') // {% rf 'text' false %} → text
    .replace(/\{%\s*rf\s*'([^']*)'\s*%\}/g, '($1)') // {% rf 'ref' %} → (ref)
    .replace(/[*_`]/g, '') // remove emphasis
    .replace(/\s+/g, ' ') // normalize whitespace
    .trim();
}

const cleanHeading = (text) => cleanText(text, { removeHeadingMarkers: true });
const cleanBlockquote = (text) => cleanText(text, { removeBlockquoteMarkers: true });
const cleanParagraph = (text) => cleanText(text, { removeFootnoteRefs: true });
const cleanFootnote = (text) => cleanText(text, { removeFootnoteMarkers: true });

function cleanListItems(text) {
  return text.split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => cleanText(line, { removeListMarkers: true, removeFootnoteRefs: true }));
}

// long list = blank-separated items (only one item in currentBlock)
// short list = no blank lines (multiple items in currentBlock)
function isLongList(currentBlockLines) {
  const itemCount = currentBlockLines.filter(line => LIST_MARKER_REGEX.test(line)).length;
  return itemCount === 1;
}

function buildUrlFromPath(filePath) {
  const match = filePath.match(/posts\/([^/]+)\/([^.]+)/);
  return match ? `/${match[1]}/${match[2]}/` : '';
}

// separate markdown file content into blocks with search IDs
function extractContentBlocks(bodyText) {
  const blocks = [];
  let currentBlock = [];
  let blockType = 'paragraph';
  let blockCounters = { heading: 0, paragraph: 0, blockquote: 0, list: 0, footnote: 0 };
  let currentListIndex = -1; // track current list for blank-separated items

  // save accumulated block with type-specific cleaning
  const saveBlock = () => {
    if (currentBlock.length === 0) return;

    // combine multi-line block array into single string
    const rawText = blockType === 'list' ? currentBlock.join('\n') : currentBlock.join(' ');

    if (blockType === 'list') {
      const isLong = isLongList(currentBlock);

      // short lists always get new index because they reset to -1 immediately
      // long lists get new index only on first item, reuse for subsequent
      if (currentListIndex === -1 || !isLong) {
        currentListIndex = blockCounters.list++;
      }

      cleanListItems(rawText).forEach((itemText, index) => {
        if (itemText.length > 0) {
            blocks.push({
              id: `list-${currentListIndex}-item-${index}`,
              text: itemText,
              type: 'list'
            });
        }
      });

      // reset list index only for short lists
      if (!isLong) currentListIndex = -1;
    } else {
      // function lookup
      const cleaners = {
        heading:    cleanHeading,
        blockquote: cleanBlockquote,
        footnote:   cleanFootnote,
        paragraph:  cleanParagraph,
      };
      const clean = (cleaners[blockType] || cleanParagraph)(rawText);
      if (clean.length > 0) {
        blocks.push({ 
          id: `${blockType}-${blockCounters[blockType]++}`, 
          text: clean, 
          type: blockType 
        });
      }
      if (blockType !== 'heading') currentListIndex = -1;
    }

    currentBlock = [];
  };

  for (const line of bodyText.split('\n')) {
    const trimmed = line.trim();

    // empty line - save accumulated block
    if (trimmed === '') {
      saveBlock();
      blockType = 'paragraph';
      continue;
    }

    // heading
    if (trimmed.startsWith('#')) {
      saveBlock(); // save accumulated
      currentBlock = [trimmed]; // start new single-line block
      blockType = 'heading';
      saveBlock(); // save immediately, headings are single lines
      blockType = 'paragraph'; // reset to default for next block
      continue;
    }

    // blockquote
    if (trimmed.startsWith('>')) {
      if (blockType !== 'blockquote') {
        saveBlock();
        blockType = 'blockquote';
      }
      currentBlock.push(trimmed); // accumulate multi-line blocks
      continue;
    }

    // list item
    if (LIST_MARKER_REGEX.test(trimmed)) {
      if (blockType !== 'list') {
        saveBlock();
        blockType = 'list';
      }
      currentBlock.push(trimmed);
      continue;
    }

    // footnote definition ([^1])
    if (trimmed.match(/^\[\^(\d+)\]:/)) {
      saveBlock();
      currentBlock = [trimmed]; // start new single-line block
      blockType = 'footnote';
      saveBlock(); // save immediately, footnotes are single lines
      blockType = 'paragraph';
      continue;
    }

    // liquid tags - add to current block
    if (trimmed.startsWith('{%') && trimmed.endsWith('%}')) {
      currentBlock.push(trimmed);
      continue;
    }

    // skip markdown table rows
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) continue;

    // catch-all transition to close previous block and start new paragraph
    if (blockType === 'blockquote' || blockType === 'list') {
      saveBlock();
      blockType = 'paragraph';
    }

    currentBlock.push(trimmed); // add line as start of new paragraph
  }

  saveBlock(); // save final block
  return blocks;
}

// process a single markdown file into a search document
function processMarkdownFile(filePath, docId) {
  const { data: frontmatter, content: bodyText } = matter(fs.readFileSync(filePath, 'utf-8'));
  return {
    id: String(docId),
    title: frontmatter.title || '',
    description: frontmatter.description || '',
    blocks: extractContentBlocks(bodyText),
    url: buildUrlFromPath(filePath),
  };
}

// recursively collect all markdown files from directory
function collectMarkdownFiles(dir, files = []) {
  fs.readdirSync(dir).forEach(file => {
    const filePath = path.join(dir, file);
    fs.statSync(filePath).isDirectory()
      ? collectMarkdownFiles(filePath, files)
      : file.endsWith('.md') && files.push(filePath);
  });
  return files;
}

const BLOCK_TYPE_FIELDS = {
  heading:    'headingsText',
  paragraph:  'paragraphsText',
  blockquote: 'blockquotesText',
  list:       'listsText',
  footnote:   'footnotesText',
};

// generate search index from all posts
function generateSearchIndex(postsDir = path.join(__dirname, '..', 'posts')) {
  const miniSearchOptions = {
    // indexed fields for search relevance scoring
    fields: ['title', 'description', ...Object.values(BLOCK_TYPE_FIELDS)],
    // stored fields to return with search results
    storeFields: ['title', 'description', 'url', 'blocks'],
    boost: {
      title: 5,
      description: 3,
      headingsText: 2,
      paragraphsText: 1,
      blockquotesText: 1,
      listsText: 1,
      footnotesText: 0.5
    },
    // keep typographical apostrophes in tokens to match core.js tokenization
    tokenize: (text) => text.match(/[a-z0-9’-]+/gi) || []
  };

  const index = new MiniSearch(miniSearchOptions);
  const documents = [];
  
  // generate search document for each markdown file and add to index
  collectMarkdownFiles(postsDir).forEach((filePath, idx) => {
    try {
      const doc = processMarkdownFile(filePath, idx);
      documents.push(doc);

      // group block text by type for indexing
      const blocksByType = doc.blocks.reduce((acc, block) => {
        (acc[block.type] ??= []).push(block.text);
        return acc; // return accumulator for next iteration
      }, {});

      // create document w/ concatenated text fields for indexing
      // join arrays of text into single string for each block type
      index.add({
        ...doc,
        ...Object.fromEntries(
          Object.entries(BLOCK_TYPE_FIELDS).map(([type, field]) => [
            field,
            (blocksByType[type] || []).join(' ')
          ])
        )
      });
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

// run the search index generation process
if (require.main === module) { // node build-index.js
  const { index, options, documents } = generateSearchIndex();
  const outDir = path.join(__dirname, '..', '_site', 'assets', 'js');

  fs.mkdirSync(outDir, { recursive: true }); // ensure output directory exists
  const indexPath = path.join(outDir, 'search-index.json');
  fs.writeFileSync(indexPath, JSON.stringify({ index, options, documents }, null, 2));

  console.log(`✅ Search index generated: ${documents.length} posts indexed.`);
}