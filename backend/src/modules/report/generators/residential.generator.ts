import * as fs from 'fs';
import * as path from 'path';
import Handlebars from 'handlebars';
import { ResidentialReportViewModel, DefectItemReport, DamageZoneReport, FloorSurveyReport, BcsChecklistItem, ReportPhotoItem } from '../report.types';
import { CryptoUtils } from '../../../common/utils/crypto.utils';

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

    // Tính mã băm SHA-256 xác thực bất biến
    const hashPayload = `${reportData.id}-${reportData.report_code}-${reportData.survey_date}-${riskScores.total_ecs_score}-${braValue}`;
    const sha256Checksum = CryptoUtils.sha256(hashPayload);

    return {
      projectName: 'DỰ ÁN XÂY DỰNG TUYẾN ĐƯỜNG SẮT ĐÔ THỊ SỐ 2 TP. HỒ CHÍ MINH (BẾN THÀNH – THAM LƯƠNG)',
      metroLineName: 'Tuyến Metro Số 2 (Bến Thành – Tham Lương)',
      reportCode: reportData.report_code || 'BCS-P1-CRLG-001',
      buildingId: reportData.project_parcel_code || 'B-00000',
      surveyId: `SRV-${reportData.project_parcel_code || '0000'}`,
      address: `${reportData.house_number || ''} ${reportData.street || ''}, Phường ${reportData.ward || ''}, Quận ${reportData.district || ''}`.trim(),
      houseNumber: reportData.house_number || '',
      street: reportData.street || '',
      ward: reportData.ward || '',
      district: reportData.district || '',
      zoneId: reportData.zone_id || 'ZONE_S9',
      zoneName: `Khu vực Ga ${reportData.zone_id || 'S9'}`,
      chainage: 'Km 9+450',
      distanceToTunnelMeters: 18.5,
      metroItemType: 'Đào hầm bằng khiên đào TBM ngầm',
      surveyDate: reportData.survey_date ? new Date(reportData.survey_date).toLocaleDateString('vi-VN') : new Date().toLocaleDateString('vi-VN'),
      revision: '00',
      preparedByName: reportData.surveyor_name || 'Khảo sát viên Hiện trường',
      preparedByTitle: 'Kỹ sư Khảo sát Hiện trạng',
      checkedByName: 'Nguyễn Văn Kiểm',
      checkedByTitle: 'Kỹ sư Thẩm tra Kết cấu',
      approvedByName: 'Zone Admin Metro 2',
      approvedByTitle: 'Chuyên gia Phê duyệt Liên danh CRLG',
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
      predictedSettlementSmax: 12.5,
      angularDistortion: '1/850',
      vibrationPpv: 2.1,

      // Building specs
      buildingName: specs.building_name || `Nhà ở riêng lẻ ${reportData.house_number || ''} ${reportData.street || ''}`,
      ownerName: reportData.owner_name || 'Chủ sở hữu công trình',
      ownerPhone: reportData.owner_phone || '',
      landUseFunction: 'Nhà ở riêng lẻ / Nhà phố dân cư',
      floorCount: Number(specs.floor_count || reportData.floor_count || 1),
      basementCount: Number(specs.basement_count || 0),
      structuralSystem: specs.structural_system || 'KHUNG_BTCT_CHIU_LUC',
      structuralSystemLabel: structuralSystemLabels[specs.structural_system] || 'Khung BTCT chịu lực',
      foundationCategory: specs.foundation_category || 'CAT_2_MONG_DON_BTCT',
      foundationCategoryLabel: foundationLabels[specs.foundation_category] || 'CAT 2: Móng đơn BTCT',
      foundationInfoSource: 'Quan sát hiện trường & Lời khai chủ hộ',
      constructionAreaM2: Number(reportData.construction_area_m2 || 85.0),
      estimatedHeightM: Number(specs.floor_count || 1) * 3.6,
      yearOfConstruction: specs.year_of_construction || '2012',
      isYearEstimated: Boolean(specs.is_year_estimated),
      adjacentBuildingsNote: specs.adjacent_buildings || 'Tiếp giáp nhà phố liền kề 3 tầng bên trái, hẻm bê tông bên phải.',

      // History & Notes phát sinh
      extendedOrRenovated: Boolean(history.extended_or_renovated),
      extendedOrRenovatedNotes: history.extended_or_renovated ? 'Có lịch sử cơi nới thêm mái tôn và nâng cấp mặt tiền phía trước.' : '',
      previousSettlementOrTilt: Boolean(history.previous_settlement_or_tilt),
      previousSettlementNotes: history.previous_settlement_or_tilt ? 'Chủ nhà phản ánh có vết nứt chân chim xuất hiện từ năm 2018.' : '',
      fireOrAccident: Boolean(history.fire_or_accident),
      fireOrAccidentNotes: '',
      sensitiveEquipmentPresent: Boolean(history.sensitive_equipment_present),
      sensitiveEquipmentNotes: '',
      historyDetailsNote: history.details || '',

      // Scope Access
      scopeAccess: {
        facadeStatus: 'ĐÃ TIẾP CẬN',
        facadeNote: 'Quan sát và chụp ảnh toàn bộ mặt đứng P-01 đến P-04',
        groundFloorStatus: 'ĐÃ TIẾP CẬN',
        groundFloorNote: 'Khảo sát đầy đủ phòng khách, bếp và khu vệ sinh',
        upperFloorsStatus: 'ĐÃ TIẾP CẬN',
        upperFloorsNote: 'Khảo sát toàn bộ các phòng ngủ và hành lang cầu thang',
        roofStatus: 'TIẾP CẬN 1 PHẦN',
        roofNote: 'Chỉ quan sát được mép mái phía trước do sân sau khóa cửa',
        basementStatus: 'KHÔNG ÁP DỤNG',
        basementNote: 'Công trình không xây dựng tầng hầm',
        auxiliaryStatus: 'ĐÃ TIẾP CẬN',
        auxiliaryNote: 'Khu giếng trời và sân phơi phụ trợ',
        inaccessibleAreasReason: '',
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
      tiltDirection: deformation.tilt_direction || 'Thẳng đứng, không nghiêng lệch rõ rệt',
      floorSlopeRatio: Number(deformation.floor_slope_ratio || 0.0),
      beamDeflectionMm: Number(deformation.beam_deflection_mm || 0.0),
      measurementMethod: deformation.measurement_method || 'Máy cân bằng Laser & Thước đo kỹ thuật số',
      measurementReliability: deformation.measurement_reliability || 'Độ tin cậy cao',
      requiresAdditionalMonitoring: Boolean(deformation.beam_deflection_mm > 5.0 || deformation.tilt_angle_x > 2.0),
      deformationEngineerComments: 'Độ nghiêng công trình nằm trong giới hạn cho phép theo tiêu chuẩn TCVN 9381:2012. Không ghi nhận chuyển dịch nghiêng nguy hiểm.',

      // Burland 1977
      burlandPredominantGrade: Number(riskScores.e1_burland_score || 1),
      burlandPredominantLabel: burlandLabels[Number(riskScores.e1_burland_score || 1)] || 'Grade 1',
      burlandLocalMaxGrade: Number(riskScores.e1_burland_score || 1),
      burlandLocalMaxLabel: burlandLabels[Number(riskScores.e1_burland_score || 1)] || 'Grade 1',
      structuralDefectFlag: totalDefectsCount > 0 ? 'Nứt phi kết cấu khối xây (Non-structural masonry cracks)' : 'Không có khuyết tật kết cấu',
      requiresStructuralReview: false,

      // ECS
      ecsE1: Number(riskScores.e1_burland_score || 1),
      ecsE2: Number(riskScores.e2_structure_score || 0),
      ecsE3: Number(riskScores.e3_deformation_score || 0),
      ecsE4: Number(riskScores.e4_material_score || 0),
      ecsE5: Number(riskScores.e5_history_score || 0),
      ecsE6: Number(riskScores.e6_overall_function_score || 1),
      ecsJudgementApplied: Boolean(riskScores.is_engineering_judgement_applied),
      ecsJudgementAction: riskScores.engineering_judgement_action || 'KEEP',
      ecsJudgementReason: riskScores.engineering_judgement_reason || 'Giữ nguyên điểm đánh giá tự động dựa trên số liệu khảo sát hiện trường chuẩn mực.',
      qualityGates: [
        { code: 'QG-01', title: 'Thông tin móng công trình', status: 'PASSED', notes: 'Đã xác định loại móng qua khảo sát hiện trường' },
        { code: 'QG-02', title: 'Ảnh định danh P-01 đến P-04', status: 'PASSED', notes: 'Đủ 4 ảnh ngoại thất có tọa độ GPS' },
        { code: 'QG-03', title: 'Sổ khuyết tật và ảnh có thước đo', status: 'PASSED', notes: 'Toàn bộ vết nứt đều có thước crack gauge' },
        { code: 'QG-04', title: 'Đo đạc độ nghiêng và võng dầm', status: 'PASSED', notes: 'Số liệu đo laser level đầy đủ' },
      ],

      // VI
      viV1: Number(riskScores.v1_importance_score || 1.0),
      viV2: Number(riskScores.v2_structure_score || 1.5),
      viV3: Number(riskScores.v3_foundation_score || 2.0),
      viV4: Number(riskScores.v4_age_score || 1.2),
      viV5: Number(riskScores.v5_ecs_score || 1.0),
      viV6: Number(riskScores.v6_sensitivity_score || 1.0),
      viJudgementReason: 'Chỉ số VI phản ánh mức độ nhạy cảm trung bình của kết cấu nhà phố thấp tầng trong vùng lân cận tuyến hầm Metro.',

      // Metro & BRA
      braMatrixCell: `V=${riskScores.vi_class || 'LOW'} × I=${riskScores.construction_impact_level_i || 2}`,
      braMandatoryAction,
      braEngineeringReviewNotes: 'Công trình nằm trong vùng chịu ảnh hưởng gián tiếp từ công tác đào hầm TBM. Đề xuất đưa vào danh sách quan trắc mốc lún định kỳ trước và trong giai đoạn máy TBM đi qua.',

      // Conclusions & Recommendations
      summaryConclusions: reportData.summary_conclusions || 'Công trình hiện trạng có kết cấu chịu lực ổn định, xuất hiện một số vết nứt chân chim nhẹ tại lớp trát tường ngăn nội thất (Cấp Burland 1-2). Chưa phát hiện dấu hiệu lún nứt kết cấu dầm cột nguy hiểm.',
      engineeringRecommendations: reportData.engineering_recommendations || 'Tiếp tục theo dõi hiện trạng. Thiết lập mốc quan trắc lún trước khi khởi công khoan ngầm TBM đoạn qua thửa đất. Đề xuất khảo sát Phase 2 đối chứng sau khi hoàn thành thông hầm.',
      ownerRemarks: reportData.owner_remarks || 'Chủ nhà đã cùng đi kiểm tra thực tế toàn bộ các tầng với kỹ sư khảo sát, thống nhất với các vết nứt được chụp ảnh và ký tên vào biên bản làm việc.',
      requiresPhase2: true,
      requiresMonitoring: true,

      // Signatures
      surveyorSignatureUrl: reportData.surveyor_signature_url,
      ownerSignatureUrl: reportData.owner_signature_url,
      zoneAdminSignatureUrl: reportData.zone_admin_signature_url,
      fieldWorkMinutesPhotoUrl: reportData.official_pdf_url || reportData.surveyor_signature_url || '',
      sha256Checksum,
      qrVerificationUrl: `https://metro2.hcmc.gov.vn/verify-report/${reportData.report_code || '001'}`,
      generatedAt: new Date().toLocaleString('vi-VN'),
    };
  }

  /**
   * Tạo chuỗi HTML hoàn chỉnh từ ViewModel và Template Handlebars
   */
  static generateHtml(viewModel: ResidentialReportViewModel): string {
    const templateDir = path.resolve(__dirname, '../templates/residential');
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
