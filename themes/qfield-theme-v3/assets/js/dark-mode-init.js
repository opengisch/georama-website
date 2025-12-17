(function () {
  try {
    const root = document.documentElement
    const defaultTheme = root.getAttribute('data-theme-default') || 'light'
    const stored = localStorage.getItem('theme')
    const prefersDark =
      window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches

    let next = stored
    if (next !== 'light' && next !== 'dark') {
      if (defaultTheme === 'auto') {
        next = prefersDark ? 'dark' : 'light'
      } else {
        next = defaultTheme === 'dark' ? 'dark' : 'light'
      }
    }

    root.setAttribute('data-bs-theme', next)
  } catch (e) {
    // ignore
  }
})()

