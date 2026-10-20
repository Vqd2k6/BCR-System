/**
 * Test Suite: Kiểm thử chuyên sâu Endpoints Xuất PDF Report V3
 * Đảm bảo cả GET và POST /api/v1/v3/reports/:id/export/pdf hoạt động 100% không bị 404
 */
import { createApp } from '../app';
import http from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    throw new Error(message);
  } else {
    console.log(`  ✅ PASSED: ${message}`);
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('🚀 KIỂM THỬ TÍCH HỢP: GET & POST /v3/reports/:id/export/pdf');
  console.log('================================================================\n');

  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });

  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const baseUrl = `http://localhost:${port}/api/v1/v3/reports`;
  const testReportId = 'd730fc32-3c55-4d4f-94d2-14d4bdcf5060';

  let passed = 0;
  let total = 5;

  const adminToken = jwt.sign(
    { userId: 'b0000000-0000-0000-0000-000000000001', role: 'SUPER_ADMIN', username: 'superadmin' },
    config.jwt.secret,
    { expiresIn: '1h' }
  );

  try {
    // ------------------------------------------------------------------------
    // TC1: 401 Unauthorized nếu không có Bearer token
    // ------------------------------------------------------------------------
    console.log('▶ TC1: Kiểm tra bảo mật - Từ chối request khi không có Bearer Token');
    try {
      const res = await fetch(`${baseUrl}/${testReportId}/export/pdf`);
      assert(res.status === 401, `GET yêu cầu xác thực JWT (mã HTTP thực tế: ${res.status})`);

      const postRes = await fetch(`${baseUrl}/${testReportId}/export/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enableWatermark: true }),
      });
      assert(postRes.status === 401, `POST yêu cầu xác thực JWT (mã HTTP thực tế: ${postRes.status})`);
      passed++;
    } catch (e: any) {
      console.error(e.message);
    }

    // ------------------------------------------------------------------------
    // TC2: GET /v3/reports/:id/export/pdf có Token
    // ------------------------------------------------------------------------
    console.log('\n▶ TC2: Kiểm tra GET /v3/reports/:id/export/pdf tải PDF thành công');
    try {
      const res = await fetch(`${baseUrl}/${testReportId}/export/pdf?watermark=true`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(res.status === 200, `Mã trạng thái trả về 200 OK (thực tế: ${res.status})`);
      const contentType = res.headers.get('content-type') || '';
      assert(contentType.includes('application/pdf'), `Content-Type là application/pdf (thực tế: ${contentType})`);
      const xStatus = res.headers.get('x-report-status') || '';
      assert(xStatus === 'DRAFT' || xStatus === 'FINAL', `Header X-Report-Status hợp lệ (${xStatus})`);

      const buffer = await res.arrayBuffer();
      assert(buffer.byteLength > 10000, `Buffer PDF hợp lệ (> 10KB, thực tế: ${buffer.byteLength} bytes)`);
      passed++;
    } catch (e: any) {
      console.error(e.message);
    }

    // ------------------------------------------------------------------------
    // TC3: POST /v3/reports/:id/export/pdf KHÔNG BỊ 404 (Trực diện khắc phục sự cố)
    // ------------------------------------------------------------------------
    console.log('\n▶ TC3: Kiểm tra POST /v3/reports/:id/export/pdf khắc phục triệt để lỗi 404');
    try {
      const res = await fetch(`${baseUrl}/${testReportId}/export/pdf?watermark=true`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ enableWatermark: true }),
      });
      assert(res.status !== 404, `Tuyệt đối KHÔNG trả về lỗi 404 (mã HTTP: ${res.status})`);
      assert(res.status === 200, `Mã trạng thái thành công 200 OK`);
      const contentType = res.headers.get('content-type') || '';
      assert(contentType.includes('application/pdf'), `Content-Type là application/pdf`);

      const buffer = await res.arrayBuffer();
      assert(buffer.byteLength > 10000, `Buffer PDF hợp lệ (> 10KB, thực tế: ${buffer.byteLength} bytes)`);
      passed++;
    } catch (e: any) {
      console.error(e.message);
    }

    // ------------------------------------------------------------------------
    // TC4: POST /v3/reports/:id/export/pdf với Overrides in-memory
    // ------------------------------------------------------------------------
    console.log('\n▶ TC4: Kiểm tra POST /v3/reports/:id/export/pdf với body chứa overrides');
    try {
      const res = await fetch(`${baseUrl}/${testReportId}/export/pdf?watermark=true`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          overrides: {
            buildingId: 'B-00026-C&C (ST05)',
            projectTitleVi: 'Dự Án Thử Nghiệm Override PDF V3',
          },
          enableWatermark: true,
        }),
      });
      assert(res.status === 200, `POST với overrides trả về 200 OK (thực tế: ${res.status})`);
      const buffer = await res.arrayBuffer();
      assert(buffer.byteLength > 10000, `Tạo PDF với overrides thành công (${buffer.byteLength} bytes)`);
      passed++;
    } catch (e: any) {
      console.error(e.message);
    }

    // ------------------------------------------------------------------------
    // TC5: Kiểm tra Content-Disposition header và filename
    // ------------------------------------------------------------------------
    console.log('\n▶ TC5: Kiểm tra Content-Disposition filename chuẩn');
    try {
      const res = await fetch(`${baseUrl}/${testReportId}/export/pdf`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const disposition = res.headers.get('content-disposition') || '';
      assert(disposition.includes('filename='), `Header Content-Disposition chứa tên tệp (thực tế: ${disposition})`);
      assert(disposition.endsWith('.pdf"'), `Tên tệp có đuôi .pdf chuẩn`);
      passed++;
    } catch (e: any) {
      console.error(e.message);
    }

    console.log('\n================================================================');
    console.log(`🎉 KẾT QUẢ: ${passed}/${total} TEST CASES ĐẠT CHUẨN 100%!`);
    console.log('================================================================\n');

    if (passed !== total) {
      process.exit(1);
    }
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('❌ Lỗi ngoại lệ trong quá trình chạy test suite:', err);
  process.exit(1);
});
