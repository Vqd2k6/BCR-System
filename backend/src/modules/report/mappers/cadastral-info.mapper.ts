/**
 * ============================================================================
 * CADASTRAL INFO & IDENTIFIERS MAPPER
 * Chuẩn hóa các mã định danh pháp lý:
 * 1. Building ID: Hoán vị B-[5 chữ số]-[Segment] ([LocationCode])
 * 2. Report No: R-[5 chữ số]-[Segment]-([LocationCode])-R[XX]
 * 3. Filing No: Số: [STT]/BCS-P1/CRLG-[Năm]
 *
 * LocationCode:
 *  - Ga C&C  : C&C-nn → STnn (số thứ tự ga, VD C&C-04 / ZONE_07 Ga S4 Hòa Hưng → ST04)
 *  - Hầm TBM : POR-nn → PORnn (giữ nguyên số đoạn POR)
 *  - Depot   : DEP-nn → DEPnn
 * Nguồn chuẩn ánh xạ Zone → tiền tố: ZONE_SEGMENT_PREFIX_MAP.
 * ============================================================================
 */

import { ZONE_SEGMENT_PREFIX_MAP } from '../../../common/constants/zone-prefixes';

/** Mã vị trí trong ngoặc của Building ID / Report No. */
const LOCATION_CODE_IN_PARENS = /\((ST|POR|DEP)\s*(\d{1,2})\)/i;
const UNRESOLVED_LOCATION_CODE = 'ST00';

export class CadastralInfoMapper {
  public static formatBuildingId(
    rawCode: string,
    zoneId?: string,
    segmentType?: string
  ): string {
    if (!rawCode || typeof rawCode !== 'string') {
      return 'B-00000-C&C (ST00)';
    }

    let trimmed = rawCode.trim();
    trimmed = trimmed.replace(
      /\((ST|POR|DEP)\s*(\d{1,2})\)/gi,
      (_match: string, kind: string, digits: string) => `(${kind.toUpperCase()}${digits.padStart(2, '0')})`
    );

    if (/^B-\d{4,5}-[A-Za-z&]+(\s*\([^)]+\))?$/i.test(trimmed)) {
      if (!trimmed.includes('(') && zoneId) {
        const locationCode = CadastralInfoMapper.resolveStationCode(zoneId);
        return `${trimmed} (${locationCode})`;
      }
      return trimmed;
    }

    let bNumber = '00001';
    const bMatch = trimmed.match(/B-(\d+)/i) || trimmed.match(/(\d{3,5})/);
    if (bMatch) {
      bNumber = bMatch[1].padStart(5, '0');
    }

    let segment = 'C&C';
    if (segmentType) {
      segment = segmentType.toUpperCase();
    } else if (trimmed.toUpperCase().includes('TBM')) {
      segment = 'TBM';
    } else if (trimmed.toUpperCase().includes('C&C')) {
      segment = 'C&C';
    }

    // Mã thửa là định danh pháp lý gốc → ưu tiên tiền tố mã thửa; chỉ dùng zoneId khi mã thửa không mang tiền tố.
    const locationCode =
      CadastralInfoMapper.tryResolveLocationCode(trimmed) ??
      CadastralInfoMapper.resolveStationCode(zoneId || trimmed);

    return `B-${bNumber}-${segment} (${locationCode})`;
  }

  /**
   * Suy mã vị trí từ: mã thửa (C&C-04-B-0336 → ST04, POR-04-… → POR04, DEP-01-… → DEP01),
   * mã đã có trong ngoặc ((ST4) → ST04), số ga (4 → ST04), "ST5" → ST05,
   * hoặc mã Zone (ZONE_07 → C&C-04 → ST04).
   * Không suy được → log lỗi và trả ST00 (không bịa mã ga).
   */
  public static resolveStationCode(zoneIdOrString: string | number): string {
    const resolved = CadastralInfoMapper.tryResolveLocationCode(zoneIdOrString);
    if (resolved) return resolved;
    console.error(
      `[CadastralInfo:resolveStationCode] Không suy được mã ga/vị trí từ "${String(zoneIdOrString)}"`
    );
    return UNRESOLVED_LOCATION_CODE;
  }

  private static tryResolveLocationCode(input: string | number | undefined | null): string | undefined {
    const upper = String(input ?? '').trim().toUpperCase();
    if (!upper) return undefined;

    if (/^\d+$/.test(upper)) {
      const num = parseInt(upper, 10);
      return num >= 1 && num <= 11 ? `ST${String(num).padStart(2, '0')}` : undefined;
    }

    const fromPrefix = CadastralInfoMapper.locationCodeFromSegmentPrefix(upper);
    if (fromPrefix) return fromPrefix;

    const inParens = upper.match(LOCATION_CODE_IN_PARENS);
    if (inParens) return `${inParens[1]}${inParens[2].padStart(2, '0')}`;

    const bareSt = upper.match(/^ST_?(\d{1,2})$/);
    if (bareSt) return `ST${bareSt[1].padStart(2, '0')}`;

    const zoneMatch = upper.match(/ZONE[_-]?(\d{1,2})\b/);
    if (zoneMatch) {
      const meta = ZONE_SEGMENT_PREFIX_MAP[`ZONE_${zoneMatch[1].padStart(2, '0')}`];
      if (meta) return CadastralInfoMapper.locationCodeFromSegmentPrefix(meta.prefix);
    }

    return undefined;
  }

  /** "C&C-04…" → ST04, "POR-04…" → POR04, "DEP-01…" → DEP01. */
  private static locationCodeFromSegmentPrefix(upper: string): string | undefined {
    const m = upper.match(/^(C&C|CC|POR|DEP)-(\d{1,2})\b/);
    if (!m) return undefined;
    const num = m[2].padStart(2, '0');
    return m[1] === 'C&C' || m[1] === 'CC' ? `ST${num}` : `${m[1]}${num}`;
  }

  public static formatReportNo(
    buildingId: string,
    parcelCode?: string,
    segmentType?: string,
    zoneId?: string,
    revision: string = '00'
  ): string {
    const srcCode = parcelCode || buildingId;
    const numMatch = srcCode.match(/(?:B-)?(\d{3,5})/i);
    const seq = numMatch ? numMatch[1].padStart(5, '0') : '00001';

    let seg = (segmentType || '').toUpperCase();
    if (!seg || !['C&C', 'POR', 'ELV', 'DEP'].includes(seg)) {
      if (srcCode.includes('C&C') || srcCode.includes('CC')) seg = 'C&C';
      else if (srcCode.includes('POR') || srcCode.includes('TBM')) seg = 'POR';
      else if (srcCode.includes('ELV')) seg = 'ELV';
      else if (srcCode.includes('DEP')) seg = 'DEP';
      else seg = 'C&C';
    }

    // Đồng bộ 1:1 với mã vị trí đã in trên Building ID; chỉ suy lại khi Building ID không mang mã.
    const fromBuildingId = buildingId.match(LOCATION_CODE_IN_PARENS);
    const locationCode = fromBuildingId
      ? `${fromBuildingId[1].toUpperCase()}${fromBuildingId[2].padStart(2, '0')}`
      : (CadastralInfoMapper.tryResolveLocationCode(parcelCode) ??
         CadastralInfoMapper.resolveStationCode(zoneId || ''));

    const revClean = revision.replace(/\D/g, '') || '0';
    const revStr = revClean.padStart(2, '0');

    return `R-${seq}-${seg}-(${locationCode})-R${revStr}`;
  }

  public static formatFilingNo(buildingId: string, year: number = 2026): string {
    const numMatch = buildingId.match(/B-(\d+)/i);
    const seq = numMatch ? numMatch[1].padStart(5, '0') : '00001';
    return `Số: ${seq}/BCS-P1/CRLG-${year}`;
  }
}
