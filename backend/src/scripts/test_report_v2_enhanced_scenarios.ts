/**
 * Test Suite Phase 7: Kiểm thử mở rộng các kịch bản thực địa phức tạp (Enhanced Field Scenarios)
 * Bao gồm:
 * 1. Đất trống (Vacant Land) - Storeys = 0, Không gian không nhà, Phụ lục ảnh đất trống.
 * 2. Khảo sát vắng chủ (Absentee Survey) - Biên bản niêm yết absenteeMinutesPhotos đưa vào Phụ lục 3.
 * 3. Đang thi công (Under Construction) - Giai đoạn thi công và cảnh báo kết cấu dở dang.
 * 4. Ghép thửa GIS (GIS Merged) - Phân rã diện tích xây dựng trên thửa khảo sát và thửa ghép.
 * 5. Khuyết tật đa ảnh D-xx (Multi-photo CU) - Cận cảnh + thước đo chuyên dụng (trio container).
 * 6. Tầng không cấu kiện chịu lực riêng biệt (Roof/Floor without structural elements) - Ghi chú kỹ thuật.
 */

import { ReportV2ViewModelMapper } from '../modules/report_v2/mappers/report-v2-viewmodel.mapper';
import { ReportV2Service } from '../modules/report_v2/report-v2.service';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

async function runEnhancedScenarioTests() {
  console.log('🚀 Bắt đầu Kiểm thử Kịch bản Mở rộng Thực địa (Enhanced Field Scenarios)...');
  const { template: compiled, styles: stylesSource } = ReportV2Service.getCompiledTemplate();

  // =========================================================================
  // SCENARIO 1: ĐẤT TRỐNG (VACANT LAND)
  // =========================================================================
  console.log('\n--- SCENARIO 1: ĐẤT TRỐNG (VACANT LAND) ---');
  const vacantLandData = {
    project_parcel_code: 'C&C-01-B-09999',
    zone_id: 'ZONE_09',
    survey_date: '26/09/2026 (14:00)',
    surveyor_name: 'Nguyễn Trọng Tuấn',
    survey_data_json: {
      isVacantLand: true,
      surveyCaseType: 'VACANT_LAND',
      landPlotAreaM2: 120.5,
      vacantLandNotes: 'Khu đất trống rào tôn xung quanh, không có công trình xây dựng',
      photos: {
        p01: 'data:image/svg+xml;utf8,<svg><text y="20">Land</text></svg>',
        p02: 'data:image/svg+xml;utf8,<svg><text y="20">Boundary</text></svg>',
      },
      floors: [],
    },
  };

  const vmVacant = ReportV2ViewModelMapper.buildViewModel(vacantLandData);
  assert(vmVacant.scenarioFlags.isVacantLand === true, 'ScenarioFlags.isVacantLand = true');
  assert(vmVacant.section2.storeysAbove === 0, 'Section 2: storeysAbove = 0');
  assert(vmVacant.section2.storeysBasement === 0, 'Section 2: storeysBasement = 0');
  assert(vmVacant.section2.footprintM2 === '0.0', 'Section 2: footprintM2 = 0.0');
  assert(Boolean(vmVacant.section2.vacantLandStatus), 'Section 2 có vacantLandStatus');
  assert(vmVacant.section4.structuralType.vi.includes('đất trống'), 'Section 4 structuralType nêu rõ đất trống');

  const htmlVacant = compiled({ ...vmVacant, styles: stylesSource });
  assert(htmlVacant.includes('Hiện trạng khu đất'), 'HTML chứa dòng Hiện trạng khu đất');
  assert(htmlVacant.includes('rào tôn'), 'HTML chứa ghi chú hiện trạng khu đất trống');

  // =========================================================================
  // SCENARIO 2: KHẢO SÁT VẮNG CHỦ (ABSENTEE SURVEY)
  // =========================================================================
  console.log('\n--- SCENARIO 2: KHẢO SÁT VẮNG CHỦ (ABSENTEE SURVEY) ---');
  const absenteeData = {
    project_parcel_code: 'C&C-01-B-08888',
    zone_id: 'ZONE_09',
    survey_date: '26/09/2026 (15:00)',
    surveyor_name: 'Nguyễn Trọng Tuấn',
    is_absentee_survey: true,
    survey_data_json: {
      isAbsenteeSurvey: true,
      absenteeMinutesPhotos: [
        'https://cdn.metro2.vn/docs/absentee_notice_01.jpg',
        'https://cdn.metro2.vn/docs/absentee_notice_02.jpg',
      ],
      photos: {
        p01: 'data:image/svg+xml;utf8,<svg><text y="20">P01</text></svg>',
      },
      floors: [],
    },
  };

  const vmAbsentee = ReportV2ViewModelMapper.buildViewModel(absenteeData);
  assert(vmAbsentee.scenarioFlags.isAbsenteeSurvey === true, 'ScenarioFlags.isAbsenteeSurvey = true');
  assert(vmAbsentee.appendix3.signedRecordPages.length === 2, 'Appendix 3 có đúng 2 trang biên bản niêm yết vắng chủ');
  assert(vmAbsentee.appendix3.ownerRepresentative.vi.includes('Vắng mặt'), 'Chủ sở hữu ghi nhận vắng mặt');
  assert(vmAbsentee.appendix3.signedRecordPages[0].title.vi.includes('vắng chủ'), 'Tiêu đề trang tài liệu nêu rõ biên bản vắng chủ');

  const htmlAbsentee = compiled({ ...vmAbsentee, styles: stylesSource });
  assert(htmlAbsentee.includes('vắng chủ'), 'HTML Appendix 3 chứa biên bản vắng chủ');

  // =========================================================================
  // SCENARIO 3: CÔNG TRÌNH ĐANG THI CÔNG (UNDER CONSTRUCTION)
  // =========================================================================
  console.log('\n--- SCENARIO 3: CÔNG TRÌNH ĐANG THI CÔNG (UNDER CONSTRUCTION) ---');
  const underConstructionData = {
    project_parcel_code: 'C&C-01-B-07777',
    zone_id: 'ZONE_09',
    survey_date: '26/09/2026 (16:00)',
    surveyor_name: 'Nguyễn Trọng Tuấn',
    survey_data_json: {
      surveyCaseType: 'UNDER_CONSTRUCTION',
      constructionStage: 'Đang thi công phần thô đến sàn tầng 3',
      photos: {
        p01: 'data:image/svg+xml;utf8,<svg><text y="20">P01</text></svg>',
      },
      floors: [],
    },
  };

  const vmConst = ReportV2ViewModelMapper.buildViewModel(underConstructionData);
  assert(vmConst.scenarioFlags.isUnderConstruction === true, 'ScenarioFlags.isUnderConstruction = true');
  assert(Boolean(vmConst.section2.constructionStageNotes), 'Section 2 có constructionStageNotes');
  assert(vmConst.section4.visibleStructuralCondition.vi.includes('thi công'), 'Section 4 ghi nhận công trình đang thi công dở dang');

  const htmlConst = compiled({ ...vmConst, styles: stylesSource });
  assert(htmlConst.includes('Giai đoạn thi công'), 'HTML Mục II có dòng Giai đoạn thi công');
  assert(htmlConst.includes('sàn tầng 3'), 'HTML hiển thị đúng tiến độ thi công');

  // =========================================================================
  // SCENARIO 4: GHÉP THỬA GIS (GIS MERGED)
  // =========================================================================
  console.log('\n--- SCENARIO 4: GHÉP THỬA GIS (GIS MERGED) ---');
  const gisMergedData = {
    project_parcel_code: 'C&C-01-B-06666',
    zone_id: 'ZONE_09',
    survey_date: '26/09/2026 (17:00)',
    surveyor_name: 'Nguyễn Trọng Tuấn',
    survey_data_json: {
      gisMutationType: 'MERGED',
      surveyedParcelAreaM2: 75.0,
      totalPlotAreaM2: 150.0,
      mergedParcelCodes: ['C&C-01-B-06666', 'C&C-01-B-06667'],
      photos: {
        p01: 'data:image/svg+xml;utf8,<svg><text y="20">P01</text></svg>',
      },
      floors: [],
    },
  };

  const vmMerged = ReportV2ViewModelMapper.buildViewModel(gisMergedData);
  assert(vmMerged.scenarioFlags.isGisMerged === true, 'ScenarioFlags.isGisMerged = true');
  assert(Boolean(vmMerged.section2.gisMergedInfo), 'Section 2 có gisMergedInfo');
  assert(Boolean(vmMerged.section2.gisMergedInfo?.vi.includes('75')), 'gisMergedInfo ghi nhận diện tích thửa khảo sát');

  const htmlMerged = compiled({ ...vmMerged, styles: stylesSource });
  assert(htmlMerged.includes('Hiện trạng biến động GIS'), 'HTML Mục II có dòng Hiện trạng biến động GIS');

  // =========================================================================
  // SCENARIO 5: KHUYẾT TẬT ĐA ẢNH D-xx (MULTI-PHOTO CU)
  // =========================================================================
  console.log('\n--- SCENARIO 5: KHUYẾT TẬT ĐA ẢNH D-xx (MULTI-PHOTO CU) ---');
  const multiPhotoDefectData = {
    project_parcel_code: 'C&C-01-B-05555',
    zone_id: 'ZONE_09',
    survey_date: '26/09/2026 (18:00)',
    surveyor_name: 'Nguyễn Trọng Tuấn',
    survey_data_json: {
      photos: {
        p01: 'data:image/svg+xml;utf8,<svg><text y="20">P01</text></svg>',
      },
      floors: [
        {
          floorId: 'FLOOR_01',
          floorName: 'Tầng Trệt',
          zones: [
            {
              zoneCode: 'Z-01',
              roomName: 'Phòng khách',
              defects: [
                {
                  defectCode: 'D-01',
                  defectType: 'Vết nứt tường',
                  widthMm: 0.8,
                  lengthM: 1.5,
                  cuPhotos: [
                    'https://cdn.metro2.vn/defects/d01_cu1.jpg',
                    'https://cdn.metro2.vn/defects/d01_cu2_gauge.jpg',
                  ],
                  contextPhotoUrl: 'https://cdn.metro2.vn/defects/d01_ctx.jpg',
                },
              ],
            },
          ],
        },
      ],
    },
  };

  const vmDefect = ReportV2ViewModelMapper.buildViewModel(multiPhotoDefectData);
  const fl0 = vmDefect.appendix2[0];
  assert(fl0.defectPairPhotos.length === 1, 'Floor có 1 cặp/bộ ảnh khuyết tật');
  const pair0 = fl0.defectPairPhotos[0];
  assert(pair0.hasExtraCloseUp === true, 'pair0.hasExtraCloseUp = true khi có 2 cuPhotos');
  assert(Boolean(pair0.extraCloseUpPhotoUrl), 'pair0 có extraCloseUpPhotoUrl từ cuPhotos[1]');

  const htmlDefect = compiled({ ...vmDefect, styles: stylesSource });
  assert(htmlDefect.includes('defect-trio-container'), 'HTML Phụ lục 2 render defect-trio-container');

  // =========================================================================
  // SCENARIO 6: TẦNG KHÔNG CẤU KIỆN CHỊU LỰC RIÊNG BIỆT (ROOFTOP / MÁI TÔN)
  // =========================================================================
  console.log('\n--- SCENARIO 6: TẦNG MÁI KHÔNG BỐ TRÍ CẤU KIỆN KẾT CẤU RIÊNG BIỆT ---');
  const roofWithoutStructData = {
    project_parcel_code: 'C&C-01-B-04444',
    zone_id: 'ZONE_09',
    survey_date: '26/09/2026 (19:00)',
    surveyor_name: 'Nguyễn Trọng Tuấn',
    survey_data_json: {
      photos: {
        p01: 'data:image/svg+xml;utf8,<svg><text y="20">P01</text></svg>',
      },
      floors: [
        {
          floorId: 'FLOOR_ROOF',
          floorName: 'Mái tôn',
          hasStructuralElements: false,
          noStructuralElementsReason: 'Mái tôn xà gồ thép nhẹ, không đổ sàn bê tông cốt thép',
          zones: [],
        },
      ],
    },
  };

  const vmRoof = ReportV2ViewModelMapper.buildViewModel(roofWithoutStructData);
  const roofFl = vmRoof.appendix2[0];
  assert(roofFl.hasStructuralElements === false, 'roofFl.hasStructuralElements = false');
  assert(Boolean(roofFl.noStructuralElementsReason), 'roofFl có noStructuralElementsReason');

  const htmlRoof = compiled({ ...vmRoof, styles: stylesSource });
  assert(htmlRoof.includes('Đặc điểm kết cấu tầng'), 'HTML hiển thị ghi chú Đặc điểm kết cấu tầng');
  assert(htmlRoof.includes('Mái tôn xà gồ thép nhẹ'), 'HTML hiển thị lý do không bố trí cấu kiện kết cấu');

  // =========================================================================
  // SCENARIO 7: PHÂN TRANG BẢNG KHUYẾT TẬT KHI CÓ NHIỀU VẾT NỨT (> 5 VẾT NỨT)
  // =========================================================================
  console.log('\n--- SCENARIO 7: PHÂN TRANG BẢNG KHUYẾT TẬT KHI CÓ > 5 VẾT NỨT (CHỐNG TRÀN A4) ---');
  const manyDefects = [];
  for (let i = 1; i <= 15; i++) {
    manyDefects.push({
      defectCode: `D-${String(i).padStart(2, '0')}`,
      defectType: 'Vết nứt bề mặt tường gạch',
      widthMm: 0.5 + (i * 0.1),
      lengthM: 1.0 + (i * 0.2),
      notes: `Vết nứt số ${i} trên trục kết cấu`,
    });
  }

  const heavyDefectsData = {
    project_parcel_code: 'C&C-01-B-03333',
    zone_id: 'ZONE_09',
    survey_date: '26/09/2026 (20:00)',
    surveyor_name: 'Nguyễn Trọng Tuấn',
    survey_data_json: {
      photos: {
        p01: 'data:image/svg+xml;utf8,<svg><text y="20">P01</text></svg>',
      },
      floors: [
        {
          floorId: 'FLOOR_01',
          floorName: 'Tầng Trệt',
          zones: [
            {
              zoneCode: 'Z-01',
              roomName: 'Khu vực chính',
              defects: manyDefects,
            },
          ],
        },
      ],
    },
  };

  const vmHeavy = ReportV2ViewModelMapper.buildViewModel(heavyDefectsData);
  const flHeavy = vmHeavy.appendix2[0];
  assert(flHeavy.defectSummaryRows.length === 15, 'Tầng có đúng 15 khuyết tật');
  assert(flHeavy.hasSeparateDefectTableSheets === true, 'hasSeparateDefectTableSheets = true khi > 5 khuyết tật');
  assert(flHeavy.defectSummaryPages?.length === 2, 'defectSummaryPages có đúng 2 trang (12 dòng trang 1, 3 dòng trang 2)');
  assert(flHeavy.defectSummaryPages?.[0].rows.length === 12, 'Trang bảng biểu 1 có đúng 12 dòng');
  assert(flHeavy.defectSummaryPages?.[1].rows.length === 3, 'Trang bảng biểu 2 có đúng 3 dòng');

  const htmlHeavy = compiled({ ...vmHeavy, styles: stylesSource });
  assert(htmlHeavy.includes('BẢNG THỐNG KÊ CHI TIẾT KHUYẾT TẬT TẦNG'), 'HTML chứa Sheet bảng biểu chi tiết riêng biệt');
  assert(htmlHeavy.includes('15 khuyết tật ghi nhận'), 'HTML Sheet 1 chứa khung tóm tắt chuyển trang');

  // =========================================================================
  // SCENARIO 8: TRIỆT TIÊU SỐ ĐO GIẢ MẠO ĐỘ NGHIÊNG 0.000‰ KHI KHÔNG ĐO LASER
  // =========================================================================
  console.log('\n--- SCENARIO 8: TRIỆT TIÊU SỐ ĐO GIẢ MẠO ĐỘ NGHIÊNG 0.000‰ KHI KHÔNG ĐO LASER ---');
  const visualOnlyData = {
    project_parcel_code: 'C&C-01-B-02222',
    zone_id: 'ZONE_09',
    survey_date: '26/09/2026 (21:00)',
    surveyor_name: 'Nguyễn Trọng Tuấn',
    deformation: {
      tilt_angle_x: 0,
      tilt_angle_y: 0,
      measurement_method: 'VISUAL',
    },
    survey_data_json: {
      settlementTilt: {
        method: 'VISUAL',
        buildingTilt: {
          level: 0,
          xPermille: 0,
          yPermille: 0,
        },
      },
      photos: {
        p01: 'data:image/svg+xml;utf8,<svg><text y="20">P01</text></svg>',
      },
      floors: [],
    },
  };

  const vmVisual = ReportV2ViewModelMapper.buildViewModel(visualOnlyData);
  assert(
    vmVisual.section5.buildingInclination.measured.includes('Không đo Laser'),
    'Độ nghiêng ghi nhận rõ Quan sát hiện trường (Không đo Laser), không in số giả 0.000‰'
  );
  assert(
    !vmVisual.section5.buildingInclination.measured.includes('0.000‰'),
    'Không chứa chuỗi số giả 0.000‰'
  );
  assert(
    vmVisual.section5.basisOfDetermination.vi === 'Quan sát hiện trường',
    'Cơ sở xác định là Quan sát hiện trường (không mạo danh đo Laser)'
  );

  console.log('\n🎉 TẤT CẢ 8 KỊCH BẢN THỰC ĐỊA MỞ RỘNG ĐÃ VƯỢT QUA TEST THÀNH CÔNG 100%!');
}

runEnhancedScenarioTests().catch((err) => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
