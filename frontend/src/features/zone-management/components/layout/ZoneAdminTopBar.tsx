import React, { useState } from 'react';
import {
  ChevronRight,
  FlaskConical,
} from 'lucide-react';
import { ForensicImageLabModal } from '../../../image-lab/ForensicImageLabModal';

interface Props {
  title: string;
  subtitle?: string;
  selectedZone: string;
  isLoading?: boolean;
  onRefresh?: () => void;
  onAlertClick?: () => void;
}

export const ZoneAdminTopBar: React.FC<Props> = ({
  title,
  selectedZone,
}) => {
  const [showImageLabModal, setShowImageLabModal] = useState(false);

  return (
    <header className="h-16 px-4 sm:px-6 bg-white border-b border-slate-200 flex items-center justify-between gap-4 shrink-0 shadow-xs z-20">
      {/* Breadcrumbs & Title */}
      <div className="flex items-center gap-2 overflow-hidden">
        <span className="text-xs font-bold text-slate-400 hidden sm:inline">Phân hệ Quản trị Zone</span>
        <ChevronRight size={14} className="text-slate-300 hidden sm:inline" />
        <div className="flex items-center gap-2 truncate">
          <h1 className="text-sm sm:text-base font-black text-slate-800 truncate">
            {title}
          </h1>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
            {selectedZone === 'ALL' ? 'Toàn tuyến' : selectedZone}
          </span>
        </div>
      </div>

      {/* Nút mở Module Test Xử Lý Ảnh Vết Nứt (Forensic Image Lab Sandbox) */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setShowImageLabModal(true)}
          className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-all cursor-pointer active:scale-95 shadow-2xs"
          title="Mở Phòng thí nghiệm kiểm định thuật toán làm rõ vết nứt & khử tối ảnh"
        >
          <FlaskConical size={15} className="text-indigo-600" />
          <span>Test Xử Lý Ảnh Nứt</span>
        </button>
      </div>

      <ForensicImageLabModal
        isOpen={showImageLabModal}
        onClose={() => setShowImageLabModal(false)}
      />
    </header>
  );
};
