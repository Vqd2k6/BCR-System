import React, { useState } from 'react';
import {
  Sparkles,
  Check,
  AlertTriangle,
  ArrowRight,
  MapPin,
  ChevronDown,
  Info,
  CheckCheck,
} from 'lucide-react';
import type { AddressEvaluationResult } from '../utils/residentialAddressStandards';
import { ZONE_SUGGESTED_STREETS } from '../utils/residentialAddressStandards';

interface Props {
  evaluation: AddressEvaluationResult;
  zoneId?: string;
  isEditMode: boolean;
  onApplyField: (fieldKey: 'houseNumber' | 'street' | 'ward' | 'district', label: string, val: string) => void;
  onApplyAll: (updates: { houseNumber: string; street: string; ward: string; district: string }) => void;
  onDismiss?: () => void;
}

export const SmartAddressSuggestionCard: React.FC<Props> = ({
  evaluation,
  zoneId,
  isEditMode,
  onApplyField,
  onApplyAll,
  onDismiss,
}) => {
  const { current, suggested, anomalyReasons, isContaminated } = evaluation;
  const [selectedStreet, setSelectedStreet] = useState<string>(suggested.street);
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed || (evaluation.isCompliant && !isContaminated)) {
    return null;
  }

  const zKey = (zoneId || 'DEFAULT').toUpperCase();
  const zoneStreets = ZONE_SUGGESTED_STREETS[zKey] || ZONE_SUGGESTED_STREETS['DEFAULT'];

  const handleApplyAllClick = () => {
    onApplyAll({
      houseNumber: suggested.houseNumber,
      street: selectedStreet || suggested.street,
      ward: suggested.ward,
      district: suggested.district,
    });
  };

  return (
    <div className="my-4 rounded-xl border border-amber-300 bg-linear-to-br from-amber-50/90 via-orange-50/50 to-white p-4 shadow-xs transition-all">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-white shadow-xs">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-black tracking-wide text-amber-950 uppercase sm:text-sm">
              Đề Xuất Chuẩn Hóa Thông Tin Địa Chỉ (NQ 1685/NQ-UBTVQH15)
            </h4>
            <p className="text-[11px] font-medium text-amber-800">
              Phát hiện {anomalyReasons.length} điểm cần đồng bộ hành chính & chính tả
            </p>
          </div>
        </div>

        {isEditMode && (
          <div className="flex items-center gap-2">
            {onDismiss && (
              <button
                type="button"
                onClick={() => {
                  setIsDismissed(true);
                  onDismiss?.();
                }}
                className="cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                Ẩn gợi ý
              </button>
            )}
            <button
              type="button"
              onClick={handleApplyAllClick}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-emerald-700 active:scale-95"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span>Chấp Nhận Chuẩn Hóa Tất Cả</span>
            </button>
          </div>
        )}
      </div>

      {/* Cảnh báo nhiễm bẩn tên phường vào tên đường */}
      {isContaminated && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 p-2.5 text-xs text-rose-900">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
          <div>
            <span className="font-bold">Cảnh báo nhiễm bẩn dữ liệu:</span> Ô Tuyến đường hiện tại (
            <code className="rounded bg-rose-100 px-1 py-0.5 font-bold text-rose-700">
              {current.street}
            </code>
            ) bị điền nhầm tên Phường. Vui lòng chọn tuyến đường đúng của phân khu:
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div className="relative">
                <select
                  value={selectedStreet}
                  onChange={(e) => setSelectedStreet(e.target.value)}
                  className="cursor-pointer appearance-none rounded-md border border-rose-300 bg-white py-1 pr-7 pl-2 text-xs font-bold text-slate-900 shadow-2xs focus:border-rose-500 focus:outline-hidden"
                >
                  {zoneStreets.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute top-1.5 right-1.5 h-3.5 w-3.5 text-slate-500" />
              </div>
              <button
                type="button"
                onClick={() => onApplyField('street', 'Tuyến đường', selectedStreet)}
                className="cursor-pointer rounded-md bg-rose-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-rose-700"
              >
                Gán đường này
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bảng so sánh 4 trường địa chỉ */}
      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Số nhà */}
        <div
          className={`flex flex-col justify-between rounded-lg border p-2.5 ${
            current.houseNumber !== suggested.houseNumber
              ? 'border-amber-300 bg-amber-100/60'
              : 'border-slate-200 bg-white'
          }`}
        >
          <div>
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
              <span>Số nhà / Hẻm</span>
              {current.houseNumber !== suggested.houseNumber && (
                <span className="rounded bg-amber-200 px-1 text-[10px] text-amber-800">Cần sửa</span>
              )}
            </div>
            <div className="mt-1 text-xs text-slate-500 line-through">
              {current.houseNumber || '(Trống)'}
            </div>
            <div className="flex items-center gap-1 text-xs font-black text-slate-900">
              <ArrowRight className="h-3 w-3 text-emerald-600" />
              <span className="text-emerald-700">{suggested.houseNumber || '(Trống)'}</span>
            </div>
          </div>
          {isEditMode && current.houseNumber !== suggested.houseNumber && (
            <button
              type="button"
              onClick={() => onApplyField('houseNumber', 'Số nhà', suggested.houseNumber)}
              className="mt-2 flex cursor-pointer items-center justify-center gap-1 rounded bg-white py-1 text-[11px] font-bold text-emerald-700 shadow-2xs border border-emerald-200 hover:bg-emerald-50"
            >
              <Check className="h-3 w-3" /> Áp dụng
            </button>
          )}
        </div>

        {/* 2. Tuyến đường */}
        <div
          className={`flex flex-col justify-between rounded-lg border p-2.5 ${
            current.street !== (selectedStreet || suggested.street)
              ? 'border-amber-300 bg-amber-100/60'
              : 'border-slate-200 bg-white'
          }`}
        >
          <div>
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
              <span>Tuyến đường</span>
              {current.street !== (selectedStreet || suggested.street) && (
                <span className="rounded bg-amber-200 px-1 text-[10px] text-amber-800">Cần sửa</span>
              )}
            </div>
            <div className="mt-1 text-xs text-slate-500 line-through">
              {current.street || '(Trống)'}
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-slate-900">
              <ArrowRight className="h-3 w-3 text-emerald-600" />
              <span className="text-emerald-700">{selectedStreet || suggested.street}</span>
            </div>
          </div>
          {isEditMode && current.street !== (selectedStreet || suggested.street) && (
            <button
              type="button"
              onClick={() =>
                onApplyField('street', 'Tuyến đường', selectedStreet || suggested.street)
              }
              className="mt-2 flex cursor-pointer items-center justify-center gap-1 rounded bg-white py-1 text-[11px] font-bold text-emerald-700 shadow-2xs border border-emerald-200 hover:bg-emerald-50"
            >
              <Check className="h-3 w-3" /> Áp dụng
            </button>
          )}
        </div>

        {/* 3. Phường / Xã */}
        <div
          className={`flex flex-col justify-between rounded-lg border p-2.5 ${
            current.ward !== suggested.ward
              ? 'border-amber-300 bg-amber-100/60'
              : 'border-slate-200 bg-white'
          }`}
        >
          <div>
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
              <span>Phường / Xã (NQ 1685)</span>
              {current.ward !== suggested.ward && (
                <span className="rounded bg-amber-200 px-1 text-[10px] text-amber-800">Sáp nhập</span>
              )}
            </div>
            <div className="mt-1 text-xs text-slate-500 line-through">
              {current.ward || '(Trống)'}
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-slate-900">
              <ArrowRight className="h-3 w-3 text-emerald-600" />
              <span className="text-emerald-700">{suggested.ward}</span>
            </div>
            {suggested.mergerNote && (
              <div className="mt-1 text-[10px] text-slate-600 italic">
                {suggested.mergerNote}
              </div>
            )}
          </div>
          {isEditMode && current.ward !== suggested.ward && (
            <button
              type="button"
              onClick={() => onApplyField('ward', 'Phường/Xã', suggested.ward)}
              className="mt-2 flex cursor-pointer items-center justify-center gap-1 rounded bg-white py-1 text-[11px] font-bold text-emerald-700 shadow-2xs border border-emerald-200 hover:bg-emerald-50"
            >
              <Check className="h-3 w-3" /> Áp dụng
            </button>
          )}
        </div>

        {/* 4. Quận / Huyện */}
        <div
          className={`flex flex-col justify-between rounded-lg border p-2.5 ${
            current.district !== suggested.district
              ? 'border-amber-300 bg-amber-100/60'
              : 'border-slate-200 bg-white'
          }`}
        >
          <div>
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
              <span>Quận / Huyện</span>
              {current.district !== suggested.district && (
                <span className="rounded bg-amber-200 px-1 text-[10px] text-amber-800">Cập nhật</span>
              )}
            </div>
            <div className="mt-1 text-xs text-slate-500 line-through">
              {current.district || '(Trống)'}
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-slate-900">
              <ArrowRight className="h-3 w-3 text-emerald-600" />
              <span className="text-emerald-700">{suggested.district}</span>
            </div>
          </div>
          {isEditMode && current.district !== suggested.district && (
            <button
              type="button"
              onClick={() => onApplyField('district', 'Quận/Huyện', suggested.district)}
              className="mt-2 flex cursor-pointer items-center justify-center gap-1 rounded bg-white py-1 text-[11px] font-bold text-emerald-700 shadow-2xs border border-emerald-200 hover:bg-emerald-50"
            >
              <Check className="h-3 w-3" /> Áp dụng
            </button>
          )}
        </div>
      </div>

      {/* Footer ghi chú tổng quan */}
      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-900">
        <Info className="h-3.5 w-3.5 shrink-0 text-amber-700" />
        <span>
          Địa chỉ sau khi chuẩn hóa sẽ hiển thị trong báo cáo in ấn A4 là:{' '}
          <strong className="text-slate-900">
            Số {suggested.houseNumber} {selectedStreet || suggested.street}, {suggested.ward},{' '}
            {suggested.district}
          </strong>
        </span>
      </div>
    </div>
  );
};
