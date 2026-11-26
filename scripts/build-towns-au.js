// Builds data/towns-au.json: cities, towns and villages in Australia from OpenStreetMap (© OpenStreetMap contributors, ODbL),
// fetched state by state through the Overpass API so every place gets its state.
// Run with: npm run build:towns:au   (only needed when the list should be refreshed)
const fs = require('fs');
const path = require('path');

const UA = { 'User-Agent': 'Reisevaer/0.1 (town list builder)', 'Content-Type': 'application/x-www-form-urlencoded' };
const STATES = [['AU-NSW', 'New South Wales', 'NSW'], ['AU-VIC', 'Victoria', 'VIC'], ['AU-QLD', 'Queensland', 'QLD'], ['AU-SA', 'South Australia', 'SA'],
  ['AU-WA', 'Western Australia', 'WA'], ['AU-TAS', 'Tasmania', 'TAS'], ['AU-NT', 'Northern Territory', 'NT'], ['AU-ACT', 'Australian Capital Territory', 'ACT']];
const TYPE = { city: 'city', town: 'town', village: 'village' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchState(code) {
  const query = `[out:json][timeout:180];area["ISO3166-2"="${code}"]->.s;node(area.s)["place"~"^(city|town|village)$"]["name"];out;`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: UA, body: `data=${encodeURIComponent(query)}` });
    if (res.ok) return (await res.json()).elements ?? [];
    console.warn(`  ${code}: HTTP ${res.status}, retrying`);
    await sleep(attempt * 15000);
  }
  throw new Error(`Overpass failed for ${code}`);
}

(async () => {
  const towns = [];
  const seen = new Set();
  for (const [code, state, abbr] of STATES) {
    const els = await fetchState(code);
    let n = 0;
    for (const e of els) {
      const t = e.tags ?? {};
      const name = t['name:en'] || t.name;
      const key = `${name}|${e.lat.toFixed(2)}|${e.lon.toFixed(2)}`;
      if (!name || seen.has(key)) continue;
      seen.add(key);
      const pop = parseInt(String(t.population ?? '').replace(/[^\d]/g, ''), 10);
      towns.push({
        name, type: TYPE[t.place], municipality: state, county: abbr,
        ...(Number.isFinite(pop) ? { population: pop } : {}),
        lat: Math.round(e.lat * 1e5) / 1e5, lon: Math.round(e.lon * 1e5) / 1e5,
      });
      n++;
    }
    console.log(`${state}: ${n} places`);
    await sleep(5000); // be gentle with the public Overpass server
  }
  towns.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const out = path.join(__dirname, '..', 'data', 'towns-au.json');
  fs.writeFileSync(out, JSON.stringify({ source: 'OpenStreetMap contributors (ODbL), via Overpass API', built: new Date().toISOString().slice(0, 10), towns }));
  console.log(`Wrote ${towns.length} places to ${out}`);
})().catch((err) => { console.error(err); process.exit(1); });
