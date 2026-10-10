import React from 'react';
import {
  Building2,
  X,
  MapPin,
  CheckCircle2,
  Cloud,
  HardDrive,
  RefreshCw,
  Layers,
  ShieldAlert,
} from 'lucide-react';
import { ImageZoomModal } from '../../../components/common/ImageZoomModal';
import { DefectPinningModal } from '../../survey-phase1/components/step3/DefectPinningModal';
import type { GisParcel, BuildingUnit } from '../../../core/types/domain.types';

// Types & Hook
import {
  type NormalizedBbox,
  type MasterAreaSurveyPayload,
  type FloorPlanItem,
  type AreaSurveySyncStatus,
  normalizeBbox,
} from '../types/masterAreaSurvey.types';
import { useMasterAreaSurveyState } from '../hooks/useMasterAreaSurveyState';

// 5 Step Sub-components
import { Step1_ConfirmLocation } from './master-area/Step1_ConfirmLocation';
import { Step2_OverviewAndCadSetup } from './master-area/Step2_OverviewAndCadSetup';
import { Step3_DamageZonesAndDefects } from './master-area/Step3_DamageZonesAndDefects';
import { Step4_StructuralElementsAndDefects } from './master-area/Step4_StructuralElementsAndDefects';
import { Step5_SummaryAndSubmit } from './master-area/Step5_SummaryAndSubmit';

// 2 Modals bổ trợ
import { CadAreaCropModal } from './master-area/CadAreaCropModal';
import { MasterAreaPhotoAuditModal } from './master-area/MasterAreaPhotoAuditModal';

// Re-exports for backward compatibility
export type { NormalizedBbox, MasterAreaSurveyPayload, FloorPlanItem, AreaSurveySyncStatus };
export { normalizeBbox };

interface Props {
  parcel: GisParcel;
  unit: BuildingUnit;
  onClose: () => void;
  onSurveyCompleted: () => void;
  readOnly?: boolean;
  floorCadUrl?: string;
  floorPlans?: FloorPlanItem[];
}

export const SurveyCondoMasterAreaModal: React.FC<Props> = ({
  parcel,
  unit,
  onClose,
  onSurveyCompleted,
  readOnly = false,
  floorCadUrl,
  floorPlans,
}) => {
  const state = useMasterAreaSurveyState({
    parcel,
    unit,
    onSurveyCompleted,
    readOnly,
    floorCadUrl,
    floorPlans,
  });

  return (
    <div className="fixed inset-0 z-[100000] bg-slate-100 flex flex-col w-full h-[100dvh] overflow-hidden select-none animate-in fade-in duration-150">
      {/* =============================================================== */}
      {/* TOP MODAL HEADER: Title + Trạng thái đồng bộ Cloud R2 + Đóng */}
      {/* =============================================================== */}
      <div className="bg-white border-b border-slate-200 px-3 sm:px-5 py-2.5 flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 sm:p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900">
                Khu Vực: <span className="font-mono text-indigo-600">{state.unitCode}</span>
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                {state.floorName}
              </span>

              {/* HUY HIỆU THEO DÕI TÀI NGUYÊN ẢNH CLOUD R2 (BẤM VÀO ĐỂ XEM & ĐỒNG BỘ) */}
              <button
                type="button"
                onClick={() => state.setIsPhotoAuditModalOpen(true)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all shadow-2xs cursor-pointer ${
                  state.photoAuditStats.unsynced === 0
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                    : 'bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100'
                }`}
                title="Bấm để kiểm toán chi tiết từng ảnh & tải lại lên Cloud R2"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>
                  {state.photoAuditStats.unsynced === 0
                    ? `Cloud R2 (${state.photoAuditStats.synced}/${state.photoAuditStats.total} ảnh)`
                    : `${state.photoAuditStats.unsynced}/${state.photoAuditStats.total} ảnh chưa lên Cloud`}
                </span>
                {state.photoAuditStats.unsynced > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                )}
              </button>

              {/* Trạng thái lưu nháp cục bộ */}
              {state.syncStatus === 'SAVED_LOCAL' && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200"
                  title="Dữ liệu được lưu an toàn trong máy (Local Draft)"
                >
                  <HardDrive className="w-3 h-3 text-amber-600" />
                  <span>Lưu nháp</span>
                </span>
              )}

              {state.syncStatus === 'SYNCING' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />
                  <span>Đang nộp...</span>
                </span>
              )}

              {state.isReadOnly && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                  Chỉ xem
                </span>
              )}

              {state.isZoneAdminAdjusting && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  Điều chỉnh (Zone Admin)
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          title="Đóng biểu mẫu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* =============================================================== */}
      {/* STEPPER BAR (5 BƯỚC GỌN GÀNG, LIGHT THEME, RESPONSIVE) */}
      {/* =============================================================== */}
      <div className="bg-white border-b border-slate-200 px-2 sm:px-4 py-1.5 shrink-0 overflow-x-auto no-scrollbar shadow-2xs">
        <div className="flex items-center justify-between gap-1.5 min-w-max">
          {[
            { step: 1, label: '1. Vị trí', icon: MapPin },
            { step: 2, label: '2. Ảnh & CAD', icon: Building2 },
            { step: 3, label: '3. Vùng Z', icon: Layers },
            { step: 4, label: '4. Kết cấu E', icon: ShieldAlert },
            { step: 5, label: '5. Tổng kết', icon: CheckCircle2 },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = state.currentStep === item.step;
            const isPassed = state.currentStep > item.step;
            return (
              <button
                key={item.step}
                type="button"
                onClick={() => state.goToStep(item.step as 1 | 2 | 3 | 4 | 5)}
                className={`flex items-center gap-1 sm:gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : isPassed
                    ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* =============================================================== */}
      {/* MODAL BODY (CUỘN NỘI DUNG 5 BƯỚC, LIGHT THEME) */}
      {/* =============================================================== */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-100">
        <div className="max-w-5xl mx-auto">
          {state.currentStep === 1 && (
            <Step1_ConfirmLocation
              floorPlanData={state.floorPlanData}
              isLoadingCad={state.isLoadingCad}
              floorName={state.floorName}
              unitId={state.unitId}
              unitCode={state.unitCode}
              activeBbox={state.activeBbox}
              onConfirmNext={() => state.goToStep(2)}
            />
          )}

          {state.currentStep === 2 && (
            <Step2_OverviewAndCadSetup
              unitCode={state.unitCode}
              floorName={state.floorName}
              overviewPhotos={state.overviewPhotos}
              onAddOverviewPhoto={state.handleUpdateOrAddOverviewPhoto}
              onRemoveOverviewPhoto={state.handleRemoveOverviewPhoto}
              cadSketchPhotoUrl={state.cadSketchPhotoUrl}
              onCadSketchPhotoUrlChange={state.setCadSketchPhotoUrl}
              cadStructuralSketchPhotoUrl={state.cadStructuralSketchPhotoUrl}
              onCadStructuralSketchPhotoUrlChange={state.setCadStructuralSketchPhotoUrl}
              useSeparateStructuralCad={state.useSeparateStructuralCad}
              onToggleSeparateStructuralCad={state.setUseSeparateStructuralCad}
              isCroppingCad={state.isCroppingCad}
              onOpenCadCropModal={() => state.setIsCadCropModalOpen(true)}
              activeBbox={state.activeBbox}
              hasParentCad={Boolean(state.floorPlanData?.plan?.cad_photo_url || floorCadUrl)}
              watermarkOptions={state.watermarkOptions}
              isReadOnly={state.isReadOnly}
              onBack={() => state.goToStep(1)}
              onNext={() => state.goToStep(3)}
              onPreviewImage={state.setPreviewImageUrl}
            />
          )}

          {state.currentStep === 3 && (
            <Step3_DamageZonesAndDefects
              unitCode={state.unitCode}
              floorName={state.floorName}
              floorNumber={state.floorNumber}
              cadSketchPhotoUrl={state.cadSketchPhotoUrl}
              onCadSketchPhotoUrlChange={state.setCadSketchPhotoUrl}
              cadZonePins={state.cadZonePins}
              setCadZonePins={state.setCadZonePins}
              zones={state.zones}
              setZones={state.setZones}
              activeZoneIndex={state.activeZoneIndex}
              setActiveZoneIndex={state.setActiveZoneIndex}
              activeZone={state.activeZone}
              onUpdateActiveZone={state.handleUpdateActiveZone}
              onAddZone={state.handleAddZone}
              onDeleteZone={state.handleDeleteZone}
              onDeleteZoneByCode={state.handleDeleteZoneByCode}
              onSelectZoneByCode={state.handleSelectZoneByCode}
              onSyncMaterialsToEntireArea={state.handleSyncMaterialsToEntireArea}
              onUpdateOrAddZoneOverviewPhoto={state.handleUpdateOrAddZoneOverviewPhoto}
              onRemoveZoneOverviewPhoto={state.handleRemoveZoneOverviewPhoto}
              onTriggerPinningZone={state.setPinningZoneId}
              watermarkOptions={state.watermarkOptions}
              isReadOnly={state.isReadOnly}
              onBack={() => state.goToStep(2)}
              onNext={() => state.goToStep(4)}
              onPreviewImage={state.setPreviewImageUrl}
            />
          )}

          {state.currentStep === 4 && (
            <Step4_StructuralElementsAndDefects
              unitCode={state.unitCode}
              floorName={state.floorName}
              floorNumber={state.floorNumber}
              hasStructuralElements={state.hasStructuralElements}
              setHasStructuralElements={state.setHasStructuralElements}
              noStructuralElementsReason={state.noStructuralElementsReason}
              setNoStructuralElementsReason={state.setNoStructuralElementsReason}
              cadSketchPhotoUrl={state.cadSketchPhotoUrl}
              cadStructuralSketchPhotoUrl={state.cadStructuralSketchPhotoUrl}
              onCadStructuralSketchPhotoUrlChange={state.setCadStructuralSketchPhotoUrl}
              cadElementPins={state.cadElementPins}
              setCadElementPins={state.setCadElementPins}
              structuralElements={state.structuralElements}
              setStructuralElements={state.setStructuralElements}
              activeElementIndex={state.activeElementIndex}
              setActiveElementIndex={state.setActiveElementIndex}
              activeElement={state.activeElement}
              onUpdateActiveElement={state.handleUpdateActiveElement}
              onAddElement={state.handleAddElement}
              onDeleteElement={state.handleDeleteElement}
              onDeleteElementByCode={state.handleDeleteElementByCode}
              onSelectElementByCode={state.handleSelectElementByCode}
              onSyncElementsToEntireArea={state.handleSyncElementsToEntireArea}
              onUpdateOrAddElementOverviewPhoto={state.handleUpdateOrAddElementOverviewPhoto}
              onRemoveElementOverviewPhoto={state.handleRemoveElementOverviewPhoto}
              onTriggerPinningElement={state.setPinningElementId}
              watermarkOptions={state.watermarkOptions}
              isReadOnly={state.isReadOnly}
              onBack={() => state.goToStep(3)}
              onNext={() => state.goToStep(5)}
              onPreviewImage={state.setPreviewImageUrl}
            />
          )}

          {state.currentStep === 5 && (
            <Step5_SummaryAndSubmit
              zonesCount={state.zones.length}
              structuralElementsCount={state.structuralElements.length}
              hasStructuralElements={state.hasStructuralElements}
              allDefects={state.allDefects}
              dominantBurlandGrade={state.dominantBurlandGrade}
              burlandCounts={state.burlandCounts}
              surveyorRemarks={state.surveyorRemarks}
              setSurveyorRemarks={state.setSurveyorRemarks}
              surveyorSignatureUrl={state.surveyorSignatureUrl}
              setSurveyorSignatureUrl={state.setSurveyorSignatureUrl}
              isSubmitting={state.isSubmitting}
              onSubmit={state.handleSubmitMasterAreaSurvey}
              isReadOnly={state.isReadOnly}
              isZoneAdminAdjusting={state.isZoneAdminAdjusting}
              onBack={() => state.goToStep(4)}
              preFlightValidation={state.preFlightValidation}
              onJumpToItem={state.handleJumpToPreFlightItem}
            />
          )}
        </div>
      </div>

      {/* =============================================================== */}
      {/* MODAL KÉO THẢ Ô CHỮ NHẬT CẮT BẢN VẼ TẦNG MẸ THEO Ý KSV */}
      {/* =============================================================== */}
      {state.isCadCropModalOpen && (
        <CadAreaCropModal
          isOpen={state.isCadCropModalOpen}
          onClose={() => state.setIsCadCropModalOpen(false)}
          cadPhotoUrl={state.floorPlanData?.plan?.cad_photo_url || floorCadUrl || ''}
          floorName={state.floorName}
          unitCode={state.unitCode}
          initialBbox={state.activeBbox}
          otherPartitions={state.floorPlanData?.units}
          onConfirmCrop={state.handleConfirmCadCrop}
        />
      )}

      {/* =============================================================== */}
      {/* MODAL KIỂM TOÁN VÀ ĐỒNG BỘ ẢNH LÊN CLOUD R2 */}
      {/* =============================================================== */}
      {state.isPhotoAuditModalOpen && (
        <MasterAreaPhotoAuditModal
          isOpen={state.isPhotoAuditModalOpen}
          onClose={() => state.setIsPhotoAuditModalOpen(false)}
          parcelCode={parcel.projectParcelCode || parcel.officialCadastralCode || 'METRO2'}
          unitCode={state.unitCode}
          overviewPhotos={state.overviewPhotos}
          cadSketchPhotoUrl={state.cadSketchPhotoUrl}
          cadStructuralSketchPhotoUrl={state.cadStructuralSketchPhotoUrl}
          useSeparateStructuralCad={state.useSeparateStructuralCad}
          zones={state.zones}
          structuralElements={state.structuralElements}
          hasStructuralElements={state.hasStructuralElements}
          onUpdateOverviewPhotoUrl={state.handleUpdateOverviewPhotoUrl}
          onUpdateCadSketchUrl={state.handleUpdateCadSketchUrl}
          onUpdateCadStructuralSketchUrl={state.handleUpdateCadStructuralSketchUrl}
          onUpdateZoneOverviewPhotoUrl={state.handleUpdateZoneOverviewPhotoUrl}
          onUpdateZoneDefectPhotoUrl={state.handleUpdateZoneDefectPhotoUrl}
          onUpdateElementOverviewPhotoUrl={state.handleUpdateElementOverviewPhotoUrl}
          onUpdateElementDefectPhotoUrl={state.handleUpdateElementDefectPhotoUrl}
          onNavigateToStep={(step) => state.goToStep(step)}
        />
      )}

      {/* =============================================================== */}
      {/* MODAL DEFECT PINNING CHO VÙNG KIẾN TRÚC Z */}
      {/* LƯU Ý QUAN TRỌNG: NỀN LÀ ẢNH CHỤP THỰC TẾ CỦA VÙNG Z ĐÓ */}
      {/* =============================================================== */}
      {state.pinningZoneId && (() => {
        const activeZ = state.zones.find((z) => z.id === state.pinningZoneId);
        // Ưu tiên ảnh chụp thực tế mảng tường Z, fallback sang ảnh toàn cảnh khu vực, cuối cùng mới fallback CAD
        const zoneCtxPhoto =
          activeZ?.overviewPhotos?.[0] ||
          state.overviewPhotos?.[0]?.url ||
          state.cadSketchPhotoUrl;

        return (
          <DefectPinningModal
            isOpen={Boolean(state.pinningZoneId)}
            mode="ARCHITECTURAL"
            code={activeZ?.zoneCode || 'Z1'}
            name={activeZ?.roomName || 'Vùng kiến trúc'}
            floorName={state.floorName}
            projectParcelCode={parcel.projectParcelCode}
            ctxPhotoUrl={zoneCtxPhoto}
            defects={activeZ?.defects || []}
            onChange={(newDefects) => {
              state.setZones((prev) =>
                prev.map((z) => (z.id === state.pinningZoneId ? { ...z, defects: newDefects } : z))
              );
            }}
            onClose={() => state.setPinningZoneId(null)}
            readOnly={state.isReadOnly}
            watermarkOptions={{
              ...state.watermarkOptions,
              zoneOrRoom: activeZ?.zoneCode || 'Z1',
            }}
          />
        );
      })()}

      {/* =============================================================== */}
      {/* MODAL DEFECT PINNING CHO CẤU KIỆN KẾT CẤU E */}
      {/* LƯU Ý QUAN TRỌNG: NỀN LÀ ẢNH CHỤP THỰC TẾ CỦA CÂY CỘT/DẦM ĐÓ */}
      {/* =============================================================== */}
      {state.pinningElementId && (() => {
        const activeE = state.structuralElements.find((e) => e.id === state.pinningElementId);
        // Ưu tiên ảnh chụp thực tế cây cột/dầm E, fallback sang ảnh toàn cảnh khu vực, cuối cùng mới CAD
        const elemCtxPhoto =
          activeE?.overviewPhotos?.[0] ||
          state.overviewPhotos?.[0]?.url ||
          state.cadStructuralSketchPhotoUrl ||
          state.cadSketchPhotoUrl;

        return (
          <DefectPinningModal
            isOpen={Boolean(state.pinningElementId)}
            mode="STRUCTURAL"
            code={activeE?.elementCode || 'E1'}
            name={activeE?.elementType || 'Cấu kiện kết cấu'}
            floorName={state.floorName}
            projectParcelCode={parcel.projectParcelCode}
            ctxPhotoUrl={elemCtxPhoto}
            defects={activeE?.defects || []}
            onChange={(newDefects) => {
              state.setStructuralElements((prev) =>
                prev.map((e) => (e.id === state.pinningElementId ? { ...e, defects: newDefects } : e))
              );
            }}
            onClose={() => state.setPinningElementId(null)}
            readOnly={state.isReadOnly}
            watermarkOptions={{
              ...state.watermarkOptions,
              zoneOrRoom: activeE?.elementCode || 'E1',
            }}
          />
        );
      })()}

      {/* =============================================================== */}
      {/* MODAL XEM PHÓNG TO ẢNH (ZOOM PREVIEW) */}
      {/* =============================================================== */}
      {state.previewImageUrl && (
        <ImageZoomModal
          isOpen={Boolean(state.previewImageUrl)}
          onClose={() => state.setPreviewImageUrl(null)}
          imageUrl={state.previewImageUrl}
          title="Xem Phóng To Ảnh Khu Vực"
        />
      )}
    </div>
  );
};
