/**
 * Test Suite Phase 5: Kiểm thử API Endpoints /api/v1/v2/reports/...
 */
import { createApp } from '../app';
import http from 'http';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

async function runApiTest() {
  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });

  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const baseUrl = `http://localhost:${port}/api/v1/v2/reports`;

  console.log(`📡 Server test API đang chạy tại: ${baseUrl}`);

  try {
    const testReportId = '39fed16a-d786-4370-9277-9d8e2c6bd49c';

    console.log('\n--- 1. Kiểm thử GET /preview/html với ID thực tế trong CSDL ---');
    const getRes = await fetch(`${baseUrl}/${testReportId}/preview/html`);
    assert(getRes.status === 200, `GET preview trả về mã 200 (thực tế: ${getRes.status})`);
    
    const contentType = getRes.headers.get('content-type') || '';
    assert(contentType.includes('text/html'), `Content-Type là text/html (thực tế: ${contentType})`);

    const xReportNo = getRes.headers.get('x-report-no') || '';
    assert(xReportNo.includes('REPORT-B-'), `Header X-Report-No hợp lệ: ${xReportNo}`);

    const htmlBody = await getRes.text();
    assert(htmlBody.includes('I. THÔNG TIN CHUNG - GENERAL INFORMATION'), 'HTML chứa Chương I');
    assert(htmlBody.includes('PHỤ LỤC 2: THỐNG KÊ KHUYẾT TẬT TRÊN MẶT BẰNG TẦNG'), 'HTML chứa Phụ lục 2');

    console.log('\n--- 2. Kiểm thử POST /preview/html với Overrides in-memory & JWT Auth ---');
    const jwt = require('jsonwebtoken');
    const { config } = require('../config');
    const token = jwt.sign(
      { userId: 'admin_test_id', role: 'ZONE_ADMIN', username: 'admin_test' },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    const postRes = await fetch(`${baseUrl}/${testReportId}/preview/html`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        buildingId: 'B-09999-C&C (ST5)',
        revision: '03',
      }),
    });
    assert(postRes.status === 200, `POST preview trả về mã 200 (thực tế: ${postRes.status})`);
    const postXReportNo = postRes.headers.get('x-report-no') || '';
    assert(postXReportNo.includes('B-09999') && postXReportNo.includes('Rev. 03'), `Header ghi nhận override Rev 03: ${postXReportNo}`);

    console.log('\n🎉 TOÀN BỘ CÁC BÀI TEST PHASE 5 ĐÃ VƯỢT QUA 100%!');
  } finally {
    server.close();
  }
}

runApiTest().catch((err) => {
  console.error('❌ Lỗi kiểm thử API:', err);
  process.exit(1);
});
