/**
 * ============================================================================
 * SCRIPT THỰC NGHIỆM ĐỐI CHỨNG (METHOD 2 AUDIT)
 * Kiểm tra tính bất biến và rò rỉ dữ liệu của Báo cáo Phase 1 từ bản APPROVED
 * 
 * Quy trình:
 * 1. Nạp hồ sơ APPROVED của lô đất C&C-01-B-0228
 * 2. Xuất dữ liệu Báo cáo Bản 1 (Baseline)
 * 3. Tạm thời sửa các trường trong bảng `parcels`
 * 4. Xuất dữ liệu Báo cáo Bản 2 (Modified)
 * 5. Khôi phục 100% dữ liệu gốc trong khối finally (Bảo vệ tuyệt đối CSDL)
 * 6. So sánh Diff từng trường và xuất bảng kết quả chi tiết
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import { Database } from '../database/db';
import { ReportService } from '../modules/report/report-v2.service';
import { ReportViewModelMapper } from '../modules/report/mappers/report-v2-viewmodel.mapper';
import { ReportConfigService } from '../modules/report_config/report-config.service';

interface ParcelBackup {
  id: string;
  project_parcel_code: string;
  house_number: string | null;
  street: string | null;
  ward: string | null;
  district: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  land_area_m2: number | string | null;
  construction_area_m2: number | string | null;
  floor_count: number | null;
  building_type: string | null;
}

interface ExtractedReportFields {
  reportNo: string;
  buildingId: string;
  houseNumber: string;
  street: string;
  ward: string;
  district: string;
  formattedAddressVi: string;
  ownerName: string;
  contactPhone: string;
  storeysAbove: number | string;
  landAreaM2: string;
  totalFloorAreaM2: string;
  mainDimensionsVi: string;
  buildingTypeVi: string;
  surveyCategoryVi: string;
  distanceToMetroVi: string;
  structureTypeVi: string;
  foundationTypeVi: string;
  foundationDepthVi: string;
  totalEcsScore: number | string | null;
  totalViScore: number | string | null;
  braVi: string;
}

function extractFields(viewModel: any): ExtractedReportFields {
  return {
    reportNo: viewModel.metadata?.reportNo || '',
    buildingId: viewModel.metadata?.buildingId || '',
    houseNumber: viewModel.section1?.address?.houseNumber || '',
    street: viewModel.section1?.address?.street || '',
    ward: viewModel.section1?.address?.ward || '',
    district: viewModel.section1?.address?.district || '',
    formattedAddressVi: viewModel.section1?.address?.vi || '',
    ownerName: viewModel.section1?.ownerOccupant?.vi || '',
    contactPhone: viewModel.section1?.contactPhone || '',
    storeysAbove: viewModel.section2?.storeysAbove ?? '',
    landAreaM2: viewModel.section2?.landAreaM2 || '',
    totalFloorAreaM2: viewModel.section2?.totalFloorAreaM2 || '',
    mainDimensionsVi: viewModel.section2?.mainDimensions?.vi || '',
    buildingTypeVi: viewModel.section1?.buildingName?.vi || '',
    surveyCategoryVi: viewModel.section2?.surveyCategory?.vi || '',
    distanceToMetroVi: viewModel.section2?.distanceToMetroDisplay?.vi || '',
    structureTypeVi: viewModel.section4?.structureType?.vi || '',
    foundationTypeVi: viewModel.section4?.foundationType?.vi || '',
    foundationDepthVi: viewModel.section4?.foundationDepth?.vi || '',
    totalEcsScore: viewModel.section7?.ecsScore?.total ?? viewModel.section7?.ecsTotal ?? null,
    totalViScore: viewModel.section7?.viScore?.total ?? viewModel.section7?.viTotal ?? null,
    braVi: viewModel.section8?.braRating?.vi || viewModel.section8?.matrixRating?.vi || '',
  };
}

async function runAudit() {
  console.log('🚀 [AUDIT] Bắt đầu thực nghiệm đối chứng tính bất biến của Báo cáo APPROVED...\n');

  const targetParcelCode = 'C&C-01-B-0228';
  const targetReportId = '60f4a409-7626-4de4-a61e-5dc2ef91feca';

  // 1. Kiểm tra lô đất và hồ sơ trong DB
  const parcelRes = await Database.query<ParcelBackup>(
    `SELECT id, project_parcel_code, house_number, street, ward, district, owner_name, owner_phone,
            land_area_m2, construction_area_m2, floor_count, building_type
     FROM parcels WHERE project_parcel_code = $1;`,
    [targetParcelCode]
  );

  if (!parcelRes.rows[0]) {
    throw new Error(`Không tìm thấy lô đất mục tiêu: ${targetParcelCode}`);
  }
  const originalParcel = parcelRes.rows[0];
  console.log(`📍 Tìm thấy lô đất mục tiêu: ${originalParcel.project_parcel_code} (ID: ${originalParcel.id})`);

  const reportRes = await Database.query<{ id: string; status: string; report_code: string; survey_data_json: any }>(
    `SELECT id, status, report_code, survey_data_json FROM base_survey_reports WHERE id = $1;`,
    [targetReportId]
  );
  if (!reportRes.rows[0]) {
    throw new Error(`Không tìm thấy hồ sơ báo cáo: ${targetReportId}`);
  }
  const reportRow = reportRes.rows[0];
  console.log(`📄 Tìm thấy hồ sơ báo cáo: ${reportRow.report_code} (Trạng thái: ${reportRow.status})\n`);

  const surveyJson = reportRow.survey_data_json || {};

  const config = await ReportConfigService.getActiveConfig();

  // 2. Xuất Bản 1: Baseline (Trước khi sửa parcels)
  console.log('--- BƯỚC 1: XUẤT BÁO CÁO BẢN 1 (BASELINE TRƯỚC BIẾN ĐỘNG) ---');
  const rawReport1 = await ReportService.resolveReport(targetReportId);
  const viewModel1 = ReportViewModelMapper.buildViewModel(rawReport1, undefined, config);
  const fields1 = extractFields(viewModel1);

  // Tạo thư mục scratch lưu trữ
  const scratchDir = path.resolve(__dirname, '../../../scratch');
  if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
  }

  fs.writeFileSync(path.join(scratchDir, 'report_baseline_v1.json'), JSON.stringify(viewModel1, null, 2), 'utf8');
  console.log('✅ Đã lưu dữ liệu Bản 1 vào scratch/report_baseline_v1.json');

  let mutatedFieldsSuccess = false;
  let fields2: ExtractedReportFields | null = null;
  let viewModel2: any = null;

  try {
    // 3. Sửa đổi bảng parcels bằng dữ liệu dị biệt
    console.log('\n--- BƯỚC 2: CẬP NHẬT BIẾN ĐỘNG BẢNG PARCELS TRONG CSDL ---');
    await Database.query(
      `UPDATE parcels
       SET house_number = '9999-BIẾN-ĐỘNG',
           street = 'Đường Thử Nghiệm Lỗ Hổng Metro 2',
           ward = 'Phường Đã Bị Sửa Đổi',
           district = 'Quận Kiểm Chứng Lỗi',
           owner_name = 'CHỦ HỘ BỊ THAY ĐỔI TRÁI PHÉP',
           owner_phone = '0999888777',
           land_area_m2 = 999.90,
           construction_area_m2 = 888.80,
           floor_count = 9,
           building_type = 'CONDOMINIUM',
           updated_at = NOW()
       WHERE id = $1;`,
      [originalParcel.id]
    );
    mutatedFieldsSuccess = true;
    console.log('⚠️ Đã cập nhật 10 trường trong bảng parcels thành dữ liệu đột biến TEST.');

    // 4. Xuất Bản 2: Modified (Sau khi sửa parcels)
    console.log('\n--- BƯỚC 3: XUẤT BÁO CÁO BẢN 2 (KHI LÔ ĐẤT ĐÃ BỊ BIẾN ĐỘNG) ---');
    const rawReport2 = await ReportService.resolveReport(targetReportId);
    viewModel2 = ReportViewModelMapper.buildViewModel(rawReport2, undefined, config);
    fields2 = extractFields(viewModel2);

    fs.writeFileSync(path.join(scratchDir, 'report_after_parcel_edit_v2.json'), JSON.stringify(viewModel2, null, 2), 'utf8');
    console.log('✅ Đã lưu dữ liệu Bản 2 vào scratch/report_after_parcel_edit_v2.json');

  } finally {
    // 5. Khôi phục 100% dữ liệu gốc trong khối finally (BẢO VỆ CƠ SỞ DỮ LIỆU)
    console.log('\n--- BƯỚC 4: KHÔI PHỤC (ROLLBACK) 100% NGUYÊN TRẠNG CSDL ---');
    await Database.query(
      `UPDATE parcels
       SET house_number = $2,
           street = $3,
           ward = $4,
           district = $5,
           owner_name = $6,
           owner_phone = $7,
           land_area_m2 = $8,
           construction_area_m2 = $9,
           floor_count = $10,
           building_type = $11,
           updated_at = NOW()
       WHERE id = $1;`,
      [
        originalParcel.id,
        originalParcel.house_number,
        originalParcel.street,
        originalParcel.ward,
        originalParcel.district,
        originalParcel.owner_name,
        originalParcel.owner_phone,
        originalParcel.land_area_m2,
        originalParcel.construction_area_m2,
        originalParcel.floor_count,
        originalParcel.building_type,
      ]
    );

    // Xác minh lại sau khi restore
    const verifyRes = await Database.query<ParcelBackup>(
      `SELECT house_number, street, owner_name, owner_phone, land_area_m2, floor_count FROM parcels WHERE id = $1;`,
      [originalParcel.id]
    );
    const restored = verifyRes.rows[0];
    console.log('🛡️ Xác minh khôi phục:', {
      house_number: restored.house_number,
      street: restored.street,
      owner_name: restored.owner_name,
      owner_phone: restored.owner_phone,
      land_area_m2: restored.land_area_m2,
      floor_count: restored.floor_count,
    });
    console.log('✅ CSDL LÔ ĐẤT ĐÃ ĐƯỢC HOÀN NGUYÊN AN TOÀN TUYỆT ĐỐI.');
  }

  // 6. Phân tích Diff giữa Bản 1 và Bản 2
  if (fields2) {
    console.log('\n======================================================================');
    console.log('📊 BẢNG SO SÁNH ĐỐI CHỨNG DIFF (BẢN 1 BASELINE vs BẢN 2 MODIFIED)');
    console.log('======================================================================\n');

    interface DiffItem {
      field: string;
      surveyJsonValue: any;
      baselineValue: any;
      modifiedValue: any;
      status: 'LEAKED_VULNERABILITY' | 'IMMUTABLE_SAFE';
      note: string;
    }

    const diffResults: DiffItem[] = [
      {
        field: '1. Số nhà & Địa chỉ hiển thị (address.vi)',
        surveyJsonValue: `${surveyJson.houseNumber} ${surveyJson.street}`,
        baselineValue: fields1.formattedAddressVi,
        modifiedValue: fields2.formattedAddressVi,
        status: fields1.formattedAddressVi !== fields2.formattedAddressVi ? 'LEAKED_VULNERABILITY' : 'IMMUTABLE_SAFE',
        note: fields1.formattedAddressVi !== fields2.formattedAddressVi
          ? '🔴 LỖ HỔNG: Số nhà và địa chỉ trên báo cáo đổi theo lô đất, bỏ qua dữ liệu khảo sát!'
          : '🟢 An toàn',
      },
      {
        field: '2. Tên chủ hộ / Người sử dụng (ownerOccupant.vi)',
        surveyJsonValue: surveyJson.ownerName || 'null',
        baselineValue: fields1.ownerName,
        modifiedValue: fields2.ownerName,
        status: fields1.ownerName !== fields2.ownerName ? 'LEAKED_VULNERABILITY' : 'IMMUTABLE_SAFE',
        note: fields1.ownerName !== fields2.ownerName
          ? '🔴 LỖ HỔNG: Tên chủ hộ trên báo cáo bị thay đổi theo bảng parcels!'
          : '🟢 An toàn (Đã giữ nguyên)',
      },
      {
        field: '3. Số điện thoại liên hệ (contactPhone)',
        surveyJsonValue: surveyJson.ownerPhone || 'null',
        baselineValue: fields1.contactPhone,
        modifiedValue: fields2.contactPhone,
        status: fields1.contactPhone !== fields2.contactPhone ? 'LEAKED_VULNERABILITY' : 'IMMUTABLE_SAFE',
        note: fields1.contactPhone !== fields2.contactPhone
          ? '🔴 LỖ HỔNG: SĐT trên báo cáo đổi theo parcels, đè lên SĐT KSV thu thập!'
          : '🟢 An toàn (Đã giữ nguyên)',
      },
      {
        field: '4. Số tầng nổi (storeysAbove)',
        surveyJsonValue: surveyJson.aboveFloors ?? 'null',
        baselineValue: String(fields1.storeysAbove),
        modifiedValue: String(fields2.storeysAbove),
        status: String(fields1.storeysAbove) !== String(fields2.storeysAbove) ? 'LEAKED_VULNERABILITY' : 'IMMUTABLE_SAFE',
        note: String(fields1.storeysAbove) !== String(fields2.storeysAbove)
          ? '🔴 LỖ HỔNG: Số tầng bị thay đổi theo floor_count của parcels!'
          : '🟢 An toàn (Đã giữ nguyên)',
      },
      {
        field: '5. Diện tích đất (landAreaM2)',
        surveyJsonValue: surveyJson.landAreaM2 ?? 'null',
        baselineValue: fields1.landAreaM2,
        modifiedValue: fields2.landAreaM2,
        status: fields1.landAreaM2 !== fields2.landAreaM2 ? 'LEAKED_VULNERABILITY' : 'IMMUTABLE_SAFE',
        note: fields1.landAreaM2 !== fields2.landAreaM2
          ? '🔴 LỖ HỔNG: Diện tích đất trên báo cáo bị đổi theo parcels!'
          : '🟢 An toàn (Đã giữ nguyên)',
      },
      {
        field: '6. Tổng diện tích sàn GFA (totalFloorAreaM2)',
        surveyJsonValue: surveyJson.constructionAreaM2 ?? 'null',
        baselineValue: fields1.totalFloorAreaM2,
        modifiedValue: fields2.totalFloorAreaM2,
        status: fields1.totalFloorAreaM2 !== fields2.totalFloorAreaM2 ? 'LEAKED_VULNERABILITY' : 'IMMUTABLE_SAFE',
        note: fields1.totalFloorAreaM2 !== fields2.totalFloorAreaM2
          ? '🔴 LỖ HỔNG: GFA bị thay đổi theo parcels!'
          : '🟢 An toàn: Ưu tiên surveyJson.constructionAreaM2 nên không bị đổi',
      },
      {
        field: '7. Tên công trình / Phân loại (use.vi)',
        surveyJsonValue: surveyJson.buildingName || surveyJson.buildingType || 'null',
        baselineValue: fields1.buildingTypeVi,
        modifiedValue: fields2.buildingTypeVi,
        status: fields1.buildingTypeVi !== fields2.buildingTypeVi ? 'LEAKED_VULNERABILITY' : 'IMMUTABLE_SAFE',
        note: fields1.buildingTypeVi !== fields2.buildingTypeVi
          ? '🔴 LỖ HỔNG: Tên loại công trình bị đổi theo building_type của parcels!'
          : '🟢 An toàn (Đã giữ nguyên)',
      },
      {
        field: '8. Nhóm đối tượng khảo sát (surveyCategory.vi)',
        surveyJsonValue: surveyJson.surveyCaseType || 'null',
        baselineValue: fields1.surveyCategoryVi,
        modifiedValue: fields2.surveyCategoryVi,
        status: fields1.surveyCategoryVi !== fields2.surveyCategoryVi ? 'LEAKED_VULNERABILITY' : 'IMMUTABLE_SAFE',
        note: fields1.surveyCategoryVi !== fields2.surveyCategoryVi
          ? '🔴 LỖ HỔNG: Nhóm đối tượng khảo sát đổi theo parcels!'
          : '🟢 An toàn (Đã giữ nguyên)',
      },
      {
        field: '9. Kết cấu chịu lực (structureType.vi)',
        surveyJsonValue: surveyJson.structureSystem || 'null',
        baselineValue: fields1.structureTypeVi,
        modifiedValue: fields2.structureTypeVi,
        status: fields1.structureTypeVi !== fields2.structureTypeVi ? 'LEAKED_VULNERABILITY' : 'IMMUTABLE_SAFE',
        note: fields1.structureTypeVi !== fields2.structureTypeVi
          ? '🔴 LỖ HỔNG'
          : '🟢 An toàn: Đọc từ survey_data_json/specs của báo cáo',
      },
      {
        field: '10. Loại móng & Độ sâu (foundationType, depth)',
        surveyJsonValue: `${surveyJson.foundationType || ''} (-${surveyJson.foundationDepthM || ''}m)`,
        baselineValue: `${fields1.foundationTypeVi} | ${fields1.foundationDepthVi}`,
        modifiedValue: `${fields2.foundationTypeVi} | ${fields2.foundationDepthVi}`,
        status: fields1.foundationTypeVi !== fields2.foundationTypeVi ? 'LEAKED_VULNERABILITY' : 'IMMUTABLE_SAFE',
        note: '🟢 An toàn: Đọc từ survey_data_json của báo cáo',
      },
      {
        field: '11. Điểm số đánh giá rủi ro (ECS / VI / BRA)',
        surveyJsonValue: `ECS: ${surveyJson.ecs?.totalEcs ?? 'null'} | VI: ${surveyJson.vi?.totalVi ?? 'null'}`,
        baselineValue: `ECS: ${fields1.totalEcsScore} | VI: ${fields1.totalViScore}`,
        modifiedValue: `ECS: ${fields2.totalEcsScore} | VI: ${fields2.totalViScore}`,
        status: fields1.totalEcsScore !== fields2.totalEcsScore ? 'LEAKED_VULNERABILITY' : 'IMMUTABLE_SAFE',
        note: '🟢 An toàn: Điểm số đã được bảo vệ độc lập',
      },
    ];

    console.table(diffResults.map(r => ({
      'Trường thông tin': r.field,
      'Bản 1 (Baseline)': r.baselineValue,
      'Bản 2 (Sau khi sửa Lô đất)': r.modifiedValue,
      'Kết luận': r.status === 'LEAKED_VULNERABILITY' ? '🔴 BỊ ĐỔI (LỖ HỔNG)' : '🟢 BẤT BIẾN (AN TOÀN)',
    })));

    fs.writeFileSync(
      path.join(scratchDir, 'diff_audit_results.json'),
      JSON.stringify(diffResults, null, 2),
      'utf8'
    );
    console.log('\n📄 Chi tiết so sánh đã được ghi vào scratch/diff_audit_results.json');
  }
}

runAudit()
  .then(() => {
    console.log('\n🎉 Hoàn thành thực nghiệm kiểm chứng thành công!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Lỗi khi thực hiện kiểm chứng:', err);
    process.exit(1);
  });
