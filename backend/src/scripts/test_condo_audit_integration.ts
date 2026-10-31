/**
 * Kiểm thử Strategy thẩm định Chung cư trên dữ liệu thật của DB local.
 * Mỗi kịch bản chạy trong transaction và luôn ROLLBACK ở cuối, không để lại thay đổi nào.
 * Chạy: npx ts-node src/scripts/test_condo_audit_integration.ts
 */
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import type { PoolClient } from 'pg';
import { Database } from '../database/db';
import { classifyCondoEntityKind } from '../modules/audit/condo/condo-entity-classifier';
import { CondoCrudEngineService } from '../modules/audit/condo/services/condo-crud-engine.service';
import { assertCondoSnapshotRestorable, normalizeCondoSnapshot } from '../modules/audit/condo/services/condo-snapshot-restore.helpers';
import { AuditReviewService } from '../modules/audit/services/audit-review.service';

dotenv.config();

class ScenarioRollback extends Error {}
let passed = 0;

async function inRollback(name: string, body: (client: PoolClient) => Promise<void>): Promise<void> {
  try {
    await Database.transaction(async (client) => {
      await body(client);
      throw new ScenarioRollback();
    });
  } catch (err) {
    if (!(err instanceof ScenarioRollback)) {
      console.error(`[FAIL] ${name}`);
      throw err;
    }
  }
  passed += 1;
  console.log(`[PASS] ${name}`);
}

const one = async (client: PoolClient, sql: string, params: unknown[]) => (await client.query(sql, params)).rows[0];
const activeZones = async (client: PoolClient, id: string): Promise<number> =>
  (await one(client, `SELECT COUNT(*)::int AS c FROM damage_zones WHERE report_id = $1 AND is_deleted IS NOT TRUE;`, [id])).c;

async function pickReport(where: string): Promise<string> {
  const res = await Database.query<{ id: string }>(
    `SELECT r.id FROM base_survey_reports r JOIN parcels p ON p.id = r.parcel_id LEFT JOIN building_units bu ON bu.id = r.unit_id
     WHERE r.deleted_at IS NULL AND r.status <> 'APPROVED' AND COALESCE(p.is_locked, false) = false AND ${where}
     ORDER BY r.created_at DESC LIMIT 1;`
  );
  assert.ok(res.rows[0], `Không có hồ sơ thỏa: ${where}`);
  return res.rows[0].id;
}

async function main(): Promise<void> {
  // Phân loại
  assert.equal(classifyCondoEntityKind({ unitId: 'u', unitType: 'MASTER', unitCode: '06.01', reportType: 'CONDO_UNIT' }), 'MASTER_AREA');
  assert.equal(classifyCondoEntityKind({ unitId: 'u', unitType: 'MASTER', unitCode: 'TER-02', reportType: 'CONDO_UNIT' }), 'MASTER_AREA');
  assert.equal(classifyCondoEntityKind({ unitId: 'u', unitType: 'UNIT', unitCode: 'M-Plus', reportType: 'CONDO_UNIT' }), 'CONDO_UNIT');
  assert.equal(classifyCondoEntityKind({ unitId: null, reportType: 'BUILDING_MASTER' }), 'BUILDING_MASTER');

  // Chuẩn hóa bản chụp
  assert.equal(normalizeCondoSnapshot({ zones: [{ zoneCode: 'Z-01' }], ownerName: 'A' }).isJsonOnly, true);
  assert.equal(normalizeCondoSnapshot({ zones: [{ zoneCode: 'Z-01' }] }).zones.length, 1);
  assert.equal(normalizeCondoSnapshot({ surveyJson: { damageZones: [], zones: [{ zoneCode: 'Z-01' }] }, leftPane: {} }).zones.length, 1);
  assert.equal(normalizeCondoSnapshot({ surveyJson: { a: 1 }, leftPane: { damageZones: [{ zone_code: 'Z-02' }] } }).zones.length, 1);
  assert.throws(() => assertCondoSnapshotRestorable(normalizeCondoSnapshot({})));

  const unitId = await pickReport(
    `r.report_type = 'CONDO_UNIT' AND bu.unit_type = 'UNIT' AND EXISTS (SELECT 1 FROM damage_zones z WHERE z.report_id = r.id AND z.is_deleted IS NOT TRUE)
     AND EXISTS (SELECT 1 FROM survey_report_versions v WHERE v.report_id = r.id AND v.version_tag = 'UNIT_CAD_SPATIAL_SWAP')`
  );
  const resolvedUnit = await CondoCrudEngineService.resolveCondoReportContext(unitId);
  assert.ok(resolvedUnit);
  assert.equal(resolvedUnit.entityKind, 'CONDO_UNIT');
  const unitStrategy = CondoCrudEngineService.getStrategy('CONDO_UNIT');
  const unitContext = resolvedUnit.context;
  const unitJson = () => ({ ...(unitContext.survey_data_json as Record<string, unknown>) });

  await inRollback('Unit: lưu không có khóa zone giữ nguyên Z/D và e1', async (client) => {
    const before = await activeZones(client, unitId);
    const e1Before = (await one(client, `SELECT e1_burland_score AS e1 FROM risk_score_cards WHERE report_id = $1;`, [unitId]))?.e1;
    await unitStrategy.applyCrudInTransaction(client, unitContext, unitJson(), { ownerName: 'Kiểm thử' }, 'test');
    assert.equal(await activeZones(client, unitId), before);
    assert.equal((await one(client, `SELECT e1_burland_score AS e1 FROM risk_score_cards WHERE report_id = $1;`, [unitId]))?.e1, e1Before);
  });

  await inRollback('Unit: chỉ sửa E không làm mất Z', async (client) => {
    const before = await one(client, `SELECT COUNT(*) FILTER (WHERE zone_code NOT LIKE 'E%')::int AS z FROM damage_zones WHERE report_id = $1 AND is_deleted IS NOT TRUE;`, [unitId]);
    const json = unitJson();
    await unitStrategy.applyCrudInTransaction(client, unitContext, json, { structuralElements: [{ elementCode: 'E-90', defects: [] }] }, 'test');
    const after = await one(client, `SELECT COUNT(*) FILTER (WHERE zone_code NOT LIKE 'E%')::int AS z FROM damage_zones WHERE report_id = $1 AND is_deleted IS NOT TRUE;`, [unitId]);
    assert.equal(after.z, before.z);
    const floors = json.floors as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(floors[0].zones));
    assert.equal((floors[0].zones as unknown[]).length, before.z);
  });

  await inRollback('Unit: mảng rỗng bị từ chối', async (client) => {
    await client.query('SAVEPOINT guard;');
    await assert.rejects(unitStrategy.applyCrudInTransaction(client, unitContext, unitJson(), { damageZones: [] }, 'test'));
    await client.query('ROLLBACK TO SAVEPOINT guard;');
  });

  await inRollback('Unit: mọi trường riêng xuống đủ SQL và JSON', async (client) => {
    const json = unitJson();
    await unitStrategy.applyCrudInTransaction(
      client,
      unitContext,
      json,
      {
        doorJammingStatus: 'JAMMED',
        doorJamming: { hasJamming: true, locations: 'Cửa WC', notes: 'Kẹt' },
        upperFloorWaterLeakage: { has: true, leakageItems: [{ id: 'x', location: 'Trần bếp' }] },
        settlementObserved: 'SLIGHT',
        settlementNotes: 'Nền bếp',
        beamSagging: { hasSagging: true, level: 2, sagMm: 12.5, notes: 'Võng giữa nhịp' },
        historyInterview: { renovationLoad: 2, renovationNotes: 'Đập tường' },
        hasSensitiveEquipment: true,
        sensitiveEquipmentDesc: 'Máy chủ',
        interiorRenovationHistory: { hasRenovated: true, description: 'Làm lại bếp' },
        unitAreaM2: 72.5,
        ownerFeedback: 'Đồng ý',
      },
      'test'
    );
    const def = await one(client, `SELECT beam_deflection_mm, e3_deformation_score, notes, details_json FROM deformation_assessments WHERE report_id = $1;`, [unitId]);
    assert.equal(Number(def.beam_deflection_mm), 12.5);
    assert.equal(def.e3_deformation_score, 2);
    assert.ok(String(def.notes).includes('JAMMED'));
    assert.equal(def.details_json.doorJammingStatus, 'JAMMED');
    const hist = await one(client, `SELECT extended_or_renovated, sensitive_equipment_present, details FROM historical_sensitivities WHERE report_id = $1;`, [unitId]);
    assert.equal(hist.extended_or_renovated, true);
    assert.equal(hist.sensitive_equipment_present, true);
    assert.equal(JSON.parse(hist.details).renovationNotes, 'Đập tường');
    assert.equal((json.settlementTilt as { beamSagging: { description: string } }).beamSagging.description, 'Võng giữa nhịp');
    assert.equal((json.signatures as { ownerFeedback: string }).ownerFeedback, 'Đồng ý');
    assert.equal((await one(client, `SELECT owner_remarks FROM base_survey_reports WHERE id = $1;`, [unitId])).owner_remarks, 'Đồng ý');
    const spec = await one(client, `SELECT construction_area_m2 FROM building_specifications WHERE report_id = $1;`, [unitId]);
    if (spec) assert.equal(Number(spec.construction_area_m2), 72.5);
  });

  await inRollback('Unit: đổi mã trùng bị chặn, đổi tầng cập nhật vị trí', async (client) => {
    const other = await one(
      client,
      `SELECT unit_code FROM building_units WHERE parcel_id = $1 AND id <> $2 AND deleted_at IS NULL LIMIT 1;`,
      [unitContext.parcel_id, unitContext.unit_id]
    );
    if (other) {
      await client.query('SAVEPOINT dup;');
      await assert.rejects(
        unitStrategy.applyCrudInTransaction(client, unitContext, unitJson(), { unitCode: other.unit_code }, 'test'),
        /đã tồn tại/
      );
      await client.query('ROLLBACK TO SAVEPOINT dup;');
    }
    const json = unitJson();
    await unitStrategy.applyCrudInTransaction(client, unitContext, json, { floorNumber: 77 }, 'test');
    const unit = await one(client, `SELECT floor_number, floor_plan_id, cad_bbox FROM building_units WHERE id = $1;`, [unitContext.unit_id]);
    assert.equal(Number(unit.floor_number), 77);
    assert.equal(unit.floor_plan_id, null);
    assert.equal(unit.cad_bbox, null);
    assert.equal(json.floorNumber, 77);
  });

  await inRollback('Unit: lưu chỉ ghim giữ Z/D, ghim tới floors[0], rollback trả tọa độ', async (client) => {
    const before = await activeZones(client, unitId);
    const json = unitJson();
    const movedPins = [{ zoneCode: 'Z-01', pinX: 11, pinY: 22, pin_x: 11, pin_y: 22 }];
    await unitStrategy.applyCrudInTransaction(client, unitContext, json, { cadZonePins: movedPins, photoRotations: { floor_0_cad: 90 } }, 'test');
    assert.equal(await activeZones(client, unitId), before);
    const floor = (json.floors as Array<Record<string, unknown>>)[0];
    assert.deepEqual(floor.cadZonePins, movedPins);
    assert.ok(Array.isArray(floor.zones) && floor.zones.length > 0);
    assert.equal((json.photoRotations as Record<string, number>).floor_0_cad, 90);
    const original = unitJson();
    const snapshot = normalizeCondoSnapshot(original);
    const { restoredSurveyJson } = await unitStrategy.restoreSnapshotInTransaction(client, unitContext, snapshot, 'test', {
      restoreCadPosition: false,
      currentJson: json,
    });
    assert.deepEqual(restoredSurveyJson.cadZonePins, original.cadZonePins);
  });

  await inRollback('Unit: sửa ghim D xuống defect_items', async (client) => {
    const row = await one(client, `SELECT d.id, z.id AS zone_id FROM defect_items d JOIN damage_zones z ON z.id = d.zone_id WHERE z.report_id = $1 AND d.is_deleted IS NOT TRUE LIMIT 1;`, [unitId]);
    if (!row) return;
    const json = unitJson();
    const zones = (json.zones as Array<Record<string, unknown>>).map((zone) => ({ ...zone }));
    const zone = zones.find((item) => Array.isArray(item.defects) && (item.defects as unknown[]).length > 0);
    assert.ok(zone);
    zone.defects = (zone.defects as Array<Record<string, unknown>>).map((defect) => ({ ...defect, pinX: 12.5, pinY: 34.5 }));
    await unitStrategy.applyCrudInTransaction(client, unitContext, json, { damageZones: zones }, 'test');
    const pinned = await one(client, `SELECT COUNT(*)::int AS c FROM defect_items d JOIN damage_zones z ON z.id = d.zone_id WHERE z.report_id = $1 AND d.pin_x = 12.5 AND d.pin_y = 34.5;`, [unitId]);
    assert.ok(pinned.c > 0);
  });

  const versions = await Database.query<{ version_number: number; version_tag: string; snapshot_data: Record<string, unknown> }>(
    `SELECT version_number, version_tag, snapshot_data FROM survey_report_versions WHERE report_id = $1 ORDER BY version_number;`,
    [unitId]
  );
  for (const version of versions.rows) {
    await inRollback(`Unit rollback v${version.version_number} (${version.version_tag})`, async (client) => {
      const parcelBefore = await one(client, `SELECT owner_name, floor_count, updated_at FROM parcels WHERE id = $1;`, [unitContext.parcel_id]);
      const snapshot = normalizeCondoSnapshot(version.snapshot_data);
      assertCondoSnapshotRestorable(snapshot);
      const { restoredSurveyJson } = await unitStrategy.restoreSnapshotInTransaction(client, unitContext, snapshot, 'test', {
        restoreCadPosition: false,
        currentJson: unitJson(),
      });
      assert.ok(Object.keys(restoredSurveyJson).length > 5, 'JSON sau khôi phục không được rỗng');
      const stored = await one(client, `SELECT survey_data_json, status::text AS status FROM base_survey_reports WHERE id = $1;`, [unitId]);
      assert.equal(stored.status, 'UNDER_REVIEW');
      assert.equal(await activeZones(client, unitId), [...snapshot.zones, ...snapshot.elements].filter((z) => !z.isDeleted && !z.is_deleted).length);
      assert.equal(Array.isArray(stored.survey_data_json.floors), true);
      assert.deepEqual(await one(client, `SELECT owner_name, floor_count, updated_at FROM parcels WHERE id = $1;`, [unitContext.parcel_id]), parcelBefore);
      const leftDef = snapshot.leftPane.deformation as Record<string, unknown> | undefined;
      if (leftDef) {
        const def = await one(client, `SELECT e3_deformation_score, notes FROM deformation_assessments WHERE report_id = $1;`, [unitId]);
        assert.equal(def.e3_deformation_score, leftDef.e3_deformation_score);
        assert.equal(def.notes, leftDef.notes ?? null);
      }
    });
  }

  const areaId = await pickReport(`bu.unit_type = 'MASTER' AND EXISTS (SELECT 1 FROM damage_zones z WHERE z.report_id = r.id)`);
  const resolvedArea = await CondoCrudEngineService.resolveCondoReportContext(areaId);
  assert.ok(resolvedArea);
  assert.equal(resolvedArea.entityKind, 'MASTER_AREA');
  await inRollback('M-Area: lưu areaInfo, giữ Z/E, khu vực khóa ghi đúng phạm vi', async (client) => {
    const json = { ...(resolvedArea.context.survey_data_json as Record<string, unknown>) };
    const before = await activeZones(client, areaId);
    await CondoCrudEngineService.getStrategy('MASTER_AREA').applyCrudInTransaction(
      client,
      resolvedArea.context,
      json,
      { areaInfo: { accessStatus: 'LOCKED', lockedReason: 'Không có chìa khóa' } },
      'test'
    );
    assert.equal(await activeZones(client, areaId), before);
    assert.equal((json.accessLimitation as { type: string }).type, 'REFUSED');
    assert.equal((await one(client, `SELECT survey_coverage::text AS c FROM survey_scopes WHERE report_id = $1;`, [areaId])).c, 'KHONG_THE_TIEP_CAN');
  });

  const masterId = await pickReport(`r.report_type = 'BUILDING_MASTER' AND EXISTS (SELECT 1 FROM building_specifications s WHERE s.report_id = r.id)`);
  const resolvedMaster = await CondoCrudEngineService.resolveCondoReportContext(masterId);
  assert.ok(resolvedMaster);
  assert.equal(resolvedMaster.entityKind, 'BUILDING_MASTER');
  const masterStrategy = CondoCrudEngineService.getStrategy('BUILDING_MASTER');
  await inRollback('Master: sửa rồi rollback về bản chụp trả lại từng bảng', async (client) => {
    const view = (await AuditReviewService.getSplitPaneAuditView(masterId)) as unknown as Record<string, unknown>;
    const snapshot = normalizeCondoSnapshot(view);
    const specBefore = await one(client, `SELECT adjacent_buildings, pile_dimensions_text, land_use_function FROM building_specifications WHERE report_id = $1;`, [masterId]);
    const parcelBefore = await one(client, `SELECT owner_name, mutation_type::text AS mutation FROM parcels WHERE id = $1;`, [resolvedMaster.context.parcel_id]);
    const json = { ...(resolvedMaster.context.survey_data_json as Record<string, unknown>) };
    await masterStrategy.applyCrudInTransaction(
      client,
      resolvedMaster.context,
      json,
      {
        adjacentBuildings: { left: { details: 'Nhà 5 tầng' } },
        pileDimensionMm: '400x400',
        foundationCatScore: 3,
        managementContactName: 'BQL Kiểm thử',
        historyInterview: { pastSettlement: 1, settlementNotes: 'Lún nhẹ' },
        accessLimitation: { type: 'PARTIAL', notes: 'Khóa phòng máy' },
        gisMutationConfirmed: { type: 'MERGE' },
      },
      'test'
    );
    const spec = await one(client, `SELECT adjacent_buildings, pile_dimensions_text, foundation_cat_score, land_use_function FROM building_specifications WHERE report_id = $1;`, [masterId]);
    assert.ok(String(spec.adjacent_buildings).includes('Nhà 5 tầng'));
    assert.equal(spec.pile_dimensions_text, '400x400');
    assert.equal(spec.foundation_cat_score, 3);
    assert.equal(spec.land_use_function, specBefore?.land_use_function ?? null);
    assert.equal(json.ownerName, 'BQL Kiểm thử');
    assert.equal(json.pileDimension, '400x400');
    assert.equal((await one(client, `SELECT survey_coverage::text AS c FROM survey_scopes WHERE report_id = $1;`, [masterId])).c, 'MOT_PHAN');
    assert.equal((await one(client, `SELECT mutation_type::text AS m FROM parcels WHERE id = $1;`, [resolvedMaster.context.parcel_id])).m, 'MERGE');

    await masterStrategy.restoreSnapshotInTransaction(client, resolvedMaster.context, snapshot, 'test', {
      restoreCadPosition: true,
      currentJson: json,
    });
    const restored = await one(client, `SELECT adjacent_buildings, pile_dimensions_text FROM building_specifications WHERE report_id = $1;`, [masterId]);
    assert.equal(restored.adjacent_buildings, specBefore?.adjacent_buildings ?? null);
    assert.equal(restored.pile_dimensions_text, specBefore?.pile_dimensions_text ?? null);
    assert.equal((await one(client, `SELECT owner_name FROM parcels WHERE id = $1;`, [resolvedMaster.context.parcel_id])).owner_name, parcelBefore.owner_name);
  });

  console.log(`\nĐạt ${passed} kịch bản.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[test_condo_audit_integration] Thất bại:', err);
  process.exit(1);
});
