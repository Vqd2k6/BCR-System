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
import { CadastralParcelData, MutationPayloadData, MaxZoneCodeInfo } from '../../../shared/types';
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
  polyAVertices: [number, number][];
  setPolyAVertices: (pts: [number, number][]) => void;
  polyBVertices?: [number, number][];
  calculatedAreaA: number;
  calculatedAreaB: number;
  dynamicCodes: string[];
  maxZoneInfo?: MaxZoneCodeInfo | null;
  handleVertexDrag: (idx: number, latlng: L.LatLng) => void;
  handleMapClickDraw: (latlng: [number, number]) => void;
  handleAddMidpoint: () => void;
  handleRemovePoint: () => void;
  handleResetDefault: () => void;
  handleApplyLShape: () => void;
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
  polyAVertices,
  setPolyAVertices,
  polyBVertices,
  calculatedAreaA,
  calculatedAreaB,
  dynamicCodes,
  maxZoneInfo,
  handleVertexDrag,
  handleMapClickDraw,
  handleAddMidpoint,
  handleRemovePoint,
  handleResetDefault,
  handleApplyLShape,
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
          <span>Biên Tập Phân Tách Thửa Đất Trực Quan (2 Lô: Lô A Đang KS & Lô B Tách Mới)</span>
          <HelpBadge
            title="Hướng dẫn Tách thửa trực quan"
            content="Bản đồ hiển thị đồng thời cả Lô A (Màu vàng - Thửa chính đang khảo sát) và Lô B (Màu cam - Thửa con tách ra/đất dôi dư). Bạn có thể bấm các mẫu cắt nhanh (60/40, 50/50, chữ L) hoặc kéo các điểm mút trực tiếp trên bản đồ."
          />
        </div>
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          <span className="badge" style={{ backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontSize: '0.7rem', padding: '0.25rem 0.55rem' }}>
            Lô A (Gốc): <strong>{codeA}</strong>
          </span>
          <span className="badge" style={{ backgroundColor: '#ffedd5', color: '#c2410c', border: '1px solid #fed7aa', fontSize: '0.7rem', padding: '0.25rem 0.55rem' }}>
            Lô B ({mutationData.residualKind === 'NEW_BUILDING' ? 'Max Zone + 1' : 'Đất dư'}): <strong>{codeB}</strong>
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
          onClick={handleApplyLShape}
          className="btn btn-secondary btn-sm"
          style={{ fontSize: '0.675rem', padding: '0.22rem 0.5rem', backgroundColor: '#fed7aa', color: '#9a3412', fontWeight: 700, border: '1px solid #ea580c' }}
          title="Tạo hình nhà chữ L"
        >
          📐 Mẫu chữ L
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
            padding: '0.5rem 0.65rem',
            borderRadius: '0.5rem',
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
          <Move size={15} /> Chế độ 1: Kéo nắn các điểm mút ranh giới (Khuyên dùng)
        </button>

        <button
          type="button"
          onClick={() => {
            setSplitShapeOption('CLICK_TO_DRAW');
            onMutationDataChange({ ...mutationData, splitShapeOption: 'CLICK_TO_DRAW', isSubmitted: false });
          }}
          style={{
            flex: 1,
            padding: '0.5rem 0.65rem',
            borderRadius: '0.5rem',
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
          <MousePointer size={15} /> Chế độ 2: Nhấp chuột chấm điểm tự do trên bản đồ
        </button>
      </div>

      {/* TOOLBAR NÚT CÔNG CỤ THEO TỪNG OPTION */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.35rem',
          backgroundColor: '#fff7ed',
          padding: '0.4rem 0.65rem',
          borderRadius: '0.5rem',
          border: '1px dashed #fdba74',
        }}
      >
        {splitShapeOption === 'DRAG_HANDLES' ? (
          <>
            <div style={{ fontSize: '0.725rem', color: '#9a3412', fontWeight: 700 }}>
              Kéo trực tiếp các điểm mút tròn (1, 2, 3...) để phân chia tỷ lệ Lô A và Lô B:
            </div>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <button
                type="button"
                onClick={handleAddMidpoint}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.675rem', padding: '0.2rem 0.45rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
              >
                <Plus size={11} /> Thêm điểm nắn
              </button>
              <button
                type="button"
                onClick={handleRemovePoint}
                disabled={polyAVertices.length <= 3}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.675rem', padding: '0.2rem 0.45rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
              >
                <Minus size={11} /> Bớt điểm
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: '0.725rem', color: '#9a3412', fontWeight: 700 }}>
              Nhấp trên bản đồ để chấm các đỉnh ranh giới cho Lô A ({polyAVertices.length} điểm đã chấm):
            </div>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <button
                type="button"
                onClick={handleRemovePoint}
                disabled={polyAVertices.length === 0}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.675rem', padding: '0.2rem 0.45rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
              >
                <Undo size={11} /> Hoàn tác
              </button>
              <button
                type="button"
                onClick={() => {
                  setPolyAVertices([]);
                  onMutationDataChange({ ...mutationData, splitCustomPointsA: [], isSubmitted: false });
                }}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.675rem', padding: '0.2rem 0.45rem', display: 'flex', alignItems: 'center', gap: '0.2rem', color: '#dc2626' }}
              >
                <Trash2 size={11} /> Xóa vẽ lại
              </button>
            </div>
          </>
        )}
      </div>

      {/* LEAFLET MAP VISUALIZER: RENDER ĐỒNG THỜI CẢ LÔ A VÀ LÔ B */}
      <div
        style={{
          width: '100%',
          height: '350px',
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

          {/* Click listener for Option 2: Chấm điểm */}
          <MapClickListener
            enabled={splitShapeOption === 'CLICK_TO_DRAW'}
            onMapClick={handleMapClickDraw}
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

          {/* 1. NỀN RANH ĐẤT GỐC BAN ĐẦU (VIỀN NÉT ĐỨT XÁM PHÁP LÝ) */}
          <Polygon
            positions={realActiveCoords}
            pathOptions={{
              color: '#64748b',
              fillColor: '#94a3b8',
              fillOpacity: 0.1,
              weight: 1.5,
              dashArray: '5, 5',
            }}
          >
            <Tooltip direction="top">
              <div style={{ fontSize: '0.725rem', color: '#334155' }}>
                Ranh đất gốc theo sổ đỏ: <strong>{parcelData.projectParcelCode}</strong> ({parcelData.landArea || parcelData.constructionArea || Math.round((calculatedAreaA + calculatedAreaB) * 10) / 10} m²)
              </div>
            </Tooltip>
          </Polygon>

          {/* 2. LÔ B: PHẦN TÁCH MỚI HOẶC ĐẤT DÔI DƯ (MÀU CAM RỰC - #ea580c) */}
          {polyBVertices && polyBVertices.length >= 3 && (
            <Polygon
              positions={polyBVertices}
              pathOptions={{
                color: '#c2410c',
                fillColor: '#ea580c',
                fillOpacity: 0.65,
                weight: 3.5,
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
                color: '#b45309',
                fillColor: '#f59e0b',
                fillOpacity: 0.78,
                weight: 4,
              }}
            >
              <Tooltip direction="top" opacity={0.9}>
                <div style={{ textAlign: 'center', fontWeight: 800, color: '#78350f', fontSize: '0.725rem' }}>
                  🟡 LÔ A (ĐANG KS): {codeA} ({calculatedAreaA} m²)
                </div>
              </Tooltip>
            </Polygon>
          )}

          {/* Polyline preview khi đang chấm < 3 điểm ở Option Chấm điểm */}
          {polyAVertices.length > 0 && polyAVertices.length < 3 && (
            <Polyline
              positions={polyAVertices}
              pathOptions={{ color: '#d97706', weight: 4, dashArray: '4, 4' }}
            />
          )}

          {/* DRAGGABLE VERTEX HANDLES TRONG CHẾ ĐỘ KÉO NẮN ĐIỂM */}
          {splitShapeOption === 'DRAG_HANDLES' &&
            polyAVertices.map((vertex, idx) => (
              <Marker
                key={`vertex-${idx}`}
                position={vertex}
                draggable={true}
                icon={createHandleIcon(idx + 1)}
                eventHandlers={{
                  dragend: (e) => {
                    handleVertexDrag(idx, e.target.getLatLng());
                  },
                }}
              />
            ))}

          {/* MARKER CHẤM ĐIỂM TRONG CHẾ ĐỘ CHẤM TỰ DO */}
          {splitShapeOption === 'CLICK_TO_DRAW' &&
            polyAVertices.map((vertex, idx) => (
              <Marker
                key={`click-point-${idx}`}
                position={vertex}
                icon={createHandleIcon(idx + 1)}
              />
            ))}
        </MapContainer>

        {/* Floating Legend trực quan phân biệt 2 Lô A và B */}
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
            border: '1.5px solid #fed7aa',
            boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
            display: 'flex',
            gap: '0.85rem',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: '12px', height: '12px', backgroundColor: '#f59e0b', border: '1.5px solid #b45309', borderRadius: '2px', display: 'inline-block' }}></span>
            <span>Lô A (Đang KS - {codeA}): <strong>{calculatedAreaA} m²</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: '12px', height: '12px', backgroundColor: '#ea580c', border: '1.5px solid #c2410c', borderRadius: '2px', display: 'inline-block' }}></span>
            <span>Lô B ({mutationData.residualKind === 'NEW_BUILDING' ? 'Tách mới' : 'Đất dư'} - {codeB}): <strong>{calculatedAreaB} m²</strong></span>
          </div>
          <div style={{ color: '#64748b', fontSize: '0.675rem' }}>
            Tổng: <strong>{Math.round((calculatedAreaA + calculatedAreaB) * 10) / 10} m²</strong>
          </div>
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
