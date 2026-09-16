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

export type RoleType = 'SUPER_ADMIN' | 'ZONE_ADMIN' | 'SURVEYOR' | 'CONTRACTOR' | 'GUEST';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  role: RoleType;
  setRole: (role: RoleType) => void;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  switchRoleDemo: (role: RoleType) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('metro2_access_token'));
  const [role, setRoleState] = useState<RoleType>('SURVEYOR');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const initSession = async () => {
      const savedUser = localStorage.getItem('metro2_user_profile');
      if (savedUser) {
        const u = JSON.parse(savedUser);
        setUser(u);
        setRoleState(u.role || 'SURVEYOR');
      } else {
        const defaultSurveyor: UserProfile = {
          id: 'b0000000-0000-0000-0000-000000000003',
          username: 'surveyor_s9_01',
          fullName: 'Nguyễn Văn Khảo Sát',
          role: 'SURVEYOR',
          assignedZoneId: 'Ga S9 - Bà Quẹo',
          status: 'ACTIVE',
        };
        setUser(defaultSurveyor);
        setRoleState('SURVEYOR');
        localStorage.setItem('metro2_user_profile', JSON.stringify(defaultSurveyor));
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
        setRoleState(userData.role);
        localStorage.setItem('metro2_access_token', accessToken);
        localStorage.setItem('metro2_user_profile', JSON.stringify(userData));
      }
    } catch (error) {
      const demoUser: UserProfile = {
        id: 'b0000000-0000-0000-0000-000000000003',
        username,
        fullName: 'Nguyễn Văn Khảo Sát (Demo)',
        role: 'SURVEYOR',
        assignedZoneId: 'Ga S9 - Bà Quẹo',
        status: 'ACTIVE',
      };
      setUser(demoUser);
      setRoleState('SURVEYOR');
      localStorage.setItem('metro2_user_profile', JSON.stringify(demoUser));
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('metro2_access_token');
    localStorage.removeItem('metro2_user_profile');
  };

  const switchRoleDemo = (newRole: RoleType) => {
    setRoleState(newRole);
    let demoUser: UserProfile;
    switch (newRole) {
      case 'SUPER_ADMIN':
        demoUser = {
          id: 'b0000000-0000-0000-0000-000000000001',
          username: 'superadmin',
          fullName: 'Nguyễn Văn Tổng (MAUR)',
          role: 'SUPER_ADMIN',
          status: 'ACTIVE',
        };
        break;
      case 'ZONE_ADMIN':
        demoUser = {
          id: 'b0000000-0000-0000-0000-000000000002',
          username: 'zoneadmin_s9',
          fullName: 'Trần Văn Tổ Trưởng (Ga S9)',
          role: 'ZONE_ADMIN',
          assignedZoneId: 'Ga S9 - Bà Quẹo',
          status: 'ACTIVE',
        };
        break;
      case 'CONTRACTOR':
        demoUser = {
          id: 'b0000000-0000-0000-0000-000000000005',
          username: 'contractor_guest',
          fullName: 'Đại diện Nhà Thầu TBM',
          role: 'CONTRACTOR',
          status: 'ACTIVE',
        };
        break;
      case 'GUEST':
        demoUser = {
          id: 'b0000000-0000-0000-0000-000000000006',
          username: 'guest_citizen',
          fullName: 'Người dân tra cứu',
          role: 'SURVEYOR',
          status: 'ACTIVE',
        };
        break;
      default:
        demoUser = {
          id: 'b0000000-0000-0000-0000-000000000003',
          username: 'surveyor_s9_01',
          fullName: 'Nguyễn Văn Khảo Sát',
          role: 'SURVEYOR',
          assignedZoneId: 'Ga S9 - Bà Quẹo',
          status: 'ACTIVE',
        };
    }
    setUser(demoUser);
    localStorage.setItem('metro2_user_profile', JSON.stringify(demoUser));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role,
        setRole: switchRoleDemo,
        login,
        logout,
        switchRoleDemo,
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
