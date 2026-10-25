import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Check,
  AlertTriangle,
  MapPin,
  ChevronDown,
  Info,
  CheckCheck,
  Edit3,
  Lock,
  Unlock,
} from 'lucide-react';
import type { AddressEvaluationResult } from '../utils/residentialAddressStandards';
import {
  ZONE_SUGGESTED_STREETS,
  formatStandardizedAddress168,
} from '../utils/residentialAddressStandards';

interface Props {
  evaluation: AddressEvaluationResult;
  zoneId?: string;
  isEditMode: boolean;
  standardizedAddressValue: string;
  isAccepted: boolean;
  onAccept: (formattedAddress: string) => void;
  onEdit: () => void;
  onChangeStandardizedAddress: (val: string) => void;
  onApplyField?: (fieldKey: 'houseNumber' | 'street' | 'ward' | 'district', label: string, val: string) => void;
  onDismiss?: () => void;
}

export const SmartAddressSuggestionCard: React.FC<Props> = ({
  evaluation,
  zoneId,
  isEditMode,
  standardizedAddressValue,
  isAccepted,
  onAccept,
  onEdit,
  onChangeStandardizedAddress,
  onApplyField,
  onDismiss,
}) => {
  const { current, suggested, anomalyReasons, isContaminated } = evaluation;
  const [selectedStreet, setSelectedStreet] = useState<string>(suggested.street);
  const [isDismissed, setIsDismissed] = useState(false);

  // Giữ đồng bộ selectedStreet khi suggested.street thay đổi
  useEffect(() => {
    if (suggested.street) {
      setSelectedStreet(suggested.street);
    }
  }, [suggested.street]);

  if (isDismissed) {
    return null;
  }

  const zKey = (zoneId || 'DEFAULT').toUpperCase();
  const zoneStreets = ZONE_SUGGESTED_STREETS[zKey] || ZONE_SUGGESTED_STREETS['DEFAULT'];
  const isResolvedClean = isAccepted && !isContaminated;

  return (
    <div
      className={`my-3 rounded-xl border p-4 shadow-xs transition-all ${
        isResolvedClean
          ? 'border-emerald-300 bg-gradient-to-br from-emerald-50/90 via-teal-50/30 to-white'
          : 'border-amber-300 bg-gradient-to-br from-amber-50/95 via-orange-50/40 to-white'
      }`}
    >
      {/* Header */}
      <div
        className={`flex flex-wrap items-center justify-between gap-2 border-b pb-3 ${
          isResolvedClean ? 'border-emerald-200/80' : 'border-amber-200/80'
        }`}
      >
        <div className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-white shadow-xs ${
              isResolvedClean ? 'bg-emerald-600' : 'bg-amber-500'
            }`}
          >
            {isResolvedClean ? <CheckCheck className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4
                className={`text-xs font-black tracking-wide uppercase sm:text-sm ${
                  isResolvedClean ? 'text-emerald-950' : 'text-amber-950'
                }`}
              >
                {isResolvedClean
                  ? 'Đã Chuẩn Hóa Thông Tin Địa Chỉ Hành Chính'
                  : 'Đề Xuất Chuẩn Hóa Thông Tin Địa Chỉ'}
              </h4>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-black border ${
                  isResolvedClean
                    ? 'bg-emerald-200/70 text-emerald-900 border-emerald-300'
                    : 'bg-amber-200/80 text-amber-900 border-amber-300'
                }`}
              >
                Mô hình 168 ĐVHC cấp xã TP.HCM
              </span>
            </div>
            <p className={`text-[11px] font-medium ${isResolvedClean ? 'text-emerald-800' : 'text-amber-800'}`}>
              {isResolvedClean
                ? 'Đã xác nhận địa chỉ chuẩn A4 • Dữ liệu gốc KSV tại 4 ô con được khóa bảo lưu'
                : anomalyReasons.length > 0
                  ? `Phát hiện ${anomalyReasons.length} điểm cần đồng bộ hành chính & chính tả`
                  : 'Đã chuẩn hóa theo quy chuẩn địa chỉ không còn cấp quận/huyện'}
            </p>
          </div>
        </div>

        {/* Nút Ẩn */}
        {onDismiss && (
          <button
            type="button"
            onClick={() => {
              setIsDismissed(true);
              onDismiss?.();
            }}
            className="cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            Ẩn
          </button>
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
                  onChange={(e) => {
                    const st = e.target.value;
                    setSelectedStreet(st);
                    onApplyField?.('street', 'Tuyến đường', st);
                    // Cập nhật lại chuỗi địa chỉ chuẩn hóa 168
                    const newAddr = formatStandardizedAddress168(
                      suggested.houseNumber || current.houseNumber,
                      st,
                      suggested.ward || current.ward
                    );
                    onChangeStandardizedAddress(newAddr);
                  }}
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
            </div>
          </div>
        </div>
      )}

      {/* Ô KẾT QUẢ ĐỊA CHỈ DUY NHẤT (SINGLE-TRUTH BOX) & 2 NÚT ACCEPT / EDIT */}
      <div
        className={`mt-3 p-3 rounded-xl border bg-white/90 shadow-2xs space-y-2.5 ${
          isResolvedClean ? 'border-emerald-300/80' : 'border-amber-300/80'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-[11px] font-black uppercase text-slate-700 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-emerald-600" />
            <span>Địa chỉ hiển thị trên Báo cáo A4 (Single-Truth Address)</span>
          </label>

          {/* Trạng thái khóa / mở */}
          <div className="flex items-center gap-1.5">
            {isAccepted ? (
              <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-300">
                <Lock className="h-3 w-3 text-emerald-600" />
                <span>Đã chấp nhận (4 ô con được khóa)</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-300">
                <Unlock className="h-3 w-3 text-amber-600" />
                <span>Chế độ điều chỉnh (4 ô con mở khóa)</span>
              </span>
            )}
          </div>
        </div>

        {/* Ô Input/Textarea địa chỉ chuẩn hóa cho phép sửa trực tiếp */}
        <div className="relative">
          <input
            type="text"
            value={standardizedAddressValue}
            disabled={!isEditMode}
            onChange={(e) => onChangeStandardizedAddress(e.target.value)}
            placeholder="Số [Số nhà] [Tên đường], [Phường/Xã mới], TP. Hồ Chí Minh"
            className={`w-full rounded-lg px-3 py-2 text-xs font-bold font-mono transition-all ${
              isAccepted
                ? 'bg-emerald-50/60 border border-emerald-300 text-emerald-950 focus:ring-2 focus:ring-emerald-400'
                : 'bg-white border border-amber-300 text-slate-900 focus:ring-2 focus:ring-amber-400'
            }`}
          />
        </div>

        {/* Thanh công cụ 2 nút: Chấp Nhận & Điều Chỉnh */}
        {(isEditMode || !isAccepted) && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
            <span className="text-[11px] text-slate-500 italic">
              {isAccepted
                ? '✓ Bốn ô chi tiết bên dưới đã mờ đi để bảo lưu dữ liệu KSV. Báo cáo PDF A4 sẽ in địa chỉ trên.'
                : '✎ Bấm "Chấp Nhận" để áp dụng địa chỉ chuẩn hóa A4 và khóa bảo lưu 4 ô dữ liệu gốc KSV bên dưới.'}
            </span>

            <div className="flex items-center gap-2">
              {isAccepted ? (
                <button
                  type="button"
                  onClick={onEdit}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 shadow-2xs transition-all hover:bg-amber-100 active:scale-95"
                >
                  <Edit3 className="h-3.5 w-3.5 text-amber-700" />
                  <span>Điều Chỉnh (Mở khóa 4 ô con)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onAccept(standardizedAddressValue)}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-black text-white shadow-xs transition-all hover:bg-emerald-700 active:scale-95"
                >
                  <CheckCheck className="h-4 w-4" />
                  <span>Chấp Nhận (Accept & Khóa 4 ô con)</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Ghi chú gợi ý sáp nhập theo NQ 1685 nếu có */}
      {suggested.mergerNote && (
        <div
          className={`mt-2.5 flex items-center gap-1.5 text-[11px] ${
            isResolvedClean ? 'text-emerald-800' : 'text-amber-900'
          }`}
        >
          <Info className={`h-3.5 w-3.5 shrink-0 ${isResolvedClean ? 'text-emerald-600' : 'text-amber-700'}`} />
          <span>
            <strong>Ghi chú địa giới:</strong> {suggested.mergerNote}
          </span>
        </div>
      )}
    </div>
  );
};
