import React from 'react';
import { MapContainer, TileLayer, Polygon, Tooltip, ZoomControl } from 'react-leaflet';
import { CheckCircle, ShieldCheck, CheckCircle2, Check } from 'lucide-react';
import type { CadastralParcelData, MutationPayloadData } from '../../../shared/types';
import { MapBoundsController, HelpBadge } from '../../../shared/MapControllers';

interface MatchPanelProps {
  parcelData: CadastralParcelData;
  totalLandArea: number;
  realActiveCoords: [number, number][];
  activeCentroid: [number, number];
  tileMode: 'osm' | 'satellite';
  setTileMode: (mode: 'osm' | 'satellite') => void;
  mutationData: MutationPayloadData;
  onMutationDataChange: (data: MutationPayloadData) => void;
  onToastMessage?: (msg: string) => void;
}

export const MatchPanel: React.FC<MatchPanelProps> = ({
  parcelData,
  totalLandArea,
  realActiveCoords,
  activeCentroid,
  tileMode,
  setTileMode,
  mutationData,
  onMutationDataChange,
  onToastMessage,
}) => {
  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #86efac',
        borderRadius: '0.75rem',
        padding: '0.85rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', color: '#15803d', fontWeight: 800, fontSize: '0.825rem' }}>
          <CheckCircle size={17} style={{ marginRight: '0.35rem' }} />
          <span>Bản Đồ Đối Soát Ranh GIS (Thửa hiện tại)</span>
          <HelpBadge
            title="Khớp Ranh 100%"
            content="Công trình xây dựng trọn vẹn 100% diện tích thửa đất địa chính ban đầu. Không có tranh chấp ranh hay biến động diện tích."
          />
        </div>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <button
            type="button"
            onClick={() => setTileMode('osm')}
            style={{
              padding: '0.2rem 0.5rem',
              borderRadius: '0.3rem',
              fontSize: '0.675rem',
              fontWeight: 700,
              backgroundColor: tileMode === 'osm' ? '#0284c7' : '#f1f5f9',
              color: tileMode === 'osm' ? '#ffffff' : '#475569',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Bản đồ đường
          </button>
          <button
            type="button"
            onClick={() => setTileMode('satellite')}
            style={{
              padding: '0.2rem 0.5rem',
              borderRadius: '0.3rem',
              fontSize: '0.675rem',
              fontWeight: 700,
              backgroundColor: tileMode === 'satellite' ? '#0284c7' : '#f1f5f9',
              color: tileMode === 'satellite' ? '#ffffff' : '#475569',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Vệ tinh
          </button>
        </div>
      </div>

      <div
        style={{
          width: '100%',
          height: '260px',
          borderRadius: '0.65rem',
          overflow: 'hidden',
          border: '1.5px solid #cbd5e1',
          position: 'relative',
        }}
      >
        <MapContainer
          center={activeCentroid}
          zoom={18}
          maxZoom={22}
          zoomControl={false}
          style={{ width: '100%', height: '100%' }}
          scrollWheelZoom={true}
        >
          <MapBoundsController coords={realActiveCoords} zoom={18} />
          <ZoomControl position="bottomright" />

          {tileMode === 'satellite' ? (
            <TileLayer
              attribution="Esri World Imagery"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxNativeZoom={19}
              maxZoom={22}
            />
          ) : (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxNativeZoom={19}
              maxZoom={22}
            />
          )}

          <Polygon
            positions={realActiveCoords}
            pathOptions={{
              color: '#16a34a',
              fillColor: '#22c55e',
              fillOpacity: 0.45,
              weight: 3.5,
            }}
          >
            <Tooltip direction="top">
              <div style={{ fontSize: '0.725rem', fontWeight: 800, color: '#15803d' }}>
                {parcelData.projectParcelCode} ({totalLandArea} m²)
              </div>
            </Tooltip>
          </Polygon>
        </MapContainer>

        <div
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            zIndex: 800,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            color: '#15803d',
            fontSize: '0.7rem',
            fontWeight: 700,
            padding: '0.2rem 0.5rem',
            borderRadius: '0.4rem',
            border: '1px solid #86efac',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
        >
          <CheckCircle size={13} color="#16a34a" />
          <span>Đơn thửa: {totalLandArea} m²</span>
        </div>
      </div>

      {/* XÁC NHẬN KHỚP RANH 100% */}
      <div
        style={{
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '0.65rem',
          padding: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.55rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#166534', fontSize: '0.8rem', fontWeight: 800 }}>
          <ShieldCheck size={17} color="#16a34a" />
          <span>Xác Nhận Hiện Trạng: Ranh Xây Dựng Khớp 100% Thửa Đất</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.4rem', fontSize: '0.725rem', color: '#334155' }}>
          <div style={{ backgroundColor: '#ffffff', padding: '0.35rem 0.55rem', borderRadius: '0.35rem', border: '1px solid #dcfce7' }}>
            Mã DA: <strong style={{ color: '#15803d' }}>{parcelData.projectParcelCode}</strong>
          </div>
          <div style={{ backgroundColor: '#ffffff', padding: '0.35rem 0.55rem', borderRadius: '0.35rem', border: '1px solid #dcfce7' }}>
            Mã gốc: <strong style={{ color: '#15803d' }}>{parcelData.officialCadastralCode}</strong>
          </div>
          <div style={{ backgroundColor: '#ffffff', padding: '0.35rem 0.55rem', borderRadius: '0.35rem', border: '1px solid #dcfce7' }}>
            Diện tích: <strong style={{ color: '#15803d' }}>{totalLandArea} m²</strong> (100%)
          </div>
        </div>

        {/* Phản hồi trực quan sau khi xác nhận khớp ranh */}
        {mutationData.activeProposalType === 'MATCH' && mutationData.matchConfirmed && (
          <div
            style={{
              backgroundColor: '#ecfdf5',
              border: '1.5px solid #10b981',
              borderRadius: '0.5rem',
              padding: '0.55rem 0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              color: '#065f46',
              fontSize: '0.725rem',
              fontWeight: 700,
              marginTop: '0.2rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <CheckCircle2 size={16} color="#059669" />
              <span>
                ✓ Đã xác nhận công trình khớp 100% ranh thửa đất {parcelData.projectParcelCode} ({mutationData.submittedAt || 'Đã ghi nhận'}). Đề xuất được lưu trong hồ sơ thửa ban đầu.
              </span>
            </div>
            <button
              type="button"
              onClick={() => onMutationDataChange({ ...mutationData, matchConfirmed: false, activeProposalType: null })}
              style={{
                background: 'none',
                border: 'none',
                color: '#6b7280',
                fontSize: '0.675rem',
                textDecoration: 'underline',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Xác nhận lại
            </button>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
          <button
            type="button"
            onClick={() => {
              const nowStr = new Date().toLocaleTimeString('vi-VN');
              onMutationDataChange({
                ...mutationData,
                activeProposalType: 'MATCH',
                matchConfirmed: true,
                isSubmitted: false,
                submittedAt: nowStr,
              });
              if (onToastMessage) {
                onToastMessage(`✓ Đã xác nhận thửa ${parcelData.projectParcelCode} khớp ranh 100%!`);
              }
            }}
            className="btn btn-primary btn-sm"
            style={{
              backgroundColor: (mutationData.activeProposalType === 'MATCH' && mutationData.matchConfirmed) ? '#059669' : '#16a34a',
              borderColor: (mutationData.activeProposalType === 'MATCH' && mutationData.matchConfirmed) ? '#059669' : '#16a34a',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '0.4rem 0.85rem',
              boxShadow: (mutationData.activeProposalType === 'MATCH' && mutationData.matchConfirmed) ? '0 0 0 3px rgba(16, 185, 129, 0.25)' : 'none',
            }}
          >
            {(mutationData.activeProposalType === 'MATCH' && mutationData.matchConfirmed) ? <CheckCircle2 size={15} /> : <Check size={14} />}
            <span>{(mutationData.activeProposalType === 'MATCH' && mutationData.matchConfirmed) ? 'ĐÃ XÁC NHẬN KHỚP RANH 100%' : 'Xác nhận Khớp ranh 100%'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
