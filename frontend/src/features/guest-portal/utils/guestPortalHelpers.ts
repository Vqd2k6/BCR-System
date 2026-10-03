import { GisParcel } from '../../../components/gis/shared/types';
import { getEffectiveParcelStatus } from '../../../components/gis/sweep-map/utils/sweepMapHelpers';

export type BraRiskLevel = 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNASSESSED';

export interface GuestKpiStats {
  total: number;
  approved: number;
  submitted: number;
  inProgress: number;
  absentee: number;
  rejected: number;
  underConstruction: number;
  pending: number;
  completionRate: number;
}

export interface GuestBraStats {
  veryHigh: number;
  high: number;
  medium: number;
  low: number;
  unassessed: number;
  totalAssessed: number;
}

/**
 * Suy luận cấp độ rủi ro BRA của thửa đất:
 * Sử dụng trường braRiskLevel nếu có, hoặc ước lượng theo cự ly tim hầm Metro
 * và trạng thái khảo sát hiện trạng.
 */
export function getParcelBraRiskLevel(parcel: GisParcel): BraRiskLevel {
  const explicit = (parcel as any).braRiskLevel || (parcel as any).braStatus;
  if (explicit) {
    const upper = String(explicit).toUpperCase();
    if (upper.includes('VERY_HIGH') || upper.includes('RẤT CAO') || upper === 'IV') return 'VERY_HIGH';
    if (upper.includes('HIGH') || upper.includes('CAO') || upper === 'III') return 'HIGH';
    if (upper.includes('MEDIUM') || upper.includes('TRUNG BÌNH') || upper === 'II') return 'MEDIUM';
    if (upper.includes('LOW') || upper.includes('THẤP') || upper === 'I') return 'LOW';
  }

  // Fallback dựa trên cự ly tim hầm và trạng thái
  const effStatus = getEffectiveParcelStatus(parcel);
  if (effStatus === 'NOT_SURVEYED') return 'UNASSESSED';

  const dist = parcel.distanceMeters ?? 15;
  if (dist <= 4.0) return 'VERY_HIGH';
  if (dist <= 8.0) return 'HIGH';
  if (dist <= 15.0) return 'MEDIUM';
  return 'LOW';
}

/**
 * Bảng màu chuẩn cho cấp độ rủi ro BRA
 */
export function getBraColor(level: BraRiskLevel): string {
  switch (level) {
    case 'VERY_HIGH':
      return '#dc2626'; // Đỏ rực
    case 'HIGH':
      return '#ea580c'; // Cam đậm
    case 'MEDIUM':
      return '#eab308'; // Vàng
    case 'LOW':
      return '#16a34a'; // Xanh lá
    case 'UNASSESSED':
    default:
      return '#cbd5e1'; // Xám nhạt
  }
}

export function getBraBadgeStyle(level: BraRiskLevel): { bg: string; text: string; label: string; border: string } {
  switch (level) {
    case 'VERY_HIGH':
      return { bg: 'bg-red-50', text: 'text-red-700', label: 'Rất cao (Cấp IV)', border: 'border-red-200' };
    case 'HIGH':
      return { bg: 'bg-orange-50', text: 'text-orange-700', label: 'Cao (Cấp III)', border: 'border-orange-200' };
    case 'MEDIUM':
      return { bg: 'bg-amber-50', text: 'text-amber-800', label: 'Trung bình (Cấp II)', border: 'border-amber-200' };
    case 'LOW':
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Thấp (Cấp I)', border: 'border-emerald-200' };
    case 'UNASSESSED':
    default:
      return { bg: 'bg-slate-50', text: 'text-slate-600', label: 'Chưa đánh giá', border: 'border-slate-200' };
  }
}

/**
 * Tính toán KPIs tiến độ tổng hợp
 */
export function computeGuestKpis(parcels: GisParcel[]): GuestKpiStats {
  let approved = 0;
  let submitted = 0;
  let inProgress = 0;
  let absentee = 0;
  let rejected = 0;
  let underConstruction = 0;
  let pending = 0;

  for (const p of parcels) {
    const st = getEffectiveParcelStatus(p);
    switch (st) {
      case 'APPROVED':
      case 'PHASE2_COMPLETED':
      case 'APPROVED_PHASE2':
        approved++;
        break;
      case 'SUBMITTED':
        submitted++;
        break;
      case 'IN_PROGRESS':
        inProgress++;
        break;
      case 'POSTPONED_ABSENT':
        absentee++;
        break;
      case 'REJECTED':
        rejected++;
        break;
      case 'UNDER_CONSTRUCTION':
        underConstruction++;
        break;
      case 'NOT_SURVEYED':
      default:
        pending++;
        break;
    }
  }

  const total = parcels.length;
  const completionRate = total > 0 ? Math.round((approved / total) * 100) : 0;

  return {
    total,
    approved,
    submitted,
    inProgress,
    absentee,
    rejected,
    underConstruction,
    pending,
    completionRate,
  };
}

/**
 * Tính toán phân bổ rủi ro BRA
 */
export function computeGuestBraStats(parcels: GisParcel[]): GuestBraStats {
  let veryHigh = 0;
  let high = 0;
  let medium = 0;
  let low = 0;
  let unassessed = 0;

  for (const p of parcels) {
    const level = getParcelBraRiskLevel(p);
    switch (level) {
      case 'VERY_HIGH':
        veryHigh++;
        break;
      case 'HIGH':
        high++;
        break;
      case 'MEDIUM':
        medium++;
        break;
      case 'LOW':
        low++;
        break;
      case 'UNASSESSED':
        unassessed++;
        break;
    }
  }

  return {
    veryHigh,
    high,
    medium,
    low,
    unassessed,
    totalAssessed: veryHigh + high + medium + low,
  };
}

/**
 * Helper che mờ tên và SĐT phía client
 */
export function maskClientName(name?: string | null): string {
  if (!name) return 'Chưa cập nhật';
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) {
    return name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : '***';
  }
  return parts
    .map((p, i) => (i === 0 || i === parts.length - 1 ? p : `${p[0]}***`))
    .join(' ');
}

export function maskClientPhone(phone?: string | null): string {
  if (!phone) return 'Chưa cập nhật';
  const clean = phone.trim();
  if (clean.length <= 6) return '***';
  return `${clean.substring(0, 3)}****${clean.substring(clean.length - 3)}`;
}

export function maskParcelClientPii(parcel: GisParcel): GisParcel {
  return {
    ...parcel,
    ownerName: maskClientName(parcel.ownerName),
    ownerPhone: maskClientPhone(parcel.ownerPhone),
  };
}

export function filterParcelsForGuest(
  parcels: GisParcel[],
  filters: {
    statusFilter?: string;
    braRiskFilter?: BraRiskLevel | 'ALL';
    searchQuery?: string;
  }
): GisParcel[] {
  return parcels.filter((p) => {
    // 1. Status filter
    if (filters.statusFilter && filters.statusFilter !== 'ALL') {
      const eff = getEffectiveParcelStatus(p);
      if (eff !== filters.statusFilter) return false;
    }
    // 2. BRA Risk filter
    if (filters.braRiskFilter && filters.braRiskFilter !== 'ALL') {
      const bra = getParcelBraRiskLevel(p);
      if (bra !== filters.braRiskFilter) return false;
    }
    // 3. Search query
    if (filters.searchQuery && filters.searchQuery.trim() !== '') {
      const q = filters.searchQuery.toLowerCase().trim();
      const codeMatch = p.projectParcelCode?.toLowerCase().includes(q);
      const cadMatch = p.officialCadastralCode?.toLowerCase().includes(q);
      const addrMatch = `${p.houseNumber || ''} ${p.street || ''}`.toLowerCase().includes(q);
      if (!codeMatch && !cadMatch && !addrMatch) return false;
    }
    return true;
  });
}
