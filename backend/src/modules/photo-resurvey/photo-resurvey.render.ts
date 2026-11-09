/**
 * ============================================================================
 * PHOTO RESURVEY – LỚP PHỦ KHI RENDER REPORT
 * Chạy ngay sau khi dựng ViewModel, TRƯỚC Photo QC (bìa P04, crop) và lượt dập watermark:
 *   - REPLACE : ô Phụ lục 1 (theo khoá ô) đổi sang ảnh mới; bìa và Mục V đang in cùng ảnh gốc (theo URL) đổi theo.
 *               Chữ ngày giờ và mã ảnh watermark GIỮ NGUYÊN như ảnh gốc ở từng vị trí (Time 2 = giờ gốc).
 *   - MARK_NA : bỏ ô khỏi Phụ lục 1 (và Mục V nếu đang in cùng ảnh); ảnh gốc vẫn nằm nguyên trong DB/R2.
 *   - ADD_EXTRA: thêm ô sau ảnh cuối của mục, watermark in Time 2 đã chốt khi duyệt.
 * Sau đó dựng lại trang Phụ lục 1 và mục lục (thêm ảnh có thể thêm trang).
 * Hồ sơ đã áp snapshot: chỉ đọc trạng thái đóng băng (frozenReportData.photo_resurvey), không đọc bảng sống.
 * ============================================================================
 */

import type { Appendix1PhotoItem, Appendix1PhotoPage, ReportViewModel } from '../report/report.types';
import { ScenarioFlagsAndTocMapper } from '../report/mappers/sections/scenario-flags-and-toc.mapper';
import { ReportImageResolver } from '../report/services/report-image-resolver.service';
import { normalizeMetroPhotoCode } from '../report/utils/metro-photo-code.utils';
import { assignSlotKeys } from '../photo-qc/photo-qc.rules';
import { PhotoResurveyRepository } from './photo-resurvey.repository';
import { extraPhotoCodes, RESURVEY_SLOT_CODES, SLOT_LABEL, slotCodeOf } from './photo-resurvey.rules';
import type { ResurveyRenderItem, ResurveyRenderSession, ResurveyRenderState, ResurveySlotCode } from './photo-resurvey.types';

const PHOTOS_PER_PAGE = 4;

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

const ACTIONS = new Set(['REPLACE', 'ADD_EXTRA', 'MARK_NA']);

/** Đọc trạng thái đã đóng băng trong snapshot (null = lúc phát hành chưa có phiên nào được duyệt). */
export function parseFrozenResurvey(raw: unknown): ResurveyRenderState | null {
  if (!isRecord(raw) || !Array.isArray(raw.sessions)) return null;
  const sessions: ResurveyRenderSession[] = raw.sessions.filter(isRecord).map((s) => ({
    sessionId: String(s.sessionId ?? ''),
    approvedAt: typeof s.approvedAt === 'string' ? s.approvedAt : null,
    items: Array.isArray(s.items)
      ? s.items.filter(isRecord).flatMap((i): ResurveyRenderItem[] => {
          const action = String(i.action ?? '');
          const slot = slotCodeOf(String(i.slotCode ?? ''));
          if (!ACTIONS.has(action) || !slot) return [];
          return [{
            action: action as ResurveyRenderItem['action'],
            slotCode: slot,
            photoKey: typeof i.photoKey === 'string' ? i.photoKey : null,
            originalUrl: typeof i.originalUrl === 'string' ? i.originalUrl : null,
            extraIndex: typeof i.extraIndex === 'number' ? i.extraIndex : null,
            newUrl: typeof i.newUrl === 'string' ? i.newUrl : null,
            rotation: Number(i.rotation) || 0,
            time2Text: typeof i.time2Text === 'string' ? i.time2Text : null,
          }];
        })
      : [],
  }));
  return sessions.length > 0 ? { sessions } : null;
}

/**
 * Nguồn trạng thái cho một lượt render:
 * - Bản ghi đã áp snapshot (photo_resurvey_frozen) → đúng trạng thái của revision đó.
 * - Còn lại → đọc bảng sống (chỉ phiên APPROVED).
 */
export async function resolveResurveyStateForRender(report: Record<string, unknown>): Promise<ResurveyRenderState | null> {
  if (report.photo_resurvey_frozen === true) {
    return parseFrozenResurvey(report.photo_resurvey);
  }
  const reportId = typeof report.id === 'string' ? report.id : null;
  if (!reportId) return null;
  return PhotoResurveyRepository.loadRenderState(reportId);
}

export function buildAppendix1Pages(items: Appendix1PhotoItem[]): Appendix1PhotoPage[] {
  const sorted = [...items].sort((a, b) =>
    (a.photoCode || '').localeCompare(b.photoCode || '', undefined, { numeric: true, sensitivity: 'base' })
  );
  const total = Math.ceil(sorted.length / PHOTOS_PER_PAGE) || 1;
  const pages: Appendix1PhotoPage[] = [];
  for (let i = 0; i < sorted.length; i += PHOTOS_PER_PAGE) {
    pages.push({ pageIndex: Math.floor(i / PHOTOS_PER_PAGE) + 1, totalPages: total, photos: sorted.slice(i, i + PHOTOS_PER_PAGE) });
  }
  return pages;
}

export interface ApplyResurveyResult {
  applied: number;
  /** Thao tác không tìm thấy ảnh gốc trong report hiện tại (ảnh gốc đã bị đổi sau khi duyệt). */
  missed: string[];
}

function applySession(
  vm: ReportViewModel,
  session: ResurveyRenderSession,
  b64: (url: string, rot: number) => string,
  result: ApplyResurveyResult
): void {
  const appendix1 = vm.appendix1 || [];
  // Khoá ô tính MỘT lần trên trạng thái đầu phiên: đúng như service đã dùng khi KSV chọn ô.
  const keys = assignSlotKeys(appendix1.map((p) => p.photoCode));
  const byKey = new Map<string, Appendix1PhotoItem>();
  appendix1.forEach((item, idx) => byKey.set(keys[idx], item));
  const removed = new Set<Appendix1PhotoItem>();

  for (const it of session.items) {
    if (it.action === 'ADD_EXTRA' || !it.photoKey) continue;
    const target = byKey.get(it.photoKey);
    if (!target || (it.originalUrl && target.url !== it.originalUrl)) {
      result.missed.push(`${it.action} ${it.photoKey}`);
      continue;
    }
    const original = target.url;
    if (it.action === 'MARK_NA') {
      removed.add(target);
      if (it.slotCode === 'P-05' && vm.section5?.tiltPhoto?.url === original) vm.section5.tiltPhoto = undefined;
      if (it.slotCode === 'P-06' && vm.section5?.settlementPhoto?.url === original) vm.section5.settlementPhoto = undefined;
      result.applied++;
      continue;
    }
    if (!it.newUrl) {
      result.missed.push(`${it.action} ${it.photoKey} (thiếu ảnh mới)`);
      continue;
    }
    const base64 = b64(it.newUrl, it.rotation);
    target.url = it.newUrl;
    target.base64 = base64;
    target.rotation = it.rotation;
    target.alreadyWatermarked = false;
    // watermarkDateTime + metroPhotoCode giữ nguyên: Time 2 = đúng chữ đang in của ảnh gốc.

    const meta = vm.metadata;
    if (meta && meta.coverPhotoUrl === original) {
      meta.coverPhotoUrl = it.newUrl;
      meta.coverPhotoBase64 = base64;
      meta.coverAlreadyWatermarked = false;
    }
    const s5 = vm.section5;
    if (s5?.tiltPhoto && it.slotCode === 'P-05' && s5.tiltPhoto.url === original) {
      s5.tiltPhoto = { ...s5.tiltPhoto, url: it.newUrl, base64, alreadyWatermarked: false };
    }
    if (s5?.settlementPhoto && it.slotCode === 'P-06' && s5.settlementPhoto.url === original) {
      s5.settlementPhoto = { ...s5.settlementPhoto, url: it.newUrl, base64, alreadyWatermarked: false };
    }
    result.applied++;
  }

  let list = appendix1.filter((p) => !removed.has(p));

  const extras = session.items
    .filter((i) => i.action === 'ADD_EXTRA' && i.newUrl)
    .sort((a, b) => RESURVEY_SLOT_CODES.indexOf(a.slotCode) - RESURVEY_SLOT_CODES.indexOf(b.slotCode) || (a.extraIndex ?? 0) - (b.extraIndex ?? 0));
  if (extras.length > 0) {
    const parcel = vm.metadata?.projectParcelCode || vm.metadata?.buildingId || 'CHƯA_ĐỊNH_DANH';
    const unit = vm.metadata?.unitCode;
    const sample = list[0];
    const bySlot = new Map<ResurveySlotCode, ResurveyRenderItem[]>();
    for (const x of extras) bySlot.set(x.slotCode, [...(bySlot.get(x.slotCode) ?? []), x]);
    for (const [slot, slotExtras] of bySlot) {
      const existing = list.filter((p) => slotCodeOf(p.photoCode) === slot).length;
      const newItems: Appendix1PhotoItem[] = slotExtras.map((x, idx) => {
        const n = existing + idx + 1;
        const codes = extraPhotoCodes(slot, n);
        const label = SLOT_LABEL[slot];
        return {
          photoCode: codes.photoCode,
          name: slot === 'P-03'
            ? { vi: `${label.vi} (bổ sung #${idx + 1})`, en: `${label.en} (additional #${idx + 1})` }
            : { vi: `${label.vi} (#${n})`, en: `${label.en} (#${n})` },
          url: x.newUrl as string,
          base64: b64(x.newUrl as string, x.rotation),
          rotation: x.rotation,
          capturedAt: sample?.capturedAt || vm.metadata?.surveyDateFormatted || '',
          gpsCoords: sample?.gpsCoords || '',
          originalTag: codes.tag,
          metroPhotoCode: normalizeMetroPhotoCode(codes.tag, parcel, unit),
          watermarkDateTime: x.time2Text || vm.metadata?.surveyDateFormatted || '',
          alreadyWatermarked: false,
        };
      });
      let lastIdx = -1;
      list.forEach((p, idx) => {
        if (slotCodeOf(p.photoCode) === slot) lastIdx = idx;
      });
      const insertAt = lastIdx >= 0 ? lastIdx + 1 : list.length;
      list = [...list.slice(0, insertAt), ...newItems, ...list.slice(insertAt)];
      result.applied += newItems.length;
    }
  }

  vm.appendix1 = list;
}

/**
 * Áp mọi phiên đã duyệt lên ViewModel. `loadImages = false` dùng cho màn rà soát/chụp lại
 * (chỉ cần URL, không đọc file ảnh, không dựng lại mục lục).
 */
export async function applyResurveyToViewModel(
  vm: ReportViewModel,
  state: ResurveyRenderState | null,
  opts: { loadImages: boolean }
): Promise<ApplyResurveyResult> {
  const result: ApplyResurveyResult = { applied: 0, missed: [] };
  if (!state || state.sessions.length === 0) return result;

  if (opts.loadImages) {
    const items = state.sessions
      .flatMap((s) => s.items)
      .filter((i) => i.newUrl)
      .map((i) => ({ url: i.newUrl as string, rotation: i.rotation }));
    await ReportImageResolver.preloadAndResolveAll(items);
  }
  const b64 = (url: string, rot: number) => (opts.loadImages ? ReportImageResolver.resolveToBase64(url, rot) : '');

  for (const session of state.sessions) applySession(vm, session, b64, result);

  if (result.applied > 0) {
    vm.appendix1Pages = buildAppendix1Pages(vm.appendix1 || []);
    if (opts.loadImages && vm.metadata) {
      vm.tocPageNumbers = ScenarioFlagsAndTocMapper.calculateTocPageNumbers(
        vm.metadata,
        vm.appendix1Pages,
        vm.appendix2,
        vm.appendix3,
        vm.section12AsBuilt
      );
    }
  }
  if (result.missed.length > 0) {
    console.error('[PhotoResurveyRender:apply] Không tìm thấy ảnh gốc cho các thao tác đã duyệt, giữ ảnh đang in:', result.missed);
  }
  return result;
}
