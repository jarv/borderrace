import { score } from './game.js';

export const OUTBOX_KEY = 'border-race:leaderboard:v1';
export const LEADERBOARD_RULES = 'wins-v1';
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 200;
const identity = (entry) => `${entry.userId}:${entry.gameId}`;

export function createOutbox({
  storage,
  submit,
  onChange = () => {},
  now = Date.now,
  schedule = setTimeout,
  cancel = clearTimeout,
}) {
  let entries = [];
  let session = null;
  let active = null;
  let retry;
  let attempts = 0;
  let warning = '';
  let disposed = false;
  function read() {
    try {
      const data = JSON.parse(storage?.getItem(OUTBOX_KEY) ?? '[]');
      if (!Array.isArray(data)) return [];
      return data.filter(
        (e) =>
          e &&
          typeof e.userId === 'string' &&
          e.userId.length <= 128 &&
          typeof e.gameId === 'string' &&
          e.gameId.length > 0 &&
          e.gameId.length <= 128 &&
          Number.isSafeInteger(e.points) &&
          e.points >= -2147483648 &&
          e.points <= 2147483647 &&
          Number.isFinite(e.queuedAt) &&
          e.queuedAt <= now(),
      );
    } catch {
      return [];
    }
  }
  function merge() {
    const all = [...new Map([...read(), ...entries].map((e) => [identity(e), e])).values()];
    const fresh = all
      .filter((e) => e.queuedAt >= now() - MAX_AGE)
      .sort((a, b) => a.queuedAt - b.queuedAt);
    if (fresh.length !== all.length || fresh.length > MAX_ENTRIES)
      warning = 'Some queued scores expired or exceeded the queue limit.';
    entries = fresh.slice(-MAX_ENTRIES);
  }
  function persist() {
    try {
      if (!storage) throw new Error('No storage');
      storage.setItem(OUTBOX_KEY, JSON.stringify(entries));
    } catch {
      warning = 'Queued scores may not survive reload.';
    }
  }
  function notify() {
    onChange({ pending: entries.filter((e) => e.userId === session?.user.id).length, warning });
  }
  async function flush() {
    if (disposed || active || !session) return;
    merge();
    persist();
    const entry = entries.find((e) => e.userId === session.user.id);
    notify();
    if (!entry) return;
    const operation = { controller: new AbortController(), session };
    active = operation;
    try {
      await submit(entry, operation.session, operation.controller.signal);
      merge();
      entries = entries.filter((e) => identity(e) !== identity(entry));
      persist();
      attempts = 0;
      if (warning.startsWith('Scores queued.')) warning = '';
    } catch {
      if (!operation.controller.signal.aborted) {
        warning = 'Scores queued. They count on the UTC day received.';
        attempts++;
      }
    } finally {
      active = null;
      notify();
      if (!disposed && session && entries.some((e) => e.userId === session.user.id)) {
        // Five automatic retries; manual refresh, reconnect, or login can retry later.
        if (attempts <= 5)
          retry = schedule(
            () => {
              retry = null;
              void flush();
            },
            Math.min(30000, 1000 * 2 ** attempts),
          );
      }
    }
  }
  merge();
  return {
    recordWin(game, userId) {
      if (!userId || game.status !== 'won') return;
      merge();
      const entry = {
        userId,
        gameId: game.id,
        points: score(game.route, game.zeroCards, game.mistakePoints, game.cardPoints),
        queuedAt: now(),
      };
      if (!entries.some((e) => identity(e) === identity(entry))) entries.push(entry);
      merge();
      persist();
      notify();
      void flush();
    },
    setSession(next) {
      if (next?.user.id !== session?.user.id) active?.controller.abort();
      session = next;
      attempts = 0;
      cancel(retry);
      retry = null;
      notify();
      void flush();
    },
    retry() {
      attempts = 0;
      cancel(retry);
      retry = null;
      void flush();
    },
    dispose() {
      disposed = true;
      cancel(retry);
      active?.controller.abort();
    },
  };
}
