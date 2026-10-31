import assert from 'assert';
import { Database, pool } from '../database/db';
import { buildApprovedSnapshot } from '../modules/report/snapshot/snapshot-builder';
import {
  fetchCondoUnitAbsenceMap,
  resolveCondoUnitAbsence,
  type CondoAbsenceState,
  type CondoUnitAbsenceInput,
} from '../modules/audit/condo/condo-absence.resolver';

const baseInput: CondoUnitAbsenceInput = {
  isRefusedOrAbsent: false,
  unitStatus: 'SUBMITTED',
  reportStatus: 'SUBMITTED',
  surveyJson: { ownerName: 'Nguyễn Văn A', ownerPhone: '0912663946' },
  ownLogCount: 0,
  zoneCount: 5,
  roomDefectCount: 0,
};

function testRules(): void {
  const state = (patch: Partial<CondoUnitAbsenceInput>) => resolveCondoUnitAbsence({ ...baseInput, ...patch }).state;

  assert.strictEqual(state({}), 'NORMAL');
  assert.strictEqual(state({ isRefusedOrAbsent: true, roomDefectCount: 9 }), 'ABSENT', 'Cờ DB luôn thắng khuyết tật');
  assert.strictEqual(state({ unitStatus: 'POSTPONED_ABSENT_VERIFIED' }), 'ABSENT');
  assert.strictEqual(state({ ownLogCount: 1 }), 'ABSENT');
  assert.strictEqual(state({ ownLogCount: 1, roomDefectCount: 1 }), 'ACCESS_HISTORY');
  assert.strictEqual(state({ surveyJson: { residentStatus: 'BỎ_TRỐNG_CHƯA_VỀ_Ở' } }), 'ABSENT');

  // Object absenteeInfo mặc định của store không phải dấu hiệu vắng
  const stubInfo = { absenceReason: 'HOMEOWNER_ABSENT', notes: '', absenteeMinutesPhotos: [] };
  assert.strictEqual(state({ surveyJson: { ...baseInput.surveyJson, absenteeInfo: stubInfo } }), 'NORMAL');

  assert.strictEqual(state({ surveyJson: { ownerName: 'Không rõ', ownerPhone: '1111' } }), 'SUSPECTED');
  assert.strictEqual(state({ surveyJson: { ownerName: 'Không rõ' }, roomDefectCount: 1 }), 'NORMAL');
  assert.strictEqual(state({ zoneCount: 0 }), 'SUSPECTED');

  const decide = (decision: string) => ({ absenceDecision: { decision, reason: 'Admin đối chiếu ảnh hiện trường' } });
  assert.strictEqual(state({ zoneCount: 0, surveyJson: decide('ABSENT') }), 'ABSENT');
  assert.strictEqual(state({ zoneCount: 0, surveyJson: decide('NOT_ABSENT') }), 'NORMAL');
  assert.strictEqual(state({ ownLogCount: 2, surveyJson: decide('NOT_ABSENT') }), 'ACCESS_HISTORY');
  assert.strictEqual(state({ isRefusedOrAbsent: true, surveyJson: decide('NOT_ABSENT') }), 'ABSENT', 'Quyết định không gỡ được cờ DB');
  console.log('✅ Quy tắc phân loại đúng');
}

async function testRealData(): Promise<void> {
  const res = await Database.query<{ id: string; unit_code: string }>(
    `SELECT r.id, u.unit_code
     FROM base_survey_reports r JOIN building_units u ON u.id = r.unit_id
     WHERE u.unit_type = 'UNIT' AND r.status::text <> 'DRAFT';`
  );
  const absenceMap = await fetchCondoUnitAbsenceMap(res.rows.map((row) => row.id));

  const counts: Record<CondoAbsenceState, number> = { ABSENT: 0, ACCESS_HISTORY: 0, SUSPECTED: 0, NORMAL: 0 };
  const byCode = new Map<string, CondoAbsenceState>();
  const suspected: string[] = [];
  for (const row of res.rows) {
    const state = absenceMap.get(row.id)?.state;
    assert.ok(state, `Thiếu kết quả phân loại cho ${row.unit_code}`);
    counts[state] += 1;
    byCode.set(row.unit_code, state);
    if (state === 'SUSPECTED') suspected.push(row.unit_code);
  }
  console.log('Phân bố:', counts);
  console.log('Nghi vắng:', suspected.sort().join(', '));

  assert.deepStrictEqual(counts, { ABSENT: 27, ACCESS_HISTORY: 2, SUSPECTED: 11, NORMAL: 76 });
  assert.strictEqual(byCode.get('U-048'), 'ABSENT');
  assert.strictEqual(byCode.get('U-007'), 'ABSENT');
  assert.strictEqual(byCode.get('U-001'), 'ACCESS_HISTORY');
  assert.strictEqual(byCode.get('U-074'), 'ACCESS_HISTORY');
  console.log('✅ Dữ liệu thật khớp phân tích');
}

/** Thẻ điểm giả của căn vắng bị loại khỏi snapshot nhưng bản ghi gốc phải còn nguyên; chạy trong ROLLBACK. */
async function testSnapshotProjection(): Promise<void> {
  const reportIdOf = async (unitCode: string) => {
    const res = await Database.query<{ id: string }>(
      `SELECT r.id FROM base_survey_reports r JOIN building_units u ON u.id = r.unit_id
       WHERE u.unit_code = $1 AND r.status::text <> 'DRAFT' LIMIT 1;`,
      [unitCode]
    );
    return res.rows[0].id;
  };
  const absentId = await reportIdOf('U-007');
  const normalId = await reportIdOf('U-012');
  const adminRes = await Database.query<{ id: string }>(`SELECT id FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1;`);
  const liveCounts = async () => {
    const res = await Database.query<{ zones: string; cards: string }>(
      `SELECT (SELECT COUNT(*) FROM damage_zones WHERE report_id = $1) AS zones,
              (SELECT COUNT(*) FROM risk_score_cards WHERE report_id = $1) AS cards;`,
      [absentId]
    );
    return res.rows[0];
  };
  const before = await liveCounts();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const absent = await buildApprovedSnapshot(client, absentId, adminRes.rows[0].id, new Date());
    assert.strictEqual(absent.ecs.ecsClass, null, 'Căn vắng không được có xếp loại ECS');
    assert.strictEqual(absent.ecs.total, null);
    assert.strictEqual(absent.vi.viClass, null);
    assert.strictEqual(absent.bra?.finalRiskLevelVi, null, 'Căn vắng không được có mức rủi ro');
    assert.deepStrictEqual(absent.frozenReportData?.damageZones, []);
    assert.strictEqual(absent.frozenSurveyDataJson?.isAbsenteeSurvey, true);
    assert.strictEqual(absent.frozenSurveyDataJson?.ownerFeedback, undefined);
    const logs = absent.frozenReportData?.absenceLogs as unknown[];
    assert.strictEqual(logs.length, 5, 'Chỉ đóng băng nhật ký của chính căn U-007');

    const normal = await buildApprovedSnapshot(client, normalId, adminRes.rows[0].id, new Date());
    assert.notStrictEqual(normal.ecs.ecsClass, null, 'Căn bình thường giữ nguyên điểm');
    assert.ok((normal.frozenReportData?.damageZones as unknown[]).length > 0);
    assert.strictEqual((normal.frozenReportData?.absenceLogs as unknown[]).length, 0, 'Căn bình thường không nhận log căn khác');
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
  assert.deepStrictEqual(await liveCounts(), before, 'Bản ghi gốc không được thay đổi');
  console.log('✅ Snapshot loại dữ liệu rác, bản ghi gốc còn nguyên:', before);
}

async function main(): Promise<void> {
  testRules();
  await testRealData();
  await testSnapshotProjection();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[test_condo_absence_resolver] Thất bại:', err);
    process.exit(1);
  });
