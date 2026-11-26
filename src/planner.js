// Trip planner: splits the drive into days and suggests the stops with the best weather.
// Days beyond MET's forecast (about 9 days ahead) get evenly spaced stops without weather.
const config = require('./config');
const { drivingRoute, simplify } = require('./route');
const { townsAlongRoute, largestGap, nearestCity } = require('./places');
const { pointAt, cumulative, locateOnLine } = require('./geo');
const weather = require('./weather');
const regions = require('./regions');

// The fastest route sometimes leaves Norway (e.g. Oslo–Tromsø through Sweden). If a long stretch has
// no Norwegian towns, route via the nearest Norwegian city instead, and repeat a few times.
const MAX_GAP_KM = 150;
async function norwegianRoute(from, to) {
  const first = await drivingRoute(from, to);
  let route = first;
  let vias = [];
  for (let i = 0; i < 5; i++) {
    const gap = largestGap(route.line);
    if (!gap || gap.km < MAX_GAP_KM) break;
    const near = nearestCity(pointAt(route.line, gap.midKm), vias);
    if (!near || near.d > 300) break;
    const cum = cumulative(route.line);
    const ordered = [...vias, near.town]
      .map((v) => ({ v, at: locateOnLine([v.lon, v.lat], route.line, cum).alongKm }))
      .sort((a, b) => a.at - b.at).map((x) => x.v);
    let next;
    try { next = await drivingRoute(from, ...ordered, to); } catch { break; }
    const nextGap = largestGap(next.line);
    if (next.km > first.km * 1.6 || (nextGap && nextGap.km >= gap.km)) break;
    route = next;
    vias = ordered;
  }
  return { ...route, vias };
}

class PlanError extends Error {
  constructor(code, status = 400) { super(code); this.name = 'PlanError'; this.code = code; this.status = status; }
}

const addDays = (date, n) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const todayOslo = () => weather.local(new Date().toISOString()).date;
// Today in a region (Australia: the time zone of the given point, Sydney time by default).
const todayIn = (regionId, lat = -33.87, lon = 151.21) => {
  const r = regions.byId(regionId);
  return weather.local(new Date().toISOString(), r.id === 'au' ? r.tz(lat, lon) : r.tz()).date;
};
const MIN_KM_PER_DAY = 20;

const MAX_VIAS = 10;
function validate({ from, to, date, days, vias = [] }) {
  const isPlace = (p) => p && typeof p.name === 'string' && regions.regionOf(p);
  if (!isPlace(from) || !isPlace(to)) throw new PlanError('invalid_place');
  const region = regions.regionOf(from);
  if (regions.regionOf(to) !== region) throw new PlanError('different_regions');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) throw new PlanError('invalid_date');
  const n = Number(days);
  if (!Number.isInteger(n) || n < 1 || n > config.limits.maxDays) throw new PlanError('invalid_days');
  const today = todayIn(region.id, from.lat, from.lon);
  if (date < today) throw new PlanError('date_past');
  // The first day must be within the forecast; later days may go beyond it.
  if (date > addDays(today, config.limits.horizonDays)) throw new PlanError('beyond_forecast');
  // Via points the user dragged the route through (same country, at most MAX_VIAS).
  if (!Array.isArray(vias) || vias.length > MAX_VIAS) throw new PlanError('invalid_via');
  const cleanVias = vias.map((v) => ({ lat: Number(v?.lat), lon: Number(v?.lon) }));
  if (cleanVias.some((v) => regions.regionOf(v) !== region)) throw new PlanError('invalid_via');
  return { days: n, region, today, vias: cleanVias.map((v) => ({ lat: Math.round(v.lat * 1e5) / 1e5, lon: Math.round(v.lon * 1e5) / 1e5 })) };
}

// Run async jobs with limited parallelism (the HTTP layer also throttles per host).
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      try { out[i] = await fn(items[i]); } catch { out[i] = null; }
    }
  }));
  return out;
}

const key = (s) => `${s.lat},${s.lon}`;
const preferCity = (a, b) => (a.type === 'city' ? 0 : 1) - (b.type === 'city' ? 0 : 1);
// Australian villages often lack services and somewhere to stay: use them only when a stretch has no town or city.
const preferTowns = (list, need = 1) => { const big = list.filter((s) => s.type !== 'village'); return big.length >= need ? big : list; };

// Best-scoring stops (or, without weather, cities first) that keep `minGapKm` from each other and from `taken`.
function pickSpaced(list, count, minGapKm, taken, byWeather) {
  const order = byWeather ? [...list].sort((a, b) => b.score - a.score) : [...list].sort((a, b) => preferCity(a, b) || a.alongKm - b.alongKm);
  const chosen = [];
  for (const c of order) {
    if (chosen.length >= count) break;
    if ([...chosen, ...taken].some((x) => Math.abs(x.alongKm - c.alongKm) < minGapKm || key(x) === key(c))) continue;
    chosen.push(c);
  }
  return chosen;
}

async function plan(input) {
  const { days, region, today, vias } = validate(input);
  // Local time zone of a place (all of Norway: Oslo time; Australia: by state).
  const tzOf = (p) => (region.id === 'au' ? region.tz(p.lat, p.lon) : region.tz());
  // MET Norway's terms require contact information before any weather request is made.
  if (!config.metContact) throw new PlanError('not_configured', 503);
  const { from, to, date } = input;
  const dates = Array.from({ length: days }, (_, i) => addDays(date, i));
  const lastForecastDate = addDays(today, config.limits.horizonDays);
  const hasForecast = (d) => dates[d] <= lastForecastDate;

  // With via points from the user, the route goes exactly through them (the user has chosen the roads);
  // otherwise Norway keeps the fastest route inside Norway.
  const route = vias.length ? { ...(await drivingRoute(from, ...vias, to)), vias: [] }
    : region.keepInside ? await norwegianRoute(from, to) : { ...(await drivingRoute(from, to)), vias: [] };
  if (route.km < 5) throw new PlanError('too_short');
  if (route.km / days < MIN_KM_PER_DAY) throw new PlanError('too_many_days');
  const segKm = route.km / days;
  const dayOf = (km) => Math.min(days - 1, Math.floor(km / segKm));

  // Towns along the route: wider spacing on long routes keeps the number of weather requests modest.
  const towns = townsAlongRoute(route.line, { binKm: Math.max(25, route.km / 60), towns: region.towns });
  // Weather only for places on days the forecast reaches.
  const needsWeather = (km) => hasForecast(dayOf(km)) || (dayOf(km) > 0 && hasForecast(dayOf(km) - 1));
  const forecasts = await mapLimit([
    { p: from, use: true }, { p: to, use: hasForecast(days - 1) },
    ...towns.map((t) => ({ p: t, use: needsWeather(t.alongKm) })),
  ], 8, ({ p, use }) => (use ? weather.forecast(p.lat, p.lon) : null));
  const [fFrom, fTo, ...fTowns] = forecasts;
  if (!fFrom && fTowns.every((f) => !f)) throw new PlanError('weather_unavailable', 502);
  let alertFeatures = [];
  // MET's official warnings cover Norway only.
  if (region.alerts) try { alertFeatures = await weather.alerts(input.lang); } catch { /* warnings are a bonus; the plan still works */ }

  const describe = (place, fc, dayIndex) => {
    const w = fc ? weather.daySummary(fc, dates[dayIndex], tzOf(place)) : null;
    return {
      name: place.name, altName: place.altName ?? null, municipality: place.municipality ?? place.detail ?? '', county: place.county ?? '', type: place.type ?? null,
      lat: place.lat, lon: place.lon, alongKm: place.alongKm ?? null, day: dayIndex,
      weather: w, score: weather.score(w), flags: weather.flags(w),
      alerts: w ? weather.alertsFor(alertFeatures, place.lat, place.lon, dates[dayIndex]) : [],
    };
  };

  const evaluated = towns.map((town, i) => ({ town, fc: fTowns[i] }));
  const all = evaluated.map(({ town, fc }) => describe(town, fc, dayOf(town.alongKm)));
  const scored = all.filter((s) => s.score !== null);

  const plannedDays = [];
  const taken = [];
  for (let d = 0; d < days; d++) {
    const forecast = hasForecast(d);
    const start = d === 0 ? 0 : plannedDays.at(-1).endKm;
    const prevKm = start;
    // Today's target: the remaining distance shared evenly over the remaining days.
    const daySeg = (route.km - start) / (days - d);
    const end = start + daySeg;

    // Overnight stop near the end of the day's driving (not on the last day).
    let overnight = null;
    if (d < days - 1) {
      const inWindow = evaluated.filter(({ town }) => town.alongKm > prevKm + 10 && town.alongKm >= end - 0.3 * daySeg && town.alongKm <= end + 0.2 * daySeg);
      const free = (list) => list.map(({ town, fc }) => describe(town, fc, d)).filter((s) => !taken.some((x) => key(x) === key(s)));
      const options = free(inWindow);
      const withWeather = preferTowns(options.filter((s) => s.score !== null));
      if (forecast && withWeather.length) {
        overnight = withWeather.sort((a, b) => b.score - a.score || Math.abs(a.alongKm - end) - Math.abs(b.alongKm - end))[0];
      } else {
        // No forecast (or no towns in the window): a town near the day's end point, cities first –
        // never more than half a day's drive away from it.
        const near = ({ town }) => town.alongKm > prevKm + 10 && Math.abs(town.alongKm - end) <= 0.5 * daySeg;
        const pool = preferTowns(options.length ? options : free(evaluated.filter(near)));
        overnight = pool.sort((a, b) => Math.abs(a.alongKm - end) - Math.abs(b.alongKm - end) + (preferCity(a, b) * 8))[0] ?? null;
      }
      if (overnight) { overnight.role = 'overnight'; overnight.day = d; }
    }

    // Stops during the day: the warmest and sunniest towns on the day's stretch, spaced apart.
    const endKm = overnight?.alongKm ?? end;
    const dayLen = endKm - prevKm;
    const count = dayLen >= 180 ? 2 : dayLen >= 60 ? 1 : 0;
    const lo = prevKm + 40;
    const hi = endKm - 25;
    const onStretch = (lo2, hi2) => evaluated.filter(({ town }) => town.alongKm > lo2 && town.alongKm < hi2).map(({ town, fc }) => describe(town, fc, d));
    const pool = preferTowns(onStretch(lo, hi).filter((s) => !forecast || s.score !== null), count);
    const visits = pickSpaced(pool, count, 50, [...taken, ...(overnight ? [overnight] : [])], forecast)
      .map((s) => ({ ...s, role: 'visit' }));
    const stops = [...visits.sort((a, b) => a.alongKm - b.alongKm), ...(overnight ? [overnight] : [])];
    taken.push(...stops);

    // Bad weather anywhere on the day's stretch (not only at the suggested stops).
    const stretch = onStretch(start - 10, endKm + 10).filter((s) => s.score !== null);
    const warnings = [];
    for (const s of stretch) {
      for (const a of s.alerts) if (!warnings.some((w) => w.kind === 'alert' && w.id === a.id && a.id)) warnings.push({ kind: 'alert', id: a.id, level: a.level, title: a.title, place: s.name });
      for (const f of s.flags) if (!warnings.some((w) => w.kind === f)) warnings.push({ kind: f, place: s.name });
    }

    const fromKm = d === 0 ? 0 : prevKm;
    const toKm = d === days - 1 ? route.km : endKm;
    plannedDays.push({
      index: d, date: dates[d], noForecast: !forecast, noOvernight: d < days - 1 && !overnight,
      km: Math.round(toKm - fromKm), hours: Math.round(((toKm - fromKm) / route.km) * route.hours * 10) / 10,
      endKm: toKm, stops, warnings: warnings.slice(0, 6),
    });
  }

  const startStop = { ...describe(from, fFrom, 0), role: 'start', alongKm: 0 };
  const endStop = { ...describe(to, fTo, days - 1), role: 'destination', alongKm: Math.round(route.km) };
  const everyStop = [startStop, ...plannedDays.flatMap((d) => d.stops), endStop].filter((s) => s.score !== null);
  const bestOverall = everyStop.length ? everyStop.reduce((a, b) => (b.score > a.score ? b : a)) : null;

  return {
    region: region.id,
    vias,
    from: startStop, to: endStop,
    route: { km: Math.round(route.km), hours: Math.round(route.hours * 10) / 10, line: simplify(route.line) },
    days: plannedDays.map(({ endKm, ...d }) => d),
    bestStop: bestOverall ? { name: bestOverall.name, day: bestOverall.day } : null,
    // Every town with weather, for the map (small dots coloured by weather).
    towns: scored.map((s) => ({ name: s.name, lat: s.lat, lon: s.lon, day: s.day, score: s.score, tempMax: s.weather.tempMax, cloud: s.weather.cloud, symbol: s.weather.symbol })),
    coarse: everyStop.some((s) => s.weather && !s.weather.hourly),
    lastForecastDate,
    updatedAt: fFrom?.properties?.meta?.updated_at ?? null,
  };
}

module.exports = { plan, PlanError, addDays, todayOslo, todayIn };
