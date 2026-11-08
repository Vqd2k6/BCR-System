/**
 * ============================================================================
 * PHOTO QC – SERVICE
 * - Ô ảnh luôn lấy qua đúng mapper report (Phụ lục 1 / ViewModel) để màn rà soát thấy đúng ảnh PDF in.
 * - Ghi QC trong một transaction, kèm nhật ký hệ thống.
 * - Hồ sơ APPROVED: mỗi thay đổi ảnh hưởng bản in (bìa, crop, dập bù) ghi thêm một snapshot
 *   APPROVED_RELEASE mới trong cùng transaction → bản đã phát hành giữ nguyên, hệ thống báo
 *   "chờ phát hành", lần phát hành kế tiếp (r01…) mang QC mới.
 * ============================================================================
 */

import ExcelJS from 'exceljs';
import { Database } from '../../database/db';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from '../../common/errors/problem-details';
import type { JwtPayload } from '../../common/guards/auth.guard';
import { CadastralRepository } from '../cadastral/cadastral.repository';
import { resolveStationCode } from '../progress-report/rules/alignment-side';
import { Appendix1PhotoMapper } from '../report/mappers/appendices/appendix-1-photos.mapper';
import { ReportViewModelMapper } from '../report/mappers/report-viewmodel.mapper';
import { ReportConfigService } from '../report_config/report-config.service';
import { LegacyWatermarkIndex } from '../report/services/legacy-watermark-index.service';
import { ReportService } from '../report/services/report.service';
import { applyCondoReportContext } from '../report/snapshot/condo-absent-projection';
import { ReportSnapshotService } from '../report/snapshot/report-snapshot.service';
import { buildPreloadRotationItems, extractAllImageUrls } from '../report/utils/report-preload.utils';
import { canAccessZone } from '../report/utils/zone-access.utils';
import { fetchPhotoSourceRows, PhotoQcRepository, type PhotoQcSourceRow } from './photo-qc.repository';
import {
  assignSlotKeys,
  isCoverEligibleKind,
  isCropApplicable,
  isSameSourcePhoto,
  normalizeDeg,
  photoGroupFor,
  resolveReportKind,
  effectiveLevel,
  suggestRecaptureLevel,
  urlPhotoKey,
} from './photo-qc.rules';
import type {
  PhotoQcListQuery,
  PhotoQcRecaptureQuery,
  UpdatePhotoQcPhotosInput,
  UpdatePhotoQcReportInput,
} from './photo-qc.schemas';
import type {
  PhotoQcDetail,
  PhotoQcListItem,
  PhotoQcListResult,
  PhotoQcPhotoRow,
  PhotoQcRecaptureLevel,
  PhotoQcRecaptureRow,
  PhotoQcReportKind,
  PhotoQcReportRow,
  PhotoQcSection,
  PhotoQcSlot,
  PhotoQcSlotView,
  PhotoQcEffectiveLevel,
} from './photo-qc.types';
import { walkViewModelPhotos } from './photo-qc.vm-walker';
import { describeJsonPhotos, isExcludedPhotoPath, sectionFromPoolCategory } from './photo-qc.unprinted';
import { listReportPhotoPool } from '../audit/services/report-photo-pool';

type StudioMap = Record<string, { originalUrl?: unknown }>;
type JsonObject = Record<string, unknown>;

function asObject(v: unknown): JsonObject {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as JsonObject) : {};
}

function studioMapOf(json: JsonObject): StudioMap | null {
  const raw = json.studioEnhancedPhotos;
  return raw && typeof raw === 'object' ? (raw as StudioMap) : null;
}

/** Góc thật sự in ra: bộ nạp chỉ xoay sẵn các cặp (URL, góc) có trong danh sách preload, còn lại in ảnh gốc. */
function printedRotationResolver(report: JsonObject): (url: string, rot: number) => number {
  const json = asObject(report.survey_data_json);
  const rotMap = (asObject(json.photoRotations) as Record<string, number>) ?? {};
  const urls = extractAllImageUrls(report);
  const items = buildPreloadRotationItems(report, urls, rotMap);
  const pairs = new Set<string>();
  for (const item of items) {
    const url = typeof item === 'string' ? item.trim() : item.url.trim();
    const deg = normalizeDeg(typeof item === 'string' ? rotMap[url] : item.rotation ?? rotMap[url]);
    if (deg) pairs.add(`${deg}::${url}`);
  }
  return (url, rot) => {
    const deg = normalizeDeg(rot);
    return deg && pairs.has(`${deg}::${url.trim()}`) ? deg : 0;
  };
}

function encodeCursor(reportCode: string): string {
  return Buffer.from(reportCode, 'utf8').toString('base64url');
}

function decodeCursor(cursor?: string): string | null {
  if (!cursor) return null;
  try {
    return Buffer.from(cursor, 'base64url').toString('utf8');
  } catch (err) {
    console.error('[PhotoQcService:decodeCursor] Cursor không hợp lệ', err);
    throw new BadRequestError('Cursor phân trang không hợp lệ');
  }
}

const PREVIEW_LIMIT = 8;
const PREVIEW_CONCURRENCY = 4;

interface ZoneRow {
  zone_code: string;
  zone_name: string | null;
}

export class PhotoQcService {
  // ---------------------------------------------------------------------------
  // Phạm vi Zone / Ga
  // ---------------------------------------------------------------------------

  /** null = toàn tuyến. Zone Admin chỉ thấy Zone được gán (kể cả alias). */
  static async resolveZoneScope(user: JwtPayload, zone?: string, station?: string): Promise<string[] | null> {
    let scope: string[] | null = null;
    if (user.role === 'ZONE_ADMIN') {
      const assigned = (user.assignedZoneId || '').trim().toUpperCase();
      if (!assigned) throw new ForbiddenError('Tài khoản Zone Admin chưa được gán phân khu');
      if (assigned !== 'ALL' && assigned !== 'ALL_ZONES') scope = CadastralRepository.getZoneAliases(assigned);
    } else if (user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError('Chỉ Zone Admin hoặc Super Admin được rà soát ảnh');
    }

    const zoneParam = (zone || '').trim().toUpperCase();
    if (zoneParam && zoneParam !== 'ALL' && zoneParam !== 'ALL_ZONES') {
      const wanted = CadastralRepository.getZoneAliases(zoneParam);
      if (scope && !wanted.some((z) => scope!.includes(z))) {
        throw new ForbiddenError(`Không có quyền xem phân khu ${zoneParam}`);
      }
      scope = scope ? wanted.filter((z) => scope!.includes(z)) : wanted;
    }

    const stationParam = (station || '').trim().toUpperCase();
    if (stationParam) {
      const zonesRes = await Database.query<ZoneRow>(`SELECT zone_code, zone_name FROM metro_zones;`, []);
      const stationZones = zonesRes.rows
        .filter((z) => resolveStationCode(z.zone_code, z.zone_name).toUpperCase() === stationParam)
        .map((z) => z.zone_code.toUpperCase());
      scope = scope ? scope.filter((z) => stationZones.includes(z)) : stationZones;
    }
    return scope;
  }

  private static assertReportAccess(user: JwtPayload, zoneId: string | null): void {
    if (!canAccessZone(user, zoneId)) {
      throw new ForbiddenError('Hồ sơ không thuộc phân khu bạn phụ trách');
    }
  }

  // ---------------------------------------------------------------------------
  // Ô ảnh
  // ---------------------------------------------------------------------------

  /** Ảnh Phụ lục 1 (P) của một dòng nguồn – chạy đúng mapper report, không đọc file ảnh. */
  static buildPSlots(row: PhotoQcSourceRow, kind: PhotoQcReportKind): PhotoQcSlot[] {
    const json = asObject(row.json_subset);
    const rawReport: JsonObject = {
      id: row.id,
      survey_data_json: json,
      deformation: row.deformation,
      project_parcel_code: row.project_parcel_code,
      unit_code: row.unit_code,
    };
    const deform = { ...asObject(row.deformation), ...asObject(json.settlementTilt) };
    const { appendix1 } = Appendix1PhotoMapper.map(rawReport, json, row.ident_photos ?? [], deform, '', 0, 0, '', null, { skipBase64: true });
    const keys = assignSlotKeys(appendix1.map((p) => p.photoCode));
    const printed = printedRotationResolver(rawReport);
    return appendix1.flatMap((item, idx) => {
      if (!item.url) return [];
      return [{
        photoKey: keys[idx],
        url: item.url,
        rotation: printed(item.url, Number(item.rotation) || 0),
        label: `${item.photoCode} • ${item.name?.vi || ''}`.trim(),
        section: 'P' as const,
        photoGroup: photoGroupFor(kind, keys[idx], 'P'),
        legacyWatermarked: LegacyWatermarkIndex.has(item.url),
        printed: true,
      }];
    });
  }

  /** Toàn bộ ảnh report in (P + khuyết tật + phòng) qua ViewModel thật – dùng cho màn chi tiết và kiểm tra khi ghi. */
  static async buildAllSlots(reportId: string): Promise<{
    slots: PhotoQcSlot[];
    kind: PhotoQcReportKind;
    raw: JsonObject;
    zoneId: string | null;
    stationCode: string;
    status: string;
    reportCode: string;
    studio: StudioMap | null;
  }> {
    const meta = await Database.query<{
      report_type: string; unit_type: string | null; zone_id: string | null; zone_name: string | null;
      status: string; report_code: string; deleted_at: Date | null; phase: string;
    }>(
      `SELECT r.report_type, bu.unit_type, p.zone_id, mz.zone_name, r.status::text AS status, r.report_code, r.deleted_at, r.phase::text AS phase
       FROM base_survey_reports r
       JOIN parcels p ON p.id = r.parcel_id
       LEFT JOIN metro_zones mz ON mz.zone_code = p.zone_id
       LEFT JOIN building_units bu ON bu.id = r.unit_id
       WHERE r.id = $1;`,
      [reportId]
    );
    const m = meta.rows[0];
    if (!m || m.deleted_at) throw new NotFoundError(`Không tìm thấy hồ sơ ${reportId}`);
    const kind = resolveReportKind(m.report_type, m.unit_type);

    // Luôn dùng dữ liệu sống: QC áp vào bản in kế tiếp (bản nháp hoặc revision mới).
    const raw = (await applyCondoReportContext(await ReportService.resolveReport(reportId))) as JsonObject;
    const allUrls = extractAllImageUrls(raw);
    await LegacyWatermarkIndex.load(allUrls);
    const config = await ReportConfigService.getActiveConfig();
    const vm = ReportViewModelMapper.buildViewModel(raw, undefined, config);
    const printed = printedRotationResolver(raw);

    const seen = new Set<string>();
    const slots: PhotoQcSlot[] = [];
    for (const ref of walkViewModelPhotos(vm)) {
      if (ref.section === 'COVER' || seen.has(ref.url)) continue;
      seen.add(ref.url);
      const section: PhotoQcSection = ref.section === 'P' ? 'P' : ref.section === 'OVERVIEW' ? 'OVERVIEW' : 'DEFECT';
      slots.push({
        photoKey: ref.photoKey,
        url: ref.url,
        rotation: printed(ref.url, ref.rotation),
        label: ref.label,
        section,
        photoGroup: photoGroupFor(kind, ref.photoKey, section),
        legacyWatermarked: LegacyWatermarkIndex.has(ref.url),
        printed: true,
      });
    }

    // Ảnh report hiện chưa in vẫn phải rà được (crop khoá theo URL, tự áp khi report in ảnh đó).
    const surveyJson = asObject(raw.survey_data_json);
    const described = describeJsonPhotos(surveyJson);
    const rotMap = asObject(surveyJson.photoRotations) as Record<string, number>;
    const isAbsent = raw.condoUnitAbsent === true || raw.residentialAbsent === true;
    const candidates: Array<{ url: string; label: string; section: PhotoQcSection }> = [];
    for (const [url, info] of described) candidates.push({ url, ...info });
    if (!isAbsent) {
      // Hồ sơ vắng: chỉ ảnh có trong dữ liệu đã chiếu vắng mặt, không lôi dữ liệu nội thất cũ ra rà.
      for (const item of await listReportPhotoPool(reportId)) {
        if (item.category === 'CAD' || isExcludedPhotoPath(item.source) || described.has(item.url)) continue;
        candidates.push({ url: item.url, label: item.label, section: sectionFromPoolCategory(item.category) });
      }
    }
    // Tài liệu (biên bản, bản vẽ chủ hộ) in dạng bản scan ở Mục XI/XII: đánh dấu đã in nhưng không crop.
    const printedDocs = new Set<string>([
      ...(vm.appendix3?.signedRecordPages ?? []).map((p) => p.url),
      ...(vm.section12AsBuilt?.sheets ?? []).flatMap((s) => (s.drawings ?? []).map((d) => d.url)),
    ].filter(Boolean));
    const extraUrls = candidates.map((c) => c.url).filter((u) => !seen.has(u));
    if (extraUrls.length > 0) await LegacyWatermarkIndex.load(extraUrls);
    for (const c of candidates) {
      if (seen.has(c.url)) continue;
      seen.add(c.url);
      const photoKey = urlPhotoKey(c.url);
      slots.push({
        photoKey,
        url: c.url,
        rotation: printed(c.url, Number(rotMap[c.url]) || 0),
        label: c.label,
        section: c.section,
        photoGroup: photoGroupFor(kind, photoKey, c.section),
        legacyWatermarked: LegacyWatermarkIndex.has(c.url),
        printed: printedDocs.has(c.url),
      });
    }
    return {
      slots,
      kind,
      raw,
      zoneId: m.zone_id,
      stationCode: resolveStationCode(m.zone_id || '', m.zone_name),
      status: m.status,
      reportCode: m.report_code,
      studio: studioMapOf(asObject(raw.survey_data_json)),
    };
  }

  private static attachQc(slots: PhotoQcSlot[], rows: PhotoQcPhotoRow[], studio: StudioMap | null): PhotoQcSlotView[] {
    const byKey = new Map(rows.map((r) => [r.photoKey, r]));
    return slots.map((slot) => {
      const qc = byKey.get(slot.photoKey) ?? (slot.section === 'P' ? undefined : byKey.get(urlPhotoKey(slot.url))) ?? null;
      let qcStale = false;
      if (qc) {
        if (!isSameSourcePhoto(qc.photoUrl, slot.url, studio)) qcStale = true;
        else if (qc.crop && !isCropApplicable(qc.crop, qc.photoUrl, slot.url, slot.rotation, studio)) qcStale = true;
      }
      return { ...slot, qc, qcStale };
    });
  }

  // ---------------------------------------------------------------------------
  // Danh sách tổng quan
  // ---------------------------------------------------------------------------

  static async list(user: JwtPayload, q: PhotoQcListQuery): Promise<PhotoQcListResult> {
    const scope = await this.resolveZoneScope(user, q.zone, q.station);
    if (scope && scope.length === 0) return { items: [], nextCursor: null };

    const where: string[] = [`r.deleted_at IS NULL`, `r.phase = 'PHASE_1'`];
    const params: unknown[] = [];
    const add = (sql: (n: number) => string, value: unknown) => {
      params.push(value);
      where.push(sql(params.length));
    };
    if (scope) add((n) => `UPPER(p.zone_id) = ANY($${n}::text[])`, scope);
    if (q.kind === 'HOUSE') where.push(`r.report_type = 'STANDALONE'`);
    if (q.kind === 'MASTER') where.push(`r.report_type = 'BUILDING_MASTER'`);
    if (q.kind === 'M') where.push(`r.report_type = 'CONDO_UNIT' AND COALESCE(bu.unit_type, 'UNIT') = 'MASTER'`);
    if (q.kind === 'U') where.push(`r.report_type = 'CONDO_UNIT' AND COALESCE(bu.unit_type, 'UNIT') = 'UNIT'`);
    if (q.filter === 'UNREVIEWED') {
      where.push(`NOT EXISTS (SELECT 1 FROM photo_qc_reports qr WHERE qr.report_id = r.id AND qr.deleted_at IS NULL AND qr.reviewed = TRUE)`);
    }
    if (q.filter === 'REVIEWED') {
      where.push(`EXISTS (SELECT 1 FROM photo_qc_reports qr WHERE qr.report_id = r.id AND qr.deleted_at IS NULL AND qr.reviewed = TRUE)`);
    }
    if (q.filter === 'FLAGGED') {
      where.push(`EXISTS (SELECT 1 FROM photo_qc_photos qp WHERE qp.report_id = r.id AND qp.deleted_at IS NULL AND qp.recapture = TRUE AND qp.status <> 'RESOLVED')`);
    }
    if (q.q && q.q.trim()) {
      add((n) => `(r.report_code ILIKE $${n} OR p.project_parcel_code ILIKE $${n} OR bu.unit_code ILIKE $${n})`, `%${q.q.trim()}%`);
    }
    const after = decodeCursor(q.cursor);
    if (after) add((n) => `r.report_code > $${n}`, after);

    const limit = q.limit ?? 50;
    const rows = await fetchPhotoSourceRows(where, params, limit + 1);
    const pageRows = rows.slice(0, limit);
    const ids = pageRows.map((r) => r.id);

    const allUrls = pageRows.flatMap((r) => extractAllImageUrls({ j: r.json_subset, p: r.ident_photos, d: r.deformation }));
    await LegacyWatermarkIndex.load(allUrls);
    const [qcReports, qcPhotos] = await Promise.all([PhotoQcRepository.getReportRows(ids), PhotoQcRepository.getPhotoRows(ids)]);
    const qcByReport = new Map(qcReports.map((r) => [r.reportId, r]));
    const photosByReport = new Map<string, PhotoQcPhotoRow[]>();
    for (const p of qcPhotos) {
      const list = photosByReport.get(p.reportId) ?? [];
      list.push(p);
      photosByReport.set(p.reportId, list);
    }

    // Hồ sơ không có ảnh P (khu vực chung M): lấy tối đa 8 ảnh đại diện qua đúng bộ ảnh rà soát, song song 4.
    const pSlotsById = new Map(pageRows.map((row) => [row.id, this.buildPSlots(row, resolveReportKind(row.report_type, row.unit_type))]));
    const previewById = new Map<string, PhotoQcSlot[]>();
    const needPreview = pageRows.filter((row) => (pSlotsById.get(row.id) ?? []).length === 0);
    for (let i = 0; i < needPreview.length; i += PREVIEW_CONCURRENCY) {
      await Promise.all(
        needPreview.slice(i, i + PREVIEW_CONCURRENCY).map(async (row) => {
          try {
            const built = await this.buildAllSlots(row.id);
            const order: Record<string, number> = { OVERVIEW: 0, DEFECT: 1, P: 2, DOCUMENT: 3 };
            previewById.set(row.id, [...built.slots].sort((a, b) => order[a.section] - order[b.section]).slice(0, PREVIEW_LIMIT));
          } catch (err) {
            console.error(`[PhotoQcService:list] Không dựng được ảnh đại diện cho ${row.report_code}`, err);
          }
        })
      );
    }

    const items: PhotoQcListItem[] = pageRows.map((row) => {
      const kind = resolveReportKind(row.report_type, row.unit_type);
      const flags = photosByReport.get(row.id) ?? [];
      const pSlots = pSlotsById.get(row.id) ?? [];
      const suggested = suggestRecaptureLevel(flags);
      const qc = qcByReport.get(row.id) ?? null;
      return {
        reportId: row.id,
        reportCode: row.report_code,
        parcelCode: row.project_parcel_code,
        unitCode: row.unit_code,
        kind,
        status: row.status,
        zoneId: row.zone_id,
        stationCode: resolveStationCode(row.zone_id || '', row.zone_name),
        coverEligible: isCoverEligibleKind(kind),
        pPhotos: this.attachQc(pSlots, flags, studioMapOf(asObject(row.json_subset))),
        qc,
        openFlagCount: flags.filter((f) => f.recapture && f.status !== 'RESOLVED').length,
        suggestedLevel: suggested,
        effectiveLevel: effectiveLevel(qc?.recaptureLevel, suggested),
        previewPhotos: this.attachQc(previewById.get(row.id) ?? [], flags, null),
      };
    });

    return {
      items,
      nextCursor: rows.length > limit && pageRows.length > 0 ? encodeCursor(pageRows[pageRows.length - 1].report_code) : null,
    };
  }

  // ---------------------------------------------------------------------------
  // Chi tiết
  // ---------------------------------------------------------------------------

  static async detail(user: JwtPayload, reportId: string): Promise<PhotoQcDetail> {
    const built = await this.buildAllSlots(reportId);
    this.assertReportAccess(user, built.zoneId);
    const [qc, rows] = await Promise.all([PhotoQcRepository.getReportRow(reportId), PhotoQcRepository.getPhotoRows([reportId])]);
    return {
      reportId,
      reportCode: built.reportCode,
      kind: built.kind,
      status: built.status,
      coverEligible: isCoverEligibleKind(built.kind),
      hasP04: built.slots.some((s) => s.photoKey === 'P-04'),
      qc,
      photos: this.attachQc(built.slots, rows, built.studio),
      suggestedLevel: suggestRecaptureLevel(rows),
      effectiveLevel: effectiveLevel(qc?.recaptureLevel, suggestRecaptureLevel(rows)),
      appliesFromNextRevision: built.status === 'APPROVED',
    };
  }

  // ---------------------------------------------------------------------------
  // Ghi
  // ---------------------------------------------------------------------------

  /** Hồ sơ APPROVED: đóng băng QC mới vào một snapshot chờ phát hành (r00 đã phát hành không đổi). */
  private static async freezeForNextRelease(client: Parameters<Parameters<typeof Database.transaction>[0]>[0], reportId: string, userId: string, note: string): Promise<void> {
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
      `Photo QC: ${note} (chờ phát hành Rev mới)`,
      row.export_revision ?? 0
    );
  }

  static async updateReport(user: JwtPayload, reportId: string, body: UpdatePhotoQcReportInput, clientIp?: string): Promise<PhotoQcReportRow> {
    if (!user.userId) throw new UnauthorizedError('Người dùng chưa xác thực');
    const built = await this.buildAllSlots(reportId);
    this.assertReportAccess(user, built.zoneId);

    if (body.coverSource === 'P04') {
      if (!isCoverEligibleKind(built.kind)) {
        throw new BadRequestError('Hồ sơ căn hộ không đổi bìa sang P04 (P-04 căn hộ là cửa & hành lang)');
      }
      if (!built.slots.some((s) => s.photoKey === 'P-04')) {
        throw new BadRequestError('Hồ sơ không có ảnh P-04 hợp lệ (thiếu hoặc đánh dấu N/A)');
      }
    }

    return Database.transaction(async (client) => {
      const before = await PhotoQcRepository.getReportRow(reportId, client);
      const saved = await PhotoQcRepository.upsertReport(client, {
        reportId,
        zoneId: built.zoneId,
        stationCode: built.stationCode,
        coverSource: body.coverSource,
        recaptureLevel: body.recaptureLevel,
        reviewed: body.reviewed,
        userId: user.userId,
      });
      await PhotoQcRepository.writeAuditLog(client, reportId, user.userId, 'PHOTO_QC_REPORT_UPDATE', {
        before,
        after: saved,
        clientIp: clientIp ?? null,
      });
      const coverChanged = body.coverSource !== undefined && (before?.coverSource ?? null) !== (saved.coverSource ?? null);
      if (coverChanged) {
        await this.freezeForNextRelease(client, reportId, user.userId, saved.coverSource ? 'dùng P04 làm bìa' : 'bỏ bìa P04');
      }
      return saved;
    });
  }

  static async updatePhotos(user: JwtPayload, reportId: string, items: UpdatePhotoQcPhotosInput, clientIp?: string): Promise<PhotoQcPhotoRow[]> {
    if (!user.userId) throw new UnauthorizedError('Người dùng chưa xác thực');
    const built = await this.buildAllSlots(reportId);
    this.assertReportAccess(user, built.zoneId);
    const slotByKey = new Map(built.slots.map((s) => [s.photoKey, s]));

    for (const item of items) {
      const slot = slotByKey.get(item.photoKey);
      if (!slot) throw new BadRequestError(`Ô ảnh ${item.photoKey} không còn trong hồ sơ, vui lòng tải lại`);
      if (slot.url !== item.photoUrl) throw new ConflictError(`Ảnh ${slot.label} đã thay đổi, vui lòng tải lại trước khi lưu`);
      if (item.crop && normalizeDeg(item.crop.rotationAtCrop) !== normalizeDeg(slot.rotation)) {
        throw new ConflictError(`Góc xoay của ${slot.label} đã thay đổi, vui lòng crop lại`);
      }
      if (item.crop && slot.section === 'DOCUMENT') {
        throw new BadRequestError(`${slot.label} là tài liệu scan, chỉ gắn cờ chụp lại, không crop`);
      }
      if (item.restampMode && item.restampMode !== 'NONE' && !slot.legacyWatermarked) {
        throw new BadRequestError(`Ảnh ${slot.label} chưa có watermark cũ, không cần dập bù`);
      }
    }

    return Database.transaction(async (client) => {
      const beforeRows = await PhotoQcRepository.getPhotoRows([reportId], client);
      const beforeByKey = new Map(beforeRows.map((r) => [r.photoKey, r]));
      const saved: PhotoQcPhotoRow[] = [];
      let renderChanged = false;
      for (const item of items) {
        const slot = slotByKey.get(item.photoKey)!;
        const crop = item.crop === undefined ? undefined : item.crop === null ? null : {
          x: item.crop.x, y: item.crop.y, w: item.crop.w, h: item.crop.h,
          ratio: item.crop.ratio, rotationAtCrop: normalizeDeg(item.crop.rotationAtCrop),
        };
        const row = await PhotoQcRepository.upsertPhoto(client, {
          reportId,
          photoKey: slot.photoKey,
          photoUrl: slot.url,
          photoLabel: slot.label,
          photoGroup: slot.photoGroup,
          crop,
          restampMode: item.restampMode,
          recapture: item.recapture,
          userId: user.userId,
        });
        const prev = beforeByKey.get(slot.photoKey);
        if (
          JSON.stringify(prev?.crop ?? null) !== JSON.stringify(row.crop ?? null) ||
          (prev?.restampMode ?? 'NONE') !== row.restampMode
        ) {
          renderChanged = true;
        }
        saved.push(row);
      }
      await PhotoQcRepository.writeAuditLog(client, reportId, user.userId, 'PHOTO_QC_PHOTOS_UPDATE', {
        before: items.map((i) => beforeByKey.get(i.photoKey) ?? null),
        after: saved,
        clientIp: clientIp ?? null,
      });
      await PhotoQcRepository.upsertReport(client, {
        reportId,
        zoneId: built.zoneId,
        stationCode: built.stationCode,
        userId: user.userId,
      });
      if (renderChanged) {
        await this.freezeForNextRelease(client, reportId, user.userId, 'cập nhật crop / dập bù watermark');
      }
      return saved;
    });
  }

  // ---------------------------------------------------------------------------
  // Danh sách giao KSV
  // ---------------------------------------------------------------------------

  static async recaptureList(user: JwtPayload, q: PhotoQcRecaptureQuery): Promise<PhotoQcRecaptureRow[]> {
    const scope = await this.resolveZoneScope(user, q.zone, q.station);
    if (scope && scope.length === 0) return [];
    const params: unknown[] = [];
    let scopeSql = '';
    if (scope) {
      params.push(scope);
      scopeSql = `AND UPPER(p.zone_id) = ANY($1::text[])`;
    }
    const res = await Database.query<{
      id: string; report_code: string; report_type: string; unit_type: string | null; unit_code: string | null;
      project_parcel_code: string | null; house_number: string | null; street: string | null;
      zone_id: string | null; zone_name: string | null; recapture_level: string | null; cover_source: string | null;
      flags: Array<{ photo_key: string; photo_label: string | null; photo_url: string; photo_group: string; status: string }> | null;
    }>(
      `SELECT r.id, r.report_code, r.report_type, bu.unit_type, bu.unit_code, p.project_parcel_code, p.house_number, p.street,
              p.zone_id, mz.zone_name, qr.recapture_level, qr.cover_source,
              (SELECT json_agg(json_build_object('photo_key', qp.photo_key, 'photo_label', qp.photo_label, 'photo_url', qp.photo_url,
                                                 'photo_group', qp.photo_group, 'status', qp.status) ORDER BY qp.photo_key)
                 FROM photo_qc_photos qp
                WHERE qp.report_id = r.id AND qp.deleted_at IS NULL AND qp.recapture = TRUE AND qp.status <> 'RESOLVED') AS flags
       FROM base_survey_reports r
       JOIN parcels p ON p.id = r.parcel_id
       LEFT JOIN metro_zones mz ON mz.zone_code = p.zone_id
       LEFT JOIN building_units bu ON bu.id = r.unit_id
       LEFT JOIN photo_qc_reports qr ON qr.report_id = r.id AND qr.deleted_at IS NULL
       WHERE r.deleted_at IS NULL ${scopeSql}
         AND (COALESCE(qr.recapture_level, 'AUTO') IN ('OUTDOOR_ONLY', 'FULL')
              OR EXISTS (SELECT 1 FROM photo_qc_photos qp WHERE qp.report_id = r.id AND qp.deleted_at IS NULL
                           AND qp.recapture = TRUE AND qp.status <> 'RESOLVED'))
       ORDER BY p.zone_id, r.report_code;`,
      params
    );

    const rows: PhotoQcRecaptureRow[] = res.rows.map((r) => {
      const flags = r.flags ?? [];
      const suggested = suggestRecaptureLevel(flags.map((f) => ({
        recapture: true,
        photoGroup: f.photo_group === 'INDOOR' ? 'INDOOR' : 'OUTDOOR',
        status: f.status === 'ASSIGNED' ? 'ASSIGNED' : 'OPEN',
      })));
      const stored = (r.recapture_level || 'AUTO') as PhotoQcRecaptureLevel;
      const level = effectiveLevel(stored, suggested);
      return {
        stationCode: resolveStationCode(r.zone_id || '', r.zone_name),
        zoneId: r.zone_id,
        reportId: r.id,
        reportCode: r.report_code,
        parcelCode: r.project_parcel_code,
        unitCode: r.unit_code,
        kind: resolveReportKind(r.report_type, r.unit_type),
        recaptureLevel: level,
        levelIsAuto: stored === 'AUTO',
        coverP04: r.cover_source === 'P04',
        address: [r.house_number, r.street].filter(Boolean).join(' ') || null,
        photoKeys: flags.map((f) => f.photo_label || f.photo_key),
        photos: flags.map((f) => ({ key: f.photo_key, label: f.photo_label || f.photo_key, url: f.photo_url })),
        outdoorCount: flags.filter((f) => f.photo_group !== 'INDOOR').length,
        indoorCount: flags.filter((f) => f.photo_group === 'INDOOR').length,
      };
    });
    return q.level ? rows.filter((r) => r.recaptureLevel === q.level) : rows.filter((r) => r.recaptureLevel !== 'NONE');
  }

  static async recaptureWorkbook(rows: PhotoQcRecaptureRow[]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Metro 2 BCS – Photo QC';
    const ws = wb.addWorksheet('Danh sach chup lai');
    ws.columns = [
      { header: 'STT', key: 'no', width: 6 },
      { header: 'Ga', key: 'station', width: 8 },
      { header: 'Zone', key: 'zone', width: 10 },
      { header: 'Mã hồ sơ', key: 'reportCode', width: 26 },
      { header: 'Mã thửa', key: 'parcel', width: 18 },
      { header: 'Mã căn', key: 'unit', width: 10 },
      { header: 'Loại', key: 'kind', width: 12 },
      { header: 'Địa chỉ', key: 'address', width: 30 },
      { header: 'Mức thu thập lại', key: 'level', width: 22 },
      { header: 'Số ảnh bên ngoài', key: 'outdoor', width: 12 },
      { header: 'Số ảnh bên trong', key: 'indoor', width: 12 },
      { header: 'Bìa P-04', key: 'cover', width: 10 },
      { header: 'Ảnh cần chụp lại', key: 'photos', width: 60 },
    ];
    const kindLabel: Record<PhotoQcReportKind, string> = { HOUSE: 'Nhà dân', MASTER: 'Tòa mẹ', M: 'Khu vực chung', U: 'Căn hộ' };
    const levelLabel: Record<PhotoQcEffectiveLevel, string> = {
      NONE: 'Không',
      OUTDOOR_ONLY: 'Bên ngoài',
      FULL: 'Tất cả',
    };
    rows.forEach((r, idx) => {
      ws.addRow({
        no: idx + 1,
        station: r.stationCode,
        zone: r.zoneId,
        reportCode: r.reportCode,
        parcel: r.parcelCode,
        unit: r.unitCode,
        kind: kindLabel[r.kind],
        address: r.address,
        level: `${levelLabel[r.recaptureLevel]}${r.levelIsAuto ? ' (tự động)' : ''}`,
        cover: r.coverP04 ? 'Có' : '',
        outdoor: r.outdoorCount,
        indoor: r.indoorCount,
        photos: r.photoKeys.join('; '),
      });
    });
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }
}
