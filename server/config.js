function number(env, name, fallback, min, max) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be an integer.`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${name} is outside the supported range.`);
  return value;
}
export function loadConfig(env = process.env) {
  const mode = env.APP_MODE || 'demo';
  if (!['demo', 'live'].includes(mode)) throw new Error('APP_MODE must be demo or live.');
  const host = env.HOST || '127.0.0.1';
  // This portfolio is intentionally local-only. Public hosting needs a separate security review.
  if (!['127.0.0.1', '::1', 'localhost'].includes(host)) throw new Error('HOST must be a loopback address for this local portfolio.');
  const apiKey = mode === 'live' ? env.OPENAI_API_KEY : undefined;
  if (mode === 'live' && (!apiKey || apiKey.includes('replace-with') || apiKey.trim() !== apiKey)) {
    throw new Error('Live mode requires your own OPENAI_API_KEY in the local environment.');
  }
  const model = env.OPENAI_MODEL || 'gpt-4.1-mini';
  if (!/^[a-zA-Z0-9._:-]{1,100}$/.test(model)) throw new Error('OPENAI_MODEL has an invalid format.');
  return Object.freeze({
    mode, host, apiKey, model,
    port: number(env, 'PORT', 3000, 1, 65535),
    apiTimeoutMs: number(env, 'API_TIMEOUT_MS', 12000, 1000, 20000),
    requestTimeoutMs: number(env, 'REQUEST_TIMEOUT_MS', 30000, 3000, 60000),
    rateLimit: number(env, 'RATE_LIMIT_PER_MINUTE', 12, 1, 60),
    maxConcurrent: number(env, 'MAX_CONCURRENT_REQUESTS', 3, 1, 10),
    bodyLimit: 4096,
  });
}
