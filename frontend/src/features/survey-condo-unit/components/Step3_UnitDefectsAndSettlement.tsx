import React, { useState, useEffect, useRef } from 'react';
import { useCondoUnitSurveyStore } from '../store/useCondoUnitSurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import { Input, Select } from '../../../core/components/ui/FormControls';
import { PhotoCaptureInput } from '../../../components/common/PhotoCaptureInput';
import { TapToZoomThumbnail } from '../../../components/common/TapToZoomThumbnail';
import { useSurveyReadOnly } from '../../../core/context/SurveyReadOnlyContext';
import { DefectPinningModal } from '../../survey-phase1/components/step3/DefectPinningModal';
import { FloorCadPinningCanvas, getNextAvailablePinCode } from '../../../components/canvas/FloorCadPinningCanvas';
import {
  COMMON_ROOM_NAMES,
  ARCH_COMPONENT_TYPES,
  WALL_MATERIALS,
  STRUCTURAL_ELEMENT_TYPES,
  STRUCTURAL_MATERIALS,
} from '../../survey-phase1/components/step3/step3.constants';
import {
  type CadBbox,
  type CadPolygon,
  type DamageZoneData,
  type StructuralElementData,
  type DefectItem,
  type CadZonePin,
} from '../types/condo-unit.types';
import { api } from '../../../services/api';
import { saveOfflinePhoto, createManagedBlobUrl, markOfflinePhotoUploaded, revokeManagedBlobUrl } from '../../../core/storage/offlinePhotoStorage';
import { uploadQueue } from '../../../core/services/uploadQueueService';
import { base64ToBlob } from '../../survey-phase1/utils/photoSyncAudit';
import { cropImageBoundingBox } from '../../../components/canvas/FloorPlanCadPartitionCanvas';
import {
  AlertTriangle,
  AlertCircle,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Check,
  Layers,
  Download,
  Crosshair,
  Activity,
  MapPin,
  Info,
  Sparkles,
  Building,
  Camera,
  Ruler,
  ShieldCheck,
  Zap,
  X,
  FileText,
} from 'lucide-react';

import { validateCondoUnitStep3, type CondoUnitValidationIssue } from '../utils/condoUnitValidator';

export type ZedValidationIssue = CondoUnitValidationIssue;

interface FloorPlanUnitItem {
  id: string;
  unit_code: string;
  display_code?: string | null;
  unit_cad_url?: string;
  cad_bbox?: CadBbox | null;
  cad_polygon?: CadPolygon | null;
}

interface FloorPlanData {
  plan?: {
    cad_photo_url?: string;
    floor_name?: string;
  };
  units?: FloorPlanUnitItem[];
}

interface ActivePinningModal {
  isOpen: boolean;
  mode: 'ARCHITECTURAL' | 'STRUCTURAL';
  id: string;
  code: string;
  name: string;
  ctxPhotoUrl: string;
  defects: DefectItem[];
}

export const Step3_UnitDefectsAndSettlement: React.FC = () => {
  const {
    formData,
    updateFormData,
    addZone,
    updateZone,
    removeZone,
    addElement,
    updateElement,
    removeElement,
    updateDefectsInZone,
    updateDefectsInElement,
    nextStep,
    prevStep,
    isReadOnly: storeReadOnly,
  } = useCondoUnitSurveyStore();

  const contextReadOnly = useSurveyReadOnly();
  const isReadOnly = contextReadOnly ?? storeReadOnly;

  const [activeTab, setActiveTab] = useState<'ZONES' | 'STRUCTURAL'>('ZONES');
  const [activeZoneIndex, setActiveZoneIndex] = useState<number>(0);
  const [activeElementIndex, setActiveElementIndex] = useState<number>(0);
  const [pinningModalState, setPinningModalState] = useState<ActivePinningModal | null>(null);

  const [isLoadingFloorPlan, setIsLoadingFloorPlan] = useState<boolean>(false);
  const [floorPlanData, setFloorPlanData] = useState<FloorPlanData | null>(null);
  const [showFloorPickerModal, setShowFloorPickerModal] = useState<boolean>(false);
  const [isCroppingCad, setIsCroppingCad] = useState<boolean>(false);

  // Trạng thái kiểm tra đối soát Z-E-D trước khi chuyển sang Bước 4
  const [validationIssues, setValidationIssues] = useState<ZedValidationIssue[]>([]);
  const [showValidationModal, setShowValidationModal] = useState<boolean>(false);


  const bCode = formData.parentInfo?.projectParcelCode || 'GENERAL';
  const fNum = Number(formData.floorNumber);
  const floorCode = isNaN(fNum)
    ? String(formData.floorNumber || 'F01')
    : fNum < 0
      ? `B${String(Math.abs(fNum)).padStart(2, '0')}`
      : fNum === 0
        ? 'G'
        : `F${String(fNum).padStart(2, '0')}`;

  const zones = formData.zones || [];
  const structuralElements = formData.structuralElements || [];
  const hasStructuralElements = formData.hasStructuralElements !== false;

  const activeZone: DamageZoneData | undefined = zones[activeZoneIndex] || zones[0];
  const activeElement: StructuralElementData | undefined =
    structuralElements[activeElementIndex] || structuralElements[0];

  // Tính toán thống kê khuyết tật tổng hợp
  const allDefects: DefectItem[] = [
    ...zones.flatMap((z) => z.defects || []),
    ...structuralElements.flatMap((e) => e.defects || []),
  ];
  const burlandGrades = allDefects.map((d) => Number(d.burlandGrade) || 0);
  const maxBurlandGrade = burlandGrades.length > 0 ? Math.max(...burlandGrades) : 0;
  const criticalDefectCount = allDefects.filter((d) => (Number(d.widthMaxMm) || 0) >= 2.0).length;

  // Chuẩn hóa Bounding Box dạng mảng hoặc object về object chuẩn { x, y, width, height }
  const normalizeBbox = (
    bbox?: CadBbox | null
  ): { x: number; y: number; width: number; height: number } | null => {
    if (!bbox) return null;
    if (Array.isArray(bbox)) {
      return {
        x: bbox[0],
        y: bbox[1],
        width: bbox[2] - bbox[0],
        height: bbox[3] - bbox[1],
      };
    }
    return bbox;
  };

  // Nạp và xử lý an toàn bản vẽ CAD (lưu IndexedDB nhị phân và đẩy lên Upload Queue R2 nếu là Base64/Blob)
  const importCadWithStorageAndQueue = async (
    rawCadUrl: string,
    bbox?: CadBbox | null,
    targetMode?: 'ZONE' | 'STRUCTURAL'
  ) => {
    const isTargetStructural = targetMode ? targetMode === 'STRUCTURAL' : activeTab === 'STRUCTURAL';
    const parcelCode = formData.parentInfo?.projectParcelCode || 'GENERAL';
    const unitCode = formData.displayCode || formData.unitCode || 'UNIT';
    const photoType = isTargetStructural ? 'CAD_STRUCT' : 'CAD_ARCH';
    const photoCode = `${unitCode}_${photoType}`;

    // 1. Nếu rawCadUrl đã là Cloud URL hợp lệ (bắt đầu bằng http và không chứa blob:)
    if (rawCadUrl.startsWith('http') && !rawCadUrl.includes('blob:')) {
      if (isTargetStructural) {
        updateFormData({ unitStructuralCadUrl: rawCadUrl });
      } else {
        updateFormData({ unitCadUrl: rawCadUrl, cadBbox: bbox || null });
      }
      setShowFloorPickerModal(false);
      return;
    }

    // 2. Nếu rawCadUrl là Base64 hoặc blob tạm
    try {
      let blob: Blob | null = null;
      if (rawCadUrl.startsWith('data:image/')) {
        blob = base64ToBlob(rawCadUrl);
      } else if (rawCadUrl.startsWith('blob:')) {
        const resp = await fetch(rawCadUrl);
        if (resp.ok) {
          blob = await resp.blob();
        }
      }

      if (!blob) {
        if (isTargetStructural) {
          updateFormData({ unitStructuralCadUrl: rawCadUrl });
        } else {
          updateFormData({ unitCadUrl: rawCadUrl, cadBbox: bbox || null });
        }
        setShowFloorPickerModal(false);
        return;
      }

      const localId = `cad_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const targetFolder = `projects/METRO2_HCM/buildings/${parcelCode}/units/${unitCode}/cad`;
      const filename = `${photoCode}_${Date.now()}.jpg`;

      // Cất vào IndexedDB bền vững (không làm tràn RAM, không bị sanitizeSurveyDataForSync xóa mất!)
      await saveOfflinePhoto(
        localId,
        blob,
        photoCode,
        {
          'parcel-code': parcelCode,
          'unit-code': unitCode,
          'photo-code': photoCode,
        },
        filename
      );

      createManagedBlobUrl(localId, blob);
      const persistentLocalUri = `blob:local://${localId}`;

      if (isTargetStructural) {
        updateFormData({ unitStructuralCadUrl: persistentLocalUri });
      } else {
        updateFormData({ unitCadUrl: persistentLocalUri, cadBbox: bbox || null });
      }

      // Đẩy ngầm vào Upload Queue để sync lên Cloudflare R2
      uploadQueue.enqueue(blob, filename, {
        id: localId,
        folder: targetFolder,
        mimeType: blob.type || 'image/jpeg',
        metadata: {
          'parcel-code': parcelCode,
          'unit-code': unitCode,
          'photo-code': photoCode,
        },
        onSuccess: async (publicUrl) => {
          await markOfflinePhotoUploaded(localId, publicUrl);
          revokeManagedBlobUrl(localId);
          if (isTargetStructural) {
            updateFormData({ unitStructuralCadUrl: publicUrl });
          } else {
            updateFormData({ unitCadUrl: publicUrl });
          }
        },
      });
    } catch (importErr) {
      console.warn('[CondoUnit:importCadWithStorageAndQueue] Lỗi lưu nhị phân CAD:', importErr);
      if (isTargetStructural) {
        updateFormData({ unitStructuralCadUrl: rawCadUrl });
      } else {
        updateFormData({ unitCadUrl: rawCadUrl, cadBbox: bbox || null });
      }
    } finally {
      setShowFloorPickerModal(false);
    }
  };

  // Tự động kiểm tra và import CAD từ Tầng nếu căn con chưa có CAD URL
  useEffect(() => {
    if (!formData.unitCadUrl && formData.parcelId && formData.floorNumber) {
      void loadFloorPlanAuto();
    }
  }, [formData.parcelId, formData.floorNumber]);

  const loadFloorPlanAuto = async () => {
    try {
      setIsLoadingFloorPlan(true);
      const res = await api.get(`/parcels/${formData.parcelId}/floor-plans/${formData.floorNumber}`);
      if (res.data?.success && res.data.data) {
        setFloorPlanData(res.data.data);
        const { plan, units } = res.data.data;
        if (units && units.length > 0) {
          const matched = units.find(
            (u: FloorPlanUnitItem) =>
              u.unit_code === formData.unitCode ||
              u.unit_code?.endsWith(formData.unitCode) ||
              (Boolean(formData.displayCode?.trim()) && (u.display_code === formData.displayCode || u.unit_code === formData.displayCode))
          );
          if (matched) {
            if (matched.unit_cad_url) {
              void importCadWithStorageAndQueue(matched.unit_cad_url, matched.cad_bbox, 'ZONE');
            } else if (plan?.cad_photo_url && matched.cad_bbox) {
              const norm = normalizeBbox(matched.cad_bbox);
              if (norm) {
                try {
                  const cropped = await cropImageBoundingBox(plan.cad_photo_url, norm);
                  if (cropped && cropped !== plan.cad_photo_url) {
                    void importCadWithStorageAndQueue(cropped, matched.cad_bbox, 'ZONE');
                  }
                } catch (_cropErr) {
                  console.warn('[CondoUnit] Không thể auto-crop CAD từ tầng:', _cropErr);
                }
              }
            }
          }
        }
      }
    } catch (_err) {
      console.warn('[CondoUnit] Chưa có floor plan hoặc lỗi nạp mặt bằng tầng');
    } finally {
      setIsLoadingFloorPlan(false);
    }
  };

  const fetchFloorPlanData = async () => {
    if (!formData.parcelId || !formData.floorNumber) return;
    try {
      setIsLoadingFloorPlan(true);
      const res = await api.get(`/parcels/${formData.parcelId}/floor-plans/${formData.floorNumber}`);
      if (res.data?.success && res.data.data) {
        setFloorPlanData(res.data.data);
      }
    } catch (_err) {
      console.warn('[CondoUnit] Lỗi tải dữ liệu mặt bằng tầng:', _err);
    } finally {
      setIsLoadingFloorPlan(false);
    }
  };

  const handleOpenFloorPicker = () => {
    setShowFloorPickerModal(true);
    void fetchFloorPlanData();
  };

  const handleSelectPartitionCad = async (u: FloorPlanUnitItem) => {
    if (u.unit_cad_url) {
      await importCadWithStorageAndQueue(u.unit_cad_url, u.cad_bbox);
      setShowFloorPickerModal(false);
      return;
    }

    if (floorPlanData?.plan?.cad_photo_url && u.cad_bbox) {
      const norm = normalizeBbox(u.cad_bbox);
      if (norm) {
        try {
          setIsCroppingCad(true);
          const cropped = await cropImageBoundingBox(floorPlanData.plan.cad_photo_url, norm);
          if (cropped && cropped !== floorPlanData.plan.cad_photo_url) {
            await importCadWithStorageAndQueue(cropped, u.cad_bbox);
            setShowFloorPickerModal(false);
            return;
          }
        } catch (_cropErr) {
          console.error('[Step3] Lỗi crop ảnh CAD ô căn hộ:', _cropErr);
        } finally {
          setIsCroppingCad(false);
        }
      }
    }

    // Nếu không có CAD riêng và không có bbox hoặc crop không thành công, hỏi người dùng trước khi dùng toàn bộ mặt bằng tầng
    if (floorPlanData?.plan?.cad_photo_url) {
      const confirmWholeFloor = window.confirm(
        `Căn hộ ${u.unit_code} chưa có ảnh cắt riêng. Bạn có muốn sử dụng toàn bộ sơ đồ CAD Tầng ${formData.floorNumber} không?`
      );
      if (confirmWholeFloor) {
        await importCadWithStorageAndQueue(floorPlanData.plan.cad_photo_url, null);
        setShowFloorPickerModal(false);
      }
    }
  };

  const handleManualImportCad = (importedCadUrl: string, bbox?: CadBbox | null) => {
    void importCadWithStorageAndQueue(importedCadUrl, bbox);
  };

  // Xử lý tự động ghim & sinh Vùng Z trên sơ đồ CAD kiến trúc (FloorCadPinningCanvas)
  const handleAutoCreateZonePin = (pin: CadZonePin) => {
    // Luôn lấy state mới nhất từ Store để tránh closure cũ / bất đồng bộ với FloorCadPinningCanvas
    const latestState = useCondoUnitSurveyStore.getState().formData;
    const prevZones = latestState.zones || [];
    const currentPins = latestState.cadZonePins || [];
    const hasPin = currentPins.some((p) => p.id === pin.id || p.zoneCode === pin.zoneCode);
    const updatedPins = hasPin ? currentPins : [...currentPins, pin];

    // 1. Kiểm tra xem Vùng Z với mã này đã tồn tại trong danh sách chưa
    const existingZoneIdx = prevZones.findIndex((z) => z.zoneCode === pin.zoneCode);
    if (existingZoneIdx !== -1) {
      // Đã có vùng với mã này -> chỉ cập nhật danh sách pin và focus vào vùng đó, KHÔNG sinh trùng
      updateFormData({
        cadZonePins: updatedPins,
      });
      setActiveZoneIndex(existingZoneIdx);
      return;
    }

    const prevZone = prevZones[prevZones.length - 1];
    const newZone: DamageZoneData = {
      id: `zone_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      zoneCode: pin.zoneCode,
      floorName: `Tầng ${latestState.floorNumber || 1}`,
      roomName: prevZone?.roomName || 'Phòng khách',
      customRoomName: prevZone?.customRoomName || '',
      componentType: prevZone?.componentType || 'Tường gạch vữa xi măng (Tường bao / ngăn)',
      customComponentType: prevZone?.customComponentType || '',
      wallMaterial: prevZone?.wallMaterial || 'Sơn nước nội thất / ngoại thất',
      customWallMaterial: prevZone?.customWallMaterial || '',
      overviewPhotos: [],
      ctxPhotoUrl: '',
      notes: '',
      defects: [],
      hasDamage: false,
    };

    updateFormData({
      cadZonePins: updatedPins,
      zones: [...prevZones, newZone],
    });
    setActiveZoneIndex(prevZones.length);
  };

  const handleDeleteZonePin = (pin: CadZonePin) => {
    const latestState = useCondoUnitSurveyStore.getState().formData;
    const prevZones = latestState.zones || [];
    const targetIdx = prevZones.findIndex((z) => z.zoneCode === pin.zoneCode);
    if (targetIdx !== -1) {
      removeZone(targetIdx);
      if (activeZoneIndex >= prevZones.length - 1) {
        setActiveZoneIndex(Math.max(0, prevZones.length - 2));
      }
    }
  };

  const handleRenameZonePin = (oldCode: string, newCode: string) => {
    const latestState = useCondoUnitSurveyStore.getState().formData;
    const prevZones = latestState.zones || [];
    const targetIdx = prevZones.findIndex((z) => z.zoneCode === oldCode);
    if (targetIdx !== -1) {
      updateZone(targetIdx, { zoneCode: newCode });
    }
  };

  const handleRequestAddNextZone = () => {
    const cadEl = document.getElementById('step3-floor-cad-section');
    if (cadEl) {
      cadEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      cadEl.classList.add('ring-4', 'ring-teal-400');
      setTimeout(() => cadEl.classList.remove('ring-4', 'ring-teal-400'), 2500);
    }
  };

  // Xử lý tự động ghim & sinh Cấu kiện E trên sơ đồ CAD kết cấu (FloorCadPinningCanvas)
  const handleAutoCreateElementPin = (pin: CadZonePin) => {
    const latestState = useCondoUnitSurveyStore.getState().formData;
    const prevElements = latestState.structuralElements || [];
    const currentPins = latestState.cadElementPins || [];
    const hasPin = currentPins.some((p) => p.id === pin.id || p.zoneCode === pin.zoneCode);
    const updatedPins = hasPin ? currentPins : [...currentPins, pin];

    // 1. Kiểm tra xem Cấu kiện E với mã này đã tồn tại trong danh sách chưa
    const existingElIdx = prevElements.findIndex((e) => e.elementCode === pin.zoneCode);
    if (existingElIdx !== -1) {
      updateFormData({
        cadElementPins: updatedPins,
      });
      setActiveElementIndex(existingElIdx);
      return;
    }

    const prevEl = prevElements[prevElements.length - 1];
    const newElement: StructuralElementData = {
      id: `element_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      elementCode: pin.zoneCode,
      floorName: `Tầng ${latestState.floorNumber || 1}`,
      roomName: prevEl?.roomName || 'Phòng khách',
      customRoomName: prevEl?.customRoomName || '',
      elementType: prevEl?.elementType || 'Cột BTCT (Cột chịu lực chính)',
      customElementType: prevEl?.customElementType || '',
      materialType: prevEl?.materialType || 'Bê tông cốt thép (BTCT) đổ toàn khối',
      customMaterialType: prevEl?.customMaterialType || '',
      overviewPhotos: [],
      ctxPhotoUrl: '',
      notes: '',
      defects: [],
      hasDamage: false,
    };

    updateFormData({
      cadElementPins: updatedPins,
      structuralElements: [...prevElements, newElement],
    });
    setActiveElementIndex(prevElements.length);
  };

  const handleDeleteElementPin = (pin: CadZonePin) => {
    const latestState = useCondoUnitSurveyStore.getState().formData;
    const prevElements = latestState.structuralElements || [];
    const targetIdx = prevElements.findIndex((e) => e.elementCode === pin.zoneCode);
    if (targetIdx !== -1) {
      removeElement(targetIdx);
      if (activeElementIndex >= prevElements.length - 1) {
        setActiveElementIndex(Math.max(0, prevElements.length - 2));
      }
    }
  };

  const handleRenameElementPin = (oldCode: string, newCode: string) => {
    const latestState = useCondoUnitSurveyStore.getState().formData;
    const prevElements = latestState.structuralElements || [];
    const targetIdx = prevElements.findIndex((e) => e.elementCode === oldCode);
    if (targetIdx !== -1) {
      updateElement(targetIdx, { elementCode: newCode });
    }
  };

  const handleRequestAddNextElement = () => {
    const cadEl = document.getElementById('step3-structure-cad-section');
    if (cadEl) {
      cadEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      cadEl.classList.add('ring-4', 'ring-amber-400');
      setTimeout(() => cadEl.classList.remove('ring-4', 'ring-amber-400'), 2500);
    }
  };

  // Đồng bộ cấu kiện & vật liệu cho các vùng Z phía sau
  const handleSyncZoneDownstream = () => {
    if (!activeZone) return;
    if (activeZoneIndex >= zones.length - 1) return;
    const downstreamCount = zones.length - 1 - activeZoneIndex;
    const confirmed = window.confirm(
      `Đồng bộ cấu kiện "${activeZone.componentType}" và vật liệu "${activeZone.wallMaterial}" của ${activeZone.zoneCode} cho ${downstreamCount} Vùng Z phía sau?`
    );
    if (!confirmed) return;

    for (let i = activeZoneIndex + 1; i < zones.length; i++) {
      updateZone(i, {
        componentType: activeZone.componentType,
        wallMaterial: activeZone.wallMaterial,
      });
    }
  };

  // Đồng bộ loại cấu kiện & vật liệu cho các cấu kiện E phía sau
  const handleSyncElementDownstream = () => {
    if (!activeElement) return;
    if (activeElementIndex >= structuralElements.length - 1) return;
    const downstreamCount = structuralElements.length - 1 - activeElementIndex;
    const confirmed = window.confirm(
      `Đồng bộ loại cấu kiện "${activeElement.elementType}" và vật liệu "${activeElement.materialType}" của ${activeElement.elementCode} cho ${downstreamCount} Cấu kiện E phía sau?`
    );
    if (!confirmed) return;

    for (let i = activeElementIndex + 1; i < structuralElements.length; i++) {
      updateElement(i, {
        elementType: activeElement.elementType,
        materialType: activeElement.materialType,
      });
    }
  };

  // Tính toán tỉ số võng dầm f/L
  const beamSagging = formData.beamSagging || {
    hasSagging: false,
    location: '',
    sagMm: 0,
    spanM: 0,
    ratioText: '',
    photoUrl: '',
  };

  const handleUpdateBeamSagging = (
    sagMmVal?: number,
    spanMVal?: number,
    locVal?: string,
    photoVal?: string
  ) => {
    const sMm = sagMmVal !== undefined ? sagMmVal : beamSagging.sagMm || 0;
    const spM = spanMVal !== undefined ? spanMVal : beamSagging.spanM || 0;
    const loc = locVal !== undefined ? locVal : beamSagging.location || '';
    const photo = photoVal !== undefined ? photoVal : beamSagging.photoUrl || '';

    let ratioText = '';
    if (sMm > 0 && spM > 0) {
      const spanMm = spM * 1000;
      const denominator = Math.round(spanMm / sMm);
      ratioText = `1/${denominator}`;
    }

    updateFormData({
      beamSagging: {
        ...beamSagging,
        sagMm: sMm,
        spanM: spM,
        location: loc,
        photoUrl: photo,
        ratioText,
      },
    });
  };

  const isBeamSagCritical = () => {
    if (!beamSagging.hasSagging || !beamSagging.sagMm || !beamSagging.spanM) return false;
    const spanMm = beamSagging.spanM * 1000;
    const ratio = beamSagging.sagMm / spanMm;
    return ratio > 1 / 500; // TCVN 5574:2018
  };

  const handleContinueToStep4 = () => {
    if (isReadOnly) {
      nextStep();
      return;
    }
    const issues = validateCondoUnitStep3(formData);
    if (issues.length > 0) {
      setValidationIssues(issues);
      setShowValidationModal(true);
    } else {
      nextStep();
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-in fade-in">
      {/* 3.0. Header Tổng Kết Phân Cấp Z - E - D & Chỉ Số Rủi Ro Burland */}
      <Card className="border-teal-200 bg-teal-50/40 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-teal-200">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0" />
            <div>
              <h2 className="text-base font-bold text-teal-950">
                3. Khảo Sát Khuyết Tật & Kết Cấu Căn Hộ {formData.unitCode} (Phân Cấp Z - E - D)
              </h2>
              <p className="text-xs text-slate-600">
                Tuân thủ quy chuẩn TCVN & Phase 1 BCS Metro 2: Vùng Z, Cấu kiện E và Khuyết tật nứt/thấm D
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-teal-100/90 text-teal-800 border border-teal-300">
              {zones.length} Vùng Z
            </span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-100/90 text-amber-800 border border-amber-300">
              {structuralElements.length} Cấu kiện E
            </span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-rose-100/90 text-rose-800 border border-rose-300">
              {allDefects.length} Khuyết tật D
            </span>
            <span
              className={`text-xs font-black px-2.5 py-1 rounded-lg border flex items-center gap-1 ${
                maxBurlandGrade >= 2
                  ? 'bg-rose-100 text-rose-900 border-rose-300'
                  : 'bg-emerald-100 text-emerald-900 border-emerald-300'
              }`}
            >
              <Zap className="w-3 h-3" />
              <span>Burland Max: Cấp {maxBurlandGrade}</span>
            </span>
          </div>
        </div>

        {criticalDefectCount > 0 && (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-center gap-2 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              <strong>Cảnh báo khuyết tật nghiêm trọng:</strong> Có <strong>{criticalDefectCount} vết nứt $\ge 2.0$mm</strong> cần đặc biệt lưu ý kiểm tra kết cấu chịu lực.
            </span>
          </div>
        )}
      </Card>

      {/* 3.1. Thanh Tab Chuyển Đổi: VÙNG KIẾN TRÚC Z vs CẤU KIỆN KẾT CẤU E */}
      <div className="flex items-center border-b border-slate-200 bg-white rounded-2xl p-1 shadow-2xs gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('ZONES')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer min-h-[44px] ${
            activeTab === 'ZONES'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Vùng Kiến Trúc Z ({zones.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('STRUCTURAL')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer min-h-[44px] ${
            activeTab === 'STRUCTURAL'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Cấu Kiện Kết Cấu Chịu Lực E ({structuralElements.length})</span>
        </button>
      </div>

      {/* NỘI DUNG TAB 1: VÙNG KIẾN TRÚC Z */}
      {activeTab === 'ZONES' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Sơ đồ CAD Kiến trúc & Ghim Vùng Z */}
          <Card id="step3-floor-cad-section" className="border-slate-200 bg-white shadow-xs space-y-4 transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-teal-600 shrink-0" />
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Sơ Đồ Mặt Bằng Kiến Trúc Căn Hộ {formData.unitCode} (CAD_01)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Chạm trực tiếp vào sơ đồ để gán tọa độ và tự động sinh Vùng kiến trúc Z mới
                  </p>
                </div>
              </div>

              {!isReadOnly && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenFloorPicker}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 text-xs font-bold transition-all shadow-2xs cursor-pointer min-h-[44px]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Chọn / Cắt từ Tầng {formData.floorNumber}
                  </button>
                </div>
              )}
            </div>

            <FloorCadPinningCanvas
              cadPhotoUrl={formData.unitCadUrl || ''}
              onCadPhotoChange={(url) => updateFormData({ unitCadUrl: url })}
              pins={formData.cadZonePins || []}
              onChangePins={(pins) => updateFormData({ cadZonePins: pins })}
              onAutoCreatePin={handleAutoCreateZonePin}
              onDeletePin={handleDeleteZonePin}
              onRenamePin={handleRenameZonePin}
              onSelectPin={(pin) => {
                const idx = zones.findIndex((z) => z.zoneCode === pin.zoneCode);
                if (idx !== -1) setActiveZoneIndex(idx);
              }}
              mode="ZONE"
              floorName={`Căn hộ ${formData.unitCode}`}
              parcelCode={formData.unitCode}
              cadTitle={`Sơ đồ mặt bằng kiến trúc CAD_01 (Căn ${formData.unitCode}):`}
              readOnly={isReadOnly}
            />
          </Card>

          {/* Chi tiết Vùng Z & Danh sách Stepper */}
          <Card id="step3-zones-list" className="border-slate-200 bg-white shadow-xs space-y-4">
            {/* Sub-bar chọn Vùng Z */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                {zones.map((z, idx) => {
                  const defectCount = z.defects?.length || 0;
                  const hasPhoto = Boolean((z.overviewPhotos && z.overviewPhotos.length > 0) || z.ctxPhotoUrl);
                  return (
                    <button
                      key={z.id || idx}
                      type="button"
                      onClick={() => setActiveZoneIndex(idx)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer min-h-[40px] border ${
                        activeZoneIndex === idx
                          ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>{z.zoneCode}</span>
                      <span className="text-[10px] opacity-80">({z.roomName})</span>
                      {!hasPhoto && (
                        <span
                          className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-rose-500 text-white animate-pulse"
                          title="Vùng này chưa có ảnh chụp thực tế (Bắt buộc theo chuẩn Phase 1)"
                        >
                          Thiếu ảnh
                        </span>
                      )}
                      {defectCount > 0 && (
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${activeZoneIndex === idx ? 'bg-white text-teal-800' : 'bg-rose-100 text-rose-800'}`}>
                          {defectCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {!isReadOnly && (
                <Button
                  size="sm"
                  variant="outline"
                  icon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => {
                    if (formData.unitCadUrl) {
                      handleRequestAddNextZone();
                    } else {
                      addZone();
                      setActiveZoneIndex(zones.length);
                    }
                  }}
                >
                  + Thêm Vùng Z
                </Button>
              )}
            </div>

          {activeZone ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm px-2.5 py-1 rounded-lg bg-teal-100 text-teal-900 border border-teal-300">
                    {activeZone.zoneCode}
                  </span>
                  <h4 className="text-sm font-bold text-slate-800">
                    Chi Tiết Mảng Vách / Trần / Nền Kiến Trúc
                  </h4>
                </div>

                {!isReadOnly && zones.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Xác nhận xóa vùng ${activeZone.zoneCode}?`)) {
                        removeZone(activeZoneIndex);
                        setActiveZoneIndex(Math.max(0, activeZoneIndex - 1));
                      }
                    }}
                    className="text-xs text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Xóa vùng này
                  </button>
                )}
              </div>

              {/* Thông số mảng tường */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Select
                  label="Vị Trí Phòng / Không Gian *"
                  value={activeZone.roomName}
                  onChange={(e) => updateZone(activeZoneIndex, { roomName: e.target.value })}
                  options={COMMON_ROOM_NAMES.map((r) => ({ value: r, label: r }))}
                />

                <Select
                  label="Cấu Kiện Mảng Vách Kiến Trúc *"
                  value={activeZone.componentType}
                  onChange={(e) => updateZone(activeZoneIndex, { componentType: e.target.value })}
                  options={ARCH_COMPONENT_TYPES.map((c) => ({ value: c, label: c }))}
                />

                <Select
                  label="Vật Liệu Hoàn Thiện *"
                  value={activeZone.wallMaterial}
                  onChange={(e) => updateZone(activeZoneIndex, { wallMaterial: e.target.value })}
                  options={WALL_MATERIALS.map((w) => ({ value: w, label: w }))}
                />
              </div>

              {activeZoneIndex < zones.length - 1 && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSyncZoneDownstream}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                    Áp dụng cấu kiện & vật liệu cho các Z phía sau ({zones.length - 1 - activeZoneIndex})
                  </button>
                </div>
              )}

              {/* Ảnh tổng quan mảng tường */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-teal-600" />
                    Ảnh Chụp Tổng Quan Mảng Tường ({activeZone.zoneCode})
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Đã chụp: {activeZone.overviewPhotos?.length || 0} ảnh
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(activeZone.overviewPhotos || []).map((url, i) => (
                    <div key={i} className="relative rounded-lg overflow-hidden border border-slate-300">
                      <TapToZoomThumbnail
                        src={url}
                        alt={`Overview ${i + 1}`}
                        label={`Ảnh ${i + 1}`}
                        photoCode={`${activeZone.zoneCode}_OVERVIEW_${i + 1}`}
                        aspectClass="h-24 aspect-auto"
                        actions={
                          !isReadOnly ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                const updated = (activeZone.overviewPhotos || []).filter((_, idx) => idx !== i);
                                updateZone(activeZoneIndex, { overviewPhotos: updated });
                              }}
                              className="absolute top-1.5 right-1.5 p-1 bg-rose-600 text-white rounded-md text-xs cursor-pointer shadow-md hover:bg-rose-700 pointer-events-auto z-30 transition-transform active:scale-95 flex items-center justify-center"
                              title="Xóa ảnh này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : undefined
                        }
                      />
                    </div>
                  ))}
                  {!isReadOnly && (
                    <PhotoCaptureInput
                      label="+ Thêm ảnh tổng quan"
                      value=""
                      onChange={(url, _code, meta) => {
                        if (url) {
                          const curZone = useCondoUnitSurveyStore.getState().formData.zones?.[activeZoneIndex];
                          const curPhotos: string[] = curZone?.overviewPhotos || [];
                          const base = meta?.replacesUri
                            ? curPhotos.map((p) => (p === meta.replacesUri ? url : p))
                            : curPhotos;
                          const updated = base.includes(url) ? base : [...base, url];
                          updateZone(activeZoneIndex, { overviewPhotos: updated });
                        }
                      }}
                      watermarkOptions={{
                        parcelCode: bCode,
                        floor: `Tầng ${formData.floorNumber}`,
                        zoneOrRoom: activeZone.zoneCode,
                        photoType: 'OVERVIEW',
                        photoIndex: (activeZone.overviewPhotos?.length || 0) + 1,
                      }}
                      height="96px"
                    />
                  )}
                </div>
              </div>

              {/* Khảo sát khuyết tật D trong vùng Z */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    disabled={isReadOnly}
                    checked={activeZone.hasDamage || (activeZone.defects && activeZone.defects.length > 0)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      updateZone(activeZoneIndex, {
                        hasDamage: checked,
                        ctxPhotoUrl: activeZone.ctxPhotoUrl || activeZone.overviewPhotos?.[0] || '',
                      });
                    }}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    Vùng {activeZone.zoneCode} CÓ khuyết tật / vết nứt / thấm dột cần ghi sổ D-xx
                  </span>
                </label>

                {(activeZone.hasDamage || (activeZone.defects && activeZone.defects.length > 0)) && (
                  <div className="p-3 bg-white rounded-xl border border-rose-200 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">
                          Ảnh Bối Cảnh Chính (Photo CTX) & Thả Ghim Khuyết Tật D-xx
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Đã ghi nhận: <strong className="text-rose-600 font-bold">{activeZone.defects?.length || 0} điểm khuyết tật</strong> (Burland: Cấp {activeZone.burlandGrade || 0})
                        </span>
                      </div>

                      <Button
                        size="sm"
                        className="bg-rose-600 hover:bg-rose-700 text-white cursor-pointer min-h-[40px]"
                        icon={<MapPin className="w-3.5 h-3.5" />}
                        onClick={() => {
                          if (!activeZone.ctxPhotoUrl) {
                            alert(`Vui lòng chụp ảnh bối cảnh (Photo CTX) cho ${activeZone.zoneCode} trước khi chấm điểm và ghi sổ khuyết tật D-xx!`);
                            return;
                          }
                          setPinningModalState({
                            isOpen: true,
                            mode: 'ARCHITECTURAL',
                            id: activeZone.id,
                            code: activeZone.zoneCode,
                            name: `${activeZone.roomName} - ${activeZone.componentType}`,
                            ctxPhotoUrl: activeZone.ctxPhotoUrl,
                            defects: activeZone.defects || [],
                          });
                        }}
                      >
                        {activeZone.defects && activeZone.defects.length > 0
                          ? isReadOnly
                            ? `Xem ${activeZone.defects.length} ghim D-xx ➔`
                            : `Xem & Sửa ${activeZone.defects.length} ghim D-xx ➔`
                          : isReadOnly
                            ? 'Xem ghim khuyết tật D-xx ➔'
                            : 'Chấm điểm & Ghi sổ khuyết tật D-xx ➔'}
                      </Button>
                    </div>

                    <PhotoCaptureInput
                      label={`Ảnh bối cảnh chính để thả ghim nứt/thấm cho ${activeZone.zoneCode}:`}
                      value={activeZone.ctxPhotoUrl || ''}
                      photoCode={activeZone.ctxPhotoCode}
                      readOnly={isReadOnly}
                      onChange={(url, code) =>
                        updateZone(activeZoneIndex, {
                          ctxPhotoUrl: url,
                          ctxPhotoCode: code || activeZone.ctxPhotoCode,
                        })
                      }
                      recommendedOrientation="landscape"
                      orientationHint="Chụp ảnh NGANG (4:3) bao quát mảng tường hoặc trần cần ghi sổ"
                      watermarkOptions={{
                        parcelCode: bCode,
                        floor: `Tầng ${formData.floorNumber}`,
                        zoneOrRoom: activeZone.zoneCode,
                        photoType: 'CTX',
                        photoIndex: 1,
                      }}
                      height="120px"
                    />

                    {/* Danh sách các khuyết tật D trong vùng */}
                    {activeZone.defects && activeZone.defects.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        {activeZone.defects.map((d, dIdx) => (
                          <div
                            key={d.id || dIdx}
                            className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-start justify-between gap-2 text-xs"
                          >
                            <div className="flex items-start gap-2.5">
                              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 shrink-0">
                                {d.defectCode || `D-${String(dIdx + 1).padStart(2, '0')}`}
                              </span>
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                    d.screeningCategory === 'WATER_LEAK'
                                      ? 'bg-sky-100 text-sky-800 border border-sky-200'
                                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                                  }`}>
                                    {d.screeningCategory === 'WATER_LEAK' ? 'Thấm dột' : (d.defectType || 'Vết nứt')}
                                  </span>
                                  <span className="text-slate-700">
                                    W = <strong>{d.widthMaxMm}mm</strong> • L = <strong>{d.lengthMm}mm</strong>
                                  </span>
                                  {d.burlandGrade !== undefined && (
                                    <span className="text-slate-500 font-mono text-[11px]">
                                      • Burland: Cấp {d.burlandGrade}
                                    </span>
                                  )}
                                </div>
                                {d.notes && <p className="text-slate-500 italic mt-0.5">{d.notes}</p>}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {d.cuPhotoUrl && (
                                <div className="w-10 h-10 rounded border border-rose-300 overflow-hidden shrink-0">
                                  <TapToZoomThumbnail
                                    src={d.cuPhotoUrl}
                                    alt="CU"
                                    title="Ảnh cận cảnh có thước đo"
                                    aspectClass="w-full h-full"
                                  />
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  const updatedDefects = (activeZone.defects || []).filter((_, idx) => idx !== dIdx);
                                  updateDefectsInZone(activeZone.id, updatedDefects);
                                }}
                                className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                                title="Xóa khuyết tật này"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-xs text-slate-500 space-y-2">
              <p className="font-medium text-slate-700">Chưa có Vùng kiến trúc (Z) nào được ghi nhận.</p>
              <p className="text-[11px] text-slate-400">
                {formData.unitCadUrl
                  ? '👉 Chạm vào sơ đồ CAD ở trên để ghim vị trí và tự động khởi tạo Vùng Z-01 đầu tiên.'
                  : 'Bấm nút "+ Thêm Vùng Z" ở trên để khởi tạo vùng khảo sát đầu tiên.'}
              </p>
            </div>
          )}
        </Card>
      </div>
    )}

      {/* NỘI DUNG TAB 2: CẤU KIỆN KẾT CẤU CHỊU LỰC E */}
      {activeTab === 'STRUCTURAL' && (
        <div className="space-y-4 animate-in fade-in">
          <Card className="border-slate-200 bg-white shadow-xs p-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasStructuralElements}
                onChange={(e) => updateFormData({ hasStructuralElements: e.target.checked })}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
              />
              <span className="text-xs font-bold text-slate-800">
                Khảo sát cấu kiện kết cấu chịu lực riêng trong căn hộ con (Cột / Dầm / Sàn / Vách cứng BTCT)
              </span>
            </label>
          </Card>

          {hasStructuralElements ? (
            <>
              {/* Sơ đồ CAD Kết Cấu & Ghim Cấu Kiện E */}
              <Card id="step3-structure-cad-section" className="border-slate-200 bg-white shadow-xs space-y-4 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <h3 className="text-base font-bold text-slate-800">
                        Sơ Đồ Mặt Bằng Kết Cấu Căn Hộ {formData.unitCode} (CAD_02)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Chạm trực tiếp vào sơ đồ để gán tọa độ và tự động sinh Cấu kiện kết cấu E mới
                      </p>
                    </div>
                  </div>

                  {!isReadOnly && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleOpenFloorPicker}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition-all shadow-2xs cursor-pointer min-h-[44px]"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Chọn / Cắt từ Tầng {formData.floorNumber}
                      </button>
                    </div>
                  )}
                </div>

                <FloorCadPinningCanvas
                  cadPhotoUrl={formData.unitStructuralCadUrl || formData.unitCadUrl || ''}
                  onCadPhotoChange={(url) => updateFormData({ unitStructuralCadUrl: url })}
                  pins={formData.cadElementPins || []}
                  onChangePins={(pins) => updateFormData({ cadElementPins: pins })}
                  onAutoCreatePin={handleAutoCreateElementPin}
                  onDeletePin={handleDeleteElementPin}
                  onRenamePin={handleRenameElementPin}
                  onSelectPin={(pin) => {
                    const idx = structuralElements.findIndex((e) => e.elementCode === pin.zoneCode);
                    if (idx !== -1) setActiveElementIndex(idx);
                  }}
                  mode="STRUCTURAL"
                  floorName={`Căn hộ ${formData.unitCode}`}
                  parcelCode={formData.unitCode}
                  cadTitle={`Sơ đồ mặt bằng kết cấu CAD_02 (Căn ${formData.unitCode}):`}
                  readOnly={isReadOnly}
                />
              </Card>

              {/* Chi tiết Cấu kiện E & Stepper */}
              <Card className="border-slate-200 bg-white shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {structuralElements.map((elem, idx) => {
                      const defectCount = elem.defects?.length || 0;
                      const hasPhoto = Boolean((elem.overviewPhotos && elem.overviewPhotos.length > 0) || elem.ctxPhotoUrl);
                      return (
                        <button
                          key={elem.id || idx}
                          type="button"
                          onClick={() => setActiveElementIndex(idx)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer min-h-[40px] border ${
                            activeElementIndex === idx
                              ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <span>{elem.elementCode}</span>
                          <span className="text-[10px] opacity-80">({elem.roomName})</span>
                          {!hasPhoto && (
                            <span
                              className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-rose-500 text-white animate-pulse"
                              title="Cấu kiện này chưa có ảnh chụp thực tế (Bắt buộc theo chuẩn Phase 1)"
                            >
                              Thiếu ảnh
                            </span>
                          )}
                          {defectCount > 0 && (
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${activeElementIndex === idx ? 'bg-white text-amber-900' : 'bg-rose-100 text-rose-800'}`}>
                              {defectCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {!isReadOnly && (
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<Plus className="w-3.5 h-3.5" />}
                      onClick={() => {
                        if (formData.unitStructuralCadUrl || formData.unitCadUrl) {
                          handleRequestAddNextElement();
                        } else {
                          addElement();
                          setActiveElementIndex(structuralElements.length);
                        }
                      }}
                    >
                      + Thêm Cấu Kiện E
                    </Button>
                  )}
                </div>

                {activeElement ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300">
                        {activeElement.elementCode}
                      </span>
                      <h4 className="text-sm font-bold text-slate-800">
                        Thông Số Cấu Kiện Kết Cấu Chịu Lực
                      </h4>
                    </div>

                    {!isReadOnly && structuralElements.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Xác nhận xóa cấu kiện ${activeElement.elementCode}?`)) {
                            removeElement(activeElementIndex);
                            setActiveElementIndex(Math.max(0, activeElementIndex - 1));
                          }
                        }}
                        className="text-xs text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Xóa cấu kiện này
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Select
                      label="Vị Trí Phòng / Khu Vực *"
                      value={activeElement.roomName}
                      onChange={(e) => updateElement(activeElementIndex, { roomName: e.target.value })}
                      options={COMMON_ROOM_NAMES.map((r) => ({ value: r, label: r }))}
                    />

                    <Select
                      label="Loại Cấu Kiện Chịu Lực *"
                      value={activeElement.elementType}
                      onChange={(e) => updateElement(activeElementIndex, { elementType: e.target.value })}
                      options={STRUCTURAL_ELEMENT_TYPES.map((t) => ({ value: t, label: t }))}
                    />

                    <Select
                      label="Vật Liệu Cấu Kiện *"
                      value={activeElement.materialType}
                      onChange={(e) => updateElement(activeElementIndex, { materialType: e.target.value })}
                      options={STRUCTURAL_MATERIALS.map((m) => ({ value: m, label: m }))}
                    />
                  </div>

                  {activeElementIndex < structuralElements.length - 1 && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleSyncElementDownstream}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        Áp dụng loại & vật liệu cho các E phía sau ({structuralElements.length - 1 - activeElementIndex})
                      </button>
                    </div>
                  )}

                  {/* Ảnh tổng quan cấu kiện kết cấu E */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Camera className="w-4 h-4 text-amber-600" />
                        Ảnh Chụp Tổng Quan Cấu Kiện ({activeElement.elementCode} - {activeElement.elementType})
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Đã chụp: {activeElement.overviewPhotos?.length || 0} ảnh
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(activeElement.overviewPhotos || []).map((url, i) => (
                        <div key={i} className="relative rounded-lg overflow-hidden border border-slate-300">
                          <TapToZoomThumbnail
                            src={url}
                            alt={`Overview ${activeElement.elementCode} #${i + 1}`}
                            label={`Ảnh ${i + 1}`}
                            photoCode={`${activeElement.elementCode}_OVERVIEW_${i + 1}`}
                            aspectClass="h-24 aspect-auto"
                            actions={
                              !isReadOnly ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    const updated = (activeElement.overviewPhotos || []).filter((_, idx) => idx !== i);
                                    const newCtx =
                                      activeElement.ctxPhotoUrl === url ? updated[0] || '' : activeElement.ctxPhotoUrl;
                                    updateElement(activeElementIndex, {
                                      overviewPhotos: updated,
                                      ctxPhotoUrl: newCtx,
                                    });
                                  }}
                                  className="absolute top-1.5 right-1.5 p-1 bg-rose-600 text-white rounded-md text-xs cursor-pointer shadow-md hover:bg-rose-700 pointer-events-auto z-30 transition-transform active:scale-95 flex items-center justify-center"
                                  title="Xóa ảnh này"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              ) : undefined
                            }
                          />
                        </div>
                      ))}
                      {!isReadOnly && (
                        <PhotoCaptureInput
                          label="+ Thêm ảnh tổng quan E"
                          value=""
                          onChange={(url, _code, meta) => {
                            if (url) {
                              const curElem = useCondoUnitSurveyStore.getState().formData.structuralElements?.[activeElementIndex];
                              const curPhotos: string[] = curElem?.overviewPhotos || [];
                              const base = meta?.replacesUri
                                ? curPhotos.map((p) => (p === meta.replacesUri ? url : p))
                                : curPhotos;
                              const updated = base.includes(url) ? base : [...base, url];
                              const curCtx = curElem?.ctxPhotoUrl;
                              const newCtx = !curCtx ? url : meta?.replacesUri && curCtx === meta.replacesUri ? url : curCtx;
                              updateElement(activeElementIndex, {
                                overviewPhotos: updated,
                                ctxPhotoUrl: newCtx,
                              });
                            }
                          }}
                          watermarkOptions={{
                            parcelCode: bCode,
                            floor: `Tầng ${formData.floorNumber}`,
                            zoneOrRoom: activeElement.elementCode,
                            photoType: 'OVERVIEW',
                            photoIndex: (activeElement.overviewPhotos?.length || 0) + 1,
                          }}
                          height="96px"
                        />
                      )}
                    </div>
                  </div>

                  {/* Khảo sát khuyết tật trên cấu kiện chịu lực */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        disabled={isReadOnly}
                        checked={activeElement.hasDamage || (activeElement.defects && activeElement.defects.length > 0)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          updateElement(activeElementIndex, {
                            hasDamage: checked,
                            ctxPhotoUrl: activeElement.ctxPhotoUrl || activeElement.overviewPhotos?.[0] || '',
                          });
                        }}
                        className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-xs font-bold text-slate-800">
                        Cấu kiện {activeElement.elementCode} CÓ khuyết tật kết cấu cần ghi sổ D-xx
                      </span>
                    </label>

                    {(activeElement.hasDamage || (activeElement.defects && activeElement.defects.length > 0)) && (
                      <div className="p-3 bg-white rounded-xl border border-amber-200 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <span className="text-xs font-bold text-slate-800 block">
                              Ảnh Bối Cảnh Cấu Kiện (Photo CTX) & Thả Ghim Khuyết Tật D-xx
                            </span>
                            <span className="text-[11px] text-slate-500">
                              Đã ghi nhận: <strong className="text-amber-700 font-bold">{activeElement.defects?.length || 0} điểm khuyết tật kết cấu</strong>
                            </span>
                          </div>

                          <Button
                            size="sm"
                            className="bg-amber-600 hover:bg-amber-700 text-white cursor-pointer min-h-[40px]"
                            icon={<MapPin className="w-3.5 h-3.5" />}
                            onClick={() => {
                              if (!activeElement.ctxPhotoUrl) {
                                alert(`Vui lòng chụp ảnh bối cảnh (Photo CTX) cho cấu kiện ${activeElement.elementCode} trước khi chấm điểm khuyết tật!`);
                                return;
                              }
                              setPinningModalState({
                                isOpen: true,
                                mode: 'STRUCTURAL',
                                id: activeElement.id,
                                code: activeElement.elementCode,
                                name: `${activeElement.roomName} - ${activeElement.elementType}`,
                                ctxPhotoUrl: activeElement.ctxPhotoUrl,
                                defects: activeElement.defects || [],
                              });
                            }}
                          >
                            {activeElement.defects && activeElement.defects.length > 0
                              ? isReadOnly
                                ? `Xem ${activeElement.defects.length} ghim D-xx ➔`
                                : `Xem & Sửa ${activeElement.defects.length} ghim D-xx ➔`
                              : isReadOnly
                                ? 'Xem ghim khuyết tật kết cấu D-xx ➔'
                                : 'Chấm điểm khuyết tật kết cấu D-xx ➔'}
                          </Button>
                        </div>

                        <PhotoCaptureInput
                          label={`Ảnh bối cảnh cấu kiện chịu lực ${activeElement.elementCode}:`}
                          value={activeElement.ctxPhotoUrl || ''}
                          photoCode={activeElement.ctxPhotoCode}
                          readOnly={isReadOnly}
                          onChange={(url, code) =>
                            updateElement(activeElementIndex, {
                              ctxPhotoUrl: url,
                              ctxPhotoCode: code || activeElement.ctxPhotoCode,
                            })
                          }
                          recommendedOrientation="landscape"
                          watermarkOptions={{
                            parcelCode: bCode,
                            floor: `Tầng ${formData.floorNumber}`,
                            zoneOrRoom: activeElement.elementCode,
                            photoType: 'CTX',
                            photoIndex: 1,
                          }}
                          height="120px"
                        />

                        {/* Danh sách khuyết tật trên cấu kiện E */}
                        {activeElement.defects && activeElement.defects.length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-slate-100">
                            {activeElement.defects.map((d, dIdx) => (
                              <div
                                key={d.id || dIdx}
                                className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-start justify-between gap-2 text-xs"
                              >
                                <div className="flex items-start gap-2.5">
                                  <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200 shrink-0">
                                    {d.defectCode || `D-${String(dIdx + 1).padStart(2, '0')}`}
                                  </span>
                                  <div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                        {d.defectType || 'Nứt kết cấu'}
                                      </span>
                                      <span className="text-slate-700">
                                        W = <strong>{d.widthMaxMm}mm</strong> • L = <strong>{d.lengthMm}mm</strong> • E2 = <strong>{d.structuralSignificanceE2 || 1}</strong>
                                      </span>
                                    </div>
                                    {d.notes && <p className="text-slate-500 italic mt-0.5">{d.notes}</p>}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {d.cuPhotoUrl && (
                                    <div className="w-10 h-10 rounded border border-amber-300 overflow-hidden shrink-0">
                                      <TapToZoomThumbnail
                                        src={d.cuPhotoUrl}
                                        alt="CU"
                                        title="Ảnh cận cảnh thước đo"
                                        aspectClass="w-full h-full"
                                      />
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updatedDefects = (activeElement.defects || []).filter((_, idx) => idx !== dIdx);
                                      updateDefectsInElement(activeElement.id, updatedDefects);
                                    }}
                                    className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                                    title="Xóa khuyết tật này"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                  <div className="text-center py-6 text-xs text-slate-500">
                    Chưa có Cấu kiện kết cấu nào. Bấm "+ Thêm Cấu Kiện E" để thêm cột/dầm/sàn chịu lực.
                  </div>
                )}
              </Card>
            </>
          ) : (
            <Card className="p-4 bg-slate-50 border-slate-200 text-xs text-slate-600">
              Căn hộ con này không khảo sát cấu kiện chịu lực riêng biệt (Toàn bộ hệ khung cột, dầm, vách cứng được kế thừa theo hồ sơ Master của Tòa nhà chung cư).
            </Card>
          )}
        </div>
      )}

      {/* 3.3. BIẾN DẠNG KẾT CẤU & ĐO VÕNG DẦM SÀN (f/L) & KẸT CỬA */}
      <Card className="border-slate-200 bg-white shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Ruler className="w-5 h-5 text-teal-600 shrink-0" />
          <div>
            <h3 className="text-base font-bold text-slate-800">
              3.3. Đo Độ Võng Dầm Sàn ($f/L$) & Kiểm Tra Biến Dạng Cửa
            </h3>
            <p className="text-xs text-slate-500">
              Khảo sát tỉ số độ võng dầm/sàn nhịp lớn (TCVN 5574:2018) và tình trạng kẹt khung bao cửa
            </p>
          </div>
        </div>

        {/* 3.3.A: Đo độ võng dầm / sàn căn hộ */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-teal-600" />
              Đo độ võng kết cấu dầm / ô sàn (Beam / Slab Sagging $f/L$)
            </span>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer p-1">
              <input
                type="checkbox"
                checked={beamSagging.hasSagging}
                onChange={(e) =>
                  updateFormData({
                    beamSagging: {
                      ...beamSagging,
                      hasSagging: e.target.checked,
                    },
                  })
                }
                className="rounded text-teal-600 focus:ring-teal-500 w-5 h-5 cursor-pointer"
              />
              <span className={beamSagging.hasSagging ? 'text-teal-700 font-bold' : 'text-slate-500'}>
                {beamSagging.hasSagging ? 'CÓ VÕNG KẾT CẤU' : 'BÌNH THƯỜNG (KHÔNG VÕNG)'}
              </span>
            </label>
          </div>

          {beamSagging.hasSagging && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="Vị trí dầm / sàn đo độ võng *"
                  placeholder="VD: Dầm D1 giữa phòng khách, Ô sàn ban công..."
                  value={beamSagging.location || ''}
                  onChange={(e) => handleUpdateBeamSagging(undefined, undefined, e.target.value)}
                />
                <Input
                  label="Độ võng đo được f (mm) *"
                  type="number"
                  step="0.5"
                  placeholder="VD: 6.5"
                  value={beamSagging.sagMm || ''}
                  onChange={(e) => handleUpdateBeamSagging(Number(e.target.value) || 0)}
                />
                <Input
                  label="Chiều dài nhịp dầm/sàn L (m) *"
                  type="number"
                  step="0.1"
                  placeholder="VD: 4.2"
                  value={beamSagging.spanM || ''}
                  onChange={(e) => handleUpdateBeamSagging(undefined, Number(e.target.value) || 0)}
                />
              </div>

              {beamSagging.ratioText && (
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                    isBeamSagCritical()
                      ? 'bg-rose-50 border-rose-200 text-rose-900 font-bold'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-900 font-bold'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 shrink-0" />
                    <span>
                      Tỉ số độ võng: <strong>f/L = {beamSagging.ratioText}</strong> (Đo được {beamSagging.sagMm}mm trên nhịp {beamSagging.spanM}m)
                    </span>
                  </div>
                  <span>
                    {isBeamSagCritical()
                      ? '⚠️ Vượt ngưỡng an toàn 1/500 (TCVN 5574:2018)'
                      : '✓ Trong ngưỡng an toàn TCVN (<= 1/500)'}
                  </span>
                </div>
              )}

              <PhotoCaptureInput
                label="Ảnh chụp thước đo võng / tia laser cân bằng:"
                value={beamSagging.photoUrl || ''}
                readOnly={isReadOnly}
                onChange={(url) => handleUpdateBeamSagging(undefined, undefined, undefined, url)}
                watermarkOptions={{
                  parcelCode: bCode,
                  buildingCode: bCode,
                  floorCode,
                  floor: floorCode,
                  unitCode: formData.unitCode,
                  areaType: 'CONDO_UNIT',
                  category: 'deformation',
                  photoType: 'DEFORMATION',
                  zoneOrRoom: beamSagging.location || undefined,
                }}
                height="100px"
              />
            </div>
          )}
        </div>
      </Card>

      {/* Action Footer */}
      <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-200">
        <Button variant="secondary" size="md" onClick={prevStep} icon={<ArrowLeft className="w-4 h-4" />}>
          Bước 2 (Thông tin căn)
        </Button>
        <Button
          size="lg"
          className="bg-teal-600 hover:bg-teal-700 text-white min-h-[44px] shadow-md cursor-pointer"
          onClick={handleContinueToStep4}
          icon={<ArrowRight className="w-4 h-4" />}
        >
          Tiếp tục: Bước 4 (Tóm tắt & Nộp hồ sơ) ➔
        </Button>
      </div>

      {/* Modal Chấm Ghim Vết Nứt Trên Ảnh Bối Cảnh (Phase 1 DefectPinningModal) */}
      {pinningModalState && (
        <DefectPinningModal
          isOpen={pinningModalState.isOpen}
          mode={pinningModalState.mode}
          code={pinningModalState.code}
          name={pinningModalState.name}
          floorName={`Tầng ${formData.floorNumber}`}
          projectParcelCode={bCode}
          ctxPhotoUrl={pinningModalState.ctxPhotoUrl}
          defects={pinningModalState.defects}
          onChange={(newDefects) => {
            if (pinningModalState.mode === 'ARCHITECTURAL') {
              updateDefectsInZone(pinningModalState.id, newDefects);
            } else {
              updateDefectsInElement(pinningModalState.id, newDefects);
            }
            setPinningModalState((prev) => (prev ? { ...prev, defects: newDefects } : null));
          }}
          onClose={() => setPinningModalState(null)}
          readOnly={isReadOnly}
          watermarkOptions={{
            parcelCode: bCode,
            floor: `Tầng ${formData.floorNumber}`,
            zoneOrRoom: pinningModalState.code,
          }}
        />
      )}

      {/* Modal Chọn Ô Căn Hộ Từ Bản Đồ Tầng */}
      {showFloorPickerModal && (
        <div className="fixed inset-0 z-[100002] bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-white">
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-850 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-teal-400" />
                <h3 className="text-sm font-bold text-white">
                  Sơ Đồ Mặt Bằng {floorPlanData?.plan?.floor_name || `Tầng ${formData.floorNumber}`} • Chọn Căn {formData.displayCode || formData.unitCode} Để Import CAD
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFloorPickerModal(false)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {floorPlanData?.plan?.cad_photo_url ? (
                <div className="space-y-4">
                  {/* Thanh chọn nhanh toàn bộ bản vẽ tầng */}
                  <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-800/80 border border-slate-700">
                    <div className="text-xs text-slate-300">
                      💡 Dùng toàn bộ sơ đồ CAD Tầng {formData.floorNumber} làm bản vẽ tham chiếu cho căn hộ:
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (floorPlanData?.plan?.cad_photo_url) {
                          void importCadWithStorageAndQueue(floorPlanData.plan.cad_photo_url, null);
                        }
                      }}
                      className="px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shrink-0 cursor-pointer transition-colors shadow-xs"
                    >
                      Dùng toàn bộ CAD Tầng {formData.floorNumber}
                    </button>
                  </div>

                  <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 flex items-center justify-center p-2">
                    {isCroppingCad && (
                      <div className="absolute inset-0 bg-slate-950/80 z-20 flex flex-col items-center justify-center gap-2 backdrop-blur-xs">
                        <div className="w-7 h-7 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-teal-200 font-bold">Đang cắt sơ đồ căn hộ từ CAD tầng...</span>
                      </div>
                    )}

                    <img
                      src={floorPlanData.plan.cad_photo_url}
                      alt="Floor plan"
                      crossOrigin="anonymous"
                      className="max-h-[50vh] object-contain select-none"
                    />

                    {floorPlanData.units?.map((u: FloorPlanUnitItem) => {
                      if (!u.cad_bbox) return null;
                      const isTarget = u.unit_code === formData.unitCode;
                      const style = Array.isArray(u.cad_bbox)
                        ? {
                            left: `${u.cad_bbox[0]}%`,
                            top: `${u.cad_bbox[1]}%`,
                            width: `${u.cad_bbox[2] - u.cad_bbox[0]}%`,
                            height: `${u.cad_bbox[3] - u.cad_bbox[1]}%`,
                          }
                        : {
                            left: `${u.cad_bbox.x}%`,
                            top: `${u.cad_bbox.y}%`,
                            width: `${u.cad_bbox.width}%`,
                            height: `${u.cad_bbox.height}%`,
                          };

                      return (
                        <div
                          key={u.id}
                          style={style}
                          onClick={() => {
                            if (!isCroppingCad) {
                              void handleSelectPartitionCad(u);
                            }
                          }}
                          className={`absolute border-2 transition-all cursor-pointer flex items-center justify-center ${
                            isTarget
                              ? 'border-teal-400 bg-teal-500/30 animate-pulse'
                              : 'border-slate-500/50 bg-slate-700/20 hover:bg-slate-600/40'
                          }`}
                        >
                          <span className="text-[10px] font-mono font-bold bg-slate-900/90 text-white px-1.5 py-0.5 rounded shadow">
                            {u.unit_code}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {floorPlanData.units?.map((u: FloorPlanUnitItem) => (
                      <button
                        key={u.id}
                        type="button"
                        disabled={isCroppingCad}
                        onClick={() => void handleSelectPartitionCad(u)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          u.unit_code === formData.unitCode
                            ? 'bg-teal-950 border-teal-500 text-teal-200'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                        } ${isCroppingCad ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <div className="font-mono font-bold text-xs">{u.unit_code}</div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          {u.unit_cad_url ? '✓ Có CAD riêng' : u.cad_bbox ? '⚡ Cắt từ CAD tầng' : 'Dùng CAD tầng'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 text-xs">
                  {isLoadingFloorPlan
                    ? 'Đang tải sơ đồ mặt bằng tầng...'
                    : 'Tầng này chưa được cấu hình bản vẽ CAD mặt bằng kiến trúc.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Kiểm Tra Đối Soát Tính Đầy Đủ Z-E-D Trước Khi Sang Bước 4 */}
      {showValidationModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95">
            {/* Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Kiểm Tra Chất Lượng Dữ Liệu Khảo Sát Z - E - D
                  </h3>
                  <p className="text-xs text-slate-300">
                    Đối soát dữ liệu căn hộ {formData.unitCode || ''} trước khi chuyển sang Bước 4
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowValidationModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick stats pills */}
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2 overflow-x-auto text-xs font-semibold">
              <span className="px-2.5 py-1 rounded-full bg-teal-100 text-teal-800 border border-teal-200 flex items-center gap-1 shrink-0">
                <Check className="w-3.5 h-3.5" />
                {zones.length} Vùng Z
              </span>
              <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1 shrink-0">
                <Check className="w-3.5 h-3.5" />
                {structuralElements.length} Cấu kiện E
              </span>
              <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1 shrink-0">
                <Check className="w-3.5 h-3.5" />
                {allDefects.length} Khuyết tật D
              </span>
              {validationIssues.filter((i) => i.isBlocking).length > 0 ? (
                <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-200 font-bold shrink-0">
                  🚫 {validationIssues.filter((i) => i.isBlocking).length} Mục bắt buộc cần sửa
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 font-bold shrink-0">
                  ⚠️ {validationIssues.filter((i) => !i.isBlocking).length} Khuyến nghị
                </span>
              )}
            </div>

            {/* Issues list body */}
            <div className="p-5 overflow-y-auto space-y-3 flex-1 text-xs">
              <div className="text-slate-600 mb-2">
                Hệ thống phát hiện một số thông tin cần hoàn thiện hoặc khuyến nghị bổ sung để đảm bảo hồ sơ khảo sát đạt chuẩn Phase 1 Metro 2:
              </div>

              {validationIssues.map((issue, idx) => (
                <div
                  key={`issue-${idx}`}
                  className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                    issue.isBlocking
                      ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                      : 'bg-amber-50/70 border-amber-200 text-amber-950'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {issue.isBlocking ? (
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          issue.isBlocking
                            ? 'bg-rose-600 text-white'
                            : 'bg-amber-600 text-white'
                        }`}
                      >
                        {issue.isBlocking ? 'Bắt buộc' : 'Khuyến nghị'}
                      </span>
                      {issue.code && (
                        <span className="font-mono font-bold text-slate-800">
                          [{issue.code}]
                        </span>
                      )}
                      <span className="font-bold text-slate-900">{issue.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-700 leading-relaxed">{issue.message}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal footer actions */}
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setShowValidationModal(false)}
              >
                Quay lại bổ sung thông tin
              </Button>

              {validationIssues.some((i) => i.isBlocking) ? (
                <div className="text-right">
                  <span className="text-xs text-rose-700 font-bold block">
                    Vui lòng bổ sung đầy đủ các mục bắt buộc trước khi sang Bước 4
                  </span>
                  <span className="text-[10px] text-slate-500">
                    (Yêu cầu chuẩn kỹ thuật Phase 1 Metro 2: CU có thước đo, wmax vết nứt, CTX)
                  </span>
                </div>
              ) : (
                <Button
                  size="md"
                  className="bg-teal-600 hover:bg-teal-700 text-white cursor-pointer shadow-md"
                  onClick={() => {
                    setShowValidationModal(false);
                    nextStep();
                  }}
                  icon={<ArrowRight className="w-4 h-4" />}
                >
                  Tôi hiểu, vẫn tiếp tục sang Bước 4 ➔
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
