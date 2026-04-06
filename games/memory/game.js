// ===== Memory Card Match =====

const DIFFICULTIES = {
  easy:   { cols: 4, rows: 4, preview: 2000 },  //  8쌍, 2초 공개
  medium: { cols: 4, rows: 6, preview: 2000 },  // 12쌍, 2초 공개
  hard:   { cols: 6, rows: 6, preview: 2000 },  // 18쌍, 2초 공개
};

const STORAGE_KEYS = {
  easy:   'hs_memory_best_easy',
  medium: 'hs_memory_best_medium',
  hard:   'hs_memory_best_hard',
};

// 카드 이모지 풀 (최대 18쌍 필요)
const EMOJI_POOL = [
  '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼',
  '🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐧',
  '🦋','🌸',
];

let diffKey = 'easy';
let cards = [];         // { id, emoji, el, flipped, matched }
let flipped = [];       // 현재 뒤집힌 카드 (최대 2장)
let moves = 0;
let matchedCount = 0;
let totalPairs = 0;
let locked = false;     // 카드 처리 중 입력 차단
let timerInterval = null;
let elapsed = 0;
let firstFlip = true;

// ===== DOM =====
const boardEl   = document.getElementById('board');
const movesEl   = document.getElementById('moves');
const timerEl   = document.getElementById('timer');
const overlayEl = document.getElementById('overlay');
const overlayMsg = document.getElementById('overlay-msg');
const bestRowEl = document.getElementById('best-row');

// ===== Init =====
function init(key = diffKey) {
  diffKey = key;
  const { cols, rows } = DIFFICULTIES[key];
  totalPairs = (cols * rows) / 2;

  // 카드 데이터 생성 (쌍 × 2, 섞기)
  const emojis = EMOJI_POOL.slice(0, totalPairs);
  const pool = [...emojis, ...emojis];
  shuffle(pool);

  cards = pool.map((emoji, i) => ({ id: i, emoji, flipped: false, matched: false, el: null }));
  flipped = [];
  moves = 0;
  matchedCount = 0;
  locked = false;
  firstFlip = true;
  elapsed = 0;
  clearInterval(timerInterval);

  movesEl.textContent = 0;
  timerEl.textContent = '0';
  hideOverlay();
  updateBestDisplay();
  renderBoard(cols);
  startPreview(DIFFICULTIES[key].preview);

  document.querySelectorAll('.diff-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.diff === key);
  });
}

// ===== Preview (시작 시 전체 공개) =====
function startPreview(duration) {
  locked = true;

  // 모든 카드 뒤집기
  cards.forEach(card => card.el.classList.add('flipped'));

  // 카운트다운 표시
  let remaining = Math.ceil(duration / 1000);
  timerEl.textContent = remaining;
  const countdown = setInterval(() => {
    remaining--;
    timerEl.textContent = remaining > 0 ? remaining : '0';
    if (remaining <= 0) clearInterval(countdown);
  }, 1000);

  // 공개 종료 → 전부 뒤집고 게임 시작
  setTimeout(() => {
    clearInterval(countdown);
    cards.forEach(card => card.el.classList.remove('flipped'));
    timerEl.textContent = '0';
    locked = false;
  }, duration);
}

// ===== Fisher-Yates shuffle =====
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ===== Render =====
function renderBoard(cols) {
  boardEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  boardEl.innerHTML = '';

  cards.forEach(card => {
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `
      <div class="card-inner">
        <div class="card-front">?</div>
        <div class="card-back">${card.emoji}</div>
      </div>
    `;
    el.addEventListener('click', () => onCardClick(card));
    card.el = el;
    boardEl.appendChild(el);
  });
}

// ===== Card click =====
function onCardClick(card) {
  if (locked || card.flipped || card.matched) return;
  if (flipped.length === 2) return;

  if (firstFlip) {
    firstFlip = false;
    startTimer();
  }

  card.flipped = true;
  card.el.classList.add('flipped');
  flipped.push(card);

  if (flipped.length === 2) {
    moves++;
    movesEl.textContent = moves;
    checkMatch();
  }
}

// ===== Match check =====
function checkMatch() {
  const [a, b] = flipped;
  if (a.emoji === b.emoji) {
    // 매치
    a.matched = b.matched = true;
    a.el.classList.add('matched');
    b.el.classList.add('matched');
    flipped = [];
    matchedCount++;
    if (matchedCount === totalPairs) onWin();
  } else {
    // 미매치 → 잠시 후 뒤집기
    locked = true;
    setTimeout(() => {
      a.flipped = b.flipped = false;
      a.el.classList.remove('flipped');
      b.el.classList.remove('flipped');
      flipped = [];
      locked = false;
    }, 900);
  }
}

// ===== Win =====
function onWin() {
  clearInterval(timerInterval);
  const prev = Number(localStorage.getItem(STORAGE_KEYS[diffKey])) || Infinity;
  if (elapsed < prev) localStorage.setItem(STORAGE_KEYS[diffKey], elapsed);
  updateBestDisplay();
  overlayMsg.textContent = `${elapsed}초 · ${moves}번 시도`;
  showOverlay();
}

// ===== Timer =====
function startTimer() {
  const start = Date.now();
  timerInterval = setInterval(() => {
    elapsed = Math.floor((Date.now() - start) / 1000);
    timerEl.textContent = elapsed;
  }, 500);
}

// ===== Best =====
function updateBestDisplay() {
  const best = localStorage.getItem(STORAGE_KEYS[diffKey]);
  bestRowEl.innerHTML = best
    ? `${diffKey} 최고기록: <span>${best}초</span>`
    : `${diffKey} 최고기록: <span>없음</span>`;
}

// ===== Overlay =====
function showOverlay() { overlayEl.classList.add('show'); }
function hideOverlay() { overlayEl.classList.remove('show'); }

// ===== Buttons =====
document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => init(btn.dataset.diff));
});
document.getElementById('btn-new').addEventListener('click', () => init(diffKey));
document.getElementById('overlay-retry').addEventListener('click', () => init(diffKey));

// ===== Start =====
init();
