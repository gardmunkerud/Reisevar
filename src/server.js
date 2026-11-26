// Reisevær web server: the page, and a small API that talks to MET Norway, Kartverket and the router.
// The browser never calls those services directly, so the app identifies itself correctly and caches.
const path = require('path');
const express = require('express');
const config = require('./config');
const places = require('./places');
const { plan, PlanError, todayIn, addDays } = require('./planner');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.isProd) app.set('trust proxy', 1);

  const STRICT_CSP = "default-src 'self'; img-src 'self' data: https://cache.kartverket.no https://tile.openstreetmap.org; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
  // With live Google ads: Google's recommended "strict CSP" – our scripts carry a per-request nonce,
  // and scripts they load (the AdSense tag and what it loads) are trusted through 'strict-dynamic'.
  // 'unsafe-inline' and https: are only fallbacks for old browsers and are ignored by modern ones.
  const adsCsp = (nonce) => [
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' https:`,
    "object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'", "form-action 'self'",
    "img-src 'self' data: https:", "frame-src https:", "connect-src 'self' https:", "style-src 'self' 'unsafe-inline'",
  ].join('; ');

  app.use((req, res, next) => {
    res.set({
      'Content-Security-Policy': STRICT_CSP,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    });
    if (config.isProd) res.set('Strict-Transport-Security', 'max-age=31536000');
    next();
  });

  app.get('/healthz', (req, res) => res.type('text').send('ok'));

  // ads.txt: tells ad buyers which publisher may sell ads on this site (required by AdSense).
  app.get('/ads.txt', (req, res) => {
    if (!config.ads.client) return res.status(404).type('text').send('Not found');
    res.type('text').send(`google.com, ${config.ads.client.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`);
  });

  // The page itself: adds the AdSense site-verification tag, and nonces when ads are live.
  // The page lives outside public/ so it is always served through this route (security headers, AdSense tags);
  // on Vercel, files in public/ are served straight from the CDN and would bypass the server.
  const indexPath = path.join(__dirname, 'index.html');
  const cachedIndex = require('fs').readFileSync(indexPath, 'utf8');
  app.get(['/', '/index.html'], (req, res) => {
    let html = config.isProd ? cachedIndex : require('fs').readFileSync(indexPath, 'utf8');
    if (config.ads.client) html = html.replace('</head>', `  <meta name="google-adsense-account" content="${config.ads.client}">\n</head>`);
    if (config.ads.live) {
      const nonce = require('crypto').randomBytes(16).toString('base64');
      html = html.replace(/<script src=/g, `<script nonce="${nonce}" src=`);
      res.set('Content-Security-Policy', adsCsp(nonce));
    }
    res.set('Cache-Control', 'no-cache').type('html').send(html);
  });
  app.use(express.static(path.join(__dirname, '..', 'public'), { index: false }));

  // Per-IP rate limit for the API (protects the free services we depend on).
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [ip, list] of hits) if (!list.some((t) => now - t < config.limits.windowMs)) hits.delete(ip);
  }, 60_000).unref();
  const limited = (cost) => (req, res, next) => {
    const now = Date.now();
    const list = (hits.get(req.ip) ?? []).filter((t) => now - t < config.limits.windowMs);
    for (let i = 0; i < cost; i++) list.push(now);
    hits.set(req.ip, list);
    if (list.length > config.limits.requestsPerWindow * 5) return res.status(429).json({ error: 'rate_limited' });
    next();
  };

  const regionParam = (req) => (req.query.region === 'au' ? 'au' : 'no');
  app.get('/api/info', (req, res) => {
    const today = todayIn(regionParam(req));
    res.json({ configured: Boolean(config.metContact), today, lastDate: addDays(today, config.limits.horizonDays), maxDays: config.limits.maxDays, ads: config.ads });
  });

  app.get('/api/search', limited(1), async (req, res) => {
    const q = String(req.query.q ?? '').slice(0, 100);
    try {
      res.set('Cache-Control', 'private, max-age=300');
      res.json({ results: await places.search(q, regionParam(req)) });
    } catch (err) {
      res.status(502).json({ error: 'search_unavailable' });
    }
  });

  app.post('/api/plan', express.json({ limit: '20kb' }), limited(5), async (req, res) => {
    const started = Date.now();
    try {
      const body = req.body ?? {};
      const result = await plan({ from: body.from, to: body.to, date: body.date, days: body.days, vias: body.vias ?? [], lang: body.lang === 'en' ? 'en' : 'no' });
      console.log(`[plan] ${result.route.km} km, ${body.days} d, ${result.towns.length} towns, ${((Date.now() - started) / 1000).toFixed(1)}s`);
      res.json(result);
    } catch (err) {
      if (err instanceof PlanError) return res.status(err.status).json({ error: err.code });
      if (err.message === 'met_contact_missing') return res.status(503).json({ error: 'not_configured' });
      if (err.message === 'no_route') return res.status(422).json({ error: 'no_route' });
      console.warn(`[plan] failed: ${err.name} ${err.message}`);
      res.status(err.status === 429 ? 503 : 502).json({ error: 'upstream_error', service: err.service ?? null });
    }
  });

  app.use((req, res) => res.status(404).type('text').send('Not found'));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => res.status(err.status ?? 400).json({ error: 'bad_request' }));
  return app;
}

// Vercel runs the exported app as a function; locally (npm run dev / start) it listens on a port.
const app = createApp();
if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`Reisevær running at http://localhost:${config.port}${config.metContact ? '' : ' – MET_CONTACT missing in .env, weather is switched off'}`);
  });
}

module.exports = app;
module.exports.createApp = createApp;
