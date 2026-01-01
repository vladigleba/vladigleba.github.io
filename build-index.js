// Usage: node build-index.js
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const MiniSearch = require('minisearch');

function cleanLinks(text) {
  return text
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // [text](url) → text
    .replace(/\s+/g, ' ') // normalize whitespace
    .trim();
}

function cleanLiquidTags(text) {
  return text
    .replace(/\s*\{%\s*ct\s*'([^']*)'\s*%\}/g, ' —$1') // {% ct 'ref' %} → —ref
    .replace(/\{%\s*rf\s*'([^']*)'\s+false\s*%\}/g, '$1') // {% rf 'text' false %} → text
    .replace(/\{%\s*rf\s*'([^']*)'\s*%\}/g, '($1)'); // {% rf 'ref' %} → (ref)
}

function removeEmphasis(text) {
  return text.replace(/[*_`]/g, '');
}

function removeFootnoteRefs(text) {
  return text.replace(/\[\^\d+\]/g, ''); // remove inline [^1] references
}

function cleanHeading(text) {
  return cleanLinks(removeEmphasis(
    text.replace(/^#+\s*/, '') // remove leading # characters
  ));
}

function cleanBlockquote(text) {
  return cleanLinks(cleanLiquidTags(removeEmphasis(
    text.replace(/^>\s*/gm, '') // remove leading > characters
  )));
}

function cleanParagraph(text) {
  return cleanLinks(cleanLiquidTags(removeEmphasis(removeFootnoteRefs(text))));
}

function cleanList(text, listCounter = { ordered: 0 }) {
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(l => l); // remove falsey values (empty lines)

  const cleaned = lines.map(line => {

    // unordered list: keep the dash
    if (line.match(/^[-*+]\s+/)) { 
      return '- ' + 
        cleanLinks(cleanLiquidTags(removeEmphasis(removeFootnoteRefs(
          line.replace(/^[-*+]\s+/, '')) // remove original list marker
      )));
    }
    
    // ordered list: add incrementing numbers
    if (line.match(/^\d+\.\s+/)) {
      listCounter.ordered++;
      return `${listCounter.ordered}. ` + 
        cleanLinks(cleanLiquidTags(removeEmphasis(removeFootnoteRefs(
          line.replace(/^\d+\.\s+/, '')) // remove original list marker
      )));
    }

    return line; // fallback
  });
  
  return cleaned.join('\n'); // combine into single string
}

function cleanFootnote(text) {
  return cleanLinks(cleanLiquidTags(removeEmphasis(
    text.replace(/^\[\^\d+\]:\s*/, '') // remove leading [^1]:
  )));
}

function buildUrlFromPath(filePath) {
  const match = filePath.match(/posts\/([^/]+)\/([^.]+)/);
  return match ? `/${match[1]}/${match[2]}/` : '';
}

// separate markdown file content into blocks
// assign data-search-id to each block for search result linking
function extractContentBlocks(bodyText) {
  const lines = bodyText.split('\n');
  const blocks = [];
  let currentBlock = [];
  let blockType = 'paragraph';
  let blockCounters = { heading: 0, paragraph: 0, blockquote: 0, list: 0, footnote: 0 };
  let listCounter = { ordered: 0 };
  
  // helper to save accumulated block with type-specific cleaning
  const saveBlock = () => {
    if (currentBlock.length === 0) return;
    
    // combine multi-line block array into single string separated by space
    const rawText = currentBlock.join(' '); 
    let cleanedText = '';
    let blockId = '';
    
    // type-specific cleaning and ID assignment to match eleventy.config.js
    switch(blockType) {
      case 'heading':
        cleanedText = cleanHeading(rawText);
        blockId = `heading-${blockCounters.heading++}`;
        break;
      case 'blockquote':
        cleanedText = cleanBlockquote(rawText);
        blockId = `blockquote-${blockCounters.blockquote++}`;
        break;
      case 'list':
        cleanedText = cleanList(rawText, listCounter);
        blockId = `list-${blockCounters.list++}`;
        break;
      case 'footnote':
        cleanedText = cleanFootnote(rawText);
        blockId = `footnote-${blockCounters.footnote++}`;
        break;
      case 'paragraph':
      default:
        cleanedText = cleanParagraph(rawText);
        blockId = `paragraph-${blockCounters.paragraph++}`;
        break;
    }
    
    // save block
    if (cleanedText.length > 0) {
      blocks.push({
        id: blockId,
        text: cleanedText,
        type: blockType
      });
    }
    
    currentBlock = [];
  };
  
  // loop through each block of text
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // empty line - save accumulated block
    if (line === '') {
      saveBlock(); // save previously accumulated block
      blockType = 'paragraph';
      continue;
    }
    
    // heading (##, ###, etc.)
    if (line.startsWith('#')) {
      saveBlock();
      currentBlock = [line]; // start new single-line block
      blockType = 'heading';
      saveBlock(); // save immediately, headings are single lines
      blockType = 'paragraph'; // reset to paragraph
      continue;
    }
    
    // blockquote (>)
    if (line.startsWith('>')) {
      if (blockType !== 'blockquote') {
        saveBlock();
        blockType = 'blockquote';
      }
      currentBlock.push(line); // accumulate multi-line blocks
      continue;
    }

    // unordered list (-, *, +)
    if (line.match(/^[-*+]\s/)) {
      if (blockType !== 'list') {
        saveBlock();
        blockType = 'list';
        listCounter.ordered = 0; // reset counter for new list
      }
      currentBlock.push(line);
      continue;
    }

    // ordered list (1., 2., etc.)
    if (line.match(/^\d+\.\s/)) {
      if (blockType !== 'list') {
        saveBlock();
        blockType = 'list';
        listCounter.ordered = 0; // reset counter for new list
      }
      currentBlock.push(line);
      continue;
    }

    // footnote definition [^1]: text
    if (line.match(/^\[\^(\d+)\]:/)) {
      saveBlock();
      currentBlock = [line]; // start new single-line block
      blockType = 'footnote';
      saveBlock(); // save immediately, footnotes are typically single lines
      blockType = 'paragraph';
      continue;
    }
    
    // liquid tags - add standalone tag to current block
    if (line.startsWith('{%') && line.endsWith('%}')) {
      currentBlock.push(line);
      continue;
    }
    
    // catch-all transition to close previous block and start new paragraph
    if (blockType === 'blockquote' || blockType === 'list') {
      saveBlock(); // save previous block (either blockquote or list)
      blockType = 'paragraph';
    }
    
    currentBlock.push(line); // add line as start of new paragraph
  }
  
  saveBlock(); // last block
  return blocks;
}

// process a single markdown file into a search document
function processMarkdownFile(filePath, docId) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const { data: frontmatter, content: bodyText } = matter(content);
  
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
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      collectMarkdownFiles(filePath, files);
    } else if (file.endsWith('.md')) {
      files.push(filePath);
    }
  });
  return files;
}

// generate search index from all posts
function generateSearchIndex(postsDir = 'posts') {
  const miniSearchOptions = {
    fields: ['title', 'description', 'headingsText', 'paragraphsText', 'blockquotesText', 'listsText', 'footnotesText'], // indexed fields
    storeFields: ['title', 'description', 'url', 'blocks'], // returned to browser
    boost: { 
      title: 5,
      headingsText: 4,
      description: 3,
      paragraphsText: 1,
      blockquotesText: 1,
      listsText: 1,
      footnotesText: 0.5
    },
    tokenize: (text) => {
      return text.match(/[a-z0-9’-]+/gi) || [];
    } // include typographical apostrophes in tokens to match core.js
  };

  const index = new MiniSearch(miniSearchOptions);
  const documents = [];
  const markdownFiles = collectMarkdownFiles(postsDir);

  // generate search document for each markdown file and add to index
  markdownFiles.forEach((filePath, idx) => {
    try {
      const doc = processMarkdownFile(filePath, idx);
      documents.push(doc);
      
      // reconstruct text fields for indexing
      const headings = doc.blocks.filter(b => b.type === 'heading');
      const paragraphs = doc.blocks.filter(b => b.type === 'paragraph');
      const blockquotes = doc.blocks.filter(b => b.type === 'blockquote');
      const lists = doc.blocks.filter(b => b.type === 'list');
      const footnotes = doc.blocks.filter(b => b.type === 'footnote');
      
      // discarded after tokenization
      const docWithText = {
        ...doc,
        headingsText: headings.map(h => h.text).join(' '),
        paragraphsText: paragraphs.map(p => p.text).join(' '),
        blockquotesText: blockquotes.map(b => b.text).join(' '),
        listsText: lists.map(l => l.text).join(' '),
        footnotesText: footnotes.map(f => f.text).join(' ')
      };
      
      index.add(docWithText);
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
  const outDir = path.join(__dirname, '_site', 'assets', 'js');

  fs.mkdirSync(outDir, { recursive: true }); // ensure output directory exists
  const indexPath = path.join(outDir, 'search-index.json');
  fs.writeFileSync(indexPath, JSON.stringify({ index, options, documents }, null, 2));

  console.log(`✅ Search index generated: ${documents.length} posts indexed.`);
}