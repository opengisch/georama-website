# GitHub repository badge

A compact repository badge in the style of the Material for MkDocs repository
widget: Git (or GitHub) icon, `owner/name`, latest release, stars and forks.
The whole badge links to the repository.

```text
┌──────────────────────────────┐
│  ◆   opengisch/georama       │
│      ◇ v26.3  ☆ 9  ⑂ 2       │
└──────────────────────────────┘
```

The HTML is rendered by Hugo; the statistics are fetched in the visitor's
browser from the public GitHub API, so they stay current without rebuilding
the site. There's no backend, npm runtime dependency, framework or icon
library involved.

## Files

| File | Purpose |
|---|---|
| `layouts/_shortcodes/github-badge.html` | Markdown shortcode (delegates to the partial) |
| `layouts/_partials/github-badge.html` | Badge markup; usable from any template |
| `layouts/_partials/github-badge/config.html` | Parameter resolution and validation |
| `layouts/_partials/github-badge/front-matter.html` | Renders badges defined in front matter |
| `layouts/_partials/github-badge/icon.html` | Inline SVG icons |
| `layouts/_partials/github-badge/detect.html` | Decides whether a page needs the assets |
| `layouts/_partials/github-badge/assets.html` | Emits the `<link>` / `<script>` via Hugo Pipes |
| `layouts/_partials/github-badge/styles.html` | Head-of-body stylesheet hook (called from `header/header.html`) |
| `layouts/_partials/github-badge/scripts.html` | Script hook (called from `footer/footer.html`) |
| `assets/css/github-badge.css` | Styles |
| `assets/js/github-badge.js` | Statistics loader |
| `tests/github-badge/` | Tests and fixtures |

## Integration

The theme (`themes/opengis-hugo-theme`) isn't modified. The site already overrides
two theme partials, and each one gets a single line:

- `layouts/_partials/header/header.html` → `{{ partial "github-badge/styles.html" . }}`
  (first line; emits the stylesheet at the top of `<body>`, before any content)
- `layouts/_partials/footer/footer.html` → `{{ partial "github-badge/scripts.html" . }}`
  (last line; emits one deferred `<script>`)

Both hooks only emit anything on pages that contain a badge.

The home page also shows an `opengisch/georama` badge in the navbar, between
the menu and the dark/light switcher (`header/header.html`, `.IsHome` only).
It's hidden below the `lg` breakpoint, where the menu collapses. If another
layout doesn't use these header/footer partials, call the two partials
yourself.

The shortcode output is inserted after Markdown rendering, so it works
**without** enabling `markup.goldmark.renderer.unsafe`.

## Markdown shortcode

```go-html-template
{{< github-badge "opengisch/georama" >}}

{{< github-badge repo="opengisch/georama" >}}

{{< github-badge
    repo="opengisch/georama"
    color="#809c40"
    textColor="#ffffff"
    release="true"
    stars="true"
    forks="false"
    width="216px"
>}}
```

The badge is `inline-flex`, so it can also sit inside a sentence.
Booleans accept `true/false`, `yes/no`, `on/off`, `1/0`, quoted or not.

## Partial (templates)

```go-html-template
{{ partial "github-badge.html" (dict
    "repo" "opengisch/georama"
    "color" "#809c40"
    "page" .
) }}
```

Passing `"page" .` is optional but recommended. The header hook can't see
badges that a layout renders, so with `page` the partial emits the stylesheet
itself (once per page) and flags the page so the footer hook adds the
script. Without `page`, you have three alternatives: put the badge on a page
that also has a shortcode or front matter badge, set
`params.githubBadge.loadAssets: always`, or call
`partial "github-badge/assets.html" "css"` / `"js"` yourself.

## Front matter

```yaml
---
title: "My Open Source Project"
github:
  repo: opengisch/georama
  color: "#809c40"
  release: true
  stars: true
  forks: true
---
```

```yaml
---
github_repositories:
  - repo: opengisch/georama
    color: "#809c40"
  - repo: opengisch/QField
    color: "#333333"
---
```

The shorthand `github: opengisch/georama` (a plain string) works too.
Render these with:

```go-html-template
{{ partial "github-badge/front-matter.html" . }}
```

It outputs a `<div class="github-badges">` wrapper and renders nothing if
neither key is set. The home page layout (`layouts/index.html`) already calls it
below the hero text, so adding `github:` to `content/_index.md` shows a badge
there. The theme's `single.html` / `list.html` aren't overridden. If you need
badges on those pages, override the layout in `layouts/` and add the call.

## Parameters

| Parameter | Default | Accepted values |
|---|---|---|
| `repo` | **required** | `owner/name` (a `https://github.com/` prefix or `.git` suffix is stripped) |
| `color` | `#809c40` | hex, `rgb()/rgba()/hsl()/hsla()`, a named colour, or `var(--x)` |
| `textColor` | `#ffffff` | same as `color` |
| `icon` | `git` | `git`, `github` |
| `release` | `true` | boolean |
| `stars` | `true` | boolean |
| `forks` | `true` | boolean |
| `fallbackToTags` | `true` | boolean. Show the newest tag if there is no release |
| `cacheDuration` | `3600` | seconds, minimum `60` |
| `width` | `auto` | `auto`, `0`, or a number with `px rem em % ch vw vh` (bare numbers are px) |
| `height` | `45px` | same as `width` (used as `min-height`) |
| `borderRadius` | `0px` | same as `width` |
| `target` | `_blank` | `_blank`, `_self`, `_parent`, `_top` |

Priority: shortcode/partial parameter → `params.githubBadge` → built-in
default. Invalid values cause a build **warning** that names the page, and
fall back to the next level. An invalid `repo` renders nothing. With
`target: _blank`, the badge gets `rel="noopener noreferrer"`.

## Global configuration

`hugo.yaml` (this site uses YAML; TOML works the same):

```yaml
params:
  githubBadge:
    color: "#809c40"
    textColor: "#ffffff"
    icon: git
    release: true
    stars: true
    forks: true
    fallbackToTags: true
    cacheDuration: 3600
    borderRadius: 0px
    height: 45px
    target: _blank
    loadAssets: auto   # "always" = load CSS/JS on every page
```

## CSS customization

Colours and sizes given as parameters become inline custom properties on the
badge. Everything else can be themed through these properties:

```css
.github-badge {
  --github-badge-background: #809c40;
  --github-badge-color: #ffffff;
  --github-badge-font-size: 13px;
  --github-badge-stats-font-size: 11px;
  --github-badge-width: auto;
  --github-badge-height: 45px;
  --github-badge-icon-size: 22px;
  --github-badge-border-radius: 0px;
  --github-badge-padding: 5px 20px;
  --github-badge-gap: 10px;
  --github-badge-hover-opacity: 0.8;
  --github-badge-focus-color: var(--github-badge-background);
}
```

The defaults are declared with `:where(.github-badge)` (zero specificity), so
a plain `.github-badge { … }` rule in `assets/sass/styles.scss` overrides them,
whatever the stylesheet order. Inline parameters still win over both.

Dark mode follows the theme's `data-bs-theme="dark"` attribute on `<html>`.
The default dark style changes only the focus ring colour, because the badge
already sits on its own background. To change the badge colour in dark mode:

```css
[data-bs-theme="dark"] .github-badge { --github-badge-background: #5f7f2f; }
```

The font is inherited from the site. All rules are scoped to `.github-badge*`
classes. The `[hidden]` override and `prefers-reduced-motion` handling also
apply only inside the badge.

## API and caching behaviour

For each repository on a page, the script makes these requests:

1. `GET https://api.github.com/repos/{owner}/{repo}`: `full_name`,
   `html_url`, `stargazers_count`, `forks_count`, `archived`
2. `GET …/releases/latest`: `tag_name`. Runs concurrently with (1) and is
   skipped if no badge for that repo shows releases.
3. `GET …/tags?per_page=1`: only when (2) returns 404 and `fallbackToTags`
   is on.

Requests carry no credentials or tokens (`credentials: "omit"`,
`referrerPolicy: "no-referrer"`). Each one times out after 8 s.

Caching works like this:

- Data is stored per repository under `github-badge:v1:repo:{owner/name}`
  in `localStorage`. If storage is unavailable (private mode, blocked
  cookies), an in-memory store is used instead.
- Cached values are rendered immediately. An entry older than
  `cacheDuration` is refreshed in the background, and the badge updates when
  the new data arrives. If several badges for one repo use different
  durations, the shortest one applies.
- All badges on a page share one request per repository. Concurrent
  `init()` calls are deduplicated as well.
- When a request fails (network error, timeout, 5xx, invalid JSON), stale
  data stays on screen and the repository isn't retried for 5 minutes.
- On a rate limit (`403` with `x-ratelimit-remaining: 0`, or `429`), the
  script stops all requests until `x-ratelimit-reset` / `Retry-After`. The
  unauthenticated limit is 60 requests per hour per visitor IP.
- A 404 repository (deleted, private or mistyped) is cached as missing for
  `cacheDuration`.
- Unknown statistics stay hidden; they're never shown as `0`. API text is
  inserted with `textContent`, and `html_url` is used only if it starts
  with `https://github.com/`.
- Archived repositories get the class `github-badge--archived`.

`window.GithubBadge.init()` processes badges added to the DOM after page
load. Set `window.GithubBadgeConfig = { autoInit: false }` before the script
runs to turn off automatic initialisation.

Without JavaScript, the badge is a normal link with icon and repository
name.

## Testing

```bash
npm test            # node --test, no extra dependencies (Node ≥ 22, hugo on PATH)
```

- `tests/github-badge/github-badge.test.mjs` tests the script against a minimal
  fake DOM, with mocked GitHub responses: success, concurrency, release/tag
  fallback, cache expiry, deduplication, stale fallback, rate limits,
  timeouts, invalid data, unavailable `localStorage`.
- `tests/github-badge/hugo-build.test.mjs` runs real Hugo builds (development,
  production `--minify`, a subdirectory `baseURL`, a global-config overlay)
  of the site plus the fixture pages in `tests/github-badge/fixtures/`.
  It checks shortcode/partial/front matter output, asset deduplication,
  no-JS markup, accessibility attributes and CSS scoping.

To view the fixtures in the browser:

```bash
hugo server --config hugo.yaml,tests/github-badge/fixtures/hugo.fixture.yaml
# → http://localhost:1313/badges/shortcodes/
```

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Badge shows only the name | JS disabled, API unreachable, rate limited (check DevTools → Network for `403`), or no data yet. The link still works. Statistics appear after the rate limit resets. |
| Badge is unstyled | The stylesheet wasn't emitted. If the badge comes from a template, pass `"page" .` to the partial (see above). If the layout doesn't use the site's `header/header.html`, call `partial "github-badge/styles.html" .` there. |
| Statistics never load, console shows a CSP error | Add `connect-src 'self' https://api.github.com` if you introduce `default-src` or `connect-src` in `layouts/_partials/head/content-security-policy.html`. |
| Build warning `github-badge: ignoring invalid …` | A parameter failed validation. The warning names the page and the value. |
| Release missing | The repo has no release and no tags, `release=false`, or `fallbackToTags=false` with no release. |
| Old numbers | Values are cached for `cacheDuration`. Clear `github-badge:v1:*` keys in localStorage to force a refresh. |
