// ===== 2048 Game =====

const STORAGE_KEY = 'hs_2048_best';
const SIZE = 4;

let grid = [];       // 4x4 숫자 배열
let score = 0;
let best = 0;
let gameOver = false;
let won = false;
let keepPlaying = false;

// ===== DOM =====
const boardEl   = document.getElementById('board');
const scoreEl   = document.getElementById('score');
const bestEl    = document.getElementById('best');
const overlayEl = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg   = document.getElementById('overlay-msg');

// ===== Init =====
function init() {
  grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  score = 0;
  gameOver = false;
  won = false;
  keepPlaying = false;

  best = Number(localStorage.getItem(STORAGE_KEY)) || 0;
  bestEl.textContent = best.toLocaleString();

  addTile();
  addTile();
  render();
  hideOverlay();
}

// ===== Add random tile =====
function addTile() {
  const empties = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (grid[r][c] === 0) empties.push([r, c]);
  if (!empties.length) return;
  const [r, c] = empties[Math.floor(Math.random() * empties.length)];
  grid[r][c] = Math.random() < 0.9 ? 2 : 4;
  return [r, c];
}

// ===== Render =====
const cells = [];

function buildBoard() {
  boardEl.innerHTML = '';
  for (let r = 0; r < SIZE; r++) {
    cells[r] = [];
    for (let c = 0; c < SIZE; c++) {
      const el = document.createElement('div');
      el.className = 'cell';
      boardEl.appendChild(el);
      cells[r][c] = el;
    }
  }
}

function render(newPos = null, mergedPos = []) {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const val = grid[r][c];
      const el = cells[r][c];
      el.textContent = val || '';
      el.dataset.val = val || '';
      el.className = 'cell';
      if (val && newPos && newPos[0] === r && newPos[1] === c) el.classList.add('new');
      if (mergedPos.some(([mr, mc]) => mr === r && mc === c)) el.classList.add('merged');
    }
  }

  scoreEl.textContent = score.toLocaleString();
  if (score > best) {
    best = score;
    localStorage.setItem(STORAGE_KEY, best);
    bestEl.textContent = best.toLocaleString();
  }
}

// ===== Slide one row/col left =====
function slideLine(line) {
  const merged = [];
  let nums = line.filter(v => v !== 0);
  for (let i = 0; i < nums.length - 1; i++) {
    if (nums[i] === nums[i + 1]) {
      nums[i] *= 2;
      score += nums[i];
      merged.push(i);
      nums.splice(i + 1, 1);
    }
  }
  while (nums.length < SIZE) nums.push(0);
  return { result: nums, merged };
}

// ===== Move =====
function move(dir) {
  if (gameOver) return;

  let moved = false;
  const mergedCells = [];

  // Rotate grid so we always slide "left"
  let g = rotateForDir(grid, dir);

  for (let r = 0; r < SIZE; r++) {
    const { result, merged } = slideLine(g[r]);
    merged.forEach(c => {
      const [origR, origC] = unrotateCoord(r, c, dir);
      mergedCells.push([origR, origC]);
    });
    if (result.some((v, i) => v !== g[r][i])) moved = true;
    g[r] = result;
  }

  if (!moved) return;

  grid = unrotateGrid(g, dir);

  const newPos = addTile();
  render(newPos, mergedCells);
  checkState();
}

// ===== Rotate helpers =====
function rotateForDir(g, dir) {
  // Make it so sliding left = the intended direction
  const clone = g.map(r => [...r]);
  if (dir === 'left')  return clone;
  if (dir === 'right') return clone.map(r => [...r].reverse());
  if (dir === 'up')    return transpose(clone);
  if (dir === 'down')  return transpose(clone).map(r => [...r].reverse());
}

function unrotateGrid(g, dir) {
  if (dir === 'left')  return g;
  if (dir === 'right') return g.map(r => [...r].reverse());
  if (dir === 'up')    return transpose(g);
  if (dir === 'down')  {
    const rev = g.map(r => [...r].reverse());
    return transpose(rev);
  }
}

function unrotateCoord(r, c, dir) {
  if (dir === 'left')  return [r, c];
  if (dir === 'right') return [r, SIZE - 1 - c];
  if (dir === 'up')    return [c, r];
  if (dir === 'down')  return [SIZE - 1 - c, r];
}

function transpose(g) {
  return g[0].map((_, c) => g.map(r => r[c]));
}

// ===== Check win/loss =====
function checkState() {
  if (!keepPlaying && grid.some(r => r.includes(2048))) {
    showOverlay('🎉 You Win!', '2048 달성! 계속 플레이하려면 아래 버튼을 누르세요.', true);
    won = true;
    return;
  }
  if (!canMove()) {
    showOverlay('💀 Game Over', `최종 점수: ${score.toLocaleString()}`, false);
    gameOver = true;
  }
}

function canMove() {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === 0) return true;
      if (c < SIZE - 1 && grid[r][c] === grid[r][c + 1]) return true;
      if (r < SIZE - 1 && grid[r][c] === grid[r + 1][c]) return true;
    }
  return false;
}

// ===== Overlay =====
function showOverlay(title, msg, isWin) {
  overlayTitle.textContent = title;
  overlayMsg.textContent = msg;
  document.getElementById('overlay-continue').style.display = isWin ? 'inline-flex' : 'none';
  overlayEl.classList.add('show');
}

function hideOverlay() {
  overlayEl.classList.remove('show');
}

// ===== Keyboard =====
const KEY_DIR = {
  ArrowLeft: 'left', ArrowRight: 'right',
  ArrowUp: 'up', ArrowDown: 'down',
  a: 'left', d: 'right', w: 'up', s: 'down',
  A: 'left', D: 'right', W: 'up', S: 'down',
};

document.addEventListener('keydown', e => {
  const dir = KEY_DIR[e.key];
  if (dir) { e.preventDefault(); move(dir); }
});

// ===== Touch / Swipe =====
let touchStart = null;
document.addEventListener('touchstart', e => {
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });

document.addEventListener('touchend', e => {
  if (!touchStart) return;
  const dx = e.changedTouches[0].clientX - touchStart.x;
  const dy = e.changedTouches[0].clientY - touchStart.y;
  touchStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
  if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
  else move(dy > 0 ? 'down' : 'up');
});

// ===== Buttons =====
document.getElementById('btn-new').addEventListener('click', init);

document.getElementById('overlay-retry').addEventListener('click', () => { hideOverlay(); init(); });

document.getElementById('overlay-continue').addEventListener('click', () => {
  keepPlaying = true;
  hideOverlay();
});

// ===== Start =====
buildBoard();
init();
