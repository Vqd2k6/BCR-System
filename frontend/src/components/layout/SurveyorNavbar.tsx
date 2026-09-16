import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Shield, User, LogOut, Radio, RefreshCw } from 'lucide-react';

interface Props {
  title?: string;
  subtitle?: string;
}

export const SurveyorNavbar: React.FC<Props> = ({ title = 'Khảo Sát Hiện Trạng Metro 2', subtitle }) => {
  const { user, role, setRole, logout } = useAuth();

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '0.75rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '0.6rem',
            background: 'linear-gradient(135deg, #0284c7 0%, #3b82f6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)',
          }}
        >
          <Radio size={20} color="#ffffff" className="animate-pulse" />
        </div>
        <div>
          <h1 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', margin: 0, lineHeight: 1.2 }}>
            {title}
          </h1>
          <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            {subtitle || (
              <>
                <span>Khu vực: </span>
                <strong style={{ color: '#38bdf8' }}>{user?.assignedZoneId || 'Ga S9 - Bà Quẹo'}</strong>
              </>
            )}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {/* Role Quick Switcher for Demo & Testing */}
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as any)}
          style={{
            background: 'rgba(30, 41, 59, 0.8)',
            color: '#38bdf8',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '0.5rem',
            padding: '0.3rem 0.6rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
          title="Chuyển đổi vai trò để thử nghiệm"
        >
          <option value="SURVEYOR">👷 Surveyor</option>
          <option value="ZONE_ADMIN">🛡️ Zone Admin</option>
          <option value="SUPER_ADMIN">👑 Super Admin</option>
          <option value="CONTRACTOR">🏢 Nhà thầu</option>
          <option value="GUEST">👁️ Khách vãng lai</option>
        </select>

        {/* User Info & Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: '#334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255, 255, 255, 0.2)',
            }}
          >
            <User size={16} color="#94a3b8" />
          </div>
        </div>
      </div>
    </header>
  );
};
