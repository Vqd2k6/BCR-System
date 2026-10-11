import { useCallback, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export interface AdminViewLockState {
  /** Người dùng hiện tại là Zone Admin / Super Admin */
  isAdmin: boolean;
  /** Admin đang ở chế độ CHỈ XEM (mặc định) — chưa mở khóa chỉnh sửa */
  isViewOnlyForAdmin: boolean;
  /** Admin đã mở khóa chỉnh sửa trong phiên mở form hiện tại */
  adminEditUnlocked: boolean;
  unlockEdit: () => void;
  lockEdit: () => void;
}

/**
 * Chế độ xem mặc định cho Admin: mọi biểu mẫu (Unit / Master / Master Area) mở ra
 * đều chỉ đọc và KHÔNG đồng bộ cho tới khi admin chủ động "Mở khóa chỉnh sửa".
 * Trạng thái này không được lưu bền — mỗi lần mở lại form admin lại bắt đầu ở chế độ xem.
 */
export function useAdminViewLock(): AdminViewLockState {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ZONE_ADMIN' || user?.role === 'SUPER_ADMIN';
  const [adminEditUnlocked, setAdminEditUnlocked] = useState(false);

  const unlockEdit = useCallback(() => setAdminEditUnlocked(true), []);
  const lockEdit = useCallback(() => setAdminEditUnlocked(false), []);

  return {
    isAdmin,
    isViewOnlyForAdmin: isAdmin && !adminEditUnlocked,
    adminEditUnlocked,
    unlockEdit,
    lockEdit,
  };
}
