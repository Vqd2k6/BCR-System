/**
 * ============================================================================
 * REPORT CONSISTENCY GATE
 * Chốt chặn kiểm tra tính nhất quán dữ liệu trước khi Zone Admin phê duyệt (APPROVE)
 * Tách biệt thành pure module phục vụ kiểm thử đơn vị và ghi nhận nhật ký kiểm toán.
 * ============================================================================
 */

import { BadRequestError } from '../../../common/errors/problem-details';
import {
  classifyStructureSystem,
  v2ScoreForStructure,
} from '../../scoring/structure-system.classifier';

export interface ConsistencyGateResult {
  passed: boolean;
  hardErrors: string[];
  warnings: string[];
  details: {
    roofRestricted: boolean;
    hasRoofDefects: boolean;
    ecsScore?: number;
    braRiskLevel?: string;
    requiresEcsJudgement: boolean;
    structureSystemClass?: string;
    expectedV2Score?: number;
    recordedV2Score?: number;
    hasStructureV2Mismatch: boolean;
    hasEmptyPartialAccessNotes: boolean;
    hasGeometryMismatch?: boolean;
    keepKsvBoundaryAcknowledged?: boolean;
  };
}

function normalizePolygonRing(coords: unknown): [number, number][] {
  if (!Array.isArray(coords)) return [];
  const valid: [number, number][] = [];
  for (const pt of coords) {
    if (
      Array.isArray(pt) &&
      pt.length >= 2 &&
      Number.isFinite(Number(pt[0])) &&
      Number.isFinite(Number(pt[1]))
    ) {
      valid.push([Number(pt[0]), Number(pt[1])]);
    }
  }
  if (valid.length > 3) {
    const first = valid[0];
    const last = valid[valid.length - 1];
    if (Math.abs(first[0] - last[0]) < 1e-6 && Math.abs(first[1] - last[1]) < 1e-6) {
      return valid.slice(0, -1);
    }
  }
  return valid;
}

function arePolygonsDifferent(
  polyA: [number, number][],
  polyB: [number, number][],
  tolerance = 0.00001
): boolean {
  const ringA = normalizePolygonRing(polyA);
  const ringB = normalizePolygonRing(polyB);
  if (ringA.length < 3 || ringB.length < 3) return false;
  if (ringA.length !== ringB.length) return true;
  for (let i = 0; i < ringA.length; i++) {
    if (
      Math.abs(ringA[i][0] - ringB[i][0]) > tolerance ||
      Math.abs(ringA[i][1] - ringB[i][1]) > tolerance
    ) {
      return true;
    }
  }
  return false;
}

export class ReportConsistencyGate {
  /**
   * Đánh giá toàn bộ các điều kiện nhất quán của hồ sơ
   */
  public static evaluate(
    reportRow: any,
    surveyJson: any,
    judgementNotes?: string
  ): ConsistencyGateResult {
    const hardErrors: string[] = [];
    const warnings: string[] = [];

    const rawScope = surveyJson?.surveyScope || {};
    const rawLimitation = surveyJson?.accessLimitation || {};

    // -------------------------------------------------------------------------
    // 1. HARD INCONSISTENCY: Mái / Sân thượng không tiếp cận nhưng có khuyết tật
    // -------------------------------------------------------------------------
    // NGUYÊN TẮC: Số liệu KSV/Approved là tối cao - Tuyệt đối không tự sinh, suy luận hay sửa đổi
    // Nếu KSV khai báo FULL_100 (tiếp cận 100%), mặc nhiên KHÔNG có khu vực nào bị hạn chế.
    // Chỉ coi là hạn chế tiếp cận mái khi KSV CHÍNH THỨC khai báo LIMITED/PARTIAL/EXTERNAL_ONLY
    // và tick chọn hoặc ghi nhận cụ thể khu vực mái/sân thượng trong restrictedAreas.
    const isFullAccess = rawLimitation.type === 'FULL_100';
    let roofRestricted = false;

    if (!isFullAccess && Array.isArray(rawLimitation.restrictedAreas)) {
      roofRestricted = rawLimitation.restrictedAreas.some((a: string) =>
        typeof a === 'string' &&
        (a.toLowerCase().includes('mái') ||
          a.toLowerCase().includes('sân thượng') ||
          a.toLowerCase().includes('roof') ||
          a.toLowerCase().includes('terrace'))
      );
    }

    let hasRoofDefects = false;
    if (roofRestricted && Array.isArray(surveyJson?.floors)) {
      for (const fl of surveyJson.floors) {
        const flName = (fl.floorName || '').toLowerCase();
        const flNameEn = (fl.floorNameEn || '').toLowerCase();
        const isRoofFloor =
          flName.includes('mái') ||
          flName.includes('sân thượng') ||
          flNameEn.includes('roof') ||
          flNameEn.includes('terrace');

        const activeFloorDefects = Array.isArray(fl.defects)
          ? fl.defects.filter((d: any) => !d?.isDeleted && !d?.is_deleted)
          : [];
        if (isRoofFloor && activeFloorDefects.length > 0) {
          hasRoofDefects = true;
          hardErrors.push(
            'Mâu thuẫn dữ liệu: Phạm vi tiếp cận ghi nhận "Mái / Sân thượng: Không tiếp cận" nhưng danh sách khảo sát lại có vết nứt/khuyết tật tại tầng mái/sân thượng. Vui lòng chuẩn hóa trước khi phê duyệt.'
          );
          break;
        }

        if (Array.isArray(fl.zones)) {
          for (const z of fl.zones) {
            if (z?.isDeleted || z?.is_deleted) continue;
            const rName = (z.roomName || '').toLowerCase();
            const rNameEn = (z.roomNameEn || '').toLowerCase();
            const isRoofZone =
              isRoofFloor ||
              rName.includes('mái') ||
              rName.includes('sân thượng') ||
              rNameEn.includes('roof') ||
              rNameEn.includes('terrace');
            const activeZoneDefects = Array.isArray(z.defects)
              ? z.defects.filter((d: any) => !d?.isDeleted && !d?.is_deleted)
              : [];
            if (isRoofZone && activeZoneDefects.length > 0) {
              hasRoofDefects = true;
              hardErrors.push(
                `Mâu thuẫn dữ liệu: Phạm vi tiếp cận ghi nhận "Mái / Sân thượng: Không tiếp cận" nhưng khu vực khảo sát mái/sân thượng (${z.roomName || 'Sân thượng'}) có chứa khuyết tật. Vui lòng chuẩn hóa trước khi phê duyệt.`
              );
              break;
            }
          }
        }
        if (hasRoofDefects) break;
      }
    }

    // -------------------------------------------------------------------------
    // 2. SOFT INCONSISTENCY: ECS >= 11 (Kém/Nguy hiểm) nhưng BRA là Thấp
    // -------------------------------------------------------------------------
    let ecsScore: number | undefined;
    let braRiskLevel: string | undefined;
    let requiresEcsJudgement = false;

    try {
      const rawEcsTotal =
        surveyJson?.ecs?.totalScore ??
        reportRow?.riskScores?.total_ecs_score;
      ecsScore =
        rawEcsTotal !== undefined && rawEcsTotal !== null && !isNaN(Number(rawEcsTotal))
          ? Number(rawEcsTotal)
          : undefined;
      const riskLevelStr = String(
        surveyJson?.braMatrix?.finalRiskLevel ||
          surveyJson?.braMatrix?.riskGrade ||
          reportRow?.riskScores?.bra_risk_level ||
          ''
      );
      braRiskLevel = riskLevelStr || undefined;
      const isLowRisk =
        riskLevelStr.includes('Thấp') ||
        riskLevelStr.toLowerCase().includes('low') ||
        riskLevelStr.toUpperCase() === 'LOW';

      if (ecsScore !== undefined && ecsScore >= 11 && isLowRisk) {
        requiresEcsJudgement = true;
        const trimmedNotes = (judgementNotes || '').trim();
        if (trimmedNotes.length < 10) {
          hardErrors.push(
            'Cảnh báo mâu thuẫn chỉ số: Công trình có chỉ số hiện trạng ECS ≥ 11 (Kém / Nguy hiểm) nhưng mức đánh giá rủi ro cơ sở BRA là Thấp. Zone Admin bắt buộc phải nhập lý do giải trình chuyên môn (tối thiểu 10 ký tự) vào ô ghi chú thẩm định trước khi phê duyệt.'
          );
        } else {
          warnings.push(
            `Hồ sơ có ECS = ${ecsScore} (≥ 11) và rủi ro BRA Thấp: Đã giải trình chuyên môn ("${trimmedNotes.slice(0, 50)}...").`
          );
        }
      }
    } catch (err) {
      console.error('[ReportConsistencyGate] Lỗi kiểm tra rủi ro phụ trợ khi thẩm định:', err);
    }

    // -------------------------------------------------------------------------
    // 3. SOFT INCONSISTENCY: Hệ kết cấu ↔ Chỉ số V2 (BRA)
    // -------------------------------------------------------------------------
    const specs = reportRow?.buildingSpecs || surveyJson || {};
    const rawStructSys =
      surveyJson?.structureSystem || specs.structuralType || specs.structural_system || '';
    const structClass = classifyStructureSystem(rawStructSys);
    const expectedV2 = v2ScoreForStructure(structClass);
    const rawRecordedV2 =
      surveyJson?.vulnerabilityIndex?.v2 ??
      surveyJson?.vi?.v2 ??
      reportRow?.riskScores?.v2_structure_score;
    const recordedV2 =
      rawRecordedV2 !== undefined && rawRecordedV2 !== null
        ? Number(rawRecordedV2)
        : undefined;

    let hasStructureV2Mismatch = false;
    if (recordedV2 !== undefined && Number.isFinite(recordedV2) && recordedV2 !== expectedV2) {
      hasStructureV2Mismatch = true;
      warnings.push(
        `Cảnh báo hệ kết cấu: Điểm V2 được ghi nhận là ${recordedV2}, khác với điểm tính chuẩn theo hệ kết cấu "${rawStructSys}" [${structClass}] (kỳ vọng: ${expectedV2}).`
      );
    }

    // -------------------------------------------------------------------------
    // 4. SOFT INCONSISTENCY: Hạn chế tiếp cận PARTIAL nhưng không có ghi chú/khu vực
    // -------------------------------------------------------------------------
    let hasEmptyPartialAccessNotes = false;
    const isPartialAccess =
      rawLimitation.type === 'PARTIAL' ||
      rawLimitation.type === 'REFUSED';
    const notesStr = String(
      rawLimitation.notes || reportRow.accessibility_limitations || ''
    ).trim();
    const areas = Array.isArray(rawLimitation.restrictedAreas)
      ? rawLimitation.restrictedAreas
      : [];

    if (isPartialAccess && notesStr.length === 0 && areas.length === 0) {
      hasEmptyPartialAccessNotes = true;
      warnings.push(
        'Hạn chế tiếp cận được đánh dấu là "Hạn chế một phần / Từ chối" nhưng chưa có danh sách khu vực hoặc lý do cụ thể.'
      );
    }

    // -------------------------------------------------------------------------
    // 5. HARD INCONSISTENCY: Xung đột ranh đất GPMB giữa PostGIS và Survey JSON (Mục 01 - /grill-me)
    // -------------------------------------------------------------------------
    let hasGeometryMismatch = false;
    let keepKsvBoundaryAcknowledged = false;

    const rawGeo =
      reportRow?.cadastral_geojson ||
      reportRow?.parcel_polygon_geojson ||
      reportRow?.cadastralGeojson;

    let postgisRing: [number, number][] = [];
    if (rawGeo) {
      try {
        const parsed = typeof rawGeo === 'string' ? JSON.parse(rawGeo) : rawGeo;
        if (parsed && parsed.type === 'Polygon' && Array.isArray(parsed.coordinates?.[0])) {
          postgisRing = normalizePolygonRing(
            parsed.coordinates[0].map((pt: [number, number]) => [Number(pt[1]), Number(pt[0])])
          );
        }
      } catch (err) {
        console.error('[ReportConsistencyGate] Lỗi phân tích đa giác PostGIS:', err);
      }
    }

    const surveyRing = normalizePolygonRing(
      Array.isArray(surveyJson?.parcelCoordinates) && surveyJson.parcelCoordinates.length >= 3
        ? surveyJson.parcelCoordinates
        : surveyJson?.polygonCoords
    );

    if (postgisRing.length >= 3 && surveyRing.length >= 3) {
      if (arePolygonsDifferent(postgisRing, surveyRing, 0.00001)) {
        hasGeometryMismatch = true;
        const isKeepKsvConfirmed = surveyJson?.keepKsvBoundaryConfirmed === true;
        const ksvReasonStr = String(
          surveyJson?.keepKsvBoundaryReason || judgementNotes || ''
        ).trim();

        if (isKeepKsvConfirmed && ksvReasonStr.length >= 10) {
          keepKsvBoundaryAcknowledged = true;
          warnings.push(
            `[POSTGIS_GEOMETRY_MISMATCH_ACKNOWLEDGED] Đã xác nhận giữ ranh khảo sát thực địa của KSV kèm giải trình ("${ksvReasonStr.slice(0, 60)}").`
          );
        } else {
          hardErrors.push(
            '[POSTGIS_GEOMETRY_MISMATCH_UNACKNOWLEDGED] Phát hiện xung đột ranh đất GPMB: Đa giác ranh thửa trên CSDL PostGIS khác với ranh khảo sát trong hồ sơ nhưng chưa được đồng bộ hoặc xác nhận giữ ranh KSV kèm lý do giải trình (tối thiểu 10 ký tự).'
          );
        }
      }
    }

    return {
      passed: hardErrors.length === 0,
      hardErrors,
      warnings,
      details: {
        roofRestricted,
        hasRoofDefects,
        ecsScore,
        braRiskLevel,
        requiresEcsJudgement,
        structureSystemClass: structClass,
        expectedV2Score: expectedV2,
        recordedV2Score: recordedV2,
        hasStructureV2Mismatch,
        hasEmptyPartialAccessNotes,
        hasGeometryMismatch,
        keepKsvBoundaryAcknowledged,
      },
    };
  }

  /**
   * Chốt chặn ném ngoại lệ nếu có vi phạm cứng
   */
  public static assertConsistency(
    reportRow: any,
    surveyJson: any,
    judgementNotes?: string
  ): ConsistencyGateResult {
    const result = this.evaluate(reportRow, surveyJson, judgementNotes);
    if (!result.passed) {
      throw new BadRequestError(result.hardErrors.join(' '));
    }
    return result;
  }
}
