/**
 * ============================================================================
 * MINUTES EXPORT SERVICE
 * Chọn đúng hồ sơ cho từng thửa/căn và kết xuất PDF biên bản hiện trường độc lập.
 * Ảnh nạp qua loadImageStrict: thiếu ảnh thì thất bại, không sinh PDF thiếu trang.
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import Handlebars from 'handlebars';
import { Database } from '../../../database/db';
import {
  BadRequestError,
  ConflictError,
  UnprocessableEntityError,
} from '../../../common/errors/problem-details';
import { fetchCondoUnitAbsenceMap, type CondoUnitAbsenceResult } from '../../audit/condo/condo-absence.resolver';
import { CadastralRepository } from '../../cadastral/cadastral.repository';
import { PdfRenderEngine } from '../engine/pdf-render.engine';
import { RenderQueue } from '../engine/render-queue';
import { Appendix3And4Mapper } from '../mappers/appendices/appendix-3-4-records.mapper';
import { formatDateVi, formatWatermarkDateTime } from '../mappers/formatters.mapper';
import { MetadataMapper } from '../mappers/sections/metadata-and-cover.mapper';
import { applyCondoReportContext } from '../snapshot/condo-absent-projection';
import { ReportSnapshotService } from '../snapshot/report-snapshot.service';
import { ReportImageResolver } from './report-image-resolver.service';
import { REPORT_PDF_HEADER_TITLE, ReportService, type ResolvedReport } from './report.service';

export const MINUTES_EXPORTABLE_STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'];

export type MinutesCategory = 'MINUTES' | 'ABSENTEE' | 'NONE';

export interface MinutesListItem {
  key: string;
  reportId: string | null;
  parcelCode: string;
  unitCode: string | null;
  reportType: string | null;
  reportStatus: string | null;
  category: MinutesCategory;
  label: string | null;
  docPageCount: number;
  fileName: string | null;
  note: string | null;
}

export interface MinutesPdfResult {
  pdfBuffer: Buffer;
  fileName: string;
  label: string;
  docPageCount: number;
}

const LABEL_SIGNED = 'ĐÃ KÝ XÁC NHẬN';
const LABEL_SCANNED = 'CÓ BẢN QUÉT BIÊN BẢN';
const NOTE_NO_ABSENT_RECORD = 'Chưa có biên bản vắng nhà';
const NOTE_SUSPECTED_ABSENT = 'Nghi vắng, cần Admin xác nhận';

const STATUS_TEXT: Record<string, string> = {
  SUBMITTED: 'Đã nộp – Chưa phê duyệt',
  UNDER_REVIEW: 'Đang thẩm định – Chưa phê duyệt',
  APPROVED: 'Đã phê duyệt',
};

interface ReportRow {
  id: string;
  parcel_id: string;
  unit_id: string | null;
  status: string;
  report_type: string | null;
  submitted_at: Date | null;
  created_at: Date;
  is_refused_or_absent: boolean;
  json_subset: Record<string, unknown>;
  doc_photos: Record<string, unknown>[];
}

const isExportable = (status: string): boolean => MINUTES_EXPORTABLE_STATUSES.includes(status);

export const safeFilePart = (value: string): string => value.trim().replace(/[^A-Za-z0-9._-]+/g, '_');

export const buildMinutesFileName = (parcelCode: string, unitCode: string | null): string =>
  `${[parcelCode, unitCode].filter(Boolean).map((part) => safeFilePart(String(part))).join('_')}_Bien_Ban.pdf`;

const resolveLabel = (status: string): string => (status === 'APPROVED' ? LABEL_SIGNED : LABEL_SCANNED);

/**
 * Chưa có mẫu biên bản vắng nhà: ảnh đính ở hồ sơ vắng chỉ để nộp được nên không xuất.
 * Căn hộ phân loại qua resolver vì cờ trên hồ sơ cũ không đáng tin; Khu vực chung và thửa thường đọc cờ hồ sơ.
 */
const isAbsentRecord = (
  absence: CondoUnitAbsenceResult | undefined,
  report: Record<string, unknown>,
  json: Record<string, unknown>
): boolean => (absence ? absence.state === 'ABSENT' : Appendix3And4Mapper.isAbsenteeReport(report, json));

const newestFirst = (a: ReportRow, b: ReportRow): number =>
  new Date(b.submitted_at ?? b.created_at).getTime() - new Date(a.submitted_at ?? a.created_at).getTime();

export class MinutesExportService {
  private static compiledTemplate: Handlebars.TemplateDelegate | null = null;

  private static getTemplate(): Handlebars.TemplateDelegate {
    if (!this.compiledTemplate || process.env.NODE_ENV !== 'production') {
      const templatePath = path.join(__dirname, '../templates/minutes/minute-standalone.hbs');
      this.compiledTemplate = Handlebars.compile(fs.readFileSync(templatePath, 'utf8'));
    }
    return this.compiledTemplate;
  }

  /** Mỗi thửa/căn đúng 1 dòng: ưu tiên con trỏ hồ sơ active, sai con trỏ thì lấy bản nộp mới nhất và cảnh báo. */
  private static pickReport(
    candidates: ReportRow[],
    pointerId: string | null
  ): { report: ReportRow | null; note: string | null } {
    const exportable = candidates.filter((report) => isExportable(report.status)).sort(newestFirst);
    if (exportable.length === 0) {
      return {
        report: null,
        note: candidates.length > 0 ? 'Hồ sơ còn ở trạng thái nháp (DRAFT)' : 'Chưa có hồ sơ khảo sát',
      };
    }
    const pointed = exportable.find((report) => report.id === pointerId);
    if (pointed) return { report: pointed, note: null };
    return {
      report: exportable[0],
      note: candidates.length > 1 ? 'Con trỏ hồ sơ active không hợp lệ, đã lấy bản nộp mới nhất' : null,
    };
  }

  private static toListItem(
    key: string,
    parcelCode: string,
    unitCode: string | null,
    candidates: ReportRow[],
    pointerId: string | null,
    absenceMap: Map<string, CondoUnitAbsenceResult>
  ): MinutesListItem {
    const { report, note } = this.pickReport(candidates, pointerId);
    if (!report) {
      return {
        key,
        reportId: null,
        parcelCode,
        unitCode,
        reportType: null,
        reportStatus: null,
        category: 'NONE',
        label: null,
        docPageCount: 0,
        fileName: null,
        note,
      };
    }

    const absence = absenceMap.get(report.id);
    if (isAbsentRecord(absence, { ...report }, report.json_subset)) {
      return {
        key,
        reportId: report.id,
        parcelCode,
        unitCode,
        reportType: report.report_type,
        reportStatus: report.status,
        category: 'ABSENTEE',
        label: null,
        docPageCount: 0,
        fileName: null,
        note: NOTE_NO_ABSENT_RECORD,
      };
    }

    const docs = Appendix3And4Mapper.collectSignedRecordDocs(report, report.json_subset, report.doc_photos);
    const hasDocs = docs.length > 0;
    const suspectedNote = absence?.state === 'SUSPECTED' ? NOTE_SUSPECTED_ABSENT : null;
    return {
      key,
      reportId: report.id,
      parcelCode,
      unitCode,
      reportType: report.report_type,
      reportStatus: report.status,
      category: hasDocs ? 'MINUTES' : 'NONE',
      label: hasDocs ? resolveLabel(report.status) : null,
      docPageCount: docs.length,
      fileName: hasDocs ? buildMinutesFileName(parcelCode, unitCode) : null,
      note: hasDocs ? [note, suspectedNote].filter(Boolean).join('; ') || null : 'Hồ sơ chưa có ảnh biên bản',
    };
  }

  public static async listZoneMinutes(zoneId: string): Promise<MinutesListItem[]> {
    const target = zoneId.trim().toUpperCase();
    if (!target || target === 'ALL' || target === 'ALL_ZONES') {
      throw new BadRequestError('Chỉ xuất biên bản theo một Zone cụ thể');
    }
    const zones = CadastralRepository.getZoneAliases(target);

    const [parcelRes, unitRes, reportRes] = await Promise.all([
      Database.query<{ id: string; project_parcel_code: string; active_phase1_report_id: string | null }>(
        `SELECT id, project_parcel_code, active_phase1_report_id
         FROM parcels
         WHERE lifecycle_status = 'ACTIVE' AND zone_id = ANY($1)
         ORDER BY project_parcel_code;`,
        [zones]
      ),
      Database.query<{ id: string; parcel_id: string; unit_code: string; phase1_report_id: string | null }>(
        `SELECT u.id, u.parcel_id, u.unit_code, u.phase1_report_id
         FROM building_units u
         JOIN parcels p ON p.id = u.parcel_id
         WHERE u.deleted_at IS NULL AND p.lifecycle_status = 'ACTIVE' AND p.zone_id = ANY($1)
         ORDER BY u.unit_code;`,
        [zones]
      ),
      Database.query<ReportRow>(
        `SELECT r.id, r.parcel_id, r.unit_id, r.status::text AS status, r.report_type, r.submitted_at, r.created_at,
                r.is_refused_or_absent,
                jsonb_strip_nulls(jsonb_build_object(
                  'isAbsentee', r.survey_data_json->'isAbsentee',
                  'isAbsenteeSurvey', r.survey_data_json->'isAbsenteeSurvey',
                  'surveyCaseType', r.survey_data_json->'surveyCaseType',
                  'workingMinutesPhotos', r.survey_data_json->'workingMinutesPhotos',
                  'absenteeNoticePhotos', r.survey_data_json->'absenteeNoticePhotos',
                  'absentNoticePhotos', r.survey_data_json->'absentNoticePhotos',
                  'absenteeMinutesPhotos', r.survey_data_json->'absenteeMinutesPhotos',
                  'absenceLogs', r.survey_data_json->'absenceLogs',
                  'signatures', jsonb_build_object('workingMinutesPhotos', r.survey_data_json#>'{signatures,workingMinutesPhotos}')
                )) AS json_subset,
                COALESCE((
                  SELECT jsonb_agg(jsonb_build_object('photo_type', ph.photo_type, 'raw_photo_url', ph.raw_photo_url, 'annotated_photo_url', ph.annotated_photo_url))
                  FROM survey_identification_photos ph
                  WHERE ph.report_id = r.id AND (ph.photo_type::text LIKE '%DOC%' OR ph.raw_photo_url LIKE '%/DOC/%')
                ), '[]'::jsonb) AS doc_photos
         FROM base_survey_reports r
         JOIN parcels p ON p.id = r.parcel_id
         WHERE r.deleted_at IS NULL AND r.phase = 'PHASE_1'
           AND p.lifecycle_status = 'ACTIVE' AND p.zone_id = ANY($1);`,
        [zones]
      ),
    ]);

    const absenceMap = await fetchCondoUnitAbsenceMap(
      reportRes.rows.filter((report) => report.unit_id !== null).map((report) => report.id)
    );

    const byEntity = new Map<string, ReportRow[]>();
    for (const report of reportRes.rows) {
      const key = report.unit_id ?? report.parcel_id;
      byEntity.set(key, [...(byEntity.get(key) ?? []), report]);
    }

    const parcelCodes = new Map(parcelRes.rows.map((parcel) => [parcel.id, parcel.project_parcel_code]));
    const parcelItems = parcelRes.rows.map((parcel) =>
      this.toListItem(
        parcel.id,
        parcel.project_parcel_code,
        null,
        (byEntity.get(parcel.id) ?? []).filter((report) => report.unit_id === null),
        parcel.active_phase1_report_id,
        absenceMap
      )
    );
    const unitItems = unitRes.rows.map((unit) =>
      this.toListItem(
        unit.id,
        parcelCodes.get(unit.parcel_id) ?? '',
        unit.unit_code,
        byEntity.get(unit.id) ?? [],
        unit.phase1_report_id,
        absenceMap
      )
    );

    return [...parcelItems, ...unitItems].sort(
      (a, b) =>
        a.parcelCode.localeCompare(b.parcelCode) || (a.unitCode ?? '').localeCompare(b.unitCode ?? '')
    );
  }

  /** Hồ sơ APPROVED phải đọc từ snapshot đã duyệt để không lệch với bản phát hành. */
  private static async loadSourceReport(resolved: ResolvedReport): Promise<Record<string, unknown>> {
    if (resolved.status !== 'APPROVED') return resolved.raw;
    const approved = await ReportSnapshotService.getSnapshotForRevision(resolved.id);
    if (!approved?.snapshot) {
      throw new ConflictError(`Hồ sơ APPROVED ${resolved.id} chưa có snapshot đã duyệt`);
    }
    const report = ReportSnapshotService.applySnapshotToReport(resolved.raw, approved.snapshot);
    report.status = 'APPROVED';
    return report;
  }

  public static async renderMinutesPdf(resolved: ResolvedReport): Promise<MinutesPdfResult> {
    if (!isExportable(resolved.status)) {
      throw new ConflictError(`Hồ sơ ở trạng thái ${resolved.status} chưa được phép xuất biên bản`);
    }

    const rawReport = await applyCondoReportContext(await this.loadSourceReport(resolved));
    const json = (rawReport.survey_data_json ?? {}) as Record<string, any>;
    const absence = (await fetchCondoUnitAbsenceMap([resolved.id])).get(resolved.id);
    if (isAbsentRecord(absence, rawReport, json)) {
      throw new UnprocessableEntityError('Hồ sơ vắng chủ chưa có biên bản vắng nhà để xuất');
    }

    const identPhotos = (rawReport.identificationPhotos ?? []) as Record<string, unknown>[];
    const rawSurveyDate =
      json.surveyDate ||
      rawReport.survey_date ||
      json.signatures?.preparedBy?.date ||
      json.signatures?.ownerRepresentative?.date ||
      rawReport.created_at;
    const surveyDateFormatted = formatDateVi(rawSurveyDate as string) || '';
    const surveyDateWithTime = formatDateVi(rawSurveyDate as string, true) || surveyDateFormatted;
    const watermarkDateTime = formatWatermarkDateTime(rawSurveyDate as string) || surveyDateWithTime;

    const { metadata, buildingId, reportNo, surveyorName, zoneAdminName } = MetadataMapper.map(
      rawReport,
      json,
      identPhotos,
      undefined,
      surveyDateFormatted,
      watermarkDateTime,
      rawSurveyDate
    );
    const appendix3 = Appendix3And4Mapper.mapAppendix3(
      rawReport,
      json,
      identPhotos,
      surveyDateWithTime,
      surveyDateFormatted,
      surveyorName,
      zoneAdminName,
      reportNo,
      buildingId,
      rawSurveyDate
    );
    if (appendix3.signedRecordPages.length === 0) {
      throw new UnprocessableEntityError('Hồ sơ chưa có ảnh biên bản hiện trường');
    }

    for (const page of appendix3.signedRecordPages) {
      page.base64 = await ReportImageResolver.loadImageStrict(page.url, page.rotation);
    }

    const identity = await Database.query<{ project_parcel_code: string; unit_code: string | null }>(
      `SELECT p.project_parcel_code, u.unit_code
       FROM base_survey_reports r
       JOIN parcels p ON p.id = r.parcel_id
       LEFT JOIN building_units u ON u.id = r.unit_id
       WHERE r.id = $1;`,
      [resolved.id]
    );
    const parcelCode = identity.rows[0]?.project_parcel_code ?? buildingId;
    const unitCode = identity.rows[0]?.unit_code ?? null;
    const label = resolveLabel(resolved.status);

    const html = this.getTemplate()({
      styles: ReportService.getCompiledTemplate().styles,
      metadata,
      appendix3,
      parcelCode,
      unitCode,
      label,
      statusText: STATUS_TEXT[resolved.status],
      exportedAt: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
    });

    const pdfBuffer = await RenderQueue.run(() =>
      PdfRenderEngine.renderHtmlToPdf(html, {
        buildingId,
        reportNo,
        headerTitle: REPORT_PDF_HEADER_TITLE,
        selfContainedHtml: true,
      })
    );

    return {
      pdfBuffer,
      fileName: buildMinutesFileName(parcelCode, unitCode),
      label,
      docPageCount: appendix3.signedRecordPages.length,
    };
  }
}
