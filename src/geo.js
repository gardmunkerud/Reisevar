// Geometry helpers. Coordinates are [lon, lat] (GeoJSON order) unless named lat/lon.
const R = 6371; // km

const rad = (d) => (d * Math.PI) / 180;

function distanceKm(a, b) {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Cumulative distance (km) at each vertex of a line.
function cumulative(line) {
  const out = [0];
  for (let i = 1; i < line.length; i++) out.push(out[i - 1] + distanceKm(line[i - 1], line[i]));
  return out;
}

// Nearest position on the line for a point: { offKm (distance from the line), alongKm }.
// Uses a local flat projection, which is accurate enough at these distances.
function locateOnLine(point, line, cum = cumulative(line)) {
  const kx = 111.32 * Math.cos(rad(point[1]));
  const ky = 110.57;
  let best = { offKm: Infinity, alongKm: 0 };
  for (let i = 1; i < line.length; i++) {
    const ax = (line[i - 1][0] - point[0]) * kx;
    const ay = (line[i - 1][1] - point[1]) * ky;
    const bx = (line[i][0] - point[0]) * kx;
    const by = (line[i][1] - point[1]) * ky;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    const px = ax + t * dx;
    const py = ay + t * dy;
    const off = Math.hypot(px, py);
    if (off < best.offKm) best = { offKm: off, alongKm: cum[i - 1] + t * (cum[i] - cum[i - 1]) };
  }
  return best;
}

// The point `km` along the line.
function pointAt(line, km, cum = cumulative(line)) {
  if (km <= 0) return line[0];
  for (let i = 1; i < line.length; i++) {
    if (cum[i] >= km) {
      const f = (km - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
      return [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * f, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * f];
    }
  }
  return line.at(-1);
}

function bbox(line, padKm = 0) {
  let [minLon, minLat, maxLon, maxLat] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [lon, lat] of line) {
    minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
  }
  const dLat = padKm / 110.57;
  const dLon = padKm / (111.32 * Math.cos(rad((minLat + maxLat) / 2)));
  return [minLon - dLon, minLat - dLat, maxLon + dLon, maxLat + dLat];
}

// Point in polygon (GeoJSON Polygon / MultiPolygon), ray casting with holes.
function inRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inPolygon(pt, coords) {
  if (!coords?.length || !inRing(pt, coords[0])) return false;
  return !coords.slice(1).some((hole) => inRing(pt, hole));
}
function inGeometry(pt, geom) {
  if (!geom) return false;
  if (geom.type === 'Polygon') return inPolygon(pt, geom.coordinates);
  if (geom.type === 'MultiPolygon') return geom.coordinates.some((p) => inPolygon(pt, p));
  if (geom.type === 'GeometryCollection') return geom.geometries.some((g) => inGeometry(pt, g));
  return false;
}

module.exports = { distanceKm, cumulative, locateOnLine, pointAt, bbox, inGeometry };
