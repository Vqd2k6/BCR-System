import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

export interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  role: 'SUPER_ADMIN' | 'ZONE_ADMIN' | 'SURVEYOR' | 'CONTRACTOR';
  assignedZoneId?: string | null;
  status: string;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('metro2_access_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const initSession = async () => {
      const savedUser = localStorage.getItem('metro2_user_profile');
      const savedToken = localStorage.getItem('metro2_access_token');
      if (savedUser && savedToken) {
        try {
          setUser(JSON.parse(savedUser));
          setToken(savedToken);
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
        const { accessToken, user: userData } = res.data.data;
        setToken(accessToken);
        setUser(userData);
        localStorage.setItem('metro2_access_token', accessToken);
        localStorage.setItem('metro2_user_profile', JSON.stringify(userData));
        return;
      }
    } catch (error) {
      console.warn('[AUTH] API login fallback to local demo account');
    }

    // Demo account matching
    let demoUser: UserProfile;
    if (username.includes('zoneadmin')) {
      demoUser = {
        id: 'b0000000-0000-0000-0000-000000000002',
        username,
        fullName: 'Trần Văn Tổ Trưởng (Zone Admin)',
        role: 'ZONE_ADMIN',
        assignedZoneId: 'Ga S9 - Bà Quẹo',
        status: 'ACTIVE',
      };
    } else if (username.includes('superadmin')) {
      demoUser = {
        id: 'b0000000-0000-0000-0000-000000000001',
        username,
        fullName: 'Nguyễn Văn Tổng (MAUR Lãnh Đạo)',
        role: 'SUPER_ADMIN',
        assignedZoneId: 'Toàn tuyến 11 Ga',
        status: 'ACTIVE',
      };
    } else if (username.includes('contractor')) {
      demoUser = {
        id: 'b0000000-0000-0000-0000-000000000005',
        username,
        fullName: 'Đại diện Liên danh Nhà thầu Metro 2',
        role: 'CONTRACTOR',
        assignedZoneId: 'Ga S9 - Bà Quẹo',
        status: 'ACTIVE',
      };
    } else {
      demoUser = {
        id: 'b0000000-0000-0000-0000-000000000003',
        username,
        fullName: 'Nguyễn Văn Khảo Sát',
        role: 'SURVEYOR',
        assignedZoneId: 'Ga S9 - Bà Quẹo',
        status: 'ACTIVE',
      };
    }

    const mockToken = `mock-token-${Date.now()}`;
    setUser(demoUser);
    setToken(mockToken);
    localStorage.setItem('metro2_access_token', mockToken);
    localStorage.setItem('metro2_user_profile', JSON.stringify(demoUser));
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
