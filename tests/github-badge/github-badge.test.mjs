// Unit tests for assets/js/github-badge.js with mocked GitHub API responses.
// Run: npm test   (or: node --test tests/)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { badge, page, factValue, nameOf, memoryStorage } from './fake-dom.mjs';

const SRC = readFileSync(fileURLToPath(new URL('../../assets/js/github-badge.js', import.meta.url)), 'utf8');
const API = 'https://api.github.com/repos/';

// Evaluates the script against a fake window (no document => no auto-init).
function loadScript(win = {}) {
  new Function('window', SRC)(win);
  return win.GithubBadge;
}

function response(status, body, headers = {}) {
  const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v)]));
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (n) => h[n.toLowerCase()] ?? null },
    json: async () => {
      if (body === INVALID_JSON) throw new SyntaxError('Unexpected token');
      return body;
    }
  };
}
const INVALID_JSON = Symbol('invalid');

// routes: { 'owner/repo': resp, 'owner/repo/releases/latest': resp, ... }
// A route value may be a response, a function returning one, or a promise.
function mockFetch(routes) {
  const calls = [];
  const fn = async (url, init) => {
    assert.ok(url.startsWith(API), 'only the GitHub API is called');
    assert.equal(init.credentials, 'omit');
    assert.equal(init.headers.Authorization, undefined, 'no credentials are sent');
    const path = url.slice(API.length);
    calls.push(path);
    let r = routes[path];
    if (typeof r === 'function') r = r(init);
    r = await r;
    if (r === undefined) return response(404, { message: 'Not Found' });
    if (r instanceof Error) throw r;
    return r;
  };
  fn.calls = calls;
  return fn;
}

const META = {
  full_name: 'opengisch/georama',
  html_url: 'https://github.com/opengisch/georama',
  stargazers_count: 1234,
  forks_count: 2,
  archived: false
};

function setup({ routes, storage = memoryStorage(), now = () => 1_000_000_000, timeout } = {}) {
  const fetch = mockFetch(routes);
  const lib = loadScript();
  const inst = lib.create({ fetch, storage, now: () => now(), timeout });
  return { fetch, storage, inst };
}

test('successful request fills in name, release, stars and forks', async () => {
  const { inst, fetch, storage } = setup({
    routes: {
      'opengisch/georama': response(200, { ...META, full_name: 'OpenGISch/Georama' }),
      'opengisch/georama/releases/latest': response(200, { tag_name: 'v26.3' })
    }
  });
  const b = badge('opengisch/georama');
  await inst.init(page(b));
  assert.equal(nameOf(b), 'OpenGISch/Georama');
  assert.equal(factValue(b, 'release'), 'v26.3');
  assert.equal(factValue(b, 'stars'), '1.2k');
  assert.equal(factValue(b, 'forks'), '2');
  assert.equal(b.querySelector('[data-github-badge-facts]').hidden, false);
  assert.equal(b.getAttribute('data-github-badge-state'), 'loaded');
  assert.deepEqual(fetch.calls.sort(), ['opengisch/georama', 'opengisch/georama/releases/latest']);
  assert.ok(storage.getItem('github-badge:v1:repo:opengisch/georama'));
});

test('independent endpoints are requested concurrently', async () => {
  let releaseStarted = false;
  let resolveMeta;
  const { inst } = setup({
    routes: {
      'opengisch/georama': new Promise((r) => (resolveMeta = r)),
      'opengisch/georama/releases/latest': () => {
        releaseStarted = true;
        return response(200, { tag_name: 'v1' });
      }
    }
  });
  const done = inst.init(page(badge('opengisch/georama')));
  await new Promise((r) => setTimeout(r, 5));
  assert.ok(releaseStarted, 'release request starts while metadata is pending');
  resolveMeta(response(200, META));
  await done;
});

test('falls back to the first tag when there is no release', async () => {
  const { inst, fetch } = setup({
    routes: {
      'opengisch/georama': response(200, META),
      'opengisch/georama/tags?per_page=1': response(200, [{ name: 'v0.9' }])
    }
  });
  const b = badge('opengisch/georama');
  await inst.init(page(b));
  assert.equal(factValue(b, 'release'), 'v0.9');
  assert.ok(fetch.calls.includes('opengisch/georama/tags?per_page=1'));
});

test('fallbackToTags=false skips the tags request and hides the release', async () => {
  const { inst, fetch } = setup({
    routes: {
      'opengisch/georama': response(200, META),
      'opengisch/georama/tags?per_page=1': response(200, [{ name: 'v0.9' }])
    }
  });
  const b = badge('opengisch/georama', { fallbackToTags: false });
  await inst.init(page(b));
  assert.equal(factValue(b, 'release'), null);
  assert.equal(factValue(b, 'stars'), '1.2k');
  assert.ok(!fetch.calls.includes('opengisch/georama/tags?per_page=1'));
});

test('release section is hidden when neither release nor tag exists', async () => {
  const { inst } = setup({
    routes: {
      'opengisch/georama': response(200, META),
      'opengisch/georama/tags?per_page=1': response(200, [])
    }
  });
  const b = badge('opengisch/georama');
  await inst.init(page(b));
  assert.equal(factValue(b, 'release'), null);
  assert.equal(factValue(b, 'forks'), '2');
});

test('release disabled: no release request is made', async () => {
  const { inst, fetch } = setup({ routes: { 'opengisch/georama': response(200, META) } });
  const b = badge('opengisch/georama', { release: false });
  await inst.init(page(b));
  assert.deepEqual(fetch.calls, ['opengisch/georama']);
  assert.equal(factValue(b, 'stars'), '1.2k');
});

test('fresh cache is used without any request', async () => {
  const routes = {
    'opengisch/georama': response(200, META),
    'opengisch/georama/releases/latest': response(200, { tag_name: 'v1' })
  };
  let t = 1_000_000_000;
  const { inst, storage } = setup({ routes, now: () => t });
  await inst.init(page(badge('opengisch/georama')));

  t += 3599 * 1000;
  const fetch2 = mockFetch(routes);
  const inst2 = loadScript().create({ fetch: fetch2, storage, now: () => t });
  const b = badge('opengisch/georama');
  await inst2.init(page(b));
  assert.equal(fetch2.calls.length, 0);
  assert.equal(factValue(b, 'release'), 'v1');
});

test('expired cache is shown immediately and refreshed asynchronously', async () => {
  let t = 1_000_000_000;
  const storage = memoryStorage();
  {
    const { inst } = setup({
      storage,
      now: () => t,
      routes: {
        'opengisch/georama': response(200, META),
        'opengisch/georama/releases/latest': response(200, { tag_name: 'v1' })
      }
    });
    await inst.init(page(badge('opengisch/georama')));
  }
  t += 3601 * 1000;
  let release;
  const fetch = mockFetch({
    'opengisch/georama': response(200, { ...META, stargazers_count: 5 }),
    'opengisch/georama/releases/latest': new Promise((r) => (release = r))
  });
  const inst = loadScript().create({ fetch, storage, now: () => t });
  const b = badge('opengisch/georama');
  const done = inst.init(page(b));
  // Stale values are rendered synchronously, before the network answers.
  assert.equal(factValue(b, 'release'), 'v1');
  assert.equal(factValue(b, 'stars'), '1.2k');
  release(response(200, { tag_name: 'v2' }));
  await done;
  assert.equal(factValue(b, 'release'), 'v2');
  assert.equal(factValue(b, 'stars'), '5');
});

test('per-badge cacheDuration controls expiry', async () => {
  let t = 1_000_000_000;
  const routes = { 'opengisch/georama': response(200, META) };
  const { inst, storage } = setup({ routes, now: () => t });
  await inst.init(page(badge('opengisch/georama', { release: false })));
  t += 120 * 1000;
  const fetch2 = mockFetch(routes);
  await loadScript().create({ fetch: fetch2, storage, now: () => t })
    .init(page(badge('opengisch/georama', { release: false, cacheDuration: 60 })));
  assert.equal(fetch2.calls.length, 1);
});

test('simultaneous requests for one repository are deduplicated and shared', async () => {
  const { inst, fetch } = setup({
    routes: {
      'opengisch/georama': async () => {
        await new Promise((r) => setTimeout(r, 10));
        return response(200, META);
      },
      'opengisch/georama/releases/latest': response(200, { tag_name: 'v1' }),
      'opengisch/qfield': response(200, { ...META, full_name: 'opengisch/QField', html_url: 'https://github.com/opengisch/QField' }),
      'opengisch/qfield/releases/latest': response(200, { tag_name: 'v3' })
    }
  });
  const a = badge('opengisch/georama');
  const b = badge('opengisch/georama', { stars: false });
  const c = badge('opengisch/QField'.toLowerCase());
  const d = badge('opengisch/georama');
  // Two separate init() calls racing each other, plus several badges per call.
  await Promise.all([inst.init(page(a, b, c)), inst.init(page(d))]);
  assert.equal(fetch.calls.filter((p) => p === 'opengisch/georama').length, 1);
  assert.equal(fetch.calls.filter((p) => p === 'opengisch/georama/releases/latest').length, 1);
  for (const x of [a, b, d]) assert.equal(factValue(x, 'release'), 'v1');
  assert.equal(factValue(b, 'stars'), null, 'disabled fact stays absent');
  assert.equal(factValue(c, 'release'), 'v3');
});

test('stale cache is preserved when the API fails, without aggressive retries', async () => {
  let t = 1_000_000_000;
  const storage = memoryStorage();
  await setup({
    storage,
    now: () => t,
    routes: {
      'opengisch/georama': response(200, META),
      'opengisch/georama/releases/latest': response(200, { tag_name: 'v1' })
    }
  }).inst.init(page(badge('opengisch/georama')));

  t += 7200 * 1000;
  const failing = mockFetch({
    'opengisch/georama': () => new TypeError('Failed to fetch'),
    'opengisch/georama/releases/latest': response(500, {})
  });
  const b = badge('opengisch/georama');
  await loadScript().create({ fetch: failing, storage, now: () => t }).init(page(b));
  assert.equal(factValue(b, 'release'), 'v1');
  assert.equal(factValue(b, 'stars'), '1.2k');

  // Within the back-off window no new request is made; stale data still shows.
  t += 60 * 1000;
  const again = mockFetch({});
  const b2 = badge('opengisch/georama');
  await loadScript().create({ fetch: again, storage, now: () => t }).init(page(b2));
  assert.equal(again.calls.length, 0);
  assert.equal(factValue(b2, 'release'), 'v1');
});

test('rate limit: unknown statistics are not shown as zero and requests pause until reset', async () => {
  const t = 1_000_000_000;
  const reset = Math.floor(t / 1000) + 600;
  const limited = response(403, { message: 'API rate limit exceeded' }, {
    'x-ratelimit-remaining': '0',
    'x-ratelimit-reset': String(reset)
  });
  const { inst, fetch, storage } = setup({
    now: () => t,
    routes: { 'opengisch/georama': limited, 'opengisch/georama/releases/latest': limited }
  });
  const b = badge('opengisch/georama');
  await inst.init(page(b));
  for (const f of ['release', 'stars', 'forks']) assert.equal(factValue(b, f), null);
  assert.equal(b.querySelector('[data-github-badge-facts]').hidden, true);
  assert.equal(nameOf(b), 'opengisch/georama', 'static name stays');
  assert.equal(b.getAttribute('href'), 'https://github.com/opengisch/georama');
  assert.equal(b.getAttribute('data-github-badge-state'), 'unavailable');
  const n = fetch.calls.length;

  // Another repository while rate limited: no request at all.
  const other = mockFetch({ 'opengisch/qfield': response(200, META) });
  await loadScript().create({ fetch: other, storage, now: () => t + 1000 }).init(page(badge('opengisch/qfield')));
  assert.equal(other.calls.length, 0);
  assert.equal(fetch.calls.length, n);
});

test('HTTP 429 with Retry-After is treated as rate limiting', async () => {
  const t = 1_000_000_000;
  const { inst, storage } = setup({
    now: () => t,
    routes: { 'opengisch/georama': response(429, {}, { 'retry-after': '30' }) }
  });
  await inst.init(page(badge('opengisch/georama', { release: false })));
  assert.equal(JSON.parse(storage.getItem('github-badge:v1:rate-limit')), t + 30_000);
});

test('deleted or private repository: badge stays a static link, miss is cached', async () => {
  const { inst, fetch, storage } = setup({ routes: {} });
  const b = badge('opengisch/gone');
  await inst.init(page(b));
  assert.equal(b.getAttribute('data-github-badge-state'), 'missing');
  assert.equal(b.querySelector('[data-github-badge-facts]').hidden, true);
  assert.equal(nameOf(b), 'opengisch/gone');
  const n = fetch.calls.length;
  await loadScript().create({ fetch, storage, now: () => 1_000_000_000 }).init(page(badge('opengisch/gone')));
  assert.equal(fetch.calls.length, n, 'cached miss prevents re-requests');
});

test('invalid API responses are ignored field by field', async () => {
  const { inst } = setup({
    routes: {
      'opengisch/georama': response(200, {
        full_name: '<img src=x onerror=alert(1)>',
        html_url: 'javascript:alert(1)',
        stargazers_count: 'lots',
        forks_count: -1
      }),
      'opengisch/georama/releases/latest': response(200, INVALID_JSON)
    }
  });
  const b = badge('opengisch/georama');
  await inst.init(page(b));
  assert.equal(nameOf(b), 'opengisch/georama');
  assert.equal(b.getAttribute('href'), 'https://github.com/opengisch/georama');
  for (const f of ['release', 'stars', 'forks']) assert.equal(factValue(b, f), null);
});

test('API text is inserted as text, never as HTML', async () => {
  const { inst } = setup({
    routes: {
      'opengisch/georama': response(200, META),
      'opengisch/georama/releases/latest': response(200, { tag_name: '<b>v1</b>' })
    }
  });
  const b = badge('opengisch/georama');
  await inst.init(page(b)); // the fake DOM throws on any innerHTML access
  assert.equal(factValue(b, 'release'), '<b>v1</b>');
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(SRC));
});

test('request timeout leaves the badge as a static link', async () => {
  const { inst } = setup({
    timeout: 20,
    routes: {
      'opengisch/georama': (init) =>
        new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))))
    }
  });
  const b = badge('opengisch/georama', { release: false });
  await inst.init(page(b));
  assert.equal(b.getAttribute('data-github-badge-state'), 'unavailable');
  assert.equal(factValue(b, 'stars'), null);
});

test('falls back to in-memory cache when localStorage is unavailable', async () => {
  const win = {};
  Object.defineProperty(win, 'localStorage', {
    get() { throw new DOMException('denied', 'SecurityError'); }
  });
  const lib = loadScript(win);
  const fetch = mockFetch({ 'opengisch/georama': response(200, META) });
  const inst = lib.create({ window: win, fetch, now: () => 1 });
  await inst.init(page(badge('opengisch/georama', { release: false })));
  await inst.init(page(badge('opengisch/georama', { release: false })));
  assert.equal(fetch.calls.length, 1, 'second init is served from memory');
});

test('invalid repository attributes are never requested', async () => {
  const { inst, fetch } = setup({ routes: {} });
  const b = badge('../../evil');
  await inst.init(page(b));
  assert.equal(fetch.calls.length, 0);
  assert.equal(b.getAttribute('data-github-badge-state'), 'invalid');
});

test('archived repositories are flagged', async () => {
  const { inst } = setup({ routes: { 'opengisch/georama': response(200, { ...META, archived: true }) } });
  const b = badge('opengisch/georama', { release: false });
  await inst.init(page(b));
  assert.ok(b.classList.contains('github-badge--archived'));
});

test('number formatting', () => {
  const inst = loadScript().create({ fetch: async () => {}, storage: memoryStorage() });
  assert.equal(inst.formatCount(0), '0');
  assert.equal(inst.formatCount(999), '999');
  assert.equal(inst.formatCount(1000), '1k');
  assert.equal(inst.formatCount(1250), '1.3k');
  assert.equal(inst.formatCount(123456), '123k');
  assert.equal(inst.formatCount(2_500_000), '2.5M');
});

test('auto-initialises on DOMContentLoaded and can be disabled', () => {
  let listener;
  const doc = { readyState: 'loading', addEventListener: (ev, fn) => { if (ev === 'DOMContentLoaded') listener = fn; }, querySelectorAll: () => [] };
  loadScript({ document: doc });
  assert.equal(typeof listener, 'function');

  listener = undefined;
  loadScript({ document: doc, GithubBadgeConfig: { autoInit: false } });
  assert.equal(listener, undefined);
});
