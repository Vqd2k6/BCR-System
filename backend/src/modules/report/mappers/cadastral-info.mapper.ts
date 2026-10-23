/**
 * ============================================================================
 * CADASTRAL INFO & IDENTIFIERS MAPPER
 * Chuẩn hóa các mã định danh pháp lý:
 * 1. Building ID: Hoán vị B-[5 chữ số]-[Segment] ([StationCode])
 * 2. Report No: R-[5 chữ số]-[Segment]-([StationCode])-R[XX]
 * 3. Filing No: Số: [STT]/BCS-P1/CRLG-[Năm]
 * ============================================================================
 */

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
    trimmed = trimmed.replace(/\(ST(\d)\)/gi, (_, d) => `(ST0${d})`);

    if (/^B-\d{4,5}-[A-Za-z&]+(\s*\([^)]+\))?$/i.test(trimmed)) {
      if (!trimmed.includes('(') && zoneId) {
        const stationCode = CadastralInfoMapper.resolveStationCode(zoneId);
        return `${trimmed} (${stationCode})`;
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

    const stationCode = CadastralInfoMapper.resolveStationCode(zoneId || trimmed);

    return `B-${bNumber}-${segment} (${stationCode})`;
  }

  public static resolveStationCode(zoneIdOrString: string | number): string {
    const upper = String(zoneIdOrString || '').trim().toUpperCase();
    if (/^\d+$/.test(upper)) {
      const num = parseInt(upper, 10);
      if (num >= 1 && num <= 20) return `ST${String(num).padStart(2, '0')}`;
    }
    if (upper.includes('ZONE_01') || upper.includes('ZONE-01') || upper.includes('S1.01') || upper.includes('(ST1)') || upper.includes('(ST01)')) return 'ST01';
    if (upper.includes('ZONE_02') || upper.includes('ZONE-02') || upper.includes('(ST2)') || upper.includes('(ST02)')) return 'ST02';
    if (upper.includes('ZONE_03') || upper.includes('ZONE-03') || upper.includes('(ST3)') || upper.includes('(ST03)')) return 'ST03';
    if (upper.includes('ZONE_04') || upper.includes('ZONE-04') || upper.includes('(ST4)') || upper.includes('(ST04)')) return 'ST04';
    if (upper.includes('ZONE_05') || upper.includes('ZONE-05') || upper.includes('(ST5)') || upper.includes('(ST05)')) return 'ST05';
    if (upper.includes('ZONE_06') || upper.includes('ZONE-06') || upper.includes('(ST6)') || upper.includes('(ST06)')) return 'ST06';
    if (upper.includes('ZONE_07') || upper.includes('ZONE-07') || upper.includes('(ST7)') || upper.includes('(ST07)')) return 'ST07';
    if (upper.includes('ZONE_08') || upper.includes('ZONE-08') || upper.includes('(ST8)') || upper.includes('(ST08)')) return 'ST08';
    if (upper.includes('ZONE_09') || upper.includes('ZONE-09')) return 'ST05';
    if (upper.includes('ZONE_10') || upper.includes('ZONE-10') || upper.includes('(ST10)')) return 'ST10';

    const matchSt = upper.match(/ST_?(\d+)/);
    if (matchSt) {
      return `ST${String(parseInt(matchSt[1], 10)).padStart(2, '0')}`;
    }

    const matchNum = upper.match(/ZONE_?(\d+)/);
    if (matchNum) {
      return `ST${String(parseInt(matchNum[1], 10)).padStart(2, '0')}`;
    }

    return 'ST01';
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

    let stCode = 'ST05';
    const matchSt = buildingId.match(/ST(\d+)/i) || (zoneId ? zoneId.match(/ZONE_?(\d+)/i) : null);
    if (matchSt) {
      const stNum = parseInt(matchSt[1], 10);
      stCode = `ST${String(stNum).padStart(2, '0')}`;
    } else {
      const rawSt = this.resolveStationCode(zoneId || '');
      const rawNum = rawSt.replace(/\D/g, '');
      stCode = rawNum ? `ST${rawNum.padStart(2, '0')}` : 'ST05';
    }

    const revClean = revision.replace(/\D/g, '') || '0';
    const revStr = revClean.padStart(2, '0');

    return `R-${seq}-${seg}-(${stCode})-R${revStr}`;
  }

  public static formatFilingNo(buildingId: string, year: number = 2026): string {
    const numMatch = buildingId.match(/B-(\d+)/i);
    const seq = numMatch ? numMatch[1].padStart(5, '0') : '00001';
    return `Số: ${seq}/BCS-P1/CRLG-${year}`;
  }
}

