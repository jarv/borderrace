import { test } from 'node:test';
import assert from 'node:assert/strict';
import { introMessage } from '../src/intro.js';

test('intro displays the exact winning-route count with readable grouping', () => {
  assert.equal(
    introMessage({ winningRoutes: '12400' }),
    'Select cards to cross the map using connecting states. There are 12,400 winning routes. Start with a green coastal card. Gold cards are harder to use and worth 3 points.',
  );
  assert.ok(
    introMessage({ winningRoutes: '1234567890123456789012345' }).includes(
      'There are 1,234,567,890,123,456,789,012,345 winning routes.',
    ),
  );
});

test('older saves and scoring fallbacks do not invent a route count', () => {
  const message = introMessage({});
  assert.ok(
    message.startsWith('Select cards to cross the map using connecting states. Start with'),
  );
  assert.equal(message.includes('winning routes'), false);
});
