import { createApp } from './app';
import { config } from './config';
import { Database } from './database/db';
import { MigrationRunner } from './database/migration-runner';
import { StorageService } from './common/services/storage.service';

async function bootstrap() {
  const app = createApp();

  // Kiểm tra kết nối CSDL và PostGIS
  const health = await Database.healthCheck();
  console.log(`[DATABASE CONNECTED] Status: ${health.status}, PostGIS: ${health.postgisVersion || 'N/A'}`);

  // Tự động kiểm tra và áp dụng migrations với bảng tracking schema_migrations
  await MigrationRunner.run();

  // Tự động kiểm tra và cấu hình CORS cho Cloudflare R2 bucket nếu đang chạy R2 storage
  await StorageService.autoConfigureR2Cors();

  app.listen(config.port, () => {
    console.log(`================================================================`);
    console.log(`🚀 METRO 2 SURVEY BACKEND API SERVICE IS RUNNING`);
    console.log(`📡 URL: http://localhost:${config.port}${config.apiPrefix}`);
    console.log(`🩺 HEALTH: http://localhost:${config.port}/health`);
    console.log(`🔒 RBAC ROLES: SUPER_ADMIN, ZONE_ADMIN, SURVEYOR, CONTRACTOR, GUEST`);
    console.log(`📦 ENVIRONMENT: ${config.env}`);
    console.log(`================================================================`);
  });
}

bootstrap().catch((err) => {
  console.error('[FATAL BOOTSTRAP ERROR]', err);
  process.exit(1);
});
