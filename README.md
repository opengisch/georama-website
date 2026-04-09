# Georama Website

Hugo + Bootstrap 5 landing page for Georama.

## Clone

This repo uses a git submodule for the theme. Clone with:

```bash
git clone --recurse-submodules git@github.com:opengisch/georama-website.git
```

If you already cloned without `--recurse-submodules`, initialise the submodule afterwards:

```bash
git submodule update --init
```

To pull the latest theme changes along with a `git pull`:

```bash
git pull --recurse-submodules
```

## Quick start
- Install Hugo (extended, v0.158+): https://gohugo.io/getting-started/installing/
- Run local dev server: `hugo server --disableFastRender --buildDrafts`
- Build production output: `hugo --minify`

## Image optimization (optional)
Static images in `static/` are not automatically optimized by Hugo. This repo includes an optional optimizer you can run before publishing:

- Install deps: `npm install`
- Dry-run report (no changes): `npm run optimize:images`
- Overwrite originals with smaller PNG/JPG/SVG: `npm run optimize:images:write`
- Also generate WebP sidecars: `npm run optimize:images:webp`

## Notes
- Theme: `opengis-hugo-theme` (git submodule at `themes/opengis-hugo-theme`)
- Content and layout: `data/home.yaml`, `layouts/index.html`
- Custom styles: `assets/sass/styles.scss`
- Generated site is in `public/` (ignored by Git).
