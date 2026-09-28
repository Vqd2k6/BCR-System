import {
  normalizeStructuralSystem,
  normalizeFoundationCategory,
  normalizeComponentType,
} from './survey.dto';

export class SurveyPackageMapper {
  /**
   * Bóc tách và chuẩn hóa bộ 4 ảnh định danh P01 - P04 từ surveyData của PWA
   */
  static mapStep1Photos(surveyData: any) {
    const p01 = surveyData?.photoP01 || {};
    const p02 = surveyData?.photoP02 || {};
    const p03 = surveyData?.photoP03 || {};
    const p04 = surveyData?.photoP04 || {};

    return {
      p01HouseNumberUrl: surveyData?.step1Photos?.p01HouseNumberUrl || p01.url || null,
      p01NotApplicable: surveyData?.step1Photos?.p01NotApplicable ?? p01.notApplicable ?? false,
      p01NaReason: surveyData?.step1Photos?.p01NaReason || p01.naReason,
      p02MainFacadeUrl: surveyData?.step1Photos?.p02MainFacadeUrl || p02.url || null,
      p02FacadePolygonPoints: surveyData?.step1Photos?.p02FacadePolygonPoints || p02.polygonPoints,
      p02FloorSplitLines: surveyData?.step1Photos?.p02FloorSplitLines || p02.floorSplits,
      p02Dimensions: surveyData?.step1Photos?.p02Dimensions || p02.dimensions,
      p02NotApplicable: surveyData?.step1Photos?.p02NotApplicable ?? p02.notApplicable ?? false,
      p02NaReason: surveyData?.step1Photos?.p02NaReason || p02.naReason,
      p03SideRearUrl: surveyData?.step1Photos?.p03SideRearUrl || p03.url || null,
      p03PhotoCode: p03.photoCode || null,
      p03Tag: p03.tag || 'Bên hông trái',
      p03AdditionalPhotos: Array.isArray(p03.additionalPhotos) ? p03.additionalPhotos : [],
      p03NotApplicable: surveyData?.step1Photos?.p03NotApplicable ?? p03.notApplicable ?? false,
      p04ContextStreetUrl: surveyData?.step1Photos?.p04ContextStreetUrl || p04.url || null,
      p04NotApplicable: surveyData?.step1Photos?.p04NotApplicable ?? p04.notApplicable ?? false,
    };
  }

  /**
   * Bóc tách và chuẩn hóa thông số kết cấu công trình (Specs & Foundation)
   */
  static mapBuildingSpecs(surveyData: any) {
    const rawStructure = surveyData?.specs?.structuralSystem || surveyData?.structureSystem || surveyData?.specs?.structureSystem;
    const rawFoundation = surveyData?.specs?.foundationCategory || surveyData?.foundationType || surveyData?.specs?.foundationType;

    let foundationCategory = normalizeFoundationCategory(rawFoundation);
    const score = surveyData?.foundationCatScore;
    if (score === 1) foundationCategory = 'CAT_1_MONG_NONG_GIA_CO';
    else if (score === 2) foundationCategory = 'CAT_2_MONG_DON_BTCT';
    else if (score === 3) foundationCategory = 'CAT_3_MONG_BANG_BTCT';
    else if (score === 4) foundationCategory = 'CAT_4_MONG_COC_BTCT';
    else if (score === 5) foundationCategory = 'CAT_5_KHONG_XAC_DINH';

    return {
      buildingName: surveyData?.specs?.buildingName || surveyData?.buildingName,
      buildingGrade: surveyData?.objectGroup === 'GENERAL' || surveyData?.objectGroup === 'IMPORTANT' || surveyData?.objectGroup === 'CRITICAL'
        ? surveyData.objectGroup
        : (surveyData?.targetGroup || surveyData?.specs?.buildingGrade || 'GENERAL'),
      landUseFunction: surveyData?.specs?.landUseFunction || surveyData?.usageFunction,
      floorCount: Number(surveyData?.specs?.floorCount ?? (surveyData?.aboveFloors !== '' && surveyData?.aboveFloors !== undefined ? surveyData.aboveFloors : 1)),
      basementCount: Number(surveyData?.specs?.basementCount ?? (surveyData?.undergroundFloors !== '' && surveyData?.undergroundFloors !== undefined ? surveyData.undergroundFloors : 0)),
      constructionAreaM2: surveyData?.specs?.constructionAreaM2 ?? (surveyData?.constructionAreaM2 !== '' && surveyData?.constructionAreaM2 !== undefined ? Number(surveyData.constructionAreaM2) : null),
      buildingHeightM: surveyData?.specs?.buildingHeightM ?? (surveyData?.buildingHeightM !== '' && surveyData?.buildingHeightM !== undefined ? Number(surveyData.buildingHeightM) : null),
      yearOfConstruction: surveyData?.specs?.yearOfConstruction ?? (surveyData?.constructionYear !== '' && surveyData?.constructionYear !== undefined ? Number(surveyData.constructionYear) : null),
      isYearEstimated: Boolean(surveyData?.specs?.isYearEstimated ?? surveyData?.isEstimatedYear),
      structuralSystem: normalizeStructuralSystem(rawStructure),
      foundationCategory,
      foundationSource: surveyData?.specs?.foundationSource || surveyData?.foundationSource || 'Bản vẽ hoàn công',
      adjacentBuildings: surveyData?.specs?.adjacentBuildings || (surveyData?.adjacentBuildings ? JSON.stringify(surveyData.adjacentBuildings) : null),
      extendedOrRenovated: (surveyData?.historyInterview?.renovationLoad ?? 0) > 0 || Boolean(surveyData?.specs?.extendedOrRenovated ?? surveyData?.extendedOrRenovated ?? surveyData?.history?.extendedOrRenovated ?? false),
      previousSettlementOrTilt: (surveyData?.historyInterview?.pastSettlement ?? 0) > 0 || Boolean(surveyData?.specs?.previousSettlementOrTilt ?? surveyData?.previousSettlementOrTilt ?? false),
      fireOrAccident: (surveyData?.historyInterview?.fireFloodIncident ?? 0) > 0 || Boolean(surveyData?.specs?.fireOrAccident ?? surveyData?.fireOrAccident ?? false),
      sensitiveEquipmentPresent: Boolean(surveyData?.historyInterview?.sensitiveEquipment?.has ?? surveyData?.specs?.sensitiveEquipmentPresent ?? surveyData?.sensitiveEquipmentPresent ?? false),
      historyDetails: surveyData?.historyInterview ? JSON.stringify(surveyData.historyInterview) : (surveyData?.specs?.historyDetails || surveyData?.historyDetails || null),
      e5HistoryScore: Number(surveyData?.ecs?.e5 ?? surveyData?.specs?.e5HistoryScore ?? surveyData?.e5HistoryScore ?? 0),
      foundationDepthM: surveyData?.specs?.foundationDepthM ?? surveyData?.foundationDepthM,
      foundationDensity: surveyData?.specs?.foundationDensity ?? surveyData?.foundationDensity,
      foundationSpacingM: surveyData?.specs?.foundationSpacingM ?? surveyData?.foundationSpacingM,
      foundationNotes: surveyData?.specs?.foundationNotes ?? surveyData?.foundationNotes,
      asBuiltDrawingPhotoUrl: surveyData?.asBuiltDrawingPhotoUrl || (Array.isArray(surveyData?.asBuiltDrawingPhotos) && surveyData.asBuiltDrawingPhotos[0]?.url) || null,
      asBuiltDrawingPhotos: Array.isArray(surveyData?.asBuiltDrawingPhotos) ? surveyData.asBuiltDrawingPhotos : [],
    };
  }

  /**
   * Bóc tách và chuẩn hóa dữ liệu biến dạng & lún nghiêng
   */
  static mapDeformation(surveyData: any) {
    if (surveyData?.settlementTilt) {
      const tilt = surveyData.settlementTilt.buildingTilt || {};
      const sag = surveyData.settlementTilt.beamSagging || {};
      const settle = surveyData.settlementTilt.diffSettlement || {};
      const anomaly = surveyData.settlementTilt.abnormalCase || {};

      return {
        tiltAngleX: Number(tilt.xPermille) || 0,
        tiltAngleY: Number(tilt.yPermille) || 0,
        tiltDirection: tilt.direction ? String(tilt.direction) : null,
        floorSlopeRatio: Number(surveyData.settlementTilt.floorSlopeRatio) || 0,
        beamDeflectionMm: Number(sag.sagMm) || 0,
        measurementMethod: Array.isArray(surveyData.settlementTilt.dataSource)
          ? surveyData.settlementTilt.dataSource.join(', ')
          : (surveyData.settlementTilt.dataSource || 'LASER_LEVEL'),
        measurementReliability:
          surveyData.settlementTilt.reliability === 'MEDIUM' || surveyData.settlementTilt.reliability === 'LOW'
            ? surveyData.settlementTilt.reliability
            : 'HIGH',
        diffSettlementPhotoCode: settle.photoCode || null,
        tiltPhotoCode: tilt.photoCode || null,
        abnormalPhotoCode: anomaly.photoCode || null,
        diffSettlementPhotos: Array.isArray(settle.photos) ? settle.photos : (settle.photoUrl ? [{ url: settle.photoUrl, photoCode: settle.photoCode }] : []),
        tiltPhotos: Array.isArray(tilt.photos) ? tilt.photos : (tilt.photoUrl ? [{ url: tilt.photoUrl, photoCode: tilt.photoCode }] : []),
        abnormalPhotos: Array.isArray(anomaly.photos) ? anomaly.photos : (anomaly.photoUrl ? [{ url: anomaly.photoUrl, photoCode: anomaly.photoCode }] : []),
      };
    } else if (surveyData?.deformation) {
      return {
        tiltAngleX: Number(surveyData.deformation.tiltAngleX) || 0,
        tiltAngleY: Number(surveyData.deformation.tiltAngleY) || 0,
        tiltDirection: surveyData.deformation.tiltDirection ? String(surveyData.deformation.tiltDirection) : null,
        floorSlopeRatio: Number(surveyData.deformation.floorSlopeRatio) || 0,
        beamDeflectionMm: Number(surveyData.deformation.beamDeflectionMm) || 0,
        measurementMethod: surveyData.deformation.measurementMethod || 'LASER_LEVEL',
        measurementReliability: surveyData.deformation.measurementReliability || 'HIGH',
        diffSettlementPhotoCode: surveyData.deformation.diffSettlementPhotoCode || null,
        tiltPhotoCode: surveyData.deformation.tiltPhotoCode || null,
        abnormalPhotoCode: surveyData.deformation.abnormalPhotoCode || null,
        diffSettlementPhotos: Array.isArray(surveyData.deformation.diffSettlementPhotos) ? surveyData.deformation.diffSettlementPhotos : [],
        tiltPhotos: Array.isArray(surveyData.deformation.tiltPhotos) ? surveyData.deformation.tiltPhotos : [],
        abnormalPhotos: Array.isArray(surveyData.deformation.abnormalPhotos) ? surveyData.deformation.abnormalPhotos : [],
      };
    }
    return null;
  }

  /**
   * Bóc tách và chuẩn hóa thông tin nộp hồ sơ, chữ ký hiện trường
   */
  static mapSubmitData(surveyData: any) {
    return {
      ownerRemarks: surveyData?.signatures?.ownerFeedback || surveyData?.signatures?.ownerRemarks || surveyData?.ownerRemarks || '',
      surveyorSignatureUrl: surveyData?.signatures?.preparedBy?.photoUrl || surveyData?.signatures?.surveyorSignatureUrl || surveyData?.surveyorSignatureUrl || '',
      ownerSignatureUrl: surveyData?.signatures?.ownerRepresentative?.photoUrl || surveyData?.signatures?.ownerSignatureUrl || surveyData?.ownerSignatureUrl || '',
      summaryConclusions: surveyData?.executiveSummary?.keyRisksDefectsText || surveyData?.executiveSummary?.summaryConclusionsText || surveyData?.signatures?.summaryConclusions || surveyData?.summaryConclusions || '',
      engineeringRecommendations: surveyData?.executiveSummary?.specificRecommendationsText || surveyData?.signatures?.engineeringRecommendations || surveyData?.engineeringRecommendations || '',
      houseNumber: surveyData?.houseNumber,
      street: surveyData?.street,
      ownerName: surveyData?.ownerName || surveyData?.signatures?.ownerRepresentative?.fullName || null,
      ownerPhone: surveyData?.ownerPhone || null,
      constructionAreaM2: surveyData?.constructionAreaM2 !== '' && surveyData?.constructionAreaM2 !== undefined ? Number(surveyData.constructionAreaM2) : null,
      surveyDataJson: surveyData || null,
    };
  }
}
