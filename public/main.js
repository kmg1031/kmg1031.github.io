// ===== localStorage 점수 모듈 =====
const Score = {
  get(gameId) {
    return localStorage.getItem(`hs_${gameId}_best`);
  },
  set(gameId, value) {
    localStorage.setItem(`hs_${gameId}_best`, value);
  },
  clear(gameId) {
    localStorage.removeItem(`hs_${gameId}_best`);
  }
};

// ===== 게임 목록 =====
const GAMES = [
  { id: 'tetris',      name: 'Tetris',      icon: '🟦', path: '../games/tetris/index.html' },
  { id: 'minesweeper', name: 'Minesweeper', icon: '💣', path: '../games/minesweeper/index.html' },
  { id: '2048',        name: '2048',        icon: '🔢', path: '../games/2048/index.html' },
  { id: 'memory',      name: 'Memory',      icon: '🃏', path: '../games/memory/index.html' },
  { id: 'snake',       name: 'Snake',       icon: '🐍', path: '../games/snake/index.html' },
  { id: 'reaction',    name: 'Reaction',    icon: '⚡', path: '../games/reaction/index.html' },
  { id: 'typing',       name: 'Typing',       icon: '⌨️', path: '../games/typing/index.html' },
  { id: 'sudoku',       name: 'Sudoku',       icon: '🔢', path: '../games/sudoku/index.html' },
  { id: 'gomoku',       name: 'Gomoku',       icon: '⚫', path: '../games/gomoku/index.html' },
  { id: 'slide-puzzle', name: 'Slide Puzzle', icon: '🧩', path: '../games/slide-puzzle/index.html' },
  { id: 'hangman',      name: 'Hangman',      icon: '💀', path: '../games/hangman/index.html' },
  { id: 'breakout',     name: 'Breakout',     icon: '🧱', path: '../games/breakout/index.html' },
  { id: 'pong',         name: 'Pong',         icon: '🏓', path: '../games/pong/index.html' },
  { id: 'tictactoe',    name: 'Tic-Tac-Toe', icon: '❌', path: '../games/tictactoe/index.html' },
  { id: 'wordle',       name: 'Wordle',       icon: '🟩', path: '../games/wordle/index.html' },
  { id: 'flappy',       name: 'Flappy',       icon: '🐦', path: '../games/flappy/index.html' },
];

// ===== 도구 목록 =====
const TOOLS = [
  { id: 'timer',              name: '타이머',         icon: '⏱️', path: '../tools/timer/index.html' },
  { id: 'pomodoro',           name: '포모도로',       icon: '🍅', path: '../tools/pomodoro/index.html' },
  { id: 'notepad',            name: '메모장',         icon: '📝', path: '../tools/notepad/index.html' },
  { id: 'todo',               name: '할 일 목록',     icon: '✅', path: '../tools/todo/index.html' },
  { id: 'calculator',         name: '계산기',         icon: '🧮', path: '../tools/calculator/index.html' },
  { id: 'unit-converter',     name: '단위 변환기',    icon: '📐', path: '../tools/unit-converter/index.html' },
  { id: 'exchange-rate',      name: '환율 계산기',    icon: '💱', path: '../tools/exchange-rate/index.html' },
  { id: 'char-counter',       name: '글자 수 세기',   icon: '🔤', path: '../tools/char-counter/index.html' },
  { id: 'json-formatter',     name: 'JSON 포맷터',   icon: '📋', path: '../tools/json-formatter/index.html' },
  { id: 'password-generator', name: '비밀번호 생성',  icon: '🔐', path: '../tools/password-generator/index.html' },
  { id: 'random-picker',      name: '랜덤 뽑기',     icon: '🎲', path: '../tools/random-picker/index.html' },
  { id: 'color-picker',       name: '색상 피커',      icon: '🎨', path: '../tools/color-picker/index.html' },
  { id: 'qr-generator',       name: 'QR 생성기',     icon: '📱', path: '../tools/qr-generator/index.html' },
  { id: 'dday',               name: 'D-Day 계산기',  icon: '📅', path: '../tools/dday/index.html' },
  { id: 'base-converter',     name: '진법 변환기',    icon: '🔄', path: '../tools/base-converter/index.html' },
  { id: 'markdown',           name: '마크다운',       icon: '📄', path: '../tools/markdown/index.html' },
  { id: 'regex',              name: '정규식 테스터',   icon: '🔍', path: '../tools/regex/index.html' },
  { id: 'base64',             name: 'Base64',        icon: '🔓', path: '../tools/base64/index.html' },
  { id: 'world-clock',        name: '세계시간',       icon: '🌍', path: '../tools/world-clock/index.html' },
  { id: 'bmi',                name: 'BMI 계산기',    icon: '⚖️', path: '../tools/bmi/index.html' },
  { id: 'lorem',              name: '로렘 입숨',      icon: '📃', path: '../tools/lorem/index.html' },
  { id: 'text-diff',          name: '텍스트 비교',    icon: '🔀', path: '../tools/text-diff/index.html' },
  { id: 'hash',               name: '해시 생성기',    icon: '🔑', path: '../tools/hash/index.html' },
  { id: 'url-encoder',        name: 'URL 인코더',    icon: '🔗', path: '../tools/url-encoder/index.html' },
  { id: 'discount-calculator', name: '할인율 계산기',  icon: '💰', path: '../tools/discount-calculator/index.html' },
  { id: 'image-resizer',      name: '이미지 리사이저', icon: '🖼️', path: '../tools/image-resizer/index.html' },
  { id: 'age-calculator',     name: '나이 계산기',    icon: '🎂', path: '../tools/age-calculator/index.html' },
  { id: 'case-converter',     name: '케이스 변환기',   icon: '🔤', path: '../tools/case-converter/index.html' },
];

// ===== 카드 렌더링 =====
function renderCards(items, gridId) {
  const grid = document.getElementById(gridId);

  if (items.length === 0) {
    grid.innerHTML = '<p class="empty-msg">준비 중입니다.</p>';
    return;
  }

  items.forEach(item => {
    const card = document.createElement('a');
    card.className = 'game-card';
    card.href = item.path;
    card.innerHTML = `
      <div class="card-icon">${item.icon}</div>
      <div class="card-name">${item.name}</div>
    `;
    grid.appendChild(card);
  });
}

renderCards(GAMES, 'game-grid');
renderCards(TOOLS, 'tool-grid');

// ===== 탭 전환 =====
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});
