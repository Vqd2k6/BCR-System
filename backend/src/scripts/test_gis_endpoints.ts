import request from 'supertest';
import { createApp } from '../app';
import { pool } from '../database/db';

async function test() {
  try {
    const app = createApp();
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'surveyor_s9_01', password: 'Password@123' });

    const token = loginRes.body?.data?.accessToken;
    console.log('✅ Đăng nhập thành công, thu được JWT token.');

    const zones = ['ZONE_01', 'ZONE_02', 'ZONE_03', 'ZONE_04', 'ZONE_09'];
    for (const z of zones) {
      const res = await request(app)
        .get('/api/v1/parcels/zone-map')
        .query({ zoneId: z })
        .set('Authorization', `Bearer ${token}`);
      const parcels = res.body?.data || [];
      console.log(`✅ ${z}: ${parcels.length} thửa | Mã đầu: ${parcels[0]?.project_parcel_code} | Mã cuối: ${parcels[parcels.length - 1]?.project_parcel_code}`);
    }
  } catch (err: any) {
    console.error('Test thất bại:', err);
  } finally {
    await pool.end();
  }
}
test();
