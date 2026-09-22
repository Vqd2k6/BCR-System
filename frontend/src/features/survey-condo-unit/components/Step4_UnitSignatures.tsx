import React from 'react';
import { useCondoUnitSurveyStore } from '../store/useCondoUnitSurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import { Input } from '../../../core/components/ui/FormControls';
import {
  FileCheck,
  PenTool,
  Send,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';

interface Props {
  onSubmitFinal: () => void;
  isSubmitting?: boolean;
}

export const Step4_UnitSignatures: React.FC<Props> = ({ onSubmitFinal, isSubmitting }) => {
  const { formData, updateFormData, prevStep } = useCondoUnitSurveyStore();

  const isSignaturesComplete =
    Boolean(formData.surveyorSignature?.trim()) && Boolean(formData.ownerSignature?.trim());

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12 animate-in fade-in">
      {/* 4.1. Tóm tắt kết quả khảo sát căn hộ con */}
      <Card className="border-teal-200 bg-teal-50/40 shadow-xs space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-teal-200">
          <ShieldCheck className="w-5 h-5 text-teal-700" />
          <h2 className="text-base font-bold text-teal-950">
            Tóm Tắt Biên Bản Hiện Trạng Căn Hộ {formData.unitCode} (Tầng {formData.floorNumber})
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 bg-white rounded-lg border border-teal-200">
            <span className="text-slate-500 block">Chủ sở hữu:</span>
            <strong className="text-slate-800">{formData.ownerName || 'Chưa có tên'}</strong>
          </div>

          <div className="p-2.5 bg-white rounded-lg border border-teal-200">
            <span className="text-slate-500 block">Ảnh định danh:</span>
            <strong className="text-teal-700">Đủ 2 ảnh (P01 & P04)</strong>
          </div>

          <div className="p-2.5 bg-white rounded-lg border border-teal-200">
            <span className="text-slate-500 block">Vết nứt ghi nhận:</span>
            <strong className="text-slate-800">{formData.localDefects.length} điểm nứt</strong>
          </div>

          <div className="p-2.5 bg-white rounded-lg border border-teal-200">
            <span className="text-slate-500 block">Thiết bị nhạy cảm:</span>
            <strong className={formData.hasSensitiveEquipment ? 'text-amber-700' : 'text-slate-600'}>
              {formData.hasSensitiveEquipment ? 'Có thiết bị' : 'Không có'}
            </strong>
          </div>
        </div>
      </Card>

      {/* 4.2. Ý kiến của chủ sở hữu căn hộ */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-100">
          <FileCheck className="w-5 h-5 text-teal-600" />
          <h2 className="text-base font-bold text-slate-800">
            Ý Kiến Xác Nhận Của Chủ Sở Hữu / Người Sử Dụng Căn Hộ
          </h2>
        </div>

        <div className="space-y-3">
          <Input
            label="Ý kiến hoặc kiến nghị của chủ căn hộ"
            placeholder="VD: Gia đình đồng ý với số liệu ghi nhận hiện trạng; Đề nghị đơn vị metro lưu ý theo dõi khi đào hầm..."
            value={formData.ownerFeedback}
            onChange={(e) => updateFormData({ ownerFeedback: e.target.value })}
          />
        </div>
      </Card>

      {/* 4.3. Chữ ký số 2 bên */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
          <PenTool className="w-5 h-5 text-teal-600" />
          <h2 className="text-base font-bold text-slate-800">
            Ký Xác Nhận Biên Bản Khảo Sát Hiện Trạng Căn Hộ
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Chữ ký cán bộ khảo sát */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">1. Cán Bộ Khảo Sát Hiện Trường *</span>
              {formData.surveyorSignature ? (
                <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Đã ký
                </span>
              ) : (
                <span className="text-[11px] text-amber-600">Chưa ký</span>
              )}
            </div>

            <Input
              label="Họ tên cán bộ ký xác nhận"
              placeholder="VD: Kỹ sư Nguyễn Văn Khảo Sát"
              value={formData.surveyorSignature}
              onChange={(e) => updateFormData({ surveyorSignature: e.target.value })}
            />
          </div>

          {/* Chữ ký chủ căn hộ */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">2. Chủ Sở Hữu / Đại Diện Căn Hộ *</span>
              {formData.ownerSignature ? (
                <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Đã ký
                </span>
              ) : (
                <span className="text-[11px] text-amber-600">Chưa ký</span>
              )}
            </div>

            <Input
              label="Họ tên chủ căn hộ ký xác nhận"
              placeholder={`VD: ${formData.ownerName || 'Chủ căn hộ'}`}
              value={formData.ownerSignature}
              onChange={(e) => updateFormData({ ownerSignature: e.target.value })}
            />
          </div>
        </div>
      </Card>

      {/* Action Footer */}
      <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-200">
        <Button variant="secondary" size="md" onClick={prevStep}>
          ◀ Bước 3 (Khuyết tật căn hộ)
        </Button>

        <Button
          size="lg"
          className="bg-teal-600 hover:bg-teal-700 text-white shadow-md"
          disabled={!isSignaturesComplete || isSubmitting}
          onClick={onSubmitFinal}
          icon={<Send className="w-4 h-4" />}
        >
          {isSubmitting ? 'Đang nộp hồ sơ...' : 'Hoàn Tất & Nộp Hồ Sơ Căn Hộ'}
        </Button>
      </div>
    </div>
  );
};
