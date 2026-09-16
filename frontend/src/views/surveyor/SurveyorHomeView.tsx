import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { GisParcel } from '../../components/gis/LeafletSweepMap';
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
} from 'lucide-react';

interface Props {
  parcels: GisParcel[];
  isCheckedInToday: boolean;
  checkInDetails?: { time: string; distance: number; status: string } | null;
  onNavigateToMap: (parcelToFocus?: GisParcel) => void;
  onNavigateToCheckIn: () => void;
  onStartPhase1: (parcel: GisParcel) => void;
  onStartPhase2: (parcel: GisParcel) => void;
  onRecordAbsence: (parcel: GisParcel) => void;
}

export const SurveyorHomeView: React.FC<Props> = ({
  parcels,
  isCheckedInToday,
  checkInDetails,
  onNavigateToMap,
  onNavigateToCheckIn,
  onStartPhase1,
  onStartPhase2,
  onRecordAbsence,
}) => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Default filter: PENDING_ONLY (Chỉ hiện các căn cần làm, ẩn các căn đã duyệt)
  const [statusFilter, setStatusFilter] = useState<string>('PENDING_ONLY');
  const [showStatusHelp, setShowStatusHelp] = useState<boolean>(false);

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

  // Parcel counts
  const total = parcels.length;
  const approved = parcels.filter((p) => p.surveyStatus === 'APPROVED').length;
  const inProgress = parcels.filter((p) => p.surveyStatus === 'IN_PROGRESS' || p.surveyStatus === 'SUBMITTED').length;
  const absent = parcels.filter((p) => p.surveyStatus === 'POSTPONED_ABSENT').length;
  const notSurveyed = parcels.filter((p) => p.surveyStatus === 'NOT_SURVEYED').length;
  const pendingTotal = notSurveyed + inProgress + absent;

  const filteredParcels = parcels.filter((p) => {
    const matchesSearch =
      p.projectParcelCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.houseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.street.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.ownerName && p.ownerName.toLowerCase().includes(searchTerm.toLowerCase()));

    let matchesStatus = false;
    if (statusFilter === 'PENDING_ONLY') {
      matchesStatus = p.surveyStatus !== 'APPROVED';
    } else if (statusFilter === 'NOT_SURVEYED') {
      matchesStatus = p.surveyStatus === 'NOT_SURVEYED';
    } else if (statusFilter === 'IN_PROGRESS') {
      matchesStatus = p.surveyStatus === 'IN_PROGRESS' || p.surveyStatus === 'SUBMITTED' || p.surveyStatus === 'REJECTED';
    } else if (statusFilter === 'ABSENT') {
      matchesStatus = p.surveyStatus === 'POSTPONED_ABSENT';
    } else if (statusFilter === 'APPROVED') {
      matchesStatus = p.surveyStatus === 'APPROVED';
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

  const getStatusBadge = (status: GisParcel['surveyStatus']) => {
    switch (status) {
      case 'APPROVED':
        return <span className="badge badge-success">✓ Đã duyệt Phase 1</span>;
      case 'SUBMITTED':
        return <span className="badge badge-warning">⏳ Chờ duyệt Phase 1</span>;
      case 'IN_PROGRESS':
        return <span className="badge badge-warning">🔄 Đang khảo sát dở</span>;
      case 'POSTPONED_ABSENT':
        return <span className="badge" style={{ backgroundColor: '#f3e8ff', color: '#7e22ce', border: '1px solid #d8b4fe' }}>🏠 Vắng mặt (Hẹn lại)</span>;
      case 'REJECTED':
        return <span className="badge badge-danger">✕ Cần đo bổ sung</span>;
      case 'NOT_SURVEYED':
      default:
        return <span className="badge badge-info">Chưa bắt đầu</span>;
    }
  };

  return (
    <div style={{ padding: '1rem 1rem 6.5rem 1rem', maxWidth: '780px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
      {/* 1. Refined Attendance Widget (Requirement 2) */}
      <div
        className="card"
        style={{
          background: isCheckedInToday
            ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
            : 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
          border: isCheckedInToday ? '1px solid #bbf7d0' : '1px solid #fde68a',
          padding: '1.15rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
            Ga Phụ Trách: {user?.assignedZoneId || 'Ga S9 – Bà Quẹo'}
          </h2>

          {isCheckedInToday ? (
            <div style={{ fontSize: '0.85rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.35rem', fontWeight: 600 }}>
              <CheckCircle2 size={16} color="#16a34a" />
              <span>Đã điểm danh lúc {checkInDetails?.time || '07:45'}</span>
            </div>
          ) : (
            <div style={{ fontSize: '0.825rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.35rem' }}>
              <AlertCircle size={16} color="#d97706" />
              <span>Bạn chưa điểm danh GPS hôm nay.</span>
            </div>
          )}
        </div>

        {!isCheckedInToday && (
          <button
            type="button"
            onClick={onNavigateToCheckIn}
            className="btn btn-warning"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.6rem 1.15rem',
              fontWeight: 700,
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
            }}
          >
            <Clock size={16} />
            Điểm Danh GPS Ngay
          </button>
        )}
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
            { id: 'IN_PROGRESS', label: `Đang làm dở (${inProgress})` },
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
          <div>
            🔵 <strong>Khảo sát Phase 1</strong>: Dành cho thửa đất chưa làm hoặc đang làm dở.
          </div>
          <div>
            🟣 <strong>Khảo sát Phase 2</strong>: Tự động xuất hiện khi thửa đất đã duyệt xong Phase 1 để đối soát biến động trước khi thi công.
          </div>
          <div>
            📍 <strong>Chỉ đường</strong>: Mở bản đồ định vị trực tiếp vị trí căn nhà để điều tra viên dễ di chuyển tới.
          </div>
          <div>
            🏠 <strong>Báo vắng mặt</strong>: Ghi nhận chủ nhà đi vắng, chống bấm trùng lặp trong ngày.
          </div>
        </div>
      )}

      {/* 5. Parcel Tasks List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingBottom: '4.5rem' }}>
        {filteredParcels.length === 0 ? (
          <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
            Không có thửa đất nào phù hợp với bộ lọc hiện tại.
          </div>
        ) : (
          filteredParcels.map((p) => {
            const isApproved = p.surveyStatus === 'APPROVED';
            const isSubmitted = p.surveyStatus === 'SUBMITTED';
            const isInProgress = p.surveyStatus === 'IN_PROGRESS' || p.surveyStatus === 'REJECTED';
            const recordedAbsenceTime = absenceRecordedToday[p.id];

            return (
              <div
                key={p.id}
                className="card"
                style={{
                  padding: '1rem',
                  backgroundColor: '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  border: isApproved ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                }}
              >
                {/* Parcel Details */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0284c7' }}>
                        {p.projectParcelCode}
                      </span>
                      {getStatusBadge(p.surveyStatus)}
                      {p.absenceAttemptCount ? (
                        <span className="badge badge-danger">Vắng {p.absenceAttemptCount} lần</span>
                      ) : null}
                    </div>

                    <div style={{ fontSize: '0.925rem', color: '#0f172a', fontWeight: 700, marginTop: '2px' }}>
                      Số {p.houseNumber} {p.street}
                    </div>

                    <div style={{ fontSize: '0.775rem', color: '#64748b' }}>
                      Mã ĐC: <strong style={{ color: '#334155' }}>{p.officialCadastralCode}</strong> • Chủ hộ: {p.ownerName || 'Chưa cập nhật'}
                    </div>

                    {/* Absence notice line */}
                    {recordedAbsenceTime && (
                      <div
                        style={{
                          marginTop: '0.35rem',
                          fontSize: '0.725rem',
                          color: '#7e22ce',
                          backgroundColor: '#faf5ff',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '0.35rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          border: '1px solid #e9d5ff',
                          fontWeight: 600,
                        }}
                      >
                        <Clock size={12} />
                        Đã khai báo vắng mặt hôm nay lúc {recordedAbsenceTime} (Đã dán giấy hẹn)
                      </div>
                    )}
                  </div>
                </div>

                {/* Context-Aware Action Buttons */}
                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', borderTop: '1px solid #f1f5f9', paddingTop: '0.65rem' }}>
                  {isApproved ? (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => onStartPhase2(p)}
                      style={{
                        flex: 1.5,
                        minWidth: '150px',
                        backgroundColor: '#7c3aed',
                        color: '#ffffff',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        boxShadow: '0 2px 6px rgba(124, 58, 237, 0.25)',
                      }}
                    >
                      <CheckSquare size={14} />
                      Khảo Sát Phase 2 (Trước thi công)
                    </button>
                  ) : isSubmitted ? (
                    <div
                      style={{
                        flex: 1.5,
                        backgroundColor: '#fef3c7',
                        color: '#b45309',
                        padding: '0.35rem 0.65rem',
                        borderRadius: '0.5rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        border: '1px solid #fde68a',
                      }}
                    >
                      <Clock size={13} />
                      Đang Chờ Zone Admin Duyệt Phase 1
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => onStartPhase1(p)}
                      style={{
                        flex: 1.5,
                        minWidth: '150px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <PlusCircle size={14} />
                      {isInProgress ? 'Tiếp tục đo đạc Phase 1' : 'Khảo sát Phase 1'}
                    </button>
                  )}

                  {/* 📍 Chỉ đường Button */}
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => onNavigateToMap(p)}
                    style={{
                      fontSize: '0.775rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      color: '#0284c7',
                      borderColor: '#bae6fd',
                      backgroundColor: '#f0f9ff',
                    }}
                    title="Định vị và chỉ đường tới nhà này trên bản đồ GIS"
                  >
                    <Navigation size={13} color="#0284c7" />
                    Chỉ đường
                  </button>

                  {/* Smart Absence Button */}
                  {!isApproved && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={!!recordedAbsenceTime}
                      onClick={() => handleSmartAbsence(p)}
                      style={{
                        fontSize: '0.775rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        backgroundColor: recordedAbsenceTime ? '#f1f5f9' : '#fffbeb',
                        color: recordedAbsenceTime ? '#94a3b8' : '#b45309',
                        borderColor: recordedAbsenceTime ? '#e2e8f0' : '#fde68a',
                        cursor: recordedAbsenceTime ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {recordedAbsenceTime ? (
                        <>
                          <Check size={13} color="#10b981" />
                          Đã báo vắng
                        </>
                      ) : (
                        <>
                          <UserX size={13} />
                          Báo vắng mặt
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
