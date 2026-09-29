import { Database } from '../database/db';
import { ZONE_SEGMENT_PREFIX_MAP } from './standardize_parcel_codes';

export async function executeCleanReset(client?: any) {
  const runner = client || Database;

  console.log('🧹 [CLEAN RESET] Bắt đầu dọn sạch dữ liệu khảo sát và chuẩn hóa hệ thống...');

  // 1. Xóa sạch toàn bộ bảng khảo sát, chấm công, nhật ký biến động
  console.log('🗑️ [1/4] Xóa sạch các bảng dữ liệu khảo sát & báo cáo...');
  await runner.query(`
    TRUNCATE TABLE 
      base_survey_reports,
      phase1_report_details,
      phase2_report_details,
      survey_identification_photos,
      building_specifications,
      historical_sensitivities,
      floor_surveys,
      damage_zones,
      defect_items,
      damage_sketches,
      deformation_assessments,
      risk_score_cards,
      survey_scopes,
      survey_absence_logs,
      timekeeping_checkins,
      audit_alert_items,
      quality_gate_logs,
      compiled_report_batches,
      user_sessions,
      parcel_mutation_events,
      cadastral_history_logs,
      guest_share_links,
      task_assignments
    CASCADE;
  `);

  // 2. Reset trạng thái toàn bộ thửa đất (parcels) & căn hộ (building_units)
  console.log('🔄 [2/4] Reset trạng thái khảo sát của tất cả thửa đất về NOT_SURVEYED...');
  await runner.query(`
    UPDATE parcels SET 
      survey_status = 'NOT_SURVEYED',
      active_phase1_report_id = NULL,
      active_phase2_report_id = NULL;

    UPDATE building_units SET 
      status = 'NOT_SURVEYED',
      phase1_report_id = NULL,
      phase2_report_id = NULL;

    UPDATE metro_zones SET 
      approved_parcels_count = 0;
  `);

  // 3. Chuẩn hóa mã thửa đất theo quy tắc [LOẠI]-[STT]-[B-XXXX]
  console.log('🏷️ [3/4] Đánh số chuẩn chỉnh toàn bộ thửa đất theo phân đoạn Metro 2...');
  
  // Gán tạm prefix để tránh lỗi unique constraint khi hoán đổi/đánh số lại
  await runner.query("UPDATE parcels SET project_parcel_code = 'T-' || substr(id::text, 1, 25);");

  const zonesRes = await runner.query(
    'SELECT DISTINCT zone_id FROM parcels WHERE zone_id IS NOT NULL ORDER BY zone_id;'
  );

  let totalParcelsStandardized = 0;
  for (const z of zonesRes.rows) {
    const zoneId = z.zone_id;
    const zoneMeta = ZONE_SEGMENT_PREFIX_MAP[zoneId];
    if (!zoneMeta) continue;

    const parcelsRes = await runner.query(
      'SELECT id FROM parcels WHERE zone_id = $1 ORDER BY id ASC;',
      [zoneId]
    );

    for (let i = 0; i < parcelsRes.rows.length; i++) {
      const parcel = parcelsRes.rows[i];
      const seqNum = i + 1;
      const parcelNumber = `B-${String(seqNum).padStart(4, '0')}`;
      const newProjectParcelCode = `${zoneMeta.prefix}-${parcelNumber}`;
      const newCodeSlug = `${zoneMeta.slugPrefix}-${parcelNumber}`;

      await runner.query(
        'UPDATE parcels SET project_parcel_code = $1, code_slug = $2, segment_type = $3 WHERE id = $4;',
        [newProjectParcelCode, newCodeSlug, zoneMeta.type, parcel.id]
      );
      totalParcelsStandardized++;
    }
  }

  // Cập nhật lại total_parcels_count trong metro_zones
  await runner.query(`
    UPDATE metro_zones z
    SET total_parcels_count = (SELECT COUNT(*) FROM parcels p WHERE p.zone_id = z.zone_code);
  `);

  // 4. Chỉ giữ lại 1 tài khoản Super Admin duy nhất, xóa sạch mọi tài khoản khác
  console.log('👤 [4/4] Dọn dẹp tài khoản người dùng, chỉ giữ duy nhất 1 tài khoản Super Admin...');
  await runner.query(`
    DELETE FROM users WHERE username != 'superadmin';

    INSERT INTO users (
      id, username, password_hash, full_name, email, phone, role, status, assigned_zone_id
    ) VALUES (
      'b0000000-0000-0000-0000-000000000001',
      'superadmin',
      '$2a$10$Mc8KQVRO3nHstxfQyiWjEuJCHaPl42TlIR0J.HXeH5nZl6KNXKmDe',
      'Tổng Quản Trị Viên (Super Admin)',
      'admin@maur.metro2.vn',
      '0901234567',
      'SUPER_ADMIN',
      'ACTIVE',
      NULL
    )
    ON CONFLICT (username) DO UPDATE SET
      password_hash = '$2a$10$Mc8KQVRO3nHstxfQyiWjEuJCHaPl42TlIR0J.HXeH5nZl6KNXKmDe',
      role = 'SUPER_ADMIN',
      status = 'ACTIVE',
      full_name = 'Tổng Quản Trị Viên (Super Admin)',
      email = 'admin@maur.metro2.vn',
      assigned_zone_id = NULL;
  `);

  // Thống kê kết quả sau khi dọn
  const statsRes = await runner.query(`
    SELECT 
      (SELECT COUNT(*) FROM parcels) as total_parcels,
      (SELECT COUNT(*) FROM parcels WHERE survey_status = 'NOT_SURVEYED') as unstarted_parcels,
      (SELECT COUNT(*) FROM base_survey_reports) as total_reports,
      (SELECT COUNT(*) FROM metro_zones) as total_zones,
      (SELECT COUNT(*) FROM users) as total_users;
  `);

  const stats = statsRes.rows[0];
  console.log('📊 [KẾT QUẢ RESET]:');
  console.log(`   ├─ Tổng số thửa đất (Parcels) : ${stats.total_parcels} (100% sẵn sàng)`);
  console.log(`   ├─ Thửa chưa khảo sát         : ${stats.unstarted_parcels}`);
  console.log(`   ├─ Tổng số báo cáo khảo sát   : ${stats.total_reports} (0 báo cáo)`);
  console.log(`   ├─ Tổng số phân khu / Ga      : ${stats.total_zones}`);
  console.log(`   └─ Tổng số tài khoản          : ${stats.total_users} (Duy nhất 1 Super Admin)`);

  return {
    success: true,
    message: 'Đã hoàn tất dọn sạch DB! Tất cả các lô đã được đánh số chuẩn, sạch 0 khảo sát và chỉ còn 1 tài khoản Super Admin.',
    stats: {
      totalParcels: Number(stats.total_parcels),
      unstartedParcels: Number(stats.unstarted_parcels),
      totalReports: Number(stats.total_reports),
      totalZones: Number(stats.total_zones),
      totalUsers: Number(stats.total_users),
      totalStandardized: totalParcelsStandardized,
    },
    adminAccount: {
      username: 'superadmin',
      role: 'SUPER_ADMIN',
      note: 'Mật khẩu: Admin@123',
    },
  };
}

if (require.main === module) {
  executeCleanReset()
    .then((res) => {
      console.log('🎉 XONG!', res);
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ LỖI:', err);
      process.exit(1);
    });
}
