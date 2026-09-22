import React, { useState } from 'react';
import { usePhase1SurveyStore } from '../store/usePhase1SurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import { Input, Select, Textarea } from '../../../core/components/ui/FormControls';
import { CadastralGISBoundaryEditor } from '../../../components/gis/CadastralGISBoundaryEditor';
import { Map, ShieldCheck, AlertCircle, Edit3, Building, Home, CheckCircle2 } from 'lucide-react';

const ACCESS_LIMIT_PRESETS = [
  'Chỉ đồng ý cho xem tầng trệt (Không cho lên lầu)',
  'Chủ nhà đi vắng / Khóa cửa',
  'Chủ nhà không cho phép tiếp cận các phòng riêng',
  'Khu vực nguy hiểm / Kết cấu mất an toàn',
  'Phòng kho / Phòng thờ khóa cửa',
  'Kẹt cửa / Mất chìa khóa',
  'Khu vực chứa tài sản nhạy cảm',
  'Khác (Nhập chi tiết...)',
];

const RESTRICTED_AREAS_PRESETS = [
  'Các tầng lầu trên cao',
  'Mái / Sân thượng',
  'Tầng hầm',
  'Phòng ngủ / Khu vực riêng tư',
  'Phòng kho khóa cửa',
  'Khác (Nhập chi tiết...)',
];

export const Step6_ScopeAndGisMutation: React.FC = () => {
  const { formData, updateFormData, nextStep, prevStep } = usePhase1SurveyStore();
  const [extraFloorsCount, setExtraFloorsCount] = useState(0);

  const scope = formData.surveyScope;
  const access = formData.accessLimitation;

  const [customRestrictedArea, setCustomRestrictedArea] = useState('');
  const [customMainReason, setCustomMainReason] = useState('');

  // Danh sách tầng hiển thị trong phân rã hạn chế
  const availableDecomposedFloors = [
    'Tầng 1 (Lầu 1)',
    'Tầng 2 (Lầu 2)',
    'Tầng 3 (Lầu 3)',
    'Tầng 4 (Lầu 4)',
    ...Array.from({ length: extraFloorsCount }, (_, i) => `Tầng ${5 + i} (Lầu ${5 + i})`),
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* 5.1. Phạm vi đã khảo sát */}
      <Card>
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              5.1. Phạm Vi Không Gian Đã Khảo Sát (Survey Scope)
            </h2>
            <p className="text-xs text-slate-500">
              Tự động trích xuất các tầng đã khảo sát ở Bước 3 để cán bộ xác nhận lại
            </p>
          </div>
        </div>

        {/* Danh sách tầng đã khảo sát */}
        <div className="space-y-3 mb-4">
          <label className="text-sm font-semibold text-slate-700 block">
            Các tầng đã khảo sát (Bước 3)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {formData.floors.map((floor) => (
              <div
                key={floor.id}
                className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between"
              >
                <span className="font-bold text-xs sm:text-sm text-slate-800 flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-slate-600" />
                  <span>{floor.floorName}</span>
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Đã khảo sát
                </span>
              </div>
            ))}
            {formData.floors.length === 0 && (
              <div className="col-span-full text-xs text-slate-400 italic p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                Chưa có dữ liệu tầng nào từ Bước 3.
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* 5.2. Hạn chế tiếp cận */}
      <Card>
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
          <AlertCircle className="w-5 h-5 text-amber-600" />
          <h2 className="text-base sm:text-lg font-bold text-slate-800">
            5.2. Hạn Chế Tiếp Cận (Access Limitations)
          </h2>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { value: 'FULL_100', label: '1. Không có hạn chế (Tiếp cận 100%)' },
              { value: 'LIMITED', label: '2. Có hạn chế tiếp cận một phần' },
            ].map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-2.5 p-3 rounded-xl border-2 cursor-pointer text-xs font-bold transition-all ${
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

          {access.type === 'LIMITED' && (
            <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200 space-y-4 animate-in fade-in">
              {/* Vị trí / Khu vực bị hạn chế (Multi-select) */}
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-2">
                  Vị trí / Khu vực bị hạn chế (Multi-select):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {RESTRICTED_AREAS_PRESETS.map((area) => {
                    const isChecked = access.restrictedAreas?.includes(area) || false;
                    return (
                      <label
                        key={area}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer select-none transition-all ${
                          isChecked
                            ? 'bg-amber-100 border-amber-400 font-bold text-amber-950'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const cur = access.restrictedAreas || [];
                            const next = e.target.checked
                              ? [...cur, area]
                              : cur.filter((a) => a !== area);
                            updateFormData({
                              accessLimitation: { ...access, restrictedAreas: next },
                            });
                          }}
                          className="rounded text-amber-600 focus:ring-amber-500"
                        />
                        <span>{area}</span>
                      </label>
                    );
                  })}
                </div>

                {/* Nhập text khi chọn Khác */}
                {access.restrictedAreas?.includes('Khác (Nhập chi tiết...)') && (
                  <div className="mt-2.5 animate-in fade-in">
                    <Input
                      id="input-custom-restricted-area"
                      placeholder="Mô tả cụ thể khu vực bị hạn chế tiếp cận..."
                      value={customRestrictedArea}
                      onChange={(e) => {
                        setCustomRestrictedArea(e.target.value);
                        updateFormData({
                          accessLimitation: {
                            ...access,
                            notes: access.notes
                              ? `${access.notes} [Khu vực khác: ${e.target.value}]`
                              : `[Khu vực khác: ${e.target.value}]`,
                          },
                        });
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Phân rã tầng lầu bị hạn chế (Khi tick chọn "Các tầng lầu trên cao") */}
              {access.restrictedAreas?.includes('Các tầng lầu trên cao') && (
                <div className="p-3 bg-white rounded-xl border border-amber-300 space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 block">
                      Chi tiết các tầng lầu bị hạn chế tiếp cận (Cơ chế vô hiệu hóa an toàn):
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setExtraFloorsCount((prev) => prev + 1)}
                    >
                      + Thêm tầng cao hơn
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {availableDecomposedFloors.map((floorLabel) => {
                      const isAlreadySurveyed = formData.floors.some(
                        (f) =>
                          f.floorName.toLowerCase().includes(floorLabel.toLowerCase().slice(0, 6)) &&
                          (f.zones.length > 0 || f.overviewPhotos.length > 0 || f.cadSketchPhotoUrl)
                      );
                      const isChecked = access.restrictedFloorLevels?.includes(floorLabel) || false;

                      return (
                        <label
                          key={floorLabel}
                          className={`flex items-center justify-between p-2 rounded-lg border text-xs select-none ${
                            isAlreadySurveyed
                              ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                              : isChecked
                              ? 'bg-amber-100 border-amber-400 font-bold text-amber-950 cursor-pointer'
                              : 'bg-white border-slate-200 text-slate-700 cursor-pointer hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              disabled={isAlreadySurveyed}
                              checked={isAlreadySurveyed ? false : isChecked}
                              onChange={(e) => {
                                const cur = access.restrictedFloorLevels || [];
                                const next = e.target.checked
                                  ? [...cur, floorLabel]
                                  : cur.filter((fl) => fl !== floorLabel);
                                updateFormData({
                                  accessLimitation: { ...access, restrictedFloorLevels: next },
                                });
                              }}
                              className="rounded text-amber-600 focus:ring-amber-500"
                            />
                            <span>{floorLabel}</span>
                          </div>
                          {isAlreadySurveyed && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                              Đã KS ở B3
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Nguyên nhân chính */}
              <div>
                <Select
                  id="select-access-main-reason"
                  label="Nguyên Nhân Chính Hạn Chế Tiếp Cận"
                  value={
                    ACCESS_LIMIT_PRESETS.slice(0, 7).includes(access.mainReason)
                      ? access.mainReason
                      : 'Khác (Nhập chi tiết...)'
                  }
                  onChange={(e) => {
                    if (e.target.value === 'Khác (Nhập chi tiết...)') {
                      updateFormData({
                        accessLimitation: { ...access, mainReason: 'Khác: ' },
                      });
                    } else {
                      updateFormData({
                        accessLimitation: { ...access, mainReason: e.target.value },
                      });
                    }
                  }}
                  options={ACCESS_LIMIT_PRESETS.map((p) => ({ value: p, label: p }))}
                />
                {access.mainReason.startsWith('Khác') && (
                  <div className="mt-2 animate-in fade-in">
                    <Input
                      id="input-custom-access-reason"
                      placeholder="Nhập nguyên nhân hạn chế tiếp cận thực tế..."
                      value={access.mainReason}
                      onChange={(e) =>
                        updateFormData({
                          accessLimitation: { ...access, mainReason: e.target.value },
                        })
                      }
                    />
                  </div>
                )}
              </div>

              <Textarea
                id="textarea-access-notes"
                label="Ghi Chú Diễn Giải Chi Tiết Hiện Trường (Biên bản hiện trường)"
                placeholder="Mô tả cụ thể lý do hạn chế để làm cơ sở pháp lý và lập biên bản..."
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

      {/* 5.3. Động cơ điều chỉnh ranh thửa GIS */}
      <Card id="step5-gis-editor-section" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Map className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                5.3. Đối Soát Kích Thước & Điều Chỉnh Ranh Thửa Đất trên GIS
              </h2>
              <p className="text-xs text-slate-500">
                Vẽ đa giác khoanh vùng khảo sát (ranh nhà thực địa) trực tiếp trên bản đồ GIS
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Trạng thái ranh:</span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
              {formData.gisMutationConfirmed.type === 'MATCH' && '1. Khớp ranh 100%'}
              {formData.gisMutationConfirmed.type === 'SPLIT' && '2. Đã tách thửa'}
              {formData.gisMutationConfirmed.type === 'MERGE' && '3. Đã gộp thửa'}
            </span>
          </div>
        </div>

        {/* Trình biên tập GIS hiển thị trực tiếp inline */}
        <div className="rounded-xl overflow-hidden border border-slate-200 min-h-[520px]">
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
      </Card>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={prevStep}>
          ⬅️ Quay lại Bước 4
        </Button>
        <Button onClick={nextStep}>
          Tiếp tục: Bước 6 (Bảng Điểm ECS & VI) ➔
        </Button>
      </div>
    </div>
  );
};
