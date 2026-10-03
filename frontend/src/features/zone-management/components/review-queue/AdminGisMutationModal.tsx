import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, Tooltip, ZoomControl } from 'react-leaflet';
import {
  X,
  Split,
  GitCompare,
  Scissors,
  CheckCircle2,
  Building,
  Home,
  Trash2,
  Search,
  Loader2,
  Undo,
  Crosshair,
  Layers,
  Tag,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../../../../services/api';
import { AdminSecurityChallengeConfirm } from './AdminSecurityChallengeConfirm';
import { MapBoundsController } from '../../../../components/gis/shared/MapControllers';
import {
  computeCentroid,
  splitQuadHorizontal,
  splitQuadVertical,
  computePolygonAreaM2,
} from '../../../../components/gis/shared/geoMath';
import { MaxZoneCodeInfo } from '../../../../components/gis/shared/types';

interface Props {
  isOpen: boolean;
  parcelId: string;
  parcelCode: string;
  houseNumber?: string;
  street?: string;
  currentAreaM2?: number;
  zoneId?: string;
  reportId?: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

interface ChildParcelInput {
  houseNumber: string;
  ownerName: string;
  ownerPhone: string;
  landAreaM2: number;
  floorCount: number;
}

interface AdjacentCandidate {
  id: string;
  project_parcel_code: string;
  official_cadastral_code: string;
  house_number: string;
  street: string;
  owner_name: string;
  land_area_m2: number;
  floor_count: number;
  survey_status: string;
  distance_meters: number;
  cadastral_geojson?: any;
}

// Convert GeoJSON polygon to Leaflet [lat, lng][]
function geoJsonToLeafletCoords(geojson: any): [number, number][] {
  if (!geojson) return [];
  let ring: any[] = [];
  if (geojson.type === 'Polygon' && Array.isArray(geojson.coordinates) && geojson.coordinates[0]) {
    ring = geojson.coordinates[0];
  } else if (geojson.type === 'MultiPolygon' && Array.isArray(geojson.coordinates) && geojson.coordinates[0]?.[0]) {
    ring = geojson.coordinates[0][0];
  }
  if (!ring || ring.length < 3) return [];
  return ring
    .filter((pt) => Array.isArray(pt) && pt.length >= 2)
    .map(([lng, lat]) => [Number(lat), Number(lng)] as [number, number]);
}

// Convert Leaflet [lat, lng][] to GeoJSON Polygon
function leafletToGeoJsonPolygon(coords: [number, number][]) {
  if (!coords || coords.length < 3) return null;
  const ring = coords.map(([lat, lng]) => [lng, lat]);
  if (
    ring[0][0] !== ring[ring.length - 1][0] ||
    ring[0][1] !== ring[ring.length - 1][1]
  ) {
    ring.push([ring[0][0], ring[0][1]]);
  }
  return {
    type: 'Polygon',
    coordinates: [ring],
  };
}

export const AdminGisMutationModal: React.FC<Props> = ({
  isOpen,
  parcelId,
  parcelCode,
  houseNumber = '',
  street = '',
  currentAreaM2 = 0,
  zoneId: initialZoneId,
  reportId,
  onClose,
  onSuccess,
}) => {
  const [mutationType, setMutationType] = useState<'SPLIT' | 'MERGE'>('SPLIT');
  const [tileMode, setTileMode] = useState<'osm' | 'satellite'>('osm');
  const [adminNotes, setAdminNotes] = useState('');
  const [transferReportToChild1, setTransferReportToChild1] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isChallengeValid, setIsChallengeValid] = useState(false);

  // Dữ liệu hình học của thửa gốc và các thửa lân cận
  const [activeZoneId, setActiveZoneId] = useState<string>(initialZoneId || 'ZONE_01');
  const [realActiveCoords, setRealActiveCoords] = useState<[number, number][]>([]);
  const [adjacentCandidates, setAdjacentCandidates] = useState<AdjacentCandidate[]>([]);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [mapViewMode, setMapViewMode] = useState<'CLUSTER' | 'ALL_ZONE'>('CLUSTER');

  // Max Zone + 1 Code Info
  const [maxZoneInfo, setMaxZoneInfo] = useState<MaxZoneCodeInfo | null>(null);

  // Tọa độ 2 đa giác Lô A và Lô B khi Tách Thửa
  const [polyAVertices, setPolyAVertices] = useState<[number, number][]>([]);
  const [polyBVertices, setPolyBVertices] = useState<[number, number][]>([]);

  // 2 thửa con cho SPLIT
  const [childParcels, setChildParcels] = useState<ChildParcelInput[]>([
    {
      houseNumber: houseNumber ? `${houseNumber}A` : 'Căn A',
      ownerName: '',
      ownerPhone: '',
      landAreaM2: currentAreaM2 > 0 ? Math.round((currentAreaM2 / 2) * 10) / 10 : 50,
      floorCount: 1,
    },
    {
      houseNumber: houseNumber ? `${houseNumber}B` : 'Căn B',
      ownerName: '',
      ownerPhone: '',
      landAreaM2: currentAreaM2 > 0 ? Math.round((currentAreaM2 / 2) * 10) / 10 : 50,
      floorCount: 1,
    },
  ]);

  // Tải dữ liệu không gian PostGIS khi mở Modal
  useEffect(() => {
    if (!isOpen || !parcelId) return;

    let isMounted = true;
    const fetchData = async () => {
      setIsLoadingData(true);
      setErrorMsg('');
      try {
        const res = await api.get(`/admin/parcels/${parcelId}/adjacent-candidates`);
        if (isMounted && res.data?.success && res.data.data) {
          const { currentParcel, candidates } = res.data.data;

          if (currentParcel?.zoneId) {
            setActiveZoneId(currentParcel.zoneId);
          }

          // Lấy toạ độ thửa gốc
          let parsedCoords = geoJsonToLeafletCoords(currentParcel?.cadastralGeojson);
          if (parsedCoords.length < 3) {
            // Tọa độ giả định nếu thửa chưa có vector polygon
            const baseLat = 10.798123;
            const baseLng = 106.645678;
            const dLat = 0.00018;
            const dLng = 0.00022;
            parsedCoords = [
              [baseLat, baseLng],
              [baseLat + dLat, baseLng],
              [baseLat + dLat, baseLng + dLng],
              [baseLat, baseLng + dLng],
            ];
          }
          setRealActiveCoords(parsedCoords);

          // Khởi tạo Lô A & Lô B cắt ngang 60/40 mặc định
          const splitted = splitQuadHorizontal(parsedCoords, 0.6);
          setPolyAVertices(splitted.polyA);
          setPolyBVertices(splitted.polyB);

          // Cập nhật candidates
          if (Array.isArray(candidates)) {
            setAdjacentCandidates(candidates);
          }
        }
      } catch (err: any) {
        console.error('[AdminGisMutationModal] Error fetching adjacent candidates:', err);
      } finally {
        if (isMounted) setIsLoadingData(false);
      }
    };

    fetchData();
    return () => {
      isMounted = false;
    };
  }, [isOpen, parcelId]);

  // Tải mã Max Zone + 1 cho Lô B
  useEffect(() => {
    if (!isOpen || !activeZoneId) return;

    let isMounted = true;
    const fetchMaxCode = async () => {
      try {
        const res = await api.get('/parcels/next-high-range-codes', {
          params: { zoneId: activeZoneId },
        });
        if (isMounted && res.data?.success && res.data.data) {
          setMaxZoneInfo(res.data.data);
        }
      } catch (err) {
        console.warn('[AdminGisMutationModal] Could not fetch next-high-range-codes:', err);
      }
    };

    fetchMaxCode();
    return () => {
      isMounted = false;
    };
  }, [isOpen, activeZoneId]);

  // Tâm của thửa đất đang khảo sát
  const activeCentroid = useMemo(() => {
    return computeCentroid(realActiveCoords);
  }, [realActiveCoords]);

  // Mã định danh cấp mới cho Lô B (Max Zone + 1)
  const officialCodeB = useMemo(() => {
    return maxZoneInfo?.nextCode || `${parcelCode}-B`;
  }, [maxZoneInfo, parcelCode]);

  // Tính diện tích tự động cho Lô A & Lô B
  const areaA = useMemo(() => {
    return computePolygonAreaM2(polyAVertices);
  }, [polyAVertices]);

  const areaB = useMemo(() => {
    return computePolygonAreaM2(polyBVertices);
  }, [polyBVertices]);

  // Đồng bộ diện tích tính toán vào form khi hình học thay đổi
  useEffect(() => {
    if (areaA > 0 && areaB > 0) {
      setChildParcels((prev) => [
        { ...prev[0], landAreaM2: areaA },
        { ...prev[1], landAreaM2: areaB },
      ]);
    }
  }, [areaA, areaB]);

  // Các thao tác cắt nhanh phân ranh
  const handleSplitHorizontal = (ratio = 0.6) => {
    if (realActiveCoords.length < 3) return;
    const splitted = splitQuadHorizontal(realActiveCoords, ratio);
    setPolyAVertices(splitted.polyA);
    setPolyBVertices(splitted.polyB);
  };

  const handleSplitVertical = (ratio = 0.5) => {
    if (realActiveCoords.length < 3) return;
    const splitted = splitQuadVertical(realActiveCoords, ratio);
    setPolyAVertices(splitted.polyA);
    setPolyBVertices(splitted.polyB);
  };

  const handleApplyLShape = () => {
    if (realActiveCoords.length < 3) return;
    const [p0, p1, p2, p3] = realActiveCoords;
    const midTop: [number, number] = [p0[0] + (p1[0] - p0[0]) * 0.5, p0[1] + (p1[1] - p0[1]) * 0.5];
    const center: [number, number] = [
      (p0[0] + p1[0] + p2[0] + (p3 ? p3[0] : p2[0])) / 4,
      (p0[1] + p1[1] + p2[1] + (p3 ? p3[1] : p2[1])) / 4,
    ];
    const midRight: [number, number] = [p1[0] + (p2[0] - p1[0]) * 0.5, p1[1] + (p2[1] - p1[1]) * 0.5];

    setPolyBVertices([midTop, p1, midRight, center]);
    setPolyAVertices([p0, midTop, center, midRight, p2, p3 || p2]);
  };

  const handleResetDefault = () => {
    if (realActiveCoords.length < 3) return;
    const splitted = splitQuadHorizontal(realActiveCoords, 0.6);
    setPolyAVertices(splitted.polyA);
    setPolyBVertices(splitted.polyB);
  };

  // Click chọn / bỏ chọn thửa đất để gộp
  const handleToggleCandidate = (id: string) => {
    setSelectedCandidateIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Thửa đất đã chọn gộp
  const selectedAdjacentParcels = useMemo(() => {
    return adjacentCandidates.filter((c) => selectedCandidateIds.includes(c.id));
  }, [adjacentCandidates, selectedCandidateIds]);

  // Danh sách ứng viên lọc theo search
  const filteredCandidates = useMemo(() => {
    if (!filterQuery.trim()) return adjacentCandidates;
    const q = filterQuery.trim().toLowerCase();
    return adjacentCandidates.filter(
      (c) =>
        c.project_parcel_code.toLowerCase().includes(q) ||
        (c.house_number && c.house_number.toLowerCase().includes(q)) ||
        (c.street && c.street.toLowerCase().includes(q)) ||
        (c.owner_name && c.owner_name.toLowerCase().includes(q))
    );
  }, [adjacentCandidates, filterQuery]);

  // Tính tổng diện tích khối gộp
  const totalMergedArea = useMemo(() => {
    const adjacentTotal = selectedAdjacentParcels.reduce(
      (sum, c) => sum + (Number(c.land_area_m2) || 0),
      0
    );
    const baseArea = currentAreaM2 > 0 ? Number(currentAreaM2) : computePolygonAreaM2(realActiveCoords);
    return Math.round((baseArea + adjacentTotal) * 10) / 10;
  }, [currentAreaM2, realActiveCoords, selectedAdjacentParcels]);

  // Mã đại diện giữ lại (ưu tiên mã của thửa đang khảo sát hoặc mã nhỏ nhất)
  const keptCode = useMemo(() => {
    if (selectedAdjacentParcels.length === 0) return parcelCode;
    const allCodes = [parcelCode, ...selectedAdjacentParcels.map((p) => p.project_parcel_code)];
    return allCodes.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))[0];
  }, [parcelCode, selectedAdjacentParcels]);

  // Toạ độ cụm tiếp giáp
  const clusterCoords = useMemo(() => {
    const list: [number, number][] = [...realActiveCoords];
    selectedAdjacentParcels.forEach((p) => {
      const c = geoJsonToLeafletCoords(p.cadastral_geojson);
      if (c.length >= 3) list.push(...c);
    });
    if (selectedAdjacentParcels.length === 0) {
      adjacentCandidates.slice(0, 8).forEach((p) => {
        const c = geoJsonToLeafletCoords(p.cadastral_geojson);
        if (c.length >= 3) list.push(...c);
      });
    }
    return list;
  }, [realActiveCoords, selectedAdjacentParcels, adjacentCandidates]);

  // Toàn bộ toạ độ Zone
  const allZoneCoords = useMemo(() => {
    const list: [number, number][] = [...realActiveCoords];
    adjacentCandidates.forEach((p) => {
      const c = geoJsonToLeafletCoords(p.cadastral_geojson);
      if (c.length >= 3) list.push(...c);
    });
    return list;
  }, [realActiveCoords, adjacentCandidates]);

  const handleChildChange = (index: number, field: keyof ChildParcelInput, val: any) => {
    setChildParcels((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: val } : c))
    );
  };

  // Submit hành động biến động
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminNotes.trim()) {
      setErrorMsg('Vui lòng nhập lý do biến động để lưu vết kiểm toán.');
      return;
    }

    if (mutationType === 'SPLIT') {
      const totalArea = childParcels.reduce((sum, c) => sum + (Number(c.landAreaM2) || 0), 0);
      if (totalArea <= 0) {
        setErrorMsg('Vui lòng nhập diện tích hợp lệ cho các căn tách thửa.');
        return;
      }
    } else if (mutationType === 'MERGE') {
      if (selectedCandidateIds.length === 0) {
        setErrorMsg('Vui lòng chọn ít nhất một thửa đất trên bản đồ để gộp vào thửa hiện tại.');
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const payload =
        mutationType === 'SPLIT'
          ? {
              mutationType: 'SPLIT',
              sourceParcelIds: [parcelId],
              childParcels: [
                {
                  projectParcelCode: parcelCode, // Lô A giữ mã gốc
                  houseNumber: childParcels[0].houseNumber,
                  street: street,
                  ownerName: childParcels[0].ownerName,
                  ownerPhone: childParcels[0].ownerPhone,
                  landAreaM2: Number(childParcels[0].landAreaM2) || areaA,
                  floorCount: Number(childParcels[0].floorCount) || 1,
                  polygonGeoJson: leafletToGeoJsonPolygon(polyAVertices),
                },
                {
                  projectParcelCode: officialCodeB, // Lô B sinh mã Max Zone + 1
                  houseNumber: childParcels[1].houseNumber,
                  street: street,
                  ownerName: childParcels[1].ownerName,
                  ownerPhone: childParcels[1].ownerPhone,
                  landAreaM2: Number(childParcels[1].landAreaM2) || areaB,
                  floorCount: Number(childParcels[1].floorCount) || 1,
                  polygonGeoJson: leafletToGeoJsonPolygon(polyBVertices),
                },
              ],
              adminNotes: adminNotes.trim(),
              transferSurveyReportId: transferReportToChild1 && reportId ? reportId : undefined,
            }
          : {
              mutationType: 'MERGE',
              sourceParcelIds: [parcelId, ...selectedCandidateIds],
              adminNotes: adminNotes.trim(),
              transferSurveyReportId: reportId || undefined,
            };

      const res = await api.post('/admin/parcels/execute-mutation', payload);

      if (res.data?.success) {
        onSuccess(res.data.message || 'Đã thực thi biến động thửa đất thành công!');
        onClose();
      } else {
        setErrorMsg(res.data?.message || 'Không thể thực thi biến động thửa đất.');
      }
    } catch (err: any) {
      console.error('[AdminGisMutationModal] Error:', err);
      setErrorMsg(
        err.response?.data?.message ||
        err.response?.data?.detail ||
        'Lỗi thực thi biến động thửa đất trên CSDL PostGIS.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-100 text-sky-800">
              <Split className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-800">
                  Tách / Gộp Thửa Đất GIS (Zone Admin Studio)
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-sky-100 text-sky-800 border border-sky-200">
                  Phân khu: {activeZoneId}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Biên tập trực quan không gian PostGIS & Thực thi phê duyệt hồ sơ hiện trường
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thửa Nguồn Card & Chuyển Tab */}
        <div className="px-5 pt-3 pb-2 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-slate-600">Thửa đất gốc:</span>
            <span className="font-mono font-black text-sky-900 bg-sky-100 px-2 py-0.5 rounded border border-sky-300">
              {parcelCode}
            </span>
            <span className="text-slate-600">
              {houseNumber ? `Số ${houseNumber}` : ''} {street}
            </span>
            <span className="text-slate-400">•</span>
            <span className="font-semibold text-slate-700">
              Hiện trạng: {currentAreaM2 > 0 ? `${currentAreaM2} m²` : `${computePolygonAreaM2(realActiveCoords)} m²`}
            </span>
          </div>

          {/* Toggle Tab */}
          <div className="flex rounded-lg p-0.5 bg-slate-200/90 border border-slate-300">
            <button
              type="button"
              onClick={() => setMutationType('SPLIT')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                mutationType === 'SPLIT'
                  ? 'bg-white text-orange-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Scissors className="w-3.5 h-3.5 text-orange-600" />
              <span>1. Tách Thửa Trực Quan (Lô A & Lô B)</span>
            </button>
            <button
              type="button"
              onClick={() => setMutationType('MERGE')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                mutationType === 'MERGE'
                  ? 'bg-white text-sky-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5 text-sky-700" />
              <span>2. Gộp Thửa Bản Đồ Không Gian (Click-to-Merge)</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <span className="font-bold">Lỗi:</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 1: TÁCH THỬA TRỰC QUAN (INTERACTIVE SPLIT PANEL)                     */}
          {/* ========================================================================= */}
          {mutationType === 'SPLIT' && (
            <div className="space-y-3">
              {/* Banner Max Zone + 1 */}
              <div className="p-3 rounded-xl bg-orange-50 border border-orange-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-lg bg-orange-500 text-white">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-orange-700 uppercase tracking-wide">
                      MÃ SỐ HIỆU CẤP MỚI CHO THỬA CON (LÔ B):
                    </span>
                    <span className="ml-2 font-mono font-black text-sm text-orange-950 bg-white px-2 py-0.5 rounded border border-orange-300 shadow-xs">
                      {officialCodeB}
                    </span>
                  </div>
                </div>
                <div className="text-[11px] text-orange-800 font-semibold bg-orange-100/70 px-2.5 py-1 rounded-md">
                  Cơ chế: <strong>MAX ZONE + 1</strong> • Mã lớn nhất hiện tại của Zone:{' '}
                  <strong>{maxZoneInfo?.currentMaxCode || 'Đang quét...'}</strong>
                </div>
              </div>

              {/* Toolbar phân chia ranh nhanh */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-50/80 border border-amber-200">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-bold text-amber-900 flex items-center gap-1 mr-1">
                    <Scissors className="w-3.5 h-3.5 text-amber-700" />
                    Chia ranh nhanh:
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSplitHorizontal(0.6)}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white text-amber-900 border border-amber-300 hover:bg-amber-100 transition-colors cursor-pointer"
                    title="Mặt tiền chiếm 60%, phía sau chiếm 40%"
                  >
                    ✂️ Cắt ngang 60/40 (Trước/Sau)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSplitHorizontal(0.5)}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white text-amber-900 border border-amber-300 hover:bg-amber-100 transition-colors cursor-pointer"
                  >
                    ✂️ Cắt ngang 50/50
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSplitVertical(0.5)}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white text-amber-900 border border-amber-300 hover:bg-amber-100 transition-colors cursor-pointer"
                  >
                    ✂️ Cắt dọc 50/50
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyLShape}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white text-amber-900 border border-amber-300 hover:bg-amber-100 transition-colors cursor-pointer"
                  >
                    📐 Mẫu chữ L
                  </button>
                  <button
                    type="button"
                    onClick={handleResetDefault}
                    className="px-2 py-1 text-xs font-bold rounded-lg bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Undo className="w-3 h-3" />
                    Đặt lại
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setTileMode((prev) => (prev === 'osm' ? 'satellite' : 'osm'))}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Layers className="w-3.5 h-3.5 text-slate-600" />
                  <span>{tileMode === 'osm' ? '🛰️ Vệ tinh' : '🗺️ Bản đồ'}</span>
                </button>
              </div>

              {/* Bản đồ GIS trực quan phân ranh Lô A & Lô B */}
              <div className="w-full h-[370px] rounded-xl overflow-hidden border-2 border-orange-300 relative shadow-inner">
                {isLoadingData ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-500 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
                    <span className="text-xs font-bold">Đang tải ranh đất PostGIS...</span>
                  </div>
                ) : (
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

                    {tileMode === 'satellite' ? (
                      <TileLayer
                        key="satellite"
                        attribution="Tiles &copy; Esri World Imagery"
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        maxNativeZoom={19}
                        maxZoom={22}
                      />
                    ) : (
                      <TileLayer
                        key="osm"
                        attribution="&copy; OpenStreetMap contributors &copy; CARTO"
                        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                        subdomains="abcd"
                        maxNativeZoom={19}
                        maxZoom={22}
                      />
                    )}

                    {/* Ranh đất gốc pháp lý (Viền nét đứt) */}
                    <Polygon
                      positions={realActiveCoords}
                      pathOptions={{
                        color: '#b45309',
                        weight: 2,
                        dashArray: '5, 5',
                        fill: false,
                      }}
                    />

                    {/* LÔ A (ĐANG KS) - MÀU VÀNG HỔ PHÁCH */}
                    {polyAVertices.length >= 3 && (
                      <Polygon
                        positions={polyAVertices}
                        pathOptions={{
                          color: '#b45309',
                          fillColor: '#f59e0b',
                          fillOpacity: 0.78,
                          weight: 3.5,
                        }}
                      >
                        <Tooltip permanent direction="center">
                          <div className="text-center font-black text-amber-950 text-xs leading-tight">
                            ⭐ LÔ A (ĐANG KS)<br />
                            <span className="text-amber-800">{parcelCode}</span><br />
                            ({areaA} m²)
                          </div>
                        </Tooltip>
                      </Polygon>
                    )}

                    {/* LÔ B (TÁCH MỚI) - MÀU CAM RỰC */}
                    {polyBVertices.length >= 3 && (
                      <Polygon
                        positions={polyBVertices}
                        pathOptions={{
                          color: '#c2410c',
                          fillColor: '#ea580c',
                          fillOpacity: 0.78,
                          weight: 3.5,
                        }}
                      >
                        <Tooltip permanent direction="center">
                          <div className="text-center font-black text-orange-950 text-xs leading-tight">
                            ⚡ LÔ B (TÁCH MỚI)<br />
                            <span className="text-orange-800">{officialCodeB}</span><br />
                            ({areaB} m²)
                          </div>
                        </Tooltip>
                      </Polygon>
                    )}
                  </MapContainer>
                )}

                {/* Chú giải góc trên bản đồ */}
                <div className="absolute top-2 left-2 z-[800] bg-white/95 px-3 py-1.5 rounded-lg border border-slate-300 text-[11px] shadow-sm flex items-center gap-3">
                  <span className="flex items-center gap-1.5 font-bold text-amber-900">
                    <span className="inline-block w-3 h-3 bg-amber-500 border border-amber-700 rounded-xs" />
                    Lô A (Giữ mã {parcelCode})
                  </span>
                  <span className="flex items-center gap-1.5 font-bold text-orange-900">
                    <span className="inline-block w-3 h-3 bg-orange-600 border border-orange-800 rounded-xs" />
                    Lô B (Cấp mới {officialCodeB})
                  </span>
                </div>
              </div>

              {/* Thông tin chi tiết 2 căn phát sinh */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {/* Căn A */}
                <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50/50 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                    <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                      <Home className="w-4 h-4 text-amber-700" />
                      Căn A: {parcelCode} (Thửa gốc)
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-800 bg-amber-200/70 px-2 py-0.5 rounded">
                      {childParcels[0].landAreaM2} m²
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Số nhà con:</label>
                      <input
                        type="text"
                        value={childParcels[0].houseNumber}
                        onChange={(e) => handleChildChange(0, 'houseNumber', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-xs outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Số tầng:</label>
                      <input
                        type="number"
                        min="1"
                        value={childParcels[0].floorCount}
                        onChange={(e) => handleChildChange(0, 'floorCount', Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-xs outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Chủ hộ Căn A:</label>
                    <input
                      type="text"
                      placeholder="Họ tên chủ nhà hiện tại..."
                      value={childParcels[0].ownerName}
                      onChange={(e) => handleChildChange(0, 'ownerName', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs outline-none"
                    />
                  </div>
                  <label className="flex items-center gap-2 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={transferReportToChild1}
                      onChange={(e) => setTransferReportToChild1(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-0 cursor-pointer"
                    />
                    <span className="text-xs text-amber-900 font-bold">
                      Tự động bảo toàn hồ sơ & watermark ảnh trên Căn A
                    </span>
                  </label>
                </div>

                {/* Căn B */}
                <div className="p-3.5 rounded-xl border border-orange-300 bg-orange-50/50 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-orange-200 pb-2">
                    <span className="text-xs font-black text-orange-950 flex items-center gap-1.5">
                      <Building className="w-4 h-4 text-orange-600" />
                      Căn B: {officialCodeB} (Cấp mới)
                    </span>
                    <span className="text-xs font-mono font-bold text-orange-900 bg-orange-200/70 px-2 py-0.5 rounded">
                      {childParcels[1].landAreaM2} m²
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Số nhà con:</label>
                      <input
                        type="text"
                        value={childParcels[1].houseNumber}
                        onChange={(e) => handleChildChange(1, 'houseNumber', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-xs outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Số tầng:</label>
                      <input
                        type="number"
                        min="1"
                        value={childParcels[1].floorCount}
                        onChange={(e) => handleChildChange(1, 'floorCount', Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-xs outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Chủ hộ Căn B (Tách mới):</label>
                    <input
                      type="text"
                      placeholder="Họ tên chủ nhà mới..."
                      value={childParcels[1].ownerName}
                      onChange={(e) => handleChildChange(1, 'ownerName', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs outline-none"
                    />
                  </div>
                  <div className="text-[11px] text-orange-800 bg-white/80 p-2 rounded-lg border border-orange-200 leading-relaxed">
                    ℹ️ Căn B được cấp mã mới <strong>{officialCodeB}</strong> ở trạng thái{' '}
                    <span className="font-bold text-slate-700">CHƯA KHẢO SÁT (NOT_SURVEYED)</span> để KSV lập hồ sơ riêng biệt.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: GỘP THỬA BẢN ĐỒ KHÔNG GIAN (CLICK-TO-MERGE GIS PANEL)             */}
          {/* ========================================================================= */}
          {mutationType === 'MERGE' && (
            <div className="space-y-3">
              {/* Toolbar điều hướng & tìm kiếm */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-sky-50 border border-sky-200">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-sky-900">Chế độ quan sát:</span>
                  <button
                    type="button"
                    onClick={() => setMapViewMode('CLUSTER')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      mapViewMode === 'CLUSTER'
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    🎯 Zoom Cụm Tiếp Giáp
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapViewMode('ALL_ZONE')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      mapViewMode === 'ALL_ZONE'
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    🗺️ Xem Toàn Bộ Zone ({adjacentCandidates.length + 1} thửa)
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm số nhà, đường, mã..."
                      value={filterQuery}
                      onChange={(e) => setFilterQuery(e.target.value)}
                      className="pl-8 pr-3 py-1 text-xs rounded-lg border border-sky-300 bg-white outline-none w-48 text-slate-800"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setTileMode((prev) => (prev === 'osm' ? 'satellite' : 'osm'))}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Layers className="w-3.5 h-3.5 text-slate-600" />
                    <span>{tileMode === 'osm' ? '🛰️ Vệ tinh' : '🗺️ Bản đồ'}</span>
                  </button>
                </div>
              </div>

              {/* Bản đồ GIS rộng rãi 410px hỗ trợ Click-to-Merge */}
              <div className="w-full h-[400px] rounded-xl overflow-hidden border-2 border-sky-400 relative shadow-inner">
                {isLoadingData ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-500 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-sky-600" />
                    <span className="text-xs font-bold">Đang tải bản đồ không gian phân khu...</span>
                  </div>
                ) : (
                  <MapContainer
                    center={activeCentroid}
                    zoom={18}
                    maxZoom={22}
                    zoomControl={false}
                    style={{ width: '100%', height: '100%' }}
                    scrollWheelZoom={true}
                  >
                    <MapBoundsController
                      coords={mapViewMode === 'ALL_ZONE' ? allZoneCoords : clusterCoords}
                      zoom={18}
                    />
                    <ZoomControl position="bottomright" />

                    {tileMode === 'satellite' ? (
                      <TileLayer
                        key="satellite"
                        attribution="Tiles &copy; Esri World Imagery"
                        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        maxNativeZoom={19}
                        maxZoom={22}
                      />
                    ) : (
                      <TileLayer
                        key="osm"
                        attribution="&copy; OpenStreetMap contributors &copy; CARTO"
                        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                        subdomains="abcd"
                        maxNativeZoom={19}
                        maxZoom={22}
                      />
                    )}

                    {/* 1. THỬA GỐC ĐANG KHẢO SÁT */}
                    {realActiveCoords.length >= 3 && (
                      <Polygon
                        positions={realActiveCoords}
                        pathOptions={{
                          color: '#b45309',
                          fillColor: '#f59e0b',
                          fillOpacity: 0.8,
                          weight: 4.5,
                        }}
                      >
                        <Tooltip permanent direction="center">
                          <div className="text-center font-black text-amber-950 text-xs leading-tight">
                            ⭐ THỬA GỐC ĐANG KS<br />
                            <span className="text-amber-800">{parcelCode}</span><br />
                            ({currentAreaM2 > 0 ? currentAreaM2 : computePolygonAreaM2(realActiveCoords)} m²)
                          </div>
                        </Tooltip>
                      </Polygon>
                    )}

                    {/* 2. CÁC THỬA TRONG ZONE (CLICK TRỰC TIẾP ĐỂ GỘP) */}
                    {filteredCandidates.map((cand) => {
                      const coords = geoJsonToLeafletCoords(cand.cadastral_geojson);
                      if (coords.length < 3) return null;

                      const isSelected = selectedCandidateIds.includes(cand.id);
                      const isMatchQuery = filterQuery
                        ? cand.project_parcel_code.toLowerCase().includes(filterQuery.toLowerCase()) ||
                          cand.house_number?.toLowerCase().includes(filterQuery.toLowerCase()) ||
                          cand.street?.toLowerCase().includes(filterQuery.toLowerCase())
                        : false;

                      return (
                        <Polygon
                          key={cand.id}
                          positions={coords}
                          pathOptions={{
                            color: isSelected ? '#047857' : isMatchQuery ? '#ea580c' : '#0284c7',
                            fillColor: isSelected ? '#10b981' : isMatchQuery ? '#fed7aa' : '#38bdf8',
                            fillOpacity: isSelected ? 0.82 : isMatchQuery ? 0.65 : 0.32,
                            weight: isSelected ? 4 : isMatchQuery ? 3.5 : 2,
                            dashArray: isSelected ? undefined : '4, 4',
                          }}
                          eventHandlers={{
                            click: () => handleToggleCandidate(cand.id),
                          }}
                        >
                          <Tooltip permanent={isSelected || isMatchQuery} direction="center" opacity={0.95}>
                            <div className="text-center text-xs font-bold leading-tight">
                              {isSelected ? (
                                <span className="text-emerald-950">
                                  ✓ ĐÃ GỘP: <strong>{cand.project_parcel_code}</strong> ({cand.land_area_m2} m²)<br />
                                  <span className="text-[10px] text-emerald-800 font-semibold">(Bấm để hủy gộp)</span>
                                </span>
                              ) : (
                                <span className="text-sky-950">
                                  {cand.project_parcel_code}<br />
                                  <span className="text-[10px] text-slate-600 font-normal">
                                    Số {cand.house_number} {cand.street} • {cand.distance_meters}m
                                  </span><br />
                                  <span className="text-[10px] text-blue-700 font-bold">(👉 Bấm để gộp)</span>
                                </span>
                              )}
                            </div>
                          </Tooltip>
                        </Polygon>
                      );
                    })}
                  </MapContainer>
                )}

                {/* Chú giải trực quan */}
                <div className="absolute top-2 left-2 z-[800] bg-white/95 px-3 py-1.5 rounded-lg border border-slate-300 text-[11px] shadow-sm flex items-center gap-3">
                  <span className="flex items-center gap-1.5 font-bold text-amber-900">
                    <span className="inline-block w-3 h-3 bg-amber-500 border border-amber-700 rounded-xs" />
                    Thửa gốc đang KS ({parcelCode})
                  </span>
                  <span className="flex items-center gap-1.5 font-bold text-emerald-900">
                    <span className="inline-block w-3 h-3 bg-emerald-500 border border-emerald-700 rounded-xs" />
                    Đã chọn gộp ({selectedCandidateIds.length})
                  </span>
                  <span className="flex items-center gap-1.5 font-semibold text-sky-900">
                    <span className="inline-block w-3 h-3 bg-sky-200 border border-sky-500 rounded-xs border-dashed" />
                    Thửa trong Zone (👉 Click để gộp)
                  </span>
                </div>
              </div>

              {/* BẢNG TÓM TẮT KHỐI GỘP HỢP NHẤT */}
              <div className="p-3.5 rounded-xl border border-sky-300 bg-sky-50/70 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-200 pb-2">
                  <div className="flex items-center gap-2">
                    <GitCompare className="w-4 h-4 text-sky-700" />
                    <span className="text-xs font-black text-slate-800">
                      Khối Thửa Đất Hợp Nhất ({selectedCandidateIds.length + 1} thửa tham gia gộp):
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600">Tổng diện tích sau gộp:</span>
                    <span className="text-sm font-black font-mono text-emerald-700 bg-white px-2.5 py-0.5 rounded border border-emerald-300 shadow-xs">
                      {totalMergedArea} m²
                    </span>
                  </div>
                </div>

                {/* Danh sách chip các thửa đã chọn */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {/* Thửa gốc */}
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    ⭐ GỐC: {parcelCode} ({currentAreaM2 > 0 ? currentAreaM2 : computePolygonAreaM2(realActiveCoords)} m²)
                  </span>

                  {/* Các thửa chọn gộp */}
                  {selectedAdjacentParcels.map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300"
                    >
                      <span>✓ {p.project_parcel_code} ({p.land_area_m2} m²)</span>
                      <button
                        type="button"
                        onClick={() => handleToggleCandidate(p.id)}
                        className="text-emerald-700 hover:text-emerald-950 font-black cursor-pointer ml-1"
                        title="Hủy gộp thửa này"
                      >
                        ✕
                      </button>
                    </span>
                  ))}

                  {selectedCandidateIds.length === 0 && (
                    <span className="text-xs text-slate-400 italic">
                      Chưa chọn thửa nào. Hãy nhấp chuột vào các thửa đất màu xanh trên bản đồ để chọn gộp.
                    </span>
                  )}
                </div>

                {selectedCandidateIds.length > 0 && (
                  <div className="pt-2 text-[11px] text-slate-600 flex flex-wrap items-center justify-between border-t border-sky-200/80">
                    <span>
                      Mã đại diện duy trì pháp lý: <strong className="text-sky-900">{keptCode}</strong>
                    </span>
                    <span className="text-amber-800">
                      Mã thu hồi ({selectedCandidateIds.length}):{' '}
                      <strong>
                        {selectedAdjacentParcels
                          .map((p) => p.project_parcel_code)
                          .filter((c) => c !== keptCode)
                          .join(', ') || parcelCode}
                      </strong>{' '}
                      (Chuyển trạng thái <code>MERGED_DEPRECATED</code>)
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Ghi chú lý do biến động */}
          <div>
            <label className="block text-xs font-black text-slate-700 mb-1">
              Ghi Chú Kỹ Thuật Biến Động (Audit Log - Bắt buộc):
            </label>
            <textarea
              required
              rows={2}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder={
                mutationType === 'SPLIT'
                  ? 'Ví dụ: Hiện trường thực tế là nhà chia 2 căn A và B riêng biệt có 2 lối đi và đồng hồ điện nước riêng. Thực hiện tách thửa GIS và cấp mã tự động.'
                  : 'Ví dụ: Hai thửa đất thực tế chung 1 khuôn viên nhà ở không có ranh giới ngăn cách. Gộp thành 1 thửa thống nhất.'
              }
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none text-slate-800"
            />
          </div>

          {/* Xác thực bảo mật 6 số ngẫu nhiên */}
          <AdminSecurityChallengeConfirm
            actionDescription={
              mutationType === 'SPLIT'
                ? `tách thửa [${parcelCode}] thành 2 thửa con độc lập (Căn A: ${parcelCode}, Căn B: ${officialCodeB})`
                : `gộp thửa [${parcelCode}] với ${selectedCandidateIds.length} thửa đất lân cận`
            }
            onValidityChange={(valid) => setIsChallengeValid(valid)}
          />

          {/* Nút hành động */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isChallengeValid}
              className={`px-5 py-2.5 text-xs font-black rounded-xl text-white shadow-md transition-all flex items-center gap-2 cursor-pointer ${
                isChallengeValid && !isSubmitting
                  ? mutationType === 'SPLIT'
                    ? 'bg-orange-600 hover:bg-orange-700 active:scale-95'
                    : 'bg-sky-600 hover:bg-sky-700 active:scale-95'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang xử lý PostGIS...</span>
                </>
              ) : mutationType === 'SPLIT' ? (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Xác Nhận & Cấp Mã Thửa GIS Mới ({officialCodeB})</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Xác Nhận Gộp {selectedCandidateIds.length + 1} Thửa Đất</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
