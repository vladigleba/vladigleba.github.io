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
});