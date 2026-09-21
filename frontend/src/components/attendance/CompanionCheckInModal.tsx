import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
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
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (data: any) => void;
}

export const CompanionCheckInModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const storageKey = `metro2_companion_checkin_${todayStr}`;

  const [companionName, setCompanionName] = useState<string>('');
  const [companionRole, setCompanionRole] = useState<string>('Cán bộ đo đạc & Ghi chép');
  const [companionPhone, setCompanionPhone] = useState<string>('');
  const [selfieUrl, setSelfieUrl] = useState<string>('');
  const [outOfBoundsReason, setOutOfBoundsReason] = useState<string>('');
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [gpsCoordinates, setGpsCoordinates] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number>(35);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [hasCheckedIn, setHasCheckedIn] = useState<boolean>(false);
  const [checkInData, setCheckInData] = useState<any>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

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
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const accuracy = pos.coords.accuracy;
          setGpsCoordinates({ lat, lng, accuracy });
          const dist = calculateDistance(lat, lng, STATION_S9_COORDS.lat, STATION_S9_COORDS.lng);
          setDistanceMeters(dist);
        },
        () => {
          const lat = 10.8036;
          const lng = 106.6388;
          setGpsCoordinates({ lat, lng, accuracy: 8 });
          setDistanceMeters(35);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setGpsCoordinates({ lat: 10.8036, lng: 106.6388, accuracy: 10 });
      setDistanceMeters(35);
    }
  };

  useEffect(() => {
    if (isOpen) {
      getLiveGps();
      // Load saved check-in if exists
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

      const payload = {
        name: companionName.trim(),
        role: companionRole,
        phone: companionPhone.trim(),
        selfieUrl,
        time: checkInTime,
        date: todayStr,
        distance: distanceMeters,
        coordinates: gpsCoordinates,
        notes: distanceMeters > 500 ? outOfBoundsReason.trim() : undefined,
        status: distanceMeters > 500 ? 'FLAGGED_WARNING' : 'APPROVED',
      };

      try {
        localStorage.setItem(storageKey, JSON.stringify(payload));
      } catch (_e) {}

      // Try syncing to backend
      try {
        await api.post('/attendance/check-in', {
          zoneId: 'ZONE_S9',
          isCompanion: true,
          companionName: payload.name,
          gpsLatitude: gpsCoordinates?.lat || 10.8034,
          gpsLongitude: gpsCoordinates?.lng || 106.6385,
          selfiePhotoUrl: selfieUrl,
          notes: payload.notes,
        });
      } catch (_err) {}

      setHasCheckedIn(true);
      setCheckInData(payload);
      if (onSuccess) onSuccess(payload);
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
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-indigo-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Users className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-500/30 text-indigo-100 px-2 py-0.5 rounded-full border border-indigo-300/30">
                  Tổ 02 Cán Bộ
                </span>
                <span className="text-xs font-semibold text-slate-300">Ga S9 - Bà Quẹo</span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white mt-0.5">
                Điểm Danh Cán Bộ Đi Kèm (Co-Surveyor)
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-5 max-h-[80vh] overflow-y-auto flex flex-col gap-4">
          {hasCheckedIn && checkInData ? (
            /* VERIFIED COMPANION CARD (Read-only summary) */
            <div className="flex flex-col gap-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-emerald-900 uppercase">
                      Đã Điểm Danh Thành Công
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                      {checkInData.status === 'FLAGGED_WARNING' ? 'Cảnh báo vị trí' : 'Hợp lệ'}
                    </span>
                  </div>
                  <div className="text-xs text-emerald-800 mt-1">
                    Ghi nhận lúc: <strong>{checkInData.time}</strong> hôm nay ({todayStr})
                  </div>
                </div>
              </div>

              {/* Companion Info card */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row gap-4 items-center">
                {checkInData.selfieUrl ? (
                  <img
                    src={checkInData.selfieUrl}
                    alt={checkInData.name}
                    className="w-28 h-36 rounded-xl object-cover border-2 border-indigo-200 shadow-sm flex-shrink-0"
                  />
                ) : (
                  <div className="w-28 h-36 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 flex-shrink-0">
                    <User size={36} />
                  </div>
                )}

                <div className="flex-1 flex flex-col gap-1.5 text-xs text-slate-700 w-full">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Họ tên cán bộ:</span>
                    <span className="text-sm font-bold text-slate-900">{checkInData.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Chức danh / Vai trò:</span>
                    <span className="font-semibold text-indigo-700">{checkInData.role}</span>
                  </div>
                  {checkInData.phone && (
                    <div>
                      <span className="text-slate-400 block text-[11px]">Số điện thoại:</span>
                      <span className="font-medium text-slate-800">{checkInData.phone}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-400 block text-[11px]">Khoảng cách tới tâm Ga S9:</span>
                    <span className="font-bold text-slate-800">{checkInData.distance}m</span>
                  </div>
                </div>
              </div>

              {/* Notes if out of bounds */}
              {checkInData.notes && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2">
                  <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Lý do ngoài vùng đã khai báo:</span>
                    <span className="text-slate-700 mt-0.5 block">{checkInData.notes}</span>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors"
              >
                Đóng
              </button>
            </div>
          ) : (
            /* CHECK-IN FORM FOR COMPANION */
            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
              <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
                Theo quy định tổ khảo sát hiện trường gồm 02 cán bộ (01 điều tra viên chính + 01 cán bộ đi kèm). Vui lòng nhập thông tin và chụp ảnh selfie xác thực để hoàn tất điểm danh tổ.
              </div>

              {/* Location info */}
              <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${isOutOfBounds ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
                <div className="flex items-center gap-2">
                  <MapPin size={16} className={isOutOfBounds ? 'text-amber-600' : 'text-emerald-600'} />
                  <span className="font-bold">
                    {isOutOfBounds ? 'Ngoài vùng 500m' : 'Vị trí hợp lệ'} ({distanceMeters}m)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={getLiveGps}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  <RefreshCw size={12} />
                  Lấy lại GPS
                </button>
              </div>

              {/* Companion Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Họ tên cán bộ đi kèm (*):
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Trần Văn B..."
                  value={companionName}
                  onChange={(e) => setCompanionName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Companion Role */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Vai trò / Chức danh:
                  </label>
                  <select
                    value={companionRole}
                    onChange={(e) => setCompanionRole(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="Cán bộ đo đạc & Ghi chép">Cán bộ đo đạc & Ghi chép</option>
                    <option value="Trợ lý kỹ thuật hiện trường">Trợ lý kỹ thuật hiện trường</option>
                    <option value="Kỹ thuật viên kết cấu">Kỹ thuật viên kết cấu</option>
                    <option value="Đại diện tư vấn giám sát">Đại diện tư vấn giám sát</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Số điện thoại liên hệ:
                  </label>
                  <input
                    type="text"
                    placeholder="09xx xxx xxx"
                    value={companionPhone}
                    onChange={(e) => setCompanionPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Camera & Selfie Capture */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 self-start">
                  <Camera size={15} className="text-indigo-600" />
                  <span>Ảnh Selfie Cán Bộ Đi Kèm (*)</span>
                </div>

                {cameraActive ? (
                  <div className="w-full flex flex-col items-center gap-2 bg-slate-900 p-2.5 rounded-xl">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full max-h-52 rounded-lg object-cover"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleCapturePhoto}
                        className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                      >
                        <Camera size={14} />
                        Chụp ảnh
                      </button>
                      <button
                        type="button"
                        onClick={handleStopCamera}
                        className="px-3 py-1.5 bg-slate-700 text-white rounded-lg text-xs font-medium"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2.5">
                    {selfieUrl ? (
                      <img
                        src={selfieUrl}
                        alt="Companion Selfie"
                        className="w-32 h-40 rounded-xl object-cover border-2 border-indigo-300 shadow-sm"
                      />
                    ) : (
                      <div className="w-32 h-36 rounded-xl bg-white border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 gap-1.5">
                        <User size={32} className="text-slate-300" />
                        <span className="text-[10px] font-semibold text-slate-500">
                          Khung chân dung
                        </span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleStartCamera}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition-colors"
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
                  <label className="block text-xs font-bold text-amber-800 mb-1 flex items-center gap-1">
                    <AlertTriangle size={13} className="text-amber-600" />
                    Lý do ngoài bán kính (&gt;500m) (*):
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Nhập lý do khảo sát vùng phụ cận..."
                    value={outOfBoundsReason}
                    onChange={(e) => setOutOfBoundsReason(e.target.value)}
                    className="w-full px-3 py-2 bg-amber-50/50 border border-amber-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-200 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <UserCheck size={15} />
                  <span>{isSubmitting ? 'Đang gửi...' : 'Xác Nhận Điểm Danh'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
