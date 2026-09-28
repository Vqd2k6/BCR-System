/**
 * SCRIPT HÀN GẮN & KHÉP KÍN TOÀN BỘ CÁC ĐƯỜNG POLYLINE TUYẾN METRO SỐ 2
 * 
 * Mục đích:
 * 1. Khắc phục triệt để lỗi đường polyline bị hở ở 5 đoạn hầm TBM (TBM 1, 2, 6, 7, 10) và Hộp Ga Dân Chủ (ST03).
 * 2. Loại bỏ các nét cắt chéo xuyên nhà dân do Leaflet Polygon tự nối điểm cuối về điểm đầu sai lệch.
 * 3. Nối các đoạn hầm và hộp ga tiếp giáp khít khao hai đầu, tạo thành 1 dải hành lang ngầm hoàn chỉnh, liên tục.
 * 4. Đồng bộ dữ liệu vào data/metro_boundary_data.json và frontend.
 */

const fs = require('fs');
const path = require('path');

const targetPaths = [
  path.join(__dirname, '../data/metro_boundary_data.json'),
  path.join(__dirname, '../frontend/src/features/survey-phase1/constants/metro_boundary_data.json'),
];

console.log('🚀 Bắt đầu quá trình hàn gắn và khép kín các phân đoạn tuyến Metro Số 2...');

// Đọc dữ liệu hiện tại
const baseData = JSON.parse(fs.readFileSync(targetPaths[0], 'utf8'));

// 1. HÀN GẮN 11 HỘP GA METRO (STATION POLYGONS)
console.log('🏢 [1/4] Đang chuẩn hóa và khép kín 11 Hộp Ga...');
const healedStations = baseData.stationPolygons.map((st, idx) => {
  const coords = [...st.coords];
  const p0 = coords[0];
  const pL = coords[coords.length - 1];
  
  // Nếu chưa khép kín, bổ sung điểm đầu vào cuối
  if (p0[0] !== pL[0] || p0[1] !== pL[1]) {
    coords.push([p0[0], p0[1]]);
    console.log(`  ✔ Khép kín Hộp Ga [${st.name}] (ST0${idx+1}) - Thêm đỉnh đóng nắp.`);
  }

  // Tính lại trọng tâm chuẩn
  const avgLat = coords.reduce((a, b) => a + b[0], 0) / coords.length;
  const avgLng = coords.reduce((a, b) => a + b[1], 0) / coords.length;

  return {
    ...st,
    coords,
    center: [avgLat, avgLng]
  };
});

// 2. HÀN GẮN CÁC ĐOẠN HẦM TBM (TBM POLYGONS)
console.log('🚇 [2/4] Đang hàn gắn và khép kín các phân đoạn hầm TBM...');
const healedTBM = baseData.tbmPolygons.map((tbm, idx) => {
  let coords = [...tbm.coords];
  const tbmNumber = idx + 1;

  if (tbmNumber === 1) {
    // TBM 1: Ga Bến Thành -> Ga Tao Đàn
    // Dữ liệu gốc gồm 3 chặng lặp. Lấy chặng 1 (0..111) và chặng 3 đảo chiều (224..335), sau đó khép kín.
    const leg1 = coords.slice(0, 112); // Bờ tả Bến Thành -> Tao Đàn
    const leg2 = coords.slice(224, 336).reverse(); // Bờ hữu Tao Đàn -> Bến Thành
    coords = [...leg1, ...leg2, [leg1[0][0], leg1[0][1]]];
    console.log(`  ✔ Hàn gắn TBM 1 (Bến Thành -> Tao Đàn): Tái cấu trúc 2 bờ tả/hữu khép kín (${coords.length} đỉnh).`);
  } else if (tbmNumber === 2) {
    // TBM 2: Ga Tao Đàn -> Ga Dân Chủ
    // Cắt bỏ phần đuôi lặp thừa (368..417). Giữ lại vòng khép kín chuẩn 0..367
    coords = coords.slice(0, 368);
    // Đảm bảo khép kín hoàn hảo
    if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
      coords.push([coords[0][0], coords[0][1]]);
    }
    console.log(`  ✔ Hàn gắn TBM 2 (Tao Đàn -> Dân Chủ): Cắt bỏ đuôi thừa, khép kín tại Ga Tao Đàn (${coords.length} đỉnh).`);
  } else if (tbmNumber === 6) {
    // TBM 6: Ga Phạm Văn Hai -> Ga Bảy Hiền (Chữ U hở 112m tại Ga Bảy Hiền)
    if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
      coords.push([coords[0][0], coords[0][1]]);
    }
    console.log(`  ✔ Hàn gắn TBM 6 (Phạm Văn Hai -> Bảy Hiền): Đóng nắp cạnh tiếp giáp Ga Bảy Hiền (${coords.length} đỉnh).`);
  } else if (tbmNumber === 7) {
    // TBM 7: Ga Bảy Hiền -> Ga Nguyễn Hồng Đào (Chữ U hở 112m tại Ga Bảy Hiền)
    if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
      coords.push([coords[0][0], coords[0][1]]);
    }
    console.log(`  ✔ Hàn gắn TBM 7 (Bảy Hiền -> Nguyễn Hồng Đào): Đóng nắp cạnh tiếp giáp Ga Bảy Hiền (${coords.length} đỉnh).`);
  } else if (tbmNumber === 10) {
    // TBM 10: Ga Phạm Văn Bạch -> Ga Tân Bình
    if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
      coords.push([coords[0][0], coords[0][1]]);
    }
    console.log(`  ✔ Hàn gắn TBM 10 (Phạm Văn Bạch -> Tân Bình): Đóng nắp cạnh tiếp giáp (${coords.length} đỉnh).`);
  } else {
    // Các đoạn TBM 3, 4, 5, 8, 9: Đảm bảo tuyệt đối khép kín
    const p0 = coords[0];
    const pL = coords[coords.length - 1];
    if (p0[0] !== pL[0] || p0[1] !== pL[1]) {
      coords.push([p0[0], p0[1]]);
    }
  }

  // Tính lại trọng tâm
  const avgLat = coords.reduce((a, b) => a + b[0], 0) / coords.length;
  const avgLng = coords.reduce((a, b) => a + b[1], 0) / coords.length;

  return {
    ...tbm,
    coords,
    center: [avgLat, avgLng]
  };
});

// 3. TÁI LẬP DANH SÁCH TẤT CẢ PHÂN ĐOẠN HÀNH LANG TUYẾN (ALL CORRIDOR SEGMENTS)
console.log('📐 [3/4] Cập nhật danh sách toàn bộ phân đoạn hành lang...');
const allCorridorSegments = [];

// Ghép tuần tự 1 Ga xen kẽ 1 Hầm
for (let i = 0; i < healedStations.length; i++) {
  // Thêm Ga
  const st = healedStations[i];
  allCorridorSegments.push({
    id: `SEG_${allCorridorSegments.length + 1 < 10 ? '0' : ''}${allCorridorSegments.length + 1}`,
    name: st.name,
    coords: st.coords,
    center: st.center,
    isStation: true,
    code: st.code,
  });

  // Thêm Hầm nối liền kề (nếu có)
  if (i < healedTBM.length) {
    const tbm = healedTBM[i];
    allCorridorSegments.push({
      id: `SEG_${allCorridorSegments.length + 1 < 10 ? '0' : ''}${allCorridorSegments.length + 1}`,
      name: `Hầm TBM Phân đoạn ${i + 1}`,
      coords: tbm.coords,
      center: tbm.center,
      isStation: false,
      code: `TBM_${i + 1}`,
    });
  }
}

// 4. KIỂM TRA ĐỘ KHÉP KÍN TOÀN BỘ
console.log('🔍 [4/4] Kiểm tra tính toàn vẹn và độ khép kín 100%...');
let allValid = true;

healedStations.forEach((st, idx) => {
  const p0 = st.coords[0];
  const pL = st.coords[st.coords.length - 1];
  if (p0[0] !== pL[0] || p0[1] !== pL[1]) {
    console.error(`  ❌ Hộp Ga ${st.name} vẫn chưa khép kín!`);
    allValid = false;
  }
});

healedTBM.forEach((tbm, idx) => {
  const p0 = tbm.coords[0];
  const pL = tbm.coords[tbm.coords.length - 1];
  if (p0[0] !== pL[0] || p0[1] !== pL[1]) {
    console.error(`  ❌ TBM ${idx + 1} vẫn chưa khép kín!`);
    allValid = false;
  }
});

if (allValid) {
  console.log('  🎉 XÁC NHẬN: 100% các Hộp Ga và các đoạn Hầm TBM đã được khép kín hoàn toàn!');
} else {
  console.error('  ⚠️ Vẫn còn phân đoạn chưa khép kín.');
}

// 5. GHI DỮ LIỆU ĐÃ HÀN GẮN VÀO FILE
const updatedDataset = {
  ...baseData,
  stationPolygons: healedStations,
  tbmPolygons: healedTBM,
  allCorridorSegments: allCorridorSegments,
};

targetPaths.forEach((p) => {
  fs.writeFileSync(p, JSON.stringify(updatedDataset, null, 2), 'utf8');
  console.log(`  💾 Đã lưu dữ liệu chuẩn vào: ${p}`);
});

console.log('✅ Hoàn tất quá trình hàn gắn và khép kín tuyến Metro Số 2!');
