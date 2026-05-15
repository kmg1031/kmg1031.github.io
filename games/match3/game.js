// ===== Match-3 =====
const ROWS = 8;
const COLS = 8;
const COLORS = 6;
const TIME_LIMIT = 60;
const BEST_KEY = 'hs_match3_best';

const POP_MS = 200;
const DROP_MS = 200;

const boardEl = document.getElementById('board');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const timeEl = document.getElementById('time');
const comboEl = document.getElementById('combo');
const overlay = document.getElementById('overlay');
const overlayMsg = document.getElementById('overlay-msg');

let grid;          // ROWS x COLS, integer 0..5 or -1 for empty
let cellEls;       // ROWS x COLS DOM refs
let firstSel = null;
let locked = false;
let score = 0;
let timeLeft = TIME_LIMIT;
let timer = null;
let running = false;

// ---------- utility ----------
const rand = n => Math.floor(Math.random() * n);
const inBounds = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;
const isAdjacent = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// pick a color that won't form a 3-match at (r,c) given current grid above/left
function safeColor(r, c) {
  while (true) {
    const v = rand(COLORS);
    if (c >= 2 && grid[r][c - 1] === v && grid[r][c - 2] === v) continue;
    if (r >= 2 && grid[r - 1][c] === v && grid[r - 2][c] === v) continue;
    return v;
  }
}

function makeGrid() {
  grid = Array.from({ length: ROWS }, () => Array(COLS).fill(-1));
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      grid[r][c] = safeColor(r, c);
  if (!hasAnyMove()) reshuffle();
}

// ---------- match detection ----------
function findMatches() {
  const marks = Array.from({ length: ROWS }, () => Array(COLS).fill(false));

  // horizontal
  for (let r = 0; r < ROWS; r++) {
    let runStart = 0;
    for (let c = 1; c <= COLS; c++) {
      if (c < COLS && grid[r][c] !== -1 && grid[r][c] === grid[r][runStart]) continue;
      const len = c - runStart;
      if (grid[r][runStart] !== -1 && len >= 3) {
        for (let k = runStart; k < c; k++) marks[r][k] = true;
      }
      runStart = c;
    }
  }
  // vertical
  for (let c = 0; c < COLS; c++) {
    let runStart = 0;
    for (let r = 1; r <= ROWS; r++) {
      if (r < ROWS && grid[r][c] !== -1 && grid[r][c] === grid[runStart][c]) continue;
      const len = r - runStart;
      if (grid[runStart][c] !== -1 && len >= 3) {
        for (let k = runStart; k < r; k++) marks[k][c] = true;
      }
      runStart = r;
    }
  }
  return marks;
}

function countMarks(marks) {
  let n = 0;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (marks[r][c]) n++;
  return n;
}

function hasAnyMatch() {
  return countMarks(findMatches()) > 0;
}

// would swapping (r1,c1)<->(r2,c2) create a match?
function swapCreatesMatch(r1, c1, r2, c2) {
  [grid[r1][c1], grid[r2][c2]] = [grid[r2][c2], grid[r1][c1]];
  const ok = hasAnyMatch();
  [grid[r1][c1], grid[r2][c2]] = [grid[r2][c2], grid[r1][c1]];
  return ok;
}

function hasAnyMove() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (c + 1 < COLS && swapCreatesMatch(r, c, r, c + 1)) return true;
      if (r + 1 < ROWS && swapCreatesMatch(r, c, r + 1, c)) return true;
    }
  }
  return false;
}

function reshuffle() {
  // collect all values, shuffle, refill — repeat until movable & no initial match
  for (let attempt = 0; attempt < 50; attempt++) {
    const flat = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) flat.push(grid[r][c]);
    for (let i = flat.length - 1; i > 0; i--) {
      const j = rand(i + 1);
      [flat[i], flat[j]] = [flat[j], flat[i]];
    }
    let k = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) grid[r][c] = flat[k++];
    if (!hasAnyMatch() && hasAnyMove()) return;
  }
  // fallback: regenerate from scratch
  makeGrid();
}

// ---------- rendering ----------
function buildDOM() {
  boardEl.innerHTML = '';
  cellEls = [];
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r;
      cell.dataset.c = c;
      const gem = document.createElement('div');
      gem.className = 'gem';
      cell.appendChild(gem);
      cell.addEventListener('click', onCellClick);
      boardEl.appendChild(cell);
      row.push(cell);
    }
    cellEls.push(row);
  }
}

function paintAll() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const gem = cellEls[r][c].firstChild;
      if (grid[r][c] === -1) {
        gem.style.opacity = '0';
        delete gem.dataset.color;
      } else {
        gem.style.opacity = '1';
        gem.dataset.color = String(grid[r][c]);
      }
    }
  }
}

// ---------- input ----------
function onCellClick(e) {
  if (locked || !running) return;
  const r = +e.currentTarget.dataset.r;
  const c = +e.currentTarget.dataset.c;
  if (!firstSel) {
    firstSel = { r, c };
    cellEls[r][c].classList.add('selected');
    return;
  }
  if (firstSel.r === r && firstSel.c === c) {
    cellEls[r][c].classList.remove('selected');
    firstSel = null;
    return;
  }
  if (!isAdjacent(firstSel, { r, c })) {
    cellEls[firstSel.r][firstSel.c].classList.remove('selected');
    firstSel = { r, c };
    cellEls[r][c].classList.add('selected');
    return;
  }
  const a = firstSel;
  cellEls[a.r][a.c].classList.remove('selected');
  firstSel = null;
  trySwap(a, { r, c });
}

async function trySwap(a, b) {
  locked = true;
  [grid[a.r][a.c], grid[b.r][b.c]] = [grid[b.r][b.c], grid[a.r][a.c]];
  paintAll();

  if (!hasAnyMatch()) {
    // revert with shake
    await sleep(120);
    [grid[a.r][a.c], grid[b.r][b.c]] = [grid[b.r][b.c], grid[a.r][a.c]];
    cellEls[a.r][a.c].classList.add('shake');
    cellEls[b.r][b.c].classList.add('shake');
    paintAll();
    await sleep(180);
    cellEls[a.r][a.c].classList.remove('shake');
    cellEls[b.r][b.c].classList.remove('shake');
    locked = false;
    return;
  }

  await runCascade();

  if (!hasAnyMove()) {
    flashCombo('셔플!');
    reshuffle();
    paintAll();
  }
  locked = false;
}

// ---------- cascade ----------
async function runCascade() {
  let combo = 0;
  while (true) {
    const marks = findMatches();
    const cleared = countMarks(marks);
    if (cleared === 0) break;
    combo++;
    addScore(cleared * 10 * combo);
    if (combo >= 2) flashCombo(`COMBO x${combo}`);

    // pop animation
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (marks[r][c]) cellEls[r][c].firstChild.classList.add('popping');
      }
    }
    await sleep(POP_MS);

    // remove
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (marks[r][c]) {
          grid[r][c] = -1;
          cellEls[r][c].firstChild.classList.remove('popping');
        }
      }
    }

    // gravity + refill
    const dropped = applyGravityAndRefill();
    paintAll();
    for (const { r, c } of dropped) cellEls[r][c].firstChild.classList.add('dropping');
    await sleep(DROP_MS);
    for (const { r, c } of dropped) cellEls[r][c].firstChild.classList.remove('dropping');
  }
}

function applyGravityAndRefill() {
  const dropped = [];
  for (let c = 0; c < COLS; c++) {
    let writeR = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r][c] !== -1) {
        if (r !== writeR) {
          grid[writeR][c] = grid[r][c];
          grid[r][c] = -1;
          dropped.push({ r: writeR, c });
        }
        writeR--;
      }
    }
    for (let r = writeR; r >= 0; r--) {
      grid[r][c] = rand(COLORS);
      dropped.push({ r, c });
    }
  }
  return dropped;
}

// ---------- score & timer ----------
function addScore(n) {
  score += n;
  scoreEl.textContent = score;
}

function flashCombo(text) {
  comboEl.textContent = text;
  comboEl.classList.remove('flash');
  void comboEl.offsetWidth;
  comboEl.classList.add('flash');
}

function startTimer() {
  stopTimer();
  timer = setInterval(() => {
    timeLeft--;
    timeEl.textContent = timeLeft;
    if (timeLeft <= 0) gameOver();
  }, 1000);
}
function stopTimer() {
  if (timer) { clearInterval(timer); timer = null; }
}

function gameOver() {
  running = false;
  stopTimer();
  const best = +(localStorage.getItem(BEST_KEY) || 0);
  const isNewBest = score > best;
  if (isNewBest) {
    localStorage.setItem(BEST_KEY, score);
    bestEl.textContent = score;
  }
  overlayMsg.textContent = `Score: ${score}${isNewBest ? '  🏆 신기록!' : ''}`;
  overlay.classList.add('show');
}

function newGame() {
  overlay.classList.remove('show');
  score = 0;
  timeLeft = TIME_LIMIT;
  scoreEl.textContent = '0';
  timeEl.textContent = TIME_LIMIT;
  comboEl.textContent = '';
  firstSel = null;
  locked = false;
  running = true;
  makeGrid();
  paintAll();
  startTimer();
}

// ---------- init ----------
bestEl.textContent = localStorage.getItem(BEST_KEY) || '0';
buildDOM();
newGame();

document.getElementById('btn-new').addEventListener('click', newGame);
document.getElementById('overlay-retry').addEventListener('click', newGame);
