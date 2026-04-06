// ===== Snake (벽 없음 - 관통) =====

const STORAGE_KEY = 'hs_snake_best';
const GRID = 20; // 20×20 칸

// ===== Canvas =====
const canvas = document.getElementById('board');
const ctx    = canvas.getContext('2d');

// 캔버스 실제 해상도를 GRID의 배수로 고정 (선명하게)
const RES  = 400;
canvas.width  = RES;
canvas.height = RES;
const CELL = RES / GRID;

// ===== State =====
let snake, dir, nextDir, food, score, best, level, gameOver, paused, RAF, lastTime, stepMs;

function init() {
  snake   = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
  dir     = { x: 1, y: 0 };
  nextDir = { x: 1, y: 0 };
  score   = 0;
  level   = 1;
  stepMs  = 160;
  gameOver = false;
  paused   = false;
  best     = Number(localStorage.getItem(STORAGE_KEY)) || 0;

  placeFood();
  updateUI();
  hideOverlay();
  cancelAnimationFrame(RAF);
  lastTime = null;
  RAF = requestAnimationFrame(loop);
}

// ===== Food =====
function placeFood() {
  const occupied = new Set(snake.map(s => `${s.x},${s.y}`));
  let pos;
  do {
    pos = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
  } while (occupied.has(`${pos.x},${pos.y}`));
  food = pos;
}

// ===== Game loop =====
let elapsed2 = 0;
function loop(ts) {
  if (gameOver) return;
  const dt = ts - (lastTime || ts);
  lastTime = ts;
  elapsed2 += dt;

  if (elapsed2 >= stepMs) {
    elapsed2 = 0;
    step();
  }

  draw();
  RAF = requestAnimationFrame(loop);
}

// ===== Step =====
function step() {
  if (paused) return;

  dir = { ...nextDir };
  const head = {
    x: (snake[0].x + dir.x + GRID) % GRID,  // 벽 관통
    y: (snake[0].y + dir.y + GRID) % GRID,
  };

  // 자기 몸 충돌
  if (snake.some(s => s.x === head.x && s.y === head.y)) {
    endGame();
    return;
  }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    // 먹이 먹음
    score += level * 10;
    if (score > best) {
      best = score;
      localStorage.setItem(STORAGE_KEY, best);
    }
    // 레벨업: 먹이 5개마다
    if (score % (level * 50) === 0) {
      level++;
      stepMs = Math.max(60, stepMs - 15);
    }
    updateUI();
    placeFood();
  } else {
    snake.pop();
  }
}

// ===== Draw =====
function draw() {
  ctx.clearRect(0, 0, RES, RES);

  // 그리드
  ctx.strokeStyle = '#1e2235';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= GRID; i++) {
    ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, RES); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(RES, i * CELL); ctx.stroke();
  }

  // 먹이
  const fx = food.x * CELL + CELL / 2;
  const fy = food.y * CELL + CELL / 2;
  ctx.fillStyle = '#f87171';
  ctx.beginPath();
  ctx.arc(fx, fy, CELL * 0.38, 0, Math.PI * 2);
  ctx.fill();

  // 뱀
  snake.forEach((seg, i) => {
    const isHead = i === 0;
    const ratio  = 1 - i / (snake.length + 4); // 꼬리로 갈수록 어두워짐
    const alpha  = Math.max(0.3, ratio);
    ctx.fillStyle = isHead
      ? '#34d399'
      : `rgba(52, 211, 153, ${alpha})`;

    const pad = isHead ? 2 : 3;
    ctx.beginPath();
    roundRect(ctx, seg.x * CELL + pad, seg.y * CELL + pad, CELL - pad * 2, CELL - pad * 2, isHead ? 5 : 3);
    ctx.fill();

    // 눈
    if (isHead) {
      ctx.fillStyle = '#0f1117';
      const ex = dir.x === 0 ? 0 : dir.x * CELL * 0.22;
      const ey = dir.y === 0 ? 0 : dir.y * CELL * 0.22;
      const cx1 = seg.x * CELL + CELL / 2 + (dir.y !== 0 ? -CELL * 0.18 : 0) + ex;
      const cy1 = seg.y * CELL + CELL / 2 + (dir.x !== 0 ? -CELL * 0.18 : 0) + ey;
      const cx2 = seg.x * CELL + CELL / 2 + (dir.y !== 0 ?  CELL * 0.18 : 0) + ex;
      const cy2 = seg.y * CELL + CELL / 2 + (dir.x !== 0 ?  CELL * 0.18 : 0) + ey;
      ctx.beginPath(); ctx.arc(cx1, cy1, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx2, cy2, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  });
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r);
  c.lineTo(x + w, y + h - r); c.arcTo(x + w, y + h, x + w - r, y + h, r);
  c.lineTo(x + r, y + h); c.arcTo(x, y + h, x, y + h - r, r);
  c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r);
  c.closePath();
}

// ===== UI =====
function updateUI() {
  document.getElementById('score').textContent = score.toLocaleString();
  document.getElementById('best').textContent  = best.toLocaleString();
  document.getElementById('level').textContent = level;
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

// ===== Input =====
const KEY_DIR = {
  ArrowUp:    { x: 0, y: -1 }, ArrowDown:  { x: 0, y:  1 },
  ArrowLeft:  { x: -1, y: 0 }, ArrowRight: { x: 1,  y: 0 },
  w: { x: 0, y: -1 }, s: { x: 0, y:  1 },
  a: { x: -1, y: 0 }, d: { x: 1,  y: 0 },
  W: { x: 0, y: -1 }, S: { x: 0, y:  1 },
  A: { x: -1, y: 0 }, D: { x: 1,  y: 0 },
};

document.addEventListener('keydown', e => {
  const d = KEY_DIR[e.key];
  if (d) {
    e.preventDefault();
    // 반대 방향 무시
    if (d.x !== -dir.x || d.y !== -dir.y) nextDir = d;
    return;
  }
  if (e.key === 'p' || e.key === 'P') {
    paused = !paused;
    if (!paused) { lastTime = null; RAF = requestAnimationFrame(loop); }
  }
});

// 스와이프
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
  let d;
  if (Math.abs(dx) > Math.abs(dy)) d = dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 };
  else                              d = dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 };
  if (d.x !== -dir.x || d.y !== -dir.y) nextDir = d;
});

// ===== Buttons =====
document.getElementById('btn-new').addEventListener('click', init);
document.getElementById('overlay-retry').addEventListener('click', init);

// ===== Start =====
init();
