/**
 * ============================================================================
 * SCENARIO RESOLVER (METRO 2 BCS REPORT V2)
 * Phân giải 12 kịch bản hiện trường & thiết lập cờ điều phối tự động
 * ============================================================================
 */

import { ReportScenarioFlags } from '../report-v2.types';

export interface ResolvedScenarioContext {
  isAbsentee: boolean;
  isVacantLand: boolean;
  isUnderConstruction: boolean;
  isGisMerged: boolean;
  isGisSplit: boolean;
  isZeroDefects: boolean;
  isCriticalStructural: boolean;
  hasLaserTilt: boolean;
  hasStructuralCadMap: boolean;
  exteriorPhotoLayout: 'grid_6' | 'party_wall_3' | 'minimal_2' | 'vacant_land_grid';
}

export class ScenarioResolver {
  public static resolve(
    json: any = {},
    rawReport: any = {},
    appendix2: any[] = [],
    p02Url?: string,
    p03List: any[] = [],
    singleP03Url?: string,
    p05Url?: string
  ): ResolvedScenarioContext {
    const isAbsentee = Boolean(
      json.isAbsenteeSurvey ||
      rawReport.is_absentee_survey ||
      json.surveyCaseType === 'ABSENTEE'
    );

    const isVacantLand = Boolean(
      json.isVacantLand ||
      rawReport.is_vacant_land ||
      json.surveyCaseType === 'VACANT_LAND'
    );

    const isUnderConstruction = Boolean(
      json.surveyCaseType === 'UNDER_CONSTRUCTION' ||
      (Array.isArray(json.underConstructionPhotos) && json.underConstructionPhotos.length > 0) ||
      Boolean(json.constructionStageNotes && json.constructionStageNotes.trim())
    );

    const rawGisType = (json.gisMutationConfirmed?.type || json.gisMutationType || json.gis_mutation_type || rawReport.gis_mutation_type || 'MATCH').toUpperCase();
    const isGisMerged = rawGisType === 'MERGE' || rawGisType === 'MERGED';
    const isGisSplit = rawGisType === 'SPLIT';

    const hasAnyDefects = appendix2.some((f) => f.hasDefects);
    const isZeroDefects = !hasAnyDefects;

    const structuralFlag = (json.burlandSummary?.structuralFlagLevel || '').toUpperCase();
    const hasCriticalDefect = appendix2.some((fl) =>
      (fl.defectSummaryRows || []).some((d: any) =>
        (d.location?.vi?.includes('Cấu kiện') || d.defectType?.vi?.toLowerCase().includes('kết cấu')) &&
        d.burlandGrade >= 3
      )
    );
    const isCriticalStructural = structuralFlag === 'HIGH' || structuralFlag === 'CRITICAL' || hasCriticalDefect;

    const deform = json.settlementTilt || rawReport.deformation || {};
    const tilt = deform.buildingTilt || {};
    const hasLaserTilt = (
      (tilt.xPermille !== '' && tilt.xPermille !== undefined && tilt.xPermille !== null && !isNaN(Number(tilt.xPermille))) ||
      (tilt.yPermille !== '' && tilt.yPermille !== undefined && tilt.yPermille !== null && !isNaN(Number(tilt.yPermille))) ||
      (deform.tilt_angle_x !== undefined && deform.tilt_angle_x !== null)
    );

    const hasStructuralCadMap = appendix2.some((f) => f.hasStructuralCadMap);

    const hasMainFacadePhoto = Boolean(p02Url);
    const hasSideOrRearPhotos = p03List.length > 0 || Boolean(singleP03Url);
    const hasTiltPhoto = Boolean(p05Url);

    let exteriorPhotoLayout: 'grid_6' | 'party_wall_3' | 'minimal_2' | 'vacant_land_grid' = 'minimal_2';
    if (isVacantLand) {
      exteriorPhotoLayout = 'vacant_land_grid';
    } else if (hasSideOrRearPhotos) {
      exteriorPhotoLayout = 'grid_6';
    } else if (hasMainFacadePhoto) {
      exteriorPhotoLayout = 'party_wall_3';
    }

    return {
      isAbsentee,
      isVacantLand,
      isUnderConstruction,
      isGisMerged,
      isGisSplit,
      isZeroDefects,
      isCriticalStructural,
      hasLaserTilt,
      hasStructuralCadMap,
      exteriorPhotoLayout,
    };
  }

  public static toScenarioFlags(
    resolved: ResolvedScenarioContext,
    hasMainFacadePhoto: boolean,
    hasSideOrRearPhotos: boolean,
    hasTiltPhoto: boolean,
    hasStructuralCadMap: boolean,
    hasAnyDefects: boolean
  ): ReportScenarioFlags {
    return {
      isAbsenteeSurvey: resolved.isAbsentee,
      isVacantLand: resolved.isVacantLand,
      isUnderConstruction: resolved.isUnderConstruction,
      isGisMerged: resolved.isGisMerged,
      isGisSplit: resolved.isGisSplit,
      hasMainFacadePhoto,
      hasSideOrRearPhotos,
      hasTiltPhoto,
      hasStructuralCadMap,
      hasAnyDefects,
      exteriorPhotoLayout: resolved.exteriorPhotoLayout,
    };
  }
}
