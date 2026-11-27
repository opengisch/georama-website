// Build tests for the GitHub badge templates. Runs real Hugo builds of the
// site plus fixture pages (tests/github-badge/fixtures) and inspects the HTML.
// Requires the `hugo` binary on PATH. Run: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FIXTURE = 'tests/github-badge/fixtures/hugo.fixture.yaml';
const GLOBAL = 'tests/github-badge/fixtures/hugo.global.yaml';
const tmp = mkdtempSync(join(tmpdir(), 'github-badge-'));
const builds = {};

function build(name, args) {
  const dest = join(tmp, name);
  const res = execFileSync('hugo', ['--destination', dest, '--cleanDestinationDir', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return { dest, log: res };
}

function buildWithLog(name, args) {
  // Hugo prints warnings to stderr; capture both streams.
  const dest = join(tmp, name);
  const out = execFileSync('sh', ['-c', 'hugo "$@" 2>&1', 'hugo', '--destination', dest, '--cleanDestinationDir', ...args], {
    cwd: ROOT,
    encoding: 'utf8'
  });
  return { dest, log: out };
}

const read = (b, path) => readFileSync(join(builds[b].dest, path), 'utf8');
const badges = (html) => html.match(/<a class="github-badge[\s\S]*?<\/a>/g) || [];
const count = (html, re) => (html.match(re) || []).length;
const cssLinks = (html) => html.match(/<link rel=["]?stylesheet["]? href=["]?[^ ">]*github-badge[^ ">]*/g) || [];
const scripts = (html) => html.match(/<script src=["]?[^ ">]*github-badge[^ ">]*/g) || [];

before(() => {
  builds.dev = buildWithLog('dev', ['--config', `hugo.yaml,${FIXTURE}`, '--environment', 'development']);
  builds.prod = build('prod', ['--config', `hugo.yaml,${FIXTURE}`, '--environment', 'production', '--minify', '--gc']);
  builds.sub = build('sub', ['--config', `hugo.yaml,${FIXTURE}`, '--environment', 'production', '--minify', '--baseURL', 'https://example.org/sub/dir/']);
  builds.global = build('global', ['--config', `hugo.yaml,${FIXTURE},${GLOBAL}`, '--environment', 'development']);
  builds.site = build('site', ['--environment', 'production', '--minify']);
});

after(() => rmSync(tmp, { recursive: true, force: true }));

test('positional shortcode renders a default badge', () => {
  const [b] = badges(read('dev', 'badges/shortcodes/index.html'));
  assert.match(b, /href="https:\/\/github\.com\/opengisch\/georama"/);
  assert.match(b, /target="_blank" rel="noopener noreferrer"/);
  assert.match(b, /data-repo="opengisch\/georama" data-release="true" data-stars="true" data-forks="true" data-fallback-to-tags="true" data-cache-duration="3600"/);
  assert.match(b, /github-badge--icon-git/);
  assert.doesNotMatch(b, /style=/, 'defaults come from the stylesheet');
  assert.equal(count(b, /data-github-badge-fact="/g), 3);
});

test('named shortcode parameters, string and bare booleans', () => {
  const b = badges(read('dev', 'badges/shortcodes/index.html'))[1];
  assert.match(b, /href="https:\/\/github\.com\/opengisch\/QField"/);
  assert.match(b, /style="--github-badge-background:#333333;--github-badge-height:50px;--github-badge-color:#fafafa;--github-badge-width:216px"/);
  assert.match(b, /github-badge--icon-github/);
  assert.match(b, /data-stars="false" data-forks="false"/);
  assert.equal(count(b, /data-github-badge-fact="/g), 1);
  assert.match(b, /data-github-badge-fact="release"/);
});

test('inline shortcode with release="no" omits the release fact', () => {
  const html = read('dev', 'badges/shortcodes/index.html');
  assert.match(html, /<p>Inline <a class="github-badge/);
  const b = badges(html)[2];
  assert.match(b, /data-release="false"/);
  assert.doesNotMatch(b, /data-github-badge-fact="release"/);
});

test('invalid parameters fall back to defaults with warnings; invalid repo is not rendered', () => {
  const html = read('dev', 'badges/shortcodes/index.html');
  const all = badges(html);
  assert.equal(all.length, 4, 'the "not a repo" badge is skipped');
  const b = all[3];
  assert.doesNotMatch(b, /style=/);
  assert.doesNotMatch(b, /url\(x\)/);
  assert.match(b, /target="_blank"/);
  assert.match(b, /data-cache-duration="60"/, 'cache duration is clamped to 60 s');
  const log = builds.dev.log;
  assert.match(log, /ignoring invalid color "red;background:url\(x\)" in badge parameter \(page badges\/shortcodes\.md\)/);
  assert.match(log, /ignoring invalid height "tall"/);
  assert.match(log, /ignoring invalid target "_evil"/);
  assert.match(log, /invalid repository "not a repo"/);
});

test('multiple badges on one page share a single stylesheet and script, without IDs', () => {
  const html = read('dev', 'badges/shortcodes/index.html');
  assert.equal(cssLinks(html).length, 1);
  assert.equal(scripts(html).length, 1);
  assert.match(scripts(html)[0], /github-badge/);
  assert.match(html, /<script src="[^"]*github-badge[^"]*"[^>]* defer><\/script>/);
  for (const b of badges(html)) assert.doesNotMatch(b, /\sid=/);
});

test('front matter (single and list) renders through the front-matter partial', () => {
  const html = read('dev', 'badges/front-matter/index.html');
  const all = badges(html);
  assert.equal(all.length, 3);
  assert.match(all[0], /data-repo="opengisch\/georama"/);
  assert.match(all[0], /--github-badge-background:#809c40/, 'explicit value is emitted even if equal to default');
  assert.match(all[1], /data-repo="opengisch\/QField"[\s\S]*/);
  assert.match(all[1], /--github-badge-background:#333333/);
  assert.match(all[2], /data-forks="false"/);
  assert.match(html, /<div class="github-badges">/);
  assert.equal(cssLinks(html).length, 1);
  assert.equal(scripts(html).length, 1);
});

test('partial usage in a template loads assets once', () => {
  const html = read('dev', 'badges/template/index.html');
  assert.equal(badges(html).length, 2);
  assert.equal(cssLinks(html).length, 1);
  assert.equal(scripts(html).length, 1);
});

test('pages without badges load no badge assets', () => {
  for (const p of ['badges/none/index.html']) {
    const html = read('dev', p);
    assert.equal(cssLinks(html).length, 0, p);
    assert.equal(scripts(html).length, 0, p);
  }
});

test('without JavaScript the badge is a working static link and shows no zero values', () => {
  for (const b of badges(read('dev', 'badges/shortcodes/index.html'))) {
    assert.match(b, /<a class="github-badge[^>]* href="https:\/\/github\.com\/[^"]+"/);
    assert.match(b, /data-github-badge-name>opengisch\/[^<]+<\/span>/);
    assert.match(b, /data-github-badge-facts hidden>/);
    assert.equal(count(b, /<span data-github-badge-value><\/span>/g), count(b, /data-github-badge-fact="/g), 'values start empty');
    assert.doesNotMatch(b, />0</);
  }
});

test('accessibility: decorative icons hidden, statistics labelled', () => {
  const [b] = badges(read('dev', 'badges/shortcodes/index.html'));
  assert.equal(count(b, /<svg /g), count(b, /<svg [^>]*aria-hidden="true" focusable="false"/g));
  assert.match(b, /latest release: /);
  assert.match(b, /stars: /);
  assert.match(b, /forks: /);
});

test('global params.githubBadge defaults apply and are overridden by parameters', () => {
  const html = read('global', 'badges/shortcodes/index.html');
  const [positional, named] = badges(html);
  assert.match(positional, /github-badge--icon-github/);
  assert.match(positional, /--github-badge-background:#123456/);
  assert.match(positional, /--github-badge-color:#fefefe/);
  assert.match(positional, /--github-badge-border-radius:4px/);
  assert.match(positional, /data-stars="false"/);
  assert.match(positional, /data-cache-duration="7200"/);
  assert.doesNotMatch(positional, /target=/, '_self needs no target attribute');
  assert.doesNotMatch(positional, /noopener/);
  assert.match(named, /--github-badge-background:#333333/, 'parameter beats global config');
  // loadAssets: always
  const none = read('global', 'badges/none/index.html');
  assert.equal(cssLinks(none).length, 1);
  assert.equal(scripts(none).length, 1);
});

test('production build minifies, fingerprints and adds SRI', () => {
  const html = read('prod', 'badges/shortcodes/index.html');
  const [css] = cssLinks(html);
  const [js] = scripts(html);
  assert.match(css, /\/css\/github-badge\.min\.[0-9a-f]{64,}\.css/);
  assert.match(js, /\/js\/github-badge\.min\.[0-9a-f]{64,}\.js/);
  assert.match(html, /github-badge\.min\.[0-9a-f]+\.css"? integrity="?sha512-/);
  const file = css.replace(/^.*href=["]?/, '');
  const cssText = readFileSync(join(builds.prod.dest, file), 'utf8');
  assert.ok(!cssText.includes('\n  '), 'CSS is minified');
});

test('deployment under a subdirectory prefixes asset URLs', () => {
  const html = read('sub', 'badges/shortcodes/index.html');
  assert.match(cssLinks(html)[0], /href="?\/sub\/dir\/css\/github-badge/);
  assert.match(scripts(html)[0], /src="?\/sub\/dir\/js\/github-badge/);
  assert.ok(existsSync(join(builds.sub.dest, 'css')));
});

test('stylesheet: light defaults, dark mode via data-bs-theme, scoped rules', () => {
  const css = readFileSync(join(ROOT, 'assets/css/github-badge.css'), 'utf8');
  assert.match(css, /--github-badge-background: #809c40/);
  assert.match(css, /--github-badge-color: #ffffff/);
  assert.match(css, /\[data-bs-theme="dark"\]/);
  for (const v of ['font-size', 'stats-font-size', 'height', 'icon-size', 'border-radius', 'padding', 'gap']) {
    assert.match(css, new RegExp(`--github-badge-${v}:`));
  }
  // Every selector is scoped to the badge (or the dark-mode/keyframes wrappers).
  const selectors = css.replace(/\/\*[\s\S]*?\*\//g, '').match(/^[^{}@\s][^{}]*(?=\{)/gm) || [];
  for (const s of selectors) {
    if (/^(from|to)\b/.test(s.trim())) continue;
    for (const part of s.split(',')) assert.match(part, /github-badge/, `unscoped selector: ${part.trim()}`);
  }
});

test('the real site builds; the home page navbar shows the georama badge', () => {
  const html = read('site', 'index.html');
  const nav = html.slice(html.indexOf('<nav'), html.indexOf('</nav>'));
  const inNav = badges(nav);
  assert.equal(inNav.length, 1);
  assert.match(inNav[0], /data-repo="?opengisch\/georama/);
  // The right-hand block (order-lg-2) is displayed after the menu; the badge is its first item.
  const block = nav.indexOf('order-lg-2');
  assert.ok(block > -1 && block < nav.indexOf('navbar-github-badge'), 'badge sits in the block after the menu');
  assert.ok(nav.indexOf('data-github-badge') < nav.indexOf('themeToggle'), 'badge precedes the theme switcher');
  assert.equal(cssLinks(html).length, 1);
  assert.equal(scripts(html).length, 1);
  assert.match(html, /section-hero/);
  assert.ok(!readdirSync(builds.site.dest).includes('badges'), 'fixtures are not part of the real site');
});
