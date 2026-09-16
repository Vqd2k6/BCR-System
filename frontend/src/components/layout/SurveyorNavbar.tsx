import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Train, LogOut, UserCheck } from 'lucide-react';

interface Props {
  title?: string;
  subtitle?: string;
}

export const SurveyorNavbar: React.FC<Props> = ({ title = 'Khảo Sát Hiện Trạng Metro 2', subtitle }) => {
  const { user, logout } = useAuth();

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'ZONE_ADMIN':
        return 'Tổ Trưởng Zone Admin';
      case 'SUPER_ADMIN':
        return 'Lãnh Đạo MAUR';
      case 'CONTRACTOR':
        return 'Đại diện Nhà Thầu';
      case 'SURVEYOR':
      default:
        return 'Điều Tra Viên Hiện Trường';
    }
  };

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '0.75rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
      }}
    >
      {/* Brand & Station */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '0.65rem',
            background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(2, 132, 199, 0.25)',
          }}
        >
          <Train size={22} color="#ffffff" />
        </div>
        <div>
          <h1 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0, lineHeight: 1.2 }}>
            {title}
          </h1>
          <p style={{ fontSize: '0.775rem', color: '#64748b', margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            {subtitle || (
              <>
                <span>Khu vực: </span>
                <strong style={{ color: '#0284c7' }}>{user?.assignedZoneId || 'Ga S9 - Bà Quẹo'}</strong>
              </>
            )}
          </p>
        </div>
      </div>

      {/* User Profile & Logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.35rem 0.65rem',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '0.65rem',
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: '#e0f2fe',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.8rem',
            }}
          >
            {user?.fullName?.charAt(0) || 'K'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }}>
              {user?.fullName || 'Điều Tra Viên'}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
              {getRoleLabel(user?.role)}
            </span>
          </div>
        </div>

        {/* Logout button */}
        <button
          type="button"
          onClick={logout}
          className="btn btn-sm btn-secondary"
          title="Đăng xuất tài khoản"
          style={{
            padding: '0.45rem',
            color: '#ef4444',
            backgroundColor: '#fee2e2',
            borderColor: '#fecaca',
          }}
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
};
