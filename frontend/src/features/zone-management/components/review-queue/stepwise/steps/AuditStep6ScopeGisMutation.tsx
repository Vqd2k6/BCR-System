import React, { useState, useMemo } from 'react';
import {
  MapPin,
  ShieldCheck,
  AlertTriangle,
  Building,
  Home,
  CheckCircle2,
  Split,
  Merge,
  ArrowRightLeft,
  Navigation,
  FileText,
  Image as ImageIcon,
  Edit3,
  Ruler,
  Layers,
  Move,
} from 'lucide-react';
import { UnifiedGisMutationModal } from '../../../../../../components/gis/cadastral-editor/UnifiedGisMutationModal';
import { AdminReassignParcelModal } from '../../AdminReassignParcelModal';
import { CadastralBoundaryReshapeModal } from '../../../../../../components/gis/cadastral-editor/components/CadastralBoundaryReshapeModal';
import { GisParcel } from '../../../../../../components/gis/shared/types';
import { AuditCadastralMutationVisualMap } from '../components/AuditCadastralMutationVisualMap';

interface Props {
  isEditMode: boolean;
  formState: Record<string, any>;
  data?: any;
  reportId?: string;
  handleNestedFieldChange: (parentKey: string, childKey: string, label: string, val: any) => void;
  handleFieldChange?: (fieldKey: string, label: string, val: any) => void;
  onOpenPhotoZoom?: (url: string, title?: string, photoCode?: string) => void;
  onRefresh?: () => void;
}

const ACCESS_LIMIT_PRESETS = [
  'Chỉ đồng ý cho xem tầng trệt (Không cho lên lầu)',
  'Chủ nhà đi vắng / Khóa cửa',
  'Chủ nhà không cho phép tiếp cận các phòng riêng',
  'Khu vực nguy hiểm / Kết cấu mất an toàn',
  'Phòng kho / Phòng thờ khóa cửa',
  'Kẹt cửa / Mất chìa khóa',
  'Khu vực chứa tài sản nhạy cảm',
  'Khác (Nhập chi tiết...)',
];

const RESTRICTED_AREAS_PRESETS = [
  'Các tầng lầu trên cao',
  'Mái / Sân thượng',
  'Tầng hầm',
  'Phòng ngủ / Khu vực riêng tư',
  'Phòng kho khóa cửa',
  'Gian bếp phía sau',
];

export const AuditStep6ScopeGisMutation: React.FC<Props> = ({
  isEditMode,
  formState,
  data,
  reportId,
  handleNestedFieldChange,
  handleFieldChange,
  onOpenPhotoZoom,
  onRefresh,
}) => {
  const [isMutationModalOpen, setIsMutationModalOpen] = useState(false);
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [isReshapeModalOpen, setIsReshapeModalOpen] = useState(false);
  const [successToast, setSuccessToast] = useState('');

  const access = formState.accessLimitation || {};
  const mutation = formState.gisMutationConfirmed || {};
  const floors = formState.floors || [];
  const coords = formState.gpsLocation || formState.coordinates || {};

  // Kích thước hình học thửa đất
  const frontageWidth = formState.frontageWidth ?? data?.buildingSpecs?.frontageWidth ?? (data?.activeParcel as any)?.frontage_width;
  const lotDepth = formState.lotDepth ?? data?.buildingSpecs?.lotDepth ?? (data?.activeParcel as any)?.lot_depth;
  const landAreaM2 = formState.landAreaM2 ?? formState.landArea ?? data?.buildingSpecs?.landAreaM2 ?? (data?.activeParcel as any)?.land_area_m2;
  const mutationDetails = mutation.details || {};
  const splitChildren = Array.isArray(mutationDetails.splitChildren) ? mutationDetails.splitChildren : [];
  const selectedMergeCodes = Array.isArray(mutationDetails.selectedMergeCodes) ? mutationDetails.selectedMergeCodes : [];

  // Trích xuất tọa độ Polygon thửa đất (từ formState, surveyJson hoặc PostGIS GeoJSON)
  const parcelCoords = useMemo<[number, number][]>(() => {
    if (Array.isArray(formState.parcelCoordinates) && formState.parcelCoordinates.length >= 3) {
      return formState.parcelCoordinates;
    }
    if (Array.isArray(data?.coordinates) && data.coordinates.length >= 3) {
      return data.coordinates;
    }
    if (Array.isArray(data?.parcelCoordinates) && data.parcelCoordinates.length >= 3) {
      return data.parcelCoordinates;
    }
    const rawGeojson = data?.cadastralGeojson || data?.cadastral_geojson;
    if (rawGeojson) {
      try {
        const parsed = typeof rawGeojson === 'string' ? JSON.parse(rawGeojson) : rawGeojson;
        if (parsed.type === 'Polygon' && Array.isArray(parsed.coordinates?.[0])) {
          return parsed.coordinates[0].map(([lng, lat]: [number, number]) => [lat, lng]);
        }
      } catch (e) {
        console.warn('Failed to parse cadastralGeojson in AuditStep6:', e);
      }
    }
    return [];
  }, [formState.parcelCoordinates, data?.coordinates, data?.parcelCoordinates, data?.cadastralGeojson, data?.cadastral_geojson]);

  const reshapeParcel = useMemo<GisParcel | null>(() => {
    const pId = data?.parcelId || formState.parcelId || (data?.activeParcel as any)?.id;
    if (!pId) return null;
    return {
      id: pId,
      projectParcelCode: data?.projectParcelCode || formState.projectParcelCode || '',
      officialCadastralCode: data?.officialCadastralCode || formState.officialCadastralCode || '',
      houseNumber: data?.houseNumber || formState.houseNumber || '',
      street: data?.street || formState.street || '',
      ownerName: data?.ownerName || formState.ownerName || '',
      surveyStatus: data?.surveyStatus || formState.surveyStatus || 'SUBMITTED',
      coordinates: parcelCoords,
      landArea: Number(landAreaM2 || 0),
      constructionArea: Number(data?.buildingSpecs?.constructionAreaM2 || landAreaM2 || 0),
      floorCount: Number(data?.buildingSpecs?.floorCount || 1),
      buildingType: data?.buildingSpecs?.buildingType || 'STANDALONE',
      zoneId: data?.zoneId || formState.zoneId || 'ZONE_01',
    };
  }, [data, formState, parcelCoords, landAreaM2]);

  // Tính khoảng cách tim hầm Metro
  const metroDistance = formState.metroDistanceM ?? formState.distanceToMetroCenterlineM ?? 15.2;
  const manualDistance = formState.manualMetroDistanceM;

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(''), 4000);
    if (onRefresh) onRefresh();
  };

  const getRiskZoneBadge = (dist: number) => {
    if (dist <= 10) {
      return { label: 'Zone 1 (Vùng ảnh hưởng đặc biệt ≤10m)', color: 'bg-red-100 text-red-800 border-red-300' };
    } else if (dist <= 30) {
      return { label: 'Zone 2 (Vùng ảnh hưởng trực tiếp ≤30m)', color: 'bg-amber-100 text-amber-800 border-amber-300' };
    } else if (dist <= 50) {
      return { label: 'Zone 3 (Vùng lân cận cự ly ≤50m)', color: 'bg-blue-100 text-blue-800 border-blue-300' };
    }
    return { label: 'Ngoài phạm vi ảnh hưởng (>50m)', color: 'bg-slate-100 text-slate-700 border-slate-300' };
  };

  const currentDist = manualDistance !== undefined && manualDistance !== '' ? Number(manualDistance) : Number(metroDistance);
  const riskBadge = getRiskZoneBadge(currentDist);

  return (
    <section id="step-6" className="scroll-mt-6 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Toast thông báo */}
      {successToast && (
        <div className="p-3 bg-emerald-600 text-white text-xs font-bold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>{successToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessToast('')}
            className="text-emerald-200 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 rounded-lg bg-sky-600 text-white font-mono font-black text-xs">
            Bước 06
          </span>
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-800">
              Phạm Vi Khảo Sát, Hạn Chế Tiếp Cận & Biến Động Thửa Đất GIS
            </h3>
            <p className="text-xs text-slate-500">
              Đối soát không gian khảo sát, toạ độ thực địa và công cụ biến động ranh thửa cho Zone Admin
            </p>
          </div>
        </div>

        {/* Nút thao tác của Zone Admin */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsReassignModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            title="Điều chuyển hồ sơ sang thửa khác hoặc hoán đổi 2 nhà kề nhau bị tích chéo"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-amber-600" />
            <span>Hoán Đổi Ranh GIS</span>
          </button>

          <button
            type="button"
            onClick={() => setIsMutationModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            title="Thực thi tách thửa hoặc gộp thửa trực tiếp trên GIS"
          >
            <Split className="w-3.5 h-3.5" />
            <span>Tách / Gộp Thửa GIS</span>
          </button>

          <button
            type="button"
            onClick={() => setIsReshapeModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            title="Kéo thả mốc đỉnh để nắn chỉnh đa giác ranh thửa đất khớp ảnh vệ tinh"
          >
            <Move className="w-3.5 h-3.5 text-indigo-600" />
            <span>Nắn Chỉnh Ranh Đất</span>
          </button>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* 6.1. Không gian đã khảo sát */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                6.1. Không Gian Đã Khảo Sát ({floors.length} tầng)
              </span>
            </div>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
              Khảo sát đầy đủ các tầng ghi nhận
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {floors.map((fl: any, idx: number) => (
              <div
                key={fl.id || idx}
                className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <Building className="w-3.5 h-3.5 text-slate-500" />
                  <span>{fl.floorName || `Tầng ${idx + 1}`}</span>
                </div>
                <span className="text-[10px] text-slate-500 font-semibold">
                  {fl.zones?.length || 0} vùng Z
                </span>
              </div>
            ))}
            {floors.length === 0 && (
              <div className="col-span-full text-xs text-slate-400 italic p-2 bg-white rounded border border-dashed border-slate-200">
                Chưa ghi nhận danh sách tầng phân rã.
              </div>
            )}
          </div>
        </div>

        {/* 6.2. Hạn chế tiếp cận thực tế */}
        <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200 space-y-3.5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-black uppercase tracking-wider text-amber-900">
              6.2. Hạn Chế Tiếp Cận Tại Hiện Trường (Access Limitations)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Mức độ tiếp cận */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 block">
                Mức độ tiếp cận công trình:
              </label>
              {isEditMode ? (
                <select
                  value={access.type || 'FULL_100'}
                  onChange={(e) =>
                    handleNestedFieldChange('accessLimitation', 'type', 'Mức độ tiếp cận', e.target.value)
                  }
                  className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value="FULL_100">1. Không có hạn chế (Tiếp cận 100%)</option>
                  <option value="LIMITED">2. Có hạn chế tiếp cận một phần</option>
                  <option value="EXTERNAL_ONLY">3. Chỉ quan sát ngoại quan bên ngoài</option>
                </select>
              ) : (
                <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold">
                  {access.type === 'FULL_100' ? (
                    <span className="text-emerald-700 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Tiếp cận đầy đủ 100% các không gian
                    </span>
                  ) : access.type === 'EXTERNAL_ONLY' ? (
                    <span className="text-red-700 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> Chỉ quan sát ngoại quan bên ngoài ranh
                    </span>
                  ) : (
                    <span className="text-amber-800 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> Có hạn chế tiếp cận một phần
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Nguyên nhân chính */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 block">
                Nguyên nhân chính hạn chế:
              </label>
              {isEditMode ? (
                <div className="space-y-1">
                  <select
                    value={ACCESS_LIMIT_PRESETS.includes(access.mainReason) ? access.mainReason : 'Khác (Nhập chi tiết...)'}
                    onChange={(e) => {
                      if (e.target.value !== 'Khác (Nhập chi tiết...)') {
                        handleNestedFieldChange('accessLimitation', 'mainReason', 'Nguyên nhân hạn chế', e.target.value);
                      }
                    }}
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                  >
                    {ACCESS_LIMIT_PRESETS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={access.mainReason || ''}
                    onChange={(e) =>
                      handleNestedFieldChange('accessLimitation', 'mainReason', 'Nguyên nhân hạn chế', e.target.value)
                    }
                    placeholder="Nhập chi tiết nguyên nhân nếu chọn khác..."
                    className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800">
                  {access.mainReason || 'Không có ghi nhận nguyên nhân'}
                </div>
              )}
            </div>
          </div>

          {/* Chi tiết khu vực hạn chế */}
          {access.type !== 'FULL_100' && (
            <div className="space-y-2 pt-2 border-t border-amber-200/60">
              <span className="text-[11px] font-bold text-amber-950 block">
                Khu vực cụ thể không tiếp cận được:
              </span>
              {isEditMode ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {RESTRICTED_AREAS_PRESETS.map((area) => {
                    const currentAreas: string[] = Array.isArray(access.restrictedAreas) ? access.restrictedAreas : [];
                    const isSelected = currentAreas.includes(area);
                    return (
                      <label
                        key={area}
                        className={`flex items-center gap-2 p-1.5 rounded-lg border text-xs cursor-pointer select-none ${
                          isSelected ? 'bg-amber-100 border-amber-400 text-amber-950 font-bold' : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const updated = e.target.checked
                              ? [...currentAreas, area]
                              : currentAreas.filter((a) => a !== area);
                            handleNestedFieldChange('accessLimitation', 'restrictedAreas', 'Khu vực hạn chế', updated);
                          }}
                          className="rounded text-amber-600"
                        />
                        <span>{area}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(access.restrictedAreas || []).map((area: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-xs font-bold text-amber-900 shadow-xs"
                    >
                      • {area}
                    </span>
                  ))}
                  {(!access.restrictedAreas || access.restrictedAreas.length === 0) && (
                    <span className="text-xs text-amber-700 italic">
                      Chưa liệt kê cụ thể các phòng bị hạn chế.
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Ghi chú diễn giải */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-700 block">
              Ghi chú hiện trường chi tiết của KSV:
            </span>
            {isEditMode ? (
              <textarea
                rows={2}
                value={access.notes || ''}
                onChange={(e) =>
                  handleNestedFieldChange('accessLimitation', 'notes', 'Ghi chú hạn chế', e.target.value)
                }
                placeholder="Nhập ghi chú chi tiết làm cơ sở pháp lý..."
                className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800"
              />
            ) : (
              <p className="text-xs text-slate-700 p-2.5 bg-white rounded-xl border border-slate-200 italic">
                {access.notes || 'Không có ghi chú thêm.'}
              </p>
            )}
          </div>
        </div>

        {/* 6.3. Kích thước hình học & diện tích thửa đất */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Ruler className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                6.3. Kích Thước Hình Học & Diện Tích Thửa Đất Địa Chính
              </span>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              Đối chiếu hồ sơ trắc địa
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Chiều Rộng Mặt Tiền (m)
              </span>
              {isEditMode ? (
                <input
                  type="number"
                  step="0.01"
                  value={formState.frontageWidth ?? ''}
                  onChange={(e) => handleFieldChange && handleFieldChange('frontageWidth', 'Mặt tiền thửa', e.target.value ? Number(e.target.value) : '')}
                  placeholder="VD: 4.5"
                  className="w-full p-1.5 bg-amber-50/40 border border-slate-300 rounded font-mono font-bold"
                />
              ) : (
                <div className="font-mono font-black text-sm text-slate-800">
                  {frontageWidth ? `${frontageWidth} m` : '---'}
                </div>
              )}
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Chiều Sâu Thửa Đất (m)
              </span>
              {isEditMode ? (
                <input
                  type="number"
                  step="0.01"
                  value={formState.lotDepth ?? ''}
                  onChange={(e) => handleFieldChange && handleFieldChange('lotDepth', 'Chiều sâu thửa', e.target.value ? Number(e.target.value) : '')}
                  placeholder="VD: 18.2"
                  className="w-full p-1.5 bg-amber-50/40 border border-slate-300 rounded font-mono font-bold"
                />
              ) : (
                <div className="font-mono font-black text-sm text-slate-800">
                  {lotDepth ? `${lotDepth} m` : '---'}
                </div>
              )}
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Diện Tích Khuôn Viên Đất (m²)
              </span>
              {isEditMode ? (
                <input
                  type="number"
                  step="0.01"
                  value={formState.landAreaM2 ?? ''}
                  onChange={(e) => handleFieldChange && handleFieldChange('landAreaM2', 'Diện tích đất', e.target.value ? Number(e.target.value) : '')}
                  placeholder="VD: 81.9"
                  className="w-full p-1.5 bg-amber-50/40 border border-slate-300 rounded font-mono font-bold text-emerald-800"
                />
              ) : (
                <div className="font-mono font-black text-sm text-emerald-700">
                  {landAreaM2 ? `${landAreaM2} m²` : '---'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 6.4. Tọa độ GPS & Cự ly tim hầm Metro */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-sky-600" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                6.4. Tọa Độ GPS Thực Địa & Cự Ly Tim Hầm Metro 2
              </span>
            </div>
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${riskBadge.color}`}>
              {riskBadge.label}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Tọa độ GPS */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">
                Tọa Độ GPS (Vĩ Độ / Kinh Độ)
              </span>
              <span className="font-mono font-black text-xs text-slate-800 block">
                {coords.lat ? `${Number(coords.lat).toFixed(6)}, ${Number(coords.lng).toFixed(6)}` : '10.792410, 106.711520'}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold block">
                Độ chính xác: ±{coords.accuracy || 3.5}m
              </span>
            </div>

            {/* Khoảng cách tính toán tự động */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">
                Khoảng Cách Tim Tuyến Tự Động (GIS)
              </span>
              <span className="font-mono font-black text-xs text-sky-700 block">
                {metroDistance} mét
              </span>
              <span className="text-[10px] text-slate-400 font-semibold block">
                Từ tim hầm Metro Bến Thành - Tham Lương
              </span>
            </div>

            {/* Khoảng cách hiệu chỉnh thủ công của Zone Admin */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">
                  Khoảng Cách Thẩm Định (m)
                </span>
                {isEditMode && <span className="text-[9px] font-bold text-amber-600">Sửa thủ công</span>}
              </div>
              {isEditMode ? (
                <input
                  type="number"
                  step="0.1"
                  value={manualDistance !== undefined ? manualDistance : metroDistance}
                  onChange={(e) =>
                    handleFieldChange && handleFieldChange('manualMetroDistanceM', 'Cự ly tim hầm Metro', e.target.value)
                  }
                  className="w-full p-1 bg-amber-50 border border-amber-300 rounded font-mono font-black text-xs text-slate-900"
                />
              ) : (
                <span className="font-mono font-black text-xs text-slate-900 block">
                  {manualDistance !== undefined && manualDistance !== '' ? `${manualDistance} mét (Đã hiệu chỉnh)` : `${metroDistance} mét`}
                </span>
              )}
              <span className="text-[10px] text-slate-400 font-semibold block">
                Dùng khi GPS bị trôi / trạm đo thực địa
              </span>
            </div>
          </div>
        </div>

        {/* 6.5. Biến động thửa đất GIS */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                6.5. Tình Trạng Biến Động Ranh Thửa Thực Địa & Bản Đồ Đa Giác GIS
              </span>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
              {mutation.type === 'SPLIT'
                ? 'Đã Tách Thửa (Căn A/B)'
                : mutation.type === 'MERGE'
                ? 'Đã Gộp Thửa (Khuôn viên chung)'
                : 'Nguyên Trạng (Khớp ranh)'}
            </span>
          </div>

          {/* Bản đồ trực quan đa giác ranh thửa đất (Khớp ranh, Tách căn A/B, Gộp khuôn viên) */}
          <AuditCadastralMutationVisualMap
            parcelCoordinates={parcelCoords}
            projectParcelCode={data?.projectParcelCode || formState.projectParcelCode}
            mutationType={mutation.type || 'MATCH'}
            mutationDetails={mutation.details || {}}
            landAreaM2={landAreaM2}
            frontageWidth={frontageWidth}
            lotDepth={lotDepth}
            gpsLocation={{
              lat: Number(coords.lat || coords.latitude || 10.79241),
              lng: Number(coords.lng || coords.longitude || 106.71152),
              accuracy: coords.accuracy,
            }}
            onOpenEditorModal={() => setIsMutationModalOpen(true)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 block uppercase mb-1">
                Thửa Đất Hiện Hành
              </span>
              <div className="font-bold text-slate-800 font-mono">
                Mã Thửa: [{data?.projectParcelCode || formState.projectParcelCode || '---'}]
              </div>
              <div className="text-slate-600 text-[11px] mt-0.5">
                {data?.houseNumber || formState.houseNumber} {data?.street || formState.street}
              </div>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 block uppercase mb-1">
                Ghi Chú Biến Động Thực Địa
              </span>
              <p className="text-slate-600 text-[11px]">
                {mutation.surveyorNotes || mutation.adminNotes || 'Không có ghi nhận biến động đặc biệt từ khảo sát viên.'}
              </p>
            </div>

            {/* Chi tiết các thửa con đề xuất nếu đã Tách thửa */}
            {mutation.type === 'SPLIT' && splitChildren.length > 0 && (
              <div className="col-span-full p-3 bg-white rounded-xl border border-blue-200 space-y-2">
                <span className="text-[11px] font-bold text-blue-900 block uppercase">
                  Danh Sách Các Thửa Con Tách Đề Xuất ({splitChildren.length} căn):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {splitChildren.map((child: any, cIdx: number) => (
                    <div key={cIdx} className="p-2 bg-blue-50/60 rounded-lg border border-blue-200 text-xs space-y-0.5">
                      <div className="font-mono font-black text-blue-950">
                        {child.parcelCode || child.code || `Căn ${cIdx === 0 ? 'A' : 'B'}`}
                      </div>
                      <div className="text-slate-700">
                        DT: <strong>{child.landAreaM2 || child.areaM2 || '---'} m²</strong>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Chủ: {child.ownerName || 'Chưa định danh'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chi tiết thửa gộp đề xuất nếu đã Gộp thửa */}
            {mutation.type === 'MERGE' && (
              <div className="col-span-full p-3 bg-white rounded-xl border border-blue-200 space-y-2">
                <span className="text-[11px] font-bold text-blue-900 block uppercase">
                  Chi Tiết Hồ Sơ Gộp Thửa:
                </span>
                <div className="text-xs text-slate-700 space-y-1">
                  <div>Mã thửa đích gộp: <strong className="font-mono text-blue-800">{mutationDetails.mergeTargetCode || 'Chưa chọn'}</strong></div>
                  {selectedMergeCodes.length > 0 && (
                    <div>Các thửa cùng khuôn viên: <strong className="font-mono text-slate-800">{selectedMergeCodes.join(', ')}</strong></div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Tách/Gộp thửa GIS */}
      {isMutationModalOpen && (
        <UnifiedGisMutationModal
          isOpen={isMutationModalOpen}
          role="ZONE_ADMIN"
          parcelId={data?.parcelId || formState.parcelId}
          parcelCode={data?.projectParcelCode || formState.projectParcelCode}
          houseNumber={data?.houseNumber || formState.houseNumber}
          street={data?.street || formState.street}
          currentAreaM2={data?.buildingSpecs?.landAreaM2 || formState.landAreaM2}
          initialZoneId={data?.zoneId || formState.zoneId}
          reportId={reportId || data?.reportId}
          onClose={() => setIsMutationModalOpen(false)}
          onSuccess={(msg: string) => {
            showToast(msg);
            if (onRefresh) onRefresh();
          }}
        />
      )}

      {/* Modal Hoán đổi ranh GIS */}
      {isReassignModalOpen && (
        <AdminReassignParcelModal
          isOpen={isReassignModalOpen}
          reportId={reportId || data?.reportId}
          currentParcelCode={data?.projectParcelCode || formState.projectParcelCode}
          currentParcelId={data?.parcelId || formState.parcelId}
          currentHouseNumber={data?.houseNumber || formState.houseNumber}
          currentStreet={data?.street || formState.street}
          surveyorName={data?.surveyorName || formState.surveyorName}
          zoneId={data?.zoneId || formState?.zoneId || data?.zone_id || 'ZONE_01'}
          onClose={() => setIsReassignModalOpen(false)}
          onSuccess={(msg: string) => {
            showToast(msg);
            if (onRefresh) onRefresh();
          }}
        />
      )}

      {/* Modal Nắn chỉnh ranh đất GIS */}
      {isReshapeModalOpen && reshapeParcel && (
        <CadastralBoundaryReshapeModal
          isOpen={isReshapeModalOpen}
          parcel={reshapeParcel}
          onClose={() => setIsReshapeModalOpen(false)}
          onSuccess={(res) => {
            showToast(res?.message || 'Đã nắn chỉnh ranh giới thửa đất thành công.');
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </section>
  );
};
