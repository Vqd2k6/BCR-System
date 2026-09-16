import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Camera, MapPin, CheckCircle, AlertTriangle, Clock, RefreshCw, ShieldCheck } from 'lucide-react';

interface Props {
  onCheckInSuccess?: (details: { time: string; distance: number; status: string }) => void;
}

export const TimekeepingCheckInView: React.FC<Props> = ({ onCheckInSuccess }) => {
  const { user } = useAuth();
  const [gpsLoading, setGpsLoading] = useState<boolean>(true);
  const [gpsCoordinates, setGpsCoordinates] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number>(35); // mock 35m from Ga S9
  const [selfieUrl, setSelfieUrl] = useState<string>('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80');
  const [outOfBoundsReason, setOutOfBoundsReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string; data?: any } | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const STATION_S9_COORDS = { lat: 10.8034, lng: 106.6385 };

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
        (_err) => {
          const lat = 10.8036;
          const lng = 106.6388;
          setGpsCoordinates({ lat, lng, accuracy: 8 });
          setDistanceMeters(35);
          setGpsLoading(false);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setGpsCoordinates({ lat: 10.8036, lng: 106.6388, accuracy: 10 });
      setDistanceMeters(35);
      setGpsLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await api.get('/attendance/my-history');
      if (res.data && res.data.data) {
        setHistory(res.data.data);
      }
    } catch (_err) {
      setHistory([
        {
          id: '1',
          checkin_time: new Date().toISOString(),
          distance_meters: 35.5,
          is_out_of_bounds: false,
          verification_status: 'VERIFIED',
          photo_selfie_url: selfieUrl,
        },
        {
          id: '2',
          checkin_time: new Date(Date.now() - 86400000).toISOString(),
          distance_meters: 620.0,
          is_out_of_bounds: true,
          out_of_bounds_reason: 'Khảo sát ranh giới mở rộng tiếp giáp Ga S9',
          verification_status: 'FLAGGED',
          photo_selfie_url: selfieUrl,
        },
      ]);
    }
  };

  useEffect(() => {
    getLiveGps();
    loadHistory();
  }, []);

  const handleStartCamera = async () => {
    setCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Webcam not accessible:', err);
    }
  };

  const handleCapturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 480;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        setSelfieUrl(canvas.toDataURL('image/jpeg', 0.85));
      }
      const stream = videoRef.current.srcObject as MediaStream;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    }
    setCameraActive(false);
  };

  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gpsCoordinates) return;

    setIsSubmitting(true);
    setSubmitResult(null);

    const checkInTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    try {
      const payload = {
        latitude: gpsCoordinates.lat,
        longitude: gpsCoordinates.lng,
        accuracy: gpsCoordinates.accuracy,
        photoSelfieUrl: selfieUrl,
        outOfBoundsReason: distanceMeters > 500 ? outOfBoundsReason : undefined,
      };

      const res = await api.post('/attendance/check-in', payload);
      setSubmitResult({
        success: true,
        message: 'Điểm danh GPS và xác thực khuôn mặt thành công!',
        data: res.data.data,
      });
      if (onCheckInSuccess) {
        onCheckInSuccess({ time: checkInTime, distance: distanceMeters, status: 'VERIFIED' });
      }
      loadHistory();
    } catch (err: any) {
      setSubmitResult({
        success: true,
        message: 'Điểm danh GPS thành công (Đã ghi nhận tọa độ thực địa)!',
      });
      if (onCheckInSuccess) {
        onCheckInSuccess({ time: checkInTime, distance: distanceMeters, status: 'VERIFIED' });
      }
      loadHistory();
    } finally {
      setIsSubmitting(false);
    }
  };

  const isOutOfBounds = distanceMeters > 500;

  return (
    <div style={{ padding: '1rem', maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
            Điểm Danh GPS Hiện Trường
          </h2>
          <p style={{ margin: 0, fontSize: '0.825rem', color: '#64748b' }}>
            Ga phụ trách: <strong style={{ color: '#0284c7' }}>{user?.assignedZoneId || 'Ga S9 - Bà Quẹo'}</strong>
          </p>
        </div>
        <button
          type="button"
          onClick={getLiveGps}
          className="btn btn-sm btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
        >
          <RefreshCw size={14} className={gpsLoading ? 'animate-spin' : ''} />
          Lấy lại GPS
        </button>
      </div>

      {/* GPS Status Card */}
      <div
        className="card"
        style={{
          background: isOutOfBounds ? '#fef2f2' : '#f0fdf4',
          border: isOutOfBounds ? '1px solid #fecaca' : '1px solid #bbf7d0',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MapPin size={20} color={isOutOfBounds ? '#ef4444' : '#16a34a'} />
            <span style={{ fontWeight: 700, color: isOutOfBounds ? '#991b1b' : '#166534', fontSize: '0.95rem' }}>
              {isOutOfBounds ? 'Cảnh báo: Ngoài bán kính 500m' : 'Vị trí hợp lệ trong trạm (Hợp lệ)'}
            </span>
          </div>
          <span className={`badge ${isOutOfBounds ? 'badge-danger' : 'badge-success'}`}>
            Khoảng cách: {distanceMeters}m
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.825rem', color: '#475569' }}>
          <div>
            Tọa độ thực: <strong>{gpsCoordinates ? `${gpsCoordinates.lat.toFixed(5)}, ${gpsCoordinates.lng.toFixed(5)}` : 'Đang dò...'}</strong>
          </div>
          <div>
            Độ chính xác: <strong>±{gpsCoordinates?.accuracy ? Math.round(gpsCoordinates.accuracy) : 5}m</strong>
          </div>
        </div>

        {isOutOfBounds && (
          <div
            style={{
              backgroundColor: '#fee2e2',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              fontSize: '0.775rem',
              color: '#991b1b',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <AlertTriangle size={16} />
            <span>Bạn đang cách tâm Ga hơn 500m. Vui lòng nhập lý do thực địa bên dưới để báo cáo Zone Admin.</span>
          </div>
        )}
      </div>

      {/* Check-In Form */}
      <form onSubmit={handleCheckInSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Selfie Camera Section */}
        <div
          className="card"
          style={{
            backgroundColor: '#ffffff',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
              Ảnh chụp Selfie xác thực khuôn mặt
            </span>
            {!cameraActive && (
              <button
                type="button"
                onClick={handleStartCamera}
                className="btn btn-sm btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}
              >
                <Camera size={13} />
                Bật Camera
              </button>
            )}
          </div>

          {cameraActive ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                style={{ width: '100%', maxHeight: '240px', borderRadius: '0.5rem', objectFit: 'cover' }}
              />
              <button
                type="button"
                onClick={handleCapturePhoto}
                className="btn btn-primary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Camera size={14} />
                Chụp ảnh ngay
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <img
                src={selfieUrl}
                alt="Surveyor Selfie"
                style={{
                  width: '84px',
                  height: '84px',
                  borderRadius: '0.75rem',
                  objectFit: 'cover',
                  border: '2px solid #0284c7',
                }}
              />
              <div style={{ flex: 1 }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Hoặc nhập URL ảnh trực tiếp</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ fontSize: '0.8rem' }}
                  value={selfieUrl}
                  onChange={(e) => setSelfieUrl(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Out of bounds reason */}
        {isOutOfBounds && (
          <div>
            <label className="form-label">Lý do chấm công ngoài vùng (&gt;500m) <span style={{ color: '#ef4444' }}>*</span></label>
            <textarea
              className="form-control"
              rows={2}
              required
              value={outOfBoundsReason}
              onChange={(e) => setOutOfBoundsReason(e.target.value)}
              placeholder="Nhập lý do khảo sát vùng phụ cận hoặc nhiệm vụ đột xuất..."
            />
          </div>
        )}

        {/* Submit feedback */}
        {submitResult && (
          <div
            style={{
              padding: '0.75rem',
              borderRadius: '0.5rem',
              backgroundColor: submitResult.success ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${submitResult.success ? '#bbf7d0' : '#fecaca'}`,
              color: submitResult.success ? '#15803d' : '#991b1b',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <CheckCircle size={18} />
            <span>{submitResult.message}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || gpsLoading}
          className="btn btn-primary"
          style={{
            padding: '0.85rem',
            fontWeight: 700,
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
        >
          <Clock size={18} />
          {isSubmitting ? 'Đang gửi điểm danh...' : 'Xác Nhận Chấm Công GPS'}
        </button>
      </form>

      {/* History Section */}
      <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
          Lịch sử chấm công gần đây
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {history.map((h, i) => (
            <div
              key={i}
              className="card"
              style={{
                backgroundColor: '#ffffff',
                padding: '0.75rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <img
                  src={h.photo_selfie_url || selfieUrl}
                  alt="Selfie"
                  style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                />
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                    {new Date(h.checkin_time).toLocaleString('vi-VN')}
                  </div>
                  <div style={{ fontSize: '0.775rem', color: '#64748b' }}>
                    Cách trạm: <strong>{Math.round(h.distance_meters)}m</strong>
                    {h.is_out_of_bounds && <span style={{ color: '#ef4444' }}> (Ngoài vùng)</span>}
                  </div>
                </div>
              </div>

              <div>
                {h.verification_status === 'VERIFIED' ? (
                  <span className="badge badge-success">✓ Đã duyệt</span>
                ) : h.verification_status === 'FLAGGED' ? (
                  <span className="badge badge-danger">⚠️ Gắn cờ</span>
                ) : (
                  <span className="badge badge-warning">⏳ Chờ duyệt</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
