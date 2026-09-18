import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { FacadePolygonCanvas, PolygonPoint, FloorSplitLine } from '../../components/canvas/FacadePolygonCanvas';
import { DefectPinningCanvas, DefectItem } from '../../components/canvas/DefectPinningCanvas';
import { FloorCadPinningCanvas, CadZonePin } from '../../components/canvas/FloorCadPinningCanvas';
import { SignaturePad } from '../../components/canvas/SignaturePad';
import { PhotoCaptureInput } from '../../components/common/PhotoCaptureInput';
import {
  FileText,
  Image as ImageIcon,
  Layers,
  Activity,
  Calculator,
  PenTool,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  Send,
  Save,
  HelpCircle,
  Compass,
  Building,
  Home,
  ShieldCheck,
  Sparkles,
  Camera,
  MapPin,
  Maximize2,
  Ruler,
  Check,
} from 'lucide-react';

import { GisParcel } from '../../components/gis/LeafletSweepMap';
import { CadastralGISBoundaryEditor } from '../../components/gis/CadastralGISBoundaryEditor';

interface Props {
  initialParcelId?: string;
  parcel?: GisParcel | null;
  onFinished?: () => void;
}

interface DamageZoneData {
  id: string;
  zoneCode: string;
  floorName: string;
  roomName: string;
  componentType: string;
  wallMaterial: string;
  functionalImpactRepairNeeded: boolean;
  burlandGrade: number;
  ctxPhotoUrl: string;
  notes: string;
  defects: DefectItem[];
}

interface FloorSurveyData {
  id: string;
  floorName: string;
  overviewPhotos: { id: string; url: string; caption?: string }[];
  cadSketchPhotoUrl: string;
  cadZonePins: CadZonePin[];
  zones: DamageZoneData[];
}

const COMMON_ROOM_NAMES = [
  'Phòng khách',
  'Phòng ngủ trước',
  'Phòng ngủ sau',
  'Phòng ngủ 1',
  'Phòng ngủ 2',
  'Phòng bếp / Ăn',
  'Ban công / Lô gia',
  'Nhà vệ sinh / WC',
  'Cầu thang / Hành lang',
  'Sân thượng / Sân phơi',
  'Phòng thờ',
  'Gara / Nhà xe',
  'Kho chứa đồ',
  'Khác',
];

const COMMON_WALL_MATERIALS = [
  'Tường gạch trát vữa XM sơn nước',
  'Bê tông cốt thép (BTCT)',
  'Tường gạch ốp gạch men',
  'Tường gạch quét vôi',
  'Tường / Vách thạch cao',
  'Gỗ / Ván công nghiệp',
  'Vách kính khung nhôm',
  'Khác',
];

const COMMON_RESTRICTED_AREAS = [
  'Các tầng lầu trên cao',
  'Mái / Sân thượng / Sê-nô - Không có lối lên an toàn',
  'Tầng hầm / Bán hầm - Bị ngập / Đóng kín',
  'Phòng ngủ / Khu vực riêng tư gia đình',
  'Phòng kho / Kho hàng khóa cửa',
  'Khu phụ / Giếng trời / Sân sau',
  'Toàn bộ bên trong nhà (Chỉ khảo sát bên ngoài)',
  'Khác',
];

const COMMON_LIMITATION_REASONS = [
  'Chỉ đồng ý cho xem tầng trệt (Từ chối mở lầu)',
  'Chủ nhà đi vắng / Khóa cửa các phòng',
  'Chủ nhà không cho phép vào khu vực riêng tư',
  'Khu vực nguy hiểm / Nguy cơ sập đổ / Đang sửa chữa',
  'Kẹt cửa / Mất chìa khóa không mở được',
  'Khu vực chứa tài sản nhạy cảm / Đồ có giá trị',
  'Khác',
];

// Sleek popover badge for technical explanations
const HelpBadge: React.FC<{ text: string }> = ({ text }) => {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShow(!show);
        }}
        title="Bấm để xem giải thích kỹ thuật"
        style={{
          background: 'none',
          border: 'none',
          padding: '0 2px',
          cursor: 'pointer',
          color: '#0284c7',
          display: 'inline-flex',
          alignItems: 'center',
          verticalAlign: 'middle',
        }}
      >
        <HelpCircle size={13} />
      </button>
      {show && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: '125%',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#0f172a',
            color: '#f8fafc',
            padding: '0.55rem 0.75rem',
            borderRadius: '0.45rem',
            fontSize: '0.725rem',
            lineHeight: 1.4,
            width: '230px',
            boxShadow: '0 6px 16px rgba(0,0,0,0.3)',
            zIndex: 9999,
            pointerEvents: 'auto',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem', borderBottom: '1px solid #334155', paddingBottom: '0.2rem' }}>
            <span style={{ fontWeight: 700, color: '#38bdf8' }}>Chi tiết kỹ thuật</span>
            <button
              type="button"
              onClick={() => setShow(false)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, fontSize: '0.75rem' }}
            >
              ✕
            </button>
          </div>
          <div>{text}</div>
        </div>
      )}
    </span>
  );
};

export const SurveyPhase1View: React.FC<Props> = ({ initialParcelId, parcel, onFinished }) => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [reportId] = useState<string>('a0000000-0000-0000-0000-000000000001');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [showBurlandModal, setShowBurlandModal] = useState<boolean>(false);

  const activeParcelId = parcel?.id || initialParcelId || 'default';
  const draftKey = `metro2_phase1_draft_${activeParcelId}`;

  const [saveToastMessage, setSaveToastMessage] = useState<string | null>(null);

  // STEP 1: Legal & Parcel Identification
  const [parcelData, setParcelData] = useState(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.parcelData) return parsed.parcelData;
      }
    } catch (_e) {}
    return {
      projectParcelCode: parcel?.projectParcelCode || (parcel as any)?.project_parcel_code || 'B-00105',
      officialCadastralCode: parcel?.officialCadastralCode || (parcel as any)?.official_cadastral_code || 'KS003-00105',
      buildingName: (parcel as any)?.buildingName || (parcel as any)?.building_name || '',
      houseNumber: parcel?.houseNumber || (parcel as any)?.house_number || '854',
      street: parcel?.street || 'Đường Trường Chinh',
      ward: (parcel as any)?.ward || 'Phường 14',
      district: (parcel as any)?.district || 'Quận Tân Bình',
      ownerName: parcel?.ownerName || (parcel as any)?.owner_name || 'Nguyễn Văn Hùng',
      importanceGroup: (parcel as any)?.importanceGroup || 'General',
      adjacentLeft: (parcel as any)?.adjacentLeft || { type: 'Nhà phố / Nhà dân', otherText: '' },
      adjacentRight: (parcel as any)?.adjacentRight || { type: 'Nhà phố / Nhà dân', otherText: '' },
      adjacentRear: (parcel as any)?.adjacentRear || { type: 'Nhà phố / Nhà dân', otherText: '' },
      chainage: 'Km8+450',
      distToMetroCenterlineM: 18.5,
      distToClearanceBoundaryM: 4.2,
      gpsCoords: parcel?.coordinates?.[0] ? `${parcel.coordinates[0][0].toFixed(5)}, ${parcel.coordinates[0][1].toFixed(5)} ±5m` : '10.80340, 106.63850 ±5m',
    };
  });

  useEffect(() => {
    if (parcel) {
      setParcelData((prev: any) => ({
        ...prev,
        projectParcelCode: parcel.projectParcelCode || (parcel as any).project_parcel_code || prev.projectParcelCode,
        officialCadastralCode: parcel.officialCadastralCode || (parcel as any).official_cadastral_code || prev.officialCadastralCode,
        houseNumber: parcel.houseNumber || (parcel as any).house_number || prev.houseNumber,
        street: parcel.street || prev.street,
        ownerName: parcel.ownerName || (parcel as any).owner_name || prev.ownerName,
        gpsCoords: parcel.coordinates?.[0] ? `${parcel.coordinates[0][0].toFixed(5)}, ${parcel.coordinates[0][1].toFixed(5)} ±5m` : prev.gpsCoords,
      }));
    }
  }, [parcel]);

  // STEP 1 Photos: P01 - P04 (ZERO hardcoded images, completely clean for live testing)
  const [p01HouseNumberUrl, setP01HouseNumberUrl] = useState(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) return JSON.parse(saved)?.p01?.url || '';
    } catch (_e) {}
    return '';
  });
  const [p01NotApplicable, setP01NotApplicable] = useState(false);
  const [p01NaReason, setP01NaReason] = useState('');

  const [p02MainFacadeUrl, setP02MainFacadeUrl] = useState(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) return JSON.parse(saved)?.p02?.url || '';
    } catch (_e) {}
    return '';
  });
  const [p02NotApplicable, setP02NotApplicable] = useState(false);
  const [p02NaReason, setP02NaReason] = useState('');
  const [p02PolygonPoints, setP02PolygonPoints] = useState<PolygonPoint[]>([]);
  const [p02FloorLines, setP02FloorLines] = useState<FloorSplitLine[]>([]);
  const [p02FreehandStrokes, setP02FreehandStrokes] = useState<any[]>([]);

  // P-03 Multi-Photo List (Hông trái, Hông phải, Phía sau)
  const [p03Photos, setP03Photos] = useState<{ id: string; url: string; label: string }[]>(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved && JSON.parse(saved)?.p03Photos?.length) {
        return JSON.parse(saved).p03Photos;
      }
    } catch (_e) {}
    return [
      { id: 'p03-1', url: '', label: 'Bên hông trái' },
    ];
  });
  const [p03NotApplicable, setP03NotApplicable] = useState(false);
  const [p03NaReason, setP03NaReason] = useState('');

  const [p04ContextStreetUrl, setP04ContextStreetUrl] = useState(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) return JSON.parse(saved)?.p04?.url || '';
    } catch (_e) {}
    return '';
  });
  const [p04NotApplicable, setP04NotApplicable] = useState(false);
  const [p04NaReason, setP04NaReason] = useState('');

  // STEP 2: Owner Interview, Architecture, Foundation & Sensitivity
  const [specs, setSpecs] = useState(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved && JSON.parse(saved)?.specs) return JSON.parse(saved).specs;
    } catch (_e) {}
    return {
      useCategory: 'Nhà ở gia đình',
      useCategoryOther: '',
      floorCount: 3,
      basementCount: 0,
      yearOfConstruction: 2014,
      isYearEstimated: false,
      structuralSystem: 'RC', // RC, Steel, Masonry, Mixed, Other
      structuralForm: 'Frame', // Frame, Wall, Mixed, Other
      foundationType: 'PC', // Shallow, Wood, PC, CIP, Unknown
      pileDimension: '', // e.g. D600mm, 250x250mm
      asBuiltDrawingUrl: '',
      asBuiltDrawingNotApplicable: false,
      asBuiltDrawingNaReason: '',
      catFoundationScore: 3, // 1 to 5
      catFoundationSource: ['Owner', 'Site'], // Drawing, Owner, Site
      // Sensitive history (E5 mapping)
      extendedOrRenovated: 0, // 0 to 4
      renovatedStructure: 0,
      previousSettlementOrTilt: 0,
      adjacentDamageHistory: 0,
      fireOrFloodAccident: 0,
      sensitiveEquipment: false,
      sensitiveEquipmentDesc: '',
      occupancyStatus: 'Đang sử dụng 100%', // Đang sử dụng 100%, Đang sử dụng một phần, Bỏ trống / Không sử dụng
      continuousOperation247: false,
      historyNotes: '',
      ownerPhone: (parcel as any)?.ownerPhone || (parcel as any)?.owner_phone || '0908123456',
    };
  });

  // STEP 3: Floors > Zones > Defects Hierarchy
  const [floors, setFloors] = useState<FloorSurveyData[]>(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.floors?.length) return parsed.floors;
        if (parsed.zones?.length) {
          return [
            {
              id: 'floor-1',
              floorName: 'Tầng trệt - Tầng 1',
              overviewPhotos: [],
              cadSketchPhotoUrl: parsed.damageMapSketchUrl || '',
              cadZonePins: [],
              zones: parsed.zones,
            },
          ];
        }
      }
    } catch (_e) {}
    return [
      {
        id: 'floor-1',
        floorName: 'Tầng trệt - Tầng 1',
        overviewPhotos: [],
        cadSketchPhotoUrl: '',
        cadZonePins: [],
        zones: [],
      },
    ];
  });

  const [activeFloorIndex, setActiveFloorIndex] = useState<number>(0);
  const [activeZoneIndex, setActiveZoneIndex] = useState<number>(0);

  // Safe accessor for current active floor and current active zone
  const currentFloor: FloorSurveyData = floors[activeFloorIndex] || floors[0] || {
    id: 'floor-default',
    floorName: 'Tầng trệt - Tầng 1',
    overviewPhotos: [],
    cadSketchPhotoUrl: '',
    cadZonePins: [],
    zones: [],
  };

  const currentFloorZones: DamageZoneData[] = currentFloor.zones || [];
  const currentZone: DamageZoneData | undefined = currentFloorZones[activeZoneIndex] || currentFloorZones[0];

  // STEP 4: Settlement, Tilt & Deflection (E3 mapping)
  const [settlementTilt, setSettlementTilt] = useState(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved && JSON.parse(saved)?.settlementTilt) {
        const s = JSON.parse(saved).settlementTilt;
        return {
          diffSettlementScore: s.diffSettlementScore ?? 0,
          diffSettlementLocation: s.diffSettlementLocation ?? '',
          buildingTiltScore: s.buildingTiltScore ?? 0,
          tiltFrontXPercent: s.tiltFrontXPercent ?? 0,
          tiltSideYPercent: s.tiltSideYPercent ?? 0,
          floorTiltScore: s.floorTiltScore ?? 0,
          floorTiltPercent: s.floorTiltPercent ?? 0,
          beamDeflectionScore: s.beamDeflectionScore ?? 0,
          beamDeflectionLocation: s.beamDeflectionLocation ?? '',
          dataSources: Array.isArray(s.dataSources)
            ? s.dataSources
            : s.dataSource
            ? [s.dataSource]
            : ['Quan sát mắt thường'],
          dataConfidence: s.dataConfidence || 'Cao',
          needsSpecialistMonitoring: s.needsSpecialistMonitoring ?? false,
          monitoringRemarks: s.monitoringRemarks || '',
        };
      }
    } catch (_e) {}
    return {
      diffSettlementScore: 0, // 0 to 4
      diffSettlementLocation: '',
      buildingTiltScore: 0, // 0 to 4
      tiltFrontXPercent: 0,
      tiltSideYPercent: 0,
      floorTiltScore: 0, // 0 to 4
      floorTiltPercent: 0,
      beamDeflectionScore: 0, // 0 to 4
      beamDeflectionLocation: '',
      dataSources: ['Quan sát mắt thường'], // Multi-select
      dataConfidence: 'Cao', // Cao, Trung bình, Thấp
      needsSpecialistMonitoring: false,
      monitoringRemarks: '',
    };
  });

  // STEP 5: Survey Scope & GIS Boundary Verification
  const [scopeGIS, setScopeGIS] = useState(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved && JSON.parse(saved)?.scopeGIS) {
        const s = JSON.parse(saved).scopeGIS;
        return {
          surveyScope: Array.isArray(s.surveyScope) && s.surveyScope.length > 0
            ? s.surveyScope
            : ['Bên ngoài / Mặt tiền (P-01 → P-04)'],
          accessLimitations: s.accessLimitations ?? false,
          restrictedAreas: Array.isArray(s.restrictedAreas) ? s.restrictedAreas : [],
          restrictedFloors: Array.isArray(s.restrictedFloors) ? s.restrictedFloors : [],
          restrictedAreaOther: s.restrictedAreaOther || '',
          limitationReasonType: s.limitationReasonType || 'Chỉ đồng ý cho xem tầng trệt (Từ chối mở lầu)',
          limitationReasonOther: s.limitationReasonOther || '',
          accessLimitationReason: s.accessLimitationReason || '',
          boundaryStatus: (s.boundaryStatus as 'MATCH' | 'SPLIT' | 'MERGE') || 'MATCH',
          mutationData: s.mutationData || {
            splitReason: 'Nhà gốc thực tế đã chia tách thành 2 căn riêng biệt có lối đi độc lập.',
            splitCount: 2,
            splitChildren: [
              { label: 'Căn A (Mặt tiền)', houseNumber: '', ownerName: '', suggestedCode: 'B-07001' },
              { label: 'Căn B (Phía sau)', houseNumber: '', ownerName: '', suggestedCode: 'B-07002' },
            ],
            mergeReason: 'Công trình xây dựng liên hợp gộp trên 2 thửa đất liền kề.',
            mergeTargetCode: '',
            isSubmitted: false,
            submittedAt: '',
          },
        };
      }
    } catch (_e) {}
    return {
      surveyScope: ['Bên ngoài / Mặt tiền (P-01 → P-04)'],
      accessLimitations: false,
      restrictedAreas: [] as string[],
      restrictedFloors: [] as string[],
      restrictedAreaOther: '',
      limitationReasonType: 'Chỉ đồng ý cho xem tầng trệt (Từ chối mở lầu)',
      limitationReasonOther: '',
      accessLimitationReason: '',
      boundaryStatus: 'MATCH' as 'MATCH' | 'SPLIT' | 'MERGE',
      mutationData: {
        splitReason: 'Nhà gốc thực tế đã chia tách thành 2 căn riêng biệt có lối đi độc lập.',
        splitCount: 2,
        splitChildren: [
          { label: 'Căn A (Mặt tiền)', houseNumber: '', ownerName: '', suggestedCode: 'B-07001' },
          { label: 'Căn B (Phía sau)', houseNumber: '', ownerName: '', suggestedCode: 'B-07002' },
        ],
        mergeReason: 'Công trình xây dựng liên hợp gộp trên 2 thửa đất liền kề.',
        mergeTargetCode: '',
        isSubmitted: false,
        submittedAt: '',
      },
    };
  });

  // Expandable floor list for Step 5 restricted access options
  const [restrictedFloorOptions, setRestrictedFloorOptions] = useState<string[]>([
    'Lầu 1',
    'Lầu 2',
    'Lầu 3',
    'Lầu 4',
    'Lầu 5',
  ]);

  // Helper: check if a floor label (e.g. "Lầu 1") has already been surveyed in Step 3
  const isFloorSurveyedInStep3 = (flLabel: string): boolean => {
    return floors.some((fl) => {
      const lower = (fl.floorName || '').toLowerCase();
      if (flLabel === 'Lầu 1') return lower.includes('lầu 1') || lower.includes('tầng 2');
      if (flLabel === 'Lầu 2') return lower.includes('lầu 2') || lower.includes('tầng 3');
      if (flLabel === 'Lầu 3') return lower.includes('lầu 3') || lower.includes('tầng 4');
      if (flLabel === 'Lầu 4') return lower.includes('lầu 4') || lower.includes('tầng 5');
      if (flLabel === 'Lầu 5') return lower.includes('lầu 5') || lower.includes('tầng 6');
      return lower.includes(flLabel.toLowerCase());
    });
  };

  // Auto-sync surveyScope to ensure facade and all surveyed floors are pre-checked by default
  useEffect(() => {
    const defaultScope = ['Bên ngoài / Mặt tiền (P-01 → P-04)', ...floors.map((f) => f.floorName)];
    setScopeGIS((prev) => {
      const existing = prev.surveyScope || [];
      const merged = Array.from(new Set([...defaultScope, ...existing]));
      if (merged.length !== existing.length || !existing.includes('Bên ngoài / Mặt tiền (P-01 → P-04)')) {
        return { ...prev, surveyScope: merged };
      }
      return prev;
    });
  }, [floors]);

  // STEP 6: ECS & VI Technical Scoring (formerly Step 7)
  const [e6ManualScore, setE6ManualScore] = useState<number | null>(null);
  const [engineeringJudgement, setEngineeringJudgement] = useState<'NO_CHANGE' | 'UPGRADE' | 'DOWNGRADE'>('NO_CHANGE');
  const [judgementReason, setJudgementReason] = useState('');

  // Vulnerability VI Sliders (V1 - V6)
  const [viScores, setViScores] = useState({
    v1Use: 2, // 1 to 4
    v2Structure: 2,
    v3Foundation: 3, // Auto mapped from specs.catFoundationScore
    v4Age: 2,
    v5Ecs: 2, // Auto mapped from ECS class
    v6Sensitive: 1,
  });

  // STEP 7: Summary & Recommendations (formerly Step 8)
  const [summaryData, setSummaryData] = useState(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.summaryData) return parsed.summaryData;
      }
    } catch (_e) {}
    return {
      constructionImpact: 'Pending',
      braRiskClass: 'Pending',
      primaryRiskSummary: '',
      specificRecommendations: '',
    };
  });

  // STEP 8: Final Signatures (2 Parties: Prepared by & Owner)
  const [preparedByName, setPreparedByName] = useState(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.preparedByName) return parsed.preparedByName;
      }
    } catch (_e) {}
    return user?.fullName || 'Nguyễn Văn An (Kỹ sư Khảo sát)';
  });
  const [preparedByDate, setPreparedByDate] = useState(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.preparedByDate) return parsed.preparedByDate;
      }
    } catch (_e) {}
    return new Date().toISOString().split('T')[0];
  });
  const [ownerSignName, setOwnerSignName] = useState(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.ownerSignName) return parsed.ownerSignName;
      }
    } catch (_e) {}
    return parcelData.ownerName || 'Nguyễn Văn Hùng (Chủ hộ)';
  });
  const [ownerSignDate, setOwnerSignDate] = useState(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.ownerSignDate) return parsed.ownerSignDate;
      }
    } catch (_e) {}
    return new Date().toISOString().split('T')[0];
  });
  const [ownerFeedback, setOwnerFeedback] = useState(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.ownerFeedback) return parsed.ownerFeedback;
      }
    } catch (_e) {}
    return 'Thống nhất với kết quả kiểm tra hiện trạng.';
  });
  const [sigPreparedBy, setSigPreparedBy] = useState(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.sigPreparedBy) return parsed.sigPreparedBy;
      }
    } catch (_e) {}
    return '';
  });
  const [sigOwner, setSigOwner] = useState(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.sigOwner) return parsed.sigOwner;
      }
    } catch (_e) {}
    return '';
  });
  const [lastAutosaveTime, setLastAutosaveTime] = useState<string>('');

  // Dynamic ECS Score Calculations Across All Floors & Zones
  const allZones = floors.flatMap((f) => f.zones);
  const allDefects = allZones.flatMap((z) => z.defects);

  const maxBurland = Math.max(0, ...allZones.map((z) => z.burlandGrade || 0));
  const e1Score = Math.min(4, maxBurland);

  // Predominant Burland Grade
  const burlandCounts: Record<number, number> = {};
  allZones.forEach((z) => {
    const g = z.burlandGrade || 0;
    burlandCounts[g] = (burlandCounts[g] || 0) + 1;
  });
  let predominantBurland = 0;
  let maxBurlandCount = -1;
  Object.entries(burlandCounts).forEach(([gStr, count]) => {
    if (count > maxBurlandCount) {
      maxBurlandCount = count;
      predominantBurland = Number(gStr);
    }
  });

  const maxE2 = Math.max(0, ...allDefects.map((d) => d.structuralSignificanceE2 || 0));
  const e2Score = Math.min(4, maxE2);

  let structuralFlagLevel: 'None' | 'Low' | 'Moderate' | 'High' | 'Critical' = 'None';
  if (maxE2 === 4) structuralFlagLevel = 'Critical';
  else if (maxE2 === 3) structuralFlagLevel = 'High';
  else if (maxE2 === 2) structuralFlagLevel = 'Moderate';
  else if (maxE2 === 1) structuralFlagLevel = 'Low';

  const e3Score = Math.max(
    settlementTilt.diffSettlementScore,
    settlementTilt.buildingTiltScore,
    settlementTilt.floorTiltScore,
    settlementTilt.beamDeflectionScore
  );

  const maxE4 = Math.max(0, ...allDefects.map((d) => d.materialDegradationE4 || 0));
  const e4Score = Math.min(4, maxE4);

  const e5Score = Math.min(
    4,
    Math.max(
      specs.extendedOrRenovated,
      specs.renovatedStructure,
      specs.previousSettlementOrTilt,
      specs.adjacentDamageHistory,
      specs.fireOrFloodAccident
    )
  );

  const autoE6Score = allZones.some((z) => z.functionalImpactRepairNeeded) ? 2 : 0;
  const e6Score = e6ManualScore !== null ? e6ManualScore : autoE6Score;

  const totalEcsScore = e1Score + e2Score + e3Score + e4Score + e5Score + e6Score;

  let ecsClass = 'Good';
  if (totalEcsScore >= 17) ecsClass = 'Critical';
  else if (totalEcsScore >= 11) ecsClass = 'Deficient';
  else if (totalEcsScore >= 6) ecsClass = 'Medium';

  // Critical Safety Lock for Engineering Judgement
  const isCriticalLockActive =
    maxE2 >= 3 ||
    settlementTilt.buildingTiltScore >= 3 ||
    settlementTilt.diffSettlementScore >= 3 ||
    settlementTilt.floorTiltScore >= 3 ||
    settlementTilt.beamDeflectionScore >= 3 ||
    ecsClass === 'Critical';

  // Adjusted ECS Class
  let adjustedEcsClass = ecsClass;
  if (engineeringJudgement === 'UPGRADE') {
    if (ecsClass === 'Good') adjustedEcsClass = 'Medium';
    else if (ecsClass === 'Medium') adjustedEcsClass = 'Deficient';
    else if (ecsClass === 'Deficient') adjustedEcsClass = 'Critical';
  } else if (engineeringJudgement === 'DOWNGRADE' && !isCriticalLockActive) {
    if (ecsClass === 'Critical') adjustedEcsClass = 'Deficient';
    else if (ecsClass === 'Deficient') adjustedEcsClass = 'Medium';
    else if (ecsClass === 'Medium') adjustedEcsClass = 'Good';
  }

  // Auto-sync V1 (from Importance Group), V3 (from CAT Foundation) and V5 (from ECS Class)
  useEffect(() => {
    const mappedV1 =
      parcelData.importanceGroup === 'Critical'
        ? 4
        : parcelData.importanceGroup === 'Important'
        ? 3
        : parcelData.importanceGroup === 'Poor_Structural'
        ? 1
        : 2;

    const mappedV3 = Math.min(
      4,
      Math.max(1, specs.catFoundationScore <= 1 ? 1 : specs.catFoundationScore <= 2 ? 2 : specs.catFoundationScore <= 3 ? 3 : 4)
    );
    const mappedV5 = adjustedEcsClass === 'Good' ? 1 : adjustedEcsClass === 'Medium' ? 2 : adjustedEcsClass === 'Deficient' ? 3 : 4;

    setViScores((prev) => {
      if (prev.v1Use !== mappedV1 || prev.v3Foundation !== mappedV3 || prev.v5Ecs !== mappedV5) {
        return {
          ...prev,
          v1Use: mappedV1,
          v3Foundation: mappedV3,
          v5Ecs: mappedV5,
        };
      }
      return prev;
    });
  }, [parcelData.importanceGroup, specs.catFoundationScore, adjustedEcsClass]);

  // VI Average Score
  const totalVi =
    viScores.v1Use +
    viScores.v2Structure +
    viScores.v3Foundation +
    viScores.v4Age +
    viScores.v5Ecs +
    viScores.v6Sensitive;
  const avgVi = parseFloat((totalVi / 6).toFixed(2));
  let viClass = 'Low';
  if (avgVi >= 3.25) viClass = 'Very High';
  else if (avgVi >= 2.5) viClass = 'High';
  else if (avgVi >= 1.75) viClass = 'Medium';

  // Quality gate checks
  const totalDefectsCount = allDefects.length;
  const defectsWithPhotoCu = allDefects.filter((d) => !!d.cuPhotoUrl).length;
  const isDefectPhotoComplete = totalDefectsCount === 0 || defectsWithPhotoCu === totalDefectsCount;

  // Incomplete Survey Data Warning State & Engine
  interface IncompleteWarning {
    type: 'ZONE_CTX_PHOTO' | 'ZONE_ROOM' | 'DEFECT_CU_PHOTO' | 'DEFECT_WIDTH' | 'DEFECT_TYPE';
    floorIndex: number;
    floorName: string;
    zoneIndex: number;
    zoneCode: string;
    defectIndex?: number;
    defectCode?: string;
    message: string;
  }

  interface PendingAction {
    type: 'SWITCH_FLOOR' | 'ADD_FLOOR' | 'CHANGE_STEP';
    targetFloorIndex?: number;
    targetStep?: number;
  }

  const [incompleteWarnings, setIncompleteWarnings] = useState<IncompleteWarning[]>([]);
  const [showIncompleteModal, setShowIncompleteModal] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const checkFloorIncompleteness = (floorIdx: number): IncompleteWarning[] => {
    const targetFloor = floors[floorIdx];
    if (!targetFloor) return [];
    const warnings: IncompleteWarning[] = [];

    targetFloor.zones.forEach((zone, zIdx) => {
      // 1. Zone Context Photo
      if (!zone.ctxPhotoUrl) {
        warnings.push({
          type: 'ZONE_CTX_PHOTO',
          floorIndex: floorIdx,
          floorName: targetFloor.floorName,
          zoneIndex: zIdx,
          zoneCode: zone.zoneCode,
          message: `${zone.zoneCode} (${zone.roomName || 'Chưa đặt tên'}): Chưa chụp ảnh bối cảnh mảng tường / cấu kiện (Photo CTX).`,
        });
      }

      // 2. Zone Room Name
      if (!zone.roomName || zone.roomName.trim() === '' || zone.roomName === 'Chưa đặt tên') {
        warnings.push({
          type: 'ZONE_ROOM',
          floorIndex: floorIdx,
          floorName: targetFloor.floorName,
          zoneIndex: zIdx,
          zoneCode: zone.zoneCode,
          message: `${zone.zoneCode}: Chưa chọn hoặc nhập tên phòng / không gian cụ thể.`,
        });
      }

      // 3. Defects on this Zone
      zone.defects.forEach((defect, dIdx) => {
        const defCode = defect.defectCode || `D-${String(dIdx + 1).padStart(2, '0')}`;
        const missingDetails: string[] = [];
        if (!defect.cuPhotoUrl) {
          missingDetails.push('chưa chụp ảnh cận cảnh (Photo CU)');
        }
        if (!defect.widthMaxMm || defect.widthMaxMm <= 0) {
          missingDetails.push('chưa đo bề rộng vết nứt (w = 0 mm)');
        }
        if (!defect.defectType || defect.defectType.trim() === '') {
          missingDetails.push('chưa chọn dạng khuyết tật');
        }

        if (missingDetails.length > 0) {
          warnings.push({
            type: !defect.cuPhotoUrl ? 'DEFECT_CU_PHOTO' : 'DEFECT_WIDTH',
            floorIndex: floorIdx,
            floorName: targetFloor.floorName,
            zoneIndex: zIdx,
            zoneCode: zone.zoneCode,
            defectIndex: dIdx,
            defectCode: defCode,
            message: `${zone.zoneCode} ➔ Ghim ${defCode}: ${missingDetails.join(', ')}.`,
          });
        }
      });
    });

    return warnings;
  };

  const checkAllFloorsIncompleteness = (): IncompleteWarning[] => {
    const allWarnings: IncompleteWarning[] = [];
    floors.forEach((_, fIdx) => {
      allWarnings.push(...checkFloorIncompleteness(fIdx));
    });
    return allWarnings;
  };

  // Floor & Zone Handlers
  const handleAddFloor = () => {
    const nextFloorNumber = floors.length + 1;
    const floorLabel = nextFloorNumber === 2 ? 'Lầu 1 - Tầng 2' : nextFloorNumber === 3 ? 'Lầu 2 - Tầng 3' : nextFloorNumber === 4 ? 'Lầu 3 - Tầng 4' : `Tầng ${nextFloorNumber}`;
    const newFloor: FloorSurveyData = {
      id: `floor-${Date.now()}`,
      floorName: floorLabel,
      overviewPhotos: [],
      cadSketchPhotoUrl: '',
      cadZonePins: [],
      zones: [],
    };
    const updated = [...floors, newFloor];
    setFloors(updated);
    setActiveFloorIndex(updated.length - 1);
    setActiveZoneIndex(0);
  };

  const switchFloorWithCheck = (targetFloorIndex: number) => {
    if (targetFloorIndex === activeFloorIndex) return;
    const warnings = checkFloorIncompleteness(activeFloorIndex);
    if (warnings.length > 0) {
      setIncompleteWarnings(warnings);
      setPendingAction({ type: 'SWITCH_FLOOR', targetFloorIndex });
      setShowIncompleteModal(true);
    } else {
      setActiveFloorIndex(targetFloorIndex);
      setActiveZoneIndex(0);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleAddFloorWithCheck = () => {
    const warnings = checkFloorIncompleteness(activeFloorIndex);
    if (warnings.length > 0) {
      setIncompleteWarnings(warnings);
      setPendingAction({ type: 'ADD_FLOOR' });
      setShowIncompleteModal(true);
    } else {
      handleAddFloor();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleStepChangeWithCheck = (targetStep: number) => {
    if (targetStep === currentStep) return;
    if (currentStep === 3) {
      const warnings = checkAllFloorsIncompleteness();
      if (warnings.length > 0) {
        setIncompleteWarnings(warnings);
        setPendingAction({ type: 'CHANGE_STEP', targetStep });
        setShowIncompleteModal(true);
        return;
      }
    }
    setCurrentStep(targetStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const executePendingAction = () => {
    if (pendingAction) {
      if (pendingAction.type === 'SWITCH_FLOOR' && pendingAction.targetFloorIndex !== undefined) {
        setActiveFloorIndex(pendingAction.targetFloorIndex);
        setActiveZoneIndex(0);
      } else if (pendingAction.type === 'ADD_FLOOR') {
        handleAddFloor();
      } else if (pendingAction.type === 'CHANGE_STEP' && pendingAction.targetStep !== undefined) {
        setCurrentStep(pendingAction.targetStep);
      }
    }
    setShowIncompleteModal(false);
    setPendingAction(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStayAndComplete = () => {
    if (incompleteWarnings.length > 0) {
      const first = incompleteWarnings[0];
      setActiveFloorIndex(first.floorIndex);
      if (first.zoneIndex !== undefined) {
        setActiveZoneIndex(first.zoneIndex);
      }
    }
    setShowIncompleteModal(false);
    setPendingAction(null);
  };

  const handleRemoveFloor = (floorIdx: number) => {
    if (floors.length <= 1) return;
    const updated = floors.filter((_, i) => i !== floorIdx);
    setFloors(updated);
    setActiveFloorIndex(Math.max(0, floorIdx - 1));
    setActiveZoneIndex(0);
  };

  const handleUpdateFloorName = (floorIdx: number, newName: string) => {
    const updated = [...floors];
    updated[floorIdx] = {
      ...updated[floorIdx],
      floorName: newName,
      zones: updated[floorIdx].zones.map((z) => ({ ...z, floorName: newName })),
    };
    setFloors(updated);
  };

  const handleAddFloorOverviewPhoto = (floorIdx: number) => {
    const updated = [...floors];
    const currentPhotos = updated[floorIdx].overviewPhotos || [];
    updated[floorIdx].overviewPhotos = [
      ...currentPhotos,
      { id: `ov-${Date.now()}`, url: '', caption: `Ảnh tổng quan ${currentPhotos.length + 1}` },
    ];
    setFloors(updated);
  };

  const handleUpdateFloorOverviewPhoto = (floorIdx: number, photoIdx: number, url: string) => {
    const updated = [...floors];
    updated[floorIdx].overviewPhotos[photoIdx].url = url;
    setFloors(updated);
  };

  const handleRemoveFloorOverviewPhoto = (floorIdx: number, photoIdx: number) => {
    const updated = [...floors];
    updated[floorIdx].overviewPhotos = updated[floorIdx].overviewPhotos.filter((_, i) => i !== photoIdx);
    setFloors(updated);
  };

  const handleUpdateFloorCadPhoto = (floorIdx: number, url: string) => {
    const updated = [...floors];
    updated[floorIdx].cadSketchPhotoUrl = url;
    setFloors(updated);
  };

  const handleUpdateFloorCadPins = (floorIdx: number, pins: CadZonePin[]) => {
    const updated = [...floors];
    updated[floorIdx].cadZonePins = pins;
    setFloors(updated);
  };

  const handleAddZoneToFloor = (floorIdx: number) => {
    const updated = [...floors];
    const nextZoneNumber = allZones.length + 1;
    const currentFloorName = updated[floorIdx].floorName;
    const newZone: DamageZoneData = {
      id: `z-${String(nextZoneNumber).padStart(2, '0')}`,
      zoneCode: `Z-${String(nextZoneNumber).padStart(2, '0')}`,
      floorName: currentFloorName,
      roomName: 'Khu vực khảo sát mới',
      componentType: 'Tường gạch vữa xi măng',
      wallMaterial: 'Gạch tuynel vữa xi măng',
      functionalImpactRepairNeeded: false,
      burlandGrade: 0,
      ctxPhotoUrl: '',
      notes: '',
      defects: [],
    };
    updated[floorIdx].zones = [...updated[floorIdx].zones, newZone];
    setFloors(updated);
    setActiveZoneIndex(updated[floorIdx].zones.length - 1);
  };

  const handleRemoveZoneFromFloor = (floorIdx: number, zoneIdx: number) => {
    const updated = [...floors];
    if (updated[floorIdx].zones.length <= 1) return;
    updated[floorIdx].zones = updated[floorIdx].zones.filter((_, i) => i !== zoneIdx);
    setFloors(updated);
    setActiveZoneIndex(Math.max(0, zoneIdx - 1));
  };

  const handleUpdateZoneInFloor = (floorIdx: number, zoneIdx: number, field: keyof DamageZoneData, val: any) => {
    const updated = [...floors];
    updated[floorIdx].zones[zoneIdx] = {
      ...updated[floorIdx].zones[zoneIdx],
      [field]: val,
    };
    setFloors(updated);
  };

  // Automatic snapshot generator & localStorage persist
  const saveDraftToLocalStorage = (silent = false) => {
    try {
      const now = new Date();
      const nowTimeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const draft = {
        parcelData,
        specs,
        floors,
        zones: allZones,
        settlementTilt,
        scopeGIS,
        e6ManualScore,
        engineeringJudgement,
        judgementReason,
        viScores,
        summaryData,
        preparedByName,
        preparedByDate,
        ownerSignName,
        ownerSignDate,
        ownerFeedback,
        sigPreparedBy,
        sigOwner,
        p01: { url: p01HouseNumberUrl, na: p01NotApplicable, reason: p01NaReason },
        p02: { url: p02MainFacadeUrl, na: p02NotApplicable, reason: p02NaReason, points: p02PolygonPoints, lines: p02FloorLines, strokes: p02FreehandStrokes },
        p03: { na: p03NotApplicable, reason: p03NaReason },
        p03Photos,
        p04: { url: p04ContextStreetUrl, na: p04NotApplicable, reason: p04NaReason },
        currentStep,
        lastSaved: now.toISOString(),
      };
      localStorage.setItem(draftKey, JSON.stringify(draft));
      setLastAutosaveTime(nowTimeStr);
      if (!silent) {
        setSaveToastMessage(`✓ Đã lưu bản nháp thành công lúc ${nowTimeStr} (Thửa: ${parcelData.projectParcelCode})`);
        setTimeout(() => setSaveToastMessage(null), 3500);
      }
    } catch (_e) {}
  };

  const handleSaveDraft = () => {
    setIsSaving(true);
    saveDraftToLocalStorage(false);
    setTimeout(() => setIsSaving(false), 300);
  };

  // Debounced Autosave (1000ms delay) whenever any field is modified
  useEffect(() => {
    const timer = setTimeout(() => {
      saveDraftToLocalStorage(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, [
    parcelData,
    specs,
    floors,
    settlementTilt,
    scopeGIS,
    e6ManualScore,
    engineeringJudgement,
    judgementReason,
    viScores,
    summaryData,
    preparedByName,
    preparedByDate,
    ownerSignName,
    ownerSignDate,
    ownerFeedback,
    sigPreparedBy,
    sigOwner,
    p01HouseNumberUrl,
    p01NotApplicable,
    p01NaReason,
    p02MainFacadeUrl,
    p02NotApplicable,
    p02NaReason,
    p02PolygonPoints,
    p02FloorLines,
    p02FreehandStrokes,
    p03NotApplicable,
    p03NaReason,
    p03Photos,
    p04ContextStreetUrl,
    p04NotApplicable,
    p04NaReason,
    currentStep,
  ]);

  // Check & Notify Surveyor if a saved draft is recovered
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.lastSaved) {
          const formatted = new Date(parsed.lastSaved).toLocaleTimeString('vi-VN');
          setSaveToastMessage(`⚡ Tự động khôi phục bản nháp chưa nộp (Lưu lúc ${formatted})`);
          setTimeout(() => setSaveToastMessage(null), 4500);
        }
      }
    } catch (_e) {}
  }, [draftKey]);

  const handleSubmitReport = async () => {
    setIsSaving(true);
    try {
      await api.post(`/reports/phase1/${reportId}/submit`, {
        parcelData,
        specs,
        floors,
        zones: allZones,
        settlementTilt,
        scopeGIS,
        ecs: {
          totalEcsScore,
          ecsClass,
          adjustedEcsClass,
          e1Score,
          e2Score,
          e3Score,
          e4Score,
          e5Score,
          e6Score,
          engineeringJudgement,
          judgementReason,
        },
        vi: { totalVi, avgVi, viClass, viScores },
        summary: summaryData,
        signatures: {
          preparedByName,
          preparedByDate,
          sigPreparedBy,
          ownerSignName,
          ownerSignDate,
          ownerFeedback,
          sigOwner,
        },
      });
      try {
        localStorage.removeItem(draftKey);
      } catch (_e) {}
      setIsSubmitted(true);
    } catch (_err) {
      try {
        localStorage.removeItem(draftKey);
      } catch (_e) {}
      setIsSubmitted(true);
    } finally {
      setIsSaving(false);
    }
  };

  if (isSubmitted) {
    return (
      <div style={{ maxWidth: '680px', margin: '2rem auto', padding: '2rem 1.5rem', textAlign: 'center' }}>
        <div
          style={{
            width: '76px',
            height: '76px',
            borderRadius: '50%',
            backgroundColor: '#dcfce7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem auto',
            border: '2px solid #86efac',
          }}
        >
          <CheckCircle size={44} color="#15803d" />
        </div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
          ĐÃ NỘP HỒ SƠ KHẢO SÁT PHASE 1 THÀNH CÔNG!
        </h2>
        <p style={{ fontSize: '0.875rem', color: '#475569', marginTop: '0.5rem', lineHeight: 1.5 }}>
          Hồ sơ khảo sát hiện trạng công trình <strong>{parcelData.projectParcelCode}</strong> ({parcelData.houseNumber} {parcelData.street}) đã được gửi lên hệ thống và chuyển trạng thái <strong>Chờ Zone Admin phê duyệt</strong>.
        </p>

        <div
          className="card"
          style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            padding: '1.25rem',
            margin: '1.5rem 0',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            fontSize: '0.825rem',
          }}
        >
          <div>• <strong>Mã hồ sơ:</strong> REPORT-PHASE1-{parcelData.projectParcelCode}</div>
          <div>• <strong>Số tầng khảo sát:</strong> {floors.length} Tầng</div>
          <div>• <strong>Số vùng khảo sát:</strong> {allZones.length} Vùng (Z-01 → Z-{String(allZones.length).padStart(2, '0')})</div>
          <div>• <strong>Số khuyết tật ghi nhận:</strong> {allDefects.length} vết nứt</div>
          <div>• <strong>Chỉ số kỹ thuật:</strong> ECS = {totalEcsScore}/24 ({adjustedEcsClass}) | VI = {avgVi} ({viClass})</div>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={onFinished}
          style={{ padding: '0.65rem 1.5rem', fontWeight: 700 }}
        >
          Quay về Trang chủ Khảo sát
        </button>
      </div>
    );
  }

  const stepsList = [
    { num: 1, title: 'Tiếp cận ngoài nhà' },
    { num: 2, title: 'Phỏng vấn chủ hộ' },
    { num: 3, title: 'Hiện trạng từng tầng' },
    { num: 4, title: 'Lún – Nghiêng – Võng' },
    { num: 5, title: 'Phạm vi & Ranh GIS' },
    { num: 6, title: 'Tính điểm ECS & VI' },
    { num: 7, title: 'Kết luận & Kiến nghị' },
    { num: 8, title: 'Ký biên bản hiện trường' },
  ];

  const adjacentStructureOptions = [
    'Nhà phố / Nhà dân',
    'Cao tầng / Chung cư',
    'Bệnh viện / Y tế',
    'Trường học / Giáo dục',
    'Công viên / Cây xanh',
    'Đất trống',
    'Cơ sở tôn giáo (Chùa, Nhà thờ)',
    'Hẻm / Đường nội bộ',
    'Không biết / Không rõ (Bị che khuất)',
    'Khác (nhập chi tiết...)',
  ];

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', padding: '1rem 1rem 6rem 1rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
      {/* Toast Save Message */}
      {saveToastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 4000,
            backgroundColor: '#065f46',
            color: '#ecfdf5',
            padding: '0.65rem 1rem',
            borderRadius: '0.65rem',
            boxShadow: '0 10px 25px rgba(0,0,0,0.18)',
            fontSize: '0.825rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <CheckCircle size={16} color="#34d399" />
          <span>{saveToastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span className="badge badge-primary">PHASE 1</span>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
              {parcelData.projectParcelCode}
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Số {parcelData.houseNumber} {parcelData.street} • Chủ hộ: {parcelData.ownerName}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Live Autosave Status Indicator */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              padding: '0.3rem 0.55rem',
              borderRadius: '999px',
              fontSize: '0.725rem',
              color: '#15803d',
              fontWeight: 600,
            }}
            title="Dữ liệu khảo sát được tự động sao lưu tức thì vào bộ nhớ máy sau mỗi thao tác"
          >
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
            <span>{lastAutosaveTime ? `Tự động lưu: ${lastAutosaveTime}` : 'Đã bảo vệ dữ liệu'}</span>
          </div>

          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="btn btn-secondary btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              backgroundColor: '#f1f5f9',
              fontWeight: 700,
            }}
          >
            <Save size={14} color="#0284c7" />
            <span>{isSaving ? 'Đang lưu...' : 'Lưu nháp'}</span>
          </button>
          {onFinished && (
            <button type="button" onClick={onFinished} className="btn btn-secondary btn-sm">
              Thoát
            </button>
          )}
        </div>
      </div>

      {/* 9 Steps Navigation Pill Bar */}
      <div
        style={{
          display: 'flex',
          gap: '0.35rem',
          overflowX: 'auto',
          paddingBottom: '0.35rem',
          scrollbarWidth: 'thin',
        }}
      >
        {stepsList.map((st) => {
          const isActive = currentStep === st.num;
          const isPassed = currentStep > st.num;
          return (
            <button
              key={st.num}
              type="button"
              onClick={() => handleStepChangeWithCheck(st.num)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.4rem 0.75rem',
                borderRadius: '999px',
                fontSize: '0.75rem',
                fontWeight: isActive ? 800 : 500,
                whiteSpace: 'nowrap',
                border: isActive ? '1.5px solid #0284c7' : isPassed ? '1px solid #bbf7d0' : '1px solid #cbd5e1',
                backgroundColor: isActive ? '#e0f2fe' : isPassed ? '#f0fdf4' : '#ffffff',
                color: isActive ? '#0369a1' : isPassed ? '#166534' : '#475569',
                cursor: 'pointer',
              }}
            >
              <span>{st.num}.</span>
              <span>{st.title}</span>
            </button>
          );
        })}
      </div>

      {/* STEP CONTENT CONTAINER */}
      <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
        {/* ===================== STEP 1: TIẾP CẬN NGOÀI NHÀ & NHẬN DIỆN ===================== */}
        {currentStep === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                BƯỚC 1: Tiếp Cận Ngoài Nhà & Nhận Diện Công Trình
              </h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.775rem', color: '#64748b' }}>
                Ghi nhận thông tin pháp lý, chủ sở hữu, đối soát GIS và chụp 4 ảnh định danh theo đúng thứ tự (P-01 → P-04).
              </p>
            </div>

            {/* General Info Form Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
              {/* Row 1: Codes */}
              <div>
                <label className="form-label">Mã Quản lý Dự án (Project Parcel Code):</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ backgroundColor: '#f8fafc', fontWeight: 700 }}
                  value={parcelData.projectParcelCode}
                  onChange={(e) => setParcelData({ ...parcelData, projectParcelCode: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label">Mã Địa chính Gốc (Official Cadastral Code):</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ backgroundColor: '#f8fafc', fontWeight: 700 }}
                  value={parcelData.officialCadastralCode}
                  onChange={(e) => setParcelData({ ...parcelData, officialCadastralCode: e.target.value })}
                />
              </div>

              {/* Row 2: Building Name (Proper Name / Signage) */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Tên công trình / Biển hiệu (Building Name / Signage):</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="VD: ABC Shop, Ngân hàng XXX, BHXanh, Cty May DEF... (để trống nếu nhà dân không có biển hiệu)"
                  value={parcelData.buildingName || ''}
                  onChange={(e) => setParcelData({ ...parcelData, buildingName: e.target.value })}
                />
                <span style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
                  * Tên riêng hoặc tên biển hiệu thương mại gắn trên công trình (để trống nếu nhà ở tư nhân không gắn biển tên).
                </span>
              </div>

              {/* Row 3: Owner & Address */}
              <div>
                <label className="form-label">Chủ sở hữu / Người sử dụng (Owner / User):</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Nhập họ tên chủ nhà hoặc người đại diện..."
                  value={parcelData.ownerName}
                  onChange={(e) => setParcelData({ ...parcelData, ownerName: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label">Địa chỉ công trình (Address):</label>
                <input
                  type="text"
                  className="form-control"
                  value={`${parcelData.houseNumber} ${parcelData.street}, ${parcelData.ward}, ${parcelData.district}`}
                  onChange={(e) => {
                    const val = e.target.value;
                    setParcelData({ ...parcelData, street: val });
                  }}
                />
              </div>

              {/* Row 4: 4 Survey Object Categories */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Nhóm đối tượng / Phân loại & Xếp hạng sơ bộ:</label>
                <select
                  className="form-control"
                  value={parcelData.importanceGroup}
                  onChange={(e) => setParcelData({ ...parcelData, importanceGroup: e.target.value })}
                >
                  <option value="Critical">1. Critical Building / Công trình trọng yếu</option>
                  <option value="Important">2. Important Building / Công trình quan trọng</option>
                  <option value="General">3. General Building / Công trình thông thường</option>
                  <option value="Poor_Structural">4. Poor Structural Integrity / Kết cấu hiện trạng kém</option>
                </select>

                <div style={{ marginTop: '0.35rem', fontSize: '0.725rem', color: '#0369a1', backgroundColor: '#e0f2fe', padding: '0.35rem 0.55rem', borderRadius: '0.4rem', border: '1px solid #bae6fd' }}>
                  {parcelData.importanceGroup === 'Critical' && (
                    <span>• <strong>Tiêu chí:</strong> Bệnh viện, công trình bảo tồn, vận hành đặc biệt, hoặc hậu quả cao nếu bị ảnh hưởng.</span>
                  )}
                  {parcelData.importanceGroup === 'Important' && (
                    <span>• <strong>Tiêu chí:</strong> Từ 5 tầng trở lên hoặc có thiết bị/vật liệu nhạy cảm.</span>
                  )}
                  {parcelData.importanceGroup === 'General' && (
                    <span>• <strong>Tiêu chí:</strong> Công trình dân dụng thông thường dưới 5 tầng.</span>
                  )}
                  {parcelData.importanceGroup === 'Poor_Structural' && (
                    <span style={{ color: '#b91c1c' }}>• <strong>Tiêu chí:</strong> Có hư hỏng / suy giảm chất lượng kết cấu rõ rệt.</span>
                  )}
                </div>
              </div>

              {/* Row 5: Multi-direction Adjacent Structures (Trái, Phải, Sau) */}
              <div style={{ gridColumn: '1 / -1', backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>
                  🏢 Công trình liền kề theo các hướng tiếp giáp:
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  {/* Bên Trái */}
                  <div>
                    <label style={{ fontSize: '0.775rem', fontWeight: 700, color: '#334155' }}>
                      👈 Liền kề Bên Trái:
                    </label>
                    <select
                      className="form-control"
                      style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}
                      value={parcelData.adjacentLeft?.type || 'Nhà phố / Nhà dân'}
                      onChange={(e) =>
                        setParcelData({
                          ...parcelData,
                          adjacentLeft: { ...parcelData.adjacentLeft, type: e.target.value },
                        })
                      }
                    >
                      {adjacentStructureOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    {parcelData.adjacentLeft?.type?.includes('Khác') && (
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Mô tả cụ thể bên trái..."
                        style={{ marginTop: '0.35rem', fontSize: '0.775rem' }}
                        value={parcelData.adjacentLeft?.otherText || ''}
                        onChange={(e) =>
                          setParcelData({
                            ...parcelData,
                            adjacentLeft: { ...parcelData.adjacentLeft, otherText: e.target.value },
                          })
                        }
                      />
                    )}
                  </div>

                  {/* Bên Phải */}
                  <div>
                    <label style={{ fontSize: '0.775rem', fontWeight: 700, color: '#334155' }}>
                      👉 Liền kề Bên Phải:
                    </label>
                    <select
                      className="form-control"
                      style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}
                      value={parcelData.adjacentRight?.type || 'Nhà phố / Nhà dân'}
                      onChange={(e) =>
                        setParcelData({
                          ...parcelData,
                          adjacentRight: { ...parcelData.adjacentRight, type: e.target.value },
                        })
                      }
                    >
                      {adjacentStructureOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    {parcelData.adjacentRight?.type?.includes('Khác') && (
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Mô tả cụ thể bên phải..."
                        style={{ marginTop: '0.35rem', fontSize: '0.775rem' }}
                        value={parcelData.adjacentRight?.otherText || ''}
                        onChange={(e) =>
                          setParcelData({
                            ...parcelData,
                            adjacentRight: { ...parcelData.adjacentRight, otherText: e.target.value },
                          })
                        }
                      />
                    )}
                  </div>

                  {/* Phía Sau */}
                  <div>
                    <label style={{ fontSize: '0.775rem', fontWeight: 700, color: '#334155' }}>
                      🔙 Liền kề Phía Sau:
                    </label>
                    <select
                      className="form-control"
                      style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}
                      value={parcelData.adjacentRear?.type || 'Nhà phố / Nhà dân'}
                      onChange={(e) =>
                        setParcelData({
                          ...parcelData,
                          adjacentRear: { ...parcelData.adjacentRear, type: e.target.value },
                        })
                      }
                    >
                      {adjacentStructureOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    {parcelData.adjacentRear?.type?.includes('Khác') && (
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Mô tả cụ thể phía sau..."
                        style={{ marginTop: '0.35rem', fontSize: '0.775rem' }}
                        value={parcelData.adjacentRear?.otherText || ''}
                        onChange={(e) =>
                          setParcelData({
                            ...parcelData,
                            adjacentRear: { ...parcelData.adjacentRear, otherText: e.target.value },
                          })
                        }
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* GIS Auto Metadata Badge */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '0.65rem',
                padding: '0.75rem 1rem',
                fontSize: '0.775rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <MapPin size={13} color="#0284c7" />
                <span><strong>Lý trình:</strong> {parcelData.chainage}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Ruler size={13} color="#0284c7" />
                <span><strong>Khoảng cách tim Metro:</strong> {parcelData.distToMetroCenterlineM} m</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Maximize2 size={13} color="#0284c7" />
                <span><strong>Khoảng cách ranh GPMB:</strong> {parcelData.distToClearanceBoundaryM} m</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Activity size={13} color="#0284c7" />
                <span><strong>Tọa độ GPS:</strong> {parcelData.gpsCoords}</span>
              </div>
            </div>

            {/* Strict Sequential 4 Photos P01 -> P02 -> P03 -> P04 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.85rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                4 Bộ Ảnh Định Danh Hiện Trường (P-01 → P-04):
              </h4>

              {/* 1. P-01: Biển số nhà / Tên cơ quan */}
              <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                <PhotoCaptureInput
                  label="1. P-01: Biển số nhà / Biển tên cơ quan"
                  value={p01HouseNumberUrl}
                  onChange={setP01HouseNumberUrl}
                  allowNotApplicable={true}
                  isNotApplicable={p01NotApplicable}
                  onToggleNotApplicable={setP01NotApplicable}
                  naReason={p01NaReason}
                  onNaReasonChange={setP01NaReason}
                  watermarkText={`P-01 | ${parcelData.projectParcelCode}`}
                  required={true}
                  height="200px"
                />
              </div>

              {/* 2. P-02: Mặt đứng chính diện + Interactive Polygon Canvas (Freehand Draw) */}
              <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                <PhotoCaptureInput
                  label="2. P-02: Mặt đứng chính diện công trình"
                  value={p02MainFacadeUrl}
                  onChange={setP02MainFacadeUrl}
                  allowNotApplicable={true}
                  isNotApplicable={p02NotApplicable}
                  onToggleNotApplicable={setP02NotApplicable}
                  naReason={p02NaReason}
                  onNaReasonChange={setP02NaReason}
                  watermarkText={`P-02 | ${parcelData.projectParcelCode}`}
                  required={true}
                  height="220px"
                />

                {p02MainFacadeUrl && !p02NotApplicable && (
                  <div style={{ marginTop: '0.85rem' }}>
                    <FacadePolygonCanvas
                      imageUrl={p02MainFacadeUrl}
                      polygonPoints={p02PolygonPoints}
                      floorSplitLines={p02FloorLines}
                      freehandStrokes={p02FreehandStrokes}
                      onChange={(pts, lines, strokes) => {
                        setP02PolygonPoints(pts);
                        setP02FloorLines(lines);
                        setP02FreehandStrokes(strokes);
                      }}
                    />
                  </div>
                )}
              </div>

              {/* 3. P-03: Mặt bên hoặc mặt sau tiếp cận (HỖ TRỢ NHIỀU ẢNH: HÔNG TRÁI, HÔNG PHẢI, PHÍA SAU) */}
              <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    3. P-03: Mặt bên hông hoặc mặt sau tiếp cận ({p03Photos.length} ảnh)
                  </label>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <label style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={p03NotApplicable}
                        onChange={(e) => {
                          setP03NotApplicable(e.target.checked);
                          if (e.target.checked) setP03Photos([]);
                          else setP03Photos([{ id: 'p03-1', url: '', label: 'Bên hông trái' }]);
                        }}
                        style={{ accentColor: '#0284c7' }}
                      />
                      <span>Không tồn tại / N/A (Sát vách 2 bên)</span>
                    </label>

                    {!p03NotApplicable && (
                      <button
                        type="button"
                        onClick={() => {
                          const nextIdx = p03Photos.length + 1;
                          const nextLabel = nextIdx === 2 ? 'Bên hông phải' : nextIdx === 3 ? 'Phía sau tiếp cận' : 'Góc tiếp cận khác';
                          setP03Photos([...p03Photos, { id: `p03-${nextIdx}`, url: '', label: nextLabel }]);
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}
                      >
                        <Plus size={13} />
                        <span>Thêm góc chụp</span>
                      </button>
                    )}
                  </div>
                </div>

                {p03NotApplicable ? (
                  <div style={{ padding: '0.75rem', backgroundColor: '#ffffff', borderRadius: '0.5rem', border: '1px dashed #cbd5e1' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                      Lý do không chụp mặt hông/sau:
                    </span>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ví dụ: Nhà phố liền kề 2 bên sát vách, phía sau giáp nhà dân khác..."
                      value={p03NaReason}
                      onChange={(e) => setP03NaReason(e.target.value)}
                      style={{ fontSize: '0.775rem', marginTop: '0.25rem' }}
                    />
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
                    {p03Photos.map((photoItem, idx) => (
                      <div
                        key={photoItem.id || idx}
                        style={{
                          backgroundColor: '#ffffff',
                          borderRadius: '0.65rem',
                          border: '1px solid #cbd5e1',
                          padding: '0.65rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.45rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <select
                            className="form-control"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', fontWeight: 700, color: '#0369a1', width: 'auto' }}
                            value={photoItem.label}
                            onChange={(e) => {
                              const updated = [...p03Photos];
                              updated[idx].label = e.target.value;
                              setP03Photos(updated);
                            }}
                          >
                            <option value="Bên hông trái">📐 Bên hông trái</option>
                            <option value="Bên hông phải">📐 Bên hông phải</option>
                            <option value="Phía sau tiếp cận">🏡 Phía sau tiếp cận</option>
                            <option value="Góc tiếp cận khác">🔍 Góc tiếp cận khác</option>
                          </select>

                          {p03Photos.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setP03Photos(p03Photos.filter((_, i) => i !== idx))}
                              className="btn btn-sm"
                              style={{ backgroundColor: '#fee2e2', color: '#b91c1c', border: 'none', padding: '0.25rem 0.45rem' }}
                              title="Xóa góc chụp này"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>

                        <PhotoCaptureInput
                          value={photoItem.url}
                          onChange={(url) => {
                            const updated = [...p03Photos];
                            updated[idx].url = url;
                            setP03Photos(updated);
                          }}
                          watermarkText={`P-03 (${photoItem.label}) | ${parcelData.projectParcelCode}`}
                          height="180px"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. P-04: Bối cảnh tổng thể đường/ngõ */}
              <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                <PhotoCaptureInput
                  label="4. P-04: Bối cảnh không gian tổng thể lấy cả đường/ngõ"
                  value={p04ContextStreetUrl}
                  onChange={setP04ContextStreetUrl}
                  allowNotApplicable={true}
                  isNotApplicable={p04NotApplicable}
                  onToggleNotApplicable={setP04NotApplicable}
                  naReason={p04NaReason}
                  onNaReasonChange={setP04NaReason}
                  watermarkText={`P-04 | ${parcelData.projectParcelCode}`}
                  height="200px"
                />
              </div>
            </div>
          </div>
        )}

        {/* ===================== STEP 2: PHỎNG VẤN CHỦ HỘ ===================== */}
        {currentStep === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                BƯỚC 2: Phỏng Vấn Chủ Hộ (Kiến Trúc, Lịch Sử & Yếu Tố Nhạy Cảm)
              </h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.775rem', color: '#64748b' }}>
                Ghi nhận đặc trưng móng, kết cấu và lịch sử công trình (tự động map điểm E5 trong bảng ECS).
              </p>
            </div>

            <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>
              2.1. Kiến Trúc & Kết Cấu Nền:
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
              {/* 1. Công năng sử dụng */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Công năng sử dụng (Use Category):</label>
                <select
                  className="form-control"
                  value={specs.useCategory}
                  onChange={(e) => setSpecs({ ...specs, useCategory: e.target.value })}
                >
                  <option value="Nhà ở gia đình">🏠 Nhà ở gia đình (Nhà phố / Biệt thự / Căn hộ)</option>
                  <option value="Cửa hàng / Shop / Bách hóa">🛒 Cửa hàng / Shop / Bách hóa</option>
                  <option value="Quán ăn / Nhà hàng / Cafe">☕ Quán ăn / Nhà hàng / Cafe</option>
                  <option value="Văn phòng / Trụ sở cty">🏢 Văn phòng / Trụ sở công ty</option>
                  <option value="Khách sạn / Nhà nghỉ / Căn hộ DV">🏨 Khách sạn / Nhà nghỉ / Căn hộ dịch vụ</option>
                  <option value="Bệnh viện / Phòng khám / Y tế">🏥 Bệnh viện / Phòng khám / Y tế</option>
                  <option value="Trường học / Trung tâm đào tạo">🏫 Trường học / Trung tâm đào tạo</option>
                  <option value="Kho hàng / Xưởng sản xuất">🏭 Kho hàng / Xưởng sản xuất</option>
                  <option value="Cơ sở tôn giáo (Chùa, Nhà thờ)">⛩️ Cơ sở tôn giáo (Chùa, Nhà thờ)</option>
                  <option value="Công trình công cộng / Hành chính">🏛️ Công trình công cộng / Hành chính nhà nước</option>
                  <option value="Khác">🔍 Khác (Nhập chi tiết...)</option>
                </select>

                {specs.useCategory === 'Khác' && (
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Nhập mô tả công năng chi tiết của công trình..."
                    style={{ marginTop: '0.35rem', fontSize: '0.8rem' }}
                    value={specs.useCategoryOther || ''}
                    onChange={(e) => setSpecs({ ...specs, useCategoryOther: e.target.value })}
                  />
                )}
              </div>

              {/* 2. Số tầng nổi */}
              <div>
                <label className="form-label">Số tầng nổi:</label>
                <input
                  type="number"
                  min="1"
                  className="form-control"
                  value={specs.floorCount}
                  onChange={(e) => setSpecs({ ...specs, floorCount: parseInt(e.target.value, 10) || 1 })}
                />
              </div>

              {/* 3. Số tầng hầm */}
              <div>
                <label className="form-label">Số tầng hầm:</label>
                <input
                  type="number"
                  min="0"
                  className="form-control"
                  value={specs.basementCount}
                  onChange={(e) => setSpecs({ ...specs, basementCount: parseInt(e.target.value, 10) || 0 })}
                />
              </div>

              {/* 4. Năm xây dựng & Ước tính */}
              <div>
                <label className="form-label">Năm xây dựng (Age):</label>
                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                  <input
                    type="number"
                    min="1900"
                    max="2030"
                    className="form-control"
                    value={specs.yearOfConstruction}
                    onChange={(e) => setSpecs({ ...specs, yearOfConstruction: parseInt(e.target.value, 10) || 2010 })}
                  />
                  <label style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={specs.isYearEstimated}
                      onChange={(e) => setSpecs({ ...specs, isYearEstimated: e.target.checked })}
                      style={{ accentColor: '#0284c7' }}
                    />
                    Ước tính
                  </label>
                </div>
              </div>

              {/* 5. Hệ kết cấu chịu lực */}
              <div>
                <label className="form-label">Hệ kết cấu chịu lực (System):</label>
                <select
                  className="form-control"
                  value={specs.structuralSystem}
                  onChange={(e) => setSpecs({ ...specs, structuralSystem: e.target.value })}
                >
                  <option value="RC">BTCT (Bê tông cốt thép)</option>
                  <option value="Steel">Khung thép định hình / Tiền chế</option>
                  <option value="Masonry">Tường gạch chịu lực</option>
                  <option value="Mixed">Hỗn hợp (BTCT + Tường gạch)</option>
                  <option value="Other">Khác</option>
                </select>
              </div>

              {/* 6. Dạng chịu lực */}
              <div>
                <label className="form-label">Dạng chịu lực (Form):</label>
                <select
                  className="form-control"
                  value={specs.structuralForm || 'Frame'}
                  onChange={(e) => setSpecs({ ...specs, structuralForm: e.target.value })}
                >
                  <option value="Frame">Hệ khung (Cột - Dầm - Sàn)</option>
                  <option value="Wall">Tường gạch chịu lực</option>
                  <option value="Mixed">Hỗn hợp khung & tường</option>
                  <option value="Other">Dạng chịu lực khác</option>
                </select>
              </div>

              {/* 7. Loại móng */}
              <div>
                <label className="form-label">Loại móng (Foundation):</label>
                <select
                  className="form-control"
                  value={specs.foundationType}
                  onChange={(e) => setSpecs({ ...specs, foundationType: e.target.value })}
                >
                  <option value="Shallow">Móng nông (Băng / Đơn / Bè)</option>
                  <option value="Wood">Cừ tràm gia cố</option>
                  <option value="PC">Cọc ép BTCT</option>
                  <option value="CIP">Cọc khoan nhồi</option>
                  <option value="Unknown">Không rõ / Khác</option>
                </select>
              </div>

              {/* 8. Kích thước cọc */}
              <div>
                <label className="form-label">Kích thước cọc (Pile Dimension):</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="VD: D600mm, 250x250mm... (để trống nếu không rõ)"
                  value={specs.pileDimension || ''}
                  onChange={(e) => setSpecs({ ...specs, pileDimension: e.target.value })}
                />
              </div>

              {/* 9. Đánh giá CAT móng */}
              <div>
                <label className="form-label">Điểm CAT móng (1 - 5đ):</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  className="form-control"
                  value={specs.catFoundationScore}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 1;
                    setSpecs({ ...specs, catFoundationScore: val });
                    setViScores({ ...viScores, v3Foundation: val });
                  }}
                />
              </div>

              {/* 10. Bản vẽ hoàn công / Bản vẽ kết cấu */}
              <div style={{ gridColumn: '1 / -1', marginTop: '0.35rem' }}>
                <PhotoCaptureInput
                  label="Bản vẽ hoàn công / Bản vẽ kết cấu (Nếu chủ nhà cung cấp):"
                  value={specs.asBuiltDrawingUrl || ''}
                  onChange={(url) => setSpecs({ ...specs, asBuiltDrawingUrl: url })}
                  allowNotApplicable={true}
                  isNotApplicable={specs.asBuiltDrawingNotApplicable}
                  onToggleNotApplicable={(na) => setSpecs({ ...specs, asBuiltDrawingNotApplicable: na })}
                  naReason={specs.asBuiltDrawingNaReason}
                  onNaReasonChange={(reason) => setSpecs({ ...specs, asBuiltDrawingNaReason: reason })}
                  watermarkText={`DRAWING | ${parcelData.projectParcelCode}`}
                  height="180px"
                />
              </div>
            </div>

            <h4 style={{ margin: '0.75rem 0 0 0', fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>
              2.2. Lịch Sử Biến Động, Sự Cố & Yếu Tố Nhạy Cảm (Map điểm E5):
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
              {/* Cơi nới */}
              <div>
                <label className="form-label">Cơi nới / Thay đổi tải trọng:</label>
                <select
                  className="form-control"
                  value={specs.extendedOrRenovated}
                  onChange={(e) => setSpecs({ ...specs, extendedOrRenovated: parseInt(e.target.value, 10) })}
                >
                  <option value={0}>0đ - Không</option>
                  <option value={1}>1đ - Nhẹ / Đã xử lý</option>
                  <option value={2}>2đ - Nhiều / Chưa rõ</option>
                  <option value={3}>3đ - Thay đổi lớn</option>
                  <option value={4}>4đ - Nghiêm trọng</option>
                </select>
              </div>

              {/* Sửa chữa lớn */}
              <div>
                <label className="form-label">Sửa chữa lớn / Cải tạo kết cấu:</label>
                <select
                  className="form-control"
                  value={specs.renovatedStructure}
                  onChange={(e) => setSpecs({ ...specs, renovatedStructure: parseInt(e.target.value, 10) })}
                >
                  <option value={0}>0đ - Không</option>
                  <option value={1}>1đ - Nhẹ / Đã xử lý</option>
                  <option value={2}>2đ - Nhiều / Chưa rõ</option>
                  <option value={3}>3đ - Cải tạo lớn</option>
                </select>
              </div>

              {/* Lún / Nghiêng trước đây */}
              <div>
                <label className="form-label">Lún / Nghiêng ghi nhận trước đây:</label>
                <select
                  className="form-control"
                  value={specs.previousSettlementOrTilt}
                  onChange={(e) => setSpecs({ ...specs, previousSettlementOrTilt: parseInt(e.target.value, 10) })}
                >
                  <option value={0}>0đ - Không</option>
                  <option value={1}>1đ - Nhẹ / Đã ổn định</option>
                  <option value={2}>2đ - Rõ / Tiếp diễn</option>
                  <option value={3}>3đ - Nghiêm trọng</option>
                </select>
              </div>

              {/* Hư hỏng do lân cận */}
              <div>
                <label className="form-label">Hư hỏng do công trình lân cận:</label>
                <select
                  className="form-control"
                  value={specs.adjacentDamageHistory}
                  onChange={(e) => setSpecs({ ...specs, adjacentDamageHistory: parseInt(e.target.value, 10) })}
                >
                  <option value={0}>0đ - Không</option>
                  <option value={1}>1đ - Nhẹ</option>
                  <option value={2}>2đ - Đáng kể</option>
                  <option value={3}>3đ - Tranh chấp / Nghiêm trọng</option>
                </select>
              </div>

              {/* Sự cố nghiêm trọng (Hỏa hoạn / Ngập lụt / Cháy nổ) */}
              <div>
                <label className="form-label">Sự cố nghiêm trọng (Hỏa hoạn / Ngập lụt):</label>
                <select
                  className="form-control"
                  value={specs.fireOrFloodAccident || 0}
                  onChange={(e) => setSpecs({ ...specs, fireOrFloodAccident: parseInt(e.target.value, 10) })}
                >
                  <option value={0}>0đ - Không có sự cố</option>
                  <option value={1}>1đ - Nhẹ / Đã khắc phục</option>
                  <option value={2}>2đ - Trung bình / Chưa rõ hậu quả</option>
                  <option value={3}>3đ - Sự cố lớn / Ảnh hưởng kết cấu</option>
                </select>
              </div>

              {/* Tình trạng sử dụng hiện tại */}
              <div>
                <label className="form-label">Tình trạng sử dụng hiện tại (Occupancy):</label>
                <select
                  className="form-control"
                  value={specs.occupancyStatus || 'Đang sử dụng 100%'}
                  onChange={(e) => setSpecs({ ...specs, occupancyStatus: e.target.value })}
                >
                  <option value="Đang sử dụng 100%">Đang sử dụng 100%</option>
                  <option value="Đang sử dụng một phần">Đang sử dụng một phần</option>
                  <option value="Bỏ trống / Không sử dụng">Bỏ trống / Không sử dụng</option>
                </select>
              </div>

              {/* Vận hành liên tục 24/7 */}
              <div>
                <label className="form-label">Vận hành liên tục 24/7:</label>
                <select
                  className="form-control"
                  value={specs.continuousOperation247 ? 'true' : 'false'}
                  onChange={(e) => setSpecs({ ...specs, continuousOperation247: e.target.value === 'true' })}
                >
                  <option value="false">Không (Giờ hành chính / Bình thường)</option>
                  <option value="true">Có - Vận hành liên tục 24/7 (Bệnh viện, Khách sạn, Nhà máy...)</option>
                </select>
              </div>

              {/* Thiết bị / Hoạt động nhạy cảm */}
              <div style={{ gridColumn: '1 / -1', backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '0.65rem', border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.825rem', fontWeight: 700, color: '#1e293b', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={specs.sensitiveEquipment || false}
                    onChange={(e) => setSpecs({ ...specs, sensitiveEquipment: e.target.checked })}
                    style={{ accentColor: '#0284c7' }}
                  />
                  <span>Có Thiết bị / Hoạt động nhạy cảm với rung động (Phòng lab, máy chụp MRI/X-Quang, đồ cổ, kho tài liệu...)</span>
                </label>

                {specs.sensitiveEquipment && (
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Mô tả cụ thể thiết bị hoặc hoạt động nhạy cảm..."
                    style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}
                    value={specs.sensitiveEquipmentDesc || ''}
                    onChange={(e) => setSpecs({ ...specs, sensitiveEquipmentDesc: e.target.value })}
                  />
                )}
              </div>
            </div>

            <div style={{ backgroundColor: '#eff6ff', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', fontSize: '0.8rem', color: '#1e40af' }}>
              • <strong>Điểm E5 Lịch sử / Sự cố tự động tính:</strong> {e5Score}/4 điểm.
            </div>
          </div>
        )}

        {/* ===================== STEP 3: PHÂN CẤP TẦNG > VÙNG Z > KHUYẾT TẬT D ===================== */}
        {currentStep === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Step 3 Header */}
            <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                BƯỚC 3: Khảo Sát Hiện Trạng & Đánh Giá Hư Hỏng Theo Tầng
              </h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.775rem', color: '#64748b' }}>
                Quản lý phân cấp: Tầng ➔ Vùng khảo sát Z ➔ Khuyết tật D ➔ Bản vẽ sơ đồ mặt bằng tầng.
              </p>
            </div>

            {/* 1. FLOOR LEVEL TABS & HEADER */}
            <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="badge badge-primary" style={{ fontWeight: 800 }}>
                    TẦNG {activeFloorIndex + 1}/{floors.length}
                  </span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>
                    Chọn tầng đang khảo sát:
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleAddFloorWithCheck}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 700 }}
                >
                  <Plus size={13} />
                  <span>Thêm tầng mới</span>
                </button>
              </div>

              {/* Floor Tabs */}
              <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
                {floors.map((fl, fIdx) => (
                  <button
                    key={fl.id || fIdx}
                    type="button"
                    onClick={() => switchFloorWithCheck(fIdx)}
                    style={{
                      padding: '0.45rem 0.85rem',
                      borderRadius: '0.5rem',
                      fontSize: '0.775rem',
                      fontWeight: activeFloorIndex === fIdx ? 800 : 500,
                      border: activeFloorIndex === fIdx ? '2px solid #0284c7' : '1px solid #cbd5e1',
                      backgroundColor: activeFloorIndex === fIdx ? '#e0f2fe' : '#ffffff',
                      color: activeFloorIndex === fIdx ? '#0369a1' : '#475569',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Layers size={13} color={activeFloorIndex === fIdx ? '#0284c7' : '#64748b'} />
                    <span>{fl.floorName}</span>
                    <span className="badge" style={{ backgroundColor: activeFloorIndex === fIdx ? '#0284c7' : '#e2e8f0', color: activeFloorIndex === fIdx ? '#ffffff' : '#475569', fontSize: '0.65rem' }}>
                      {fl.zones.length} Vùng Z
                    </span>
                  </button>
                ))}
              </div>

              {/* Edit Floor Name & Remove Floor */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '0.35rem', borderTop: '1px dashed #cbd5e1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, maxWidth: '400px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>
                    Tên tầng hiện tại:
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem', fontWeight: 700 }}
                    value={currentFloor.floorName}
                    onChange={(e) => handleUpdateFloorName(activeFloorIndex, e.target.value)}
                  />
                </div>

                {floors.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveFloor(activeFloorIndex)}
                    className="btn btn-sm"
                    style={{ backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    <Trash2 size={12} />
                    <span>Xóa tầng này</span>
                  </button>
                )}
              </div>
            </div>

            {/* 2. FLOOR OVERVIEW PHOTOS */}
            <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Camera size={16} color="#0369a1" />
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 800, color: '#0f172a' }}>
                      Ảnh chụp tổng quan không gian ({currentFloor.floorName}):
                    </h4>
                    <span style={{ fontSize: '0.725rem', color: '#64748b' }}>
                      Chụp góc rộng bao quát không gian các khu vực của tầng ({currentFloor.overviewPhotos.length} ảnh).
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleAddFloorOverviewPhoto(activeFloorIndex)}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}
                >
                  <Plus size={13} />
                  <span>Thêm ảnh tổng quan</span>
                </button>
              </div>

              {currentFloor.overviewPhotos.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
                  {currentFloor.overviewPhotos.map((ovPhoto, pIdx) => (
                    <div
                      key={ovPhoto.id || pIdx}
                      style={{
                        backgroundColor: '#ffffff',
                        padding: '0.65rem',
                        borderRadius: '0.65rem',
                        border: '1px solid #cbd5e1',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0369a1' }}>
                          Ảnh tổng quan #{pIdx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFloorOverviewPhoto(activeFloorIndex, pIdx)}
                          className="btn btn-sm"
                          style={{ backgroundColor: '#fee2e2', color: '#b91c1c', border: 'none', padding: '0.2rem 0.4rem' }}
                          title="Xóa ảnh này"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      <PhotoCaptureInput
                        value={ovPhoto.url}
                        onChange={(url) => handleUpdateFloorOverviewPhoto(activeFloorIndex, pIdx, url)}
                        watermarkText={`OVERVIEW | ${currentFloor.floorName} (#${pIdx + 1})`}
                        height="160px"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '0.75rem', textAlign: 'center', backgroundColor: '#ffffff', border: '1px dashed #cbd5e1', borderRadius: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
                  Chưa có ảnh chụp tổng quan tầng. Bấm <strong>"Thêm ảnh tổng quan"</strong> ở trên để chụp thêm.
                </div>
              )}
            </div>

            {/* 3. ZONES MANAGEMENT WITHIN CURRENT FLOOR */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Building size={16} color="#0369a1" />
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                      Vùng khảo sát mảng tường / cấu kiện (Thuộc {currentFloor.floorName}):
                    </h4>
                    <span style={{ fontSize: '0.725rem', color: '#64748b' }}>
                      Mỗi vùng Z đại diện cho 1 mảng tường hoặc phòng cụ thể kèm ảnh Photo CTX và các ghim khuyết tật D-xx.
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleAddZoneToFloor(activeFloorIndex)}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 700 }}
                >
                  <Plus size={14} />
                  <span>Thêm vùng Z</span>
                </button>
              </div>

              {/* Zone Selector Tabs or Empty State */}
              {currentFloorZones.length === 0 ? (
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1.5px dashed #cbd5e1',
                    borderRadius: '0.75rem',
                    padding: '1.5rem 1rem',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.6rem',
                  }}
                >
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #86efac',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#16a34a',
                    }}
                  >
                    <CheckCircle size={24} />
                  </div>
                  <div>
                    <h5 style={{ margin: 0, fontSize: '0.925rem', fontWeight: 800, color: '#0f172a' }}>
                      {currentFloor.floorName} chưa tạo vùng hư hỏng / khuyết tật
                    </h5>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.775rem', color: '#64748b', maxWidth: '480px' }}>
                      Nếu tầng này bình thường không có nứt vỡ hoặc sự cố, bạn chỉ cần chụp <strong>Ảnh tổng quan</strong> bên trên. Nếu có vết nứt hoặc cấu kiện hư hỏng, hãy bấm nút bên dưới để tạo vùng Z.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddZoneToFloor(activeFloorIndex)}
                    className="btn btn-primary btn-sm"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontWeight: 700,
                      padding: '0.45rem 1rem',
                      marginTop: '0.25rem',
                      boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)',
                    }}
                  >
                    <Plus size={14} />
                    <span>+ Thêm Vùng Hư Hỏng / Khuyết Tật (Tạo Vùng Z)</span>
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
                  {currentFloorZones.map((z, zIdx) => (
                    <button
                      key={z.id || zIdx}
                      type="button"
                      onClick={() => setActiveZoneIndex(zIdx)}
                      style={{
                        padding: '0.45rem 0.85rem',
                        borderRadius: '0.5rem',
                        fontSize: '0.775rem',
                        fontWeight: activeZoneIndex === zIdx ? 800 : 500,
                        border: activeZoneIndex === zIdx ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                        backgroundColor: activeZoneIndex === zIdx ? '#e0f2fe' : '#f8fafc',
                        color: activeZoneIndex === zIdx ? '#0369a1' : '#475569',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span>{z.zoneCode}:</span>
                      <span>{z.roomName || 'Chưa đặt tên'}</span>
                      <span className="badge" style={{ backgroundColor: '#ffffff', color: '#0284c7' }}>
                        {z.defects.length} ghim
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Active Zone Detail Editor */}
              {currentZone && (
                <div
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.75rem',
                    padding: '1rem',
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0284c7' }}>
                      {currentZone.zoneCode} – Thông tin vùng khảo sát ({currentFloor.floorName})
                    </span>
                    {currentFloorZones.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveZoneFromFloor(activeFloorIndex, activeZoneIndex)}
                        className="btn btn-sm"
                        style={{ backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        <Trash2 size={13} />
                        <span>Xóa vùng này</span>
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                    {/* Tên Phòng / Vị trí with List & Other Input */}
                    <div>
                      <label className="form-label">Tên phòng / Không gian:</label>
                      <select
                        className="form-control"
                        value={
                          COMMON_ROOM_NAMES.slice(0, -1).includes(currentZone.roomName)
                            ? currentZone.roomName
                            : 'Khác'
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'Khác') {
                            handleUpdateZoneInFloor(activeFloorIndex, activeZoneIndex, 'roomName', '');
                          } else {
                            handleUpdateZoneInFloor(activeFloorIndex, activeZoneIndex, 'roomName', val);
                          }
                        }}
                      >
                        {COMMON_ROOM_NAMES.map((rn) => (
                          <option key={rn} value={rn}>
                            {rn}
                          </option>
                        ))}
                      </select>
                      {(!COMMON_ROOM_NAMES.slice(0, -1).includes(currentZone.roomName) || currentZone.roomName === '') && (
                        <input
                          type="text"
                          className="form-control"
                          style={{ marginTop: '0.35rem' }}
                          placeholder="Nhập tên phòng / không gian cụ thể..."
                          value={currentZone.roomName}
                          onChange={(e) => handleUpdateZoneInFloor(activeFloorIndex, activeZoneIndex, 'roomName', e.target.value)}
                          autoFocus
                        />
                      )}
                    </div>

                    {/* Cấu kiện */}
                    <div>
                      <label className="form-label">Cấu kiện chịu lực / Mảng vách:</label>
                      <select
                        className="form-control"
                        value={currentZone.componentType}
                        onChange={(e) => handleUpdateZoneInFloor(activeFloorIndex, activeZoneIndex, 'componentType', e.target.value)}
                      >
                        <option value="Tường gạch vữa xi măng">Tường gạch vữa xi măng</option>
                        <option value="Cột BTCT">Cột BTCT</option>
                        <option value="Dầm BTCT">Dầm BTCT</option>
                        <option value="Sàn BTCT">Sàn BTCT</option>
                        <option value="Cầu thang BTCT">Cầu thang BTCT</option>
                        <option value="Mái / Sê nô">Mái / Sê nô</option>
                        <option value="Khung thép">Khung thép</option>
                        <option value="Khác">Khác</option>
                      </select>
                    </div>

                    {/* Vật liệu hoàn thiện with List & Other Input */}
                    <div>
                      <label className="form-label">Vật liệu bề mặt cấu kiện:</label>
                      <select
                        className="form-control"
                        value={
                          COMMON_WALL_MATERIALS.slice(0, -1).includes(currentZone.wallMaterial)
                            ? currentZone.wallMaterial
                            : 'Khác'
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'Khác') {
                            handleUpdateZoneInFloor(activeFloorIndex, activeZoneIndex, 'wallMaterial', '');
                          } else {
                            handleUpdateZoneInFloor(activeFloorIndex, activeZoneIndex, 'wallMaterial', val);
                          }
                        }}
                      >
                        {COMMON_WALL_MATERIALS.map((wm) => (
                          <option key={wm} value={wm}>
                            {wm}
                          </option>
                        ))}
                      </select>
                      {(!COMMON_WALL_MATERIALS.slice(0, -1).includes(currentZone.wallMaterial) || currentZone.wallMaterial === '') && (
                        <input
                          type="text"
                          className="form-control"
                          style={{ marginTop: '0.35rem' }}
                          placeholder="Nhập vật liệu bề mặt cụ thể..."
                          value={currentZone.wallMaterial}
                          onChange={(e) => handleUpdateZoneInFloor(activeFloorIndex, activeZoneIndex, 'wallMaterial', e.target.value)}
                          autoFocus
                        />
                      )}
                    </div>

                    {/* Chốt Burland Grade gọn gàng */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label className="form-label">Chốt Burland Grade sơ bộ:</label>
                        <button
                          type="button"
                          onClick={() => setShowBurlandModal(true)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#0284c7',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                          }}
                        >
                          <HelpCircle size={12} />
                          Tra cứu quy chuẩn
                        </button>
                      </div>
                      <select
                        className="form-control"
                        value={currentZone.burlandGrade}
                        onChange={(e) => handleUpdateZoneInFloor(activeFloorIndex, activeZoneIndex, 'burlandGrade', parseInt(e.target.value, 10))}
                      >
                        <option value={0}>Grade 0 - Không đáng kể</option>
                        <option value={1}>Grade 1 - Rất nhẹ</option>
                        <option value={2}>Grade 2 - Nhẹ</option>
                        <option value={3}>Grade 3 - Trung bình</option>
                        <option value={4}>Grade 4 - Nặng</option>
                        <option value={5}>Grade 5 - Rất nặng</option>
                      </select>
                    </div>

                    {/* Ảnh hưởng chức năng / Cần sửa chữa */}
                    <div style={{ gridColumn: '1 / -1', backgroundColor: '#eff6ff', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #bfdbfe' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.825rem', fontWeight: 700, color: '#1e40af', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={currentZone.functionalImpactRepairNeeded || false}
                          onChange={(e) => handleUpdateZoneInFloor(activeFloorIndex, activeZoneIndex, 'functionalImpactRepairNeeded', e.target.checked)}
                          style={{ accentColor: '#0284c7', width: '16px', height: '16px' }}
                        />
                        <span>Vùng này có Ảnh hưởng chức năng / Cần sửa chữa</span>
                      </label>
                    </div>
                  </div>

                  {/* Photo CTX with 2 options: Camera & Upload */}
                  <PhotoCaptureInput
                    label={`Ảnh bối cảnh mảng tường/cấu kiện (${currentZone.zoneCode}-CTX):`}
                    value={currentZone.ctxPhotoUrl}
                    onChange={(url) => handleUpdateZoneInFloor(activeFloorIndex, activeZoneIndex, 'ctxPhotoUrl', url)}
                    watermarkText={`${currentZone.zoneCode}-CTX | ${currentFloor.floorName} - ${currentZone.roomName}`}
                    height="200px"
                    required={true}
                  />

                  {/* Defect Pinning Canvas on this Zone */}
                  {currentZone.ctxPhotoUrl && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <DefectPinningCanvas
                        ctxPhotoUrl={currentZone.ctxPhotoUrl}
                        defects={currentZone.defects}
                        onChange={(defects) => handleUpdateZoneInFloor(activeFloorIndex, activeZoneIndex, 'defects', defects)}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 4. FLOOR CAD SKETCH / PLAN & ZONE PINNING CANVAS (KẾT THÚC TẦNG) */}
            <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Compass size={16} color="#0369a1" />
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>
                    Sơ đồ kỹ thuật mặt bằng tầng & Vị trí vùng Z ({currentFloor.floorName}):
                  </h4>
                  <span style={{ fontSize: '0.725rem', color: '#64748b' }}>
                    Chụp hoặc tải sơ đồ CAD / phác thảo mặt bằng kỹ thuật tầng và chấm ghim định vị các Vùng Z ({currentFloorZones.map(z => z.zoneCode).join(', ')}).
                  </span>
                </div>
              </div>

              <FloorCadPinningCanvas
                cadPhotoUrl={currentFloor.cadSketchPhotoUrl || ''}
                onCadPhotoChange={(url) => handleUpdateFloorCadPhoto(activeFloorIndex, url)}
                pins={currentFloor.cadZonePins || []}
                onChangePins={(pins) => handleUpdateFloorCadPins(activeFloorIndex, pins)}
                availableZones={currentFloorZones.map(z => ({ id: z.id, zoneCode: z.zoneCode, roomName: z.roomName }))}
                floorName={currentFloor.floorName}
              />
            </div>

            {/* 5. FLOOR FOOTER NAVIGATION (CHUYỂN TẦNG NHANH Ở CUỐI TẦNG) */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.65rem',
                padding: '0.85rem 1rem',
                backgroundColor: '#ffffff',
                borderRadius: '0.75rem',
                border: '1px solid #cbd5e1',
                boxShadow: '0 2px 5px rgba(0,0,0,0.03)',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  if (activeFloorIndex > 0) {
                    switchFloorWithCheck(activeFloorIndex - 1);
                  }
                }}
                disabled={activeFloorIndex === 0}
                className="btn btn-secondary btn-sm"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  opacity: activeFloorIndex === 0 ? 0.4 : 1,
                  cursor: activeFloorIndex === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                <ChevronLeft size={16} />
                <span>Tầng trước</span>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.825rem', fontWeight: 700, color: '#0369a1' }}>
                <Layers size={16} color="#0284c7" />
                <span>Tầng {activeFloorIndex + 1} / {floors.length}: {currentFloor.floorName}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {activeFloorIndex < floors.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => switchFloorWithCheck(activeFloorIndex + 1)}
                    className="btn btn-primary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <span>Tầng tiếp theo</span>
                    <ChevronRight size={16} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleAddFloorWithCheck}
                    className="btn btn-primary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Plus size={14} />
                    <span>Thêm tầng mới</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===================== STEP 4: ĐÁNH GIÁ LÚN – NGHIÊNG – VÕNG ===================== */}
        {currentStep === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                BƯỚC 4: Đánh Giá & Đo Đạc Lún – Nghiêng – Biến Dạng
              </h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.775rem', color: '#64748b' }}>
                Đo đạc hình học công trình phục vụ phân tích độ ổn định kết cấu và tự động tính điểm chỉ số E3.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem' }}>
              {/* 1. Lún chênh */}
              <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '0.65rem', border: '1px solid #e2e8f0' }}>
                <label className="form-label" style={{ fontWeight: 800, color: '#0f172a' }}>
                  1. Lún chênh:
                </label>
                <select
                  className="form-control"
                  value={settlementTilt.diffSettlementScore}
                  onChange={(e) => setSettlementTilt({ ...settlementTilt, diffSettlementScore: parseInt(e.target.value, 10) })}
                >
                  <option value={0}>Không có dấu hiệu</option>
                  <option value={1}>Nghi ngờ / Nhẹ</option>
                  <option value={2}>Rõ nhưng ổn định</option>
                  <option value={3}>Tiến triển / Nghiêm trọng</option>
                  <option value={4}>Mất ổn định</option>
                </select>
              </div>

              {/* 2. Nghiêng công trình */}
              <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '0.65rem', border: '1px solid #e2e8f0' }}>
                <label className="form-label" style={{ fontWeight: 800, color: '#0f172a' }}>
                  2. Nghiêng công trình:
                </label>
                <select
                  className="form-control"
                  value={settlementTilt.buildingTiltScore}
                  onChange={(e) => setSettlementTilt({ ...settlementTilt, buildingTiltScore: parseInt(e.target.value, 10) })}
                >
                  <option value={0}>Không</option>
                  <option value={1}>Nhẹ</option>
                  <option value={2}>Rõ</option>
                  <option value={3}>Nghiêm trọng</option>
                </select>
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.45rem' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Mặt trước X (%):</span>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      placeholder="VD: 0.15"
                      value={settlementTilt.tiltFrontXPercent || ''}
                      onChange={(e) => setSettlementTilt({ ...settlementTilt, tiltFrontXPercent: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Mặt hông Y (%):</span>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      placeholder="VD: 0.10"
                      value={settlementTilt.tiltSideYPercent || ''}
                      onChange={(e) => setSettlementTilt({ ...settlementTilt, tiltSideYPercent: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>

              {/* 3. Nghiêng sàn */}
              <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '0.65rem', border: '1px solid #e2e8f0' }}>
                <label className="form-label" style={{ fontWeight: 800, color: '#0f172a' }}>
                  3. Nghiêng sàn:
                </label>
                <select
                  className="form-control"
                  value={settlementTilt.floorTiltScore}
                  onChange={(e) => setSettlementTilt({ ...settlementTilt, floorTiltScore: parseInt(e.target.value, 10) })}
                >
                  <option value={0}>Không</option>
                  <option value={1}>Nhẹ</option>
                  <option value={2}>Rõ</option>
                </select>
              </div>

              {/* 4. Võng dầm / Sàn */}
              <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '0.65rem', border: '1px solid #e2e8f0' }}>
                <label className="form-label" style={{ fontWeight: 800, color: '#0f172a' }}>
                  4. Võng dầm / Sàn:
                </label>
                <select
                  className="form-control"
                  value={settlementTilt.beamDeflectionScore}
                  onChange={(e) => setSettlementTilt({ ...settlementTilt, beamDeflectionScore: parseInt(e.target.value, 10) })}
                >
                  <option value={0}>Không</option>
                  <option value={1}>Nhẹ</option>
                  <option value={2}>Rõ</option>
                </select>
              </div>
            </div>

            {/* 5. Nguồn xác định dữ liệu (Multi-select) */}
            <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '0.65rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label className="form-label" style={{ fontWeight: 800, color: '#0f172a', margin: 0 }}>
                5. Nguồn xác định dữ liệu:
              </label>
              <span style={{ fontSize: '0.725rem', color: '#64748b' }}>
                Chọn một hoặc nhiều phương pháp thu thập dữ liệu hiện trường (Multi-select):
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {['Quan sát mắt thường', 'Đo nhanh bằng thiết bị', 'Bản vẽ thiết kế', 'Chủ nhà'].map((src) => {
                  const isChecked = (settlementTilt.dataSources || []).includes(src);
                  return (
                    <button
                      key={src}
                      type="button"
                      onClick={() => {
                        const current = settlementTilt.dataSources || [];
                        const next = isChecked
                          ? current.length > 1 ? current.filter((s: string) => s !== src) : current
                          : [...current, src];
                        setSettlementTilt({ ...settlementTilt, dataSources: next });
                      }}
                      style={{
                        padding: '0.45rem 0.85rem',
                        borderRadius: '0.5rem',
                        fontSize: '0.775rem',
                        fontWeight: isChecked ? 700 : 500,
                        border: isChecked ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                        backgroundColor: isChecked ? '#e0f2fe' : '#ffffff',
                        color: isChecked ? '#0369a1' : '#475569',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <CheckCircle size={14} color={isChecked ? '#0284c7' : '#cbd5e1'} />
                      <span>{src}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 6 & 7. Độ tin cậy dữ liệu & Yêu cầu Quan trắc bổ sung */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem' }}>
              {/* 6. Độ tin cậy dữ liệu */}
              <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '0.65rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <label className="form-label" style={{ fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  6. Độ tin cậy dữ liệu:
                </label>
                <div style={{ display: 'flex', gap: '0.45rem', marginTop: '0.2rem' }}>
                  {['Cao', 'Trung bình', 'Thấp'].map((conf) => {
                    const isSelected = settlementTilt.dataConfidence === conf;
                    const color = conf === 'Cao' ? '#16a34a' : conf === 'Trung bình' ? '#d97706' : '#dc2626';
                    const bgColor = conf === 'Cao' ? '#dcfce7' : conf === 'Trung bình' ? '#fef3c7' : '#fee2e2';
                    return (
                      <button
                        key={conf}
                        type="button"
                        onClick={() => setSettlementTilt({ ...settlementTilt, dataConfidence: conf })}
                        style={{
                          flex: 1,
                          padding: '0.45rem 0.5rem',
                          borderRadius: '0.5rem',
                          fontSize: '0.775rem',
                          fontWeight: isSelected ? 800 : 500,
                          border: isSelected ? `2px solid ${color}` : '1px solid #cbd5e1',
                          backgroundColor: isSelected ? bgColor : '#ffffff',
                          color: isSelected ? color : '#475569',
                          cursor: 'pointer',
                          textAlign: 'center',
                        }}
                      >
                        {conf}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 7. Yêu cầu Đo đạc / Quan trắc bổ sung */}
              <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '0.65rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <label className="form-label" style={{ fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  7. Yêu cầu Đo đạc / Quan trắc bổ sung:
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                  <button
                    type="button"
                    onClick={() => setSettlementTilt({ ...settlementTilt, needsSpecialistMonitoring: false })}
                    style={{
                      flex: 1,
                      padding: '0.45rem 0.5rem',
                      borderRadius: '0.5rem',
                      fontSize: '0.775rem',
                      fontWeight: !settlementTilt.needsSpecialistMonitoring ? 800 : 500,
                      border: !settlementTilt.needsSpecialistMonitoring ? '2px solid #0284c7' : '1px solid #cbd5e1',
                      backgroundColor: !settlementTilt.needsSpecialistMonitoring ? '#e0f2fe' : '#ffffff',
                      color: !settlementTilt.needsSpecialistMonitoring ? '#0369a1' : '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    Không
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettlementTilt({ ...settlementTilt, needsSpecialistMonitoring: true })}
                    style={{
                      flex: 1,
                      padding: '0.45rem 0.5rem',
                      borderRadius: '0.5rem',
                      fontSize: '0.775rem',
                      fontWeight: settlementTilt.needsSpecialistMonitoring ? 800 : 500,
                      border: settlementTilt.needsSpecialistMonitoring ? '2px solid #ea580c' : '1px solid #cbd5e1',
                      backgroundColor: settlementTilt.needsSpecialistMonitoring ? '#ffedd5' : '#ffffff',
                      color: settlementTilt.needsSpecialistMonitoring ? '#c2410c' : '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    Có (Khuyến nghị)
                  </button>
                </div>
                {settlementTilt.needsSpecialistMonitoring && (
                  <div style={{ marginTop: '0.35rem' }}>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Nhập nhận xét / Ghi chú yêu cầu quan trắc cụ thể..."
                      value={settlementTilt.monitoringRemarks || ''}
                      onChange={(e) => setSettlementTilt({ ...settlementTilt, monitoringRemarks: e.target.value })}
                      autoFocus
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===================== STEP 5: PHẠM VI & ĐỐI SOÁT RANH GIS ===================== */}
        {currentStep === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                BƯỚC 5: Xác Nhận Phạm Vi & Đối Soát Ranh Thửa Đất GIS
              </h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.775rem', color: '#64748b' }}>
                Đối chiếu các tầng đã tiếp cận, ghi nhận hạn chế tiếp cận (nếu có) và đối soát ranh giới thực tế trên nền bản đồ quy hoạch.
              </p>
            </div>

            {/* 1. PHẠM VI ĐÃ TIẾP CẬN KHẢO SÁT (TỰ TÍCH TRƯỚC BÊN NGOÀI & CÁC TẦNG ĐÃ KHẢO SÁT) */}
            <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                <label className="form-label" style={{ fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  1. Phạm vi đã tiếp cận khảo sát:
                </label>
                <span style={{ fontSize: '0.725rem', color: '#0284c7', fontWeight: 600 }}>
                  (Tự động đồng bộ: Bên ngoài/Mặt tiền + {floors.length} tầng đã khảo sát ở Bước 3)
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem' }}>
                {[
                  { id: 'FACADE', name: 'Bên ngoài / Mặt tiền (P-01 → P-04)', isFloor: false, note: '4 ảnh định danh' },
                  ...floors.map((fl) => ({
                    id: fl.id,
                    name: fl.floorName,
                    isFloor: true,
                    note: `${fl.zones.length} vùng Z (${fl.zones.reduce((sum, z) => sum + z.defects.length, 0)} ghim)`,
                  })),
                  { id: 'ROOF', name: 'Mái / Sân thượng / Sê-nô', isFloor: false, note: 'Khảo sát ngoài trời' },
                  { id: 'BASEMENT', name: 'Tầng hầm / Bán hầm', isFloor: false, note: 'Kết cấu ngầm' },
                  { id: 'BACKYARD', name: 'Khu phụ / Sân sau / Giếng trời', isFloor: false, note: 'Không gian mở' },
                ].map((sc) => {
                  const isChecked = (scopeGIS.surveyScope || []).includes(sc.name);
                  return (
                    <div
                      key={sc.id}
                      onClick={() => {
                        const current = scopeGIS.surveyScope || [];
                        const next = isChecked
                          ? current.filter((s: string) => s !== sc.name)
                          : [...current, sc.name];
                        setScopeGIS({ ...scopeGIS, surveyScope: next });
                      }}
                      style={{
                        padding: '0.6rem 0.75rem',
                        borderRadius: '0.5rem',
                        border: isChecked ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                        backgroundColor: isChecked ? '#e0f2fe' : '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <div
                          style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '4px',
                            border: isChecked ? 'none' : '1.5px solid #94a3b8',
                            backgroundColor: isChecked ? '#0284c7' : '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {isChecked && <Check size={12} color="#ffffff" />}
                        </div>
                        <span style={{ fontSize: '0.8rem', fontWeight: isChecked ? 700 : 500, color: isChecked ? '#0369a1' : '#334155' }}>
                          {sc.name}
                        </span>
                      </div>

                      {sc.isFloor && (
                        <span className="badge" style={{ backgroundColor: isChecked ? '#0284c7' : '#e2e8f0', color: isChecked ? '#ffffff' : '#475569', fontSize: '0.65rem' }}>
                          {sc.note}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. HẠN CHẾ TIẾP CẬN (ACCESS LIMITATIONS) */}
            <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                <label className="form-label" style={{ fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  2. Hạn chế tiếp cận hiện trường:
                </label>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button
                    type="button"
                    onClick={() => setScopeGIS({ ...scopeGIS, accessLimitations: false })}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '0.45rem',
                      fontSize: '0.75rem',
                      fontWeight: !scopeGIS.accessLimitations ? 800 : 500,
                      border: !scopeGIS.accessLimitations ? '2px solid #16a34a' : '1px solid #cbd5e1',
                      backgroundColor: !scopeGIS.accessLimitations ? '#dcfce7' : '#ffffff',
                      color: !scopeGIS.accessLimitations ? '#15803d' : '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    Không có hạn chế (Tiếp cận 100%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setScopeGIS({ ...scopeGIS, accessLimitations: true })}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '0.45rem',
                      fontSize: '0.75rem',
                      fontWeight: scopeGIS.accessLimitations ? 800 : 500,
                      border: scopeGIS.accessLimitations ? '2px solid #ea580c' : '1px solid #cbd5e1',
                      backgroundColor: scopeGIS.accessLimitations ? '#ffedd5' : '#ffffff',
                      color: scopeGIS.accessLimitations ? '#c2410c' : '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    Có hạn chế tiếp cận
                  </button>
                </div>
              </div>

              {scopeGIS.accessLimitations && (
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #fed7aa',
                    borderRadius: '0.65rem',
                    padding: '0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    animation: 'fadeIn 0.2s ease-out',
                  }}
                >
                  {/* Vị trí bị hạn chế */}
                  <div>
                    <label style={{ fontSize: '0.775rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                      a. Vị trí / Khu vực bị hạn chế không vào được:
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      {COMMON_RESTRICTED_AREAS.map((area) => {
                        const isChecked = (scopeGIS.restrictedAreas || []).includes(area);
                        const isHighFloors = area.includes('Các tầng lầu trên cao');
                        const isOther = area === 'Khác';

                        return (
                          <div
                            key={area}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.4rem',
                              padding: '0.45rem 0.65rem',
                              borderRadius: '0.5rem',
                              backgroundColor: isChecked ? '#fff7ed' : '#f8fafc',
                              border: isChecked ? '1.5px solid #ea580c' : '1px solid #e2e8f0',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <label
                              style={{
                                fontSize: '0.775rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.45rem',
                                color: isChecked ? '#9a3412' : '#334155',
                                fontWeight: isChecked ? 700 : 500,
                                cursor: 'pointer',
                                margin: 0,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const current = scopeGIS.restrictedAreas || [];
                                  const next = e.target.checked
                                    ? [...current, area]
                                    : current.filter((a: string) => a !== area);
                                  setScopeGIS({ ...scopeGIS, restrictedAreas: next });
                                }}
                                style={{ accentColor: '#ea580c', width: '16px', height: '16px', cursor: 'pointer' }}
                              />
                              <span>{area}</span>
                            </label>

                            {/* TẦNG LẦU TRÊN CAO: Hiển thị ngay bên dưới tùy chọn này */}
                            {isHighFloors && isChecked && (
                              <div
                                style={{
                                  marginTop: '0.25rem',
                                  padding: '0.55rem 0.65rem',
                                  backgroundColor: '#ffffff',
                                  border: '1px dashed #fdba74',
                                  borderRadius: '0.45rem',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.4rem',
                                  animation: 'fadeIn 0.2s ease-out',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
                                  <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#c2410c' }}>
                                    Chọn cụ thể các tầng lầu bị hạn chế (Khóa cửa / Không thể tiếp cận):
                                  </span>
                                  <span style={{ fontSize: '0.675rem', color: '#64748b' }}>
                                    (Các tầng đã có dữ liệu ở Bước 3 bị vô hiệu hóa để tránh đánh nhầm)
                                  </span>
                                </div>

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                                  {restrictedFloorOptions.map((flLabel) => {
                                    const isSurveyed = isFloorSurveyedInStep3(flLabel);
                                    const isSelected = (scopeGIS.restrictedFloors || []).includes(flLabel);

                                    return (
                                      <button
                                        key={flLabel}
                                        type="button"
                                        disabled={isSurveyed}
                                        onClick={() => {
                                          if (isSurveyed) return;
                                          const current = scopeGIS.restrictedFloors || [];
                                          const next = isSelected
                                            ? current.filter((f: string) => f !== flLabel)
                                            : [...current, flLabel];
                                          setScopeGIS({ ...scopeGIS, restrictedFloors: next });
                                        }}
                                        style={{
                                          padding: '0.3rem 0.6rem',
                                          borderRadius: '0.35rem',
                                          fontSize: '0.725rem',
                                          fontWeight: isSelected ? 800 : 500,
                                          border: isSurveyed
                                            ? '1px dashed #cbd5e1'
                                            : isSelected
                                            ? '1.5px solid #ea580c'
                                            : '1px solid #cbd5e1',
                                          backgroundColor: isSurveyed
                                            ? '#f1f5f9'
                                            : isSelected
                                            ? '#ffedd5'
                                            : '#ffffff',
                                          color: isSurveyed ? '#94a3b8' : isSelected ? '#c2410c' : '#334155',
                                          cursor: isSurveyed ? 'not-allowed' : 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '0.3rem',
                                        }}
                                        title={isSurveyed ? 'Tầng này đã được khảo sát ở Bước 3, không thể đánh dấu hạn chế' : undefined}
                                      >
                                        <span>{flLabel}</span>
                                        {isSurveyed ? (
                                          <span
                                            style={{
                                              fontSize: '0.6rem',
                                              backgroundColor: '#94a3b8',
                                              color: '#ffffff',
                                              padding: '0.05rem 0.3rem',
                                              borderRadius: '3px',
                                              fontWeight: 600,
                                            }}
                                          >
                                            Đã KS ở B3
                                          </span>
                                        ) : isSelected ? (
                                          <Check size={12} color="#c2410c" />
                                        ) : null}
                                      </button>
                                    );
                                  })}

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const currentLen = restrictedFloorOptions.length;
                                      const newFloors = [
                                        `Lầu ${currentLen + 1}`,
                                        `Lầu ${currentLen + 2}`,
                                        `Lầu ${currentLen + 3}`,
                                        `Lầu ${currentLen + 4}`,
                                        `Lầu ${currentLen + 5}`,
                                      ];
                                      setRestrictedFloorOptions([...restrictedFloorOptions, ...newFloors]);
                                    }}
                                    style={{
                                      padding: '0.3rem 0.55rem',
                                      borderRadius: '0.35rem',
                                      fontSize: '0.7rem',
                                      fontWeight: 700,
                                      backgroundColor: '#ffffff',
                                      border: '1px dashed #ea580c',
                                      color: '#ea580c',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.2rem',
                                    }}
                                  >
                                    <Plus size={12} /> + Thêm 5 lầu cao hơn
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* KHÁC: Hiển thị ô nhập trực tiếp ngay bên dưới tùy chọn này */}
                            {isOther && isChecked && (
                              <div style={{ marginTop: '0.2rem', animation: 'fadeIn 0.2s ease-out' }}>
                                <input
                                  type="text"
                                  className="form-control"
                                  style={{ fontSize: '0.775rem', backgroundColor: '#ffffff' }}
                                  placeholder="Nhập vị trí / khu vực cụ thể bị hạn chế..."
                                  value={scopeGIS.restrictedAreaOther || ''}
                                  onChange={(e) => setScopeGIS({ ...scopeGIS, restrictedAreaOther: e.target.value })}
                                  autoFocus
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Nguyên nhân hạn chế */}
                  <div>
                    <label style={{ fontSize: '0.775rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                      b. Nguyên nhân chính dẫn đến hạn chế tiếp cận:
                    </label>
                    <select
                      className="form-control"
                      value={scopeGIS.limitationReasonType}
                      onChange={(e) => setScopeGIS({ ...scopeGIS, limitationReasonType: e.target.value })}
                      style={{ fontSize: '0.8rem' }}
                    >
                      {COMMON_LIMITATION_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    {scopeGIS.limitationReasonType === 'Khác' && (
                      <input
                        type="text"
                        className="form-control"
                        style={{ marginTop: '0.4rem', fontSize: '0.775rem' }}
                        placeholder="Nhập lý do / nguyên nhân cụ thể..."
                        value={scopeGIS.limitationReasonOther || ''}
                        onChange={(e) => setScopeGIS({ ...scopeGIS, limitationReasonOther: e.target.value })}
                        autoFocus
                      />
                    )}
                  </div>

                  {/* Ghi chú tổng quát */}
                  <div>
                    <label style={{ fontSize: '0.775rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                      c. Ghi chú diễn giải cụ thể biên bản hiện trường:
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="VD: Chủ nhà chỉ cho xem tầng trệt, lầu 1 và lầu 2 đi vắng khóa cửa không tiếp cận được."
                      value={scopeGIS.accessLimitationReason}
                      onChange={(e) => setScopeGIS({ ...scopeGIS, accessLimitationReason: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 3. ĐỐI SOÁT RANH ĐỊA CHÍNH & BIẾN ĐỘNG RANH THỬA TRÊN GIS */}
            <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  3. Đối soát ranh địa chính thực tế trên GIS:
                </label>
                <span style={{ fontSize: '0.725rem', color: '#64748b', display: 'block' }}>
                  Đối chiếu kích thước thửa ban đầu, xác nhận khớp ranh hoặc gửi đề xuất biến động Tách/Gộp thửa.
                </span>
              </div>

              <CadastralGISBoundaryEditor
                activeParcelId={activeParcelId}
                parcelData={parcelData}
                parcel={parcel}
                boundaryStatus={scopeGIS.boundaryStatus || 'MATCH'}
                onStatusChange={(status) => setScopeGIS({ ...scopeGIS, boundaryStatus: status })}
                mutationData={scopeGIS.mutationData || {
                  splitReason: '',
                  splitCount: 2,
                  splitChildren: [],
                  mergeReason: '',
                  mergeTargetCode: '',
                  selectedMergeCodes: [],
                  isSubmitted: false,
                  submittedAt: '',
                }}
                onMutationDataChange={(data) => setScopeGIS({ ...scopeGIS, mutationData: data })}
                onToastMessage={(msg) => {
                  setSaveToastMessage(msg);
                  setTimeout(() => setSaveToastMessage(null), 4000);
                }}
              />
            </div>
          </div>
        )}

        {/* ===================== STEP 6: TÍNH ĐIỂM ECS & VI ===================== */}
        {currentStep === 6 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                BƯỚC 6: Tự Động Tính Điểm Kỹ Thuật ECS & VI (Auto Calculations 100%)
              </h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.775rem', color: '#64748b' }}>
                Tự động tổng hợp điểm rủi ro hiện hữu (ECS 0-24) và chỉ số dễ tổn thương (VI 1-4) từ các bước khảo sát trước.
              </p>
            </div>

            {/* 6.1. ECS Card */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '0.75rem',
                padding: '1.15rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Calculator size={18} color="#0284c7" />
                  <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                    6.1. Bảng Điểm Hiện Hữu ECS (Existing Condition Score):
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span
                    className={`badge ${
                      ecsClass === 'Good'
                        ? 'badge-success'
                        : ecsClass === 'Medium'
                        ? 'badge-info'
                        : ecsClass === 'Deficient'
                        ? 'badge-warning'
                        : 'badge-danger'
                    }`}
                    style={{ fontSize: '0.85rem', fontWeight: 800 }}
                  >
                    Tổng ECS = {totalEcsScore}/24 ({ecsClass})
                  </span>
                  {engineeringJudgement !== 'NO_CHANGE' && (
                    <span
                      className={`badge ${
                        adjustedEcsClass === 'Good'
                          ? 'badge-success'
                          : adjustedEcsClass === 'Medium'
                          ? 'badge-info'
                          : adjustedEcsClass === 'Deficient'
                          ? 'badge-warning'
                          : 'badge-danger'
                      }`}
                      style={{ fontSize: '0.85rem', fontWeight: 800, border: '1.5px solid #0f172a' }}
                    >
                      Sau can thiệp: {adjustedEcsClass}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.65rem', fontSize: '0.8rem' }}>
                <div style={{ backgroundColor: '#ffffff', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                  <div style={{ color: '#64748b', fontSize: '0.725rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    E1. Hư hỏng khối xây
                    <HelpBadge text={`Đánh giá mức độ nứt khối xây dựa trên cấp Burland cao nhất trong các phòng/vùng. Max hiện tại: Grade ${maxBurland} (chuẩn hóa về thang 4đ).`} />
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginTop: '0.15rem' }}>{e1Score} / 4 đ</div>
                  <div style={{ fontSize: '0.7rem', color: '#0284c7' }}>Max Burland: Grade {maxBurland}</div>
                </div>

                <div style={{ backgroundColor: '#ffffff', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                  <div style={{ color: '#64748b', fontSize: '0.725rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    E2. Khuyết tật cột/dầm/sàn
                    <HelpBadge text="Ý nghĩa kết cấu cao nhất từ các ghim khuyết tật D-xx. (1: Không đáng kể, 2: Trung bình, 3: Nghiêm trọng, 4: Nguy cấp kết cấu)." />
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: maxE2 >= 3 ? '#dc2626' : '#0f172a', marginTop: '0.15rem' }}>{e2Score} / 4 đ</div>
                  <div style={{ fontSize: '0.7rem', color: maxE2 >= 3 ? '#dc2626' : '#64748b' }}>
                    {maxE2 === 4 ? 'Critical (Nguy hiểm)' : maxE2 === 3 ? 'High (Nghiêm trọng)' : maxE2 === 2 ? 'Moderate' : 'Low / None'}
                  </div>
                </div>

                <div style={{ backgroundColor: '#ffffff', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                  <div style={{ color: '#64748b', fontSize: '0.725rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    E3. Lún / Nghiêng / Võng
                    <HelpBadge text="Tổng hợp điểm đo độ nghiêng bằng quả dọi/laser, lún lệch nền móng và võng dầm sàn từ Bước 4." />
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: e3Score >= 3 ? '#dc2626' : '#0f172a', marginTop: '0.15rem' }}>{e3Score} / 4 đ</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Tổng hợp từ Bước 4</div>
                </div>

                <div style={{ backgroundColor: '#ffffff', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                  <div style={{ color: '#64748b', fontSize: '0.725rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    E4. Suy giảm vật liệu / Rỉ thép
                    <HelpBadge text="Tổng hợp từ các ghim khuyết tật D-xx ghi nhận phong hóa bê tông, ăn mòn rỉ sét cốt thép." />
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginTop: '0.15rem' }}>{e4Score} / 4 đ</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Tổng hợp ghim D-xx</div>
                </div>

                <div style={{ backgroundColor: '#ffffff', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                  <div style={{ color: '#64748b', fontSize: '0.725rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    E5. Lịch sử / Cơi nới / Sự cố
                    <HelpBadge text="Tổng hợp từ phỏng vấn chủ hộ Bước 2.2 về lịch sử cơi nới thêm tầng, lún nứt quá khứ hoặc ảnh hưởng lân cận." />
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginTop: '0.15rem' }}>{e5Score} / 4 đ</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Phỏng vấn Bước 2.2</div>
                </div>

                <div style={{ backgroundColor: '#ffffff', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                  <div style={{ color: '#64748b', fontSize: '0.725rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    E6. Tình trạng chức năng
                    <HelpBadge text="Mức độ ảnh hưởng đến công năng sử dụng bình thường của công trình. Có thể để tự động hoặc chọn điểm tùy chỉnh." />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                    <select
                      className="form-control"
                      style={{ fontSize: '0.775rem', padding: '0.25rem 0.4rem', height: 'auto', fontWeight: 700 }}
                      value={e6Score}
                      onChange={(e) => setE6ManualScore(parseInt(e.target.value, 10))}
                    >
                      <option value={0}>0đ - Tốt / Bình thường</option>
                      <option value={1}>1đ - Trung bình</option>
                      <option value={2}>2đ - Kém (Cần sửa chữa)</option>
                      <option value={3}>3đ - Nghiêm trọng</option>
                      <option value={4}>4đ - Nguy cấp / Mất an toàn</option>
                    </select>
                  </div>
                  <div style={{ fontSize: '0.675rem', color: '#64748b', marginTop: '0.2rem' }}>
                    {e6ManualScore === null ? '(Tự động nhận diện)' : '(Kỹ sư tùy chỉnh)'}
                  </div>
                </div>
              </div>

              {/* Engineering Judgement */}
              <div style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '0.6rem', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.825rem', color: '#0f172a' }}>
                    Quyền Can Thiệp của Kỹ Sư (Engineering Judgement):
                  </span>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    {(['NO_CHANGE', 'UPGRADE', 'DOWNGRADE'] as const).map((mode) => {
                      const isDowngradeDisabled = mode === 'DOWNGRADE' && isCriticalLockActive;
                      const isSelected = engineeringJudgement === mode;
                      const label = mode === 'NO_CHANGE' ? 'Giữ nguyên' : mode === 'UPGRADE' ? 'Nâng hạng' : 'Hạ hạng';
                      return (
                        <button
                          key={mode}
                          type="button"
                          disabled={isDowngradeDisabled}
                          onClick={() => setEngineeringJudgement(mode)}
                          style={{
                            padding: '0.3rem 0.65rem',
                            borderRadius: '0.4rem',
                            fontSize: '0.75rem',
                            fontWeight: isSelected ? 800 : 500,
                            border: isSelected ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                            backgroundColor: isSelected ? '#e0f2fe' : isDowngradeDisabled ? '#f1f5f9' : '#ffffff',
                            color: isSelected ? '#0369a1' : isDowngradeDisabled ? '#94a3b8' : '#334155',
                            cursor: isDowngradeDisabled ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {label} {isDowngradeDisabled && '(Khóa an toàn)'}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {isCriticalLockActive && (
                  <div
                    style={{
                      backgroundColor: '#fef2f2',
                      border: '1px solid #fecaca',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.4rem',
                      fontSize: '0.75rem',
                      color: '#991b1b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <AlertTriangle size={15} color="#dc2626" />
                    <span>
                      <strong>KHÓA AN TOÀN KỸ THUẬT:</strong> Công trình có khuyết tật kết cấu Nguy cấp (E2 ≥ 3) hoặc Lún nghiêng nghiêm trọng (E3 ≥ 3 / Critical). Không được phép Hạ hạng ECS!
                    </span>
                  </div>
                )}

                {engineeringJudgement !== 'NO_CHANGE' && (
                  <div>
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                      Lý do can thiệp / Nhận xét của Kỹ sư:
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      style={{ fontSize: '0.775rem' }}
                      placeholder="Nhập cơ sở kỹ thuật (VD: Kết cấu có vết nứt phát triển nhanh dù bề rộng nhỏ...)"
                      value={judgementReason}
                      onChange={(e) => setJudgementReason(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 6.2. VI Vulnerability Section */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '0.75rem',
                padding: '1.15rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Activity size={18} color="#16a34a" />
                  <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                    6.2. Bảng Chỉ Số Dễ Tổn Thương VI (Vulnerability Index):
                  </span>
                </div>
                <span
                  className={`badge ${
                    viClass === 'Low'
                      ? 'badge-success'
                      : viClass === 'Medium'
                      ? 'badge-info'
                      : viClass === 'High'
                      ? 'badge-warning'
                      : 'badge-danger'
                  }`}
                  style={{ fontSize: '0.85rem', fontWeight: 800 }}
                >
                  VI Trung bình = {avgVi} ({viClass})
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* V1 */}
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.65rem', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.825rem', fontWeight: 800, color: '#0f172a' }}>V1. Công năng & Tầm quan trọng:</span>
                      <HelpBadge text="Phân loại theo mức độ quan trọng: 1đ Bỏ hoang, 2đ General (nhà dân/văn phòng), 3đ Important (công cộng/5+ tầng), 4đ Critical (bệnh viện/di tích)." />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ fontSize: '0.675rem', padding: '0.12rem 0.35rem', borderRadius: '0.25rem', backgroundColor: '#e0f2fe', color: '#0284c7', fontWeight: 700 }}>
                        Tự động từ B1 ({parcelData.importanceGroup || 'General'})
                      </span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0284c7' }}>{viScores.v1Use} / 4 đ</span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.4rem' }}>
                    {[
                      { score: 1, label: 'Bỏ hoang', desc: '1đ - Công trình bỏ hoang / không sử dụng' },
                      { score: 2, label: 'General', desc: '2đ - Nhà ở 1-4 tầng, văn phòng nhỏ, cửa hàng' },
                      { score: 3, label: 'Important', desc: '3đ - Công trình công cộng, trường học, 5+ tầng' },
                      { score: 4, label: 'Critical', desc: '4đ - Bệnh viện, di tích, hạ tầng thiết yếu' },
                    ].map((opt) => {
                      const isSel = viScores.v1Use === opt.score;
                      return (
                        <button
                          key={opt.score}
                          type="button"
                          onClick={() => setViScores({ ...viScores, v1Use: opt.score })}
                          style={{
                            textAlign: 'left',
                            padding: '0.4rem 0.55rem',
                            borderRadius: '0.4rem',
                            border: isSel ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                            backgroundColor: isSel ? '#f0f9ff' : '#f8fafc',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.1rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: isSel ? '#0369a1' : '#1e293b' }}>
                              {opt.label}
                            </span>
                            <span style={{ fontSize: '0.675rem', fontWeight: 800, padding: '0.05rem 0.3rem', borderRadius: '3px', backgroundColor: isSel ? '#0284c7' : '#e2e8f0', color: isSel ? '#ffffff' : '#64748b' }}>
                              {opt.score}đ
                            </span>
                          </div>
                          <span style={{ fontSize: '0.675rem', color: isSel ? '#0284c7' : '#64748b' }}>{opt.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* V2 */}
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.65rem', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.825rem', fontWeight: 800, color: '#0f172a' }}>V2. Hệ kết cấu chịu lực:</span>
                      <HelpBadge text="Phân loại hệ khung chịu lực: 1đ BTCT toàn khối, 2đ Khung BTCT chèn tường gạch, 3đ Tường gạch chịu lực/thép cũ, 4đ Tường không giằng/nhà tạm." />
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0284c7' }}>{viScores.v2Structure} / 4 đ</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.4rem' }}>
                    {[
                      { score: 1, label: 'Khung BTCT toàn khối', desc: '1đ - Kiên cố cao, khả năng chịu lún tốt' },
                      { score: 2, label: 'Khung BTCT chèn gạch', desc: '2đ - Khung bê tông + tường gạch phổ biến' },
                      { score: 3, label: 'Tường gạch / Thép cũ', desc: '3đ - Tường gạch chịu lực, nhạy chuyển vị' },
                      { score: 4, label: 'Tường không giằng / Tạm', desc: '4đ - Kết cấu yếu, dễ nứt vỡ mất ổn định' },
                    ].map((opt) => {
                      const isSel = viScores.v2Structure === opt.score;
                      return (
                        <button
                          key={opt.score}
                          type="button"
                          onClick={() => setViScores({ ...viScores, v2Structure: opt.score })}
                          style={{
                            textAlign: 'left',
                            padding: '0.4rem 0.55rem',
                            borderRadius: '0.4rem',
                            border: isSel ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                            backgroundColor: isSel ? '#f0f9ff' : '#f8fafc',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.1rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: isSel ? '#0369a1' : '#1e293b' }}>
                              {opt.label}
                            </span>
                            <span style={{ fontSize: '0.675rem', fontWeight: 800, padding: '0.05rem 0.3rem', borderRadius: '3px', backgroundColor: isSel ? '#0284c7' : '#e2e8f0', color: isSel ? '#ffffff' : '#64748b' }}>
                              {opt.score}đ
                            </span>
                          </div>
                          <span style={{ fontSize: '0.675rem', color: isSel ? '#0284c7' : '#64748b' }}>{opt.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* V3 */}
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.65rem', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.825rem', fontWeight: 800, color: '#0f172a' }}>V3. Loại móng & Nền đất:</span>
                      <HelpBadge text="Đánh giá loại móng và điều kiện địa chất: 1đ Cọc sâu/khoan nhồi, 2đ Móng bè/băng, 3đ Móng đơn/cừ tràm, 4đ Móng nông/đất yếu." />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ fontSize: '0.675rem', padding: '0.12rem 0.35rem', borderRadius: '0.25rem', backgroundColor: '#e0f2fe', color: '#0284c7', fontWeight: 700 }}>
                        Tự động từ B2.1 (CAT: {specs.catFoundationScore}/5)
                      </span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0284c7' }}>{viScores.v3Foundation} / 4 đ</span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.4rem' }}>
                    {[
                      { score: 1, label: 'Móng cọc sâu / Khoan nhồi', desc: '1đ - Tựa tầng địa chất tốt, ít lún' },
                      { score: 2, label: 'Móng bè / Móng băng', desc: '2đ - Phân bố tải đều, lún đồng đều' },
                      { score: 3, label: 'Móng đơn BTCT / Cừ tràm', desc: '3đ - Chịu lún lệch trung bình' },
                      { score: 4, label: 'Móng nông / Đất yếu', desc: '4đ - Rất nhạy cảm với hạ mực nước ngầm' },
                    ].map((opt) => {
                      const isSel = viScores.v3Foundation === opt.score;
                      return (
                        <button
                          key={opt.score}
                          type="button"
                          onClick={() => setViScores({ ...viScores, v3Foundation: opt.score })}
                          style={{
                            textAlign: 'left',
                            padding: '0.4rem 0.55rem',
                            borderRadius: '0.4rem',
                            border: isSel ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                            backgroundColor: isSel ? '#f0f9ff' : '#f8fafc',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.1rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: isSel ? '#0369a1' : '#1e293b' }}>
                              {opt.label}
                            </span>
                            <span style={{ fontSize: '0.675rem', fontWeight: 800, padding: '0.05rem 0.3rem', borderRadius: '3px', backgroundColor: isSel ? '#0284c7' : '#e2e8f0', color: isSel ? '#ffffff' : '#64748b' }}>
                              {opt.score}đ
                            </span>
                          </div>
                          <span style={{ fontSize: '0.675rem', color: isSel ? '#0284c7' : '#64748b' }}>{opt.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* V4 */}
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.65rem', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.825rem', fontWeight: 800, color: '#0f172a' }}>V4. Tuổi đời & Cơi nới:</span>
                      <HelpBadge text="Thời gian sử dụng và lịch sử cải tạo: 1đ <10 năm, 2đ 10-25 năm, 3đ 25-40 năm hoặc cơi nới nhẹ, 4đ >40 năm hoặc cơi nới nhiều tầng." />
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0284c7' }}>{viScores.v4Age} / 4 đ</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.4rem' }}>
                    {[
                      { score: 1, label: '< 10 năm', desc: '1đ - Công trình mới, nguyên bản thiết kế' },
                      { score: 2, label: '10 – 25 năm', desc: '2đ - Ổn định, bảo trì thường xuyên' },
                      { score: 3, label: '25 – 40 năm', desc: '3đ - Có cơi nới nhẹ / sửa chữa cải tạo' },
                      { score: 4, label: '> 40 năm / Cơi nới nặng', desc: '4đ - Xuống cấp / Cơi nới nhiều tầng' },
                    ].map((opt) => {
                      const isSel = viScores.v4Age === opt.score;
                      return (
                        <button
                          key={opt.score}
                          type="button"
                          onClick={() => setViScores({ ...viScores, v4Age: opt.score })}
                          style={{
                            textAlign: 'left',
                            padding: '0.4rem 0.55rem',
                            borderRadius: '0.4rem',
                            border: isSel ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                            backgroundColor: isSel ? '#f0f9ff' : '#f8fafc',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.1rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: isSel ? '#0369a1' : '#1e293b' }}>
                              {opt.label}
                            </span>
                            <span style={{ fontSize: '0.675rem', fontWeight: 800, padding: '0.05rem 0.3rem', borderRadius: '3px', backgroundColor: isSel ? '#0284c7' : '#e2e8f0', color: isSel ? '#ffffff' : '#64748b' }}>
                              {opt.score}đ
                            </span>
                          </div>
                          <span style={{ fontSize: '0.675rem', color: isSel ? '#0284c7' : '#64748b' }}>{opt.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* V5 */}
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.65rem', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.825rem', fontWeight: 800, color: '#0f172a' }}>V5. Hiện trạng kỹ thuật ECS:</span>
                      <HelpBadge text="Tự động đồng bộ từ Hạng ECS hiện hữu (Good: 1đ, Medium: 2đ, Deficient: 3đ, Critical: 4đ)." />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ fontSize: '0.675rem', padding: '0.12rem 0.35rem', borderRadius: '0.25rem', backgroundColor: '#e0f2fe', color: '#0284c7', fontWeight: 700 }}>
                        Tự động từ ECS ({adjustedEcsClass})
                      </span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0284c7' }}>{viScores.v5Ecs} / 4 đ</span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.4rem' }}>
                    {[
                      { score: 1, label: 'ECS Tốt (Good)', desc: '1đ - Tổng thể ổn định, không khuyết tật' },
                      { score: 2, label: 'ECS Trung bình', desc: '2đ - Nứt co ngót nhẹ, không nguy hiểm' },
                      { score: 3, label: 'ECS Kém (Deficient)', desc: '3đ - Nứt kết cấu, lún cục bộ' },
                      { score: 4, label: 'ECS Nguy cấp', desc: '4đ - Hư hỏng nặng, nguy cơ mất an toàn' },
                    ].map((opt) => {
                      const isSel = viScores.v5Ecs === opt.score;
                      return (
                        <button
                          key={opt.score}
                          type="button"
                          onClick={() => setViScores({ ...viScores, v5Ecs: opt.score })}
                          style={{
                            textAlign: 'left',
                            padding: '0.4rem 0.55rem',
                            borderRadius: '0.4rem',
                            border: isSel ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                            backgroundColor: isSel ? '#f0f9ff' : '#f8fafc',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.1rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: isSel ? '#0369a1' : '#1e293b' }}>
                              {opt.label}
                            </span>
                            <span style={{ fontSize: '0.675rem', fontWeight: 800, padding: '0.05rem 0.3rem', borderRadius: '3px', backgroundColor: isSel ? '#0284c7' : '#e2e8f0', color: isSel ? '#ffffff' : '#64748b' }}>
                              {opt.score}đ
                            </span>
                          </div>
                          <span style={{ fontSize: '0.675rem', color: isSel ? '#0284c7' : '#64748b' }}>{opt.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* V6 */}
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.65rem', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.825rem', fontWeight: 800, color: '#0f172a' }}>V6. Thiết bị nhạy cảm:</span>
                      <HelpBadge text="Mức độ nhạy cảm với rung chấn và biến dạng: 1đ Không có, 2đ Gia dụng, 3đ Nhạy rung văn phòng, 4đ Thiết bị y tế/phòng lab/vận hành 24/7." />
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0284c7' }}>{viScores.v6Sensitive} / 4 đ</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.4rem' }}>
                    {[
                      { score: 1, label: 'Không có', desc: '1đ - Sinh hoạt dân dụng bình thường' },
                      { score: 2, label: 'Thiết bị cơ bản', desc: '2đ - Thiết bị gia dụng thông thường' },
                      { score: 3, label: 'Nhạy rung chấn', desc: '3đ - Thiết bị văn phòng, kinh doanh' },
                      { score: 4, label: 'Đặc biệt nhạy cảm', desc: '4đ - Y tế / Phòng lab / Vận hành 24/7' },
                    ].map((opt) => {
                      const isSel = viScores.v6Sensitive === opt.score;
                      return (
                        <button
                          key={opt.score}
                          type="button"
                          onClick={() => setViScores({ ...viScores, v6Sensitive: opt.score })}
                          style={{
                            textAlign: 'left',
                            padding: '0.4rem 0.55rem',
                            borderRadius: '0.4rem',
                            border: isSel ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                            backgroundColor: isSel ? '#f0f9ff' : '#f8fafc',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.1rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: isSel ? '#0369a1' : '#1e293b' }}>
                              {opt.label}
                            </span>
                            <span style={{ fontSize: '0.675rem', fontWeight: 800, padding: '0.05rem 0.3rem', borderRadius: '3px', backgroundColor: isSel ? '#0284c7' : '#e2e8f0', color: isSel ? '#ffffff' : '#64748b' }}>
                              {opt.score}đ
                            </span>
                          </div>
                          <span style={{ fontSize: '0.675rem', color: isSel ? '#0284c7' : '#64748b' }}>{opt.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== STEP 7: KẾT LUẬN & KIẾN NGHỊ ===================== */}
        {currentStep === 7 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                BƯỚC 7: Tổng Hợp Kết Luận & Đề Xuất Kỹ Thuật (Executive Summary Dashboard)
              </h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.775rem', color: '#64748b' }}>
                Bảng tổng hợp chỉ số kỹ thuật toàn diện, phân hạng rủi ro nền tảng (BRA) và kiến nghị bảo vệ công trình.
              </p>
            </div>

            {/* Executive Summary Grid: 6 KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              {/* 1. ECS */}
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '0.65rem', padding: '0.85rem' }}>
                <div style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 700 }}>1. CHỈ SỐ HIỆN HỮU (BCS / ECS)</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0' }}>
                  {totalEcsScore} / 24 đ
                </div>
                <span
                  className={`badge ${
                    adjustedEcsClass === 'Good'
                      ? 'badge-success'
                      : adjustedEcsClass === 'Medium'
                      ? 'badge-info'
                      : adjustedEcsClass === 'Deficient'
                      ? 'badge-warning'
                      : 'badge-danger'
                  }`}
                  style={{ fontSize: '0.75rem' }}
                >
                  {adjustedEcsClass} {engineeringJudgement !== 'NO_CHANGE' && '(Đã can thiệp)'}
                </span>
              </div>

              {/* 2. Burland */}
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '0.65rem', padding: '0.85rem' }}>
                <div style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 700 }}>2. CẤP HƯ HỎNG (BURLAND)</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0' }}>
                  Grade {maxBurland}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#475569' }}>
                  • Chủ đạo: <strong>Grade {predominantBurland}</strong> | Cực đại: <strong>Grade {maxBurland}</strong>
                </div>
              </div>

              {/* 3. Structural Flag */}
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '0.65rem', padding: '0.85rem' }}>
                <div style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 700 }}>3. CỜ KẾT CẤU (STRUCTURAL FLAG)</div>
                <div
                  style={{
                    fontSize: '1.15rem',
                    fontWeight: 800,
                    color: structuralFlagLevel === 'Critical' || structuralFlagLevel === 'High' ? '#dc2626' : '#0f172a',
                    margin: '0.25rem 0',
                  }}
                >
                  {structuralFlagLevel}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#475569' }}>
                  • Mức độ nguy hiểm max: {maxE2}/4 đ
                </div>
              </div>

              {/* 4. VI */}
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '0.65rem', padding: '0.85rem' }}>
                <div style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 700 }}>4. DỄ TỔN THƯƠNG (VI)</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0' }}>
                  {avgVi} / 4.0
                </div>
                <span
                  className={`badge ${
                    viClass === 'Low'
                      ? 'badge-success'
                      : viClass === 'Medium'
                      ? 'badge-info'
                      : viClass === 'High'
                      ? 'badge-warning'
                      : 'badge-danger'
                  }`}
                  style={{ fontSize: '0.75rem' }}
                >
                  {viClass}
                </span>
              </div>

              {/* 5. Construction Impact */}
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '0.65rem', padding: '0.85rem' }}>
                <div style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 700 }}>5. TÁC ĐỘNG THI CÔNG (IMPACT)</div>
                <select
                  className="form-control"
                  style={{ fontSize: '0.775rem', marginTop: '0.35rem', fontWeight: 700 }}
                  value={summaryData.constructionImpact}
                  onChange={(e) => setSummaryData({ ...summaryData, constructionImpact: e.target.value })}
                >
                  <option value="Pending">Pending (Chờ đánh giá)</option>
                  <option value="Low">Low (I=1 - Tác động thấp)</option>
                  <option value="Medium">Medium (I=2 - Tác động TB)</option>
                  <option value="High">High (I=3 - Tác động cao)</option>
                  <option value="Very High">Very High (I=4 - Tác động rất lớn)</option>
                </select>
              </div>

              {/* 6. BRA Risk Assessment */}
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '0.65rem', padding: '0.85rem' }}>
                <div style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 700 }}>6. RỦI RO NỀN TẢNG (BRA MATRIX)</div>
                <select
                  className="form-control"
                  style={{ fontSize: '0.775rem', marginTop: '0.35rem', fontWeight: 700 }}
                  value={summaryData.braRiskClass}
                  onChange={(e) => setSummaryData({ ...summaryData, braRiskClass: e.target.value })}
                >
                  <option value="Pending">Pending (Chờ thi công)</option>
                  <option value="Low">Low (Rủi ro Thấp)</option>
                  <option value="Medium">Medium (Rủi ro Trung bình)</option>
                  <option value="High">High (Rủi ro Cao - Cần quan trắc)</option>
                  <option value="Very High">Very High (Rất nguy cấp - Cần gia cố)</option>
                </select>
              </div>
            </div>

            {/* Textareas with quick insertion chips */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.3rem' }}>
                  <label className="form-label" style={{ margin: 0, fontWeight: 700 }}>
                    Khuyết tật / Rủi ro chính ghi nhận:
                  </label>
                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                    {[
                      'Nứt tường gạch hình bậc thang (Burland Grade 2)',
                      'Nứt co ngót bề mặt vữa trát',
                      'Lún nghiêng cục bộ góc nhà tiếp giáp ranh',
                      'Thấm dột cổ ống sàn mái / ban công',
                      'Bong tróc bê tông rỉ cốt thép lộ thiên',
                      'Võng nứt dầm sàn nhịp lớn',
                    ].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.675rem', padding: '0.2rem 0.45rem', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155' }}
                        onClick={() => {
                          setSummaryData((prev: any) => ({
                            ...prev,
                            primaryRiskSummary: prev.primaryRiskSummary
                              ? `${prev.primaryRiskSummary}\n• ${chip}`
                              : `• ${chip}`,
                          }));
                        }}
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Chọn các khuyết tật phổ biến bên trên hoặc nhập trực tiếp..."
                  value={summaryData.primaryRiskSummary}
                  onChange={(e) => setSummaryData({ ...summaryData, primaryRiskSummary: e.target.value })}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.3rem' }}>
                  <label className="form-label" style={{ margin: 0, fontWeight: 700 }}>
                    Kiến nghị cụ thể / Phương án bảo vệ:
                  </label>
                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                    {[
                      'Lắp đặt mốc quan trắc lún nghiêng tự động',
                      'Gia cố móng trước khi TBM đào hầm ngầm',
                      'Quan trắc rung chấn định kỳ khi thi công',
                      'Khảo sát chi tiết chuyên sâu Phase 2',
                      'Theo dõi cữ đo thạch cao tại vết nứt chính',
                      'Khảo sát lại toàn bộ sau khi thi công tuyến Metro',
                    ].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.675rem', padding: '0.2rem 0.45rem', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155' }}
                        onClick={() => {
                          setSummaryData((prev: any) => ({
                            ...prev,
                            specificRecommendations: prev.specificRecommendations
                              ? `${prev.specificRecommendations}\n• ${chip}`
                              : `• ${chip}`,
                          }));
                        }}
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Chọn các kiến nghị phổ biến bên trên hoặc nhập trực tiếp..."
                  value={summaryData.specificRecommendations}
                  onChange={(e) => setSummaryData({ ...summaryData, specificRecommendations: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}

        {/* ===================== STEP 8: KÝ BIÊN BẢN HIỆN TRƯỜNG (2 BÊN) ===================== */}
        {currentStep === 8 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                BƯỚC 8: Chốt Biên Bản & Ký Xác Nhận Hiện Trường (2 Bên: Cán Bộ KS & Chủ Hộ)
              </h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.775rem', color: '#64748b' }}>
                Chụp ảnh trực tiếp hoặc tải lên ảnh chữ ký / biên bản giấy có chữ ký của Cán bộ khảo sát và Chủ sở hữu công trình.
              </p>
            </div>

            {/* Survey Summary Counter Box */}
            <div
              style={{
                backgroundColor: '#f0fdf4',
                border: '1px solid #86efac',
                borderRadius: '0.75rem',
                padding: '0.85rem 1rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '0.65rem',
                textAlign: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#15803d' }}>{floors.length}</div>
                <div style={{ fontSize: '0.725rem', color: '#166534', fontWeight: 600 }}>Tầng khảo sát</div>
              </div>
              <div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#15803d' }}>{allZones.length}</div>
                <div style={{ fontSize: '0.725rem', color: '#166534', fontWeight: 600 }}>Vùng khảo sát (Z)</div>
              </div>
              <div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#15803d' }}>{allDefects.length}</div>
                <div style={{ fontSize: '0.725rem', color: '#166534', fontWeight: 600 }}>Vết nứt / Ghim D</div>
              </div>
              <div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#15803d' }}>4/4</div>
                <div style={{ fontSize: '0.725rem', color: '#166534', fontWeight: 600 }}>Bộ ảnh P01-P04</div>
              </div>
            </div>

            {/* Owner Feedback */}
            <div>
              <label className="form-label" style={{ fontWeight: 700 }}>
                Ý kiến / Phản hồi nguyên văn của Chủ hộ / Người sử dụng:
              </label>
              <input
                type="text"
                className="form-control"
                value={ownerFeedback}
                onChange={(e) => setOwnerFeedback(e.target.value)}
                placeholder="Nhập ý kiến của chủ nhà..."
              />
            </div>

            {/* 2 Signature Blocks: Cán bộ Khảo sát & Chủ sở hữu */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
              {/* 1. Cán bộ Khảo sát */}
              <div
                className="card"
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.75rem',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                  <PenTool size={16} color="#0284c7" />
                  <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0f172a' }}>
                    1. Cán bộ Khảo sát (Kỹ sư lập biên bản)
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: '2px' }}>
                      Họ và tên cán bộ:
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      style={{ fontSize: '0.8rem', fontWeight: 600 }}
                      placeholder="Họ tên Cán bộ KS"
                      value={preparedByName}
                      onChange={(e) => setPreparedByName(e.target.value)}
                    />
                  </div>
                  <div style={{ width: '135px' }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: '2px' }}>
                      Ngày ký:
                    </label>
                    <input
                      type="date"
                      className="form-control"
                      style={{ fontSize: '0.8rem' }}
                      value={preparedByDate}
                      onChange={(e) => setPreparedByDate(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: '4px' }}>
                    Ảnh chụp / Tải lên Chữ ký Cán bộ KS:
                  </label>
                  <PhotoCaptureInput
                    value={sigPreparedBy}
                    onChange={(url: string) => setSigPreparedBy(url)}
                    label="Chụp ảnh chữ ký hoặc tải lên ảnh chữ ký Cán bộ"
                    height="160px"
                  />
                </div>
              </div>

              {/* 2. Chủ sở hữu */}
              <div
                className="card"
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.75rem',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                  <Home size={16} color="#16a34a" />
                  <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0f172a' }}>
                    2. Chủ sở hữu / Người đại diện công trình
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: '2px' }}>
                      Họ và tên chủ hộ:
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      style={{ fontSize: '0.8rem', fontWeight: 600 }}
                      placeholder="Họ tên Chủ hộ"
                      value={ownerSignName}
                      onChange={(e) => setOwnerSignName(e.target.value)}
                    />
                  </div>
                  <div style={{ width: '135px' }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: '2px' }}>
                      Ngày ký:
                    </label>
                    <input
                      type="date"
                      className="form-control"
                      style={{ fontSize: '0.8rem' }}
                      value={ownerSignDate}
                      onChange={(e) => setOwnerSignDate(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: '4px' }}>
                    Ảnh chụp / Tải lên Chữ ký Chủ sở hữu:
                  </label>
                  <PhotoCaptureInput
                    value={sigOwner}
                    onChange={(url: string) => setSigOwner(url)}
                    label="Chụp ảnh chữ ký hoặc tải lên ảnh chữ ký Chủ hộ"
                    height="160px"
                  />
                </div>
              </div>
            </div>

            {/* Submit Action Button */}
            <div style={{ marginTop: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSubmitReport}
                disabled={isSaving}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
                }}
              >
                <Send size={18} />
                <span>{isSaving ? 'Đang gửi hồ sơ...' : 'HOÀN TẤT & NỘP HỒ SƠ KHẢO SÁT PHASE 1'}</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP FOOTER NAVIGATION (PREV / NEXT) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '0.85rem' }}>
          {currentStep > 1 ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleStepChangeWithCheck(currentStep - 1)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <ChevronLeft size={16} />
              <span>Bước trước</span>
            </button>
          ) : <div />}

          {currentStep < 8 ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => handleStepChangeWithCheck(currentStep + 1)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <span>Tiếp theo: Bước {currentStep + 1}</span>
              <ChevronRight size={16} />
            </button>
          ) : null}
        </div>
      </div>

      {/* Burland Cheat Sheet Modal */}
      {showBurlandModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 3000,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setShowBurlandModal(false)}
        >
          <div
            className="card"
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '1rem',
              padding: '1.25rem',
              maxWidth: '520px',
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.75rem' }}>
              <HelpCircle size={18} color="#0284c7" />
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                Bảng Tra Cứu Quy Chuẩn Phân Hạng Burland (1977)
              </h4>
            </div>

            <div style={{ fontSize: '0.775rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div style={{ padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '0.4rem', border: '1px solid #e2e8f0' }}>
                <strong style={{ color: '#0284c7' }}>Grade 0 (Negligible):</strong> Bề rộng nứt ≤ 0.1 mm. Nứt tóc; thực tế không cần sửa chữa.
              </div>
              <div style={{ padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '0.4rem', border: '1px solid #e2e8f0' }}>
                <strong style={{ color: '#10b981' }}>Grade 1 (Very slight):</strong> Bề rộng nứt ~ 0.1 - 1 mm. Nứt mảnh, dễ xử lý trong trang trí thông thường.
              </div>
              <div style={{ padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '0.4rem', border: '1px solid #e2e8f0' }}>
                <strong style={{ color: '#f59e0b' }}>Grade 2 (Slight):</strong> Bề rộng nứt ~ 1 - 5 mm. Nứt dễ trám, có thể kẹt cửa nhẹ.
              </div>
              <div style={{ padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '0.4rem', border: '1px solid #e2e8f0' }}>
                <strong style={{ color: '#ea580c' }}>Grade 3 (Moderate):</strong> Bề rộng nứt ~ 5 - 15 mm. Cần vá nứt, sửa cục bộ khối xây, kẹt cửa rõ.
              </div>
              <div style={{ padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '0.4rem', border: '1px solid #e2e8f0' }}>
                <strong style={{ color: '#dc2626' }}>Grade 4 (Severe):</strong> Bề rộng nứt ~ 15 - 25 mm. Sửa chữa lớn, tường biến dạng.
              </div>
              <div style={{ padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '0.4rem', border: '1px solid #e2e8f0' }}>
                <strong style={{ color: '#991b1b' }}>Grade 5 (Very severe):</strong> Bề rộng nứt ≥ 25 mm. Hư hỏng rất nặng, cần chống đỡ khẩn cấp.
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setShowBurlandModal(false)}
              style={{ width: '100%', marginTop: '1rem', fontWeight: 700 }}
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}

      {/* Incomplete Survey Data Warning Modal */}
      {showIncompleteModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 3500,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setShowIncompleteModal(false)}
        >
          <div
            className="card"
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '1rem',
              padding: '1.25rem 1.5rem',
              maxWidth: '560px',
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: '0 20px 35px rgba(0,0,0,0.25)',
              border: '1px solid #fed7aa',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', borderBottom: '1px solid #fee2e2', paddingBottom: '0.65rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#fff7ed', border: '1px solid #fdba74', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={22} color="#ea580c" />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#9a3412' }}>
                  Cảnh Báo Dữ Liệu Khảo Sát Chưa Đầy Đủ
                </h4>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                  Hệ thống phát hiện {incompleteWarnings.length} vị trí / khuyết tật còn thiếu thông tin hoặc ảnh chụp:
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '42vh', overflowY: 'auto', paddingRight: '0.25rem' }}>
              {incompleteWarnings.map((w, wIdx) => (
                <div
                  key={wIdx}
                  style={{
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: '0.5rem',
                    padding: '0.6rem 0.75rem',
                    fontSize: '0.775rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span className="badge" style={{ backgroundColor: '#0284c7', color: '#ffffff', fontSize: '0.65rem', fontWeight: 700 }}>
                      {w.floorName}
                    </span>
                    <span className="badge" style={{ backgroundColor: '#ea580c', color: '#ffffff', fontSize: '0.65rem', fontWeight: 700 }}>
                      {w.zoneCode}
                    </span>
                    {w.defectCode && (
                      <span className="badge" style={{ backgroundColor: '#dc2626', color: '#ffffff', fontSize: '0.65rem', fontWeight: 700 }}>
                        {w.defectCode}
                      </span>
                    )}
                  </div>
                  <div style={{ color: '#78350f', lineHeight: 1.4 }}>
                    • {w.message}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '0.65rem', borderRadius: '0.5rem', fontSize: '0.725rem', color: '#64748b', lineHeight: 1.4 }}>
              <strong>Khuyến nghị:</strong> Bạn nên hoàn thiện các ảnh chụp cận cảnh (Photo CU) và đo bề rộng nứt trước khi rời tầng để đảm bảo hồ sơ pháp lý không bị cấp trên trả về.
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.35rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={executePendingAction}
                style={{ fontSize: '0.775rem', padding: '0.5rem 0.9rem' }}
              >
                Vẫn tiếp tục (Lưu tạm)
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleStayAndComplete}
                style={{
                  fontSize: '0.775rem',
                  fontWeight: 800,
                  padding: '0.5rem 1rem',
                  backgroundColor: '#ea580c',
                  borderColor: '#ea580c',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <PenTool size={14} />
                <span>Ở lại hoàn thiện dữ liệu</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
