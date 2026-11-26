// Builds data/towns.json: all cities ("by") and urban settlements ("tettsted") in mainland Norway,
// from Kartverket's place-name register (Sentralt stedsnavnregister, CC BY 4.0).
// Run with: npm run build:towns   (only needed when the list should be refreshed)
const fs = require('fs');
const path = require('path');

const UA = { headers: { 'User-Agent': 'Reisevaer/0.1 (town list builder)' } };
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ'.split('');
const TYPES = ['by', 'tettsted'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function page(type, letter, side) {
  const url = `https://api.kartverket.no/stedsnavn/v1/sted?sok=${encodeURIComponent(`${letter}*`)}&navneobjekttype=${type}`
    + `&treffPerSide=500&side=${side}&utkoordsys=4258`;
  const res = await fetch(url, UA);
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res.json();
}

(async () => {
  const byId = new Map();
  for (const type of TYPES) {
    for (const letter of LETTERS) {
      for (let side = 1; ; side++) {
        const data = await page(type, letter, side);
        for (const s of data.navn ?? []) {
          // Prefer the Norwegian name (tourists know Snåsa better than Snåase); keep the main name as an alternative.
          const names = s.stedsnavn ?? [];
          const main = names.find((n) => n.navnestatus === 'hovednavn') ?? names[0];
          const norsk = names.find((n) => n.språk === 'Norsk' && n.skrivemåtestatus !== 'historisk') ?? null;
          const name = (norsk ?? main)?.skrivemåte;
          const altName = main && norsk && main.skrivemåte !== norsk.skrivemåte ? main.skrivemåte : undefined;
          const p = s.representasjonspunkt;
          if (!name || !p || s.stedstatus !== 'aktiv' || !s.kommuner?.length) continue;
          const lat = p.nord;
          const lon = p.øst;
          if (lat < 57.9 || lat > 71.3 || lon < 4.4 || lon > 31.3) continue; // mainland Norway
          byId.set(s.stedsnummer, {
            name, ...(altName ? { altName } : {}), type: s.navneobjekttype === 'By' ? 'city' : 'town',
            municipality: s.kommuner[0].kommunenavn, county: s.fylker?.[0]?.fylkesnavn ?? '',
            lat: Math.round(lat * 1e5) / 1e5, lon: Math.round(lon * 1e5) / 1e5,
          });
        }
        const total = data.metadata?.totaltAntallTreff ?? 0;
        process.stdout.write(`\r${type} ${letter} side ${side}: ${byId.size} places   `);
        await sleep(150);
        if (side * 500 >= total) break;
      }
    }
  }
  const towns = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'nb'));
  const out = path.join(__dirname, '..', 'data', 'towns.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ source: 'Kartverket, Sentralt stedsnavnregister (CC BY 4.0)', built: new Date().toISOString().slice(0, 10), towns }));
  console.log(`\nWrote ${towns.length} places to ${out}`);
})().catch((err) => { console.error(err); process.exit(1); });
