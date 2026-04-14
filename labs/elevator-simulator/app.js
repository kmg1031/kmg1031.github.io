// ============================================================
//  엘리베이터 시뮬레이터 – app.js
//  엘리베이터 1대, 함수 단위로 동작 분리
// ============================================================

// === Constants ===
const FLOORS = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
const FLOOR_LABELS = { 0: 'B1', 1: '1F', 2: '2F', 3: '3F', 4: '4F', 5: '5F', 6: '6F', 7: '7F', 8: '8F', 9: '9F' };
const TICK_MS = 100;
const FLOOR_TRAVEL_TIME = 2;
const DOOR_ANIM_TIME = 0.4;
const DOOR_OPEN_HOLD = 3;

// === State ===
const state = {
  running: true,
  simSpeed: 1,
  simTime: 0,
  algorithm: 'LOOK',

  elevator: {
    currentFloor: 1,
    direction: 0,
    doorState: 'closed',
    doorTimer: 0,
    moveTimer: 0,
    passengers: [],
    emergency: false,
    internalCalls: new Set(),
  },

  hallCalls: {},
  callQueue: [],

  waitingPassengers: {},
  passengerIdCounter: 0,

  autoPassenger: { enabled: false, frequency: 5, nextSpawnAt: 0 },

  stats: {
    totalServed: 0,
    totalFloorsTraveled: 0,
    totalWaitTime: 0,
    totalTravelTime: 0,
    currentWaiting: 0,
  },
};

// === DOM Cache ===
const $ = id => document.getElementById(id);

// ============================================================
//  1. 초기화 함수
// ============================================================

function initState() {
  FLOORS.forEach(f => {
    state.hallCalls[f] = { up: false, down: false };
    state.waitingPassengers[f] = [];
  });
  loadSettings();
}

function loadSettings() {
  const algo = localStorage.getItem('hs_elevator_algorithm');
  if (algo) { state.algorithm = algo; $('algorithmSelect').value = algo; }
  const speed = localStorage.getItem('hs_elevator_simspeed');
  if (speed) setSpeed(parseInt(speed));
  const auto = localStorage.getItem('hs_elevator_auto_passenger');
  if (auto === 'true') toggleAutoPassenger();
  const freq = localStorage.getItem('hs_elevator_frequency');
  if (freq) { state.autoPassenger.frequency = parseInt(freq); $('frequencySlider').value = freq; updateFrequencyLabel(); }
}

function saveSetting(key, value) {
  localStorage.setItem('hs_elevator_' + key, value);
}

// ============================================================
//  2. 건물 UI 렌더 함수 (초기 1회)
// ============================================================

function buildBuildingUI() {
  const container = $('buildingInner');
  container.innerHTML = '';

  FLOORS.forEach(floor => {
    const row = document.createElement('div');
    row.className = 'floor-row';
    row.dataset.floor = floor;

    const label = document.createElement('div');
    label.className = 'floor-label';
    label.textContent = FLOOR_LABELS[floor];

    const calls = document.createElement('div');
    calls.className = 'floor-calls';
    if (floor < 9) {
      const upBtn = document.createElement('button');
      upBtn.className = 'call-btn';
      upBtn.textContent = '▲';
      upBtn.addEventListener('click', () => handleHallCall(floor, 'up'));
      upBtn.dataset.floor = floor;
      upBtn.dataset.dir = 'up';
      calls.appendChild(upBtn);
    }
    if (floor > 0) {
      const downBtn = document.createElement('button');
      downBtn.className = 'call-btn';
      downBtn.textContent = '▼';
      downBtn.addEventListener('click', () => handleHallCall(floor, 'down'));
      downBtn.dataset.floor = floor;
      downBtn.dataset.dir = 'down';
      calls.appendChild(downBtn);
    }

    const shaft = document.createElement('div');
    shaft.className = 'shaft';
    shaft.dataset.floor = floor;

    const badge = document.createElement('div');
    badge.className = 'waiting-badge empty';
    badge.dataset.floor = floor;
    badge.textContent = '0';

    row.appendChild(label);
    row.appendChild(calls);
    row.appendChild(shaft);
    row.appendChild(badge);
    container.appendChild(row);
  });

  const cabin = document.createElement('div');
  cabin.className = 'cabin';
  cabin.id = 'cabin';
  cabin.innerHTML = '<div class="door-left"></div><div class="door-right"></div><div class="cabin-passengers" id="cabinCount">0</div>';
  container.querySelector('.shaft').appendChild(cabin);
}

function buildPanelUI() {
  const container = $('panelButtons');
  container.innerHTML = '';
  FLOORS.forEach(floor => {
    const btn = document.createElement('button');
    btn.className = 'panel-floor-btn';
    btn.textContent = FLOOR_LABELS[floor];
    btn.dataset.floor = floor;
    btn.addEventListener('click', () => handleInternalCall(floor));
    container.appendChild(btn);
  });
}

// ============================================================
//  3. 홀 호출 / 내부 호출 처리 함수
// ============================================================

function handleHallCall(floor, direction) {
  if (state.elevator.emergency) return;
  state.hallCalls[floor][direction] = true;
  state.callQueue.push({ floor, direction, time: state.simTime });
  renderHallButtons();
}

function handleInternalCall(floor) {
  const ev = state.elevator;
  if (ev.emergency) return;
  if (floor === ev.currentFloor && ev.doorState === 'closed' && ev.moveTimer <= 0 && ev.direction === 0) {
    startDoorOpen(ev);
    return;
  }
  ev.internalCalls.add(floor);
  renderPanelButtons();
}

function clearHallCall(floor, direction) {
  const waiting = state.waitingPassengers[floor];
  const hasWaitingInDir = waiting.some(p => {
    const pDir = p.dest > p.origin ? 'up' : 'down';
    return pDir === direction;
  });
  if (!hasWaitingInDir) {
    state.hallCalls[floor][direction] = false;
    state.callQueue = state.callQueue.filter(c => !(c.floor === floor && c.direction === direction));
  }
}

// ============================================================
//  4. 승객 관리 함수
// ============================================================

function createPassenger(origin, dest) {
  const passenger = {
    id: ++state.passengerIdCounter,
    origin,
    dest,
    createdAt: state.simTime,
    boardedAt: null,
  };
  state.waitingPassengers[origin].push(passenger);
  state.stats.currentWaiting++;

  const dir = dest > origin ? 'up' : 'down';
  if (!state.hallCalls[origin][dir]) {
    handleHallCall(origin, dir);
  }
}

function boardPassengers(ev) {
  const floor = ev.currentFloor;
  const waiting = state.waitingPassengers[floor];
  if (waiting.length === 0) return;

  // 끝 층에서는 방향 전환: 9F→하행, B1→상행
  if (floor === 9) ev.direction = -1;
  else if (floor === 0) ev.direction = 1;

  const toBoard = [];
  const remaining = [];

  waiting.forEach(p => {
    const pDir = p.dest > p.origin ? 'up' : 'down';
    const evDir = ev.direction;
    if (evDir === 0 || (evDir === 1 && pDir === 'up') || (evDir === -1 && pDir === 'down')) {
      toBoard.push(p);
    } else {
      remaining.push(p);
    }
  });

  toBoard.forEach(p => {
    p.boardedAt = state.simTime;
    state.stats.totalWaitTime += (state.simTime - p.createdAt);
    ev.passengers.push(p);
    state.stats.currentWaiting--;
    ev.internalCalls.add(p.dest);
  });

  state.waitingPassengers[floor] = remaining;

  if (ev.direction >= 0) clearHallCall(floor, 'up');
  if (ev.direction <= 0) clearHallCall(floor, 'down');
}

function alightPassengers(ev) {
  const floor = ev.currentFloor;
  const alighting = ev.passengers.filter(p => p.dest === floor);
  const staying = ev.passengers.filter(p => p.dest !== floor);

  alighting.forEach(p => {
    state.stats.totalTravelTime += (state.simTime - p.boardedAt);
    state.stats.totalServed++;
  });

  ev.passengers = staying;
  ev.internalCalls.delete(floor);
}

function spawnRandomPassenger() {
  const origin = FLOORS[Math.floor(Math.random() * FLOORS.length)];
  let dest;
  do { dest = FLOORS[Math.floor(Math.random() * FLOORS.length)]; } while (dest === origin);
  createPassenger(origin, dest);
}

function updateAutoPassenger(dt) {
  if (!state.autoPassenger.enabled) return;
  state.autoPassenger.nextSpawnAt -= dt;
  if (state.autoPassenger.nextSpawnAt <= 0) {
    spawnRandomPassenger();
    const base = 11 - state.autoPassenger.frequency;
    state.autoPassenger.nextSpawnAt = base + Math.random() * base;
  }
}

// ============================================================
//  5. 도어 제어 함수
// ============================================================

function startDoorOpen(ev) {
  if (ev.doorState !== 'closed' || ev.moveTimer > 0) return;
  ev.doorState = 'opening';
  ev.doorTimer = DOOR_ANIM_TIME;
}

function startDoorClose(ev) {
  if (ev.doorState !== 'open') return;
  ev.doorState = 'closing';
  ev.doorTimer = DOOR_ANIM_TIME;
}

function updateDoor(ev, dt) {
  if (ev.doorState === 'opening') {
    ev.doorTimer -= dt;
    if (ev.doorTimer <= 0) {
      ev.doorState = 'open';
      ev.doorTimer = DOOR_OPEN_HOLD;
      alightPassengers(ev);
      boardPassengers(ev);
    }
  } else if (ev.doorState === 'open') {
    ev.doorTimer -= dt;
    if (ev.doorTimer <= 0) {
      ev.doorState = 'closing';
      ev.doorTimer = DOOR_ANIM_TIME;
    }
  } else if (ev.doorState === 'closing') {
    ev.doorTimer -= dt;
    if (ev.doorTimer <= 0) {
      ev.doorState = 'closed';
      ev.doorTimer = 0;
    }
  }
}

// ============================================================
//  6. 엘리베이터 이동 함수
// ============================================================

function moveElevator(ev, dt) {
  if (ev.doorState !== 'closed') return;
  if (ev.emergency) return;

  if (ev.moveTimer > 0) {
    ev.moveTimer -= dt;
    if (ev.moveTimer <= 0) {
      ev.moveTimer = 0;
      arriveAtFloor(ev);
    }
    return;
  }

  const nextFloor = pickNextFloor(ev);
  if (nextFloor === null) {
    ev.direction = 0;
    return;
  }

  if (nextFloor > ev.currentFloor) {
    ev.direction = 1;
  } else if (nextFloor < ev.currentFloor) {
    ev.direction = -1;
  } else {
    if (ev.doorState === 'closed') {
      startDoorOpen(ev);
    }
    return;
  }

  ev.moveTimer = FLOOR_TRAVEL_TIME;
}

function arriveAtFloor(ev) {
  ev.currentFloor += ev.direction;
  state.stats.totalFloorsTraveled++;

  if (shouldStopAtFloor(ev, ev.currentFloor)) {
    startDoorOpen(ev);
  }
}

function shouldStopAtFloor(ev, floor) {
  if (ev.internalCalls.has(floor)) return true;
  const calls = state.hallCalls[floor];
  if (!calls) return false;
  // 끝 층(9F, B1)에서는 방향 관계없이 정차
  if ((floor === 9 || floor === 0) && (calls.up || calls.down)) return true;
  // 일반 층: 같은 방향 홀 호출만 정차
  if (ev.direction >= 0 && calls.up) return true;
  if (ev.direction <= 0 && calls.down) return true;
  return false;
}

// ============================================================
//  7. 스케줄링 알고리즘 함수
// ============================================================

function pickNextFloor(ev) {
  switch (state.algorithm) {
    case 'FCFS': return pickNextFCFS(ev);
    case 'SCAN': return pickNextSCAN(ev);
    case 'LOOK': return pickNextLOOK(ev);
    case 'SSTF': return pickNextSSTF(ev);
    default: return pickNextLOOK(ev);
  }
}

function getAllRequestedFloors(ev) {
  const floors = new Set(ev.internalCalls);
  FLOORS.forEach(f => {
    if (state.hallCalls[f].up || state.hallCalls[f].down) floors.add(f);
  });
  return [...floors];
}

function pickNextFCFS(ev) {
  const internals = [...ev.internalCalls];
  if (internals.length > 0) return internals[0];
  if (state.callQueue.length > 0) return state.callQueue[0].floor;
  return null;
}

function pickNextSCAN(ev) {
  const requests = getAllRequestedFloors(ev);
  if (requests.length === 0) return null;

  let dir = ev.direction || 1;
  const cur = ev.currentFloor;

  const inDir = requests.filter(f => dir === 1 ? f >= cur : f <= cur)
    .sort((a, b) => dir === 1 ? a - b : b - a);

  if (inDir.length > 0) return inDir[0];

  if (dir === 1) return 9;
  return 0;
}

function pickNextLOOK(ev) {
  const requests = getAllRequestedFloors(ev);
  if (requests.length === 0) return null;

  let dir = ev.direction || 1;
  const cur = ev.currentFloor;

  const inDir = requests.filter(f => dir === 1 ? f > cur : f < cur)
    .sort((a, b) => dir === 1 ? a - b : b - a);

  if (inDir.length > 0) return inDir[0];

  const otherDir = requests.filter(f => dir === 1 ? f < cur : f > cur)
    .sort((a, b) => dir === 1 ? b - a : a - b);

  if (otherDir.length > 0) return otherDir[0];
  if (requests.includes(cur)) return cur;
  return null;
}

function pickNextSSTF(ev) {
  const requests = getAllRequestedFloors(ev);
  if (requests.length === 0) return null;

  const starved = state.callQueue.filter(c => state.simTime - c.time > 30);
  if (starved.length > 0) {
    return starved.sort((a, b) => a.time - b.time)[0].floor;
  }

  return requests.sort((a, b) => Math.abs(a - ev.currentFloor) - Math.abs(b - ev.currentFloor))[0];
}

// ============================================================
//  8. 시뮬레이션 틱 함수
// ============================================================

function tick() {
  if (!state.running) return;
  const dt = state.simSpeed * (TICK_MS / 1000);
  state.simTime += dt;

  updateAutoPassenger(dt);

  const ev = state.elevator;
  if (!ev.emergency) {
    updateDoor(ev, dt);
    moveElevator(ev, dt);
  }

  render();
}

// ============================================================
//  9. 렌더링 함수
// ============================================================

function render() {
  renderCabin();
  renderFloorDisplay();
  renderPanelButtons();
  renderHallButtons();
  renderWaitingBadges();
  renderStats();
}

function renderCabin() {
  const ev = state.elevator;
  const cabin = $('cabin');

  const floorIndex = FLOORS.indexOf(ev.currentFloor);
  let offset = floorIndex;
  if (ev.moveTimer > 0 && ev.direction !== 0) {
    const progress = 1 - (ev.moveTimer / FLOOR_TRAVEL_TIME);
    const nextIndex = FLOORS.indexOf(ev.currentFloor + ev.direction);
    if (nextIndex >= 0) {
      offset = floorIndex + (nextIndex - floorIndex) * progress;
    }
  }

  cabin.style.transform = 'translateY(' + (offset * 48) + 'px)';

  const isOpen = ev.doorState === 'open' || ev.doorState === 'opening';
  cabin.classList.toggle('door-open', isOpen);

  $('cabinCount').textContent = ev.passengers.length || '';
}

function renderFloorDisplay() {
  const ev = state.elevator;
  $('floorDisplay').textContent = FLOOR_LABELS[ev.currentFloor] || ev.currentFloor;
  const dirSymbol = ev.direction === 1 ? '▲' : ev.direction === -1 ? '▼' : '-';
  const dirEl = $('directionDisplay');
  dirEl.textContent = dirSymbol;
  dirEl.style.color = ev.direction === 1 ? 'var(--up-color)' : ev.direction === -1 ? 'var(--down-color)' : 'var(--text-muted)';
}

function renderPanelButtons() {
  const ev = state.elevator;
  document.querySelectorAll('.panel-floor-btn').forEach(btn => {
    const f = parseInt(btn.dataset.floor);
    btn.classList.toggle('active', ev.internalCalls.has(f));
    btn.classList.toggle('current', f === ev.currentFloor);
  });
}

function renderHallButtons() {
  document.querySelectorAll('.call-btn').forEach(btn => {
    const f = parseInt(btn.dataset.floor);
    const dir = btn.dataset.dir;
    btn.classList.toggle('active-up', dir === 'up' && state.hallCalls[f] && state.hallCalls[f].up);
    btn.classList.toggle('active-down', dir === 'down' && state.hallCalls[f] && state.hallCalls[f].down);
  });
}

function renderWaitingBadges() {
  document.querySelectorAll('.waiting-badge').forEach(badge => {
    const f = parseInt(badge.dataset.floor);
    const count = state.waitingPassengers[f] ? state.waitingPassengers[f].length : 0;
    badge.textContent = count;
    badge.classList.toggle('empty', count === 0);
  });
}

function renderStats() {
  const s = state.stats;
  const avgWait = s.totalServed > 0 ? (s.totalWaitTime / s.totalServed).toFixed(1) : '0.0';
  const avgTravel = s.totalServed > 0 ? (s.totalTravelTime / s.totalServed).toFixed(1) : '0.0';
  $('statWait').textContent = avgWait + '초';
  $('statTravel').textContent = avgTravel + '초';
  $('statServed').textContent = s.totalServed + '명';
  $('statDistance').textContent = s.totalFloorsTraveled + '층';
  $('statWaiting').textContent = s.currentWaiting + '명';
}

// ============================================================
//  10. UI 이벤트 바인딩 함수
// ============================================================

function bindEvents() {
  bindAlgorithmSelect();
  bindSpeedButtons();
  bindPauseButton();
  bindDoorButtons();
  bindEmergencyButton();
  bindAutoPassenger();
  bindResetStats();
}

function bindAlgorithmSelect() {
  $('algorithmSelect').addEventListener('change', e => {
    state.algorithm = e.target.value;
    saveSetting('algorithm', state.algorithm);
  });
}

function bindSpeedButtons() {
  document.querySelectorAll('#speedBtns .speed-btn').forEach(btn => {
    btn.addEventListener('click', () => setSpeed(parseInt(btn.dataset.speed)));
  });
}

function setSpeed(speed) {
  state.simSpeed = speed;
  document.querySelectorAll('#speedBtns .speed-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.speed) === speed);
  });
  saveSetting('simspeed', speed);
}

function bindPauseButton() {
  $('pauseBtn').addEventListener('click', () => {
    state.running = !state.running;
    const btn = $('pauseBtn');
    btn.textContent = state.running ? '⏸ 일시정지' : '▶ 재개';
    btn.classList.toggle('paused', !state.running);
  });
}

function bindDoorButtons() {
  $('doorOpenBtn').addEventListener('click', () => {
    const ev = state.elevator;
    if (ev.doorState === 'closed' && ev.moveTimer <= 0 && ev.direction === 0) startDoorOpen(ev);
  });
  $('doorCloseBtn').addEventListener('click', () => {
    const ev = state.elevator;
    if (ev.doorState === 'open') startDoorClose(ev);
  });
}

function bindEmergencyButton() {
  $('emergencyBtn').addEventListener('click', () => {
    const ev = state.elevator;
    ev.emergency = !ev.emergency;
    $('emergencyBtn').classList.toggle('active', ev.emergency);
    if (ev.emergency) {
      ev.moveTimer = 0;
      ev.direction = 0;
    }
  });
}

function bindAutoPassenger() {
  $('autoToggle').addEventListener('click', toggleAutoPassenger);
  $('frequencySlider').addEventListener('input', e => {
    state.autoPassenger.frequency = parseInt(e.target.value);
    updateFrequencyLabel();
    saveSetting('frequency', state.autoPassenger.frequency);
  });
}

function toggleAutoPassenger() {
  state.autoPassenger.enabled = !state.autoPassenger.enabled;
  const btn = $('autoToggle');
  btn.textContent = state.autoPassenger.enabled ? 'ON' : 'OFF';
  btn.classList.toggle('on', state.autoPassenger.enabled);
  if (state.autoPassenger.enabled) {
    state.autoPassenger.nextSpawnAt = 1;
  }
  saveSetting('auto_passenger', state.autoPassenger.enabled);
}

function updateFrequencyLabel() {
  const v = state.autoPassenger.frequency;
  const labels = { 1: '매우 느림', 2: '느림', 3: '느림', 4: '보통', 5: '보통', 6: '보통', 7: '빠름', 8: '빠름', 9: '매우 빠름', 10: '매우 빠름' };
  $('frequencyVal').textContent = labels[v] || '보통';
}

function bindResetStats() {
  $('resetStatsBtn').addEventListener('click', resetStats);
}

function resetStats() {
  state.stats = { totalServed: 0, totalFloorsTraveled: 0, totalWaitTime: 0, totalTravelTime: 0, currentWaiting: 0 };
  FLOORS.forEach(f => state.waitingPassengers[f] = []);
  state.elevator.passengers = [];
  state.elevator.internalCalls.clear();
  FLOORS.forEach(f => { state.hallCalls[f] = { up: false, down: false }; });
  state.callQueue = [];
  renderStats();
}

// ============================================================
//  11. 앱 시작
// ============================================================

function startApp() {
  initState();
  buildBuildingUI();
  buildPanelUI();
  bindEvents();
  updateFrequencyLabel();
  render();
  setInterval(tick, TICK_MS);
}

startApp();
