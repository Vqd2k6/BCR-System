import { Database } from '../../../database/db';
import { SurveyBaseRepository } from './survey-base.repository';

export class SurveyDraftRepository {
  static async findActiveDraft(
    parcelId: string,
    unitId?: string | null,
    phase: string = 'PHASE_1'
  ): Promise<any | null> {
    const resolvedId = await SurveyBaseRepository.resolveParcelId(parcelId);
    if (!resolvedId) return null;

    let query = `
      SELECT r.*,
             u.full_name AS surveyor_name,
             u.phone AS surveyor_phone,
             u.surveyor_code,
             le.full_name AS last_editor_name,
             p.project_parcel_code,
             p.official_cadastral_code,
             p.house_number,
             p.street
      FROM base_survey_reports r
      LEFT JOIN users u ON r.surveyor_id = u.id
      LEFT JOIN users le ON r.last_edited_by_id = le.id
      JOIN parcels p ON r.parcel_id = p.id
      WHERE r.parcel_id = $1 AND r.phase = $2 AND (r.status = 'DRAFT' OR r.status = 'REJECTED')
    `;
    const params: any[] = [resolvedId, phase];

    if (unitId) {
      params.push(unitId);
      query += ` AND r.unit_id = $${params.length}`;
    } else {
      query += ` AND r.unit_id IS NULL`;
    }

    query += ` ORDER BY r.updated_at DESC LIMIT 1;`;

    const res = await Database.query(query, params);
    return res.rows[0] || null;
  }

  static async upsertDraft(data: {
    parcelId: string;
    surveyorId: string;
    unitId?: string | null;
    reportType?: string;
    currentStep: number;
    surveyData: any;
    syncVersion?: number;
  }): Promise<any> {
    const resolvedParcelId = await SurveyBaseRepository.resolveParcelId(data.parcelId);
    if (!resolvedParcelId) {
      throw new Error(`Thửa đất không tồn tại: ${data.parcelId}`);
    }

    // Kiểm tra draft hiện tại
    const existing = await this.findActiveDraft(resolvedParcelId, data.unitId);

    if (existing) {
      const updateRes = await Database.query(
        `UPDATE base_survey_reports
         SET survey_data_json = $2,
             current_step = $3,
             sync_version = sync_version + 1,
             last_edited_by_id = $4,
             is_ready_for_handover = FALSE,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *;`,
        [
          existing.id,
          typeof data.surveyData === 'string' ? data.surveyData : JSON.stringify(data.surveyData),
          data.currentStep,
          data.surveyorId,
        ]
      );

      // Đảm bảo status của parcel là IN_PROGRESS nếu chưa nộp
      await Database.query(
        `UPDATE parcels 
         SET survey_status = CASE 
               WHEN survey_status IN ('SUBMITTED', 'APPROVED', 'PHASE2_COMPLETED', 'APPROVED_PHASE2') THEN survey_status 
               ELSE 'IN_PROGRESS' 
             END, 
             active_phase1_report_id = COALESCE(active_phase1_report_id, $2),
             updated_at = NOW() 
         WHERE id = $1;`,
        [resolvedParcelId, existing.id]
      );

      if (data.unitId) {
        await Database.query(
          `UPDATE building_units 
           SET status = CASE 
                 WHEN status IN ('SUBMITTED', 'APPROVED', 'COMPLETED') THEN status 
                 ELSE 'IN_PROGRESS' 
               END, 
               phase1_report_id = COALESCE(phase1_report_id, $2),
               updated_at = NOW() 
           WHERE id = $1;`,
          [data.unitId, existing.id]
        );
      }

      return updateRes.rows[0];
    } else {
      // Khởi tạo mã ngẫu nhiên 6 số phục vụ bàn giao ca
      const securityCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Lấy project code
      const pRes = await Database.query<{ project_parcel_code: string }>(
        `SELECT project_parcel_code FROM parcels WHERE id = $1;`,
        [resolvedParcelId]
      );
      const pCode = pRes.rows[0]?.project_parcel_code || 'B-XXXXX';
      const reportCode = `REPORT-${pCode}-DRAFT-${Date.now()}`;

      const insertRes = await Database.query(
        `INSERT INTO base_survey_reports (
           parcel_id, surveyor_id, last_edited_by_id, report_code, phase, status,
           current_step, survey_data_json, handover_security_code, report_type, unit_id, sync_version
         )
         VALUES ($1, $2, $2, $3, 'PHASE_1', 'DRAFT', $4, $5, $6, $7, $8, 1)
         RETURNING *;`,
        [
          resolvedParcelId,
          data.surveyorId,
          reportCode,
          data.currentStep,
          typeof data.surveyData === 'string' ? data.surveyData : JSON.stringify(data.surveyData),
          securityCode,
          data.reportType || (data.unitId ? 'UNIT_CHILD' : 'STANDALONE'),
          data.unitId || null,
        ]
      );
      const newDraft = insertRes.rows[0];

      // Đảm bảo có record trong phase1_report_details
      await Database.query(
        `INSERT INTO phase1_report_details (report_id, is_historical_baseline)
         VALUES ($1, TRUE)
         ON CONFLICT (report_id) DO NOTHING;`,
        [newDraft.id]
      );

      await Database.query(
        `UPDATE parcels 
         SET survey_status = CASE 
               WHEN survey_status IN ('SUBMITTED', 'APPROVED', 'PHASE2_COMPLETED', 'APPROVED_PHASE2') THEN survey_status 
               ELSE 'IN_PROGRESS' 
             END, 
             active_phase1_report_id = $2, 
             updated_at = NOW() 
         WHERE id = $1;`,
        [resolvedParcelId, newDraft.id]
      );

      if (data.unitId) {
        await Database.query(
          `UPDATE building_units 
           SET status = 'IN_PROGRESS', phase1_report_id = $2, updated_at = NOW() 
           WHERE id = $1;`,
          [data.unitId, newDraft.id]
        );
      }

      return newDraft;
    }
  }

  static async releaseDraftLock(parcelId: string, unitId: string | null, surveyorId: string): Promise<any> {
    const existing = await this.findActiveDraft(parcelId, unitId);
    if (!existing) return null;

    const res = await Database.query(
      `UPDATE base_survey_reports
       SET is_ready_for_handover = TRUE,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *;`,
      [existing.id]
    );
    return res.rows[0];
  }

  static async takeoverDraft(
    parcelId: string,
    unitId: string | null,
    newSurveyorId: string,
    note?: string
  ): Promise<any> {
    const existing = await this.findActiveDraft(parcelId, unitId);
    if (!existing) {
      throw new Error('Không tìm thấy bản nháp đang khảo sát để tiếp quản');
    }

    const newSecurityCode = Math.floor(100000 + Math.random() * 900000).toString();
    const handoverEntry = {
      fromSurveyorId: existing.surveyor_id,
      fromSurveyorName: existing.surveyor_name,
      toSurveyorId: newSurveyorId,
      step: existing.current_step,
      handoverAt: new Date().toISOString(),
      note: note || 'Tiếp quản ca làm việc',
    };

    const res = await Database.query(
      `UPDATE base_survey_reports
       SET surveyor_id = $2,
           last_edited_by_id = $2,
           is_ready_for_handover = FALSE,
           handover_security_code = $3,
           handover_history = COALESCE(handover_history, '[]'::jsonb) || $4::jsonb,
           sync_version = sync_version + 1,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *;`,
      [
        existing.id,
        newSurveyorId,
        newSecurityCode,
        JSON.stringify([handoverEntry]),
      ]
    );

    return res.rows[0];
  }
}
