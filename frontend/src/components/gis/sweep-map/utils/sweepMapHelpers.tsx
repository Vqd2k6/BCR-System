import React from 'react';
import L from 'leaflet';
import { CheckCircle2, Clock, AlertCircle, HardHat } from 'lucide-react';
import type { GisParcel } from '../../shared/types';

// Check if a parcel is a road / waterway / canal / empty non-building parcel
export const isNonBuildingParcel = (parcel: GisParcel): boolean => {
  const code = String(parcel.projectParcelCode || parcel.project_parcel_code || '').toUpperCase();
  // Residual plot from cadastral split/merge or explicit residual type
  if (code.endsWith('-DU') || parcel.parcelType === 'RESIDUAL' || parcel.parcel_type === 'RESIDUAL') return true;

  const owner = String(parcel.ownerName || parcel.owner_name || '').toLowerCase();
  const street = String(parcel.street || '').toLowerCase();
  const houseNum = String(parcel.houseNumber || parcel.house_number || '').trim().toLowerCase();
  const adjacent = String(parcel.adjacentType || parcel.adjacent_type || '').toUpperCase();
  const landCategory = String(parcel.landCategory || parcel.land_use_category || '').toUpperCase();
  const landRaw = String(parcel.landUseName || parcel.land_use_name_raw || '').toLowerCase();
  const constructArea = Number(parcel.constructionArea ?? parcel.construction_area_m2 ?? 0);
  const floorCount = Number(parcel.floorCount ?? parcel.floor_count ?? 1);

  // 1. Explicit 0 floor or 0 construction area
  if (floorCount === 0 || constructArea === 0) return true;

  // 2. House number indicators for public/infrastructure assets
  if (houseNum === 'kđ' || houseNum === 'mặt nước' || houseNum === 'đất trống' || houseNum === 'n/a' || houseNum === '-') return true;

  // 3. Keyword detection for roads, waterways, canals, public land
  const keywords = ['giao thông', 'đường đi', 'sông', 'kênh', 'rạch', 'mặt nước', 'công viên', 'cây xanh', 'đất trống', 'hành lang', 'ubnd'];
  if (keywords.some((k) => owner.includes(k) || landRaw.includes(k))) return true;

  // 4. Adjacent type & Category indicators
  if (adjacent === 'EMPTY_LAND' || adjacent === 'OTHER') return true;
  if (landCategory === 'ROAD' || landCategory === 'WATER' || landCategory === 'PARK') return true;

  return false;
};

// Calculate polygon center for smooth map flyTo
export const getParcelCenter = (parcel: GisParcel, fallbackCenter: [number, number]): [number, number] => {
  if (!parcel.coordinates || parcel.coordinates.length === 0) return fallbackCenter;
  const lats = parcel.coordinates.map((c) => c[0]);
  const lngs = parcel.coordinates.map((c) => c[1]);
  const avgLat = lats.reduce((a, b) => a + b, 0) / lats.length;
  const avgLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
  return [avgLat, avgLng];
};

// Helper xác định trạng thái thực tế thời gian thực (hỗ trợ bản nháp dở dang local)
export const getEffectiveParcelStatus = (parcel: GisParcel): GisParcel['surveyStatus'] => {
  if (!parcel) return 'NOT_SURVEYED';
  const baseStatus = parcel.surveyStatus || parcel.survey_status || 'NOT_SURVEYED';
  if (baseStatus === 'APPROVED' || baseStatus === 'PHASE2_COMPLETED' || baseStatus === 'APPROVED_PHASE2' || baseStatus === 'SUBMITTED') {
    return baseStatus;
  }
  const pid = parcel.id;
  if (pid) {
    try {
      const overridesStr = localStorage.getItem('metro2_parcel_status_overrides');
      if (overridesStr) {
        const overrides = JSON.parse(overridesStr);
        if (overrides[pid]?.status) return overrides[pid].status;
      }
    } catch (_e) {}

    try {
      const draft = localStorage.getItem(`metro2_phase1_draft_${pid}`);
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed.isAbsenteeSurvey || parsed.surveyCaseType === 'ABSENTEE') return 'POSTPONED_ABSENT';
        if (parsed.surveyCaseType === 'UNDER_CONSTRUCTION') return 'UNDER_CONSTRUCTION';
        if (parsed.surveyCaseType === 'VACANT_LAND' || parsed.isVacantLand) return 'SUBMITTED';
        return 'IN_PROGRESS';
      }
    } catch (_e) {}
  }
  return baseStatus;
};

// 6-color GIS scheme
export const getStatusColor = (status: GisParcel['surveyStatus']) => {
  switch (status) {
    case 'APPROVED':
      return '#10b981'; // Green: Phase 1 Approved (Ready for Phase 2)
    case 'PHASE2_COMPLETED':
    case 'APPROVED_PHASE2':
      return '#2563eb'; // Royal Blue: Phase 2 Completed (Prior to construction)
    case 'SUBMITTED':
      return '#0284c7'; // Sky Blue: Submitted & Pending Zone Admin approval
    case 'IN_PROGRESS':
      return '#f59e0b'; // Amber: In progress on device (Unsubmitted)
    case 'POSTPONED_ABSENT':
      return '#8b5cf6'; // Purple: Absent (Postponed)
    case 'REJECTED':
      return '#ef4444'; // Red: Rejected (Need remeasurement)
    case 'NOT_SURVEYED':
    default:
      return '#64748b'; // Slate: Phase 1 Not surveyed
  }
};

export const getStatusBadge = (status: GisParcel['surveyStatus'], parcel?: GisParcel) => {
  switch (status) {
    case 'APPROVED':
      return (
        <span
          className="badge"
          style={{ backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #86efac', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
        >
          <CheckCircle2 size={12} color="#15803d" />
          Đã duyệt Phase 1
        </span>
      );
    case 'PHASE2_COMPLETED':
    case 'APPROVED_PHASE2':
      return (
        <span
          className="badge"
          style={{ backgroundColor: '#dbeafe', color: '#1d4ed8', border: '1px solid #93c5fd', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
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
          style={{ backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #7dd3fc', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
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
          style={{ backgroundColor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
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
          style={{ backgroundColor: '#f3e8ff', color: '#7e22ce', border: '1px solid #d8b4fe', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
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
          style={{ backgroundColor: '#fff7ed', color: '#c2410c', border: '1px solid #fdba74', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
        >
          <HardHat size={12} color="#c2410c" />
          Đang xây dựng
        </span>
      );
    case 'REJECTED':
      return (
        <span
          className="badge"
          style={{ backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
        >
          <AlertCircle size={12} color="#b91c1c" />
          Cần bổ sung
        </span>
      );
    case 'NOT_SURVEYED':
    default:
      if (parcel && isNonBuildingParcel(parcel)) {
        return (
          <span
            className="badge"
            style={{ backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #86efac', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            🌿 Đất dôi dư / Sân vườn
          </span>
        );
      }
      return (
        <span
          className="badge"
          style={{ backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
        >
          <Clock size={11} color="#64748b" />
          Chưa làm Phase 1
        </span>
      );
  }
};

export const userGpsIcon = L.divIcon({
  className: 'custom-gps-pin',
  html: `
    <div style="
      position: relative;
      width: 18px;
      height: 18px;
      background: #0284c7;
      border: 3px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 0 10px rgba(2, 132, 199, 0.8);
    ">
      <div style="
        position: absolute;
        width: 32px;
        height: 32px;
        top: -10px;
        left: -10px;
        border-radius: 50%;
        background: rgba(2, 132, 199, 0.25);
        animation: pulse 1.8s infinite ease-out;
      "></div>
    </div>
  `,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});
