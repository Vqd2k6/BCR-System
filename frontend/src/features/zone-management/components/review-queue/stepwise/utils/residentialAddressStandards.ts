/**
 * Quy chuẩn Chuẩn Hóa Thông Tin Địa Chỉ Thửa Đất - Metro Line 2 (Bến Thành - Tham Lương)
 * Căn cứ theo Nghị quyết số 1685/NQ-UBTVQH15 của Ủy ban Thường vụ Quốc hội về sắp xếp ĐVHC cấp xã TP.HCM
 *
 * Nguyên tắc:
 * 1. Số nhà: Chữ cái phân nhánh luôn VIẾT HOA (618/2A, 1A, 11A/1), sửa lỗi dấu phẩy, lược bỏ tiền tố 'Số '.
 * 2. Tuyến đường: Lưu tên gọn không kèm tiền tố 'Đường ' (Cách Mạng Tháng Tám, Bắc Hải, Trường Sơn). Giải mã từ viết tắt CMT8, Đ.BH.
 * 3. Phường xã: Ánh xạ 100% chuẩn xác sang đơn vị hành chính MỚI sau sáp nhập theo NQ 1685 (Phường Nhiêu Lộc, Phường Hòa Hưng, Phường Tân Hòa...).
 * 4. Phát hiện nhiễm bẩn dữ liệu: Tự động cảnh báo khi tên đường bị điền nhầm thành tên Phường và gợi ý tuyến đường đúng của Zone.
 */

export interface AddressEvaluationResult {
  isCompliant: boolean;
  hasAnomalies: boolean;
  anomalyReasons: string[];
  isContaminated: boolean; // Tên đường bị gán nhầm thành tên phường
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

export interface WardMergerRule {
  key: string;
  targetWard: string;
  targetDistrict: string;
  formerWards: string[];
  mergerNote: string;
  patterns: RegExp[];
}

/**
 * Danh mục ánh xạ Đơn vị hành chính cấp xã sau sáp nhập - NQ 1685/NQ-UBTVQH15
 */
export const METRO2_WARD_MERGER_RULES: WardMergerRule[] = [
  // 1. Phường Nhiêu Lộc (Quận 3): Hợp nhất Phường 9, 11, 12, 14
  {
    key: 'NHIEU_LOC',
    targetWard: 'Phường Nhiêu Lộc',
    targetDistrict: 'Quận 3',
    formerWards: ['Phường 11', 'Phường 9', 'Phường 12', 'Phường 14'],
    mergerNote: 'Đơn vị hành chính mới theo NQ 1685 (trước sáp nhập là Phường 11, Quận 3)',
    patterns: [
      /nhi[eê]u\s*l[oộ]c/i,
      /\bp\.?\s*11\b/i,
      /ph[uư][oờ]ng\s*11\b/i,
      /\bp\.?\s*9\b/i,
      /ph[uư][oờ]ng\s*9\b/i,
      /\bp\.?\s*12\b/i,
      /ph[uư][oờ]ng\s*12\b/i,
      /\bp\.?\s*14\b/i,
      /ph[uư][oờ]ng\s*14\b/i,
    ],
  },
  // 2. Phường Hòa Hưng (Quận 10): Hợp nhất Phường 12, 13, 15 và phần P.14
  {
    key: 'HOA_HUNG',
    targetWard: 'Phường Hòa Hưng',
    targetDistrict: 'Quận 10',
    formerWards: ['Phường 15', 'Phường 12', 'Phường 13', 'Phường 14'],
    mergerNote: 'Đơn vị hành chính mới theo NQ 1685 (trước sáp nhập là Phường 15, Quận 10)',
    patterns: [
      /h[oò]a\s*h[uư]ng/i,
      /h[uư]ng\s*h[oò]a/i,
      /\bp\.?hh\b/i,
      /\bp\.?\s*15\b/i,
      /ph[uư][oờ]ng\s*15\b/i,
      /\bp\.?\s*13\b/i,
      /ph[uư][oờ]ng\s*13\b/i,
    ],
  },
  // 3. Phường Tân Hòa (Quận Tân Bình): Hợp nhất Phường 6, 8, 9
  {
    key: 'TAN_HOA',
    targetWard: 'Phường Tân Hòa',
    targetDistrict: 'Quận Tân Bình',
    formerWards: ['Phường 6', 'Phường 8', 'Phường 9'],
    mergerNote: 'Đơn vị hành chính mới theo NQ 1685 (trước sáp nhập là Phường 6, Quận Tân Bình)',
    patterns: [
      /t[aâ]n\s*h[oò]a/i,
      /\bp\.?\s*6\b/i,
      /ph[uư][oờ]ng\s*6\b/i,
      /\bp\.?\s*8\b/i,
      /ph[uư][oờ]ng\s*8\b/i,
    ],
  },
  // 4. Phường Bàn Cờ (Quận 3): Hợp nhất Phường 1, 2, 3, 5 và một phần P.4
  {
    key: 'BAN_CO',
    targetWard: 'Phường Bàn Cờ',
    targetDistrict: 'Quận 3',
    formerWards: ['Phường 1', 'Phường 2', 'Phường 3', 'Phường 5'],
    mergerNote: 'Đơn vị hành chính mới theo NQ 1685 (trước sáp nhập là Phường 5, Quận 3)',
    patterns: [
      /b[aà]n\s*c[oờ]/i,
      /\bp\.?\s*5\b/i,
      /ph[uư][oờ]ng\s*5\b/i,
      /\bp\.?\s*3\b/i,
      /ph[uư][oờ]ng\s*3\b/i,
      /\bp\.?\s*2\b/i,
      /ph[uư][oờ]ng\s*2\b/i,
      /\bp\.?\s*1\b/i,
      /ph[uư][oờ]ng\s*1\b/i,
    ],
  },
  // 5. Phường Xuân Hòa (Quận 3): Hợp nhất Phường Võ Thị Sáu (P.6, 7, 8 cũ) và phần còn lại P.4
  {
    key: 'XUAN_HOA',
    targetWard: 'Phường Xuân Hòa',
    targetDistrict: 'Quận 3',
    formerWards: ['Phường Võ Thị Sáu', 'Phường 4'],
    mergerNote: 'Đơn vị hành chính mới theo NQ 1685 (trước sáp nhập là Phường Võ Thị Sáu / P.4, Quận 3)',
    patterns: [
      /xu[aâ]n\s*h[oò]a/i,
      /v[oõ]\s*th[iị]\s*s[aá]u/i,
      /\bp\.?\s*4\b/i,
      /ph[uư][oờ]ng\s*4\b/i,
      /\bp\.?\s*7\b/i,
      /ph[uư][oờ]ng\s*7\b/i,
    ],
  },
  // 6. Phường Tân Sơn Nhất (Quận Tân Bình): Hợp nhất Phường 4, 5, 7
  {
    key: 'TAN_SON_NHAT',
    targetWard: 'Phường Tân Sơn Nhất',
    targetDistrict: 'Quận Tân Bình',
    formerWards: ['Phường 4', 'Phường 5', 'Phường 7'],
    mergerNote: 'Đơn vị hành chính mới theo NQ 1685 (trước sáp nhập là Phường 4, Quận Tân Bình)',
    patterns: [
      /t[aâ]n\s*s[oơ]n\s*nh[aấ]t/i,
      /\bp\.?\s*4\b/i,
      /ph[uư][oờ]ng\s*4\b/i,
      /\bp\.?\s*7\b/i,
      /ph[uư][oờ]ng\s*7\b/i,
    ],
  },
  // 7. Phường Bảy Hiền (Quận Tân Bình): Hợp nhất Phường 10, 11, 12
  {
    key: 'BAY_HIEN',
    targetWard: 'Phường Bảy Hiền',
    targetDistrict: 'Quận Tân Bình',
    formerWards: ['Phường 10', 'Phường 11', 'Phường 12'],
    mergerNote: 'Đơn vị hành chính mới theo NQ 1685 (trước sáp nhập là Phường 11, Quận Tân Bình)',
    patterns: [
      /b[aả]y\s*hi[eề]n/i,
      /\bp\.?\s*10\b/i,
      /ph[uư][oờ]ng\s*10\b/i,
    ],
  },
];

/**
 * Danh mục chuẩn hóa Tên đường tuyến Metro 2
 */
export const METRO2_STREET_CANONICAL_MAP: Record<string, string> = {
  // Cách Mạng Tháng Tám
  'cmt8': 'Cách Mạng Tháng Tám',
  'cmt 8': 'Cách Mạng Tháng Tám',
  'cách mạng tháng 8': 'Cách Mạng Tháng Tám',
  'cách mạng tháng tám': 'Cách Mạng Tháng Tám',
  'đường cách mạng tháng 8': 'Cách Mạng Tháng Tám',
  'đường cách mạng tháng tám': 'Cách Mạng Tháng Tám',
  'đ. cmt8': 'Cách Mạng Tháng Tám',
  'đ.cmt8': 'Cách Mạng Tháng Tám',

  // Bắc Hải
  'bắc hải': 'Bắc Hải',
  'bác hải': 'Bắc Hải', // sửa lỗi dấu
  'đ.bắc hải': 'Bắc Hải',
  'đ. bắc hải': 'Bắc Hải',
  'đường bắc hải': 'Bắc Hải',
  'đường bác hải': 'Bắc Hải',
  'đ. bh': 'Bắc Hải',
  'đ . bh': 'Bắc Hải',
  'đ.bh': 'Bắc Hải',
  'bh': 'Bắc Hải',

  // Trường Sơn
  'trường sơn': 'Trường Sơn',
  'đường trường sơn': 'Trường Sơn',
  'đ . trường sơn': 'Trường Sơn',
  'đ. trường sơn': 'Trường Sơn',
  'đ.trường sơn': 'Trường Sơn',

  // Trường Chinh
  'trường chinh': 'Trường Chinh',
  'đường trường chinh': 'Trường Chinh',
  'tc': 'Trường Chinh',
  'đ. tc': 'Trường Chinh',
  'đ.tc': 'Trường Chinh',

  // Lý Thường Kiệt
  'lý thường kiệt': 'Lý Thường Kiệt',
  'đường lý thường kiệt': 'Lý Thường Kiệt',
  'ltk': 'Lý Thường Kiệt',
  'đ. ltk': 'Lý Thường Kiệt',

  // Phạm Văn Hai
  'phạm văn hai': 'Phạm Văn Hai',
  'đường phạm văn hai': 'Phạm Văn Hai',
  'pvh': 'Phạm Văn Hai',

  // Hoàng Văn Thụ
  'hoàng văn thụ': 'Hoàng Văn Thụ',
  'đường hoàng văn thụ': 'Hoàng Văn Thụ',
  'hvt': 'Hoàng Văn Thụ',

  // Lê Thị Riêng
  'lê thị riêng': 'Lê Thị Riêng',
  'đường lê thị riêng': 'Lê Thị Riêng',
  'ltr': 'Lê Thị Riêng',

  // Các tuyến nội thành khác
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
};

/**
 * Danh sách gợi ý tuyến đường Metro 2 theo Phân khu (Zone)
 */
export const ZONE_SUGGESTED_STREETS: Record<string, string[]> = {
  // Ga S6 - Nhiêu Lộc / Phạm Văn Hai
  'S6': ['Cách Mạng Tháng Tám', 'Phạm Văn Hai', 'Rạch Bùng Binh', 'Hoàng Sa'],
  'ZONE-S6': ['Cách Mạng Tháng Tám', 'Phạm Văn Hai', 'Rạch Bùng Binh', 'Hoàng Sa'],
  // Ga S7 - Bảy Hiền / Tân Bình
  'S7': ['Cách Mạng Tháng Tám', 'Bắc Hải', 'Trường Sơn', 'Trường Chinh', 'Lý Thường Kiệt', 'Hoàng Văn Thụ'],
  'ZONE-S7': ['Cách Mạng Tháng Tám', 'Bắc Hải', 'Trường Sơn', 'Trường Chinh', 'Lý Thường Kiệt', 'Hoàng Văn Thụ'],
  // Ga S5 - Lê Thị Riêng / Hòa Hưng / Công viên Lê Thị Riêng
  'S5': ['Cách Mạng Tháng Tám', 'Bắc Hải', 'Trường Sơn', 'Tô Hiến Thành'],
  'ZONE-S5': ['Cách Mạng Tháng Tám', 'Bắc Hải', 'Trường Sơn', 'Tô Hiến Thành'],
  // Ga S1 / S2 - Bến Thành / Dân Chủ / Tao Đàn
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

/**
 * Chuẩn hóa Số nhà:
 * - Viết hoa chữ cái phân nhánh: 618/2a -> 618/2A, 1a -> 1A, 11a,1 -> 11A/1
 * - Tách tên đường nếu bị dính vào số nhà: '648/11 Cách Mạng Tháng 8' -> '648/11'
 * - Lược bỏ tiền tố thừa: 'Số '
 */
export function standardizeHouseNumber(rawHn?: string | null): { houseNumber: string; extractedStreet?: string } {
  if (!rawHn || typeof rawHn !== 'string') return { houseNumber: '' };

  let val = rawHn.trim();
  // Lược bỏ tiền tố 'Số '
  val = val.replace(/^số\s+/i, '').trim();

  // Kiểm tra nếu ô số nhà bị dính tên đường (VD: '648/11 Cách Mạng Tháng 8')
  let extractedStreet: string | undefined;
  const embeddedStreetMatch = val.match(/^([0-9]+[A-Za-z0-9\/\,\.\-]*)\s+([A-Za-z\u00C0-\u024F\u1E00-\u1EFF].*)$/);
  if (embeddedStreetMatch) {
    val = embeddedStreetMatch[1];
    extractedStreet = embeddedStreetMatch[2].trim();
  }

  // Sửa lỗi gõ dấu phẩy (VD: '11a,1' -> '11A/1')
  val = val.replace(/([0-9A-Za-z]+),([0-9A-Za-z]+)/g, '$1/$2');

  // Viết hoa toàn bộ chữ cái phân nhánh (VD: 618/2a -> 618/2A, 1a -> 1A, 658/1a -> 658/1A)
  val = val.replace(/([0-9]+|\/)([a-z])\b/g, (_match, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
  val = val.replace(/\b([a-z])\b/g, (match) => match.toUpperCase());

  return { houseNumber: val.trim(), extractedStreet };
}

/**
 * Kiểm tra xem chuỗi có bị nhiễm bẩn bởi tên Phường hay không (VD: 'Phường Bến Thành', 'Phường 4')
 */
export function isStreetContaminatedWithWard(street?: string | null): boolean {
  if (!street || typeof street !== 'string') return false;
  const s = street.trim().toLowerCase();
  if (s.startsWith('phường ') || s.startsWith('p. ') || s.startsWith('p.') || s.startsWith('xã ')) {
    return true;
  }
  // Khớp với các tên phường như 'Phường 4', 'Phường 6', 'Phường Bến Thành', 'Phường 11'
  return /^ph[uư][oờ]ng\s+[0-9a-z\u00C0-\u024F\u1E00-\u1EFF]+/i.test(s);
}

/**
 * Chuẩn hóa Tên đường:
 * - Lưu dạng gọn không kèm tiền tố 'Đường '
 * - Sửa lỗi viết tắt: cmt8, cmt 8 -> Cách Mạng Tháng Tám; bh -> Bắc Hải
 * - Sửa lỗi chính tả: Bác Hải -> Bắc Hải; Hảm 618 -> Hẻm 618
 * - Lược bỏ thông tin hẻm bị dính vào đường nếu số nhà đã có xuyệt
 */
export function standardizeStreet(rawStreet?: string | null, hasAlleyInHouseNumber = false): {
  street: string;
  isContaminated: boolean;
  formerAlleyPrefix?: string;
} {
  if (!rawStreet || typeof rawStreet !== 'string') return { street: '', isContaminated: false };

  let val = rawStreet.trim();

  // Kiểm tra nhiễm bẩn tên phường
  const isContaminated = isStreetContaminatedWithWard(val);
  if (isContaminated) {
    return { street: val, isContaminated: true };
  }

  // Tách tên phường bị dính đuôi vào tên đường (VD: 'Cách Mạng Tháng Tám, p. Nhiêu Lộc' hoặc 'CMT8, phường Nhiêu Lộc')
  val = val.replace(/,\s*(?:p\.?|phường)\s*.*$/i, '').trim();

  // Sửa lỗi chính tả hẻm: 'Hảm' -> 'Hẻm'
  val = val.replace(/\bhảm\b/gi, 'Hẻm');

  // Lược bỏ thông tin hẻm nếu số nhà đã mang xuyệt hẻm (VD: 'Hẻm 618 Cách Mạng Tháng Tám' -> 'Cách Mạng Tháng Tám')
  let formerAlleyPrefix: string | undefined;
  const alleyMatch = val.match(/^(?:h[eẻ]m\s+[0-9]+[A-Za-z]?\s+)(.+)$/i);
  if (alleyMatch && (hasAlleyInHouseNumber || val.toLowerCase().includes('cách mạng') || val.toLowerCase().includes('cmt8'))) {
    formerAlleyPrefix = val.substring(0, val.length - alleyMatch[1].length).trim();
    val = alleyMatch[1].trim();
  }

  // Lược bỏ tiền tố 'Đường ', 'Đ. ', 'đ. '
  val = val.replace(/^(?:đường|đ\.|đ\s*\.)\s+/i, '').trim();

  // Tra cứu bảng canonical
  const lower = val.toLowerCase().replace(/\s+/g, ' ');
  if (METRO2_STREET_CANONICAL_MAP[lower]) {
    val = METRO2_STREET_CANONICAL_MAP[lower];
  } else {
    // Viết hoa chữ cái đầu mỗi từ chuẩn chính tả tiếng Việt
    val = val
      .split(' ')
      .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''))
      .join(' ');
  }

  return { street: val, isContaminated: false, formerAlleyPrefix };
}

/**
 * Chuẩn hóa Phường theo Nghị quyết 1685/NQ-UBTVQH15
 */
export function standardizeWard(rawWard?: string | null, districtHint?: string | null): {
  ward: string;
  district: string;
  mergerNote?: string;
  isMatched: boolean;
} {
  if (!rawWard || typeof rawWard !== 'string') {
    return { ward: '', district: districtHint || '', isMatched: false };
  }

  const clean = rawWard.trim().toLowerCase();
  const dHint = districtHint ? districtHint.trim().toLowerCase() : '';

  // 1. Nếu có districtHint, ưu tiên quy tắc thuộc đúng Quận đó để phân giải các phường trùng tên (VD: Phường 4, Phường 7 có ở cả Q3 và Tân Bình)
  if (dHint) {
    for (const rule of METRO2_WARD_MERGER_RULES) {
      const ruleDist = rule.targetDistrict.toLowerCase();
      const isDistMatch =
        ruleDist === dHint ||
        (dHint.includes('tân bình') && ruleDist.includes('tân bình')) ||
        (dHint.includes('3') && ruleDist.includes('3') && !dHint.includes('13')) ||
        (dHint.includes('10') && ruleDist.includes('10'));

      if (isDistMatch) {
        for (const pat of rule.patterns) {
          if (pat.test(clean)) {
            return {
              ward: rule.targetWard,
              district: rule.targetDistrict,
              mergerNote: rule.mergerNote,
              isMatched: true,
            };
          }
        }
      }
    }
  }

  // 2. Tra cứu theo bảng quy tắc NQ 1685 cho các trường hợp còn lại
  for (const rule of METRO2_WARD_MERGER_RULES) {
    for (const pat of rule.patterns) {
      if (pat.test(clean)) {
        return {
          ward: rule.targetWard,
          district: rule.targetDistrict,
          mergerNote: rule.mergerNote,
          isMatched: true,
        };
      }
    }
  }

  // Nếu không khớp quy tắc sáp nhập đặc thù, chuẩn hóa chữ hoa thường và tiền tố 'Phường '
  let w = rawWard.trim();
  w = w.replace(/^(?:p\.?|phường)\s*/i, '').trim();
  // Loại bỏ khoảng trắng thừa
  w = w.replace(/\s+/g, ' ');
  // Đảm bảo có tiền tố Phường
  const finalWard = w ? `Phường ${w}` : '';

  return {
    ward: finalWard,
    district: districtHint ? districtHint.trim() : '',
    isMatched: false,
  };
}

/**
 * Đánh giá và sinh đề xuất Chuẩn Hóa Thông Tin Địa Chỉ Thửa Đất
 */
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

  // 1. Phân tích Số nhà
  const hnRes = standardizeHouseNumber(current.houseNumber);
  let suggestedHn = hnRes.houseNumber;
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

  // 2. Phân tích Tuyến đường
  let effectiveRawStreet = current.street;
  if (!effectiveRawStreet && hnRes.extractedStreet) {
    effectiveRawStreet = hnRes.extractedStreet;
    anomalyReasons.push(`Số nhà bị dính tên đường '${hnRes.extractedStreet}' -> Đã tách riêng vào Tuyến đường`);
  }

  const streetRes = standardizeStreet(effectiveRawStreet, hasAlleyInHn);
  let suggestedStreet = streetRes.street;

  if (streetRes.isContaminated) {
    anomalyReasons.push(`⚠️ Tên đường '${current.street}' đang bị điền nhầm thành tên Phường`);
    // Gợi ý tuyến đường trục chính theo Zone
    const zKey = (zoneId || 'DEFAULT').toUpperCase();
    const zoneSuggestions = ZONE_SUGGESTED_STREETS[zKey] || ZONE_SUGGESTED_STREETS['DEFAULT'];
    suggestedStreet = zoneSuggestions[0] || 'Cách Mạng Tháng Tám';
  } else if (current.street !== suggestedStreet) {
    if (/\b(?:cmt8|bh|pvh|ltk|tc)\b/i.test(current.street)) {
      anomalyReasons.push(`Tên đường '${current.street}' đang viết tắt -> Cần chuẩn hóa '${suggestedStreet}'`);
    } else if (/\bhảm\b/i.test(current.street)) {
      anomalyReasons.push(`Tên đường có lỗi chính tả 'Hảm' -> Đã sửa và lược bỏ lặp hẻm`);
    } else if (streetRes.formerAlleyPrefix) {
      anomalyReasons.push(`Tên đường bị lặp thông tin hẻm '${streetRes.formerAlleyPrefix}' -> Đã lược bỏ gọn`);
    }
  }

  // 3. Phân tích Phường & Quận
  const wardRes = standardizeWard(current.ward, current.district);
  const suggestedWard = wardRes.ward || current.ward;
  const suggestedDistrict = wardRes.district || current.district;

  if (current.ward !== suggestedWard) {
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
  const isCompliant = !hasAnomalies && !streetRes.isContaminated;

  return {
    isCompliant,
    hasAnomalies,
    anomalyReasons,
    isContaminated: streetRes.isContaminated,
    current,
    suggested: {
      houseNumber: suggestedHn,
      street: suggestedStreet,
      ward: suggestedWard,
      district: suggestedDistrict,
      mergerNote: wardRes.mergerNote,
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
  ward?: string | null
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
