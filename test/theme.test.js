import test from 'node:test';
import assert from 'node:assert/strict';
import { emptySave, loadSave, writeSave } from '../src/storage.js';

test('theme preferences load defensively, preserve legacy dark defaults, and round-trip', () => {
  assert.equal(emptySave().theme, 'dark');
  for (const theme of [undefined, null, false, 'system', {}, 'LIGHT']) {
    assert.equal(
      loadSave({ getItem: () => JSON.stringify({ ...emptySave(), theme }) }).theme,
      'dark',
    );
  }
  let value;
  const storage = {
    getItem: () => value,
    setItem: (_, next) => {
      value = next;
    },
  };
  for (const theme of ['light', 'dark']) {
    assert.equal(writeSave(storage, { ...emptySave(), theme }), true);
    assert.equal(loadSave(storage).theme, theme);
  }
  assert.equal(loadSave(undefined).theme, 'dark');
});
