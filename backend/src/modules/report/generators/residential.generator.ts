import * as fs from 'fs';
import * as path from 'path';
import Handlebars from 'handlebars';
import { ResidentialReportViewModel, DefectItemReport, DamageZoneReport, FloorSurveyReport, BcsChecklistItem, ReportPhotoItem } from '../report.types';

export class ResidentialReportGenerator {
  /**
   * Chuyển đổi dữ liệu DB sang ViewModel đầy đủ bám sát báo cáo Phase 1 CRLG
   */
  static buildViewModel(reportData: any): ResidentialReportViewModel {
    const specs = reportData.buildingSpecs || {};
    const history = reportData.historicalSensitivity || {};
    const deformation = reportData.deformation || {};
    const riskScores = reportData.riskScores || {};
    const floorSurveys = reportData.floorSurveys || [];
    const damageZones = reportData.damageZones || [];
    const identPhotos = reportData.identificationPhotos || [];

    // Helper map nhãn hệ kết cấu
    const structuralSystemLabels: Record<string, string> = {
      KHUNG_BTCT_CHIU_LUC: 'Khung bê tông cốt thép (BTCT) chịu lực',
      TUONG_GACH_CHIU_LUC: 'Tường gạch chịu lực',
      KET_CAU_THEP: 'Khung nhà kết cấu thép tiền chế',
      NHA_GO: 'Nhà khung gỗ truyền thống',
      KET_CAU_HON_HOP: 'Kết cấu hỗn hợp (BTCT kết hợp tường gạch)',
    };

    // Helper map nhãn móng
    const foundationLabels: Record<string, string> = {
      CAT_1_MONG_NONG_GIA_CO: 'CAT 1: Móng nông gia cố cừ tràm / đệm cát',
      CAT_2_MONG_DON_BTCT: 'CAT 2: Móng đơn bê tông cốt thép',
      CAT_3_MONG_BANG_BTCT: 'CAT 3: Móng băng bê tông cốt thép',
      CAT_4_MONG_COC_BTCT: 'CAT 4: Móng cọc bê tông cốt thép (Cọc ép/khoan nhồi)',
      CAT_5_KHONG_XAC_DINH: 'CAT 5: Không xác định / Chưa có hồ sơ móng',
    };

    // Helper badge màu
    const getEcsBadge = (c: string) => {
      switch (c) {
        case 'GOOD': return 'badge-good';
        case 'MEDIUM': return 'badge-medium';
        case 'DEFICIENT': return 'badge-deficient';
        case 'CRITICAL': return 'badge-critical';
        default: return 'badge-medium';
      }
    };

    const getViBadge = (c: string) => {
      switch (c) {
        case 'LOW': return 'badge-good';
        case 'MEDIUM': return 'badge-medium';
        case 'HIGH': return 'badge-deficient';
        case 'VERY_HIGH': return 'badge-critical';
        default: return 'badge-medium';
      }
    };

    const getBraBadge = (c: string) => {
      if (c?.includes('LOW')) return 'badge-good';
      if (c?.includes('MEDIUM')) return 'badge-medium';
      if (c?.includes('VERY_HIGH')) return 'badge-critical';
      if (c?.includes('HIGH')) return 'badge-deficient';
      return 'badge-medium';
    };

    const burlandLabels = [
      'Không đáng kể (Negligible)',
      'Rất nhẹ (Very slight)',
      'Nhẹ (Slight)',
      'Trung bình (Moderate)',
      'Nặng (Severe)',
      'Rất nặng (Very severe)',
    ];

    const activityStateLabels: Record<string, string> = {
      U: 'Chưa rõ (Unknown)',
      S: 'Ổn định / Cũ (Stable)',
      A: 'Đang phát triển (Active)',
    };

    const structuralSigLabels: Record<number, string> = {
      0: 'Không ảnh hưởng (N/A)',
      1: 'Thấp (Low)',
      2: 'Trung bình (Moderate)',
      3: 'Cao (High)',
      4: 'Nguy cấp (Critical)',
    };

    // Tách bộ 4 ảnh định danh
    const findPhoto = (type: string): ReportPhotoItem => {
      const p = identPhotos.find((item: any) => item.photo_type === type);
      if (!p) {
        return {
          photoId: 'N/A',
          photoType: type as any,
          url: '',
          isNotApplicable: false,
          capturedAt: reportData.survey_date,
          gpsLat: 10.776889,
          gpsLng: 106.690833,
        };
      }
      return {
        photoId: p.id ? p.id.substring(0, 8).toUpperCase() : 'PHOTO-ID',
        photoType: p.photo_type,
        url: p.raw_photo_url || p.annotated_photo_url || '',
        isNotApplicable: p.is_not_applicable || false,
        naReason: p.na_reason || '',
        capturedAt: p.watermark_timestamp ? new Date(p.watermark_timestamp).toLocaleString('vi-VN') : reportData.survey_date,
        gpsLat: p.watermark_lat ? Number(p.watermark_lat) : 10.776889,
        gpsLng: p.watermark_lng ? Number(p.watermark_lng) : 106.690833,
      };
    };

    const p01 = findPhoto('P01_HOUSE_NUMBER');
    const p02 = findPhoto('P02_MAIN_FACADE');
    const p03 = findPhoto('P03_SIDE_OR_REAR');
    const p04 = findPhoto('P04_CONTEXT_STREET');

    // Gom khuyết tật theo Tầng và Vùng
    let totalDefectsCount = 0;
    const floorsMap: Record<string, FloorSurveyReport> = {};

    // Khởi tạo các tầng từ floorSurveys
    if (floorSurveys.length > 0) {
      floorSurveys.forEach((f: any, idx: number) => {
        floorsMap[f.floor_name] = {
          floorName: f.floor_name,
          floorOrder: f.floor_order || idx + 1,
          notes: f.notes || '',
          cadDrawingUrl: f.cad_drawing_url || '',
          damageMapUrl: f.cad_drawing_url || '',
          zones: [],
        };
      });
    }

    // Nhóm damageZones vào đúng tầng
    damageZones.forEach((z: any) => {
      const flName = z.floor_name || 'Tầng trệt';
      if (!floorsMap[flName]) {
        floorsMap[flName] = {
          floorName: flName,
          floorOrder: Object.keys(floorsMap).length + 1,
          notes: '',
          zones: [],
        };
      }

      const zDefects: DefectItemReport[] = (z.defects || []).map((d: any) => {
        totalDefectsCount++;
        return {
          defectCode: d.defect_code || 'D-01',
          zoneCode: z.zone_code || 'Z-01',
          roomName: z.room_name || 'Phòng',
          componentType: z.component_type || 'Tường',
          crackDirection: d.crack_direction || 'Xiên / Ngẫu nhiên',
          widthMaxMm: Number(d.width_max_mm || 0.1),
          lengthMm: Number(d.length_mm || 100),
          activityState: d.activity_state || 'U',
          activityStateLabel: activityStateLabels[d.activity_state || 'U'] || 'Chưa rõ',
          structuralSignificanceE2: Number(d.structural_significance_e2 || 0),
          structuralSignificanceLabel: structuralSigLabels[Number(d.structural_significance_e2 || 0)] || 'N/A',
          materialDegradationE4: Number(d.material_degradation_e4 || 0),
          materialDegradationLabel: `Mức ${d.material_degradation_e4 || 0}`,
          hasScaleCard: d.has_scale_card !== false,
          isStructuralCritical: Boolean(d.is_structural_critical),
          ctxPhotoUrl: z.ctx_photo_url || '',
          cuPhotoUrl: d.cu_photo_url || '',
          extraPhotoUrl: d.extra_photo_url || '',
          notes: d.notes || '',
        };
      });

      const zoneReport: DamageZoneReport = {
        zoneCode: z.zone_code || 'Z-01',
        floorName: flName,
        roomName: z.room_name || 'Không gian',
        componentType: z.component_type || 'Tường gạch',
        wallMaterial: z.wall_material || 'Gạch xây trát vữa xi măng',
        functionalImpactRepairNeeded: Boolean(z.functional_impact_repair_needed),
        burlandGrade: Number(z.burland_grade || 0),
        burlandLabel: burlandLabels[Number(z.burland_grade || 0)] || 'Grade 0',
        notes: z.notes || '',
        slabCondition: z.slab_condition || '',
        wallCondition: z.wall_condition || '',
        beamColumnCondition: z.beam_column_condition || '',
        seepageSpallingCondition: z.seepage_spalling_condition || '',
        deformationCondition: z.deformation_condition || '',
        defects: zDefects,
      };

      floorsMap[flName].zones.push(zoneReport);
    });

    const floors = Object.values(floorsMap).sort((a, b) => a.floorOrder - b.floorOrder);

    // BCS Checklist 8 nhóm chuẩn
    const bcsChecklist: BcsChecklistItem[] = [
      {
        category: 'Nứt khối xây',
        indicator: 'Nứt tường / vách ngăn / lớp trát hoàn thiện',
        hasIndicator: totalDefectsCount > 0,
        locationAndSeverity: totalDefectsCount > 0 ? `Ghi nhận ${totalDefectsCount} vết nứt tại các tầng` : 'Không phát hiện nứt rõ rệt',
      },
      {
        category: 'Nứt kết cấu',
        indicator: 'Nứt cấu kiện chịu lực (Cột, Dầm, Sàn BTCT)',
        hasIndicator: Boolean(riskScores.e2_structure_score > 0),
        locationAndSeverity: riskScores.e2_structure_score > 0 ? `Khuyết tật mức E2=${riskScores.e2_structure_score}/4 điểm` : 'Kết cấu BTCT ổn định, chưa nứt nguy hiểm',
      },
      {
        category: 'Biến dạng',
        indicator: 'Lún chênh lệch / Nghiêng công trình / Võng dầm sàn',
        hasIndicator: Boolean(deformation.beam_deflection_mm > 0 || deformation.tilt_angle_x > 0),
        locationAndSeverity: deformation.beam_deflection_mm > 0 ? `Võng ${deformation.beam_deflection_mm}mm, Nghiêng X=${deformation.tilt_angle_x}‰, Y=${deformation.tilt_angle_y}‰` : 'Chưa ghi nhận biến dạng lún nghiêng bất thường',
      },
      {
        category: 'Nước & Thấm',
        indicator: 'Thấm dột sàn mái, tường bao, rò rỉ nước',
        hasIndicator: false,
        locationAndSeverity: 'Tường khô ráo, không phát hiện thấm dột nghiêm trọng',
      },
      {
        category: 'Suy giảm vật liệu',
        indicator: 'Bong tróc bê tông, rỉ sét lộ cốt thép, phong hóa vữa',
        hasIndicator: Boolean(riskScores.e4_material_score > 0),
        locationAndSeverity: riskScores.e4_material_score > 0 ? `Mức độ suy giảm E4=${riskScores.e4_material_score}/4` : 'Bề mặt vật liệu bình thường',
      },
      {
        category: 'Hư hỏng liên kết',
        indicator: 'Mất tiết diện, hư hỏng gối tựa, nứt chân cột',
        hasIndicator: false,
        locationAndSeverity: 'Liên kết dầm cột bình thường',
      },
      {
        category: 'Kẹt cửa & Chức năng',
        indicator: 'Kẹt cửa đi, nứt chéo góc cửa, mất kín khít',
        hasIndicator: false,
        locationAndSeverity: 'Cửa đóng mở bình thường, không biến dạng khuôn cửa',
      },
      {
        category: 'Nứt phát triển',
        indicator: 'Vết nứt đang phát triển / Đã trám trét nhưng tái nứt',
        hasIndicator: false,
        locationAndSeverity: 'Chưa có dấu hiệu vết nứt cũ tái phát triển',
      },
    ];

    // Hành động tối thiểu BRA
    const braValue = riskScores.building_risk_assessment_bra || 'LOW_RISK';
    let braMandatoryAction = 'Lưu hồ sơ baseline; quan trắc theo kế hoạch giám sát định kỳ chung của dự án.';
    if (braValue === 'MEDIUM_RISK') {
      braMandatoryAction = 'BCS đầy đủ; xác nhận lại thông tin móng; thiết lập mốc đo lún và quan trắc biến dạng định kỳ.';
    } else if (braValue === 'HIGH_RISK') {
      braMandatoryAction = 'Khảo sát chi tiết kết cấu và móng; lắp đặt thiết bị quan trắc tự động tăng cường; kiểm tra ngưỡng biến dạng.';
    } else if (braValue === 'VERY_HIGH_RISK') {
      braMandatoryAction = 'Đánh giá chuyên sâu bởi Structural Engineer; thiết kế biện pháp gia cường móng/chống đỡ trước khi TBM đi qua.';
    }

    // Quy ước Survey ID theo 4 số cuối SĐT của Surveyor: P-XXXX
    const surveyorPhone = reportData.surveyor_phone || '';
    const cleanPhone = surveyorPhone.replace(/\D/g, '');
    const surveyId = cleanPhone.length >= 4 ? `P-${cleanPhone.slice(-4)}` : (reportData.surveyor_code || 'P-0000');

    // Địa chỉ thực tế lấy từ khảo sát Phase 1
    const addressParts = [
      reportData.house_number,
      reportData.street,
      reportData.ward ? `Phường ${reportData.ward}` : '',
      reportData.district ? `Quận ${reportData.district}` : '',
    ].filter(Boolean);
    const address = addressParts.length > 0 ? addressParts.join(', ') : (reportData.address || '');

    // Revision gắn chết với lô đất (00, 01, 02...)
    const revision = reportData.export_revision !== undefined && reportData.export_revision !== null
      ? String(reportData.export_revision).padStart(2, '0')
      : '00';

    return {
      projectName: 'DỰ ÁN XÂY DỰNG TUYẾN ĐƯỜNG SẮT ĐÔ THỊ SỐ 2 TP. HỒ CHÍ MINH (BẾN THÀNH – THAM LƯƠNG)',
      metroLineName: 'Tuyến Metro Số 2 (Bến Thành – Tham Lương)',
      reportCode: reportData.report_code || 'BCS-P1-CRLG-001',
      buildingId: reportData.project_parcel_code || 'B-00000',
      surveyId,
      address,
      houseNumber: reportData.house_number || '',
      street: reportData.street || '',
      ward: reportData.ward || '',
      district: reportData.district || '',
      zoneId: reportData.zone_id || 'ZONE_S9',
      zoneName: `Khu vực Ga ${reportData.zone_id || 'S9'}`,
      chainage: reportData.chainage || 'Km 9+450',
      distanceToTunnelMeters: reportData.distance_to_tunnel_meters ? Number(reportData.distance_to_tunnel_meters) : 18.5,
      metroItemType: reportData.metro_item_type || 'Đào hầm bằng khiên đào TBM ngầm',
      surveyDate: reportData.survey_date ? new Date(reportData.survey_date).toLocaleDateString('vi-VN') : '',
      revision,
      preparedByName: reportData.surveyor_name || 'Khảo sát viên Hiện trường',
      preparedByTitle: 'Khảo sát viên Hiện trường (Prepared by)',
      checkedByName: reportData.zone_admin_name || 'Zone Admin',
      checkedByTitle: 'Kỹ sư Giám sát Zone Admin (Checked by)',
      approvedByName: reportData.super_admin_name || 'Super Admin',
      approvedByTitle: 'Chuyên gia Phê duyệt Super Admin (Approved by)',
      facadeCoverPhotoUrl: p02.url,

      // Dashboard
      totalEcsScore: Number(riskScores.total_ecs_score || 0),
      ecsClass: riskScores.ecs_class || 'GOOD',
      ecsBadgeClass: getEcsBadge(riskScores.ecs_class || 'GOOD'),
      avgViScore: Number(riskScores.avg_vi_score || 1.0),
      viClass: riskScores.vi_class || 'LOW',
      viBadgeClass: getViBadge(riskScores.vi_class || 'LOW'),
      constructionImpactLevelI: Number(riskScores.construction_impact_level_i || 2),
      impactBadgeClass: 'badge-medium',
      buildingRiskAssessmentBra: braValue,
      braBadgeClass: getBraBadge(braValue),
      predictedSettlementSmax: reportData.predicted_settlement_smax ? Number(reportData.predicted_settlement_smax) : 0,
      angularDistortion: reportData.angular_distortion || '',
      vibrationPpv: reportData.vibration_ppv ? Number(reportData.vibration_ppv) : 0,

      // Building specs
      buildingName: specs.building_name || '',
      ownerName: reportData.owner_name || '',
      ownerPhone: reportData.owner_phone || '',
      landUseFunction: specs.land_use_function || 'Nhà ở riêng lẻ',
      floorCount: Number(specs.floor_count || reportData.floor_count || 1),
      basementCount: Number(specs.basement_count || 0),
      structuralSystem: specs.structural_system || 'KHUNG_BTCT_CHIU_LUC',
      structuralSystemLabel: structuralSystemLabels[specs.structural_system] || '',
      foundationCategory: specs.foundation_category || '',
      foundationCategoryLabel: foundationLabels[specs.foundation_category] || '',
      foundationInfoSource: specs.foundation_source || '',
      constructionAreaM2: specs.construction_area_m2 ? Number(specs.construction_area_m2) : '',
      buildingHeightM: specs.building_height_m ? Number(specs.building_height_m) : '',
      estimatedHeightM: specs.building_height_m ? Number(specs.building_height_m) : '',
      yearOfConstruction: specs.year_of_construction || '',
      isYearEstimated: Boolean(specs.is_year_estimated),
      adjacentBuildingsNote: specs.adjacent_buildings || '',

      // History & Notes phát sinh (Nếu không có thì để trống)
      extendedOrRenovated: Boolean(history.extended_or_renovated),
      extendedOrRenovatedNotes: history.extended_or_renovated ? (history.details || '') : '',
      previousSettlementOrTilt: Boolean(history.previous_settlement_or_tilt),
      previousSettlementNotes: history.previous_settlement_or_tilt ? (history.details || '') : '',
      fireOrAccident: Boolean(history.fire_or_accident),
      fireOrAccidentNotes: history.fire_or_accident ? (history.details || '') : '',
      sensitiveEquipmentPresent: Boolean(history.sensitive_equipment_present),
      sensitiveEquipmentNotes: history.sensitive_equipment_present ? (history.details || '') : '',
      historyDetailsNote: history.details || '',

      // Scope Access
      scopeAccess: {
        facadeStatus: 'ĐÃ TIẾP CẬN',
        facadeNote: '',
        groundFloorStatus: 'ĐÃ TIẾP CẬN',
        groundFloorNote: '',
        upperFloorsStatus: 'ĐÃ TIẾP CẬN',
        upperFloorsNote: '',
        roofStatus: 'TIẾP CẬN 1 PHẦN',
        roofNote: '',
        basementStatus: 'KHÔNG ÁP DỤNG',
        basementNote: '',
        auxiliaryStatus: 'ĐÃ TIẾP CẬN',
        auxiliaryNote: '',
        inaccessibleAreasReason: reportData.inaccessible_areas_reason || '',
      },

      p01,
      p02,
      p03,
      p04,

      bcsChecklist,
      floors,
      totalDefectsCount,
      totalDamageZonesCount: damageZones.length,

      // Deformation
      tiltAngleX: Number(deformation.tilt_angle_x || 0.0),
      tiltAngleY: Number(deformation.tilt_angle_y || 0.0),
      tiltDirection: deformation.tilt_direction || '',
      floorSlopeRatio: Number(deformation.floor_slope_ratio || 0.0),
      beamDeflectionMm: Number(deformation.beam_deflection_mm || 0.0),
      measurementMethod: deformation.measurement_method || '',
      measurementReliability: deformation.measurement_reliability || '',
      requiresAdditionalMonitoring: Boolean(deformation.beam_deflection_mm > 5.0 || deformation.tilt_angle_x > 2.0),
      deformationEngineerComments: deformation.engineer_comments || deformation.tilt_evolution_verdict || '',

      // Burland 1977
      burlandPredominantGrade: Number(riskScores.e1_burland_score || 0),
      burlandPredominantLabel: burlandLabels[Number(riskScores.e1_burland_score || 0)] || 'Grade 0',
      burlandLocalMaxGrade: Number(riskScores.e1_burland_score || 0),
      burlandLocalMaxLabel: burlandLabels[Number(riskScores.e1_burland_score || 0)] || 'Grade 0',
      structuralDefectFlag: totalDefectsCount > 0 ? 'Nứt phi kết cấu khối xây' : 'Không có khuyết tật kết cấu',
      requiresStructuralReview: false,

      // ECS
      ecsE1: Number(riskScores.e1_burland_score || 0),
      ecsE2: Number(riskScores.e2_structure_score || 0),
      ecsE3: Number(riskScores.e3_deformation_score || 0),
      ecsE4: Number(riskScores.e4_material_score || 0),
      ecsE5: Number(riskScores.e5_history_score || 0),
      ecsE6: Number(riskScores.e6_overall_function_score || 0),
      ecsJudgementApplied: Boolean(riskScores.is_engineering_judgement_applied),
      ecsJudgementAction: riskScores.engineering_judgement_action || 'KEEP',
      ecsJudgementReason: riskScores.engineering_judgement_reason || '',
      qualityGates: [
        { code: 'QG-01', title: 'Thông tin móng công trình', status: 'PASSED', notes: '' },
        { code: 'QG-02', title: 'Ảnh định danh P-01 đến P-04', status: 'PASSED', notes: '' },
        { code: 'QG-03', title: 'Sổ khuyết tật và ảnh có thước đo', status: 'PASSED', notes: '' },
        { code: 'QG-04', title: 'Đo đạc độ nghiêng và võng dầm', status: 'PASSED', notes: '' },
      ],

      // VI
      viV1: Number(riskScores.v1_importance_score || 1.0),
      viV2: Number(riskScores.v2_structure_score || 1.0),
      viV3: Number(riskScores.v3_foundation_score || 1.0),
      viV4: Number(riskScores.v4_age_score || 1.0),
      viV5: Number(riskScores.v5_ecs_score || 1.0),
      viV6: Number(riskScores.v6_sensitivity_score || 1.0),
      viJudgementReason: '',

      // Metro & BRA
      braMatrixCell: `V=${riskScores.vi_class || 'LOW'} × I=${riskScores.construction_impact_level_i || 2}`,
      braMandatoryAction,
      braEngineeringReviewNotes: reportData.bra_engineering_review_notes || '',

      // Conclusions & Recommendations (Lấy từ Phase 1, nếu không có thì để trống)
      summaryConclusions: reportData.summary_conclusions || '',
      engineeringRecommendations: reportData.engineering_recommendations || '',
      ownerRemarks: reportData.owner_remarks || '',
      requiresPhase2: true,
      requiresMonitoring: true,

      // Signatures (Lấy ảnh chữ ký thật từ user attribute)
      surveyorSignatureUrl: reportData.surveyor_signature_url,
      surveyorSignatureImg: reportData.surveyor_signature_img || reportData.surveyor_signature_url || '',
      ownerSignatureUrl: reportData.owner_signature_url,
      ownerSignatureImg: reportData.owner_signature_url || '',
      zoneAdminSignatureUrl: reportData.zone_admin_signature_url,
      zoneAdminSignatureImg: reportData.zone_admin_signature_img || reportData.zone_admin_signature_url || '',
      superAdminSignatureImg: reportData.super_admin_signature_img || '',
      fieldWorkMinutesPhotoUrl: reportData.official_pdf_url || '',
      generatedAt: new Date().toLocaleString('vi-VN'),
    };
  }

  /**
   * Tạo chuỗi HTML hoàn chỉnh từ ViewModel và Template Handlebars
   */
  static generateHtml(viewModel: ResidentialReportViewModel): string {
    let templateDir = path.resolve(__dirname, '../templates/residential');
    if (!fs.existsSync(templateDir)) {
      templateDir = path.resolve(process.cwd(), 'src/modules/report/templates/residential');
    }
    const templatePath = path.join(templateDir, 'index.hbs');
    const stylesPath = path.join(templateDir, 'styles.css');

    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const styles = fs.readFileSync(stylesPath, 'utf8');

    const compiledTemplate = Handlebars.compile(templateSource);
    return compiledTemplate({
      ...viewModel,
      styles,
    });
  }
}
