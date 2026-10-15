import { getErrorMessage } from '@/utils/errorUtils';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Polygon, Polyline, Marker, Tooltip, ZoomControl } from 'react-leaflet';
import {
  X,
  Layers,
  Move,
  RotateCcw,
  Plus,
  Minus,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Building,
  MapPin,
  ShieldCheck,
  Ruler,
  Undo,
  Trash2,
  Crosshair,
} from 'lucide-react';
import type { GisParcel } from '../../shared/types';
import { api } from '../../../../services/api';
import { MapBoundsController, MapClickListener } from '../../shared/MapControllers';
import {
  createHandleIcon,
  computePolygonAreaM2,
  computeCentroid,
  cleanPolygonRing,
  interpolatePoint,
} from '../../shared/geoMath';
import { AdminSecurityChallengeConfirm } from '../../../../features/zone-management/components/review-queue/AdminSecurityChallengeConfirm';

interface CadastralBoundaryReshapeModalProps {
  isOpen: boolean;
  parcel: GisParcel | null;
  neighboringParcels?: GisParcel[];
  onClose: () => void;
  onSuccess: (updatedResult?: { message?: string; [key: string]: unknown }) => void;
}

export const CadastralBoundaryReshapeModal: React.FC<CadastralBoundaryReshapeModalProps> = ({
  isOpen,
  parcel,
  neighboringParcels,
  onClose,
  onSuccess,
}) => {
  // Tile mode: Satellite hoặc OSM
  const [tileMode, setTileMode] = useState<'satellite' | 'osm'>('satellite');

  // Chế độ biên tập: Kéo nắn mốc ranh hoặc Chấm điểm tự do trên bản đồ
  const [reshapeMode, setReshapeMode] = useState<'DRAG_HANDLES' | 'CLICK_TO_DRAW'>('DRAG_HANDLES');

  // Thửa đất lân cận xung quanh trong Zone
  const [zoneNeighbors, setZoneNeighbors] = useState<GisParcel[]>(neighboringParcels || []);
  const [showNeighbors, setShowNeighbors] = useState<boolean>(true);
  const [, setIsLoadingNeighbors] = useState<boolean>(false);

  // Tọa độ gốc ban đầu (Baseline)
  const [originalCoords, setOriginalCoords] = useState<[number, number][]>([]);

  // Tọa độ đang nắn chỉnh (Editable Vertices)
  const [vertices, setVertices] = useState<[number, number][]>([]);

  // Tùy chọn đồng bộ footprint
  const [updateFootprint, setUpdateFootprint] = useState(true);

  // Lý do nắn chỉnh
  const [reason, setReason] = useState('');

  // Xác thực bảo mật Admin
  const [isChallengeValid, setIsChallengeValid] = useState(false);

  // Trạng thái lưu
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Khởi tạo tọa độ & nạp thửa lân cận khi modal mở
  useEffect(() => {
    if (isOpen && parcel) {
      let initialPts: [number, number][] = [];

      if (parcel.coordinates && Array.isArray(parcel.coordinates) && parcel.coordinates.length > 0) {
        const first = parcel.coordinates[0];
        if (Array.isArray(first)) {
          if (first[0] > 8 && first[0] < 24) {
            initialPts = parcel.coordinates as [number, number][];
          } else {
            initialPts = parcel.coordinates.map((pt) => [pt[1], pt[0]]);
          }
        }
      }

      const cleaned = cleanPolygonRing(initialPts);
      setOriginalCoords([...cleaned]);
      setVertices(cleaned.map((pt) => [pt[0], pt[1]]));
      setReshapeMode('DRAG_HANDLES');
      setReason('');
      setIsChallengeValid(false);
      setErrorMessage('');
      setSuccessMessage('');
      setUpdateFootprint(true);

      if (neighboringParcels && neighboringParcels.length > 0) {
        setZoneNeighbors(neighboringParcels);
      } else {
        const targetZone = parcel.zoneId || (parcel as unknown as { zone_id?: string }).zone_id;
        if (targetZone) {
          setIsLoadingNeighbors(true);
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
                  };
                });
                setZoneNeighbors(parsed);
              }
            })
            .catch((err: unknown) => {
              console.error('[CadastralBoundaryReshapeModal] Lỗi nạp thửa lân cận:', err);
            })
            .finally(() => {
              setIsLoadingNeighbors(false);
            });
        }
      }
    }
  }, [isOpen, parcel, neighboringParcels]);

  // Tâm của đa giác
  const centroid = useMemo(() => {
    if (vertices.length > 0) {
      return computeCentroid(vertices);
    }
    return [10.7769, 106.7009] as [number, number];
  }, [vertices]);

  // Diện tích gốc và diện tích tính toán theo thời gian thực
  const originalAreaM2 = useMemo(() => {
    if (parcel?.landArea && parcel.landArea > 0) {
      return Number(parcel.landArea);
    }
    return computePolygonAreaM2(originalCoords);
  }, [parcel, originalCoords]);

  const currentAreaM2 = useMemo(() => {
    return computePolygonAreaM2(vertices);
  }, [vertices]);

  const deltaAreaM2 = useMemo(() => {
    return Math.round((currentAreaM2 - originalAreaM2) * 100) / 100;
  }, [currentAreaM2, originalAreaM2]);

  const deltaPercent = useMemo(() => {
    if (originalAreaM2 <= 0) return 0;
    return Math.round(((currentAreaM2 - originalAreaM2) / originalAreaM2) * 1000) / 10;
  }, [currentAreaM2, originalAreaM2]);

  // Kéo thả đỉnh
  const handleVertexDrag = useCallback((idx: number, latlng: L.LatLng) => {
    setVertices((prev) => {
      const next = [...prev];
      next[idx] = [latlng.lat, latlng.lng];
      return next;
    });
  }, []);

  // Chấm điểm trên bản đồ khi ở chế độ Chấm điểm tự do
  const handleMapClickDraw = useCallback((latlng: [number, number]) => {
    setVertices((prev) => [...prev, latlng]);
  }, []);

  // Thêm mốc đỉnh (Thêm điểm nội suy vào giữa cạnh dài nhất)
  const handleAddVertex = useCallback(() => {
    if (vertices.length < 3) return;

    let maxDist = -1;
    let bestIndex = 0;

    for (let i = 0; i < vertices.length; i++) {
      const nextI = (i + 1) % vertices.length;
      const p1 = vertices[i];
      const p2 = vertices[nextI];
      const d = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      if (d > maxDist) {
        maxDist = d;
        bestIndex = i;
      }
    }

    const pA = vertices[bestIndex];
    const pB = vertices[(bestIndex + 1) % vertices.length];
    const midPoint = interpolatePoint(pA, pB, 0.5);

    setVertices((prev) => {
      const next = [...prev];
      next.splice(bestIndex + 1, 0, midPoint);
      return next;
    });
  }, [vertices]);

  // Bớt mốc đỉnh / Hoàn tác đỉnh cuối
  const handleRemoveVertex = useCallback(() => {
    if (vertices.length <= (reshapeMode === 'CLICK_TO_DRAW' ? 0 : 3)) return;
    setVertices((prev) => prev.slice(0, prev.length - 1));
  }, [vertices.length, reshapeMode]);

  // Xóa vẽ lại từ đầu trong chế độ Chấm điểm
  const handleClearDraw = useCallback(() => {
    setVertices([]);
  }, []);

  // Khôi phục ranh giới ban đầu
  const handleResetToOriginal = useCallback(() => {
    setVertices(originalCoords.map((pt) => [pt[0], pt[1]]));
  }, [originalCoords]);

  // Xử lý gửi dữ liệu lên Backend
  const handleSubmit = async () => {
    if (!parcel) return;

    if (vertices.length < 3) {
      setErrorMessage('Đa giác nắn chỉnh phải có tối thiểu 3 đỉnh.');
      return;
    }

    if (!reason.trim()) {
      setErrorMessage('Vui lòng nhập lý do nắn chỉnh ranh giới thửa đất.');
      return;
    }

    if (!isChallengeValid) {
      setErrorMessage('Vui lòng hoàn thành mã bảo mật kiểm soát Zone Admin (6 số).');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await api.put(`/parcels/${parcel.id}/reshape-geometry`, {
        coordinates: vertices,
        reason: reason.trim(),
        updateFootprint,
      });

      if (res.data?.success) {
        setSuccessMessage(res.data.message || 'Nắn chỉnh ranh giới thành công!');
        setTimeout(() => {
          onSuccess(res.data);
          onClose();
        }, 1200);
      } else {
        setErrorMessage(res.data?.message || 'Có lỗi xảy ra khi nắn chỉnh ranh đất.');
      }
    } catch (err: unknown) {
      console.error('[CadastralBoundaryReshapeModal] Submit error:', err);
      const msg = getErrorMessage(err, 'Lỗi kết nối máy chủ.');
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Danh sách các thửa lân cận hợp lệ
  const validNeighbors = useMemo(() => {
    if (!parcel || !zoneNeighbors) return [];
    return zoneNeighbors.filter((p) => {
      if (p.id === parcel.id) return false;
      const pts = p.coordinates;
      return Array.isArray(pts) && pts.length >= 3;
    });
  }, [parcel, zoneNeighbors]);

  if (!isOpen || !parcel) return null;

  return (
    <div className="fixed inset-0 z-[1200] bg-white flex flex-col w-screen h-screen overflow-hidden animate-in fade-in duration-200">
      {/* 1. HEADER SÁNG THANH LỊCH (ĐỒNG BỘ TOÀN HỆ THỐNG) */}
      <div className="px-5 py-3 bg-white text-slate-800 border-b border-slate-200 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-xs">
            <Move className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-black text-slate-800">
                Nắn Chỉnh Đa Giác Ranh Thửa Đất GIS
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
                {parcel.projectParcelCode}
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                {parcel.zoneId || 'ZONE'}
              </span>
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Toàn Màn Hình
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {parcel.houseNumber ? `${parcel.houseNumber}, ` : ''}
                {parcel.street || 'Đoạn tuyến Metro 2'}
              </span>
              {parcel.ownerName && (
                <span className="text-slate-400">• Chủ hộ: <strong>{parcel.ownerName}</strong></span>
              )}
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

      {/* 2. BODY CHIA LÀM 2 CỘT: CỘT TRÁI ĐIỀU KHIỂN & CỘT PHẢI BẢN ĐỒ TOÀN CẢNH */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* CỘT TRÁI: SIDEBAR THAO TÁC (WIDTH ~340PX) */}
        <div className="w-full lg:w-[340px] shrink-0 bg-slate-50/70 border-r border-slate-200 p-3.5 flex flex-col justify-between overflow-y-auto custom-scrollbar gap-3">
          <div className="space-y-3">
            {/* THẺ SO SÁNH DIỆN TÍCH */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-[10px] text-slate-400 font-semibold block uppercase">Ranh gốc (S₁)</span>
                <span className="text-sm font-extrabold text-slate-700">{originalAreaM2.toFixed(1)} m²</span>
              </div>
              <div className="bg-indigo-50/70 p-2.5 rounded-xl border border-indigo-200 shadow-xs">
                <span className="text-[10px] text-indigo-600 font-semibold block uppercase">Sau nắn (S₂)</span>
                <span className="text-sm font-black text-indigo-700">{currentAreaM2.toFixed(1)} m²</span>
              </div>
            </div>

            {/* BIẾN ĐỘNG DIỆN TÍCH */}
            <div
              className={`p-2.5 rounded-xl border flex items-center justify-between shadow-xs ${
                Math.abs(deltaPercent) > 15
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}
            >
              <div>
                <span className="text-[10px] opacity-75 font-semibold block uppercase">Biến động diện tích (ΔS)</span>
                <div className="text-xs font-black">
                  {deltaAreaM2 > 0 ? `+${deltaAreaM2}` : deltaAreaM2} m² ({deltaPercent > 0 ? `+${deltaPercent}` : deltaPercent}%)
                </div>
              </div>
              <Ruler className="w-4 h-4 opacity-75" />
            </div>

            {/* BỘ CHỌN 2 CHẾ ĐỘ BIÊN TẬP: KÉO NẮN MỐC HOẶC CHẤM ĐIỂM TỰ DO */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-indigo-600" />
                <span>Phương thức biên tập ranh:</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-white rounded-xl border border-slate-200 shadow-xs">
                <button
                  type="button"
                  onClick={() => setReshapeMode('DRAG_HANDLES')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    reshapeMode === 'DRAG_HANDLES'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Move className="w-3.5 h-3.5" />
                  Kéo nắn mốc
                </button>
                <button
                  type="button"
                  onClick={() => setReshapeMode('CLICK_TO_DRAW')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    reshapeMode === 'CLICK_TO_DRAW'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  Chấm điểm tự do
                </button>
              </div>
            </div>

            {/* BỘ CÔNG CỤ THEO TỪNG CHẾ ĐỘ */}
            <div className="flex flex-wrap items-center gap-1.5">
              {reshapeMode === 'DRAG_HANDLES' ? (
                <>
                  <button
                    type="button"
                    onClick={handleAddVertex}
                    className="flex-1 py-1.5 px-2 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    Thêm mốc
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveVertex}
                    disabled={vertices.length <= 3}
                    className="flex-1 py-1.5 px-2 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 disabled:opacity-40 disabled:pointer-events-none rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
                  >
                    <Minus className="w-3 h-3" />
                    Bớt mốc ({vertices.length})
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleRemoveVertex}
                    disabled={vertices.length === 0}
                    className="flex-1 py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 disabled:opacity-40 disabled:pointer-events-none rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
                  >
                    <Undo className="w-3 h-3" />
                    Hoàn tác
                  </button>
                  <button
                    type="button"
                    onClick={handleClearDraw}
                    className="flex-1 py-1.5 px-2 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    Xóa vẽ lại
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={handleResetToOriginal}
                className="w-full py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Đặt lại gốc ban đầu
              </button>
            </div>

            {/* CHECKBOX ĐỒNG BỘ FOOTPRINT */}
            <label className="flex items-center gap-2 cursor-pointer text-[11px] font-semibold text-slate-700 select-none pt-1">
              <input
                type="checkbox"
                checked={updateFootprint}
                onChange={(e) => setUpdateFootprint(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span>Cập nhật Footprint nhà theo ranh mới</span>
            </label>

            {/* LÝ DO NẮN CHỈNH */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Lý do nắn chỉnh ranh giới <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Ví dụ: Nắn chỉnh các đỉnh 2 và 3 bám sát bờ tường đối chiếu trên ảnh vệ tinh Esri..."
                className="w-full text-xs p-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-slate-800 placeholder:text-slate-400 shadow-xs"
              />
            </div>

            {/* XÁC THỰC BẢO MẬT 6 SỐ */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span>Xác thực Zone Admin (6 số)</span>
              </div>
              <AdminSecurityChallengeConfirm
                actionDescription="nắn chỉnh hình học đa giác ranh thửa đất"
                onValidityChange={(isValid) => setIsChallengeValid(isValid)}
              />
            </div>

            {/* THÔNG BÁO LỖI / THÀNH CÔNG */}
            {errorMessage && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700 font-medium">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-700 font-medium">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{successMessage}</span>
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
              onClick={handleSubmit}
              disabled={isSubmitting || !isChallengeValid || !reason.trim()}
              className="flex-1 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Lưu biến động
                </>
              )}
            </button>
          </div>
        </div>

        {/* CỘT PHẢI: BẢN ĐỒ TOÀN CẢNH SIÊU RỘNG (FLEX-1) */}
        <div className="flex-1 h-full relative overflow-hidden bg-slate-100">
          {/* TOOLBAR NỔI TRÊN BẢN ĐỒ */}
          <div className="absolute top-3 left-3 z-[400] flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-white/95 backdrop-blur-md p-1 rounded-xl border border-slate-200 shadow-md">
              <button
                type="button"
                onClick={() => setTileMode('satellite')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  tileMode === 'satellite'
                    ? 'bg-indigo-600 text-white shadow-xs'
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
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Building className="w-3 h-3" />
                Bản Đồ (OSM)
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowNeighbors((prev) => !prev)}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 shadow-md transition-colors cursor-pointer backdrop-blur-md ${
                showNeighbors
                  ? 'bg-slate-800/90 text-white border border-slate-700'
                  : 'bg-white/95 text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
              title="Bật/Tắt đường viền nét đứt các thửa đất lân cận xung quanh trong Zone"
            >
              <Layers className="w-3 h-3" />
              <span>{showNeighbors ? `Ẩn ranh lân cận (${validNeighbors.length})` : `Hiện ranh lân cận (${validNeighbors.length})`}</span>
            </button>
          </div>

          {/* HƯỚNG DẪN NHANH NỔI GÓC DƯỚI BÊN TRÁI */}
          <div className="absolute bottom-3 left-3 z-[400] bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-lg text-white text-[11px] font-medium shadow-md flex items-center gap-2 pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              {reshapeMode === 'DRAG_HANDLES'
                ? 'Kéo các mốc tròn số 1, 2, 3... để nắn ranh. Ranh nét đứt xám là các thửa lân cận.'
                : 'Nhấp chuột trên bản đồ để chấm từng đỉnh tọa độ mới bám sát ảnh vệ tinh.'}
            </span>
          </div>

          {/* MAP CONTAINER PHỦ TRỌN KHÔNG GIAN BÊN PHẢI (MAXZOOM = 24) */}
          <MapContainer
            center={centroid}
            zoom={19}
            maxZoom={24}
            zoomControl={false}
            style={{ width: '100%', height: '100%' }}
            scrollWheelZoom={true}
          >
            <MapBoundsController coords={originalCoords.length > 0 ? originalCoords : vertices} zoom={19} />
            <ZoomControl position="bottomright" />

            {/* Lắng nghe click vẽ điểm khi ở chế độ Chấm điểm tự do */}
            <MapClickListener
              enabled={reshapeMode === 'CLICK_TO_DRAW'}
              onMapClick={handleMapClickDraw}
            />

            {/* TileLayer phóng to sâu maxZoom=24 */}
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

            {/* 0. THỬA ĐẤT LÂN CẬN: NÉT ĐỨT MẢNH, TẮT HOÀN TOÀN NHÃN PERMANENT */}
            {showNeighbors && validNeighbors.map((nb) => {
              let pts = nb.coordinates;
              if (pts.length > 0 && Array.isArray(pts[0])) {
                if (pts[0][0] < 8 || pts[0][0] > 24) {
                  pts = pts.map(([lng, lat]) => [lat, lng]);
                }
              }
              return (
                <Polygon
                  key={`neighbor-${nb.id}`}
                  positions={pts}
                  pathOptions={{
                    color: '#64748b',
                    weight: 1.5,
                    dashArray: '5, 5',
                    fillColor: '#94a3b8',
                    fillOpacity: 0.12,
                  }}
                >
                  <Tooltip direction="center" opacity={0.92}>
                    <div className="text-[10px] font-mono font-bold text-slate-800 bg-white/95 px-1.5 py-0.5 rounded border border-slate-300 shadow-xs pointer-events-none">
                      {nb.projectParcelCode || nb.houseNumber}
                    </div>
                  </Tooltip>
                </Polygon>
              );
            })}

            {/* 1. GHOST BASELINE: Ranh giới ban đầu nét đứt xám */}
            {originalCoords.length >= 3 && (
              <Polygon
                positions={originalCoords}
                pathOptions={{
                  color: '#475569',
                  fillColor: '#64748b',
                  fillOpacity: 0.08,
                  weight: 2,
                  dashArray: '6, 6',
                }}
              >
                <Tooltip direction="top" opacity={0.85}>
                  <div className="text-xs font-semibold text-slate-700">
                    Ranh giới gốc: {originalAreaM2.toFixed(1)} m²
                  </div>
                </Tooltip>
              </Polygon>
            )}

            {/* 2. RESHAPE POLYGON: Đa giác đang được nắn chỉnh */}
            {vertices.length >= 3 && (
              <Polygon
                positions={vertices}
                pathOptions={{
                  color: '#4f46e5',
                  fillColor: '#6366f1',
                  fillOpacity: 0.45,
                  weight: 3.5,
                }}
              >
                <Tooltip direction="top" opacity={0.95}>
                  <div className="text-xs font-bold text-indigo-900">
                    Ranh mới: {currentAreaM2.toFixed(1)} m² ({vertices.length} đỉnh)
                  </div>
                </Tooltip>
              </Polygon>
            )}

            {/* Polyline preview khi đang chấm < 3 điểm trong chế độ Chấm điểm */}
            {reshapeMode === 'CLICK_TO_DRAW' && vertices.length > 0 && vertices.length < 3 && (
              <Polyline
                positions={vertices}
                pathOptions={{
                  color: '#4f46e5',
                  weight: 3.5,
                  dashArray: '4, 4',
                }}
              />
            )}

            {/* 3. MARKERS THEO CHẾ ĐỘ: DRAGGABLE HANDLES HOẶC CHẤM ĐIỂM */}
            {reshapeMode === 'DRAG_HANDLES'
              ? vertices.map((pt, idx) => (
                  <Marker
                    key={`handle-vertex-${idx}`}
                    position={pt}
                    draggable={true}
                    icon={createHandleIcon(idx + 1, '#4f46e5')}
                    eventHandlers={{
                      dragend: (e) => {
                        handleVertexDrag(idx, e.target.getLatLng());
                      },
                    }}
                  />
                ))
              : vertices.map((pt, idx) => (
                  <Marker
                    key={`click-point-${idx}`}
                    position={pt}
                    icon={createHandleIcon(idx + 1, '#4f46e5')}
                  />
                ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};
