/**
 * Quy chuẩn bảng màu ngữ nghĩa Metro 2 Semantic Theme cho Căn hộ & Vị trí Master
 * Đảm bảo độ tương phản cao ngoài nắng, trực quan và đồng bộ giữa CAD view, Chip view & Fullscreen Modal.
 */

export function getUnitCadBoxClass(
  status?: string,
  isMaster?: boolean,
  isSelected?: boolean
): string {
  if (isSelected) {
    return 'ring-4 ring-amber-400 border-amber-500 bg-amber-400/40 z-30 shadow-xl scale-[1.02]';
  }
  if (isMaster) {
    return 'border-indigo-600 bg-indigo-500/25 hover:bg-indigo-500/40 text-indigo-950 z-10';
  }
  switch (status) {
    case 'APPROVED':
      return 'border-emerald-600 bg-emerald-500/25 hover:bg-emerald-500/40 text-emerald-950 z-10';
    case 'SUBMITTED':
      return 'border-sky-600 bg-sky-500/25 hover:bg-sky-500/40 text-sky-950 z-10';
    case 'IN_PROGRESS':
      return 'border-amber-500 bg-amber-500/30 hover:bg-amber-500/45 text-amber-950 ring-2 ring-amber-400/60 z-20 animate-pulse-subtle';
    case 'POSTPONED_ABSENT':
      return 'border-purple-600 bg-purple-500/25 hover:bg-purple-500/40 text-purple-950 z-10';
    default:
      // Chưa khảo sát
      return 'border-slate-400 bg-slate-300/20 hover:bg-slate-300/35 text-slate-800 z-10';
  }
}

export function getUnitChipClass(
  status?: string,
  isMaster?: boolean,
  isSelected?: boolean
): string {
  if (isSelected) {
    return 'bg-amber-500 text-white border-amber-600 shadow-sm font-black ring-2 ring-amber-300';
  }
  if (isMaster) {
    return 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-200';
  }
  switch (status) {
    case 'APPROVED':
      return 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300';
    case 'SUBMITTED':
      return 'bg-sky-50 hover:bg-sky-100 text-sky-800 border-sky-300';
    case 'IN_PROGRESS':
      return 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300 font-bold ring-1 ring-amber-300';
    case 'POSTPONED_ABSENT':
      return 'bg-purple-50 hover:bg-purple-100 text-purple-800 border-purple-300';
    default:
      return 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200';
  }
}

export function getUnitShortCodeBadgeClass(
  status?: string,
  isMaster?: boolean,
  isSelected?: boolean
): string {
  if (isSelected) {
    return 'bg-amber-500 text-white';
  }
  if (isMaster) {
    return 'bg-indigo-900 text-white';
  }
  switch (status) {
    case 'APPROVED':
      return 'bg-emerald-700 text-white border border-emerald-800';
    case 'SUBMITTED':
      return 'bg-sky-700 text-white border border-sky-800';
    case 'IN_PROGRESS':
      return 'bg-amber-600 text-white border border-amber-700 font-black';
    case 'POSTPONED_ABSENT':
      return 'bg-purple-700 text-white border border-purple-800';
    default:
      return 'bg-white/95 text-slate-900 border border-slate-300';
  }
}
