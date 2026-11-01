import { animate } from 'motion';

const MAX_PARTICLES = 32;
const SPARK_INTERVAL = 180;

// Decorative only: no timers, collision decisions, or gameplay callbacks.
export function createSweepEffects({ layer, line, reducedMotion }) {
  const effects = document.createElement('div');
  effects.className = 'sweep-effects';
  effects.inert = true;
  layer.append(effects);
  const particles = new Map();
  let gameId;
  let hadOrigin = false;
  let active = false;
  let entrance = null;
  let lastSpark = 0;
  let lastProgress = 0;

  function clear() {
    entrance?.stop();
    entrance = null;
    line.classList.remove('sweep-entering');
    line.style.removeProperty('transform');
    for (const [element, animation] of particles) {
      animation.stop();
      element.remove();
    }
    particles.clear();
    lastSpark = 0;
  }

  function effect(element, keyframes, options) {
    if (particles.size >= MAX_PARTICLES) {
      const [oldest, animation] = particles.entries().next().value;
      animation.stop();
      oldest.remove();
      particles.delete(oldest);
    }
    effects.append(element);
    const animation = animate(element, keyframes, options);
    particles.set(element, animation);
    Promise.resolve(animation).then(() => {
      element.remove();
      particles.delete(element);
    });
  }

  function spark(x, y, impact = false) {
    const element = document.createElement('span');
    element.className = 'sweep-spark';
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    element.style.backgroundColor = ['#ff6554', '#ffb061', '#ffe0a3'][
      Math.floor(Math.random() * 3)
    ];
    const dx = (Math.random() - 0.5) * (impact ? 110 : 54);
    const rise = (impact ? 30 : 12) + Math.random() * (impact ? 45 : 22);
    effect(
      element,
      {
        x: [0, dx * 0.6, dx],
        y: [0, -rise, impact ? 8 : 20 + Math.random() * 25],
        opacity: [1, 1, 0],
        scale: [1, 0.9, 0.2],
        rotate: [0, dx * 3],
      },
      { duration: impact ? 0.55 : 0.45, ease: 'easeOut' },
    );
  }

  function impact() {
    const x = line.offsetLeft;
    const y = Math.max(0, layer.clientHeight - 3);
    const ring = document.createElement('span');
    ring.className = 'sweep-impact';
    ring.style.left = `${x}px`;
    ring.style.top = `${y}px`;
    effect(ring, { scaleX: [0.2, 3.2], scaleY: [0.3, 1.4], opacity: [0.95, 0] }, { duration: 0.4 });
    for (let i = 0; i < 14; i++) spark(x, y, true);
  }

  function slam() {
    line.classList.add('sweep-entering');
    const animation = animate(
      line,
      { y: ['-105%', '0%'] },
      { duration: 0.34, ease: [0.7, 0, 0.95, 0.6] },
    );
    entrance = animation;
    Promise.resolve(animation).then(() => {
      if (entrance !== animation) return;
      entrance = null;
      line.classList.remove('sweep-entering');
      line.style.removeProperty('transform');
      if (active && !reducedMotion.matches) impact();
    });
  }

  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) clear();
  });

  return {
    update(game, visible) {
      const sweep = game.sweep;
      if (gameId !== game.id) {
        clear();
        gameId = game.id;
        // Restored games resume in place; only a newly played first card slams.
        hadOrigin = Boolean(sweep?.origin);
        lastProgress = sweep?.progress ?? 0;
      }
      active = visible;
      const starting = !hadOrigin && Boolean(sweep?.origin);
      hadOrigin = Boolean(sweep?.origin);
      if (!active || reducedMotion.matches) {
        clear();
        lastProgress = sweep?.progress ?? 0;
        return;
      }
      if (starting) slam();
      const now = performance.now();
      if (!entrance && sweep.progress > lastProgress && now - lastSpark >= SPARK_INTERVAL) {
        const x = line.offsetLeft;
        const height = layer.clientHeight;
        for (let i = 0; i < 3; i++) spark(x, height * (0.08 + Math.random() * 0.84));
        lastSpark = now;
      }
      lastProgress = sweep.progress;
    },
    clear,
  };
}
