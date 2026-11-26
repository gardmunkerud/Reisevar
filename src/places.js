// Place search and towns along a route.
// Norway: Kartverket (place names and addresses). Australia: our OpenStreetMap town list + Photon (OSM-based search).
const { getJson } = require('./http');
const { locateOnLine, cumulative, bbox, pointAt, distanceKm } = require('./geo');
const { REGIONS } = require('./regions');

const TOWNS = REGIONS.no.towns;

// Settlement-like place types first; nature names (lakes, mountains …) are left out of the search.
const TYPE_RANK = { By: 0, Tettsted: 1, Kommune: 2, Tettbebyggelse: 3, Bygdelag: 4, Bydel: 4, Grend: 5, Tettstaddel: 5,
  Turisthytte: 6, Flyplass: 6, Ferjekai: 6, Hotell: 6, Campingplass: 7, Gard: 8, Fjellområde: 9 };

const round = (n, d = 5) => Math.round(n * 10 ** d) / 10 ** d;

async function search(q, region = 'no') {
  if (region === 'au') return searchAustralia(q);
  const query = q.trim();
  if (query.length < 2) return [];
  const term = encodeURIComponent(/[\s*]$/.test(q) || /\d/.test(query) ? query : `${query}*`);
  const jobs = [getJson(`https://api.kartverket.no/stedsnavn/v1/navn?sok=${term}&fuzzy=true&treffPerSide=30&utkoordsys=4258`, { service: 'kartverket', defaultTtl: 864e5 })];
  if (/\d/.test(query) || query.includes(' ')) {
    jobs.push(getJson(`https://ws.geonorge.no/adresser/v1/sok?sok=${encodeURIComponent(query)}&fuzzy=true&treffPerSide=6&utkoordsys=4258`, { service: 'kartverket', defaultTtl: 864e5 }));
  }
  const [names, addresses] = await Promise.allSettled(jobs);
  const out = [];
  if (addresses?.status === 'fulfilled') {
    for (const a of addresses.value.adresser ?? []) {
      const p = a.representasjonspunkt;
      if (!p) continue;
      out.push({ name: a.adressetekst, detail: `${a.postnummer ?? ''} ${titleCase(a.poststed ?? '')}`.trim(), kind: 'address', lat: round(p.lat), lon: round(p.lon), rank: -1 });
    }
  }
  if (names.status === 'fulfilled') {
    for (const n of names.value.navn ?? []) {
      const rank = TYPE_RANK[n.navneobjekttype];
      const p = n.representasjonspunkt;
      if (rank === undefined || !p) continue;
      out.push({
        name: n.skrivemåte, detail: [n.kommuner?.[0]?.kommunenavn, n.fylker?.[0]?.fylkesnavn].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i && v !== n.skrivemåte).join(', '),
        kind: n.navneobjekttype, lat: round(p.nord), lon: round(p.øst), rank,
      });
    }
  } else if (!out.length) {
    throw names.reason;
  }
  // Exact name matches first, then by type; remove duplicates (same name within ~2 km).
  const lower = query.toLowerCase();
  out.sort((a, b) => (b.name.toLowerCase() === lower) - (a.name.toLowerCase() === lower) || a.rank - b.rank);
  const unique = [];
  for (const p of out) {
    if (!unique.some((u) => u.name === p.name && Math.abs(u.lat - p.lat) < 0.02 && Math.abs(u.lon - p.lon) < 0.04)) unique.push(p);
  }
  return unique.slice(0, 8).map(({ rank, ...p }) => p);
}

// Australia: towns from our list whose name starts with the query (largest first), then Photon for
// suburbs, localities and addresses. Photon is limited to Australia with a bounding box.
const AU_RANK = { city: 0, town: 1, village: 2 };
const fold = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
async function searchAustralia(q) {
  const query = q.trim();
  if (query.length < 2) return [];
  const f = fold(query);
  const local = REGIONS.au.towns
    .filter((t) => fold(t.name).startsWith(f))
    .sort((a, b) => (fold(b.name) === f) - (fold(a.name) === f) || AU_RANK[a.type] - AU_RANK[b.type] || (b.population ?? 0) - (a.population ?? 0))
    .slice(0, 6)
    .map((t) => ({ name: t.name, detail: t.municipality, kind: t.type, lat: t.lat, lon: t.lon }));
  let remote = [];
  try {
    const b = REGIONS.au.bounds;
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=8&lang=en&bbox=${b.lonMin},${b.latMin},${b.lonMax},${b.latMax}`;
    const data = await getJson(url, { service: 'photon', defaultTtl: 864e5 });
    for (const ft of data.features ?? []) {
      const pr = ft.properties ?? {};
      const [lon, lat] = ft.geometry?.coordinates ?? [];
      if (pr.countrycode !== 'AU' || !Number.isFinite(lat)) continue;
      const street = pr.street ? `${pr.street}${pr.housenumber ? ` ${pr.housenumber}` : ''}` : null;
      const name = pr.name ?? street;
      if (!name) continue;
      remote.push({ name, detail: [pr.name && street, pr.city !== pr.name ? pr.city : null, pr.state].filter(Boolean).join(', '), kind: pr.osm_value ?? pr.type ?? 'place', lat: round(lat), lon: round(lon) });
    }
  } catch (err) {
    if (!local.length) throw err;
  }
  const out = [];
  for (const p of [...local, ...remote]) {
    if (!out.some((u) => u.name === p.name && Math.abs(u.lat - p.lat) < 0.05 && Math.abs(u.lon - p.lon) < 0.05)) out.push(p);
  }
  return out.slice(0, 8);
}

function titleCase(s) { return s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase()); }

// Towns near the route, with their position along it.
// Keeps at most `perBin` towns per `binKm` stretch of road (cities preferred) so the number of
// weather requests stays modest.
const TYPE_ORDER = { city: 0, town: 1, village: 2 };
function townsAlongRoute(line, { maxOffKm = 12, skipEndsKm = 15, binKm = 25, perBin = 2, towns = TOWNS } = {}) {
  const cum = cumulative(line);
  const total = cum.at(-1);
  const [minLon, minLat, maxLon, maxLat] = bbox(line, maxOffKm + 2);
  const near = [];
  for (const t of towns) {
    if (t.lon < minLon || t.lon > maxLon || t.lat < minLat || t.lat > maxLat) continue;
    const pos = locateOnLine([t.lon, t.lat], line, cum);
    if (pos.offKm > maxOffKm || pos.alongKm < skipEndsKm || pos.alongKm > total - skipEndsKm) continue;
    near.push({ ...t, alongKm: Math.round(pos.alongKm), offKm: Math.round(pos.offKm * 10) / 10 });
  }
  const bins = new Map();
  for (const t of near) {
    const b = Math.floor(t.alongKm / binKm);
    if (!bins.has(b)) bins.set(b, []);
    bins.get(b).push(t);
  }
  const picked = [];
  for (const list of bins.values()) {
    list.sort((a, b) => (TYPE_ORDER[a.type] ?? 1) - (TYPE_ORDER[b.type] ?? 1) || a.offKm - b.offKm);
    picked.push(...list.slice(0, perBin));
  }
  return picked.sort((a, b) => a.alongKm - b.alongKm);
}

// Longest stretch of the route (km) with no Norwegian town within `nearKm` – typically where the
// fastest route leaves Norway (e.g. through Sweden). Returns { km, midKm } or null.
const GRID = new Map(); // 0.5° cells -> towns
for (const t of TOWNS) {
  const k = `${Math.floor(t.lat * 2)},${Math.floor(t.lon * 2)}`;
  if (!GRID.has(k)) GRID.set(k, []);
  GRID.get(k).push(t);
}
function townNear(lon, lat, nearKm) {
  const cy = Math.floor(lat * 2);
  const cx = Math.floor(lon * 2);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      for (const t of GRID.get(`${cy + dy},${cx + dx}`) ?? []) if (distanceKm([lon, lat], [t.lon, t.lat]) <= nearKm) return true;
    }
  }
  return false;
}
function largestGap(line, { stepKm = 5, nearKm = 20 } = {}) {
  const cum = cumulative(line);
  const total = cum.at(-1);
  let best = null;
  let runStart = null;
  for (let km = 0; km <= total + stepKm; km += stepKm) {
    const k = Math.min(km, total);
    const [lon, lat] = pointAt(line, k, cum);
    const covered = km > total || townNear(lon, lat, nearKm);
    if (!covered && runStart === null) runStart = k;
    if (covered && runStart !== null) {
      const len = k - runStart;
      if (!best || len > best.km) best = { km: len, midKm: runStart + len / 2 };
      runStart = null;
    }
  }
  return best;
}

// Nearest Norwegian city to a point (used as a via point to keep the route in Norway).
function nearestCity([lon, lat], exclude = []) {
  let best = null;
  for (const t of TOWNS) {
    if (t.type !== 'city' || exclude.some((e) => e.name === t.name && e.lat === t.lat)) continue;
    const d = distanceKm([lon, lat], [t.lon, t.lat]);
    if (!best || d < best.d) best = { d, town: t };
  }
  return best;
}

module.exports = { search, townsAlongRoute, largestGap, nearestCity, TOWNS };
