// ===== 공통 네비게이션 컴포넌트 =====
// 각 게임 페이지에서 <script src="../../public/nav.js"> 로 인클루드

document.addEventListener('DOMContentLoaded', function () {
  // 스타일 주입
  const style = document.createElement('style');
  style.textContent = `
    body {
      max-width: 1280px;
      margin-left: auto;
      margin-right: auto;
      width: 100%;
    }
    .site-nav {
      align-self: flex-start;
      margin-bottom: 24px;
    }
    .back-btn {
      color: #6c63ff;
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      background: rgba(108, 99, 255, 0.12);
      border: 1px solid rgba(108, 99, 255, 0.4);
      border-radius: 999px;
      transition: background 0.2s, border-color 0.2s;
      white-space: nowrap;
    }
    .back-btn:hover {
      background: rgba(108, 99, 255, 0.22);
      border-color: #6c63ff;
    }
  `;
  document.head.appendChild(style);

  // nav 엘리먼트 주입
  const nav = document.createElement('nav');
  nav.className = 'site-nav';
  nav.innerHTML = '<a class="back-btn" href="../../public/index.html">🏠 홈으로</a>';
  document.body.insertBefore(nav, document.body.firstChild);
});
