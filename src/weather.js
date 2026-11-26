// Weather from MET Norway (the data behind Yr): Locationforecast 2.0 and MetAlerts 2.0.
// Terms: https://api.met.no/doc/TermsOfService – identify with contact info, cache, max 4 decimals.
const config = require('./config');
const { getJson, UpstreamError } = require('./http');
const { inGeometry } = require('./geo');

const BASE = 'https://api.met.no/weatherapi';

function requireContact() {
  if (!config.metContact) throw new UpstreamError('met_contact_missing', 503, 'met');
}

// Coordinates rounded to 2 decimals (~1 km): within MET's 4-decimal limit and better for caching.
async function forecast(lat, lon) {
  requireContact();
  const url = `${BASE}/locationforecast/2.0/compact?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}`;
  return getJson(url, { service: 'met', defaultTtl: 30 * 60e3 });
}

async function alerts(lang = 'no') {
  requireContact();
  const data = await getJson(`${BASE}/metalerts/2.0/current.json?lang=${lang === 'en' ? 'en' : 'no'}`, { service: 'met', defaultTtl: 10 * 60e3 });
  return data.features ?? [];
}

// Local date and hour of a UTC timestamp in a time zone (Norway by default; Australia has several).
const formatters = new Map();
function fmtFor(tz) {
  if (!formatters.has(tz)) formatters.set(tz, new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }));
  return formatters.get(tz);
}
function local(iso, tz = 'Europe/Oslo') {
  const p = Object.fromEntries(fmtFor(tz).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}

// Daytime summary (08–20 local time) for one date. Returns null when the forecast does not reach the date.
function daySummary(fc, date, tz = 'Europe/Oslo') {
  const series = fc?.properties?.timeseries ?? [];
  const day = [];
  for (let i = 0; i < series.length; i++) {
    const loc = local(series[i].time, tz);
    if (loc.date !== date) continue;
    const next = series[i + 1] ? (Date.parse(series[i + 1].time) - Date.parse(series[i].time)) / 3600e3 : 6;
    day.push({ ...loc, entry: series[i].data, step: next });
  }
  if (!day.length) return null;
  const daytime = day.filter((d) => d.hour >= 8 && d.hour < 20);
  const use = daytime.length ? daytime : day;

  const temps = use.map((d) => d.entry.instant.details.air_temperature).filter(Number.isFinite);
  const clouds = use.map((d) => d.entry.instant.details.cloud_area_fraction).filter(Number.isFinite);
  const winds = use.map((d) => d.entry.instant.details.wind_speed).filter(Number.isFinite);
  let precip = 0;
  for (const d of use) {
    const period = d.step <= 1 ? d.entry.next_1_hours : d.entry.next_6_hours;
    precip += period?.details?.precipitation_amount ?? 0;
  }
  // Symbol for the middle of the day (closest to 13:00), preferring the 6-hour summary.
  const mid = use.reduce((a, b) => (Math.abs(b.hour - 13) < Math.abs(a.hour - 13) ? b : a));
  const symbol = mid.entry.next_6_hours?.summary?.symbol_code ?? mid.entry.next_1_hours?.summary?.symbol_code ?? mid.entry.next_12_hours?.summary?.symbol_code ?? null;
  const avg = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
  return {
    date,
    tempMax: temps.length ? Math.round(Math.max(...temps)) : null,
    tempMin: temps.length ? Math.round(Math.min(...temps)) : null,
    tempAvg: temps.length ? Math.round(avg(temps) * 10) / 10 : null,
    cloud: clouds.length ? Math.round(avg(clouds)) : null,
    precip: Math.round(precip * 10) / 10,
    windMax: winds.length ? Math.round(Math.max(...winds)) : null,
    symbol,
    hourly: use.length >= 6, // detailed (hourly) data rather than 6-hour steps
  };
}

// "Best weather" score: warm and sunny is good; rain and strong wind pull it down.
function score(s) {
  if (!s || s.tempAvg === null) return null;
  return Math.round((s.tempAvg + (100 - (s.cloud ?? 50)) * 0.08 - Math.min(s.precip, 20) * 1.2 - Math.max(0, (s.windMax ?? 0) - 10) * 0.8) * 10) / 10;
}

// Bad-weather flags shown to the user (in addition to MET's official warnings).
function flags(s) {
  if (!s) return [];
  const out = [];
  if (s.precip >= 10) out.push('heavy_rain');
  if ((s.windMax ?? 0) >= 15) out.push('strong_wind');
  if ((s.tempMin ?? 9) <= 1 && s.precip >= 1) out.push('snow_ice');
  if (s.symbol && s.symbol.includes('thunder')) out.push('thunder');
  return out;
}

// Official MET warnings that cover a point and overlap the given local date.
function alertsFor(features, lat, lon, date) {
  const dayStart = Date.parse(`${date}T00:00:00+01:00`);
  const dayEnd = dayStart + 26 * 3600e3;
  return features
    .filter((f) => {
      const iv = f.when?.interval;
      if (iv?.length === 2 && (Date.parse(iv[1]) < dayStart || Date.parse(iv[0]) > dayEnd)) return false;
      return inGeometry([lon, lat], f.geometry);
    })
    .map((f) => {
      const p = f.properties ?? {};
      const level = String(p.awareness_level ?? '').split(';')[1]?.trim() || 'yellow';
      return { id: p.id ?? null, title: p.title ?? p.eventAwarenessName ?? p.event ?? '', event: p.event ?? '', level, area: p.area ?? '', description: p.description ?? '', instruction: p.instruction ?? '' };
    });
}

module.exports = { forecast, alerts, daySummary, score, flags, alertsFor, local };
