# Overview

This is a static blog (no server-side code) built with [11ty](https://www.11ty.dev/), using [Liquid](https://liquidjs.com) for templates and [Markdown](https://www.markdownguide.org) for content. Styled with custom CSS and enhanced with vanilla JavaScript.

## Features
- Fast static site generation with 11ty
- Modern and responsive user interface for all screen sizes
- Reader-friendly typography
- Modular layouts using Liquid templates
- Markdown-based posts with footnote support and proper typographic punctuation
- Folder-based category groupings for posts
- Series groupings for posts
- Table of contents and anchor link generation for headings with copy-to-clipboard functionality
- Reading time estimates and last-updated tags (with relative dates) for posts
- SEO-friendly (semantic HTML, sitemap, robots.txt, meta tags, Open Graph, Twitter cards, JSON-LD)
- Accessible keyboard navigation and screen reader support (skip links, ARIA attributes)
- Offline support via service workers
- Automatic deployment to [GitHub Pages](https://pages.github.com) via [GitHub Actions](https://github.com/features/actions)

## Structure
- `_data/` - site data (JSON, JS)
- `_includes/` - layouts, partials, and styles
- `_site/` - output (generated by 11ty)
- `assets/` - images, icons, JS
- `posts/` - blog posts (Markdown)
- `/` - root files (config, main templates)

## Development

### Install dependencies
```
npm install
```

### Build the site

```
npm run build
```

### Start a local dev server (with live reload)

```
npm run serve
```

### Watch for changes (no server)

```
npm run watch
```

### Clean the output folder

```
npm run clean
```
