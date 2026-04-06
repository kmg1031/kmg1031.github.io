// ===== Minesweeper =====

const DIFFICULTIES = {
  beginner:     { rows: 9,  cols: 9,  mines: 10 },
  intermediate: { rows: 16, cols: 16, mines: 40 },
  expert:       { rows: 16, cols: 30, mines: 99 },
};

const STORAGE_KEYS = {
  beginner:     'hs_minesweeper_best_beginner',
  intermediate: 'hs_minesweeper_best_intermediate',
  expert:       'hs_minesweeper_best_expert',
};

let rows, cols, mineCount;
let board = [];      // { mine, open, flagged, count }
let diffKey = 'beginner';
let gameState = 'idle'; // idle | playing | won | lost
let timerInterval, startTime, elapsed;
let firstClick = true;

// ===== DOM =====
const boardEl   = document.getElementById('board');
const timerEl   = document.getElementById('timer');
const flagsEl   = document.getElementById('flags');
const overlayEl = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg   = document.getElementById('overlay-msg');
const bestRow      = document.getElementById('best-row');

// ===== Init =====
function init(key = diffKey) {
  diffKey = key;
  const { rows: r, cols: c, mines: m } = DIFFICULTIES[key];
  rows = r; cols = c; mineCount = m;

  board = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ mine: false, open: false, flagged: false, count: 0 }))
  );

  firstClick = true;
  gameState = 'idle';
  elapsed = 0;
  clearInterval(timerInterval);

  timerEl.textContent = '0';
  flagsEl.textContent = mineCount;
  hideOverlay();
  updateBestDisplay();
  renderBoard();

  // Update active diff button
  document.querySelectorAll('.diff-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.diff === key);
  });
}

// ===== Place mines (after first click) =====
function placeMines(safeR, safeC) {
  let placed = 0;
  while (placed < mineCount) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    if (board[r][c].mine) continue;
    if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
    board[r][c].mine = true;
    placed++;
  }
  // Calc counts
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (!board[r][c].mine)
        board[r][c].count = neighbors(r, c).filter(([nr, nc]) => board[nr][nc].mine).length;
}

// ===== Neighbors =====
function neighbors(r, c) {
  const res = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) res.push([nr, nc]);
    }
  return res;
}

// ===== Open cell =====
function openCell(r, c) {
  if (gameState === 'won' || gameState === 'lost') return;
  const cell = board[r][c];
  if (cell.open || cell.flagged) return;

  if (firstClick) {
    firstClick = false;
    gameState = 'playing';
    placeMines(r, c);
    startTimer();
  }

  cell.open = true;
  updateCell(r, c);

  if (cell.mine) {
    gameState = 'lost';
    revealMines(r, c);
    stopTimer();
    showOverlay('💥 Game Over', '지뢰를 밟았습니다!');
    return;
  }

  if (cell.count === 0) {
    neighbors(r, c).forEach(([nr, nc]) => {
      if (!board[nr][nc].open && !board[nr][nc].flagged) openCell(nr, nc);
    });
  }

  checkWin();
}

// ===== Chord (open neighbors if flags match) =====
function chord(r, c) {
  const cell = board[r][c];
  if (!cell.open || !cell.count) return;
  const ns = neighbors(r, c);
  const flagCount = ns.filter(([nr, nc]) => board[nr][nc].flagged).length;
  if (flagCount === cell.count)
    ns.forEach(([nr, nc]) => { if (!board[nr][nc].flagged) openCell(nr, nc); });
}

// ===== Flag =====
function toggleFlag(r, c) {
  if (gameState === 'won' || gameState === 'lost') return;
  const cell = board[r][c];
  if (cell.open) return;
  cell.flagged = !cell.flagged;
  updateCell(r, c);
  flagsEl.textContent = mineCount - board.flat().filter(c => c.flagged).length;
}

// ===== Reveal mines on loss =====
function revealMines(hitR, hitC) {
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const cell = board[r][c];
      if (cell.mine) {
        const el = getEl(r, c);
        el.classList.remove('flagged');
        if (r === hitR && c === hitC) {
          el.classList.add('open', 'exploded');
          el.textContent = '💣';
        } else if (!cell.flagged) {
          el.classList.add('open');
          el.textContent = '💣';
        }
      }
    }
}

// ===== Check win =====
function checkWin() {
  const unopened = board.flat().filter(c => !c.open).length;
  if (unopened === mineCount) {
    gameState = 'won';
    stopTimer();
    const t = elapsed;
    const prevBest = Number(localStorage.getItem(STORAGE_KEYS[diffKey])) || Infinity;
    if (t < prevBest) localStorage.setItem(STORAGE_KEYS[diffKey], t);
    updateBestDisplay();
    showOverlay('🎉 You Win!', `클리어 시간: ${t}초`);
  }
}

// ===== Timer =====
function startTimer() {
  startTime = Date.now();
  timerInterval = setInterval(() => {
    elapsed = Math.floor((Date.now() - startTime) / 1000);
    timerEl.textContent = elapsed;
  }, 500);
}
function stopTimer() { clearInterval(timerInterval); }

// ===== Render =====
function renderBoard() {
  boardEl.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`;
  boardEl.innerHTML = '';
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const el = document.createElement('div');
      el.className = 'cell';
      el.dataset.r = r;
      el.dataset.c = c;
      el.addEventListener('click', () => {
        const cell = board[r][c];
        if (cell.open) chord(r, c);
        else openCell(r, c);
      });
      el.addEventListener('contextmenu', e => { e.preventDefault(); toggleFlag(r, c); });
      boardEl.appendChild(el);
    }
}

function getEl(r, c) { return boardEl.children[r * cols + c]; }

function updateCell(r, c) {
  const cell = board[r][c];
  const el = getEl(r, c);
  el.className = 'cell';
  if (cell.open) {
    el.classList.add('open');
    if (cell.mine) { el.textContent = '💣'; }
    else if (cell.count > 0) {
      el.textContent = cell.count;
      el.dataset.n = cell.count;
    } else {
      el.textContent = '';
    }
  } else if (cell.flagged) {
    el.classList.add('flagged');
    el.textContent = '🚩';
  } else {
    el.textContent = '';
  }
}

// ===== Best display =====
function updateBestDisplay() {
  const best = localStorage.getItem(STORAGE_KEYS[diffKey]);
  bestRow.innerHTML = best
    ? `${diffKey} 최고기록: <span>${best}초</span>`
    : `${diffKey} 최고기록: <span>없음</span>`;
}

// ===== Overlay =====
function showOverlay(title, msg) {
  overlayTitle.textContent = title;
  overlayMsg.textContent = msg;
  overlayEl.classList.add('show');
}
function hideOverlay() { overlayEl.classList.remove('show'); }

// ===== Buttons =====
document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => init(btn.dataset.diff));
});
document.getElementById('btn-new').addEventListener('click', () => init(diffKey));
document.getElementById('overlay-retry').addEventListener('click', () => init(diffKey));

// ===== Start =====
init();
