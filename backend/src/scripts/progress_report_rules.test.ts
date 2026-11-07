/**
 * Unit test các hàm thuần (pure) của plugin Progress Report – không cần DB.
 * Chạy: cd backend && npx ts-node --transpile-only src/scripts/progress_report_rules.test.ts
 */
import assert from "node:assert/strict";
import {
  classifyBraGrade,
  classifyCondition,
  classifyEcsCondition,
  computeGisImpactCode,
  isInaccessible,
  normalizeRiskValue,
  resolveVulnerabilityCode,
} from "../modules/progress-report/rules/condition.classifier";
import { COL } from "../modules/progress-report/columns/common.columns";
import { mapSurveyProgress } from "../modules/progress-report/rules/survey-status.mapper";
import {
  resolveAlignmentSide,
  resolveStationCode,
} from "../modules/progress-report/rules/alignment-side";
import { cleanOwnerName } from "../modules/progress-report/rules/owner-name.resolver";
import {
  mapFoundationLabel,
  normalizeRecord,
  formatFloor,
  ABSENCE_REASON_VI,
  isEnumCode,
  translateAbsenceReason,
} from "../modules/progress-report/rules/record.normalizer";
import ExcelJS from "exceljs";
import { ExcelProgressRenderer } from "../modules/progress-report/render/excel.renderer";
import {
  resolveTimeWindow,
  isInWindow,
  toVnCalendarDate,
} from "../modules/progress-report/rules/time-window";
import { toNumber } from "../modules/progress-report/rules/json-reader";
import {
  computeAlignmentSide,
  computeGisDistances,
  parseGeoJsonOuterRingLngLat,
} from "../modules/progress-report/geo/alignment-geometry";
import { calculateSummary } from "../modules/progress-report/summary/summary.calculator";
import { splitStandardizedAddress } from "../modules/progress-report/rules/address-reader";
import { normalizeUsageFunction } from "../modules/progress-report/rules/usage-normalizer";
import { arrangeRecords } from "../modules/progress-report/rules/record.arranger";
import { DAILY_PROGRESS_STATION_TEMPLATE } from "../modules/progress-report/columns/templates/daily-progress-station.template";
import { DEFAULT_PROGRESS_CONFIG as CFG } from "../modules/progress-report/config/default-config";
import { progressReportConfigSchema } from "../modules/progress-report/config/config.schema";
import type { RawProgressRow } from "../modules/progress-report/progress-report.types";

function raw(overrides: Partial<RawProgressRow> = {}): RawProgressRow {
  return {
    kind: "BUILDING",
    parcelId: "p1",
    unitId: null,
    zoneId: "ZONE_09",
    zoneName: "Zone 9: Ga S5 Lê Thị Riêng (C&C)",
    projectParcelCode: "B-00001",
    parcelHouseNumber: "604",
    parcelStreet: "Cách Mạng Tháng Tám",
    parcelWard: "Nhiêu Lộc",
    parcelOwnerName: "Chủ hộ thửa 12",
    parcelOwnerPhone: null,
    parcelFloorCount: 1,
    parcelLotDepth: null,
    parcelFrontageWidth: null,
    parcelDistanceToCenterline: null,
    parcelSurveyStatus: "SUBMITTED",
    submittedLotDepth: null,
    submittedFrontageWidth: null,
    submittedBuildingHeight: null,
    unitCode: null,
    unitDisplayCode: null,
    unitFloorNumber: null,
    unitOwnerName: null,
    unitOwnerPhone: null,
    unitStatus: null,
    reportId: "r1",
    reportStatus: "SUBMITTED",
    reportCreatedAt: new Date("2026-10-14T03:00:00Z"),
    reportUpdatedAt: new Date("2026-10-14T09:00:00Z"),
    reportSubmittedAt: new Date("2026-10-14T09:00:00Z"),
    reportSurveyDate: null,
    reportIsRefusedOrAbsent: false,
    reportJson: {
      ecs: { ecsClass: "GOOD" },
      executiveSummary: { braStatus: "LOW" },
      constructionYear: 2008,
      ownerName: "Nguyễn Văn A ",
    },
    ownerRemarks: null,
    hasRelease: false,
    specBuildingName: null,
    specLandUseFunction: null,
    specFloorCount: null,
    specYear: null,
    specFoundationCategory: null,
    specFoundationDepth: null,
    specBuildingHeight: null,
    specFoundationCatScore: null,
    riskEcsClass: null,
    riskBra: null,
    riskOverriddenEcsClass: null,
    riskOverriddenBra: null,
    riskOverriddenBurland: null,
    riskJudgementApplied: false,
    monitoringRequired: false,
    masterJson: null,
    masterBuildingName: null,
    masterYear: null,
    absenceCount: 0,
    absenceFirstAt: null,
    absenceLastAt: null,
    absenceReason: null,
    absenceNotes: null,
    condoAbsenceState: null,
    computedSide: "RIGHT",
    gisDistanceCenterlineM: null,
    gisDistanceEdgeM: null,
    ...overrides,
  };
}

const tests: Array<[string, () => void]> = [
  [
    "Tách địa chỉ chuẩn hóa nguyên văn (không đổi Tháng 8, không đoán số nhà chung cư)",
    () => {
      assert.deepEqual(splitStandardizedAddress("Số 499/18 Cách Mạng Tháng Tám, Phường Hòa Hưng, TP. Hồ Chí Minh"), { houseNumber: "499/18", street: "Cách Mạng Tháng Tám", ward: "Hòa Hưng" });
      assert.deepEqual(splitStandardizedAddress("Số 493/2 Cách Mạng Tháng 8, Kp7, Phường Hòa Hưng, TP. Hồ Chí Minh"), { houseNumber: "493/2", street: "Cách Mạng Tháng 8, Kp7", ward: "Hòa Hưng" });
      assert.deepEqual(splitStandardizedAddress("497B, Cách Mạng Tháng Tám, Phường Hòa Hưng, TP. Hồ Chí Minh"), { houseNumber: "497B", street: "Cách Mạng Tháng Tám", ward: "Hòa Hưng" });
      assert.deepEqual(splitStandardizedAddress("Số 493/2A, Cách Mạng Tháng 8, Phường Hòa Hưng, TP. Hồ Chí Minh"), { houseNumber: "493/2A", street: "Cách Mạng Tháng 8", ward: "Hòa Hưng" });
      assert.deepEqual(splitStandardizedAddress("Số 521 Bis Cách Mạng Tháng Tám, Phường Hòa Hưng, TP. Hồ Chí Minh"), { houseNumber: "521 Bis", street: "Cách Mạng Tháng Tám", ward: "Hòa Hưng" });
      assert.deepEqual(splitStandardizedAddress("Chung cư 522-588, Đường Cách Mạng Tháng Tám, Phường Nhiêu Lộc, TP. Hồ Chí Minh"), { houseNumber: "", street: "Cách Mạng Tháng Tám", ward: "Nhiêu Lộc" });
      assert.equal(splitStandardizedAddress(""), null);
    },
  ],
  [
    "Excel lấy địa chỉ chuẩn hóa đã duyệt; chưa chuẩn hóa thì giữ địa chỉ gốc, không quy đổi phường",
    () => {
      const audited = normalizeRecord(raw({ parcelWard: "13", parcelStreet: "Phường 13", parcelHouseNumber: "499/18", reportJson: { houseNumber: "499/18  Cách Mạng Tháng Tám", street: "Cách Mạng Tháng Tám", standardizedAddress: "Số 499/18 Cách Mạng Tháng Tám, Phường Hòa Hưng, TP. Hồ Chí Minh" } }), CFG);
      assert.equal(audited.houseNumber, "499/18");
      assert.equal(audited.street, "Cách Mạng Tháng Tám");
      assert.equal(audited.ward, "Hòa Hưng");
      const original = normalizeRecord(raw({ parcelWard: "13", parcelHouseNumber: "475", reportJson: { houseNumber: "475", street: "Cách Mạng Tháng Tám" } }), CFG);
      assert.equal(original.ward, "13");
      assert.equal(original.houseNumber, "475");
      const condo = normalizeRecord(raw({ parcelHouseNumber: "522-588", reportJson: { houseNumber: "522-588", street: "CMT8", standardizedAddress: "Số Chung Cư 522-588 Cách Mạng Tháng Tám, Phường Nhiêu Lộc, TP. Hồ Chí Minh" } }), CFG);
      assert.equal(condo.houseNumber, "522-588");
      assert.equal(condo.street, "CMT8");
      assert.equal(condo.ward, "Nhiêu Lộc");
    },
  ],
  [
  "Đang thi công (đã nộp): nhãn riêng, không chấm BRA, không tính Cần theo dõi, để trống móng/tầng/năm/cao/hoàn công",
    () => {
      const row = raw({
        reportJson: {
          surveyCaseType: "UNDER_CONSTRUCTION",
          constructionStageNotes: "Đang ép cọc vuông.  Loại cọc 20x20, cọc sâu 5m",
          ecs: { ecsClass: "GOOD" },
          executiveSummary: { braStatus: "MEDIUM" },
          constructionYear: 2026,
          aboveFloors: 2,
          foundationType: "PILE",
          buildingHeightM: 7,
          frontageWidth: 5.8,
        },
      });
      assert.equal(classifyEcsCondition(row), "UNDER_CONSTRUCTION");
      assert.equal(classifyBraGrade(row), null);
      assert.equal(classifyCondition(row, CFG), "UNDER_CONSTRUCTION");
      assert.equal(mapSurveyProgress(row), "SURVEY_DONE_REPORTING");
      const rec = normalizeRecord(row, CFG);
      assert.equal(rec.notes, "Đang thi công: Đang ép cọc vuông. Loại cọc 20x20, cọc sâu 5m");
      assert.equal(rec.foundationType, "");
      assert.equal(rec.foundationDepth, null);
      assert.equal(rec.hasFoundationInfo, false);
      assert.equal(rec.floorsLabel, "");
      assert.equal(rec.constructionYear, null);
      assert.equal(rec.heightM, null);
      assert.equal(rec.asBuilt, "");
      assert.equal(rec.widthM, 5.8);
      assert.equal(rec.isSurveyed, true);
      const ctx = { config: CFG, rowIndex: 0 } as Parameters<typeof COL.condition.resolve>[1];
      assert.equal(COL.condition.resolve(rec, ctx), "Đang thi công");
      assert.equal(COL.condition.style(rec, ctx)?.fillArgb, CFG.colors.SITE_CASE);
      const summary = calculateSummary([rec], [rec], false, CFG);
      assert.equal(summary.total.underConstruction, 1);
      assert.equal(summary.total.monitor, 0);
      assert.equal(summary.total.surveyed, 1);
    },
  ],
  [
    "Đất trống (cờ isVacantLand hoặc surveyCaseType): nhãn Đất trống, ghi chú hiện trạng",
    () => {
      const byFlag = raw({ reportJson: { isVacantLand: true, vacantLandNotes: "Đất trống có rào tôn" } });
      const byCase = raw({ reportJson: { surveyCaseType: "VACANT_LAND", vacantLandStatus: "Bãi giữ xe" } });
      assert.equal(classifyEcsCondition(byFlag), "VACANT_LAND");
      assert.equal(classifyCondition(byCase, CFG), "VACANT_LAND");
      assert.equal(normalizeRecord(byFlag, CFG).notes, "Đất trống: Đất trống có rào tôn");
      assert.equal(normalizeRecord(byCase, CFG).notes, "Đất trống: Bãi giữ xe");
      assert.equal(calculateSummary([normalizeRecord(byCase, CFG)], [normalizeRecord(byCase, CFG)], false, CFG).total.vacantLand, 1);
    },
  ],
  [
    "Đang thi công còn nháp: vẫn Đang thực hiện, chưa gắn nhãn; vắng thì ưu tiên Không tiếp cận",
    () => {
      const draft = raw({ reportStatus: "DRAFT", reportJson: { surveyCaseType: "UNDER_CONSTRUCTION" } });
      assert.equal(classifyEcsCondition(draft), null);
      assert.equal(mapSurveyProgress(draft), "IN_PROGRESS");
      const absent = raw({ reportIsRefusedOrAbsent: true, reportJson: { surveyCaseType: "UNDER_CONSTRUCTION" } });
      assert.equal(classifyEcsCondition(absent), "INACCESSIBLE");
    },
  ],
  [
    "Config đã lưu trước đây (thiếu khóa Đang thi công / Đất trống / SITE_CASE) vẫn hợp lệ nhờ default",
    () => {
      const legacy = JSON.parse(JSON.stringify(CFG));
      delete legacy.labels.ecs.UNDER_CONSTRUCTION;
      delete legacy.labels.ecs.VACANT_LAND;
      delete legacy.labels.condition.UNDER_CONSTRUCTION;
      delete legacy.labels.condition.VACANT_LAND;
      delete legacy.colors.SITE_CASE;
      const parsed = progressReportConfigSchema.parse(legacy);
      assert.equal(parsed.labels.ecs.UNDER_CONSTRUCTION, "Đang thi công");
      assert.equal(parsed.labels.condition.VACANT_LAND, "Đất trống");
      assert.equal(parsed.colors.SITE_CASE, "FFBDD7EE");
    },
  ],
  [
    "default config hợp lệ theo schema",
    () => assert.equal(progressReportConfigSchema.safeParse(CFG).success, true),
  ],
  [
    "normalizeRiskValue bỏ hậu tố _RISK và PENDING",
    () => {
      assert.equal(normalizeRiskValue("HIGH_RISK"), "HIGH");
      assert.equal(normalizeRiskValue("pending"), "");
    },
  ],
  [
    "ECS GOOD + năm 2008 → Cũ; năm 2022 → Mới",
    () => {
      assert.equal(classifyCondition(raw(), CFG), "OLD");
      assert.equal(
        classifyCondition(
          raw({
            reportJson: { ecs: { ecsClass: "GOOD" }, constructionYear: 2022 },
          }),
          CFG,
        ),
        "NEW",
      );
    },
  ],
  [
    "BRA MEDIUM → Cần theo dõi",
    () =>
      assert.equal(
        classifyCondition(
          raw({
            reportJson: {
              ecs: { ecsClass: "GOOD" },
              executiveSummary: { braStatus: "MEDIUM" },
            },
          }),
          CFG,
        ),
        "MONITOR",
      ),
  ],
  [
    "BRA HIGH ưu tiên hơn MEDIUM → Nguy cơ cao",
    () =>
      assert.equal(
        classifyCondition(
          raw({
            reportJson: {
              ecs: { ecsClass: "DEFICIENT" },
              executiveSummary: { braStatus: "HIGH" },
            },
          }),
          CFG,
        ),
        "HIGH_RISK",
      ),
  ],
  [
    "Burland 4 → Nguy cơ cao",
    () =>
      assert.equal(
        classifyCondition(
          raw({
            reportJson: {
              ecs: { ecsClass: "GOOD" },
              burlandSummary: { localMaxGrade: 4 },
            },
          }),
          CFG,
        ),
        "HIGH_RISK",
      ),
  ],
  [
    "ECS MEDIUM → Xuống cấp",
    () =>
      assert.equal(
        classifyCondition(
          raw({
            reportJson: {
              ecs: { ecsClass: "MEDIUM" },
              executiveSummary: { braStatus: "LOW" },
            },
          }),
          CFG,
        ),
        "DEGRADED",
      ),
  ],
  [
    "Engineering judgement override được ưu tiên",
    () =>
      assert.equal(
        classifyCondition(
          raw({
            riskJudgementApplied: true,
            riskOverriddenBra: "VERY_HIGH_RISK",
          }),
          CFG,
        ),
        "HIGH_RISK",
      ),
  ],
  [
    "Hồ sơ DRAFT không phân loại",
    () =>
      assert.equal(
        classifyCondition(raw({ reportStatus: "DRAFT" }), CFG),
        null,
      ),
  ],
  [
    "Vắng mặt không có hồ sơ → Không tiếp cận được, AA trống",
    () => {
      const r = raw({
        reportId: null,
        reportStatus: null,
        reportJson: null,
        parcelSurveyStatus: "POSTPONED_ABSENT",
        absenceCount: 1,
      });
      assert.equal(isInaccessible(r), true);
      assert.equal(classifyCondition(r, CFG), "INACCESSIBLE");
      assert.equal(mapSurveyProgress(r), null);
    },
  ],
  [
    'Đã khảo sát lại sau vắng mặt → không còn "Không tiếp cận"',
    () => assert.equal(isInaccessible(raw({ absenceCount: 2 })), false),
  ],
  [
    "Trạng thái KS: APPROVED có release → Đã ký",
    () => {
      assert.equal(
        mapSurveyProgress(raw({ reportStatus: "APPROVED", hasRelease: true })),
        "REPORT_SIGNED",
      );
      assert.equal(
        mapSurveyProgress(raw({ reportStatus: "APPROVED" })),
        "REPORT_DONE",
      );
      assert.equal(
        mapSurveyProgress(raw({ reportStatus: "UNDER_REVIEW" })),
        "SURVEY_DONE_REPORTING",
      );
      assert.equal(
        mapSurveyProgress(raw({ reportStatus: "DRAFT" })),
        "IN_PROGRESS",
      );
    },
  ],
  [
    "Tên chủ hộ: lọc placeholder địa chính",
    () => {
      assert.equal(cleanOwnerName("Chủ hộ thửa 12 tờ 5"), "");
      assert.equal(cleanOwnerName("  Trần  Thị Huệ "), "Trần Thị Huệ");
    },
  ],
  [
    "Loại móng map đúng nhãn mẫu",
    () => {
      assert.equal(mapFoundationLabel("PC - Móng cọc ép BTCT"), "Móng cọc");
      assert.equal(
        mapFoundationLabel(
          "Shallow - Móng nông (Móng băng / Móng đơn / Móng bè)",
        ),
        "Móng nông",
      );
      assert.equal(
        mapFoundationLabel("CIP - Cọc khoan nhồi"),
        "Móng cọc khoan nhồi",
      );
      assert.equal(mapFoundationLabel("Chưa xác định"), "Không rõ");
    },
  ],
  ['toNumber đọc "38.7m"', () => assert.equal(toNumber("38.7m"), 38.7)],
  [
    "Station code từ tên zone",
    () => {
      assert.equal(
        resolveStationCode("ZONE_09", "Zone 9: Ga S5 Lê Thị Riêng (C&C)"),
        "ST05",
      );
      assert.equal(
        resolveStationCode(
          "ZONE_08",
          "Zone 8: Hầm TBM Hòa Hưng -> Lê Thị Riêng (POR)",
        ),
        "ZONE_08",
      );
    },
  ],
  [
    "Override Phải/Trái: force theo số nhà, fallback khi thiếu tọa độ",
    () => {
      const loc = {
        ward: "Hòa Hưng",
        street: "Cách Mạng Tháng Tám",
        houseNumber: "663",
      };
      const ov = [
        {
          ward: "",
          street: "Cách Mạng Tháng Tám",
          houseNumbers: ["663"],
          side: "RIGHT" as const,
          force: true,
        },
      ];
      assert.equal(resolveAlignmentSide("LEFT", loc, ov), "RIGHT");
      assert.equal(
        resolveAlignmentSide("LEFT", { ...loc, houseNumber: "669" }, ov),
        "LEFT",
      );
      assert.equal(
        resolveAlignmentSide(null, loc, [
          {
            ward: "Hòa Hưng",
            street: "",
            houseNumbers: [],
            side: "LEFT",
            force: false,
          },
        ]),
        "LEFT",
      );
    },
  ],
  [
    "Hình học: điểm bên trái/phải của đoạn thẳng hướng Bắc",
    () => {
      const line = [
        [106.7, 10.7],
        [106.7, 10.8],
      ] as const;
      assert.equal(computeAlignmentSide([106.69, 10.75], line).side, "LEFT");
      assert.equal(computeAlignmentSide([106.71, 10.75], line).side, "RIGHT");
      assert.equal(computeAlignmentSide(null, line).side, null);
    },
  ],
  [
    "Cửa sổ TODAY theo giờ VN",
    () => {
      const now = new Date("2026-10-28T02:00:00Z");
      const w = resolveTimeWindow(
        { zoneId: "ZONE_09", timeMode: "TODAY", templateId: "x" },
        now,
      );
      assert.equal(w.label, "Ngày 28/10/2026");
      assert.equal(isInWindow([new Date("2026-10-27T17:30:00Z")], w), true); // 00:30 VN ngày 28
      assert.equal(isInWindow([new Date("2026-10-27T16:30:00Z")], w), false); // 23:30 VN ngày 27
    },
  ],
  [
    "Ngày Excel quy về ngày lịch VN",
    () =>
      assert.equal(
        toVnCalendarDate(new Date("2026-09-28T17:00:00Z"))?.toISOString(),
        "2026-09-29T00:00:00.000Z",
      ),
  ],
  [
    "Căn hộ con: kế thừa tòa mẹ, ẩn móng/kích thước",
    () => {
      const rec = normalizeRecord(
        raw({
          kind: "CONDO_UNIT",
          unitId: "u1",
          unitCode: "B3",
          unitFloorNumber: 1,
          reportJson: {
            ecs: { ecsClass: "GOOD" },
            ownerName: "Phùng Thùy Hà An",
            foundationType: "PC",
          },
          masterJson: {
            buildingName: "Chung cư 552-558",
            constructionYear: 2008,
            street: "Cách Mạng Tháng Tám",
          },
        }),
        CFG,
      );
      assert.equal(rec.houseNumber, "B3 - Lầu 1");
      assert.equal(rec.floorsLabel, "Lầu 1");
      assert.equal(rec.buildingName, "Chung cư 552-558");
      assert.equal(rec.constructionYear, 2008);
      assert.equal(rec.foundationType, "");
      assert.equal(rec.widthM, null);
      assert.equal(rec.areaLabel, "ST05 Phải Tuyến");
    },
  ],
  [
    "Nhà dân vắng: để trống Số tầng / Năm XD (KSV điền bừa, Admin không sửa được); căn hộ vắng giữ tầng căn và năm tòa mẹ",
    () => {
      const absentHouse = normalizeRecord(
        raw({
          parcelSurveyStatus: "POSTPONED_ABSENT",
          reportIsRefusedOrAbsent: true,
          reportStatus: "SUBMITTED",
          absenceCount: 1,
          specFloorCount: 2,
          specYear: 2026,
          reportJson: { surveyCaseType: "ABSENTEE", isAbsenteeSurvey: true, aboveFloors: 2, constructionYear: 2026 },
        }),
        CFG,
      );
      assert.equal(absentHouse.floorsLabel, "");
      assert.equal(absentHouse.constructionYear, null);

      const absentUnit = normalizeRecord(
        raw({
          kind: "CONDO_UNIT",
          unitId: "u1",
          unitCode: "B3",
          unitFloorNumber: 1,
          condoAbsenceState: "ABSENT",
          reportJson: {},
          masterJson: { constructionYear: 2008 },
        }),
        CFG,
      );
      assert.equal(absentUnit.floorsLabel, "Lầu 1");
      assert.equal(absentUnit.constructionYear, 2008);
    },
  ],
  [
    "Các cột chốt để trống khi không có dữ liệu: Dài, Tổng số phòng, ĐV thiết kế, ĐV thi công",
    () => {
      const rec = normalizeRecord(raw(), CFG);
      assert.deepEqual(
        [
          rec.lengthM,
          rec.totalRooms,
          rec.designUnit,
          rec.constructionUnit,
        ],
        [null, null, "", ""],
      );
      assert.equal(rec.ownerName, "Nguyễn Văn A");
    },
  ],
  [
    "Tách 2 cột: Tình trạng hiện tại (ECS 4 mức + Không tiếp cận) và Mức độ đánh giá rủi ro (BRA 4 mức)",
    () => {
      assert.equal(classifyEcsCondition(raw({ reportJson: { ecs: { ecsClass: "GOOD" } } })), "GOOD");
      assert.equal(classifyEcsCondition(raw({ reportJson: { ecs: { ecsClass: "MEDIUM" } } })), "MEDIUM");
      assert.equal(classifyEcsCondition(raw({ reportJson: { ecs: { ecsClass: "DEFICIENT" } } })), "DEFICIENT");
      assert.equal(classifyEcsCondition(raw({ reportJson: { ecs: { ecsClass: "CRITICAL" } } })), "CRITICAL");
      assert.equal(
        classifyEcsCondition(
          raw({
            reportId: null,
            reportStatus: null,
            reportJson: null,
            parcelSurveyStatus: "POSTPONED_ABSENT",
            absenceCount: 1,
          }),
        ),
        "INACCESSIBLE",
      );

      assert.equal(classifyBraGrade(raw({ reportJson: { executiveSummary: { braStatus: "LOW" } } })), "LOW");
      assert.equal(classifyBraGrade(raw({ reportJson: { executiveSummary: { braStatus: "MEDIUM_RISK" } } })), "MEDIUM");
      assert.equal(classifyBraGrade(raw({ reportJson: { executiveSummary: { braStatus: "HIGH" } } })), "HIGH");
      assert.equal(classifyBraGrade(raw({ reportJson: { executiveSummary: { braStatus: "VERY_HIGH_RISK" } } })), "VERY_HIGH");
    },
  ],
  [
    "Dài/Rộng/Cao ưu tiên lấy từ hồ sơ SUBMITTED/APPROVED, không có thì để trống",
    () => {
      const rec = normalizeRecord(
        raw({
          submittedLotDepth: 7.3,
          submittedFrontageWidth: 3.5,
          submittedBuildingHeight: 6.5,
          parcelLotDepth: 10,
          parcelFrontageWidth: 5,
          specBuildingHeight: 9,
        }),
        CFG,
      );
      assert.equal(rec.lengthM, 7.3);
      assert.equal(rec.widthM, 3.5);
      assert.equal(rec.heightM, 6.5);
    },
  ],
  [
    "Biên kết cấu và Tim công trình ưu tiên tính theo GIS hiện tại",
    () => {
      const ring = parseGeoJsonOuterRingLngLat(
        JSON.stringify({
          type: "Polygon",
          coordinates: [
            [
              [106.6647, 10.7867],
              [106.6648, 10.7867],
              [106.6648, 10.7868],
              [106.6647, 10.7868],
              [106.6647, 10.7867],
            ],
          ],
        }),
      );
      const gis = computeGisDistances(ring, [106.66475, 10.78675]);
      assert.equal(typeof gis.distanceCenterlineM, "number");
      assert.equal(typeof gis.distanceEdgeM, "number");
      assert.equal((gis.distanceCenterlineM ?? -1) >= 0, true);
      assert.equal((gis.distanceEdgeM ?? -1) >= 0, true);

      const rec = normalizeRecord(
        raw({
          gisDistanceCenterlineM: 38.7,
          gisDistanceEdgeM: 22.9,
          parcelDistanceToCenterline: 99,
        }),
        CFG,
      );
      assert.equal(rec.distanceCenterlineM, 38.7);
      assert.equal(rec.distanceEdgeM, 22.9);
    },
  ],
  [
    "BRA tính lại từ I theo GIS hiện tại (bỏ I4 cũ trước nắn đất) và tiêu đề cột có (ECS)/(BRA)",
    () => {
      // Hồ sơ cũ lưu constructionImpactStatus = I4, braStatus = High do trước nắn đất khoảng cách < 5m,
      // nhưng GIS hiện tại cách biên ga 25.0m (>= 20m -> I1) và VI = MEDIUM (V2) -> V2 × I1 = LOW
      const r1 = raw({
        gisDistanceEdgeM: 25.0,
        gisDistanceCenterlineM: 35.0,
        reportJson: {
          objectGroup: "GENERAL",
          ecs: { ecsClass: "GOOD" },
          vi: { viClass: "MEDIUM", viAvg: 1.83 },
          executiveSummary: { constructionImpactStatus: "I4", braStatus: "High" },
        },
      });
      assert.equal(computeGisImpactCode(r1), "I1");
      assert.equal(resolveVulnerabilityCode(r1), "V2");
      assert.equal(classifyBraGrade(r1), "LOW");

      // GIS cách biên ga 15.0m (10m <= d < 20m -> I2) và VI = MEDIUM (V2) -> V2 × I2 = MEDIUM
      const r2 = raw({
        gisDistanceEdgeM: 15.0,
        gisDistanceCenterlineM: 25.0,
        reportJson: {
          objectGroup: "GENERAL",
          ecs: { ecsClass: "GOOD" },
          vi: { viClass: "MEDIUM", viAvg: 1.83 },
          executiveSummary: { constructionImpactStatus: "I4", braStatus: "High" },
        },
      });
      assert.equal(computeGisImpactCode(r2), "I2");
      assert.equal(classifyBraGrade(r2), "MEDIUM");

      // Kiểm tra tiêu đề cột có (ECS) và (BRA)
      assert.equal(COL.condition.header, "Tình trạng hiện tại (ECS)");
      assert.equal(COL.braRisk.header, "Mức độ đánh giá rủi ro (BRA)");
    },
  ],
  [
    "formatFloor",
    () => {
      assert.equal(formatFloor(0), "Trệt");
      assert.equal(formatFloor(3), "Lầu 3");
    },
  ],
  [
    "Summary: needed theo universe, chỉ tiêu theo tập lọc",
    () => {
      const a = normalizeRecord(raw(), CFG);
      const b = normalizeRecord(
        raw({
          computedSide: "LEFT",
          reportId: null,
          reportStatus: null,
          reportJson: null,
          parcelSurveyStatus: "POSTPONED_ABSENT",
          absenceCount: 1,
        }),
        CFG,
      );
      const s = calculateSummary([a, b], [a, b], false, CFG);
      assert.equal(s.total.needed, 2);
      assert.equal(s.total.surveyed, 1);
      assert.equal(s.total.inaccessible, 1);
      assert.equal(s.groups[0].label, "Phải Tuyến");
    },
  ],
  [
    "Template 29 cột A → AC, cột B là mã, không còn Khu Phố",
    () => {
      const keys = DAILY_PROGRESS_STATION_TEMPLATE.columns.map((c) => c.key);
      assert.equal(keys.length, 29);
      assert.equal(keys.includes("quarter"), false);
      assert.equal(keys[1], "code");
      assert.equal(keys[8], "buildingName");
      assert.equal(keys[28], "notes");
    },
  ],
  [
    "Cột mã: nhà dân = mã thửa; căn hộ = mã tòa / mã U, không lấy display_code; thiếu mã U thì null",
    () => {
      assert.equal(normalizeRecord(raw(), CFG).code, "B-00001");
      const unit = normalizeRecord(
        raw({ kind: "CONDO_UNIT", unitId: "u1", unitCode: "U-001", unitDisplayCode: "E3 lầu 4" }),
        CFG,
      );
      assert.equal(unit.code, "B-00001 / U-001");
      assert.equal(unit.houseNumber.includes("E3 lầu 4"), true);
      const missing = normalizeRecord(raw({ kind: "CONDO_UNIT", unitId: "u2", unitCode: null }), CFG);
      assert.equal(missing.code, null);
    },
  ],
  [
    "Định danh căn hộ: lớp phủ Admin, JSON sau diff là nguồn sự thật, lọc SĐT rác",
    () => {
      const unit = (reportJson: Record<string, unknown>) =>
        normalizeRecord(
          raw({ kind: "CONDO_UNIT", unitId: "u1", unitCode: "U-001", unitOwnerName: "Tên cũ cột", unitOwnerPhone: "0909000111", reportJson }),
          CFG,
        );
      const cleared = unit({ ownerName: "ueue", ownerPhone: "0987654321", adminIdentityOverrides: { ownerName: null, ownerPhone: null } });
      assert.equal(cleared.ownerName, "");
      assert.equal(cleared.ownerPhone, "");
      const renamed = unit({ ownerName: "Không rõ", adminIdentityOverrides: { ownerName: "Nguyễn Văn A" } });
      assert.equal(renamed.ownerName, "Nguyễn Văn A");
      const diffCleared = unit({ ownerName: "", ownerPhone: "" });
      assert.equal(diffCleared.ownerName, "");
      assert.equal(diffCleared.ownerPhone, "");
      assert.equal(unit({ ownerPhone: "1111" }).ownerPhone, "");
      const reopened = unit({ ownerName: "Trần Thị B", archivedAdminIdentityOverrides: { ownerName: null } });
      assert.equal(reopened.ownerName, "Trần Thị B");
      assert.equal(unit({}).ownerName, "Tên cũ cột");
    },
  ],
  [
    "Ngày hoàn thành = lúc nộp, không trôi theo updated_at khi Admin thẩm định/diff",
    () => {
      const submitted = new Date("2026-10-14T09:00:00Z");
      const audited = new Date("2026-11-02T04:30:00Z");
      for (const kind of ["BUILDING", "CONDO_UNIT"] as const) {
        const rec = normalizeRecord(
          raw({ kind, unitId: kind === "CONDO_UNIT" ? "u1" : null, unitCode: "U-001", reportStatus: "UNDER_REVIEW", reportSubmittedAt: submitted, reportUpdatedAt: audited }),
          CFG,
        );
        assert.equal(rec.endDate?.toISOString(), submitted.toISOString(), kind);
        assert.equal(rec.activityDates.some((d) => d.getTime() === audited.getTime()), false, kind);
      }
      const absentNoLog = normalizeRecord(
        raw({ kind: "CONDO_UNIT", unitId: "u2", unitCode: "U-002", condoAbsenceState: "ABSENT", reportSubmittedAt: submitted, reportUpdatedAt: audited }),
        CFG,
      );
      assert.equal(absentNoLog.endDate?.toISOString(), submitted.toISOString());
      const noSubmit = normalizeRecord(raw({ reportSubmittedAt: null, reportSurveyDate: null, reportUpdatedAt: audited }), CFG);
      assert.equal(noSubmit.endDate, null);
      const today = resolveTimeWindow({ zoneId: "ZONE_09", timeMode: "TODAY", templateId: "x" }, audited);
      const oldReport = normalizeRecord(raw({ reportCreatedAt: submitted, reportSubmittedAt: submitted, reportUpdatedAt: audited }), CFG);
      assert.equal(isInWindow(oldReport.activityDates, today), false);
    },
  ],
  [
    "Vắng căn hộ theo condo-absence.resolver: ABSENT/SUSPECTED không tiếp cận, ACCESS_HISTORY/NORMAL giữ điểm",
    () => {
      const unit = (state: "ABSENT" | "SUSPECTED" | "ACCESS_HISTORY" | "NORMAL") =>
        normalizeRecord(
          raw({
            kind: "CONDO_UNIT",
            unitId: "u1",
            unitCode: "U-001",
            condoAbsenceState: state,
            reportJson: { ecs: { ecsClass: "GOOD" }, residentStatus: "VẮNG_MẶT_KHÓA_CỬA" },
          }),
          CFG,
        );
      for (const state of ["ABSENT", "SUSPECTED"] as const) {
        const rec = unit(state);
        assert.equal(rec.ecsCondition, "INACCESSIBLE", state);
        assert.equal(rec.braGrade, null, state);
      }
      for (const state of ["ACCESS_HISTORY", "NORMAL"] as const) {
        assert.notEqual(unit(state).ecsCondition, "INACCESSIBLE", state);
      }
    },
  ],
  [
    "Công năng: đủ 13 lựa chọn form và các giá trị Khác thật",
    () => {
      const cases: Array<[string, string]> = [
        ["Nhà ở gia đình", "Nhà ở gia đình"],
        ["Nhà bỏ trống", "Nhà bỏ trống"],
        ["Chung cư / Toà nhiều căn hộ", "Chung cư"],
        ["Cửa hàng / Shop / Bách hóa", "Cửa hàng / Kinh doanh"],
        ["Quán ăn / Nhà hàng / Cafe", "Cửa hàng / Kinh doanh"],
        ["Văn phòng / Trụ sở cty", "Văn phòng"],
        ["Khách sạn / Nhà nghỉ / Căn hộ DV", "Khách sạn / Nhà nghỉ"],
        ["Bệnh viện / Y tế", "Bệnh viện / Y tế"],
        ["Trường học / Đào tạo", "Trường học / Đào tạo"],
        ["Kho hàng / Xưởng sản xuất", "Kho hàng / Xưởng sản xuất"],
        ["Cơ sở tôn giáo (Chùa, Nhà thờ)", "Cơ sở tôn giáo (Chùa, Nhà thờ)"],
        ["Công trình công cộng", "Công trình công cộng"],
        ["Khác: kho hàng", "Kho hàng / Xưởng sản xuất"],
        ["Khác: cho thuê", "cho thuê"],
        ["Khác: Nhà ở, Nhà cho thuê", "Nhà ở gia đình"],
        ["Khác: nhà ở , cửa hàng neca", "Hỗn hợp (Ở / Cửa hàng / VP)"],
        ["Nhà ở kết hợp kinh doanh", "Hỗn hợp (Ở / Cửa hàng / VP)"],
        ["Cửa hàng/Văn phòng", "Hỗn hợp (Ở / Cửa hàng / VP)"],
        ["Công ty/Văn phòng", "Văn phòng"],
        ["Đất thương mại dịch vụ", "Cửa hàng / Kinh doanh"],
        ["Bệnh viện nhân dân", "Bệnh viện nhân dân"],
        ["Phòng khám đa khoa", "Phòng khám đa khoa"],
        ["Văn phòng".normalize("NFD"), "Văn phòng"],
      ];
      for (const [input, expected] of cases) assert.equal(normalizeUsageFunction(input, false), expected, input);
    },
  ],
  [
    "Công năng: trống thì để trống với tòa nhà, không suy diễn nhà ở",
    () => {
      assert.equal(normalizeUsageFunction("", false), "");
      assert.equal(normalizeUsageFunction(null, false), "");
      assert.equal(normalizeUsageFunction("Khác: ", false), "");
      assert.equal(normalizeUsageFunction("", true), "Căn hộ chung cư");
      assert.equal(normalizeUsageFunction("Nhà ở gia đình", true), "Căn hộ chung cư");
      assert.equal(normalizeUsageFunction("Cửa hàng / Shop / Bách hóa", true), "Cửa hàng / Kinh doanh");
    },
  ],
  [
    "Tòa mẹ: thiếu hồ sơ hiện ---, không lặp chữ Chung cư",
    () => {
      const rec = normalizeRecord(
        raw({ kind: "CONDO_UNIT", unitId: "u1", parcelHouseNumber: "Chung cư 522-588", reportJson: {} }),
        CFG,
      );
      assert.equal(rec.buildingName, "Chung cư 522-588");
      assert.equal(
        rec.masterLabel,
        "TÒA NHÀ: CHUNG CƯ 522-588 - CÁCH MẠNG THÁNG TÁM, PHƯỜNG NHIÊU LỘC | Móng: --- | Số tầng: --- | Độ nghiêng: ---",
      );
    },
  ],
  [
    "Tòa mẹ: đọc móng, số tầng, độ nghiêng từ hồ sơ BUILDING_MASTER",
    () => {
      const rec = normalizeRecord(
        raw({
          kind: "CONDO_UNIT",
          unitId: "u1",
          reportJson: {},
          masterJson: {
            buildingName: "Chung cư A",
            foundationType: "PC - Móng cọc ép BTCT",
            foundationDepthM: 12,
            aboveFloors: 9,
            settlementTilt: { buildingTilt: { xPermille: 1.5, yPermille: "" } },
          },
        }),
        CFG,
      );
      assert.ok(rec.masterLabel?.includes("Móng: Móng cọc, sâu 12m | Số tầng: 9 | Độ nghiêng: X 1.5‰"));
    },
  ],
  [
    "Bố cục: nhà dân trước, căn hộ gom theo tòa, dòng phân khối đúng vị trí",
    () => {
      const unit = (parcelId: string, floor: number) =>
        normalizeRecord(raw({ kind: "CONDO_UNIT", parcelId, unitId: `${parcelId}-${floor}`, unitFloorNumber: floor }), CFG);
      const house = (parcelId: string) => normalizeRecord(raw({ parcelId }), CFG);
      const input = [unit("t1", 1), house("h1"), unit("t2", 1), unit("t1", 2), house("h2")];
      const { ordered, dividers } = arrangeRecords(input);
      assert.deepEqual(ordered.map((r) => r.unitId ?? r.parcelId), ["h1", "h2", "t1-1", "t1-2", "t2-1"]);
      assert.deepEqual(dividers.map((d) => [d.beforeRowIndex, d.kind]), [
        [0, "SECTION"],
        [2, "SECTION"],
        [2, "MASTER"],
        [4, "MASTER"],
      ]);
    },
  ],
  [
    "Bố cục: khối rỗng không sinh tiêu đề",
    () => {
      assert.deepEqual(arrangeRecords([]), { ordered: [], dividers: [] });
      const onlyHouses = arrangeRecords([normalizeRecord(raw(), CFG)]);
      assert.equal(onlyHouses.dividers.length, 1);
      const onlyUnits = arrangeRecords([normalizeRecord(raw({ kind: "CONDO_UNIT", unitId: "u1" }), CFG)]);
      assert.deepEqual(onlyUnits.dividers.map((d) => d.kind), ["SECTION", "MASTER"]);
      assert.equal(onlyUnits.dividers[0].beforeRowIndex, 0);
    },
  ],
  [
    "Ghi chú: căn hộ không có nhật ký, lý do trong absenteeInfo → tiếng Việt + ghi chú, không còn mã",
    () => {
      const rec = normalizeRecord(
        raw({
          kind: "CONDO_UNIT",
          unitId: "u55",
          unitCode: "U-055",
          condoAbsenceState: "ABSENT",
          reportJson: {
            absenteeReason: "HOMEOWNER_ABSENT",
            absenteeInfo: { absenceReason: "HOMEOWNER_ABSENT", notes: "Đã gõ cửa 3 lần" },
          },
        }),
        CFG,
      );
      assert.equal(rec.notes, `${ABSENCE_REASON_VI.HOMEOWNER_ABSENT} – Đã gõ cửa 3 lần`);
      assert.ok(!/HOMEOWNER_ABSENT/.test(rec.notes));
    },
  ],
  [
    "Ghi chú: residentStatus tiếng Việt (CHO_THUÊ) được dịch, mã lạ không in nguyên",
    () => {
      const rec = normalizeRecord(
        raw({
          kind: "CONDO_UNIT",
          unitId: "u67",
          unitCode: "U-067",
          condoAbsenceState: "ABSENT",
          reportJson: { residentStatus: "CHO_THUÊ" },
        }),
        CFG,
      );
      assert.equal(rec.notes, "Cho thuê (vắng tại thời điểm khảo sát)");
      assert.equal(isEnumCode("CHỦ_HỘ_Ở"), true);
      assert.equal(translateAbsenceReason("SOME_NEW_CODE"), "Some new code");
      assert.equal(translateAbsenceReason("Khác: Chủ đi nước ngoài"), "Chủ đi nước ngoài");
    },
  ],
  [
    "Ghi chú: nhà dân có nhãn cụ thể trong JSON thì không in kèm nhãn enum chung, không lặp",
    () => {
      const rec = normalizeRecord(
        raw({
          reportIsRefusedOrAbsent: true,
          absenceCount: 1,
          absenceReason: "HOMEOWNER_ABSENT",
          absenceNotes: "Chủ hộ vắng mặt dài ngày (khóa cửa ngoài)",
          reportJson: { absenteeReason: "Chủ hộ vắng mặt dài ngày (khóa cửa ngoài)" },
        }),
        CFG,
      );
      assert.equal(rec.notes, "Chủ hộ vắng mặt dài ngày (khóa cửa ngoài)");
      const logOnly = normalizeRecord(
        raw({
          reportIsRefusedOrAbsent: true,
          absenceReason: "HOMEOWNER_ABSENT",
          absenceNotes: "Chủ hộ vắng mặt dài ngày (khóa cửa ngoài)",
          reportJson: {},
        }),
        CFG,
      );
      assert.equal(logOnly.notes, "Chủ hộ vắng mặt dài ngày (khóa cửa ngoài)");
      for (const trivial of ["Không", "Vắng mặt."]) {
        const rec2 = normalizeRecord(
          raw({ reportIsRefusedOrAbsent: true, absenceReason: "HOMEOWNER_ABSENT", absenceNotes: trivial, reportJson: {} }),
          CFG,
        );
        assert.equal(rec2.notes, ABSENCE_REASON_VI.HOMEOWNER_ABSENT);
      }
    },
  ],
  [
    "Ghi chú: nhật ký OTHER + lý do tự nhập → in lý do tự nhập",
    () => {
      const rec = normalizeRecord(
        raw({
          reportIsRefusedOrAbsent: true,
          absenceReason: "OTHER",
          reportJson: { absenteeReason: "Lý do khác", customAbsenteeReason: "Nhà đang sửa chữa, không có người" },
        }),
        CFG,
      );
      assert.equal(rec.notes, "Nhà đang sửa chữa, không có người");
    },
  ],
  [
    "Ghi chú: công trình đã khảo sát để trống (hạn chế tiếp cận, ý kiến chủ hộ, lịch sử cải tạo thuộc báo cáo chi tiết)",
    () => {
      const rec = normalizeRecord(
        raw({
          reportJson: {
            ecs: { ecsClass: "GOOD" },
            accessLimitation: { type: "LIMITED", restrictedAreas: ["Sân thượng"], mainReason: "Chủ nhà đi vắng / Khóa cửa", notes: "" },
            historyInterview: { renovationYear: 2015, renovationNotes: "Nâng tầng" },
          },
          ownerRemarks: "Rung chấn khá thường xuyên",
        }),
        CFG,
      );
      assert.equal(rec.notes, "");
    },
  ],
  [
    "Móng: nhà vắng và hồ sơ nháp không in móng, không tính có TT móng",
    () => {
      const absent = normalizeRecord(
        raw({ reportIsRefusedOrAbsent: true, specFoundationCategory: "Móng băng", specFoundationDepth: 1.5 }),
        CFG,
      );
      assert.equal(absent.foundationType, "");
      assert.equal(absent.foundationDepth, null);
      assert.equal(absent.hasFoundationInfo, false);
      const draft = normalizeRecord(raw({ reportStatus: "DRAFT", specFoundationCategory: "Móng băng" }), CFG);
      assert.equal(draft.foundationType, "");
      assert.equal(draft.hasFoundationInfo, false);
      const ok = normalizeRecord(raw({ specFoundationCategory: "Móng băng" }), CFG);
      assert.equal(ok.foundationType, "Móng nông");
      assert.equal(ok.hasFoundationInfo, true);
    },
  ],
];

const asyncTests: Array<[string, () => Promise<void>]> = [
  [
    "Excel: % khảo sát/không tiếp cận chia cột C, % móng/theo dõi/nguy cơ cao chia cột D",
    async () => {
      const row = { label: "Phải Tuyến", needed: 10, surveyed: 4, inaccessible: 2, withFoundation: 3, monitor: 1, highRisk: 2 };
      const file = await new ExcelProgressRenderer().render([
        {
          name: "T",
          table: {
            templateId: "t",
            title: "T",
            periodLabel: "",
            generatedAtLabel: "",
            legend: [],
            columns: [],
            rows: [],
            dividers: [],
            summary: { groups: [row], total: { ...row, label: "TỔNG SỐ LƯỢNG" } },
            colors: CFG.colors,
          },
        },
      ]);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(file.buffer as unknown as ArrayBuffer);
      const ws = wb.worksheets[0];
      let r = 0;
      ws.eachRow((rowObj, idx) => {
        if (rowObj.getCell(2).value === "Phải Tuyến") r = idx;
      });
      assert.ok(r > 0);
      const formulaOf = (c: number): string => {
        const v = ws.getCell(r, c).value;
        return v && typeof v === "object" && "formula" in v ? String(v.formula) : "";
      };
      assert.equal(formulaOf(5), `IF(C${r}=0,"-",D${r}/C${r})`);
      assert.equal(formulaOf(7), `IF(C${r}=0,"-",F${r}/C${r})`);
      assert.equal(formulaOf(9), `IF(D${r}=0,"-",H${r}/D${r})`);
      assert.equal(formulaOf(11), `IF(D${r}=0,"-",J${r}/D${r})`);
      assert.equal(formulaOf(13), `IF(D${r}=0,"-",L${r}/D${r})`);
      const pct = ws.getCell(r, 13).value;
      assert.ok(pct && typeof pct === "object" && "result" in pct && pct.result === 0.5);
    },
  ],
];

async function runAll(): Promise<void> {
  let failed = 0;
  for (const [name, fn] of tests) {
    try {
      fn();
      console.log(`  ✓ ${name}`);
    } catch (err: unknown) {
      failed += 1;
      console.error(`  ✗ ${name}`, err);
    }
  }
  for (const [name, fn] of asyncTests) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
    } catch (err: unknown) {
      failed += 1;
      console.error(`  ✗ ${name}`, err);
    }
  }
  const total = tests.length + asyncTests.length;
  console.log(`\n${total - failed}/${total} passed`);
  if (failed > 0) process.exitCode = 1;
}

runAll().catch((err: unknown) => {
  console.error("[ProgressReportRulesTest:runAll]", err);
  process.exitCode = 1;
});
