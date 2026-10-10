import { SurveyService } from '../modules/survey/survey.service';
import { CadastralRepository } from '../modules/cadastral/cadastral.repository';
import { Database } from '../database/db';
import { v4 as uuidv4 } from 'uuid';

async function runTest() {
  console.log('================================================================');
  console.log('🧪 TEST: MASTER AREA STATUS LIFECYCLE & ANTI-COLLISION LOCK');
  console.log('================================================================');

  // 1. Tìm 1 building_unit trong DB
  const unitRes = await Database.query<{ id: string; parcel_id: string; unit_code: string; status: string }>(
    `SELECT id, parcel_id, unit_code, status FROM building_units LIMIT 1;`
  );

  if (unitRes.rows.length === 0) {
    console.log('⚠️ Không có building_unit nào trong DB. Bỏ qua test.');
    process.exit(0);
  }

  const testUnit = unitRes.rows[0];
  const unitId = testUnit.id;
  const parcelId = testUnit.parcel_id;
  const originalStatus = testUnit.status;

  console.log(`[Setup] Unit ID: ${unitId} (${testUnit.unit_code}) thuộc Parcel ID: ${parcelId}`);
  console.log(`[Setup] Trạng thái ban đầu: ${originalStatus}`);

  // Tìm 2 surveyors
  const userRes = await Database.query<{ id: string; full_name: string; phone: string }>(
    `SELECT id, full_name, phone FROM users LIMIT 2;`
  );
  const surveyorA_Id = userRes.rows[0]?.id || uuidv4();
  const surveyorB_Id = userRes.rows[1]?.id || uuidv4();

  console.log(`[Setup] Surveyor A: ${surveyorA_Id} (${userRes.rows[0]?.full_name || 'KSV A'})`);
  console.log(`[Setup] Surveyor B: ${surveyorB_Id} (${userRes.rows[1]?.full_name || 'KSV B'})`);

  try {
    // Dọn dẹp draft cũ của unit này nếu có
    await Database.query(
      `DELETE FROM phase1_report_details WHERE report_id IN (SELECT id FROM base_survey_reports WHERE unit_id = $1 AND status = 'DRAFT');`,
      [unitId]
    );
    await Database.query(
      `DELETE FROM base_survey_reports WHERE unit_id = $1 AND status = 'DRAFT';`,
      [unitId]
    );

    // BƯỚC 1: KSV A lưu draft của Master Area Unit
    console.log('\n--- BƯỚC 1: KSV A lưu nháp khảo sát khu vực (Kích hoạt IN_PROGRESS) ---');
    const saveResA = await SurveyService.saveSurveyDraft({
      parcelId,
      unitId,
      surveyorId: surveyorA_Id,
      reportType: 'CONDO_UNIT',
      currentStep: 2,
      surveyData: {
        unitCode: testUnit.unit_code,
        step2_overview: 'Đang khảo sát vị trí và hiện trạng khu vực',
      },
    });

    console.log('✅ KSV A lưu nháp thành công:', saveResA);

    // Kiểm tra status của building_units trong DB
    const checkUnit1 = await Database.query<{ status: string }>(
      `SELECT status FROM building_units WHERE id = $1;`,
      [unitId]
    );
    console.log(`[DB Check] building_units.status = '${checkUnit1.rows[0]?.status}'`);
    if (checkUnit1.rows[0]?.status !== 'IN_PROGRESS') {
      throw new Error(`FAIL: Trạng thái unit không chuyển sang IN_PROGRESS (Thực tế: ${checkUnit1.rows[0]?.status})`);
    }
    console.log('🎉 PASS BƯỚC 1: Unit đã chuyển sang IN_PROGRESS trên DB');

    // BƯỚC 2: KSV B vào cùng ô này trong vòng 15 phút -> Phải bị khóa (Anti-collision Lock)
    console.log('\n--- BƯỚC 2: KSV B mở cùng ô khu vực (Kiểm tra Anti-collision Lock) ---');
    const lockCheckB = await SurveyService.getSurveyDraft(parcelId, surveyorB_Id, unitId);
    console.log('Lock check output for KSV B:', lockCheckB);
    if (!lockCheckB.isLocked) {
      throw new Error('FAIL: KSV B không bị khóa khi KSV A đang khảo sát trong 15 phút!');
    }
    console.log(`🎉 PASS BƯỚC 2: KSV B bị khóa chính xác bởi Kỹ sư ${lockCheckB.activeSurveyorName}`);

    // BƯỚC 3: KSV A chủ động bấm Đóng / Mở khóa ca
    console.log('\n--- BƯỚC 3: KSV A giải phóng khóa ca (Release Lock) ---');
    const releaseRes = await SurveyService.releaseDraftLock(parcelId, unitId, surveyorA_Id);
    console.log('Release result:', releaseRes);

    // KSV B kiểm tra lại -> Phải trả về requiresHandover kèm mã OTP 6 số
    const handoverCheckB = await SurveyService.getSurveyDraft(parcelId, surveyorB_Id, unitId);
    console.log('Handover check output for KSV B:', handoverCheckB);
    if (!handoverCheckB.requiresHandover || !handoverCheckB.securityCode) {
      throw new Error('FAIL: Không kích hoạt giao thức bàn giao ca sau khi release lock!');
    }
    console.log(`🎉 PASS BƯỚC 3: KSV B nhận được yêu cầu bàn giao ca kèm mã OTP: ${handoverCheckB.securityCode}`);

    // BƯỚC 4: KSV B nhập mã OTP để tiếp quản ca
    console.log('\n--- BƯỚC 4: KSV B tiếp quản ca bằng mã OTP ---');
    const takeoverRes = await SurveyService.takeoverSurveyDraft({
      parcelId,
      unitId,
      newSurveyorId: surveyorB_Id,
      handoverCode: handoverCheckB.securityCode,
      note: 'Tiếp quản ca chiều',
    });
    console.log('Takeover result:', takeoverRes);
    if (!takeoverRes.success) {
      throw new Error('FAIL: Tiếp quản ca thất bại!');
    }
    console.log('🎉 PASS BƯỚC 4: KSV B tiếp quản ca thành công!');

    // BƯỚC 5: Ghi nhận Tạm hoãn / Vắng mặt / Cửa khóa (POSTPONED_ABSENT) cho ô này
    console.log('\n--- BƯỚC 5: Ghi nhận Chưa tiếp cận được (POSTPONED_ABSENT) ---');
    await CadastralRepository.recordAbsence({
      parcelId,
      unitId,
      surveyorId: surveyorB_Id,
      absenceReason: 'LOCKED_GATE',
      notes: 'Phòng kỹ thuật khóa cửa, hẹn 15h00 mở cửa',
      photoProofUrl: 'https://example.com/locked-door.jpg',
      rescheduleDate: new Date(Date.now() + 3600000).toISOString(),
    });

    // Kiểm tra status unit trong DB
    const checkUnit2 = await Database.query<{ status: string }>(
      `SELECT status FROM building_units WHERE id = $1;`,
      [unitId]
    );
    console.log(`[DB Check] building_units.status sau khi báo vắng = '${checkUnit2.rows[0]?.status}'`);
    if (checkUnit2.rows[0]?.status !== 'POSTPONED_ABSENT') {
      throw new Error(`FAIL: Unit không chuyển sang POSTPONED_ABSENT (Thực tế: ${checkUnit2.rows[0]?.status})`);
    }

    // Kiểm tra log có unit_id
    const logCheck = await Database.query<{ id: string; unit_id: string; absence_reason: string }>(
      `SELECT id, unit_id, absence_reason FROM survey_absence_logs WHERE unit_id = $1 ORDER BY recorded_at DESC LIMIT 1;`,
      [unitId]
    );
    console.log('[DB Check] survey_absence_logs record:', logCheck.rows[0]);
    if (!logCheck.rows[0]?.unit_id || logCheck.rows[0]?.unit_id !== unitId) {
      throw new Error('FAIL: survey_absence_logs không lưu unit_id!');
    }
    console.log('🎉 PASS BƯỚC 5: Unit chuyển sang POSTPONED_ABSENT và log đã lưu đầy đủ!');

  } finally {
    // Dọn dẹp dữ liệu test để trả lại trạng thái nguyên vẹn
    console.log('\n[Cleanup] Khôi phục trạng thái ban đầu của unit...');
    await Database.query(
      `UPDATE building_units SET status = $2, updated_at = NOW() WHERE id = $1;`,
      [unitId, originalStatus]
    );
    await Database.query(
      `DELETE FROM survey_absence_logs WHERE unit_id = $1 AND notes LIKE '%Phòng kỹ thuật khóa cửa%';`,
      [unitId]
    );
    await Database.query(
      `DELETE FROM phase1_report_details WHERE report_id IN (SELECT id FROM base_survey_reports WHERE unit_id = $1 AND status = 'DRAFT');`,
      [unitId]
    );
    await Database.query(
      `DELETE FROM base_survey_reports WHERE unit_id = $1 AND status = 'DRAFT';`,
      [unitId]
    );
    console.log('✅ Hoàn tất dọn dẹp dữ liệu test.');
  }

  console.log('\n================================================================');
  console.log('🏆 TẤT CẢ 5 BƯỚC KIỂM THỬ ĐÃ ĐẠT 100% THÀNH CÔNG!');
  console.log('================================================================');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
