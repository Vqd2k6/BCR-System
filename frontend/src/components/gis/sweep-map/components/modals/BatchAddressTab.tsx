import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, MapPin, AlertTriangle, Lock } from 'lucide-react';
import { getErrorMessage } from '@/utils/errorUtils';
import { isStreetContaminatedWithWard } from '../../../../../features/zone-management/components/review-queue/stepwise/utils/residentialAddressStandards';
import { previewBatchAddress, syncBatchAddress } from '../../../shared/parcelBatchApi';
import type { AddressFieldKey, AddressFields, AddressPreviewRow, BatchResult } from '../../../shared/parcelBatchApi';

interface BatchAddressTabProps {
  parcelIds: string[];
  onDone: (result: BatchResult) => void;
}

const FIELD_ORDER: AddressFieldKey[] = ['houseNumber', 'street', 'ward', 'district'];
const FIELD_LABEL: Record<AddressFieldKey, string> = {
  houseNumber: 'Số nhà',
  street: 'Đường',
  ward: 'Phường',
  district: 'Quận',
};

const touchKey = (parcelId: string, field: AddressFieldKey) => `${parcelId}:${field}`;

/** Lý do dòng chưa được phép tích (null = được phép). Khớp các chốt kiểm tra lại ở backend. */
const blockReason = (row: AddressPreviewRow, edit: AddressFields, touched: ReadonlySet<string>): string | null => {
  if (row.lockedReason) return row.lockedReason;
  if (!edit.street.trim()) return 'Cần nhập tên đường';
  if (isStreetContaminatedWithWard(edit.street) && edit.street !== row.parcelRaw.street) return 'Tên đường vẫn là tên phường';
  if (!edit.ward.trim()) return 'Cần nhập phường';
  if (row.isSplitWard && edit.ward === row.parcelRaw.ward) return 'Phường bị chia tách, cần chọn phường mới';
  if (row.wardConflict && !touched.has(touchKey(row.parcelId, 'ward'))) return 'Phường mâu thuẫn, cần chọn';
  if (row.requiresManualHouseNumber && !touched.has(touchKey(row.parcelId, 'houseNumber'))) return 'Cần xác nhận số nhà';
  if (row.requiresManualStreet && !touched.has(touchKey(row.parcelId, 'street'))) return 'Cần nhập tên đường';
  if (FIELD_ORDER.every((f) => edit[f] === row.parcelRaw[f])) return 'Không có thay đổi';
  return null;
};

export const BatchAddressTab: React.FC<BatchAddressTabProps> = ({ parcelIds, onDone }) => {
  const [rows, setRows] = useState<AddressPreviewRow[]>([]);
  const [edits, setEdits] = useState<Record<string, AddressFields>>({});
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [touched, setTouched] = useState<Set<string>>(new Set());
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
        setEdits(Object.fromEntries(data.map((r) => [r.parcelId, { ...r.suggested }])));
        setChecked(new Set(data.filter((r) => r.autoSelectable).map((r) => r.parcelId)));
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
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => checked.has(id));

  const updateField = (row: AddressPreviewRow, field: AddressFieldKey, value: string) => {
    setEdits((prev) => ({ ...prev, [row.parcelId]: { ...prev[row.parcelId], [field]: value } }));
    setTouched((prev) => new Set(prev).add(touchKey(row.parcelId, field)));
  };

  const toggleRow = (parcelId: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(parcelId)) next.delete(parcelId);
      else next.add(parcelId);
      return next;
    });
  };

  const toggleAll = () => {
    setChecked(allSelected ? new Set() : new Set(selectableIds));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const items = effectiveChecked.map((r) => ({ parcelId: r.parcelId, ...edits[r.parcelId] }));
      const result = await syncBatchAddress(items);
      onDone(result);
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
      <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] font-medium text-sky-900">
        Đề xuất ưu tiên địa chỉ KSV đã nhập, phường cũ quy đổi theo NQ 1685 trong đúng quận. Chỉ cập nhật bảng thửa đất,
        <strong> không sửa hồ sơ khảo sát</strong>. Dòng có cảnh báo phải được xử lý tay trước khi tích.
      </p>

      <div className="max-h-[52vh] overflow-auto rounded-xl border border-slate-200">
        <table className="w-full border-collapse text-[11px]">
          <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700">
            <tr>
              <th className="w-8 border-b border-slate-200 p-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={selectableIds.length === 0}
                  className="cursor-pointer disabled:cursor-not-allowed"
                  title="Chọn / bỏ chọn tất cả dòng hợp lệ"
                />
              </th>
              <th className="border-b border-slate-200 p-2 text-left">Mã thửa</th>
              <th className="border-b border-slate-200 bg-slate-200/60 p-2 text-left">Trước khi điều chỉnh</th>
              <th className="border-b border-slate-200 bg-emerald-50 p-2 text-left">Sau khi AUTO điều chỉnh (sửa được)</th>
              <th className="border-b border-slate-200 p-2 text-left">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const edit = edits[row.parcelId];
              const block = blockMap.get(row.parcelId);
              const isChecked = checked.has(row.parcelId) && !block;
              const sv = row.surveyorEntered;
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
                        onChange={() => toggleRow(row.parcelId)}
                        className="cursor-pointer disabled:cursor-not-allowed"
                        title={block ?? 'Tích để cập nhật dòng này'}
                      />
                    )}
                  </td>
                  <td className="border-b border-slate-100 p-2">
                    <span className="inline-block rounded-md border border-teal-700 bg-teal-950 px-1.5 py-0.5 font-mono font-bold text-teal-300">
                      {row.projectParcelCode}
                    </span>
                  </td>
                  <td className="border-b border-slate-100 bg-slate-50/70 p-2 text-slate-700">
                    {FIELD_ORDER.map((f) => (
                      <div key={f}>
                        <span className="text-slate-400">{FIELD_LABEL[f]}:</span> {row.parcelRaw[f] || '---'}
                      </div>
                    ))}
                    {sv && (
                      <div className="mt-1 rounded border border-sky-100 bg-sky-50 px-1.5 py-0.5 text-sky-800">
                        KSV nhập: {[sv.houseNumber, sv.street, sv.ward].filter(Boolean).join(' | ') || '---'}
                      </div>
                    )}
                  </td>
                  <td className="border-b border-slate-100 bg-emerald-50/40 p-2">
                    {edit &&
                      FIELD_ORDER.map((f) => {
                        const changed = edit[f] !== row.parcelRaw[f];
                        const fromSurveyor = row.sourceByField[f] === 'SURVEYOR';
                        const wardChoices =
                          f === 'ward'
                            ? row.isSplitWard
                              ? row.splitWardCandidates
                              : row.wardConflict
                                ? [row.wardConflict.cadastralWard, row.wardConflict.surveyorWard]
                                : []
                            : [];
                        return (
                          <div key={f} className="mb-1 flex items-center gap-1">
                            <span className="w-12 shrink-0 text-slate-400">{FIELD_LABEL[f]}</span>
                            {row.lockedReason ? (
                              <span className="px-2 py-1 text-slate-600">{edit[f] || '---'}</span>
                            ) : wardChoices.length > 0 ? (
                              <select
                                value={touched.has(touchKey(row.parcelId, 'ward')) ? edit.ward : ''}
                                onChange={(e) => updateField(row, 'ward', e.target.value)}
                                className="w-full cursor-pointer rounded-md border border-amber-400 bg-white px-1.5 py-1 font-bold text-slate-900"
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
                                value={edit[f]}
                                onChange={(e) => updateField(row, f, e.target.value)}
                                list={f === 'street' ? `batch-street-options-${row.parcelId}` : undefined}
                                maxLength={f === 'street' ? 128 : 64}
                                className={`w-full rounded-md border px-1.5 py-1 font-medium ${
                                  changed ? 'border-emerald-400 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-800'
                                }`}
                                placeholder={f === 'street' ? 'Nhập tên đường thật' : ''}
                              />
                            )}
                            {fromSurveyor && (
                              <span className="shrink-0 rounded border border-sky-700 bg-sky-950 px-1 text-[9px] font-bold text-sky-300">
                                từ KSV
                              </span>
                            )}
                          </div>
                        );
                      })}
                    <datalist id={`batch-street-options-${row.parcelId}`}>
                      {row.suggestedStreetOptions.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </td>
                  <td className="border-b border-slate-100 p-2 text-slate-600">
                    {block && block !== 'Không có thay đổi' && !row.lockedReason && (
                      <div className="mb-1 flex items-start gap-1 font-bold text-amber-700">
                        <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {block}
                      </div>
                    )}
                    {row.lockedReason && <div className="mb-1 font-bold text-slate-500">{row.lockedReason}</div>}
                    {row.khuPho && <div className="text-slate-500">Khu phố: {row.khuPho}</div>}
                    {row.anomalyReasons.map((r) => (
                      <div key={r}>• {r}</div>
                    ))}
                  </td>
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
        </span>
        <button
          type="button"
          disabled={effectiveChecked.length === 0 || isSubmitting}
          onClick={handleSubmit}
          className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
          Cập nhật địa chỉ ({effectiveChecked.length} thửa)
        </button>
      </div>
    </div>
  );
};
