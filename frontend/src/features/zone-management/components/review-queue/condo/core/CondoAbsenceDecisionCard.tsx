import React, { useState } from 'react';
import { AlertTriangle, CheckCheck, RotateCcw, UserX } from 'lucide-react';
import type { CondoAbsenceDecisionValue, CondoAbsenceState } from '../types/condo-audit.types';

const MIN_REASON_LENGTH = 10;

const STATE_COPY: Record<CondoAbsenceState, { title: string; description: string }> = {
  NORMAL: {
    title: 'Căn Hộ Đã Khảo Sát',
    description: 'Nếu thực tế KSV không tiếp cận được căn hộ, hãy xác nhận vắng chủ. Các bước nội thất sẽ được ẩn, dữ liệu gốc vẫn giữ nguyên.',
  },
  SUSPECTED: {
    title: 'Nghi Vắng Chủ: Cần Xác Định',
    description: 'Hồ sơ không có dấu hiệu vắng rõ ràng nhưng dữ liệu không đáng tin. Hệ thống không tự kết luận, vui lòng đối chiếu ảnh hiện trường.',
  },
  ABSENT: {
    title: 'Hệ Thống Xếp Vào Nhóm Vắng Chủ',
    description: 'Nếu KSV thực tế đã vào được căn hộ, hãy xác nhận đã khảo sát để hiện lại đủ các bước thẩm định.',
  },
  ACCESS_HISTORY: {
    title: 'Từng Không Tiếp Cận Được, Sau Đó Có Ghi Nhận Trong Phòng',
    description: 'Hồ sơ đang được giữ như căn đã khảo sát. Nếu các ghi nhận này không có thật, hãy xác nhận vắng chủ.',
  },
};

const REQUIRED_DECISION_COPY = {
  title: 'Cần Chốt Trước Khi Lưu: Căn Này Có Khuyết Tật Trong Phòng',
  description:
    'Nếu KSV không vào được căn, chọn Vắng Chủ: các bước nội thất sẽ ẩn, dữ liệu gốc giữ nguyên. Nếu từng vắng nhưng đã vào được, chọn Đã Khảo Sát để giữ đủ các bước.',
};

const LEAVING_ABSENCE_COPY = {
  title: 'Cần Chốt Trước Khi Lưu: Căn Này Đang Vắng Chủ',
  description:
    'Đổi tình trạng cư trú sẽ đưa căn ra khỏi nhóm vắng và hiện lại dữ liệu nội thất KSV đã nhập. Chọn Đã Khảo Sát nếu KSV thực tế đã vào được căn, nếu không hãy chọn Vắng Chủ.',
};

interface Props {
  state: CondoAbsenceState;
  signals: string[];
  isEditMode: boolean;
  hasPendingDecision: boolean;
  /** Admin vừa đổi sang vắng ở căn có khuyết tật trong phòng: phải chốt mới lưu được. */
  isDecisionRequired?: boolean;
  /** Bắt buộc chốt vì Admin đang đưa căn ra khỏi nhóm vắng, không phải vì khuyết tật trong phòng. */
  isLeavingAbsence?: boolean;
  onDecide: (decision: CondoAbsenceDecisionValue, reason: string) => void;
  onUndoDecision?: () => void;
}

/** Phân loại tự động dựa trên dữ liệu đã lẫn lộn nên Admin phải luôn chốt lại được, kèm lý do lưu vết. */
export const CondoAbsenceDecisionCard: React.FC<Props> = ({
  state,
  signals,
  isEditMode,
  hasPendingDecision,
  isDecisionRequired = false,
  isLeavingAbsence = false,
  onDecide,
  onUndoDecision,
}) => {
  const [reason, setReason] = useState('');
  const requiredCopy = isLeavingAbsence ? LEAVING_ABSENCE_COPY : REQUIRED_DECISION_COPY;
  const copy = isDecisionRequired ? requiredCopy : STATE_COPY[state];
  // Căn thường không có gì cần Admin chốt khi chỉ đọc
  if (state === 'NORMAL' && !isEditMode) return null;

  const trimmedReason = reason.trim();
  const canDecide = isEditMode && trimmedReason.length >= MIN_REASON_LENGTH;
  const buttonClass = `px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors ${
    canDecide ? 'cursor-pointer' : 'disabled:opacity-50 cursor-not-allowed'
  }`;

  return (
    <section className="mt-6 p-4 rounded-2xl border border-amber-300 bg-amber-50/70 space-y-3">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-xs font-black uppercase text-amber-950">{copy.title}</h4>
          <p className="text-[11px] text-amber-900 mt-0.5">{copy.description}</p>
        </div>
      </div>

      {signals.length > 0 && (
        <ul className="list-disc pl-5 text-[11px] text-amber-900 space-y-0.5">
          {signals.map((signal) => (
            <li key={signal}>{signal}</li>
          ))}
        </ul>
      )}

      {isEditMode && hasPendingDecision ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="flex-1 text-[11px] font-semibold text-amber-800">
            Quyết định chưa lưu: giao diện đang xem trước, hệ thống kết luận lại sau khi lưu.
          </p>
          <button
            type="button"
            onClick={() => {
              setReason('');
              onUndoDecision?.();
            }}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Hoàn Tác</span>
          </button>
        </div>
      ) : isEditMode ? (
        <>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={`Lý do xác định (tối thiểu ${MIN_REASON_LENGTH} ký tự)...`}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-amber-300 text-xs font-semibold text-slate-800"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!canDecide}
              onClick={() => onDecide('ABSENT', trimmedReason)}
              className={`${buttonClass} bg-purple-700 text-white hover:bg-purple-800`}
            >
              <UserX className="w-3.5 h-3.5" />
              <span>Xác Nhận Vắng Chủ</span>
            </button>
            {state !== 'NORMAL' && (
              <button
                type="button"
                disabled={!canDecide}
                onClick={() => onDecide('NOT_ABSENT', trimmedReason)}
                className={`${buttonClass} bg-emerald-600 text-white hover:bg-emerald-700`}
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Xác Nhận Đã Khảo Sát</span>
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="text-[11px] font-semibold text-amber-800">Bật Chế độ sửa để ghi nhận quyết định.</p>
      )}
    </section>
  );
};
