import type { NavTab } from '../components/layout/SurveyorBottomNav';
import type { UserRole } from '../core/types/domain.types';
import type { NavigationState } from './navigationSync';

/**
 * Ma trận phân quyền các Tab được phép truy cập theo từng vai trò
 */
const ROLE_ALLOWED_TABS: Record<UserRole, readonly NavTab[]> = {
  SUPER_ADMIN: ['admin-export', 'home', 'map', 'phase1', 'condo-master', 'condo-unit', 'phase2'],
  ZONE_ADMIN: ['admin-export', 'phase1', 'condo-master', 'condo-unit'],
  SURVEYOR: ['home', 'map', 'attendance', 'phase1', 'condo-master', 'condo-unit', 'phase2'],
  CONTRACTOR: [],
  GUEST: [],
};

/**
 * Tab mặc định an toàn cho từng vai trò khi đăng nhập hoặc khi điều hướng bị từ chối
 */
const ROLE_DEFAULT_TAB: Record<UserRole, NavTab> = {
  SUPER_ADMIN: 'admin-export',
  ZONE_ADMIN: 'admin-export',
  SURVEYOR: 'home',
  CONTRACTOR: 'home',
  GUEST: 'home',
};

/**
 * Kiểm tra xem một vai trò có quyền truy cập vào tab chỉ định hay không
 */
export function isTabAllowedForRole(tab: NavTab | undefined, role: UserRole | undefined): boolean {
  if (!tab || !role) return false;
  const allowed = ROLE_ALLOWED_TABS[role];
  return allowed ? allowed.includes(tab) : false;
}

/**
 * Lấy tab mặc định an toàn cho vai trò
 */
export function getDefaultTabForRole(role: UserRole | undefined): NavTab {
  if (!role) return 'home';
  return ROLE_DEFAULT_TAB[role] || 'home';
}

/**
 * Chuẩn hóa và làm sạch đối tượng điều hướng NavigationState theo vai trò người dùng:
 * - Nếu tab không được phép -> fallback về default tab của vai trò đó
 * - Nếu là Surveyor hoặc vai trò phi quản trị -> gỡ bỏ toàn bộ adminTab và nav (sub-views của Admin)
 */
export function sanitizeNavigationForRole(
  nav: NavigationState,
  role: UserRole | undefined
): { safeTab: NavTab; wasSanitized: boolean; sanitizedNav: NavigationState } {
  if (!role) {
    return { safeTab: 'home', wasSanitized: false, sanitizedNav: nav };
  }

  let wasSanitized = false;
  const sanitizedNav: NavigationState = { ...nav };

  // 1. Kiểm tra tính hợp lệ của tab chính
  let safeTab: NavTab;
  if (nav.tab && isTabAllowedForRole(nav.tab, role)) {
    safeTab = nav.tab;
  } else {
    safeTab = getDefaultTabForRole(role);
    sanitizedNav.tab = safeTab;
    wasSanitized = true;
  }

  // 2. Gỡ bỏ các tham số query quản trị phụ nếu vai trò không phải là Admin
  if (role === 'SURVEYOR' || role === 'CONTRACTOR' || role === 'GUEST') {
    if (sanitizedNav.adminTab !== undefined) {
      delete sanitizedNav.adminTab;
      wasSanitized = true;
    }
    if (sanitizedNav.nav !== undefined) {
      delete sanitizedNav.nav;
      wasSanitized = true;
    }
  }

  return { safeTab, wasSanitized, sanitizedNav };
}
