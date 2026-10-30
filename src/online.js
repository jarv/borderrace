import config from 'online-config';
import { createAuth } from './auth.js';
import { createOutbox, LEADERBOARD_RULES, OUTBOX_KEY } from './leaderboard.js';

export function createOnline({ storage, openDialog }) {
  const $ = (selector) => document.querySelector(selector);
  if (!config) return { recordWin() {} };
  $('#daily-button').hidden = false;
  let auth;
  let session = null;
  let revision = 0;
  let resetTimer;
  let pending = 0;
  let warning = '';
  let authError = '';
  let boardError = '';
  let ready = false;
  let signing = false;
  let profileRevision = 0;
  const dialog = $('#daily-dialog');
  const status = () => {
    $('#daily-status').textContent = [
      authError,
      boardError,
      warning,
      pending
        ? `${pending} score${pending === 1 ? '' : 's'} queued. Points count on the UTC day received.`
        : '',
    ]
      .filter(Boolean)
      .join(' ');
  };
  function renderAccount() {
    $('#google-sign-in').hidden = Boolean(session);
    $('#google-sign-in').disabled = !ready || signing;
    $('#online-sign-out').hidden = !session;
    $('#online-sign-out').disabled = !ready || signing;
    $('#profile-form').hidden = !session;
    $('#daily-account').textContent = session
      ? 'Signed in'
      : 'Sign in with Google to add winning points.';
    status();
  }
  async function loadProfile() {
    const current = ++profileRevision;
    $('#display-name').value = '';
    if (!session) return;
    try {
      const { data, error } = await auth.client
        .from('profiles')
        .select('display_name')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (error) throw error;
      if (current === profileRevision) $('#display-name').value = data?.display_name ?? '';
    } catch {
      /* Player is the public fallback; do not expose Google metadata. */
    }
  }
  const outbox = createOutbox({
    storage,
    submit: async (entry, boundSession, signal) => {
      const { error } = await auth.client
        .rpc('submit_score', {
          p_game_id: entry.gameId,
          p_points: entry.points,
          p_rules_version: LEADERBOARD_RULES,
        })
        .setHeader('Authorization', `Bearer ${boundSession.access_token}`)
        .abortSignal(signal);
      if (error) throw error;
    },
    onChange(state) {
      const previous = pending;
      pending = state.pending;
      warning = state.warning;
      status();
      if (pending < previous && session && dialog.open) void refresh();
    },
  });
  auth = createAuth({
    config,
    storage,
    onChange(state) {
      const changed = state.session?.user.id !== session?.user.id;
      session = state.session;
      ready = state.ready;
      authError = state.error;
      outbox.setSession(session);
      renderAccount();
      if (changed) {
        void loadProfile();
        if (dialog.open) void refresh();
      }
    },
  });
  async function refresh() {
    if (!dialog.open) return;
    const current = ++revision;
    clearTimeout(resetTimer);
    boardError = '';
    $('#daily-loading').hidden = false;
    $('#daily-list').replaceChildren();
    $('#daily-date').textContent = '';
    status();
    try {
      const { data, error } = await auth.client.rpc('get_daily_leaderboard');
      if (
        error ||
        !data ||
        !Array.isArray(data.entries) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(data.day) ||
        !Number.isFinite(Date.parse(data.resets_at))
      )
        throw error ?? new Error('Invalid leaderboard');
      if (current !== revision || !dialog.open) return;
      $('#daily-date').textContent = `${data.day} UTC · Resets at 00:00 UTC`;
      if (!data.entries.length) $('#daily-list').textContent = 'No scores today.';
      else {
        const table = document.createElement('table');
        const caption = table.createCaption();
        caption.className = 'sr-only';
        caption.textContent = 'Daily points leaderboard';
        const header = table.createTHead().insertRow();
        for (const label of ['Rank', 'Player', 'Points']) {
          const cell = document.createElement('th');
          cell.textContent = label;
          cell.scope = 'col';
          header.append(cell);
        }
        const body = table.createTBody();
        for (const entry of data.entries.slice(0, 51)) {
          const row = body.insertRow();
          row.classList.toggle('your-rank', entry.own === true);
          for (const text of [
            entry.rank,
            `${entry.name}${entry.own === true ? ' (you)' : ''}`,
            entry.points,
          ])
            row.insertCell().textContent = String(text);
        }
        $('#daily-list').append(table);
      }
      const serverTime = Number.isFinite(Date.parse(data.server_time))
        ? Date.parse(data.server_time)
        : Date.now();
      resetTimer = setTimeout(
        () => void refresh(),
        Math.max(1000, Math.min(86400000, Date.parse(data.resets_at) - serverTime + 500)),
      );
    } catch {
      if (current === revision && dialog.open) boardError = 'Leaderboard unavailable. Try Refresh.';
    } finally {
      if (current === revision) {
        $('#daily-loading').hidden = true;
        status();
      }
    }
  }
  $('#daily-button').addEventListener('click', () => {
    openDialog('#daily-dialog');
    void refresh();
  });
  $('#daily-refresh').addEventListener('click', () => {
    outbox.retry();
    void refresh();
  });
  $('#google-sign-in').addEventListener('click', async () => {
    signing = true;
    renderAccount();
    await auth.signIn();
    signing = false;
    renderAccount();
  });
  $('#online-sign-out').addEventListener('click', async () => {
    signing = true;
    renderAccount();
    await auth.signOut();
    signing = false;
    renderAccount();
  });
  $('#profile-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const userId = session?.user.id;
    if (!userId) return;
    const button = $('#save-display-name');
    button.disabled = true;
    try {
      const name = $('#display-name').value.trim();
      if (!name || [...name].length > 24 || /[\u0000-\u001f\u007f]/.test(name))
        throw new Error('Invalid name');
      const { error } = await auth.client
        .rpc('set_display_name', { p_display_name: name })
        .setHeader('Authorization', `Bearer ${session.access_token}`);
      if (error) throw error;
      if (session?.user.id === userId) {
        boardError = '';
        void refresh();
      }
    } catch {
      if (session?.user.id === userId)
        boardError = 'Name not saved. Use 1–24 characters and try again.';
    } finally {
      button.disabled = false;
      status();
    }
  });
  dialog.addEventListener('close', () => {
    revision++;
    clearTimeout(resetTimer);
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      outbox.retry();
      void refresh();
    }
  });
  window.addEventListener('online', () => {
    outbox.retry();
    void refresh();
  });
  window.addEventListener('focus', () => {
    if (dialog.open) void refresh();
  });
  window.addEventListener('storage', (event) => {
    if (event.key === OUTBOX_KEY) outbox.retry();
  });
  renderAccount();
  void auth.initialize();
  return {
    recordWin(game) {
      outbox.recordWin(game, session?.user.id);
    },
  };
}
