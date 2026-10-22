import { Database } from '../src/database/db';
import { SurveyBaseRepository } from '../src/modules/survey/repositories/survey-base.repository';

// Helper functions mirroring frontend logic
const isCadastralPlaceholder = (name?: string | null): boolean => {
  if (!name || typeof name !== 'string') return false;
  return /^chủ\s+hộ\s+thửa/i.test(name.trim());
};

const reverseMapStructuralSystem = (dbVal?: string | null): string => {
  if (!dbVal) return '';
  const upper = dbVal.toUpperCase();
  if (upper.includes('KHUNG_BTCT') || upper.includes('RC')) return 'RC - BTCT (Khung bê tông cốt thép toàn khối)';
  if (upper.includes('THEP') || upper.includes('STEEL')) return 'Steel - Khung kết cấu thép';
  if (upper.includes('GACH') || upper.includes('MASONRY')) return 'Masonry - Tường gạch chịu lực';
  if (upper.includes('HON_HOP') || upper.includes('MIXED')) return 'Mixed - Kết cấu hỗn hợp';
  return dbVal;
};

const reverseMapFoundationCategory = (dbVal?: string | null): string => {
  if (!dbVal) return '';
  const upper = dbVal.toUpperCase();
  if (upper.includes('CAT_1') || upper.includes('WOOD') || upper.includes('TRAM')) return 'Wood - Móng cừ tràm / Nền gia cố';
  if (upper.includes('CAT_2') || upper.includes('CAT_3') || upper.includes('SHALLOW') || upper.includes('NONG') || upper.includes('DON') || upper.includes('BANG')) return 'Shallow - Móng nông (Móng băng / Móng đơn / Móng bè)';
  if (upper.includes('CAT_4') || upper.includes('PC')) return 'PC - Móng cọc ép BTCT';
  if (upper.includes('CIP')) return 'CIP - Móng cọc khoan nhồi';
  if (upper.includes('CAT_5') || upper.includes('UNKNOWN') || upper.includes('KHONG_XAC_DINH')) return 'Unknown - Không rõ thông tin móng';
  return dbVal;
};

async function runTests() {
  console.log('====================================================');
  console.log('🧪 TEST SUITE: PHASE 1 OWNER & INTERVIEW DATA PRESERVATION');
  console.log('====================================================');

  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, msg: string) => {
    if (condition) {
      console.log(`  ✅ [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${msg}`);
      failed++;
    }
  };

  // --- UNIT TESTS ---
  console.log('\n--- 1. Frontend Helper Unit Tests ---');
  assert(isCadastralPlaceholder('Chủ hộ thửa 205 (Tờ 12)'), 'Detects "Chủ hộ thửa 205 (Tờ 12)" as cadastral placeholder');
  assert(isCadastralPlaceholder('chủ  hộ  thửa 10'), 'Detects lowercase and spaced "chủ  hộ  thửa 10"');
  assert(!isCadastralPlaceholder('Nguyễn Văn A'), 'Distinguishes real name "Nguyễn Văn A" as non-placeholder');
  assert(!isCadastralPlaceholder(''), 'Handles empty string safely');
  assert(!isCadastralPlaceholder(undefined), 'Handles undefined safely');

  assert(
    reverseMapStructuralSystem('KHUNG_BTCT_CHIU_LUC') === 'RC - BTCT (Khung bê tông cốt thép toàn khối)',
    'Reverse maps KHUNG_BTCT_CHIU_LUC -> RC - BTCT (...)'
  );
  assert(
    reverseMapStructuralSystem('STEEL_FRAME') === 'Steel - Khung kết cấu thép',
    'Reverse maps STEEL_FRAME -> Steel (...)'
  );

  assert(
    reverseMapFoundationCategory('CAT_2_MONG_DON_BTCT') === 'Shallow - Móng nông (Móng băng / Móng đơn / Móng bè)',
    'Reverse maps CAT_2_MONG_DON_BTCT -> Shallow (...)'
  );
  assert(
    reverseMapFoundationCategory('CAT_4_MONG_COC_BTCT') === 'PC - Móng cọc ép BTCT',
    'Reverse maps CAT_4_MONG_COC_BTCT -> PC (...)'
  );

  // --- DATABASE INTEGRATION TESTS ---
  console.log('\n--- 2. Database SQL Resolution Tests ---');
  try {
    // Tìm 1 report bất kỳ để test
    const existingReports = await Database.query(
      `SELECT id, parcel_id, survey_data_json FROM base_survey_reports WHERE parcel_id IS NOT NULL LIMIT 1;`
    );

    if (existingReports.rows.length === 0) {
      console.log('  ⚠️ No base_survey_reports found to run live DB integration test.');
    } else {
      const rep = existingReports.rows[0];
      const parcelRes = await Database.query(`SELECT owner_name, owner_phone FROM parcels WHERE id = $1;`, [rep.parcel_id]);
      const initialParcelOwner = parcelRes.rows[0]?.owner_name;

      console.log(`  Report ID: ${rep.id}, Parcel ID: ${rep.parcel_id}, Initial Parcel Owner: "${initialParcelOwner}"`);

      // 2.1 Test COALESCE priority:
      // Update survey_data_json with a specific ownerName
      const testOwnerName = 'NGUYỄN VĂN TEST DATA PRESERVATION';
      const testOwnerPhone = '0988776655';
      const updatedJson = {
        ...(rep.survey_data_json || {}),
        ownerName: testOwnerName,
        ownerPhone: testOwnerPhone,
      };

      await Database.query(
        `UPDATE base_survey_reports SET survey_data_json = $1 WHERE id = $2;`,
        [JSON.stringify(updatedJson), rep.id]
      );

      // Call SurveyBaseRepository.findReportById
      const fetchedReport = await SurveyBaseRepository.findReportById(rep.id);
      assert(
        fetchedReport.owner_name === testOwnerName,
        `findReportById resolves owner_name from survey_data_json ("${fetchedReport.owner_name}" === "${testOwnerName}")`
      );
      assert(
        fetchedReport.owner_phone === testOwnerPhone,
        `findReportById resolves owner_phone from survey_data_json ("${fetchedReport.owner_phone}" === "${testOwnerPhone}")`
      );

      // 2.2 Test fallback when survey_data_json has empty ownerName:
      const emptyOwnerJson = {
        ...(rep.survey_data_json || {}),
        ownerName: '',
        ownerPhone: '',
      };
      await Database.query(
        `UPDATE base_survey_reports SET survey_data_json = $1 WHERE id = $2;`,
        [JSON.stringify(emptyOwnerJson), rep.id]
      );
      const fetchedReportFallback = await SurveyBaseRepository.findReportById(rep.id);
      assert(
        fetchedReportFallback.owner_name === initialParcelOwner,
        `findReportById falls back to parcel.owner_name when json ownerName is empty ("${fetchedReportFallback.owner_name}" === "${initialParcelOwner}")`
      );

      // Restore original json if needed
      await Database.query(
        `UPDATE base_survey_reports SET survey_data_json = $1 WHERE id = $2;`,
        [rep.survey_data_json ? JSON.stringify(rep.survey_data_json) : null, rep.id]
      );

      // 2.3 Test cadastral preservation on submitPhase1Report:
      // If parcel has cadastral baseline, updating with a different name via COALESCE(NULLIF(owner_name, ''), $3)
      // should preserve existing parcel owner_name
      if (initialParcelOwner && initialParcelOwner.trim() !== '') {
        const testUpdateQuery = await Database.query(
          `UPDATE parcels 
           SET owner_name = COALESCE(NULLIF(owner_name, ''), $1)
           WHERE id = $2
           RETURNING owner_name;`,
          ['CỐ TÌNH GHI ĐÈ BẰNG TÊN MỚI', rep.parcel_id]
        );
        assert(
          testUpdateQuery.rows[0].owner_name === initialParcelOwner,
          `UPDATE parcels preserves baseline cadastral owner_name ("${testUpdateQuery.rows[0].owner_name}" === "${initialParcelOwner}")`
        );
      }
    }
  } catch (err) {
    console.error('  ❌ DB test error:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`TOTAL RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
