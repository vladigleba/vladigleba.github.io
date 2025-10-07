(function () {
  const SELECTOR = '#posts-sort-select';
  const SWITCH_ID = 'posts-view-switch';
  const STANDALONE_LIST = '.standalone-list';
  const SORT_CONTAINER = '.posts-sort';

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

  function init() {
    const select = document.querySelector(SELECTOR);
    const switchEl = document.getElementById(SWITCH_ID);
    const sortWrapper = document.querySelector(SORT_CONTAINER);
    const list = document.querySelector(STANDALONE_LIST);
    if (!select || !switchEl || !sortWrapper || !list) return;

    // show/hide sort control depending on toggle state
    function updateSortControlVisibility() {
      const grouped = switchEl.checked; // when checked we group by series
      sortWrapper.classList.toggle('show', !grouped); // show sort when not grouped
    }

    // add listener for toggle switch
    updateSortControlVisibility();
    switchEl.addEventListener('change', updateSortControlVisibility);

    // record original order in data-reading-order if not present
    Array.from(list.children).forEach((child, idx) => {
      if (!child.hasAttribute('data-reading-order')) child.setAttribute('data-reading-order', idx);
    });

    // apply saved selection from localStorage if present and announce
    const STORAGE_KEY = 'posts-sort';
    const liveRegion = document.getElementById('posts-sort-live');
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
      if (liveRegion) liveRegion.textContent = `Sorted by ${select.options[select.selectedIndex].text}`;
      updateSortControlVisibility(); // ensure visibility reflects current switch state
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
