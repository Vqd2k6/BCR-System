import React from 'react';
import {
  Eye,
  CheckCircle2,
  AlertTriangle,
  User,
  Clock,
  History,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import type { PendingSubmissionItem } from './ZoneAuditReviewQueue';

interface Props {
  stt?: number;
  item: PendingSubmissionItem;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (reportId: string, checked: boolean) => void;
  onOpenStudio: (reportId: string | null) => void;
  onPreviewReport?: (reportId: string | null) => void;
  onOpenRejectModal?: (item: PendingSubmissionItem) => void;
  onOpenReassignModal?: (item: PendingSubmissionItem) => void;
  onOpenMutationModal?: (item: PendingSubmissionItem) => void;
  onOpenReshapeModal?: (item: PendingSubmissionItem) => void;
  onOpenAuditHistory?: (reportId: string, itemCode?: string) => void;
  onOpenRevertModal?: (item: PendingSubmissionItem) => void;
}

export const ReviewQueueTableRow: React.FC<Props> = React.memo(({
  stt,
  item,
  selectable = false,
  selected = false,
  onSelect,
  onOpenStudio,
  onOpenAuditHistory,
  onOpenRevertModal,
}) => {
  const isCriticalBurland = ['GRADE_3', 'GRADE_4', 'GRADE_5'].includes(
    item.burland_damage_category || ''
  );
  const hasAlerts = Number(item.alert_count) > 0;
  const canBatchApprove =
    item.status === 'SUBMITTED' &&
    !item.has_admin_diff &&
    (item.version_count ?? 0) <= 1 &&
    item.defect_count === 0 &&
    (item.burland_damage_category === 'GRADE_0' || !item.burland_damage_category);

  // Render Status Badge
  const renderStatusBadge = () => {
    if (item.unit_status === 'POSTPONED_ABSENT_VERIFIED' || item.parcel_status === 'POSTPONED_ABSENT_VERIFIED') {
      return (
        <div className="flex flex-col gap-0.5 items-center">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300 w-fit whitespace-nowrap">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <span>Vắng Mặt (Đã duyệt)</span>
          </span>
          {item.approver_name && (
            <div className="text-[11px] text-purple-700 flex items-center gap-1 mt-0.5 font-medium whitespace-nowrap">
              <User className="w-3 h-3 text-purple-500 shrink-0" />
              <span>Xác minh: <strong>{item.approver_name}</strong></span>
            </div>
          )}
          {item.approved_at && (
            <div className="text-[10px] text-slate-400 font-mono whitespace-nowrap flex items-center gap-1">
              <Clock className="w-3 h-3 shrink-0" />
              <span>{new Date(item.approved_at).toLocaleDateString('vi-VN')} {new Date(item.approved_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          )}
        </div>
      );
    }
    if (item.status === 'APPROVED') {
      return (
        <div className="flex flex-col gap-0.5 items-center">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 w-fit whitespace-nowrap">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Đã Phê Duyệt</span>
          </span>
          {item.approver_name && (
            <div className="text-[11px] text-slate-600 flex items-center gap-1 mt-0.5 whitespace-nowrap" title={item.judgement_notes || undefined}>
              <User className="w-3 h-3 text-slate-400 shrink-0" />
              <span>Duyệt bởi: <strong className="text-slate-800">{item.approver_name}</strong></span>
            </div>
          )}
          {item.approved_at && (
            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 whitespace-nowrap">
              <Clock className="w-3 h-3 shrink-0" />
              <span>{new Date(item.approved_at).toLocaleDateString('vi-VN')} {new Date(item.approved_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          )}
        </div>
      );
    }
    if (item.status === 'POSTPONED_ABSENT' || item.is_refused_or_absent) {
      return (
        <div className="flex flex-col gap-0.5 items-center">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300 w-fit whitespace-nowrap">
            <Clock className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <span>Vắng Chủ ({item.absence_attempt_count || 1})</span>
          </span>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            Chờ thẩm định giấy mời
          </div>
        </div>
      );
    }
    if (item.status === 'REJECTED') {
      return (
        <div className="flex flex-col gap-0.5 items-center">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300 w-fit whitespace-nowrap">
            <CheckCircle2 className="w-3.5 h-3.5 text-red-600 shrink-0" />
            <span>Đã Trả Về Đo Lại</span>
          </span>
          {item.rejection_reason && (
            <div className="text-[11px] text-red-700 mt-0.5 truncate max-w-[170px]" title={item.rejection_reason}>
              <span>Lý do: {item.rejection_reason}</span>
            </div>
          )}
        </div>
      );
    }
    if (item.status === 'UNDER_REVIEW' || (item.has_admin_diff && item.status !== 'APPROVED')) {
      const verNum = item.current_version_number || 1;
      const isRollback = item.latest_version_tag === 'ROLLBACK_RESTORE';
      return (
        <div className="flex flex-col gap-0.5 items-center">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 w-fit whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span>Đang thẩm định (v{verNum})</span>
          </span>
          <div
            className="text-[10px] text-amber-700/80 dark:text-amber-400 font-mono mt-0.5 whitespace-nowrap truncate max-w-[170px]"
            title={item.latest_edit_reason || (isRollback ? 'Đã rollback phiên bản' : 'Có bản sửa đổi diff')}
          >
            {isRollback ? 'Đã rollback' : item.latest_edit_reason ? item.latest_edit_reason : 'Có bản sửa đổi'}
          </div>
        </div>
      );
    }
    const isMultiVer = (item.version_count ?? 0) > 1;
    return (
      <div className="flex flex-col gap-0.5 items-center">
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 w-fit whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse shrink-0" />
          <span>Chờ thẩm định{isMultiVer ? ` (v${item.current_version_number})` : ''}</span>
        </span>
        <div className="text-[10px] text-slate-400 font-mono mt-0.5 whitespace-nowrap">
          Nộp: {new Date(item.created_at).toLocaleDateString('vi-VN')} {new Date(item.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    );
  };

  // Render Burland Badge
  const renderBurlandBadge = () => {
    const cat = item.burland_damage_category;
    const width = item.burland_max_crack_width_mm;
    if (!cat) return <span className="text-slate-400 font-mono text-[11px] whitespace-nowrap">Chưa tính</span>;
    switch (cat) {
      case 'GRADE_0':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
            Cấp 0 (Không đáng kể)
          </span>
        );
      case 'GRADE_1':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap">
            Cấp 1 (Rất nhẹ {width ? `~${width}mm` : ''})
          </span>
        );
      case 'GRADE_2':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 whitespace-nowrap">
            Cấp 2 (Nhẹ {width ? `~${width}mm` : ''})
          </span>
        );
      case 'GRADE_3':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-black bg-orange-100 text-orange-900 border border-orange-400 whitespace-nowrap">
            ⚠️ Cấp 3 (TB {width ? `~${width}mm` : ''})
          </span>
        );
      case 'GRADE_4':
      case 'GRADE_5':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-black bg-red-100 text-red-900 border border-red-500 animate-pulse whitespace-nowrap">
            🚨 Cấp {cat === 'GRADE_5' ? '5' : '4'} (Nặng {width ? `~${width}mm` : ''})
          </span>
        );
      default:
        return <span className="text-slate-500 font-mono text-xs whitespace-nowrap">{cat}</span>;
    }
  };

  return (
    <tr
      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${
        isCriticalBurland ? 'bg-orange-50/30 dark:bg-orange-950/20' : hasAlerts ? 'bg-amber-50/20 dark:bg-amber-950/20' : ''
      }`}
    >
      {/* 1. STT & Checkbox chọn hàng loạt */}
      <td className="p-3 text-center whitespace-nowrap">
        <div className="flex items-center justify-center gap-2">
          {selectable && (
            <input
              type="checkbox"
              checked={Boolean(selected)}
              disabled={!canBatchApprove}
              onChange={(e) => onSelect && item.report_id && onSelect(item.report_id, e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
              title={canBatchApprove ? 'Chọn để duyệt hàng loạt' : 'Chỉ có thể chọn căn hộ Grade 0 không có khuyết tật'}
            />
          )}
          {stt !== undefined && (
            <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
              {stt}
            </span>
          )}
        </div>
      </td>

      {/* 2. Mã Thửa / Căn Hộ */}
      <td className="p-3 whitespace-nowrap">
        {item.unit_type === 'MASTER' || item.unit_code?.startsWith('M-') ? (
          <div>
            <div className="font-mono font-black text-teal-800 dark:text-teal-300 text-sm flex items-center gap-1.5">
              <span>🏛️ {item.display_code || item.unit_code}</span>
            </div>
            <div className="text-[11px] text-teal-600 dark:text-teal-400 font-mono mt-0.5">
              Khu dùng chung • Tòa {item.parent_parcel_code || item.project_parcel_code}
            </div>
          </div>
        ) : item.unit_type === 'UNIT' || item.unit_code?.startsWith('U-') ? (
          <div>
            <div className="font-mono font-black text-purple-800 dark:text-purple-300 text-sm flex items-center gap-1.5">
              <span>🚪 {item.display_code || item.unit_code}</span>
              {item.unit_floor_number && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold">
                  T{item.unit_floor_number}
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              Tòa {item.parent_parcel_code || item.project_parcel_code}
            </div>
          </div>
        ) : item.building_type?.includes('CONDO') ? (
          <div>
            <div className="font-mono font-black text-indigo-900 dark:text-indigo-300 text-sm flex items-center gap-1.5">
              <span>🏢 {item.project_parcel_code}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-sans font-bold">
                Tòa Mẹ
              </span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              Phân khu: <strong className="text-indigo-600 dark:text-indigo-400">{item.zone_id}</strong>
            </div>
          </div>
        ) : (
          <div>
            <div className="font-mono font-black text-slate-900 dark:text-slate-100 text-sm flex items-center gap-1.5">
              <span>🏠 {item.project_parcel_code}</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              Phân khu: <strong className="text-indigo-600 dark:text-indigo-400">{item.zone_id}</strong>
            </div>
          </div>
        )}
      </td>

      {/* 3. Địa chỉ & Chủ sở hữu */}
      <td className="p-3 min-w-[200px]">
        <div
          className="font-semibold text-slate-800 dark:text-slate-200 max-w-xs xl:max-w-md truncate"
          title={`${item.house_number || ''} ${item.street || ''}`}
        >
          {item.house_number ? `${item.house_number} ` : ''}
          {item.street || 'Chưa cập nhật địa chỉ'}
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 whitespace-nowrap">
          {item.unit_owner_name ? (
            <span className="text-purple-700 dark:text-purple-400 font-medium flex items-center gap-0.5">
              <User className="w-3 h-3 shrink-0" /> Chủ hộ: {item.unit_owner_name}
            </span>
          ) : item.owner_name ? (
            <span className="text-slate-600 dark:text-slate-400 flex items-center gap-0.5">
              <User className="w-3 h-3 shrink-0" /> {item.owner_name}
            </span>
          ) : (
            <span className="text-slate-400">Không có thông tin chủ</span>
          )}
        </div>
      </td>

      {/* 4. Khảo Sát Viên */}
      <td className="p-3 whitespace-nowrap">
        <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>{item.surveyor_name || 'Khảo sát viên'}</span>
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
          {item.surveyor_code && <span>Mã: {item.surveyor_code}</span>}
          {item.updated_at && (
            <span className="ml-1 text-slate-400">
              • {new Date(item.updated_at).toLocaleDateString('vi-VN')}
            </span>
          )}
        </div>
      </td>

      {/* 5. Cấp Nguy Cơ (Burland) */}
      <td className="p-3 text-center whitespace-nowrap">{renderBurlandBadge()}</td>

      {/* 6. Trạng Thái Hồ Sơ */}
      <td className="p-3 text-center whitespace-nowrap">{renderStatusBadge()}</td>

      {/* 7. Khuyết Tật & Quy Cách (Gộp) */}
      <td className="p-3 text-center whitespace-nowrap">
        <div className="flex flex-col items-center gap-1">
          <span className="font-black text-slate-800 dark:text-slate-100 text-xs">
            {item.defect_count || 0} <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">vết nứt / D</span>
          </span>
          {Number(item.alert_count) > 0 ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 whitespace-nowrap">
              <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
              <span>{item.alert_count} cờ kiểm soát</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold whitespace-nowrap">
              <CheckCircle2 className="w-3 h-3 shrink-0" />
              <span>Chuẩn quy cách</span>
            </span>
          )}
        </div>
      </td>

      {/* 8. Thao Tác Thẩm Định */}
      <td className="p-3 text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-1.5">
          {/* Nút Thao Tác Chính */}
          <button
            type="button"
            disabled={!item.report_id}
            onClick={() => onOpenStudio(item.report_id)}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer ${
              !item.report_id
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 cursor-not-allowed'
                : item.status === 'APPROVED'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                : item.status === 'REJECTED'
                ? 'bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
            }`}
            title={
              !item.report_id
                ? 'Chưa có báo cáo kỹ thuật'
                : item.status === 'APPROVED'
                ? 'Xem hồ sơ kỹ thuật đã phê duyệt'
                : item.status === 'REJECTED'
                ? 'Xem chi tiết hồ sơ bị trả về'
                : 'Mở Studio thẩm định kỹ thuật toàn diện 9 bước'
            }
          >
            <Eye className="w-3.5 h-3.5 shrink-0" />
            <span>
              {item.status === 'APPROVED'
                ? 'Xem hồ sơ'
                : item.status === 'REJECTED'
                ? 'Xem lý do'
                : 'Thẩm định 🔍'}
            </span>
          </button>

          {/* Nút Xem Lịch Sử Kiểm Toán / Truy Vết Nhanh */}
          {onOpenAuditHistory && (
            <button
              type="button"
              onClick={() => onOpenAuditHistory(item.report_id || item.parcel_id, item.display_code || item.unit_code || item.project_parcel_code)}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-950 text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 border border-slate-200 dark:border-slate-700 hover:border-sky-300 transition-colors cursor-pointer"
              title="Xem toàn bộ nhật ký kiểm toán và lịch sử sửa đổi"
            >
              <History className="w-4 h-4" />
            </button>
          )}

          {/* Nút Mở Lại Hồ Sơ (Chuyển về Đang làm dở) cho Zone Admin / Super Admin */}
          {onOpenRevertModal && item.report_id && item.status !== 'IN_PROGRESS' && (
            <button
              type="button"
              onClick={() => onOpenRevertModal(item)}
              className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 transition-colors cursor-pointer"
              title="Mở lại hồ sơ (Chuyển về Đang làm dở)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
});

ReviewQueueTableRow.displayName = 'ReviewQueueTableRow';
