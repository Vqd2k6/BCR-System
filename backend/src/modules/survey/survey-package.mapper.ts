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
      ownerIdCard: surveyData?.ownerIdCard || surveyData?.ownerId || null,
      residentStatus: surveyData?.residentStatus || null,
      constructionAreaM2: surveyData?.constructionAreaM2 !== '' && surveyData?.constructionAreaM2 !== undefined ? Number(surveyData.constructionAreaM2) : null,
      surveyDataJson: surveyData || null,
    };
  }

  /**
   * Bóc tách và chuyển đổi dữ liệu khuyết tật căn hộ con (localDefects + upperFloorWaterLeakage)
   * thành cấu trúc Floor Survey chuẩn lưu vào damage_zones và defect_items.
   */
  static mapCondoUnitFloorSurveys(surveyData: any): any[] {
    const floorNum = surveyData?.floorNumber ?? 1;
    const unitCode = surveyData?.unitCode || 'CAN_HO';
    const floorName = `Tầng ${floorNum} - Căn ${unitCode}`;
    const unitCadUrl = surveyData?.unitCadUrl || null;

    const zones: any[] = [];

    // Helper tính Burland grade từ crack width
    const getBurlandGrade = (widthMm: number): number => {
      if (widthMm < 0.1) return 0;
      if (widthMm <= 1.0) return 1;
      if (widthMm <= 5.0) return 2;
      if (widthMm <= 15.0) return 3;
      if (widthMm <= 25.0) return 4;
      return 5;
    };

    // 1. Chuyển đổi các vết nứt nội thất localDefects
    const defectsList = Array.isArray(surveyData?.localDefects) ? surveyData.localDefects : [];
    defectsList.forEach((d: any, idx: number) => {
      const zCode = `Z-${String(idx + 1).padStart(2, '0')}`;
      const dCode = d.defectCode || `D-${String(idx + 1).padStart(2, '0')}`;
      const widthMm = Number(d.crackWidthMm) || 0;
      const lengthM = Number(d.crackLengthM) || 0;
      const primaryCu = d.cuPhotoUrl || d.photoUrl || '';
      const ctxUrl = d.ctxPhotoUrl || d.photoUrl || '';

      zones.push({
        zoneCode: zCode,
        floorName,
        roomName: d.location || 'Không gian căn hộ',
        componentType: d.type === 'WATER_LEAKAGE' ? 'WALL' : (d.location?.toLowerCase().includes('dầm') ? 'BEAM' : (d.location?.toLowerCase().includes('sàn') ? 'SLAB' : 'WALL')),
        wallMaterial: 'Gạch trát vữa / Bê tông',
        functionalImpactRepairNeeded: widthMm >= 1.0,
        burlandGrade: getBurlandGrade(widthMm),
        ctxPhotoUrl: ctxUrl,
        notes: d.description || null,
        defects: [
          {
            defectCode: dCode,
            pinX: d.pinX != null ? Number(d.pinX) : 0,
            pinY: d.pinY != null ? Number(d.pinY) : 0,
            screeningCategory: d.type === 'WATER_LEAKAGE' ? 'WATER_LEAK' : 'CRACK',
            defectType: d.type === 'WATER_LEAKAGE' ? 'WATER_STAIN' : (widthMm < 0.2 ? 'HAIRLINE' : 'STRUCTURAL'),
            crackDirection: 'DIAGONAL',
            widthMaxMm: widthMm,
            lengthMm: Math.round(lengthM * 1000),
            activityState: 'U',
            materialDegradationE4: 0,
            structuralSignificanceE2: widthMm >= 2.0 ? 3 : 1,
            hasScaleCard: d.hasScaleCard ?? true,
            isStructuralCritical: widthMm >= 5.0,
            cuPhotoUrl: primaryCu,
            cuPhotos: primaryCu ? [primaryCu] : [],
            cuPhotoCodes: [dCode],
            pinColor: '#ef4444',
          },
        ],
      });
    });

    // 2. Chuyển đổi thấm dột trần lầu trên upperFloorWaterLeakage
    const waterLeakage = surveyData?.upperFloorWaterLeakage;
    if (waterLeakage && waterLeakage.has) {
      const leakItems = Array.isArray(waterLeakage.leakageItems) && waterLeakage.leakageItems.length > 0
        ? waterLeakage.leakageItems
        : [{
            leakageCode: 'WL-01',
            location: waterLeakage.location || 'Trần phòng căn hộ',
            description: waterLeakage.description || 'Thấm dột từ căn hộ lầu trên dội xuống',
            photoUrl: waterLeakage.photoUrl || '',
            ctxPhotoUrl: waterLeakage.photoUrl || '',
            cuPhotoUrl: waterLeakage.photoUrl || '',
          }];

      leakItems.forEach((leak: any, lIdx: number) => {
        const zCode = `Z-WL-${String(lIdx + 1).padStart(2, '0')}`;
        const wlCode = leak.leakageCode || `WL-${String(lIdx + 1).padStart(2, '0')}`;
        const primaryCu = leak.cuPhotoUrl || leak.photoUrl || '';
        const ctxUrl = leak.ctxPhotoUrl || leak.photoUrl || '';

        zones.push({
          zoneCode: zCode,
          floorName,
          roomName: leak.location || 'Trần căn hộ',
          componentType: 'CEILING',
          wallMaterial: 'Thạch cao / Sàn bê tông cốt thép lầu trên',
          functionalImpactRepairNeeded: true,
          burlandGrade: 1,
          ctxPhotoUrl: ctxUrl,
          notes: leak.description || 'Thấm dột trần từ tầng trên',
          defects: [
            {
              defectCode: wlCode,
              pinX: 0,
              pinY: 0,
              screeningCategory: 'WATER_LEAK',
              defectType: 'WATER_STAIN',
              crackDirection: 'CEILING_SEEPAGE',
              widthMaxMm: 0,
              lengthMm: 0,
              activityState: 'A',
              materialDegradationE4: 2,
              structuralSignificanceE2: 1,
              hasScaleCard: false,
              isStructuralCritical: false,
              cuPhotoUrl: primaryCu,
              cuPhotos: primaryCu ? [primaryCu] : [],
              cuPhotoCodes: [wlCode],
              pinColor: '#0284c7',
            },
          ],
        });
      });
    }

    return [
      {
        floorName,
        floorOrder: Number(floorNum) || 1,
        overviewPhotos: [],
        cadDrawingUrl: unitCadUrl,
        cadZonePins: [],
        cadStructuralDrawingUrl: null,
        cadElementPins: [],
        notes: `Khảo sát căn hộ ${unitCode} (Tầng ${floorNum})`,
        zones,
      },
    ];
  }

  /**
   * Bóc tách và chuẩn hóa dữ liệu biến dạng & võng dầm của căn hộ con
   */
  static mapCondoUnitDeformation(surveyData: any): any | null {
    const beamSagging = surveyData?.beamSagging;
    const doorJamming = surveyData?.doorJammingStatus;
    const settlementObserved = surveyData?.settlementObserved;
    const settlementNotes = surveyData?.settlementNotes;

    const hasSag = beamSagging && beamSagging.hasSagging;
    const hasDoorJam = doorJamming && doorJamming !== 'NORMAL';
    const hasSettle = settlementObserved && settlementObserved !== 'NONE';

    if (!hasSag && !hasDoorJam && !hasSettle && !beamSagging?.photoUrl) {
      return null;
    }

    const sagMm = hasSag ? Number(beamSagging.sagMm) || 0 : 0;
    const spanM = hasSag ? Number(beamSagging.spanM) || 0 : 0;
    const floorSlopeRatio = (sagMm > 0 && spanM > 0) ? (sagMm / (spanM * 1000)) : 0;

    const abnormalPhotos: any[] = [];
    if (beamSagging?.photoUrl) {
      abnormalPhotos.push({
        url: beamSagging.photoUrl,
        caption: `Đo võng dầm/sàn: ${beamSagging.location || ''} (f=${sagMm}mm, nhịp=${spanM}m, tỉ số=${beamSagging.ratioText || 'N/A'})`,
      });
    }

    return {
      tiltAngleX: 0,
      tiltAngleY: 0,
      tiltDirection: null,
      floorSlopeRatio,
      beamDeflectionMm: sagMm,
      measurementMethod: 'LASER_LEVEL_AND_CRACK_CARD',
      measurementReliability: 'HIGH',
      diffSettlementPhotoCode: null,
      tiltPhotoCode: null,
      abnormalPhotoCode: abnormalPhotos.length > 0 ? 'SAG-01' : null,
      diffSettlementPhotos: [],
      tiltPhotos: [],
      abnormalPhotos,
      notes: [
        hasDoorJam ? `Cửa: ${doorJamming}` : null,
        hasSettle ? `Lún: ${settlementObserved} (${settlementNotes || ''})` : null,
        hasSag ? `Võng dầm: ${beamSagging.location} (f/L=${beamSagging.ratioText || 'N/A'})` : null,
      ].filter(Boolean).join('; '),
    };
  }
}
