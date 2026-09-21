import { Phase1SurveyFormData } from '../types/phase1.types';

export interface MissingFieldItem {
  fieldId: string;
  label: string;
  step: number;
  description?: string;
}

export interface StepValidationResult {
  isValid: boolean;
  missingFields: MissingFieldItem[];
}

export const validateStep = (step: number, formData: Phase1SurveyFormData): StepValidationResult => {
  const missing: MissingFieldItem[] = [];

  if (step === 1) {
    // 1.1 Cadastral Code
    if (!formData.officialCadastralCode?.trim()) {
      missing.push({
        fieldId: 'input-officialCadastralCode',
        label: '1.1. Mã địa chính gốc (KS003)',
        step: 1,
        description: 'Vui lòng nhập số tờ - số thửa bản đồ địa chính.',
      });
    }

    // 1.1 Address
    if (!formData.houseNumber?.trim()) {
      missing.push({
        fieldId: 'input-houseNumber',
        label: '1.1. Số nhà',
        step: 1,
        description: 'Vui lòng nhập số nhà thực tế.',
      });
    }

    if (!formData.street?.trim()) {
      missing.push({
        fieldId: 'input-street',
        label: '1.1. Tên đường',
        step: 1,
        description: 'Vui lòng nhập tên đường.',
      });
    }

    // 1.5 Photos
    if (!formData.photoP01?.url && !formData.photoP01?.notApplicable) {
      missing.push({
        fieldId: 'photo-p01-section',
        label: '1.5. Ảnh P-01 (Biển số nhà)',
        step: 1,
        description: 'Vui lòng chụp ảnh biển số nhà hoặc đánh dấu N/A nếu không có.',
      });
    }

    if (!formData.photoP02?.url && !formData.photoP02?.notApplicable) {
      missing.push({
        fieldId: 'photo-p02-section',
        label: '1.5. Ảnh P-02 (Mặt đứng chính diện)',
        step: 1,
        description: 'Vui lòng chụp ảnh trực diện ngôi nhà hoặc đánh dấu N/A.',
      });
    }

    if (!formData.photoP03?.url && !formData.photoP03?.notApplicable) {
      missing.push({
        fieldId: 'photo-p03-section',
        label: '1.5. Ảnh P-03 (Mặt bên hoặc mặt sau)',
        step: 1,
        description: 'Vui lòng chụp ảnh mặt hông/sau hoặc đánh dấu N/A.',
      });
    }

    if (!formData.photoP04?.url && !formData.photoP04?.notApplicable) {
      missing.push({
        fieldId: 'photo-p04-section',
        label: '1.5. Ảnh P-04 (Bối cảnh tổng thể lấy đường/hẻm)',
        step: 1,
        description: 'Vui lòng chụp ảnh bối cảnh đường hoặc đánh dấu N/A.',
      });
    }

    // Special cases validation
    if (formData.surveyCaseType === 'ABSENTEE') {
      if (!formData.absenteeReason?.trim()) {
        missing.push({
          fieldId: 'input-absenteeReason',
          label: '1.7. Lý do vắng nhà',
          step: 1,
          description: 'Vui lòng chọn hoặc nhập lý do vắng nhà.',
        });
      }
      if (!formData.absenteeMinutesPhotos || formData.absenteeMinutesPhotos.length === 0) {
        missing.push({
          fieldId: 'absentee-minutes-section',
          label: '1.7. Ảnh biên bản vắng nhà',
          step: 1,
          description: 'Vui lòng chụp ít nhất 1 ảnh biên bản dán thông báo vắng nhà.',
        });
      }
    }

    if (formData.surveyCaseType === 'UNDER_CONSTRUCTION') {
      if (!formData.underConstructionPhotos || formData.underConstructionPhotos.length === 0) {
        missing.push({
          fieldId: 'under-construction-photos-section',
          label: '1.7. Ảnh hiện trạng công trình đang thi công',
          step: 1,
          description: 'Vui lòng chụp ít nhất 1 ảnh hiện trường móng/cột/sàn đang xây dựng.',
        });
      }
    }
  }

  if (step === 2) {
    if (!formData.usageFunction?.trim()) {
      missing.push({
        fieldId: 'input-usageFunction',
        label: '2.1. Công năng sử dụng',
        step: 2,
        description: 'Vui lòng chọn công năng của công trình.',
      });
    }

    if (!formData.aboveFloors || formData.aboveFloors < 1) {
      missing.push({
        fieldId: 'input-aboveFloors',
        label: '2.1. Số tầng nổi',
        step: 2,
        description: 'Vui lòng nhập số tầng nổi (tối thiểu 1 tầng).',
      });
    }

    if (!formData.constructionYear) {
      missing.push({
        fieldId: 'input-constructionYear',
        label: '2.1. Năm xây dựng',
        step: 2,
        description: 'Vui lòng nhập năm xây dựng (hoặc ước tính).',
      });
    }

    if (!formData.structureSystem?.trim()) {
      missing.push({
        fieldId: 'input-structureSystem',
        label: '2.1. Hệ kết cấu chịu lực',
        step: 2,
        description: 'Vui lòng chọn hệ kết cấu chịu lực (RC, Steel, Masonry...).',
      });
    }

    if (!formData.foundationType?.trim()) {
      missing.push({
        fieldId: 'input-foundationType',
        label: '2.1. Loại móng',
        step: 2,
        description: 'Vui lòng chọn loại móng của ngôi nhà.',
      });
    }
  }

  if (step === 3) {
    if (!formData.floors || formData.floors.length === 0) {
      missing.push({
        fieldId: 'step3-floor-cad-section',
        label: '3. Khảo sát các tầng',
        step: 3,
        description: 'Cần có ít nhất 1 tầng được khảo sát trong danh sách.',
      });
    }
  }

  if (step === 6) {
    if (!formData.surveyScope?.surveyedFloors || formData.surveyScope.surveyedFloors.length === 0) {
      missing.push({
        fieldId: 'input-surveyedFloors',
        label: '6.1. Danh sách tầng được khảo sát',
        step: 6,
        description: 'Vui lòng chọn ít nhất 1 tầng nằm trong phạm vi khảo sát.',
      });
    }
  }

  if (step === 9) {
    if (!formData.signatures?.preparedBy?.fullName?.trim()) {
      missing.push({
        fieldId: 'input-preparedBy-name',
        label: '9.1. Họ tên Cán bộ kỹ thuật khảo sát',
        step: 9,
        description: 'Vui lòng nhập đầy đủ họ tên cán bộ thực hiện.',
      });
    }
  }

  return {
    isValid: missing.length === 0,
    missingFields: missing,
  };
};

export const validateAllSteps = (formData: Phase1SurveyFormData): StepValidationResult => {
  const allMissing: MissingFieldItem[] = [];

  // If absentee or under construction, only Step 1 is required
  if (formData.surveyCaseType === 'ABSENTEE' || formData.surveyCaseType === 'UNDER_CONSTRUCTION') {
    const step1Res = validateStep(1, formData);
    return step1Res;
  }

  for (let s = 1; s <= 9; s++) {
    const res = validateStep(s, formData);
    allMissing.push(...res.missingFields);
  }

  return {
    isValid: allMissing.length === 0,
    missingFields: allMissing,
  };
};
