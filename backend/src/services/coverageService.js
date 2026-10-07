// A deterministic spiral visits fresh 5 km squares before revisiting any of
// them. This is a sampling plan, not a claim that every business was indexed.
const gridSide = 21;
const tileKm = 5;
export const maxCoverageTiles = gridSide * gridSide;

export function coverageKey(value) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function centerFromPlaces(places) {
  const points = places.map(place => place.location).filter(point =>
    Number.isFinite(point?.latitude) && Number.isFinite(point?.longitude));
  if (!points.length) return null;
  return {
    latitude: points.reduce((sum, point) => sum + point.latitude, 0) / points.length,
    longitude: points.reduce((sum, point) => sum + point.longitude, 0) / points.length,
  };
}

export function tileAt(index, center) {
  if (!Number.isInteger(index) || index < 0 || index >= maxCoverageTiles) return null;
  let x = 0; let y = 0; let dx = 1; let dy = 0; let leg = 1; let progress = 0; let turns = 0;
  for (let step = 0; step < index; step += 1) {
    x += dx; y += dy; progress += 1;
    if (progress === leg) {
      progress = 0; [dx, dy] = [-dy, dx]; turns += 1;
      if (turns % 2 === 0) leg += 1;
    }
  }
  const latKm = 111.32;
  const lonKm = latKm * Math.max(Math.cos(center.latitude * Math.PI / 180), 0.2);
  const halfLat = tileKm / (2 * latKm);
  const halfLon = tileKm / (2 * lonKm);
  const latitude = center.latitude + y * tileKm / latKm;
  const longitude = center.longitude + x * tileKm / lonKm;
  return {
    index, x, y, latitude, longitude,
    rectangle: {
      low: { latitude: latitude - halfLat, longitude: longitude - halfLon },
      high: { latitude: latitude + halfLat, longitude: longitude + halfLon },
    },
  };
}
