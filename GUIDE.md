# Handshake Games — 프로젝트 가이드

## 개요

서버 없이 `file://` 프로토콜로 직접 실행되는 바닐라 JS 미니게임 컬렉션.
빌드 도구, 프레임워크, npm 패키지 없음. 순수 HTML/CSS/JS.

---

## 디렉토리 구조

```
handshake/
├── public/
│   ├── index.html     # 메인 로비 (게임 선택 화면)
│   ├── main.js        # 게임 목록 렌더링 + localStorage Score 모듈
│   ├── nav.js         # 공통 네비게이션 컴포넌트 (각 게임이 인클루드)
│   └── style.css      # 로비 전용 스타일
└── games/
    ├── tetris/
    │   ├── index.html
    │   ├── game.js
    │   └── style.css
    ├── minesweeper/
    │   ├── index.html
    │   ├── game.js
    │   └── style.css
    └── 2048/
        ├── index.html
        ├── game.js
        └── style.css
```

---

## 공통 아키텍처

### 실행 방식

브라우저에서 `public/index.html`을 직접 열어 실행 (`file://` 프로토콜).
각 게임 카드를 클릭하면 상대 경로(`../games/{game}/index.html`)로 이동.

### 레이아웃 제약

전역 `max-width: 1280px`, 좌우 `margin: auto`. `public/style.css` 및 `public/nav.js`에서 각각 적용.

### CSS 디자인 시스템

모든 파일이 공유하는 CSS 변수 (각 게임 `style.css`에 `:root` 블록으로 선언):

| 변수 | 값 | 역할 |
|---|---|---|
| `--bg` | `#0f1117` | 페이지 배경 |
| `--surface` | `#1a1d27` | 카드/패널 배경 |
| `--surface2` | `#22263a` | hover 상태 배경 |
| `--border` | `#2e3350` | 테두리 색 |
| `--accent` | `#6c63ff` | 강조색 (보라) |
| `--text` | `#e8eaf6` | 기본 텍스트 |
| `--text-muted` | `#7986cb` | 보조 텍스트 |
| `--radius` | `12px` (로비: `16px`) | 모서리 반경 |

### 오버레이 패턴

게임 종료/승리 시 `.overlay` 요소에 `.show` 클래스를 추가해 표시.
`display: none` → `display: flex` 전환. 모든 게임에 동일하게 적용.

```css
.overlay { display: none; position: absolute; inset: 0; }
.overlay.show { display: flex; }
```

---

## public/nav.js — 공통 네비게이션

각 게임의 `<head>`에서 인클루드:

```html
<script src="../../public/nav.js"></script>
```

`DOMContentLoaded` 이벤트에서 두 가지를 자동 주입:

1. **스타일**: `body`에 `max-width: 1280px` + 뒤로가기 버튼(`.back-btn`) 스타일
2. **nav 엘리먼트**: `document.body` 최상단에 `<nav class="site-nav">` 삽입, "홈으로" 링크(`../../public/index.html`) 포함

---

## public/main.js — 로비 로직

### Score 모듈

localStorage 접근을 추상화한 객체:

```js
const Score = {
  get(gameId)        // localStorage.getItem(`hs_${gameId}_best`)
  set(gameId, value) // localStorage.setItem(`hs_${gameId}_best`, value)
  clear(gameId)      // localStorage.removeItem(`hs_${gameId}_best`)
}
```

키 형식: `hs_{gameId}_best`

### GAMES 목록

```js
const GAMES = [
  { id: 'tetris',      name: 'Tetris',      icon: '🟦', path: '../games/tetris/index.html' },
  { id: 'minesweeper', name: 'Minesweeper', icon: '💣', path: '../games/minesweeper/index.html' },
  { id: '2048',        name: '2048',        icon: '🔢', path: '../games/2048/index.html' },
];
```

새 게임 추가 시 이 배열에 항목 추가만 하면 카드가 자동 렌더링됨.

### renderCards()

`GAMES` 배열을 순회하며 `#game-grid`에 `<a class="game-card">` 요소를 동적 생성.

---

## games/tetris/

### 게임 방법

10×20 그리드에서 7종 테트로미노를 쌓아 가로 줄을 완성해 제거. 블록이 천장에 닿으면 게임 오버.

### 조작

| 키 | 동작 |
|---|---|
| `←` / `→` | 좌우 이동 |
| `↑` | 회전 |
| `↓` | 소프트 드롭 (1칸씩 + 1점) |
| `Space` | 하드 드롭 (즉시 낙하, 낙하 거리 × 2점) |
| `C` | 홀드 (현재 블록 보관, 게임당 한 번) |
| `P` | 일시정지 / 재개 |

### 점수 시스템

라인 동시 제거 보너스 × 현재 레벨:

| 동시 제거 | 기본 점수 |
|---|---|
| 1줄 | 100 |
| 2줄 | 300 |
| 3줄 | 500 |
| 4줄 (테트리스) | 800 |

레벨: 10줄 제거마다 1 상승 (`Math.floor(lines / 10) + 1`).
낙하 속도: 레벨 1 → 800ms, 레벨 10 → 100ms (`DROP_SPEEDS` 배열).

### 주요 구현

- **Canvas 렌더링**: `#board` 캔버스(10×20)와 `#next-canvas`, `#hold-canvas`(각 96×96px) 3개 사용
- **셀 크기**: `Math.floor(Math.min(30, (window.innerWidth - 168) / COLS))`로 화면 폭에 맞게 동적 계산
- **고스트 피스**: `getGhostY()`로 낙하 위치 계산, 투명도 0.25로 렌더링
- **회전**: `shape[0].map((_, c) => shape.map(r => r[c]).reverse())` — 단순 행렬 전치+반전
- **월 킥**: 회전 후 충돌 시 ±1칸 보정 시도
- **게임 루프**: `requestAnimationFrame` + 경과 시간 누적 방식

### localStorage

| 키 | 값 |
|---|---|
| `hs_tetris_best` | 최고 점수 (정수) |

---

## games/minesweeper/

### 게임 방법

격자에서 지뢰를 피해 모든 안전한 칸을 열면 승리. 숫자는 인접한 8칸의 지뢰 수를 나타냄.
첫 클릭은 항상 안전 (클릭 후 지뢰 배치, 3×3 안전 구역 보장).

### 조작

| 입력 | 동작 |
|---|---|
| 좌클릭 (닫힌 칸) | 칸 열기 |
| 좌클릭 (열린 숫자 칸) | 코드 — 주변 깃발 수가 숫자와 같으면 나머지 칸 자동 열기 |
| 우클릭 | 깃발 토글 |

### 난이도

| 난이도 | 크기 | 지뢰 수 |
|---|---|---|
| 초급 (beginner) | 9×9 | 10 |
| 중급 (intermediate) | 16×16 | 40 |
| 고급 (expert) | 16×30 | 99 |

### 점수 시스템

점수 없음. 클리어 시간(초)을 최고기록으로 저장. 낮을수록 우수.

### 주요 구현

- **지뢰 배치**: 첫 클릭 좌표 기준 3×3 구역 제외 후 랜덤 배치 (`placeMines(safeR, safeC)`)
- **빈 칸 자동 확장**: `count === 0`인 칸 열릴 때 8방향 이웃을 재귀적으로 `openCell()` 호출
- **코드(Chord)**: 열린 숫자 칸 재클릭 시, 주변 깃발 수 = 숫자이면 미표시 칸 일괄 오픈
- **게임 상태**: `idle` → `playing` → `won` / `lost`
- **타이머**: `setInterval` 500ms 간격, `Date.now()` 기준 초 단위 계산
- **셀 크기**: CSS `clamp(24px, 7vw, 32px)`로 반응형 처리
- **숫자 색상**: 1~8번 숫자를 `data-n` 속성 + CSS attribute selector로 색상 구분

### localStorage

| 키 | 값 |
|---|---|
| `hs_minesweeper_best_beginner` | 초급 최고 클리어 시간 (초, 정수) |
| `hs_minesweeper_best_intermediate` | 중급 최고 클리어 시간 (초, 정수) |
| `hs_minesweeper_best_expert` | 고급 최고 클리어 시간 (초, 정수) |

---

## games/2048/

### 게임 방법

4×4 격자에서 타일을 밀어 같은 숫자끼리 합쳐 2048 타일을 만들면 승리.
이동 후 빈 칸에 새 타일(2: 90%, 4: 10%) 하나가 추가됨.
합칠 수 있는 이동이 없으면 게임 오버.

### 조작

| 입력 | 동작 |
|---|---|
| `←↑↓→` / `WASD` | 타일 이동 |
| 스와이프 (터치) | 타일 이동 (20px 이상 드래그) |

### 점수 시스템

타일 합산 시 합산된 값이 점수에 추가. (예: 128+128 → +256점).
최고 점수는 세션 간 유지.

2048 달성 후 "계속 플레이" 선택 가능 (`keepPlaying` 플래그).

### 주요 구현

- **슬라이드 알고리즘**: 4방향 모두 "왼쪽으로 밀기"로 변환 후 처리
  - `rotateForDir(grid, dir)`: 방향에 따라 그리드를 transpose/reverse 변환
  - `slideLine(line)`: 한 행을 왼쪽으로 밀어 병합, 변경 인덱스 반환
  - `unrotateGrid(g, dir)` / `unrotateCoord(r, c, dir)`: 결과를 원래 좌표계로 복원
- **타일 애니메이션**: CSS `@keyframes pop` (새 타일), `@keyframes merge-pop` (병합) — 0.15s
- **타일 색상**: CSS 변수 `--tile-{값}`, `--tile-{값}-text`로 2~2048 각각 지정, `data-val` attribute selector 적용
- **보드 빌드**: `buildBoard()`가 최초 1회 DOM 생성, 이후 `render()`가 `data-val`만 갱신

### localStorage

| 키 | 값 |
|---|---|
| `hs_2048_best` | 최고 점수 (정수) |

---

## 새 게임 추가 방법

1. `games/{game_name}/` 디렉토리 생성
2. `index.html`, `game.js`, `style.css` 작성
3. `index.html` `<head>`에 nav.js 인클루드:
   ```html
   <script src="../../public/nav.js"></script>
   ```
4. `public/main.js`의 `GAMES` 배열에 항목 추가:
   ```js
   { id: '{game_name}', name: '표시 이름', icon: '이모지', path: '../games/{game_name}/index.html' }
   ```
5. localStorage 키는 `hs_{game_name}_best` 형식 사용 권장

---

## 알려진 제약

- `file://` 프로토콜 특성상 CORS 제한 없음 (외부 리소스 불러오기 시 주의)
- 서버 기반 기능(세션, 멀티플레이어, 리더보드 API) 사용 불가
- 각 게임 `style.css`에 CSS 변수가 개별 선언되어 있어 공유 디자인 토큰 변경 시 모든 파일을 수동 동기화해야 함
