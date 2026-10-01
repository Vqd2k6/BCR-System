import React from 'react';
import { Ruler, CheckCircle, Layers, GitCompare } from 'lucide-react';
import { GisParcel, CadastralParcelData } from '../../shared/types';
import { HelpBadge } from '../../shared/MapControllers';

interface CadastralHeaderBarProps {
  parcelData: CadastralParcelData;
  parcel?: GisParcel | any;
  boundaryStatus: 'MATCH' | 'SPLIT' | 'MERGE';
  onStatusChange: (status: 'MATCH' | 'SPLIT' | 'MERGE') => void;
  frontage?: number;
  depth?: number;
  totalLandArea: number;
  buildingHeight?: number;
}

export const CadastralHeaderBar: React.FC<CadastralHeaderBarProps> = ({
  parcelData,
  parcel,
  boundaryStatus,
  onStatusChange,
  frontage,
  depth,
  totalLandArea,
  buildingHeight,
}) => {
  return (
    <>
      {/* 1. THÔNG TIN KÍCH THƯỚC THỬA ĐẤT BAN ĐẦU */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '0.75rem',
          border: '1px solid #e2e8f0',
          padding: '0.75rem 0.95rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.55rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#e0f2fe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Ruler size={17} color="#0284c7" />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center' }}>
                Kích Thước Thửa Ban Đầu
                <HelpBadge
                  title="Thông tin ranh thửa ban đầu"
                  content="Dữ liệu kích thước và ranh thửa được trích xuất từ cơ sở dữ liệu địa chính PostGIS Ga S9 Metro 2."
                />
              </div>
              <div style={{ fontSize: '0.725rem', color: '#64748b' }}>
                Mã DA: <strong style={{ color: '#0284c7' }}>{parcelData.projectParcelCode}</strong> | Mã địa chính: <strong style={{ color: '#d97706' }}>{parcelData.officialCadastralCode}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            <span
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                padding: '0.2rem 0.55rem',
                borderRadius: '0.4rem',
                fontSize: '0.725rem',
                color: '#334155',
              }}
            >
              Chiều cao: <strong style={{ color: '#0284c7' }}>{buildingHeight !== undefined && buildingHeight !== null && (buildingHeight as any) !== '' ? `${buildingHeight}m` : '—'}</strong>
            </span>
            <span
              style={{
                backgroundColor: '#e0f2fe',
                border: '1px solid #bae6fd',
                padding: '0.2rem 0.55rem',
                borderRadius: '0.4rem',
                fontSize: '0.725rem',
                color: '#0369a1',
                fontWeight: 700,
              }}
            >
              Diện tích S = {totalLandArea} m²
            </span>
          </div>
        </div>

        <div style={{ fontSize: '0.725rem', color: '#475569', borderTop: '1px solid #f1f5f9', paddingTop: '0.35rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
          <span>
            Địa chỉ: <strong>{(() => {
              const hn = parcelData.houseNumber?.trim();
              const st = parcelData.street?.trim();
              let fullAddr = '';
              if (hn && st) {
                fullAddr = hn.toLowerCase().startsWith('số') ? `${hn} ${st}` : `Số ${hn} ${st}`;
              } else if (st) {
                fullAddr = st.toLowerCase().startsWith('số') ? st : `Số ${st}`;
              } else if (hn) {
                fullAddr = hn.toLowerCase().startsWith('số') ? hn : `Số ${hn}`;
              }
              const ward = parcelData.ward || (parcel as any)?.ward || 'Phường 15';
              const dist = parcelData.district || (parcel as any)?.district || 'Quận Tân Bình';
              return fullAddr ? `${fullAddr}, ${ward}, ${dist}` : `${ward}, ${dist}`;
            })()}</strong>
          </span>
          <span>Chủ hộ: <strong>{parcelData.ownerName || (parcel as any)?.owner_name || parcel?.ownerName || 'Chưa cập nhật'}</strong></span>
        </div>
      </div>

      {/* 2. BỘ CHỌN 3 TRẠNG THÁI RANH THỰC TẾ (MATCH / SPLIT / MERGE) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.4rem' }}>
        <button
          type="button"
          onClick={() => onStatusChange('MATCH')}
          style={{
            padding: '0.6rem 0.8rem',
            borderRadius: '0.65rem',
            border: boundaryStatus === 'MATCH' ? '2px solid #16a34a' : '1px solid #cbd5e1',
            backgroundColor: boundaryStatus === 'MATCH' ? '#dcfce7' : '#ffffff',
            color: boundaryStatus === 'MATCH' ? '#15803d' : '#475569',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            textAlign: 'left',
            boxShadow: boundaryStatus === 'MATCH' ? '0 2px 4px rgba(22, 163, 74, 0.12)' : 'none',
          }}
        >
          <CheckCircle size={19} color={boundaryStatus === 'MATCH' ? '#16a34a' : '#94a3b8'} />
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>1. Khớp Ranh (MATCH)</div>
            <div style={{ fontSize: '0.675rem', opacity: 0.85 }}>Xây dựng 100% diện tích thửa</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onStatusChange('SPLIT')}
          style={{
            padding: '0.6rem 0.8rem',
            borderRadius: '0.65rem',
            border: boundaryStatus === 'SPLIT' ? '2px solid #ea580c' : '1px solid #cbd5e1',
            backgroundColor: boundaryStatus === 'SPLIT' ? '#ffedd5' : '#ffffff',
            color: boundaryStatus === 'SPLIT' ? '#c2410c' : '#475569',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            textAlign: 'left',
            boxShadow: boundaryStatus === 'SPLIT' ? '0 2px 4px rgba(234, 88, 12, 0.12)' : 'none',
          }}
        >
          <Layers size={19} color={boundaryStatus === 'SPLIT' ? '#ea580c' : '#94a3b8'} />
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>2. Tách Thửa (SPLIT)</div>
            <div style={{ fontSize: '0.675rem', opacity: 0.85 }}>Kéo nắn điểm / Chấm vẽ đa giác</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onStatusChange('MERGE')}
          style={{
            padding: '0.6rem 0.8rem',
            borderRadius: '0.65rem',
            border: boundaryStatus === 'MERGE' ? '2px solid #0284c7' : '1px solid #cbd5e1',
            backgroundColor: boundaryStatus === 'MERGE' ? '#e0f2fe' : '#ffffff',
            color: boundaryStatus === 'MERGE' ? '#0369a1' : '#475569',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            textAlign: 'left',
            boxShadow: boundaryStatus === 'MERGE' ? '0 2px 4px rgba(2, 132, 199, 0.12)' : 'none',
          }}
        >
          <GitCompare size={19} color={boundaryStatus === 'MERGE' ? '#0284c7' : '#94a3b8'} />
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>3. Gộp Thửa (MERGE)</div>
            <div style={{ fontSize: '0.675rem', opacity: 0.85 }}>Chọn nhiều thửa liền kề gộp lại</div>
          </div>
        </button>
      </div>
    </>
  );
};
