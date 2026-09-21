import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Train, LogOut, ShieldCheck, Clock, CheckCircle2, AlertCircle, Users, UserCheck } from 'lucide-react';

interface Props {
  title?: string;
  subtitle?: string;
  onNavigateToCheckIn?: () => void;
  onOpenCompanionCheckIn?: () => void;
  onNavigateHome?: () => void;
  isCheckedInToday?: boolean;
}

export const SurveyorNavbar: React.FC<Props> = ({
  title = 'Khảo Sát Thực Địa Metro 2',
  subtitle,
  onNavigateToCheckIn,
  onOpenCompanionCheckIn,
  onNavigateHome,
  isCheckedInToday,
}) => {
  const { user, logout } = useAuth();
  const todayStr = new Date().toISOString().split('T')[0];
  const isCompanionCheckedIn = !!localStorage.getItem(`metro2_companion_checkin_${todayStr}`);
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
        padding: '0.4rem 0.85rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        transform: isVisible ? 'translateY(0)' : 'translateY(-100%)',
        transition: 'transform 0.25s ease-in-out',
        height: '46px',
      }}
    >
      {/* Brand & Station Info (Clickable to Home) */}
      <div
        onClick={onNavigateHome}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.55rem',
          minWidth: 0,
          flex: 1,
          cursor: onNavigateHome ? 'pointer' : 'default',
        }}
        title="Quay về Trang chủ Danh sách Khảo sát"
      >
        <div
          style={{
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <img
            src="/logo.png"
            alt="MITECHYX Logo"
            style={{
              height: '26px',
              maxWidth: '85px',
              objectFit: 'contain',
            }}
          />
        </div>
        <div style={{ minWidth: 0, overflow: 'hidden' }}>
          <h1
            style={{
              fontSize: '0.875rem',
              fontWeight: 800,
              color: '#0f172a',
              margin: 0,
              lineHeight: 1.15,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </h1>
          <p
            style={{
              fontSize: '0.7rem',
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
      <div ref={menuRef} style={{ position: 'relative', flexShrink: 0, marginLeft: '0.4rem' }}>
        <button
          type="button"
          onClick={() => setShowProfileMenu(!showProfileMenu)}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: showProfileMenu ? '#0284c7' : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '0.8rem',
            border: '2px solid #ffffff',
            boxShadow: '0 2px 5px rgba(2, 132, 199, 0.3)',
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

            {/* Chấm công GPS trực tiếp trong Thông tin cá nhân */}
            <div
              style={{
                backgroundColor: isCheckedInToday ? '#f0fdf4' : '#fffbeb',
                border: isCheckedInToday ? '1px solid #bbf7d0' : '1px solid #fde68a',
                borderRadius: '0.5rem',
                padding: '0.55rem 0.65rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 700, color: isCheckedInToday ? '#166534' : '#92400e' }}>
                  <Clock size={14} color={isCheckedInToday ? '#16a34a' : '#d97706'} />
                  <span>Điểm danh GPS</span>
                </div>
                <span
                  className="badge"
                  style={{
                    backgroundColor: isCheckedInToday ? '#dcfce7' : '#fef3c7',
                    color: isCheckedInToday ? '#15803d' : '#b45309',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    padding: '0.1rem 0.35rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                  }}
                >
                  {isCheckedInToday && <CheckCircle2 size={10} />}
                  <span>{isCheckedInToday ? 'Đã điểm danh' : 'Chưa điểm danh'}</span>
                </span>
              </div>

              {onNavigateToCheckIn && (
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    onNavigateToCheckIn();
                  }}
                  className={isCheckedInToday ? 'btn btn-secondary btn-sm' : 'btn btn-warning btn-sm'}
                  style={{
                    width: '100%',
                    padding: '0.35rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.3rem',
                  }}
                >
                  <Clock size={12} />
                  <span>{isCheckedInToday ? 'Xem chi tiết điểm danh' : 'Chấm công GPS ngay'}</span>
                </button>
              )}
            </div>

            {/* Điểm danh Cán bộ đi kèm trong Profile */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '0.5rem',
                padding: '0.55rem 0.65rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 700, color: '#0f172a' }}>
                  <Users size={14} color="#0284c7" />
                  <span>Cán bộ đi kèm</span>
                </div>
                <span
                  className="badge"
                  style={{
                    backgroundColor: isCompanionCheckedIn ? '#dcfce7' : '#fef3c7',
                    color: isCompanionCheckedIn ? '#15803d' : '#b45309',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    padding: '0.1rem 0.35rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                  }}
                >
                  {isCompanionCheckedIn && <CheckCircle2 size={10} />}
                  <span>{isCompanionCheckedIn ? 'Đã điểm danh' : 'Chưa điểm danh'}</span>
                </span>
              </div>

              {onOpenCompanionCheckIn && (
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    onOpenCompanionCheckIn();
                  }}
                  className={isCompanionCheckedIn ? 'btn btn-secondary btn-sm' : 'btn btn-warning btn-sm'}
                  style={{
                    width: '100%',
                    padding: '0.35rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.3rem',
                  }}
                >
                  <UserCheck size={12} />
                  <span>{isCompanionCheckedIn ? 'Xem thông tin người đi kèm' : 'Điểm danh người đi kèm'}</span>
                </button>
              )}
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
