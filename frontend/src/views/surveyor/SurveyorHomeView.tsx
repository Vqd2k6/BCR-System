import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { GisParcel } from '../../components/gis/LeafletSweepMap';
import { BuildingHubModal, BuildingUnit } from '../../components/survey/BuildingHubModal';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  Search,
  UserX,
  Target,
  Calendar,
  CheckSquare,
  HelpCircle,
  Navigation,
  Check,
  FileText,
  GitCompare,
  Building2,
  ArrowRight,
} from 'lucide-react';

interface Props {
  parcels: GisParcel[];
  isCheckedInToday: boolean;
  checkInDetails?: { time: string; distance: number; status: string } | null;
  userGps?: { lat: number; lng: number; accuracy?: number } | null;
  onNavigateToMap: (parcelToFocus?: GisParcel) => void;
  onNavigateToCheckIn: () => void;
  onStartPhase1: (parcel: GisParcel) => void;
  onStartUnitSurvey?: (parcel: GisParcel, unit: BuildingUnit, phase?: 1 | 2) => void;
  onStartPhase2: (parcel: GisParcel) => void;
  onRecordAbsence: (parcel: GisParcel) => void;
}

export const SurveyorHomeView: React.FC<Props> = ({
  parcels,
  isCheckedInToday,
  checkInDetails,
  userGps,
  onNavigateToMap,
  onNavigateToCheckIn,
  onStartPhase1,
  onStartUnitSurvey,
  onStartPhase2,
  onRecordAbsence,
}) => {
  const { user } = useAuth();
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

  // Daily & Weekly Targets
  const todayTarget = 5;
  const todayCompleted = 2;
  const weekTarget = 20;
  const weekCompleted = 8;

  // Helper resolving real-time draft status & building type
  const getStatus = (p: GisParcel) => {
    const baseStatus = p?.surveyStatus || (p as any)?.survey_status || 'NOT_SURVEYED';
    if (baseStatus !== 'APPROVED' && baseStatus !== 'PHASE2_COMPLETED' && baseStatus !== 'APPROVED_PHASE2' && p?.id) {
      try {
        const draft = localStorage.getItem(`metro2_phase1_draft_${p.id}`);
        if (draft) {
          const parsed = JSON.parse(draft);
          if (parsed.isAbsenteeSurvey || parsed.surveyCaseType === 'ABSENTEE') {
            return 'POSTPONED_ABSENT';
          }
          return 'IN_PROGRESS';
        }
      } catch (_e) {}
    }
    return baseStatus;
  };

  const getBuildingType = (p: GisParcel) => {
    if (p?.id) {
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
    return p?.buildingType || (p as any)?.building_type || 'STANDALONE';
  };

  // Parcel counts
  const total = parcels?.length || 0;
  const approved = (parcels || []).filter((p) => getStatus(p) === 'APPROVED' || getStatus(p) === 'PHASE2_COMPLETED' || getStatus(p) === 'APPROVED_PHASE2').length;
  const inProgressOnly = (parcels || []).filter((p) => getStatus(p) === 'IN_PROGRESS').length;
  const submittedOnly = (parcels || []).filter((p) => getStatus(p) === 'SUBMITTED').length;
  const rejectedOnly = (parcels || []).filter((p) => getStatus(p) === 'REJECTED').length;
  const absent = (parcels || []).filter((p) => getStatus(p) === 'POSTPONED_ABSENT').length;
  const notSurveyed = (parcels || []).filter((p) => getStatus(p) === 'NOT_SURVEYED').length;
  const pendingTotal = notSurveyed + inProgressOnly + rejectedOnly + absent;

  const filteredParcels = (parcels || []).filter((p) => {
    if (!p) return false;
    const sTerm = String(searchTerm || '').toLowerCase().trim();
    const code = String(p.projectParcelCode || (p as any).project_parcel_code || '').toLowerCase();
    const house = String(p.houseNumber || (p as any).house_number || '').toLowerCase();
    const street = String(p.street || '').toLowerCase();
    const owner = String(p.ownerName || (p as any).owner_name || '').toLowerCase();
    const status = getStatus(p);

    const matchesSearch =
      !sTerm ||
      code.includes(sTerm) ||
      house.includes(sTerm) ||
      street.includes(sTerm) ||
      owner.includes(sTerm);

    let matchesStatus = false;
    if (statusFilter === 'PENDING_ONLY') {
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

  const getStatusBadge = (status: GisParcel['surveyStatus']) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span
            className="badge"
            style={{ backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #86efac', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}
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
            style={{ backgroundColor: '#dbeafe', color: '#1d4ed8', border: '1px solid #93c5fd', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <CheckCircle2 size={12} color="#1d4ed8" />
            Hoàn tất Phase 2
          </span>
        );
      case 'SUBMITTED':
        return (
          <span
            className="badge"
            style={{ backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #7dd3fc', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <Clock size={12} color="#0284c7" />
            Đã nộp (Chờ duyệt)
          </span>
        );
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
      case 'POSTPONED_ABSENT':
        return (
          <span
            className="badge"
            style={{ backgroundColor: '#f3e8ff', color: '#7e22ce', border: '1px solid #d8b4fe', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <AlertCircle size={12} color="#7e22ce" />
            Vắng mặt (Hẹn lại)
          </span>
        );
      case 'REJECTED':
        return (
          <span
            className="badge"
            style={{ backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
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
            style={{ backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <Clock size={11} color="#64748b" />
            Chưa làm Phase 1
          </span>
        );
    }
  };

  return (
    <div style={{ padding: '1rem 1rem 6.5rem 1rem', maxWidth: '780px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
      {/* 1. Header Zone Banner (Subtle indicator, check-in moved to Profile) */}
      <div
        className="card"
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          padding: '0.85rem 1.15rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.65rem',
        }}
      >
        <div>
          <div style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 600 }}>Tuyến Metro 2 Bến Thành – Tham Lương</div>
          <h2 style={{ margin: '2px 0 0 0', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
            Khu vực phụ trách: {user?.assignedZoneId || 'Ga S9 – Bà Quẹo'}
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {isCheckedInToday ? (
            <div
              style={{
                fontSize: '0.75rem',
                color: '#166534',
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                padding: '0.3rem 0.65rem',
                borderRadius: '999px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontWeight: 700,
              }}
            >
              <CheckCircle2 size={14} color="#16a34a" />
              <span>Đã chấm công ({checkInDetails?.time || '07:45'})</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={onNavigateToCheckIn}
              style={{
                fontSize: '0.75rem',
                color: '#92400e',
                backgroundColor: '#fef3c7',
                border: '1px solid #fde68a',
                padding: '0.3rem 0.65rem',
                borderRadius: '999px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Clock size={14} color="#d97706" />
              <span>Chưa chấm công GPS</span>
              <ArrowRight size={13} color="#d97706" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Daily & Weekly Targets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
        {/* Today */}
        <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Target size={15} color="#0284c7" />
              Tiến độ hôm nay
            </span>
            <span className="badge badge-primary">
              {todayCompleted}/{todayTarget} căn ({Math.round((todayCompleted / todayTarget) * 100)}%)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>{todayCompleted}</span>
            <span style={{ fontSize: '0.925rem', color: '#64748b' }}>/ {todayTarget} căn cần khảo sát</span>
          </div>

          <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${(todayCompleted / todayTarget) * 100}%`,
                height: '100%',
                backgroundColor: '#0284c7',
                borderRadius: '999px',
              }}
            />
          </div>
          <div style={{ fontSize: '0.725rem', color: '#64748b' }}>
            Còn <strong>{todayTarget - todayCompleted} căn</strong> trong danh sách ca hôm nay
          </div>
        </div>

        {/* Weekly */}
        <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Calendar size={15} color="#10b981" />
              Tiến độ tuần này
            </span>
            <span className="badge badge-success">
              {weekCompleted}/{weekTarget} căn ({Math.round((weekCompleted / weekTarget) * 100)}%)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>{weekCompleted}</span>
            <span style={{ fontSize: '0.925rem', color: '#64748b' }}>/ {weekTarget} căn toàn ga</span>
          </div>

          <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${(weekCompleted / weekTarget) * 100}%`,
                height: '100%',
                backgroundColor: '#10b981',
                borderRadius: '999px',
              }}
            />
          </div>
          <div style={{ fontSize: '0.725rem', color: '#64748b' }}>
            Đã hoàn tất duyệt <strong>{weekCompleted} căn</strong>
          </div>
        </div>
      </div>

      {/* 3. Search & Styled Filter Tabs (Requirement 3: Removed red pin, gradient style) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <div style={{ position: 'relative', width: '100%' }}>
          <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            className="form-control"
            style={{ paddingLeft: '2.4rem' }}
            placeholder="Tìm theo số nhà, tên đường, mã B-xxx, chủ hộ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Styled Filter Tabs */}
        <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
          {[
            { id: 'PENDING_ONLY', label: `Cần làm (${pendingTotal})` },
            { id: 'NOT_SURVEYED', label: `Chưa làm (${notSurveyed})` },
            { id: 'IN_PROGRESS', label: `Đang làm dở (${inProgressOnly})` },
            { id: 'SUBMITTED', label: `Chờ duyệt (${submittedOnly})` },
            ...(rejectedOnly > 0 ? [{ id: 'REJECTED', label: `Cần bổ sung (${rejectedOnly})` }] : []),
            { id: 'ABSENT', label: `Vắng mặt (${absent})` },
            { id: 'APPROVED', label: `Đã duyệt Phase 1 (${approved})` },
            { id: 'ALL', label: `Tất cả (${total})` },
          ].map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                style={{
                  fontSize: '0.775rem',
                  padding: '0.45rem 0.85rem',
                  whiteSpace: 'nowrap',
                  fontWeight: isActive ? 700 : 500,
                  borderRadius: '999px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  border: isActive ? '1px solid #7dd3fc' : '1px solid #e2e8f0',
                  background: isActive
                    ? 'linear-gradient(135deg, #e0f2fe 0%, #f0fdf4 100%)'
                    : '#ffffff',
                  color: isActive ? '#0369a1' : '#475569',
                  boxShadow: isActive ? '0 2px 4px rgba(2, 132, 199, 0.12)' : 'none',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Task List Header with ONLY (?) CIRCLE BUTTON (Requirement 5) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.15rem' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>
          {statusFilter === 'PENDING_ONLY'
            ? `Danh sách ${filteredParcels.length} thửa đất cần khảo sát:`
            : statusFilter === 'APPROVED'
            ? `Danh sách ${filteredParcels.length} thửa đất đã duyệt Phase 1:`
            : statusFilter === 'SUBMITTED'
            ? `Danh sách ${filteredParcels.length} thửa đất đã nộp (Chờ duyệt):`
            : statusFilter === 'IN_PROGRESS'
            ? `Danh sách ${filteredParcels.length} thửa đất đang làm dở (Chưa nộp):`
            : `Danh sách thửa đất (${filteredParcels.length}):`}
        </span>

        {/* ONLY (?) CIRCLE BUTTON */}
        <button
          type="button"
          onClick={() => setShowStatusHelp(!showStatusHelp)}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: showStatusHelp ? '#e0f2fe' : '#f1f5f9',
            border: '1px solid #cbd5e1',
            color: '#0284c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          title="Ý nghĩa các nút và trạng thái"
        >
          <HelpCircle size={16} />
        </button>
      </div>

      {showStatusHelp && (
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '0.65rem',
            padding: '0.75rem 1rem',
            fontSize: '0.775rem',
            color: '#475569',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <FileText size={14} color="#0284c7" />
            <span><strong>Chưa làm / Đang làm dở:</strong> Cần thực hiện hoặc tiếp tục hoàn thiện hồ sơ Phase 1.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Clock size={14} color="#0284c7" />
            <span><strong>Đã nộp (Chờ duyệt):</strong> Đã gửi Zone Admin phê duyệt, có thể xem lại thông tin.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <GitCompare size={14} color="#9333ea" />
            <span><strong>Khảo sát Phase 2:</strong> Kích hoạt sau khi Phase 1 được duyệt để đối soát biến động trước thi công.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Navigation size={14} color="#0369a1" />
            <span><strong>Chỉ đường:</strong> Mở Google Maps dẫn đường trực tiếp tới vị trí thửa đất.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <UserX size={14} color="#dc2626" />
            <span><strong>Báo vắng mặt:</strong> Ghi nhận chủ hộ vắng nhà kèm hình ảnh thực địa và dán giấy hẹn.</span>
          </div>
        </div>
      )}

      {/* 5. Parcel Tasks List (Paginated by 10 items) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingBottom: '4.5rem' }}>
        {filteredParcels.length === 0 ? (
          <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
            Không có thửa đất nào phù hợp với bộ lọc hiện tại.
          </div>
        ) : (
          <>
            {filteredParcels.slice(0, displayLimit).map((p) => {
              const status = getStatus(p);
              const isApproved = status === 'APPROVED';
              const isPhase2Done = status === 'PHASE2_COMPLETED' || status === 'APPROVED_PHASE2';
              const isSubmitted = status === 'SUBMITTED';
              const isInProgress = status === 'IN_PROGRESS';
              const isRejected = status === 'REJECTED';
              const isAbsent = status === 'POSTPONED_ABSENT';

              const borderLeftColor = isApproved
                ? '#10b981'
                : isPhase2Done
                ? '#2563eb'
                : isSubmitted
                ? '#0284c7'
                : isInProgress
                ? '#f59e0b'
                : isRejected
                ? '#ef4444'
                : isAbsent
                ? '#8b5cf6'
                : '#64748b';

              const recordedAbsenceTime = absenceRecordedToday[p.id];

              return (
                <div
                  key={p.id}
                  className="card"
                  style={{
                    padding: '0.95rem 1.15rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem',
                    borderLeft: `4px solid ${borderLeftColor}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0284c7' }}>
                          {p.projectParcelCode || (p as any).project_parcel_code}
                        </span>
                        {getStatusBadge(status)}
                        {getBuildingType(p) === 'CONDOMINIUM' && (
                          <button
                            type="button"
                            onClick={() => setHubParcel(p)}
                            style={{
                              backgroundColor: '#ede9fe',
                              color: '#5b21b6',
                              border: '1px solid #c4b5fd',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '0.725rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Building2 size={12} />
                            Chung cư ({p.completedUnits || 0}/{p.totalUnits || 1} căn)
                          </button>
                        )}
                      </div>

                      <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', marginTop: '0.2rem' }}>
                        Số {p.houseNumber || (p as any).house_number} {p.street}
                      </div>

                      {getBuildingType(p) === 'CONDOMINIUM' && (
                        <div style={{ marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem', maxWidth: '360px' }}>
                          <div style={{ flex: 1, height: '6px', backgroundColor: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                            <div
                              style={{
                                height: '100%',
                                width: `${Math.min(100, Math.round(((p.completedUnits || 0) / Math.max(1, p.totalUnits || 1)) * 100))}%`,
                                backgroundColor: (p.completedUnits || 0) >= (p.totalUnits || 1) ? '#10b981' : '#6366f1',
                                borderRadius: '999px',
                              }}
                            />
                          </div>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#4f46e5' }}>
                            {p.completedUnits || 0}/{p.totalUnits || 1} căn ({Math.min(100, Math.round(((p.completedUnits || 0) / Math.max(1, p.totalUnits || 1)) * 100))}%)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ fontSize: '0.775rem', color: '#64748b', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <span>
                      Chủ sở hữu: <strong>{p.ownerName || (p as any).owner_name || 'Chưa cập nhật'}</strong>
                    </span>
                    <span>
                      Mã địa chính: <strong>{p.officialCadastralCode || (p as any).official_cadastral_code || 'Chưa có'}</strong>
                    </span>
                  </div>

                  {/* Actions Bar */}
                  <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', paddingTop: '0.45rem', borderTop: '1px solid #f1f5f9' }}>
                    {/* Primary Button */}
                    {isApproved ? (
                      <button
                        type="button"
                        onClick={() => onStartPhase2(p)}
                        className="btn btn-primary btn-sm"
                        style={{
                          fontSize: '0.775rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          backgroundColor: '#2563eb',
                          borderColor: '#1d4ed8',
                        }}
                      >
                        <GitCompare size={14} />
                        Khảo sát Phase 2
                      </button>
                    ) : isPhase2Done ? (
                      <button
                        type="button"
                        disabled
                        className="btn btn-sm"
                        style={{
                          fontSize: '0.775rem',
                          backgroundColor: '#dbeafe',
                          color: '#1d4ed8',
                          border: '1px solid #93c5fd',
                          fontWeight: 700,
                          cursor: 'default',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <CheckCircle2 size={13} />
                        <span>Đã hoàn tất Phase 2</span>
                      </button>
                    ) : isSubmitted ? (
                      <button
                        type="button"
                        onClick={() => onStartPhase1(p)}
                        className="btn btn-sm"
                        style={{
                          fontSize: '0.775rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          backgroundColor: '#e0f2fe',
                          color: '#0369a1',
                          border: '1px solid #7dd3fc',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                        title="Hồ sơ đã gửi Zone Admin, nhấp để xem chi tiết"
                      >
                        <Clock size={14} color="#0284c7" />
                        Hồ sơ đã nộp (Chờ duyệt)
                      </button>
                    ) : isRejected ? (
                      <button
                        type="button"
                        onClick={() => onStartPhase1(p)}
                        className="btn btn-sm"
                        style={{
                          fontSize: '0.775rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          backgroundColor: '#fee2e2',
                          color: '#b91c1c',
                          border: '1px solid #fca5a5',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        <AlertCircle size={14} color="#dc2626" />
                        Sửa & đo bổ sung Phase 1
                      </button>
                    ) : getBuildingType(p) === 'CONDOMINIUM' ? (
                      <button
                        type="button"
                        onClick={() => setHubParcel(p)}
                        className="btn btn-sm"
                        style={{
                          fontSize: '0.775rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          backgroundColor: '#4338ca',
                          color: '#ffffff',
                          border: '1px solid #3730a3',
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 2px 4px rgba(67, 56, 202, 0.25)',
                        }}
                      >
                        <Building2 size={14} />
                        Mở Hub Căn Hộ ({p.completedUnits || 0}/{p.totalUnits || 1} căn)
                      </button>
                    ) : isInProgress ? (
                      <button
                        type="button"
                        onClick={() => onStartPhase1(p)}
                        className="btn btn-primary btn-sm"
                        style={{
                          fontSize: '0.775rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          backgroundColor: '#d97706',
                          borderColor: '#b45309',
                        }}
                      >
                        <PlusCircle size={14} />
                        Tiếp tục đo đạc Phase 1
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onStartPhase1(p)}
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: '0.775rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        <PlusCircle size={14} />
                        Khảo sát Phase 1
                      </button>
                    )}

                    {/* Chỉ đường Button (Google Maps) */}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleOpenDirections(p)}
                      style={{
                        fontSize: '0.775rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        color: '#0284c7',
                        borderColor: '#bae6fd',
                        backgroundColor: '#f0f9ff',
                      }}
                      title="Mở chỉ đường Google Maps từ vị trí của bạn tới nhà này"
                    >
                      <Navigation size={13} color="#0284c7" />
                      Chỉ đường
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Pagination Load More Controller */}
            {filteredParcels.length > displayLimit && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', alignItems: 'center', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setDisplayLimit((prev) => prev + 10)}
                  className="btn btn-primary"
                  style={{
                    padding: '0.55rem 1.35rem',
                    fontSize: '0.825rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    borderRadius: '0.5rem',
                    boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)',
                  }}
                >
                  <span>+ Xem thêm 10 thửa đất tiếp theo</span>
                  <span style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                    (Đang hiện {Math.min(displayLimit, filteredParcels.length)}/{filteredParcels.length})
                  </span>
                </button>

                {filteredParcels.length > displayLimit + 10 && (
                  <button
                    type="button"
                    onClick={() => setDisplayLimit(filteredParcels.length)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#0284c7',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Tải toàn bộ {filteredParcels.length} thửa đất của khu vực
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {hubParcel && (
        <BuildingHubModal
          parcel={hubParcel}
          onClose={() => setHubParcel(null)}
          onStartMasterSurvey={(p) => {
            setHubParcel(null);
            onStartPhase1(p);
          }}
          onStartUnitSurvey={(p, unit, phase) => {
            setHubParcel(null);
            if (onStartUnitSurvey) {
              onStartUnitSurvey(p, unit, phase);
            } else {
              onStartPhase1(p);
            }
          }}
        />
      )}
    </div>
  );
};

