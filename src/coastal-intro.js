export function createCoastalIntro({ hand, reducedMotion }) {
  let currentGame;
  const clear = () => {
    hand
      .querySelectorAll('.coastal-intro')
      .forEach((card) => card.classList.remove('coastal-intro'));
  };
  function sync(game) {
    currentGame = game;
    if (
      !game ||
      game.route.length ||
      game.sweep?.origin ||
      game.status !== 'playing' ||
      game.cardPoints === null ||
      document.hidden ||
      reducedMotion.matches
    ) {
      clear();
      return;
    }
    hand
      .querySelectorAll('.state-card.coastal:not(:disabled)')
      .forEach((card) => card.classList.add('coastal-intro'));
  }
  document.addEventListener('visibilitychange', () => sync(currentGame));
  reducedMotion.addEventListener('change', () => sync(currentGame));
  return { sync };
}
