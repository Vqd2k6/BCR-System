/**
 * ============================================================================
 * CADASTRAL INFO & IDENTIFIERS MAPPER
 * Chuẩn hóa các mã định danh pháp lý:
 * 1. Building ID: Hoán vị B-[5 chữ số]-[Segment] ([StationCode])
 * 2. Report No: REPORT-[BuildingID]-PHASE1-[Timestamp] (Rev. [XX])
 * 3. Filing No: Số: [STT]/BCS-P1/CRLG-[Năm]
 * ============================================================================
 */

export class CadastralInfoMapper {
  /**
   * Hoán chuyển mã thửa thành Building ID chuẩn Metro 2:
   * Ví dụ:
   *   "C&C-01-B-0081" -> "B-00081-C&C (ST1)"
   *   "TBM-09-B-01064" -> "B-01064-C&C (ST5)" (hoặc giữ ST theo zone)
   *   "B-01064-C&C" -> "B-01064-C&C (ST5)"
   */
  public static formatBuildingId(
    rawCode: string,
    zoneId?: string,
    segmentType?: string
  ): string {
    if (!rawCode || typeof rawCode !== 'string') {
      return 'B-00000-C&C (ST0)';
    }

    const trimmed = rawCode.trim();

    // Nếu đã có định dạng hoàn chỉnh B-XXXXX-SEG (STX) thì giữ nguyên
    if (/^B-\d{4,5}-[A-Za-z&]+(\s*\([^)]+\))?$/i.test(trimmed)) {
      if (!trimmed.includes('(') && zoneId) {
        const stationCode = CadastralInfoMapper.resolveStationCode(zoneId);
        return `${trimmed} (${stationCode})`;
      }
      return trimmed;
    }

    // Tách số thứ tự B-XXXX
    let bNumber = '00001';
    const bMatch = trimmed.match(/B-(\d+)/i) || trimmed.match(/(\d{3,5})/);
    if (bMatch) {
      bNumber = bMatch[1].padStart(5, '0');
    }

    // Tách segment (C&C, TBM, STATION)
    let segment = 'C&C';
    if (segmentType) {
      segment = segmentType.toUpperCase();
    } else if (trimmed.toUpperCase().includes('TBM')) {
      segment = 'TBM';
    } else if (trimmed.toUpperCase().includes('C&C')) {
      segment = 'C&C';
    }

    // Tách Station Code từ zoneId (ZONE_01 -> ST1, ZONE_09 -> ST5/ST9)
    const stationCode = CadastralInfoMapper.resolveStationCode(zoneId || trimmed);

    return `B-${bNumber}-${segment} (${stationCode})`;
  }

  /**
   * Ánh xạ Zone ID sang Station code kỹ thuật
   */
  public static resolveStationCode(zoneIdOrString: string): string {
    const upper = (zoneIdOrString || '').toUpperCase();
    if (upper.includes('ZONE_01') || upper.includes('ZONE-01') || upper.includes('S1.01')) return 'ST1';
    if (upper.includes('ZONE_02') || upper.includes('ZONE-02')) return 'ST2';
    if (upper.includes('ZONE_03') || upper.includes('ZONE-03')) return 'ST3';
    if (upper.includes('ZONE_04') || upper.includes('ZONE-04')) return 'ST4';
    if (upper.includes('ZONE_05') || upper.includes('ZONE-05')) return 'ST5';
    if (upper.includes('ZONE_06') || upper.includes('ZONE-06')) return 'ST6';
    if (upper.includes('ZONE_07') || upper.includes('ZONE-07')) return 'ST7';
    if (upper.includes('ZONE_08') || upper.includes('ZONE-08')) return 'ST8';
    if (upper.includes('ZONE_09') || upper.includes('ZONE-09')) return 'ST5'; // Thường gắn phân đoạn ga S1.05
    if (upper.includes('ZONE_10') || upper.includes('ZONE-10')) return 'ST10';

    const matchNum = upper.match(/ZONE_?(\d+)/);
    if (matchNum) {
      return `ST${parseInt(matchNum[1], 10)}`;
    }

    return 'ST1';
  }

  /**
   * Sinh số hiệu báo cáo hệ thống chuẩn hóa (Doc.No / Report No.):
   * R-00054-C&C-(ST05)-R00
   */
  public static formatReportNo(
    buildingId: string,
    parcelCode?: string,
    segmentType?: string,
    zoneId?: string,
    revision: string = '00'
  ): string {
    // 1. Trích xuất số thứ tự 5 chữ số từ parcelCode hoặc buildingId: "C&C-05-B-0054" -> "00054"
    const srcCode = parcelCode || buildingId;
    const numMatch = srcCode.match(/(?:B-)?(\d{3,5})/i);
    const seq = numMatch ? numMatch[1].padStart(5, '0') : '00001';

    // 2. Loại hình thi công Metro: C&C, POR, ELV, DEP
    let seg = (segmentType || '').toUpperCase();
    if (!seg || !['C&C', 'POR', 'ELV', 'DEP'].includes(seg)) {
      if (srcCode.includes('C&C') || srcCode.includes('CC')) seg = 'C&C';
      else if (srcCode.includes('POR') || srcCode.includes('TBM')) seg = 'POR';
      else if (srcCode.includes('ELV')) seg = 'ELV';
      else if (srcCode.includes('DEP')) seg = 'DEP';
      else seg = 'C&C';
    }

    // 3. Mã trạm/ga phân đoạn: ST05
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

    // 4. Phiên bản báo cáo: R00, R01
    const revClean = revision.replace(/\D/g, '') || '0';
    const revStr = revClean.padStart(2, '0');

    return `R-${seq}-${seg}-(${stCode})-R${revStr}`;
  }

  /**
   * Sinh số No. lưu chiểu văn bản giấy: Số: 01064/BCS-P1/CRLG-2026
   */
  public static formatFilingNo(buildingId: string, year: number = 2026): string {
    const numMatch = buildingId.match(/B-(\d+)/i);
    const seq = numMatch ? numMatch[1].padStart(5, '0') : '00001';
    return `Số: ${seq}/BCS-P1/CRLG-${year}`;
  }
}
