import React from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, Marker, Tooltip, ZoomControl } from 'react-leaflet';
import {
  GitCompare,
  Layers,
  Check,
  CheckCircle,
  CheckCircle2,
  Undo,
  Trash2,
  Crosshair,
} from 'lucide-react';
import { GisParcel, CadastralParcelData, MutationPayloadData } from '../../../shared/types';
import { MapBoundsController, MapClickListener, HelpBadge } from '../../../shared/MapControllers';
import { createHandleIcon } from '../../../shared/geoMath';
import { COMMON_MERGE_REASONS } from '../../../shared/constants';

interface MergePanelProps {
  parcelData: CadastralParcelData;
  totalLandArea: number;
  realActiveCoords: [number, number][];
  activeCentroid: [number, number];
  tileMode: 'osm' | 'satellite';
  setTileMode: (mode: 'osm' | 'satellite' | ((prev: 'osm' | 'satellite') => 'osm' | 'satellite')) => void;
  currentZoneMergeParcels: GisParcel[];
  filteredMergeParcels: GisParcel[];
  selectedMergeCodes: string[];
  mergeSearchTerm: string;
  setMergeSearchTerm: (term: string) => void;
  handleToggleMergeParcel: (code: string) => void;
  mergeSummary: {
    keptCode: string;
    totalMergedArea: number;
    deprecatedCodes?: string[];
  };
  mutationData: MutationPayloadData;
  onMutationDataChange: (data: MutationPayloadData) => void;
  customMergeReason: string;
  setCustomMergeReason: (val: string) => void;
  customMergeResidualType: string;
  setCustomMergeResidualType: (val: string) => void;
  mergeBuildingVertices: [number, number][];
  calculatedMergeBArea: number;
  calculatedMergeRArea: number;
  handleMergeMapClickDraw: (latlng: [number, number]) => void;
  handleMergeRemoveLastPoint: () => void;
  handleMergeClearDraw: () => void;
  handleSaveMutationProposal: () => void;
  isSubmittingMutation: boolean;
}

export const MergePanel: React.FC<MergePanelProps> = ({
  parcelData,
  totalLandArea,
  realActiveCoords,
  activeCentroid,
  tileMode,
  setTileMode,
  currentZoneMergeParcels,
  filteredMergeParcels,
  selectedMergeCodes,
  mergeSearchTerm,
  setMergeSearchTerm,
  handleToggleMergeParcel,
  mergeSummary,
  mutationData,
  onMutationDataChange,
  customMergeReason,
  setCustomMergeReason,
  customMergeResidualType,
  setCustomMergeResidualType,
  mergeBuildingVertices,
  calculatedMergeBArea,
  calculatedMergeRArea,
  handleMergeMapClickDraw,
  handleMergeRemoveLastPoint,
  handleMergeClearDraw,
  handleSaveMutationProposal,
  isSubmittingMutation,
}) => {
  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #93c5fd',
        borderRadius: '0.75rem',
        padding: '0.85rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', color: '#0369a1', fontWeight: 800, fontSize: '0.825rem' }}>
          <GitCompare size={17} style={{ marginRight: '0.35rem' }} />
          <span>Đề Xuất Gộp Thửa Thực Địa</span>
          <HelpBadge
            title="Quy tắc Gộp thửa"
            content="Bấm chọn các thửa liền kề trên bản đồ hoặc danh sách bên dưới để gộp lại thành một công trình. Mã dự án nhỏ nhất trong nhóm sẽ được giữ lại làm mã đại diện chính thức."
          />
        </div>
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          <span className="badge" style={{ backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #93c5fd', fontSize: '0.675rem' }}>
            Giữ mã nhỏ nhất: {mergeSummary.keptCode}
          </span>
          <button
            type="button"
            onClick={() => setTileMode((prev) => (prev === 'osm' ? 'satellite' : 'osm'))}
            style={{
              padding: '0.2rem 0.5rem',
              borderRadius: '0.3rem',
              fontSize: '0.675rem',
              fontWeight: 700,
              backgroundColor: tileMode === 'satellite' ? '#0284c7' : '#f1f5f9',
              color: tileMode === 'satellite' ? '#ffffff' : '#475569',
              border: '1px solid #cbd5e1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            <span>{tileMode === 'osm' ? '🛰️ Vệ tinh' : '🗺️ Bản đồ'}</span>
          </button>
        </div>
      </div>

      <div
        style={{
          width: '100%',
          height: '280px',
          borderRadius: '0.65rem',
          overflow: 'hidden',
          border: '1.5px solid #0284c7',
          position: 'relative',
        }}
      >
        <MapContainer
          center={activeCentroid}
          zoom={17}
          maxZoom={22}
          zoomControl={false}
          style={{ width: '100%', height: '100%' }}
          scrollWheelZoom={true}
        >
          <MapBoundsController coords={realActiveCoords} zoom={17} />
          <ZoomControl position="bottomright" />

          <TileLayer
            key={tileMode}
            attribution={
              tileMode === 'satellite'
                ? 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                : '&copy; OpenStreetMap contributors &copy; CARTO'
            }
            url={
              tileMode === 'satellite'
                ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
            }
            subdomains={tileMode === 'satellite' ? undefined : 'abcd'}
            maxNativeZoom={tileMode === 'satellite' ? 19 : 19}
            maxZoom={22}
          />

          {/* 1. THỬA ĐANG KHẢO SÁT (THỬA GỐC) - HIGHLIGHT NỔI BẬT */}
          <Polygon
            positions={realActiveCoords}
            pathOptions={{
              color: '#b45309',
              fillColor: '#f59e0b',
              fillOpacity: 0.65,
              weight: 5,
            }}
          >
            <Tooltip permanent direction="center">
              <div style={{ textAlign: 'center', fontWeight: 900, color: '#7c2d12', fontSize: '0.725rem', textShadow: '0 1px 2px #fff' }}>
                ⭐ THỬA GỐC ĐANG KS<br />
                <span style={{ fontSize: '0.825rem', color: '#b45309' }}>{parcelData.projectParcelCode}</span> ({totalLandArea} m²)
              </div>
            </Tooltip>
          </Polygon>

          {/* 2. CÁC THỬA TRONG CÙNG ZONE ĐANG KHẢO SÁT (CLICK ĐỂ GỘP/BỎ GỘP) */}
          {currentZoneMergeParcels.map((neighbor) => {
            const isSelectedMerge = selectedMergeCodes.includes(neighbor.projectParcelCode);

            return (
              <Polygon
                key={neighbor.id || neighbor.projectParcelCode}
                positions={neighbor.coordinates}
                pathOptions={{
                  color: isSelectedMerge ? '#047857' : '#475569',
                  fillColor: isSelectedMerge ? '#10b981' : '#cbd5e1',
                  fillOpacity: isSelectedMerge ? 0.75 : 0.25,
                  weight: isSelectedMerge ? 4 : 1.5,
                  dashArray: isSelectedMerge ? undefined : '5, 4',
                }}
                eventHandlers={{
                  click: () => {
                    handleToggleMergeParcel(neighbor.projectParcelCode);
                  },
                }}
              >
                <Tooltip direction="top" opacity={0.95}>
                  <div style={{ fontSize: '0.725rem', fontWeight: 800 }}>
                    {isSelectedMerge ? '✓ ĐÃ CHỌN GỘP: ' : 'Thửa trong Zone: '}
                    <strong style={{ color: isSelectedMerge ? '#047857' : '#1e293b' }}>{neighbor.projectParcelCode}</strong>
                    {isSelectedMerge ? <span style={{ color: '#047857' }}> (Bấm để hủy)</span> : <span style={{ color: '#2563eb' }}> (Bấm để gộp)</span>}<br />
                    <span style={{ fontSize: '0.65rem', fontWeight: 500 }}>
                      Số {neighbor.houseNumber} {neighbor.street} {typeof (neighbor as any).distanceMeters === 'number' ? `• Cách ${(neighbor as any).distanceMeters}m` : ''}
                    </span>
                  </div>
                </Tooltip>
              </Polygon>
            );
          })}
        </MapContainer>

        {/* Chú giải trực quan phân biệt thửa gốc và các thửa trong Zone */}
        <div
          style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            zIndex: 800,
            backgroundColor: 'rgba(255, 255, 255, 0.96)',
            padding: '0.35rem 0.65rem',
            borderRadius: '0.5rem',
            fontSize: '0.675rem',
            border: '1px solid #cbd5e1',
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#b45309', fontWeight: 800 }}>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: '#f59e0b', border: '2px solid #b45309', borderRadius: '2px' }} />
            Thửa gốc đang KS ({parcelData.projectParcelCode})
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#047857', fontWeight: 700 }}>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: '#10b981', border: '2px solid #047857', borderRadius: '2px' }} />
            Đã chọn gộp ({selectedMergeCodes.length})
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#64748b' }}>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: '#e2e8f0', border: '1px dashed #475569', borderRadius: '2px' }} />
            Thửa trong Zone (Click để gộp)
          </span>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Chọn thửa đất trong Zone khảo sát ({filteredMergeParcels.length}/{currentZoneMergeParcels.length} thửa - đã chọn {selectedMergeCodes.length}):
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="Tìm mã thửa, số nhà, tên đường..."
              value={mergeSearchTerm}
              onChange={(e) => setMergeSearchTerm(e.target.value)}
              style={{
                fontSize: '0.72rem',
                padding: '0.25rem 0.5rem',
                border: '1px solid #cbd5e1',
                borderRadius: '0.375rem',
                width: '180px',
                outline: 'none',
              }}
            />
            {selectedMergeCodes.length > 0 && (
              <button
                type="button"
                onClick={() => onMutationDataChange({ ...mutationData, selectedMergeCodes: [], mergeTargetCode: '' })}
                style={{
                  border: 'none',
                  background: 'none',
                  color: '#dc2626',
                  fontSize: '0.675rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Bỏ chọn tất cả
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: '0.4rem', maxHeight: '260px', overflowY: 'auto', padding: '2px' }}>
          {filteredMergeParcels.map((adj) => {
            const isSelected = selectedMergeCodes.includes(adj.projectParcelCode);
            const distM = (adj as any).distanceMeters || 0;
            return (
              <div
                key={adj.id || adj.projectParcelCode}
                onClick={() => handleToggleMergeParcel(adj.projectParcelCode)}
                style={{
                  padding: '0.4rem 0.55rem',
                  borderRadius: '0.45rem',
                  border: isSelected ? '2px solid #0284c7' : '1px solid #cbd5e1',
                  backgroundColor: isSelected ? '#e0f2fe' : '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.775rem', fontWeight: isSelected ? 800 : 600, color: isSelected ? '#0369a1' : '#334155' }}>
                    {adj.projectParcelCode} <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 500 }}>({distM}m)</span>
                  </div>
                  <div style={{ fontSize: '0.675rem', color: '#64748b' }}>
                    Số {adj.houseNumber} {adj.street}
                  </div>
                  {adj.ownerName && adj.ownerName !== 'Chủ sở hữu phần đất dôi dư' && (
                    <div style={{ fontSize: '0.625rem', color: '#94a3b8', fontStyle: 'italic' }}>
                      {adj.ownerName}
                    </div>
                  )}
                </div>
                {isSelected && <Check size={15} color="#0284c7" />}
              </div>
            );
          })}
          {filteredMergeParcels.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '1rem', color: '#94a3b8', fontSize: '0.725rem' }}>
              {mergeSearchTerm ? 'Không tìm thấy thửa đất nào khớp với từ khóa tìm kiếm trong Zone.' : 'Không có thửa đất nào khác trong phân khu này.'}
            </div>
          )}
        </div>
      </div>

      {selectedMergeCodes.length > 0 && (
        <div
          style={{
            backgroundColor: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '0.5rem',
            padding: '0.55rem 0.75rem',
            fontSize: '0.725rem',
            color: '#0369a1',
            lineHeight: 1.5,
          }}
        >
          • <strong>Mã giữ lại:</strong> <span className="badge" style={{ backgroundColor: '#0284c7', color: '#ffffff' }}>{mergeSummary.keptCode}</span> | <strong>Tổng diện tích sau gộp:</strong> <strong>{mergeSummary.totalMergedArea} m²</strong> ({selectedMergeCodes.length + 1} thửa)
        </div>
      )}

      <div>
        <label style={{ fontSize: '0.725rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center' }}>
          Lý do gộp thửa:
          <HelpBadge
            title="Lý do gộp thửa"
            content="Chọn lý do phổ biến trong danh sách sổ chọn hoặc chọn 'Khác' để nhập chi tiết lý do công trình xây dựng hợp khối nhiều thửa."
          />
        </label>
        <select
          className="form-control"
          style={{ fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#ffffff', border: '1.5px solid #cbd5e1', marginTop: '0.2rem' }}
          value={
            COMMON_MERGE_REASONS.includes(mutationData.mergeReason || '')
              ? (mutationData.mergeReason || '')
              : (mutationData.mergeReason ? 'OTHER' : '')
          }
          onChange={(e) => {
            const val = e.target.value;
            if (val === 'OTHER') {
              onMutationDataChange({
                ...mutationData,
                mergeReason: customMergeReason ? `Khác: ${customMergeReason}` : 'Khác: ',
                isSubmitted: false,
              });
            } else {
              onMutationDataChange({
                ...mutationData,
                mergeReason: val,
                isSubmitted: false,
              });
            }
          }}
        >
          <option value="">-- Chọn lý do gộp thửa thực tế --</option>
          {COMMON_MERGE_REASONS.map((r, i) => (
            <option key={r} value={r}>
              {i + 1}. {r}
            </option>
          ))}
          <option value="OTHER">5. Khác (Nhập lý do thực tế...)</option>
        </select>

        {/* Ô nhập lý do khác khi chọn OTHER ở Gộp thửa */}
        {(mutationData.mergeReason?.startsWith('Khác') ||
          (mutationData.mergeReason && !COMMON_MERGE_REASONS.includes(mutationData.mergeReason))) && (
          <div style={{ marginTop: '0.2rem' }}>
            <input
              type="text"
              className="form-control"
              style={{ fontSize: '0.75rem', border: '1px solid #93c5fd' }}
              placeholder="Nhập lý do gộp thửa thực tế tại hiện trường..."
              value={
                customMergeReason ||
                (mutationData.mergeReason.startsWith('Khác: ')
                  ? mutationData.mergeReason.replace('Khác: ', '')
                  : mutationData.mergeReason)
              }
              onChange={(e) => {
                const text = e.target.value;
                setCustomMergeReason(text);
                onMutationDataChange({
                  ...mutationData,
                  mergeReason: text ? `Khác: ${text}` : 'Khác: ',
                  isSubmitted: false,
                });
              }}
            />
          </div>
        )}
      </div>

      {/* KHOANH VÙNG DIỆN TÍCH XÂY DỰNG & TÁCH MẢNH ĐẤT DƯ KHI GỘP */}
      <div
        style={{
          backgroundColor: '#f8fafc',
          border: '1.5px solid #cbd5e1',
          borderRadius: '0.65rem',
          padding: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Layers size={14} color="#0284c7" />
            Hiện trạng xây dựng của toà nhà trên đất sau gộp:
          </label>
          <span className="badge" style={{ backgroundColor: mutationData.mergeHasPartialBuilding ? '#ea580c' : '#0284c7', color: '#fff', fontSize: '0.675rem' }}>
            {mutationData.mergeHasPartialBuilding ? 'Xây một phần (Có đất dư)' : 'Xây kín toàn bộ'}
          </span>
        </div>

        {/* Hai tùy chọn dạng thẻ bấm */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => {
              onMutationDataChange({
                ...mutationData,
                mergeHasPartialBuilding: false,
                isSubmitted: false,
              });
            }}
            style={{
              padding: '0.55rem 0.75rem',
              borderRadius: '0.5rem',
              border: !mutationData.mergeHasPartialBuilding ? '2px solid #0284c7' : '1px solid #cbd5e1',
              backgroundColor: !mutationData.mergeHasPartialBuilding ? '#e0f2fe' : '#ffffff',
              color: !mutationData.mergeHasPartialBuilding ? '#0369a1' : '#475569',
              textAlign: 'left',
              fontSize: '0.725rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <span style={{ fontSize: '1rem' }}>🏢</span>
            <div>
              <div>Nhà xây kín toàn bộ đất gộp</div>
              <div style={{ fontSize: '0.65rem', fontWeight: 500, color: '#64748b' }}>
                Công trình chiếm 100% diện tích gộp ({mergeSummary.totalMergedArea} m²)
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              onMutationDataChange({
                ...mutationData,
                mergeHasPartialBuilding: true,
                mergeBuildingAreaM2: mutationData.mergeBuildingAreaM2 || undefined,
                mergeResidualAreaM2: mutationData.mergeResidualAreaM2 || undefined,
                mergeResidualType: mutationData.mergeResidualType || '',
                mergeResidualParcelCode: `${mergeSummary.keptCode}-P2`,
                isSubmitted: false,
              });
            }}
            style={{
              padding: '0.55rem 0.75rem',
              borderRadius: '0.5rem',
              border: mutationData.mergeHasPartialBuilding ? '2px solid #ea580c' : '1px solid #cbd5e1',
              backgroundColor: mutationData.mergeHasPartialBuilding ? '#ffedd5' : '#ffffff',
              color: mutationData.mergeHasPartialBuilding ? '#c2410c' : '#475569',
              textAlign: 'left',
              fontSize: '0.725rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <span style={{ fontSize: '1rem' }}>🏠</span>
            <div>
              <div>Nhà chỉ xây một phần (Có đất dư)</div>
              <div style={{ fontSize: '0.65rem', fontWeight: 500, color: '#9a3412' }}>
                Chủ nhà mua thêm đất cạnh nhưng chưa xây kín
              </div>
            </div>
          </button>
        </div>

        {/* Chi tiết bóc tách khi chọn Xây một phần */}
        {mutationData.mergeHasPartialBuilding && (
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #fed7aa',
              borderRadius: '0.5rem',
              padding: '0.65rem 0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
            }}
          >
            <div style={{ fontSize: '0.7rem', color: '#9a3412', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>⚡ Nhấp trên bản đồ để khoanh vùng công trình toà nhà ({mergeBuildingVertices.length} điểm đã chấm):</span>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button
                  type="button"
                  onClick={handleMergeRemoveLastPoint}
                  disabled={mergeBuildingVertices.length === 0}
                  className="btn btn-outline-secondary btn-sm"
                  style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                >
                  <Undo size={12} />
                  Xóa điểm vừa chấm
                </button>
                <button
                  type="button"
                  onClick={handleMergeClearDraw}
                  disabled={mergeBuildingVertices.length === 0}
                  className="btn btn-outline-danger btn-sm"
                  style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                >
                  <Trash2 size={12} />
                  Xóa làm lại
                </button>
              </div>
            </div>

            {/* Bản đồ tương tác chấm điểm khoanh vùng công trình nhà */}
            <div
              style={{
                height: '280px',
                width: '100%',
                borderRadius: '0.5rem',
                overflow: 'hidden',
                border: '1.5px solid #fdba74',
                position: 'relative',
              }}
            >
              <MapContainer
                center={activeCentroid}
                zoom={19}
                maxZoom={22}
                zoomControl={false}
                style={{ width: '100%', height: '100%' }}
                scrollWheelZoom={true}
              >
                <MapBoundsController coords={realActiveCoords} zoom={19} />
                <ZoomControl position="bottomright" />

                <MapClickListener
                  enabled={true}
                  onMapClick={handleMergeMapClickDraw}
                />

                {tileMode === 'satellite' ? (
                  <TileLayer
                    attribution="Esri World Imagery"
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    maxNativeZoom={19}
                    maxZoom={22}
                  />
                ) : (
                  <TileLayer
                    attribution="&copy; OpenStreetMap contributors &copy; CARTO"
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    subdomains="abcd"
                    maxNativeZoom={19}
                    maxZoom={22}
                  />
                )}

                {/* Thửa gốc đang KS */}
                <Polygon
                  positions={realActiveCoords}
                  pathOptions={{
                    color: '#b45309',
                    fillColor: '#f59e0b',
                    fillOpacity: 0.35,
                    weight: 2,
                    dashArray: '4, 4',
                  }}
                />

                {/* Các thửa lân cận đã chọn gộp */}
                {currentZoneMergeParcels
                  .filter((p) => selectedMergeCodes.includes(p.projectParcelCode))
                  .map((p) => (
                    <Polygon
                      key={p.id || p.projectParcelCode}
                      positions={p.coordinates}
                      pathOptions={{
                        color: '#047857',
                        fillColor: '#10b981',
                        fillOpacity: 0.35,
                        weight: 2,
                        dashArray: '4, 4',
                      }}
                    />
                  ))}

                {/* Công trình toà nhà được vẽ */}
                {mergeBuildingVertices.length >= 3 && (
                  <Polygon
                    positions={mergeBuildingVertices}
                    pathOptions={{
                      color: '#ea580c',
                      fillColor: '#f97316',
                      fillOpacity: 0.7,
                      weight: 3.5,
                    }}
                  >
                    <Tooltip direction="top">
                      <div style={{ fontSize: '0.725rem', fontWeight: 800, color: '#9a3412' }}>
                        Công trình nhà: {mergeSummary.keptCode}-P1 ({calculatedMergeBArea} m²)
                      </div>
                    </Tooltip>
                  </Polygon>
                )}

                {mergeBuildingVertices.length > 0 && (
                  <Polyline
                    positions={mergeBuildingVertices}
                    pathOptions={{ color: '#ea580c', weight: 4, dashArray: mergeBuildingVertices.length < 3 ? '4, 4' : undefined }}
                  />
                )}

                {mergeBuildingVertices.map((vertex, idx) => (
                  <Marker
                    key={`merge-building-${idx}`}
                    position={vertex}
                    icon={createHandleIcon(idx + 1)}
                  />
                ))}
              </MapContainer>

              {mergeBuildingVertices.length === 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '10px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 800,
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    color: '#c2410c',
                    padding: '0.35rem 0.85rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.725rem',
                    fontWeight: 700,
                    border: '1.5px solid #fdba74',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Crosshair size={13} color="#ea580c" />
                  <span>Nhấp trực tiếp trên bản đồ để chấm các góc công trình toà nhà</span>
                </div>
              )}
            </div>

            {/* Mục đích sử dụng phần đất dư */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 800, color: '#334155', margin: 0 }}>
                  Chức năng / mục đích sử dụng phần đất dư:
                  <span style={{ color: '#ea580c', marginLeft: '4px' }}>* (Chọn thực tế)</span>
                </label>
                {!mutationData.mergeResidualType && mergeBuildingVertices.length >= 3 && (
                  <span style={{ fontSize: '0.65rem', color: '#c2410c', fontWeight: 700, backgroundColor: '#ffedd5', padding: '0.1rem 0.4rem', borderRadius: '0.25rem' }}>
                    Cần chọn chức năng
                  </span>
                )}
              </div>
              <select
                className="form-control"
                style={{
                  fontSize: '0.725rem',
                  backgroundColor: mutationData.mergeResidualType ? '#ffffff' : '#fff7ed',
                  border: mutationData.mergeResidualType ? '1px solid #cbd5e1' : '1.5px solid #ea580c',
                  color: mutationData.mergeResidualType ? '#1e293b' : '#9a3412',
                  fontWeight: 600,
                }}
                value={
                  [
                    'Sân vườn / Cây cảnh (Khoảng lùi sinh thái)',
                    'Sân trước / Sân sau lát gạch',
                    'Đất trống chưa xây dựng (Để dành)',
                    'Kho bãi tạm / Gara ô tô ngoài trời',
                    'Lối đi riêng / Ngõ phụ tiếp giáp',
                    'Công trình phụ / Bếp / Nhà xe tạm',
                    'Đất dôi dư ngoài ranh xây dựng',
                  ].includes(mutationData.mergeResidualType || '')
                    ? mutationData.mergeResidualType
                    : mutationData.mergeResidualType ? 'OTHER' : ''
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    onMutationDataChange({
                      ...mutationData,
                      mergeResidualType: '',
                      isSubmitted: false,
                    });
                  } else if (val === 'OTHER') {
                    onMutationDataChange({
                      ...mutationData,
                      mergeResidualType: customMergeResidualType ? `Khác: ${customMergeResidualType}` : 'Khác: ',
                      isSubmitted: false,
                    });
                  } else {
                    onMutationDataChange({
                      ...mutationData,
                      mergeResidualType: val,
                      isSubmitted: false,
                    });
                  }
                }}
              >
                <option value="">-- Vui lòng chọn chức năng thực tế của phần đất dư --</option>
                <option value="Sân vườn / Cây cảnh (Khoảng lùi sinh thái)">1. Sân vườn / Cây cảnh (Khoảng lùi sinh thái)</option>
                <option value="Sân trước / Sân sau lát gạch">2. Sân trước / Sân sau lát gạch</option>
                <option value="Đất trống chưa xây dựng (Để dành)">3. Đất trống chưa xây dựng (Để dành)</option>
                <option value="Kho bãi tạm / Gara ô tô ngoài trời">4. Kho bãi tạm / Gara ô tô ngoài trời</option>
                <option value="Lối đi riêng / Ngõ phụ tiếp giáp">5. Lối đi riêng / Ngõ phụ tiếp giáp</option>
                <option value="Công trình phụ / Bếp / Nhà xe tạm">6. Công trình phụ / Bếp / Nhà xe tạm</option>
                <option value="Đất dôi dư ngoài ranh xây dựng">7. Đất dôi dư ngoài ranh xây dựng</option>
                <option value="OTHER">8. Khác (Nhập mục đích sử dụng thực tế...)</option>
              </select>

              {/* Text input cho Khác */}
              {(mutationData.mergeResidualType === 'Khác' ||
                mutationData.mergeResidualType?.startsWith('Khác') ||
                (![
                  'Sân vườn / Cây cảnh (Khoảng lùi sinh thái)',
                  'Sân trước / Sân sau lát gạch',
                  'Đất trống chưa xây dựng (Để dành)',
                  'Kho bãi tạm / Gara ô tô ngoài trời',
                  'Lối đi riêng / Ngõ phụ tiếp giáp',
                  'Công trình phụ / Bếp / Nhà xe tạm',
                  'Đất dôi dư ngoài ranh xây dựng',
                ].includes(mutationData.mergeResidualType || '') && mutationData.mergeResidualType)) && (
                <div style={{ marginTop: '0.35rem' }}>
                  <input
                    type="text"
                    className="form-control"
                    style={{ fontSize: '0.725rem', border: '1px solid #fdba74' }}
                    placeholder="Nhập mục đích sử dụng phần đất dư thực tế..."
                    value={
                      customMergeResidualType ||
                      (mutationData.mergeResidualType?.startsWith('Khác: ')
                        ? mutationData.mergeResidualType.replace('Khác: ', '')
                        : mutationData.customMergeResidualType || '')
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomMergeResidualType(val);
                      onMutationDataChange({
                        ...mutationData,
                        mergeResidualType: val ? `Khác: ${val}` : 'Khác: ',
                        customMergeResidualType: val,
                        isSubmitted: false,
                      });
                    }}
                  />
                </div>
              )}
            </div>

            {/* 2 Thẻ phân vùng bóc tách */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem', marginTop: '0.2rem' }}>
              {/* Mảnh 1: Toà nhà */}
              <div
                style={{
                  backgroundColor: '#fff7ed',
                  border: '1.5px solid #fdba74',
                  borderRadius: '0.5rem',
                  padding: '0.5rem 0.65rem',
                  fontSize: '0.7rem',
                }}
              >
                <div style={{ fontWeight: 800, color: '#c2410c', display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span>🏠 1. Mảnh đất ngôi nhà (Khảo sát)</span>
                  <span className="badge" style={{ backgroundColor: '#ea580c', color: '#fff' }}>{mergeSummary.keptCode}-P1</span>
                </div>
                <div style={{ color: '#475569', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <span>Diện tích xây dựng thực tế:</span>
                  <strong style={{ color: '#0f172a', fontSize: '0.75rem' }}>{calculatedMergeBArea} m²</strong>
                </div>
              </div>

              {/* Mảnh 2: Đất dư */}
              <div
                style={{
                  backgroundColor: '#f0fdf4',
                  border: '1.5px solid #86efac',
                  borderRadius: '0.5rem',
                  padding: '0.5rem 0.65rem',
                  fontSize: '0.7rem',
                }}
              >
                <div style={{ fontWeight: 800, color: '#166534', display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span>🌳 2. Mảnh đất dư (Chủ nhà mới)</span>
                  <span className="badge" style={{ backgroundColor: '#16a34a', color: '#fff' }}>
                    {mutationData.mergeResidualParcelCode || `${mergeSummary.keptCode}-P2`}
                  </span>
                </div>
                <div style={{ color: '#475569', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <span>Diện tích đất dư:</span>
                  <strong style={{ color: '#166534', fontSize: '0.75rem' }}>{calculatedMergeRArea} m²</strong>
                </div>
                <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '2px' }}>
                  Loại: <em>{mutationData.mergeResidualType || 'Chưa chọn công năng'}</em>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Phản hồi trực quan sau khi đề xuất gộp thửa */}
      {mutationData.activeProposalType === 'MERGE' && mutationData.isSubmitted && (
        <div
          style={{
            backgroundColor: '#ecfdf5',
            border: '1.5px solid #10b981',
            borderRadius: '0.5rem',
            padding: '0.55rem 0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: '#065f46',
            fontSize: '0.725rem',
            fontWeight: 700,
          }}
        >
          <CheckCircle2 size={16} color="#059669" />
          <span>
            ✓ Đã lưu tạm đề xuất gộp {selectedMergeCodes.length + 1} thửa vào hồ sơ thửa ban đầu {parcelData.projectParcelCode} ({mutationData.submittedAt}). Đề xuất được lưu trong hồ sơ thửa ban đầu.
          </span>
        </div>
      )}

      {/* NÚT LƯU ĐỀ XUẤT GỘP THỬA (CÓ HIỆU ỨNG PHẢN HỒI) */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={handleSaveMutationProposal}
          disabled={isSubmittingMutation || selectedMergeCodes.length === 0}
          style={{
            backgroundColor: (mutationData.activeProposalType === 'MERGE' && mutationData.isSubmitted) ? '#16a34a' : '#0284c7',
            borderColor: (mutationData.activeProposalType === 'MERGE' && mutationData.isSubmitted) ? '#16a34a' : '#0284c7',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.75rem',
            fontWeight: 700,
            padding: '0.4rem 0.95rem',
            boxShadow: (mutationData.activeProposalType === 'MERGE' && mutationData.isSubmitted) ? '0 0 0 3px rgba(22, 163, 74, 0.25)' : 'none',
          }}
        >
          {(mutationData.activeProposalType === 'MERGE' && mutationData.isSubmitted) ? <CheckCircle2 size={15} /> : <CheckCircle size={14} />}
          <span>
            {isSubmittingMutation
              ? 'Đang lưu...'
              : (mutationData.activeProposalType === 'MERGE' && mutationData.isSubmitted)
              ? `ĐÃ GHI NHẬN ĐỀ XUẤT GỘP ${selectedMergeCodes.length + 1} THỬA (${mutationData.submittedAt})`
              : `Lưu đề xuất Gộp ${selectedMergeCodes.length + 1} thửa`}
          </span>
        </button>
      </div>
    </div>
  );
};
