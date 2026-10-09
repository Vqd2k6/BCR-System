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
  Move,
  Layers,
} from 'lucide-react';
import { useAuth } from '../../../../context/AuthContext';
import { ParcelMutationHistoryModal } from '../../cadastral-editor/components/ParcelMutationHistoryModal';
import { CadastralSpatialSwapModal } from '../../cadastral-editor/components/CadastralSpatialSwapModal';
import { CadastralBoundaryReshapeModal } from '../../cadastral-editor/components/CadastralBoundaryReshapeModal';
import { api } from '../../../../services/api';
import { getErrorMessage } from '@/utils/errorUtils';
import type { GisParcel } from '../../shared/types';
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
  const [showReshapeModal, setShowReshapeModal] = useState(false);
  const [showCondoConfirmModal, setShowCondoConfirmModal] = useState(false);
  const [condoConfirmCode, setCondoConfirmCode] = useState<string>('');
  const [condoInputCode, setCondoInputCode] = useState<string>('');
  const [isConvertingCondo, setIsConvertingCondo] = useState(false);

  if (!activeParcel) return null;

  // Tiền điều kiện chuyển đổi sang Chung cư (Precondition Gate)
  const isEligibleForCondoConversion =
    (activeParcel.surveyStatus === 'NOT_SURVEYED' || !activeParcel.surveyStatus) &&
    !activeParcel.activePhase1ReportId &&
    (!activeParcel.lifecycleStatus || activeParcel.lifecycleStatus === 'ACTIVE');

  const getIneligibilityReason = (): string => {
    if (activeParcel.surveyStatus && activeParcel.surveyStatus !== 'NOT_SURVEYED') {
      return `Không thể chuyển đổi: Thửa đất đang hoặc đã khảo sát (${activeParcel.surveyStatus})`;
    }
    if (activeParcel.activePhase1ReportId) {
      return 'Không thể chuyển đổi: Thửa đất đã có hồ sơ khảo sát liên kết';
    }
    if (activeParcel.lifecycleStatus && activeParcel.lifecycleStatus !== 'ACTIVE') {
      return `Không thể chuyển đổi: Thửa đất đang có biến động (${activeParcel.lifecycleStatus})`;
    }
    return '';
  };

  const handleOpenCondoConfirm = () => {
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
    setCondoConfirmCode(randomCode);
    setCondoInputCode('');
    setShowCondoConfirmModal(true);
  };

  const handleConvertToCondo = async () => {
    if (!activeParcel) return;
    setIsConvertingCondo(true);
    try {
      await api.patch(`/parcels/${activeParcel.id}/building-type`, {
        buildingType: 'CONDOMINIUM',
      });
      // Lưu override ngoại tuyến vào LocalStorage để map cập nhật ngay tức thì
      try {
        const overrides = JSON.parse(localStorage.getItem('metro2_parcel_status_overrides') || '{}');
        overrides[activeParcel.id] = {
          ...(overrides[activeParcel.id] || {}),
          buildingType: 'CONDOMINIUM',
          surveyCaseType: 'APARTMENT',
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem('metro2_parcel_status_overrides', JSON.stringify(overrides));
      } catch (storageErr) {
        console.warn('[ParcelDetailBottomSheet:handleConvertToCondo] Lỗi ghi override localStorage:', storageErr);
      }

      setShowCondoConfirmModal(false);
      onSwapSuccess?.();
      if (onOpenBuildingHub) {
        onOpenBuildingHub(activeParcel);
      }
    } catch (err: unknown) {
      console.error('[ParcelDetailBottomSheet:handleConvertToCondo] Thất bại chuyển đổi chung cư:', err);
      alert(`Lỗi khi chuyển đổi sang chung cư: ${getErrorMessage(err, 'Lỗi kết nối')}`);
    } finally {
      setIsConvertingCondo(false);
    }
  };

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
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => onOpenBuildingHub && onOpenBuildingHub(activeParcel)}
                style={{
                  flex: 1,
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '0.6rem 1rem',
                  fontWeight: 700,
                  backgroundColor: '#4338ca',
                  color: '#ffffff',
                  border: '1px solid #3730a3',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(67, 56, 202, 0.25)',
                }}
              >
                <Building2 size={16} />
                Mở Hub Căn Hộ ({activeParcel.completedUnits || 0}/{activeParcel.totalUnits || 1})
              </button>
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

        {/* Nút Chuyển đổi sang Chung cư (CHỈ CHO PHÉP ZONE_ADMIN & SUPER_ADMIN KHI CHƯA LÀ CHUNG CƯ) */}
        {(user?.role === 'ZONE_ADMIN' || user?.role === 'SUPER_ADMIN') &&
          activeParcel.buildingType !== 'CONDOMINIUM' && (
            <button
              type="button"
              className="btn btn-sm"
              disabled={!isEligibleForCondoConversion}
              onClick={handleOpenCondoConfirm}
              style={{
                fontSize: '0.775rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                color: isEligibleForCondoConversion ? '#6d28d9' : '#94a3b8',
                borderColor: isEligibleForCondoConversion ? '#ddd6fe' : '#e2e8f0',
                backgroundColor: isEligibleForCondoConversion ? '#f5f3ff' : '#f8fafc',
                padding: '0.5rem 0.75rem',
                fontWeight: 700,
                cursor: isEligibleForCondoConversion ? 'pointer' : 'not-allowed',
                opacity: isEligibleForCondoConversion ? 1 : 0.6,
              }}
              title={
                isEligibleForCondoConversion
                  ? 'Chuyển đổi thửa đất sang mô hình Chung cư / Tập thể (Admin Only)'
                  : getIneligibilityReason()
              }
            >
              <Building2 size={14} color={isEligibleForCondoConversion ? '#6d28d9' : '#94a3b8'} />
              Chuyển Chung Cư
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

        {/* Nút Nắn Chỉnh Ranh Đất GIS (CHỈ CHO PHÉP ZONE_ADMIN & SUPER_ADMIN) */}
        {(user?.role === 'ZONE_ADMIN' || user?.role === 'SUPER_ADMIN') && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setShowReshapeModal(true)}
            style={{
              fontSize: '0.775rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              color: '#4f46e5',
              borderColor: '#c7d2fe',
              backgroundColor: '#eef2ff',
              padding: '0.5rem 0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
            title="Kéo thả mốc đỉnh để nắn chỉnh đa giác ranh thửa đất khớp ảnh vệ tinh (Admin Only)"
          >
            <Move size={14} color="#4f46e5" />
            Nắn Chỉnh Đa Giác
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

      {/* Modal Nắn chỉnh ranh giới đa giác thửa đất (Admin Only) */}
      {(user?.role === 'ZONE_ADMIN' || user?.role === 'SUPER_ADMIN') && (
        <CadastralBoundaryReshapeModal
          parcel={activeParcel}
          isOpen={showReshapeModal}
          onClose={() => setShowReshapeModal(false)}
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

      {/* Modal Quản lý CAD Mặt Bằng (Admin Only) */}
      {/* Modal Xác nhận Chuyển đổi sang Chung cư (Yêu cầu nhập mã 6 số ngẫu nhiên) */}
      {showCondoConfirmModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isConvertingCondo) {
              setShowCondoConfirmModal(false);
            }
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '1rem',
              maxWidth: '480px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '0.75rem',
                  backgroundColor: '#f5f3ff',
                  color: '#7c3aed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                }}
              >
                <Building2 size={24} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                  Xác Nhận Chuyển Đổi Sang Chung Cư
                </h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                  Mã thửa đất: <strong style={{ color: '#0284c7' }}>{activeParcel.projectParcelCode}</strong>
                </p>
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '0.625rem',
                padding: '0.875rem',
                fontSize: '0.8rem',
                color: '#1e40af',
                marginBottom: '1rem',
                lineHeight: 1.5,
              }}
            >
              <p style={{ margin: '0 0 0.4rem 0', fontWeight: 700 }}>
                • Quy trình sau khi chuyển đổi:
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                <li>Loại hình công trình chuyển thành <strong>Chung cư / Tòa nhà nhiều căn</strong>.</li>
                <li>Hệ thống sẽ mở <strong>Hub Chung Cư</strong> để quản lý bản vẽ CAD và phân chia căn hộ con.</li>
                <li>Thao tác này làm thay đổi cấu trúc dữ liệu khảo sát và cần được xác thực kỹ lưỡng.</li>
              </ul>
            </div>

            {/* Random 6-digit confirmation code block */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '0.625rem',
                padding: '0.875rem',
                marginBottom: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>
                  MÃ XÁC NHẬN BẢO MẬT:
                </span>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '1.2rem',
                    fontWeight: 900,
                    letterSpacing: '0.25rem',
                    color: '#6d28d9',
                    backgroundColor: '#ede9fe',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #ddd6fe',
                  }}
                >
                  {condoConfirmCode}
                </span>
              </div>
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem', color: '#64748b' }}>
                Vui lòng nhập đúng dãy 6 số trên để mở khóa nút xác nhận:
              </p>
              <input
                type="text"
                maxLength={6}
                value={condoInputCode}
                onChange={(e) => setCondoInputCode(e.target.value.replace(/\D/g, ''))}
                placeholder="Nhập 6 số..."
                autoFocus
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  fontSize: '1rem',
                  fontFamily: 'monospace',
                  letterSpacing: '0.2rem',
                  fontWeight: 700,
                  borderRadius: '0.5rem',
                  border: condoInputCode === condoConfirmCode ? '2px solid #10b981' : '1px solid #cbd5e1',
                  backgroundColor: condoInputCode === condoConfirmCode ? '#f0fdf4' : '#ffffff',
                  color: condoInputCode === condoConfirmCode ? '#166534' : '#0f172a',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={isConvertingCondo}
                onClick={() => setShowCondoConfirmModal(false)}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.85rem',
                  borderRadius: '0.5rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={isConvertingCondo || condoInputCode.trim() !== condoConfirmCode}
                onClick={handleConvertToCondo}
                style={{
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.85rem',
                  borderRadius: '0.5rem',
                  fontWeight: 700,
                  backgroundColor: condoInputCode.trim() === condoConfirmCode ? '#7c3aed' : '#cbd5e1',
                  borderColor: condoInputCode.trim() === condoConfirmCode ? '#6d28d9' : '#cbd5e1',
                  color: condoInputCode.trim() === condoConfirmCode ? '#ffffff' : '#94a3b8',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  cursor: condoInputCode.trim() === condoConfirmCode ? 'pointer' : 'not-allowed',
                }}
              >
                {isConvertingCondo ? 'Đang chuyển đổi...' : 'Xác nhận Chuyển đổi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
