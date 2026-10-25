import type { FloorSurveyData } from '../../../../../survey-phase1/types/phase1.types';
import type { GisParcel } from '../../../../../../components/gis/shared/types';
import React, { useState, useMemo } from 'react';
import {
  MapPin,
  ShieldCheck,
  AlertTriangle,
  Building,
  CheckCircle2,
  Split,
  ArrowRightLeft,
  Navigation,
  Ruler,
  Layers,
  Move,
  RefreshCw,
  X,
} from 'lucide-react';
import { UnifiedGisMutationModal } from '../../../../../../components/gis/cadastral-editor/UnifiedGisMutationModal';
import { AdminReassignParcelModal } from '../../AdminReassignParcelModal';
import { CadastralBoundaryReshapeModal } from '../../../../../../components/gis/cadastral-editor/components/CadastralBoundaryReshapeModal';
import { AuditCadastralMutationVisualMap } from '../components/AuditCadastralMutationVisualMap';
import { calculateComprehensiveMetroSpatialMetrics } from '../../../../../survey-phase1/utils/metroSpatialCalculator';
import { computePolygonAreaM2, normalizeQuadEdges, getDistanceM } from '../../../../../../components/gis/shared/geoMath';

import type { AuditStepwiseFormState, AuditStepwiseData, StepwiseAccessLimitation, StepwiseGisMutationConfirmed } from '../types';

const isSoftDeleted = (item: unknown): boolean => {
  if (!item || typeof item !== 'object') return false;
  const rec = item as Record<string, unknown>;
  return Boolean(rec.isDeleted || rec.is_deleted);
};

interface Props {
  isEditMode: boolean;
  formState: AuditStepwiseFormState;
  data?: AuditStepwiseData;
  reportId?: string;
  handleNestedFieldChange: (parentKey: string, childKey: string, label: string, val: unknown) => void;
  handleFieldChange?: (fieldKey: string, label: string, val: unknown) => void;
  handleApplySyncedGeometry?: (newCoords: [number, number][], newMetroDist: string, newClearanceDist: string) => void;
  onOpenPhotoZoom?: (url: string, title?: string, photoCode?: string) => void;
  onRefresh?: () => void;
  isFieldDirty?: (fieldKey: string, subKey?: string) => boolean;
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
  handleApplySyncedGeometry,
  onRefresh,
  isFieldDirty,
}) => {
  const [isMutationModalOpen, setIsMutationModalOpen] = useState(false);
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [isReshapeModalOpen, setIsReshapeModalOpen] = useState(false);
  const [successToast, setSuccessToast] = useState('');

  const access: StepwiseAccessLimitation = formState.accessLimitation || {};
  const mutation: StepwiseGisMutationConfirmed = formState.gisMutationConfirmed || {};
  const activeFloors = useMemo(
    () => (formState.floors || []).filter((fl) => !isSoftDeleted(fl)),
    [formState.floors]
  );

  // Giải quyết tọa độ GPS thực địa (ưu tiên formState.gpsCoords đã chuẩn hóa từ hook hoặc chuỗi "lat, lng")
  const parsedGpsCoords = useMemo<{ lat: number; lng: number; accuracy?: number }>(() => {
    const rawGps = formState.gpsCoords as unknown;
    if (typeof rawGps === 'string' && rawGps.includes(',')) {
      const parts = rawGps.split(',').map((s) => parseFloat(s.trim()));
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[0] !== 0 && parts[1] !== 0) {
        return { lat: parts[0], lng: parts[1] };
      }
    } else if (rawGps && typeof rawGps === 'object') {
      const obj = rawGps as { lat?: number; lng?: number; latitude?: number; longitude?: number; accuracy?: number };
      const lat = Number(obj.lat ?? obj.latitude);
      const lng = Number(obj.lng ?? obj.longitude);
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        return { lat, lng, accuracy: obj.accuracy };
      }
    }

    const loc = (formState.gpsLocation ||
      (typeof formState.coordinates === 'object' && !Array.isArray(formState.coordinates) ? formState.coordinates : {}) ||
      data?.surveyJson?.gpsCoords ||
      {}) as {
      lat?: number;
      lng?: number;
      latitude?: number;
      longitude?: number;
      accuracy?: number;
    };
    const lat = Number(loc.lat ?? loc.latitude ?? 10.79241);
    const lng = Number(loc.lng ?? loc.longitude ?? 106.71152);
    return {
      lat: !isNaN(lat) && lat !== 0 ? lat : 10.79241,
      lng: !isNaN(lng) && lng !== 0 ? lng : 106.71152,
      accuracy: loc.accuracy,
    };
  }, [formState.gpsCoords, formState.gpsLocation, formState.coordinates, data?.surveyJson?.gpsCoords]);

  // Kích thước hình học thửa đất & Định danh ưu tiên formState
  const effectiveParcelCode = formState.projectParcelCode ?? data?.projectParcelCode ?? '';
  const effectiveOfficialCode = formState.officialCadastralCode ?? data?.officialCadastralCode ?? '';
  const effectiveHouseNumber = formState.houseNumber ?? data?.houseNumber ?? '';
  const effectiveStreet = (formState.streetName as string | undefined) ?? formState.street ?? data?.street ?? '';
  const effectiveOwnerName = formState.ownerName ?? data?.ownerName ?? '';

  const frontageWidth = formState.frontageWidth ?? data?.buildingSpecs?.frontageWidth ?? (data?.activeParcel as GisParcel | undefined)?.frontage_width;
  const lotDepth = formState.lotDepth ?? data?.buildingSpecs?.lotDepth ?? (data?.activeParcel as GisParcel | undefined)?.lot_depth;
  const landAreaM2 = formState.landAreaM2 ?? formState.landArea ?? data?.buildingSpecs?.landAreaM2 ?? (data?.activeParcel as GisParcel | undefined)?.land_area_m2;
  const mutationDetails = mutation.details || {};
  const splitChildren = Array.isArray(mutationDetails.splitChildren) ? mutationDetails.splitChildren : [];
  const selectedMergeCodes = Array.isArray(mutationDetails.selectedMergeCodes) ? mutationDetails.selectedMergeCodes : [];

  // Trích xuất tọa độ Polygon từ PostGIS GeoJSON (ranh mới nhất trên DB sau khi cắt GPMB / nắn ranh)
  const postgisPolygon = useMemo<[number, number][]>(() => {
    const rawGeojson = data?.cadastralGeojson || data?.cadastral_geojson;
    if (rawGeojson) {
      try {
        const parsed =
          typeof rawGeojson === 'string'
            ? (JSON.parse(rawGeojson) as { type?: string; coordinates?: [number, number][][] })
            : (rawGeojson as { type?: string; coordinates?: [number, number][][] });
        if (parsed && parsed.type === 'Polygon' && Array.isArray(parsed.coordinates?.[0])) {
          return parsed.coordinates[0].map(([lng, lat]: [number, number]) => [lat, lng]);
        }
      } catch (e) {
        console.warn('Failed to parse cadastralGeojson in AuditStep6:', e);
      }
    }
    return [];
  }, [data?.cadastralGeojson, data?.cadastral_geojson]);

  // Tọa độ ranh khảo sát gốc ban đầu (để đối chiếu nét đứt khi đã cắt GPMB / nắn ranh)
  const initialSurveyPolygon = useMemo<[number, number][]>(() => {
    const sJson = data?.surveyJson || data?.survey_data_json;
    if (Array.isArray(sJson?.parcelCoordinates) && sJson.parcelCoordinates.length >= 3) {
      return sJson.parcelCoordinates;
    }
    if (Array.isArray(sJson?.polygonCoords) && sJson.polygonCoords.length >= 3) {
      return sJson.polygonCoords;
    }
    if (Array.isArray(data?.parcelCoordinates) && data.parcelCoordinates.length >= 3) {
      return data.parcelCoordinates;
    }
    const rawCoords = data?.coordinates as [number, number][] | undefined;
    if (Array.isArray(rawCoords) && rawCoords.length >= 3 && Array.isArray(rawCoords[0])) {
      return rawCoords;
    }
    return [];
  }, [data?.surveyJson, data?.survey_data_json, data?.parcelCoordinates, data?.coordinates]);

  // Trích xuất tọa độ Polygon thửa đất hiện hành: Luôn ưu tiên ranh PostGIS hiện hành ngoài bản đồ GIS trừ khi TDV vừa chỉnh sửa thủ công
  const isParcelCoordsManuallyEdited = Boolean(isFieldDirty?.('parcelCoordinates'));
  const parcelCoords = useMemo<[number, number][]>(() => {
    if (isParcelCoordsManuallyEdited && Array.isArray(formState.parcelCoordinates) && formState.parcelCoordinates.length >= 3) {
      return formState.parcelCoordinates;
    }
    if (postgisPolygon.length >= 3) {
      return postgisPolygon;
    }
    if (Array.isArray(formState.parcelCoordinates) && formState.parcelCoordinates.length >= 3) {
      return formState.parcelCoordinates;
    }
    if (initialSurveyPolygon.length >= 3) {
      return initialSurveyPolygon;
    }
    return [];
  }, [isParcelCoordsManuallyEdited, formState.parcelCoordinates, postgisPolygon, initialSurveyPolygon]);

  // Tính toán kích thước hình học trực tiếp từ đa giác GIS hiện hành (đồng bộ 100% với bản đồ GIS bên ngoài)
  const liveGisGeometry = useMemo<{
    areaM2: number | string;
    frontageM: number | string;
    depthM: number | string;
  }>(() => {
    if (parcelCoords.length >= 3) {
      const computedArea = computePolygonAreaM2(parcelCoords);
      const quad = normalizeQuadEdges(parcelCoords);
      const frontDist = Math.round(getDistanceM(quad.frontL, quad.frontR) * 100) / 100;
      const leftDist = getDistanceM(quad.frontL, quad.backL);
      const rightDist = getDistanceM(quad.frontR, quad.backR);
      const avgDepth = Math.round(((leftDist + rightDist) / 2) * 100) / 100;

      return {
        areaM2: isFieldDirty?.('landAreaM2') && formState.landAreaM2 ? formState.landAreaM2 : (computedArea > 0 ? computedArea : (landAreaM2 || 0)),
        frontageM: isFieldDirty?.('frontageWidth') && formState.frontageWidth ? formState.frontageWidth : (frontDist > 0 ? frontDist : (frontageWidth || '')),
        depthM: isFieldDirty?.('lotDepth') && formState.lotDepth ? formState.lotDepth : (avgDepth > 0 ? avgDepth : (lotDepth || '')),
      };
    }
    return {
      areaM2: landAreaM2 || 0,
      frontageM: frontageWidth || '',
      depthM: lotDepth || '',
    };
  }, [parcelCoords, isFieldDirty, formState.landAreaM2, formState.frontageWidth, formState.lotDepth, landAreaM2, frontageWidth, lotDepth]);

  // Kiểm tra xem ranh PostGIS mới nhất trong DB có khác với ranh đang lưu trong snapshot formState hay không
  const hasPostgisDiff = useMemo<boolean>(() => {
    if (postgisPolygon.length < 3 || !Array.isArray(formState.parcelCoordinates) || formState.parcelCoordinates.length < 3) {
      return false;
    }
    if (postgisPolygon.length !== formState.parcelCoordinates.length) return true;
    const areaPostgis = computePolygonAreaM2(postgisPolygon);
    const areaCurrent = computePolygonAreaM2(formState.parcelCoordinates);
    if (Math.abs(areaPostgis - areaCurrent) > 0.5) return true;
    return postgisPolygon.some((pt, idx) => {
      const curPt = formState.parcelCoordinates?.[idx];
      if (!curPt) return true;
      return Math.hypot(pt[0] - curPt[0], pt[1] - curPt[1]) > 0.00001;
    });
  }, [postgisPolygon, formState.parcelCoordinates]);

  // Kiểm tra xem thửa đất đã được điều chỉnh ranh / cắt GPMB hay chưa
  const isBoundaryAdjusted = useMemo<boolean>(() => {
    if (mutation.type === 'BOUNDARY_ADJUST' || mutation.mutationType === 'BOUNDARY_ADJUST') return true;
    if (hasPostgisDiff) return true;
    if (initialSurveyPolygon.length >= 3 && parcelCoords.length >= 3) {
      if (initialSurveyPolygon.length !== parcelCoords.length) return true;
      if (Math.abs(computePolygonAreaM2(parcelCoords) - computePolygonAreaM2(initialSurveyPolygon)) > 0.5) return true;
      return parcelCoords.some((pt, idx) => {
        const initPt = initialSurveyPolygon[idx];
        if (!initPt) return true;
        return Math.hypot(pt[0] - initPt[0], pt[1] - initPt[1]) > 0.00001;
      });
    }
    return false;
  }, [mutation.type, mutation.mutationType, hasPostgisDiff, initialSurveyPolygon, parcelCoords]);

  const handleSyncPostgisPolygon = () => {
    if (postgisPolygon.length < 3) return;
    const metrics = calculateComprehensiveMetroSpatialMetrics(postgisPolygon);
    const newMetro =
      metrics.distanceToCenterlineMeters !== undefined ? `${metrics.distanceToCenterlineMeters.toFixed(1)}m` : '0.0m';
    const newClearance =
      metrics.outerBoundaryType === 'STATION_OUTLINE' && metrics.distanceToOuterBoundaryMeters !== null
        ? `${metrics.distanceToOuterBoundaryMeters.toFixed(1)}m`
        : 'Không có ga trong khu vực';
    const newArea = computePolygonAreaM2(postgisPolygon);
    const [cLat, cLng] = metrics.closestCenterVertex;

    if (handleApplySyncedGeometry) {
      handleApplySyncedGeometry(postgisPolygon, newMetro, newClearance);
    } else if (handleFieldChange) {
      handleFieldChange('parcelCoordinates', 'Tọa độ đa giác ranh PostGIS mới', postgisPolygon);
      handleFieldChange('metroOffsetDistance', 'Cự ly tim hầm Metro', newMetro);
      handleFieldChange('clearanceOffsetDistance', 'Cự ly mép ga / biên GPMB', newClearance);
    }
    handleFieldChange?.('landAreaM2', 'Diện tích đất sau cắt GPMB', newArea);
    handleFieldChange?.('gpsCoords', 'Tọa độ GPS đỉnh gần Metro nhất', {
      lat: Number(cLat.toFixed(6)),
      lng: Number(cLng.toFixed(6)),
    });
    if (mutation.type !== 'SPLIT' && mutation.type !== 'MERGE') {
      handleNestedFieldChange('gisMutationConfirmed', 'type', 'Loại biến động ranh GIS', 'BOUNDARY_ADJUST');
    }
    showToast(`Đã đồng bộ đa giác PostGIS mới (${newArea} m²) và cập nhật cự ly Metro (${newMetro}).`);
  };

  const reshapeParcel = useMemo<GisParcel | null>(() => {
    const pId = formState.parcelId ?? data?.parcelId ?? (data?.activeParcel as GisParcel | undefined)?.id;
    if (!pId) return null;
    return {
      id: pId,
      projectParcelCode: effectiveParcelCode,
      officialCadastralCode: effectiveOfficialCode,
      houseNumber: effectiveHouseNumber,
      street: effectiveStreet,
      ownerName: effectiveOwnerName,
      surveyStatus: (formState.surveyStatus ?? data?.surveyStatus ?? 'SUBMITTED') as GisParcel['surveyStatus'],
      coordinates: parcelCoords,
      landArea: Number(landAreaM2 || 0),
      constructionArea: Number(formState.constructionAreaM2 ?? data?.buildingSpecs?.constructionAreaM2 ?? landAreaM2 ?? 0),
      floorCount: Number(formState.aboveFloors ?? data?.buildingSpecs?.floorCount ?? 1),
      buildingType: (formState.buildingType ?? data?.buildingSpecs?.buildingType ?? 'STANDALONE') as GisParcel['buildingType'],
      zoneId: formState.zoneId ?? data?.zoneId ?? 'ZONE_01',
    };
  }, [
    data,
    formState,
    parcelCoords,
    landAreaM2,
    effectiveParcelCode,
    effectiveOfficialCode,
    effectiveHouseNumber,
    effectiveStreet,
    effectiveOwnerName,
  ]);

  // Tính khoảng cách tim hầm Metro & mép ga (giải quyết chuỗi có hậu tố "m")
  const rawMetroDist =
    formState.metroOffsetDistance ??
    formState.clearanceOffsetDistance ??
    formState.metroDistanceM ??
    formState.distanceToMetroCenterlineM ??
    data?.metroOffsetDistance ??
    data?.surveyJson?.metroOffsetDistance ??
    15.2;
  const parsedMetroNum = parseFloat(String(rawMetroDist).replace(/[^0-9.-]/g, ''));
  const metroDistance = !isNaN(parsedMetroNum) ? parsedMetroNum : 15.2;
  const manualDistance = formState.manualMetroDistanceM;
  const parsedManualNum =
    manualDistance !== undefined && manualDistance !== ''
      ? parseFloat(String(manualDistance).replace(/[^0-9.-]/g, ''))
      : NaN;

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(''), 4000);
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

  const currentDist = !isNaN(parsedManualNum) ? parsedManualNum : metroDistance;
  const riskBadge = getRiskZoneBadge(currentDist);

  const hasUnsavedChanges = Boolean(
    isEditMode &&
      isFieldDirty &&
      ['houseNumber', 'street', 'ownerName', 'landAreaM2', 'accessLimitation', 'gisMutationConfirmed', 'parcelCoordinates'].some((k) =>
        isFieldDirty(k)
      )
  );

  const handleOpenGisModal = (openFn: () => void) => {
    if (hasUnsavedChanges) {
      const ok = window.confirm(
        'Bạn đang có các chỉnh sửa chưa lưu trên biểu mẫu. Thao tác trên công cụ GIS sẽ làm mới dữ liệu từ máy chủ. Bạn có muốn tiếp tục mở công cụ GIS?'
      );
      if (!ok) return;
    }
    openFn();
  };

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
            className="text-emerald-200 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
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
      </div>

      <div className="p-5 space-y-6">
        {/* 6.1. Không gian đã khảo sát */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                6.1. Không Gian Đã Khảo Sát ({activeFloors.length} tầng)
              </span>
            </div>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
              Khảo sát đầy đủ các tầng ghi nhận
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {activeFloors.map((fl: FloorSurveyData, idx: number) => {
              const activeZonesCount = (fl.zones || []).filter((z) => !isSoftDeleted(z)).length;
              return (
                <div
                  key={fl.id || idx}
                  className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <Building className="w-3.5 h-3.5 text-slate-500" />
                    <span>{fl.floorName || `Tầng ${idx + 1}`}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-semibold">
                    {activeZonesCount} vùng Z
                  </span>
                </div>
              );
            })}
            {activeFloors.length === 0 && (
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
                  onChange={(e) => {
                    const nextType = e.target.value;
                    handleNestedFieldChange('accessLimitation', 'type', 'Mức độ tiếp cận', nextType);
                    if (nextType === 'FULL_100') {
                      handleNestedFieldChange('accessLimitation', 'mainReason', 'Nguyên nhân hạn chế', '');
                      handleNestedFieldChange('accessLimitation', 'restrictedAreas', 'Khu vực hạn chế', []);
                      handleNestedFieldChange('accessLimitation', 'restrictedFloorLevels', 'Tầng hạn chế', []);
                      handleNestedFieldChange('accessLimitation', 'notes', 'Ghi chú hạn chế', '');
                    }
                  }}
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
                    value={access.mainReason && ACCESS_LIMIT_PRESETS.includes(access.mainReason) ? access.mainReason : 'Khác (Nhập chi tiết...)'}
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

          {/* Chi tiết khu vực hạn chế & Tầng hạn chế */}
          {access.type !== 'FULL_100' && (
            <div className="space-y-3 pt-2 border-t border-amber-200/60">
              <div className="space-y-1.5">
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

              {/* Tầng hạn chế */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-amber-950 block">
                  Các tầng bị hạn chế / không thể khảo sát:
                </span>
                {(() => {
                  const restrictedFloors: string[] = Array.isArray(access.restrictedFloorLevels)
                    ? (access.restrictedFloorLevels as string[])
                    : [];
                  return isEditMode ? (
                    <div className="flex flex-wrap gap-2">
                      {activeFloors.map((fl: FloorSurveyData | { floorId?: string; floorName?: string }, fIdx: number) => {
                        const floorName = fl.floorName || `Tầng ${fIdx + 1}`;
                        const isSelected = restrictedFloors.includes(floorName);
                        return (
                          <label
                            key={fIdx}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs cursor-pointer select-none ${
                              isSelected ? 'bg-amber-100 border-amber-400 text-amber-950 font-bold' : 'bg-white border-slate-200 text-slate-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const updated = e.target.checked
                                  ? [...restrictedFloors, floorName]
                                  : restrictedFloors.filter((f) => f !== floorName);
                                handleNestedFieldChange('accessLimitation', 'restrictedFloorLevels', 'Tầng hạn chế', updated);
                              }}
                              className="rounded text-amber-600"
                            />
                            <span>{floorName}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {restrictedFloors.map((fl: string, idx: number) => (
                        <span key={idx} className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-xs font-bold">
                          {fl}
                        </span>
                      ))}
                      {restrictedFloors.length === 0 && (
                        <span className="text-xs text-slate-400 italic">Không có tầng nào bị hạn chế hoàn toàn</span>
                      )}
                    </div>
                  );
                })()}
              </div>
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

        {/* 6.3. Biến động thửa đất GIS */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                6.3. Tình Trạng Biến Động Ranh Thửa Thực Địa & Bản Đồ Đa Giác GIS
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                  mutation.type === 'SPLIT' || mutation.type === 'BOUNDARY_ADJUST' || isBoundaryAdjusted
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}
              >
                {mutation.type === 'SPLIT'
                  ? 'Đã Tách Thửa (Căn A/B)'
                  : mutation.type === 'MERGE'
                  ? 'Đã Gộp Thửa (Khuôn viên chung)'
                  : mutation.type === 'BOUNDARY_ADJUST' || isBoundaryAdjusted
                  ? 'Đã Điều Chỉnh Ranh / Cắt GPMB'
                  : 'Nguyên Trạng (Khớp ranh)'}
              </span>

              <button
                type="button"
                onClick={() => handleOpenGisModal(() => setIsReassignModalOpen(true))}
                className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                title="Điều chuyển hồ sơ sang thửa khác hoặc hoán đổi 2 nhà kề nhau bị tích chéo"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-amber-600" />
                <span>Hoán Đổi Ranh</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenGisModal(() => setIsMutationModalOpen(true))}
                className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                title="Thực thi tách thửa hoặc gộp thửa trực tiếp trên GIS"
              >
                <Split className="w-3.5 h-3.5" />
                <span>Tách / Gộp Thửa</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenGisModal(() => setIsReshapeModalOpen(true))}
                className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                title="Kéo thả mốc đỉnh để nắn chỉnh đa giác ranh thửa đất khớp ảnh vệ tinh"
              >
                <Move className="w-3.5 h-3.5 text-indigo-600" />
                <span>Nắn Chỉnh Ranh</span>
              </button>
            </div>
          </div>

          {/* Cảnh báo đồng bộ ranh PostGIS mới khi đa giác PostGIS trên DB đã bị cắt GPMB / nắn ranh so với snapshot */}
          {hasPostgisDiff && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
              <div className="flex items-start gap-2 text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">
                    Phát hiện ranh giới PostGIS mới ({computePolygonAreaM2(postgisPolygon)} m²) khác với ranh lưu trong hồ sơ ({computePolygonAreaM2(parcelCoords)} m²).
                  </span>
                  <span className="text-[11px] text-amber-800">
                    Thửa đất đã được cắt xén hành lang GPMB hoặc nắn chỉnh trên lớp bản đồ địa chính PostGIS.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSyncPostgisPolygon}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Đồng bộ ranh PostGIS mới</span>
              </button>
            </div>
          )}

          {/* Bản đồ trực quan đa giác ranh thửa đất (Khớp ranh, Tách căn A/B, Gộp khuôn viên, Cắt GPMB) */}
          <AuditCadastralMutationVisualMap
            parcelCoordinates={parcelCoords}
            initialSurveyPolygon={initialSurveyPolygon.length >= 3 ? initialSurveyPolygon : postgisPolygon}
            isBoundaryAdjusted={isBoundaryAdjusted}
            projectParcelCode={effectiveParcelCode || '---'}
            mutationType={mutation.type || (isBoundaryAdjusted ? 'BOUNDARY_ADJUST' : 'MATCH')}
            mutationDetails={mutation.details || {}}
            landAreaM2={liveGisGeometry.areaM2}
            frontageWidth={liveGisGeometry.frontageM}
            lotDepth={liveGisGeometry.depthM}
            gpsLocation={parsedGpsCoords}
            onOpenEditorModal={() => handleOpenGisModal(() => setIsMutationModalOpen(true))}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">
                Thửa Đất &amp; Kích Thước GIS Hiện Hành
              </span>
              <div className="font-bold text-slate-800 font-mono">
                Mã Thửa: [{effectiveParcelCode || '---'}]
              </div>
              <div className="text-slate-600 text-[11px]">
                {effectiveHouseNumber} {effectiveStreet}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-800 bg-emerald-50/80 border border-emerald-200 px-2 py-1 rounded-lg mt-1">
                <Ruler className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>
                  DT GIS: <strong>{liveGisGeometry.areaM2} m²</strong>
                  {(liveGisGeometry.frontageM || liveGisGeometry.depthM) && (
                    <span className="text-slate-600 ml-1">
                      ({liveGisGeometry.frontageM || '?'}m &times; {liveGisGeometry.depthM || '?'}m)
                    </span>
                  )}
                </span>
              </div>
              {effectiveOwnerName && (
                <div className="text-slate-500 text-[11px] pt-0.5">
                  Chủ hộ: <strong className="text-slate-700">{effectiveOwnerName}</strong>
                </div>
              )}
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">
                Tọa Độ Thực Địa & Cự Ly Tuyến Metro
              </span>
              <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-700">
                <Navigation className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span>
                  GPS: <strong>{parsedGpsCoords.lat.toFixed(6)}, {parsedGpsCoords.lng.toFixed(6)}</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-700">
                <Ruler className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>
                  Cách tim hầm: <strong className="font-mono text-indigo-900">{currentDist.toFixed(1)}m</strong>
                </span>
              </div>
              <div className="pt-0.5">
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${riskBadge.color}`}>
                  {riskBadge.label}
                </span>
              </div>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 block uppercase mb-1">
                Ghi Chú Biến Động Thực Địa
              </span>
              <p className="text-slate-600 text-[11px]">
                {mutation.surveyorNotes || mutation.adminNotes || 'Không'}
              </p>
            </div>

            {/* Chi tiết các thửa con đề xuất nếu đã Tách thửa */}
            {mutation.type === 'SPLIT' && splitChildren.length > 0 && (
              <div className="col-span-full p-3 bg-white rounded-xl border border-blue-200 space-y-2">
                <span className="text-[11px] font-bold text-blue-900 block uppercase">
                  Danh Sách Các Thửa Con Tách Đề Xuất ({splitChildren.length} căn):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {splitChildren.map((child: { parcelCode?: string; code?: string; landAreaM2?: string | number; areaM2?: string | number; ownerName?: string; [key: string]: unknown }, cIdx: number) => (
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
                  <div>Mã thửa đích gộp: <strong className="font-mono text-blue-800">{String(mutationDetails.mergeTargetCode || 'Chưa chọn')}</strong></div>
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
          parcelId={formState.parcelId ?? data?.parcelId ?? ''}
          parcelCode={effectiveParcelCode}
          houseNumber={effectiveHouseNumber}
          street={effectiveStreet}
          currentAreaM2={Number(formState.landAreaM2 ?? data?.buildingSpecs?.landAreaM2 ?? 0)}
          initialZoneId={formState.zoneId ?? data?.zoneId}
          reportId={reportId || (data?.reportId as string | undefined)}
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
          reportId={reportId || (data?.reportId as string | undefined) || ''}
          currentParcelCode={effectiveParcelCode}
          currentParcelId={formState.parcelId ?? data?.parcelId ?? ''}
          currentHouseNumber={effectiveHouseNumber}
          currentStreet={effectiveStreet}
          surveyorName={formState.surveyorName ?? data?.surveyorName}
          zoneId={String(formState.zoneId ?? data?.zoneId ?? data?.zone_id ?? 'ZONE_01')}
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
            const newCoords = Array.isArray(res?.newCoordinates) ? (res.newCoordinates as [number, number][]) : [];
            if (newCoords.length >= 3) {
              const metrics = calculateComprehensiveMetroSpatialMetrics(newCoords);
              const newMetro = metrics.distanceToCenterlineMeters !== undefined ? `${metrics.distanceToCenterlineMeters.toFixed(1)}m` : '0.0m';
              const newClearance =
                metrics.outerBoundaryType === 'STATION_OUTLINE' && metrics.distanceToOuterBoundaryMeters !== null
                  ? `${metrics.distanceToOuterBoundaryMeters.toFixed(1)}m`
                  : 'Không có ga trong khu vực';
              const newArea = computePolygonAreaM2(newCoords);
              const [cLat, cLng] = metrics.closestCenterVertex;

              if (handleApplySyncedGeometry) {
                handleApplySyncedGeometry(newCoords, newMetro, newClearance);
              }
              handleFieldChange?.('landAreaM2', 'Diện tích đất sau nắn ranh', newArea);
              handleFieldChange?.('gpsCoords', 'Tọa độ GPS đỉnh gần Metro nhất', {
                lat: Number(cLat.toFixed(6)),
                lng: Number(cLng.toFixed(6)),
              });
              if (mutation.type !== 'SPLIT' && mutation.type !== 'MERGE') {
                handleNestedFieldChange('gisMutationConfirmed', 'type', 'Loại biến động ranh GIS', 'BOUNDARY_ADJUST');
              }
            }
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </section>
  );
};
