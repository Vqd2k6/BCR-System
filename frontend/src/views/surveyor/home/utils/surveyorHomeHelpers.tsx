import React from 'react';
import type { GisParcel } from '../../../../components/gis/LeafletSweepMap';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  HardHat,
} from 'lucide-react';

/**
 * Resolves the real-time draft status for a parcel considering:
 * 1. Server status (SUBMITTED / APPROVED / etc.)
 * 2. Local overrides
 * 3. Local Phase 1 drafts
 */
export const getStatus = (p: GisParcel): string => {
  const baseStatus = p?.surveyStatus || p?.survey_status || 'NOT_SURVEYED';

  // 1. Chân lý từ Server: Nếu backend đã là SUBMITTED hoặc APPROVED -> Server Truth luôn có độ ưu tiên cao nhất
  if (baseStatus === 'SUBMITTED' || baseStatus === 'APPROVED' || baseStatus === 'PHASE2_COMPLETED' || baseStatus === 'APPROVED_PHASE2') {
    if (p?.id) {
      try {
        localStorage.removeItem(`metro2_phase1_draft_${p.id}`);
        const overridesStr = localStorage.getItem('metro2_parcel_status_overrides');
        if (overridesStr) {
          const overrides = JSON.parse(overridesStr);
          if (overrides[p.id] && overrides[p.id].status !== baseStatus) {
            if (baseStatus === 'SUBMITTED') {
              overrides[p.id].status = 'SUBMITTED';
            } else {
              delete overrides[p.id];
            }
            localStorage.setItem('metro2_parcel_status_overrides', JSON.stringify(overrides));
          }
        }
      } catch (_e) {}
    }
    return baseStatus;
  }

  // 2. Kiểm tra trạng thái override cục bộ được lưu gần nhất (khi server chưa cập nhật)
  try {
    const overridesStr = localStorage.getItem('metro2_parcel_status_overrides');
    if (overridesStr && p?.id) {
      const overrides = JSON.parse(overridesStr);
      if (overrides[p.id]?.status) {
        return overrides[p.id].status;
      }
    }
  } catch (_e) {}

  // 3. Kiểm tra nháp local
  try {
    const draft = localStorage.getItem(`metro2_phase1_draft_${p.id}`);
    if (draft) {
      const parsed = JSON.parse(draft);
      if (parsed.isAbsenteeSurvey || parsed.surveyCaseType === 'ABSENTEE') {
        return 'POSTPONED_ABSENT';
      }
      if (parsed.surveyCaseType === 'UNDER_CONSTRUCTION') {
        return 'UNDER_CONSTRUCTION';
      }
      if (parsed.surveyCaseType === 'VACANT_LAND' || parsed.isVacantLand) {
        return 'SUBMITTED';
      }
      return 'IN_PROGRESS';
    }
  } catch (_e) {}

  return baseStatus;
};

/**
 * Resolves the building type (CONDOMINIUM vs STANDALONE) considering local overrides and drafts.
 */
export const getBuildingType = (p: GisParcel): string => {
  if (p?.id) {
    try {
      const overridesStr = localStorage.getItem('metro2_parcel_status_overrides');
      if (overridesStr) {
        const overrides = JSON.parse(overridesStr);
        if (overrides[p.id]?.buildingType === 'CONDOMINIUM') {
          return 'CONDOMINIUM';
        }
      }
    } catch (_e) {}
    try {
      const draft = localStorage.getItem(`metro2_phase1_draft_${p.id}`);
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed.surveyCaseType === 'APARTMENT') {
          return 'CONDOMINIUM';
        }
      }
    } catch (_e) {}
  }
  return p?.buildingType || p?.building_type || 'STANDALONE';
};

/**
 * Renders the status badge chip for a parcel based on its status and metadata.
 */
export const getStatusBadge = (status: GisParcel['surveyStatus'] | string, parcel?: GisParcel): React.ReactNode => {
  switch (status) {
    case 'APPROVED':
      return (
        <span
          className="badge"
          style={{ backgroundColor: 'rgb(var(--bg-green-100))', color: 'rgb(var(--text-green-700))', border: '1px solid rgb(var(--border-green-300))', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}
        >
          <CheckCircle2 size={12} />
          Đã duyệt Phase 1
        </span>
      );
    case 'PHASE2_COMPLETED':
    case 'APPROVED_PHASE2':
      return (
        <span
          className="badge"
          style={{ backgroundColor: 'rgb(var(--bg-blue-100))', color: 'rgb(var(--text-blue-700))', border: '1px solid rgb(var(--border-blue-300))', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
        >
          <CheckCircle2 size={12} color="#1d4ed8" />
          Hoàn tất Phase 2
        </span>
      );
    case 'SUBMITTED': {
      let subTypeText = '';
      if (parcel?.id) {
        try {
          const overrides = JSON.parse(localStorage.getItem('metro2_parcel_status_overrides') || '{}');
          if (overrides[parcel.id]?.subType === 'POSTPONED_ABSENT' || overrides[parcel.id]?.isAbsentee) {
            subTypeText = ' - Vắng mặt';
          } else if (overrides[parcel.id]?.subType === 'UNDER_CONSTRUCTION') {
            subTypeText = ' - Đang xây';
          } else if (overrides[parcel.id]?.subType === 'VACANT_LAND' || overrides[parcel.id]?.isVacantLand) {
            subTypeText = ' - Đất trống';
          } else if (overrides[parcel.id]?.subType === 'IN_PROGRESS') {
            subTypeText = ' - Làm dở';
          }
        } catch (_e) {}
        if (!subTypeText) {
          try {
            const draft = localStorage.getItem(`metro2_phase1_draft_${parcel.id}`);
            if (draft) {
              const parsed = JSON.parse(draft);
              if (parsed.isAbsenteeSurvey || parsed.surveyCaseType === 'ABSENTEE') subTypeText = ' - Vắng mặt';
              else if (parsed.surveyCaseType === 'UNDER_CONSTRUCTION') subTypeText = ' - Đang xây';
              else if (parsed.surveyCaseType === 'VACANT_LAND' || parsed.isVacantLand) subTypeText = ' - Đất trống';
              else if (parsed.surveyCaseType === 'IN_PROGRESS') subTypeText = ' - Làm dở';
            }
          } catch (_e) {}
        }
      }
      return (
        <span
          className="badge"
          style={{ backgroundColor: 'rgb(var(--bg-sky-100))', color: 'rgb(var(--text-sky-700))', border: '1px solid rgb(var(--border-sky-300))', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
        >
          <Clock size={12} color="#0284c7" />
          Đã nộp (Chờ duyệt{subTypeText})
        </span>
      );
    }
    case 'IN_PROGRESS':
      return (
        <span
          className="badge"
          style={{ backgroundColor: 'rgb(var(--bg-amber-50))', color: 'rgb(var(--text-amber-700))', border: '1px solid rgb(var(--border-amber-200))', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
        >
          <Clock size={12} color="#b45309" />
          Đang làm dở
        </span>
      );
    case 'POSTPONED_ABSENT': {
      const dateVal = parcel?.updatedAt || parcel?.updated_at || parcel?.postponed_at;
      let daysText = '0 ngày trước';
      if (dateVal) {
        const d = new Date(dateVal);
        if (!isNaN(d.getTime())) {
          const now = new Date();
          const isToday = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
          if (isToday) {
            daysText = '0 ngày trước';
          } else {
            const diffDays = Math.max(1, Math.floor(Math.abs(Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)));
            daysText = `${diffDays} ngày trước`;
          }
        }
      }
      return (
        <span
          className="badge"
          style={{ backgroundColor: 'rgb(var(--bg-purple-100))', color: 'rgb(var(--text-purple-700))', border: '1px solid rgb(var(--border-purple-300))', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
        >
          <AlertCircle size={12} color="#7e22ce" />
          Vắng mặt ({daysText})
        </span>
      );
    }
    case 'UNDER_CONSTRUCTION':
      return (
        <span
          className="badge"
          style={{ backgroundColor: 'rgb(var(--bg-orange-50))', color: 'rgb(var(--text-orange-700))', border: '1px solid rgb(var(--border-orange-300))', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
        >
          <HardHat size={12} color="#c2410c" />
          Đang xây dựng
        </span>
      );
    case 'REJECTED':
      return (
        <span
          className="badge"
          style={{ backgroundColor: 'rgb(var(--bg-red-100))', color: 'rgb(var(--text-red-700))', border: '1px solid rgb(var(--border-red-300))', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
        >
          <AlertCircle size={12} color="#b91c1c" />
          Cần đo bổ sung
        </span>
      );
    case 'NOT_SURVEYED':
    default:
      return (
        <span
          className="badge"
          style={{ backgroundColor: 'rgb(var(--bg-slate-100))', color: 'rgb(var(--text-slate-600))', border: '1px solid rgb(var(--border-slate-300))', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
        >
          <Clock size={11} color="#64748b" />
          Chưa làm Phase 1
        </span>
      );
  }
};
