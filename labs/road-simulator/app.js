/* ===== 도로 시뮬레이터 – 탑다운, 점 & 선, 조작 없음 ===== */

/* ============================================================
   1. 데이터 모델 (Model)
   ============================================================ */

const LEADER_DETECT_DIST = 30;    // 선두 차량 감지 거리 (m)
const COLLISION_GAP = 10;         // 충돌 방지 간격 (m) — 이 거리 이내면 강제 감속
const LANE_CHANGE_COOLDOWN = 3;   // 차선 변경 후 쿨다운 (초)
const LANE_CHANGE_GAP = 15;       // 옆 차선 전후방 안전 거리 (m)
const MERGE_GAP = 7;              // 끼어들기 최소 간격 (m)
const MERGE_URGENCY_DIST = 50;    // 도로 끝까지 이 거리 이내면 끼어들기 허용 (m)
const LANE_CHANGE_SPEED = 3;      // 횡방향 이동 속도 (m/s)
let overtakeEnabled = true;       // 추월 기능 on/off

/** 차량 속도 설정 (km/h → m/s 변환용) */
const carSpeed = {
  min: 30,    // km/h
  max: 70,
  avg: 50,
  random() {
    const u1 = Math.random(), u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const spread = (this.max - this.min) / 4;
    const kmh = Math.max(this.min, Math.min(this.max, this.avg + z * spread));
    return kmh / 3.6;
  },
};

/** 차량 생성 팩토리 */
const CAR_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6'];

function createCar(lane, laneOffset, roadRef) {
  return {
    progress: 0,
    lane,                       // 현재 차선
    targetLane: lane,           // 목표 차선 (도착 시 필요한 차선)
    laneOffset,                 // 현재 횡방향 오프셋 (점진적 이동)
    laneOffsetTarget: laneOffset, // 목표 횡방향 오프셋
    x: 0,
    y: 0,
    velocity: (carSpeed.min + Math.random() * (carSpeed.max - carSpeed.min)) / 3.6,
    targetSpeed: carSpeed.random(),
    leader: null,
    road: roadRef,
    color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    changeCooldown: 0,          // 차선 변경 쿨다운 타이머

    physics: {
      accel: 14,
      brake: 22,
      maxSpeed: 45,
    },

    get speedKmh() {
      return Math.abs(this.velocity * 3.6);
    },

    /** 도로 경로를 따라 전진 */
    drive(dt) {
      const p = this.physics;

      // 쿨다운 감소
      if (this.changeCooldown > 0) this.changeCooldown -= dt;

      // 목표 속도: 선두 차량 유무에 따라
      let desiredSpeed = this.targetSpeed;
      if (this.leader) {
        if (this.leaderDist < COLLISION_GAP) {
          // 충돌 방지 간격 이내: 거리 비율에 따라 강제 감속
          const ratio = Math.max(0, this.leaderDist / COLLISION_GAP);
          desiredSpeed = this.leader.velocity * ratio;
        } else if (this.leader.velocity < this.velocity) {
          desiredSpeed = this.leader.velocity;
        }
      }

      // 가감속
      if (this.velocity < desiredSpeed) {
        this.velocity += p.accel * dt;
        if (this.velocity > desiredSpeed) this.velocity = desiredSpeed;
      } else if (this.velocity > desiredSpeed) {
        this.velocity -= p.brake * dt;
        if (this.velocity < desiredSpeed) this.velocity = desiredSpeed;
      }

      this.velocity = Math.max(0, Math.min(p.maxSpeed, this.velocity));

      // 경로 진행
      this.progress += this.velocity * dt;

      // 횡방향 오프셋 점진적 이동 (차선 변경 애니메이션)
      const diff = this.laneOffsetTarget - this.laneOffset;
      if (Math.abs(diff) > 0.05) {
        this.laneOffset += Math.sign(diff) * LANE_CHANGE_SPEED * dt;
        // 오버슈트 방지
        if (Math.sign(this.laneOffsetTarget - this.laneOffset) !== Math.sign(diff)) {
          this.laneOffset = this.laneOffsetTarget;
        }
      } else {
        this.laneOffset = this.laneOffsetTarget;
      }

      // 월드 좌표 갱신
      this.updateWorldPos();
    },

    /** progress → 월드 좌표 변환 */
    updateWorldPos() {
      const r = this.road;

      const dirX = r.end.x - r.start.x;
      const dirY = r.end.y - r.start.y;
      const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
      const ux = dirX / len;
      const uy = dirY / len;

      const nx = -uy;
      const ny = ux;

      this.x = r.start.x + ux * this.progress + nx * this.laneOffset;
      this.y = r.start.y + uy * this.progress + ny * this.laneOffset;
    },
  };
}

/** 도로 객체 – 차량 생성·제거·차선 변경 관리 */
const road = {
  length: 200,
  laneWidth: 3.5,
  lanes: 2,

  get width() {
    return this.laneWidth * this.lanes;
  },

  start: { x: 0, y: 0 },
  end:   { x: 0, y: 200 },

  spawnInterval: 2,
  spawnTimer: 0,
  removeThreshold: 10,
  maxCars: 50,

  cars: [],

  laneToOffset(lane) {
    return -(this.width / 2) + this.laneWidth / 2 + lane * this.laneWidth;
  },

  spawnCar() {
    const lane = Math.floor(Math.random() * this.lanes);
    const offset = this.laneToOffset(lane);
    const car = createCar(lane, offset, this);
    // 목표 차선: 랜덤 배정 (도착 시 필요한 차선)
    car.targetLane = Math.floor(Math.random() * this.lanes);
    car.updateWorldPos();
    this.cars.push(car);
  },

  setLength(len) {
    this.length = len;
    this.end.y = len;
    this.reset();
  },

  reset() {
    this.cars = [];
    this.spawnTimer = 0;
  },

  /** 매 프레임: 생성 → 선두 탐색 → 차선 변경 → 주행 → 제거 */
  manage(dt) {
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval && this.cars.length < this.maxCars) {
      this.spawnTimer -= this.spawnInterval;
      this.spawnCar();
    }

    this.findLeaders();
    this.processLaneChanges();

    for (const car of this.cars) {
      car.drive(dt);
    }

    this.cars = this.cars.filter(car => car.progress < this.length + this.removeThreshold);
  },

  /** 각 차량의 선두 차량(leader) 탐색 — 같은 차선만 */
  findLeaders() {
    for (const car of this.cars) {
      car.leader = null;
      car.leaderDist = Infinity;
      let closestDist = LEADER_DETECT_DIST;

      for (const other of this.cars) {
        if (other === car) continue;
        if (other.lane !== car.lane) continue;

        const ahead = other.progress - car.progress;
        if (ahead <= 0) continue;
        if (ahead >= closestDist) continue;

        closestDist = ahead;
        car.leader = other;
        car.leaderDist = ahead;
      }
    }
  },

  /** 차선 변경 처리 */
  processLaneChanges() {
    for (const car of this.cars) {
      if (car.changeCooldown > 0) continue;

      // 변경 동기 1: 목표 차선이 현재 차선과 다름
      const needTargetLane = car.lane !== car.targetLane;

      // 변경 동기 2: 앞차가 느려서 추월 필요 (추월 기능 ON일 때만)
      const blockedByLeader = overtakeEnabled && car.leader &&
        car.leader.velocity < car.targetSpeed * 0.7;

      if (!needTargetLane && !blockedByLeader) continue;

      // 변경 방향 결정
      let desiredLane;
      if (needTargetLane) {
        // 목표 차선 방향으로 1칸 이동
        desiredLane = car.lane + (car.targetLane > car.lane ? 1 : -1);
      } else {
        // 추월: 인접 차선 중 가능한 쪽
        if (car.lane > 0) desiredLane = car.lane - 1;
        else if (car.lane < this.lanes - 1) desiredLane = car.lane + 1;
        else continue;
      }

      // 범위 확인
      if (desiredLane < 0 || desiredLane >= this.lanes) continue;

      // 안전 확인: 잔여 거리에 따라 간격 기준 조정
      const remaining = this.length - car.progress;
      const urgent = needTargetLane && remaining < MERGE_URGENCY_DIST;
      const requiredGap = urgent ? MERGE_GAP : LANE_CHANGE_GAP;

      if (!this.isLaneSafe(car, desiredLane, requiredGap)) continue;

      // 차선 변경 실행
      car.lane = desiredLane;
      car.laneOffsetTarget = this.laneToOffset(desiredLane);
      car.changeCooldown = LANE_CHANGE_COOLDOWN;
    }
  },

  /** 특정 차선이 안전한지 확인 (전후방 gap 이내 차량 없음) */
  isLaneSafe(car, targetLane, gap) {
    for (const other of this.cars) {
      if (other === car) continue;
      if (other.lane !== targetLane) continue;

      const dist = Math.abs(other.progress - car.progress);
      if (dist < gap) return false;
    }
    return true;
  },
};

/* ============================================================
   2. 표기 설정 (View Config)
   ============================================================ */

const view = {
  road: {},

  car: {
    width: 2,
    height: 4,
  },
};

/* ============================================================
   3. 렌더링 (Render)
   ============================================================ */

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const speedEl = document.getElementById('speedDisplay');

function resize() {
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
}
window.addEventListener('resize', resize);
resize();

function getCamera() {
  const w = canvas.width;
  const h = canvas.height;
  const padRatio = 0.05;
  const usableW = w * (1 - padRatio * 2);
  const usableH = h * (1 - padRatio * 2);

  const roadWorldW = road.width * 3;
  const roadWorldH = road.length;

  const scale = Math.min(usableW / roadWorldW, usableH / roadWorldH);
  const cx = (road.start.x + road.end.x) / 2;
  const cy = (road.start.y + road.end.y) / 2;

  return { scale, cx, cy };
}

function render() {
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const cam = getCamera();

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(cam.scale, cam.scale);
  ctx.translate(-cam.cx, -cam.cy);

  drawRoad();

  for (const car of road.cars) {
    drawCar(car);
  }

  ctx.restore();

  speedEl.textContent = road.cars.length + ' 대';
}

function drawRoad() {
  const halfW = road.width / 2;
  const sx = road.start.x, sy = road.start.y;
  const ex = road.end.x, ey = road.end.y;

  // 가장자리선
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 0.3;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx + side * halfW, sy);
    ctx.lineTo(ex + side * halfW, ey);
    ctx.stroke();
  }

  // 차선 구분선
  for (let i = 1; i < road.lanes; i++) {
    const offset = -halfW + i * road.laneWidth;
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 0.15;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(sx + offset, sy);
    ctx.lineTo(ex + offset, ey);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawCar(car) {
  const v = view.car;
  const r = car.road;

  const dirX = r.end.x - r.start.x;
  const dirY = r.end.y - r.start.y;
  const angle = Math.atan2(dirX, dirY);

  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(-angle);
  ctx.fillStyle = car.color;
  ctx.fillRect(-v.width / 2, -v.height / 2, v.width, v.height);
  ctx.restore();
}

/* ============================================================
   4. 패널 바인딩
   ============================================================ */

const $ = id => document.getElementById(id);

function bindSlider(id, valId, onChange) {
  const slider = $(id);
  const valEl = $(valId);
  slider.addEventListener('input', () => {
    const v = parseFloat(slider.value);
    valEl.textContent = Number.isInteger(v) ? v : v.toFixed(1);
    onChange(v);
  });
}

bindSlider('sliderRoadLen', 'valRoadLen', v => road.setLength(v));
bindSlider('sliderMinSpd', 'valMinSpd', v => { carSpeed.min = v; });
bindSlider('sliderMaxSpd', 'valMaxSpd', v => { carSpeed.max = v; });
bindSlider('sliderAvgSpd', 'valAvgSpd', v => { carSpeed.avg = v; });
bindSlider('sliderInterval', 'valInterval', v => { road.spawnInterval = v; });
bindSlider('sliderMaxCars', 'valMaxCars', v => { road.maxCars = v; });

const toggleBtn = $('toggleOvertake');
toggleBtn.addEventListener('click', () => {
  overtakeEnabled = !overtakeEnabled;
  toggleBtn.textContent = overtakeEnabled ? 'ON' : 'OFF';
  toggleBtn.classList.toggle('active', overtakeEnabled);
});

/* ============================================================
   5. 루프
   ============================================================ */

let prev = performance.now();

function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();
  const dt = Math.min((now - prev) / 1000, 0.05);
  prev = now;

  road.manage(dt);
  render();
}

loop();
