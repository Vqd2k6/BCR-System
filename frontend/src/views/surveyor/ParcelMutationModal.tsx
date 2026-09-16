import React, { useState } from 'react';
import { Layers, Plus, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';
import { GisParcel } from '../../components/gis/LeafletSweepMap';

interface Props {
  parcel: GisParcel;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}

export const ParcelMutationModal: React.FC<Props> = ({ parcel, isOpen, onClose, onSubmit }) => {
  const [mutationType, setMutationType] = useState<'SPLIT' | 'MERGE'>('SPLIT');
  const [reason, setReason] = useState<string>('Thực tế công trình đã tách làm 2 hộ riêng biệt độc lập');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sub parcels
  const [subParcels, setSubParcels] = useState<Array<{ code: string; houseNo: string; area: number; owner: string }>>([
    { code: `${parcel.projectParcelCode}.1`, houseNo: `${parcel.houseNumber}A`, area: 45.5, owner: 'Hộ gia đình nhánh A' },
    { code: `${parcel.projectParcelCode}.2`, houseNo: `${parcel.houseNumber}B`, area: 42.0, owner: 'Hộ gia đình nhánh B' },
  ]);

  if (!isOpen) return null;

  const handleAddSubParcel = () => {
    const nextIdx = subParcels.length + 1;
    setSubParcels([
      ...subParcels,
      {
        code: `${parcel.projectParcelCode}.${nextIdx}`,
        houseNo: `${parcel.houseNumber}/${nextIdx}`,
        area: 40.0,
        owner: `Hộ gia đình mới ${nextIdx}`,
      },
    ]);
  };

  const handleRemoveSubParcel = (idx: number) => {
    setSubParcels(subParcels.filter((_, i) => i !== idx));
  };

  const handleUpdateSubParcel = (idx: number, field: string, val: any) => {
    const updated = [...subParcels];
    (updated[idx] as any)[field] = val;
    setSubParcels(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit({
        originalParcelId: parcel.id,
        mutationType,
        reason,
        subParcels,
        notes,
      });
      setSuccessMessage('Đã gửi đề xuất Tách/Gộp thửa đất thành công đến Zone Admin để phê duyệt!');
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1800);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1050,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(168, 85, 247, 0.4)',
          borderRadius: '1rem',
          padding: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(168, 85, 247, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={18} color="#c084fc" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc' }}>
                Đề xuất Biến động Thửa đất (Tách/Gộp)
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                Thửa gốc: <strong style={{ color: '#38bdf8' }}>{parcel.projectParcelCode}</strong> ({parcel.officialCadastralCode}) - Số {parcel.houseNumber} {parcel.street}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {successMessage ? (
          <div style={{ padding: '2rem 1rem', textAlign: 'center' }}>
            <CheckCircle size={48} color="#10b981" style={{ margin: '0 auto 1rem' }} />
            <h4 style={{ color: '#10b981', margin: '0 0 0.5rem' }}>Đề xuất thành công!</h4>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{successMessage}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="form-label">Loại biến động</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setMutationType('SPLIT')}
                  className={`btn btn-sm ${mutationType === 'SPLIT' ? 'btn-primary' : ''}`}
                  style={{
                    flex: 1,
                    background: mutationType === 'SPLIT' ? '#7c3aed' : 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    color: '#fff',
                  }}
                >
                  Tách thửa (1 thành nhiều thửa con)
                </button>
                <button
                  type="button"
                  onClick={() => setMutationType('MERGE')}
                  className={`btn btn-sm ${mutationType === 'MERGE' ? 'btn-primary' : ''}`}
                  style={{
                    flex: 1,
                    background: mutationType === 'MERGE' ? '#7c3aed' : 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    color: '#fff',
                  }}
                >
                  Gộp thửa (Nhiều thửa thành 1)
                </button>
              </div>
            </div>

            <div>
              <label className="form-label">Lý do biến động thực địa</label>
              <textarea
                className="form-control"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ghi rõ hiện trạng thực địa khác biệt so với hồ sơ địa chính..."
                required
              />
            </div>

            {/* Sub parcels list */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label className="form-label" style={{ margin: 0 }}>Danh sách thửa sau biến động ({subParcels.length})</label>
                <button
                  type="button"
                  onClick={handleAddSubParcel}
                  className="btn btn-sm"
                  style={{
                    background: 'rgba(168, 85, 247, 0.2)',
                    color: '#c084fc',
                    border: '1px solid rgba(168, 85, 247, 0.4)',
                    padding: '0.2rem 0.5rem',
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  <Plus size={12} />
                  Thêm thửa con
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {subParcels.map((sp, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(30, 41, 59, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '0.5rem',
                      padding: '0.75rem',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr auto',
                      gap: '0.5rem',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Mã dự án mới</span>
                      <input
                        type="text"
                        className="form-control"
                        style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                        value={sp.code}
                        onChange={(e) => handleUpdateSubParcel(idx, 'code', e.target.value)}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Số nhà thực tế</span>
                      <input
                        type="text"
                        className="form-control"
                        style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                        value={sp.houseNo}
                        onChange={(e) => handleUpdateSubParcel(idx, 'houseNo', e.target.value)}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Diện tích (m²)</span>
                      <input
                        type="number"
                        step="0.1"
                        className="form-control"
                        style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                        value={sp.area}
                        onChange={(e) => handleUpdateSubParcel(idx, 'area', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => handleRemoveSubParcel(idx)}
                        disabled={subParcels.length <= 1}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: subParcels.length <= 1 ? '#475569' : '#f87171',
                          cursor: subParcels.length <= 1 ? 'not-allowed' : 'pointer',
                          padding: '0.4rem',
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                background: 'rgba(234, 179, 8, 0.1)',
                border: '1px solid rgba(234, 179, 8, 0.3)',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
                color: '#fef08a',
                fontSize: '0.75rem',
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>
                Thao tác này sẽ gửi yêu cầu biến động mã dự án tới Zone Admin. Mã thửa gốc sẽ ở trạng thái chờ tách cho đến khi Admin phê duyệt.
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
                style={{ flex: 1 }}
                disabled={isSubmitting}
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 2, background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Đang gửi đề xuất...' : 'Gửi Đề Xuất Biến Động'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
