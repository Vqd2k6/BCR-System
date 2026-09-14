const fs = require('fs');
const path = require('path');

const kmlPath = path.join(__dirname, 'metro_line2_raw.kml');
const kmlText = fs.readFileSync(kmlPath, 'utf8');

const placemarkRegex = /<Placemark>([\s\S]*?)<\/Placemark>/g;
let match;

let leftBoundary = null;
let rightBoundary = null;
const stationPolygons = [];

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

  if (pText.includes('<LineString>')) {
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
      } else if (name.includes('Depot') || name.includes('ST11') || (name.startsWith('Polygon') && coords.length >= 10)) {
        const avgLat = coords.reduce((a,b) => a + b[0], 0) / coords.length;
        const avgLng = coords.reduce((a,b) => a + b[1], 0) / coords.length;
        stationPolygons.push({
          rawName: name,
          coords: coords,
          center: [avgLat, avgLng]
        });
      }
    }
  }
}

// Sort from Ben Thanh (SE, max lng) to Tham Luong (NW, min lng)
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

const corridorLines = [];
if (leftBoundary) corridorLines.push(leftBoundary);
if (rightBoundary) corridorLines.push(rightBoundary);

const metroDataset = {
  title: 'Hệ Thống Đường Bao Ranh Gốc Tuyến Metro Số 2 (Bến Thành – Tham Lương)',
  source: 'Dữ liệu CAD/GIS ranh giải phóng mặt bằng chuẩn Ban QLDA Đường sắt Đô thị (MAUR)',
  corridorBoundaries: corridorLines,
  stationPolygons: stationPolygons, // All 11 station boxes unified
  stations: calculatedStations       // All 11 stations unified
};

const jsonTarget = path.join(__dirname, 'metro_boundary_data.json');
fs.writeFileSync(jsonTarget, JSON.stringify(metroDataset, null, 2));

const jsTarget = path.join(__dirname, '..', 'js', 'metro_boundary_data.js');
const jsCode = '/**\n * METRO LINE 2 OFFICIAL CAD/GIS BOUNDARIES & 11 STATIONS (UNIFIED)\n * Chuẩn hoá đồng nhất 11 ga Metro Số 2 từ CAD Ban Quản lý Đường sắt Đô thị (MAUR)\n */\nconst METRO_LINE2_OFFICIAL = ' + JSON.stringify(metroDataset) + ';\n\nif (typeof module !== "undefined") module.exports = METRO_LINE2_OFFICIAL;\n';
fs.writeFileSync(jsTarget, jsCode);

console.log('Successfully regenerated unified dataset with 11 unified equal stations (ST01 -> ST11)!');
