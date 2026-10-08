import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle2,
  Search,
  Loader2,
  User,
  Info,
} from 'lucide-react';
import { api } from '../../../../services/api';
import { AdminSecurityChallengeConfirm } from './AdminSecurityChallengeConfirm';

export interface SwapCandidateParcel {
  parcel_id: string;
  project_parcel_code: string;
  official_cadastral_code?: string;
  house_number?: string;
  street?: string;
  ward?: string;
  district?: string;
  owner_name?: string;
  owner_phone?: string;
  land_area_m2?: number;
  construction_area_m2?: number;
  survey_status?: string;
  report_id?: string | null;
  report_code?: string | null;
  report_status?: string | null;
  surveyor_name?: string | null;
}

interface Props {
  isOpen: boolean;
  reportId: string;
  currentParcelCode: string;
  currentParcelId?: string;
  currentHouseNumber?: string;
  currentStreet?: string;
  surveyorName?: string;
  zoneId?: string;
  allReports?: any[];
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
  zoneId,
  onClose,
  onSuccess,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTargetParcel, setSelectedTargetParcel] = useState<SwapCandidateParcel | null>(null);
  const [candidates, setCandidates] = useState<SwapCandidateParcel[]>([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isChallengeValid, setIsChallengeValid] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Reset modal state when opening
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setSelectedTargetParcel(null);
      setReason('');
      setErrorMsg('');
      setIsChallengeValid(false);
      setIsDropdownOpen(false);
    }
  }, [isOpen]);

  // Debounced search for candidates across ALL parcels in the zone
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const timer = setTimeout(async () => {
      setIsLoadingCandidates(true);
      try {
        const res = await api.get('/admin/reports/swap-candidates', {
          params: {
            zoneId: zoneId || undefined,
            excludeReportId: reportId,
            excludeParcelId: currentParcelId || undefined,
            search: searchTerm.trim() || undefined,
          },
        });

        if (isMounted && res.data?.success && Array.isArray(res.data.data)) {
          setCandidates(res.data.data);
        }
      } catch (err) {
        console.error('[AdminReassignParcelModal] Error fetching swap candidates:', err);
      } finally {
        if (isMounted) setIsLoadingCandidates(false);
      }
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isOpen, reportId, currentParcelId, zoneId, searchTerm]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTargetParcel) {
      setErrorMsg('Vui lòng tìm và chọn một thửa đất cần hoán đổi ranh giới.');
      return;
    }
    if (!reason.trim() || reason.trim().length < 5) {
      setErrorMsg('Vui lòng nhập lý do hoán đổi ranh đất chi tiết (tối thiểu 5 ký tự) để lưu vết kiểm toán.');
      return;
    }
    if (!isChallengeValid) {
      setErrorMsg('Vui lòng nhập chính xác mã xác nhận bảo mật 6 số trước khi thực hiện.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const res = await api.post('/admin/reports/swap-parcels', {
        reportAId: reportId,
        reportBId: selectedTargetParcel.report_id || undefined,
        targetParcelId: selectedTargetParcel.parcel_id,
        reason: reason.trim(),
      });

      if (res.data?.success) {
        onSuccess(
          res.data.message ||
            `Đã hoán đổi ranh GIS giữa [${currentParcelCode}] và [${selectedTargetParcel.project_parcel_code}] thành công.`
        );
        onClose();
      } else {
        setErrorMsg(res.data?.message || 'Không thể hoán đổi thửa đất');
      }
    } catch (err: any) {
      console.error('[AdminReassignParcelModal] Swap submission error:', err);
      setErrorMsg(
        err.response?.data?.message ||
          err.response?.data?.detail ||
          'Lỗi thực thi hoán đổi ranh đất GIS. Vui lòng kiểm tra lại trạng thái thửa đất.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800">
                Hoán Đổi Vị Trí Ranh Đất GIS (Zone Admin)
              </h3>
              <p className="text-xs text-slate-500">
                Tráo đổi đa giác GIS — Bảo toàn 100% hồ sơ, mã thửa và dấu watermark ảnh
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {/* Card Hồ Sơ Hiện Tại (Report A) */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                1. Hồ Sơ Đang Chọn (Thửa A)
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                Đang thẩm định
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-black text-indigo-700 font-mono">
                  [{currentParcelCode}]
                </span>
                <span className="text-xs font-bold text-slate-700 ml-2">
                  {currentHouseNumber ? `Số ${currentHouseNumber}` : ''} {currentStreet || ''}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                KSV: <strong className="text-slate-700">{surveyorName || '---'}</strong>
              </span>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Ô Tìm Kiếm Thửa Đất Đích (Thửa B) */}
          <div className="space-y-1.5 relative">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 block">
                2. Chọn Thửa Đất Cần Hoán Đổi Ranh GIS (Thửa B):
              </label>
              <span className="text-[11px] text-slate-400">
                Tìm theo mã thửa, số nhà, đường, chủ hộ (không dấu)
              </span>
            </div>

            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Gõ mã thửa (vd: 0180), số nhà (vd: 658/1), tên đường (vd: cach mang)..."
                value={selectedTargetParcel ? `[${selectedTargetParcel.project_parcel_code}] - Số ${selectedTargetParcel.house_number || '---'} ${selectedTargetParcel.street || ''}` : searchTerm}
                onFocus={() => {
                  if (selectedTargetParcel) {
                    setSearchTerm(selectedTargetParcel.project_parcel_code);
                  }
                  setIsDropdownOpen(true);
                }}
                onChange={(e) => {
                  setSelectedTargetParcel(null);
                  setSearchTerm(e.target.value);
                  setIsDropdownOpen(true);
                }}
                className="w-full pl-3 pr-10 py-2.5 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
              <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5 text-slate-400">
                {isLoadingCandidates ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {selectedTargetParcel && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTargetParcel(null);
                      setSearchTerm('');
                      setIsDropdownOpen(true);
                      searchInputRef.current?.focus();
                    }}
                    className="hover:text-slate-600 p-0.5 cursor-pointer"
                    title="Xóa lựa chọn"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Dropdown Gợi Ý Thửa Đất Thông Minh */}
            {isDropdownOpen && (
              <div
                ref={dropdownRef}
                className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100"
              >
                <div className="px-3 py-1.5 bg-slate-50 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider sticky top-0 border-b border-slate-100">
                  <span>Ứng viên trong phân khu ({candidates.length} thửa):</span>
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(false)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    Đóng ✕
                  </button>
                </div>

                {candidates.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500 italic">
                    {isLoadingCandidates
                      ? 'Đang tìm kiếm trong toàn bộ phân khu...'
                      : 'Không tìm thấy thửa đất nào phù hợp với từ khóa.'}
                  </div>
                ) : (
                  candidates.map((item) => {
                    const isSurveyed = !!item.report_id;
                    return (
                      <button
                        key={item.parcel_id}
                        type="button"
                        onClick={() => {
                          setSelectedTargetParcel(item);
                          setIsDropdownOpen(false);
                        }}
                        className="w-full text-left p-2.5 hover:bg-indigo-50/70 transition-colors flex items-center justify-between gap-3 cursor-pointer group"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-black text-indigo-700 group-hover:text-indigo-900">
                              [{item.project_parcel_code}]
                            </span>
                            <span className="text-xs font-bold text-slate-800 truncate">
                              Số {item.house_number || '---'} {item.street || ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                            {item.owner_name && (
                              <span className="truncate flex items-center gap-1">
                                <User className="w-3 h-3 text-slate-400" />
                                {item.owner_name}
                              </span>
                            )}
                            {item.land_area_m2 ? (
                              <span>S: {item.land_area_m2} m²</span>
                            ) : null}
                          </div>
                        </div>

                        {/* Huy hiệu trạng thái */}
                        <div className="shrink-0 text-right">
                          {isSurveyed ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Đã có hồ sơ</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              <span>Chưa khảo sát</span>
                            </span>
                          )}
                          {item.surveyor_name && (
                            <span className="block text-[10px] text-slate-400 mt-0.5">
                              KSV: {item.surveyor_name}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {/* Hộp Thông Báo Ngữ Cảnh Nghiệp Vụ Tự Động */}
            {selectedTargetParcel && (
              <div className="p-3 rounded-xl bg-indigo-50/80 border border-indigo-100 text-xs space-y-1.5 animate-in fade-in duration-150">
                <div className="flex items-center gap-1.5 font-bold text-indigo-900">
                  <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>
                    {selectedTargetParcel.report_id
                      ? '✓ Hoán đổi chéo 2 hồ sơ đã khảo sát (Swap)'
                      : '✓ Chuyển hồ sơ sang thửa đích chưa khảo sát (Reassign)'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {selectedTargetParcel.report_id ? (
                    <>
                      Cả hai thửa <strong>[{currentParcelCode}]</strong> và{' '}
                      <strong>[{selectedTargetParcel.project_parcel_code}]</strong> đều đã được khảo sát.
                      Đa giác GIS của 2 nhà sẽ được <strong>tráo đổi cho nhau</strong> để đưa cả 2 về đúng
                      vị trí hiện trạng thực tế. Toàn bộ chữ ký, hồ sơ và watermark ảnh của cả 2 nhà được
                      bảo toàn nguyên vẹn 100%.
                    </>
                  ) : (
                    <>
                      Thửa đích <strong>[{selectedTargetParcel.project_parcel_code}]</strong> hiện chưa được khảo sát.
                      Toàn bộ hồ sơ khảo sát và ảnh watermark của <strong>[{currentParcelCode}]</strong> sẽ chuyển sang
                      vị trí tọa độ của thửa đích. Thửa đích sẽ nhận lại vị trí tọa độ cũ của{' '}
                      <strong>[{currentParcelCode}]</strong> và tiếp tục ở trạng thái chưa khảo sát.
                    </>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Sơ đồ hoán đổi trực quan 2 chiều */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <div className="flex-1 text-center">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Thửa A (Hiện tại)</span>
              <span className="font-mono font-black text-indigo-700 text-xs">[{currentParcelCode}]</span>
              <span className="block text-[11px] text-slate-600 truncate">
                {currentHouseNumber ? `Số ${currentHouseNumber}` : ''}
              </span>
            </div>

            <div className="px-3 flex flex-col items-center justify-center shrink-0">
              <div className="p-1.5 rounded-full bg-indigo-100 text-indigo-700">
                <ArrowRightLeft className="w-4 h-4" />
              </div>
              <span className="text-[9px] font-bold text-indigo-600 mt-0.5">Hoán đổi GIS</span>
            </div>

            <div className="flex-1 text-center">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Thửa B (Hoán đổi)</span>
              <span className="font-mono font-black text-indigo-700 text-xs">
                {selectedTargetParcel ? `[${selectedTargetParcel.project_parcel_code}]` : '[Chưa chọn]'}
              </span>
              <span className="block text-[11px] text-slate-600 truncate">
                {selectedTargetParcel?.house_number ? `Số ${selectedTargetParcel.house_number}` : '---'}
              </span>
            </div>
          </div>

          {/* Lý do hoán đổi (Audit Log) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              3. Lý Do Hoán Đổi Ranh Đất (Bắt buộc ghi nhận vào Nhật ký kiểm toán):
            </label>
            <textarea
              required
              rows={2}
              placeholder="Ví dụ: KSV khảo sát thực tế nhà 658/1B nhưng tích nhầm polygon của thửa 658/1. Cần hoán đổi lại đúng hiện trạng thực tế..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-2.5 text-xs text-slate-800 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          {/* Mã bảo mật 6 số bắt buộc */}
          <AdminSecurityChallengeConfirm
            actionDescription={`hoán đổi ranh đất GIS của thửa [${currentParcelCode}] sang thửa [${selectedTargetParcel?.project_parcel_code || 'được chọn'}]`}
            onValidityChange={(isValid) => setIsChallengeValid(isValid)}
          />

          {/* Buttons Footer */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Hủy Bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedTargetParcel || !isChallengeValid}
              className="px-4 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Đang thực thi...' : 'Xác Nhận Hoán Đổi Ranh GIS'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
