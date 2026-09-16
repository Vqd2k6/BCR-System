import React, { useState } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { GisParcel } from '../../components/gis/LeafletSweepMap';
import { ParcelMutationModal } from './ParcelMutationModal';
import {
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  Search,
  UserX,
  Layers,
  ArrowRight,
  Target,
  Calendar,
  CheckSquare,
  HelpCircle,
} from 'lucide-react';

interface Props {
  parcels: GisParcel[];
  isCheckedInToday: boolean;
  checkInDetails?: { time: string; distance: number; status: string } | null;
  onNavigateToMap: () => void;
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
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedMutationParcel, setSelectedMutationParcel] = useState<GisParcel | null>(null);
  const [showStatusHelp, setShowStatusHelp] = useState<boolean>(false);

  // Daily & Weekly Targets
  const todayTarget = 5;
  const todayCompleted = 2;
  const weekTarget = 20;
  const weekCompleted = 8;

  // Breakdown of actual parcels
  const total = parcels.length;
  const approved = parcels.filter((p) => p.surveyStatus === 'APPROVED').length;
  const inProgress = parcels.filter((p) => p.surveyStatus === 'IN_PROGRESS' || p.surveyStatus === 'SUBMITTED').length;
  const absent = parcels.filter((p) => p.surveyStatus === 'POSTPONED_ABSENT').length;
  const notSurveyed = parcels.filter((p) => p.surveyStatus === 'NOT_SURVEYED').length;

  const filteredParcels = parcels.filter((p) => {
    const matchesSearch =
      p.projectParcelCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.houseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.street.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.ownerName && p.ownerName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'NOT_SURVEYED' && p.surveyStatus === 'NOT_SURVEYED') ||
      (statusFilter === 'IN_PROGRESS' && (p.surveyStatus === 'IN_PROGRESS' || p.surveyStatus === 'SUBMITTED')) ||
      (statusFilter === 'APPROVED' && p.surveyStatus === 'APPROVED') ||
      (statusFilter === 'ABSENT' && p.surveyStatus === 'POSTPONED_ABSENT');

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: GisParcel['surveyStatus']) => {
    switch (status) {
      case 'APPROVED':
        return <span className="badge badge-success">✓ Đã duyệt xong</span>;
      case 'SUBMITTED':
        return <span className="badge badge-warning">⏳ Chờ Admin duyệt</span>;
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
    <div style={{ padding: '1rem', maxWidth: '780px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. Dynamic Attendance Widget (Requirement 4) */}
      <div
        className="card"
        style={{
          background: isCheckedInToday
            ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
            : 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
          border: isCheckedInToday ? '1px solid #bbf7d0' : '1px solid #fde68a',
          padding: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '0.775rem',
              fontWeight: 700,
              color: isCheckedInToday ? '#15803d' : '#b45309',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {isCheckedInToday ? 'Xác thực hiện trường hợp lệ' : 'Nhắc nhở chấm công đầu ca'}
          </div>

          <h2 style={{ margin: '0.2rem 0', fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
            Ga Phụ Trách: {user?.assignedZoneId || 'Ga S9 - Bà Quẹo'}
          </h2>

          {isCheckedInToday ? (
            <div style={{ fontSize: '0.825rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
              <CheckCircle2 size={16} color="#16a34a" />
              <span>
                <strong>Đã điểm danh</strong> lúc {checkInDetails?.time || '07:45'} (Cách tâm Ga {checkInDetails?.distance || 35}m - Hợp lệ)
              </span>
            </div>
          ) : (
            <div style={{ fontSize: '0.825rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
              <AlertCircle size={16} color="#d97706" />
              <span>Bạn <strong>chưa điểm danh GPS</strong> hôm nay. Vui lòng điểm danh trước khi bắt đầu khảo sát!</span>
            </div>
          )}
        </div>

        {/* Action Button: ONLY render if NOT checked in today */}
        {!isCheckedInToday ? (
          <button
            type="button"
            onClick={onNavigateToCheckIn}
            className="btn btn-warning"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.65rem 1.15rem',
              fontWeight: 700,
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
            }}
          >
            <Clock size={16} />
            Điểm Danh GPS Ngay
          </button>
        ) : (
          <div
            style={{
              padding: '0.4rem 0.75rem',
              backgroundColor: '#ffffff',
              borderRadius: '0.5rem',
              border: '1px solid #bbf7d0',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#15803d',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <CheckCircle2 size={14} />
            Ca trực đã kích hoạt
          </div>
        )}
      </div>

      {/* 2. Daily & Weekly Quota Cards (Requirement 5) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
        {/* Today's Target Card */}
        <div
          className="card"
          style={{
            padding: '1rem',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Target size={15} color="#0284c7" />
              Mục tiêu hôm nay
            </span>
            <span className="badge badge-primary">
              {todayCompleted}/{todayTarget} căn ({Math.round((todayCompleted / todayTarget) * 100)}%)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>{todayCompleted}</span>
            <span style={{ fontSize: '0.95rem', color: '#64748b' }}>/ {todayTarget} căn cần khảo sát</span>
          </div>

          {/* Progress bar */}
          <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${(todayCompleted / todayTarget) * 100}%`,
                height: '100%',
                backgroundColor: '#0284c7',
                borderRadius: '999px',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
          <div style={{ fontSize: '0.725rem', color: '#64748b' }}>
            Còn <strong>{todayTarget - todayCompleted} căn</strong> cần hoàn thành trong hôm nay
          </div>
        </div>

        {/* Weekly Target Card */}
        <div
          className="card"
          style={{
            padding: '1rem',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Calendar size={15} color="#10b981" />
              Mục tiêu tuần này
            </span>
            <span className="badge badge-success">
              {weekCompleted}/{weekTarget} căn ({Math.round((weekCompleted / weekTarget) * 100)}%)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>{weekCompleted}</span>
            <span style={{ fontSize: '0.95rem', color: '#64748b' }}>/ {weekTarget} căn toàn tuyến</span>
          </div>

          {/* Progress bar */}
          <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${(weekCompleted / weekTarget) * 100}%`,
                height: '100%',
                backgroundColor: '#10b981',
                borderRadius: '999px',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
          <div style={{ fontSize: '0.725rem', color: '#64748b' }}>
            Đã đạt <strong>{weekCompleted} căn</strong> được ký duyệt chính thức
          </div>
        </div>
      </div>

      {/* 3. Detailed Status Breakdown & Definition Tooltip */}
      <div
        className="card"
        style={{
          padding: '1rem',
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
            Phân loại trạng thái {total} thửa đất tại trạm:
          </span>
          <button
            type="button"
            onClick={() => setShowStatusHelp(!showStatusHelp)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#0284c7',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.2rem',
            }}
          >
            <HelpCircle size={14} />
            {showStatusHelp ? 'Ẩn giải thích' : 'Ý nghĩa trạng thái'}
          </button>
        </div>

        {/* Explanation Banner */}
        {showStatusHelp && (
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '0.5rem',
              padding: '0.75rem',
              fontSize: '0.775rem',
              color: '#475569',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
            }}
          >
            <div>
              🟢 <strong>Đã duyệt (Approved)</strong>: Hồ sơ đã được Zone Admin thẩm định và đóng dấu ký duyệt chính thức.
            </div>
            <div>
              🟡 <strong>Đang khảo sát (In Progress / Draft)</strong>: Hồ sơ đã được bạn mở ra tạo bản nháp, đang chụp ảnh hoặc đang đo đạc dở chưa nộp, hoặc hồ sơ bị Zone Admin trả về yêu cầu đo bổ sung.
            </div>
            <div>
              🟣 <strong>Vắng mặt (Absent)</strong>: Chủ hộ đi vắng khi đoàn khảo sát đến, đã dán giấy thông báo lịch hẹn tiếp theo.
            </div>
            <div>
              ⚪ <strong>Chưa khảo sát (Not Surveyed)</strong>: Thửa đất trong vùng đệm 50m của Ga nhưng chưa có điều tra viên nào bắt đầu mở hồ sơ.
            </div>
          </div>
        )}

        {/* 4 Metrics Pills */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.5rem' }}>
          <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.65rem', borderRadius: '0.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: '#15803d', fontWeight: 600 }}>Đã duyệt (Xong)</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#16a34a' }}>{approved}</div>
          </div>

          <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', padding: '0.65rem', borderRadius: '0.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: '#b45309', fontWeight: 600 }}>Đang khảo sát</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#d97706' }}>{inProgress}</div>
          </div>

          <div style={{ backgroundColor: '#faf5ff', border: '1px solid #e9d5ff', padding: '0.65rem', borderRadius: '0.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: '#7e22ce', fontWeight: 600 }}>Vắng mặt</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#9333ea' }}>{absent}</div>
          </div>

          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.65rem', borderRadius: '0.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Chưa khảo sát</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#475569' }}>{notSurveyed}</div>
          </div>
        </div>
      </div>

      {/* 4. Quick Action Shortcuts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <button
          type="button"
          onClick={onNavigateToMap}
          className="btn"
          style={{
            background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
            color: '#ffffff',
            padding: '0.85rem 1rem',
            borderRadius: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: 'none',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MapPin size={18} />
            <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>Bản Đồ Quét Cạn GIS</span>
          </div>
          <ArrowRight size={16} />
        </button>

        <button
          type="button"
          onClick={() => onStartPhase1(parcels[0])}
          className="btn"
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#ffffff',
            padding: '0.85rem 1rem',
            borderRadius: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: 'none',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PlusCircle size={18} />
            <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>Khảo Sát Phase 1 Mới</span>
          </div>
          <ArrowRight size={16} />
        </button>
      </div>

      {/* 5. Search & Filter Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ position: 'relative', width: '100%' }}>
          <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            className="form-control"
            style={{ paddingLeft: '2.4rem' }}
            placeholder="Tìm số nhà, tên đường, mã B-xxx, chủ hộ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
          {[
            { id: 'ALL', label: `Tất cả (${total})` },
            { id: 'NOT_SURVEYED', label: `Chưa làm (${notSurveyed})` },
            { id: 'IN_PROGRESS', label: `Đang làm (${inProgress})` },
            { id: 'ABSENT', label: `Vắng mặt (${absent})` },
            { id: 'APPROVED', label: `Đã xong (${approved})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`btn btn-sm ${statusFilter === tab.id ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', whiteSpace: 'nowrap' }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 6. Parcel Tasks List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingBottom: '4.5rem' }}>
        {filteredParcels.map((p) => (
          <div
            key={p.id}
            className="card"
            style={{
              padding: '1rem',
              backgroundColor: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0284c7' }}>
                    {p.projectParcelCode}
                  </span>
                  {getStatusBadge(p.surveyStatus)}
                  {p.absenceAttemptCount ? (
                    <span className="badge badge-danger">Vắng {p.absenceAttemptCount} lần</span>
                  ) : null}
                </div>
                <div style={{ fontSize: '0.925rem', color: '#0f172a', fontWeight: 600, marginTop: '2px' }}>
                  Số {p.houseNumber} {p.street}
                </div>
                <div style={{ fontSize: '0.775rem', color: '#64748b' }}>
                  Mã địa chính: <strong style={{ color: '#334155' }}>{p.officialCadastralCode}</strong> • Chủ hộ: {p.ownerName || 'Chưa cập nhật'}
                </div>
              </div>
            </div>

            {/* Quick Actions for Parcel */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', borderTop: '1px solid #f1f5f9', paddingTop: '0.65rem' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onStartPhase1(p)}
                style={{ flex: 1, minWidth: '120px', fontSize: '0.775rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
              >
                <PlusCircle size={13} />
                Khảo sát Phase 1
              </button>

              <button
                type="button"
                className="btn btn-sm"
                onClick={() => onStartPhase2(p)}
                style={{
                  backgroundColor: '#f3e8ff',
                  color: '#7e22ce',
                  border: '1px solid #d8b4fe',
                  fontSize: '0.775rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                <CheckSquare size={13} />
                Phase 2
              </button>

              <button
                type="button"
                className="btn btn-warning btn-sm"
                onClick={() => onRecordAbsence(p)}
                style={{ fontSize: '0.775rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <UserX size={13} />
                Vắng mặt
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedMutationParcel(p)}
                style={{ fontSize: '0.775rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <Layers size={13} />
                Tách thửa
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Parcel Mutation Modal */}
      {selectedMutationParcel && (
        <ParcelMutationModal
          parcel={selectedMutationParcel}
          isOpen={!!selectedMutationParcel}
          onClose={() => setSelectedMutationParcel(null)}
          onSubmit={async (data) => {
            await api.post('/mutations/propose', data);
          }}
        />
      )}
    </div>
  );
};
