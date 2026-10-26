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
import type { CompanionRecord } from '../types';
import type { AttendanceRecord } from '../../../../views/surveyor/timekeeping/types';

interface UseCompanionCheckInStateProps {
  isOpen: boolean;
  zoneId?: string;
  onSuccess?: (data: CompanionRecord) => void;
}

interface CompanionCheckInApiResponse {
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
  todayCompanionCount?: number;
  message: string;
}

export const useCompanionCheckInState = ({
  isOpen,
  zoneId,
  onSuccess,
}: UseCompanionCheckInStateProps) => {
  const { user } = useAuth();
  const effectiveZoneId = zoneId || user?.assignedZoneId || 'ZONE_09';
  const [targetZone, setTargetZone] = useState<MetroZoneCentroid>(() => getZoneCentroid(effectiveZoneId));

  const todayStr = getVietnamDateString();
  const storageKey = `metro2_companion_checkin_${todayStr}`;
  const changeCountKey = `metro2_companion_checkin_count_${todayStr}`;

  const [companionName, setCompanionName] = useState<string>('');
  const [companionRole, setCompanionRole] = useState<string>('Cán bộ đo đạc & Ghi chép');
  const [companionPhone, setCompanionPhone] = useState<string>('');
  const [selfieUrl, setSelfieUrl] = useState<string>('');
  const [outOfBoundsReason, setOutOfBoundsReason] = useState<string>('');
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [gpsCoordinates, setGpsCoordinates] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number>(0);
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [hasCheckedIn, setHasCheckedIn] = useState<boolean>(false);
  const [changeCount, setChangeCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`metro2_companion_checkin_count_${todayStr}`);
      return saved ? parseInt(saved, 10) : 0;
    } catch (err: unknown) {
      console.error('[useCompanionCheckInState:initCount] Error reading count:', err);
      return 0;
    }
  });
  const [checkInData, setCheckInData] = useState<CompanionRecord | null>(null);
  const [companionHistory, setCompanionHistory] = useState<CompanionRecord[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Đồng bộ tọa độ trọng tâm phân khu từ Backend
  useEffect(() => {
    const defaultCentroid = getZoneCentroid(effectiveZoneId);
    setTargetZone(defaultCentroid);

    if (!isOpen) return;
    let isMounted = true;
    api
      .get(`/attendance/assigned-zone?zoneId=${encodeURIComponent(effectiveZoneId)}`)
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
        console.error('[useCompanionCheckInState:fetchZone] Fallback to local centroid:', err);
      });
    return () => {
      isMounted = false;
    };
  }, [effectiveZoneId, isOpen]);

  // Tính lại khoảng cách khi tọa độ GPS hoặc tâm phân khu thay đổi
  useEffect(() => {
    if (gpsCoordinates) {
      const dist = calculateDistanceMeters(gpsCoordinates.lat, gpsCoordinates.lng, targetZone.lat, targetZone.lng);
      setDistanceMeters(dist);
    }
  }, [targetZone.lat, targetZone.lng, gpsCoordinates]);

  const getLiveGps = useCallback(() => {
    setGpsLoading(true);
    setGpsError(null);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(6));
          const lng = Number(pos.coords.longitude.toFixed(6));
          const accuracy = Math.round(pos.coords.accuracy || 0);
          setGpsCoordinates({ lat, lng, accuracy });
          const dist = calculateDistanceMeters(lat, lng, targetZone.lat, targetZone.lng);
          setDistanceMeters(dist);
          setGpsLoading(false);
        },
        (err) => {
          console.error('[useCompanionCheckInState:getLiveGps] Geolocation error:', err);
          setGpsCoordinates(null);
          setGpsLoading(false);
          setGpsError(
            err.code === 1
              ? 'Trình duyệt bị từ chối quyền định vị GPS. Vui lòng cấp quyền vị trí để điểm danh cán bộ đi kèm.'
              : 'Không thể lấy tín hiệu GPS thực tế. Vui lòng ra khu vực thoáng và bấm "Lấy lại GPS".'
          );
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      setGpsCoordinates(null);
      setGpsLoading(false);
      setGpsError('Thiết bị không hỗ trợ định vị GPS.');
    }
  }, [targetZone.lat, targetZone.lng]);

  const loadCompanionHistory = useCallback(async () => {
    try {
      const res = await api.get<{ data: AttendanceRecord[] }>('/attendance/my-history?isCompanion=true');
      const rawRecords = Array.isArray(res.data?.data) ? res.data.data : [];
      const companionRecords: CompanionRecord[] = rawRecords
        .filter((item) => Boolean(item.is_companion))
        .map((item) => {
          const dt = item.checkin_time ? new Date(item.checkin_time) : new Date();
          const dist = Math.round(Number(item.distance_to_zone_center_meters ?? item.distance_meters ?? 0));
          return {
            id: item.id || `comp-${dt.getTime()}`,
            name: item.companion_name || 'Cán bộ đi kèm',
            role: item.companion_role || 'Cán bộ đo đạc & Ghi chép',
            phone: item.companion_phone || undefined,
            selfieUrl: resolveAttendancePhotoUrl(item.selfie_photo_url || item.selfiePhotoUrl),
            time: dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            date: getVietnamDateString(dt),
            checkin_time: typeof item.checkin_time === 'string' ? item.checkin_time : dt.toISOString(),
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
        });

      setCompanionHistory(companionRecords);

      const todayRecords = companionRecords.filter(
        (rec) => getVietnamDateString(rec.checkin_time || rec.date) === todayStr
      );
      setChangeCount(todayRecords.length);

      try {
        localStorage.setItem(changeCountKey, String(todayRecords.length));
      } catch (storageErr: unknown) {
        console.error('[useCompanionCheckInState:loadCompanionHistory] Failed to save count:', storageErr);
      }

      if (todayRecords.length > 0) {
        const latestToday = todayRecords[0];
        setHasCheckedIn(true);
        setCheckInData(latestToday);
        setCompanionName(latestToday.name || '');
        setCompanionRole(latestToday.role || 'Cán bộ đo đạc & Ghi chép');
        setCompanionPhone(latestToday.phone || '');
        setSelfieUrl(latestToday.selfieUrl || '');
        setOutOfBoundsReason(latestToday.notes || '');
        if (latestToday.distance !== undefined) setDistanceMeters(latestToday.distance);
        try {
          localStorage.setItem(storageKey, JSON.stringify(latestToday));
        } catch (storageErr: unknown) {
          console.error('[useCompanionCheckInState:loadCompanionHistory] Failed to save latest companion:', storageErr);
        }
      } else {
        setHasCheckedIn(false);
        setCheckInData(null);
        setSelfieUrl('');
        setOutOfBoundsReason('');
        try {
          localStorage.removeItem(storageKey);
        } catch (storageErr: unknown) {
          console.error('[useCompanionCheckInState:loadCompanionHistory] Failed to clear companion cache:', storageErr);
        }
      }
    } catch (err: unknown) {
      console.error('[useCompanionCheckInState:loadCompanionHistory] Error fetching companion history:', err);
      setCompanionHistory([]);
    }
  }, [todayStr, changeCountKey, storageKey]);

  useEffect(() => {
    if (isOpen) {
      setSubmitError(null);
      getLiveGps();
      void loadCompanionHistory();
    }

    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen, getLiveGps, loadCompanionHistory]);

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
      console.error('[useCompanionCheckInState:handleStartCamera] Camera error:', err);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (changeCount >= 3) {
      setSubmitError('Đã đạt giới hạn tối đa 3 lần điểm danh / đổi cán bộ đi kèm trong ngày hôm nay.');
      return;
    }

    if (!gpsCoordinates) {
      setSubmitError('Chưa có tọa độ GPS thực tế. Vui lòng bật định vị và bấm "Lấy lại GPS".');
      return;
    }

    if (!companionName.trim()) {
      setSubmitError('Vui lòng nhập họ tên cán bộ đi kèm.');
      return;
    }

    if (!selfieUrl) {
      setSubmitError('Vui lòng bật camera để chụp ảnh chân dung selfie cho cán bộ đi kèm.');
      return;
    }

    if (distanceMeters > 500 && !outOfBoundsReason.trim()) {
      setSubmitError('Vui lòng nhập lý do chấm công ngoài phạm vi 500m.');
      return;
    }

    try {
      setIsSubmitting(true);
      const now = new Date();
      const checkInTime = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

      const payload = {
        zoneId: targetZone.zoneId,
        gpsLatitude: gpsCoordinates.lat,
        gpsLongitude: gpsCoordinates.lng,
        selfiePhotoUrl: selfieUrl,
        notes: distanceMeters > 500 ? outOfBoundsReason.trim() : undefined,
        isCompanion: true,
        companionName: companionName.trim(),
        companionRole,
        companionPhone: companionPhone.trim() || undefined,
      };

      const res = await api.post<{ success: boolean; data: CompanionCheckInApiResponse }>(
        '/attendance/check-in',
        payload
      );
      const resData = res.data?.data;
      const finalDistance =
        typeof resData?.distanceToCenterMeters === 'number'
          ? Math.round(resData.distanceToCenterMeters)
          : distanceMeters;
      const storedPhotoUrl = resolveAttendancePhotoUrl(resData?.selfiePhotoUrl) || selfieUrl;
      const finalStatus =
        resData?.verificationStatus || (finalDistance > 500 ? 'FLAGGED_WARNING' : 'PENDING_VERIFICATION');

      const newRecord: CompanionRecord = {
        id: resData?.checkInId || `comp-${Date.now()}`,
        name: resData?.companionName || companionName.trim(),
        role: resData?.companionRole || companionRole,
        phone: resData?.companionPhone || companionPhone.trim() || undefined,
        selfieUrl: storedPhotoUrl,
        time: checkInTime,
        date: todayStr,
        checkin_time: resData?.checkInTime || now.toISOString(),
        zone_id: resData?.zoneId || targetZone.zoneId,
        distance: finalDistance,
        distance_meters: finalDistance,
        coordinates: gpsCoordinates,
        notes: finalDistance > 500 ? outOfBoundsReason.trim() : undefined,
        status: finalStatus,
      };

      const nextCount = typeof resData?.todayCompanionCount === 'number' ? resData.todayCompanionCount : changeCount + 1;
      setChangeCount(nextCount);

      try {
        localStorage.setItem(storageKey, JSON.stringify(newRecord));
        localStorage.setItem(changeCountKey, String(nextCount));
      } catch (storageErr: unknown) {
        console.error('[useCompanionCheckInState:handleSubmit] Failed to update localStorage:', storageErr);
      }

      setSelfieUrl(storedPhotoUrl);
      setDistanceMeters(finalDistance);
      setHasCheckedIn(true);
      setCheckInData(newRecord);
      setCompanionHistory((prev) => [newRecord, ...prev.filter((item) => item.id !== newRecord.id)]);

      window.dispatchEvent(new CustomEvent('metro2-attendance-updated'));
      if (onSuccess) onSuccess(newRecord);
    } catch (err: unknown) {
      console.error('[useCompanionCheckInState:handleSubmit] Submit companion error:', err);
      setSubmitError(
        getErrorMessage(err, 'Không thể lưu điểm danh cán bộ đi kèm. Vui lòng kiểm tra mạng và thử lại.')
      );
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
    gpsError,
    submitError,
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
