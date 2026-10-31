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
      query += ` AND (
        NOT EXISTS (
          SELECT 1 FROM building_units bu 
          WHERE bu.id = r.unit_id AND bu.status::text IN ('SUBMITTED', 'APPROVED', 'PHASE2_COMPLETED', 'APPROVED_PHASE2')
        )
        OR r.updated_at > COALESCE(
          (SELECT MAX(submitted_at) FROM base_survey_reports b WHERE b.unit_id = r.unit_id AND b.status IN ('SUBMITTED', 'APPROVED')),
          '1970-01-01'::timestamptz
        )
      )`;
    } else {
      query += ` AND r.unit_id IS NULL`;
      if (phase === 'PHASE_1') {
        query += ` AND (
          p.survey_status::text NOT IN ('SUBMITTED', 'APPROVED', 'PHASE2_COMPLETED', 'APPROVED_PHASE2')
          OR r.updated_at > COALESCE(
            (SELECT MAX(submitted_at) FROM base_survey_reports b WHERE b.parcel_id = r.parcel_id AND b.unit_id IS NULL AND b.status IN ('SUBMITTED', 'APPROVED')),
            '1970-01-01'::timestamptz
          )
        )`;
      }
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
      // 1. Phân tích surveyData mới và cũ
      let incomingData: any = typeof data.surveyData === 'string'
        ? JSON.parse(data.surveyData)
        : (data.surveyData || {});

      const existingData: any = typeof existing.survey_data_json === 'string'
        ? JSON.parse(existing.survey_data_json)
        : (existing.survey_data_json || {});

      // 2. Bảo toàn và hợp nhất _photoMappings từ bản ghi trước (KHÔNG BAO GIỜ để mất ánh xạ R2 đã lưu)
      const existingMappings = existingData._photoMappings || {};
      const incomingMappings = incomingData._photoMappings || {};
      const mergedMappings: Record<string, string> = {
        ...existingMappings,
        ...incomingMappings,
      };

      // 3. Tự động thay thế toàn bộ blob:local:// bằng Cloud URL đã biết trong mergedMappings
      if (Object.keys(mergedMappings).length > 0) {
        const replaceLocalUris = (target: unknown): unknown => {
          if (target === null || target === undefined) return target;
          if (typeof target === 'string') {
            if (target.startsWith('blob:local://')) {
              const rawId = target.replace('blob:local://', '').split('?')[0];
              if (mergedMappings[rawId]) return mergedMappings[rawId];
              if (mergedMappings[target]) return mergedMappings[target];
            }
            return target;
          }
          if (Array.isArray(target)) {
            return target.map(replaceLocalUris);
          }
          if (typeof target === 'object') {
            const obj = target as Record<string, unknown>;
            const updated: Record<string, unknown> = {};
            for (const k of Object.keys(obj)) {
              if (k === '_photoMappings') continue;
              updated[k] = replaceLocalUris(obj[k]);
            }
            return updated;
          }
          return target;
        };

        incomingData = replaceLocalUris(incomingData);
      }

      // Đảm bảo mergedMappings luôn nằm trong surveyData
      incomingData._photoMappings = mergedMappings;

      // Bảo vệ tên chủ hộ thật: Không bao giờ cho phép chuỗi giả định ('Chủ hộ thửa ...', 'Chưa cập nhật') hoặc rỗng ghi đè lên tên thật đã lưu trong bản nháp trước đó
      const isPlaceholderOwner = (val: unknown): boolean =>
        typeof val === 'string' && /^(chủ\s+hộ\s+thửa|chưa\s+cập\s+nhật|chủ\s+sở\s+hữu\s+thửa)/i.test(val.trim());
      const existingOwner = typeof existingData?.ownerName === 'string' ? existingData.ownerName.trim() : '';
      const incomingOwner = typeof incomingData?.ownerName === 'string' ? incomingData.ownerName.trim() : '';
      if (existingOwner && !isPlaceholderOwner(existingOwner) && (!incomingOwner || isPlaceholderOwner(incomingOwner))) {
        incomingData.ownerName = existingOwner;
      }

      const cleanDraftOwnerName =
        typeof incomingData?.ownerName === 'string' && incomingData.ownerName.trim() && !isPlaceholderOwner(incomingData.ownerName)
          ? incomingData.ownerName.trim()
          : null;
      const cleanDraftOwnerPhone =
        typeof incomingData?.ownerPhone === 'string' && incomingData.ownerPhone.trim()
          ? incomingData.ownerPhone.trim()
          : null;
      const cleanDraftHouseNumber =
        typeof incomingData?.houseNumber === 'string' && incomingData.houseNumber.trim()
          ? incomingData.houseNumber.trim()
          : null;
      const cleanDraftStreet =
        typeof incomingData?.street === 'string' && incomingData.street.trim()
          ? incomingData.street.trim()
          : null;
      const cleanDraftDisplayCode =
        typeof incomingData?.displayCode === 'string' && incomingData.displayCode.trim()
          ? incomingData.displayCode.trim()
          : null;

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
          JSON.stringify(incomingData),
          data.currentStep,
          data.surveyorId,
        ]
      );

      // Chỉ cập nhật trạng thái tòa mẹ, active_phase1_report_id và đồng bộ thông tin chủ hộ/địa chỉ lên GIS khi đây là báo cáo tòa mẹ / độc lập (!data.unitId)
      if (!data.unitId) {
        await Database.query(
          `UPDATE parcels 
           SET survey_status = CASE 
                 WHEN survey_status::text IN ('SUBMITTED', 'APPROVED', 'PHASE2_COMPLETED', 'APPROVED_PHASE2') THEN survey_status 
                 ELSE 'IN_PROGRESS' 
               END, 
               active_phase1_report_id = CASE 
                 WHEN active_phase1_report_id IS NOT NULL 
                   AND EXISTS (SELECT 1 FROM base_survey_reports WHERE id = parcels.active_phase1_report_id) 
                 THEN active_phase1_report_id 
                 ELSE $2 
               END,
               owner_name = COALESCE($3, owner_name),
               owner_phone = COALESCE($4, owner_phone),
               house_number = COALESCE($5, house_number),
               street = COALESCE($6, street),
               updated_at = NOW() 
           WHERE id = $1;`,
          [resolvedParcelId, existing.id, cleanDraftOwnerName, cleanDraftOwnerPhone, cleanDraftHouseNumber, cleanDraftStreet]
        );
      } else {
        // Căn hộ con: chỉ cập nhật trạng thái và thông tin chủ hộ căn hộ trong building_units, tuyệt đối không chạm vào active_phase1_report_id của tòa mẹ
        await Database.query(
          `UPDATE building_units 
           SET status = CASE 
                 WHEN status::text IN ('SUBMITTED', 'APPROVED', 'PHASE2_COMPLETED', 'APPROVED_PHASE2') THEN status 
                 ELSE 'IN_PROGRESS' 
               END, 
               phase1_report_id = CASE 
                 WHEN phase1_report_id IS NOT NULL 
                   AND EXISTS (SELECT 1 FROM base_survey_reports WHERE id = building_units.phase1_report_id) 
                 THEN phase1_report_id 
                 ELSE $2 
               END,
               owner_name = COALESCE($3, owner_name),
               owner_phone = COALESCE($4, owner_phone),
               display_code = COALESCE($5, display_code),
               updated_at = NOW() 
           WHERE id = $1;`,
          [data.unitId, existing.id, cleanDraftOwnerName, cleanDraftOwnerPhone, cleanDraftDisplayCode]
        );
      }

      return updateRes.rows[0];
    } else {
      // Khởi tạo mã ngẫu nhiên 6 số phục vụ bàn giao ca
      const securityCode = Math.floor(100000 + Math.random() * 900000).toString();
      const parsedNewSurveyData: any = typeof data.surveyData === 'string'
        ? (() => { try { return JSON.parse(data.surveyData); } catch { return {}; } })()
        : (data.surveyData || {});
      const isPlaceholderOwner = (val: unknown): boolean =>
        typeof val === 'string' && /^(chủ\s+hộ\s+thửa|chưa\s+cập\s+nhật|chủ\s+sở\s+hữu\s+thửa)/i.test(val.trim());
      const cleanNewOwnerName =
        typeof parsedNewSurveyData?.ownerName === 'string' && parsedNewSurveyData.ownerName.trim() && !isPlaceholderOwner(parsedNewSurveyData.ownerName)
          ? parsedNewSurveyData.ownerName.trim()
          : null;
      const cleanNewOwnerPhone =
        typeof parsedNewSurveyData?.ownerPhone === 'string' && parsedNewSurveyData.ownerPhone.trim()
          ? parsedNewSurveyData.ownerPhone.trim()
          : null;
      const cleanNewHouseNumber =
        typeof parsedNewSurveyData?.houseNumber === 'string' && parsedNewSurveyData.houseNumber.trim()
          ? parsedNewSurveyData.houseNumber.trim()
          : null;
      const cleanNewStreet =
        typeof parsedNewSurveyData?.street === 'string' && parsedNewSurveyData.street.trim()
          ? parsedNewSurveyData.street.trim()
          : null;
      const cleanNewDisplayCode =
        typeof parsedNewSurveyData?.displayCode === 'string' && parsedNewSurveyData.displayCode.trim()
          ? parsedNewSurveyData.displayCode.trim()
          : null;
      
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

      // Chỉ cập nhật trạng thái tòa mẹ, active_phase1_report_id và đồng bộ thông tin chủ hộ/địa chỉ lên GIS khi đây là báo cáo tòa mẹ / độc lập (!data.unitId)
      if (!data.unitId) {
        await Database.query(
          `UPDATE parcels 
           SET survey_status = CASE 
                 WHEN survey_status::text IN ('SUBMITTED', 'APPROVED', 'PHASE2_COMPLETED', 'APPROVED_PHASE2') THEN survey_status 
                 ELSE 'IN_PROGRESS' 
               END, 
               active_phase1_report_id = CASE 
                 WHEN survey_status::text IN ('SUBMITTED', 'APPROVED', 'PHASE2_COMPLETED', 'APPROVED_PHASE2') 
                   AND active_phase1_report_id IS NOT NULL 
                   AND EXISTS (SELECT 1 FROM base_survey_reports WHERE id = parcels.active_phase1_report_id) 
                 THEN active_phase1_report_id 
                 ELSE $2 
               END,
               owner_name = COALESCE($3, owner_name),
               owner_phone = COALESCE($4, owner_phone),
               house_number = COALESCE($5, house_number),
               street = COALESCE($6, street),
               updated_at = NOW() 
           WHERE id = $1;`,
          [resolvedParcelId, newDraft.id, cleanNewOwnerName, cleanNewOwnerPhone, cleanNewHouseNumber, cleanNewStreet]
        );
      } else {
        // Căn hộ con: chỉ cập nhật trạng thái căn hộ trong building_units, tuyệt đối không chạm vào active_phase1_report_id của tòa mẹ
        await Database.query(
          `UPDATE building_units 
           SET status = CASE 
                 WHEN status::text IN ('SUBMITTED', 'APPROVED', 'PHASE2_COMPLETED', 'APPROVED_PHASE2') THEN status 
                 ELSE 'IN_PROGRESS' 
               END, 
               phase1_report_id = CASE 
                 WHEN status::text IN ('SUBMITTED', 'APPROVED', 'PHASE2_COMPLETED', 'APPROVED_PHASE2') 
                   AND phase1_report_id IS NOT NULL 
                   AND EXISTS (SELECT 1 FROM base_survey_reports WHERE id = building_units.phase1_report_id) 
                 THEN phase1_report_id 
                 ELSE $2 
               END,
               owner_name = COALESCE($3, owner_name),
               owner_phone = COALESCE($4, owner_phone),
               display_code = COALESCE($5, display_code),
               updated_at = NOW() 
           WHERE id = $1;`,
          [data.unitId, newDraft.id, cleanNewOwnerName, cleanNewOwnerPhone, cleanNewDisplayCode]
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

  static async savePhotoMappings(
    parcelId: string,
    unitId: string | null | undefined,
    mappings: Record<string, string>,
    deviceId?: string
  ): Promise<{ success: boolean; count: number }> {
    const resolvedParcelId = await SurveyBaseRepository.resolveParcelId(parcelId);
    if (!resolvedParcelId) return { success: false, count: 0 };

    const existing = await this.findActiveDraft(resolvedParcelId, unitId);
    if (!existing) return { success: false, count: 0 };

    let surveyData: any = typeof existing.survey_data_json === 'string'
      ? JSON.parse(existing.survey_data_json)
      : (existing.survey_data_json || {});

    // 1. Cập nhật danh mục ánh xạ _photoMappings
    surveyData._photoMappings = {
      ...(surveyData._photoMappings || {}),
      ...mappings,
    };

    if (deviceId) {
      surveyData._lastPromotedDeviceId = deviceId;
    }

    // 2. Tự động thay thế mọi chuỗi blob:local://${localId} bằng cloudUrl trong toàn bộ surveyData
    const replaceLocalUris = (target: unknown): unknown => {
      if (target === null || target === undefined) return target;
      if (typeof target === 'string') {
        if (target.startsWith('blob:local://')) {
          const rawId = target.replace('blob:local://', '').split('?')[0];
          if (mappings[rawId]) return mappings[rawId];
        }
        return target;
      }
      if (Array.isArray(target)) {
        return target.map(replaceLocalUris);
      }
      if (typeof target === 'object') {
        const obj = target as Record<string, unknown>;
        const updated: Record<string, unknown> = {};
        for (const k of Object.keys(obj)) {
          updated[k] = replaceLocalUris(obj[k]);
        }
        return updated;
      }
      return target;
    };

    surveyData = replaceLocalUris(surveyData);

    await Database.query(
      `UPDATE base_survey_reports
       SET survey_data_json = $2,
           updated_at = NOW()
       WHERE id = $1;`,
      [existing.id, JSON.stringify(surveyData)]
    );

    return { success: true, count: Object.keys(mappings).length };
  }
}
