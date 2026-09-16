import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Train, Lock, User, ShieldCheck, ArrowRight, CheckCircle2 } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('surveyor_s9_01');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    try {
      await login(username, password);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Đăng nhập không thành công. Vui lòng kiểm tra lại tài khoản.');
    } finally {
      setLoading(false);
    }
  };

  const setDemoAccount = (u: string, p: string = 'password123') => {
    setUsername(u);
    setPassword(p);
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
          padding: '2rem 1.75rem',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* Logo & Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '1rem',
              background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              boxShadow: '0 8px 16px rgba(2, 132, 199, 0.25)',
            }}
          >
            <Train size={30} color="#ffffff" />
          </div>

          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.25rem' }}>
            HỆ THỐNG KHẢO SÁT METRO 2
          </h2>
          <p style={{ fontSize: '0.825rem', color: '#64748b', margin: 0 }}>
            Nền tảng đánh giá hiện trạng công trình (BCA) Tuyến Metro số 2
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              padding: '0.65rem 0.85rem',
              borderRadius: '0.5rem',
              fontSize: '0.8rem',
              marginBottom: '1rem',
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="form-label">Tên đăng nhập / Mã định danh</label>
            <div style={{ position: 'relative' }}>
              <User
                size={18}
                color="#94a3b8"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: '2.4rem' }}
                placeholder="Ví dụ: surveyor_s9_01"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="form-label">Mật khẩu</label>
            <div style={{ position: 'relative' }}>
              <Lock
                size={18}
                color="#94a3b8"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="password"
                className="form-control"
                style={{ paddingLeft: '2.4rem' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
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
              fontSize: '0.95rem',
              fontWeight: 700,
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

        {/* Quick Demo Accounts Selection */}
        <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem', textAlign: 'center' }}>
            ⚡ Chọn nhanh tài khoản để thử nghiệm:
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
            <button
              type="button"
              onClick={() => setDemoAccount('surveyor_s9_01')}
              className="btn btn-secondary btn-sm"
              style={{
                fontSize: '0.75rem',
                justifyContent: 'flex-start',
                padding: '0.4rem 0.5rem',
                backgroundColor: username === 'surveyor_s9_01' ? '#e0f2fe' : '#f8fafc',
                borderColor: username === 'surveyor_s9_01' ? '#0284c7' : '#e2e8f0',
                color: username === 'surveyor_s9_01' ? '#0369a1' : '#334155',
              }}
            >
              👷 Surveyor S9
            </button>

            <button
              type="button"
              onClick={() => setDemoAccount('zoneadmin_s9')}
              className="btn btn-secondary btn-sm"
              style={{
                fontSize: '0.75rem',
                justifyContent: 'flex-start',
                padding: '0.4rem 0.5rem',
                backgroundColor: username === 'zoneadmin_s9' ? '#e0f2fe' : '#f8fafc',
                borderColor: username === 'zoneadmin_s9' ? '#0284c7' : '#e2e8f0',
                color: username === 'zoneadmin_s9' ? '#0369a1' : '#334155',
              }}
            >
              🛡️ Zone Admin S9
            </button>

            <button
              type="button"
              onClick={() => setDemoAccount('superadmin')}
              className="btn btn-secondary btn-sm"
              style={{
                fontSize: '0.75rem',
                justifyContent: 'flex-start',
                padding: '0.4rem 0.5rem',
                backgroundColor: username === 'superadmin' ? '#e0f2fe' : '#f8fafc',
                borderColor: username === 'superadmin' ? '#0284c7' : '#e2e8f0',
                color: username === 'superadmin' ? '#0369a1' : '#334155',
              }}
            >
              👑 Super Admin
            </button>

            <button
              type="button"
              onClick={() => setDemoAccount('contractor_01')}
              className="btn btn-secondary btn-sm"
              style={{
                fontSize: '0.75rem',
                justifyContent: 'flex-start',
                padding: '0.4rem 0.5rem',
                backgroundColor: username === 'contractor_01' ? '#e0f2fe' : '#f8fafc',
                borderColor: username === 'contractor_01' ? '#0284c7' : '#e2e8f0',
                color: username === 'contractor_01' ? '#0369a1' : '#334155',
              }}
            >
              🏢 Nhà Thầu Metro
            </button>
          </div>
        </div>

        {/* Footer Security Note */}
        <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.7rem', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
          <ShieldCheck size={14} color="#10b981" />
          <span>Bảo mật JWT RBAC • Chứng chỉ số Ban Quản Lý MAUR</span>
        </div>
      </div>
    </div>
  );
};
