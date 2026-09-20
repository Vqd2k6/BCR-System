import React from 'react';
import { usePhase1SurveyStore } from '../store/usePhase1SurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import { Input, Select } from '../../../core/components/ui/FormControls';
import { Ruler, Activity, CheckCircle2 } from 'lucide-react';

const TILT_STATUS_OPTIONS = [
  { value: 'NONE', label: 'Không thấy (Không có dấu hiệu)' },
  { value: 'SUSPECTED', label: 'Nghi ngờ (Chưa rõ ràng / Cần theo dõi)' },
  { value: 'PRESENT', label: 'Có (Hiện diện rõ ràng)' },
];

export const Step5_SettlementTiltSurvey: React.FC = () => {
  const { formData, updateFormData, nextStep, prevStep } = usePhase1SurveyStore();
  const st = formData.settlementTilt;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <Card>
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
          <Ruler className="w-5 h-5 text-emerald-600" />
          <h2 className="text-base sm:text-lg font-bold text-slate-800">
            5. Đánh Giá Lún – Nghiêng – Biến Dạng Hình Học (Theo đúng Mục 6 Docx)
          </h2>
        </div>

        <p className="text-xs text-slate-500 mb-4">
          Ghi nhận các biến dạng hình học của công trình. Đơn vị đo độ nghiêng chuẩn quy hoạch là <strong>‰ (phần nghìn)</strong>. Hệ thống tự động map điểm vào chỉ số <strong>E3</strong>.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 1. Lún chênh */}
          <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200">
            <Select
              label="1. Lún Chênh Móng / Nền"
              value={st.diffSettlement.status}
              onChange={(e) =>
                updateFormData({
                  settlementTilt: {
                    ...st,
                    diffSettlement: { ...st.diffSettlement, status: e.target.value as any },
                  },
                })
              }
              options={TILT_STATUS_OPTIONS}
            />
            {st.diffSettlement.status !== 'NONE' && (
              <div className="mt-2.5">
                <Input
                  label="Vị trí lún chênh"
                  placeholder="VD: Góc sân sau, vách tường hông phải..."
                  value={st.diffSettlement.position}
                  onChange={(e) =>
                    updateFormData({
                      settlementTilt: {
                        ...st,
                        diffSettlement: { ...st.diffSettlement, position: e.target.value },
                      },
                    })
                  }
                />
              </div>
            )}
          </div>

          {/* 2. Nghiêng công trình */}
          <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200">
            <Select
              label="2. Nghiêng Toàn Bộ Công Trình"
              value={st.buildingTilt.status}
              onChange={(e) =>
                updateFormData({
                  settlementTilt: {
                    ...st,
                    buildingTilt: { ...st.buildingTilt, status: e.target.value as any },
                  },
                })
              }
              options={TILT_STATUS_OPTIONS}
            />
            {st.buildingTilt.status !== 'NONE' && (
              <div className="grid grid-cols-2 gap-2 mt-2.5">
                <Input
                  label="Phương X (‰)"
                  type="number"
                  step="0.1"
                  placeholder="VD: 3.5"
                  value={st.buildingTilt.xPermille}
                  onChange={(e) =>
                    updateFormData({
                      settlementTilt: {
                        ...st,
                        buildingTilt: {
                          ...st.buildingTilt,
                          xPermille: e.target.value ? Number(e.target.value) : '',
                        },
                      },
                    })
                  }
                />
                <Input
                  label="Phương Y (‰)"
                  type="number"
                  step="0.1"
                  placeholder="VD: 2.0"
                  value={st.buildingTilt.yPermille}
                  onChange={(e) =>
                    updateFormData({
                      settlementTilt: {
                        ...st,
                        buildingTilt: {
                          ...st.buildingTilt,
                          yPermille: e.target.value ? Number(e.target.value) : '',
                        },
                      },
                    })
                  }
                />
              </div>
            )}
          </div>

          {/* 3. Nghiêng sàn */}
          <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200">
            <Select
              label="3. Nghiêng Mặt Sàn"
              value={st.floorTilt.status}
              onChange={(e) =>
                updateFormData({
                  settlementTilt: {
                    ...st,
                    floorTilt: { ...st.floorTilt, status: e.target.value as any },
                  },
                })
              }
              options={TILT_STATUS_OPTIONS}
            />
            {st.floorTilt.status !== 'NONE' && (
              <div className="mt-2.5">
                <Input
                  label="Độ nghiêng sàn đo được (‰)"
                  type="number"
                  step="0.1"
                  placeholder="VD: 4.0"
                  value={st.floorTilt.permille}
                  onChange={(e) =>
                    updateFormData({
                      settlementTilt: {
                        ...st,
                        floorTilt: {
                          ...st.floorTilt,
                          permille: e.target.value ? Number(e.target.value) : '',
                        },
                      },
                    })
                  }
                />
              </div>
            )}
          </div>

          {/* 4. Võng dầm / sàn */}
          <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200">
            <Select
              label="4. Võng Dầm / Bản Sàn BTCT"
              value={st.beamSagging.status}
              onChange={(e) =>
                updateFormData({
                  settlementTilt: {
                    ...st,
                    beamSagging: { ...st.beamSagging, status: e.target.value as any },
                  },
                })
              }
              options={TILT_STATUS_OPTIONS}
            />
            {st.beamSagging.status !== 'NONE' && (
              <div className="mt-2.5">
                <Input
                  label="Vị trí võng"
                  placeholder="VD: Dầm trục 2-3 Tầng 1..."
                  value={st.beamSagging.position}
                  onChange={(e) =>
                    updateFormData({
                      settlementTilt: {
                        ...st,
                        beamSagging: { ...st.beamSagging, position: e.target.value },
                      },
                    })
                  }
                />
              </div>
            )}
          </div>
        </div>

        {/* Nguồn & Độ tin cậy */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100">
          <Select
            label="Độ Tin Cậy Dữ Liệu Lún Nghiêng"
            value={st.reliability}
            onChange={(e) =>
              updateFormData({
                settlementTilt: { ...st, reliability: e.target.value as any },
              })
            }
            options={[
              { value: 'HIGH', label: 'Cao (Có máy đo trắc địa / Thước nivo laser)' },
              { value: 'MEDIUM', label: 'Trung bình (Đo nhanh / Thước bọt nước)' },
              { value: 'LOW', label: 'Thấp (Chỉ quan sát bằng mắt thường)' },
            ]}
          />

          <div className="flex items-center mt-6">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={st.needAdditionalMonitoring.required}
                onChange={(e) =>
                  updateFormData({
                    settlementTilt: {
                      ...st,
                      needAdditionalMonitoring: {
                        ...st.needAdditionalMonitoring,
                        required: e.target.checked,
                      },
                    },
                  })
                }
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span>Yêu cầu đo đạc / Quan trắc chuyển vị bổ sung</span>
            </label>
          </div>
        </div>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={prevStep}>
          ⬅️ Quay lại Bước 4
        </Button>
        <Button onClick={nextStep}>
          Tiếp tục: Bước 6 (Phạm vi & Ranh GIS) ➔
        </Button>
      </div>
    </div>
  );
};
