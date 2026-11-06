/**
 * Kiểm thử mã vị trí (ST/POR/DEP) trên Building ID & Report No, và nạp logo THACO - CREC.
 * Chạy: npx ts-node src/scripts/test_report_station_code_and_logo.ts
 */
import { CadastralInfoMapper } from '../modules/report/mappers/cadastral-info.mapper';
import { LOGO_THACO_REC_BASE64 } from '../modules/report/assets/report-logos';
import { metersPerDegreeWgs84 } from '../modules/report/utils/spatial-svg.utils';
import { isPhotoAlreadyWatermarked } from '../modules/report/mappers/appendices/appendix-2/cad-pin.mapper';
import {
  normalizeMetroPhotoCode,
  parseCodeFromPhotoUrl,
  resolveFloorCode,
  isSamePhotoCodeContent,
} from '../modules/report/utils/metro-photo-code.utils';
import { resolveOverviewPhotoCode } from '../modules/report/mappers/appendices/appendix-2/floor-overview-pagination.mapper';
import { ReportWatermarkCanvasService } from '../modules/report/services/report-watermark-canvas.service';
import sharp from 'sharp';

let failed = 0;
function eq(label: string, actual: string | number | boolean, expected: string | number | boolean): void {
  const ok = actual === expected;
  if (!ok) failed += 1;
  console.log(`${ok ? '✅' : '❌'} ${label}: ${String(actual)}${ok ? '' : ` (mong đợi ${String(expected)})`}`);
}

// Mã ga suy từ Zone theo ZONE_SEGMENT_PREFIX_MAP
eq('ZONE_07 → ST04 (Ga S4 Hòa Hưng)', CadastralInfoMapper.resolveStationCode('ZONE_07'), 'ST04');
eq('ZONE_13 → ST07 (Ga S7 Bảy Hiền)', CadastralInfoMapper.resolveStationCode('ZONE_13'), 'ST07');
eq('ZONE_09 → ST05', CadastralInfoMapper.resolveStationCode('ZONE_09'), 'ST05');
eq('ZONE_21 → ST11', CadastralInfoMapper.resolveStationCode('ZONE_21'), 'ST11');
eq('ZONE_08 → POR04', CadastralInfoMapper.resolveStationCode('ZONE_08'), 'POR04');
eq('ZONE_22 → DEP01', CadastralInfoMapper.resolveStationCode('ZONE_22'), 'DEP01');
eq('C&C-04-B-0336 → ST04', CadastralInfoMapper.resolveStationCode('C&C-04-B-0336'), 'ST04');
eq('ST5 → ST05', CadastralInfoMapper.resolveStationCode('ST5'), 'ST05');
eq('5 → ST05', CadastralInfoMapper.resolveStationCode(5), 'ST05');

// Building ID / Report No
const bId = CadastralInfoMapper.formatBuildingId('C&C-04-B-0336', 'ZONE_07', 'C&C');
eq('Building ID C&C-04-B-0336', bId, 'B-00336-C&C (ST04)');
eq('Report No C&C-04-B-0336', CadastralInfoMapper.formatReportNo(bId, 'C&C-04-B-0336', 'C&C', 'ZONE_07'), 'R-00336-C&C-(ST04)-R00');
eq('Mã thửa ưu tiên hơn zone sai (C&C-05 + ZONE_05)', CadastralInfoMapper.formatBuildingId('C&C-05-B-0026', 'ZONE_05', 'C&C'), 'B-00026-C&C (ST05)');
eq('Thiếu zone_id vẫn suy từ mã thửa', CadastralInfoMapper.formatBuildingId('C&C-04-B-0336', undefined, 'C&C'), 'B-00336-C&C (ST04)');
const porId = CadastralInfoMapper.formatBuildingId('POR-04-B-0012', 'ZONE_08', 'POR');
eq('Building ID POR', porId, 'B-00012-POR (POR04)');
eq('Report No POR', CadastralInfoMapper.formatReportNo(porId, 'POR-04-B-0012', 'POR', 'ZONE_08', '01'), 'R-00012-POR-(POR04)-R01');
eq('Chuẩn hóa (ST5) → (ST05)', CadastralInfoMapper.formatBuildingId('B-00026-C&C (ST5)', 'ZONE_09', 'C&C'), 'B-00026-C&C (ST05)');
eq('Report No lấy mã từ Building ID override', CadastralInfoMapper.formatReportNo('B-00336-C&C (ST04)', 'C&C-04-B-0336', 'C&C', 'ZONE_13'), 'R-00336-C&C-(ST04)-R00');

// Logo
eq('Logo là PNG base64', LOGO_THACO_REC_BASE64.startsWith('data:image/png;base64,'), true);
eq('Logo dài > 10.000 ký tự', LOGO_THACO_REC_BASE64.length > 10000, true);

// Hệ số WGS-84 tại vĩ độ TP.HCM (10.8°)
const wgs = metersPerDegreeWgs84(10.8);
eq('WGS-84 m/độ vĩ tại 10.8° ≈ 110612 (±5m)', Math.abs(wgs.mPerDegLat - 110612) <= 5, true);
eq('WGS-84 m/độ kinh tại 10.8° ≈ 109358 (±5m)', Math.abs(wgs.mPerDegLng - 109358) <= 5, true);

// Nhận diện ảnh cũ đã có watermark FE theo mốc upload trong tên file (cutover mặc định 03/10/2026)
const R2 = 'https://pub-x.r2.dev/surveys/C_C-05-B-0001/P02/';
eq('Ảnh upload 29/09/2026 → đã có watermark', isPhotoAlreadyWatermarked(`${R2}HCM_M2__C_C-05-B-0001__EXT_P02_01_1790650546342_0a1e3c.jpg`), true);
eq('Ảnh upload 01/11/2026 → chưa có watermark', isPhotoAlreadyWatermarked(`${R2}HCM_M2__C_C-05-B-0001__EXT_P02_01_1793500000000_0a1e3c.jpg`), false);

// Mã tầng theo SỐ LẦU (không theo chỉ số mảng)
eq('Tầng trệt → F00', resolveFloorCode({ floorName: 'Tầng trệt' }), 'F00');
eq('Tầng 1 (Lầu 1) → F01', resolveFloorCode({ floorName: 'Tầng 1 (Lầu 1)' }), 'F01');
eq('Tầng 4 (Lầu 3) → F03 (số Lầu thắng)', resolveFloorCode({ floorName: 'Tầng 4 (Lầu 3)' }), 'F03');
eq('Tầng 2 → F02', resolveFloorCode({ floorName: 'Tầng 2' }), 'F02');
eq('Tầng lửng → MEZZ', resolveFloorCode({ floorName: 'Tầng lửng' }), 'MEZZ');
eq('Tầng 12 → F12', resolveFloorCode({ floorName: 'Tầng 12' }), 'F12');
eq('Hầm 1 → B01', resolveFloorCode({ floorName: 'Hầm 1' }), 'B01');
eq('Không nhận ra → nhãn làm sạch', resolveFloorCode({ floorName: 'Phòng kỹ thuật' }), 'PHONG_KY_THUAT');

// Mã ảnh HCM_M2.1_[Mã thửa]_...
eq(
  'Chuẩn hóa mã cũ, không lặp tiền tố',
  normalizeMetroPhotoCode('HCM_M2.[C&C-05-B-0001]_F00_Z-01_CTX_01', 'C&C-05-B-0001'),
  'HCM_M2.1_[C&C-05-B-0001]_F00_Z-01_CTX_01'
);
eq('Hậu tố → mã đầy đủ', normalizeMetroPhotoCode('P02_MAIN', 'C&C-05-B-0001'), 'HCM_M2.1_[C&C-05-B-0001]_P02_MAIN');
eq(
  'Mã đã chuẩn giữ nguyên',
  normalizeMetroPhotoCode('HCM_M2.1_[C&C-05-B-0001]_P02_MAIN', 'C&C-05-B-0001'),
  'HCM_M2.1_[C&C-05-B-0001]_P02_MAIN'
);
eq('Căn hộ U-060', normalizeMetroPhotoCode('P01_HOUS', 'C&C-05-B-0129', 'U-060'), 'HCM_M2.1_[C&C-05-B-0129]_U-060_P01_HOUS');
eq('Căn hộ không chèn mã căn 2 lần', normalizeMetroPhotoCode('U-060_P01_HOUS', 'C&C-05-B-0129', 'U-060'), 'HCM_M2.1_[C&C-05-B-0129]_U-060_P01_HOUS');
const realUrl = 'https://pub-x.r2.dev/surveys/C_C-05-B-0001/OVERVIEW/HCM_M2__C_C-05-B-0001__F02_OVERVIEW_01_1790653655258_aa6501.jpg';
const parsed = parseCodeFromPhotoUrl(realUrl);
eq('Đọc mã từ tên file: mã thửa', parsed?.parcel || '', 'C&C-05-B-0001');
eq('Đọc mã từ tên file: hậu tố', parsed?.suffix || '', 'F02_OVERVIEW_01');
eq('Chỉ khác tiền tố → cùng nội dung', isSamePhotoCodeContent('HCM_M2.[C&C-05-B-0001]_EXT_P02_01', 'HCM_M2.1_[C&C-05-B-0001]_EXT_P02_01'), true);
const ov = resolveOverviewPhotoCode(realUrl, undefined, 'F01', 'P-29', { parcelCode: 'C&C-05-B-0001', floorCode: 'F01' });
eq('Ảnh "Tầng 1" mang F02 → mã đúng F01', ov.metroPhotoCode, 'HCM_M2.1_[C&C-05-B-0001]_F01_OVERVIEW_01');
eq('Ghi mã gốc khi khác nội dung', ov.originalFileCode || '', 'HCM_M2.[C&C-05-B-0001]_F02_OVERVIEW_01');
const ovSame = resolveOverviewPhotoCode(realUrl, undefined, 'F02', 'P-24', { parcelCode: 'C&C-05-B-0001', floorCode: 'F02' });
eq('Không ghi mã gốc khi chỉ khác tiền tố', ovSame.originalFileCode === undefined, true);

// Bố cục watermark: logo rộng 43.75% cạnh ngắn cho cả ảnh dọc và ngang (= 672px với 1536)
async function stampedDiffersAt(width: number, height: number): Promise<boolean> {
  const base = await sharp({ create: { width, height, channels: 3, background: '#808080' } }).jpeg().toBuffer();
  const out = await ReportWatermarkCanvasService.stampImageBase64({
    base64Uri: `data:image/jpeg;base64,${base.toString('base64')}`,
    dateTimeText: '05 thg 11, 2026 09:00:00',
    photoCodeText: 'HCM_M2.1_[C&C-05-B-0001]_EXT_P02_01',
  });
  const raw = await sharp(Buffer.from(out.split(',')[1], 'base64')).raw().toBuffer({ resolveWithObject: true });
  // Logo bắt đầu tại x = width - 2.5%·short - 672: điểm giữa logo phải khác nền xám, điểm bên trái logo phải còn xám.
  const short = Math.min(width, height);
  const logoLeft = width - Math.round(short * 0.025) - Math.round(short * 0.4375);
  const pixel = (x: number, y: number) => raw.data[(y * raw.info.width + x) * raw.info.channels];
  const yMid = Math.round(short * 0.025) + 20;
  let logoInk = false;
  for (let x = logoLeft; x < logoLeft + Math.round(short * 0.4375); x += 4) {
    if (Math.abs(pixel(x, yMid) - 128) > 40) { logoInk = true; break; }
  }
  const leftClear = Math.abs(pixel(logoLeft - 40, yMid) - 128) < 20;
  return logoInk && leftClear;
}

async function runAsync(): Promise<void> {
  eq('Logo ảnh dọc 1536×2048 đúng vị trí/cỡ', await stampedDiffersAt(1536, 2048), true);
  eq('Logo ảnh ngang 2048×1536 đúng vị trí/cỡ', await stampedDiffersAt(2048, 1536), true);
}

runAsync().then(() => {
if (failed > 0) {
  console.error(`[TestStationCode] ${failed} ca thất bại`);
  process.exit(1);
}
console.log('Tất cả ca kiểm thử đạt.');
}).catch((err) => {
  console.error('[TestStationCode] Lỗi khi chạy kiểm thử bất đồng bộ', err);
  process.exit(1);
});
