import React, { useState, useEffect } from 'react';
import {
  Building,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  Key,
  FileCheck2,
  RefreshCw,
  Hash,
  Clock,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { api } from '../../../../../services/api';
import { getErrorMessage } from '@/utils/errorUtils';
import type { AuditStepwiseData, DiffItem, PhotoReplaceParams } from '../stepwise/types';

interface Props {
  data: AuditStepwiseData;
  reportId: string;
  onRefresh: () => void;
  onOpenPhotoZoom: (url: string, title?: string, photoCode?: string) => void;
  onOpenDiffModal: (diffItems: DiffItem[], updates: Record<string, unknown>) => void;
  onOpenPhotoReplace: (params: PhotoReplaceParams) => void;
  onOpenEngineeringJudgement: () => void;
  onOpenRejectModal: () => void;
  onClose: () => void;
}

interface CondoProgressData {
  parcel: {
    id: string;
    projectParcelCode: string;
    houseNumber: string;
    street: string;
    zoneId: string;
    buildingType: string;
    floorCount: number;
    totalUnits: number;
    surveyStatus: string;
    isLocked: boolean;
    lockedAt: string | null;
    sealHash: string | null;
    sealNotes: string | null;
  };
  stats: {
    totalItems: number;
    completedItems: number;
    completionRatePercent: number;
    childUnits: {
      total: number;
      approved: number;
      absentVerified: number;
      absentPending: number;
      submitted: number;
      inProgress: number;
    };
    masterAreas: {
      total: number;
      approved: number;
      submitted: number;
      pending: number;
    };
  };
  blockingItems: Array<{
    id: string;
    unitCode: string;
    displayCode: string;
    unitType: string;
    floorNumber: number;
    status: string;
    ownerName: string | null;
    reportId: string | null;
    blockingReason: string;
  }>;
  isReadyForFinalSeal: boolean;
  masterReport: {
    id: string;
    status: string;
    updated_at: string;
  } | null;
}

export const CondoMasterAuditStudioView: React.FC<Props> = ({
  data,
  reportId,
  onRefresh,
  onOpenPhotoZoom,
  onOpenEngineeringJudgement,
  onClose,
}) => {
  const [progressData, setProgressData] = useState<CondoProgressData | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [isSealing, setIsSealing] = useState(false);
  const [sealNotes, setSealNotes] = useState('');
  const [showSealConfirm, setShowSealConfirm] = useState(false);

  const parcelId = data.parcelId || data.parentBuildingInfo?.id || '';

  const fetchProgress = async () => {
    if (!parcelId) return;
    setLoadingProgress(true);
    try {
      const res = await api.get(`/admin/condo/${parcelId}/progress-summary`);
      if (res.data?.success && res.data?.data) {
        setProgressData(res.data.data);
      }
    } catch (err) {
      console.error('[CondoMasterAuditStudioView] Failed to load condo progress:', err);
    } finally {
      setLoadingProgress(false);
    }
  };

  useEffect(() => {
    fetchProgress();
  }, [parcelId]);

  const isLocked = Boolean(progressData?.parcel.isLocked || data.parentBuildingInfo?.isLocked);
  const sealHash = progressData?.parcel.sealHash || data.parentBuildingInfo?.sealHash;
  const lockedAt = progressData?.parcel.lockedAt || data.parentBuildingInfo?.lockedAt;

  // Execute Final Legal Seal
  const handleExecuteFinalSeal = async () => {
    if (!parcelId) return;
    setIsSealing(true);
    try {
      const res = await api.post(`/admin/condo/${parcelId}/final-seal`, {
        sealNotes: sealNotes || 'Khóa sổ pháp lý toàn diện tòa nhà mẹ bởi Zone Admin',
      });
      if (res.data?.success || res.status === 200) {
        alert('Đã hoàn tất Niêm Phong & Khóa Sổ Pháp Lý Toàn Diện Tòa Nhà Mẹ!');
        setShowSealConfirm(false);
        fetchProgress();
        onRefresh();
      }
    } catch (err) {
      alert(getErrorMessage(err, 'Lỗi khi thực hiện khóa sổ'));
    } finally {
      setIsSealing(false);
    }
  };

  const surveyJson = data.surveyJson || data.survey_data_json || {};

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-8">
      {/* 1. Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-indigo-100 text-indigo-700 rounded-xl">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  TÒA NHÀ MẸ (BUILDING MASTER)
                </span>
                <h2 className="text-xl font-black text-slate-900">
                  {data.projectParcelCode || 'Tòa Chung Cư'}
                </h2>
                {isLocked ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <Lock className="w-3.5 h-3.5 text-emerald-600" /> ĐÃ KHÓA SỔ PHÁP LÝ (SEALED)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                    <Unlock className="w-3.5 h-3.5" /> Đang Thu Thập & Thẩm Định
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Địa chỉ: {data.houseNumber || ''} {data.street || ''} • Phân khu: <strong className="text-indigo-600">{data.zoneId || 'ZONE'}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchProgress}
              className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition-colors cursor-pointer"
              title="Cập nhật tiến độ"
            >
              <RefreshCw className={`w-4 h-4 ${loadingProgress ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onOpenEngineeringJudgement}
              className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Phán đoán chuyên gia</span>
            </button>
          </div>
        </div>

        {/* Thông số vĩ mô tòa nhà */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-xs">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="text-slate-400 block text-[11px]">Tổng số căn hộ</span>
            <strong className="text-base font-black text-slate-800">
              {String(progressData?.parcel.totalUnits || data.parentBuildingInfo?.totalUnits || surveyJson.totalUnits || '?')}
            </strong>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="text-slate-400 block text-[11px]">Số tầng nổi / hầm</span>
            <strong className="text-base font-black text-slate-800">
              {progressData?.parcel.floorCount || data.parentBuildingInfo?.floorCount || 1} tầng
            </strong>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="text-slate-400 block text-[11px]">Khoảng cách tim hầm Metro 2</span>
            <strong className="text-base font-black text-indigo-600">
              {surveyJson.metroOffsetDistance ? `${surveyJson.metroOffsetDistance}m` : 'Tiếp giáp'}
            </strong>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="text-slate-400 block text-[11px]">Kết cấu móng</span>
            <strong className="text-base font-black text-slate-800">
              {surveyJson.foundationType || 'Cọc khoan nhồi / Móng bè'}
            </strong>
          </div>
        </div>
      </div>

      {/* Block 3: Dashboard Tiến Độ Tổng Thể Toàn Bộ Tòa Nhà */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-black text-slate-900">
              Tiến Độ Khảo Sát & Thẩm Định Toàn Bộ Tòa Nhà (Condo Tree Progress)
            </h3>
          </div>
          <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
            {progressData?.stats.completionRatePercent ?? 0}% Hoàn Thành
          </span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex">
            <div
              className="bg-emerald-500 h-full transition-all duration-500"
              style={{
                width: `${progressData?.stats.completionRatePercent ?? 0}%`,
              }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 font-medium">
            <span>
              Đã thẩm định:{' '}
              <strong className="text-emerald-700">
                {progressData?.stats.completedItems ?? 0} / {progressData?.stats.totalItems ?? 0}
              </strong>{' '}
              mục (Căn hộ + Dùng chung)
            </span>
            <span>
              Còn lại:{' '}
              <strong className="text-amber-700">
                {progressData?.blockingItems.length ?? 0}
              </strong>{' '}
              mục chưa hoàn tất
            </span>
          </div>
        </div>

        {/* Thống kê 2 nhánh: Căn hộ con vs Khu vực dùng chung */}
        {progressData && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Nhánh Căn hộ con */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800">Căn Hộ Con ({progressData.stats.childUnits.total})</span>
                <span className="text-xs text-indigo-600 font-bold">
                  {progressData.stats.childUnits.approved + progressData.stats.childUnits.absentVerified} Đạt chuẩn
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Đã duyệt (Approved)</span>
                  <strong className="text-emerald-600 font-black text-sm">{progressData.stats.childUnits.approved}</strong>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Vắng mặt xác nhận</span>
                  <strong className="text-purple-600 font-black text-sm">{progressData.stats.childUnits.absentVerified}</strong>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Chờ duyệt (Submitted)</span>
                  <strong className="text-indigo-600 font-black text-sm">{progressData.stats.childUnits.submitted}</strong>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Chưa xong / Vắng chờ</span>
                  <strong className="text-amber-600 font-black text-sm">
                    {progressData.stats.childUnits.inProgress + progressData.stats.childUnits.absentPending}
                  </strong>
                </div>
              </div>
            </div>

            {/* Nhánh Khu vực dùng chung */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800">Khu Vực Dùng Chung ({progressData.stats.masterAreas.total})</span>
                <span className="text-xs text-teal-700 font-bold">
                  {progressData.stats.masterAreas.approved} Đã Duyệt
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Đã duyệt (Approved)</span>
                  <strong className="text-emerald-600 font-black text-sm">{progressData.stats.masterAreas.approved}</strong>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Chờ thẩm định</span>
                  <strong className="text-teal-700 font-black text-sm">{progressData.stats.masterAreas.submitted}</strong>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-100 col-span-2">
                  <span className="text-slate-400 block text-[11px]">Chưa hoàn thành</span>
                  <strong className="text-amber-600 font-black text-sm">{progressData.stats.masterAreas.pending}</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Danh sách mục cản trở (Blocking Items List) */}
        {progressData && progressData.blockingItems.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
            <div className="text-xs font-black text-red-700 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
              <span>Các Mục Cản Trở Khóa Sổ ({progressData.blockingItems.length})</span>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {progressData.blockingItems.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-red-50/50 border border-red-200 rounded-lg p-2 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-800">
                      {item.displayCode || item.unitCode}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      (Tầng {item.floorNumber})
                    </span>
                    <span className="text-red-700 font-medium text-[11px]">
                      • {item.blockingReason}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white text-slate-600 border border-red-100">
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Block 4: Niêm Phong & Khóa Sổ Pháp Lý Toàn Diện (Final Legal Seal) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Key className="w-5 h-5 text-indigo-600" />
          <div>
            <h3 className="text-sm font-black text-slate-900">
              Khối 4: Niêm Phong & Khóa Sổ Pháp Lý Toàn Diện (Final Legal Seal Guard)
            </h3>
            <p className="text-xs text-slate-500">
              Cơ chế bảo chứng pháp lý toàn diện: Sinh mã băm SHA-256 niêm phong bất biến toàn bộ cấu trúc tòa nhà sau khi 100% căn hộ & khu vực dùng chung hoàn tất thẩm định.
            </p>
          </div>
        </div>

        {isLocked ? (
          <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-emerald-800 font-black text-sm">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <span>TÒA NHÀ ĐÃ ĐƯỢC NIÊM PHONG & KHÓA SỔ BẤT BIẾN</span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-emerald-200 text-xs font-mono space-y-1">
              <div className="text-slate-500">Mã băm niêm phong pháp lý (SHA-256 Hash):</div>
              <div className="text-emerald-700 font-black break-all">{sealHash || 'SHA-256 GENERATED'}</div>
              {lockedAt && (
                <div className="text-slate-400 text-[11px] pt-1">
                  Thời điểm khóa sổ: {new Date(lockedAt).toLocaleString('vi-VN')}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {progressData?.isReadyForFinalSeal ? (
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>100% căn hộ và khu vực dùng chung đã hoàn tất thẩm định hợp lệ. Tòa nhà đủ điều kiện Khóa Sổ Pháp Lý.</span>
                </div>

                {!showSealConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowSealConfirm(true)}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Khóa Sổ Pháp Lý Toàn Diện (Final Seal)</span>
                  </button>
                ) : (
                  <div className="bg-white p-4 rounded-xl border border-emerald-300 space-y-3">
                    <label className="text-xs font-black text-slate-800 block">
                      Ghi chú niêm phong pháp lý của Zone Admin (tùy chọn)
                    </label>
                    <textarea
                      rows={2}
                      value={sealNotes}
                      onChange={(e) => setSealNotes(e.target.value)}
                      placeholder="VD: Đã nghiệm thu hiện trạng toàn bộ 120 căn hộ và khu vực hầm/sảnh chuẩn bị triển khai đào hầm TBM Tuyến 2..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowSealConfirm(false)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        disabled={isSealing}
                        onClick={handleExecuteFinalSeal}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>{isSealing ? 'Đang niêm phong...' : 'Xác Nhận Khóa Sổ Bất Biến'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3 text-xs text-slate-600">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <div className="font-bold text-slate-800">Chưa đủ điều kiện Khóa Sổ Pháp Lý</div>
                  <div className="text-slate-500 mt-0.5">
                    Tòa nhà còn {progressData?.blockingItems.length ?? '?'} căn hộ hoặc khu vực dùng chung chưa hoàn tất phê duyệt hoặc chưa xác nhận vắng mặt.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
