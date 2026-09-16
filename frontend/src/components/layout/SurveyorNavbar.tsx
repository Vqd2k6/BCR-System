import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Train, LogOut, ShieldCheck } from 'lucide-react';

interface Props {
  title?: string;
  subtitle?: string;
}

export const SurveyorNavbar: React.FC<Props> = ({ title = 'Khảo Sát Thực Địa Metro 2', subtitle }) => {
  const { user, logout } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false);
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [lastScrollY, setLastScrollY] = useState<number>(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // Auto-hide navbar when scrolling down, show when scrolling up
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 60) {
        // Scrolling DOWN -> Hide navbar
        setIsVisible(false);
        setShowProfileMenu(false);
      } else {
        // Scrolling UP -> Show navbar
        setIsVisible(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  // Click outside to close profile popup
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
        transform: isVisible ? 'translateY(0)' : 'translateY(-100%)',
        transition: 'transform 0.25s ease-in-out',
      }}
    >
      {/* Brand & Station Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: 1 }}>
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
        <div style={{ minWidth: 0, overflow: 'hidden' }}>
          <h1
            style={{
              fontSize: '0.95rem',
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
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {subtitle || (
              <>
                Khu vực: <strong style={{ color: '#0284c7' }}>{user?.assignedZoneId || 'Ga S9 - Bà Quẹo'}</strong>
              </>
            )}
          </p>
        </div>
      </div>

      {/* ONLY CIRCULAR AVATAR (Requirement 1) */}
      <div ref={menuRef} style={{ position: 'relative', flexShrink: 0, marginLeft: '0.5rem' }}>
        <button
          type="button"
          onClick={() => setShowProfileMenu(!showProfileMenu)}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: showProfileMenu ? '#0284c7' : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '0.85rem',
            border: '2px solid #ffffff',
            boxShadow: '0 2px 6px rgba(2, 132, 199, 0.35)',
            cursor: 'pointer',
            transition: 'transform 0.15s ease',
          }}
          title={user?.fullName || 'Tài khoản người dùng'}
        >
          {user?.fullName?.charAt(0) || 'N'}
        </button>

        {/* Profile Details & Logout Dropdown */}
        {showProfileMenu && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: '240px',
              backgroundColor: '#ffffff',
              borderRadius: '0.75rem',
              border: '1px solid #e2e8f0',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
              padding: '0.85rem',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
            }}
          >
            <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0f172a' }}>
                {user?.fullName}
              </div>
              <div style={{ fontSize: '0.725rem', color: '#0284c7', fontWeight: 600, marginTop: '2px' }}>
                {getRoleLabel(user?.role)}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                Khu vực: <strong>{user?.assignedZoneId || 'Ga S9 - Bà Quẹo'}</strong>
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
