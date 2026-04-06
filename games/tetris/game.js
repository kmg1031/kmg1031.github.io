// ===== Tetris =====

const STORAGE_KEY = 'hs_tetris_best';
const COLS = 10;
const ROWS = 20;
// 사이드패널(120px) + 갭(16px) + 여백(32px) = 168px 확보 후 나머지를 보드 폭으로 사용
const CELL = Math.floor(Math.min(30, (window.innerWidth - 168) / COLS));

// ===== Tetromino definitions =====
const PIECES = {
  I: { shape: [[1,1,1,1]], color: '#22d3ee' },
  O: { shape: [[1,1],[1,1]], color: '#fbbf24' },
  T: { shape: [[0,1,0],[1,1,1]], color: '#a78bfa' },
  S: { shape: [[0,1,1],[1,1,0]], color: '#34d399' },
  Z: { shape: [[1,1,0],[0,1,1]], color: '#f87171' },
  J: { shape: [[1,0,0],[1,1,1]], color: '#60a5fa' },
  L: { shape: [[0,0,1],[1,1,1]], color: '#fb923c' },
};
const PIECE_KEYS = Object.keys(PIECES);

// ===== Canvas setup =====
const canvas    = document.getElementById('board');
const ctx       = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx   = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx   = holdCanvas.getContext('2d');

canvas.width  = COLS * CELL;
canvas.height = ROWS * CELL;
nextCanvas.width  = 4 * 24;
nextCanvas.height = 4 * 24;
holdCanvas.width  = 4 * 24;
holdCanvas.height = 4 * 24;

// ===== Game state =====
let board, score, best, level, lines, current, next, hold, holdUsed, gameOver, paused, dropInterval, lastTime;

function init() {
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  score = 0; lines = 0; level = 1;
  best  = Number(localStorage.getItem(STORAGE_KEY)) || 0;
  hold  = null; holdUsed = false;
  gameOver = false; paused = false;
  next = randomPiece();
  spawnPiece();
  updateUI();
  hideOverlay();
  if (dropInterval) clearInterval(dropInterval);
  startLoop();
}

// ===== Piece factory =====
function randomPiece() {
  const key = PIECE_KEYS[Math.floor(Math.random() * PIECE_KEYS.length)];
  return { key, shape: PIECES[key].shape.map(r => [...r]), color: PIECES[key].color };
}

function spawnPiece() {
  current = next;
  current.x = Math.floor(COLS / 2) - Math.floor(current.shape[0].length / 2);
  current.y = 0;
  next = randomPiece();
  holdUsed = false;
  if (collides(current)) { endGame(); }
}

// ===== Collision =====
function collides(piece, dx = 0, dy = 0, shape = piece.shape) {
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = piece.x + c + dx;
      const ny = piece.y + r + dy;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  return false;
}

// ===== Rotate =====
function rotate(shape) {
  return shape[0].map((_, c) => shape.map(r => r[c]).reverse());
}

// ===== Lock piece =====
function lock() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++) {
      if (!current.shape[r][c]) continue;
      const y = current.y + r;
      if (y < 0) { endGame(); return; }
      board[y][current.x + c] = current.color;
    }
  clearLines();
  spawnPiece();
}

// ===== Clear lines =====
const LINE_SCORES = [0, 100, 300, 500, 800];
function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v)) {
      board.splice(r, 1);
      board.unshift(Array(COLS).fill(0));
      cleared++;
      r++; // recheck same row
    }
  }
  if (cleared) {
    score += LINE_SCORES[cleared] * level;
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    if (score > best) {
      best = score;
      localStorage.setItem(STORAGE_KEY, best);
    }
    updateUI();
  }
}

// ===== Ghost piece =====
function getGhostY() {
  let dy = 0;
  while (!collides(current, 0, dy + 1)) dy++;
  return current.y + dy;
}

// ===== Draw =====
function drawCell(c, x, y, size = CELL, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = c;
  ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  ctx.globalAlpha = 1;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Grid
  ctx.strokeStyle = '#1e2235';
  ctx.lineWidth = 0.5;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      ctx.strokeRect(c * CELL, r * CELL, CELL, CELL);
    }

  // Board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c]) drawCell(board[r][c], c, r);

  if (current && !gameOver) {
    // Ghost
    const ghostY = getGhostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawCell(current.color, current.x + c, ghostY + r, CELL, 0.25);

    // Current
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawCell(current.color, current.x + c, current.y + r);
  }

  drawSmallPiece(nextCtx, next);
  drawSmallPiece(holdCtx, hold);
}

function drawSmallPiece(sctx, piece) {
  sctx.clearRect(0, 0, 96, 96);
  if (!piece) return;
  const s = 24;
  const offX = Math.floor((4 - piece.shape[0].length) / 2);
  const offY = Math.floor((4 - piece.shape.length) / 2);
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      if (piece.shape[r][c]) {
        sctx.fillStyle = piece.color;
        sctx.fillRect((offX + c) * s + 1, (offY + r) * s + 1, s - 2, s - 2);
      }
}

// ===== Game loop =====
let RAF;
const DROP_SPEEDS = [800, 720, 630, 550, 470, 380, 300, 220, 130, 100];

function getSpeed() { return DROP_SPEEDS[Math.min(level - 1, DROP_SPEEDS.length - 1)]; }

let elapsed = 0;
function loop(ts) {
  if (gameOver || paused) return;
  const dt = ts - (lastTime || ts);
  lastTime = ts;
  elapsed += dt;
  if (elapsed >= getSpeed()) {
    elapsed = 0;
    softDrop();
  }
  draw();
  RAF = requestAnimationFrame(loop);
}

function startLoop() {
  lastTime = null; elapsed = 0;
  cancelAnimationFrame(RAF);
  RAF = requestAnimationFrame(loop);
}

// ===== Actions =====
function softDrop() {
  if (collides(current, 0, 1)) lock();
  else { current.y++; score++; updateUI(); }
}

function hardDrop() {
  const dy = getGhostY() - current.y;
  current.y = getGhostY();
  score += dy * 2;
  updateUI();
  lock();
}

function moveLeft()  { if (!collides(current, -1, 0)) current.x--; }
function moveRight() { if (!collides(current, 1, 0))  current.x++; }

function rotatePiece() {
  const rotated = rotate(current.shape);
  if (!collides(current, 0, 0, rotated)) {
    current.shape = rotated;
  } else if (!collides(current, 1, 0, rotated)) {
    current.shape = rotated; current.x++;
  } else if (!collides(current, -1, 0, rotated)) {
    current.shape = rotated; current.x--;
  }
}

function doHold() {
  if (holdUsed) return;
  holdUsed = true;
  if (!hold) {
    hold = { key: current.key, shape: PIECES[current.key].shape.map(r => [...r]), color: current.color };
    spawnPiece();
  } else {
    const tmp = hold;
    hold = { key: current.key, shape: PIECES[current.key].shape.map(r => [...r]), color: current.color };
    current = tmp;
    current.x = Math.floor(COLS / 2) - Math.floor(current.shape[0].length / 2);
    current.y = 0;
  }
}

// ===== UI =====
function updateUI() {
  document.getElementById('score').textContent = score.toLocaleString();
  document.getElementById('best').textContent  = best.toLocaleString();
  document.getElementById('level').textContent = level;
  document.getElementById('lines').textContent = lines;
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(RAF);
  draw();
  document.getElementById('overlay-score').textContent = score.toLocaleString();
  showOverlay();
}

function showOverlay() { document.getElementById('overlay').classList.add('show'); }
function hideOverlay() { document.getElementById('overlay').classList.remove('show'); }

// ===== Keyboard =====
document.addEventListener('keydown', e => {
  if (gameOver) return;
  switch (e.key) {
    case 'ArrowLeft':  e.preventDefault(); moveLeft();    break;
    case 'ArrowRight': e.preventDefault(); moveRight();   break;
    case 'ArrowDown':  e.preventDefault(); softDrop();    break;
    case 'ArrowUp':    e.preventDefault(); rotatePiece(); break;
    case ' ':          e.preventDefault(); hardDrop();    break;
    case 'c': case 'C': doHold(); break;
    case 'p': case 'P': togglePause(); break;
  }
  draw();
});

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) startLoop();
}

// ===== Buttons =====
document.getElementById('btn-new').addEventListener('click', init);
document.getElementById('overlay-retry').addEventListener('click', init);

// ===== Start =====
init();
