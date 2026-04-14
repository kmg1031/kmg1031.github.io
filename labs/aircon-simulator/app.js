// === State ===
const state = {
  power: false,
  mode: 'cool',       // cool, heat, fan, auto
  fanSpeed: 2,         // 1-4
  targetTemp: 24,
  roomTemp: 28.0,
  roomHumidity: 60,
  outdoorTemp: 33,
  outdoorHumidity: 70,
  insulation: 5,       // 1-10 (higher = better)
  watt: 0,
  totalEnergy: 0,      // Wh
  runSeconds: 0,
  compressorOn: false,
};

// === DOM ===
const $ = id => document.getElementById(id);
const powerBtn = $('powerBtn');
const led = $('led');
const roomTempEl = $('roomTemp');
const roomHumEl = $('roomHumidity');
const targetTempEl = $('targetTemp');
const controlsGroup = $('controlsGroup');
const windContainer = $('windContainer');
const infoWatt = $('infoWatt');
const infoCost = $('infoCost');
const infoTime = $('infoTime');

// === Power ===
powerBtn.addEventListener('click', () => {
  state.power = !state.power;
  powerBtn.classList.toggle('on', state.power);
  led.classList.toggle('on', state.power);
  controlsGroup.classList.toggle('disabled', !state.power);
  if (!state.power) {
    state.watt = 0;
    state.compressorOn = false;
    clearWind();
  }
});

// === Target Temp ===
$('tempUp').addEventListener('click', () => {
  if (state.targetTemp < 30) {
    state.targetTemp++;
    targetTempEl.textContent = state.targetTemp;
  }
});
$('tempDown').addEventListener('click', () => {
  if (state.targetTemp > 16) {
    state.targetTemp--;
    targetTempEl.textContent = state.targetTemp;
  }
});

// === Mode ===
document.querySelectorAll('#modeRow .option-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#modeRow .option-btn').forEach(b => {
      b.classList.remove('active', 'cool', 'heat', 'fan', 'auto');
    });
    const mode = btn.dataset.mode;
    btn.classList.add('active', mode);
    state.mode = mode;
  });
});

// === Fan Speed ===
document.querySelectorAll('#fanRow .option-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#fanRow .option-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.fanSpeed = parseInt(btn.dataset.fan);
  });
});

// === Outdoor Sliders ===
$('outdoorTempSlider').addEventListener('input', e => {
  state.outdoorTemp = parseInt(e.target.value);
  $('outdoorTempVal').textContent = state.outdoorTemp + '\u00B0C';
});
$('outdoorHumSlider').addEventListener('input', e => {
  state.outdoorHumidity = parseInt(e.target.value);
  $('outdoorHumVal').textContent = state.outdoorHumidity + '%';
});
$('insulationSlider').addEventListener('input', e => {
  state.insulation = parseInt(e.target.value);
  $('insulationVal').textContent = state.insulation;
});

// === Wind Particles ===
function clearWind() {
  windContainer.innerHTML = '';
}

function updateWind() {
  clearWind();
  if (!state.power || !state.compressorOn) return;

  const count = state.fanSpeed * 4;
  const color = state.mode === 'heat' ? 'rgba(255,87,34,0.4)' :
                state.mode === 'fan' ? 'rgba(255,255,255,0.2)' :
                'rgba(0,188,212,0.4)';

  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'wind-particle';
    p.style.left = (Math.random() * 90 + 5) + '%';
    p.style.background = color;
    p.style.animationDelay = (Math.random() * 2) + 's';
    p.style.animationDuration = (1.5 + Math.random()) + 's';
    windContainer.appendChild(p);
  }
}

// === Simulation Loop (every 100ms, 1 sim-second = 100ms real) ===
const SIM_SPEED = 10; // 1 real second = 10 sim seconds
const TICK_MS = 100;

function getEffectiveMode() {
  if (state.mode !== 'auto') return state.mode;
  if (state.roomTemp > state.targetTemp + 0.5) return 'cool';
  if (state.roomTemp < state.targetTemp - 0.5) return 'heat';
  return 'fan';
}

function tick() {
  const dt = SIM_SPEED / (1000 / TICK_MS); // sim seconds per tick

  // Outdoor heat leak
  const leakRate = 0.002 * (11 - state.insulation);
  const tempDiff = state.outdoorTemp - state.roomTemp;
  state.roomTemp += tempDiff * leakRate * dt;

  // Humidity drift toward outdoor
  const humDiff = state.outdoorHumidity - state.roomHumidity;
  state.roomHumidity += humDiff * 0.0005 * (11 - state.insulation) * dt;

  if (state.power) {
    state.runSeconds += dt;
    const effective = getEffectiveMode();
    const fanMult = 0.5 + state.fanSpeed * 0.25; // 0.75 ~ 1.5

    if (effective === 'cool') {
      const diff = state.roomTemp - state.targetTemp;
      state.compressorOn = diff > -0.3;
      if (state.compressorOn) {
        state.roomTemp -= 0.04 * fanMult * dt;
        state.roomHumidity -= 0.02 * fanMult * dt;
        state.watt = Math.round(600 + state.fanSpeed * 200 + Math.max(0, diff) * 100);
      } else {
        state.watt = Math.round(30 + state.fanSpeed * 10);
      }
    } else if (effective === 'heat') {
      const diff = state.targetTemp - state.roomTemp;
      state.compressorOn = diff > -0.3;
      if (state.compressorOn) {
        state.roomTemp += 0.035 * fanMult * dt;
        state.watt = Math.round(800 + state.fanSpeed * 250 + Math.max(0, diff) * 120);
      } else {
        state.watt = Math.round(30 + state.fanSpeed * 10);
      }
    } else {
      // fan only
      state.compressorOn = true; // for wind animation
      state.watt = Math.round(20 + state.fanSpeed * 15);
    }

    // Accumulate energy (Wh)
    state.totalEnergy += state.watt * (dt / 3600);
  } else {
    state.watt = 0;
  }

  // Clamp
  state.roomTemp = Math.max(-5, Math.min(50, state.roomTemp));
  state.roomHumidity = Math.max(15, Math.min(95, state.roomHumidity));

  render();
}

let lastWindUpdate = 0;
function render() {
  // Room temp color
  const t = state.roomTemp;
  let tempColor = 'var(--text)';
  if (t < 18) tempColor = '#29b6f6';
  else if (t < 22) tempColor = '#4dd0e1';
  else if (t < 26) tempColor = 'var(--text)';
  else if (t < 30) tempColor = '#ffb74d';
  else tempColor = '#ef5350';

  roomTempEl.innerHTML = `${state.roomTemp.toFixed(1)}<span class="unit">\u00B0C</span>`;
  roomTempEl.style.color = tempColor;
  roomHumEl.textContent = `\uC2B5\uB3C4 ${Math.round(state.roomHumidity)}%`;

  // Info
  infoWatt.textContent = state.watt + ' W';
  // Korean electricity rate ~120 won/kWh average
  const cost = Math.round(state.totalEnergy / 1000 * 120);
  infoCost.textContent = cost.toLocaleString() + ' \uC6D0';
  const mins = Math.floor(state.runSeconds / 60);
  const secs = Math.floor(state.runSeconds % 60);
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  infoTime.textContent = hrs > 0 ? `${hrs}:${String(remMins).padStart(2,'0')}:${String(secs).padStart(2,'0')}` : `${mins}:${String(secs).padStart(2,'0')}`;

  // Wind (update every 2 seconds)
  const now = Date.now();
  if (now - lastWindUpdate > 2000) {
    updateWind();
    lastWindUpdate = now;
  }
}

// Initial state
controlsGroup.classList.add('disabled');
setInterval(tick, TICK_MS);
