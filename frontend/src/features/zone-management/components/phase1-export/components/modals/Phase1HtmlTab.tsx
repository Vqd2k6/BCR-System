import React, { useState } from 'react';
import {
  Info,
  ExternalLink,
  Edit3,
  Download,
  Printer,
  AlertCircle,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen,
  Sliders,
  Stamp,
} from 'lucide-react';
import { ExportParcelItem, EditFormData } from '../../types';
import { buildReportPayload } from '../../utils/reportDataTransformers';

interface Phase1HtmlTabProps {
  previewParcel: ExportParcelItem;
  previewHtmlContent: string | null;
  previewBlobUrl: string | null;
  previewRenderKey: number;
  previewZoom: 'fit' | '100' | '75' | '125';
  setPreviewZoom: (zoom: 'fit' | '100' | '75' | '125') => void;
  setPreviewTab: (tab: 'html' | 'edit' | 'json') => void;
  handleOpenPreviewInNewTab: () => void;
  handleOpenPreview: (parcel: ExportParcelItem) => void;
  handleExportSinglePdf: (parcel: ExportParcelItem, overrides?: any) => void;
  handleExportSingleDocx: (parcel: ExportParcelItem, overrides?: any) => void;
  editFormData: EditFormData | null;
  previewReportData: any;
  reportVersion?: 'v2' | 'v1';
  handleDirectPrint?: () => void;
  enableWatermark?: boolean;
  handleToggleWatermark?: (enabled: boolean) => void;
}

export const Phase1HtmlTab: React.FC<Phase1HtmlTabProps> = ({
  previewParcel,
  previewHtmlContent,
  previewBlobUrl,
  previewRenderKey,
  previewZoom,
  setPreviewZoom,
  setPreviewTab,
  handleOpenPreviewInNewTab,
  handleOpenPreview,
  handleExportSinglePdf,
  handleExportSingleDocx,
  editFormData,
  previewReportData,
  reportVersion = 'v2',
  handleDirectPrint,
  enableWatermark = true,
  handleToggleWatermark,
}) => {
  // Trạng thái hiển thị thanh điều khiển bên trái (mặc định mở, có thể thu gọn để xem Full A4)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleExportPdf = () => {
    const payload = editFormData ? buildReportPayload(editFormData, previewReportData) : undefined;
    handleExportSinglePdf(previewParcel, payload);
  };

  return (
    <div className="flex flex-1 w-full h-[calc(94vh-130px)] min-h-[580px] overflow-hidden bg-slate-100 relative">
      {/* ========================================================================= */}
      {/* 1. CỘT TRÁI: BẢNG ĐIỀU KHIỂN (COLLAPSIBLE CONTROL SIDEBAR - 320px)       */}
      {/* ========================================================================= */}
      <div
        className={`bg-white border-r border-slate-200 flex flex-col justify-between transition-all duration-300 ease-in-out z-20 shadow-sm ${
          isSidebarOpen
            ? 'w-80 sm:w-[320px] p-4 overflow-y-auto flex-shrink-0'
            : 'w-0 p-0 overflow-hidden border-r-0 opacity-0 pointer-events-none'
        }`}
      >
        <div className="space-y-4">
          {/* Header Bảng Điều Khiển */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
              <div className="p-1.5 bg-sky-50 text-sky-600 rounded-lg border border-sky-200">
                <Sliders size={14} />
              </div>
              <span>Bảng Điều Khiển</span>
            </div>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-medium"
              title="Thu gọn điều khiển để xem toàn màn hình A4"
            >
              <PanelLeftClose size={16} />
              <span className="hidden sm:inline">Ẩn</span>
            </button>
          </div>

          {/* Nhóm Hành Động Chính (Primary Actions) */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Thao Tác Báo Cáo
            </span>
            <button
              type="button"
              onClick={handleExportPdf}
              className="w-full py-2.5 px-3 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-600/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              title="Xuất file PDF chuẩn Song Ngữ 0410 Liên danh CRLG-CRSRI-TT"
            >
              <Download size={15} />
              <span>Xuất PDF Báo Cáo (0410)</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              {handleDirectPrint && (
                <button
                  type="button"
                  onClick={handleDirectPrint}
                  className="py-2 px-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                  title="In trực tiếp bản xem trước qua máy in"
                >
                  <Printer size={13} />
                  <span>In Ngay</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleOpenPreviewInNewTab}
                className={`py-2 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border border-slate-200 ${
                  !handleDirectPrint ? 'col-span-2' : ''
                }`}
                title="Mở toàn màn hình trong tab mới của trình duyệt"
              >
                <ExternalLink size={13} />
                <span>Mở Tab Mới</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setPreviewTab('edit')}
              className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
              title="Chỉnh sửa thông số, kích thước hoặc ghi chú khuyết tật"
            >
              <Edit3 size={13} className="text-amber-600" />
              <span>Sửa Dữ Liệu / Ghi Chú</span>
            </button>
          </div>

          {/* Nhóm Tính Năng Watermark (Bật / Tắt Con Dấu) */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                <Stamp size={14} className={enableWatermark ? "text-sky-600" : "text-slate-400"} />
                <span>Nhúng Watermark</span>
              </span>
              <button
                type="button"
                onClick={() => handleToggleWatermark?.(!enableWatermark)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  enableWatermark ? 'bg-sky-600' : 'bg-slate-300'
                }`}
                title={enableWatermark ? "Đang BẬT: Nhấp để TẮT nhúng watermark" : "Đã TẮT: Nhấp để BẬT nhúng watermark"}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    enableWatermark ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              {enableWatermark
                ? "Đang BẬT: Dập dấu THACO/CREC và ngày giờ lên ảnh."
                : "Đã TẮT: Giữ ảnh gốc sạch (dành cho ảnh đã có sẵn timestamp hiện trường)."}
            </p>
          </div>

          {/* Nhóm Thu Phóng Khung Nhìn A4 (Zoom Controls) */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Tỷ Lệ Khung Nhìn A4
              </span>
              <span className="text-[10px] text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded font-medium">
                {previewZoom === 'fit' ? 'Tự co giãn' : `${previewZoom}%`}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setPreviewZoom('fit')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center ${
                  previewZoom === 'fit'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
                title="Tự động co giãn vừa chiều rộng khung"
              >
                Vừa Khung
              </button>
              <button
                type="button"
                onClick={() => setPreviewZoom('100')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center ${
                  previewZoom === '100'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
                title="Tỷ lệ 100% chuẩn khổ giấy A4 thực tế"
              >
                100% (A4)
              </button>
              <button
                type="button"
                onClick={() => setPreviewZoom('75')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center ${
                  previewZoom === '75'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
                title="Thu nhỏ 75% - Xem tổng thể nhiều trang"
              >
                75% (Tổng Thể)
              </button>
              <button
                type="button"
                onClick={() => setPreviewZoom('125')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center ${
                  previewZoom === '125'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
                title="Phóng to 125% - Soi chi tiết vết nứt"
              >
                125% (Phóng To)
              </button>
            </div>
          </div>

          {/* Thẻ Tóm Tắt Thông Tin Thửa Đất (Parcel Summary Card) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Thông Tin Thửa Đất
            </span>
            <div className="flex items-center justify-between font-bold text-slate-800">
              <span className="text-sky-700">{previewParcel.projectParcelCode}</span>
              <span className="text-[10px] bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full font-mono">
                Phase 1 BCS
              </span>
            </div>
            <p className="text-slate-600 text-[11px] truncate">
              Chủ hộ: <strong className="text-slate-800">{editFormData?.ownerName || previewParcel.ownerName}</strong>
            </p>
            <p className="text-slate-500 text-[11px] truncate">
              Đ/c: {editFormData?.houseNumber || previewParcel.houseNumber} {editFormData?.street || previewParcel.street}
            </p>
            <div className="pt-1 flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-200/60">
              <span>Loại CT: {previewParcel.buildingType || 'Nhà phố'}</span>
              <span>Số tầng: {editFormData?.aboveFloors || previewParcel.floorCount || 1}</span>
            </div>
          </div>
        </div>

        {/* Footer Sidebar: Quy Chuẩn Kỹ Thuật */}
        <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 space-y-1">
          <p className="flex items-center gap-1.5 text-slate-700 font-semibold">
            <Info size={13} className="text-sky-600 flex-shrink-0" />
            <span>Chuẩn Song Ngữ 0410</span>
          </p>
          <p className="text-slate-500">Khổ in: A4 Portrait (210 × 297 mm)</p>
          <p className="text-slate-500">Gồm 9 chương & 4 phụ lục kỹ thuật</p>
          <p className="text-slate-400 italic text-[10px]">Cuộn dọc để duyệt các trang</p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. CỘT PHẢI: KHUNG XEM TRƯỚC A4 FULL DIỆN TÍCH (A4 PREVIEW STAGE)         */}
      {/* ========================================================================= */}
      <div className="flex-1 min-w-0 h-full relative flex flex-col items-center justify-start overflow-y-auto bg-slate-200/70 p-4 sm:p-6">
        {/* Nút Nổi Mở Lại Bảng Điều Khiển (Chỉ xuất hiện khi Sidebar đang đóng) */}
        {!isSidebarOpen && (
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="absolute top-4 left-4 z-30 px-3.5 py-2 bg-white/95 hover:bg-white text-slate-800 hover:text-sky-600 rounded-xl text-xs font-bold shadow-xl border border-slate-300/80 backdrop-blur-md flex items-center gap-2 transition-all hover:scale-105 active:scale-95 group animate-in fade-in slide-in-from-left-3 duration-200"
            title="Mở lại bảng điều khiển bên trái"
          >
            <PanelLeftOpen size={16} className="text-sky-600 group-hover:scale-110 transition-transform" />
            <span>Bảng Điều Khiển</span>
          </button>
        )}

        {/* Sân khấu Iframe A4 - Tận dụng 100% chiều cao và bề ngang */}
        {previewHtmlContent ? (
          <div
            className={`transition-all duration-200 flex justify-center w-full min-h-full ${
              previewZoom === '75'
                ? 'scale-75 origin-top -mb-48'
                : previewZoom === '125'
                ? 'scale-125 origin-top mb-44'
                : ''
            }`}
          >
            <iframe
              key={`report-preview-iframe-${previewRenderKey}`}
              src={previewBlobUrl || undefined}
              title="Report HTML Preview"
              className={`${
                previewZoom === 'fit' ? 'w-full max-w-[920px]' : 'w-[840px] max-w-full'
              } min-h-[calc(94vh-170px)] h-full border border-slate-300 rounded-md shadow-2xl bg-white block`}
            />
          </div>
        ) : (
          <div className="my-auto p-12 text-center flex flex-col items-center justify-center gap-3 bg-white rounded-2xl shadow-sm border border-slate-200 max-w-md">
            <AlertCircle size={36} className="text-amber-500 animate-pulse" />
            <span className="text-sm font-bold text-slate-800">
              Chưa nạp được HTML preview cho hồ sơ này
            </span>
            <p className="text-xs text-slate-500">
              Bạn có thể bấm &quot;Thử Nạp Lại&quot; hoặc chuyển sang tab &quot;Chỉnh Sửa Dữ Liệu&quot; để cập nhật thông số và xem trước.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => handleOpenPreview(previewParcel)}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md"
              >
                <RefreshCw size={14} />
                <span>Thử Nạp Lại HTML</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('edit')}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md"
              >
                <Edit3 size={14} />
                <span>Mở Chỉnh Sửa Dữ Liệu</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
