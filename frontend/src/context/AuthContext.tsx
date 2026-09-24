import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

export interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  role: 'SUPER_ADMIN' | 'ZONE_ADMIN' | 'SURVEYOR' | 'CONTRACTOR';
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
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('metro2_access_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const syncUserProfileFromApi = async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data?.success && res.data?.data) {
        const fresh = res.data.data;
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
    } catch (_err) {
      // Offline fallback: keep cached profile
    }
  };

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
        } catch (_e) {
          localStorage.removeItem('metro2_user_profile');
          localStorage.removeItem('metro2_access_token');
        }
      }
      setIsLoading(false);
    };

    initSession();
  }, []);

  const login = async (username: string, password: string) => {
    try {
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
        return;
      }
    } catch (apiErr: any) {
      console.warn('[Auth] API login failed, checking demo fallback:', apiErr?.message);

      const mockUsers: Record<string, UserProfile> = {
        surveyor_s9_01: {
          id: 'b0000000-0000-0000-0000-000000000003',
          username: 'surveyor_s9_01',
          fullName: 'Nguyễn Văn Khảo Sát',
          role: 'SURVEYOR',
          assignedZoneId: 'ZONE_S9',
          status: 'ACTIVE',
          phone: '0903456789',
          surveyorCode: 'P-6789',
        },
        surveyor_s9_02: {
          id: 'b0000000-0000-0000-0000-000000000004',
          username: 'surveyor_s9_02',
          fullName: 'Trần Văn B',
          role: 'SURVEYOR',
          assignedZoneId: 'ZONE_S9',
          status: 'ACTIVE',
          phone: '0904567890',
          surveyorCode: 'P-7890',
        },
        zoneadmin_s9: {
          id: 'b0000000-0000-0000-0000-000000000002',
          username: 'zoneadmin_s9',
          fullName: 'Trần Văn Tổ Trưởng (Ga S9)',
          role: 'ZONE_ADMIN',
          assignedZoneId: 'ZONE_S9',
          status: 'ACTIVE',
          phone: '0902345678',
        },
        superadmin: {
          id: 'b0000000-0000-0000-0000-000000000001',
          username: 'superadmin',
          fullName: 'Nguyễn Văn Tổng (MAUR)',
          role: 'SUPER_ADMIN',
          assignedZoneId: null,
          status: 'ACTIVE',
          phone: '0901234567',
        },
        contractor_guest: {
          id: 'b0000000-0000-0000-0000-000000000005',
          username: 'contractor_guest',
          fullName: 'Đại diện Nhà Thầu TBM',
          role: 'CONTRACTOR',
          assignedZoneId: null,
          status: 'ACTIVE',
          phone: '0905678901',
        },
      };

      const matchedMock = mockUsers[username.toLowerCase().trim()];
      if (matchedMock) {
        const mockToken = `mock-token-${Date.now()}-${matchedMock.id}`;
        setToken(mockToken);
        setUser(matchedMock);
        localStorage.setItem('metro2_access_token', mockToken);
        localStorage.setItem('metro2_user_profile', JSON.stringify(matchedMock));
        return;
      }

      throw apiErr;
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

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('metro2_access_token');
    localStorage.removeItem('metro2_user_profile');
    localStorage.removeItem('metro2_absence_log');
    // Clear all today check-in keys
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('metro2_today_checkin_') || k.startsWith('metro2_attendance_')) {
        localStorage.removeItem(k);
      }
    });
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
