import {
  normalizeStructuralSystem,
  normalizeFoundationCategory,
  normalizeComponentType,
} from './survey.dto';

export class SurveyPackageMapper {
  /**
   * Kiểm tra xem chuỗi tên chủ hộ có phải là chuỗi giả định địa chính ('Chủ hộ thửa XX', 'Chưa cập nhật'...) hay không
   */
  static isCadastralPlaceholderName(name?: unknown): boolean {
    if (!name || typeof name !== 'string') return false;
    const trimmed = name.trim();
    if (!trimmed) return false;
    return /^(chủ\s+hộ\s+thửa|chưa\s+cập\s+nhật|chủ\s+sở\s+hữu\s+thửa)/i.test(trimmed);
  }

  /**
   * Trả về tên chủ hộ thực tế đã làm sạch (trả về null nếu rỗng hoặc là chuỗi giả định địa chính)
   */
  static cleanRealOwnerName(name?: unknown): string | null {
    if (!name || typeof name !== 'string') return null;
    const trimmed = name.trim();
    if (!trimmed || SurveyPackageMapper.isCadastralPlaceholderName(trimmed)) return null;
    return trimmed;
  }

  /**
   * Lưới an toàn phía máy chủ: quét đệ quy surveyData và trả về đường dẫn JSON của mọi chuỗi
   * "blob:..." (ảnh còn nằm trong máy/IndexedDB) hoặc "data:image/..." dài (ảnh Base64 chưa upload).
   * Những giá trị này sẽ thành ảnh hỏng/mất vĩnh viễn trên báo cáo nếu được lưu như đã nộp.
   */
  static findUnsyncedPhotoPaths(
    target: unknown,
    basePath: string = '$',
    out: string[] = [],
    limit: number = 200
  ): string[] {
    if (out.length >= limit || target === null || target === undefined) return out;

    if (typeof target === 'string') {
      if (target.startsWith('blob:') || (target.startsWith('data:image/') && target.length > 500)) {
        out.push(basePath);
      }
      return out;
    }

    if (Array.isArray(target)) {
      target.forEach((item, idx) => SurveyPackageMapper.findUnsyncedPhotoPaths(item, `${basePath}[${idx}]`, out, limit));
      return out;
    }

    if (typeof target === 'object') {
      const obj = target as Record<string, unknown>;
      for (const key of Object.keys(obj)) {
        SurveyPackageMapper.findUnsyncedPhotoPaths(obj[key], `${basePath}.${key}`, out, limit);
      }
    }
    return out;
  }

  /**
   * Bóc tách và chuẩn hóa bộ 4 ảnh định danh P01 - P04 từ surveyData của PWA
   */
  static mapStep1Photos(surveyData: any) {
    const p01 = surveyData?.photoP01 || {};
    const p02 = surveyData?.photoP02 || {};
    const p03 = surveyData?.photoP03 || {};
    const p04 = surveyData?.photoP04 || {};

    const rawP02Dims =
      surveyData?.step1Photos?.p02Dimensions ||
      p02.dimensions ||
      (p02.widthM !== undefined || p02.heightM !== undefined || Array.isArray(p02.freehandStrokes)
        ? {
            widthM: p02.widthM ?? '',
            heightM: p02.heightM ?? '',
            freehandStrokes: Array.isArray(p02.freehandStrokes) ? p02.freehandStrokes : [],
          }
        : undefined);
    const p02NaReason = surveyData?.step1Photos?.p02NaReason || p02.naReason || undefined;
    const resolvedP02Dimensions =
      rawP02Dims || p02NaReason
        ? {
            ...(rawP02Dims || {}),
            ...(p02NaReason ? { naReason: p02NaReason } : {}),
          }
        : undefined;

    return {
      houseNumber: surveyData?.houseNumber || null,
      street: surveyData?.street || null,
      p01HouseNumberUrl: surveyData?.step1Photos?.p01HouseNumberUrl || p01.url || null,
      p01PhotoCode: surveyData?.step1Photos?.p01PhotoCode || p01.photoCode || 'P-01',
      p01NotApplicable: surveyData?.step1Photos?.p01NotApplicable ?? p01.notApplicable ?? false,
      p01NaReason: surveyData?.step1Photos?.p01NaReason || p01.naReason,
      p02MainFacadeUrl: surveyData?.step1Photos?.p02MainFacadeUrl || p02.url || null,
      p02PhotoCode: surveyData?.step1Photos?.p02PhotoCode || p02.photoCode || 'P-02',
      p02FacadePolygonPoints: surveyData?.step1Photos?.p02FacadePolygonPoints || p02.polygonPoints,
      p02FloorSplitLines: surveyData?.step1Photos?.p02FloorSplitLines || p02.floorSplits,
      p02Dimensions: resolvedP02Dimensions,
      p02NotApplicable: surveyData?.step1Photos?.p02NotApplicable ?? p02.notApplicable ?? false,
      p02NaReason,
      p03SideRearUrl: surveyData?.step1Photos?.p03SideRearUrl || p03.url || null,
      p03PhotoCode: p03.photoCode || 'P-03',
      p03Tag: p03.tag || 'Bên hông trái',
      p03AdditionalPhotos: Array.isArray(p03.additionalPhotos) ? p03.additionalPhotos : [],
      p03NotApplicable: surveyData?.step1Photos?.p03NotApplicable ?? p03.notApplicable ?? false,
      p03NaReason: surveyData?.step1Photos?.p03NaReason || p03.naReason,
      p04ContextStreetUrl: surveyData?.step1Photos?.p04ContextStreetUrl || p04.url || null,
      p04PhotoCode: surveyData?.step1Photos?.p04PhotoCode || p04.photoCode || 'P-04',
      p04NotApplicable: surveyData?.step1Photos?.p04NotApplicable ?? p04.notApplicable ?? false,
      p04NaReason: surveyData?.step1Photos?.p04NaReason || p04.naReason,
    };
  }

  /**
   * Bóc tách và chuẩn hóa thông số kết cấu công trình (Specs & Foundation)
   */
  static mapBuildingSpecs(surveyData: any) {
    const rawStructure = surveyData?.specs?.structuralSystem || surveyData?.structureSystem || surveyData?.specs?.structureSystem;
    const rawFoundation = surveyData?.specs?.foundationCategory || surveyData?.foundationType || surveyData?.specs?.foundationType;

    let foundationCategory = normalizeFoundationCategory(rawFoundation);
    if (!rawFoundation && surveyData?.foundationCatScore !== undefined) {
      const score = Number(surveyData.foundationCatScore);
      if (score === 1) foundationCategory = 'CAT_4_MONG_COC_BTCT';
      else if (score === 2) foundationCategory = 'CAT_3_MONG_BANG_BTCT';
      else if (score === 3) foundationCategory = 'CAT_2_MONG_DON_BTCT';
      else if (score === 4) foundationCategory = 'CAT_1_MONG_NONG_GIA_CO';
      else if (score === 5) foundationCategory = 'CAT_5_KHONG_XAC_DINH';
    }

    const pileDimensionsText =
      surveyData?.pileDimensionMm !== undefined && surveyData?.pileDimensionMm !== ''
        ? String(surveyData.pileDimensionMm)
        : surveyData?.pileWidthMm || surveyData?.pileLengthMm
          ? `${surveyData.pileWidthMm || ''}x${surveyData.pileLengthMm || ''}`
          : null;

    return {
      buildingName: surveyData?.specs?.buildingName || surveyData?.buildingName,
      buildingGrade: surveyData?.objectGroup === 'GENERAL' || surveyData?.objectGroup === 'IMPORTANT' || surveyData?.objectGroup === 'CRITICAL'
        ? surveyData.objectGroup
        : (surveyData?.targetGroup || surveyData?.specs?.buildingGrade || 'GENERAL'),
      landUseFunction: surveyData?.specs?.landUseFunction || surveyData?.usageFunction,
      floorCount: Number(surveyData?.specs?.floorCount ?? (surveyData?.aboveFloors !== '' && surveyData?.aboveFloors !== undefined ? surveyData.aboveFloors : 1)),
      basementCount: Number(surveyData?.specs?.basementCount ?? (surveyData?.undergroundFloors !== '' && surveyData?.undergroundFloors !== undefined ? surveyData.undergroundFloors : 0)),
      constructionAreaM2: surveyData?.specs?.constructionAreaM2 ?? (surveyData?.constructionAreaM2 !== '' && surveyData?.constructionAreaM2 !== undefined ? Number(surveyData.constructionAreaM2) : (surveyData?.unitAreaM2 !== '' && surveyData?.unitAreaM2 !== undefined ? Number(surveyData.unitAreaM2) : null)),
      buildingHeightM: surveyData?.specs?.buildingHeightM ?? (surveyData?.buildingHeightM !== '' && surveyData?.buildingHeightM !== undefined ? Number(surveyData.buildingHeightM) : null),
      yearOfConstruction: surveyData?.specs?.yearOfConstruction ?? (surveyData?.constructionYear !== '' && surveyData?.constructionYear !== undefined ? Number(surveyData.constructionYear) : null),
      isYearEstimated: Boolean(surveyData?.specs?.isYearEstimated ?? surveyData?.isEstimatedYear),
      structuralSystem: normalizeStructuralSystem(rawStructure),
      foundationCategory,
      foundationCatScore: surveyData?.foundationCatScore !== undefined && surveyData?.foundationCatScore !== '' ? Number(surveyData.foundationCatScore) : null,
      pileDimensionsText,
      foundationSource: surveyData?.specs?.foundationSource || surveyData?.foundationSource || 'Bản vẽ hoàn công',
      adjacentBuildings: surveyData?.specs?.adjacentBuildings || (surveyData?.adjacentBuildings ? JSON.stringify(surveyData.adjacentBuildings) : null),
      extendedOrRenovated:
        (surveyData?.historyInterview?.renovationLoad ?? 0) > 0 ||
        (surveyData?.historyInterview?.majorRepair ?? 0) > 0 ||
        Boolean(surveyData?.specs?.extendedOrRenovated ?? surveyData?.extendedOrRenovated ?? surveyData?.history?.extendedOrRenovated ?? false),
      previousSettlementOrTilt:
        (surveyData?.historyInterview?.pastSettlement ?? 0) > 0 ||
        (surveyData?.historyInterview?.neighborDamage ?? 0) > 0 ||
        Boolean(surveyData?.specs?.previousSettlementOrTilt ?? surveyData?.previousSettlementOrTilt ?? false),
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
      asBuiltDrawingFiles: Array.isArray(surveyData?.asBuiltDrawingFiles) ? surveyData.asBuiltDrawingFiles : [],
      unitsPerFloor: surveyData?.unitsPerFloor !== undefined && surveyData?.unitsPerFloor !== '' ? Number(surveyData.unitsPerFloor) : null,
      totalUnitsCount: surveyData?.totalUnitsCount !== undefined && surveyData?.totalUnitsCount !== '' ? Number(surveyData.totalUnitsCount) : null,
      managementContactJson: {
        managementContactName: surveyData?.managementContactName || null,
        managementContactPhone: surveyData?.managementContactPhone || null,
        unitsPerFloor: surveyData?.unitsPerFloor ?? null,
        totalUnitsCount: surveyData?.totalUnitsCount ?? null,
      },
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
      const mon = surveyData.settlementTilt.needAdditionalMonitoring || {};
      const computedE3 = Math.min(
        4,
        Math.max(Number(settle.level) || 0, Number(tilt.level) || 0, Number(sag.level) || 0)
      );

      return {
        tiltAngleX: Number(tilt.xPermille) || 0,
        tiltAngleY: Number(tilt.yPermille) || 0,
        tiltDirection: tilt.direction ? String(tilt.direction) : null,
        floorSlopeRatio: Number(surveyData.settlementTilt.floorSlopeRatio) || 0,
        beamDeflectionMm: Number(sag.sagMm) || 0,
        e3DeformationScore: surveyData?.ecs?.e3 !== undefined ? Number(surveyData.ecs.e3) : computedE3,
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
        beamSaggingPhotoCode: sag.photoCode || null,
        diffSettlementPhotos: Array.isArray(settle.photos) ? settle.photos : (settle.photoUrl ? [{ url: settle.photoUrl, photoCode: settle.photoCode }] : []),
        tiltPhotos: Array.isArray(tilt.photos) ? tilt.photos : (tilt.photoUrl ? [{ url: tilt.photoUrl, photoCode: tilt.photoCode }] : []),
        abnormalPhotos: Array.isArray(anomaly.photos) ? anomaly.photos : (anomaly.photoUrl ? [{ url: anomaly.photoUrl, photoCode: anomaly.photoCode }] : []),
        beamSaggingPhotos: Array.isArray(sag.photos)
          ? sag.photos
          : sag.photoUrl
            ? [{ url: sag.photoUrl, photoCode: sag.photoCode, position: sag.position, notes: sag.notes, level: sag.level }]
            : [],
        monitoringRequired: Boolean(mon.required),
        monitoringNotes: mon.notes || null,
        notes: [settle.notes, tilt.notes, sag.notes, anomaly.description].filter(Boolean).join('; ') || null,
        detailsJson: {
          diffSettlement: settle,
          buildingTilt: tilt,
          beamSagging: sag,
          abnormalCase: anomaly,
          needAdditionalMonitoring: mon,
        },
      };
    } else if (surveyData?.deformation) {
      return {
        tiltAngleX: Number(surveyData.deformation.tiltAngleX) || 0,
        tiltAngleY: Number(surveyData.deformation.tiltAngleY) || 0,
        tiltDirection: surveyData.deformation.tiltDirection ? String(surveyData.deformation.tiltDirection) : null,
        floorSlopeRatio: Number(surveyData.deformation.floorSlopeRatio) || 0,
        beamDeflectionMm: Number(surveyData.deformation.beamDeflectionMm) || 0,
        e3DeformationScore: Number(surveyData.deformation.e3DeformationScore ?? surveyData?.ecs?.e3 ?? 0),
        measurementMethod: surveyData.deformation.measurementMethod || 'LASER_LEVEL',
        measurementReliability: surveyData.deformation.measurementReliability || 'HIGH',
        diffSettlementPhotoCode: surveyData.deformation.diffSettlementPhotoCode || null,
        tiltPhotoCode: surveyData.deformation.tiltPhotoCode || null,
        abnormalPhotoCode: surveyData.deformation.abnormalPhotoCode || null,
        beamSaggingPhotoCode: surveyData.deformation.beamSaggingPhotoCode || null,
        diffSettlementPhotos: Array.isArray(surveyData.deformation.diffSettlementPhotos) ? surveyData.deformation.diffSettlementPhotos : [],
        tiltPhotos: Array.isArray(surveyData.deformation.tiltPhotos) ? surveyData.deformation.tiltPhotos : [],
        abnormalPhotos: Array.isArray(surveyData.deformation.abnormalPhotos) ? surveyData.deformation.abnormalPhotos : [],
        beamSaggingPhotos: Array.isArray(surveyData.deformation.beamSaggingPhotos) ? surveyData.deformation.beamSaggingPhotos : [],
        monitoringRequired: Boolean(surveyData.deformation.monitoringRequired),
        monitoringNotes: surveyData.deformation.monitoringNotes || null,
        notes: surveyData.deformation.notes || null,
        detailsJson: surveyData.deformation.detailsJson || {},
      };
    }
    return null;
  }

  /**
   * Bóc tách và chuẩn hóa thông tin nộp hồ sơ, chữ ký hiện trường
   */
  static mapSubmitData(surveyData: any) {
    const rawMinutes = surveyData?.workingMinutesPhotos || surveyData?.signatures?.workingMinutesPhotos || [];
    const workingMinutesPhotos = Array.isArray(rawMinutes) ? rawMinutes.filter(Boolean) : [];
    const ownerRemarks = surveyData?.signatures?.ownerFeedback || surveyData?.signatures?.ownerRemarks || surveyData?.ownerRemarks || surveyData?.ownerFeedback || '';
    const surveyorSig = surveyData?.signatures?.preparedBy?.photoUrl || surveyData?.signatures?.surveyorSignatureUrl || surveyData?.surveyorSignatureUrl || surveyData?.surveyorSignature || '';
    const ownerSig = surveyData?.signatures?.ownerRepresentative?.photoUrl || surveyData?.signatures?.ownerSignatureUrl || surveyData?.ownerSignatureUrl || surveyData?.ownerSignature || '';

    const realOwnerName =
      SurveyPackageMapper.cleanRealOwnerName(surveyData?.ownerName) ||
      SurveyPackageMapper.cleanRealOwnerName(surveyData?.signatures?.ownerRepresentative?.fullName) ||
      null;

    // Đảm bảo surveyDataJson lưu trữ cấu trúc signatures lồng ghép đồng bộ chuẩn Phase 1
    // và nếu tìm thấy realOwnerName hợp lệ thì ghi ngược vào enrichedSurveyData.ownerName
    const enrichedSurveyData = {
      ...surveyData,
      ...(realOwnerName ? { ownerName: realOwnerName } : {}),
      workingMinutesPhotos,
      signatures: {
        ...(surveyData?.signatures || {}),
        ownerFeedback: ownerRemarks,
        ownerRemarks,
        surveyorSignatureUrl: surveyorSig,
        ownerSignatureUrl: ownerSig,
        workingMinutesPhotos,
      },
    };

    return {
      ownerRemarks,
      surveyorSignatureUrl: surveyorSig,
      ownerSignatureUrl: ownerSig,
      summaryConclusions: surveyData?.executiveSummary?.keyRisksDefectsText || surveyData?.executiveSummary?.summaryConclusionsText || surveyData?.signatures?.summaryConclusions || surveyData?.summaryConclusions || '',
      engineeringRecommendations: surveyData?.executiveSummary?.specificRecommendationsText || surveyData?.signatures?.engineeringRecommendations || surveyData?.engineeringRecommendations || '',
      houseNumber: surveyData?.houseNumber,
      street: surveyData?.street,
      ownerName: realOwnerName,
      ownerPhone: surveyData?.ownerPhone || null,
      ownerIdCard: surveyData?.ownerIdCard || surveyData?.ownerId || null,
      residentStatus: surveyData?.residentStatus || null,
      displayCode: surveyData?.displayCode || surveyData?.display_code || null,
      unitCadUrl: surveyData?.unitCadUrl || surveyData?.damageMapUrl || null,
      cadBbox: surveyData?.cadBbox || null,
      constructionAreaM2: surveyData?.constructionAreaM2 !== '' && surveyData?.constructionAreaM2 !== undefined ? Number(surveyData.constructionAreaM2) : (surveyData?.unitAreaM2 !== '' && surveyData?.unitAreaM2 !== undefined ? Number(surveyData.unitAreaM2) : null),
      workingMinutesPhotos,
      surveyDataJson: enrichedSurveyData,
    };
  }

  /**
   * Bóc tách và chuyển đổi dữ liệu khuyết tật căn hộ con
   * Phục vụ cả mô hình phân cấp Z-E-D chuẩn Phase 1 lẫn định dạng legacy (localDefects)
   */
  static mapCondoUnitFloorSurveys(surveyData: any): any[] {
    const floorNum = surveyData?.floorNumber ?? 1;
    const unitCode = surveyData?.unitCode || 'CAN_HO';
    const floorName = `Tầng ${floorNum} - Căn ${unitCode}`;
    const unitCadUrl = surveyData?.unitCadUrl || surveyData?.damageMapUrl || null;
    const structuralCadUrl = surveyData?.structuralCadUrl || surveyData?.cadStructuralDrawingUrl || null;
    const cadZonePins = Array.isArray(surveyData?.cadZonePins) ? surveyData.cadZonePins : [];
    const cadElementPins = Array.isArray(surveyData?.cadElementPins) ? surveyData.cadElementPins : [];
    const hasStructuralElements = surveyData?.hasStructuralElements !== false;

    // Helper tính Burland grade từ crack width (theo chuẩn FE Phase 1: <= 0.1mm -> 0)
    const getBurlandGrade = (widthMm: number): number => {
      if (widthMm <= 0.1) return 0;
      if (widthMm <= 1.0) return 1;
      if (widthMm <= 5.0) return 2;
      if (widthMm <= 15.0) return 3;
      if (widthMm <= 25.0) return 4;
      return 5;
    };

    let zones: any[] = [];
    let structuralElements: any[] = [];

    // TRƯỜNG HỢP 1: Dữ liệu phân cấp Z-E-D chuẩn mới (có surveyData.zones hoặc surveyData.structuralElements)
    const hasStructuredZones = Array.isArray(surveyData?.zones) && surveyData.zones.length > 0;
    const hasStructuredElements = Array.isArray(surveyData?.structuralElements) && surveyData.structuralElements.length > 0;

    if (hasStructuredZones || hasStructuredElements) {
      if (hasStructuredZones) {
        zones = surveyData.zones.map((z: any, zIdx: number) => {
          const zCode = z.zoneCode || `Z-${String(zIdx + 1).padStart(2, '0')}`;
          const zDefects = (Array.isArray(z.defects) ? z.defects : []).map((d: any, dIdx: number) => {
            const dCode = d.defectCode || `D-${String(dIdx + 1).padStart(2, '0')}`;
            const widthMm = Number(d.widthMaxMm ?? d.crackWidthMm ?? 0);
            const rawLength = d.lengthMm !== undefined ? Number(d.lengthMm) : (Number(d.crackLengthM ?? 0) * 1000);
            const primaryCu = d.cuPhotos?.[0] || d.cuPhotoUrl || d.photoUrl || '';
            const extraCu = d.cuPhotos?.[1] || d.extraPhotoUrl || null;

            return {
              defectCode: dCode,
              pinX: d.pinX != null ? Number(d.pinX) : 0,
              pinY: d.pinY != null ? Number(d.pinY) : 0,
              screeningCategory: d.screeningCategory || (d.type === 'WATER_LEAKAGE' ? 'WATER_LEAK' : 'CRACK'),
              defectType: d.defectType || (d.type === 'WATER_LEAKAGE' ? 'WATER_STAIN' : (widthMm < 0.2 ? 'HAIRLINE' : 'STRUCTURAL')),
              crackDirection: d.crackDirection || 'DIAGONAL',
              widthMaxMm: widthMm,
              lengthMm: Math.round(rawLength),
              activityState: ['A', 'S', 'U'].includes(d.activityState) ? d.activityState : 'U',
              materialDegradationE4: Number(d.materialDegradationE4 ?? 0),
              structuralSignificanceE2: Number(d.structuralSignificanceE2 ?? (widthMm >= 2.0 ? 3 : 1)),
              functionalImpactE6: d.functionalImpactE6 || null,
              hasScaleCard: d.hasScaleCard ?? true,
              isStructuralCritical: Boolean(d.isStructuralCritical ?? widthMm >= 5.0),
              cuPhotoUrl: primaryCu,
              extraPhotoUrl: extraCu,
              cuPhotos: Array.isArray(d.cuPhotos) && d.cuPhotos.length > 0 ? d.cuPhotos : (primaryCu ? [primaryCu] : []),
              cuPhotoCodes: Array.isArray(d.cuPhotoCodes) && d.cuPhotoCodes.length > 0 ? d.cuPhotoCodes : (d.cuPhotoCode ? [d.cuPhotoCode] : [dCode]),
              pinColor: d.pinColor || '#ef4444',
              notes: d.notes || d.description || '',
              capturedAt: d.capturedAt || null,
            };
          });

          const crackDefects = zDefects.filter((d: any) => d.screeningCategory === 'CRACK');
          const maxW = Math.max(...crackDefects.map((d: any) => d.widthMaxMm), 0);
          const resolvedRoomName = (z.roomName === 'Khác' && z.customRoomName) ? z.customRoomName : (z.roomName || 'Không gian căn hộ');
          const resolvedCompType = (z.componentType === 'Khác' && z.customComponentType) ? z.customComponentType : (z.componentType || 'WALL');
          const resolvedWallMat = (z.wallMaterial === 'Khác' && z.customWallMaterial) ? z.customWallMaterial : (z.wallMaterial || 'Gạch trát vữa / Bê tông');
          return {
            zoneCode: zCode,
            floorName: z.floorName || floorName,
            roomName: resolvedRoomName,
            componentType: resolvedCompType,
            wallMaterial: resolvedWallMat,
            functionalImpactRepairNeeded: z.functionalImpactRepairNeeded ?? (maxW >= 1.0),
            burlandGrade: z.burlandGrade !== undefined ? Number(z.burlandGrade) : getBurlandGrade(maxW),
            ctxPhotoUrl: z.ctxPhotoUrl || '',
            ctxPhotoCode: z.ctxPhotoCode || `${zCode}_CTX`,
            overviewPhotos: Array.isArray(z.overviewPhotos) ? z.overviewPhotos : [],
            notes: z.notes || null,
            defects: zDefects,
          };
        });
      }

      if (hasStructuredElements) {
        structuralElements = surveyData.structuralElements.map((e: any, eIdx: number) => {
          const eCode = e.elementCode || `E-${String(eIdx + 1).padStart(2, '0')}`;
          const eDefects = (Array.isArray(e.defects) ? e.defects : []).map((d: any, dIdx: number) => {
            const dCode = d.defectCode || `D-E${eIdx + 1}-${String(dIdx + 1).padStart(2, '0')}`;
            const widthMm = Number(d.widthMaxMm ?? d.crackWidthMm ?? 0);
            const rawLength = d.lengthMm !== undefined ? Number(d.lengthMm) : (Number(d.crackLengthM ?? 0) * 1000);
            const primaryCu = d.cuPhotos?.[0] || d.cuPhotoUrl || d.photoUrl || '';
            const extraCu = d.cuPhotos?.[1] || d.extraPhotoUrl || null;

            return {
              defectCode: dCode,
              pinX: d.pinX != null ? Number(d.pinX) : 0,
              pinY: d.pinY != null ? Number(d.pinY) : 0,
              screeningCategory: d.screeningCategory || 'CRACK',
              defectType: d.defectType || 'STRUCTURAL',
              crackDirection: d.crackDirection || 'VERTICAL',
              widthMaxMm: widthMm,
              lengthMm: Math.round(rawLength),
              activityState: ['A', 'S', 'U'].includes(d.activityState) ? d.activityState : 'S',
              materialDegradationE4: Number(d.materialDegradationE4 ?? 0),
              structuralSignificanceE2: Number(d.structuralSignificanceE2 ?? 3),
              functionalImpactE6: d.functionalImpactE6 || null,
              hasScaleCard: d.hasScaleCard ?? true,
              isStructuralCritical: Boolean(d.isStructuralCritical ?? widthMm >= 3.0),
              cuPhotoUrl: primaryCu,
              extraPhotoUrl: extraCu,
              cuPhotos: Array.isArray(d.cuPhotos) && d.cuPhotos.length > 0 ? d.cuPhotos : (primaryCu ? [primaryCu] : []),
              cuPhotoCodes: Array.isArray(d.cuPhotoCodes) && d.cuPhotoCodes.length > 0 ? d.cuPhotoCodes : (d.cuPhotoCode ? [d.cuPhotoCode] : [dCode]),
              pinColor: d.pinColor || '#f97316',
              notes: d.notes || d.description || '',
              capturedAt: d.capturedAt || null,
            };
          });

          return {
            elementCode: eCode,
            roomName: (e.roomName === 'Khác' && e.customRoomName) ? e.customRoomName : (e.roomName || 'Không gian căn hộ'),
            elementType: (e.elementType === 'Khác' && e.customElementType) ? e.customElementType : (e.elementType || 'COLUMN'),
            materialType: (e.materialType === 'Khác' && e.customMaterialType) ? e.customMaterialType : (e.materialType || 'Bê tông cốt thép (BTCT)'),
            dimensions: e.dimensions || null,
            structuralIntegrity: e.structuralIntegrity || null,
            ctxPhotoUrl: e.ctxPhotoUrl || '',
            ctxPhotoCode: e.ctxPhotoCode || `${eCode}_CTX`,
            overviewPhotos: Array.isArray(e.overviewPhotos) ? e.overviewPhotos : [],
            notes: e.notes || null,
            defects: eDefects,
          };
        });
      }
    } else {
      // TRƯỜNG HỢP 2: Fallback cho dữ liệu legacy (chỉ có localDefects + upperFloorWaterLeakage)
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
          ctxPhotoCode: `${zCode}_CTX`,
          overviewPhotos: ctxUrl ? [ctxUrl] : [],
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

      // Thấm dột trần lầu trên upperFloorWaterLeakage (nếu có trong bản nháp cũ)
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
            componentType: 'SLAB',
            wallMaterial: 'Thạch cao / Sàn bê tông cốt thép lầu trên',
            functionalImpactRepairNeeded: true,
            burlandGrade: 1,
            ctxPhotoUrl: ctxUrl,
            ctxPhotoCode: `${zCode}_CTX`,
            overviewPhotos: ctxUrl ? [ctxUrl] : [],
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
    }

    return [
      {
        floorName,
        floorOrder: Number(floorNum) || 1,
        overviewPhotos: Array.isArray(surveyData?.overviewPhotos) ? surveyData.overviewPhotos : [],
        cadDrawingUrl: unitCadUrl,
        cadZonePins,
        cadStructuralDrawingUrl: structuralCadUrl,
        cadElementPins,
        hasStructuralElements,
        noStructuralElementsReason: surveyData?.noStructuralElementsReason || null,
        notes: `Khảo sát căn hộ ${unitCode} (Tầng ${floorNum})`,
        zones,
        structuralElements,
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

    // [CH-02] Zero Cross-Category Fallback Policy:
    // Ảnh đo độ võng dầm nội thất căn hộ (SAG-01) CHỈ được lưu vào beamSaggingPhotos,
    // TUYỆT ĐỐI KHÔNG nhân bản sang abnormalPhotos (ảnh hiện trạng bất thường ngoại quan P-07).
    const beamSaggingPhotos: Array<{ url: string; photoCode: string; caption: string }> = [];
    if (beamSagging?.photoUrl) {
      beamSaggingPhotos.push({
        url: beamSagging.photoUrl,
        photoCode: beamSagging.photoCode || 'SAG-01',
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
      abnormalPhotoCode: null,
      beamSaggingPhotoCode: beamSagging?.photoCode || (beamSaggingPhotos.length > 0 ? 'SAG-01' : null),
      diffSettlementPhotos: [],
      tiltPhotos: [],
      abnormalPhotos: [],
      beamSaggingPhotos,
      monitoringRequired: false,
      monitoringNotes: null,
      notes: [
        hasDoorJam ? `Cửa: ${doorJamming}` : null,
        hasSettle ? `Lún: ${settlementObserved} (${settlementNotes || ''})` : null,
        hasSag ? `Võng dầm: ${beamSagging.location} (f/L=${beamSagging.ratioText || 'N/A'})` : null,
      ].filter(Boolean).join('; '),
      detailsJson: {
        beamSagging,
        doorJammingStatus: doorJamming,
        settlementObserved,
        settlementNotes,
      },
    };
  }
}
