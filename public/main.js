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
];

// ===== 카드 렌더링 =====
function renderCards() {
  const grid = document.getElementById('game-grid');

  GAMES.forEach(game => {
    const card = document.createElement('a');
    card.className = 'game-card';
    card.href = game.path;
    card.innerHTML = `
      <div class="card-icon">${game.icon}</div>
      <div class="card-name">${game.name}</div>
    `;
    grid.appendChild(card);
  });
}

renderCards();
