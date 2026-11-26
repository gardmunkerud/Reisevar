// Countries Reisevær covers: Norway and Australia.
// Each region has its own town list, time zone(s), place search and rules (Norway keeps routes inside Norway
// and has MET's official warnings; Australia has neither).
const path = require('path');

const load = (file) => require(path.join(__dirname, '..', 'data', file)).towns;

const REGIONS = {
  no: {
    id: 'no', bounds: { latMin: 57.5, latMax: 71.5, lonMin: 4, lonMax: 31.5 },
    towns: load('towns.json'), keepInside: true, alerts: true,
    tz: () => 'Europe/Oslo',
  },
  au: {
    id: 'au', bounds: { latMin: -44.5, latMax: -9, lonMin: 112, lonMax: 154.5 },
    towns: load('towns-au.json'), keepInside: false, alerts: false,
    tz: auTimeZone,
  },
};

// Australian time zone from the position (state borders approximated by their meridians/parallels):
// WA west of 129°E, NT north of 26°S between 129° and 138°, SA south of 26°S between 129° and 141°,
// Queensland east of 138° north of ~29°S, Tasmania south of 39.2°S, otherwise NSW/ACT/Victoria.
function auTimeZone(lat, lon) {
  if (lon < 129) return 'Australia/Perth';
  if (lat < -39.2 && lon > 143.5) return 'Australia/Hobart';
  if (lon < 138) return lat > -26 ? 'Australia/Darwin' : 'Australia/Adelaide';
  if (lon < 141 && lat <= -26) return 'Australia/Adelaide';
  if (lat > -29 + (lon > 151 ? 0.8 : 0)) return 'Australia/Brisbane'; // QLD/NSW border runs at ~29°S (~28.2°S on the coast)
  return 'Australia/Sydney';
}

function regionOf(p) {
  if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return null;
  for (const r of Object.values(REGIONS)) {
    const b = r.bounds;
    if (p.lat > b.latMin && p.lat < b.latMax && p.lon > b.lonMin && p.lon < b.lonMax) return r;
  }
  return null;
}

const byId = (id) => REGIONS[id] ?? REGIONS.no;

module.exports = { REGIONS, regionOf, byId, auTimeZone };
