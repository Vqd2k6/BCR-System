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
  Eye,
  EyeOff,
} from 'lucide-react';
import type { GisParcel, CadastralParcelData, MutationPayloadData, MaxZoneCodeInfo } from '../../../shared/types';
import { MapBoundsController, MapClickListener, HelpBadge } from '../../../shared/MapControllers';
import { createHandleIcon } from '../../../shared/geoMath';
import {
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
  zoneParcels?: GisParcel[];
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
  zoneParcels,
  splitShapeOption,
  setSplitShapeOption,
  activeTarget = 'A',
  setActiveTarget,
  polyAVertices,
  polyBVertices,
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
  const [showNeighbors, setShowNeighbors] = React.useState<boolean>(true);

  const codeA = parcelData.projectParcelCode;
  const codeB = mutationData.residualKind === 'NEW_BUILDING'
    ? (maxZoneInfo?.nextCode || dynamicCodes[0] || `${parcelData.projectParcelCode}-B`)
    : `${parcelData.projectParcelCode}-DU`;

  const totalParentArea = parcelData.landArea || parcelData.constructionArea || Math.round((calculatedAreaA + calculatedAreaB) * 10) / 10;
  const currentTotal = Math.round((calculatedAreaA + calculatedAreaB) * 10) / 10;
  const areaDiff = Math.round((totalParentArea - currentTotal) * 10) / 10;
  const isAreaGap = Math.abs(areaDiff) > 0.4;

  const currentVertices = activeTarget === 'A' ? polyAVertices : (polyBVertices || []);

  // Lọc các thửa lân cận trong Zone để hiển thị viền đối chiếu
  const validNeighbors = React.useMemo(() => {
    if (!zoneParcels || !Array.isArray(zoneParcels)) return [];
    return zoneParcels.filter((p) => {
      if (p.id === parcelData.id || p.projectParcelCode === parcelData.projectParcelCode) return false;
      const pts = p.coordinates;
      return Array.isArray(pts) && pts.length >= 3;
    });
  }, [zoneParcels, parcelData.id, parcelData.projectParcelCode]);

  return (
    <div
      style={{
        backgroundColor: 'rgb(var(--bg-white))',
        border: '1.5px solid rgb(var(--border-orange-300))',
        borderRadius: '0.75rem',
        padding: '0.85rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      {/* 1. Header Bar: Tiêu đề Studio & Badge phân loại Lô A / B */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', color: 'rgb(var(--text-orange-700))', fontWeight: 800, fontSize: '0.85rem' }}>
          <Layers size={18} style={{ marginRight: '0.35rem' }} />
          <span>Studio Phân Tách Thửa Đất Trực Quan (Khung Cha & 2 Lô Độc Lập)</span>
          <HelpBadge
            title="Hướng dẫn Tách thửa trực quan"
            content="Khung nét đứt xám là ranh đất gốc sổ đỏ. Bạn có thể chọn biên tập riêng Lô A (vàng) hoặc Lô B (cam) hoàn toàn độc lập, kéo nắn mốc ranh của từng lô, hoặc dùng nút Cắt nhanh. Khung bản đồ mở rộng hiển thị các thửa đất lân cận nét đứt mờ để căn chỉnh chuẩn xác không bị đè lẹm hoặc tạo khe hở."
          />
        </div>
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          <span className="badge" style={{ backgroundColor: 'rgb(var(--bg-amber-100))', color: 'rgb(var(--text-amber-800))', border: '1px solid rgb(var(--border-amber-200))', fontSize: '0.7rem', padding: '0.25rem 0.55rem' }}>
            Lô A: <strong>{codeA}</strong>
          </span>
          <span className="badge" style={{ backgroundColor: 'rgb(var(--bg-orange-100))', color: 'rgb(var(--text-orange-700))', border: '1px solid rgb(var(--border-orange-200))', fontSize: '0.7rem', padding: '0.25rem 0.55rem' }}>
            Lô B: <strong>{codeB}</strong>
          </span>
        </div>
      </div>

      {/* 2. STUDIO 2 CỘT: CỘT TRÁI THANH ĐIỀU KHIỂN & CỘT PHẢI BẢN ĐỒ TOÀN CẢNH SIÊU RỘNG */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch flex-1">
        {/* CỘT TRÁI: BỘ ĐIỀU KHIỂN NẮN CHỈNH, CẮT NHANH, MAX ZONE + 1, LÝ DO VÀ LƯU ĐỀ XUẤT */}
        <div className="w-full lg:w-[330px] shrink-0 flex flex-col gap-2.5 overflow-y-auto max-h-[82vh] lg:max-h-[calc(100vh-220px)] pr-1 custom-scrollbar">
          {/* BỘ CHỌN ĐỐI TƯỢNG BIÊN TẬP: LÔ A (ĐANG KS) HOẶC LÔ B (TÁCH MỚI / ĐẤT DƯ) */}
          <div
            style={{
              display: 'flex',
              gap: '0.45rem',
              backgroundColor: 'rgb(var(--bg-slate-50))',
              padding: '0.4rem',
              borderRadius: '0.55rem',
              border: '1.5px solid rgb(var(--border-slate-200))',
            }}
          >
            <button
              type="button"
              className="cursor-pointer"
              onClick={() => setActiveTarget && setActiveTarget('A')}
              style={{
                flex: 1,
                padding: '0.45rem 0.55rem',
                borderRadius: '0.45rem',
                fontSize: '0.73rem',
                fontWeight: activeTarget === 'A' ? 800 : 600,
                backgroundColor: activeTarget === 'A' ? 'rgb(var(--bg-amber-100))' : 'rgb(var(--bg-white))',
                color: activeTarget === 'A' ? 'rgb(var(--text-amber-800))' : 'rgb(var(--text-slate-600))',
                border: activeTarget === 'A' ? '2px solid #f59e0b' : '1px solid rgb(var(--border-slate-300))',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.3rem',
                boxShadow: activeTarget === 'A' ? '0 2px 4px rgba(245, 158, 11, 0.2)' : 'none',
              }}
            >
              <span style={{ width: '9px', height: '9px', backgroundColor: '#f59e0b', borderRadius: '50%', display: 'inline-block' }}></span>
              <span>🟡 Lô A ({polyAVertices.length}đ - {calculatedAreaA} m²)</span>
            </button>

            <button
              type="button"
              className="cursor-pointer"
              onClick={() => setActiveTarget && setActiveTarget('B')}
              style={{
                flex: 1,
                padding: '0.45rem 0.55rem',
                borderRadius: '0.45rem',
                fontSize: '0.73rem',
                fontWeight: activeTarget === 'B' ? 800 : 600,
                backgroundColor: activeTarget === 'B' ? 'rgb(var(--bg-orange-100))' : 'rgb(var(--bg-white))',
                color: activeTarget === 'B' ? 'rgb(var(--text-orange-700))' : 'rgb(var(--text-slate-600))',
                border: activeTarget === 'B' ? '2px solid #ea580c' : '1px solid rgb(var(--border-slate-300))',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.3rem',
                boxShadow: activeTarget === 'B' ? '0 2px 4px rgba(234, 88, 12, 0.2)' : 'none',
              }}
            >
              <span style={{ width: '9px', height: '9px', backgroundColor: '#ea580c', borderRadius: '50%', display: 'inline-block' }}></span>
              <span>🟠 Lô B ({(polyBVertices || []).length}đ - {calculatedAreaB} m²)</span>
            </button>
          </div>

          {/* KHỐI SO SÁNH DIỆN TÍCH VÀ CHỐNG MẤT ĐẤT CỐ ĐỊNH Ở CỘT TRÁI (KHÔNG CHE MAP) */}
          <div className="p-2.5 rounded-xl border border-slate-200 bg-white flex flex-col gap-1.5 shadow-xs">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-700">Tổng tách: <strong>{currentTotal} m²</strong></span>
              <span className="text-slate-500 text-[11px]">Sổ đỏ: <strong>{totalParentArea} m²</strong></span>
            </div>
            <div className={`p-1.5 rounded-lg text-[11px] font-bold text-center ${
              isAreaGap ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}>
              {isAreaGap ? `⚠️ Lệch ${Math.abs(areaDiff)} m² so với sổ đỏ` : '✓ Khớp ranh 100%'}
            </div>
          </div>

          {/* BỘ CHỌN 2 CHẾ ĐỘ BIÊN TẬP: KÉO NẮN ĐIỂM HOẶC CHẤM TỰ DO */}
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              type="button"
              className="cursor-pointer"
              onClick={() => {
                setSplitShapeOption('DRAG_HANDLES');
                onMutationDataChange({ ...mutationData, splitShapeOption: 'DRAG_HANDLES', isSubmitted: false });
              }}
              style={{
                flex: 1,
                padding: '0.42rem 0.55rem',
                borderRadius: '0.45rem',
                fontSize: '0.71rem',
                fontWeight: splitShapeOption === 'DRAG_HANDLES' ? 800 : 600,
                backgroundColor: splitShapeOption === 'DRAG_HANDLES' ? '#ea580c' : 'rgb(var(--bg-slate-50))',
                color: splitShapeOption === 'DRAG_HANDLES' ? '#ffffff' : 'rgb(var(--text-slate-600))',
                border: splitShapeOption === 'DRAG_HANDLES' ? 'none' : '1px solid rgb(var(--border-slate-300))',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.25rem',
                boxShadow: splitShapeOption === 'DRAG_HANDLES' ? '0 2px 4px rgba(234, 88, 12, 0.2)' : 'none',
              }}
            >
              <Move size={13} /> Kéo nắn mốc ranh
            </button>

            <button
              type="button"
              className="cursor-pointer"
              onClick={() => {
                setSplitShapeOption('CLICK_TO_DRAW');
                onMutationDataChange({ ...mutationData, splitShapeOption: 'CLICK_TO_DRAW', isSubmitted: false });
              }}
              style={{
                flex: 1,
                padding: '0.42rem 0.55rem',
                borderRadius: '0.45rem',
                fontSize: '0.71rem',
                fontWeight: splitShapeOption === 'CLICK_TO_DRAW' ? 800 : 600,
                backgroundColor: splitShapeOption === 'CLICK_TO_DRAW' ? '#ea580c' : 'rgb(var(--bg-slate-50))',
                color: splitShapeOption === 'CLICK_TO_DRAW' ? '#ffffff' : 'rgb(var(--text-slate-600))',
                border: splitShapeOption === 'CLICK_TO_DRAW' ? 'none' : '1px solid rgb(var(--border-slate-300))',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.25rem',
                boxShadow: splitShapeOption === 'CLICK_TO_DRAW' ? '0 2px 4px rgba(234, 88, 12, 0.2)' : 'none',
              }}
            >
              <MousePointer size={13} /> Chấm đỉnh tự do
            </button>
          </div>

          {/* THANH CÔNG CỤ CẮT NHANH PHÂN RANH HÌNH HỌC */}
          <div
            style={{
              display: 'flex',
              gap: '0.3rem',
              flexWrap: 'wrap',
              alignItems: 'center',
              backgroundColor: 'rgb(var(--bg-amber-50))',
              padding: '0.45rem 0.6rem',
              borderRadius: '0.5rem',
              border: '1px solid rgb(var(--border-yellow-200))',
            }}
          >
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'rgb(var(--text-amber-800))', display: 'flex', alignItems: 'center', gap: '0.2rem', width: '100%', marginBottom: '0.1rem' }}>
              <Scissors size={13} color="#b45309" />
              Công cụ cắt ranh nhanh tự động:
            </span>
            <button
              type="button"
              onClick={() => handleSplitHorizontal && handleSplitHorizontal(0.6)}
              className="btn btn-secondary btn-sm cursor-pointer"
              style={{ fontSize: '0.66rem', padding: '0.2rem 0.45rem', backgroundColor: 'rgb(var(--bg-white))', color: 'rgb(var(--text-amber-700))', fontWeight: 700, border: '1px solid #f59e0b', cursor: 'pointer' }}
              title="Chia mặt tiền chiếm 60% diện tích, phía sau chiếm 40%"
            >
              ✂️ Ngang 60/40
            </button>
            <button
              type="button"
              onClick={() => handleSplitHorizontal && handleSplitHorizontal(0.5)}
              className="btn btn-secondary btn-sm cursor-pointer"
              style={{ fontSize: '0.66rem', padding: '0.2rem 0.45rem', backgroundColor: 'rgb(var(--bg-white))', color: 'rgb(var(--text-amber-700))', fontWeight: 700, border: '1px solid #f59e0b', cursor: 'pointer' }}
              title="Chia đôi ngang đều 50/50"
            >
              ✂️ Ngang 50/50
            </button>
            <button
              type="button"
              onClick={() => handleSplitVertical && handleSplitVertical(0.5)}
              className="btn btn-secondary btn-sm cursor-pointer"
              style={{ fontSize: '0.66rem', padding: '0.2rem 0.45rem', backgroundColor: 'rgb(var(--bg-white))', color: 'rgb(var(--text-amber-700))', fontWeight: 700, border: '1px solid #f59e0b', cursor: 'pointer' }}
              title="Chia dọc 50/50 theo chiều sâu (Trái / Phải)"
            >
              ✂️ Dọc 50/50
            </button>
            <button
              type="button"
              onClick={handleResetDefault}
              className="btn btn-secondary btn-sm cursor-pointer"
              style={{ fontSize: '0.66rem', padding: '0.2rem 0.45rem', backgroundColor: 'rgb(var(--bg-white))', color: 'rgb(var(--text-slate-600))', fontWeight: 600, border: '1px solid rgb(var(--border-slate-300))', cursor: 'pointer' }}
            >
              <RefreshCw size={10} style={{ marginRight: '0.2rem' }} /> Đặt lại
            </button>
          </div>

          {/* BANNER TƯỜNG MINH CƠ CHẾ MAX ZONE + 1 */}
          <div
            style={{
              backgroundColor: 'rgb(var(--bg-orange-50))',
              border: '1.5px solid #ea580c',
              borderRadius: '0.65rem',
              padding: '0.65rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
              boxShadow: '0 1px 4px rgba(234, 88, 12, 0.08)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.3rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'rgb(var(--text-orange-800))', fontWeight: 800, fontSize: '0.78rem' }}>
                <Tag size={15} color="#ea580c" />
                <span>MÃ CẤP MỚI CHO LÔ B:</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span
                  style={{
                    backgroundColor: '#ea580c',
                    color: '#ffffff',
                    fontWeight: 900,
                    fontSize: '0.85rem',
                    padding: '0.2rem 0.65rem',
                    borderRadius: '0.35rem',
                    letterSpacing: '0.5px',
                  }}
                >
                  {codeB}
                </span>
                <span
                  style={{
                    backgroundColor: 'rgb(var(--bg-orange-100))',
                    color: 'rgb(var(--text-orange-700))',
                    fontWeight: 800,
                    fontSize: '0.65rem',
                    padding: '0.2rem 0.45rem',
                    borderRadius: '0.3rem',
                    border: '1px solid rgb(var(--border-orange-200))',
                  }}
                >
                  {mutationData.residualKind === 'NEW_BUILDING' ? 'MAX ZONE + 1' : 'ĐẤT DÔI DƯ'}
                </span>
              </div>
            </div>

            <div style={{ fontSize: '0.71rem', color: 'rgb(var(--text-orange-900))', lineHeight: 1.4, backgroundColor: 'rgb(var(--bg-white) / 0.85)', padding: '0.35rem 0.55rem', borderRadius: '0.35rem', border: '1px dashed rgb(var(--border-orange-300))' }}>
              {mutationData.residualKind === 'NEW_BUILDING' ? (
                <>
                  📌 Mã lớn nhất hiện có: <strong>[{maxZoneInfo?.currentMaxCode || 'Đang quét...'}]</strong>. Thửa mới (Lô B) được cấp số hiệu tiếp nối <strong>[{maxZoneInfo?.nextCode || dynamicCodes[0] || '...'}]</strong>.
                </>
              ) : (
                <>
                  📌 Giữ nguyên ranh đất sổ đỏ ({calculatedAreaA + calculatedAreaB} m²). Phần đất dôi dư gán mã <strong>[{parcelData.projectParcelCode}-DU]</strong> để làm căn cứ bồi thường mà KHÔNG tạo thửa mới.
                </>
              )}
            </div>
          </div>

          {/* PHÂN LOẠI CÔNG NĂNG CHO THỬA CON (LÔ B) - 2 NHÁNH LỰA CHỌN */}
          <div
            style={{
              backgroundColor: 'rgb(var(--bg-white))',
              border: '1.5px solid rgb(var(--border-orange-200))',
              borderRadius: '0.65rem',
              padding: '0.65rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.45rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'rgb(var(--text-orange-800))', margin: 0, display: 'flex', alignItems: 'center' }}>
                <Tag size={14} color="#ea580c" style={{ marginRight: '0.3rem' }} />
                Bản chất Ô dôi dư (Lô B - {calculatedAreaB} m²):
                <HelpBadge
                  type="alert"
                  title="Phân loại 2 nhánh Ô dôi dư"
                  content="Nhánh 1: Nếu là sân vườn, đất trống, lối đi, hệ thống chỉ lưu ranh đất đền bù và KHÔNG tạo lô khảo sát mới. Nhánh 2: Nếu là một căn nhà mới độc lập, hệ thống sẽ cấp mã mới (Max Zone + 1) và tạo lô mới để KSV tiếp tục khảo sát."
                />
              </label>
            </div>

            {/* BỘ CHỌN 2 NHÁNH TOGGLE BUTTONS */}
            <div style={{ display: 'flex', gap: '0.35rem', flexDirection: 'column' }}>
              <button
                type="button"
                className="cursor-pointer"
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
                  width: '100%',
                  padding: '0.45rem 0.6rem',
                  borderRadius: '0.45rem',
                  fontSize: '0.71rem',
                  fontWeight: (mutationData.residualKind !== 'NEW_BUILDING') ? 800 : 600,
                  backgroundColor: (mutationData.residualKind !== 'NEW_BUILDING') ? '#059669' : 'rgb(var(--bg-slate-50))',
                  color: (mutationData.residualKind !== 'NEW_BUILDING') ? '#ffffff' : 'rgb(var(--text-slate-600))',
                  border: (mutationData.residualKind !== 'NEW_BUILDING') ? 'none' : '1px solid rgb(var(--border-slate-300))',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: '0.35rem',
                  boxShadow: (mutationData.residualKind !== 'NEW_BUILDING') ? '0 2px 4px rgba(5, 150, 105, 0.25)' : 'none',
                }}
              >
                <Trees size={14} /> 🌳 1. Khoanh Ranh Nhà (Đất dư sân vườn - Không tách lô)
              </button>

              <button
                type="button"
                className="cursor-pointer"
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
                  width: '100%',
                  padding: '0.45rem 0.6rem',
                  borderRadius: '0.45rem',
                  fontSize: '0.71rem',
                  fontWeight: (mutationData.residualKind === 'NEW_BUILDING') ? 800 : 600,
                  backgroundColor: (mutationData.residualKind === 'NEW_BUILDING') ? '#ea580c' : 'rgb(var(--bg-slate-50))',
                  color: (mutationData.residualKind === 'NEW_BUILDING') ? '#ffffff' : 'rgb(var(--text-slate-600))',
                  border: (mutationData.residualKind === 'NEW_BUILDING') ? 'none' : '1px solid rgb(var(--border-slate-300))',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: '0.35rem',
                  boxShadow: (mutationData.residualKind === 'NEW_BUILDING') ? '0 2px 4px rgba(234, 88, 12, 0.25)' : 'none',
                }}
              >
                <Home size={14} /> 🏠 2. Tách Thửa Nhà Mới (Cấp mã {maxZoneInfo?.nextCode || dynamicCodes[0] || 'Max+1'})
              </button>
            </div>

            {/* CHI TIẾT CÔNG NĂNG & THÔNG TIN LÔ B */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.1rem' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgb(var(--text-slate-600))', margin: 0 }}>
                {mutationData.residualKind === 'NEW_BUILDING' ? 'Loại hình công trình Lô B:' : 'Hiện trạng phần đất dôi dư:'}
              </label>
              <select
                className="form-control"
                style={{ fontSize: '0.73rem', fontWeight: 600, backgroundColor: 'rgb(var(--bg-slate-50))', border: '1px solid rgb(var(--border-slate-300))', color: 'rgb(var(--text-slate-800))' }}
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
                <div>
                  <input
                    type="text"
                    className="form-control"
                    style={{ fontSize: '0.73rem', backgroundColor: 'rgb(var(--bg-white))', border: '1px solid rgb(var(--border-orange-300))' }}
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginTop: '0.1rem', backgroundColor: 'rgb(var(--bg-slate-50))', padding: '0.4rem', borderRadius: '0.4rem', border: '1px dashed rgb(var(--border-slate-300))' }}>
                  <div>
                    <label style={{ fontSize: '0.66rem', fontWeight: 700, color: 'rgb(var(--text-slate-600))', display: 'block', marginBottom: '0.1rem' }}>
                      Số nhà Lô B:
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      style={{ fontSize: '0.71rem' }}
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
                    <label style={{ fontSize: '0.66rem', fontWeight: 700, color: 'rgb(var(--text-slate-600))', display: 'block', marginBottom: '0.1rem' }}>
                      Chủ hộ Lô B:
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      style={{ fontSize: '0.71rem' }}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'rgb(var(--text-slate-700))', margin: 0, display: 'flex', alignItems: 'center' }}>
              Lý do chia tách thửa đất:
              <span style={{ color: 'rgb(var(--text-red-600))', marginLeft: '3px', fontWeight: 800 }}>*</span>
              <HelpBadge
                title="Lý do tách thửa"
                content="Bắt buộc chọn lý do trong danh sách hoặc chọn 'Khác' để nhập chi tiết lý do phân chia thực tế tại hiện trường."
              />
            </label>

            <select
              id="input-splitReason"
              className="form-control"
              style={{ fontSize: '0.73rem', fontWeight: 600, backgroundColor: 'rgb(var(--bg-white))', border: '1.5px solid rgb(var(--border-slate-300))' }}
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
              <option value="">-- Chọn lý do chia tách thực tế --</option>
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
              <div>
                <input
                  type="text"
                  className="form-control"
                  style={{ fontSize: '0.73rem', border: '1px solid rgb(var(--border-orange-300))' }}
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
                backgroundColor: 'rgb(var(--bg-emerald-50))',
                border: '1.5px solid #10b981',
                borderRadius: '0.45rem',
                padding: '0.45rem 0.65rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                color: 'rgb(var(--text-emerald-800))',
                fontSize: '0.71rem',
                fontWeight: 700,
              }}
            >
              <CheckCircle2 size={15} color="#059669" />
              <span>
                ✓ Đã lưu tạm cấu hình tách thửa vào hồ sơ thửa gốc {parcelData.projectParcelCode} ({mutationData.submittedAt}).
              </span>
            </div>
          )}

          {/* NÚT LƯU ĐỀ XUẤT TÁCH THỬA (CÓ HIỆU ỨNG PHẢN HỒI) */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto', paddingTop: '0.35rem' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm cursor-pointer"
              onClick={handleSaveMutationProposal}
              disabled={isSubmittingMutation}
              style={{
                backgroundColor: (mutationData.activeProposalType === 'SPLIT' && mutationData.isSubmitted) ? '#16a34a' : '#ea580c',
                borderColor: (mutationData.activeProposalType === 'SPLIT' && mutationData.isSubmitted) ? '#16a34a' : '#ea580c',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.74rem',
                fontWeight: 700,
                padding: '0.45rem 0.95rem',
                cursor: 'pointer',
                width: '100%',
                justifyContent: 'center',
                boxShadow: (mutationData.activeProposalType === 'SPLIT' && mutationData.isSubmitted) ? '0 0 0 3px rgba(22, 163, 74, 0.25)' : 'none',
              }}
            >
              {(mutationData.activeProposalType === 'SPLIT' && mutationData.isSubmitted) ? <CheckCircle2 size={15} /> : <CheckCircle size={14} />}
              <span>
                {isSubmittingMutation
                  ? 'Đang lưu...'
                  : (mutationData.activeProposalType === 'SPLIT' && mutationData.isSubmitted)
                  ? `ĐÃ GHI NHẬN ĐỀ XUẤT TÁCH THỬA (${mutationData.submittedAt})`
                  : 'Lưu Đề Xuất Tách Thửa'}
              </span>
            </button>
          </div>
        </div>

        {/* CỘT PHẢI: KHUNG BẢN ĐỒ TOÀN CẢNH SIÊU RỘNG VỚI CÁC LỚP RANH GIỚI & ĐỐI CHIẾU LÂN CẬN */}
        <div className="flex-1 flex flex-col min-w-0 min-h-[580px] lg:min-h-[680px] relative border-2 border-orange-300 rounded-xl overflow-hidden bg-slate-50 shadow-sm">
          {/* TOOLBAR NÚT CÔNG CỤ TRÊN BẢN ĐỒ */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.35rem',
              backgroundColor: activeTarget === 'A' ? 'rgb(var(--bg-amber-50))' : 'rgb(var(--bg-orange-50))',
              padding: '0.45rem 0.65rem',
              borderBottom: `1.5px solid ${activeTarget === 'A' ? '#f59e0b' : '#ea580c'}`,
              zIndex: 810,
            }}
          >
            <div style={{ fontSize: '0.73rem', color: activeTarget === 'A' ? 'rgb(var(--text-amber-800))' : 'rgb(var(--text-orange-800))', fontWeight: 800 }}>
              {splitShapeOption === 'DRAG_HANDLES'
                ? `Kéo mốc ${activeTarget === 'A' ? 'vàng (Lô A)' : 'cam (Lô B)'} để vi chỉnh:`
                : `Nhấp chuột trên bản đồ để chấm đỉnh cho ${activeTarget === 'A' ? 'Lô A' : 'Lô B'} (${currentVertices.length} điểm):`}
            </div>

            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
              {/* Nút thao tác mốc theo chế độ */}
              {splitShapeOption === 'DRAG_HANDLES' ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleAddMidpoint(activeTarget)}
                    className="btn btn-secondary btn-sm cursor-pointer"
                    style={{ fontSize: '0.675rem', padding: '0.2rem 0.45rem', display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer' }}
                  >
                    <Plus size={11} /> Thêm mốc
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemovePoint(activeTarget)}
                    disabled={currentVertices.length <= 3}
                    className="btn btn-secondary btn-sm cursor-pointer"
                    style={{ fontSize: '0.675rem', padding: '0.2rem 0.45rem', display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer' }}
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
                    className="btn btn-secondary btn-sm cursor-pointer"
                    style={{ fontSize: '0.675rem', padding: '0.2rem 0.45rem', display: 'flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer' }}
                  >
                    <Undo size={11} /> Hoàn tác
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResetTarget && handleResetTarget(activeTarget)}
                    className="btn btn-secondary btn-sm cursor-pointer"
                    style={{ fontSize: '0.675rem', padding: '0.2rem 0.45rem', display: 'flex', alignItems: 'center', gap: '0.2rem', color: 'rgb(var(--text-red-600))', cursor: 'pointer' }}
                  >
                    <Trash2 size={11} /> Xóa vẽ lại
                  </button>
                </>
              )}

              {/* Toggle Hiện/Ẩn thửa lân cận */}
              <button
                type="button"
                className="cursor-pointer"
                onClick={() => setShowNeighbors((prev) => !prev)}
                style={{
                  padding: '0.2rem 0.5rem',
                  borderRadius: '0.35rem',
                  fontSize: '0.675rem',
                  fontWeight: 700,
                  backgroundColor: showNeighbors ? 'rgb(var(--text-slate-600))' : 'rgb(var(--bg-white))',
                  color: showNeighbors ? '#ffffff' : 'rgb(var(--text-slate-600))',
                  border: '1px solid rgb(var(--border-slate-300))',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
                title={showNeighbors ? 'Ẩn các thửa đất xung quanh' : 'Hiển thị ranh đất các thửa lân cận'}
              >
                {showNeighbors ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                <span>{showNeighbors ? `Thửa lân cận (${validNeighbors.length})` : 'Ẩn lân cận'}</span>
              </button>

              {/* Nút đổi lớp nền Vệ tinh / OSM */}
              <button
                type="button"
                className="cursor-pointer"
                onClick={() => setTileMode((prev) => (prev === 'osm' ? 'satellite' : 'osm'))}
                style={{
                  padding: '0.2rem 0.5rem',
                  borderRadius: '0.35rem',
                  fontSize: '0.675rem',
                  fontWeight: 700,
                  backgroundColor: tileMode === 'satellite' ? '#ea580c' : 'rgb(var(--bg-white))',
                  color: tileMode === 'satellite' ? '#ffffff' : 'rgb(var(--text-slate-600))',
                  border: '1px solid rgb(var(--border-slate-300))',
                  cursor: 'pointer',
                }}
              >
                {tileMode === 'osm' ? '🛰️ Vệ tinh' : '🗺️ Bản đồ'}
              </button>
            </div>
          </div>

          {/* KHUNG BẢN ĐỒ LEAFLET CONTAINER CHIẾM TOÀN BỘ DIỆN TÍCH CÒN LẠI */}
          <div className="flex-1 w-full h-full relative" style={{ minHeight: '520px' }}>
            <MapContainer
              center={activeCentroid}
              zoom={18}
              maxZoom={24}
              zoomControl={false}
              style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
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
                  maxZoom={24}
                />
              ) : (
                <TileLayer
                  attribution="Tiles &copy; Esri &mdash; Esri World Street Map"
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
                  maxNativeZoom={19}
                  maxZoom={24}
                />
              )}

              {/* 0. THỬA ĐẤT LÂN CẬN XUNG QUANH (HIỂN THỊ RANH NÉT ĐỨT, TẮT HOÀN TOÀN NHÃN PERMANENT) */}
              {showNeighbors && validNeighbors.map((nb) => {
                let pts = nb.coordinates;
                if (pts.length > 0 && Array.isArray(pts[0])) {
                  if (pts[0][0] < 8 || pts[0][0] > 24) {
                    pts = pts.map(([lng, lat]) => [lat, lng]);
                  }
                }
                return (
                  <Polygon
                    key={`neighbor-${nb.id || nb.projectParcelCode}`}
                    positions={pts}
                    pathOptions={{
                      color: '#64748b',
                      weight: 1.5,
                      dashArray: '5, 5',
                      fillColor: '#94a3b8',
                      fillOpacity: 0.12,
                    }}
                  >
                    <Tooltip direction="center" opacity={0.92}>
                      <div style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, color: 'rgb(var(--text-slate-800))', backgroundColor: 'rgba(255,255,255,0.92)', padding: '2px 4px', borderRadius: '3px', border: '1px solid rgb(var(--border-slate-300))' }}>
                        {nb.projectParcelCode || nb.houseNumber}
                      </div>
                    </Tooltip>
                  </Polygon>
                );
              })}

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
                  <div style={{ fontSize: '0.725rem', color: 'rgb(var(--text-slate-800))', fontWeight: 600 }}>
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
                    <div style={{ textAlign: 'center', fontWeight: 800, color: 'rgb(var(--text-orange-900))', fontSize: '0.725rem' }}>
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
                    <div style={{ textAlign: 'center', fontWeight: 800, color: 'rgb(var(--text-amber-900))', fontSize: '0.725rem' }}>
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
          </div>
        </div>
      </div>
    </div>
  );
};
