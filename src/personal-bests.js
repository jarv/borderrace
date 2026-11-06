import { score } from './game.js';
import { difficultyOf } from './easy.js';

export const validPlaySeconds = (value) =>
  Number.isFinite(value) && value >= 0 && Number.isSafeInteger(Math.round(value * 10));

export function personalBests(save, difficulty = 'challenging') {
  if (['easy', 'medium'].includes(difficulty))
    return personalBests({
      records: save[`${difficulty}Records`],
      personalBests: save[`${difficulty}PersonalBests`],
    });
  let points = Number.isFinite(save.personalBests?.points) ? save.personalBests.points : null;
  let playSeconds = validPlaySeconds(save.personalBests?.playSeconds)
    ? save.personalBests.playSeconds
    : null;
  for (const record of save.records ?? []) {
    if (Number.isFinite(record.points) && (points === null || record.points > points))
      points = record.points;
    if (
      validPlaySeconds(record.playSeconds) &&
      (playSeconds === null || record.playSeconds < playSeconds)
    )
      playSeconds = record.playSeconds;
  }
  return { points, playSeconds };
}

export function newRecordFlags(save, game) {
  if (game.status !== 'won') return { time: false, points: false };
  const best = personalBests(save, difficultyOf(game));
  return {
    time:
      best.playSeconds !== null &&
      validPlaySeconds(game.playSeconds) &&
      game.playSeconds < best.playSeconds,
    points:
      difficultyOf(game) === 'challenging' &&
      best.points !== null &&
      score(game.route, game.zeroCards, game.mistakePoints, game.cardPoints) > best.points,
  };
}

export function formatPlayTime(seconds) {
  if (!validPlaySeconds(seconds)) return '—';
  const tenths = Math.round(seconds * 10);
  return `${Math.floor(tenths / 600)}:${String(Math.floor(tenths / 10) % 60).padStart(2, '0')}.${tenths % 10}`;
}
