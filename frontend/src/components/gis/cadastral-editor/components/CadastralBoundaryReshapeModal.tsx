import React, { useState, useEffect, useMemo, useCallback } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Polygon, Marker, Tooltip, ZoomControl } from 'react-leaflet';
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
  Home,
  MapPin,
  ShieldCheck,
  Maximize2,
  Ruler,
} from 'lucide-react';
import { GisParcel } from '../../shared/types';
import { api } from '../../../../services/api';
import { MapBoundsController } from '../../shared/MapControllers';
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
  onClose: () => void;
  onSuccess: (updatedResult?: any) => void;
}

export const CadastralBoundaryReshapeModal: React.FC<CadastralBoundaryReshapeModalProps> = ({
  isOpen,
  parcel,
  onClose,
  onSuccess,
}) => {
  // Tile mode: Satellite hoặc OSM
  const [tileMode, setTileMode] = useState<'satellite' | 'osm'>('satellite');

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

  // Khởi tạo tọa độ khi modal mở
  useEffect(() => {
    if (isOpen && parcel) {
      let initialPts: [number, number][] = [];

      if (parcel.coordinates && Array.isArray(parcel.coordinates) && parcel.coordinates.length > 0) {
        // Kiểm tra xem coordinates là [lat, lng] hay [lng, lat]
        const first = parcel.coordinates[0];
        if (Array.isArray(first)) {
          // Nếu phần tử đầu tiên có lat nằm trong khoảng vĩ độ VN (8 - 24)
          if (first[0] > 8 && first[0] < 24) {
            initialPts = parcel.coordinates as [number, number][];
          } else {
            // Ngược lại nếu là [lng, lat]
            initialPts = parcel.coordinates.map((pt: any) => [pt[1], pt[0]]);
          }
        }
      }

      const cleaned = cleanPolygonRing(initialPts);
      setOriginalCoords([...cleaned]);
      setVertices(cleaned.map((pt) => [pt[0], pt[1]]));
      setReason('');
      setIsChallengeValid(false);
      setErrorMessage('');
      setSuccessMessage('');
      setUpdateFootprint(true);
    }
  }, [isOpen, parcel]);

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

  // Thêm mốc đỉnh (Thêm điểm nội suy vào giữa cạnh dài nhất)
  const handleAddVertex = useCallback(() => {
    if (vertices.length < 3) return;

    // Tìm cạnh dài nhất để chèn đỉnh nội suy vào giữa
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

  // Bớt mốc đỉnh (Xóa đỉnh cuối cùng nếu còn > 3 đỉnh)
  const handleRemoveVertex = useCallback(() => {
    if (vertices.length <= 3) return;
    setVertices((prev) => prev.slice(0, prev.length - 1));
  }, [vertices]);

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
    } catch (err: any) {
      console.error('[CadastralBoundaryReshapeModal] Submit error:', err);
      const msg = err.response?.data?.message || err.message || 'Lỗi kết nối máy chủ.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !parcel) return null;

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* HEADER */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-sm">
              <Move className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-800">
                  Nắn Chỉnh Đa Giác Ranh Thửa Đất
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                  {parcel.projectParcelCode}
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-200 text-slate-700">
                  {parcel.zoneId || 'ZONE'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {parcel.houseNumber ? `${parcel.houseNumber}, ` : ''}
                  {parcel.street || 'Đoạn tuyến Metro 2'}
                </span>
                {parcel.ownerName && (
                  <span className="text-slate-400">• Chủ hộ: {parcel.ownerName}</span>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 flex-1 overflow-y-auto space-y-5">
          {/* TOOLBAR & CONTROLS */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 p-3 rounded-xl border border-slate-200">
            {/* Lớp bản đồ */}
            <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
              <button
                type="button"
                onClick={() => setTileMode('satellite')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  tileMode === 'satellite'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Ảnh Vệ Tinh (Esri)
              </button>
              <button
                type="button"
                onClick={() => setTileMode('osm')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  tileMode === 'osm'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Building className="w-3.5 h-3.5" />
                Bản Đồ Đường (OSM)
              </button>
            </div>

            {/* Công cụ xử lý đỉnh */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddVertex}
                className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm Mốc Đỉnh
              </button>
              <button
                type="button"
                onClick={handleRemoveVertex}
                disabled={vertices.length <= 3}
                className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 disabled:opacity-40 disabled:pointer-events-none rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-colors"
              >
                <Minus className="w-3.5 h-3.5" />
                Bớt Mốc ({vertices.length})
              </button>
              <button
                type="button"
                onClick={handleResetToOriginal}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Đặt Lại Gốc
              </button>
            </div>
          </div>

          {/* MAP CANVAS CONTAINER */}
          <div className="relative w-full h-[380px] rounded-xl overflow-hidden border-2 border-indigo-200 shadow-inner">
            <MapContainer
              center={centroid}
              zoom={19}
              maxZoom={22}
              zoomControl={false}
              style={{ width: '100%', height: '100%' }}
              scrollWheelZoom={true}
            >
              <MapBoundsController coords={originalCoords.length > 0 ? originalCoords : vertices} zoom={19} />
              <ZoomControl position="bottomright" />

              {/* TileLayer */}
              {tileMode === 'satellite' ? (
                <TileLayer
                  attribution="Esri World Imagery"
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  maxNativeZoom={19}
                  maxZoom={22}
                />
              ) : (
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  maxNativeZoom={19}
                  maxZoom={22}
                />
              )}

              {/* 1. GHOST BASELINE: Ranh giới ban đầu nét đứt xám */}
              {originalCoords.length >= 3 && (
                <Polygon
                  positions={originalCoords}
                  pathOptions={{
                    color: '#64748b',
                    fillColor: '#94a3b8',
                    fillOpacity: 0.1,
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

              {/* 3. DRAGGABLE VERTEX HANDLES */}
              {vertices.map((pt, idx) => (
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
              ))}
            </MapContainer>

            {/* Overlay hướng dẫn nhanh trên bản đồ */}
            <div className="absolute top-3 left-3 z-[400] bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-white text-[11px] font-medium shadow-md flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Kéo các mốc số 1, 2, 3... để nắn chỉnh khớp bờ tường/mái nhà</span>
            </div>

            {/* Overlay thước đo diện tích nổi góc trên bên phải */}
            <div className="absolute top-3 right-3 z-[400] bg-white/95 backdrop-blur-md px-3 py-2 rounded-xl shadow-lg border border-slate-200 text-xs flex items-center gap-3">
              <div>
                <span className="text-slate-400 text-[10px] block font-semibold uppercase">Diện tích mới</span>
                <span className="font-extrabold text-indigo-700 text-sm">{currentAreaM2.toFixed(1)} m²</span>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <span className="text-slate-400 text-[10px] block font-semibold uppercase">Chênh lệch (ΔS)</span>
                <span
                  className={`font-bold text-xs ${
                    deltaAreaM2 === 0
                      ? 'text-slate-500'
                      : Math.abs(deltaPercent) > 15
                      ? 'text-amber-600'
                      : 'text-emerald-600'
                  }`}
                >
                  {deltaAreaM2 > 0 ? `+${deltaAreaM2}` : deltaAreaM2} m² ({deltaPercent > 0 ? `+${deltaPercent}` : deltaPercent}%)
                </span>
              </div>
            </div>
          </div>

          {/* AREA COMPARISON CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-medium">Diện tích ranh gốc</span>
                <div className="text-base font-bold text-slate-700">{originalAreaM2.toFixed(1)} m²</div>
              </div>
              <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-xs">
                S₁
              </div>
            </div>

            <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-200 flex items-center justify-between">
              <div>
                <span className="text-xs text-indigo-700 font-medium">Diện tích sau nắn</span>
                <div className="text-base font-bold text-indigo-800">{currentAreaM2.toFixed(1)} m²</div>
              </div>
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                S₂
              </div>
            </div>

            <div
              className={`p-3 rounded-xl border flex items-center justify-between ${
                Math.abs(deltaPercent) > 20
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              <div>
                <span className="text-xs opacity-80 font-medium">Biến động diện tích (ΔS)</span>
                <div className="text-base font-extrabold">
                  {deltaAreaM2 > 0 ? `+${deltaAreaM2}` : deltaAreaM2} m² ({deltaPercent > 0 ? `+${deltaPercent}` : deltaPercent}%)
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold">
                <Ruler className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* OPTIONS & REASON */}
          <div className="space-y-3 pt-1">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-700 select-none">
              <input
                type="checkbox"
                checked={updateFootprint}
                onChange={(e) => setUpdateFootprint(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Đồng thời cập nhật Đa giác ranh nhà (Footprint) theo ranh đất mới</span>
            </label>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Lý do nắn chỉnh ranh giới <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Ví dụ: Nắn chỉnh các đỉnh 2 và 3 bám sát ranh bờ tường và mép mái nhà thực tế đối chiếu trên ảnh vệ tinh Esri..."
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-slate-800 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* ADMIN SECURITY CHALLENGE */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Xác thực kiểm soát bảo mật Zone Admin</span>
            </div>
            <AdminSecurityChallengeConfirm
              actionDescription="nắn chỉnh hình học đa giác ranh thửa đất trên GIS"
              onValidityChange={(isValid) => setIsChallengeValid(isValid)}
            />
          </div>

          {/* ERROR / SUCCESS ALERTS */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700 font-medium">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-700 font-medium">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Hệ thống tự động ghi nhận nhật ký kiểm toán và tính toán diện tích chuẩn PostGIS WGS84.
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-colors disabled:opacity-50"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !isChallengeValid || !reason.trim()}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang lưu PostGIS...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Lưu Biến Động Nắn Chỉnh
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
