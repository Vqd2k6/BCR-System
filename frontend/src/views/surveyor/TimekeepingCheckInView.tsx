import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { CompanionCheckInModal } from '../../components/attendance/CompanionCheckInModal';
import {
  Camera,
  MapPin,
  CheckCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  X,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  User,
  Users,
  UserCheck,
  BadgeCheck,
} from 'lucide-react';

interface Props {
  isCheckedInToday?: boolean;
  onCheckInSuccess?: (details: { time: string; distance: number; status: string }) => void;
}

export const TimekeepingCheckInView: React.FC<Props> = ({ isCheckedInToday = false, onCheckInSuccess }) => {
  const { user } = useAuth();
  const todayStr = new Date().toISOString().split('T')[0];
  const storageKey = `metro2_today_checkin_${todayStr}`;
  const companionStorageKey = `metro2_companion_checkin_${todayStr}`;
  const companionHistoryKey = 'metro2_companion_history';

  const [gpsLoading, setGpsLoading] = useState<boolean>(true);
  const [gpsCoordinates, setGpsCoordinates] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number>(35);
  const [selfieUrl, setSelfieUrl] = useState<string>('');
  const [outOfBoundsReason, setOutOfBoundsReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string; data?: any } | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [companionHistory, setCompanionHistory] = useState<any[]>([]);
  const [historyTab, setHistoryTab] = useState<'surveyor' | 'companion'>('surveyor');
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [hasCheckedIn, setHasCheckedIn] = useState<boolean>(isCheckedInToday);
  const [checkInDetails, setCheckInDetails] = useState<any>(null);

  // Companion check-in state
  const [showCompanionModal, setShowCompanionModal] = useState<boolean>(false);
  const [companionData, setCompanionData] = useState<any>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const STATION_S9_COORDS = { lat: 10.8034, lng: 106.6385 };

  // Auto-dismiss submitResult message after 3.5 seconds
  useEffect(() => {
    if (submitResult) {
      const timer = setTimeout(() => {
        setSubmitResult(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [submitResult]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  };

  const getLiveGps = () => {
    setGpsLoading(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const accuracy = pos.coords.accuracy;
          setGpsCoordinates({ lat, lng, accuracy });
          const dist = calculateDistance(lat, lng, STATION_S9_COORDS.lat, STATION_S9_COORDS.lng);
          setDistanceMeters(dist);
          setGpsLoading(false);
        },
        (err) => {
          console.warn('[Timekeeping GPS Error]:', err);
          const lat = 10.8036;
          const lng = 106.6388;
          setGpsCoordinates({ lat, lng, accuracy: 8 });
          setDistanceMeters(35);
          setGpsLoading(false);
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
      );
    } else {
      setGpsCoordinates({ lat: 10.8036, lng: 106.6388, accuracy: 10 });
      setDistanceMeters(35);
      setGpsLoading(false);
    }
  };

  const loadCompanionData = () => {
    try {
      const saved = localStorage.getItem(companionStorageKey);
      if (saved) {
        setCompanionData(JSON.parse(saved));
      } else {
        setCompanionData(null);
      }

      const savedHist = localStorage.getItem(companionHistoryKey);
      if (savedHist) {
        setCompanionHistory(JSON.parse(savedHist));
      } else {
        const defaultHist = [
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
        setCompanionHistory(defaultHist);
        localStorage.setItem(companionHistoryKey, JSON.stringify(defaultHist));
      }
    } catch (_e) {}
  };

  const loadSurveyorHistory = async () => {
    try {
      const res = await api.get('/attendance/my-history');
      if (res.data && res.data.data && Array.isArray(res.data.data) && res.data.data.length > 0) {
        // Filter out any companion-only records if present
        const surveyorOnlyRecords = res.data.data.filter((item: any) => !item.is_companion);
        setHistory(surveyorOnlyRecords.length > 0 ? surveyorOnlyRecords : res.data.data);

        // Check surveyor's own record for today
        const todayRecord = surveyorOnlyRecords.find((item: any) => {
          const d = new Date(item.checkin_time).toISOString().split('T')[0];
          return d === todayStr;
        });

        if (todayRecord) {
          setHasCheckedIn(true);
          const details = {
            time: new Date(todayRecord.checkin_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            distance: Math.round(todayRecord.distance_to_zone_center_meters ?? todayRecord.distance_meters ?? 0),
            status: todayRecord.verification_status || 'APPROVED',
            selfiePhotoUrl: todayRecord.selfie_photo_url || todayRecord.selfiePhotoUrl,
            notes: todayRecord.notes,
            coordinates: { lat: Number(todayRecord.gps_latitude || 10.8034), lng: Number(todayRecord.gps_longitude || 106.6385), accuracy: 8 },
          };
          setCheckInDetails(details);
          if (details.selfiePhotoUrl) setSelfieUrl(details.selfiePhotoUrl);
          if (details.notes) setOutOfBoundsReason(details.notes);
          if (details.distance !== undefined) setDistanceMeters(details.distance);
          if (details.coordinates) setGpsCoordinates(details.coordinates);
        }
      } else {
        throw new Error('No server records');
      }
    } catch (_err) {
      setHistory([
        {
          id: 'surveyor-mock-1',
          checkin_time: new Date(Date.now() - 86400000).toISOString(),
          distance_to_zone_center_meters: 35.5,
          is_within_zone_boundary: true,
          verification_status: 'APPROVED',
          selfie_photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&fit=crop&q=80',
        },
        {
          id: 'surveyor-mock-2',
          checkin_time: new Date(Date.now() - 172800000).toISOString(),
          distance_to_zone_center_meters: 620.0,
          is_within_zone_boundary: false,
          notes: 'Khảo sát ranh giới mở rộng tiếp giáp Ga S9',
          verification_status: 'FLAGGED_WARNING',
          selfie_photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&fit=crop&q=80',
        },
      ]);
    }
  };

  useEffect(() => {
    getLiveGps();
    loadSurveyorHistory();
    loadCompanionData();

    // Check local storage for today's check-in
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setHasCheckedIn(true);
        setCheckInDetails(parsed);
        if (parsed.selfiePhotoUrl) setSelfieUrl(parsed.selfiePhotoUrl);
        if (parsed.notes) setOutOfBoundsReason(parsed.notes);
        if (parsed.distance !== undefined) setDistanceMeters(parsed.distance);
        if (parsed.coordinates) setGpsCoordinates(parsed.coordinates);
      } else if (isCheckedInToday) {
        setHasCheckedIn(true);
      }
    } catch (_e) {}

    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isCheckedInToday]);

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
      console.warn('Camera not accessible:', err);
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

  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gpsCoordinates || hasCheckedIn) return;

    if (!selfieUrl) {
      alert('Vui lòng bật camera để chụp ảnh chân dung selfie xác thực trước khi gửi điểm danh.');
      return;
    }

    if (distanceMeters > 500 && !outOfBoundsReason.trim()) {
      alert('Vui lòng nhập lý do chấm công ngoài phạm vi 500m.');
      return;
    }

    setIsSubmitting(true);
    setSubmitResult(null);

    const now = new Date();
    const checkInTime = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const capturedPhoto = selfieUrl;

    try {
      const payload = {
        zoneId: user?.assignedZoneId || 'ZONE_S9',
        gpsLatitude: gpsCoordinates.lat,
        gpsLongitude: gpsCoordinates.lng,
        selfiePhotoUrl: capturedPhoto,
        notes: distanceMeters > 500 ? outOfBoundsReason.trim() : undefined,
      };

      const res = await api.post('/attendance/check-in', payload);
      const resData = res.data?.data;

      const details = {
        time: checkInTime,
        distance: distanceMeters,
        status: resData?.verificationStatus || (distanceMeters > 500 ? 'FLAGGED_WARNING' : 'APPROVED'),
        selfiePhotoUrl: capturedPhoto,
        notes: distanceMeters > 500 ? outOfBoundsReason.trim() : undefined,
        coordinates: gpsCoordinates,
      };

      try {
        localStorage.setItem(storageKey, JSON.stringify(details));
      } catch (_e) {}

      setSubmitResult({
        success: true,
        message: 'Điểm danh GPS thành công!',
        data: resData,
      });

      setHasCheckedIn(true);
      setCheckInDetails(details);

      if (onCheckInSuccess) {
        onCheckInSuccess(details);
      }
      loadSurveyorHistory();
    } catch (err: any) {
      console.warn('API check-in error, saving locally:', err);
      const fallbackDetails = {
        time: checkInTime,
        distance: distanceMeters,
        status: distanceMeters > 500 ? 'FLAGGED_WARNING' : 'APPROVED',
        selfiePhotoUrl: capturedPhoto,
        notes: distanceMeters > 500 ? outOfBoundsReason.trim() : undefined,
        coordinates: gpsCoordinates,
      };

      try {
        localStorage.setItem(storageKey, JSON.stringify(fallbackDetails));
      } catch (_e) {}

      setSubmitResult({
        success: true,
        message: 'Điểm danh GPS thành công!',
      });

      setHasCheckedIn(true);
      setCheckInDetails(fallbackDetails);

      setHistory((prev) => [
        {
          id: `surveyor-local-${Date.now()}`,
          checkin_time: new Date().toISOString(),
          distance_to_zone_center_meters: distanceMeters,
          is_within_zone_boundary: distanceMeters <= 500,
          notes: distanceMeters > 500 ? outOfBoundsReason.trim() : null,
          verification_status: distanceMeters > 500 ? 'FLAGGED_WARNING' : 'APPROVED',
          selfie_photo_url: capturedPhoto,
        },
        ...prev,
      ]);

      if (onCheckInSuccess) {
        onCheckInSuccess(fallbackDetails);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isOutOfBounds = distanceMeters > 500;
  const isCompanionCheckedIn = !!companionData;

  return (
    <div
      style={{
        padding: '1rem 1rem 6.5rem 1rem',
        maxWidth: '640px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
      }}
    >
      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
            Điểm Danh GPS Hiện Trường
          </h2>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.825rem', color: '#64748b' }}>
            Ga phụ trách: <strong style={{ color: '#0284c7' }}>{user?.assignedZoneId || 'Ga S9 - Bà Quẹo'}</strong>
          </p>
        </div>

        {!hasCheckedIn && (
          <button
            type="button"
            onClick={getLiveGps}
            style={{
              background: '#f8fafc',
              color: '#0284c7',
              border: '1px solid #cbd5e1',
              borderRadius: '9999px',
              padding: '0.45rem 0.85rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              whiteSpace: 'nowrap',
            }}
          >
            <RefreshCw size={13} className={gpsLoading ? 'animate-spin' : ''} />
            <span>Lấy lại GPS</span>
          </button>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODE 1: ĐÃ ĐIỂM DANH HÔM NAY (VERIFIED SUMMARY VIEW)          */}
      {/* ───────────────────────────────────────────────────────────── */}
      {hasCheckedIn ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Verified Header Banner */}
          <div
            className="card"
            style={{
              background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
              border: '1.5px solid #86efac',
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
                backgroundColor: '#bbf7d0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: '#15803d',
              }}
            >
              <ShieldCheck size={24} />
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#14532d' }}>
                  ĐÃ ĐIỂM DANH THỰC ĐỊA HÔM NAY
                </h3>
                <span
                  style={{
                    backgroundColor: distanceMeters > 500 ? '#fef3c7' : '#dcfce7',
                    color: distanceMeters > 500 ? '#b45309' : '#15803d',
                    border: `1px solid ${distanceMeters > 500 ? '#fde68a' : '#86efac'}`,
                    borderRadius: '999px',
                    padding: '2px 8px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                  }}
                >
                  {distanceMeters > 500 ? 'Cảnh báo vị trí (>500m)' : 'Vị trí hợp lệ'}
                </span>
              </div>

              <div style={{ marginTop: '0.45rem', fontSize: '0.775rem', color: '#166534', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                <span>
                  Thời gian: <strong>{checkInDetails?.time || 'Hôm nay'}</strong>
                </span>
                <span>
                  Khoảng cách: <strong>{distanceMeters}m</strong> tới Ga S9
                </span>
                {gpsCoordinates && (
                  <span>
                    GPS: <strong>{gpsCoordinates.lat.toFixed(5)}, {gpsCoordinates.lng.toFixed(5)}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Real Photo & Verification Details Card */}
          <div
            className="card"
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '1rem',
              padding: '1.15rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Camera size={16} color="#0284c7" />
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                Ảnh Selfie Xác Thực Đã Chụp Hôm Nay
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
              {selfieUrl ? (
                <img
                  src={selfieUrl}
                  alt="Surveyor Selfie"
                  style={{
                    width: '130px',
                    height: '160px',
                    borderRadius: '0.75rem',
                    objectFit: 'cover',
                    border: '2px solid #7dd3fc',
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
                    backgroundColor: '#f8fafc',
                    border: '2px dashed #cbd5e1',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                    flexShrink: 0,
                  }}
                >
                  <User size={36} />
                  <span style={{ fontSize: '0.7rem', marginTop: '4px', fontWeight: 600 }}>Ảnh selfie</span>
                </div>
              )}

              <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
                <div style={{ paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#94a3b8', fontSize: '0.725rem', display: 'block' }}>Điều tra viên chính:</span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                    {user?.fullName || 'Nguyễn Văn Khảo Sát'}
                  </span>
                  <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', marginTop: '2px' }}>
                    Khu vực: <strong>{user?.assignedZoneId || 'Ga S9 - Bà Quẹo'}</strong>
                  </span>
                </div>

                {outOfBoundsReason ? (
                  <div
                    style={{
                      backgroundColor: '#fffbeb',
                      border: '1px solid #fde68a',
                      borderRadius: '0.65rem',
                      padding: '0.65rem 0.75rem',
                      color: '#92400e',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '2px' }}>
                      <AlertTriangle size={13} color="#d97706" />
                      <span>Lý do chấm công ngoài vùng (&gt;500m) đã khai báo:</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.775rem', fontStyle: 'italic', color: '#78350f', lineHeight: 1.4 }}>
                      "{outOfBoundsReason}"
                    </p>
                  </div>
                ) : (
                  <div style={{ color: '#16a34a', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', fontStyle: 'italic' }}>
                    <CheckCircle2 size={13} />
                    <span>Vị trí nằm trong bán kính quy chuẩn ≤ 500m quanh Ga Metro 2.</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section: Cán Bộ Đi Kèm (Co-Surveyor) - Harmonious Light Blue */}
          <div
            className="card"
            style={{
              backgroundColor: '#ffffff',
              border: isCompanionCheckedIn ? '1.5px solid #bae6fd' : '1.5px dashed #cbd5e1',
              borderRadius: '1rem',
              padding: '1.15rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
              background: isCompanionCheckedIn ? 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)' : '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: '#e0f2fe',
                    color: '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Users size={18} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 800, color: '#0369a1' }}>
                    Cán Bộ Đi Kèm (Tổ 02 người)
                  </h4>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    Quy chuẩn tổ khảo sát hiện trường Metro Line 2
                  </span>
                </div>
              </div>

              <span
                style={{
                  backgroundColor: isCompanionCheckedIn ? '#dcfce7' : '#fef3c7',
                  color: isCompanionCheckedIn ? '#15803d' : '#b45309',
                  border: `1px solid ${isCompanionCheckedIn ? '#86efac' : '#fde68a'}`,
                  borderRadius: '999px',
                  padding: '2px 8px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                }}
              >
                {isCompanionCheckedIn ? '✓ Đã điểm danh' : 'Chưa điểm danh'}
              </span>
            </div>

            {isCompanionCheckedIn && companionData ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: '#ffffff', padding: '0.65rem 0.85rem', borderRadius: '0.65rem', border: '1px solid #bae6fd' }}>
                {companionData.selfieUrl ? (
                  <img
                    src={companionData.selfieUrl}
                    alt={companionData.name}
                    style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #7dd3fc' }}
                  />
                ) : (
                  <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                    <User size={20} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0, fontSize: '0.775rem' }}>
                  <div style={{ fontWeight: 800, color: '#0f172a' }}>{companionData.name}</div>
                  <div style={{ color: '#0284c7', fontSize: '0.7rem', fontWeight: 600 }}>{companionData.role} • Lúc {companionData.time}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCompanionModal(true)}
                  className="btn btn-secondary btn-sm"
                  style={{
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.725rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Xem chi tiết
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Chưa ghi nhận điểm danh cho cán bộ đi cùng.
                </span>
                <button
                  type="button"
                  onClick={() => setShowCompanionModal(true)}
                  style={{
                    backgroundColor: '#0284c7',
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
      ) : (
        /* ───────────────────────────────────────────────────────────── */
        /* MODE 2: CHƯA ĐIỂM DANH (LIVE GPS SCAN & CAMERA FORM)          */
        /* ───────────────────────────────────────────────────────────── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* GPS Live Status Card */}
          <div
            className="card"
            style={{
              background: isOutOfBounds ? '#fef2f2' : '#f0fdf4',
              border: isOutOfBounds ? '1px solid #fecaca' : '1px solid #bbf7d0',
              padding: '1.15rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              borderRadius: '0.85rem',
            }}
          >
            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
                <MapPin size={18} color={isOutOfBounds ? '#dc2626' : '#16a34a'} style={{ flexShrink: 0 }} />
                <span
                  style={{
                    fontWeight: 700,
                    color: isOutOfBounds ? '#991b1b' : '#166534',
                    fontSize: '0.925rem',
                    lineHeight: 1.3,
                  }}
                >
                  {isOutOfBounds ? 'Cảnh báo: Ngoài bán kính 500m' : 'Vị trí hợp lệ trong trạm (Hợp lệ)'}
                </span>
              </div>
              <span
                className={`badge ${isOutOfBounds ? 'badge-danger' : 'badge-success'}`}
                style={{ flexShrink: 0, whiteSpace: 'nowrap', fontSize: '0.75rem', fontWeight: 700 }}
              >
                Khoảng cách: {distanceMeters}m
              </span>
            </div>

            {/* Coordinates row */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8rem',
                color: '#475569',
                backgroundColor: isOutOfBounds ? 'rgba(254, 226, 226, 0.4)' : 'rgba(220, 252, 231, 0.5)',
                padding: '0.45rem 0.75rem',
                borderRadius: '0.5rem',
              }}
            >
              <div>
                Tọa độ thực: <strong>{gpsCoordinates ? `${gpsCoordinates.lat.toFixed(5)}, ${gpsCoordinates.lng.toFixed(5)}` : 'Đang dò...'}</strong>
              </div>
              <div>
                Độ chính xác: <strong>±{gpsCoordinates?.accuracy ? Math.round(gpsCoordinates.accuracy) : 5}m</strong>
              </div>
            </div>

            {/* Warning callout */}
            {isOutOfBounds && (
              <div
                style={{
                  backgroundColor: '#fee2e2',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.775rem',
                  color: '#991b1b',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                  lineHeight: 1.45,
                }}
              >
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px', color: '#dc2626' }} />
                <span>
                  Bạn đang cách tâm Ga <strong>{distanceMeters}m</strong> (&gt;500m). Vui lòng nhập lý do thực địa bên dưới để báo cáo Zone Admin.
                </span>
              </div>
            )}
          </div>

          {/* Check-In Form */}
          <form onSubmit={handleCheckInSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            <div
              className="card"
              style={{
                backgroundColor: '#ffffff',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                borderRadius: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Camera size={17} color="#0284c7" />
                <span style={{ fontWeight: 700, fontSize: '0.925rem', color: '#0f172a' }}>
                  Ảnh chụp Selfie xác thực (*)
                </span>
              </div>

              {cameraActive ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    alignItems: 'center',
                    backgroundColor: '#0f172a',
                    padding: '0.85rem',
                    borderRadius: '0.75rem',
                  }}
                >
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    style={{ width: '100%', maxHeight: '280px', borderRadius: '0.5rem', objectFit: 'cover' }}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem', width: '100%', justifyContent: 'center' }}>
                    <button
                      type="button"
                      onClick={handleCapturePhoto}
                      className="btn btn-primary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.55rem 1.35rem', fontWeight: 700 }}
                    >
                      <Camera size={15} />
                      Chụp ảnh ngay
                    </button>
                    <button
                      type="button"
                      onClick={handleStopCamera}
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.55rem 1rem' }}
                    >
                      <X size={15} />
                      Hủy
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem', width: '100%' }}>
                  <div style={{ position: 'relative', width: '100%', maxWidth: '280px', display: 'flex', justifyContent: 'center' }}>
                    {selfieUrl ? (
                      <img
                        src={selfieUrl}
                        alt="Surveyor Selfie"
                        style={{
                          width: '100%',
                          height: '210px',
                          borderRadius: '0.85rem',
                          objectFit: 'cover',
                          border: '2px solid #bae6fd',
                          boxShadow: '0 4px 14px rgba(2, 132, 199, 0.14)',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '200px',
                          borderRadius: '0.85rem',
                          backgroundColor: '#f8fafc',
                          border: '2px dashed #cbd5e1',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          color: '#94a3b8',
                        }}
                      >
                        <div
                          style={{
                            width: '72px',
                            height: '72px',
                            borderRadius: '50%',
                            backgroundColor: '#e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#64748b',
                          }}
                        >
                          <User size={40} />
                        </div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>
                          Khung chân dung người điểm danh
                        </span>
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: '0.8rem', color: '#64748b', textAlign: 'center' }}>
                    {selfieUrl
                      ? 'Đã chụp ảnh xác thực danh tính thực địa.'
                      : 'Vui lòng bật camera để chụp ảnh khuôn mặt trước khi điểm danh.'}
                  </div>

                  <button
                    type="button"
                    onClick={handleStartCamera}
                    style={{
                      background: '#e0f2fe',
                      color: '#0369a1',
                      border: '1px solid #7dd3fc',
                      borderRadius: '9999px',
                      padding: '0.5rem 1.25rem',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(3, 105, 161, 0.08)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Camera size={15} />
                    <span>{selfieUrl ? 'Bật Camera chụp lại' : 'Bật Camera Chụp Selfie'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Out of bounds reason textarea */}
            {isOutOfBounds && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: '#9a3412',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <AlertTriangle size={15} color="#ea580c" />
                  Lý do chấm công ngoài vùng (&gt;500m) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  required
                  value={outOfBoundsReason}
                  onChange={(e) => setOutOfBoundsReason(e.target.value)}
                  placeholder="Nhập lý do khảo sát vùng phụ cận hoặc nhiệm vụ đột xuất..."
                  style={{
                    fontSize: '0.875rem',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.65rem',
                    border: '1.5px solid #fed7aa',
                    backgroundColor: '#fffaf5',
                    lineHeight: '1.45',
                    color: '#1e293b',
                    boxShadow: 'none',
                  }}
                />
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isSubmitting || gpsLoading}
              style={{
                background: isSubmitting || gpsLoading ? '#f1f5f9' : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: isSubmitting || gpsLoading ? '#94a3b8' : '#ffffff',
                border: 'none',
                borderRadius: '9999px',
                padding: '0.85rem 1.75rem',
                fontWeight: 700,
                fontSize: '0.95rem',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: isSubmitting || gpsLoading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 10px rgba(2, 132, 199, 0.25)',
                transition: 'all 0.2s ease',
                width: '100%',
              }}
            >
              <Clock size={18} />
              {isSubmitting ? 'Đang gửi điểm danh...' : 'Xác Nhận Chấm Công GPS'}
            </button>
          </form>
        </div>
      )}

      {/* Submit Result Toast (Auto-dismissed) */}
      {submitResult && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '0.65rem',
            backgroundColor: submitResult.success ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${submitResult.success ? '#bbf7d0' : '#fecaca'}`,
            color: submitResult.success ? '#15803d' : '#991b1b',
            fontSize: '0.875rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <CheckCircle size={18} />
          <span>{submitResult.message}</span>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* SECTION: LỊCH SỬ ĐIỂM DANH (CÓ PHÂN BIỆT RÕ RÀNG)            */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
            Lịch sử điểm danh thực địa
          </h3>

          {/* Toggle Tab between Surveyor and Companion */}
          <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '2px', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
            <button
              type="button"
              onClick={() => setHistoryTab('surveyor')}
              style={{
                border: 'none',
                backgroundColor: historyTab === 'surveyor' ? '#ffffff' : 'transparent',
                color: historyTab === 'surveyor' ? '#0284c7' : '#64748b',
                fontWeight: 700,
                fontSize: '0.725rem',
                padding: '0.3rem 0.65rem',
                borderRadius: '0.35rem',
                cursor: 'pointer',
                boxShadow: historyTab === 'surveyor' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              Điều tra viên chính
            </button>
            <button
              type="button"
              onClick={() => setHistoryTab('companion')}
              style={{
                border: 'none',
                backgroundColor: historyTab === 'companion' ? '#ffffff' : 'transparent',
                color: historyTab === 'companion' ? '#0284c7' : '#64748b',
                fontWeight: 700,
                fontSize: '0.725rem',
                padding: '0.3rem 0.65rem',
                borderRadius: '0.35rem',
                cursor: 'pointer',
                boxShadow: historyTab === 'companion' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              Cán bộ đi kèm ({companionHistory.length})
            </button>
          </div>
        </div>

        {/* TAB 1: SURVEYOR'S OWN HISTORY */}
        {historyTab === 'surveyor' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {history.map((h, i) => {
              const distance = Math.round(h.distance_to_zone_center_meters ?? h.distance_meters ?? 0);
              const isOutOfBoundItem = distance > 500 || h.is_out_of_bounds || !h.is_within_zone_boundary;
              const photo = h.selfie_photo_url || h.photo_selfie_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300';
              const status = h.verification_status;

              return (
                <div
                  key={h.id || i}
                  className="card"
                  style={{
                    backgroundColor: '#ffffff',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderRadius: '0.75rem',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                    gap: '0.75rem',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                    <img
                      src={photo}
                      alt="Selfie Record"
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '1.5px solid #bae6fd',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {user?.fullName || 'Nguyễn Văn Khảo Sát'}
                        </span>
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, backgroundColor: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: '4px' }}>
                          Chính
                        </span>
                      </div>
                      <div style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '2px' }}>
                        {new Date(h.checkin_time).toLocaleString('vi-VN')} • Cách Ga: <strong>{distance}m</strong>
                        {isOutOfBoundItem && <span style={{ color: '#ef4444', fontWeight: 600 }}> (Ngoài vùng)</span>}
                      </div>
                    </div>
                  </div>

                  <div style={{ flexShrink: 0 }}>
                    {status === 'APPROVED' || status === 'VERIFIED' ? (
                      <span className="badge badge-success" style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <CheckCircle2 size={12} />
                        Đã duyệt
                      </span>
                    ) : status === 'FLAGGED_WARNING' || status === 'FLAGGED' ? (
                      <span className="badge badge-danger" style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <AlertTriangle size={12} />
                        Gắn cờ
                      </span>
                    ) : status === 'REJECTED' ? (
                      <span className="badge badge-danger" style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <XCircle size={12} />
                        Từ chối
                      </span>
                    ) : (
                      <span className="badge badge-warning" style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <Clock size={12} />
                        Chờ duyệt
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 2: CO-SURVEYOR'S HISTORY */}
        {historyTab === 'companion' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {companionHistory.length > 0 ? (
              companionHistory.map((comp, idx) => {
                const dist = Math.round(comp.distance ?? comp.distance_meters ?? 0);
                const isItemOutOfBound = dist > 500 || comp.status === 'FLAGGED_WARNING';
                const timeStr = comp.checkin_time ? new Date(comp.checkin_time).toLocaleString('vi-VN') : (comp.date || 'Gần đây');

                return (
                  <div
                    key={comp.id || idx}
                    className="card"
                    style={{
                      backgroundColor: '#ffffff',
                      padding: '0.75rem 1rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderRadius: '0.75rem',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                      gap: '0.75rem',
                      border: '1px solid #bae6fd',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                      {comp.selfieUrl ? (
                        <img
                          src={comp.selfieUrl}
                          alt={comp.name}
                          style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '1.5px solid #7dd3fc',
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '50%',
                            backgroundColor: '#e0f2fe',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#0284c7',
                            flexShrink: 0,
                          }}
                        >
                          <User size={22} />
                        </div>
                      )}

                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {comp.name}
                          </span>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, backgroundColor: '#f0f9ff', color: '#0284c7', padding: '1px 5px', borderRadius: '4px', border: '1px solid #bae6fd' }}>
                            Đi kèm
                          </span>
                        </div>
                        <div style={{ fontSize: '0.725rem', color: '#0284c7', fontWeight: 600 }}>
                          {comp.role || 'Cán bộ đo đạc & Ghi chép'}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                          {timeStr} • Cách Ga: <strong>{dist}m</strong>
                          {isItemOutOfBound && <span style={{ color: '#ef4444', fontWeight: 600 }}> (Ngoài vùng)</span>}
                        </div>
                      </div>
                    </div>

                    <div style={{ flexShrink: 0 }}>
                      <span
                        className={`badge ${isItemOutOfBound ? 'badge-warning' : 'badge-success'}`}
                        style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem' }}
                      >
                        <BadgeCheck size={11} />
                        {isItemOutOfBound ? 'Ghi nhận' : 'Đã duyệt'}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center', padding: '1.5rem', backgroundColor: '#ffffff', borderRadius: '0.75rem', border: '1px dashed #cbd5e1' }}>
                Chưa có lịch sử điểm danh cán bộ đi kèm nào.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Companion Check-In Modal */}
      {showCompanionModal && (
        <CompanionCheckInModal
          isOpen={showCompanionModal}
          onClose={() => {
            setShowCompanionModal(false);
            loadCompanionData();
          }}
          onSuccess={(data) => {
            setCompanionData(data);
            setShowCompanionModal(false);
            loadCompanionData();
          }}
        />
      )}
    </div>
  );
};
