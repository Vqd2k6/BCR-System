/**
 * ============================================================================
 * REPORT V3 E2E & AUDIT CONSISTENCY TEST SUITE (42 TESTCASES / 8 DOMAINS)
 * Kiểm thử toàn diện 8 nghiệp vụ trọng tâm (42 testcases):
 *  - Nghiệp vụ 1: Luồng khóa Sửa trực tiếp & Bảo mật API / Phân quyền PII (TC1.1 - TC1.5)
 *  - Nghiệp vụ 2: Đồng bộ Thẩm định (Audit Studio) -> ScoringService -> ReportConsistencyGate (TC2.1 - TC2.5)
 *  - Nghiệp vụ 3: Đóng băng APPROVED_RELEASE Snapshot & Auto-Backfill (TC3.1 - TC3.5)
 *  - Nghiệp vụ 4: Quy tắc "100% Read-From-Approved" tại Mục VII (Burland) & Mục VIII (ECS/VI/BRA) (TC4.1 - TC4.5)
 *  - Nghiệp vụ 5: Quy tắc "100% Read-From-Approved" tại Mục I, II, VI, IX (TC5.1 - TC5.5)
 *  - Nghiệp vụ 6: Phụ lục 1-2, Xoay ảnh (photoRotations) & Tương thích giao diện 10 trang (TC6.1 - TC6.5)
 *  - Nghiệp vụ 7: Kiểm định 6 điểm rà soát sâu (100% Zero-Inference & Read-From-Approved) (TC7.1 - TC7.6)
 *  - Nghiệp vụ 8: Đóng kín 100% Field-Mapping Snapshot & Vòng đời Lưu trữ / Truy xuất Revision (TC8.1 - TC8.6)
 * ============================================================================
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { Database } from '../../../database/db';
import { ReportService } from '../../report/report.service';
import { ReportConfigService } from '../../report_config/report-config.service';
import { ReportV3Controller } from '../report-v3.controller';
import { ReportV3Service } from '../report-v3.service';
import { ReportReleaseService } from '../report-release.service';
import { ReportSnapshotSchema, type ReportSnapshot } from '../report-snapshot.schema';
import { ReportSnapshotService } from '../report-snapshot.service';
import { maskReportPii } from '../../../common/utils/pii.utils';
import { calculateVi } from '../../scoring/vi-calculator';
import { ReportConsistencyGate } from '../../audit/services/report-consistency-gate';
import { BurlandCalculator } from '../../report_v2/mappers/burland-calculator';
import { RiskScoringCalculator } from '../../report_v2/mappers/risk-scoring-calculator';
import { FloorDefectMapper } from '../../report_v2/mappers/floor-defect.mapper';
import { Section6DefectSummaryMapper } from '../../report_v2/mappers/sections/section-6-defect-summary.mapper';
import { Appendix1PhotoMapper } from '../../report_v2/mappers/appendices/appendix-1-photos.mapper';
import { ReportV2ViewModelMapper } from '../../report_v2/mappers/report-v2-viewmodel.mapper';
import { ReportV2Service } from '../../report_v2/report-v2.service';
import { ReportImageResolver } from '../../report_v2/services/report-image-resolver.service';

interface TestResult {
  id: string;
  domain: string;
  title: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(id: string, domain: string, title: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    results.push({ id, domain, title, passed: true });
    console.log(`  ✅ [${id}] ${title}`);
  } catch (err: any) {
    results.push({ id, domain, title, passed: false, error: err?.message || String(err) });
    console.error(`  ❌ [${id}] ${title} -> ${err?.message || err}`);
  }
}

const VALID_UUID_1 = '11111111-2222-3333-4444-555555555555';
const VALID_UUID_2 = '22222222-3333-4444-5555-666666666666';
const VALID_SHA256 = 'a'.repeat(64);

function createSampleApprovedReport(): any {
  return {
    id: VALID_UUID_1,
    report_code: 'BC-Z9-001',
    status: 'APPROVED',
    export_revision: 0,
    approved_at: '2026-05-15T08:00:00.000Z',
    survey_date: '2026-05-10T09:30:00.000Z',
    project_parcel_code: 'P001',
    official_cadastral_code: 'T12-TH34',
    zone_id: 'ZONE_09',
    segment_type: 'C&C',
    metro_segment_name: 'Zone 9: Ga S5 Lê Thị Riêng (C&C)',
    owner_name: 'Nguyễn Văn A',
    owner_phone: '0909123456',
    owner_signature_img: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    surveyor_name: 'Kỹ sư Trần B',
    surveyor_phone: '0912345678',
    zone_admin_name: 'Kỹ sư trưởng Lê C',
    house_number: '123/4',
    street: 'Cách Mạng Tháng Tám',
    ward: 'Phường Hòa Hưng',
    district: '',
    distance_to_centerline_m: 18.5,
    buildingSpecs: {
      aboveFloors: 3,
      undergroundFloors: 0,
      constructionYear: 2006,
      structural_system: 'Khung BTCT tường gạch chèn',
      foundation_category: 'Móng nông',
      foundation_cat_score: 3,
      foundationCatScore: 3,
      building_grade: 'GENERAL',
      land_use_function: 'Nhà ở riêng lẻ',
      buildingHeightM: 11.4,
    },
    deformation: {
      tilt_angle_x: 0.5,
      tilt_angle_y: 0.2,
      beam_deflection_mm: 0,
    },
    historicalSensitivity: {
      extended_or_renovated: false,
      previous_settlement_or_tilt: false,
      fire_or_accident: false,
      sensitive_equipment_present: false,
    },
    identificationPhotos: [],
    riskScores: {
      e1_burland_score: 1,
      e2_structure_score: 0,
      e3_deformation_score: 0,
      e4_material_score: 0,
      e5_history_score: 0,
      e6_overall_function_score: 0,
      total_ecs_score: 1,
      ecs_class: 'GOOD',
      v1_importance_score: 2,
      v2_structure_score: 2,
      v3_foundation_score: 2,
      v4_age_score: 2,
      v5_ecs_score: 1,
      v6_sensitivity_score: 1,
      avg_vi_score: 1.67,
      vi_class: 'MEDIUM',
      is_engineering_judgement_applied: false,
      engineering_judgement_action: 'KEEP',
      engineering_judgement_reason: '',
    },
    survey_data_json: {
      projectParcelCode: 'P001',
      officialCadastralCode: 'T12-TH34',
      ownerName: 'Nguyễn Văn A',
      ownerPhone: '0909123456',
      houseNumber: '123/4',
      street: 'Cách Mạng Tháng Tám',
      ward: 'Phường Hòa Hưng',
      aboveFloors: 3,
      undergroundFloors: 0,
      constructionYear: 2006,
      structureSystem: 'Khung BTCT tường gạch chèn',
      foundationType: 'Móng nông',
      foundationCatScore: 3,
      objectGroup: 'GENERAL',
      usageFunction: 'Nhà ở riêng lẻ',
      metroOffsetDistance: 18.5,
      gpsCoords: { lat: 10.781234, lng: 106.661234 },
      burlandSummary: {
        localMaxGrade: 2,
        predominantGrade: 0,
        governingZoneCode: 'Z-01',
        structuralFlagLevel: 'NONE',
        representativeness: 'LOCAL',
        needStructuralEngineerReview: false,
      },
      ecs: {
        e1: 1,
        e2: 0,
        e3: 0,
        e4: 0,
        e5: 0,
        e6: 0,
        totalEcs: 1,
        ecsClass: 'GOOD',
        engineeringJudgement: { action: 'KEEP', reason: '' },
      },
      vi: {
        v1: 2,
        v2: 2,
        v3: 2,
        v4: 2,
        v5: 1,
        v6: 1,
        totalVi: 10,
        viAvg: 1.67,
        viClass: 'MEDIUM',
        engineeringJudgement: { action: 'KEEP', reason: '' },
      },
      impactAssessment: {
        code: 'I2',
        iCode: 'I2',
        distanceM: 18.5,
        distanceType: 'TUNNEL_CENTERLINE',
        levelVi: 'Trung bình',
        levelEn: 'Medium',
      },
      braAssessment: {
        vCode: 'V2',
        iCode: 'I2',
        riskLevel: 'Medium',
        riskLevelVi: 'Rủi ro trung bình',
        riskLevelEn: 'Medium Risk',
      },
      floors: [
        {
          id: 'fl-1',
          floorName: 'Tầng trệt',
          requiresAdditionalMonitoring: true,
          beamDeflectionMm: 2.5,
          zones: [
            {
              id: 'zn-1',
              zoneCode: 'Z-01',
              roomName: 'Phòng khách',
              wallMaterial: 'Tường gạch trát vữa',
              burlandGrade: 2,
              defects: [
                {
                  id: 'def-1',
                  defectCode: 'D-01',
                  defectType: 'Vết nứt bề mặt tường',
                  widthMm: 2.0,
                  lengthM: 1.5,
                  hasScaleCard: true,
                  activityState: 'S',
                },
              ],
            },
            {
              id: 'zn-2',
              zoneCode: 'Z-02',
              roomName: 'Phòng bếp',
              wallMaterial: 'Tường gạch trát vữa',
              burlandGrade: 0,
              defects: [],
            },
          ],
          structuralElements: [
            {
              id: 'el-1',
              elementCode: 'E-01',
              roomName: 'Phòng khách',
              elementType: 'Cột BTCT',
              materialType: 'Bê tông cốt thép',
              defects: [],
            },
          ],
        },
      ],
      signatures: {
        ownerRepresentative: {
          fullName: 'Nguyễn Văn A',
          signatureImg: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        },
        workingMinutesPhotos: ['https://example.com/uploads/surveys/minutes1.jpg'],
      },
    },
  };
}

function createSampleSnapshot(rawReport: any): ReportSnapshot {
  return ReportSnapshotSchema.parse({
    schemaVersion: 2,
    reportId: VALID_UUID_1,
    approvedAt: '2026-05-15T08:00:00.000Z',
    approvedByUserId: VALID_UUID_2,
    ecs: {
      e1: 1,
      e2: 0,
      e3: 0,
      e4: 0,
      e5: 0,
      e6: 0,
      total: 1,
      ecsClass: 'GOOD',
      source: 'SURVEY_JSON',
    },
    vi: {
      v1: 2,
      v2: 2,
      v3: 2,
      v4: 2,
      v5: 1,
      v6: 1,
      total: 10,
      avg: 1.67,
      viClass: 'MEDIUM',
      foundationCat: 3,
      source: 'SURVEY_JSON',
    },
    burlandMaxGrade: 2,
    contentSha256: VALID_SHA256,
    exportRevision: 0,
    impact: {
      iCode: 'I2',
      distanceM: 18.5,
      distanceType: 'TUNNEL_CENTERLINE',
    },
    bra: {
      vCode: 'V2',
      iCode: 'I2',
      finalRiskLevelVi: 'Rủi ro trung bình',
      finalRiskLevelEn: 'Medium Risk',
      isOverridden: false,
      engineeringJudgementAction: 'KEEP',
      engineeringJudgementReason: '',
    },
    frozenParcel: {
      houseNumber: '123/4',
      street: 'Cách Mạng Tháng Tám',
      ward: 'Phường Hòa Hưng',
      district: '',
      ownerName: 'Nguyễn Văn A',
      ownerPhone: '0909123456',
      floorCount: 3,
      distanceToCenterlineM: 18.5,
      cadastralCode: 'T12-TH34',
      projectParcelCode: 'P001',
    },
    frozenSurveyDataJson: structuredClone(rawReport.survey_data_json),
    frozenReportData: {
      buildingSpecs: structuredClone(rawReport.buildingSpecs),
      deformation: structuredClone(rawReport.deformation),
      historicalSensitivity: structuredClone(rawReport.historicalSensitivity),
      identificationPhotos: structuredClone(rawReport.identificationPhotos),
      floors: structuredClone(rawReport.survey_data_json.floors),
      damageZones: [],
      riskScores: structuredClone(rawReport.riskScores),
    },
  });
}

async function main() {
  console.log('============================================================================');
  console.log('BẮT ĐẦU KIỂM THỬ E2E PHÂN HỆ REPORT V3 NHÀ DÂN (42 TESTCASES / 8 NGHIỆP VỤ)');
  console.log('============================================================================\n');

  // ============================================================================
  // NGHIỆP VỤ 1: LUỒNG KHÓA SỬA TRỰC TIẾP & BẢO MẬT API / PHÂN QUYỀN PII
  // ============================================================================
  console.log('▶ Nghiệp vụ 1: Luồng khóa Sửa trực tiếp & Bảo mật API / Phân quyền PII');

  await runTest(
    'TC1.1',
    'Nghiệp vụ 1',
    'Chặn hoàn toàn API sửa dữ liệu trực tiếp PUT/PATCH /reports/:id/survey-data với HTTP 403 ForbiddenError',
    async () => {
      const origResolve = ReportService.resolveReport;
      try {
        ReportService.resolveReport = async () => createSampleApprovedReport();
        await assert.rejects(
          async () => {
            await ReportService.updateReportSurveyData(VALID_UUID_1, {
              ownerName: 'Hacked Owner',
            });
          },
          (err: any) => {
            assert.equal(err.status, 403);
            assert.match(err.detail || err.message, /Thẩm định \(Audit Studio\)/);
            return true;
          }
        );
      } finally {
        ReportService.resolveReport = origResolve;
      }
    }
  );

  await runTest(
    'TC1.2',
    'Nghiệp vụ 1',
    'ReportV3Controller.previewHtml vô hiệu hóa hoàn toàn payload overrides từ body request',
    async () => {
      let capturedOverrides: unknown = 'NOT_CALLED';
      const origResolve = ReportV3Service.resolve;
      const origRenderDraft = ReportV3Service.renderDraftHtml;
      try {
        (ReportV3Service as any).resolve = async () => ({
          id: VALID_UUID_1,
          status: 'UNDER_REVIEW',
          zoneId: 'ZONE_09',
          exportRevision: 0,
          approvedAt: null,
          raw: createSampleApprovedReport(),
        });
        (ReportV3Service as any).renderDraftHtml = async (
          _resolved: any,
          overrides: unknown,
          _maskPii: boolean,
          _wm: boolean
        ) => {
          capturedOverrides = overrides;
          return { html: '<html>ok</html>', viewModel: { metadata: { reportNo: 'BC-Z9-001', buildingId: 'P001' } } };
        };

        const req: any = {
          params: { id: VALID_UUID_1 },
          query: {},
          body: { overrides: { ownerName: 'Injected Override Name', aboveFloors: 99 } },
          user: { userId: VALID_UUID_2, role: 'ZONE_ADMIN', assignedZones: ['ZONE_09'] },
        };
        const res: any = {
          setHeader: () => {},
          status: () => res,
          send: () => res,
        };
        await ReportV3Controller.previewHtml(req, res, (e) => {
          if (e) throw e;
        });
        assert.equal(capturedOverrides, undefined, 'overrides truyền xuống ReportV3Service phải là undefined');
      } finally {
        (ReportV3Service as any).resolve = origResolve;
        (ReportV3Service as any).renderDraftHtml = origRenderDraft;
      }
    }
  );

  await runTest(
    'TC1.3',
    'Nghiệp vụ 1',
    'maskReportPii che dấu 100% thông tin nhạy cảm (PII) cho vai trò GUEST nhưng giữ nguyên điểm kỹ thuật',
    () => {
      const report = createSampleApprovedReport();
      const masked = maskReportPii(report);
      assert.equal(masked.owner_name, 'Nguyễn V*** A');
      assert.equal(masked.owner_phone, '090****456');
      assert.equal(masked.owner_signature_img, null);
      assert.equal(masked.survey_data_json.ownerName, 'Nguyễn V*** A');
      assert.equal(masked.survey_data_json.ownerPhone, '090****456');
      assert.deepEqual(masked.survey_data_json.signatures.workingMinutesPhotos, []);
      assert.equal(masked.survey_data_json.ecs.totalEcs, 1);
      assert.equal(masked.survey_data_json.vi.viAvg, 1.67);
    }
  );

  await runTest(
    'TC1.4',
    'Nghiệp vụ 1',
    'ReportV2Service.generateResidentialHtmlFromReport gắn cờ isDraft & watermark DRAFT đúng theo trạng thái APPROVED vs UNDER_REVIEW',
    async () => {
      const draftReport = createSampleApprovedReport();
      draftReport.status = 'UNDER_REVIEW';
      const draftRes = await ReportV2Service.generateResidentialHtmlFromReport(draftReport, undefined, false, false);
      assert.ok(
        draftRes.html.includes('DRAFT – KHÔNG CÓ GIÁ TRỊ PHÁP LÝ'),
        'Bản xem trước ở trạng thái UNDER_REVIEW phải hiển thị watermark DRAFT'
      );

      const approvedReport = createSampleApprovedReport();
      approvedReport.status = 'APPROVED';
      const finalRes = await ReportV2Service.generateResidentialHtmlFromReport(approvedReport, undefined, false, false);
      assert.ok(
        !finalRes.html.includes('<div class="draft-watermark"'),
        'Bản chính thức APPROVED không được có thẻ draft-watermark'
      );
    }
  );

  await runTest(
    'TC1.5',
    'Nghiệp vụ 1',
    'ReportV3Service.renderDraftHtml luôn ưu tiên nạp Snapshot bất biến đối với hồ sơ đã APPROVED',
    async () => {
      const origGetLatest = ReportSnapshotService.getLatestApprovedSnapshot;
      try {
        const snapshotReport = createSampleApprovedReport();
        const frozenSnap = createSampleSnapshot(snapshotReport);
        frozenSnap.ecs.total = 2;
        frozenSnap.ecs.e1 = 2;
        frozenSnap.frozenSurveyDataJson = {
          ...snapshotReport.survey_data_json,
          ownerName: 'Tên Chủ Hộ Đã Chốt Snapshot',
        };
        frozenSnap.frozenParcel = {
          ...frozenSnap.frozenParcel,
          ownerName: 'Tên Chủ Hộ Đã Chốt Snapshot',
        };

        (ReportSnapshotService as any).getLatestApprovedSnapshot = async () => ({
          versionId: 'v-1',
          snapshot: frozenSnap,
        });

        // Giả lập bản ghi live bị sửa tên chủ hộ sau khi đã duyệt
        const mutatedLiveRaw = createSampleApprovedReport();
        mutatedLiveRaw.owner_name = 'Tên Bị Thay Đổi Trái Phép';
        mutatedLiveRaw.survey_data_json.ownerName = 'Tên Bị Thay Đổi Trái Phép';

        const rendered = await ReportV3Service.renderDraftHtml(
          {
            id: mutatedLiveRaw.id,
            status: 'APPROVED',
            zoneId: 'ZONE_09',
            exportRevision: 0,
            approvedAt: '2026-05-15T08:00:00.000Z',
            raw: mutatedLiveRaw,
          },
          { ownerName: 'Override Name' },
          false,
          false
        );

        assert.equal(rendered.viewModel.section1.ownerName, 'Tên Chủ Hộ Đã Chốt Snapshot');
        assert.equal(rendered.viewModel.section8.ecs.totalScore, 2);
      } finally {
        (ReportSnapshotService as any).getLatestApprovedSnapshot = origGetLatest;
      }
    }
  );

  // ============================================================================
  // NGHIỆP VỤ 2: ĐỒNG BỘ THẨM ĐỊNH -> SCORINGSERVICE -> REPORTCONSISTENCYGATE
  // ============================================================================
  console.log('\n▶ Nghiệp vụ 2: Đồng bộ Thẩm định (Audit Studio) -> ScoringService -> ReportConsistencyGate');

  await runTest(
    'TC2.1',
    'Nghiệp vụ 2',
    'calculateVi tôn trọng 100% adminOverrides (v1..v6) từ Audit Studio thay vì ghi đè bằng điểm tự tính',
    () => {
      const res = calculateVi({
        objectGroup: 'GENERAL',
        structureSystem: 'Khung BTCT chịu lực',
        foundationCatScore: 1,
        constructionYear: 2022,
        ecsClass: 'GOOD',
        adminOverrides: {
          v1: 3,
          v2: 3,
          v3: 4,
          v4: 3,
          v5: 2,
          v6: 3,
        },
      });
      assert.equal(res.v1, 3);
      assert.equal(res.v2, 3);
      assert.equal(res.v3, 4);
      assert.equal(res.v4, 3);
      assert.equal(res.v5, 2);
      assert.equal(res.v6, 3);
      assert.equal(res.viAvg, 3.0);
      assert.equal(res.viClass, 'HIGH');
    }
  );

  await runTest(
    'TC2.2',
    'Nghiệp vụ 2',
    'calculateVi phân loại điểm V2 đồng nhất 100% với classifyStructureSystem (RC=1, MIXED/STEEL=2, MASONRY=3, SUBSTANDARD=4)',
    () => {
      const rcFrame = calculateVi({
        structureSystem: 'Khung BTCT chịu lực',
        foundationCatScore: 2,
        constructionYear: 2020,
        ecsClass: 'GOOD',
      });
      const mixedOrSteel = calculateVi({
        structureSystem: 'Kết cấu hỗn hợp (BTCT kết hợp thép)',
        foundationCatScore: 2,
        constructionYear: 2020,
        ecsClass: 'GOOD',
      });
      const masonry = calculateVi({
        structureSystem: 'Tường gạch chịu lực',
        foundationCatScore: 2,
        constructionYear: 2020,
        ecsClass: 'GOOD',
      });
      const weak = calculateVi({
        structureSystem: 'Nhà tạm gỗ tôn kém ổn định',
        foundationCatScore: 2,
        constructionYear: 2020,
        ecsClass: 'GOOD',
      });

      assert.equal(rcFrame.v2, 1);
      assert.equal(mixedOrSteel.v2, 2);
      assert.equal(masonry.v2, 3);
      assert.equal(weak.v2, 4);
    }
  );

  await runTest(
    'TC2.3',
    'Nghiệp vụ 2',
    'ReportConsistencyGate, BurlandCalculator & FloorDefectMapper lọc bỏ hoàn toàn vùng Z và khuyết tật D đã xóa mềm (isDeleted / is_deleted)',
    () => {
      const report = createSampleApprovedReport();
      // Giả sử mái/sân thượng bị hạn chế tiếp cận
      report.survey_data_json.accessLimitation = {
        type: 'PARTIAL',
        restrictedAreas: ['Sân thượng / Mái'],
        notes: 'Cửa lên sân thượng bị khóa',
      };
      // Thêm 1 vùng Sân thượng có khuyết tật nhưng đã bị xóa mềm trong Audit Studio
      report.survey_data_json.floors[0].zones.push({
        id: 'zn-deleted',
        zoneCode: 'Z-99',
        roomName: 'Sân thượng',
        isDeleted: true,
        is_deleted: true,
        defects: [{ id: 'def-del-2', defectCode: 'D-98', widthMm: 28.0 }],
      });
      // Thêm 1 khuyết tật cấp 5 (wmax = 30mm) vào Z-01 nhưng đã bị xóa mềm
      report.survey_data_json.floors[0].zones[0].defects.push({
        id: 'def-deleted',
        defectCode: 'D-99',
        defectType: 'Nứt xuyên tường nghiêm trọng',
        widthMm: 30.0,
        lengthM: 3.0,
        isDeleted: true,
        is_deleted: true,
      });

      const gateResult = ReportConsistencyGate.evaluate(report, report.survey_data_json);
      assert.equal(gateResult.passed, true, `ConsistencyGate phải pass nhưng gặp lỗi: ${JSON.stringify(gateResult.hardErrors)}`);

      const burland = BurlandCalculator.computeBurlandSection(
        report.survey_data_json.floors,
        report.survey_data_json.burlandSummary
      );
      assert.equal(burland.zones?.length, 2, 'Chỉ giữ lại 2 vùng Z đang active');

      const mappedFloors = FloorDefectMapper.mapFloors(report.survey_data_json.floors);
      assert.equal(mappedFloors[0].defectSummaryRows.length, 1, 'Chỉ giữ lại 1 khuyết tật D-01 đang active');
    }
  );

  await runTest(
    'TC2.4',
    'Nghiệp vụ 2',
    'Khuyết tật trên cấu kiện chịu lực (E-01) được ánh xạ đầy đủ vào Burland Section VII.4, Phụ lục 2 và Mục VI',
    () => {
      const report = createSampleApprovedReport();
      report.survey_data_json.floors[0].structuralElements[0].defects = [
        {
          id: 'def-e1',
          defectCode: 'D-02',
          defectType: 'Nứt dọc thân cột BTCT',
          widthMm: 6.0,
          lengthM: 1.2,
          burlandGrade: 3,
        },
      ];

      const burland = BurlandCalculator.computeBurlandSection(
        report.survey_data_json.floors,
        { ...report.survey_data_json.burlandSummary, localMaxGrade: 3 }
      );
      assert.equal(burland.structuralElements?.length, 1);
      assert.equal(burland.structuralElements?.[0].defectCount, 1);
      assert.match(burland.structuralElements?.[0].conditionVi || '', /wmax = 6 mm/);

      const appendix2 = FloorDefectMapper.mapFloors(report.survey_data_json.floors);
      assert.equal(appendix2[0].defectSummaryRows.length, 2);
      const sec6Res = Section6DefectSummaryMapper.map(appendix2, report, report.survey_data_json);
      assert.equal(sec6Res.structuralCracksCount, 1);
      assert.equal(sec6Res.surfaceCracksCount, 1);
    }
  );

  await runTest(
    'TC2.5',
    'Nghiệp vụ 2',
    'ReportConsistencyGate phát hiện chính xác mâu thuẫn ECS >= 11 nhưng BRA Thấp khi chưa có giải trình Kỹ sư trưởng, và cho phép vượt qua khi có giải trình hợp lệ',
    () => {
      const conflictReport = createSampleApprovedReport();
      conflictReport.survey_data_json.ecs.totalEcs = 12;
      conflictReport.survey_data_json.ecs.ecsClass = 'DEFICIENT';
      conflictReport.survey_data_json.vi.viAvg = 1.33;
      conflictReport.survey_data_json.vi.viClass = 'LOW';
      conflictReport.survey_data_json.impactAssessment = { code: 'I1', iCode: 'I1', distanceM: 35.0, distanceType: 'TUNNEL_CENTERLINE' };
      conflictReport.survey_data_json.braAssessment = {
        vCode: 'V1',
        iCode: 'I1',
        riskLevelVi: 'Rủi ro thấp',
        riskLevelEn: 'Low Risk',
      };

      const failRes = ReportConsistencyGate.evaluate(conflictReport, conflictReport.survey_data_json, '');
      assert.equal(failRes.passed, false);
      assert.equal(failRes.details.requiresEcsJudgement, true);

      // Khi có giải trình chuyên môn hợp lệ (>= 10 ký tự)
      const passRes = ReportConsistencyGate.evaluate(
        conflictReport,
        conflictReport.survey_data_json,
        'Công trình nằm cách tâm hầm 35m ngoài vùng ảnh hưởng chính nên giữ BRA Thấp'
      );
      assert.equal(passRes.passed, true, `Phải cho phép khi có giải trình hợp lệ: ${JSON.stringify(passRes.hardErrors)}`);
    }
  );

  // ============================================================================
  // NGHIỆP VỤ 3: ĐÓNG BĂNG APPROVED_RELEASE SNAPSHOT & AUTO-BACKFILL
  // ============================================================================
  console.log('\n▶ Nghiệp vụ 3: Đóng băng APPROVED_RELEASE Snapshot & Auto-Backfill');

  await runTest(
    'TC3.1',
    'Nghiệp vụ 3',
    'ReportSnapshotSchema xác thực đầy đủ cấu trúc mở rộng (schemaVersion 2, ecs, vi, impact, bra, pinnedConfig, frozenReportData)',
    () => {
      const rawReport = createSampleApprovedReport();
      const parsed = createSampleSnapshot(rawReport);
      assert.equal(parsed.schemaVersion, 2);
      assert.equal(parsed.impact?.iCode, 'I2');
      assert.equal(parsed.bra?.finalRiskLevelVi, 'Rủi ro trung bình');
      assert.equal((parsed.frozenReportData?.buildingSpecs as any)?.aboveFloors, 3);
    }
  );

  await runTest(
    'TC3.2',
    'Nghiệp vụ 3',
    'ReportSnapshotService.applySnapshotToReport khôi phục 100% dữ liệu đóng băng bất chấp dữ liệu bảng live bị thay đổi',
    () => {
      const original = createSampleApprovedReport();
      const snapshot = createSampleSnapshot(original);

      // Giả lập bảng live bị chỉnh sửa sau khi đã APPROVED
      const mutatedLive = createSampleApprovedReport();
      mutatedLive.buildingSpecs.aboveFloors = 9;
      mutatedLive.survey_data_json.aboveFloors = 9;
      mutatedLive.survey_data_json.ward = 'Phường Bị Sửa';

      const restored: any = ReportSnapshotService.applySnapshotToReport(mutatedLive, snapshot);
      assert.equal(restored.buildingSpecs.aboveFloors, 3);
      assert.equal(restored.survey_data_json.aboveFloors, 3);
      assert.equal(restored.survey_data_json.ward, 'Phường Hòa Hưng');
      assert.equal(restored.survey_data_json.impactAssessment.code, 'I2');
      assert.equal(restored.survey_data_json.braAssessment.riskLevelVi, 'Rủi ro trung bình');
    }
  );

  await runTest(
    'TC3.3',
    'Nghiệp vụ 3',
    'ReportV3Service.buildFinalReport tạo ra ViewModel bất biến 100% giữa thời điểm phê duyệt và các lần xuất lại',
    () => {
      const original = createSampleApprovedReport();
      const snapshot = createSampleSnapshot(original);

      const finalReport1 = ReportV3Service.buildFinalReport(
        { id: original.id, status: 'APPROVED', zoneId: 'ZONE_09', exportRevision: 0, approvedAt: original.approved_at, raw: original },
        snapshot,
        0
      );
      const vm1 = ReportV2ViewModelMapper.buildViewModel(finalReport1);

      const mutated = createSampleApprovedReport();
      mutated.buildingSpecs.aboveFloors = 10;
      mutated.survey_data_json.ecs.totalEcs = 22;
      const finalReport2 = ReportV3Service.buildFinalReport(
        { id: mutated.id, status: 'APPROVED', zoneId: 'ZONE_09', exportRevision: 0, approvedAt: mutated.approved_at, raw: mutated },
        snapshot,
        0
      );
      const vm2 = ReportV2ViewModelMapper.buildViewModel(finalReport2);

      assert.equal(vm1.section2.storeysAbove, vm2.section2.storeysAbove);
      assert.equal(vm1.section8.ecs.totalScore, vm2.section8.ecs.totalScore);
      assert.equal(vm1.section8.overallRisk.grade.vi, vm2.section8.overallRisk.grade.vi);
    }
  );

  await runTest(
    'TC3.4',
    'Nghiệp vụ 3',
    'Tương thích ngược (Backward Compatibility) với các bản ghi Snapshot v1 cũ chưa có trường impact, bra, frozenReportData',
    () => {
      const legacySnapshot = ReportSnapshotSchema.parse({
        schemaVersion: 1,
        reportId: VALID_UUID_1,
        approvedAt: '2026-01-01T00:00:00.000Z',
        approvedByUserId: VALID_UUID_2,
        ecs: {
          e1: 1,
          e2: 1,
          e3: 0,
          e4: 0,
          e5: 0,
          e6: 0,
          total: 2,
          ecsClass: 'GOOD',
          source: 'SURVEY_JSON',
        },
        vi: {
          v1: 2,
          v2: 2,
          v3: 2,
          v4: 2,
          v5: 1,
          v6: 1,
          total: 10,
          avg: 1.67,
          viClass: 'MEDIUM',
          foundationCat: 3,
          source: 'SURVEY_JSON',
        },
        burlandMaxGrade: 2,
        contentSha256: VALID_SHA256,
      });

      const applied: any = ReportSnapshotService.applySnapshotToReport(createSampleApprovedReport(), legacySnapshot);
      assert.equal(applied.survey_data_json.ecs.totalEcs, 2);
      assert.equal(applied.survey_data_json.ecs.e2, 1);
      assert.equal(applied.survey_data_json.vi.viAvg, 1.67);
    }
  );

  await runTest(
    'TC3.5',
    'Nghiệp vụ 3',
    'ReportSnapshotService.buildSnapshot tự động tính và khóa chính xác Impact (STATION_EDGE vs TUNNEL_CENTERLINE) và BRA Matrix',
    async () => {
      const origGetConfig = (await import('../../report_config/report-config.service')).ReportConfigService.getActiveConfig;
      try {
        const rep = createSampleApprovedReport();
        rep.survey_data_json.stationEdgeDistance = 8.0; // GENERAL + 8m -> I3 (Cao)
        delete rep.survey_data_json.impactAssessment;
        delete rep.survey_data_json.braAssessment;

        (await import('../../report_config/report-config.service')).ReportConfigService.getActiveConfig = async () =>
          ({
            standardTextVersionNumber: 1,
            standardText: { recommendations: [], pendingItems: [], asteriskFootnote: null },
            equipment: [],
          }) as any;

        const mockClient: any = {
          query: async (sql: string) => {
            if (sql.includes('FROM base_survey_reports WHERE id = $1')) {
              return {
                rows: [
                  {
                    id: rep.id,
                    parcel_id: VALID_UUID_2,
                    export_revision: 0,
                    report_code: rep.report_code,
                    survey_data_json: rep.survey_data_json,
                  },
                ],
              };
            }
            if (sql.includes('FROM risk_score_cards')) {
              return { rows: [rep.riskScores] };
            }
            if (sql.includes('MAX(burland_grade)')) {
              return { rows: [{ max_burland: 2 }] };
            }
            if (sql.includes('FROM parcels p')) {
              return {
                rows: [
                  {
                    house_number: rep.house_number,
                    street: rep.street,
                    ward: rep.ward,
                    district: rep.district,
                    owner_name: rep.owner_name,
                    owner_phone: rep.owner_phone,
                    land_area_m2: 80,
                    construction_area_m2: 65,
                    floor_count: 3,
                    building_type: 'RESIDENTIAL',
                    official_cadastral_code: rep.official_cadastral_code,
                    project_parcel_code: rep.project_parcel_code,
                    distance_to_centerline_m: 18.5,
                    parcel_side_a_m: 5.0,
                    parcel_side_b_m: 16.0,
                    polygon_geojson: null,
                  },
                ],
              };
            }
            return { rows: [] };
          },
        };

        const built = await ReportSnapshotService.buildSnapshot(
          mockClient,
          rep.id,
          VALID_UUID_2,
          new Date('2026-05-15T08:00:00.000Z'),
          0
        );
        assert.equal(built.impact?.distanceType, 'STATION_EDGE');
        assert.equal(built.impact?.distanceM, 8);
        assert.equal(built.impact?.iCode, 'I3');
        assert.equal(built.bra?.vCode, 'V2');
        assert.equal(built.bra?.iCode, 'I3');
        assert.equal(built.bra?.finalRiskLevelVi, 'Rủi ro trung bình');
      } finally {
        (await import('../../report_config/report-config.service')).ReportConfigService.getActiveConfig = origGetConfig;
      }
    }
  );

  // ============================================================================
  // NGHIỆP VỤ 4: QUY TẮC "100% READ-FROM-APPROVED" TẠI MỤC VII (BURLAND) & MỤC VIII (ECS/VI/BRA)
  // ============================================================================
  console.log('\n▶ Nghiệp vụ 4: Quy tắc "100% Read-From-Approved" tại Mục VII (Burland) & Mục VIII (ECS/VI/BRA)');

  await runTest(
    'TC4.1',
    'Nghiệp vụ 4',
    'BurlandCalculator đọc 100% localMaxGrade & predominantGrade đã chốt trong burlandSummary mà không dùng Math.max ghi đè',
    () => {
      const floors = [
        {
          floorName: 'Tầng trệt',
          zones: [
            {
              zoneCode: 'Z-01',
              roomName: 'Phòng khách',
              burlandGrade: 1,
              defects: [{ defectCode: 'D-01', widthMm: 3.5 }], // nếu tự tính theo 3.5mm sẽ là Cấp 2, nhưng Admin đã chốt Cấp 1
            },
          ],
        },
      ];
      const section7 = BurlandCalculator.computeBurlandSection(floors, {
        localMaxGrade: 1,
        predominantGrade: 1,
        governingZoneCode: 'Z-01',
        structuralFlagLevel: 'NONE',
      });

      assert.match(section7.localMaxGrade.vi, /Cấp 1 - Rất nhẹ/);
      assert.match(section7.predominantGrade.vi, /Cấp 1 - Rất nhẹ/);
      assert.equal(section7.zones?.[0].burlandGrade, 1);
    }
  );

  await runTest(
    'TC4.2',
    'Nghiệp vụ 4',
    'BurlandCalculator tôn trọng tuyệt đối governingZoneCode đã chốt trong burlandSummary',
    () => {
      const floors = [
        {
          floorName: 'Tầng trệt',
          zones: [
            { zoneCode: 'Z-01', roomName: 'Phòng khách', defects: [{ defectCode: 'D-01', widthMm: 2.0 }] },
            { zoneCode: 'Z-02', roomName: 'Phòng ngủ', defects: [{ defectCode: 'D-02', widthMm: 1.5 }] },
          ],
        },
      ];
      const section7 = BurlandCalculator.computeBurlandSection(floors, {
        localMaxGrade: 2,
        predominantGrade: 2,
        governingZoneCode: 'Z-02',
      });

      assert.match(section7.governingZone.vi, /^Z-02 – Tầng trệt \(Phòng ngủ\)/);
    }
  );

  await runTest(
    'TC4.3',
    'Nghiệp vụ 4',
    'RiskScoringCalculator đọc trực tiếp e1, e2, totalEcs, ecsClass đã duyệt mà không dùng Math.max nâng điểm ngầm',
    () => {
      const report = createSampleApprovedReport();
      // Giả sử KSV/Admin chốt e1=0, e2=0, totalEcs=2 (hạ cấp có phán quyết) dù burlandMaxGrade=3
      report.survey_data_json.ecs = {
        e1: 0,
        e2: 0,
        e3: 1,
        e4: 1,
        e5: 0,
        e6: 0,
        totalEcs: 2,
        ecsClass: 'GOOD',
        engineeringJudgement: { action: 'DOWNGRADE', reason: 'Vết nứt vữa bề mặt đã ổn định' },
      };

      const section8 = RiskScoringCalculator.computeRiskAssessment(report, 3, 1, false);
      assert.equal(section8.ecs.items.find((i) => i.code === 'E1')?.score, 0);
      assert.equal(section8.ecs.items.find((i) => i.code === 'E2')?.score, 0);
      assert.equal(section8.ecs.totalScore, 2);
      assert.equal(section8.ecs.classGrade.en, 'Good');
      assert.equal(section8.ecs.engineeringJudgement?.action, 'DOWNGRADE');
    }
  );

  await runTest(
    'TC4.4',
    'Nghiệp vụ 4',
    'RiskScoringCalculator khóa cứng tuổi công trình (V4) theo năm phê duyệt/khảo sát của hồ sơ, không bị trôi theo new Date().getFullYear()',
    () => {
      const report = createSampleApprovedReport();
      report.approved_at = '2026-05-15T08:00:00.000Z';
      report.buildingSpecs.constructionYear = 2018; // Tại năm 2026: 2026 - 2018 = 8 năm (<10 năm -> V4 = 1đ)
      report.survey_data_json.constructionYear = 2018;
      delete report.survey_data_json.vi.v4;
      delete report.riskScores.v4_age_score;

      const section8 = RiskScoringCalculator.computeRiskAssessment(report, 2, 0, false);
      const v4Item = section8.vi.items.find((i) => i.code === 'V4');
      assert.equal(v4Item?.score, 1);
      assert.match(v4Item?.basis.vi || '', /~8 năm/);
    }
  );

  await runTest(
    'TC4.5',
    'Nghiệp vụ 4',
    'RiskScoringCalculator hỗ trợ đầy đủ CUSTOM_OVERRIDE trong Engineering Judgement và đánh dấu checkbox trên template Trang 7',
    async () => {
      const report = createSampleApprovedReport();
      report.riskScores.is_engineering_judgement_applied = true;
      report.riskScores.engineering_judgement_action = 'CUSTOM_OVERRIDE';
      report.riskScores.engineering_judgement_reason = 'Điều chỉnh điểm chuyên môn theo biên bản thẩm định hiện trường';
      report.survey_data_json.ecs.engineeringJudgement = {
        action: 'CUSTOM_OVERRIDE',
        reason: 'Điều chỉnh điểm chuyên môn theo biên bản thẩm định hiện trường',
      };

      const section8 = RiskScoringCalculator.computeRiskAssessment(report, 2, 0, false);
      assert.equal(section8.ecs.engineeringJudgement?.isApplied, true);
      assert.equal(section8.ecs.engineeringJudgement?.action, 'CUSTOM_OVERRIDE');

      const { html } = await ReportV2Service.generateResidentialHtmlFromReport(report, undefined, false, false);
      assert.ok(html.includes('Điều chỉnh điểm chuyên môn theo biên bản thẩm định hiện trường'));
    }
  );

  // ============================================================================
  // NGHIỆP VỤ 5: QUY TẮC "100% READ-FROM-APPROVED" TẠI MỤC I, II, VI, IX
  // ============================================================================
  console.log('\n▶ Nghiệp vụ 5: Quy tắc "100% Read-From-Approved" tại Mục I, II, VI, IX');

  await runTest(
    'TC5.1',
    'Nghiệp vụ 5',
    'Mục I (Section1And2Mapper) giữ nguyên 100% tên Phường đã chốt trong hồ sơ APPROVED mà không tự chạy lại bộ đổi tên phường khi render',
    () => {
      const report = createSampleApprovedReport();
      report.status = 'APPROVED';
      report.survey_data_json.houseNumber = '45A';
      report.survey_data_json.street = 'Lý Thường Kiệt';
      report.survey_data_json.ward = 'Phường Tân Sơn Nhất (Đã Duyệt)';

      const vm = ReportV2ViewModelMapper.buildViewModel(report);
      assert.ok(
        vm.section1.address.vi.includes('Phường Tân Sơn Nhất (Đã Duyệt)'),
        `Địa chỉ phải giữ nguyên tên phường đã duyệt nhưng nhận được: ${vm.section1.address.vi}`
      );
    }
  );

  await runTest(
    'TC5.2',
    'Nghiệp vụ 5',
    'Mục II (Section1And2Mapper) giữ nguyên số tầng nổi aboveFloors đã chốt (3 tầng) dù danh sách floors có 4 mặt bằng (gồm sân thượng/mái)',
    () => {
      const report = createSampleApprovedReport();
      report.buildingSpecs.aboveFloors = 3;
      report.survey_data_json.aboveFloors = 3;
      report.survey_data_json.floors = [
        { floorName: 'Tầng trệt', zones: [] },
        { floorName: 'Lửng', zones: [] },
        { floorName: 'Lầu 1', zones: [] },
        { floorName: 'Sân thượng / Mái', zones: [] },
      ];

      const vm = ReportV2ViewModelMapper.buildViewModel(report);
      assert.equal(vm.section2.storeysAbove, 3, 'Số tầng nổi phải đọc đúng aboveFloors = 3 thay vì bị Math.max nâng lên 4');
    }
  );

  await runTest(
    'TC5.3',
    'Nghiệp vụ 5',
    'Mục II (calculateMetroDistances) đọc trực tiếp khoảng cách Metro đã đóng băng trong hồ sơ APPROVED',
    () => {
      const report = createSampleApprovedReport();
      report.status = 'APPROVED';
      report.survey_data_json.metroOffsetDistance = 21.4;
      report.survey_data_json.impactAssessment = {
        code: 'I1',
        iCode: 'I1',
        distanceM: 21.4,
        distanceType: 'TUNNEL_CENTERLINE',
      };

      const vm = ReportV2ViewModelMapper.buildViewModel(report);
      assert.equal(vm.section2.distanceToMetroAlignmentM, '21.4');
      assert.equal(vm.section8.impact.distanceM, 21.4);
    }
  );

  await runTest(
    'TC5.4',
    'Nghiệp vụ 5',
    'Mục VI (Section6DefectSummaryMapper) phân loại 4 nhóm khuyết tật loại trừ lẫn nhau 100% (Tổng 4 nhóm === totalDefects)',
    () => {
      const report = createSampleApprovedReport();
      report.survey_data_json.floors[0].zones[0].defects = [
        { id: 'd1', defectCode: 'D-01', defectType: 'Nứt tường gạch', widthMm: 1.5, lengthM: 1.0, notes: 'Vết nứt khô' },
        { id: 'd2', defectCode: 'D-02', defectType: 'Thấm ẩm chân tường kèm rạn nhỏ', widthMm: 0.5, lengthM: 0.8, notes: 'Có vết thấm ẩm' },
        { id: 'd3', defectCode: 'D-03', defectType: 'Bong rộp sơn nước', widthMm: 0, lengthM: 0, notes: 'Tróc sơn' },
      ];
      report.survey_data_json.floors[0].structuralElements[0].defects = [
        { id: 'd4', defectCode: 'D-04', defectType: 'Nứt cột BTCT', widthMm: 2.0, lengthM: 0.9 },
      ];

      const appendix2 = FloorDefectMapper.mapFloors(report.survey_data_json.floors);
      const { section6 } = Section6DefectSummaryMapper.map(appendix2, report, report.survey_data_json);

      const sumBuckets =
        section6.structuralCracksCount +
        section6.masonryPlasterCracksCount +
        section6.moistureDefectsCount +
        section6.spallingDefectsCount;

      assert.equal(section6.totalDefects, 4);
      assert.equal(sumBuckets, section6.totalDefects, 'Tổng 4 nhóm khuyết tật phải bằng chính xác totalDefects = 4');
      assert.equal(section6.structuralCracksCount, 1);
      assert.equal(section6.moistureDefectsCount, 1);
      assert.equal(section6.masonryPlasterCracksCount, 1);
      assert.equal(section6.spallingDefectsCount, 1);
    }
  );

  await runTest(
    'TC5.5',
    'Nghiệp vụ 5',
    'Mục IX (Section9ConclusionMapper) chỉ in đúng các hạn chế khảo sát đã chốt, không tự động bơm thêm câu hạn chế ngầm khi foundationType=UNKNOWN hoặc hasDrawings=false',
    () => {
      const report = createSampleApprovedReport();
      report.buildingSpecs.foundationType = 'UNKNOWN';
      report.survey_data_json.foundationType = 'UNKNOWN';
      report.survey_data_json.hasDrawings = false;
      report.survey_data_json.accessLimitation = {
        type: 'PARTIAL',
        restrictedAreas: ['Phòng thờ tầng 3'],
        notes: 'Chủ hộ khóa cửa phòng thờ',
      };

      const vm = ReportV2ViewModelMapper.buildViewModel(report);
      const limTexts = vm.section9.limitations.map((l) => l.vi);
      assert.ok(limTexts.some((t) => t.includes('Phòng thờ tầng 3')));
      assert.ok(
        !limTexts.some((t) => t.includes('Thông tin kết cấu móng: Chưa thu thập được')),
        'Không được tự động chèn câu hạn chế móng ngầm'
      );
      assert.ok(
        !limTexts.some((t) => t.includes('Hồ sơ bản vẽ hoàn công / kết cấu công trình: Chủ hộ không cung cấp')),
        'Không được tự động chèn câu hạn chế bản vẽ hoàn công ngầm'
      );
    }
  );

  // ============================================================================
  // NGHIỆP VỤ 6: PHỤ LỤC 1-2, XOAY ẢNH (PHOTOROTATIONS) & GIAO DIỆN 10 TRANG
  // ============================================================================
  console.log('\n▶ Nghiệp vụ 6: Phụ lục 1-2, Xoay ảnh (photoRotations) & Tương thích giao diện 10 trang');

  await runTest(
    'TC6.1',
    'Nghiệp vụ 6',
    'FloorDefectMapper hiển thị chính xác nhãn cấp độ Burland (Rất nhẹ B-1, Nhẹ B-2, Trung bình B-3, Nặng B-4, Rất nặng B-5) thay vì gán cứng "Nhẹ"',
    () => {
      const floors = [
        {
          floorName: 'Tầng trệt',
          zones: [
            { zoneCode: 'Z-01', roomName: 'Phòng 1', defects: [{ defectCode: 'D-01', widthMm: 0.5 }] }, // B-1
            { zoneCode: 'Z-02', roomName: 'Phòng 2', defects: [{ defectCode: 'D-02', widthMm: 8.0 }] }, // B-3
            { zoneCode: 'Z-03', roomName: 'Phòng 3', defects: [{ defectCode: 'D-03', widthMm: 20.0 }] }, // B-4
            { zoneCode: 'Z-04', roomName: 'Phòng 4', defects: [{ defectCode: 'D-04', widthMm: 30.0 }] }, // B-5
          ],
        },
      ];
      const mapped = FloorDefectMapper.mapFloors(floors);
      const conds = mapped[0].zoneAndElementConditions;
      assert.equal(conds[0].condition.vi, 'Rất nhẹ (B-1) - D-01');
      assert.equal(conds[1].condition.vi, 'Trung bình (B-3) - D-02');
      assert.equal(conds[2].condition.vi, 'Nặng (B-4) - D-03');
      assert.equal(conds[3].condition.vi, 'Rất nặng (B-5) - D-04');
    }
  );

  await runTest(
    'TC6.2',
    'Nghiệp vụ 6',
    'FloorDefectMapper đọc đúng trạng thái yêu cầu quan trắc bổ sung (requiresAdditionalMonitoring) cho độ võng dầm sàn',
    () => {
      const floors = [
        { floorName: 'Tầng 1', beamDeflectionMm: 4.5, requiresAdditionalMonitoring: true, zones: [] },
        { floorName: 'Tầng 2', beamDeflectionMm: 1.0, requiresAdditionalMonitoring: false, zones: [] },
      ];
      const mapped = FloorDefectMapper.mapFloors(floors);
      assert.equal(mapped[0].beamDeflectionRow?.extraMonitoringRequired.vi, 'có yêu cầu');
      assert.equal(mapped[0].beamDeflectionRow?.extraMonitoringRequired.en, 'required');
      assert.equal(mapped[1].beamDeflectionRow?.extraMonitoringRequired.vi, 'không yêu cầu');
      assert.equal(mapped[1].beamDeflectionRow?.extraMonitoringRequired.en, 'not required');
    }
  );

  await runTest(
    'TC6.3',
    'Nghiệp vụ 6',
    'FloorDefectMapper & ReportImageResolver ánh xạ đúng khóa xoay ảnh composite (defect_f0_zZ-01_def-1_cu) và xoay ảnh vật lý bằng Sharp',
    async () => {
      ReportImageResolver.clearCache();
      // Tạo 1 ảnh chữ nhật 40x20 px
      const rectBuf = await sharp({
        create: { width: 40, height: 20, channels: 3, background: { r: 255, g: 0, b: 0 } },
      })
        .png()
        .toBuffer();
      const fakeUrl = '/uploads/surveys/test-defect-cu.png';

      // Mock fetchImageBuffer cho fakeUrl
      const origFetch = ReportImageResolver.fetchImageBuffer;
      try {
        (ReportImageResolver as any).fetchImageBuffer = async (u: string) => {
          if (u === fakeUrl) return { buffer: rectBuf, mime: 'image/png' };
          return origFetch.call(ReportImageResolver, u);
        };

        const rotKey = 'defect_f0_zZ-01_def-1_cu';
        const rotMap = { [rotKey]: 90 };

        await ReportImageResolver.preloadAndResolveAll([{ url: fakeUrl, rotation: 90 }], rotMap);

        const floors = [
          {
            floorName: 'Tầng trệt',
            zones: [
              {
                zoneCode: 'Z-01',
                roomName: 'Phòng khách',
                defects: [
                  {
                    id: 'def-1',
                    defectCode: 'D-01',
                    widthMm: 1.2,
                    closeUpPhotoUrl: fakeUrl,
                  },
                ],
              },
            ],
          },
        ];

        const mapped = FloorDefectMapper.mapFloors(floors, { current: 5 }, 'B01', null, rotMap);
        const cuBase64 = mapped[0].defectPairPhotos[0].closeUpPhotoBase64 || '';
        assert.ok(cuBase64.startsWith('data:image/png;base64,'), 'Phải trả về chuỗi Base64 đã xoay');

        const outBuf = Buffer.from(cuBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        const meta = await sharp(outBuf).metadata();
        assert.equal(meta.width, 20, 'Sau khi xoay 90 độ, chiều rộng ảnh 40x20 phải thành 20px');
        assert.equal(meta.height, 40, 'Sau khi xoay 90 độ, chiều cao ảnh 40x20 phải thành 40px');
      } finally {
        (ReportImageResolver as any).fetchImageBuffer = origFetch;
      }
    }
  );

  await runTest(
    'TC6.4',
    'Nghiệp vụ 6',
    'Appendix1PhotoMapper & Section5DeformationMapper nhận đúng góc xoay từ khóa photoP01..photoP04, buildingTilt và diffSettlement',
    () => {
      const report = createSampleApprovedReport();
      report.survey_data_json.photoP01 = '/uploads/surveys/p01.jpg';
      report.survey_data_json.photoP05 = '/uploads/surveys/p05.jpg';
      report.survey_data_json.photoRotations = {
        photoP01: 180,
        buildingTilt: 90,
        diffSettlement: 270,
      };
      report.survey_data_json.settlementTilt = {
        buildingTilt: { level: 1, photoUrl: '/uploads/surveys/p05.jpg' },
        diffSettlement: { level: 1, photoUrl: '/uploads/surveys/p06.jpg' },
      };

      const app1 = Appendix1PhotoMapper.map(
        report,
        report.survey_data_json,
        [],
        report.deformation,
        'B01',
        10.77,
        106.66,
        '10/05/2026',
        report.survey_date
      );
      const p01Item = app1.appendix1.find((p) => p.photoCode === 'P-01');
      const p05Item = app1.appendix1.find((p) => p.photoCode === 'P-05');
      const p06Item = app1.appendix1.find((p) => p.photoCode === 'P-06');

      assert.equal(p01Item?.rotation, 180);
      assert.equal(p05Item?.rotation, 90);
      assert.equal(p06Item?.rotation, 270);
    }
  );

  await runTest(
    'TC6.5',
    'Nghiệp vụ 6',
    'Biên dịch HTML Báo cáo V3 giữ nguyên 100% thiết kế giao diện 10 trang song ngữ (bìa, chữ ký, mục lục, chương I-IX, phụ lục 1-4)',
    async () => {
      const report = createSampleApprovedReport();
      const { html, viewModel } = await ReportV2Service.generateResidentialHtmlFromReport(report, undefined, false, false);

      assert.ok(html.includes('I. THÔNG TIN CHUNG - GENERAL INFORMATION'));
      assert.ok(html.includes('II. THÔNG TIN CƠ BẢN VỀ TÒA NHÀ - BASIC BUILDING INFORMATION'));
      assert.ok(html.includes('III. LỊCH SỬ VÀ TÌNH TRẠNG SỬ DỤNG'));
      assert.ok(html.includes('IV. ĐẶC ĐIỂM KẾT CẤU VÀ MÓNG'));
      assert.ok(html.includes('V. ĐỘ NGHIÊNG/LÚN - GHI NHẬN SƠ BỘ'));
      assert.ok(html.includes('VI. TỔNG HỢP VÀ PHÂN TÍCH HIỆN TRẠNG KHUYẾT TẬT'));
      assert.ok(html.includes('VII. PHÂN LOẠI MỨC ĐỘ HƯ HẠI THEO BURLAND'));
      assert.ok(html.includes('VIII. ĐÁNH GIÁ TÌNH TRẠNG CÔNG TRÌNH'));
      assert.ok(html.includes('IX. KẾT LUẬN VÀ KIẾN NGHỊ'));
      assert.ok(html.includes('XI. BIÊN BẢN KHẢO SÁT HIỆN TRƯỜNG'));
      assert.ok(html.includes('PHỤ LỤC 1'));
      assert.ok(html.includes('PHỤ LỤC 2'));
      assert.ok(html.includes('PHỤ LỤC 3: THIẾT BỊ KHẢO SÁT CHUYÊN DỤNG'));
      assert.equal(viewModel.section8.ecs.totalScore, 1);
      assert.equal(viewModel.section8.vi.averageScore, 1.67);
    }
  );

  // ============================================================================
  // NGHIỆP VỤ 7: KIỂM ĐỊNH 6 ĐIỂM RÀ SOÁT SÂU (100% ZERO-INFERENCE & READ-FROM-APPROVED)
  // ============================================================================
  console.log('\n▶ Nghiệp vụ 7: Kiểm định 6 điểm rà soát sâu (100% Zero-Inference & Read-From-Approved)');

  await runTest(
    'TC7.1',
    'Nghiệp vụ 7',
    'Khi mảng defects rỗng nhưng Admin đã chốt localMaxGrade = 2 hoặc structuralFlagLevel = "HIGH", BurlandCalculator & RiskScoringCalculator giữ nguyên 100% điểm đã duyệt thay vì bị isZeroDefects ép về 0',
    () => {
      const report = createSampleApprovedReport();
      report.survey_data_json.floors = [
        {
          id: 'fl-1',
          floorName: 'Tầng trệt',
          zones: [{ id: 'z1', zoneCode: 'Z-01', roomName: 'Phòng khách', defects: [] }],
          structuralElements: [],
        },
      ];
      report.survey_data_json.burlandSummary = {
        localMaxGrade: 2,
        predominantGrade: 1,
        governingZoneCode: 'Z-01',
        structuralFlagLevel: 'HIGH',
        hasStructuralFlag: true,
        structuralFlagReason: 'Ghi nhận dấu hiệu võng dầm nhẹ cần theo dõi',
      };
      report.survey_data_json.ecs = {
        e1: 1,
        e2: 2,
        e3: 0,
        e4: 0,
        e5: 0,
        e6: 0,
        totalEcs: 3,
        ecsClass: 'GOOD',
      };

      const burland = BurlandCalculator.computeBurlandSection(
        report.survey_data_json.floors,
        report.survey_data_json.burlandSummary
      );
      assert.match(burland.localMaxGrade.vi, /Cấp 2 - Nhẹ/);
      assert.equal(burland.structuralFlagLevel.vi, 'Có (Cấp High)', 'Cờ kết cấu phải giữ nguyên Có (Cấp High), không bị isZeroDefects ép về Không');
      assert.equal(burland.needStructuralReview.vi, 'Có');

      // Kể cả khi truyền isZeroDefects = true (do danh sách dòng defect chi tiết rỗng), RiskScoringCalculator vẫn tôn trọng điểm đã duyệt
      const section8 = RiskScoringCalculator.computeRiskAssessment(
        report,
        2,
        1,
        true
      );
      assert.equal(section8.ecs.items.find((i) => i.code === 'E1')?.score, 1);
      assert.equal(section8.ecs.items.find((i) => i.code === 'E2')?.score, 2);
      assert.equal(section8.ecs.totalScore, 3);
    }
  );

  await runTest(
    'TC7.2',
    'Nghiệp vụ 7',
    'RiskScoringCalculator đọc chính xác các cột fallback từ bảng risk_score_cards (e4_material_score, e6_overall_function_score, v5_ecs_score, v6_sensitivity_score)',
    () => {
      const report = createSampleApprovedReport();
      // Xóa object ecs và vi trong survey_data_json để bắt buộc đọc từ bảng risk_score_cards (report.riskScores)
      delete report.survey_data_json.ecs;
      delete report.survey_data_json.vi;
      report.riskScores = {
        e1_burland_score: 1,
        e2_structure_score: 2,
        e3_deformation_score: 1,
        e4_material_score: 2,
        e5_history_score: 1,
        e6_overall_function_score: 1,
        total_ecs_score: 8,
        ecs_class: 'FAIR',
        v1_importance_score: 2,
        v2_structure_score: 3,
        v3_foundation_score: 2,
        v4_age_score: 2,
        v5_ecs_score: 2,
        v6_sensitivity_score: 3,
        total_vi_score: 14,
        avg_vi_score: 2.33,
        vi_class: 'HIGH',
        foundation_cat_score: 3,
      };

      const section8 = RiskScoringCalculator.computeRiskAssessment(report, 2, 1, false);
      assert.equal(section8.ecs.items.find((i) => i.code === 'E4')?.score, 2, 'Phải đọc đúng e4_material_score = 2');
      assert.equal(section8.ecs.items.find((i) => i.code === 'E6')?.score, 1, 'Phải đọc đúng e6_overall_function_score = 1');
      assert.equal(section8.ecs.totalScore, 8);
      assert.equal(section8.vi.items.find((i) => i.code === 'V5')?.score, 2, 'Phải đọc đúng v5_ecs_score = 2');
      assert.equal(section8.vi.items.find((i) => i.code === 'V6')?.score, 3, 'Phải đọc đúng v6_sensitivity_score = 3');
      assert.equal(section8.vi.totalScore, 14);
    }
  );

  await runTest(
    'TC7.3',
    'Nghiệp vụ 7',
    'Mục II (Section1And2Mapper) không tự chia tổng diện tích sàn cho số tầng, không tự nhân/chia chiều cao công trình, và không dùng Math.min/max đoán mặt tiền từ cạnh GIS',
    () => {
      const report = createSampleApprovedReport();
      // 1. Có tổng diện tích sàn 180m2, 2 tầng, nhưng KHÔNG nhập footprintAreaM2
      delete report.buildingSpecs.footprintAreaM2;
      delete report.survey_data_json.footprintAreaM2;
      delete report.buildingSpecs.constructionAreaM2;
      delete report.survey_data_json.constructionAreaM2;
      report.buildingSpecs.totalFloorAreaM2 = 180;
      report.survey_data_json.totalFloorAreaM2 = 180;
      // 2. Chiều cao nhà = 3.8m (nhà có lửng thấp), 2 tầng -> không được tự nhân 3.8 * 2 = 7.6m
      report.buildingSpecs.aboveFloors = 2;
      report.survey_data_json.aboveFloors = 2;
      report.buildingSpecs.buildingHeightM = 3.8;
      report.survey_data_json.buildingHeightM = 3.8;
      delete report.survey_data_json.typicalStoreyHeightM;
      // 3. Không nhập frontageWidth/lotDepth, chỉ có 2 cạnh GIS parcel_side_a_m = 12, parcel_side_b_m = 8
      delete report.buildingSpecs.frontageWidth;
      delete report.buildingSpecs.lotDepth;
      delete report.survey_data_json.frontageWidth;
      delete report.survey_data_json.lotDepth;
      report.parcel_side_a_m = 12;
      report.parcel_side_b_m = 8;

      const vm = ReportV2ViewModelMapper.buildViewModel(report);
      assert.equal(vm.section2.footprintM2, '', 'Không được tự lấy 180 / 2 để suy ra diện tích xây dựng');
      assert.ok(!vm.section2.floorAreaDisplay.vi.includes('Diện tích xây dựng tầng trệt'));
      assert.equal(vm.section2.totalFloorAreaM2, '180.0');
      assert.equal(vm.section2.maxHeightM, '3.8', 'Chiều cao tối đa phải giữ nguyên 3.8m, không tự nhân số tầng');
      assert.equal(vm.section2.typicalStoreyHeightM, '– m', 'Chiều cao tầng điển hình không được tự chia khi chưa nhập');
      assert.match(vm.section2.mainDimensions.vi, /Kích thước cạnh thửa GIS: 12\.0 m × 8\.0 m/, 'Không được tự dùng Math.min/max gán Mặt tiền 8m × Chiều sâu 12m');
    }
  );

  await runTest(
    'TC7.4',
    'Nghiệp vụ 7',
    'Mục III & Mục IV (Section3And4Mapper) không bị điểm suy luận móng CAT 4 ghi đè nguồn lịch sử tòa nhà, và không tự điền cứng "nứt cấp ≥ 3"',
    () => {
      const report = createSampleApprovedReport();
      report.survey_data_json.foundationCatScore = 4;
      report.survey_data_json.foundationSource = 'Ước tính / suy luận kỹ thuật';
      report.survey_data_json.buildingHistory = {
        informationSource: 'Chủ sở hữu cung cấp trực tiếp',
      };
      // Thêm 1 vết nứt cấu kiện nhẹ (0.5mm - Cấp 1)
      report.survey_data_json.floors[0].structuralElements[0].defects = [
        { id: 'd-col-1', defectCode: 'D-02', defectType: 'Rạn chân chim bề mặt cột', widthMm: 0.5, lengthM: 0.4, burlandGrade: 1 },
      ];

      const vm = ReportV2ViewModelMapper.buildViewModel(report);
      assert.equal(
        vm.section3.informationSource.vi,
        'Chủ sở hữu cung cấp trực tiếp',
        'Nguồn thông tin Mục III phải đọc đúng Chủ sở hữu cung cấp, không bị foundationCatScore=4 ép về Quan sát hiện trường'
      );
      assert.ok(
        !vm.section4.visibleStructuralCondition.vi.includes('nứt cấp ≥ 3'),
        `Mục IV không được tự suy diễn "nứt cấp ≥ 3": ${vm.section4.visibleStructuralCondition.vi}`
      );
      assert.match(
        vm.section4.visibleStructuralCondition.vi,
        /Ghi nhận khuyết tật trên cấu kiện kết cấu \(1 vị trí/
      );
    }
  );

  await runTest(
    'TC7.5',
    'Nghiệp vụ 7',
    'Mục V (Section5DeformationMapper) không tự điền cứng "nứt cấp ≥ 3" hoặc "hiện trạng kết cấu ổn định" và hỗ trợ dataSource dạng chuỗi đơn',
    () => {
      const report = createSampleApprovedReport();
      report.survey_data_json.floors[0].structuralElements[0].defects = [
        { id: 'd-col-1', defectCode: 'D-02', defectType: 'Rạn nhẹ bề mặt cột', widthMm: 0.5, lengthM: 0.4, burlandGrade: 1 },
      ];
      report.survey_data_json.buildingHistory = {
        majorRepairHistory: 2, // Từng sửa chữa lớn
      };
      report.survey_data_json.settlementTilt = {
        dataSource: 'Đo laser kết hợp kiểm tra trực quan',
      };

      const vm = ReportV2ViewModelMapper.buildViewModel(report);
      assert.ok(
        !vm.section5.componentDeterioration.location.vi.includes('nứt cấp ≥ 3'),
        `Mục V.3 không được tự điền cứng "nứt cấp ≥ 3": ${vm.section5.componentDeterioration.location.vi}`
      );
      assert.ok(
        !vm.section5.evidenceOfRepairs.location.vi.includes('hiện trạng kết cấu ổn định'),
        `Mục V.4 không được tự suy luận "hiện trạng kết cấu ổn định": ${vm.section5.evidenceOfRepairs.location.vi}`
      );
      assert.equal(vm.section5.basisOfDetermination.vi, 'Đo laser kết hợp kiểm tra trực quan');
    }
  );

  await runTest(
    'TC7.6',
    'Nghiệp vụ 7',
    'MetadataMapper & Appendix3And4Mapper khóa cứng ngày lập báo cáo (generatedAt) và nguồn trích xuất theo thời điểm phê duyệt (approved_at) đối với hồ sơ APPROVED',
    () => {
      const report = createSampleApprovedReport();
      report.status = 'APPROVED';
      report.approved_at = '2026-05-15T08:00:00.000Z';

      const vm = ReportV2ViewModelMapper.buildViewModel(report);
      assert.equal(vm.metadata.generatedAt, '15/05/2026', 'generatedAt của hồ sơ APPROVED phải khóa cứng theo approved_at (15/05/2026)');
      assert.ok(
        vm.appendix3.dataSource.en.includes('2026-05-15T08:00:00.000Z'),
        `Nguồn dữ liệu Phụ lục 3 phải khóa cứng theo approved_at thay vì giờ hệ thống động: ${vm.appendix3.dataSource.en}`
      );
    }
  );

  // ============================================================================
  // NGHIỆP VỤ 8: ĐÓNG KÍN 100% FIELD-MAPPING SNAPSHOT & VÒNG ĐỜI LƯU TRỮ / TRUY XUẤT REVISION (REV.00, REV.01...)
  // ============================================================================
  console.log('\n▶ Nghiệp vụ 8: Đóng kín 100% Field-Mapping Snapshot & Vòng đời Lưu trữ / Truy xuất Revision (Rev.00, Rev.01...)');

  await runTest(
    'TC8.1',
    'Nghiệp vụ 8',
    'FrozenParcelSchema & applySnapshotToReport đóng băng và khôi phục 100% các trường mở rộng (zoneId, segmentType, frontageWidth, lotDepth, metroSegmentName, metroConstructionType, zone_admin_name, chữ ký 3 bên)',
    () => {
      const baseReport = createSampleApprovedReport();
      const snap = createSampleSnapshot(baseReport);

      snap.frozenParcel = {
        ...snap.frozenParcel,
        zoneId: 'ZONE_09_FROZEN',
        segmentType: 'POR',
        frontageWidth: 5.5,
        lotDepth: 18.0,
        gisMutationType: 'SPLIT_PARCEL',
        metroSegmentName: 'Zone 9: Đoạn hầm TBM S5-S6 (Đã đóng băng)',
        metroConstructionType: 'Hầm TBM đôi',
        metroStartChainage: 'Km 4+100',
        metroEndChainage: 'Km 4+850',
      };
      snap.frozenReportData = {
        ...snap.frozenReportData,
        zone_admin_name: 'Kỹ sư trưởng Đã Chốt Duyệt',
        surveyor_signature_img: 'data:image/png;base64,FROZEN_SURVEYOR_SIG',
        zone_admin_signature_img: 'data:image/png;base64,FROZEN_ZONE_ADMIN_SIG',
        report_code: 'BC-FROZEN-001',
      };

      const validatedSnap = ReportSnapshotSchema.parse(snap);

      // Giả lập bản ghi live bị sửa đổi các cột ở bảng parcels / users sau khi đã duyệt
      const mutatedReport = createSampleApprovedReport();
      mutatedReport.zone_id = 'ZONE_MUTATED';
      mutatedReport.segment_type = 'C&C';
      mutatedReport.frontage_width = 99.0;
      mutatedReport.lot_depth = 99.0;
      mutatedReport.metro_segment_name = 'Đoạn tuyến bị sửa sau duyệt';
      mutatedReport.zone_admin_name = 'Kỹ sư trưởng Mới Thay Đổi';
      mutatedReport.report_code = 'BC-MUTATED-999';

      const restoredReport = ReportSnapshotService.applySnapshotToReport(mutatedReport, validatedSnap);

      assert.equal(restoredReport.zone_id, 'ZONE_09_FROZEN');
      assert.equal(restoredReport.segment_type, 'POR');
      assert.equal(restoredReport.frontage_width, 5.5);
      assert.equal(restoredReport.lot_depth, 18.0);
      assert.equal(restoredReport.gis_mutation_type, 'SPLIT_PARCEL');
      assert.equal(restoredReport.metro_segment_name, 'Zone 9: Đoạn hầm TBM S5-S6 (Đã đóng băng)');
      assert.equal(restoredReport.metro_construction_type, 'Hầm TBM đôi');
      assert.equal(restoredReport.zone_admin_name, 'Kỹ sư trưởng Đã Chốt Duyệt');
      assert.equal(restoredReport.surveyor_signature_img, 'data:image/png;base64,FROZEN_SURVEYOR_SIG');
      assert.equal(restoredReport.zone_admin_signature_img, 'data:image/png;base64,FROZEN_ZONE_ADMIN_SIG');
      assert.equal(restoredReport.report_code, 'BC-FROZEN-001');

      const vm = ReportV2ViewModelMapper.buildViewModel(restoredReport);
      assert.ok(vm.metadata.buildingId.includes('POR'), `buildingId phải phản ánh segmentType POR đã đóng băng: ${vm.metadata.buildingId}`);
      assert.ok(vm.metadata.reportNo.includes('POR'), `reportNo phải phản ánh segmentType POR đã đóng băng: ${vm.metadata.reportNo}`);
      assert.equal(vm.section1.sectionZone.vi, 'Zone 9: Đoạn hầm TBM S5-S6 (Đã đóng băng)');
      assert.equal(vm.signatures3Party[1].fullName, 'Kỹ sư trưởng Đã Chốt Duyệt');
    }
  );

  await runTest(
    'TC8.2',
    'Nghiệp vụ 8',
    'applySnapshotToReport khôi phục chính xác approved_at và exportRevision theo từng phiên bản (Rev.00 vs Rev.01), giữ nguyên ngày xuất báo cáo bất biến theo từng Rev',
    () => {
      const baseReport = createSampleApprovedReport();
      const snapRev00 = createSampleSnapshot(baseReport);
      snapRev00.approvedAt = '2026-05-15T08:00:00.000Z';
      snapRev00.exportRevision = 0;

      const snapRev01 = createSampleSnapshot(baseReport);
      snapRev01.approvedAt = '2026-09-22T14:30:00.000Z';
      snapRev01.exportRevision = 1;

      // Giả lập bảng base_survey_reports hiện đang mang ngày duyệt mới (22/09/2026) và rev 1
      const liveReportForRev00 = createSampleApprovedReport();
      liveReportForRev00.approved_at = '2026-09-22T14:30:00.000Z';
      liveReportForRev00.export_revision = 1;

      const restoredRev00 = ReportSnapshotService.applySnapshotToReport(liveReportForRev00, snapRev00);
      assert.equal(restoredRev00.approved_at, '2026-05-15T08:00:00.000Z');
      assert.equal(restoredRev00.export_revision, 0);

      const vmRev00 = ReportV2ViewModelMapper.buildViewModel(restoredRev00);
      assert.equal(vmRev00.metadata.generatedAt, '15/05/2026', 'Rev.00 phải giữ nguyên ngày phê duyệt ban đầu 15/05/2026');
      assert.equal(vmRev00.metadata.revision, '00');
      assert.equal(vmRev00.signatures3Party[1].date, '15/05/2026');

      const liveReportForRev01 = createSampleApprovedReport();
      const restoredRev01 = ReportSnapshotService.applySnapshotToReport(liveReportForRev01, snapRev01);
      const vmRev01 = ReportV2ViewModelMapper.buildViewModel(restoredRev01);
      assert.equal(vmRev01.metadata.generatedAt, '22/09/2026', 'Rev.01 phải hiển thị đúng ngày phê duyệt lại 22/09/2026');
      assert.equal(vmRev01.metadata.revision, '01');
      assert.equal(vmRev01.signatures3Party[1].date, '22/09/2026');
    }
  );

  await runTest(
    'TC8.3',
    'Nghiệp vụ 8',
    'ReportService.getReportDetail(id, maskPii, revision) tự động áp dụng Snapshot bất biến cho hồ sơ APPROVED và hỗ trợ truy xuất JSON theo từng số hiệu Rev',
    async () => {
      const origResolve = ReportService.resolveReport;
      const origGetSnapForRev = ReportSnapshotService.getSnapshotForRevision;
      try {
        const baseReport = createSampleApprovedReport();
        const snapRev00 = createSampleSnapshot(baseReport);
        snapRev00.exportRevision = 0;
        snapRev00.approvedAt = '2026-05-15T08:00:00.000Z';
        snapRev00.frozenParcel = { ...snapRev00.frozenParcel, ownerName: 'Nguyễn Văn A (Bản Chốt Rev.00)' };
        snapRev00.frozenSurveyDataJson = { ...snapRev00.frozenSurveyDataJson, ownerName: 'Nguyễn Văn A (Bản Chốt Rev.00)' };

        const snapRev01 = createSampleSnapshot(baseReport);
        snapRev01.exportRevision = 1;
        snapRev01.approvedAt = '2026-08-10T10:00:00.000Z';
        snapRev01.frozenParcel = { ...snapRev01.frozenParcel, ownerName: 'Nguyễn Văn A (Bản Chốt Rev.01)' };
        snapRev01.frozenSurveyDataJson = { ...snapRev01.frozenSurveyDataJson, ownerName: 'Nguyễn Văn A (Bản Chốt Rev.01)' };

        ReportService.resolveReport = async () => {
          const live = createSampleApprovedReport();
          live.owner_name = 'Tên Live Bị Sửa Trái Phép';
          live.survey_data_json.ownerName = 'Tên Live Bị Sửa Trái Phép';
          return live;
        };

        (ReportSnapshotService as any).getSnapshotForRevision = async (_id: string, rev?: number) => {
          if (rev === 0) return { versionId: 'ver-rev-00', snapshot: snapRev00 };
          return { versionId: 'ver-rev-01', snapshot: snapRev01 };
        };

        const detailRev00: any = await ReportService.getReportDetail(VALID_UUID_1, false, 0);
        assert.equal(detailRev00.owner_name, 'Nguyễn Văn A (Bản Chốt Rev.00)');
        assert.equal(detailRev00.export_revision, 0);
        assert.equal(detailRev00.approved_at, '2026-05-15T08:00:00.000Z');

        const detailRev01: any = await ReportService.getReportDetail(VALID_UUID_1, false, 1);
        assert.equal(detailRev01.owner_name, 'Nguyễn Văn A (Bản Chốt Rev.01)');
        assert.equal(detailRev01.export_revision, 1);
        assert.equal(detailRev01.approved_at, '2026-08-10T10:00:00.000Z');
      } finally {
        ReportService.resolveReport = origResolve;
        (ReportSnapshotService as any).getSnapshotForRevision = origGetSnapForRev;
      }
    }
  );

  await runTest(
    'TC8.4',
    'Nghiệp vụ 8',
    'ReportSnapshotService.getSnapshotForRevision và ReportV3Service.renderDraftHtml truy xuất đúng Snapshot liên kết với report_releases cho từng Rev.00 và Rev.01',
    async () => {
      const origQuery = Database.query;
      try {
        const baseReport = createSampleApprovedReport();
        const snapRev00 = createSampleSnapshot(baseReport);
        snapRev00.exportRevision = 0;
        snapRev00.approvedAt = '2026-05-15T08:00:00.000Z';
        snapRev00.frozenParcel = { ...snapRev00.frozenParcel, ownerName: 'Chủ Hộ Lịch Sử Rev.00' };
        snapRev00.frozenSurveyDataJson = { ...snapRev00.frozenSurveyDataJson, ownerName: 'Chủ Hộ Lịch Sử Rev.00' };
        snapRev00.ecs.total = 1;

        const snapRev01 = createSampleSnapshot(baseReport);
        snapRev01.exportRevision = 1;
        snapRev01.approvedAt = '2026-07-20T09:00:00.000Z';
        snapRev01.frozenParcel = { ...snapRev01.frozenParcel, ownerName: 'Chủ Hộ Lịch Sử Rev.01' };
        snapRev01.frozenSurveyDataJson = { ...snapRev01.frozenSurveyDataJson, ownerName: 'Chủ Hộ Lịch Sử Rev.01' };
        snapRev01.ecs.total = 7;
        snapRev01.ecs.e2 = 6;
        snapRev01.ecs.ecsClass = 'MEDIUM';

        (Database as any).query = async (sql: string, params?: any[]) => {
          if (sql.includes('FROM report_releases rr') && sql.includes('JOIN survey_report_versions v')) {
            const requestedRev = params?.[1];
            if (requestedRev === 0) {
              return { rows: [{ snapshot_version_id: 'ver-00', revision: 0, snapshot_data: snapRev00 }] };
            }
            if (requestedRev === 1) {
              return { rows: [{ snapshot_version_id: 'ver-01', revision: 1, snapshot_data: snapRev01 }] };
            }
          }
          return { rows: [] };
        };

        const resolvedLive = {
          id: VALID_UUID_1,
          status: 'APPROVED',
          zoneId: 'ZONE_09',
          exportRevision: 1,
          approvedAt: '2026-07-20T09:00:00.000Z',
          raw: createSampleApprovedReport(),
        };

        const htmlRev00 = await ReportV3Service.renderDraftHtml(resolvedLive, undefined, false, false, 0);
        assert.equal(htmlRev00.viewModel.section1.ownerName, 'Chủ Hộ Lịch Sử Rev.00');
        assert.equal(htmlRev00.viewModel.metadata.revision, '00');
        assert.equal(htmlRev00.viewModel.metadata.generatedAt, '15/05/2026');
        assert.equal(htmlRev00.viewModel.section8.ecs.totalScore, 1);

        const htmlRev01 = await ReportV3Service.renderDraftHtml(resolvedLive, undefined, false, false, 1);
        assert.equal(htmlRev01.viewModel.section1.ownerName, 'Chủ Hộ Lịch Sử Rev.01');
        assert.equal(htmlRev01.viewModel.metadata.revision, '01');
        assert.equal(htmlRev01.viewModel.metadata.generatedAt, '20/07/2026');
        assert.equal(htmlRev01.viewModel.section8.ecs.totalScore, 7);
      } finally {
        (Database as any).query = origQuery;
      }
    }
  );

  await runTest(
    'TC8.5',
    'Nghiệp vụ 8',
    'ReportReleaseService.issueNewRevision, list và readVerifiedFile thực thi trọn vẹn vòng đời phát hành Rev.00 -> Rev.01, tái sử dụng snapshot chờ phát hành, xóa cờ hasPendingRelease và phát hiện giả mạo file PDF bằng SHA-256',
    async () => {
      const origQuery = Database.query;
      const origTransaction = Database.transaction;
      const origResolve = ReportV3Service.resolve;
      const origRenderFinalPdf = ReportV3Service.renderFinalPdf;
      const origGetLatestSnap = ReportSnapshotService.getLatestApprovedSnapshot;
      const origGetActiveConfig = ReportConfigService.getActiveConfig;
      const origReleaseDir = process.env.REPORT_RELEASE_DIR;

      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ksat-rev-test-'));
      process.env.REPORT_RELEASE_DIR = tmpDir;
      try {
        const fakePdfRev00 = Buffer.from('%PDF-1.4 FAKE REV 00 CONTENT IMMUTABLE');
        const expectedSha00 = crypto.createHash('sha256').update(fakePdfRev00).digest('hex');
        const reportDir = path.join(tmpDir, VALID_UUID_1);
        await fs.mkdir(reportDir, { recursive: true });
        const pdfPathRev00 = path.join(reportDir, 'rev-00.pdf');
        await fs.writeFile(pdfPathRev00, fakePdfRev00);

        let updatedVersionRevision: number | null = null;
        let clearedPendingRelease = false;

        const mockReleases: any[] = [
          {
            id: 'rel-00',
            report_id: VALID_UUID_1,
            revision: 0,
            reason: 'Phát hành lần đầu Rev.00',
            is_final: true,
            file_path: pdfPathRev00,
            file_size_bytes: fakePdfRev00.byteLength,
            sha256: expectedSha00,
            snapshot_version_id: 'ver-00',
            released_by_user_id: VALID_UUID_2,
            released_by_name: 'Kỹ sư trưởng Lê C',
            released_by_role: 'ZONE_ADMIN',
            released_at: new Date('2026-05-15T08:05:00.000Z'),
          },
        ];

        (Database as any).query = async (sql: string) => {
          if (sql.includes('FROM report_releases rr') && sql.includes('ORDER BY rr.revision DESC')) {
            return { rows: [...mockReleases].sort((a, b) => b.revision - a.revision) };
          }
          return { rows: [] };
        };

        const unlinkedSnap = createSampleSnapshot(createSampleApprovedReport());
        (ReportSnapshotService as any).getLatestApprovedSnapshot = async () => ({
          versionId: 'ver-unlinked-01',
          snapshot: unlinkedSnap,
        });

        (ReportConfigService as any).getActiveConfig = async () => ({
          standardTextVersionId: null,
          standardTextVersionNumber: 1,
          equipment: [],
        });

        (Database as any).transaction = async (cb: (client: any) => Promise<any>) => {
          const fakeClient = {
            query: async (sql: string, params?: any[]) => {
              if (sql.includes('FROM base_survey_reports') && sql.includes('FOR UPDATE')) {
                return {
                  rows: [{ status: 'APPROVED', approved_at: new Date('2026-08-20T09:55:00.000Z'), export_revision: 0 }],
                };
              }
              if (sql.includes('SELECT MAX(revision) AS max_rev FROM report_releases')) {
                return { rows: [{ max_rev: 0 }] };
              }
              if (sql.includes('SELECT COUNT(*) AS count FROM report_releases WHERE report_id = $1 AND snapshot_version_id = $2')) {
                return { rows: [{ count: '0' }] };
              }
              if (sql.includes('UPDATE survey_report_versions') && sql.includes('SET snapshot_data = $1')) {
                const parsed = JSON.parse(params?.[0] || '{}');
                updatedVersionRevision = parsed.exportRevision;
                return { rows: [] };
              }
              if (sql.includes('INSERT INTO report_releases')) {
                const newRow = {
                  id: 'rel-01',
                  report_id: params?.[0],
                  revision: params?.[1],
                  reason: params?.[2],
                  is_final: true,
                  file_path: params?.[3],
                  file_size_bytes: params?.[4],
                  sha256: params?.[5],
                  snapshot_version_id: params?.[6],
                  released_by_user_id: params?.[7],
                  released_by_name: 'Kỹ sư trưởng Lê C',
                  released_by_role: 'ZONE_ADMIN',
                  released_at: new Date('2026-08-20T10:00:00.000Z'),
                };
                mockReleases.push(newRow);
                return { rows: [newRow] };
              }
              if (sql.includes('UPDATE base_survey_reports') && sql.includes("survey_data_json - 'hasPendingRelease'")) {
                clearedPendingRelease = true;
                return { rows: [] };
              }
              return { rows: [] };
            },
          };
          return cb(fakeClient);
        };

        (ReportV3Service as any).resolve = async () => ({
          id: VALID_UUID_1,
          status: 'APPROVED',
          zoneId: 'ZONE_09',
          exportRevision: 0,
          approvedAt: '2026-08-20T09:55:00.000Z',
          raw: createSampleApprovedReport(),
        });

        (ReportV3Service as any).renderFinalPdf = async () => ({
          pdfBuffer: Buffer.from('%PDF-1.4 FAKE REV 01 CONTENT IMMUTABLE'),
          reportNo: 'BC-Z9-001',
        });

        // 1. Kiểm tra list() trả đầy đủ thông tin người phát hành và snapshotVersionId
        const listBefore = await ReportReleaseService.list(VALID_UUID_1);
        assert.equal(listBefore.length, 1);
        assert.equal(listBefore[0].releasedByName, 'Kỹ sư trưởng Lê C');
        assert.equal(listBefore[0].snapshotVersionId, 'ver-00');

        // 2. Kiểm tra readVerifiedFile đọc thành công khi SHA-256 khớp
        const verified00 = ReportReleaseService.readVerifiedFile(listBefore[0]);
        assert.equal(verified00.toString('utf8'), '%PDF-1.4 FAKE REV 00 CONTENT IMMUTABLE');

        // 3. Kiểm tra phát hành Rev.01 (bắt buộc có lý do, tái sử dụng snapshot unlinked, xóa hasPendingRelease)
        const issued01 = await ReportReleaseService.issueNewRevision(
          VALID_UUID_1,
          { userId: VALID_UUID_2, role: 'ZONE_ADMIN', assignedZoneId: 'ZONE_09' } as any,
          'Cập nhật lại kích thước vết nứt D-01 sau thẩm định bổ sung'
        );
        assert.equal(issued01.revision, 1);
        assert.equal(issued01.snapshotVersionId, 'ver-unlinked-01');
        assert.equal(updatedVersionRevision, 1, 'Phải đồng bộ exportRevision = 1 vào snapshot chờ phát hành');
        assert.equal(clearedPendingRelease, true, 'Phải xóa cờ hasPendingRelease sau khi phát hành Rev.01');

        // Kiểm tra file vật lý rev-01.pdf đã được ghi xuống đĩa và kiểm định SHA-256 thành công
        const verified01 = ReportReleaseService.readVerifiedFile(issued01);
        assert.equal(verified01.toString('utf8'), '%PDF-1.4 FAKE REV 01 CONTENT IMMUTABLE');

        // 4. Giả lập kẻ tấn công sửa file vật lý rev-00.pdf trên ổ đĩa -> readVerifiedFile phải ném lỗi 409 ConflictError
        await fs.writeFile(pdfPathRev00, Buffer.from('%PDF-1.4 TAMPERED CONTENT BY ATTACKER'));
        assert.throws(
          () => {
            ReportReleaseService.readVerifiedFile(listBefore[0]);
          },
          (err: any) => {
            assert.equal(err.status, 409);
            assert.match(err.detail || err.message, /SHA-256 không khớp/);
            return true;
          }
        );
      } finally {
        if (origReleaseDir === undefined) delete process.env.REPORT_RELEASE_DIR;
        else process.env.REPORT_RELEASE_DIR = origReleaseDir;
        (Database as any).query = origQuery;
        (Database as any).transaction = origTransaction;
        (ReportV3Service as any).resolve = origResolve;
        (ReportV3Service as any).renderFinalPdf = origRenderFinalPdf;
        (ReportSnapshotService as any).getLatestApprovedSnapshot = origGetLatestSnap;
        (ReportConfigService as any).getActiveConfig = origGetActiveConfig;
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  );

  await runTest(
    'TC8.6',
    'Nghiệp vụ 8',
    'ReportV3Controller.exportPdf không trả nhầm file rev-00.pdf cũ khi hồ sơ có hasPendingRelease = true (vừa mở khóa duyệt lại), nhưng vẫn trả đúng rev-00.pdf khi truyền ?rev=0',
    async () => {
      const origResolve = ReportV3Service.resolve;
      const origRenderPdf = ReportV3Service.renderDraftPdf;
      const origGetReleaseSummary = ReportReleaseService.getReleaseSummary;
      const origGetOrCreateFinal = ReportReleaseService.getOrCreateFinalFile;

      try {
        const pendingReleaseReport = createSampleApprovedReport();
        pendingReleaseReport.export_revision = 0;
        pendingReleaseReport.survey_data_json.hasPendingRelease = true;

        (ReportV3Service as any).resolve = async () => ({
          id: VALID_UUID_1,
          status: 'APPROVED',
          zoneId: 'ZONE_09',
          exportRevision: 0,
          approvedAt: '2026-08-25T10:00:00.000Z',
          raw: pendingReleaseReport,
        });

        let renderDraftPdfCalledWithRev: number | undefined = -999;
        (ReportV3Service as any).renderDraftPdf = async (
          _resolved: any,
          _overrides: any,
          _wm: boolean,
          rev?: number
        ) => {
          renderDraftPdfCalledWithRev = rev;
          return {
            pdfBuffer: Buffer.from('%PDF-1.4 NEWLY APPROVED SNAPSHOT PDF'),
            reportNo: 'BC-Z9-001',
          };
        };

        const mockRelease00 = {
          id: 'rel-00',
          reportId: VALID_UUID_1,
          revision: 0,
          snapshotVersionId: 'ver-00',
          filePath: '/tmp/rev-00.pdf',
          sha256: VALID_SHA256,
          fileSizeBytes: 128,
          reason: 'Phát hành Rev.00',
          isFinal: true,
          releasedByUserId: VALID_UUID_2,
          releasedAt: '2026-05-15T08:00:00.000Z',
        };

        (ReportReleaseService as any).getReleaseSummary = async () => ({
          releases: [mockRelease00],
          latestRelease: mockRelease00,
          hasPendingRelease: true,
          currentExportRevision: 0,
        });

        (ReportReleaseService as any).getOrCreateFinalFile = async (_resolved: any, _user: any, rev?: number) => ({
          buffer: Buffer.from('%PDF-1.4 ARCHIVED REV 00 PDF'),
          release: { ...mockRelease00, revision: rev ?? 0 },
          created: false,
        });

        // Trường hợp 1: Không truyền ?rev khi hasPendingRelease = true -> Phải gọi renderDraftPdf từ snapshot mới nhất
        const headersCase1: Record<string, string> = {};
        let bodyCase1: Buffer = Buffer.alloc(0);
        const req1: any = {
          params: { id: VALID_UUID_1 },
          query: {},
          body: {},
          user: { userId: VALID_UUID_2, role: 'ZONE_ADMIN', assignedZones: ['ZONE_09'] },
        };
        const res1: any = {
          setHeader: (k: string, v: string) => {
            headersCase1[k] = v;
          },
          status: () => res1,
          send: (b: Buffer) => {
            bodyCase1 = b;
            return res1;
          },
        };
        await ReportV3Controller.exportPdf(req1, res1, (e) => {
          if (e) throw e;
        });
        assert.equal(renderDraftPdfCalledWithRev, undefined);
        assert.equal(bodyCase1.toString('utf8'), '%PDF-1.4 NEWLY APPROVED SNAPSHOT PDF');

        // Trường hợp 2: Truyền tường minh ?rev=0 -> Phải trả đúng bản lưu trữ rev-00.pdf kèm header X-Report-Revision: 0
        const headersCase2: Record<string, string> = {};
        let bodyCase2: Buffer = Buffer.alloc(0);
        const req2: any = {
          params: { id: VALID_UUID_1 },
          query: { rev: '0' },
          body: {},
          user: { userId: VALID_UUID_2, role: 'ZONE_ADMIN', assignedZones: ['ZONE_09'] },
        };
        const res2: any = {
          setHeader: (k: string, v: string) => {
            headersCase2[k] = v;
          },
          status: () => res2,
          send: (b: Buffer) => {
            bodyCase2 = b;
            return res2;
          },
        };
        await ReportV3Controller.exportPdf(req2, res2, (e) => {
          if (e) throw e;
        });
        assert.equal(headersCase2['X-Report-Revision'], '0');
        assert.equal(headersCase2['X-Content-SHA256'], VALID_SHA256);
        assert.equal(bodyCase2.toString('utf8'), '%PDF-1.4 ARCHIVED REV 00 PDF');
      } finally {
        (ReportV3Service as any).resolve = origResolve;
        (ReportV3Service as any).renderDraftPdf = origRenderPdf;
        (ReportReleaseService as any).getReleaseSummary = origGetReleaseSummary;
        (ReportReleaseService as any).getOrCreateFinalFile = origGetOrCreateFinal;
      }
    }
  );

  console.log('\n============================================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`TỔNG KẾT: ${passedCount}/${results.length} TESTCASES PASSED (${failedCount} FAILED)`);
  console.log('============================================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Lỗi thực thi bộ test:', err);
  process.exit(1);
});
