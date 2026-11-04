import React from 'react';
import { Users, MapPin, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import type { AttendanceCounters } from '../../types/admin.types';

interface Props {
  counters: AttendanceCounters | null;
  onPick: (filter: 'pending' | 'anomaly' | 'missing' | 'today') => void;
}

interface CardDef {
  key: 'today' | 'field' | 'pending' | 'anomaly' | 'missing';
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  tone: string;
  pick?: 'pending' | 'anomaly' | 'missing' | 'today';
}

/** 5 thẻ KPI quân số hôm nay + hàng đợi hậu kiểm (bấm thẻ để lọc nhanh). */
export const AttendanceDailyKpiCards: React.FC<Props> = ({ counters, onPick }) => {
  const n = (v: number | undefined) => (counters ? String(v ?? 0) : '…');
  const cards: CardDef[] = [
    {
      key: 'today',
      label: 'Điểm danh hôm nay',
      value: n(counters?.mainToday),
      hint: `KSV chính · ${n(counters?.companionToday)} lượt đi kèm`,
      icon: <Users size={18} />,
      tone: 'text-sky-700 bg-sky-50 border-sky-200',
      pick: 'today',
    },
    {
      key: 'field',
      label: 'Đang ngoài hiện trường',
      value: n(counters?.onFieldNow),
      hint: `${n(counters?.completedToday)} ca đã hoàn tất`,
      icon: <MapPin size={18} />,
      tone: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    },
    {
      key: 'pending',
      label: 'Chờ hậu kiểm',
      value: n(counters?.pendingTotal),
      hint: 'Tất cả ca chưa xử lý',
      icon: <Clock size={18} />,
      tone: 'text-slate-700 bg-slate-50 border-slate-200',
      pick: 'pending',
    },
    {
      key: 'anomaly',
      label: 'Chờ duyệt có cảnh báo',
      value: n(counters?.pendingWithAnomaly),
      hint: `${n(counters?.pendingDistance)} ca lệch >500m`,
      icon: <AlertTriangle size={18} />,
      tone: 'text-rose-700 bg-rose-50 border-rose-200',
      pick: 'anomaly',
    },
    {
      key: 'missing',
      label: 'Thiếu Check-out',
      value: n(counters?.pendingMissingCheckout),
      hint: 'Ca ngày trước chưa chốt',
      icon: <CheckCircle2 size={18} />,
      tone: 'text-amber-700 bg-amber-50 border-amber-200',
      pick: 'missing',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {cards.map((c) => {
        const content = (
          <>
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${c.tone}`}>{c.icon}</div>
            <div className="min-w-0 text-left">
              <div className="text-[11px] font-semibold text-slate-500 truncate">{c.label}</div>
              <div className="text-xl font-black text-slate-900 leading-tight">{c.value}</div>
              <div className="text-[10px] text-slate-400 truncate">{c.hint}</div>
            </div>
          </>
        );
        const pick = c.pick;
        return pick ? (
          <button
            key={c.key}
            type="button"
            onClick={() => onPick(pick)}
            className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition cursor-pointer"
          >
            {content}
          </button>
        ) : (
          <div key={c.key} className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-slate-200">
            {content}
          </div>
        );
      })}
    </div>
  );
};
