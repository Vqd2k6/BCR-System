import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Building2,
  MapPin,
  Camera,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Plus,
  Save,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Maximize2,
  Droplets,
  PenTool,
  Clock,
} from 'lucide-react';
import type { GisParcel, BuildingUnit } from '../../../core/types/domain.types';
import { PhotoCaptureInput } from '../../../components/common/PhotoCaptureInput';
import { SignaturePad } from '../../../components/canvas/SignaturePad';
import { CanvasZoomToolbar } from '../../../components/canvas/CanvasZoomToolbar';
import { useInteractiveCanvasZoom } from '../../../components/canvas/useInteractiveCanvasZoom';
import { api } from '../../../services/api';
import { getErrorMessage } from '@/utils/errorUtils';

interface FloorPartition {
  id: string;
  unit_code: string;
  floor_number: number;
  cad_bbox?: { x: number; y: number; width: number; height: number };
  unit_cad_url?: string;
  unit_type?: 'UNIT' | 'MASTER';
}

interface FloorPlanResponse {
  plan?: {
    id: string;
    cad_photo_url: string;
    floor_name: string;
    floor_number: number;
  };
  units?: FloorPartition[];
}

export interface MasterAreaDefect {
  id: string;
  element: 'COLUMN' | 'BEAM' | 'SLAB' | 'WALL' | 'OTHER';
  elementCode: string; // VD: C-01, D-02
  defectType: 'CRACK' | 'WATER_LEAK' | 'SPALLING' | 'OTHER';
  crackWidthMm?: number | '';
  crackLengthM?: number | '';
  description: string;
  photoUrl: string;
  burlandGrade?: number; // 0..5
}

interface MasterSurveyDataPayload {
  overviewPhotoUrl?: string;
  defects?: MasterAreaDefect[];
  deformation?: {
    saggingMm?: number | '';
    inclinationPercent?: number | '';
  };
  surveyorRemarks?: string;
  surveyorSignatureUrl?: string;
}

interface Props {
  parcel: GisParcel;
  unit: BuildingUnit;
  onClose: () => void;
  onSurveyCompleted: () => void;
  readOnly?: boolean;
}

export const SurveyCondoMasterAreaModal: React.FC<Props> = ({
  parcel,
  unit,
  onClose,
  onSurveyCompleted,
  readOnly = false,
}) => {
  const parcelId = parcel.id;
  const unitId = unit.id;
  const unitCode = unit.unit_code || unit.unitCode || 'MASTER-AREA';
  const floorNumber = unit.floor_number ?? unit.floorNumber ?? 1;

  const existingReportId = unit.phase1_report_id || unit.phase1ReportId;
  const isReadOnly = readOnly || unit.status === 'SUBMITTED' || unit.status === 'APPROVED';
  const [isLoadingReport, setIsLoadingReport] = useState<boolean>(Boolean(existingReportId));

  // Active Tab: 1. CAD_LOCATE (Vị trí CAD & Zone Highlight), 2. PHOTOS, 3. DEFECTS, 4. SIGN_SUBMIT
  const [activeTab, setActiveTab] = useState<'CAD_LOCATE' | 'PHOTOS' | 'DEFECTS' | 'SIGN_SUBMIT'>('CAD_LOCATE');

  // Floor CAD Data & Highlighting
  const [floorPlanData, setFloorPlanData] = useState<FloorPlanResponse | null>(null);
  const [isLoadingCad, setIsLoadingCad] = useState<boolean>(true);

  // Survey Data State
  const [overviewPhotoUrl, setOverviewPhotoUrl] = useState<string>('');
  const [defects, setDefects] = useState<MasterAreaDefect[]>([]);
  const [e3SaggingMm, setE3SaggingMm] = useState<number | ''>('');
  const [e3InclinationPercent, setE3InclinationPercent] = useState<number | ''>('');
  const [surveyorSignatureUrl, setSurveyorSignatureUrl] = useState<string>('');
  const [surveyorNotes, setSurveyorNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // New Defect Form State
  const [newElement, setNewElement] = useState<MasterAreaDefect['element']>('COLUMN');
  const [newElementCode, setNewElementCode] = useState<string>('');
  const [newDefectType, setNewDefectType] = useState<MasterAreaDefect['defectType']>('CRACK');
  const [newWidth, setNewWidth] = useState<number | ''>('');
  const [newLength, setNewLength] = useState<number | ''>('');
  const [newDesc, setNewDesc] = useState<string>('');
  const [newPhoto, setNewPhoto] = useState<string>('');

  // Nạp dữ liệu bản vẽ CAD toàn tầng và vị trí phân chia
  useEffect(() => {
    let isSubscribed = true;
    const fetchFloorPlan = async () => {
      try {
        setIsLoadingCad(true);
        const res = await api.get(`/parcels/${parcelId}/floor-plans/${floorNumber}`);
        if (isSubscribed && res.data?.success && res.data.data) {
          setFloorPlanData(res.data.data);
        }
      } catch (err) {
        console.warn('[SurveyCondoMasterAreaModal] Không thể nạp bản vẽ tầng:', err);
      } finally {
        if (isSubscribed) setIsLoadingCad(false);
      }
    };
    fetchFloorPlan();
    return () => {
      isSubscribed = false;
    };
  }, [parcelId, floorNumber]);

  // Nạp dữ liệu báo cáo khảo sát cũ nếu khu vực này đã từng khảo sát (Read-Only)
  useEffect(() => {
    let isSubscribed = true;
    if (!existingReportId) {
      setIsLoadingReport(false);
      return;
    }
    const fetchExistingReport = async () => {
      try {
        setIsLoadingReport(true);
        const res = await api.get(`/reports/phase1/${existingReportId}`);
        if (isSubscribed && res.data?.success && res.data.data) {
          const report = res.data.data;
          let sData: MasterSurveyDataPayload = {};
          if (report.survey_data_json) {
            try {
              sData = (typeof report.survey_data_json === 'string'
                ? JSON.parse(report.survey_data_json)
                : report.survey_data_json) as MasterSurveyDataPayload;
            } catch (pErr) {
              console.warn('[SurveyCondoMasterAreaModal] Lỗi parse survey_data_json:', pErr);
            }
          }
          if (sData.overviewPhotoUrl) setOverviewPhotoUrl(sData.overviewPhotoUrl);
          else if (report.identificationPhotos?.[0]?.photo_url) {
            setOverviewPhotoUrl(report.identificationPhotos[0].photo_url);
          }
          if (Array.isArray(sData.defects)) setDefects(sData.defects);
          if (sData.deformation?.saggingMm !== undefined && sData.deformation?.saggingMm !== '') {
            setE3SaggingMm(sData.deformation.saggingMm);
          } else if (report.deformation?.max_sagging_mm !== undefined) {
            setE3SaggingMm(report.deformation.max_sagging_mm);
          }
          if (sData.deformation?.inclinationPercent !== undefined && sData.deformation?.inclinationPercent !== '') {
            setE3InclinationPercent(sData.deformation.inclinationPercent);
          } else if (report.deformation?.max_tilt_percent !== undefined) {
            setE3InclinationPercent(report.deformation.max_tilt_percent);
          }
          if (sData.surveyorRemarks) setSurveyorNotes(sData.surveyorRemarks);
          else if (report.surveyor_remarks || report.owner_remarks) {
            setSurveyorNotes(report.surveyor_remarks || report.owner_remarks);
          }
          if (sData.surveyorSignatureUrl) setSurveyorSignatureUrl(sData.surveyorSignatureUrl);
          else if (report.surveyor_signature_url) {
            setSurveyorSignatureUrl(report.surveyor_signature_url);
          }
        }
      } catch (err) {
        console.error('[SurveyCondoMasterAreaModal] Lỗi nạp hồ sơ khảo sát cũ:', err);
      } finally {
        if (isSubscribed) setIsLoadingReport(false);
      }
    };
    fetchExistingReport();
    return () => {
      isSubscribed = false;
    };
  }, [existingReportId]);

  // Hook Zoom & Pan cho màn hình xác định vị trí CAD
  const {
    zoomScale,
    containerRef,
    tightBoxRef,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleSetZoomPreset,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    startPan,
    updatePan,
    endPan,
    transformStyle,
    pinCounterScale,
  } = useInteractiveCanvasZoom();

  // Tìm bounding box của khu vực Master hiện tại
  const activeZonePartition = useMemo(() => {
    if (!floorPlanData?.units) return null;
    return floorPlanData.units.find(
      (u) => u.id === unitId || u.unit_code === unitCode || u.unit_code?.toLowerCase() === unitCode.toLowerCase()
    );
  }, [floorPlanData, unitId, unitCode]);

  const activeBbox = activeZonePartition?.cad_bbox || (unit.cad_bbox as { x: number; y: number; width: number; height: number });

  // Tên tầng hiển thị
  const floorName = useMemo(() => {
    if (floorNumber === 0) return 'Tầng Trệt / Sảnh G';
    if (floorNumber < 0) return `Tầng Hầm B${Math.abs(floorNumber)}`;
    return `Tầng ${floorNumber}`;
  }, [floorNumber]);

  // Thêm khuyết tật mới
  const handleAddDefect = () => {
    if (!newDesc.trim() && !newPhoto) {
      alert('Vui lòng nhập mô tả hoặc chụp ảnh khuyết tật!');
      return;
    }

    const defectItem: MasterAreaDefect = {
      id: `def_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      element: newElement,
      elementCode: newElementCode.trim() || `${newElement === 'COLUMN' ? 'C' : newElement === 'BEAM' ? 'D' : newElement === 'SLAB' ? 'S' : 'T'}-${defects.length + 1}`,
      defectType: newDefectType,
      crackWidthMm: newWidth !== '' ? Number(newWidth) : undefined,
      crackLengthM: newLength !== '' ? Number(newLength) : undefined,
      description: newDesc.trim(),
      photoUrl: newPhoto,
      burlandGrade: typeof newWidth === 'number' ? (newWidth > 5 ? 4 : newWidth > 2 ? 3 : newWidth > 0.5 ? 2 : 1) : 1,
    };

    setDefects((prev) => [...prev, defectItem]);
    setNewDesc('');
    setNewPhoto('');
    setNewWidth('');
    setNewLength('');
    setNewElementCode('');
  };

  const handleRemoveDefect = (id: string) => {
    setDefects((prev) => prev.filter((d) => d.id !== id));
  };

  // Nộp hồ sơ khảo sát khu vực Master độc lập
  const handleSubmitMasterAreaSurvey = async () => {
    if (!overviewPhotoUrl) {
      alert('Vui lòng chụp ít nhất 1 ảnh hiện trạng tổng quan khu vực (P01) trước khi nộp!');
      setActiveTab('PHOTOS');
      return;
    }

    if (!surveyorSignatureUrl) {
      alert('Khảo sát viên vui lòng ký xác nhận trước khi nộp!');
      return;
    }

    const confirmed = window.confirm(
      `Xác nhận nộp biên bản khảo sát hiện trạng khu vực ${unitCode} (${floorName})?\n\nHồ sơ sẽ được lưu độc lập và chuyển sang trạng thái Hoàn thành.`
    );
    if (!confirmed) return;

    try {
      setIsSubmitting(true);

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
          overviewPhotoUrl,
          defects,
          deformation: {
            saggingMm: e3SaggingMm !== '' ? Number(e3SaggingMm) : 0,
            inclinationPercent: e3InclinationPercent !== '' ? Number(e3InclinationPercent) : 0,
          },
          surveyorRemarks: surveyorNotes,
          surveyorSignatureUrl,
          completedAt: new Date().toISOString(),
        },
      };

      const res = await api.post('/surveys/phase1/submit', payload);

      if (res.data?.success) {
        alert(`✅ Đã nộp thành công khảo sát cho Khu vực dùng chung ${unitCode}!`);
        onSurveyCompleted();
      } else {
        throw new Error(res.data?.message || 'Lỗi không xác định từ máy chủ');
      }
    } catch (err: unknown) {
      console.error('[SurveyCondoMasterAreaModal] Lỗi nộp khảo sát:', err);
      alert(`Không thể nộp khảo sát: ${getErrorMessage(err, 'Lỗi kết nối máy chủ')}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100002] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-100 select-none">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-6xl h-[94vh] flex flex-col overflow-hidden text-slate-800">
        {/* ========================================================= */}
        {/* 1. Header Bar: Khu Vực Master & Vị Trí Tầng */}
        {/* ========================================================= */}
        <header className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-200 shadow-2xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                  KHU VỰC MASTER
                </span>
                {isReadOnly && (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                    ✓ ĐÃ HOÀN THÀNH (CHỈ ĐỌC)
                  </span>
                )}
                {isLoadingReport && (
                  <span className="text-[10px] font-medium text-slate-500 flex items-center gap-1 animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin text-indigo-600" /> Đang tải dữ liệu cũ...
                  </span>
                )}
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                  Khảo Sát Hiện Trạng: <span className="font-mono text-indigo-700">{unitCode}</span>
                </h2>
                <span className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-lg shadow-2xs">
                  {floorName}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Mã thửa: <strong>{parcel.projectParcelCode || parcel.officialCadastralCode}</strong> • Địa chỉ: {[parcel.houseNumber, parcel.street].filter(Boolean).join(' ') || 'Tại công trình'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-700 border border-slate-200 transition-colors cursor-pointer shadow-2xs"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* ========================================================= */}
        {/* 2. Stepper Tab Navigation Bar */}
        {/* ========================================================= */}
        <nav className="flex items-center justify-between px-5 bg-white border-b border-slate-200 shrink-0 overflow-x-auto gap-2">
          <div className="flex items-center gap-2 py-2">
            <button
              type="button"
              onClick={() => setActiveTab('CAD_LOCATE')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'CAD_LOCATE'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>1. Định Vị Trên CAD (Zone)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('PHOTOS')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'PHOTOS'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>2. Ảnh Hiện Trạng P01</span>
              {overviewPhotoUrl && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('DEFECTS')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'DEFECTS'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>3. Cấu Kiện & Vết Nứt ({defects.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('SIGN_SUBMIT')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'SIGN_SUBMIT'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>4. Ký Số & Hoàn Tất</span>
            </button>
          </div>
        </nav>

        {/* ========================================================= */}
        {/* 3. Main Tab Content Area */}
        {/* ========================================================= */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 flex flex-col gap-4">
          {/* ------------------------------------------------------- */}
          {/* TAB 1: CAD LOCATE & ACTIVE ZONE HIGHLIGHTING (CRITICAL UX) */}
          {/* ------------------------------------------------------- */}
          {activeTab === 'CAD_LOCATE' && (
            <div className="flex-1 flex flex-col gap-3 min-h-[500px]">
              {/* Alert thông báo đối chiếu vị trí ngoài thực địa */}
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl flex items-center justify-between text-xs text-amber-900 gap-3 shrink-0 shadow-2xs">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    📍 <strong>ĐỐI CHIẾU THỰC ĐỊA:</strong> Vùng khung chữ nhật màu vàng sáng phía dưới là phạm vi của khu vực{' '}
                    <strong className="font-mono text-amber-950 font-bold">{unitCode}</strong>. Hãy đảm bảo bạn đang đứng đúng khu vực này trước khi ghi nhận vết nứt!
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('PHOTOS')}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
                >
                  <span>Chụp Ảnh P01</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Interactive Floor CAD with Active Zone Highlight */}
              <div
                ref={containerRef}
                onWheel={handleWheel}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onPointerDown={(e) => startPan(e.clientX, e.clientY)}
                onPointerMove={(e) => updatePan(e.clientX, e.clientY)}
                onPointerUp={() => endPan()}
                className="flex-1 bg-slate-200/80 rounded-2xl border border-slate-300 overflow-hidden relative flex items-center justify-center cursor-grab active:cursor-grabbing min-h-[420px]"
              >
                {isLoadingCad ? (
                  <div className="flex flex-col items-center gap-2 text-slate-500 text-xs">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                    <span>Đang nạp bản vẽ CAD mặt bằng {floorName}...</span>
                  </div>
                ) : !floorPlanData?.plan?.cad_photo_url ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    Chưa có bản vẽ CAD cho {floorName}.
                  </div>
                ) : (
                  <div
                    ref={tightBoxRef}
                    style={transformStyle}
                    className="relative inline-block max-w-full max-h-full transition-transform duration-75 origin-center"
                  >
                    {/* Ảnh CAD Bản Vẽ Toàn Tầng */}
                    <img
                      src={floorPlanData.plan.cad_photo_url}
                      alt={`Mặt bằng ${floorName}`}
                      draggable={false}
                      className="block max-w-full max-h-[65vh] object-contain pointer-events-none select-none rounded-lg bg-white shadow-md border border-slate-300"
                    />

                    {/* Vùng mờ của các zone khác trên tầng (dimmed 30% opacity) */}
                    {floorPlanData.units &&
                      floorPlanData.units.map((part) => {
                        if (!part.cad_bbox) return null;
                        const isActive = part.id === unitId || part.unit_code === unitCode;
                        if (isActive) return null; // Render active zone riêng phía dưới

                        return (
                          <div
                            key={part.id}
                            style={{
                              left: `${part.cad_bbox.x}%`,
                              top: `${part.cad_bbox.y}%`,
                              width: `${part.cad_bbox.width}%`,
                              height: `${part.cad_bbox.height}%`,
                            }}
                            className="absolute rounded border border-dashed border-slate-400 bg-slate-400/10 opacity-30 pointer-events-none flex items-center justify-center"
                          >
                            <span className="text-[9px] font-mono text-slate-600 font-semibold px-1 rounded bg-white/70">
                              {part.unit_code}
                            </span>
                          </div>
                        );
                      })}

                    {/* VÙNG KHU VỰC MASTER ĐANG KHẢO SÁT (HIGHLIGHT RỰC RỠ) */}
                    {activeBbox && (
                      <div
                        style={{
                          left: `${activeBbox.x}%`,
                          top: `${activeBbox.y}%`,
                          width: `${activeBbox.width}%`,
                          height: `${activeBbox.height}%`,
                        }}
                        className="absolute rounded-lg border-4 border-amber-500 bg-amber-400/35 ring-4 ring-amber-400/50 shadow-2xl z-30 pointer-events-none flex flex-col justify-between p-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            style={{ transform: `scale(${pinCounterScale})`, transformOrigin: 'top left' }}
                            className="px-2 py-0.5 rounded-md font-mono font-bold text-xs bg-amber-600 text-white shadow-md flex items-center gap-1.5 border border-amber-700"
                          >
                            <MapPin className="w-3 h-3 text-amber-200" />
                            <span>VỊ TRÍ ĐANG ĐỨNG: {unitCode}</span>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Floating Zoom Toolbar */}
                <div className="absolute bottom-4 right-4 z-40">
                  <CanvasZoomToolbar
                    zoomScale={zoomScale}
                    onZoomIn={handleZoomIn}
                    onZoomOut={handleZoomOut}
                    onResetZoom={handleResetZoom}
                    onSelectPreset={handleSetZoomPreset}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------- */}
          {/* TAB 2: OVERVIEW PHOTO (P01) */}
          {/* ------------------------------------------------------- */}
          {activeTab === 'PHOTOS' && (
            <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full py-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-indigo-600" />
                  Ảnh Hiện Trạng Toàn Cảnh Khu Vực (P01) *
                </h3>
                <p className="text-xs text-slate-500">
                  Chụp góc rộng bao quát không gian khu vực dùng chung <strong className="text-indigo-900">{unitCode}</strong> ({floorName}).
                </p>

                <div className="mt-2">
                  <PhotoCaptureInput
                    photoCode={`P01_${unitCode}`}
                    label={`Ảnh toàn cảnh ${unitCode}`}
                    value={overviewPhotoUrl}
                    onChange={(url: string) => setOverviewPhotoUrl(url)}
                    readOnly={isReadOnly}
                  />
                </div>
              </div>

              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setActiveTab('CAD_LOCATE')}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Quay lại xem CAD</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('DEFECTS')}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span>Tiếp tục: Cấu kiện & Vết nứt</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------- */}
          {/* TAB 3: STRUCTURAL ELEMENTS & DEFECTS */}
          {/* ------------------------------------------------------- */}
          {activeTab === 'DEFECTS' && (
            <div className="flex flex-col gap-4">
              {/* Form thêm khuyết tật mới */}
              {!isReadOnly && (
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-indigo-600" />
                    Ghi Nhận Vết Nứt / Khuyết Tật Mới Tại {unitCode}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">Cấu kiện:</label>
                      <select
                        value={newElement}
                        onChange={(e) => setNewElement(e.target.value as MasterAreaDefect['element'])}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 font-medium text-slate-800"
                      >
                        <option value="COLUMN">Cột chịu lực</option>
                        <option value="BEAM">Dầm bê tông</option>
                        <option value="SLAB">Sàn / Trần</option>
                        <option value="WALL">Tường bao / Tường ngăn</option>
                        <option value="OTHER">Kết cấu khác</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-600 font-bold mb-1">Mã cấu kiện (VD: C-01):</label>
                      <input
                        type="text"
                        placeholder="VD: C-01, D-02..."
                        value={newElementCode}
                        onChange={(e) => setNewElementCode(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 font-mono font-bold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 font-bold mb-1">Loại khuyết tật:</label>
                      <select
                        value={newDefectType}
                        onChange={(e) => setNewDefectType(e.target.value as MasterAreaDefect['defectType'])}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 font-medium text-slate-800"
                      >
                        <option value="CRACK">Vết nứt (Crack)</option>
                        <option value="WATER_LEAK">Thấm dột (Leakage)</option>
                        <option value="SPALLING">Bong tróc / Rỗ bê tông</option>
                        <option value="OTHER">Hư hỏng khác</option>
                      </select>
                    </div>

                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-slate-600 font-bold mb-1">Bề rộng (mm):</label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="0.5"
                          value={newWidth}
                          onChange={(e) => setNewWidth(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 font-mono font-bold text-slate-900"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-slate-600 font-bold mb-1">Dài (m):</label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="1.2"
                          value={newLength}
                          onChange={(e) => setNewLength(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 font-mono font-bold text-slate-900"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-bold text-xs mb-1">Mô tả chi tiết vị trí & hiện trạng:</label>
                    <input
                      type="text"
                      placeholder="VD: Nứt chéo 45 độ gần đầu cột giáp dầm chính..."
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs text-slate-800"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="flex-1">
                      <PhotoCaptureInput
                        photoCode={`DEFECT_${unitCode}_${defects.length + 1}`}
                        label="Chụp ảnh cận cảnh vết nứt có thước đo"
                        value={newPhoto}
                        onChange={(url: string) => setNewPhoto(url)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddDefect}
                      className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0 self-end"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Thêm Vào Danh Sách</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Danh sách các vết nứt đã ghi nhận */}
              <div className="flex flex-col gap-2">
                <h4 className="text-xs font-bold text-slate-700">
                  Danh Sách Khuyết Tật Đã Ghi Nhận ({defects.length})
                </h4>

                {defects.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300">
                    Chưa ghi nhận khuyết tật nào trong khu vực này. Nếu không có khuyết tật, bạn có thể chuyển sang bước tiếp theo.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {defects.map((d, idx) => (
                      <div
                        key={d.id}
                        className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          {d.photoUrl ? (
                            <img
                              src={d.photoUrl}
                              alt={d.elementCode}
                              className="w-14 h-14 object-cover rounded-lg border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 text-[10px] shrink-0">
                              No Pic
                            </div>
                          )}
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                                {d.elementCode}
                              </span>
                              <span className="text-xs font-bold text-slate-800">
                                {d.defectType === 'CRACK' ? 'Vết nứt' : d.defectType === 'WATER_LEAK' ? 'Thấm dột' : 'Bong tróc'}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500 mt-0.5">
                              {d.crackWidthMm ? `Bề rộng: ${d.crackWidthMm}mm • ` : ''}
                              {d.crackLengthM ? `Dài: ${d.crackLengthM}m • ` : ''}
                              {d.description || 'Không có mô tả thêm'}
                            </span>
                          </div>
                        </div>

                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => handleRemoveDefect(d.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Đo võng & nghiêng kết cấu E3 */}
              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
                <h4 className="text-xs font-bold text-slate-900">
                  Đo Biến Dạng & Võng Sàn / Nghiêng Kết Cấu (Chỉ số E3)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Độ võng sàn lớn nhất Δ (mm):</label>
                    <input
                      type="number"
                      step="0.5"
                      placeholder="0"
                      disabled={isReadOnly}
                      value={e3SaggingMm}
                      onChange={(e) => setE3SaggingMm(e.target.value === '' ? '' : Number(e.target.value))}
                      className={`w-full px-2.5 py-1.5 rounded-lg border font-mono font-bold text-slate-900 ${
                        isReadOnly ? 'bg-slate-100 border-slate-200 cursor-not-allowed' : 'bg-slate-50 border-slate-300'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-bold mb-1">Độ nghiêng kết cấu θ (%):</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="0"
                      disabled={isReadOnly}
                      value={e3InclinationPercent}
                      onChange={(e) => setE3InclinationPercent(e.target.value === '' ? '' : Number(e.target.value))}
                      className={`w-full px-2.5 py-1.5 rounded-lg border font-mono font-bold text-slate-900 ${
                        isReadOnly ? 'bg-slate-100 border-slate-200 cursor-not-allowed' : 'bg-slate-50 border-slate-300'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------- */}
          {/* TAB 4: SIGNATURE & SUBMIT */}
          {/* ------------------------------------------------------- */}
          {activeTab === 'SIGN_SUBMIT' && (
            <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full py-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <PenTool className="w-4 h-4 text-indigo-600" />
                  Ký Số Xác Nhận Khảo Sát Hiện Trạng Khu Vực
                </h3>
                <p className="text-xs text-slate-500">
                  Khảo sát viên ký tên chịu trách nhiệm về số liệu khảo sát vết nứt và hiện trạng của vị trí <strong className="text-indigo-900">{unitCode}</strong>.
                </p>

                <div>
                  <label className="block text-slate-700 font-bold text-xs mb-1">Ghi chú / Kiến nghị khảo sát viên:</label>
                  <textarea
                    rows={2}
                    value={surveyorNotes}
                    disabled={isReadOnly}
                    onChange={(e) => setSurveyorNotes(e.target.value)}
                    placeholder="Ghi chú thêm về điều kiện quan trắc hoặc đề xuất theo dõi..."
                    className={`w-full px-3 py-2 rounded-xl border text-xs text-slate-800 ${
                      isReadOnly ? 'bg-slate-100 border-slate-200 cursor-not-allowed' : 'bg-slate-50 border-slate-300'
                    }`}
                  />
                </div>

                <div className="mt-2">
                  <SignaturePad
                    label="Chữ ký Khảo Sát Viên *"
                    signerName="Khảo Sát Viên Hiện Trường"
                    role="Kỹ sư hiện trường"
                    initialSignatureUrl={surveyorSignatureUrl}
                    onSave={(dataUrl) => setSurveyorSignatureUrl(dataUrl)}
                    readOnly={isReadOnly}
                  />
                </div>
              </div>

              {/* Nút nộp hoàn tất */}
              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('DEFECTS')}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Quay lại cấu kiện</span>
                </button>

                {isReadOnly ? (
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Hồ Sơ Đã Hoàn Tất (Đóng)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isSubmitting || !overviewPhotoUrl || !surveyorSignatureUrl}
                    onClick={handleSubmitMasterAreaSurvey}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Đang nộp hồ sơ...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Nộp Hoàn Thành Khảo Sát Vị Trí Này</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
