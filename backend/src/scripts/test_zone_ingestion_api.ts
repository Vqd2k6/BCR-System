import { CadastralIngestionService } from '../modules/cadastral/services/cadastral-ingestion.service';
import { pool } from '../database/db';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('🧪 BẮT ĐẦU KIỂM THỬ CÁC TÍNH NĂNG CADASTRA INGESTION SERVICE...');

  try {
    // 1. Test getZonesOverview
    console.log('\n--- 1. Test getZonesOverview() ---');
    const overview = await CadastralIngestionService.getZonesOverview();
    console.log(`Đã lấy ${overview.length} zones.`);
    const zone07 = overview.find(z => z.zoneCode === 'ZONE_07');
    console.log('Zone 07 overview:', {
      zoneCode: zone07?.zoneCode,
      zoneName: zone07?.zoneName,
      prefix: zone07?.prefix,
      totalParcelsCount: zone07?.totalParcelsCount,
      isActive: zone07?.isActive,
      serverFileExists: zone07?.serverDataFile.exists,
      parcelsInFile: zone07?.serverDataFile.parcelsInFile,
    });

    // 2. Test auditZonePayload với dữ liệu Zone_07
    console.log('\n--- 2. Test auditZonePayload() cho ZONE_07 ---');
    const zone07Path = path.resolve(__dirname, '../../../data/Zone_07/ban_do_data.json');
    if (!fs.existsSync(zone07Path)) {
      throw new Error(`Không tìm thấy file: ${zone07Path}`);
    }
    const raw = JSON.parse(fs.readFileSync(zone07Path, 'utf8'));
    const rawParcels = Object.values(raw.parcels || {}) as any[];

    const auditRes = await CadastralIngestionService.auditZonePayload('ZONE_07', rawParcels);
    console.log('Kết quả audit:', {
      totalIncoming: auditRes.totalIncoming,
      validParcelsCount: auditRes.validParcelsCount,
      invalidGeometryCount: auditRes.invalidGeometryCount,
      duplicatesOtherZonesCount: auditRes.duplicatesOtherZones.length,
      startCode: auditRes.codePreview.startCode,
      endCode: auditRes.codePreview.endCode,
      slugStartCode: auditRes.codePreview.slugStartCode,
      slugEndCode: auditRes.codePreview.slugEndCode,
      canImport: auditRes.canImport,
    });

    console.log('\n✅ KIỂM THỬ THÀNH CÔNG 100%!');
  } catch (err) {
    console.error('❌ LỖI TRONG QUÁ TRÌNH TEST:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
