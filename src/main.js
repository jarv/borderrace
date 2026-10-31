import { animate } from 'motion';
import mapSvg from 'border-map';
import { STATES, coast } from './data.js';
import { createArena } from './arena.js';
import { createAudio } from './audio.js';
import { createSweepView } from './sweep-view.js';
import { restoreSweep, accelerateSweep, PENALTY_ACCELERATION } from './sweep.js';
import {
  newGame,
  canAdd,
  backtrack,
  addCard,
  penalizeInvalidCard,
  isComplete,
  score,
  pointsFor,
  getHint,
  validGame,
} from './game.js';
import { SCORING_VERSION } from './scoring.js';
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
game = { ...game, sweep: restoreSweep(game) };
let previousFocus;
let resultTimeout;
let confettiFrame;
let hint = null;
let solutionWorker;
let solutionCache;
let scoringWorker = null;
let messageAnimation;
let messageRevision = 0;
const pendingPoints = new Map();

function renderScore() {
  for (const [code, pending] of pendingPoints) {
    if (!game.route.includes(code)) {
      clearTimeout(pending.timeout);
      pendingPoints.delete(code);
    }
  }
  const waiting = [...pendingPoints.values()].reduce((total, pending) => total + pending.points, 0);
  $('#score').innerHTML =
    `${score(game.route, game.zeroCards, game.mistakePoints, game.cardPoints) - waiting} <small>pts</small>`;
}

function waitForPoints(code) {
  if (reducedMotion.matches) return;
  const pending = { points: pointsFor(code, game.zeroCards, game.cardPoints) };
  const settle = () => {
    if (pendingPoints.get(code) !== pending) return;
    clearTimeout(pending.timeout);
    pendingPoints.delete(code);
    renderScore();
    if (!reducedMotion.matches)
      animate($('#score'), { scale: [1, 1.25, 1], rotate: [0, -4, 0] }, { duration: 0.4 });
  };
  // Never leave the visual total behind if an effect is interrupted or unavailable.
  pending.timeout = setTimeout(settle, 2500);
  pendingPoints.set(code, pending);
  return settle;
}

reducedMotion.addEventListener('change', () => {
  if (!reducedMotion.matches) return;
  for (const pending of pendingPoints.values()) clearTimeout(pending.timeout);
  pendingPoints.clear();
  renderScore();
});
const startMessage =
  'Select cards to cross the map. Start with a green coastal card. Gold cards are harder to use and worth 3 points.';
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
const arena = createArena({ map: $('#map'), onPlay: play, reducedMotion });
const sweepView = createSweepView({
  panel: $('.map-wrap'),
  map: $('#map'),
  getGame: () => game,
  setSweep: (sweep) => {
    game = { ...game, sweep };
  },
  persist,
  onTimeout: timeout,
});

function persist() {
  save = { ...save, game };
  $('#storage-warning').hidden = writeSave(storage, save);
}

function message(text, error = false) {
  const wrap = $('.message-wrap');
  const revision = ++messageRevision;
  messageAnimation?.stop();
  const update = () => {
    $('#message').textContent = text;
    wrap.hidden = !text;
    wrap.classList.toggle('error', error);
    wrap.style.removeProperty('opacity');
  };
  if (!text && !wrap.hidden && !reducedMotion.matches) {
    messageAnimation = animate(wrap, { opacity: 0 }, { duration: 0.3 });
    Promise.resolve(messageAnimation).then(() => {
      if (revision === messageRevision) update();
    });
  } else update();
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

function fresh() {
  for (const pending of pendingPoints.values()) clearTimeout(pending.timeout);
  pendingPoints.clear();
  clearTimeout(resultTimeout);
  solutionWorker?.terminate();
  solutionWorker = null;
  solutionCache = null;
  scoringWorker?.terminate();
  scoringWorker = null;
  hint = null;
  game = newGame();
  persist();
  render();
  prepareScoring(true);
}

function prepareScoring(dealAnimation = false) {
  const gameId = game.id;
  let worker = null;
  const complete = (cardPoints, deal) => {
    if (game.id !== gameId || scoringWorker !== worker) return;
    worker?.terminate();
    scoringWorker = null;
    const candidate = { ...game, deal, scoring: SCORING_VERSION, cardPoints };
    const exact = Boolean(cardPoints && validGame(candidate));
    game = exact
      ? candidate
      : {
          ...game,
          scoring: 'base-v1',
          cardPoints: Object.fromEntries(game.deal.map((code) => [code, 1])),
        };
    persist();
    render(dealAnimation);
    if (dealAnimation) audio.play('deal');
    message(exact ? startMessage : 'Bonus unavailable. All cards: 1 pt.');
  };
  message('Preparing cards…');
  try {
    worker = new Worker(new URL('./scoring-worker.js', document.baseURI), { type: 'module' });
    scoringWorker = worker;
    worker.onmessage = ({ data }) => {
      if (data.gameId === gameId) complete(data.cardPoints, data.deal);
    };
    worker.onerror = (event) => {
      event.preventDefault();
      complete(null);
    };
    worker.postMessage({ gameId, deal: game.deal });
  } catch {
    complete(null);
  }
}

$('#new-game').addEventListener('click', () => fresh());
$('#result-dialog').addEventListener('close', () => {
  if (game.status === 'won') fresh();
});
$('#play-again').addEventListener('click', () => {
  $('#result-dialog').close();
  fresh();
});

function play(code) {
  sweepView.checkpoint();
  if (game.cardPoints === null || ['won', 'lost'].includes(game.status)) return;
  if (game.route.includes(code)) {
    hint = null;
    audio.play('undo');
    game = { ...game, route: backtrack(game.route, code) };
    persist();
    render();
    message('');
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
    message(`${text} −${pointsFor(code, [], game.cardPoints)} pts`, true);
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
  render(false, { code, source, onScore: waitForPoints(code) });
  audio.play('place', game.route.length);
  if (isComplete(game.deal, game.route)) {
    arena.complete();
    finish(true);
  } else {
    message('');
  }
}

function finish(delayed = false) {
  if (game.status !== 'playing' || game.cardPoints === null || !isComplete(game.deal, game.route))
    return;
  game = { ...game, status: 'won' };
  save = recordResult(save, game);
  persist();
  render();
  if (delayed && !reducedMotion.matches) {
    const gameId = game.id;
    resultTimeout = setTimeout(() => {
      if (game.id === gameId) showResult();
    }, 2000);
  } else showResult();
  audio.play('win');
  celebrate();
}

function restartAfterTimeout() {
  clearTimeout(resultTimeout);
  const gameId = game.id;
  resultTimeout = setTimeout(() => {
    if (game.id === gameId && game.status === 'lost') fresh();
  }, 1000);
}

function timeout() {
  if (game.status !== 'playing') return;
  hint = null;
  game = { ...game, status: 'lost', lossReason: 'timeout' };
  save = recordResult(save, game);
  persist();
  $$('dialog[open]').forEach((dialog) => dialog.close());
  message('');
  render();
  audio.play('loss');
  $('#new-game').focus({ preventScroll: true });
  restartAfterTimeout();
}

$('#hint-button').addEventListener('click', () => {
  sweepView.checkpoint();
  if (game.cardPoints === null || ['won', 'lost'].includes(game.status)) return;
  hint = getHint(game.deal, game.route);
  if (!hint || hint.type === 'complete') {
    message(hint ? 'Route complete.' : 'No hint available.');
    return;
  }
  game = { ...game, hintPending: true, sweep: accelerateSweep(game.sweep, PENALTY_ACCELERATION) };
  persist();
  render();
  message(
    hint.type === 'undo' ? `Remove ${hint.code}, play ${hint.playCode}` : `Play ${hint.code}`,
  );
  const card = $(`[data-card="${hint.code}"]`);
  card.scrollIntoView({ block: 'nearest', behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  card.focus({ preventScroll: true });
});

function render(dealAnimation = false, arrival) {
  const ended = ['won', 'lost'].includes(game.status);
  const pending = game.cardPoints === null;
  const lost = game.status === 'lost';
  $('.game-shell').classList.toggle('trip-ended', ended);
  $('.game-shell').classList.toggle('loading', pending);
  $('#sweep-over').hidden = game.status !== 'lost';
  $('.board-layout').setAttribute('aria-busy', String(pending));
  renderScore();
  $('#hint-cost').hidden = !game.hintPending || ended;
  const focusCode = document.activeElement?.dataset.card;
  $('#cards').innerHTML = game.deal
    .map((code) => {
      const state = STATES[code];
      const placed = game.route.includes(code);
      const hard = game.cardPoints?.[code] === 3;
      const value = pending
        ? '…'
        : game.hintPending && !placed
          ? 0
          : pointsFor(code, game.zeroCards, game.cardPoints);
      return `<button class="state-card ${coast(code) ? 'coastal' : ''} ${hard ? 'hard' : ''} ${placed ? 'placed' : ''} ${hint?.code === code ? 'hinted' : ''}" data-card="${code}" aria-label="${state.name}, ${pending ? 'calculating points' : `${value} points`}${hard ? ', hard card' : ''}${coast(code) ? `, ${coast(code)} coast` : ''}${placed ? ', click to undo' : ''}${hint?.code === code ? ', hint' : ''}" aria-pressed="${placed}" ${ended || pending ? 'disabled' : ''}><span class="card-top"><span>${coast(code) ? 'COAST' : hard ? 'HARD' : ''}</span><span class="card-points">${value}<small> PT${value > 1 ? 'S' : ''}</small></span></span><strong>${code}</strong><span class="card-name">${state.name}</span><span class="card-check" aria-hidden="true">✓</span></button>`;
    })
    .join('');
  $$('[data-card]').forEach((button) =>
    button.addEventListener('click', () => play(button.dataset.card)),
  );
  if (focusCode) $(`[data-card="${focusCode}"]`)?.focus({ preventScroll: true });
  $('#hint-button').disabled = ended || pending;
  for (const id of ['#sound-button', '#records-button', '#help-button']) $(id).disabled = lost;
  arena.sync(game.route, ended, arrival, game.zeroCards, game.cardPoints);
  if (dealAnimation) arena.deal();
  sweepView.sync();
}

function showResult() {
  if (game.status !== 'won') return;
  clearTimeout(resultTimeout);
  $('#result-title').textContent = 'You win';
  $('#result-route').hidden = false;
  $('#result-route').innerHTML = solutionCards(game.route, 'Your route', game.mistakePoints);
  showSolutions();
  message('You win.');
  openDialog('#result-dialog');
}

function solutionCards(path, label, mistakePoints = 0) {
  return `<section class="solution-section"><h3>${label} <span>${score(path, game.zeroCards, mistakePoints, game.cardPoints)} pts</span></h3><ol class="solution-chain" aria-label="${label}">${path.map((code) => `<li><div class="solution-card ${game.cardPoints?.[code] === 3 ? 'hard' : ''}" data-solution-code="${code}" aria-label="${STATES[code].name}">${code}</div></li>`).join('')}</ol></section>`;
}

function showSolutions() {
  if (solutionCache?.gameId === game.id) {
    const mostPoints = solutionCache.mostPoints;
    $('#solutions').innerHTML = mostPoints
      ? solutionCards(mostPoints, 'Most points')
      : '<p class="fine-print">Most points unavailable.</p>';
    return;
  }
  $('#solutions').innerHTML = '<p class="fine-print" role="status">Finding most points…</p>';
  if (solutionWorker) return;
  const gameId = game.id;
  try {
    const worker = new Worker(new URL('./solution-worker.js', document.baseURI), {
      type: 'module',
    });
    solutionWorker = worker;
    worker.onmessage = ({ data }) => {
      if (game.id !== gameId || solutionWorker !== worker) return;
      solutionCache = { gameId, mostPoints: data.mostPoints };
      worker.terminate();
      solutionWorker = null;
      showSolutions();
    };
    worker.onerror = () => {
      if (game.id !== gameId || solutionWorker !== worker) return;
      solutionCache = { gameId, mostPoints: null };
      worker.terminate();
      solutionWorker = null;
      showSolutions();
    };
    worker.postMessage({
      gameId,
      deal: game.deal,
      cardPoints: game.cardPoints,
      zeroCards: game.zeroCards,
    });
  } catch {
    solutionCache = { gameId, mostPoints: null };
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
    `<section class="record-section">${records.length ? `<table><caption class="sr-only">Personal bests</caption><thead><tr><th>PATH</th><th>POINTS</th></tr></thead><tbody>${records.map((r) => `<tr><td class="record-path">${r.route ? r.route.join(' → ') : '—'}</td><td>${r.points} pts</td></tr>`).join('')}</tbody></table>` : '<p class="fine-print">No scores yet.</p>'}</section>`;
  openDialog('#records-dialog');
}
$('#records-button').addEventListener('click', showScores);

$('#clear-scores').addEventListener('click', () => {
  save = { ...save, records: [], wins: 0, played: 0 };
  persist();
  showScores();
});

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
render(game.cardPoints !== null);
if (game.cardPoints === null) prepareScoring(true);
else if (game.status === 'lost') restartAfterTimeout();
else if (game.status === 'won') showResult();
else if (isComplete(game.deal, game.route)) finish();
else if (!game.route.length) message(startMessage);
