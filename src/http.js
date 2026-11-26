// HTTP client for the external services, with an in-memory cache.
// MET Norway's terms: identify the app (User-Agent with contact), respect the Expires header,
// use If-Modified-Since when data has expired, and do not send more than 20 requests per second.
const config = require('./config');

const cache = new Map(); // url -> { body, expires, lastModified }
const MAX_ENTRIES = 5000;

// Simple limiter per host: at most `perSecond` requests per second, at most `parallel` at a time.
const limiters = new Map();
function limiterFor(host) {
  if (!limiters.has(host)) limiters.set(host, { active: 0, queue: [], stamps: [] });
  return limiters.get(host);
}
const LIMITS = { 'api.met.no': { perSecond: 10, parallel: 6 }, default: { perSecond: 5, parallel: 4 } };

async function throttle(host) {
  const lim = limiterFor(host);
  const { perSecond, parallel } = LIMITS[host] ?? LIMITS.default;
  for (;;) {
    const now = Date.now();
    lim.stamps = lim.stamps.filter((t) => now - t < 1000);
    if (lim.active < parallel && lim.stamps.length < perSecond) {
      lim.active += 1;
      lim.stamps.push(now);
      return () => { lim.active -= 1; };
    }
    await new Promise((r) => setTimeout(r, 60));
  }
}

let fetchImpl = (...args) => fetch(...args);
function setFetchForTesting(fn) { fetchImpl = fn; cache.clear(); }

class UpstreamError extends Error {
  constructor(message, status, service) { super(message); this.name = 'UpstreamError'; this.status = status; this.service = service; }
}

// GET JSON. `defaultTtl` (ms) is used when the response has no Expires header.
async function getJson(url, { defaultTtl = 10 * 60 * 1000, timeout = 15000, service = 'upstream' } = {}) {
  const hit = cache.get(url);
  if (hit && hit.expires > Date.now()) return hit.body;

  const host = new URL(url).host;
  const release = await throttle(host);
  try {
    // Only MET Norway requires contact information; other services get the app name only.
    const headers = { 'User-Agent': host === 'api.met.no' ? config.userAgent : config.appId, Accept: 'application/json', 'Accept-Encoding': 'gzip' };
    if (hit?.lastModified) headers['If-Modified-Since'] = hit.lastModified;
    let res;
    try {
      res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(timeout) });
    } catch (err) {
      if (hit) return hit.body; // keep using old data rather than failing
      throw new UpstreamError(`${service} unreachable (${err.name})`, 502, service);
    }
    const expiresHeader = res.headers.get('expires');
    const expires = expiresHeader && !Number.isNaN(Date.parse(expiresHeader)) ? Date.parse(expiresHeader) : Date.now() + defaultTtl;
    if (res.status === 304 && hit) {
      hit.expires = Math.max(expires, Date.now() + 60_000);
      return hit.body;
    }
    if (!res.ok) {
      if (hit) return hit.body;
      throw new UpstreamError(`${service} answered ${res.status}`, res.status === 429 ? 429 : 502, service);
    }
    const body = await res.json();
    if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value);
    cache.set(url, { body, expires: Math.max(expires, Date.now() + 60_000), lastModified: res.headers.get('last-modified') });
    return body;
  } finally {
    release();
  }
}

module.exports = { getJson, setFetchForTesting, UpstreamError, _cache: cache };
