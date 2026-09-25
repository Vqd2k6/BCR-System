import { Phase1SurveyFormData } from '../types/phase1.types';

export interface MissingFieldItem {
  fieldId: string;
  label: string;
  step: number;
  floorIndex?: number;
  description?: string;
  isBlocking?: boolean;
}

export interface StepValidationResult {
  isValid: boolean;
  missingFields: MissingFieldItem[];
}

export const validateCondoUnitStep = (step: number, formData: Phase1SurveyFormData): StepValidationResult => {
  const missing: MissingFieldItem[] = [];

  if (step === 1) {
    // Bước 1: Kế thừa dữ liệu toà cha -> hợp lệ
  }

  if (step === 2) {
    // Bước 2: Thông tin định danh căn hộ & chủ hộ
    if (!formData.unitCode?.trim()) {
      missing.push({
        fieldId: 'input-unitCode',
        label: '2.1. Mã Căn Hộ',
        step: 2,
        description: 'Vui lòng nhập mã căn hộ (VD: P.1204).',
        isBlocking: true,
      });
    }

    if (!formData.ownerName?.trim()) {
      missing.push({
        fieldId: 'input-ownerName',
        label: '2.2. Họ tên Chủ hộ / Người sử dụng',
        step: 2,
        description: 'Vui lòng nhập họ tên chủ sở hữu hoặc người sử dụng căn hộ.',
        isBlocking: true,
      });
    }

    if (!formData.photoP01?.url && !formData.photoP01?.notApplicable) {
      missing.push({
        fieldId: 'photo-p01-section',
        label: '2.3. Ảnh P-01 (Cửa chính căn hộ từ hành lang)',
        step: 2,
        description: 'Vui lòng chụp ảnh cửa chính căn hộ từ hành lang hoặc đánh dấu N/A.',
      });
    }

    if (!formData.photoP04?.url && !formData.photoP04?.notApplicable) {
      missing.push({
        fieldId: 'photo-p04-section',
        label: '2.3. Ảnh P-04 (Toàn cảnh phòng khách)',
        step: 2,
        description: 'Vui lòng chụp ảnh không gian sinh hoạt chính / phòng khách hoặc đánh dấu N/A.',
      });
    }
  }

  if (step === 3) {
    // Bước 3: Khảo sát các tầng/phòng chi tiết của căn hộ
    if (!formData.floors || formData.floors.length === 0) {
      missing.push({
        fieldId: 'step3-floor-cad-section',
        label: '3. Khảo sát căn hộ',
        step: 3,
        description: 'Cần có ít nhất 1 không gian khảo sát trong danh sách.',
        isBlocking: true,
      });
    } else {
      formData.floors.forEach((floor, fIdx) => {
        const floorTitle = floor.floorName || `Không gian ${fIdx + 1}`;
        const cadZonePins = floor.cadZonePins || [];
        const zones = floor.zones || [];
        const cadElementPins = floor.cadElementPins || [];
        const structuralElements = floor.structuralElements || [];

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
            description: `Số lượng điểm ghim CAD_01 (${cadZonePins.length}) chưa khớp với số Vùng Z (${zones.length}) của ${floorTitle}.`,
            isBlocking: true,
          });
        }

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
            description: `Số lượng điểm ghim CAD_02 (${cadElementPins.length}) chưa khớp với số Cấu kiện E (${structuralElements.length}) của ${floorTitle}.`,
            isBlocking: true,
          });
        }

        zones.forEach((z) => {
          const hasDamageMarked = z.hasDamage || (z.defects && z.defects.length > 0);
          const defectCount = z.defects ? z.defects.length : 0;
          if (hasDamageMarked && defectCount === 0) {
            missing.push({
              fieldId: 'step3-active-zone-card',
              label: `3.1. Ghi sổ khuyết tật D cho Vùng ${z.zoneCode} (${floorTitle})`,
              step: 3,
              description: `Vùng ${z.zoneCode} được đánh dấu CÓ vết nứt/hư hỏng nhưng chưa có điểm khuyết tật D nào được ghi sổ.`,
              isBlocking: true,
            });
          }
          if (hasDamageMarked && defectCount > 0 && !z.ctxPhotoUrl) {
            missing.push({
              fieldId: 'step3-active-zone-card',
              label: `3.1. Ảnh bối cảnh khuyết tật Vùng ${z.zoneCode} (${floorTitle})`,
              step: 3,
              description: `Vùng ${z.zoneCode} có ${defectCount} khuyết tật D nhưng chưa có ảnh bối cảnh chính để định vị.`,
              isBlocking: true,
            });
          }
        });

        structuralElements.forEach((el) => {
          const hasDamageMarked = el.hasDamage || (el.defects && el.defects.length > 0);
          const defectCount = el.defects ? el.defects.length : 0;
          if (hasDamageMarked && defectCount === 0) {
            missing.push({
              fieldId: 'step3-active-element-card',
              label: `3.2. Ghi sổ khuyết tật D cho Cấu kiện ${el.elementCode} (${floorTitle})`,
              step: 3,
              description: `Cấu kiện ${el.elementCode} được đánh dấu CÓ nứt kết cấu nhưng chưa có điểm khuyết tật D nào được ghi sổ.`,
              isBlocking: true,
            });
          }
          if (hasDamageMarked && defectCount > 0 && !el.ctxPhotoUrl) {
            missing.push({
              fieldId: 'step3-active-element-card',
              label: `3.2. Ảnh bối cảnh khuyết tật Cấu kiện ${el.elementCode} (${floorTitle})`,
              step: 3,
              description: `Cấu kiện ${el.elementCode} có ${defectCount} khuyết tật D nhưng chưa có ảnh bối cảnh cấu kiện để định vị.`,
              isBlocking: true,
            });
          }
        });
      });
    }
  }

  if (step === 5) {
    // Bước 5 ở Căn hộ con: Bảng điểm ECS & VI
    if (
      formData.ecs?.engineeringJudgement?.action &&
      formData.ecs.engineeringJudgement.action !== 'KEEP' &&
      !formData.ecs.engineeringJudgement.reason?.trim()
    ) {
      missing.push({
        fieldId: 'input-ecs-reason',
        label: '5.1. Lý do can thiệp kỹ sư (ECS)',
        step: 5,
        description: 'Khi kỹ sư can thiệp Nâng hoặc Hạ hạng ECS, bắt buộc phải giải trình căn cứ kỹ thuật.',
        isBlocking: true,
      });
    }
  }

  if (step === 7) {
    // Bước 7 ở Căn hộ con: Ký biên bản hiện trường (họ tên cán bộ không bắt buộc)
  }

  return {
    isValid: missing.length === 0,
    missingFields: missing,
  };
};

export const validateStep = (step: number, formData: Phase1SurveyFormData): StepValidationResult => {
  if (Boolean(formData.unitId)) {
    return validateCondoUnitStep(step, formData);
  }

  const missing: MissingFieldItem[] = [];

  if (step === 1) {
    // 1.1 Project Parcel Code
    if (!formData.projectParcelCode?.trim()) {
      missing.push({
        fieldId: 'input-projectParcelCode',
        label: '1.1. Mã quản lý dự án (Project Parcel Code) *',
        step: 1,
        description: 'Vui lòng kiểm tra mã quản lý dự án B-XXXXX.',
        isBlocking: true,
      });
    }

    // 1.1 Cadastral Code
    if (!formData.officialCadastralCode?.trim()) {
      missing.push({
        fieldId: 'input-officialCadastralCode',
        label: '1.1. Mã địa chính gốc (Cadastral Code) *',
        step: 1,
        description: 'Vui lòng kiểm tra số tờ - số thửa bản đồ địa chính.',
        isBlocking: true,
      });
    }

    // 1.1 Building Name
    if (!formData.buildingName?.trim()) {
      missing.push({
        fieldId: 'input-buildingName',
        label: '1.1. Tên công trình / Biển hiệu riêng *',
        step: 1,
        description: 'Vui lòng nhập tên công trình hoặc biển hiệu riêng (VD: Nhà ở hộ gia đình, Cửa hàng...).',
        isBlocking: true,
      });
    }

    // 1.1 Address
    if (!formData.houseNumber?.trim() && !formData.street?.trim()) {
      missing.push({
        fieldId: 'input-address',
        label: '1.1. Địa chỉ thực tế công trình *',
        step: 1,
        description: 'Vui lòng nhập số nhà hoặc tên đường thực tế.',
        isBlocking: true,
      });
    }

    // 1.1 Owner Name
    if (!formData.ownerName?.trim()) {
      missing.push({
        fieldId: 'input-ownerName',
        label: '1.1. Chủ sở hữu / Người sử dụng *',
        step: 1,
        description: 'Vui lòng nhập tên chủ hộ hoặc người đại diện sử dụng công trình.',
        isBlocking: true,
      });
    }

    // 1.4 Adjacent Buildings (3 hướng liền kề)
    if (!formData.adjacentBuildings?.left?.details?.trim()) {
      missing.push({
        fieldId: 'input-adjacentLeft',
        label: '1.4. Công trình liền kề bên trái *',
        step: 1,
        description: 'Vui lòng chọn hiện trạng công trình liền kề bên trái.',
        isBlocking: true,
      });
    }
    if (!formData.adjacentBuildings?.right?.details?.trim()) {
      missing.push({
        fieldId: 'input-adjacentRight',
        label: '1.4. Công trình liền kề bên phải *',
        step: 1,
        description: 'Vui lòng chọn hiện trạng công trình liền kề bên phải.',
        isBlocking: true,
      });
    }
    if (!formData.adjacentBuildings?.back?.details?.trim()) {
      missing.push({
        fieldId: 'input-adjacentBack',
        label: '1.4. Công trình liền kề phía sau *',
        step: 1,
        description: 'Vui lòng chọn hiện trạng công trình liền kề phía sau tiếp giáp.',
        isBlocking: true,
      });
    }

    // 1.5 Photos
    if (!formData.photoP01?.url && !formData.photoP01?.notApplicable) {
      missing.push({
        fieldId: 'photo-p01-section',
        label: '1.5. Ảnh P-01 (Biển số nhà) *',
        step: 1,
        description: 'Vui lòng chụp ảnh biển số nhà hoặc đánh dấu N/A nếu không có.',
        isBlocking: true,
      });
    }

    if (!formData.photoP02?.url && !formData.photoP02?.notApplicable) {
      missing.push({
        fieldId: 'photo-p02-section',
        label: '1.5. Ảnh P-02 (Mặt đứng chính diện) *',
        step: 1,
        description: 'Vui lòng chụp ảnh trực diện ngôi nhà hoặc đánh dấu N/A.',
        isBlocking: true,
      });
    }

    // 1.5 Mandatory P-02 Polygon if P-02 uploaded
    if (formData.photoP02?.url && (!formData.photoP02.polygonPoints || formData.photoP02.polygonPoints.length < 3)) {
      missing.push({
        fieldId: 'btn-p02-polygon',
        label: '1.5. Chấm điểm đa giác mặt tiền (P-02) *',
        step: 1,
        description: 'Vui lòng chấm tối thiểu 3 điểm đỉnh đa giác bao quanh mặt đứng công trình khi có ảnh P-02.',
        isBlocking: true,
      });
    }

    if (!formData.photoP03?.url && !formData.photoP03?.notApplicable) {
      missing.push({
        fieldId: 'photo-p03-section',
        label: '1.5. Ảnh P-03 (Mặt bên hoặc mặt sau) *',
        step: 1,
        description: 'Vui lòng chụp ảnh mặt hông/sau hoặc đánh dấu N/A.',
        isBlocking: true,
      });
    }

    if (!formData.photoP04?.url && !formData.photoP04?.notApplicable) {
      missing.push({
        fieldId: 'photo-p04-section',
        label: '1.5. Ảnh P-04 (Bối cảnh tổng thể lấy đường/hẻm) *',
        step: 1,
        description: 'Vui lòng chụp ảnh bối cảnh đường hoặc đánh dấu N/A.',
        isBlocking: true,
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
        label: '1.6. Nguồn xác định dữ liệu ngoại quan *',
        step: 1,
        description: 'Vui lòng chọn ít nhất 1 nguồn xác định dữ liệu ngoại quan (Quan sát thực tế, Đo đạc, Bản vẽ, Chủ nhà).',
        isBlocking: true,
      });
    }

    // Special cases validation
    if (formData.surveyCaseType === 'ABSENTEE') {
      if (!formData.absenteeReason?.trim()) {
        missing.push({
          fieldId: 'input-absenteeReason',
          label: '1.7. Lý do vắng mặt / không tiếp cận *',
          step: 1,
          description: 'Vui lòng chọn hoặc nhập lý do vắng nhà.',
          isBlocking: true,
        });
      }
      if (!formData.absenteeMinutesPhotos || formData.absenteeMinutesPhotos.length === 0) {
        missing.push({
          fieldId: 'absentee-minutes-section',
          label: '1.7. Ảnh biên bản vắng nhà *',
          step: 1,
          description: 'Vui lòng chụp ít nhất 1 ảnh biên bản dán thông báo vắng nhà.',
          isBlocking: true,
        });
      }
    }

    if (formData.surveyCaseType === 'UNDER_CONSTRUCTION') {
      if (!formData.underConstructionPhotos || formData.underConstructionPhotos.length === 0) {
        missing.push({
          fieldId: 'under-construction-photos-section',
          label: '1.7. Ảnh hiện trạng công trình đang thi công *',
          step: 1,
          description: 'Vui lòng chụp ít nhất 1 ảnh hiện trường móng/cột/sàn đang xây dựng.',
          isBlocking: true,
        });
      }
      if (!formData.constructionStageNotes?.trim()) {
        missing.push({
          fieldId: 'input-constructionStageNotes',
          label: '1.7. Ghi chú giai đoạn thi công *',
          step: 1,
          description: 'Vui lòng nhập mô tả giai đoạn thi công hiện tại.',
          isBlocking: true,
        });
      }
    }
  }

  if (step === 2) {
    if (!formData.usageFunction?.trim()) {
      missing.push({
        fieldId: 'input-usageFunction',
        label: '2.1. Công năng sử dụng *',
        step: 2,
        description: 'Vui lòng chọn công năng của công trình.',
        isBlocking: true,
      });
    }

    if (formData.aboveFloors === undefined || formData.aboveFloors === null || (formData.aboveFloors as any) === '') {
      missing.push({
        fieldId: 'input-aboveFloors',
        label: '2.1. Số tầng nổi *',
        step: 2,
        description: 'Vui lòng nhập số tầng nổi (0 nếu đang xây móng).',
        isBlocking: true,
      });
    }

    if (!formData.constructionAreaM2 || Number(formData.constructionAreaM2) <= 0) {
      missing.push({
        fieldId: 'input-constructionAreaM2',
        label: '2.1. Diện tích sàn xây dựng *',
        step: 2,
        description: 'Vui lòng nhập diện tích sàn xây dựng thực tế (> 0 m²).',
        isBlocking: true,
      });
    }

    if (!formData.buildingHeightM || Number(formData.buildingHeightM) <= 0) {
      missing.push({
        fieldId: 'input-buildingHeightM',
        label: '2.1. Chiều cao công trình *',
        step: 2,
        description: 'Vui lòng nhập chiều cao công trình thực tế (> 0 m).',
        isBlocking: true,
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
        label: '2.1. Hệ kết cấu chịu lực *',
        step: 2,
        description: 'Vui lòng chọn hệ kết cấu chịu lực (RC, Steel, Masonry...).',
        isBlocking: true,
      });
    }

    if (!formData.foundationType?.trim()) {
      missing.push({
        fieldId: 'input-foundationType',
        label: '2.1. Loại móng *',
        step: 2,
        description: 'Vui lòng chọn loại móng của ngôi nhà.',
        isBlocking: true,
      });
    }

    // Trường hợp A: Có bản vẽ hoàn công/thiết kế bắt buộc ảnh bản vẽ
    if ((formData.foundationCatScore === 1 || formData.foundationCatScore === 2) && !formData.asBuiltDrawingPhotoUrl) {
      missing.push({
        fieldId: 'as-built-drawing-section',
        label: '2.1. Bản vẽ hoàn công / kết cấu (Trường hợp A) *',
        step: 2,
        description: 'Trường hợp A (Có bản vẽ) bắt buộc phải chụp ảnh hoặc tải lên bản vẽ kỹ thuật.',
        isBlocking: true,
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
            floorIndex: fIdx,
            description: `Chưa có điểm chấm Vùng kiến trúc (Z) nào trên sơ đồ CAD_01 của ${floorTitle}. Vui lòng chấm ít nhất 1 Vùng Z.`,
            isBlocking: true,
          });
        } else if (cadZonePins.length !== zones.length) {
          missing.push({
            fieldId: 'step3-floor-cad-section',
            label: `3.1. Khớp số lượng Vùng Z (${floorTitle})`,
            step: 3,
            floorIndex: fIdx,
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
            floorIndex: fIdx,
            description: `Chưa có điểm chấm Cấu kiện kết cấu chịu lực (E) nào trên sơ đồ CAD_02 của ${floorTitle}. Vui lòng chấm ít nhất 1 Cấu kiện E.`,
            isBlocking: true,
          });
        } else if (cadElementPins.length !== structuralElements.length) {
          missing.push({
            fieldId: 'step3-structure-cad-section',
            label: `3.2. Khớp số lượng Cấu kiện E (${floorTitle})`,
            step: 3,
            floorIndex: fIdx,
            description: `Số lượng điểm ghim CAD_02 (${cadElementPins.length}) chưa khớp với số Cấu kiện E (${structuralElements.length}) của ${floorTitle}. Vui lòng kiểm tra lại.`,
            isBlocking: true,
          });
        }

        // 3. Kiểm tra thuộc tính bắt buộc của Vùng Z (Tên phòng, cấu kiện, vật liệu) & khuyết tật D
        zones.forEach((z) => {
          if (!z.roomName?.trim() || (z.roomName === 'Khác' && !z.customRoomName?.trim())) {
            missing.push({
              fieldId: 'select-zone-roomName',
              label: `3.1. Tên phòng / không gian Vùng ${z.zoneCode} (${floorTitle}) *`,
              step: 3,
              floorIndex: fIdx,
              description: `Vui lòng chọn hoặc nhập tên phòng cho Vùng ${z.zoneCode}.`,
              isBlocking: true,
            });
          }

          if (!z.componentType?.trim() || (z.componentType === 'Khác' && !z.customComponentType?.trim())) {
            missing.push({
              fieldId: 'select-zone-componentType',
              label: `3.1. Cấu kiện vách kiến trúc Vùng ${z.zoneCode} (${floorTitle}) *`,
              step: 3,
              floorIndex: fIdx,
              description: `Vui lòng chọn hoặc nhập loại cấu kiện mảng vách cho Vùng ${z.zoneCode}.`,
              isBlocking: true,
            });
          }

          if (!z.wallMaterial?.trim() || (z.wallMaterial === 'Khác' && !z.customWallMaterial?.trim())) {
            missing.push({
              fieldId: 'select-zone-wallMaterial',
              label: `3.1. Vật liệu bề mặt hoàn thiện Vùng ${z.zoneCode} (${floorTitle}) *`,
              step: 3,
              floorIndex: fIdx,
              description: `Vui lòng chọn hoặc nhập vật liệu bề mặt hoàn thiện cho Vùng ${z.zoneCode}.`,
              isBlocking: true,
            });
          }

          const hasDamageMarked = z.hasDamage || (z.defects && z.defects.length > 0);
          const defectCount = z.defects ? z.defects.length : 0;

          if (hasDamageMarked && defectCount === 0) {
            missing.push({
              fieldId: 'step3-active-zone-card',
              label: `3.1. Ghi sổ khuyết tật D cho Vùng ${z.zoneCode} (${floorTitle})`,
              step: 3,
              floorIndex: fIdx,
              description: `Vui lòng chấm ít nhất 1 khuyết tật D cho Vùng ${z.zoneCode}.`,
              isBlocking: true,
            });
          }

          if (hasDamageMarked && defectCount > 0 && !z.ctxPhotoUrl) {
            missing.push({
              fieldId: 'step3-active-zone-card',
              label: `3.1. Ảnh bối cảnh khuyết tật Vùng ${z.zoneCode} (${floorTitle})`,
              step: 3,
              floorIndex: fIdx,
              description: `Vùng ${z.zoneCode} có ${defectCount} khuyết tật D nhưng chưa có ảnh bối cảnh chính để định vị. Vui lòng chụp/chọn ảnh bối cảnh.`,
              isBlocking: true,
            });
          }

          // Kiểm tra chi tiết từng khuyết tật D trong Vùng Z
          z.defects?.forEach((d) => {
            if (!d.cuPhotoUrl || !d.notes?.trim() || !d.defectType || !Number(d.widthMaxMm)) {
              missing.push({
                fieldId: 'step3-active-zone-card',
                label: `3.1. Thông số chi tiết vết nứt ${d.defectCode} (${z.zoneCode} - ${floorTitle})`,
                step: 3,
                floorIndex: fIdx,
                description: `Khuyết tật ${d.defectCode} chưa điền đủ các thông số bắt buộc (ảnh cận cảnh CU, kích thước bề rộng/dài, dạng nứt hoặc ghi chú).`,
                isBlocking: true,
              });
            }
          });
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
              floorIndex: fIdx,
              description: `Cấu kiện ${el.elementCode} được đánh dấu CÓ nứt kết cấu/võng nhưng chưa có điểm khuyết tật D nào được ghi sổ. Vui lòng chấm điểm ghi sổ D-xx hoặc bỏ chọn mục hư hỏng.`,
              isBlocking: true,
            });
          }

          if (hasDamageMarked && defectCount > 0 && !el.ctxPhotoUrl) {
            missing.push({
              fieldId: 'step3-active-element-card',
              label: `3.2. Ảnh bối cảnh khuyết tật Cấu kiện ${el.elementCode} (${floorTitle})`,
              step: 3,
              floorIndex: fIdx,
              description: `Cấu kiện ${el.elementCode} có ${defectCount} khuyết tật D nhưng chưa có ảnh bối cảnh cấu kiện để định vị. Vui lòng chụp/chọn ảnh bối cảnh.`,
              isBlocking: true,
            });
          }

          // Kiểm tra chi tiết từng khuyết tật D trong Cấu kiện E
          el.defects?.forEach((d) => {
            if (!d.cuPhotoUrl || !d.notes?.trim() || !d.defectType || !Number(d.widthMaxMm)) {
              missing.push({
                fieldId: 'step3-active-element-card',
                label: `3.2. Thông số chi tiết vết nứt kết cấu ${d.defectCode} (${el.elementCode} - ${floorTitle})`,
                step: 3,
                floorIndex: fIdx,
                description: `Khuyết tật kết cấu ${d.defectCode} chưa điền đủ các thông số bắt buộc (ảnh cận cảnh CU, kích thước bề rộng/dài, dạng nứt kết cấu hoặc ghi chú).`,
                isBlocking: true,
              });
            }
          });
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

    const isSplit =
      formData.gisMutationConfirmed?.type === 'SPLIT' || (formData as any).gisMutation?.type === 'SPLIT';
    const splitReason =
      formData.gisMutationConfirmed?.details?.splitReason ||
      formData.gisMutationConfirmed?.notes ||
      (formData as any).gisMutation?.splitReason;

    if (isSplit && !splitReason?.trim()) {
      missing.push({
        fieldId: 'input-splitReason',
        label: '5.2. Lý do chia tách thửa đất',
        step: 5,
        description: 'Bắt buộc phải chọn hoặc nhập lý do chia tách thửa đất thực tế.',
        isBlocking: true,
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
    if (!formData.signatures?.ownerFeedback?.trim() && !formData.ownerRemarks?.trim()) {
      missing.push({
        fieldId: 'input-ownerFeedback',
        label: '8.1. Ý kiến / phản hồi của chủ sở hữu *',
        step: 8,
        description: 'Vui lòng ghi nhận ý kiến phản hồi thực tế của chủ sở hữu / người sử dụng tại hiện trường.',
        isBlocking: true,
      });
    }

    if (!formData.signatures?.workingMinutesPhotos || formData.signatures.workingMinutesPhotos.length === 0) {
      missing.push({
        fieldId: 'working-minutes-section',
        label: '8.2. Ảnh chụp biên bản làm việc hiện trường *',
        step: 8,
        description: 'Vui lòng chụp ít nhất 1 ảnh biên bản làm việc hiện trường có chữ ký xác nhận.',
        isBlocking: true,
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

  // Đối với căn hộ chung cư con: kiểm tra 7 bước chuẩn
  if (Boolean(formData.unitId)) {
    for (let s = 1; s <= 7; s++) {
      const res = validateCondoUnitStep(s, formData);
      allMissing.push(...res.missingFields);
    }
    return {
      isValid: allMissing.length === 0,
      missingFields: allMissing,
    };
  }

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
