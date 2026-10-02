import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Split,
  Merge,
  AlertTriangle,
  CheckCircle2,
  Building,
  Home,
  Plus,
  Trash2,
  Search,
  Loader2,
} from 'lucide-react';
import { api } from '../../../../services/api';
import { AdminSecurityChallengeConfirm } from './AdminSecurityChallengeConfirm';

interface Props {
  isOpen: boolean;
  parcelId: string;
  parcelCode: string;
  houseNumber?: string;
  street?: string;
  currentAreaM2?: number;
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
}

export const AdminGisMutationModal: React.FC<Props> = ({
  isOpen,
  parcelId,
  parcelCode,
  houseNumber = '',
  street = '',
  currentAreaM2 = 0,
  reportId,
  onClose,
  onSuccess,
}) => {
  const [mutationType, setMutationType] = useState<'SPLIT' | 'MERGE'>('SPLIT');
  const [adminNotes, setAdminNotes] = useState('');
  const [transferReportToChild1, setTransferReportToChild1] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isChallengeValid, setIsChallengeValid] = useState(false);

  // Dành cho gộp thửa (MERGE)
  const [adjacentCandidates, setAdjacentCandidates] = useState<AdjacentCandidate[]>([]);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [isLoadingAdjacent, setIsLoadingAdjacent] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

  // Default 2 child parcels for SPLIT
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

  // Tải danh sách thửa liền kề khi mở modal hoặc chọn tab MERGE
  useEffect(() => {
    if (!isOpen || !parcelId) return;
    const fetchAdjacent = async () => {
      setIsLoadingAdjacent(true);
      try {
        const res = await api.get(`/admin/parcels/${parcelId}/adjacent-candidates`);
        if (res.data?.success && res.data.data?.candidates) {
          setAdjacentCandidates(res.data.data.candidates);
        }
      } catch (err) {
        console.error('[AdminGisMutationModal] Error fetching adjacent candidates:', err);
      } finally {
        setIsLoadingAdjacent(false);
      }
    };
    fetchAdjacent();
  }, [isOpen, parcelId]);

  if (!isOpen) return null;

  const handleToggleCandidate = (id: string) => {
    setSelectedCandidateIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectedAdjacentParcels = useMemo(() => {
    return adjacentCandidates.filter((c) => selectedCandidateIds.includes(c.id));
  }, [adjacentCandidates, selectedCandidateIds]);

  const totalMergedArea = useMemo(() => {
    const adjacentTotal = selectedAdjacentParcels.reduce(
      (sum, c) => sum + (Number(c.land_area_m2) || 0),
      0
    );
    return Math.round(((Number(currentAreaM2) || 0) + adjacentTotal) * 10) / 10;
  }, [currentAreaM2, selectedAdjacentParcels]);

  const handleAddChild = () => {
    const nextChar = String.fromCharCode(65 + childParcels.length); // C, D, ...
    setChildParcels((prev) => [
      ...prev,
      {
        houseNumber: houseNumber ? `${houseNumber}${nextChar}` : `Căn ${nextChar}`,
        ownerName: '',
        ownerPhone: '',
        landAreaM2: 50,
        floorCount: 1,
      },
    ]);
  };

  const handleRemoveChild = (index: number) => {
    if (childParcels.length <= 2) return;
    setChildParcels((prev) => prev.filter((_, i) => i !== index));
  };

  const handleChildChange = (index: number, field: keyof ChildParcelInput, val: any) => {
    setChildParcels((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: val } : c))
    );
  };

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
        setErrorMsg('Vui lòng chọn ít nhất một thửa đất liền kề để gộp vào thửa hiện tại.');
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
              childParcels: childParcels.map((c) => ({
                houseNumber: c.houseNumber,
                street: street,
                ownerName: c.ownerName,
                ownerPhone: c.ownerPhone,
                landAreaM2: Number(c.landAreaM2) || 0,
                floorCount: Number(c.floorCount) || 1,
              })),
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
        setErrorMsg(res.data?.message || 'Không thể thực thi biến động thửa');
      }
    } catch (err: any) {
      console.error('[AdminGisMutationModal] Error:', err);
      setErrorMsg(
        err.response?.data?.message ||
        err.response?.data?.detail ||
        'Lỗi thực thi biến động thửa đất trên GIS.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-100 text-sky-800">
              <Split className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800">
                Tách / Gộp Thửa Đất GIS (Zone Admin)
              </h3>
              <p className="text-xs text-slate-500">
                Thực thi biến động trực tiếp trên GIS khi KSV không rành thao tác hiện trường
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

        {/* Thửa Nguồn Card */}
        <div className="p-4 bg-sky-50/70 border-b border-sky-100 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider block">
              Thửa Đất Gốc Cần Biến Động
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono font-black text-sm text-sky-900">[{parcelCode}]</span>
              <span className="text-xs font-semibold text-slate-700">
                {houseNumber ? `Số ${houseNumber}` : ''} {street || ''}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 block">Diện tích hiện trạng</span>
            <span className="font-bold text-xs text-slate-800 font-mono">
              {currentAreaM2 ? `${currentAreaM2} m²` : '---'}
            </span>
          </div>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Loại biến động */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">Loại Hình Biến Động:</label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`p-3 rounded-xl border-2 flex items-center gap-2.5 cursor-pointer text-xs font-bold transition-all ${
                  mutationType === 'SPLIT'
                    ? 'border-sky-500 bg-sky-50 text-sky-900 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="mutType"
                  checked={mutationType === 'SPLIT'}
                  onChange={() => {
                    setMutationType('SPLIT');
                    setErrorMsg('');
                  }}
                  className="text-sky-600 focus:ring-sky-500"
                />
                <Split className="w-4 h-4 text-sky-600" />
                <span>1. Tách Thửa Thực Địa (Căn A / B)</span>
              </label>

              <label
                className={`p-3 rounded-xl border-2 flex items-center gap-2.5 cursor-pointer text-xs font-bold transition-all ${
                  mutationType === 'MERGE'
                    ? 'border-sky-500 bg-sky-50 text-sky-900 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="mutType"
                  checked={mutationType === 'MERGE'}
                  onChange={() => {
                    setMutationType('MERGE');
                    setErrorMsg('');
                  }}
                  className="text-sky-600 focus:ring-sky-500"
                />
                <Merge className="w-4 h-4 text-sky-600" />
                <span>2. Gộp Thửa Thực Địa (Khuôn viên chung)</span>
              </label>
            </div>
          </div>

          {/* NHÁNH 1: GỘP THỬA (MERGE) */}
          {mutationType === 'MERGE' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 block">
                  Chọn Các Thửa Đất Liền Kề Để Gộp (Đã chọn {selectedCandidateIds.length} thửa):
                </label>
                <span className="text-[11px] font-semibold text-slate-500">
                  {isLoadingAdjacent ? 'Đang dò quét...' : `${adjacentCandidates.length} thửa lân cận`}
                </span>
              </div>

              {/* Ô tìm kiếm nhanh */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Tìm theo mã thửa, số nhà liền kề..."
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  className="w-full pl-3 pr-8 py-1.5 text-xs text-slate-800 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2" />
              </div>

              {/* Danh sách multi-select */}
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1 border border-slate-200 rounded-xl p-2 bg-slate-50/50">
                {isLoadingAdjacent && (
                  <div className="py-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
                    <span>Đang quét các thửa đất liền kề trong phân khu...</span>
                  </div>
                )}
                {!isLoadingAdjacent && adjacentCandidates.length === 0 && (
                  <div className="py-6 text-center text-xs text-slate-400">
                    Không tìm thấy thửa đất nào khác trong cùng phân khu.
                  </div>
                )}
                {!isLoadingAdjacent &&
                  adjacentCandidates
                    .filter((c) => {
                      if (!filterQuery.trim()) return true;
                      const q = filterQuery.toLowerCase();
                      return (
                        c.project_parcel_code.toLowerCase().includes(q) ||
                        (c.house_number && c.house_number.toLowerCase().includes(q)) ||
                        (c.owner_name && c.owner_name.toLowerCase().includes(q))
                      );
                    })
                    .map((c) => {
                      const isSelected = selectedCandidateIds.includes(c.id);
                      return (
                        <div
                          key={c.id}
                          onClick={() => handleToggleCandidate(c.id)}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'bg-sky-50/90 border-sky-400 shadow-xs'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-black text-xs text-sky-900">
                                  [{c.project_parcel_code}]
                                </span>
                                <span className="text-xs font-semibold text-slate-700">
                                  {c.house_number ? `Số ${c.house_number}` : ''} {c.street || ''}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-500 block">
                                Chủ hộ: {c.owner_name || 'Chưa khảo sát'} | Khoảng cách ranh: ~{c.distance_meters}m
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-bold font-mono text-slate-800 block">
                              {c.land_area_m2} m²
                            </span>
                            <span className="text-[9px] uppercase font-bold text-slate-400">
                              {c.survey_status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
              </div>

              {/* Tóm tắt khuôn viên gộp */}
              {selectedCandidateIds.length > 0 && (
                <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-sky-900">
                      Thửa đại diện (giữ mã chính):
                    </span>
                    <span className="font-mono font-black text-sky-800">
                      [{parcelCode}]
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-sky-900">
                      Tổng diện tích khuôn viên mới (ST_Union):
                    </span>
                    <span className="font-mono font-black text-emerald-700 text-sm">
                      {totalMergedArea} m²
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 border-t border-sky-100 pt-1.5">
                    {selectedCandidateIds.length} thửa phụ (
                    {selectedAdjacentParcels.map((p) => `[${p.project_parcel_code}]`).join(', ')}
                    ) sẽ được chuyển sang trạng thái MERGED_DEPRECATED và gộp ranh vào thửa [{parcelCode}].
                  </p>
                </div>
              )}
            </div>
          )}

          {/* NHÁNH 2: TÁCH THỬA (SPLIT) */}
          {mutationType === 'SPLIT' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 block">
                  Danh Sách Thửa Con Phát Sinh Sau Tách ({childParcels.length} thửa):
                </label>
                <button
                  type="button"
                  onClick={handleAddChild}
                  className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm thửa con</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {childParcels.map((child, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-5 gap-2.5 items-end text-xs"
                  >
                    <div className="sm:col-span-1">
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        Số nhà con:
                      </label>
                      <input
                        type="text"
                        value={child.houseNumber}
                        onChange={(e) => handleChildChange(idx, 'houseNumber', e.target.value)}
                        className="w-full p-1.5 bg-white border border-slate-300 rounded font-bold text-slate-800"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        Chủ sở hữu con:
                      </label>
                      <input
                        type="text"
                        placeholder="Họ tên chủ nhà..."
                        value={child.ownerName}
                        onChange={(e) => handleChildChange(idx, 'ownerName', e.target.value)}
                        className="w-full p-1.5 bg-white border border-slate-300 rounded text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        Diện tích (m²):
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={child.landAreaM2}
                        onChange={(e) => handleChildChange(idx, 'landAreaM2', e.target.value)}
                        className="w-full p-1.5 bg-white border border-slate-300 rounded font-bold font-mono text-slate-800"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">
                          Số tầng:
                        </label>
                        <input
                          type="number"
                          value={child.floorCount}
                          onChange={(e) => handleChildChange(idx, 'floorCount', e.target.value)}
                          className="w-full p-1.5 bg-white border border-slate-300 rounded font-bold font-mono text-slate-800"
                        />
                      </div>
                      {childParcels.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveChild(idx)}
                          className="p-1.5 rounded text-red-500 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                          title="Xóa thửa con này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Checkbox chuyển hồ sơ khảo sát sang Thửa Con 1 */}
              {reportId && (
                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={transferReportToChild1}
                    onChange={(e) => setTransferReportToChild1(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-semibold">
                    Tự động gán biên bản khảo sát hiện tại sang thửa con đầu tiên ({childParcels[0]?.houseNumber || 'Căn A'})
                  </span>
                </label>
              )}
            </div>
          )}

          {/* Lý do biến động */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              Ghi Chú Kỹ Thuật Biến Động (Audit Log):
            </label>
            <textarea
              required
              rows={2}
              placeholder={
                mutationType === 'SPLIT'
                  ? 'Ví dụ: Hiện trường thực tế là nhà chia 2 căn A và B riêng biệt có 2 lối đi và đồng hồ điện riêng. Thực hiện tách thửa GIS và cấp mã tự động.'
                  : 'Ví dụ: Hai thửa đất thực tế chung 1 khuôn viên nhà ở không có ranh giới ngăn cách. Gộp thành 1 thửa thống nhất.'
              }
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              className="w-full p-2.5 text-xs text-slate-800 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
            />
          </div>

          {/* Mã bảo mật 6 số bắt buộc */}
          <AdminSecurityChallengeConfirm
            actionDescription={
              mutationType === 'SPLIT'
                ? `tách thửa [${parcelCode}] thành ${childParcels.length} thửa con độc lập`
                : `gộp thửa [${parcelCode}] với ${selectedCandidateIds.length} thửa đất liền kề`
            }
            onValidityChange={(isValid) => setIsChallengeValid(isValid)}
          />

          {/* Footer buttons */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting ||
                !isChallengeValid ||
                (mutationType === 'MERGE' && selectedCandidateIds.length === 0)
              }
              className="px-4 py-2 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-700 text-white shadow-md shadow-sky-600/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                {isSubmitting
                  ? 'Đang thực thi biến động...'
                  : mutationType === 'SPLIT'
                  ? 'Xác Nhận & Cấp Mã Thửa GIS Mới'
                  : `Xác Nhận Gộp ${selectedCandidateIds.length + 1} Thửa Đất`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
