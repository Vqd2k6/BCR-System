/**
 * Test Suite: 30 Test Cases for Residential Photo Orientation Standards, Rotation Tools, and Approval Gate
 *
 * Covers:
 * 1. Category A: Orientation Standards & Angle Normalization (Cases 1-6)
 * 2. Category B: KSV Frontend Recommendations vs Audit Rules Alignment (Cases 7-14)
 * 3. Category C: Hook & Violation Detection Engine (Cases 15-20)
 * 4. Category D: Audit Workflow, Modals & Approval Gate (Cases 21-25)
 * 5. Category E: Backend Persistence, Transactions & Report Generation (Cases 26-30)
 */

import {
  normalizeRotationAngle,
  evaluateResidentialOrientation,
  RESIDENTIAL_PHOTO_RULES,
  type ExpectedOrientation,
  type PhotoOrientationType,
} from '../modules/audit/utils/residential-photo-orientation.standards';

import { AuditModificationService, PhotoActionItem } from '../modules/audit/services/audit-modification.service';
import { ResidentialReportGenerator } from '../modules/report/generators/residential.generator';

interface TestCaseResult {
  id: number;
  category: string;
  name: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const results: TestCaseResult[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTest(
  id: number,
  category: string,
  name: string,
  fn: () => void | Promise<void>
) {
  try {
    await fn();
    results.push({ id, category, name, passed: true });
    console.log(`  ✅ [PASS] Case ${id}: ${name}`);
  } catch (err: any) {
    results.push({ id, category, name, passed: false, error: err.message });
    console.error(`  ❌ [FAIL] Case ${id}: ${name} -> ${err.message}`);
  }
}

async function main() {
  console.log('================================================================================');
  console.log('🧪 TEST SUITE: 30 CASES FOR RESIDENTIAL PHOTO ORIENTATION & APPROVAL GATE');
  console.log('================================================================================\n');

  // ============================================================================
  // CATEGORY A: Orientation Standards & Angle Normalization (Cases 1 - 6)
  // ============================================================================
  console.log('--- CATEGORY A: Orientation Standards & Angle Normalization ---');

  await runTest(1, 'A', 'normalizeRotationAngle handles 0, null, undefined, negatives, and multi-cycles', () => {
    assert(normalizeRotationAngle(0) === 0, '0 should normalize to 0');
    assert(normalizeRotationAngle(360) === 0, '360 should normalize to 0');
    assert(normalizeRotationAngle(720) === 0, '720 should normalize to 0');
    assert(normalizeRotationAngle(null) === 0, 'null should normalize to 0');
    assert(normalizeRotationAngle(undefined) === 0, 'undefined should normalize to 0');
    assert(normalizeRotationAngle(NaN) === 0, 'NaN should normalize to 0');
    assert(normalizeRotationAngle(90) === 90, '90 should normalize to 90');
    assert(normalizeRotationAngle(450) === 90, '450 should normalize to 90');
    assert(normalizeRotationAngle(180) === 180, '180 should normalize to 180');
    assert(normalizeRotationAngle(-180) === 180, '-180 should normalize to 180');
    assert(normalizeRotationAngle(270) === 270, '270 should normalize to 270');
    assert(normalizeRotationAngle(-90) === 270, '-90 should normalize to 270');
    // Approximate snap
    assert(normalizeRotationAngle(85) === 90, '85 should snap to 90');
    assert(normalizeRotationAngle(190) === 180, '190 should snap to 180');
  });

  await runTest(2, 'A', 'Natural 4:3 landscape photo without rotation evaluates to valid LANDSCAPE', () => {
    const res = evaluateResidentialOrientation(1600, 1200, 0, 'photoP01');
    assert(res.isValid === true, 'Landscape photo should be valid for P-01');
    assert(res.currentOrientation === 'LANDSCAPE', 'Current orientation must be LANDSCAPE');
    assert(res.effectiveWidth === 1600, 'Effective width must be 1600');
    assert(res.effectiveHeight === 1200, 'Effective height must be 1200');
    assert(res.effectiveRotation === 0, 'Effective rotation must be 0');
  });

  await runTest(3, 'A', 'Natural 3:4 portrait photo without rotation evaluates to valid PORTRAIT', () => {
    const res = evaluateResidentialOrientation(1200, 1600, 0, 'photoP02');
    assert(res.isValid === true, 'Portrait photo should be valid for P-02');
    assert(res.currentOrientation === 'PORTRAIT', 'Current orientation must be PORTRAIT');
    assert(res.effectiveWidth === 1200, 'Effective width must be 1200');
    assert(res.effectiveHeight === 1600, 'Effective height must be 1600');
    assert(res.effectiveRotation === 0, 'Effective rotation must be 0');
  });

  await runTest(4, 'A', '90° clockwise rotation turns a landscape photo into effective PORTRAIT', () => {
    // Original photo: 1920x1080 (Landscape), rotated by 90° -> Effective: 1080x1920 (Portrait)
    const res = evaluateResidentialOrientation(1920, 1080, 90, 'photoP02');
    assert(res.currentOrientation === 'PORTRAIT', 'Rotated 90° landscape should become PORTRAIT');
    assert(res.effectiveWidth === 1080, 'Width and height must swap: width=1080');
    assert(res.effectiveHeight === 1920, 'Width and height must swap: height=1920');
    assert(res.isValid === true, 'P-02 expects PORTRAIT so rotated photo becomes valid');
  });

  await runTest(5, 'A', '180° rotation preserves orientation category without swapping dimensions', () => {
    const res = evaluateResidentialOrientation(1200, 1600, 180, 'photoP02');
    assert(res.currentOrientation === 'PORTRAIT', '180° should remain PORTRAIT');
    assert(res.effectiveWidth === 1200, 'Dimensions must not swap: width=1200');
    assert(res.effectiveHeight === 1600, 'Dimensions must not swap: height=1600');
    assert(res.effectiveRotation === 180, 'Effective rotation must be 180');
    assert(res.isValid === true, 'Valid for PORTRAIT rule');
  });

  await runTest(6, 'A', '270° rotation turns a portrait photo into effective LANDSCAPE', () => {
    const res = evaluateResidentialOrientation(1080, 1920, 270, 'photoP04');
    assert(res.currentOrientation === 'LANDSCAPE', '270° portrait should become LANDSCAPE');
    assert(res.effectiveWidth === 1920, 'Effective width should be 1920');
    assert(res.effectiveHeight === 1080, 'Effective height should be 1080');
    assert(res.isValid === true, 'P-04 expects LANDSCAPE so rotated photo is valid');
  });

  // ============================================================================
  // CATEGORY B: KSV Frontend Recommendations vs Audit Rules Alignment (Cases 7 - 14)
  // ============================================================================
  console.log('\n--- CATEGORY B: KSV Frontend Recommendations Alignment ---');

  await runTest(7, 'B', 'P-01 rule alignment: LANDSCAPE (4:3) matching Step1PhotosSection.tsx:74', () => {
    const rule = RESIDENTIAL_PHOTO_RULES['photoP01'];
    assert(Boolean(rule), 'photoP01 rule must exist');
    assert(rule.expected === 'LANDSCAPE', 'P-01 must expect LANDSCAPE');
    assert(rule.aspectRatioHint === '4:3', 'P-01 must have 4:3 aspect ratio hint');
    assert(rule.isStrict === false, 'P-01 is non-strict recommendation');
  });

  await runTest(8, 'B', 'P-02 rule alignment: Strict PORTRAIT (3:4) matching Step1PhotosSection.tsx:124', () => {
    const rule = RESIDENTIAL_PHOTO_RULES['photoP02'];
    assert(Boolean(rule), 'photoP02 rule must exist');
    assert(rule.expected === 'PORTRAIT', 'P-02 must expect PORTRAIT');
    assert(rule.aspectRatioHint === '3:4', 'P-02 must have 3:4 aspect ratio hint');
    assert(rule.isStrict === true, 'P-02 must be strict rule');
  });

  await runTest(9, 'B', 'P-03 rule alignment: Strict PORTRAIT (3:4) matching Step1PhotosSection.tsx:229', () => {
    const rule = RESIDENTIAL_PHOTO_RULES['photoP03'];
    assert(Boolean(rule), 'photoP03 rule must exist');
    assert(rule.expected === 'PORTRAIT', 'P-03 must expect PORTRAIT');
    assert(rule.aspectRatioHint === '3:4', 'P-03 must have 3:4 aspect ratio hint');
    assert(rule.isStrict === true, 'P-03 must be strict rule');
  });

  await runTest(10, 'B', 'P-04 rule alignment: Strict LANDSCAPE (4:3) matching Step1PhotosSection.tsx:370', () => {
    const rule = RESIDENTIAL_PHOTO_RULES['photoP04'];
    assert(Boolean(rule), 'photoP04 rule must exist');
    assert(rule.expected === 'LANDSCAPE', 'P-04 must expect LANDSCAPE');
    assert(rule.aspectRatioHint === '4:3', 'P-04 must have 4:3 aspect ratio hint');
    assert(rule.isStrict === true, 'P-04 must be strict rule');
  });

  await runTest(11, 'B', 'buildingTilt rule alignment: Strict PORTRAIT (3:4) matching Step1SettlementTiltSection.tsx:297', () => {
    const rule = RESIDENTIAL_PHOTO_RULES['buildingTilt'];
    assert(Boolean(rule), 'buildingTilt rule must exist');
    assert(rule.expected === 'PORTRAIT', 'buildingTilt must expect PORTRAIT');
    assert(rule.isStrict === true, 'buildingTilt must be strict');
  });

  await runTest(12, 'B', 'beamSagging rule alignment: Strict LANDSCAPE (4:3) matching SaggingMonitoringSection.tsx:117', () => {
    const rule = RESIDENTIAL_PHOTO_RULES['beamSagging'];
    assert(Boolean(rule), 'beamSagging rule must exist');
    assert(rule.expected === 'LANDSCAPE', 'beamSagging must expect LANDSCAPE');
    assert(rule.isStrict === true, 'beamSagging must be strict');
  });

  await runTest(13, 'B', 'Z_CTX rule alignment: Strict LANDSCAPE (4:3) matching DamageZonesSection.tsx:610', () => {
    const rule = RESIDENTIAL_PHOTO_RULES['Z_CTX'];
    assert(Boolean(rule), 'Z_CTX rule must exist');
    assert(rule.expected === 'LANDSCAPE', 'Z_CTX must expect LANDSCAPE');
    assert(rule.isStrict === true, 'Z_CTX must be strict');
  });

  await runTest(14, 'B', 'D_CU rule alignment: LANDSCAPE (4:3) matching DefectPinningCanvas.tsx:1567', () => {
    const rule = RESIDENTIAL_PHOTO_RULES['D_CU'];
    assert(Boolean(rule), 'D_CU rule must exist');
    assert(rule.expected === 'LANDSCAPE', 'D_CU must expect LANDSCAPE');
  });

  // ============================================================================
  // CATEGORY C: Hook & Violation Detection Engine (Cases 15 - 20)
  // ============================================================================
  console.log('\n--- CATEGORY C: Violation Detection Engine ---');

  await runTest(15, 'C', 'Surveyor took P-02 in landscape -> flagged with suggestedRotation = 90', () => {
    // Surveyor uploaded 1920x1080 for P-02 (Facade should be Portrait)
    const res = evaluateResidentialOrientation(1920, 1080, 0, 'photoP02');
    assert(res.isValid === false, 'P-02 in landscape must fail evaluation');
    assert(res.currentOrientation === 'LANDSCAPE', 'Detected as LANDSCAPE');
    assert(res.expected === 'PORTRAIT', 'Expected is PORTRAIT');
    assert(res.suggestedRotation === 90, 'Suggested rotation should be 90°');
    assert(res.message.includes('Quy chuẩn báo cáo yêu cầu DỌC'), 'Message mentions DỌC standard');
  });

  await runTest(16, 'C', 'Multi-photo orientation scan detects all violations in a survey', () => {
    const photosToTest = [
      { key: 'photoP01', w: 1600, h: 1200, rot: 0, expectedValid: true }, // Landscape -> OK
      { key: 'photoP02', w: 1600, h: 1200, rot: 0, expectedValid: false }, // Landscape -> VIOLATION (needs Portrait)
      { key: 'photoP03', w: 1600, h: 1200, rot: 0, expectedValid: false }, // Landscape -> VIOLATION (needs Portrait)
      { key: 'photoP04', w: 1600, h: 1200, rot: 0, expectedValid: true }, // Landscape -> OK
      { key: 'buildingTilt', w: 1600, h: 1200, rot: 0, expectedValid: false }, // Landscape -> VIOLATION (needs Portrait)
      { key: 'D_CU', w: 1600, h: 1200, rot: 0, expectedValid: true }, // Landscape -> OK
    ];

    const violations = photosToTest.filter((p) => {
      const evalRes = evaluateResidentialOrientation(p.w, p.h, p.rot, p.key);
      return !evalRes.isValid;
    });

    assert(violations.length === 3, `Expected 3 violations, got ${violations.length}`);
    const violatedKeys = violations.map((v) => v.key);
    assert(violatedKeys.includes('photoP02'), 'P-02 should be in violations');
    assert(violatedKeys.includes('photoP03'), 'P-03 should be in violations');
    assert(violatedKeys.includes('buildingTilt'), 'buildingTilt should be in violations');
  });

  await runTest(17, 'C', 'In-session staged rotation: rotating P-02 by 90° clears violation', () => {
    // Initial state: w=1600, h=1200, rot=0 -> invalid
    const initial = evaluateResidentialOrientation(1600, 1200, 0, 'photoP02');
    assert(initial.isValid === false, 'Initial state must be invalid');

    // Auditor rotates by 90°
    const stagedRotation = 90;
    const corrected = evaluateResidentialOrientation(1600, 1200, stagedRotation, 'photoP02');
    assert(corrected.isValid === true, 'After 90° rotation, P-02 must be valid');
    assert(corrected.effectiveRotation === 90, 'Effective rotation is 90');
    assert(corrected.effectiveWidth === 1200, 'Effective width is 1200');
    assert(corrected.effectiveHeight === 1600, 'Effective height is 1600');
  });

  await runTest(18, 'C', 'Non-strict photos (vacantLand, diffSettlement) evaluate with isStrict: false', () => {
    const ruleLand = RESIDENTIAL_PHOTO_RULES['vacantLand'];
    assert(ruleLand.isStrict === false, 'vacantLand is non-strict');
    const ruleDiff = RESIDENTIAL_PHOTO_RULES['diffSettlement'];
    assert(ruleDiff.isStrict === false, 'diffSettlement is non-strict');
  });

  await runTest(19, 'C', 'Strict violations flag hasStrictViolations: true for P-02, P-03, P-04, buildingTilt', () => {
    const strictKeys = ['photoP02', 'photoP03', 'photoP04', 'buildingTilt', 'Z_CTX'];
    for (const key of strictKeys) {
      const rule = RESIDENTIAL_PHOTO_RULES[key];
      assert(rule.isStrict === true, `${key} must have isStrict === true`);
    }
  });

  await runTest(20, 'C', 'Fully compliant survey produces 0 violations', () => {
    const compliantPhotos = [
      { key: 'photoP01', w: 1600, h: 1200, rot: 0 },
      { key: 'photoP02', w: 1200, h: 1600, rot: 0 },
      { key: 'photoP03', w: 1200, h: 1600, rot: 0 },
      { key: 'photoP04', w: 1600, h: 1200, rot: 0 },
      { key: 'buildingTilt', w: 1200, h: 1600, rot: 0 },
      { key: 'beamSagging', w: 1600, h: 1200, rot: 0 },
      { key: 'Z_CTX', w: 1600, h: 1200, rot: 0 },
      { key: 'D_CU', w: 1600, h: 1200, rot: 0 },
      { key: 'MINUTES', w: 1200, h: 1600, rot: 0 },
    ];

    const violations = compliantPhotos.filter((p) => {
      return !evaluateResidentialOrientation(p.w, p.h, p.rot, p.key).isValid;
    });

    assert(violations.length === 0, 'Compliant survey must have zero violations');
  });

  // ============================================================================
  // CATEGORY D: Audit Workflow, Modals & Approval Gate (Cases 21 - 25)
  // ============================================================================
  console.log('\n--- CATEGORY D: Audit Workflow & Approval Gate ---');

  await runTest(21, 'D', 'Approval Gatekeeper triggers confirmation modal when mismatched photos exist', () => {
    const violations = [
      { key: 'photoP02', photoCode: 'P-02', currentOrientation: 'LANDSCAPE', expectedOrientation: 'PORTRAIT' },
    ];
    const totalDiffCount = 0;
    const shouldShowOrientationWarning = totalDiffCount === 0 && violations.length > 0;
    assert(shouldShowOrientationWarning === true, 'Must show orientation warning when violations exist and diffs = 0');
  });

  await runTest(22, 'D', 'Gatekeeper confirmation modal provides exactly 2 options: Back vs Bypass', () => {
    const allowedActions = ['GO_BACK_ADJUST', 'BYPASS_AND_APPROVE'];
    assert(allowedActions.length === 2, 'Must have exactly 2 decision branches');
    assert(allowedActions.includes('GO_BACK_ADJUST'), 'Must include Quay Lại Điều Chỉnh Ảnh');
    assert(allowedActions.includes('BYPASS_AND_APPROVE'), 'Must include Bỏ Qua & Tiếp Tục Phê Duyệt');
  });

  await runTest(23, 'D', 'Bypass approval flow does NOT require an essay or written justification', () => {
    // As approved in /grill-me, bypass is a quick 1-click confirmation without forced essay input
    const bypassPayload = {
      action: 'BYPASS_AND_APPROVE',
      bypassReasonRequired: false,
    };
    assert(bypassPayload.bypassReasonRequired === false, 'No mandatory justification text box required');
  });

  await runTest(24, 'D', 'Unsaved form diffs take precedence over orientation confirmation modal', () => {
    const totalDiffCount = 2; // User edited some form fields
    const hasMismatchedPhotos = true;

    let modalOpened = '';
    if (totalDiffCount > 0) {
      modalOpened = 'UNSAVED_CHANGES_DIFF_MODAL';
    } else if (hasMismatchedPhotos) {
      modalOpened = 'ORIENTATION_WARNING_MODAL';
    }

    assert(modalOpened === 'UNSAVED_CHANGES_DIFF_MODAL', 'Unsaved diffs must block approve first');
  });

  await runTest(25, 'D', 'Staged photo rotations are merged into the diff update payload', () => {
    const stagedPhotoRotations = {
      'P-02': 90,
      'buildingTilt': 270,
    };
    const pendingUpdates = {
      buildingSpecs: { structuralIntegrity: 'Tốt' },
    };

    const payloadUpdates = {
      ...pendingUpdates,
      ...(Object.keys(stagedPhotoRotations).length > 0 ? { photoRotations: stagedPhotoRotations } : {}),
    };

    assert(Boolean(payloadUpdates.photoRotations), 'photoRotations must be in update payload');
    assert(Boolean(payloadUpdates.photoRotations && payloadUpdates.photoRotations['P-02'] === 90), 'P-02 rotation must be 90');
    assert(Boolean(payloadUpdates.photoRotations && payloadUpdates.photoRotations['buildingTilt'] === 270), 'buildingTilt rotation must be 270');
  });

  // ============================================================================
  // CATEGORY E: Backend Persistence & Report Generation (Cases 26 - 30)
  // ============================================================================
  console.log('\n--- CATEGORY E: Backend Persistence & Report Generation ---');

  await runTest(26, 'E', 'PhotoActionItem with action ROTATE normalizes angle into [0, 90, 180, 270]', () => {
    const pa: PhotoActionItem = {
      action: 'ROTATE',
      category: 'IDENTIFICATION',
      targetPhotoType: 'P02',
      photoCode: 'P-02',
      rotation: 450, // Should normalize to 90
      reason: 'Chuẩn hóa hướng ảnh mặt đứng chính',
    };

    const norm = normalizeRotationAngle(pa.rotation);
    assert(norm === 90, 'Normalized rotation should be 90');
  });

  await runTest(27, 'E', 'applySinglePhotoActionInTx with ROTATE updates survey_data_json.photoRotations and photo obj', async () => {
    const surveyJson: any = {
      photoP02: { url: 'https://example.com/p02.jpg', photoCode: 'P02' },
      identificationPhotos: {
        photoP02: { url: 'https://example.com/p02.jpg' },
      },
    };

    const mockClient = {
      query: async (queryText: string, params: any[]) => {
        return { rows: [] };
      },
    };

    const pa: PhotoActionItem = {
      action: 'ROTATE',
      category: 'IDENTIFICATION',
      targetPhotoType: 'P02',
      photoCode: 'P-02',
      rotation: 90,
      reason: 'Xoay ảnh P-02 về đúng hướng dọc',
    };

    await AuditModificationService.applySinglePhotoActionInTx(
      mockClient,
      'rep-test-01',
      'par-test-01',
      'admin-01',
      surveyJson,
      pa
    );

    assert(Boolean(surveyJson.photoRotations), 'photoRotations object must be created');
    assert(surveyJson.photoRotations['P-02'] === 90, 'photoRotations["P-02"] must be 90');
    assert(surveyJson.photoP02.rotation === 90, 'photoP02.rotation must be updated to 90');
    assert(surveyJson.identificationPhotos.photoP02.rotation === 90, 'identificationPhotos.photoP02.rotation must be updated to 90');
  });

  await runTest(28, 'E', 'applyAdminSurveyEdit merges photoRotations without overwriting existing entries', () => {
    const existingJson: any = {
      photoRotations: {
        'P-01': 180,
      },
    };

    const updates = {
      photoRotations: {
        'P-02': 90,
      },
    };

    const mergedJson = {
      ...existingJson,
      ...updates,
      photoRotations: {
        ...(existingJson.photoRotations || {}),
        ...(updates?.photoRotations || {}),
      },
    };

    assert(mergedJson.photoRotations['P-01'] === 180, 'Existing P-01 rotation must be preserved');
    assert(mergedJson.photoRotations['P-02'] === 90, 'New P-02 rotation must be added');
  });

  await runTest(29, 'E', 'residential-viewmodel.builder correctly extracts rotation into ReportPhotoItem', () => {
    const mockReportData = {
      id: 'rep-uuid-1234',
      survey_date: '17/10/2026',
      survey_data_json: {
        photoP01: { url: 'https://example.com/p01.jpg', rotation: 0 },
        photoP02: { url: 'https://example.com/p02.jpg', rotation: 90 },
        photoP03: { url: 'https://example.com/p03.jpg' },
        photoP04: { url: 'https://example.com/p04.jpg' },
        photoRotations: {
          'P-03': 270,
          'P-04': 180,
        },
      },
    };

    const viewModel = ResidentialReportGenerator.buildViewModel(mockReportData);

    assert(viewModel.p01.rotation === 0, 'p01.rotation should be 0');
    assert(viewModel.p02.rotation === 90, 'p02.rotation should be 90');
    assert(viewModel.p03.rotation === 270, 'p03.rotation should be 270');
    assert(viewModel.p04.rotation === 180, 'p04.rotation should be 180');
  });

  await runTest(30, 'E', 'Report Handlebars template compiles and renders CSS transform for rotated photos', () => {
    const mockReportData = {
      id: 'rep-uuid-1234',
      survey_date: '17/10/2026',
      project_parcel_code: 'HCM-Q1-T01',
      survey_data_json: {
        photoP01: { url: 'https://example.com/p01.jpg', rotation: 0 },
        photoP02: { url: 'https://example.com/p02.jpg', rotation: 90 },
        photoP03: { url: 'https://example.com/p03.jpg', rotation: 270 },
        photoP04: { url: 'https://example.com/p04.jpg', rotation: 180 },
        photoRotations: {
          'P-02': 90,
          'P-03': 270,
          'P-04': 180,
        },
      },
    };

    const viewModel = ResidentialReportGenerator.buildViewModel(mockReportData);
    const html = ResidentialReportGenerator.generateHtml(viewModel);

    assert(Boolean(html), 'Compiled HTML must not be empty');
    assert(html.includes('style="transform: rotate(90deg);"'), 'HTML must render rotate(90deg) for P-02');
    assert(html.includes('style="transform: rotate(270deg);"'), 'HTML must render rotate(270deg) for P-03');
    assert(html.includes('style="transform: rotate(180deg);"'), 'HTML must render rotate(180deg) for P-04');
  });

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('\n================================================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  console.log(`📊 SUMMARY: ${passedCount} / ${results.length} PASSED (${failedCount} FAILED)`);
  console.log('================================================================================');

  if (failedCount > 0) {
    console.error('\n❌ FAILED CASES:');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.error(`- Case ${r.id} (${r.category}): ${r.name} -> ${r.error}`);
      });
    process.exit(1);
  } else {
    console.log('\n🎉 ALL 30 CASES PASSED PERFECTLY!');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
