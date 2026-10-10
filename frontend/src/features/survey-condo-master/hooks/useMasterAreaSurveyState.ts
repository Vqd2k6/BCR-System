import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { GisParcel, BuildingUnit } from '../../../core/types/domain.types';
import type { EvidencePhotoItem, DamageZoneData, StructuralElementData } from '../../survey-phase1/types/phase1.types';
import type { CadZonePin } from '../../../components/canvas/FloorCadPinningCanvas';
import type { DefectItem } from '../../../components/canvas/DefectPinningCanvas';
import { api } from '../../../services/api';
import { getErrorMessage } from '@/utils/errorUtils';
import { cropImageBoundingBox } from '../../../components/canvas/FloorPlanCadPartitionCanvas';
import { useAuth } from '../../../context/AuthContext';
import type { MetroWatermarkOptions } from '../../../utils/watermarkEngine';
import { isLocalBlobUri } from '../../../core/storage/offlinePhotoStorage';
import {
  type NormalizedBbox,
  type FloorPlanResponse,
  type FloorPlanItem,
  type FloorPartition,
  type AreaSurveySyncStatus,
  type PreFlightCheckItem,
  type PreFlightValidationResult,
  normalizeBbox,
  COMMON_ROOM_NAMES,
  ARCH_COMPONENT_TYPES,
  WALL_MATERIALS,
  STRUCTURAL_ELEMENT_TYPES,
  STRUCTURAL_MATERIALS,
} from '../types/masterAreaSurvey.types';
import { surveyDraftService, type DraftResponseData } from '../../survey-phase1/services/surveyDraftService';
import type { LockedInfo } from '../../survey-phase1/components/ActiveSurveyorLockedModal';
import type { HandoverInfo } from '../../survey-phase1/components/HandoverTakeoverModal';
import type { MasterAreaAbsentPayload } from '../components/master-area/MasterAreaAbsentModal';

interface UseMasterAreaSurveyStateProps {
  parcel: GisParcel;
  unit: BuildingUnit;
  onSurveyCompleted: () => void;
  readOnly?: boolean;
  floorCadUrl?: string;
  floorPlans?: FloorPlanItem[];
}

export function useMasterAreaSurveyState({
  parcel,
  unit,
  onSurveyCompleted,
  readOnly = false,
  floorCadUrl,
  floorPlans,
}: UseMasterAreaSurveyStateProps) {
  const { user: _user } = useAuth();
  const parcelId = parcel.id;
  const unitId = unit.id;
  const unitCode = unit.unit_code || unit.unitCode || 'MASTER-AREA';
  const floorNumber = unit.floor_number ?? unit.floorNumber ?? 1;

  const existingReportId = unit.phase1_report_id || unit.phase1ReportId;
  const isSurveyor = _user?.role === 'SURVEYOR';
  const isZoneAdmin = _user?.role === 'ZONE_ADMIN' || _user?.role === 'SUPER_ADMIN';
  const [serverReport, setServerReport] = useState<{ id: string; status: string; export_revision?: number } | null>(null);

  const isSubmittedOrApproved =
    unit.status === 'SUBMITTED' ||
    unit.status === 'APPROVED' ||
    serverReport?.status === 'SUBMITTED' ||
    serverReport?.status === 'APPROVED';

  // Triple-lock readOnly: Nếu đã nộp, Surveyor bắt buộc CHỈ ĐƯỢC XEM LẠI. Chỉ Zone Admin mới được điều chỉnh.
  const isReadOnly = Boolean(readOnly || (isSubmittedOrApproved && isSurveyor));
  const isZoneAdminAdjusting = Boolean(isSubmittedOrApproved && isZoneAdmin);

  // 5 BƯỚC KHẢO SÁT CHUẨN MỰC
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Floor CAD Data & Highlighting for Step 1
  const [floorPlanData, setFloorPlanData] = useState<FloorPlanResponse | null>(null);
  const [isLoadingCad, setIsLoadingCad] = useState<boolean>(true);
  const [_isLoadingReport, setIsLoadingReport] = useState<boolean>(Boolean(existingReportId));

  // Trạng thái đồng bộ (Cloud R2 vs Local Draft)
  const [syncStatus, setSyncStatus] = useState<AreaSurveySyncStatus>('SAVED_CLOUD');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  // Step 2 State: Overview Photos & Area CAD Setup
  const [overviewPhotos, setOverviewPhotos] = useState<EvidencePhotoItem[]>([]);
  const [cadSketchPhotoUrl, setCadSketchPhotoUrl] = useState<string>(
    unit.unitCadUrl || unit.unit_cad_url || ''
  );
  const [cadStructuralSketchPhotoUrl, setCadStructuralSketchPhotoUrl] = useState<string>('');
  const [useSeparateStructuralCad, setUseSeparateStructuralCad] = useState<boolean>(false);
  const [isCroppingCad, setIsCroppingCad] = useState<boolean>(false);
  const [customBbox, setCustomBbox] = useState<NormalizedBbox | null>(null);

  // Step 3 State: Damage Zones (Z) & Defects (D of Z)
  const [cadZonePins, setCadZonePins] = useState<CadZonePin[]>([]);
  const [zones, setZones] = useState<DamageZoneData[]>([
    {
      id: `zone_${Date.now()}_1`,
      zoneCode: 'Z-01',
      floorName: `Tầng ${floorNumber}`,
      roomName: 'Khu vực chính',
      componentType: ARCH_COMPONENT_TYPES[0] || 'Tường',
      wallMaterial: WALL_MATERIALS[0] || 'Sơn nước',
      overviewPhotos: [],
      notes: '',
      defects: [],
    },
  ]);
  const [activeZoneIndex, setActiveZoneIndex] = useState<number>(0);

  // Step 4 State: Structural Elements (E) & Defects (D of E)
  const [hasStructuralElements, setHasStructuralElements] = useState<boolean>(true);
  const [noStructuralElementsReason, setNoStructuralElementsReason] = useState<string>('');
  const [cadElementPins, setCadElementPins] = useState<CadZonePin[]>([]);
  const [structuralElements, setStructuralElements] = useState<StructuralElementData[]>([
    {
      id: `elem_${Date.now()}_1`,
      elementCode: 'E1',
      floorName: `Tầng ${floorNumber}`,
      roomName: 'Khu vực chính',
      elementType: STRUCTURAL_ELEMENT_TYPES[0] || 'Cột BTCT',
      materialType: STRUCTURAL_MATERIALS[0] || 'BTCT',
      overviewPhotos: [],
      notes: '',
      defects: [],
    },
  ]);
  const [activeElementIndex, setActiveElementIndex] = useState<number>(0);

  // Step 5 State: Summary, Burland calculation, Remarks
  const [surveyorRemarks, setSurveyorRemarks] = useState<string>('');
  const [surveyorSignatureUrl, setSurveyorSignatureUrl] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Modals phụ
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [pinningZoneId, setPinningZoneId] = useState<string | null>(null);
  const [pinningElementId, setPinningElementId] = useState<string | null>(null);
  const [isCadCropModalOpen, setIsCadCropModalOpen] = useState<boolean>(false);
  const [isPhotoAuditModalOpen, setIsPhotoAuditModalOpen] = useState<boolean>(false);

  // Concurrency Lock, Handover & Absence States
  const [isLockedByOther, setIsLockedByOther] = useState<boolean>(false);
  const [lockedInfo, setLockedInfo] = useState<LockedInfo | null>(null);
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState<boolean>(false);
  const [handoverInfo, setHandoverInfo] = useState<HandoverInfo | null>(null);
  const [isAbsentModalOpen, setIsAbsentModalOpen] = useState<boolean>(false);
  const [serverSyncVersion, setServerSyncVersion] = useState<number>(1);

  const draftKey = `master_area_draft_${parcelId}_${floorNumber}_${unitCode}`;
  const hasAutoCroppedRef = useRef<boolean>(false);

  // Refs theo dõi ảnh tạm blob:local:// để thay thế bằng Cloud URL chính thức khi upload xong
  const lastTempZoneUriRef = useRef<string | null>(null);
  const lastTempElementUriRef = useRef<string | null>(null);

  // Tọa độ GPS thực địa từ thiết bị của Khảo sát viên
  const [deviceGps, setDeviceGps] = useState<{ lat?: number; lng?: number; accuracy?: number }>({});

  useEffect(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDeviceGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        console.warn('[useMasterAreaSurveyState] Không thể lấy GPS thiết bị:', err?.message || err);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
    );
  }, []);

  // Xác định mã tầng chính thức (floor_code) tuân thủ 100% thiết lập trong CAD Studio
  const effectiveFloorCode = useMemo(() => {
    if (floorPlanData?.plan?.floor_code) return floorPlanData.plan.floor_code;
    if (floorPlans && floorPlans.length > 0) {
      const match = floorPlans.find((p) => p.floor_number === floorNumber);
      if (match?.floor_code) return match.floor_code;
    }
    if (unit.floor_code) return unit.floor_code;
    // Quy chuẩn fallback theo TCVN / QCVN nếu tầng chưa thiết lập CAD
    if (floorNumber === 0) return 'G';
    if (floorNumber < 0) return `B${String(Math.abs(floorNumber)).padStart(2, '0')}`;
    return `F${String(floorNumber).padStart(2, '0')}`;
  }, [floorPlanData?.plan?.floor_code, floorPlans, floorNumber, unit.floor_code]);

  // Cấu hình Watermark & Metadata pháp lý chuẩn Phase 1 kèm GPS & GIS
  const watermarkOptions: MetroWatermarkOptions = useMemo(() => {
    const bCode =
      parcel.projectParcelCode ||
      parcel.project_parcel_code ||
      parcel.officialCadastralCode ||
      parcel.official_cadastral_code ||
      'METRO2';

    // Trích xuất tọa độ tâm thửa đất từ coordinates [lng, lat]
    let gisLng: number | undefined;
    let gisLat: number | undefined;
    if (Array.isArray(parcel.coordinates) && parcel.coordinates.length > 0 && Array.isArray(parcel.coordinates[0])) {
      gisLng = parcel.coordinates[0][0];
      gisLat = parcel.coordinates[0][1];
    }

    return {
      parcelCode: bCode,
      buildingCode: bCode,
      floorCode: effectiveFloorCode,
      floor: effectiveFloorCode,
      unitCode: unitCode,
      zoneOrRoom: unitCode,
      areaType: 'MASTER_AREA',
      stationCode: (parcel as { stationCode?: string; station_code?: string }).stationCode ||
        (parcel as { stationCode?: string; station_code?: string }).station_code ||
        'ST02',
      timestamp: new Date(),
      gpsLat: deviceGps.lat,
      gpsLng: deviceGps.lng,
      gpsAccuracy: deviceGps.accuracy,
      gisLat,
      gisLng,
    };
  }, [parcel, effectiveFloorCode, unitCode, deviceGps]);

  // Nạp dữ liệu bản vẽ tầng mẹ
  useEffect(() => {
    let isSubscribed = true;
    const fetchFloorPlan = async () => {
      try {
        setIsLoadingCad(true);

        // 1. Kiểm tra props truyền sẵn từ BuildingHubModal
        if (floorCadUrl) {
          setFloorPlanData((prev) => ({
            plan: {
              id: 'prop-plan',
              cad_photo_url: floorCadUrl,
              floor_name: `Tầng ${floorNumber}`,
              floor_number: floorNumber,
            },
            units: prev?.units || [],
          }));
        }

        if (floorPlans && floorPlans.length > 0) {
          const matchedFromProp = floorPlans.find((p) => p.floor_number === floorNumber);
          if (matchedFromProp?.cad_photo_url) {
            setFloorPlanData((prev) => ({
              plan: {
                id: matchedFromProp.id,
                cad_photo_url: matchedFromProp.cad_photo_url,
                floor_name: matchedFromProp.floor_name || `Tầng ${floorNumber}`,
                floor_number: matchedFromProp.floor_number,
              },
              units: prev?.units || [],
            }));
          }
        }

        // 2. Thử gọi API tầng cụ thể
        try {
          const specificRes = await api.get(`/parcels/${parcelId}/floor-plans/${floorNumber}`);
          if (!isSubscribed) return;
          if (specificRes.data?.success && specificRes.data.data) {
            const data = specificRes.data.data;
            if (data.plan?.cad_photo_url) {
              setFloorPlanData({
                plan: data.plan,
                units: data.units || [],
              });
              const matchedUnit = data.units?.find(
                (u: FloorPartition) => u.unit_code === unitCode || u.id === unitId
              );
              if (matchedUnit?.unit_cad_url) {
                setCadSketchPhotoUrl((prev) => prev || matchedUnit.unit_cad_url || '');
              }
              setIsLoadingCad(false);
              return;
            }
          }
        } catch {
          // Bỏ qua lỗi fallback sang danh sách floor-plans
        }

        // 3. Fallback sang danh sách toàn thửa: /parcels/:id/floor-plans
        const res = await api.get(`/parcels/${parcelId}/floor-plans`);
        if (!isSubscribed) return;
        const plansList: FloorPlanItem[] = Array.isArray(res.data?.data)
          ? res.data.data
          : Array.isArray(res.data?.data?.plans)
          ? res.data.data.plans
          : [];

        if (plansList.length > 0) {
          const matchedPlan = plansList.find((p) => p.floor_number === floorNumber);
          if (matchedPlan?.cad_photo_url) {
            setFloorPlanData((prev) => ({
              plan: {
                id: matchedPlan.id,
                cad_photo_url: matchedPlan.cad_photo_url,
                floor_name: matchedPlan.floor_name || `Tầng ${floorNumber}`,
                floor_number: matchedPlan.floor_number,
              },
              units: prev?.units || [],
            }));
          }
        }
      } catch (err) {
        console.warn('[useMasterAreaSurveyState] Không thể nạp bản vẽ tầng:', err);
      } finally {
        if (isSubscribed) setIsLoadingCad(false);
      }
    };

    fetchFloorPlan();
    return () => {
      isSubscribed = false;
    };
  }, [parcelId, floorNumber, floorCadUrl, floorPlans, unitCode, unitId]);

  // Nạp báo cáo khảo sát đã có nếu có phase1_report_id hoặc fallback sang API parcel-unit
  useEffect(() => {
    let isSubscribed = true;
    const fetchExistingReport = async () => {
      try {
        setIsLoadingReport(true);
        const endpoint = existingReportId
          ? `/reports/phase1/${existingReportId}`
          : `/parcels/${parcelId}/phase1-report?unitId=${unitId}`;
        const res = await api.get(endpoint);
        if (isSubscribed && res.data?.success && res.data.data) {
          const rData = res.data.data?.report || res.data.data;
          if (rData && rData.id) {
            setServerReport({
              id: rData.id,
              status: rData.status,
              export_revision: rData.export_revision,
            });
            const sData = rData.survey_data_json || rData.surveyData || {};
            const fSurvey = sData.floorSurvey || (Array.isArray(sData.floors) ? sData.floors[0] : null) || {};

            if (Array.isArray(fSurvey.overviewPhotos) && fSurvey.overviewPhotos.length > 0) {
              setOverviewPhotos(fSurvey.overviewPhotos);
            }
            if (fSurvey.cadSketchPhotoUrl) {
              setCadSketchPhotoUrl(fSurvey.cadSketchPhotoUrl);
            }
            if (fSurvey.cadStructuralSketchPhotoUrl) {
              setCadStructuralSketchPhotoUrl(fSurvey.cadStructuralSketchPhotoUrl);
            }
            if (typeof fSurvey.useSeparateStructuralCad === 'boolean') {
              setUseSeparateStructuralCad(fSurvey.useSeparateStructuralCad);
            }
            if (Array.isArray(fSurvey.cadZonePins)) {
              setCadZonePins(fSurvey.cadZonePins);
            }
            if (Array.isArray(fSurvey.zones) && fSurvey.zones.length > 0) {
              setZones(fSurvey.zones);
            }
            if (typeof fSurvey.hasStructuralElements === 'boolean') {
              setHasStructuralElements(fSurvey.hasStructuralElements);
            }
            if (fSurvey.noStructuralElementsReason) {
              setNoStructuralElementsReason(fSurvey.noStructuralElementsReason);
            }
            if (Array.isArray(fSurvey.cadElementPins)) {
              setCadElementPins(fSurvey.cadElementPins);
            }
            if (Array.isArray(fSurvey.structuralElements) && fSurvey.structuralElements.length > 0) {
              setStructuralElements(fSurvey.structuralElements);
            }
            if (sData.surveyorRemarks) setSurveyorRemarks(sData.surveyorRemarks);
            if (sData.surveyorSignatureUrl) setSurveyorSignatureUrl(sData.surveyorSignatureUrl);
            setSyncStatus('SAVED_CLOUD');
            return;
          }
        }
      } catch (err) {
        console.warn('[useMasterAreaSurveyState] Lỗi nạp báo cáo cũ:', err);
      } finally {
        if (isSubscribed) setIsLoadingReport(false);
      }
    };
    fetchExistingReport();
    return () => {
      isSubscribed = false;
    };
  }, [existingReportId, parcelId, unitId]);

  // Khôi phục dữ liệu nháp vào State
  const applyDraftDataToState = useCallback((draft: Record<string, unknown>) => {
    if (Array.isArray(draft.overviewPhotos) && draft.overviewPhotos.length > 0) {
      setOverviewPhotos(draft.overviewPhotos as EvidencePhotoItem[]);
    }
    if (typeof draft.cadSketchPhotoUrl === 'string') {
      setCadSketchPhotoUrl(draft.cadSketchPhotoUrl);
    }
    if (typeof draft.cadStructuralSketchPhotoUrl === 'string') {
      setCadStructuralSketchPhotoUrl(draft.cadStructuralSketchPhotoUrl);
    }
    if (typeof draft.useSeparateStructuralCad === 'boolean') {
      setUseSeparateStructuralCad(draft.useSeparateStructuralCad);
    }
    if (Array.isArray(draft.cadZonePins)) {
      setCadZonePins(draft.cadZonePins as CadZonePin[]);
    }
    if (Array.isArray(draft.zones) && draft.zones.length > 0) {
      setZones(draft.zones as DamageZoneData[]);
    }
    if (typeof draft.hasStructuralElements === 'boolean') {
      setHasStructuralElements(draft.hasStructuralElements);
    }
    if (typeof draft.noStructuralElementsReason === 'string') {
      setNoStructuralElementsReason(draft.noStructuralElementsReason);
    }
    if (Array.isArray(draft.cadElementPins)) {
      setCadElementPins(draft.cadElementPins as CadZonePin[]);
    }
    if (Array.isArray(draft.structuralElements) && draft.structuralElements.length > 0) {
      setStructuralElements(draft.structuralElements as StructuralElementData[]);
    }
    if (typeof draft.surveyorRemarks === 'string') {
      setSurveyorRemarks(draft.surveyorRemarks);
    }
    if (draft.customBbox && typeof draft.customBbox === 'object') {
      setCustomBbox(draft.customBbox as NormalizedBbox);
    }
  }, []);

  // Tổng hợp khuyết tật và tính toán phân cấp Burland chủ đạo
  const allDefects = useMemo(() => {
    const zDefects = zones.flatMap((z) => z.defects || []);
    const eDefects = hasStructuralElements ? structuralElements.flatMap((e) => e.defects || []) : [];
    return [...zDefects, ...eDefects];
  }, [zones, structuralElements, hasStructuralElements]);

  const dominantBurlandGrade = useMemo(() => {
    if (allDefects.length === 0) return 0;
    let maxG = 0;
    for (const d of allDefects) {
      const g = typeof d.burlandGrade === 'number' ? d.burlandGrade : 0;
      if (g > maxG) maxG = g;
    }
    return Math.min(5, Math.max(0, maxG));
  }, [allDefects]);

  const burlandCounts = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0];
    for (const d of allDefects) {
      const g = typeof d.burlandGrade === 'number' ? Math.min(5, Math.max(0, d.burlandGrade)) : 0;
      counts[g]++;
    }
    return counts;
  }, [allDefects]);

  // Đóng gói payload nháp
  const buildDraftPayload = useCallback(() => {
    return {
      overviewPhotos,
      cadSketchPhotoUrl,
      cadStructuralSketchPhotoUrl,
      useSeparateStructuralCad,
      cadZonePins,
      zones,
      hasStructuralElements,
      noStructuralElementsReason,
      cadElementPins,
      structuralElements,
      surveyorRemarks,
      customBbox,
      dominantBurlandGrade,
      floorNumber,
      unitCode,
      unitName: unit.unit_name || unit.unitName || 'Khu vực dùng chung',
      unitType: 'MASTER',
      updatedAt: new Date().toISOString(),
    };
  }, [
    overviewPhotos,
    cadSketchPhotoUrl,
    cadStructuralSketchPhotoUrl,
    useSeparateStructuralCad,
    cadZonePins,
    zones,
    hasStructuralElements,
    noStructuralElementsReason,
    cadElementPins,
    structuralElements,
    surveyorRemarks,
    customBbox,
    dominantBurlandGrade,
    floorNumber,
    unitCode,
    unit.unit_name,
    unit.unitName,
  ]);

  // Phục hồi bản nháp cục bộ nếu chưa có bản nháp máy chủ
  const restoreLocalDraft = useCallback(() => {
    try {
      const savedRaw = localStorage.getItem(draftKey);
      if (savedRaw) {
        const draft = JSON.parse(savedRaw);
        if (draft && typeof draft === 'object') {
          applyDraftDataToState(draft);
          setSyncStatus('SAVED_LOCAL');
        }
      }
    } catch (err: unknown) {
      console.warn('[useMasterAreaSurveyState] Lỗi phục hồi bản nháp cục bộ:', err);
    }
  }, [draftKey, applyDraftDataToState]);

  // Khởi tạo: Truy vấn Cloud Draft trên máy chủ kèm kiểm tra khóa chống xung đột 2 người
  useEffect(() => {
    if (existingReportId || serverReport) return;
    let isMounted = true;

    surveyDraftService
      .fetchDraft(parcelId, unitId)
      .then((serverRes: DraftResponseData) => {
        if (!isMounted) return;

        // 1. Trường hợp có KSV khác đang mở khảo sát (< 15 phút) -> Kích hoạt khóa an toàn
        if (serverRes.isLocked) {
          setIsLockedByOther(true);
          setLockedInfo({
            surveyorName: serverRes.activeSurveyorName || 'Kỹ sư khác',
            phone: serverRes.activeSurveyorPhone,
            minutesAgo: serverRes.minutesAgo || 1,
            message: serverRes.message,
          });
          return;
        }

        // 2. Trường hợp KSV ca trước đã rời đi hoặc quá 15 phút -> Yêu cầu tiếp quản ca
        if (serverRes.requiresHandover) {
          setIsHandoverModalOpen(true);
          setHandoverInfo({
            fromSurveyorName: serverRes.fromSurveyorName || 'Kỹ sư ca trước',
            fromSurveyorPhone: serverRes.fromSurveyorPhone,
            currentStep: serverRes.currentStep || 1,
            securityCode: serverRes.securityCode || '',
            updatedAt: serverRes.updatedAt || '',
          });
          return;
        }

        // 3. Trường hợp có bản nháp hợp lệ trên server
        if (serverRes.draft && serverRes.draft.surveyData) {
          const draftData = serverRes.draft.surveyData as Record<string, unknown>;
          applyDraftDataToState(draftData);
          if (
            typeof serverRes.draft.currentStep === 'number' &&
            serverRes.draft.currentStep >= 1 &&
            serverRes.draft.currentStep <= 5
          ) {
            setCurrentStep(serverRes.draft.currentStep as 1 | 2 | 3 | 4 | 5);
          }
          if (serverRes.draft.syncVersion) {
            setServerSyncVersion(serverRes.draft.syncVersion);
          }
          setSyncStatus('SAVED_CLOUD');
          setLastSyncedAt(new Date(serverRes.draft.updatedAt || Date.now()).toLocaleTimeString('vi-VN'));
          setIsDirty(false);
        } else {
          // Fallback sang local draft nếu server chưa có
          restoreLocalDraft();
        }
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        console.warn('[useMasterAreaSurveyState] Không thể nạp server draft, dùng local:', err);
        restoreLocalDraft();
      });

    return () => {
      isMounted = false;
    };
  }, [parcelId, unitId, existingReportId, serverReport, applyDraftDataToState, restoreLocalDraft]);

  // Tự động lưu nháp cục bộ và Cloud Draft lên server (debounced 1500ms)
  // Khi saveDraft được gọi, server tự động cập nhật building_units.status = 'IN_PROGRESS'
  useEffect(() => {
    if (isReadOnly || isSubmittedOrApproved || isLockedByOther) return;

    const timeout = setTimeout(async () => {
      try {
        const draft = buildDraftPayload();
        // 1. Lưu cục bộ
        localStorage.setItem(draftKey, JSON.stringify(draft));
        setIsDirty(true);

        // 2. Đồng bộ Cloud Draft lên máy chủ để kích hoạt IN_PROGRESS và giữ khóa 15 phút
        const res = await surveyDraftService.saveDraft({
          parcelId,
          unitId,
          reportType: 'CONDO_UNIT',
          currentStep,
          surveyData: draft,
          syncVersion: serverSyncVersion,
        });

        if (res?.syncVersion) {
          setServerSyncVersion(res.syncVersion);
        }
        setSyncStatus('SAVED_CLOUD');
        setLastSyncedAt(new Date().toLocaleTimeString('vi-VN'));
        setIsDirty(false);
      } catch (err: unknown) {
        console.warn('[useMasterAreaSurveyState] Lỗi lưu nháp máy chủ:', err);
        setSyncStatus('SAVED_LOCAL');
      }
    }, 1500);

    return () => clearTimeout(timeout);
  }, [
    buildDraftPayload,
    draftKey,
    isReadOnly,
    isSubmittedOrApproved,
    isLockedByOther,
    parcelId,
    unitId,
    currentStep,
    serverSyncVersion,
  ]);

  // Giải phóng khóa ca khảo sát
  const handleReleaseLock = useCallback(async () => {
    if (isReadOnly || isSubmittedOrApproved || isLockedByOther) return;
    try {
      await surveyDraftService.releaseLock(parcelId, unitId);
    } catch (err: unknown) {
      console.warn('[useMasterAreaSurveyState] Lỗi giải phóng khóa:', err);
    }
  }, [parcelId, unitId, isReadOnly, isSubmittedOrApproved, isLockedByOther]);

  // Chủ động đóng modal: Giải phóng khóa và kích hoạt cập nhật lại Hub
  const handleClose = useCallback(async () => {
    await handleReleaseLock();
    onSurveyCompleted();
  }, [handleReleaseLock, onSurveyCompleted]);

  // KSV ca sau nhập mã 6 số để tiếp quản ca khảo sát
  const handleTakeoverDraft = useCallback(
    async (code: string, note?: string): Promise<boolean> => {
      try {
        const res = await surveyDraftService.takeoverDraft({
          parcelId,
          unitId,
          handoverCode: code,
          note,
        });

        if (res?.draft?.surveyData) {
          const draftData = res.draft.surveyData as Record<string, unknown>;
          applyDraftDataToState(draftData);
          if (
            typeof res.draft.currentStep === 'number' &&
            res.draft.currentStep >= 1 &&
            res.draft.currentStep <= 5
          ) {
            setCurrentStep(res.draft.currentStep as 1 | 2 | 3 | 4 | 5);
          }
          if (res.draft.syncVersion) {
            setServerSyncVersion(res.draft.syncVersion);
          }
          setSyncStatus('SAVED_CLOUD');
          setLastSyncedAt(new Date().toLocaleTimeString('vi-VN'));
          setIsDirty(false);
        }
        setIsHandoverModalOpen(false);
        setIsLockedByOther(false);
        return true;
      } catch (err: unknown) {
        console.error('[useMasterAreaSurveyState] Tiếp quản ca thất bại:', err);
        alert(`Tiếp quản ca thất bại: ${getErrorMessage(err)}`);
        return false;
      }
    },
    [parcelId, unitId, applyDraftDataToState]
  );

  // Ghi nhận khu vực tạm hoãn / vắng mặt / không tiếp cận được (POSTPONED_ABSENT)
  const handleRecordAbsence = useCallback(
    async (payload: MasterAreaAbsentPayload) => {
      try {
        const draft = buildDraftPayload();
        await api.post(`/parcels/${parcelId}/record-absence`, {
          unitId,
          absenceReason: payload.absenceReason,
          notes: payload.notes,
          photoProofUrl: payload.photoProofUrl || null,
          rescheduleDate: payload.rescheduleDate || null,
          surveyData: draft,
        });

        // Giải phóng lock
        await handleReleaseLock();

        // Xóa local draft
        localStorage.removeItem(draftKey);

        alert(`Đã ghi nhận tạm hoãn khảo sát cho khu vực ${unitCode}!`);
        setIsAbsentModalOpen(false);
        onSurveyCompleted();
      } catch (err: unknown) {
        console.error('[useMasterAreaSurveyState] Lỗi ghi nhận tạm hoãn:', err);
        alert(`Không thể ghi nhận tạm hoãn: ${getErrorMessage(err)}`);
      }
    },
    [parcelId, unitId, unitCode, draftKey, buildDraftPayload, handleReleaseLock, onSurveyCompleted]
  );

  // Bounding box của khu vực trên CAD tầng
  const activeBbox: NormalizedBbox | null = useMemo(() => {
    if (customBbox) return customBbox;
    const fromUnit = normalizeBbox(unit.cad_bbox) || normalizeBbox(unit.cadBbox);
    if (fromUnit) return fromUnit;
    if (floorPlanData?.units) {
      const matched = floorPlanData.units.find(
        (u) => u.id === unitId || u.unit_code === unitCode
      );
      if (matched?.cad_bbox) return normalizeBbox(matched.cad_bbox);
    }
    return null;
  }, [customBbox, unit, floorPlanData, unitId, unitCode]);

  const floorName = floorPlanData?.plan?.floor_name || `Tầng ${floorNumber}`;

  // =========================================================================
  // TỰ ĐỘNG CROP CAD NGẦM NẾU CHƯA CÓ VÀ ĐÃ CÓ BBOX
  // =========================================================================
  useEffect(() => {
    if (hasAutoCroppedRef.current) return;
    const parentCad = floorPlanData?.plan?.cad_photo_url || floorCadUrl;
    if (parentCad && activeBbox && !cadSketchPhotoUrl) {
      hasAutoCroppedRef.current = true;
      cropImageBoundingBox(parentCad, activeBbox, 0.05)
        .then((cropped) => {
          setCadSketchPhotoUrl((prev) => prev || cropped);
          if (!cadStructuralSketchPhotoUrl) {
            setCadStructuralSketchPhotoUrl((prev) => prev || cropped);
          }
        })
        .catch((err) => {
          console.warn('[useMasterAreaSurveyState] Auto crop ngầm không thành công:', err);
        });
    }
  }, [floorPlanData, floorCadUrl, activeBbox, cadSketchPhotoUrl, cadStructuralSketchPhotoUrl]);

  // =========================================================================
  // BƯỚC 2: SETUP BẢN VẼ CAD (TRÍCH XUẤT TỪ CAD TẦNG & TẢI MỚI)
  // =========================================================================
  const handleAutoCropFromFloorCad = async () => {
    const parentCadUrl = floorPlanData?.plan?.cad_photo_url || floorCadUrl;
    if (!parentCadUrl) {
      alert('Không tìm thấy bản vẽ CAD tầng mẹ để trích xuất!');
      return;
    }

    try {
      setIsCroppingCad(true);
      if (activeBbox) {
        const croppedDataUrl = await cropImageBoundingBox(parentCadUrl, activeBbox, 0.05);
        setCadSketchPhotoUrl(croppedDataUrl);
        if (!useSeparateStructuralCad) {
          setCadStructuralSketchPhotoUrl(croppedDataUrl);
        }
      } else {
        setCadSketchPhotoUrl(parentCadUrl);
        if (!useSeparateStructuralCad) {
          setCadStructuralSketchPhotoUrl(parentCadUrl);
        }
      }
      alert('Đã thiết lập bản vẽ khu vực thành công!');
    } catch (err) {
      console.error('[useMasterAreaSurveyState] Lỗi trích xuất CAD:', err);
      alert('Không thể trích xuất bản vẽ. Vui lòng sử dụng nút Tải ảnh/CAD riêng.');
    } finally {
      setIsCroppingCad(false);
    }
  };

  const handleConfirmCadCrop = (croppedDataUrl: string, newBbox: NormalizedBbox) => {
    setCadSketchPhotoUrl(croppedDataUrl);
    if (!useSeparateStructuralCad) {
      setCadStructuralSketchPhotoUrl(croppedDataUrl);
    }
    setCustomBbox(newBbox);
  };

  // Quản lý ảnh toàn cảnh khu vực (Bước 2): Tránh duplicate khi nhận Cloud URL
  const handleUpdateOrAddOverviewPhoto = useCallback((url: string, photoCode?: string) => {
    if (!url) return;
    setOverviewPhotos((prev) => {
      // 1. Nếu có photoCode truyền vào, kiểm tra xem đã có photo nào mang photoCode này chưa
      if (photoCode) {
        const foundIdx = prev.findIndex((p) => p.photoCode === photoCode);
        if (foundIdx >= 0) {
          const next = [...prev];
          next[foundIdx] = { ...next[foundIdx], url };
          return next;
        }
      }
      // 2. Thêm mới nếu chưa có
      const nextIdx = prev.length + 1;
      const code = photoCode || `P01_${unitCode}_${nextIdx}`;
      return [
        ...prev,
        {
          url,
          photoCode: code,
          notes: `Ảnh toàn cảnh ${unitCode} #${nextIdx}`,
        },
      ];
    });
  }, [unitCode]);

  const handleRemoveOverviewPhoto = (index: number) => {
    setOverviewPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // =========================================================================
  // BƯỚC 3: XỬ LÝ VÙNG KIẾN TRÚC Z & ĐỒNG BỘ 2 CHIỀU VỚI CAD PINS
  // =========================================================================
  const activeZone = zones[activeZoneIndex] || zones[0];

  const handleUpdateActiveZone = (updater: Partial<DamageZoneData>) => {
    setZones((prev) => {
      const next = [...prev];
      if (next[activeZoneIndex]) {
        next[activeZoneIndex] = { ...next[activeZoneIndex], ...updater };
      }
      return next;
    });
  };

  const handleAddZone = () => {
    const newIdx = zones.length + 1;
    const newZ: DamageZoneData = {
      id: `zone_${Date.now()}_${newIdx}`,
      zoneCode: `Z-${String(newIdx).padStart(2, '0')}`,
      floorName: `Tầng ${floorNumber}`,
      roomName: COMMON_ROOM_NAMES[Math.min(newIdx - 1, COMMON_ROOM_NAMES.length - 1)] || 'Vùng kiến trúc',
      componentType: activeZone?.componentType || ARCH_COMPONENT_TYPES[0] || 'Tường',
      wallMaterial: activeZone?.wallMaterial || WALL_MATERIALS[0] || 'Sơn nước',
      overviewPhotos: [],
      notes: '',
      defects: [],
    };
    setZones((prev) => [...prev, newZ]);
    setActiveZoneIndex(zones.length);
  };

  // Xóa tab ở thanh công cụ dưới -> Tự động xóa pin tương ứng trên CAD
  const handleDeleteZone = (index: number) => {
    if (zones.length <= 1) {
      alert('Phải giữ lại ít nhất 1 Vùng Z!');
      return;
    }
    const zoneToDelete = zones[index];
    if (!confirm(`Bạn có chắc muốn xóa Vùng ${zoneToDelete?.zoneCode}? Điểm ghim trên CAD cũng sẽ được gỡ bỏ.`)) return;

    // 1. Xóa khỏi mảng zones
    setZones((prev) => prev.filter((_, i) => i !== index));
    if (activeZoneIndex >= index && activeZoneIndex > 0) {
      setActiveZoneIndex(activeZoneIndex - 1);
    }

    // 2. Xóa ghim tương ứng trên CAD
    if (zoneToDelete?.zoneCode) {
      setCadZonePins((prev) => prev.filter((p) => p.zoneCode !== zoneToDelete.zoneCode));
    }
  };

  // Xóa pin trên CAD -> Tự động xóa tab tương ứng trong zones
  const handleDeleteZoneByCode = useCallback((zoneCode: string) => {
    setZones((prev) => {
      if (prev.length <= 1) {
        alert('Phải giữ lại ít nhất 1 Vùng Z trong danh sách!');
        return prev;
      }
      const targetIdx = prev.findIndex((z) => z.zoneCode === zoneCode);
      if (targetIdx < 0) return prev;

      const next = prev.filter((_, i) => i !== targetIdx);
      setActiveZoneIndex((curr) => {
        if (curr >= targetIdx && curr > 0) return curr - 1;
        return 0;
      });
      return next;
    });

    // Đồng bộ loại bỏ pin khỏi cadZonePins
    setCadZonePins((prev) => prev.filter((p) => p.zoneCode !== zoneCode));
  }, []);

  // Chọn pin trên CAD -> Tự động chuyển đến tab tương ứng
  const handleSelectZoneByCode = useCallback((zoneCode: string) => {
    setZones((prev) => {
      const idx = prev.findIndex((z) => z.zoneCode === zoneCode);
      if (idx >= 0) {
        setActiveZoneIndex(idx);
      }
      return prev;
    });
  }, []);

  const handleSyncMaterialsToEntireArea = () => {
    if (!activeZone) return;
    if (!activeZone.componentType && !activeZone.wallMaterial) {
      alert('Vui lòng chọn Cấu kiện hoặc Vật liệu trước khi đồng bộ!');
      return;
    }
    const remainingCount = zones.length - 1;
    if (
      !confirm(
        `Áp dụng cấu kiện "${activeZone.componentType}" và vật liệu "${activeZone.wallMaterial}" của ${activeZone.zoneCode} cho tất cả ${remainingCount} vùng còn lại trong khu vực?`
      )
    ) {
      return;
    }
    setZones((prev) =>
      prev.map((z, idx) =>
        idx === activeZoneIndex
          ? z
          : {
              ...z,
              componentType: activeZone.componentType,
              wallMaterial: activeZone.wallMaterial,
            }
      )
    );
    alert('Đã đồng bộ vật liệu cho toàn bộ các Vùng Z trong khu vực!');
  };

  // Quản lý ảnh tổng quan Vùng Z: Cơ chế thay thế ảnh tạm blob:local:// khi Cloud R2 upload hoàn tất
  const handleUpdateOrAddZoneOverviewPhoto = useCallback(
    (zoneIndex: number, url: string, _photoCode?: string) => {
      if (!url) return;
      setZones((prev) => {
        const next = [...prev];
        const targetZone = next[zoneIndex];
        if (!targetZone) return prev;
        let existing = [...(targetZone.overviewPhotos || [])];
        const prevTemp = lastTempZoneUriRef.current;

        // Nếu vừa chụp ảnh tạm và giờ nhận URL Cloudflare R2 chính thức
        if (prevTemp && existing.includes(prevTemp)) {
          existing = existing.map((p) => (p === prevTemp ? url : p));
          if (!isLocalBlobUri(url)) {
            lastTempZoneUriRef.current = null;
          }
        } else {
          // Thêm mới nếu chưa có trong mảng
          if (existing.includes(url)) return prev;
          existing.push(url);
          if (isLocalBlobUri(url)) {
            lastTempZoneUriRef.current = url;
          }
        }

        // Đồng bộ ảnh bối cảnh chính ctxPhotoUrl
        let newCtx = targetZone.ctxPhotoUrl;
        if (!newCtx || (prevTemp && newCtx === prevTemp)) {
          newCtx = url;
        }

        next[zoneIndex] = {
          ...targetZone,
          overviewPhotos: existing,
          ctxPhotoUrl: newCtx,
        };
        return next;
      });
    },
    []
  );

  const handleRemoveZoneOverviewPhoto = (zoneIndex: number, photoIndex: number) => {
    setZones((prev) => {
      const next = [...prev];
      const targetZone = next[zoneIndex];
      if (!targetZone) return prev;
      const deletedUrl = targetZone.overviewPhotos?.[photoIndex];
      const nextPhotos = (targetZone.overviewPhotos || []).filter((_, i) => i !== photoIndex);
      const newCtx =
        targetZone.ctxPhotoUrl === deletedUrl ? nextPhotos[0] || '' : targetZone.ctxPhotoUrl;
      next[zoneIndex] = { ...targetZone, overviewPhotos: nextPhotos, ctxPhotoUrl: newCtx };
      return next;
    });
  };

  // =========================================================================
  // BƯỚC 4: XỬ LÝ CẤU KIỆN KẾT CẤU E & ĐỒNG BỘ 2 CHIỀU VỚI CAD PINS
  // =========================================================================
  const activeElement = structuralElements[activeElementIndex] || structuralElements[0];

  const handleUpdateActiveElement = (updater: Partial<StructuralElementData>) => {
    setStructuralElements((prev) => {
      const next = [...prev];
      if (next[activeElementIndex]) {
        next[activeElementIndex] = { ...next[activeElementIndex], ...updater };
      }
      return next;
    });
  };

  const handleAddElement = () => {
    const newIdx = structuralElements.length + 1;
    const newElem: StructuralElementData = {
      id: `elem_${Date.now()}_${newIdx}`,
      elementCode: `E${newIdx}`,
      floorName: `Tầng ${floorNumber}`,
      roomName: 'Khu vực chính',
      elementType: activeElement?.elementType || STRUCTURAL_ELEMENT_TYPES[0] || 'Cột BTCT',
      materialType: activeElement?.materialType || STRUCTURAL_MATERIALS[0] || 'BTCT',
      overviewPhotos: [],
      notes: '',
      defects: [],
    };
    setStructuralElements((prev) => [...prev, newElem]);
    setActiveElementIndex(structuralElements.length);
  };

  // Xóa tab ở thanh công cụ dưới -> Tự động xóa pin tương ứng trên CAD
  const handleDeleteElement = (index: number) => {
    if (structuralElements.length <= 1) {
      alert('Phải giữ lại ít nhất 1 Cấu kiện E!');
      return;
    }
    const elemToDelete = structuralElements[index];
    if (!confirm(`Bạn có chắc muốn xóa Cấu kiện ${elemToDelete?.elementCode}? Điểm ghim trên CAD cũng sẽ được gỡ bỏ.`)) return;

    setStructuralElements((prev) => prev.filter((_, i) => i !== index));
    if (activeElementIndex >= index && activeElementIndex > 0) {
      setActiveElementIndex(activeElementIndex - 1);
    }

    if (elemToDelete?.elementCode) {
      setCadElementPins((prev) => prev.filter((p) => p.zoneCode !== elemToDelete.elementCode));
    }
  };

  // Xóa pin trên CAD -> Tự động xóa tab tương ứng trong structuralElements
  const handleDeleteElementByCode = useCallback((elementCode: string) => {
    setStructuralElements((prev) => {
      if (prev.length <= 1) {
        alert('Phải giữ lại ít nhất 1 Cấu kiện E trong danh sách!');
        return prev;
      }
      const targetIdx = prev.findIndex((e) => e.elementCode === elementCode);
      if (targetIdx < 0) return prev;

      const next = prev.filter((_, i) => i !== targetIdx);
      setActiveElementIndex((curr) => {
        if (curr >= targetIdx && curr > 0) return curr - 1;
        return 0;
      });
      return next;
    });

    setCadElementPins((prev) => prev.filter((p) => p.zoneCode !== elementCode));
  }, []);

  // Chọn pin trên CAD -> Tự động chuyển đến tab cấu kiện tương ứng
  const handleSelectElementByCode = useCallback((elementCode: string) => {
    setStructuralElements((prev) => {
      const idx = prev.findIndex((e) => e.elementCode === elementCode);
      if (idx >= 0) {
        setActiveElementIndex(idx);
      }
      return prev;
    });
  }, []);

  const handleSyncElementsToEntireArea = () => {
    if (!activeElement) return;
    if (!activeElement.elementType && !activeElement.materialType) {
      alert('Vui lòng chọn Loại cấu kiện hoặc Vật liệu trước khi đồng bộ!');
      return;
    }
    const remainingCount = structuralElements.length - 1;
    if (
      !confirm(
        `Áp dụng loại "${activeElement.elementType}" và vật liệu "${activeElement.materialType}" của ${activeElement.elementCode} cho tất cả ${remainingCount} cấu kiện còn lại?`
      )
    ) {
      return;
    }
    setStructuralElements((prev) =>
      prev.map((e, idx) =>
        idx === activeElementIndex
          ? e
          : {
              ...e,
              elementType: activeElement.elementType,
              materialType: activeElement.materialType,
            }
      )
    );
    alert('Đã đồng bộ thông số cho toàn bộ các Cấu kiện E trong khu vực!');
  };

  // Quản lý ảnh tổng quan Cấu kiện E: Cơ chế thay thế ảnh tạm blob:local:// khi Cloud R2 upload hoàn tất
  const handleUpdateOrAddElementOverviewPhoto = useCallback(
    (elemIndex: number, url: string, _photoCode?: string) => {
      if (!url) return;
      setStructuralElements((prev) => {
        const next = [...prev];
        const targetElem = next[elemIndex];
        if (!targetElem) return prev;
        let existing = [...(targetElem.overviewPhotos || [])];
        const prevTemp = lastTempElementUriRef.current;

        if (prevTemp && existing.includes(prevTemp)) {
          existing = existing.map((p) => (p === prevTemp ? url : p));
          if (!isLocalBlobUri(url)) {
            lastTempElementUriRef.current = null;
          }
        } else {
          if (existing.includes(url)) return prev;
          existing.push(url);
          if (isLocalBlobUri(url)) {
            lastTempElementUriRef.current = url;
          }
        }

        let newCtx = targetElem.ctxPhotoUrl;
        if (!newCtx || (prevTemp && newCtx === prevTemp)) {
          newCtx = url;
        }

        next[elemIndex] = {
          ...targetElem,
          overviewPhotos: existing,
          ctxPhotoUrl: newCtx,
        };
        return next;
      });
    },
    []
  );

  const handleRemoveElementOverviewPhoto = (elemIndex: number, photoIndex: number) => {
    setStructuralElements((prev) => {
      const next = [...prev];
      const targetElem = next[elemIndex];
      if (!targetElem) return prev;
      const deletedUrl = targetElem.overviewPhotos?.[photoIndex];
      const nextPhotos = (targetElem.overviewPhotos || []).filter((_, i) => i !== photoIndex);
      const newCtx =
        targetElem.ctxPhotoUrl === deletedUrl ? nextPhotos[0] || '' : targetElem.ctxPhotoUrl;
      next[elemIndex] = { ...targetElem, overviewPhotos: nextPhotos, ctxPhotoUrl: newCtx };
      return next;
    });
  };

  // =========================================================================
  // GẮN GHIM & DEFECT MODALS
  // =========================================================================
  const activePinningZone = useMemo(() => {
    return zones.find((z) => z.id === pinningZoneId) || null;
  }, [zones, pinningZoneId]);

  const activePinningElement = useMemo(() => {
    return structuralElements.find((e) => e.id === pinningElementId) || null;
  }, [structuralElements, pinningElementId]);

  const handleSaveZoneDefects = (defects: DefectItem[]) => {
    if (!pinningZoneId) return;
    setZones((prev) =>
      prev.map((z) => (z.id === pinningZoneId ? { ...z, defects } : z))
    );
    setPinningZoneId(null);
  };

  const handleSaveElementDefects = (defects: DefectItem[]) => {
    if (!pinningElementId) return;
    setStructuralElements((prev) =>
      prev.map((e) => (e.id === pinningElementId ? { ...e, defects } : e))
    );
    setPinningElementId(null);
  };

  // =========================================================================
  // KIỂM TOÁN VÀ ĐỒNG BỘ ẢNH (PHOTO AUDIT MODAL UPDATERS)
  // =========================================================================
  const handleUpdateOverviewPhotoUrl = useCallback((index: number, newUrl: string) => {
    setOverviewPhotos((prev) => {
      const next = [...prev];
      if (next[index]) next[index] = { ...next[index], url: newUrl };
      return next;
    });
  }, []);

  const handleUpdateCadSketchUrl = useCallback((newUrl: string) => {
    setCadSketchPhotoUrl(newUrl);
  }, []);

  const handleUpdateCadStructuralSketchUrl = useCallback((newUrl: string) => {
    setCadStructuralSketchPhotoUrl(newUrl);
  }, []);

  const handleUpdateZoneOverviewPhotoUrl = useCallback(
    (zoneIndex: number, photoIndex: number, newUrl: string) => {
      setZones((prev) => {
        const next = [...prev];
        const target = next[zoneIndex];
        if (target && target.overviewPhotos && target.overviewPhotos[photoIndex] !== undefined) {
          const nextPhotos = [...target.overviewPhotos];
          nextPhotos[photoIndex] = newUrl;
          next[zoneIndex] = { ...target, overviewPhotos: nextPhotos };
        }
        return next;
      });
    },
    []
  );

  const handleUpdateZoneDefectPhotoUrl = useCallback(
    (zoneIndex: number, defectIndex: number, field: string, newUrl: string) => {
      setZones((prev) => {
        const next = [...prev];
        const target = next[zoneIndex];
        if (target && target.defects && target.defects[defectIndex]) {
          const nextDefs = [...target.defects];
          nextDefs[defectIndex] = {
            ...nextDefs[defectIndex],
            [field]: newUrl,
          };
          next[zoneIndex] = { ...target, defects: nextDefs };
        }
        return next;
      });
    },
    []
  );

  const handleUpdateElementOverviewPhotoUrl = useCallback(
    (elemIndex: number, photoIndex: number, newUrl: string) => {
      setStructuralElements((prev) => {
        const next = [...prev];
        const target = next[elemIndex];
        if (target && target.overviewPhotos && target.overviewPhotos[photoIndex] !== undefined) {
          const nextPhotos = [...target.overviewPhotos];
          nextPhotos[photoIndex] = newUrl;
          next[elemIndex] = { ...target, overviewPhotos: nextPhotos };
        }
        return next;
      });
    },
    []
  );

  const handleUpdateElementDefectPhotoUrl = useCallback(
    (elemIndex: number, defectIndex: number, field: string, newUrl: string) => {
      setStructuralElements((prev) => {
        const next = [...prev];
        const target = next[elemIndex];
        if (target && target.defects && target.defects[defectIndex]) {
          const nextDefs = [...target.defects];
          nextDefs[defectIndex] = {
            ...nextDefs[defectIndex],
            [field]: newUrl,
          };
          next[elemIndex] = { ...target, defects: nextDefs };
        }
        return next;
      });
    },
    []
  );

  // Thống kê tài nguyên ảnh (Số lượng đã lên Cloud R2 vs Chưa lên)
  const photoAuditStats = useMemo(() => {
    let total = 0;
    let synced = 0;

    const check = (url?: string | null) => {
      if (!url || typeof url !== 'string' || !url.trim()) return;
      total++;
      if (
        (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/uploads')) &&
        !url.startsWith('blob:')
      ) {
        synced++;
      }
    };

    overviewPhotos.forEach((p) => check(p.url));
    check(cadSketchPhotoUrl);
    if (useSeparateStructuralCad) check(cadStructuralSketchPhotoUrl);

    zones.forEach((z) => {
      (z.overviewPhotos || []).forEach((photoUrl) => check(photoUrl));
      (z.defects || []).forEach((d) => {
        check(d.cuPhotoUrl);
        check(d.macroPhotoUrl);
      });
    });

    if (hasStructuralElements) {
      structuralElements.forEach((e) => {
        (e.overviewPhotos || []).forEach((photoUrl) => check(photoUrl));
        (e.defects || []).forEach((d) => {
          check(d.cuPhotoUrl);
          check(d.macroPhotoUrl);
        });
      });
    }

    return {
      total,
      synced,
      unsynced: total - synced,
    };
  }, [
    overviewPhotos,
    cadSketchPhotoUrl,
    cadStructuralSketchPhotoUrl,
    useSeparateStructuralCad,
    zones,
    structuralElements,
    hasStructuralElements,
  ]);

  // =========================================================================
  // BẢNG KIỂM TRA TIỀN KIỂM (PRE-FLIGHT VALIDATION) TRƯỚC KHI NỘP HỒ SƠ
  // =========================================================================
  const preFlightValidation = useMemo<PreFlightValidationResult>(() => {
    const blockingErrors: PreFlightCheckItem[] = [];
    const warnings: PreFlightCheckItem[] = [];
    const allItems: PreFlightCheckItem[] = [];

    // 1. Ảnh toàn cảnh Bước 2
    if (overviewPhotos.length === 0) {
      blockingErrors.push({
        id: 'val_overview_photos',
        step: 2,
        stepTitle: 'Bước 2: Ảnh & CAD',
        category: 'PHOTO',
        title: 'Chưa có ảnh toàn cảnh khu vực',
        description: 'Cần chụp ít nhất 1 ảnh hiện trạng tổng thể khu vực tại Bước 2.',
        status: 'ERROR',
        actionLabel: 'Đến Bước 2',
      });
    } else {
      allItems.push({
        id: 'val_overview_photos',
        step: 2,
        stepTitle: 'Bước 2: Ảnh & CAD',
        category: 'PHOTO',
        title: `Ảnh toàn cảnh khu vực (${overviewPhotos.length} ảnh)`,
        description: 'Đã hoàn thành chụp ảnh bao quát khu vực.',
        status: 'VALID',
      });
    }

    // 2. CAD khu vực Bước 2
    if (!cadSketchPhotoUrl) {
      blockingErrors.push({
        id: 'val_cad_sketch',
        step: 2,
        stepTitle: 'Bước 2: Ảnh & CAD',
        category: 'CAD',
        title: 'Chưa thiết lập bản vẽ sơ đồ khu vực',
        description: 'Cần trích xuất từ CAD tầng hoặc tải bản vẽ sơ đồ khu vực tại Bước 2.',
        status: 'ERROR',
        actionLabel: 'Đến Bước 2',
      });
    } else {
      allItems.push({
        id: 'val_cad_sketch',
        step: 2,
        stepTitle: 'Bước 2: Ảnh & CAD',
        category: 'CAD',
        title: 'Bản vẽ sơ đồ khu vực',
        description: 'Đã sẵn sàng sơ đồ phục vụ định vị và khảo sát.',
        status: 'VALID',
      });
    }

    // 3. Kiểm tra từng Vùng Z (Bước 3)
    zones.forEach((z, zIdx) => {
      const zPhotos = z.overviewPhotos || [];
      if (zPhotos.length === 0 && !z.ctxPhotoUrl) {
        blockingErrors.push({
          id: `val_z_photo_${z.id}`,
          step: 3,
          stepTitle: 'Bước 3: Vùng Z',
          category: 'ZONE',
          title: `Vùng ${z.zoneCode}: Chưa chụp ảnh hiện trạng thực tế`,
          description: `Vùng ${z.zoneCode} (${z.roomName}) bắt buộc phải chụp ít nhất 1 ảnh mảng tường thực tế.`,
          status: 'ERROR',
          tabIndex: zIdx,
          actionLabel: `Đến ${z.zoneCode}`,
        });
      } else {
        allItems.push({
          id: `val_z_photo_${z.id}`,
          step: 3,
          stepTitle: 'Bước 3: Vùng Z',
          category: 'ZONE',
          title: `Vùng ${z.zoneCode}: Ảnh hiện trạng (${zPhotos.length} ảnh)`,
          description: 'Đã có ảnh mảng tường thực tế làm mốc khảo sát.',
          status: 'VALID',
        });
      }

      if (!z.componentType || !z.wallMaterial) {
        blockingErrors.push({
          id: `val_z_mat_${z.id}`,
          step: 3,
          stepTitle: 'Bước 3: Vùng Z',
          category: 'ZONE',
          title: `Vùng ${z.zoneCode}: Chưa chọn Cấu kiện hoặc Vật liệu`,
          description: `Vui lòng chỉ định loại cấu kiện và vật liệu hoàn thiện của ${z.zoneCode}.`,
          status: 'ERROR',
          tabIndex: zIdx,
          actionLabel: `Đến ${z.zoneCode}`,
        });
      }

      // Kiểm tra khuyết tật D của Z
      (z.defects || []).forEach((def, dIdx) => {
        if (!def.cuPhotoUrl) {
          blockingErrors.push({
            id: `val_z_d_cu_${z.id}_${dIdx}`,
            step: 3,
            stepTitle: 'Bước 3: Vùng Z',
            category: 'DEFECT',
            title: `Khuyết tật D${dIdx + 1} (${z.zoneCode}): Thiếu ảnh cận cảnh có thước đo`,
            description: 'Quy chuẩn BCS yêu cầu mỗi điểm nứt bắt buộc phải có ảnh chụp cận cảnh có thước đo.',
            status: 'ERROR',
            tabIndex: zIdx,
            actionLabel: `Đến ${z.zoneCode}`,
          });
        }
      });
    });

    // 4. Kiểm tra Cấu kiện E (Bước 4)
    if (hasStructuralElements) {
      structuralElements.forEach((e, eIdx) => {
        const ePhotos = e.overviewPhotos || [];
        if (ePhotos.length === 0 && !e.ctxPhotoUrl) {
          blockingErrors.push({
            id: `val_e_photo_${e.id}`,
            step: 4,
            stepTitle: 'Bước 4: Cấu kiện E',
            category: 'STRUCTURAL',
            title: `Cấu kiện ${e.elementCode}: Chưa chụp ảnh thực tế`,
            description: `Cấu kiện ${e.elementCode} (${e.elementType}) bắt buộc phải chụp ảnh cây cột/dầm thực tế.`,
            status: 'ERROR',
            tabIndex: eIdx,
            actionLabel: `Đến ${e.elementCode}`,
          });
        } else {
          allItems.push({
            id: `val_e_photo_${e.id}`,
            step: 4,
            stepTitle: 'Bước 4: Cấu kiện E',
            category: 'STRUCTURAL',
            title: `Cấu kiện ${e.elementCode}: Ảnh hiện trạng (${ePhotos.length} ảnh)`,
            description: 'Đã có ảnh thực tế cây cột/dầm.',
            status: 'VALID',
          });
        }

        if (!e.elementType || !e.materialType) {
          blockingErrors.push({
            id: `val_e_mat_${e.id}`,
            step: 4,
            stepTitle: 'Bước 4: Cấu kiện E',
            category: 'STRUCTURAL',
            title: `Cấu kiện ${e.elementCode}: Chưa chọn Loại cấu kiện hoặc Vật liệu`,
            description: `Vui lòng chỉ định loại cấu kiện và vật liệu kết cấu của ${e.elementCode}.`,
            status: 'ERROR',
            tabIndex: eIdx,
            actionLabel: `Đến ${e.elementCode}`,
          });
        }

        // Kiểm tra khuyết tật D của E
        (e.defects || []).forEach((def, dIdx) => {
          if (!def.cuPhotoUrl) {
            blockingErrors.push({
              id: `val_e_d_cu_${e.id}_${dIdx}`,
              step: 4,
              stepTitle: 'Bước 4: Cấu kiện E',
              category: 'DEFECT',
              title: `Khuyết tật D${dIdx + 1} (${e.elementCode}): Thiếu ảnh cận cảnh có thước đo`,
              description: 'Mỗi điểm khuyết tật kết cấu bắt buộc phải có ảnh cận cảnh có thước đo.',
              status: 'ERROR',
              tabIndex: eIdx,
              actionLabel: `Đến ${e.elementCode}`,
            });
          }
        });
      });
    } else {
      if (!noStructuralElementsReason || noStructuralElementsReason.trim().length < 10) {
        blockingErrors.push({
          id: 'val_no_struct_reason',
          step: 4,
          stepTitle: 'Bước 4: Cấu kiện E',
          category: 'STRUCTURAL',
          title: 'Lý do miễn trừ kết cấu chưa đầy đủ',
          description: 'Vui lòng giải trình rõ lý do không khảo sát kết cấu (tối thiểu 10 ký tự).',
          status: 'ERROR',
          actionLabel: 'Đến Bước 4',
        });
      } else {
        allItems.push({
          id: 'val_no_struct_reason',
          step: 4,
          stepTitle: 'Bước 4: Cấu kiện E',
          category: 'STRUCTURAL',
          title: 'Lý do miễn trừ kết cấu',
          description: 'Đã ghi nhận văn bản giải trình miễn trừ.',
          status: 'VALID',
        });
      }
    }

    // 5. Nhận xét của KSV (Bước 5)
    if (!surveyorRemarks || surveyorRemarks.trim().length < 5) {
      warnings.push({
        id: 'val_surveyor_remarks',
        step: 5,
        stepTitle: 'Bước 5: Tổng kết',
        category: 'REMARKS',
        title: 'Chưa có nhận xét của KSV đối với khu vực',
        description: 'Khuyến nghị ghi nhận đánh giá an toàn hoặc kiến nghị quan trắc.',
        status: 'WARNING',
        actionLabel: 'Đến Bước 5',
      });
    } else {
      allItems.push({
        id: 'val_surveyor_remarks',
        step: 5,
        stepTitle: 'Bước 5: Tổng kết',
        category: 'REMARKS',
        title: 'Nhận xét của KSV đối với khu vực',
        description: 'Đã ghi nhận ý kiến nhận xét của khảo sát viên.',
        status: 'VALID',
      });
    }

    // 6. Trạng thái đồng bộ Cloud R2
    if (photoAuditStats.unsynced > 0) {
      warnings.push({
        id: 'val_cloud_sync',
        step: 2,
        stepTitle: 'Đồng bộ Cloud R2',
        category: 'SYNC',
        title: `Còn ${photoAuditStats.unsynced} ảnh chưa lên Cloudflare R2`,
        description: 'Dữ liệu ảnh đang lưu tạm trong máy. Hãy bấm nút Đồng bộ Cloud để lưu an toàn.',
        status: 'WARNING',
        actionLabel: 'Kiểm toán ảnh',
      });
    }

    const combined = [...blockingErrors, ...warnings, ...allItems];
    return {
      isValid: blockingErrors.length === 0,
      totalChecks: combined.length,
      passedChecks: allItems.length,
      blockingErrors,
      warnings,
      allItems: combined,
    };
  }, [
    overviewPhotos,
    cadSketchPhotoUrl,
    zones,
    hasStructuralElements,
    structuralElements,
    noStructuralElementsReason,
    surveyorRemarks,
    photoAuditStats,
  ]);

  // Điều hướng 1-click đến mục cần bổ sung
  const handleJumpToPreFlightItem = useCallback((item: PreFlightCheckItem) => {
    if (item.category === 'SYNC') {
      setIsPhotoAuditModalOpen(true);
      return;
    }
    setCurrentStep(item.step);
    if (item.tabIndex !== undefined) {
      if (item.step === 3) {
        setActiveZoneIndex(item.tabIndex);
      } else if (item.step === 4) {
        setActiveElementIndex(item.tabIndex);
      }
    }
  }, []);

  // =========================================================================
  // BƯỚC 5: TỔNG KẾT & TỰ ĐỘNG TÍNH TOÁN BURLAND
  // =========================================================================

  // Nộp hồ sơ khảo sát khu vực dùng chung (có Tiền kiểm Pre-flight)
  const handleSubmitMasterAreaSurvey = async () => {
    // 1. Kiểm tra Tiền kiểm Pre-flight
    if (!preFlightValidation.isValid) {
      const firstError = preFlightValidation.blockingErrors[0];
      alert(
        `HỒ SƠ CHƯA ĐỦ ĐIỀU KIỆN ĐỂ NỘP (${preFlightValidation.blockingErrors.length} lỗi bắt buộc):\n\n` +
          preFlightValidation.blockingErrors.map((e, idx) => `• ${idx + 1}. ${e.title}`).join('\n') +
          `\n\nVui lòng bổ sung đầy đủ thông tin trước khi nộp!`
      );
      if (firstError) {
        handleJumpToPreFlightItem(firstError);
      }
      return;
    }

    const confirmed = window.confirm(
      `Xác nhận nộp hồ sơ khảo sát hiện trạng khu vực ${unitCode} (${floorName})?\n\n` +
        `• Số Vùng Z: ${zones.length}\n` +
        `• Số Cấu Kiện E: ${hasStructuralElements ? structuralElements.length : 0}\n` +
        `• Tổng Khuyết Tật D: ${allDefects.length}\n` +
        `• Cấp Burland Chủ Đạo: Cấp ${dominantBurlandGrade}\n` +
        `• Trạng Thái Ảnh: ${photoAuditStats.synced}/${photoAuditStats.total} ảnh đã lên Cloud\n\n` +
        `Hồ sơ sẽ được lưu trữ và chuyển sang trạng thái Hoàn Thành.`
    );
    if (!confirmed) return;

    try {
      setIsSubmitting(true);
      setSyncStatus('SYNCING');

      const floorSurveyPayload = {
        overviewPhotos,
        cadSketchPhotoUrl,
        cadStructuralSketchPhotoUrl: useSeparateStructuralCad ? cadStructuralSketchPhotoUrl : cadSketchPhotoUrl,
        cadZonePins,
        cadElementPins,
        zones,
        structuralElements: hasStructuralElements ? structuralElements : [],
        hasStructuralElements,
        noStructuralElementsReason,
      };

      const payload = {
        parcelId,
        unitId,
        reportType: 'CONDO_UNIT',
        surveyData: {
          parcelId,
          unitId,
          unitCode,
          floorNumber,
          unitType: 'MASTER',
          floorSurvey: floorSurveyPayload,
          floors: [floorSurveyPayload],
          dominantBurlandGrade,
          surveyorRemarks,
          surveyorSignatureUrl: surveyorSignatureUrl || '',
          completedAt: new Date().toISOString(),
        },
        status: 'SUBMITTED',
        completedAt: new Date().toISOString(),
      };

      const res = await api.post('/surveys/phase1/submit', payload);

      if (res.data?.success) {
        await handleReleaseLock();
        localStorage.removeItem(draftKey);
        setSyncStatus('SAVED_CLOUD');
        setIsDirty(false);
        setLastSyncedAt(new Date().toLocaleTimeString('vi-VN'));
        alert(`Đã nộp thành công hồ sơ khảo sát khu vực ${unitCode}!`);
        onSurveyCompleted();
      } else {
        throw new Error(res.data?.message || 'Server không xác nhận lưu thành công.');
      }
    } catch (err: unknown) {
      console.error('[useMasterAreaSurveyState] Lỗi nộp khảo sát:', err);
      setSyncStatus('ERROR');
      alert(`Nộp hồ sơ thất bại: ${getErrorMessage(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const goToStep = useCallback((step: 1 | 2 | 3 | 4 | 5) => {
    setCurrentStep(step);
  }, []);

  return {
    currentStep,
    setCurrentStep,
    goToStep,
    unitId,
    unitCode,
    floorNumber,
    floorName,
    isReadOnly,
    isZoneAdminAdjusting,
    serverReport,
    activeBbox,
    floorPlanData,
    isLoadingCad,
    watermarkOptions,
    // Sync status & Photo Audit
    syncStatus,
    lastSyncedAt,
    isDirty,
    photoAuditStats,
    isPhotoAuditModalOpen,
    setIsPhotoAuditModalOpen,
    // Concurrency Lock & Shift Handover
    isLockedByOther,
    lockedInfo,
    isHandoverModalOpen,
    setIsHandoverModalOpen,
    handoverInfo,
    isAbsentModalOpen,
    setIsAbsentModalOpen,
    handleClose,
    handleReleaseLock,
    handleTakeoverDraft,
    handleRecordAbsence,
    // Step 2
    overviewPhotos,
    cadSketchPhotoUrl,
    cadStructuralSketchPhotoUrl,
    useSeparateStructuralCad,
    isCroppingCad,
    isCadCropModalOpen,
    setIsCadCropModalOpen,
    setCadSketchPhotoUrl,
    setCadStructuralSketchPhotoUrl,
    setUseSeparateStructuralCad,
    handleUpdateOrAddOverviewPhoto,
    handleRemoveOverviewPhoto,
    handleAutoCropFromFloorCad,
    handleConfirmCadCrop,
    // Step 3 (2-way sync với CAD)
    cadZonePins,
    setCadZonePins,
    zones,
    setZones,
    activeZoneIndex,
    setActiveZoneIndex,
    activeZone,
    handleUpdateActiveZone,
    handleAddZone,
    handleDeleteZone,
    handleDeleteZoneByCode,
    handleSelectZoneByCode,
    handleSyncMaterialsToEntireArea,
    handleUpdateOrAddZoneOverviewPhoto,
    handleRemoveZoneOverviewPhoto,
    // Step 4 (2-way sync với CAD)
    hasStructuralElements,
    setHasStructuralElements,
    noStructuralElementsReason,
    setNoStructuralElementsReason,
    cadElementPins,
    setCadElementPins,
    structuralElements,
    setStructuralElements,
    activeElementIndex,
    setActiveElementIndex,
    activeElement,
    handleUpdateActiveElement,
    handleAddElement,
    handleDeleteElement,
    handleDeleteElementByCode,
    handleSelectElementByCode,
    handleSyncElementsToEntireArea,
    handleUpdateOrAddElementOverviewPhoto,
    handleRemoveElementOverviewPhoto,
    // Step 5 & Tiền kiểm
    allDefects,
    dominantBurlandGrade,
    burlandCounts,
    surveyorRemarks,
    setSurveyorRemarks,
    surveyorSignatureUrl,
    setSurveyorSignatureUrl,
    isSubmitting,
    handleSubmitMasterAreaSurvey,
    preFlightValidation,
    handleJumpToPreFlightItem,
    // Modals
    previewImageUrl,
    setPreviewImageUrl,
    pinningZoneId,
    setPinningZoneId,
    pinningElementId,
    setPinningElementId,
    activePinningZone,
    activePinningElement,
    handleSaveZoneDefects,
    handleSaveElementDefects,
    // Photo Audit updates
    handleUpdateOverviewPhotoUrl,
    handleUpdateCadSketchUrl,
    handleUpdateCadStructuralSketchUrl,
    handleUpdateZoneOverviewPhotoUrl,
    handleUpdateZoneDefectPhotoUrl,
    handleUpdateElementOverviewPhotoUrl,
    handleUpdateElementDefectPhotoUrl,
  };
}
