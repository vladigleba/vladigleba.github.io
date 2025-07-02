const moment = require('moment');
const readingTime = require('reading-time');
const markdownIt = require('markdown-it');
const markdownItFootnote = require('markdown-it-footnote');
const { JSDOM } = require('jsdom');
const { InputPathToUrlTransformPlugin } = require('@11ty/eleventy');
const CleanCSS = require('clean-css');
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const site = require('./_data/site.json');

module.exports = async (config) => {
  const md = markdownIt({ html: true, linkify: true }).use(markdownItFootnote);

  // handle external links
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const href = tokens[idx].attrGet('href');
    if (href && /^https?:\/\//.test(href)) {
      tokens[idx].attrSet('target', '_blank');
      tokens[idx].attrSet('rel', 'noopener noreferrer');
    }
    return self.renderToken(tokens, idx, options);
  };

  config.setLibrary('md', md);

  // plugins
  config.addPlugin(InputPathToUrlTransformPlugin);

  // copy
  config.addPassthroughCopy('assets');

  // shortcodes
  config.addLiquidShortcode('ct', (citation) =>
    `<figcaption>&mdash; ${ citation }</figcaption>`
  );

  config.addLiquidShortcode('inlineNavCSS', () => {
    const navCssPath = path.join(__dirname, '_includes', 'styles', 'nav.css');
    return fs.readFileSync(navCssPath, 'utf8');
  });

  config.addShortcode('rf', (reference, addParens = true) => {
    const refs = reference.split(';').map(r => r.trim()).filter(Boolean);
    const links = [];
    let currentBook = '';
  
    refs.forEach(ref => {
      let fullRef = '';
      const fullRefMatch = ref.match(/^([1-3]?\s?[A-Za-z]+)\s+(.+)/);
  
      if (fullRefMatch) {
        currentBook = fullRefMatch[1];
        fullRef = `${currentBook} ${fullRefMatch[2]}`;
      } else if (currentBook) {
        fullRef = `${currentBook} ${ref}`;
      } else {
        fullRef = ref; // fallback if no current book
      }
  
      const encodedRef = encodeURIComponent(fullRef);
      const href = `https://bible-api.com/${encodedRef}?translation=kjv`;
  
      links.push(
        `<a href="${href}" class="verse-link" data-reference="${fullRef}" target="_blank" rel="noopener noreferrer">${ref}</a>`
      );
    });
  
    const joined = links.join('; ');
    return addParens ? `(${joined})` : joined;
  });

  // filters
  config.addLiquidFilter('toUTCString', (date) => {
    if (!date) return '';
    const utc = date.toUTCString();
    return moment.utc(utc).format('MMMM D, YYYY');
  });

  config.addLiquidFilter('toISOString', (date) => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d)) return '';
    return d.toISOString();
  });

  config.addFilter('cssmin', code => new CleanCSS({}).minify(code).styles);

  config.addLiquidFilter('absoluteUrl', (url) => {
    if (!url) return '';
    const base = site.url;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    
    // no double slashes at the end of base
    return base.replace(/\/$/, '') + (url.startsWith('/') ? url : '/' + url);
  });

  // collections
  config.addCollection('groupedPosts', (collectionApi) => {
    const groupedPosts = [];
    const processedSeries = new Map();
    const posts = collectionApi.getFilteredByGlob('posts/*/*.md');

    posts.forEach((post, index) => {
      const { series, color } = post.data;

      // category
      const category = getCategoryFromPath(post.inputPath);
      post.data.category = category;

      // reading time
      const stats = readingTime(post.rawInput, { wordsPerMinute: 220 });
      post.data.length = Math.floor(stats.minutes);

      // last modified date (from git)
      try {
        const gitCmd = `git log -1 --format=%cI -- "${post.inputPath}"`;
        const gitDate = childProcess.execSync(gitCmd, { encoding: 'utf8' }).trim();
        post.data.updated = gitDate ? new Date(gitDate) : null;
      } catch (err) {
        post.data.updated = null;
      }
  
      // next link
      if (index < posts.length - 1) {
        post.data.next = {
          url: posts[index + 1].url,
          title: posts[index + 1].data.title,
        };
      }
      
      // grouping by series
      if (series) {
        let seriesEntry = processedSeries.get(series);
        if (!seriesEntry) {
          seriesEntry = {
            type: 'series',
            title: site.series[series].title,
            category,
            color: site.series[series].color,
            posts: [],
          };

          processedSeries.set(series, seriesEntry);
          groupedPosts.push(seriesEntry);
        }
        
        seriesEntry.posts.push(post);
      } else {
        groupedPosts.push({
          type: 'standalone',
          category,
          post,
        });
      }
    });

    // seriesInfo
    processedSeries.forEach((series) => {
      series.posts.forEach((post, index) => {
        post.data.seriesInfo = {
          total: series.posts.length,
          current: index + 1, //1-based
          posts: series.posts,
        };
      });
    });

    // make last item first
    if (groupedPosts.length > 1) {
      groupedPosts.unshift(groupedPosts.pop());
      const first = groupedPosts[0];
      first.latest = true;
    }

    //printPostsByLength(posts);
    return groupedPosts;
  });

  // transform
  config.addTransform('modifyHtml', async (content, outputPath) => {
    if (!(outputPath && outputPath.endsWith('.html'))) return content;

    const dom = new JSDOM(content);
    const document = dom.window.document;
    const main = document.querySelector('.content');
    if (!main) return content;

    // wrap blockquote/figcaption with figure
    document.querySelectorAll('blockquote + figcaption').forEach((figcaption) => {
      const blockquote = figcaption.previousElementSibling;
      const figure = document.createElement('figure');
      blockquote.replaceWith(figure);
      figure.appendChild(blockquote);
      figure.appendChild(figcaption);
    });

    // add anchors to headings
    const headings = main.querySelectorAll('h2, h3, h4');
    if (headings.length < 1) return content;

    const tocList = document.querySelector('aside ul');
    headings.forEach((heading) => {
      const slug = heading.textContent
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')           // Replace spaces with hyphens
        .replace(/[^\w\-]+/g, '')       // Remove all non-word characters
        .replace(/\-\-+/g, '-')         // Replace multiple hyphens with single hyphen
        .replace(/^-+|-+$/g, '');       // Remove leading/trailing hyphens

      heading.id = slug;

      const link = document.createElement('a');
      link.href = `#${slug}`;
      link.classList.add('anchor-link');
      link.setAttribute('aria-label', 'Copy link');
      link.innerHTML = `
        <svg aria-hidden="true">
          <use href="/assets/images/icons.svg#link"></use>
        </svg>`;
      heading.appendChild(link);

      const listItem = document.createElement('li');
      listItem.innerHTML = `<a href="#${slug}">${heading.textContent}</a>`;
      tocList.appendChild(listItem);
    });

    // wrap h2 and all following siblings until next h2 or p.next-link in section
    main.querySelectorAll('h2').forEach(h2 => {
      let current = h2.nextElementSibling;
      const toWrap = [];

      while (current && !(current.tagName === 'H2' || (current.tagName === 'P' && current.classList.contains('next-link')))) {
        toWrap.push(current);
        current = current.nextElementSibling;
      }

      if (toWrap.length > 0) {
        const section = document.createElement('section');
        h2.parentNode.insertBefore(section, h2);
        section.appendChild(h2);
        toWrap.forEach(el => section.appendChild(el));
      }
    });

    return dom.serialize();
  });

  // functions
  function getCategoryFromPath(path) {
    const filePath = path.replace(/\\/g, '/'); // for Windows
    const rawCategory = filePath.split('/')[2];
    return rawCategory.charAt(0).toUpperCase() + rawCategory.slice(1);
  }

  function printPostsByLength(posts) {
    posts
      .slice() // create shallow copy to avoid mutating original
      .sort((a, b) => b.data.length - a.data.length)
      .forEach((post, index) =>
        console.log(`${index + 1}. ${post.data.title} - ${post.data.length}m`)
      );
  }
};
