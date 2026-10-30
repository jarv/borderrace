import { animate, stagger } from 'motion';
import { STATES } from './data.js';
import { layoutChain } from './chain.js';
import { pointsFor } from './game.js';

export function createArena({ map, onPlay, reducedMotion }) {
  const layer = document.createElement('div');
  layer.id = 'map-chain';
  layer.setAttribute('role', 'group');
  layer.setAttribute('aria-label', 'Your card chain across the USA');
  const rowLine = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  rowLine.setAttribute('class', 'row-line');
  rowLine.setAttribute('aria-hidden', 'true');
  layer.append(rowLine);
  const stage = map.parentElement;
  stage.append(layer);
  const effects = document.createElement('div');
  effects.id = 'arena-effects';
  effects.setAttribute('aria-hidden', 'true');
  effects.inert = true;
  document.body.append(effects);
  const cards = new Map();
  const flights = new Map();
  const particles = new Map();
  let currentRoute = [];
  let ended = false;
  let zeroCards = [];

  function effect(element, keyframes, options) {
    // Bound transient effects during fast tapping and clean them up on completion.
    if (particles.size >= 90) {
      const [oldest, animation] = particles.entries().next().value;
      animation.stop();
      oldest.remove();
      particles.delete(oldest);
    }
    const animation = animate(element, keyframes, options);
    particles.set(element, animation);
    Promise.resolve(animation).then(() => {
      element.remove();
      particles.delete(element);
    });
  }

  function clearParticles() {
    for (const [element, animation] of particles) {
      animation.stop();
      element.remove();
    }
    particles.clear();
  }

  function cancelFlight(code) {
    const flight = flights.get(code);
    if (!flight) return;
    flight.animation.stop();
    flight.clone.remove();
    cards.get(code)?.style.removeProperty('opacity');
    flights.delete(code);
  }

  function sparkle(card, points) {
    if (reducedMotion.matches || !card.isConnected) return;
    const box = card.getBoundingClientRect();
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    const ring = document.createElement('span');
    ring.className = 'impact-ring';
    ring.style.left = `${centerX}px`;
    ring.style.top = `${centerY}px`;
    effects.append(ring);
    effect(ring, { scale: [0.2, 2.3], opacity: [0.8, 0] }, { duration: 0.5 });
    for (let i = 0; i < 12; i++) {
      const star = document.createElement('span');
      star.className = 'landing-spark';
      star.textContent = ['✦', '◆', '·'][i % 3];
      star.style.left = `${centerX}px`;
      star.style.top = `${centerY}px`;
      effects.append(star);
      const angle = (i / 12) * Math.PI * 2;
      effect(
        star,
        {
          x: [0, Math.cos(angle) * (55 + (i % 3) * 14)],
          y: [0, Math.sin(angle) * (55 + (i % 3) * 14) - 10],
          opacity: [1, 1, 0],
          scale: [0.4, 1.3, 0.2],
          rotate: [0, i % 2 ? 65 : -65],
        },
        { duration: 0.55, delay: i * 0.008 },
      );
    }
    const chip = document.createElement('span');
    chip.className = 'score-pop';
    chip.textContent = `+${points}`;
    chip.style.left = `${box.x + box.width / 2}px`;
    chip.style.top = `${box.y - 8}px`;
    effects.append(chip);
    effect(chip, { y: [0, -55], opacity: [0, 1, 1, 0], scale: [0.6, 1.45, 1] }, { duration: 0.85 });
    // Experience-like energy motes collect into the score HUD, without bonuses.
    const hud = document.querySelector('#score').getBoundingClientRect();
    for (let i = 0; i < (points ? 4 : 0); i++) {
      const gem = document.createElement('span');
      gem.className = 'energy-gem';
      gem.style.left = `${centerX}px`;
      gem.style.top = `${centerY}px`;
      effects.append(gem);
      effect(
        gem,
        {
          x: [0, (i - 1.5) * 20, hud.x + hud.width / 2 - centerX],
          y: [0, -30 - i * 8, hud.y + hud.height / 2 - centerY],
          scale: [0.5, 1.3, 0.3],
          opacity: [0, 1, 1, 0],
        },
        { duration: 0.7, delay: 0.08 + i * 0.04, ease: [0.4, 0, 0.2, 1] },
      );
    }
    animate(card, { scale: [1.35, 0.88, 1], rotate: [-5, 2, 0] }, { duration: 0.4 });
  }

  function flyToMap(code, source) {
    const target = cards.get(code);
    if (!target || reducedMotion.matches || !source || !map.getBoundingClientRect().width) return;
    const destination = target.getBoundingClientRect();
    if (!destination.width) return;
    cancelFlight(code);
    const clone = source.node;
    clone.removeAttribute('id');
    clone.removeAttribute('data-card');
    clone.removeAttribute('aria-pressed');
    clone.classList.remove('placed');
    clone.classList.add('flying-card');
    clone.tabIndex = -1;
    Object.assign(clone.style, {
      left: `${source.rect.x}px`,
      top: `${source.rect.y}px`,
      width: `${source.rect.width}px`,
      height: `${source.rect.height}px`,
    });
    effects.append(clone);
    target.style.opacity = '0';
    const dx = destination.x + destination.width / 2 - source.rect.x - source.rect.width / 2;
    const dy = destination.y + destination.height / 2 - source.rect.y - source.rect.height / 2;
    const animation = animate(
      clone,
      {
        x: [0, dx * 0.45, dx],
        y: [0, dy * 0.5 - 85, dy],
        scaleX: [1, 1.08, destination.width / source.rect.width],
        scaleY: [1, 1.08, destination.height / source.rect.height],
        rotate: [0, dx < 0 ? -20 : 20, -5],
      },
      { duration: 0.65, ease: [0.22, 0.75, 0.25, 1] },
    );
    flights.set(code, { animation, clone });
    Promise.resolve(animation).then(() => {
      if (flights.get(code)?.clone !== clone) return;
      clone.remove();
      flights.delete(code);
      target.style.removeProperty('opacity');
      sparkle(target, pointsFor(code, zeroCards));
    });
  }

  function positionCards() {
    const bounds = stage.getBoundingClientRect();
    const positions = layoutChain(currentRoute, bounds.width, bounds.height);
    for (const p of positions) {
      const card = cards.get(p.code);
      Object.assign(card.style, {
        left: `${p.x}px`,
        top: `${p.y}px`,
        width: `${p.width}px`,
        height: `${p.height}px`,
        '--tilt': `${p.angle}deg`,
      });
    }
    rowLine.hidden = positions.length < 2;
    if (positions.length > 1) {
      const top = Math.min(...positions.map((p) => p.y));
      const left = Math.min(...positions.map((p) => p.x));
      const width = Math.max(1, Math.max(...positions.map((p) => p.x)) - left);
      const height = Math.max(1, Math.max(...positions.map((p) => p.y)) - top);
      Object.assign(rowLine.style, {
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
      });
      rowLine.setAttribute('viewBox', `0 0 ${width} ${height}`);
      rowLine.innerHTML = Array.from(
        { length: positions.at(-1).row + 1 },
        (_, row) =>
          `<polyline points="${positions
            .filter((p) => p.row === row)
            .map((p) => `${p.x - left},${p.y - top}`)
            .join(' ')}"/>`,
      ).join('');
    }
  }

  function sync(route, isEnded, arrival, zeroPointCards = []) {
    currentRoute = route;
    ended = isEnded;
    zeroCards = zeroPointCards;
    map.querySelectorAll('.map-state').forEach((state) => {
      state.classList.toggle('on-route', route.includes(state.dataset.code));
    });
    for (const [code, card] of cards) {
      if (route.includes(code)) continue;
      cancelFlight(code);
      cards.delete(code);
      card.removeAttribute('data-chain');
      if (reducedMotion.matches) card.remove();
      else {
        card.inert = true;
        Promise.resolve(
          animate(
            card,
            { opacity: [1, 0], scale: [1, 0.5], y: [0, 25], rotate: [0, -20] },
            { duration: 0.22 },
          ),
        ).then(() => card.remove());
      }
    }
    route.forEach((code, index) => {
      let card = cards.get(code);
      if (!card) {
        card = document.createElement('button');
        card.className = 'map-card';
        card.dataset.chain = code;
        card.innerHTML = `<span class="map-card-corner">${index + 1}</span><strong>${code}</strong><small></small>`;
        card.addEventListener('click', () => onPlay(code));
        cards.set(code, card);
        layer.append(card);
      }
      card.disabled = ended;
      const value = pointsFor(code, zeroCards);
      card.querySelector('small').textContent = `${value} PT${value === 1 ? '' : 'S'}`;
      card.classList.toggle('chain-tip', index === route.length - 1);
      card.style.zIndex = index + 1;
      card.setAttribute(
        'aria-label',
        `${STATES[code].name}, ${value} points, stop ${index + 1}, remove this card and following cards`,
      );
    });
    positionCards();
    if (arrival) flyToMap(arrival.code, arrival.source);
  }

  new ResizeObserver(() => {
    for (const code of flights.keys()) cancelFlight(code);
    positionCards();
  }).observe(stage);
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) {
      for (const code of flights.keys()) cancelFlight(code);
      clearParticles();
    }
  });

  function deal() {
    clearParticles();
    if (reducedMotion.matches) return;
    animate(
      '.state-card',
      {
        opacity: [0, 1],
        y: [-90, 8, 0],
        x: [35, 0],
        scale: [0.65, 1.04, 1],
        rotate: [-18, 3, 0],
      },
      { delay: stagger(0.035, { from: 'first' }), duration: 0.55, ease: [0.2, 0.8, 0.2, 1] },
    );
  }

  function complete() {
    if (reducedMotion.matches) return;
    const callout = document.createElement('div');
    callout.className = 'chain-callout';
    callout.setAttribute('aria-hidden', 'true');
    callout.textContent = 'COMPLETE';
    map.append(callout);
    effect(
      callout,
      { scale: [0.4, 1.15, 1, 1], y: [15, 0, 0, -15], opacity: [0, 1, 1, 0] },
      { duration: 1.8 },
    );
    animate(
      rowLine,
      {
        opacity: [0.3, 1],
        filter: [
          'drop-shadow(0 0 0px #9df375)',
          'drop-shadow(0 0 10px #9df375)',
          'drop-shadow(0 0 3px #68e9ef)',
        ],
      },
      { duration: 0.7 },
    );
  }

  return { sync, deal, complete };
}
