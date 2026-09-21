import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { api } from './services/api';
import { LoginView } from './views/auth/LoginView';
import { SurveyorNavbar } from './components/layout/SurveyorNavbar';
import { SurveyorBottomNav, NavTab } from './components/layout/SurveyorBottomNav';
import { LeafletSweepMap, GisParcel } from './components/gis/LeafletSweepMap';
import { SurveyorHomeView } from './views/surveyor/SurveyorHomeView';
import { TimekeepingCheckInView } from './views/surveyor/TimekeepingCheckInView';
import { SurveyPhase1Page } from './features/survey-phase1/views/SurveyPhase1Page';
import { SurveyPhase2View } from './views/surveyor/SurveyPhase2View';
import { BuildingHubModal } from './components/survey/BuildingHubModal';
import { CompanionCheckInModal } from './components/attendance/CompanionCheckInModal';
import { ZoneManagerDashboardPage } from './features/zone-management/views/ZoneManagerDashboardPage';
import { AdminDashboardPage } from './features/admin-portal/views/AdminDashboardPage';
import { PublicCitizenPortalPage } from './features/guest-portal/views/PublicCitizenPortalPage';
import { MapPin, Camera } from 'lucide-react';

export const App: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [selectedZone, setSelectedZone] = useState<string>('ZONE_S9');
  const [parcels, setParcels] = useState<GisParcel[]>([]);
  const [selectedParcelForSurvey, setSelectedParcelForSurvey] = useState<GisParcel | null>(null);
  const [selectedUnitForSurvey, setSelectedUnitForSurvey] = useState<any | null>(null);
  const [hubParcel, setHubParcel] = useState<GisParcel | null>(null);
  const [showAttendanceWarningModal, setShowAttendanceWarningModal] = useState<boolean>(false);
  const [showCompanionCheckInModal, setShowCompanionCheckInModal] = useState<boolean>(false);
  const [pendingSurveyFn, setPendingSurveyFn] = useState<(() => void) | null>(null);

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

  // ─── Chuẩn hóa dữ liệu thửa đất từ API ────────────────────────────────────
  const normalizeParcel = (p: any): GisParcel => {
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

    return {
      id: p.id,
      projectParcelCode: p.project_parcel_code || p.projectParcelCode || 'B-XXXXX',
      officialCadastralCode: p.official_cadastral_code || p.officialCadastralCode || '',
      houseNumber: p.house_number || p.houseNumber || '',
      street: p.street || '',
      ownerName: p.owner_name || p.ownerName || 'Chưa cập nhật',
      surveyStatus: p.survey_status || p.surveyStatus || 'NOT_SURVEYED',
      absenceAttemptCount: p.absence_attempt_count ?? p.absenceAttemptCount ?? 0,
      coordinates: coords,
      adjacentType: p.adjacent_type || p.adjacentType || 'TOWNHOUSE',
      constructionArea: Number(p.construction_area_m2 ?? p.constructionArea ?? 0),
      floorCount: Number(p.floor_count ?? p.floorCount ?? 1),
      landArea: Number(p.land_area_m2 ?? p.landArea ?? 0),
      landCategory: p.land_use_category || p.landCategory,
      landUseName: p.land_use_name_raw || p.landUseName,
      buildingType: p.building_type || p.buildingType || 'STANDALONE',
      totalUnits: Number(p.total_units ?? p.totalUnits ?? 1),
      completedUnits: Number(p.completed_units_count ?? p.completedUnits ?? 0),
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
    } catch (err: any) {
      console.error('[Metro2] Failed to load parcels:', err?.response?.data || err?.message);
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
          const todayRecord = res.data.data.find((item: any) => {
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
            } catch (_e) {}
          }
        }
      } catch (err) {
        console.warn('Sync attendance error:', err);
      }
    };

    syncTodayAttendance();
    loadParcels();
  }, [isAuthenticated, user, selectedZone]);

  // If loading session
  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
        <div style={{ color: '#0284c7', fontWeight: 700 }}>Đang tải hệ thống khảo sát Metro 2...</div>
      </div>
    );
  }

  // If not logged in, render the login page first!
  if (!isAuthenticated || !user) {
    return <LoginView />;
  }

  const triggerSurveyWithCheckInGuard = (surveyFn: () => void) => {
    if (!isCheckedInToday) {
      setPendingSurveyFn(() => surveyFn);
      setShowAttendanceWarningModal(true);
    } else {
      surveyFn();
    }
  };

  const handleStartPhase1 = (parcel: GisParcel) => {
    triggerSurveyWithCheckInGuard(() => {
      setSelectedParcelForSurvey(parcel);
      setSelectedUnitForSurvey(null);
      setActiveTab('phase1');
    });
  };

  const handleStartUnitSurvey = (parcel: GisParcel, unit: any) => {
    triggerSurveyWithCheckInGuard(() => {
      setSelectedParcelForSurvey(parcel);
      setSelectedUnitForSurvey(unit);
      setActiveTab('phase1');
    });
  };

  const handleStartPhase2 = (parcel: GisParcel) => {
    triggerSurveyWithCheckInGuard(() => {
      setSelectedParcelForSurvey(parcel);
      setActiveTab('phase2');
    });
  };

  const handleRecordAbsence = async (parcel: GisParcel) => {
    try {
      await api.post(`/parcels/${parcel.id}/record-absence`, {
        reason: 'Chủ nhà đi vắng, đã dán giấy thông báo khảo sát lần 2',
        evidencePhotoUrl: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=600',
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

  const handleCheckInSuccess = (details: { time: string; distance: number; status: string }) => {
    setIsCheckedInToday(true);
    setCheckInDetails(details);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', color: '#0f172a' }}>
      {/* Top Mobile Navbar (Hidden during Phase 1 survey to avoid duplicate headers) */}
      {activeTab !== 'phase1' && (
        <SurveyorNavbar
          title={
            activeTab === 'home'
              ? 'Khảo Sát Thực Địa Metro 2'
              : activeTab === 'map'
              ? 'Bản Đồ Quét Cạn GIS'
              : activeTab === 'attendance'
              ? 'Điểm Danh GPS Hiện Trường'
              : 'Đối Soát Phase 2 (Pre-Construction)'
          }
          onNavigateToCheckIn={() => setActiveTab('attendance')}
          onOpenCompanionCheckIn={() => setShowCompanionCheckInModal(true)}
          onNavigateHome={() => setActiveTab('home')}
          isCheckedInToday={isCheckedInToday}
        />
      )}

      {/* Main Viewport Content */}
      <main style={{ flex: 1, position: 'relative' }}>
        {activeTab === 'home' && (
          <SurveyorHomeView
            parcels={parcels}
            isCheckedInToday={isCheckedInToday}
            checkInDetails={checkInDetails}
            onNavigateToMap={(parcelToFocus) => {
              if (parcelToFocus) {
                setSelectedParcelForSurvey(parcelToFocus);
              }
              setActiveTab('map');
            }}
            onNavigateToCheckIn={() => setActiveTab('attendance')}
            onStartPhase1={handleStartPhase1}
            onStartUnitSurvey={handleStartUnitSurvey}
            onStartPhase2={handleStartPhase2}
            onRecordAbsence={handleRecordAbsence}
          />
        )}

        {activeTab === 'map' && (
          <div style={{ width: '100%', height: 'calc(100vh - 90px)', padding: 0 }}>
            <LeafletSweepMap
              parcels={parcels}
              selectedZone={selectedZone}
              onSelectZone={setSelectedZone}
              onSelectParcel={(p) => setSelectedParcelForSurvey(p)}
              onStartSurvey={handleStartPhase1}
              onOpenBuildingHub={(p) => setHubParcel(p)}
              onRecordAbsence={handleRecordAbsence}
              userGps={{ lat: 10.8036, lng: 106.6388, accuracy: 8 }}
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
          <SurveyPhase1Page
            parcel={selectedParcelForSurvey}
            unit={selectedUnitForSurvey}
            onBackToHome={() => setActiveTab('home')}
            onFinished={() => {
              setSelectedUnitForSurvey(null);
              setActiveTab('home');
              loadParcels();
            }}
          />
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
            handleStartPhase1(p);
          }}
          onStartUnitSurvey={(p, unit) => {
            setHubParcel(null);
            handleStartUnitSurvey(p, unit);
          }}
          onUnitsUpdated={() => {
            loadParcels();
          }}
        />
      )}

      {/* Attendance Check-in Reminder Modal */}
      {showAttendanceWarningModal && (
        <div
          className="fixed inset-0 z-[999999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowAttendanceWarningModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-amber-200 overflow-hidden my-auto p-5 animate-in fade-in zoom-in-95"
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
                className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                Khảo sát trước (Chấm công sau)
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAttendanceWarningModal(false);
                  setActiveTab('attendance');
                }}
                className="flex-1 py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl transition-colors shadow-md shadow-sky-200 flex items-center justify-center gap-1.5"
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

      {/* Bottom Navigation for Mobile PWA (Hidden during survey) */}
      {activeTab !== 'phase1' && activeTab !== 'phase2' && (
        <SurveyorBottomNav activeTab={activeTab} onChangeTab={setActiveTab} />
      )}
    </div>
  );
};
