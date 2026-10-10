import { getErrorMessage, getErrorStatus, isNotFoundError } from '@/utils/errorUtils';
import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { api } from './services/api';
import { LoginView } from './views/auth/LoginView';
import { SurveyorNavbar } from './components/layout/SurveyorNavbar';
import {
  SurveyorBottomNav,
  type NavTab,
} from './components/layout/SurveyorBottomNav';
import {
  LeafletSweepMap,
  type GisParcel,
} from './components/gis/LeafletSweepMap';
import { getEffectiveParcelStatus } from './components/gis/sweep-map/utils/sweepMapHelpers';
import { SurveyorHomeView } from './views/surveyor/SurveyorHomeView';
import { TimekeepingCheckInView } from './views/surveyor/TimekeepingCheckInView';
import { SurveyPhase1Page } from './features/survey-phase1/views/SurveyPhase1Page';
import { SurveyCondoMasterPage } from './features/survey-condo-master/views/SurveyCondoMasterPage';
import { SurveyCondoUnitPage } from './features/survey-condo-unit/views/SurveyCondoUnitPage';
import { SurveyPhase2View } from './views/surveyor/SurveyPhase2View';
import { BuildingHubModal, type BuildingUnit } from './components/survey/BuildingHubModal';
import { CompanionCheckInModal } from './components/attendance/CompanionCheckInModal';
import { UnifiedGisMutationModal } from './components/gis/cadastral-editor/UnifiedGisMutationModal';
import { Phase1ExportModuleBox } from './features/zone-management/components/Phase1ExportModuleBox';
import { ZoneManagerDashboardPage } from './features/zone-management/views/ZoneManagerDashboardPage';
import { AdminDashboardPage } from './features/admin-portal/views/AdminDashboardPage';
import { PublicCitizenPortalPage } from './features/guest-portal/views/PublicCitizenPortalPage';
import { GuestDashboardPage } from './features/guest-portal/views/GuestDashboardPage';
import { GuestReportPreviewPage } from './features/guest-portal/views/GuestReportPreviewPage';
import { AdminTopNav } from './components/layout/AdminTopNav';
import { MapPin, Camera } from 'lucide-react';
import {
  getNavigationFromUrl,
  updateNavigationUrl,
  clearSurveyParamsFromUrl,
} from './utils/navigationSync';
import {
  isTabAllowedForRole,
  getDefaultTabForRole,
  sanitizeNavigationForRole,
} from './utils/rbacNavigationGuard';

export const App: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    const nav = getNavigationFromUrl();
    if (nav.tab) return nav.tab;
    return 'home';
  });
  const [showPublicPortal, setShowPublicPortal] = useState<boolean>(false);

  // Khôi phục và chuẩn hóa tab từ URL theo Ma trận Phân quyền RBAC (Role-based Navigation Guard)
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    const currentNav = getNavigationFromUrl();

    // Kiểm tra tính hợp lệ của tham số điều hướng với vai trò hiện tại
    const { safeTab, wasSanitized } = sanitizeNavigationForRole(currentNav, user.role);

    if (wasSanitized) {
      console.warn(
        `[App:RBACGuard] Phát hiện tham số điều hướng không hợp lệ với vai trò [${user.role}]. Đã chuẩn hóa về tab an toàn: [${safeTab}]`
      );
      setActiveTab(safeTab);
      updateNavigationUrl(
        { tab: safeTab, adminTab: undefined, nav: undefined },
        { replace: true }
      );
      return;
    }

    if (currentNav.tab) {
      if (activeTab !== currentNav.tab) {
        setActiveTab(currentNav.tab);
      }
      return;
    }

    // Nếu URL chưa có tab hợp lệ, tự động gán tab mặc định theo vai trò
    const defaultTab = getDefaultTabForRole(user.role);
    setActiveTab(defaultTab);
    updateNavigationUrl({ tab: defaultTab }, { replace: true });
  }, [user?.id, user?.role, isAuthenticated]);

  const [selectedZone, setSelectedZone] = useState<string>(() => {
    const nav = getNavigationFromUrl();
    if (nav.zone) return nav.zone.toUpperCase();
    try {
      const savedZone = localStorage.getItem('metro2_selected_zone');
      if (savedZone) return savedZone.toUpperCase();
    } catch (_e: unknown) {
      console.warn('[App:selectedZone] Lỗi đọc zone đã lưu:', _e);
    }
    return 'ZONE_09';
  });

  // Tự động đồng bộ zone theo khu vực phân công của surveyor (user.assignedZoneId) nếu URL chưa có zone
  useEffect(() => {
    const nav = getNavigationFromUrl();
    if (user?.assignedZoneId && !nav.zone) {
      const normalized = user.assignedZoneId.toUpperCase();
      setSelectedZone(normalized);
      try {
        localStorage.setItem('metro2_selected_zone', normalized);
      } catch (_e: unknown) {
        console.warn('[App:assignedZone] Lỗi lưu zone:', _e);
      }
    }
  }, [user?.assignedZoneId]);

  const handleSelectZone = (newZone: string) => {
    setSelectedZone(newZone);
    updateNavigationUrl({ zone: newZone });
    try {
      localStorage.setItem('metro2_selected_zone', newZone);
    } catch (_e: unknown) {
      console.warn('[App:handleSelectZone] Lỗi lưu zone:', _e);
    }
  };

  const [parcels, setParcels] = useState<GisParcel[]>([]);

  // Khôi phục đồng bộ parcel khảo sát từ sessionStorage nếu vừa reload
  const [selectedParcelForSurvey, setSelectedParcelForSurvey] = useState<GisParcel | null>(() => {
    try {
      const nav = getNavigationFromUrl();
      const targetId = nav.parcelId;
      const savedData = sessionStorage.getItem('metro2_last_active_parcel');
      if (savedData) {
        const parsed = JSON.parse(savedData) as GisParcel;
        if (!targetId || parsed.id === targetId || parsed.projectParcelCode === targetId) {
          return parsed;
        }
      }
    } catch (_e: unknown) {
      console.warn('[App:selectedParcel] Lỗi đọc parcel đã lưu:', _e);
    }
    return null;
  });

  const [selectedUnitForSurvey, setSelectedUnitForSurvey] = useState<BuildingUnit | null>(() => {
    try {
      const nav = getNavigationFromUrl();
      const targetUnitId = nav.unitId;
      const savedUnit = sessionStorage.getItem('metro2_last_active_unit');
      if (savedUnit) {
        const parsed = JSON.parse(savedUnit) as BuildingUnit;
        if (!targetUnitId || parsed.id === targetUnitId) {
          return parsed;
        }
      }
    } catch (_e: unknown) {
      console.warn('[App:selectedUnit] Lỗi đọc unit đã lưu:', _e);
    }
    return null;
  });

  const updateSelectedParcel = (p: GisParcel | null) => {
    setSelectedParcelForSurvey(p);
    try {
      if (p) {
        sessionStorage.setItem('metro2_last_active_parcel', JSON.stringify(p));
      } else {
        sessionStorage.removeItem('metro2_last_active_parcel');
      }
    } catch (_e: unknown) {
      console.warn('[App:updateSelectedParcel] Lỗi cập nhật sessionStorage:', _e);
    }
  };

  const updateSelectedUnit = (u: BuildingUnit | null) => {
    setSelectedUnitForSurvey(u);
    try {
      if (u) {
        sessionStorage.setItem('metro2_last_active_unit', JSON.stringify(u));
      } else {
        sessionStorage.removeItem('metro2_last_active_unit');
      }
    } catch (_e: unknown) {
      console.warn('[App:updateSelectedUnit] Lỗi cập nhật sessionStorage:', _e);
    }
  };

  const [hubParcel, setHubParcel] = useState<GisParcel | null>(null);
  const [mutationStudioParcel, setMutationStudioParcel] = useState<GisParcel | null>(null);
  const [showAttendanceWarningModal, setShowAttendanceWarningModal] = useState<boolean>(false);
  const [showCompanionCheckInModal, setShowCompanionCheckInModal] = useState<boolean>(false);
  const [pendingSurveyFn, setPendingSurveyFn] = useState<(() => void) | null>(null);
  const [isReadOnlySurvey, setIsReadOnlySurvey] = useState<boolean>(() => {
    const nav = getNavigationFromUrl();
    return Boolean(nav.readOnly);
  });
  const [guestViewingReportParcel, setGuestViewingReportParcel] = useState<GisParcel | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlId = params.get('reportParcelId') || params.get('parcelId');
      const savedData = sessionStorage.getItem('metro2_guest_viewing_parcel_data');
      if (savedData) {
        const parsed = JSON.parse(savedData);
        if (!urlId || parsed.id === urlId || parsed.projectParcelCode === urlId) {
          return parsed;
        }
      }
      return null;
    } catch {
      return null;
    }
  });

  // Dynamic Check-In state for surveyor with localStorage persistence (Requirement 5)
  const [isCheckedInToday, setIsCheckedInToday] = useState<boolean>(() => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const saved = localStorage.getItem(`metro2_today_checkin_${todayStr}`);
      return !!saved;
    } catch {
      return false;
    }
  });

  const [checkInDetails, setCheckInDetails] = useState<{ time: string; distance: number; status: string } | null>(() => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const saved = localStorage.getItem(`metro2_today_checkin_${todayStr}`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Tọa độ GPS thực tế của thiết bị (Physical Live GPS)
  const [liveUserGps, setLiveUserGps] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);

  useEffect(() => {
    if (!('geolocation' in navigator)) return;

    // Lấy tọa độ GPS ban đầu với độ chính xác cao
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLiveUserGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        console.warn('[GPS] Initial physical geolocation failed:', err);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );

    // Lắng nghe thay đổi vị trí thực tế liên tục
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setLiveUserGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        console.warn('[GPS] Geolocation watch error:', err);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // ─── Chuẩn hóa dữ liệu thửa đất từ API ────────────────────────────────────
  interface RawParcelData extends Partial<GisParcel> {
    cadastral_geojson?: { coordinates?: [number, number][][] };
    completed_units_count?: number;
  }

  const normalizeParcel = (p: RawParcelData): GisParcel => {
    let coords: [number, number][] = [];

    // Ưu tiên cadastral_geojson (GeoJSON Polygon) từ PostGIS
    if (p.cadastral_geojson?.coordinates?.[0]) {
      // GeoJSON dùng [lng, lat] → Leaflet cần [lat, lng]
      coords = (p.cadastral_geojson.coordinates[0] as [number, number][]).map(
        ([lng, lat]) => [lat, lng] as [number, number]
      );
    } else if (p.coordinates && Array.isArray(p.coordinates) && p.coordinates.length >= 3) {
      // Đã là [lat, lng][] (từ local override nếu có)
      coords = p.coordinates;
    }
    // Không có tọa độ → polygon rỗng, parcel không render

    // Tự động đồng bộ trạng thái nháp dở dang từ LocalStorage / IDB
    let effectiveStatus: GisParcel['surveyStatus'] = p.survey_status || p.surveyStatus || 'NOT_SURVEYED';
    let effectiveBuildingType = p.building_type || p.buildingType || 'STANDALONE';

    let parcelUpdatedAt = p.updated_at || p.updatedAt || null;
    if (p.id) {
      // 1. Chân lý từ Server: nếu server trả về SUBMITTED/APPROVED thì giữ nguyên, dọn dẹp nháp cũ
      if (effectiveStatus === 'SUBMITTED' || effectiveStatus === 'APPROVED' || effectiveStatus === 'PHASE2_COMPLETED' || effectiveStatus === 'APPROVED_PHASE2') {
        try {
          localStorage.removeItem(`metro2_phase1_draft_${p.id}`);
          const overridesStr = localStorage.getItem('metro2_parcel_status_overrides');
          if (overridesStr) {
            const overrides = JSON.parse(overridesStr);
            if (overrides[p.id] && overrides[p.id].status !== effectiveStatus) {
              if (effectiveStatus === 'SUBMITTED') {
                overrides[p.id].status = 'SUBMITTED';
              } else {
                delete overrides[p.id];
              }
              localStorage.setItem('metro2_parcel_status_overrides', JSON.stringify(overrides));
            }
          }
        } catch (_e: unknown) {
          console.warn('[App:normalizeParcel] Lỗi dọn dẹp nháp cũ đã nộp:', _e);
        }
      } else {
        // 2. Chỉ đọc override & nháp khi server CHƯA ghi nhận SUBMITTED/APPROVED
        try {
          const overridesStr = localStorage.getItem('metro2_parcel_status_overrides');
          if (overridesStr) {
            const overrides = JSON.parse(overridesStr);
            if (overrides[p.id]?.status) {
              effectiveStatus = overrides[p.id].status;
            }
            if (overrides[p.id]?.buildingType) {
              effectiveBuildingType = overrides[p.id].buildingType;
            }
            if (overrides[p.id]?.updatedAt) {
              parcelUpdatedAt = overrides[p.id].updatedAt;
            }
          }
        } catch (_e: unknown) {
          console.warn('[App:normalizeParcel] Lỗi đọc overrides trạng thái:', _e);
        }

        if (effectiveStatus !== 'APPROVED' && effectiveStatus !== 'PHASE2_COMPLETED' && effectiveStatus !== 'APPROVED_PHASE2' && effectiveStatus !== 'SUBMITTED') {
          try {
            const draft = localStorage.getItem(`metro2_phase1_draft_${p.id}`);
            if (draft) {
              const parsed = JSON.parse(draft);
              if (parsed.isAbsenteeSurvey || parsed.surveyCaseType === 'ABSENTEE') {
                effectiveStatus = 'POSTPONED_ABSENT';
              } else if (parsed.surveyCaseType === 'UNDER_CONSTRUCTION') {
                effectiveStatus = 'UNDER_CONSTRUCTION';
              } else if (parsed.surveyCaseType === 'VACANT_LAND' || parsed.isVacantLand) {
                effectiveStatus = 'SUBMITTED';
              } else {
                effectiveStatus = 'IN_PROGRESS';
              }
              if (parsed.lastSavedAt || parsed.updatedAt) {
                parcelUpdatedAt = parsed.lastSavedAt || parsed.updatedAt || parcelUpdatedAt;
              }
            }
          } catch (_e: unknown) {
            console.warn('[App:normalizeParcel] Lỗi đọc bản nháp phase1:', _e);
          }
        }
      }
    }

    return {
      id: p.id || '',
      projectParcelCode: p.project_parcel_code || p.projectParcelCode || '',
      officialCadastralCode: p.official_cadastral_code || p.officialCadastralCode || '',
      houseNumber: p.house_number || p.houseNumber || '',
      street: p.street || '',
      ownerName: p.owner_name || p.ownerName || 'Chưa cập nhật',
      surveyStatus: effectiveStatus,
      absenceAttemptCount: p.absence_attempt_count ?? p.absenceAttemptCount ?? 0,
      coordinates: coords,
      adjacentType: p.adjacent_type || p.adjacentType || 'TOWNHOUSE',
      constructionArea: Number(p.construction_area_m2 ?? p.constructionArea ?? 0),
      floorCount: Number(p.floor_count ?? p.floorCount ?? 1),
      landArea: Number(p.land_area_m2 ?? p.landArea ?? 0),
      landCategory: p.land_use_category || p.landCategory,
      landUseName: p.land_use_name_raw || p.landUseName,
      buildingType: effectiveBuildingType,
      totalUnits: Number(p.total_units ?? p.totalUnits ?? 1),
      completedUnits: Number(p.completed_units_count ?? p.completedUnits ?? 0),
      updatedAt: parcelUpdatedAt || undefined,
      assignedSurveyorId: p.assigned_surveyor_id || p.assignedSurveyorId || undefined,
      assignedSurveyorName: p.assigned_surveyor_name || p.assignedSurveyorName || undefined,
      assignedSurveyorCode: p.assigned_surveyor_code || p.assignedSurveyorCode || undefined,
      assignedSurveyorPhone: p.assigned_surveyor_phone || p.assignedSurveyorPhone || undefined,
      zoneId: p.zone_id || p.zoneId || undefined,
    };
  };


  // ─── Load thửa đất theo zone từ API Backend ─────────────────────────────────
  const loadParcels = async () => {
    try {
      console.log(`[Metro2] Loading parcels for zone: ${selectedZone}`);
      const res = await api.get('/parcels/zone-map', { params: { zoneId: selectedZone } });
      if (res.data?.data && Array.isArray(res.data.data) && res.data.data.length > 0) {
        const normalized = res.data.data.map(normalizeParcel);
        const withCoords = normalized.filter((p: GisParcel) => p.coordinates.length >= 3);
        console.log(`[Metro2] Loaded ${withCoords.length}/${res.data.data.length} parcels with valid polygon`);
        setParcels(withCoords);
      } else {
        console.warn('[Metro2] API returned empty parcel list for zone:', selectedZone);
        setParcels([]);
      }
    } catch (err: unknown) {
      console.error('[Metro2] Failed to load parcels:', getErrorMessage(err));
      setParcels([]);
    }
  };

  // Sync attendance history from backend API on mount / authentication
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const syncTodayAttendance = async () => {
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const res = await api.get('/attendance/my-history');
        if (res.data && res.data.data && Array.isArray(res.data.data)) {
          const todayRecord = res.data.data.find((item: { checkin_time: string; distance_to_zone_center_meters?: number; distance_meters?: number; verification_status?: string }) => {
            const itemDate = new Date(item.checkin_time).toISOString().split('T')[0];
            return itemDate === todayStr;
          });

          if (todayRecord) {
            const details = {
              time: new Date(todayRecord.checkin_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
              distance: Math.round(todayRecord.distance_to_zone_center_meters ?? todayRecord.distance_meters ?? 0),
              status: todayRecord.verification_status || 'APPROVED',
            };
            setIsCheckedInToday(true);
            setCheckInDetails(details);
            try {
              localStorage.setItem(`metro2_today_checkin_${todayStr}`, JSON.stringify(details));
            } catch (_e: unknown) {
              console.warn('[App:syncTodayAttendance] Lỗi lưu checkin details vào localStorage:', _e);
            }
          }
        }
      } catch (err: unknown) {
        console.warn('[App:syncTodayAttendance] Sync attendance error:', err);
      }
    };

    syncTodayAttendance();
    loadParcels();
  }, [isAuthenticated, user, selectedZone]);

  // ─── Xử lý điều hướng & duy trì trạng thái Xem Báo Cáo cho GUEST (F5 / Reload Persistence) ───
  const handleOpenGuestReport = (parcel: GisParcel) => {
    setGuestViewingReportParcel(parcel);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('reportParcelId', parcel.id);
      window.history.pushState({ reportParcelId: parcel.id }, '', url.toString());
      sessionStorage.setItem('metro2_guest_viewing_parcel_id', parcel.id);
      sessionStorage.setItem('metro2_guest_viewing_parcel_data', JSON.stringify(parcel));
    } catch (_e: unknown) {
      console.warn('[App:handleOpenGuestReport] Lỗi lưu session guest viewing:', _e);
    }
  };

  const handleBackFromGuestReport = () => {
    setGuestViewingReportParcel(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('reportParcelId');
      url.searchParams.delete('parcelId');
      window.history.pushState(null, '', url.toString());
      sessionStorage.removeItem('metro2_guest_viewing_parcel_id');
      sessionStorage.removeItem('metro2_guest_viewing_parcel_data');
    } catch (_e: unknown) {
      console.warn('[App:handleBackFromGuestReport] Lỗi dọn dẹp URL/session guest viewing:', _e);
    }
  };

  // Khôi phục báo cáo khi reload hoặc mở link trực tiếp có query ?reportParcelId=...
  useEffect(() => {
    if (guestViewingReportParcel) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const urlId = params.get('reportParcelId') || params.get('parcelId') || sessionStorage.getItem('metro2_guest_viewing_parcel_id');
      if (!urlId) return;

      // 1. Tìm trong danh sách parcels hiện có
      if (parcels.length > 0) {
        const found = parcels.find((p) => p.id === urlId || p.projectParcelCode === urlId);
        if (found) {
          handleOpenGuestReport(found);
          return;
        }
      }

      // 2. Nếu chưa có trong parcels (do đang load hoặc khác zone), fetch trực tiếp từ API
      let isCancelled = false;
      api.get(`/parcels/${encodeURIComponent(urlId)}`).then((res) => {
        if (isCancelled) return;
        const raw = res.data?.data || res.data;
        if (raw) {
          const normalized = normalizeParcel(raw);
          handleOpenGuestReport(normalized);
        }
      }).catch((err) => {
        console.warn('[Metro2] Không thể khôi phục thửa đất từ URL sau khi reload:', err);
      });

      return () => {
        isCancelled = true;
      };
    } catch (_e: unknown) {
      console.warn('[App:guestReportSync] Lỗi khôi phục báo cáo khách:', _e);
    }
  }, [parcels, guestViewingReportParcel]);

  // ─── Khôi phục Thửa đất & Căn hộ cho các tab Khảo sát khi reload trực tiếp từ URL ───
  useEffect(() => {
    const nav = getNavigationFromUrl();
    const targetParcelId = nav.parcelId;
    if (!targetParcelId) return;

    if (
      activeTab === 'phase1' ||
      activeTab === 'condo-master' ||
      activeTab === 'condo-unit' ||
      activeTab === 'phase2'
    ) {
      if (selectedParcelForSurvey && (selectedParcelForSurvey.id === targetParcelId || selectedParcelForSurvey.projectParcelCode === targetParcelId)) {
        return;
      }

      // 1. Thử tìm trong parcels hiện có
      if (parcels.length > 0) {
        const found = parcels.find(
          (p) => p.id === targetParcelId || p.projectParcelCode === targetParcelId
        );
        if (found) {
          updateSelectedParcel(found);
          if (nav.unitId && !selectedUnitForSurvey) {
            api.get(`/parcels/${found.id}/units`).then((res) => {
              const units = res.data?.data || res.data || [];
              if (Array.isArray(units)) {
                const u = units.find((item: BuildingUnit) => item.id === nav.unitId);
                if (u) updateSelectedUnit(u);
              }
            }).catch((err: unknown) => {
              console.warn('[App] Lỗi tải unit từ URL:', err);
            });
          }
          return;
        }
      }

      // 2. Fetch trực tiếp từ API nếu chưa có trong parcels
      let isCancelled = false;
      api
        .get(`/parcels/${encodeURIComponent(targetParcelId)}`)
        .then((res) => {
          if (isCancelled) return;
          const raw = res.data?.data || res.data;
          if (raw) {
            const normalized = normalizeParcel(raw);
            updateSelectedParcel(normalized);

            if (nav.unitId) {
              api.get(`/parcels/${normalized.id}/units`).then((uRes) => {
                if (isCancelled) return;
                const units = uRes.data?.data || uRes.data || [];
                if (Array.isArray(units)) {
                  const u = units.find((item: BuildingUnit) => item.id === nav.unitId);
                  if (u) updateSelectedUnit(u);
                }
              }).catch((err: unknown) => {
                console.warn('[App] Lỗi tải unit từ API:', err);
              });
            }
          }
        })
        .catch((err: unknown) => {
          console.warn('[App] Không thể tải thông tin thửa đất từ URL sau reload:', err);
        });

      return () => {
        isCancelled = true;
      };
    }
  }, [activeTab, parcels, selectedParcelForSurvey]);

  // Lắng nghe sự kiện Back / Forward toàn cục của trình duyệt
  useEffect(() => {
    const handlePopState = () => {
      const nav = getNavigationFromUrl();
      if (nav.tab && nav.tab !== activeTab) {
        setActiveTab(nav.tab);
      }
      if (nav.zone && nav.zone !== selectedZone) {
        setSelectedZone(nav.zone);
      }
      if (!nav.parcelId) {
        updateSelectedParcel(null);
        updateSelectedUnit(null);
      }

      // Guest report
      const params = new URLSearchParams(window.location.search);
      const urlId = params.get('reportParcelId') || params.get('parcelId');
      if (!urlId) {
        setGuestViewingReportParcel(null);
        sessionStorage.removeItem('metro2_guest_viewing_parcel_id');
        sessionStorage.removeItem('metro2_guest_viewing_parcel_data');
      } else if (parcels.length > 0) {
        const found = parcels.find((p) => p.id === urlId || p.projectParcelCode === urlId);
        if (found) {
          setGuestViewingReportParcel(found);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTab, selectedZone, parcels]);

  const handleChangeTab = (newTab: NavTab) => {
    if (user && !isTabAllowedForRole(newTab, user.role)) {
      console.warn(`[App:handleChangeTab] Chặn chuyển tab trái phép [${newTab}] cho vai trò [${user.role}]`);
      return;
    }
    setActiveTab(newTab);
    if (newTab === 'home' || newTab === 'map' || newTab === 'attendance' || newTab === 'admin-export') {
      clearSurveyParamsFromUrl();
      updateSelectedParcel(null);
      updateSelectedUnit(null);
    }
    updateNavigationUrl({ tab: newTab });
  };

  // If loading session
  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
        <div style={{ color: '#0284c7', fontWeight: 700 }}>Đang tải hệ thống khảo sát Metro 2...</div>
      </div>
    );
  }

  // If not logged in, render the login page (Hệ thống nội bộ dự án Metro 2)
  if (!isAuthenticated || !user) {
    return <LoginView />;
  }

  // If contractor, render Contractor / Citizen Portal directly
  if (user?.role === 'CONTRACTOR') {
    return <PublicCitizenPortalPage />;
  }

  // If role is GUEST (Chủ Đầu Tư MAUR / Ban Quản Lý ĐSĐT)
  if (user?.role === 'GUEST') {
    // Chế độ Xem Trước Báo Cáo Kỹ Thuật (Full-page View-Only)
    if (guestViewingReportParcel) {
      return (
        <GuestReportPreviewPage
          parcel={guestViewingReportParcel}
          onBack={handleBackFromGuestReport}
        />
      );
    }

    return (
      <GuestDashboardPage
        parcels={parcels}
        selectedZone={selectedZone}
        onSelectZone={handleSelectZone}
        onRefreshParcels={loadParcels}
        onViewReportPreview={handleOpenGuestReport}
      />
    );
  }

  const triggerSurveyWithCheckInGuard = (surveyFn: () => void) => {
    if (!isCheckedInToday) {
      setPendingSurveyFn(() => surveyFn);
      setShowAttendanceWarningModal(true);
    } else {
      surveyFn();
    }
  };

  const handleStartPhase1 = (parcel: GisParcel, readOnly: boolean = false) => {
    // Thửa đất Chung cư bắt buộc quản lý trong Hub, không mở khảo sát lẻ ở ngoài
    if (parcel.buildingType === 'CONDOMINIUM') {
      setHubParcel(parcel);
      return;
    }

    const effectiveStatus = getEffectiveParcelStatus(parcel);
    const isSubmittedOrApproved =
      effectiveStatus === 'SUBMITTED' ||
      effectiveStatus === 'APPROVED' ||
      effectiveStatus === 'PHASE2_COMPLETED' ||
      effectiveStatus === 'APPROVED_PHASE2' ||
      parcel.surveyStatus === 'SUBMITTED' ||
      parcel.surveyStatus === 'APPROVED' ||
      parcel.surveyStatus === 'PHASE2_COMPLETED' ||
      parcel.surveyStatus === 'APPROVED_PHASE2';

    const effectiveReadOnly = Boolean(readOnly || isSubmittedOrApproved);
    setIsReadOnlySurvey(effectiveReadOnly);
    triggerSurveyWithCheckInGuard(() => {
      updateSelectedParcel(parcel);
      updateSelectedUnit(null);
      setActiveTab('phase1');
      updateNavigationUrl({
        tab: 'phase1',
        parcelId: parcel.id,
        unitId: undefined,
        readOnly: effectiveReadOnly,
      }, { replace: false });
    });
  };

  const handleStartCondoMaster = (parcel: GisParcel, readOnly?: boolean) => {
    triggerSurveyWithCheckInGuard(() => {
      const isSubmitted =
        parcel.surveyStatus === 'SUBMITTED' ||
        parcel.surveyStatus === 'APPROVED' ||
        (parcel as unknown as { survey_status?: string }).survey_status === 'SUBMITTED' ||
        (parcel as unknown as { survey_status?: string }).survey_status === 'APPROVED';
      const isSurveyor = user?.role === 'SURVEYOR';
      const effectiveReadOnly = readOnly !== undefined ? readOnly : Boolean(isSubmitted && isSurveyor);

      setIsReadOnlySurvey(effectiveReadOnly);
      updateSelectedParcel(parcel);
      updateSelectedUnit(null);
      setActiveTab('condo-master');
      updateNavigationUrl({
        tab: 'condo-master',
        parcelId: parcel.id,
        unitId: undefined,
        readOnly: effectiveReadOnly,
      }, { replace: false });
    });
  };

  const handleStartCondoUnit = (parcel: GisParcel, unit: BuildingUnit) => {
    triggerSurveyWithCheckInGuard(() => {
      updateSelectedParcel(parcel);
      updateSelectedUnit(unit);
      setActiveTab('condo-unit');
      updateNavigationUrl({
        tab: 'condo-unit',
        parcelId: parcel.id,
        unitId: unit.id,
        readOnly: false,
      }, { replace: false });
    });
  };

  const handleStartUnitSurvey = (parcel: GisParcel, unit: BuildingUnit, phase: 1 | 2 = 1) => {
    const targetTab: NavTab = phase === 2 ? 'phase2' : 'condo-unit';
    triggerSurveyWithCheckInGuard(() => {
      updateSelectedParcel(parcel);
      updateSelectedUnit(unit);
      setActiveTab(targetTab);
      updateNavigationUrl({
        tab: targetTab,
        parcelId: parcel.id,
        unitId: unit.id,
        readOnly: false,
      }, { replace: false });
    });
  };

  const handleStartPhase2 = (parcel: GisParcel) => {
    triggerSurveyWithCheckInGuard(() => {
      updateSelectedParcel(parcel);
      setActiveTab('phase2');
      updateNavigationUrl({
        tab: 'phase2',
        parcelId: parcel.id,
        unitId: undefined,
        readOnly: false,
      }, { replace: false });
    });
  };

  const handleRecordAbsence = async (parcel: GisParcel) => {
    try {
      await api.post(`/parcels/${parcel.id}/record-absence`, {
        absenceReason: 'HOMEOWNER_ABSENT',
        notes: 'Chủ nhà đi vắng, đã dán giấy thông báo khảo sát lần 2',
        photoProofUrl: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=600',
      });
    } catch (_err) {
      setParcels(
        parcels.map((p) =>
          p.id === parcel.id
            ? { ...p, surveyStatus: 'POSTPONED_ABSENT', absenceAttemptCount: (p.absenceAttemptCount || 0) + 1 }
            : p
        )
      );
    }
  };

  const handleResumeSurveyPresent = async (parcel: GisParcel) => {
    try {
      // 1. Gọi API mở lại hồ sơ khảo sát
      await api.post(`/parcels/${parcel.id}/resume-survey`);

      // 2. Xóa các override trạng thái cục bộ nếu có
      try {
        const overridesStr = localStorage.getItem('metro2_parcel_status_overrides');
        if (overridesStr) {
          const overrides = JSON.parse(overridesStr);
          if (overrides[parcel.id]) {
            delete overrides[parcel.id];
            localStorage.setItem('metro2_parcel_status_overrides', JSON.stringify(overrides));
          }
        }
      } catch (_e: unknown) {
        console.warn('[App:handleResumeSurveyPresent] Lỗi xóa overrides trạng thái:', _e);
      }

      // 3. Cập nhật state thửa đất trong parcels list sang IN_PROGRESS
      setParcels((prev) =>
        prev.map((p) =>
          p.id === parcel.id
            ? { ...p, surveyStatus: 'IN_PROGRESS' }
            : p
        )
      );

      // 4. Kích hoạt wizard khảo sát Phase 1 ở chế độ chỉnh sửa
      handleStartPhase1({ ...parcel, surveyStatus: 'IN_PROGRESS' }, false);
    } catch (err: unknown) {
      console.error('[App] Failed to resume survey:', err);
      handleStartPhase1(parcel, false);
    }
  };

  const handleCheckInSuccess = (details: { time: string; distance: number; status: string }) => {
    setIsCheckedInToday(true);
    setCheckInDetails(details);
  };

  const navigateBackFromSurvey = () => {
    setIsReadOnlySurvey(false);
    updateSelectedParcel(null);
    updateSelectedUnit(null);
    clearSurveyParamsFromUrl();
    const fallbackTab = getDefaultTabForRole(user?.role);
    setActiveTab(fallbackTab);
    updateNavigationUrl({ tab: fallbackTab });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', color: '#0f172a' }}>
      {/* Top Header: AdminTopNav cho Super Admin (Desktop/Tablet) hoặc SurveyorNavbar cho Khảo sát viên (Mobile PWA) */}
      {activeTab !== 'phase1' && activeTab !== 'condo-master' && activeTab !== 'condo-unit' && (
        user?.role === 'SUPER_ADMIN' ? (
          <AdminTopNav activeTab={activeTab} onChangeTab={(tab) => handleChangeTab(tab as NavTab)} />
        ) : user?.role === 'ZONE_ADMIN' ? (
          /* Zone Admin luôn ở trong ZoneAdminAppShell chuyên nghiệp, KHÔNG render AdminTopNav hay SurveyorNavbar! */
          null
        ) : (
          <SurveyorNavbar
            title={
              activeTab === 'home'
                ? 'BUILDING CONDITION SURVEY MRT LINE-2'
                : activeTab === 'map'
                ? 'Bản đồ số GIS'
                : activeTab === 'attendance'
                ? 'Điểm Danh GPS Hiện Trường'
                : 'Đối Soát Phase 2 (Pre-Construction)'
            }
            onNavigateToCheckIn={() => handleChangeTab('attendance')}
            onOpenCompanionCheckIn={() => setShowCompanionCheckInModal(true)}
            onNavigateHome={() => handleChangeTab('home')}
            isCheckedInToday={isCheckedInToday}
          />
        )
      )}

      {/* Main Viewport Content */}
      <main style={{ flex: 1, position: 'relative' }}>
        {user?.role === 'ZONE_ADMIN' && activeTab !== 'phase1' && activeTab !== 'condo-master' && activeTab !== 'condo-unit' && (
          <ZoneManagerDashboardPage
            parcels={parcels}
            onSelectParcelForSurvey={(p) => updateSelectedParcel(p)}
            onStartPhase1={handleStartPhase1}
            onStartPhase2={handleStartPhase2}
            onOpenBuildingHub={(p) => setHubParcel(p)}
            onRecordAbsence={handleRecordAbsence}
            onProposeSplit={(p) => setMutationStudioParcel(p)}
            onReloadParcels={loadParcels}
            userGps={liveUserGps}
          />
        )}

        {user?.role === 'SUPER_ADMIN' && activeTab === 'admin-export' && (
          <AdminDashboardPage />
        )}

        {user?.role !== 'ZONE_ADMIN' && activeTab === 'home' && (
          <SurveyorHomeView
            parcels={parcels}
            isCheckedInToday={isCheckedInToday}
            checkInDetails={checkInDetails}
            userGps={liveUserGps}
            onNavigateToMap={(parcelToFocus) => {
              if (parcelToFocus) {
                updateSelectedParcel(parcelToFocus);
              }
              handleChangeTab('map');
            }}
            onNavigateToCheckIn={() => handleChangeTab('attendance')}
            onStartPhase1={handleStartPhase1}
            onStartUnitSurvey={handleStartUnitSurvey}
            onStartPhase2={handleStartPhase2}
            onRecordAbsence={handleRecordAbsence}
            onResumeSurveyPresent={handleResumeSurveyPresent}
            onRefresh={loadParcels}
          />
        )}

        {user?.role !== 'ZONE_ADMIN' && activeTab === 'map' && (
          <div style={{ width: '100%', height: 'calc(100vh - 90px)', padding: 0 }}>
            <LeafletSweepMap
              parcels={parcels}
              selectedZone={selectedZone}
              onSelectZone={handleSelectZone}
              onSelectParcel={(p) => updateSelectedParcel(p)}
              onStartSurvey={handleStartPhase1}
              onStartPhase2={handleStartPhase2}
              onOpenBuildingHub={(p) => setHubParcel(p)}
              onRecordAbsence={handleRecordAbsence}
              onProposeSplit={(p) => {
                if (user?.role === 'ZONE_ADMIN' || user?.role === 'SUPER_ADMIN') {
                  setMutationStudioParcel(p);
                }
              }}
              onSwapSuccess={() => loadParcels()}
              userGps={liveUserGps}
            />
          </div>
        )}

        {activeTab === 'attendance' && (
          <TimekeepingCheckInView
            isCheckedInToday={isCheckedInToday}
            onCheckInSuccess={handleCheckInSuccess}
          />
        )}

        {activeTab === 'phase1' && (
          selectedParcelForSurvey ? (
            <SurveyPhase1Page
              parcel={selectedParcelForSurvey}
              unit={selectedUnitForSurvey}
              readOnly={isReadOnlySurvey}
              onBackToHome={() => {
                setIsReadOnlySurvey(false);
                navigateBackFromSurvey();
                loadParcels();
              }}
              onFinished={() => {
                setIsReadOnlySurvey(false);
                setSelectedUnitForSurvey(null);
                navigateBackFromSurvey();
                loadParcels();
              }}
            />
          ) : (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-sky-600 border-t-transparent rounded-full animate-spin" />
              <div className="text-sm font-bold text-slate-700">Đang khôi phục phiên khảo sát hiện trạng...</div>
            </div>
          )
        )}

        {activeTab === 'condo-master' && (
          selectedParcelForSurvey ? (
            <SurveyCondoMasterPage
              parcel={selectedParcelForSurvey}
              readOnly={isReadOnlySurvey}
              onBackToHome={() => {
                navigateBackFromSurvey();
                setHubParcel(selectedParcelForSurvey);
              }}
              onFinished={() => {
                navigateBackFromSurvey();
                loadParcels();
              }}
            />
          ) : (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-sky-600 border-t-transparent rounded-full animate-spin" />
              <div className="text-sm font-bold text-slate-700">Đang khôi phục phiên khảo sát chung cư...</div>
            </div>
          )
        )}

        {activeTab === 'condo-unit' && (
          selectedParcelForSurvey ? (
            <SurveyCondoUnitPage
              parcel={selectedParcelForSurvey}
              unit={selectedUnitForSurvey}
              onBackToHome={() => {
                navigateBackFromSurvey();
                setHubParcel(selectedParcelForSurvey);
              }}
              onFinished={() => {
                setSelectedUnitForSurvey(null);
                navigateBackFromSurvey();
                loadParcels();
              }}
            />
          ) : (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-sky-600 border-t-transparent rounded-full animate-spin" />
              <div className="text-sm font-bold text-slate-700">Đang khôi phục phiên khảo sát căn hộ...</div>
            </div>
          )
        )}

        {activeTab === 'phase2' && <SurveyPhase2View />}
      </main>

      {/* Global Condominium Hub Modal accessible from Map, Home, or Phase 1 */}
      {hubParcel && (
        <BuildingHubModal
          parcel={hubParcel}
          onClose={() => setHubParcel(null)}
          onStartMasterSurvey={(p) => {
            setHubParcel(null);
            handleStartCondoMaster(p);
          }}
          onStartUnitSurvey={(p, unit, phase) => {
            setHubParcel(null);
            if (phase === 2) {
              handleStartUnitSurvey(p, unit, 2);
            } else {
              handleStartCondoUnit(p, unit);
            }
          }}
          onUnitsUpdated={() => {
            loadParcels();
          }}
        />
      )}

      {/* Global Unified GIS Mutation Studio Modal */}
      {mutationStudioParcel && (
        <UnifiedGisMutationModal
          isOpen={!!mutationStudioParcel}
          parcelId={mutationStudioParcel.id}
          initialParcel={mutationStudioParcel}
          initialZoneId={mutationStudioParcel.zoneId || selectedZone}
          parcelCode={mutationStudioParcel.projectParcelCode}
          houseNumber={mutationStudioParcel.houseNumber}
          street={mutationStudioParcel.street}
          currentAreaM2={mutationStudioParcel.landArea}
          role={user?.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : user?.role === 'ZONE_ADMIN' ? 'ZONE_ADMIN' : 'SURVEYOR'}
          onClose={() => setMutationStudioParcel(null)}
          onSuccess={() => {
            setMutationStudioParcel(null);
            loadParcels();
          }}
        />
      )}

      {/* Attendance Check-in Reminder Modal */}
      {showAttendanceWarningModal && (
        <div
          className="fixed inset-0 z-[999999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto cursor-pointer"
          onClick={() => setShowAttendanceWarningModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-amber-200 overflow-hidden my-auto p-5 animate-in fade-in zoom-in-95 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0 border border-amber-200">
                <MapPin size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Chưa Điểm Danh GPS Hôm Nay!
                </h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  Theo quy chuẩn hiện trường Metro Line 2, cán bộ cần thực hiện <strong>Điểm danh GPS</strong> & chụp ảnh selfie tại Ga phụ trách trước khi thu thập số liệu.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowAttendanceWarningModal(false);
                  if (pendingSurveyFn) pendingSurveyFn();
                }}
                className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Khảo sát trước (Chấm công sau)
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAttendanceWarningModal(false);
                  handleChangeTab('attendance');
                }}
                className="flex-1 py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl transition-colors shadow-md shadow-sky-200 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Camera size={15} />
                <span>Điểm danh ngay</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Companion Check-In Modal (Accessible globally via Profile Navbar) */}
      {showCompanionCheckInModal && (
        <CompanionCheckInModal
          isOpen={showCompanionCheckInModal}
          onClose={() => setShowCompanionCheckInModal(false)}
        />
      )}

      {/* Bottom Navigation for Mobile PWA (CHỈ hiển thị cho Khảo sát viên, ẩn hoàn toàn với Admin) */}
      {user?.role !== 'SUPER_ADMIN' && user?.role !== 'ZONE_ADMIN' && activeTab !== 'phase1' && activeTab !== 'phase2' && activeTab !== 'condo-master' && activeTab !== 'condo-unit' && (
        <SurveyorBottomNav activeTab={activeTab} onChangeTab={handleChangeTab} />
      )}
    </div>
  );
};
