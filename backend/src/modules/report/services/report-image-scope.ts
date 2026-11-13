/**
 * ============================================================================
 * KHO ẢNH THEO LƯỢT RENDER
 * Mỗi lượt dựng report (xem trước HTML, PDF nháp, Rev) có một kho ảnh riêng, giữ đủ mọi ảnh
 * của lượt đó tới khi in xong, không đuổi phần tử. Trước đây chỉ có cache tĩnh dùng chung
 * giới hạn 300 ảnh: hồ sơ trên 300 ảnh (hoặc vài lượt render chạy song song) bị đẩy ảnh ra,
 * ảnh in ra không crop, không xoay, không dập được dấu (C&C-04-B-0322: 97/282 ảnh).
 *
 * Dùng AsyncLocalStorage để mọi mapper đang gọi ReportImageResolver.resolveToBase64 (đồng bộ)
 * tự đọc đúng kho của lượt render hiện tại mà không phải đổi chữ ký từng mapper.
 * Kho còn ghi lại các ảnh mapper yêu cầu nhưng chưa nạp (lượt dò) và lý do ảnh nạp lỗi.
 * ============================================================================
 */

import { AsyncLocalStorage } from 'async_hooks';

export type ImageLoadFailureKind = 'HTTP' | 'TIMEOUT' | 'NETWORK' | 'NOT_FOUND' | 'EMPTY' | 'UNREADABLE';

export interface ImageLoadFailure {
  kind: ImageLoadFailureKind;
  /** Mã HTTP khi tải từ URL công khai (nếu có). */
  httpStatus: number | null;
  message: string;
}

export class RenderImageScope {
  /** URL → data URI ảnh gốc (chưa xoay). */
  readonly native = new Map<string, string>();
  /** `${deg}::${url}` → data URI đã xoay. */
  readonly rotated = new Map<string, string>();
  /** Data URI đã xoay → ảnh gốc + góc, để dập dấu theo chiều gốc rồi xoay lại. */
  readonly rotationOrigin = new Map<string, { nativeUri: string; deg: number }>();
  /** Ảnh mapper yêu cầu (URL + góc) nhưng kho chưa có: dùng cho lượt dò trước khi nạp. */
  readonly requested = new Map<string, Set<number>>();
  /** URL nạp lỗi → lý do (để báo cáo và chặn xuất). */
  readonly failures = new Map<string, ImageLoadFailure>();
  /**
   * Trạng thái dấu cũ đã đóng băng trong snapshot Rev (render lại hồ sơ APPROVED): URL → có dấu cũ hay không.
   * null = lượt render bản nháp, đọc bảng sống.
   */
  frozenLegacy: Map<string, boolean> | null = null;

  noteRequested(url: string, deg: number): void {
    const set = this.requested.get(url) ?? new Set<number>();
    set.add(deg);
    this.requested.set(url, set);
  }
}

const storage = new AsyncLocalStorage<RenderImageScope>();

export function currentRenderImageScope(): RenderImageScope | undefined {
  return storage.getStore();
}

/** Chạy một lượt render trong kho ảnh riêng. Kho bị bỏ khi hàm trả về (kể cả khi lỗi). */
export async function runWithRenderImageScope<T>(fn: (scope: RenderImageScope) => Promise<T>): Promise<T> {
  const scope = new RenderImageScope();
  return storage.run(scope, () => fn(scope));
}
