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

  /*
  settings
  */

  //#region

  // markdown settings and external links handling
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

  //#endregion

  /* 
  shortcodes
  */

  //#region

  // cite
  config.addLiquidShortcode('ct', (citation) =>
    `<figcaption>&mdash; ${ citation }</figcaption>`
  );

  // reference
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
  config.addFilter('toLocal', (date) => {
    if (!date) return '';
    return moment(date).local().format('MMM D, YYYY');
  });

  // toISO
  config.addFilter('toISO', (date) => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d)) return '';
    return d.toISOString();
  });

  // cssmin
  config.addFilter('cssmin', code => new CleanCSS({}).minify(code).styles);

  // absoluteUrl
  config.addFilter('absoluteUrl', (url) => {
    if (!url) return '';
    const base = site.url;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    
    // no double slashes at the end of base
    return base.replace(/\/$/, '') + (url.startsWith('/') ? url : '/' + url);
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
        articleCount: 0,
        seriesCount: 0,
        questionsCount: 0,
      };
      uniqueSeriesByCategory[category] = new Set(); // to track unique series
      groupedPostsByCategory[category] = [];
      seriesByCategoryLookup[category] = new Map(); // key-value lookup by series name
    });

    const orderedPosts = addNextLinks(sortPosts(posts));
    orderedPosts.forEach(post => {
      addFrontmatterData(post); // add category, length, updated, questions
      
      if ((!post.data.color) && post.data.series) {
        post.data.color = site.series[post.data.series].color;
      }

      const { series, category, featured, questions } = post.data;
      categories.forEach(categoryFilter => {
        const isAll = categoryFilter === 'All';

        if (isAll || category === categoryFilter) {
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
          } else {
            // standalone post
            groupedPostsByCategory[categoryFilter].push({
              type: 'standalone',
              category,
              post,
            });
          }

          summariesByCategory[categoryFilter].articleCount += 1;
          summariesByCategory[categoryFilter].questionsCount += questions || 0;

          // set featured and latest posts
          if (isAll) {
            if (featured) highlightedPosts.featured.push(post);
            if (!highlightedPosts.latest || post.date > highlightedPosts.latest.date) {
              highlightedPosts.latest = post;
            }
          }
        }
      });
    });

    // add seriesInfo after all posts are grouped
    categories.forEach(category => {
      seriesByCategoryLookup[category].forEach((series) => {
        series.posts.forEach((post, index) => {
          post.data.seriesInfo = {
            total: series.posts.length,
            current: index + 1, // 1-based index
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

    return orderedPosts; // = [
    //   {
    //     data: { 
    //       title, category, series, color, questions, 
    //       seriesInfo: { total, current, posts }, 
    //       next: { url, title },
    //       ... other post data
    //     },
    //     url, inputPath, rawInput, date, ...
    //   },
    //   ... all post objects sorted
    // ]
    // orderedPosts.summariesByCategory = {
    //   'All': { articleCount: 50, seriesCount: 8, questionsCount: 120 },
    //   'Basics': { articleCount: 15, seriesCount: 3, questionsCount: 35 },
    //   'Gospel': { articleCount: 20, seriesCount: 3, questionsCount: 50 },
    //   'Prophecy': { articleCount: 15, seriesCount: 2, questionsCount: 35 }
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
    //   featured: [ /* posts with featured: true */ ],
    //   latest: { /* most recent post by date */ }
    // }
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
    
    // wrap blockquote/figcaption with figure
    const figcaptions = document.querySelectorAll('blockquote + figcaption');
    for (const figcaption of figcaptions) {
      const blockquote = figcaption.previousElementSibling;
      const figure = document.createElement('figure');
      blockquote.replaceWith(figure);
      figure.appendChild(blockquote);
      figure.appendChild(figcaption);
    }
    
    // early exit if no headings
    const headings = main.querySelectorAll('h2, h3, h4');
    if (headings.length < 1) return content;
        
    // batch DOM operations
    const fragment = document.createDocumentFragment();
    
    // pre-compile regex outside loop
    const spaceRegex = /\s+/g;
    const nonWordRegex = /[^\w\-]+/g;
    const multiHyphenRegex = /\-\-+/g;
    const trimHyphenRegex = /^-+|-+$/g;
    
    // add anchors to all headings AND wrap h2 sections
    const tocList = document.querySelector('aside ul');
    for (const heading of headings) {
      const text = heading.textContent.trim();
      const slug = text
        .toLowerCase()
        .replace(spaceRegex, '-')         // Replace spaces with hyphens
        .replace(nonWordRegex, '')        // Remove all non-word characters
        .replace(multiHyphenRegex, '-')   // Replace multiple hyphens with 
        .replace(trimHyphenRegex, '');    // Remove leading/trailing hyphens
      
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
      
      // wrap h2 sections
      if (heading.tagName === 'H2') {
        let current = heading.nextElementSibling;
        const toWrap = [];
        
        while (current) {
          const tagName = current.tagName;
          const classList = current.classList;
          
          const isH2 = tagName === 'H2';
          const isNextLink = tagName === 'P' && classList.contains('next-link');
          const isFootnotesHr = tagName === 'HR' && classList.contains('footnotes-sep');
          const isFootnotesSection = classList && classList.contains('footnotes');
          
          if (isH2 || isNextLink || isFootnotesHr || isFootnotesSection) break;
          
          toWrap.push(current);
          current = current.nextElementSibling;
        }
        
        if (toWrap.length > 0) {
          const section = document.createElement('section');
          heading.parentNode.insertBefore(section, heading);
          section.appendChild(heading);
          for (const el of toWrap) {
            section.appendChild(el);
          }
        }
      }
    }
    
    // append all TOC items at once
    if (tocList && fragment.hasChildNodes()) {
      tocList.appendChild(fragment);
    }
    
    return dom.serialize();
  });

  //#endregion

  /*
  functions
  */

  //#region

  function sortPosts(posts) {
    if (!Array.isArray(posts)) return posts;
    
    // sort by custom order; if undefined, append to end (infinity)
    if (site.useCustomReadingOrder) {
      return posts.sort((a, b) => {
        const orderA = a.data.order ?? Infinity;
        const orderB = b.data.order ?? Infinity;
        return orderA - orderB;
      });
    }

    return posts;
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
      const gitCmd = `git log -1 --format=%cI -- "${post.inputPath}"`;
      const gitDate = childProcess.execSync(gitCmd, { encoding: 'utf8' }).trim();
      post.data.updated = gitDate ? new Date(gitDate) : null;
    } catch (err) {
      post.data.updated = null;
    }

    // number of questions (H2 headings)
    let source = post.rawInput;
    if (source) {
      const matches = source.match(/^##\s.+$/gm) || [];
      post.data.questions = matches.length;
    } else {
      post.data.questions = 0;
    }

    return post;
  }

  function getCategoryFromPath(path) {
    const filePath = path.replace(/\\/g, '/'); // for Windows
    const rawCategory = filePath.split('/')[2];
    return rawCategory.charAt(0).toUpperCase() + rawCategory.slice(1);
  }

  //#endregion
};