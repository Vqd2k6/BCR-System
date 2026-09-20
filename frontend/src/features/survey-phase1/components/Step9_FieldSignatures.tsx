import React, { useState } from 'react';
import { usePhase1SurveyStore } from '../store/usePhase1SurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import { Input, Textarea } from '../../../core/components/ui/FormControls';
import { SignaturePad } from '../../../components/canvas/SignaturePad';
import { PenTool, CheckCircle2, AlertTriangle, FileCheck2, Send } from 'lucide-react';
import confetti from 'canvas-confetti';

interface Step9Props {
  onSubmitFinal: () => void;
  isSubmitting?: boolean;
}

export const Step9_FieldSignatures: React.FC<Step9Props> = ({ onSubmitFinal, isSubmitting = false }) => {
  const { formData, updateFormData, prevStep } = usePhase1SurveyStore();
  const sigs = formData.signatures;

  const [activeSigningRole, setActiveSigningRole] = useState<'preparedBy' | 'checkedBy' | 'ownerRepresentative' | null>(null);

  // Thống kê nhanh
  const totalFloors = formData.floors.length;
  const totalZones = formData.floors.reduce((acc, f) => acc + f.zones.length, 0);
  const totalDefects = formData.floors.reduce(
    (acc, f) => acc + f.zones.reduce((zacc, z) => zacc + z.defects.length, 0),
    0
  );

  const handleCompleteSurvey = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    });
    onSubmitFinal();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* 9.1. Thống kê chốt số liệu */}
      <Card className="border-emerald-200 bg-emerald-50/40">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-emerald-200">
          <FileCheck2 className="w-5 h-5 text-emerald-700" />
          <h2 className="text-base sm:text-lg font-bold text-slate-800">
            9.1. Tổng Kết Khảo Sát Hiện Trường Trước Khi Ký Xác Nhận
          </h2>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center mb-4">
          <div className="p-3 bg-white rounded-xl border border-emerald-200">
            <span className="text-xs text-slate-500 block">Tổng số tầng</span>
            <span className="text-lg font-black text-slate-800">{totalFloors} Tầng</span>
          </div>
          <div className="p-3 bg-white rounded-xl border border-emerald-200">
            <span className="text-xs text-slate-500 block">Tổng số Vùng Z</span>
            <span className="text-lg font-black text-slate-800">{totalZones} Vùng</span>
          </div>
          <div className="p-3 bg-white rounded-xl border border-emerald-200">
            <span className="text-xs text-slate-500 block">Tổng số vết nứt D</span>
            <span className="text-lg font-black text-emerald-700">{totalDefects} Nứt</span>
          </div>
        </div>

        <Textarea
          label="Ý Kiến / Phản Hồi Của Chủ Sở Hữu (Ghi nhận nguyên văn)"
          placeholder="Chủ nhà đồng ý với hiện trạng khảo sát hoặc có yêu cầu bổ sung gì..."
          rows={2}
          value={sigs.ownerFeedback}
          onChange={(e) =>
            updateFormData({
              signatures: { ...sigs, ownerFeedback: e.target.value },
            })
          }
        />
      </Card>

      {/* 9.2. Ký xác nhận 3 bên */}
      <Card>
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
          <PenTool className="w-5 h-5 text-purple-600" />
          <h2 className="text-base sm:text-lg font-bold text-slate-800">
            9.2. Ký Xác Nhận Biên Bản Hiện Trường 3 Bên
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Bên 1: Cán bộ khảo sát */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-slate-700 block mb-2">
                1. Cán Bộ Khảo Sát (Prepared by)
              </span>
              <Input
                label="Họ và tên"
                value={sigs.preparedBy.fullName}
                onChange={(e) =>
                  updateFormData({
                    signatures: {
                      ...sigs,
                      preparedBy: { ...sigs.preparedBy, fullName: e.target.value },
                    },
                  })
                }
              />
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 text-center">
              {sigs.preparedBy.signatureDataUrl ? (
                <div className="mb-2">
                  <img
                    src={sigs.preparedBy.signatureDataUrl}
                    alt="Chữ ký"
                    className="h-16 mx-auto border rounded bg-white p-1"
                  />
                  <span className="text-[10px] text-emerald-600 font-bold block mt-1">Đã ký</span>
                </div>
              ) : (
                <p className="text-xs text-slate-400 mb-2 italic">Chưa có chữ ký</p>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setActiveSigningRole('preparedBy')}
              >
                {sigs.preparedBy.signatureDataUrl ? 'Ký lại' : 'Ký trên màn hình'}
              </Button>
            </div>
          </div>

          {/* Bên 2: Người kiểm tra */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-slate-700 block mb-2">
                2. Người Kiểm Tra (Checked by)
              </span>
              <Input
                label="Họ và tên"
                value={sigs.checkedBy.fullName}
                onChange={(e) =>
                  updateFormData({
                    signatures: {
                      ...sigs,
                      checkedBy: { ...sigs.checkedBy, fullName: e.target.value },
                    },
                  })
                }
              />
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 text-center">
              {sigs.checkedBy.signatureDataUrl ? (
                <div className="mb-2">
                  <img
                    src={sigs.checkedBy.signatureDataUrl}
                    alt="Chữ ký"
                    className="h-16 mx-auto border rounded bg-white p-1"
                  />
                  <span className="text-[10px] text-emerald-600 font-bold block mt-1">Đã ký</span>
                </div>
              ) : (
                <p className="text-xs text-slate-400 mb-2 italic">Chưa có chữ ký</p>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setActiveSigningRole('checkedBy')}
              >
                {sigs.checkedBy.signatureDataUrl ? 'Ký lại' : 'Ký trên màn hình'}
              </Button>
            </div>
          </div>

          {/* Bên 3: Chủ hộ / Đại diện */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-slate-700 block mb-2">
                3. Chủ Sở Hữu (Owner / Rep.)
              </span>
              <Input
                label="Họ và tên"
                value={sigs.ownerRepresentative.fullName || formData.ownerName}
                onChange={(e) =>
                  updateFormData({
                    signatures: {
                      ...sigs,
                      ownerRepresentative: {
                        ...sigs.ownerRepresentative,
                        fullName: e.target.value,
                      },
                    },
                  })
                }
              />
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 text-center">
              {sigs.ownerRepresentative.signatureDataUrl ? (
                <div className="mb-2">
                  <img
                    src={sigs.ownerRepresentative.signatureDataUrl}
                    alt="Chữ ký"
                    className="h-16 mx-auto border rounded bg-white p-1"
                  />
                  <span className="text-[10px] text-emerald-600 font-bold block mt-1">Đã ký</span>
                </div>
              ) : (
                <p className="text-xs text-slate-400 mb-2 italic">Chưa có chữ ký</p>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setActiveSigningRole('ownerRepresentative')}
              >
                {sigs.ownerRepresentative.signatureDataUrl ? 'Ký lại' : 'Chủ nhà ký'}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Signature Pad Modal */}
      {activeSigningRole && (
        <div className="fixed inset-0 z-50 bg-slate-900/90 flex flex-col items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-800">
                Ký tay trực tiếp trên màn hình
              </h3>
              <Button size="sm" variant="ghost" onClick={() => setActiveSigningRole(null)}>Đóng</Button>
            </div>
            <SignaturePad
              label={
                activeSigningRole === 'preparedBy'
                  ? 'Cán bộ khảo sát'
                  : activeSigningRole === 'checkedBy'
                  ? 'Người kiểm tra'
                  : 'Chủ sở hữu'
              }
              signerName={
                activeSigningRole === 'preparedBy'
                  ? sigs.preparedBy.fullName
                  : activeSigningRole === 'checkedBy'
                  ? sigs.checkedBy.fullName
                  : sigs.ownerRepresentative.fullName || formData.ownerName
              }
              role={
                activeSigningRole === 'preparedBy'
                  ? sigs.preparedBy.title
                  : activeSigningRole === 'checkedBy'
                  ? sigs.checkedBy.title
                  : 'Chủ sở hữu / Người sử dụng'
              }
              onSave={(dataUrl) => {
                if (activeSigningRole === 'preparedBy') {
                  updateFormData({
                    signatures: {
                      ...sigs,
                      preparedBy: { ...sigs.preparedBy, signatureDataUrl: dataUrl },
                    },
                  });
                } else if (activeSigningRole === 'checkedBy') {
                  updateFormData({
                    signatures: {
                      ...sigs,
                      checkedBy: { ...sigs.checkedBy, signatureDataUrl: dataUrl },
                    },
                  });
                } else if (activeSigningRole === 'ownerRepresentative') {
                  updateFormData({
                    signatures: {
                      ...sigs,
                      ownerRepresentative: {
                        ...sigs.ownerRepresentative,
                        signatureDataUrl: dataUrl,
                      },
                    },
                  });
                }
                setActiveSigningRole(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Final Submit Buttons */}
      <div className="flex justify-between items-center pt-4">
        <Button variant="outline" onClick={prevStep}>
          ⬅️ Quay lại Bước 8
        </Button>
        <Button
          size="lg"
          variant="success"
          icon={<Send className="w-4 h-4" />}
          loading={isSubmitting}
          onClick={handleCompleteSurvey}
        >
          Hoàn Tất & Nộp Hồ Sơ Khảo Sát
        </Button>
      </div>
    </div>
  );
};
