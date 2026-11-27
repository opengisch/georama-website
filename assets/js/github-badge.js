/*
 * GitHub repository badge — client-side statistics loader.
 *
 * Finds every [data-github-badge] element, fetches repository statistics from
 * the public GitHub REST API (no credentials) and fills them in. Results are
 * cached per repository in localStorage (in-memory fallback), shared between
 * badges, and concurrent requests for one repository are deduplicated.
 *
 * Exposes window.GithubBadge = { create, init, instance } for tests and for
 * pages that add badges dynamically (call GithubBadge.init()).
 */
(function (root) {
  'use strict';

  var API = 'https://api.github.com/repos/';
  var PREFIX = 'github-badge:v1:';
  var RATE_LIMIT_KEY = PREFIX + 'rate-limit';
  var REPO_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;
  var DEFAULT_TTL = 3600;
  var MIN_TTL = 60;
  var FAILURE_BACKOFF = 300; // seconds before retrying a repository after a failed request
  var TIMEOUT = 8000; // ms per request

  function MemoryStorage() {
    var data = new Map();
    return {
      getItem: function (k) { return data.has(k) ? data.get(k) : null; },
      setItem: function (k, v) { data.set(k, String(v)); },
      removeItem: function (k) { data.delete(k); }
    };
  }

  function detectStorage(win) {
    try {
      var s = win && win.localStorage;
      if (!s) return null;
      var probe = PREFIX + 'probe';
      s.setItem(probe, '1');
      s.removeItem(probe);
      return s;
    } catch (e) {
      return null;
    }
  }

  function parseBool(value, fallback) {
    if (value === undefined || value === null || value === '') return fallback;
    return !/^(false|0|no|off)$/i.test(String(value));
  }

  function formatCount(n) {
    if (n < 1000) return String(n);
    var units = [[1e9, 'B'], [1e6, 'M'], [1e3, 'k']];
    for (var i = 0; i < units.length; i++) {
      if (n >= units[i][0]) {
        var v = n / units[i][0];
        var s = v >= 100 ? Math.round(v).toString() : (Math.round(v * 10) / 10).toString();
        return s + units[i][1];
      }
    }
    return String(n);
  }

  function isCount(v) {
    return typeof v === 'number' && isFinite(v) && v >= 0;
  }

  function isTagName(v) {
    return typeof v === 'string' && v.length > 0 && v.length <= 200;
  }

  function create(opts) {
    opts = opts || {};
    var win = opts.window || root;
    var doc = opts.document || (win && win.document);
    var fetchFn = opts.fetch || (win && win.fetch && win.fetch.bind(win));
    var storage = opts.storage || detectStorage(win) || MemoryStorage();
    var now = opts.now || function () { return Date.now(); };
    var timeout = opts.timeout || TIMEOUT;
    var inflight = new Map();

    function read(key) {
      try {
        var raw = storage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    }

    function write(key, value) {
      try {
        storage.setItem(key, JSON.stringify(value));
      } catch (e) {
        // Quota exceeded or storage disabled: ignore, data stays in the page.
      }
    }

    function cacheKey(repo) {
      return PREFIX + 'repo:' + repo.toLowerCase();
    }

    function readCache(repo) {
      var entry = read(cacheKey(repo));
      return entry && typeof entry.fetchedAt === 'number' ? entry : null;
    }

    function rateLimitedUntil() {
      var v = read(RATE_LIMIT_KEY);
      return typeof v === 'number' ? v : 0;
    }

    function RequestError(kind, status) {
      this.kind = kind;
      this.status = status;
    }

    function getHeader(res, name) {
      try {
        return res.headers && res.headers.get ? res.headers.get(name) : null;
      } catch (e) {
        return null;
      }
    }

    // Records a GitHub rate limit so no further requests are made until reset.
    function noteRateLimit(res) {
      var retryAfter = parseInt(getHeader(res, 'retry-after'), 10);
      var reset = parseInt(getHeader(res, 'x-ratelimit-reset'), 10);
      var until;
      if (retryAfter > 0) until = now() + retryAfter * 1000;
      else if (reset > 0) until = reset * 1000;
      else until = now() + 15 * 60 * 1000;
      write(RATE_LIMIT_KEY, until);
    }

    function getJson(path) {
      if (!fetchFn) return Promise.reject(new RequestError('unsupported'));
      var controller = typeof AbortController === 'function' ? new AbortController() : null;
      var timer = setTimeout(function () {
        if (controller) controller.abort();
      }, timeout);
      return Promise.resolve()
        .then(function () {
          return fetchFn(API + path, {
            headers: { Accept: 'application/vnd.github+json' },
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
            signal: controller ? controller.signal : undefined
          });
        })
        .then(
          function (res) {
            clearTimeout(timer);
            if (res.status === 403 || res.status === 429) {
              if (res.status === 429 || getHeader(res, 'x-ratelimit-remaining') === '0' || getHeader(res, 'retry-after')) {
                noteRateLimit(res);
                throw new RequestError('rate-limit', res.status);
              }
              throw new RequestError('http', res.status);
            }
            if (res.status === 404) throw new RequestError('not-found', 404);
            if (!res.ok) throw new RequestError('http', res.status);
            return res.json().catch(function () {
              throw new RequestError('invalid');
            });
          },
          function (err) {
            clearTimeout(timer);
            if (err instanceof RequestError) throw err;
            throw new RequestError(controller && controller.signal.aborted ? 'timeout' : 'network');
          }
        );
    }

    // Resolves the latest release tag; null when the repository has none.
    function fetchRelease(repo, fallbackToTags, previous) {
      return getJson(repo + '/releases/latest').then(
        function (data) {
          return { release: data && isTagName(data.tag_name) ? data.tag_name : null, tag: previous.tag };
        },
        function (err) {
          if (err.kind !== 'not-found') return { release: previous.release, tag: previous.tag, failed: true };
          if (!fallbackToTags) return { release: null, tag: previous.tag };
          return getJson(repo + '/tags?per_page=1').then(
            function (tags) {
              var first = Array.isArray(tags) && tags[0];
              return { release: null, tag: first && isTagName(first.name) ? first.name : null };
            },
            function (e) {
              return { release: null, tag: e.kind === 'not-found' ? null : previous.tag, failed: e.kind !== 'not-found' };
            }
          );
        }
      );
    }

    function fetchRepo(repo, needs, previous) {
      previous = previous || {};
      var metaP = getJson(repo);
      var relP = needs.release
        ? fetchRelease(repo, needs.fallbackToTags, previous)
        : Promise.resolve({ release: previous.release, tag: previous.tag });

      return Promise.all([
        metaP.then(function (d) { return { ok: true, data: d }; }, function (e) { return { ok: false, error: e }; }),
        relP
      ]).then(function (results) {
        var meta = results[0];
        var rel = results[1];
        var t = now();

        if (!meta.ok) {
          if (meta.error.kind === 'not-found') {
            // Deleted, renamed without redirect, or private: cache the miss.
            var missing = { fetchedAt: t, missing: true };
            write(cacheKey(repo), missing);
            return missing;
          }
          // Keep stale data (already displayed) and back off before retrying.
          var backoff = previous.fetchedAt ? Object.assign({}, previous) : { fetchedAt: 0 };
          backoff.retryAt = t + FAILURE_BACKOFF * 1000;
          write(cacheKey(repo), backoff);
          return null;
        }

        var d = meta.data || {};
        var entry = {
          fetchedAt: t,
          fullName: typeof d.full_name === 'string' && REPO_RE.test(d.full_name) ? d.full_name : previous.fullName,
          htmlUrl: typeof d.html_url === 'string' && d.html_url.indexOf('https://github.com/') === 0 ? d.html_url : previous.htmlUrl,
          stars: isCount(d.stargazers_count) ? d.stargazers_count : previous.stars,
          forks: isCount(d.forks_count) ? d.forks_count : previous.forks,
          archived: d.archived === true,
          release: rel.release,
          tag: rel.tag,
          tagsChecked: !!needs.fallbackToTags || !!previous.tagsChecked
        };
        if (rel.failed) entry.retryAt = t + FAILURE_BACKOFF * 1000;
        write(cacheKey(repo), entry);
        return entry;
      });
    }

    function isFresh(entry, needs, ttl) {
      if (!entry || !entry.fetchedAt) return false;
      if (now() - entry.fetchedAt >= ttl * 1000) return false;
      if (entry.missing) return true;
      if (needs.release && entry.release === undefined) return false;
      if (needs.release && needs.fallbackToTags && entry.release === null && !entry.tagsChecked) return false;
      return true;
    }

    // Returns { cached, refresh } — cached data for immediate display and a
    // promise that resolves with updated data (or null if nothing new).
    function load(repo, needs, ttl) {
      var cached = readCache(repo);
      var t = now();
      if (isFresh(cached, needs, ttl)) return { cached: cached, refresh: Promise.resolve(null) };
      if (cached && cached.retryAt && t < cached.retryAt) return { cached: cached, refresh: Promise.resolve(null) };
      if (t < rateLimitedUntil()) return { cached: cached, refresh: Promise.resolve(null) };

      var key = repo.toLowerCase();
      if (!inflight.has(key)) {
        var p = fetchRepo(repo, needs, cached)
          .catch(function () { return null; })
          .then(function (result) {
            inflight.delete(key);
            return result;
          });
        inflight.set(key, p);
      }
      return { cached: cached, refresh: inflight.get(key) };
    }

    function setFact(badge, name, value) {
      var el = badge.querySelector('[data-github-badge-fact="' + name + '"]');
      if (!el) return false;
      var valueEl = el.querySelector('[data-github-badge-value]');
      if (value === undefined || value === null || value === '' || !valueEl) {
        el.hidden = true;
        return false;
      }
      valueEl.textContent = value;
      el.hidden = false;
      return true;
    }

    function render(badge, entry) {
      if (!entry || entry.missing || !entry.fetchedAt) return;
      var nameEl = badge.querySelector('[data-github-badge-name]');
      if (nameEl && entry.fullName) nameEl.textContent = entry.fullName;
      if (entry.htmlUrl) badge.setAttribute('href', entry.htmlUrl);
      if (entry.archived) {
        badge.classList.add('github-badge--archived');
        badge.setAttribute('title', 'Archived repository');
      }

      // Fact elements exist only for enabled statistics; unknown values stay hidden.
      var wantTags = parseBool(badge.getAttribute('data-fallback-to-tags'), true);
      var shown = false;
      shown = setFact(badge, 'release', entry.release || (wantTags ? entry.tag : null)) || shown;
      shown = setFact(badge, 'stars', isCount(entry.stars) ? formatCount(entry.stars) : null) || shown;
      shown = setFact(badge, 'forks', isCount(entry.forks) ? formatCount(entry.forks) : null) || shown;
      var facts = badge.querySelector('[data-github-badge-facts]');
      if (facts) facts.hidden = !shown;
      badge.setAttribute('data-github-badge-state', 'loaded');
    }

    function init(scope) {
      scope = scope || doc;
      if (!scope || !scope.querySelectorAll) return Promise.resolve([]);
      var groups = new Map();
      var badges = scope.querySelectorAll('[data-github-badge]');
      Array.prototype.forEach.call(badges, function (badge) {
        if (badge.getAttribute('data-github-badge-state')) return;
        var repo = badge.getAttribute('data-repo') || '';
        if (!REPO_RE.test(repo)) {
          badge.setAttribute('data-github-badge-state', 'invalid');
          return;
        }
        badge.setAttribute('data-github-badge-state', 'pending');
        var key = repo.toLowerCase();
        var ttl = parseInt(badge.getAttribute('data-cache-duration'), 10);
        ttl = isFinite(ttl) ? Math.max(MIN_TTL, ttl) : DEFAULT_TTL;
        var g = groups.get(key) || { repo: repo, badges: [], ttl: Infinity, needs: { release: false, fallbackToTags: false } };
        g.badges.push(badge);
        g.ttl = Math.min(g.ttl, ttl);
        if (parseBool(badge.getAttribute('data-release'), true)) {
          g.needs.release = true;
          if (parseBool(badge.getAttribute('data-fallback-to-tags'), true)) g.needs.fallbackToTags = true;
        }
        groups.set(key, g);
      });

      var work = [];
      groups.forEach(function (g) {
        var res = load(g.repo, g.needs, g.ttl);
        g.badges.forEach(function (b) { render(b, res.cached); });
        work.push(
          res.refresh.then(function (entry) {
            g.badges.forEach(function (b) {
              if (entry) render(b, entry);
              if (b.getAttribute('data-github-badge-state') === 'pending') {
                b.setAttribute('data-github-badge-state', entry && entry.missing ? 'missing' : 'unavailable');
              }
            });
            return entry;
          })
        );
      });
      return Promise.all(work);
    }

    return {
      init: init,
      load: load,
      render: render,
      readCache: readCache,
      formatCount: formatCount,
      storage: storage
    };
  }

  var api = { create: create, instance: null };
  api.init = function (scope) {
    if (!api.instance) api.instance = create();
    return api.instance.init(scope);
  };
  if (root) root.GithubBadge = api;

  var doc = root && root.document;
  if (doc && !(root.GithubBadgeConfig && root.GithubBadgeConfig.autoInit === false)) {
    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', function () { api.init(); });
    } else {
      api.init();
    }
  }
})(typeof window !== 'undefined' ? window : this);
