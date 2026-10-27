import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../../services/api';
import { useAuth } from '../../../../context/AuthContext';
import { getErrorMessage } from '../../../../utils/errorUtils';
import {
  getZoneCentroid,
  calculateDistanceMeters,
  getVietnamDateString,
  compressBlobToJpegDataUrl,
  resolveAttendanceGps,
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

interface CheckOutApiResponseData {
  checkInId: string;
  checkInTime: string;
  checkOutTime: string;
  zoneId: string;
  zoneName: string;
  distanceToCenterMeters: number;
  checkOutDistanceToCenterMeters: number;
  selfiePhotoUrl: string | null;
  checkOutSelfiePhotoUrl: string | null;
  checkOutNotes: string | null;
  workDurationMinutes: number;
  verificationStatus: string;
  isCompanion: boolean;
  companionName: string | null;
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
  const [hasCheckedIn, setHasCheckedIn] = useState<boolean>(isCheckedInToday);
  const [checkInDetails, setCheckInDetails] = useState<CheckInDetails | null>(null);
  const [checkOutSelfieUrl, setCheckOutSelfieUrl] = useState<string>('');
  const [checkOutNotes, setCheckOutNotes] = useState<string>('');
  const [isCheckingOut, setIsCheckingOut] = useState<boolean>(false);

  // Companion check-in state
  const [showCompanionModal, setShowCompanionModal] = useState<boolean>(false);
  const [companionData, setCompanionData] = useState<CompanionRecord | null>(null);

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
    async (zoneToUse?: MetroZoneCentroid) => {
      const activeZone = zoneToUse || targetZone;
      setGpsLoading(true);
      setGpsError(null);
      try {
        const resolved = await resolveAttendanceGps(activeZone);
        setGpsCoordinates({
          lat: resolved.lat,
          lng: resolved.lng,
          accuracy: resolved.accuracy,
        });
        setDistanceMeters(resolved.distanceMeters);
      } catch (err: unknown) {
        console.error('[useTimekeepingState:getLiveGps] Error resolving real GPS:', err);
        setGpsCoordinates(null);
        setGpsError(
          getErrorMessage(
            err,
            'Không thể lấy tọa độ GPS thực tế từ thiết bị. Vui lòng bật quyền Vị trí (Location Services) và thử lại.'
          )
        );
      } finally {
        setGpsLoading(false);
      }
    },
    [targetZone]
  );

  // Tự động quét GPS thực tế khi mở view hoặc khi đổi phân khu + theo dõi thời gian thực (watchPosition)
  useEffect(() => {
    void getLiveGps(targetZone);

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        const accuracy = Math.max(1, Math.round(position.coords.accuracy || 10));
        setGpsCoordinates({ lat, lng, accuracy });
        setGpsError(null);
        setGpsLoading(false);
      },
      (err) => {
        console.error('[useTimekeepingState:watchPosition] Live GPS watch warning:', {
          code: err.code,
          message: err.message,
        });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
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
    const checkOutDate = item.checkout_time ? new Date(item.checkout_time) : null;
    const dist = Math.round(Number(item.distance_to_zone_center_meters ?? item.distance_meters ?? 0));
    const checkOutDist =
      item.checkout_distance_to_zone_center_meters !== null &&
      item.checkout_distance_to_zone_center_meters !== undefined
        ? Math.round(Number(item.checkout_distance_to_zone_center_meters))
        : undefined;
    return {
      id: item.id || `comp-${checkInDate.getTime()}`,
      name: item.companion_name || 'Cán bộ đi kèm',
      role: item.companion_role || 'Cán bộ đo đạc & Ghi chép',
      phone: item.companion_phone || undefined,
      selfieUrl: resolveAttendancePhotoUrl(item.selfie_photo_url || item.selfiePhotoUrl),
      time: checkInDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      date: getVietnamDateString(checkInDate),
      checkin_time: typeof item.checkin_time === 'string' ? item.checkin_time : checkInDate.toISOString(),
      checkout_time: checkOutDate ? checkOutDate.toISOString() : null,
      checkOutTime: checkOutDate
        ? checkOutDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        : undefined,
      checkOutDistance: checkOutDist,
      checkOutSelfieUrl: resolveAttendancePhotoUrl(item.checkout_selfie_photo_url),
      checkOutNotes: item.checkout_notes || undefined,
      workDurationMinutes:
        item.work_duration_minutes !== null && item.work_duration_minutes !== undefined
          ? Number(item.work_duration_minutes)
          : undefined,
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
          checkout_selfie_photo_url: resolveAttendancePhotoUrl(item.checkout_selfie_photo_url),
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
        const resolvedCheckoutPhoto = resolveAttendancePhotoUrl(todayRecord.checkout_selfie_photo_url);
        const checkOutDate = todayRecord.checkout_time ? new Date(todayRecord.checkout_time) : null;
        const details: CheckInDetails = {
          checkInId: todayRecord.id,
          time: new Date(todayRecord.checkin_time).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          checkInIso:
            typeof todayRecord.checkin_time === 'string'
              ? todayRecord.checkin_time
              : new Date(todayRecord.checkin_time).toISOString(),
          checkOutTime: checkOutDate
            ? checkOutDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
            : undefined,
          checkOutIso: checkOutDate ? checkOutDate.toISOString() : undefined,
          checkOutDistance:
            todayRecord.checkout_distance_to_zone_center_meters !== null &&
            todayRecord.checkout_distance_to_zone_center_meters !== undefined
              ? Math.round(Number(todayRecord.checkout_distance_to_zone_center_meters))
              : undefined,
          checkOutSelfiePhotoUrl: resolvedCheckoutPhoto || undefined,
          checkOutNotes: todayRecord.checkout_notes || null,
          workDurationMinutes:
            todayRecord.work_duration_minutes !== null && todayRecord.work_duration_minutes !== undefined
              ? Number(todayRecord.work_duration_minutes)
              : undefined,
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
          checkOutCoordinates:
            todayRecord.checkout_gps_latitude !== null &&
            todayRecord.checkout_gps_latitude !== undefined &&
            todayRecord.checkout_gps_longitude !== null &&
            todayRecord.checkout_gps_longitude !== undefined
              ? {
                  lat: Number(todayRecord.checkout_gps_latitude),
                  lng: Number(todayRecord.checkout_gps_longitude),
                  accuracy: 8,
                }
              : undefined,
        };
        setCheckInDetails(details);
        if (details.selfiePhotoUrl) setSelfieUrl(details.selfiePhotoUrl);
        if (details.checkOutSelfiePhotoUrl) setCheckOutSelfieUrl(details.checkOutSelfiePhotoUrl);
        if (details.checkOutNotes) setCheckOutNotes(details.checkOutNotes);
        if (details.notes) setOutOfBoundsReason(details.notes);

        try {
          localStorage.setItem(storageKey, JSON.stringify(details));
        } catch (storageErr: unknown) {
          console.error('[useTimekeepingState:loadSurveyorHistory] LocalStorage write failed:', storageErr);
        }
      } else {
        setHasCheckedIn(false);
        setCheckInDetails(null);
        setCheckOutSelfieUrl('');
        setCheckOutNotes('');
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
      } else if (isCheckedInToday) {
        setHasCheckedIn(true);
      }
    } catch (err: unknown) {
      console.error('[useTimekeepingState:init] Error reading cached check-in:', err);
    }
  }, [isCheckedInToday]);

  const handleNativeCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressedDataUrl = await compressBlobToJpegDataUrl(file, 720, 0.85);
      if (compressedDataUrl) {
        if (hasCheckedIn) {
          setCheckOutSelfieUrl(compressedDataUrl);
        } else {
          setSelfieUrl(compressedDataUrl);
        }
      }
    } catch (err: unknown) {
      console.error('[useTimekeepingState:handleNativeCameraCapture] Error reading native camera photo:', err);
      setSubmitResult({
        success: false,
        message: 'Không thể xử lý ảnh chụp từ máy ảnh gốc. Vui lòng chụp lại.',
      });
    } finally {
      e.target.value = '';
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
        checkInId: resData?.checkInId,
        time: checkInTime,
        checkInIso: resData?.checkInTime || now.toISOString(),
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

  const handleCheckOutSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!hasCheckedIn || isCheckingOut) return;

    setIsCheckingOut(true);
    setSubmitResult(null);

    try {
      const resolvedGps = gpsCoordinates
        ? { lat: gpsCoordinates.lat, lng: gpsCoordinates.lng, accuracy: gpsCoordinates.accuracy }
        : await resolveAttendanceGps(targetZone);

      const payload = {
        checkInId: checkInDetails?.checkInId || undefined,
        zoneId: targetZone.zoneId,
        gpsLatitude: resolvedGps.lat,
        gpsLongitude: resolvedGps.lng,
        selfiePhotoUrl: checkOutSelfieUrl || undefined,
        notes: checkOutNotes.trim() || undefined,
        isCompanion: false,
      };

      const res = await api.post<{ success: boolean; data: CheckOutApiResponseData }>('/attendance/check-out', payload);
      const resData = res.data?.data;

      const checkOutDate = resData?.checkOutTime ? new Date(resData.checkOutTime) : new Date();
      const checkOutTimeFormatted = checkOutDate.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const storedCheckOutPhoto =
        resolveAttendancePhotoUrl(resData?.checkOutSelfiePhotoUrl) || checkOutSelfieUrl || undefined;
      const finalCheckOutDistance =
        typeof resData?.checkOutDistanceToCenterMeters === 'number'
          ? Math.round(resData.checkOutDistanceToCenterMeters)
          : distanceMeters;

      const updatedDetails: CheckInDetails = {
        ...(checkInDetails || {}),
        checkInId: resData?.checkInId || checkInDetails?.checkInId,
        checkOutTime: checkOutTimeFormatted,
        checkOutIso: checkOutDate.toISOString(),
        checkOutDistance: finalCheckOutDistance,
        checkOutSelfiePhotoUrl: storedCheckOutPhoto,
        checkOutNotes: resData?.checkOutNotes || checkOutNotes.trim() || null,
        workDurationMinutes: resData?.workDurationMinutes ?? 1,
        checkOutCoordinates: resolvedGps,
      };

      setCheckInDetails(updatedDetails);
      if (storedCheckOutPhoto) {
        setCheckOutSelfieUrl(storedCheckOutPhoto);
      }

      try {
        localStorage.setItem(storageKey, JSON.stringify(updatedDetails));
      } catch (storageErr: unknown) {
        console.error('[useTimekeepingState:handleCheckOutSubmit] Failed to cache check-out details:', storageErr);
      }

      setSubmitResult({
        success: true,
        message: resData?.message || 'Đã Check-out kết thúc ca làm việc thực địa thành công!',
        data: resData,
      });

      window.dispatchEvent(new CustomEvent('metro2-attendance-updated'));
      await loadSurveyorHistory();
    } catch (err: unknown) {
      console.error('[useTimekeepingState:handleCheckOutSubmit] API check-out failed:', err);
      setSubmitResult({
        success: false,
        message: getErrorMessage(
          err,
          'Không thể gửi Check-out lên máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.'
        ),
      });
    } finally {
      setIsCheckingOut(false);
    }
  };

  const isOutOfBounds = distanceMeters > 500;
  const isCompanionCheckedIn = Boolean(companionData);
  const hasCheckedOut = Boolean(checkInDetails?.checkOutTime);

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
    hasCheckedIn,
    hasCheckedOut,
    checkInDetails,
    checkOutSelfieUrl,
    setCheckOutSelfieUrl,
    checkOutNotes,
    setCheckOutNotes,
    isCheckingOut,
    showCompanionModal,
    setShowCompanionModal,
    companionData,
    selectedZoneId,
    setSelectedZoneId,
    targetZone,
    setTargetZone,
    getLiveGps,
    loadCompanionData,
    loadSurveyorHistory,
    handleNativeCameraCapture,
    handleCheckInSubmit,
    handleCheckOutSubmit,
    isOutOfBounds,
    isCompanionCheckedIn,
  };
};
