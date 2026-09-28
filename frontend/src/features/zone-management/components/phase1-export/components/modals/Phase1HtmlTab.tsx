import React from 'react';
import {
  Info,
  ExternalLink,
  Edit3,
  Download,
  FileType,
  AlertCircle,
  RefreshCw,
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
}) => {
  return (
    <div className="space-y-3">
      {/* Top quick banner inside HTML preview */}
      <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2 text-xs text-sky-900">
          <Info size={16} className="text-sky-600 flex-shrink-0" />
          <span>
            Đang xem trước bản in PDF chuẩn <strong>CRLG–CRSRI–TT</strong>. Khổ trang được khóa theo tỷ lệ chuẩn <strong>A4 Portrait (210 × 297 mm)</strong>.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenPreviewInNewTab}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            title="Mở toàn màn hình trong tab mới của trình duyệt"
          >
            <ExternalLink size={13} />
            <span>Mở Tab Mới</span>
          </button>
          <button
            onClick={() => setPreviewTab('edit')}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
          >
            <Edit3 size={13} />
            <span>Sửa Thông Tin / Ghi Chú Này</span>
          </button>
          <button
            onClick={() => {
              const payload = editFormData ? buildReportPayload(editFormData, previewReportData) : undefined;
              handleExportSinglePdf(previewParcel, payload);
            }}
            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            title="Xuất file PDF theo thông số hiện tại (Bảo toàn 100% DB)"
          >
            <Download size={13} />
            <span>Xuất PDF</span>
          </button>
          <button
            onClick={() => {
              const payload = editFormData ? buildReportPayload(editFormData, previewReportData) : undefined;
              handleExportSingleDocx(previewParcel, payload);
            }}
            className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            title="Xuất file DOCX theo thông số hiện tại (Bảo toàn 100% DB)"
          >
            <FileType size={13} />
            <span>Xuất DOCX</span>
          </button>
        </div>
      </div>

      {/* Control bar: Zoom & Scale */}
      <div className="bg-slate-800 text-slate-200 px-4 py-2 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs border border-slate-700 shadow-md">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-sky-950 text-sky-300 font-bold border border-sky-800/80">
            📄 Khổ in chuẩn: A4 Portrait (210 × 297 mm)
          </span>
          <span className="text-slate-400 text-[11px] hidden sm:inline">
            (Mô phỏng tờ giấy in thực tế - Cuộn dọc để duyệt 8 bước)
          </span>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-lg border border-slate-700">
          <span className="text-[11px] text-slate-400 px-2 font-medium">Khung nhìn:</span>
          <button
            type="button"
            onClick={() => setPreviewZoom('75')}
            className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
              previewZoom === '75'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
            title="Thu nhỏ 75% - Xem toàn cảnh nhiều trang cùng lúc"
          >
            75% (Toàn Cảnh)
          </button>
          <button
            type="button"
            onClick={() => setPreviewZoom('100')}
            className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
              previewZoom === '100'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
            title="Tỷ lệ 100% chuẩn khổ giấy A4 thật"
          >
            100% (Chuẩn A4)
          </button>
          <button
            type="button"
            onClick={() => setPreviewZoom('125')}
            className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
              previewZoom === '125'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
            title="Phóng to 125% - Soi chi tiết vết nứt & chữ ký"
          >
            125% (Phóng To)
          </button>
          <button
            type="button"
            onClick={() => setPreviewZoom('fit')}
            className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
              previewZoom === 'fit'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
            title="Tự động co giãn vừa khung xem"
          >
            Vừa Khung
          </button>
        </div>
      </div>

      {/* HTML Iframe Preview Workbench */}
      <div className="bg-slate-900/95 rounded-2xl p-4 sm:p-6 shadow-inner border border-slate-700/80 flex flex-col items-center justify-start overflow-y-auto max-h-[75vh]">
        {previewHtmlContent ? (
          <div
            className={`transition-all duration-200 flex justify-center w-full ${
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
                previewZoom === 'fit' ? 'w-full max-w-[860px]' : 'w-[840px] max-w-full'
              } h-[920px] border border-slate-600 rounded-md shadow-2xl bg-white block`}
            />
          </div>
        ) : (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <AlertCircle size={32} className="text-amber-400 animate-pulse" />
            <span className="text-sm font-bold text-slate-200">
              Chưa nạp được HTML preview cho hồ sơ này
            </span>
            <p className="text-xs text-slate-400 max-w-md">
              Bạn có thể bấm &quot;Thử Nạp Lại&quot; hoặc chuyển sang tab &quot;Chỉnh Sửa Dữ Liệu&quot; để cập nhật thông số và xem trước.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => handleOpenPreview(previewParcel)}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg"
              >
                <RefreshCw size={14} />
                <span>Thử Nạp Lại HTML</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('edit')}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg"
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
