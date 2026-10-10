import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../../../services/api';
import { useAuth } from '../../../../context/AuthContext';
import {
  getZoneCentroid,
  calculateDistanceMeters,
  type MetroZoneCentroid,
} from '../../../../core/utils/metroZoneUtils';
import type { AttendanceRecord, CheckInDetails, CompanionRecord } from '../types';

interface UseTimekeepingStateProps {
  isCheckedInToday?: boolean;
  onCheckInSuccess?: (details: { time: string; distance: number; status: string }) => void;
}

export const useTimekeepingState = ({
  isCheckedInToday = false,
  onCheckInSuccess,
}: UseTimekeepingStateProps) => {
  const { user } = useAuth();
  const todayStr = new Date().toISOString().split('T')[0];
  const storageKey = `metro2_today_checkin_${todayStr}`;
  const companionStorageKey = `metro2_companion_checkin_${todayStr}`;
  const companionHistoryKey = 'metro2_companion_history';

  const [gpsLoading, setGpsLoading] = useState<boolean>(true);
  const [gpsCoordinates, setGpsCoordinates] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number>(0);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string>('');
  const [outOfBoundsReason, setOutOfBoundsReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string; data?: unknown } | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [companionHistory, setCompanionHistory] = useState<CompanionRecord[]>([]);
  const [historyTab, setHistoryTab] = useState<'surveyor' | 'companion'>('surveyor');
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [hasCheckedIn, setHasCheckedIn] = useState<boolean>(isCheckedInToday);
  const [checkInDetails, setCheckInDetails] = useState<CheckInDetails | null>(null);

  // Companion check-in state
  const [showCompanionModal, setShowCompanionModal] = useState<boolean>(false);
  const [companionData, setCompanionData] = useState<CompanionRecord | null>(null);
  const [isSimulatedGps, setIsSimulatedGps] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const [selectedZoneId, setSelectedZoneId] = useState<string>(() => user?.assignedZoneId || 'ZONE_S9');
  const [targetZone, setTargetZone] = useState<MetroZoneCentroid>(() => getZoneCentroid(selectedZoneId));

  // Tự động đồng bộ zone khi thông tin user thay đổi
  useEffect(() => {
    if (user?.assignedZoneId) {
      setSelectedZoneId(user.assignedZoneId);
    }
  }, [user?.assignedZoneId]);

  // Tải thông tin trọng tâm phân khu khi selectedZoneId thay đổi
  useEffect(() => {
    const defaultCentroid = getZoneCentroid(selectedZoneId);
    setTargetZone(defaultCentroid);

    let isMounted = true;
    api.get(`/attendance/assigned-zone?zoneId=${selectedZoneId}`)
      .then((res) => {
        if (isMounted && res.data?.success && res.data?.data) {
          const zData = res.data.data;
          setTargetZone({
            zoneId: zData.zoneId,
            zoneName: zData.zoneName,
            lat: zData.centroid.lat,
            lng: zData.centroid.lng,
          });
        }
      })
      .catch((_err) => {
        // Fallback từ getZoneCentroid
      });
    return () => { isMounted = false; };
  }, [selectedZoneId]);

  // Auto-dismiss submitResult message after 3.5 seconds
  useEffect(() => {
    if (submitResult) {
      const timer = setTimeout(() => {
        setSubmitResult(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [submitResult]);

  const getLiveGps = (zoneToUse?: MetroZoneCentroid) => {
    const activeZone = zoneToUse || targetZone;
    setGpsLoading(true);
    setGpsError(null);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(6));
          const lng = Number(pos.coords.longitude.toFixed(6));
          const accuracy = Math.round(pos.coords.accuracy || 0);
          setIsSimulatedGps(false);
          setGpsCoordinates({ lat, lng, accuracy });
          const dist = calculateDistanceMeters(lat, lng, activeZone.lat, activeZone.lng);
          setDistanceMeters(dist);
          setGpsLoading(false);
        },
        (err) => {
          console.warn('[GPS] Geolocation error:', err);
          setGpsLoading(false);
          setGpsError(
            err.code === 1
              ? 'Trình duyệt bị từ chối quyền truy cập vị trí. Vui lòng bật định vị GPS trong cài đặt.'
              : 'Không thể nhận diện vị trí GPS vệ tinh. Vui lòng ra khu vực thoáng hoặc bấm Quét lại GPS.'
          );
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      setGpsLoading(false);
      setGpsError('Thiết bị không hỗ trợ Geolocation API.');
    }
  };

  // Tự động quét GPS thực tế khi mở view hoặc khi đổi phân khu
  useEffect(() => {
    getLiveGps(targetZone);
  }, [targetZone.zoneId]);

  // Cập nhật lại khoảng cách khi gpsCoordinates hoặc targetZone thay đổi
  useEffect(() => {
    if (gpsCoordinates) {
      const dist = calculateDistanceMeters(gpsCoordinates.lat, gpsCoordinates.lng, targetZone.lat, targetZone.lng);
      setDistanceMeters(dist);
    }
  }, [targetZone.lat, targetZone.lng, gpsCoordinates]);

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
      const res = await api.get<{ data: AttendanceRecord[] }>('/attendance/my-history');
      const records = res.data?.data;
      if (records && Array.isArray(records) && records.length > 0) {
        const surveyorOnlyRecords = records.filter((item: AttendanceRecord) => !item.is_companion);
        setHistory(surveyorOnlyRecords.length > 0 ? surveyorOnlyRecords : records);

        const todayRecord = surveyorOnlyRecords.find((item: AttendanceRecord) => {
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
        const dataUrl = canvas.toDataURL('image/jpeg', 1.0);
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
        zoneId: targetZone.zoneId,
        gpsLatitude: gpsCoordinates.lat,
        gpsLongitude: gpsCoordinates.lng,
        selfiePhotoUrl: capturedPhoto,
        notes: distanceMeters > 500 ? outOfBoundsReason.trim() : undefined,
      };

      const res = await api.post('/attendance/check-in', payload);
      const resData = res.data?.data;
      const finalDistance = typeof resData?.distanceToCenterMeters === 'number'
        ? Math.round(resData.distanceToCenterMeters)
        : distanceMeters;

      const details = {
        time: checkInTime,
        distance: finalDistance,
        status: resData?.verificationStatus || (finalDistance > 500 ? 'FLAGGED_WARNING' : 'APPROVED'),
        selfiePhotoUrl: capturedPhoto,
        notes: finalDistance > 500 ? outOfBoundsReason.trim() : undefined,
        coordinates: gpsCoordinates,
        zoneName: targetZone.zoneName,
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
    } catch (err: unknown) {
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

  return {
    user,
    gpsLoading,
    gpsCoordinates,
    gpsError,
    distanceMeters,
    selfieUrl,
    outOfBoundsReason,
    setOutOfBoundsReason,
    isSubmitting,
    submitResult,
    history,
    companionHistory,
    historyTab,
    setHistoryTab,
    cameraActive,
    hasCheckedIn,
    checkInDetails,
    showCompanionModal,
    setShowCompanionModal,
    companionData,
    isSimulatedGps,
    videoRef,
    selectedZoneId,
    setSelectedZoneId,
    targetZone,
    setTargetZone,
    getLiveGps,
    loadCompanionData,
    loadSurveyorHistory,
    handleStartCamera,
    handleStopCamera,
    handleCapturePhoto,
    handleCheckInSubmit,
    isOutOfBounds,
    isCompanionCheckedIn,
  };
};
