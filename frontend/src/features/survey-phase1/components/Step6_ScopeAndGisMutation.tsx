import React, { useState } from 'react';
import { usePhase1SurveyStore } from '../store/usePhase1SurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import { Input, Select, Textarea } from '../../../core/components/ui/FormControls';
import { CadastralGISBoundaryEditor } from '../../../components/gis/CadastralGISBoundaryEditor';
import { Map, ShieldCheck, AlertCircle, Edit3 } from 'lucide-react';

const ACCESS_LIMIT_PRESETS = [
  'Chỉ đồng ý cho xem tầng trệt (Không cho lên lầu)',
  'Chủ nhà đi vắng / Khóa cửa toàn bộ',
  'Chủ nhà từ chối hợp tác khảo sát bên trong',
  'Khu vực nguy hiểm / Kết cấu mất an toàn',
  'Phòng kho / Phòng thờ khóa cửa',
  'Kẹt cửa / Mất chìa khóa',
  'Khu vực chứa tài sản nhạy cảm',
  'Khác...',
];

export const Step6_ScopeAndGisMutation: React.FC = () => {
  const { formData, updateFormData, nextStep, prevStep } = usePhase1SurveyStore();
  const [showGisEditorModal, setShowGisEditorModal] = useState(false);

  const scope = formData.surveyScope;
  const access = formData.accessLimitation;

  // Lấy danh sách tên tất cả các tầng đã có ở Bước 3
  const surveyedFloorNames = formData.floors.map((f) => f.floorName);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* 6.1. Phạm vi đã khảo sát */}
      <Card>
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <h2 className="text-base sm:text-lg font-bold text-slate-800">
            6.1. Phạm Vi Không Gian Đã Khảo Sát (Survey Scope)
          </h2>
        </div>

        <p className="text-xs text-slate-500 mb-3">
          Hệ thống tự động tích chọn các tầng lầu đã khảo sát ở Bước 3. Cán bộ có thể chọn thêm các khu phụ.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800">
            <input
              type="checkbox"
              checked={scope.externalFront}
              onChange={(e) =>
                updateFormData({
                  surveyScope: { ...scope, externalFront: e.target.checked },
                })
              }
              className="rounded text-emerald-600 focus:ring-emerald-500"
            />
            <span>Mặt đứng ngoài (P-01 → P-04)</span>
          </label>

          {surveyedFloorNames.map((fName) => (
            <div
              key={fName}
              className="flex items-center gap-2 p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-bold text-emerald-900"
            >
              <span>✅ {fName} (Đã có dữ liệu)</span>
            </div>
          ))}

          <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={scope.roofTerrace}
              onChange={(e) =>
                updateFormData({
                  surveyScope: { ...scope, roofTerrace: e.target.checked },
                })
              }
              className="rounded text-emerald-600 focus:ring-emerald-500"
            />
            <span>Mái / Sân thượng / Sê-nô</span>
          </label>

          <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={scope.basement}
              onChange={(e) =>
                updateFormData({
                  surveyScope: { ...scope, basement: e.target.checked },
                })
              }
              className="rounded text-emerald-600 focus:ring-emerald-500"
            />
            <span>Tầng hầm / Bán hầm</span>
          </label>

          <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={scope.backyardOuthouse}
              onChange={(e) =>
                updateFormData({
                  surveyScope: { ...scope, backyardOuthouse: e.target.checked },
                })
              }
              className="rounded text-emerald-600 focus:ring-emerald-500"
            />
            <span>Sân sau / Khu phụ / Giếng trời</span>
          </label>
        </div>
      </Card>

      {/* 6.2. Hạn chế tiếp cận */}
      <Card>
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
          <AlertCircle className="w-5 h-5 text-amber-600" />
          <h2 className="text-base sm:text-lg font-bold text-slate-800">
            6.2. Hạn Chế Tiếp Cận (Access Limitations)
          </h2>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { value: 'FULL_100', label: '1. Không có hạn chế (Tiếp cận 100%)' },
              { value: 'LIMITED', label: '2. Có hạn chế tiếp cận một phần' },
              { value: 'ABSENT_REFUSED', label: '3. Từ chối khảo sát / Đi vắng' },
            ].map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer text-xs font-bold transition-all ${
                  access.type === opt.value
                    ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="accessType"
                  checked={access.type === opt.value}
                  onChange={() =>
                    updateFormData({
                      accessLimitation: { ...access, type: opt.value as any },
                    })
                  }
                  className="text-amber-600 focus:ring-amber-500"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>

          {access.type !== 'FULL_100' && (
            <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200 space-y-3">
              <Select
                label="Nguyên Nhân Hạn Chế Tiếp Cận"
                value={access.mainReason}
                onChange={(e) =>
                  updateFormData({
                    accessLimitation: { ...access, mainReason: e.target.value },
                  })
                }
                options={ACCESS_LIMIT_PRESETS.map((p) => ({ value: p, label: p }))}
              />

              <Textarea
                label="Ghi Chú Diễn Giải Chi Tiết Hiện Trường"
                placeholder="Mô tả nguyên nhân không vào được để làm cơ sở pháp lý..."
                value={access.notes}
                onChange={(e) =>
                  updateFormData({
                    accessLimitation: { ...access, notes: e.target.value },
                  })
                }
              />
            </div>
          )}
        </div>
      </Card>

      {/* 6.3. Động cơ điều chỉnh ranh thửa GIS */}
      <Card>
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Map className="w-5 h-5 text-blue-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              6.3. Đối Soát Kích Thước & Điều Chỉnh Ranh Thửa Đất trên GIS
            </h2>
          </div>
          <Button
            size="sm"
            variant="outline"
            icon={<Edit3 className="w-3.5 h-3.5" />}
            onClick={() => setShowGisEditorModal(true)}
          >
            Mở Bản Đồ & Trình Biên Tập GIS
          </Button>
        </div>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Trạng thái ranh thửa hiện tại
            </span>
            <span className="text-sm font-bold text-slate-800">
              {formData.gisMutationConfirmed.type === 'MATCH' && '✅ 1. Khớp ranh (Trùng 100% thửa đất địa chính)'}
              {formData.gisMutationConfirmed.type === 'SPLIT' && '✂️ 2. Đã tách thửa (Chia nhỏ theo thực tế nhà)'}
              {formData.gisMutationConfirmed.type === 'MERGE' && '🔗 3. Đã gộp thửa (Ghép nhiều thửa liền kề)'}
            </span>
          </div>

          <Button size="sm" onClick={() => setShowGisEditorModal(true)}>
            Xác nhận / Biên tập lại ranh
          </Button>
        </div>
      </Card>

      {/* Modal Trình biên tập GIS */}
      {showGisEditorModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/90 flex flex-col p-3 sm:p-5 animate-in fade-in">
          <div className="flex items-center justify-between text-white pb-3 border-b border-slate-800">
            <h3 className="font-bold text-base flex items-center gap-2">
              <Map className="w-5 h-5 text-blue-400" />
              <span>Động Cơ Biên Tập Ranh Thửa Đất GIS (Match / Split / Merge)</span>
            </h3>
            <Button variant="danger" size="sm" onClick={() => setShowGisEditorModal(false)}>
              Đóng lại
            </Button>
          </div>

            <CadastralGISBoundaryEditor
              activeParcelId={formData.parcelId}
              parcelData={{
                projectParcelCode: formData.projectParcelCode,
                officialCadastralCode: formData.officialCadastralCode,
                houseNumber: formData.houseNumber,
                street: formData.street,
                ownerName: formData.ownerName,
                floorCount: formData.aboveFloors,
              }}
              boundaryStatus={formData.gisMutationConfirmed.type}
              onStatusChange={(status) => {
                updateFormData({
                  gisMutationConfirmed: {
                    ...formData.gisMutationConfirmed,
                    type: status,
                  },
                });
              }}
              mutationData={{
                splitReason: formData.gisMutationConfirmed.notes || '',
                splitCount: 2,
                splitChildren: [],
                mergeReason: '',
                mergeTargetCode: '',
                selectedMergeCodes: [],
                isSubmitted: false,
                submittedAt: '',
              }}
              onMutationDataChange={(data) => {
                updateFormData({
                  gisMutationConfirmed: {
                    ...formData.gisMutationConfirmed,
                    notes: data.splitReason || data.mergeReason || formData.gisMutationConfirmed.notes,
                  },
                });
              }}
            />
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={prevStep}>
          ⬅️ Quay lại Bước 5
        </Button>
        <Button onClick={nextStep}>
          Tiếp tục: Bước 7 (Bảng Điểm ECS & VI) ➔
        </Button>
      </div>
    </div>
  );
};
