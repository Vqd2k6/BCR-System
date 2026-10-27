import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import type { UserRole } from '../core/types/domain.types';
import { getErrorMessage, getErrorStatus } from '@/utils/errorUtils';

export interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  assignedZoneId?: string | null;
  status: string;
  phone?: string | null;
  surveyorCode?: string | null;
  signatureImageUrl?: string | null;
  email?: string | null;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  updateProfile: (data: { fullName?: string; phone?: string | null; signatureImageUrl?: string | null; email?: string | null }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('metro2_access_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const forceLockoutWithoutClearingDrafts = useCallback((reason: string) => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('metro2_access_token');
    localStorage.removeItem('metro2_user_profile');
    try {
      sessionStorage.setItem('metro2_auth_lockout_reason', reason);
    } catch (_err: unknown) {
      console.warn('[AuthContext:forceLockoutWithoutClearingDrafts] Không thể lưu lý do khóa vào sessionStorage:', _err);
    }
  }, []);

  const syncUserProfileFromApi = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data?.success && res.data?.data) {
        const fresh = res.data.data;
        if (fresh.status === 'LOCKED' || fresh.status === 'SUSPENDED') {
          const reasonSuffix = fresh.statusReason || fresh.status_reason ? ` - Lý do: ${fresh.statusReason || fresh.status_reason}` : '';
          forceLockoutWithoutClearingDrafts(
            `Tài khoản đang ở trạng thái [${fresh.status}], quyền truy cập đã bị thu hồi${reasonSuffix}`
          );
          return;
        }
        const normalized: UserProfile = {
          id: fresh.id,
          username: fresh.username,
          fullName: fresh.fullName || fresh.full_name,
          role: fresh.role,
          assignedZoneId: fresh.assignedZoneId || fresh.assigned_zone_id,
          status: fresh.status,
          phone: fresh.phone || null,
          surveyorCode: fresh.surveyorCode || fresh.surveyor_code || null,
          signatureImageUrl: fresh.signatureImageUrl || fresh.signature_image_url || null,
          email: fresh.email || null,
        };
        setUser(normalized);
        localStorage.setItem('metro2_user_profile', JSON.stringify(normalized));
      }
    } catch (_err: unknown) {
      const status = getErrorStatus(_err);
      if (status === 401) {
        const reason = getErrorMessage(
          _err,
          'Phiên đăng nhập đã hết hạn hoặc tài khoản đã bị thu hồi quyền truy cập.'
        );
        console.warn('[AuthContext:syncUserProfileFromApi] Thu hồi phiên do 401:', reason);
        forceLockoutWithoutClearingDrafts(reason);
        return;
      }
      // Offline fallback: chỉ giữ cached profile khi mất mạng hoặc lỗi máy chủ tạm thời
      console.warn('[AuthContext:syncUserProfileFromApi] Lỗi mạng hoặc máy chủ, tạm giữ profile cache:', _err);
    }
  }, [forceLockoutWithoutClearingDrafts]);

  useEffect(() => {
    const handleUnauthorizedEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ message?: string; url?: string }>;
      const reason =
        customEvent.detail?.message ||
        'Tài khoản của bạn đã bị khóa hoặc phiên làm việc đã hết hạn.';
      forceLockoutWithoutClearingDrafts(reason);
    };

    window.addEventListener('metro2:auth-unauthorized', handleUnauthorizedEvent);
    return () => {
      window.removeEventListener('metro2:auth-unauthorized', handleUnauthorizedEvent);
    };
  }, [forceLockoutWithoutClearingDrafts]);

  useEffect(() => {
    const initSession = async () => {
      const savedUser = localStorage.getItem('metro2_user_profile');
      const savedToken = localStorage.getItem('metro2_access_token');
      if (savedUser && savedToken) {
        try {
          setUser(JSON.parse(savedUser));
          setToken(savedToken);
          // Đồng bộ thông tin mới nhất (phone, surveyorCode, signatureImageUrl) từ database
          syncUserProfileFromApi();
        } catch (_e: unknown) {
          console.warn('[AuthContext:initSession] Lỗi đọc session lưu trữ:', _e);
          localStorage.removeItem('metro2_user_profile');
          localStorage.removeItem('metro2_access_token');
        }
      }
      setIsLoading(false);
    };

    initSession();
  }, []);

  const login = async (username: string, password: string) => {
    const res = await api.post('/auth/login', { username, password });
    if (res.data?.success) {
      const { accessToken, user: rawUser } = res.data.data;
      const normalized: UserProfile = {
        id: rawUser.id,
        username: rawUser.username,
        fullName: rawUser.fullName || rawUser.full_name,
        role: rawUser.role,
        assignedZoneId: rawUser.assignedZoneId || rawUser.assigned_zone_id,
        status: rawUser.status,
        phone: rawUser.phone || null,
        surveyorCode: rawUser.surveyorCode || rawUser.surveyor_code || null,
        signatureImageUrl: rawUser.signatureImageUrl || rawUser.signature_image_url || null,
        email: rawUser.email || null,
      };
      setToken(accessToken);
      setUser(normalized);
      localStorage.setItem('metro2_access_token', accessToken);
      localStorage.setItem('metro2_user_profile', JSON.stringify(normalized));
      try {
        sessionStorage.removeItem('metro2_auth_lockout_reason');
      } catch (_err: unknown) {
        console.warn('[AuthContext:login] Không thể xóa metro2_auth_lockout_reason:', _err);
      }
    }
  };

  const updateProfile = async (data: { fullName?: string; phone?: string | null; signatureImageUrl?: string | null; email?: string | null }) => {
    const res = await api.put('/auth/me', data);
    if (res.data?.success && res.data?.data) {
      const fresh = res.data.data;
      const updated: UserProfile = {
        ...user!,
        fullName: fresh.fullName || fresh.full_name || user!.fullName,
        phone: fresh.phone !== undefined ? fresh.phone : user!.phone,
        surveyorCode: fresh.surveyorCode || fresh.surveyor_code || user!.surveyorCode,
        signatureImageUrl: fresh.signatureImageUrl !== undefined ? fresh.signatureImageUrl : user!.signatureImageUrl,
        email: fresh.email !== undefined ? fresh.email : user!.email,
      };
      setUser(updated);
      localStorage.setItem('metro2_user_profile', JSON.stringify(updated));
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string, confirmPassword: string) => {
    await api.post('/auth/change-password', {
      currentPassword,
      newPassword,
      confirmPassword,
    });
  };

  const logout = () => {
    api.post('/auth/logout').catch((_err: unknown) => {
      console.warn('[AuthContext:logout] Không thể gọi API logout (có thể đang offline):', _err);
    });
    setUser(null);
    setToken(null);
    localStorage.removeItem('metro2_access_token');
    localStorage.removeItem('metro2_user_profile');
    localStorage.removeItem('metro2_absence_log');
    // Dọn dẹp trạng thái điều hướng và parcel đã chọn trong sessionStorage
    sessionStorage.removeItem('metro2_nav_state');
    sessionStorage.removeItem('metro2_last_active_parcel');
    sessionStorage.removeItem('metro2_last_active_unit');
    sessionStorage.removeItem('metro2_guest_viewing_parcel_id');
    sessionStorage.removeItem('metro2_guest_viewing_parcel_data');
    sessionStorage.removeItem('metro2_auth_lockout_reason');
    // Clear all today check-in keys
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('metro2_today_checkin_') || k.startsWith('metro2_attendance_')) {
        localStorage.removeItem(k);
      }
    });

    // Làm sạch thanh địa chỉ URL về trang gốc không chứa query parameters
    if (typeof window !== 'undefined') {
      try {
        window.history.replaceState({}, '', window.location.pathname);
      } catch (_err: unknown) {
        console.warn('[AuthContext:logout] Lỗi làm sạch URL:', _err);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        login,
        logout,
        isLoading,
        updateProfile,
        changePassword,
        refreshProfile: syncUserProfileFromApi,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
export default AuthContext;
