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
} from 'lucide-react';
import { CadastralParcelData, MutationPayloadData } from '../../../shared/types';
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
  calculatedAreaA: number;
  calculatedAreaB: number;
  dynamicCodes: string[];
  handleVertexDrag: (idx: number, latlng: L.LatLng) => void;
  handleMapClickDraw: (latlng: [number, number]) => void;
  handleAddMidpoint: () => void;
  handleRemovePoint: () => void;
  handleResetDefault: () => void;
  handleApplyLShape: () => void;
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
  calculatedAreaA,
  calculatedAreaB,
  dynamicCodes,
  handleVertexDrag,
  handleMapClickDraw,
  handleAddMidpoint,
  handleRemovePoint,
  handleResetDefault,
  handleApplyLShape,
  mutationData,
  onMutationDataChange,
  customResidualType,
  setCustomResidualType,
  customSplitReason,
  setCustomSplitReason,
  handleSaveMutationProposal,
  isSubmittingMutation,
}) => {
  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #fdba74',
        borderRadius: '0.75rem',
        padding: '0.85rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', color: '#c2410c', fontWeight: 800, fontSize: '0.825rem' }}>
          <Layers size={17} style={{ marginRight: '0.35rem' }} />
          <span>Biên Tập Phân Tách Thửa Đất (2 Màu: Căn Đang KS & Đất Còn Dư)</span>
          <HelpBadge
            title="Hướng dẫn Tách thửa"
            content="Option 1: Chấm trực tiếp các điểm trên bản đồ, các điểm tự link lại để tạo diện tích cho mảnh đất (nhà chữ L, đa giác tự do). Option 2: Điều chỉnh kéo nắn các điểm mút polygon. Phần diện tích còn dư tự động tính cho ô thứ 2."
          />
        </div>
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          <span className="badge" style={{ backgroundColor: '#ffedd5', color: '#c2410c', border: '1px solid #fed7aa', fontSize: '0.675rem' }}>
            Căn A: <strong>{parcelData.projectParcelCode}</strong> (Gốc)
            {mutationData.residualKind === 'NEW_BUILDING' && (
              <span> | Căn B: <strong>{dynamicCodes[0] || `${parcelData.projectParcelCode}-B`}</strong> (Mã mới)</span>
            )}
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
            {tileMode === 'osm' ? 'Vệ tinh' : 'Bản đồ'}
          </button>
        </div>
      </div>

      {/* BỘ CHỌN 2 OPTION BIÊN TẬP TÁCH THỬA (OPTION 1: CHẤM ĐIỂM, OPTION 2: KÉO NẮN ĐIỂM) */}
      <div style={{ display: 'flex', gap: '0.45rem' }}>
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
          <MousePointer size={15} /> Option 1: Chấm các điểm (Tự link tạo diện tích)
        </button>

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
          <Move size={15} /> Option 2: Điều chỉnh các điểm (Kéo di chuyển chấm)
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
        {splitShapeOption === 'CLICK_TO_DRAW' ? (
          <>
            <div style={{ fontSize: '0.725rem', color: '#9a3412', fontWeight: 700 }}>
              Option 1: Nhấp trên bản đồ để chấm các đỉnh ranh ({polyAVertices.length} điểm đã chấm):
            </div>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <button
                type="button"
                onClick={handleApplyLShape}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.675rem', padding: '0.2rem 0.45rem', display: 'flex', alignItems: 'center', gap: '0.2rem', backgroundColor: '#fed7aa', color: '#9a3412', fontWeight: 700 }}
              >
                Mẫu chữ L
              </button>
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
                <Trash2 size={11} /> Xóa vẽ lại (0 điểm)
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: '0.725rem', color: '#9a3412', fontWeight: 700 }}>
              Option 2: Kéo trực tiếp các điểm mút tròn (1, 2, 3...) để khớp với thực tế:
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
              <button
                type="button"
                onClick={handleResetDefault}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.675rem', padding: '0.2rem 0.45rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
              >
                <RefreshCw size={11} /> Khôi phục mặc định
              </button>
            </div>
          </>
        )}
      </div>

      {/* LEAFLET MAP VISUALIZER: TỌA ĐỘ THẬT POSTGIS VÀ CÁC ĐIỂM INTERACTIVE */}
      <div
        style={{
          width: '100%',
          height: '290px',
          borderRadius: '0.65rem',
          overflow: 'hidden',
          border: '1.5px solid #fdba74',
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

          {/* Click listener for Option 1: Chấm điểm */}
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

          {/* PHẦN ĐẤT DƯ (MÀU 2 - CAM ĐỎ): NỀN THỬA GỐC ĐỊA CHÍNH */}
          <Polygon
            positions={realActiveCoords}
            pathOptions={{
              color: '#c2410c',
              fillColor: '#ea580c',
              fillOpacity: 0.45,
              weight: 2.5,
              dashArray: '5, 5',
            }}
          >
            <Tooltip direction="top">
              <div style={{ fontSize: '0.725rem', fontWeight: 800, color: '#c2410c' }}>
                Phần còn lại / Đất thừa: {dynamicCodes[1] || 'B-00109'} ({calculatedAreaB} m²)
              </div>
            </Tooltip>
          </Polygon>

          {/* CĂN A ĐANG KHẢO SÁT (MÀU 1 - VÀNG HỔ PHÁCH): ĐA GIÁC ĐƯỢC CHẤM / NẮN ĐIỂM */}
          {polyAVertices.length >= 3 && (
            <Polygon
              positions={polyAVertices}
              pathOptions={{
                color: '#d97706',
                fillColor: '#f59e0b',
                fillOpacity: 0.7,
                weight: 3.5,
              }}
            >
              <Tooltip direction="top">
                <div style={{ fontSize: '0.725rem', fontWeight: 800, color: '#92400e' }}>
                  Căn A (Đang KS): {dynamicCodes[0] || 'B-00108'} ({calculatedAreaA} m²)
                </div>
              </Tooltip>
            </Polygon>
          )}

          {/* Polyline preview khi đang chấm < 3 điểm ở Option 1 */}
          {polyAVertices.length > 0 && (
            <Polyline
              positions={polyAVertices}
              pathOptions={{ color: '#d97706', weight: 4, dashArray: polyAVertices.length < 3 ? '4, 4' : undefined }}
            />
          )}

          {/* DRAGGABLE VERTEX HANDLES TRONG OPTION 2 */}
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

          {/* MARKER CHẤM ĐIỂM TRONG OPTION 1 */}
          {splitShapeOption === 'CLICK_TO_DRAW' &&
            polyAVertices.map((vertex, idx) => (
              <Marker
                key={`click-point-${idx}`}
                position={vertex}
                icon={createHandleIcon(idx + 1)}
              />
            ))}
        </MapContainer>

        {/* Hướng dẫn khi chưa có điểm nào ở Option 1 */}
        {splitShapeOption === 'CLICK_TO_DRAW' && polyAVertices.length === 0 && (
          <div
            style={{
              position: 'absolute',
              top: '12px',
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
            <MousePointer size={14} color="#ea580c" />
            <span>👉 Hãy nhấp lên bản đồ để chấm các đỉnh ranh giới Căn A (Cần ít nhất 3 điểm để tạo thành mảnh đất)</span>
          </div>
        )}

        {/* Clean Floating Legend (Không che tâm thửa đất) */}
        <div
          style={{
            position: 'absolute',
            bottom: '8px',
            left: '8px',
            zIndex: 800,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            color: '#0f172a',
            padding: '0.3rem 0.6rem',
            borderRadius: '0.45rem',
            fontSize: '0.675rem',
            border: '1px solid #fed7aa',
            boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
            display: 'flex',
            gap: '0.65rem',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: '10px', height: '10px', backgroundColor: '#f59e0b', borderRadius: '2px', display: 'inline-block' }}></span>
            <span>Màu 1 (Căn A): <strong>{calculatedAreaA} m²</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: '10px', height: '10px', backgroundColor: '#ea580c', borderRadius: '2px', display: 'inline-block' }}></span>
            <span>Màu 2 (Đất thừa / Ô 2): <strong>{calculatedAreaB} m²</strong></span>
          </div>
        </div>
      </div>

      {/* PHÂN LOẠI CÔNG NĂNG CHO Ô CÒN DƯ (MÀU 2) - 2 NHÁNH LỰA CHỌN */}
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
              const newCode = dynamicCodes[0] || `${parcelData.projectParcelCode}-B`;
              updatedChildren[1] = {
                ...(updatedChildren[1] || {
                  label: 'Căn B (Nhà mới độc lập)',
                  houseNumber: `${parcelData.houseNumber}B`,
                  ownerName: 'Chủ hộ Căn B',
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
            <Home size={15} /> 🏠 2. Tách Thửa Nhà Mới (Căn B độc lập - Cấp mã Max Zone + 1)
          </button>
        </div>

        {/* THÔNG ĐIỆP HƯỚNG DẪN TƯƠNG ỨNG TỪNG NHÁNH */}
        {mutationData.residualKind !== 'NEW_BUILDING' ? (
          <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: '0.45rem', padding: '0.45rem 0.65rem', fontSize: '0.7rem', color: '#065f46', lineHeight: 1.4 }}>
            ✓ <strong>Nhánh Khoanh Ranh Nhà (Không tách thửa)</strong>: Ranh đất địa chính pháp lý trong sổ đỏ ({calculatedAreaA + calculatedAreaB} m²) được <strong>giữ nguyên vẹn 100%</strong>. Hệ thống chỉ cập nhật ranh chân đế ngôi nhà ({calculatedAreaA} m²), phần đất dư sân vườn ({calculatedAreaB} m²) được ghi nhận làm căn cứ bồi thường đất trống. Hệ thống <strong>KHÔNG tạo thêm lô khảo sát mới</strong>, KSV hoàn tất Căn A ({parcelData.projectParcelCode}) là xong toàn bộ thửa đất.
          </div>
        ) : (
          <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fdba74', borderRadius: '0.45rem', padding: '0.45rem 0.65rem', fontSize: '0.7rem', color: '#9a3412', lineHeight: 1.4 }}>
            ⚡ <strong>Nhánh Tách Thửa Nhà Mới</strong>: Căn A giữ nguyên mã gốc [{parcelData.projectParcelCode}]. Hệ thống sẽ <strong>cấp mã mới [{dynamicCodes[0] || 'Max Zone + 1'}]</strong> cho Căn B và tạo 1 lô mới trên bản đồ để KSV tiếp tục khảo sát tại chỗ!
          </div>
        )}

        {/* CHI TIẾT CÔNG NĂNG & THÔNG TIN CĂN B */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.1rem' }}>
          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', margin: 0 }}>
            {mutationData.residualKind === 'NEW_BUILDING' ? 'Loại hình công trình Căn B:' : 'Chi tiết hiện trạng phần đất dôi dư:'}
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

          {/* Nếu là NHÀ MỚI ĐỘC LẬP: Hiển thị thêm ô nhập số nhà và chủ hộ Căn B */}
          {mutationData.residualKind === 'NEW_BUILDING' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.2rem', backgroundColor: '#f8fafc', padding: '0.45rem', borderRadius: '0.4rem', border: '1px dashed #cbd5e1' }}>
              <div>
                <label style={{ fontSize: '0.675rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.15rem' }}>
                  Số nhà Căn B:
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
                  Chủ hộ Căn B:
                </label>
                <input
                  type="text"
                  className="form-control"
                  style={{ fontSize: '0.725rem' }}
                  placeholder="Tên chủ hộ Căn B..."
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
