import React from 'react';
import {
  FileCheck,
  AlertCircle,
  Eye,
  Edit3,
  Code,
  X,
  Check,
  Info,
  RefreshCw,
  Printer,
  Download,
  FileType,
} from 'lucide-react';
import {
  ExportParcelItem,
  EditFormData,
  EditFormDefectItem,
  ModalFeedbackMessage,
} from '../../types';
import { buildReportPayload } from '../../utils/reportDataTransformers';
import { Phase1HtmlTab } from './Phase1HtmlTab';
import { Phase1EditFormTab } from './Phase1EditFormTab';
import { Phase1JsonTab } from './Phase1JsonTab';

interface Phase1PreviewModalProps {
  previewParcel: ExportParcelItem | null;
  setPreviewParcel: (parcel: ExportParcelItem | null) => void;
  previewHtmlContent: string | null;
  previewBlobUrl: string | null;
  previewReportData: any;
  previewTab: 'html' | 'edit' | 'json';
  setPreviewTab: (tab: 'html' | 'edit' | 'json') => void;
  isPreviewLoading: boolean;
  previewZoom: 'fit' | '100' | '75' | '125';
  setPreviewZoom: (zoom: 'fit' | '100' | '75' | '125') => void;
  previewRenderKey: number;
  isSavingEdits: boolean;
  hasUnsavedChanges: boolean;
  editFormData: EditFormData | null;
  defectFilterQuery: string;
  setDefectFilterQuery: (query: string) => void;
  modalFeedback: ModalFeedbackMessage | null;
  setModalFeedback: (feedback: ModalFeedbackMessage | null) => void;
  handleOpenPreview: (parcel: ExportParcelItem) => void;
  handleUpdateFormField: <K extends keyof EditFormData>(field: K, value: EditFormData[K]) => void;
  handleUpdateDefectField: (defectId: string, field: keyof EditFormDefectItem, value: any) => void;
  handleAddDefect: () => void;
  handleDeleteDefect: (defectId: string) => void;
  handleApplyPreviewWithoutSaving: () => void;
  handleSwitchTab: (targetTab: 'html' | 'edit' | 'json') => Promise<void>;
  handleOpenPreviewInNewTab: () => void;
  handleDirectPrint: () => void;
  handleExportSingleDocx: (parcel: ExportParcelItem, overrides?: any) => void;
  handleExportSinglePdf: (parcel: ExportParcelItem, overrides?: any) => void;
}

export const Phase1PreviewModal: React.FC<Phase1PreviewModalProps> = ({
  previewParcel,
  setPreviewParcel,
  previewHtmlContent,
  previewBlobUrl,
  previewReportData,
  previewTab,
  setPreviewTab,
  isPreviewLoading,
  previewZoom,
  setPreviewZoom,
  previewRenderKey,
  isSavingEdits,
  hasUnsavedChanges,
  editFormData,
  defectFilterQuery,
  setDefectFilterQuery,
  modalFeedback,
  setModalFeedback,
  handleOpenPreview,
  handleUpdateFormField,
  handleUpdateDefectField,
  handleAddDefect,
  handleDeleteDefect,
  handleApplyPreviewWithoutSaving,
  handleSwitchTab,
  handleOpenPreviewInNewTab,
  handleDirectPrint,
  handleExportSingleDocx,
  handleExportSinglePdf,
}) => {
  if (!previewParcel) return null;

  return (
    <div
      className="fixed inset-0 z-[999999] bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto"
      onClick={() => setPreviewParcel(null)}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-6xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/20 text-sky-400 rounded-xl border border-sky-400/30">
              <FileCheck size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Hồ Sơ Hiện Trạng: {previewParcel.projectParcelCode}</span>
                <span className="text-[10px] bg-sky-500/30 text-sky-200 px-2 py-0.5 rounded-full font-mono">
                  Phase 1 BCS
                </span>
                {hasUnsavedChanges && (
                  <span className="text-[10px] bg-amber-500/30 text-amber-300 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <AlertCircle size={10} /> Có thay đổi chưa lưu
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-300">
                Chủ hộ: <strong className="text-white">{editFormData?.ownerName || previewParcel.ownerName}</strong> | Địa chỉ: {editFormData?.houseNumber || previewParcel.houseNumber} {editFormData?.street || previewParcel.street}
              </p>
            </div>
          </div>

          {/* Tab Switcher & Actions */}
          <div className="flex items-center gap-2">
            <div className="bg-slate-800 p-1 rounded-xl flex items-center gap-1 border border-slate-700">
              <button
                onClick={() => handleSwitchTab('html')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  previewTab === 'html'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Eye size={13} />
                <span>Bản In HTML</span>
              </button>

              <button
                onClick={() => handleSwitchTab('edit')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 relative ${
                  previewTab === 'edit'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Edit3 size={13} />
                <span>Sửa Dữ Liệu Trực Tiếp</span>
                {hasUnsavedChanges && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                )}
              </button>

              <button
                onClick={() => handleSwitchTab('json')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  previewTab === 'json'
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Code size={13} />
                <span>Payload JSON</span>
              </button>
            </div>

            <button
              onClick={() => setPreviewParcel(null)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors ml-1"
              title="Đóng modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Internal Alert/Feedback Banner */}
        {modalFeedback && (
          <div
            className={`px-5 py-3 border-b flex items-center justify-between gap-3 text-xs transition-all animate-in fade-in slide-in-from-top-2 duration-200 ${
              modalFeedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-950 border-emerald-300'
                : modalFeedback.type === 'error'
                ? 'bg-rose-50 text-rose-950 border-rose-300'
                : 'bg-sky-50 text-sky-950 border-sky-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {modalFeedback.type === 'success' ? (
                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Check size={14} />
                </div>
              ) : modalFeedback.type === 'error' ? (
                <div className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                  <AlertCircle size={14} />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-sky-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Info size={14} />
                </div>
              )}
              <div>
                <span className="font-bold">{modalFeedback.text}</span>
                <span className="text-[10px] text-slate-500 ml-2">({modalFeedback.timestamp})</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setModalFeedback(null)}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-100/90">
          {isPreviewLoading ? (
            <div className="h-72 flex flex-col items-center justify-center text-xs font-bold text-slate-500 gap-3">
              <RefreshCw className="animate-spin text-sky-600" size={24} />
              <span>Đang biên dịch Handlebars template & đồng bộ dữ liệu khảo sát...</span>
            </div>
          ) : previewTab === 'html' ? (
            <Phase1HtmlTab
              previewParcel={previewParcel}
              previewHtmlContent={previewHtmlContent}
              previewBlobUrl={previewBlobUrl}
              previewRenderKey={previewRenderKey}
              previewZoom={previewZoom}
              setPreviewZoom={setPreviewZoom}
              setPreviewTab={setPreviewTab}
              handleOpenPreviewInNewTab={handleOpenPreviewInNewTab}
              handleOpenPreview={handleOpenPreview}
              handleExportSinglePdf={handleExportSinglePdf}
              handleExportSingleDocx={handleExportSingleDocx}
              editFormData={editFormData}
              previewReportData={previewReportData}
            />
          ) : previewTab === 'edit' && editFormData ? (
            <Phase1EditFormTab
              editFormData={editFormData}
              hasUnsavedChanges={hasUnsavedChanges}
              isSavingEdits={isSavingEdits}
              defectFilterQuery={defectFilterQuery}
              setDefectFilterQuery={setDefectFilterQuery}
              handleUpdateFormField={handleUpdateFormField}
              handleUpdateDefectField={handleUpdateDefectField}
              handleAddDefect={handleAddDefect}
              handleDeleteDefect={handleDeleteDefect}
              handleApplyPreviewWithoutSaving={handleApplyPreviewWithoutSaving}
              handleDirectPrint={handleDirectPrint}
            />
          ) : (
            <Phase1JsonTab
              previewReportData={previewReportData}
              previewParcel={previewParcel}
            />
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>Tiêu chuẩn mẫu báo cáo Liên danh CRLG-CRSRI-TT</span>
            {hasUnsavedChanges && (
              <span className="text-amber-600 font-bold bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full flex items-center gap-1 text-[11px]">
                <AlertCircle size={12} /> Có thay đổi trong phiên
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPreviewParcel(null)}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            >
              Đóng
            </button>

            {previewTab === 'edit' && (
              <button
                type="button"
                onClick={handleApplyPreviewWithoutSaving}
                disabled={isSavingEdits}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
                title="Cập nhật ngay vào bản in xem trước (Hoàn toàn KHÔNG ghi vào DB)"
              >
                {isSavingEdits ? <RefreshCw size={14} className="animate-spin" /> : <Eye size={14} />}
                <span>{isSavingEdits ? '⏳ Đang tạo lại bản in...' : '⚡ Cập Nhật Bản In'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDirectPrint}
              disabled={isSavingEdits}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
              title="In trực tiếp bản báo cáo ra máy in giấy hoặc PDF trình duyệt"
            >
              <Printer size={14} />
              <span>🖨️ In Ngay</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (previewParcel) {
                  const payload = editFormData ? buildReportPayload(editFormData, previewReportData) : undefined;
                  handleExportSinglePdf(previewParcel, payload);
                }
              }}
              disabled={isSavingEdits}
              className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-md shadow-sky-200 flex items-center gap-1.5"
              title="Xuất file PDF với toàn bộ thông số đã chỉnh sửa (Không làm thay đổi DB)"
            >
              {isSavingEdits ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
              <span>Xuất Tải PDF</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (previewParcel) {
                  const payload = editFormData ? buildReportPayload(editFormData, previewReportData) : undefined;
                  handleExportSingleDocx(previewParcel, payload);
                }
              }}
              disabled={isSavingEdits}
              className="px-3.5 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors shadow-md shadow-violet-200 flex items-center gap-1.5"
              title="Xuất file DOCX với toàn bộ thông số đã chỉnh sửa (Không làm thay đổi DB)"
            >
              <FileType size={14} />
              <span>Xuất DOCX</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
