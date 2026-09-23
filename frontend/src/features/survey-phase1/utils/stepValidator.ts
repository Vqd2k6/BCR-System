import { Phase1SurveyFormData } from '../types/phase1.types';

export interface MissingFieldItem {
  fieldId: string;
  label: string;
  step: number;
  description?: string;
  isBlocking?: boolean;
}

export interface StepValidationResult {
  isValid: boolean;
  missingFields: MissingFieldItem[];
}

export const validateStep = (step: number, formData: Phase1SurveyFormData): StepValidationResult => {
  const missing: MissingFieldItem[] = [];

  if (step === 1) {
    // 1.1 Project Parcel Code
    if (!formData.projectParcelCode?.trim()) {
      missing.push({
        fieldId: 'input-projectParcelCode',
        label: '1.1. Mã quản lý dự án (Project Parcel Code)',
        step: 1,
        description: 'Vui lòng kiểm tra mã quản lý dự án B-XXXXX.',
      });
    }

    // 1.1 Cadastral Code
    if (!formData.officialCadastralCode?.trim()) {
      missing.push({
        fieldId: 'input-officialCadastralCode',
        label: '1.1. Mã địa chính gốc (Cadastral Code)',
        step: 1,
        description: 'Vui lòng kiểm tra số tờ - số thửa bản đồ địa chính.',
      });
    }

    // 1.1 Address
    if (!formData.houseNumber?.trim() && !formData.street?.trim()) {
      missing.push({
        fieldId: 'input-address',
        label: '1.1. Địa chỉ thực tế công trình',
        step: 1,
        description: 'Vui lòng nhập số nhà hoặc tên đường thực tế.',
      });
    }

    // 1.1 Owner Name
    if (!formData.ownerName?.trim()) {
      missing.push({
        fieldId: 'input-ownerName',
        label: '1.1. Chủ sở hữu / Người sử dụng',
        step: 1,
        description: 'Vui lòng nhập tên chủ hộ hoặc người đại diện sử dụng công trình.',
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

    // 1.5 Mandatory P-02 Polygon if P-02 uploaded
    if (formData.photoP02?.url && (!formData.photoP02.polygonPoints || formData.photoP02.polygonPoints.length < 3)) {
      missing.push({
        fieldId: 'btn-p02-polygon',
        label: '1.5. Chấm điểm đa giác mặt tiền (P-02)',
        step: 1,
        description: 'Vui lòng chấm tối thiểu 3 điểm đỉnh đa giác bao quanh mặt đứng công trình khi có ảnh P-02.',
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

    // 1.6 Data source (Nguồn xác định dữ liệu ngoại quan)
    if (
      formData.surveyCaseType !== 'ABSENTEE' &&
      formData.surveyCaseType !== 'UNDER_CONSTRUCTION' &&
      (!formData.settlementTilt?.dataSource || formData.settlementTilt.dataSource.length === 0)
    ) {
      missing.push({
        fieldId: 'section-settlement-datasource',
        label: '1.6. Nguồn xác định dữ liệu ngoại quan',
        step: 1,
        description: 'Vui lòng chọn ít nhất 1 nguồn xác định dữ liệu ngoại quan (Quan sát thực tế, Đo đạc, Bản vẽ, Chủ nhà).',
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

    if (formData.aboveFloors === undefined || formData.aboveFloors === null || (formData.aboveFloors as any) === '') {
      missing.push({
        fieldId: 'input-aboveFloors',
        label: '2.1. Số tầng nổi',
        step: 2,
        description: 'Vui lòng nhập số tầng nổi (0 nếu đang xây).',
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
        isBlocking: true,
      });
    } else {
      formData.floors.forEach((floor, fIdx) => {
        const floorTitle = floor.floorName || `Tầng ${fIdx + 1}`;
        const cadZonePins = floor.cadZonePins || [];
        const zones = floor.zones || [];
        const cadElementPins = floor.cadElementPins || [];
        const structuralElements = floor.structuralElements || [];

        // 1. Kiểm tra điểm chấm trên CAD_01 và Vùng Z
        if (cadZonePins.length === 0 && zones.length === 0) {
          missing.push({
            fieldId: 'step3-floor-cad-section',
            label: `3.1. Điểm chấm Vùng Z (${floorTitle})`,
            step: 3,
            description: `Chưa có điểm chấm Vùng kiến trúc (Z) nào trên sơ đồ CAD_01 của ${floorTitle}. Vui lòng chấm ít nhất 1 Vùng Z.`,
            isBlocking: true,
          });
        } else if (cadZonePins.length !== zones.length) {
          missing.push({
            fieldId: 'step3-floor-cad-section',
            label: `3.1. Khớp số lượng Vùng Z (${floorTitle})`,
            step: 3,
            description: `Số lượng điểm ghim CAD_01 (${cadZonePins.length}) chưa khớp với số Vùng Z (${zones.length}) của ${floorTitle}. Vui lòng kiểm tra lại.`,
            isBlocking: true,
          });
        }

        // 2. Kiểm tra điểm chấm trên CAD_02 và Cấu kiện E
        if (cadElementPins.length === 0 && structuralElements.length === 0) {
          missing.push({
            fieldId: 'step3-structure-cad-section',
            label: `3.2. Điểm chấm Cấu kiện E (${floorTitle})`,
            step: 3,
            description: `Chưa có điểm chấm Cấu kiện kết cấu chịu lực (E) nào trên sơ đồ CAD_02 của ${floorTitle}. Vui lòng chấm ít nhất 1 Cấu kiện E.`,
            isBlocking: true,
          });
        } else if (cadElementPins.length !== structuralElements.length) {
          missing.push({
            fieldId: 'step3-structure-cad-section',
            label: `3.2. Khớp số lượng Cấu kiện E (${floorTitle})`,
            step: 3,
            description: `Số lượng điểm ghim CAD_02 (${cadElementPins.length}) chưa khớp với số Cấu kiện E (${structuralElements.length}) của ${floorTitle}. Vui lòng kiểm tra lại.`,
            isBlocking: true,
          });
        }

        // 3. Kiểm tra khuyết tật D so với Vùng Z
        zones.forEach((z) => {
          const hasDamageMarked = z.hasDamage || (z.defects && z.defects.length > 0);
          const defectCount = z.defects ? z.defects.length : 0;

          if (hasDamageMarked && defectCount === 0) {
            missing.push({
              fieldId: 'step3-active-zone-card',
              label: `3.1. Ghi sổ khuyết tật D cho Vùng ${z.zoneCode} (${floorTitle})`,
              step: 3,
              description: `Vùng ${z.zoneCode} được đánh dấu CÓ vết nứt/hư hỏng nhưng chưa có điểm khuyết tật D nào được ghi sổ. Vui lòng chấm điểm ghi sổ D-xx hoặc bỏ chọn mục hư hỏng.`,
              isBlocking: true,
            });
          }

          if (hasDamageMarked && defectCount > 0 && !z.ctxPhotoUrl) {
            missing.push({
              fieldId: 'step3-active-zone-card',
              label: `3.1. Ảnh bối cảnh khuyết tật Vùng ${z.zoneCode} (${floorTitle})`,
              step: 3,
              description: `Vùng ${z.zoneCode} có ${defectCount} khuyết tật D nhưng chưa có ảnh bối cảnh chính để định vị. Vui lòng chụp/chọn ảnh bối cảnh.`,
              isBlocking: true,
            });
          }
        });

        // 4. Kiểm tra khuyết tật D so với Cấu kiện E
        structuralElements.forEach((el) => {
          const hasDamageMarked = el.hasDamage || (el.defects && el.defects.length > 0);
          const defectCount = el.defects ? el.defects.length : 0;

          if (hasDamageMarked && defectCount === 0) {
            missing.push({
              fieldId: 'step3-active-element-card',
              label: `3.2. Ghi sổ khuyết tật D cho Cấu kiện ${el.elementCode} (${floorTitle})`,
              step: 3,
              description: `Cấu kiện ${el.elementCode} được đánh dấu CÓ nứt kết cấu/võng nhưng chưa có điểm khuyết tật D nào được ghi sổ. Vui lòng chấm điểm ghi sổ D-xx hoặc bỏ chọn mục hư hỏng.`,
              isBlocking: true,
            });
          }

          if (hasDamageMarked && defectCount > 0 && !el.ctxPhotoUrl) {
            missing.push({
              fieldId: 'step3-active-element-card',
              label: `3.2. Ảnh bối cảnh khuyết tật Cấu kiện ${el.elementCode} (${floorTitle})`,
              step: 3,
              description: `Cấu kiện ${el.elementCode} có ${defectCount} khuyết tật D nhưng chưa có ảnh bối cảnh cấu kiện để định vị. Vui lòng chụp/chọn ảnh bối cảnh.`,
              isBlocking: true,
            });
          }
        });
      });
    }
  }

  if (step === 5) {
    if (!formData.surveyScope?.surveyedFloors || formData.surveyScope.surveyedFloors.length === 0) {
      missing.push({
        fieldId: 'input-surveyedFloors',
        label: '5.1. Danh sách tầng được khảo sát',
        step: 5,
        description: 'Vui lòng chọn ít nhất 1 tầng nằm trong phạm vi khảo sát.',
      });
    }
  }

  if (step === 6) {
    if (
      formData.ecs?.engineeringJudgement?.action &&
      formData.ecs.engineeringJudgement.action !== 'KEEP' &&
      !formData.ecs.engineeringJudgement.reason?.trim()
    ) {
      missing.push({
        fieldId: 'input-ecs-reason',
        label: '6.1. Lý do can thiệp kỹ sư (ECS)',
        step: 6,
        description: 'Khi kỹ sư can thiệp Nâng hoặc Hạ hạng ECS, bắt buộc phải giải trình căn cứ kỹ thuật.',
        isBlocking: true,
      });
    }
  }

  if (step === 8) {
    if (!formData.signatures?.preparedBy?.fullName?.trim()) {
      missing.push({
        fieldId: 'input-preparedBy-name',
        label: '8.1. Họ tên Cán bộ kỹ thuật khảo sát',
        step: 8,
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

  for (let s = 1; s <= 8; s++) {
    const res = validateStep(s, formData);
    allMissing.push(...res.missingFields);
  }

  return {
    isValid: allMissing.length === 0,
    missingFields: allMissing,
  };
};
