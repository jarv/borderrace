// Only these two public values can cross the build/browser boundary.
export function onlineConfig(env = process.env) {
  const url = env.SUPABASE_URL ?? '';
  const key = env.SUPABASE_PUBLISHABLE_KEY ?? '';
  if (!url && !key) return null;
  if (!url || !key) throw new Error('Set both SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY');
  const parsed = new URL(url);
  if (
    parsed.protocol !== 'https:' &&
    !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))
  )
    throw new Error('Supabase requires HTTPS (except local development)');
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/')
    throw new Error('Use the Supabase project origin without credentials or a path');
  let publicKey = key.startsWith('sb_publishable_');
  if (key.startsWith('eyJ')) {
    try {
      publicKey = JSON.parse(Buffer.from(key.split('.')[1], 'base64url')).role === 'anon';
    } catch {
      /* Reject invalid JWTs. */
    }
  }
  if (!publicKey) throw new Error('Only a publishable key or legacy anon key can be bundled');
  return { url: parsed.origin, key };
}
