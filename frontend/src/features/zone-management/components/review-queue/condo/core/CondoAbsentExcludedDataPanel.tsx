import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ShieldOff } from 'lucide-react';
import type { CondoUnitFormState } from '../types/condo-audit.types';

interface Props {
  formState: CondoUnitFormState;
}

/** Dữ liệu cũ KSV phải điền cho đủ form: không dùng để thẩm định, chỉ giữ để Admin đối chiếu. */
export const CondoAbsentExcludedDataPanel: React.FC<Props> = ({ formState }) => {
  const [isOpen, setIsOpen] = useState(false);
  const zones = formState.damageZones.filter((zone) => !zone.isDeleted);
  const Chevron = isOpen ? ChevronDown : ChevronRight;

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center gap-2 text-left cursor-pointer"
      >
        <ShieldOff className="w-4 h-4 text-slate-500 shrink-0" />
        <span className="flex-1 text-xs font-black uppercase text-slate-700">
          Dữ Liệu Ngoài Phạm Vi Vắng Chủ (Không Có Giá Trị Pháp Lý)
        </span>
        <Chevron className="w-4 h-4 text-slate-500" />
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-2 text-xs text-slate-700">
          <p className="text-[11px] text-slate-500">
            Phần này được giữ nguyên trong CSDL nhưng không hiển thị khi thẩm định và không in ra báo cáo.
          </p>
          <div>Số vùng đã nhập: <strong>{zones.length}</strong></div>
          {zones.length > 0 && (
            <div>
              Khu vực:{' '}
              <strong>{zones.map((zone) => zone.roomName || zone.zoneCode).join(', ')}</strong>
            </div>
          )}
          <div>Burland lớn nhất đã nhập: <strong>{formState.burlandSummary.localMaxGrade ?? '---'}</strong></div>
          <div>Ý kiến chủ hộ đã nhập: <strong>{formState.ownerFeedback || '---'}</strong></div>
        </div>
      )}
    </section>
  );
};
