// Short, locally synthesized effects. No audio is created until a user action.
export function createAudio({ enabled = true, createContext } = {}) {
  let context;
  let unlocked = false;
  const factory =
    createContext ??
    (() => {
      const AudioContext = globalThis.AudioContext ?? globalThis.webkitAudioContext;
      return AudioContext ? new AudioContext() : null;
    });
  const voices = new Set();
  const sequences = {
    place: [
      [660, 0, 0.065],
      [990, 0.055, 0.12],
    ],
    invalid: [
      [140, 0, 0.1],
      [105, 0.08, 0.12],
    ],
    undo: [
      [440, 0, 0.07],
      [330, 0.05, 0.1],
    ],
    deal: [
      [440, 0, 0.04],
      [554, 0.035, 0.04],
      [660, 0.07, 0.09],
    ],
    complete: [
      [523, 0, 0.13],
      [659, 0.08, 0.13],
      [784, 0.16, 0.13],
      [1047, 0.25, 0.3],
    ],
    win: [
      [523, 0, 0.13],
      [659, 0.1, 0.13],
      [784, 0.2, 0.13],
      [1047, 0.3, 0.35],
      [1319, 0.4, 0.3],
    ],
    loss: [
      [330, 0, 0.14],
      [262, 0.12, 0.2],
    ],
  };

  function setEnabled(value) {
    enabled = Boolean(value);
    if (!enabled) {
      for (const voice of voices) {
        try {
          voice.stop();
        } catch {
          /* It may already have ended. */
        }
      }
      voices.clear();
    }
  }

  function play(name, chainLength = 0) {
    if (!enabled || !unlocked || globalThis.document?.hidden) return;
    try {
      context ??= factory();
      if (!context || context.state === 'closed') return;
      if (context.state === 'suspended') context.resume()?.catch(() => {});
      const transpose = name === 'place' ? 1 + Math.min(chainLength, 20) * 0.025 : 1;
      for (const [frequency, delay, duration] of sequences[name] ?? []) {
        if (voices.size >= 24) break;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = context.currentTime + delay;
        oscillator.type = name === 'invalid' ? 'triangle' : 'sine';
        oscillator.frequency.setValueAtTime(frequency * transpose, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.045, start + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        voices.add(oscillator);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
          voices.delete(oscillator);
        };
        oscillator.start(start);
        oscillator.stop(start + duration + 0.02);
      }
    } catch {
      /* Unsupported/blocked audio must never interrupt a game. */
    }
  }
  return {
    play,
    setEnabled,
    unlock: () => {
      unlocked = true;
    },
  };
}
