import { animate } from 'motion';
import mapSvg from 'border-map';
import { STATES, coast } from './data.js';
import { createArena } from './arena.js';
import { createAudio } from './audio.js';
import {
  newGame,
  canAdd,
  backtrack,
  addCard,
  penalizeInvalidCard,
  isComplete,
  score,
  pointsFor,
  findSolution,
  getHint,
} from './game.js';
import { loadSave, writeSave, recordResult } from './storage.js';
import './style.css';
import './arena.css';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let storage;
try {
  storage = window.localStorage;
} catch {
  /* Play in memory when storage is blocked. */
}
let save = loadSave(storage);
let game = save.game ?? newGame();
let pendingAction;
let previousFocus;
let resultTimeout;
let confettiFrame;
let hint = null;
let solutionWorker;
let solutionCache;
const mapCenters = {};
const audio = createAudio({ enabled: save.soundEnabled });
document.addEventListener('pointerdown', () => audio.unlock(), { once: true });
document.addEventListener('keydown', () => audio.unlock(), { once: true });

function renderSound() {
  $('#sound-button').textContent = save.soundEnabled ? 'Sound on' : 'Sound off';
  $('#sound-button').setAttribute('aria-pressed', String(save.soundEnabled));
  $('#sound-button').setAttribute(
    'aria-label',
    save.soundEnabled ? 'Sound on, click to mute' : 'Sound off, click to enable',
  );
}
$('#sound-button').addEventListener('click', () => {
  save = { ...save, soundEnabled: !save.soundEnabled };
  audio.setEnabled(save.soundEnabled);
  renderSound();
  persist();
  if (save.soundEnabled) audio.play('place');
});
renderSound();

$('#map').innerHTML = mapSvg;
// Also strip labels from an already-running dev server's older virtual SVG.
$$('.map-state text, .map-state title').forEach((label) => label.remove());
$$('.map-state').forEach((group) => {
  const box = group.querySelector('path').getBBox();
  const code = group.dataset.code;
  // A few multi-part states need a more natural label/route anchor.
  const adjustments = {
    MI: [680, 174],
    FL: [810, 474],
    MA: [944, 138],
    RI: [953, 157],
    CT: [926, 166],
    DE: [906, 230],
  };
  const [x, y] = adjustments[code] ?? [box.x + box.width / 2, box.y + box.height / 2];
  mapCenters[code] = [x, y];
});
const arena = createArena({ map: $('#map'), centers: mapCenters, onPlay: play, reducedMotion });

function persist() {
  save = { ...save, game };
  $('#storage-warning').hidden = writeSave(storage, save);
}

function message(text, error = false) {
  $('#message').textContent = text;
  $('.message-wrap').hidden = !text;
  $('.message-wrap').classList.toggle('error', error);
}

function openDialog(id) {
  const dialog = $(id);
  if (dialog.open) return;
  previousFocus = document.activeElement;
  $$('dialog[open]').forEach((other) => other.close());
  dialog.showModal();
  if (!reducedMotion.matches)
    animate(dialog, { opacity: [0, 1], y: [16, 0], scale: [0.98, 1] }, { duration: 0.25 });
}

$$('[data-close]').forEach((button) =>
  button.addEventListener('click', () => button.closest('dialog').close()),
);
$$('dialog').forEach((dialog) => {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        dialog.close();
    }
  });
  dialog.addEventListener('close', () => previousFocus?.focus());
});
$('#help-button').addEventListener('click', () => openDialog('#help-dialog'));
const portraitPhone = window.matchMedia(
  '(pointer: coarse) and (max-width: 650px) and (orientation: portrait)',
);
function syncOrientation() {
  $$('.site-header, main, dialog').forEach((element) => {
    element.inert = portraitPhone.matches;
  });
}
portraitPhone.addEventListener('change', syncOrientation);
syncOrientation();

function confirmAction(action, title, copy, label) {
  pendingAction = action;
  $('#confirm-title').textContent = title;
  $('#confirm-copy').textContent = copy;
  $('#confirm-action').textContent = label;
  openDialog('#confirm-dialog');
}
$('#confirm-action').addEventListener('click', () => {
  $('#confirm-dialog').close();
  pendingAction?.();
  pendingAction = null;
});

function fresh() {
  clearTimeout(resultTimeout);
  solutionWorker?.terminate();
  solutionWorker = null;
  solutionCache = null;
  hint = null;
  game = newGame();
  persist();
  render(true);
  audio.play('deal');
  message('');
}

function requestNew() {
  if (game.status === 'playing' && game.route.length) {
    confirmAction(() => fresh(), 'New game?', 'Replace the current game?', 'New game');
  } else fresh();
}
$('#new-game').addEventListener('click', () => requestNew());
$('#play-again').addEventListener('click', () => {
  $('#result-dialog').close();
  fresh();
});

function play(code) {
  if (['won', 'lost'].includes(game.status)) return;
  if (game.route.includes(code)) {
    hint = null;
    audio.play('undo');
    game = { ...game, route: backtrack(game.route, code) };
    persist();
    render();
    message(game.hintPending ? 'Next card: 0 points.' : '');
    return;
  }
  if (!canAdd(game.deal, game.route, code)) {
    game = penalizeInvalidCard(game, code);
    persist();
    render();
    const last = game.route.at(-1);
    const text = !last
      ? 'Choose a coastal card.'
      : `${STATES[code].name} doesn’t border ${STATES[last].name}.`;
    message(`${text} −${STATES[code].points} pts`, true);
    audio.play('invalid');
    const card = $(`[data-card="${code}"]`);
    if (card && !reducedMotion.matches) animate(card, { x: [0, -5, 5, -3, 0] }, { duration: 0.28 });
    return;
  }
  const sourceCard = $(`[data-card="${code}"]`);
  const source = { rect: sourceCard.getBoundingClientRect(), node: sourceCard.cloneNode(true) };
  hint = null;
  game = addCard(game, code);
  persist();
  render(false, { code, source });
  audio.play('place', game.route.length);
  if (!reducedMotion.matches)
    animate($('#score'), { scale: [1, 1.25, 1], rotate: [0, -4, 0] }, { duration: 0.4 });
  if (isComplete(game.deal, game.route)) {
    arena.complete();
    finish(false, true);
  } else {
    message('');
  }
}

function finish(forceLoss = false, delayed = false) {
  if (game.status !== 'playing') return;
  const won = !forceLoss && isComplete(game.deal, game.route);
  game = { ...game, status: won ? 'won' : 'lost' };
  save = recordResult(save, game);
  persist();
  render();
  if (delayed) {
    const gameId = game.id;
    resultTimeout = setTimeout(() => {
      if (game.id === gameId) showResult();
    }, 750);
  } else showResult();
  audio.play(won ? 'win' : 'loss');
  if (won) celebrate();
}

$('#end-game').addEventListener('click', () => {
  if (['won', 'lost'].includes(game.status)) showResult();
  else
    confirmAction(() => finish(true), 'End game?', 'End the game and show solutions?', 'End game');
});
$('#hint-button').addEventListener('click', () => {
  if (['won', 'lost'].includes(game.status)) return;
  hint = getHint(game.deal, game.route);
  if (!hint || hint.type === 'complete') {
    message(hint ? 'Route complete.' : 'No hint available.');
    return;
  }
  game = { ...game, hintPending: true };
  persist();
  render();
  const name = STATES[hint.code].name;
  message(
    hint.type === 'undo'
      ? `Remove ${name} and following cards. Next added card: 0 points.`
      : `Play ${name}. Next card: 0 points.`,
  );
  const card = $(`[data-card="${hint.code}"]`);
  card.scrollIntoView({ block: 'nearest', behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  card.focus({ preventScroll: true });
});

function render(dealAnimation = false, arrival) {
  const ended = ['won', 'lost'].includes(game.status);
  $('.game-shell').classList.toggle('trip-ended', ended);
  $('#score').innerHTML =
    `${score(game.route, game.zeroCards, game.mistakePoints)} <small>pts</small>`;
  $('#hint-cost').hidden = !game.hintPending || ended;
  const focusCode = document.activeElement?.dataset.card;
  $('#cards').innerHTML = game.deal
    .map((code) => {
      const state = STATES[code];
      const placed = game.route.includes(code);
      const value = game.hintPending && !placed ? 0 : pointsFor(code, game.zeroCards);
      return `<button class="state-card ${coast(code) ? 'coastal' : ''} ${placed ? 'placed' : ''} ${hint?.code === code ? 'hinted' : ''}" data-card="${code}" aria-label="${state.name}, ${value} points${coast(code) ? `, ${coast(code)} coast` : ''}${placed ? ', click to undo' : ''}${hint?.code === code ? ', hint' : ''}" aria-pressed="${placed}" ${ended ? 'disabled' : ''}><span class="card-top"><span>${coast(code) ? 'COAST' : ''}</span><span class="card-points">${value}<small> PT${value > 1 ? 'S' : ''}</small></span></span><strong>${code}</strong><span class="card-name">${state.name}</span><span class="card-check" aria-hidden="true">✓</span></button>`;
    })
    .join('');
  $$('[data-card]').forEach((button) =>
    button.addEventListener('click', () => play(button.dataset.card)),
  );
  if (focusCode) $(`[data-card="${focusCode}"]`)?.focus({ preventScroll: true });
  $('#hint-button').disabled = ended;
  arena.sync(game.route, ended, arrival, game.zeroCards);
  $('#end-game').textContent = ended ? 'Results' : 'End game';
  if (dealAnimation) arena.deal();
}

function showResult() {
  clearTimeout(resultTimeout);
  const won = game.status === 'won';
  $('#result-title').textContent = won ? 'You win' : 'Game over';
  $('#result-route').hidden = false;
  $('#result-route').innerHTML = solutionCards(game.route, 'Your route', game.mistakePoints);
  showSolutions();
  message(won ? 'You win.' : 'Game over.');
  openDialog('#result-dialog');
}

function solutionCards(path, label, mistakePoints = 0) {
  return `<section class="solution-section"><h3>${label} <span>${score(path, game.zeroCards, mistakePoints)} pts</span></h3><ol class="solution-chain" aria-label="${label}">${path.map((code) => `<li><div class="solution-card" data-solution-code="${code}" aria-label="${STATES[code].name}">${code}</div></li>`).join('')}</ol></section>`;
}

function showSolutions() {
  const shortest = findSolution(game.deal);
  if (!shortest) {
    $('#solutions').textContent = 'No solution.';
    return;
  }
  if (solutionCache?.gameId === game.id) {
    const longest = solutionCache.longest;
    $('#solutions').innerHTML =
      longest && longest.length === shortest.length
        ? solutionCards(shortest, 'Solution')
        : solutionCards(shortest, 'Shortest') +
          (longest
            ? solutionCards(longest, 'Longest')
            : '<p class="fine-print">Longest route unavailable.</p>');
    return;
  }
  $('#solutions').innerHTML =
    solutionCards(shortest, 'Shortest') +
    '<p class="fine-print" role="status">Finding longest route…</p>';
  if (solutionWorker) return;
  const gameId = game.id;
  try {
    const worker = new Worker(new URL('./solution-worker.js', document.baseURI), {
      type: 'module',
    });
    solutionWorker = worker;
    worker.onmessage = ({ data }) => {
      if (game.id !== gameId || solutionWorker !== worker) return;
      solutionCache = { gameId, longest: data.longest };
      worker.terminate();
      solutionWorker = null;
      showSolutions();
    };
    worker.onerror = () => {
      if (game.id !== gameId || solutionWorker !== worker) return;
      solutionCache = { gameId, longest: null };
      worker.terminate();
      solutionWorker = null;
      showSolutions();
    };
    worker.postMessage({ gameId, deal: game.deal });
  } catch {
    solutionCache = { gameId, longest: null };
    solutionWorker = null;
    showSolutions();
  }
}

function showScores() {
  $('#record-summary').textContent = save.played
    ? `${save.wins} wins · ${save.played} game${save.played === 1 ? '' : 's'}`
    : 'No games yet.';
  const records = save.records;
  $('#record-list').innerHTML =
    `<section class="record-section">${records.length ? `<table><caption class="sr-only">Personal bests</caption><thead><tr><th>GAME</th><th>POINTS</th></tr></thead><tbody>${records.map((r, i) => `<tr><td>${String(i + 1).padStart(2, '0')}</td><td>${r.points} pts</td></tr>`).join('')}</tbody></table>` : '<p class="fine-print">No scores yet.</p>'}</section>`;
  openDialog('#records-dialog');
}
$('#records-button').addEventListener('click', showScores);

$('#clear-scores').addEventListener('click', () =>
  confirmAction(
    () => {
      save = { ...save, records: [], wins: 0, played: 0 };
      persist();
      showScores();
    },
    'Clear scores?',
    'Remove all scores and game counts?',
    'Clear',
  ),
);

// No network calls. Another tab's save never silently replaces the live route.
window.addEventListener('storage', (event) => {
  if (event.key === 'border-race:v2')
    message('Another tab changed the saved game. Reload to use it.');
});

function celebrate() {
  if (reducedMotion.matches) return;
  cancelAnimationFrame(confettiFrame);
  const canvas = $('#confetti');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);
  const pieces = Array.from({ length: 110 }, () => ({
    x: width / 2,
    y: height * 0.45,
    vx: (Math.random() - 0.5) * width * 0.8,
    vy: -200 - Math.random() * 480,
    rotate: Math.random() * 6,
    color: ['#9df375', '#68e9ef', '#a995ff', '#ffc76a'][Math.floor(Math.random() * 4)],
  }));
  const start = performance.now();
  const frame = (now) => {
    const t = (now - start) / 1000;
    ctx.clearRect(0, 0, width, height);
    if (t > 3.5) return;
    ctx.globalAlpha = Math.min(1, 3.5 - t);
    pieces.forEach((p) => {
      ctx.save();
      ctx.translate(p.x + p.vx * t, p.y + p.vy * t + 260 * t * t);
      ctx.rotate(p.rotate + t * 4);
      ctx.fillStyle = p.color;
      ctx.fillRect(-4, -3, 8, 6);
      ctx.restore();
    });
    confettiFrame = requestAnimationFrame(frame);
  };
  confettiFrame = requestAnimationFrame(frame);
}

persist();
render(true);
if (['won', 'lost'].includes(game.status)) showResult();
else if (isComplete(game.deal, game.route)) finish();
