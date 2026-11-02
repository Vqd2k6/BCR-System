const LEGACY_AREA_TAGS = /\[Khu vực khác:\s*(.*?)\]/g;
const LEGACY_OTHER_REASON_PREFIX = /^\s*Khác:\s*/;

/** Nhãn chọn trên dropdown, không lưu vào `mainReason` vì Mục IX in nguyên văn trường này. */
export const ACCESS_REASON_OTHER = 'Khác (Nhập chi tiết...)';

export const ACCESS_LIMIT_PRESETS = [
  'Chỉ đồng ý cho xem tầng trệt (Không cho lên lầu)',
  'Chủ nhà đi vắng / Khóa cửa',
  'Chủ nhà không cho phép tiếp cận các phòng riêng',
  'Khu vực nguy hiểm / Kết cấu mất an toàn',
  'Phòng kho / Phòng thờ khóa cửa',
  'Kẹt cửa / Mất chìa khóa',
  'Khu vực chứa tài sản nhạy cảm',
  ACCESS_REASON_OTHER,
];

export interface ParsedAccessMainReason {
  kind: 'EMPTY' | 'PRESET' | 'OTHER';
  /** Không trim để ô nhập tự do gõ được dấu cách giữa các từ. */
  text: string;
}

/** Bản cũ lưu lý do tự do kèm tiền tố `Khác: `; chỉ bỏ tiền tố khi đọc, không ghi lại hồ sơ. */
export const parseAccessMainReason = (raw: string | null | undefined): ParsedAccessMainReason => {
  const value = raw || '';
  const trimmed = value.trim();
  if (!trimmed || trimmed === ACCESS_REASON_OTHER) return { kind: 'EMPTY', text: '' };
  if (ACCESS_LIMIT_PRESETS.includes(trimmed)) return { kind: 'PRESET', text: trimmed };
  const text = value.replace(LEGACY_OTHER_REASON_PREFIX, '');
  return text.trim() ? { kind: 'OTHER', text } : { kind: 'EMPTY', text: '' };
};

interface CustomAreaFields {
  notes?: string;
  customRestrictedAreas?: string[];
  /** Chỉ còn để đọc bản nháp cũ, không ghi mới. */
  customRestrictedArea?: string;
}

/** Bản cũ nhét khu vực khác vào ghi chú dưới dạng thẻ; tách ra đúng 2 trường, khớp với mapper Section 9. */
export const splitLegacyRestrictedArea = (
  notes: string | undefined
): { customRestrictedAreas: string[]; notes: string } => {
  const raw = notes || '';
  const tags = [...raw.matchAll(LEGACY_AREA_TAGS)];
  if (tags.length === 0) return { customRestrictedAreas: [], notes: raw };
  return {
    customRestrictedAreas: tags.map((tag) => tag[1].trim()).filter(Boolean),
    notes: raw.replace(LEGACY_AREA_TAGS, '').trim(),
  };
};

export const readCustomRestrictedAreas = (access: CustomAreaFields): string[] => {
  const items = (access.customRestrictedAreas || []).map((item) => item.trim()).filter(Boolean);
  if (items.length > 0) return items;
  const single = (access.customRestrictedArea || '').trim();
  return single ? [single] : splitLegacyRestrictedArea(access.notes).customRestrictedAreas;
};

/** Trả về đúng object cũ khi không có dữ liệu kiểu cũ, để ghi chú đang gõ không bị đụng tới. */
export const normalizeAccessLimitation = <T extends CustomAreaFields>(access: T): T => {
  const legacy = splitLegacyRestrictedArea(access.notes);
  if (legacy.customRestrictedAreas.length === 0 && !access.customRestrictedArea) return access;
  return {
    ...access,
    notes: legacy.notes,
    customRestrictedAreas: readCustomRestrictedAreas(access),
    customRestrictedArea: undefined,
  };
};

/** Bỏ mục rỗng và mục trùng để danh sách trích xuất được, không cần làm sạch về sau. */
export const addCustomRestrictedArea = (items: string[], rawValue: string): string[] => {
  const value = rawValue.trim().replace(/\s+/g, ' ');
  if (!value) return items;
  const isDuplicate = items.some((item) => item.toLowerCase() === value.toLowerCase());
  return isDuplicate ? items : [...items, value];
};

export interface RestrictedFloorOption {
  index: number;
  label: string;
  isAlreadySurveyed: boolean;
  /** Các nhãn đã lưu ứng với dòng này; khác rỗng nghĩa là dòng đang được tick. */
  storedLabels: string[];
}

interface BuildRestrictedFloorOptionsInput {
  floorNames: string[];
  aboveFloors: number;
  extraFloorsCount: number;
  storedLabels: string[];
}

/** Số Lầu là định danh vật lý của tầng; hầm, lửng, mái không nằm trong dãy số. */
const parseLauNumber = (floorName: string): number | null => {
  const name = floorName.toLowerCase();
  if (/hầm|lửng|mái|thượng|gác/.test(name)) return null;
  const lau = name.match(/lầu\s*(\d+)/);
  if (lau) return Number(lau[1]);
  if (name.includes('trệt')) return 0;
  const tang = name.match(/tầng\s*(\d+)/);
  return tang ? Number(tang[1]) : null;
};

/**
 * Bước 3 đặt tên `Tầng 1 (Lầu 1)`, `Tầng 2`, `Tầng 3`, nên tầng chưa khảo sát phải nối tiếp số đó.
 * Mỗi dòng luôn hiện nhãn chuẩn; nhãn đã lưu kiểu cũ như `Tầng 4 (Lầu 3)` chỉ gắn vào dòng cùng số Lầu.
 */
export const buildRestrictedFloorOptions = ({
  floorNames,
  aboveFloors,
  extraFloorsCount,
  storedLabels,
}: BuildRestrictedFloorOptionsInput): RestrictedFloorOption[] => {
  const surveyedCount = floorNames.length;
  const totalCount = Math.max(aboveFloors, surveyedCount, 3) + extraFloorsCount;
  const surveyedLauNumbers = floorNames
    .map(parseLauNumber)
    .filter((lau): lau is number => lau !== null);
  const highestLau = surveyedLauNumbers.length > 0 ? Math.max(...surveyedLauNumbers) : 0;
  const highestStoredLau = Math.max(
    0,
    ...storedLabels.map(parseLauNumber).filter((lau): lau is number => lau !== null)
  );

  const rows: { label: string; lau: number | null; storedLabels: string[] }[] = floorNames.map((name) => ({
    label: name,
    lau: parseLauNumber(name),
    storedLabels: [],
  }));
  for (let lau = highestLau + 1; rows.length < totalCount || lau <= highestStoredLau; lau += 1) {
    rows.push({ label: `Tầng ${lau} (Lầu ${lau})`, lau, storedLabels: [] });
  }

  storedLabels.forEach((stored) => {
    const storedLau = parseLauNumber(stored);
    const row =
      rows.find((item) => item.label === stored) ||
      (storedLau !== null ? rows.find((item) => item.lau === storedLau) : undefined);
    if (row) row.storedLabels.push(stored);
    else rows.push({ label: stored, lau: storedLau, storedLabels: [stored] });
  });

  return rows.map((row, i) => ({
    index: i + 1,
    label: row.label,
    isAlreadySurveyed: i < surveyedCount && row.storedLabels.length === 0,
    storedLabels: row.storedLabels,
  }));
};
