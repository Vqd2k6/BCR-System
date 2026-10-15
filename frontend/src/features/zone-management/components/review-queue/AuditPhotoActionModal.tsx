import React, { useState, useEffect } from 'react';
import {
  X,
  RefreshCw,
  Plus,
  Trash2,
  Upload,
  AlertTriangle,
  CheckCircle2,
  FileText,
  ShieldAlert,
  Loader2,
  Layers,
  ArrowRight,
} from 'lucide-react';
import {
  compressAndStandardizePhoto,
  uploadStandardizedPhoto,
  type ProcessedPhotoResult,
} from '@/utils/photoProcessing';

export type PhotoActionMode = 'REPLACE' | 'ADD' | 'DELETE' | 'RESTORE';

export interface PhotoActionPayload {
  action: 'ADD' | 'DELETE' | 'REPLACE' | 'RESTORE';
  category: string;
  targetPhotoType?: string;
  targetPhotoId?: string;
  defectId?: string;
  defectCode?: string;
  photoIndex?: number;
  oldPhotoUrl?: string;
  newPhotoUrl?: string;
  newPhotoUrls?: string[];
  photoCode?: string;
  standardizedFilename?: string;
  sha256Hash?: string;
  caption?: string;
  reason: string;
  isNotApplicable?: boolean;
  naReason?: string;
  deleteDefectItem?: boolean;
  pinX?: number;
  pinY?: number;
  widthMaxMm?: number;
  lengthMm?: number;
  metadata?: Record<string, any>;
}

export interface AuditPhotoActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportId: string;
  parcelCode: string;
  initialMode?: PhotoActionMode;
  category: string; // 'IDENTIFICATION' | 'OVERVIEW' | 'AS_BUILT' | 'SETTLEMENT_TILT' | 'CAD_FLOOR' | 'ZONE_CTX' | 'DEFECT_CU' | 'SCOPE_GIS' | 'MINUTES' | 'ABSENCE_NOTICE' | 'SIGNATURE'
  targetPhotoType: string; // 'P01'..'P04', 'CU', 'CTX', 'CAD', 'MINUTES', etc.
  targetPhotoId?: string;
  photoIndex?: number;
  defectId?: string;
  defectCode?: string;
  hasMultiplePhotos?: boolean;
  currentPhotoUrl?: string;
  currentPhotoCode?: string;
  photoTitle?: string;
  floorCode?: string;
  zoneCode?: string;
  initialPinX?: number;
  initialPinY?: number;
  onConfirmAction: (action: PhotoActionPayload) => void;
}

export const AuditPhotoActionModal: React.FC<AuditPhotoActionModalProps> = ({
  isOpen,
  onClose,
  reportId,
  parcelCode,
  initialMode = 'REPLACE',
  category,
  targetPhotoType,
  targetPhotoId,
  photoIndex,
  defectId,
  defectCode,
  hasMultiplePhotos = false,
  currentPhotoUrl = '',
  currentPhotoCode = '',
  photoTitle = 'Ảnh Hiện Trường',
  floorCode,
  zoneCode,
  initialPinX,
  initialPinY,
  onConfirmAction,
}) => {
  const [activeTab, setActiveTab] = useState<PhotoActionMode>(initialMode);
  const [reason, setReason] = useState<string>('');
  const [naReason, setNaReason] = useState<string>('');
  const [deleteDefectItem, setDeleteDefectItem] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [defectWidthMaxMm, setDefectWidthMaxMm] = useState<string>('0.2');
  const [defectLengthMm, setDefectLengthMm] = useState<string>('50');

  // State cho Tab Thay Thế
  const [replaceProcessed, setReplaceProcessed] = useState<ProcessedPhotoResult | null>(null);

  // State cho Tab Thêm Mới
  const [batchProcessed, setBatchProcessed] = useState<Array<ProcessedPhotoResult & { caption: string }>>([]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialMode);
      setReason('');
      setNaReason('');
      setDeleteDefectItem(false);
      setErrorMessage('');
      setDefectWidthMaxMm('0.2');
      setDefectLengthMm('50');
      setReplaceProcessed(null);
      setBatchProcessed([]);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const isMandatoryIdentPhoto = ['P01', 'P02', 'P03', 'P04'].includes(targetPhotoType.toUpperCase());
  const isDefectCuPhoto = category === 'DEFECT_CU' || targetPhotoType === 'CU';
  const isOnlyOneCuPhoto = isDefectCuPhoto && !hasMultiplePhotos;

  // Xử lý chọn ảnh đơn lẻ cho Tab Thay Thế
  const handleSinglePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Vui lòng chỉ chọn file hình ảnh (.jpg, .jpeg, .png, .webp).');
      return;
    }

    setIsProcessing(true);
    setErrorMessage('');

    try {
      const processed = await compressAndStandardizePhoto(file, {
        buildingOrParcelCode: parcelCode || 'B0000',
        floorCode: floorCode || 'G',
        zoneCode: zoneCode || 'Z01',
        defectCode: defectCode || targetPhotoId,
        photoType: targetPhotoType || 'PHOTO',
        index: 1,
      });
      setReplaceProcessed(processed);
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi xử lý hình ảnh');
    } finally {
      setIsProcessing(false);
    }
  };

  // Xử lý chọn nhiều ảnh cho Tab Thêm Mới
  const handleBatchPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsProcessing(true);
    setErrorMessage('');

    try {
      const results: Array<ProcessedPhotoResult & { caption: string }> = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;

        const processed = await compressAndStandardizePhoto(file, {
          buildingOrParcelCode: parcelCode || 'B0000',
          floorCode: floorCode || 'G',
          zoneCode: zoneCode || 'Z01',
          defectCode: defectCode || targetPhotoId,
          photoType: targetPhotoType || 'PHOTO',
          index: (batchProcessed.length + i + 1),
        });

        results.push({
          ...processed,
          caption: `Ảnh bổ sung #${batchProcessed.length + i + 1}`,
        });
      }

      setBatchProcessed((prev) => [...prev, ...results]);
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi xử lý danh sách ảnh');
    } finally {
      setIsProcessing(false);
    }
  };

  // Xử lý submit
  const handleSubmit = async () => {
    setErrorMessage('');

    if (!reason.trim()) {
      setErrorMessage('Vui lòng nhập lý do điều chỉnh bắt buộc để ghi nhận nhật ký kiểm toán.');
      return;
    }

    if (activeTab === 'REPLACE') {
      if (!replaceProcessed) {
        setErrorMessage('Vui lòng chọn ảnh mới để thay thế.');
        return;
      }

      setIsProcessing(true);
      try {
        const uploadRes = await uploadStandardizedPhoto(
          replaceProcessed.file,
          `surveys/${parcelCode}/${category.toLowerCase()}`,
          {
            reportId,
            parcelCode,
            photoCode: replaceProcessed.photoCode,
            standardizedFilename: replaceProcessed.standardizedFilename,
            sha256: replaceProcessed.sha256Hash,
            reason,
          }
        );

        onConfirmAction({
          action: 'REPLACE',
          category,
          targetPhotoType,
          targetPhotoId,
          photoIndex,
          defectId,
          defectCode,
          oldPhotoUrl: currentPhotoUrl,
          newPhotoUrl: uploadRes.url,
          photoCode: replaceProcessed.photoCode,
          standardizedFilename: replaceProcessed.standardizedFilename,
          sha256Hash: replaceProcessed.sha256Hash,
          reason,
          pinX: initialPinX,
          pinY: initialPinY,
        });

        onClose();
      } catch (err: any) {
        setErrorMessage(err.message || 'Không thể upload ảnh mới.');
      } finally {
        setIsProcessing(false);
      }
    } else if (activeTab === 'ADD') {
      if (batchProcessed.length === 0) {
        setErrorMessage('Vui lòng chọn ít nhất 1 ảnh để thêm.');
        return;
      }

      if (isDefectCuPhoto) {
        const w = Number(defectWidthMaxMm);
        const l = Number(defectLengthMm);
        if (isNaN(w) || w <= 0 || isNaN(l) || l <= 0) {
          setErrorMessage('Vui lòng nhập bề rộng lớn nhất (> 0 mm) và chiều dài (> 0 mm) hợp lệ cho khuyết tật.');
          return;
        }
      }

      setIsProcessing(true);
      try {
        const uploadedUrls: string[] = [];
        for (const item of batchProcessed) {
          const uploadRes = await uploadStandardizedPhoto(
            item.file,
            `surveys/${parcelCode}/${category.toLowerCase()}`,
            {
              reportId,
              parcelCode,
              photoCode: item.photoCode,
              sha256: item.sha256Hash,
              caption: item.caption,
              reason,
            }
          );
          uploadedUrls.push(uploadRes.url);
        }

        onConfirmAction({
          action: 'ADD',
          category,
          targetPhotoType,
          targetPhotoId,
          photoIndex,
          defectId,
          defectCode,
          newPhotoUrl: uploadedUrls[0],
          newPhotoUrls: uploadedUrls,
          photoCode: batchProcessed[0].photoCode,
          standardizedFilename: batchProcessed[0].standardizedFilename,
          sha256Hash: batchProcessed[0].sha256Hash,
          reason,
          pinX: initialPinX,
          pinY: initialPinY,
          widthMaxMm: isDefectCuPhoto ? Number(defectWidthMaxMm) : undefined,
          lengthMm: isDefectCuPhoto ? Number(defectLengthMm) : undefined,
        });

        onClose();
      } catch (err: any) {
        setErrorMessage(err.message || 'Lỗi khi upload danh sách ảnh.');
      } finally {
        setIsProcessing(false);
      }
    } else if (activeTab === 'DELETE') {
      if (isMandatoryIdentPhoto && !naReason.trim()) {
        setErrorMessage('Đối với ảnh định danh bắt buộc, vui lòng nhập lý do Không áp dụng (N/A Reason).');
        return;
      }

      onConfirmAction({
        action: 'DELETE',
        category,
        targetPhotoType,
        targetPhotoId,
        photoIndex,
        defectId,
        defectCode,
        oldPhotoUrl: currentPhotoUrl,
        photoCode: currentPhotoCode,
        reason,
        isNotApplicable: isMandatoryIdentPhoto,
        naReason: naReason.trim() || reason,
        deleteDefectItem,
      });

      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-100 text-sky-700">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 leading-tight">
                Quản Trị Hình Ảnh Khảo Sát
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[11px] text-slate-500 font-medium">
                  {photoTitle} {currentPhotoCode ? `• [${currentPhotoCode}]` : ''}
                </p>
                {initialPinX !== undefined && initialPinY !== undefined && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold border border-emerald-300">
                    🎯 Tọa độ ghim: ({initialPinX}%, {initialPinY}%)
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center border-b border-slate-200 bg-white px-5 pt-2 gap-2">
          <button
            type="button"
            onClick={() => { setActiveTab('REPLACE'); setErrorMessage(''); }}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'REPLACE'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Thay Thế Ảnh (1:1)</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('ADD'); setErrorMessage(''); }}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'ADD'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm Ảnh Bổ Sung</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('DELETE'); setErrorMessage(''); }}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'DELETE'
                ? 'border-rose-600 text-rose-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xóa Ảnh Khỏi Hồ Sơ</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Thông báo lỗi nếu có */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB 1: THAY THẾ ẢNH */}
          {activeTab === 'REPLACE' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Ảnh hiện tại */}
                <div className="space-y-1.5">
                  <span className="font-bold text-slate-700 text-[11px] block">Ảnh Hiện Tại Trong Hồ Sơ:</span>
                  <div className="w-full h-44 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center relative shadow-inner">
                    {currentPhotoUrl ? (
                      <img
                        src={currentPhotoUrl}
                        alt="Current"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-slate-400 italic">Chưa có ảnh</span>
                    )}
                  </div>
                </div>

                {/* Ảnh mới chuẩn hóa */}
                <div className="space-y-1.5">
                  <span className="font-bold text-slate-700 text-[11px] block">Ảnh Mới (Chuẩn nén JPEG 90%):</span>
                  {replaceProcessed ? (
                    <div className="w-full h-44 rounded-xl border border-emerald-300 bg-emerald-50/20 overflow-hidden flex flex-col justify-between p-2 relative shadow-inner">
                      <img
                        src={replaceProcessed.dataUrl}
                        alt="New Preview"
                        className="w-full h-28 object-contain rounded"
                      />
                      <div className="bg-white/90 p-1.5 rounded-lg border border-emerald-200 text-[10px] space-y-0.5">
                        <div className="font-mono text-emerald-800 font-bold truncate">
                          {replaceProcessed.standardizedFilename}
                        </div>
                        <div className="text-slate-500 flex justify-between">
                          <span>{replaceProcessed.width}x{replaceProcessed.height}px</span>
                          <span>{(replaceProcessed.sizeBytes / 1024).toFixed(0)} KB</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <label className="w-full h-44 rounded-xl border-2 border-dashed border-slate-300 hover:border-sky-400 bg-slate-50/50 hover:bg-sky-50/30 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors p-4 text-center">
                      <Upload className="w-6 h-6 text-slate-400" />
                      <span className="font-bold text-slate-600 text-[11px]">Bấm hoặc thả ảnh vào đây</span>
                      <span className="text-[10px] text-slate-400">Tự động nắn kích thước & sinh tên file chuẩn M2</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleSinglePhotoSelect}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {replaceProcessed && (
                <div className="flex justify-end">
                  <label className="text-[11px] font-bold text-sky-600 hover:text-sky-800 cursor-pointer flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" />
                    <span>Chọn ảnh khác</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleSinglePhotoSelect}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-[11px]">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Quy chuẩn Forensic & Bảo lưu Pháp lý:</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  File ảnh cũ <span className="font-semibold text-slate-800">tuyệt đối không bị xóa khỏi máy chủ lưu trữ</span>. Hệ thống chuyển ảnh cũ sang trạng thái <code>SUPERSEDED</code> và lưu vết đối chiếu trong CSDL.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: THÊM ẢNH BỔ SUNG */}
          {activeTab === 'ADD' && (
            <div className="space-y-4">
              <label className="w-full h-28 rounded-xl border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/30 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors p-4 text-center">
                <Plus className="w-6 h-6 text-emerald-600" />
                <span className="font-bold text-emerald-800 text-xs">Bấm để chọn 1 hoặc nhiều ảnh bổ sung</span>
                <span className="text-[10px] text-slate-500">Hỗ trợ tải lên nhiều file cùng lúc (JPG, PNG, WebP)</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleBatchPhotoSelect}
                  className="hidden"
                />
              </label>

              {batchProcessed.length > 0 && (
                <div className="space-y-2">
                  <span className="font-bold text-slate-700 text-[11px] block">
                    Đã chuẩn bị {batchProcessed.length} ảnh tải lên:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto p-1 border border-slate-200 rounded-xl">
                    {batchProcessed.map((item, idx) => (
                      <div key={idx} className="relative rounded-lg border border-slate-200 p-1.5 bg-slate-50 space-y-1">
                        <img src={item.dataUrl} alt={`Batch ${idx}`} className="w-full h-20 object-contain rounded bg-black/5" />
                        <input
                          type="text"
                          value={item.caption}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBatchProcessed((prev) =>
                              prev.map((p, i) => (i === idx ? { ...p, caption: val } : p))
                            );
                          }}
                          placeholder="Chú thích ảnh..."
                          className="w-full px-1.5 py-0.5 text-[10px] font-medium border border-slate-200 rounded bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setBatchProcessed((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full shadow hover:bg-red-700 cursor-pointer"
                          title="Xóa khỏi danh sách"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isDefectCuPhoto && (
                <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 space-y-3">
                  <div className="flex items-center gap-1.5 font-bold text-blue-900">
                    <Layers className="w-4 h-4 text-blue-700" />
                    <span>Thông số kỹ thuật khuyết tật bắt buộc (BCS Standard):</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700 text-[11px] block">
                        Bề rộng vết nứt lớn nhất (mm) <span className="text-rose-500">*</span>:
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        min="0.05"
                        value={defectWidthMaxMm}
                        onChange={(e) => setDefectWidthMaxMm(e.target.value)}
                        placeholder="VD: 0.20"
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-sky-500 bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700 text-[11px] block">
                        Chiều dài vết nứt (mm) <span className="text-rose-500">*</span>:
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={defectLengthMm}
                        onChange={(e) => setDefectLengthMm(e.target.value)}
                        placeholder="VD: 150"
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-sky-500 bg-white"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-blue-700">
                    Hệ thống yêu cầu nhập kích thước hình học chính xác để lưu trữ vào bảng CSDL <code>defect_items</code> phục vụ giám định rủi ro công trình.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: XÓA ẢNH */}
          {activeTab === 'DELETE' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-3 bg-rose-50 border border-rose-200 rounded-xl">
                {currentPhotoUrl ? (
                  <img src={currentPhotoUrl} alt="To Delete" className="w-24 h-24 object-contain rounded-lg border border-rose-300 bg-white" />
                ) : null}
                <div className="space-y-1">
                  <span className="font-bold text-rose-900 text-xs block">Xác nhận xóa bức ảnh này</span>
                  <p className="text-[11px] text-rose-700">
                    Mã ảnh: <code className="font-mono font-bold">{currentPhotoCode || targetPhotoType}</code>
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Ảnh sẽ được đánh dấu <code>is_deleted = true</code>. File vật lý được lưu giữ vĩnh viễn trên lưu trữ đám mây để phục vụ giám định pháp lý.
                  </p>
                </div>
              </div>

              {/* EC-01: Nếu là ảnh CU duy nhất */}
              {isOnlyOneCuPhoto && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 space-y-2.5">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Cảnh báo An toàn Kỹ thuật (EC-01):</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Đây là <span className="font-bold">ảnh chứng cứ duy nhất</span> của khuyết tật [{defectCode || targetPhotoId}]. Một khuyết tật không thể tồn tại trong báo cáo BCS mà không có ảnh cận cảnh có thước đo.
                  </p>
                  <div className="space-y-2 pt-1 border-t border-amber-200">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-950">
                      <input
                        type="checkbox"
                        checked={deleteDefectItem}
                        onChange={(e) => setDeleteDefectItem(e.target.checked)}
                        className="rounded text-rose-600 focus:ring-rose-500"
                      />
                      <span>Xóa luôn toàn bộ mục khuyết tật này khỏi hồ sơ (khảo sát viên ghi nhận sai)</span>
                    </label>
                    {!deleteDefectItem && (
                      <p className="text-[10px] text-slate-500 italic">
                        * Gợi ý: Nếu khuyết tật vẫn có thật, bạn nên chọn tab <b>Thay Thế Ảnh</b> để tải ảnh rõ nét hơn thay vì xóa.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* EC-02: Nếu là ảnh định danh bắt buộc P01-P04 */}
              {isMandatoryIdentPhoto && (
                <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-300 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-sky-900">
                    <FileText className="w-4 h-4 text-sky-700 shrink-0" />
                    <span>Quy chuẩn Ảnh Định Danh Bắt Buộc (EC-02):</span>
                  </div>
                  <p className="text-[11px] text-sky-800 leading-relaxed">
                    Ảnh <b>{targetPhotoType}</b> là một trong 4 ảnh định danh ngoại thất bắt buộc. Khi gỡ ảnh, hệ thống sẽ chuyển sang trạng thái <code>Không Áp Dụng (N/A)</code> trên Báo cáo BCS kèm lý do giải trình.
                  </p>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      Lý do Không Áp Dụng (N/A Reason) <span className="text-red-500">*</span>:
                    </label>
                    <input
                      type="text"
                      value={naReason}
                      onChange={(e) => setNaReason(e.target.value)}
                      placeholder="VD: Nhà liền kề san sát, không có lối tiếp cận bên hông trái"
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Trường Nhập Lý Do Bắt Buộc */}
          <div className="space-y-1 pt-2 border-t border-slate-200">
            <label className="font-bold text-slate-700 text-xs flex items-center justify-between">
              <span>Lý do điều chỉnh ảnh bắt buộc (Ghi nhật ký kiểm toán) <span className="text-red-500">*</span>:</span>
              <span className="text-[10px] text-slate-400 font-normal">Tối thiểu 5 ký tự</span>
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Thay thế ảnh chụp bị mờ bằng ảnh chụp rõ nét vạch thước đo khe nứt..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50/70">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            Đóng / Hủy
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isProcessing}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'DELETE'
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                : 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-600/20'
            } ${isProcessing ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Đang xử lý...</span>
              </>
            ) : (
              <>
                <span>
                  {activeTab === 'REPLACE' ? 'Lưu Thay Thế Ảnh Vào Hàng Đợi Diff' : ''}
                  {activeTab === 'ADD' ? `Lưu ${batchProcessed.length} Ảnh Vào Hàng Đợi Diff` : ''}
                  {activeTab === 'DELETE' ? 'Xác Nhận Xóa Vào Hàng Đợi Diff' : ''}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
