import { getErrorMessage, getErrorStatus, isNotFoundError } from '@/utils/errorUtils';
import { useState, useEffect } from 'react';
import api from '../../../../services/api';
import { useAuth } from '../../../../context/AuthContext';
import type { GisParcel } from '../../../../components/gis/LeafletSweepMap';
import { getStatus } from '../utils/surveyorHomeHelpers';

interface UseSurveyorHomeStateProps {
  parcels: GisParcel[];
  userGps?: { lat: number; lng: number; accuracy?: number } | null;
  onRecordAbsence: (parcel: GisParcel) => void;
  onRefresh?: () => void;
}

export const useSurveyorHomeState = ({
  parcels,
  userGps,
  onRecordAbsence,
  onRefresh,
}: UseSurveyorHomeStateProps) => {
  const { user } = useAuth();
  const canApproveOrReject = user?.role === 'ZONE_ADMIN' || user?.role === 'SUPER_ADMIN';
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [hubParcel, setHubParcel] = useState<GisParcel | null>(null);

  // Default filter: PENDING_ONLY (Chỉ hiện các căn cần làm, ẩn các căn đã duyệt)
  const [statusFilter, setStatusFilter] = useState<string>('PENDING_ONLY');
  const [showStatusHelp, setShowStatusHelp] = useState<boolean>(false);

  // Pagination / Load limit (Requirement 1: Load 10 parcels at a time for performance)
  const [displayLimit, setDisplayLimit] = useState<number>(10);

  useEffect(() => {
    setDisplayLimit(10);
  }, [searchTerm, statusFilter]);

  // Persistent absence log loaded from localStorage (Requirement 4)
  const [absenceRecordedToday, setAbsenceRecordedToday] = useState<{ [parcelId: string]: string }>(() => {
    try {
      const saved = localStorage.getItem('metro2_absence_log');
      return saved ? JSON.parse(saved) : { 'c0000000-0000-0000-0000-000000000004': '08:15' };
    } catch (_e) {
      return { 'c0000000-0000-0000-0000-000000000004': '08:15' };
    }
  });

  // Danh sách thửa đất được Zone Admin phân công riêng cho Surveyor này
  const [assignedParcels, setAssignedParcels] = useState<GisParcel[]>([]);

  useEffect(() => {
    if (user?.id) {
      api.get<{ data: GisParcel[] }>('/surveys/my-assigned-parcels', {
        params: userGps ? { lat: userGps.lat, lng: userGps.lng } : undefined,
      })
        .then((res) => {
          const list = res?.data?.data || [];
          setAssignedParcels(list);
        })
        .catch((err) => {
          console.warn('[useSurveyorHomeState] Notice: could not load my-assigned-parcels:', err?.message);
        });
    }
  }, [user?.id, userGps?.lat, userGps?.lng]);

  // Daily & Weekly Targets
  const todayTarget = 5;
  const todayCompleted = 2;
  const weekTarget = 20;
  const weekCompleted = 8;

  // Auto open Condominium Hub if redirected from Apartment confirmation
  useEffect(() => {
    try {
      const targetHubId = localStorage.getItem('metro2_open_hub_parcel_id');
      if (targetHubId && parcels && parcels.length > 0) {
        const target = parcels.find((p) => p.id === targetHubId);
        if (target) {
          localStorage.removeItem('metro2_open_hub_parcel_id');
          setHubParcel(target);
        }
      }
    } catch (_e) {}
  }, [parcels]);

  // Parcel counts
  const total = parcels?.length || 0;
  const approved = (parcels || []).filter(
    (p) => getStatus(p) === 'APPROVED' || getStatus(p) === 'PHASE2_COMPLETED' || getStatus(p) === 'APPROVED_PHASE2'
  ).length;
  const inProgressOnly = (parcels || []).filter((p) => getStatus(p) === 'IN_PROGRESS').length;
  const submittedOnly = (parcels || []).filter((p) => getStatus(p) === 'SUBMITTED').length;
  const rejectedOnly = (parcels || []).filter((p) => getStatus(p) === 'REJECTED').length;
  const absent = (parcels || []).filter((p) => getStatus(p) === 'POSTPONED_ABSENT').length;
  const underConstruction = (parcels || []).filter((p) => getStatus(p) === 'UNDER_CONSTRUCTION').length;
  const notSurveyed = (parcels || []).filter((p) => getStatus(p) === 'NOT_SURVEYED').length;
  const pendingTotal = notSurveyed + inProgressOnly + rejectedOnly + absent + underConstruction;

  const filteredParcels = (parcels || []).filter((p) => {
    if (!p) return false;
    const sTerm = String(searchTerm || '').toLowerCase().trim();
    const code = String(p.projectParcelCode || p.project_parcel_code || '').toLowerCase();
    const house = String(p.houseNumber || p.house_number || '').toLowerCase();
    const street = String(p.street || '').toLowerCase();
    const owner = String(p.ownerName || p.owner_name || '').toLowerCase();
    const status = getStatus(p);

    const matchesSearch =
      !sTerm ||
      code.includes(sTerm) ||
      house.includes(sTerm) ||
      street.includes(sTerm) ||
      owner.includes(sTerm);

    let matchesStatus = false;
    if (statusFilter === 'ASSIGNED_TO_ME') {
      const assignedIds = new Set(assignedParcels.map((ap) => ap.id));
      matchesStatus = assignedIds.has(p.id) || p.assignedSurveyorId === user?.id || p.assigned_surveyor_id === user?.id;
    } else if (statusFilter === 'PENDING_ONLY') {
      matchesStatus = status !== 'APPROVED' && status !== 'SUBMITTED' && status !== 'PHASE2_COMPLETED' && status !== 'APPROVED_PHASE2';
    } else if (statusFilter === 'NOT_SURVEYED') {
      matchesStatus = status === 'NOT_SURVEYED';
    } else if (statusFilter === 'IN_PROGRESS') {
      matchesStatus = status === 'IN_PROGRESS';
    } else if (statusFilter === 'SUBMITTED') {
      matchesStatus = status === 'SUBMITTED';
    } else if (statusFilter === 'REJECTED') {
      matchesStatus = status === 'REJECTED';
    } else if (statusFilter === 'ABSENT') {
      matchesStatus = status === 'POSTPONED_ABSENT';
    } else if (statusFilter === 'UNDER_CONSTRUCTION') {
      matchesStatus = status === 'UNDER_CONSTRUCTION';
    } else if (statusFilter === 'APPROVED') {
      matchesStatus = status === 'APPROVED' || status === 'PHASE2_COMPLETED' || status === 'APPROVED_PHASE2';
    } else {
      matchesStatus = true;
    }

    return matchesSearch && matchesStatus;
  });

  const handleSmartAbsence = (parcel: GisParcel) => {
    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const updated = { ...absenceRecordedToday, [parcel.id]: nowTime };
    setAbsenceRecordedToday(updated);
    try {
      localStorage.setItem('metro2_absence_log', JSON.stringify(updated));
    } catch (_e) {}
    onRecordAbsence(parcel);
  };

  const handleOpenDirections = (parcel: GisParcel) => {
    const destLat = parcel.coordinates[0]?.[0] || 10.8034;
    const destLng = parcel.coordinates[0]?.[1] || 106.6385;
    const userLat = userGps?.lat || 10.8036;
    const userLng = userGps?.lng || 106.6388;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${destLat},${destLng}&travelmode=walking`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleAdminApprove = async (parcel: GisParcel) => {
    if (!canApproveOrReject) {
      alert('Chỉ có Zone Admin hoặc Super Admin mới có quyền phê duyệt hồ sơ.');
      return;
    }

    try {
      let targetStatus: GisParcel['surveyStatus'] = 'APPROVED';
      const overridesStr = localStorage.getItem('metro2_parcel_status_overrides');
      const overrides = overridesStr ? JSON.parse(overridesStr) : {};
      const overrideObj = overrides[parcel.id];

      if (overrideObj?.subType === 'POSTPONED_ABSENT' || overrideObj?.isAbsentee) {
        targetStatus = 'POSTPONED_ABSENT';
      } else if (overrideObj?.subType === 'UNDER_CONSTRUCTION') {
        targetStatus = 'UNDER_CONSTRUCTION';
      } else if (overrideObj?.subType === 'IN_PROGRESS') {
        targetStatus = 'IN_PROGRESS';
      } else {
        const draft = localStorage.getItem(`metro2_phase1_draft_${parcel.id}`);
        if (draft) {
          const parsed = JSON.parse(draft);
          if (parsed.isAbsenteeSurvey || parsed.surveyCaseType === 'ABSENTEE') targetStatus = 'POSTPONED_ABSENT';
          else if (parsed.surveyCaseType === 'UNDER_CONSTRUCTION') targetStatus = 'UNDER_CONSTRUCTION';
          else if (parsed.surveyCaseType === 'IN_PROGRESS') targetStatus = 'IN_PROGRESS';
        }
      }

      // 1. Cập nhật override
      overrides[parcel.id] = {
        ...(overrideObj || {}),
        status: targetStatus,
        updatedAt: new Date().toISOString(),
      };
      delete overrides[parcel.id].subType;
      delete overrides[parcel.id].isAbsentee;
      localStorage.setItem('metro2_parcel_status_overrides', JSON.stringify(overrides));

      // 2. Đồng bộ API nếu có
      try {
        await api.post(`/admin/reports/${parcel.id}/approve`, {});
      } catch (e: unknown) {
        console.warn('Backend approve API notice:', getErrorMessage(e));
      }

      if (onRefresh) {
        onRefresh();
      }
      alert(`Đã duyệt hồ sơ thửa [${parcel.projectParcelCode || parcel.officialCadastralCode || parcel.id}]! Thửa đất đã về đúng ô lọc: ${
        targetStatus === 'POSTPONED_ABSENT' ? 'Vắng mặt' :
        targetStatus === 'UNDER_CONSTRUCTION' ? 'Đang xây dựng' :
        targetStatus === 'IN_PROGRESS' ? 'Đang làm dở' : 'Đã duyệt Phase 1'
      }.`);
    } catch (err) {
      console.error('Admin approve error:', err);
      alert('Có lỗi xảy ra khi duyệt hồ sơ.');
    }
  };

  const handleAdminReject = async (parcel: GisParcel) => {
    if (!canApproveOrReject) {
      alert('Chỉ có Zone Admin hoặc Super Admin mới có quyền từ chối hồ sơ.');
      return;
    }

    const reason = window.prompt(
      `Nhập lý do yêu cầu bổ sung / từ chối hồ sơ thửa [${parcel.projectParcelCode || parcel.officialCadastralCode || parcel.id}]:`,
      'Hồ sơ thiếu ảnh hiện trạng hoặc số liệu cần đo đạc lại'
    );
    if (!reason || !reason.trim()) return;

    try {
      const overridesStr = localStorage.getItem('metro2_parcel_status_overrides');
      const overrides = overridesStr ? JSON.parse(overridesStr) : {};
      overrides[parcel.id] = {
        ...(overrides[parcel.id] || {}),
        status: 'REJECTED',
        rejectionReason: reason.trim(),
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem('metro2_parcel_status_overrides', JSON.stringify(overrides));

      try {
        await api.post(`/admin/reports/${parcel.id}/reject`, {
          rejectionReason: reason.trim(),
        });
      } catch (e: unknown) {
        console.warn('Backend reject API notice:', getErrorMessage(e));
      }

      if (onRefresh) {
        onRefresh();
      }
      alert(`Đã trả về hồ sơ thửa [${parcel.projectParcelCode || parcel.officialCadastralCode || parcel.id}] với yêu cầu bổ sung: "${reason.trim()}". Hồ sơ đã chuyển sang mục Cần bổ sung.`);
    } catch (err) {
      console.error('Admin reject error:', err);
      alert('Có lỗi xảy ra khi từ chối hồ sơ.');
    }
  };

  return {
    user,
    canApproveOrReject,
    searchTerm,
    setSearchTerm,
    hubParcel,
    setHubParcel,
    statusFilter,
    setStatusFilter,
    showStatusHelp,
    setShowStatusHelp,
    displayLimit,
    setDisplayLimit,
    absenceRecordedToday,
    todayTarget,
    todayCompleted,
    weekTarget,
    weekCompleted,
    counts: {
      total,
      approved,
      inProgressOnly,
      submittedOnly,
      rejectedOnly,
      absent,
      underConstruction,
      notSurveyed,
      pendingTotal,
      assignedToMe: assignedParcels.length,
    },
    filteredParcels,
    handleSmartAbsence,
    handleOpenDirections,
    handleAdminApprove,
    handleAdminReject,
  };
};
