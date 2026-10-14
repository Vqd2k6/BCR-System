import React, { useState, useRef, useEffect } from 'react';
import {
  Eye,
  FileText,
  XCircle,
  ArrowRightLeft,
  Split,
  CheckCircle2,
  AlertTriangle,
  Building,
  Home,
  User,
  Clock,
  MoreHorizontal,
  Move,
  History,
  ShieldCheck,
} from 'lucide-react';
import type { PendingSubmissionItem } from './ZoneAuditReviewQueue';

interface Props {
  item: PendingSubmissionItem;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (reportId: string, checked: boolean) => void;
  onOpenStudio: (reportId: string | null) => void;
  onPreviewReport: (reportId: string | null) => void;
  onOpenRejectModal: (item: PendingSubmissionItem) => void;
  onOpenReassignModal: (item: PendingSubmissionItem) => void;
  onOpenMutationModal: (item: PendingSubmissionItem) => void;
  onOpenReshapeModal?: (item: PendingSubmissionItem) => void;
  onOpenAuditHistory?: (reportId: string) => void;
}

export const ReviewQueueTableRow: React.FC<Props> = React.memo(({
  item,
  selectable = false,
  selected = false,
  onSelect,
  onOpenStudio,
  onPreviewReport,
  onOpenRejectModal,
  onOpenReassignModal,
  onOpenMutationModal,
  onOpenReshapeModal,
  onOpenAuditHistory,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<'down' | 'up'>('down');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleToggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (window.innerHeight - rect.bottom < 180) {
      setMenuPos('up');
    } else {
      setMenuPos('down');
    }
    setMenuOpen((prev) => !prev);
  };

  const isCriticalBurland = ['GRADE_3', 'GRADE_4', 'GRADE_5'].includes(
    item.burland_damage_category || ''
  );
  const hasAlerts = Number(item.alert_count) > 0;
  const canBatchApprove = item.status === 'SUBMITTED' && (item.defect_count === 0 && (item.burland_damage_category === 'GRADE_0' || !item.burland_damage_category));

  // Render Status Badge
  const renderStatusBadge = () => {
    if (item.unit_status === 'POSTPONED_ABSENT_VERIFIED' || item.parcel_status === 'POSTPONED_ABSENT_VERIFIED') {
      return (
        <div className="flex flex-col gap-0.5">
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
        <div className="flex flex-col gap-0.5">
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
        <div className="flex flex-col gap-0.5">
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
        <div className="flex flex-col gap-0.5">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300 w-fit whitespace-nowrap">
            <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
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
    return (
      <div className="flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 w-fit whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse shrink-0" />
          <span>Chờ thẩm định</span>
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
      className={`hover:bg-slate-50/80 transition-colors ${
        isCriticalBurland ? 'bg-orange-50/30' : hasAlerts ? 'bg-amber-50/20' : ''
      }`}
    >
      {/* 0. Optional Checkbox */}
      {selectable && (
        <td className="p-3.5 text-center">
          <input
            type="checkbox"
            checked={Boolean(selected)}
            disabled={!canBatchApprove}
            onChange={(e) => onSelect && item.report_id && onSelect(item.report_id, e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
            title={canBatchApprove ? 'Chọn để duyệt hàng loạt' : 'Chỉ có thể chọn căn hộ Grade 0 không có khuyết tật'}
          />
        </td>
      )}

      {/* 1. Mã Thửa / Căn Hộ */}
      <td className="p-3.5 whitespace-nowrap">
        {item.unit_type === 'MASTER' || item.unit_code?.startsWith('M-') ? (
          <div>
            <div className="font-mono font-black text-teal-800 text-sm flex items-center gap-1.5">
              <span>🏛️ {item.display_code || item.unit_code}</span>
            </div>
            <div className="text-[11px] text-teal-600 font-mono mt-0.5">
              Khu dùng chung • Tòa {item.parent_parcel_code || item.project_parcel_code}
            </div>
          </div>
        ) : item.unit_type === 'UNIT' || item.unit_code?.startsWith('U-') ? (
          <div>
            <div className="font-mono font-black text-purple-800 text-sm flex items-center gap-1.5">
              <span>🚪 {item.display_code || item.unit_code}</span>
              {item.unit_floor_number && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-100 text-purple-700">
                  T{item.unit_floor_number}
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
              Tòa {item.parent_parcel_code || item.project_parcel_code}
            </div>
          </div>
        ) : item.building_type?.includes('CONDO') ? (
          <div>
            <div className="font-mono font-black text-indigo-900 text-sm flex items-center gap-1.5">
              <span>🏢 {item.project_parcel_code}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 font-sans font-bold">
                Tòa Mẹ
              </span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
              Phân khu: <strong className="text-indigo-600">{item.zone_id}</strong>
            </div>
          </div>
        ) : (
          <div>
            <div className="font-mono font-black text-slate-900 text-sm flex items-center gap-1.5">
              <span>🏠 {item.project_parcel_code}</span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
              Phân khu: <strong className="text-indigo-600">{item.zone_id}</strong>
            </div>
          </div>
        )}
      </td>

      {/* 2. Địa chỉ & Chủ sở hữu */}
      <td className="p-3.5 min-w-[220px]">
        <div
          className="font-semibold text-slate-800 max-w-xs xl:max-w-md 2xl:max-w-lg truncate"
          title={`${item.house_number || ''} ${item.street || ''}`}
        >
          {item.house_number ? `${item.house_number} ` : ''}
          {item.street || 'Chưa cập nhật địa chỉ'}
        </div>
        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 whitespace-nowrap">
          {item.unit_owner_name ? (
            <span className="text-purple-700 font-medium flex items-center gap-0.5">
              <User className="w-3 h-3 shrink-0" /> Chủ hộ: {item.unit_owner_name}
            </span>
          ) : item.owner_name ? (
            <span className="text-slate-600 flex items-center gap-0.5">
              <User className="w-3 h-3 shrink-0" /> {item.owner_name}
            </span>
          ) : (
            <span className="text-slate-400">Không có thông tin chủ</span>
          )}
        </div>
      </td>

      {/* 3. Khảo Sát Viên */}
      <td className="p-3.5 whitespace-nowrap">
        <div className="font-bold text-slate-800 flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>{item.surveyor_name || 'Khảo sát viên'}</span>
        </div>
        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
          {item.surveyor_code && <span>Mã: {item.surveyor_code}</span>}
          {item.updated_at && (
            <span className="ml-1 text-slate-400">
              • {new Date(item.updated_at).toLocaleDateString('vi-VN')}
            </span>
          )}
        </div>
      </td>

      {/* 4. Trạng Thái Hồ Sơ */}
      <td className="p-3.5 text-center whitespace-nowrap">{renderStatusBadge()}</td>

      {/* 5. Cấp Nguy Cơ (Burland) */}
      <td className="p-3.5 text-center whitespace-nowrap">{renderBurlandBadge()}</td>

      {/* 6. Khuyết Tật */}
      <td className="p-3.5 text-center whitespace-nowrap">
        <span className="font-black text-slate-800 text-sm">
          {item.defect_count || 0}
        </span>
        <span className="text-[11px] text-slate-500 block">vết nứt / D</span>
      </td>

      {/* 7. Cảnh Báo Kỹ Thuật */}
      <td className="p-3.5 text-center whitespace-nowrap">
        {Number(item.alert_count) > 0 ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-700 border border-red-300 whitespace-nowrap">
            <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
            <span>{item.alert_count} cờ kiểm soát</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-semibold whitespace-nowrap">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Chuẩn quy cách</span>
          </span>
        )}
      </td>

      {/* 8. Thao Tác Thẩm Định */}
      <td className="p-3.5 text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-1.5">
          {/* Nút Thao Tác Chính */}
          <button
            disabled={!item.report_id}
            onClick={() => onOpenStudio(item.report_id)}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors ${
              !item.report_id
                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                : item.status === 'APPROVED'
                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-pointer'
                : item.status === 'REJECTED'
                ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 cursor-pointer'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-indigo-200'
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

          {/* Nút Xem Bản In Preview HTML/PDF */}
          {item.report_id && (
            <button
              onClick={() => onPreviewReport(item.report_id)}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
              title="Xem trước bản in Báo cáo A4 (Preview HTML)"
            >
              <FileText className="w-4 h-4" />
            </button>
          )}

          {/* Nút Xem Lịch Sử Kiểm Toán / Truy Vết Nhanh */}
          {item.report_id && onOpenAuditHistory && (
            <button
              type="button"
              onClick={() => onOpenAuditHistory(item.report_id!)}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-sky-50 text-slate-600 hover:text-sky-600 border border-slate-200 hover:border-sky-300 transition-colors cursor-pointer"
              title="Xem toàn bộ nhật ký kiểm toán và lịch sử sửa đổi"
            >
              <History className="w-4 h-4" />
            </button>
          )}

          {/* Dropdown menu thao tác nâng cao */}
          <div className="relative inline-block text-left" ref={menuRef}>
            <button
              type="button"
              onClick={handleToggleMenu}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
              title="Thao tác nâng cao khác"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div
                className={`absolute right-0 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-40 text-left transition-all ${
                  menuPos === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                }`}
              >
                <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                  Thao tác thửa đất
                </div>

                {/* Trả về */}
                {item.report_id && item.status !== 'APPROVED' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenRejectModal(item);
                    }}
                    className="w-full px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Yêu cầu khảo sát lại</span>
                  </button>
                )}

                {/* Hoán đổi ranh GIS */}
                {item.report_id && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenReassignModal(item);
                    }}
                    className="w-full px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-50 flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <ArrowRightLeft className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Hoán đổi vị trí ranh GIS</span>
                  </button>
                )}

                {/* Tách / Gộp GIS */}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenMutationModal(item);
                  }}
                  className="w-full px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Split className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Tách / Gộp thửa trên GIS</span>
                </button>

                {/* Nắn chỉnh đa giác ranh GIS */}
                {onOpenReshapeModal && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenReshapeModal(item);
                    }}
                    className="w-full px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Move className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Nắn chỉnh đa giác ranh GIS</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
});

ReviewQueueTableRow.displayName = 'ReviewQueueTableRow';
