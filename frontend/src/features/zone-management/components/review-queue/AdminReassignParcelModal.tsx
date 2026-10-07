import React, { useState, useMemo, useEffect } from 'react';
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
} from 'lucide-react';
import { api } from '../../../../services/api';
import { AdminSecurityChallengeConfirm } from './AdminSecurityChallengeConfirm';

interface Props {
  isOpen: boolean;
  reportId: string;
  currentParcelCode: string;
  currentParcelId?: string;
  currentHouseNumber?: string;
  currentStreet?: string;
  surveyorName?: string;
  allReports?: Array<{
    report_id: string | null;
    parcel_id: string;
    project_parcel_code: string;
    house_number: string;
    street: string;
    surveyor_name: string | null;
  }>;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const AdminReassignParcelModal: React.FC<Props> = ({
  isOpen,
  reportId,
  currentParcelCode,
  currentParcelId,
  currentHouseNumber,
  currentStreet,
  surveyorName,
  allReports = [],
  onClose,
  onSuccess,
}) => {
  const [activeMode, setActiveMode] = useState<'REASSIGN' | 'SWAP'>('REASSIGN');
  const [targetParcelCodeOrId, setTargetParcelCodeOrId] = useState('');
  const [selectedReportBId, setSelectedReportBId] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [fetchedReports, setFetchedReports] = useState<any[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isReassignChallengeValid, setIsReassignChallengeValid] = useState(false);
  const [isSwapChallengeValid, setIsSwapChallengeValid] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const fetchSwapCandidates = async () => {
      setIsLoadingReports(true);
      try {
        const res = await api.get('/admin/reports/swap-candidates', {
          params: {
            excludeReportId: reportId,
            search: searchFilter.trim() || undefined,
          },
        });
        if (res.data?.success && Array.isArray(res.data.data)) {
          setFetchedReports(res.data.data);
        }
      } catch (err) {
        console.error('[AdminReassignParcelModal] Error fetching swap candidates:', err);
      } finally {
        setIsLoadingReports(false);
      }
    };
    fetchSwapCandidates();
  }, [isOpen, reportId, searchFilter]);

  // Hợp nhất danh sách từ props allReports và danh sách fetch từ API
  const candidatePool = useMemo(() => {
    const map = new Map<string, any>();
    (allReports || []).forEach((r) => {
      if (r.report_id && r.report_id !== reportId) {
        map.set(r.report_id, r);
      }
    });
    fetchedReports.forEach((fr) => {
      if (fr.report_id && fr.report_id !== reportId) {
        map.set(fr.report_id, {
          report_id: fr.report_id,
          parcel_id: fr.parcel_id,
          project_parcel_code: fr.project_parcel_code,
          house_number: fr.house_number,
          street: fr.street,
          surveyor_name: fr.surveyor_name,
        });
      }
    });
    return Array.from(map.values());
  }, [allReports, fetchedReports, reportId]);

  // Tìm report B được chọn trong chế độ SWAP
  const selectedReportB = candidatePool.find(
    (r) => r.report_id === selectedReportBId
  );

  // Danh sách gợi ý thửa đất đích khi gõ trong chế độ REASSIGN
  const targetSuggestions = useMemo(() => {
    const raw = targetParcelCodeOrId.replace(/[\[\]"'\\]/g, '').trim().toLowerCase();
    if (!raw && !isInputFocused) return [];
    let list = candidatePool;
    if (raw) {
      list = candidatePool.filter((c) => {
        const code = (c.project_parcel_code || '').toLowerCase();
        const house = (c.house_number || '').toLowerCase();
        const street = (c.street || '').toLowerCase();
        return code.includes(raw) || house.includes(raw) || street.includes(raw);
      });
    }
    return list.slice(0, 8);
  }, [candidatePool, targetParcelCodeOrId, isInputFocused]);

  // Danh sách ứng viên cho chế độ SWAP sau khi lọc tìm kiếm
  const swapFilteredCandidates = useMemo(() => {
    const raw = searchFilter.trim().toLowerCase();
    if (!raw) return candidatePool;
    return candidatePool.filter((c) => {
      const code = (c.project_parcel_code || '').toLowerCase();
      const house = (c.house_number || '').toLowerCase();
      const street = (c.street || '').toLowerCase();
      const surveyor = (c.surveyor_name || '').toLowerCase();
      return (
        code.includes(raw) ||
        house.includes(raw) ||
        street.includes(raw) ||
        surveyor.includes(raw)
      );
    });
  }, [candidatePool, searchFilter]);

  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedTarget = targetParcelCodeOrId.replace(/[\[\]"'\\]/g, '').trim();
    if (!cleanedTarget) {
      setErrorMsg('Vui lòng nhập mã thửa đất đích hoặc ID thửa đất cần gán.');
      return;
    }
    if (!reason.trim()) {
      setErrorMsg('Vui lòng nhập lý do điều chuyển thửa để ghi nhận vào nhật ký kiểm toán.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const res = await api.post(`/admin/reports/${reportId}/reassign-parcel`, {
        targetParcelId: cleanedTarget,
        reason: reason.trim(),
      });

      if (res.data?.success) {
        onSuccess(res.data.message || 'Đã điều chuyển hồ sơ sang thửa đất mới thành công');
        onClose();
      } else {
        setErrorMsg(res.data?.message || 'Không thể điều chuyển thửa đất');
      }
    } catch (err: any) {
      console.error('[AdminReassignParcelModal] Reassign error:', err);
      setErrorMsg(
        err.response?.data?.message ||
        err.response?.data?.detail ||
        'Lỗi điều chuyển thửa đất. Vui lòng kiểm tra lại mã thửa đích.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSwapSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReportBId) {
      setErrorMsg('Vui lòng chọn hồ sơ B cần hoán đổi thửa.');
      return;
    }
    if (!reason.trim()) {
      setErrorMsg('Vui lòng nhập lý do hoán đổi để lưu vết nhật ký kiểm toán.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const res = await api.post('/admin/reports/swap-parcels', {
        reportAId: reportId,
        reportBId: selectedReportBId,
        reason: reason.trim(),
      });

      if (res.data?.success) {
        onSuccess(res.data.message || 'Đã hoán đổi 2 thửa đất thành công');
        onClose();
      } else {
        setErrorMsg(res.data?.message || 'Không thể hoán đổi thửa đất');
      }
    } catch (err: any) {
      console.error('[AdminReassignParcelModal] Swap error:', err);
      setErrorMsg(
        err.response?.data?.message ||
        err.response?.data?.detail ||
        'Lỗi hoán đổi thửa đất. Vui lòng kiểm tra lại trạng thái 2 hồ sơ.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
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

        {/* Tab switch */}
        <div className="flex border-b border-slate-200 bg-slate-100/60 p-1">
          <button
            type="button"
            onClick={() => {
              setActiveMode('REASSIGN');
              setErrorMsg('');
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

        {/* Form Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Card Hồ Sơ Hiện Tại (Report A) */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Hồ Sơ Đang Chọn (Hồ Sơ A)
            </span>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-black text-sky-700 font-mono">
                  [{currentParcelCode}]
                </span>
                <span className="text-xs font-bold text-slate-700 ml-2">
                  {currentHouseNumber ? `Số ${currentHouseNumber}` : ''} {currentStreet || ''}
                </span>
              </div>
              <span className="text-[11px] text-slate-500">
                KSV: {surveyorName || '---'}
              </span>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Mode 1: REASSIGN */}
          {activeMode === 'REASSIGN' && (
            <form onSubmit={handleReassignSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Nhập Mã Dự Án Hoặc UUID Thửa Đích (Target Parcel):
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: B-0042 hoặc paste UUID thửa đất..."
                    value={targetParcelCodeOrId}
                    onFocus={() => setIsInputFocused(true)}
                    onChange={(e) => {
                      setTargetParcelCodeOrId(e.target.value);
                      setIsInputFocused(true);
                    }}
                    className="w-full pl-3 pr-8 py-2 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden uppercase"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                </div>
                {isInputFocused && targetSuggestions.length > 0 && (
                  <div className="p-1 rounded-xl bg-white border border-slate-300 shadow-xl space-y-1 max-h-56 overflow-y-auto">
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
                        key={item.report_id || item.parcel_id}
                        type="button"
                        onClick={() => {
                          setTargetParcelCodeOrId(item.project_parcel_code);
                          setIsInputFocused(false);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-sky-50 transition-colors flex items-center justify-between cursor-pointer border border-transparent hover:border-sky-200"
                      >
                        <span className="font-bold text-sky-800 font-mono">
                          [{item.project_parcel_code}]
                        </span>
                        <span className="text-[11px] text-slate-600 truncate ml-2">
                          {item.house_number ? `Số ${item.house_number}` : ''} {item.street || ''}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="p-2.5 rounded-lg bg-sky-50 border border-sky-100 text-[11px] text-sky-900 space-y-1">
                  <p className="font-semibold">
                    ✓ Cơ chế Hoán Đổi Ranh Không Gian (Spatial Geometry Swap):
                  </p>
                  <p className="text-slate-600">
                    Đa giác ranh thửa và toạ độ trên GIS sẽ được tráo đổi giữa thửa hiện tại [{currentParcelCode}] và thửa đích. Toàn bộ thông tin địa chính, hồ sơ khảo sát và watermark ảnh mang mã [{currentParcelCode}] được <strong>bảo toàn nguyên vẹn 100%</strong>, không bị xáo trộn mã ảnh.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Lý Do Điều Chuyển Ranh Đất (Audit Log):
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

              {/* Mã bảo mật 6 số bắt buộc */}
              <AdminSecurityChallengeConfirm
                actionDescription={`hoán đổi vị trí ranh đất GIS của thửa [${currentParcelCode}] sang thửa mới`}
                onValidityChange={(isValid) => setIsReassignChallengeValid(isValid)}
              />

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !isReassignChallengeValid}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-700 text-white shadow-md shadow-sky-600/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Đang cập nhật...' : 'Xác Nhận Đổi Vị Trí Ranh Đất'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Mode 2: SWAP */}
          {activeMode === 'SWAP' && (
            <form onSubmit={handleSwapSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 block">
                    Chọn Hồ Sơ B Để Hoán Đổi Chéo:
                  </label>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {isLoadingReports ? 'Đang tìm kiếm...' : `${candidatePool.length} hồ sơ khả dụng`}
                  </span>
                </div>

                {/* Ô tìm kiếm nhanh cho SWAP */}
                <div className="relative mb-1">
                  <input
                    type="text"
                    placeholder="Tìm theo mã thửa, số nhà để lọc danh sách..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="w-full pl-3 pr-8 py-1.5 text-xs text-slate-800 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2" />
                </div>

                {/* DANH SÁCH THẺ GỢI Ý THÔNG MINH (THAY THẾ SELECT HOA MẮT) */}
                <div className="p-1 rounded-xl bg-slate-50 border border-slate-200 max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
                  {swapFilteredCandidates.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-500">
                      {isLoadingReports
                        ? 'Đang tải danh sách hồ sơ...'
                        : 'Không tìm thấy hồ sơ nào phù hợp với bộ lọc tìm kiếm.'}
                    </div>
                  ) : (
                    swapFilteredCandidates.map((r) => {
                      const isSelected = selectedReportBId === r.report_id;
                      return (
                        <button
                          key={r.report_id}
                          type="button"
                          onClick={() => setSelectedReportBId(r.report_id)}
                          className={`w-full text-left p-2 rounded-lg text-xs transition-all flex items-center justify-between cursor-pointer border ${
                            isSelected
                              ? 'bg-amber-50 border-amber-300 shadow-xs'
                              : 'bg-white hover:bg-slate-100 border-slate-200/80 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`font-mono font-bold ${isSelected ? 'text-amber-900' : 'text-slate-800'}`}>
                              [{r.project_parcel_code}]
                            </span>
                            <span className="text-[11px] text-slate-600 truncate max-w-[220px]">
                              {r.house_number ? `Số ${r.house_number}` : ''} {r.street || ''}
                            </span>
                            {r.surveyor_name && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-slate-100 text-slate-600">
                                KSV: {r.surveyor_name}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
                {candidatePool.length === 0 && !isLoadingReports && (
                  <p className="text-[11px] text-amber-700 mt-1">
                    Chưa tìm thấy hồ sơ nào khác trong phân khu. Bạn có thể xóa bộ lọc tìm kiếm để xem tất cả.
                  </p>
                )}
              </div>

              {/* Sơ đồ hoán đổi trực quan */}
              {selectedReportB && (
                <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
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
                      <span className="text-[10px] text-slate-400 block font-bold">THỬA [{currentParcelCode}]:</span>
                      <span className="text-[11px] text-slate-600 block">
                        → Nhận vị trí ranh GIS của <strong className="text-amber-800">[{selectedReportB.project_parcel_code}]</strong>
                      </span>
                      <span className="text-[10px] text-emerald-700 block font-medium">
                        ✓ Giữ nguyên mã [{currentParcelCode}] & watermark ảnh
                      </span>
                    </div>
                    <div className="p-2.5 bg-white rounded-lg border border-amber-200 space-y-1">
                      <span className="text-[10px] text-slate-400 block font-bold">THỬA [{selectedReportB.project_parcel_code}]:</span>
                      <span className="text-[11px] text-slate-600 block">
                        → Nhận vị trí ranh GIS của <strong className="text-amber-800">[{currentParcelCode}]</strong>
                      </span>
                      <span className="text-[10px] text-emerald-700 block font-medium">
                        ✓ Giữ nguyên mã [{selectedReportB.project_parcel_code}] & watermark ảnh
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Lý Do Hoán Đổi Ranh Đất (Audit Log):
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Ví dụ: KSV khảo sát hai nhà liền vách nhưng tích chéo ranh đất trên GIS. Cần hoán đổi lại đúng vị trí thực tế."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full p-2.5 text-xs text-slate-800 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              {/* Mã bảo mật 6 số bắt buộc */}
              <AdminSecurityChallengeConfirm
                actionDescription={`hoán đổi ranh đất không gian giữa 2 thửa [${currentParcelCode}] và [${selectedReportB?.project_parcel_code || 'được chọn'}]`}
                onValidityChange={(isValid) => setIsSwapChallengeValid(isValid)}
              />

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedReportBId || !isSwapChallengeValid}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Đang hoán đổi...' : 'Xác Nhận Hoán Đổi Ranh GIS'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
