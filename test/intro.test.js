import { test } from 'node:test';
import assert from 'node:assert/strict';
import { introMessage } from '../src/intro.js';

test('intro displays a rounded lower bound with readable grouping', () => {
  assert.equal(
    introMessage({ winningRoutes: '12400' }),
    'Select cards to cross the map using connecting states. There are more than 10,000 winning routes. Start with a coastal card. Gold cards ★ are harder to use and worth 3 points.',
  );
  assert.ok(
    introMessage({ winningRoutes: '1234567890123456789012345' }).includes(
      'There are more than 1,000,000,000,000,000,000,000,000 winning routes.',
    ),
  );
});

test('route estimates are strict lower bounds, even for exact round counts', () => {
  for (const [winningRoutes, minimum] of [
    ['7956', '7,000'],
    ['7000', '6,000'],
    ['1000', '900'],
    ['10', '9'],
  ]) {
    assert.ok(introMessage({ winningRoutes }).includes(`more than ${minimum} winning routes`));
  }
  assert.ok(introMessage({ winningRoutes: '2' }).includes('There are 2 winning routes.'));
});

test('older saves and scoring fallbacks do not invent a route count', () => {
  const message = introMessage({});
  assert.ok(
    message.startsWith('Select cards to cross the map using connecting states. Start with'),
  );
  assert.equal(message.includes('winning routes'), false);
});
