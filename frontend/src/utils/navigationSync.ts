import type { NavTab } from '../components/layout/SurveyorBottomNav';
import type { ZoneNavView } from '../features/zone-management/components/layout/ZoneAdminSidebar';

export type AdminTab = 'export' | 'gis-mutation' | 'users' | 'audit' | 'config';

export interface NavigationState {
  tab?: NavTab;
  parcelId?: string;
  unitId?: string;
  readOnly?: boolean;
  zone?: string;
  nav?: ZoneNavView;
  adminTab?: AdminTab;
  reportParcelId?: string;
}

const VALID_NAV_TABS: readonly NavTab[] = [
  'home',
  'map',
  'attendance',
  'phase1',
  'phase2',
  'condo-master',
  'condo-unit',
  'admin-export',
];

const VALID_ZONE_NAVS: readonly ZoneNavView[] = [
  'dashboard',
  'review',
  'map',
  'parcels',
  'export',
];

const VALID_ADMIN_TABS: readonly AdminTab[] = [
  'export',
  'gis-mutation',
  'users',
  'audit',
  'config',
];

const SESSION_STORAGE_KEY = 'metro2_nav_state';

/**
 * Đọc trạng thái điều hướng từ URL query parameters (ưu tiên) kết hợp fallback từ sessionStorage
 */
export function getNavigationFromUrl(): NavigationState {
  if (typeof window === 'undefined') {
    return {};
  }

  const result: NavigationState = {};

  try {
    const params = new URLSearchParams(window.location.search);

    // 1. Tab chính
    const rawTab = params.get('tab') as NavTab | null;
    if (rawTab && VALID_NAV_TABS.includes(rawTab)) {
      result.tab = rawTab;
    }

    // 2. Thửa đất khảo sát
    const rawParcelId = params.get('parcelId') || params.get('reportParcelId');
    if (rawParcelId) {
      result.parcelId = rawParcelId;
    }

    // 3. Căn hộ con
    const rawUnitId = params.get('unitId');
    if (rawUnitId) {
      result.unitId = rawUnitId;
    }

    // 4. Cờ chỉ đọc
    const rawReadOnly = params.get('readOnly');
    if (rawReadOnly === 'true' || rawReadOnly === '1') {
      result.readOnly = true;
    } else if (rawReadOnly === 'false' || rawReadOnly === '0') {
      result.readOnly = false;
    }

    // 5. Phân khu Zone
    const rawZone = params.get('zone');
    if (rawZone) {
      result.zone = rawZone.toUpperCase();
    }

    // 6. Sub-view của Zone Admin
    const rawNav = params.get('nav') as ZoneNavView | null;
    if (rawNav && VALID_ZONE_NAVS.includes(rawNav)) {
      result.nav = rawNav;
    }

    // 7. Sub-tab của Super Admin
    const rawAdminTab = params.get('adminTab') as AdminTab | null;
    if (rawAdminTab && VALID_ADMIN_TABS.includes(rawAdminTab)) {
      result.adminTab = rawAdminTab;
    }

    // 8. Báo cáo xem trước cho Guest
    const rawReportParcelId = params.get('reportParcelId');
    if (rawReportParcelId) {
      result.reportParcelId = rawReportParcelId;
    }

    // Nếu URL không có tab, thử phục hồi từ sessionStorage
    if (!result.tab) {
      const savedStr = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (savedStr) {
        const saved = JSON.parse(savedStr) as Partial<NavigationState>;
        if (saved.tab && VALID_NAV_TABS.includes(saved.tab)) {
          result.tab = saved.tab;
        }
        if (!result.parcelId && saved.parcelId) result.parcelId = saved.parcelId;
        if (!result.unitId && saved.unitId) result.unitId = saved.unitId;
        if (result.readOnly === undefined && saved.readOnly !== undefined) result.readOnly = saved.readOnly;
        if (!result.zone && saved.zone) result.zone = saved.zone;
        if (!result.nav && saved.nav && VALID_ZONE_NAVS.includes(saved.nav)) result.nav = saved.nav;
        if (!result.adminTab && saved.adminTab && VALID_ADMIN_TABS.includes(saved.adminTab)) result.adminTab = saved.adminTab;
      }
    }
  } catch (err: unknown) {
    console.warn('[navigationSync:getNavigationFromUrl] Lỗi đọc URL params:', err);
  }

  return result;
}

/**
 * Cập nhật URL query params và sessionStorage mà không reload lại trình duyệt
 */
export function updateNavigationUrl(
  updates: Partial<NavigationState>,
  options: { replace?: boolean; clearSurvey?: boolean } = {}
): void {
  if (typeof window === 'undefined') return;

  try {
    const url = new URL(window.location.href);
    const params = url.searchParams;

    if (options.clearSurvey) {
      params.delete('parcelId');
      params.delete('unitId');
      params.delete('readOnly');
      params.delete('reportParcelId');
    }

    if (updates.tab !== undefined) {
      if (updates.tab) {
        params.set('tab', updates.tab);
      } else {
        params.delete('tab');
      }
    }

    if (updates.parcelId !== undefined) {
      if (updates.parcelId) {
        params.set('parcelId', updates.parcelId);
      } else {
        params.delete('parcelId');
      }
    }

    if (updates.unitId !== undefined) {
      if (updates.unitId) {
        params.set('unitId', updates.unitId);
      } else {
        params.delete('unitId');
      }
    }

    if (updates.readOnly !== undefined) {
      if (updates.readOnly) {
        params.set('readOnly', 'true');
      } else {
        params.delete('readOnly');
      }
    }

    if (updates.zone !== undefined) {
      if (updates.zone) {
        params.set('zone', updates.zone);
      } else {
        params.delete('zone');
      }
    }

    if (updates.nav !== undefined) {
      if (updates.nav) {
        params.set('nav', updates.nav);
      } else {
        params.delete('nav');
      }
    }

    if (updates.adminTab !== undefined) {
      if (updates.adminTab) {
        params.set('adminTab', updates.adminTab);
      } else {
        params.delete('adminTab');
      }
    }

    if (updates.reportParcelId !== undefined) {
      if (updates.reportParcelId) {
        params.set('reportParcelId', updates.reportParcelId);
      } else {
        params.delete('reportParcelId');
      }
    }

    const newUrl = `${url.pathname}${params.toString() ? `?${params.toString()}` : ''}${url.hash}`;

    if (options.replace !== false) {
      window.history.replaceState({ ...updates }, '', newUrl);
    } else {
      window.history.pushState({ ...updates }, '', newUrl);
    }

    // Đồng bộ vào sessionStorage
    const currentNav = getNavigationFromUrl();
    const merged = { ...currentNav, ...updates };
    if (options.clearSurvey) {
      delete merged.parcelId;
      delete merged.unitId;
      delete merged.readOnly;
      delete merged.reportParcelId;
    }
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(merged));
  } catch (err: unknown) {
    console.warn('[navigationSync:updateNavigationUrl] Lỗi cập nhật URL params:', err);
  }
}

/**
 * Xóa các tham số khảo sát khi quay về màn hình danh sách chính
 */
export function clearSurveyParamsFromUrl(): void {
  updateNavigationUrl({}, { clearSurvey: true, replace: true });
}
