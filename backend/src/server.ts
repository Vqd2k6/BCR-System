import { createApp } from './app';
import { config } from './config';
import { Database } from './database/db';
import { MigrationRunner } from './database/migration-runner';
import { StorageService } from './common/services/storage.service';
import { ReportSnapshotService } from './modules/report_v3/report-snapshot.service';

async function bootstrap() {
  const app = createApp();

  // Kiểm tra kết nối CSDL và PostGIS
  const health = await Database.healthCheck();
  console.log(`[DATABASE CONNECTED] Status: ${health.status}, PostGIS: ${health.postgisVersion || 'N/A'}`);

  // Tự động kiểm tra và áp dụng migrations với bảng tracking schema_migrations
  await MigrationRunner.run();

  // Tự động rà soát và nâng cấp Full Snapshot v2 cho các hồ sơ APPROVED cũ nếu phát hiện thiếu (Self-Healing)
  await ReportSnapshotService.autoBackfillApprovedSnapshots();

  // Tự động kiểm tra và cấu hình CORS cho Cloudflare R2 bucket nếu đang chạy R2 storage
  await StorageService.autoConfigureR2Cors();

  const server = app.listen(config.port, () => {
    console.log(`================================================================`);
    console.log(`🚀 METRO 2 SURVEY BACKEND API SERVICE IS RUNNING`);
    console.log(`📡 URL: http://localhost:${config.port}${config.apiPrefix}`);
    console.log(`🩺 HEALTH: http://localhost:${config.port}/health`);
    console.log(` RBAC ROLES: SUPER_ADMIN, ZONE_ADMIN, SURVEYOR, CONTRACTOR, GUEST`);
    console.log(`📦 ENVIRONMENT: ${config.env}`);
    console.log(`================================================================`);
  });

  // Tăng timeout kết nối lên 300s (5 phút) phục vụ các tác vụ nạp bản đồ lớn và internet latency
  server.timeout = 300000;
  server.keepAliveTimeout = 305000;
  server.headersTimeout = 310000;
}

bootstrap().catch((err) => {
  console.error('[FATAL BOOTSTRAP ERROR]', err);
  process.exit(1);
});
