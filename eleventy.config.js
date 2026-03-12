const moment = require('moment');
const readingTime = require('reading-time');
const markdownIt = require('markdown-it');
const markdownItFootnote = require('markdown-it-footnote');
const { JSDOM } = require('jsdom');
const { InputPathToUrlTransformPlugin } = require('@11ty/eleventy');
const CleanCSS = require('clean-css');
const childProcess = require('child_process');
const site = require('./_data/site.json');

// pre-compile slug regexes once at module level
const SLUG_REGEXES = {
  space:      /\s+/g,
  nonWord:    /[^\w\-]+/g,
  multiHyphen: /\-\-+/g,
  trimHyphen: /^-+|-+$/g,
};

const slugify = (text) =>
  text.toLowerCase()
    .replace(SLUG_REGEXES.space, '-')
    .replace(SLUG_REGEXES.nonWord, '')
    .replace(SLUG_REGEXES.multiHyphen, '-')
    .replace(SLUG_REGEXES.trimHyphen, '');

module.exports = async (config) => {

  /*
  settings
  */

  //#region

  // markdown settings and external link handling
  const md = markdownIt({ html: true, linkify: true }).use(markdownItFootnote);
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
  config.addPassthroughCopy({
    'node_modules/minisearch/dist/umd/index.js': 'assets/js/minisearch.js'
  }); // needed for browser use

  //#endregion

  /*
  shortcodes
  */

  //#region

  // cite
  config.addLiquidShortcode('ct', (citation) =>
    `<figcaption>&mdash; ${citation}</figcaption>`
  );

  // reference
  config.addShortcode('rf', (reference, addParens = true) => {
    let currentBook = '';
    const links = reference.split(';').map(r => r.trim()).filter(Boolean).map(ref => {
      const fullRefMatch = ref.match(/^([1-3]?\s?[A-Za-z]+)\s+(.+)/);
      let fullRef;
      if (fullRefMatch) {
        currentBook = fullRefMatch[1];
        fullRef = `${currentBook} ${fullRefMatch[2]}`;
      } else {
        fullRef = currentBook ? `${currentBook} ${ref}` : ref;
      }
      const href = `https://bible-api.com/${encodeURIComponent(fullRef)}?translation=kjv`;
      return `<a href="${href}" class="verse-link" data-reference="${fullRef}" target="_blank" rel="noopener noreferrer">${ref}</a>`;
    });

    const joined = links.join('; ');
    return addParens ? `(${joined})` : joined;
  });

  //#endregion

  /*
  filters
  */

  //#region

  // isArticle
  config.addFilter('isArticle', (page, categories) => {
    const categoriesArray = Object.keys(categories).map(c => c.toLowerCase());
    const urlParts = page.url?.split('/').filter(Boolean) || [];

    // if URL contains more than just category
    // and first URL part matches a category, it's an article
    return urlParts.length > 1 && categoriesArray.includes(urlParts[0].toLowerCase());
  });

  // toLocal
  config.addFilter('toLocal', (date) =>
    date ? moment(date).local().format('MMM D, YYYY') : ''
  );

  // toISO
  config.addFilter('toISO', (date) => {
    if (!date) return '';
    const d = new Date(date);
    return isNaN(d) ? '' : d.toISOString();
  });

  // cssmin
  config.addFilter('cssmin', code => new CleanCSS({}).minify(code).styles);

  // absoluteUrl
  config.addFilter('absoluteUrl', (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;

    // no double slashes at the end of base
    return site.url.replace(/\/$/, '') + (url.startsWith('/') ? url : '/' + url);
  });

  //#endregion

  /*
  collections
  */

  //#region

  // allPosts
  config.addCollection('allPosts', (collectionApi) => {
    const posts = collectionApi.getFilteredByGlob('posts/*/*.md');
    const categories = ['All', ...Object.keys(site.categories)];

    const summariesByCategory = {};
    const groupedPostsByCategory = {};
    const uniqueSeriesByCategory = {};
    const seriesByCategoryLookup = {};
    const highlightedPosts = { featured: [], latest: null };

    categories.forEach(category => {
      summariesByCategory[category] = {
        articleCount: 0, seriesCount: 0,
        standaloneArticleCount: 0, seriesArticleCount: 0, totalReadingTime: 0,
      };
        uniqueSeriesByCategory[category] = new Set(); // to track unique series
        groupedPostsByCategory[category] = [];
        seriesByCategoryLookup[category] = new Map(); // key-value lookup by series name
    });

    const orderedPosts = addNextLinks(sortPosts(posts));
    orderedPosts.forEach(post => {
        addFrontmatterData(post); // add category, length, updated

      if (!post.data.color && post.data.series) {
        post.data.color = site.series[post.data.series].color;
      }

      const { series, category, featured, length } = post.data;

      categories.forEach(categoryFilter => {
        const isAll = categoryFilter === 'All';
        if (!isAll && category !== categoryFilter) return;

        if (series) {
          // series post
          let seriesEntry = seriesByCategoryLookup[categoryFilter].get(series);
          if (!seriesEntry) {
            seriesEntry = {
              type: 'series',
              title: site.series[series].title,
              category,
              color: site.series[series].color,
              posts: [],
            };
            seriesByCategoryLookup[categoryFilter].set(series, seriesEntry);
            groupedPostsByCategory[categoryFilter].push(seriesEntry);
          }
          seriesEntry.posts.push(post);
          uniqueSeriesByCategory[categoryFilter].add(series);
          summariesByCategory[categoryFilter].seriesArticleCount += 1;
        } else {
          // standalone post
          groupedPostsByCategory[categoryFilter].push({
            type: 'standalone',
            category,
            post,
          });
          summariesByCategory[categoryFilter].standaloneArticleCount += 1;
        }

        summariesByCategory[categoryFilter].articleCount += 1;
        summariesByCategory[categoryFilter].totalReadingTime += length || 0;

        // set featured and latest posts
        if (isAll) {
          if (featured) highlightedPosts.featured.push(post);
          if (!highlightedPosts.latest || post.date > highlightedPosts.latest.date) {
            highlightedPosts.latest = post;
          }
        }
      });
    });

    // add seriesInfo after all posts are grouped
    categories.forEach(category => {
      seriesByCategoryLookup[category].forEach(series => {
        series.posts.forEach((post, index) => {
          post.data.seriesInfo = {
            total: series.posts.length,
              current: index + 1,
            posts: series.posts,
          };
        });
      });

        // finalize series counts
      summariesByCategory[category].seriesCount = uniqueSeriesByCategory[category].size;
    });

      orderedPosts.summariesByCategory = summariesByCategory;
    orderedPosts.groupedPostsByCategory = groupedPostsByCategory;
      orderedPosts.highlightedPosts = highlightedPosts;
      orderedPosts.categoriesCount = Object.keys(summariesByCategory).length - 1;

      return orderedPosts; // = [
      //   {
      //     data: { 
      //       title, category, series, color,
      //       seriesInfo: { total, current, posts }, 
      //       next: { url, title },
      //       ... other post data
      //     },
      //     url, inputPath, rawInput, date, ...
      //   },
      //   ... all post objects sorted
      // ]
      // orderedPosts.summariesByCategory = {
      //   'All': { 
      //     articleCount: 50, seriesCount: 8,
      //     standaloneArticleCount: 15, seriesArticleCount: 35, totalReadingTime: 450
      //   },
      //   'Basics': { 
      //     articleCount: 15, seriesCount: 3,
      //     standaloneArticleCount: 5, seriesArticleCount: 10, totalReadingTime: 120
      //   },
      //   'Gospel': { 
      //     articleCount: 20, seriesCount: 3,
      //     standaloneArticleCount: 8, seriesArticleCount: 12, totalReadingTime: 180
      //   },
      //   'Prophecy': { 
      //     articleCount: 15, seriesCount: 2,
      //     standaloneArticleCount: 2, seriesArticleCount: 13, totalReadingTime: 150
      //   }
      // }
      // orderedPosts.groupedPostsByCategory = {
      //   'All': [
      //     { type: 'series', title: 'X', category: 'Basics', color: 'X', posts: [...] },
      //     { type: 'standalone', category: 'Gospel', post: {...} },
      //     ... mixed series and standalone items
      //   ],
      //   'Basics': [ /* only Basics posts/series */ ],
      //   'Gospel': [ /* only Gospel posts/series */ ],
      //   'Prophecy': [ /* only Prophecy posts/series */ ]
      // }
      // orderedPosts.highlightedPosts = {
      //   featured: [ /* posts with featured set to true */ ],
      //   latest: { /* most recent post by date */ }
      // }
      // orderedPosts.categoriesCount = 3 (excluding 'All')
  });

  //#endregion

  /*
  transforms
  */

  //#region

  // modifyHtml
  config.addTransform('modifyHtml', async (content, outputPath) => {
    if (!(outputPath && outputPath.endsWith('.html'))) return content;

    const dom = new JSDOM(content);
    const document = dom.window.document;
    const main = document.querySelector('.content');
    if (!main) return content;

    // wrap blockquote + figcaption pairs in <figure>
    for (const figcaption of document.querySelectorAll('blockquote + figcaption')) {
      const blockquote = figcaption.previousElementSibling;
      const figure = document.createElement('figure');
      blockquote.replaceWith(figure);
      figure.appendChild(blockquote);
      figure.appendChild(figcaption);
    }

    // add data-search-id attributes to content blocks
    const blockCounters = { heading: 0, paragraph: 0, blockquote: 0, list: 0, footnote: 0 };

    // headings (ignore h1 since it's page title)
    for (const heading of main.querySelectorAll('h2, h3, h4, h5, h6')) {
      heading.setAttribute('data-search-id', `heading-${blockCounters.heading++}`);
    }

    // paragraphs (but not inside blockquotes or lists)
    for (const p of main.querySelectorAll('p')) {
      if (!p.closest('blockquote, figure, ul, ol')) {
        p.setAttribute('data-search-id', `paragraph-${blockCounters.paragraph++}`);
      }
    }

    // blockquotes (wrapped in figures after the earlier transform)
    for (const figure of main.querySelectorAll('figure')) {
      if (figure.querySelector('blockquote')) {
        figure.setAttribute('data-search-id', `blockquote-${blockCounters.blockquote++}`);
      }
    }

    // lists (both ul and ol)
    for (const list of main.querySelectorAll('ul, ol')) {
      if (!list.closest('section')) continue; // skip lists outside of main content

      // each list item gets individual blockid
      list.querySelectorAll('li').forEach((li, index) => {
        li.setAttribute('data-search-id', `list-${blockCounters.list}-item-${index}`);
      });
      blockCounters.list++;
    }

    // footnotes
    const footnotesList = main.querySelector('.footnotes-list');
    if (footnotesList) {
      footnotesList.querySelectorAll('li.footnote-item').forEach((li) => {
        li.setAttribute('data-search-id', `footnote-${blockCounters.footnote++}`);
      });
    }

    // early exit if no headings
    const headings = main.querySelectorAll('h2, h3, h4, h5, h6');
    if (headings.length < 1) return content;

    const tocList = document.querySelector('aside ul');
    const fragment = document.createDocumentFragment();

    for (const heading of headings) {
      const text = heading.textContent.trim();
      const slug = slugify(text);

      heading.id = slug;
      heading.setAttribute('tabindex', '-1'); // make heading programmatically focusable

      const link = document.createElement('a');
      link.href = `#${slug}`;
      link.classList.add('anchor-link');
      link.setAttribute('aria-label', 'Copy link');
      link.innerHTML = `
        <svg aria-hidden="true">
          <use href="/assets/images/icons.svg#link"></use>
        </svg>`;
      heading.appendChild(link);

      if (tocList) {
        const listItem = document.createElement('li');
        listItem.innerHTML = `<a href="#${slug}">${text}</a>`;
        fragment.appendChild(listItem);
      }

      // wrap h2 and its following siblings in a <section>
      if (heading.tagName === 'H2') {
        const toWrap = [];
        let current = heading.nextElementSibling;
        while (current) {
          const { tagName, classList } = current;
          if (
            tagName === 'H2' ||
            (tagName === 'P' && classList.contains('next-link')) ||
            (tagName === 'HR' && classList.contains('footnotes-sep')) ||
            classList.contains('footnotes')
          ) break;
          toWrap.push(current);
          current = current.nextElementSibling;
        }
        if (toWrap.length > 0) {
          const section = document.createElement('section');
          heading.parentNode.insertBefore(section, heading);
          section.appendChild(heading);
          for (const el of toWrap) section.appendChild(el);
        }
      }
    }

    if (tocList && fragment.hasChildNodes()) tocList.appendChild(fragment);

    return dom.serialize();
  });

  //#endregion

  /*
  functions
  */

  //#region

  function sortPosts(posts) {
    if (!Array.isArray(posts)) return posts;
    if (!site.useCustomReadingOrder) return posts;
    return posts.sort((a, b) => (a.data.order ?? Infinity) - (b.data.order ?? Infinity));
  }

  function addNextLinks(posts) {
    if (!Array.isArray(posts)) return;
    posts.forEach((post, index) => {
      if (index < posts.length - 1) {
        post.data.next = {
          url: posts[index + 1].url,
          title: posts[index + 1].data.title,
        };
      }
    });
    return posts;
  }

  function addFrontmatterData(post) {
    // category
    post.data.category = getCategoryFromPath(post.inputPath);

    // reading time
    const stats = readingTime(post.rawInput, { wordsPerMinute: 220 });
    post.data.length = Math.floor(stats.minutes);

    // last modified date (from git)
    try {
      const gitDate = childProcess.execSync(
        `git log -1 --format=%cI -- "${post.inputPath}"`, { encoding: 'utf8' }
      ).trim();
      post.data.updated = gitDate ? new Date(gitDate) : null;
    } catch {
      post.data.updated = null;
    }
    return post;
  }

  function getCategoryFromPath(filePath) {
    const normalized = filePath.replace(/\\/g, '/'); // for Windows
    const raw = normalized.split('/')[2];
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  //#endregion
};