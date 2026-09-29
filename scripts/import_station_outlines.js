const fs = require('fs');
const path = require('path');

const kmlPath = path.join(__dirname, '../data/mrt2_mymaps.kml');
if (!fs.existsSync(kmlPath)) {
  console.error('KML file not found at:', kmlPath);
  process.exit(1);
}

const kmlText = fs.readFileSync(kmlPath, 'utf8');

const STATION_META = {
  ST01: { code: 'ST01', name: 'Ga Bến Thành (ST01) – Phác họa công trình', desc: 'Thân ga ngầm trung tâm, 6 lối lên xuống kết nối Công viên 23/9, Chợ Bến Thành & các tuyến Metro 1, 3A, 4' },
  ST02: { code: 'ST02', name: 'Ga Tao Đàn (ST02) – Phác họa công trình', desc: 'Thân ga ngầm 2 tầng, lối lên xuống kết nối Công viên Tao Đàn, đường Trương Định & CMT8' },
  ST03: { code: 'ST03', name: 'Ga Dân Chủ (ST03) – Phác họa công trình', desc: 'Thân ga ngầm 2 tầng, cụm lối tiếp cận vòng xoay Dân Chủ, Ba Tháng Hai & Võ Thị Sáu' },
  ST04: { code: 'ST04', name: 'Ga Hòa Hưng (ST04) – Phác họa công trình', desc: 'Thân ga ngầm 2 tầng, lối kết nối Ga xe lửa Sài Gòn & đường CMT8' },
  ST05: { code: 'ST05', name: 'Ga Lê Thị Riêng (ST05) – Phác họa công trình', desc: 'Thân ga ngầm 2 tầng, lối tiếp cận Công viên Lê Thị Riêng & đường CMT8' },
  ST06: { code: 'ST06', name: 'Ga Phạm Văn Hai (ST06) – Phác họa công trình', desc: 'Thân ga ngầm 2 tầng, các cửa hầm tiếp cận ngã ba CMT8 - Phạm Văn Hai' },
  ST07: { code: 'ST07', name: 'Ga Bảy Hiền (ST07) – Phác họa công trình', desc: 'Thân ga ngầm 3 tầng, hệ thống lối kết nối ngã tư Bảy Hiền (Hoàng Văn Thụ - Lý Thường Kiệt - Trường Chinh, trung chuyển Tuyến 5)' },
  ST08: { code: 'ST08', name: 'Ga Nguyễn Hồng Đào (ST08) – Phác họa công trình', desc: 'Thân ga ngầm 2 tầng, các lối lên xuống dọc trục Trường Chinh - Nguyễn Hồng Đào' },
  ST09: { code: 'ST09', name: 'Ga Bà Quẹo (ST09) – Phác họa công trình', desc: 'Thân ga ngầm 2 tầng, cụm cửa đón trả khách khu vực Mũi Tàu Trường Chinh - Cộng Hòa' },
  ST10: { code: 'ST10', name: 'Ga Phạm Văn Bạch (ST10) – Phác họa công trình', desc: 'Thân ga ngầm 2 tầng, các cửa đón tiếp trục Trường Chinh - Phạm Văn Bạch' },
  ST11: { code: 'ST11', name: 'Ga Tân Bình (ST11) – Phác họa công trình', desc: 'Thân ga ngầm 2 tầng & kết cấu chuyển tiếp hầm hở (U-Turn / Portal) dẫn vào Depot Tham Lương' },
  DEP: { code: 'DEP', name: 'Depot Tham Lương – Ranh khuôn viên kỹ thuật', desc: 'Khu trung tâm điều hành OCC, xưởng bảo dưỡng, bãi đỗ đoàn tàu diện tích 25.7 ha' }
};

const placemarkRegex = /<Placemark>([\s\S]*?)<\/Placemark>/g;
let match;
const detailedFootprints = [];

while ((match = placemarkRegex.exec(kmlText)) !== null) {
  const pText = match[1];
  const nameMatch = pText.match(/<name>(.*?)<\/name>/);
  const rawName = nameMatch ? nameMatch[1].trim() : '';

  if (rawName.includes('đường bao ngoài') || rawName.includes('biên dạng khu đất')) {
    const coordsMatch = pText.match(/<coordinates>([\s\S]*?)<\/coordinates>/);
    if (!coordsMatch) continue;

    const coords = coordsMatch[1].trim().split(/\s+/).map((c) => {
      const parts = c.split(',').map(Number);
      return [Number(parts[1].toFixed(6)), Number(parts[0].toFixed(6))];
    }).filter((c) => !isNaN(c[0]) && !isNaN(c[1]));

    if (coords.length < 3) continue;

    // Ensure 100% closed polygon
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      coords.push([first[0], first[1]]);
    }

    const codeMatch = rawName.match(/ST\d{2}/);
    const code = codeMatch ? codeMatch[0] : (rawName.includes('Depot') ? 'DEP' : 'UNKNOWN');
    const meta = STATION_META[code] || { code, name: rawName, desc: 'Phác họa công trình' };

    const avgLat = Number((coords.reduce((a, b) => a + b[0], 0) / coords.length).toFixed(6));
    const avgLng = Number((coords.reduce((a, b) => a + b[1], 0) / coords.length).toFixed(6));

    detailedFootprints.push({
      code: meta.code,
      name: meta.name,
      rawName,
      desc: meta.desc,
      coords,
      center: [avgLat, avgLng],
      pointCount: coords.length,
      type: meta.code === 'DEP' ? 'DEPOT_OUTLINE' : 'STATION_OUTLINE'
    });
  }
}

// Sort in alignment order: ST01 -> ST11 -> DEP
const order = ['ST01', 'ST02', 'ST03', 'ST04', 'ST05', 'ST06', 'ST07', 'ST08', 'ST09', 'ST10', 'ST11', 'DEP'];
detailedFootprints.sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code));

console.log(`Extracted ${detailedFootprints.length} detailed station footprints:`);
detailedFootprints.forEach((s, idx) => {
  console.log(`  ${idx + 1}. [${s.code}] ${s.name} (${s.pointCount} points, center: ${s.center})`);
});

// Update data files
const targets = [
  path.join(__dirname, '../data/metro_boundary_data.json'),
  path.join(__dirname, '../frontend/src/features/survey-phase1/constants/metro_boundary_data.json')
];

targets.forEach((targetPath) => {
  if (fs.existsSync(targetPath)) {
    const json = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    json.stationDetailedFootprints = detailedFootprints;
    fs.writeFileSync(targetPath, JSON.stringify(json, null, 2), 'utf8');
    console.log(`✅ Updated ${targetPath}`);
  } else {
    console.warn(`⚠️ Target file not found: ${targetPath}`);
  }
});

console.log('🎉 Done importing detailed station outlines!');
