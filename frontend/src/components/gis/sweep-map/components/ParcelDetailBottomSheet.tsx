import React, { useState } from 'react';
import {
  X,
  Building2,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  Eye,
  Navigation,
  Split,
  History,
  ArrowLeftRight,
} from 'lucide-react';
import { useAuth } from '../../../../context/AuthContext';
import { ParcelMutationHistoryModal } from '../../cadastral-editor/components/ParcelMutationHistoryModal';
import { CadastralSpatialSwapModal } from '../../cadastral-editor/components/CadastralSpatialSwapModal';
import { GisParcel } from '../../shared/types';
import { getEffectiveParcelStatus, getStatusBadge, isNonBuildingParcel } from '../utils/sweepMapHelpers';

interface ParcelDetailBottomSheetProps {
  activeParcel: GisParcel | null;
  availableParcels?: GisParcel[];
  onClose: () => void;
  onStartSurvey?: (parcel: GisParcel, readOnly?: boolean) => void;
  onStartPhase2?: (parcel: GisParcel) => void;
  onOpenBuildingHub?: (parcel: GisParcel) => void;
  onProposeSplit?: (parcel: GisParcel) => void;
  onSwapSuccess?: () => void;
  absenceRecordedToday: { [parcelId: string]: string };
  handleOpenGoogleMapsDirections: (parcel: GisParcel) => void;
}

export const ParcelDetailBottomSheet: React.FC<ParcelDetailBottomSheetProps> = ({
  activeParcel,
  availableParcels = [],
  onClose,
  onStartSurvey,
  onStartPhase2,
  onOpenBuildingHub,
  onProposeSplit,
  onSwapSuccess,
  absenceRecordedToday,
  handleOpenGoogleMapsDirections,
}) => {
  const { user } = useAuth();
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);

  if (!activeParcel) return null;

  const activeEffectiveStatus = getEffectiveParcelStatus(activeParcel);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '12px',
        left: '12px',
        right: '12px',
        zIndex: 1000,
        backgroundColor: '#ffffff',
        borderRadius: '1rem',
        border: '1px solid #cbd5e1',
        boxShadow: '0 12px 28px -5px rgba(0, 0, 0, 0.2)',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem',
        animation: 'slideUp 0.2s ease-out',
      }}
    >
      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0284c7' }}>
            {activeParcel.projectParcelCode}
          </span>
          {getStatusBadge(activeEffectiveStatus, activeParcel)}
          {activeParcel.buildingType === 'CONDOMINIUM' && (
            <button
              type="button"
              onClick={() => onOpenBuildingHub && onOpenBuildingHub(activeParcel)}
              style={{
                backgroundColor: '#ede9fe',
                color: '#5b21b6',
                border: '1px solid #c4b5fd',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
              }}
            >
              <Building2 size={12} />
              Chung cư ({activeParcel.completedUnits || 0}/{activeParcel.totalUnits || 1} căn)
            </button>
          )}
          {activeParcel.absenceAttemptCount ? (
            <span className="badge badge-danger">Vắng {activeParcel.absenceAttemptCount} lần</span>
          ) : null}
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '0.2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Address & Cadastral info */}
      <div>
        <div style={{ fontSize: '0.95rem', color: '#0f172a', fontWeight: 700 }}>
          Số {activeParcel.houseNumber} {activeParcel.street}
        </div>
        <div style={{ fontSize: '0.775rem', color: '#64748b', marginTop: '2px' }}>
          Mã ĐC: <strong style={{ color: '#334155' }}>{activeParcel.officialCadastralCode}</strong> • Chủ hộ:{' '}
          {activeParcel.ownerName || 'Chưa cập nhật'}
        </div>
      </div>

      {/* Condominium Progress Bar */}
      {activeParcel.buildingType === 'CONDOMINIUM' && (
        <div
          style={{
            backgroundColor: '#f5f3ff',
            border: '1px solid #ddd6fe',
            borderRadius: '0.5rem',
            padding: '0.45rem 0.65rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700 }}>
            <span style={{ color: '#5b21b6', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Building2 size={13} />
              Tiến độ căn hộ:
            </span>
            <span style={{ color: '#4338ca' }}>
              {activeParcel.completedUnits || 0}/{activeParcel.totalUnits || 1} căn ({Math.min(100, Math.round(((activeParcel.completedUnits || 0) / Math.max(1, activeParcel.totalUnits || 1)) * 100))}%)
            </span>
          </div>
          <div style={{ height: '6px', backgroundColor: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, Math.round(((activeParcel.completedUnits || 0) / Math.max(1, activeParcel.totalUnits || 1)) * 100))}%`,
                backgroundColor: (activeParcel.completedUnits || 0) >= (activeParcel.totalUnits || 1) ? '#10b981' : '#7c3aed',
                borderRadius: '999px',
              }}
            />
          </div>
        </div>
      )}

      {/* Absence announcement banner if recorded today */}
      {absenceRecordedToday[activeParcel.id] && (
        <div
          style={{
            backgroundColor: '#faf5ff',
            border: '1px solid #e9d5ff',
            borderRadius: '0.5rem',
            padding: '0.45rem 0.65rem',
            fontSize: '0.775rem',
            color: '#7e22ce',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontWeight: 600,
          }}
        >
          <Clock size={13} color="#9333ea" />
          <span>Đã khai báo vắng mặt hôm nay lúc {absenceRecordedToday[activeParcel.id]} (Đã dán giấy hẹn)</span>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
        {(() => {
          if (activeEffectiveStatus === 'APPROVED') {
            return (
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', flex: 1.5 }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => onStartPhase2 ? onStartPhase2(activeParcel) : (onStartSurvey && onStartSurvey(activeParcel, true))}
                  style={{
                    flex: 1,
                    minWidth: '140px',
                    backgroundColor: '#7c3aed',
                    color: '#ffffff',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                    padding: '0.5rem',
                    boxShadow: '0 2px 6px rgba(124, 58, 237, 0.25)',
                    cursor: 'pointer',
                  }}
                >
                  <Sparkles size={14} />
                  Khảo sát Phase 2 (Trước thi công)
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => onStartSurvey && onStartSurvey(activeParcel, true)}
                  style={{
                    minWidth: '95px',
                    backgroundColor: '#f3e8ff',
                    color: '#6b21a8',
                    border: '1px solid #d8b4fe',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.3rem',
                    padding: '0.5rem',
                    cursor: 'pointer',
                  }}
                  title="Xem lại hồ sơ khảo sát Phase 1 đã duyệt (Chế độ chỉ xem)"
                >
                  <Eye size={13} color="#6b21a8" />
                  Xem Phase 1
                </button>
              </div>
            );
          }
          if (activeEffectiveStatus === 'PHASE2_COMPLETED' || activeEffectiveStatus === 'APPROVED_PHASE2') {
            return (
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', flex: 1.5 }}>
                <div
                  style={{
                    flex: 1,
                    minWidth: '140px',
                    backgroundColor: '#dbeafe',
                    color: '#1d4ed8',
                    padding: '0.45rem 0.65rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.775rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                    border: '1px solid #93c5fd',
                  }}
                >
                  <CheckCircle2 size={14} color="#2563eb" />
                  Đã Hoàn Tất Khảo Sát Phase 2
                </div>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => onStartSurvey && onStartSurvey(activeParcel, true)}
                  style={{
                    minWidth: '95px',
                    backgroundColor: '#e0f2fe',
                    color: '#0369a1',
                    border: '1px solid #7dd3fc',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.3rem',
                    padding: '0.5rem',
                    cursor: 'pointer',
                  }}
                  title="Xem lại hồ sơ khảo sát Phase 1 (Chế độ chỉ xem)"
                >
                  <Eye size={13} color="#0284c7" />
                  Xem Phase 1
                </button>
              </div>
            );
          }
          if (activeEffectiveStatus === 'SUBMITTED') {
            return (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => onStartSurvey && onStartSurvey(activeParcel, true)}
                style={{
                  flex: 1.5,
                  minWidth: '150px',
                  backgroundColor: '#e0f2fe',
                  color: '#0369a1',
                  border: '1px solid #7dd3fc',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  padding: '0.5rem',
                  cursor: 'pointer',
                }}
                title="Hồ sơ đã nộp chờ Zone Admin duyệt, nhấp để xem lại biểu mẫu (Chế độ chỉ xem)"
              >
                <Eye size={14} color="#0284c7" />
                Hồ sơ đã nộp (Xem lại)
              </button>
            );
          }
          if (activeEffectiveStatus === 'REJECTED') {
            return (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => onStartSurvey && onStartSurvey(activeParcel)}
                style={{
                  flex: 1.5,
                  minWidth: '150px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  padding: '0.5rem',
                  fontWeight: 700,
                  backgroundColor: '#fee2e2',
                  color: '#b91c1c',
                  border: '1px solid #fca5a5',
                  cursor: 'pointer',
                }}
              >
                <AlertCircle size={14} color="#dc2626" />
                Sửa & đo bổ sung Phase 1
              </button>
            );
          }
          if (activeParcel.buildingType === 'CONDOMINIUM') {
            return (
              <>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => onOpenBuildingHub && onOpenBuildingHub(activeParcel)}
                  style={{
                    flex: 1.5,
                    minWidth: '160px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                    padding: '0.5rem',
                    fontWeight: 700,
                    backgroundColor: '#4338ca',
                    color: '#ffffff',
                    border: '1px solid #3730a3',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(67, 56, 202, 0.25)',
                  }}
                >
                  <Building2 size={14} />
                  Mở Hub Căn Hộ ({activeParcel.completedUnits || 0}/{activeParcel.totalUnits || 1})
                </button>

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => onStartSurvey && onStartSurvey(activeParcel)}
                  style={{
                    flex: 1,
                    minWidth: '130px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                    padding: '0.5rem',
                    fontWeight: 700,
                    backgroundColor: '#0284c7',
                    borderColor: '#0369a1',
                  }}
                >
                  <PlusCircle size={14} />
                  Khảo sát Tòa Nhà
                </button>
              </>
            );
          }
          if (activeEffectiveStatus === 'UNDER_CONSTRUCTION') {
            return (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => onStartSurvey && onStartSurvey(activeParcel, true)}
                style={{
                  flex: 1.5,
                  minWidth: '150px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  padding: '0.5rem',
                  fontWeight: 700,
                  backgroundColor: '#fff7ed',
                  color: '#c2410c',
                  border: '1px solid #fdba74',
                }}
              >
                <Eye size={14} color="#c2410c" />
                Xem lại biểu mẫu
              </button>
            );
          }
          if (activeEffectiveStatus === 'IN_PROGRESS') {
            return (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onStartSurvey && onStartSurvey(activeParcel)}
                style={{
                  flex: 1.5,
                  minWidth: '150px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  padding: '0.5rem',
                  fontWeight: 700,
                  backgroundColor: '#d97706',
                  borderColor: '#b45309',
                }}
              >
                <PlusCircle size={14} />
                Tiếp tục đo đạc Phase 1
              </button>
            );
          }
          if (isNonBuildingParcel(activeParcel)) {
            return (
              <div
                style={{
                  flex: 1.5,
                  minWidth: '150px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  padding: '0.45rem 0.65rem',
                  fontSize: '0.725rem',
                  fontWeight: 700,
                  backgroundColor: '#f8fafc',
                  color: '#475569',
                  border: '1px dashed #cbd5e1',
                  borderRadius: '0.375rem',
                  textAlign: 'center',
                }}
                title="Đất dôi dư hoặc ngoài ranh công trình - Không yêu cầu lập Báo cáo khảo sát kết cấu Phase 1"
              >
                <span>🌿 Đất dôi dư / Sân vườn (Không yêu cầu khảo sát)</span>
              </div>
            );
          }
          return (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onStartSurvey && onStartSurvey(activeParcel)}
              style={{
                flex: 1.5,
                minWidth: '150px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                padding: '0.5rem',
                fontWeight: 700,
                backgroundColor: '#0284c7',
                borderColor: '#0369a1',
              }}
            >
              <PlusCircle size={14} />
              Bắt đầu khảo sát Phase 1
            </button>
          );
        })()}

        {/* Nút Tách / Gộp Thửa Đất GIS (CHỈ CHO PHÉP ZONE_ADMIN & SUPER_ADMIN - ẨN VỚI GUEST VÀ SURVEYOR) */}
        {onProposeSplit && (user?.role === 'ZONE_ADMIN' || user?.role === 'SUPER_ADMIN') && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => onProposeSplit(activeParcel)}
            style={{
              fontSize: '0.775rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              color: '#c2410c',
              borderColor: '#fed7aa',
              backgroundColor: '#fff7ed',
              padding: '0.5rem 0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
            title="Mở Studio Tách / Gộp Thửa Đất GIS (Admin Only)"
          >
            <Split size={14} color="#c2410c" />
            Tách / Gộp Thửa
          </button>
        )}

        {/* Nút Chuyển Vị Trí GIS (CHỈ CHO PHÉP ZONE_ADMIN & SUPER_ADMIN) */}
        {(user?.role === 'ZONE_ADMIN' || user?.role === 'SUPER_ADMIN') && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setShowSwapModal(true)}
            style={{
              fontSize: '0.775rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              color: '#0284c7',
              borderColor: '#bae6fd',
              backgroundColor: '#f0f9ff',
              padding: '0.5rem 0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
            title="Chuyển / Hoán đổi vị trí ranh giới không gian giữa 2 thửa đất (Admin Only)"
          >
            <ArrowLeftRight size={14} color="#0284c7" />
            Chuyển vị trí
          </button>
        )}

        {/* Nút Lịch Sử Biến Động (Bảo mật: DUY NHẤT SUPER_ADMIN) */}
        {user?.role === 'SUPER_ADMIN' && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setShowHistoryModal(true)}
            style={{
              fontSize: '0.775rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              color: '#0f172a',
              borderColor: '#cbd5e1',
              backgroundColor: '#f8fafc',
              padding: '0.5rem 0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
            title="Xem nhật ký kiểm toán và lịch sử biến động thửa đất (Chỉ dành cho Super Admin)"
          >
            <History size={14} color="#64748b" />
            Lịch sử
          </button>
        )}

        {/* Chỉ đường button linking to Google Maps */}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => handleOpenGoogleMapsDirections(activeParcel)}
          style={{
            fontSize: '0.775rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.3rem',
            color: '#0284c7',
            borderColor: '#bae6fd',
            backgroundColor: '#f0f9ff',
            padding: '0.5rem 0.75rem',
            fontWeight: 600,
          }}
          title="Mở chỉ đường Google Maps từ vị trí của bạn"
        >
          <Navigation size={14} color="#0284c7" />
          Chỉ đường
        </button>
      </div>

      {/* Modal Chuyển / Hoán đổi vị trí (Admin Only) */}
      {(user?.role === 'ZONE_ADMIN' || user?.role === 'SUPER_ADMIN') && (
        <CadastralSpatialSwapModal
          activeParcel={activeParcel}
          availableParcels={availableParcels}
          isOpen={showSwapModal}
          onClose={() => setShowSwapModal(false)}
          onSuccess={() => {
            onSwapSuccess?.();
          }}
        />
      )}

      {/* Modal Lịch sử biến động (Super Admin Only) */}
      {user?.role === 'SUPER_ADMIN' && (
        <ParcelMutationHistoryModal
          parcelId={activeParcel.id}
          parcelCode={activeParcel.projectParcelCode}
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
        />
      )}
    </div>
  );
};
