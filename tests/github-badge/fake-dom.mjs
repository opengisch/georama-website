// Minimal DOM stand-in for testing assets/js/github-badge.js without
// third-party dependencies. Supports exactly what the script uses:
// attribute selectors ([a] and [a="v"]), attributes, hidden, textContent,
// classList.

export class FakeElement {
  constructor(attrs = {}, children = []) {
    this.attrs = new Map(Object.entries(attrs));
    this.children = children;
    this._text = '';
    const self = this;
    this.classList = {
      add: (c) => {
        const set = new Set((self.getAttribute('class') || '').split(/\s+/).filter(Boolean));
        set.add(c);
        self.setAttribute('class', [...set].join(' '));
      },
      contains: (c) => (self.getAttribute('class') || '').split(/\s+/).includes(c)
    };
  }

  getAttribute(n) { return this.attrs.has(n) ? this.attrs.get(n) : null; }
  setAttribute(n, v) { this.attrs.set(n, String(v)); }
  hasAttribute(n) { return this.attrs.has(n); }
  removeAttribute(n) { this.attrs.delete(n); }

  get hidden() { return this.attrs.has('hidden'); }
  set hidden(v) { if (v) this.attrs.set('hidden', ''); else this.attrs.delete('hidden'); }

  get textContent() { return this.children.length ? this.children.map((c) => c.textContent).join('') : this._text; }
  set textContent(v) { this.children = []; this._text = String(v); }

  get innerHTML() { throw new Error('innerHTML must not be used'); }
  set innerHTML(v) { throw new Error('innerHTML must not be used'); }

  matches(sel) {
    const m = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(sel);
    if (!m) throw new Error('Unsupported selector: ' + sel);
    return this.attrs.has(m[1]) && (m[2] === undefined || this.attrs.get(m[1]) === m[2]);
  }

  querySelectorAll(sel) {
    const out = [];
    const walk = (el) => {
      for (const c of el.children) {
        if (c.matches(sel)) out.push(c);
        walk(c);
      }
    };
    walk(this);
    return out;
  }

  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}

const fact = (name) =>
  new FakeElement({ 'data-github-badge-fact': name, hidden: '' }, [
    new FakeElement({ class: 'github-badge__sr' }),
    new FakeElement({ 'data-github-badge-value': '' })
  ]);

// Mirrors the markup produced by layouts/_partials/github-badge.html.
export function badge(repo, opts = {}) {
  const o = { release: true, stars: true, forks: true, fallbackToTags: true, cacheDuration: 3600, ...opts };
  const facts = [];
  if (o.release) facts.push(fact('release'));
  if (o.stars) facts.push(fact('stars'));
  if (o.forks) facts.push(fact('forks'));
  const name = new FakeElement({ 'data-github-badge-name': '' });
  name.textContent = repo;
  return new FakeElement(
    {
      class: 'github-badge',
      href: 'https://github.com/' + repo,
      'data-github-badge': '',
      'data-repo': repo,
      'data-release': String(o.release),
      'data-stars': String(o.stars),
      'data-forks': String(o.forks),
      'data-fallback-to-tags': String(o.fallbackToTags),
      'data-cache-duration': String(o.cacheDuration)
    },
    [
      new FakeElement({ class: 'github-badge__icon' }),
      new FakeElement({ class: 'github-badge__body' }, [
        name,
        new FakeElement({ 'data-github-badge-facts': '', hidden: '' }, facts)
      ])
    ]
  );
}

export function page(...badges) {
  return new FakeElement({}, badges);
}

// Reads the rendered value of a fact, or null if it is hidden / absent.
export function factValue(b, name) {
  const el = b.querySelector(`[data-github-badge-fact="${name}"]`);
  if (!el || el.hidden) return null;
  return el.querySelector('[data-github-badge-value]').textContent;
}

export function nameOf(b) {
  return b.querySelector('[data-github-badge-name]').textContent;
}

export function memoryStorage() {
  const m = new Map();
  return {
    map: m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k)
  };
}
