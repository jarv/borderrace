import { validGame, score } from './game.js';

export const STORAGE_KEY = 'border-race:v2';
export const emptySave = () => ({
  version: 2,
  game: null,
  records: [],
  wins: 0,
  played: 0,
  archive: null,
  soundEnabled: true,
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
    return {
      version: 2,
      game: validGame(data.game) ? data.game : null,
      records: Array.isArray(data.records)
        ? data.records
            .filter(
              (r) => r && typeof r.id === 'string' && Number.isFinite(r.points) && r.points >= 0,
            )
            .map(({ id, points }) => ({ id, points }))
            .sort((a, b) => b.points - a.points)
            .slice(0, 10)
        : [],
      wins: Number.isSafeInteger(data.wins) && data.wins >= 0 ? data.wins : 0,
      played: Number.isSafeInteger(data.played) && data.played >= 0 ? data.played : 0,
      soundEnabled: data.soundEnabled !== false,
      archive: data.archive ?? null,
    };
  } catch {
    return emptySave();
  }
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
  const won = game.status === 'won';
  const record = { id: game.id, points: score(game.route, game.zeroCards) };
  const records = won ? [record, ...save.records.filter((r) => r.id !== game.id)] : save.records;
  return {
    ...save,
    version: 2,
    game,
    played: save.played + 1,
    wins: save.wins + Number(won),
    records: records.sort((a, b) => b.points - a.points).slice(0, 10),
  };
}
