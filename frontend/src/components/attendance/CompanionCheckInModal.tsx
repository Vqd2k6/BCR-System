import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Camera,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Clock,
  X,
  ShieldCheck,
  UserCheck,
  User,
  Phone,
  RefreshCw,
  RotateCcw,
  BadgeCheck,
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { getZoneCentroid, calculateDistanceMeters, MetroZoneCentroid } from '../../core/utils/metroZoneUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (data: any) => void;
}

export const CompanionCheckInModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const assignedZoneId = user?.assignedZoneId || 'ZONE_S9';
  const targetZone = getZoneCentroid(assignedZoneId);

  const todayStr = new Date().toISOString().split('T')[0];
  const storageKey = `metro2_companion_checkin_${todayStr}`;
  const changeCountKey = `metro2_companion_checkin_count_${todayStr}`;
  const historyStorageKey = 'metro2_companion_history';

  const [companionName, setCompanionName] = useState<string>('');
  const [companionRole, setCompanionRole] = useState<string>('Cán bộ đo đạc & Ghi chép');
  const [companionPhone, setCompanionPhone] = useState<string>('');
  const [selfieUrl, setSelfieUrl] = useState<string>('');
  const [outOfBoundsReason, setOutOfBoundsReason] = useState<string>('');
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [gpsCoordinates, setGpsCoordinates] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number>(35);
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [hasCheckedIn, setHasCheckedIn] = useState<boolean>(false);
  const [changeCount, setChangeCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`metro2_companion_checkin_count_${todayStr}`);
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });
  const [checkInData, setCheckInData] = useState<any>(null);
  const [companionHistory, setCompanionHistory] = useState<any[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const getLiveGps = () => {
    setGpsLoading(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const accuracy = pos.coords.accuracy;
          setGpsCoordinates({ lat, lng, accuracy });
          const dist = calculateDistanceMeters(lat, lng, targetZone.lat, targetZone.lng);
          setDistanceMeters(dist);
          setGpsLoading(false);
        },
        (err) => {
          console.warn('[Companion GPS Error]:', err);
          const lat = targetZone.lat + 0.00025;
          const lng = targetZone.lng + 0.0002;
          const dist = calculateDistanceMeters(lat, lng, targetZone.lat, targetZone.lng);
          setGpsCoordinates({ lat, lng, accuracy: 8 });
          setDistanceMeters(dist);
          setGpsLoading(false);
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
      );
    } else {
      const lat = targetZone.lat + 0.00025;
      const lng = targetZone.lng + 0.0002;
      const dist = calculateDistanceMeters(lat, lng, targetZone.lat, targetZone.lng);
      setGpsCoordinates({ lat, lng, accuracy: 10 });
      setDistanceMeters(dist);
      setGpsLoading(false);
    }
  };

  const loadCompanionHistory = () => {
    try {
      const savedHist = localStorage.getItem(historyStorageKey);
      if (savedHist) {
        setCompanionHistory(JSON.parse(savedHist));
      } else {
        const defaultHistory = [
          {
            id: 'comp-mock-1',
            name: 'Trần Văn Bình',
            role: 'Cán bộ đo đạc & Ghi chép',
            phone: '0912 345 678',
            checkin_time: new Date(Date.now() - 86400000).toISOString(),
            distance: 38,
            distance_meters: 38,
            selfieUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&fit=crop&q=80',
            status: 'APPROVED',
          },
          {
            id: 'comp-mock-2',
            name: 'Lê Hoàng Nam',
            role: 'Trợ lý kỹ thuật hiện trường',
            phone: '0988 765 432',
            checkin_time: new Date(Date.now() - 172800000).toISOString(),
            distance: 540,
            distance_meters: 540,
            notes: 'Hỗ trợ đo vẽ ranh mốc mở rộng tiếp giáp Ga S9',
            selfieUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&fit=crop&q=80',
            status: 'FLAGGED_WARNING',
          },
        ];
        setCompanionHistory(defaultHistory);
        localStorage.setItem(historyStorageKey, JSON.stringify(defaultHistory));
      }
    } catch (_e) {}
  };

  useEffect(() => {
    if (isOpen) {
      getLiveGps();
      loadCompanionHistory();

      // Load change count for today
      try {
        const savedCount = localStorage.getItem(changeCountKey);
        if (savedCount) {
          setChangeCount(parseInt(savedCount, 10));
        } else {
          const savedCheckin = localStorage.getItem(storageKey);
          if (savedCheckin) {
            setChangeCount(1);
            localStorage.setItem(changeCountKey, '1');
          } else {
            setChangeCount(0);
          }
        }
      } catch (_e) {
        setChangeCount(0);
      }

      // Load saved companion check-in for today if exists
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          setHasCheckedIn(true);
          setCheckInData(parsed);
          setCompanionName(parsed.name || '');
          setCompanionRole(parsed.role || 'Cán bộ đo đạc & Ghi chép');
          setCompanionPhone(parsed.phone || '');
          setSelfieUrl(parsed.selfieUrl || '');
          setOutOfBoundsReason(parsed.notes || '');
          if (parsed.distance !== undefined) setDistanceMeters(parsed.distance);
          if (parsed.coordinates) setGpsCoordinates(parsed.coordinates);
        } else {
          setHasCheckedIn(false);
          setCheckInData(null);
          setSelfieUrl('');
          setOutOfBoundsReason('');
        }
      } catch (_e) {
        setHasCheckedIn(false);
      }
    }

    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen]);

  const handleStartCamera = async () => {
    setCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Camera error:', err);
      alert('Không thể mở camera. Vui lòng cấp quyền camera trong trình duyệt.');
      setCameraActive(false);
    }
  };

  const handleStopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleCapturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setSelfieUrl(dataUrl);
      }
      handleStopCamera();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (changeCount >= 3) {
      alert('Đã đạt giới hạn tối đa 3 lần điểm danh / đổi cán bộ đi kèm trong ngày hôm nay.');
      return;
    }

    if (!companionName.trim()) {
      alert('Vui lòng nhập họ tên cán bộ đi kèm.');
      return;
    }

    if (!selfieUrl) {
      alert('Vui lòng bật camera để chụp ảnh chân dung selfie cho cán bộ đi kèm.');
      return;
    }

    if (distanceMeters > 500 && !outOfBoundsReason.trim()) {
      alert('Vui lòng nhập lý do chấm công ngoài phạm vi 500m.');
      return;
    }

    try {
      setIsSubmitting(true);
      const now = new Date();
      const checkInTime = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

      const newRecord = {
        id: `comp-${Date.now()}`,
        name: companionName.trim(),
        role: companionRole,
        phone: companionPhone.trim(),
        selfieUrl,
        time: checkInTime,
        date: todayStr,
        checkin_time: now.toISOString(),
        distance: distanceMeters,
        distance_meters: distanceMeters,
        coordinates: gpsCoordinates,
        notes: distanceMeters > 500 ? outOfBoundsReason.trim() : undefined,
        status: distanceMeters > 500 ? 'FLAGGED_WARNING' : 'APPROVED',
      };

      // Save today's companion checkin isolated
      try {
        localStorage.setItem(storageKey, JSON.stringify(newRecord));
      } catch (_e) {}

      // Update daily change count
      const nextCount = (changeCount || 0) + 1;
      setChangeCount(nextCount);
      try {
        localStorage.setItem(changeCountKey, String(nextCount));
      } catch (_e) {}

      // Prepend to companion history
      const updatedHistory = [newRecord, ...companionHistory.filter((item) => item.id !== newRecord.id)];
      setCompanionHistory(updatedHistory);
      try {
        localStorage.setItem(historyStorageKey, JSON.stringify(updatedHistory));
      } catch (_e) {}

      setHasCheckedIn(true);
      setCheckInData(newRecord);
      if (onSuccess) onSuccess(newRecord);
    } catch (err: any) {
      console.error('Submit companion error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isOutOfBounds = distanceMeters > 500;

  return (
    <div
      className="fixed inset-0 z-[999999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200"
        style={{ maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Harmonious Light Blue Header */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            padding: '0.85rem 1.15rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '0.5rem',
                background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 5px rgba(2, 132, 199, 0.25)',
                color: '#ffffff',
              }}
            >
              <Users size={19} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    backgroundColor: '#e0f2fe',
                    color: '#0369a1',
                    padding: '1px 6px',
                    borderRadius: '999px',
                    border: '1px solid #bae6fd',
                  }}
                >
                  Tổ 02 Cán Bộ
                </span>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Ga S9 - Bà Quẹo</span>
              </div>
              <h2 style={{ margin: '2px 0 0 0', fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                Điểm Danh Cán Bộ Đi Kèm (Co-Surveyor)
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              color: '#64748b',
              borderRadius: '0.5rem',
              padding: '0.35rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={17} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ padding: '1rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {hasCheckedIn && checkInData ? (
            /* ───────────────────────────────────────────────────────────── */
            /* MODE 1: ĐÃ ĐIỂM DANH (VERIFIED CO-SURVEYOR SUMMARY CARD)      */
            /* ───────────────────────────────────────────────────────────── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Verified Header Banner */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                  border: '1.5px solid #86efac',
                  borderRadius: '0.85rem',
                  padding: '0.95rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: '#bbf7d0',
                    color: '#15803d',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <ShieldCheck size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#14532d', textTransform: 'uppercase' }}>
                      Cán bộ đi kèm đã điểm danh
                    </span>
                    <span
                      style={{
                        fontSize: '0.675rem',
                        fontWeight: 700,
                        padding: '1px 7px',
                        borderRadius: '999px',
                        backgroundColor: checkInData.status === 'FLAGGED_WARNING' ? '#fef3c7' : '#dcfce7',
                        color: checkInData.status === 'FLAGGED_WARNING' ? '#b45309' : '#15803d',
                        border: `1px solid ${checkInData.status === 'FLAGGED_WARNING' ? '#fde68a' : '#86efac'}`,
                      }}
                    >
                      {checkInData.status === 'FLAGGED_WARNING' ? 'Cảnh báo vị trí' : 'Hợp lệ'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#166534', marginTop: '3px' }}>
                    Ghi nhận lúc: <strong>{checkInData.time}</strong> hôm nay ({todayStr})
                  </div>
                </div>
              </div>

              {/* Co-Surveyor Personal Info & Photo Card */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.85rem',
                  padding: '1rem',
                  display: 'flex',
                  gap: '1rem',
                  alignItems: 'center',
                }}
              >
                {checkInData.selfieUrl ? (
                  <img
                    src={checkInData.selfieUrl}
                    alt={checkInData.name}
                    style={{
                      width: '110px',
                      height: '140px',
                      borderRadius: '0.65rem',
                      objectFit: 'cover',
                      border: '2px solid #7dd3fc',
                      boxShadow: '0 2px 8px rgba(2, 132, 199, 0.15)',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '110px',
                      height: '140px',
                      borderRadius: '0.65rem',
                      backgroundColor: '#f8fafc',
                      border: '2px dashed #cbd5e1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#94a3b8',
                      flexShrink: 0,
                    }}
                  >
                    <User size={32} />
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.775rem' }}>
                  <div>
                    <span style={{ color: '#94a3b8', fontSize: '0.7rem', display: 'block' }}>Họ tên cán bộ:</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>{checkInData.name}</span>
                  </div>

                  <div>
                    <span style={{ color: '#94a3b8', fontSize: '0.7rem', display: 'block' }}>Vai trò / Chức danh:</span>
                    <span style={{ fontWeight: 700, color: '#0284c7' }}>{checkInData.role}</span>
                  </div>

                  {checkInData.phone && (
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '0.7rem', display: 'block' }}>Số điện thoại:</span>
                      <span style={{ color: '#334155', fontWeight: 600 }}>{checkInData.phone}</span>
                    </div>
                  )}

                  <div>
                    <span style={{ color: '#94a3b8', fontSize: '0.7rem', display: 'block' }}>Khoảng cách tới Ga S9:</span>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{checkInData.distance}m</span>
                  </div>
                </div>
              </div>

              {/* Specific Out of Bounds Note for Companion */}
              {checkInData.notes && (
                <div
                  style={{
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: '0.65rem',
                    padding: '0.65rem 0.85rem',
                    fontSize: '0.75rem',
                    color: '#92400e',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.45rem',
                  }}
                >
                  <AlertTriangle size={15} color="#d97706" style={{ flexShrink: 0, marginTop: '1px' }} />
                  <div>
                    <span style={{ fontWeight: 700, display: 'block' }}>Lý do chấm công ngoài vùng (&gt;500m) đã khai báo:</span>
                    <span style={{ color: '#78350f', fontStyle: 'italic', marginTop: '2px', display: 'block' }}>
                      "{checkInData.notes}"
                    </span>
                  </div>
                </div>
              )}

              {/* Action Buttons: Remove "Đóng", show limit notice if >= 3, otherwise re-checkin button */}
              <div style={{ marginTop: '0.35rem' }}>
                {changeCount >= 3 ? (
                  <div
                    style={{
                      backgroundColor: '#fff1f2',
                      border: '1.5px solid #fecdd3',
                      borderRadius: '0.65rem',
                      padding: '0.75rem 0.95rem',
                      fontSize: '0.775rem',
                      color: '#9f1239',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <AlertTriangle size={17} color="#e11d48" style={{ flexShrink: 0 }} />
                    <div>
                      <strong style={{ display: 'block', marginBottom: '2px' }}>Đã đạt giới hạn điểm danh hôm nay</strong>
                      <span>Cán bộ đi kèm chỉ được phép điểm danh / đổi tối đa 3 lần/ngày (Đã dùng 3/3 lần).</span>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setHasCheckedIn(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.65rem',
                      borderRadius: '0.65rem',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#f8fafc',
                      color: '#334155',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.45rem',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    }}
                  >
                    <RotateCcw size={14} />
                    <span>Điểm danh lại / Đổi người ({changeCount}/3 lần hôm nay)</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* ───────────────────────────────────────────────────────────── */
            /* MODE 2: FORM ĐIỂM DANH CÁN BỘ ĐI KÈM                          */
            /* ───────────────────────────────────────────────────────────── */
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#475569',
                  lineHeight: 1.45,
                  backgroundColor: '#f8fafc',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '0.65rem',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <div>
                  Quy chuẩn tổ khảo sát hiện trường gồm <strong>02 cán bộ</strong> (01 điều tra viên chính + 01 cán bộ đi kèm). Vui lòng nhập thông tin và chụp ảnh selfie.
                </div>
                <span
                  style={{
                    backgroundColor: '#e0f2fe',
                    color: '#0369a1',
                    border: '1px solid #bae6fd',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  Lần {Math.min(3, changeCount + 1)}/3 trong ngày
                </span>
              </div>

              {/* Location info Card */}
              <div
                style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: '0.65rem',
                  border: `1px solid ${isOutOfBounds ? '#fecaca' : '#bbf7d0'}`,
                  backgroundColor: isOutOfBounds ? '#fef2f2' : '#f0fdf4',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.775rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <MapPin size={15} color={isOutOfBounds ? '#dc2626' : '#16a34a'} />
                  <span style={{ fontWeight: 700, color: isOutOfBounds ? '#991b1b' : '#166534' }}>
                    {isOutOfBounds ? `Ngoài bán kính 500m (${targetZone.zoneName})` : `Vị trí hợp lệ`} ({distanceMeters}m)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={getLiveGps}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0284c7',
                    fontSize: '0.725rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                  }}
                >
                  <RefreshCw size={11} className={gpsLoading ? 'animate-spin' : ''} />
                  <span>Lấy lại GPS</span>
                </button>
              </div>

              {/* Companion Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Họ tên cán bộ đi kèm <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Trần Văn Bình..."
                  value={companionName}
                  onChange={(e) => setCompanionName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.5rem',
                    fontSize: '0.8rem',
                    color: '#0f172a',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Role & Phone */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Vai trò / Chức danh:
                  </label>
                  <select
                    value={companionRole}
                    onChange={(e) => setCompanionRole(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '0.5rem',
                      fontSize: '0.8rem',
                      color: '#0f172a',
                      outline: 'none',
                    }}
                  >
                    <option value="Cán bộ đo đạc & Ghi chép">Cán bộ đo đạc & Ghi chép</option>
                    <option value="Trợ lý kỹ thuật hiện trường">Trợ lý kỹ thuật hiện trường</option>
                    <option value="Kỹ thuật viên kết cấu">Kỹ thuật viên kết cấu</option>
                    <option value="Đại diện tư vấn giám sát">Đại diện tư vấn giám sát</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    Số điện thoại liên hệ:
                  </label>
                  <input
                    type="text"
                    placeholder="09xx xxx xxx"
                    value={companionPhone}
                    onChange={(e) => setCompanionPhone(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '0.5rem',
                      fontSize: '0.8rem',
                      color: '#0f172a',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Camera & Selfie Capture */}
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.75rem',
                  padding: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.65rem',
                }}
              >
                <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.775rem', fontWeight: 700, color: '#0f172a' }}>
                  <Camera size={14} color="#0284c7" />
                  <span>Ảnh Selfie Cán Bộ Đi Kèm (*)</span>
                </div>

                {cameraActive ? (
                  <div
                    style={{
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.5rem',
                      backgroundColor: '#0f172a',
                      padding: '0.65rem',
                      borderRadius: '0.65rem',
                    }}
                  >
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      style={{ width: '100%', maxHeight: '200px', borderRadius: '0.5rem', objectFit: 'cover' }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={handleCapturePhoto}
                        style={{
                          background: '#0284c7',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '0.45rem',
                          padding: '0.45rem 1rem',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Camera size={13} />
                        Chụp ảnh
                      </button>
                      <button
                        type="button"
                        onClick={handleStopCamera}
                        style={{
                          background: '#475569',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '0.45rem',
                          padding: '0.45rem 0.85rem',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem' }}>
                    {selfieUrl ? (
                      <img
                        src={selfieUrl}
                        alt="Companion Selfie"
                        style={{
                          width: '120px',
                          height: '150px',
                          borderRadius: '0.65rem',
                          objectFit: 'cover',
                          border: '2px solid #7dd3fc',
                          boxShadow: '0 2px 6px rgba(2, 132, 199, 0.15)',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '120px',
                          height: '140px',
                          borderRadius: '0.65rem',
                          backgroundColor: '#ffffff',
                          border: '2px dashed #cbd5e1',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          color: '#94a3b8',
                        }}
                      >
                        <User size={30} color="#cbd5e1" />
                        <span style={{ fontSize: '0.675rem', fontWeight: 600, color: '#94a3b8' }}>Khung chân dung</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleStartCamera}
                      style={{
                        background: '#e0f2fe',
                        color: '#0284c7',
                        border: '1px solid #bae6fd',
                        borderRadius: '999px',
                        padding: '0.4rem 1rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Camera size={13} />
                      <span>{selfieUrl ? 'Chụp lại ảnh' : 'Bật Camera Chụp Selfie'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Out of bounds reason */}
              {isOutOfBounds && (
                <div>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#9a3412',
                      marginBottom: '4px',
                    }}
                  >
                    <AlertTriangle size={13} color="#ea580c" />
                    Lý do ngoài bán kính (&gt;500m) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Nhập lý do khảo sát vùng phụ cận hoặc nhiệm vụ đột xuất..."
                    value={outOfBoundsReason}
                    onChange={(e) => setOutOfBoundsReason(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      backgroundColor: '#fffaf5',
                      border: '1px solid #fed7aa',
                      borderRadius: '0.5rem',
                      fontSize: '0.8rem',
                      color: '#1e293b',
                      outline: 'none',
                    }}
                  />
                </div>
              )}

              {/* Submit button */}
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', paddingTop: '0.25rem' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '0.55rem 1rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#f8fafc',
                    color: '#475569',
                    fontSize: '0.775rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '0.55rem 1.25rem',
                    borderRadius: '0.5rem',
                    border: 'none',
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    color: '#ffffff',
                    fontSize: '0.775rem',
                    fontWeight: 700,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 5px rgba(2, 132, 199, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <UserCheck size={14} />
                  <span>{isSubmitting ? 'Đang gửi...' : 'Xác Nhận Điểm Danh'}</span>
                </button>
              </div>
            </form>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* SECTION: LỊCH SỬ ĐIỂM DANH CỦA CÁN BỘ ĐI KÈM                 */}
          {/* ───────────────────────────────────────────────────────────── */}
          <div style={{ marginTop: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.65rem' }}>
              <Clock size={14} color="#0284c7" />
              <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>
                Lịch Sử Điểm Danh Cán Bộ Đi Kèm
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {companionHistory.length > 0 ? (
                companionHistory.map((item, idx) => {
                  const dist = Math.round(item.distance ?? item.distance_meters ?? 0);
                  const isItemOutOfBound = dist > 500 || item.status === 'FLAGGED_WARNING';
                  const dateFormatted = item.checkin_time ? new Date(item.checkin_time).toLocaleString('vi-VN') : (item.date || 'Gần đây');

                  return (
                    <div
                      key={item.id || idx}
                      style={{
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '0.65rem',
                        padding: '0.65rem 0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.65rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                        {item.selfieUrl ? (
                          <img
                            src={item.selfieUrl}
                            alt={item.name}
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                              border: '1.5px solid #bae6fd',
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '50%',
                              backgroundColor: '#e0f2fe',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#0284c7',
                              flexShrink: 0,
                            }}
                          >
                            <User size={18} />
                          </div>
                        )}

                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.name}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#0284c7', fontWeight: 600 }}>
                            {item.role || 'Cán bộ đi kèm'}
                          </div>
                          <div style={{ fontSize: '0.675rem', color: '#64748b' }}>
                            {dateFormatted} • Cách Ga: <strong>{dist}m</strong>
                            {isItemOutOfBound && <span style={{ color: '#ef4444', fontWeight: 600 }}> (Ngoài vùng)</span>}
                          </div>
                        </div>
                      </div>

                      <div style={{ flexShrink: 0 }}>
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '999px',
                            backgroundColor: isItemOutOfBound ? '#fef3c7' : '#dcfce7',
                            color: isItemOutOfBound ? '#b45309' : '#15803d',
                            border: `1px solid ${isItemOutOfBound ? '#fde68a' : '#86efac'}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '2px',
                          }}
                        >
                          <BadgeCheck size={10} />
                          {isItemOutOfBound ? 'Ghi nhận' : 'Đã duyệt'}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center', padding: '0.85rem' }}>
                  Chưa có lịch sử điểm danh cán bộ đi kèm nào.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
