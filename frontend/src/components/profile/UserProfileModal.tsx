import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  User,
  Phone,
  PenTool,
  Upload,
  CheckCircle2,
  X,
  AlertCircle,
  FileSignature,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const UserProfileModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { user, updateProfile } = useAuth();

  const [fullName, setFullName] = useState<string>(user?.fullName || '');
  const [phone, setPhone] = useState<string>(user?.phone || '');
  const [signatureMode, setSignatureMode] = useState<'upload' | 'draw'>('upload');
  const [signaturePreview, setSignaturePreview] = useState<string | null>(user?.signatureImageUrl || null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Canvas drawing ref & state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setPhone(user.phone || '');
      setSignaturePreview(user.signatureImageUrl || null);
    }
  }, [user, isOpen]);

  if (!isOpen) return null;

  // Tính toán trước mã Surveyor ID từ SĐT
  const digits = phone.replace(/\D/g, '');
  const previewSurveyorCode = digits.length >= 4 ? `P-${digits.slice(-4)}` : null;

  // Xử lý tải ảnh chữ ký từ máy
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Vui lòng chọn file hình ảnh (PNG, JPG, JPEG).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage('Kích thước ảnh chữ ký tối đa là 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setSignaturePreview(dataUrl);
      setErrorMessage(null);
    };
    reader.readAsDataURL(file);
  };

  // Canvas handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0284c7';
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignaturePreview(canvas.toDataURL('image/png'));
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignaturePreview(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (user?.role === 'SURVEYOR' && (!phone || phone.replace(/\D/g, '').length < 8)) {
      setErrorMessage('Đối với Khảo sát viên hiện trường, Số điện thoại bắt buộc phải có ít nhất 8 chữ số để định danh mã P-XXXX.');
      return;
    }

    try {
      setIsSaving(true);
      await updateProfile({
        fullName: fullName.trim(),
        phone: phone.trim() || null,
        signatureImageUrl: signaturePreview || null,
      });

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Không thể lưu hồ sơ');
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
          borderRadius: '1rem',
          width: '100%',
          maxWidth: '520px',
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
                borderRadius: '8px',
                backgroundColor: '#e0f2fe',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileSignature size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                Hồ Sơ & Chữ Ký Cán Bộ Hiện Trường
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.725rem', color: '#64748b' }}>
                Quy chuẩn định danh Liên danh CRLG & MAUR Tuyến Metro 2
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

        {/* Form Body */}
        <form onSubmit={handleSave} style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
              <span>Cập nhật hồ sơ và mã Surveyor ID thành công!</span>
            </div>
          )}

          {/* Account Overview Badges */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '0.65rem',
              backgroundColor: '#f8fafc',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid #f1f5f9',
            }}
          >
            <div>
              <span style={{ fontSize: '0.675rem', color: '#64748b', display: 'block' }}>Tên đăng nhập:</span>
              <strong style={{ fontSize: '0.8rem', color: '#0f172a' }}>{user?.username}</strong>
            </div>
            <div>
              <span style={{ fontSize: '0.675rem', color: '#64748b', display: 'block' }}>Vai trò hệ thống:</span>
              <strong style={{ fontSize: '0.8rem', color: '#0284c7' }}>
                {user?.role === 'SURVEYOR'
                  ? 'Khảo sát viên hiện trường'
                  : user?.role === 'ZONE_ADMIN'
                  ? 'Tổ trưởng Phân khu'
                  : user?.role === 'SUPER_ADMIN'
                  ? 'Ban QLDA MAUR'
                  : 'Nhà thầu TBM'}
              </strong>
            </div>
          </div>

          {/* Full Name Input */}
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
                placeholder="VD: Nguyễn Văn Khảo Sát"
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

          {/* Phone Number Input & Surveyor ID Auto-generator */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
              Số điện thoại liên hệ (Bắt buộc với Surveyor):
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="VD: 0903456789"
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

            {/* LIVE SURVEYOR ID PREVIEW BOX (Feedback #01) */}
            <div
              style={{
                marginTop: '0.5rem',
                backgroundColor: '#e0f2fe',
                border: '1px solid #bae6fd',
                borderRadius: '0.5rem',
                padding: '0.65rem 0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <span style={{ fontSize: '0.7rem', color: '#0369a1', fontWeight: 700, display: 'block' }}>
                  MÃ ĐỊNH DANH SURVEYOR ID (BÁO CÁO PHÁP LÝ):
                </span>
                <span style={{ fontSize: '0.675rem', color: '#0284c7' }}>
                  Quy ước: <code>P-XXXX</code> (với XXXX là 4 số cuối SĐT)
                </span>
              </div>
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: '1rem',
                  fontWeight: 800,
                  color: previewSurveyorCode ? '#0369a1' : '#94a3b8',
                  backgroundColor: '#ffffff',
                  padding: '0.2rem 0.65rem',
                  borderRadius: '0.35rem',
                  border: '1px solid #7dd3fc',
                  letterSpacing: '1px',
                }}
              >
                {previewSurveyorCode || 'P-____'}
              </div>
            </div>
          </div>

          {/* Legal Signature Section (Section 6 in Feedback #01) */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
                Ảnh chữ ký pháp lý (Chèn vào Báo cáo & Biên bản):
              </label>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button
                  type="button"
                  onClick={() => setSignatureMode('upload')}
                  style={{
                    padding: '0.2rem 0.5rem',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    background: signatureMode === 'upload' ? '#0284c7' : '#ffffff',
                    color: signatureMode === 'upload' ? '#ffffff' : '#475569',
                    cursor: 'pointer',
                  }}
                >
                  Tải file ảnh
                </button>
                <button
                  type="button"
                  onClick={() => setSignatureMode('draw')}
                  style={{
                    padding: '0.2rem 0.5rem',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    background: signatureMode === 'draw' ? '#0284c7' : '#ffffff',
                    color: signatureMode === 'draw' ? '#ffffff' : '#475569',
                    cursor: 'pointer',
                  }}
                >
                  Ký tay cảm ứng
                </button>
              </div>
            </div>

            {signatureMode === 'upload' ? (
              <div
                style={{
                  border: '2px dashed #cbd5e1',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  textAlign: 'center',
                  backgroundColor: '#f8fafc',
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg"
                  onChange={handleFileUpload}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0,
                    cursor: 'pointer',
                    width: '100%',
                    height: '100%',
                  }}
                />
                <Upload size={24} color="#0284c7" style={{ margin: '0 auto 0.35rem auto' }} />
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
                  Bấm để chọn file ảnh chữ ký (PNG, JPG)
                </div>
                <div style={{ fontSize: '0.675rem', color: '#64748b', marginTop: '2px' }}>
                  Khuyến nghị ảnh chữ ký rõ nét trên nền trắng hoặc PNG trong suốt (Max: 2MB)
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <canvas
                  ref={canvasRef}
                  width={460}
                  height={130}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  style={{
                    width: '100%',
                    height: '130px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.5rem',
                    cursor: 'crosshair',
                    touchAction: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={clearCanvas}
                  style={{
                    alignSelf: 'flex-end',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.675rem',
                    color: '#64748b',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <RotateCcw size={11} />
                  <span>Xóa chữ ký vẽ lại</span>
                </button>
              </div>
            )}

            {/* Signature Preview */}
            {signaturePreview && (
              <div
                style={{
                  marginTop: '0.65rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.5rem',
                  padding: '0.65rem',
                  backgroundColor: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Ảnh chữ ký hiện tại:</span>
                  <img
                    src={signaturePreview}
                    alt="Chữ ký"
                    style={{ height: '48px', objectFit: 'contain', marginTop: '4px' }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setSignaturePreview(null)}
                  style={{
                    fontSize: '0.7rem',
                    color: '#ef4444',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Xóa ảnh
                </button>
              </div>
            )}
          </div>

          {/* Footer Actions */}
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
                backgroundColor: isSaving ? '#94a3b8' : '#0284c7',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                boxShadow: '0 4px 6px -1px rgba(2, 132, 199, 0.25)',
              }}
            >
              {isSaving ? (
                <span>Đang lưu...</span>
              ) : (
                <>
                  <ShieldCheck size={16} />
                  <span>Lưu Hồ Sơ & Surveyor ID</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
