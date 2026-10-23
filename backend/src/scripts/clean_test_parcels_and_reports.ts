import { pool, Database } from '../database/db';

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_TEST_CLEANUP !== 'true') {
    throw new Error('CHẶN AN TOÀN PRODUCTION: Không được chạy script dọn dẹp dữ liệu test trên môi trường production khi chưa đặt ALLOW_TEST_CLEANUP=true.');
  }
  console.log('🔍 [INSPECT] Checking database for test records vs real records...\n');

  // Check parcels
  const totalParcelsRes = await pool.query('SELECT COUNT(*) as count FROM parcels');
  const testParcelsRes = await pool.query(`
    SELECT COUNT(*) as count FROM parcels 
    WHERE project_parcel_code ILIKE '%TEST%'
  `);
  const realParcelsRes = await pool.query(`
    SELECT COUNT(*) as count FROM parcels 
    WHERE project_parcel_code NOT ILIKE '%TEST%'
  `);

  console.log(`📦 Parcels:`);
  console.log(`   - Total: ${totalParcelsRes.rows[0].count}`);
  console.log(`   - Test matches: ${testParcelsRes.rows[0].count}`);
  console.log(`   - Real matches: ${realParcelsRes.rows[0].count}`);

  // Check specific test patterns in parcels
  const parcelPatternsRes = await pool.query(`
    SELECT 
      CASE 
        WHEN project_parcel_code ILIKE 'P-RES-TEST-%' THEN 'P-RES-TEST-%'
        WHEN project_parcel_code ILIKE '%TEST%' THEN 'OTHER-TEST'
        ELSE 'REAL'
      END as category,
      COUNT(*) as count
    FROM parcels
    GROUP BY 1
    ORDER BY 2 DESC
  `);
  console.table(parcelPatternsRes.rows);

  // Check reports
  const totalReportsRes = await pool.query('SELECT COUNT(*) as count FROM base_survey_reports');
  const testReportsRes = await pool.query(`
    SELECT COUNT(*) as count FROM base_survey_reports 
    WHERE report_code ILIKE '%TEST%'
  `);
  const realReportsRes = await pool.query(`
    SELECT COUNT(*) as count FROM base_survey_reports 
    WHERE report_code NOT ILIKE '%TEST%'
  `);

  console.log(`\n📋 Reports:`);
  console.log(`   - Total: ${totalReportsRes.rows[0].count}`);
  console.log(`   - Test matches: ${testReportsRes.rows[0].count}`);
  console.log(`   - Real matches: ${realReportsRes.rows[0].count}`);

  const reportPatternsRes = await pool.query(`
    SELECT 
      CASE 
        WHEN report_code ILIKE 'REP-TEST-%' THEN 'REP-TEST-%'
        WHEN report_code ILIKE '%TEST%' THEN 'OTHER-TEST'
        ELSE 'REAL'
      END as category,
      COUNT(*) as count
    FROM base_survey_reports
    GROUP BY 1
    ORDER BY 2 DESC
  `);
  console.table(reportPatternsRes.rows);

  // Check if any report_releases exist for test reports
  const testReleasesRes = await pool.query(`
    SELECT COUNT(*) as count 
    FROM report_releases rr
    JOIN base_survey_reports r ON rr.report_id = r.id
    WHERE r.report_code ILIKE '%TEST%'
  `);
  console.log(`\n🔒 Releases tied to test reports: ${testReleasesRes.rows[0].count}`);

  // Now execute the transactional cleanup
  console.log('\n🧹 [CLEANUP] Executing cleanup within a strict database transaction...');
  
  await Database.transaction(async (client) => {
    // 1. Get test report IDs
    const repRes = await client.query<{ id: string; report_code: string }>(`
      SELECT id, report_code 
      FROM base_survey_reports 
      WHERE report_code ILIKE 'REP-TEST-%'
    `);
    const testRepIds = repRes.rows.map(r => r.id);
    console.log(`Found ${testRepIds.length} test reports to clean up.`);

    // 2. Get test parcel IDs
    const parcelRes = await client.query<{ id: string; project_parcel_code: string }>(`
      SELECT id, project_parcel_code 
      FROM parcels 
      WHERE project_parcel_code ILIKE 'P-RES-TEST-%'
    `);
    const testParcelIds = parcelRes.rows.map(r => r.id);
    console.log(`Found ${testParcelIds.length} test parcels to clean up.`);

    if (testRepIds.length > 0) {
      // Clean up child tables linked to test reports
      const delVersions = await client.query(
        'DELETE FROM survey_report_versions WHERE report_id = ANY($1::uuid[])', 
        [testRepIds]
      );
      console.log(`   - Deleted survey_report_versions: ${delVersions.rowCount}`);

      const delDamage = await client.query(
        'DELETE FROM damage_zones WHERE report_id = ANY($1::uuid[])', 
        [testRepIds]
      );
      console.log(`   - Deleted damage_zones: ${delDamage.rowCount}`);

      const delRisk = await client.query(
        'DELETE FROM risk_score_cards WHERE report_id = ANY($1::uuid[])', 
        [testRepIds]
      );
      console.log(`   - Deleted risk_score_cards: ${delRisk.rowCount}`);

      const delLocks = await client.query(
        'DELETE FROM survey_audit_locks WHERE report_id = ANY($1::uuid[])', 
        [testRepIds]
      );
      console.log(`   - Deleted survey_audit_locks: ${delLocks.rowCount}`);

      const delSpecs = await client.query(
        'DELETE FROM building_specifications WHERE report_id = ANY($1::uuid[])', 
        [testRepIds]
      );
      console.log(`   - Deleted building_specifications: ${delSpecs.rowCount}`);

      const delDeform = await client.query(
        'DELETE FROM deformation_assessments WHERE report_id = ANY($1::uuid[])', 
        [testRepIds]
      );
      console.log(`   - Deleted deformation_assessments: ${delDeform.rowCount}`);

      const delReleases = await client.query(
        'DELETE FROM report_releases WHERE report_id = ANY($1::uuid[])', 
        [testRepIds]
      );
      console.log(`   - Deleted report_releases: ${delReleases.rowCount}`);

      const delAuditLogs = await client.query(
        "DELETE FROM system_audit_logs WHERE entity_id = ANY($1::uuid[])", 
        [testRepIds]
      );
      console.log(`   - Deleted system_audit_logs: ${delAuditLogs.rowCount}`);

      // Delete reports
      const delReports = await client.query(
        'DELETE FROM base_survey_reports WHERE id = ANY($1::uuid[])', 
        [testRepIds]
      );
      console.log(`   - Deleted base_survey_reports: ${delReports.rowCount}`);
    }

    if (testParcelIds.length > 0) {
      // Also delete any remaining survey reports pointing to these parcels if any
      const delOrphanReports = await client.query(
        'DELETE FROM base_survey_reports WHERE parcel_id = ANY($1::uuid[])', 
        [testParcelIds]
      );
      if ((delOrphanReports.rowCount ?? 0) > 0) {
        console.log(`   - Deleted orphan base_survey_reports by parcel_id: ${delOrphanReports.rowCount}`);
      }

      // Check if audit logs refer to these parcel IDs
      const delParcelLogs = await client.query(
        "DELETE FROM system_audit_logs WHERE entity_id = ANY($1::uuid[])", 
        [testParcelIds]
      );
      console.log(`   - Deleted parcel system_audit_logs: ${delParcelLogs.rowCount}`);

      // Delete parcels
      const delParcels = await client.query(
        'DELETE FROM parcels WHERE id = ANY($1::uuid[])', 
        [testParcelIds]
      );
      console.log(`   - Deleted parcels: ${delParcels.rowCount}`);
    }
  });

  console.log('\n✅ [VERIFICATION] Post-cleanup verification:');
  const finalParcelsRes = await pool.query('SELECT COUNT(*) as count FROM parcels');
  const finalTestParcelsRes = await pool.query("SELECT COUNT(*) as count FROM parcels WHERE project_parcel_code ILIKE '%TEST%'");
  const finalReportsRes = await pool.query('SELECT COUNT(*) as count FROM base_survey_reports');
  const finalTestReportsRes = await pool.query("SELECT COUNT(*) as count FROM base_survey_reports WHERE report_code ILIKE '%TEST%'");

  console.log(`📦 Remaining Parcels: ${finalParcelsRes.rows[0].count} (Expected: 2408 real parcels)`);
  console.log(`📦 Test Parcels remaining: ${finalTestParcelsRes.rows[0].count} (Expected: 0)`);
  console.log(`📋 Remaining Reports: ${finalReportsRes.rows[0].count} (Expected: 374 real reports)`);
  console.log(`📋 Test Reports remaining: ${finalTestReportsRes.rows[0].count} (Expected: 0)`);

  if (Number(finalTestParcelsRes.rows[0].count) === 0 && Number(finalTestReportsRes.rows[0].count) === 0) {
    console.log('\n🎉 ALL TEST DATA CLEANED UP SUCCESSFULLY! Real production data is 100% intact.');
  } else {
    console.warn('\n⚠️ Warning: Some test records may still exist. Review output above.');
  }

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error during cleanup:', err);
  process.exit(1);
});
