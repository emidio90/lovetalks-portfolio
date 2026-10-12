import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {AppError, safeError} from './errors.js';
import {validatePreferences, validateElaborateInput, validateTopics, validateElaboration} from './validation.js';
const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/assets/css/styles.css', ['assets/css/styles.css', 'text/css; charset=utf-8']],
  ['/assets/js/app.js', ['assets/js/app.js', 'text/javascript; charset=utf-8']],
  ['/assets/js/results.js', ['assets/js/results.js', 'text/javascript; charset=utf-8']],
]);
const securityHeaders = {
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cache-Control': 'no-store',
};
function json(res, status, value, headers = {}) {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(status, {...securityHeaders, 'Content-Type':'application/json; charset=utf-8', ...headers});
  res.end(JSON.stringify(value));
}
function readBody(req, limit, signal) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let chunks = [];
    let failed = false;
    signal.addEventListener('abort', () => {
      failed = true; chunks = [];
      reject(new AppError(504, 'UPSTREAM_TIMEOUT', 'That took too long. Please try again.'));
    }, {once:true});
    req.on('data', chunk => {
      if (failed) return;
      size += chunk.length;
      if (size > limit) {
        failed = true; chunks = [];
        reject(new AppError(413, 'BODY_TOO_LARGE', 'That request is too large.'));
      } else chunks.push(chunk);
    });
    req.on('end', () => {
      if (failed) return;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new AppError(400, 'INVALID_JSON', 'Send a valid JSON request.')); }
    });
    req.on('error', reject);
    req.on('aborted', () => reject(new AppError(400, 'REQUEST_ABORTED', 'The request was interrupted.')));
  });
}
export function createApp({config, provider, now = Date.now}) {
  // The map contains only coarse rate counters, never user preferences or model output.
  const buckets = new Map();
  let active = 0;
  function consumeRate(ip) {
    const time = now();
    for (const [key, value] of buckets) if (value.reset <= time) buckets.delete(key);
    let entry = buckets.get(ip);
    if (!entry) {
      if (buckets.size >= 1024) throw new AppError(503, 'SERVER_BUSY', 'Please try again shortly.');
      entry = {count:0, reset:time + 60000}; buckets.set(ip, entry);
    }
    if (++entry.count > config.rateLimit) throw new AppError(429, 'RATE_LIMITED', 'Please wait a minute before trying again.');
  }
  return createServer({requestTimeout:15000, headersTimeout:10000}, async (req, res) => {
    let acquired = false;
    let timer;
    const controller = new AbortController();
    res.on('close', () => { if (!res.writableEnded) controller.abort(); });
    try {
      let url;
      try { url = new URL(req.url, `http://${req.headers.host}`); } catch { throw new AppError(400, 'INVALID_REQUEST', 'Invalid request.'); }
      // Loopback host allowlist also limits DNS-rebinding access to a local live server.
      const host = new URL(`http://${req.headers.host}`).hostname;
      if (!['localhost','127.0.0.1','[::1]'].includes(host)) throw new AppError(403, 'INVALID_HOST', 'Use the local address shown by the server.');
      if (req.method === 'GET' && url.pathname === '/api/config') return json(res, 200, {mode:config.mode, model:config.mode === 'live' ? config.model : null});
      if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, {ok:true, mode:config.mode});
      if ((req.method === 'GET' || req.method === 'HEAD') && files.has(url.pathname)) {
        const [file, type] = files.get(url.pathname);
        const content = await readFile(`${publicRoot}${file}`);
        res.writeHead(200, {...securityHeaders, 'Content-Type':type, 'Content-Length':content.length});
        return res.end(req.method === 'HEAD' ? undefined : content);
      }
      if (!['/api/topics', '/api/elaborate'].includes(url.pathname)) throw new AppError(404, 'NOT_FOUND', 'This page or endpoint does not exist.');
      if (req.method !== 'POST') {
        res.setHeader('Allow','POST');
        throw new AppError(405, 'METHOD_NOT_ALLOWED', 'Use POST for this endpoint.');
      }
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) throw new AppError(403, 'CROSS_ORIGIN', 'Cross-origin requests are not allowed.');
      if ((req.headers['content-type'] || '').split(';')[0].trim().toLowerCase() !== 'application/json') throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Send application/json.');
      if (Number(req.headers['content-length']) > config.bodyLimit) throw new AppError(413, 'BODY_TOO_LARGE', 'That request is too large.');
      consumeRate(req.socket.remoteAddress || 'unknown');
      if (active >= config.maxConcurrent) throw new AppError(503, 'SERVER_BUSY', 'The server is busy. Please try again shortly.');
      active++; acquired = true;
      const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new AppError(504, 'UPSTREAM_TIMEOUT', 'That took too long. Please try again.'));
        }, config.requestTimeoutMs);
        timer.unref?.();
      });
      const action = async () => {
        const body = await readBody(req, config.bodyLimit, controller.signal);
        const context = url.pathname === '/api/topics' ? {preferences:validatePreferences(body)} : validateElaborateInput(body);
        if (url.pathname === '/api/topics') return {...validateTopics(await provider.topics(context.preferences, {signal:controller.signal})), mode:config.mode};
        return {elaboration:validateElaboration(await provider.elaborate(context.preferences, context.topic, {signal:controller.signal})), mode:config.mode};
      };
      const result = await Promise.race([action(), deadline]);
      return json(res, 200, result);
    } catch (error) {
      const safe = safeError(error);
      json(res, safe.status, {error:{code:safe.code, message:safe.message}}, safe.status === 429 ? {'Retry-After':'60'} : safe.status === 504 ? {'Connection':'close'} : {});
    } finally {
      clearTimeout(timer);
      if (acquired) active--;
    }
  });
}
