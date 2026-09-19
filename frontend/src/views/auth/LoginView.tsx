import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Train, Lock, User, ShieldCheck, ArrowRight, CheckCircle2, Zap, UserCheck, Shield, Crown, Building2 } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('surveyor_s9_01');
  const [password, setPassword] = useState('Password@123');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    try {
      await login(username, password);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || err.response?.data?.message || 'Đăng nhập không thành công. Vui lòng kiểm tra lại tài khoản.');
    } finally {
      setLoading(false);
    }
  };

  const setDemoAccount = (u: string, p: string = 'Password@123') => {
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
              width: '52px',
              height: '52px',
              backgroundColor: '#e0f2fe',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem auto',
            }}
          >
            <Train size={30} color="#0284c7" />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.35rem 0' }}>
            HỆ THỐNG KHẢO SÁT QUY HOẠCH
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

        {/* Quick Demo Accounts Selection */}
        <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid #f1f5f9' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
            <Zap size={14} color="#0284c7" />
            <span>Chọn nhanh tài khoản để thử nghiệm:</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
            <button
              type="button"
              onClick={() => setDemoAccount('surveyor_s9_01', 'Password@123')}
              className="btn btn-secondary btn-sm"
              style={{
                fontSize: '0.75rem',
                justifyContent: 'flex-start',
                padding: '0.4rem 0.5rem',
                backgroundColor: username === 'surveyor_s9_01' ? '#e0f2fe' : '#f8fafc',
                borderColor: username === 'surveyor_s9_01' ? '#0284c7' : '#e2e8f0',
                color: username === 'surveyor_s9_01' ? '#0369a1' : '#334155',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <UserCheck size={14} />
              <span>Surveyor S9</span>
            </button>

            <button
              type="button"
              onClick={() => setDemoAccount('zoneadmin_s9', 'Admin@123')}
              className="btn btn-secondary btn-sm"
              style={{
                fontSize: '0.75rem',
                justifyContent: 'flex-start',
                padding: '0.4rem 0.5rem',
                backgroundColor: username === 'zoneadmin_s9' ? '#e0f2fe' : '#f8fafc',
                borderColor: username === 'zoneadmin_s9' ? '#0284c7' : '#e2e8f0',
                color: username === 'zoneadmin_s9' ? '#0369a1' : '#334155',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <Shield size={14} />
              <span>Zone Admin S9</span>
            </button>

            <button
              type="button"
              onClick={() => setDemoAccount('superadmin', 'Admin@123')}
              className="btn btn-secondary btn-sm"
              style={{
                fontSize: '0.75rem',
                justifyContent: 'flex-start',
                padding: '0.4rem 0.5rem',
                backgroundColor: username === 'superadmin' ? '#e0f2fe' : '#f8fafc',
                borderColor: username === 'superadmin' ? '#0284c7' : '#e2e8f0',
                color: username === 'superadmin' ? '#0369a1' : '#334155',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <Crown size={14} />
              <span>Super Admin</span>
            </button>

            <button
              type="button"
              onClick={() => setDemoAccount('contractor_guest', 'Password@123')}
              className="btn btn-secondary btn-sm"
              style={{
                fontSize: '0.75rem',
                justifyContent: 'flex-start',
                padding: '0.4rem 0.5rem',
                backgroundColor: username === 'contractor_guest' ? '#e0f2fe' : '#f8fafc',
                borderColor: username === 'contractor_guest' ? '#0284c7' : '#e2e8f0',
                color: username === 'contractor_guest' ? '#0369a1' : '#334155',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <Building2 size={14} />
              <span>Nhà Thầu Metro</span>
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
