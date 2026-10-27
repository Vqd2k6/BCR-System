import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Polygon, Tooltip, ZoomControl } from 'react-leaflet';
import {
  X,
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle2,
  Building,
  Search,
  Loader2,
  MapPin,
  Sparkles,
  Layers,
  ShieldCheck,
  Check,
  RotateCcw,
} from 'lucide-react';
import type { GisParcel } from '../../shared/types';
import { useAuth } from '../../../../context/AuthContext';
import { api } from '../../../../services/api';
import { getErrorMessage } from '@/utils/errorUtils';
import { MapBoundsController } from '../../shared/MapControllers';
import { computeCentroid } from '../../shared/geoMath';
import { AdminSecurityChallengeConfirm } from '../../../../features/zone-management/components/review-queue/AdminSecurityChallengeConfirm';

interface CandidateParcel {
  id: string;
  zone_id?: string;
  zoneId?: string;
  isOutOfZone?: boolean;
  project_parcel_code?: string;
  projectParcelCode?: string;
  official_cadastral_code?: string;
  officialCadastralCode?: string;
  house_number?: string;
  houseNumber?: string;
  street?: string;
  owner_name?: string;
  ownerName?: string;
  land_area_m2?: number;
  landAreaM2?: number;
  landArea?: number;
  is_touching?: boolean;
  isTouching?: boolean;
  distance_meters?: number;
  distanceMeters?: number;
  is_adjacent?: boolean;
  coordinates?: [number, number][];
}

interface CadastralSpatialSwapModalProps {
  activeParcel: GisParcel | null;
  availableParcels?: GisParcel[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CadastralSpatialSwapModal: React.FC<CadastralSpatialSwapModalProps> = ({
  activeParcel,
  availableParcels = [],
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { token } = useAuth();

  // Lớp bản đồ nền
  const [tileMode, setTileMode] = useState<'satellite' | 'osm'>('satellite');

  // Thửa đất B (Thửa đích sẽ hoán đổi)
  const [selectedTargetB, setSelectedTargetB] = useState<CandidateParcel | null>(null);

  // Bộ lọc tìm kiếm
  const [searchTerm, setSearchTerm] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Danh sách ứng viên tiếp giáp từ Backend
  const [adjacentCandidates, setAdjacentCandidates] = useState<CandidateParcel[]>([]);
  const [, setIsLoadingCandidates] = useState(false);

  // Danh sách toàn bộ thửa đất trong Zone có kèm coordinates
  const [zoneParcelsWithGeom, setZoneParcelsWithGeom] = useState<GisParcel[]>(availableParcels);

  // Ứng viên tìm chính xác theo mã ngoài Zone (Cross-Zone Exact Code Lookup)
  const [externalCandidate, setExternalCandidate] = useState<CandidateParcel | null>(null);
  const [isSearchingExternal, setIsSearchingExternal] = useState(false);

  // Form State
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isChallengeValid, setIsChallengeValid] = useState(false);

  const activeZoneId = activeParcel
    ? activeParcel.zoneId || (activeParcel as unknown as { zone_id?: string }).zone_id || ''
    : '';

  // Nạp danh sách ứng viên tiếp giáp & nạp zone map khi modal mở
  useEffect(() => {
    if (isOpen && activeParcel) {
      setSelectedTargetB(null);
      setSearchTerm('');
      setExternalCandidate(null);
      setIsSearchingExternal(false);
      setReason('');
      setErrorMsg('');
      setSuccessMsg('');
      setIsChallengeValid(false);
      setIsInputFocused(false);

      // Fetch adjacent candidates
      setIsLoadingCandidates(true);
      api.get(`/parcels/${activeParcel.id}/adjacent-candidates`)
        .then((res) => {
          if (res.data?.success && res.data?.data?.candidates) {
            setAdjacentCandidates(res.data.data.candidates);
          }
        })
        .catch((err: unknown) => {
          console.warn('[CadastralSpatialSwapModal] Lỗi lấy danh sách thửa tiếp giáp:', err);
        })
        .finally(() => {
          setIsLoadingCandidates(false);
        });

      // Nạp danh sách thửa đất trong Zone kèm tọa độ đầy đủ
      const targetZone = activeParcel.zoneId || (activeParcel as unknown as { zone_id?: string }).zone_id;
      if (targetZone) {
        api.get('/parcels/zone-map', { params: { zoneId: targetZone } })
          .then((res) => {
            if (res.data?.success && Array.isArray(res.data.data)) {
              const parsed: GisParcel[] = res.data.data.map((raw: Record<string, unknown>) => {
                let coords: [number, number][] = [];
                const geojson = raw.cadastral_geojson as { coordinates?: [number, number][][] } | undefined;
                if (geojson?.coordinates?.[0]) {
                  coords = geojson.coordinates[0].map(([lng, lat]: [number, number]) => [lat, lng]);
                } else if (raw.coordinates && Array.isArray(raw.coordinates)) {
                  coords = raw.coordinates as [number, number][];
                }
                return {
                  id: String(raw.id || ''),
                  projectParcelCode: String(raw.project_parcel_code || raw.projectParcelCode || ''),
                  officialCadastralCode: String(raw.official_cadastral_code || raw.officialCadastralCode || ''),
                  houseNumber: String(raw.house_number || raw.houseNumber || ''),
                  street: String(raw.street || ''),
                  ownerName: String(raw.owner_name || raw.ownerName || ''),
                  coordinates: coords,
                  landArea: Number(raw.land_area_m2 || raw.landArea || 0),
                  zoneId: String(raw.zone_id || targetZone),
                };
              });
              setZoneParcelsWithGeom(parsed);
            }
          })
          .catch((err) => {
            console.warn('[CadastralSpatialSwapModal] Lỗi nạp zone map:', err);
          });
      }
    }
  }, [isOpen, activeParcel, token]);

  // Chuẩn hóa chuỗi tiếng Việt tìm kiếm
  const stripVietnameseTones = (str: string): string => {
    return (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .trim();
  };

  // Tổng hợp pool ứng viên Thửa B
  const candidatePool = useMemo(() => {
    if (!activeParcel) return [];
    const map = new Map<string, CandidateParcel>();

    // 1. Thêm ứng viên tiếp giáp kề bên
    adjacentCandidates.forEach((c) => {
      const code = c.project_parcel_code || c.projectParcelCode || '';
      const officialCode = (c as unknown as { official_cadastral_code?: string; officialCadastralCode?: string }).official_cadastral_code ||
                           (c as unknown as { official_cadastral_code?: string; officialCadastralCode?: string }).officialCadastralCode || '';
      const house = c.house_number || c.houseNumber || '';
      const street = c.street || '';
      const owner = c.owner_name || c.ownerName || '';
      const area = Number(c.land_area_m2 || c.landAreaM2 || c.landArea || 0);
      const touching = Boolean(c.is_touching ?? c.isTouching ?? false);
      const dist = c.distance_meters !== undefined ? Number(c.distance_meters) : (c.distanceMeters !== undefined ? Number(c.distanceMeters) : undefined);

      map.set(c.id, {
        id: c.id,
        project_parcel_code: code,
        projectParcelCode: code,
        official_cadastral_code: officialCode,
        officialCadastralCode: officialCode,
        house_number: house,
        houseNumber: house,
        street,
        owner_name: owner,
        ownerName: owner,
        land_area_m2: area,
        landAreaM2: area,
        landArea: area,
        is_touching: touching,
        isTouching: touching,
        distance_meters: dist,
        distanceMeters: dist,
        is_adjacent: true,
      });
    });

    // 2. Thêm các thửa khác trong Zone
    const targetZone = activeParcel.zoneId || (activeParcel as unknown as { zone_id?: string }).zone_id;
    const sourceParcels = zoneParcelsWithGeom.length > 0 ? zoneParcelsWithGeom : availableParcels;

    sourceParcels.forEach((p) => {
      const pZone = p.zoneId || (p as unknown as { zone_id?: string }).zone_id;
      if (p.id !== activeParcel.id && (!targetZone || !pZone || pZone === targetZone)) {
        const code = p.projectParcelCode || (p as unknown as { project_parcel_code?: string }).project_parcel_code || '';
        const officialCode = p.officialCadastralCode || (p as unknown as { official_cadastral_code?: string }).official_cadastral_code || '';
        const house = p.houseNumber || (p as unknown as { house_number?: string }).house_number || '';
        const street = p.street || '';
        const owner = p.ownerName || (p as unknown as { owner_name?: string }).owner_name || '';
        const area = Number(p.landArea || (p as unknown as { land_area_m2?: number }).land_area_m2 || 0);

        if (map.has(p.id)) {
          const existing = map.get(p.id)!;
          map.set(p.id, {
            ...existing,
            coordinates: p.coordinates || existing.coordinates,
          });
        } else {
          map.set(p.id, {
            id: p.id,
            project_parcel_code: code,
            projectParcelCode: code,
            official_cadastral_code: officialCode,
            officialCadastralCode: officialCode,
            house_number: house,
            houseNumber: house,
            street,
            owner_name: owner,
            ownerName: owner,
            land_area_m2: area,
            landAreaM2: area,
            landArea: area,
            is_touching: false,
            isTouching: false,
            is_adjacent: false,
            coordinates: p.coordinates,
          });
        }
      }
    });

    return Array.from(map.values());
  }, [activeParcel, adjacentCandidates, zoneParcelsWithGeom, availableParcels]);

  // Hàm gọi API lấy chính xác thửa đất theo mã khi không có trong Zone
  const fetchExactParcelByCode = useCallback(
    async (rawInput: string) => {
      if (!activeParcel) return;
      const cleanCode = rawInput.trim().replace(/[\[\]"'\\]/g, '').trim();
      if (cleanCode.length < 2) {
        setExternalCandidate(null);
        return;
      }

      const upperCode = cleanCode.toUpperCase();
      const existsInPool = candidatePool.some(
        (c) =>
          (c.project_parcel_code || c.projectParcelCode || '').trim().toUpperCase() === upperCode ||
          (c.official_cadastral_code || c.officialCadastralCode || '').trim().toUpperCase() === upperCode
      );
      if (existsInPool) {
        setExternalCandidate(null);
        return;
      }

      setIsSearchingExternal(true);
      try {
        const res = await api.get('/parcels/lookup-by-code', {
          params: {
            code: cleanCode,
            excludeParcelId: activeParcel.id,
          },
        });
        const raw = res.data?.data as Record<string, unknown> | null | undefined;
        if (res.data?.success && raw && raw.id) {
          let coords: [number, number][] = [];
          const geojson = raw.cadastral_geojson as { type?: string; coordinates?: unknown } | undefined;
          if (geojson?.type === 'Polygon' && Array.isArray(geojson.coordinates) && Array.isArray(geojson.coordinates[0])) {
            coords = (geojson.coordinates[0] as [number, number][]).map(([lng, lat]) => [Number(lat), Number(lng)]);
          } else if (
            geojson?.type === 'MultiPolygon' &&
            Array.isArray(geojson.coordinates) &&
            Array.isArray(geojson.coordinates[0]) &&
            Array.isArray((geojson.coordinates[0] as unknown[])[0])
          ) {
            coords = ((geojson.coordinates[0] as unknown[])[0] as [number, number][]).map(([lng, lat]) => [
              Number(lat),
              Number(lng),
            ]);
          } else if (Array.isArray(raw.coordinates)) {
            coords = raw.coordinates as [number, number][];
          }

          const foundZone = String(raw.zone_id || raw.zoneId || '');
          const code = String(raw.project_parcel_code || raw.projectParcelCode || '');
          const officialCode = String(raw.official_cadastral_code || raw.officialCadastralCode || '');
          const house = String(raw.house_number || raw.houseNumber || '');
          const street = String(raw.street || '');
          const owner = String(raw.owner_name || raw.ownerName || '');
          const area = Number(raw.land_area_m2 || raw.landArea || 0);

          setExternalCandidate({
            id: String(raw.id),
            zone_id: foundZone,
            zoneId: foundZone,
            isOutOfZone: Boolean(activeZoneId && foundZone && foundZone !== activeZoneId),
            project_parcel_code: code,
            projectParcelCode: code,
            official_cadastral_code: officialCode,
            officialCadastralCode: officialCode,
            house_number: house,
            houseNumber: house,
            street,
            owner_name: owner,
            ownerName: owner,
            land_area_m2: area,
            landAreaM2: area,
            landArea: area,
            is_touching: false,
            isTouching: false,
            is_adjacent: false,
            coordinates: coords,
          });
        } else {
          setExternalCandidate(null);
        }
      } catch (err: unknown) {
        console.error('[CadastralSpatialSwapModal] Lỗi tra cứu mã thửa ngoài Zone:', err);
        setExternalCandidate(null);
      } finally {
        setIsSearchingExternal(false);
      }
    },
    [activeParcel, activeZoneId, candidatePool]
  );

  // Tự động tra cứu ngoài Zone khi người dùng nhập mã không có trong candidatePool
  useEffect(() => {
    if (!isOpen || !activeParcel) return;
    const cleanCode = searchTerm.trim().replace(/[\[\]"'\\]/g, '').trim();
    if (cleanCode.length < 2) {
      setExternalCandidate(null);
      setIsSearchingExternal(false);
      return;
    }

    const timer = setTimeout(() => {
      void fetchExactParcelByCode(cleanCode);
    }, 300);

    return () => clearTimeout(timer);
  }, [isOpen, activeParcel, searchTerm, fetchExactParcelByCode]);

  // Lọc gợi ý tìm kiếm Thửa B
  const searchSuggestions = useMemo(() => {
    const raw = stripVietnameseTones(searchTerm.replace(/[\[\]"'\\]/g, ''));
    if (!raw && !isInputFocused) return [];

    let list = candidatePool;
    if (raw) {
      list = candidatePool.filter((c) => {
        const code = stripVietnameseTones(c.project_parcel_code || c.projectParcelCode || '');
        const official = stripVietnameseTones(c.official_cadastral_code || c.officialCadastralCode || '');
        const house = stripVietnameseTones(c.house_number || c.houseNumber || '');
        const street = stripVietnameseTones(c.street || '');
        const owner = stripVietnameseTones(c.owner_name || c.ownerName || '');
        return code.includes(raw) || official.includes(raw) || house.includes(raw) || street.includes(raw) || owner.includes(raw);
      });
    }

    const sorted = list
      .sort((a, b) => {
        if (a.is_touching && !b.is_touching) return -1;
        if (!a.is_touching && b.is_touching) return 1;
        if (a.distance_meters !== undefined && b.distance_meters !== undefined) {
          if (a.distance_meters !== b.distance_meters) {
            return a.distance_meters - b.distance_meters;
          }
        }
        if (a.is_adjacent && !b.is_adjacent) return -1;
        if (!a.is_adjacent && b.is_adjacent) return 1;
        return (a.project_parcel_code || a.projectParcelCode || '').localeCompare(b.project_parcel_code || b.projectParcelCode || '');
      })
      .slice(0, 10);

    if (externalCandidate && !sorted.some((item) => item.id === externalCandidate.id)) {
      return [externalCandidate, ...sorted];
    }

    return sorted;
  }, [candidatePool, searchTerm, isInputFocused, externalCandidate]);

  // Các thửa tiếp giáp đề xuất nhanh (Touching / Adjacent)
  const quickAdjacentList = useMemo(() => {
    return candidatePool.filter((c) => c.is_touching || c.is_adjacent).slice(0, 6);
  }, [candidatePool]);

  // Tọa độ thửa A
  const coordsA = useMemo<[number, number][]>(() => {
    if (!activeParcel?.coordinates || !Array.isArray(activeParcel.coordinates)) return [];
    let pts = activeParcel.coordinates;
    if (pts.length > 0 && Array.isArray(pts[0])) {
      if (pts[0][0] < 8 || pts[0][0] > 24) {
        pts = pts.map(([lng, lat]) => [lat, lng]);
      }
    }
    return pts as [number, number][];
  }, [activeParcel]);

  // Tọa độ thửa B
  const coordsB = useMemo<[number, number][]>(() => {
    if (!selectedTargetB) return [];
    // Tìm trong zoneParcelsWithGeom
    const match = zoneParcelsWithGeom.find((p) => p.id === selectedTargetB.id);
    let pts = match?.coordinates || selectedTargetB.coordinates;
    if (pts && pts.length > 0 && Array.isArray(pts[0])) {
      if (pts[0][0] < 8 || pts[0][0] > 24) {
        pts = pts.map(([lng, lat]) => [lat, lng]);
      }
      return pts as [number, number][];
    }
    return [];
  }, [selectedTargetB, zoneParcelsWithGeom]);

  // Tâm bản đồ & Tọa độ bao phủ bounds
  const mapCenter = useMemo<[number, number]>(() => {
    if (coordsA.length > 0) return computeCentroid(coordsA);
    return [10.7769, 106.7009];
  }, [coordsA]);

  const mapBoundsCoords = useMemo<[number, number][]>(() => {
    const list = [...coordsA];
    if (coordsB.length > 0) list.push(...coordsB);
    return list;
  }, [coordsA, coordsB]);

  // Thao tác click chọn Thửa B từ bản đồ
  const handleMapParcelClick = useCallback((parcelId: string) => {
    const candidate = candidatePool.find((c) => c.id === parcelId);
    if (candidate) {
      setSelectedTargetB(candidate);
      setSearchTerm(candidate.project_parcel_code || candidate.projectParcelCode || '');
      setIsInputFocused(false);
      setErrorMsg('');
    }
  }, [candidatePool]);

  // Thực thi hoán đổi ranh (Execute Swap API)
  const handleExecuteSwap = async () => {
    if (!selectedTargetB?.id) {
      setErrorMsg('Vui lòng chọn Thửa B cần hoán đổi ranh.');
      return;
    }
    if (!reason.trim() || reason.trim().length < 5) {
      setErrorMsg('Vui lòng nhập lý do điều chuyển ranh đất (tối thiểu 5 ký tự) để ghi nhận nhật ký kiểm toán.');
      return;
    }
    if (!isChallengeValid) {
      setErrorMsg('Vui lòng nhập chính xác mã xác thực 6 số bên dưới để tiếp tục.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const res = await api.post('/admin/parcels/swap-geometries', {
        parcelAId: activeParcel?.id,
        parcelBId: selectedTargetB.id,
        reason: reason.trim(),
      });

      if (!res.data?.success) {
        throw new Error(res.data?.message || 'Lỗi xử lý hoán đổi ranh từ máy chủ.');
      }

      setSuccessMsg(res.data.message || 'Hoán đổi vị trí ranh đất thành công!');
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } catch (err: unknown) {
      console.error('[CadastralSpatialSwapModal] Swap error:', err);
      const msg = getErrorMessage(err, 'Có lỗi xảy ra khi thực hiện hoán đổi ranh đất.');
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !activeParcel) return null;

  return (
    <div className="fixed inset-0 z-[1200] bg-white flex flex-col w-screen h-screen overflow-hidden animate-in fade-in duration-200">
      {/* 1. HEADER SÁNG THANH LỊCH (ĐỒNG BỘ) */}
      <div className="px-5 py-3 bg-white text-slate-800 border-b border-slate-200 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-xs">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-black text-slate-800">
                Hoán Đổi Vị Trí Ranh Đất GIS (Zone Admin)
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 font-mono">
                {activeParcel.projectParcelCode}
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                {activeParcel.zoneId || 'ZONE'}
              </span>
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Toàn Màn Hình
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Hoán đổi ranh đa giác PostGIS • Bảo toàn 100% mã thửa, hồ sơ khảo sát, khuyết tật và watermark ảnh
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          title="Đóng (ESC)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 2. BODY 2 CỘT: CỘT TRÁI THÔNG TIN / CỘT PHẢI BẢN ĐỒ TOÀN CẢNH */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* CỘT TRÁI: SIDEBAR ĐIỀU KHIỂN & CHỌN THỬA (WIDTH ~340PX) */}
        <div className="w-full lg:w-[340px] shrink-0 bg-slate-50/70 border-r border-slate-200 p-3.5 flex flex-col justify-between overflow-y-auto custom-scrollbar gap-3">
          <div className="space-y-3">
            {/* THẺ THỬA A (HIỆN TẠI - MÀU VÀNG HỔ PHÁCH) */}
            <div className="bg-white p-3 rounded-xl border-2 border-amber-400 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Thửa A (Đang khảo sát)
                </span>
                <span className="text-[11px] font-mono font-bold text-slate-600">
                  {activeParcel.landArea || 0} m²
                </span>
              </div>
              <div className="font-extrabold text-sm text-slate-800 font-mono">
                {activeParcel.projectParcelCode}
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                {activeParcel.houseNumber ? `Số ${activeParcel.houseNumber}, ` : ''}{activeParcel.street || 'Đoạn tuyến Metro 2'}
              </div>
              {activeParcel.ownerName && (
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Chủ hộ: <strong>{activeParcel.ownerName}</strong>
                </div>
              )}
            </div>

            {/* BỘ CHỌN THỬA B (THỬA ĐÍCH - MÀU XANH LỤC EMERALD) */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Thửa B (Thửa đích sẽ hoán đổi): <span className="text-rose-500">*</span></span>
              </label>

              {/* Ô TÌM KIẾM THÔNG MINH */}
              <div className="relative">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Tìm trong Zone hoặc nhập đúng mã thửa ngoài Zone..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setIsInputFocused(true);
                    }}
                    onFocus={() => setIsInputFocused(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void fetchExactParcelByCode(searchTerm);
                      }
                    }}
                    className="w-full text-xs pl-8 pr-8 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-slate-800 shadow-xs"
                  />
                  {isSearchingExternal && (
                    <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2" />
                  )}
                </div>

                {/* DROPDOWN GỢI Ý KHI GÕ */}
                {isInputFocused && (searchSuggestions.length > 0 || searchTerm.trim().length >= 2) && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-56 overflow-y-auto divide-y divide-slate-100">
                    {searchSuggestions.map((item) => {
                      const itemZone = item.zone_id || item.zoneId;
                      const isCrossZone = Boolean(item.isOutOfZone || (activeZoneId && itemZone && itemZone !== activeZoneId));
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setSelectedTargetB(item);
                            setSearchTerm(item.project_parcel_code || item.projectParcelCode || '');
                            setIsInputFocused(false);
                            setErrorMsg('');
                          }}
                          className="w-full text-left p-2 hover:bg-emerald-50 flex items-center justify-between text-xs cursor-pointer transition-colors"
                        >
                          <div>
                            <div className="font-bold text-slate-800 font-mono flex items-center gap-1 flex-wrap">
                              <span>{item.project_parcel_code || item.projectParcelCode}</span>
                              {item.is_touching && (
                                <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 rounded font-sans">Kề bên</span>
                              )}
                              {isCrossZone && (
                                <span className="text-[9px] bg-purple-100 text-purple-800 border border-purple-200 px-1.5 py-0.5 rounded font-sans font-bold">
                                  Ngoài Zone ({itemZone})
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Số {item.house_number || item.houseNumber || '—'} {item.street}
                            </div>
                          </div>
                          <span className="text-[11px] text-slate-500 font-mono shrink-0 ml-2">
                            {item.land_area_m2 || item.landArea} m²
                          </span>
                        </button>
                      );
                    })}

                    {searchSuggestions.length === 0 && searchTerm.trim().length >= 2 && (
                      <div className="p-2.5 text-center space-y-1.5">
                        {isSearchingExternal ? (
                          <div className="text-[11px] text-emerald-700 font-medium flex items-center justify-center gap-1.5">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Đang tra cứu mã chính xác ngoài phân khu...</span>
                          </div>
                        ) : (
                          <>
                            <div className="text-[11px] text-slate-500">
                              Không có trong phân khu. Nhập chính xác mã lô đất để lấy từ phân khu khác:
                            </div>
                            <button
                              type="button"
                              onClick={() => void fetchExactParcelByCode(searchTerm)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold transition-colors cursor-pointer"
                            >
                              Tra cứu mã chính xác &ldquo;{searchTerm.trim()}&rdquo;
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* GỢI Ý NHANH CÁC THỬA TIẾP GIÁP KỀ BÊN */}
              {quickAdjacentList.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">Thửa tiếp giáp đề xuất nhanh:</span>
                  <div className="flex flex-wrap gap-1">
                    {quickAdjacentList.map((cand) => {
                      const code = cand.project_parcel_code || cand.projectParcelCode || '';
                      const isSelected = selectedTargetB?.id === cand.id;
                      return (
                        <button
                          key={cand.id}
                          type="button"
                          onClick={() => {
                            setSelectedTargetB(cand);
                            setSearchTerm(code);
                            setErrorMsg('');
                          }}
                          className={`px-2 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1 border ${
                            isSelected
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50'
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5" />}
                          <span>{code}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* THẺ THỬA B ĐÃ CHỌN */}
              {selectedTargetB && (
                <div className="bg-emerald-50/70 p-3 rounded-xl border-2 border-emerald-400 shadow-xs relative">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Thửa B (Sẽ hoán đổi)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTargetB(null);
                        setSearchTerm('');
                      }}
                      className="text-[10px] text-emerald-700 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                      Đổi thửa khác
                    </button>
                  </div>
                  <div className="font-extrabold text-sm text-emerald-900 font-mono flex items-center gap-1.5 flex-wrap">
                    <span>{selectedTargetB.project_parcel_code || selectedTargetB.projectParcelCode}</span>
                    {(selectedTargetB.isOutOfZone ||
                      (activeZoneId &&
                        (selectedTargetB.zone_id || selectedTargetB.zoneId) &&
                        (selectedTargetB.zone_id || selectedTargetB.zoneId) !== activeZoneId)) && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-sans font-bold bg-purple-100 text-purple-800 border border-purple-200">
                        Vượt biên: {selectedTargetB.zone_id || selectedTargetB.zoneId}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    Số {selectedTargetB.house_number || selectedTargetB.houseNumber || '—'} {selectedTargetB.street || ''}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                    <span>Chủ hộ: <strong>{selectedTargetB.owner_name || selectedTargetB.ownerName || '—'}</strong></span>
                    <span className="font-mono font-bold">{selectedTargetB.land_area_m2 || selectedTargetB.landArea || 0} m²</span>
                  </div>
                </div>
              )}
            </div>

            {/* GIẢI THÍCH TRỰC QUAN CƠ CHẾ HOÁN ĐỔI */}
            <div className="p-2.5 bg-sky-50/60 rounded-xl border border-sky-200 text-[11px] text-sky-900 flex items-start gap-2 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-sky-600 shrink-0 mt-0.5" />
              <span>
                Ranh và tọa độ GIS giữa <strong>Thửa A</strong> và <strong>Thửa B</strong> sẽ tráo đổi cho nhau. Mã số, dữ liệu khảo sát và ảnh watermark của mỗi nhà được bảo toàn 100%.
              </span>
            </div>

            {/* LÝ DO ĐIỀU CHUYỂN RANH ĐẤT */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Lý do điều chuyển ranh đất (Audit Log) <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Ví dụ: KSV tích nhầm polygon của thửa kề bên. Hoán đổi ranh đất sang đúng thửa thực tế..."
                className="w-full text-xs p-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-slate-800 placeholder:text-slate-400 shadow-xs"
              />
            </div>

            {/* XÁC THỰC BẢO MẬT 6 SỐ */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Xác thực Zone Admin (6 số)</span>
              </div>
              <AdminSecurityChallengeConfirm
                actionDescription="hoán đổi vị trí ranh đất GIS"
                onValidityChange={(isValid) => setIsChallengeValid(isValid)}
              />
            </div>

            {/* THÔNG BÁO LỖI / THÀNH CÔNG */}
            {errorMsg && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700 font-medium">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-700 font-medium">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}
          </div>

          {/* CÁC NÚT HÀNH ĐỘNG Ở CHÂN SIDEBAR */}
          <div className="pt-3 border-t border-slate-200 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleExecuteSwap}
              disabled={isSubmitting || !selectedTargetB || !isChallengeValid || !reason.trim()}
              className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Đang hoán đổi...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Xác nhận hoán đổi
                </>
              )}
            </button>
          </div>
        </div>

        {/* CỘT PHẢI: BẢN ĐỒ KHÔNG GIAN TOÀN CẢNH SIÊU RỘNG (FLEX-1) */}
        <div className="flex-1 h-full relative overflow-hidden bg-slate-100">
          {/* TOOLBAR NỔI TRÊN BẢN ĐỒ */}
          <div className="absolute top-3 left-3 z-[400] flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white/95 backdrop-blur-md p-1 rounded-xl border border-slate-200 shadow-md">
              <button
                type="button"
                onClick={() => setTileMode('satellite')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  tileMode === 'satellite'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Layers className="w-3 h-3" />
                Vệ Tinh (Esri)
              </button>
              <button
                type="button"
                onClick={() => setTileMode('osm')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  tileMode === 'osm'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Building className="w-3 h-3" />
                Bản Đồ (OSM)
              </button>
            </div>
          </div>

          {/* CHÚ GIẢI MÀU SẮC TRÊN BẢN ĐỒ */}
          <div className="absolute top-3 right-3 z-[400] bg-white/95 backdrop-blur-md px-3 py-2 rounded-xl shadow-md border border-slate-200 text-xs flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-amber-500 border border-amber-600" />
              <span className="text-[11px] font-bold text-slate-700">Thửa A (Đang chọn)</span>
            </div>
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-500 border border-emerald-600" />
              <span className="text-[11px] font-bold text-slate-700">Thửa B (Sẽ đổi ranh)</span>
            </div>
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-slate-200 border border-dashed border-slate-500" />
              <span className="text-[11px] font-medium text-slate-500">Click thửa để chọn</span>
            </div>
          </div>

          {/* HƯỚNG DẪN NHANH NỔI GÓC DƯỚI */}
          <div className="absolute bottom-3 left-3 z-[400] bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-lg text-white text-[11px] font-medium shadow-md flex items-center gap-2 pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Click chuột trực tiếp vào bất kỳ ô thửa nét đứt nào trên bản đồ để chọn làm Thửa B.</span>
          </div>

          {/* MAP CONTAINER (MAXZOOM = 24) */}
          <MapContainer
            center={mapCenter}
            zoom={19}
            maxZoom={24}
            zoomControl={false}
            style={{ width: '100%', height: '100%' }}
            scrollWheelZoom={true}
          >
            <MapBoundsController coords={mapBoundsCoords.length > 0 ? mapBoundsCoords : coordsA} zoom={19} />
            <ZoomControl position="bottomright" />

            {/* TileLayer */}
            {tileMode === 'satellite' ? (
              <TileLayer
                attribution="Esri World Imagery"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxNativeZoom={19}
                maxZoom={24}
              />
            ) : (
              <TileLayer
                attribution="Tiles &copy; Esri &mdash; Esri World Street Map"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
                maxNativeZoom={19}
                maxZoom={24}
              />
            )}

            {/* 0. CÁC THỬA TRONG ZONE (NÉT ĐỨT XÁM, KHÔNG NHÃN PERMANENT, CLICK TO SELECT) */}
            {zoneParcelsWithGeom.map((p) => {
              if (p.id === activeParcel.id || p.id === selectedTargetB?.id) return null;
              let pts = p.coordinates;
              if (!pts || pts.length < 3) return null;
              if (Array.isArray(pts[0]) && (pts[0][0] < 8 || pts[0][0] > 24)) {
                pts = pts.map(([lng, lat]) => [lat, lng]);
              }

              return (
                <Polygon
                  key={`zone-parcel-${p.id}`}
                  positions={pts as [number, number][]}
                  pathOptions={{
                    color: '#64748b',
                    weight: 1.5,
                    dashArray: '5, 5',
                    fillColor: '#94a3b8',
                    fillOpacity: 0.12,
                  }}
                  eventHandlers={{
                    click: () => handleMapParcelClick(p.id),
                  }}
                >
                  <Tooltip direction="center" opacity={0.92}>
                    <div className="text-[10px] font-mono font-bold text-slate-800 bg-white/95 px-1.5 py-0.5 rounded border border-slate-300 shadow-xs pointer-events-none">
                      {p.projectParcelCode || p.houseNumber} (Click chọn Thửa B)
                    </div>
                  </Tooltip>
                </Polygon>
              );
            })}

            {/* 1. THỬA A (ĐANG CHỌN - MÀU VÀNG HỔ PHÁCH) */}
            {coordsA.length >= 3 && (
              <Polygon
                positions={coordsA}
                pathOptions={{
                  color: '#d97706',
                  fillColor: '#f59e0b',
                  fillOpacity: 0.65,
                  weight: 3.5,
                }}
              >
                <Tooltip direction="top" opacity={0.95} permanent>
                  <div className="text-xs font-bold text-amber-900 text-center">
                    Thửa A (Đang chọn): <strong>{activeParcel.projectParcelCode}</strong>
                  </div>
                </Tooltip>
              </Polygon>
            )}

            {/* 2. THỬA B (THỬA ĐÍCH - MÀU XANH LỤC EMERALD) */}
            {coordsB.length >= 3 && (
              <Polygon
                positions={coordsB}
                pathOptions={{
                  color: '#059669',
                  fillColor: '#10b981',
                  fillOpacity: 0.65,
                  weight: 3.5,
                }}
              >
                <Tooltip direction="top" opacity={0.95} permanent>
                  <div className="text-xs font-bold text-emerald-900 text-center">
                    Thửa B (Sẽ hoán đổi): <strong>{selectedTargetB?.project_parcel_code || selectedTargetB?.projectParcelCode}</strong>
                  </div>
                </Tooltip>
              </Polygon>
            )}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};
