import { SurveyService } from '../modules/survey/survey.service';
import { SurveyRepository } from '../modules/survey/survey.repository';

// Kiểm thử ca bản nháp không có mã bàn giao (báo cáo được revert về DRAFT).
// Toàn bộ repository được stub nên không đọc/ghi CSDL.
async function runTest() {
  const draft: Record<string, unknown> = {
    id: 'report-1',
    surveyor_id: 'surveyor-a',
    last_edited_by_id: 'surveyor-a',
    surveyor_name: 'KSV A',
    surveyor_phone: '',
    current_step: 1,
    sync_version: 1,
    survey_data_json: {},
    is_ready_for_handover: true,
    updated_at: new Date().toISOString(),
    handover_security_code: null,
  };
  const calls = { takeover: 0 };
  const takeoverCount = () => calls.takeover;

  SurveyRepository.findActiveDraft = async () => draft;
  SurveyRepository.ensureHandoverCode = async () => {
    draft.handover_security_code = draft.handover_security_code || '482913';
    return draft.handover_security_code as string;
  };
  SurveyRepository.takeoverDraft = async () => {
    calls.takeover += 1;
    return draft;
  };

  const expectRejected = async (handoverCode: string) => {
    let rejected = false;
    try {
      await SurveyService.takeoverSurveyDraft({ parcelId: 'p', handoverCode, newSurveyorId: 'admin' });
    } catch {
      rejected = true;
    }
    if (!rejected) throw new Error(`Mã ${handoverCode} phải bị từ chối`);
  };

  // Mã NULL không được khớp với bất kỳ giá trị nào, kể cả chuỗi 'null' và mã giả cũ
  await expectRejected('123456');
  await expectRejected('null');

  const first = await SurveyService.getSurveyDraft('p', 'admin');
  const second = await SurveyService.getSurveyDraft('p', 'admin');
  if (first.securityCode !== '482913') throw new Error(`Phải cấp mã thật, nhận ${first.securityCode}`);
  if (second.securityCode !== first.securityCode) throw new Error('Mã phải ổn định giữa các lần gọi');

  await expectRejected('000000');
  if (takeoverCount() !== 0) throw new Error('Mã sai không được phép tiếp quản');

  const res = await SurveyService.takeoverSurveyDraft({
    parcelId: 'p',
    handoverCode: first.securityCode as string,
    newSurveyorId: 'admin',
  });
  if (!res.success || takeoverCount() !== 1) throw new Error('Mã đúng phải tiếp quản được');

  console.log('✅ Mã bàn giao NULL: cấp mã thật, ổn định, chặn mã sai, tiếp quản thành công');
}

runTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ [TestHandoverCodeNull] Thất bại:', err);
    process.exit(1);
  });
