import React from 'react';
import type { GisParcel } from '../../../../components/gis/LeafletSweepMap';
import { getStatus, getBuildingType, getStatusBadge } from '../utils/surveyorHomeHelpers';
import { formatShortParcelDisplay } from '../../../../core/utils/codeFormattingUtils';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  PlusCircle,
  Navigation,
  GitCompare,
  Building2,
  HardHat,
  Eye,
  XCircle,
  UserCheck,
} from 'lucide-react';

interface ParcelCardItemProps {
  parcel: GisParcel;
  canApproveOrReject: boolean;
  onStartPhase1: (parcel: GisParcel, readOnly?: boolean) => void;
  onStartPhase2: (parcel: GisParcel) => void;
  onOpenHub: (parcel: GisParcel) => void;
  onOpenDirections: (parcel: GisParcel) => void;
  onAdminApprove: (parcel: GisParcel) => void;
  onAdminReject: (parcel: GisParcel) => void;
  onResumeSurveyPresent?: (parcel: GisParcel) => void;
}

export const ParcelCardItem: React.FC<ParcelCardItemProps> = ({
  parcel: p,
  canApproveOrReject,
  onStartPhase1,
  onStartPhase2,
  onOpenHub,
  onOpenDirections,
  onAdminApprove,
  onAdminReject,
  onResumeSurveyPresent,
}) => {
  const status = getStatus(p);
  const buildingType = getBuildingType(p);
  const isApproved = status === 'APPROVED';
  const isPhase2Done = status === 'PHASE2_COMPLETED' || status === 'APPROVED_PHASE2';
  const isSubmitted = status === 'SUBMITTED';
  const isInProgress = status === 'IN_PROGRESS';
  const isRejected = status === 'REJECTED';
  const isAbsent = status === 'POSTPONED_ABSENT';
  const isUnderConstruction = status === 'UNDER_CONSTRUCTION';

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
    : isUnderConstruction
    ? '#f97316'
    : '#64748b';

  return (
    <div
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
            {(() => {
              const rawCode = p.projectParcelCode || p.project_parcel_code || '---';
              const shortCode = formatShortParcelDisplay(rawCode);
              return (
                <span
                  title={`Mã thửa chuẩn: ${rawCode}`}
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 800,
                    color: '#0284c7',
                    maxWidth: '180px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'inline-block',
                    verticalAlign: 'middle',
                  }}
                >
                  {shortCode}
                </span>
              );
            })()}
            {getStatusBadge(status, p)}
            {buildingType === 'CONDOMINIUM' && (
              <button
                type="button"
                onClick={() => onOpenHub(p)}
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
            Số {p.houseNumber || p.house_number} {p.street}
          </div>

          {buildingType === 'CONDOMINIUM' && (
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
          Chủ sở hữu: <strong>{p.ownerName || p.owner_name || 'Chưa cập nhật'}</strong>
        </span>
        <span>
          Mã địa chính: <strong>{p.officialCadastralCode || p.official_cadastral_code || 'Chưa có'}</strong>
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
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => onStartPhase1(p, true)}
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
              title="Hồ sơ đã nộp, nhấp để xem lại biểu mẫu"
            >
              <Eye size={14} color="#0284c7" />
              Xem lại
            </button>
            {canApproveOrReject ? (
              <>
                <button
                  type="button"
                  onClick={() => onAdminApprove(p)}
                  className="btn btn-sm"
                  style={{
                    fontSize: '0.775rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    backgroundColor: '#059669',
                    color: '#ffffff',
                    border: '1px solid #047857',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)',
                  }}
                  title="Zone Admin / Super Admin phê duyệt hồ sơ này"
                >
                  <CheckCircle2 size={14} />
                  Duyệt
                </button>
                <button
                  type="button"
                  onClick={() => onAdminReject(p)}
                  className="btn btn-sm"
                  style={{
                    fontSize: '0.775rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    backgroundColor: '#fff1f2',
                    color: '#e11d48',
                    border: '1px solid #fecdd3',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  title="Zone Admin / Super Admin từ chối / yêu cầu bổ sung"
                >
                  <XCircle size={14} color="#e11d48" />
                  Từ chối
                </button>
              </>
            ) : (
              <span
                style={{
                  fontSize: '0.725rem',
                  color: '#0369a1',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '0.25rem 0.5rem',
                  backgroundColor: '#f0f9ff',
                  borderRadius: '6px',
                  border: '1px solid #bae6fd',
                }}
                title="Hồ sơ đang chờ Zone Admin hoặc Super Admin phê duyệt"
              >
                <Clock size={12} />
                Chờ Zone Admin duyệt
              </span>
            )}
          </div>
        ) : isAbsent ? (
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => (onResumeSurveyPresent ? onResumeSurveyPresent(p) : onStartPhase1(p))}
              className="btn btn-sm"
              style={{
                fontSize: '0.775rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: '#059669',
                color: '#ffffff',
                border: '1px solid #047857',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(5, 150, 105, 0.25)',
              }}
              title="Chủ nhà đã có mặt, mở lại khảo sát và tiếp tục các bước trong nhà"
            >
              <UserCheck size={14} />
              Khảo sát (Chủ nhà có mặt)
            </button>
            <button
              type="button"
              onClick={() => onStartPhase1(p, true)}
              className="btn btn-sm"
              style={{
                fontSize: '0.775rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: '#f3e8ff',
                color: '#7e22ce',
                border: '1px solid #d8b4fe',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="Xem lại biên bản và ảnh báo vắng đã ghi nhận"
            >
              <Eye size={14} color="#7e22ce" />
              Xem biên bản vắng
            </button>
          </div>
        ) : isUnderConstruction ? (
          <button
            type="button"
            onClick={() => onStartPhase1(p, true)}
            className="btn btn-sm"
            style={{
              fontSize: '0.775rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              backgroundColor: '#fff7ed',
              color: '#c2410c',
              border: '1px solid #fdba74',
              fontWeight: 700,
              cursor: 'pointer',
            }}
            title="Công trình đang xây dựng (Đã hoàn thành khảo sát - Xem lại biểu mẫu)"
          >
            <Eye size={14} color="#c2410c" />
            Xem lại biểu mẫu
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
        ) : buildingType === 'CONDOMINIUM' ? (
          <button
            type="button"
            onClick={() => onOpenHub(p)}
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
          onClick={() => onOpenDirections(p)}
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
};
