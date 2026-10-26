import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../../../services/api';
import { useAuth } from '../../../../context/AuthContext';
import { getErrorMessage } from '../../../../utils/errorUtils';
import {
  getZoneCentroid,
  calculateDistanceMeters,
  getVietnamDateString,
  captureVideoFrameAsJpeg,
  resolveAttendancePhotoUrl,
  type MetroZoneCentroid,
} from '../../../../core/utils/metroZoneUtils';
import type { AttendanceRecord, CheckInDetails, CompanionRecord } from '../types';

interface UseTimekeepingStateProps {
  isCheckedInToday?: boolean;
  onCheckInSuccess?: (details: { time: string; distance: number; status: string }) => void;
}

interface CheckInApiResponseData {
  checkInId: string;
  checkInTime: string;
  zoneId: string;
  zoneName: string;
  distanceToCenterMeters: number;
  verificationStatus: string;
  hasAnomalyFlag: boolean;
  anomalyReason: string | null;
  selfiePhotoUrl: string | null;
  isCompanion: boolean;
  companionName: string | null;
  companionRole: string | null;
  companionPhone: string | null;
  message: string;
}

export const useTimekeepingState = ({
  isCheckedInToday = false,
  onCheckInSuccess,
}: UseTimekeepingStateProps) => {
  const { user } = useAuth();
  const todayStr = getVietnamDateString();
  const storageKey = `metro2_today_checkin_${todayStr}`;
  const companionStorageKey = `metro2_companion_checkin_${todayStr}`;

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

  const [selectedZoneId, setSelectedZoneId] = useState<string>(() => user?.assignedZoneId || 'ZONE_09');
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
    api
      .get(`/attendance/assigned-zone?zoneId=${encodeURIComponent(selectedZoneId)}`)
      .then((res) => {
        if (isMounted && res.data?.success && res.data?.data) {
          const zData = res.data.data as {
            zoneId: string;
            zoneName: string;
            centroid: { lat: number; lng: number };
          };
          setTargetZone({
            zoneId: zData.zoneId,
            zoneName: zData.zoneName,
            lat: Number(zData.centroid.lat),
            lng: Number(zData.centroid.lng),
          });
        }
      })
      .catch((err: unknown) => {
        console.error('[useTimekeepingState:fetchAssignedZone] Fallback to local centroid:', err);
      });
    return () => {
      isMounted = false;
    };
  }, [selectedZoneId]);

  // Auto-dismiss submitResult message after 4.5 seconds
  useEffect(() => {
    if (submitResult) {
      const timer = setTimeout(() => {
        setSubmitResult(null);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [submitResult]);

  const getLiveGps = useCallback(
    (zoneToUse?: MetroZoneCentroid) => {
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
            console.error('[useTimekeepingState:getLiveGps] Geolocation error:', err);
            setGpsLoading(false);
            setGpsError(
              err.code === 1
                ? 'Trình duyệt bị từ chối quyền truy cập vị trí. Vui lòng bật định vị GPS trong cài đặt.'
                : 'Không thể nhận diện vị trí GPS vệ tinh. Vui lòng ra khu vực thoáng hoặc bấm Lấy lại GPS.'
            );
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
      } else {
        setGpsLoading(false);
        setGpsError('Thiết bị không hỗ trợ Geolocation API.');
      }
    },
    [targetZone]
  );

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

  const mapServerRecordToCompanion = (item: AttendanceRecord): CompanionRecord => {
    const checkInDate = item.checkin_time ? new Date(item.checkin_time) : new Date();
    const dist = Math.round(Number(item.distance_to_zone_center_meters ?? item.distance_meters ?? 0));
    return {
      id: item.id || `comp-${checkInDate.getTime()}`,
      name: item.companion_name || 'Cán bộ đi kèm',
      role: item.companion_role || 'Cán bộ đo đạc & Ghi chép',
      phone: item.companion_phone || undefined,
      selfieUrl: resolveAttendancePhotoUrl(item.selfie_photo_url || item.selfiePhotoUrl),
      time: checkInDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      date: getVietnamDateString(checkInDate),
      checkin_time: typeof item.checkin_time === 'string' ? item.checkin_time : checkInDate.toISOString(),
      zone_id: item.zone_id,
      distance: dist,
      distance_meters: dist,
      coordinates:
        item.gps_latitude !== undefined && item.gps_longitude !== undefined
          ? { lat: Number(item.gps_latitude), lng: Number(item.gps_longitude), accuracy: 10 }
          : null,
      notes: item.notes || undefined,
      status: item.verification_status || (dist > 500 ? 'FLAGGED_WARNING' : 'PENDING_VERIFICATION'),
    };
  };

  const loadSurveyorHistory = useCallback(async () => {
    try {
      const res = await api.get<{ data: AttendanceRecord[] }>('/attendance/my-history');
      const records = Array.isArray(res.data?.data) ? res.data.data : [];

      const surveyorOnlyRecords = records
        .filter((item: AttendanceRecord) => !item.is_companion)
        .map((item: AttendanceRecord) => ({
          ...item,
          selfie_photo_url: resolveAttendancePhotoUrl(item.selfie_photo_url || item.selfiePhotoUrl),
        }));

      const companionOnlyRecords = records
        .filter((item: AttendanceRecord) => Boolean(item.is_companion))
        .map(mapServerRecordToCompanion);

      setHistory(surveyorOnlyRecords);
      setCompanionHistory(companionOnlyRecords);

      // Đồng bộ trạng thái KSV chính hôm nay theo múi giờ Việt Nam
      const todayRecord = surveyorOnlyRecords.find((item: AttendanceRecord) => {
        return getVietnamDateString(item.checkin_time) === todayStr;
      });

      if (todayRecord) {
        setHasCheckedIn(true);
        const resolvedPhoto = resolveAttendancePhotoUrl(todayRecord.selfie_photo_url || todayRecord.selfiePhotoUrl);
        const details: CheckInDetails = {
          time: new Date(todayRecord.checkin_time).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          distance: Math.round(Number(todayRecord.distance_to_zone_center_meters ?? todayRecord.distance_meters ?? 0)),
          status: todayRecord.verification_status || 'PENDING_VERIFICATION',
          selfiePhotoUrl: resolvedPhoto,
          notes: todayRecord.notes,
          coordinates:
            todayRecord.gps_latitude !== undefined && todayRecord.gps_longitude !== undefined
              ? {
                  lat: Number(todayRecord.gps_latitude),
                  lng: Number(todayRecord.gps_longitude),
                  accuracy: 8,
                }
              : undefined,
        };
        setCheckInDetails(details);
        if (details.selfiePhotoUrl) setSelfieUrl(details.selfiePhotoUrl);
        if (details.notes) setOutOfBoundsReason(details.notes);
        if (details.distance !== undefined) setDistanceMeters(details.distance);
        if (details.coordinates) setGpsCoordinates(details.coordinates);

        try {
          localStorage.setItem(storageKey, JSON.stringify(details));
        } catch (storageErr: unknown) {
          console.error('[useTimekeepingState:loadSurveyorHistory] LocalStorage write failed:', storageErr);
        }
      } else {
        setHasCheckedIn(false);
        setCheckInDetails(null);
        try {
          localStorage.removeItem(storageKey);
        } catch (storageErr: unknown) {
          console.error('[useTimekeepingState:loadSurveyorHistory] LocalStorage remove failed:', storageErr);
        }
      }

      // Đồng bộ trạng thái Người đi cùng hôm nay
      const todayCompanions = companionOnlyRecords.filter(
        (c) => getVietnamDateString(c.checkin_time || c.date) === todayStr
      );
      if (todayCompanions.length > 0) {
        const latestCompanion = todayCompanions[0];
        setCompanionData(latestCompanion);
        try {
          localStorage.setItem(companionStorageKey, JSON.stringify(latestCompanion));
          localStorage.setItem(`metro2_companion_checkin_count_${todayStr}`, String(todayCompanions.length));
        } catch (storageErr: unknown) {
          console.error('[useTimekeepingState:loadSurveyorHistory] Companion localStorage write failed:', storageErr);
        }
      } else {
        setCompanionData(null);
        try {
          localStorage.removeItem(companionStorageKey);
          localStorage.setItem(`metro2_companion_checkin_count_${todayStr}`, '0');
        } catch (storageErr: unknown) {
          console.error('[useTimekeepingState:loadSurveyorHistory] Companion localStorage clear failed:', storageErr);
        }
      }

      window.dispatchEvent(new CustomEvent('metro2-attendance-updated'));
    } catch (err: unknown) {
      console.error('[useTimekeepingState:loadSurveyorHistory] Failed to load attendance history from API:', err);
      setHistory([]);
      setCompanionHistory([]);
    }
  }, [todayStr, storageKey, companionStorageKey]);

  const loadCompanionData = useCallback(() => {
    try {
      const saved = localStorage.getItem(companionStorageKey);
      if (saved) {
        setCompanionData(JSON.parse(saved) as CompanionRecord);
      } else {
        setCompanionData(null);
      }
    } catch (err: unknown) {
      console.error('[useTimekeepingState:loadCompanionData] Error reading companion cache:', err);
      setCompanionData(null);
    }
    void loadSurveyorHistory();
  }, [companionStorageKey, loadSurveyorHistory]);

  useEffect(() => {
    getLiveGps();
    void loadSurveyorHistory();

    // Đọc cache tạm thời trong lúc chờ API phản hồi
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as CheckInDetails;
        setHasCheckedIn(true);
        setCheckInDetails(parsed);
        if (parsed.selfiePhotoUrl) setSelfieUrl(resolveAttendancePhotoUrl(parsed.selfiePhotoUrl));
        if (parsed.notes) setOutOfBoundsReason(parsed.notes);
        if (parsed.distance !== undefined) setDistanceMeters(parsed.distance);
        if (parsed.coordinates) setGpsCoordinates(parsed.coordinates);
      } else if (isCheckedInToday) {
        setHasCheckedIn(true);
      }
    } catch (err: unknown) {
      console.error('[useTimekeepingState:init] Error reading cached check-in:', err);
    }

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
    } catch (err: unknown) {
      console.error('[useTimekeepingState:handleStartCamera] Camera not accessible:', err);
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
      const dataUrl = captureVideoFrameAsJpeg(videoRef.current, 720, 0.82);
      if (dataUrl) {
        setSelfieUrl(dataUrl);
      }
      handleStopCamera();
    }
  };

  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasCheckedIn) return;

    if (!gpsCoordinates) {
      setSubmitResult({
        success: false,
        message: 'Chưa thu thập được tọa độ GPS thực địa. Vui lòng bấm "Lấy lại GPS" và cấp quyền vị trí.',
      });
      return;
    }

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
        isCompanion: false,
      };

      const res = await api.post<{ success: boolean; data: CheckInApiResponseData }>('/attendance/check-in', payload);
      const resData = res.data?.data;
      const finalDistance =
        typeof resData?.distanceToCenterMeters === 'number'
          ? Math.round(resData.distanceToCenterMeters)
          : distanceMeters;

      const storedPhotoUrl = resolveAttendancePhotoUrl(resData?.selfiePhotoUrl) || capturedPhoto;
      const finalStatus =
        resData?.verificationStatus || (finalDistance > 500 ? 'FLAGGED_WARNING' : 'PENDING_VERIFICATION');

      const details: CheckInDetails = {
        time: checkInTime,
        distance: finalDistance,
        status: finalStatus,
        selfiePhotoUrl: storedPhotoUrl,
        notes: finalDistance > 500 ? outOfBoundsReason.trim() : undefined,
        coordinates: gpsCoordinates,
        zoneName: resData?.zoneName || targetZone.zoneName,
      };

      try {
        localStorage.setItem(storageKey, JSON.stringify(details));
      } catch (storageErr: unknown) {
        console.error('[useTimekeepingState:handleCheckInSubmit] Failed to cache check-in details:', storageErr);
      }

      setSelfieUrl(storedPhotoUrl);
      setDistanceMeters(finalDistance);
      setHasCheckedIn(true);
      setCheckInDetails(details);

      setSubmitResult({
        success: true,
        message: resData?.message || 'Điểm danh GPS thành công!',
        data: resData,
      });

      if (onCheckInSuccess) {
        onCheckInSuccess({
          time: checkInTime,
          distance: finalDistance,
          status: finalStatus,
        });
      }

      window.dispatchEvent(new CustomEvent('metro2-attendance-updated'));
      await loadSurveyorHistory();
    } catch (err: unknown) {
      console.error('[useTimekeepingState:handleCheckInSubmit] API check-in failed:', err);
      setSubmitResult({
        success: false,
        message: getErrorMessage(
          err,
          'Không thể gửi điểm danh lên máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.'
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isOutOfBounds = distanceMeters > 500;
  const isCompanionCheckedIn = Boolean(companionData);

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
