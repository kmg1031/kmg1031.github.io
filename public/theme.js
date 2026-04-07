// ===== 테마 (다크/라이트) 관리 =====
(function() {
  const KEY = 'hs_theme';
  const saved = localStorage.getItem(KEY) || 'dark';
  if (saved === 'light') document.documentElement.setAttribute('data-theme', 'light');

  function createToggle() {
    const btn = document.createElement('button');
    btn.className = 'theme-toggle';
    btn.setAttribute('aria-label', '테마 전환');
    btn.textContent = saved === 'light' ? '🌙' : '☀️';

    btn.addEventListener('click', () => {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      if (isLight) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem(KEY, 'dark');
        btn.textContent = '☀️';
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem(KEY, 'light');
        btn.textContent = '🌙';
      }
    });

    document.body.appendChild(btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createToggle);
  } else {
    createToggle();
  }
})();
