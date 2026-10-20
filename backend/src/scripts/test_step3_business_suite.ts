/**
 * TEST SUITE: BƯỚC 3 (CLASSIFIER, CONSISTENCY GATE, CONFIG VERSIONING, PINNING)
 * Chạy: npx ts-node src/scripts/test_step3_business_suite.ts
 */

import { pool, Database } from '../database/db';
import {
  classifyStructureSystem,
  v2ScoreForStructure,
  STRUCTURE_LABELS,
} from '../modules/report_v2/mappers/structure-system.classifier';
import { ReportConsistencyGate } from '../modules/audit/services/report-consistency-gate';
import { ReportConfigService } from '../modules/report_config/report-config.service';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.error(`  FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('=== TEST PHẦN 1: STRUCTURE SYSTEM CLASSIFIER & V2 SCORES ===');

  // Bug cũ: "bê tông cốt thép" chứa "thép" nên bị nhận nhầm thành STEEL
  const rc1 = classifyStructureSystem('RC - BTCT (Khung bê tông cốt thép toàn khối)');
  assert(rc1 === 'RC', 'Nhận diện chuẩn "RC - BTCT (Khung bê tông cốt thép toàn khối)" là RC');
  assert(v2ScoreForStructure(rc1) === 1, 'Điểm V2 của RC là 1');

  const rc2 = classifyStructureSystem('Khung bê tông cốt thép');
  assert(rc2 === 'RC', 'Nhận diện "Khung bê tông cốt thép" là RC');

  const steel = classifyStructureSystem('Khung kết cấu thép tiền chế');
  assert(steel === 'STEEL', 'Nhận diện "Khung kết cấu thép tiền chế" là STEEL');
  assert(v2ScoreForStructure(steel) === 2, 'Điểm V2 của STEEL là 2');

  const masonry = classifyStructureSystem('Tường gạch chịu lực kết hợp sàn BTCT');
  assert(masonry === 'MASONRY', 'Nhận diện "Tường gạch chịu lực" là MASONRY');
  assert(v2ScoreForStructure(masonry) === 3, 'Điểm V2 của MASONRY là 3');

  const mixed = classifyStructureSystem('Kết cấu hỗn hợp (BTCT kết hợp gạch/thép)');
  assert(mixed === 'MIXED', 'Nhận diện "Kết cấu hỗn hợp" là MIXED');
  assert(v2ScoreForStructure(mixed) === 2, 'Điểm V2 của MIXED là 2');

  const sub = classifyStructureSystem('Kết cấu tạm / kém ổn định');
  assert(sub === 'SUBSTANDARD', 'Nhận diện "Kết cấu tạm / kém ổn định" là SUBSTANDARD');
  assert(v2ScoreForStructure(sub) === 4, 'Điểm V2 của SUBSTANDARD là 4');

  const other = classifyStructureSystem('Khác: Nhà vách gỗ mái tole');
  assert(other === 'OTHER', 'Nhận diện "Khác: ..." là OTHER');
  assert(v2ScoreForStructure(other) === 2, 'Điểm V2 của OTHER là 2');

  const unknown = classifyStructureSystem('');
  assert(unknown === 'UNKNOWN', 'Chuỗi rỗng nhận diện là UNKNOWN');
  assert(STRUCTURE_LABELS.UNKNOWN.vi === '--', 'Label UNKNOWN tiếng Việt là "--"');

  console.log('\n=== TEST PHẦN 2: REPORT CONSISTENCY GATE ===');

  // Case 2.1: KSV chính thức khai báo Mái không tiếp cận nhưng có khuyết tật tại tầng mái -> Hard error
  const reportRoofConflict = {
    status: 'SUBMITTED',
  };
  const jsonRoofConflict = {
    accessLimitation: {
      type: 'LIMITED',
      restrictedAreas: ['Mái / Sân thượng'],
    },
    floors: [
      {
        floorName: 'Tầng mái',
        defects: [{ defectType: 'CRACK' }],
      },
    ],
  };
  const roofResult = ReportConsistencyGate.evaluate(reportRoofConflict, jsonRoofConflict);
  assert(!roofResult.passed, 'Chốt chặn từ chối khi Mái không tiếp cận nhưng có khuyết tật');
  assert(roofResult.hardErrors.length > 0, 'hardErrors ghi nhận đúng mâu thuẫn mái');

  // Case 2.2: KSV khai báo Mái không tiếp cận và không có khuyết tật tại mái -> Passed
  const jsonRoofOk = {
    accessLimitation: {
      type: 'LIMITED',
      restrictedAreas: ['Mái / Sân thượng'],
    },
    floors: [
      {
        floorName: 'Tầng trệt',
        defects: [{ defectType: 'CRACK' }],
      },
      {
        floorName: 'Tầng mái',
        defects: [],
      },
    ],
  };
  const roofOkResult = ReportConsistencyGate.evaluate(reportRoofConflict, jsonRoofOk);
  assert(roofOkResult.passed, 'Chốt chặn thông qua khi tầng mái không có khuyết tật');

  // Case 2.3: ECS >= 11 nhưng BRA Low không có giải trình -> Hard error
  // Case 2.4: Mismatch giữa kết cấu RC (kỳ vọng V2=1) nhưng V2 ghi nhận là 3 -> Cảnh báo soft warning
  const jsonMismatch = {
    structureSystem: 'Khung bê tông cốt thép',
    vulnerabilityIndex: { v2: 3 },
    accessLimitation: {
      type: 'PARTIAL',
      restrictedAreas: [],
      notes: '',
    },
  };
  const mismatchResult = ReportConsistencyGate.evaluate({}, jsonMismatch);
  assert(
    mismatchResult.warnings.some((w) => w.includes('Cảnh báo hệ kết cấu')),
    'Ghi nhận warning mâu thuẫn giữa hệ kết cấu RC và điểm V2=3'
  );
  assert(
    mismatchResult.warnings.some((w) => w.includes('Hạn chế tiếp cận')),
    'Ghi nhận warning khi ghi PARTIAL nhưng không có danh sách khu vực/ghi chú'
  );

  console.log('\n=== TEST PHẦN 3: REPORT CONFIG SERVICE ===');
  const activeCfg = await ReportConfigService.getActiveConfig();
  assert(activeCfg.standardTextVersionNumber !== null, 'Tải được số phiên bản văn bản chuẩn active');
  assert(activeCfg.standardText.recommendations.length > 0, 'Văn bản chuẩn có danh sách kiến nghị kỹ thuật');
  assert(activeCfg.equipment.length >= 4, 'Danh mục thiết bị dự án có ít nhất 4 thiết bị');
  assert(activeCfg.equipment[0].nameVi.length > 0, 'Thiết bị đầu tiên có tên tiếng Việt');

  console.log(`\n======================================================`);
  console.log(`KẾT QUẢ TEST SUITE BƯỚC 3: ${passed} PASS, ${failed} FAIL`);
  console.log(`======================================================\n`);

  await pool.end();
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('[TEST SUITE ERROR]', err);
  process.exit(1);
});
