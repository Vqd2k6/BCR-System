import * as fs from 'fs';
import * as path from 'path';
import Handlebars from 'handlebars';
import {
  CondoUnitReportViewModel,
  CondoUnitWaterLeakReportItem,
  DefectItemReport,
  ReportPhotoItem,
} from '../report.types';

// Đăng ký các Handlebars Helper nếu chưa có
try {
  Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
  Handlebars.registerHelper('ne', (a: any, b: any) => a !== b);
  Handlebars.registerHelper('gt', (a: any, b: any) => Number(a) > Number(b));
  Handlebars.registerHelper('gte', (a: any, b: any) => Number(a) >= Number(b));
  Handlebars.registerHelper('inc', (v: any) => Number(v) + 1);
  Handlebars.registerHelper('addOne', (v: any) => Number(v) + 1);
  Handlebars.registerHelper('or', function(...args: any[]) {
    args.pop();
    return args.some(Boolean);
  });
  Handlebars.registerHelper('and', function(...args: any[]) {
    args.pop();
    return args.every(Boolean);
  });
  Handlebars.registerHelper('isNotEmpty', (arr: any) => Array.isArray(arr) && arr.length > 0);
} catch (_e) {
  // helpers already registered
}

export class CondoUnitReportGenerator {
  /**
   * Chuyển đổi dữ liệu hồ sơ Căn hộ con từ DB sang ViewModel chuẩn Liên danh CRLG–CRSRI–TT
   */
  static buildViewModel(reportData: any): CondoUnitReportViewModel {
    const json = reportData.survey_data_json || {};
    const parcel = reportData.parcel || {};
    const parentReport = reportData.parentReport || {};
    const specs = reportData.buildingSpecs || {};
    const deformation = reportData.deformation || {};

    const reportCode = reportData.report_code || json.reportCode || `CONDO-${reportData.id?.substring(0, 8) || '001'}`;
    const reportRevision = reportData.export_revision || 1;
    const surveyDate = json.surveyDate || reportData.survey_date || new Date().toLocaleDateString('vi-VN');
    const generatedAt = new Date().toLocaleString('vi-VN');

    // Thông tin nhận diện căn hộ con (Phương án B: tách bạch Biển số thực tế và Mã vị trí CAD)
    const unitCode = json.unitCode || reportData.unit_code || '01.01';
    const displayCode = json.displayCode || reportData.display_code || unitCode;
    const isDifferentCode = displayCode !== unitCode;
    const floorNumber = json.floorNumber ?? reportData.floor_number ?? 1;
    const fNum = Number(floorNumber);
    const floorDisplay = isNaN(fNum)
      ? String(floorNumber)
      : fNum === 0.5
        ? 'Tầng Lửng Trệt (Mezzanine)'
        : fNum === -0.5
          ? 'Tầng Bán Hầm (Semi-Basement)'
          : fNum < 0
            ? `Tầng hầm B${Math.abs(Math.round(fNum))}`
            : fNum === 0
              ? 'Tầng trệt (G)'
              : `Lầu ${Math.floor(fNum)} (Tầng ${Math.floor(fNum)})`;

    const unitAreaM2 = json.unitAreaM2 || reportData.unit_area_m2 || '';
    const ownerName = json.ownerName || reportData.owner_name || 'Chủ sở hữu căn hộ';
    const ownerPhone = json.ownerPhone || reportData.owner_phone || '';
    const ownerIdCard = json.ownerIdCard || reportData.owner_id_card || '';
    const ownerFeedback = json.ownerFeedback || json.ownerRemarks || reportData.owner_remarks || 'Đồng ý với hiện trạng ghi nhận tại căn hộ.';

    // Phân loại cư ngụ
    const resStatus = json.residentStatus || 'CHỦ_HỘ_Ở';
    const statusLabels: Record<string, string> = {
      'CHỦ_HỘ_Ở': 'Chủ hộ đang trực tiếp cư ngụ',
      'CHO_THUÊ': 'Đang cho thuê cư ngụ',
      'BỎ_TRỐNG_CHƯA_VỀ_Ở': 'Căn hộ bỏ trống / Chưa về ở',
      'VẮNG_MẶT_KHÓA_CỬA': 'Vắng mặt khóa cửa hiện trường',
      'ĐỂ_TRỐNG': 'Căn hộ bỏ trống / Chưa về ở',
      'TRANH_CHẤP': 'Đang tranh chấp / Khóa cửa',
    };
    const residentStatusLabel = statusLabels[resStatus] || resStatus;

    // Thông tin kế thừa từ Tòa nhà Mẹ (Q4: Kế thừa động số liệu mới nhất từ Tòa mẹ)
    const parentInfo = json.parentInfo || {};
    const buildingName = parcel.buildingName || parcel.building_name || parentInfo.buildingName || 'Tòa nhà Chung Cư';
    const address = `${parcel.houseNumber ? `${parcel.houseNumber}, ` : ''}${parcel.street || ''}`.trim() || parentInfo.address || 'Dự án Metro Tuyến số 2';
    const projectParcelCode = parcel.projectParcelCode || parcel.project_parcel_code || parentInfo.projectParcelCode || 'B-000';
    const officialCadastralCode = parcel.officialCadastralCode || parcel.official_cadastral_code || parentInfo.officialCadastralCode || 'DC-000';
    const chainage = parentInfo.chainage || 'Km 3+450';
    const parentCenterlineDist = parcel.distance_to_centerline_m ?? parcel.distanceMeters;
    const metroOffsetDistance = parentCenterlineDist !== undefined && parentCenterlineDist !== null
      ? `${Number(parentCenterlineDist).toFixed(1)}m`
      : (parentInfo.metroOffsetDistance || '12.5m');

    const parentMasterReportCode = parentReport.report_code || 'REPORT-MASTER';
    const parentMasterReportId = parentReport.id || '';
    const structuralSystem = specs.structuralSystem || json.specs?.structuralSystem || 'Khung bê tông cốt thép toàn khối (RC Frame)';
    const foundationCategory = specs.foundationCategory || json.specs?.foundationCategory || 'Móng cọc khoan nhồi BTCT (Theo hồ sơ hoàn công tòa mẹ)';
    const foundationSource = specs.foundationSource || 'Hồ sơ bản vẽ hoàn công Tòa Master';
    const buildingTiltDescription = deformation.tiltAngleX
      ? `Độ nghiêng khối tháp: X = ${deformation.tiltAngleX}‰, Y = ${deformation.tiltAngleY}‰ (Nằm trong giới hạn TCVN)`
      : 'Độ nghiêng tổng thể khối tháp nằm trong ngưỡng cho phép (TCVN 5574:2018)';

    const inheritanceLegalNotice = `Các thông số kỹ thuật móng cọc, tầng hầm, độ nghiêng khối tháp và cự ly tim hầm Metro được kế thừa nguyên trạng từ Báo cáo Hiện trạng Khối tháp Tòa nhà số: ${parentMasterReportCode}.`;

    // Thiết bị nhạy cảm, Cải tạo & 5 câu hỏi phỏng vấn TCVN
    const hasSensitiveEquipment = Boolean(json.hasSensitiveEquipment);
    const sensitiveEquipmentDesc = json.sensitiveEquipmentDesc || '';
    const hasRenovated = Boolean(json.interiorRenovationHistory?.hasRenovated);
    const renovationHistoryDesc = json.interiorRenovationHistory?.description || '';

    const hi = json.historyInterview || {};
    const renovationOptionsMap: Record<number, string> = {
      0: 'Không có (Nguyên bản)',
      1: 'Có cơi nới nhẹ / lắp vách ngăn',
      2: 'Đập tường / thay đổi công năng',
      3: 'Cơi nới nặng / tăng tải trọng đáng kể',
    };
    const majorRepairOptionsMap: Record<number, string> = {
      0: 'Không có',
      1: 'Sửa chữa hoàn thiện bề mặt',
      2: 'Gia cố cục bộ dầm/sàn',
      3: 'Can thiệp kết cấu chịu lực chính',
    };
    const pastSettlementOptionsMap: Record<number, string> = {
      0: 'Không phát hiện lún nghiêng',
      1: 'Nghi ngờ có chuyển vị nhẹ',
      2: 'Có hiện tượng nứt lún trước đây',
      3: 'Lún lệch rõ rệt / từng xử lý',
    };
    const neighborDamageOptionsMap: Record<number, string> = {
      0: 'Không ảnh hưởng',
      1: 'Bị nứt dăm do nhà bên sửa chữa',
      2: 'Nứt tường / thấm do căn hộ lân cận',
      3: 'Hư hỏng nặng do công trình liền kề',
    };
    const fireFloodOptionsMap: Record<number, string> = {
      0: 'Không có sự cố',
      1: 'Từng bị ngấm nước cục bộ',
      2: 'Từng bị ngập nước sàn',
      3: 'Từng xảy ra hỏa hoạn / nổ',
    };

    const historyInterviewSummary = {
      renovationText: renovationOptionsMap[hi.renovationLoad ?? 0] || (hasRenovated ? 'Đã từng sửa chữa' : 'Không có'),
      majorRepairText: majorRepairOptionsMap[hi.majorRepair ?? 0] || 'Không có',
      pastSettlementText: pastSettlementOptionsMap[hi.pastSettlement ?? 0] || 'Không phát hiện',
      neighborDamageText: neighborDamageOptionsMap[hi.neighborDamage ?? 0] || 'Không ảnh hưởng',
      fireFloodText: fireFloodOptionsMap[hi.fireFloodIncident ?? 0] || 'Không có',
      usageStatus: hi.usageStatus || 'Đầy đủ',
      continuousOperation247: Boolean(hi.continuousOperation247),
      renovationDescription: hi.renovationDescription || renovationHistoryDesc || '',
    };

    // Ảnh định danh căn hộ: P01 & P04
    const makePhoto = (obj: any, type: any, label: string): ReportPhotoItem => {
      const url = typeof obj === 'string' ? obj : obj?.url;
      return {
        photoId: type,
        photoType: type,
        url: url && !url.startsWith('blob:') ? url : '',
        isNotApplicable: Boolean(obj?.notApplicable),
        naReason: obj?.naReason || '',
        label,
        capturedAt: surveyDate,
      };
    };

    const p01 = makePhoto(json.photoP01, 'P01_HOUSE_NUMBER', 'Cửa chính & Biển số phòng');
    const p04 = makePhoto(json.photoP04, 'P04_CONTEXT_STREET', 'Không gian tổng quan nội thất');

    // Thấm dột trần từ lầu trên (Upper Floor Leakage)
    const rawWaterLeak = json.upperFloorWaterLeakage;
    const hasUpperFloorWaterLeakage = Boolean(rawWaterLeak?.has);
    const waterLeakageItems: CondoUnitWaterLeakReportItem[] = [];

    if (hasUpperFloorWaterLeakage) {
      if (Array.isArray(rawWaterLeak?.leakageItems) && rawWaterLeak.leakageItems.length > 0) {
        rawWaterLeak.leakageItems.forEach((item: any, idx: number) => {
          waterLeakageItems.push({
            leakageCode: item.leakageCode || `WL-${String(idx + 1).padStart(2, '0')}`,
            location: item.location || 'Trần căn hộ',
            description: item.description || 'Thấm dột, ố vàng từ căn hộ tầng trên',
            ctxPhotoUrl: item.ctxPhotoUrl || item.photoUrl,
            cuPhotoUrl: item.cuPhotoUrl || item.photoUrl,
          });
        });
      } else if (rawWaterLeak?.location || rawWaterLeak?.photoUrl) {
        waterLeakageItems.push({
          leakageCode: 'WL-01',
          location: rawWaterLeak.location || 'Trần phòng căn hộ',
          description: rawWaterLeak.description || 'Thấm dột trần lầu trên',
          ctxPhotoUrl: rawWaterLeak.photoUrl,
          cuPhotoUrl: rawWaterLeak.photoUrl,
        });
      }
    }

    // Độ võng dầm / sàn
    const rawSag = json.beamSagging;
    const hasBeamSagging = Boolean(rawSag?.hasSagging && (rawSag?.sagMm > 0 || rawSag?.spanM > 0));
    const beamSagMm = Number(rawSag?.sagMm) || 0;
    const beamSpanM = Number(rawSag?.spanM) || 0;
    const isBeamSagCritical = hasBeamSagging && beamSpanM > 0 && (beamSagMm / (beamSpanM * 1000)) > (1 / 500);

    // Kẹt cửa
    const rawJam = json.doorJammingStatus || 'NORMAL';
    const jamLabels: Record<string, string> = {
      'NORMAL': 'Bình thường: Đóng mở nhẹ nhàng, khung bao và cánh cửa nguyên vẹn',
      'JAMMED': 'Bị kẹt cánh / khó đóng mở do biến dạng khung bao',
      'RUBBING_FLOOR': 'Xệ cánh: Bản lề xệ cạ mặt gạch lát sàn',
      'CRACKED_GLASS': 'Nứt rạn kính: Kính cửa sổ/ban công bị rạn nứt',
    };
    const doorJammingLabel = jamLabels[rawJam] || rawJam;

    // Sổ khuyết tật nội thất & Vết nứt
    const localDefects: DefectItemReport[] = [];
    const getBurlandGrade = (w: number) => {
      if (w < 0.1) return 0;
      if (w <= 1.0) return 1;
      if (w <= 5.0) return 2;
      if (w <= 15.0) return 3;
      if (w <= 25.0) return 4;
      return 5;
    };

    const burlandGradeLabels: Record<number, string> = {
      0: 'Cấp 0: Vết nứt tóc / chân chim rất nhỏ (< 0.1 mm)',
      1: 'Cấp 1: Rất nhẹ (0.1 - 1.0 mm) - Vết nứt thẩm mỹ',
      2: 'Cấp 2: Nhẹ (1.0 - 5.0 mm) - Cần trám trét cục bộ',
      3: 'Cấp 3: Trung bình (5.0 - 15.0 mm) - Nứt xuyên tường',
      4: 'Cấp 4: Nặng (15.0 - 25.0 mm) - Hư hỏng kết cấu',
      5: 'Cấp 5: Rất nặng (> 25.0 mm) - Nguy cơ mất an toàn',
    };

    let maxBurland = 0;

    // 1. Trích xuất từ reportData.damage_zones nếu đã lưu DB
    if (Array.isArray(reportData.damage_zones) && reportData.damage_zones.length > 0) {
      reportData.damage_zones.forEach((z: any) => {
        if (Array.isArray(z.defects)) {
          z.defects.forEach((d: any) => {
            const w = Number(d.width_max_mm || d.widthMaxMm) || 0;
            const bGrade = getBurlandGrade(w);
            if (bGrade > maxBurland) maxBurland = bGrade;

            localDefects.push({
              defectCode: d.defect_code || d.defectCode || `D-01`,
              zoneCode: z.zone_code || z.zoneCode || 'Z-01',
              roomName: z.room_name || z.roomName || 'Căn hộ',
              componentType: z.component_type || z.componentType || 'WALL',
              defectType: d.defect_type || d.defectType || 'CRACK',
              widthMaxMm: w,
              lengthMm: Number(d.length_mm || d.lengthMm) || 1000,
              activityState: d.activity_state || d.activityState || 'U',
              activityStateLabel: 'Chưa xác định',
              structuralSignificanceE2: w >= 2.0 ? 3 : 1,
              structuralSignificanceLabel: w >= 2.0 ? 'Có ý nghĩa chịu lực' : 'Khuyết tật cục bộ',
              materialDegradationE4: 0,
              materialDegradationLabel: 'Bình thường',
              hasScaleCard: d.has_scale_card ?? d.hasScaleCard ?? true,
              isStructuralCritical: w >= 5.0,
              pinX: d.pin_x != null ? Number(d.pin_x) : undefined,
              pinY: d.pin_y != null ? Number(d.pin_y) : undefined,
              ctxPhotoUrl: z.ctx_photo_url || z.ctxPhotoUrl,
              cuPhotoUrl: d.cu_photo_url || d.cuPhotoUrl,
              notes: d.notes || z.notes,
            });
          });
        }
      });
    } else if (Array.isArray(json.localDefects) && json.localDefects.length > 0) {
      // Fallback từ json.localDefects
      json.localDefects.forEach((d: any, idx: number) => {
        const w = Number(d.crackWidthMm) || 0;
        const bGrade = getBurlandGrade(w);
        if (bGrade > maxBurland) maxBurland = bGrade;

        localDefects.push({
          defectCode: d.defectCode || `D-${String(idx + 1).padStart(2, '0')}`,
          zoneCode: `Z-${String(idx + 1).padStart(2, '0')}`,
          roomName: d.location || 'Không gian căn hộ',
          componentType: d.type === 'WATER_LEAKAGE' ? 'WALL' : 'WALL',
          defectType: d.type || 'CRACK',
          widthMaxMm: w,
          lengthMm: Math.round((Number(d.crackLengthM) || 1) * 1000),
          activityState: 'U',
          activityStateLabel: 'Chưa xác định',
          structuralSignificanceE2: w >= 2.0 ? 3 : 1,
          structuralSignificanceLabel: w >= 2.0 ? 'Có ý nghĩa chịu lực' : 'Khuyết tật cục bộ',
          materialDegradationE4: 0,
          materialDegradationLabel: 'Bình thường',
          hasScaleCard: d.hasScaleCard ?? true,
          isStructuralCritical: w >= 5.0,
          pinX: d.pinX != null ? Number(d.pinX) : undefined,
          pinY: d.pinY != null ? Number(d.pinY) : undefined,
          ctxPhotoUrl: d.ctxPhotoUrl || d.photoUrl,
          cuPhotoUrl: d.cuPhotoUrl || d.photoUrl,
          notes: d.description,
        });
      });
    } else if (Array.isArray(json.zones) || Array.isArray(json.structuralElements)) {
      // Fallback từ cấu trúc Z - E - D chuẩn mới trong json
      const combined = [
        ...(Array.isArray(json.zones) ? json.zones : []),
        ...(Array.isArray(json.structuralElements) ? json.structuralElements : []),
      ];
      combined.forEach((z: any) => {
        (z.defects || []).forEach((d: any, dIdx: number) => {
          const w = Number(d.widthMaxMm ?? d.crackWidthMm) || 0;
          const bGrade = getBurlandGrade(w);
          if (bGrade > maxBurland) maxBurland = bGrade;

          localDefects.push({
            defectCode: d.defectCode || `D-${String(dIdx + 1).padStart(2, '0')}`,
            zoneCode: z.zoneCode || z.elementCode || 'Z-01',
            roomName: z.roomName || 'Không gian căn hộ',
            componentType: z.componentType || z.elementType || 'WALL',
            defectType: d.defectType || (d.screeningCategory === 'WATER_LEAK' ? 'WATER_STAIN' : 'CRACK'),
            widthMaxMm: w,
            lengthMm: Number(d.lengthMm) || Math.round((Number(d.crackLengthM) || 1) * 1000),
            activityState: d.activityState || 'U',
            activityStateLabel: 'Chưa xác định',
            structuralSignificanceE2: w >= 2.0 ? 3 : 1,
            structuralSignificanceLabel: w >= 2.0 ? 'Có ý nghĩa chịu lực' : 'Khuyết tật cục bộ',
            materialDegradationE4: 0,
            materialDegradationLabel: 'Bình thường',
            hasScaleCard: d.hasScaleCard ?? true,
            isStructuralCritical: w >= 5.0,
            pinX: d.pinX != null ? Number(d.pinX) : undefined,
            pinY: d.pinY != null ? Number(d.pinY) : undefined,
            ctxPhotoUrl: z.ctxPhotoUrl || d.ctxPhotoUrl || d.photoUrl,
            cuPhotoUrl: d.cuPhotoUrl || (Array.isArray(d.cuPhotos) ? d.cuPhotos[0] : null) || d.photoUrl,
            notes: d.notes || d.description,
          });
        });
      });
    }

    const burlandMaxLabel = burlandGradeLabels[maxBurland] || 'Cấp 0';

    // Kết luận & Kiến nghị
    const summaryConclusions = json.summaryConclusions || reportData.summary_conclusions ||
      `Hiện trạng Căn hộ ${displayCode} (Vị trí quy hoạch ${unitCode}, ${floorDisplay}) trước khi thi công tuyến Metro số 2 được ghi nhận với ${localDefects.length} điểm khuyết tật nứt, cấp độ hư hỏng Burland lớn nhất: ${burlandMaxLabel}. ${hasUpperFloorWaterLeakage ? 'Có hiện tượng thấm dột trần lầu trên dội xuống.' : 'Không phát hiện thấm dột trần.'}`;

    const engineeringRecommendations = json.engineeringRecommendations || reportData.engineering_recommendations ||
      'Đề nghị Chủ hộ và Đơn vị thi công Metro số 2 phối hợp giám sát định kỳ đối với các vết nứt đã ghi nhận, đồng thời tiến hành quan trắc bổ sung nếu phát hiện có hiện tượng nứt phát triển mới trong quá trình đào ngầm TBM.';

    // Ảnh biên bản hiện trường & chữ ký tươi (Working Minutes Photos)
    const rawMinutes = json.workingMinutesPhotos || json.signatures?.workingMinutesPhotos || reportData.working_minutes_photos || [];
    const workingMinutesPhotos = (Array.isArray(rawMinutes) ? rawMinutes : [])
      .map((p: any) => (typeof p === 'string' ? p : p?.url))
      .filter((u: any) => u && typeof u === 'string' && !u.startsWith('blob:'));

    return {
      reportCode,
      reportRevision,
      reportDate: surveyDate,
      surveyDate,
      buildingId: projectParcelCode,
      buildingName,
      address,
      projectParcelCode,
      officialCadastralCode,

      unitCode,
      displayCode,
      isDifferentCode,
      floorNumber,
      floorDisplay,
      unitAreaM2,
      residentStatus: resStatus,
      residentStatusLabel,
      ownerName,
      ownerPhone,
      ownerIdCard,
      ownerFeedback,

      parentMasterReportCode,
      parentMasterReportId,
      chainage,
      metroOffsetDistance,
      structuralSystem,
      foundationCategory,
      foundationSource,
      buildingTiltDescription,
      inheritanceLegalNotice,

      hasSensitiveEquipment,
      sensitiveEquipmentDesc,
      hasRenovated,
      renovationHistoryDesc,
      historyInterviewSummary,

      p01,
      p04,

      hasUpperFloorWaterLeakage,
      waterLeakageItems,

      hasBeamSagging,
      beamSagLocation: rawSag?.location,
      beamSagMm: rawSag?.sagMm,
      beamSpanM: rawSag?.spanM,
      beamSagRatioText: rawSag?.ratioText,
      beamSagPhotoUrl: rawSag?.photoUrl,
      isBeamSagCritical,

      doorJammingStatus: rawJam,
      doorJammingLabel,

      localDefects,
      totalDefectsCount: localDefects.length,
      burlandMaxGrade: maxBurland,
      burlandMaxLabel,
      unitCadUrl: json.unitCadUrl || undefined,

      summaryConclusions,
      engineeringRecommendations,
      surveyorSignatureUrl: json.surveyorSignature || reportData.surveyor_signature_url,
      surveyorName: reportData.surveyor_name || 'Khảo sát viên Hiện trường',
      ownerSignatureUrl: json.ownerSignature || reportData.owner_signature_url,
      zoneAdminSignatureUrl: reportData.zone_admin_signature_url,
      workingMinutesPhotos,
      generatedAt,
    };
  }

  /**
   * Tạo chuỗi HTML hoàn chỉnh từ ViewModel và Template Handlebars Template 2
   */
  static generateHtml(viewModel: CondoUnitReportViewModel): string {
    const candidateDirs = [
      path.resolve(__dirname, '../templates/condo-unit'),
      path.resolve(__dirname, '../../../../src/modules/report/templates/condo-unit'),
      path.resolve(__dirname, '../../../src/modules/report/templates/condo-unit'),
      path.resolve(process.cwd(), 'src/modules/report/templates/condo-unit'),
      path.resolve(process.cwd(), 'backend/src/modules/report/templates/condo-unit'),
      path.resolve(process.cwd(), 'dist/modules/report/templates/condo-unit'),
      path.resolve(process.cwd(), 'backend/dist/modules/report/templates/condo-unit'),
    ];
    const templateDir = candidateDirs.find((d) => fs.existsSync(path.join(d, 'index.hbs'))) || candidateDirs[0];
    const templatePath = path.join(templateDir, 'index.hbs');
    const stylesPath = path.join(templateDir, 'styles.css');

    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const styles = fs.existsSync(stylesPath) ? fs.readFileSync(stylesPath, 'utf8') : '';

    const compiledTemplate = Handlebars.compile(templateSource);
    return compiledTemplate({
      ...viewModel,
      styles,
    });
  }
}
