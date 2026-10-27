import React from 'react';
import {
  ShieldCheck,
  Camera,
  User,
  AlertTriangle,
  CheckCircle2,
  Users,
  UserCheck,
  LogOut,
  Clock,
} from 'lucide-react';
import {
  resolveAttendancePhotoUrl,
  formatWorkDurationMinutes,
  type MetroZoneCentroid,
} from '../../../../core/utils/metroZoneUtils';

import type { User as DomainUser } from '../../../../core/types/domain.types';
import type { CheckInDetails, CompanionRecord } from '../types';

interface TodayCheckInSummaryProps {
  checkInDetails: CheckInDetails | null;
  distanceMeters: number;
  targetZone: MetroZoneCentroid;
  gpsCoordinates: { lat: number; lng: number; accuracy: number } | null;
  selfieUrl: string;
  user: DomainUser | null;
  outOfBoundsReason: string;
  isCompanionCheckedIn: boolean;
  companionData: CompanionRecord | null;
  setShowCompanionModal: (show: boolean) => void;
  hasCheckedOut: boolean;
  checkOutSelfieUrl: string;
  checkOutNotes: string;
  setCheckOutNotes: (notes: string) => void;
  isCheckingOut: boolean;
  handleNativeCameraCapture: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCheckOutSubmit: (e?: React.FormEvent) => void;
}

export const TodayCheckInSummary: React.FC<TodayCheckInSummaryProps> = ({
  checkInDetails,
  distanceMeters,
  targetZone,
  gpsCoordinates,
  selfieUrl,
  user,
  outOfBoundsReason,
  isCompanionCheckedIn,
  companionData,
  setShowCompanionModal,
  hasCheckedOut,
  checkOutSelfieUrl,
  checkOutNotes,
  setCheckOutNotes,
  isCheckingOut,
  handleNativeCameraCapture,
  handleCheckOutSubmit,
}) => {
  const displaySelfieUrl = resolveAttendancePhotoUrl(selfieUrl || checkInDetails?.selfiePhotoUrl);
  const displayCheckOutSelfieUrl = resolveAttendancePhotoUrl(
    checkOutSelfieUrl || checkInDetails?.checkOutSelfiePhotoUrl
  );
  const displayCompanionSelfieUrl = resolveAttendancePhotoUrl(companionData?.selfieUrl);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Verified Header Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgb(var(--bg-green-50)) 0%, rgb(var(--bg-green-100)) 100%)',
          border: '1.5px solid rgb(var(--border-green-300))',
          borderRadius: '1rem',
          padding: '1.15rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.85rem',
          boxShadow: '0 2px 8px rgba(22, 163, 74, 0.12)',
        }}
      >
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            backgroundColor: 'rgb(var(--bg-green-200))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: 'rgb(var(--text-green-700))',
          }}
        >
          <ShieldCheck size={24} />
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'rgb(var(--text-green-900))' }}>
              ĐÃ ĐIỂM DANH THỰC ĐỊA HÔM NAY
            </h3>
            <span
              style={{
                backgroundColor: distanceMeters > 500 ? 'rgb(var(--bg-amber-100))' : 'rgb(var(--bg-green-100))',
                color: distanceMeters > 500 ? 'rgb(var(--text-amber-700))' : 'rgb(var(--text-green-700))',
                border: `1px solid ${distanceMeters > 500 ? 'rgb(var(--border-amber-200))' : 'rgb(var(--border-green-300))'}`,
                borderRadius: '999px',
                padding: '2px 8px',
                fontSize: '0.7rem',
                fontWeight: 700,
              }}
            >
              {distanceMeters > 500 ? 'Cảnh báo vị trí (>500m)' : 'Vị trí hợp lệ'}
            </span>
          </div>

          <div style={{ marginTop: '0.45rem', fontSize: '0.775rem', color: 'rgb(var(--text-green-800))', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            <span>
              Giờ vào (Check-in): <strong>{checkInDetails?.time || 'Hôm nay'}</strong>
            </span>
            {hasCheckedOut && checkInDetails?.checkOutTime && (
              <span>
                Giờ ra (Check-out): <strong>{checkInDetails.checkOutTime}</strong> ({formatWorkDurationMinutes(checkInDetails.workDurationMinutes)})
              </span>
            )}
            <span>
              Khoảng cách lúc Check-in: <strong>{checkInDetails?.distance ?? distanceMeters}m</strong> tới {targetZone.zoneName}
            </span>
            {(checkInDetails?.coordinates || gpsCoordinates) && (
              <span>
                GPS thực tế:{' '}
                <strong>
                  {(gpsCoordinates || checkInDetails?.coordinates)?.lat.toFixed(6)},{' '}
                  {(gpsCoordinates || checkInDetails?.coordinates)?.lng.toFixed(6)}
                </strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Real Photo & Verification Details Card */}
      <div
        className="card"
        style={{
          backgroundColor: 'rgb(var(--bg-white))',
          border: '1px solid rgb(var(--border-slate-200))',
          borderRadius: '1rem',
          padding: '1.15rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Camera size={16} color="#0284c7" />
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'rgb(var(--text-slate-900))' }}>
            Ảnh Selfie Xác Thực Đã Chụp Hôm Nay
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          {displaySelfieUrl ? (
            <img
              src={displaySelfieUrl}
              alt="Surveyor Selfie"
              style={{
                width: '130px',
                height: '160px',
                borderRadius: '0.75rem',
                objectFit: 'cover',
                border: '2px solid rgb(var(--border-sky-300))',
                boxShadow: '0 4px 10px rgba(2, 132, 199, 0.15)',
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: '130px',
                height: '160px',
                borderRadius: '0.75rem',
                backgroundColor: 'rgb(var(--bg-slate-50))',
                border: '2px dashed rgb(var(--border-slate-300))',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgb(var(--text-slate-500))',
                flexShrink: 0,
              }}
            >
              <User size={36} />
              <span style={{ fontSize: '0.7rem', marginTop: '4px', fontWeight: 600 }}>Ảnh selfie</span>
            </div>
          )}

          <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
            <div style={{ paddingBottom: '0.5rem', borderBottom: '1px solid rgb(var(--border-slate-100))' }}>
              <span style={{ color: 'rgb(var(--text-slate-500))', fontSize: '0.725rem', display: 'block' }}>Điều tra viên chính:</span>
              <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'rgb(var(--text-slate-900))' }}>
                {user?.fullName || 'Khảo Sát Viên'}
              </span>
              <span style={{ color: 'rgb(var(--text-slate-500))', fontSize: '0.75rem', display: 'block', marginTop: '2px' }}>
                Khu vực: <strong>{targetZone.zoneName}</strong>
              </span>
            </div>

            {outOfBoundsReason ? (
              <div
                style={{
                  backgroundColor: 'rgb(var(--bg-amber-50))',
                  border: '1px solid rgb(var(--border-amber-200))',
                  borderRadius: '0.65rem',
                  padding: '0.65rem 0.75rem',
                  color: 'rgb(var(--text-amber-800))',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '2px' }}>
                  <AlertTriangle size={13} color="#d97706" />
                  <span>Lý do chấm công ngoài vùng (&gt;500m) đã khai báo:</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.775rem', fontStyle: 'italic', color: 'rgb(var(--text-amber-900))', lineHeight: 1.4 }}>
                  &quot;{outOfBoundsReason}&quot;
                </p>
              </div>
            ) : (
              <div style={{ color: 'rgb(var(--text-green-600))', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', fontStyle: 'italic' }}>
                <CheckCircle2 size={13} />
                <span>Vị trí nằm trong bán kính quy chuẩn ≤ 500m quanh {targetZone.zoneName}.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section: Check-Out Kết Thúc Ca Làm Việc Thực Địa */}
      <div
        className="card"
        style={{
          backgroundColor: 'rgb(var(--bg-white))',
          border: hasCheckedOut
            ? '1.5px solid rgb(var(--border-sky-300))'
            : '1.5px solid rgb(var(--border-amber-200))',
          borderRadius: '1rem',
          padding: '1.15rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.9rem',
          background: hasCheckedOut
            ? 'linear-gradient(135deg, rgb(var(--bg-sky-50)) 0%, rgb(var(--bg-white)) 100%)'
            : 'linear-gradient(135deg, rgb(var(--bg-amber-50)) 0%, rgb(var(--bg-white)) 100%)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: hasCheckedOut ? 'rgb(var(--bg-sky-100))' : 'rgb(var(--bg-amber-100))',
                color: hasCheckedOut ? 'rgb(var(--text-sky-700))' : 'rgb(var(--text-amber-700))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LogOut size={18} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'rgb(var(--text-slate-900))' }}>
                {hasCheckedOut ? 'ĐÃ CHECK-OUT KẾT THÚC CA LÀM VIỆC' : 'Check-out Kết Thúc Ca Thực Địa'}
              </h4>
              <span style={{ fontSize: '0.725rem', color: 'rgb(var(--text-slate-500))' }}>
                {hasCheckedOut
                  ? `Đã khóa sổ thời gian làm việc hôm nay tại ${targetZone.zoneName}`
                  : 'Xác nhận vị trí GPS và giờ kết thúc khảo sát thực địa'}
              </span>
            </div>
          </div>

          <span
            style={{
              backgroundColor: hasCheckedOut ? 'rgb(var(--bg-sky-100))' : 'rgb(var(--bg-amber-100))',
              color: hasCheckedOut ? 'rgb(var(--text-sky-700))' : 'rgb(var(--text-amber-700))',
              border: `1px solid ${hasCheckedOut ? 'rgb(var(--border-sky-300))' : 'rgb(var(--border-amber-200))'}`,
              borderRadius: '999px',
              padding: '2px 9px',
              fontSize: '0.7rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Clock size={11} />
            <span>{hasCheckedOut ? `Đã Check-out lúc ${checkInDetails?.checkOutTime}` : 'Đang trong ca làm việc'}</span>
          </span>
        </div>

        {hasCheckedOut ? (
          <div
            style={{
              backgroundColor: 'rgb(var(--bg-white))',
              border: '1px solid rgb(var(--border-sky-200))',
              borderRadius: '0.75rem',
              padding: '0.85rem',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.85rem',
              alignItems: 'center',
            }}
          >
            {displayCheckOutSelfieUrl && (
              <img
                src={displayCheckOutSelfieUrl}
                alt="Check-out Selfie"
                style={{
                  width: '84px',
                  height: '104px',
                  borderRadius: '0.6rem',
                  objectFit: 'cover',
                  border: '2px solid rgb(var(--border-sky-300))',
                  flexShrink: 0,
                }}
              />
            )}
            <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem', color: 'rgb(var(--text-slate-700))' }}>
                <span>
                  Giờ vào: <strong>{checkInDetails?.time || '—'}</strong>
                </span>
                <span>
                  Giờ ra: <strong style={{ color: 'rgb(var(--text-sky-700))' }}>{checkInDetails?.checkOutTime}</strong>
                </span>
                <span>
                  Tổng thời gian: <strong style={{ color: 'rgb(var(--text-green-700))' }}>{formatWorkDurationMinutes(checkInDetails?.workDurationMinutes)}</strong>
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'rgb(var(--text-slate-600))' }}>
                Khoảng cách Check-out tới {targetZone.zoneName}:{' '}
                <strong>{checkInDetails?.checkOutDistance ?? distanceMeters}m</strong>
              </div>
              {checkInDetails?.checkOutNotes && (
                <div
                  style={{
                    marginTop: '0.2rem',
                    fontSize: '0.75rem',
                    color: 'rgb(var(--text-slate-700))',
                    backgroundColor: 'rgb(var(--bg-slate-50))',
                    padding: '0.4rem 0.65rem',
                    borderRadius: '0.45rem',
                    border: '1px solid rgb(var(--border-slate-200))',
                    fontStyle: 'italic',
                  }}
                >
                  Ghi chú kết thúc ca: &quot;{checkInDetails.checkOutNotes}&quot;
                </div>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleCheckOutSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Live Camera Check-out Photo */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.65rem',
                backgroundColor: 'rgb(var(--bg-white))',
                padding: '0.65rem 0.85rem',
                borderRadius: '0.65rem',
                border: '1px solid rgb(var(--border-slate-200))',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                {displayCheckOutSelfieUrl ? (
                  <img
                    src={displayCheckOutSelfieUrl}
                    alt="Check-out preview"
                    style={{
                      width: '54px',
                      height: '66px',
                      borderRadius: '0.5rem',
                      objectFit: 'cover',
                      border: '1.5px solid rgb(var(--border-sky-300))',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '48px',
                      height: '58px',
                      borderRadius: '0.5rem',
                      backgroundColor: 'rgb(var(--bg-slate-50))',
                      border: '1.5px dashed rgb(var(--border-slate-300))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'rgb(var(--text-slate-500))',
                    }}
                  >
                    <Camera size={18} />
                  </div>
                )}
                <div style={{ fontSize: '0.75rem', color: 'rgb(var(--text-slate-600))' }}>
                  <div style={{ fontWeight: 700, color: 'rgb(var(--text-slate-900))' }}>
                    Ảnh Chụp Trực Tiếp Kết Thúc Ca (Tùy chọn)
                  </div>
                  <div>
                    {displayCheckOutSelfieUrl
                      ? 'Đã chụp ảnh sống xác nhận kết thúc ca.'
                      : 'Chụp ảnh sống trực tiếp từ Camera trước khi ra về hoặc bấm Check-out ngay.'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', position: 'relative' }}>
                <input
                  id="attendance_ksv_checkout_native_camera"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleNativeCameraCapture}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '1px',
                    height: '1px',
                    padding: 0,
                    margin: 0,
                    overflow: 'hidden',
                    clip: 'rect(0, 0, 0, 0)',
                    whiteSpace: 'nowrap',
                    border: 0,
                    opacity: 0,
                    pointerEvents: 'none',
                  }}
                />
                <label
                  htmlFor="attendance_ksv_checkout_native_camera"
                  className="cursor-pointer"
                  style={{
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '0.5rem',
                    padding: '0.45rem 0.9rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    boxShadow: '0 2px 5px rgba(2, 132, 199, 0.25)',
                    userSelect: 'none',
                  }}
                >
                  <Camera size={14} />
                  <span>{displayCheckOutSelfieUrl ? 'Mở Máy Ảnh chụp lại' : 'Mở Máy Ảnh Chụp Check-out'}</span>
                </label>
              </div>
            </div>

            <input
              type="text"
              placeholder="Ghi chú kết thúc ca / Kết quả khảo sát trong ngày (tùy chọn)..."
              value={checkOutNotes}
              onChange={(e) => setCheckOutNotes(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.8rem',
                backgroundColor: 'rgb(var(--bg-white))',
                border: '1px solid rgb(var(--border-slate-300))',
                borderRadius: '0.55rem',
                fontSize: '0.8rem',
                color: 'rgb(var(--text-slate-900))',
                outline: 'none',
              }}
            />

            <button
              type="submit"
              disabled={isCheckingOut}
              className={isCheckingOut ? 'disabled:opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              style={{
                width: '100%',
                padding: '0.7rem 1.25rem',
                borderRadius: '0.65rem',
                border: 'none',
                background: isCheckingOut
                  ? 'rgb(var(--bg-slate-200))'
                  : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: isCheckingOut ? 'rgb(var(--text-slate-500))' : '#ffffff',
                fontSize: '0.85rem',
                fontWeight: 800,
                cursor: isCheckingOut ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
                boxShadow: '0 3px 8px rgba(2, 132, 199, 0.25)',
              }}
            >
              <LogOut size={16} />
              <span>{isCheckingOut ? 'Đang gửi Check-out...' : 'Xác Nhận Check-out Kết Thúc Ca'}</span>
            </button>
          </form>
        )}
      </div>

      {/* Section: Cán Bộ Đi Kèm (Co-Surveyor) */}
      <div
        className="card"
        style={{
          backgroundColor: 'rgb(var(--bg-white))',
          border: isCompanionCheckedIn ? '1.5px solid rgb(var(--border-sky-200))' : '1.5px dashed rgb(var(--border-slate-300))',
          borderRadius: '1rem',
          padding: '1.15rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          background: isCompanionCheckedIn ? 'linear-gradient(135deg, rgb(var(--bg-sky-50)) 0%, rgb(var(--bg-sky-100)) 100%)' : 'rgb(var(--bg-slate-50))',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgb(var(--bg-sky-100))',
                color: 'rgb(var(--text-sky-600))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Users size={18} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 800, color: 'rgb(var(--text-sky-700))' }}>
                Cán Bộ Đi Kèm (Tổ 02 người)
              </h4>
              <span style={{ fontSize: '0.7rem', color: 'rgb(var(--text-slate-500))' }}>
                Quy chuẩn tổ khảo sát hiện trường Metro Line 2
              </span>
            </div>
          </div>

          <span
            style={{
              backgroundColor: isCompanionCheckedIn ? 'rgb(var(--bg-green-100))' : 'rgb(var(--bg-amber-100))',
              color: isCompanionCheckedIn ? 'rgb(var(--text-green-700))' : 'rgb(var(--text-amber-700))',
              border: `1px solid ${isCompanionCheckedIn ? 'rgb(var(--border-green-300))' : 'rgb(var(--border-amber-200))'}`,
              borderRadius: '999px',
              padding: '2px 8px',
              fontSize: '0.7rem',
              fontWeight: 700,
            }}
          >
            {isCompanionCheckedIn
              ? companionData?.checkOutTime
                ? `✓ Đã Check-out (${companionData.checkOutTime})`
                : '✓ Đang trong ca (Đã Check-in)'
              : 'Chưa điểm danh'}
          </span>
        </div>

        {isCompanionCheckedIn && companionData ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'rgb(var(--bg-white))', padding: '0.65rem 0.85rem', borderRadius: '0.65rem', border: '1px solid rgb(var(--border-sky-200))' }}>
            {displayCompanionSelfieUrl ? (
              <img
                src={displayCompanionSelfieUrl}
                alt={companionData.name}
                style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgb(var(--border-sky-300))' }}
              />
            ) : (
              <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: 'rgb(var(--bg-sky-100))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgb(var(--text-sky-600))' }}>
                <User size={20} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0, fontSize: '0.775rem' }}>
              <div style={{ fontWeight: 800, color: 'rgb(var(--text-slate-900))' }}>{companionData.name}</div>
              <div style={{ color: 'rgb(var(--text-sky-600))', fontSize: '0.7rem', fontWeight: 600 }}>
                {companionData.role} • Vào: {companionData.time}
                {companionData.checkOutTime ? ` • Ra: ${companionData.checkOutTime}` : ''}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowCompanionModal(true)}
              className="btn btn-secondary btn-sm cursor-pointer"
              style={{
                padding: '0.35rem 0.65rem',
                fontSize: '0.725rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {companionData.checkOutTime ? 'Xem chi tiết' : 'Check-out / Chi tiết'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: 'rgb(var(--text-slate-500))' }}>
              Chưa ghi nhận điểm danh cho cán bộ đi cùng.
            </span>
            <button
              type="button"
              onClick={() => setShowCompanionModal(true)}
              className="cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.45rem 0.95rem',
                fontSize: '0.775rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                boxShadow: '0 2px 5px rgba(2, 132, 199, 0.25)',
              }}
            >
              <UserCheck size={14} />
              <span>Điểm danh cán bộ đi kèm</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
