import { Database } from '../database/db';

export const ZONE_SEGMENT_PREFIX_MAP: Record<string, { type: string; seq: number; prefix: string; slugPrefix: string }> = {
  ZONE_01: { type: 'C&C', seq: 1, prefix: 'C&C-01', slugPrefix: 'CC-01' },
  ZONE_02: { type: 'POR', seq: 1, prefix: 'POR-01', slugPrefix: 'POR-01' },
  ZONE_03: { type: 'C&C', seq: 2, prefix: 'C&C-02', slugPrefix: 'CC-02' },
  ZONE_04: { type: 'POR', seq: 2, prefix: 'POR-02', slugPrefix: 'POR-02' },
  ZONE_05: { type: 'C&C', seq: 3, prefix: 'C&C-03', slugPrefix: 'CC-03' },
  ZONE_06: { type: 'POR', seq: 3, prefix: 'POR-03', slugPrefix: 'POR-03' },
  ZONE_07: { type: 'C&C', seq: 4, prefix: 'C&C-04', slugPrefix: 'CC-04' },
  ZONE_08: { type: 'POR', seq: 4, prefix: 'POR-04', slugPrefix: 'POR-04' },
  ZONE_09: { type: 'C&C', seq: 5, prefix: 'C&C-05', slugPrefix: 'CC-05' },
  ZONE_10: { type: 'POR', seq: 5, prefix: 'POR-05', slugPrefix: 'POR-05' },
  ZONE_11: { type: 'C&C', seq: 6, prefix: 'C&C-06', slugPrefix: 'CC-06' },
  ZONE_12: { type: 'POR', seq: 6, prefix: 'POR-06', slugPrefix: 'POR-06' },
  ZONE_13: { type: 'C&C', seq: 7, prefix: 'C&C-07', slugPrefix: 'CC-07' },
  ZONE_14: { type: 'POR', seq: 7, prefix: 'POR-07', slugPrefix: 'POR-07' },
  ZONE_15: { type: 'C&C', seq: 8, prefix: 'C&C-08', slugPrefix: 'CC-08' },
  ZONE_16: { type: 'POR', seq: 8, prefix: 'POR-08', slugPrefix: 'POR-08' },
  ZONE_17: { type: 'C&C', seq: 9, prefix: 'C&C-09', slugPrefix: 'CC-09' },
  ZONE_18: { type: 'POR', seq: 9, prefix: 'POR-09', slugPrefix: 'POR-09' },
  ZONE_19: { type: 'C&C', seq: 10, prefix: 'C&C-10', slugPrefix: 'CC-10' },
  ZONE_20: { type: 'POR', seq: 10, prefix: 'POR-10', slugPrefix: 'POR-10' },
  ZONE_21: { type: 'C&C', seq: 11, prefix: 'C&C-11', slugPrefix: 'CC-11' },
  ZONE_22: { type: 'DEP', seq: 1, prefix: 'DEP-01', slugPrefix: 'DEP-01' },
};

async function standardizeParcelCodes() {
  console.log('[MIGRATION] Bắt đầu chuẩn hóa mã thửa đất theo quy tắc [LOẠI]-[STT]-[B-XXXX]...');

  await Database.transaction(async (client) => {
    // 1. Lấy danh sách các zone có dữ liệu trong bảng parcels
    const zonesRes = await client.query<{ zone_id: string }>(
      'SELECT DISTINCT zone_id FROM parcels WHERE zone_id IS NOT NULL ORDER BY zone_id;'
    );

    let totalUpdated = 0;

    for (const z of zonesRes.rows) {
      const zoneId = z.zone_id;
      const zoneMeta = ZONE_SEGMENT_PREFIX_MAP[zoneId];
      if (!zoneMeta) {
        console.warn(`[SKIP] Không tìm thấy metadata cho zone ${zoneId}`);
        continue;
      }

      // Lấy tất cả thửa đất trong zone, sắp xếp theo project_parcel_code cũ
      const parcelsRes = await client.query<{ id: string; project_parcel_code: string }>(
        'SELECT id, project_parcel_code FROM parcels WHERE zone_id = $1 ORDER BY project_parcel_code ASC, id ASC;',
        [zoneId]
      );

      console.log(`[ZONE] Đang chuẩn hóa ${parcelsRes.rows.length} thửa đất của ${zoneId} (${zoneMeta.prefix})...`);

      for (let i = 0; i < parcelsRes.rows.length; i++) {
        const parcel = parcelsRes.rows[i];
        const seqNum = i + 1;
        const parcelNumber = `B-${String(seqNum).padStart(4, '0')}`;
        const newProjectParcelCode = `${zoneMeta.prefix}-${parcelNumber}`;
        const newCodeSlug = `${zoneMeta.slugPrefix}-${parcelNumber}`;

        // Cập nhật parcels
        await client.query(
          'UPDATE parcels SET project_parcel_code = $1, code_slug = $2, segment_type = $3 WHERE id = $4;',
          [newProjectParcelCode, newCodeSlug, zoneMeta.type, parcel.id]
        );

        // Cập nhật survey_data_json trong base_survey_reports nếu có
        await client.query(
          `UPDATE base_survey_reports 
           SET survey_data_json = jsonb_set(survey_data_json, '{projectParcelCode}', to_jsonb($1::text), true)
           WHERE parcel_id = $2 AND survey_data_json IS NOT NULL;`,
          [newProjectParcelCode, parcel.id]
        );

        totalUpdated++;
      }
    }

    console.log(`[MIGRATION SUCCESS] Đã chuẩn hóa thành công ${totalUpdated} thửa đất!`);
  });

  process.exit(0);
}

standardizeParcelCodes().catch((err) => {
  console.error('[MIGRATION ERROR]', err);
  process.exit(1);
});
