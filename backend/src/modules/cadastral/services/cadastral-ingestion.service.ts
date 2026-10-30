import fs from 'fs';
import path from 'path';
import { CryptoUtils } from '../../../common/utils/crypto.utils';
import { Pool } from 'pg';
import { Database, pool } from '../../../database/db';
import { ZONE_SEGMENT_PREFIX_MAP, ZonePrefixMeta } from '../../../common/constants/zone-prefixes';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../../../common/errors/problem-details';
import { EXCLUDED_LIFECYCLE_STATUSES } from '../utils/parcel-exclusion';

function toValidUuidOrNull(val?: string | null): string | null {
  if (!val) return null;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(val) ? val : null;
}

export interface RawParcelItem {
  mathuadat: string | number;
  soto?: string | number;
  sothua?: string | number;
  dientich?: number;
  dientich_formatted?: string;
  tenquanhuyen?: string;
  tenphuongxa?: string;
  tendoan?: string;
  ranh_coords: [number, number][];
  latitude: number;
  longitude: number;
  logioi_details?: Array<{
    tenduong?: string;
    logioi?: number;
    huongtiepgiap?: string;
    chieungang?: number;
    chieusau?: number;
    dientichxd?: number;
  }>;
  chucnang_summary?: string;
  chitieu_summary?: string;
  [key: string]: unknown;
}

export interface ZoneOverviewItem {
  zoneCode: string;
  zoneName: string;
  type: string;
  prefix: string;
  slugPrefix: string;
  seq: number;
  zoiBufferMeters: number;
  totalParcelsCount: number;
  approvedParcelsCount: number;
  surveyedParcelsCount: number;
  unSurveyedParcelsCount: number;
  isActive: boolean;
  assignedAdmin: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  serverDataFile: {
    exists: boolean;
    filePath?: string;
    fileSizeBytes?: number;
    parcelsInFile?: number;
  };
}

export interface ZoneAuditResult {
  zoneCode: string;
  zoneMeta: ZonePrefixMeta;
  totalIncoming: number;
  validParcelsCount: number;
  invalidGeometryCount: number;
  duplicatesOtherZones: Array<{
    mathuadat: string;
    existingZoneId: string;
    existingProjectCode: string;
  }>;
  existingZoneParcelsCount: number;
  existingSurveyedCount: number;
  canImport: boolean;
  isCleanReimport: boolean;
  codePreview: {
    startCode: string;
    endCode: string;
    slugStartCode: string;
    slugEndCode: string;
  };
  sampleParcels: Array<{
    mathuadat: string;
    projectParcelCode: string;
    codeSlug: string;
    soto: string;
    sothua: string;
    dientich: number;
    street: string;
    ward: string;
    district: string;
    latitude: number;
    longitude: number;
    ranhCoords: [number, number][];
  }>;
}

export class CadastralIngestionService {
  /**
   * 1. Lấy danh sách tổng quan 22 Zone kèm tình trạng dữ liệu CSDL và tệp server
   */
  static async getZonesOverview(): Promise<ZoneOverviewItem[]> {
    const query = `
      SELECT 
        z.id,
        z.zone_code,
        z.zone_name,
        z.total_parcels_count,
        z.approved_parcels_count,
        z.is_active,
        z.assigned_admin_id,
        u.full_name as admin_full_name,
        u.email as admin_email,
        COUNT(p.id) as db_actual_parcels,
        COUNT(p.id) FILTER (WHERE p.survey_status != 'NOT_SURVEYED') as surveyed_count,
        COUNT(p.id) FILTER (WHERE p.survey_status = 'NOT_SURVEYED') as unsurveyed_count
      FROM metro_zones z
      LEFT JOIN users u ON z.assigned_admin_id = u.id
      LEFT JOIN parcels p ON z.zone_code = p.zone_id AND p.lifecycle_status = 'ACTIVE'
      GROUP BY z.id, z.zone_code, z.zone_name, z.total_parcels_count, z.approved_parcels_count, z.is_active, z.assigned_admin_id, u.full_name, u.email
      ORDER BY z.zone_code ASC;
    `;

    const res = await Database.query(query);
    const dbMap = new Map<string, any>(res.rows.map(r => [r.zone_code, r]));

    const overview: ZoneOverviewItem[] = [];

    for (const [code, meta] of Object.entries(ZONE_SEGMENT_PREFIX_MAP)) {
      const dbRow = dbMap.get(code);

      // Quét kiểm tra tệp data/Zone_XX/ban_do_data.json trên server nếu có
      const zoneFolder = code.replace('ZONE_', 'Zone_');
      const serverFilePath = path.resolve(process.cwd(), `../data/${zoneFolder}/ban_do_data.json`);
      let serverFileExists = false;
      let serverFileSize = 0;
      let parcelsInFile = 0;

      if (fs.existsSync(serverFilePath)) {
        try {
          const stat = fs.statSync(serverFilePath);
          serverFileExists = true;
          serverFileSize = stat.size;
          // Đọc sơ bộ parcel count
          const content = JSON.parse(fs.readFileSync(serverFilePath, 'utf8'));
          parcelsInFile = Object.keys(content.parcels || {}).length;
        } catch {
          // Bỏ qua nếu lỗi đọc định dạng
        }
      }

      overview.push({
        zoneCode: code,
        zoneName: meta.name,
        type: meta.type,
        prefix: meta.prefix,
        slugPrefix: meta.slugPrefix,
        seq: meta.seq,
        zoiBufferMeters: meta.zoiBufferMeters,
        totalParcelsCount: Number(dbRow?.db_actual_parcels || dbRow?.total_parcels_count || 0),
        approvedParcelsCount: Number(dbRow?.approved_parcels_count || 0),
        surveyedParcelsCount: Number(dbRow?.surveyed_count || 0),
        unSurveyedParcelsCount: Number(dbRow?.unsurveyed_count || 0),
        isActive: Boolean(dbRow?.is_active),
        assignedAdmin: dbRow?.assigned_admin_id ? {
          id: dbRow.assigned_admin_id,
          fullName: dbRow.admin_full_name,
          email: dbRow.admin_email,
        } : null,
        serverDataFile: {
          exists: serverFileExists,
          filePath: serverFileExists ? serverFilePath : undefined,
          fileSizeBytes: serverFileSize,
          parcelsInFile,
        },
      });
    }

    return overview;
  }

  /**
   * 2. Thẩm định sơ bộ tệp dữ liệu trước khi nạp (Pre-Import Audit)
   */
  static async auditZonePayload(zoneCode: string, rawParcels: RawParcelItem[]): Promise<ZoneAuditResult> {
    const meta = ZONE_SEGMENT_PREFIX_MAP[zoneCode];
    if (!meta) {
      throw new BadRequestError(`Mã Zone '${zoneCode}' không hợp lệ trong danh mục 22 Zone toàn tuyến.`);
    }

    if (!Array.isArray(rawParcels) || rawParcels.length === 0) {
      throw new BadRequestError('Dữ liệu thửa đất rỗng hoặc không đúng định dạng mảng JSON.');
    }

    // 1. Kiểm tra hiện trạng Zone trong CSDL
    const statusQuery = await Database.query(
      `SELECT 
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE survey_status != 'NOT_SURVEYED') as surveyed_count
       FROM parcels WHERE zone_id = $1;`,
      [zoneCode]
    );

    const existingTotal = Number(statusQuery.rows[0]?.total_count || 0);
    const existingSurveyed = Number(statusQuery.rows[0]?.surveyed_count || 0);
    const isCleanReimport = existingTotal > 0 && existingSurveyed === 0;

    // 2. Lấy danh sách các mã địa chính ở các Zone KHÁC để kiểm tra FCFS
    const otherZonesParcels = await Database.query(
      `SELECT official_cadastral_code, zone_id, project_parcel_code 
       FROM parcels 
       WHERE zone_id != $1 AND official_cadastral_code IS NOT NULL;`,
      [zoneCode]
    );

    const otherMap = new Map<string, { zone_id: string; project_parcel_code: string }>();
    for (const r of otherZonesParcels.rows) {
      otherMap.set(String(r.official_cadastral_code), {
        zone_id: r.zone_id,
        project_parcel_code: r.project_parcel_code,
      });
    }

    const duplicatesOtherZones: ZoneAuditResult['duplicatesOtherZones'] = [];
    const validParcels: RawParcelItem[] = [];
    const seenCodesInBatch = new Set<string>();
    let invalidGeometryCount = 0;

    for (const p of rawParcels) {
      const code = String(p.mathuadat || '').trim();
      if (!code) {
        invalidGeometryCount++;
        continue;
      }

      // Check FCFS trùng zone khác
      if (otherMap.has(code)) {
        const exist = otherMap.get(code)!;
        duplicatesOtherZones.push({
          mathuadat: code,
          existingZoneId: exist.zone_id,
          existingProjectCode: exist.project_parcel_code,
        });
        continue;
      }

      // Check trùng lặp nội bộ trong cùng file JSON tải lên
      if (seenCodesInBatch.has(code)) {
        continue;
      }

      // Check tọa độ hợp lệ
      const lat = Number(p.latitude);
      const lng = Number(p.longitude);
      if (
        isNaN(lat) ||
        isNaN(lng) ||
        lat < 10.0 ||
        lat > 11.5 ||
        lng < 106.0 ||
        lng > 107.5 ||
        !Array.isArray(p.ranh_coords) ||
        p.ranh_coords.length < 3
      ) {
        invalidGeometryCount++;
        continue;
      }

      seenCodesInBatch.add(code);
      validParcels.push(p);
    }

    const validCount = validParcels.length;
    const startCode = validCount > 0 ? `${meta.prefix}-B-0001` : '---';
    const endCode = validCount > 0 ? `${meta.prefix}-B-${String(validCount).padStart(4, '0')}` : '---';
    const slugStartCode = validCount > 0 ? `${meta.slugPrefix}-B-0001` : '---';
    const slugEndCode = validCount > 0 ? `${meta.slugPrefix}-B-${String(validCount).padStart(4, '0')}` : '---';

    // Điều kiện được phép nạp: Phải có ít nhất 1 thửa hợp lệ VÀ (Zone chưa có dữ liệu HOẶC 100% NOT_SURVEYED)
    const canImport = validCount > 0 && (existingTotal === 0 || existingSurveyed === 0);

    // Mẫu các thửa xem trước (lấy tối đa 100 thửa đại diện cho Preview Layer)
    const sampleParcels = validParcels.slice(0, 100).map((p, idx) => {
      const seqStr = String(idx + 1).padStart(4, '0');
      const street = p.logioi_details?.[0]?.tenduong || p.tenphuongxa || 'Đường chính';
      return {
        mathuadat: String(p.mathuadat),
        projectParcelCode: `${meta.prefix}-B-${seqStr}`,
        codeSlug: `${meta.slugPrefix}-B-${seqStr}`,
        soto: String(p.soto || '1'),
        sothua: String(p.sothua || idx + 1),
        dientich: Number(p.dientich || 0),
        street,
        ward: String(p.tenphuongxa || ''),
        district: String(p.tenquanhuyen || ''),
        latitude: p.latitude,
        longitude: p.longitude,
        ranhCoords: p.ranh_coords,
      };
    });

    return {
      zoneCode,
      zoneMeta: meta,
      totalIncoming: rawParcels.length,
      validParcelsCount: validCount,
      invalidGeometryCount,
      duplicatesOtherZones,
      existingZoneParcelsCount: existingTotal,
      existingSurveyedCount: existingSurveyed,
      canImport,
      isCleanReimport,
      codePreview: {
        startCode,
        endCode,
        slugStartCode,
        slugEndCode,
      },
      sampleParcels,
    };
  }

  /**
   * 3. Thực thi nạp chính thức vào PostgreSQL Local theo Transaction an toàn
   */
  static async executeImportZone(
    zoneCode: string,
    rawParcels: RawParcelItem[],
    performedByUserId?: string,
    forceCleanReimport: boolean = false
  ): Promise<{ insertedCount: number; startCode: string; endCode: string; zoneCode: string }> {
    const meta = ZONE_SEGMENT_PREFIX_MAP[zoneCode];
    if (!meta) {
      throw new BadRequestError(`Mã Zone '${zoneCode}' không tồn tại.`);
    }

    return await Database.transaction(async (client) => {
      // 1. Kiểm tra an toàn: Nếu zone đã có dữ liệu
      const checkRes = await client.query(
        `SELECT 
          COUNT(*) as total_count,
          COUNT(*) FILTER (WHERE survey_status != 'NOT_SURVEYED') as surveyed_count
         FROM parcels WHERE zone_id = $1;`,
        [zoneCode]
      );
      const totalInZone = Number(checkRes.rows[0]?.total_count || 0);
      const surveyedInZone = Number(checkRes.rows[0]?.surveyed_count || 0);

      if (surveyedInZone > 0) {
        throw new BadRequestError(
          `KHÓA CHẶN AN TOÀN: Zone ${zoneCode} hiện có ${surveyedInZone} thửa đất đã phát sinh khảo sát hiện trường. Tuyệt đối không thể nạp đè để bảo vệ hồ sơ pháp lý!`
        );
      }

      if (totalInZone > 0) {
        if (!forceCleanReimport) {
          throw new BadRequestError(
            `Zone ${zoneCode} đã có ${totalInZone} thửa đất tồn tại. Vui lòng xác nhận tùy chọn 'Làm sạch & Nạp lại' (Clean Re-import) để tiếp tục.`
          );
        }
        // Nạp lại sẽ xóa thửa NOT_SURVEYED: chặn để không mất quyết định loại trừ đã ghi nhận
        const excludedRes = await client.query<{ count: string }>(
          `SELECT COUNT(*) AS count FROM parcels WHERE zone_id = $1 AND lifecycle_status::text = ANY($2::text[]);`,
          [zoneCode, [...EXCLUDED_LIFECYCLE_STATUSES]]
        );
        const excludedInZone = Number(excludedRes.rows[0]?.count || 0);
        if (excludedInZone > 0) {
          throw new BadRequestError(
            `KHÓA CHẶN AN TOÀN: Zone ${zoneCode} có ${excludedInZone} thửa đã loại trừ khỏi khảo sát. Vui lòng khôi phục các thửa này trước khi nạp lại để không mất quyết định loại trừ.`
          );
        }
        // Làm sạch an toàn các thửa đất cũ chưa khảo sát
        await client.query("DELETE FROM parcels WHERE zone_id = $1 AND survey_status = 'NOT_SURVEYED';", [zoneCode]);
      }

      // 2. Lấy danh sách các mã địa chính ở các Zone KHÁC (FCFS Deduplication)
      const otherRes = await client.query(
        `SELECT official_cadastral_code FROM parcels WHERE zone_id != $1 AND official_cadastral_code IS NOT NULL;`,
        [zoneCode]
      );
      const otherSet = new Set(otherRes.rows.map(r => String(r.official_cadastral_code)));
      const seenCodesInBatch = new Set<string>();

      let insertedCount = 0;
      let startCode = '';
      let endCode = '';

      for (const p of rawParcels) {
        const mathuadat = String(p.mathuadat || '').trim();
        if (!mathuadat || otherSet.has(mathuadat) || seenCodesInBatch.has(mathuadat)) {
          continue; // Bỏ qua nếu rỗng, đã thuộc zone khác (FCFS), hoặc trùng lặp trong batch
        }
        seenCodesInBatch.add(mathuadat);

        const coords = p.ranh_coords;
        const lat = Number(p.latitude);
        const lng = Number(p.longitude);
        if (
          isNaN(lat) ||
          isNaN(lng) ||
          lat < 10.0 ||
          lat > 11.5 ||
          lng < 106.0 ||
          lng > 107.5 ||
          !Array.isArray(coords) ||
          coords.length < 3
        ) {
          continue; // Bỏ qua nếu lỗi hình học
        }

        insertedCount++;
        const seqStr = String(insertedCount).padStart(4, '0');
        const projectParcelCode = `${meta.prefix}-B-${seqStr}`;
        const codeSlug = `${meta.slugPrefix}-B-${seqStr}`;

        if (!startCode) startCode = projectParcelCode;
        endCode = projectParcelCode;

        if (insertedCount % 100 === 0) {
          console.log(`[CadastralIngestion] Đang nạp ${zoneCode}: đã xử lý ${insertedCount} thửa...`);
        }

        // Chuẩn hóa closed ring WKT
        const pts = coords.map(([lat, lng]) => `${lng} ${lat}`);
        if (pts[0] !== pts[pts.length - 1]) {
          pts.push(pts[0]);
        }
        const wkt = `POLYGON((${pts.join(', ')}))`;

        const sothua = p.sothua ? String(p.sothua) : String(insertedCount);
        const soto = p.soto ? String(p.soto) : '1';
        const street = p.logioi_details?.[0]?.tenduong || p.tenphuongxa || 'Đường chính';
        const ward = p.tenphuongxa || '';
        const district = p.tenquanhuyen || '';
        const landArea = parseFloat(String(p.dientich)) || 65.0;
        const constructionArea = Math.round(landArea * 0.85 * 10) / 10;

        await client.query(`
          INSERT INTO parcels (
            zone_id,
            segment_type,
            project_parcel_code,
            code_slug,
            official_cadastral_code,
            field_survey_code,
            house_number,
            street,
            ward,
            district,
            owner_name,
            owner_phone,
            land_area_m2,
            construction_area_m2,
            floor_count,
            building_type,
            total_units,
            survey_status,
            lifecycle_status,
            location_geom,
            cadastral_polygon_geom,
            footprint_polygon_geom
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19,
            ST_SetSRID(ST_MakePoint($20, $21), 4326),
            ST_MakeValid(ST_SetSRID(ST_PolygonFromText($22), 4326)),
            ST_MakeValid(ST_SetSRID(ST_PolygonFromText($22), 4326))
          );
        `, [
          zoneCode,
          meta.type,
          projectParcelCode,
          codeSlug,
          mathuadat,
          `KS-${zoneCode}-${mathuadat}`.slice(0, 32),
          sothua,
          street,
          ward,
          district,
          `Chủ hộ thửa ${sothua} (Tờ ${soto})`,
          '090' + String(1000000 + (insertedCount % 9000000)),
          landArea,
          constructionArea,
          2,
          'STANDALONE',
          1,
          'NOT_SURVEYED',
          'ACTIVE',
          p.longitude,
          p.latitude,
          wkt,
        ]);
      }

      // 3. Cập nhật số lượng và trạng thái sẵn sàng khảo sát (is_active = TRUE)
      await client.query(`
        UPDATE metro_zones 
        SET total_parcels_count = $1, 
            is_active = TRUE
        WHERE zone_code = $2;
      `, [insertedCount, zoneCode]);

      // 4. Ghi vết nhật ký hệ thống (Audit Log)
      const zoneIdRes = await client.query('SELECT id FROM metro_zones WHERE zone_code = $1;', [zoneCode]);
      const zoneId = zoneIdRes.rows[0]?.id;

      if (zoneId) {
        await client.query(`
          INSERT INTO system_audit_logs (
            entity_type, entity_id, action, performed_by_user_id, diff_payload
          ) VALUES (
            'METRO_ZONE', $1, 'ZONE_DATA_IMPORT', $2, $3
          );
        `, [
          zoneId,
          toValidUuidOrNull(performedByUserId),
          JSON.stringify({
            zoneCode,
            insertedCount,
            startCode,
            endCode,
            forceCleanReimport,
            timestamp: new Date().toISOString(),
          }),
        ]);
      }

      return {
        insertedCount,
        startCode,
        endCode,
        zoneCode,
      };
    });
  }

  /**
   * 4. Bật / Tắt trạng thái công bố Zone (Publish / Activate Zone)
   */
  static async setZoneActive(zoneCode: string, isActive: boolean, performedByUserId?: string): Promise<void> {
    if (isActive) {
      const countRes = await Database.query(
        `SELECT COUNT(*) as count FROM parcels WHERE zone_id = $1;`,
        [zoneCode]
      );
      const count = Number(countRes.rows[0]?.count || 0);
      if (count === 0) {
        throw new BadRequestError(`Không thể công bố phân đoạn [${zoneCode}] vì chưa có dữ liệu thửa đất. Vui lòng nạp bản đồ trước khi công bố.`);
      }
    }

    const res = await Database.query(
      `UPDATE metro_zones SET is_active = $1 WHERE zone_code = $2 RETURNING id;`,
      [isActive, zoneCode]
    );

    if (res.rowCount === 0) {
      throw new NotFoundError(`Không tìm thấy Zone với mã: ${zoneCode}`);
    }

    const zoneId = res.rows[0].id;
    await Database.query(`
      INSERT INTO system_audit_logs (
        entity_type, entity_id, action, performed_by_user_id, diff_payload
      ) VALUES (
        'METRO_ZONE', $1, 'ZONE_ACTIVATION_CHANGE', $2, $3
      );
    `, [
      zoneId,
      toValidUuidOrNull(performedByUserId),
      JSON.stringify({ zoneCode, isActive, updatedAt: new Date().toISOString() }),
    ]);
  }

  /**
   * 5. Phân công Zone Admin phụ trách phân khu (Đồng bộ 2 chiều metro_zones <-> users)
   */
  static async assignZoneAdmin(zoneCode: string, adminUserId: string | null, performedByUserId?: string): Promise<void> {
    if (adminUserId) {
      const userRes = await Database.query('SELECT id, role FROM users WHERE id = $1;', [adminUserId]);
      if (userRes.rows.length === 0) {
        throw new NotFoundError('Không tìm thấy người dùng được chỉ định.');
      }
      if (userRes.rows[0].role !== 'ZONE_ADMIN' && userRes.rows[0].role !== 'SUPER_ADMIN') {
        throw new BadRequestError('Chỉ người dùng có vai trò ZONE_ADMIN hoặc SUPER_ADMIN mới được phân công quản lý Zone.');
      }
    }

    await Database.transaction(async (client) => {
      // 1. Kiểm tra Zone tồn tại và lấy admin hiện tại
      const currentZoneRes = await client.query(
        'SELECT id, assigned_admin_id FROM metro_zones WHERE zone_code = $1;',
        [zoneCode]
      );
      if (currentZoneRes.rowCount === 0) {
        throw new NotFoundError(`Không tìm thấy Zone với mã: ${zoneCode}`);
      }

      const zoneId = currentZoneRes.rows[0].id;
      const previousAdminId = currentZoneRes.rows[0].assigned_admin_id;

      // 2. Nếu admin cũ khác admin mới, xóa assigned_zone_id của admin cũ
      if (previousAdminId && previousAdminId !== adminUserId) {
        await client.query(
          `UPDATE users SET assigned_zone_id = NULL WHERE id = $1 AND assigned_zone_id = $2;`,
          [previousAdminId, zoneCode]
        );
      }

      // 3. Cập nhật assigned_admin_id cho metro_zones
      await client.query(
        `UPDATE metro_zones SET assigned_admin_id = $1 WHERE zone_code = $2;`,
        [adminUserId, zoneCode]
      );

      // 4. Nếu có admin mới, đồng bộ assigned_zone_id trong bảng users
      if (adminUserId) {
        await client.query(
          `UPDATE users SET assigned_zone_id = $1 WHERE id = $2;`,
          [zoneCode, adminUserId]
        );
      }

      // 5. Ghi vết Audit Log
      await client.query(`
        INSERT INTO system_audit_logs (
          entity_type, entity_id, action, performed_by_user_id, diff_payload
        ) VALUES (
          'METRO_ZONE', $1, 'ZONE_ADMIN_ASSIGNMENT', $2, $3
        );
      `, [
        zoneId,
        toValidUuidOrNull(performedByUserId),
        JSON.stringify({
          zoneCode,
          assignedAdminId: adminUserId,
          previousAdminId,
          updatedAt: new Date().toISOString(),
        }),
      ]);
    });
  }

  /**
   * 6. Đồng bộ dữ liệu Zone lên Cloud Production (có tạo bản sao lưu snapshot tự động)
   */
  static async syncZoneToCloud(
    zoneCode: string,
    adminUserId: string,
    adminPassword: string
  ): Promise<{ snapshotPath: string; cloudSyncedCount: number }> {
    // 1. Xác thực mật khẩu Super Admin
    const userRes = await Database.query('SELECT password_hash FROM users WHERE id = $1;', [adminUserId]);
    if (!userRes.rows[0]?.password_hash) {
      throw new UnauthorizedError('Tài khoản không hợp lệ hoặc chưa thiết lập mật khẩu.');
    }

    const match = await CryptoUtils.comparePassword(adminPassword, userRes.rows[0].password_hash);
    if (!match) {
      throw new UnauthorizedError('Mật khẩu Super Admin không chính xác. Từ chối đồng bộ Cloud!');
    }

    // 2. Tự động sao lưu Snapshot cục bộ trước khi đẩy
    const backupDir = path.resolve(process.cwd(), 'backups/cloud_snapshots');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const snapshotPath = path.join(backupDir, `pre_sync_zone_${zoneCode}_${timestamp}.json`);

    const localParcels = await Database.query(
      `SELECT * FROM parcels WHERE zone_id = $1 ORDER BY project_parcel_code ASC;`,
      [zoneCode]
    );

    const snapshotData = {
      timestamp: new Date().toISOString(),
      zoneCode,
      totalParcels: localParcels.rows.length,
      parcels: localParcels.rows,
    };

    fs.writeFileSync(snapshotPath, JSON.stringify(snapshotData, null, 2), 'utf8');

    // 3. Kết nối Remote Pool và đồng bộ
    const remoteDbUrl = process.env.REMOTE_DATABASE_URL;
    const remoteHost = process.env.REMOTE_DB_HOST || 'aws-0-ap-southeast-1.pooler.supabase.com';
    const remotePassword = process.env.REMOTE_DB_PASSWORD || process.env.DB_PASSWORD;

    const remoteConfig = remoteDbUrl
      ? { connectionString: remoteDbUrl, ssl: { rejectUnauthorized: false } }
      : {
        host: remoteHost,
        port: parseInt(process.env.REMOTE_DB_PORT || '6543', 10),
        user: process.env.REMOTE_DB_USER || 'postgres.zmbydzpytqyjnnawdssd',
        password: remotePassword,
        database: process.env.REMOTE_DB_NAME || 'postgres',
        ssl: { rejectUnauthorized: false },
      };

    const remotePool = new Pool(remoteConfig);
    let cloudSyncedCount = 0;

    try {
      const rClient = await remotePool.connect();
      try {
        await rClient.query('BEGIN;');

        // Đảm bảo metro_zones trên cloud có zoneCode
        await rClient.query(`
          INSERT INTO metro_zones (zone_code, zone_name, total_parcels_count, is_active)
          SELECT zone_code, zone_name, total_parcels_count, is_active 
          FROM (VALUES ($1, $2, $3, $4)) AS v(zone_code, zone_name, total_parcels_count, is_active)
          ON CONFLICT (zone_code) DO UPDATE 
          SET total_parcels_count = EXCLUDED.total_parcels_count,
              is_active = EXCLUDED.is_active;
        `, [zoneCode, ZONE_SEGMENT_PREFIX_MAP[zoneCode].name, localParcels.rows.length, false]);

        // Nạp từng parcel an toàn
        for (const p of localParcels.rows) {
          await rClient.query(`
            INSERT INTO parcels (
              id, zone_id, segment_type, project_parcel_code, code_slug,
              official_cadastral_code, field_survey_code, house_number,
              street, ward, district, owner_name, owner_phone,
              land_area_m2, construction_area_m2, floor_count,
              building_type, total_units, survey_status, lifecycle_status,
              location_geom, cadastral_polygon_geom, footprint_polygon_geom
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
              $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
              $21, $22, $23
            )
            ON CONFLICT (official_cadastral_code) DO NOTHING;
          `, [
            p.id, p.zone_id, p.segment_type, p.project_parcel_code, p.code_slug,
            p.official_cadastral_code, p.field_survey_code, p.house_number,
            p.street, p.ward, p.district, p.owner_name, p.owner_phone,
            p.land_area_m2, p.construction_area_m2, p.floor_count,
            p.building_type, p.total_units, p.survey_status, p.lifecycle_status,
            p.location_geom, p.cadastral_polygon_geom, p.footprint_polygon_geom,
          ]);
          cloudSyncedCount++;
        }

        await rClient.query('COMMIT;');
      } catch (rErr) {
        await rClient.query('ROLLBACK;');
        throw rErr;
      } finally {
        rClient.release();
      }
    } finally {
      await remotePool.end();
    }

    return {
      snapshotPath,
      cloudSyncedCount,
    };
  }
}
