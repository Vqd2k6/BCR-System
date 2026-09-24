import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  MapContainer,
  TileLayer,
  Polygon,
  Polyline,
  Marker,
  Tooltip,
  useMap,
  useMapEvents,
  ZoomControl,
} from 'react-leaflet';
import L from 'leaflet';
import {
  CheckCircle,
  Layers,
  GitCompare,
  Ruler,
  Check,
  RefreshCw,
  Sparkles,
  Scissors,
  Move,
  Tag,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Plus,
  Minus,
  Undo,
  Trash2,
  MousePointer,
  Compass,
  X,
  CheckCircle2,
  Crosshair,
} from 'lucide-react';
import { api } from '../../services/api';
import { GisParcel } from './LeafletSweepMap';

export interface SplitChildData {
  label: string;
  houseNumber: string;
  ownerName: string;
  suggestedCode: string;
  areaM2?: number;
  polygonRatio?: number;
  functionalType?: string;
  isResidualSurplus?: boolean;
  residualParentParcelCode?: string;
  residualParentCadastralCode?: string;
  residualParentAddress?: string;
  residualMetadataNote?: string;
}

export interface MutationPayloadData {
  splitReason: string;
  splitCount: number;
  splitChildren: SplitChildData[];
  splitCutRatio?: number;
  splitCutType?: 'HORIZONTAL' | 'VERTICAL' | 'L_SHAPE' | 'CUSTOM_POINTS';
  splitShapeOption?: 'DRAG_HANDLES' | 'CLICK_TO_DRAW';
  splitCustomPointsA?: [number, number][];
  mergeReason: string;
  mergeTargetCode?: string;
  selectedMergeCodes?: string[];
  mergeHasPartialBuilding?: boolean;
  mergeBuildingAreaM2?: number;
  mergeResidualAreaM2?: number;
  mergeResidualType?: string;
  customMergeResidualType?: string;
  mergeBuildingRatio?: number;
  mergeResidualParcelCode?: string;
  mergeBuildingCustomPoints?: [number, number][];
  activeProposalType?: 'MATCH' | 'SPLIT' | 'MERGE' | null;
  isSubmitted?: boolean;
  submittedAt?: string;
  matchConfirmed?: boolean;
}

interface Props {
  activeParcelId: string;
  parcelData: {
    projectParcelCode: string;
    officialCadastralCode: string;
    houseNumber: string;
    street: string;
    ward?: string;
    district?: string;
    ownerName?: string;
    landArea?: number;
    constructionArea?: number;
    frontageWidth?: number;
    lotDepth?: number;
    floorCount?: number;
    gpsCoords?: string;
  };
  parcel?: GisParcel | any;
  boundaryStatus: 'MATCH' | 'SPLIT' | 'MERGE';
  onStatusChange: (status: 'MATCH' | 'SPLIT' | 'MERGE') => void;
  mutationData: MutationPayloadData;
  onMutationDataChange: (data: MutationPayloadData) => void;
  onToastMessage?: (msg: string) => void;
}

// Clean click-to-view Help Popover Component for Surveyors
const HelpBadge: React.FC<{
  title: string;
  content: React.ReactNode;
  type?: 'help' | 'alert';
}> = ({ title, content, type = 'help' }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: '0.35rem' }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        title="Nhấn để xem hướng dẫn"
        style={{
          background: 'none',
          border: 'none',
          padding: '0 0.15rem',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          color: type === 'alert' ? '#ea580c' : '#0284c7',
          lineHeight: 1,
        }}
      >
        {type === 'alert' ? <AlertCircle size={15} /> : <HelpCircle size={15} />}
      </button>

      {isOpen && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9998,
            }}
            onClick={() => setIsOpen(false)}
          />
          <div
            style={{
              position: 'absolute',
              top: '120%',
              left: '-10px',
              zIndex: 9999,
              width: '290px',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '0.5rem',
              padding: '0.65rem 0.85rem',
              boxShadow: '0 10px 20px rgba(0, 0, 0, 0.12), 0 4px 6px rgba(0, 0, 0, 0.05)',
              fontSize: '0.725rem',
              color: '#334155',
              lineHeight: 1.5,
              textAlign: 'left',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.35rem',
                borderBottom: '1px solid #f1f5f9',
                paddingBottom: '0.25rem',
              }}
            >
              <strong style={{ color: '#0f172a', fontSize: '0.75rem' }}>{title}</strong>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: '0 0.2rem',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={14} />
              </button>
            </div>
            <div>{content}</div>
          </div>
        </>
      )}
    </span>
  );
};

// Auto fit and center map bounds on real parcel geometry
const MapBoundsController: React.FC<{
  coords: [number, number][];
  zoom?: number;
}> = ({ coords, zoom = 18 }) => {
  const map = useMap();
  useEffect(() => {
    if (coords && coords.length >= 3) {
      const bounds = L.latLngBounds(coords.map(([lat, lng]) => [lat, lng]));
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 20 });
    } else if (coords && coords.length > 0) {
      map.setView(coords[0], zoom);
    }
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);
    return () => clearTimeout(timer);
  }, [coords, zoom, map]);
  return null;
};

// Map click listener for click-to-draw mode
const MapClickListener: React.FC<{
  enabled: boolean;
  onMapClick: (point: [number, number]) => void;
}> = ({ enabled, onMapClick }) => {
  useMapEvents({
    click(e) {
      if (enabled) {
        onMapClick([e.latlng.lat, e.latlng.lng]);
      }
    },
  });
  return null;
};

// SYSTEM STANDARD USE CATEGORIES FOR RESIDUAL SURPLUS
const RESIDUAL_FUNCTION_OPTIONS = [
  { value: 'RESIDUAL_SURPLUS', label: '1. Đất thừa / Sai số biên ranh (Mặc định - Đất dôi dư)' },
  { value: 'Nhà ở gia đình (Nhà phố / Biệt thự / Căn hộ)', label: '2. Nhà ở gia đình (Nhà phố / Biệt thự / Căn hộ)' },
  { value: 'Cửa hàng / Shop / Bách hóa', label: '3. Cửa hàng / Shop / Bách hóa' },
  { value: 'Quán ăn / Nhà hàng / Cafe', label: '4. Quán ăn / Nhà hàng / Cafe' },
  { value: 'Văn phòng / Trụ sở công ty', label: '5. Văn phòng / Trụ sở công ty' },
  { value: 'Kho hàng / Xưởng sản xuất', label: '6. Kho hàng / Xưởng sản xuất' },
  { value: 'Đất trống / Sân vườn', label: '7. Đất trống / Sân vườn' },
  { value: 'Ngõ đi chung / Lối thoát hiểm', label: '8. Ngõ đi chung / Lối thoát hiểm' },
  { value: 'OTHER', label: '9. Khác (Nhập công năng cụ thể...)' },
];

// COMMON SPLIT REASONS FOR QUICK SELECT
const COMMON_SPLIT_REASONS = [
  'Nhà gốc chia tách 2 căn riêng biệt có lối đi độc lập',
  'Chủ nhà đã chuyển nhượng 1 phần diện tích phía sau',
  'Thừa kế phân chia quyền sử dụng đất cho các con',
  'Tách phần đất dôi dư ngoài ranh xây dựng công trình',
  'Thực tế xây dựng 2 căn có đồng hồ điện nước riêng',
  'Tách thửa do sai lệch ranh đo đạc địa chính hiện trường',
];

// COMMON MERGE REASONS FOR QUICK SELECT
const COMMON_MERGE_REASONS = [
  'Chủ hộ mua lại các thửa lân cận và xây dựng hợp khối một công trình duy nhất',
  'Thừa kế nhiều thửa liền kề, gia đình sử dụng chung một khối nhà',
  'Xây dựng công trình/nhà xưởng vượt qua ranh giới nhiều thửa đất',
  'Đã được cấp Giấy chứng nhận gộp thửa mới nhưng bản đồ địa chính cũ chưa hợp nhất',
];

// Custom handle icon for draggable polygon handles
const createHandleIcon = (num: number) => {
  return L.divIcon({
    className: 'custom-handle-marker',
    html: `<div style="
      width: 22px;
      height: 22px;
      background-color: #f59e0b;
      border: 2px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      color: #ffffff;
      font-weight: 800;
      font-size: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
    ">${num}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
};

// Interpolation helper
const interpolatePoint = (
  pA: [number, number],
  pB: [number, number],
  ratio: number
): [number, number] => {
  return [
    pA[0] + (pB[0] - pA[0]) * ratio,
    pA[1] + (pB[1] - pA[1]) * ratio,
  ];
};

// Shoelace area calculation in square meters (spherical projection approx)
const computePolygonAreaM2 = (coords: [number, number][]): number => {
  if (!coords || coords.length < 3) return 0;
  const R = 6378137;
  let area = 0;
  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length;
    const lat1 = (coords[i][0] * Math.PI) / 180;
    const lat2 = (coords[j][0] * Math.PI) / 180;
    const dLng = ((coords[j][1] - coords[i][1]) * Math.PI) / 180;
    area += dLng * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  area = Math.abs((area * R * R) / 2);
  return Math.round(area * 10) / 10;
};

export const CadastralGISBoundaryEditor: React.FC<Props> = ({
  activeParcelId,
  parcelData,
  parcel,
  boundaryStatus,
  onStatusChange,
  mutationData,
  onMutationDataChange,
  onToastMessage,
}) => {
  const frontage = parcelData.frontageWidth || 4.2;
  const depth = parcelData.lotDepth || 18.5;
  const totalLandArea = parcelData.landArea || Math.round(frontage * depth * 10) / 10 || 68.5;

  const [tileMode, setTileMode] = useState<'osm' | 'satellite'>('osm');
  const [zoneParcels, setZoneParcels] = useState<GisParcel[]>([]);
  const [_isLoadingZoneParcels, setIsLoadingZoneParcels] = useState<boolean>(false);

  // Load real parcels from API
  useEffect(() => {
    let isMounted = true;
    const fetchZoneParcels = async () => {
      try {
        setIsLoadingZoneParcels(true);
        const zoneId = parcel?.zoneId || (parcel as any)?.zone_id || 'ZONE_S9';
        const res = await api.get('/parcels/zone-map', { params: { zoneId } });
        if (isMounted && res.data?.success && Array.isArray(res.data.data)) {
          const mapped: GisParcel[] = res.data.data
            .map((p: any) => {
              let coords: [number, number][] = [];
              if (p.cadastral_geojson?.coordinates?.[0]) {
                coords = (p.cadastral_geojson.coordinates[0] as [number, number][]).map(
                  ([lng, lat]) => [lat, lng] as [number, number]
                );
              } else if (p.coordinates && Array.isArray(p.coordinates)) {
                coords = p.coordinates;
              }
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
              };
            })
            .filter((p: GisParcel) => p.coordinates.length >= 3);

          setZoneParcels(mapped);
        }
      } catch (_err) {
        // Fallback gracefully
      } finally {
        if (isMounted) setIsLoadingZoneParcels(false);
      }
    };

    fetchZoneParcels();
    return () => {
      isMounted = false;
    };
  }, [parcel]);

  // REAL POSTGIS COORDINATES OF ACTIVE PARCEL
  const realActiveCoords: [number, number][] = useMemo(() => {
    if (parcel?.coordinates && Array.isArray(parcel.coordinates) && parcel.coordinates.length >= 3) {
      return parcel.coordinates;
    }
    const matched = zoneParcels.find(
      (zp) => zp.id === activeParcelId || zp.projectParcelCode === parcelData.projectParcelCode
    );
    if (matched && matched.coordinates.length >= 3) {
      return matched.coordinates;
    }
    const baseLat = 10.798123;
    const baseLng = 106.645678;
    const dLat = 0.00028;
    const dLng = 0.00032;
    return [
      [baseLat, baseLng],
      [baseLat + dLat, baseLng],
      [baseLat + dLat, baseLng + dLng],
      [baseLat, baseLng + dLng],
    ];
  }, [parcel, activeParcelId, parcelData.projectParcelCode, zoneParcels]);

  // Centroid of active parcel
  const activeCentroid: [number, number] = useMemo(() => {
    if (realActiveCoords.length === 0) return [10.798123, 106.645678];
    const avgLat = realActiveCoords.reduce((s, c) => s + c[0], 0) / realActiveCoords.length;
    const avgLng = realActiveCoords.reduce((s, c) => s + c[1], 0) / realActiveCoords.length;
    return [avgLat, avgLng];
  }, [realActiveCoords]);

  // Fallback các thửa lân cận nếu API chưa có hoặc rỗng
  const fallbackNeighbors: GisParcel[] = useMemo(() => {
    const baseNum = parseInt(parcelData.projectParcelCode.replace(/\D/g, ''), 10) || 107;
    const [cLat, cLng] = activeCentroid;
    const dLat = 0.00028;
    const dLng = 0.00032;

    return [
      {
        id: 'neighbor_left',
        projectParcelCode: `B-${String(baseNum - 1).padStart(5, '0')}`,
        officialCadastralCode: `TĐ-${baseNum - 1}`,
        houseNumber: `${Math.max(1, baseNum - 2)}`,
        street: parcelData.street,
        ownerName: 'Hộ liền kề bên trái',
        surveyStatus: 'NOT_SURVEYED',
        absenceAttemptCount: 0,
        coordinates: [
          [cLat, cLng - dLng],
          [cLat + dLat, cLng - dLng],
          [cLat + dLat, cLng],
          [cLat, cLng],
        ],
        distanceMeters: 6,
      },
      {
        id: 'neighbor_right',
        projectParcelCode: `B-${String(baseNum + 1).padStart(5, '0')}`,
        officialCadastralCode: `TĐ-${baseNum + 1}`,
        houseNumber: `${baseNum + 2}`,
        street: parcelData.street,
        ownerName: 'Hộ liền kề bên phải',
        surveyStatus: 'NOT_SURVEYED',
        absenceAttemptCount: 0,
        coordinates: [
          [cLat, cLng + dLng],
          [cLat + dLat, cLng + dLng],
          [cLat + dLat, cLng + 2 * dLng],
          [cLat, cLng + 2 * dLng],
        ],
        distanceMeters: 8,
      },
      {
        id: 'neighbor_back',
        projectParcelCode: `B-${String(baseNum + 2).padStart(5, '0')}`,
        officialCadastralCode: `TĐ-${baseNum + 2}`,
        houseNumber: `${baseNum + 4}`,
        street: parcelData.street,
        ownerName: 'Hộ liền kề phía sau',
        surveyStatus: 'NOT_SURVEYED',
        absenceAttemptCount: 0,
        coordinates: [
          [cLat + dLat, cLng],
          [cLat + 2 * dLat, cLng],
          [cLat + 2 * dLat, cLng + dLng],
          [cLat + dLat, cLng + dLng],
        ],
        distanceMeters: 15,
      },
      {
        id: 'neighbor_corner',
        projectParcelCode: `B-${String(baseNum + 3).padStart(5, '0')}`,
        officialCadastralCode: `TĐ-${baseNum + 3}`,
        houseNumber: `${baseNum + 6}`,
        street: parcelData.street,
        ownerName: 'Hộ góc liền kề',
        surveyStatus: 'NOT_SURVEYED',
        absenceAttemptCount: 0,
        coordinates: [
          [cLat + dLat, cLng + dLng],
          [cLat + 2 * dLat, cLng + dLng],
          [cLat + 2 * dLat, cLng + 2 * dLng],
          [cLat + dLat, cLng + 2 * dLng],
        ],
        distanceMeters: 20,
      },
    ];
  }, [parcelData.projectParcelCode, parcelData.street, activeCentroid]);

  // 10 Closest Neighboring Parcels (Kết hợp API + Fallback để luôn chọn được)
  const tenClosestParcels: GisParcel[] = useMemo(() => {
    const combined = [...zoneParcels];
    fallbackNeighbors.forEach((fb) => {
      if (!combined.some((p) => p.projectParcelCode === fb.projectParcelCode)) {
        combined.push(fb);
      }
    });

    const withDist = combined.map((p) => {
      const pCenterLat = p.coordinates.reduce((s, c) => s + c[0], 0) / (p.coordinates.length || 1);
      const pCenterLng = p.coordinates.reduce((s, c) => s + c[1], 0) / (p.coordinates.length || 1);
      const dLat = pCenterLat - activeCentroid[0];
      const dLng = pCenterLng - activeCentroid[1];
      const dist = Math.sqrt(dLat * dLat + dLng * dLng);
      return { ...p, distanceMeters: (p as any).distanceMeters || Math.round(dist * 111000) };
    });

    withDist.sort((a, b) => (a.distanceMeters || 0) - (b.distanceMeters || 0));
    return withDist.filter((p) => p.projectParcelCode !== parcelData.projectParcelCode).slice(0, 10);
  }, [zoneParcels, fallbackNeighbors, activeCentroid, parcelData.projectParcelCode]);

  // =========================================================================
  // SPLIT ENGINE: OPTION 1 (CHẤM ĐIỂM TỰ NỐI) & OPTION 2 (KÉO NẮN ĐIỂM MÚT)
  // =========================================================================
  const [splitShapeOption, setSplitShapeOption] = useState<'DRAG_HANDLES' | 'CLICK_TO_DRAW'>(
    mutationData.splitShapeOption || 'CLICK_TO_DRAW'
  );

  // State cho mục Khác
  const [customResidualType, setCustomResidualType] = useState<string>('');
  const [customSplitReason, setCustomSplitReason] = useState<string>('');
  const [customMergeReason, setCustomMergeReason] = useState<string>('');
  const [customMergeResidualType, setCustomMergeResidualType] = useState<string>(
    mutationData.customMergeResidualType || ''
  );
  const [mergeBuildingVertices, setMergeBuildingVertices] = useState<[number, number][]>(() => {
    return mutationData.mergeBuildingCustomPoints || [];
  });

  // Dynamic High-Range Codes from Backend based on MAX parcel index (e.g. B-00108, B-00109)
  const [dynamicCodes, setDynamicCodes] = useState<string[]>([]);
  const [_isLoadingCodes, setIsLoadingCodes] = useState<boolean>(false);
  const [isSubmittingMutation, setIsSubmittingMutation] = useState<boolean>(false);

  // Initialize Default Custom Vertices for Căn A from realActiveCoords
  const getDefaultPolygonA = useCallback((): [number, number][] => {
    if (realActiveCoords.length < 3) return realActiveCoords;
    const p0 = realActiveCoords[0];
    const p1 = realActiveCoords[1];
    const p2 = realActiveCoords[2];
    const p3 = realActiveCoords[3] || realActiveCoords[2];

    // Default 60% front portion
    const cutL = interpolatePoint(p0, p3, 0.6);
    const cutR = interpolatePoint(p1, p2, 0.6);
    return [p0, p1, cutR, cutL];
  }, [realActiveCoords]);

  // Generate L-Shape Polygon on realActiveCoords
  const getLShapePolygon = useCallback((): [number, number][] => {
    if (realActiveCoords.length < 3) return realActiveCoords;
    const p0 = realActiveCoords[0];
    const p1 = realActiveCoords[1];
    const p2 = realActiveCoords[2];
    const p3 = realActiveCoords[3] || realActiveCoords[2];

    const cutL = interpolatePoint(p0, p3, 0.65);
    const cutR = interpolatePoint(p1, p2, 0.65);
    const cornerPoint = interpolatePoint(cutL, cutR, 0.6);
    const frontCut = interpolatePoint(p0, p1, 0.6);

    return [p0, frontCut, cornerPoint, cutR, p2, p3];
  }, [realActiveCoords]);

  // Option 1: Ban đầu KHÔNG CÓ ĐIỂM NÀO CẢ ([]). Người dùng nhấp để chấm điểm tự link lại.
  const [polyAVertices, setPolyAVertices] = useState<[number, number][]>(() => {
    if (mutationData.splitCustomPointsA && mutationData.splitCustomPointsA.length > 0) {
      return mutationData.splitCustomPointsA;
    }
    return [];
  });

  // Khi chuyển sang Option 2 (Kéo nắn), nếu chưa có điểm nào thì nạp mẫu mặc định
  useEffect(() => {
    if (splitShapeOption === 'DRAG_HANDLES' && polyAVertices.length < 3) {
      const def = getDefaultPolygonA();
      setPolyAVertices(def);
      onMutationDataChange({
        ...mutationData,
        splitShapeOption: 'DRAG_HANDLES',
        splitCustomPointsA: def,
      });
    }
  }, [splitShapeOption, getDefaultPolygonA]);

  // Fetch dynamic codes from backend (MAX index in DB + 1)
  useEffect(() => {
    let isMounted = true;
    const fetchCodes = async () => {
      try {
        setIsLoadingCodes(true);
        const res = await api.get('/parcels/next-high-range-codes?count=4');
        if (isMounted && res.data?.success && res.data.data?.codes) {
          const codes = res.data.data.codes;
          setDynamicCodes(codes);

          if (!mutationData.isSubmitted) {
            const currentChildren = mutationData.splitChildren || [];
            if (currentChildren.length === 0) {
              const initChildren: SplitChildData[] = [
                {
                  label: 'Căn A (Mặt tiền / Đang KS)',
                  houseNumber: `${parcelData.houseNumber}A`,
                  ownerName: parcelData.ownerName || '',
                  suggestedCode: codes[0] || 'B-00108',
                  areaM2: Math.round(totalLandArea * 0.6 * 10) / 10,
                  functionalType: 'Nhà ở gia đình (Nhà phố / Biệt thự / Căn hộ)',
                  isResidualSurplus: false,
                },
                {
                  label: 'Căn B (Phần diện tích còn dư)',
                  houseNumber: `${parcelData.houseNumber}B`,
                  ownerName: 'Chủ sở hữu phần đất dôi dư',
                  suggestedCode: codes[1] || 'B-00109',
                  areaM2: Math.round(totalLandArea * 0.4 * 10) / 10,
                  functionalType: 'RESIDUAL_SURPLUS',
                  isResidualSurplus: true,
                  residualParentParcelCode: parcelData.projectParcelCode,
                  residualParentCadastralCode: parcelData.officialCadastralCode,
                  residualParentAddress: `Số ${parcelData.houseNumber} ${parcelData.street}`,
                  residualMetadataNote: `Đất thừa tách từ ${parcelData.projectParcelCode}`,
                },
              ];
              onMutationDataChange({
                ...mutationData,
                splitChildren: initChildren,
              });
            } else {
              const updated = currentChildren.map((c, idx) => ({
                ...c,
                suggestedCode: codes[idx] || c.suggestedCode,
              }));
              onMutationDataChange({
                ...mutationData,
                splitChildren: updated,
              });
            }
          }
        }
      } catch (_err) {
        const baseNum = parseInt(parcelData.projectParcelCode.replace(/\D/g, ''), 10) || 107;
        const fallbackCodes = [
          `B-${String(baseNum + 1).padStart(5, '0')}`,
          `B-${String(baseNum + 2).padStart(5, '0')}`,
        ];
        if (isMounted) setDynamicCodes(fallbackCodes);
      } finally {
        if (isMounted) setIsLoadingCodes(false);
      }
    };

    fetchCodes();
    return () => {
      isMounted = false;
    };
  }, [boundaryStatus, parcelData.projectParcelCode]);

  // Calculate Area A & Area B Dynamically
  const calculatedAreaA = useMemo(() => {
    if (polyAVertices.length < 3) {
      return 0;
    }
    const raw = computePolygonAreaM2(polyAVertices);
    if (raw > 0 && raw < totalLandArea) return raw;
    return Math.round(totalLandArea * 0.6 * 10) / 10;
  }, [polyAVertices, totalLandArea]);

  const calculatedAreaB = useMemo(() => {
    if (calculatedAreaA <= 0) return totalLandArea;
    return Math.max(0.1, Math.round((totalLandArea - calculatedAreaA) * 10) / 10);
  }, [totalLandArea, calculatedAreaA]);

  // Handle Dragging a Vertex in Option 2 (Kéo nắn)
  const handleVertexDrag = (index: number, newLatLng: L.LatLng) => {
    const updated = [...polyAVertices];
    updated[index] = [newLatLng.lat, newLatLng.lng];
    setPolyAVertices(updated);
    onMutationDataChange({
      ...mutationData,
      splitCustomPointsA: updated,
      isSubmitted: false,
    });
  };

  // Handle Clicking on Map to Add Points in Option 1 (Chấm điểm)
  const handleMapClickDraw = (point: [number, number]) => {
    const updated = [...polyAVertices, point];
    setPolyAVertices(updated);
    onMutationDataChange({
      ...mutationData,
      splitCustomPointsA: updated,
      isSubmitted: false,
    });
  };

  // Add Midpoint Handle in Option 2
  const handleAddMidpoint = () => {
    if (polyAVertices.length < 2) return;
    const p1 = polyAVertices[polyAVertices.length - 1];
    const p2 = polyAVertices[0];
    const mid = interpolatePoint(p1, p2, 0.5);
    const updated = [...polyAVertices, mid];
    setPolyAVertices(updated);
    onMutationDataChange({
      ...mutationData,
      splitCustomPointsA: updated,
      isSubmitted: false,
    });
  };

  // Remove Last Handle / Undo
  const handleRemovePoint = () => {
    if (polyAVertices.length === 0) return;
    const updated = polyAVertices.slice(0, -1);
    setPolyAVertices(updated);
    onMutationDataChange({
      ...mutationData,
      splitCustomPointsA: updated,
      isSubmitted: false,
    });
  };

  // Reset to Default Polygon (Cho Option 2)
  const handleResetDefault = () => {
    const def = getDefaultPolygonA();
    setPolyAVertices(def);
    onMutationDataChange({
      ...mutationData,
      splitCustomPointsA: def,
      isSubmitted: false,
    });
  };

  // Apply L-Shape Preset
  const handleApplyLShape = () => {
    const lShape = getLShapePolygon();
    setPolyAVertices(lShape);
    onMutationDataChange({
      ...mutationData,
      splitCustomPointsA: lShape,
      isSubmitted: false,
    });
  };

  // Multi-Select Selected Merge Codes
  const selectedMergeCodes: string[] = useMemo(() => {
    if (mutationData.selectedMergeCodes && Array.isArray(mutationData.selectedMergeCodes)) {
      return mutationData.selectedMergeCodes;
    }
    if (mutationData.mergeTargetCode) {
      return [mutationData.mergeTargetCode];
    }
    return [];
  }, [mutationData.selectedMergeCodes, mutationData.mergeTargetCode]);

  // Multi-Merge Calculations
  const mergeSummary = useMemo(() => {
    const allMergeCodes = Array.from(new Set([parcelData.projectParcelCode, ...selectedMergeCodes]));
    allMergeCodes.sort();
    const keptCode = allMergeCodes[0] || parcelData.projectParcelCode;
    const deprecatedCodes = allMergeCodes.filter((c) => c !== keptCode);

    let totalMergedArea = totalLandArea;
    selectedMergeCodes.forEach((code) => {
      const p = tenClosestParcels.find((zp) => zp.projectParcelCode === code);
      const approxArea = (p as any)?.land_area_m2 || 75.0;
      totalMergedArea += approxArea;
    });

    return {
      keptCode,
      deprecatedCodes,
      totalMergedArea: Math.round(totalMergedArea * 10) / 10,
    };
  }, [selectedMergeCodes, parcelData.projectParcelCode, totalLandArea, tenClosestParcels]);

  // Handle Multi-Select Merge Parcel Toggle
  const handleToggleMergeParcel = (code: string) => {
    if (code === parcelData.projectParcelCode) return;
    const current = selectedMergeCodes;
    const next = current.includes(code) ? current.filter((c) => c !== code) : [...current, code];

    onMutationDataChange({
      ...mutationData,
      selectedMergeCodes: next,
      mergeTargetCode: next[0] || '',
      isSubmitted: false,
    });
  };

  // MERGE WITH PARTIAL BUILDING: Tính diện tích công trình P1 và đất dư P2
  const calculatedMergeBArea = useMemo(() => {
    if (mergeBuildingVertices.length >= 3) {
      const raw = computePolygonAreaM2(mergeBuildingVertices);
      if (raw > 0) return raw;
    }
    return mutationData.mergeBuildingAreaM2 || Math.round((mergeSummary.totalMergedArea || totalLandArea) * 0.65 * 10) / 10;
  }, [mergeBuildingVertices, mutationData.mergeBuildingAreaM2, mergeSummary.totalMergedArea, totalLandArea]);

  const calculatedMergeRArea = useMemo(() => {
    const total = mergeSummary.totalMergedArea || totalLandArea;
    return Math.max(0.1, Math.round((total - calculatedMergeBArea) * 10) / 10);
  }, [mergeSummary.totalMergedArea, totalLandArea, calculatedMergeBArea]);

  const handleMergeMapClickDraw = (point: [number, number]) => {
    const updated = [...mergeBuildingVertices, point];
    setMergeBuildingVertices(updated);
    const bArea = updated.length >= 3 ? computePolygonAreaM2(updated) : 0;
    const total = mergeSummary.totalMergedArea || totalLandArea;
    const validBArea = bArea > 0 ? bArea : Math.round(total * 0.65 * 10) / 10;
    const rArea = Math.max(0.1, Math.round((total - validBArea) * 10) / 10);
    onMutationDataChange({
      ...mutationData,
      mergeBuildingCustomPoints: updated,
      mergeBuildingAreaM2: validBArea,
      mergeResidualAreaM2: rArea,
      mergeResidualParcelCode: `${mergeSummary.keptCode}-P2`,
      isSubmitted: false,
    });
  };

  const handleMergeRemoveLastPoint = () => {
    if (mergeBuildingVertices.length === 0) return;
    const updated = mergeBuildingVertices.slice(0, -1);
    setMergeBuildingVertices(updated);
    const bArea = updated.length >= 3 ? computePolygonAreaM2(updated) : 0;
    const total = mergeSummary.totalMergedArea || totalLandArea;
    const validBArea = bArea > 0 ? bArea : Math.round(total * 0.65 * 10) / 10;
    const rArea = Math.max(0.1, Math.round((total - validBArea) * 10) / 10);
    onMutationDataChange({
      ...mutationData,
      mergeBuildingCustomPoints: updated,
      mergeBuildingAreaM2: validBArea,
      mergeResidualAreaM2: rArea,
      mergeResidualParcelCode: `${mergeSummary.keptCode}-P2`,
      isSubmitted: false,
    });
  };

  const handleMergeClearDraw = () => {
    setMergeBuildingVertices([]);
    const total = mergeSummary.totalMergedArea || totalLandArea;
    const bArea = Math.round(total * 0.65 * 10) / 10;
    const rArea = Math.round((total - bArea) * 10) / 10;
    onMutationDataChange({
      ...mutationData,
      mergeBuildingCustomPoints: [],
      mergeBuildingAreaM2: bArea,
      mergeResidualAreaM2: rArea,
      mergeResidualParcelCode: `${mergeSummary.keptCode}-P2`,
      isSubmitted: false,
    });
  };

  // Handle Save Mutation Proposal (Lưu tạm vào hồ sơ thửa ban đầu, không gọi API sớm)
  const handleSaveMutationProposal = () => {
    if (boundaryStatus === 'SPLIT' && !mutationData.splitReason?.trim()) {
      alert('Vui lòng chọn hoặc nhập Lý do chia tách thửa đất thực tế trước khi xác nhận đề xuất!');
      const el = document.getElementById('input-splitReason');
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setIsSubmittingMutation(true);
    const nowStr = new Date().toLocaleTimeString('vi-VN');
    const updatedMutation: MutationPayloadData = {
      ...mutationData,
      isSubmitted: true,
      activeProposalType: boundaryStatus,
      matchConfirmed: false,
      submittedAt: nowStr,
      splitShapeOption,
      splitCustomPointsA: polyAVertices,
    };

    onMutationDataChange(updatedMutation);

    if (onToastMessage) {
      onToastMessage(
        `✓ Đã ghi nhận đề xuất ${boundaryStatus === 'SPLIT' ? 'Tách thửa' : 'Gộp thửa'} gần nhất vào hồ sơ thửa ${parcelData.projectParcelCode}!`
      );
    }

    setTimeout(() => {
      setIsSubmittingMutation(false);
    }, 200);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {/* 1. THÔNG TIN KÍCH THƯỚC THỬA ĐẤT BAN ĐẦU */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '0.75rem',
          border: '1px solid #e2e8f0',
          padding: '0.75rem 0.95rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.55rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#e0f2fe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Ruler size={17} color="#0284c7" />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center' }}>
                Kích Thước Thửa Ban Đầu
                <HelpBadge
                  title="Thông tin ranh thửa ban đầu"
                  content="Dữ liệu kích thước và ranh thửa được trích xuất từ cơ sở dữ liệu địa chính PostGIS Ga S9 Metro 2."
                />
              </div>
              <div style={{ fontSize: '0.725rem', color: '#64748b' }}>
                Mã DA: <strong style={{ color: '#0284c7' }}>{parcelData.projectParcelCode}</strong> | Mã địa chính: <strong style={{ color: '#d97706' }}>{parcelData.officialCadastralCode}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            <span
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                padding: '0.2rem 0.55rem',
                borderRadius: '0.4rem',
                fontSize: '0.725rem',
                color: '#334155',
              }}
            >
              Mặt tiền: <strong style={{ color: '#0284c7' }}>{frontage}m</strong>
            </span>
            <span
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                padding: '0.2rem 0.55rem',
                borderRadius: '0.4rem',
                fontSize: '0.725rem',
                color: '#334155',
              }}
            >
              Chiều sâu: <strong style={{ color: '#0284c7' }}>{depth}m</strong>
            </span>
            <span
              style={{
                backgroundColor: '#e0f2fe',
                border: '1px solid #bae6fd',
                padding: '0.2rem 0.55rem',
                borderRadius: '0.4rem',
                fontSize: '0.725rem',
                color: '#0369a1',
                fontWeight: 700,
              }}
            >
              Diện tích S = {totalLandArea} m²
            </span>
          </div>
        </div>

        <div style={{ fontSize: '0.725rem', color: '#475569', borderTop: '1px solid #f1f5f9', paddingTop: '0.35rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
          <span>
            Địa chỉ: <strong>Số {parcelData.houseNumber} {parcelData.street}, {parcelData.ward || 'Phường 15'}, {parcelData.district || 'Quận Tân Bình'}</strong>
          </span>
          <span>Chủ hộ: <strong>{parcelData.ownerName || 'Chưa cập nhật'}</strong></span>
        </div>
      </div>

      {/* 2. BỘ CHỌN 3 TRẠNG THÁI RANH THỰC TẾ (MATCH / SPLIT / MERGE) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.45rem' }}>
        <button
          type="button"
          onClick={() => onStatusChange('MATCH')}
          style={{
            padding: '0.6rem 0.8rem',
            borderRadius: '0.65rem',
            border: boundaryStatus === 'MATCH' ? '2px solid #16a34a' : '1px solid #cbd5e1',
            backgroundColor: boundaryStatus === 'MATCH' ? '#dcfce7' : '#ffffff',
            color: boundaryStatus === 'MATCH' ? '#15803d' : '#475569',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            textAlign: 'left',
            boxShadow: boundaryStatus === 'MATCH' ? '0 2px 4px rgba(22, 163, 74, 0.12)' : 'none',
          }}
        >
          <CheckCircle size={19} color={boundaryStatus === 'MATCH' ? '#16a34a' : '#94a3b8'} />
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>1. Khớp Ranh (MATCH)</div>
            <div style={{ fontSize: '0.675rem', opacity: 0.85 }}>Xây dựng 100% diện tích thửa</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onStatusChange('SPLIT')}
          style={{
            padding: '0.6rem 0.8rem',
            borderRadius: '0.65rem',
            border: boundaryStatus === 'SPLIT' ? '2px solid #ea580c' : '1px solid #cbd5e1',
            backgroundColor: boundaryStatus === 'SPLIT' ? '#ffedd5' : '#ffffff',
            color: boundaryStatus === 'SPLIT' ? '#c2410c' : '#475569',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            textAlign: 'left',
            boxShadow: boundaryStatus === 'SPLIT' ? '0 2px 4px rgba(234, 88, 12, 0.12)' : 'none',
          }}
        >
          <Layers size={19} color={boundaryStatus === 'SPLIT' ? '#ea580c' : '#94a3b8'} />
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>2. Tách Thửa (SPLIT)</div>
            <div style={{ fontSize: '0.675rem', opacity: 0.85 }}>Kéo nắn điểm / Chấm vẽ đa giác</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onStatusChange('MERGE')}
          style={{
            padding: '0.6rem 0.8rem',
            borderRadius: '0.65rem',
            border: boundaryStatus === 'MERGE' ? '2px solid #0284c7' : '1px solid #cbd5e1',
            backgroundColor: boundaryStatus === 'MERGE' ? '#e0f2fe' : '#ffffff',
            color: boundaryStatus === 'MERGE' ? '#0369a1' : '#475569',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            textAlign: 'left',
            boxShadow: boundaryStatus === 'MERGE' ? '0 2px 4px rgba(2, 132, 199, 0.12)' : 'none',
          }}
        >
          <GitCompare size={19} color={boundaryStatus === 'MERGE' ? '#0284c7' : '#94a3b8'} />
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>3. Gộp Thửa (MERGE)</div>
            <div style={{ fontSize: '0.675rem', opacity: 0.85 }}>Chọn nhiều thửa liền kề gộp lại</div>
          </div>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 3.1. TRƯỜNG HỢP 1: KHỚP RANH (MATCH) - RENDER 1 MÌNH LÔ ĐẤT & XÂY 100%   */}
      {/* ========================================================================= */}
      {boundaryStatus === 'MATCH' && (
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #86efac',
            borderRadius: '0.75rem',
            padding: '0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', color: '#15803d', fontWeight: 800, fontSize: '0.825rem' }}>
              <CheckCircle size={17} style={{ marginRight: '0.35rem' }} />
              <span>Bản Đồ Đối Soát Ranh GIS (Thửa hiện tại)</span>
              <HelpBadge
                title="Khớp Ranh 100%"
                content="Công trình xây dựng trọn vẹn 100% diện tích thửa đất địa chính ban đầu. Không có tranh chấp ranh hay biến động diện tích."
              />
            </div>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <button
                type="button"
                onClick={() => setTileMode('osm')}
                style={{
                  padding: '0.2rem 0.5rem',
                  borderRadius: '0.3rem',
                  fontSize: '0.675rem',
                  fontWeight: 700,
                  backgroundColor: tileMode === 'osm' ? '#0284c7' : '#f1f5f9',
                  color: tileMode === 'osm' ? '#ffffff' : '#475569',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Bản đồ đường
              </button>
              <button
                type="button"
                onClick={() => setTileMode('satellite')}
                style={{
                  padding: '0.2rem 0.5rem',
                  borderRadius: '0.3rem',
                  fontSize: '0.675rem',
                  fontWeight: 700,
                  backgroundColor: tileMode === 'satellite' ? '#0284c7' : '#f1f5f9',
                  color: tileMode === 'satellite' ? '#ffffff' : '#475569',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Vệ tinh
              </button>
            </div>
          </div>

          <div
            style={{
              width: '100%',
              height: '260px',
              borderRadius: '0.65rem',
              overflow: 'hidden',
              border: '1.5px solid #cbd5e1',
              position: 'relative',
            }}
          >
            <MapContainer
              center={activeCentroid}
              zoom={18}
              maxZoom={22}
              zoomControl={false}
              style={{ width: '100%', height: '100%' }}
              scrollWheelZoom={true}
            >
              <MapBoundsController coords={realActiveCoords} zoom={18} />
              <ZoomControl position="bottomright" />

              {tileMode === 'satellite' ? (
                <TileLayer
                  attribution="Esri World Imagery"
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  maxNativeZoom={19}
                  maxZoom={22}
                />
              ) : (
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors &copy; CARTO"
                  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                  subdomains="abcd"
                  maxNativeZoom={19}
                  maxZoom={22}
                />
              )}

              <Polygon
                positions={realActiveCoords}
                pathOptions={{
                  color: '#16a34a',
                  fillColor: '#22c55e',
                  fillOpacity: 0.45,
                  weight: 3.5,
                }}
              >
                <Tooltip direction="top">
                  <div style={{ fontSize: '0.725rem', fontWeight: 800, color: '#15803d' }}>
                    {parcelData.projectParcelCode} ({totalLandArea} m²)
                  </div>
                </Tooltip>
              </Polygon>
            </MapContainer>

            <div
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                zIndex: 800,
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                color: '#15803d',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.2rem 0.5rem',
                borderRadius: '0.4rem',
                border: '1px solid #86efac',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <CheckCircle size={13} color="#16a34a" />
              <span>Đơn thửa: {totalLandArea} m²</span>
            </div>
          </div>

          {/* XÁC NHẬN KHỚP RANH 100% */}
          <div
            style={{
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '0.65rem',
              padding: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.55rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#166534', fontSize: '0.8rem', fontWeight: 800 }}>
              <ShieldCheck size={17} color="#16a34a" />
              <span>Xác Nhận Hiện Trạng: Ranh Xây Dựng Khớp 100% Thửa Đất</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.4rem', fontSize: '0.725rem', color: '#334155' }}>
              <div style={{ backgroundColor: '#ffffff', padding: '0.35rem 0.55rem', borderRadius: '0.35rem', border: '1px solid #dcfce7' }}>
                Mã DA: <strong style={{ color: '#15803d' }}>{parcelData.projectParcelCode}</strong>
              </div>
              <div style={{ backgroundColor: '#ffffff', padding: '0.35rem 0.55rem', borderRadius: '0.35rem', border: '1px solid #dcfce7' }}>
                Mã gốc: <strong style={{ color: '#15803d' }}>{parcelData.officialCadastralCode}</strong>
              </div>
              <div style={{ backgroundColor: '#ffffff', padding: '0.35rem 0.55rem', borderRadius: '0.35rem', border: '1px solid #dcfce7' }}>
                Diện tích: <strong style={{ color: '#15803d' }}>{totalLandArea} m²</strong> (100%)
              </div>
            </div>

            {/* Phản hồi trực quan sau khi xác nhận khớp ranh (chỉ hiện khi là đề xuất MATCH gần nhất) */}
            {mutationData.activeProposalType === 'MATCH' && mutationData.matchConfirmed && (
              <div
                style={{
                  backgroundColor: '#ecfdf5',
                  border: '1.5px solid #10b981',
                  borderRadius: '0.5rem',
                  padding: '0.55rem 0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  color: '#065f46',
                  fontSize: '0.725rem',
                  fontWeight: 700,
                  marginTop: '0.2rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <CheckCircle2 size={16} color="#059669" />
                  <span>
                    ✓ Đã xác nhận công trình khớp 100% ranh thửa đất {parcelData.projectParcelCode} ({mutationData.submittedAt || 'Đã ghi nhận'}). Đề xuất được lưu trong hồ sơ thửa ban đầu.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onMutationDataChange({ ...mutationData, matchConfirmed: false, activeProposalType: null })}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#6b7280',
                    fontSize: '0.675rem',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Xác nhận lại
                </button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
              <button
                type="button"
                onClick={() => {
                  const nowStr = new Date().toLocaleTimeString('vi-VN');
                  onMutationDataChange({
                    ...mutationData,
                    activeProposalType: 'MATCH',
                    matchConfirmed: true,
                    isSubmitted: false,
                    submittedAt: nowStr,
                  });
                  if (onToastMessage) {
                    onToastMessage(`✓ Đã xác nhận thửa ${parcelData.projectParcelCode} khớp ranh 100%!`);
                  }
                }}
                className="btn btn-primary btn-sm"
                style={{
                  backgroundColor: (mutationData.activeProposalType === 'MATCH' && mutationData.matchConfirmed) ? '#059669' : '#16a34a',
                  borderColor: (mutationData.activeProposalType === 'MATCH' && mutationData.matchConfirmed) ? '#059669' : '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '0.4rem 0.85rem',
                  boxShadow: (mutationData.activeProposalType === 'MATCH' && mutationData.matchConfirmed) ? '0 0 0 3px rgba(16, 185, 129, 0.25)' : 'none',
                }}
              >
                {(mutationData.activeProposalType === 'MATCH' && mutationData.matchConfirmed) ? <CheckCircle2 size={15} /> : <Check size={14} />}
                <span>{(mutationData.activeProposalType === 'MATCH' && mutationData.matchConfirmed) ? 'ĐÃ XÁC NHẬN KHỚP RANH 100%' : 'Xác nhận Khớp ranh 100%'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3.2. TRƯỜNG HỢP 2: TÁCH THỬA (SPLIT) - 2 OPTIONS CHUẨN KỸ THUẬT             */}
      {/* ========================================================================= */}
      {boundaryStatus === 'SPLIT' && (
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #fdba74',
            borderRadius: '0.75rem',
            padding: '0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', color: '#c2410c', fontWeight: 800, fontSize: '0.825rem' }}>
              <Layers size={17} style={{ marginRight: '0.35rem' }} />
              <span>Biên Tập Phân Tách Thửa Đất (2 Màu: Căn Đang KS & Đất Còn Dư)</span>
              <HelpBadge
                title="Hướng dẫn Tách thửa"
                content="Option 1: Chấm trực tiếp các điểm trên bản đồ, các điểm tự link lại để tạo diện tích cho mảnh đất (nhà chữ L, đa giác tự do). Option 2: Điều chỉnh kéo nắn các điểm mút polygon. Phần diện tích còn dư tự động tính cho ô thứ 2."
              />
            </div>
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              <span className="badge" style={{ backgroundColor: '#ffedd5', color: '#c2410c', border: '1px solid #fed7aa', fontSize: '0.675rem' }}>
                Mã mới: {dynamicCodes[0] || 'B-00108'}, {dynamicCodes[1] || 'B-00109'}
              </span>
              <button
                type="button"
                onClick={() => setTileMode(tileMode === 'osm' ? 'satellite' : 'osm')}
                style={{
                  padding: '0.2rem 0.5rem',
                  borderRadius: '0.3rem',
                  fontSize: '0.675rem',
                  fontWeight: 700,
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer',
                }}
              >
                {tileMode === 'osm' ? 'Vệ tinh' : 'Bản đồ'}
              </button>
            </div>
          </div>

          {/* BỘ CHỌN 2 OPTION BIÊN TẬP TÁCH THỬA (OPTION 1: CHẤM ĐIỂM, OPTION 2: KÉO NẮN ĐIỂM) */}
          <div style={{ display: 'flex', gap: '0.45rem' }}>
            <button
              type="button"
              onClick={() => {
                setSplitShapeOption('CLICK_TO_DRAW');
                onMutationDataChange({ ...mutationData, splitShapeOption: 'CLICK_TO_DRAW', isSubmitted: false });
              }}
              style={{
                flex: 1,
                padding: '0.5rem 0.65rem',
                borderRadius: '0.5rem',
                fontSize: '0.725rem',
                fontWeight: splitShapeOption === 'CLICK_TO_DRAW' ? 800 : 600,
                backgroundColor: splitShapeOption === 'CLICK_TO_DRAW' ? '#ea580c' : '#f8fafc',
                color: splitShapeOption === 'CLICK_TO_DRAW' ? '#ffffff' : '#475569',
                border: splitShapeOption === 'CLICK_TO_DRAW' ? 'none' : '1px solid #cbd5e1',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                boxShadow: splitShapeOption === 'CLICK_TO_DRAW' ? '0 2px 4px rgba(234, 88, 12, 0.2)' : 'none',
              }}
            >
              <MousePointer size={15} /> Option 1: Chấm các điểm (Tự link tạo diện tích)
            </button>

            <button
              type="button"
              onClick={() => {
                setSplitShapeOption('DRAG_HANDLES');
                onMutationDataChange({ ...mutationData, splitShapeOption: 'DRAG_HANDLES', isSubmitted: false });
              }}
              style={{
                flex: 1,
                padding: '0.5rem 0.65rem',
                borderRadius: '0.5rem',
                fontSize: '0.725rem',
                fontWeight: splitShapeOption === 'DRAG_HANDLES' ? 800 : 600,
                backgroundColor: splitShapeOption === 'DRAG_HANDLES' ? '#ea580c' : '#f8fafc',
                color: splitShapeOption === 'DRAG_HANDLES' ? '#ffffff' : '#475569',
                border: splitShapeOption === 'DRAG_HANDLES' ? 'none' : '1px solid #cbd5e1',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                boxShadow: splitShapeOption === 'DRAG_HANDLES' ? '0 2px 4px rgba(234, 88, 12, 0.2)' : 'none',
              }}
            >
              <Move size={15} /> Option 2: Điều chỉnh các điểm (Kéo di chuyển chấm)
            </button>
          </div>

          {/* TOOLBAR NÚT CÔNG CỤ THEO TỪNG OPTION */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.35rem',
              backgroundColor: '#fff7ed',
              padding: '0.4rem 0.65rem',
              borderRadius: '0.5rem',
              border: '1px dashed #fdba74',
            }}
          >
            {splitShapeOption === 'CLICK_TO_DRAW' ? (
              <>
                <div style={{ fontSize: '0.725rem', color: '#9a3412', fontWeight: 700 }}>
                  Option 1: Nhấp trên bản đồ để chấm các đỉnh ranh ({polyAVertices.length} điểm đã chấm):
                </div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button
                    type="button"
                    onClick={handleApplyLShape}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.675rem', padding: '0.2rem 0.45rem', display: 'flex', alignItems: 'center', gap: '0.2rem', backgroundColor: '#fed7aa', color: '#9a3412', fontWeight: 700 }}
                  >
                    Mẫu chữ L
                  </button>
                  <button
                    type="button"
                    onClick={handleRemovePoint}
                    disabled={polyAVertices.length === 0}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.675rem', padding: '0.2rem 0.45rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                  >
                    <Undo size={11} /> Hoàn tác
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPolyAVertices([]);
                      onMutationDataChange({ ...mutationData, splitCustomPointsA: [], isSubmitted: false });
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.675rem', padding: '0.2rem 0.45rem', display: 'flex', alignItems: 'center', gap: '0.2rem', color: '#dc2626' }}
                  >
                    <Trash2 size={11} /> Xóa vẽ lại (0 điểm)
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '0.725rem', color: '#9a3412', fontWeight: 700 }}>
                  Option 2: Kéo trực tiếp các điểm mút tròn (1, 2, 3...) để khớp với thực tế:
                </div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button
                    type="button"
                    onClick={handleAddMidpoint}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.675rem', padding: '0.2rem 0.45rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                  >
                    <Plus size={11} /> Thêm điểm nắn
                  </button>
                  <button
                    type="button"
                    onClick={handleRemovePoint}
                    disabled={polyAVertices.length <= 3}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.675rem', padding: '0.2rem 0.45rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                  >
                    <Minus size={11} /> Bớt điểm
                  </button>
                  <button
                    type="button"
                    onClick={handleResetDefault}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.675rem', padding: '0.2rem 0.45rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                  >
                    <RefreshCw size={11} /> Khôi phục mặc định
                  </button>
                </div>
              </>
            )}
          </div>

          {/* LEAFLET MAP VISUALIZER: TỌA ĐỘ THẬT POSTGIS VÀ CÁC ĐIỂM INTERACTIVE */}
          <div
            style={{
              width: '100%',
              height: '290px',
              borderRadius: '0.65rem',
              overflow: 'hidden',
              border: '1.5px solid #fdba74',
              position: 'relative',
            }}
          >
            <MapContainer
              center={activeCentroid}
              zoom={18}
              maxZoom={22}
              zoomControl={false}
              style={{ width: '100%', height: '100%' }}
              scrollWheelZoom={true}
            >
              <MapBoundsController coords={realActiveCoords} zoom={18} />
              <ZoomControl position="bottomright" />

              {/* Click listener for Option 1: Chấm điểm */}
              <MapClickListener
                enabled={splitShapeOption === 'CLICK_TO_DRAW'}
                onMapClick={handleMapClickDraw}
              />

              {tileMode === 'satellite' ? (
                <TileLayer
                  attribution="Esri World Imagery"
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  maxNativeZoom={19}
                  maxZoom={22}
                />
              ) : (
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors &copy; CARTO"
                  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                  subdomains="abcd"
                  maxNativeZoom={19}
                  maxZoom={22}
                />
              )}

              {/* PHẦN ĐẤT DƯ (MÀU 2 - CAM ĐỎ): NỀN THỬA GỐC ĐỊA CHÍNH */}
              <Polygon
                positions={realActiveCoords}
                pathOptions={{
                  color: '#c2410c',
                  fillColor: '#ea580c',
                  fillOpacity: 0.45,
                  weight: 2.5,
                  dashArray: '5, 5',
                }}
              >
                <Tooltip direction="top">
                  <div style={{ fontSize: '0.725rem', fontWeight: 800, color: '#c2410c' }}>
                    Phần còn lại / Đất thừa: {dynamicCodes[1] || 'B-00109'} ({calculatedAreaB} m²)
                  </div>
                </Tooltip>
              </Polygon>

              {/* CĂN A ĐANG KHẢO SÁT (MÀU 1 - VÀNG HỔ PHÁCH): ĐA GIÁC ĐƯỢC CHẤM / NẮN ĐIỂM */}
              {polyAVertices.length >= 3 && (
                <Polygon
                  positions={polyAVertices}
                  pathOptions={{
                    color: '#d97706',
                    fillColor: '#f59e0b',
                    fillOpacity: 0.7,
                    weight: 3.5,
                  }}
                >
                  <Tooltip direction="top">
                    <div style={{ fontSize: '0.725rem', fontWeight: 800, color: '#92400e' }}>
                      Căn A (Đang KS): {dynamicCodes[0] || 'B-00108'} ({calculatedAreaA} m²)
                    </div>
                  </Tooltip>
                </Polygon>
              )}

              {/* Polyline preview khi đang chấm < 3 điểm ở Option 1 */}
              {polyAVertices.length > 0 && (
                <Polyline
                  positions={polyAVertices}
                  pathOptions={{ color: '#d97706', weight: 4, dashArray: polyAVertices.length < 3 ? '4, 4' : undefined }}
                />
              )}

              {/* DRAGGABLE VERTEX HANDLES TRONG OPTION 2 */}
              {splitShapeOption === 'DRAG_HANDLES' &&
                polyAVertices.map((vertex, idx) => (
                  <Marker
                    key={`vertex-${idx}`}
                    position={vertex}
                    draggable={true}
                    icon={createHandleIcon(idx + 1)}
                    eventHandlers={{
                      dragend: (e) => {
                        handleVertexDrag(idx, e.target.getLatLng());
                      },
                    }}
                  />
                ))}

              {/* MARKER CHẤM ĐIỂM TRONG OPTION 1 */}
              {splitShapeOption === 'CLICK_TO_DRAW' &&
                polyAVertices.map((vertex, idx) => (
                  <Marker
                    key={`click-point-${idx}`}
                    position={vertex}
                    icon={createHandleIcon(idx + 1)}
                  />
                ))}
            </MapContainer>

            {/* Hướng dẫn khi chưa có điểm nào ở Option 1 */}
            {splitShapeOption === 'CLICK_TO_DRAW' && polyAVertices.length === 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 800,
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  color: '#c2410c',
                  padding: '0.35rem 0.85rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.725rem',
                  fontWeight: 700,
                  border: '1.5px solid #fdba74',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  whiteSpace: 'nowrap',
                }}
              >
                <MousePointer size={14} color="#ea580c" />
                <span>👉 Hãy nhấp lên bản đồ để chấm các đỉnh ranh giới Căn A (Cần ít nhất 3 điểm để tạo thành mảnh đất)</span>
              </div>
            )}

            {/* Clean Floating Legend (Không che tâm thửa đất) */}
            <div
              style={{
                position: 'absolute',
                bottom: '8px',
                left: '8px',
                zIndex: 800,
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                color: '#0f172a',
                padding: '0.3rem 0.6rem',
                borderRadius: '0.45rem',
                fontSize: '0.675rem',
                border: '1px solid #fed7aa',
                boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
                display: 'flex',
                gap: '0.65rem',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ width: '10px', height: '10px', backgroundColor: '#f59e0b', borderRadius: '2px', display: 'inline-block' }}></span>
                <span>Màu 1 (Căn A): <strong>{calculatedAreaA} m²</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ width: '10px', height: '10px', backgroundColor: '#ea580c', borderRadius: '2px', display: 'inline-block' }}></span>
                <span>Màu 2 (Đất thừa / Ô 2): <strong>{calculatedAreaB} m²</strong></span>
              </div>
            </div>
          </div>

          {/* PHÂN LOẠI CÔNG NĂNG CHO Ô CÒN DƯ (MÀU 2) - CÓ MỤC KHÁC CHO PHÉP NHẬP */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #fed7aa',
              borderRadius: '0.65rem',
              padding: '0.65rem 0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.45rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#9a3412', margin: 0, display: 'flex', alignItems: 'center' }}>
                <Tag size={14} color="#ea580c" style={{ marginRight: '0.3rem' }} />
                Công năng sử dụng Ô còn dư (Màu 2 - {calculatedAreaB} m²):
                <HelpBadge
                  type="alert"
                  title="Quy tắc xử lý đất dôi dư"
                  content="Toàn bộ phần dôi dư sau khi tách (kể cả mé nhỏ sai số địa chính) mặc định là Đất thừa. Khi khảo sát căn bên cạnh, kỹ sư chỉ việc chấm ranh căn của họ, mé thừa còn lại được tự động bỏ qua."
                />
              </label>
            </div>

            {/* List sổ chọn công năng ô còn dư */}
            <select
              className="form-control"
              style={{ fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#fff7ed', border: '1.5px solid #fdba74', color: '#9a3412' }}
              value={
                RESIDUAL_FUNCTION_OPTIONS.some((opt) => opt.value === (mutationData.splitChildren?.[1]?.functionalType || 'RESIDUAL_SURPLUS'))
                  ? (mutationData.splitChildren?.[1]?.functionalType || 'RESIDUAL_SURPLUS')
                  : 'OTHER'
              }
              onChange={(e) => {
                const val = e.target.value;
                const isSurplus = val === 'RESIDUAL_SURPLUS';
                const updatedChildren = [...(mutationData.splitChildren || [])];
                if (!updatedChildren[0]) {
                  updatedChildren[0] = {
                    label: 'Căn A (Mặt tiền / Đang KS)',
                    houseNumber: `${parcelData.houseNumber}A`,
                    ownerName: parcelData.ownerName || '',
                    suggestedCode: dynamicCodes[0] || 'B-00108',
                    areaM2: calculatedAreaA,
                    functionalType: 'Nhà ở gia đình (Nhà phố / Biệt thự / Căn hộ)',
                  };
                }
                const finalType = val === 'OTHER' ? (customResidualType || 'Khác: ') : val;
                updatedChildren[1] = {
                  ...(updatedChildren[1] || {
                    label: 'Căn B (Phần còn dư)',
                    houseNumber: `${parcelData.houseNumber}B`,
                    ownerName: 'Chủ sở hữu phần đất dôi dư',
                    suggestedCode: dynamicCodes[1] || 'B-00109',
                  }),
                  areaM2: calculatedAreaB,
                  functionalType: finalType,
                  isResidualSurplus: isSurplus,
                  residualParentParcelCode: parcelData.projectParcelCode,
                  residualParentCadastralCode: parcelData.officialCadastralCode,
                  residualParentAddress: `Số ${parcelData.houseNumber} ${parcelData.street}`,
                  residualMetadataNote: isSurplus
                    ? `Đất thừa dôi dư tách từ thửa ${parcelData.projectParcelCode}`
                    : `Lô đất phân tách công năng [${finalType}] từ thửa gốc ${parcelData.projectParcelCode}`,
                };

                onMutationDataChange({
                  ...mutationData,
                  splitChildren: updatedChildren,
                  isSubmitted: false,
                });
              }}
            >
              {RESIDUAL_FUNCTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Ô nhập text tự do khi chọn KHÁC ở công năng ô còn dư */}
            {(mutationData.splitChildren?.[1]?.functionalType === 'OTHER' ||
              (mutationData.splitChildren?.[1]?.functionalType &&
                !RESIDUAL_FUNCTION_OPTIONS.some((o) => o.value === mutationData.splitChildren?.[1]?.functionalType))) && (
              <div style={{ marginTop: '0.2rem' }}>
                <input
                  type="text"
                  className="form-control"
                  style={{ fontSize: '0.75rem', backgroundColor: '#ffffff', border: '1px solid #fdba74' }}
                  placeholder="Nhập cụ thể công năng sử dụng của ô đất còn dư..."
                  value={customResidualType || mutationData.splitChildren?.[1]?.functionalType || ''}
                  onChange={(e) => {
                    const text = e.target.value;
                    setCustomResidualType(text);
                    const updatedChildren = [...(mutationData.splitChildren || [])];
                    if (updatedChildren[1]) {
                      updatedChildren[1] = {
                        ...updatedChildren[1],
                        functionalType: text,
                        residualMetadataNote: `Công năng khác: ${text}`,
                      };
                      onMutationDataChange({
                        ...mutationData,
                        splitChildren: updatedChildren,
                        isSubmitted: false,
                      });
                    }
                  }}
                />
              </div>
            )}
          </div>

          {/* LÝ DO CHIA TÁCH THỬA ĐẤT THỰC TẾ: LIST SỔ CHỌN + MỤC KHÁC CHO NHẬP */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', margin: 0, display: 'flex', alignItems: 'center' }}>
              Lý do chia tách thửa đất thực tế:
              <span style={{ color: '#dc2626', marginLeft: '4px', fontWeight: 800 }}>* (Bắt buộc)</span>
              <HelpBadge
                title="Lý do tách thửa"
                content="Bắt buộc chọn lý do phổ biến trong danh sách sổ chọn hoặc chọn 'Khác' để nhập chi tiết lý do phân chia thực tế."
              />
            </label>

            <select
              id="input-splitReason"
              className="form-control"
              style={{ fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#ffffff', border: '1.5px solid #cbd5e1' }}
              value={
                COMMON_SPLIT_REASONS.includes(mutationData.splitReason || '')
                  ? (mutationData.splitReason || '')
                  : (mutationData.splitReason ? 'OTHER' : '')
              }
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'OTHER') {
                  onMutationDataChange({
                    ...mutationData,
                    splitReason: customSplitReason ? `Khác: ${customSplitReason}` : 'Khác: ',
                    isSubmitted: false,
                  });
                } else {
                  onMutationDataChange({
                    ...mutationData,
                    splitReason: val,
                    isSubmitted: false,
                  });
                }
              }}
            >
              <option value="">-- Chọn lý do chia tách thửa đất thực tế --</option>
              {COMMON_SPLIT_REASONS.map((r, i) => (
                <option key={r} value={r}>
                  {i + 1}. {r}
                </option>
              ))}
              <option value="OTHER">7. Khác (Nhập lý do thực tế...)</option>
            </select>

            {/* Ô nhập lý do khác khi chọn OTHER */}
            {(mutationData.splitReason?.startsWith('Khác') ||
              (mutationData.splitReason && !COMMON_SPLIT_REASONS.includes(mutationData.splitReason))) && (
              <div style={{ marginTop: '0.15rem' }}>
                <input
                  type="text"
                  className="form-control"
                  style={{ fontSize: '0.75rem', border: '1px solid #fdba74' }}
                  placeholder="Nhập lý do chia tách thực tế tại hiện trường..."
                  value={
                    customSplitReason ||
                    (mutationData.splitReason.startsWith('Khác: ')
                      ? mutationData.splitReason.replace('Khác: ', '')
                      : mutationData.splitReason)
                  }
                  onChange={(e) => {
                    const text = e.target.value;
                    setCustomSplitReason(text);
                    onMutationDataChange({
                      ...mutationData,
                      splitReason: text ? `Khác: ${text}` : 'Khác: ',
                      isSubmitted: false,
                    });
                  }}
                />
              </div>
            )}
          </div>

          {/* Phản hồi trực quan sau khi đề xuất tách thửa (chỉ hiện khi là đề xuất SPLIT gần nhất) */}
          {mutationData.activeProposalType === 'SPLIT' && mutationData.isSubmitted && (
            <div
              style={{
                backgroundColor: '#ecfdf5',
                border: '1.5px solid #10b981',
                borderRadius: '0.5rem',
                padding: '0.55rem 0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                color: '#065f46',
                fontSize: '0.725rem',
                fontWeight: 700,
              }}
            >
              <CheckCircle2 size={16} color="#059669" />
              <span>
                ✓ Đã lưu tạm cấu hình tách thửa vào hồ sơ thửa ban đầu {parcelData.projectParcelCode} ({mutationData.submittedAt}). Đề xuất được lưu trong hồ sơ thửa ban đầu.
              </span>
            </div>
          )}

          {/* NÚT LƯU ĐỀ XUẤT TÁCH THỬA (CÓ HIỆU ỨNG PHẢN HỒI) */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSaveMutationProposal}
              disabled={isSubmittingMutation}
              style={{
                backgroundColor: (mutationData.activeProposalType === 'SPLIT' && mutationData.isSubmitted) ? '#16a34a' : '#ea580c',
                borderColor: (mutationData.activeProposalType === 'SPLIT' && mutationData.isSubmitted) ? '#16a34a' : '#ea580c',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '0.4rem 0.95rem',
                boxShadow: (mutationData.activeProposalType === 'SPLIT' && mutationData.isSubmitted) ? '0 0 0 3px rgba(22, 163, 74, 0.25)' : 'none',
              }}
            >
              {(mutationData.activeProposalType === 'SPLIT' && mutationData.isSubmitted) ? <CheckCircle2 size={15} /> : <CheckCircle size={14} />}
              <span>
                {isSubmittingMutation
                  ? 'Đang lưu...'
                  : (mutationData.activeProposalType === 'SPLIT' && mutationData.isSubmitted)
                  ? `ĐÃ GHI NHẬN ĐỀ XUẤT TÁCH THỬA (${mutationData.submittedAt})`
                  : 'Lưu đề xuất Tách thửa'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3.3. TRƯỜNG HỢP 3: GỘP THỬA (MERGE) - RENDER 10 Ô GẦN NHẤT & MULTI-SELECT  */}
      {/* ========================================================================= */}
      {boundaryStatus === 'MERGE' && (
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #93c5fd',
            borderRadius: '0.75rem',
            padding: '0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', color: '#0369a1', fontWeight: 800, fontSize: '0.825rem' }}>
              <GitCompare size={17} style={{ marginRight: '0.35rem' }} />
              <span>Đề Xuất Gộp Thửa Thực Địa</span>
              <HelpBadge
                title="Quy tắc Gộp thửa"
                content="Bấm chọn các thửa liền kề trên bản đồ hoặc danh sách bên dưới để gộp lại thành một công trình. Mã dự án nhỏ nhất trong nhóm sẽ được giữ lại làm mã đại diện chính thức."
              />
            </div>
            <span className="badge" style={{ backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #93c5fd', fontSize: '0.675rem' }}>
              Giữ mã nhỏ nhất: {mergeSummary.keptCode}
            </span>
          </div>

          <div
            style={{
              width: '100%',
              height: '280px',
              borderRadius: '0.65rem',
              overflow: 'hidden',
              border: '1.5px solid #0284c7',
              position: 'relative',
            }}
          >
            <MapContainer
              center={activeCentroid}
              zoom={17}
              maxZoom={22}
              zoomControl={false}
              style={{ width: '100%', height: '100%' }}
              scrollWheelZoom={true}
            >
              <MapBoundsController coords={realActiveCoords} zoom={17} />
              <ZoomControl position="bottomright" />

              <TileLayer
                attribution="&copy; OpenStreetMap contributors &copy; CARTO"
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                subdomains="abcd"
                maxNativeZoom={19}
                maxZoom={22}
              />

              {/* 1. THỬA ĐANG KHẢO SÁT (THỬA GỐC) - HIGHLIGHT NỔI BẬT ĐẶC BIỆT */}
              <Polygon
                positions={realActiveCoords}
                pathOptions={{
                  color: '#b45309',
                  fillColor: '#f59e0b',
                  fillOpacity: 0.65,
                  weight: 5,
                }}
              >
                <Tooltip permanent direction="center">
                  <div style={{ textAlign: 'center', fontWeight: 900, color: '#7c2d12', fontSize: '0.725rem', textShadow: '0 1px 2px #fff' }}>
                    ⭐ THỬA GỐC ĐANG KS<br />
                    <span style={{ fontSize: '0.825rem', color: '#b45309' }}>{parcelData.projectParcelCode}</span> ({totalLandArea} m²)
                  </div>
                </Tooltip>
              </Polygon>

              {/* 2. CÁC THỬA LÂN CẬN XUNG QUANH (CLICK ĐỂ GỘP/BỎ GỘP) */}
              {tenClosestParcels.map((neighbor) => {
                const isSelectedMerge = selectedMergeCodes.includes(neighbor.projectParcelCode);

                return (
                  <Polygon
                    key={neighbor.id || neighbor.projectParcelCode}
                    positions={neighbor.coordinates}
                    pathOptions={{
                      color: isSelectedMerge ? '#047857' : '#475569',
                      fillColor: isSelectedMerge ? '#10b981' : '#cbd5e1',
                      fillOpacity: isSelectedMerge ? 0.75 : 0.3,
                      weight: isSelectedMerge ? 4 : 2,
                      dashArray: isSelectedMerge ? undefined : '5, 4',
                    }}
                    eventHandlers={{
                      click: () => {
                        handleToggleMergeParcel(neighbor.projectParcelCode);
                      },
                    }}
                  >
                    <Tooltip direction="top" opacity={0.95}>
                      <div style={{ fontSize: '0.725rem', fontWeight: 800 }}>
                        {isSelectedMerge ? '✓ ĐÃ CHỌN GỘP: ' : 'Thửa lân cận: '}
                        <strong style={{ color: isSelectedMerge ? '#047857' : '#1e293b' }}>{neighbor.projectParcelCode}</strong>
                        {isSelectedMerge ? <span style={{ color: '#047857' }}> (Bấm để hủy)</span> : <span style={{ color: '#2563eb' }}> (Bấm để gộp)</span>}<br />
                        <span style={{ fontSize: '0.65rem', fontWeight: 500 }}>
                          Số {neighbor.houseNumber} {neighbor.street}
                        </span>
                      </div>
                    </Tooltip>
                  </Polygon>
                );
              })}
            </MapContainer>

            {/* Chú giải trực quan phân biệt thửa gốc và các thửa lân cận */}
            <div
              style={{
                position: 'absolute',
                top: '8px',
                left: '8px',
                zIndex: 800,
                backgroundColor: 'rgba(255, 255, 255, 0.96)',
                padding: '0.35rem 0.65rem',
                borderRadius: '0.5rem',
                fontSize: '0.675rem',
                border: '1px solid #cbd5e1',
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#b45309', fontWeight: 800 }}>
                <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: '#f59e0b', border: '2px solid #b45309', borderRadius: '2px' }} />
                Thửa gốc đang KS ({parcelData.projectParcelCode})
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#047857', fontWeight: 700 }}>
                <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: '#10b981', border: '2px solid #047857', borderRadius: '2px' }} />
                Đã chọn gộp ({selectedMergeCodes.length})
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#64748b' }}>
                <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: '#e2e8f0', border: '1px dashed #475569', borderRadius: '2px' }} />
                Thửa lân cận (Click để gộp)
              </span>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Chọn các thửa đất liền kề để gộp ({selectedMergeCodes.length} thửa đã chọn):
              </label>
              {selectedMergeCodes.length > 0 && (
                <button
                  type="button"
                  onClick={() => onMutationDataChange({ ...mutationData, selectedMergeCodes: [], mergeTargetCode: '' })}
                  style={{
                    border: 'none',
                    background: 'none',
                    color: '#dc2626',
                    fontSize: '0.675rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Bỏ chọn tất cả
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto', padding: '2px' }}>
              {tenClosestParcels
                .filter((p) => p.projectParcelCode !== parcelData.projectParcelCode)
                .map((adj) => {
                  const isSelected = selectedMergeCodes.includes(adj.projectParcelCode);
                  return (
                    <div
                      key={adj.id}
                      onClick={() => handleToggleMergeParcel(adj.projectParcelCode)}
                      style={{
                        padding: '0.4rem 0.55rem',
                        borderRadius: '0.45rem',
                        border: isSelected ? '2px solid #0284c7' : '1px solid #cbd5e1',
                        backgroundColor: isSelected ? '#e0f2fe' : '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.775rem', fontWeight: isSelected ? 800 : 600, color: isSelected ? '#0369a1' : '#334155' }}>
                          {adj.projectParcelCode} ({adj.distanceMeters || 0}m)
                        </div>
                        <div style={{ fontSize: '0.675rem', color: '#64748b' }}>
                          Số {adj.houseNumber} {adj.street}
                        </div>
                      </div>
                      {isSelected && <Check size={15} color="#0284c7" />}
                    </div>
                  );
                })}
            </div>
          </div>

          {selectedMergeCodes.length > 0 && (
            <div
              style={{
                backgroundColor: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: '0.5rem',
                padding: '0.55rem 0.75rem',
                fontSize: '0.725rem',
                color: '#0369a1',
                lineHeight: 1.5,
              }}
            >
              • <strong>Mã giữ lại:</strong> <span className="badge" style={{ backgroundColor: '#0284c7', color: '#ffffff' }}>{mergeSummary.keptCode}</span> | <strong>Tổng diện tích sau gộp:</strong> <strong>{mergeSummary.totalMergedArea} m²</strong> ({selectedMergeCodes.length + 1} thửa)
            </div>
          )}

          <div>
            <label style={{ fontSize: '0.725rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center' }}>
              Lý do gộp thửa:
              <HelpBadge
                title="Lý do gộp thửa"
                content="Chọn lý do phổ biến trong danh sách sổ chọn hoặc chọn 'Khác' để nhập chi tiết lý do công trình xây dựng hợp khối nhiều thửa."
              />
            </label>
            <select
              className="form-control"
              style={{ fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#ffffff', border: '1.5px solid #cbd5e1', marginTop: '0.2rem' }}
              value={
                COMMON_MERGE_REASONS.includes(mutationData.mergeReason || '')
                  ? (mutationData.mergeReason || '')
                  : (mutationData.mergeReason ? 'OTHER' : '')
              }
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'OTHER') {
                  onMutationDataChange({
                    ...mutationData,
                    mergeReason: customMergeReason ? `Khác: ${customMergeReason}` : 'Khác: ',
                    isSubmitted: false,
                  });
                } else {
                  onMutationDataChange({
                    ...mutationData,
                    mergeReason: val,
                    isSubmitted: false,
                  });
                }
              }}
            >
              <option value="">-- Chọn lý do gộp thửa thực tế --</option>
              {COMMON_MERGE_REASONS.map((r, i) => (
                <option key={r} value={r}>
                  {i + 1}. {r}
                </option>
              ))}
              <option value="OTHER">5. Khác (Nhập lý do thực tế...)</option>
            </select>

            {/* Ô nhập lý do khác khi chọn OTHER ở Gộp thửa */}
            {(mutationData.mergeReason?.startsWith('Khác') ||
              (mutationData.mergeReason && !COMMON_MERGE_REASONS.includes(mutationData.mergeReason))) && (
              <div style={{ marginTop: '0.2rem' }}>
                <input
                  type="text"
                  className="form-control"
                  style={{ fontSize: '0.75rem', border: '1px solid #93c5fd' }}
                  placeholder="Nhập lý do gộp thửa thực tế tại hiện trường..."
                  value={
                    customMergeReason ||
                    (mutationData.mergeReason.startsWith('Khác: ')
                      ? mutationData.mergeReason.replace('Khác: ', '')
                      : mutationData.mergeReason)
                  }
                  onChange={(e) => {
                    const text = e.target.value;
                    setCustomMergeReason(text);
                    onMutationDataChange({
                      ...mutationData,
                      mergeReason: text ? `Khác: ${text}` : 'Khác: ',
                      isSubmitted: false,
                    });
                  }}
                />
              </div>
            )}
          </div>

          {/* 3.3.1. KHOANH VÙNG DIỆN TÍCH XÂY DỰNG & TÁCH MẢNH ĐẤT DƯ KHI GỘP */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1.5px solid #cbd5e1',
              borderRadius: '0.65rem',
              padding: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Layers size={14} color="#0284c7" />
                Hiện trạng xây dựng của toà nhà trên đất sau gộp:
              </label>
              <span className="badge" style={{ backgroundColor: mutationData.mergeHasPartialBuilding ? '#ea580c' : '#0284c7', color: '#fff', fontSize: '0.675rem' }}>
                {mutationData.mergeHasPartialBuilding ? 'Xây một phần (Có đất dư)' : 'Xây kín toàn bộ'}
              </span>
            </div>

            {/* Hai tùy chọn dạng thẻ bấm */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => {
                  onMutationDataChange({
                    ...mutationData,
                    mergeHasPartialBuilding: false,
                    isSubmitted: false,
                  });
                }}
                style={{
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: !mutationData.mergeHasPartialBuilding ? '2px solid #0284c7' : '1px solid #cbd5e1',
                  backgroundColor: !mutationData.mergeHasPartialBuilding ? '#e0f2fe' : '#ffffff',
                  color: !mutationData.mergeHasPartialBuilding ? '#0369a1' : '#475569',
                  textAlign: 'left',
                  fontSize: '0.725rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span style={{ fontSize: '1rem' }}>🏢</span>
                <div>
                  <div>Nhà xây kín toàn bộ đất gộp</div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 500, color: '#64748b' }}>
                    Công trình chiếm 100% diện tích gộp ({mergeSummary.totalMergedArea} m²)
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  const total = mergeSummary.totalMergedArea || totalLandArea;
                  const bArea = Math.round(total * 0.65 * 10) / 10;
                  const rArea = Math.round((total - bArea) * 10) / 10;
                  onMutationDataChange({
                    ...mutationData,
                    mergeHasPartialBuilding: true,
                    mergeBuildingAreaM2: mutationData.mergeBuildingAreaM2 || bArea,
                    mergeResidualAreaM2: mutationData.mergeResidualAreaM2 || rArea,
                    mergeResidualType: mutationData.mergeResidualType || 'Sân vườn / Cây cảnh',
                    mergeResidualParcelCode: `${mergeSummary.keptCode}-P2`,
                    mergeBuildingRatio: 65,
                    isSubmitted: false,
                  });
                }}
                style={{
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: mutationData.mergeHasPartialBuilding ? '2px solid #ea580c' : '1px solid #cbd5e1',
                  backgroundColor: mutationData.mergeHasPartialBuilding ? '#ffedd5' : '#ffffff',
                  color: mutationData.mergeHasPartialBuilding ? '#c2410c' : '#475569',
                  textAlign: 'left',
                  fontSize: '0.725rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span style={{ fontSize: '1rem' }}>🏠</span>
                <div>
                  <div>Nhà chỉ xây một phần (Có đất dư)</div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 500, color: '#9a3412' }}>
                    Chủ nhà mua thêm đất cạnh nhưng chưa xây kín
                  </div>
                </div>
              </button>
            </div>

            {/* Chi tiết bóc tách khi chọn Xây một phần */}
            {mutationData.mergeHasPartialBuilding && (
              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #fed7aa',
                  borderRadius: '0.5rem',
                  padding: '0.65rem 0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                }}
              >
                <div style={{ fontSize: '0.7rem', color: '#9a3412', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>⚡ Nhấp trên bản đồ để khoanh vùng công trình toà nhà ({mergeBuildingVertices.length} điểm đã chấm):</span>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      type="button"
                      onClick={handleMergeRemoveLastPoint}
                      disabled={mergeBuildingVertices.length === 0}
                      className="btn btn-outline-secondary btn-sm"
                      style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                    >
                      <Undo size={12} />
                      Xóa điểm vừa chấm
                    </button>
                    <button
                      type="button"
                      onClick={handleMergeClearDraw}
                      disabled={mergeBuildingVertices.length === 0}
                      className="btn btn-outline-danger btn-sm"
                      style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                    >
                      <Trash2 size={12} />
                      Xóa làm lại
                    </button>
                  </div>
                </div>

                {/* Bản đồ tương tác chấm điểm khoanh vùng công trình nhà */}
                <div
                  style={{
                    height: '280px',
                    width: '100%',
                    borderRadius: '0.5rem',
                    overflow: 'hidden',
                    border: '1.5px solid #fdba74',
                    position: 'relative',
                  }}
                >
                  <MapContainer
                    center={activeCentroid}
                    zoom={19}
                    maxZoom={22}
                    zoomControl={false}
                    style={{ width: '100%', height: '100%' }}
                    scrollWheelZoom={true}
                  >
                    <MapBoundsController coords={realActiveCoords} zoom={19} />
                    <ZoomControl position="bottomright" />

                    <MapClickListener
                      enabled={true}
                      onMapClick={handleMergeMapClickDraw}
                    />

                    {tileMode === 'satellite' ? (
                      <TileLayer
                        attribution="Esri World Imagery"
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        maxNativeZoom={19}
                        maxZoom={22}
                      />
                    ) : (
                      <TileLayer
                        attribution="&copy; OpenStreetMap contributors &copy; CARTO"
                        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                        subdomains="abcd"
                        maxNativeZoom={19}
                        maxZoom={22}
                      />
                    )}

                    {/* Thửa gốc đang KS */}
                    <Polygon
                      positions={realActiveCoords}
                      pathOptions={{
                        color: '#b45309',
                        fillColor: '#f59e0b',
                        fillOpacity: 0.35,
                        weight: 2,
                        dashArray: '4, 4',
                      }}
                    />

                    {/* Các thửa lân cận đã chọn gộp */}
                    {tenClosestParcels
                      .filter((p) => selectedMergeCodes.includes(p.projectParcelCode))
                      .map((p) => (
                        <Polygon
                          key={p.id || p.projectParcelCode}
                          positions={p.coordinates}
                          pathOptions={{
                            color: '#047857',
                            fillColor: '#10b981',
                            fillOpacity: 0.35,
                            weight: 2,
                            dashArray: '4, 4',
                          }}
                        />
                      ))}

                    {/* Công trình toà nhà được vẽ (Đa giác hoặc Polyline) */}
                    {mergeBuildingVertices.length >= 3 && (
                      <Polygon
                        positions={mergeBuildingVertices}
                        pathOptions={{
                          color: '#ea580c',
                          fillColor: '#f97316',
                          fillOpacity: 0.7,
                          weight: 3.5,
                        }}
                      >
                        <Tooltip direction="top">
                          <div style={{ fontSize: '0.725rem', fontWeight: 800, color: '#9a3412' }}>
                            Công trình nhà: {mergeSummary.keptCode}-P1 ({calculatedMergeBArea} m²)
                          </div>
                        </Tooltip>
                      </Polygon>
                    )}

                    {mergeBuildingVertices.length > 0 && (
                      <Polyline
                        positions={mergeBuildingVertices}
                        pathOptions={{ color: '#ea580c', weight: 4, dashArray: mergeBuildingVertices.length < 3 ? '4, 4' : undefined }}
                      />
                    )}

                    {mergeBuildingVertices.map((vertex, idx) => (
                      <Marker
                        key={`merge-building-${idx}`}
                        position={vertex}
                        icon={createHandleIcon(idx + 1)}
                      />
                    ))}
                  </MapContainer>

                  {mergeBuildingVertices.length === 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '10px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 800,
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        color: '#c2410c',
                        padding: '0.35rem 0.85rem',
                        borderRadius: '0.5rem',
                        fontSize: '0.725rem',
                        fontWeight: 700,
                        border: '1.5px solid #fdba74',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Crosshair size={13} color="#ea580c" />
                      <span>Nhấp trực tiếp trên bản đồ để chấm các góc công trình toà nhà</span>
                    </div>
                  )}
                </div>

                {/* Mục đích sử dụng phần đất dư */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#334155', marginBottom: '2px' }}>
                    Mục đích sử dụng phần đất dư:
                  </label>
                  <select
                    className="form-control"
                    style={{ fontSize: '0.725rem', backgroundColor: '#fff', border: '1px solid #cbd5e1' }}
                    value={
                      ['Sân vườn / Cây cảnh', 'Sân trước / Sân sau lát gạch', 'Đất trống chưa xây dựng (Để dành)', 'Kho bãi tạm / Gara ô tô ngoài trời', 'Lối đi riêng / Ngõ phụ tiếp giáp'].includes(mutationData.mergeResidualType || '')
                        ? (mutationData.mergeResidualType || 'Sân vườn / Cây cảnh')
                        : 'OTHER'
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'OTHER') {
                        onMutationDataChange({
                          ...mutationData,
                          mergeResidualType: customMergeResidualType ? `Khác: ${customMergeResidualType}` : 'Khác: ',
                          isSubmitted: false,
                        });
                      } else {
                        onMutationDataChange({
                          ...mutationData,
                          mergeResidualType: val,
                          isSubmitted: false,
                        });
                      }
                    }}
                  >
                    <option value="Sân vườn / Cây cảnh">Sân vườn / Cây cảnh (Khoảng lùi sinh thái)</option>
                    <option value="Sân trước / Sân sau lát gạch">Sân trước / Sân sau lát gạch</option>
                    <option value="Đất trống chưa xây dựng (Để dành)">Đất trống chưa xây dựng (Để dành)</option>
                    <option value="Kho bãi tạm / Gara ô tô ngoài trời">Kho bãi tạm / Gara ô tô ngoài trời</option>
                    <option value="Lối đi riêng / Ngõ phụ tiếp giáp">Lối đi riêng / Ngõ phụ tiếp giáp</option>
                    <option value="OTHER">Khác (Nhập mục đích sử dụng thực tế...)</option>
                  </select>

                  {/* Text input cho Khác */}
                  {(mutationData.mergeResidualType === 'Khác' ||
                    mutationData.mergeResidualType?.startsWith('Khác') ||
                    (!['Sân vườn / Cây cảnh', 'Sân trước / Sân sau lát gạch', 'Đất trống chưa xây dựng (Để dành)', 'Kho bãi tạm / Gara ô tô ngoài trời', 'Lối đi riêng / Ngõ phụ tiếp giáp'].includes(mutationData.mergeResidualType || '') && mutationData.mergeResidualType)) && (
                    <div style={{ marginTop: '0.35rem' }}>
                      <input
                        type="text"
                        className="form-control"
                        style={{ fontSize: '0.725rem', border: '1px solid #fdba74' }}
                        placeholder="Nhập mục đích sử dụng phần đất dư..."
                        value={
                          customMergeResidualType ||
                          (mutationData.mergeResidualType?.startsWith('Khác: ')
                            ? mutationData.mergeResidualType.replace('Khác: ', '')
                            : mutationData.customMergeResidualType || '')
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomMergeResidualType(val);
                          onMutationDataChange({
                            ...mutationData,
                            mergeResidualType: val ? `Khác: ${val}` : 'Khác: ',
                            customMergeResidualType: val,
                            isSubmitted: false,
                          });
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* 2 Thẻ phân vùng bóc tách rõ ràng */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem', marginTop: '0.2rem' }}>
                  {/* Mảnh 1: Toà nhà */}
                  <div
                    style={{
                      backgroundColor: '#fff7ed',
                      border: '1.5px solid #fdba74',
                      borderRadius: '0.5rem',
                      padding: '0.5rem 0.65rem',
                      fontSize: '0.7rem',
                    }}
                  >
                    <div style={{ fontWeight: 800, color: '#c2410c', display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span>🏠 1. Mảnh đất ngôi nhà (Khảo sát)</span>
                      <span className="badge" style={{ backgroundColor: '#ea580c', color: '#fff' }}>{mergeSummary.keptCode}-P1</span>
                    </div>
                    <div style={{ color: '#475569', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                      <span>Diện tích xây dựng thực tế:</span>
                      <strong style={{ color: '#0f172a', fontSize: '0.75rem' }}>{calculatedMergeBArea} m²</strong>
                    </div>
                  </div>

                  {/* Mảnh 2: Đất dư */}
                  <div
                    style={{
                      backgroundColor: '#f0fdf4',
                      border: '1.5px solid #86efac',
                      borderRadius: '0.5rem',
                      padding: '0.5rem 0.65rem',
                      fontSize: '0.7rem',
                    }}
                  >
                    <div style={{ fontWeight: 800, color: '#166534', display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span>🌳 2. Mảnh đất dư (Chủ nhà mới)</span>
                      <span className="badge" style={{ backgroundColor: '#16a34a', color: '#fff' }}>
                        {mutationData.mergeResidualParcelCode || `${mergeSummary.keptCode}-P2`}
                      </span>
                    </div>
                    <div style={{ color: '#475569', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                      <span>Diện tích đất dư:</span>
                      <strong style={{ color: '#166534', fontSize: '0.75rem' }}>{calculatedMergeRArea} m²</strong>
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '2px' }}>
                      Loại: <em>{mutationData.mergeResidualType || 'Sân vườn / Cây cảnh'}</em>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Phản hồi trực quan sau khi đề xuất gộp thửa (chỉ hiện khi là đề xuất MERGE gần nhất) */}
          {mutationData.activeProposalType === 'MERGE' && mutationData.isSubmitted && (
            <div
              style={{
                backgroundColor: '#ecfdf5',
                border: '1.5px solid #10b981',
                borderRadius: '0.5rem',
                padding: '0.55rem 0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                color: '#065f46',
                fontSize: '0.725rem',
                fontWeight: 700,
              }}
            >
              <CheckCircle2 size={16} color="#059669" />
              <span>
                ✓ Đã lưu tạm đề xuất gộp {selectedMergeCodes.length + 1} thửa vào hồ sơ thửa ban đầu {parcelData.projectParcelCode} ({mutationData.submittedAt}). Đề xuất được lưu trong hồ sơ thửa ban đầu.
              </span>
            </div>
          )}

          {/* NÚT LƯU ĐỀ XUẤT GỘP THỬA (CÓ HIỆU ỨNG PHẢN HỒI) */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSaveMutationProposal}
              disabled={isSubmittingMutation || selectedMergeCodes.length === 0}
              style={{
                backgroundColor: (mutationData.activeProposalType === 'MERGE' && mutationData.isSubmitted) ? '#16a34a' : '#0284c7',
                borderColor: (mutationData.activeProposalType === 'MERGE' && mutationData.isSubmitted) ? '#16a34a' : '#0284c7',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '0.4rem 0.95rem',
                boxShadow: (mutationData.activeProposalType === 'MERGE' && mutationData.isSubmitted) ? '0 0 0 3px rgba(22, 163, 74, 0.25)' : 'none',
              }}
            >
              {(mutationData.activeProposalType === 'MERGE' && mutationData.isSubmitted) ? <CheckCircle2 size={15} /> : <CheckCircle size={14} />}
              <span>
                {isSubmittingMutation
                  ? 'Đang lưu...'
                  : (mutationData.activeProposalType === 'MERGE' && mutationData.isSubmitted)
                  ? `ĐÃ GHI NHẬN ĐỀ XUẤT GỘP ${selectedMergeCodes.length + 1} THỬA (${mutationData.submittedAt})`
                  : `Lưu đề xuất Gộp ${selectedMergeCodes.length + 1} thửa`}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
