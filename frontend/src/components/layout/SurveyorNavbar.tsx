import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Train, LogOut, ChevronDown, User, ShieldCheck } from 'lucide-react';

interface Props {
  title?: string;
  subtitle?: string;
}

export const SurveyorNavbar: React.FC<Props> = ({ title = 'Khảo Sát Thực Địa Metro 2', subtitle }) => {
  const { user, logout } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        padding: '0.65rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
      }}
    >
      {/* Brand & Station Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '0.6rem',
            background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
          }}
        >
          <Train size={20} color="#ffffff" />
        </div>
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              fontSize: '0.925rem',
              fontWeight: 800,
              color: '#0f172a',
              margin: 0,
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </h1>
          <p
            style={{
              fontSize: '0.75rem',
              color: '#64748b',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {subtitle || (
              <>
                <span>Khu vực:</span>
                <strong style={{ color: '#0284c7' }}>{user?.assignedZoneId || 'Ga S9 - Bà Quẹo'}</strong>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Clickable User Profile Badge with Dropdown Popup */}
      <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => setShowProfileMenu(!showProfileMenu)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.35rem 0.55rem',
            backgroundColor: showProfileMenu ? '#e0f2fe' : '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '0.65rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.75rem',
            }}
          >
            {user?.fullName?.charAt(0) || 'N'}
          </div>

          <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column' }}>
            <span
              style={{
                fontSize: '0.775rem',
                fontWeight: 700,
                color: '#0f172a',
                lineHeight: 1.1,
                maxWidth: '120px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {user?.fullName || 'Điều Tra Viên'}
            </span>
            <span style={{ fontSize: '0.65rem', color: '#64748b', lineHeight: 1 }}>
              {user?.assignedZoneId ? 'Ga S9' : 'Surveyor'}
            </span>
          </div>

          <ChevronDown size={14} color="#64748b" style={{ transform: showProfileMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>

        {/* Profile & Logout Dropdown Menu */}
        {showProfileMenu && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              width: '240px',
              backgroundColor: '#ffffff',
              borderRadius: '0.75rem',
              border: '1px solid #e2e8f0',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
              padding: '0.75rem',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
            }}
          >
            <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>
                {user?.fullName}
              </div>
              <div style={{ fontSize: '0.725rem', color: '#0284c7', fontWeight: 600 }}>
                {getRoleLabel(user?.role)}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                Tài khoản: <code>{user?.username}</code>
              </div>
            </div>

            <div style={{ fontSize: '0.725rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <ShieldCheck size={14} color="#10b981" />
              <span>Phiên làm việc bảo mật JWT</span>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowProfileMenu(false);
                logout();
              }}
              className="btn btn-sm"
              style={{
                width: '100%',
                backgroundColor: '#fee2e2',
                color: '#b91c1c',
                border: '1px solid #fecaca',
                padding: '0.5rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
              }}
            >
              <LogOut size={14} />
              Đăng Xuất Tài Khoản
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
