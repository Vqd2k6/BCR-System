/**
 * Quy chuẩn Chuẩn Hóa Thông Tin Địa Chỉ Thửa Đất - Metro Line 2 (Bến Thành - Tham Lương)
 * Căn cứ: NQ 1111/NQ-UBTVQH14 (2020) -> NQ 1278/NQ-UBTVQH15 (2024) -> NQ 1685/NQ-UBTVQH15 (2025).
 *
 * BẢN GỐC Ở BACKEND: backend/src/modules/audit/utils/residential-address.standards.ts
 * BẢN MIRROR Ở FRONTEND: frontend/src/features/zone-management/components/review-queue/stepwise/utils/residentialAddressStandards.ts
 * Hai file phải giống nhau từng dòng (trừ khối chú thích đầu file).
 *
 * Nguyên tắc pháp lý: KHÔNG đoán. Phường không khớp quy tắc của đúng quận thì giữ nguyên;
 * ô đường bị nhiễm tên phường mà không có nguồn KSV thì để trống, buộc người dùng nhập tay.
 */

export interface AddressEvaluationResult {
  isCompliant: boolean;
  hasAnomalies: boolean;
  anomalyReasons: string[];
  isContaminated: boolean; // Tên đường bị gán nhầm thành tên phường
  /** Không xác định được tên đường từ dữ liệu sẵn có, người dùng phải nhập tay */
  requiresManualStreet: boolean;
  /** Ô số nhà chứa nhiều số / ghi chú, không tự tách được an toàn */
  requiresManualHouseNumber: boolean;
  /** Phường cũ bị chia tách cho nhiều phường mới (P.4 Q3, P.14 Q10) */
  isSplitWard: boolean;
  splitWardCandidates: string[];
  /** Danh sách tuyến đường gợi ý theo phân khu (chỉ để chọn, không tự điền) */
  suggestedStreetOptions: string[];
  khuPho: string;
  current: {
    houseNumber: string;
    street: string;
    ward: string;
    district: string;
  };
  suggested: {
    houseNumber: string;
    street: string;
    ward: string;
    district: string;
    mergerNote?: string;
  };
  diffCount: number;
}

export type DistrictKey = 'Q1' | 'Q3' | 'Q10' | 'TAN_BINH';

export interface WardMergerRule {
  key: string;
  targetWard: string;
  targetDistrict: string;
  districtKey: DistrictKey;
  /** Số hiệu phường cũ trong đúng quận (sau khi đã quy đổi các đợt sáp nhập trước) */
  formerWardNumbers: number[];
  formerWards: string[];
  mergerNote: string;
  /** Mẫu nhận diện theo TÊN phường, so trên chuỗi ĐÃ BỎ DẤU (foldVietnamese) để chịu được "Hoà"/"Hòa" */
  patterns: RegExp[];
}

export interface SplitWardRule {
  districtKey: DistrictKey;
  wardNumber: number;
  candidates: string[];
  note: string;
}

export const METRO2_WARD_MERGER_RULES: WardMergerRule[] = [
  // Quận 3 — P.10 nhập P.9, P.13 nhập P.12 (NQ 1278, 01/01/2025); sau đó 9, 11, 12, 14 -> Nhiêu Lộc (NQ 1685)
  {
    key: 'NHIEU_LOC',
    targetWard: 'Phường Nhiêu Lộc',
    targetDistrict: 'Quận 3',
    districtKey: 'Q3',
    formerWardNumbers: [9, 10, 11, 12, 13, 14],
    formerWards: ['Phường 9', 'Phường 10', 'Phường 11', 'Phường 12', 'Phường 13', 'Phường 14'],
    mergerNote: 'NQ 1685: Phường Nhiêu Lộc gồm P.9, 11, 12, 14 Quận 3 (P.10 đã nhập P.9, P.13 đã nhập P.12 theo NQ 1278)',
    patterns: [/nhieu\s*loc/],
  },
  // Quận 3 — P.6, 7, 8 -> Võ Thị Sáu (NQ 1111); Võ Thị Sáu + một phần P.4 -> Xuân Hòa (NQ 1685)
  {
    key: 'XUAN_HOA',
    targetWard: 'Phường Xuân Hòa',
    targetDistrict: 'Quận 3',
    districtKey: 'Q3',
    formerWardNumbers: [6, 7, 8],
    formerWards: ['Phường Võ Thị Sáu', 'Phường 6', 'Phường 7', 'Phường 8'],
    mergerNote: 'NQ 1685: Phường Xuân Hòa gồm P. Võ Thị Sáu (P.6, 7, 8 cũ theo NQ 1111) và một phần P.4 Quận 3',
    patterns: [/xuan\s*hoa/, /vo\s*thi\s*sau/],
  },
  // Quận 3 — P.1, 2, 3, 5 + một phần P.4 -> Bàn Cờ
  {
    key: 'BAN_CO',
    targetWard: 'Phường Bàn Cờ',
    targetDistrict: 'Quận 3',
    districtKey: 'Q3',
    formerWardNumbers: [1, 2, 3, 5],
    formerWards: ['Phường 1', 'Phường 2', 'Phường 3', 'Phường 5'],
    mergerNote: 'NQ 1685: Phường Bàn Cờ gồm P.1, 2, 3, 5 và một phần P.4 Quận 3',
    patterns: [/ban\s*co\b/],
  },
  // Quận 10 — P.12, 13, 15 + một phần P.14 -> Hòa Hưng
  {
    key: 'HOA_HUNG',
    targetWard: 'Phường Hòa Hưng',
    targetDistrict: 'Quận 10',
    districtKey: 'Q10',
    formerWardNumbers: [12, 13, 15],
    formerWards: ['Phường 12', 'Phường 13', 'Phường 15'],
    mergerNote: 'NQ 1685: Phường Hòa Hưng gồm P.12, 13, 15 và một phần P.14 Quận 10',
    patterns: [/hoa\s*hung/, /hoan\s*hung/, /\bp\.?hh\b/],
  },
  // Quận Tân Bình
  {
    key: 'TAN_HOA',
    targetWard: 'Phường Tân Hòa',
    targetDistrict: 'Quận Tân Bình',
    districtKey: 'TAN_BINH',
    formerWardNumbers: [6, 8, 9],
    formerWards: ['Phường 6', 'Phường 8', 'Phường 9'],
    mergerNote: 'NQ 1685: Phường Tân Hòa gồm P.6, 8, 9 Quận Tân Bình',
    patterns: [/tan\s*hoa/],
  },
  {
    key: 'TAN_SON_NHAT',
    targetWard: 'Phường Tân Sơn Nhất',
    targetDistrict: 'Quận Tân Bình',
    districtKey: 'TAN_BINH',
    formerWardNumbers: [4, 5, 7],
    formerWards: ['Phường 4', 'Phường 5', 'Phường 7'],
    mergerNote: 'NQ 1685: Phường Tân Sơn Nhất gồm P.4, 5, 7 Quận Tân Bình',
    patterns: [/tan\s*son\s*nhat/],
  },
  {
    key: 'BAY_HIEN',
    targetWard: 'Phường Bảy Hiền',
    targetDistrict: 'Quận Tân Bình',
    districtKey: 'TAN_BINH',
    formerWardNumbers: [10, 11, 12],
    formerWards: ['Phường 10', 'Phường 11', 'Phường 12'],
    mergerNote: 'NQ 1685: Phường Bảy Hiền gồm P.10, 11, 12 Quận Tân Bình',
    patterns: [/bay\s*hien/],
  },
];

/** Phường cũ bị chia cho nhiều phường mới: không tự quy đổi, người dùng xác định theo thực địa. */
export const METRO2_SPLIT_WARD_RULES: SplitWardRule[] = [
  {
    districtKey: 'Q3',
    wardNumber: 4,
    candidates: ['Phường Xuân Hòa', 'Phường Bàn Cờ'],
    note: 'P.4 Quận 3 bị chia cho Phường Xuân Hòa và Phường Bàn Cờ (NQ 1685)',
  },
  {
    districtKey: 'Q10',
    wardNumber: 14,
    candidates: ['Phường Hòa Hưng'],
    note: 'P.14 Quận 10 chỉ một phần nhập Phường Hòa Hưng (NQ 1685), phần còn lại thuộc phường khác',
  },
];

export const METRO2_STREET_CANONICAL_MAP: Record<string, string> = {
  'cmt8': 'Cách Mạng Tháng Tám',
  'cmt 8': 'Cách Mạng Tháng Tám',
  'cách mạng tháng 8': 'Cách Mạng Tháng Tám',
  'cách mạng tháng tám': 'Cách Mạng Tháng Tám',
  'đường cách mạng tháng 8': 'Cách Mạng Tháng Tám',
  'đường cách mạng tháng tám': 'Cách Mạng Tháng Tám',
  'đ. cmt8': 'Cách Mạng Tháng Tám',
  'đ.cmt8': 'Cách Mạng Tháng Tám',

  'bắc hải': 'Bắc Hải',
  'bác hải': 'Bắc Hải',
  'đ.bắc hải': 'Bắc Hải',
  'đ. bắc hải': 'Bắc Hải',
  'đường bắc hải': 'Bắc Hải',
  'đường bác hải': 'Bắc Hải',
  'đ. bh': 'Bắc Hải',
  'đ . bh': 'Bắc Hải',
  'đ.bh': 'Bắc Hải',
  'bh': 'Bắc Hải',

  'trường sơn': 'Trường Sơn',
  'đường trường sơn': 'Trường Sơn',
  'đ . trường sơn': 'Trường Sơn',
  'đ. trường sơn': 'Trường Sơn',
  'đ.trường sơn': 'Trường Sơn',

  'trường chinh': 'Trường Chinh',
  'đường trường chinh': 'Trường Chinh',
  'tc': 'Trường Chinh',
  'đ. tc': 'Trường Chinh',
  'đ.tc': 'Trường Chinh',

  'lý thường kiệt': 'Lý Thường Kiệt',
  'đường lý thường kiệt': 'Lý Thường Kiệt',
  'ltk': 'Lý Thường Kiệt',
  'đ. ltk': 'Lý Thường Kiệt',

  'phạm văn hai': 'Phạm Văn Hai',
  'đường phạm văn hai': 'Phạm Văn Hai',
  'pvh': 'Phạm Văn Hai',

  'hoàng văn thụ': 'Hoàng Văn Thụ',
  'đường hoàng văn thụ': 'Hoàng Văn Thụ',
  'hvt': 'Hoàng Văn Thụ',

  'lê thị riêng': 'Lê Thị Riêng',
  'đường lê thị riêng': 'Lê Thị Riêng',
  'ltr': 'Lê Thị Riêng',

  'lý tự trọng': 'Lý Tự Trọng',
  'lê thánh tôn': 'Lê Thánh Tôn',
  'phạm hồng thái': 'Phạm Hồng Thái',
  'nguyễn thị minh khai': 'Nguyễn Thị Minh Khai',
  'trương định': 'Trương Định',
  'sương nguyệt ánh': 'Sương Nguyệt Ánh',
  'võ văn tần': 'Võ Văn Tần',
  'nguyễn đình chiểu': 'Nguyễn Đình Chiểu',
  'điện biên phủ': 'Điện Biên Phủ',
  'ngô thời nhiệm': 'Ngô Thời Nhiệm',
  'trần hưng đạo': 'Trần Hưng Đạo',
  'phó đức chính': 'Phó Đức Chính',
  'hồ xuân hương': 'Hồ Xuân Hương',
  'bùi thị xuân': 'Bùi Thị Xuân',
  'nguyễn trãi': 'Nguyễn Trãi',
  'tú xương': 'Tú Xương',
  'chấn hưng': 'Chấn Hưng',
  'tôn thất tùng': 'Tôn Thất Tùng',
  'tô hiến thành': 'Tô Hiến Thành',
  'rạch bùng binh': 'Rạch Bùng Binh',
  'hoàng sa': 'Hoàng Sa',
};

/**
 * Gợi ý tuyến đường theo phân khu: CHỈ dùng làm danh sách chọn, không bao giờ tự điền.
 * Key theo zone_id thật (ZONE_0X) và key cũ theo ga (S1..S7) để tương thích.
 * ZONE_02/03 = ST02 Tao Đàn, ZONE_04/07 = ST04 Hòa Hưng, ZONE_09 = ST05 (theo zoneAliases của cadastral.service).
 */
export const ZONE_SUGGESTED_STREETS: Record<string, string[]> = {
  ZONE_01: ['Cách Mạng Tháng Tám', 'Lý Tự Trọng', 'Lê Thị Riêng', 'Lê Thánh Tôn', 'Phạm Hồng Thái', 'Nguyễn Thị Minh Khai'],
  ZONE_02: ['Cách Mạng Tháng Tám', 'Lê Thị Riêng', 'Nguyễn Thị Minh Khai', 'Sương Nguyệt Ánh', 'Tôn Thất Tùng', 'Lý Tự Trọng'],
  ZONE_03: ['Cách Mạng Tháng Tám', 'Lê Thị Riêng', 'Nguyễn Thị Minh Khai', 'Sương Nguyệt Ánh', 'Tôn Thất Tùng', 'Lý Tự Trọng'],
  ZONE_04: ['Cách Mạng Tháng Tám'],
  ZONE_07: ['Cách Mạng Tháng Tám'],
  ZONE_09: ['Cách Mạng Tháng Tám', 'Bắc Hải', 'Trường Sơn', 'Tô Hiến Thành'],
  'S6': ['Cách Mạng Tháng Tám', 'Phạm Văn Hai', 'Rạch Bùng Binh', 'Hoàng Sa'],
  'ZONE-S6': ['Cách Mạng Tháng Tám', 'Phạm Văn Hai', 'Rạch Bùng Binh', 'Hoàng Sa'],
  'S7': ['Cách Mạng Tháng Tám', 'Bắc Hải', 'Trường Sơn', 'Trường Chinh', 'Lý Thường Kiệt', 'Hoàng Văn Thụ'],
  'ZONE-S7': ['Cách Mạng Tháng Tám', 'Bắc Hải', 'Trường Sơn', 'Trường Chinh', 'Lý Thường Kiệt', 'Hoàng Văn Thụ'],
  'S5': ['Cách Mạng Tháng Tám', 'Bắc Hải', 'Trường Sơn', 'Tô Hiến Thành'],
  'ZONE-S5': ['Cách Mạng Tháng Tám', 'Bắc Hải', 'Trường Sơn', 'Tô Hiến Thành'],
  'S1': ['Cách Mạng Tháng Tám', 'Lý Tự Trọng', 'Lê Thị Riêng', 'Lê Thánh Tôn', 'Phạm Hồng Thái', 'Nguyễn Thị Minh Khai'],
  'ZONE-S1': ['Cách Mạng Tháng Tám', 'Lý Tự Trọng', 'Lê Thị Riêng', 'Lê Thánh Tôn', 'Phạm Hồng Thái', 'Nguyễn Thị Minh Khai'],
  'DEFAULT': [
    'Cách Mạng Tháng Tám',
    'Bắc Hải',
    'Trường Sơn',
    'Trường Chinh',
    'Lý Thường Kiệt',
    'Phạm Văn Hai',
    'Lê Thị Riêng',
  ],
};

export function standardizeHouseNumber(rawHn?: string | null): { houseNumber: string; extractedStreet?: string } {
  if (!rawHn || typeof rawHn !== 'string') return { houseNumber: '' };

  let val = rawHn.trim();
  val = val.replace(/^số\s+/i, '').trim();

  let extractedStreet: string | undefined;
  const embeddedStreetMatch = val.match(/^([0-9]+[A-Za-z0-9\/\,\.\-]*)\s+([A-Za-z\u00C0-\u024F\u1E00-\u1EFF].*)$/);
  if (embeddedStreetMatch) {
    val = embeddedStreetMatch[1];
    extractedStreet = embeddedStreetMatch[2].trim();
  }

  val = val.replace(/([0-9A-Za-z]+),([0-9A-Za-z]+)/g, '$1/$2');
  val = val.replace(/([0-9]+|\/)([a-z])\b/g, (_match, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
  val = val.replace(/\b([a-z])\b/g, (match) => match.toUpperCase());

  return { houseNumber: val.trim(), extractedStreet };
}

export function isStreetContaminatedWithWard(street?: string | null): boolean {
  if (!street || typeof street !== 'string') return false;
  const s = street.trim().toLowerCase();
  if (s.startsWith('phường ') || s.startsWith('p. ') || s.startsWith('p.') || s.startsWith('xã ')) {
    return true;
  }
  return /^ph[uư][oờ]ng\s+[0-9a-z\u00C0-\u024F\u1E00-\u1EFF]+/i.test(s);
}

export function standardizeStreet(rawStreet?: string | null, hasAlleyInHouseNumber = false): {
  street: string;
  isContaminated: boolean;
  formerAlleyPrefix?: string;
} {
  if (!rawStreet || typeof rawStreet !== 'string') return { street: '', isContaminated: false };

  let val = rawStreet.trim();

  const isContaminated = isStreetContaminatedWithWard(val);
  if (isContaminated) {
    return { street: val, isContaminated: true };
  }

  val = val.replace(/,\s*(?:p\.?|phường)\s*.*$/i, '').trim();
  val = val.replace(/\bhảm\b/gi, 'Hẻm');

  let formerAlleyPrefix: string | undefined;
  const alleyMatch = val.match(/^(?:h[eẻ]m\s+[0-9]+[A-Za-z]?\s+)(.+)$/i);
  if (alleyMatch && (hasAlleyInHouseNumber || val.toLowerCase().includes('cách mạng') || val.toLowerCase().includes('cmt8'))) {
    formerAlleyPrefix = val.substring(0, val.length - alleyMatch[1].length).trim();
    val = alleyMatch[1].trim();
  }

  val = val.replace(/^(?:đường|đ\.|đ\s*\.)\s+/i, '').trim();

  const lower = val.toLowerCase().replace(/\s+/g, ' ');
  if (METRO2_STREET_CANONICAL_MAP[lower]) {
    val = METRO2_STREET_CANONICAL_MAP[lower];
  } else {
    val = val
      .split(' ')
      .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''))
      .join(' ');
  }

  return { street: val, isContaminated: false, formerAlleyPrefix };
}

// ---------------------------------------------------------------------------
// QUẬN & PHƯỜNG
// ---------------------------------------------------------------------------

/** Bỏ dấu tiếng Việt + chữ thường, dùng cho so khớp không phân biệt dấu. */
export function foldVietnamese(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export function detectDistrictKey(districtHint?: string | null): DistrictKey | null {
  if (!districtHint || typeof districtHint !== 'string') return null;
  const folded = foldVietnamese(districtHint).replace(/\s+/g, ' ').trim();
  if (!folded) return null;
  if (/tan\s*binh/.test(folded)) return 'TAN_BINH';
  const m = folded.match(/^(?:quan|q)?\s*\.?\s*0*(\d{1,2})$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (n === 1) return 'Q1';
  if (n === 3) return 'Q3';
  if (n === 10) return 'Q10';
  return null;
}

const DISTRICT_LABEL: Record<DistrictKey, string> = {
  Q1: 'Quận 1',
  Q3: 'Quận 3',
  Q10: 'Quận 10',
  TAN_BINH: 'Quận Tân Bình',
};

const extractWardNumber = (clean: string): number | null => {
  const m = foldVietnamese(clean).match(/^(?:phuong|p)?\s*\.?\s*0*(\d{1,2})$/);
  return m ? Number(m[1]) : null;
};

export function standardizeWard(rawWard?: string | null, districtHint?: string | null): {
  ward: string;
  district: string;
  mergerNote?: string;
  isMatched: boolean;
  isSplitWard: boolean;
  splitCandidates: string[];
} {
  if (!rawWard || typeof rawWard !== 'string') {
    return { ward: '', district: districtHint || '', isMatched: false, isSplitWard: false, splitCandidates: [] };
  }

  const clean = rawWard.trim().replace(/\s+/g, ' ');
  const districtKey = detectDistrictKey(districtHint);

  // 1. Khớp theo TÊN phường (tên là duy nhất trên toàn tuyến), so trên chuỗi đã bỏ dấu
  const foldedWard = foldVietnamese(clean);
  for (const rule of METRO2_WARD_MERGER_RULES) {
    if (rule.patterns.some((pat) => pat.test(foldedWard))) {
      return {
        ward: rule.targetWard,
        district: rule.targetDistrict,
        mergerNote: rule.mergerNote,
        isMatched: true,
        isSplitWard: false,
        splitCandidates: [],
      };
    }
  }

  // 2. Khớp theo SỐ phường cũ: bắt buộc biết quận, chỉ xét quy tắc của đúng quận đó
  const wardNumber = extractWardNumber(clean);
  if (wardNumber !== null) {
    if (districtKey) {
      const split = METRO2_SPLIT_WARD_RULES.find((s) => s.districtKey === districtKey && s.wardNumber === wardNumber);
      if (split) {
        return {
          ward: `Phường ${wardNumber}`,
          district: DISTRICT_LABEL[districtKey],
          mergerNote: split.note,
          isMatched: false,
          isSplitWard: true,
          splitCandidates: [...split.candidates],
        };
      }
      const rule = METRO2_WARD_MERGER_RULES.find(
        (r) => r.districtKey === districtKey && r.formerWardNumbers.includes(wardNumber)
      );
      if (rule) {
        return {
          ward: rule.targetWard,
          district: rule.targetDistrict,
          mergerNote: rule.mergerNote,
          isMatched: true,
          isSplitWard: false,
          splitCandidates: [],
        };
      }
    }
    // Không có quận hoặc quận không có quy tắc cho số phường này: giữ nguyên, KHÔNG đoán sang quận khác
    return {
      ward: `Phường ${wardNumber}`,
      district: districtHint ? districtHint.trim() : '',
      isMatched: false,
      isSplitWard: false,
      splitCandidates: [],
    };
  }

  // 3. Không nhận diện được: chỉ chuẩn hóa định dạng
  let w = clean;
  w = w.replace(/^(?:phường\s+|p\.\s*|p(?=\s|\d)|phường)/i, '').trim();
  const finalWard = w ? (w.toLowerCase().startsWith('phường') ? w : `Phường ${w}`) : '';

  return {
    ward: finalWard,
    district: districtHint ? districtHint.trim() : '',
    isMatched: false,
    isSplitWard: false,
    splitCandidates: [],
  };
}

// ---------------------------------------------------------------------------
// TÁCH ĐỊA CHỈ KSV NHẬP TỰ DO
// KSV thường gộp "đường, khu phố, phường" vào ô Tuyến đường và ghi tên đường vào ô Số nhà.
// ---------------------------------------------------------------------------

const KNOWN_STREETS: string[] = Array.from(
  new Set(Object.values(METRO2_STREET_CANONICAL_MAP))
);

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const STREET_DETECTORS: Array<{ name: string; re: RegExp }> = [
  { name: 'Cách Mạng Tháng Tám', re: /cach\s*mang\s*thang\s*(?:tam|8)|\bc\.?\s*m\.?\s*t\.?\s*8/g },
  ...KNOWN_STREETS.filter((name) => name !== 'Cách Mạng Tháng Tám').map((name) => ({
    name,
    re: new RegExp(`\\b${foldVietnamese(name).split(/\s+/).map(escapeRegex).join('\\s*')}\\b`, 'g'),
  })),
];

const WARD_MENTION_DETECTORS: Array<{ ward: string; re: RegExp }> = [
  { ward: 'Phường Nhiêu Lộc', re: /nhieu\s*loc/g },
  { ward: 'Phường Hòa Hưng', re: /hoa\s*hung|hoan\s*hung/g },
  { ward: 'Phường Bàn Cờ', re: /ban\s*co\b/g },
  { ward: 'Phường Xuân Hòa', re: /xuan\s*hoa|vo\s*thi\s*sau/g },
  { ward: 'Phường Bến Thành', re: /ben\s*thanh/g },
  { ward: 'Phường Tân Hòa', re: /tan\s*hoa/g },
  { ward: 'Phường Tân Sơn Nhất', re: /tan\s*son\s*nhat/g },
  { ward: 'Phường Bảy Hiền', re: /bay\s*hien/g },
];

const KHU_PHO_RE = /\b(?:kp|k\.\s*p|khu\s*pho)[\s.,]*(\d+)/g;

export interface ParsedSurveyorAddress {
  houseNumber: string;
  street: string;
  /** Có nhiều tên đường khác nhau trong văn bản */
  hasMultipleStreets: boolean;
  wardMention: string;
  hasMultipleWardMentions: boolean;
  khuPho: string;
  requiresManualHouseNumber: boolean;
}

const findAll = (text: string, re: RegExp): RegExpMatchArray[] => Array.from(text.matchAll(new RegExp(re.source, 'g')));

export function parseSurveyorAddress(
  houseNumberText?: string | null,
  streetText?: string | null,
  wardText?: string | null
): ParsedSurveyorAddress {
  const hnRaw = (houseNumberText || '').normalize('NFC').trim().replace(/^số\s+/i, '');
  const combined = foldVietnamese([hnRaw, streetText || '', wardText || ''].join(' , '));

  const streets = new Set<string>();
  for (const det of STREET_DETECTORS) {
    if (findAll(combined, det.re).length > 0) streets.add(det.name);
  }
  const wards = new Set<string>();
  for (const det of WARD_MENTION_DETECTORS) {
    if (findAll(combined, det.re).length > 0) wards.add(det.ward);
  }
  const kpMatch = findAll(combined, KHU_PHO_RE)[0];

  // Số nhà: cụm số đầu tiên của ô Số nhà; phần dư phải chỉ còn tên đường / KP / phường
  let houseNumber = '';
  let requiresManualHouseNumber = false;
  if (hnRaw) {
    const tokenMatch = hnRaw.match(/^(\d+[0-9A-Za-z/]*)/);
    const foldedHn = foldVietnamese(hnRaw);
    if (/[;(]/.test(hnRaw) || /\bbis\b/.test(foldedHn) || /\d\s*-\s*[\d(]/.test(hnRaw) || /cmt\s*8[a-z]/.test(foldedHn)) {
      requiresManualHouseNumber = true;
    }
    if (tokenMatch) {
      houseNumber = standardizeHouseNumber(tokenMatch[1]).houseNumber;
      let rest = foldedHn.slice(tokenMatch[1].length);
      for (const det of STREET_DETECTORS) rest = rest.replace(new RegExp(det.re.source, 'g'), ' ');
      for (const det of WARD_MENTION_DETECTORS) rest = rest.replace(new RegExp(det.re.source, 'g'), ' ');
      rest = rest
        .replace(new RegExp(KHU_PHO_RE.source, 'g'), ' ')
        .replace(/\b(?:kp|khu\s*pho|phuong|p|quan|q|tp|hcm|duong|d|hem|so)\b\.?/g, ' ')
        .replace(/[.,:/\-\s]+/g, '');
      if (/[a-z0-9]/.test(rest)) requiresManualHouseNumber = true;
    } else {
      requiresManualHouseNumber = true;
    }
  }

  return {
    houseNumber,
    street: streets.size === 1 ? Array.from(streets)[0] : '',
    hasMultipleStreets: streets.size > 1,
    wardMention: wards.size === 1 ? Array.from(wards)[0] : '',
    hasMultipleWardMentions: wards.size > 1,
    khuPho: kpMatch ? `KP${Number(kpMatch[1])}` : '',
    requiresManualHouseNumber,
  };
}

/** Ô Tuyến đường chứa thêm khu phố / phường / nhiều cụm (VD "CMT8, kp7, p.Hoà Hưng"). */
export function isCompositeStreetText(street?: string | null): boolean {
  if (!street || typeof street !== 'string') return false;
  const folded = foldVietnamese(street);
  if (findAll(folded, KHU_PHO_RE).length > 0 || /\bkp\b/.test(folded)) return true;
  if (WARD_MENTION_DETECTORS.some((det) => findAll(folded, det.re).length > 0)) return true;
  return /,\s*(?:p\.?|phuong)\s/.test(folded);
}

// ---------------------------------------------------------------------------
// GỢI Ý TUYẾN ĐƯỜNG THEO PHÂN KHU (chỉ để chọn, không bao giờ tự điền)
// ---------------------------------------------------------------------------

export function getZoneSuggestedStreets(zoneId?: string | null): string[] {
  const key = (zoneId || 'DEFAULT').trim().toUpperCase().replace(/-/g, '_');
  return ZONE_SUGGESTED_STREETS[key] || ZONE_SUGGESTED_STREETS[key.replace(/_/g, '-')] || ZONE_SUGGESTED_STREETS['DEFAULT'];
}

// ---------------------------------------------------------------------------
// ĐÁNH GIÁ TỔNG HỢP
// ---------------------------------------------------------------------------

export function evaluateAddressStandard(
  rawHn?: string | null,
  rawStreet?: string | null,
  rawWard?: string | null,
  rawDistrict?: string | null,
  zoneId?: string | null
): AddressEvaluationResult {
  const current = {
    houseNumber: (rawHn || '').trim(),
    street: (rawStreet || '').trim(),
    ward: (rawWard || '').trim(),
    district: (rawDistrict || '').trim(),
  };

  const anomalyReasons: string[] = [];
  const parsed = parseSurveyorAddress(current.houseNumber, current.street, '');

  const hnRes = standardizeHouseNumber(current.houseNumber);
  const suggestedHn = hnRes.houseNumber;
  const hasAlleyInHn = suggestedHn.includes('/');

  if (current.houseNumber !== suggestedHn) {
    if (/[a-z]/.test(current.houseNumber)) {
      anomalyReasons.push(`Số nhà '${current.houseNumber}' chứa chữ thường -> Cần viết hoa '${suggestedHn}'`);
    } else if (current.houseNumber.includes(',')) {
      anomalyReasons.push(`Số nhà '${current.houseNumber}' có dấu phẩy -> Cần chuẩn hóa thành '${suggestedHn}'`);
    } else if (/^số\s+/i.test(current.houseNumber)) {
      anomalyReasons.push(`Số nhà thừa tiền tố 'Số' -> Cần lược bỏ thành '${suggestedHn}'`);
    }
  }
  const requiresManualHouseNumber = Boolean(current.houseNumber) && parsed.requiresManualHouseNumber;
  if (requiresManualHouseNumber) {
    anomalyReasons.push(`Số nhà '${current.houseNumber}' chứa nhiều số hoặc ghi chú -> Cần xác định thủ công`);
  }

  let effectiveRawStreet = current.street;
  if (!effectiveRawStreet && hnRes.extractedStreet) {
    effectiveRawStreet = hnRes.extractedStreet;
    anomalyReasons.push(`Số nhà bị dính tên đường '${hnRes.extractedStreet}' -> Đã tách riêng vào Tuyến đường`);
  }

  const streetRes = standardizeStreet(effectiveRawStreet, hasAlleyInHn);
  let suggestedStreet = streetRes.street;
  let requiresManualStreet = false;

  if (streetRes.isContaminated || isCompositeStreetText(current.street)) {
    if (parsed.street) {
      suggestedStreet = parsed.street;
      anomalyReasons.push(
        streetRes.isContaminated
          ? `⚠️ Tên đường '${current.street}' bị điền nhầm tên Phường -> Lấy tên đường '${parsed.street}' từ dữ liệu KSV`
          : `Ô Tuyến đường '${current.street}' gộp cả khu phố/phường -> Tách tên đường '${parsed.street}'`
      );
    } else {
      suggestedStreet = '';
      requiresManualStreet = true;
      anomalyReasons.push(
        streetRes.isContaminated
          ? `⚠️ Tên đường '${current.street}' đang bị điền nhầm thành tên Phường -> Cần nhập tay tên đường thật`
          : `Ô Tuyến đường '${current.street}' không chứa tên đường -> Cần nhập tay tên đường thật`
      );
    }
  } else if (current.street !== suggestedStreet) {
    if (/\b(?:cmt8|bh|pvh|ltk|tc)\b/i.test(current.street)) {
      anomalyReasons.push(`Tên đường '${current.street}' đang viết tắt -> Cần chuẩn hóa '${suggestedStreet}'`);
    } else if (/\bhảm\b/i.test(current.street)) {
      anomalyReasons.push(`Tên đường có lỗi chính tả 'Hảm' -> Đã sửa và lược bỏ lặp hẻm`);
    } else if (streetRes.formerAlleyPrefix) {
      anomalyReasons.push(`Tên đường bị lặp thông tin hẻm '${streetRes.formerAlleyPrefix}' -> Đã lược bỏ gọn`);
    }
  }

  const wardRes = standardizeWard(current.ward, current.district);
  let suggestedWard = wardRes.ward || current.ward;
  let suggestedDistrict = wardRes.district || current.district;
  let mergerNote = wardRes.mergerNote;
  if (!suggestedWard && parsed.wardMention) {
    const fromMention = standardizeWard(parsed.wardMention, current.district);
    suggestedWard = fromMention.ward;
    suggestedDistrict = fromMention.district || suggestedDistrict;
    mergerNote = fromMention.mergerNote;
    anomalyReasons.push(`Phường trống -> Lấy '${suggestedWard}' từ ô Tuyến đường của KSV`);
  }

  if (wardRes.isSplitWard) {
    anomalyReasons.push(`Phường '${current.ward}' bị chia tách (${wardRes.splitCandidates.join(' / ')}) -> Cần xác định thủ công`);
  } else if (current.ward && current.ward !== suggestedWard) {
    if (wardRes.isMatched && wardRes.mergerNote) {
      anomalyReasons.push(`Phường '${current.ward}' -> Chuẩn hóa '${suggestedWard}' (${wardRes.mergerNote})`);
    } else {
      anomalyReasons.push(`Phường '${current.ward}' chưa đúng định dạng chuẩn -> Đề xuất '${suggestedWard}'`);
    }
  }

  if (current.district !== suggestedDistrict && suggestedDistrict) {
    anomalyReasons.push(`Quận '${current.district}' -> Cập nhật chuẩn '${suggestedDistrict}'`);
  }

  const diffCount =
    (current.houseNumber !== suggestedHn ? 1 : 0) +
    (current.street !== suggestedStreet ? 1 : 0) +
    (current.ward !== suggestedWard ? 1 : 0) +
    (current.district !== suggestedDistrict ? 1 : 0);

  const hasAnomalies = anomalyReasons.length > 0;
  const isCompliant = !hasAnomalies && !streetRes.isContaminated && !requiresManualStreet;

  return {
    isCompliant,
    hasAnomalies,
    anomalyReasons,
    isContaminated: streetRes.isContaminated,
    requiresManualStreet,
    requiresManualHouseNumber,
    isSplitWard: wardRes.isSplitWard,
    splitWardCandidates: wardRes.splitCandidates,
    suggestedStreetOptions: getZoneSuggestedStreets(zoneId),
    khuPho: parsed.khuPho,
    current,
    suggested: {
      houseNumber: suggestedHn,
      street: suggestedStreet,
      ward: suggestedWard,
      district: suggestedDistrict,
      mergerNote,
    },
    diffCount,
  };
}

/**
 * Định dạng chuỗi địa chỉ chuẩn hóa theo mô hình 168 ĐVHC cấp xã TP.HCM
 * (113 phường, 54 xã, 01 đặc khu - Không còn cấp quận/huyện)
 * Quy chuẩn: Số [Số nhà] [Tên đường], [Phường/Xã mới], TP. Hồ Chí Minh
 */
export function formatStandardizedAddress168(
  houseNumber?: string | null,
  street?: string | null,
  ward?: string | null,
  _district?: string | null
): string {
  const parts: string[] = [];
  const hn = (houseNumber || '').trim();
  const st = (street || '').trim();
  const wd = (ward || '').trim();

  let firstPart = '';
  if (hn && st) {
    firstPart = hn.toLowerCase().startsWith('số') ? `${hn} ${st}` : `Số ${hn} ${st}`;
  } else if (hn) {
    firstPart = hn.toLowerCase().startsWith('số') ? hn : `Số ${hn}`;
  } else if (st) {
    firstPart = st;
  }
  if (firstPart) parts.push(firstPart);
  if (wd) parts.push(wd);
  parts.push('TP. Hồ Chí Minh');

  return parts.join(', ');
}
