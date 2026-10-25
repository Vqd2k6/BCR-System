import React, { useMemo, useState, useEffect } from 'react';
import type { PolygonPoint } from '../../../../../survey-phase1/types/phase1.types';
import { Camera, Maximize2, MapPin, AlertCircle, AlertTriangle, Lightbulb, Sparkles, X, ArrowRight, Compass, ShieldAlert, Building, Navigation, ShieldCheck, RefreshCw, Plus, Trash2, History, Edit3, Undo2, RotateCw, CheckCircle2 } from 'lucide-react';
import { Badge } from '../../../../../../core/components/ui/Badge';
import { OBJECT_GROUPS, ADJACENT_LEFT_RIGHT, ADJACENT_REAR } from '../../../../../survey-phase1/components/step1/step1.constants';
import { USAGE_OPTIONS } from '../../../../../survey-phase1/constants/surveyOptionsConstants';
import { AuditMetroSpatialVisualMap } from '../components/AuditMetroSpatialVisualMap';
import { RotatableImageFrame } from '../components/RotatableImageFrame';
import { calculateComprehensiveMetroSpatialMetrics } from '../../../../../survey-phase1/utils/metroSpatialCalculator';

import type { AuditStepBaseProps, StepwiseIdentificationPhotoItem, PhotoActionPayload } from '../types';
import { resolveOptimisticPhoto, getOptimisticAddedPhotos } from '../utils/optimisticPhotoResolver';
import { SmartAddressSuggestionCard } from '../components/SmartAddressSuggestionCard';
import { evaluateAddressStandard, formatStandardizedAddress168 } from '../utils/residentialAddressStandards';

interface Props extends Omit<AuditStepBaseProps, 'handleApplySyncedGeometry'> {
  handleApplySyncedGeometry?: (
    newCoords: [number, number][],
    newMetroDist: string,
    newClearanceDist: string,
    closestCenterVertex?: [number, number] | null
  ) => void;
}

interface AdjacentSide {
  details?: string;
  note?: string;
  notes?: string;
}

interface AdjacentBuildings {
  left?: AdjacentSide;
  right?: AdjacentSide;
  back?: AdjacentSide;
  [key: string]: unknown;
}

interface IdentificationPhotoItemExtended extends StepwiseIdentificationPhotoItem {
  notApplicable?: boolean;
  naReason?: string;
  tag?: string;
}

interface DynamicPhotoItem {
  key: string;
  code: string;
  label: string;
  url: string;
  photoCode?: string;
  notApplicable?: boolean;
  naReason?: string;
  polygonPoints?: PolygonPoint[] | null;
  floorSplits?: unknown;
  tag?: string;
  isExtra?: boolean;
  extraIndex?: number;
  isOptimisticAdded?: boolean;
  optimisticAction?: PhotoActionPayload;
  historyCount?: number;
  hasHistory?: boolean;
}

const toPhotoObj = (raw: unknown): IdentificationPhotoItemExtended => {
  if (typeof raw === 'string') return { url: raw };
  if (raw && typeof raw === 'object') return raw as IdentificationPhotoItemExtended;
  return {};
};

const formatDistanceDisplay = (val: unknown): string => {
  if (val === undefined || val === null || val === '') return '---';
  const str = String(val).trim();
  const num = parseFloat(str.replace(/[^\d.-]/g, ''));
  if (isNaN(num)) return '---';
  return `${num.toFixed(1)} m`;
};

const getNumericValue = (val: unknown): string => {
  if (val === undefined || val === null || val === '') return '';
  const num = parseFloat(String(val).replace(/[^\d.-]/g, ''));
  return isNaN(num) ? '' : String(num);
};

const normalizePolygonRing = (coords: [number, number][] | undefined): [number, number][] => {
  if (!Array.isArray(coords)) return [];
  const valid = coords.filter(
    (pt): pt is [number, number] =>
      Array.isArray(pt) &&
      pt.length >= 2 &&
      typeof pt[0] === 'number' &&
      typeof pt[1] === 'number' &&
      Number.isFinite(pt[0]) &&
      Number.isFinite(pt[1])
  );
  if (valid.length > 3) {
    const first = valid[0];
    const last = valid[valid.length - 1];
    if (Math.abs(first[0] - last[0]) < 1e-6 && Math.abs(first[1] - last[1]) < 1e-6) {
      return valid.slice(0, -1);
    }
  }
  return valid;
};

const arePolygonsDifferent = (
  polyA: [number, number][] | undefined,
  polyB: [number, number][] | undefined,
  tolerance = 0.00001
): boolean => {
  const ringA = normalizePolygonRing(polyA);
  const ringB = normalizePolygonRing(polyB);
  if (ringA.length < 3 || ringB.length < 3) return false;
  if (ringA.length !== ringB.length) return true;
  for (let i = 0; i < ringA.length; i++) {
    if (
      Math.abs(ringA[i][0] - ringB[i][0]) > tolerance ||
      Math.abs(ringA[i][1] - ringB[i][1]) > tolerance
    ) {
      return true;
    }
  }
  return false;
};

export const AuditStep1Identification: React.FC<Props> = ({
  isEditMode,
  formState,
  data,
  handleFieldChange,
  handleNestedFieldChange,
  handleApplySyncedGeometry,
  isFieldDirty,
  onOpenPhotoZoom,
  onOpenPhotoReplace,
  onOpenPhotoAction,
  onOpenPhotoHistory,
  stagedPhotoActions,
  onUndoPhotoAction,
  stagedPhotoRotations = {},
  onRotatePhoto,
  violationsMap,
}) => {
  const checkDirty = (fieldKey: string, subKey?: string) => {
    return isFieldDirty ? isFieldDirty(fieldKey, subKey) : false;
  };

  const getDirtyClass = (fieldKey: string, subKey?: string) => {
    return checkDirty(fieldKey, subKey)
      ? 'ring-2 ring-amber-400 border-amber-500 bg-amber-50/20'
      : '';
  };

  const renderDirtyBadge = (fieldKey: string, subKey?: string) => {
    if (checkDirty(fieldKey, subKey)) {
      return (
        <span className="ml-1.5 px-1 py-0.2 rounded text-[9px] font-bold text-amber-700 bg-amber-100 border border-amber-300 inline-block">
          Đã sửa
        </span>
      );
    }
    return null;
  };

  const sJson = data?.surveyJson || data?.survey_data_json || {};
  const rightPane = data?.rightPane || {};
  const identificationPhotos = rightPane.identificationPhotos || sJson.identificationPhotos || {};

  // Đánh giá chuẩn hóa thông tin địa chỉ theo Nghị quyết số 1685/NQ-UBTVQH15
  const addressEvaluation = useMemo(() => {
    const rawHn = formState.houseNumber || (typeof sJson.houseNumber === 'string' ? sJson.houseNumber : undefined) || (typeof data?.houseNumber === 'string' ? data.houseNumber : undefined);
    const rawStreet = formState.street || (typeof sJson.street === 'string' ? sJson.street : undefined) || (typeof data?.street === 'string' ? data.street : undefined);
    const rawWard = formState.ward || (typeof sJson.ward === 'string' ? sJson.ward : undefined) || (typeof data?.ward === 'string' ? data.ward : undefined);
    const rawDistrict = formState.district || (typeof sJson.district === 'string' ? sJson.district : undefined) || (typeof data?.district === 'string' ? data.district : undefined);
    const rawZoneId = data?.zoneId || data?.zone_id || (typeof sJson.zoneId === 'string' ? sJson.zoneId : undefined);

    return evaluateAddressStandard(rawHn, rawStreet, rawWard, rawDistrict, rawZoneId);
  }, [
    formState.houseNumber,
    formState.street,
    formState.ward,
    formState.district,
    sJson.houseNumber,
    sJson.street,
    sJson.ward,
    sJson.district,
    sJson.zoneId,
    data?.houseNumber,
    data?.street,
    data?.ward,
    data?.district,
    data?.zoneId,
    data?.zone_id,
  ]);

  // Case Type
  const caseType = formState.surveyCaseType || sJson.surveyCaseType || (data?.isRefusedOrAbsent ? 'ABSENTEE' : 'NORMAL');

  // P01: Biển số nhà
  const p01Raw = toPhotoObj(identificationPhotos.photoP01 || sJson.photoP01);
  const p01IsNa = Boolean(p01Raw.notApplicable ?? p01Raw.isNotApplicable);
  const p01Url = p01IsNa ? '' : (p01Raw.url || p01Raw.photoUrl || p01Raw.raw_photo_url || p01Raw.annotated_photo_url || '');

  // P02: Mặt đứng chính diện
  const p02Raw = toPhotoObj(identificationPhotos.photoP02 || sJson.photoP02);
  const p02IsNa = Boolean(p02Raw.notApplicable ?? p02Raw.isNotApplicable);
  const p02Url = p02IsNa ? '' : (p02Raw.url || p02Raw.photoUrl || p02Raw.raw_photo_url || p02Raw.annotated_photo_url || '');
  const p02PolygonPoints = p02Raw.polygonPoints || (sJson.facadeBoundaryGeojson as PolygonPoint[] | null) || (rightPane.facadeBoundaryGeojson as PolygonPoint[] | null) || null;
  const p02FloorSplits = p02Raw.floorSplits || null;

  // P03: Mặt bên / Mặt sau (Ảnh chính + tối đa 2 ảnh bổ sung -> max 3 ảnh P-03)
  const p03Raw = toPhotoObj(identificationPhotos.photoP03 || sJson.photoP03);
  const p03IsNa = Boolean(p03Raw.notApplicable ?? p03Raw.isNotApplicable);
  const p03Url = p03IsNa ? '' : (p03Raw.url || p03Raw.photoUrl || p03Raw.raw_photo_url || p03Raw.annotated_photo_url || '');
  const p03AdditionalPhotos = Array.isArray(p03Raw.additionalPhotos) ? p03Raw.additionalPhotos : [];

  // P04: Toàn cảnh tuyến phố
  const p04Raw = toPhotoObj(identificationPhotos.photoP04 || sJson.photoP04);
  const p04IsNa = Boolean(p04Raw.notApplicable ?? p04Raw.isNotApplicable);
  const p04Url = p04IsNa ? '' : (p04Raw.url || p04Raw.photoUrl || p04Raw.raw_photo_url || p04Raw.annotated_photo_url || '');

  // Các ảnh P-03 bổ sung mới thêm trong phiên (Optimistic ADD)
  const optimisticP03Extra = [
    ...getOptimisticAddedPhotos(stagedPhotoActions, {
      category: 'IDENTIFICATION',
      targetPhotoType: 'P03_EXTRA',
    }),
    ...getOptimisticAddedPhotos(stagedPhotoActions, {
      category: 'IDENTIFICATION',
      targetPhotoId: 'identificationPhotos.photoP03.additionalPhotos',
    }),
  ].filter((item, idx, self) => self.findIndex((t) => t.url === item.url && t.action === item.action) === idx);

  // Danh sách ảnh định danh ngoại quan linh hoạt (tối thiểu 4 ảnh, tối đa 6 ảnh)
  const dynamicPhotoList: DynamicPhotoItem[] = [
    {
      key: 'photoP01',
      code: 'P-01',
      label: 'Biển số nhà / Tên cơ quan',
      url: p01Url,
      photoCode: (p01Raw.photoCode as string) || 'P01',
      notApplicable: p01IsNa,
      naReason: p01Raw.naReason,
      historyCount: p01Raw.historyCount,
      hasHistory: p01Raw.hasHistory,
    },
    {
      key: 'photoP02',
      code: 'P-02',
      label: 'Mặt đứng chính diện (Facade)',
      url: p02Url,
      photoCode: (p02Raw.photoCode as string) || 'P02',
      polygonPoints: p02PolygonPoints,
      floorSplits: p02FloorSplits,
      notApplicable: p02IsNa,
      naReason: p02Raw.naReason,
      historyCount: p02Raw.historyCount,
      hasHistory: p02Raw.hasHistory,
    },
    {
      key: 'photoP03',
      code: p03Raw.photoCode || 'P-03_1',
      label: `Mặt bên / sau (${p03Raw.tag || 'Ảnh chính'})`,
      url: p03Url,
      photoCode: (p03Raw.photoCode as string) || 'P03',
      tag: p03Raw.tag || 'Bên hông',
      notApplicable: p03IsNa,
      naReason: p03Raw.naReason,
      historyCount: p03Raw.historyCount,
      hasHistory: p03Raw.hasHistory,
    },
    ...p03AdditionalPhotos.map((extra: string | IdentificationPhotoItemExtended, idx: number): DynamicPhotoItem => {
      const extraObj = typeof extra === 'string' ? { url: extra } : extra;
      const extraUrl = extraObj.url || extraObj.photoUrl || extraObj.raw_photo_url || '';
      return {
        key: `photoP03_extra_${idx}`,
        code: extraObj.photoCode || `P-03_${idx + 2}`,
        label: `Mặt bên / sau (${extraObj.tag || `Ảnh bổ sung ${idx + 1}`})`,
        url: extraUrl,
        photoCode: extraObj.photoCode,
        tag: extraObj.tag || `Bổ sung ${idx + 1}`,
        notApplicable: false,
        isExtra: true,
        extraIndex: idx,
        historyCount: extraObj.historyCount,
        hasHistory: extraObj.hasHistory,
      };
    }),
    ...optimisticP03Extra.map((added, addIdx): DynamicPhotoItem => {
      const idx = p03AdditionalPhotos.length + addIdx;
      return {
        key: `photoP03_extra_added_${addIdx}`,
        code: `P-03_${idx + 2}`,
        label: `Mặt bên / sau (Mới thêm #${addIdx + 1})`,
        url: added.url,
        photoCode: `P03_EXTRA_${idx + 1}`,
        tag: `Mới thêm ${addIdx + 1}`,
        notApplicable: false,
        isExtra: true,
        extraIndex: idx,
        isOptimisticAdded: true,
        optimisticAction: added.action,
      };
    }),
    {
      key: 'photoP04',
      code: 'P-04',
      label: 'Toàn cảnh tuyến phố & Không gian',
      url: p04Url,
      photoCode: (p04Raw.photoCode as string) || 'P04',
      notApplicable: p04IsNa,
      naReason: p04Raw.naReason,
      historyCount: p04Raw.historyCount,
      hasHistory: p04Raw.hasHistory,
    },
  ];

  // Các ảnh đặc thù theo loại hình khảo sát (ưu tiên đọc từ formState trước sJson)
  const vacantLandPhotos = ((formState.vacantLandPhotos as unknown[] | undefined) || sJson.vacantLandPhotos || []) as Array<string | { url?: string; photoUrl?: string; photoCode?: string; notes?: string }>;
  const underConstructionPhotos = ((formState.underConstructionPhotos as unknown[] | undefined) || sJson.underConstructionPhotos || []) as Array<string | { url?: string; photoUrl?: string; photoCode?: string; notes?: string }>;

  // Tọa độ GPS & Sai số
  const gpsCoords = (formState.gpsCoords || sJson.gpsCoords || formState.gpsLocation || {}) as {
    latitude?: number;
    lat?: number;
    longitude?: number;
    lng?: number;
    accuracy?: number;
  };
  const latDisplay = gpsCoords.latitude ?? gpsCoords.lat;
  const lngDisplay = gpsCoords.longitude ?? gpsCoords.lng;
  const accuracyDisplay = gpsCoords.accuracy;

  // 1. Trích xuất đa giác ranh đất từ CSDL PostGIS (cadastralGeojson)
  const postgisPolygonCoords = useMemo<[number, number][]>(() => {
    const rawGeojson = data?.cadastralGeojson || data?.cadastral_geojson;
    if (rawGeojson) {
      try {
        const parsed = typeof rawGeojson === 'string' ? JSON.parse(rawGeojson) : (rawGeojson as { type?: string; coordinates?: [number, number][][] });
        if (parsed && parsed.type === 'Polygon' && Array.isArray(parsed.coordinates?.[0])) {
          return normalizePolygonRing(parsed.coordinates[0].map(([lng, lat]: [number, number]) => [lat, lng]));
        }
      } catch (e) {
        console.warn('[AuditStep1] Failed to parse cadastralGeojson:', e);
      }
    }
    return [];
  }, [data?.cadastralGeojson, data?.cadastral_geojson]);

  // 2. Trích xuất đa giác ranh đất đang lưu trong hồ sơ khảo sát (formState hoặc sJson)
  const surveyPolygonCoords = useMemo<[number, number][]>(() => {
    if (Array.isArray(formState.parcelCoordinates) && formState.parcelCoordinates.length >= 3) {
      return normalizePolygonRing(formState.parcelCoordinates);
    }
    const rawSJsonCoords = (sJson.parcelCoordinates || sJson.polygonCoords) as [number, number][] | undefined;
    if (Array.isArray(rawSJsonCoords) && rawSJsonCoords.length >= 3) {
      return normalizePolygonRing(rawSJsonCoords);
    }
    return [];
  }, [formState.parcelCoordinates, sJson.parcelCoordinates, sJson.polygonCoords]);

  // 3. Phát hiện xung đột ranh GPMB giữa PostGIS và Survey JSON (TC-SPA-01 & TC-SPA-02)
  const hasGpmbBoundaryConflict = useMemo<boolean>(() => {
    if (postgisPolygonCoords.length < 3 || surveyPolygonCoords.length < 3) return false;
    return arePolygonsDifferent(postgisPolygonCoords, surveyPolygonCoords);
  }, [postgisPolygonCoords, surveyPolygonCoords]);

  // 4. Trích xuất tọa độ Polygon hiển thị trên bản đồ Step 1
  const parcelCoords = useMemo<[number, number][]>(() => {
    if (surveyPolygonCoords.length >= 3) {
      return surveyPolygonCoords;
    }
    if (postgisPolygonCoords.length >= 3) {
      return postgisPolygonCoords;
    }
    const rawCoords = data?.coordinates as [number, number][] | undefined;
    if (Array.isArray(rawCoords) && rawCoords.length >= 3) {
      return rawCoords;
    }
    if (Array.isArray(data?.parcelCoordinates) && data.parcelCoordinates.length >= 3) {
      return data.parcelCoordinates;
    }
    return [];
  }, [surveyPolygonCoords, postgisPolygonCoords, data?.coordinates, data?.parcelCoordinates]);

  // 5. Tính toán chỉ số cự ly Trước/Sau cho Popover So Sánh (TC-SPA-03)
  const [showDistanceDiffPopover, setShowDistanceDiffPopover] = useState<boolean>(false);

  const distanceDiffPreview = useMemo(() => {
    const targetCoords = postgisPolygonCoords.length >= 3 ? postgisPolygonCoords : parcelCoords;
    const newMetrics = calculateComprehensiveMetroSpatialMetrics(targetCoords);
    const oldMetroStr = formatDistanceDisplay(formState.metroOffsetDistance ?? sJson.metroOffsetDistance);
    const oldClearanceStr = formatDistanceDisplay(formState.clearanceOffsetDistance ?? sJson.clearanceOffsetDistance);
    const newMetroVal = newMetrics.distanceToCenterlineMeters !== undefined ? newMetrics.distanceToCenterlineMeters.toFixed(1) : '0.0';
    const newClearanceVal =
      newMetrics.outerBoundaryType === 'STATION_OUTLINE' && newMetrics.distanceToOuterBoundaryMeters !== null
        ? newMetrics.distanceToOuterBoundaryMeters.toFixed(1)
        : 'Không có ga trong khu vực';

    return {
      targetCoords,
      closestCenterVertex: newMetrics.closestCenterVertex,
      oldVertexCount: surveyPolygonCoords.length || parcelCoords.length,
      newVertexCount: targetCoords.length,
      oldMetroDisplay: oldMetroStr,
      newMetroDisplay: `${newMetroVal} m`,
      newMetroValue: newMetroVal,
      oldClearanceDisplay: oldClearanceStr,
      newClearanceDisplay: newClearanceVal === 'Không có ga trong khu vực' ? newClearanceVal : `${newClearanceVal} m`,
      newClearanceValue: newClearanceVal,
    };
  }, [
    postgisPolygonCoords,
    parcelCoords,
    surveyPolygonCoords.length,
    formState.metroOffsetDistance,
    formState.clearanceOffsetDistance,
    sJson.metroOffsetDistance,
    sJson.clearanceOffsetDistance,
  ]);

  // Định dạng địa chỉ chuẩn hóa mặc định theo mô hình 168 ĐVHC cấp xã TP.HCM
  const defaultStandardized168 = useMemo(() => {
    return formatStandardizedAddress168(
      addressEvaluation.suggested.houseNumber || formState.houseNumber,
      addressEvaluation.suggested.street || formState.street,
      addressEvaluation.suggested.ward || formState.ward
    );
  }, [
    addressEvaluation.suggested.houseNumber,
    addressEvaluation.suggested.street,
    addressEvaluation.suggested.ward,
    formState.houseNumber,
    formState.street,
    formState.ward,
  ]);

  const activeStandardizedAddress: string =
    typeof formState.standardizedAddress === 'string' && formState.standardizedAddress
      ? formState.standardizedAddress
      : defaultStandardized168;

  const [isAddressAccepted, setIsAddressAccepted] = useState<boolean>(() => {
    return Boolean(formState.standardizedAddress || sJson.standardizedAddress);
  });

  const handleAcceptAddress = (formattedAddress: string) => {
    setIsAddressAccepted(true);
    handleFieldChange('standardizedAddress', 'Địa chỉ chuẩn hóa A4 (168 ĐVHC)', formattedAddress);
  };

  const handleEditAddress = () => {
    setIsAddressAccepted(false);
  };

  const handleChangeStandardizedAddress = (val: string) => {
    handleFieldChange('standardizedAddress', 'Địa chỉ chuẩn hóa A4 (168 ĐVHC)', val);
  };

  // Mở Popover So sánh cự ly Trước/Sau khi bấm nút Đồng bộ trắc địa PostGIS
  const handleSyncFromGis = () => {
    setShowDistanceDiffPopover(true);
  };

  // Xác nhận áp dụng Ranh đất PostGIS & Cự ly mới (Ràng buộc 02: cập nhật tọa độ ranh, cự ly & đỉnh gần Metro nhất, bảo toàn diện tích & mặt tiền)
  const handleConfirmApplySyncedGeometry = () => {
    const { targetCoords, closestCenterVertex, newMetroValue, newClearanceValue } = distanceDiffPreview;
    if (handleApplySyncedGeometry) {
      handleApplySyncedGeometry(targetCoords, newMetroValue, newClearanceValue, closestCenterVertex);
    } else {
      handleFieldChange('parcelCoordinates', 'Tọa độ đa giác ranh thửa (PostGIS GPMB)', targetCoords);
      handleFieldChange('metroOffsetDistance', 'Cự ly tim hầm Metro (m)', newMetroValue);
      handleFieldChange('clearanceOffsetDistance', 'Cự ly đường bao ngoài / mép ga (m)', newClearanceValue);
      if (closestCenterVertex && closestCenterVertex.length >= 2) {
        handleFieldChange('gpsCoords', 'Tọa độ đỉnh ranh gần Metro nhất (PostGIS)', {
          lat: Number(closestCenterVertex[0]),
          latitude: Number(closestCenterVertex[0]),
          lng: Number(closestCenterVertex[1]),
          longitude: Number(closestCenterVertex[1]),
          accuracy: accuracyDisplay || 1.5,
        });
      }
      if (formState.keepKsvBoundaryConfirmed) {
        handleFieldChange('keepKsvBoundaryConfirmed', 'Xác nhận giữ ranh KSV thực địa', false);
      }
    }
    setShowDistanceDiffPopover(false);
  };

  // Adjacent Buildings Data (Đồng bộ hai chiều cả key 'note' của Phase 1 FE và 'notes' của Audit)
  const rawAdjacent = (formState.adjacentBuildings || sJson.adjacentBuildings || {
    left: { details: '', note: '' },
    right: { details: '', note: '' },
    back: { details: '', note: '' },
  }) as AdjacentBuildings & Record<string, { details?: string; note?: string; notes?: string }>;
  const adjacent: AdjacentBuildings = {
    left: {
      ...(rawAdjacent.left || {}),
      details: rawAdjacent.left?.details || '',
      note: rawAdjacent.left?.note ?? rawAdjacent.left?.notes ?? '',
    },
    right: {
      ...(rawAdjacent.right || {}),
      details: rawAdjacent.right?.details || '',
      note: rawAdjacent.right?.note ?? rawAdjacent.right?.notes ?? '',
    },
    back: {
      ...(rawAdjacent.back || {}),
      details: rawAdjacent.back?.details || '',
      note: rawAdjacent.back?.note ?? rawAdjacent.back?.notes ?? '',
    },
  };

  const handleAdjacentChange = (side: 'left' | 'right' | 'back', field: 'details' | 'note', value: string) => {
    const updatedSide = {
      ...(adjacent[side] || {}),
      [field]: value,
      ...(field === 'note' ? { notes: value } : {}),
    };
    const updated: AdjacentBuildings = {
      ...adjacent,
      [side]: updatedSide,
    };
    if (handleNestedFieldChange) {
      handleNestedFieldChange('adjacentBuildings', side, `Công trình liền kề (${side})`, updated[side]);
    } else {
      handleFieldChange('adjacentBuildings', 'Công trình liền kề', updated);
    }
  };

  return (
    <section id="step-1" className="scroll-mt-6 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 rounded-lg bg-sky-600 text-white font-mono font-black text-xs">
            Bước 01
          </span>
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-800">
              Định Danh Công Trình, Ngoại Quan P-01..P-04 & Tiếp Giáp Liền Kề
            </h3>
            <p className="text-[11px] text-slate-500">
              Nhận dạng pháp lý thửa đất, hiện trạng ngoại quan và nguy cơ chèn ép từ công trình lân cận
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditMode ? (
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Loại hình:</label>
              <select
                value={caseType}
                onChange={(e) => handleFieldChange('surveyCaseType', 'Loại hình khảo sát', e.target.value)}
                className="px-2 py-1 rounded-lg text-xs font-bold bg-amber-50 border border-amber-300 text-slate-800"
              >
                <option value="NORMAL">Nhà dân liền thổ thông thường</option>
                <option value="VACANT_LAND">Đất trống chưa xây dựng</option>
                <option value="UNDER_CONSTRUCTION">Công trình đang xây dựng dở dang</option>
                <option value="APARTMENT_CHILD">Căn hộ / Chung cư con</option>
                <option value="APARTMENT_PARENT">Tòa nhà chung cư tổng thể</option>
                <option value="ABSENTEE">Vắng mặt chủ hộ</option>
              </select>
            </div>
          ) : (
            caseType !== 'NORMAL' && (
              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                caseType === 'VACANT_LAND'
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : caseType === 'UNDER_CONSTRUCTION'
                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                  : caseType === 'ABSENTEE'
                  ? 'bg-purple-100 text-purple-800 border border-purple-300'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              }`}>
                {caseType === 'VACANT_LAND'
                  ? 'Đất Trống Chưa XD'
                  : caseType === 'UNDER_CONSTRUCTION'
                  ? 'Công Trình Đang XD'
                  : caseType === 'ABSENTEE'
                  ? 'Vắng Mặt Chủ Hộ'
                  : 'Chung Cư / Căn Hộ'}
              </span>
            )
          )}
          <Badge variant="default" size="sm">
            Mã Thửa: {formState.projectParcelCode || data?.projectParcelCode}
          </Badge>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* 1.1. BỘ ẢNH ĐỊNH DANH HIỆN TRƯỜNG (P-01 -> P-04) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-sky-600" />
              <span>
                1.1. Bộ Ảnh Định Danh Hiện Trường (Gồm{' '}
                {
                  dynamicPhotoList.filter((item) => {
                    if (item.isOptimisticAdded) return true;
                    const optRes = resolveOptimisticPhoto(item.url, stagedPhotoActions, {
                      category: 'IDENTIFICATION',
                      targetPhotoType: item.code.replace('-', ''),
                      targetPhotoId: item.isExtra ? 'identificationPhotos.photoP03.additionalPhotos' : item.key,
                      photoIndex: item.isExtra ? item.extraIndex : undefined,
                    });
                    return optRes.status !== 'DELETED' && Boolean(optRes.displayUrl);
                  }).length
                }{' '}
                ảnh hiệu lực)
              </span>
            </span>
            <span className="text-[11px] text-slate-400">Cuộn ngang để xem đầy đủ &bull; Click để soi ảnh</span>
          </div>

          <div className="flex flex-nowrap gap-4 overflow-x-auto pb-3 scrollbar-thin snap-x">
            {dynamicPhotoList.map((item) => {
              const optResult = item.isOptimisticAdded
                ? {
                    displayUrl: item.url,
                    isStaged: true,
                    stagedAction: item.optimisticAction || null,
                    status: 'ADDED' as const,
                  }
                : resolveOptimisticPhoto(item.url, stagedPhotoActions, {
                    category: 'IDENTIFICATION',
                    targetPhotoType: item.code.replace('-', ''),
                    targetPhotoId: item.isExtra ? 'identificationPhotos.photoP03.additionalPhotos' : item.key,
                    photoIndex: item.isExtra ? item.extraIndex : undefined,
                  });
              const isStagedDeleted = optResult.status === 'DELETED';
              const isEffectiveNa = Boolean(item.notApplicable || (!item.isExtra && isStagedDeleted));
              const effectiveNaReason =
                (isStagedDeleted ? (optResult.stagedAction?.naReason || optResult.stagedAction?.reason) : undefined) ||
                item.naReason ||
                'Đã loại khỏi hồ sơ thẩm định';
              const url = isStagedDeleted ? '' : optResult.displayUrl;
              const isStaged = optResult.isStaged;
              const stagedAction = optResult.stagedAction;
              const isStagedReplaced = optResult.status === 'REPLACED' || optResult.status === 'ADDED';
              const hasPolygon = item.key === 'photoP02' && item.polygonPoints && Array.isArray(item.polygonPoints) && item.polygonPoints.length >= 3;
              const rotation = stagedPhotoRotations[item.key] ?? stagedPhotoRotations[item.code] ?? 0;
              const violation = violationsMap?.get(item.key) || violationsMap?.get(item.code);
              const isMismatched = Boolean(violation) && !isStagedDeleted;
              const isStrict = violation?.isStrict ?? false;

              if (item.isExtra && isStagedDeleted) {
                return (
                  <div
                    key={item.key}
                    id={`audit-photo-card-${item.code}`}
                    className="w-[calc((100%-2rem)/2.5)] min-w-[280px] shrink-0 snap-start rounded-xl border border-dashed border-rose-300 bg-rose-50/80 p-3 flex flex-col items-center justify-center text-center gap-2 h-80 sm:h-96 shadow-2xs"
                  >
                    <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-rose-200 text-rose-800">
                      {item.code}
                    </span>
                    <span className="text-[11px] font-bold text-rose-700">
                      Đã xóa ảnh bổ sung • Chờ lưu
                    </span>
                    {onUndoPhotoAction && stagedAction && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUndoPhotoAction(stagedAction);
                        }}
                        className="px-2.5 py-1 bg-white hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-lg text-[10px] font-black shadow-2xs flex items-center gap-1 cursor-pointer"
                      >
                        <Undo2 className="w-3 h-3 text-rose-600" />
                        <span>Hoàn tác</span>
                      </button>
                    )}
                  </div>
                );
              }

              return (
                <div
                  key={item.key}
                  id={`audit-photo-card-${item.code}`}
                  className={`w-[calc((100%-2rem)/2.5)] min-w-[280px] shrink-0 snap-start group relative rounded-xl bg-slate-900/5 overflow-hidden flex flex-col h-80 sm:h-96 shadow-xs transition-all ${
                    isStagedDeleted
                      ? 'border-2 border-amber-400 bg-amber-50/40'
                      : isStagedReplaced
                      ? 'ring-2 ring-amber-400 border-2 border-amber-500 shadow-md'
                      : isMismatched
                      ? isStrict
                        ? 'border-2 border-amber-500 ring-4 ring-amber-500/30 shadow-md' // Bắt buộc: Line vàng đậm
                        : 'border-2 border-amber-400 ring-2 ring-amber-400/30 shadow-xs' // Khuyến nghị: Line vàng nhẹ
                      : 'border border-slate-200'
                  }`}
                >
                  <div
                    className="flex-1 bg-slate-950/90 relative cursor-pointer overflow-hidden flex items-center justify-center p-1.5"
                    onClick={() => {
                      if (url) {
                        const zoomTitle = isStagedReplaced
                          ? `${item.code} - ${item.label} (Chờ lưu Diff)`
                          : `${item.code} - ${item.label}`;
                        onOpenPhotoZoom(url, zoomTitle, item.key, rotation);
                      }
                    }}
                  >
                    {url ? (
                      <RotatableImageFrame
                        url={url}
                        alt={item.label}
                        rotation={rotation}
                        maxHeightPx={350}
                        className="w-full h-full"
                      >
                        {/* Lớp phủ đa giác SVG nếu có polygonPoints */}
                        {hasPolygon && (
                          <svg
                            className="absolute inset-0 w-full h-full pointer-events-none"
                            viewBox="0 0 100 100"
                            preserveAspectRatio="none"
                          >
                            <polygon
                              points={item.polygonPoints?.map((p: PolygonPoint) => `${(p.x ?? 0) * 100},${(p.y ?? 0) * 100}`).join(' ')}
                              fill="rgba(16, 185, 129, 0.25)"
                              stroke="#10b981"
                              strokeWidth="2"
                            />
                          </svg>
                        )}
                      </RotatableImageFrame>
                    ) : isEffectiveNa ? (
                      <div className="p-3 text-center text-slate-500 flex flex-col items-center justify-center gap-1.5 w-full h-full bg-slate-50 border border-dashed border-amber-300 rounded-lg">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200 shadow-2xs">
                          N/A - Không Áp Dụng {isStagedDeleted ? '(Chờ lưu)' : ''}
                        </span>
                        <p className="text-[11px] text-slate-700 font-medium line-clamp-2 px-2 text-center">
                          {effectiveNaReason}
                        </p>
                        {isStagedDeleted && onUndoPhotoAction && stagedAction ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUndoPhotoAction(stagedAction);
                            }}
                            className="mt-1 px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-black shadow-2xs flex items-center gap-1 cursor-pointer"
                          >
                            <Undo2 className="w-2.5 h-2.5 text-amber-700" />
                            <span>Hoàn tác</span>
                          </button>
                        ) : (
                          <span className="text-[9px] text-slate-400">
                            ● Vị trí ảnh này đã được đánh dấu N/A
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Chưa có ảnh</span>
                    )}

                    {/* Badge Mã ảnh góc trên bên trái */}
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-xs text-white font-mono font-bold text-[10px] flex items-center gap-1 z-10 pointer-events-none">
                      <span>{item.code}</span>
                      {hasPolygon && <span className="text-emerald-400 text-[9px]">● Polygon</span>}
                    </div>

                    {/* Badge Góc xoay nếu khác 0° */}
                    {rotation !== 0 && url && (
                      <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-amber-500/90 text-white font-mono font-bold text-[9px] z-10 pointer-events-none shadow-xs flex items-center gap-0.5">
                        <RotateCw className="w-2.5 h-2.5" />
                        <span>{rotation}°</span>
                      </div>
                    )}

                    {/* Badge Khuyến nghị xoay / Bắt buộc chuẩn A4 */}
                    {isMismatched && !isStagedReplaced && (
                      <div
                        className={`absolute top-8 left-2 z-10 px-1.5 py-0.5 rounded font-bold text-[9px] shadow-xs flex items-center gap-1 border pointer-events-none ${
                          isStrict
                            ? 'bg-amber-500 text-slate-950 border-amber-600'
                            : 'bg-amber-100 text-amber-900 border-amber-300'
                        }`}
                        title={
                          isStrict
                            ? `Bắt buộc chuẩn A4: Cần xoay sang khổ ${violation?.expectedOrientation || 'chuẩn'}`
                            : `Khuyến nghị: Nên xoay sang khổ ${violation?.expectedOrientation || 'chuẩn'}`
                        }
                      >
                        {isStrict ? (
                          <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                        ) : (
                          <Lightbulb className="w-2.5 h-2.5 shrink-0" />
                        )}
                        <span>{isStrict ? 'Cần xoay A4' : 'Khuyến nghị xoay'}</span>
                      </div>
                    )}

                    {/* Badge Optimistic Staged Action chờ Lưu Diff */}
                    {isStaged && isStagedReplaced && (
                      <div className="absolute top-8 left-2 z-20 flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500 text-white font-bold text-[9px] shadow-sm animate-pulse">
                        <Sparkles className="w-2.5 h-2.5 shrink-0" />
                        <span>{item.isOptimisticAdded ? 'Mới thêm' : 'Chờ lưu Diff'}</span>
                        {onUndoPhotoAction && stagedAction && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUndoPhotoAction(stagedAction);
                            }}
                            className="underline cursor-pointer hover:text-amber-100 flex items-center gap-0.5 ml-1"
                            title="Hoàn tác thay đổi"
                          >
                            <Undo2 className="w-2.5 h-2.5" /> Hoàn tác
                          </button>
                        )}
                      </div>
                    )}

                    {/* Glassmorphic Micro-toolbar góc trên bên phải */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-1.5 right-1.5 flex items-center gap-0.5 bg-black/60 hover:bg-black/80 backdrop-blur-xs rounded-lg p-0.5 shadow-sm z-20 transition-all"
                    >
                      {url && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const zoomTitle = isStagedReplaced
                              ? `${item.code} - ${item.label} (Chờ lưu Diff)`
                              : `${item.code} - ${item.label}`;
                            onOpenPhotoZoom(url, zoomTitle, item.key, rotation);
                          }}
                          className="p-1 rounded text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
                          title="Phóng to soi chi tiết"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {url && onRotatePhoto && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const nextRot = (rotation + 90) % 360;
                            onRotatePhoto(item.key, nextRot);
                          }}
                          className="p-1 rounded text-amber-300 hover:text-white hover:bg-amber-600 transition-colors cursor-pointer"
                          title={`Xoay ảnh 90° cùng chiều kim đồng hồ (Hiện tại: ${rotation}°)`}
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {onOpenPhotoHistory && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenPhotoHistory({
                              photoCode: item.photoCode || `HCM_M2_${item.code.replace('-', '')}`,
                              photoType: item.code.replace('-', ''),
                              photoTitle: `Ảnh định danh ${item.code} - ${item.label}`,
                              currentPhotoUrl: url,
                            });
                          }}
                          className="p-1 rounded text-violet-300 hover:text-white hover:bg-violet-600 transition-colors cursor-pointer"
                          title={`Xem lịch sử phiên bản ảnh ${item.code} (${item.historyCount || 1} bản)`}
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {isEditMode && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onOpenPhotoAction) {
                                onOpenPhotoAction({
                                  initialMode: 'REPLACE',
                                  category: 'IDENTIFICATION',
                                  targetPhotoType: item.code.replace('-', ''),
                                  targetPhotoId: item.isExtra ? 'identificationPhotos.photoP03.additionalPhotos' : item.key,
                                  photoIndex: item.isExtra ? item.extraIndex : undefined,
                                  currentPhotoUrl: url,
                                  photoTitle: `Ảnh định danh ${item.code} - ${item.label}`,
                                });
                              } else if (onOpenPhotoReplace) {
                                onOpenPhotoReplace({
                                  targetPhotoType: 'IDENTIFICATION_P',
                                  targetPhotoId: item.isExtra ? 'identificationPhotos.photoP03.additionalPhotos' : item.key,
                                  photoIndex: item.isExtra ? item.extraIndex : undefined,
                                  currentPhotoUrl: url,
                                  photoTitle: `Ảnh định danh ${item.code} - ${item.label}`,
                                });
                              }
                            }}
                            className="p-1 rounded text-sky-300 hover:text-white hover:bg-sky-600 transition-colors cursor-pointer"
                            title={item.notApplicable ? "Tải ảnh thay thế cho vị trí N/A này" : "Thay thế / cập nhật ảnh chuẩn M2"}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {onOpenPhotoAction && !item.notApplicable && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenPhotoAction({
                                  initialMode: 'DELETE',
                                  category: 'IDENTIFICATION',
                                  targetPhotoType: item.code.replace('-', ''),
                                  targetPhotoId: item.isExtra ? 'identificationPhotos.photoP03.additionalPhotos' : item.key,
                                  photoIndex: item.isExtra ? item.extraIndex : undefined,
                                  currentPhotoUrl: url,
                                  photoTitle: `Ảnh định danh ${item.code} - ${item.label}`,
                                });
                              }}
                              className="p-1 rounded text-rose-300 hover:text-white hover:bg-rose-600 transition-colors cursor-pointer"
                              title="Xóa / Không áp dụng (N/A)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Card Footer: Nhãn ảnh và Badge phiên bản gọn gàng */}
                  <div className="p-2 bg-white border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-700 truncate" title={item.label}>
                      {item.label}
                    </span>
                    {item.historyCount !== undefined && item.historyCount > 1 && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-violet-100 text-violet-700">
                        v{item.historyCount}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Khối Ảnh & Thông Tin Đặc Thù: Đất Trống / Công Trình Đang Xây Dựng / Căn Hộ */}
        {caseType === 'VACANT_LAND' && (
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-amber-900 block">
                Hiện Trạng Đất Trống (
                {Math.max(
                  0,
                  vacantLandPhotos.length +
                    getOptimisticAddedPhotos(stagedPhotoActions, {
                      category: 'OVERVIEW',
                      targetPhotoType: 'VACANT_LAND',
                      targetPhotoId: 'vacantLandPhotos',
                    }).length -
                    (stagedPhotoActions || []).filter(
                      (a) =>
                        a.action === 'DELETE' &&
                        (a.targetPhotoType === 'VACANT_LAND' || a.targetPhotoId === 'vacantLandPhotos')
                    ).length
                )}{' '}
                ảnh hiện trường)
              </span>
              <div className="flex items-center gap-2">
                {onOpenPhotoHistory && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenPhotoHistory({
                        photoType: 'VACANT_LAND',
                        photoTitle: 'Lịch sử ảnh hiện trạng đất trống',
                      })
                    }
                    className="px-2 py-0.5 rounded-lg bg-white border border-amber-300 text-amber-800 hover:bg-amber-50 font-bold text-[10px] flex items-center gap-1 shadow-2xs cursor-pointer"
                    title="Xem phả hệ & lịch sử khôi phục ảnh đất trống"
                  >
                    <History className="w-3 h-3 text-amber-600" />
                    <span>Lịch sử / Khôi phục</span>
                  </button>
                )}
                {isEditMode && onOpenPhotoAction && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenPhotoAction({
                        initialMode: 'ADD',
                        category: 'OVERVIEW',
                        targetPhotoType: 'VACANT_LAND',
                        targetPhotoId: 'vacantLandPhotos',
                        photoTitle: 'Bổ sung ảnh đất trống',
                      })
                    }
                    className="px-2 py-0.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Thêm Ảnh Đất Trống</span>
                  </button>
                )}
              </div>
            </div>
            {isEditMode ? (
              <div>
                <label className="text-[11px] font-bold text-amber-800 block mb-1">Ghi chú hiện trạng đất trống:</label>
                <textarea
                  rows={2}
                  value={formState.vacantLandNotes || sJson.vacantLandNotes || ''}
                  onChange={(e) => handleFieldChange('vacantLandNotes', 'Ghi chú đất trống', e.target.value)}
                  placeholder="Ghi chú hiện trạng đất trống (rào chắn, cỏ dại, vật liệu tập kết...)"
                  className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs"
                />
              </div>
            ) : (
              (formState.vacantLandNotes || sJson.vacantLandNotes) && (
                <p className="text-xs text-slate-700 italic">{formState.vacantLandNotes || sJson.vacantLandNotes}</p>
              )
            )}
            {(() => {
              const addedVacantPhotos = getOptimisticAddedPhotos(stagedPhotoActions, {
                category: 'OVERVIEW',
                targetPhotoType: 'VACANT_LAND',
                targetPhotoId: 'vacantLandPhotos',
              });
              const totalVacantCount = vacantLandPhotos.length + addedVacantPhotos.length;

              if (totalVacantCount === 0) {
                return (
                  <div className="p-3 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 text-center space-y-2">
                    <p className="text-[11px] text-amber-800 font-semibold italic">Chưa có ảnh hiện trạng đất trống nào trong hồ sơ</p>
                    <div className="flex items-center justify-center gap-2">
                      {isEditMode && onOpenPhotoAction && (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenPhotoAction({
                              initialMode: 'ADD',
                              category: 'OVERVIEW',
                              targetPhotoType: 'VACANT_LAND',
                              targetPhotoId: 'vacantLandPhotos',
                              photoTitle: 'Bổ sung ảnh đất trống',
                            })
                          }
                          className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] flex items-center gap-1 shadow-xs cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Thêm Ảnh Đất Trống</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <div className="flex flex-nowrap gap-4 overflow-x-auto pb-2.5 scrollbar-thin">
                  {vacantLandPhotos.map((vItem, idx: number) => {
                    const rawUrl = typeof vItem === 'string' ? vItem : (vItem?.url || vItem?.photoUrl || '');
                    const optResult = resolveOptimisticPhoto(rawUrl, stagedPhotoActions, {
                      category: 'OVERVIEW',
                      targetPhotoType: 'VACANT_LAND',
                      targetPhotoId: 'vacantLandPhotos',
                      photoIndex: idx,
                    });
                    const vUrl = optResult.displayUrl;
                    const isStaged = optResult.isStaged;
                    const stagedAction = optResult.stagedAction;
                    const isDeleted = optResult.status === 'DELETED';
                    const isReplaced = optResult.status === 'REPLACED';

                    const vKey = `vacantLand_${idx}`;
                    const vRot = stagedPhotoRotations[vKey] ?? 0;

                    if (isDeleted) {
                      return (
                        <div
                          key={idx}
                          id={`audit-photo-card-vacant-land-${idx}`}
                          className="w-[calc((100%-2rem)/2.5)] min-w-[240px] shrink-0 h-60 rounded-lg border border-dashed border-rose-300 bg-rose-50/80 p-3 flex flex-col items-center justify-center text-center gap-1.5"
                        >
                          <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold text-[10px]">
                            Đã xóa ảnh #{idx + 1} • Chờ lưu
                          </span>
                          {onUndoPhotoAction && stagedAction && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onUndoPhotoAction(stagedAction);
                              }}
                              className="px-2.5 py-1 bg-white hover:bg-rose-100 text-rose-800 border border-rose-300 rounded text-[10px] font-black shadow-2xs flex items-center gap-1 cursor-pointer"
                            >
                              <Undo2 className="w-3 h-3 text-rose-600" />
                              <span>Hoàn tác</span>
                            </button>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div
                        key={idx}
                        id={`audit-photo-card-vacant-land-${idx}`}
                        className={`w-[calc((100%-2rem)/2.5)] min-w-[240px] shrink-0 h-60 group relative rounded-lg overflow-hidden cursor-pointer transition-all bg-slate-950/90 flex items-center justify-center p-1 ${
                          isReplaced
                            ? 'border-2 border-amber-400 ring-2 ring-amber-400/30 shadow-md'
                            : 'border border-amber-200 hover:shadow-md'
                        }`}
                        onClick={() => onOpenPhotoZoom(vUrl, isReplaced ? `Ảnh đất trống ${idx + 1} (Chờ lưu Diff)` : `Ảnh đất trống ${idx + 1}`, vKey, vRot)}
                      >
                        <RotatableImageFrame
                          url={vUrl}
                          alt={`Đất trống ${idx + 1}`}
                          rotation={vRot}
                          maxHeightPx={225}
                          className="w-full h-full"
                        />
                        {onRotatePhoto && !isDeleted && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRotatePhoto(vKey, (vRot + 90) % 360, vUrl);
                            }}
                            className="absolute bottom-1 right-1 z-20 p-1 rounded bg-black/65 hover:bg-amber-600 text-amber-300 hover:text-white shadow-sm cursor-pointer"
                            title={`Xoay ảnh 90° (Hiện tại: ${vRot}°)`}
                          >
                            <RotateCw className="w-3 h-3" />
                          </button>
                        )}

                        {/* Optimistic Pending Badge */}
                        {isStaged && isReplaced && (
                          <div className="absolute top-1 left-1 z-20 flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500 text-white font-bold text-[9px] shadow-sm animate-pulse">
                            <Sparkles className="w-2.5 h-2.5 shrink-0" />
                            <span>Chờ lưu</span>
                            {onUndoPhotoAction && stagedAction && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUndoPhotoAction(stagedAction);
                                }}
                                className="underline cursor-pointer hover:text-amber-100 flex items-center gap-0.5"
                                title="Hoàn tác"
                              >
                                <Undo2 className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        )}

                        {/* Optimistic Deleted Overlay */}
                        {isStaged && isDeleted && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute inset-0 bg-rose-950/75 backdrop-blur-[2px] flex flex-col items-center justify-center gap-1 p-1 z-30"
                          >
                            <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white font-bold text-[9px] shadow-sm animate-pulse">
                              Đã đánh dấu Xóa
                            </span>
                            {onUndoPhotoAction && stagedAction && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUndoPhotoAction(stagedAction);
                                }}
                                className="px-2 py-0.5 bg-white text-rose-800 rounded text-[9px] font-black shadow-md flex items-center gap-1 cursor-pointer"
                              >
                                <Undo2 className="w-2.5 h-2.5 text-rose-600" />
                                <span>Hoàn tác</span>
                              </button>
                            )}
                          </div>
                        )}

                        <div className="absolute top-1 right-1 z-10 flex items-center gap-1">
                          {onOpenPhotoHistory && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenPhotoHistory({
                                  photoCode: `VACANT_LAND_${idx + 1}`,
                                  photoType: 'VACANT_LAND',
                                  photoTitle: `Ảnh đất trống #${idx + 1}`,
                                  currentPhotoUrl: vUrl,
                                });
                              }}
                              className="p-1 rounded bg-black/60 hover:bg-black/80 text-white text-[9px] shadow-sm cursor-pointer"
                              title="Lịch sử phiên bản ảnh này"
                            >
                              <History className="w-2.5 h-2.5" />
                            </button>
                          )}
                          {isEditMode && !isDeleted && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onOpenPhotoAction) {
                                    onOpenPhotoAction({
                                      initialMode: 'REPLACE',
                                      category: 'OVERVIEW',
                                      targetPhotoType: 'VACANT_LAND',
                                      targetPhotoId: 'vacantLandPhotos',
                                      photoIndex: idx,
                                      currentPhotoUrl: vUrl,
                                      photoTitle: `Ảnh đất trống #${idx + 1}`,
                                    });
                                  } else if (onOpenPhotoReplace) {
                                    onOpenPhotoReplace({
                                      targetPhotoType: 'VACANT_LAND',
                                      targetPhotoId: 'vacantLandPhotos',
                                      photoIndex: idx,
                                      currentPhotoUrl: vUrl,
                                      photoTitle: `Ảnh đất trống #${idx + 1}`,
                                    });
                                  }
                                }}
                                className="px-1.5 py-0.5 rounded bg-amber-600/90 hover:bg-amber-700 text-white font-bold text-[9px] flex items-center gap-0.5 shadow-sm"
                                title="Thay thế ảnh này"
                              >
                                <RefreshCw className="w-2.5 h-2.5" />
                                <span>Đổi ảnh</span>
                              </button>
                              {onOpenPhotoAction && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenPhotoAction({
                                      initialMode: 'DELETE',
                                      category: 'OVERVIEW',
                                      targetPhotoType: 'VACANT_LAND',
                                      targetPhotoId: 'vacantLandPhotos',
                                      photoIndex: idx,
                                      currentPhotoUrl: vUrl,
                                      photoTitle: `Ảnh đất trống #${idx + 1}`,
                                    });
                                  }}
                                  className="p-1 rounded bg-rose-600/90 hover:bg-rose-700 text-white text-[9px] shadow-sm"
                                  title="Xóa ảnh này"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Optimistic Added Photos */}
                  {addedVacantPhotos.map((item, addIdx) => (
                    <div
                      key={`added-vacant-${addIdx}`}
                      className="w-[calc((100%-2rem)/2.5)] min-w-[240px] shrink-0 h-60 group relative rounded-lg overflow-hidden border-2 border-emerald-500 ring-2 ring-emerald-500/30 cursor-pointer shadow-md bg-slate-950/90 flex items-center justify-center p-1"
                      onClick={() => onOpenPhotoZoom(item.url, `Ảnh đất trống mới bổ sung #${addIdx + 1} (Chờ lưu Diff)`)}
                    >
                      <RotatableImageFrame
                        url={item.url}
                        alt={`Đất trống mới ${addIdx + 1}`}
                        rotation={0}
                        maxHeightPx={225}
                        className="w-full h-full"
                      />
                      <div className="absolute top-1 left-1 z-20 flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-600 text-white font-bold text-[9px] shadow-sm animate-pulse">
                        <Sparkles className="w-2.5 h-2.5 shrink-0" />
                        <span>Mới thêm</span>
                        {onUndoPhotoAction && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUndoPhotoAction(item.action);
                            }}
                            className="underline cursor-pointer hover:text-emerald-100 flex items-center gap-0.5"
                            title="Hoàn tác"
                          >
                            <Undo2 className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {caseType === 'UNDER_CONSTRUCTION' && (
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-blue-900 block">
                Hiện Trạng Công Trình Đang Xây Dựng (
                {Math.max(
                  0,
                  underConstructionPhotos.length +
                    getOptimisticAddedPhotos(stagedPhotoActions, {
                      category: 'OVERVIEW',
                      targetPhotoType: 'UNDER_CONSTRUCTION',
                      targetPhotoId: 'underConstructionPhotos',
                    }).length -
                    (stagedPhotoActions || []).filter(
                      (a) =>
                        a.action === 'DELETE' &&
                        (a.targetPhotoType === 'UNDER_CONSTRUCTION' || a.targetPhotoId === 'underConstructionPhotos')
                    ).length
                )}{' '}
                ảnh hiện trường)
              </span>
              <div className="flex items-center gap-2">
                {onOpenPhotoHistory && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenPhotoHistory({
                        photoType: 'UNDER_CONSTRUCTION',
                        photoTitle: 'Lịch sử ảnh công trình đang thi công',
                      })
                    }
                    className="px-2 py-0.5 rounded-lg bg-white border border-blue-300 text-blue-800 hover:bg-blue-50 font-bold text-[10px] flex items-center gap-1 shadow-2xs cursor-pointer"
                    title="Xem phả hệ & lịch sử khôi phục ảnh thi công"
                  >
                    <History className="w-3 h-3 text-blue-600" />
                    <span>Lịch sử / Khôi phục</span>
                  </button>
                )}
                {isEditMode && onOpenPhotoAction && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenPhotoAction({
                        initialMode: 'ADD',
                        category: 'OVERVIEW',
                        targetPhotoType: 'UNDER_CONSTRUCTION',
                        targetPhotoId: 'underConstructionPhotos',
                        photoTitle: 'Bổ sung ảnh công trình đang thi công',
                      })
                    }
                    className="px-2 py-0.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Thêm Ảnh Thi Công</span>
                  </button>
                )}
              </div>
            </div>
            {isEditMode ? (
              <div>
                <label className="text-[11px] font-bold text-blue-800 block mb-1">Giai đoạn thi công hiện tại:</label>
                <textarea
                  rows={2}
                  value={formState.constructionStageNotes || sJson.constructionStageNotes || ''}
                  onChange={(e) => handleFieldChange('constructionStageNotes', 'Giai đoạn thi công', e.target.value)}
                  placeholder="Ghi chú giai đoạn thi công (đang ép cọc, thi công móng, đổ sàn tầng...)"
                  className="w-full p-2 bg-white border border-blue-300 rounded-lg text-xs"
                />
              </div>
            ) : (
              (formState.constructionStageNotes || sJson.constructionStageNotes) && (
                <p className="text-xs text-slate-700 italic">{formState.constructionStageNotes || sJson.constructionStageNotes}</p>
              )
            )}
            {(() => {
              const addedUnderConstructionPhotos = getOptimisticAddedPhotos(stagedPhotoActions, {
                category: 'OVERVIEW',
                targetPhotoType: 'UNDER_CONSTRUCTION',
                targetPhotoId: 'underConstructionPhotos',
              });
              const totalCount = underConstructionPhotos.length + addedUnderConstructionPhotos.length;

              if (totalCount === 0) {
                return (
                  <div className="p-3 rounded-lg border border-dashed border-blue-300 bg-blue-50/50 text-center space-y-2">
                    <p className="text-[11px] text-blue-800 font-semibold italic">Chưa có ảnh công trình thi công nào trong hồ sơ</p>
                    <div className="flex items-center justify-center gap-2">
                      {isEditMode && onOpenPhotoAction && (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenPhotoAction({
                              initialMode: 'ADD',
                              category: 'OVERVIEW',
                              targetPhotoType: 'UNDER_CONSTRUCTION',
                              targetPhotoId: 'underConstructionPhotos',
                              photoTitle: 'Bổ sung ảnh công trình đang thi công',
                            })
                          }
                          className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Thêm Ảnh Thi Công</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <div className="flex flex-nowrap gap-4 overflow-x-auto pb-2.5 scrollbar-thin">
                  {underConstructionPhotos.map((uItem, idx: number) => {
                    const rawUrl = typeof uItem === 'string' ? uItem : (uItem?.url || uItem?.photoUrl || '');
                    const optResult = resolveOptimisticPhoto(rawUrl, stagedPhotoActions, {
                      category: 'OVERVIEW',
                      targetPhotoType: 'UNDER_CONSTRUCTION',
                      targetPhotoId: 'underConstructionPhotos',
                      photoIndex: idx,
                    });
                    const uUrl = optResult.displayUrl;
                    const isStaged = optResult.isStaged;
                    const stagedAction = optResult.stagedAction;
                    const isDeleted = optResult.status === 'DELETED';
                    const isReplaced = optResult.status === 'REPLACED';

                    const uKey = `underConstruction_${idx}`;
                    const uRot = stagedPhotoRotations[uKey] ?? 0;

                    if (isDeleted) {
                      return (
                        <div
                          key={idx}
                          id={`audit-photo-card-under-construction-${idx}`}
                          className="w-[calc((100%-2rem)/2.5)] min-w-[240px] shrink-0 h-60 rounded-lg border border-dashed border-rose-300 bg-rose-50/80 p-3 flex flex-col items-center justify-center text-center gap-1.5"
                        >
                          <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold text-[10px]">
                            Đã xóa ảnh #{idx + 1} • Chờ lưu
                          </span>
                          {onUndoPhotoAction && stagedAction && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onUndoPhotoAction(stagedAction);
                              }}
                              className="px-2.5 py-1 bg-white hover:bg-rose-100 text-rose-800 border border-rose-300 rounded text-[10px] font-black shadow-2xs flex items-center gap-1 cursor-pointer"
                            >
                              <Undo2 className="w-3 h-3 text-rose-600" />
                              <span>Hoàn tác</span>
                            </button>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div
                        key={idx}
                        id={`audit-photo-card-under-construction-${idx}`}
                        className={`w-[calc((100%-2rem)/2.5)] min-w-[240px] shrink-0 h-60 group relative rounded-lg overflow-hidden cursor-pointer transition-all bg-slate-950/90 flex items-center justify-center p-1 ${
                          isReplaced
                            ? 'border-2 border-amber-400 ring-2 ring-amber-400/30 shadow-md'
                            : 'border border-blue-200 hover:shadow-md'
                        }`}
                        onClick={() => onOpenPhotoZoom(uUrl, isReplaced ? `Ảnh xây dựng dở dang ${idx + 1} (Chờ lưu Diff)` : `Ảnh xây dựng dở dang ${idx + 1}`, uKey, uRot)}
                      >
                        <RotatableImageFrame
                          url={uUrl}
                          alt={`Xây dựng dở dang ${idx + 1}`}
                          rotation={uRot}
                          maxHeightPx={225}
                          className="w-full h-full"
                        />
                        {onRotatePhoto && !isDeleted && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRotatePhoto(uKey, (uRot + 90) % 360, uUrl);
                            }}
                            className="absolute bottom-1 right-1 z-20 p-1 rounded bg-black/65 hover:bg-amber-600 text-amber-300 hover:text-white shadow-sm cursor-pointer"
                            title={`Xoay ảnh 90° (Hiện tại: ${uRot}°)`}
                          >
                            <RotateCw className="w-3 h-3" />
                          </button>
                        )}

                        {/* Optimistic Pending Badge */}
                        {isStaged && isReplaced && (
                          <div className="absolute top-1 left-1 z-20 flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500 text-white font-bold text-[9px] shadow-sm animate-pulse">
                            <Sparkles className="w-2.5 h-2.5 shrink-0" />
                            <span>Chờ lưu</span>
                            {onUndoPhotoAction && stagedAction && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUndoPhotoAction(stagedAction);
                                }}
                                className="underline cursor-pointer hover:text-amber-100 flex items-center gap-0.5"
                                title="Hoàn tác"
                              >
                                <Undo2 className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        )}

                        {/* Optimistic Deleted Overlay */}
                        {isStaged && isDeleted && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute inset-0 bg-rose-950/75 backdrop-blur-[2px] flex flex-col items-center justify-center gap-1 p-1 z-30"
                          >
                            <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white font-bold text-[9px] shadow-sm animate-pulse">
                              Đã đánh dấu Xóa
                            </span>
                            {onUndoPhotoAction && stagedAction && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUndoPhotoAction(stagedAction);
                                }}
                                className="px-2 py-0.5 bg-white text-rose-800 rounded text-[9px] font-black shadow-md flex items-center gap-1 cursor-pointer"
                              >
                                <Undo2 className="w-2.5 h-2.5 text-rose-600" />
                                <span>Hoàn tác</span>
                              </button>
                            )}
                          </div>
                        )}

                        <div className="absolute top-1 right-1 z-10 flex items-center gap-1">
                          {onOpenPhotoHistory && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenPhotoHistory({
                                  photoCode: `UNDER_CONSTRUCTION_${idx + 1}`,
                                  photoType: 'UNDER_CONSTRUCTION',
                                  photoTitle: `Ảnh xây dựng dở dang #${idx + 1}`,
                                  currentPhotoUrl: uUrl,
                                });
                              }}
                              className="p-1 rounded bg-black/60 hover:bg-black/80 text-white text-[9px] shadow-sm cursor-pointer"
                              title="Lịch sử phiên bản ảnh này"
                            >
                              <History className="w-2.5 h-2.5" />
                            </button>
                          )}
                          {isEditMode && !isDeleted && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onOpenPhotoAction) {
                                    onOpenPhotoAction({
                                      initialMode: 'REPLACE',
                                      category: 'OVERVIEW',
                                      targetPhotoType: 'UNDER_CONSTRUCTION',
                                      targetPhotoId: 'underConstructionPhotos',
                                      photoIndex: idx,
                                      currentPhotoUrl: uUrl,
                                      photoTitle: `Ảnh xây dựng dở dang #${idx + 1}`,
                                    });
                                  } else if (onOpenPhotoReplace) {
                                    onOpenPhotoReplace({
                                      targetPhotoType: 'UNDER_CONSTRUCTION',
                                      targetPhotoId: 'underConstructionPhotos',
                                      photoIndex: idx,
                                      currentPhotoUrl: uUrl,
                                      photoTitle: `Ảnh xây dựng dở dang #${idx + 1}`,
                                    });
                                  }
                                }}
                                className="px-1.5 py-0.5 rounded bg-blue-600/90 hover:bg-blue-700 text-white font-bold text-[9px] flex items-center gap-0.5 shadow-sm"
                                title="Thay thế ảnh này"
                              >
                                <RefreshCw className="w-2.5 h-2.5" />
                                <span>Đổi ảnh</span>
                              </button>
                              {onOpenPhotoAction && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenPhotoAction({
                                      initialMode: 'DELETE',
                                      category: 'OVERVIEW',
                                      targetPhotoType: 'UNDER_CONSTRUCTION',
                                      targetPhotoId: 'underConstructionPhotos',
                                      photoIndex: idx,
                                      currentPhotoUrl: uUrl,
                                      photoTitle: `Ảnh xây dựng dở dang #${idx + 1}`,
                                    });
                                  }}
                                  className="p-1 rounded bg-rose-600/90 hover:bg-rose-700 text-white text-[9px] shadow-sm"
                                  title="Xóa ảnh này"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Optimistic Added Photos */}
                  {addedUnderConstructionPhotos.map((item, addIdx) => (
                    <div
                      key={`added-uc-${addIdx}`}
                      className="w-[calc((100%-2rem)/2.5)] min-w-[240px] shrink-0 h-60 group relative rounded-lg overflow-hidden border-2 border-emerald-500 ring-2 ring-emerald-500/30 cursor-pointer shadow-md bg-slate-950/90 flex items-center justify-center p-1"
                      onClick={() => onOpenPhotoZoom(item.url, `Ảnh thi công mới bổ sung #${addIdx + 1} (Chờ lưu Diff)`)}
                    >
                      <RotatableImageFrame
                        url={item.url}
                        alt={`Thi công mới ${addIdx + 1}`}
                        rotation={0}
                        maxHeightPx={225}
                        className="w-full h-full"
                      />
                      <div className="absolute top-1 left-1 z-20 flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-600 text-white font-bold text-[9px] shadow-sm animate-pulse">
                        <Sparkles className="w-2.5 h-2.5 shrink-0" />
                        <span>Mới thêm</span>
                        {onUndoPhotoAction && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUndoPhotoAction(item.action);
                            }}
                            className="underline cursor-pointer hover:text-emerald-100 flex items-center gap-0.5"
                            title="Hoàn tác"
                          >
                            <Undo2 className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {caseType === 'APARTMENT_CHILD' && (
          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-3">
            <span className="text-xs font-black uppercase text-emerald-900 block">
              Thông Tin Định Danh Căn Hộ Con / Chung Cư
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-emerald-800 block mb-1">Mã căn hộ *</label>
                {isEditMode ? (
                  <input
                    type="text"
                    value={formState.unitCode || ''}
                    onChange={(e) => handleFieldChange('unitCode', 'Mã căn hộ', e.target.value)}
                    placeholder="VD: Căn 402, P.12B"
                    className="w-full p-1.5 bg-white border border-emerald-300 rounded font-bold"
                  />
                ) : (
                  <div className="p-1.5 bg-white rounded border border-emerald-200 font-bold">{formState.unitCode || '---'}</div>
                )}
              </div>
              <div>
                <label className="text-[11px] font-bold text-emerald-800 block mb-1">Số tầng căn hộ</label>
                {isEditMode ? (
                  <input
                    type="number"
                    value={formState.unitFloorNumber ?? ''}
                    onChange={(e) => handleFieldChange('unitFloorNumber', 'Tầng căn hộ', e.target.value ? Number(e.target.value) : '')}
                    placeholder="VD: 4"
                    className="w-full p-1.5 bg-white border border-emerald-300 rounded font-bold"
                  />
                ) : (
                  <div className="p-1.5 bg-white rounded border border-emerald-200 font-bold">{formState.unitFloorNumber !== undefined ? `Tầng ${formState.unitFloorNumber}` : '---'}</div>
                )}
              </div>
              <div>
                <label className="text-[11px] font-bold text-emerald-800 block mb-1">Đại diện BQL / Ban QT</label>
                {isEditMode ? (
                  <input
                    type="text"
                    value={formState.managementContactName || ''}
                    onChange={(e) => handleFieldChange('managementContactName', 'Liên hệ BQL', e.target.value)}
                    placeholder="VD: Nguyễn Văn A (Trưởng BQT)"
                    className="w-full p-1.5 bg-white border border-emerald-300 rounded font-bold"
                  />
                ) : (
                  <div className="p-1.5 bg-white rounded border border-emerald-200 font-bold">{formState.managementContactName || '---'}</div>
                )}
              </div>
              <div>
                <label className="text-[11px] font-bold text-emerald-800 block mb-1">SĐT Ban Quản Lý</label>
                {isEditMode ? (
                  <input
                    type="text"
                    value={formState.managementContactPhone || ''}
                    onChange={(e) => handleFieldChange('managementContactPhone', 'SĐT BQL', e.target.value)}
                    placeholder="VD: 0901234567"
                    className="w-full p-1.5 bg-white border border-emerald-300 rounded font-mono"
                  />
                ) : (
                  <div className="p-1.5 bg-white rounded border border-emerald-200 font-mono">{formState.managementContactPhone || '---'}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 1.2. THÔNG TIN ĐỊNH DANH CÔNG TRÌNH & ĐỊA CHỈ HÀNH CHÍNH */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
            <Building className="w-4 h-4 text-sky-700" />
            <span className="text-xs font-black uppercase text-slate-800">
              1.2. Thông Tin Định Danh Công Trình & Địa Chỉ Hành Chính
            </span>
          </div>

          {/* Gợi ý chuẩn hóa thông tin địa chỉ thông minh theo mô hình 168 ĐVHC cấp xã TP.HCM */}
          <SmartAddressSuggestionCard
            evaluation={addressEvaluation}
            zoneId={data?.zoneId || data?.zone_id || (typeof sJson.zoneId === 'string' ? sJson.zoneId : undefined)}
            isEditMode={isEditMode}
            standardizedAddressValue={activeStandardizedAddress}
            isAccepted={isAddressAccepted}
            onAccept={handleAcceptAddress}
            onEdit={handleEditAddress}
            onChangeStandardizedAddress={handleChangeStandardizedAddress}
            onApplyField={(fieldKey, label, val) => handleFieldChange(fieldKey, label, val)}
          />

          {/* Thông báo bảo lưu dữ liệu KSV khi đã Accept */}
          {isAddressAccepted && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Đã khóa 4 ô chi tiết:</strong> Dữ liệu gốc KSV nhập được bảo lưu 100% làm căn cứ pháp lý. Báo cáo PDF A4 sẽ sử dụng địa chỉ chuẩn hóa duy nhất ở trên. Bấm "Điều Chỉnh" nếu muốn sửa lại.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {/* Tên công trình */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Tên công trình / Tòa nhà {renderDirtyBadge('buildingName')}
              </label>
              {isEditMode ? (
                <input
                  type="text"
                  value={formState.buildingName || ''}
                  onChange={(e) => handleFieldChange('buildingName', 'Tên công trình', e.target.value)}
                  placeholder="VD: Nhà ở gia đình / Tòa nhà ABC"
                  className={`w-full px-2.5 py-1.5 rounded-lg font-bold ${getDirtyClass('buildingName') || 'bg-white border border-slate-300'}`}
                />
              ) : (
                <div className={`p-1.5 rounded-lg font-bold text-slate-800 ${getDirtyClass('buildingName') || 'bg-white border border-slate-200'}`}>
                  {formState.buildingName || sJson.buildingName || 'Nhà ở dân dụng'}
                </div>
              )}
            </div>

            {/* Số nhà */}
            <div className={`transition-all duration-200 ${isAddressAccepted ? 'opacity-40 pointer-events-none select-none' : 'opacity-100'}`}>
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Số nhà / Địa chỉ số * {renderDirtyBadge('houseNumber')}
              </label>
              {isEditMode ? (
                <input
                  type="text"
                  value={formState.houseNumber || ''}
                  onChange={(e) => handleFieldChange('houseNumber', 'Số nhà', e.target.value)}
                  className={`w-full px-2.5 py-1.5 rounded-lg font-black text-slate-900 ${getDirtyClass('houseNumber') || 'bg-white border border-amber-300'}`}
                />
              ) : (
                <div className={`p-1.5 rounded-lg font-black text-slate-900 ${getDirtyClass('houseNumber') || 'bg-white border border-slate-200'}`}>
                  {formState.houseNumber || '---'}
                </div>
              )}
            </div>

            {/* Tuyến đường */}
            <div className={`transition-all duration-200 ${isAddressAccepted ? 'opacity-40 pointer-events-none select-none' : 'opacity-100'}`}>
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Tuyến đường * {renderDirtyBadge('street')}
              </label>
              {isEditMode ? (
                <input
                  type="text"
                  value={formState.street || ''}
                  onChange={(e) => handleFieldChange('street', 'Tuyến đường', e.target.value)}
                  className={`w-full px-2.5 py-1.5 rounded-lg font-semibold ${getDirtyClass('street') || 'bg-white border border-slate-300'}`}
                />
              ) : (
                <div className={`p-1.5 rounded-lg font-semibold text-slate-800 ${getDirtyClass('street') || 'bg-white border border-slate-200'}`}>
                  {formState.street || '---'}
                </div>
              )}
            </div>

            {/* Phường */}
            <div className={`transition-all duration-200 ${isAddressAccepted ? 'opacity-40 pointer-events-none select-none' : 'opacity-100'}`}>
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Phường / Xã {renderDirtyBadge('ward')}
              </label>
              {isEditMode ? (
                <input
                  type="text"
                  value={formState.ward || ''}
                  onChange={(e) => handleFieldChange('ward', 'Phường/Xã', e.target.value)}
                  placeholder="VD: Phường 5"
                  className={`w-full px-2.5 py-1.5 rounded-lg font-semibold ${getDirtyClass('ward') || 'bg-white border border-slate-300'}`}
                />
              ) : (
                <div className={`p-1.5 rounded-lg font-semibold text-slate-800 ${getDirtyClass('ward') || 'bg-white border border-slate-200'}`}>
                  {formState.ward || sJson.ward || data?.ward || '---'}
                </div>
              )}
            </div>

            {/* Quận */}
            <div className={`transition-all duration-200 ${isAddressAccepted ? 'opacity-40 pointer-events-none select-none' : 'opacity-100'}`}>
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Quận / Huyện {renderDirtyBadge('district')}
              </label>
              {isEditMode ? (
                <input
                  type="text"
                  value={formState.district || ''}
                  onChange={(e) => handleFieldChange('district', 'Quận/Huyện', e.target.value)}
                  placeholder="VD: Quận Tân Bình"
                  className={`w-full px-2.5 py-1.5 rounded-lg font-semibold ${getDirtyClass('district') || 'bg-white border border-slate-300'}`}
                />
              ) : (
                <div className={`p-1.5 rounded-lg font-semibold text-slate-800 ${getDirtyClass('district') || 'bg-white border border-slate-200'}`}>
                  {formState.district || sJson.district || data?.district || '---'}
                </div>
              )}
            </div>

            {/* Chủ sở hữu */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Chủ sở hữu / Đại diện * {renderDirtyBadge('ownerName')}
              </label>
              {isEditMode ? (
                <input
                  type="text"
                  value={formState.ownerName || ''}
                  onChange={(e) => handleFieldChange('ownerName', 'Chủ sở hữu', e.target.value)}
                  className={`w-full px-2.5 py-1.5 rounded-lg font-bold ${getDirtyClass('ownerName') || 'bg-white border border-slate-300'}`}
                />
              ) : (
                <div className={`p-1.5 rounded-lg font-bold text-slate-800 ${getDirtyClass('ownerName') || 'bg-white border border-slate-200'}`}>
                  {formState.ownerName || '---'}
                </div>
              )}
            </div>

            {/* Số điện thoại */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Số điện thoại liên hệ {renderDirtyBadge('ownerPhone')}
              </label>
              {isEditMode ? (
                <input
                  type="text"
                  value={formState.ownerPhone || ''}
                  onChange={(e) => handleFieldChange('ownerPhone', 'SĐT chủ hộ', e.target.value)}
                  className={`w-full px-2.5 py-1.5 rounded-lg font-mono ${getDirtyClass('ownerPhone') || 'bg-white border border-slate-300'}`}
                />
              ) : (
                <div className={`p-1.5 rounded-lg font-mono text-slate-700 ${getDirtyClass('ownerPhone') || 'bg-white border border-slate-200'}`}>
                  {formState.ownerPhone || '---'}
                </div>
              )}
            </div>

            {/* Mã địa chính */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Mã thửa địa chính / Tờ bản đồ {renderDirtyBadge('officialCadastralCode')}
              </label>
              {isEditMode ? (
                <input
                  type="text"
                  value={formState.officialCadastralCode || ''}
                  onChange={(e) => handleFieldChange('officialCadastralCode', 'Mã địa chính', e.target.value)}
                  className={`w-full px-2.5 py-1.5 rounded-lg font-mono ${getDirtyClass('officialCadastralCode') || 'bg-white border border-slate-300'}`}
                />
              ) : (
                <div className={`p-1.5 rounded-lg font-mono text-slate-700 ${getDirtyClass('officialCadastralCode') || 'bg-white border border-slate-200'}`}>
                  {formState.officialCadastralCode || '---'}
                </div>
              )}
            </div>

            {/* Nhóm công trình */}
            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Nhóm công trình chịu tác động * {renderDirtyBadge('objectGroup')}
              </label>
              {isEditMode ? (
                <select
                  value={formState.objectGroup || 'GENERAL'}
                  onChange={(e) => handleFieldChange('objectGroup', 'Nhóm công trình', e.target.value)}
                  className={`w-full px-2.5 py-1.5 rounded-lg font-bold ${getDirtyClass('objectGroup') || 'bg-white border border-slate-300'}`}
                >
                  {OBJECT_GROUPS.map((og: { value: string; label: string; desc?: string }) => (
                    <option key={og.value} value={og.value}>
                      {og.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className={`p-1.5 rounded-lg ${getDirtyClass('objectGroup') || 'bg-white border border-slate-200'}`}>
                  <Badge variant={formState.objectGroup === 'CRITICAL' ? 'danger' : formState.objectGroup === 'IMPORTANT' ? 'warning' : 'success'}>
                    {OBJECT_GROUPS.find((g: { value: string; label: string; desc?: string }) => g.value === formState.objectGroup)?.label || 'Nhà dân thông thường'}
                  </Badge>
                </div>
              )}
            </div>

            {/* Công năng sử dụng */}
            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Công năng sử dụng thực tế * {renderDirtyBadge('usageFunction')}
              </label>
              {isEditMode ? (
                <select
                  value={formState.usageFunction || 'Nhà ở gia đình'}
                  onChange={(e) => handleFieldChange('usageFunction', 'Công năng sử dụng', e.target.value)}
                  className={`w-full px-2.5 py-1.5 rounded-lg font-bold ${getDirtyClass('usageFunction') || 'bg-white border border-slate-300'}`}
                >
                  {USAGE_OPTIONS.map((u: string) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              ) : (
                <div className={`p-1.5 rounded-lg font-bold text-slate-800 ${getDirtyClass('usageFunction') || 'bg-white border border-slate-200'}`}>
                  {formState.usageFunction || 'Nhà ở gia đình'}
                </div>
              )}
            </div>

            {/* Bề rộng mặt tiền */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Bề rộng mặt tiền (m) {renderDirtyBadge('frontageWidth')}
              </label>
              {isEditMode ? (
                <input
                  type="number"
                  step="0.01"
                  value={formState.frontageWidth ?? ''}
                  onChange={(e) => handleFieldChange('frontageWidth', 'Bề rộng mặt tiền', e.target.value ? Number(e.target.value) : '')}
                  placeholder="VD: 4.5"
                  className={`w-full px-2.5 py-1.5 rounded-lg font-mono font-bold ${getDirtyClass('frontageWidth') || 'bg-white border border-slate-300'}`}
                />
              ) : (
                <div className={`p-1.5 rounded-lg font-mono font-bold text-slate-800 ${getDirtyClass('frontageWidth') || 'bg-white border border-slate-200'}`}>
                  {formState.frontageWidth ? `${formState.frontageWidth} m` : '---'}
                </div>
              )}
            </div>

            {/* Chiều sâu thửa */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Chiều sâu thửa đất (m) {renderDirtyBadge('lotDepth')}
              </label>
              {isEditMode ? (
                <input
                  type="number"
                  step="0.01"
                  value={formState.lotDepth ?? ''}
                  onChange={(e) => handleFieldChange('lotDepth', 'Chiều sâu thửa', e.target.value ? Number(e.target.value) : '')}
                  placeholder="VD: 18.2"
                  className={`w-full px-2.5 py-1.5 rounded-lg font-mono font-bold ${getDirtyClass('lotDepth') || 'bg-white border border-slate-300'}`}
                />
              ) : (
                <div className={`p-1.5 rounded-lg font-mono font-bold text-slate-800 ${getDirtyClass('lotDepth') || 'bg-white border border-slate-200'}`}>
                  {formState.lotDepth ? `${formState.lotDepth} m` : '---'}
                </div>
              )}
            </div>

            {/* Diện tích khuôn viên */}
            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Diện tích khuôn viên đất (m²) {renderDirtyBadge('landAreaM2')}
              </label>
              {isEditMode ? (
                <input
                  type="number"
                  step="0.01"
                  value={formState.landAreaM2 ?? ''}
                  onChange={(e) => handleFieldChange('landAreaM2', 'Diện tích đất', e.target.value ? Number(e.target.value) : '')}
                  placeholder="VD: 81.9"
                  className={`w-full px-2.5 py-1.5 rounded-lg font-mono font-bold text-emerald-800 ${getDirtyClass('landAreaM2') || 'bg-white border border-slate-300'}`}
                />
              ) : (
                <div className={`p-1.5 rounded-lg font-mono font-bold text-emerald-700 ${getDirtyClass('landAreaM2') || 'bg-white border border-slate-200'}`}>
                  {formState.landAreaM2 ? `${formState.landAreaM2} m²` : '---'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 1.3. CỰ LY KHÔNG GIAN TRẮC ĐỊA & TỌA ĐỘ GPS TUYẾN METRO 2 */}
        <div className="p-4 rounded-xl bg-sky-50/60 border border-sky-200 space-y-3 relative">
          {/* BANNER CAM CẢNH BÁO XUNG ĐỘT RANH ĐẤT GPMB (TC-SPA-01 & TC-GAT-01/02) */}
          {hasGpmbBoundaryConflict && (
            <div className="p-3.5 rounded-xl bg-amber-50 border-2 border-amber-400 shadow-xs space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black uppercase text-amber-950">
                        Phát Hiện Lệch Ranh Đất GPMB / Nắn Chỉnh Trên Bản Đồ GIS PostGIS
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900 border border-amber-400">
                        KSV ({distanceDiffPreview.oldVertexCount} đỉnh) ≠ PostGIS ({distanceDiffPreview.newVertexCount} đỉnh)
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-900 mt-0.5">
                      Đa giác ranh thửa trên CSDL PostGIS đã được nắn chỉnh so với ranh khảo sát gốc trong hồ sơ. Vui lòng đồng bộ ranh PostGIS mới hoặc xác nhận giữ ranh KSV kèm lý do giải trình trước khi Phê duyệt.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDistanceDiffPopover(true)}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-black flex items-center gap-1.5 shrink-0 shadow-xs transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>1-Click Đồng Bộ Ranh Đất Đã Nắn Chỉnh</span>
                </button>
              </div>

              {/* Tuỳ chọn xác nhận giữ ranh KSV thực địa kèm giải trình >= 10 ký tự (TC-GAT-02) */}
              <div className="pt-2 border-t border-amber-200/80 flex flex-col sm:flex-row sm:items-center gap-2.5 text-xs">
                <label className="flex items-center gap-2 font-bold text-amber-950 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={Boolean(formState.keepKsvBoundaryConfirmed)}
                    onChange={(e) =>
                      handleFieldChange('keepKsvBoundaryConfirmed', 'Xác nhận giữ ranh KSV thực địa', e.target.checked)
                    }
                    className="rounded border-amber-400 text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <span>Xác nhận giữ ranh KSV thực địa (không áp dụng ranh PostGIS)</span>
                </label>
                {Boolean(formState.keepKsvBoundaryConfirmed) && (
                  <input
                    type="text"
                    value={String(formState.keepKsvBoundaryReason || '')}
                    onChange={(e) =>
                      handleFieldChange('keepKsvBoundaryReason', 'Lý do giải trình giữ ranh KSV', e.target.value)
                    }
                    placeholder="Nhập lý do giải trình kỹ thuật (tối thiểu 10 ký tự)..."
                    className="flex-1 px-2.5 py-1 rounded-lg bg-white border border-amber-400 text-xs font-semibold text-slate-800"
                  />
                )}
              </div>
            </div>
          )}

          {/* POPOVER SO SÁNH CỰ LY TRƯỚC / SAU KHI BẤM ĐỒNG BỘ (TC-SPA-03 & TC-SPA-04) */}
          {showDistanceDiffPopover && (
            <div className="p-4 rounded-xl bg-white border-2 border-sky-500 shadow-lg space-y-3 z-20">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-sky-600" />
                  <span className="text-xs font-black uppercase text-slate-900">
                    So Sánh Cự Ly Trắc Địa Trước / Sau Đồng Bộ PostGIS
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDistanceDiffPopover(false)}
                  className="px-2 py-0.5 text-xs font-bold text-slate-500 hover:text-slate-800 rounded cursor-pointer flex items-center gap-1"
                >
                  <span>Đóng</span>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Khoảng cách đến Tim hầm Metro 2
                  </span>
                  <div className="flex items-center gap-2 mt-1 font-mono">
                    <span className="text-slate-500 line-through">{distanceDiffPreview.oldMetroDisplay}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-sm font-black text-emerald-700">{distanceDiffPreview.newMetroDisplay}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Khoảng cách đến Mép ga / Đường bao ngoài
                  </span>
                  <div className="flex items-center gap-2 mt-1 font-mono">
                    <span className="text-slate-500 line-through">{distanceDiffPreview.oldClearanceDisplay}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-sm font-black text-emerald-700">{distanceDiffPreview.newClearanceDisplay}</span>
                  </div>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Bảo toàn chỉ số thực địa (Ràng buộc 02):</strong> Chỉ cập nhật tọa độ ranh (<code>parcelCoordinates</code>) và 2 cự ly Metro; giữ nguyên 100% <code>landAreaM2</code> ({formState.landAreaM2 || '---'} m²), <code>constructionAreaM2</code>, <code>frontageWidth</code> và <code>lotDepth</code>.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDistanceDiffPopover(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmApplySyncedGeometry}
                  className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-black flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Xác Nhận Áp Dụng Cự Ly & Ranh Mới</span>
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-black uppercase text-sky-950 flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-sky-700" />
              <span>1.3. Cự Ly Không Gian Trắc Địa & Tọa Độ GPS (Tuyến Metro Số 2)</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSyncFromGis}
                className="flex cursor-pointer items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-sky-800 bg-white border border-sky-300 rounded-lg hover:bg-sky-100 shadow-2xs transition-all active:scale-95"
                title="Mở bảng đối chiếu & đồng bộ cự ly tim hầm và mép ga trắng từ bản đồ GIS PostGIS"
              >
                <Navigation className="w-3.5 h-3.5 text-sky-600" />
                <span>Đồng bộ trắc địa PostGIS</span>
              </button>
              <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-2.5 py-0.5 rounded-full border border-sky-300">
                Có thể bù sai số GPS thủ công
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Khoảng cách đến tim tuyến */}
            <div className={`p-3 rounded-xl border ${getDirtyClass('metroOffsetDistance') || 'bg-white border-sky-200'}`}>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                Khoảng cách đến tim hầm Metro (m) * {renderDirtyBadge('metroOffsetDistance')}
              </label>
              {isEditMode ? (
                <input
                  type="number"
                  step="0.1"
                  value={getNumericValue(formState.metroOffsetDistance)}
                  onChange={(e) => handleFieldChange('metroOffsetDistance', 'Cự ly tim hầm Metro', e.target.value)}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-black text-sky-900 ${getDirtyClass('metroOffsetDistance') || 'bg-amber-50/40 border border-sky-300'}`}
                  placeholder="VD: 14.5"
                />
              ) : (
                <div className="text-base font-black text-sky-800 font-mono">
                  {formatDistanceDisplay(formState.metroOffsetDistance)}
                </div>
              )}
              <span className="text-[10px] text-slate-400 block mt-0.5">Khoảng cách đo đạc tới tim</span>
            </div>

            {/* Khoảng cách đến đường bao ngoài (Mép ga trắng / Mép hố đào) */}
            <div className={`p-3 rounded-xl border ${getDirtyClass('clearanceOffsetDistance') || 'bg-white border-sky-200'}`}>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                Khoảng cách đến đường bao ngoài (m) * {renderDirtyBadge('clearanceOffsetDistance')}
              </label>
              {isEditMode ? (
                <input
                  type="number"
                  step="0.1"
                  value={getNumericValue(formState.clearanceOffsetDistance)}
                  onChange={(e) => handleFieldChange('clearanceOffsetDistance', 'Cự ly đường bao ngoài', e.target.value)}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-black text-sky-900 ${getDirtyClass('clearanceOffsetDistance') || 'bg-amber-50/40 border border-sky-300'}`}
                  placeholder="VD: 5.2"
                />
              ) : (
                <div className="text-base font-black text-sky-800 font-mono flex items-center gap-2">
                  <span>{formatDistanceDisplay(formState.clearanceOffsetDistance)}</span>
                  {parseFloat(getNumericValue(formState.clearanceOffsetDistance)) === 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
                      Ga cán qua
                    </span>
                  )}
                </div>
              )}
              {parseFloat(getNumericValue(formState.clearanceOffsetDistance)) === 0 ? (
                <span className="text-[10px] text-red-600 font-bold flex items-center gap-1 mt-0.5">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span>Nhà ga cắt qua / Nằm trong phạm vi ga</span>
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Cự ly mép ga trắng / mép hố đào
                </span>
              )}
            </div>

            {/* Lý trình thi công */}
            <div className={`p-3 rounded-xl border ${getDirtyClass('chainage') || 'bg-white border-sky-200'}`}>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                Lý trình thi công (Chainage) {renderDirtyBadge('chainage')}
              </label>
              {isEditMode ? (
                <input
                  type="text"
                  value={formState.chainage || ''}
                  onChange={(e) => handleFieldChange('chainage', 'Lý trình', e.target.value)}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-800 ${getDirtyClass('chainage') || 'bg-amber-50/40 border border-sky-300'}`}
                  placeholder="VD: Km 0+450"
                />
              ) : (
                <div className="text-xs font-bold text-slate-800 font-mono">
                  {formState.chainage || '---'}
                </div>
              )}
              <span className="text-[10px] text-slate-400 block mt-0.5">Vị trí dọc tuyến hầm</span>
            </div>

            {/* Tọa độ GPS */}
            <div className={`p-3 rounded-xl border ${getDirtyClass('gpsCoords') || 'bg-white border-sky-200'}`}>
              <label className="text-[11px] font-bold text-slate-600 block mb-1 flex items-center gap-1">
                <Navigation className="w-3.5 h-3.5 text-sky-600" />
                <span>Tọa độ GPS thực địa</span> {renderDirtyBadge('gpsCoords')}
              </label>
              {isEditMode ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-slate-400">Lat:</span>
                    <input
                      type="number"
                      step="any"
                      value={latDisplay ?? ''}
                      onChange={(e) => {
                        const newLat = e.target.value ? Number(e.target.value) : '';
                        handleFieldChange('gpsCoords', 'Tọa độ GPS', {
                          ...gpsCoords,
                          lat: newLat,
                          latitude: newLat,
                        });
                      }}
                      className="w-full p-1 text-xs font-mono font-bold bg-amber-50 border border-amber-300 rounded"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-slate-400">Lng:</span>
                    <input
                      type="number"
                      step="any"
                      value={lngDisplay ?? ''}
                      onChange={(e) => {
                        const newLng = e.target.value ? Number(e.target.value) : '';
                        handleFieldChange('gpsCoords', 'Tọa độ GPS', {
                          ...gpsCoords,
                          lng: newLng,
                          longitude: newLng,
                        });
                      }}
                      className="w-full p-1 text-xs font-mono font-bold bg-amber-50 border border-amber-300 rounded"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-slate-400">±m:</span>
                    <input
                      type="number"
                      step="0.1"
                      value={accuracyDisplay ?? ''}
                      onChange={(e) => {
                        const newAcc = e.target.value ? Number(e.target.value) : '';
                        handleFieldChange('gpsCoords', 'Sai số GPS', {
                          ...gpsCoords,
                          accuracy: newAcc,
                        });
                      }}
                      placeholder="Sai số m"
                      className="w-full p-1 text-[11px] font-mono bg-white border border-slate-300 rounded"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-xs font-mono font-bold text-slate-800">
                    {latDisplay !== undefined && latDisplay !== null && lngDisplay !== undefined && lngDisplay !== null
                      ? `${Number(latDisplay).toFixed(6)}, ${Number(lngDisplay).toFixed(6)}`
                      : 'Chưa ghi nhận tọa độ GPS'}
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Độ chính xác: ±{accuracyDisplay || 0}m
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Trực quan hóa Bản đồ không gian trắc địa & Tim tuyến Metro 2 */}
          <AuditMetroSpatialVisualMap
            parcelCoordinates={parcelCoords}
            projectParcelCode={formState.projectParcelCode || data?.projectParcelCode}
            metroOffsetDistance={formState.metroOffsetDistance}
            clearanceOffsetDistance={formState.clearanceOffsetDistance}
            chainage={formState.chainage}
            gpsLocation={{
              lat: Number(latDisplay || 10.79241),
              lng: Number(lngDisplay || 106.71152),
              accuracy: Number(accuracyDisplay || 3.5),
            }}
          />
        </div>

        {/* 1.4. CÔNG TRÌNH LIỀN KỀ THEO CÁC HƯỚNG & ADJACENT RISK RADAR */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-black uppercase text-slate-800">
                1.4. Công Trình Liền Kề Theo Các Hướng (Adjacent Structures)
              </span>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Căn cứ tính chỉ số nhạy cảm V6</span>
            </span>
          </div>

          {/* SƠ ĐỒ TRỰC QUAN 2.5D: ADJACENT RISK RADAR */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
              Sơ Đồ Tiếp Giáp 3 Chiều Không Gian (Adjacent Risk Radar)
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-center text-xs">
              {/* Phía sau */}
              <div className="md:col-span-3 p-2 bg-slate-100/80 rounded-lg border border-slate-300 flex flex-col items-center justify-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Phía Sau (Rear / Back)</span>
                <span className="font-bold text-slate-800">
                  {adjacent.back?.details || 'Chưa ghi nhận'}
                </span>
                {adjacent.back?.note && (
                  <span className="text-[11px] text-slate-500 italic mt-0.5">"{adjacent.back.note}"</span>
                )}
              </div>

              {/* Bên trái */}
              <div className="p-2.5 bg-slate-100/80 rounded-lg border border-slate-300 flex flex-col items-center justify-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Bên Trái (Left)</span>
                <span className="font-bold text-slate-800">
                  {adjacent.left?.details || 'Chưa ghi nhận'}
                </span>
                {adjacent.left?.note && (
                  <span className="text-[11px] text-slate-500 italic mt-0.5">"{adjacent.left.note}"</span>
                )}
              </div>

              {/* Thửa đất khảo sát ở giữa */}
              <div className="p-3 bg-sky-100 rounded-lg border-2 border-sky-400 flex flex-col items-center justify-center shadow-xs">
                <span className="text-[10px] font-black text-sky-800 uppercase">Thửa Đang Khảo Sát</span>
                <span className="font-black text-sky-950 font-mono">
                  [{formState.projectParcelCode || data?.projectParcelCode || 'THỬA HIỆN TẠI'}]
                </span>
                <span className="text-[11px] font-bold text-sky-900 mt-0.5">
                  {formState.houseNumber} {formState.street}
                </span>
              </div>

              {/* Bên phải */}
              <div className="p-2.5 bg-slate-100/80 rounded-lg border border-slate-300 flex flex-col items-center justify-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Bên Phải (Right)</span>
                <span className="font-bold text-slate-800">
                  {adjacent.right?.details || 'Chưa ghi nhận'}
                </span>
                {adjacent.right?.note && (
                  <span className="text-[11px] text-slate-500 italic mt-0.5">"{adjacent.right.note}"</span>
                )}
              </div>

              {/* Mặt đường chính */}
              <div className="md:col-span-3 p-1.5 bg-slate-200/70 rounded-md border border-slate-300 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                ▲ Mặt Tiền Tuyến Đường / Tuyến Phố Chính ▲
              </div>
            </div>
          </div>

          {/* Form nhập/sửa hiện trạng tiếp giáp 3 phía */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Bên Trái */}
            <div className={`p-3 rounded-xl border space-y-2 ${getDirtyClass('adjacentBuildings', 'left') || 'bg-white border-slate-200'}`}>
              <label className="text-[11px] font-bold text-slate-700 block uppercase">
                Bên Trái (Theo hướng toà nhà) * {renderDirtyBadge('adjacentBuildings', 'left')}
              </label>
              {isEditMode ? (
                <>
                  <select
                    value={adjacent.left?.details || ''}
                    onChange={(e) => handleAdjacentChange('left', 'details', e.target.value)}
                    className="w-full p-2 bg-amber-50/40 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                  >
                    <option value="">--- Chọn hiện trạng bên trái ---</option>
                    {ADJACENT_LEFT_RIGHT.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={adjacent.left?.note || ''}
                    onChange={(e) => handleAdjacentChange('left', 'note', e.target.value)}
                    placeholder="Ghi chú chi tiết bên trái (khe lún, tường chung...)"
                    className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </>
              ) : (
                <div className="space-y-1">
                  <div className="text-xs font-bold text-slate-800">
                    {adjacent.left?.details || 'Chưa ghi nhận'}
                  </div>
                  <div className="text-[11px] text-slate-500 italic">
                    {adjacent.left?.note || 'Không có ghi chú bên trái.'}
                  </div>
                </div>
              )}
            </div>

            {/* Bên Phải */}
            <div className={`p-3 rounded-xl border space-y-2 ${getDirtyClass('adjacentBuildings', 'right') || 'bg-white border-slate-200'}`}>
              <label className="text-[11px] font-bold text-slate-700 block uppercase">
                Bên Phải (Theo hướng toà nhà) * {renderDirtyBadge('adjacentBuildings', 'right')}
              </label>
              {isEditMode ? (
                <>
                  <select
                    value={adjacent.right?.details || ''}
                    onChange={(e) => handleAdjacentChange('right', 'details', e.target.value)}
                    className="w-full p-2 bg-amber-50/40 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                  >
                    <option value="">--- Chọn hiện trạng bên phải ---</option>
                    {ADJACENT_LEFT_RIGHT.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={adjacent.right?.note || ''}
                    onChange={(e) => handleAdjacentChange('right', 'note', e.target.value)}
                    placeholder="Ghi chú chi tiết bên phải..."
                    className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </>
              ) : (
                <div className="space-y-1">
                  <div className="text-xs font-bold text-slate-800">
                    {adjacent.right?.details || 'Chưa ghi nhận'}
                  </div>
                  <div className="text-[11px] text-slate-500 italic">
                    {adjacent.right?.note || 'Không có ghi chú bên phải.'}
                  </div>
                </div>
              )}
            </div>

            {/* Phía Sau */}
            <div className={`p-3 rounded-xl border space-y-2 ${getDirtyClass('adjacentBuildings', 'back') || 'bg-white border-slate-200'}`}>
              <label className="text-[11px] font-bold text-slate-700 block uppercase">
                Phía Sau Tiếp Giáp * {renderDirtyBadge('adjacentBuildings', 'back')}
              </label>
              {isEditMode ? (
                <>
                  <select
                    value={adjacent.back?.details || ''}
                    onChange={(e) => handleAdjacentChange('back', 'details', e.target.value)}
                    className="w-full p-2 bg-amber-50/40 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                  >
                    <option value="">--- Chọn hiện trạng phía sau ---</option>
                    {ADJACENT_REAR.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={adjacent.back?.note || ''}
                    onChange={(e) => handleAdjacentChange('back', 'note', e.target.value)}
                    placeholder="Ghi chú chi tiết phía sau (hẻm, nhà kề...)"
                    className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </>
              ) : (
                <div className="space-y-1">
                  <div className="text-xs font-bold text-slate-800">
                    {adjacent.back?.details || 'Chưa ghi nhận'}
                  </div>
                  <div className="text-[11px] text-slate-500 italic">
                    {adjacent.back?.note || 'Không có ghi chú phía sau.'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
