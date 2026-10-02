import {
  ResidentialReportViewModel,
  BcsChecklistItem,
  ReportPhotoItem,
  AdjacentBuildingSide,
  GisMutationReport,
  HistoryInterviewItemReport,
} from '../../report.types';
import {
  structuralSystemLabels,
  foundationLabels,
  burlandLabels,
  objectGroupLabels,
  surveyCaseLabels,
  structuralFlagLabels,
  RENOVATION_LABELS,
  MAJOR_REPAIR_LABELS,
  PAST_SETTLEMENT_LABELS,
  NEIGHBOR_DAMAGE_LABELS,
  FIRE_FLOOD_LABELS,
  getEcsBadge,
  getViBadge,
  getBraBadge,
} from './residential.constants';
import { buildFloorSurveys } from './residential.floor-builder';

/**
 * Xây dựng toàn bộ ResidentialReportViewModel từ dữ liệu báo cáo thô của CSDL
 */
export function buildResidentialViewModel(reportData: any): ResidentialReportViewModel {
  const json = reportData.survey_data_json || {};
  const specs = reportData.buildingSpecs || {};
  const history = reportData.historicalSensitivity || {};
  const deformation = reportData.deformation || {};
  const riskScores = reportData.riskScores || {};
  const identPhotos = reportData.identificationPhotos || [];

  // Tọa độ GPS mặc định
  const defaultLat = json.gpsCoords?.lat ? Number(json.gpsCoords.lat) : 10.776889;
  const defaultLng = json.gpsCoords?.lng ? Number(json.gpsCoords.lng) : 106.690833;

  // Tách bộ 4 ảnh định danh P01-P04: Ưu tiên survey_data_json trước, fallback identificationPhotos
  const getPhotoFromSurveyJson = (jsonObj: any, photoType: string): ReportPhotoItem | null => {
    if (!jsonObj) return null;
    const url = typeof jsonObj === 'string' ? jsonObj : jsonObj.url;
    if (!url) return null;
    return {
      photoId: photoType.substring(0, 8),
      photoType: photoType as any,
      url,
      isNotApplicable: Boolean(jsonObj.notApplicable),
      naReason: jsonObj.naReason || '',
      capturedAt: reportData.survey_date || new Date().toLocaleDateString('vi-VN'),
      gpsLat: defaultLat,
      gpsLng: defaultLng,
      tag: jsonObj.tag || '',
    };
  };

  const findPhotoInRelational = (type: string): ReportPhotoItem => {
    const p = identPhotos.find((item: any) => item.photo_type === type);
    if (!p) {
      return {
        photoId: 'N/A',
        photoType: type as any,
        url: '',
        isNotApplicable: false,
        capturedAt: reportData.survey_date,
        gpsLat: defaultLat,
        gpsLng: defaultLng,
      };
    }
    return {
      photoId: p.id ? p.id.substring(0, 8).toUpperCase() : 'PHOTO-ID',
      photoType: p.photo_type,
      url: p.raw_photo_url || p.annotated_photo_url || '',
      isNotApplicable: p.is_not_applicable || false,
      naReason: p.na_reason || '',
      capturedAt: p.watermark_timestamp ? new Date(p.watermark_timestamp).toLocaleString('vi-VN') : reportData.survey_date,
      gpsLat: p.watermark_lat ? Number(p.watermark_lat) : defaultLat,
      gpsLng: p.watermark_lng ? Number(p.watermark_lng) : defaultLng,
    };
  };

  const p01 = getPhotoFromSurveyJson(json.photoP01, 'P01_HOUSE_NUMBER') || findPhotoInRelational('P01_HOUSE_NUMBER');
  const p02 = getPhotoFromSurveyJson(json.photoP02, 'P02_MAIN_FACADE') || findPhotoInRelational('P02_MAIN_FACADE');
  const p03 = getPhotoFromSurveyJson(json.photoP03, 'P03_SIDE_OR_REAR') || findPhotoInRelational('P03_SIDE_OR_REAR');
  if (json.photoP03?.tag && !p03.tag) p03.tag = json.photoP03.tag;
  const p04 = getPhotoFromSurveyJson(json.photoP04, 'P04_CONTEXT_STREET') || findPhotoInRelational('P04_CONTEXT_STREET');

  // Gom khuyết tật, vùng và cấu kiện theo Tầng thông qua floor-builder
  const {
    floors,
    totalDefectsCount,
    totalDamageZonesCount,
    totalStructuralElementsCount,
  } = buildFloorSurveys(json, reportData);

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
  const braValue = json.bra?.buildingRiskBra || riskScores.building_risk_assessment_bra || json.executiveSummary?.braStatus || 'LOW_RISK';
  let braMandatoryAction = json.bra?.braMandatoryAction || 'Lưu hồ sơ baseline; quan trắc theo kế hoạch giám sát định kỳ chung của dự án.';
  if (!json.bra?.braMandatoryAction) {
    if (braValue?.toUpperCase().includes('MEDIUM')) {
      braMandatoryAction = 'BCS đầy đủ; xác nhận lại thông tin móng; thiết lập mốc đo lún và quan trắc biến dạng định kỳ.';
    } else if (braValue?.toUpperCase().includes('VERY_HIGH')) {
      braMandatoryAction = 'Đánh giá chuyên sâu bởi Structural Engineer; thiết kế biện pháp gia cường móng/chống đỡ trước khi TBM đi qua.';
    } else if (braValue?.toUpperCase().includes('HIGH')) {
      braMandatoryAction = 'Khảo sát chi tiết kết cấu và móng; lắp đặt thiết bị quan trắc tự động tăng cường; kiểm tra ngưỡng biến dạng.';
    }
  }

  // Survey ID
  const surveyorPhone = reportData.surveyor_phone || '';
  const cleanPhone = surveyorPhone.replace(/\D/g, '');
  const surveyId = cleanPhone.length >= 4 ? `P-${cleanPhone.slice(-4)}` : (reportData.surveyor_code || 'P-0000');

  // Địa chỉ thực tế
  const formatWard = (w?: string) => {
    if (!w) return '';
    return w.toLowerCase().startsWith('phường') || w.toLowerCase().startsWith('xã') ? w : `Phường ${w}`;
  };
  const formatDistrict = (d?: string) => {
    if (!d) return '';
    return d.toLowerCase().startsWith('quận') || d.toLowerCase().startsWith('huyện') || d.toLowerCase().startsWith('thành phố') || d.toLowerCase().startsWith('tp') ? d : `Quận ${d}`;
  };
  const addressParts = [
    json.houseNumber || reportData.house_number,
    json.street || reportData.street,
    formatWard(reportData.ward),
    formatDistrict(reportData.district),
  ].filter(Boolean);
  const address = addressParts.length > 0 ? addressParts.join(', ') : (reportData.address || '');

  // Revision
  const revision = reportData.export_revision !== undefined && reportData.export_revision !== null
    ? String(reportData.export_revision).padStart(2, '0')
    : '00';

  // Xử lý công trình liền kề (Adjacent buildings)
  const adjacentBuildingsList: AdjacentBuildingSide[] = [];
  if (json.adjacentBuildings) {
    if (json.adjacentBuildings.left) {
      adjacentBuildingsList.push({
        side: 'left',
        sideLabel: 'Bên trái (Left)',
        details: json.adjacentBuildings.left.details || 'Khác',
        note: json.adjacentBuildings.left.note || '',
      });
    }
    if (json.adjacentBuildings.right) {
      adjacentBuildingsList.push({
        side: 'right',
        sideLabel: 'Bên phải (Right)',
        details: json.adjacentBuildings.right.details || 'Khác',
        note: json.adjacentBuildings.right.note || '',
      });
    }
    if (json.adjacentBuildings.back) {
      adjacentBuildingsList.push({
        side: 'back',
        sideLabel: 'Phía sau (Rear)',
        details: json.adjacentBuildings.back.details || 'Khác',
        note: json.adjacentBuildings.back.note || '',
      });
    }
  }

  // Xử lý biến động ranh đất GIS (GIS Mutation)
  const rawMutation = json.gisMutationConfirmed || json.gisMutation || {};
  const isSplit = rawMutation.type === 'SPLIT';
  const isMerge = rawMutation.type === 'MERGE';
  const isRedraw = rawMutation.type === 'REDRAW';
  const isResidualNonBuilding = rawMutation.details?.residualKind === 'NON_BUILDING';

  let typeLabel = 'Điều chỉnh ranh';
  if (isMerge) {
    typeLabel = 'Hợp thửa ranh đất (Gộp thửa)';
  } else if (isSplit) {
    if (isResidualNonBuilding) {
      typeLabel = 'Khoanh ranh nhà (Đất trống/sân giữ nguyên ranh)';
    } else {
      typeLabel = 'Tách thửa ranh đất (Phát sinh nhà mới)';
    }
  } else if (isRedraw) {
    typeLabel = 'Khoanh ranh nhà (Điều chỉnh hình học công trình)';
  }

  const gisMutation: GisMutationReport = {
    isMutated: Boolean(rawMutation.type && rawMutation.type !== 'NONE'),
    type: rawMutation.type || '',
    typeLabel: Boolean(rawMutation.type && rawMutation.type !== 'NONE') ? typeLabel : 'Không biến động',
    splitReason: rawMutation.details?.splitReason || rawMutation.notes || '',
    splitChildren: (rawMutation.details?.splitChildren || []).map((c: any) => ({
      label: c.label || '',
      areaM2: Number(c.areaM2 || 0),
      ownerName: c.ownerName || '',
      houseNumber: c.houseNumber || '',
      suggestedCode: c.suggestedCode || '',
      functionalType: c.functionalType || '',
    })),
  };

  // Xử lý phỏng vấn lịch sử công trình (History Interview)
  const rawHistoryInterview = json.historyInterview || {};
  const renoScore = Number(rawHistoryInterview.renovationLoad ?? (history.extended_or_renovated ? 1 : 0));
  const repairScore = Number(rawHistoryInterview.majorRepair ?? 0);
  const settScore = Number(rawHistoryInterview.pastSettlement ?? (history.previous_settlement_or_tilt ? 1 : 0));
  const neighScore = Number(rawHistoryInterview.neighborDamage ?? 0);
  const fireScore = Number(rawHistoryInterview.fireFloodIncident ?? (history.fire_or_accident ? 1 : 0));
  const hasSens = Boolean(rawHistoryInterview.sensitiveEquipment?.has || rawHistoryInterview.continuousOperation247 || history.sensitive_equipment_present);

  const historyInterviewItems: HistoryInterviewItemReport[] = [
    {
      category: 'Cơi nới / Tăng tải',
      indicator: 'Nâng tầng, thay đổi tải trọng, cơi nới quy mô xây dựng',
      hasItem: renoScore > 0,
      notes: renoScore > 0 ? (RENOVATION_LABELS[renoScore] || 'Có') : 'Không',
    },
    {
      category: 'Sửa chữa lớn',
      indicator: 'Gia cố kết cấu, đập thông tường, cải tạo lớn trong quá khứ',
      hasItem: repairScore > 0,
      notes: repairScore > 0 ? (MAJOR_REPAIR_LABELS[repairScore] || 'Có') : 'Không',
    },
    {
      category: 'Lún / Nghiêng cũ',
      indicator: 'Lịch sử lún chênh lệch, nghiêng tường, nứt kết cấu cũ',
      hasItem: settScore > 0,
      notes: settScore > 0 ? (PAST_SETTLEMENT_LABELS[settScore] || 'Có') : 'Không',
    },
    {
      category: 'Ảnh hưởng lân cận',
      indicator: 'Hư hỏng do các công trình xây dựng liền kề gây ra',
      hasItem: neighScore > 0,
      notes: neighScore > 0 ? (NEIGHBOR_DAMAGE_LABELS[neighScore] || 'Có') : 'Không',
    },
    {
      category: 'Sự cố hỏa hoạn / ngập',
      indicator: 'Hỏa hoạn, ngập lụt kéo dài, va chạm xe cơ giới',
      hasItem: fireScore > 0,
      notes: fireScore > 0 ? (FIRE_FLOOD_LABELS[fireScore] || 'Có') : 'Không',
    },
    {
      category: 'Thiết bị nhạy cảm',
      indicator: 'Thiết bị chính xác cao, hoạt động rung động liên tục 24/7',
      hasItem: hasSens,
      notes: hasSens ? (rawHistoryInterview.sensitiveEquipment?.description || 'Có ghi nhận thiết bị nhạy cảm') : 'Không',
    },
  ];

  // Xử lý ảnh biên bản làm việc hiện trường (Phụ lục F)
  let workingMinutesPhotos: string[] = [];
  if (json.signatures?.workingMinutesPhotos && Array.isArray(json.signatures.workingMinutesPhotos)) {
    workingMinutesPhotos = json.signatures.workingMinutesPhotos.filter(Boolean);
  }
  if (workingMinutesPhotos.length === 0 && reportData.official_pdf_url) {
    workingMinutesPhotos = [reportData.official_pdf_url];
  }

  // Chi tiết móng
  const foundationDepthM = json.foundationDepthM !== undefined && json.foundationDepthM !== null && json.foundationDepthM !== ''
    ? json.foundationDepthM
    : (specs.foundation_depth_m || '--');
  const pileDimensionMm = json.pileDimensionMm || (json.pileWidthMm && json.pileLengthMm ? `${json.pileWidthMm} x ${json.pileLengthMm} cm` : '');

  // Đánh giá Burland
  const rawBurland = json.burlandSummary || {};
  const burlandPredominantGrade = rawBurland.predominantGrade !== undefined
    ? Number(rawBurland.predominantGrade)
    : Number(riskScores.e1_burland_score || 0);
  const burlandLocalMaxGrade = rawBurland.localMaxGrade !== undefined
    ? Number(rawBurland.localMaxGrade)
    : Number(riskScores.e1_burland_score || 0);

  const currentCase = json.surveyCaseType || (json.isAbsenteeSurvey ? 'ABSENTEE' : (json.isVacantLand ? 'VACANT_LAND' : 'NORMAL'));
  const currentObjectGroup = json.objectGroup || 'GENERAL';
  const rawBurlandStructFlag = rawBurland.structuralFlagLevel || 'NONE';

  // Dashboard & Effective Scores (Ưu tiên Lớp Can Thiệp Kỹ Sư nếu có)
  const isJudgementActive = Boolean(
    riskScores.is_engineering_judgement_applied ||
    (json.ecs?.engineeringJudgement?.action && json.ecs.engineeringJudgement.action !== 'KEEP')
  );

  const effectiveTotalEcs = (isJudgementActive && riskScores.overridden_total_ecs !== null && riskScores.overridden_total_ecs !== undefined)
    ? Number(riskScores.overridden_total_ecs)
    : (json.ecs?.totalEcs !== undefined ? Number(json.ecs.totalEcs) : Number(riskScores.total_ecs_score || 0));

  const effectiveEcsClass = (isJudgementActive && riskScores.overridden_ecs_class)
    ? riskScores.overridden_ecs_class
    : (json.ecs?.ecsClass || riskScores.ecs_class || 'GOOD');

  const effectiveAvgVi = (isJudgementActive && riskScores.overridden_avg_vi !== null && riskScores.overridden_avg_vi !== undefined)
    ? Number(riskScores.overridden_avg_vi)
    : (json.vi?.viAvg !== undefined ? Number(json.vi.viAvg) : Number(riskScores.avg_vi_score || 1.0));

  const effectiveViClass = (isJudgementActive && riskScores.overridden_vi_class)
    ? riskScores.overridden_vi_class
    : (json.vi?.viClass || riskScores.vi_class || 'LOW');

  // Trích xuất khoảng cách mép ga (ưu tiên) và khoảng cách tim hầm (dự phòng)
  const rawClearance = json.clearanceOffsetDistance || reportData.clearance_offset_distance_m || '';
  const parsedEdgeDist = (() => {
    if (!rawClearance) return null;
    const cleaned = String(rawClearance).replace(/[^\d.]/g, '');
    if (!cleaned) return null;
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  })();

  const hasStationEdge = parsedEdgeDist !== null;
  const stationNote = hasStationEdge ? '' : 'Không có công trình ga trong zone';

  const rawTunnelDist = json.metroOffsetDistance || reportData.distance_to_tunnel_meters || '';
  const parsedTunnelDist = (() => {
    if (!rawTunnelDist) return 15.0;
    const cleaned = String(rawTunnelDist).replace(/[^\d.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 15.0 : num;
  })();

  const effectiveImpactI = (isJudgementActive && riskScores.overridden_impact_level_i !== null && riskScores.overridden_impact_level_i !== undefined)
    ? Number(riskScores.overridden_impact_level_i)
    : (json.bra?.constructionImpactLevel !== undefined
        ? Number(json.bra.constructionImpactLevel)
        : (json.executiveSummary?.constructionImpactStatus
            ? parseInt(json.executiveSummary.constructionImpactStatus.replace(/\D/g, '') || '2')
            : (() => {
                // Tự động phân cấp theo cự ly mép ga (hoặc fallback tim hầm)
                const d = hasStationEdge ? parsedEdgeDist : parsedTunnelDist;
                const isSpecial = json.objectGroup === 'CRITICAL' || json.objectGroup === 'IMPORTANT';
                if (isSpecial) {
                  return d >= 30 ? 1 : d >= 20 ? 2 : d >= 10 ? 3 : 4;
                }
                return d >= 20 ? 1 : d >= 10 ? 2 : d >= 5 ? 3 : 4;
              })()
          ));

  const effectiveBra = (isJudgementActive && riskScores.overridden_bra)
    ? riskScores.overridden_bra
    : braValue;

  return {
    projectName: 'DỰ ÁN XÂY DỰNG TUYẾN ĐƯỜNG SẮT ĐÔ THỊ SỐ 2 TP. HỒ CHÍ MINH (BẾN THÀNH – THAM LƯƠNG)',
    metroLineName: 'Tuyến Metro Số 2 (Bến Thành – Tham Lương)',
    reportCode: reportData.report_code || 'BCS-P1-CRLG-001',
    buildingId: reportData.project_parcel_code || json.projectParcelCode || 'B-00000',
    officialCadastralCode: json.officialCadastralCode || reportData.official_cadastral_code || '',
    surveyId,
    address,
    houseNumber: json.houseNumber || reportData.house_number || '',
    street: json.street || reportData.street || '',
    ward: reportData.ward || '',
    district: reportData.district || '',
    zoneId: reportData.zone_id || 'ZONE_01',
    zoneName: `Khu vực Ga ${reportData.zone_id || 'ZONE_01'}`,
    chainage: json.chainage || reportData.chainage || 'Km 0+000',
    distanceToTunnelMeters: parsedTunnelDist,
    clearanceOffsetDistanceM: parsedEdgeDist !== null ? `${parsedEdgeDist.toFixed(1)}` : '',
    hasStationEdge,
    stationNote,
    metroItemType: reportData.metro_item_type || 'Đào hầm bằng khiên đào TBM ngầm',
    isTbm: (() => {
      const t = (reportData.metro_item_type || json.metroItemType || 'TBM').toLowerCase();
      return t.includes('tbm') || t.includes('khiên') || (!t.includes('ga') && !t.includes('cut'));
    })(),
    isStation: (() => {
      const t = (reportData.metro_item_type || json.metroItemType || '').toLowerCase();
      return t.includes('ga') || t.includes('station');
    })(),
    isCutAndCover: (() => {
      const t = (reportData.metro_item_type || json.metroItemType || '').toLowerCase();
      return t.includes('cut') || t.includes('đào hở') || t.includes('c&c');
    })(),
    isOtherMetro: (() => {
      const t = (reportData.metro_item_type || json.metroItemType || '').toLowerCase();
      return !t.includes('tbm') && !t.includes('khiên') && !t.includes('ga') && !t.includes('station') && !t.includes('cut') && !t.includes('đào hở') && !t.includes('c&c') && t.length > 0;
    })(),
    surveyDate: json.surveyDate ? new Date(json.surveyDate).toLocaleDateString('vi-VN') : (reportData.survey_date ? new Date(reportData.survey_date).toLocaleDateString('vi-VN') : new Date().toLocaleDateString('vi-VN')),
    revision,
    preparedByName: json.surveyorName || reportData.surveyor_name || json.signatures?.preparedBy?.fullName || 'Khảo sát viên Hiện trường',
    preparedByTitle: 'Khảo sát viên Hiện trường (Prepared by)',
    checkedByName: json.zoneAdminName || reportData.zone_admin_name || json.signatures?.checkedBy?.fullName || 'Zone Admin',
    checkedByTitle: 'Kỹ sư Giám sát Zone Admin (Checked by)',
    approvedByName: reportData.super_admin_name || 'Super Admin',
    approvedByTitle: 'Chuyên gia Phê duyệt Super Admin (Approved by)',
    facadeCoverPhotoUrl: p02.url,

    totalEcsScore: effectiveTotalEcs,
    ecsClass: effectiveEcsClass,
    ecsBadgeClass: getEcsBadge(effectiveEcsClass),
    avgViScore: effectiveAvgVi,
    viClass: effectiveViClass,
    viBadgeClass: getViBadge(effectiveViClass),
    constructionImpactLevelI: effectiveImpactI,
    impactBadgeClass: 'badge-medium',
    buildingRiskAssessmentBra: effectiveBra,
    braBadgeClass: getBraBadge(effectiveBra),
    predictedSettlementSmax: json.bra?.predictedSettlementSmax !== undefined ? Number(json.bra.predictedSettlementSmax) : (reportData.predicted_settlement_smax ? Number(reportData.predicted_settlement_smax) : 0),
    angularDistortion: json.bra?.angularDistortion || reportData.angular_distortion || '',
    vibrationPpv: json.bra?.vibrationPpv !== undefined ? Number(json.bra.vibrationPpv) : (reportData.vibration_ppv ? Number(reportData.vibration_ppv) : 0),

    // Building specs
    buildingName: json.buildingName || specs.building_name || '',
    ownerName: json.ownerName || reportData.owner_name || '',
    ownerPhone: json.ownerPhone || reportData.owner_phone || '',
    landUseFunction: json.usageFunction || specs.land_use_function || 'Nhà ở riêng lẻ',
    floorCount: Number(json.aboveFloors || specs.floor_count || reportData.floor_count || 1),
    basementCount: Number(json.undergroundFloors || specs.basement_count || 0),
    structuralSystem: json.structureSystem || specs.structural_system || 'KHUNG_BTCT_CHIU_LUC',
    structuralSystemLabel: structuralSystemLabels[json.structureSystem] || structuralSystemLabels[specs.structural_system] || json.structureSystem || specs.structural_system || 'Khung BTCT chịu lực',
    foundationCategory: json.foundationCatScore ? `CAT ${json.foundationCatScore}` : (specs.foundation_category || ''),
    foundationCategoryLabel: json.foundationType || foundationLabels[specs.foundation_category] || 'Móng nông / Móng đơn BTCT',
    foundationInfoSource: json.foundationSource || specs.foundation_source || 'Quan sát hiện trường',
    foundationDepthM,
    pileDimensionMm,
    foundationDensity: json.foundationDensity || '',
    foundationSpacingM: json.foundationSpacingM || '',
    foundationNotes: json.foundationNotes || '',
    constructionAreaM2: json.constructionAreaM2 || (specs.construction_area_m2 ? Number(specs.construction_area_m2) : ''),
    buildingHeightM: json.buildingHeightM || (specs.building_height_m ? Number(specs.building_height_m) : ''),
    estimatedHeightM: json.buildingHeightM || (specs.building_height_m ? Number(specs.building_height_m) : ''),
    yearOfConstruction: json.constructionYear || specs.year_of_construction || '',
    isYearEstimated: Boolean(json.isEstimatedYear !== undefined ? json.isEstimatedYear : specs.is_year_estimated),
    asBuiltDrawingPhotoUrl: json.asBuiltDrawingPhotoUrl || (Array.isArray(json.asBuiltDrawingPhotos) && json.asBuiltDrawingPhotos[0]?.url) || (Array.isArray(specs.as_built_drawing_photos_json) && specs.as_built_drawing_photos_json[0]?.url) || '',
    asBuiltDrawingPhotos: Array.isArray(json.asBuiltDrawingPhotos) && json.asBuiltDrawingPhotos.length > 0
      ? json.asBuiltDrawingPhotos
      : (Array.isArray(specs.as_built_drawing_photos_json) ? specs.as_built_drawing_photos_json : []),
    asBuiltDrawingFiles: Array.isArray(json.asBuiltDrawingFiles) ? json.asBuiltDrawingFiles : [],
    isAbsenteeSurvey: Boolean(json.isAbsenteeSurvey),
    absenteeReason: json.absenteeReason || '',
    vacantLandStatus: json.vacantLandStatus || '',
    vacantLandNotes: json.vacantLandNotes || '',
    p02WidthM: json.photoP02?.widthM || '',
    p02HeightM: json.photoP02?.heightM || '',
    adjacentBuildingsNote: specs.adjacent_buildings || '',
    adjacentBuildingsList,

    // GIS Mutation
    gisMutation,

    // History & Notes
    extendedOrRenovated: Boolean(rawHistoryInterview.renovationLoad || history.extended_or_renovated),
    extendedOrRenovatedNotes: rawHistoryInterview.renovationLoad ? 'Đã từng cơi nới / nâng tầng' : '',
    previousSettlementOrTilt: Boolean(rawHistoryInterview.pastSettlement || history.previous_settlement_or_tilt),
    previousSettlementNotes: rawHistoryInterview.pastSettlement ? 'Có ghi nhận hiện tượng lún nứt cũ' : '',
    fireOrAccident: Boolean(rawHistoryInterview.fireFloodIncident || history.fire_or_accident),
    fireOrAccidentNotes: rawHistoryInterview.fireFloodIncident ? 'Có sự cố trong quá khứ' : '',
    sensitiveEquipmentPresent: Boolean(rawHistoryInterview.sensitiveEquipment?.has || rawHistoryInterview.continuousOperation247 || history.sensitive_equipment_present),
    sensitiveEquipmentNotes: rawHistoryInterview.sensitiveEquipment?.description || '',
    historyDetailsNote: rawHistoryInterview.usageStatus ? `Tình trạng sử dụng: ${rawHistoryInterview.usageStatus}` : '',
    historyInterviewItems,

    // Step 1: GPS, Object Group & Survey Case
    gpsLat: defaultLat,
    gpsLng: defaultLng,
    objectGroup: currentObjectGroup,
    objectGroupLabel: objectGroupLabels[currentObjectGroup] || currentObjectGroup,
    surveyCaseType: currentCase,
    surveyCaseLabel: surveyCaseLabels[currentCase] || currentCase,
    absenteeMinutesPhotos: (json.absenteeMinutesPhotos || []).filter(Boolean),
    vacantLandPhotos: (json.vacantLandPhotos || []).filter(Boolean),
    underConstructionPhotos: (json.underConstructionPhotos || []).filter(Boolean),
    constructionStageNotes: json.constructionStageNotes || '',
    p03Tag: p03.tag || json.photoP03?.tag || 'Bên hông trái',
    p03AdditionalPhotos: (Array.isArray(json.photoP03?.additionalPhotos) && json.photoP03.additionalPhotos.length > 0)
      ? json.photoP03.additionalPhotos
      : (identPhotos.filter((p: any) => p.photo_type === 'P03_SIDE_OR_REAR').slice(1).map((p: any) => ({
          url: p.raw_photo_url || p.annotated_photo_url,
          tag: p.dimensions_json?.tag || 'Mặt bên bổ sung',
          photoCode: p.photo_code || 'P03-EXTRA',
        }))),

    // Scope & Access Limitations
    surveyScopeItems: (() => {
      const items: { areaName: string; isAccessed: boolean; notes: string }[] = [];
      if (p01.url || p02.url || p04.url) {
        items.push({
          areaName: 'Mặt tiền & Ngoại quan công trình',
          isAccessed: true,
          notes: 'Đã khảo sát và chụp bộ ảnh định danh ngoại quan (P-01 đến P-04)',
        });
      }
      floors.forEach((f) => {
        const zCount = (f.zones || []).length;
        const eCount = (f.structuralElements || []).length;
        items.push({
          areaName: f.floorName,
          isAccessed: true,
          notes: f.notes ? f.notes : `Đã khảo sát ${zCount} vùng Z, ${eCount} cấu kiện E`,
        });
      });

      const accType = json.accessLimitation?.type || 'FULL_100';
      const rawRestrictedAreas = Array.isArray(json.accessLimitation?.restrictedAreas) ? json.accessLimitation.restrictedAreas.filter(Boolean) : [];
      const rawRestrictedFloors = Array.isArray(json.accessLimitation?.restrictedFloorLevels) ? json.accessLimitation.restrictedFloorLevels.filter(Boolean) : [];
      const mainReason = json.accessLimitation?.mainReason || json.absenteeReason || '';
      const aNotes = json.accessLimitation?.notes || '';

      if (accType === 'LIMITED') {
        rawRestrictedAreas.forEach((area: string) => {
          if (area === 'Các tầng lầu trên cao' && rawRestrictedFloors.length > 0) {
            rawRestrictedFloors.forEach((fl: string) => {
              items.push({
                areaName: `Tầng bị hạn chế: ${fl}`,
                isAccessed: false,
                notes: mainReason || aNotes || 'Chưa tiếp cận được',
              });
            });
          } else {
            items.push({
              areaName: area,
              isAccessed: false,
              notes: mainReason || aNotes || 'Chưa tiếp cận được',
            });
          }
        });
      } else if (accType === 'ABSENT_REFUSED' || accType === 'ABSENTEE') {
        items.push({
          areaName: 'Bên trong toàn bộ công trình',
          isAccessed: false,
          notes: mainReason || 'Chủ hộ vắng mặt / Không tiếp cận được hiện trường',
        });
      }
      return items;
    })(),
    surveyedFloorsList: json.surveyScope?.surveyedFloors || (json.floors ? json.floors.map((f: any) => f.floorName) : ['Tầng trệt']),
    accessLimitationType: json.accessLimitation?.type || 'FULL_100',
    accessLimitationLabel: (() => {
      const accType = json.accessLimitation?.type || 'FULL_100';
      if (accType === 'LIMITED') return 'Hạn chế tiếp cận một phần';
      if (accType === 'ABSENT_REFUSED' || accType === 'ABSENTEE') return 'Vắng mặt / Không thể tiếp cận';
      return 'Không có hạn chế (Tiếp cận 100%)';
    })(),
    restrictedAreasList: (json.accessLimitation?.restrictedAreas || []).filter(Boolean),
    restrictedAreasDisplay: (() => {
      const accType = json.accessLimitation?.type || 'FULL_100';
      if (accType === 'LIMITED') {
        const rawRestrictedAreas = Array.isArray(json.accessLimitation?.restrictedAreas) ? json.accessLimitation.restrictedAreas.filter(Boolean) : [];
        const rawRestrictedFloors = Array.isArray(json.accessLimitation?.restrictedFloorLevels) ? json.accessLimitation.restrictedFloorLevels.filter(Boolean) : [];
        const allRestricted = [...rawRestrictedAreas, ...rawRestrictedFloors].filter((v, i, a) => a.indexOf(v) === i && v !== 'Các tầng lầu trên cao');
        return allRestricted.length > 0 ? allRestricted.join(', ') : 'Không';
      }
      if (accType === 'ABSENT_REFUSED' || accType === 'ABSENTEE') return 'Toàn bộ không gian bên trong công trình';
      return 'Không';
    })(),
    accessMainReason: json.accessLimitation?.mainReason || '',
    accessMainReasonDisplay: (() => {
      const accType = json.accessLimitation?.type || 'FULL_100';
      const reason = json.accessLimitation?.mainReason || json.absenteeReason || '';
      return (accType !== 'FULL_100' && reason) ? reason : 'Không';
    })(),
    accessNotes: json.accessLimitation?.notes || '',
    accessNotesDisplay: json.accessLimitation?.notes || 'Không',

    p01,
    p02,
    p03,
    p04,

    bcsChecklist,
    floors,
    totalDefectsCount,
    totalDamageZonesCount,
    totalStructuralElementsCount,

    // Deformation (Step 4)
    tiltAngleX: Number(json.settlementTilt?.buildingTilt?.xPermille || deformation.tilt_angle_x || 0.0),
    tiltAngleY: Number(json.settlementTilt?.buildingTilt?.yPermille || deformation.tilt_angle_y || 0.0),
    tiltDirection: json.settlementTilt?.buildingTilt?.direction || deformation.tilt_direction || 'Chưa phát hiện nghiêng',
    floorSlopeRatio: Number(deformation.floor_slope_ratio || 0.0),
    beamDeflectionMm: Number(json.settlementTilt?.beamSagging?.sagMm || deformation.beam_deflection_mm || 0.0),
    measurementMethod: (json.settlementTilt?.dataSource && json.settlementTilt.dataSource.join(', ')) || deformation.measurement_method || 'Quan sát trực quan',
    measurementReliability: json.settlementTilt?.reliability || deformation.measurement_reliability || 'HIGH',
    requiresAdditionalMonitoring: Boolean(json.settlementTilt?.needAdditionalMonitoring?.required || deformation.beam_deflection_mm > 5.0 || deformation.tilt_angle_x > 2.0),
    deformationEngineerComments: json.settlementTilt?.needAdditionalMonitoring?.notes || deformation.engineer_comments || deformation.tilt_evolution_verdict || '',
    buildingTiltPhotoUrl: json.settlementTilt?.buildingTilt?.photoUrl || '',
    diffSettlementPhotoUrl: json.settlementTilt?.diffSettlement?.photoUrl || '',
    beamSaggingPhotoUrl: json.settlementTilt?.beamSagging?.photoUrl || '',
    diffSettlementPhotos: Array.isArray(json.settlementTilt?.diffSettlement?.photos) && json.settlementTilt.diffSettlement.photos.length > 0
      ? json.settlementTilt.diffSettlement.photos
      : (Array.isArray(deformation.diff_settlement_photos_json) ? deformation.diff_settlement_photos_json : []),
    tiltPhotos: Array.isArray(json.settlementTilt?.buildingTilt?.photos) && json.settlementTilt.buildingTilt.photos.length > 0
      ? json.settlementTilt.buildingTilt.photos
      : (Array.isArray(deformation.tilt_photos_json) ? deformation.tilt_photos_json : []),
    abnormalPhotos: Array.isArray(json.settlementTilt?.abnormalCase?.photos) && json.settlementTilt.abnormalCase.photos.length > 0
      ? json.settlementTilt.abnormalCase.photos
      : (Array.isArray(deformation.abnormal_photos_json) ? deformation.abnormal_photos_json : []),
    diffSettlementLevel: json.settlementTilt?.diffSettlement?.level !== undefined ? Number(json.settlementTilt.diffSettlement.level) : 0,
    diffSettlementPosition: json.settlementTilt?.diffSettlement?.position || '',
    diffSettlementNotes: json.settlementTilt?.diffSettlement?.notes || '',
    buildingTiltLevel: json.settlementTilt?.buildingTilt?.level !== undefined ? Number(json.settlementTilt.buildingTilt.level) : 0,
    buildingTiltNotes: json.settlementTilt?.buildingTilt?.notes || '',
    beamSaggingLevel: json.settlementTilt?.beamSagging?.level !== undefined ? Number(json.settlementTilt.beamSagging.level) : 0,
    beamSaggingPosition: json.settlementTilt?.beamSagging?.position || '',
    beamSaggingDesc: json.settlementTilt?.beamSagging?.description || '',

    // Burland 1977 (Step 4)
    burlandPredominantGrade,
    burlandPredominantLabel: burlandLabels[burlandPredominantGrade] || 'Grade 0',
    burlandLocalMaxGrade,
    burlandLocalMaxLabel: burlandLabels[burlandLocalMaxGrade] || 'Grade 0',
    burlandGoverningZoneCode: rawBurland.governingZoneCode || '',
    burlandGoverningZoneDesc: rawBurland.governingZoneDescription || '',
    burlandStructuralFlagLevel: rawBurlandStructFlag,
    burlandStructuralFlagLevelLabel: structuralFlagLabels[rawBurlandStructFlag] || rawBurlandStructFlag,
    burlandRepresentativeness: rawBurland.representativeness || 'GLOBAL',
    burlandRepresentativenessLabel: rawBurland.representativeness === 'LOCAL' ? 'Cục bộ (Chỉ xuất hiện tại một vài khu vực)' : 'Toàn công trình (Đại diện chung toàn nhà)',
    structuralDefectFlag: totalDefectsCount > 0 ? (rawBurlandStructFlag !== 'NONE' ? `Cờ cảnh báo: ${structuralFlagLabels[rawBurlandStructFlag] || rawBurlandStructFlag}` : 'Nứt phi kết cấu khối xây') : 'Không có khuyết tật kết cấu',
    requiresStructuralReview: Boolean(rawBurland.needStructuralEngineerReview),

    // ECS (Step 6)
    ecsE1: (isJudgementActive && riskScores.overridden_burland_grade !== null && riskScores.overridden_burland_grade !== undefined)
      ? Number(riskScores.overridden_burland_grade)
      : (json.ecs?.e1 !== undefined ? Number(json.ecs.e1) : Number(riskScores.e1_burland_score || 0)),
    ecsE2: json.ecs?.e2 !== undefined ? Number(json.ecs.e2) : Number(riskScores.e2_structure_score || 0),
    ecsE3: json.ecs?.e3 !== undefined ? Number(json.ecs.e3) : Number(riskScores.e3_deformation_score || 0),
    ecsE4: json.ecs?.e4 !== undefined ? Number(json.ecs.e4) : Number(riskScores.e4_material_score || 0),
    ecsE5: json.ecs?.e5 !== undefined ? Number(json.ecs.e5) : Number(riskScores.e5_history_score || 0),
    ecsE6: json.ecs?.e6 !== undefined ? Number(json.ecs.e6) : Number(riskScores.e6_overall_function_score || 0),
    ecsJudgementApplied: isJudgementActive,
    ecsJudgementAction: json.ecs?.engineeringJudgement?.action || riskScores.engineering_judgement_action || 'CUSTOM_OVERRIDE',
    ecsJudgementReason: json.ecs?.engineeringJudgement?.reason || riskScores.engineering_judgement_reason || '',
    judgementEngineerName: riskScores.judgement_engineer_name || 'Kỹ Sư Trưởng Zone Admin',
    judgementAppliedAt: riskScores.judgement_applied_at ? new Date(riskScores.judgement_applied_at).toLocaleDateString('vi-VN') : '',
    qualityGates: [],
    gateDecisionStatus: json.gateDecision?.decision || 'ALLOW',
    gateDecisionLabel: json.gateDecision?.decision === 'ALLOW' ? 'Đủ điều kiện chuyển tiếp (ALLOW)' : (json.gateDecision?.decision === 'CONDITIONAL' ? 'Chấp thuận có điều kiện (CONDITIONAL)' : 'Chưa đạt yêu cầu (BLOCK)'),
    gateDecisionReason: json.gateDecision?.reason || '',

    // VI (Step 6)
    viV1: (isJudgementActive && riskScores.overridden_importance_score !== null && riskScores.overridden_importance_score !== undefined)
      ? Number(riskScores.overridden_importance_score)
      : (json.vi?.v1 !== undefined ? Number(json.vi.v1) : Number(riskScores.v1_importance_score || 1.0)),
    viV2: json.vi?.v2 !== undefined ? Number(json.vi.v2) : Number(riskScores.v2_structure_score || 1.0),
    viV3: json.vi?.v3 !== undefined ? Number(json.vi.v3) : Number(riskScores.v3_foundation_score || 1.0),
    viV4: json.vi?.v4 !== undefined ? Number(json.vi.v4) : Number(riskScores.v4_age_score || 1.0),
    viV5: json.vi?.v5 !== undefined ? Number(json.vi.v5) : Number(riskScores.v5_ecs_score || 1.0),
    viV6: json.vi?.v6 !== undefined ? Number(json.vi.v6) : Number(riskScores.v6_sensitivity_score || 1.0),
    viJudgementApplied: isJudgementActive,
    viJudgementAction: json.vi?.engineeringJudgement?.action || riskScores.engineering_judgement_action || 'CUSTOM_OVERRIDE',
    viJudgementReason: json.vi?.engineeringJudgement?.reason || riskScores.engineering_judgement_reason || '',

    // Metro & BRA
    braMatrixCell: `V=${json.vi?.viClass || riskScores.vi_class || 'LOW'} × I=${json.executiveSummary?.constructionImpactStatus || 'I2'}`,
    braMandatoryAction,
    braEngineeringReviewNotes: reportData.bra_engineering_review_notes || '',

    // Recommendations & Remarks
    summaryConclusions: (json.executiveSummary?.keyRisksDefectsText || reportData.summary_conclusions || '').trim(),
    engineeringRecommendations: (() => {
      const rawRec = json.executiveSummary?.specificRecommendationsText || reportData.engineering_recommendations;
      return (rawRec && typeof rawRec === 'string' && rawRec.trim() && rawRec.trim() !== 'Không') ? rawRec.trim() : 'Không';
    })(),
    ownerRemarks: (() => {
      const rawRemarks = json.ownerRemarks || json.signatures?.ownerFeedback || reportData.owner_remarks;
      return (rawRemarks && typeof rawRemarks === 'string' && rawRemarks.trim() && rawRemarks.trim() !== 'Không') ? rawRemarks.trim() : 'Không';
    })(),
    requiresPhase2: true,
    requiresMonitoring: true,

    // Signatures
    surveyorSignatureUrl: reportData.surveyor_signature_url,
    surveyorSignatureImg: reportData.surveyor_signature_img || reportData.surveyor_signature_url || '',
    ownerSignatureUrl: reportData.owner_signature_url,
    ownerSignatureImg: reportData.owner_signature_url || '',
    zoneAdminSignatureUrl: reportData.zone_admin_signature_url,
    zoneAdminSignatureImg: reportData.zone_admin_signature_img || reportData.zone_admin_signature_url || '',
    superAdminSignatureImg: reportData.super_admin_signature_img || '',
    fieldWorkMinutesPhotoUrl: reportData.official_pdf_url || '',
    workingMinutesPhotos,
    generatedAt: new Date().toLocaleString('vi-VN'),
  };
}
