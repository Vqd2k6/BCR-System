import { getErrorMessage, getErrorStatus, isNotFoundError } from '@/utils/errorUtils';
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Lock, User, ShieldCheck, ArrowRight } from 'lucide-react';

interface Props {
  onNavigatePublicPortal?: () => void;
}

export const LoginView: React.FC<Props> = ({ onNavigatePublicPortal }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    try {
      await login(username, password);
    } catch (err: unknown) {
      setErrorMessage(getErrorMessage(err, 'Đăng nhập không thành công. Vui lòng kiểm tra lại tài khoản.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        padding: '1.25rem',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '440px',
          padding: '2rem',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
          borderRadius: '1rem',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* Header Logo & Title */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem auto',
            }}
          >
            <img
              src="/logo.png"
              alt="MITECHYX Logo"
              style={{
                height: '54px',
                maxWidth: '240px',
                objectFit: 'contain',
              }}
            />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.35rem 0' }}>
            BUILDING CONDITION SURVEY MRT LINE-2 SYSTEM
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
            Dự án Tuyến Tàu Điện Ngầm Tuyến Số 2 TP.HCM (Metro Tuyến 2)
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: '#fee2e2',
              border: '1px solid #fca5a5',
              borderRadius: '0.5rem',
              color: '#b91c1c',
              fontSize: '0.8rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="form-label">Tên Đăng Nhập / Mã Nhân Viên</label>
            <div style={{ position: 'relative' }}>
              <User
                size={18}
                color="#94a3b8"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                className="form-control"
                placeholder="VD: surveyor_s9_01"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                style={{ paddingLeft: '2.5rem' }}
              />
            </div>
          </div>

          <div>
            <label className="form-label">Mật Khẩu</label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={18}
                color="#94a3b8"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="password"
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ paddingLeft: '2.5rem' }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{
              marginTop: '0.5rem',
              padding: '0.75rem',
              fontWeight: 700,
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            {loading ? 'Đang xác thực...' : 'Đăng Nhập Hệ Thống'}
            <ArrowRight size={18} />
          </button>
        </form>



        {/* Public Citizen Portal Access */}
        {onNavigatePublicPortal && (
          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
            <button
              type="button"
              onClick={onNavigatePublicPortal}
              style={{
                width: '100%',
                padding: '0.6rem 0.8rem',
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '0.75rem',
                color: '#15803d',
                fontSize: '0.75rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <span>🔍 Tra Cứu Hồ Sơ Khảo Sát (Dành cho Chủ Hộ & Nhà Thầu)</span>
            </button>
          </div>
        )}

        {/* Footer Security Note */}
        <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.7rem', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
          <ShieldCheck size={14} color="#10b981" />
          <span>Bảo mật JWT RBAC • Chứng chỉ số Ban Quản Lý MAUR</span>
        </div>
      </div>
    </div>
  );
};
