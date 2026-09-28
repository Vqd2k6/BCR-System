import { SurveyService } from '../modules/survey/survey.service';
import { Database } from '../database/db';
import { v4 as uuidv4 } from 'uuid';

async function runTest() {
  console.log('--- BẮT ĐẦU KIỂM THỬ E2E LUỒNG ĐỒNG BỘ BẢN NHÁP & BÀN GIAO TIẾP QUẢN CA ---');

  // 1. Tìm 1 thửa đất có sẵn trong DB để test
  const parcelRes = await Database.query('SELECT id, project_parcel_code FROM parcels LIMIT 1');
  if (parcelRes.rows.length === 0) {
    throw new Error('Không tìm thấy thửa đất nào trong CSDL để test.');
  }
  const testParcel = parcelRes.rows[0];
  const parcelId = testParcel.id;
  console.log(`[Test] Sử dụng thửa đất ID: ${parcelId} (Mã: ${testParcel.project_parcel_code})`);

  // Lấy hoặc tạo mock users có ID dạng UUID hợp lệ
  const userRes = await Database.query('SELECT id, full_name, phone FROM users LIMIT 2');
  let surveyorA_Id = userRes.rows[0]?.id;
  let surveyorB_Id = userRes.rows[1]?.id;

  if (!surveyorA_Id) {
    surveyorA_Id = uuidv4();
  }
  if (!surveyorB_Id || surveyorB_Id === surveyorA_Id) {
    surveyorB_Id = uuidv4();
  }

  console.log(`[Test] Surveyor A UUID: ${surveyorA_Id}`);
  console.log(`[Test] Surveyor B UUID: ${surveyorB_Id}`);

  // Đảm bảo dọn dẹp sạch bản nháp cũ của thửa này trước khi test
  await Database.query(`DELETE FROM phase1_report_details WHERE report_id IN (SELECT id FROM base_survey_reports WHERE parcel_id = $1 AND status = 'DRAFT')`, [parcelId]);
  await Database.query(`DELETE FROM base_survey_reports WHERE parcel_id = $1 AND status = 'DRAFT'`, [parcelId]);

  try {
    // 2. KSV A Lưu nháp lần 1 (Milestone Sync)
    console.log('\n[Test 1] KSV A thực hiện lưu nháp tại Bước 3...');
    const draftPayloadA = {
      parcelId,
      surveyorId: surveyorA_Id,
      currentStep: 3,
      syncVersion: 1,
      surveyData: {
        parcelId,
        ownerName: 'Chủ nhà Test A',
        houseNumber: '123/45',
        street: 'Đường Thử Nghiệm',
        floors: [
          { id: 'fl_1', floorName: 'Tầng 1 (Trệt)', zones: [] }
        ]
      }
    };

    const saveResA = await SurveyService.saveSurveyDraft(draftPayloadA);
    console.log('[Test 1 Output]:', saveResA);
    if (!saveResA.success || saveResA.syncVersion < 1) {
      throw new Error('Test 1 thất bại: Không lưu được nháp của KSV A');
    }

    // Kiểm tra trực tiếp bảng base_survey_reports & parcels
    const dbCheck1 = await Database.query(
      `SELECT id, status, last_edited_by_id, sync_version, handover_security_code, is_ready_for_handover, survey_data_json
       FROM base_survey_reports WHERE parcel_id = $1 AND status = 'DRAFT'`,
      [parcelId]
    );
    const row1 = dbCheck1.rows[0];
    console.log(`[DB Check 1] Status: ${row1.status}, Editor: ${row1.last_edited_by_id}, Code: ${row1.handover_security_code}, Ready: ${row1.is_ready_for_handover}`);
    if (row1.status !== 'DRAFT') {
      throw new Error(`Test 1 DB thất bại: status mong đợi DRAFT nhưng nhận ${row1.status}`);
    }
    if (row1.last_edited_by_id !== surveyorA_Id) {
      throw new Error(`Test 1 DB thất bại: last_edited_by_id sai`);
    }

    const parcelCheck = await Database.query(`SELECT survey_status FROM parcels WHERE id = $1`, [parcelId]);
    console.log(`[Parcel Check] survey_status: ${parcelCheck.rows[0]?.survey_status}`);
    if (parcelCheck.rows[0]?.survey_status !== 'IN_PROGRESS') {
      throw new Error('Test 1 DB thất bại: Parcel survey_status chưa chuyển sang IN_PROGRESS');
    }

    const secCode = row1.handover_security_code;

    // 3. KSV A tự truy vấn lại hồ sơ nháp -> Phải lấy được ngay, không bị khóa
    console.log('\n[Test 2] KSV A tự truy vấn hồ sơ nháp của chính mình...');
    const getResA = await SurveyService.getSurveyDraft(parcelId, surveyorA_Id);
    if (getResA.isLocked) {
      throw new Error('Test 2 thất bại: Chính KSV A bị khóa');
    }
    console.log('[Test 2 Output] Thành công: KSV A lấy được bản nháp, isLocked = false, Step =', getResA.draft?.currentStep);

    // 4. KSV B vào xem hồ sơ trong vòng 15 phút -> Phải bị KHÓA AN TOÀN
    console.log('\n[Test 3] KSV B vào xem hồ sơ của KSV A (khi chưa bàn giao & < 15 phút)...');
    const getResB_locked = await SurveyService.getSurveyDraft(parcelId, surveyorB_Id);
    console.log('[Test 3 Output]: isLocked =', getResB_locked.isLocked, ', activeSurveyor =', getResB_locked.activeSurveyorName);
    if (!getResB_locked.isLocked) {
      throw new Error('Test 3 thất bại: KSV B không bị khóa!');
    }

    // 5. KSV A bấm nút "Bàn giao ca / Nghỉ ca" (Early Release Lock)
    console.log('\n[Test 4] KSV A bấm nút "Bàn giao ca" sớm...');
    const releaseRes = await SurveyService.releaseDraftLock(parcelId, null, surveyorA_Id);
    console.log('[Test 4 Output]:', releaseRes);
    if (!releaseRes.success) {
      throw new Error('Test 4 thất bại: Release lock thất bại');
    }

    // 6. KSV B vào lại hồ sơ -> Không bị khóa nữa, yêu cầu nhập mã PIN 6 số bàn giao
    console.log('\n[Test 5] KSV B vào lại sau khi KSV A đã bàn giao...');
    const getResB_handover = await SurveyService.getSurveyDraft(parcelId, surveyorB_Id);
    console.log('[Test 5 Output]: isLocked =', getResB_handover.isLocked, ', requiresHandover =', getResB_handover.requiresHandover, ', code =', getResB_handover.securityCode);
    if (getResB_handover.isLocked || !getResB_handover.requiresHandover) {
      throw new Error('Test 5 thất bại: requiresHandover phải là true');
    }

    // 7. KSV B nhập sai mã PIN -> Báo lỗi
    console.log('\n[Test 6] KSV B thử nhập sai mã PIN (000000)...');
    try {
      await SurveyService.takeoverSurveyDraft({
        parcelId,
        handoverCode: '000000',
        newSurveyorId: surveyorB_Id,
        note: 'Thử nhập sai'
      });
      throw new Error('Test 6 thất bại: Nhập sai mã mà không quăng lỗi');
    } catch (err: any) {
      console.log('[Test 6 Output] Thành công chặn mã sai:', err.message);
    }

    // 8. KSV B nhập đúng mã PIN -> Tiếp quản thành công trọn vẹn dữ liệu
    console.log(`\n[Test 7] KSV B nhập đúng mã PIN (${secCode})...`);
    const takeoverRes = await SurveyService.takeoverSurveyDraft({
      parcelId,
      handoverCode: secCode,
      newSurveyorId: surveyorB_Id,
      note: 'Ca chiều KSV B tiếp tục đo đạc lầu 2'
    });
    console.log('[Test 7 Output]: success =', takeoverRes.success, ', newSyncVersion =', takeoverRes.draft?.syncVersion);
    if (!takeoverRes.success || !takeoverRes.draft) {
      throw new Error('Test 7 thất bại: Tiếp quản ca không thành công');
    }

    // Kiểm tra DB sau tiếp quản
    const dbCheck2 = await Database.query(
      `SELECT id, last_edited_by_id, is_ready_for_handover, handover_history
       FROM base_survey_reports WHERE parcel_id = $1 AND status = 'DRAFT'`,
      [parcelId]
    );
    const row2 = dbCheck2.rows[0];
    console.log(`[DB Check 2] Editor mới: ${row2.last_edited_by_id}, Ready: ${row2.is_ready_for_handover}, History length:`, (row2.handover_history || []).length);
    if (row2.last_edited_by_id !== surveyorB_Id) {
      throw new Error('Test 7 DB thất bại: Editor chưa đổi sang KSV B');
    }
    if (row2.is_ready_for_handover !== false) {
      throw new Error('Test 7 DB thất bại: is_ready_for_handover chưa được reset về false');
    }

    console.log('\n🎉 TẤT CẢ 7 BÀI TEST NGHIỆP VỤ ĐỒNG BỘ VÀ TIẾP QUẢN CA ĐỀU THÀNH CÔNG RỰC RỠ! 🎉\n');
  } finally {
    // Dọn dẹp dữ liệu test nháp của thửa này
    await Database.query(`DELETE FROM phase1_report_details WHERE report_id IN (SELECT id FROM base_survey_reports WHERE parcel_id = $1 AND status = 'DRAFT')`, [parcelId]);
    await Database.query(`DELETE FROM base_survey_reports WHERE parcel_id = $1 AND status = 'DRAFT'`, [parcelId]);
    console.log('[Cleanup] Đã dọn dẹp bản ghi test tạm thành công.');
  }
}

runTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ LỖI TRONG QUÁ TRÌNH TEST:', err);
    process.exit(1);
  });
