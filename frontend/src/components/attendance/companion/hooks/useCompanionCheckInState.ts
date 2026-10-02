import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../../context/AuthContext';
import { getZoneCentroid, calculateDistanceMeters } from '../../../../core/utils/metroZoneUtils';
import { CompanionRecord } from '../types';

interface UseCompanionCheckInStateProps {
  isOpen: boolean;
  onSuccess?: (data: any) => void;
}

export const useCompanionCheckInState = ({ isOpen, onSuccess }: UseCompanionCheckInStateProps) => {
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
  const [checkInData, setCheckInData] = useState<CompanionRecord | null>(null);
  const [companionHistory, setCompanionHistory] = useState<CompanionRecord[]>([]);

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
        const defaultHistory: CompanionRecord[] = [
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
        const dataUrl = canvas.toDataURL('image/jpeg', 1.0);
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

      const newRecord: CompanionRecord = {
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

  return {
    targetZone,
    todayStr,
    companionName,
    setCompanionName,
    companionRole,
    setCompanionRole,
    companionPhone,
    setCompanionPhone,
    selfieUrl,
    setSelfieUrl,
    outOfBoundsReason,
    setOutOfBoundsReason,
    cameraActive,
    gpsCoordinates,
    distanceMeters,
    gpsLoading,
    isSubmitting,
    hasCheckedIn,
    setHasCheckedIn,
    changeCount,
    checkInData,
    companionHistory,
    videoRef,
    getLiveGps,
    handleStartCamera,
    handleStopCamera,
    handleCapturePhoto,
    handleSubmit,
  };
};
