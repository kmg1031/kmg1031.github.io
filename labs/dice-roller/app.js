const $ = id => document.getElementById(id);

const dice    = $('dice');
const rollBtn = $('rollBtn');
const result  = $('result');
const historyList = $('historyList');

/* Each value maps to the rotation that brings that face to the front */
const ROTATIONS = {
  1: { x:    0, y:    0 },
  2: { x:    0, y:  -90 },
  3: { x:  -90, y:    0 },
  4: { x:   90, y:    0 },
  5: { x:    0, y:   90 },
  6: { x:    0, y:  180 },
};

let rolling = false;
const history = [];

function roll() {
  if (rolling) return;
  rolling = true;
  rollBtn.disabled = true;
  result.textContent = '';

  /* Clear previous highlight */
  dice.querySelectorAll('.face').forEach(f => f.classList.remove('highlight'));

  const value = Math.floor(Math.random() * 6) + 1;
  const rot = ROTATIONS[value];

  /* Add extra full spins so the animation looks dynamic */
  const extraX = 360 * (3 + Math.floor(Math.random() * 3));
  const extraY = 360 * (3 + Math.floor(Math.random() * 3));

  /* Start spinning via keyframe */
  dice.style.transition = 'none';
  dice.classList.add('rolling');

  dice.addEventListener('animationend', function onEnd() {
    dice.removeEventListener('animationend', onEnd);
    dice.classList.remove('rolling');

    /* Snap to the target face */
    dice.style.transition = 'transform 0.5s cubic-bezier(.25,.8,.25,1)';
    dice.style.transform =
      `rotateX(${rot.x + extraX}deg) rotateY(${rot.y + extraY}deg)`;

    setTimeout(() => {
      result.textContent = `결과: ${value}`;
      dice.querySelector(`.face-${value}`).classList.add('highlight');

      /* Record history */
      history.unshift(value);
      renderHistory();

      rolling = false;
      rollBtn.disabled = false;
    }, 550);
  });
}

function renderHistory() {
  historyList.innerHTML = history
    .map(v => `<span class="history-item">${v}</span>`)
    .join('');
}

rollBtn.addEventListener('click', roll);
