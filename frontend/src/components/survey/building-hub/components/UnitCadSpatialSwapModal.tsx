import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ArrowRightLeft,
  Search,
  Building2,
  Home,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Layers,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import type { BuildingUnit } from '../types';
import { api } from '../../../../services/api';
import { getErrorMessage } from '@/utils/errorUtils';
import { formatShortUnitDisplay } from '../../../../core/utils/codeFormattingUtils';
import confetti from 'canvas-confetti';

interface Props {
  isOpen: boolean;
  parcelId: string;
  projectParcelCode?: string;
  sourceUnit: BuildingUnit | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const UnitCadSpatialSwapModal: React.FC<Props> = ({
  isOpen,
  parcelId,
  projectParcelCode,
  sourceUnit,
  onClose,
  onSuccess,
}) => {
  const [allUnits, setAllUnits] = useState<BuildingUnit[]>([]);
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);
  const [selectedTargetUnit, setSelectedTargetUnit] = useState<BuildingUnit | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFloorFilter, setSelectedFloorFilter] = useState<number | 'ALL'>('ALL');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'ALL' | 'UNIT' | 'MASTER'>('ALL');
  const [reason, setReason] = useState('KSV ấn nhầm vị trí khi khảo sát thực địa');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Tải danh sách toàn bộ căn hộ & khu vực của tòa nhà
  useEffect(() => {
    if (!isOpen || !parcelId) return;

    let isSubscribed = true;
    setIsLoadingUnits(true);
    setErrorMsg('');
    setSelectedTargetUnit(null);

    api
      .get<{ data: { units: BuildingUnit[] } }>(`/parcels/${parcelId}/units`)
      .then((res) => {
        if (!isSubscribed) return;
        const units = res.data?.data?.units || [];
        setAllUnits(units);
      })
      .catch((err: unknown) => {
        if (!isSubscribed) return;
        console.error('[UnitCadSpatialSwapModal] Lỗi nạp danh sách căn hộ:', err);
        setErrorMsg('Không thể nạp danh sách căn hộ của tòa nhà');
      })
      .finally(() => {
        if (isSubscribed) setIsLoadingUnits(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [isOpen, parcelId]);

  // Đặt tầng mặc định của bộ lọc theo tầng của sourceUnit
  useEffect(() => {
    if (sourceUnit) {
      const fl = sourceUnit.floor_number !== undefined ? Number(sourceUnit.floor_number) : 1;
      setSelectedFloorFilter(fl);
    }
  }, [sourceUnit]);

  // Danh sách các tầng có trong tòa nhà
  const availableFloors = useMemo(() => {
    const floorsSet = new Set<number>();
    for (const u of allUnits) {
      if (u.floor_number !== undefined && u.floor_number !== null) {
        floorsSet.add(Number(u.floor_number));
      }
    }
    return Array.from(floorsSet).sort((a, b) => a - b);
  }, [allUnits]);

  // Lọc các ứng viên có thể hoán đổi (loại trừ chính sourceUnit)
  const candidateUnits = useMemo(() => {
    if (!sourceUnit) return [];
    return allUnits.filter((u) => {
      if (u.id === sourceUnit.id) return false;

      // Lọc theo tầng
      if (selectedFloorFilter !== 'ALL') {
        const uFl = u.floor_number !== undefined ? Number(u.floor_number) : 1;
        if (uFl !== Number(selectedFloorFilter)) return false;
      }

      // Lọc theo loại Unit / Master
      const uType = (u.unit_type || u.unitType || 'UNIT') as 'UNIT' | 'MASTER';
      if (selectedTypeFilter !== 'ALL' && uType !== selectedTypeFilter) {
        return false;
      }

      // Lọc theo từ khóa tìm kiếm
      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        const codeMatch = (u.unit_code || '').toLowerCase().includes(term);
        const dispMatch = (u.display_code || '').toLowerCase().includes(term);
        const nameMatch = (u.owner_name || '').toLowerCase().includes(term);
        if (!codeMatch && !dispMatch && !nameMatch) return false;
      }

      return true;
    });
  }, [allUnits, sourceUnit, selectedFloorFilter, selectedTypeFilter, searchTerm]);

  if (!isOpen || !sourceUnit) return null;

  const isSourceMaster = (sourceUnit.unit_type || sourceUnit.unitType) === 'MASTER';
  const sourceShortCode = formatShortUnitDisplay(sourceUnit.unit_code, isSourceMaster ? 'MASTER' : 'UNIT');

  const isTargetMaster = selectedTargetUnit
    ? (selectedTargetUnit.unit_type || selectedTargetUnit.unitType) === 'MASTER'
    : false;
  const targetShortCode = selectedTargetUnit
    ? formatShortUnitDisplay(selectedTargetUnit.unit_code, isTargetMaster ? 'MASTER' : 'UNIT')
    : '';

  const handleConfirmSwap = async () => {
    if (!selectedTargetUnit) {
      setErrorMsg('Vui lòng chọn một vị trí đối ứng để hoán đổi');
      return;
    }

    if (!reason || reason.trim().length < 5) {
      setErrorMsg('Vui lòng nhập lý do hoán đổi (tối thiểu 5 ký tự)');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');

      const res = await api.post<{
        success: boolean;
        message: string;
        data?: { message: string; swapEventCode: string };
      }>(`/parcels/${parcelId}/units/swap-cad-geometry`, {
        unitAId: sourceUnit.id,
        unitBId: selectedTargetUnit.id,
        reason: reason.trim(),
      });

      if (!res.data?.success) {
        throw new Error(res.data?.message || 'Server không phản hồi');
      }

      // Kích hoạt hiệu ứng thành công
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
        });
      } catch {
        // Safe confetti fallback
      }

      alert(
        `✅ Hoán đổi tọa độ CAD thành công!\n\n` +
          `• Vị trí 1: ${sourceUnit.unit_code} (${sourceUnit.display_code || '---'})\n` +
          `• Vị trí 2: ${selectedTargetUnit.unit_code} (${selectedTargetUnit.display_code || '---'})\n\n` +
          `Toàn bộ hồ sơ khảo sát, ảnh chụp và watermark được bảo toàn nguyên vẹn.`
      );

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: unknown) {
      console.error('[UnitCadSpatialSwapModal] Swap error:', err);
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* 1. Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <ArrowRightLeft size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white">
                  Hoán Đổi Tọa Độ Ô CAD (Spatial Geometry Swap)
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-mono text-[10px] font-bold border border-teal-500/30">
                  {projectParcelCode || 'CHUNG CƯ'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Bảo toàn 100% mã định danh, hồ sơ và watermark ảnh • Chỉ tráo đổi tọa độ ô vẽ CAD
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* 2. Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Banner nguyên tắc an toàn pháp lý */}
          <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200 text-teal-900 text-xs flex items-start gap-3 shadow-2xs">
            <ShieldCheck size={20} className="text-teal-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="font-extrabold text-teal-950">
                Nguyên tắc bất biến bảo vệ hồ sơ khảo sát:
              </strong>
              <p className="text-slate-600 leading-relaxed">
                Hệ thống <strong>tuyệt đối không đổi mã căn</strong> hay mã khu vực nhằm tránh làm sai lệch mã ảnh watermark, biên bản cư dân và mã khuyết tật. Hai vị trí sẽ <strong>tráo đổi tọa độ ô Polygon trên bản vẽ CAD cho nhau</strong> để đưa hồ sơ về đúng thực địa.
              </p>
            </div>
          </div>

          {/* Sơ đồ so sánh đối chiếu 2 chiều */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Thẻ Vị trí Gốc (Unit A) */}
            <div className="p-4 rounded-2xl border-2 border-teal-500/60 bg-teal-50/30 flex flex-col gap-3 relative">
              <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-600 text-white shadow-2xs">
                Vị trí 1 (Đang chọn)
              </span>

              <div className="flex items-center gap-2.5">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs ${
                    isSourceMaster ? 'bg-indigo-600' : 'bg-teal-600'
                  }`}
                >
                  {isSourceMaster ? <Building2 size={20} /> : <Home size={20} />}
                </div>
                <div className="min-w-0">
                  <h4 className="text-base font-black text-slate-900 truncate">
                    {isSourceMaster ? `Khu ${sourceShortCode}` : `Căn ${sourceShortCode}`}
                  </h4>
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-500 mt-0.5">
                    <span>Mã CSDL: {sourceUnit.unit_code}</span>
                    <span>•</span>
                    <span>Tầng {sourceUnit.floor_number ?? 1}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200">
                <div>
                  <span className="text-slate-500 block text-[11px]">Biển số / Tên:</span>
                  <strong className="text-slate-900 font-semibold truncate block">
                    {sourceUnit.display_code || '---'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Trạng thái:</span>
                  <span className="font-bold text-slate-700">{sourceUnit.status || 'Chưa KS'}</span>
                </div>
              </div>

              {sourceUnit.unit_cad_url ? (
                <div className="mt-1 rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-900 relative">
                  <img
                    src={sourceUnit.unit_cad_url}
                    alt={sourceUnit.unit_code}
                    className="w-full h-full object-contain"
                  />
                  <span className="absolute bottom-1 right-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/70 text-white">
                    CAD Hiện Tại
                  </span>
                </div>
              ) : (
                <div className="mt-1 p-3 rounded-xl border border-dashed border-slate-300 text-center text-slate-400 text-xs">
                  Chưa có ảnh trích xuất CAD
                </div>
              )}
            </div>

            {/* Thẻ Vị trí Đối ứng (Unit B) */}
            <div
              className={`p-4 rounded-2xl border-2 flex flex-col gap-3 relative transition-all ${
                selectedTargetUnit
                  ? 'border-indigo-500/60 bg-indigo-50/30'
                  : 'border-dashed border-slate-300 bg-slate-50/50 justify-center items-center'
              }`}
            >
              {selectedTargetUnit ? (
                <>
                  <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white shadow-2xs">
                    Vị trí 2 (Đối ứng)
                  </span>

                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs ${
                        isTargetMaster ? 'bg-indigo-600' : 'bg-teal-600'
                      }`}
                    >
                      {isTargetMaster ? <Building2 size={20} /> : <Home size={20} />}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-base font-black text-slate-900 truncate">
                        {isTargetMaster ? `Khu ${targetShortCode}` : `Căn ${targetShortCode}`}
                      </h4>
                      <div className="flex items-center gap-2 text-xs font-mono text-slate-500 mt-0.5">
                        <span>Mã CSDL: {selectedTargetUnit.unit_code}</span>
                        <span>•</span>
                        <span>Tầng {selectedTargetUnit.floor_number ?? 1}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Biển số / Tên:</span>
                      <strong className="text-slate-900 font-semibold truncate block">
                        {selectedTargetUnit.display_code || '---'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Trạng thái:</span>
                      <span className="font-bold text-slate-700">
                        {selectedTargetUnit.status || 'Chưa KS'}
                      </span>
                    </div>
                  </div>

                  {selectedTargetUnit.unit_cad_url ? (
                    <div className="mt-1 rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-900 relative">
                      <img
                        src={selectedTargetUnit.unit_cad_url}
                        alt={selectedTargetUnit.unit_code}
                        className="w-full h-full object-contain"
                      />
                      <span className="absolute bottom-1 right-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/70 text-white">
                        CAD Hiện Tại
                      </span>
                    </div>
                  ) : (
                    <div className="mt-1 p-3 rounded-xl border border-dashed border-slate-300 text-center text-slate-400 text-xs">
                      Chưa có ảnh trích xuất CAD
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center p-6 text-slate-400 text-xs flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                    <ArrowRightLeft size={20} />
                  </div>
                  <span className="font-bold text-slate-600">Chưa chọn vị trí đối ứng</span>
                  <span className="text-[11px]">Vui lòng chọn 1 căn hộ hoặc khu vực ở danh sách bên dưới</span>
                </div>
              )}
            </div>
          </div>

          {/* 3. Danh sách chọn vị trí đối ứng */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <Layers size={14} className="text-teal-600" />
                <span>Chọn căn hộ hoặc khu vực muốn hoán đổi:</span>
              </span>

              {/* Bộ lọc Tầng & Loại */}
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={selectedFloorFilter}
                  onChange={(e) =>
                    setSelectedFloorFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))
                  }
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
                >
                  <option value="ALL">Tất cả tầng</option>
                  {availableFloors.map((fl) => (
                    <option key={fl} value={fl}>
                      Tầng {fl} {sourceUnit.floor_number === fl ? '(Cùng tầng)' : ''}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedTypeFilter}
                  onChange={(e) =>
                    setSelectedTypeFilter(e.target.value as 'ALL' | 'UNIT' | 'MASTER')
                  }
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
                >
                  <option value="ALL">Tất cả loại</option>
                  <option value="UNIT">Chỉ Căn Hộ</option>
                  <option value="MASTER">Chỉ Khu Master</option>
                </select>

                <div className="relative flex-1 sm:w-48">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm mã hoặc số phòng..."
                    className="w-full pl-7 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>

            {/* Danh sách ứng viên */}
            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-2xl p-2 bg-slate-50/50 space-y-1.5">
              {isLoadingUnits ? (
                <div className="p-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin text-teal-600" />
                  <span>Đang tải danh sách các vị trí...</span>
                </div>
              ) : candidateUnits.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  Không tìm thấy vị trí nào phù hợp với bộ lọc hiện tại.
                </div>
              ) : (
                candidateUnits.map((u) => {
                  const isSelected = selectedTargetUnit?.id === u.id;
                  const isMasterItem = (u.unit_type || u.unitType) === 'MASTER';
                  const shortDisp = formatShortUnitDisplay(u.unit_code, isMasterItem ? 'MASTER' : 'UNIT');

                  return (
                    <div
                      key={u.id}
                      onClick={() => setSelectedTargetUnit(u)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50/80 ring-2 ring-indigo-400/40 shadow-xs'
                          : 'border-slate-200 bg-white hover:bg-slate-100/80 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 text-xs ${
                            isMasterItem ? 'bg-indigo-600' : 'bg-teal-600'
                          }`}
                        >
                          {isMasterItem ? <Building2 size={14} /> : <Home size={14} />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-xs text-slate-900 truncate">
                              {isMasterItem ? `Khu ${shortDisp}` : `Căn ${shortDisp}`}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                              {u.unit_code}
                            </span>
                            <span className="text-[10px] text-slate-500 font-semibold">
                              Tầng {u.floor_number ?? 1}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 truncate block">
                            Biển số/Tên: <strong>{u.display_code || '---'}</strong>
                            {u.owner_name ? ` • Chủ: ${u.owner_name}` : ''}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            u.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : u.status === 'SUBMITTED'
                              ? 'bg-sky-100 text-sky-800'
                              : u.status === 'IN_PROGRESS'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {u.status || 'Chưa KS'}
                        </span>
                        {isSelected && <CheckCircle2 size={16} className="text-indigo-600 shrink-0" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Ô nhập lý do hoán đổi */}
          <div className="space-y-1.5 pt-2 border-t border-slate-200">
            <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>Lý do hoán đổi tọa độ CAD (Bắt buộc):</span>
              <span className="text-[11px] font-normal text-slate-400">Ghi vết vào Nhật Ký Kiểm Toán</span>
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: KSV ấn nhầm vị trí căn hộ khi khảo sát thực địa..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all resize-none"
            />
          </div>

          {/* Lỗi hiển thị nếu có */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* 4. Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
          >
            Hủy Bỏ
          </button>

          <button
            type="button"
            disabled={!selectedTargetUnit || isSubmitting || reason.trim().length < 5}
            onClick={handleConfirmSwap}
            className="px-5 py-2.5 rounded-xl text-xs font-extrabold text-white bg-teal-600 hover:bg-teal-700 shadow-sm transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-98"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Đang hoán đổi tọa độ...</span>
              </>
            ) : (
              <>
                <ArrowRightLeft size={14} />
                <span>Xác Nhận Hoán Đổi Tọa Độ CAD</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
