import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  ArrowRightLeft,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Building,
  Home,
  ShieldAlert,
  Search,
  Loader2,
  MapPin,
  User,
  Sparkles,
  Layers,
} from 'lucide-react';
import { GisParcel } from '../../shared/types';
import { useAuth } from '../../../../context/AuthContext';
import { AdminSecurityChallengeConfirm } from '../../../../features/zone-management/components/review-queue/AdminSecurityChallengeConfirm';

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
  const [activeMode, setActiveMode] = useState<'REASSIGN' | 'SWAP'>('REASSIGN');
  
  // Tab 1 (REASSIGN) state
  const [targetParcelCodeOrId, setTargetParcelCodeOrId] = useState('');
  const [selectedTargetA, setSelectedTargetA] = useState<any | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Tab 2 (SWAP) state
  const [selectedParcelB, setSelectedParcelB] = useState<any | null>(null);
  const [swapSearchFilter, setSwapSearchFilter] = useState('');

  // Candidates & Data
  const [adjacentCandidates, setAdjacentCandidates] = useState<any[]>([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);

  // Common Form State
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isChallengeValid, setIsChallengeValid] = useState(false);

  // Reset when opening
  useEffect(() => {
    if (isOpen && activeParcel) {
      setTargetParcelCodeOrId('');
      setSelectedTargetA(null);
      setSelectedParcelB(null);
      setSwapSearchFilter('');
      setReason('');
      setErrorMsg('');
      setSuccessMsg('');
      setIsChallengeValid(false);
      setIsInputFocused(false);
      fetchAdjacentCandidates(activeParcel.id);
    }
  }, [isOpen, activeParcel]);

  // Fetch adjacent candidates from API
  const fetchAdjacentCandidates = async (parcelId: string) => {
    setIsLoadingCandidates(true);
    try {
      const res = await fetch(`/api/v1/parcels/${parcelId}/adjacent-candidates`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.candidates) {
          setAdjacentCandidates(json.data.candidates);
        }
      }
    } catch (err) {
      console.warn('[CadastralSpatialSwapModal] Lỗi lấy danh sách thửa tiếp giáp:', err);
    } finally {
      setIsLoadingCandidates(false);
    }
  };

  // Pool of all candidate parcels in the same zone
  const candidatePool = useMemo(() => {
    if (!activeParcel) return [];
    const map = new Map<string, any>();

    // 1. Add adjacent candidates first (with touching and distance flags)
    adjacentCandidates.forEach((c) => {
      map.set(c.id, {
        id: c.id,
        project_parcel_code: c.projectParcelCode,
        house_number: c.houseNumber,
        street: c.street,
        owner_name: c.ownerName,
        land_area_m2: c.landAreaM2,
        is_touching: c.isTouching,
        distance_meters: c.distanceMeters,
        is_adjacent: true,
      });
    });

    // 2. Add other parcels from availableParcels in the same zone
    availableParcels.forEach((p) => {
      if (p.id !== activeParcel.id && (!activeParcel.zoneId || p.zoneId === activeParcel.zoneId)) {
        if (!map.has(p.id)) {
          map.set(p.id, {
            id: p.id,
            project_parcel_code: p.projectParcelCode,
            house_number: p.houseNumber,
            street: p.street,
            owner_name: p.ownerName,
            land_area_m2: p.landArea,
            is_touching: false,
            is_adjacent: false,
          });
        }
      }
    });

    return Array.from(map.values());
  }, [activeParcel, adjacentCandidates, availableParcels]);

const stripVietnameseTones = (str: string): string => {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
};

  // Tab 1: Autocomplete suggestions when typing in Target Parcel input
  const targetSuggestions = useMemo(() => {
    const raw = stripVietnameseTones(targetParcelCodeOrId.replace(/[\[\]"'\\]/g, ''));
    if (!raw && !isInputFocused) return [];

    let list = candidatePool;
    if (raw) {
      list = candidatePool.filter((c) => {
        const code = stripVietnameseTones(c.project_parcel_code || '');
        const house = stripVietnameseTones(c.house_number || '');
        const street = stripVietnameseTones(c.street || '');
        const owner = stripVietnameseTones(c.owner_name || '');
        return code.includes(raw) || house.includes(raw) || street.includes(raw) || owner.includes(raw);
      });
    }

    // Sort: touching first, adjacent second, then alphabetical
    return list
      .sort((a, b) => {
        if (a.is_touching && !b.is_touching) return -1;
        if (!a.is_touching && b.is_touching) return 1;
        if (a.is_adjacent && !b.is_adjacent) return -1;
        if (!a.is_adjacent && b.is_adjacent) return 1;
        return (a.project_parcel_code || '').localeCompare(b.project_parcel_code || '');
      })
      .slice(0, 8);
  }, [candidatePool, targetParcelCodeOrId, isInputFocused]);

  // Tab 2: Filtered candidates for adjacent swap (Smart selector)
  const swapFilteredCandidates = useMemo(() => {
    const raw = stripVietnameseTones(swapSearchFilter);
    let list = candidatePool;
    if (raw) {
      list = candidatePool.filter((c) => {
        const code = stripVietnameseTones(c.project_parcel_code || '');
        const house = stripVietnameseTones(c.house_number || '');
        const street = stripVietnameseTones(c.street || '');
        const owner = stripVietnameseTones(c.owner_name || '');
        return code.includes(raw) || house.includes(raw) || street.includes(raw) || owner.includes(raw);
      });
    }

    return list.sort((a, b) => {
      if (a.is_touching && !b.is_touching) return -1;
      if (!a.is_touching && b.is_touching) return 1;
      if (a.is_adjacent && !b.is_adjacent) return -1;
      if (!a.is_adjacent && b.is_adjacent) return 1;
      return (a.project_parcel_code || '').localeCompare(b.project_parcel_code || '');
    });
  }, [candidatePool, swapSearchFilter]);

  if (!isOpen || !activeParcel) return null;

  // Execute swap API call
  const handleExecuteSwap = async (targetParcelId: string) => {
    if (!targetParcelId) {
      setErrorMsg('Vui lòng chọn thửa đất đích cần hoán đổi.');
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
      const res = await fetch('/api/v1/admin/parcels/swap-geometries', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parcelAId: activeParcel.id,
          parcelBId: targetParcelId,
          reason: reason.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || json.detail || `Lỗi hoán đổi thửa đất (${res.status})`);
      }

      setSuccessMsg(json.message || 'Đã hoán đổi vị trí ranh đất GIS thành công!');
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('[CadastralSpatialSwapModal] Swap error:', err);
      setErrorMsg(err.message || 'Lỗi hoán đổi ranh đất GIS. Vui lòng kiểm tra lại 2 thửa đất.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* HEADER (Chuẩn Zone Dashboard) */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800">
                Hoán Đổi Vị Trí Ranh Đất GIS (Zone Admin)
              </h3>
              <p className="text-xs text-slate-500">
                Hoán đổi đa giác GIS — Bảo toàn 100% mã thửa, hồ sơ và watermark trên ảnh
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

        {/* TAB SWITCH (Chuẩn Zone Dashboard) */}
        <div className="flex border-b border-slate-200 bg-slate-100/60 p-1">
          <button
            type="button"
            onClick={() => {
              setActiveMode('REASSIGN');
              setErrorMsg('');
              setIsChallengeValid(false);
            }}
            className={`flex-1 py-2 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeMode === 'REASSIGN'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>1. Đổi Vị Trí Ranh Đến Thửa Đích</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveMode('SWAP');
              setErrorMsg('');
              setIsChallengeValid(false);
            }}
            className={`flex-1 py-2 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeMode === 'SWAP'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>2. Hoán Đổi Ranh 2 Nhà Liền Kề</span>
          </button>
        </div>

        {/* FORM BODY */}
        <div className="p-5 overflow-y-auto space-y-4 custom-scrollbar">
          {/* CARD HỒ SƠ ĐANG CHỌN (HỒ SƠ A) */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Hồ Sơ Đang Chọn (Hồ Sơ A)
            </span>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-black text-sky-700 font-mono">
                  [{activeParcel.projectParcelCode}]
                </span>
                <span className="text-xs font-bold text-slate-700 ml-2">
                  {activeParcel.houseNumber ? `Số ${activeParcel.houseNumber}` : ''} {activeParcel.street || ''}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                Chủ hộ: <strong className="text-slate-700">{activeParcel.ownerName || 'Chưa cập nhật'}</strong>
              </span>
            </div>
            <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 flex items-center justify-between">
              <span>Diện tích đất hiện tại: <strong className="text-slate-700 font-mono">{activeParcel.landArea || 0} m²</strong></span>
              <span className="text-sky-600 font-semibold font-mono">{activeParcel.surveyStatus}</span>
            </div>
          </div>

          {/* BÁO LỖI */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* BÁO THÀNH CÔNG */}
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 1: ĐỔI VỊ TRÍ RANH ĐẾN THỬA ĐÍCH                                    */}
          {/* ========================================================================= */}
          {activeMode === 'REASSIGN' && (
            <div className="space-y-4">
              <div className="space-y-1.5 relative">
                <label className="text-xs font-bold text-slate-700 block">
                  Nhập Mã Dự Án Hoặc UUID Thửa Đích (Target Parcel):
                </label>
                <div className="relative">
                  <input
                    ref={searchInputRef}
                    type="text"
                    required
                    placeholder="Ví dụ: B-0042 hoặc paste UUID thửa đất..."
                    value={targetParcelCodeOrId}
                    onFocus={() => setIsInputFocused(true)}
                    onChange={(e) => {
                      setTargetParcelCodeOrId(e.target.value);
                      setIsInputFocused(true);
                      // Clear selected target if user modifies input
                      if (selectedTargetA && selectedTargetA.project_parcel_code !== e.target.value) {
                        setSelectedTargetA(null);
                      }
                    }}
                    className="w-full pl-3 pr-8 py-2 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden uppercase"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                </div>

                {/* THẺ XÁC NHẬN THỬA ĐÍCH ĐÃ CHỌN (NẾU CÓ) */}
                {selectedTargetA && (
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs animate-in fade-in duration-150">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <span className="font-mono font-bold text-emerald-800">[{selectedTargetA.project_parcel_code}]</span>
                        <span className="text-slate-600 ml-1.5">{selectedTargetA.house_number ? `Số ${selectedTargetA.house_number}` : ''} {selectedTargetA.street}</span>
                        {selectedTargetA.land_area_m2 && (
                          <span className="text-emerald-700 font-mono font-semibold ml-2">({selectedTargetA.land_area_m2} m²)</span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTargetA(null);
                        setTargetParcelCodeOrId('');
                        searchInputRef.current?.focus();
                      }}
                      className="text-[11px] text-slate-500 hover:text-slate-800 font-semibold"
                    >
                      Đổi lại
                    </button>
                  </div>
                )}

                {/* DROPDOWN DANH SÁCH GỢI Ý AUTOCOMPLETE (NHẢY RA TỨC THÌ) */}
                {isInputFocused && !selectedTargetA && targetSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-30 p-1.5 rounded-xl bg-white border border-slate-300 shadow-xl space-y-1 max-h-56 overflow-y-auto custom-scrollbar animate-in fade-in duration-100">
                    <div className="flex items-center justify-between px-2 py-0.5 text-[10px] font-bold text-slate-400 uppercase">
                      <span>Gợi ý thửa đất trong phân khu ({targetSuggestions.length}):</span>
                      <button
                        type="button"
                        onClick={() => setIsInputFocused(false)}
                        className="text-slate-400 hover:text-slate-600 text-[10px]"
                      >
                        Đóng ✕
                      </button>
                    </div>
                    {targetSuggestions.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setTargetParcelCodeOrId(item.project_parcel_code);
                          setSelectedTargetA(item);
                          setIsInputFocused(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-sky-50 transition-colors flex items-center justify-between cursor-pointer border border-transparent hover:border-sky-200 group"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold font-mono text-sky-800 group-hover:text-sky-900">
                            [{item.project_parcel_code}]
                          </span>
                          <span className="text-[11px] text-slate-600 truncate max-w-[240px]">
                            {item.house_number ? `Số ${item.house_number}` : ''} {item.street || ''}
                          </span>
                          {item.is_touching && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                              Tiếp giáp
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] font-mono text-slate-500">{item.land_area_m2 ? `${item.land_area_m2} m²` : ''}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* HỘP CƠ CHẾ HOÁN ĐỔI TRANH KHÔNG GIAN (Chuẩn Zone Dashboard) */}
                <div className="p-3 rounded-xl bg-sky-50 border border-sky-100 text-[11px] text-sky-900 space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-sky-950">
                    <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                    Cơ chế Hoán Đổi Ranh Không Gian (Spatial Geometry Swap):
                  </p>
                  <p className="text-slate-600 leading-relaxed">
                    Đa giác ranh thửa và toạ độ trên GIS sẽ được tráo đổi giữa thửa hiện tại <strong>[{activeParcel.projectParcelCode}]</strong> và thửa đích. Toàn bộ thông tin địa chính, hồ sơ khảo sát và watermark ảnh mang mã [{activeParcel.projectParcelCode}] được <strong>bảo toàn nguyên vẹn 100%</strong>, không bị xáo trộn mã ảnh.
                  </p>
                </div>
              </div>

              {/* LÝ DO ĐIỀU CHUYỂN */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Lý Do Điều Chuyển Ranh Đất (Audit Log) <span className="text-red-500">*</span>:
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Ví dụ: Hiện trường nhà số 125 Trần Não bị KSV tích nhầm vào polygon của thửa 28 bên cạnh. Hoán đổi ranh đất sang đúng thửa 29."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full p-2.5 text-xs text-slate-800 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>

              {/* MÃ BẢO MẬT 6 SỐ BẮT BUỘC */}
              <AdminSecurityChallengeConfirm
                actionDescription={`hoán đổi vị trí ranh đất GIS của thửa [${activeParcel.projectParcelCode}] sang thửa mới`}
                onValidityChange={(isValid) => setIsChallengeValid(isValid)}
              />

              {/* NÚT THAO TÁC */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const targetId = selectedTargetA?.id || candidatePool.find(
                      (c) => c.project_parcel_code?.toLowerCase() === targetParcelCodeOrId.trim().toLowerCase() || c.id === targetParcelCodeOrId.trim()
                    )?.id;
                    handleExecuteSwap(targetId);
                  }}
                  disabled={isSubmitting || !isChallengeValid || (!selectedTargetA && !targetParcelCodeOrId.trim())}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-700 text-white shadow-md shadow-sky-600/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>{isSubmitting ? 'Đang cập nhật...' : 'Xác Nhận Đổi Vị Trí Ranh Đất'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: HOÁN ĐỔI RANH 2 NHÀ LIỀN KỀ (LOẠI BỎ SELECT HOA MẮT)              */}
          {/* ========================================================================= */}
          {activeMode === 'SWAP' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 block">
                    Chọn Thửa B Để Hoán Đổi Chéo Liền Kề:
                  </label>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {isLoadingCandidates ? 'Đang tải thửa liền kề...' : `${candidatePool.length} thửa khả dụng`}
                  </span>
                </div>

                {/* Ô TÌM KIẾM NHANH CHO THỬA B */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Gõ mã thửa (vd: 0053, 0031) hoặc số nhà để lọc danh sách..."
                    value={swapSearchFilter}
                    onChange={(e) => setSwapSearchFilter(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>

                {/* DANH SÁCH THẺ GỢI Ý THÔNG MINH (THAY THẾ SELECT HOA MẮT) */}
                <div className="p-1 rounded-xl bg-slate-50 border border-slate-200 max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
                  {swapFilteredCandidates.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-500">
                      Không tìm thấy thửa đất nào phù hợp với bộ lọc tìm kiếm.
                    </div>
                  ) : (
                    swapFilteredCandidates.map((c) => {
                      const isSelected = selectedParcelB?.id === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedParcelB(c)}
                          className={`w-full text-left p-2 rounded-lg text-xs transition-all flex items-center justify-between cursor-pointer border ${
                            isSelected
                              ? 'bg-amber-50 border-amber-300 shadow-xs'
                              : 'bg-white hover:bg-slate-100 border-slate-200/80 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`font-mono font-bold ${isSelected ? 'text-amber-900' : 'text-slate-800'}`}>
                              [{c.project_parcel_code}]
                            </span>
                            <span className="text-[11px] text-slate-600 truncate max-w-[220px]">
                              {c.house_number ? `Số ${c.house_number}` : ''} {c.street || ''}
                            </span>
                            {c.is_touching && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                🌿 Tiếp giáp ranh
                              </span>
                            )}
                            {!c.is_touching && c.is_adjacent && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-sky-100 text-sky-800">
                                📍 Lân cận ~{c.distance_meters}m
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-slate-500 font-semibold">
                              {c.land_area_m2 ? `${c.land_area_m2} m²` : ''}
                            </span>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* SƠ ĐỒ HOÁN ĐỔI TRỰC QUAN (DIFF DIAGRAM) */}
              {selectedParcelB && (
                <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-900 block">
                      Sơ đồ hoán đổi ranh không gian GIS (Spatial Geometry Swap):
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Bảo toàn 100% Watermark
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 bg-white rounded-lg border border-amber-200 space-y-1">
                      <span className="text-[10px] text-slate-400 block font-bold">THỬA [{activeParcel.projectParcelCode}]:</span>
                      <span className="text-[11px] text-slate-600 block">
                        → Nhận vị trí ranh GIS của <strong className="text-amber-800">[{selectedParcelB.project_parcel_code}]</strong>
                      </span>
                      <span className="text-[10px] text-emerald-700 block font-medium">
                        ✓ Giữ nguyên mã [{activeParcel.projectParcelCode}] & watermark ảnh
                      </span>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-amber-200 space-y-1">
                      <span className="text-[10px] text-slate-400 block font-bold">THỬA [{selectedParcelB.project_parcel_code}]:</span>
                      <span className="text-[11px] text-slate-600 block">
                        → Nhận vị trí ranh GIS của <strong className="text-amber-800">[{activeParcel.projectParcelCode}]</strong>
                      </span>
                      <span className="text-[10px] text-emerald-700 block font-medium">
                        ✓ Giữ nguyên mã [{selectedParcelB.project_parcel_code}] & watermark ảnh
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* LÝ DO HOÁN ĐỔI */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Lý Do Hoán Đổi Liền Kề (Audit Log) <span className="text-red-500">*</span>:
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Ví dụ: Hai nhà liền kề 652A và 652C bị vẽ đảo đa giác cho nhau trên bản đồ, cần hoán đổi ranh để phản ánh đúng hiện trạng..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full p-2.5 text-xs text-slate-800 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              {/* MÃ BẢO MẬT 6 SỐ BẮT BUỘC */}
              <AdminSecurityChallengeConfirm
                actionDescription={`hoán đổi ranh giới không gian giữa 2 thửa [${activeParcel.projectParcelCode}] và [${selectedParcelB?.project_parcel_code || '---'}]`}
                onValidityChange={(isValid) => setIsChallengeValid(isValid)}
              />

              {/* NÚT THAO TÁC */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => handleExecuteSwap(selectedParcelB?.id)}
                  disabled={isSubmitting || !isChallengeValid || !selectedParcelB}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
                  <span>{isSubmitting ? 'Đang xử lý...' : 'Xác Nhận Hoán Đổi 2 Thửa Đất'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
