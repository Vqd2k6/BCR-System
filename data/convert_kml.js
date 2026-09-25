const fs = require('fs');
const path = require('path');

const kmlPath = path.join(__dirname, 'metro_line2_raw.kml');
const kmlText = fs.readFileSync(kmlPath, 'utf8');

const placemarkRegex = /<Placemark>([\s\S]*?)<\/Placemark>/g;
let match;

let leftBoundary = null;
let rightBoundary = null;
const allPolygons = [];

const STATIONS_METADATA = [
  { code: 'ST01', name: 'Ga Bến Thành (ST01)', type: 'Ga ngầm trung tâm (Kết nối Metro 1, 2, 3A, 4)', km: 'KM0+000', desc: 'Công viên 23/9 – Chợ Bến Thành, Quận 1' },
  { code: 'ST02', name: 'Ga Tao Đàn (ST02)', type: 'Ga ngầm 2 tầng (Công viên Tao Đàn - CMT8)', km: 'KM1+035', desc: 'Khu vực Công viên Tao Đàn, Trương Định - CMT8, Quận 1' },
  { code: 'ST03', name: 'Ga Dân Chủ (ST03)', type: 'Ga ngầm 2 tầng (Vòng xoay Dân Chủ)', km: 'KM2+000', desc: 'Vòng xoay Dân Chủ, CMT8 - Ba Tháng Hai - Võ Thị Sáu, Quận 3 / Q.10' },
  { code: 'ST04', name: 'Ga Hòa Hưng (ST04)', type: 'Ga ngầm 2 tầng (Ga Sài Gòn / Hòa Hưng)', km: 'KM3+078', desc: 'Khu vực Ga Sài Gòn / Hòa Hưng, CMT8, Quận 3' },
  { code: 'ST05', name: 'Ga Lê Thị Riêng (ST05)', type: 'Ga ngầm 2 tầng (Công viên Lê Thị Riêng)', km: 'KM4+090', desc: 'Công viên Lê Thị Riêng, CMT8, Quận 10' },
  { code: 'ST06', name: 'Ga Phạm Văn Hai (ST06)', type: 'Ga ngầm 2 tầng (CMT8 - Phạm Văn Hai)', km: 'KM4+808', desc: 'Giao lộ CMT8 - Phạm Văn Hai, Quận Tân Bình' },
  { code: 'ST07', name: 'Ga Bảy Hiền (ST07)', type: 'Ga ngầm 3 tầng (Nút giao Bảy Hiền - Kết nối Tuyến 5)', km: 'KM5+500', desc: 'Ngã tư Bảy Hiền, Hoàng Văn Thụ - Lý Thường Kiệt - Trường Chinh, Tân Bình' },
  { code: 'ST08', name: 'Ga Nguyễn Hồng Đào (ST08)', type: 'Ga ngầm 2 tầng (Trường Chinh - Nguyễn Hồng Đào)', km: 'KM6+700', desc: 'Giao lộ Trường Chinh - Nguyễn Hồng Đào, Tân Bình' },
  { code: 'ST09', name: 'Ga Bà Quẹo (ST09)', type: 'Ga ngầm 2 tầng (Mũi Tàu Trường Chinh - Cộng Hòa)', km: 'KM7+900', desc: 'Mũi Tàu Trường Chinh - Cộng Hòa, Tân Bình / Tân Phú' },
  { code: 'ST10', name: 'Ga Phạm Văn Bạch (ST10)', type: 'Ga ngầm 2 tầng (Trường Chinh - Phạm Văn Bạch)', km: 'KM9+050', desc: 'Giao lộ Trường Chinh - Phạm Văn Bạch, Tân Bình / Quận 12' },
  { code: 'ST11', name: 'Ga Tân Bình (ST11)', type: 'Ga ngầm 2 tầng & Chuyển tiếp (Ga Tân Bình - Tham Lương)', km: 'KM10+100', desc: 'Khu vực Ga Tân Bình, Phường Tân Thới Nhất, Quận 12' }
];

while ((match = placemarkRegex.exec(kmlText)) !== null) {
  const pText = match[1];
  const nameMatch = pText.match(/<name>(.*?)<\/name>/);
  const name = nameMatch ? nameMatch[1].trim() : '';

  if (pText.includes('<LineString>') || pText.includes('<Polygon>')) {
    const coordMatch = pText.match(/<coordinates>([\s\S]*?)<\/coordinates>/);
    if (coordMatch) {
      const coords = coordMatch[1].trim().split(/\s+/).map(c => {
        const parts = c.split(',').map(Number);
        return [parts[1], parts[0]]; // [lat, lng]
      }).filter(c => !isNaN(c[0]) && !isNaN(c[1]));

      if (name === 'Polyline_002' && coords.length > 2500) {
        leftBoundary = { name: 'Ranh Giải Phóng Mặt Bằng Tả Tuyến (Left Boundary)', coords };
      } else if (name === 'Polyline_002' && coords.length > 1500) {
        rightBoundary = { name: 'Ranh Giải Phóng Mặt Bằng Hữu Tuyến (Right Boundary)', coords };
      } else if (coords.length >= 10 && coords.length < 1500) {
        // Exclude tiny duplicate fragments (like index 10,11,14,15 which are small 19-pt sub-boxes)
        const avgLat = coords.reduce((a,b) => a + b[0], 0) / coords.length;
        const avgLng = coords.reduce((a,b) => a + b[1], 0) / coords.length;
        allPolygons.push({
          rawName: name,
          coords: coords,
          center: [avgLat, avgLng]
        });
      }
    }
  }
}

// Filter out minor sub-duplicate polylines (pts < 25 if close to another segment)
const cleanedPolygons = [];
allPolygons.sort((a,b) => b.center[1] - a.center[1]);
for (const poly of allPolygons) {
  if (poly.coords.length <= 20 && poly.rawName === 'Polyline_001') {
    continue; // skip small 19/20-pt auxiliary lines
  }
  cleanedPolygons.push(poly);
}

// 1. Separate Station Boxes vs TBM / Tunnel segments
const stationPolygons = [];
const tbmPolygons = [];

cleanedPolygons.forEach((poly) => {
  // Station boxes are identifiable by being compact station shapes (e.g. Polygon_001, Polyline_005 at stations, ST11)
  if (
    poly.rawName.startsWith('Polygon_001') ||
    (poly.rawName.startsWith('Polyline_005') && poly.coords.length === 16) ||
    poly.rawName.includes('ST11') ||
    poly.rawName.includes('Depot')
  ) {
    stationPolygons.push(poly);
  } else {
    tbmPolygons.push(poly);
  }
});

// Sort stations SE -> NW
stationPolygons.sort((a,b) => b.center[1] - a.center[1]);

const calculatedStations = [];
stationPolygons.forEach((poly, idx) => {
  const meta = STATIONS_METADATA[idx] || {
    code: `ST${idx+1 < 10 ? '0' : ''}${idx+1}`,
    name: `Ga Metro Số 2 (ST${idx+1 < 10 ? '0' : ''}${idx+1})`,
    type: 'Ga Metro',
    km: '',
    desc: 'Hộp ga tuyến Metro Số 2'
  };

  poly.name = meta.name;
  poly.code = meta.code;
  poly.type = meta.type;
  poly.desc = meta.desc;
  poly.km = meta.km;

  calculatedStations.push({
    code: meta.code,
    name: meta.name,
    type: meta.type,
    km: meta.km,
    desc: meta.desc,
    pos: [poly.center[0], poly.center[1]]
  });
});

// 2. Compute TRUE CENTERLINE directly between the two blue parallel lines (Tả Tuyến & Hữu Tuyến)
function distSq(p1, p2) {
  const dLat = p1[0] - p2[0];
  const dLng = (p1[1] - p2[1]) * Math.cos(p1[0] * Math.PI / 180);
  return dLat * dLat + dLng * dLng;
}

function closestPointOnSegment(p, a, b) {
  const abLat = b[0] - a[0];
  const abLng = (b[1] - a[1]) * Math.cos(a[0] * Math.PI / 180);
  const apLat = p[0] - a[0];
  const apLng = (p[1] - a[1]) * Math.cos(a[0] * Math.PI / 180);
  const abLenSq = abLat * abLat + abLng * abLng;
  if (abLenSq === 0) return a;
  const t = Math.max(0, Math.min(1, (apLat * abLat + apLng * abLng) / abLenSq));
  return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
}

function closestOnPolyline(p, polyline) {
  let minDist = Infinity;
  let bestPt = polyline[0];
  for (let i = 0; i < polyline.length - 1; i++) {
    const pt = closestPointOnSegment(p, polyline[i], polyline[i+1]);
    const d = distSq(p, pt);
    if (d < minDist) {
      minDist = d;
      bestPt = pt;
    }
  }
  return bestPt;
}

const trueCenterline = [];
if (leftBoundary && rightBoundary) {
  let lastAdded = null;
  const MIN_DIST_SQ = (5 / 111320) * (5 / 111320); // ~5m sampling for high precision smooth curves
  for (let i = 0; i < leftBoundary.coords.length; i++) {
    const pLeft = leftBoundary.coords[i];
    if (!lastAdded || distSq(pLeft, lastAdded) >= MIN_DIST_SQ || i === leftBoundary.coords.length - 1) {
      const pRight = closestOnPolyline(pLeft, rightBoundary.coords);
      const mid = [
        Math.round(((pLeft[0] + pRight[0]) / 2) * 1e6) / 1e6,
        Math.round(((pLeft[1] + pRight[1]) / 2) * 1e6) / 1e6
      ];
      trueCenterline.push(mid);
      lastAdded = pLeft;
    }
  }
}

// 3. Complete segments collection (both station boxes and TBM tunnel boundaries)
const allCorridorSegments = cleanedPolygons.map((p, idx) => ({
  id: `SEG_${idx + 1 < 10 ? '0' : ''}${idx + 1}`,
  name: p.name || p.rawName,
  coords: p.coords,
  center: p.center,
  isStation: !!p.code,
  code: p.code || `TBM_${idx + 1}`,
}));

const corridorLines = [];
if (leftBoundary) corridorLines.push(leftBoundary);
if (rightBoundary) corridorLines.push(rightBoundary);

const metroDataset = {
  title: 'Hệ Thống Đường Bao Ranh Gốc Tuyến Metro Số 2 (Bến Thành – Tham Lương)',
  source: 'Dữ liệu CAD/GIS ranh giải phóng mặt bằng chuẩn Ban QLDA Đường sắt Đô thị (MAUR)',
  corridorBoundaries: corridorLines,
  centerline: trueCenterline,          // True median centerline running between the two blue lines
  stationPolygons: stationPolygons,     // 11 station boxes from CAD
  tbmPolygons: tbmPolygons,             // Continuous TBM tunnel polygons from CAD
  allCorridorSegments: allCorridorSegments,
  stations: calculatedStations
};

const jsonTarget = path.join(__dirname, 'metro_boundary_data.json');
fs.writeFileSync(jsonTarget, JSON.stringify(metroDataset, null, 2));

// Copy to frontend constants as well
const frontendJsonTarget = path.join(__dirname, '../frontend/src/features/survey-phase1/constants/metro_boundary_data.json');
fs.writeFileSync(frontendJsonTarget, JSON.stringify(metroDataset, null, 2));

console.log(`✅ Successfully generated authentic Metro 2 dataset:`);
console.log(` - Corridor boundaries: 2 lines (${leftBoundary.coords.length} & ${rightBoundary.coords.length} pts)`);
console.log(` - True centerline: ${trueCenterline.length} smooth points`);
console.log(` - Stations: ${calculatedStations.length} stations`);
console.log(` - TBM segments: ${tbmPolygons.length} TBM tunnel sections`);
console.log(` - Total corridor segments: ${allCorridorSegments.length} segments`);
