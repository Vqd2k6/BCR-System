/**
 * QUY TẮC MÃ TẦNG CHUNG CƯ — bản dùng chung FE/BE.
 *
 * Tệp này có bản sao y hệt ở `backend/src/modules/cadastral/utils/floor-code.rules.ts`.
 * Sửa một bên phải sửa cả bên kia; `npm run test:floor-codes` (frontend) so khớp hai bản.
 * Không import gì để hai bản đóng gói độc lập.
 *
 * Chốt 15/11/2026:
 * - Tầng số thập phân: -0.5 = Bán hầm (SB), 0.5 = Lửng (MEZZ), 1.5 = MEZZ2, 2.5 = MEZZ3...
 * - Tầng đặc biệt lặp lại trong cùng tòa thì đánh số: TECH, TECH2, TECH3; REF, REF2...
 *   Không dùng `M01` làm mã tầng vì trùng hậu tố Khu vực chung (`01.M01`).
 * - `floor_code` đã lưu không viết lại; quy tắc chỉ áp cho tầng tạo mới.
 */

export const FLOOR_NUMBER_MIN = -5;
export const FLOOR_NUMBER_MAX = 100;

/** Mã tầng đặc biệt: lặp lại trong tòa thì đánh số TECH2, TECH3... */
const RENUMBERABLE_ROOTS = ['SB', 'MEZZ', 'TECH', 'REF', 'TUM', 'TERRACE', 'ROOF', 'PH'] as const;

/** Số tầng hợp lệ: trong biên và là bội của 0.5 (NUMERIC(4,1) trong CSDL). */
export function isValidFloorNumber(floorNumber: number): boolean {
  return (
    Number.isFinite(floorNumber) &&
    floorNumber >= FLOOR_NUMBER_MIN &&
    floorNumber <= FLOOR_NUMBER_MAX &&
    Number.isInteger(floorNumber * 2)
  );
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * Mã tầng gốc suy từ số tầng và tên tầng, chưa xét trùng với tầng khác trong tòa.
 * @example
 * resolveBaseFloorCode(-0.5) => 'SB'
 * resolveBaseFloorCode(0.5)  => 'MEZZ'
 * resolveBaseFloorCode(1.5)  => 'MEZZ2'
 * resolveBaseFloorCode(0)    => 'G'
 * resolveBaseFloorCode(-2)   => 'B02'
 * resolveBaseFloorCode(12)   => 'F12'
 * resolveBaseFloorCode(16, 'Tầng kỹ thuật') => 'TECH'
 */
export function resolveBaseFloorCode(floorNumber: number, floorName?: string | null): string {
  const lower = (floorName || '').toLowerCase();
  const isFraction = !Number.isInteger(floorNumber);

  // 1. Bán hầm
  if (floorNumber === -0.5 || lower.includes('bán hầm') || lower.includes('semi-basement')) return 'SB';
  if (floorNumber < 0 && isFraction) return `SB${Math.ceil(Math.abs(floorNumber))}`;

  // 2. Hầm theo số tầng âm
  if (floorNumber < 0) {
    const match = lower.match(/(?:hầm|basement|b)\s*(\d+)/i);
    return `B${pad2(match ? parseInt(match[1], 10) : Math.abs(Math.round(floorNumber)))}`;
  }

  // 3. Tầng đặc biệt theo tên (xét trước quy tắc số lẻ: tầng kỹ thuật 20.5 vẫn là TECH)
  if (lower.includes('kỹ thuật') || lower.includes('technical')) return 'TECH';
  if (lower.includes('lánh nạn') || lower.includes('refuge')) return 'REF';
  if (/\btum\b/.test(lower)) return 'TUM';
  if (lower.includes('sân thượng') || lower.includes('terrace')) return 'TERRACE';
  if (lower.includes('mái') || lower.includes('roof')) return 'ROOF';
  if (lower.includes('penthouse')) return 'PH';

  // 4. Lửng: 0.5 => MEZZ, n.5 => MEZZ(n+1); tầng số nguyên đặt tên "lửng" (dữ liệu cũ) => MEZZ
  if (isFraction && floorNumber > 0) {
    const below = Math.floor(floorNumber);
    return below <= 0 ? 'MEZZ' : `MEZZ${below + 1}`;
  }
  if (lower.includes('lửng') || lower.includes('mezzanine')) return 'MEZZ';

  // 5. Tên "hầm" trên số tầng dương (dữ liệu cũ), trệt, tầng nổi
  if (lower.includes('hầm') || lower.includes('basement')) {
    const match = lower.match(/(?:hầm|basement|b)\s*(\d+)/i);
    return `B${pad2(match ? parseInt(match[1], 10) : 1)}`;
  }
  if (floorNumber === 0 || lower.includes('trệt')) return 'G';
  return `F${pad2(Math.floor(floorNumber))}`;
}

/** Tách mã đặc biệt thành gốc + số thứ tự: 'TECH2' => { root: 'TECH', seq: 2 }, 'TECH' => seq 1. */
function splitRenumberable(code: string): { root: string; seq: number } | null {
  const upper = code.trim().toUpperCase();
  for (const root of RENUMBERABLE_ROOTS) {
    if (upper === root) return { root, seq: 1 };
    const m = upper.match(new RegExp(`^${root}(\\d+)$`));
    if (m) return { root, seq: parseInt(m[1], 10) };
  }
  return null;
}

/**
 * Cấp mã tầng không trùng với mã các tầng khác trong tòa (chỉ áp cho mã đặc biệt).
 * Tầng nổi Fnn, hầm Bnn, trệt G định danh theo số tầng nên giữ nguyên.
 * @example
 * allocateFloorCode('TECH', ['F01', 'TECH'])        => 'TECH2'
 * allocateFloorCode('TECH', ['TECH', 'TECH2'])      => 'TECH3'
 * allocateFloorCode('MEZZ2', ['MEZZ', 'MEZZ2'])     => 'MEZZ3'
 */
export function allocateFloorCode(baseCode: string, otherFloorCodes: Iterable<string> = []): string {
  const base = baseCode.trim().toUpperCase();
  const split = splitRenumberable(base);
  if (!split) return base;

  const taken = new Set<string>();
  for (const c of otherFloorCodes) {
    if (c) taken.add(String(c).trim().toUpperCase());
  }
  if (!taken.has(base)) return base;

  let seq = Math.max(split.seq + 1, 2);
  while (taken.has(`${split.root}${seq}`)) seq++;
  return `${split.root}${seq}`;
}

/** Mã tầng mặc định cho tầng mới: mã gốc + đánh số nếu tầng đặc biệt đã có trong tòa. */
export function resolveFloorCode(
  floorNumber: number,
  floorName?: string | null,
  otherFloorCodes: Iterable<string> = []
): string {
  return allocateFloorCode(resolveBaseFloorCode(floorNumber, floorName), otherFloorCodes);
}

/**
 * Tiền tố mã căn (`unit_code`) từ mã tầng: F05 => '05', F00 => 'G', còn lại giữ nguyên (G, MEZZ2, SB, B01, TECH2).
 * Trả '' nếu mã tầng rỗng hoặc chứa ký tự lạ — bên gọi phải suy lại từ số tầng.
 */
export function floorCodeToUnitPrefix(floorCode: string | null | undefined): string {
  const upper = (floorCode || '').trim().toUpperCase();
  if (!upper || !/^[A-Z0-9]+$/.test(upper)) return '';
  const f = upper.match(/^F(\d+)$/);
  if (f) {
    const n = parseInt(f[1], 10);
    return n === 0 ? 'G' : pad2(n);
  }
  if (/^\d+$/.test(upper)) {
    const n = parseInt(upper, 10);
    return n === 0 ? 'G' : pad2(n);
  }
  return upper;
}

/**
 * Nhãn tầng mặc định khi tầng chưa có tên riêng. Tầng N = Lầu N (quy ước Bước 3).
 * @example
 * formatDefaultFloorLabel(-0.5) => 'Tầng bán hầm (SB)'
 * formatDefaultFloorLabel(0)    => 'Tầng trệt (G)'
 * formatDefaultFloorLabel(1.5)  => 'Tầng lửng (MEZZ2)'
 * formatDefaultFloorLabel(-2)   => 'Hầm B2'
 * formatDefaultFloorLabel(7)    => 'Tầng 7'
 */
export function formatDefaultFloorLabel(floorNumber: number): string {
  if (floorNumber === 0) return 'Tầng trệt (G)';
  if (!Number.isInteger(floorNumber)) {
    const code = resolveBaseFloorCode(floorNumber);
    return floorNumber < 0 ? `Tầng bán hầm (${code})` : `Tầng lửng (${code})`;
  }
  if (floorNumber < 0) return `Hầm B${Math.abs(floorNumber)}`;
  return `Tầng ${floorNumber}`;
}
