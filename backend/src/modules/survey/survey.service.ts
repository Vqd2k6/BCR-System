import { SurveyRepository } from './survey.repository';
import { Database } from '../../database/db';
import { NotFoundError, BadRequestError } from '../../common/errors/problem-details';

export class SurveyService {
  static async createPhase1Report(parcelId: string, surveyorId: string) {
    const parcelRes = await Database.query<{ project_parcel_code: string }>(
      `SELECT project_parcel_code FROM parcels WHERE id = $1;`,
      [parcelId]
    );
    if (!parcelRes.rows[0]) {
      throw new NotFoundError(`Không tìm thấy thửa đất với ID: ${parcelId}`);
    }

    const projectCode = parcelRes.rows[0].project_parcel_code;
    const reportCode = `REPORT-${projectCode}-PHASE1-${Date.now()}`;

    const report = await SurveyRepository.createBaseReport({
      parcelId,
      surveyorId,
      reportCode,
      phase: 'PHASE_1',
    });

    await Database.query(
      `INSERT INTO phase1_report_details (report_id, is_historical_baseline) VALUES ($1, TRUE);`,
      [report.id]
    );

    await Database.query(
      `UPDATE parcels SET survey_status = 'IN_PROGRESS', active_phase1_report_id = $2 WHERE id = $1;`,
      [parcelId, report.id]
    );

    return {
      reportId: report.id,
      reportCode: report.report_code,
      phase: 'PHASE_1',
      status: 'DRAFT',
      currentStep: 1,
      message: 'Khởi tạo hồ sơ khảo sát Phase 1 Baseline thành công',
    };
  }

  static async getReportDetail(reportId: string) {
    const report = await SurveyRepository.findReportById(reportId);
    if (!report) {
      throw new NotFoundError(`Không tìm thấy hồ sơ khảo sát với ID: ${reportId}`);
    }
    return report;
  }

  static async saveIdentificationPhotos(reportId: string, photos: any) {
    await SurveyRepository.saveIdentificationPhotos(reportId, photos);
    return {
      reportId,
      message: 'Đã lưu 4 ảnh định danh P01-P04, đa giác N điểm và phân tầng thành công',
      aiJobId: `ai-job-${Date.now()}`,
    };
  }

  static async saveBuildingSpecs(reportId: string, specs: any) {
    await SurveyRepository.saveBuildingSpecs(reportId, specs);
    return {
      reportId,
      message: 'Đã lưu thông số kết cấu và lịch sử công trình thành công',
    };
  }

  static async createDamageZone(reportId: string, zoneData: any) {
    const zone = await SurveyRepository.createDamageZone(reportId, zoneData);
    return {
      zoneId: zone.id,
      zoneCode: zone.zone_code,
      message: 'Đã tạo Vùng khảo sát Z-xx thành công',
    };
  }

  static async createDefectItem(zoneId: string, defectData: any) {
    const defect = await SurveyRepository.createDefectItem(zoneId, defectData);
    return {
      defectId: defect.id,
      defectCode: defect.defect_code,
      message: 'Đã ghim khuyết tật D-xx thành công kèm ảnh cận cảnh và kích thước',
    };
  }

  static async saveDeformation(reportId: string, deform: any) {
    await SurveyRepository.saveDeformation(reportId, deform);
    return {
      reportId,
      message: 'Đã lưu thông số đo đạc lún nghiêng thành công',
    };
  }

  static async submitPhase1Report(reportId: string, submitData: any) {
    await SurveyRepository.submitReport(reportId, submitData);
    return {
      reportId,
      status: 'SUBMITTED',
      message: 'Đã nộp hồ sơ Phase 1 thành công kèm chữ ký và ý kiến chủ hộ, hồ sơ chuyển sang Chờ duyệt',
    };
  }

  // --- PHASE 2 SERVICE METHODS ---

  static async createPhase2Report(data: {
    parcelId: string;
    surveyorId: string;
    phase1ReportId: string;
    workSection?: string;
    surveyLevel?: string;
    witnessMembers?: string;
  }) {
    const p1Report = await SurveyRepository.findReportById(data.phase1ReportId);
    if (!p1Report) {
      throw new NotFoundError(`Không tìm thấy hồ sơ Phase 1 Baseline: ${data.phase1ReportId}`);
    }

    const projectCode = p1Report.project_parcel_code;
    const reportCode = `REPORT-${projectCode}-PHASE2-${Date.now()}`;

    return Database.transaction(async (client) => {
      // 1. Tạo base report Phase 2
      const repRes = await client.query<{ id: string; report_code: string }>(
        `INSERT INTO base_survey_reports (parcel_id, surveyor_id, report_code, phase, status, current_step)
         VALUES ($1, $2, $3, 'PHASE_2', 'DRAFT', 1)
         RETURNING id, report_code;`,
        [data.parcelId, data.surveyorId, reportCode]
      );
      const reportId = repRes.rows[0].id;

      // 2. Ghi chi tiết Phase 2
      await client.query(
        `INSERT INTO phase2_report_details (
           report_id, phase1_report_id, work_section, survey_level, witness_members
         ) VALUES ($1, $2, $3, $4, $5);`,
        [
          reportId,
          data.phase1ReportId,
          data.workSection || null,
          data.surveyLevel || 'L2_B',
          data.witnessMembers || null,
        ]
      );

      // 3. Kế thừa thông số kết cấu từ Phase 1
      if (p1Report.buildingSpecs) {
        await client.query(
          `INSERT INTO building_specifications (
             report_id, building_name, building_grade, adjacent_buildings, structural_system,
             floor_count, basement_count, foundation_category, year_of_construction, is_year_estimated
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);`,
          [
            reportId,
            p1Report.buildingSpecs.building_name,
            p1Report.buildingSpecs.building_grade,
            p1Report.buildingSpecs.adjacent_buildings,
            p1Report.buildingSpecs.structural_system,
            p1Report.buildingSpecs.floor_count,
            p1Report.buildingSpecs.basement_count,
            p1Report.buildingSpecs.foundation_category,
            p1Report.buildingSpecs.year_of_construction,
            p1Report.buildingSpecs.is_year_estimated,
          ]
        );
      }

      await client.query(
        `UPDATE parcels SET active_phase2_report_id = $2 WHERE id = $1;`,
        [data.parcelId, reportId]
      );

      return {
        reportId,
        reportCode: repRes.rows[0].report_code,
        phase: 'PHASE_2',
        inheritedFromPhase1Id: data.phase1ReportId,
        message: 'Khởi tạo hồ sơ Phase 2 kế thừa toàn bộ Baseline Giai đoạn 1 thành công',
      };
    });
  }

  static async getPhase2ZonesByLocation(parcelId: string, floorName?: string, roomName?: string) {
    let whereClause = `WHERE r.parcel_id = $1 AND r.phase = 'PHASE_1'`;
    const params: any[] = [parcelId];

    if (floorName) {
      params.push(floorName);
      whereClause += ` AND z.floor_name = $${params.length}`;
    }
    if (roomName) {
      params.push(roomName);
      whereClause += ` AND z.room_name = $${params.length}`;
    }

    const res = await Database.query(
      `SELECT z.*,
              COALESCE(json_agg(d.*) FILTER (WHERE d.id IS NOT NULL), '[]') AS defects
       FROM damage_zones z
       JOIN base_survey_reports r ON z.report_id = r.id
       LEFT JOIN defect_items d ON z.id = d.zone_id
       ${whereClause}
       GROUP BY z.id;`,
      params
    );
    return res.rows;
  }

  static async verifyPhase2Defect(defectId: string, data: any) {
    const defRes = await Database.query<{
      width_max_mm: number;
      length_mm: number;
    }>(`SELECT width_max_mm, length_mm FROM defect_items WHERE id = $1;`, [defectId]);

    if (!defRes.rows[0]) {
      throw new NotFoundError(`Không tìm thấy khuyết tật với ID: ${defectId}`);
    }

    const p1Width = Number(defRes.rows[0].width_max_mm);
    const p1Length = Number(defRes.rows[0].length_mm);
    const p2Width = Number(data.phase2WidthMm);
    const p2Length = Number(data.phase2LengthMm);

    const deltaWidth = Math.round((p2Width - p1Width) * 100) / 100;
    const deltaLength = Math.round((p2Length - p1Length) * 100) / 100;

    let pinColor = '#4CAF50'; // Xanh lá - Ổn định
    if (data.evolutionStatus === 'WIDENED' || deltaWidth > 0 || deltaLength > 0) {
      pinColor = '#FF9800'; // Cam - Phát triển
    } else if (data.evolutionStatus === 'REPAIRED') {
      pinColor = '#9E9E9E'; // Xám - Đã sửa
    }

    await Database.query(
      `UPDATE defect_items
       SET phase1_width_mm = $2,
           phase2_width_mm = $3,
           delta_width_mm = $4,
           phase1_length_mm = $5,
           phase2_length_mm = $6,
           delta_length_mm = $7,
           evolution_status = $8,
           pin_color = $9,
           extra_photo_url = COALESCE($10, extra_photo_url)
       WHERE id = $1;`,
      [
        defectId,
        p1Width,
        p2Width,
        deltaWidth,
        p1Length,
        p2Length,
        deltaLength,
        data.evolutionStatus,
        pinColor,
        data.cuPhotoUrl || null,
      ]
    );

    return {
      defectId,
      p1WidthMm: p1Width,
      p2WidthMm: p2Width,
      deltaWidthMm: deltaWidth,
      p1LengthMm: p1Length,
      p2LengthMm: p2Length,
      deltaLengthMm: deltaLength,
      evolutionStatus: data.evolutionStatus,
      pinColor,
      message: 'Đối soát khuyết tật Phase 2 thành công và tự động tính toán biến thiên Delta',
    };
  }

  static async submitPhase2Report(reportId: string, submitData: any) {
    await Database.transaction(async (client) => {
      await client.query(
        `UPDATE base_survey_reports
         SET status = 'SUBMITTED',
             submitted_at = NOW(),
             owner_remarks = COALESCE($2, owner_remarks),
             surveyor_signature_url = COALESCE($3, surveyor_signature_url),
             owner_signature_url = COALESCE($4, owner_signature_url),
             updated_at = NOW()
         WHERE id = $1;`,
        [
          reportId,
          submitData.ownerRemarks || null,
          submitData.surveyorSignatureUrl || null,
          submitData.ownerSignatureUrl || null,
        ]
      );

      await client.query(
        `UPDATE phase2_report_details
         SET contractor_rep_signature_url = COALESCE($2, contractor_rep_signature_url),
             third_party_rep_signature_url = COALESCE($3, third_party_rep_signature_url),
             witness_signature_url = COALESCE($4, witness_signature_url),
             phase2_conclusion = COALESCE($5, phase2_conclusion),
             compensation_verdict = COALESCE($6, compensation_verdict)
         WHERE report_id = $1;`,
        [
          reportId,
          submitData.contractorRepSignatureUrl || null,
          submitData.thirdPartyRepSignatureUrl || null,
          submitData.witnessSignatureUrl || null,
          submitData.phase2Conclusion || null,
          submitData.compensationVerdict || null,
        ]
      );

      await client.query(
        `UPDATE parcels
         SET survey_status = 'SUBMITTED', updated_at = NOW()
         WHERE id = (SELECT parcel_id FROM base_survey_reports WHERE id = $1);`,
        [reportId]
      );
    });

    return {
      reportId,
      status: 'SUBMITTED',
      message: 'Đã nộp hồ sơ Phase 2 thành công kèm chữ ký 4 bên chuẩn Phiếu 02',
    };
  }
}
