import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, MapPin, AlertTriangle, Lock, Edit3, Eye, EyeOff, FileClock, Database as DatabaseIcon, X } from 'lucide-react';
import { getErrorMessage } from '@/utils/errorUtils';
import {
  formatStandardizedAddress168,
  isStreetContaminatedWithWard,
} from '../../../../../features/zone-management/components/review-queue/stepwise/utils/residentialAddressStandards';
import { previewBatchAddress, syncBatchAddress } from '../../../shared/parcelBatchApi';
import type { AddressFields, AddressPreviewRow, BatchResult } from '../../../shared/parcelBatchApi';

interface BatchAddressTabProps {
  parcelIds: string[];
  onDone: (result: BatchResult) => void;
}

/** Ba trường được ghi. Quận giữ nguyên giá trị cũ, không hiển thị (mô hình 168 ĐVHC không còn cấp quận). */
type EditableField = 'houseNumber' | 'street' | 'ward';
type EditableAddress = Pick<AddressFields, EditableField>;
const EDITABLE_FIELDS: EditableField[] = ['houseNumber', 'street', 'ward'];

const NOTES_PREF_KEY = 'metro2_batch_address_show_notes';

const touchKey = (parcelId: string, field: EditableField) => `${parcelId}:${field}`;

const formatAddress = (a: EditableAddress): string => formatStandardizedAddress168(a.houseNumber, a.street, a.ward);

const rawOneLine = (a: AddressFields): string => [a.houseNumber, a.street, a.ward].filter(Boolean).join(', ') || '---';

/** Số mục hồ sơ KSV sẽ đổi (Số nhà / Đường / Phường / Địa chỉ chuẩn hóa), khớp countReportDiff ở backend. */
const reportDiffOf = (row: AddressPreviewRow, edit: EditableAddress): number => {
  if (!row.reportId || !row.surveyorEntered) return 0;
  const sv = row.surveyorEntered;
  const fieldDiff = EDITABLE_FIELDS.filter((f) => sv[f] !== edit[f]).length;
  return fieldDiff + ((row.reportStandardizedAddress ?? '') !== formatAddress(edit) ? 1 : 0);
};

const needsManual = (row: AddressPreviewRow): boolean =>
  row.requiresManualStreet || row.requiresManualHouseNumber || Boolean(row.wardConflict) || row.isSplitWard;

/** Lý do dòng chưa được phép tích (null = được phép). Khớp các chốt kiểm tra lại ở backend. */
const blockReason = (row: AddressPreviewRow, edit: EditableAddress, touched: ReadonlySet<string>): string | null => {
  if (row.lockedReason) return row.lockedReason;
  if (!edit.street.trim()) return 'Cần nhập tên đường';
  if (isStreetContaminatedWithWard(edit.street) && edit.street !== row.parcelRaw.street) return 'Tên đường vẫn là tên phường';
  if (!edit.ward.trim()) return 'Cần chọn / nhập phường';
  if (row.isSplitWard && edit.ward === row.parcelRaw.ward) return 'Phường bị chia tách, cần chọn phường mới';
  if (row.wardConflict && !touched.has(touchKey(row.parcelId, 'ward'))) return 'Phường mâu thuẫn giữa địa chính và KSV, cần chọn';
  if (row.requiresManualHouseNumber && !touched.has(touchKey(row.parcelId, 'houseNumber'))) return 'Cần xác nhận số nhà';
  if (row.requiresManualStreet && !touched.has(touchKey(row.parcelId, 'street'))) return 'Cần nhập tên đường';
  const parcelUnchanged = EDITABLE_FIELDS.every((f) => edit[f] === row.parcelRaw[f]);
  if (parcelUnchanged && reportDiffOf(row, edit) === 0) return 'Không có thay đổi';
  return null;
};

const readNotesPref = (): boolean => {
  try {
    return window.localStorage.getItem(NOTES_PREF_KEY) === '1';
  } catch (err: unknown) {
    console.error('[BatchGisOperations:notesPref] Không đọc được tùy chọn hiển thị ghi chú:', err);
    return false;
  }
};

const writeNotesPref = (show: boolean): void => {
  try {
    window.localStorage.setItem(NOTES_PREF_KEY, show ? '1' : '0');
  } catch (err: unknown) {
    console.error('[BatchGisOperations:notesPref] Không lưu được tùy chọn hiển thị ghi chú:', err);
  }
};

const randomConfirmCode = (): string => String(Math.floor(1000 + Math.random() * 9000));

export const BatchAddressTab: React.FC<BatchAddressTabProps> = ({ parcelIds, onDone }) => {
  const [rows, setRows] = useState<AddressPreviewRow[]>([]);
  const [edits, setEdits] = useState<Record<string, EditableAddress>>({});
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showNotes, setShowNotes] = useState<boolean>(readNotesPref);
  const [confirmCode, setConfirmCode] = useState<string | null>(null);
  const [confirmInput, setConfirmInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    previewBatchAddress(parcelIds)
      .then((data) => {
        if (cancelled) return;
        setRows(data);
        setEdits(
          Object.fromEntries(
            data.map((r) => [r.parcelId, { houseNumber: r.suggested.houseNumber, street: r.suggested.street, ward: r.suggested.ward }])
          )
        );
        setChecked(new Set(data.filter((r) => r.autoSelectable).map((r) => r.parcelId)));
        // Dòng cần xử lý tay được mở sẵn ô chỉnh sửa
        setExpanded(new Set(data.filter((r) => !r.lockedReason && needsManual(r)).map((r) => r.parcelId)));
      })
      .catch((err: unknown) => {
        console.error('[BatchGisOperations:addressPreview] Không thể tải xem trước địa chỉ:', err);
        if (!cancelled) setErrorMessage(getErrorMessage(err, 'Không thể tải xem trước địa chỉ'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [parcelIds]);

  const blockMap = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const r of rows) {
      const edit = edits[r.parcelId];
      map.set(r.parcelId, edit ? blockReason(r, edit, touched) : 'Chưa tải xong');
    }
    return map;
  }, [rows, edits, touched]);

  const selectableIds = rows.filter((r) => !blockMap.get(r.parcelId)).map((r) => r.parcelId);
  const effectiveChecked = rows.filter((r) => checked.has(r.parcelId) && !blockMap.get(r.parcelId));
  const reportWriteCount = effectiveChecked.filter((r) => r.reportId && reportDiffOf(r, edits[r.parcelId]) > 0).length;
  const parcelOnlyCount = effectiveChecked.length - reportWriteCount;
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => checked.has(id));

  const updateField = (row: AddressPreviewRow, field: EditableField, value: string) => {
    setEdits((prev) => ({ ...prev, [row.parcelId]: { ...prev[row.parcelId], [field]: value } }));
    setTouched((prev) => new Set(prev).add(touchKey(row.parcelId, field)));
  };

  const toggleIn = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleNotes = () => {
    setShowNotes((prev) => {
      writeNotesPref(!prev);
      return !prev;
    });
  };

  const openConfirm = () => {
    setConfirmInput('');
    setConfirmCode(randomConfirmCode());
  };

  const handleSubmit = async () => {
    setConfirmCode(null);
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const items = effectiveChecked.map((r) => ({ parcelId: r.parcelId, ...edits[r.parcelId] }));
      onDone(await syncBatchAddress(items));
    } catch (err: unknown) {
      console.error('[BatchGisOperations:addressSync] Không thể cập nhật địa chỉ hàng loạt:', err);
      setErrorMessage(getErrorMessage(err, 'Không thể cập nhật địa chỉ hàng loạt'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-xs font-medium text-slate-500">
        <Loader2 size={16} className="animate-spin" /> Đang phân tích địa chỉ {parcelIds.length} thửa...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="flex-1 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] font-medium text-sky-900">
          Đề xuất ưu tiên địa chỉ KSV đã nhập, phường cũ quy đổi theo NQ 1685 trong đúng quận. Thửa có hồ sơ được ghi
          <strong> như Admin sửa ở màn Thẩm định</strong> (tạo bản gốc v0 nếu chưa có và một phiên bản lịch sử), trạng thái hồ sơ giữ nguyên.
        </p>
        <button
          type="button"
          onClick={toggleNotes}
          className="cursor-pointer flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
        >
          {showNotes ? <EyeOff size={13} /> : <Eye size={13} />}
          {showNotes ? 'Ẩn ghi chú' : 'Hiện ghi chú'}
        </button>
      </div>

      <div className="max-h-[52vh] overflow-auto rounded-xl border border-slate-200">
        <table className="w-full border-collapse text-[11px]">
          <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700">
            <tr>
              <th className="w-8 border-b border-slate-200 p-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => setChecked(allSelected ? new Set() : new Set(selectableIds))}
                  disabled={selectableIds.length === 0}
                  className="cursor-pointer disabled:cursor-not-allowed"
                  title="Chọn / bỏ chọn tất cả dòng hợp lệ"
                />
              </th>
              <th className="border-b border-slate-200 p-2 text-left">Mã thửa</th>
              <th className="border-b border-slate-200 bg-slate-200/60 p-2 text-left">Trước khi điều chỉnh</th>
              <th className="border-b border-slate-200 bg-emerald-50 p-2 text-left">Sau khi AUTO điều chỉnh</th>
              {showNotes && <th className="border-b border-slate-200 p-2 text-left">Ghi chú</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const edit = edits[row.parcelId];
              if (!edit) return null;
              const block = blockMap.get(row.parcelId);
              const isChecked = checked.has(row.parcelId) && !block;
              const isExpanded = expanded.has(row.parcelId);
              const changed = EDITABLE_FIELDS.some((f) => edit[f] !== row.parcelRaw[f]) || reportDiffOf(row, edit) > 0;
              const fromSurveyor = EDITABLE_FIELDS.some((f) => row.sourceByField[f] === 'SURVEYOR');
              const sv = row.surveyorEntered;
              const wardChoices = row.isSplitWard
                ? row.splitWardCandidates
                : row.wardConflict
                  ? [row.wardConflict.cadastralWard, row.wardConflict.surveyorWard]
                  : [];
              return (
                <tr key={row.parcelId} className={`align-top ${row.lockedReason ? 'bg-slate-50 opacity-70' : ''}`}>
                  <td className="border-b border-slate-100 p-2 text-center">
                    {row.lockedReason ? (
                      <Lock size={13} className="mx-auto text-slate-400" />
                    ) : (
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={Boolean(block)}
                        onChange={() => toggleIn(setChecked, row.parcelId)}
                        className="cursor-pointer disabled:cursor-not-allowed"
                        title={block ?? 'Tích để cập nhật dòng này'}
                      />
                    )}
                  </td>
                  <td className="border-b border-slate-100 p-2">
                    <span className="inline-block rounded-md border border-teal-700 bg-teal-950 px-1.5 py-0.5 font-mono font-bold text-teal-300">
                      {row.projectParcelCode}
                    </span>
                    <div className="mt-1">
                      {row.reportId ? (
                        <span className="inline-flex items-center gap-0.5 rounded border border-indigo-200 bg-indigo-50 px-1 text-[9px] font-bold text-indigo-700" title="Ghi vào hồ sơ KSV và tạo phiên bản lịch sử">
                          <FileClock size={10} /> Hồ sơ + phiên bản
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 rounded border border-slate-200 bg-slate-50 px-1 text-[9px] font-bold text-slate-500" title="Chưa có hồ sơ khảo sát: chỉ ghi bảng thửa">
                          <DatabaseIcon size={10} /> Chỉ bảng thửa
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="border-b border-slate-100 bg-slate-50/70 p-2 text-slate-700">
                    <div>{rawOneLine(row.parcelRaw)}</div>
                    {sv && (
                      <div className="mt-1 rounded border border-sky-100 bg-sky-50 px-1.5 py-0.5 text-sky-800">
                        KSV nhập: {[sv.houseNumber, sv.street, sv.ward].filter(Boolean).join(' | ') || '---'}
                      </div>
                    )}
                  </td>
                  <td className="border-b border-slate-100 bg-emerald-50/40 p-2">
                    <div className="flex items-start gap-1.5">
                      <div
                        className={`flex-1 rounded-lg border px-2 py-1.5 font-mono text-[11px] font-bold ${
                          changed ? 'border-emerald-300 bg-emerald-50 text-emerald-950' : 'border-slate-200 bg-white text-slate-800'
                        }`}
                      >
                        {formatAddress(edit)}
                      </div>
                      {fromSurveyor && (
                        <span className="mt-1 shrink-0 rounded border border-sky-700 bg-sky-950 px-1 text-[9px] font-bold text-sky-300">
                          từ KSV
                        </span>
                      )}
                      {!row.lockedReason && (
                        <button
                          type="button"
                          onClick={() => toggleIn(setExpanded, row.parcelId)}
                          className={`cursor-pointer shrink-0 rounded-md border p-1 ${
                            isExpanded ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500 hover:bg-slate-100'
                          }`}
                          title={isExpanded ? 'Đóng ô điều chỉnh' : 'Điều chỉnh Số nhà / Đường / Phường'}
                        >
                          {isExpanded ? <X size={13} /> : <Edit3 size={13} />}
                        </button>
                      )}
                    </div>

                    {isExpanded && !row.lockedReason && (
                      <div className="mt-1.5 grid grid-cols-[90px_1fr_1fr] gap-1">
                        <input
                          value={edit.houseNumber}
                          onChange={(e) => updateField(row, 'houseNumber', e.target.value)}
                          maxLength={64}
                          placeholder="Số nhà"
                          title="Số nhà"
                          className={`rounded-md border px-1.5 py-1 font-medium ${
                            edit.houseNumber !== row.parcelRaw.houseNumber ? 'border-emerald-400 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-800'
                          }`}
                        />
                        <input
                          value={edit.street}
                          onChange={(e) => updateField(row, 'street', e.target.value)}
                          list={`batch-street-options-${row.parcelId}`}
                          maxLength={128}
                          placeholder="Tên đường thật"
                          title="Tuyến đường"
                          className={`rounded-md border px-1.5 py-1 font-medium ${
                            edit.street !== row.parcelRaw.street ? 'border-emerald-400 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-800'
                          }`}
                        />
                        {wardChoices.length > 0 ? (
                          <select
                            value={touched.has(touchKey(row.parcelId, 'ward')) ? edit.ward : ''}
                            onChange={(e) => updateField(row, 'ward', e.target.value)}
                            title="Phường"
                            className="cursor-pointer rounded-md border border-amber-400 bg-white px-1.5 py-1 font-bold text-slate-900"
                          >
                            <option value="">-- Chọn phường --</option>
                            {wardChoices.map((w) => (
                              <option key={w} value={w}>
                                {w}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            value={edit.ward}
                            onChange={(e) => updateField(row, 'ward', e.target.value)}
                            maxLength={64}
                            placeholder="Phường"
                            title="Phường"
                            className={`rounded-md border px-1.5 py-1 font-medium ${
                              edit.ward !== row.parcelRaw.ward ? 'border-emerald-400 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-800'
                            }`}
                          />
                        )}
                        <datalist id={`batch-street-options-${row.parcelId}`}>
                          {row.suggestedStreetOptions.map((s) => (
                            <option key={s} value={s} />
                          ))}
                        </datalist>
                      </div>
                    )}

                    {row.lockedReason ? (
                      <div className="mt-1 font-bold text-slate-500">{row.lockedReason}</div>
                    ) : (
                      block &&
                      block !== 'Không có thay đổi' && (
                        <div className="mt-1 flex items-start gap-1 font-bold text-amber-700">
                          <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {block}
                        </div>
                      )
                    )}
                  </td>
                  {showNotes && (
                    <td className="border-b border-slate-100 p-2 text-slate-600">
                      {row.khuPho && <div className="text-slate-500">Khu phố: {row.khuPho}</div>}
                      {row.anomalyReasons.map((r) => (
                        <div key={r}>• {r}</div>
                      ))}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {errorMessage && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{errorMessage}</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-600">
          Đã chọn cập nhật {effectiveChecked.length} / {rows.length} thửa đất
          {effectiveChecked.length > 0 && (
            <span className="ml-1 font-medium text-slate-500">
              ({reportWriteCount} hồ sơ + phiên bản, {parcelOnlyCount} chỉ bảng thửa)
            </span>
          )}
        </span>
        <button
          type="button"
          disabled={effectiveChecked.length === 0 || isSubmitting}
          onClick={openConfirm}
          className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
          Cập nhật địa chỉ ({effectiveChecked.length} thửa)
        </button>
      </div>

      {/* Xác nhận bằng mã ngẫu nhiên 4 số */}
      {confirmCode && (
        <div className="fixed inset-0 z-[3100] flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-sm space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
            <h4 className="text-sm font-bold text-slate-900">Xác nhận cập nhật địa chỉ</h4>
            <p className="text-xs text-slate-700">
              Sẽ ghi <strong>{reportWriteCount}</strong> hồ sơ khảo sát (mỗi hồ sơ tạo một phiên bản lịch sử) và
              <strong> {parcelOnlyCount}</strong> thửa chưa có hồ sơ (chỉ bảng thửa).
            </p>
            <p className="text-xs text-slate-700">
              Nhập mã <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-sm font-bold tracking-widest text-amber-300">{confirmCode}</span> để xác nhận:
            </p>
            <input
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric"
              autoFocus
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-center font-mono text-lg font-bold tracking-[0.5em] text-slate-900"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmCode(null)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={confirmInput !== confirmCode}
                onClick={handleSubmit}
                className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Xác nhận cập nhật
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
