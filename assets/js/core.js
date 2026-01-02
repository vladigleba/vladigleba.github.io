if (document.body.classList.contains('js-enabled')) {
  document.addEventListener('DOMContentLoaded', () => {

    /*
    collapse table of contents
    */

    //#region

    const toc = document.querySelector('.toc');
    const toggleBtn = document.getElementById('toggle-toc');
    if (toc && toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        toc.classList.toggle('collapsed');
        toggleBtn.textContent = toc.classList.contains('collapsed') ? '[+]' : '[−]';
      });
    }

    //#endregion

    /*
    copy heading anchor links to clipboard
    */

    //#region

    function announceToLiveRegion(message) {
      const liveRegion = document.getElementById('site-live');
      if (liveRegion) {
        liveRegion.textContent = '';
        liveRegion.textContent = message;
      }
    }

    document.querySelectorAll('.anchor-link').forEach(link => {
      const copyHandler = (e) => {
        e.preventDefault();

        const fullUrl = `${window.location.origin}${window.location.pathname}${link.getAttribute('href')}`;
        navigator.clipboard.writeText(fullUrl).then(() => {

            // visual feedback
            const existing = link.querySelector('.copy-toast');
            if (!existing) {
              const popup = document.createElement('div');
              popup.className = 'copy-toast';
              popup.innerHTML = `
                <div class="checkmark">
                  <svg><use href="/assets/images/icons.svg#checkmark"></use></svg>
                </div>
                <span>Link copied</span>`;
              link.appendChild(popup);
              setTimeout(() => popup.remove(), 2500);
            }

            // announce to assistive tech
            announceToLiveRegion('Link copied');
          })
          .catch(err => {
            console.error('Error copying text: ', err);
          });
      };

      link.addEventListener('click', copyHandler);

      // ensure spacebar activates link like a button for keyboard users
      link.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          copyHandler(e);
        }
      });
    });

    //#endregion

    /*
    table of contents
    */

    //#region

    // helper to set aria-current on a TOC link only when it changes
    const setActiveTocLink = (link) => {
      const existing = document.querySelector('.toc a[aria-current="true"]');
      if (existing && existing !== link) existing.removeAttribute('aria-current');
      if (link && link.getAttribute('aria-current') !== 'true') link.setAttribute('aria-current', 'true');
    };

    // observer
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          document.querySelectorAll('.toc li').forEach((li) => li.classList.remove('active'));
          const id = entry.target.id;
          const activeLink = document.querySelector(`.toc a[href="#${id}"]`);
          if (activeLink) {
            activeLink.closest('li')?.classList.add('active');
            setActiveTocLink(activeLink);
          }
        }
      });
    },
    { 
      rootMargin: '-10% 0px -70% 0px', 
      threshold: 1 
    });

    const headings = document.querySelectorAll('.content h2, .content h3, .content h4');
    headings.forEach((heading) => observer.observe(heading));

    // focus the referenced element referenced and update aria-current on TOC links
    const focusFragmentTarget = () => {
      const hash = location.hash;
      if (!hash) return;
      const id = hash.slice(1);
      const target = document.getElementById(id);
      if (!target) return;

      try {
        target.focus({ preventScroll: true });
      } catch (e) {
        target.focus();
      }

      const tocLink = document.querySelector(`.toc a[href="#${id}"]`);
      setActiveTocLink(tocLink);
    };

    // handle initial load and subsequent hash changes (clicks/back/forward)
    focusFragmentTarget();
    window.addEventListener('hashchange', focusFragmentTarget);

    //#endregion

    /*
    popup generation (verses and footnotes)
    */

    //#region

    // build skeleton
    const popup = document.createElement('div');
    popup.id = 'dialog-popup';
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-hidden', 'true');
    popup.tabIndex = -1; // allow programmatic focus
    popup.innerHTML = `<p id="dialog-content"></p>`;
    document.body.appendChild(popup);

    let _lastFocused = null; // shared state for popup

    // close popup helper
    const closePopup = () => {
      if (!popup.classList.contains('show')) return;
      popup.classList.remove('show');
      popup.setAttribute('aria-hidden', 'true');
      // restore focus to previously focused element
      try { _lastFocused?.focus(); } catch (e) {}
    };

    // allow closing with Esc key for keyboard users
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        closePopup();
      }
    });

    // helper to position and show popup
    const showPopup = (html, trigger) => {
      if (!html) return;
      document.getElementById('dialog-content').innerHTML = html;

      // position near trigger
      const rect = trigger.getBoundingClientRect();
      let left = rect.left + window.scrollX;
      const top = rect.bottom + window.scrollY + 10;
      const popupWidth = popup.offsetWidth || 350; // estimated default
      const maxLeft = window.innerWidth - popupWidth - 10; // 10px margin
      if (left > maxLeft) left = maxLeft;

      popup.style.top = `${top}px`;
      popup.style.left = `${left}px`;

      // set aria label depending on trigger
      let label = 'Popup';
      if (trigger.classList.contains('verse-link')) label = 'Verse';
      else if (trigger.closest && trigger.closest('.footnote-ref')) label = 'Footnote';
      popup.setAttribute('aria-label', label);

      // show and make accessible
      _lastFocused = document.activeElement;
      popup.classList.add('show');
      popup.setAttribute('aria-hidden', 'false');
      try { popup.focus({ preventScroll: true }); } catch (e) { popup.focus(); }
      announceToLiveRegion(`${label} opened`);
    };

    // verse popup handling
    document.querySelectorAll('.verse-link').forEach(link => {
      link.addEventListener('click', async (e) => {
        e.preventDefault();
        
        // build popup
        const reference = link.dataset.reference;
        if (!link.dataset.loaded) {
          try {
            const response = await fetch(`https://bible-api.com/${encodeURIComponent(reference)}?translation=kjv`);
            const data = await response.json();
            
            // format verses with verse numbers
            let formattedText;
            if (data.verses && data.verses.length > 1) {
              // multi-verse passage: show verse numbers
              formattedText = data.verses.map(v => 
                `<b>${v.verse}</b> ${v.text.trim()}`
              ).join(' ');
            } else {
              formattedText = data.text.trim(); // single verse: no verse number
            }
            
            link.dataset.verse = `<strong>${reference}</strong><br>${formattedText}`;
            link.dataset.loaded = 'true';
            announceToLiveRegion(`Verse loaded: ${reference}`);
          } catch {
            link.dataset.verse = `<strong>${reference}</strong><br>Verse not found.`;
            announceToLiveRegion(`Verse not found: ${reference}`);
          }
        }
        
        showPopup(link.dataset.verse, link);
      });
    });

    // close popup on outside click
    document.addEventListener('click', (e) => {
      const target = e.target;
      if (!popup.contains(target) && !target.closest('.verse-link') && !target.closest('.footnote-ref')) {
        popup.classList.remove('show');
      }
    });

    // footnote popup handling
    document.querySelectorAll('.footnote-ref a').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();

        // resolve footnote id from href (e.g. #fn1)
        const href = link.getAttribute('href') || '';
        const id = href.charAt(0) === '#' ? href.slice(1) : href;
        const foot = document.getElementById(id);

        let html = '';
        if (foot) {
          // clone so we can remove the backref without touching original
          const clone = foot.cloneNode(true);
          const back = clone.querySelector('.footnote-backref');
          if (back) back.remove();
   
          // get content
          const p = clone.querySelector('p');
          const contentHtml = p.innerHTML.trim();

          // extract footnote number from id
          const numMatch = id.match(/(\d+)/);
          const num = numMatch ? numMatch[1] : '';
          html = `
            <strong>Footnote ${num}</strong><br>
            ${contentHtml}<br>
            <a href="#" class="see-all-footnotes">Go to all footnotes</a>`;
          announceToLiveRegion(`Footnote ${num} opened`);
        } else {
          html = '<strong>Footnote</strong><br>Not found.';
          announceToLiveRegion('Footnote not found');
        }

        showPopup(html, link);
      });
    });

    // handle "see all footnotes" links
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('see-all-footnotes')) {
        e.preventDefault();
        closePopup();
        const footnotes = document.querySelector('.footnotes');
        if (footnotes) {
          footnotes.scrollIntoView({ behavior: 'smooth' });
          footnotes.focus();
        }
      }
    });

    //#endregion

    /*
    relative dates
    */

    //#region

    // show relative date if within last 7 days
    const updateFooterTime = () => {
      const updateTimeInContainer = (container) => {
        if (!container) return;
        const timeEl = container.querySelector('time[datetime]');
        if (!timeEl) return;
        const dateStr = timeEl.getAttribute('datetime');
        if (!dateStr) return;
        const date = new Date(dateStr);
        if (isNaN(date)) return;

        const now = new Date();
        now.setHours(0,0,0,0);
        date.setHours(0,0,0,0);
        const diffDays = Math.round((now - date) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
          timeEl.textContent = 'today';
        } else if (diffDays === 1) {
          timeEl.textContent = 'yesterday';
        } else if (diffDays > 1 && diffDays <= 7) {
          timeEl.textContent = `${diffDays} days ago`;
        }
      };

      updateTimeInContainer(document.querySelector('footer .last-updated'));
      updateTimeInContainer(document.querySelector('header .post-last-updated'));

      // remove spaces
      const heyEl = document.querySelector('footer .hey');
      if (heyEl) {
        heyEl.textContent = heyEl.textContent.replace(/\s+/g, '');
      }
    };
    updateFooterTime();

    //#endregion

    /*
    group by series toggle
    */

    //#region

    // posts view toggle (series vs standalone)
    const POSTS_VIEW_KEY = 'postsViewPreference';
    const postsViewSwitch = document.getElementById('posts-view-switch');
    const STANDALONE = 'standalone';
    const SERIES = 'series';
    const seriesList = document.querySelector('.series-list');
    const standaloneList = document.querySelector('.standalone-list');

    // update UI: show/hide lists based on view
    const applyView = (view) => {
      if (!seriesList || !standaloneList) return;
      const isStandalone = view === STANDALONE;
      seriesList.style.display = isStandalone ? 'none' : '';
      standaloneList.style.display = isStandalone ? '' : 'none';

      // ensure content is removed from the accessibility tree when hidden
      seriesList.setAttribute('aria-hidden', isStandalone ? 'true' : 'false');
      standaloneList.setAttribute('aria-hidden', isStandalone ? 'false' : 'true');

      // update checked state (checked = grouped by series)
      if (postsViewSwitch) postsViewSwitch.checked = !isStandalone;

      // announce change for screen reader users
      announceToLiveRegion(isStandalone ? 'Showing standalone posts' : 'Showing posts grouped by series');

    };

    // init from localStorage (default to series grouping)
    const stored = (() => {
      try { 
        return localStorage.getItem(POSTS_VIEW_KEY); 
      } catch (e) { 
        return null; 
      }
    })();
    applyView(stored === STANDALONE ? STANDALONE : SERIES);

    // add event listener
    if (postsViewSwitch) {
      postsViewSwitch.addEventListener('change', (e) => {
        const view = e.target.checked ? SERIES : STANDALONE;
        try { localStorage.setItem(POSTS_VIEW_KEY, view); } catch (err) {}
        applyView(view);
      });
    }

    //#endregion

    /*
    sort by dropdown
    */

    //#region

    const SELECTOR = '#posts-sort-select';
    const SWITCH_ID = 'posts-view-switch';
    const STANDALONE_LIST = '.standalone-list';
    const SORT_CONTAINER = '.posts-sort';
    const STORAGE_KEY = 'posts-sort';

    function parseUpdated(el) {
      const s = el.getAttribute('data-updated');
      if (!s) return 0;
      const t = Date.parse(s);
      return isNaN(t) ? 0 : t;
    }

    function parseLength(el) {
      const s = el.getAttribute('data-length');
      const n = parseInt(s, 10);
      return isNaN(n) ? 0 : n;
    }

    function getOriginalIndex(el) {
      const s = el.getAttribute('data-reading-order');
      const n = parseInt(s, 10);
      return isNaN(n) ? 0 : n;
    }

    function stableSort(nodes, compare) {
      return Array.from(nodes).map((el, i) => ({ el, i })).sort((a, b) => {
        const r = compare(a.el, b.el);
        return r !== 0 ? r : a.i - b.i;
      }).map(x => x.el);
    }

    function sortListBy(root, mode) {
      const children = root.children;
      const sorted = stableSort(children, (a, b) => {
        switch (mode) {
          case 'reading':
            return getOriginalIndex(a) - getOriginalIndex(b);
          case 'updated':
            return parseUpdated(b) - parseUpdated(a); // most recent first
          case 'shortest':
            return parseLength(a) - parseLength(b);
          case 'longest':
            return parseLength(b) - parseLength(a);
          default:
            return 0;
        }
      });

      // re-append in new order
      const frag = document.createDocumentFragment();
      sorted.forEach(n => frag.appendChild(n));
      root.appendChild(frag);
    }

    function initCardsSort() {
      const select = document.querySelector(SELECTOR);
      const switchEl = document.getElementById(SWITCH_ID) || postsViewSwitch;
      const sortWrapper = document.querySelector(SORT_CONTAINER);
      const list = document.querySelector(STANDALONE_LIST);
      if (!select || !switchEl || !sortWrapper || !list) return;

      function updateSortControl() {
        select.disabled = switchEl.checked; // disable select when grouped
      }

      updateSortControl();
      switchEl.addEventListener('change', updateSortControl);

      // apply saved selection from localStorage if present and announce
      const saved = (function () {
        try {
          return localStorage.getItem(STORAGE_KEY);
        } catch (e) {
          return null;
        }
      })();
      if (saved) {
        select.value = saved;
        sortListBy(list, saved);

        // announce change for assistive tech users
        announceToLiveRegion(`Sorted by ${select.options[select.selectedIndex].text}`);
        updateSortControl(); // ensure visibility reflects current switch state
      }

      // sort on select change
      select.addEventListener('change', (e) => {
        const val = e.target.value;
        try {
          localStorage.setItem(STORAGE_KEY, val);
        } catch (err) {
          /* ignore */
        }
        sortListBy(list, val);

        announceToLiveRegion(`Sorted by ${e.target.options[e.target.selectedIndex].text}`);
      });
    }

    // Initialize cards sort logic now that DOMContentLoaded has fired
    try {
      initCardsSort();
    } catch (e) {
      // defensive: don't let this break the rest of core.js
      console.error('Error initializing cards sort:', e);
    }

    //#endregion
    
    /*
    full-text search with snippet generation:
      1. search index is generated at build time via build-index.js
      2. browser uses assets/js/minisearch.js to reconstruct and query index at runtime
    */

    //#region

    let searchIndexData = null;
    let miniSearchInstance = null;
    const SEARCH_INDEX_URL = '/assets/js/search-index.json';
    const RESULTS_PER_PAGE = 10;
    const SNIPPET_LENGTH = 200;
    const MAX_SNIPPETS_DISPLAY = 4;

    // normalize apostrophes - convert straight to typographical
    const normalizeApostrophes = (text) => {
      return text.replace(/'/g, "’");
    };

    // escape HTML entities
    const escapeHtml = (text) => {
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return text.replace(/[&<>"']/g, m => map[m]);
    };

    // escape special regex characters in search terms
    const createSearchPattern = (term) => {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return escaped.replace(/'/g, "’");
    };

    const createSearchRegex = pattern => new RegExp(pattern, 'gi');


    // highlight search terms in text
    const highlightTerms = (text, searchPattern) => {
      if (!text || !searchPattern) return escapeHtml(text);

      const escaped = escapeHtml(text);
      return escaped.replace(
        new RegExp(`(${searchPattern})`, 'gi'),
        '<mark>$1</mark>'
      );
    };

    // build a single snippet with boundaries and ellipsis
    const buildSnippet = (text, matchIndex, length = SNIPPET_LENGTH) => {
      const halfLength = length / 2;
      let start = Math.max(0, matchIndex - halfLength);
      let end = Math.min(text.length, start + length);
      
      // if hit end boundary and snippet is shorter than desired, shift start back
      if (end === text.length && text.length - start < length) {
        start = Math.max(0, text.length - length);
      }
      
      // extract snippet, trim, and defensive length check
      let snippet = text.substring(start, end).trim().replace(/\s+/g, ' ');
      if (snippet.length > length) {
        snippet = snippet.substring(0, length);
      }
      
      return {
        text: snippet,
        prefix: start > 0 ? '...' : '',
        suffix: end < text.length ? '...' : ''
      };
    };

    // limit number of snippets for display
    const limitSnippetsForDisplay = (items, limit) => {
      return {
        display: items.slice(0, limit),
        hasMore: items.length > limit,
        hiddenCount: Math.max(0, items.length - limit)
      };
    };

    // extract matching snippets from a single block with its ID
    const extractSnippetsFromBlock = (block, searchPattern, targetLength = SNIPPET_LENGTH) => {
      if (!block.text || !searchPattern) {
        return [];
      }

      const snippets = []; // array preserves order, allows slicing
      const seenSnippets = new Set(); // set tracks unique snippets
      const regex = createSearchRegex(searchPattern);
      let match;

      // while there are matches
      while ((match = regex.exec(block.text)) !== null) {
        const { text, prefix, suffix } = buildSnippet(block.text, match.index, targetLength);
        const formatted = `${prefix}${text}${suffix}`;
        const highlighted = highlightTerms(formatted, searchPattern);
        
        if (!seenSnippets.has(highlighted)) { // O(1) v O(n) for array .includes()
          seenSnippets.add(highlighted);
          snippets.push({
            text: highlighted,
            blockId: block.id // preserve block ID for linking
          });
        }
      }

      return snippets;
    };

    // initialize MiniSearch with lazy-loaded index generated at build time
    const initializeSearch = async () => {
      if (miniSearchInstance) return true; // build search engine only once

      try { // everything inside can fail, so handle errors gracefully
        const response = await fetch(SEARCH_INDEX_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        searchIndexData = await response.json();
        const MiniSearch = window.MiniSearch; // load from global window via script

        // rebuild MiniSearch instance from saved JSON
        miniSearchInstance = MiniSearch.loadJSON(searchIndexData.index, searchIndexData.options);

        // create document lookup map to enable instant access to doc data
        miniSearchInstance.documentsById = {};
        searchIndexData.documents.forEach(doc => {
          miniSearchInstance.documentsById[doc.id] = doc;
        });

        return true; // search is ready
      } catch (err) {
        console.error('error loading search index:', err);
        return false;
      }
    };

    // execute search query against index
    const executeSearch = (query) => {
      return miniSearchInstance.search(query, {
        prefix: true,
        fuzzy: 0,
        combineWith: 'AND', // must contain ALL terms
        tokenize: (text) => {
          return text.match(/[a-z0-9’]+/gi) || [];
        } // include typographical apostrophes in tokens
      });
    };

    // filter results for exact phrase match after initial token-based search
    const filterForExactPhrase = (results, phrase) => {
      const normalizedPhrase = phrase.toLowerCase();
      
      return results.filter(result => {
        // convert result to full document to grab searchable fields
        const fullDoc = miniSearchInstance.documentsById[result.id];
        
        // check title and description
        const titleDesc = `${fullDoc.title} ${fullDoc.description}`.toLowerCase();
        if (titleDesc.includes(normalizedPhrase)) return true;
        
        // check blocks, stop at first match
        return fullDoc.blocks.some(block => 
          block.text.toLowerCase().includes(normalizedPhrase)
        );
      });
    };

    // enrich a single article result with snippets and highlighting
    const enrichResult = (result, searchPattern) => {
      const fullDoc = miniSearchInstance.documentsById[result.id];
      
      let totalMatches = 0;
      const allSnippets = [];
      
      // count title matches
      const titleRegex = createSearchRegex(searchPattern);
      const titleMatches = (fullDoc.title.match(titleRegex) || []).length;
      totalMatches += titleMatches;
      
      // extract description snippets
      if (fullDoc.description) {
        const descRegex = createSearchRegex(searchPattern);
        const descMatches = (fullDoc.description.match(descRegex) || []).length;

        if (descMatches > 0) {
          totalMatches += descMatches;
          const descSnippets = extractSnippetsFromBlock(
            { text: fullDoc.description, id: 'description' },
            searchPattern
          );
          allSnippets.push(...descSnippets); // flatten
        }
      }
      
      // extract snippets from each matching block
      fullDoc.blocks.forEach(block => {
        const blockSnippets = extractSnippetsFromBlock(block, searchPattern);
        if (blockSnippets.length > 0) {
          totalMatches += blockSnippets.length;
          allSnippets.push(...blockSnippets);
        }
      });

      const {
        display: displaySnippets,
        hasMore: hasMoreSnippets,
        hiddenCount
      } = limitSnippetsForDisplay(allSnippets, MAX_SNIPPETS_DISPLAY);

      return {
        id: result.id,
        title: highlightTerms(fullDoc.title, searchPattern),
        url: fullDoc.url,
        snippets: displaySnippets,
        allSnippets: allSnippets,
        hasMoreSnippets: hasMoreSnippets,
        hiddenSnippetCount: hiddenCount,
        matchCount: totalMatches,
        score: result.score,
        searchQuery: searchPattern
      };
    };

    // return fully enriched, UI-ready search results w/ pagination
    const performSearch = (query, page = 0) => {
      if (!miniSearchInstance || !query.trim()) {
        return { results: [], total: 0, hasMore: false };
      }

      try {
        const normalizedQuery = normalizeApostrophes(query);

        // execute token-based search
        let allResults = executeSearch(normalizedQuery);
        
        // always filter for exact phrase match so punctuation matches
        // (tokenizer splits on punctuation)
        allResults = filterForExactPhrase(allResults, normalizedQuery);

        // pagination
        const totalResults = allResults.length;
        const startIdx = page * RESULTS_PER_PAGE;
        const endIdx = startIdx + RESULTS_PER_PAGE;
        const paginatedResults = allResults.slice(startIdx, endIdx);

        // enrich results with snippets, highlighting, and match counts
        const searchPattern = createSearchPattern(normalizedQuery);
        const enrichedResults = paginatedResults.map(result => 
          enrichResult(result, searchPattern)
        );

        return {
          results: enrichedResults,
          total: totalResults,
          hasMore: endIdx < totalResults
        };
      } catch (err) {
        console.error('error performing search:', err);
        return { results: [], total: 0, hasMore: false };
      }
    };

    // lazy-load MiniSearch library
    const loadMiniSearchLibrary = () => {
      // return promise (loading is async, caller awaits)
      return new Promise((resolve) => {
        if (window.MiniSearch) {
          resolve(); // already loaded
          return;
        }

        // make available as global variable on window object
        const script = document.createElement('script');
        script.src = '/assets/js/minisearch.js';
        script.onload = resolve;
        script.onerror = () => {
          console.error('failed to load MiniSearch library');
          resolve(); // search is non-critical, so resolve anyway
        };
        document.head.appendChild(script); // start network request
      });
    };

    // helper function to render snippet HTML with data-search-id anchors
    const renderSnippetHTML = (snippets, resultUrl, searchQuery) => {
      return snippets.map((snippet) => {
        // use data-search-id as URL fragment
        const anchor = snippet.blockId !== 'description' ? `#${snippet.blockId}` : '';
        const url = `${resultUrl}${anchor}?q=${encodeURIComponent(searchQuery)}`;
        return `
          <a href="${url}" class="snippet-item">
            <p class="snippet">${snippet.text}</p>
          </a>
        `;
      }).join('');
    };

    // render search results
    const renderResults = (results, searchResults) => {
      const fragment = document.createDocumentFragment();

      results.forEach(result => {
        const resultEl = document.createElement('a');
        resultEl.href = result.url;
        resultEl.className = 'search-result';

        const matchCountHtml = result.matchCount > 0
          ? `<span class="match-count">
              ${result.matchCount} ${result.matchCount === 1 ? 'match' : 'matches'}
            </span>`
          : '';

        const snippetsHtml = renderSnippetHTML(result.snippets, result.url, result.searchQuery);

        // show "show x more matches" if there are hidden snippets
        const hiddenCount = result.hiddenSnippetCount;
        const moreSnippetsHtml = result.hasMoreSnippets
          ? `<button class="show-more-snippets" data-result-id="${result.id}">
              <span class="expand-icon">↓</span>
              Show ${hiddenCount} more ${hiddenCount === 1 ? 'match' : 'matches'}
            </button>`
          : '';

        resultEl.innerHTML = `
          <div class="header">
            <h3>${result.title}</h3>
            ${matchCountHtml}
          </div>
          <div class="snippets">
            ${snippetsHtml}
            ${moreSnippetsHtml}
          </div>
        `;

        // store data for in-memory "show more" functionality
        resultEl.dataset.allSnippets = JSON.stringify(result.allSnippets || []);
        resultEl.dataset.resultUrl = result.url;
        resultEl.dataset.searchQuery = result.searchQuery;

        fragment.appendChild(resultEl);
      });

      searchResults.appendChild(fragment);
    };

    // add infinite scroll sentinel
    const addScrollSentinel = (searchResults, observer) => {
      const sentinel = document.createElement('div');
      sentinel.className = 'search-scroll-sentinel';
      searchResults.appendChild(sentinel);
      observer.observe(sentinel);
    };

    // search UI setup
    const setupSearchUI = async () => {
      const searchContainer = document.getElementById('search-container');
      const searchInput = document.getElementById('search-input');
      const searchResults = document.getElementById('search-results');
      const searchTrigger = document.getElementById('search-trigger');

      if (!searchContainer || !searchInput || !searchResults) return;

      // state
      let currentPage = 0;
      let currentQuery = '';
      let isLoadingMore = false;

      // state helpers
      const resetSearchState = () => {
        currentPage = 0;
        currentQuery = '';
        isLoadingMore = false;
        searchResults.innerHTML = '';
        searchInput.value = '';
      };

      // search open / close
      const openSearch = async () => {
        if (!miniSearchInstance) {
          await loadMiniSearchLibrary();
          await initializeSearch();
        }

        searchContainer.classList.add('active');
        document.body.style.overflow = 'hidden';

        // focus after a small delay to ensure visibility transition completes
        setTimeout(() => searchInput.focus(), 50);

        announceToLiveRegion('Search panel opened');
      };

      const closeSearch = () => {
        searchContainer.classList.remove('active');
        document.body.style.overflow = '';
        resetSearchState();
        announceToLiveRegion('Search panel closed');
      };

      // prevent multiple observers on same elements
      const clearScrollSentinels = () => {
        searchResults
          .querySelectorAll('.search-scroll-sentinel')
          .forEach(el => infiniteScrollObserver.unobserve(el));
      };

      // search execution + rendering
      const performAndRenderSearch = async (query, page = 0, append = false) => {
        if (query.trim().length <= 1) return;

        isLoadingMore = true;
        const { results, total, hasMore } = performSearch(query, page);

        // clear previous results if starting new search
        if (!append) {
          clearScrollSentinels();
          searchResults.innerHTML = '';
        }

        if (!results.length && page === 0) {
          searchResults.innerHTML = '<p class="empty">No results found</p>';
          isLoadingMore = false;
          return;
        }

        // show article count
        if (page === 0 && total > 0) {
          const summaryEl = document.createElement('div');
          summaryEl.className = 'search-summary';
          summaryEl.textContent = `${total} ${total === 1 ? 'article' : 'articles'}`;
          searchResults.appendChild(summaryEl);
        }

        renderResults(results, searchResults);

        if (hasMore) {
          addScrollSentinel(searchResults, infiniteScrollObserver);
        }

        isLoadingMore = false;
      };

      // infinite scroll observer
      const infiniteScrollObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => { // for each sentinel

          // if visible, not already loading, and we have a query
          if (entry.isIntersecting && !isLoadingMore && currentQuery) {
            currentPage++; // move to next page
            performAndRenderSearch(currentQuery, currentPage, true);
          }
        });
      });

      // snippet expansion
      const expandAllSnippets = (button) => {
        const resultEl = button.closest('.search-result');
        if (!resultEl) return;

        const snippetsContainer = resultEl.querySelector('.snippets');
        const allSnippets = JSON.parse(resultEl.dataset.allSnippets || '[]');
        const resultUrl = resultEl.dataset.resultUrl;
        const searchQuery = resultEl.dataset.searchQuery;

        snippetsContainer.innerHTML = renderSnippetHTML(allSnippets, resultUrl, searchQuery);
        button.remove();

        announceToLiveRegion('All matching excerpts expanded');
      };

      // event: search input
      searchInput.addEventListener('input', (e) => {
        currentQuery = e.target.value;
        currentPage = 0;

        if (currentQuery) { // if query present
          performAndRenderSearch(currentQuery, 0);
        } else { // search cleared
          resetSearchState();
        }
      });

      // event delegation (results)
      searchResults.addEventListener('click', (e) => {
        const showMoreBtn = e.target.closest('.show-more-snippets');
        if (showMoreBtn) {
          e.preventDefault();
          e.stopPropagation();
          expandAllSnippets(showMoreBtn);
          return;
        }
      });

      // close when clicking backdrop
      searchContainer.addEventListener('click', (e) => {
        if (e.target === searchContainer) {
          closeSearch();
        }
      });

      // keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        const isCmdOrCtrlK =
          (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';

        if (e.key === 'Escape' && searchContainer.classList.contains('active')) {
          closeSearch();
        }

        if (isCmdOrCtrlK) {
          e.preventDefault();
          openSearch();
        }
      });

      // trigger button
      searchTrigger?.addEventListener('click', openSearch);
    };

    try {
      setupSearchUI();
    } catch (err) {
      console.error('error setting up search UI:', err);
    }

    //#endregion

    /*
    article page: highlight search matches
    */

    //#region

    // get URL parameters for article page highlighting
    // example URL: /gospel/law/#blockquote-2?q=queryString
    const getArticleUrlParams = () => {
      const hash = window.location.hash.slice(1); // get everything after '#'
      const [blockId, queryString] = hash.split('?');

      // parse query string either from hash or full URL if undefined
      const params = new URLSearchParams(queryString || window.location.search);
      
      return {
        searchQuery: params.get('q'),
        blockId: blockId || null
      };
    };

    const findBlockElement = (blockId) => {
      return blockId ? document.querySelector(`[data-search-id="${blockId}"]`) : null;
    };

    // find text nodes within a root element, excluding existing highlights
    const getTextNodes = (root) => {
      const textNodes = [];
      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        (node) => { // filter function to skip already highlighted nodes
          return node.parentElement?.classList.contains('search-highlight')
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT;
        }
      );
      
      // collect all accepted text nodes
      let node;
      while (node = walker.nextNode()) {
        textNodes.push(node);
      }
      return textNodes;
    };

    // find all occurrences of search pattern and wrap in <mark>
    const highlightMatchesInElement = (element, searchPattern) => {
      const regex = new RegExp(`(${searchPattern})`, 'gi');
      const textNodes = getTextNodes(element); // get text nodes to search
      const matches = [];
      
      textNodes.forEach(textNode => {
        const text = textNode.textContent;
        const nodeMatches = text.match(regex);
        
        if (!nodeMatches) return;
        
        const fragment = document.createDocumentFragment(); // replacement
        let lastIndex = 0;
        
        // reset regex for exec loop
        regex.lastIndex = 0;
        let match;
        
        while ((match = regex.exec(text)) !== null) {
          // add plain text before match
          if (match.index > lastIndex) { // there is text before the match
            fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
          }
          
          // creates <mark class="search-highlight">match</mark>
          const mark = document.createElement('mark');
          mark.className = 'search-highlight';
          mark.textContent = match[0];
          fragment.appendChild(mark);
          matches.push(mark);
          
          lastIndex = regex.lastIndex;
        }
        
        // add remaining plain text
        if (lastIndex < text.length) {
          fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
        }
        
        textNode.parentNode.replaceChild(fragment, textNode);
      });
      
      return matches;
    };

    const scrollToElement = (element) => {
      if (!element) return;
      
      element.classList.add('search-block-focus');
      
      // pageYOffset is how far page is scrolled vertically already
      const offset = 100; // for fixed header
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    };

    const initArticleHighlighting = () => {
      const { searchQuery, blockId } = getArticleUrlParams();
      
      if (!searchQuery) return;
      
      // highlight specific block if provided
      if (blockId) {
        const blockElement = findBlockElement(blockId);
        if (blockElement) {
          highlightMatchesInElement(blockElement, searchQuery);
          scrollToElement(blockElement);
          return;
        }
      }

      // highlight all matches in article
      const contentContainer = document.querySelector('article .content, main');
      highlightMatchesInElement(contentContainer, searchQuery);
    };

    initArticleHighlighting();

    //#endregion
  });
}