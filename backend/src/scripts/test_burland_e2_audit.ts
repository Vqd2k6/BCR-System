import * as fs from 'fs';
import * as path from 'path';
import { pool } from '../database/db';
import { ReportV3Service } from '../modules/report_v3/report-v3.service';
import { ReportV2ViewModelMapper } from '../modules/report_v2/mappers/report-v2-viewmodel.mapper';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');

async function extractSectionPages(pdfBuffer: Buffer): Promise<{ pageNum: number; text: string }[]> {
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    useSystemFonts: true,
    disableFontFace: true,
    verbosity: 0,
  }).promise;

  const results: { pageNum: number; text: string }[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const str = content.items.map((it: any) => it.str).join(' ');
    if (
      str.includes('DAMAGE CLASSIFICATION CONCLUSION') ||
      str.includes('BẢNG VIII.1') ||
      str.includes('BẢNG ĐIỂM HIỆN TRẠNG ECS') ||
      str.includes('KẾT LUẬN PHÂN LOẠI BURLAND')
    ) {
      results.push({ pageNum: i, text: str });
    }
  }
  return results;
}

async function runAudit() {
  const testParcels = [
    'C&C-05-B-0053', // ZERO DEFECTS (formerly had lingering MODERATE flag in DB)
    'C&C-05-B-0019', // ZERO DEFECTS (formerly had lingering MODERATE flag in DB)
    'C&C-05-B-0062', // Report in user screenshot (DB flag: NONE)
    'C&C-05-B-0075', // DB flag: MODERATE, real defects
    'C&C-05-B-0070', // DB flag: MODERATE, real defects
  ];

  console.log('================================================================');
  console.log('🔍 AUDIT BURLAND & E2 STRUCTURAL FLAG ACROSS RANDOM REPORTS');
  console.log('================================================================\n');

  for (const parcelCode of testParcels) {
    console.log(`\n--------------------------------------------------------------`);
    console.log(`Auditing Parcel: ${parcelCode}`);
    console.log(`--------------------------------------------------------------`);

    try {
      const resolved = await ReportV3Service.resolve(parcelCode);
      const rawReport = resolved.raw as any;
      const json = rawReport.survey_data_json || {};
      const bs = json.burlandSummary || {};
      const ecs = json.ecs || {};

      console.log('DB burlandSummary:', {
        localMaxGrade: bs.localMaxGrade,
        predominantGrade: bs.predominantGrade,
        structuralFlagLevel: bs.structuralFlagLevel,
        needStructuralEngineerReview: bs.needStructuralEngineerReview,
      });
      console.log('DB ecs:', { e1: ecs.e1, e2: ecs.e2, totalEcs: ecs.totalEcs });

      const vm = ReportV2ViewModelMapper.buildViewModel(rawReport);
      console.log('ViewModel Section 7:', {
        predominant: vm.section7.predominantGrade.vi,
        localMax: vm.section7.localMaxGrade.vi,
        governingZone: vm.section7.governingZone.vi,
        structuralFlag: vm.section7.structuralFlagLevel.vi,
        needReview: vm.section7.needStructuralReview.vi,
      });
      console.log('ViewModel Section 8:', {
        structuralFlag: vm.section8.ecs.structuralFlag,
        e1Score: vm.section8.ecs.items.find((i) => i.code === 'E1')?.score,
        e2Score: vm.section8.ecs.items.find((i) => i.code === 'E2')?.score,
        totalScore: vm.section8.ecs.totalScore,
      });

      // Render actual PDF and extract Section 7 and 8 pages
      console.log('Rendering PDF to inspect actual printed text...');
      const { pdfBuffer } = await ReportV3Service.renderDraftPdf(resolved, undefined, false);
      const sectionPages = await extractSectionPages(pdfBuffer);
      for (const sp of sectionPages) {
        console.log(`\n[Page ${sp.pageNum}] Text snippet:`);
        // Extract lines around Burland and ECS
        const lines = sp.text.split(/(?<=\.|\))\s+/);
        for (const line of lines) {
          if (
            line.includes('DAMAGE CLASSIFICATION') ||
            line.includes('Cấp độ chủ đạo') ||
            line.includes('Cấp độ cục bộ') ||
            line.includes('Cờ kết cấu') ||
            line.includes('Thẩm tra') ||
            line.includes('Khuyết tật kết cấu') ||
            line.includes('Bảng VIII.1')
          ) {
            console.log('   >', line.trim());
          }
        }
      }
    } catch (err) {
      console.error(`Error auditing ${parcelCode}:`, err);
    }
  }

  await pool.end();
  process.exit(0);
}

runAudit().catch((err) => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
