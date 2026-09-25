import React, { useState } from 'react';
import { usePhase1SurveyStore } from '../store/usePhase1SurveyStore';
import { api } from '../../../services/api';
import { ABSENTEE_REASONS } from './step1/step1.constants';
import { Step1IdentificationSection } from './step1/Step1IdentificationSection';
import { Step1ObjectGroupSection } from './step1/Step1ObjectGroupSection';
import { Step1MetroGisSection } from './step1/Step1MetroGisSection';
import { Step1AdjacentSection } from './step1/Step1AdjacentSection';
import { Step1PhotosSection } from './step1/Step1PhotosSection';
import { Step1SettlementTiltSection } from './step1/Step1SettlementTiltSection';
import { Step1CaseSelector } from './step1/Step1CaseSelector';
import { Step1PolygonModal } from './step1/Step1PolygonModal';
import { Step1BottomNav } from './step1/Step1BottomNav';
import { Step1SuccessModals } from './step1/Step1SuccessModals';

interface Step1BuildingIdentificationProps {
  isCondoMaster?: boolean;
  onFinished?: () => void;
  onBackToHome?: () => void;
}

export const Step1_BuildingIdentification: React.FC<Step1BuildingIdentificationProps> = ({
  isCondoMaster = false,
  onFinished,
  onBackToHome,
}) => {
  const { formData, updateFormData, nextStep, clearDraft } = usePhase1SurveyStore();

  const [isDrawingPolygon, setIsDrawingPolygon] = useState(false);
  const [isSubmittingAbsentee, setIsSubmittingAbsentee] = useState(false);
  const [isSubmittingUnderConstruction, setIsSubmittingUnderConstruction] = useState(false);
  const [isSubmittingVacantLand, setIsSubmittingVacantLand] = useState(false);
  const [showAbsenteeSuccessModal, setShowAbsenteeSuccessModal] = useState(false);
  const [showUnderConstructionSuccessModal, setShowUnderConstructionSuccessModal] = useState(false);
  const [showVacantLandSuccessModal, setShowVacantLandSuccessModal] = useState(false);
  const [isConfirmingApartment, setIsConfirmingApartment] = useState(false);
  const [showApartmentSuccessModal, setShowApartmentSuccessModal] = useState(false);

  // Survey case mode
  const currentCase = formData.surveyCaseType || (formData.isAbsenteeSurvey ? 'ABSENTEE' : 'NORMAL');

  const handleSelectCase = (caseType: 'NORMAL' | 'ABSENTEE' | 'APARTMENT' | 'UNDER_CONSTRUCTION' | 'VACANT_LAND') => {
    if (caseType === 'ABSENTEE') {
      updateFormData({
        surveyCaseType: 'ABSENTEE',
        isAbsenteeSurvey: true,
        isVacantLand: false,
        absenteeReason: formData.absenteeReason || ABSENTEE_REASONS[0],
      });
    } else if (caseType === 'VACANT_LAND') {
      updateFormData({
        surveyCaseType: 'VACANT_LAND',
        isAbsenteeSurvey: false,
        isVacantLand: true,
        buildingName: formData.buildingName || 'Khu đất trống',
        usageFunction: 'Đất trống',
        vacantLandStatus: formData.vacantLandStatus || 'Đất trống chưa xây dựng',
      });
    } else if (caseType === 'APARTMENT') {
      updateFormData({
        surveyCaseType: 'APARTMENT',
        isAbsenteeSurvey: false,
        isVacantLand: false,
        objectGroup: 'IMPORTANT',
        usageFunction: formData.usageFunction === 'Nhà ở gia đình' ? 'Khách sạn / Nhà nghỉ / Căn hộ DV' : formData.usageFunction,
      });
    } else if (caseType === 'UNDER_CONSTRUCTION') {
      updateFormData({
        surveyCaseType: 'UNDER_CONSTRUCTION',
        isAbsenteeSurvey: false,
        isVacantLand: false,
      });
    } else {
      updateFormData({
        surveyCaseType: 'NORMAL',
        isAbsenteeSurvey: false,
        isVacantLand: false,
      });
    }
  };

  const validateStep1Completeness = () => {
    const hasProjectParcelCode = Boolean(formData.projectParcelCode?.trim());
    const hasOfficialCadastralCode = Boolean(formData.officialCadastralCode?.trim());
    const hasBuildingName = Boolean(formData.buildingName?.trim());
    const hasGps = Boolean(formData.gpsCoords?.lat && formData.gpsCoords?.lng);
    const hasAddress = Boolean(formData.street?.trim() || formData.houseNumber?.trim());
    const hasOwnerName = Boolean(formData.ownerName?.trim());
    const hasObjectGroup = Boolean(formData.objectGroup);
    const hasAdjacent = Boolean(
      formData.adjacentBuildings?.left?.details &&
      formData.adjacentBuildings?.right?.details &&
      formData.adjacentBuildings?.back?.details
    );
    const hasPhotos = Boolean(
      (formData.photoP01?.url || formData.photoP01?.notApplicable) &&
      (formData.photoP02?.url || formData.photoP02?.notApplicable) &&
      (formData.photoP03?.url || formData.photoP03?.notApplicable) &&
      (formData.photoP04?.url || formData.photoP04?.notApplicable)
    );
    const hasP02Polygon = !formData.photoP02?.url || Boolean(formData.photoP02.polygonPoints && formData.photoP02.polygonPoints.length >= 3);
    const hasSettlement = typeof formData.settlementTilt?.diffSettlement?.level === 'number';
    const hasDataSource = Boolean(formData.settlementTilt?.dataSource && formData.settlementTilt.dataSource.length > 0);

    const isFullyComplete =
      hasProjectParcelCode &&
      hasOfficialCadastralCode &&
      hasBuildingName &&
      hasAddress &&
      hasOwnerName &&
      hasObjectGroup &&
      hasAdjacent &&
      hasPhotos &&
      hasP02Polygon &&
      hasSettlement &&
      hasDataSource;

    return {
      hasProjectParcelCode,
      hasOfficialCadastralCode,
      hasBuildingName,
      hasGps,
      hasAddress,
      hasOwnerName,
      hasObjectGroup,
      hasAdjacent,
      hasPhotos,
      hasP02Polygon,
      hasSettlement,
      hasDataSource,
      isFullyComplete,
    };
  };

  const completeness = validateStep1Completeness();

  const handleSubmitAbsentee = async () => {
    try {
      if (!formData.absenteeReason?.trim()) {
        alert('Vui lòng chọn hoặc nhập lý do vắng mặt / không tiếp cận.');
        const el = document.getElementById('input-absenteeReason');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.focus();
        }
        return;
      }

      if (!formData.absenteeMinutesPhotos || formData.absenteeMinutesPhotos.length === 0) {
        alert('Vui lòng chụp ít nhất 1 ảnh biên bản / giấy báo hẹn vắng mặt trước khi nộp hồ sơ.');
        const el = document.getElementById('absentee-minutes-section');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      setIsSubmittingAbsentee(true);
      const buildingId = formData.projectParcelCode || formData.officialCadastralCode || formData.parcelId;
      console.log('[Phase1] Submitting Absentee Survey:', formData);

      // 1. Lưu trạng thái override cục bộ dạng CHỜ DUYỆT (với phân loại VẮNG MẶT)
      try {
        const overrides = JSON.parse(localStorage.getItem('metro2_parcel_status_overrides') || '{}');
        overrides[formData.parcelId] = {
          status: 'SUBMITTED',
          subType: 'POSTPONED_ABSENT',
          isAbsentee: true,
          updatedAt: new Date().toISOString(),
          buildingId,
        };
        localStorage.setItem('metro2_parcel_status_overrides', JSON.stringify(overrides));
      } catch (_e) {}

      // 2. Gửi API máy chủ
      try {
        await api.post(`/parcels/${formData.parcelId}/record-absence`, {
          absenceReason: 'HOMEOWNER_ABSENT',
          notes: formData.absenteeReason === 'Lý do khác' ? (formData.customAbsenteeReason || 'Lý do khác') : (formData.absenteeReason || 'Chủ nhà vắng mặt'),
          photoProofUrl: formData.absenteeMinutesPhotos?.[0] || formData.photoP01?.url || '',
        });
      } catch (apiErr) {
        console.error('[Phase1] API record-absence failed:', apiErr);
        throw apiErr;
      }

      setShowAbsenteeSuccessModal(true);
    } catch (err) {
      console.error('Submit absentee error:', err);
      alert('Có lỗi khi gửi báo cáo vắng nhà.');
    } finally {
      setIsSubmittingAbsentee(false);
    }
  };

  const handleSubmitUnderConstruction = async () => {
    try {
      if (!formData.underConstructionPhotos || formData.underConstructionPhotos.length === 0) {
        alert('Vui lòng chụp ít nhất 1 ảnh hiện trạng công trình đang thi công.');
        const el = document.getElementById('under-construction-photos-section');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      if (!formData.constructionStageNotes?.trim()) {
        alert('Vui lòng nhập mô tả giai đoạn thi công hiện tại.');
        const el = document.getElementById('input-constructionStageNotes');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.focus();
        }
        return;
      }

      setIsSubmittingUnderConstruction(true);
      const buildingId = formData.projectParcelCode || formData.officialCadastralCode || formData.parcelId;
      console.log('[Phase1] Submitting Under Construction Survey:', formData);

      // 1. Lưu trạng thái override cục bộ dạng CHỜ DUYỆT (với phân loại ĐANG XÂY DỰNG)
      try {
        const overrides = JSON.parse(localStorage.getItem('metro2_parcel_status_overrides') || '{}');
        overrides[formData.parcelId] = {
          status: 'SUBMITTED',
          subType: 'UNDER_CONSTRUCTION',
          updatedAt: new Date().toISOString(),
          buildingId,
        };
        localStorage.setItem('metro2_parcel_status_overrides', JSON.stringify(overrides));
      } catch (_e) {}

      // 2. Gửi API máy chủ với status: SUBMITTED
      try {
        await api.post('/surveys/phase1/submit', {
          parcelId: formData.parcelId,
          surveyData: {
            ...formData,
            targetGroup: (formData as any).targetGroup || formData.objectGroup || 'GENERAL',
            summaryConclusions: `Công trình đang xây dựng: ${formData.constructionStageNotes || ''}`,
          },
          status: 'SUBMITTED',
        });
      } catch (apiErr) {
        console.error('[Phase1] API submit under construction failed:', apiErr);
        throw apiErr;
      }

      setShowUnderConstructionSuccessModal(true);
    } catch (err) {
      console.error('Submit under construction error:', err);
      alert('Có lỗi khi gửi báo cáo công trình đang xây dựng.');
    } finally {
      setIsSubmittingUnderConstruction(false);
    }
  };

  const handleSubmitVacantLand = async () => {
    try {
      if (!formData.vacantLandPhotos || formData.vacantLandPhotos.length === 0) {
        if (!formData.photoP01?.url && !formData.photoP02?.url) {
          alert('Vui lòng chụp ít nhất 1 ảnh hiện trạng thửa đất trống.');
          const el = document.getElementById('vacant-land-photos-section');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          return;
        }
      }

      setIsSubmittingVacantLand(true);
      const buildingId = formData.projectParcelCode || formData.officialCadastralCode || formData.parcelId;
      console.log('[Phase1] Submitting Vacant Land Survey:', formData);

      // 1. Lưu trạng thái override cục bộ dạng SUBMITTED (với phân loại ĐẤT TRỐNG)
      try {
        const overrides = JSON.parse(localStorage.getItem('metro2_parcel_status_overrides') || '{}');
        overrides[formData.parcelId] = {
          status: 'SUBMITTED',
          subType: 'VACANT_LAND',
          isVacantLand: true,
          buildingCategory: 'Đất trống',
          updatedAt: new Date().toISOString(),
          buildingId,
        };
        localStorage.setItem('metro2_parcel_status_overrides', JSON.stringify(overrides));
      } catch (_e) {}

      // 2. Gửi API máy chủ với status: SUBMITTED
      try {
        await api.post('/surveys/phase1/submit', {
          parcelId: formData.parcelId,
          surveyData: {
            ...formData,
            surveyCaseType: 'VACANT_LAND',
            buildingCategory: 'Đất trống',
            isVacantLand: true,
            usageFunction: 'Đất trống',
            targetGroup: (formData as any).targetGroup || formData.objectGroup || 'GENERAL',
            summaryConclusions: `Thửa đất trống: ${formData.vacantLandStatus || 'Đất trống chưa xây dựng'}. ${formData.vacantLandNotes || ''}`,
          },
          status: 'SUBMITTED',
        });
      } catch (apiErr) {
        console.error('[Phase1] API submit vacant land failed:', apiErr);
        throw apiErr;
      }



      setShowVacantLandSuccessModal(true);
    } catch (err) {
      console.error('Submit vacant land error:', err);
      alert('Có lỗi khi gửi báo cáo đất trống.');
    } finally {
      setIsSubmittingVacantLand(false);
    }
  };

  const handleConfirmApartment = async () => {
    try {
      setIsConfirmingApartment(true);
      const buildingId = formData.projectParcelCode || formData.officialCadastralCode || formData.parcelId;
      console.log('[Phase1] Confirming Condominium / Apartment Complex for:', buildingId);

      // 1. Gọi API cập nhật loại hình công trình thành CONDOMINIUM
      try {
        await api.patch(`/parcels/${formData.parcelId}/building-type`, {
          buildingType: 'CONDOMINIUM',
        });
      } catch (apiErr) {
        console.error('[Phase1] API patch building-type failed:', apiErr);
        throw apiErr;
      }

      // 2. Lưu override trạng thái công trình là chung cư
      try {
        const overrides = JSON.parse(localStorage.getItem('metro2_parcel_status_overrides') || '{}');
        overrides[formData.parcelId] = {
          ...(overrides[formData.parcelId] || {}),
          buildingType: 'CONDOMINIUM',
          surveyCaseType: 'APARTMENT',
          updatedAt: new Date().toISOString(),
          buildingId,
        };
        localStorage.setItem('metro2_parcel_status_overrides', JSON.stringify(overrides));
      } catch (_e) {}

      setShowApartmentSuccessModal(true);
    } catch (err: any) {
      console.error('Lỗi xác nhận chung cư:', err);
      alert('Có lỗi khi xác nhận loại hình chung cư: ' + (err?.message || 'Vui lòng thử lại'));
    } finally {
      setIsConfirmingApartment(false);
    }
  };

  const buildingIdentifier = formData.projectParcelCode || formData.officialCadastralCode || formData.parcelId;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* 1.1. Thông tin định danh công trình */}
      <Step1IdentificationSection
        formData={formData}
        updateFormData={updateFormData}
        currentCase={currentCase}
      />

      {/* 1.2. Nhóm đối tượng công trình */}
      <Step1ObjectGroupSection
        formData={formData}
        updateFormData={updateFormData}
      />

      {/* 1.3. Thông tin tuyến Metro & GIS */}
      <Step1MetroGisSection formData={formData} />

      {/* 1.4. Công trình liền kề 3 hướng */}
      <Step1AdjacentSection
        formData={formData}
        updateFormData={updateFormData}
      />

      {/* 1.5. Chụp 4 Bộ Ảnh Định Danh Ngoại Thất */}
      <Step1PhotosSection
        formData={formData}
        updateFormData={updateFormData}
        onOpenPolygonModal={() => setIsDrawingPolygon(true)}
      />

      {/* 1.6. Khảo sát trực quan Lún chênh & Nghiêng ngoài nhà */}
      <Step1SettlementTiltSection
        formData={formData}
        updateFormData={updateFormData}
      />

      {/* 1.7. Nhận định loại công trình (Ẩn khi là Toà Chung cư mẹ) */}
      <Step1CaseSelector
        formData={formData}
        updateFormData={updateFormData}
        currentCase={currentCase as any}
        onSelectCase={handleSelectCase}
        isCondoMaster={isCondoMaster}
        completeness={completeness}
        isSubmittingAbsentee={isSubmittingAbsentee}
        onSubmitAbsentee={handleSubmitAbsentee}
        isConfirmingApartment={isConfirmingApartment}
        onConfirmApartment={handleConfirmApartment}
        isSubmittingUnderConstruction={isSubmittingUnderConstruction}
        onSubmitUnderConstruction={handleSubmitUnderConstruction}
        isSubmittingVacantLand={isSubmittingVacantLand}
        onSubmitVacantLand={handleSubmitVacantLand}
      />

      {/* Polygon Drawing Modal - Full Screen */}
      <Step1PolygonModal
        isOpen={isDrawingPolygon}
        onClose={() => setIsDrawingPolygon(false)}
        photoP02Url={formData.photoP02?.url || ''}
        polygonPoints={formData.photoP02?.polygonPoints}
        floorSplits={formData.photoP02?.floorSplits}
        onSave={(data) => {
          updateFormData({
            photoP02: {
              ...formData.photoP02,
              polygonPoints: data.polygonPoints,
              floorSplits: data.splitLines,
            },
          });
        }}
        updateFormData={updateFormData}
        photoP02={formData.photoP02}
      />

      {/* Bottom Action Footer */}
      <Step1BottomNav
        isCondoMaster={isCondoMaster}
        currentCase={currentCase}
        onNextStep={nextStep}
      />

      {/* Success Modals for Absentee, Under Construction, Apartment, Vacant Land */}
      <Step1SuccessModals
        showAbsenteeSuccessModal={showAbsenteeSuccessModal}
        onCloseAbsentee={() => {
          setShowAbsenteeSuccessModal(false);
          clearDraft(true);
          if (onFinished) onFinished();
          else if (onBackToHome) onBackToHome();
          else {
            window.location.hash = '#/';
            window.location.reload();
          }
        }}
        showUnderConstructionSuccessModal={showUnderConstructionSuccessModal}
        onCloseUnderConstruction={() => {
          setShowUnderConstructionSuccessModal(false);
          clearDraft(true);
          if (onFinished) onFinished();
          else if (onBackToHome) onBackToHome();
          else {
            window.location.hash = '#/';
            window.location.reload();
          }
        }}
        showVacantLandSuccessModal={showVacantLandSuccessModal}
        onCloseVacantLand={() => {
          setShowVacantLandSuccessModal(false);
          clearDraft(true);
          if (onFinished) onFinished();
          else if (onBackToHome) onBackToHome();
          else {
            window.location.hash = '#/';
            window.location.reload();
          }
        }}
        showApartmentSuccessModal={showApartmentSuccessModal}
        onCloseApartment={() => {
          setShowApartmentSuccessModal(false);
          clearDraft(true);
          if (onFinished) onFinished();
          else if (onBackToHome) onBackToHome();
          else {
            window.location.hash = '#/';
            window.location.reload();
          }
        }}
        onOpenCondoHub={() => {
          setShowApartmentSuccessModal(false);
          try {
            localStorage.setItem('metro2_open_hub_parcel_id', formData.parcelId);
          } catch (_e) {}
          clearDraft(true);
          if (onFinished) onFinished();
          else if (onBackToHome) onBackToHome();
          else {
            window.location.hash = '#/';
            window.location.reload();
          }
        }}
        buildingCode={buildingIdentifier}
      />
    </div>
  );
};
