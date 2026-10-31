import { coast } from './data.js';
import { advanceSweep, sweepFrontier } from './sweep.js';

export function createSweepView({ panel, map, getGame, setSweep, persist, onTimeout }) {
  const layer = document.createElement('div');
  layer.className = 'sweep-layer';
  layer.hidden = true;
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = '<div class="sweep-shade"></div><div class="sweep-line"></div>';
  panel.append(layer);
  const warning = document.createElement('span');
  warning.className = 'sr-only';
  warning.setAttribute('role', 'status');
  panel.append(warning);
  let bounds;
  let last = null;
  let lastSaved = 0;
  let frame;
  let danger = null;
  let hidden = document.hidden;

  const running = () => {
    const game = getGame();
    return game.status === 'playing' && game.cardPoints !== null && Boolean(game.sweep?.origin);
  };
  function geometry() {
    if (bounds) return bounds;
    const panelBox = panel.getBoundingClientRect();
    bounds = new Map();
    if (!panelBox.width) return bounds;
    for (const shape of map.querySelectorAll('.map-state')) {
      const box = shape.getBoundingClientRect();
      bounds.set(shape.dataset.code, {
        left: (box.left - panelBox.left) / panelBox.width,
        right: (box.right - panelBox.left) / panelBox.width,
      });
    }
    return bounds;
  }
  function draw() {
    const game = getGame();
    const sweep = game.sweep;
    layer.hidden = !sweep?.origin || (!running() && game.lossReason !== 'timeout');
    const frontier = sweep?.origin ? sweepFrontier(sweep, game.route, geometry()) : null;
    const nextDanger =
      !layer.hidden && frontier && sweep.progress >= frontier.near ? frontier.code : null;
    if (nextDanger !== danger) {
      if (danger) map.querySelector(`[data-code="${danger}"]`)?.classList.remove('sweep-danger');
      danger = nextDanger;
      if (danger) map.querySelector(`[data-code="${danger}"]`)?.classList.add('sweep-danger');
      warning.textContent = danger ? `${danger}: the line is catching up.` : '';
    }
    if (layer.hidden) return;
    const eastward = coast(sweep.origin) === 'west';
    layer.dataset.direction = eastward ? 'east' : 'west';
    layer.style.setProperty('--sweep-progress', `${sweep.progress * 100}%`);
    layer.querySelector('.sweep-line').style.left =
      `${(eastward ? sweep.progress : 1 - sweep.progress) * 100}%`;
    if (!hidden && running() && frontier && sweep.progress >= frontier.far) onTimeout();
  }
  function advance(now) {
    if (last !== null && running())
      setSweep(advanceSweep(getGame().sweep, Math.max(0, now - last) / 1000));
    last = now;
  }
  function stop() {
    cancelAnimationFrame(frame);
    frame = null;
    last = null;
  }
  function tick(now) {
    frame = null;
    if (hidden || !running()) {
      stop();
      return;
    }
    advance(now);
    draw();
    if (now - lastSaved >= 1000) {
      persist();
      lastSaved = now;
    }
    if (running()) frame = requestAnimationFrame(tick);
  }
  function sync() {
    draw();
    if (!running() || hidden) {
      stop();
      return;
    }
    if (last === null) last = performance.now();
    if (frame == null) frame = requestAnimationFrame(tick);
  }
  const checkpoint = () => {
    if (!hidden && running()) advance(performance.now());
    draw();
  };
  document.addEventListener('visibilitychange', () => {
    if (!hidden && running()) advance(performance.now());
    hidden = document.hidden;
    stop();
    persist();
    sync();
  });
  window.addEventListener('pagehide', () => {
    checkpoint();
    persist();
    stop();
  });
  window.addEventListener('pageshow', () => {
    // Back/forward-cache restores must resume without charging time away.
    hidden = document.hidden;
    stop();
    sync();
  });
  new ResizeObserver(() => {
    bounds = null;
    sync();
  }).observe(panel);
  new ResizeObserver(() => {
    bounds = null;
    sync();
  }).observe(map);
  return { sync, checkpoint };
}
