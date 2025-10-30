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
      const liveRegion = document.getElementById('posts-sort-live');
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
            const existing = link.querySelector('.copy-popup');
            if (!existing) {
              const popup = document.createElement('div');
              popup.className = 'copy-popup';
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
    verse fetching
    */

    //#region

    // build skeleton
    const popup = document.createElement('div');
    popup.id = 'verse-popup';
    popup.innerHTML = `<p id="verse-content"></p>`;
    document.body.appendChild(popup);

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
              // single verse: no verse number
              formattedText = data.text.trim();
            }
            
            link.dataset.verse = `<strong>${reference}</strong><br>${formattedText}`;
            link.dataset.loaded = 'true';
          } catch {
            link.dataset.verse = `<strong>${reference}</strong><br>Verse not found.`;
          }
        }
        
        // show the pop-up near the clicked link
        document.getElementById('verse-content').innerHTML = link.dataset.verse;
        const rect = link.getBoundingClientRect();      
        let left = rect.left + window.scrollX;
        const top = rect.bottom + window.scrollY + 10;
        
        // if popup would overflow right edge, shift it left
        const popupWidth = popup.offsetWidth || 300; // estimated default
        const maxLeft = window.innerWidth - popupWidth - 10; // 10px margin
        if (left > maxLeft) left = maxLeft;
        
        popup.style.top = `${top}px`;
        popup.style.left = `${left}px`;
        popup.classList.add('show');
      });
    });

    // close pop-up when clicking outside
    document.addEventListener('click', (e) => {
      if (!popup.contains(e.target) && !e.target.classList.contains('verse-link')) {
        popup.classList.remove('show');
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

        if (liveRegion) liveRegion.textContent = `Sorted by ${e.target.options[e.target.selectedIndex].text}`;
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
  });
}