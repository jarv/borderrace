import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAudio } from '../src/audio.js';

test('audio is lazy, requires interaction, and muted gameplay stays silent', () => {
  let contexts = 0;
  let tones = 0;
  const context = {
    currentTime: 1,
    state: 'running',
    destination: {},
    createOscillator() {
      tones++;
      return {
        frequency: { setValueAtTime() {} },
        connect() {},
        disconnect() {},
        start() {},
        stop() {
          this.onended?.();
        },
      };
    },
    createGain() {
      return {
        gain: {
          setValueAtTime() {},
          linearRampToValueAtTime() {},
          exponentialRampToValueAtTime() {},
        },
        connect() {},
        disconnect() {},
      };
    },
  };
  const audio = createAudio({
    createContext: () => {
      contexts++;
      return context;
    },
  });
  audio.play('place');
  assert.equal(contexts, 0);
  audio.unlock();
  audio.play('place');
  assert.equal(contexts, 1);
  assert.equal(tones, 2);
  audio.setEnabled(false);
  audio.play('win');
  assert.equal(tones, 2);
  audio.setEnabled(true);
  audio.play('complete');
  assert.equal(tones, 6);
  assert.equal(contexts, 1);
});

test('unsupported audio cannot interrupt gameplay', () => {
  const audio = createAudio({
    createContext: () => {
      throw new Error('Blocked');
    },
  });
  audio.unlock();
  assert.doesNotThrow(() => audio.play('place'));
  assert.doesNotThrow(() => audio.setEnabled(false));
});
