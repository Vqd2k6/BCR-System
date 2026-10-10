import { getErrorMessage, getErrorStatus, isNotFoundError } from '@/utils/errorUtils';
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  User,
  Phone,
  CheckCircle2,
  X,
  AlertCircle,
  FileSignature,
  ShieldCheck,
  Building,
  Lock,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const UserProfileModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { user, updateProfile } = useAuth();
  const isSurveyor = user?.role === 'SURVEYOR';

  // Admin edit fields
  const [fullName, setFullName] = useState<string>(user?.fullName || '');
  const [phone, setPhone] = useState<string>(user?.phone || '');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setPhone(user.phone || '');
    }
  }, [user, isOpen]);

  if (!isOpen) return null;

  const handleAdminSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    try {
      setIsSaving(true);
      await updateProfile({
        fullName: fullName.trim(),
        phone: phone.trim() || null,
      });

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1000);
    } catch (err: unknown) {
      setErrorMessage(getErrorMessage(err, 'Không thể lưu hồ sơ'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '1.25rem',
          width: '100%',
          maxWidth: '480px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: isSurveyor ? '#e0f2fe' : '#ecfdf5',
                color: isSurveyor ? '#0284c7' : '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isSurveyor ? <ShieldCheck size={20} /> : <FileSignature size={20} />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                {isSurveyor ? 'Thẻ Định Danh Cán Bộ Khảo Sát' : 'Thông Tin Cá Nhân'}
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.7rem', color: '#64748b' }}>
                Hệ thống Khảo sát Hiện trạng Tuyến Metro Số 2 (CRLG-CRSRI-TT)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        {isSurveyor ? (
          /* ========================================================
             READ-ONLY IDENTITY CARD FOR SURVEYORS (Requirement)
             Khảo sát viên không được tự sửa SĐT và Chữ ký
             ======================================================== */
          <div style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Cảnh báo bảo mật pháp lý */}
            <div
              style={{
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '0.75rem',
                padding: '0.75rem 0.85rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem',
              }}
            >
              <Lock size={16} color="#15803d" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '0.725rem', color: '#166534', lineHeight: 1.45 }}>
                <strong>Bảo toàn pháp lý hồ sơ:</strong> Số điện thoại, mã định danh Surveyor ID và Chữ ký số mẫu được quản trị tập trung bởi <strong>Ban QLDA MAUR & Đơn vị Tư vấn Giám sát</strong>. Cán bộ không được tự ý thay đổi nhằm bảo toàn tính xác thực khi đối chiếu bồi thường.
              </div>
            </div>

            {/* Thông tin cá nhân thẻ cán bộ */}
            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '0.85rem',
                padding: '1rem',
                backgroundColor: '#f8fafc',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: '0.675rem', color: '#64748b', display: 'block' }}>Họ và tên cán bộ:</span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>{user?.fullName}</span>
                </div>
                <span
                  style={{
                    backgroundColor: '#dbeafe',
                    color: '#1d4ed8',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '6px',
                    fontSize: '0.675rem',
                    fontWeight: 700,
                  }}
                >
                  SURVEYOR
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
                <div>
                  <span style={{ fontSize: '0.675rem', color: '#64748b', display: 'block' }}>Tên tài khoản:</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, fontFamily: 'monospace', color: '#334155' }}>
                    {user?.username}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '0.675rem', color: '#64748b', display: 'block' }}>Ga / Zone phụ trách:</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0284c7' }}>
                    {user?.assignedZoneId || 'Zone_01 (Ga S1)'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
                <div>
                  <span style={{ fontSize: '0.675rem', color: '#64748b', display: 'block' }}>Số điện thoại liên hệ:</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>
                    {user?.phone || 'Chưa cập nhật'}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '0.675rem', color: '#64748b', display: 'block' }}>Mã Surveyor ID (Pháp lý):</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, fontFamily: 'monospace', color: '#0284c7' }}>
                    {user?.surveyorCode || 'P-____'}
                  </span>
                </div>
              </div>
            </div>

            {/* Khối hiển thị Chữ Ký Số Pháp Lý */}
            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '0.85rem',
                padding: '0.85rem 1rem',
                backgroundColor: '#ffffff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#334155' }}>
                  Chữ ký số mẫu (In trên Báo cáo & Biên bản):
                </span>
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    color: user?.signatureImageUrl ? '#15803d' : '#b45309',
                    backgroundColor: user?.signatureImageUrl ? '#dcfce7' : '#fef3c7',
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                >
                  {user?.signatureImageUrl ? '✓ Đã xác thực bởi Admin' : '⚠️ Chưa cấp'}
                </span>
              </div>

              {user?.signatureImageUrl ? (
                <div
                  style={{
                    height: '90px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.5rem',
                    backgroundColor: '#f8fafc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.5rem',
                  }}
                >
                  <img
                    src={user.signatureImageUrl}
                    alt="Chữ ký cán bộ"
                    style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                  />
                </div>
              ) : (
                <div
                  style={{
                    padding: '1.25rem',
                    textAlign: 'center',
                    border: '1px dashed #cbd5e1',
                    borderRadius: '0.5rem',
                    backgroundColor: '#f8fafc',
                    fontSize: '0.725rem',
                    color: '#64748b',
                  }}
                >
                  Cán bộ chưa được cài đặt chữ ký số mẫu. Vui lòng liên hệ Quản trị viên để tải lên chữ ký.
                </div>
              )}
            </div>

            {/* Nút đóng */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  backgroundColor: '#0284c7',
                  border: 'none',
                  borderRadius: '0.65rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)',
                }}
              >
                Đóng Thẻ Cán Bộ
              </button>
            </div>
          </div>
        ) : (
          /* ========================================================
             ADMIN / OTHER ROLES EDIT FORM
             ======================================================== */
          <form onSubmit={handleAdminSave} style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {errorMessage && (
              <div
                style={{
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <AlertCircle size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            {saveSuccess && (
              <div
                style={{
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  color: '#15803d',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <CheckCircle2 size={16} />
                <span>Cập nhật thông tin thành công!</span>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                Họ và tên cán bộ:
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem 0.55rem 2.2rem',
                    fontSize: '0.85rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.5rem',
                    color: '#0f172a',
                    outline: 'none',
                  }}
                />
                <User size={15} color="#94a3b8" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                Số điện thoại liên hệ:
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem 0.55rem 2.2rem',
                    fontSize: '0.85rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.5rem',
                    color: '#0f172a',
                    outline: 'none',
                  }}
                />
                <Phone size={15} color="#94a3b8" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '0.65rem',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: '#475569',
                  backgroundColor: '#f1f5f9',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                }}
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSaving}
                style={{
                  flex: 2,
                  padding: '0.65rem',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  color: '#ffffff',
                  backgroundColor: isSaving ? '#94a3b8' : '#059669',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                }}
              >
                {isSaving ? 'Đang lưu...' : 'Lưu Thay Đổi'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
