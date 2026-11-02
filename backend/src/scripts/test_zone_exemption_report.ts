/**
 * Báo cáo của tầng miễn Vùng Z: có hộp giải trình, Mục IX và Phụ lục 4 ghi hạn chế dù hồ sơ khai FULL_100,
 * và không có câu kết luận không phát hiện khuyết tật. Không cần DB.
 * Chạy: npx ts-node --transpile-only src/scripts/test_zone_exemption_report.ts
 */
import assert from 'node:assert/strict';
import { ReportViewModelMapper } from '../modules/report/mappers/report-viewmodel.mapper';
import { ReportService } from '../modules/report/services/report.service';

const buildReport = (floor: Record<string, unknown>) => ({
  project_parcel_code: 'C&C-01-B-04445',
  zone_id: 'ZONE_09',
  survey_date: '26/09/2026 (19:00)',
  surveyor_name: 'Nguyễn Trọng Tuấn',
  survey_data_json: {
    photos: { p01: 'data:image/svg+xml;utf8,<svg><text y="20">P01</text></svg>' },
    accessLimitation: { type: 'FULL_100' },
    floors: [{ floorId: 'FLOOR_2', floorName: 'Tầng 2', zones: [], ...floor }],
  },
});

const { template, styles } = ReportService.getCompiledTemplate();
const render = (floor: Record<string, unknown>) => {
  const viewModel = ReportViewModelMapper.buildViewModel(buildReport(floor));
  return { viewModel, html: template({ ...viewModel, styles }) };
};

const exempt = render({
  hasZones: false,
  noZonesReason: 'Chủ nhà chỉ cho chụp tổng quan tầng, từ chối chụp chi tiết phòng',
  hasStructuralElements: false,
  noStructuralElementsReason: 'Mái tôn xà gồ thép nhẹ',
});
assert.equal(exempt.viewModel.appendix2[0].hasZones, false);
assert.ok(exempt.html.includes('Hạn chế tiếp cận chi tiết (Miễn Vùng Z)'), 'Hộp giải trình in ở Phụ lục 2 khi không có khuyết tật');
assert.ok(exempt.html.includes('Owner permitted floor overview photos only'), 'Lý do mẫu có bản tiếng Anh');
assert.ok(exempt.html.includes('Mái tôn xà gồ thép nhẹ'), 'Miễn E cũng in ở Phụ lục 2');
assert.ok(exempt.html.includes('Tầng hạn chế tiếp cận chi tiết: Tầng 2'), 'Mục IX có dòng hạn chế dù khai FULL_100');
assert.ok(exempt.html.includes('Hạn chế một phần'), 'Phụ lục 4 ghi Hạn chế một phần');
assert.ok(exempt.html.includes('Chưa đánh giá khuyết tật bên trong các phòng'));
assert.ok(!exempt.html.includes('không phát hiện vết nứt, biến dạng'), 'Không kết luận không phát hiện khuyết tật');
assert.ok(!exempt.html.includes('No restriction (100%)'), 'Phụ lục 4 không ghi 100%');

const legacy = render({});
assert.equal(legacy.viewModel.appendix2[0].hasZones, true, 'Hồ sơ cũ không có cờ giữ nguyên');
assert.ok(!legacy.html.includes('Miễn Vùng Z'));
assert.ok(legacy.html.includes('không phát hiện vết nứt, biến dạng'));
assert.ok(legacy.html.includes('No restriction (100%)'));

console.log('✅ test_zone_exemption_report: đạt');
process.exit(0);
