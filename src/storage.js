import { validGame, score, isComplete } from './game.js';
import { CODES } from './data.js';
import { personalBests, validPlaySeconds } from './personal-bests.js';
import { isChoiceMode, difficultyOf } from './easy.js';

export const STORAGE_KEY = 'border-race:v2';
export const emptySave = () => ({
  version: 2,
  game: null,
  records: [],
  wins: 0,
  played: 0,
  archive: null,
  soundEnabled: true,
  theme: 'dark',
  personalBests: { points: null, playSeconds: null },
  difficulty: 'easy',
  easyRecords: [],
  easyWins: 0,
  easyPlayed: 0,
  easyPersonalBests: { points: null, playSeconds: null },
  mediumRecords: [],
  mediumWins: 0,
  mediumPlayed: 0,
  mediumPersonalBests: { points: null, playSeconds: null },
});

function migrate(data) {
  if (data?.version !== 1) return data;
  const old = data.game;
  const game =
    old?.mode === 'advanced'
      ? {
          id: old.id,
          deal: old.deal,
          route: old.route,
          zeroCards: [],
          hintPending: false,
          status: old.status === 'ready' ? 'playing' : old.status,
        }
      : null;
  return {
    ...data,
    version: 2,
    game,
    records: Array.isArray(data.records)
      ? data.records.filter((r) => r?.mode === 'advanced').map(({ id, points }) => ({ id, points }))
      : [],
    // Preserve prior saves without carrying timers or wildcard state into play.
    archive: data,
  };
}

export function loadSave(storage) {
  try {
    const data = migrate(JSON.parse(storage.getItem(STORAGE_KEY)));
    if (data?.version !== 2) return emptySave();
    const records = Array.isArray(data.records)
      ? data.records
          .filter((r) => r && typeof r.id === 'string' && Number.isFinite(r.points))
          .map(({ id, points, route, playSeconds }) => ({
            id,
            points,
            ...(validPlaySeconds(playSeconds) ? { playSeconds } : {}),
            ...(Array.isArray(route) && isComplete(CODES, route) ? { route: [...route] } : {}),
          }))
          .sort((a, b) => b.points - a.points)
          .slice(0, 10)
      : [];
    return {
      version: 2,
      game: validGame(data.game) ? data.game : null,
      records,
      personalBests: personalBests({ ...data, records }),
      wins: Number.isSafeInteger(data.wins) && data.wins >= 0 ? data.wins : 0,
      played: Number.isSafeInteger(data.played) && data.played >= 0 ? data.played : 0,
      soundEnabled: data.soundEnabled !== false,
      theme: data.theme === 'light' ? 'light' : 'dark',
      archive: data.archive ?? null,
      difficulty: ['easy', 'medium', 'challenging'].includes(data.difficulty)
        ? data.difficulty
        : data.game
          ? difficultyOf(data.game)
          : 'easy',
      ...loadChoiceRecords(data, 'easy'),
      ...loadChoiceRecords(data, 'medium'),
    };
  } catch {
    return emptySave();
  }
}

function loadChoiceRecords(data, difficulty) {
  const records = Array.isArray(data[`${difficulty}Records`])
    ? data[`${difficulty}Records`]
        .filter((r) => r && typeof r.id === 'string' && Number.isFinite(r.points))
        .map(({ id, points, route, playSeconds }) => ({
          id,
          points,
          ...(validPlaySeconds(playSeconds) ? { playSeconds } : {}),
          ...(Array.isArray(route) && isComplete(CODES, route) ? { route: [...route] } : {}),
        }))
        .sort((a, b) => b.points - a.points)
        .slice(0, 10)
    : [];
  return {
    [`${difficulty}Records`]: records,
    [`${difficulty}Wins`]:
      Number.isSafeInteger(data[`${difficulty}Wins`]) && data[`${difficulty}Wins`] >= 0
        ? data[`${difficulty}Wins`]
        : 0,
    [`${difficulty}Played`]:
      Number.isSafeInteger(data[`${difficulty}Played`]) && data[`${difficulty}Played`] >= 0
        ? data[`${difficulty}Played`]
        : 0,
    [`${difficulty}PersonalBests`]: personalBests({
      records,
      personalBests: data[`${difficulty}PersonalBests`],
    }),
  };
}

export function writeSave(storage, save) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function recordResult(save, game) {
  if (save.game?.id === game.id && ['won', 'lost'].includes(save.game.status)) return save;
  const prefix = isChoiceMode(game) ? difficultyOf(game) : '';
  const recordsKey = prefix ? `${prefix}Records` : 'records';
  const playedKey = prefix ? `${prefix}Played` : 'played';
  const winsKey = prefix ? `${prefix}Wins` : 'wins';
  const bestsKey = prefix ? `${prefix}PersonalBests` : 'personalBests';
  const won = game.status === 'won';
  const record = {
    id: game.id,
    route: [...game.route],
    points: score(game.route, game.zeroCards, game.mistakePoints, game.cardPoints),
    ...(validPlaySeconds(game.playSeconds) ? { playSeconds: game.playSeconds } : {}),
  };
  const previous = save[recordsKey] ?? [];
  const records = won ? [record, ...previous.filter((r) => r.id !== game.id)] : previous;
  return {
    ...save,
    version: 2,
    game,
    [playedKey]: (save[playedKey] ?? 0) + 1,
    [winsKey]: (save[winsKey] ?? 0) + Number(won),
    [bestsKey]: personalBests({ personalBests: save[bestsKey], records }),
    [recordsKey]: [...records].sort((a, b) => b.points - a.points).slice(0, 10),
  };
}
