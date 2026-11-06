import React, { useEffect, useState } from 'react';
import { X, Landmark, MapPin, EyeOff, RotateCcw, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { getErrorMessage } from '@/utils/errorUtils';
import type { ParcelExclusionType } from '../../../shared/types';
import { EXCLUSION_TYPE_LABELS } from '../../../shared/parcelExclusion';
import {
  excludeBatchParcels,
  fetchLocalAuthoritySuggestions,
  previewBatchLocalAuthority,
  restoreBatchParcels,
  setBatchLocalAuthority,
} from '../../../shared/parcelBatchApi';
import type { BatchResult, LocalAuthorityPreviewRow, LocalAuthoritySuggestion } from '../../../shared/parcelBatchApi';
import type { BatchOperationMode } from '../FloatingBatchActionBar';
import { BatchAddressTab } from './BatchAddressTab';

interface BatchGisOperationsModalProps {
  initialMode: BatchOperationMode;
  zoneId: string;
  parcelIds: string[];
  excludedParcelIds: string[];
  addressEnabled: boolean;
  onClose: () => void;
  /** Gọi sau khi lô ghi thành công để bản đồ tải lại dữ liệu */
  onCompleted: () => void;
}

const MIN_REASON_LENGTH = 3;

const TAB_META: Record<Exclude<BatchOperationMode, 'RESTORE'>, { label: string; icon: React.ReactNode }> = {
  LOCAL_AUTHORITY: { label: 'Đại diện CQĐP', icon: <Landmark size={14} /> },
  ADDRESS: { label: 'Đồng bộ địa chỉ', icon: <MapPin size={14} /> },
  EXCLUDE: { label: 'Ẩn thửa', icon: <EyeOff size={14} /> },
};

// ---------------------------------------------------------------------------
// KẾT QUẢ LÔ
// ---------------------------------------------------------------------------

const BatchResultPanel: React.FC<{ result: BatchResult; onClose: () => void }> = ({ result, onClose }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
      <CheckCircle2 size={16} /> Đã cập nhật {result.updated.length} thửa đất
      {result.skipped.length > 0 ? `, bỏ qua ${result.skipped.length} thửa` : ''}.
    </div>
    {result.skipped.length > 0 && (
      <div className="max-h-[40vh] overflow-auto rounded-xl border border-amber-200">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-amber-50 text-amber-900">
            <tr>
              <th className="p-2 text-left">Mã thửa</th>
              <th className="p-2 text-left">Lý do bỏ qua</th>
            </tr>
          </thead>
          <tbody>
            {result.skipped.map((s) => (
              <tr key={s.parcelId} className="border-t border-amber-100">
                <td className="p-2">
                  <span className="inline-block rounded-md border border-teal-700 bg-teal-950 px-1.5 py-0.5 font-mono font-bold text-teal-300">
                    {s.projectParcelCode}
                  </span>
                </td>
                <td className="p-2 text-slate-700">{s.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
    <p className="text-[10px] text-slate-400">Mã lô (nhật ký hệ thống): {result.batchId}</p>
    <div className="flex justify-end">
      <button
        type="button"
        onClick={onClose}
        className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
      >
        Đóng
      </button>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// TAB CQĐP
// ---------------------------------------------------------------------------

const LocalAuthorityTab: React.FC<{ zoneId: string; parcelIds: string[]; onDone: (r: BatchResult) => void }> = ({
  zoneId,
  parcelIds,
  onDone,
}) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');
  const [suggestions, setSuggestions] = useState<LocalAuthoritySuggestion[]>([]);
  const [preview, setPreview] = useState<LocalAuthorityPreviewRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    Promise.all([fetchLocalAuthoritySuggestions(zoneId), previewBatchLocalAuthority(parcelIds)])
      .then(([sug, pre]) => {
        if (cancelled) return;
        setSuggestions(sug);
        setPreview(pre);
      })
      .catch((err: unknown) => {
        console.error('[BatchGisOperations:localAuthorityPreview] Không thể tải dữ liệu CQĐP:', err);
        if (!cancelled) setErrorMessage(getErrorMessage(err, 'Không thể tải dữ liệu đại diện CQĐP'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [zoneId, parcelIds]);

  const trimmed = { name: name.trim(), role: role.trim() || null, phone: phone.trim() || null };
  const locked = preview.filter((p) => p.lockedReason);
  const willOverwrite = preview.filter(
    (p) =>
      !p.lockedReason &&
      p.current &&
      (p.current.name !== trimmed.name || (p.current.role ?? null) !== trimmed.role || (p.current.phone ?? null) !== trimmed.phone)
  );
  const canSubmit = trimmed.name.length >= 2 && !isSubmitting && !isLoading;

  const applySuggestion = (index: string) => {
    const s = suggestions[Number(index)];
    if (!s) return;
    setName(s.name);
    setRole(s.role ?? '');
    setPhone(s.phone ?? '');
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      onDone(await setBatchLocalAuthority({ parcelIds, ...trimmed }));
    } catch (err: unknown) {
      console.error('[BatchGisOperations:localAuthoritySet] Không thể gán đại diện CQĐP:', err);
      setErrorMessage(getErrorMessage(err, 'Không thể gán đại diện CQĐP'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-[11px] font-medium text-indigo-900">
        Giá trị gán ở cấp thửa chỉ dùng khi hồ sơ KSV <strong>không ghi</strong> người làm chứng. Người làm chứng KSV đã ghi
        luôn được giữ nguyên, hồ sơ khảo sát không bị sửa.
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 size={14} className="animate-spin" /> Đang tải danh sách gợi ý...
        </div>
      ) : (
        suggestions.length > 0 && (
          <label className="block text-xs font-bold text-slate-700">
            Chọn nhanh đại diện đã có trong phân khu
            <select
              defaultValue=""
              onChange={(e) => applySuggestion(e.target.value)}
              className="mt-1 w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800"
            >
              <option value="">-- Chọn đại diện --</option>
              {suggestions.map((s, i) => (
                <option key={`${s.name}-${s.role ?? ''}-${s.phone ?? ''}`} value={i}>
                  {s.name}
                  {s.role ? ` – ${s.role}` : ''}
                  {s.source === 'PARCEL' ? ` (đang gán ${s.parcelCount} thửa)` : ' (quy tắc địa bàn)'}
                </option>
              ))}
            </select>
          </label>
        )
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="block text-xs font-bold text-slate-700">
          Họ tên đại diện *
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={128}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800"
            placeholder="VD: Nguyễn Văn A"
          />
        </label>
        <label className="block text-xs font-bold text-slate-700">
          Chức vụ / Đơn vị
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            maxLength={128}
            list="batch-la-role-options"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800"
            placeholder="VD: Tổ trưởng Tổ dân phố"
          />
          <datalist id="batch-la-role-options">
            {['Tổ trưởng Tổ dân phố', 'Tổ phó Tổ dân phố', 'Cán bộ Địa chính Phường', 'Phó Chủ tịch UBND Phường', 'Trưởng Ban Quản trị Tòa nhà'].map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </label>
        <label className="block text-xs font-bold text-slate-700">
          Số điện thoại
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={32}
            inputMode="tel"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800"
          />
        </label>
      </div>

      {willOverwrite.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-900">
          <div className="mb-1 flex items-center gap-1 font-bold">
            <AlertTriangle size={13} /> {willOverwrite.length} thửa sẽ bị thay giá trị CQĐP cũ (giá trị cũ được lưu nhật ký):
          </div>
          <div className="max-h-28 overflow-auto">
            {willOverwrite.map((p) => (
              <div key={p.parcelId}>
                <span className="font-mono font-bold">{p.projectParcelCode}</span>: {p.current?.name}
                {p.current?.role ? ` – ${p.current.role}` : ''}
              </div>
            ))}
          </div>
        </div>
      )}
      {locked.length > 0 && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
          {locked.length} thửa bị khóa (hồ sơ đã duyệt / không ACTIVE) sẽ được bỏ qua.
        </p>
      )}

      {errorMessage && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{errorMessage}</p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Landmark size={14} />}
          Gán CQĐP cho {parcelIds.length - locked.length} thửa
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// TAB ẨN / KHÔI PHỤC
// ---------------------------------------------------------------------------

const LifecycleTab: React.FC<{ mode: 'EXCLUDE' | 'RESTORE'; parcelIds: string[]; onDone: (r: BatchResult) => void }> = ({
  mode,
  parcelIds,
  onDone,
}) => {
  const [exclusionType, setExclusionType] = useState<ParcelExclusionType>('ROAD_TRAFFIC');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const isExclude = mode === 'EXCLUDE';
  const canSubmit = reason.trim().length >= MIN_REASON_LENGTH && !isSubmitting;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const result = isExclude
        ? await excludeBatchParcels({ parcelIds, exclusionType, reason: reason.trim() })
        : await restoreBatchParcels({ parcelIds, reason: reason.trim() });
      onDone(result);
    } catch (err: unknown) {
      console.error(`[BatchGisOperations:${isExclude ? 'exclude' : 'restore'}] Không thể cập nhật trạng thái thửa:`, err);
      setErrorMessage(getErrorMessage(err, 'Không thể cập nhật trạng thái thửa đất'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <p
        className={`flex items-start gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-medium ${
          isExclude ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'
        }`}
      >
        <AlertTriangle size={13} className="mt-0.5 shrink-0" />
        {isExclude
          ? `Ẩn ${parcelIds.length} thửa khỏi khảo sát. Chỉ thửa CHƯA nộp hồ sơ, chưa khóa mới được ẩn; thửa không đủ điều kiện sẽ được liệt kê và bỏ qua.`
          : `Khôi phục ${parcelIds.length} thửa đã ẩn về khảo sát. Lý do loại trừ cũ được lưu trong nhật ký.`}
      </p>

      {isExclude && (
        <label className="block text-xs font-bold text-slate-700">
          Phân loại
          <select
            value={exclusionType}
            onChange={(e) => setExclusionType(e.target.value as ParcelExclusionType)}
            className="mt-1 w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800"
          >
            {(Object.keys(EXCLUSION_TYPE_LABELS) as ParcelExclusionType[]).map((type) => (
              <option key={type} value={type}>
                {EXCLUSION_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block text-xs font-bold text-slate-700">
        Lý do giải trình *
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          rows={3}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800"
          placeholder={isExclude ? 'VD: Phần vỉa hè đường Cách Mạng Tháng Tám' : 'VD: Kiểm tra lại thấy có công trình'}
        />
      </label>

      {errorMessage && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{errorMessage}</p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            isExclude ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
        >
          {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : isExclude ? <EyeOff size={14} /> : <RotateCcw size={14} />}
          {isExclude ? `Ẩn ${parcelIds.length} thửa` : `Khôi phục ${parcelIds.length} thửa`}
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// MODAL
// ---------------------------------------------------------------------------

export const BatchGisOperationsModal: React.FC<BatchGisOperationsModalProps> = ({
  initialMode,
  zoneId,
  parcelIds,
  excludedParcelIds,
  addressEnabled,
  onClose,
  onCompleted,
}) => {
  const [mode, setMode] = useState<BatchOperationMode>(initialMode);
  const [result, setResult] = useState<BatchResult | null>(null);
  // Chốt danh sách thửa lúc mở modal: bản đồ cha render lại không làm tải lại bảng / mất chỉnh sửa đang dở
  const [stableIds] = useState<string[]>(() => [...parcelIds]);
  const [stableExcludedIds] = useState<string[]>(() => [...excludedParcelIds]);

  const handleDone = (r: BatchResult) => {
    setResult(r);
    if (r.updated.length > 0) onCompleted();
  };

  const tabs = (Object.keys(TAB_META) as Array<keyof typeof TAB_META>).filter((t) => t !== 'ADDRESS' || addressEnabled);

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-950/50 p-3">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {mode === 'RESTORE' ? 'Khôi phục thửa đất hàng loạt' : 'Tác vụ đồng loạt trên bản đồ'}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="inline-block rounded-md border border-cyan-700 bg-cyan-950 px-2 py-0.5 font-mono text-[11px] font-bold text-cyan-300">
                {zoneId}
              </span>
              <span className="text-[11px] font-medium text-slate-500">
                {mode === 'RESTORE' ? `${stableExcludedIds.length} thửa đã ẩn được chọn` : `${stableIds.length} thửa được chọn`}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 cursor-pointer"
            title="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {!result && mode !== 'RESTORE' && (
          <div className="mb-3 flex flex-wrap gap-1 border-b border-slate-200">
            {tabs.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setMode(t)}
                className={`cursor-pointer flex items-center gap-1 rounded-t-lg border-b-2 px-3 py-2 text-xs font-bold ${
                  mode === t ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {TAB_META[t].icon} {TAB_META[t].label}
              </button>
            ))}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto">
          {result ? (
            <BatchResultPanel result={result} onClose={onClose} />
          ) : mode === 'LOCAL_AUTHORITY' ? (
            <LocalAuthorityTab zoneId={zoneId} parcelIds={stableIds} onDone={handleDone} />
          ) : mode === 'ADDRESS' ? (
            <BatchAddressTab parcelIds={stableIds} onDone={handleDone} />
          ) : (
            <LifecycleTab
              mode={mode}
              parcelIds={mode === 'RESTORE' ? stableExcludedIds : stableIds}
              onDone={handleDone}
            />
          )}
        </div>
      </div>
    </div>
  );
};
