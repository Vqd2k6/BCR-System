import React from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Polygon, Polyline, Marker, Tooltip, ZoomControl } from 'react-leaflet';
import {
  Layers,
  MousePointer,
  Move,
  Undo,
  Trash2,
  Plus,
  Minus,
  RefreshCw,
  Tag,
  CheckCircle,
  CheckCircle2,
  Home,
  Trees,
  Scissors,
} from 'lucide-react';
import type { CadastralParcelData, MutationPayloadData, MaxZoneCodeInfo } from '../../../shared/types';
import { MapBoundsController, MapClickListener, HelpBadge } from '../../../shared/MapControllers';
import { createHandleIcon } from '../../../shared/geoMath';
import {
  RESIDUAL_FUNCTION_OPTIONS,
  NON_BUILDING_RESIDUAL_OPTIONS,
  BUILDING_RESIDUAL_OPTIONS,
  COMMON_SPLIT_REASONS,
} from '../../../shared/constants';

interface SplitPanelProps {
  parcelData: CadastralParcelData;
  realActiveCoords: [number, number][];
  activeCentroid: [number, number];
  tileMode: 'osm' | 'satellite';
  setTileMode: (mode: 'osm' | 'satellite' | ((prev: 'osm' | 'satellite') => 'osm' | 'satellite')) => void;
  splitShapeOption: 'CLICK_TO_DRAW' | 'DRAG_HANDLES';
  setSplitShapeOption: (opt: 'CLICK_TO_DRAW' | 'DRAG_HANDLES') => void;
  activeTarget?: 'A' | 'B';
  setActiveTarget?: (target: 'A' | 'B') => void;
  polyAVertices: [number, number][];
  setPolyAVertices: (pts: [number, number][]) => void;
  polyBVertices?: [number, number][];
  setPolyBVertices?: (pts: [number, number][]) => void;
  calculatedAreaA: number;
  calculatedAreaB: number;
  dynamicCodes: string[];
  maxZoneInfo?: MaxZoneCodeInfo | null;
  handleVertexDrag: (idx: number, latlng: L.LatLng, target?: 'A' | 'B') => void;
  handleMapClickDraw: (latlng: [number, number], target?: 'A' | 'B') => void;
  handleAddMidpoint: (target?: 'A' | 'B') => void;
  handleRemovePoint: (target?: 'A' | 'B') => void;
  handleResetTarget?: (target?: 'A' | 'B') => void;
  handleResetDefault: () => void;
  handleSplitHorizontal?: (ratio?: number) => void;
  handleSplitVertical?: (ratio?: number) => void;
  mutationData: MutationPayloadData;
  onMutationDataChange: (data: MutationPayloadData) => void;
  customResidualType: string;
  setCustomResidualType: (val: string) => void;
  customSplitReason: string;
  setCustomSplitReason: (val: string) => void;
  handleSaveMutationProposal: () => void;
  isSubmittingMutation: boolean;
}

export const SplitPanel: React.FC<SplitPanelProps> = ({
  parcelData,
  realActiveCoords,
  activeCentroid,
  tileMode,
  setTileMode,
  splitShapeOption,
  setSplitShapeOption,
  activeTarget = 'A',
  setActiveTarget,
  polyAVertices,
  setPolyAVertices,
  polyBVertices,
  setPolyBVertices,
  calculatedAreaA,
  calculatedAreaB,
  dynamicCodes,
  maxZoneInfo,
  handleVertexDrag,
  handleMapClickDraw,
  handleAddMidpoint,
  handleRemovePoint,
  handleResetTarget,
  handleResetDefault,
  handleSplitHorizontal,
  handleSplitVertical,
  mutationData,
  onMutationDataChange,
  customResidualType,
  setCustomResidualType,
  customSplitReason,
  setCustomSplitReason,
  handleSaveMutationProposal,
  isSubmittingMutation,
}) => {
  const codeA = parcelData.projectParcelCode;
  const codeB = mutationData.residualKind === 'NEW_BUILDING'
    ? (maxZoneInfo?.nextCode || dynamicCodes[0] || `${parcelData.projectParcelCode}-B`)
    : `${parcelData.projectParcelCode}-DU`;

  const totalParentArea = parcelData.landArea || parcelData.constructionArea || Math.round((calculatedAreaA + calculatedAreaB) * 10) / 10;
  const currentTotal = Math.round((calculatedAreaA + calculatedAreaB) * 10) / 10;
  const areaDiff = Math.round((totalParentArea - currentTotal) * 10) / 10;
  const isAreaGap = Math.abs(areaDiff) > 0.4;

  const currentVertices = activeTarget === 'A' ? polyAVertices : (polyBVertices || []);

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '1.5px solid #fdba74',
        borderRadius: '0.75rem',
        padding: '0.85rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', color: '#c2410c', fontWeight: 800, fontSize: '0.85rem' }}>
          <Layers size={18} style={{ marginRight: '0.35rem' }} />
          <span>Biên Tập Phân Tách Thửa Đất Trực Quan (Khung Cha & 2 Lô Độc Lập)</span>
          <HelpBadge
            title="Hướng dẫn Tách thửa trực quan"
            content="Khung nét đứt xám là ranh đất gốc sổ đỏ. Bạn có thể chọn biên tập riêng Lô A (vàng) hoặc Lô B (cam) hoàn toàn độc lập, kéo nắn mốc ranh của từng lô, hoặc dùng nút 'Khớp tự động' để chống mất đất 100%."
          />
        </div>
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          <span className="badge" style={{ backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontSize: '0.7rem', padding: '0.25rem 0.55rem' }}>
            Lô A: <strong>{codeA}</strong>
          </span>
          <span className="badge" style={{ backgroundColor: '#ffedd5', color: '#c2410c', border: '1px solid #fed7aa', fontSize: '0.7rem', padding: '0.25rem 0.55rem' }}>
            Lô B: <strong>{codeB}</strong>
          </span>
          <button
            type="button"
            onClick={() => setTileMode((prev) => (prev === 'osm' ? 'satellite' : 'osm'))}
            style={{
              padding: '0.2rem 0.5rem',
              borderRadius: '0.3rem',
              fontSize: '0.675rem',
              fontWeight: 700,
              backgroundColor: '#f1f5f9',
              color: '#475569',
              border: '1px solid #cbd5e1',
              cursor: 'pointer',
            }}
          >
            {tileMode === 'osm' ? '🛰️ Vệ tinh' : '🗺️ Bản đồ'}
          </button>
        </div>
      </div>

      {/* THANH CÔNG CỤ CẮT NHANH PHÂN RANH HÌNH HỌC */}
      <div
        style={{
          display: 'flex',
          gap: '0.35rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          backgroundColor: '#fffbeb',
          padding: '0.45rem 0.65rem',
          borderRadius: '0.5rem',
          border: '1px solid #fef08a',
        }}
      >
        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#92400e', display: 'flex', alignItems: 'center', gap: '0.25rem', marginRight: '0.25rem' }}>
          <Scissors size={14} color="#b45309" />
          Phân chia ranh nhanh:
        </span>
        <button
          type="button"
          onClick={() => handleSplitHorizontal && handleSplitHorizontal(0.6)}
          className="btn btn-secondary btn-sm"
          style={{ fontSize: '0.675rem', padding: '0.22rem 0.5rem', backgroundColor: '#ffffff', color: '#b45309', fontWeight: 700, border: '1px solid #f59e0b' }}
          title="Chia mặt tiền chiếm 60% diện tích, phía sau chiếm 40%"
        >
          ✂️ Cắt ngang 60/40 (Trước/Sau)
        </button>
        <button
          type="button"
          onClick={() => handleSplitHorizontal && handleSplitHorizontal(0.5)}
          className="btn btn-secondary btn-sm"
          style={{ fontSize: '0.675rem', padding: '0.22rem 0.5rem', backgroundColor: '#ffffff', color: '#b45309', fontWeight: 700, border: '1px solid #f59e0b' }}
          title="Chia đôi ngang đều 50/50"
        >
          ✂️ Cắt ngang 50/50
        </button>
        <button
          type="button"
          onClick={() => handleSplitVertical && handleSplitVertical(0.5)}
          className="btn btn-secondary btn-sm"
          style={{ fontSize: '0.675rem', padding: '0.22rem 0.5rem', backgroundColor: '#ffffff', color: '#b45309', fontWeight: 700, border: '1px solid #f59e0b' }}
          title="Chia dọc 50/50 theo chiều sâu (Trái / Phải)"
        >
          ✂️ Cắt dọc 50/50 (Trái/Phải)
        </button>
        <button
          type="button"
          onClick={handleResetDefault}
          className="btn btn-secondary btn-sm"
          style={{ fontSize: '0.675rem', padding: '0.22rem 0.5rem', backgroundColor: '#ffffff', color: '#475569', fontWeight: 600, border: '1px solid #cbd5e1' }}
        >
          <RefreshCw size={11} style={{ marginRight: '0.2rem' }} /> Đặt lại mặc định
        </button>
      </div>

      {/* BỘ CHỌN ĐỐI TƯỢNG BIÊN TẬP: LÔ A (ĐANG KS) HOẶC LÔ B (TÁCH MỚI / ĐẤT DƯ) */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          backgroundColor: '#f8fafc',
          padding: '0.45rem',
          borderRadius: '0.55rem',
          border: '1.5px solid #e2e8f0',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTarget && setActiveTarget('A')}
          style={{
            flex: 1,
            padding: '0.45rem 0.65rem',
            borderRadius: '0.45rem',
            fontSize: '0.75rem',
            fontWeight: activeTarget === 'A' ? 800 : 600,
            backgroundColor: activeTarget === 'A' ? '#fef3c7' : '#ffffff',
            color: activeTarget === 'A' ? '#92400e' : '#475569',
            border: activeTarget === 'A' ? '2px solid #f59e0b' : '1px solid #cbd5e1',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem',
            boxShadow: activeTarget === 'A' ? '0 2px 4px rgba(245, 158, 11, 0.2)' : 'none',
          }}
        >
          <span style={{ width: '10px', height: '10px', backgroundColor: '#f59e0b', borderRadius: '50%', display: 'inline-block' }}></span>
          <span>🟡 Đang biên tập Lô A ({polyAVertices.length} đỉnh - {calculatedAreaA} m²)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTarget && setActiveTarget('B')}
          style={{
            flex: 1,
            padding: '0.45rem 0.65rem',
            borderRadius: '0.45rem',
            fontSize: '0.75rem',
            fontWeight: activeTarget === 'B' ? 800 : 600,
            backgroundColor: activeTarget === 'B' ? '#ffedd5' : '#ffffff',
            color: activeTarget === 'B' ? '#c2410c' : '#475569',
            border: activeTarget === 'B' ? '2px solid #ea580c' : '1px solid #cbd5e1',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem',
            boxShadow: activeTarget === 'B' ? '0 2px 4px rgba(234, 88, 12, 0.2)' : 'none',
          }}
        >
          <span style={{ width: '10px', height: '10px', backgroundColor: '#ea580c', borderRadius: '50%', display: 'inline-block' }}></span>
          <span>🟠 Đang biên tập Lô B ({(polyBVertices || []).length} đỉnh - {calculatedAreaB} m²)</span>
        </button>
      </div>

      {/* BỘ CHỌN 2 CHẾ ĐỘ BIÊN TẬP CHI TIẾT (CHẤM ĐIỂM HOẶC KÉO NẮN ĐIỂM) */}
      <div style={{ display: 'flex', gap: '0.45rem' }}>
        <button
          type="button"
          onClick={() => {
            setSplitShapeOption('DRAG_HANDLES');
            onMutationDataChange({ ...mutationData, splitShapeOption: 'DRAG_HANDLES', isSubmitted: false });
          }}
          style={{
            flex: 1,
            padding: '0.45rem 0.65rem',
            borderRadius: '0.45rem',
            fontSize: '0.725rem',
            fontWeight: splitShapeOption === 'DRAG_HANDLES' ? 800 : 600,
            backgroundColor: splitShapeOption === 'DRAG_HANDLES' ? '#ea580c' : '#f8fafc',
            color: splitShapeOption === 'DRAG_HANDLES' ? '#ffffff' : '#475569',
            border: splitShapeOption === 'DRAG_HANDLES' ? 'none' : '1px solid #cbd5e1',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem',
            boxShadow: splitShapeOption === 'DRAG_HANDLES' ? '0 2px 4px rgba(234, 88, 12, 0.2)' : 'none',
          }}
        >
          <Move size={14} /> Chế độ 1: Kéo nắn các điểm mút ranh giới
        </button>

        <button
          type="button"
          onClick={() => {
            setSplitShapeOption('CLICK_TO_DRAW');
            onMutationDataChange({ ...mutationData, splitShapeOption: 'CLICK_TO_DRAW', isSubmitted: false });
          }}
          style={{
            flex: 1,
            padding: '0.45rem 0.65rem',
            borderRadius: '0.45rem',
            fontSize: '0.725rem',
            fontWeight: splitShapeOption === 'CLICK_TO_DRAW' ? 800 : 600,
            backgroundColor: splitShapeOption === 'CLICK_TO_DRAW' ? '#ea580c' : '#f8fafc',
            color: splitShapeOption === 'CLICK_TO_DRAW' ? '#ffffff' : '#475569',
            border: splitShapeOption === 'CLICK_TO_DRAW' ? 'none' : '1px solid #cbd5e1',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem',
            boxShadow: splitShapeOption === 'CLICK_TO_DRAW' ? '0 2px 4px rgba(234, 88, 12, 0.2)' : 'none',
          }}
        >
          <MousePointer size={14} /> Chế độ 2: Nhấp chuột chấm đỉnh tự do
        </button>
      </div>

      {/* TOOLBAR NÚT CÔNG CỤ THEO ĐỐI TƯỢNG VÀ CHẾ ĐỘ */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.35rem',
          backgroundColor: activeTarget === 'A' ? '#fffbeb' : '#fff7ed',
          padding: '0.4rem 0.65rem',
          borderRadius: '0.5rem',
          border: `1px dashed ${activeTarget === 'A' ? '#f59e0b' : '#ea580c'}`,
        }}
      >
        <div style={{ fontSize: '0.725rem', color: activeTarget === 'A' ? '#92400e' : '#9a3412', fontWeight: 700 }}>
          {splitShapeOption === 'DRAG_HANDLES'
            ? `Kéo trực tiếp các mốc ${activeTarget === 'A' ? 'vàng (Lô A)' : 'cam (Lô B)'} để vi chỉnh:`
            : `Nhấp chuột trên bản đồ để chấm đỉnh cho ${activeTarget === 'A' ? 'Lô A' : 'Lô B'} (${currentVertices.length} điểm):`}
        </div>

        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
          {splitShapeOption === 'DRAG_HANDLES' ? (
            <>
              <button
                type="button"
                onClick={() => handleAddMidpoint(activeTarget)}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.675rem', padding: '0.2rem 0.45rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
              >
                <Plus size={11} /> Thêm mốc
              </button>
              <button
                type="button"
                onClick={() => handleRemovePoint(activeTarget)}
                disabled={currentVertices.length <= 3}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.675rem', padding: '0.2rem 0.45rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
              >
                <Minus size={11} /> Bớt mốc
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleRemovePoint(activeTarget)}
                disabled={currentVertices.length === 0}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.675rem', padding: '0.2rem 0.45rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
              >
                <Undo size={11} /> Hoàn tác
              </button>
              <button
                type="button"
                onClick={() => handleResetTarget && handleResetTarget(activeTarget)}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.675rem', padding: '0.2rem 0.45rem', display: 'flex', alignItems: 'center', gap: '0.2rem', color: '#dc2626' }}
              >
                <Trash2 size={11} /> Xóa vẽ lại
              </button>
            </>
          )}
        </div>
      </div>

      {/* LEAFLET MAP VISUALIZER: RENDER ĐỒNG THỜI CẢ KHUNG CHA VÀ 2 LÔ ĐỘC LẬP */}
      <div
        style={{
          width: '100%',
          height: '370px',
          borderRadius: '0.65rem',
          overflow: 'hidden',
          border: '2px solid #fdba74',
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

          {/* Click listener for Option 2: Chấm điểm theo activeTarget */}
          <MapClickListener
            enabled={splitShapeOption === 'CLICK_TO_DRAW'}
            onMapClick={(point) => handleMapClickDraw(point, activeTarget)}
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

          {/* 1. KHUNG CHA NGOẠI VI BẤT BIẾN (VIỀN NÉT ĐỨT XÁM PHÁP LÝ) */}
          <Polygon
            positions={realActiveCoords}
            pathOptions={{
              color: '#475569',
              fillColor: '#64748b',
              fillOpacity: 0.08,
              weight: 2,
              dashArray: '6, 6',
            }}
          >
            <Tooltip direction="top">
              <div style={{ fontSize: '0.725rem', color: '#1e293b', fontWeight: 600 }}>
                Khung cha pháp lý: <strong>{parcelData.projectParcelCode}</strong> ({totalParentArea} m²)
              </div>
            </Tooltip>
          </Polygon>

          {/* 2. LÔ B: PHẦN TÁCH MỚI HOẶC ĐẤT DÔI DƯ (MÀU CAM RỰC - #ea580c) */}
          {polyBVertices && polyBVertices.length >= 3 && (
            <Polygon
              positions={polyBVertices}
              pathOptions={{
                color: activeTarget === 'B' ? '#9a3412' : '#c2410c',
                fillColor: '#ea580c',
                fillOpacity: activeTarget === 'B' ? 0.75 : 0.55,
                weight: activeTarget === 'B' ? 4 : 2.5,
              }}
            >
              <Tooltip direction="top" opacity={0.9}>
                <div style={{ textAlign: 'center', fontWeight: 800, color: '#7c2d12', fontSize: '0.725rem' }}>
                  🟠 LÔ B ({mutationData.residualKind === 'NEW_BUILDING' ? 'TÁCH MỚI' : 'ĐẤT DƯ'}): {codeB} ({calculatedAreaB} m²)
                </div>
              </Tooltip>
            </Polygon>
          )}

          {/* 3. LÔ A: THỬA CHÍNH ĐANG KHẢO SÁT (MÀU VÀNG HỔ PHÁCH - #f59e0b) */}
          {polyAVertices.length >= 3 && (
            <Polygon
              positions={polyAVertices}
              pathOptions={{
                color: activeTarget === 'A' ? '#78350f' : '#b45309',
                fillColor: '#f59e0b',
                fillOpacity: activeTarget === 'A' ? 0.8 : 0.55,
                weight: activeTarget === 'A' ? 4 : 2.5,
              }}
            >
              <Tooltip direction="top" opacity={0.9}>
                <div style={{ textAlign: 'center', fontWeight: 800, color: '#78350f', fontSize: '0.725rem' }}>
                  🟡 LÔ A (ĐANG KS): {codeA} ({calculatedAreaA} m²)
                </div>
              </Tooltip>
            </Polygon>
          )}

          {/* Polyline preview khi đang chấm < 3 điểm */}
          {currentVertices.length > 0 && currentVertices.length < 3 && (
            <Polyline
              positions={currentVertices}
              pathOptions={{
                color: activeTarget === 'A' ? '#d97706' : '#ea580c',
                weight: 4,
                dashArray: '4, 4',
              }}
            />
          )}

          {/* DRAGGABLE VERTEX HANDLES THEO ACTIVE TARGET */}
          {splitShapeOption === 'DRAG_HANDLES' &&
            activeTarget === 'A' &&
            polyAVertices.map((vertex, idx) => (
              <Marker
                key={`vertex-a-${idx}`}
                position={vertex}
                draggable={true}
                icon={createHandleIcon(idx + 1, '#f59e0b')}
                eventHandlers={{
                  dragend: (e) => {
                    handleVertexDrag(idx, e.target.getLatLng(), 'A');
                  },
                }}
              />
            ))}

          {splitShapeOption === 'DRAG_HANDLES' &&
            activeTarget === 'B' &&
            (polyBVertices || []).map((vertex, idx) => (
              <Marker
                key={`vertex-b-${idx}`}
                position={vertex}
                draggable={true}
                icon={createHandleIcon(idx + 1, '#ea580c')}
                eventHandlers={{
                  dragend: (e) => {
                    handleVertexDrag(idx, e.target.getLatLng(), 'B');
                  },
                }}
              />
            ))}

          {/* MARKER CHẤM ĐIỂM TRONG CHẾ ĐỘ CHẤM TỰ DO */}
          {splitShapeOption === 'CLICK_TO_DRAW' &&
            currentVertices.map((vertex, idx) => (
              <Marker
                key={`click-point-${activeTarget}-${idx}`}
                position={vertex}
                icon={createHandleIcon(idx + 1, activeTarget === 'A' ? '#f59e0b' : '#ea580c')}
              />
            ))}
        </MapContainer>

        {/* Floating Status & Chống mất đất Info */}
        <div
          style={{
            position: 'absolute',
            bottom: '8px',
            left: '8px',
            zIndex: 800,
            backgroundColor: 'rgba(255, 255, 255, 0.96)',
            color: '#0f172a',
            padding: '0.35rem 0.75rem',
            borderRadius: '0.5rem',
            fontSize: '0.7rem',
            border: isAreaGap ? '1.5px solid #ef4444' : '1.5px solid #22c55e',
            boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: '12px', height: '12px', backgroundColor: '#f59e0b', border: '1.5px solid #b45309', borderRadius: '2px', display: 'inline-block' }}></span>
            <span>Lô A: <strong>{calculatedAreaA} m²</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: '12px', height: '12px', backgroundColor: '#ea580c', border: '1.5px solid #c2410c', borderRadius: '2px', display: 'inline-block' }}></span>
            <span>Lô B: <strong>{calculatedAreaB} m²</strong></span>
          </div>
          <div style={{ color: '#475569', fontSize: '0.675rem' }}>
            Tổng: <strong>{currentTotal} m²</strong> / Khung cha: <strong>{totalParentArea} m²</strong>
          </div>
          {isAreaGap ? (
            <div style={{ color: '#dc2626', fontWeight: 700, fontSize: '0.675rem' }}>
              ⚠️ Chênh lệch diện tích: {Math.abs(areaDiff)} m² so với sổ đỏ
            </div>
          ) : (
            <div style={{ color: '#16a34a', fontWeight: 700, fontSize: '0.675rem' }}>
              ✓ Khớp ranh 100%
            </div>
          )}
        </div>
      </div>

      {/* BANNER TƯỜNG MINH CƠ CHẾ MAX ZONE + 1 */}
      <div
        style={{
          backgroundColor: '#fff7ed',
          border: '2px solid #ea580c',
          borderRadius: '0.65rem',
          padding: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.45rem',
          boxShadow: '0 2px 8px rgba(234, 88, 12, 0.1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#9a3412', fontWeight: 900, fontSize: '0.85rem' }}>
            <Tag size={17} color="#ea580c" />
            <span>MÃ SỐ HIỆU CẤP MỚI CHO THỬA CON (LÔ B):</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span
              style={{
                backgroundColor: '#ea580c',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '0.95rem',
                padding: '0.25rem 0.85rem',
                borderRadius: '0.4rem',
                letterSpacing: '0.75px',
                boxShadow: '0 2px 4px rgba(234, 88, 12, 0.25)',
              }}
            >
              {codeB}
            </span>
            <span
              style={{
                backgroundColor: '#ffedd5',
                color: '#c2410c',
                fontWeight: 800,
                fontSize: '0.7rem',
                padding: '0.25rem 0.5rem',
                borderRadius: '0.35rem',
                border: '1px solid #fed7aa',
              }}
            >
              {mutationData.residualKind === 'NEW_BUILDING' ? 'CƠ CHẾ: MAX ZONE + 1' : 'ĐẤT DÔI DƯ / SÂN VƯỜN'}
            </span>
          </div>
        </div>

        <div style={{ fontSize: '0.74rem', color: '#7c2d12', lineHeight: 1.45, backgroundColor: 'rgba(255,255,255,0.85)', padding: '0.45rem 0.65rem', borderRadius: '0.4rem', border: '1px dashed #fdba74' }}>
          {mutationData.residualKind === 'NEW_BUILDING' ? (
            <>
              📌 <strong>Quy tắc cấp mã tường minh</strong>: Hệ thống quét toàn bộ phân khu <strong>{maxZoneInfo?.zoneId || parcelData.zoneId || 'ZONE_01'}</strong> trong cơ sở dữ liệu. Mã hiện có lớn nhất là <strong>[{maxZoneInfo?.currentMaxCode || 'Đang quét...'}]</strong>. Thửa mới sinh ra (Lô B) được cấp số hiệu tiếp nối là <strong>[{maxZoneInfo?.nextCode || dynamicCodes[0] || '...'}]</strong>. Khi cấp thẩm quyền phê duyệt hồ sơ, Lô B sẽ chính thức trở thành thửa đất mới trên bản đồ để KSV tiếp tục khảo sát tại chỗ.
            </>
          ) : (
            <>
              📌 <strong>Quy tắc khoanh ranh nhà</strong>: Giữ nguyên vẹn 100% ranh đất địa chính trong sổ đỏ ban đầu ({calculatedAreaA + calculatedAreaB} m²). Hệ thống chỉ khoanh vùng ranh nhà thực tế cho Lô A ({calculatedAreaA} m²), phần đất dư sân vườn ({calculatedAreaB} m²) được gán mã <strong>[{parcelData.projectParcelCode}-DU]</strong> để làm căn cứ bồi thường đất trống mà KHÔNG tạo lô khảo sát mới.
            </>
          )}
        </div>
      </div>

      {/* PHÂN LOẠI CÔNG NĂNG CHO THỬA CON (LÔ B) - 2 NHÁNH LỰA CHỌN */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1.5px solid #fed7aa',
          borderRadius: '0.65rem',
          padding: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.55rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.775rem', fontWeight: 800, color: '#9a3412', margin: 0, display: 'flex', alignItems: 'center' }}>
            <Tag size={15} color="#ea580c" style={{ marginRight: '0.35rem' }} />
            Bản chất Ô còn dư (Màu 2 - {calculatedAreaB} m²):
            <HelpBadge
              type="alert"
              title="Phân loại 2 nhánh Ô dôi dư"
              content="Nhánh 1: Nếu là sân vườn, đất trống, lối đi (không có công trình nhà), hệ thống chỉ lưu ranh đất đền bù và KHÔNG tạo lô khảo sát mới. Nhánh 2: Nếu là một căn nhà mới độc lập, hệ thống sẽ cấp mã mới (B-07xxx) và tạo lô mới để KSV tiếp tục khảo sát."
            />
          </label>
        </div>

        {/* BỘ CHỌN 2 NHÁNH TOGGLE BUTTONS */}
        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              const updatedChildren = [...(mutationData.splitChildren || [])];
              if (!updatedChildren[0]) {
                updatedChildren[0] = {
                  label: `Căn A (Đang KS - ${parcelData.projectParcelCode})`,
                  houseNumber: parcelData.houseNumber,
                  ownerName: parcelData.ownerName || '',
                  suggestedCode: parcelData.projectParcelCode,
                  areaM2: calculatedAreaA,
                  functionalType: 'Nhà ở gia đình (Nhà phố / Biệt thự / Căn hộ)',
                };
              }
              updatedChildren[1] = {
                ...(updatedChildren[1] || {
                  label: 'Phần diện tích dôi dư (Đất thừa / Sân vườn)',
                  houseNumber: `${parcelData.houseNumber}B`,
                  ownerName: 'Chủ sở hữu phần đất dôi dư',
                }),
                suggestedCode: `${parcelData.projectParcelCode}-DU`,
                areaM2: calculatedAreaB,
                functionalType: 'RESIDUAL_SURPLUS',
                residualKind: 'NON_BUILDING',
                isResidualSurplus: true,
                residualParentParcelCode: parcelData.projectParcelCode,
                residualParentCadastralCode: parcelData.officialCadastralCode,
                residualParentAddress: `Số ${parcelData.houseNumber} ${parcelData.street}`,
                residualMetadataNote: `Đất thừa tách từ ${parcelData.projectParcelCode}`,
              };
              onMutationDataChange({
                ...mutationData,
                residualKind: 'NON_BUILDING',
                splitChildren: updatedChildren,
                isSubmitted: false,
              });
            }}
            style={{
              flex: '1 1 200px',
              padding: '0.5rem 0.65rem',
              borderRadius: '0.5rem',
              fontSize: '0.725rem',
              fontWeight: (mutationData.residualKind !== 'NEW_BUILDING') ? 800 : 600,
              backgroundColor: (mutationData.residualKind !== 'NEW_BUILDING') ? '#059669' : '#f8fafc',
              color: (mutationData.residualKind !== 'NEW_BUILDING') ? '#ffffff' : '#475569',
              border: (mutationData.residualKind !== 'NEW_BUILDING') ? 'none' : '1px solid #cbd5e1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              boxShadow: (mutationData.residualKind !== 'NEW_BUILDING') ? '0 2px 4px rgba(5, 150, 105, 0.25)' : 'none',
            }}
          >
            <Trees size={15} /> 🌳 1. Khoanh Ranh Nhà (Đất dư sân vườn - Không tách thửa đất)
          </button>

          <button
            type="button"
            onClick={() => {
              const updatedChildren = [...(mutationData.splitChildren || [])];
              if (!updatedChildren[0]) {
                updatedChildren[0] = {
                  label: `Căn A (Đang KS - ${parcelData.projectParcelCode})`,
                  houseNumber: parcelData.houseNumber,
                  ownerName: parcelData.ownerName || '',
                  suggestedCode: parcelData.projectParcelCode,
                  areaM2: calculatedAreaA,
                  functionalType: 'Nhà ở gia đình (Nhà phố / Biệt thự / Căn hộ)',
                };
              }
              const newCode = maxZoneInfo?.nextCode || dynamicCodes[0] || `${parcelData.projectParcelCode}-B`;
              updatedChildren[1] = {
                ...(updatedChildren[1] || {
                  label: `Lô B (Nhà mới độc lập - ${newCode})`,
                  houseNumber: `${parcelData.houseNumber}B`,
                  ownerName: 'Chủ hộ Lô B',
                }),
                suggestedCode: newCode,
                areaM2: calculatedAreaB,
                functionalType: 'Nhà ở gia đình (Nhà phố / Biệt thự / Căn hộ)',
                residualKind: 'NEW_BUILDING',
                isResidualSurplus: false,
                residualParentParcelCode: parcelData.projectParcelCode,
                residualParentCadastralCode: parcelData.officialCadastralCode,
                residualParentAddress: `Số ${parcelData.houseNumber} ${parcelData.street}`,
                residualMetadataNote: `Nhà mới tách từ ${parcelData.projectParcelCode}`,
              };
              onMutationDataChange({
                ...mutationData,
                residualKind: 'NEW_BUILDING',
                splitChildren: updatedChildren,
                isSubmitted: false,
              });
            }}
            style={{
              flex: '1 1 200px',
              padding: '0.5rem 0.65rem',
              borderRadius: '0.5rem',
              fontSize: '0.725rem',
              fontWeight: (mutationData.residualKind === 'NEW_BUILDING') ? 800 : 600,
              backgroundColor: (mutationData.residualKind === 'NEW_BUILDING') ? '#ea580c' : '#f8fafc',
              color: (mutationData.residualKind === 'NEW_BUILDING') ? '#ffffff' : '#475569',
              border: (mutationData.residualKind === 'NEW_BUILDING') ? 'none' : '1px solid #cbd5e1',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              boxShadow: (mutationData.residualKind === 'NEW_BUILDING') ? '0 2px 4px rgba(234, 88, 12, 0.25)' : 'none',
            }}
          >
            <Home size={15} /> 🏠 2. Tách Thửa Nhà Mới (Lô B độc lập - Cấp mã Max Zone + 1: {maxZoneInfo?.nextCode || dynamicCodes[0] || '...'})
          </button>
        </div>

        {/* THÔNG ĐIỆP HƯỚNG DẪN TƯƠNG ỨNG TỪNG NHÁNH */}
        {mutationData.residualKind !== 'NEW_BUILDING' ? (
          <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: '0.45rem', padding: '0.45rem 0.65rem', fontSize: '0.7rem', color: '#065f46', lineHeight: 1.4 }}>
            ✓ <strong>Nhánh Khoanh Ranh Nhà (Không tách thửa)</strong>: Ranh đất địa chính pháp lý trong sổ đỏ ({calculatedAreaA + calculatedAreaB} m²) được <strong>giữ nguyên vẹn 100%</strong>. Hệ thống chỉ cập nhật ranh chân đế ngôi nhà ({calculatedAreaA} m²), phần đất dư sân vườn ({calculatedAreaB} m²) được ghi nhận làm căn cứ bồi thường đất trống. Hệ thống <strong>KHÔNG tạo thêm lô khảo sát mới</strong>, KSV hoàn tất Lô A ({parcelData.projectParcelCode}) là xong toàn bộ thửa đất.
          </div>
        ) : (
          <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fdba74', borderRadius: '0.45rem', padding: '0.45rem 0.65rem', fontSize: '0.7rem', color: '#9a3412', lineHeight: 1.4 }}>
            ⚡ <strong>Nhánh Tách Thửa Nhà Mới</strong>: Lô A giữ nguyên mã gốc [{parcelData.projectParcelCode}]. Hệ thống tự động <strong>cấp mã mới [{maxZoneInfo?.nextCode || dynamicCodes[0] || 'Max Zone + 1'}]</strong> cho Lô B theo cơ chế Max Zone + 1 và tạo 1 lô mới trên bản đồ để KSV tiếp tục khảo sát tại chỗ!
          </div>
        )}

        {/* CHI TIẾT CÔNG NĂNG & THÔNG TIN LÔ B */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.1rem' }}>
          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', margin: 0 }}>
            {mutationData.residualKind === 'NEW_BUILDING' ? 'Loại hình công trình Lô B:' : 'Chi tiết hiện trạng phần đất dôi dư:'}
          </label>
          <select
            className="form-control"
            style={{ fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', color: '#1e293b' }}
            value={
              (mutationData.residualKind === 'NEW_BUILDING' ? BUILDING_RESIDUAL_OPTIONS : NON_BUILDING_RESIDUAL_OPTIONS).some(
                (opt) => opt.value === (mutationData.splitChildren?.[1]?.functionalType)
              )
                ? (mutationData.splitChildren?.[1]?.functionalType || (mutationData.residualKind === 'NEW_BUILDING' ? 'Nhà ở gia đình (Nhà phố / Biệt thự / Căn hộ)' : 'RESIDUAL_SURPLUS'))
                : 'OTHER'
            }
            onChange={(e) => {
              const val = e.target.value;
              const finalType = val === 'OTHER' ? (customResidualType || 'Khác: ') : val;
              const updatedChildren = [...(mutationData.splitChildren || [])];
              if (updatedChildren[1]) {
                updatedChildren[1] = {
                  ...updatedChildren[1],
                  functionalType: finalType,
                };
                onMutationDataChange({
                  ...mutationData,
                  splitChildren: updatedChildren,
                  isSubmitted: false,
                });
              }
            }}
          >
            {(mutationData.residualKind === 'NEW_BUILDING' ? BUILDING_RESIDUAL_OPTIONS : NON_BUILDING_RESIDUAL_OPTIONS).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Ô nhập text tự do khi chọn KHÁC */}
          {(mutationData.splitChildren?.[1]?.functionalType === 'OTHER' ||
            (mutationData.splitChildren?.[1]?.functionalType &&
              !(mutationData.residualKind === 'NEW_BUILDING' ? BUILDING_RESIDUAL_OPTIONS : NON_BUILDING_RESIDUAL_OPTIONS).some(
                (o) => o.value === mutationData.splitChildren?.[1]?.functionalType
              ))) && (
            <div style={{ marginTop: '0.15rem' }}>
              <input
                type="text"
                className="form-control"
                style={{ fontSize: '0.75rem', backgroundColor: '#ffffff', border: '1px solid #fdba74' }}
                placeholder="Nhập cụ thể công năng sử dụng thực tế..."
                value={customResidualType || mutationData.splitChildren?.[1]?.functionalType || ''}
                onChange={(e) => {
                  const text = e.target.value;
                  setCustomResidualType(text);
                  const updatedChildren = [...(mutationData.splitChildren || [])];
                  if (updatedChildren[1]) {
                    updatedChildren[1] = {
                      ...updatedChildren[1],
                      functionalType: text,
                      residualMetadataNote: `Công năng khác: ${text}`,
                    };
                    onMutationDataChange({
                      ...mutationData,
                      splitChildren: updatedChildren,
                      isSubmitted: false,
                    });
                  }
                }}
              />
            </div>
          )}

          {/* Nếu là NHÀ MỚI ĐỘC LẬP: Hiển thị thêm ô nhập số nhà và chủ hộ Lô B */}
          {mutationData.residualKind === 'NEW_BUILDING' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.2rem', backgroundColor: '#f8fafc', padding: '0.45rem', borderRadius: '0.4rem', border: '1px dashed #cbd5e1' }}>
              <div>
                <label style={{ fontSize: '0.675rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.15rem' }}>
                  Số nhà Lô B:
                </label>
                <input
                  type="text"
                  className="form-control"
                  style={{ fontSize: '0.725rem' }}
                  placeholder="VD: 108B..."
                  value={mutationData.splitChildren?.[1]?.houseNumber || `${parcelData.houseNumber}B`}
                  onChange={(e) => {
                    const text = e.target.value;
                    const updatedChildren = [...(mutationData.splitChildren || [])];
                    if (updatedChildren[1]) {
                      updatedChildren[1] = { ...updatedChildren[1], houseNumber: text };
                      onMutationDataChange({ ...mutationData, splitChildren: updatedChildren, isSubmitted: false });
                    }
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.675rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.15rem' }}>
                  Chủ hộ Lô B:
                </label>
                <input
                  type="text"
                  className="form-control"
                  style={{ fontSize: '0.725rem' }}
                  placeholder="Tên chủ hộ Lô B..."
                  value={mutationData.splitChildren?.[1]?.ownerName || ''}
                  onChange={(e) => {
                    const text = e.target.value;
                    const updatedChildren = [...(mutationData.splitChildren || [])];
                    if (updatedChildren[1]) {
                      updatedChildren[1] = { ...updatedChildren[1], ownerName: text };
                      onMutationDataChange({ ...mutationData, splitChildren: updatedChildren, isSubmitted: false });
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* LÝ DO CHIA TÁCH THỬA ĐẤT THỰC TẾ: LIST SỔ CHỌN + MỤC KHÁC CHO NHẬP */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', margin: 0, display: 'flex', alignItems: 'center' }}>
          Lý do chia tách thửa đất thực tế:
          <span style={{ color: '#dc2626', marginLeft: '4px', fontWeight: 800 }}>* (Bắt buộc)</span>
          <HelpBadge
            title="Lý do tách thửa"
            content="Bắt buộc chọn lý do phổ biến trong danh sách sổ chọn hoặc chọn 'Khác' để nhập chi tiết lý do phân chia thực tế."
          />
        </label>

        <select
          id="input-splitReason"
          className="form-control"
          style={{ fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#ffffff', border: '1.5px solid #cbd5e1' }}
          value={
            COMMON_SPLIT_REASONS.includes(mutationData.splitReason || '')
              ? (mutationData.splitReason || '')
              : (mutationData.splitReason ? 'OTHER' : '')
          }
          onChange={(e) => {
            const val = e.target.value;
            if (val === 'OTHER') {
              onMutationDataChange({
                ...mutationData,
                splitReason: customSplitReason ? `Khác: ${customSplitReason}` : 'Khác: ',
                isSubmitted: false,
              });
            } else {
              onMutationDataChange({
                ...mutationData,
                splitReason: val,
                isSubmitted: false,
              });
            }
          }}
        >
          <option value="">-- Chọn lý do chia tách thửa đất thực tế --</option>
          {COMMON_SPLIT_REASONS.map((r, i) => (
            <option key={r} value={r}>
              {i + 1}. {r}
            </option>
          ))}
          <option value="OTHER">7. Khác (Nhập lý do thực tế...)</option>
        </select>

        {/* Ô nhập lý do khác khi chọn OTHER */}
        {(mutationData.splitReason?.startsWith('Khác') ||
          (mutationData.splitReason && !COMMON_SPLIT_REASONS.includes(mutationData.splitReason))) && (
          <div style={{ marginTop: '0.15rem' }}>
            <input
              type="text"
              className="form-control"
              style={{ fontSize: '0.75rem', border: '1px solid #fdba74' }}
              placeholder="Nhập lý do chia tách thực tế tại hiện trường..."
              value={
                customSplitReason ||
                (mutationData.splitReason.startsWith('Khác: ')
                  ? mutationData.splitReason.replace('Khác: ', '')
                  : mutationData.splitReason)
              }
              onChange={(e) => {
                const text = e.target.value;
                setCustomSplitReason(text);
                onMutationDataChange({
                  ...mutationData,
                  splitReason: text ? `Khác: ${text}` : 'Khác: ',
                  isSubmitted: false,
                });
              }}
            />
          </div>
        )}
      </div>

      {/* Phản hồi trực quan sau khi đề xuất tách thửa */}
      {mutationData.activeProposalType === 'SPLIT' && mutationData.isSubmitted && (
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
            ✓ Đã lưu tạm cấu hình tách thửa vào hồ sơ thửa ban đầu {parcelData.projectParcelCode} ({mutationData.submittedAt}). Đề xuất được lưu trong hồ sơ thửa ban đầu.
          </span>
        </div>
      )}

      {/* NÚT LƯU ĐỀ XUẤT TÁCH THỬA (CÓ HIỆU ỨNG PHẢN HỒI) */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={handleSaveMutationProposal}
          disabled={isSubmittingMutation}
          style={{
            backgroundColor: (mutationData.activeProposalType === 'SPLIT' && mutationData.isSubmitted) ? '#16a34a' : '#ea580c',
            borderColor: (mutationData.activeProposalType === 'SPLIT' && mutationData.isSubmitted) ? '#16a34a' : '#ea580c',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.75rem',
            fontWeight: 700,
            padding: '0.4rem 0.95rem',
            boxShadow: (mutationData.activeProposalType === 'SPLIT' && mutationData.isSubmitted) ? '0 0 0 3px rgba(22, 163, 74, 0.25)' : 'none',
          }}
        >
          {(mutationData.activeProposalType === 'SPLIT' && mutationData.isSubmitted) ? <CheckCircle2 size={15} /> : <CheckCircle size={14} />}
          <span>
            {isSubmittingMutation
              ? 'Đang lưu...'
              : (mutationData.activeProposalType === 'SPLIT' && mutationData.isSubmitted)
              ? `ĐÃ GHI NHẬN ĐỀ XUẤT TÁCH THỬA (${mutationData.submittedAt})`
              : 'Lưu đề xuất Tách thửa'}
          </span>
        </button>
      </div>
    </div>
  );
};
