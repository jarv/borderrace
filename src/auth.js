import { createClient } from '@supabase/supabase-js';

export function safeStorage(storage) {
  const memory = new Map();
  const failed = new Set();
  return {
    getItem(key) {
      if (failed.has(key)) return memory.get(key) ?? null;
      try {
        return storage ? storage.getItem(key) : (memory.get(key) ?? null);
      } catch {
        return memory.get(key) ?? null;
      }
    },
    setItem(key, value) {
      memory.set(key, value);
      try {
        storage?.setItem(key, value);
        failed.delete(key);
      } catch {
        failed.add(key);
      }
    },
    removeItem(key) {
      memory.delete(key);
      try {
        storage?.removeItem(key);
        failed.delete(key);
      } catch {
        failed.add(key);
      }
    },
  };
}

// Explicit code exchange avoids exchanging a one-use PKCE code twice.
export function createAuth({
  config,
  storage,
  onChange = () => {},
  client,
  location = window.location,
  history = window.history,
}) {
  client ??= createClient(config.url, config.key, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: false,
      persistSession: true,
      storageKey: 'border-race:auth:v1',
      storage: safeStorage(storage),
    },
    global: {
      fetch: (input, init = {}) =>
        fetch(input, {
          ...init,
          signal: init.signal
            ? AbortSignal.any([init.signal, AbortSignal.timeout(10000)])
            : AbortSignal.timeout(10000),
        }),
    },
  });
  let session = null;
  let error = '';
  let ready = false;
  const notify = () => onChange({ session, error, ready });
  client.auth.onAuthStateChange((_event, next) => {
    session = next;
    // Never await another SDK call inside its auth lock.
    queueMicrotask(notify);
  });
  return {
    client,
    get session() {
      return session;
    },
    async initialize() {
      const url = new URL(location.href);
      const code = url.searchParams.get('code');
      const failed =
        url.searchParams.has('error') || new URLSearchParams(url.hash.slice(1)).has('error');
      try {
        if (failed) throw new Error('OAuth failed');
        const result = code
          ? await client.auth.exchangeCodeForSession(code)
          : await client.auth.getSession();
        if (result.error) throw result.error;
        session = result.data.session;
      } catch {
        error = 'Sign-in unavailable. Try again.';
      } finally {
        if (code || failed) {
          for (const key of ['code', 'error', 'error_code', 'error_description'])
            url.searchParams.delete(key);
          if (failed) url.hash = '';
          history.replaceState(null, '', url.pathname + url.search + url.hash);
        }
        ready = true;
        notify();
      }
    },
    async signIn() {
      error = '';
      try {
        const redirectTo = new URL('.', location.href).href;
        const result = await client.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo },
        });
        if (result.error) throw result.error;
      } catch {
        error = 'Sign-in unavailable. Try again.';
      }
      notify();
    },
    async signOut() {
      try {
        const result = await client.auth.signOut({ scope: 'local' });
        if (result.error) throw result.error;
        session = null;
        error = '';
      } catch {
        error = 'Sign-out unavailable. Try again.';
      }
      notify();
    },
  };
}
