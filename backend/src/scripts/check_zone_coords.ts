import fs from 'fs';
import path from 'path';

const zones = ['Zone_01', 'Zone_02', 'Zone_03', 'Zone_04', 'Zone_09'];

for (const z of zones) {
  const p = path.resolve(__dirname, `../../../data/${z}/ban_do_data.json`);
  if (!fs.existsSync(p)) {
    console.log(`Not found: ${z}`);
    continue;
  }
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  const parcels = Object.values(raw.parcels || {}) as any[];
  const valid = parcels.filter(p => p.latitude && p.longitude);
  if (valid.length === 0) {
    console.log(`${z}: 0 valid parcels`);
    continue;
  }
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  let sumLat = 0, sumLng = 0;
  for (const v of valid) {
    minLat = Math.min(minLat, v.latitude);
    maxLat = Math.max(maxLat, v.latitude);
    minLng = Math.min(minLng, v.longitude);
    maxLng = Math.max(maxLng, v.longitude);
    sumLat += v.latitude;
    sumLng += v.longitude;
  }
  console.log(`${z}: ${valid.length} parcels. Center: [${(sumLat/valid.length).toFixed(6)}, ${(sumLng/valid.length).toFixed(6)}], Bounds: [${minLat.toFixed(5)}, ${minLng.toFixed(5)}] to [${maxLat.toFixed(5)}, ${maxLng.toFixed(5)}]`);
}
