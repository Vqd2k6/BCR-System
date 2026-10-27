import { getErrorMessage } from '@/utils/errorUtils';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Lock, User, ShieldCheck, ArrowRight, AlertTriangle } from 'lucide-react';

interface Props {
  onNavigatePublicPortal?: () => void;
}

export const LoginView: React.FC<Props> = ({ onNavigatePublicPortal }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lockoutNotice, setLockoutNotice] = useState<string | null>(null);

  useEffect(() => {
    try {
      const reason = sessionStorage.getItem('metro2_auth_lockout_reason');
      if (reason) {
        setLockoutNotice(reason);
        sessionStorage.removeItem('metro2_auth_lockout_reason');
      }
    } catch (_err: unknown) {
      console.warn('[LoginView:useEffect] Không thể đọc metro2_auth_lockout_reason:', _err);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setLockoutNotice(null);
    try {
      await login(username, password);
    } catch (err: unknown) {
      console.error('[LoginView:handleSubmit] Lỗi đăng nhập:', err);
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
        backgroundColor: 'rgb(var(--bg-slate-50))',
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
          border: '1px solid rgb(var(--border-slate-200))',
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
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'rgb(var(--text-slate-900))', margin: '0 0 0.35rem 0' }}>
            BUILDING CONDITION SURVEY MRT LINE-2 SYSTEM
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'rgb(var(--text-slate-500))', margin: 0 }}>
            Dự án Tuyến Tàu Điện Ngầm Tuyến Số 2 TP.HCM (Metro Tuyến 2)
          </p>
        </div>

        {/* Lockout / Session Revoked Banner (Phương án A) */}
        {lockoutNotice && (
          <div className="mb-4 rounded-xl bg-amber-50 border border-amber-300 p-3 text-xs text-amber-900 space-y-1">
            <div className="flex items-center gap-1.5 font-extrabold text-amber-800">
              <AlertTriangle size={15} className="shrink-0 text-amber-600" />
              <span>Phiên làm việc đã bị ngắt kết nối</span>
            </div>
            <p className="m-0 font-semibold leading-relaxed">{lockoutNotice}</p>
            <p className="m-0 text-[11px] text-amber-700">
              💡 <strong>An toàn dữ liệu:</strong> Toàn bộ bản nháp khảo sát đang nhập dở trên thiết bị của bạn vẫn được bảo toàn nguyên vẹn.
            </p>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'rgb(var(--bg-red-100))',
              border: '1px solid rgb(var(--border-red-300))',
              borderRadius: '0.5rem',
              color: 'rgb(var(--text-red-700))',
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
            className="btn btn-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgb(var(--border-slate-100))' }}>
            <button
              type="button"
              onClick={onNavigatePublicPortal}
              className="cursor-pointer hover:opacity-90 active:scale-95 transition-all"
              style={{
                width: '100%',
                padding: '0.6rem 0.8rem',
                backgroundColor: 'rgb(var(--bg-green-50))',
                border: '1px solid rgb(var(--border-green-200))',
                borderRadius: '0.75rem',
                color: 'rgb(var(--text-green-700))',
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
