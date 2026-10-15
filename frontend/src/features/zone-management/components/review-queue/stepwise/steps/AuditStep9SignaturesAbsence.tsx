import React, { useRef } from 'react';
import {
  FileText,
  User,
  Building2,
  ShieldCheck,
  MessageSquare,
  Upload,
  Trash2,
  RefreshCw,
  ZoomIn,
  AlertTriangle,
  FileCheck2,
  History,
} from 'lucide-react';

import type { AuditStepwiseFormState, AuditStepwiseData, StepwiseSignatures, PhotoReplaceParams, AuditPhotoActionParams, AuditPhotoHistoryParams } from '../types';

interface Props {
  isEditMode?: boolean;
  formState: AuditStepwiseFormState;
  data?: AuditStepwiseData;
  handleFieldChange?: (fieldKey: string, label: string, val: unknown) => void;
  handleNestedFieldChange?: (parentKey: string, childKey: string, label: string, val: unknown) => void;
  onOpenPhotoZoom: (url: string, title?: string, photoCode?: string) => void;
  onOpenPhotoReplace?: (params: PhotoReplaceParams) => void;
  onOpenPhotoAction?: (params: AuditPhotoActionParams) => void;
  onOpenPhotoHistory?: (params: AuditPhotoHistoryParams) => void;
  onConfirmAbsenteeSurvey?: () => void;
  isFieldDirty?: (fieldKey: string, subKey?: string) => boolean;
}

export const AuditStep9SignaturesAbsence: React.FC<Props> = ({
  isEditMode = false,
  formState,
  data,
  handleFieldChange,
  handleNestedFieldChange,
  onOpenPhotoZoom,
  onOpenPhotoReplace,
  onOpenPhotoAction,
  onOpenPhotoHistory,
  isFieldDirty,
}) => {
  const sigs: StepwiseSignatures = formState.signatures || {};
  const absenceLogs = formState.absenceLogs || data?.leftPane?.absenceLogs || [];
  const isAbsentee = formState.isRefusedOrAbsent || formState.status === 'POSTPONED_ABSENT' || absenceLogs.length > 0;

  // Working minutes photos
  const rawPhotos: (string | { url?: string; photoUrl?: string; photoCode?: string; caption?: string })[] =
    sigs.workingMinutesPhotos || formState.workingMinutesPhotos || [];

  const addPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const replacePhotoInputRef = useRef<HTMLInputElement | null>(null);
  const replaceTargetIndexRef = useRef<number | null>(null);

  const ownerFeedback = sigs.ownerFeedback !== undefined ? sigs.ownerFeedback : (formState.ownerFeedback ?? formState.ownerRemarks ?? '');
  const surveyorName = sigs.surveyorName || formState.surveyorName || data?.surveyorName;
  const surveyorPhone = sigs.surveyorPhone || formState.surveyorPhone || data?.surveyorPhone;
  const ownerName = sigs.ownerName || formState.ownerName || data?.ownerName;
  const ownerPhone = sigs.ownerPhone || formState.ownerPhone || (formState.ownerInterview?.phone as string | undefined);
  const surveyDate = formState.surveyDate || data?.surveyDate;
  const surveyorSignatureUrl =
    (sigs as Record<string, unknown>).surveyorSignatureUrl as string | undefined ||
    (data as Record<string, unknown> | undefined)?.surveyorSignatureUrl as string | undefined ||
    (data as Record<string, unknown> | undefined)?.surveyor_signature_url as string | undefined;
  const ownerSignatureUrl =
    (sigs as Record<string, unknown>).ownerSignatureUrl as string | undefined ||
    (data as Record<string, unknown> | undefined)?.ownerSignatureUrl as string | undefined ||
    (data as Record<string, unknown> | undefined)?.owner_signature_url as string | undefined;

  // Witness / Local Authority Info
  const witnessName = sigs.witnessName || formState.witnessName || (formState.witnessInfo?.name as string | undefined);
  const witnessRole = sigs.witnessRole || formState.witnessRole || (formState.witnessInfo?.role as string | undefined) || 'Tổ trưởng tổ dân phố / Cán bộ địa chính';
  const witnessPhone = sigs.witnessPhone || formState.witnessPhone || (formState.witnessInfo?.phone as string | undefined);

  const getPhotoUrl = (p: string | { url?: string; photoUrl?: string; raw_photo_url?: string; annotated_photo_url?: string }): string => {
    if (!p) return '';
    if (typeof p === 'string') return p;
    return p.url || p.photoUrl || p.raw_photo_url || '';
  };

  const getPhotoCaption = (p: string | { caption?: string; photoCode?: string }, idx: number): string => {
    if (typeof p === 'object' && p) {
      return p.caption || p.photoCode || `Biên bản trang ${idx + 1}`;
    }
    return `Biên bản trang ${idx + 1}`;
  };

  const notifyPhotosChange = (updatedPhotos: typeof rawPhotos) => {
    if (handleNestedFieldChange) {
      handleNestedFieldChange('signatures', 'workingMinutesPhotos', 'Ảnh chụp biên bản', updatedPhotos);
    } else if (handleFieldChange) {
      handleFieldChange('workingMinutesPhotos', 'Ảnh chụp biên bản', updatedPhotos);
    }
  };

  const handleAddMinutesPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const resultUrl = reader.result as string;
        const newPhotoItem = {
          url: resultUrl,
          photoCode: `BB_${Date.now().toString().slice(-4)}`,
          caption: `Trang biên bản mới (${file.name})`,
        };
        const nextList = [...rawPhotos, newPhotoItem];
        notifyPhotosChange(nextList);
      };
      reader.readAsDataURL(file);
    });

    if (e.target) e.target.value = '';
  };

  const handleTriggerReplace = (index: number) => {
    replaceTargetIndexRef.current = index;
    if (replacePhotoInputRef.current) {
      replacePhotoInputRef.current.click();
    }
  };

  const handleReplaceMinutesPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetIdx = replaceTargetIndexRef.current;
    if (!file || targetIdx === null || targetIdx === undefined) return;

    const reader = new FileReader();
    reader.onload = () => {
      const resultUrl = reader.result as string;
      const nextList = [...rawPhotos];
      const existing = nextList[targetIdx];
      if (typeof existing === 'object' && existing) {
        nextList[targetIdx] = { ...existing, url: resultUrl };
      } else {
        nextList[targetIdx] = resultUrl;
      }
      notifyPhotosChange(nextList);
    };
    reader.readAsDataURL(file);

    if (e.target) e.target.value = '';
    replaceTargetIndexRef.current = null;
  };

  const handleDeleteMinutesPhoto = (index: number) => {
    if (!window.confirm(`Bạn có chắc muốn xóa ảnh trang biên bản số ${index + 1}?`)) return;
    const nextList = rawPhotos.filter((_, idx) => idx !== index);
    notifyPhotosChange(nextList);
  };

  const checkDirty = (fieldKey: string, subKey?: string) => {
    return isFieldDirty ? isFieldDirty(fieldKey, subKey) : false;
  };

  return (
    <section id="step-9" className="scroll-mt-6 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Hidden file inputs for add / replace photos */}
      <input
        ref={addPhotoInputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={handleAddMinutesPhoto}
      />
      <input
        ref={replacePhotoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleReplaceMinutesPhoto}
      />

      {/* Header */}
      <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 rounded-lg bg-sky-600 text-white font-mono font-black text-xs">
            Bước 09
          </span>
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-800">
              Biên Bản Khảo Sát Hiện Trường Đã Ký (Hình Chụp Biên Bản)
            </h3>
            <p className="text-xs text-slate-500">
              Thư viện ảnh chụp các trang biên bản giấy thực tế có chữ ký xác nhận của các bên và thông tin pháp lý
            </p>
          </div>
        </div>

        {checkDirty('signatures', 'workingMinutesPhotos') && (
          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-300">
            Đã sửa ảnh biên bản
          </span>
        )}
      </div>

      <div className="p-5 space-y-6">
        {/* 1. KHỐI TRỌNG TÂM: BỘ SƯU TẬP ẢNH CHỤP BIÊN BẢN HIỆN TRƯỜNG */}
        <div className="p-4 sm:p-5 rounded-2xl bg-sky-50/30 border border-sky-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-sky-100">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-sky-700" />
              <div>
                <span className="text-xs sm:text-sm font-black uppercase text-slate-800 tracking-wide">
                  Ảnh Chụp Biên Bản Giấy Khảo Sát Hiện Trường ({rawPhotos.length} trang)
                </span>
                <p className="text-[11px] text-slate-500">
                  Ảnh chụp nguyên bản biên bản khảo sát giấy có đầy đủ chữ ký tươi của KSV và Chủ hộ tại thực địa
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onOpenPhotoHistory && (
                <button
                  type="button"
                  onClick={() =>
                    onOpenPhotoHistory({
                      photoType: 'WORKING_MINUTES',
                      photoTitle: 'Biên bản khảo sát hiện trường',
                    })
                  }
                  className="px-2.5 py-1.5 rounded-xl bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Xem toàn bộ lịch sử ảnh biên bản và khôi phục trang đã xóa"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Lịch sử / Khôi phục</span>
                </button>
              )}

              {isEditMode && (
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenPhotoAction) {
                      onOpenPhotoAction({
                        category: 'MINUTES',
                        targetPhotoType: 'WORKING_MINUTES',
                        targetPhotoId: 'signatures.workingMinutesPhotos',
                        photoTitle: 'Trang biên bản khảo sát hiện trường',
                        initialMode: 'ADD',
                      });
                    } else {
                      addPhotoInputRef.current?.click();
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors shrink-0"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Thêm Trang Biên Bản</span>
                </button>
              )}
            </div>
          </div>

          {rawPhotos.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-xl border border-dashed border-sky-300 space-y-3">
              <FileCheck2 className="w-10 h-10 text-sky-400 mx-auto" />
              <div>
                <p className="text-xs font-bold text-slate-700">
                  Chưa có ảnh chụp biên bản khảo sát hiện trường trong hồ sơ này
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Tải lên ảnh chụp thực địa hoặc khôi phục các trang biên bản đã xóa từ lịch sử
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-1">
                {isEditMode && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenPhotoAction) {
                        onOpenPhotoAction({
                          category: 'MINUTES',
                          targetPhotoType: 'WORKING_MINUTES',
                          targetPhotoId: 'signatures.workingMinutesPhotos',
                          photoTitle: 'Trang biên bản khảo sát hiện trường',
                          initialMode: 'ADD',
                        });
                      } else {
                        addPhotoInputRef.current?.click();
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-bold hover:bg-sky-700 cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Tải lên trang biên bản</span>
                  </button>
                )}
                {onOpenPhotoHistory && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenPhotoHistory({
                        photoType: 'WORKING_MINUTES',
                        photoTitle: 'Biên bản khảo sát hiện trường',
                      })
                    }
                    className="px-3.5 py-1.5 rounded-lg bg-sky-50 border border-sky-300 text-sky-700 text-xs font-bold hover:bg-sky-100 cursor-pointer flex items-center gap-1.5"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Lịch sử / Khôi phục ảnh</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {rawPhotos.map((photoItem, idx) => {
                const url = getPhotoUrl(photoItem);
                const caption = getPhotoCaption(photoItem, idx);
                if (!url) return null;

                return (
                  <div
                    key={idx}
                    className="group relative rounded-xl border border-slate-200 overflow-hidden bg-white shadow-xs hover:border-sky-400 hover:shadow-md transition-all flex flex-col"
                  >
                    {/* Image preview area */}
                    <div
                      className="relative aspect-4/3 bg-slate-100 cursor-pointer overflow-hidden"
                      onClick={() =>
                        onOpenPhotoZoom(
                          url,
                          caption,
                          typeof photoItem === 'object' ? photoItem.photoCode : undefined
                        )
                      }
                    >
                      <img
                        src={url}
                        alt={caption}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="p-1.5 rounded-full bg-white/90 text-slate-800 shadow">
                          <ZoomIn className="w-4 h-4" />
                        </span>
                      </div>
                      <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/60 text-white font-mono text-[10px] font-bold">
                        Trang {idx + 1}
                      </span>
                    </div>

                    {/* Bottom caption & edit actions */}
                    <div className="p-2.5 bg-white border-t border-slate-100 flex items-center justify-between gap-1 text-xs">
                      <span className="font-semibold text-slate-700 truncate" title={caption}>
                        {caption}
                      </span>

                      <div className="flex items-center gap-1 shrink-0">
                        {onOpenPhotoHistory && (
                          <button
                            type="button"
                            title="Lịch sử phiên bản trang biên bản"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenPhotoHistory({
                                photoCode: typeof photoItem === 'object' ? photoItem.photoCode : undefined,
                                photoType: 'WORKING_MINUTES',
                                photoTitle: caption,
                                currentPhotoUrl: url,
                              });
                            }}
                            className="p-1 rounded text-slate-500 hover:text-violet-600 hover:bg-violet-50 transition-colors cursor-pointer"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {isEditMode && (
                          <>
                            <button
                              type="button"
                              title="Thay ảnh trang này"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onOpenPhotoAction && url) {
                                  onOpenPhotoAction({
                                    category: 'MINUTES',
                                    targetPhotoType: 'WORKING_MINUTES',
                                    targetPhotoId: 'signatures.workingMinutesPhotos',
                                    photoIndex: idx,
                                    currentPhotoUrl: url,
                                    photoTitle: caption,
                                    initialMode: 'REPLACE',
                                  });
                                } else if (onOpenPhotoReplace && url) {
                                  onOpenPhotoReplace({
                                    targetPhotoType: 'WORKING_MINUTES',
                                    targetPhotoId: 'signatures.workingMinutesPhotos',
                                    photoIndex: idx,
                                    currentPhotoUrl: url,
                                    photoTitle: caption,
                                  });
                                } else {
                                  handleTriggerReplace(idx);
                                }
                              }}
                              className="p-1 rounded text-slate-500 hover:text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Xóa trang biên bản này"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onOpenPhotoAction && url) {
                                  onOpenPhotoAction({
                                    category: 'MINUTES',
                                    targetPhotoType: 'WORKING_MINUTES',
                                    targetPhotoId: 'signatures.workingMinutesPhotos',
                                    photoIndex: idx,
                                    currentPhotoUrl: url,
                                    photoTitle: caption,
                                    initialMode: 'DELETE',
                                  });
                                } else {
                                  handleDeleteMinutesPhoto(idx);
                                }
                              }}
                              className="p-1 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 2. THÔNG TIN XÁC NHẬN CÁC BÊN (Gọn gàng, không dùng khung ký stylus) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Cán bộ Khảo Sát Viên */}
          <div
            className={`p-4 rounded-xl border transition-all space-y-3 ${
              checkDirty('surveyorName') || checkDirty('surveyorPhone') || checkDirty('surveyDate')
                ? 'bg-amber-50/30 border-amber-400 ring-1 ring-amber-300'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-sky-700" />
                <span className="text-xs font-black uppercase text-slate-800">
                  1. Cán Bộ Khảo Sát Viên
                </span>
              </div>
              {(checkDirty('surveyorName') || checkDirty('surveyorPhone')) && (
                <span className="text-[10px] font-bold text-amber-700">Đã sửa</span>
              )}
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Họ và tên:</span>
                {isEditMode && handleFieldChange ? (
                  <input
                    type="text"
                    value={surveyorName || ''}
                    onChange={(e) => handleFieldChange('surveyorName', 'Họ tên KSV', e.target.value)}
                    placeholder="Tên KSV..."
                    className="p-1 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded text-right max-w-[160px]"
                  />
                ) : (
                  <span className="font-bold text-slate-800">{surveyorName || 'Cán bộ hiện trường'}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Số điện thoại:</span>
                {isEditMode && handleFieldChange ? (
                  <input
                    type="text"
                    value={surveyorPhone || ''}
                    onChange={(e) => handleFieldChange('surveyorPhone', 'SĐT KSV', e.target.value)}
                    placeholder="SĐT KSV..."
                    className="p-1 text-xs font-mono font-bold text-slate-700 bg-white border border-slate-300 rounded text-right max-w-[140px]"
                  />
                ) : (
                  <span className="font-mono font-bold text-slate-700">{surveyorPhone || '---'}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Ngày khảo sát:</span>
                {isEditMode && handleFieldChange ? (
                  <input
                    type="date"
                    value={surveyDate ? new Date(surveyDate).toISOString().slice(0, 10) : ''}
                    onChange={(e) => handleFieldChange('surveyDate', 'Ngày khảo sát', e.target.value)}
                    className="p-1 text-xs font-mono text-slate-700 bg-white border border-slate-300 rounded text-right"
                  />
                ) : (
                  <span className="font-mono font-semibold text-slate-600">
                    {surveyDate ? new Date(surveyDate).toLocaleDateString('vi-VN') : 'Tại thời điểm khảo sát'}
                  </span>
                )}
              </div>

              {surveyorSignatureUrl ? (
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-semibold">Chữ ký KSV:</span>
                    <img
                      src={surveyorSignatureUrl}
                      alt="Chữ ký KSV"
                      onClick={() => onOpenPhotoZoom(surveyorSignatureUrl, 'Chữ ký Khảo sát viên', 'SIG_SURVEYOR')}
                      className="h-8 max-w-[120px] object-contain bg-white rounded border border-slate-200 cursor-pointer p-0.5 hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    {onOpenPhotoHistory && (
                      <button
                        type="button"
                        title="Lịch sử chữ ký KSV"
                        onClick={() =>
                          onOpenPhotoHistory({
                            photoType: 'SIGNATURE_SURVEYOR',
                            photoTitle: 'Chữ ký Khảo Sát Viên',
                            currentPhotoUrl: surveyorSignatureUrl,
                          })
                        }
                        className="p-1 rounded text-slate-500 hover:text-violet-600 hover:bg-violet-50 transition-colors cursor-pointer"
                      >
                        <History className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isEditMode && (
                      <>
                        <button
                          type="button"
                          title="Đổi chữ ký KSV"
                          onClick={() => {
                            if (onOpenPhotoAction) {
                              onOpenPhotoAction({
                                category: 'SIGNATURE',
                                targetPhotoType: 'SIGNATURE_SURVEYOR',
                                targetPhotoId: 'surveyorSignatureUrl',
                                currentPhotoUrl: surveyorSignatureUrl,
                                photoTitle: 'Chữ ký Khảo Sát Viên',
                                initialMode: 'REPLACE',
                              });
                            } else if (onOpenPhotoReplace) {
                              onOpenPhotoReplace({
                                targetPhotoType: 'SIGNATURE_SURVEYOR',
                                targetPhotoId: 'surveyor_signature_url',
                                currentPhotoUrl: surveyorSignatureUrl,
                                photoTitle: 'Chữ ký Khảo Sát Viên',
                              });
                            }
                          }}
                          className="text-[10px] font-bold text-sky-600 hover:text-sky-800 bg-sky-50 px-1.5 py-0.5 rounded cursor-pointer"
                        >
                          Đổi
                        </button>
                        <button
                          type="button"
                          title="Xóa chữ ký KSV"
                          onClick={() => {
                            if (onOpenPhotoAction) {
                              onOpenPhotoAction({
                                category: 'SIGNATURE',
                                targetPhotoType: 'SIGNATURE_SURVEYOR',
                                targetPhotoId: 'surveyorSignatureUrl',
                                currentPhotoUrl: surveyorSignatureUrl,
                                photoTitle: 'Chữ ký Khảo Sát Viên',
                                initialMode: 'DELETE',
                              });
                            }
                          }}
                          className="text-[10px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded cursor-pointer"
                        >
                          Xóa
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-400 italic">Chưa có chữ ký KSV</span>
                  <div className="flex items-center gap-1">
                    {onOpenPhotoHistory && (
                      <button
                        type="button"
                        title="Khôi phục chữ ký KSV từ lịch sử"
                        onClick={() =>
                          onOpenPhotoHistory({
                            photoType: 'SIGNATURE_SURVEYOR',
                            photoTitle: 'Chữ ký Khảo Sát Viên',
                          })
                        }
                        className="p-1 rounded text-slate-500 hover:text-violet-600 hover:bg-violet-50 transition-colors cursor-pointer"
                      >
                        <History className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isEditMode && onOpenPhotoAction && (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenPhotoAction({
                            category: 'SIGNATURE',
                            targetPhotoType: 'SIGNATURE_SURVEYOR',
                            targetPhotoId: 'surveyorSignatureUrl',
                            photoTitle: 'Chữ ký Khảo Sát Viên',
                            initialMode: 'ADD',
                          })
                        }
                        className="text-[10px] font-bold text-sky-600 hover:text-sky-800 bg-sky-50 px-2 py-0.5 rounded cursor-pointer"
                      >
                        + Tải lên
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Đại diện Chủ Hộ / Công Trình */}
          <div
            className={`p-4 rounded-xl border transition-all space-y-3 ${
              checkDirty('ownerName') || checkDirty('ownerPhone')
                ? 'bg-amber-50/30 border-amber-400 ring-1 ring-amber-300'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-black uppercase text-slate-800">
                  2. Đại Diện Chủ Hộ / Chủ Sở Hữu
                </span>
              </div>
              {(checkDirty('ownerName') || checkDirty('ownerPhone')) && (
                <span className="text-[10px] font-bold text-amber-700">Đã sửa</span>
              )}
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Người ký biên bản:</span>
                {isEditMode && handleFieldChange ? (
                  <input
                    type="text"
                    value={ownerName || ''}
                    onChange={(e) => handleFieldChange('ownerName', 'Họ tên chủ hộ', e.target.value)}
                    className="p-1 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded text-right max-w-[160px]"
                  />
                ) : (
                  <span className="font-bold text-slate-800">{ownerName || 'Chủ hộ / Đại diện'}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Số điện thoại:</span>
                {isEditMode && handleFieldChange ? (
                  <input
                    type="text"
                    value={ownerPhone || ''}
                    onChange={(e) => handleFieldChange('ownerPhone', 'SĐT chủ hộ', e.target.value)}
                    placeholder="SĐT..."
                    className="p-1 text-xs font-mono font-bold text-slate-700 bg-white border border-slate-300 rounded text-right max-w-[140px]"
                  />
                ) : (
                  <span className="font-mono font-bold text-slate-700">{ownerPhone || '---'}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Trạng thái có mặt:</span>
                <span className={`font-bold ${isAbsentee ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {isAbsentee ? 'Vắng mặt thực địa' : 'Có mặt ký biên bản'}
                </span>
              </div>

              {ownerSignatureUrl ? (
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-semibold">Chữ ký chủ hộ:</span>
                    <img
                      src={ownerSignatureUrl}
                      alt="Chữ ký Chủ hộ"
                      onClick={() => onOpenPhotoZoom(ownerSignatureUrl, 'Chữ ký Chủ hộ / Đại diện', 'SIG_OWNER')}
                      className="h-8 max-w-[120px] object-contain bg-white rounded border border-slate-200 cursor-pointer p-0.5 hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    {onOpenPhotoHistory && (
                      <button
                        type="button"
                        title="Lịch sử chữ ký chủ hộ"
                        onClick={() =>
                          onOpenPhotoHistory({
                            photoType: 'SIGNATURE_OWNER',
                            photoTitle: 'Chữ ký Chủ Hộ / Đại diện',
                            currentPhotoUrl: ownerSignatureUrl,
                          })
                        }
                        className="p-1 rounded text-slate-500 hover:text-violet-600 hover:bg-violet-50 transition-colors cursor-pointer"
                      >
                        <History className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isEditMode && (
                      <>
                        <button
                          type="button"
                          title="Đổi chữ ký chủ hộ"
                          onClick={() => {
                            if (onOpenPhotoAction) {
                              onOpenPhotoAction({
                                category: 'SIGNATURE',
                                targetPhotoType: 'SIGNATURE_OWNER',
                                targetPhotoId: 'ownerSignatureUrl',
                                currentPhotoUrl: ownerSignatureUrl,
                                photoTitle: 'Chữ ký Chủ Hộ / Đại diện',
                                initialMode: 'REPLACE',
                              });
                            } else if (onOpenPhotoReplace) {
                              onOpenPhotoReplace({
                                targetPhotoType: 'SIGNATURE_OWNER',
                                targetPhotoId: 'owner_signature_url',
                                currentPhotoUrl: ownerSignatureUrl,
                                photoTitle: 'Chữ ký Chủ Hộ / Đại diện',
                              });
                            }
                          }}
                          className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded cursor-pointer"
                        >
                          Đổi
                        </button>
                        <button
                          type="button"
                          title="Xóa chữ ký chủ hộ"
                          onClick={() => {
                            if (onOpenPhotoAction) {
                              onOpenPhotoAction({
                                category: 'SIGNATURE',
                                targetPhotoType: 'SIGNATURE_OWNER',
                                targetPhotoId: 'ownerSignatureUrl',
                                currentPhotoUrl: ownerSignatureUrl,
                                photoTitle: 'Chữ ký Chủ Hộ / Đại diện',
                                initialMode: 'DELETE',
                              });
                            }
                          }}
                          className="text-[10px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded cursor-pointer"
                        >
                          Xóa
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : !isAbsentee ? (
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-400 italic">Chưa có chữ ký Chủ hộ</span>
                  <div className="flex items-center gap-1">
                    {onOpenPhotoHistory && (
                      <button
                        type="button"
                        title="Khôi phục chữ ký Chủ hộ từ lịch sử"
                        onClick={() =>
                          onOpenPhotoHistory({
                            photoType: 'SIGNATURE_OWNER',
                            photoTitle: 'Chữ ký Chủ Hộ / Đại diện',
                          })
                        }
                        className="p-1 rounded text-slate-500 hover:text-violet-600 hover:bg-violet-50 transition-colors cursor-pointer"
                      >
                        <History className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isEditMode && onOpenPhotoAction && (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenPhotoAction({
                            category: 'SIGNATURE',
                            targetPhotoType: 'SIGNATURE_OWNER',
                            targetPhotoId: 'ownerSignatureUrl',
                            photoTitle: 'Chữ ký Chủ Hộ / Đại diện',
                            initialMode: 'ADD',
                          })
                        }
                        className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded cursor-pointer"
                      >
                        + Tải lên
                      </button>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Người Làm Chứng / Xác Nhận Địa Phương */}
          <div
            className={`p-4 rounded-xl border transition-all space-y-3 ${
              checkDirty('witnessName') || checkDirty('witnessRole') || checkDirty('witnessPhone')
                ? 'bg-amber-50/30 border-amber-400 ring-1 ring-amber-300'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-700" />
                <span className="text-xs font-black uppercase text-slate-800">
                  3. Người Làm Chứng / Địa Phương
                </span>
              </div>
              {(checkDirty('witnessName') || checkDirty('witnessRole')) && (
                <span className="text-[10px] font-bold text-amber-700">Đã sửa</span>
              )}
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Họ và tên:</span>
                {isEditMode && handleFieldChange ? (
                  <input
                    type="text"
                    value={witnessName || ''}
                    onChange={(e) => handleFieldChange('witnessName', 'Người làm chứng', e.target.value)}
                    placeholder="Tên người làm chứng..."
                    className="p-1 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded text-right max-w-[160px]"
                  />
                ) : (
                  <span className="font-bold text-slate-800">
                    {witnessName || (isAbsentee ? 'Cán bộ TDP / Địa chính' : 'Không có')}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Chức vụ / Đơn vị:</span>
                {isEditMode && handleFieldChange ? (
                  <input
                    type="text"
                    value={witnessRole || ''}
                    onChange={(e) => handleFieldChange('witnessRole', 'Chức vụ người làm chứng', e.target.value)}
                    placeholder="VD: Tổ trưởng TDP 12"
                    className="p-1 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded text-right max-w-[160px]"
                  />
                ) : (
                  <span className="text-slate-700">{witnessRole || 'Không có'}</span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Số điện thoại:</span>
                {isEditMode && handleFieldChange ? (
                  <input
                    type="text"
                    value={witnessPhone || ''}
                    onChange={(e) => handleFieldChange('witnessPhone', 'SĐT người làm chứng', e.target.value)}
                    placeholder="SĐT..."
                    className="p-1 text-xs font-mono text-slate-800 bg-white border border-slate-300 rounded text-right max-w-[140px]"
                  />
                ) : (
                  <span className="font-mono text-slate-700">{witnessPhone || '---'}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 3. TRƯỜNG HỢP VẮNG MẶT (GỌN GÀNG, ĐÍNH KÈM GIẤY BÁO DÁN CỬA NẾU CÓ) */}
        {isAbsentee && (
          <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-purple-700" />
                <span className="text-xs font-black uppercase text-purple-900">
                  Ghi Nhận Khảo Sát Ngoại Quan (Chủ Hộ Vắng Mặt)
                </span>
              </div>
              <div className="flex items-center gap-2">
                {onOpenPhotoHistory && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenPhotoHistory({
                        photoType: 'ABSENCE_NOTICE',
                        photoTitle: 'Giấy thông báo vắng mặt',
                      })
                    }
                    className="px-2.5 py-1 rounded-lg bg-purple-100 text-purple-900 hover:bg-purple-200 border border-purple-300 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    title="Xem toàn bộ lịch sử ảnh giấy báo vắng mặt"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Lịch sử / Khôi phục</span>
                  </button>
                )}
                {isEditMode && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenPhotoAction) {
                        onOpenPhotoAction({
                          category: 'ABSENCE_NOTICE',
                          targetPhotoType: 'ABSENCE_NOTICE',
                          targetPhotoId: 'absentNoticePhotos',
                          photoTitle: 'Giấy thông báo vắng mặt dán cửa',
                          initialMode: 'ADD',
                        });
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>+ Thêm Ảnh Giấy Báo</span>
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-purple-800">
              Công trình được khảo sát ngoại quan do chủ hộ vắng mặt tại thời điểm thực địa.
              Biên bản khảo sát được lưu chiểu kèm giấy thông báo hoặc xác nhận của tổ dân phố/chính quyền địa phương.
            </p>

            {/* Danh sách lần liên hệ / dán giấy hẹn */}
            {absenceLogs && absenceLogs.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                {absenceLogs.map((log, lIdx) => (
                  <div
                    key={log.id || lIdx}
                    className="p-3 bg-white rounded-xl border border-purple-200 space-y-2 shadow-2xs"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-purple-900">
                      <span>Lần liên hệ #{log.attemptNumber || log.attempt_number || (lIdx + 1)}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {log.attemptDate || log.created_at ? new Date(log.attemptDate || log.created_at || '').toLocaleDateString('vi-VN') : ''}
                      </span>
                    </div>
                    {log.reason && (
                      <p className="text-[11px] text-slate-600">
                        <span className="font-semibold text-slate-700">Lý do:</span> {log.reason}
                      </p>
                    )}
                    {log.photoUrl && (
                      <div className="relative aspect-4/3 rounded-lg overflow-hidden bg-slate-100 group border border-slate-200">
                        <img
                          src={log.photoUrl}
                          alt={`Giấy báo lần ${lIdx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div
                          className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer text-white"
                          onClick={() => onOpenPhotoZoom(log.photoUrl!, `Giấy báo lần #${lIdx + 1}`, `ABSENCE_${lIdx + 1}`)}
                        >
                          <ZoomIn className="w-5 h-5 drop-shadow" />
                        </div>
                        <div className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-black/60 backdrop-blur-xs p-1 rounded-md">
                          {onOpenPhotoHistory && log.photoUrl && (
                            <button
                              type="button"
                              title="Lịch sử ảnh giấy báo"
                              onClick={() =>
                                onOpenPhotoHistory({
                                  photoType: 'ABSENCE_NOTICE',
                                  photoTitle: `Giấy báo vắng mặt lần #${lIdx + 1}`,
                                  currentPhotoUrl: log.photoUrl,
                                })
                              }
                              className="p-1 text-white hover:text-purple-300 rounded cursor-pointer"
                            >
                              <History className="w-3 h-3" />
                            </button>
                          )}
                          {isEditMode && (
                            <>
                              <button
                                type="button"
                                title="Thay ảnh giấy báo"
                                onClick={() => {
                                  if (onOpenPhotoAction && log.photoUrl) {
                                    onOpenPhotoAction({
                                      category: 'ABSENCE_NOTICE',
                                      targetPhotoType: 'ABSENCE_NOTICE',
                                      targetPhotoId: log.id || `absence_log_${lIdx}`,
                                      photoIndex: lIdx,
                                      currentPhotoUrl: log.photoUrl,
                                      photoTitle: `Giấy báo vắng mặt lần #${lIdx + 1}`,
                                      initialMode: 'REPLACE',
                                    });
                                  }
                                }}
                                className="p-1 text-white hover:text-purple-300 rounded cursor-pointer"
                              >
                                <RefreshCw className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                title="Xóa ảnh giấy báo"
                                onClick={() => {
                                  if (onOpenPhotoAction && log.photoUrl) {
                                    onOpenPhotoAction({
                                      category: 'ABSENCE_NOTICE',
                                      targetPhotoType: 'ABSENCE_NOTICE',
                                      targetPhotoId: log.id || `absence_log_${lIdx}`,
                                      photoIndex: lIdx,
                                      currentPhotoUrl: log.photoUrl,
                                      photoTitle: `Giấy báo vắng mặt lần #${lIdx + 1}`,
                                      initialMode: 'DELETE',
                                    });
                                  }
                                }}
                                className="p-1 text-white hover:text-rose-400 rounded cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center bg-white rounded-xl border border-dashed border-purple-300 space-y-2">
                <AlertTriangle className="w-6 h-6 text-purple-400 mx-auto" />
                <p className="text-xs font-semibold text-purple-900">
                  Chưa có ảnh giấy thông báo hoặc biên bản dán cửa trong hồ sơ vắng mặt
                </p>
                <div className="flex items-center justify-center gap-2 pt-1">
                  {isEditMode && (
                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenPhotoAction) {
                          onOpenPhotoAction({
                            category: 'ABSENCE_NOTICE',
                            targetPhotoType: 'ABSENCE_NOTICE',
                            targetPhotoId: 'absentNoticePhotos',
                            photoTitle: 'Giấy thông báo vắng mặt dán cửa',
                            initialMode: 'ADD',
                          });
                        }
                      }}
                      className="px-3 py-1 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Tải lên ảnh giấy báo</span>
                    </button>
                  )}
                  {onOpenPhotoHistory && (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenPhotoHistory({
                          photoType: 'ABSENCE_NOTICE',
                          photoTitle: 'Giấy thông báo vắng mặt',
                        })
                      }
                      className="px-3 py-1 rounded-lg bg-purple-50 border border-purple-300 text-purple-800 text-xs font-bold hover:bg-purple-100 cursor-pointer flex items-center gap-1"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>Lịch sử / Khôi phục ảnh</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. Ý KIẾN VÀ GHI CHÚ PHẢN HỒI CỦA CHỦ HỘ */}
        <div
          className={`p-4 rounded-xl border transition-all space-y-2 ${
            checkDirty('ownerFeedback')
              ? 'bg-amber-50/30 border-amber-400 ring-1 ring-amber-300'
              : 'bg-blue-50/60 border-blue-200'
          }`}
        >
          <div className="flex items-center justify-between text-blue-900 font-bold text-xs">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-blue-700" />
              <span>Ý Kiến & Ghi Chú Phản Hồi Của Chủ Hộ Khi Khảo Sát:</span>
            </div>
            {checkDirty('ownerFeedback') && (
              <span className="text-[10px] font-bold text-amber-700">Đã sửa</span>
            )}
          </div>
          {isEditMode && handleFieldChange ? (
            <textarea
              rows={2}
              value={ownerFeedback || ''}
              onChange={(e) => handleFieldChange('ownerFeedback', 'Ý kiến chủ hộ', e.target.value)}
              placeholder="Nhập ý kiến phản hồi hoặc cam kết của chủ hộ (nếu có)..."
              className="w-full p-2.5 text-xs text-slate-800 bg-white border border-blue-300 rounded-lg focus:outline-sky-500"
            />
          ) : (
            <p className="text-xs text-slate-800 whitespace-pre-wrap pl-3 bg-white p-3 rounded-lg border border-blue-100 font-medium">
              {ownerFeedback || 'Không'}
            </p>
          )}
        </div>

        {/* 5. TIÊU CHUẨN PHÁP LÝ LIÊN DANH */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Hồ sơ được thẩm định theo quy chuẩn kỹ thuật Liên danh CRLG-CRSRI-TT và Nghị định 15/2021/NĐ-CP về quản lý chất lượng công trình xây dựng phục vụ dự án Tuyến Metro số 2 TP.HCM.
          </span>
        </div>
      </div>
    </section>
  );
};
