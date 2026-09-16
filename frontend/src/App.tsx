import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { api } from './services/api';
import { LoginView } from './views/auth/LoginView';
import { SurveyorNavbar } from './components/layout/SurveyorNavbar';
import { SurveyorBottomNav, NavTab } from './components/layout/SurveyorBottomNav';
import { LeafletSweepMap, GisParcel } from './components/gis/LeafletSweepMap';
import { SurveyorHomeView } from './views/surveyor/SurveyorHomeView';
import { TimekeepingCheckInView } from './views/surveyor/TimekeepingCheckInView';
import { SurveyPhase1View } from './views/surveyor/SurveyPhase1View';
import { SurveyPhase2View } from './views/surveyor/SurveyPhase2View';

export const App: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [selectedZone, setSelectedZone] = useState<string>('ZONE_S9');
  const [parcels, setParcels] = useState<GisParcel[]>([]);
  const [selectedParcelForSurvey, setSelectedParcelForSurvey] = useState<GisParcel | null>(null);

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

  const initialParcels: GisParcel[] = [
    {
      id: 'c0000000-0000-0000-0000-000000000001',
      projectParcelCode: 'B-00105',
      officialCadastralCode: 'KS003-00105',
      houseNumber: '854',
      street: 'Đường Trường Chinh',
      ownerName: 'Nguyễn Văn An',
      surveyStatus: 'NOT_SURVEYED',
      absenceAttemptCount: 0,
      coordinates: [
        [10.8033, 106.6384],
        [10.8034, 106.6387],
        [10.8032, 106.6388],
        [10.8031, 106.6385],
      ],
    },
    {
      id: 'c0000000-0000-0000-0000-000000000002',
      projectParcelCode: 'B-00106',
      officialCadastralCode: 'KS003-00106',
      houseNumber: '856',
      street: 'Đường Trường Chinh',
      ownerName: 'Trần Thị Bích',
      surveyStatus: 'IN_PROGRESS',
      absenceAttemptCount: 0,
      coordinates: [
        [10.8035, 106.6387],
        [10.8036, 106.639],
        [10.8034, 106.6391],
        [10.8033, 106.6388],
      ],
    },
    {
      id: 'c0000000-0000-0000-0000-000000000003',
      projectParcelCode: 'B-00107',
      officialCadastralCode: 'KS003-00107',
      houseNumber: '858',
      street: 'Đường Trường Chinh',
      ownerName: 'Lê Hoàng Cường',
      surveyStatus: 'APPROVED',
      absenceAttemptCount: 0,
      coordinates: [
        [10.8037, 106.639],
        [10.8038, 106.6393],
        [10.8036, 106.6394],
        [10.8035, 106.6391],
      ],
    },
    {
      id: 'c0000000-0000-0000-0000-000000000004',
      projectParcelCode: 'B-00108',
      officialCadastralCode: 'KS003-00108',
      houseNumber: '860',
      street: 'Đường Trường Chinh',
      ownerName: 'Phạm Minh Dũng',
      surveyStatus: 'POSTPONED_ABSENT',
      absenceAttemptCount: 2,
      coordinates: [
        [10.8039, 106.6393],
        [10.804, 106.6396],
        [10.8038, 106.6397],
        [10.8037, 106.6394],
      ],
    },
    {
      id: 'c0000000-0000-0000-0000-000000000005',
      projectParcelCode: 'B-00109',
      officialCadastralCode: 'KS003-00109',
      houseNumber: '862',
      street: 'Đường Trường Chinh',
      ownerName: 'Vũ Thị Hoa',
      surveyStatus: 'NOT_SURVEYED',
      absenceAttemptCount: 0,
      coordinates: [
        [10.8041, 106.6396],
        [10.8042, 106.6399],
        [10.804, 106.64],
        [10.8039, 106.6397],
      ],
    },
  ];

  const loadParcels = async () => {
    try {
      const res = await api.get('/parcels/zone-map', { params: { zoneId: selectedZone } });
      if (res.data && res.data.data && res.data.data.length > 0) {
        setParcels(res.data.data);
      } else {
        setParcels(initialParcels);
      }
    } catch (_err) {
      setParcels(initialParcels);
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

  const handleStartPhase1 = (parcel: GisParcel) => {
    setSelectedParcelForSurvey(parcel);
    setActiveTab('phase1');
  };

  const handleStartPhase2 = (parcel: GisParcel) => {
    setSelectedParcelForSurvey(parcel);
    setActiveTab('phase2');
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
      {/* Top Mobile Navbar */}
      <SurveyorNavbar
        title={
          activeTab === 'home'
            ? 'Khảo Sát Thực Địa Metro 2'
            : activeTab === 'map'
            ? 'Bản Đồ Quét Cạn GIS'
            : activeTab === 'attendance'
            ? 'Điểm Danh GPS Hiện Trường'
            : activeTab === 'phase1'
            ? 'Hồ Sơ Phase 1 (Baseline)'
            : 'Đối Soát Phase 2 (Pre-Construction)'
        }
      />

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
            onStartPhase2={handleStartPhase2}
            onRecordAbsence={handleRecordAbsence}
          />
        )}

        {activeTab === 'map' && (
          <div style={{ width: '100%', height: 'calc(100vh - 120px)', padding: '0.5rem' }}>
            <LeafletSweepMap
              parcels={parcels}
              selectedZone={selectedZone}
              onSelectZone={setSelectedZone}
              onSelectParcel={(p) => setSelectedParcelForSurvey(p)}
              onStartSurvey={handleStartPhase1}
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
          <SurveyPhase1View
            initialParcelId={selectedParcelForSurvey?.id}
            onFinished={() => setActiveTab('home')}
          />
        )}

        {activeTab === 'phase2' && <SurveyPhase2View />}
      </main>

      {/* Bottom Navigation for Mobile PWA (3 Tabs: Home, Map, Attendance) */}
      <SurveyorBottomNav activeTab={activeTab} onChangeTab={setActiveTab} />
    </div>
  );
};
