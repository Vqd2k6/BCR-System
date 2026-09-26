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
  const { formData, updateFormData, nextStep, prevStep, activeParcel } = usePhase1SurveyStore();
  const [extraFloorsCount, setExtraFloorsCount] = useState(0);

  const scope = formData.surveyScope;
  const access = formData.accessLimitation;

  const [customRestrictedArea, setCustomRestrictedArea] = useState('');
  const [customMainReason, setCustomMainReason] = useState('');

  // Tự động nhận diện danh sách tầng của công trình:
  // - Các tầng đã có ở Bước 3 (formData.floors): đánh dấu isAlreadySurveyed = true
  // - Các tầng cao hơn (dựa trên formData.aboveFloors và extraFloorsCount): isAlreadySurveyed = false cho phép chọn
  const surveyedCount = formData.floors.length;
  const totalBuildingFloorsCount = Math.max(formData.aboveFloors || 0, surveyedCount, 3) + extraFloorsCount;

  const allBuildingFloors = Array.from({ length: totalBuildingFloorsCount }, (_, i) => {
    const isAlreadySurveyed = i < surveyedCount;
    const floorLabel = isAlreadySurveyed
      ? formData.floors[i].floorName || `Tầng ${i + 1}`
      : `Tầng ${i + 1} (Lầu ${i})`;
    return {
      index: i + 1,
      label: floorLabel,
      isAlreadySurveyed,
    };
  });

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
                    {allBuildingFloors.map((floorItem) => {
                      const isSurveyed = floorItem.isAlreadySurveyed;
                      const isChecked = access.restrictedFloorLevels?.includes(floorItem.label) || false;

                      return (
                        <label
                          key={floorItem.label}
                          className={`flex items-center justify-between p-2 rounded-lg border text-xs select-none transition-all ${
                            isSurveyed
                              ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                              : isChecked
                              ? 'bg-amber-100 border-amber-400 font-bold text-amber-950 cursor-pointer shadow-xs'
                              : 'bg-white border-slate-200 text-slate-700 cursor-pointer hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              disabled={isSurveyed}
                              checked={isSurveyed ? false : isChecked}
                              onChange={(e) => {
                                const cur = access.restrictedFloorLevels || [];
                                const next = e.target.checked
                                  ? [...cur, floorItem.label]
                                  : cur.filter((fl) => fl !== floorItem.label);
                                updateFormData({
                                  accessLimitation: { ...access, restrictedFloorLevels: next },
                                });
                              }}
                              className="rounded text-amber-600 focus:ring-amber-500 disabled:opacity-50"
                            />
                            <span className={isSurveyed ? 'line-through text-slate-400' : ''}>
                              {floorItem.label}
                            </span>
                          </div>
                          {isSurveyed && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold whitespace-nowrap">
                              ✓ Đã KS ở B3
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
            parcel={
              activeParcel
                ? {
                    ...activeParcel,
                    houseNumber: formData.houseNumber || activeParcel.houseNumber,
                    street: formData.street || activeParcel.street,
                    ownerName: formData.ownerName || activeParcel.ownerName,
                    ownerPhone: formData.ownerPhone || (activeParcel as any).ownerPhone,
                    landAreaM2: (formData.constructionAreaM2 !== '' && formData.constructionAreaM2 !== undefined)
                      ? Number(formData.constructionAreaM2)
                      : ((activeParcel as any)?.land_area_m2 || (activeParcel as any)?.landAreaM2),
                    constructionAreaM2: (formData.constructionAreaM2 !== '' && formData.constructionAreaM2 !== undefined)
                      ? Number(formData.constructionAreaM2)
                      : ((activeParcel as any)?.construction_area_m2 || (activeParcel as any)?.constructionAreaM2),
                  }
                : (formData.parcelCoordinates && formData.parcelCoordinates.length >= 3
                ? ({
                    id: formData.parcelId,
                    projectParcelCode: formData.projectParcelCode,
                    officialCadastralCode: formData.officialCadastralCode,
                    houseNumber: formData.houseNumber,
                    street: formData.street,
                    ownerName: formData.ownerName,
                    ownerPhone: formData.ownerPhone,
                    surveyStatus: 'IN_PROGRESS',
                    absenceAttemptCount: 0,
                    coordinates: formData.parcelCoordinates,
                    zoneId: formData.zoneId,
                    landAreaM2: (formData.constructionAreaM2 !== '' && formData.constructionAreaM2 !== undefined)
                      ? Number(formData.constructionAreaM2)
                      : undefined,
                    constructionAreaM2: (formData.constructionAreaM2 !== '' && formData.constructionAreaM2 !== undefined)
                      ? Number(formData.constructionAreaM2)
                      : undefined,
                  } as any)
                : undefined)
            }
            parcelData={{
              projectParcelCode: formData.projectParcelCode,
              officialCadastralCode: formData.officialCadastralCode,
              houseNumber: formData.houseNumber,
              street: formData.street,
              ward: (activeParcel as any)?.ward || (activeParcel as any)?.ward_name || 'Phường 15',
              district: (activeParcel as any)?.district || (activeParcel as any)?.district_name || 'Quận Tân Bình',
              ownerName: formData.ownerName,
              floorCount: typeof formData.aboveFloors === 'number' ? formData.aboveFloors : undefined,
              zoneId: activeParcel?.zoneId || formData.zoneId,
              coordinates: activeParcel?.coordinates || formData.parcelCoordinates,
              landArea: (formData.constructionAreaM2 !== '' && formData.constructionAreaM2 !== undefined)
                ? Number(formData.constructionAreaM2)
                : ((activeParcel as any)?.land_area_m2 || (activeParcel as any)?.landAreaM2 || (activeParcel as any)?.landArea),
              constructionArea: (formData.constructionAreaM2 !== '' && formData.constructionAreaM2 !== undefined)
                ? Number(formData.constructionAreaM2)
                : undefined,
              frontageWidth: (activeParcel as any)?.frontage_width || (activeParcel as any)?.frontageWidth,
              lotDepth: (activeParcel as any)?.lot_depth || (activeParcel as any)?.lotDepth,
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
              splitReason: formData.gisMutationConfirmed.details?.splitReason || formData.gisMutationConfirmed.notes || '',
              splitCount: formData.gisMutationConfirmed.details?.splitCount || 2,
              splitChildren: formData.gisMutationConfirmed.details?.splitChildren || [],
              splitCutType: 'CUSTOM_POINTS',
              splitShapeOption: formData.gisMutationConfirmed.details?.splitShapeOption || 'CLICK_TO_DRAW',
              splitCustomPointsA: formData.gisMutationConfirmed.details?.splitCustomPointsA || [],
              mergeReason: formData.gisMutationConfirmed.details?.mergeReason || '',
              mergeTargetCode: formData.gisMutationConfirmed.details?.mergeTargetCode || '',
              selectedMergeCodes: formData.gisMutationConfirmed.details?.selectedMergeCodes || [],
              mergeHasPartialBuilding: formData.gisMutationConfirmed.details?.mergeHasPartialBuilding ?? false,
              mergeBuildingAreaM2: formData.gisMutationConfirmed.details?.mergeBuildingAreaM2,
              mergeResidualAreaM2: formData.gisMutationConfirmed.details?.mergeResidualAreaM2,
              mergeResidualType: formData.gisMutationConfirmed.details?.mergeResidualType,
              mergeBuildingRatio: formData.gisMutationConfirmed.details?.mergeBuildingRatio,
              mergeResidualParcelCode: formData.gisMutationConfirmed.details?.mergeResidualParcelCode,
              isSubmitted: formData.gisMutationConfirmed.details?.isSubmitted || false,
              submittedAt: formData.gisMutationConfirmed.details?.submittedAt || '',
              matchConfirmed: formData.gisMutationConfirmed.details?.matchConfirmed || (formData.gisMutationConfirmed.type === 'MATCH'),
              activeProposalType: formData.gisMutationConfirmed.details?.activeProposalType ?? (formData.gisMutationConfirmed.details?.isSubmitted ? formData.gisMutationConfirmed.type : (formData.gisMutationConfirmed.type === 'MATCH' ? 'MATCH' : null)),
            }}
            onMutationDataChange={(data) => {
              updateFormData({
                gisMutationConfirmed: {
                  ...formData.gisMutationConfirmed,
                  notes: data.splitReason || data.mergeReason || formData.gisMutationConfirmed.notes,
                  details: {
                    ...formData.gisMutationConfirmed.details,
                    ...data,
                  },
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
