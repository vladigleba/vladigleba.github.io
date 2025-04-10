document.addEventListener('DOMContentLoaded', () => {

  // collapse table of contents
  const toc = document.querySelector(".toc");
  const toggleBtn = document.getElementById("toggle-toc");
  if (toc && toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      toc.classList.toggle("collapsed");
      toggleBtn.textContent = toc.classList.contains("collapsed") ? "[+]" : "[−]";
    });
  }

  // copy heading anchor links
  document.querySelectorAll(".anchor-link").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const fullUrl = `${window.location.origin}${window.location.pathname}${link.getAttribute("href")}`;
      navigator.clipboard.writeText(fullUrl);

      let copiedMessage = link.parentElement.querySelector(".link-copied-message");
      if (!copiedMessage) {
        copiedMessage = document.createElement("span");
        copiedMessage.classList.add("link-copied-message");
        copiedMessage.textContent = "Link copied!";
        link.insertAdjacentElement("afterend", copiedMessage);

        setTimeout(() => copiedMessage.remove(), 2500);
      }
    });
  });

  // track TOC
  const tocLinks = document.querySelectorAll(".toc a");
  const headings = document.querySelectorAll("main h2, main h3, main h4");
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        document.querySelectorAll(".toc li").forEach((li) => li.classList.remove("active"));
        const id = entry.target.id;
        const activeLink = document.querySelector(`.toc a[href="#${id}"]`);
        if (activeLink) activeLink.closest("li")?.classList.add("active");
      }
    });
  },
  { 
    rootMargin: "-10% 0px -70% 0px", 
    threshold: 1 
  });

  headings.forEach((heading) => observer.observe(heading));

  // verse fetching
  const popup = document.createElement("div");
  popup.id = "verse-popup";
  popup.innerHTML = `<p id="verse-content"></p>`;
  document.body.appendChild(popup);

  document.querySelectorAll(".verse-link").forEach(link => {
    link.addEventListener("click", async (e) => {
      e.preventDefault();

      const reference = link.dataset.reference;
      if (!link.dataset.loaded) {
        try {
          const response = await fetch(`https://bible-api.com/${encodeURIComponent(reference)}?translation=kjv`);
          const data = await response.json();
          link.dataset.verse = `<strong>${reference}</strong> - ${data.text.trim()}`;
          link.dataset.loaded = "true";
        } catch {
          link.dataset.verse = `<strong>${reference}</strong> - Verse not found.`;
        }
      }

      // Show the pop-up near the clicked link
      document.getElementById("verse-content").innerHTML = link.dataset.verse;
      const rect = link.getBoundingClientRect();
      popup.style.top = `${rect.bottom + window.scrollY + 10}px`;
      popup.style.left = `${rect.left + window.scrollX}px`;
      popup.classList.add("show");
    });
  });

  // Close pop-up when clicking outside
  document.addEventListener("click", (e) => {
    if (!popup.contains(e.target) && !e.target.classList.contains("verse-link")) {
      popup.classList.remove("show");
    }
  });
});