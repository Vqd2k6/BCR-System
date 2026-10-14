import React from 'react';
import {
  Home,
  Building2,
  X,
  Play,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  RotateCcw,
  ArrowRightLeft,
} from 'lucide-react';
import type { GisParcel } from '../../../gis/LeafletSweepMap';
import type { BuildingUnit } from '../types';
import { formatShortUnitDisplay } from '../../../../core/utils/codeFormattingUtils';
import { useAuth } from '../../../../context/AuthContext';
import { api } from '../../../../services/api';
import { getErrorMessage } from '@/utils/errorUtils';
import { UnitCadSpatialSwapModal } from './UnitCadSpatialSwapModal';
import { AuditStudioModal } from '../../../../features/zone-management/components/review-queue/AuditStudioModal';

interface UnitInspectionDrawerProps {
  unit: BuildingUnit | null;
  parcel: GisParcel;
  floorLabel?: string;
  isMasterSurveyDone: boolean;
  onClose: () => void;
  onStartUnitSurvey: (parcel: GisParcel, unit: BuildingUnit, phase?: 1 | 2) => void;
  onStartMasterAreaSurvey?: (parcel: GisParcel, unit: BuildingUnit) => void;
  onUnitStatusUpdated?: () => void;
}

export const UnitInspectionDrawer: React.FC<UnitInspectionDrawerProps> = ({
  unit,
  parcel,
  floorLabel,
  isMasterSurveyDone,
  onClose,
  onStartUnitSurvey,
  onStartMasterAreaSurvey,
  onUnitStatusUpdated,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ZONE_ADMIN' || user?.role === 'SUPER_ADMIN';
  const [isReverting, setIsReverting] = React.useState(false);
  const [showSwapModal, setShowSwapModal] = React.useState(false);
  const [auditStudioOpen, setAuditStudioOpen] = React.useState(false);
  const [isApprovingAbsentee, setIsApprovingAbsentee] = React.useState(false);
  const [activeReportId, setActiveReportId] = React.useState<string | null>(
    unit?.phase1_report_id || unit?.phase1ReportId || null
  );

  React.useEffect(() => {
    setActiveReportId(unit?.phase1_report_id || unit?.phase1ReportId || null);
  }, [unit]);

  if (!unit) return null;

  const resolveReportId = async (): Promise<string | null> => {
    if (activeReportId) return activeReportId;
    try {
      const res = await api.get('/admin/reports/pending-reviews', {
        params: { unitId: unit.id, limit: 1 },
      });
      const items = res.data?.data?.items || res.data?.data;
      if (Array.isArray(items) && items.length > 0 && items[0].report_id) {
        setActiveReportId(items[0].report_id);
        return items[0].report_id;
      }
    } catch (e) {
      console.error('[UnitInspectionDrawer] Could not resolve reportId:', e);
    }
    return null;
  };

  const handleOpenStudio = async () => {
    const repId = await resolveReportId();
    if (repId) {
      setAuditStudioOpen(true);
    } else {
      alert('Không tìm thấy mã hồ sơ khảo sát của căn này.');
    }
  };

  const handleApproveAbsentee = async () => {
    const repId = await resolveReportId();
    if (!repId) {
      alert('Không tìm thấy mã hồ sơ vắng mặt.');
      return;
    }

    const notes = window.prompt(
      'Xác nhận phê duyệt vắng mặt căn hộ.\nNhập ghi chú thẩm định (đã đối soát ảnh dán giấy báo/biên bản...):',
      'Đã đối soát ảnh dán giấy hẹn khảo sát tại cửa căn hộ.'
    );
    if (notes === null) return;

    try {
      setIsApprovingAbsentee(true);
      const res = await api.post(`/admin/reports/${repId}/approve-absentee`, {
        absenceVerificationNotes: notes || 'Đã kiểm tra chứng cứ vắng mặt.',
      });
      if (res.data?.success) {
        alert('✅ Đã phê duyệt hồ sơ vắng mặt thành công!');
        unit.status = 'POSTPONED_ABSENT_VERIFIED';
        if (onUnitStatusUpdated) {
          onUnitStatusUpdated();
        }
      }
    } catch (err: unknown) {
      alert(`❌ Lỗi khi duyệt vắng mặt: ${getErrorMessage(err)}`);
    } finally {
      setIsApprovingAbsentee(false);
    }
  };

  const isMaster = (unit.unit_type || unit.unitType) === 'MASTER';
  const shortCode = formatShortUnitDisplay(unit.unit_code, isMaster ? 'MASTER' : 'UNIT');
  const isApproved = unit.status === 'APPROVED' || Boolean(unit.phase2_report_id);
  const isSubmitted = unit.status === 'SUBMITTED';
  const isInProgress = unit.status === 'IN_PROGRESS';
  const isAbsent = unit.status === 'POSTPONED_ABSENT';

  const handleRevertToDraft = async () => {
    const confirmRevert = window.confirm(
      `Xác nhận chuyển trạng thái căn ${unit.unit_code} về "Đang làm dở"?\n\nSau khi chuyển, khảo sát viên hoặc admin có thể tiếp tục chỉnh sửa thông tin và nộp lại.`
    );
    if (!confirmRevert) return;

    try {
      setIsReverting(true);
      const res = await api.post(`/admin/reports/${unit.id}/revert-to-draft`, {
        unitId: unit.id,
      });

      if (!res.data?.success) {
        throw new Error(res.data?.message || 'Server không phản hồi');
      }

      unit.status = 'IN_PROGRESS';
      if (onUnitStatusUpdated) {
        onUnitStatusUpdated();
      }
      alert(`✅ Đã chuyển căn ${unit.unit_code} về trạng thái "Đang làm dở" thành công!`);
    } catch (err: unknown) {
      console.error('[UnitInspectionDrawer] Revert error:', err);
      alert(`❌ Lỗi khi chuyển trạng thái: ${getErrorMessage(err)}`);
    } finally {
      setIsReverting(false);
    }
  };

  const renderStatusBadge = () => {
    if (isApproved) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <CheckCircle2 size={13} className="text-emerald-600" />
          <span>Đã duyệt Phase 1</span>
        </span>
      );
    }
    if (isSubmitted) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-300">
          <Clock size={13} className="text-sky-600" />
          <span>Đã nộp (Chờ duyệt)</span>
        </span>
      );
    }
    if (isInProgress) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span>Đang làm dở</span>
        </span>
      );
    }
    if (isAbsent) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300">
          <AlertTriangle size={13} className="text-purple-600" />
          <span>Vắng mặt (Hoãn)</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
        <span className="w-2 h-2 rounded-full bg-slate-400" />
        <span>Chưa khảo sát</span>
      </span>
    );
  };

  const handleStartSurvey = () => {
    if (isMaster) {
      if (onStartMasterAreaSurvey) {
        onStartMasterAreaSurvey(parcel, unit);
      }
    } else {
      // Nếu đã duyệt Phase 1 thì mở Phase 2, ngược lại mở Phase 1
      const phase = isApproved ? 2 : 1;
      onStartUnitSurvey(parcel, unit, phase);
    }
  };

  return (
    <>
      {/* Backdrop mờ phía sau trên mobile: Chạm vào nền mờ để đóng */}
      <div
        onClick={onClose}
        className="sm:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-[99990] animate-in fade-in duration-150"
      />

      {/* Main Bottom Sheet trên Mobile & Float Box trên Desktop */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="fixed sm:static inset-x-0 bottom-0 z-[99995] sm:z-auto bg-white/98 backdrop-blur-md rounded-t-3xl sm:rounded-2xl border-t-2 sm:border-2 border-slate-300 shadow-2xl p-4 sm:p-5 pb-8 sm:pb-5 flex flex-col gap-3.5 animate-in slide-in-from-bottom-4 duration-200 ring-2 ring-slate-900/10 max-h-[88vh] overflow-y-auto"
      >
        {/* Mobile Drag Handle Bar */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-300 rounded-full mx-auto -mt-1 mb-1 shrink-0" />

        {/* 1. Thanh tiêu đề vị trí */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                isMaster ? 'bg-indigo-600 text-white' : 'bg-teal-600 text-white'
              }`}
            >
              {isMaster ? <Building2 size={20} /> : <Home size={20} />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-base sm:text-lg font-black text-slate-900 truncate">
                  {isMaster ? `Khu ${shortCode}` : `Căn ${shortCode}`}
                </h4>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
                  Mã: {unit.unit_code}
                </span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                    isMaster ? 'bg-indigo-100 text-indigo-800' : 'bg-teal-100 text-teal-800'
                  }`}
                >
                  {floorLabel || `Tầng ${unit.floor_number ?? 1}`}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {isMaster
                  ? `Khu vực dùng chung của khối tháp: ${unit.unit_name || 'Hạng mục dùng chung'}`
                  : `Căn hộ con sở hữu riêng • Tòa nhà ${parcel.projectParcelCode || parcel.officialCadastralCode || 'Metro 2'}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Đóng thẻ xem nhanh"
          >
            <X size={18} />
          </button>
        </div>

        {/* 2. Chi tiết sơ bộ: Chủ sở hữu / BQL & Tọa độ CAD */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="flex flex-col gap-1.5 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Trạng thái:</span>
              {renderStatusBadge()}
            </div>
            <div className="flex items-center justify-between text-slate-700 pt-1 border-t border-slate-200/60">
              <span className="text-slate-500 font-medium">Định vị mặt bằng:</span>
              <span className="font-bold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 size={13} />
                <span>Đã khớp tọa độ CAD</span>
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between text-slate-700">
              <span className="text-slate-500 font-medium">{isMaster ? 'Đơn vị quản lý:' : 'Chủ căn hộ:'}</span>
              <strong className="font-bold text-slate-900 truncate max-w-[60%]">
                {isMaster ? unit.owner_name || 'BQL Tòa nhà' : unit.owner_name || 'Chưa cập nhật'}
              </strong>
            </div>
            {!isMaster && (
              <div className="flex items-center justify-between text-slate-700 pt-1 border-t border-slate-200/60">
                <span className="text-slate-500 font-medium">Số điện thoại:</span>
                <span className="font-mono text-slate-900 font-bold">
                  {unit.owner_phone || '---'}
                </span>
              </div>
            )}
            {isMaster && (
              <div className="flex items-center justify-between text-slate-700 pt-1 border-t border-slate-200/60">
                <span className="text-slate-500 font-medium">Phạm vi khảo sát:</span>
                <span className="font-semibold text-indigo-700">
                  Toàn bộ cấu kiện khu vực
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 3. Nút Hành Động Khảo Sát Chính (Primary Survey CTA - Tối ưu Thumb Zone 48px) */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Kiểm tra vị trí đứng trùng khớp với sơ đồ CAD trước khi bắt đầu.
          </span>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {isAdmin && (isSubmitted || isApproved || isAbsent) && (
              <button
                type="button"
                onClick={handleOpenStudio}
                className="min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs shrink-0"
                title="Mở Studio Thẩm Định & Phê Duyệt"
              >
                <ShieldCheck size={14} className="text-indigo-600" />
                <span className="hidden sm:inline">Studio Thẩm Định</span>
                <span className="sm:hidden">Studio</span>
              </button>
            )}

            {isAdmin && isAbsent && (
              <button
                type="button"
                disabled={isApprovingAbsentee}
                onClick={handleApproveAbsentee}
                className="min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs shrink-0 disabled:opacity-50"
                title="Duyệt hồ sơ vắng mặt"
              >
                <CheckCircle2 size={14} className={isApprovingAbsentee ? 'animate-spin' : 'text-purple-600'} />
                <span className="hidden sm:inline">{isApprovingAbsentee ? 'Đang duyệt...' : 'Duyệt Vắng Mặt'}</span>
                <span className="sm:hidden">{isApprovingAbsentee ? 'Duyệt...' : 'Duyệt Vắng'}</span>
              </button>
            )}

            {isSubmitted && isAdmin && (
              <button
                type="button"
                disabled={isReverting}
                onClick={handleRevertToDraft}
                className="min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs shrink-0 disabled:opacity-50"
                title="Chuyển trạng thái về 'Đang làm dở' để sửa đổi thông tin"
              >
                <RotateCcw size={14} className={isReverting ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">{isReverting ? 'Đang chuyển...' : 'Mở lại (Đang làm dở)'}</span>
                <span className="sm:hidden">{isReverting ? 'Chuyển...' : 'Đang làm dở'}</span>
              </button>
            )}

            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowSwapModal(true)}
                className="min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs shrink-0"
                title="Hoán đổi tọa độ CAD với căn hộ hoặc khu vực khác (Admin)"
              >
                <ArrowRightLeft size={14} className="text-indigo-600" />
                <span className="hidden sm:inline">Hoán Đổi Vị Trí CAD</span>
                <span className="sm:hidden">Đổi CAD</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer shrink-0"
            >
              Đóng
            </button>

            <button
              type="button"
              onClick={handleStartSurvey}
              className={`flex-1 sm:flex-initial min-h-[48px] px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer hover:shadow-lg active:scale-98 ${
                isApproved
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : isSubmitted
                  ? 'bg-sky-600 hover:bg-sky-700'
                  : isInProgress
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : isAbsent
                  ? 'bg-purple-600 hover:bg-purple-700'
                  : isMaster
                  ? 'bg-indigo-600 hover:bg-indigo-700'
                  : 'bg-teal-600 hover:bg-teal-700'
              }`}
            >
              {isApproved ? (
                <>
                  <CheckCircle2 size={16} />
                  <span>{isMaster ? 'Xem Hồ Sơ Đã Duyệt' : 'Khảo Sát Phase 2'}</span>
                </>
              ) : isSubmitted ? (
                <>
                  <ExternalLink size={16} />
                  <span>Xem Hồ Sơ Đã Nộp</span>
                </>
              ) : isInProgress ? (
                <>
                  <Play size={16} className="fill-current" />
                  <span>{isMaster ? 'Tiếp Tục Khảo Sát Master' : 'Tiếp Tục Khảo Sát'}</span>
                </>
              ) : isAbsent ? (
                <>
                  <AlertTriangle size={16} />
                  <span>Tiếp Tục / Khảo Sát Lại</span>
                </>
              ) : isMaster ? (
                <>
                  <Building2 size={16} />
                  <span>Khảo Sát Khu Vực Này</span>
                </>
              ) : (
                <>
                  <Play size={16} className="fill-current" />
                  <span>Bắt Đầu Khảo Sát Căn Hộ</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Modal Hoán Đổi Tọa Độ CAD cho Admin */}
      {isAdmin && showSwapModal && (
        <UnitCadSpatialSwapModal
          isOpen={showSwapModal}
          parcelId={parcel.id}
          projectParcelCode={parcel.projectParcelCode || parcel.officialCadastralCode}
          sourceUnit={unit}
          onClose={() => setShowSwapModal(false)}
          onSuccess={() => {
            setShowSwapModal(false);
            if (onUnitStatusUpdated) {
              onUnitStatusUpdated();
            }
          }}
        />
      )}

      {/* Studio Thẩm Định Modal cho Admin */}
      {auditStudioOpen && (activeReportId || unit.phase1_report_id || unit.phase1ReportId) && (
        <AuditStudioModal
          isOpen={auditStudioOpen}
          reportId={(activeReportId || unit.phase1_report_id || unit.phase1ReportId)!}
          onClose={() => setAuditStudioOpen(false)}
          onRefreshList={() => {
            if (onUnitStatusUpdated) {
              onUnitStatusUpdated();
            }
          }}
        />
      )}
    </>
  );
};
