import React from 'react';
import { Edit3, AlertCircle, Check, RefreshCw, Eye, Printer, ShieldCheck } from 'lucide-react';
import { EditFormData, EditFormDefectItem } from '../../types';
import { GeneralAndFoundationSection } from './edit-form/GeneralAndFoundationSection';
import { AdjacentAndDeformationSection } from './edit-form/AdjacentAndDeformationSection';
import { BurlandAndDefectsSection } from './edit-form/BurlandAndDefectsSection';
import { RiskAssessmentAndConclusionsSection } from './edit-form/RiskAssessmentAndConclusionsSection';

interface Phase1EditFormTabProps {
  editFormData: EditFormData;
  hasUnsavedChanges: boolean;
  isSavingEdits: boolean;
  defectFilterQuery: string;
  setDefectFilterQuery: (query: string) => void;
  handleUpdateFormField: <K extends keyof EditFormData>(field: K, value: EditFormData[K]) => void;
  handleUpdateDefectField: (defectId: string, field: keyof EditFormDefectItem, value: any) => void;
  handleAddDefect: () => void;
  handleDeleteDefect: (defectId: string) => void;
  handleApplyPreviewWithoutSaving: () => void;
  handleDirectPrint: () => void;
}

export const Phase1EditFormTab: React.FC<Phase1EditFormTabProps> = ({
  editFormData,
  hasUnsavedChanges,
  isSavingEdits,
  defectFilterQuery,
  setDefectFilterQuery,
  handleUpdateFormField,
  handleUpdateDefectField,
  handleAddDefect,
  handleDeleteDefect,
  handleApplyPreviewWithoutSaving,
  handleDirectPrint,
}) => {
  return (
    <div className="space-y-4">
      {/* Edit Banner & Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase text-slate-800 tracking-wide flex items-center gap-1.5">
                <Edit3 size={14} className="text-amber-600" /> CHỈNH SỬA DỮ LIỆU & TOÀN BỘ CHỈ SỐ BÁO CÁO
              </span>
              {hasUnsavedChanges ? (
                <span className="text-[11px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <AlertCircle size={11} /> Có thay đổi trong phiên
                </span>
              ) : (
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Check size={11} /> Đã nạp đầy đủ thông số
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Cho phép can thiệp mọi chỉ số từ Móng, Liền kề, Biến dạng, Burland, Cờ kết cấu, ECS (E1-E6), VI (V1-V6), BRA đến Kết luận.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleApplyPreviewWithoutSaving}
              disabled={isSavingEdits}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
              title="Áp dụng dữ liệu tùy biến vào bản xem trước mà không ghi vào Database"
            >
              {isSavingEdits ? <RefreshCw size={13} className="animate-spin" /> : <Eye size={13} />}
              <span>{isSavingEdits ? '⏳ Đang tạo lại bản in...' : '⚡ Cập Nhật Bản In Xem Trước'}</span>
            </button>

            <button
              type="button"
              onClick={handleDirectPrint}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
              title="In trực tiếp bản báo cáo ra máy in (Ctrl+P / Cmd+P)"
            >
              <Printer size={13} />
              <span>🖨️ In Ngay</span>
            </button>
          </div>
        </div>

        {/* Data Safety Callout Notice - Emerald Shield */}
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-3 text-[11px] text-emerald-950 flex items-start gap-2.5 shadow-sm">
          <ShieldCheck size={20} className="text-emerald-600 mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <div className="font-black text-emerald-900 flex items-center gap-1.5 uppercase tracking-wide text-[11.5px]">
              <span>🛡️ CHẾ ĐỘ CHỈNH SỬA PHỤC VỤ IN ẤN (PRINT-ONLY) — DATABASE ĐÃ KHÓA BẢO VỆ 100%</span>
            </div>
            <p className="text-emerald-800 leading-relaxed">
              Mọi thao tác chỉnh sửa thông số tại đây <strong>chỉ phục vụ mục đích xuất bản in A4, PDF và DOCX</strong>. Hệ thống <strong>NGHIÊM CẤM và ĐÃ VÔ HIỆU HÓA HOÀN TOÀN TẤT CẢ CÁC LỆNH GHI VÀO DATABASE</strong>. Cơ sở dữ liệu gốc của dự án được bảo toàn an toàn tuyệt đối 100%.
            </p>
          </div>
        </div>
      </div>

      {/* Sections 0 - 3 */}
      <GeneralAndFoundationSection
        editFormData={editFormData}
        handleUpdateFormField={handleUpdateFormField}
      />

      {/* Sections 4 - 7 */}
      <AdjacentAndDeformationSection
        editFormData={editFormData}
        handleUpdateFormField={handleUpdateFormField}
      />

      {/* Sections 8 - 9 */}
      <BurlandAndDefectsSection
        editFormData={editFormData}
        defectFilterQuery={defectFilterQuery}
        setDefectFilterQuery={setDefectFilterQuery}
        handleUpdateFormField={handleUpdateFormField}
        handleUpdateDefectField={handleUpdateDefectField}
        handleAddDefect={handleAddDefect}
        handleDeleteDefect={handleDeleteDefect}
      />

      {/* Sections 10 - 14 */}
      <RiskAssessmentAndConclusionsSection
        editFormData={editFormData}
        handleUpdateFormField={handleUpdateFormField}
      />
    </div>
  );
};
