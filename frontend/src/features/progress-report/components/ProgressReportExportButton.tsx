import React, { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { ProgressExportModal } from "./ProgressExportModal";

export interface ProgressReportExportButtonProps {
  /** Zone đang làm việc của màn hình chứa nút ('ALL' = toàn tuyến). */
  zoneId: string;
  /** Khóa chọn zone trong modal. */
  lockZone?: boolean;
  label?: string;
  className?: string;
}

/**
 * Điểm nhúng duy nhất của plugin Progress Report trên các màn hình khác.
 * Gỡ plugin: xóa dòng <ProgressReportExportButton .../> ở màn hình chứa.
 */
export const ProgressReportExportButton: React.FC<
  ProgressReportExportButtonProps
> = ({
  zoneId,
  lockZone = false,
  label = "Xuất Tiến Độ Ngày (.xlsx)",
  className = "",
}) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-all active:scale-95 cursor-pointer ${className}`}
        title="Xuất báo cáo tiến độ khảo sát theo mẫu Excel (hôm nay / khoảng ngày / lũy kế)"
      >
        <FileSpreadsheet className="w-4 h-4 shrink-0" />
        <span>{label}</span>
      </button>
      <ProgressExportModal
        isOpen={open}
        onClose={() => setOpen(false)}
        initialZoneId={zoneId}
        lockZone={lockZone}
      />
    </>
  );
};
