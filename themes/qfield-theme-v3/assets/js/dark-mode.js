    (function() {
      const icon = document.getElementById('themeIcon');
      const btn  = document.getElementById('themeToggle');
      const defaultTheme = document.documentElement.getAttribute('data-theme-default') || 'light';

      function resolveInitial() {
        const stored = localStorage.getItem('theme');
        if (stored === 'light' || stored === 'dark') return stored;
        if (defaultTheme === 'auto') {
          return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return defaultTheme === 'dark' ? 'dark' : 'light';
      }

      function renderIcon() {
        const t = document.documentElement.getAttribute('data-bs-theme');
        if (!icon) return;
        icon.className = t === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
      }

      function setTheme(next) {
        const theme = next === 'dark' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-bs-theme', theme);
        localStorage.setItem('theme', theme);
        renderIcon();
      }

      const initial = resolveInitial();
      document.documentElement.setAttribute('data-bs-theme', initial);
      renderIcon();

      btn?.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-bs-theme') || 'light';
        setTheme(current === 'dark' ? 'light' : 'dark');
      });
    })();
