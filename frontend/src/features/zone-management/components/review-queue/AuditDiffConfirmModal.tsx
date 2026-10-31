import { getErrorMessage } from '@/utils/errorUtils';
import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  FileDiff,
  KeyRound,
  RotateCcw,
} from 'lucide-react';
import { api } from '../../../../services/api';

import type { PhotoActionPayload } from './AuditPhotoActionModal';

export const PRESET_AUDIT_DIFF_REASONS = [
  'Cập nhật ranh đất đã nắn chỉnh sau Giải phóng mặt bằng (GPMB) & tính lại cự ly Metro',
  'Hiệu chỉnh số liệu mặt tiền & diện tích theo sổ đỏ/bản vẽ hoàn công',
  'Chuẩn hóa tên đường và đơn vị hành chính theo Nghị quyết 1685/NQ-UBTVQH15',
  'Điều chỉnh cấp nứt Burland và phân loại kết cấu sau phúc tra thực địa',
  'Xoay hướng ảnh và cập nhật thước đo khe nứt chuẩn A4',
  'Chuẩn hóa thông tin số nhà & tên chủ hộ theo hồ sơ pháp lý / CCCD',
  'Cập nhật phân loại móng sang CAT 1 kèm bản vẽ hoàn công',
  'Bổ sung vết nứt kết cấu và tọa độ ghim trên mặt bằng CAD',
  'Hiệu chỉnh số liệu đo lún nghiêng & độ võng dầm theo thực địa',
  'Chủ nhiệm thẩm định can thiệp đánh giá kỹ thuật (Engineering Judgement)',
  'Cập nhật ảnh hiện trường rõ nét thay thế ảnh cũ bị mờ',
];

export interface DiffItem {
  field: string;
  label: string;
  oldValue: unknown;
  newValue: unknown;
  isPhoto?: boolean;
}

interface Props {
  isOpen: boolean;
  reportId: string;
  parcelCode?: string;
  diffItems: DiffItem[];
  updatesPayload: Record<string, unknown>;
  formState?: Record<string, unknown>;
  photoActions?: PhotoActionPayload[];
  onClose: () => void;
  onSuccess: () => void;
  onJumpToStep?: (stepId: number) => void;
  onDiscardDiffItem?: (fieldKey: string) => void;
}

export const AuditDiffConfirmModal: React.FC<Props> = ({
  isOpen,
  reportId,
  parcelCode,
  diffItems,
  updatesPayload,
  formState,
  photoActions = [],
  onClose,
  onSuccess,
  onJumpToStep,
  onDiscardDiffItem,
}) => {
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeDiffTab, setActiveDiffTab] = useState<'ALL' | 'GENERAL' | 'CAD_PINS' | 'PHOTOS' | 'SCORES'>('ALL');

  if (!isOpen) return null;

  // Lỗi chặn pháp lý: CAT 1/2 thiếu bản vẽ hoàn công (kết hợp cả ảnh sẵn có và photoActions đang staged)
  const catScore = Number(updatesPayload.foundationCatScore ?? formState?.foundationCatScore ?? 5);
  const rawDrawings = (updatesPayload.asBuiltDrawingPhotos ?? formState?.asBuiltDrawingPhotos) as unknown[] | undefined;
  const fallbackSingleDwg = (updatesPayload.asBuiltDrawingPhotoUrl ?? formState?.asBuiltDrawingPhotoUrl) as string | undefined;
  const baseDrawingsCount = Array.isArray(rawDrawings) && rawDrawings.length > 0
    ? rawDrawings.length
    : (fallbackSingleDwg && fallbackSingleDwg.trim() !== '' ? 1 : 0);

  const asBuiltPhotoActions = photoActions.filter(
    (a) =>
      a.category === 'AS_BUILT' ||
      a.targetPhotoType === 'AS_BUILT' ||
      a.targetPhotoId === 'asBuiltDrawingPhotos'
  );
  const addedAsBuiltCount = asBuiltPhotoActions.reduce((acc, a) => {
    if (a.action !== 'ADD') return acc;
    const count = Array.isArray(a.newPhotoUrls) && a.newPhotoUrls.length > 0 ? a.newPhotoUrls.length : (a.newPhotoUrl ? 1 : 0);
    return acc + count;
  }, 0);
  const deletedAsBuiltCount = asBuiltPhotoActions.filter((a) => a.action === 'DELETE').length;
  const effectiveDrawingsCount = Math.max(0, baseDrawingsCount + addedAsBuiltCount - deletedAsBuiltCount);

  const hasCatBlocker = (catScore === 1 || catScore === 2) && effectiveDrawingsCount === 0;

  const blockingErrorsCount = hasCatBlocker ? 1 : 0;
  const warningCount = 0;

  // Phân loại hạng mục diff theo 4 nhóm
  const categorizeDiffItem = (item: DiffItem): 'GENERAL' | 'CAD_PINS' | 'PHOTOS' | 'SCORES' => {
    const f = item.field.toLowerCase();
    if (item.isPhoto || f.includes('photo') || f.includes('minutes') || f.includes('signature')) {
      return 'PHOTOS';
    }
    if (f.includes('pin') || f.includes('cad') || f.includes('floor') || f.includes('zone') || f.includes('defect')) {
      return 'CAD_PINS';
    }
    if (
      f.includes('ecs') ||
      f.includes('vi') ||
      f.includes('burland') ||
      f.includes('impact') ||
      f.includes('bra') ||
      f.includes('score') ||
      f.includes('judgement')
    ) {
      return 'SCORES';
    }
    return 'GENERAL';
  };

  const groupCounts = {
    general: diffItems.filter((i) => categorizeDiffItem(i) === 'GENERAL').length,
    pins: diffItems.filter((i) => categorizeDiffItem(i) === 'CAD_PINS').length,
    photos: diffItems.filter((i) => categorizeDiffItem(i) === 'PHOTOS').length + photoActions.length,
    scores: diffItems.filter((i) => categorizeDiffItem(i) === 'SCORES').length,
  };

  const filteredDiffItems =
    activeDiffTab === 'ALL'
      ? diffItems
      : diffItems.filter((i) => categorizeDiffItem(i) === activeDiffTab);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasCatBlocker) {
      setErrorMsg('Không thể lưu do hồ sơ còn LỖI CHẶN PHÁP LÝ (Móng CAT 1/2 thiếu bản vẽ hoàn công).');
      return;
    }
    if (!adminPassword.trim()) {
      setErrorMsg('Vui lòng nhập mật khẩu tài khoản Zone Admin của bạn.');
      return;
    }

    // Tự động tổng hợp mô tả kiểm toán (Auto-Summary) từ danh sách các trường thay đổi và thao tác ảnh
    const autoSummaryParts: string[] = [];
    if (diffItems.length > 0) {
      const sampleLabels = diffItems.slice(0, 4).map((d) => d.label).join('; ');
      autoSummaryParts.push(
        `Chuẩn hóa ${diffItems.length} trường (${sampleLabels}${diffItems.length > 4 ? ` +${diffItems.length - 4} mục` : ''})`
      );
    }
    if (photoActions.length > 0) {
      autoSummaryParts.push(`${photoActions.length} thao tác ảnh hiện trường`);
    }
    const autoEditReason = autoSummaryParts.join(' • ') || 'Cập nhật chuẩn hóa dữ liệu thẩm định kỹ thuật';

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const res = await api.put(`/admin/reports/${reportId}/audit-edit`, {
        adminPassword: adminPassword.trim(),
        editReason: autoEditReason,
        diffPayload: diffItems,
        updates: updatesPayload,
        photoActions: photoActions || [],
      });

      if (res.data?.success || res.status === 200) {
        const warnings: unknown = res.data?.warnings;
        if (Array.isArray(warnings) && warnings.length > 0) {
          console.error('[AuditDiffConfirmModal:Submit] Lưu thành công nhưng có cảnh báo hậu xử lý:', warnings);
          alert(`Đã lưu chỉnh sửa, nhưng cần lưu ý:\n${warnings.join('\n')}`);
        } else {
          alert('Đã lưu chỉnh sửa và ghi nhận vào Nhật ký kiểm toán thành công!');
        }
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.data?.message || 'Không thể lưu thay đổi.');
      }
    } catch (err: unknown) {
      console.error('[AuditDiffConfirmModal] Error saving audit edits:', err);
      const msg = getErrorMessage(err, 'Lỗi xác thực khi lưu chỉnh sửa.');
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDisplayValue = (val: unknown) => {
    if (val === null || val === undefined || val === '') {
      return <span className="text-slate-400 italic font-mono">(Trống / Không có)</span>;
    }
    if (typeof val === 'string' && (val.startsWith('http') || val.startsWith('data:image/') || val.startsWith('/uploads'))) {
      return (
        <div className="flex items-center gap-1.5">
          <img src={val} alt="thumb" className="w-9 h-9 object-contain rounded border border-slate-200 bg-slate-50 shrink-0" />
          <span className="font-mono text-[10px] text-slate-500 truncate max-w-[120px]">{val}</span>
        </div>
      );
    }
    if (typeof val === 'boolean') {
      return val ? 'Có (Đã xác nhận)' : 'Không';
    }
    if (Array.isArray(val)) {
      if (val.length === 0) {
        return <span className="text-slate-400 italic font-mono">(Danh sách trống)</span>;
      }
      // Đa giác tọa độ [[lat, lng], ...]
      if (Array.isArray(val[0]) && val[0].length === 2 && typeof val[0][0] === 'number') {
        const firstPt = val[0] as [number, number];
        return (
          <span className="font-mono text-[11px]">
            Đa giác {val.length} đỉnh (Đỉnh 1: {Number(firstPt[0]).toFixed(5)}, {Number(firstPt[1]).toFixed(5)})
          </span>
        );
      }
      if (val.every((x) => typeof x === 'string' || typeof x === 'number')) {
        return <span>{val.join(', ')}</span>;
      }
      return <span className="font-mono text-[11px]">Danh sách ({val.length} mục)</span>;
    }
    if (typeof val === 'object') {
      const rec = val as Record<string, unknown>;
      const keys = Object.keys(rec);
      if (keys.length === 0) {
        return <span className="text-slate-400 italic font-mono">(Mặc định / Chưa thay đổi)</span>;
      }
      if ('lat' in rec || 'latitude' in rec) {
        const lat = Number(rec.lat ?? rec.latitude ?? 0);
        const lng = Number(rec.lng ?? rec.longitude ?? 0);
        const acc = rec.accuracy ? ` (±${rec.accuracy}m)` : '';
        return (
          <span className="font-mono text-[11px]">
            {lat.toFixed(6)}, {lng.toFixed(6)}{acc}
          </span>
        );
      }
      const pairs = keys
        .slice(0, 4)
        .map((k) => `${k}: ${String(rec[k] ?? '---')}`)
        .join(' • ');
      return (
        <span className="font-mono text-[11px]">
          {pairs}
          {keys.length > 4 ? ` (+${keys.length - 4} mục)` : ''}
        </span>
      );
    }
    return String(val);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[94vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header (Light Theme synchronized with Audit Studio) */}
        <div className="px-5 py-4 bg-gradient-to-r from-sky-50/90 via-white to-slate-50 text-slate-800 flex items-center justify-between border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 border border-sky-200 flex items-center justify-center">
              <FileDiff className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Đối Chiếu Sai Khác & Xác Thực Mật Khẩu</span>
                {parcelCode && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 font-mono font-bold">
                    {parcelCode}
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Rà soát các trường thông tin thay đổi so với dữ liệu gốc của Khảo Sát Viên trước khi ghi nhận pháp lý.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span className="font-semibold">{errorMsg}</span>
            </div>
          )}

          {/* Top Metrics Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            <div
              className={`p-2.5 rounded-xl border flex items-center gap-2 ${blockingErrorsCount > 0 ? 'bg-rose-50 border-rose-300 text-rose-800' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${blockingErrorsCount > 0 ? 'bg-rose-600 animate-pulse' : 'bg-slate-400'}`} />
              <div className="min-w-0">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Lỗi chặn</span>
                <span className={`font-mono font-black text-sm ${blockingErrorsCount > 0 ? 'text-rose-700' : ''}`}>
                  {blockingErrorsCount} Lỗi
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl border bg-slate-50 border-slate-200 text-slate-700 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Cảnh báo</span>
                <span className="font-mono font-black text-sm">{warningCount} Cảnh báo</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl border bg-slate-50 border-slate-200 text-slate-700 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Trường đổi</span>
                <span className="font-mono font-black text-sm">{diffItems.length} Trường</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl border bg-slate-50 border-slate-200 text-slate-700 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Ảnh can thiệp</span>
                <span className="font-mono font-black text-sm">{groupCounts.photos} Ảnh</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl border bg-slate-50 border-slate-200 text-slate-700 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Ghim CAD</span>
                <span className="font-mono font-black text-sm">{groupCounts.pins} Ghim</span>
              </div>
            </div>
          </div>

          {/* Red Blocker Banner */}
          {hasCatBlocker && (
            <div className="p-3.5 bg-red-600 text-white rounded-xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-white shrink-0 mt-0.5" />
                <div>
                  <span className="font-black text-xs uppercase tracking-wide block">
                    PHÁT HIỆN LỖI CHẶN PHÁP LÝ: THIẾU BẢN VẼ HOÀN CÔNG MÓNG
                  </span>
                  <span className="text-[11px] text-red-100 leading-relaxed block mt-0.5">
                    Công trình được xếp hạng <strong>Móng CAT {catScore}/5</strong> (Cọc khoan nhồi / Cọc ép BTCT) nhưng chưa có bản vẽ hoàn công / thiết kế móng đính kèm theo quy chuẩn Liên danh CRLG. Bạn không thể xác nhận và lưu khi còn lỗi chặn này.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onJumpToStep) {
                    onJumpToStep(2);
                  } else {
                    const el = document.getElementById('step-2');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="px-3 py-1.5 bg-white text-red-700 hover:bg-red-50 rounded-lg text-xs font-black shadow-xs shrink-0 cursor-pointer transition-colors"
              >
                Chuyển tới Bước 2 để tải bản vẽ &rarr;
              </button>
            </div>
          )}

          {/* Tabs Group Breakdown */}
          <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1 overflow-x-auto text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveDiffTab('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${activeDiffTab === 'ALL'
                  ? 'bg-sky-700 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
                }`}
            >
              Tất cả ({diffItems.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveDiffTab('GENERAL')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${activeDiffTab === 'GENERAL'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
                }`}
            >
              1. Thông số & Móng ({groupCounts.general})
            </button>
            <button
              type="button"
              onClick={() => setActiveDiffTab('CAD_PINS')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${activeDiffTab === 'CAD_PINS'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
                }`}
            >
              2. Ghim CAD ({groupCounts.pins})
            </button>
            <button
              type="button"
              onClick={() => setActiveDiffTab('PHOTOS')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${activeDiffTab === 'PHOTOS'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
                }`}
            >
              3. Ảnh & Biên bản ({groupCounts.photos})
            </button>
            <button
              type="button"
              onClick={() => setActiveDiffTab('SCORES')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${activeDiffTab === 'SCORES'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
                }`}
            >
              4. Điểm ECS/VI & BRA ({groupCounts.scores})
            </button>
          </div>

          {/* Diff Table (scrollable max-h-[52vh]) */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs max-h-[52vh] overflow-y-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200 text-[11px] sticky top-0 z-10 shadow-2xs">
                <tr>
                  <th className="p-3 w-1/4">Trường Thông Tin</th>
                  <th className={`p-3 ${onDiscardDiffItem ? 'w-[32%]' : 'w-[37.5%]'}`}>Giá Trị Ban Đầu (KSV Nộp)</th>
                  <th className={`p-3 ${onDiscardDiffItem ? 'w-[32%]' : 'w-[37.5%]'}`}>Giá Trị Mới (Admin Sửa)</th>
                  {onDiscardDiffItem && <th className="p-3 w-[11%] text-right">Thao Tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDiffItems.length === 0 ? (
                  <tr>
                    <td colSpan={onDiscardDiffItem ? 4 : 3} className="p-6 text-center text-slate-400">
                      Không có trường nào trong tab này bị thay đổi.
                    </td>
                  </tr>
                ) : (
                  filteredDiffItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="p-3 font-semibold text-slate-800">
                        <div>{item.label}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{item.field}</div>
                      </td>
                      <td className="p-3 bg-red-50/50 text-red-800 font-medium">
                        <span className="line-through opacity-80">{formatDisplayValue(item.oldValue)}</span>
                      </td>
                      <td className="p-3 bg-emerald-50/60 text-emerald-800 font-bold">
                        <span>{formatDisplayValue(item.newValue)}</span>
                      </td>
                      {onDiscardDiffItem && (
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => onDiscardDiffItem(item.field)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 text-[11px] font-bold border border-slate-200 hover:border-rose-300 transition-colors cursor-pointer shadow-2xs"
                            title="Bỏ thay đổi trường này, khôi phục giá trị KSV ban đầu"
                          >
                            <RotateCcw className="w-3 h-3 text-slate-500 hover:text-rose-500" />
                            <span>Bỏ sửa</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Staged Photo Actions Summary if any */}
          {photoActions.length > 0 && (activeDiffTab === 'ALL' || activeDiffTab === 'PHOTOS') && (
            <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200 space-y-1.5 text-xs">
              <span className="font-bold text-purple-900 block">
                Thao tác can thiệp ảnh đã ghi nhận ({photoActions.length} ảnh):
              </span>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {photoActions.map((pa, paIdx) => (
                  <div key={paIdx} className="flex items-center justify-between text-[11px] text-purple-800 bg-white/80 p-1.5 rounded border border-purple-100">
                    <span className="font-mono font-bold">
                      [{pa.action}] {pa.category} ({pa.targetPhotoId || (pa as { photoTitle?: string }).photoTitle || 'Ảnh'})
                    </span>
                    <span className="text-slate-500 italic truncate max-w-[200px]">
                      {pa.reason || 'Sửa đổi trực tiếp'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Admin Password Input */}
          <div className="space-y-1.5 p-4 rounded-xl bg-amber-50/60 border border-amber-200">
            <label className="text-xs font-black text-amber-900 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-amber-700" />
              <span>Xác Thực Bằng Mật Khẩu Zone Admin <span className="text-red-600">*</span></span>
            </label>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Dữ liệu khảo sát là căn cứ pháp lý bồi thường. Bắt buộc nhập mật khẩu đăng nhập của bạn để chứng thực quyền sửa đổi và khóa trách nhiệm pháp lý.
            </p>
            <div className="relative mt-2">
              <input
                type={showPassword ? 'text' : 'password'}
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Nhập mật khẩu tài khoản Zone Admin của bạn..."
                className="w-full pl-3 pr-10 py-2 bg-white border border-amber-300 rounded-xl text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Sticky Error Banner right above Footer Actions so errors are never hidden out of scroll view */}
        {errorMsg && (
          <div className="px-5 py-2.5 bg-red-50 border-t border-red-200 text-xs text-red-700 flex items-center justify-between gap-2 shrink-0 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span className="font-bold break-words">{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg('')}
              className="text-red-500 hover:text-red-700 p-0.5 rounded cursor-pointer shrink-0"
              title="Đóng thông báo lỗi"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Footer Actions */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Mã hóa bảo vệ tính toàn vẹn dữ liệu Metro 2</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Quay lại chỉnh sửa
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || (diffItems.length === 0 && photoActions.length === 0) || hasCatBlocker}
              title={
                hasCatBlocker
                  ? 'Không thể lưu do có lỗi chặn pháp lý móng CAT 1/2'
                  : undefined
              }
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Đang xác thực & Lưu...' : 'Xác Nhận & Lưu Chính Thức '}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
