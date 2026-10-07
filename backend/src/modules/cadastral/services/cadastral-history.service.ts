import { Database } from '../../../database/db';
import { NotFoundError } from '../../../common/errors/problem-details';

export interface HistoryParcelSummary {
  id: string;
  code: string;
  address?: string;
  landAreaM2?: number;
}

export interface CadastralMutationHistoryItem {
  id: string;
  mutationCode: string;
  mutationType: 'MERGE' | 'SPLIT' | 'SWAP_SPATIAL' | 'REDRAW' | string;
  actionTitle: string;
  status: string;
  createdAt: string;
  approvedAt?: string;
  operator: {
    id: string;
    fullName: string;
    role: string;
    email?: string;
  };
  reason: string;
  clientIp?: string;
  sourceParcels: HistoryParcelSummary[];
  resultParcels: HistoryParcelSummary[];
  details?: Record<string, any>;
}

export class CadastralHistoryService {
  /**
   * Lấy lịch sử biến động chi tiết của một thửa đất cụ thể (Chỉ SUPER_ADMIN)
   */
  static async getParcelMutationHistory(parcelId: string): Promise<{
    parcel: {
      id: string;
      code: string;
      address: string;
      landAreaM2: number;
      constructionAreaM2: number;
      surveyStatus: string;
    };
    events: CadastralMutationHistoryItem[];
  }> {
    // 1. Kiểm tra thửa đất tồn tại
    const parcelRes = await Database.query<{
      id: string;
      project_parcel_code: string;
      house_number: string;
      street: string;
      land_area_m2: number;
      construction_area_m2: number;
      survey_status: string;
    }>(
      `SELECT id, project_parcel_code, house_number, street, land_area_m2, construction_area_m2, survey_status
       FROM parcels WHERE id = $1;`,
      [parcelId]
    );

    if (parcelRes.rows.length === 0) {
      throw new NotFoundError(`Không tìm thấy thửa đất với ID: ${parcelId}`);
    }
    const currentParcel = parcelRes.rows[0];

    // 2. Truy vấn tất cả sự kiện biến động liên quan đến thửa đất
    const eventsRes = await Database.query<{
      id: string;
      mutation_code: string;
      mutation_type: string;
      source_parcel_ids: string[];
      result_parcel_ids: string[];
      surveyor_notes: string;
      status: string;
      created_at: string;
      approved_at: string;
      operator_id: string;
      operator_name: string;
      operator_role: string;
      operator_email: string;
    }>(
      `SELECT m.id, m.mutation_code, m.mutation_type, m.source_parcel_ids, m.result_parcel_ids,
              m.surveyor_notes, m.status, m.created_at, m.approved_at,
              COALESCE(u.id, m.zone_admin_id, m.surveyor_id) as operator_id,
              COALESCE(u.full_name, 'Hệ thống Quản trị') as operator_name,
              COALESCE(u.role::text, 'ZONE_ADMIN') as operator_role,
              u.email as operator_email
       FROM parcel_mutation_events m
       LEFT JOIN users u ON u.id = COALESCE(m.zone_admin_id, m.surveyor_id)
       WHERE m.source_parcel_ids @> ARRAY[$1::uuid] 
          OR m.result_parcel_ids @> ARRAY[$1::uuid]
       ORDER BY m.created_at DESC;`,
      [parcelId]
    );

    // 3. Gom danh sách ID các thửa đất liên quan để load mã hiệu + diện tích
    const allRelatedParcelIds = new Set<string>();
    for (const ev of eventsRes.rows) {
      (ev.source_parcel_ids || []).forEach((id) => allRelatedParcelIds.add(id));
      (ev.result_parcel_ids || []).forEach((id) => allRelatedParcelIds.add(id));
    }

    const parcelInfoMap = new Map<string, HistoryParcelSummary>();
    if (allRelatedParcelIds.size > 0) {
      const idsArray = Array.from(allRelatedParcelIds);
      const parcelsQuery = await Database.query<{
        id: string;
        project_parcel_code: string;
        house_number: string;
        street: string;
        land_area_m2: number;
      }>(
        `SELECT id, project_parcel_code, house_number, street, land_area_m2 
         FROM parcels WHERE id = ANY($1);`,
        [idsArray]
      );
      for (const p of parcelsQuery.rows) {
        parcelInfoMap.set(p.id, {
          id: p.id,
          code: p.project_parcel_code,
          address: `${p.house_number || ''} ${p.street || ''}`.trim() || undefined,
          landAreaM2: Number(p.land_area_m2),
        });
      }
    }

    // 4. Lấy kèm thông tin bổ trợ từ system_audit_logs để có client_ip và diff_payload
    const mutationCodes = eventsRes.rows.map((e) => e.mutation_code).filter(Boolean);
    const auditMap = new Map<string, { clientIp?: string; diffPayload?: any }>();

    if (mutationCodes.length > 0) {
      const auditRes = await Database.query<{
        diff_mutation_code: string;
        client_ip: string;
        diff_payload: any;
      }>(
        `SELECT diff_payload->>'mutationCode' as diff_mutation_code,
                client_ip,
                diff_payload
         FROM system_audit_logs
         WHERE diff_payload->>'mutationCode' = ANY($1)
            OR diff_payload->>'swapEventCode' = ANY($1);`,
        [mutationCodes]
      );

      for (const a of auditRes.rows) {
        if (a.diff_mutation_code) {
          auditMap.set(a.diff_mutation_code, {
            clientIp: a.client_ip,
            diffPayload: a.diff_payload,
          });
        }
      }
    }

    // 5. Chuẩn hóa format trả về cho giao diện Dòng thời gian (Timeline)
    const formattedEvents: CadastralMutationHistoryItem[] = eventsRes.rows.map((e) => {
      const audit = auditMap.get(e.mutation_code);
      let actionTitle = 'Biến động địa chính';
      switch (e.mutation_type) {
        case 'MERGE':
          actionTitle = 'Gộp thửa đất (Merge)';
          break;
        case 'SPLIT':
          actionTitle = 'Tách thửa đất (Split)';
          break;
        case 'SWAP_SPATIAL':
          actionTitle = 'Hoán vị ranh giới không gian (Swap)';
          break;
        case 'REDRAW':
          actionTitle = 'Chỉnh sửa / Vẽ lại ranh nhà (Redraw Footprint)';
          break;
      }

      return {
        id: e.id,
        mutationCode: e.mutation_code,
        mutationType: e.mutation_type,
        actionTitle,
        status: e.status,
        createdAt: e.created_at,
        approvedAt: e.approved_at,
        operator: {
          id: e.operator_id,
          fullName: e.operator_name,
          role: e.operator_role,
          email: e.operator_email,
        },
        reason: e.surveyor_notes || audit?.diffPayload?.reason || audit?.diffPayload?.adminNotes || 'Không có ghi chú lý do',
        clientIp: audit?.clientIp || undefined,
        sourceParcels: (e.source_parcel_ids || []).map((id) => parcelInfoMap.get(id) || { id, code: id.slice(0, 8) }),
        resultParcels: (e.result_parcel_ids || []).map((id) => parcelInfoMap.get(id) || { id, code: id.slice(0, 8) }),
        details: audit?.diffPayload || undefined,
      };
    });

    return {
      parcel: {
        id: currentParcel.id,
        code: currentParcel.project_parcel_code,
        address: `${currentParcel.house_number || ''} ${currentParcel.street || ''}`.trim(),
        landAreaM2: Number(currentParcel.land_area_m2),
        constructionAreaM2: Number(currentParcel.construction_area_m2),
        surveyStatus: currentParcel.survey_status,
      },
      events: formattedEvents,
    };
  }

  /**
   * Lấy toàn bộ danh sách biến động của Zone (Phân khu) (Chỉ SUPER_ADMIN)
   */
  static async getZoneMutationHistory(
    zoneId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ total: number; events: CadastralMutationHistoryItem[] }> {
    const totalRes = await Database.query<{ count: string }>(
      `SELECT COUNT(DISTINCT m.id) as count
       FROM parcel_mutation_events m
       WHERE EXISTS (
         SELECT 1 FROM parcels p 
         WHERE p.zone_id = $1 
           AND (p.id = ANY(m.source_parcel_ids) OR p.id = ANY(m.result_parcel_ids))
       );`,
      [zoneId]
    );

    const total = parseInt(totalRes.rows[0]?.count || '0', 10);

    const eventsRes = await Database.query<{
      id: string;
      mutation_code: string;
      mutation_type: string;
      source_parcel_ids: string[];
      result_parcel_ids: string[];
      surveyor_notes: string;
      status: string;
      created_at: string;
      approved_at: string;
      operator_id: string;
      operator_name: string;
      operator_role: string;
      operator_email: string;
    }>(
      `SELECT m.id, m.mutation_code, m.mutation_type, m.source_parcel_ids, m.result_parcel_ids,
              m.surveyor_notes, m.status, m.created_at, m.approved_at,
              COALESCE(u.id, m.zone_admin_id, m.surveyor_id) as operator_id,
              COALESCE(u.full_name, 'Hệ thống Quản trị') as operator_name,
              COALESCE(u.role, 'ADMIN') as operator_role,
              u.email as operator_email
       FROM parcel_mutation_events m
       LEFT JOIN users u ON u.id = COALESCE(m.zone_admin_id, m.surveyor_id)
       WHERE EXISTS (
         SELECT 1 FROM parcels p 
         WHERE p.zone_id = $1 
           AND (p.id = ANY(m.source_parcel_ids) OR p.id = ANY(m.result_parcel_ids))
       )
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3;`,
      [zoneId, limit, offset]
    );

    // Gom thông tin các parcel
    const allParcelIds = new Set<string>();
    for (const ev of eventsRes.rows) {
      (ev.source_parcel_ids || []).forEach((id) => allParcelIds.add(id));
      (ev.result_parcel_ids || []).forEach((id) => allParcelIds.add(id));
    }

    const parcelInfoMap = new Map<string, HistoryParcelSummary>();
    if (allParcelIds.size > 0) {
      const parcelsQuery = await Database.query<{
        id: string;
        project_parcel_code: string;
        house_number: string;
        street: string;
        land_area_m2: number;
      }>(
        `SELECT id, project_parcel_code, house_number, street, land_area_m2 
         FROM parcels WHERE id = ANY($1);`,
        [Array.from(allParcelIds)]
      );
      for (const p of parcelsQuery.rows) {
        parcelInfoMap.set(p.id, {
          id: p.id,
          code: p.project_parcel_code,
          address: `${p.house_number || ''} ${p.street || ''}`.trim() || undefined,
          landAreaM2: Number(p.land_area_m2),
        });
      }
    }

    const events: CadastralMutationHistoryItem[] = eventsRes.rows.map((e) => {
      let actionTitle = 'Biến động địa chính';
      switch (e.mutation_type) {
        case 'MERGE':
          actionTitle = 'Gộp thửa đất (Merge)';
          break;
        case 'SPLIT':
          actionTitle = 'Tách thửa đất (Split)';
          break;
        case 'SWAP_SPATIAL':
          actionTitle = 'Hoán vị ranh giới không gian (Swap)';
          break;
        case 'REDRAW':
          actionTitle = 'Chỉnh sửa / Vẽ lại ranh nhà (Redraw Footprint)';
          break;
      }

      return {
        id: e.id,
        mutationCode: e.mutation_code,
        mutationType: e.mutation_type,
        actionTitle,
        status: e.status,
        createdAt: e.created_at,
        approvedAt: e.approved_at,
        operator: {
          id: e.operator_id,
          fullName: e.operator_name,
          role: e.operator_role,
          email: e.operator_email,
        },
        reason: e.surveyor_notes || 'Không có ghi chú lý do',
        sourceParcels: (e.source_parcel_ids || []).map((id) => parcelInfoMap.get(id) || { id, code: id.slice(0, 8) }),
        resultParcels: (e.result_parcel_ids || []).map((id) => parcelInfoMap.get(id) || { id, code: id.slice(0, 8) }),
      };
    });

    return { total, events };
  }
}
