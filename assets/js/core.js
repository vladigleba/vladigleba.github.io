if (document.body.classList.contains('js-enabled')) {
  document.addEventListener('DOMContentLoaded', () => {

    /*
    utils
    */

    //#region

    const storageGet = (key) => { 
      try { return localStorage.getItem(key); } 
      catch { return null; } 
    };
    const storageSet = (key, val) => { 
      try { localStorage.setItem(key, val); } 
      catch {} 
    };

    function announceToLiveRegion(message) {
      const liveRegion = document.getElementById('site-live');
      if (liveRegion) {
        liveRegion.textContent = '';
        liveRegion.textContent = message;
      }
    }

    //#endregion

    /*
    nav progress indicator
    */

    //#region

    const navUl = document.querySelector('.main-nav ul');
    const article = document.querySelector('article');
    if (navUl && article) {
      const updateProgress = () => {
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercent = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
        navUl.style.setProperty('--scroll-progress', scrollPercent);
      };

      window.addEventListener('scroll', updateProgress, { passive: true });
      updateProgress();
    }

    //#endregion

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

    document.querySelectorAll('.anchor-link').forEach(link => {
      const copyHandler = (e) => {
        e.preventDefault();

        const fullUrl = `${window.location.origin}${window.location.pathname}${link.getAttribute('href')}`;
        navigator.clipboard.writeText(fullUrl).then(() => {
            if (!link.querySelector('.copy-toast')) {
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
            announceToLiveRegion('Link copied');
          })
          .catch(err => console.error('Error copying text: ', err));
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

    // helper to set active state on a TOC link
    const setActiveTocItem = (link) => {
      document.querySelector('.toc a[aria-current="true"]')?.removeAttribute('aria-current');

      // remove previous active class from all items
      document.querySelectorAll('.toc li').forEach((li) => li.classList.remove('active'));
      
      // set new states if link provided
      if (link) {
        link.setAttribute('aria-current', 'true');
        link.closest('li')?.classList.add('active');
      }
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const activeLink = document.querySelector(`.toc a[href="#${entry.target.id}"]`);
          if (activeLink) setActiveTocItem(activeLink);
        }
      });
    }, { rootMargin: '-10% 0px -70% 0px', threshold: 1 });

    document.querySelectorAll('.content h2, .content h3, .content h4').forEach((h) => observer.observe(h));

    // add click listeners to TOC links to mark them as active
    document.querySelectorAll('.toc a[href^="#"]').forEach((link) => {
      link.addEventListener('click', () => setActiveTocItem(link));
    });

    // focus the referenced element referenced and update aria-current on TOC links
    const focusFragmentTarget = () => {
      const hash = location.hash;
      if (!hash) return;
      const target = document.getElementById(hash.slice(1));
      if (!target) return;

      try { target.focus({ preventScroll: true }); } 
      catch { target.focus(); }
      
      const tocLink = document.querySelector(`.toc a[href="${hash}"]`);
      setActiveTocItem(tocLink);
    };

    // handle initial load and subsequent hash changes (clicks/back/forward)
    focusFragmentTarget();
    window.addEventListener('hashchange', focusFragmentTarget);

    //#endregion

    /*
    popup (verses and footnotes)
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
      try { _lastFocused?.focus(); } catch {}
    };

    // allow closing with Esc key for keyboard users
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') closePopup();
    });

    // helper to position and show popup
    const showPopup = (html, trigger) => {
      if (!html) return;
      document.getElementById('dialog-content').innerHTML = html;

      // position near trigger
      const rect = trigger.getBoundingClientRect();
      const left = Math.min(
        rect.left + window.scrollX,
        window.innerWidth - (popup.offsetWidth || 350) - 10
      );
      popup.style.top = `${rect.bottom + window.scrollY + 10}px`;
      popup.style.left = `${left}px`;

      // set aria label depending on trigger
      const label = trigger.classList.contains('verse-link') ? 'Verse'
        : trigger.closest?.('.footnote-ref') ? 'Footnote'
        : 'Popup';
      popup.setAttribute('aria-label', label);

      // show and make accessible
      _lastFocused = document.activeElement;
      popup.classList.add('show');
      popup.setAttribute('aria-hidden', 'false');

      try { popup.focus({ preventScroll: true }); } 
      catch { popup.focus(); }

      announceToLiveRegion(`${label} opened`);
    };

    // outside-click close
    document.addEventListener('click', (e) => {
      if (!popup.contains(e.target) && !e.target.closest('.verse-link') && !e.target.closest('.footnote-ref')) {
        popup.classList.remove('show');
      }
    });

    // verse popups
    document.querySelectorAll('.verse-link').forEach(link => {
      link.addEventListener('click', async (e) => {
        e.preventDefault();
        
        // build popup
        const reference = link.dataset.reference;
        if (!link.dataset.loaded) {
          try {
          const response = await fetch(
            `https://bible-api.com/${encodeURIComponent(reference)}?translation=kjv`
          );
            const data = await response.json();

            // format verses with verse numbers if multiple, otherwise just show text
            const formattedText = data.verses?.length > 1
              ? data.verses.map(v => `<b>${v.verse}</b> ${v.text.trim()}`).join(' ')
              : data.text.trim();
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

    // footnote listeners
    document.querySelectorAll('.footnote-ref a').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();

        // resolve footnote id from href (e.g. #fn1)
        const id = (link.getAttribute('href') || '').replace(/^#/, '');
        const foot = document.getElementById(id);

        let html;
        if (foot) {
          // clone so we can remove the backref without touching original
          const clone = foot.cloneNode(true);
          clone.querySelector('.footnote-backref')?.remove();
          const num = id.match(/(\d+)/)?.[1] ?? '';
          html = `<strong>Footnote ${num}</strong><br>${clone.querySelector('p').innerHTML.trim()}<br><a href="#" class="see-all-footnotes">Go to all footnotes</a>`;
          announceToLiveRegion(`Footnote ${num} opened`);
        } else {
          html = '<strong>Footnote</strong><br>Not found.';
          announceToLiveRegion('Footnote not found');
        }

        showPopup(html, link);
      });
    });

    // "see all footnotes" handler
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
    const updateRelativeDate = (container) => {
      if (!container) return;
      const timeEl = container.querySelector('time[datetime]');
      if (!timeEl) return;
      const date = new Date(timeEl.getAttribute('datetime'));
      if (isNaN(date)) return;

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      date.setHours(0, 0, 0, 0);
      const diffDays = Math.round((now - date) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) timeEl.textContent = 'today';
      else if (diffDays === 1) timeEl.textContent = 'yesterday';
      else if (diffDays <= 7) timeEl.textContent = `${diffDays} days ago`;
    };

    updateRelativeDate(document.querySelector('footer .last-updated'));
    updateRelativeDate(document.querySelector('header .post-last-updated'));

    // remove spaces
    const heyEl = document.querySelector('footer .hey');
    if (heyEl) heyEl.textContent = heyEl.textContent.replace(/\s+/g, '');

    //#endregion

    /*
    group by series toggle
    */

    //#region

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
      seriesList.setAttribute('aria-hidden', String(isStandalone));
      standaloneList.setAttribute('aria-hidden', String(!isStandalone));

      // update checked state (checked = grouped by series)
      if (postsViewSwitch) postsViewSwitch.checked = !isStandalone;

      // announce change for screen reader users
      announceToLiveRegion(isStandalone ? 'Showing standalone posts' : 'Showing posts grouped by series');
    };

    // init from localStorage (default to series grouping)
    applyView(storageGet(POSTS_VIEW_KEY) === STANDALONE ? STANDALONE : SERIES);

    // add event listener
    postsViewSwitch?.addEventListener('change', (e) => {
      const view = e.target.checked ? SERIES : STANDALONE;
      storageSet(POSTS_VIEW_KEY, view);
      applyView(view);
    });

    //#endregion

    /*
    sort by dropdown
    */

    //#region

    const parseAttrInt = (el, attr) => { 
      const n = parseInt(el.getAttribute(attr), 10);
      return isNaN(n) ? 0 : n; 
    };
    const parseAttrDate = (el, attr) => { 
      const t = Date.parse(el.getAttribute(attr)); 
      return isNaN(t) ? 0 : t; 
    };

    const SORT_COMPARATORS = {
      reading: (a, b) => parseAttrInt(a, 'data-reading-order') - parseAttrInt(b, 'data-reading-order'),
      updated: (a, b) => parseAttrDate(b, 'data-updated') - parseAttrDate(a, 'data-updated'),
      shortest: (a, b) => parseAttrInt(a, 'data-length') - parseAttrInt(b, 'data-length'),
      longest:  (a, b) => parseAttrInt(b, 'data-length') - parseAttrInt(a, 'data-length'),
    };

    const sortListBy = (root, mode) => {
      const comparator = SORT_COMPARATORS[mode];
      if (!comparator) return;
      const sorted = Array.from(root.children).sort(comparator);

      // re-append in new order
      const frag = document.createDocumentFragment();
      sorted.forEach(n => frag.appendChild(n));
      root.appendChild(frag);
    };

    const initCardsSort = () => {
      const select = document.querySelector('#posts-sort-select');
      if (!select || !postsViewSwitch || !standaloneList) return;

      const updateSortControl = () => { select.disabled = postsViewSwitch.checked; }; // disable select when grouped
      updateSortControl();
      postsViewSwitch.addEventListener('change', updateSortControl);

      // apply saved selection from localStorage if present and announce
      const saved = storageGet('posts-sort');
      if (saved) {
        select.value = saved;
        sortListBy(standaloneList, saved);
        announceToLiveRegion(`Sorted by ${select.options[select.selectedIndex].text}`);
        updateSortControl(); // ensure visibility reflects current switch state
      }

      // sort on select change
      select.addEventListener('change', (e) => {
        storageSet('posts-sort', e.target.value);
        sortListBy(standaloneList, e.target.value);
        announceToLiveRegion(`Sorted by ${e.target.options[e.target.selectedIndex].text}`);
      });
    };

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
    const SNIPPET_LENGTH = 165;
    const MAX_SNIPPETS_DISPLAY = 4;

    // normalize straight apostrophes to typographical
    const normalizeApostrophes = (text) => text.replace(/'/g, "’");

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

    // escape special regex characters, then normalize apostrophes
    const createSearchPattern = (term) =>
      term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "’");

    const createSearchRegex = (pattern) => new RegExp(pattern, 'gi');

    // highlight search terms in text
    const highlightTerms = (text, searchPattern) => {
      if (!text || !searchPattern) return escapeHtml(text);
      return escapeHtml(text).replace(new RegExp(`(${searchPattern})`, 'gi'), '<mark>$1</mark>');
    };

    // build a single snippet with ellipsis prefix/suffix
    const buildSnippet = (text, matchIndex, length = SNIPPET_LENGTH) => {
      const halfLength = Math.floor(length / 2); // floor avoids fractional lengths

      let start = Math.max(0, Math.floor(matchIndex - halfLength));
      let end = Math.min(text.length, Math.floor(start + length));

      const originalStart = start;
      const originalEnd = end;

      // if character before snippet is non-whitespace, shift start back to nearest whitespace
      while (start > 0 && !/\s/.test(text[start - 1])) start--;
      // extend end to include complete word
      while (end < text.length && !/\s/.test(text[end])) end++;

      return {
        text: text.substring(start, end).trim().replace(/\s+/g, ' '),
        prefix: originalStart > 0 ? '...' : '',
        suffix: originalEnd < text.length ? '...' : ''
      };
    };

    // limit snippets for display
    const limitSnippetsForDisplay = (items, limit) => ({
      display: items.slice(0, limit),
      hasMore: items.length > limit,
      hiddenCount: Math.max(0, items.length - limit)
    });

    // extract highlighted snippets from a single block
    const extractSnippetsFromBlock = (block, searchPattern, targetLength = SNIPPET_LENGTH) => {
      if (!block.text || !searchPattern) return [];

      const regex = createSearchRegex(searchPattern);
      const matches = [];
      let match;

      // collect all match positions first
      while ((match = regex.exec(block.text)) !== null) matches.push(match.index);

      // group overlapping match windows
      const groups = [];
      for (const matchIndex of matches) {
        const snippetStart = Math.max(
          0, // avoid negative index
          matchIndex - Math.floor(targetLength / 2)
        );
        const snippetEnd = Math.min(
          block.text.length, // avoid going past end of text
          matchIndex + Math.floor(targetLength / 2)
        );
        
        // check if snippet overlaps with last group
        const lastGroup = groups[groups.length - 1];
        if (lastGroup && snippetStart <= lastGroup.end) {
          lastGroup.matches.push(matchIndex); // overlap, add to last group
        } else {
          groups.push({ 
            start: snippetStart,
            end: snippetEnd,
            matches: [matchIndex]
          });
        }
      }

      return groups.map(group => {
        const centerPoint = Math.floor(
          (group.matches[0] + group.matches[group.matches.length - 1]) / 2
        );
        const { text, prefix, suffix } = buildSnippet(block.text, centerPoint, targetLength);
        return {
          text: highlightTerms(`${prefix}${text}${suffix}`, searchPattern),
          blockId: block.id,
          blockType: block.type
        };
      });
    };

    // initialize MiniSearch with lazy-loaded index
    const initializeSearch = async () => {
      if (miniSearchInstance) return true;
      try {
        const response = await fetch(SEARCH_INDEX_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        searchIndexData = await response.json();
        miniSearchInstance = window.MiniSearch.loadJSON(searchIndexData.index, searchIndexData.options);
        
        // create document lookup map to enable instant access to doc data
        miniSearchInstance.documentsById = Object.fromEntries(
          searchIndexData.documents.map(doc => [doc.id, doc])
        );
        return true;
      } catch (err) {
        console.error('error loading search index:', err);
        return false;
      }
    };

    // execute token-based search
    const executeSearch = (query) =>
      miniSearchInstance.search(query, {
        prefix: true,
        fuzzy: 0,
        combineWith: 'AND', // must contain ALL terms
        // include typographical apostrophes in tokens
        tokenize: (text) => text.match(/[a-z0-9’]+/gi) || [] 
      });

    // filter results for exact phrase match
    const filterForExactPhrase = (results, phrase) => {
      const normalizedPhrase = phrase.toLowerCase();
      return results.filter(result => {
        const fullDoc = miniSearchInstance.documentsById[result.id];
        if (`${fullDoc.title} ${fullDoc.description}`.toLowerCase().includes(normalizedPhrase)) return true;
        return fullDoc.blocks.some(block => block.text.toLowerCase().includes(normalizedPhrase));
      });
    };

    // enrich a single result with snippets, highlights, and match counts
    const enrichResult = (result, searchPattern) => {
      const fullDoc = miniSearchInstance.documentsById[result.id];
      let totalMatches = 0;
      const allSnippets = [];

      const countMatches = (text) => (text.match(createSearchRegex(searchPattern)) || []).length;

      totalMatches += countMatches(fullDoc.title);

      if (fullDoc.description) {
        const descMatches = countMatches(fullDoc.description);
        if (descMatches > 0) {
          totalMatches += descMatches;
          allSnippets.push(...extractSnippetsFromBlock(
            { text: fullDoc.description, id: 'description', type: 'description' },
            searchPattern
          ));
        }
      }

      // extract snippets from each matching block
      fullDoc.blocks.forEach(block => {
        const blockMatches = countMatches(block.text);
        if (blockMatches > 0) {
          totalMatches += blockMatches;
          allSnippets.push(...extractSnippetsFromBlock(block, searchPattern));
        }
      });

      const { display: displaySnippets, hasMore: hasMoreSnippets, hiddenCount } =
        limitSnippetsForDisplay(allSnippets, MAX_SNIPPETS_DISPLAY);

      return {
        id: result.id,
        title: highlightTerms(fullDoc.title, searchPattern),
        url: fullDoc.url,
        snippets: displaySnippets,
        allSnippets,
        hasMoreSnippets,
        hiddenSnippetCount: hiddenCount,
        matchCount: totalMatches,
        score: result.score,
        searchQuery: searchPattern
      };
    };

    // return enriched, paginated search results
    const performSearch = (query, page = 0) => {
      if (!miniSearchInstance || !query.trim()) return { 
        results: [], total: 0, hasMore: false 
      };
      try {
        const normalizedQuery = normalizeApostrophes(query);
        
        // always filter for exact phrase match so punctuation matches
        // (tokenizer splits on punctuation)
        const allResults = filterForExactPhrase(executeSearch(normalizedQuery), normalizedQuery);
        const total = allResults.length;
        const startIdx = page * RESULTS_PER_PAGE;
        const endIdx = startIdx + RESULTS_PER_PAGE;
        const searchPattern = createSearchPattern(normalizedQuery);
        return {
          results: allResults.slice(startIdx, endIdx).map(r => enrichResult(r, searchPattern)),
          total,
          hasMore: endIdx < total
        };
      } catch (err) {
        console.error('error performing search:', err);
        return { results: [], total: 0, hasMore: false };
      }
    };

    // lazy-load MiniSearch library
    const loadMiniSearchLibrary = () =>
      new Promise((resolve) => {
        if (window.MiniSearch) { resolve(); return; }
        
        // make available as global variable on window object
        const script = document.createElement('script');
        script.src = '/assets/js/minisearch.js';
        script.onload = resolve;
        script.onerror = () => { 
          console.error('failed to load MiniSearch library'); 
          resolve(); 
        };
        document.head.appendChild(script); // start network request
      });

    const SNIPPET_TYPE_LABELS = {
      description: 'Introduction',
      blockquote: 'Block quote',
      paragraph: 'Commentary',
      footnote: 'Footnote',
      heading: 'Heading',
      list: 'Commentary'
    };

    // render snippet HTML with anchor links
    const renderSnippetHTML = (snippets, resultUrl, searchQuery) =>
      snippets.map((snippet) => {
        const anchor = snippet.blockId !== 'description' ? snippet.blockId : '';
        const url = `${resultUrl}?q=${encodeURIComponent(searchQuery)}#${anchor}`;
        const typeLabel = SNIPPET_TYPE_LABELS[snippet.blockType] || snippet.blockType || '';
        const typeHtml = typeLabel ? `<p class="snippet-type">${typeLabel}</p>` : '';
        
        return `
          <a href="${url}" class="snippet-item" aria-label="${typeLabel} snippet">
            ${typeHtml}
            <p class="snippet">${snippet.text}</p>
          </a>`;
      }).join('');

    // render search results into the DOM
    const renderResults = (results, searchResults) => {
      const fragment = document.createDocumentFragment();

      results.forEach(result => {
        const resultLi = document.createElement('li');
        resultLi.className = 'search-result';

        const snippetsContainerId = `snippets-${result.id}`;
        const { hiddenSnippetCount: hiddenCount } = result;

        const moreSnippetsHtml = result.hasMoreSnippets
          ? `<button class="show-more-snippets" aria-expanded="false" aria-controls="${snippetsContainerId}">
              <span class="expand-icon">↓</span>
              Show ${hiddenCount} more ${hiddenCount === 1 ? 'match' : 'matches'}
            </button>`
          : '';

        const matchCountHtml = result.matchCount > 0
          ? `<span class="match-count">${result.matchCount} ${result.matchCount === 1 ? 'match' : 'matches'}</span>`
          : '';

        const div = document.createElement('div');
        div.innerHTML = `
          <div class="header">
            <h3>${result.title}</h3>
            ${matchCountHtml}
          </div>
          <div class="snippets" id="${snippetsContainerId}">
            ${renderSnippetHTML(result.snippets, result.url, result.searchQuery)}
            ${moreSnippetsHtml}
          </div>`;

        resultLi.appendChild(div);
        
        // store data for in-memory "show more" functionality
        resultLi.dataset.allSnippets = JSON.stringify(result.allSnippets || []);
        resultLi.dataset.resultUrl = result.url;
        resultLi.dataset.searchQuery = result.searchQuery;

        fragment.appendChild(resultLi);
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
      const searchBackBtn = document.getElementById('search-back-btn');

      if (!searchContainer || !searchInput || !searchResults) return;

      let currentPage = 0;
      let currentQuery = '';
      let isLoadingMore = false;
      let lastFocusedBeforeSearch = null;

      const resetSearchState = () => {
        currentPage = 0;
        currentQuery = '';
        isLoadingMore = false;
        searchResults.innerHTML = '';
        searchInput.value = '';
      };

      // focus trap within dialog
      const trapFocus = (e) => {
        if (e.key !== 'Tab') return;
        const focusable = searchContainer.querySelectorAll(
          'button, input, [href], [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        // create focus loop
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); 
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); 
          first.focus();
        }
      };

      // handle Escape key to close dialog
      const handleDialogKeydown = (e) => {
        if (e.key === 'Escape' || e.key === 'Esc') { 
          e.preventDefault(); 
          closeSearch(); 
        }
      };

      const openSearch = async () => {
        if (!miniSearchInstance) {
          await loadMiniSearchLibrary();
          await initializeSearch();
        }

        lastFocusedBeforeSearch = document.activeElement;
        searchContainer.classList.add('active');
        searchContainer.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        searchInput.focus();
        
        // attach focus trap, escape key handlers
        searchContainer.addEventListener('keydown', trapFocus);
        searchContainer.addEventListener('keydown', handleDialogKeydown);
        
        announceToLiveRegion('Search panel opened');
      };

      const closeSearch = () => {
        searchContainer.classList.remove('active');
        searchContainer.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        resetSearchState();
        
        // remove focus trap, escape key handlers
        searchContainer.removeEventListener('keydown', trapFocus);
        searchContainer.removeEventListener('keydown', handleDialogKeydown);
        
        // back to last focused before search
        try { lastFocusedBeforeSearch?.focus(); } catch {}
        announceToLiveRegion('Search panel closed');
      };

      // prevent multiple observers on same elements
      const clearScrollSentinels = () => {
        searchResults.querySelectorAll('.search-scroll-sentinel')
          .forEach(el => infiniteScrollObserver.unobserve(el));
      };

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
          announceToLiveRegion('No results found');
          return;
        }

        // show article count
        if (page === 0 && total > 0) {
          const summaryEl = document.createElement('div');
          summaryEl.className = 'search-summary';
          summaryEl.textContent = `${total} ${total === 1 ? 'article' : 'articles'}`;
          searchResults.appendChild(summaryEl);
          announceToLiveRegion(`${total} ${total === 1 ? 'article' : 'articles'} found`);
        }

        renderResults(results, searchResults);
        if (hasMore) addScrollSentinel(searchResults, infiniteScrollObserver);
        isLoadingMore = false;
      };

      const infiniteScrollObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => { // for each sentinel

          // if visible, not already loading, and we have a query
          if (entry.isIntersecting && !isLoadingMore && currentQuery) {
            currentPage++; // move to next page
            performAndRenderSearch(currentQuery, currentPage, true);
          }
        });
      });

      const expandAllSnippets = (button) => {
        const resultEl = button.closest('.search-result');
        if (!resultEl) return;

        const snippetsContainer = resultEl.querySelector('.snippets');
        const currentSnippetCount = snippetsContainer.querySelectorAll('.snippet-item').length;
        const allSnippets = JSON.parse(resultEl.dataset.allSnippets || '[]');
        snippetsContainer.innerHTML = renderSnippetHTML(
          allSnippets, resultEl.dataset.resultUrl, resultEl.dataset.searchQuery
        );
        button.setAttribute('aria-expanded', 'true');
        button.remove();

        announceToLiveRegion('All matching excerpts expanded');
        
        // focus first newly revealed snippet
        const firstNew = snippetsContainer.querySelectorAll('.snippet-item')[currentSnippetCount];
        if (firstNew) setTimeout(() => firstNew.focus(), 0);
      };

      searchInput.addEventListener('input', (e) => {
        currentQuery = e.target.value;
        currentPage = 0;
        currentQuery ? performAndRenderSearch(currentQuery, 0) : resetSearchState();
      });

      searchBackBtn?.addEventListener('click', (e) => { e.preventDefault(); closeSearch(); });

      searchResults.addEventListener('click', (e) => {
        const showMoreBtn = e.target.closest('.show-more-snippets');
        if (showMoreBtn) {
          e.preventDefault();
          e.stopPropagation();
          expandAllSnippets(showMoreBtn);
        }
      });

      // close when clicking backdrop
      searchContainer.addEventListener('click', (e) => {
        if (e.target === searchContainer) closeSearch();
      });

      // keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          openSearch();
        }
      });

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

    const getArticleUrlParams = () => ({
      searchQuery: new URLSearchParams(window.location.search).get('q'),
      blockId: window.location.hash.slice(1) || null
    });

    const findBlockElement = (blockId) =>
      blockId ? document.querySelector(`[data-search-id="${blockId}"]`) : null;

    // collect text nodes, skipping highlights and excluded containers
    const getTextNodes = (root) => {
      const textNodes = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, (node) => {
        // skip already highlighted nodes
        if (node.parentElement?.classList.contains('search-highlight')) return NodeFilter.FILTER_REJECT;
        // skip nodes inside excluded containers
        if (node.parentElement?.closest('.toc, .series-links, .next-link')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      });
      let node;
      while ((node = walker.nextNode())) textNodes.push(node);
      return textNodes;
    };

    // wrap all matches in <mark>
    const highlightMatchesInElement = (element, searchPattern) => {
      const regex = new RegExp(`(${searchPattern})`, 'gi');
      const marks = [];

      getTextNodes(element).forEach(textNode => {
        const text = textNode.textContent;
        if (!text.match(regex)) return;

        const fragment = document.createDocumentFragment();
        let lastIndex = 0;
        
        // reset regex for exec loop
        regex.lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
          if (match.index > lastIndex) {
            fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
          }
          
          // creates <mark class="search-highlight">match</mark>
          const mark = document.createElement('mark');
          mark.className = 'search-highlight';
          mark.textContent = match[0];
          fragment.appendChild(mark);
          marks.push(mark);
          lastIndex = regex.lastIndex;
        }

        // add remaining plain text
        if (lastIndex < text.length) {
          fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
        }

        textNode.parentNode.replaceChild(fragment, textNode);
      });

      return marks;
    };

    let currentHighlightIndex = -1;
    let allHighlights = [];
    let controlsElement = null;
    let keyboardListenerAttached = false;

    const getAllHighlights = () => Array.from(document.querySelectorAll('mark.search-highlight'));

    const findClosestHighlight = (element) => {
      if (!element || allHighlights.length === 0) return -1;

      // get element's vertical position
      const elementTop = element.getBoundingClientRect().top + window.scrollY;
      let closestIndex = 0;
      let closestDistance = Infinity;
      
      allHighlights.forEach((highlight, index) => {
        const highlightTop = highlight.getBoundingClientRect().top + window.scrollY;
        const distance = Math.abs(highlightTop - elementTop); // vertical distance
        
        // update closest if this is nearer
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });
      return closestIndex;
    };

    const scrollToHighlight = (highlightElement) => {
      if (!highlightElement) return;

      // remove active from all, add to current
      allHighlights.forEach(h => h.classList.toggle('active', h === highlightElement));
      highlightElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const updateCounterDisplay = () => {
      const counter = document.querySelector('.search-counter');
      if (counter) counter.textContent = `${currentHighlightIndex + 1} / ${allHighlights.length}`;
    };

    // navigate highlights (direction: 1 for next, -1 for previous)
    const navigateHighlight = (direction) => {
      if (allHighlights.length === 0) return;

      // update current index with wrap-around
      currentHighlightIndex = (currentHighlightIndex + direction + allHighlights.length) % allHighlights.length;
      scrollToHighlight(allHighlights[currentHighlightIndex]);
      updateCounterDisplay();
      announceToLiveRegion(`Highlight ${currentHighlightIndex + 1} of ${allHighlights.length}`);
    };

    const hideSearchControls = () => controlsElement?.classList.add('hidden');

    // clear all highlights and reset UI
    const clearAllHighlights = () => {
      allHighlights.forEach((mark) => {
        // replace <mark> with its text content
        mark.parentNode.replaceChild(document.createTextNode(mark.textContent), mark);
        mark.parentNode.normalize(); // combine adjacent text nodes
      });
      allHighlights = [];
      currentHighlightIndex = -1;
      hideSearchControls();
      
      // clear URL query parameter and hash
      const url = new URL(window.location);
      url.searchParams.delete('q');
      url.hash = '';

      // update browser URL without reloading
      window.history.replaceState({}, document.title, url);
      announceToLiveRegion('Highlights cleared');
    };

    const showSearchControls = () => {
      if (!controlsElement) { 
        controlsElement = document.createElement('div');
        controlsElement.id = 'article-search-controls';
        controlsElement.className = 'article-search-controls';
        controlsElement.innerHTML = `
          <button class="search-nav-btn" data-action="prev" title="Previous match (Shift+Enter)">← Previous</button>
          <span class="search-counter">1 / ${allHighlights.length}</span>
          <button class="search-nav-btn" data-action="next" title="Next match (Enter)">Next →</button>
          <button class="search-clear-btn" data-action="clear" title="Clear highlights (Escape)">Clear All</button>`;

        // event delegation for buttons
        controlsElement.addEventListener('click', (e) => {
          const action = e.target.dataset.action;
          if (action === 'prev') navigateHighlight(-1);
          else if (action === 'next') navigateHighlight(1);
          else if (action === 'clear') clearAllHighlights();
        });
        document.body.appendChild(controlsElement);
      }

      // attach keyboard listener only once
      if (!keyboardListenerAttached) {
        document.addEventListener('keydown', (e) => {
          if (allHighlights.length === 0) return;

          // screen reader users
          if (e.key === 'Enter') {
            e.preventDefault();
            e.shiftKey ? navigateHighlight(-1) : navigateHighlight(1);
          }
          
          // visual users
          if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { 
            e.preventDefault();
            navigateHighlight(1); // next
          }
          if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            e.preventDefault();
            navigateHighlight(-1); // previous
          }
          if (e.key === 'Escape' || e.key === 'Esc') clearAllHighlights();
        });
        keyboardListenerAttached = true;
      }

      updateCounterDisplay();
      controlsElement.classList.remove('hidden');
      announceToLiveRegion(`${allHighlights.length} matches found. Use Enter to navigate, Escape to clear.`);
    };

    const initArticleHighlighting = () => {
      const { searchQuery, blockId } = getArticleUrlParams();
      if (!searchQuery) return;

      // highlight all matches in the article
      highlightMatchesInElement(document.querySelector('article'), searchQuery);

      // update highlights and show controls if needed
      allHighlights = getAllHighlights();
      if (allHighlights.length === 0) return;

      // scroll to specific block if provided
      if (blockId) {
        const blockElement = findBlockElement(blockId);
        if (blockElement) {
          // find and highlight the closest match to the block
          const closestIndex = findClosestHighlight(blockElement);
          if (closestIndex >= 0) {
            currentHighlightIndex = closestIndex;
            scrollToHighlight(allHighlights[currentHighlightIndex]);
          }
        }
      } else { // no specific block, just highlight the first match
        currentHighlightIndex = 0;
        scrollToHighlight(allHighlights[0]);
      }

      showSearchControls();
      updateCounterDisplay();
    };

    initArticleHighlighting();

    //#endregion

    /*
    stats popup
    */

    //#region

    const statsButton = document.getElementById('stats-popup-button');
    const statsPopup = document.getElementById('stats-popup');

    if (statsButton && statsPopup) {
      statsButton.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = statsPopup.classList.toggle('open');
        statsButton.setAttribute('aria-expanded', isOpen);
        announceToLiveRegion(isOpen ? 'Statistics opened' : 'Statistics closed');
      });

      // close popup when clicking outside
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.stats-popup-wrapper')) {
          statsPopup.classList.remove('open');
          statsButton.setAttribute('aria-expanded', 'false');
          announceToLiveRegion('Statistics closed');
        }
      });
    }

    //#endregion
  });
}