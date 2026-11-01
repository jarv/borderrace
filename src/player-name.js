const adjectives = ['Brave', 'Bouncy', 'Cozy', 'Happy', 'Jolly', 'Lucky', 'Sunny', 'Witty'];
const pets = ['Badger', 'Bunny', 'Cat', 'Corgi', 'Fox', 'Gecko', 'Otter', 'Panda'];

export function randomPlayerName(random = () => crypto.getRandomValues(new Uint32Array(1))[0]) {
  const pick = (items) => items[random() % items.length];
  return `${pick(adjectives)} ${pick(pets)} ${String(random() % 10000).padStart(4, '0')}`;
}
