document.addEventListener('DOMContentLoaded', () => {

  // collapse table of contents
  const toc = document.querySelector('.toc');
  const toggleBtn = document.getElementById('toggle-toc');
  if (toc && toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      toc.classList.toggle('collapsed');
      toggleBtn.textContent = toc.classList.contains('collapsed') ? '[+]' : '[−]';
    });
  }

  // copy heading anchor links
  document.querySelectorAll('.anchor-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();

      const fullUrl = `${window.location.origin}${window.location.pathname}${link.getAttribute('href')}`;
      navigator.clipboard.writeText(fullUrl)
        .then(() => {
          const existing = link.querySelector('.copy-popup');
          if (!existing) {
            const popup = document.createElement('span');
            popup.className = 'copy-popup';
            popup.textContent = 'Link copied';
            link.appendChild(popup);
            setTimeout(() => popup.remove(), 2500);
          }
        })
        .catch(err => {
          console.error('Error copying text: ', err);
        });
    });
  });

  // track TOC
  const headings = document.querySelectorAll('.content h2, .content h3, .content h4');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        document.querySelectorAll('.toc li').forEach((li) => li.classList.remove('active'));
        const id = entry.target.id;
        const activeLink = document.querySelector(`.toc a[href="#${id}"]`);
        if (activeLink) activeLink.closest('li')?.classList.add('active');
      }
    });
  },
  { 
    rootMargin: '-10% 0px -70% 0px', 
    threshold: 1 
  });

  headings.forEach((heading) => observer.observe(heading));

  // verse fetching
  const popup = document.createElement('div');
  popup.id = 'verse-popup';
  popup.innerHTML = `<p id="verse-content"></p>`;
  document.body.appendChild(popup);

  document.querySelectorAll('.verse-link').forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();

      const reference = link.dataset.reference;
      if (!link.dataset.loaded) {
        try {
          const response = await fetch(`https://bible-api.com/${encodeURIComponent(reference)}?translation=kjv`);
          const data = await response.json();
          link.dataset.verse = `<strong>${reference}</strong> - ${data.text.trim()}`;
          link.dataset.loaded = 'true';
        } catch {
          link.dataset.verse = `<strong>${reference}</strong> - Verse not found.`;
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

  // update footer <time> element to show relative date if within last 7 days
  const updateFooterTime = () => {
    const container = document.querySelector('footer .last-updated');
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

    // Remove "on" if needed
    const textNode = container.firstChild;
    if (diffDays >= 0 && diffDays <= 7 && textNode && textNode.nodeType === Node.TEXT_NODE) {
      textNode.textContent = textNode.textContent.replace('on ', '');
    }

    if (diffDays === 0) {
      timeEl.textContent = 'today';
    } else if (diffDays === 1) {
      timeEl.textContent = 'yesterday';
    } else if (diffDays > 1 && diffDays <= 7) {
      timeEl.textContent = `${diffDays} days ago`;
    }

    // Remove spaces
    const heyEl = document.querySelector('footer .hey');
    if (heyEl) {
      heyEl.textContent = heyEl.textContent.replace(/\s+/g, '');
    }
  };
  updateFooterTime();
});