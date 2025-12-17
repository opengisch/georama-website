# Georama Website

Hugo + Bootstrap 5 landing page for Georama.

## Quick start
- Install Hugo (extended): https://gohugo.io/getting-started/installing/
- Run local dev server: `hugo server --disableFastRender --buildDrafts`
- Build production output: `hugo --minify`

## Image optimization (optional)
Static images in `static/` are not automatically optimized by Hugo. This repo includes an optional optimizer you can run before publishing:

- Install deps: `npm install`
- Dry-run report (no changes): `npm run optimize:images`
- Overwrite originals with smaller PNG/JPG/SVG: `npm run optimize:images:write`
- Also generate WebP sidecars: `npm run optimize:images:webp`

## Notes
- Theme: `qfield-theme-v3`
- Content and layout: `data/home.yaml`, `layouts/index.html`
- Custom styles: `assets/sass/styles.scss`
- Generated site is in `public/` (ignored by Git).
