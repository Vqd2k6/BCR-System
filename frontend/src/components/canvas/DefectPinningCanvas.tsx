import React, { useState, useRef, useMemo } from 'react';
import { Crosshair, Trash2, Camera, AlertCircle, CheckCircle2, Ruler, Sparkles, MapPin, AlertTriangle, Eye, EyeOff, ZoomIn, Plus, RotateCcw } from 'lucide-react';
import { PhotoCaptureInput } from '../common/PhotoCaptureInput';
import { ImageZoomModal } from '../common/ImageZoomModal';
import { InfoPopover } from '../../core/components/ui/InfoPopover';
import { getNextAvailablePinCode } from './FloorCadPinningCanvas';
import { resolveOfflinePhotoUrl } from '../../core/storage/offlinePhotoStorage';

export interface DefectItem {
  id?: string;
  defectCode: string;
  pinX: number; // 0 to 100%
  pinY: number; // 0 to 100%
  screeningCategory: string;
  customScreeningCategory?: string;
  defectType: string;
  crackDirection?: string;
  widthMaxMm: number | '';
  lengthMm: number | '';
  activityState: 'U' | 'S' | 'A' | '';
  materialDegradationE4: number | '';
  structuralSignificanceE2: number | '';
  functionalImpactE6?: number | '';
  hasScaleCard: boolean;
  isStructuralCritical: boolean;
  cuPhotoUrl: string;
  cuPhotoCode?: string;
  cuPhotos?: string[];
  cuPhotoCodes?: string[];
  notes?: string;
  customizedFields?: string[];
  syncedFromDefectCode?: string;
}

interface Props {
  ctxPhotoUrl: string;
  defects: DefectItem[];
  onChange: (defects: DefectItem[]) => void;
  readOnly?: boolean;
  mode?: 'ARCHITECTURAL' | 'STRUCTURAL'; // Z vs E
  parcelCode?: string;
  floorName?: string;
  zoneOrElementCode?: string;
}

const CuPhotoThumbnailItem: React.FC<{
  photoUrl: string;
  pIdx: number;
  isPrimary: boolean;
  pCode?: string;
  defectCode: string;
  readOnly?: boolean;
  onZoom: (url: string, title: string, code?: string) => void;
  onRemove: (idx: number) => void;
}> = ({ photoUrl, pIdx, isPrimary, pCode, defectCode, readOnly, onZoom, onRemove }) => {
  const [displayUrl, setDisplayUrl] = React.useState<string>(photoUrl || '');

  React.useEffect(() => {
    let isSubscribed = true;
    if (photoUrl) {
      resolveOfflinePhotoUrl(photoUrl).then((resolved) => {
        if (isSubscribed && resolved) setDisplayUrl(resolved);
      });
    }
    return () => {
      isSubscribed = false;
    };
  }, [photoUrl]);

  const currentSrc = displayUrl || photoUrl;

  return (
    <div
      key={`cu_thumb_${pIdx}`}
      className="group relative aspect-[4/3] rounded-lg border border-slate-200 overflow-hidden bg-slate-900 shadow-xs cursor-pointer"
      onClick={() =>
        onZoom(
          currentSrc,
          `Khuyết tật ${defectCode} - Ảnh #${pIdx + 1}${isPrimary ? ' (Ảnh chính)' : ''}`,
          pCode
        )
      }
      title="Nhấn vào để phóng to"
    >
      <img
        src={currentSrc}
        alt={`Ảnh cận cảnh #${pIdx + 1}`}
        className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
      />

      {/* Badge số thứ tự ảnh */}
      <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm ${
            isPrimary
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-900/80 backdrop-blur-xs text-white'
          }`}
        >
          {isPrimary ? 'Ảnh 1 (Chính)' : `Ảnh #${pIdx + 1}`}
        </span>
      </div>

      {/* Nút Xem lớn / Xóa ảnh */}
      <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onZoom(
              currentSrc,
              `Khuyết tật ${defectCode} - Ảnh #${pIdx + 1}${isPrimary ? ' (Ảnh chính)' : ''}`,
              pCode
            );
          }}
          className="p-1 rounded bg-slate-900/80 hover:bg-slate-900 text-slate-200 hover:text-white transition-colors"
          title="Nhấn vào để phóng to"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        {!readOnly && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(pIdx);
            }}
            className="p-1 rounded bg-red-600/80 hover:bg-red-600 text-white transition-colors"
            title="Xóa ảnh này"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Badge Nhấn vào để phóng to ở dưới cùng */}
      <div className="absolute bottom-0 inset-x-0 bg-slate-950/85 backdrop-blur-xs px-1.5 py-0.5 flex items-center justify-between">
        <p className="text-[9px] font-mono text-emerald-400 truncate">
          {pCode || 'PHOTO_CU'}
        </p>
        <span className="text-[8px] text-slate-300 font-medium flex items-center gap-0.5 shrink-0">
          <ZoomIn className="w-2.5 h-2.5" /> Phóng to
        </span>
      </div>
    </div>
  );
};

const ARCH_SCREENING_CATEGORIES = [
  'Nứt tường gạch / Vữa trát hoàn thiện',
  'Nứt tiếp giáp khuôn cửa / Trần',
  'Nứt vỡ gạch ốp lát / Đá ốp',
  'Bong rộp / Bong tróc gạch ốp lát',
  'Thấm dột / Ẩm mốc bề mặt',
  'Kẹt cửa / Cong vênh phụ kiện',
  'Khác',
];

const ARCH_DEFECT_TYPES = [
  'Nứt chân chim / Mạng nhện vữa trát (<0.5mm)',
  'Nứt ziczac theo mạch vữa gạch',
  'Nứt góc cửa sổ / Cửa đi',
  'Nứt tiếp giáp Cột - Tường gạch',
  'Nứt tiếp giáp Dầm - Tường gạch',
  'Bong rộp sơn vôi / Ẩm mốc loang lổ',
  'Bong tách gạch ốp tường / Gạch lát nền',
  'Nứt trần thạch cao / Khe tiếp giáp la phông',
  'Khác',
];

const STRUCT_SCREENING_CATEGORIES = [
  'Nứt cấu kiện kết cấu chịu lực (Cột/Dầm/Sàn)',
  'Vỡ bê tông / Trơ rỉ cốt thép chịu lực',
  'Nứt nút khung / Mối nối liên kết chịu lực',
  'Võng uốn dầm sàn / Biến dạng cấu kiện',
  'Nứt gãy cổ cột / Móng tiếp giáp nền',
  'Khác',
];

const STRUCT_DEFECT_TYPES = [
  'Nứt xiên 45° chịu cắt gần đầu cột / gối dầm (Nguy hiểm)',
  'Nứt dọc thân cột bê tông (Quá tải nén dọc)',
  'Nứt uốn giữa nhịp dầm / Đáy bản sàn chịu lực',
  'Nứt toác / Bong bê tông lộ cốt thép gỉ sét',
  'Nứt tách mép tấm sàn BTCT chịu lực',
  'Nứt tách rời nút khung Cột - Dầm',
  'Nứt gãy chân cột / Cổ móng',
  'Lỏng rơ bu lông / Rách mối hàn liên kết thép',
  'Khác',
];

import { isCrackRelated } from './defectHelpers';
export { isCrackRelated };


export const DefectPinningCanvas: React.FC<Props> = ({
  ctxPhotoUrl,
  defects,
  onChange,
  readOnly = false,
  mode = 'ARCHITECTURAL',
  parcelCode,
  floorName,
  zoneOrElementCode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const detailFormRef = useRef<HTMLDivElement>(null);
  const [selectedDefectIndex, setSelectedDefectIndex] = useState<number | null>(null);
  const [isAddingPin, setIsAddingPin] = useState<boolean>(true);
  const [showPins, setShowPins] = useState<boolean>(true);
  const [draggingDefectIndex, setDraggingDefectIndex] = useState<number | null>(null);
  const [zoomModalImage, setZoomModalImage] = useState<{ url: string; title: string; code?: string } | null>(null);
  const dragMovedRef = useRef<boolean>(false);

  const screeningCategories = mode === 'STRUCTURAL' ? STRUCT_SCREENING_CATEGORIES : ARCH_SCREENING_CATEGORIES;
  const commonDefectTypes = mode === 'STRUCTURAL' ? STRUCT_DEFECT_TYPES : ARCH_DEFECT_TYPES;

  // Tự động tìm số thứ tự nhỏ nhất còn trống cho D-xx
  const nextDefectCode = getNextAvailablePinCode(
    defects.map((d) => ({ zoneCode: d.defectCode })),
    'D'
  );

  const handleContainerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingDefectIndex === null || readOnly || !containerRef.current) return;
    dragMovedRef.current = true;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(1, Math.min(99, parseFloat((((e.clientX - rect.left) / rect.width) * 100).toFixed(2))));
    const y = Math.max(1, Math.min(99, parseFloat((((e.clientY - rect.top) / rect.height) * 100).toFixed(2))));

    const updated = [...defects];
    if (updated[draggingDefectIndex]) {
      updated[draggingDefectIndex] = {
        ...updated[draggingDefectIndex],
        pinX: x,
        pinY: y,
      };
      onChange(updated);
    }
  };

  const handleCloneFromPreviousDefect = () => {
    if (selectedDefectIndex === null || readOnly) return;
    const candidate = defects
      .slice(0, selectedDefectIndex)
      .reverse()
      .find((d) => d.screeningCategory && d.defectType);

    if (!candidate) {
      alert('Chưa có khuyết tật D nào trước đó đã điền thông tin để sao chép!');
      return;
    }

    const current = defects[selectedDefectIndex];
    const cloned: DefectItem = {
      ...current,
      screeningCategory: candidate.screeningCategory,
      customScreeningCategory: candidate.customScreeningCategory,
      defectType: candidate.defectType,
      materialDegradationE4: candidate.materialDegradationE4,
      structuralSignificanceE2: candidate.structuralSignificanceE2,
      functionalImpactE6: candidate.functionalImpactE6,
      crackDirection: candidate.crackDirection || current.crackDirection,
      hasScaleCard: candidate.hasScaleCard ?? current.hasScaleCard,
      isStructuralCritical: candidate.isStructuralCritical ?? current.isStructuralCritical,
    };

    const updated = [...defects];
    updated[selectedDefectIndex] = cloned;
    onChange(updated);
  };

  const INHERITABLE_DEFECT_FIELDS: (keyof DefectItem)[] = [
    'screeningCategory',
    'customScreeningCategory',
    'defectType',
    'crackDirection',
    'activityState',
    'materialDegradationE4',
    'structuralSignificanceE2',
    'functionalImpactE6',
    'hasScaleCard',
    'isStructuralCritical',
  ];

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    if (readOnly || !isAddingPin || !containerRef.current || !ctxPhotoUrl) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = parseFloat((((e.clientX - rect.left) / rect.width) * 100).toFixed(2));
    const y = parseFloat((((e.clientY - rect.top) / rect.height) * 100).toFixed(2));

    const newDefectCode = getNextAvailablePinCode(
      defects.map((d) => ({ zoneCode: d.defectCode })),
      'D'
    );

    // Tìm điểm D gần nhất đã điền để tự động kế thừa (D_i-1 -> D_i)
    const candidate = [...defects].reverse().find((d) => d.screeningCategory || d.defectType);

    const newDefect: DefectItem = {
      defectCode: newDefectCode,
      pinX: x,
      pinY: y,
      screeningCategory: candidate
        ? candidate.screeningCategory
        : mode === 'STRUCTURAL'
        ? 'Nứt cấu kiện kết cấu chịu lực (Cột/Dầm/Sàn)'
        : 'Nứt tường gạch / Vữa trát hoàn thiện',
      customScreeningCategory: candidate?.customScreeningCategory || '',
      defectType: candidate?.defectType || '',
      crackDirection: candidate?.crackDirection || '',
      widthMaxMm: '' as any, // Bắt buộc đo riêng từng vết nứt
      lengthMm: '' as any,   // Bắt buộc đo riêng từng vết nứt
      activityState: candidate?.activityState || 'S',
      materialDegradationE4: candidate?.materialDegradationE4 ?? '',
      structuralSignificanceE2: candidate?.structuralSignificanceE2 ?? '',
      functionalImpactE6: candidate?.functionalImpactE6 ?? '',
      hasScaleCard: candidate ? candidate.hasScaleCard : true,
      isStructuralCritical: candidate ? candidate.isStructuralCritical : false,
      cuPhotoUrl: '',
      cuPhotoCode: '',
      cuPhotos: [],
      cuPhotoCodes: [],
      notes: '',
      customizedFields: [],
      syncedFromDefectCode: candidate ? candidate.defectCode : undefined,
    };

    const updated = [...defects, newDefect];
    onChange(updated);
    setSelectedDefectIndex(updated.length - 1);
    setIsAddingPin(false);
    setTimeout(() => {
      detailFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  };

  const removeDefect = (index: number) => {
    if (readOnly) return;
    const updated = defects.filter((_, i) => i !== index);
    onChange(updated);
    if (selectedDefectIndex === index) {
      setSelectedDefectIndex(null);
    } else if (selectedDefectIndex !== null && selectedDefectIndex > index) {
      setSelectedDefectIndex(selectedDefectIndex - 1);
    }
  };

  const updateSelectedDefect = (field: keyof DefectItem, value: any) => {
    if (selectedDefectIndex === null || readOnly) return;
    const updated = [...defects];
    const cur = { ...updated[selectedDefectIndex] };
    (cur as any)[field] = value;

    if (INHERITABLE_DEFECT_FIELDS.includes(field)) {
      const custom = new Set(cur.customizedFields || []);
      custom.add(field as string);
      cur.customizedFields = Array.from(custom);
    }
    updated[selectedDefectIndex] = cur;

    // Dây chuyền cascade: nếu trường này thay đổi, tự động cập nhật các điểm D kế tiếp chưa tùy chỉnh
    if (INHERITABLE_DEFECT_FIELDS.includes(field)) {
      for (let k = selectedDefectIndex + 1; k < updated.length; k++) {
        const nextDefect = { ...updated[k] };
        const nextCustom = nextDefect.customizedFields || [];
        if (!nextCustom.includes(field as string)) {
          (nextDefect as any)[field] = value;
          nextDefect.syncedFromDefectCode = updated[k - 1].defectCode;
          updated[k] = nextDefect;
        }
      }
    }

    onChange(updated);
  };

  const handleResetFieldToPrevious = (field: keyof DefectItem) => {
    if (selectedDefectIndex === null || selectedDefectIndex === 0 || readOnly) return;
    const prev = defects[selectedDefectIndex - 1];
    if (!prev) return;
    const updated = [...defects];
    const cur = { ...updated[selectedDefectIndex] };
    (cur as any)[field] = (prev as any)[field];
    cur.customizedFields = (cur.customizedFields || []).filter((f) => f !== field);
    updated[selectedDefectIndex] = cur;

    for (let k = selectedDefectIndex + 1; k < updated.length; k++) {
      const nextDefect = { ...updated[k] };
      if (!(nextDefect.customizedFields || []).includes(field as string)) {
        (nextDefect as any)[field] = (prev as any)[field];
        nextDefect.syncedFromDefectCode = updated[k - 1].defectCode;
        updated[k] = nextDefect;
      }
    }
    onChange(updated);
  };

  const handleResetAllToPrevious = () => {
    if (selectedDefectIndex === null || selectedDefectIndex === 0 || readOnly) return;
    const prev = defects[selectedDefectIndex - 1];
    if (!prev) return;
    const current = defects[selectedDefectIndex];
    const resetDefect: DefectItem = {
      ...current,
      screeningCategory: prev.screeningCategory,
      customScreeningCategory: prev.customScreeningCategory,
      defectType: prev.defectType,
      crackDirection: prev.crackDirection,
      activityState: prev.activityState,
      materialDegradationE4: prev.materialDegradationE4,
      structuralSignificanceE2: prev.structuralSignificanceE2,
      functionalImpactE6: prev.functionalImpactE6,
      hasScaleCard: prev.hasScaleCard,
      isStructuralCritical: prev.isStructuralCritical,
      customizedFields: [],
      syncedFromDefectCode: prev.defectCode,
    };
    const updated = [...defects];
    updated[selectedDefectIndex] = resetDefect;

    for (let k = selectedDefectIndex + 1; k < updated.length; k++) {
      const nextDefect = { ...updated[k] };
      const nextCustom = nextDefect.customizedFields || [];
      for (const f of INHERITABLE_DEFECT_FIELDS) {
        if (!nextCustom.includes(f as string)) {
          (nextDefect as any)[f] = (resetDefect as any)[f];
        }
      }
      nextDefect.syncedFromDefectCode = updated[k - 1].defectCode;
      updated[k] = nextDefect;
    }

    onChange(updated);
  };

  const handleBulkApplyDownstreamDefects = () => {
    if (selectedDefectIndex === null || readOnly) return;
    const cur = defects[selectedDefectIndex];
    if (!cur.screeningCategory || !cur.defectType) {
      alert('Vui lòng chọn đầy đủ Nhóm chỉ báo và Dạng nứt cho điểm D này trước khi đồng bộ!');
      return;
    }
    const isRoot = selectedDefectIndex === 0;
    const downstreamCount = defects.length - 1 - selectedDefectIndex;
    if (downstreamCount <= 0 && !isRoot) return;

    const confirmMsg = isRoot
      ? `Bạn có chắc muốn áp dụng phân loại và chỉ số kỹ thuật của ${cur.defectCode} cho toàn bộ các điểm D còn lại trên mảng này? (Kích thước w, L và ảnh cận cảnh sẽ được giữ nguyên)`
      : `Bạn có chắc muốn áp dụng phân loại của ${cur.defectCode} cho ${downstreamCount} điểm D phía sau? (Các điểm D phía trước sẽ được giữ nguyên 100%)`;

    if (!confirm(confirmMsg)) return;

    const updated = defects.map((d, idx) => {
      // Chỉ áp dụng xuôi chiều cho các điểm phía sau idx > selectedDefectIndex
      if (idx <= selectedDefectIndex) return d;
      return {
        ...d,
        screeningCategory: cur.screeningCategory,
        customScreeningCategory: cur.customScreeningCategory,
        defectType: cur.defectType,
        crackDirection: cur.crackDirection || d.crackDirection,
        activityState: cur.activityState || d.activityState,
        materialDegradationE4: cur.materialDegradationE4 !== '' ? cur.materialDegradationE4 : d.materialDegradationE4,
        structuralSignificanceE2: cur.structuralSignificanceE2 !== '' ? cur.structuralSignificanceE2 : d.structuralSignificanceE2,
        functionalImpactE6: cur.functionalImpactE6 !== '' ? cur.functionalImpactE6 : d.functionalImpactE6,
        hasScaleCard: cur.hasScaleCard ?? d.hasScaleCard,
        isStructuralCritical: cur.isStructuralCritical ?? d.isStructuralCritical,
        syncedFromDefectCode: cur.defectCode,
        customizedFields: [],
      };
    });
    onChange(updated);
  };

  const selectedDefect =
    selectedDefectIndex !== null && selectedDefectIndex >= 0 && selectedDefectIndex < defects.length
      ? defects[selectedDefectIndex] || null
      : null;
  const prevDefect = selectedDefectIndex !== null && selectedDefectIndex > 0 ? defects[selectedDefectIndex - 1] : null;
  const isStructural = mode === 'STRUCTURAL';
  const isDefectRoot = selectedDefectIndex === 0;
  const downstreamDefectCount = selectedDefectIndex !== null ? defects.length - 1 - selectedDefectIndex : 0;
  const defectCustomFields = selectedDefect?.customizedFields || [];
  const hasCustomizedDefectFields = defectCustomFields.length > 0;

  // Đảm bảo selectedDefectIndex luôn đồng bộ và an toàn với kích thước mảng defects
  React.useEffect(() => {
    if (selectedDefectIndex !== null) {
      if (defects.length === 0) {
        setSelectedDefectIndex(null);
      } else if (selectedDefectIndex >= defects.length) {
        setSelectedDefectIndex(defects.length - 1);
      }
    }
  }, [defects.length, selectedDefectIndex]);

  const renderDefectFieldBadge = (field: keyof DefectItem) => {
    if (!prevDefect || !selectedDefect) return null;
    const isCustom = defectCustomFields.includes(field as string);
    if (!isCustom) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded mt-1">
          <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
          Đồng bộ từ {prevDefect.defectCode}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded mt-1">
        Đã chỉnh riêng cho {selectedDefect.defectCode}
        {!readOnly && (
          <button
            type="button"
            onClick={() => handleResetFieldToPrevious(field)}
            className="text-emerald-600 hover:underline cursor-pointer ml-1 font-semibold"
            title={`Khôi phục trường này theo ${prevDefect.defectCode}`}
          >
            ↺ Lấy lại
          </button>
        )}
      </span>
    );
  };

  // Kiểm tra xem 1 điểm D đã điền đầy đủ mọi trường bắt buộc chưa
  const isDefectFilled = (d: DefectItem) => {
    const isCrack = isCrackRelated(d.screeningCategory, d.defectType);
    const hasPhoto = Boolean(d.cuPhotoUrl || (Array.isArray(d.cuPhotos) && d.cuPhotos.length > 0));
    const baseOk = Boolean(
      hasPhoto &&
      d.notes &&
      d.notes.trim().length > 0 &&
      d.screeningCategory &&
      (d.screeningCategory !== 'Khác' || (d.customScreeningCategory && d.customScreeningCategory.trim().length > 0)) &&
      d.defectType &&
      d.functionalImpactE6 !== '' &&
      d.functionalImpactE6 !== undefined
    );
    if (!baseOk) return false;

    if (mode === 'STRUCTURAL') {
      if (d.structuralSignificanceE2 === '' || d.structuralSignificanceE2 === undefined) return false;
      if (d.materialDegradationE4 === '' || d.materialDegradationE4 === undefined) return false;
    }

    if (isCrack) {
      if (!d.crackDirection || d.crackDirection.trim().length === 0) return false;
      if (d.widthMaxMm === '' || Number(d.widthMaxMm) <= 0) return false;
      if (d.lengthMm === '' || Number(d.lengthMm) <= 0) return false;
      if (!d.activityState) return false;
    }

    return true;
  };

  return (
    <div className="flex flex-col gap-3 w-full bg-white">
      {/* Top Control Bar with Quick Info */}
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span className="font-bold text-slate-800">
                Ghi sổ khuyết tật ({defects.length} điểm D):
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px]">
              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                <span className="w-2 h-2 rounded-xs bg-emerald-500 inline-block" />
                Đã điền đủ ({defects.filter(isDefectFilled).length})
              </span>
              <span className="flex items-center gap-1 text-amber-700 font-medium">
                <span className="w-2 h-2 rounded-xs bg-amber-500 inline-block" />
                Chưa đủ thông số ({defects.filter((d) => !isDefectFilled(d)).length})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Eye toggle button */}
            <button
              type="button"
              onClick={() => setShowPins(!showPins)}
              className={`px-2.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all border ${
                showPins
                  ? 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  : 'bg-amber-100 text-amber-800 border-amber-300 ring-2 ring-amber-400'
              }`}
              title={showPins ? "Bấm để ẩn ghim xem ảnh bối cảnh rõ hơn" : "Bấm để hiển thị lại các ghim"}
            >
              {showPins ? <Eye className="w-3.5 h-3.5 text-slate-500" /> : <EyeOff className="w-3.5 h-3.5 text-amber-700" />}
              <span>{showPins ? 'Ẩn ghim D' : 'Hiện ghim D'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddingPin(!isAddingPin)}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs ${
                isAddingPin
                  ? 'bg-red-600 text-white ring-2 ring-red-400'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>{isAddingPin ? `Đang bật chạm chấm ${nextDefectCode}` : `Bật chạm chấm ${nextDefectCode}`}</span>
            </button>
          </div>
        </div>
      )}

      {/* Pinning Canvas - Clean Light Theme */}
      <div
        ref={containerRef}
        onClick={handleContainerClick}
        onPointerMove={handleContainerPointerMove}
        onPointerUp={() => setDraggingDefectIndex(null)}
        className={`relative w-full min-h-[300px] max-h-[480px] rounded-xl overflow-hidden bg-slate-100 border border-slate-300 select-none shadow-inner touch-none ${
          isAddingPin ? 'cursor-crosshair ring-2 ring-emerald-500/30' : 'cursor-default'
        } flex items-center justify-center`}
      >
        <img
          src={ctxPhotoUrl}
          alt="Context Photo for Defects"
          className="max-h-[480px] w-full object-contain pointer-events-none select-none"
        />

        {/* Existing Pins with Drag & Drop */}
        {showPins && defects.map((d, idx) => {
          const isSelected = selectedDefectIndex === idx;
          const isDragging = draggingDefectIndex === idx;
          const isFilled = isDefectFilled(d);
          const squareBg = isFilled ? '#10b981' : '#f59e0b';

          return (
            <div
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                if (!dragMovedRef.current) {
                  setSelectedDefectIndex(idx);
                  setIsAddingPin(false);
                  setTimeout(() => {
                    detailFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                  }, 60);
                }
              }}
              onPointerDown={(e) => {
                if (readOnly) return;
                e.stopPropagation();
                dragMovedRef.current = false;
                setDraggingDefectIndex(idx);
                setSelectedDefectIndex(idx);
                (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
              }}
              onPointerUp={(e) => {
                if (readOnly) return;
                e.stopPropagation();
                try {
                  (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
                } catch (_) {}
                setDraggingDefectIndex(null);
              }}
              style={{
                position: 'absolute',
                left: `${d.pinX}%`,
                top: `${d.pinY}%`,
                transform: isDragging ? 'translate(-50%, -50%) scale(1.25)' : isSelected ? 'translate(-50%, -50%) scale(1.1)' : 'translate(-50%, -50%)',
                cursor: readOnly ? 'default' : isDragging ? 'grabbing' : 'grab',
                zIndex: isDragging ? 50 : isSelected ? 30 : 20,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                touchAction: 'none',
                userSelect: 'none',
                transition: isDragging ? 'none' : 'transform 0.15s ease',
              }}
              title={readOnly ? undefined : `${d.defectCode}: ${d.defectType || 'Chưa chọn'} (Chạm chọn hoặc Giữ & Kéo để di chuyển)`}
            >
              <div
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  padding: '1px 5px',
                  borderRadius: '3px',
                  backgroundColor: isDragging ? '#0284c7' : isSelected ? '#0284c7' : 'rgba(15, 23, 42, 0.9)',
                  color: '#ffffff',
                  border: isDragging ? '2px solid #38bdf8' : isSelected ? '1.5px solid #ffffff' : '1px solid rgba(255,255,255,0.4)',
                  whiteSpace: 'nowrap',
                  boxShadow: isDragging ? '0 4px 10px rgba(2, 132, 199, 0.5)' : '0 2px 4px rgba(0,0,0,0.3)',
                }}
              >
                {d.defectCode}
              </div>

              <div
                style={{
                  width: isSelected || isDragging ? '14px' : '12px',
                  height: isSelected || isDragging ? '14px' : '12px',
                  borderRadius: '2px',
                  backgroundColor: squareBg,
                  border: '2px solid #ffffff',
                  boxShadow: '0 0 6px rgba(0,0,0,0.4)',
                  marginTop: '1px',
                  transition: 'transform 0.15s ease',
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Selected Defect Detail Card */}
      {selectedDefect && selectedDefectIndex !== null && (
        <div ref={detailFormRef} className="relative p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5 shadow-2xs">
          {/* Top Glow Line (Emerald cho Kiến trúc, Amber cho Kết cấu) */}
          <div
            className={`h-[2.5px] w-full ${
              isStructural
                ? 'bg-gradient-to-r from-amber-400 via-orange-300 to-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)]'
                : 'bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]'
            } rounded-full`}
          />

          <div className="flex items-center justify-between pb-2 border-b border-slate-200 flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500">Mã D:</span>
                <input
                  type="text"
                  value={selectedDefect.defectCode}
                  onChange={(e) => updateSelectedDefect('defectCode', e.target.value.toUpperCase())}
                  className="px-2 py-0.5 bg-slate-900 text-white font-mono font-bold text-xs rounded border border-slate-700 w-20 uppercase focus:ring-1 focus:ring-emerald-400"
                  disabled={readOnly}
                  title="Đổi mã khuyết tật D"
                />
              </div>
              <span className="font-bold text-sm text-slate-800">
                Thông số chi tiết vết nứt / khuyết tật ({selectedDefect.defectCode})
              </span>
              {isDefectFilled(selectedDefect) ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Đã điền đầy đủ tất cả các trường
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                  Bắt buộc điền đầy đủ các trường bên dưới
                </span>
              )}
            </div>

            {!readOnly && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {isDefectRoot && defects.length > 1 && (
                  <button
                    type="button"
                    onClick={handleBulkApplyDownstreamDefects}
                    className={`px-2.5 py-1 ${
                      isStructural
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    } rounded-lg text-xs font-bold flex items-center gap-1 transition-all shadow-xs cursor-pointer`}
                    title="Đồng bộ phân loại và chỉ số kỹ thuật của D-01 cho tất cả các điểm D còn lại trên mảng này"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Đồng bộ cho mảng này</span>
                  </button>
                )}
                {!isDefectRoot && downstreamDefectCount > 0 && (
                  <button
                    type="button"
                    onClick={handleBulkApplyDownstreamDefects}
                    className={`px-2.5 py-1 ${
                      isStructural
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    } rounded-lg text-xs font-bold flex items-center gap-1 transition-all shadow-xs cursor-pointer`}
                    title={`Đồng bộ phân loại cho ${downstreamDefectCount} điểm D phía sau (không ảnh hưởng các điểm D phía trước)`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Đồng bộ cho các D còn lại ({downstreamDefectCount})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeDefect(selectedDefectIndex)}
                  className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  title="Xóa điểm D này"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa</span>
                </button>
              </div>
            )}
          </div>

          {/* Form fields for Defect Details */}
          <div className={`grid grid-cols-1 ${isCrackRelated(selectedDefect.screeningCategory, selectedDefect.defectType) ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3`}>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nhóm chỉ báo *
              </label>
              <select
                className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs font-medium focus:ring-1 focus:ring-emerald-500 ${
                  !selectedDefect.screeningCategory ? 'border-amber-400 bg-amber-50/30' : 'border-emerald-500 bg-emerald-50/15'
                }`}
                value={selectedDefect.screeningCategory}
                onChange={(e) => updateSelectedDefect('screeningCategory', e.target.value)}
                disabled={readOnly}
              >
                <option value="">--- Chọn nhóm chỉ báo ---</option>
                {screeningCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {renderDefectFieldBadge('screeningCategory')}
              {selectedDefect.screeningCategory === 'Khác' && (
                <div className="mt-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Tên nhóm chỉ báo tùy chỉnh *
                  </label>
                  <input
                    type="text"
                    placeholder="Nhập nhóm chỉ báo tùy chỉnh..."
                    className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs font-medium focus:ring-1 focus:ring-emerald-500 ${
                      !selectedDefect.customScreeningCategory?.trim() ? 'border-amber-400 bg-amber-50/30' : 'border-emerald-500 bg-emerald-50/15'
                    }`}
                    value={selectedDefect.customScreeningCategory || ''}
                    onChange={(e) => updateSelectedDefect('customScreeningCategory', e.target.value)}
                    disabled={readOnly}
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Dạng nứt / Cấu kiện *
              </label>
              <select
                className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs font-medium focus:ring-1 focus:ring-emerald-500 ${
                  !selectedDefect.defectType ? 'border-amber-400 bg-amber-50/30' : 'border-emerald-500 bg-emerald-50/15'
                }`}
                value={selectedDefect.defectType}
                onChange={(e) => updateSelectedDefect('defectType', e.target.value)}
                disabled={readOnly}
              >
                <option value="">--- Chọn dạng nứt / khuyết tật ---</option>
                {commonDefectTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {renderDefectFieldBadge('defectType')}
            </div>

            {isCrackRelated(selectedDefect.screeningCategory, selectedDefect.defectType) && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Hướng nứt *
                </label>
                <input
                  type="text"
                  placeholder="VD: Xiên 45° từ góc cửa sổ lên dầm..."
                  className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 ${
                    !selectedDefect.crackDirection ? 'border-amber-400 bg-amber-50/30' : 'border-emerald-500 bg-emerald-50/15'
                  }`}
                  value={selectedDefect.crackDirection || ''}
                  onChange={(e) => updateSelectedDefect('crackDirection', e.target.value)}
                  disabled={readOnly}
                />
                {renderDefectFieldBadge('crackDirection')}
              </div>
            )}
          </div>

          {/* Dimensions & Scale */}
          {isCrackRelated(selectedDefect.screeningCategory, selectedDefect.defectType) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Bề rộng lớn nhất w_max (mm) *
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  placeholder="VD: 0.8"
                  className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs font-mono font-bold focus:ring-1 focus:ring-emerald-500 ${
                    !selectedDefect.widthMaxMm ? 'border-amber-400 bg-amber-50/30' : 'border-emerald-500 bg-emerald-50/15'
                  }`}
                  value={selectedDefect.widthMaxMm === '' ? '' : selectedDefect.widthMaxMm}
                  onChange={(e) =>
                    updateSelectedDefect(
                      'widthMaxMm',
                      e.target.value === '' ? ('' as any) : parseFloat(e.target.value) || 0
                    )
                  }
                  disabled={readOnly}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Chiều dài nứt L (mm) *
                </label>
                <input
                  type="number"
                  step="10"
                  min="0"
                  placeholder="VD: 450"
                  className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs font-mono font-bold focus:ring-1 focus:ring-emerald-500 ${
                    !selectedDefect.lengthMm ? 'border-amber-400 bg-amber-50/30' : 'border-emerald-500 bg-emerald-50/15'
                  }`}
                  value={selectedDefect.lengthMm === '' ? '' : selectedDefect.lengthMm}
                  onChange={(e) =>
                    updateSelectedDefect(
                      'lengthMm',
                      e.target.value === '' ? ('' as any) : parseFloat(e.target.value) || 0
                    )
                  }
                  disabled={readOnly}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Trạng thái hoạt động *
                </label>
                <select
                  className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs font-medium focus:ring-1 focus:ring-emerald-500 ${
                    !selectedDefect.activityState ? 'border-amber-400 bg-amber-50/30' : 'border-emerald-500 bg-emerald-50/15'
                  }`}
                  value={selectedDefect.activityState}
                  onChange={(e) => updateSelectedDefect('activityState', e.target.value)}
                  disabled={readOnly}
                >
                  <option value="">--- Chọn trạng thái hoạt động ---</option>
                  <option value="U">U - Chưa rõ / Đang kiểm tra (Unknown)</option>
                  <option value="S">S - Ổn định / Nứt cũ (Stable)</option>
                  <option value="A">A - Đang phát triển / Hoạt động (Active)</option>
                </select>
                {renderDefectFieldBadge('activityState')}
              </div>
            </div>
          )}

          {/* Scoring Fields */}
          <div className={`grid grid-cols-1 ${mode === 'STRUCTURAL' ? 'sm:grid-cols-3' : 'sm:grid-cols-1'} gap-3 p-3 bg-white rounded-xl border border-slate-200`}>
            {mode === 'STRUCTURAL' && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      Ý nghĩa kết cấu (Nguồn E2) *
                    </label>
                    <InfoPopover title="Ý nghĩa kết cấu khuyết tật (Nguồn tính E2)" size="md">
                      <p><strong>Bản chất:</strong> Đánh giá mức độ ảnh hưởng của vết nứt/khuyết tật này tới khả năng chịu lực của kết cấu (cột, dầm, sàn, tường chịu lực).</p>
                      <p className="mt-1"><strong>Cách tính vào ECS:</strong> Điểm E2 toàn công trình sẽ lấy giá trị <em>LỚN NHẤT (Max)</em> từ tất cả các khuyết tật D được khảo sát.</p>
                      <ul className="list-disc pl-3.5 space-y-0.5 text-[11px] text-slate-600 mt-1.5 pt-1.5 border-t border-slate-100">
                        <li><strong>0đ (None):</strong> Vết nứt nông trang trí/vữa trát, không ảnh hưởng kết cấu.</li>
                        <li><strong>1đ (Low):</strong> Nứt vi mô bề mặt bê tông do co ngót, ngoài vùng chịu lực chính.</li>
                        <li><strong>2đ (Moderate):</strong> Nứt rõ ở cấu kiện chịu lực nhưng bề rộng ổn định, chưa suy giảm sức kháng cắt/uốn.</li>
                        <li><strong>3đ (High):</strong> Nứt chéo xiên 45° gần gối dầm/cột, hoặc nứt vùng nén (Tự động kích hoạt Review kết cấu).</li>
                        <li><strong>4đ (Critical):</strong> Bê tông bị vỡ vụn, nứt toác, cốt thép biến dạng cong vênh (Báo động nguy cấp).</li>
                      </ul>
                    </InfoPopover>
                  </div>
                  <select
                    className={`w-full px-2.5 py-1.5 bg-slate-50 border rounded-lg text-xs font-medium focus:ring-1 focus:ring-emerald-500 ${
                      selectedDefect.structuralSignificanceE2 === '' || selectedDefect.structuralSignificanceE2 === undefined
                        ? 'border-amber-400 bg-amber-50/30'
                        : 'border-emerald-500 bg-emerald-50/15'
                    }`}
                    value={selectedDefect.structuralSignificanceE2 ?? ''}
                    onChange={(e) =>
                      updateSelectedDefect(
                        'structuralSignificanceE2',
                        e.target.value === '' ? '' : parseInt(e.target.value, 10)
                      )
                    }
                    disabled={readOnly}
                  >
                    <option value="">--- Chọn mức ý nghĩa kết cấu (E2) ---</option>
                    <option value={0}>0đ - None / Không ảnh hưởng kết cấu</option>
                    <option value={1}>1đ - Low / Thấp (Nứt co ngót nhẹ)</option>
                    <option value={2}>2đ - Moderate / Trung bình (Nứt rõ, ổn định)</option>
                    <option value={3}>3đ - High / Cao (Nứt xiên gần gối / vùng nén)</option>
                    <option value={4}>4đ - Critical / Nguy cấp (Vỡ vụn bê tông / trơ thép)</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      Suy giảm vật liệu (Nguồn E4) *
                    </label>
                    <InfoPopover title="Suy giảm độ bền vật liệu (Nguồn tính E4)" size="md">
                      <p><strong>Bản chất:</strong> Mức độ thoái hóa, phong hóa, bong tróc của bê tông, cốt thép và gạch xây tại vị trí khuyết tật.</p>
                      <p className="mt-1"><strong>Cách tính vào ECS:</strong> Điểm E4 toàn công trình sẽ lấy giá trị <em>LỚN NHẤT (Max)</em> từ các khuyết tật D.</p>
                      <ul className="list-disc pl-3.5 space-y-0.5 text-[11px] text-slate-600 mt-1.5 pt-1.5 border-t border-slate-100">
                        <li><strong>0đ (Không/rất nhẹ):</strong> Bê tông chắc đặc, vạch không xước, không ẩm mốc.</li>
                        <li><strong>1đ (Cục bộ):</strong> Bong tróc nhẹ lớp sơn vôi hoặc vữa trát một vài điểm.</li>
                        <li><strong>2đ (Đáng kể):</strong> Rỗ tổ ong bê tông, phong hóa mục vữa diện rộng, chưa lộ cốt thép.</li>
                        <li><strong>3đ (Nặng/lộ thép):</strong> Bê tông nứt bong mảng làm lộ thanh thép gỉ sét, giảm tiết diện.</li>
                        <li><strong>4đ (Mất tiết diện):</strong> Cốt thép đứt rỉ nghiêm trọng, bê tông mục nát mất liên kết chịu lực.</li>
                      </ul>
                    </InfoPopover>
                  </div>
                  <select
                    className={`w-full px-2.5 py-1.5 bg-slate-50 border rounded-lg text-xs font-medium focus:ring-1 focus:ring-emerald-500 ${
                      selectedDefect.materialDegradationE4 === '' || selectedDefect.materialDegradationE4 === undefined
                        ? 'border-amber-400 bg-amber-50/30'
                        : 'border-emerald-500 bg-emerald-50/15'
                    }`}
                    value={selectedDefect.materialDegradationE4 ?? ''}
                    onChange={(e) =>
                      updateSelectedDefect(
                        'materialDegradationE4',
                        e.target.value === '' ? '' : parseInt(e.target.value, 10)
                      )
                    }
                    disabled={readOnly}
                  >
                    <option value="">--- Chọn mức suy giảm vật liệu (E4) ---</option>
                    <option value={0}>0đ - Không / Rất nhẹ</option>
                    <option value={1}>1đ - Cục bộ (Bong tróc nhẹ sơn vữa)</option>
                    <option value={2}>2đ - Đáng kể (Rỗ tổ ong, mục vữa diện rộng)</option>
                    <option value={3}>3đ - Nặng (Bê tông bung, cốt thép rỉ sét)</option>
                    <option value={4}>4đ - Mất tiết diện / Cốt thép đứt rỉ</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  Ảnh hưởng chức năng *
                </label>
                <InfoPopover title="Ảnh hưởng chức năng sử dụng (Nguồn tính E6)" size="md">
                  <p><strong>Bản chất:</strong> Hậu quả của khuyết tật đến công năng sinh hoạt thực tế (thấm dột, kẹt cửa, thoát nạn, đường ống).</p>
                  <p className="mt-1"><strong>Cách tính vào ECS:</strong> Góp phần vào chỉ số tổng thể E6 cùng với tình trạng thấm dột, kẹt cửa toàn nhà.</p>
                  <ul className="list-disc pl-3.5 space-y-0.5 text-[11px] text-slate-600 mt-1.5 pt-1.5 border-t border-slate-100">
                    <li><strong>Không ảnh hưởng:</strong> Sinh hoạt, vận hành bình thường.</li>
                    <li><strong>Ẩm mốc:</strong> Ẩm mốc bề mặt nhẹ.</li>
                    <li><strong>Thấm nước:</strong> Thấm ẩm tường, dầm hoặc sàn bê tông.</li>
                    <li><strong>Dột nước:</strong> Nước dột chảy thành dòng khi trời mưa hoặc rò từ tầng trên.</li>
                    <li><strong>Rò rỉ nước tràn:</strong> Rò rỉ nước gây ngập, nguy cơ chập cháy điện.</li>
                    <li><strong>Kẹt cửa:</strong> Cửa đi/cửa sổ bị chèn ép, khó đóng mở hoặc kẹt cứng.</li>
                  </ul>
                </InfoPopover>
              </div>
              <select
                className={`w-full px-2.5 py-1.5 bg-slate-50 border rounded-lg text-xs font-medium focus:ring-1 focus:ring-emerald-500 ${
                  selectedDefect.functionalImpactE6 === '' || selectedDefect.functionalImpactE6 === undefined
                    ? 'border-amber-400 bg-amber-50/30'
                    : 'border-emerald-500 bg-emerald-50/15'
                }`}
                value={selectedDefect.functionalImpactE6 === '' || selectedDefect.functionalImpactE6 === undefined ? '' : selectedDefect.functionalImpactE6}
                onChange={(e) =>
                  updateSelectedDefect(
                    'functionalImpactE6',
                    e.target.value === '' ? '' : parseInt(e.target.value, 10)
                  )
                }
                disabled={readOnly}
              >
                <option value="">--- Chọn ảnh hưởng chức năng ---</option>
                <option value={0}>Không ảnh hưởng chức năng</option>
                <option value={1}>Ẩm mốc</option>
                <option value={2}>Thấm nước</option>
                <option value={3}>Dột nước</option>
                <option value={4}>Rò rỉ nước tràn</option>
                <option value={5}>Kẹt cửa</option>
              </select>
            </div>
          </div>

          {/* Photo CU & Notes */}
          {(() => {
            const currentCuPhotos: string[] = Array.isArray(selectedDefect.cuPhotos) && selectedDefect.cuPhotos.length > 0
              ? selectedDefect.cuPhotos
              : (selectedDefect.cuPhotoUrl ? [selectedDefect.cuPhotoUrl] : []);
            const currentCuCodes: string[] = Array.isArray(selectedDefect.cuPhotoCodes) && selectedDefect.cuPhotoCodes.length > 0
              ? selectedDefect.cuPhotoCodes
              : (selectedDefect.cuPhotoCode ? [selectedDefect.cuPhotoCode] : []);

            const handleAddCuPhoto = (url: string, code?: string) => {
              if (selectedDefectIndex === null) return;
              const nextPhotos = [...currentCuPhotos, url];
              const nextCodes = [...currentCuCodes, code || ''];
              const next = [...defects];
              next[selectedDefectIndex] = {
                ...next[selectedDefectIndex],
                cuPhotos: nextPhotos,
                cuPhotoCodes: nextCodes,
                cuPhotoUrl: nextPhotos[0] || '',
                cuPhotoCode: nextCodes[0] || '',
              };
              onChange(next);
            };

            const handleRemoveCuPhoto = (indexToRemove: number) => {
              if (selectedDefectIndex === null || readOnly) return;
              const nextPhotos = currentCuPhotos.filter((_, i) => i !== indexToRemove);
              const nextCodes = currentCuCodes.filter((_, i) => i !== indexToRemove);
              const next = [...defects];
              next[selectedDefectIndex] = {
                ...next[selectedDefectIndex],
                cuPhotos: nextPhotos,
                cuPhotoCodes: nextCodes,
                cuPhotoUrl: nextPhotos[0] || '',
                cuPhotoCode: nextCodes[0] || '',
              };
              onChange(next);
            };

            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Cụm Multi-Photo CU */}
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700">
                      Bộ ảnh cận cảnh có thước đo ({selectedDefect.defectCode}) *:
                    </label>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        currentCuPhotos.length > 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {currentCuPhotos.length > 0
                        ? `${currentCuPhotos.length} ảnh đã chụp`
                        : 'Chưa có ảnh (Bắt buộc)'}
                    </span>
                  </div>

                  {/* Lưới Thumbnail các ảnh đã chụp */}
                  {currentCuPhotos.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                      {currentCuPhotos.map((photoUrl, pIdx) => {
                        const pCode =
                          currentCuCodes[pIdx] ||
                          (pIdx === 0 ? selectedDefect.cuPhotoCode : undefined);
                        const isPrimary = pIdx === 0;
                        return (
                          <CuPhotoThumbnailItem
                            key={`cu_thumb_${pIdx}`}
                            photoUrl={photoUrl}
                            pIdx={pIdx}
                            isPrimary={isPrimary}
                            pCode={pCode}
                            defectCode={selectedDefect.defectCode}
                            readOnly={readOnly}
                            onZoom={(url, title, code) =>
                              setZoomModalImage({ url, title, code })
                            }
                            onRemove={handleRemoveCuPhoto}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* Slot chụp thêm ảnh mới */}
                  <PhotoCaptureInput
                    key={`photo_input_${selectedDefect.defectCode}_${currentCuPhotos.length}`}
                    label={
                      currentCuPhotos.length === 0
                        ? `Chụp ảnh cận cảnh Photo CU kèm thước đo (Ảnh #1 - Ảnh chính) *:`
                        : `+ Chụp thêm ảnh cận cảnh vị trí khác (Ảnh #${currentCuPhotos.length + 1}):`
                    }
                    value=""
                    onChange={(url, code) => handleAddCuPhoto(url, code)}
                    recommendedOrientation="landscape"
                    orientationHint="Khuyến nghị: Xoay ngang điện thoại (4:3) để chụp rõ toàn bộ vết nứt cùng thước đo tỷ lệ"
                    watermarkOptions={{
                      parcelCode,
                      floor: floorName,
                      zoneOrRoom: zoneOrElementCode,
                      defectCode: selectedDefect.defectCode,
                      photoType: 'CU',
                      photoIndex: currentCuPhotos.length + 1,
                    }}
                    annotationTitle={`Vẽ & Ghi chú trên ảnh Photo CU (${selectedDefect.defectCode})`}
                    height="190px"
                    required={currentCuPhotos.length === 0}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ghi chú chi tiết vết nứt *:
                  </label>
                  <textarea
                    rows={5}
                    placeholder="Mô tả cụ thể vị trí, hình thái nứt, mép nứt sắc cạnh hay đã trám trét..."
                    className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 ${
                      !selectedDefect.notes
                        ? 'border-amber-400 bg-amber-50/30'
                        : 'border-emerald-500 bg-emerald-50/15'
                    }`}
                    value={selectedDefect.notes || ''}
                    onChange={(e) => updateSelectedDefect('notes', e.target.value)}
                    disabled={readOnly}
                  />
                </div>
              </div>
            );
          })()}

          {/* Action footer: Chấm điểm mới quay trở lại canvas phía trên */}
          {!readOnly && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
              <span className="text-xs text-slate-500">
                Đang sửa thông tin <strong>{selectedDefect.defectCode}</strong>. Bấm nút bên cạnh để chấm điểm khuyết tật mới.
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsAddingPin(true);
                  containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2"
              >
                <Crosshair className="w-4 h-4" />
                <span>+ Chấm điểm khuyết tật mới ({nextDefectCode})</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Lightbox soi phóng to ảnh cận cảnh vết nứt */}
      {zoomModalImage && (
        <ImageZoomModal
          isOpen={Boolean(zoomModalImage)}
          imageUrl={zoomModalImage.url}
          title={zoomModalImage.title}
          photoCode={zoomModalImage.code}
          onClose={() => setZoomModalImage(null)}
        />
      )}
    </div>
  );
};
