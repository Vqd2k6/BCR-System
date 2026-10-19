/**
 * ============================================================================
 * REPORT CONSISTENCY GATE
 * Chốt chặn kiểm tra tính nhất quán dữ liệu trước khi Zone Admin phê duyệt (APPROVE)
 * Tách biệt thành pure module phục vụ kiểm thử đơn vị và ghi nhận nhật ký kiểm toán.
 * ============================================================================
 */

import { BadRequestError } from '../../../common/errors/problem-details';
import { RiskScoringCalculator } from '../../report_v2/mappers/risk-scoring-calculator';
import {
  classifyStructureSystem,
  v2ScoreForStructure,
} from '../../report_v2/mappers/structure-system.classifier';

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
  };
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
    const hasRoofScope = rawScope.roofTerrace ?? rawScope.roof;
    let roofRestricted = hasRoofScope === false;
    if (!roofRestricted && Array.isArray(rawLimitation.restrictedAreas)) {
      roofRestricted = rawLimitation.restrictedAreas.some((a: string) =>
        typeof a === 'string' &&
        (a.toLowerCase().includes('mái') ||
          a.toLowerCase().includes('sân thượng') ||
          a.toLowerCase().includes('roof'))
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

        if (isRoofFloor && Array.isArray(fl.defects) && fl.defects.length > 0) {
          hasRoofDefects = true;
          hardErrors.push(
            'Mâu thuẫn dữ liệu: Phạm vi tiếp cận ghi nhận "Mái / Sân thượng: Không tiếp cận" nhưng danh sách khảo sát lại có vết nứt/khuyết tật tại tầng mái/sân thượng. Vui lòng chuẩn hóa trước khi phê duyệt.'
          );
          break;
        }

        if (Array.isArray(fl.zones)) {
          for (const z of fl.zones) {
            const rName = (z.roomName || '').toLowerCase();
            const rNameEn = (z.roomNameEn || '').toLowerCase();
            const isRoofZone =
              isRoofFloor ||
              rName.includes('mái') ||
              rName.includes('sân thượng') ||
              rNameEn.includes('roof') ||
              rNameEn.includes('terrace');
            if (isRoofZone && Array.isArray(z.defects) && z.defects.length > 0) {
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
      const riskAssessment = RiskScoringCalculator.computeRiskAssessment(
        reportRow,
        surveyJson?.burlandSummary?.localMaxGrade ?? 0,
        surveyJson?.burlandSummary?.predominantGrade
      );
      ecsScore = riskAssessment.ecs?.totalScore ?? 0;
      const riskLevelVi =
        riskAssessment.braMatrix?.finalRiskLevel?.vi ||
        riskAssessment.overallRisk?.grade?.vi ||
        '';
      const riskLevelEn =
        riskAssessment.braMatrix?.finalRiskLevel?.en ||
        riskAssessment.overallRisk?.grade?.en ||
        '';
      braRiskLevel = riskLevelVi || riskLevelEn;
      const isLowRisk =
        riskLevelVi.includes('Thấp') || riskLevelEn.toLowerCase().includes('low');

      if (ecsScore >= 11 && isLowRisk) {
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
      console.error('[ReportConsistencyGate] Lỗi tính toán rủi ro phụ trợ khi thẩm định:', err);
    }

    // -------------------------------------------------------------------------
    // 3. SOFT INCONSISTENCY: Hệ kết cấu ↔ Chỉ số V2 (BRA)
    // -------------------------------------------------------------------------
    const specs = reportRow?.buildingSpecs || surveyJson || {};
    const rawStructSys =
      surveyJson?.structureSystem || specs.structuralType || specs.structural_system || '';
    const structClass = classifyStructureSystem(rawStructSys);
    const expectedV2 = v2ScoreForStructure(structClass);
    const recordedV2 =
      surveyJson?.vulnerabilityIndex?.v2 !== undefined
        ? Number(surveyJson.vulnerabilityIndex.v2)
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
