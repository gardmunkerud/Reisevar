// Driving route from an OSRM-compatible service (default: FOSSGIS, based on OpenStreetMap).
const config = require('./config');
const { getJson, UpstreamError } = require('./http');

// `points`: start, optional via points, destination – each { lat, lon }.
async function drivingRoute(...points) {
  const coords = points.flat().map((p) => `${p.lon.toFixed(5)},${p.lat.toFixed(5)}`).join(';');
  const url = `${config.routingUrl}/route/v1/driving/${coords}?overview=full&geometries=geojson&alternatives=false&steps=false`;
  const data = await getJson(url, { service: 'routing', defaultTtl: 6 * 3600e3, timeout: 25000 });
  const route = data.routes?.[0];
  if (data.code !== 'Ok' || !route) throw new UpstreamError('no_route', 422, 'routing');
  return { line: route.geometry.coordinates, km: route.distance / 1000, hours: route.duration / 3600 };
}

// Fewer points for the map (every point within ~100 m of the line is enough on screen).
function simplify(line, everyKm = 0.3) {
  const out = [line[0]];
  let acc = 0;
  for (let i = 1; i < line.length - 1; i++) {
    const [a, b] = [line[i - 1], line[i]];
    acc += Math.hypot((b[0] - a[0]) * 55, (b[1] - a[1]) * 111);
    if (acc >= everyKm) { out.push(b); acc = 0; }
  }
  out.push(line.at(-1));
  return out.map(([lon, lat]) => [Math.round(lat * 1e5) / 1e5, Math.round(lon * 1e5) / 1e5]); // Leaflet order
}

module.exports = { drivingRoute, simplify };
