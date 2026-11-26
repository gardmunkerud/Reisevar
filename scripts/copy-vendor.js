// Copies Leaflet from node_modules into public/vendor/leaflet, so it is served as a static file.
// On Vercel, express.static() is ignored and only files in public/ are served (runs on install and build).
const fs = require('fs');
const path = require('path');

const from = path.join(__dirname, '..', 'node_modules', 'leaflet', 'dist');
const to = path.join(__dirname, '..', 'public', 'vendor', 'leaflet');
fs.rmSync(to, { recursive: true, force: true });
fs.cpSync(from, to, { recursive: true, filter: (src) => !src.endsWith('.map') && !src.includes('leaflet-src') });
console.log(`Copied Leaflet to ${path.relative(process.cwd(), to)}`);
