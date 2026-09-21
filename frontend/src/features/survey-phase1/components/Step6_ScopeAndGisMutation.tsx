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
  const [showGisEditorModal, setShowGisEditorModal] = useState(false);
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
      {/* 6.1. Phạm vi đã khảo sát */}
      <Card>
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              6.1. Phạm Vi Không Gian Đã Khảo Sát (Survey Scope)
            </h2>
            <p className="text-xs text-slate-500">
              Tự động trích xuất các tầng và Vùng Z đã khảo sát ở Bước 3 để cán bộ xác nhận lại
            </p>
          </div>
        </div>

        {/* 1. Tổng quan & Ngoại thất */}
        <div className="mb-4 space-y-2">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            1. Khảo sát ngoại quan toàn cảnh
          </span>
          <label className="flex items-center gap-2 p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 text-xs font-semibold text-emerald-950 cursor-pointer">
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
            <span>✅ Bên ngoài / Mặt tiền toà nhà (Bộ 4 ảnh P-01 → P-04)</span>
          </label>
        </div>

        {/* 2. Cây phân cấp Tầng, Vùng Kiến trúc Z và Vùng Kết cấu E thực tế từ Bước 3 */}
        <div className="mb-4 space-y-2.5">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            2. Danh sách các Tầng, Vùng Kiến Trúc (Z) & Kết Cấu Chịu Lực (E) đã khảo sát (Bước 3)
          </span>

          <div className="space-y-2.5">
            {formData.floors.map((floor, fIdx) => (
              <div
                key={floor.id || fIdx}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs sm:text-sm text-slate-800 flex items-center gap-1.5">
                    <Building className="w-4 h-4 text-emerald-600" />
                    <span>{floor.floorName}</span>
                    <span className="text-[11px] font-normal text-slate-500">
                      ({floor.zones?.length || 0} Vùng Z • {floor.structuralElements?.length || 0} Vùng E)
                    </span>
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    Đã khảo sát
                  </span>
                </div>

                {/* Danh sách các Vùng Z trong tầng */}
                {floor.zones && floor.zones.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Mảng tường & Hoàn thiện kiến trúc (Vùng Z):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {floor.zones.map((zone) => (
                        <div
                          key={zone.id}
                          className="p-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-800 font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">
                              {zone.zoneCode}
                            </span>
                            <span className="text-slate-700 font-medium truncate max-w-[140px]" title={zone.roomName}>
                              {zone.roomName}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {zone.defects?.length > 0 ? `${zone.defects.length} D` : 'Không nứt'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Danh sách các Vùng E (Kết cấu chịu lực) trong tầng */}
                {floor.structuralElements && floor.structuralElements.length > 0 && (
                  <div className="space-y-1.5 pt-1 border-t border-slate-200/60">
                    <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                      Cấu kiện kết cấu chịu lực (Vùng E):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {floor.structuralElements.map((el) => (
                        <div
                          key={el.id}
                          className="p-2 rounded-lg bg-amber-50/40 border border-amber-200 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-amber-950 font-mono text-[10px] bg-amber-100 px-1.5 py-0.5 rounded">
                              {el.elementCode}
                            </span>
                            <span className="text-slate-700 font-medium truncate max-w-[140px]" title={el.elementType}>
                              {el.elementType}
                            </span>
                          </div>
                          <span className="text-[10px] text-amber-800 font-mono">
                            {el.defects?.length > 0 ? `${el.defects.length} D kết cấu` : 'Ổn định'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 3. Không gian khảo sát bổ sung */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            3. Không gian khảo sát bổ sung (nếu có)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 cursor-pointer hover:bg-slate-50">
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

            <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 cursor-pointer hover:bg-slate-50">
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

            <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 cursor-pointer hover:bg-slate-50">
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
              <span>Khu phụ / Sân sau / Giếng trời</span>
            </label>
          </div>
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
