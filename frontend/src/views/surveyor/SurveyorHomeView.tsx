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
  Filter,
  UserX,
  Layers,
  ArrowRight,
  TrendingUp,
  Building,
  CheckSquare,
} from 'lucide-react';

interface Props {
  parcels: GisParcel[];
  onNavigateToMap: () => void;
  onNavigateToCheckIn: () => void;
  onStartPhase1: (parcel: GisParcel) => void;
  onStartPhase2: (parcel: GisParcel) => void;
  onRecordAbsence: (parcel: GisParcel) => void;
}

export const SurveyorHomeView: React.FC<Props> = ({
  parcels,
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

  // Stats calculation
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
        return <span className="badge badge-success">✓ Đã duyệt</span>;
      case 'SUBMITTED':
        return <span className="badge badge-warning">⏳ Chờ duyệt</span>;
      case 'IN_PROGRESS':
        return <span className="badge badge-warning">🔄 Đang khảo sát</span>;
      case 'POSTPONED_ABSENT':
        return <span className="badge" style={{ background: '#a855f7', color: '#fff' }}>🏠 Vắng mặt</span>;
      case 'REJECTED':
        return <span className="badge badge-danger">✕ Cần bổ sung</span>;
      case 'NOT_SURVEYED':
      default:
        return <span className="badge" style={{ background: '#334155', color: '#94a3b8' }}>Chưa KS</span>;
    }
  };

  return (
    <div style={{ padding: '1rem', maxWidth: '780px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Attendance Greeting Card */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.25), rgba(15, 23, 42, 0.95))',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: '1rem',
          padding: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Xin chào, {user?.fullName || 'Nguyễn Văn Khảo Sát'}!
          </div>
          <h2 style={{ margin: '0.25rem 0', fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>
            Phụ Trách: {user?.assignedZoneId || 'Ga S9 - Bà Quẹo'}
          </h2>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
              Đã điểm danh GPS (07:45 - Cách 35m)
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onNavigateToCheckIn}
          className="btn btn-sm btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)' }}
        >
          <Clock size={14} />
          Điểm Danh GPS
        </button>
      </div>

      {/* Progress Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem' }}>
        <div className="card" style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '0.75rem', borderRadius: '0.75rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Tổng số thửa</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc' }}>{total}</div>
        </div>
        <div className="card" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.75rem', borderRadius: '0.75rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#6ee7b7' }}>Đã duyệt (Xong)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>{approved}</div>
        </div>
        <div className="card" style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.75rem', borderRadius: '0.75rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#fcd34d' }}>Đang khảo sát</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b' }}>{inProgress}</div>
        </div>
        <div className="card" style={{ background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)', padding: '0.75rem', borderRadius: '0.75rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#d8b4fe' }}>Vắng mặt</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#c084fc' }}>{absent}</div>
        </div>
        <div className="card" style={{ background: 'rgba(100, 116, 139, 0.1)', border: '1px solid rgba(100, 116, 139, 0.3)', padding: '0.75rem', borderRadius: '0.75rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>Chưa khảo sát</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#94a3b8' }}>{notSurveyed}</div>
        </div>
      </div>

      {/* Quick Action Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
        <button
          type="button"
          onClick={onNavigateToMap}
          className="btn"
          style={{
            background: 'linear-gradient(135deg, #0284c7, #2563eb)',
            color: '#fff',
            padding: '0.85rem 1rem',
            borderRadius: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: 'none',
            boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MapPin size={20} />
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Bản Đồ Quét Cạn GIS</span>
          </div>
          <ArrowRight size={18} />
        </button>

        <button
          type="button"
          onClick={() => onStartPhase1(parcels[0])}
          className="btn"
          style={{
            background: 'linear-gradient(135deg, #059669, #10b981)',
            color: '#fff',
            padding: '0.85rem 1rem',
            borderRadius: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: 'none',
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PlusCircle size={20} />
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Khảo Sát Phase 1 Mới</span>
          </div>
          <ArrowRight size={18} />
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: '2.25rem' }}
              placeholder="Tìm theo số nhà, tên đường, mã B-xxx, tên chủ hộ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
          {[
            { id: 'ALL', label: `Tất cả (${total})` },
            { id: 'NOT_SURVEYED', label: `Chưa KS (${notSurveyed})` },
            { id: 'IN_PROGRESS', label: `Đang làm (${inProgress})` },
            { id: 'ABSENT', label: `Vắng mặt (${absent})` },
            { id: 'APPROVED', label: `Đã duyệt (${approved})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`btn btn-sm ${statusFilter === tab.id ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', whiteSpace: 'nowrap' }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Parcel Task List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingBottom: '4rem' }}>
        {filteredParcels.map((p) => (
          <div
            key={p.id}
            className="card"
            style={{
              background: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '0.75rem',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              transition: 'border-color 0.2s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 700, color: '#38bdf8' }}>
                    {p.projectParcelCode}
                  </span>
                  {getStatusBadge(p.surveyStatus)}
                  {p.absenceAttemptCount ? (
                    <span className="badge badge-danger">Vắng {p.absenceAttemptCount} lần</span>
                  ) : null}
                </div>
                <div style={{ fontSize: '0.9rem', color: '#f8fafc', fontWeight: 500, marginTop: '2px' }}>
                  Số {p.houseNumber} {p.street}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Mã ĐC: <strong style={{ color: '#cbd5e1' }}>{p.officialCadastralCode}</strong> • Chủ hộ: {p.ownerName || 'Chưa cập nhật'}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onStartPhase1(p)}
                style={{ flex: 1, minWidth: '120px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
              >
                <PlusCircle size={13} />
                Khảo sát Phase 1
              </button>

              <button
                type="button"
                className="btn btn-sm"
                onClick={() => onStartPhase2(p)}
                style={{
                  background: 'rgba(168, 85, 247, 0.15)',
                  color: '#c084fc',
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                  fontSize: '0.75rem',
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
                style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <UserX size={13} />
                Vắng mặt
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedMutationParcel(p)}
                style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
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
