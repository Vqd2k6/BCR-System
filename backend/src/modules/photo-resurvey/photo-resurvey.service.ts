/**
 * ============================================================================
 * PHOTO RESURVEY – SERVICE
 * KSV ra hiện trường chụp lại ảnh ngoài nhà dân theo cờ Photo QC; Zone Admin duyệt.
 * - Ô ảnh luôn đọc qua ViewModel report thật (đã áp các phiên đã duyệt trước) để khoá ô và
 *   chữ ngày giờ watermark khớp đúng bản in.
 * - Ảnh mới lưu ở nhánh R2 riêng `resurvey/...`, server tự dựng khoá (không nhận thư mục từ client).
 * - Mọi ghi DB nằm trong transaction kèm nhật ký hệ thống; nộp và duyệt lưu SHA-256 nội dung phiên.
 * - Hồ sơ đã phát hành (APPROVED): duyệt ghi thêm snapshot chờ phát hành, r00 giữ nguyên SHA-256.
 * ============================================================================
 */

import type { PoolClient } from 'pg';
import sharp from 'sharp';
import { Database } from '../../database/db';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from '../../common/errors/problem-details';
import type { JwtPayload } from '../../common/guards/auth.guard';
import { StorageService } from '../../common/services/storage.service';
import { CadastralRepository } from '../cadastral/cadastral.repository';
import { PhotoQcRepository } from '../photo-qc/photo-qc.repository';
import { isSameSourcePhoto } from '../photo-qc/photo-qc.rules';
import { PhotoQcService } from '../photo-qc/photo-qc.service';
import { walkViewModelPhotos } from '../photo-qc/photo-qc.vm-walker';
import { formatWatermarkDateTime } from '../report/mappers/formatters.mapper';
import { ReportViewModelMapper } from '../report/mappers/report-viewmodel.mapper';
import { ReportService } from '../report/services/report.service';
import { applyCondoReportContext } from '../report/snapshot/condo-absent-projection';
import { ReportSnapshotService } from '../report/snapshot/report-snapshot.service';
import { canAccessZone } from '../report/utils/zone-access.utils';
import { ReportConfigService } from '../report_config/report-config.service';
import { applyResurveyToViewModel } from './photo-resurvey.render';
import { PhotoResurveyRepository } from './photo-resurvey.repository';
import {
  buildResurveyFileName,
  computeExtraTimes,
  extraTimeBounds,
  formatTime2,
  isMultiPhotoSlot,
  NA_FORBIDDEN_SLOTS,
  parseWatermarkText,
  slotCodeOf,
  stableSha256,
  type TimelineEntry,
} from './photo-resurvey.rules';
import type { ApplyDecisionInput, ApproveInput, MarkNaInput, RejectInput, TaskQuery, UploadResurveyPhotoInput } from './photo-resurvey.schemas';
import type {
  ResurveyExtraTimePreview,
  ResurveyIdentity,
  ResurveyItemRow,
  ResurveySessionRow,
  ResurveySessionView,
  ResurveySlotCode,
  ResurveySlotView,
  ResurveyTask,
} from './photo-resurvey.types';

type JsonObject = Record<string, unknown>;

const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
const MAX_PHOTO_DIMENSION = 4096;

function asObject(v: unknown): JsonObject {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as JsonObject) : {};
}

function str(v: unknown): string | null {
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}

function num(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

interface ReportMetaRow {
  id: string;
  report_code: string;
  report_type: string;
  unit_id: string | null;
  status: string;
  phase: string;
  deleted_at: Date | null;
  parcel_id: string;
  zone_id: string | null;
  survey_date: Date | null;
  project_parcel_code: string | null;
  house_number: string | null;
  street: string | null;
}

interface CurrentState {
  meta: ReportMetaRow;
  identity: ResurveyIdentity;
  slots: ResurveySlotView[];
  timeline: TimelineEntry[];
  surveyDateText: string;
  /** Ô ảnh ngoài nhà còn cờ chụp lại (OPEN / ASSIGNED). */
  openKeys: string[];
  levelIsNone: boolean;
}

/** Quyền theo phân khu cho KSV: Zone được gán (kể cả alias) hoặc toàn tuyến. */
function surveyorCanAccessZone(user: JwtPayload, zoneId: string | null): boolean {
  const assigned = (user.assignedZoneId || '').trim().toUpperCase();
  if (!assigned) return false;
  if (assigned === 'ALL' || assigned === 'ALL_ZONES') return true;
  if (!zoneId) return false;
  return CadastralRepository.getZoneAliases(assigned).includes(zoneId.trim().toUpperCase());
}

function isAdmin(user: JwtPayload): boolean {
  return user.role === 'ZONE_ADMIN' || user.role === 'SUPER_ADMIN';
}

function assertView(user: JwtPayload, zoneId: string | null): void {
  if (isAdmin(user)) {
    if (!canAccessZone(user, zoneId)) throw new ForbiddenError('Hồ sơ không thuộc phân khu bạn phụ trách');
    return;
  }
  if (user.role === 'SURVEYOR') {
    if (!surveyorCanAccessZone(user, zoneId)) throw new ForbiddenError('Hồ sơ không thuộc phân khu bạn được phân công');
    return;
  }
  throw new ForbiddenError('Tài khoản không có quyền khảo sát bổ sung');
}

function requireUserId(user: JwtPayload): string {
  if (!user.userId) throw new UnauthorizedError('Người dùng chưa xác thực');
  return user.userId;
}

/** Nội dung phiên đưa vào SHA-256: chỉ phần có giá trị pháp lý, đã sắp thứ tự ổn định. */
function canonicalItems(items: ResurveyItemRow[]): unknown[] {
  return [...items]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((i) => ({
      id: i.id,
      action: i.action,
      slotCode: i.slotCode,
      photoKey: i.photoKey,
      originalUrl: i.originalUrl,
      extraIndex: i.extraIndex,
      newUrl: i.newUrl,
      newSha256: i.newSha256,
      rotation: i.rotation,
      naReason: i.naReason,
      time2Text: i.time2Text,
      capturedAtClient: i.capturedAtClient,
      receivedAt: i.receivedAt,
    }));
}

function decodeJpeg(base64: string): Buffer {
  const m = base64.match(/^data:([A-Za-z0-9.+/-]+);base64,(.+)$/s);
  if (m && m[1] !== 'image/jpeg') throw new BadRequestError('Ảnh phải là JPEG (đã nén trên máy trước khi tải)');
  const buffer = Buffer.from(m ? m[2] : base64, 'base64');
  if (buffer.length < 3 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
    throw new BadRequestError('Dữ liệu ảnh không phải JPEG hợp lệ');
  }
  if (buffer.length > MAX_PHOTO_BYTES) throw new BadRequestError('Ảnh vượt quá 12 MB, vui lòng chụp lại');
  return buffer;
}

export class PhotoResurveyService {
  // ---------------------------------------------------------------------------
  // Đọc trạng thái hiện tại của hồ sơ (như bản in kế tiếp)
  // ---------------------------------------------------------------------------

  private static async loadMeta(reportId: string): Promise<ReportMetaRow> {
    const res = await Database.query<ReportMetaRow>(
      `SELECT r.id, r.report_code, r.report_type, r.unit_id, r.status::text AS status, r.phase::text AS phase, r.deleted_at,
              r.parcel_id, p.zone_id, r.survey_date, p.project_parcel_code, p.house_number, p.street
       FROM base_survey_reports r
       JOIN parcels p ON p.id = r.parcel_id
       WHERE r.id = $1;`,
      [reportId]
    );
    const m = res.rows[0];
    if (!m || m.deleted_at) throw new NotFoundError(`Không tìm thấy hồ sơ ${reportId}`);
    if (m.report_type !== 'STANDALONE' || m.unit_id) {
      throw new BadRequestError('Khảo sát bổ sung hiện chỉ áp dụng cho hồ sơ nhà dân');
    }
    return m;
  }

  private static buildIdentity(meta: ReportMetaRow, raw: JsonObject, surveyDateText: string): ResurveyIdentity {
    const json = asObject(raw.survey_data_json);
    const adj = asObject(json.adjacentBuildings);
    const side = (k: string) => {
      const s = asObject(adj[k]);
      return { details: str(s.details), note: str(s.note) };
    };
    const st = asObject(json.settlementTilt);
    const diff = asObject(st.diffSettlement);
    const tilt = asObject(st.buildingTilt);
    const abn = asObject(st.abnormalCase);
    const gps = asObject(json.gpsCoords);
    const lat = num(gps.lat);
    const lng = num(gps.lng);
    const houseNumber = str(json.houseNumber) ?? meta.house_number;
    const street = str(json.street) ?? meta.street;
    return {
      reportCode: meta.report_code,
      reportStatus: meta.status,
      projectParcelCode: str(json.projectParcelCode) ?? meta.project_parcel_code,
      officialCadastralCode: str(json.officialCadastralCode),
      buildingName: str(json.buildingName),
      address: [houseNumber, street].filter(Boolean).join(' ') || null,
      ownerName: str(json.ownerName),
      ownerPhone: str(json.ownerPhone),
      objectGroup: str(json.objectGroup),
      chainage: str(json.chainage),
      metroOffsetDistance: str(json.metroOffsetDistance),
      clearanceOffsetDistance: str(json.clearanceOffsetDistance),
      gps: lat !== null && lng !== null ? { lat, lng } : null,
      adjacent: { left: side('left'), right: side('right'), back: side('back') },
      settlement: { level: num(diff.level), position: str(diff.position), notes: str(diff.notes) },
      tilt: {
        level: num(tilt.level),
        xPermille: num(tilt.xPermille),
        yPermille: num(tilt.yPermille),
        direction: str(tilt.direction),
        notes: str(tilt.notes),
      },
      abnormalNotes: str(abn.notes),
      surveyDate: surveyDateText || null,
      zoneId: meta.zone_id,
    };
  }

  /**
   * Trạng thái như bản in kế tiếp: dữ liệu sống + mọi phiên chụp lại đã duyệt.
   * Dùng chung cho màn KSV, lúc ghi và lúc nộp/duyệt để khoá ô luôn khớp với lớp phủ render.
   */
  static async loadCurrentState(reportId: string): Promise<CurrentState> {
    const meta = await this.loadMeta(reportId);
    const raw = (await applyCondoReportContext(
      (await ReportService.resolveReport(reportId)) as JsonObject
    )) as JsonObject;
    const config = await ReportConfigService.getActiveConfig();
    const vm = ReportViewModelMapper.buildViewModel(raw, undefined, config);
    await applyResurveyToViewModel(vm, await PhotoResurveyRepository.loadRenderState(reportId), { loadImages: false });

    const surveyDateText = vm.metadata?.surveyDateFormatted || formatWatermarkDateTime(meta.survey_date) || '';
    const [qcReport, qcRows] = await Promise.all([
      PhotoQcRepository.getReportRow(reportId),
      PhotoQcRepository.getPhotoRows([reportId]),
    ]);
    const studio = asObject(asObject(raw.survey_data_json).studioEnhancedPhotos) as Record<string, { originalUrl?: unknown }>;
    const flagByKey = new Map(qcRows.filter((r) => r.recapture).map((r) => [r.photoKey, r]));

    const refs = walkViewModelPhotos(vm);
    const slots: ResurveySlotView[] = [];
    const timeline: TimelineEntry[] = [];
    for (const ref of refs) {
      if (ref.section === 'COVER') continue;
      const slotCode = ref.section === 'P' ? slotCodeOf(ref.photoKey) : null;
      timeline.push({ slotCode, dateTimeText: ref.dateTimeText });
      if (!slotCode) continue;
      const flag = flagByKey.get(ref.photoKey);
      // Cờ gắn trên ảnh khác (ô đã đổi ảnh sau khi gắn cờ) không còn hiệu lực cho ảnh đang in.
      const flagValid = Boolean(flag && isSameSourcePhoto(flag.photoUrl, ref.url, studio));
      slots.push({
        photoKey: ref.photoKey,
        slotCode,
        label: ref.label,
        url: ref.url,
        rotation: ref.rotation,
        dateTimeText: ref.dateTimeText,
        flagged: Boolean(flagValid && flag && flag.status !== 'RESOLVED'),
        flagStatus: flagValid && flag ? flag.status : null,
      });
    }
    const levelIsNone = qcReport?.recaptureLevel === 'NONE';
    return {
      meta,
      identity: this.buildIdentity(meta, raw, surveyDateText),
      slots,
      timeline,
      surveyDateText,
      openKeys: levelIsNone ? [] : slots.filter((s) => s.flagged).map((s) => s.photoKey),
      levelIsNone,
    };
  }

  private static extraSlotCodes(state: CurrentState): ResurveySlotCode[] {
    const codes = new Set<ResurveySlotCode>();
    for (const s of state.slots) if (s.flagged && isMultiPhotoSlot(s.slotCode)) codes.add(s.slotCode);
    return [...codes];
  }

  private static previewExtraTimes(state: CurrentState, items: ResurveyItemRow[]): { times: ResurveyExtraTimePreview[]; error: string | null } {
    const extras = items
      .filter((i) => i.action === 'ADD_EXTRA')
      .sort((a, b) => (a.extraIndex ?? 0) - (b.extraIndex ?? 0))
      .map((i) => ({ itemId: i.id, slotCode: i.slotCode }));
    if (extras.length === 0) return { times: [], error: null };
    const res = computeExtraTimes(state.timeline, extras, state.surveyDateText);
    const times: ResurveyExtraTimePreview[] = [];
    for (const [itemId, t] of res.times) {
      times.push({ itemId, time2Text: t.text, time2At: t.at ? t.at.toISOString() : null, source: t.source });
    }
    return { times, error: res.error };
  }

  private static async buildView(user: JwtPayload, reportId: string, state?: CurrentState): Promise<ResurveySessionView> {
    const st = state ?? (await this.loadCurrentState(reportId));
    assertView(user, st.meta.zone_id);
    const open = await PhotoResurveyRepository.getOpenSession(reportId);
    const session = open ?? (await PhotoResurveyRepository.getLatestApprovedSession(reportId));
    const items = session ? await PhotoResurveyRepository.getActiveItems(session.id) : [];
    // Phiên đã duyệt: Time 2 đã chốt trong item; phiên mở: xem trước giờ ảnh phát sinh.
    const preview = session && session.status !== 'APPROVED' ? this.previewExtraTimes(st, items) : { times: [], error: null };

    // KSV sửa được: phiên nháp của chính mình, hoặc chưa có phiên nào và hồ sơ còn ảnh cần chụp.
    const canEdit =
      user.role === 'SURVEYOR' &&
      (open ? open.status === 'DRAFT' && open.surveyorId === user.userId : st.openKeys.length > 0);
    return {
      reportId,
      parcelId: st.meta.parcel_id,
      identity: st.identity,
      slots: st.slots,
      extraSlotCodes: this.extraSlotCodes(st),
      session,
      items,
      extraTimes: preview.times,
      extraTimeError: preview.error,
      appliesFromNextRevision: st.meta.status === 'APPROVED',
      canEdit,
      canReview: isAdmin(user) && open?.status === 'SUBMITTED',
      // Thẩm định đưa vào / bỏ qua từng mục của phiên đã duyệt.
      canApply: isAdmin(user) && canAccessZone(user, st.meta.zone_id) && session?.status === 'APPROVED',
    };
  }

  static async getView(user: JwtPayload, reportId: string): Promise<ResurveySessionView> {
    return this.buildView(user, reportId);
  }

  // ---------------------------------------------------------------------------
  // Danh sách thửa cần chụp lại (GIS + danh sách duyệt)
  // ---------------------------------------------------------------------------

  static async listTasks(user: JwtPayload, q: TaskQuery): Promise<ResurveyTask[]> {
    let scope: string[] | null;
    if (isAdmin(user)) {
      scope = await PhotoQcService.resolveZoneScope(user, q.zone);
    } else if (user.role === 'SURVEYOR') {
      const assigned = (user.assignedZoneId || '').trim().toUpperCase();
      if (!assigned) throw new ForbiddenError('Tài khoản KSV chưa được gán phân khu');
      scope = assigned === 'ALL' || assigned === 'ALL_ZONES' ? null : CadastralRepository.getZoneAliases(assigned);
      const zoneParam = (q.zone || '').trim().toUpperCase();
      if (zoneParam && zoneParam !== 'ALL' && zoneParam !== 'ALL_ZONES') {
        const wanted = CadastralRepository.getZoneAliases(zoneParam);
        scope = scope ? wanted.filter((z) => scope!.includes(z)) : wanted;
      }
    } else {
      throw new ForbiddenError('Tài khoản không có quyền khảo sát bổ sung');
    }
    if (scope && scope.length === 0) return [];

    const params: unknown[] = [];
    let scopeSql = '';
    if (scope) {
      params.push(scope);
      scopeSql = `AND UPPER(p.zone_id) = ANY($1::text[])`;
    }
    const res = await Database.query<{
      id: string; report_code: string; parcel_id: string; project_parcel_code: string | null;
      house_number: string | null; street: string | null; zone_id: string | null;
      lat: number | null; lng: number | null; open_outdoor: number;
      session_id: string | null; session_status: string | null; review_note: string | null;
      surveyor_name: string | null; submitted_at: Date | null;
    }>(
      `WITH geo AS (
         SELECT p.id, ST_PointOnSurface(COALESCE(p.cadastral_polygon_geom, p.footprint_polygon_geom, p.location_geom)) AS pt
         FROM parcels p
       )
       SELECT r.id, r.report_code, r.parcel_id, p.project_parcel_code, p.house_number, p.street, p.zone_id,
              ST_Y(g.pt) AS lat, ST_X(g.pt) AS lng,
              (SELECT COUNT(*)::int FROM photo_qc_photos qp
                WHERE qp.report_id = r.id AND qp.deleted_at IS NULL AND qp.recapture = TRUE
                  AND qp.status <> 'RESOLVED' AND qp.photo_group = 'OUTDOOR') AS open_outdoor,
              s.id AS session_id, s.status AS session_status, s.review_note, u.full_name AS surveyor_name, s.submitted_at
       FROM base_survey_reports r
       JOIN parcels p ON p.id = r.parcel_id
       LEFT JOIN geo g ON g.id = p.id
       LEFT JOIN photo_qc_reports qr ON qr.report_id = r.id AND qr.deleted_at IS NULL
       LEFT JOIN survey_photo_resurveys s ON s.report_id = r.id AND s.deleted_at IS NULL AND s.status IN ('DRAFT', 'SUBMITTED')
       LEFT JOIN users u ON u.id = s.surveyor_id
       WHERE r.deleted_at IS NULL AND r.phase = 'PHASE_1'
         AND r.report_type = 'STANDALONE' AND r.unit_id IS NULL
         AND COALESCE(qr.recapture_level, 'AUTO') <> 'NONE'
         ${scopeSql}
         AND (s.id IS NOT NULL OR EXISTS (
               SELECT 1 FROM photo_qc_photos qp
                WHERE qp.report_id = r.id AND qp.deleted_at IS NULL AND qp.recapture = TRUE
                  AND qp.status <> 'RESOLVED' AND qp.photo_group = 'OUTDOOR'))
       ORDER BY p.zone_id, r.report_code;`,
      params
    );
    const tasks: ResurveyTask[] = res.rows.map((r) => ({
      reportId: r.id,
      reportCode: r.report_code,
      parcelId: r.parcel_id,
      parcelCode: r.project_parcel_code,
      address: [r.house_number, r.street].filter(Boolean).join(' ') || null,
      zoneId: r.zone_id,
      lat: r.lat,
      lng: r.lng,
      state: r.session_status === 'SUBMITTED' ? 'SUBMITTED' : 'PENDING',
      openOutdoorCount: r.open_outdoor,
      sessionId: r.session_id,
      sessionStatus: r.session_status === 'SUBMITTED' || r.session_status === 'DRAFT' ? r.session_status : null,
      reviewNote: r.review_note,
      surveyorName: r.surveyor_name,
      submittedAt: r.submitted_at ? new Date(r.submitted_at).toISOString() : null,
    }));
    return q.state ? tasks.filter((t) => t.state === q.state) : tasks;
  }

  // ---------------------------------------------------------------------------
  // KSV: mở phiên, chụp, N/A, nộp
  // ---------------------------------------------------------------------------

  private static assertSurveyorOwner(user: JwtPayload, session: ResurveySessionRow): void {
    if (user.role !== 'SURVEYOR') throw new ForbiddenError('Chỉ Khảo sát viên được chụp ảnh bổ sung');
    if (session.surveyorId !== user.userId) throw new ForbiddenError('Phiên khảo sát bổ sung này do KSV khác phụ trách');
    if (session.status !== 'DRAFT') {
      throw new ConflictError(session.status === 'SUBMITTED' ? 'Phiên đã nộp, đang chờ Admin duyệt' : 'Phiên đã được duyệt, không sửa được');
    }
  }

  static async startSession(user: JwtPayload, reportId: string, clientIp?: string): Promise<ResurveySessionView> {
    const userId = requireUserId(user);
    if (user.role !== 'SURVEYOR') throw new ForbiddenError('Chỉ Khảo sát viên được mở phiên khảo sát bổ sung');
    const state = await this.loadCurrentState(reportId);
    assertView(user, state.meta.zone_id);
    const existing = await PhotoResurveyRepository.getOpenSession(reportId);
    if (existing) return this.buildView(user, reportId, state);
    if (state.openKeys.length === 0) {
      throw new BadRequestError('Hồ sơ không còn ảnh ngoài nhà nào cần chụp lại');
    }
    try {
      await Database.transaction(async (client) => {
        const session = await PhotoResurveyRepository.createSession(client, {
          reportId,
          parcelId: state.meta.parcel_id,
          zoneId: state.meta.zone_id,
          surveyorId: userId,
        });
        const assigned = await PhotoResurveyRepository.setQcFlagStatus(client, reportId, state.openKeys, 'ASSIGNED', userId, ['OPEN']);
        await PhotoResurveyRepository.writeAuditLog(client, session.id, userId, 'PHOTO_RESURVEY_START', {
          reportId,
          openKeys: state.openKeys,
          qcAssigned: assigned,
          clientIp: clientIp ?? null,
        });
      });
    } catch (err: unknown) {
      // Hai KSV mở cùng lúc: chỉ một phiên mở được tạo (unique index), người sau xem phiên đó.
      if ((err as { code?: string })?.code !== '23505') throw err;
      console.error('[PhotoResurveyService:startSession] Phiên đã được KSV khác mở cùng lúc', err);
    }
    return this.buildView(user, reportId, state);
  }

  static async uploadPhoto(user: JwtPayload, sessionId: string, body: UploadResurveyPhotoInput, clientIp?: string): Promise<ResurveySessionView> {
    const userId = requireUserId(user);
    const session = await PhotoResurveyRepository.getSession(sessionId);
    if (!session) throw new NotFoundError('Không tìm thấy phiên khảo sát bổ sung');
    this.assertSurveyorOwner(user, session);
    const state = await this.loadCurrentState(session.reportId);
    assertView(user, state.meta.zone_id);

    let slotCode: ResurveySlotCode;
    let target: ResurveySlotView | null = null;
    if (body.action === 'REPLACE') {
      target = state.slots.find((s) => s.photoKey === body.photoKey) ?? null;
      if (!target) throw new ConflictError(`Ô ảnh ${body.photoKey} không còn trong hồ sơ, vui lòng tải lại`);
      if (!target.flagged) throw new BadRequestError(`Ảnh ${target.label} không nằm trong danh sách cần chụp lại`);
      slotCode = target.slotCode;
    } else {
      const wanted = slotCodeOf(body.slotCode);
      if (!wanted || !this.extraSlotCodes(state).includes(wanted)) {
        throw new BadRequestError(`Mục ${body.slotCode} không được chụp thêm (chỉ mục nhiều ảnh có ảnh cần chụp lại)`);
      }
      slotCode = wanted;
    }

    const buffer = decodeJpeg(body.base64);
    try {
      const metaImg = await sharp(buffer).metadata();
      if (!metaImg.width || !metaImg.height) throw new BadRequestError('Không đọc được kích thước ảnh');
      if (Math.max(metaImg.width, metaImg.height) > MAX_PHOTO_DIMENSION) {
        throw new BadRequestError(`Ảnh quá lớn (${metaImg.width}×${metaImg.height}), cạnh dài tối đa ${MAX_PHOTO_DIMENSION}px`);
      }
    } catch (err: unknown) {
      if (err instanceof BadRequestError) throw err;
      console.error('[PhotoResurveyService:uploadPhoto] Ảnh không giải mã được', err);
      throw new BadRequestError('Ảnh bị hỏng hoặc không đúng định dạng JPEG');
    }

    const capturedAtClient = body.capturedAtClient ? new Date(body.capturedAtClient) : null;
    const stampAt = capturedAtClient ?? new Date();
    let distance: number | null = null;
    if (body.lat !== undefined && body.lng !== undefined) {
      try {
        distance = await PhotoResurveyRepository.distanceToParcel(state.meta.parcel_id, body.lat, body.lng);
      } catch (err: unknown) {
        console.error('[PhotoResurveyService:uploadPhoto] Không tính được khoảng cách tới thửa', err);
      }
    }

    const parcelCode = state.identity.projectParcelCode || state.meta.project_parcel_code || 'PARCEL';
    const suffix = body.action === 'REPLACE' ? (body.photoKey.split('#')[1] ? `N${body.photoKey.split('#')[1]}` : '') : 'EXTRA';
    const fileName = buildResurveyFileName(parcelCode, slotCode, suffix, stampAt);
    const folder = ['resurvey', state.meta.zone_id || 'NO_ZONE', parcelCode, session.reportId, session.id]
      .map((s) => String(s).replace(/[^A-Za-z0-9_.-]/g, '_'))
      .join('/');
    // R2 không nằm trong transaction: tải trước, ghi DB sau. DB lỗi thì file mồ côi nằm ở nhánh resurvey/ (không ảnh hưởng ảnh gốc).
    const uploaded = await StorageService.uploadBuffer(buffer, fileName, 'image/jpeg', folder, {
      'resurvey-session': session.id,
      'report-id': session.reportId,
      action: body.action,
      'photo-key': body.action === 'REPLACE' ? body.photoKey : `${slotCode}+EXTRA`,
      'captured-at-client': capturedAtClient ? capturedAtClient.toISOString() : '',
      'uploaded-by': userId,
    });

    try {
      await Database.transaction(async (client) => {
        const locked = await PhotoResurveyRepository.lockSession(client, session.id);
        if (!locked || locked.status !== 'DRAFT') throw new ConflictError('Phiên đã nộp hoặc đã duyệt, không thêm ảnh được');
        let replaced: ResurveyItemRow[] = [];
        let extraIndex: number | null = null;
        if (body.action === 'REPLACE' && target) {
          replaced = await PhotoResurveyRepository.softDeleteTarget(client, session.id, target.photoKey);
        } else {
          extraIndex = await PhotoResurveyRepository.nextExtraIndex(client, session.id, slotCode);
        }
        const parsed = target ? parseWatermarkText(target.dateTimeText) : { at: null, hasTime: false };
        const item = await PhotoResurveyRepository.insertItem(client, {
          resurveyId: session.id,
          action: body.action,
          slotCode,
          photoKey: target ? target.photoKey : null,
          originalUrl: target ? target.url : null,
          extraIndex,
          newUrl: uploaded.url,
          newR2Key: uploaded.key,
          newSha256: uploaded.checksumSha256,
          newSizeBytes: uploaded.sizeBytes,
          rotation: body.rotation ?? 0,
          naReason: null,
          time2Text: target ? target.dateTimeText : null,
          time2At: target && parsed.hasTime ? parsed.at : null,
          time2Source: target ? 'ORIGINAL' : null,
          capturedAtClient,
          captureLat: body.lat ?? null,
          captureLng: body.lng ?? null,
          captureAccuracyM: body.accuracyM ?? null,
          distanceToParcelM: distance,
          createdBy: userId,
        });
        await PhotoResurveyRepository.writeAuditLog(client, session.id, userId, 'PHOTO_RESURVEY_PHOTO', {
          reportId: session.reportId,
          item,
          supersededItemIds: replaced.map((r) => r.id),
          r2Key: uploaded.key,
          sha256: uploaded.checksumSha256,
          clientIp: clientIp ?? null,
        });
      });
    } catch (err: unknown) {
      console.error(`[PhotoResurveyService:uploadPhoto] Ghi DB thất bại, ảnh đã tải nằm ở ${uploaded.key}`, err);
      throw err;
    }
    return this.buildView(user, session.reportId);
  }

  static async markNa(user: JwtPayload, sessionId: string, body: MarkNaInput, clientIp?: string): Promise<ResurveySessionView> {
    const userId = requireUserId(user);
    const session = await PhotoResurveyRepository.getSession(sessionId);
    if (!session) throw new NotFoundError('Không tìm thấy phiên khảo sát bổ sung');
    this.assertSurveyorOwner(user, session);
    const state = await this.loadCurrentState(session.reportId);
    assertView(user, state.meta.zone_id);
    const target = state.slots.find((s) => s.photoKey === body.photoKey);
    if (!target) throw new ConflictError(`Ô ảnh ${body.photoKey} không còn trong hồ sơ, vui lòng tải lại`);
    if (!target.flagged) throw new BadRequestError(`Ảnh ${target.label} không nằm trong danh sách cần chụp lại`);
    if (NA_FORBIDDEN_SLOTS.includes(target.slotCode)) {
      throw new BadRequestError('P-02 là mặt đứng chính và ảnh bìa báo cáo, không được đánh dấu N/A');
    }

    await Database.transaction(async (client) => {
      const locked = await PhotoResurveyRepository.lockSession(client, session.id);
      if (!locked || locked.status !== 'DRAFT') throw new ConflictError('Phiên đã nộp hoặc đã duyệt, không sửa được');
      const replaced = await PhotoResurveyRepository.softDeleteTarget(client, session.id, target.photoKey);
      const item = await PhotoResurveyRepository.insertItem(client, {
        resurveyId: session.id,
        action: 'MARK_NA',
        slotCode: target.slotCode,
        photoKey: target.photoKey,
        originalUrl: target.url,
        extraIndex: null,
        newUrl: null,
        newR2Key: null,
        newSha256: null,
        newSizeBytes: null,
        rotation: 0,
        naReason: body.reason,
        time2Text: null,
        time2At: null,
        time2Source: null,
        capturedAtClient: null,
        captureLat: null,
        captureLng: null,
        captureAccuracyM: null,
        distanceToParcelM: null,
        createdBy: userId,
      });
      await PhotoResurveyRepository.writeAuditLog(client, session.id, userId, 'PHOTO_RESURVEY_MARK_NA', {
        reportId: session.reportId,
        item,
        supersededItemIds: replaced.map((r) => r.id),
        clientIp: clientIp ?? null,
      });
    });
    return this.buildView(user, session.reportId);
  }

  static async removeItem(user: JwtPayload, sessionId: string, itemId: string, clientIp?: string): Promise<ResurveySessionView> {
    const userId = requireUserId(user);
    const session = await PhotoResurveyRepository.getSession(sessionId);
    if (!session) throw new NotFoundError('Không tìm thấy phiên khảo sát bổ sung');
    this.assertSurveyorOwner(user, session);
    await Database.transaction(async (client) => {
      const locked = await PhotoResurveyRepository.lockSession(client, session.id);
      if (!locked || locked.status !== 'DRAFT') throw new ConflictError('Phiên đã nộp hoặc đã duyệt, không sửa được');
      const removed = await PhotoResurveyRepository.softDeleteItem(client, session.id, itemId);
      if (!removed) throw new NotFoundError('Không tìm thấy thao tác cần bỏ');
      await PhotoResurveyRepository.writeAuditLog(client, session.id, userId, 'PHOTO_RESURVEY_REMOVE', {
        reportId: session.reportId,
        item: removed,
        clientIp: clientIp ?? null,
      });
    });
    return this.buildView(user, session.reportId);
  }

  static async rotateItem(user: JwtPayload, sessionId: string, itemId: string, rotation: number, clientIp?: string): Promise<ResurveySessionView> {
    const userId = requireUserId(user);
    const session = await PhotoResurveyRepository.getSession(sessionId);
    if (!session) throw new NotFoundError('Không tìm thấy phiên khảo sát bổ sung');
    this.assertSurveyorOwner(user, session);
    const deg = ((Math.round(rotation) % 360) + 360) % 360;
    await Database.transaction(async (client) => {
      const locked = await PhotoResurveyRepository.lockSession(client, session.id);
      if (!locked || locked.status !== 'DRAFT') throw new ConflictError('Phiên đã nộp hoặc đã duyệt, không sửa được');
      const before = await PhotoResurveyRepository.getItem(session.id, itemId, client);
      if (!before || before.action === 'MARK_NA') throw new NotFoundError('Không tìm thấy ảnh cần xoay');
      const after = await PhotoResurveyRepository.updateRotation(client, itemId, deg);
      await PhotoResurveyRepository.writeAuditLog(client, session.id, userId, 'PHOTO_RESURVEY_ROTATE', {
        reportId: session.reportId,
        itemId,
        before: before.rotation,
        after: after?.rotation ?? deg,
        clientIp: clientIp ?? null,
      });
    });
    return this.buildView(user, session.reportId);
  }

  /** Kiểm tra phiên trước khi nộp/duyệt: đủ ô cần chụp, ảnh gốc chưa đổi, xếp được giờ ảnh phát sinh. */
  private static validateSession(state: CurrentState, items: ResurveyItemRow[]): void {
    if (items.length === 0) throw new BadRequestError('Phiên chưa có ảnh hay thao tác nào');
    const slotByKey = new Map(state.slots.map((s) => [s.photoKey, s]));
    for (const it of items) {
      if (it.action === 'ADD_EXTRA') continue;
      const slot = it.photoKey ? slotByKey.get(it.photoKey) : undefined;
      if (!slot || slot.url !== it.originalUrl) {
        throw new ConflictError(`Ảnh gốc của ô ${it.photoKey} đã thay đổi sau khi chụp lại. KSV cần làm lại ô này.`);
      }
    }
    const handled = new Set(items.filter((i) => i.photoKey).map((i) => i.photoKey as string));
    const missing = state.openKeys.filter((k) => !handled.has(k));
    if (missing.length > 0) {
      const labels = missing.map((k) => slotByKey.get(k)?.label || k);
      throw new BadRequestError(`Còn ${missing.length} ảnh chưa chụp lại hoặc đánh dấu N/A: ${labels.join('; ')}`);
    }
  }

  static async submit(user: JwtPayload, sessionId: string, clientIp?: string): Promise<ResurveySessionView> {
    const userId = requireUserId(user);
    const session = await PhotoResurveyRepository.getSession(sessionId);
    if (!session) throw new NotFoundError('Không tìm thấy phiên khảo sát bổ sung');
    this.assertSurveyorOwner(user, session);
    const state = await this.loadCurrentState(session.reportId);
    assertView(user, state.meta.zone_id);
    const items = await PhotoResurveyRepository.getActiveItems(session.id);
    this.validateSession(state, items);
    const preview = this.previewExtraTimes(state, items);
    if (preview.error) throw new BadRequestError(preview.error);
    const slotByKey = new Map(state.slots.map((s) => [s.photoKey, s]));

    await Database.transaction(async (client) => {
      const locked = await PhotoResurveyRepository.lockSession(client, session.id);
      if (!locked || locked.status !== 'DRAFT') throw new ConflictError('Phiên đã nộp hoặc đã duyệt');
      // Chốt lại Time 2 ngay lúc nộp: ảnh thay thế = chữ đang in của ảnh gốc, ảnh phát sinh = giờ chèn.
      for (const it of items) {
        if (it.action === 'REPLACE' && it.photoKey) {
          const text = slotByKey.get(it.photoKey)?.dateTimeText || state.surveyDateText;
          const parsed = parseWatermarkText(text);
          await PhotoResurveyRepository.updateTime2(client, it.id, { text, at: parsed.hasTime ? parsed.at : null, source: 'ORIGINAL' });
        }
      }
      for (const t of preview.times) {
        await PhotoResurveyRepository.updateTime2(client, t.itemId, {
          text: t.time2Text,
          at: t.time2At ? new Date(t.time2At) : null,
          source: t.source,
        });
      }
      const finalItems = await PhotoResurveyRepository.getActiveItems(session.id, client);
      const sha256 = stableSha256({ sessionId: session.id, reportId: session.reportId, items: canonicalItems(finalItems) });
      await PhotoResurveyRepository.markSubmitted(client, session.id, sha256);
      await PhotoResurveyRepository.writeAuditLog(client, session.id, userId, 'PHOTO_RESURVEY_SUBMIT', {
        reportId: session.reportId,
        sha256,
        items: canonicalItems(finalItems),
        clientIp: clientIp ?? null,
      });
    });
    return this.buildView(user, session.reportId);
  }

  // ---------------------------------------------------------------------------
  // Admin: duyệt / từ chối
  // ---------------------------------------------------------------------------

  private static assertReviewer(user: JwtPayload, zoneId: string | null): void {
    if (!isAdmin(user)) throw new ForbiddenError('Chỉ Zone Admin hoặc Super Admin được duyệt khảo sát bổ sung');
    if (!canAccessZone(user, zoneId)) throw new ForbiddenError('Hồ sơ không thuộc phân khu bạn phụ trách');
  }

  /** Hồ sơ đã phát hành: đóng băng kết quả vào snapshot chờ phát hành (r00 giữ nguyên). */
  private static async freezeForNextRelease(client: PoolClient, reportId: string, userId: string): Promise<void> {
    const rep = await client.query<{ status: string; approved_at: Date | null; export_revision: number }>(
      `SELECT status::text AS status, approved_at, export_revision FROM base_survey_reports WHERE id = $1 FOR UPDATE;`,
      [reportId]
    );
    const row = rep.rows[0];
    if (!row || row.status !== 'APPROVED') return;
    await ReportSnapshotService.writeApprovedRelease(
      client,
      reportId,
      userId,
      row.approved_at ?? new Date(),
      'Khảo sát bổ sung ảnh ngoài nhà (chờ phát hành Rev mới)',
      row.export_revision ?? 0
    );
  }

  static async approve(user: JwtPayload, sessionId: string, body: ApproveInput, clientIp?: string): Promise<ResurveySessionView> {
    const userId = requireUserId(user);
    const session = await PhotoResurveyRepository.getSession(sessionId);
    if (!session) throw new NotFoundError('Không tìm thấy phiên khảo sát bổ sung');
    const state = await this.loadCurrentState(session.reportId);
    this.assertReviewer(user, state.meta.zone_id);
    if (session.status !== 'SUBMITTED') throw new ConflictError('Chỉ duyệt được phiên đang chờ duyệt');
    const items = await PhotoResurveyRepository.getActiveItems(session.id);
    this.validateSession(state, items);

    const overrides = body.time2Overrides ?? {};
    const itemById = new Map(items.map((i) => [i.id, i]));
    const overrideTimes: Array<{ itemId: string; at: Date }> = [];
    for (const [itemId, isoAt] of Object.entries(overrides)) {
      const it = itemById.get(itemId);
      if (!it || it.action !== 'ADD_EXTRA') throw new BadRequestError('Chỉ chỉnh được giờ của ảnh phát sinh');
      const at = new Date(isoAt);
      const bounds = extraTimeBounds(state.timeline, it.slotCode);
      if (!bounds.prev) throw new BadRequestError(`Mục ${it.slotCode} không có mốc giờ để chỉnh, ảnh in theo ngày khảo sát`);
      if (at.getTime() <= bounds.prev.getTime() || (bounds.next && at.getTime() >= bounds.next.getTime())) {
        const range = `${formatTime2(bounds.prev)} → ${bounds.next ? formatTime2(bounds.next) : 'không giới hạn'}`;
        throw new BadRequestError(`Giờ của ảnh phát sinh mục ${it.slotCode} phải nằm trong khoảng ${range}`);
      }
      overrideTimes.push({ itemId, at });
    }

    const resolvedKeys = items.filter((i) => i.photoKey).map((i) => i.photoKey as string);
    await Database.transaction(async (client) => {
      const locked = await PhotoResurveyRepository.lockSession(client, session.id);
      if (!locked || locked.status !== 'SUBMITTED') throw new ConflictError('Phiên không còn ở trạng thái chờ duyệt');
      for (const o of overrideTimes) {
        await PhotoResurveyRepository.updateTime2(client, o.itemId, { text: formatTime2(o.at), at: o.at, source: 'ADMIN' });
      }
      const finalItems = await PhotoResurveyRepository.getActiveItems(session.id, client);
      const sha256 = stableSha256({ sessionId: session.id, reportId: session.reportId, items: canonicalItems(finalItems) });
      await PhotoResurveyRepository.markApproved(client, session.id, userId, body.note || null, sha256);
      const resolved = await PhotoResurveyRepository.setQcFlagStatus(client, session.reportId, resolvedKeys, 'RESOLVED', userId);
      await PhotoResurveyRepository.writeAuditLog(client, session.id, userId, 'PHOTO_RESURVEY_APPROVE', {
        reportId: session.reportId,
        sha256,
        submittedSha256: locked.submittedSha256,
        time2Overrides: overrideTimes.map((o) => ({ itemId: o.itemId, at: o.at.toISOString() })),
        qcResolved: resolved,
        note: body.note ?? null,
        clientIp: clientIp ?? null,
      });
      await this.freezeForNextRelease(client, session.reportId, userId);
    });
    return this.buildView(user, session.reportId);
  }

  /**
   * Thẩm định quyết định từng mục của phiên ĐÃ DUYỆT: APPLIED = đưa vào report (thay ảnh cũ / thêm ảnh / bỏ ô N/A),
   * DECLINED = giữ ảnh cũ, PENDING = hoàn tác về chờ quyết định. Hồ sơ đã phát hành áp từ Rev kế tiếp.
   */
  static async decideApply(user: JwtPayload, sessionId: string, body: ApplyDecisionInput, clientIp?: string): Promise<ResurveySessionView> {
    const userId = requireUserId(user);
    const session = await PhotoResurveyRepository.getSession(sessionId);
    if (!session) throw new NotFoundError('Không tìm thấy phiên khảo sát bổ sung');
    const meta = await this.loadMeta(session.reportId);
    this.assertReviewer(user, meta.zone_id);
    if (session.status !== 'APPROVED') throw new ConflictError('Chỉ đưa vào report được ảnh của phiên đã duyệt');
    const before = await PhotoResurveyRepository.getActiveItems(session.id);
    const beforeById = new Map(before.map((i) => [i.id, i]));
    const missing = body.itemIds.filter((id) => !beforeById.has(id));
    if (missing.length > 0) throw new ConflictError('Có mục ảnh không còn trong phiên, vui lòng tải lại');

    await Database.transaction(async (client) => {
      const locked = await PhotoResurveyRepository.lockSession(client, session.id);
      if (!locked || locked.status !== 'APPROVED') throw new ConflictError('Phiên không còn ở trạng thái đã duyệt');
      const changed = await PhotoResurveyRepository.setApplyStatus(client, session.id, body.itemIds, body.decision, userId);
      if (changed.length !== body.itemIds.length) throw new ConflictError('Có mục ảnh vừa thay đổi, vui lòng tải lại');
      const after = await PhotoResurveyRepository.getActiveItems(session.id, client);
      await PhotoResurveyRepository.writeAuditLog(client, session.id, userId, 'PHOTO_RESURVEY_APPLY', {
        reportId: session.reportId,
        decision: body.decision,
        items: changed.map((i) => ({
          itemId: i.id,
          action: i.action,
          slotCode: i.slotCode,
          photoKey: i.photoKey,
          before: beforeById.get(i.id)?.applyStatus ?? null,
          after: i.applyStatus,
        })),
        sha256: stableSha256({ sessionId: session.id, items: after.map((i) => ({ id: i.id, applyStatus: i.applyStatus })) }),
        clientIp: clientIp ?? null,
      });
      await this.freezeForNextRelease(client, session.reportId, userId);
    });
    return this.buildView(user, session.reportId);
  }

  static async reject(user: JwtPayload, sessionId: string, body: RejectInput, clientIp?: string): Promise<ResurveySessionView> {
    const userId = requireUserId(user);
    const session = await PhotoResurveyRepository.getSession(sessionId);
    if (!session) throw new NotFoundError('Không tìm thấy phiên khảo sát bổ sung');
    const meta = await this.loadMeta(session.reportId);
    this.assertReviewer(user, meta.zone_id);
    if (session.status !== 'SUBMITTED') throw new ConflictError('Chỉ từ chối được phiên đang chờ duyệt');
    await Database.transaction(async (client) => {
      const locked = await PhotoResurveyRepository.lockSession(client, session.id);
      if (!locked || locked.status !== 'SUBMITTED') throw new ConflictError('Phiên không còn ở trạng thái chờ duyệt');
      await PhotoResurveyRepository.markRejected(client, session.id, userId, body.note);
      await PhotoResurveyRepository.writeAuditLog(client, session.id, userId, 'PHOTO_RESURVEY_REJECT', {
        reportId: session.reportId,
        note: body.note,
        submittedSha256: locked.submittedSha256,
        clientIp: clientIp ?? null,
      });
    });
    return this.buildView(user, session.reportId);
  }
}
