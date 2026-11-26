// Automated tests with fake external services (no real calls to MET, Kartverket or the router).
process.env.MET_CONTACT = 'test-contact@example.invalid';
process.env.RATE_LIMIT = '1000';
const assert = require('assert/strict');
const http = require('../src/http');
const geo = require('../src/geo');
const weather = require('../src/weather');
const { addDays, todayOslo, todayIn } = require('../src/planner');
const regions = require('../src/regions');

let passed = 0;
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// --- Fake services --------------------------------------------------------------------------
const calls = [];
const LINE = [[10.752, 59.913], [11.1, 60.2], [11.07, 60.79], [10.47, 61.115]]; // Oslo → Hamar → Lillehammer
const AU_LINE = [[144.963, -37.814], [144.3, -37.65], [143.86, -37.56], [143.2, -37.4], [142.94, -37.28]]; // Melbourne → Ballarat → Ararat
// Fake weather: Norway is sunny north of 60.6°N; Australia is sunny west of 143.9°E (Ballarat and beyond).
function fakeForecast(lat, lon) {
  const sunny = lat < 0 ? lon < 143.9 : lat > 60.6;
  const start = new Date();
  start.setUTCMinutes(0, 0, 0);
  const series = [];
  for (let h = 0; h < 9 * 24; h += h < 60 ? 1 : 6) {
    const time = new Date(start.getTime() + h * 3600e3).toISOString().replace('.000', '');
    const hourly = h < 60;
    series.push({ time, data: {
      instant: { details: { air_temperature: lat < 0 ? (sunny ? 27 : 17) : 8 + (lat - 60) * 6, cloud_area_fraction: sunny ? 10 : 90, wind_speed: 4 } },
      ...(hourly ? { next_1_hours: { summary: { symbol_code: sunny ? 'clearsky_day' : 'rain' }, details: { precipitation_amount: sunny ? 0 : 1.5 } } } : {}),
      next_6_hours: { summary: { symbol_code: sunny ? 'clearsky_day' : 'rain' }, details: { precipitation_amount: sunny ? 0 : 6 } },
    } });
  }
  return { type: 'Feature', properties: { meta: { updated_at: new Date().toISOString() }, timeseries: series } };
}
const json = (body, headers = {}) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json', Expires: new Date(Date.now() + 30 * 60e3).toUTCString(), ...headers } });

http.setFetchForTesting(async (url, opts) => {
  calls.push({ url, ua: opts?.headers?.['User-Agent'] });
  const u = new URL(url);
  if (u.host === 'api.met.no' && u.pathname.includes('locationforecast')) return json(fakeForecast(Number(u.searchParams.get('lat')), Number(u.searchParams.get('lon'))));
  if (u.host === 'api.met.no' && u.pathname.includes('metalerts')) {
    return json({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[10.9, 60.6], [11.3, 60.6], [11.3, 61.0], [10.9, 61.0], [10.9, 60.6]]] },
      properties: { id: 'a1', title: 'Kuling, gult nivå', event: 'wind', awareness_level: '2; yellow; Moderate' } }] });
  }
  if (u.pathname.includes('/route/v1/driving/')) {
    const au = u.pathname.includes(',-');
    return json({ code: 'Ok', routes: [{ distance: au ? 205000 : 182000, duration: (au ? 2.2 : 2.4) * 3600, geometry: { type: 'LineString', coordinates: au ? AU_LINE : LINE } }] });
  }
  if (u.host === 'photon.komoot.io') return json({ type: 'FeatureCollection', features: [
    { type: 'Feature', properties: { name: 'Ballarat Central', osm_value: 'suburb', city: 'Ballarat', state: 'Victoria', countrycode: 'AU' }, geometry: { type: 'Point', coordinates: [143.85, -37.56] } },
    { type: 'Feature', properties: { name: 'Ballard', osm_value: 'locality', city: 'Toowoomba', state: 'Queensland', countrycode: 'AU' }, geometry: { type: 'Point', coordinates: [151.98, -27.5] } },
  ] });
  if (u.host === 'api.kartverket.no') return json({ navn: [
    { skrivemåte: 'Lillehammer', navneobjekttype: 'By', representasjonspunkt: { nord: 61.115, øst: 10.466 }, kommuner: [{ kommunenavn: 'Lillehammer' }], fylker: [{ fylkesnavn: 'Innlandet' }] },
    { skrivemåte: 'Lillehammervatnet', navneobjekttype: 'Innsjø', representasjonspunkt: { nord: 61.1, øst: 10.4 } },
  ] });
  if (u.host === 'ws.geonorge.no') return json({ adresser: [] });
  throw new Error(`unexpected request ${url}`);
});

const { createApp } = require('../src/server');
let server;
let base;
const post = (body, headers = {}) => fetch(`${base}/api/plan`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const OSLO = { name: 'Oslo', lat: 59.913, lon: 10.752 };
const LHMR = { name: 'Lillehammer', lat: 61.115, lon: 10.466 };

// --- Unit tests -------------------------------------------------------------------------------
test('geometry: distance and position along a line', () => {
  const d = geo.distanceKm([10.752, 59.913], [5.322, 60.391]);
  assert.ok(d > 300 && d < 315, `Oslo–Bergen ${d}`);
  const pos = geo.locateOnLine([11.07, 60.79], LINE);
  assert.ok(pos.offKm < 0.01 && pos.alongKm > 90, JSON.stringify(pos));
  assert.ok(geo.inGeometry([11, 60.8], { type: 'Polygon', coordinates: [[[10.9, 60.6], [11.3, 60.6], [11.3, 61], [10.9, 61], [10.9, 60.6]]] }));
});

test('weather: daytime summary, score and flags', () => {
  const date = todayOslo();
  const tomorrow = addDays(date, 1);
  const sunny = weather.daySummary(fakeForecast(61, 10), tomorrow);
  const rainy = weather.daySummary(fakeForecast(60, 10), tomorrow);
  assert.equal(sunny.cloud, 10);
  assert.equal(sunny.symbol, 'clearsky_day');
  assert.ok(rainy.precip >= 10, `precip ${rainy.precip}`);
  assert.ok(weather.score(sunny) > weather.score(rainy));
  assert.deepEqual(weather.flags(rainy), ['heavy_rain']);
  assert.equal(weather.daySummary(fakeForecast(61, 10), addDays(date, 20)), null);
});

test('regions: country from coordinates and Australian time zones', () => {
  assert.equal(regions.regionOf({ lat: 59.9, lon: 10.7 }).id, 'no');
  assert.equal(regions.regionOf({ lat: -37.8, lon: 144.9 }).id, 'au');
  assert.equal(regions.regionOf({ lat: 48.85, lon: 2.35 }), null);
  const tz = regions.auTimeZone;
  assert.equal(tz(-31.95, 115.86), 'Australia/Perth');
  assert.equal(tz(-12.46, 130.84), 'Australia/Darwin');
  assert.equal(tz(-23.7, 133.88), 'Australia/Darwin'); // Alice Springs
  assert.equal(tz(-34.93, 138.6), 'Australia/Adelaide');
  assert.equal(tz(-37.83, 140.78), 'Australia/Adelaide'); // Mount Gambier
  assert.equal(tz(-27.47, 153.03), 'Australia/Brisbane');
  assert.equal(tz(-20.73, 139.49), 'Australia/Brisbane'); // Mount Isa
  assert.equal(tz(-33.87, 151.21), 'Australia/Sydney');
  assert.equal(tz(-37.81, 144.96), 'Australia/Sydney'); // Melbourne shares Sydney's time
  assert.equal(tz(-42.88, 147.33), 'Australia/Hobart');
  assert.match(todayIn('au'), /^\d{4}-\d{2}-\d{2}$/);
});

test('weather: the daytime summary follows the local time zone', () => {
  // Cloudy all day except a sunny spell 10–14 UTC: night in Melbourne, midday in Oslo.
  const date = todayIn('au', -37.8, 144.9);
  const start = Date.parse(`${date}T00:00:00Z`) - 24 * 3600e3;
  const series = [];
  for (let h = 0; h < 72; h++) {
    const time = new Date(start + h * 3600e3).toISOString().replace('.000', '');
    const utcHour = new Date(time).getUTCHours();
    const cloud = utcHour >= 10 && utcHour < 14 ? 0 : 100;
    series.push({ time, data: { instant: { details: { air_temperature: 20, cloud_area_fraction: cloud, wind_speed: 2 } }, next_1_hours: { summary: { symbol_code: 'cloudy' }, details: { precipitation_amount: 0 } } } });
  }
  const fc = { properties: { timeseries: series } };
  const mel = weather.daySummary(fc, date, 'Australia/Melbourne');
  const osl = weather.daySummary(fc, date, 'Europe/Oslo');
  assert.equal(mel.cloud, 100, 'the sunny spell is at night in Melbourne');
  assert.ok(osl.cloud < 100, 'and during the day in Oslo');
});

// --- API tests ----------------------------------------------------------------------------------
test('plan: route split into days with the sunniest stops, and MET terms respected', async () => {
  calls.length = 0;
  const res = await post({ from: OSLO, to: LHMR, date: todayOslo(), days: 2 });
  assert.equal(res.status, 200, await res.clone().text());
  const p = await res.json();
  assert.equal(p.days.length, 2);
  assert.equal(p.route.km, 182);
  const overnight = p.days[0].stops.find((s) => s.role === 'overnight');
  assert.ok(overnight, 'day 1 has an overnight stop');
  // Sunny north of 60.6° in the fake data: the overnight stop must be in the sunny area.
  assert.ok(overnight.lat > 60.6, `overnight at ${overnight.name} ${overnight.lat}`);
  assert.ok(p.towns.length >= 3, `towns checked: ${p.towns.length}`);
  assert.equal(p.from.role, 'start');
  assert.equal(p.to.role, 'destination');
  // Official warning inside the polygon is attached.
  assert.ok(p.days.some((d) => d.warnings.some((w) => w.kind === 'alert')), 'MET warning shown');
  // MET: identification with contact, max 4 decimals.
  const met = calls.filter((c) => c.url.includes('api.met.no'));
  assert.ok(met.length > 0);
  for (const c of met) {
    assert.ok(c.ua.includes('Reisevaer/') && c.ua.includes('test-contact@example.invalid'), c.ua);
    const u = new URL(c.url);
    for (const k of ['lat', 'lon']) if (u.searchParams.has(k)) assert.ok((u.searchParams.get(k).split('.')[1] ?? '').length <= 4);
  }
});

test('plan: the second identical request is served from the cache', async () => {
  calls.length = 0;
  const res = await post({ from: OSLO, to: LHMR, date: todayOslo(), days: 2 });
  assert.equal(res.status, 200);
  assert.equal(calls.length, 0, `requests made: ${calls.map((c) => c.url).join(', ')}`);
});

test('plan: input is validated', async () => {
  assert.equal((await post({ from: OSLO, to: LHMR, date: addDays(todayOslo(), -1), days: 1 })).status, 400);
  const far = await post({ from: OSLO, to: LHMR, date: addDays(todayOslo(), 12), days: 2 });
  assert.equal((await far.json()).error, 'beyond_forecast');
  assert.equal((await post({ from: OSLO, to: LHMR, date: todayOslo(), days: 0 })).status, 400);
  assert.equal((await post({ from: OSLO, to: LHMR, date: todayOslo(), days: 22 })).status, 400);
  // 182 km over 21 days is under 20 km a day.
  assert.equal((await (await post({ from: OSLO, to: LHMR, date: todayOslo(), days: 21 })).json()).error, 'too_many_days');
  assert.equal((await post({ from: { name: 'Paris', lat: 48.85, lon: 2.35 }, to: LHMR, date: todayOslo(), days: 1 })).status, 400);
});

test('plan: days beyond the forecast get stops without weather', async () => {
  calls.length = 0;
  // Departure in 6 days, 8 days long: the last days are beyond the 9-day forecast.
  const res = await post({ from: OSLO, to: LHMR, date: addDays(todayOslo(), 6), days: 8 });
  assert.equal(res.status, 200, await res.clone().text());
  const p = await res.json();
  assert.equal(p.days.length, 8);
  const late = p.days.filter((d) => d.noForecast);
  assert.ok(late.length >= 3, `days without forecast: ${late.length}`);
  assert.ok(p.days.filter((d) => !d.noForecast).every((d) => d.date <= p.lastForecastDate));
  const lateStops = late.flatMap((d) => d.stops);
  assert.ok(lateStops.length >= 1, 'stops suggested on days without forecast');
  assert.ok(lateStops.every((s) => s.weather === null));
  assert.equal(p.to.weather, null, 'destination day is beyond the forecast');
  // No stop is suggested twice.
  const keys = p.days.flatMap((d) => d.stops).map((s) => `${s.lat},${s.lon}`);
  assert.equal(new Set(keys).size, keys.length);
});

test('search: settlements returned, nature names left out', async () => {
  const res = await fetch(`${base}/api/search?q=Lilleh`);
  const data = await res.json();
  assert.deepEqual(data.results.map((r) => r.name), ['Lillehammer']);
});

const MEL = { name: 'Melbourne', lat: -37.814, lon: 144.963 };
const ARARAT = { name: 'Ararat', lat: -37.28, lon: 142.94 };
test('australia: plan along an Australian route, local towns, no Norwegian warnings', async () => {
  calls.length = 0;
  const res = await post({ from: MEL, to: ARARAT, date: todayIn('au', MEL.lat, MEL.lon), days: 2 });
  assert.equal(res.status, 200, await res.clone().text());
  const p = await res.json();
  assert.equal(p.region, 'au');
  assert.equal(p.route.km, 205);
  const overnight = p.days[0].stops.find((s) => s.role === 'overnight');
  assert.ok(overnight, 'day 1 has an overnight stop');
  assert.ok(overnight.lon < 143.9, `overnight in the sunny west: ${overnight.name} ${overnight.lon}`);
  assert.ok(p.towns.length >= 2, `towns checked: ${p.towns.length}`);
  assert.ok(p.towns.every((t) => t.lat < -30), 'only Australian towns');
  assert.equal(calls.filter((c) => c.url.includes('metalerts')).length, 0, 'MET warnings (Norway only) not fetched');
  // Contact information goes to MET only.
  for (const c of calls) assert.equal(c.ua.includes('test-contact@example.invalid'), c.url.includes('api.met.no'), c.url);
});

test('dragged route: via points go to the router in order and come back in the plan', async () => {
  calls.length = 0;
  const vias = [{ lat: -37.65, lon: 144.3 }, { lat: -37.4, lon: 143.2 }];
  const res = await post({ from: MEL, to: ARARAT, date: todayIn('au', MEL.lat, MEL.lon), days: 1, vias });
  assert.equal(res.status, 200, await res.clone().text());
  const p = await res.json();
  assert.deepEqual(p.vias, vias);
  const routeCall = calls.find((c) => c.url.includes('/route/v1/driving/'));
  assert.ok(routeCall, 'the router was asked');
  const coords = decodeURIComponent(new URL(routeCall.url).pathname.split('/driving/')[1]).split(';');
  assert.deepEqual(coords, ['144.96300,-37.81400', '144.30000,-37.65000', '143.20000,-37.40000', '142.94000,-37.28000']);
  // A via point in another country, or too many, is refused.
  assert.equal((await (await post({ from: MEL, to: ARARAT, date: todayIn('au'), days: 1, vias: [{ lat: 60, lon: 10 }] })).json()).error, 'invalid_via');
  const many = Array.from({ length: 11 }, () => ({ lat: -37.5, lon: 144 }));
  assert.equal((await (await post({ from: MEL, to: ARARAT, date: todayIn('au'), days: 1, vias: many })).json()).error, 'invalid_via');
});

test('australia: start and destination must be in the same country', async () => {
  const res = await post({ from: MEL, to: LHMR, date: todayOslo(), days: 2 });
  assert.equal((await res.json()).error, 'different_regions');
});

test('australia: search uses the town list first, then Photon', async () => {
  const data = await (await fetch(`${base}/api/search?q=Ballar&region=au`)).json();
  assert.equal(data.results[0].name, 'Ballarat');
  assert.equal(data.results[0].detail, 'Victoria');
  assert.ok(data.results.some((r) => r.name === 'Ballarat Central'), JSON.stringify(data.results.map((r) => r.name)));
  const info = await (await fetch(`${base}/api/info?region=au`)).json();
  assert.equal(info.today, todayIn('au'));
});

test('page: security headers, Leaflet and attribution', async () => {
  const res = await fetch(`${base}/`);
  assert.match(res.headers.get('content-security-policy'), /default-src 'self'/);
  assert.match(res.headers.get('content-security-policy'), /cache\.kartverket\.no/);
  assert.match(res.headers.get('content-security-policy'), /tile\.openstreetmap\.org/);
  assert.equal((await fetch(`${base}/vendor/leaflet/leaflet.js`)).status, 200);
  const js = await (await fetch(`${base}/app.js`)).text();
  assert.match(js, /Meteorologisk institutt/);
  assert.match(js, /Norwegian Meteorological Institute/);
  const info = await (await fetch(`${base}/api/info`)).json();
  assert.equal(info.configured, true);
  assert.equal(info.ads.enabled, false);
});

test('ads: off by default, verification + ads.txt with publisher ID, nonce CSP only when live', async () => {
  const config = require('../src/config');
  const saved = { ...config.ads };
  try {
    // Off: strict policy, no Google anything.
    let res = await fetch(`${base}/`);
    let html = await res.text();
    assert.equal(res.headers.get('content-security-policy').includes('nonce-'), false);
    assert.equal(html.includes('google-adsense-account'), false);
    assert.equal((await fetch(`${base}/ads.txt`)).status, 404);

    // Publisher ID only (during the AdSense review): verification tag and ads.txt, still strict policy.
    Object.assign(config.ads, { enabled: true, client: 'ca-pub-1234567890123456', slot: '', live: false, preview: true });
    res = await fetch(`${base}/`);
    html = await res.text();
    assert.match(html, /<meta name="google-adsense-account" content="ca-pub-1234567890123456">/);
    assert.equal(res.headers.get('content-security-policy').includes('nonce-'), false);
    assert.equal(await (await fetch(`${base}/ads.txt`)).text(), 'google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n');

    // Live: every script tag carries this request's nonce, and the policy trusts that nonce.
    Object.assign(config.ads, { slot: '1234567890', live: true, preview: false });
    res = await fetch(`${base}/`);
    html = await res.text();
    const nonce = res.headers.get('content-security-policy').match(/'nonce-([^']+)'/)[1];
    const scripts = html.match(/<script[^>]*>/g);
    assert.ok(scripts.length >= 2 && scripts.every((s) => s.includes(`nonce="${nonce}"`)), scripts.join(' '));
    assert.match(res.headers.get('content-security-policy'), /'strict-dynamic'/);
    const second = (await fetch(`${base}/`)).headers.get('content-security-policy').match(/'nonce-([^']+)'/)[1];
    assert.notEqual(second, nonce, 'a new nonce for every page load');
  } finally {
    Object.assign(config.ads, saved);
  }
});

test('without MET contact no weather is fetched', async () => {
  const config = require('../src/config');
  const saved = config.metContact;
  config.metContact = '';
  calls.length = 0;
  try {
    const res = await post({ from: OSLO, to: { name: 'Hamar', lat: 60.79, lon: 11.07 }, date: todayOslo(), days: 1 });
    assert.equal(res.status, 503);
    assert.equal(calls.filter((c) => c.url.includes('api.met.no')).length, 0);
  } finally {
    config.metContact = saved;
  }
});

(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const { name, fn } of tests) {
    try { await fn(); passed += 1; console.log(`  ✓ ${name}`); } catch (err) { console.log(`  ✗ ${name}\n    ${err.message}`); process.exitCode = 1; }
  }
  server.close();
  console.log(`\n${passed} of ${tests.length} checks passed`);
})();
