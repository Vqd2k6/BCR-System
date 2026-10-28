/**
 * Unit test các hàm thuần (pure) của plugin Progress Report – không cần DB.
 * Chạy: cd backend && npx ts-node --transpile-only src/scripts/progress_report_rules.test.ts
 */
import assert from "node:assert/strict";
import {
  classifyCondition,
  isInaccessible,
  normalizeRiskValue,
} from "../modules/progress-report/rules/condition.classifier";
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
} from "../modules/progress-report/rules/record.normalizer";
import {
  resolveTimeWindow,
  isInWindow,
  toVnCalendarDate,
} from "../modules/progress-report/rules/time-window";
import { toNumber } from "../modules/progress-report/rules/json-reader";
import { computeAlignmentSide } from "../modules/progress-report/geo/alignment-geometry";
import { calculateSummary } from "../modules/progress-report/summary/summary.calculator";
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
    parcelFrontageWidth: null,
    parcelDistanceToCenterline: null,
    parcelSurveyStatus: "SUBMITTED",
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
    computedSide: "RIGHT",
    ...overrides,
  };
}

const tests: Array<[string, () => void]> = [
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
    "Các cột chốt để trống: Khu phố, Dài, Tổng số phòng, ĐV thiết kế, ĐV thi công",
    () => {
      const rec = normalizeRecord(raw(), CFG);
      assert.deepEqual(
        [
          rec.quarter,
          rec.lengthM,
          rec.totalRooms,
          rec.designUnit,
          rec.constructionUnit,
        ],
        ["", null, null, "", ""],
      );
      assert.equal(rec.ownerName, "Nguyễn Văn A");
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
];

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
console.log(`\n${tests.length - failed}/${tests.length} passed`);
if (failed > 0) process.exitCode = 1;
