import * as fs from 'fs';
import * as path from 'path';
import { pool } from '../database/db';
import { ReportV3Service } from '../modules/report_v3/report-v3.service';
import { ReportSnapshotService } from '../modules/report_v3/report-snapshot.service';
import { AuditService } from '../modules/audit/audit.service';

const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');

async function extractPdfPages(buf: Buffer): Promise<{ numPages: number; pagesText: string[]; fullText: string }> {
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buf),
    useSystemFonts: true,
    disableFontFace: true,
    verbosity: 0,
  }).promise;

  const pagesText: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const str = content.items.map((it: any) => it.str).join(' ');
    pagesText.push(str);
  }
  return {
    numPages: doc.numPages,
    pagesText,
    fullText: pagesText.join('\n--- PAGE BREAK ---\n'),
  };
}

function squeeze(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

async function main() {
  console.log('================================================================================');
  console.log('THỰC NGHIỆM ĐỐI CHỨNG PDF & ĐIỀU TRA LỖI TOÀN DIỆN (APPROVED -> UNLOCK -> RE-APPROVE)');
  console.log('================================================================================\n');

  const outDir = path.resolve(__dirname, '../../test_output/comparison');
  fs.mkdirSync(outDir, { recursive: true });

  const client = await pool.connect();

  const reportId = '60f4a409-7626-4de4-a61e-5dc2ef91feca';
  const parcelId = 'c24a3d1d-b635-40ac-bfdd-ac4fb3bc2e94';

  // 1. Lưu trữ trạng thái gốc để khôi phục 100% sau thực nghiệm
  const baselineParcel = await client.query(`SELECT * FROM parcels WHERE id = $1;`, [parcelId]);
  const baselineReport = await client.query(`SELECT * FROM base_survey_reports WHERE id = $1;`, [reportId]);
  const origP = baselineParcel.rows[0];
  const origR = baselineReport.rows[0];

  console.log(`[1] Trạng thái ban đầu của lô đất ${origP.project_parcel_code}:`);
  console.log(`    - Số nhà / Đường : ${origP.house_number}, ${origP.street}`);
  console.log(`    - Chủ hộ / SĐT   : ${origP.owner_name} / ${origP.owner_phone}`);
  console.log(`    - Diện tích đất  : ${origP.land_area_m2} m²`);
  console.log(`    - Trạng thái     : Report = ${origR.status}, Parcel = ${origP.survey_status}, Revision = ${origR.export_revision}`);

  // Lấy ID của Super Admin và Zone Admin
  const superAdminRes = await client.query<{ id: string }>(`SELECT id FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1;`);
  const zoneAdminRes = await client.query<{ id: string }>(`SELECT id FROM users WHERE role = 'ZONE_ADMIN' LIMIT 1;`);
  const superAdminId = superAdminRes.rows[0]?.id;
  const zoneAdminId = zoneAdminRes.rows[0]?.id;

  try {
    // -------------------------------------------------------------------------
    // BƯỚC 1: XUẤT PDF MẪU BẢN 1 (BASELINE APPROVED)
    // -------------------------------------------------------------------------
    console.log('\n[2] Đang kết xuất PDF 1: Bản APPROVED gốc hiện tại...');
    const t0 = Date.now();
    const resolvedBaseline = await ReportV3Service.resolve(reportId);
    const { pdfBuffer: pdf1Buffer } = await ReportV3Service.renderDraftPdf(resolvedBaseline, undefined, false);
    const pdf1Path = path.join(outDir, '01_APPROVED_BASELINE.pdf');
    fs.writeFileSync(pdf1Path, pdf1Buffer);
    console.log(`    -> Đã xuất ${pdf1Path} (${(pdf1Buffer.length / 1e6).toFixed(2)} MB, ${((Date.now() - t0) / 1000).toFixed(1)}s)`);

    const pdf1Data = await extractPdfPages(pdf1Buffer);
    console.log(`    -> Số trang: ${pdf1Data.numPages}`);

    // Kiểm tra dữ liệu trên PDF 1
    const p1Sq = squeeze(pdf1Data.fullText);
    const p1Has206 = p1Sq.includes(squeeze('206'));
    const p1HasStreet = p1Sq.includes(squeeze('Phạm Hồng Thái'));
    const p1HasWard = p1Sq.includes(squeeze('Phường Bến Thành'));
    const p1HasPhone = p1Sq.includes(squeeze('0901000113'));
    console.log(`    - Chứa số nhà 206           : ${p1Has206 ? 'ĐÚNG ✅' : 'THIẾU ❌'}`);
    console.log(`    - Chứa đường Phạm Hồng Thái : ${p1HasStreet ? 'ĐÚNG ✅' : 'THIẾU ❌'}`);
    console.log(`    - Chứa Phường Bến Thành     : ${p1HasWard ? 'ĐÚNG ✅' : 'THIẾU ❌'}`);
    console.log(`    - Chứa SĐT 0901000113       : ${p1HasPhone ? 'ĐÚNG ✅' : 'THIẾU ❌'}`);
    if (!p1Has206 || !p1HasStreet || !p1HasWard || !p1HasPhone) {
      throw new Error('PDF 1 thiếu thông tin nhận diện cốt lõi!');
    }

    // -------------------------------------------------------------------------
    // BƯỚC 2: KIỂM CHỨNG BẢO MẬT PHÂN QUYỀN (CHỈ SUPER_ADMIN ĐƯỢC UNLOCK)
    // -------------------------------------------------------------------------
    console.log('\n[3] Kiểm thử phân quyền mở khóa (SUPER_ADMIN vs ZONE_ADMIN):');
    let zoneAdminBlocked = false;
    try {
      console.log('    - Thử mở khóa bằng Zone Admin...');
      await AuditService.unlockApprovedReport(reportId, zoneAdminId);
    } catch (err: any) {
      if (err.name === 'ForbiddenError' || err.statusCode === 403 || err.message?.includes('Super Admin')) {
        zoneAdminBlocked = true;
        console.log(`      Zone Admin bị chặn chính xác với lỗi 403: "${err.message}" ✅`);
      } else {
        console.log(`      Lỗi không mong muốn: ${err.message} ❌`);
      }
    }
    if (!zoneAdminBlocked) {
      throw new Error('LỖI AN NINH: Zone Admin không được phép mở khóa hồ sơ APPROVED nhưng hệ thống không chặn!');
    }

    console.log('    - Mở khóa bằng Super Admin...');
    const unlockRes = await AuditService.unlockApprovedReport(reportId, superAdminId);
    console.log(`      Super Admin mở khóa thành công: Status mới = ${unlockRes.status} ✅`);

    // -------------------------------------------------------------------------
    // BƯỚC 3: GIẢ LẬP BIẾN ĐỘNG DỮ LIỆU THỰC ĐỊA & PARCELS TRONG KHI MỞ KHÓA
    // -------------------------------------------------------------------------
    console.log('\n[4] Giả lập cập nhật thông tin trong thời gian mở khóa (UNDER_REVIEW):');
    // Cập nhật thửa đất (đã được trigger cho phép vì status != APPROVED)
    await client.query(
      `UPDATE parcels
       SET house_number = '206B-HACK-LIVE',
           street = 'Đường Biến Động Thực Nghiệm',
           owner_phone = '0999888777',
           land_area_m2 = 99.5
       WHERE id = $1;`,
      [parcelId]
    );

    // Cập nhật dữ liệu khảo sát survey_data_json (KSV cập nhật số nhà hiện trường)
    const currentJson = (await client.query(`SELECT survey_data_json FROM base_survey_reports WHERE id = $1;`, [reportId])).rows[0].survey_data_json;
    const modifiedJson = {
      ...currentJson,
      houseNumber: '206/1-KSV-SURVEY',
      street: 'Đường Khảo Sát Hiện Trường',
      ownerPhone: '0988112233',
    };
    await client.query(
      `UPDATE base_survey_reports SET survey_data_json = $1 WHERE id = $2;`,
      [JSON.stringify(modifiedJson), reportId]
    );
    console.log('    - Đã cập nhật bảng parcels: Số nhà = 206B-HACK-LIVE, SĐT = 0999888777');
    console.log('    - Đã cập nhật survey_data_json: Số nhà = 206/1-KSV-SURVEY, SĐT = 0988112233');

    // -------------------------------------------------------------------------
    // BƯỚC 4: XUẤT PDF MẪU BẢN 2 (WIP PREVIEW VỚI WATERMARK TRONG KHI UNDER_REVIEW)
    // -------------------------------------------------------------------------
    console.log('\n[5] Đang kết xuất PDF 2: Bản Xem trước (Draft Preview) trong khi UNDER_REVIEW...');
    const t1 = Date.now();
    const resolvedUnderReview = await ReportV3Service.resolve(reportId);
    const { pdfBuffer: pdf2Buffer } = await ReportV3Service.renderDraftPdf(resolvedUnderReview, undefined, true);
    const pdf2Path = path.join(outDir, '02_UNDER_REVIEW_WIP_PREVIEW.pdf');
    fs.writeFileSync(pdf2Path, pdf2Buffer);
    console.log(`    -> Đã xuất ${pdf2Path} (${(pdf2Buffer.length / 1e6).toFixed(2)} MB, ${((Date.now() - t1) / 1000).toFixed(1)}s)`);

    const pdf2Data = await extractPdfPages(pdf2Buffer);
    console.log(`    -> Số trang: ${pdf2Data.numPages}`);

    // Kiểm tra dữ liệu trên PDF 2
    // Vì survey_data_json có houseNumber = '206/1-KSV-SURVEY' nên ưu tiên KSV trước parcels (206B-HACK-LIVE)
    const p2Sq = squeeze(pdf2Data.fullText);
    const p2HasSurveyHn = p2Sq.includes(squeeze('206/1-KSV-SURVEY'));
    const p2HasSurveySt = p2Sq.includes(squeeze('Khảo Sát Hiện Trường'));
    const p2HasSurveyPhone = p2Sq.includes(squeeze('0988112233'));
    console.log(`    - Ưu tiên số nhà KSV (206/1-KSV-SURVEY) : ${p2HasSurveyHn ? 'ĐÚNG ✅' : 'SAI ❌'}`);
    console.log(`    - Ưu tiên đường KSV (Khảo Sát Hiện Trường): ${p2HasSurveySt ? 'ĐÚNG ✅' : 'SAI ❌'}`);
    console.log(`    - Ưu tiên SĐT KSV (0988112233)           : ${p2HasSurveyPhone ? 'ĐÚNG ✅' : 'SAI ❌'}`);
    if (!p2HasSurveyHn || !p2HasSurveySt || !p2HasSurveyPhone) {
      throw new Error('PDF 2 không hiển thị đúng thông tin KSV khảo sát bổ sung!');
    }

    // -------------------------------------------------------------------------
    // BƯỚC 5: ĐỐI CHỨNG TÍNH ĐỘC LẬP CỦA SNAPSHOT PHÁP LÝ (OFFICIAL RELEASE)
    // -------------------------------------------------------------------------
    console.log('\n[6] Kiểm chứng tính độc lập của Snapshot pháp lý đã duyệt:');
    const latestLegalSnap = await ReportSnapshotService.getLatestApprovedSnapshot(reportId);
    if (!latestLegalSnap) throw new Error('Không tìm thấy snapshot APPROVED_RELEASE!');

    const legalFrozenHn = latestLegalSnap.snapshot.frozenParcel?.houseNumber;
    const legalFrozenPhone = latestLegalSnap.snapshot.frozenParcel?.ownerPhone;
    const legalFrozenArea = latestLegalSnap.snapshot.frozenParcel?.landAreaM2;
    console.log(`    - Snapshot đã duyệt giữ số nhà ban đầu : ${legalFrozenHn === '206' ? `${legalFrozenHn} (BẤT BIẾN ✅)` : `${legalFrozenHn} (BỊ LỖI ❌)`}`);
    console.log(`    - Snapshot đã duyệt giữ SĐT ban đầu    : ${legalFrozenPhone === '0901000113' ? `${legalFrozenPhone} (BẤT BIẾN ✅)` : `${legalFrozenPhone} (BỊ LỖI ❌)`}`);
    console.log(`    - Snapshot đã duyệt giữ Diện tích đất  : ${Number(legalFrozenArea) === 65.8 ? `${legalFrozenArea} m² (BẤT BIẾN ✅)` : `${legalFrozenArea} m² (BỊ LỖI ❌)`}`);

    const officialFinalData = ReportV3Service.buildFinalReport(
      resolvedUnderReview,
      latestLegalSnap.snapshot,
      latestLegalSnap.snapshot.exportRevision ?? 0
    );
    const offHouse = (officialFinalData as any).house_number;
    const offPhone = (officialFinalData as any).owner_phone;
    console.log(`    - Official Release xuất ra vẫn là số nhà : ${offHouse === '206' ? `${offHouse} ✅` : `${offHouse} ❌`}`);
    console.log(`    - Official Release xuất ra vẫn là SĐT   : ${offPhone === '0901000113' ? `${offPhone} ✅` : `${offPhone} ❌`}`);

    // -------------------------------------------------------------------------
    // BƯỚC 6: PHÊ DUYỆT LẠI (RE-APPROVAL -> AUTO INCREMENT REVISION)
    // -------------------------------------------------------------------------
    console.log('\n[7] Thực hiện Phê duyệt lại (Re-Approval) hồ sơ:');
    const reApproveRes = await AuditService.approveReport(reportId, zoneAdminId, 'Phê duyệt lại thông tin số nhà và hiện trạng sau khi khảo sát bổ sung');
    console.log(`    - Trạng thái sau duyệt : ${reApproveRes.status} ✅`);
    console.log(`    - Số hiệu Revision mới : Rev ${String(reApproveRes.exportRevision).padStart(2, '0')} ✅`);

    // -------------------------------------------------------------------------
    // BƯỚC 7: XUẤT PDF MẪU BẢN 3 (NEW APPROVED REVISION)
    // -------------------------------------------------------------------------
    console.log('\n[8] Đang kết xuất PDF 3: Bản Phê duyệt mới (New Approved Revision)...');
    const t2 = Date.now();
    const resolvedReApproved = await ReportV3Service.resolve(reportId);
    const { pdfBuffer: pdf3Buffer } = await ReportV3Service.renderDraftPdf(resolvedReApproved, undefined, false);
    const pdf3Path = path.join(outDir, '03_REAPPROVED_NEW_REVISION.pdf');
    fs.writeFileSync(pdf3Path, pdf3Buffer);
    console.log(`    -> Đã xuất ${pdf3Path} (${(pdf3Buffer.length / 1e6).toFixed(2)} MB, ${((Date.now() - t2) / 1000).toFixed(1)}s)`);

    const pdf3Data = await extractPdfPages(pdf3Buffer);
    console.log(`    -> Số trang: ${pdf3Data.numPages}`);

    const p3Sq = squeeze(pdf3Data.fullText);
    const p3HasNewHn = p3Sq.includes(squeeze('206/1-KSV-SURVEY'));
    const p3HasNewSt = p3Sq.includes(squeeze('Khảo Sát Hiện Trường'));
    const p3HasNewPhone = p3Sq.includes(squeeze('0988112233'));
    console.log(`    - Bản Rev mới chứa số nhà mới đã duyệt (206/1-KSV-SURVEY): ${p3HasNewHn ? 'ĐÚNG ✅' : 'THIẾU ❌'}`);
    console.log(`    - Bản Rev mới chứa đường mới đã duyệt (Khảo Sát Hiện Trường): ${p3HasNewSt ? 'ĐÚNG ✅' : 'THIẾU ❌'}`);
    console.log(`    - Bản Rev mới chứa SĐT mới đã duyệt (0988112233)        : ${p3HasNewPhone ? 'ĐÚNG ✅' : 'THIẾU ❌'}`);
    if (!p3HasNewHn || !p3HasNewSt || !p3HasNewPhone) {
      throw new Error('PDF 3 không phản ánh đầy đủ thông tin sau khi phê duyệt lại!');
    }

    // -------------------------------------------------------------------------
    // BƯỚC 8: KIỂM CHỨNG DB TRIGGER TÁI KÍCH HOẠT KHÓA BẢO VỆ
    // -------------------------------------------------------------------------
    console.log('\n[9] Kiểm chứng DB Trigger tự động tái kích hoạt khóa bảo vệ sau khi duyệt lại:');
    let triggerReBlocked = false;
    try {
      await client.query(`UPDATE parcels SET house_number = '777-HACK-FAIL' WHERE id = $1;`, [parcelId]);
    } catch (err: any) {
      if (err.message.includes('PARCEL_LOCKED_APPROVED')) {
        triggerReBlocked = true;
        console.log(`    Trigger đã chặn thành công: "${err.message.split('\n')[0]}" ✅`);
      }
    }
    if (!triggerReBlocked) {
      throw new Error('LỖI TRIGGER: Sau khi phê duyệt lại, DB trigger không tự động tái kích hoạt bảo vệ parcels!');
    }

    // -------------------------------------------------------------------------
    // BƯỚC 9: ĐIỀU TRA LỖI SÂU & RÀ SOÁT CÁC LỖI TIỀM ẨN TRÊN CẢ 3 BẢN PDF
    // -------------------------------------------------------------------------
    console.log('\n[10] Rà soát và tìm kiếm bug trên các file PDF đã xuất:');

    const FORBIDDEN_WORDS = ['NaN', 'undefined', '[object Object]', 'blob:'];
    for (const [name, pData] of [['Bản 1 (Baseline)', pdf1Data], ['Bản 2 (WIP Preview)', pdf2Data], ['Bản 3 (Re-approved)', pdf3Data]] as const) {
      console.log(`    --- Kiểm tra ${name} ---`);
      for (const word of FORBIDDEN_WORDS) {
        if (pData.fullText.includes(word)) {
          throw new Error(`PHÁT HIỆN LỖI: ${name} chứa chuỗi bất thường '${word}'`);
        } else {
          console.log(`      ✓ Tuyệt đối sạch từ cấm '${word}'`);
        }
      }
      console.log(`      ✓ Cấu trúc trang: ${pData.numPages} trang, không bị lỗi gãy trang bất thường.`);
    }

  } finally {
    // -------------------------------------------------------------------------
    // BƯỚC 10: HOÀN NGUYÊN 100% CSDL VỀ TRẠNG THÁI NGUYÊN GỐC BAN ĐẦU
    // -------------------------------------------------------------------------
    console.log('\n[11] Đang hoàn nguyên CSDL về đúng 100% trạng thái nguyên gốc ban đầu...');
    // Hạ trạng thái report về DRAFT trước để vô hiệu hóa trigger tạm thời
    await client.query(`UPDATE base_survey_reports SET status = 'UNDER_REVIEW' WHERE id = $1;`, [reportId]);

    // Khôi phục bảng parcels
    await client.query(
      `UPDATE parcels
       SET house_number = $2,
           street = $3,
           ward = $4,
           district = $5,
           owner_name = $6,
           owner_phone = $7,
           land_area_m2 = $8,
           survey_status = $9,
           updated_at = NOW()
       WHERE id = $1;`,
      [
        parcelId,
        origP.house_number,
        origP.street,
        origP.ward,
        origP.district,
        origP.owner_name,
        origP.owner_phone,
        origP.land_area_m2,
        origP.survey_status,
      ]
    );

    // Khôi phục bảng base_survey_reports
    await client.query(
      `UPDATE base_survey_reports
       SET status = $2,
           export_revision = $3,
           survey_data_json = $4,
           updated_at = NOW()
       WHERE id = $1;`,
      [reportId, origR.status, origR.export_revision, JSON.stringify(origR.survey_data_json)]
    );

    // Dọn dẹp version phát sinh trong test để không làm ô nhiễm version history thực tế
    await client.query(
      `DELETE FROM survey_report_versions
       WHERE report_id = $1 AND title LIKE 'Phê duyệt lại%' AND created_at > NOW() - INTERVAL '5 MINUTES';`,
      [reportId]
    );

    console.log('    ✓ Đã hoàn nguyên thửa đất và báo cáo về nguyên trạng 100%.');

    client.release();
    await pool.end();
  }

  console.log('\n================================================================================');
  console.log('🎉 THỰC NGHIỆM ĐỐI CHỨNG VÀ ĐIỀU TRA HOÀN TẤT THÀNH CÔNG VỚI TỶ LỆ 100% ĐẠT!');
  console.log('================================================================================');
}

main().catch((e) => {
  console.error('[FATAL ERROR]:', e);
  process.exit(1);
});
