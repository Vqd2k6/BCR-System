/**
 * Kiểm thử phân hệ Chấm công + Admin duyệt công (plan rà soát 2026-11-04, GĐ 0–1).
 * CHỈ chạy trên DB bản sao vì có ghi dữ liệu:
 *   cd backend && DB_NAME=metro2_audit_test npx ts-node src/scripts/test_attendance_admin_audit.ts
 * Mỗi lần chạy tạo user + Zone thử nghiệm mới; cuối test soft-delete các ca đã tạo (không DELETE).
 */
import assert from 'node:assert/strict';
import { config } from '../config';
import { Database, pool } from '../database/db';
import type { JwtPayload } from '../common/guards/auth.guard';
import { AttendanceService } from '../modules/attendance/attendance.service';
import { AttendanceRepository } from '../modules/attendance/attendance.repository';
import {
  canonicalJson,
  classifyBatchCandidate,
  escapeLikePattern,
  getVietnamDateStr,
  getVietnamMonthStr,
  resolveAdminZoneScope,
  sanitizeCsvCell,
  validateVerifyTransition,
} from '../modules/attendance/attendance.rules';

if (config.db.database === 'metro2_gis_db' || process.env.DATABASE_URL) {
  throw new Error('[test_attendance_admin_audit] Từ chối chạy: chỉ dùng DB bản sao (DB_NAME=metro2_audit_test).');
}

const RUN = Date.now().toString(36);
const TEST_ZONE = `ZT_${RUN}`.toUpperCase().slice(0, 32);
const createdCheckInIds: string[] = [];
let passed = 0;

function ok(name: string) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

async function expectError(name: string, fn: () => Promise<unknown>, status: number, code?: string) {
  try {
    await fn();
  } catch (err: unknown) {
    const e = err as { status?: number; code?: string; message?: string };
    assert.equal(e.status, status, `${name}: mong đợi HTTP ${status}, nhận ${e.status} (${e.message})`);
    if (code) assert.equal(e.code, code, `${name}: mong đợi code ${code}, nhận ${e.code}`);
    ok(name);
    return;
  }
  assert.fail(`${name}: mong đợi lỗi ${status} nhưng thành công`);
}

async function createUser(role: JwtPayload['role'], zone: string | null, label: string): Promise<JwtPayload> {
  const username = `t_att_${label}_${RUN}`;
  const res = await Database.query<{ id: string }>(
    `INSERT INTO users (username, password_hash, full_name, role, assigned_zone_id, surveyor_code, phone)
     VALUES ($1, 'x', $2, $3, $4, $5, $6) RETURNING id;`,
    [username, `Test ${label} ${RUN}`, role, zone, `T${label}`.slice(0, 16), `09${RUN.slice(-6)}`]
  );
  return { userId: res.rows[0].id, username, role, assignedZoneId: zone, fullName: `Test ${label}` };
}

/** Ca fixture chèn thẳng với thời điểm quá khứ (service luôn dùng NOW()). */
async function insertFixture(data: {
  surveyorId: string;
  zoneId: string;
  checkinTime: string;
  checkoutTime?: string | null;
  durationMinutes?: number | null;
  anomalyCodes?: string[];
  selfie?: string | null;
  isCompanion?: boolean;
  status?: string;
}): Promise<string> {
  const res = await Database.query<{ id: string }>(
    `INSERT INTO timekeeping_checkins (
       surveyor_id, zone_id, checkin_time, gps_location, distance_to_zone_center_meters, is_within_zone_boundary,
       selfie_photo_url, verification_status, has_anomaly_flag, anomaly_codes,
       is_companion, companion_name, checkout_time, work_duration_minutes, checkout_distance_to_zone_center_meters
     ) VALUES ($1, $2, $3::timestamptz, ST_SetSRID(ST_MakePoint(106.66, 10.78), 4326), 10, TRUE,
       $4, $5, cardinality($6::text[]) > 0, $6::text[],
       $7, CASE WHEN $7 THEN 'Người đi kèm test' ELSE NULL END, $8::timestamptz, $9, CASE WHEN $8::timestamptz IS NULL THEN NULL ELSE 10 END)
     RETURNING id;`,
    [
      data.surveyorId,
      data.zoneId,
      data.checkinTime,
      data.selfie === undefined ? 'https://test.local/selfie.jpg' : data.selfie,
      data.status || 'PENDING_VERIFICATION',
      data.anomalyCodes || [],
      Boolean(data.isCompanion),
      data.checkoutTime ?? null,
      data.durationMinutes ?? null,
    ]
  );
  createdCheckInIds.push(res.rows[0].id);
  return res.rows[0].id;
}

/** Thời điểm hh:mm (giờ VN) của một ngày YYYY-MM-DD. */
function vnTime(date: string, hhmm: string): string {
  return `${date}T${hhmm}:00+07:00`;
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00+07:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return getVietnamDateStr(d);
}

function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 15));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function pureRules() {
  console.log('\n[1] Quy tắc thuần');
  const za01: JwtPayload = { userId: 'a', username: 'a', role: 'ZONE_ADMIN', assignedZoneId: 'ZONE_01', fullName: 'A' };
  const sa: JwtPayload = { userId: 's', username: 's', role: 'SUPER_ADMIN', assignedZoneId: null, fullName: 'S' };
  assert.deepEqual(resolveAdminZoneScope(za01, 'ALL').zoneIds, ['ZONE_01', 'ZONE_S1']);
  ok('Zone Admin xin ALL bị thu hẹp về Zone được gán');
  assert.throws(() => resolveAdminZoneScope(za01, 'ZONE_09'));
  ok('Zone Admin xin Zone khác bị từ chối');
  assert.equal(resolveAdminZoneScope(sa, undefined).zoneIds, null);
  ok('Super Admin mặc định toàn tuyến');

  assert.ok(validateVerifyTransition({ previousStatus: 'PENDING_VERIFICATION', action: 'REJECT', notes: null }).error);
  ok('Từ chối không ghi chú bị chặn');
  assert.ok(validateVerifyTransition({ previousStatus: 'APPROVED', action: 'APPROVE', notes: 'x' }).error);
  ok('Duyệt lại cùng trạng thái bị chặn');
  assert.ok(validateVerifyTransition({ previousStatus: 'APPROVED', action: 'RESET_PENDING', notes: null }).error);
  ok('Đổi quyết định đã có mà không ghi lý do bị chặn');
  assert.equal(validateVerifyTransition({ previousStatus: 'PENDING_VERIFICATION', action: 'APPROVE', notes: null }).error, undefined);
  ok('Duyệt từ PENDING không cần ghi chú');

  assert.equal(sanitizeCsvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(sanitizeCsvCell('+84 909'), `'+84 909`);
  assert.equal(sanitizeCsvCell('Nguyễn Văn A'), 'Nguyễn Văn A');
  ok('CSV chống formula injection');
  assert.equal(escapeLikePattern('50%_a\\'), '50\\%\\_a\\\\');
  ok('Escape ký tự đại diện ILIKE');
  assert.equal(canonicalJson({ b: 1, a: [{ d: 2, c: 3 }] }), canonicalJson({ a: [{ c: 3, d: 2 }], b: 1 }));
  ok('JSON chuẩn hóa không phụ thuộc thứ tự key');

  const base = { surveyorId: 'k', adminId: 'a', checkoutTime: new Date(), anomalyCodes: [], selfiePhotoUrl: 'u', periodLocked: false };
  assert.equal(classifyBatchCandidate(base), null);
  assert.equal(classifyBatchCandidate({ ...base, surveyorId: 'a' }), 'SELF_CHECKIN');
  assert.equal(classifyBatchCandidate({ ...base, checkoutTime: null }), 'NOT_CHECKED_OUT');
  assert.equal(classifyBatchCandidate({ ...base, anomalyCodes: ['SHORT_DURATION'] }), 'HAS_ANOMALY');
  assert.equal(classifyBatchCandidate({ ...base, selfiePhotoUrl: null }), 'NO_SELFIE');
  assert.equal(classifyBatchCandidate({ ...base, periodLocked: true }), 'PERIOD_LOCKED');
  ok('Phân loại ca sạch cho Duyệt nhanh');
}

async function checkInFlows(users: Record<string, JwtPayload>) {
  console.log('\n[2] Check-in / Check-out');
  const z09 = await AttendanceService.getZoneInfo('ZONE_09');
  const zS9 = await AttendanceService.getZoneInfo('ZONE_S9');
  const z08 = await AttendanceService.getZoneInfo('ZONE_08');
  const at = (c: { lat: number; lng: number }) => ({ gpsLatitude: c.lat, gpsLongitude: c.lng });
  const selfie = 'https://test.local/selfie.jpg';

  const a = await AttendanceService.checkIn(users.ksvA.userId, { zoneId: 'ZONE_09', ...at(z09.centroid), selfiePhotoUrl: selfie, gpsAccuracyMeters: 8 });
  createdCheckInIds.push(a.checkInId);
  assert.equal(a.verificationStatus, 'PENDING_VERIFICATION');
  assert.deepEqual(a.anomalyCodes, []);
  ok('Check-in đúng Zone, đúng vị trí: PENDING, không cờ');

  const aRow = await AttendanceRepository.getCheckInById(a.checkInId);
  assert.ok(aRow && aRow.zone_center_lat !== null && Number(aRow.gps_accuracy_meters) === 8);
  ok('Lưu snapshot tâm Zone và độ chính xác GPS');

  await expectError('Check-in lần 2 cùng ngày bị chặn', () =>
    AttendanceService.checkIn(users.ksvA.userId, { zoneId: 'ZONE_09', ...at(z09.centroid), selfiePhotoUrl: selfie }), 409);

  const c = await AttendanceService.checkIn(users.ksvC.userId, { zoneId: 'ZONE_S9', ...at(zS9.centroid), selfiePhotoUrl: selfie });
  createdCheckInIds.push(c.checkInId);
  assert.deepEqual(c.anomalyCodes, []);
  ok('Zone tương đương (ZONE_S9 của ZONE_09) không bị cờ');

  await expectError('Zone ngoài phân công mà không lý do bị chặn', () =>
    AttendanceService.checkIn(users.ksvB.userId, { zoneId: 'ZONE_08', ...at(z08.centroid), selfiePhotoUrl: selfie }), 400);

  const parallel = await Promise.allSettled([1, 2, 3].map(() =>
    AttendanceService.checkIn(users.ksvB.userId, { zoneId: 'ZONE_08', ...at(z08.centroid), selfiePhotoUrl: selfie, notes: 'Hỗ trợ Zone 8' })
  ));
  const fulfilled = parallel.filter((p): p is PromiseFulfilledResult<Awaited<ReturnType<typeof AttendanceService.checkIn>>> => p.status === 'fulfilled');
  assert.equal(fulfilled.length, 1, 'Chỉ 1 trong 3 request song song được tạo ca');
  createdCheckInIds.push(fulfilled[0].value.checkInId);
  assert.ok(fulfilled[0].value.anomalyCodes.includes('ZONE_NOT_ASSIGNED'));
  ok('3 request check-in song song chỉ tạo 1 ca; ca mang cờ ZONE_NOT_ASSIGNED');

  const far = { gpsLatitude: z09.centroid.lat + 0.02, gpsLongitude: z09.centroid.lng };
  await expectError('Check-out >500m không lý do bị chặn', () =>
    AttendanceService.checkOut(users.ksvA.userId, { ...far, selfiePhotoUrl: selfie }), 400);
  // Payload như bản PWA cũ (còn gửi zoneId) — service phải bỏ qua zoneId.
  const legacyPayload = { ...far, selfiePhotoUrl: selfie, notes: 'Ra ca ngoài hiện trường', zoneId: 'ZONE_08' };
  const out = await AttendanceService.checkOut(users.ksvA.userId, legacyPayload);
  assert.equal(out.zoneId, 'ZONE_09', 'Zone Check-out phải là Zone của ca, bỏ qua zoneId client');
  assert.ok(out.anomalyCodes.includes('DISTANCE_OVER_500M_OUT') && out.anomalyCodes.includes('SHORT_DURATION'));
  ok('Check-out >500m có lý do: gắn DISTANCE_OVER_500M_OUT + SHORT_DURATION, giữ Zone của ca');
  await expectError('Check-out lần 2 không ghi đè giờ ra', () =>
    AttendanceService.checkOut(users.ksvA.userId, { ...at(z09.centroid), selfiePhotoUrl: selfie }), 409);

  const comp1 = await AttendanceService.checkIn(users.ksvC.userId, { zoneId: 'ZONE_09', ...at(z09.centroid), selfiePhotoUrl: selfie, isCompanion: true, companionName: 'Đi kèm 1' });
  const comp2 = await AttendanceService.checkIn(users.ksvC.userId, { zoneId: 'ZONE_09', ...at(z09.centroid), selfiePhotoUrl: selfie, isCompanion: true, companionName: 'Đi kèm 2' });
  createdCheckInIds.push(comp1.checkInId, comp2.checkInId);
  await expectError('2 người đi kèm đang mở, Check-out không chọn người bị chặn', () =>
    AttendanceService.checkOut(users.ksvC.userId, { ...at(z09.centroid), isCompanion: true }), 400);
  const compOut = await AttendanceService.checkOut(users.ksvC.userId, { ...at(z09.centroid), isCompanion: true, checkInId: comp1.checkInId });
  assert.equal(compOut.checkInId, comp1.checkInId);
  ok('Check-out đúng người đi kèm khi gửi checkInId');

  return { aId: a.checkInId };
}

async function adminFlows(users: Record<string, JwtPayload>, aId: string) {
  console.log('\n[3] Phạm vi Zone & duyệt đơn lẻ');
  await expectError('Zone Admin Zone khác xem chi tiết → 404', () => AttendanceService.getCheckInDetail(users.za01, aId), 404);
  await expectError('Zone Admin Zone khác duyệt → 404', () => AttendanceService.verifyAttendance(users.za01, aId, 'APPROVE'), 404);
  const list01 = await AttendanceService.listZoneCheckIns(users.za01, 'ALL', { limit: 200 });
  assert.equal(list01.scope, 'ZONE_01');
  assert.ok(!list01.checkIns.some((c) => c.id === aId));
  ok('Zone Admin xin ALL chỉ thấy Zone của mình');

  const today = getVietnamDateStr();
  const list09 = await AttendanceService.listZoneCheckIns(users.za09, undefined, { fromDate: today, toDate: today, limit: 200 });
  assert.ok(list09.checkIns.some((c) => c.id === aId), 'Lọc toDate = hôm nay phải có ca hôm nay');
  ok('Lọc theo ngày VN: toDate = hôm nay vẫn có ca hôm nay');
  const searched = await AttendanceService.listZoneCheckIns(users.za09, undefined, { search: '%', limit: 200 });
  assert.equal(searched.total, 0, 'Tìm "%" phải hiểu theo nghĩa đen');
  ok('Tìm kiếm escape ký tự %');

  const z09 = await AttendanceService.getZoneInfo('ZONE_09');
  const own = await AttendanceService.checkIn(users.za09.userId, {
    zoneId: 'ZONE_09',
    gpsLatitude: z09.centroid.lat,
    gpsLongitude: z09.centroid.lng,
    selfiePhotoUrl: 'https://test.local/selfie.jpg',
  });
  createdCheckInIds.push(own.checkInId);
  await expectError('Zone Admin tự duyệt ca của mình → 403', () => AttendanceService.verifyAttendance(users.za09, own.checkInId, 'APPROVE'), 403);
  await AttendanceService.verifyAttendance(users.sa, own.checkInId, 'APPROVE');
  ok('Super Admin duyệt ca của Zone Admin');

  await expectError('Từ chối không ghi chú → 400', () => AttendanceService.verifyAttendance(users.za09, aId, 'REJECT'), 400);

  const originalInsertAudit = AttendanceRepository.insertAudit;
  AttendanceRepository.insertAudit = async () => {
    throw new Error('Giả lập lỗi ghi audit');
  };
  try {
    await AttendanceService.verifyAttendance(users.za09, aId, 'APPROVE');
    assert.fail('Phải lỗi khi ghi audit lỗi');
  } catch (err: unknown) {
    assert.equal((err as Error).message, 'Giả lập lỗi ghi audit');
  } finally {
    AttendanceRepository.insertAudit = originalInsertAudit;
  }
  assert.equal((await AttendanceRepository.getCheckInById(aId))?.verification_status, 'PENDING_VERIFICATION');
  ok('Ghi audit lỗi → rollback, trạng thái ca không đổi');

  await AttendanceService.verifyAttendance(users.za09, aId, 'APPROVE');
  await expectError('Duyệt lại cùng trạng thái → 409', () => AttendanceService.verifyAttendance(users.za09, aId, 'APPROVE'), 409);
  await expectError('Đổi quyết định không lý do → 400', () => AttendanceService.verifyAttendance(users.za09, aId, 'FLAG_WARNING'), 400);
  await AttendanceService.verifyAttendance(users.za09, aId, 'FLAG_WARNING', 'Check-out lệch vị trí');
  const detail = await AttendanceService.getCheckInDetail(users.za09, aId);
  const actions = detail.verification_history.map((h) => h.action);
  assert.deepEqual(actions, ['VERIFY_APPROVE', 'VERIFY_FLAG_WARNING']);
  assert.ok(detail.verification_history.every((h) => typeof (h.diff_payload as { recordSha256?: string })?.recordSha256 === 'string'));
  ok('Mỗi lần đổi trạng thái đúng 1 audit kèm recordSha256');

  const [r1, r2] = await Promise.allSettled([
    AttendanceService.verifyAttendance(users.za09, aId, 'REJECT', 'Admin 1 từ chối'),
    AttendanceService.verifyAttendance(users.sa, aId, 'APPROVE', 'Admin 2 duyệt lại'),
  ]);
  assert.ok(r1.status === 'fulfilled' && r2.status === 'fulfilled');
  const afterRace = await AttendanceService.getCheckInDetail(users.za09, aId);
  assert.equal(afterRace.verification_history.length, 4);
  ok('2 Admin duyệt cùng lúc: tuần tự qua FOR UPDATE, 2 audit nối tiếp');
}

async function batchAndMissing(users: Record<string, JwtPayload>) {
  console.log('\n[4] Thiếu Check-out & Duyệt nhanh');
  const yesterday = shiftDate(getVietnamDateStr(), -1);
  const za: JwtPayload = { ...users.zaTest };
  const clean = await insertFixture({ surveyorId: users.ksvE.userId, zoneId: TEST_ZONE, checkinTime: vnTime(yesterday, '07:30'), checkoutTime: vnTime(yesterday, '17:00'), durationMinutes: 570 });
  const missing = await insertFixture({ surveyorId: users.ksvD.userId, zoneId: TEST_ZONE, checkinTime: vnTime(yesterday, '23:50') });
  const short = await insertFixture({ surveyorId: users.ksvF.userId, zoneId: TEST_ZONE, checkinTime: vnTime(yesterday, '08:00'), checkoutTime: vnTime(yesterday, '08:25'), durationMinutes: 25, anomalyCodes: ['SHORT_DURATION'] });
  const ownRow = await insertFixture({ surveyorId: za.userId, zoneId: TEST_ZONE, checkinTime: vnTime(yesterday, '07:00'), checkoutTime: vnTime(yesterday, '16:00'), durationMinutes: 540 });
  const companionClean = await insertFixture({ surveyorId: users.ksvE.userId, zoneId: TEST_ZONE, checkinTime: vnTime(yesterday, '07:35'), checkoutTime: vnTime(yesterday, '17:00'), durationMinutes: 565, isCompanion: true });

  const missingRow = await AttendanceRepository.getCheckInById(missing);
  assert.ok(missingRow?.is_missing_checkout && missingRow.effective_anomaly_codes?.includes('MISSING_CHECKOUT'));
  assert.equal(missingRow?.work_duration_minutes, null);
  ok('Ca 23:50 không Check-out: qua 0h mang MISSING_CHECKOUT, thời lượng để trống');

  const filters = { fromDate: yesterday, toDate: yesterday };
  const dry = await AttendanceService.batchVerifyClean(za, undefined, filters, true);
  assert.equal(dry.eligibleCount, 2, 'Chỉ ca KSV sạch + lượt đi kèm sạch');
  assert.equal(dry.skipped.SELF_CHECKIN, 1);
  assert.equal(dry.skipped.NOT_CHECKED_OUT, 1);
  assert.equal(dry.skipped.HAS_ANOMALY, 1);
  assert.equal((await AttendanceRepository.getCheckInById(clean))?.verification_status, 'PENDING_VERIFICATION');
  ok('dryRun đếm đúng và không ghi gì');

  const run1 = await AttendanceService.batchVerifyClean(za, undefined, filters, false);
  assert.deepEqual(new Set(run1.approvedIds), new Set([clean, companionClean]));
  const run2 = await AttendanceService.batchVerifyClean(za, undefined, filters, false);
  assert.deepEqual(run2.approvedIds, []);
  assert.equal((await AttendanceRepository.getCheckInById(short))?.verification_status, 'PENDING_VERIFICATION');
  assert.equal((await AttendanceRepository.getCheckInById(ownRow))?.verification_status, 'PENDING_VERIFICATION');
  ok('Duyệt nhanh chỉ duyệt ca sạch; bấm lần 2 không duyệt thêm');

  await AttendanceService.verifyAttendance(users.sa, missing, 'FLAG_WARNING', 'Quên Check-out, đã xác minh qua sản lượng');
  ok('Admin xét ca thiếu Check-out bằng Nhắc nhở');
}

async function periodFlows(users: Record<string, JwtPayload>) {
  console.log('\n[5] Kỳ công tháng');
  const month = previousMonth(getVietnamMonthStr());
  const day = `${month}-10`;
  const za = users.zaTest;
  const mainApproved = await insertFixture({ surveyorId: users.ksvE.userId, zoneId: TEST_ZONE, checkinTime: vnTime(day, '07:30'), checkoutTime: vnTime(day, '17:00'), durationMinutes: 570, status: 'APPROVED' });
  const pending = await insertFixture({ surveyorId: users.ksvD.userId, zoneId: TEST_ZONE, checkinTime: vnTime(day, '07:30'), checkoutTime: vnTime(day, '17:00'), durationMinutes: 570 });
  await insertFixture({ surveyorId: users.ksvE.userId, zoneId: TEST_ZONE, checkinTime: vnTime(day, '07:40'), checkoutTime: vnTime(day, '17:00'), durationMinutes: 560, isCompanion: true, status: 'REJECTED' });

  await expectError('Chốt kỳ tháng hiện tại → 400', () => AttendanceService.lockPeriod(za, undefined, getVietnamMonthStr()), 400);
  await expectError('Chốt kỳ khi còn ca chờ duyệt → 409', () => AttendanceService.lockPeriod(za, undefined, month), 409, 'PERIOD_HAS_PENDING');
  const status = await AttendanceService.getPeriodStatus(za, undefined, month);
  assert.deepEqual(status.pendingIds, [pending]);
  ok('Trạng thái kỳ liệt kê đúng ca cần xử lý');

  await AttendanceService.verifyAttendance(za, pending, 'FLAG_WARNING', 'Nhắc nhở để kiểm thử');
  const summary = await AttendanceService.getSummary(za, undefined, month);
  const rowE = summary.rows.find((r) => r.surveyor_id === users.ksvE.userId);
  const rowD = summary.rows.find((r) => r.surveyor_id === users.ksvD.userId);
  assert.equal(rowE?.work_days, 1);
  assert.equal(rowE?.companion_checkins_total, 1);
  assert.equal(rowE?.companion_accepted_count, 0);
  assert.equal(rowD?.work_days, 1, 'Nhắc nhở vẫn tính 1 công');
  assert.equal(rowD?.flagged_days, 1);
  ok('Bảng công: Nhắc nhở tính công; lượt đi kèm bị Từ chối không ảnh hưởng công KSV');

  const lock1 = await AttendanceService.lockPeriod(za, undefined, month);
  assert.match(lock1.sha256, /^[0-9a-f]{64}$/);
  ok('Chốt kỳ: snapshot + SHA-256');

  await expectError('Duyệt ca trong kỳ đã khóa (cả Super Admin) → 409', () =>
    AttendanceService.verifyAttendance(users.sa, mainApproved, 'REJECT', 'Thử sửa sau chốt'), 409, 'PERIOD_LOCKED');
  await expectError('Zone Admin mở khóa kỳ → 403', () => AttendanceService.unlockPeriod(za, undefined, month, 'Muốn sửa lại'), 403);

  await Database.query(`UPDATE users SET full_name = $2 WHERE id = $1;`, [users.ksvE.userId, `Đã đổi tên ${RUN}`]);
  const csvLocked = await AttendanceService.exportSummaryCsv(za, undefined, month);
  assert.ok(csvLocked.content.startsWith('﻿'));
  assert.ok(csvLocked.content.includes(`Test ksvE ${RUN}`) && !csvLocked.content.includes(`Đã đổi tên ${RUN}`));
  assert.ok(csvLocked.content.includes(lock1.sha256));
  ok('CSV kỳ đã khóa xuất từ snapshot (giữ tên cũ, có SHA-256, có BOM)');

  await AttendanceService.unlockPeriod(users.sa, TEST_ZONE, month, 'Đính chính ca đã duyệt sai');
  await AttendanceService.verifyAttendance(users.sa, mainApproved, 'REJECT', 'Selfie không khớp người');
  const lock2 = await AttendanceService.lockPeriod(za, undefined, month);
  assert.notEqual(lock2.sha256, lock1.sha256);
  const status2 = await AttendanceService.getPeriodStatus(za, undefined, month);
  assert.equal(status2.snapshots.length, 2);
  assert.ok(status2.snapshots.some((s) => s.sha256 === lock1.sha256 && s.unlockReason === 'Đính chính ca đã duyệt sai'));
  ok('Mở khóa rồi chốt lại: 2 snapshot, hash khác nhau, snapshot cũ còn nguyên');
}

async function main(): Promise<void> {
  pureRules();

  const users: Record<string, JwtPayload> = {
    ksvA: await createUser('SURVEYOR', 'ZONE_09', 'ksvA'),
    ksvB: await createUser('SURVEYOR', null, 'ksvB'),
    ksvC: await createUser('SURVEYOR', 'ZONE_09', 'ksvC'),
    ksvD: await createUser('SURVEYOR', TEST_ZONE, 'ksvD'),
    ksvE: await createUser('SURVEYOR', TEST_ZONE, 'ksvE'),
    ksvF: await createUser('SURVEYOR', TEST_ZONE, 'ksvF'),
    za09: await createUser('ZONE_ADMIN', 'ZONE_09', 'za09'),
    za01: await createUser('ZONE_ADMIN', 'ZONE_01', 'za01'),
    zaTest: await createUser('ZONE_ADMIN', TEST_ZONE, 'zaT'),
    sa: await createUser('SUPER_ADMIN', null, 'sa'),
  };

  try {
    const { aId } = await checkInFlows(users);
    await adminFlows(users, aId);
    await batchAndMissing(users);
    await periodFlows(users);
    console.log(`\n✅ ${passed} kiểm thử đạt.`);
  } finally {
    if (createdCheckInIds.length > 0) {
      await Database.query(`UPDATE timekeeping_checkins SET deleted_at = NOW() WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL;`, [createdCheckInIds]);
    }
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error('[test_attendance_admin_audit] FAILED:', err);
  process.exit(1);
});
