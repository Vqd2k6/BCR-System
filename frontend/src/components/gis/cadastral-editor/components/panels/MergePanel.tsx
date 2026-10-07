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
  Home,
  Trees,
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
  zoneParcels?: GisParcel[];
  currentZoneMergeParcels: GisParcel[];
  filteredMergeParcels: GisParcel[];
  selectedMergeCodes: string[];
  mergeSearchTerm: string;
  setMergeSearchTerm: (term: string) => void;
  handleToggleMergeParcel: (code: string) => void;
  handleSetPrimaryMergeCode?: (code: string) => void;
  isSurveyedParcel?: (code: string) => boolean;
  getSurveyBadgeInfo?: (code: string) => { label: string; bg: string; color: string; border: string };
  mergeSummary: {
    keptCode: string;
    totalMergedArea: number;
    deprecatedCodes?: string[];
    allMergeCodes?: string[];
    hasSurveyConflict?: boolean;
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
  dynamicCodes?: string[];
  maxZoneInfo?: any;
  mergePartitionKind?: 'NON_BUILDING' | 'NEW_BUILDING';
  mergeSecondaryOfficialCode?: string;
  handleSetMergePartitionKind?: (kind: 'NON_BUILDING' | 'NEW_BUILDING') => void;
  handleUpdateMergeSecondaryField?: (field: string, value: any) => void;
}

export const MergePanel: React.FC<MergePanelProps> = ({
  parcelData,
  totalLandArea,
  realActiveCoords,
  activeCentroid,
  tileMode,
  setTileMode,
  zoneParcels,
  currentZoneMergeParcels,
  filteredMergeParcels,
  selectedMergeCodes,
  mergeSearchTerm,
  setMergeSearchTerm,
  handleToggleMergeParcel,
  handleSetPrimaryMergeCode,
  isSurveyedParcel,
  getSurveyBadgeInfo,
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
  dynamicCodes = [],
  maxZoneInfo,
  mergePartitionKind = 'NON_BUILDING',
  mergeSecondaryOfficialCode,
  handleSetMergePartitionKind,
  handleUpdateMergeSecondaryField,
}) => {
  const [mapViewMode, setMapViewMode] = React.useState<'CLUSTER' | 'ALL_ZONE'>('CLUSTER');

  // Tính toán bounds cho cụm tiếp giáp (gồm thửa gốc + các thửa đã chọn gộp + các thửa gần nhất)
  const clusterCoords = React.useMemo(() => {
    const list: [number, number][] = [...realActiveCoords];
    selectedMergeCodes.forEach((code) => {
      const p = currentZoneMergeParcels.find((zp) => zp.projectParcelCode === code);
      if (p && p.coordinates) {
        list.push(...p.coordinates);
      }
    });
    // Nếu chưa chọn thửa nào, lấy 8 thửa gần nhất xung quanh để người dùng nhìn thấy bối cảnh
    if (selectedMergeCodes.length === 0) {
      currentZoneMergeParcels.slice(0, 8).forEach((p) => {
        if (p.coordinates) list.push(...p.coordinates);
      });
    }
    return list;
  }, [realActiveCoords, selectedMergeCodes, currentZoneMergeParcels]);

  // Toàn bộ tọa độ trong Zone
  const allZoneCoords = React.useMemo(() => {
    const list: [number, number][] = [...realActiveCoords];
    (zoneParcels && zoneParcels.length > 0 ? zoneParcels : currentZoneMergeParcels).forEach((p) => {
      if (p.coordinates) list.push(...p.coordinates);
    });
    return list;
  }, [realActiveCoords, zoneParcels, currentZoneMergeParcels]);

  // Danh sách các thửa đất đang được hiển thị trên bản đồ
  const displayParcels = React.useMemo(() => {
    return currentZoneMergeParcels;
  }, [currentZoneMergeParcels]);

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '1.5px solid #0284c7',
        borderRadius: '0.75rem',
        padding: '0.85rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', color: '#0369a1', fontWeight: 800, fontSize: '0.85rem' }}>
          <GitCompare size={18} style={{ marginRight: '0.35rem' }} />
          <span>Bản Đồ Gộp Thửa Tương Tác Phân Khu (Click Thửa Đất Để Gộp)</span>
          <HelpBadge
            title="Quy tắc Gộp thửa trên Bản đồ GIS"
            content="Nhấp chuột trực tiếp vào bất kỳ thửa đất nào trong Zone trên bản đồ để chọn gộp hoặc hủy gộp. Thửa được chọn sẽ chuyển sang màu xanh lục, hệ thống tự động cộng dồn diện tích chuẩn xác và ưu tiên thửa đang/đã khảo sát làm mã đại diện chính thức. Bạn cũng có thể bấm chọn thửa đại diện theo ý muốn."
          />
        </div>
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          <span className="badge" style={{ backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #93c5fd', fontSize: '0.7rem', padding: '0.25rem 0.55rem' }}>
            Mã giữ lại: <strong>{mergeSummary.keptCode}</strong>
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

      {/* THANH ĐIỀU HƯỚNG BẢN ĐỒ & TÌM KIẾM NHANH THỬA ĐẤT */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.45rem',
          backgroundColor: '#f0f9ff',
          padding: '0.45rem 0.65rem',
          borderRadius: '0.5rem',
          border: '1px solid #bae6fd',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0369a1' }}>
            Chế độ quan sát:
          </span>
          <button
            type="button"
            onClick={() => setMapViewMode('CLUSTER')}
            style={{
              fontSize: '0.675rem',
              padding: '0.22rem 0.55rem',
              borderRadius: '0.35rem',
              fontWeight: mapViewMode === 'CLUSTER' ? 800 : 600,
              backgroundColor: mapViewMode === 'CLUSTER' ? '#0284c7' : '#ffffff',
              color: mapViewMode === 'CLUSTER' ? '#ffffff' : '#334155',
              border: mapViewMode === 'CLUSTER' ? 'none' : '1px solid #cbd5e1',
              cursor: 'pointer',
            }}
          >
            🎯 Zoom Cụm Tiếp Giáp
          </button>
          <button
            type="button"
            onClick={() => setMapViewMode('ALL_ZONE')}
            style={{
              fontSize: '0.675rem',
              padding: '0.22rem 0.55rem',
              borderRadius: '0.35rem',
              fontWeight: mapViewMode === 'ALL_ZONE' ? 800 : 600,
              backgroundColor: mapViewMode === 'ALL_ZONE' ? '#0284c7' : '#ffffff',
              color: mapViewMode === 'ALL_ZONE' ? '#ffffff' : '#334155',
              border: mapViewMode === 'ALL_ZONE' ? 'none' : '1px solid #cbd5e1',
              cursor: 'pointer',
            }}
          >
            🗺️ Xem Toàn Bộ Zone ({currentZoneMergeParcels.length + 1} thửa)
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <input
            type="text"
            placeholder="🔍 Tìm nhanh số nhà, tên đường..."
            value={mergeSearchTerm}
            onChange={(e) => setMergeSearchTerm(e.target.value)}
            style={{
              fontSize: '0.72rem',
              padding: '0.22rem 0.55rem',
              border: '1px solid #93c5fd',
              borderRadius: '0.35rem',
              width: '210px',
              outline: 'none',
              backgroundColor: '#ffffff',
            }}
          />
          {selectedMergeCodes.length > 0 && (
            <button
              type="button"
              onClick={() => onMutationDataChange({ ...mutationData, selectedMergeCodes: [], mergeTargetCode: '' })}
              style={{
                border: 'none',
                background: '#fee2e2',
                color: '#dc2626',
                fontSize: '0.675rem',
                fontWeight: 800,
                cursor: 'pointer',
                padding: '0.22rem 0.45rem',
                borderRadius: '0.35rem',
              }}
            >
              Hủy gộp tất cả ({selectedMergeCodes.length})
            </button>
          )}
        </div>
      </div>

      {/* BẢN ĐỒ GIS RỘNG RÃI 440PX VỚI KHẢ NĂNG CLICK-TO-MERGE TRỰC TIẾP */}
      <div
        style={{
          width: '100%',
          height: '440px',
          borderRadius: '0.65rem',
          overflow: 'hidden',
          border: '2px solid #0284c7',
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
          <MapBoundsController coords={mapViewMode === 'ALL_ZONE' ? allZoneCoords : clusterCoords} zoom={18} />
          <ZoomControl position="bottomright" />

          {tileMode === 'satellite' ? (
            <TileLayer
              key="satellite"
              attribution="Tiles &copy; Esri World Imagery"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxNativeZoom={19}
              maxZoom={22}
            />
          ) : (
            <TileLayer
              key="osm"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxNativeZoom={19}
              maxZoom={22}
            />
          )}

          {/* 1. THỬA ĐANG KHẢO SÁT (THỬA GỐC) - HIGHLIGHT NỔI BẬT VÀNG HỔ PHÁCH */}
          <Polygon
            positions={realActiveCoords}
            pathOptions={{
              color: '#b45309',
              fillColor: '#f59e0b',
              fillOpacity: 0.78,
              weight: 4.5,
            }}
          >
            <Tooltip permanent direction="center">
              <div style={{ textAlign: 'center', fontWeight: 900, color: '#7c2d12', fontSize: '0.75rem', textShadow: '0 1px 2px #fff' }}>
                ⭐ THỬA GỐC ĐANG KS<br />
                <span style={{ fontSize: '0.825rem', color: '#b45309' }}>{parcelData.projectParcelCode}</span><br />
                ({totalLandArea} m²)
              </div>
            </Tooltip>
          </Polygon>

          {/* 2. CÁC THỬA TRONG CÙNG ZONE (CLICK TRỰC TIẾP ĐỂ GỘP / HỦY GỘP) */}
          {displayParcels.map((neighbor) => {
            const isSelectedMerge = selectedMergeCodes.includes(neighbor.projectParcelCode);
            const isMatchSearch = mergeSearchTerm
              ? (neighbor.projectParcelCode.toLowerCase().includes(mergeSearchTerm.toLowerCase()) ||
                 neighbor.houseNumber?.toLowerCase().includes(mergeSearchTerm.toLowerCase()) ||
                 neighbor.street?.toLowerCase().includes(mergeSearchTerm.toLowerCase()))
              : false;

            return (
              <Polygon
                key={neighbor.id || neighbor.projectParcelCode}
                positions={neighbor.coordinates}
                pathOptions={{
                  color: isSelectedMerge ? '#047857' : (isMatchSearch ? '#ea580c' : '#0284c7'),
                  fillColor: isSelectedMerge ? '#10b981' : (isMatchSearch ? '#fed7aa' : '#38bdf8'),
                  fillOpacity: isSelectedMerge ? 0.8 : (isMatchSearch ? 0.6 : 0.32),
                  weight: isSelectedMerge ? 4 : (isMatchSearch ? 3.5 : 2),
                  dashArray: isSelectedMerge ? undefined : '4, 4',
                }}
                eventHandlers={{
                  click: () => {
                    handleToggleMergeParcel(neighbor.projectParcelCode);
                  },
                }}
              >
                <Tooltip permanent={isSelectedMerge || isMatchSearch} direction="center" opacity={0.95}>
                  <div style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 800 }}>
                    {isSelectedMerge ? (
                      <span style={{ color: '#047857' }}>
                        ✓ ĐÃ GỘP: <strong>{neighbor.projectParcelCode}</strong> ({neighbor.landArea || (neighbor as any).land_area_m2 || 75} m²)<br />
                        <span style={{ fontSize: '0.625rem', fontWeight: 600, color: '#065f46' }}>(Bấm để hủy gộp)</span>
                      </span>
                    ) : (
                      <span style={{ color: '#0369a1' }}>
                        {neighbor.projectParcelCode}<br />
                        <span style={{ fontSize: '0.625rem', fontWeight: 500, color: '#475569' }}>
                          Số {neighbor.houseNumber} {neighbor.street} {typeof (neighbor as any).distanceMeters === 'number' ? `• ${(neighbor as any).distanceMeters}m` : ''}
                        </span>
                        <br />
                        <span style={{ fontSize: '0.625rem', color: '#2563eb', fontWeight: 700 }}>(👉 Bấm để gộp)</span>
                      </span>
                    )}
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
            padding: '0.35rem 0.75rem',
            borderRadius: '0.5rem',
            fontSize: '0.675rem',
            border: '1px solid #cbd5e1',
            boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#b45309', fontWeight: 800 }}>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: '#f59e0b', border: '2px solid #b45309', borderRadius: '2px' }} />
            Thửa gốc đang KS ({parcelData.projectParcelCode})
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#047857', fontWeight: 800 }}>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: '#10b981', border: '2px solid #047857', borderRadius: '2px' }} />
            Đã chọn gộp ({selectedMergeCodes.length})
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#0284c7', fontWeight: 600 }}>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: '#e0f2fe', border: '1.5px dashed #0284c7', borderRadius: '2px' }} />
            Thửa trong Zone (👉 Click để gộp)
          </span>
        </div>
      </div>

      {/* BẢNG TÓM TẮT KHỐI GỘP TƯƠNG TÁC (THAY THẾ DANH SÁCH BỪA BÃI CŨ) */}
      <div
        style={{
          backgroundColor: '#f8fafc',
          border: '1.5px solid #cbd5e1',
          borderRadius: '0.65rem',
          padding: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
          <div style={{ fontSize: '0.775rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <GitCompare size={15} color="#0284c7" />
            <span>Khối Thửa Đất Hợp Nhất ({selectedMergeCodes.length + 1} thửa tham gia gộp):</span>
          </div>
          <div style={{ fontSize: '0.725rem', color: '#0369a1', fontWeight: 700 }}>
            Tổng diện tích sau gộp: <span style={{ fontSize: '0.85rem', color: '#0284c7', fontWeight: 900 }}>{mergeSummary.totalMergedArea} m²</span>
          </div>
        </div>

        {/* Danh sách các chip thửa đất đã chọn gộp kèm nút chọn Thửa Đại Diện */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* 1. Thửa gốc ban đầu mở Editor */}
          {(() => {
            const isBasePrimary = mergeSummary.keptCode === parcelData.projectParcelCode;
            const isSurveyed = isSurveyedParcel ? isSurveyedParcel(parcelData.projectParcelCode) : true;
            return (
              <div
                style={{
                  backgroundColor: isBasePrimary ? '#fef3c7' : '#f8fafc',
                  border: isBasePrimary ? '2px solid #f59e0b' : '1px solid #cbd5e1',
                  color: isBasePrimary ? '#92400e' : '#334155',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '0.4rem',
                  fontSize: '0.725rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  boxShadow: isBasePrimary ? '0 1px 3px rgba(245, 158, 11, 0.25)' : 'none',
                }}
              >
                <span>
                  {isBasePrimary ? '👑 ĐẠI DIỆN: ' : 'Thửa gốc: '}
                  <strong>{parcelData.projectParcelCode}</strong> ({Number(totalLandArea) || 0} m²)
                </span>
                {(() => {
                  const badge = getSurveyBadgeInfo
                    ? getSurveyBadgeInfo(parcelData.projectParcelCode)
                    : {
                        label: isSurveyed ? 'Đã/Đang KS' : 'Chưa KS',
                        bg: isSurveyed ? '#dbeafe' : '#f1f5f9',
                        color: isSurveyed ? '#1d4ed8' : '#64748b',
                        border: isSurveyed ? '#93c5fd' : '#cbd5e1',
                      };
                  return (
                    <span
                      style={{
                        fontSize: '0.625rem',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontWeight: 700,
                        backgroundColor: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.border}`,
                      }}
                    >
                      {badge.label}
                    </span>
                  );
                })()}
                {!isBasePrimary && handleSetPrimaryMergeCode && (
                  <button
                    type="button"
                    onClick={() => handleSetPrimaryMergeCode(parcelData.projectParcelCode)}
                    style={{
                      border: '1px solid #f59e0b',
                      backgroundColor: '#fffbeb',
                      color: '#b45309',
                      borderRadius: '4px',
                      padding: '1px 6px',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                    title="Đặt thửa gốc này làm Thửa Đại Diện giữ lại"
                  >
                    ⭐ Đặt làm đại diện
                  </button>
                )}
              </div>
            );
          })()}

          {/* 2. Các thửa được chọn gộp thêm */}
          {selectedMergeCodes.map((code) => {
            const p = currentZoneMergeParcels.find((x) => x.projectParcelCode === code);
            const area = Number(p?.landArea || (p as any)?.land_area_m2) || 75;
            const isPrimary = mergeSummary.keptCode === code;
            const isSurveyed = isSurveyedParcel ? isSurveyedParcel(code) : false;

            return (
              <div
                key={code}
                style={{
                  backgroundColor: isPrimary ? '#fef3c7' : '#dcfce7',
                  border: isPrimary ? '2px solid #f59e0b' : '1.5px solid #22c55e',
                  color: isPrimary ? '#92400e' : '#15803d',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '0.4rem',
                  fontSize: '0.725rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  boxShadow: isPrimary ? '0 1px 3px rgba(245, 158, 11, 0.25)' : 'none',
                }}
              >
                <span>
                  {isPrimary ? '👑 ĐẠI DIỆN: ' : '✓ Gộp: '}
                  <strong>{code}</strong> ({area} m²)
                </span>
                {(() => {
                  const badge = getSurveyBadgeInfo
                    ? getSurveyBadgeInfo(code)
                    : {
                        label: isSurveyed ? 'Đã KS' : 'Chưa KS',
                        bg: isSurveyed ? '#dbeafe' : '#f1f5f9',
                        color: isSurveyed ? '#1d4ed8' : '#64748b',
                        border: isSurveyed ? '#93c5fd' : '#cbd5e1',
                      };
                  return (
                    <span
                      style={{
                        fontSize: '0.625rem',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontWeight: 700,
                        backgroundColor: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.border}`,
                      }}
                    >
                      {badge.label}
                    </span>
                  );
                })()}

                {!isPrimary && handleSetPrimaryMergeCode && (
                  <button
                    type="button"
                    onClick={() => handleSetPrimaryMergeCode(code)}
                    style={{
                      border: '1px solid #f59e0b',
                      backgroundColor: '#fffbeb',
                      color: '#b45309',
                      borderRadius: '4px',
                      padding: '1px 6px',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                    title="Đặt thửa này làm Thửa Đại Diện chính thức"
                  >
                    ⭐ Đặt làm đại diện
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleToggleMergeParcel(code)}
                  style={{
                    border: 'none',
                    background: 'none',
                    color: '#dc2626',
                    cursor: 'pointer',
                    padding: '0 2px',
                    fontWeight: 900,
                    fontSize: '0.85rem',
                    lineHeight: 1,
                  }}
                  title="Hủy gộp thửa này"
                >
                  ✕
                </button>
              </div>
            );
          })}

          {selectedMergeCodes.length === 0 && (
            <span style={{ fontSize: '0.725rem', color: '#64748b', fontStyle: 'italic' }}>
              👉 Hãy nhấp chuột trực tiếp vào một hoặc nhiều thửa đất tiếp giáp trên bản đồ phân khu ở trên để chọn gộp!
            </span>
          )}
        </div>

        {/* CẢNH BÁO XUNG ĐỘT KHẢO SÁT NẾU CÓ TỪ 2 THỬA ĐÃ KHẢO SÁT */}
        {mergeSummary.hasSurveyConflict && (
          <div
            style={{
              backgroundColor: '#fffbeb',
              border: '1.5px solid #f59e0b',
              borderRadius: '0.45rem',
              padding: '0.5rem 0.75rem',
              fontSize: '0.725rem',
              color: '#92400e',
              lineHeight: 1.45,
            }}
          >
            ⚠️ <strong>Lưu ý xung đột hồ sơ:</strong> Khối gộp có từ 2 thửa đất trở lên đã có hồ sơ khảo sát độc lập. Vui lòng bấm <code>[⭐ Đặt làm đại diện]</code> trên thửa có hồ sơ chuẩn xác nhất để giữ lại làm hồ sơ chính thức. Hồ sơ của thửa sáp nhập sẽ được chuyển thành tài liệu tham chiếu lưu trữ.
          </div>
        )}

        {/* Hộp Thông Tin Pháp Lý Của Khối Gộp */}
        {selectedMergeCodes.length > 0 && (
          <div
            style={{
              backgroundColor: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: '0.45rem',
              padding: '0.45rem 0.65rem',
              fontSize: '0.72rem',
              color: '#0369a1',
              lineHeight: 1.45,
            }}
          >
            ✓ <strong>Mã đại diện chính thức (giữ lại):</strong>{' '}
            <strong style={{ color: '#0284c7', fontSize: '0.775rem' }}>[{mergeSummary.keptCode}]</strong>{' '}
            (Thửa đại diện bảo toàn thông tin pháp lý & hồ sơ khảo sát).
            <br />
            ✓ <strong>Mã bị sát nhập / thu hồi:</strong> [{mergeSummary.deprecatedCodes?.join(', ') || 'Không có'}]. Khi phê duyệt, các mã này sẽ chuyển sang trạng thái <code>MERGED_DEPRECATED</code> và trỏ dữ liệu về mã đại diện.
          </div>
        )}
      </div>

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
                mergeResidualParcelCode: `${mergeSummary.keptCode}-DU`,
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
            {/* Nhập số đo diện tích xây dựng thực tế (S_xd) */}
            <div
              style={{
                backgroundColor: '#fff7ed',
                border: '1.5px solid #fdba74',
                borderRadius: '0.5rem',
                padding: '0.65rem 0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#9a3412', margin: 0 }}>
                  📐 Diện tích xây dựng thực tế của ngôi nhà (S_xd):
                  <span style={{ color: '#ea580c', marginLeft: '4px' }}>* (m²)</span>
                </label>
                <span style={{ fontSize: '0.7rem', color: '#c2410c', fontWeight: 700 }}>
                  Tổng khuôn viên gộp: <strong>{mergeSummary.totalMergedArea} m²</strong>
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max={Math.max(0.1, mergeSummary.totalMergedArea - 0.1)}
                  className="form-control"
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    maxWidth: '180px',
                    borderColor: '#ea580c',
                  }}
                  placeholder="VD: 85.5"
                  value={mutationData.mergeBuildingAreaM2 !== undefined ? mutationData.mergeBuildingAreaM2 : (calculatedMergeBArea || '')}
                  onChange={(e) => {
                    const rawVal = e.target.value;
                    const val = rawVal === '' ? undefined : parseFloat(rawVal);
                    const total = mergeSummary.totalMergedArea;
                    const residual = (val !== undefined && !isNaN(val))
                      ? Math.max(0, Math.round((total - val) * 10) / 10)
                      : undefined;
                    onMutationDataChange({
                      ...mutationData,
                      mergeBuildingAreaM2: val,
                      mergeResidualAreaM2: residual,
                      mergeResidualParcelCode: `${mergeSummary.keptCode}-DU`,
                      isSubmitted: false,
                    });
                  }}
                />
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>m²</span>
                <div style={{ fontSize: '0.7rem', color: '#166534', backgroundColor: '#f0fdf4', padding: '0.3rem 0.6rem', borderRadius: '0.35rem', border: '1px solid #bbf7d0', marginLeft: 'auto' }}>
                  🌳 Đất dôi dư tự tính (S_du): <strong>{calculatedMergeRArea} m²</strong>
                </div>
              </div>
              <div style={{ fontSize: '0.65rem', color: '#9a3412', fontStyle: 'italic' }}>
                💡 Nhập diện tích xây dựng thực tế theo đo đạc laser / sổ đỏ. Bạn cũng có thể nhấp trên bản đồ bên dưới để khoanh vùng toạ độ công trình toà nhà.
              </div>
            </div>
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
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
                        Công trình nhà: {mergeSummary.keptCode} ({calculatedMergeBArea} m²)
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

            {/* BỘ CHỌN 2 NHÁNH NGHIỆP VỤ CHO THỬA THỨ HAI (TƯƠNG ĐƯƠNG SPLIT PANEL) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Quy chuẩn định danh thửa đất thứ hai (Phát sinh sau gộp):
                </label>
                <span className="badge" style={{ backgroundColor: mergePartitionKind === 'NEW_BUILDING' ? '#ffedd5' : '#dcfce7', color: mergePartitionKind === 'NEW_BUILDING' ? '#c2410c' : '#15803d', fontSize: '0.675rem' }}>
                  {mergePartitionKind === 'NEW_BUILDING' ? 'CƠ CHẾ: MAX ZONE + 1' : 'ĐẤT DÔI DƯ / SÂN VƯỜN (-DU)'}
                </span>
              </div>

              {/* 2 Nút Toggle */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (handleSetMergePartitionKind) handleSetMergePartitionKind('NON_BUILDING');
                  }}
                  style={{
                    flex: '1 1 200px',
                    padding: '0.5rem 0.65rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.725rem',
                    fontWeight: mergePartitionKind !== 'NEW_BUILDING' ? 800 : 600,
                    backgroundColor: mergePartitionKind !== 'NEW_BUILDING' ? '#059669' : '#f8fafc',
                    color: mergePartitionKind !== 'NEW_BUILDING' ? '#ffffff' : '#475569',
                    border: mergePartitionKind !== 'NEW_BUILDING' ? 'none' : '1px solid #cbd5e1',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                    boxShadow: mergePartitionKind !== 'NEW_BUILDING' ? '0 2px 4px rgba(5, 150, 105, 0.25)' : 'none',
                  }}
                >
                  <Trees size={15} /> 🌳 1. Đất dôi dư / Sân vườn (Mã: {mergeSummary.keptCode}-DU)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (handleSetMergePartitionKind) handleSetMergePartitionKind('NEW_BUILDING');
                  }}
                  style={{
                    flex: '1 1 200px',
                    padding: '0.5rem 0.65rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.725rem',
                    fontWeight: mergePartitionKind === 'NEW_BUILDING' ? 800 : 600,
                    backgroundColor: mergePartitionKind === 'NEW_BUILDING' ? '#ea580c' : '#f8fafc',
                    color: mergePartitionKind === 'NEW_BUILDING' ? '#ffffff' : '#475569',
                    border: mergePartitionKind === 'NEW_BUILDING' ? 'none' : '1px solid #cbd5e1',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                    boxShadow: mergePartitionKind === 'NEW_BUILDING' ? '0 2px 4px rgba(234, 88, 12, 0.25)' : 'none',
                  }}
                >
                  <Home size={15} /> 🏠 2. Căn nhà mới độc lập (Cấp mã Max Zone + 1: {mergeSecondaryOfficialCode || dynamicCodes[0] || '...'})
                </button>
              </div>
            </div>

            {/* Chi tiết cho Nhánh 1: NON_BUILDING (Sân vườn, đất trống) */}
            {mergePartitionKind !== 'NEW_BUILDING' ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <label style={{ display: 'block', fontSize: '0.725rem', fontWeight: 800, color: '#334155', margin: 0 }}>
                    Chức năng / mục đích sử dụng phần đất dư ({mergeSummary.keptCode}-DU):
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
            ) : (
              /* Chi tiết cho Nhánh 2: NEW_BUILDING (Căn nhà mới độc lập) */
              <div
                style={{
                  backgroundColor: '#fff7ed',
                  border: '1.5px solid #fed7aa',
                  borderRadius: '0.5rem',
                  padding: '0.65rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#c2410c' }}>
                    🏠 Thông tin Căn nhà mới ({mergeSecondaryOfficialCode})
                  </span>
                  <span className="badge" style={{ backgroundColor: '#ea580c', color: '#fff', fontSize: '0.675rem' }}>
                    Mã Zone: {mergeSecondaryOfficialCode}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.45rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>
                      Số nhà mới:
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      style={{ fontSize: '0.725rem', border: '1px solid #cbd5e1' }}
                      placeholder="Ví dụ: 205B"
                      value={mutationData.mergeSecondaryHouseNumber ?? `${parcelData.houseNumber}B`}
                      onChange={(e) => {
                        if (handleUpdateMergeSecondaryField) {
                          handleUpdateMergeSecondaryField('mergeSecondaryHouseNumber', e.target.value);
                        }
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>
                      Tên chủ hộ mới:
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      style={{ fontSize: '0.725rem', border: '1px solid #cbd5e1' }}
                      placeholder="Ví dụ: Nguyễn Văn B"
                      value={mutationData.mergeSecondaryOwnerName ?? 'Chủ hộ mới'}
                      onChange={(e) => {
                        if (handleUpdateMergeSecondaryField) {
                          handleUpdateMergeSecondaryField('mergeSecondaryOwnerName', e.target.value);
                        }
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>
                      Số điện thoại:
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      style={{ fontSize: '0.725rem', border: '1px solid #cbd5e1' }}
                      placeholder="Số điện thoại liên hệ"
                      value={mutationData.mergeSecondaryPhone ?? ''}
                      onChange={(e) => {
                        if (handleUpdateMergeSecondaryField) {
                          handleUpdateMergeSecondaryField('mergeSecondaryPhone', e.target.value);
                        }
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>
                      Số tầng công trình:
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      className="form-control"
                      style={{ fontSize: '0.725rem', border: '1px solid #cbd5e1' }}
                      value={mutationData.mergeSecondaryFloorCount ?? 1}
                      onChange={(e) => {
                        if (handleUpdateMergeSecondaryField) {
                          handleUpdateMergeSecondaryField('mergeSecondaryFloorCount', Number(e.target.value) || 1);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

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
                  <span>🏠 1. Thửa Đại Diện Chính (Khảo sát)</span>
                  <span className="badge" style={{ backgroundColor: '#ea580c', color: '#fff' }}>{mergeSummary.keptCode}</span>
                </div>
                <div style={{ color: '#475569', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <span>Diện tích xây dựng thực tế:</span>
                  <strong style={{ color: '#0f172a', fontSize: '0.75rem' }}>{calculatedMergeBArea} m²</strong>
                </div>
              </div>

              {/* Mảnh 2: Thửa thứ hai */}
              <div
                style={{
                  backgroundColor: mergePartitionKind === 'NEW_BUILDING' ? '#fff7ed' : '#f0fdf4',
                  border: mergePartitionKind === 'NEW_BUILDING' ? '1.5px solid #fed7aa' : '1.5px solid #86efac',
                  borderRadius: '0.5rem',
                  padding: '0.5rem 0.65rem',
                  fontSize: '0.7rem',
                }}
              >
                <div style={{ fontWeight: 800, color: mergePartitionKind === 'NEW_BUILDING' ? '#c2410c' : '#166534', display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span>{mergePartitionKind === 'NEW_BUILDING' ? '🏠 2. Căn nhà mới độc lập' : '🌳 2. Phần đất dôi dư / Sân vườn'}</span>
                  <span className="badge" style={{ backgroundColor: mergePartitionKind === 'NEW_BUILDING' ? '#ea580c' : '#16a34a', color: '#fff' }}>
                    {mergeSecondaryOfficialCode || `${mergeSummary.keptCode}-DU`}
                  </span>
                </div>
                <div style={{ color: '#475569', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <span>{mergePartitionKind === 'NEW_BUILDING' ? 'Diện tích đất nhà mới:' : 'Diện tích đất dôi dư:'}</span>
                  <strong style={{ color: mergePartitionKind === 'NEW_BUILDING' ? '#c2410c' : '#166534', fontSize: '0.75rem' }}>{calculatedMergeRArea} m²</strong>
                </div>
                <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '2px' }}>
                  {mergePartitionKind === 'NEW_BUILDING' ? (
                    <span>Số nhà: <strong>{mutationData.mergeSecondaryHouseNumber ?? `${parcelData.houseNumber}B`}</strong> • Khảo sát độc lập</span>
                  ) : (
                    <span>Loại: <em>{mutationData.mergeResidualType || 'Chưa chọn công năng'}</em></span>
                  )}
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
