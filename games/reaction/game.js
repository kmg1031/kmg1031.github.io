// ===== Reaction Time Game =====

const STORAGE_KEY_AVG = 'hs_reaction_best_avg';
const TOTAL_ROUNDS = 5;

const COLORS = [
  { bg: '#16a34a', icon: '🟢' },
  { bg: '#2563eb', icon: '🔵' },
  { bg: '#d97706', icon: '🟡' },
  { bg: '#db2777', icon: '🟣' },
  { bg: '#0891b2', icon: '🔷' },
];

// ===== State =====
// phase: 'idle' | 'waiting' | 'ready' | 'too-early' | 'done'
let phase = 'idle';
let round = 0;
let times = [];       // 각 라운드 반응속도(ms)
let readyAt = 0;      // 색 바뀐 타임스탬프
let waitTimer = null;
let currentColor = null;

// ===== DOM =====
const arenaEl   = document.getElementById('arena');
const iconEl    = document.getElementById('arena-icon');
const titleEl   = document.getElementById('arena-title');
const subEl     = document.getElementById('arena-sub');
const dotsEl    = document.getElementById('round-dots');
const summaryEl = document.getElementById('summary');
const roundListEl = document.getElementById('round-list');

// ===== Init =====
function init() {
  phase = 'idle';
  round = 0;
  times = [];
  clearTimeout(waitTimer);
  arenaEl.style.background = '';
  arenaEl.className = 'arena';
  summaryEl.style.display = 'none';
  renderDots();
  showIdle();
}

// ===== Show phases =====
function showIdle() {
  iconEl.textContent  = '⚡';
  titleEl.textContent = '클릭해서 시작';
  subEl.textContent   = `화면이 바뀌면 최대한 빨리 클릭하세요 · ${TOTAL_ROUNDS}라운드`;
  arenaEl.style.background = '';
  arenaEl.className = 'arena';
}

function showWaiting() {
  iconEl.textContent  = '⏳';
  titleEl.textContent = '기다리세요...';
  subEl.textContent   = '색이 바뀌면 클릭!';
  arenaEl.style.background = '';
  arenaEl.className = 'arena waiting';
}

function showReady(color) {
  arenaEl.style.background = color.bg;
  arenaEl.className = 'arena ready';
  iconEl.textContent  = color.icon;
  titleEl.textContent = '지금 클릭!';
  subEl.textContent   = '';
}

function showTooEarly() {
  clearTimeout(waitTimer);
  iconEl.textContent  = '⚠️';
  titleEl.textContent = '너무 빨랐습니다!';
  subEl.textContent   = '클릭해서 다시 시도';
  arenaEl.style.background = '';
  arenaEl.className = 'arena too-early';
}

function showRoundResult(ms) {
  arenaEl.style.background = currentColor.bg;
  arenaEl.className = 'arena ready';
  iconEl.textContent = '';
  titleEl.innerHTML  = `<span class="result-time">${ms}</span><span class="result-unit">ms</span>`;
  subEl.textContent  = round < TOTAL_ROUNDS ? '클릭해서 다음 라운드' : '클릭해서 결과 보기';
}

// ===== Arena click =====
arenaEl.addEventListener('click', () => {
  if (phase === 'idle') {
    startRound();
    return;
  }
  if (phase === 'waiting') {
    // 너무 일찍 클릭
    phase = 'too-early';
    showTooEarly();
    return;
  }
  if (phase === 'too-early') {
    // 재시도
    startRound();
    return;
  }
  if (phase === 'ready') {
    const ms = Date.now() - readyAt;
    times.push(ms);
    phase = 'result';
    renderDots();
    showRoundResult(ms);
    return;
  }
  if (phase === 'result') {
    if (round < TOTAL_ROUNDS) startRound();
    else showDone();
    return;
  }
  if (phase === 'done') {
    init();
  }
});

// ===== Round =====
function startRound() {
  round++;
  phase = 'waiting';
  showWaiting();
  renderDots();

  const delay = 1500 + Math.random() * 2500; // 1.5~4초
  waitTimer = setTimeout(() => {
    if (phase !== 'waiting') return;
    currentColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    phase = 'ready';
    readyAt = Date.now();
    showReady(currentColor);
  }, delay);
}

// ===== Done =====
function showDone() {
  phase = 'done';
  arenaEl.style.background = '';
  arenaEl.className = 'arena';
  iconEl.textContent  = '🏆';
  titleEl.textContent = '완료!';
  subEl.textContent   = '클릭해서 다시 하기';

  const avg  = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  const best = Math.min(...times);

  // 기록 저장
  const prevBestAvg = Number(localStorage.getItem(STORAGE_KEY_AVG)) || Infinity;
  if (avg < prevBestAvg) localStorage.setItem(STORAGE_KEY_AVG, avg);

  // 라운드별 결과 테이블
  roundListEl.innerHTML = '';
  const minTime = Math.min(...times);
  times.forEach((t, i) => {
    const row = document.createElement('div');
    row.className = 'round-row';
    row.innerHTML = `
      <span class="rn">Round ${i + 1}</span>
      <span class="rt ${t === minTime ? 'best-r' : ''}">${t} ms ${t === minTime ? '🏅' : ''}</span>
    `;
    roundListEl.appendChild(row);
  });

  // 평균 행
  const avgRow = document.createElement('div');
  avgRow.className = 'round-row';
  avgRow.style.borderTop = '1px solid #2e3350';
  avgRow.style.paddingTop = '8px';
  avgRow.style.marginTop = '4px';
  avgRow.innerHTML = `<span class="rn">평균</span><span class="rt" style="color:#6c63ff">${avg} ms</span>`;
  roundListEl.appendChild(avgRow);

  summaryEl.style.display = 'block';
}

// ===== Dots =====
function renderDots() {
  dotsEl.innerHTML = '';
  for (let i = 0; i < TOTAL_ROUNDS; i++) {
    const dot = document.createElement('div');
    if (i < times.length)     dot.className = 'dot done';
    else if (i === round - 1 && phase !== 'result') dot.className = 'dot active';
    else                      dot.className = 'dot';
    dotsEl.appendChild(dot);
  }
}

// ===== Stats =====
function updateStats() {
  const curBest = times.length ? Math.min(...times) : null;
  const curAvg  = times.length ? Math.round(times.reduce((a,b) => a+b,0) / times.length) : null;
  const allBest = localStorage.getItem(STORAGE_KEY_SINGLE);

  statSingle.textContent = curBest !== null ? `${curBest} ms` : '–';
  statAvg.textContent    = curAvg  !== null ? `${curAvg} ms`  : '–';
  statBest.textContent   = allBest           ? `${allBest} ms` : '–';
}

// ===== Start =====
init();
