import React from 'react';
import {
  Home,
  User,
  Layers,
  Award,
  Activity,
  MapPin,
  Hash,
  FileCheck2,
  PenTool,
  Edit3,
  Undo2,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '../../../../../core/components/ui/Button';
import { useAuditStepwiseForm } from './hooks/useAuditStepwiseForm';
import { AuditStep1Identification } from './steps/AuditStep1Identification';
import { AuditStep2OwnerInterview } from './steps/AuditStep2OwnerInterview';
import { AuditStep3FloorDefects } from './steps/AuditStep3FloorDefects';
import { AuditStep4BurlandSummary } from './steps/AuditStep4BurlandSummary';
import { AuditStep5SettlementTilt } from './steps/AuditStep5SettlementTilt';
import { AuditStep6ScopeGisMutation } from './steps/AuditStep6ScopeGisMutation';
import { AuditStep7EcsViScores } from './steps/AuditStep7EcsViScores';
import { AuditStep8Conclusions } from './steps/AuditStep8Conclusions';
import { AuditStep9SignaturesAbsence } from './steps/AuditStep9SignaturesAbsence';

export interface AuditStepwiseDocumentViewProps {
  data: any;
  reportId: string;
  onRefresh: () => void;
  onOpenPhotoZoom: (url: string, title?: string, photoCode?: string) => void;
  onOpenPhotoReplace: (params: any) => void;
  onOpenDiffModal: (diffItems: any[], updates: any) => void;
  onOpenEngineeringJudgement: () => void;
}

export const AuditStepwiseDocumentView: React.FC<AuditStepwiseDocumentViewProps> = ({
  data,
  reportId,
  onRefresh,
  onOpenPhotoZoom,
  onOpenPhotoReplace,
  onOpenDiffModal,
  onOpenEngineeringJudgement,
}) => {
  const {
    isEditMode,
    setIsEditMode,
    activeNavStep,
    scrollToStep,
    formState,
    dirtyFields,
    dirtyCount,
    handleFieldChange,
    handleNestedFieldChange,
    handleDiscard,
    handleReviewSave,
  } = useAuditStepwiseForm({ data, onOpenDiffModal });

  const stepsList = [
    { id: 'step-1', number: '01', title: 'Định Danh & Cự Ly Tim Hầm', icon: Home },
    { id: 'step-2', number: '02', title: 'Kết Cấu & Phỏng Vấn', icon: User },
    { id: 'step-3', number: '03', title: 'Tầng, Vùng Z & Khuyết Tật D', icon: Layers },
    { id: 'step-4', number: '04', title: 'Tổng Hợp Nứt Burland', icon: Award },
    { id: 'step-5', number: '05', title: 'Đo Biến Dạng & Lún Nghiêng', icon: Activity },
    { id: 'step-6', number: '06', title: 'Phạm Vi KS & Biến Động GIS', icon: MapPin },
    { id: 'step-7', number: '07', title: 'Bảng Điểm Kỹ Thuật ECS & VI', icon: Hash },
    { id: 'step-8', number: '08', title: 'Kết Luận & Tác Động TBM', icon: FileCheck2 },
    { id: 'step-9', number: '09', title: 'Pháp Lý, Chữ Ký & Vắng Mặt', icon: PenTool },
  ];

  return (
    <div className="relative flex flex-col lg:flex-row gap-6 w-full min-h-[600px]">
      {/* 1. Thanh điều hướng Jump-links bên trái (Sticky Sidebar) */}
      <div className="w-full lg:w-72 shrink-0">
        <div className="sticky top-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-black uppercase text-sky-600 tracking-wider">
                Mục Lục Thẩm Định
              </span>
              <h4 className="text-sm font-black text-slate-800">9 Bước Khảo Sát</h4>
            </div>
            {/* Nút bật/tắt chế độ sửa hoặc badge đã khóa duyệt */}
            {data?.status === 'APPROVED' ? (
              <span className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 shadow-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Đã Khóa Duyệt</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditMode(!isEditMode)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer ${
                  isEditMode
                    ? 'bg-amber-500 text-white shadow-amber-500/20'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isEditMode ? 'Đang Hiệu Chỉnh' : 'Chế Độ Sửa'}</span>
              </button>
            )}
          </div>

          {/* Danh sách 9 bước */}
          <nav className="space-y-1">
            {stepsList.map((st) => {
              const Icon = st.icon;
              const isActive = activeNavStep === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => scrollToStep(st.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-between group cursor-pointer ${
                    isActive
                      ? 'bg-sky-50 text-sky-700 font-bold border border-sky-200'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-sky-600' : 'text-slate-400'}`} />
                    <span className="truncate">{st.title}</span>
                  </div>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isActive ? 'bg-sky-200/60 text-sky-800' : 'text-slate-400 group-hover:bg-slate-100'}`}>
                    {st.number}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Thanh công cụ Lưu / Hủy khi có thay đổi */}
          {isEditMode && dirtyCount > 0 && (
            <div className="pt-3 border-t border-amber-200 bg-amber-50/60 -mx-4 -mb-4 p-4 rounded-b-2xl space-y-2">
              <div className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>Đã sửa {dirtyCount} thông số</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDiscard}
                  className="flex-1 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Hủy</span>
                </button>
                <button
                  type="button"
                  onClick={handleReviewSave}
                  className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1 transition-colors shadow-xs cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Lưu Diff</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Nội dung chi tiết 9 bước khảo sát */}
      <div className="flex-1 space-y-6">
        <AuditStep1Identification
          isEditMode={isEditMode}
          formState={formState}
          data={data}
          handleFieldChange={handleFieldChange}
          onOpenPhotoZoom={onOpenPhotoZoom}
          onOpenPhotoReplace={onOpenPhotoReplace}
        />

        <AuditStep2OwnerInterview
          isEditMode={isEditMode}
          formState={formState}
          handleFieldChange={handleFieldChange}
          handleNestedFieldChange={handleNestedFieldChange}
          onOpenPhotoZoom={onOpenPhotoZoom}
        />

        <AuditStep3FloorDefects
          isEditMode={isEditMode}
          formState={formState}
          handleFieldChange={handleFieldChange}
          onOpenPhotoZoom={onOpenPhotoZoom}
          onOpenPhotoReplace={onOpenPhotoReplace}
        />

        <AuditStep4BurlandSummary
          isEditMode={isEditMode}
          formState={formState}
          data={data}
          handleFieldChange={handleFieldChange}
          handleNestedFieldChange={handleNestedFieldChange}
        />

        <AuditStep5SettlementTilt
          isEditMode={isEditMode}
          formState={formState}
          handleNestedFieldChange={handleNestedFieldChange}
        />

        <AuditStep6ScopeGisMutation
          isEditMode={isEditMode}
          formState={formState}
          data={data}
          reportId={reportId}
          handleNestedFieldChange={handleNestedFieldChange}
          handleFieldChange={handleFieldChange}
          onOpenPhotoZoom={onOpenPhotoZoom}
          onRefresh={onRefresh}
        />

        <AuditStep7EcsViScores
          data={data}
          onOpenEngineeringJudgement={onOpenEngineeringJudgement}
        />

        <AuditStep8Conclusions
          isEditMode={isEditMode}
          formState={formState}
          handleNestedFieldChange={handleNestedFieldChange}
        />

        <AuditStep9SignaturesAbsence
          isEditMode={isEditMode}
          formState={formState}
          data={data}
          handleFieldChange={handleFieldChange}
          handleNestedFieldChange={handleNestedFieldChange}
          onOpenPhotoZoom={onOpenPhotoZoom}
          onConfirmAbsenteeSurvey={onRefresh}
        />
      </div>
    </div>
  );
};
