import crypto from 'crypto';
import { Database } from '../../../database/db';
import { NotFoundError, BadRequestError, UnauthorizedError, ForbiddenError, ConflictError } from '../../../common/errors/problem-details';
import { CryptoUtils } from '../../../common/utils/crypto.utils';
import { CadastralService } from '../../cadastral/cadastral.service';
import { normalizeComponentType, normalizeStructuralSystem, normalizeFoundationCategory } from '../../survey/survey.dto';
import { calculateDistancesFromPolygon } from '../../report_v2/utils/metro-spatial.utils';

export interface PhotoActionItem {
  action: 'ADD' | 'DELETE' | 'REPLACE' | 'RESTORE' | 'ROTATE';
  category: string; // 'IDENTIFICATION' | 'OVERVIEW' | 'AS_BUILT' | 'SETTLEMENT_TILT' | 'CAD_FLOOR' | 'ZONE_CTX' | 'DEFECT_CU' | 'SCOPE_GIS' | 'MINUTES' | 'ABSENCE_NOTICE' | 'SIGNATURE'
  rotation?: number; // 0 | 90 | 180 | 270
  targetPhotoType?: string;
  targetPhotoId?: string;
  photoIndex?: number;
  oldPhotoUrl?: string;
  newPhotoUrl?: string;
  newPhotoUrls?: string[];
  photoCode?: string;
  originalFilename?: string;
  standardizedFilename?: string;
  sha256Hash?: string;
  sizeBytes?: number;
  mimeType?: string;
  caption?: string;
  reason: string;
  isNotApplicable?: boolean;
  naReason?: string;
  metadata?: Record<string, any>;
  defectCode?: string;
  defectId?: string;
  deleteDefectItem?: boolean;
  pinX?: number;
  pinY?: number;
  widthMaxMm?: number;
  lengthMm?: number;
}

function getEquivalentIdentPhotoTypes(val?: string): string[] {
  const s = String(val || '').toUpperCase().trim();
  if (s.includes('P01') || s.includes('HOUSE_NUMBER')) {
    return ['P01', 'P01_HOUSE_NUMBER'];
  }
  if (s.includes('P02') || s.includes('MAIN_FACADE')) {
    return ['P02', 'P02_MAIN_FACADE'];
  }
  if (s.includes('P03') || s.includes('SIDE') || s.includes('REAR')) {
    return ['P03', 'P03_SIDE_REAR', 'P03_SIDE_OR_REAR'];
  }
  if (s.includes('P04') || s.includes('STREET') || s.includes('CONTEXT')) {
    return ['P04', 'P04_CONTEXT_STREET'];
  }
  return [s || 'P01_HOUSE_NUMBER'];
}

function getDeepProp(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  const parts = path.replace(/\[(\w+)\]/g, '.$1').replace(/^\./, '').split('.');
  let curr = obj;
  for (const part of parts) {
    if (curr === null || curr === undefined) return undefined;
    curr = curr[part];
  }
  return curr;
}

function setDeepProp(obj: any, path: string, value: any): boolean {
  if (!obj || !path) return false;
  const parts = path.replace(/\[(\w+)\]/g, '.$1').replace(/^\./, '').split('.');
  let curr = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (curr[part] === undefined || curr[part] === null || typeof curr[part] !== 'object') {
      const nextPart = parts[i + 1];
      curr[part] = /^\d+$/.test(nextPart) ? [] : {};
    }
    curr = curr[part];
  }
  curr[parts[parts.length - 1]] = value;
  return true;
}

function mutateSurveyJsonPhoto(
  surveyJson: any,
  targetPath: string,
  photoIndex: number | undefined,
  action: 'REPLACE' | 'ADD' | 'DELETE' | 'RESTORE',
  newUrl?: string,
  oldUrl?: string,
  extra?: { photoCode?: string; caption?: string; addedAt?: string }
) {
  if (!surveyJson || !targetPath) return;

  const currentVal = getDeepProp(surveyJson, targetPath);

  if (action === 'REPLACE' || action === 'RESTORE') {
    if (Array.isArray(currentVal)) {
      const idx = Number(photoIndex) >= 0 ? Number(photoIndex) : 0;
      if (currentVal.length > idx) {
        if (typeof currentVal[idx] === 'object' && currentVal[idx] !== null) {
          currentVal[idx].url = newUrl || '';
          if (extra?.photoCode) currentVal[idx].photoCode = extra.photoCode;
          if (extra?.caption) currentVal[idx].caption = extra.caption;
        } else {
          currentVal[idx] = newUrl || '';
        }
      } else {
        currentVal.push(extra?.caption || extra?.photoCode ? { url: newUrl || '', ...extra } : (newUrl || ''));
      }
    } else if (typeof currentVal === 'object' && currentVal !== null) {
      currentVal.url = newUrl || '';
      if (extra?.photoCode) currentVal.photoCode = extra.photoCode;
      if (extra?.caption) currentVal.caption = extra.caption;
    } else {
      setDeepProp(surveyJson, targetPath, newUrl || '');
    }
  } else if (action === 'ADD') {
    let arr = currentVal;
    if (!Array.isArray(arr)) {
      setDeepProp(surveyJson, targetPath, []);
      arr = getDeepProp(surveyJson, targetPath);
    }
    if (Array.isArray(arr)) {
      const itemToPush = extra?.caption || extra?.photoCode
        ? { url: newUrl || '', photoCode: extra?.photoCode, caption: extra?.caption, addedAt: new Date().toISOString() }
        : (arr.length > 0 && typeof arr[0] === 'string' ? (newUrl || '') : { url: newUrl || '', addedAt: new Date().toISOString() });
      arr.push(itemToPush);
    }
  } else if (action === 'DELETE') {
    if (Array.isArray(currentVal)) {
      if (photoIndex !== undefined && Number(photoIndex) >= 0 && Number(photoIndex) < currentVal.length) {
        currentVal.splice(Number(photoIndex), 1);
      } else if (oldUrl) {
        const filtered = currentVal.filter((p: any) => (typeof p === 'string' ? p !== oldUrl : p?.url !== oldUrl));
        setDeepProp(surveyJson, targetPath, filtered);
      }
    } else if (typeof currentVal === 'object' && currentVal !== null) {
      currentVal.url = null;
    } else {
      setDeepProp(surveyJson, targetPath, null);
    }
  }
}

function computeSha256(input: string): string {
  return crypto.createHash('sha256').update(input || '').digest('hex');
}

export class AuditModificationService {
  /**
   * Cập nhật thông tin/ghi chú khảo sát từ Zone Admin
   * Yêu cầu: Xác thực Mật khẩu của Zone Admin + Ghi nhật ký kiểm toán Append-Only vào system_audit_logs
   */
  static async applyAdminSurveyEdit(
    reportId: string,
    adminId: string,
    payload: {
      adminPassword?: string;
      editReason: string;
      diffPayload: Array<{ field: string; label: string; oldValue: any; newValue: any }>;
      updates: Record<string, any>;
      photoActions?: PhotoActionItem[];
    },
    clientIp?: string
  ) {
    if (!payload.adminPassword || !payload.adminPassword.trim()) {
      throw new UnauthorizedError('Bắt buộc nhập mật khẩu Zone Admin để xác thực quyền sửa đổi.');
    }
    if (!payload.editReason || !payload.editReason.trim()) {
      throw new BadRequestError('Bắt buộc phải chọn hoặc nhập lý do chỉnh sửa kiểm toán (editReason) trước khi lưu.');
    }

    // 1. Kiểm tra mật khẩu tài khoản Admin
    const userRes = await Database.query<{ password_hash: string; role: string; full_name: string }>(
      `SELECT password_hash, role, full_name FROM users WHERE id = $1;`,
      [adminId]
    );
    if (!userRes.rows[0]) {
      throw new UnauthorizedError('Không tìm thấy tài khoản quản trị.');
    }
    const isPasswordValid = await CryptoUtils.comparePassword(payload.adminPassword, userRes.rows[0].password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Mật khẩu xác thực của Zone Admin không chính xác.');
    }

    // 2. Kiểm tra hồ sơ
    const reportRes = await Database.query<{
      id: string;
      parcel_id: string;
      unit_id: string | null;
      report_type: string | null;
      status: string;
      survey_data_json: any;
    }>(
      `SELECT id, parcel_id, unit_id, report_type, status, survey_data_json FROM base_survey_reports WHERE (id = $1 OR parcel_id = $1) LIMIT 1;`,
      [reportId]
    );
    if (!reportRes.rows[0]) {
      throw new NotFoundError(`Không tìm thấy hồ sơ khảo sát với ID: ${reportId}`);
    }
    const report = reportRes.rows[0];
    if (report.status === 'APPROVED') {
      throw new ForbiddenError('Hồ sơ khảo sát này đã được phê duyệt chính thức và bị khóa bất biến, không thể chỉnh sửa.');
    }
    const actualReportId = report.id;

    // 2.1. Kiểm tra khóa chiếm quyền (Pessimistic Session Lock - 15 phút)
    const lockCheck = await this.checkAuditLock(actualReportId, adminId);
    if (lockCheck.lockedByOther) {
      throw new ConflictError(
        `Hồ sơ đang được thẩm định bởi ${lockCheck.lockedByName || 'quản trị viên khác'} (còn hiệu lực đến ${lockCheck.expiresAt}). Bạn chỉ có quyền xem, không được chỉnh sửa.`
      );
    }
    const existingJson = typeof report.survey_data_json === 'string'
      ? JSON.parse(report.survey_data_json)
      : (report.survey_data_json || {});

    // 3. Gộp cập nhật vào survey_data_json
    const mergedJson = {
      ...existingJson,
      ...payload.updates,
      photoRotations: {
        ...(existingJson.photoRotations || {}),
        ...(payload.updates?.photoRotations || {}),
      },
      _lastAdminEdit: {
        adminId,
        adminName: userRes.rows[0].full_name,
        timestamp: new Date().toISOString(),
        reason: payload.editReason,
        diffCount: payload.diffPayload?.length || 0,
      },
    };

    // 3.0. Bảo toàn chữ ký chủ hộ theo quyết định Q1 (không làm mất chữ ký khi admin chỉnh sửa thân báo cáo)
    if (existingJson.signatures?.ownerSignatureUrl && !mergedJson.signatures?.ownerSignatureUrl) {
      mergedJson.signatures = {
        ...(mergedJson.signatures || {}),
        ownerSignatureUrl: existingJson.signatures.ownerSignatureUrl,
      };
    }
    if (existingJson.ownerSignatureUrl && !mergedJson.ownerSignatureUrl) {
      mergedJson.ownerSignatureUrl = existingJson.ownerSignatureUrl;
    }

    // 3.0.1. Kiểm tra và tự động tính toán lại cự ly trắc địa nếu có toạ độ đa giác mới (Q2)
    const uUpdates = payload.updates || {};
    const candidateCoords = Array.isArray(uUpdates.parcelCoordinates) && uUpdates.parcelCoordinates.length >= 3
      ? uUpdates.parcelCoordinates
      : (Array.isArray(uUpdates.polygonCoords) && uUpdates.polygonCoords.length >= 3 ? uUpdates.polygonCoords : null);

    let recalculatedCenterlineM: number | null = null;
    let recalculatedOuterM: number | null = null;
    let newCadastralGeoJsonStr: string | null = null;

    if (candidateCoords) {
      const metroRes = calculateDistancesFromPolygon(candidateCoords);
      recalculatedCenterlineM = metroRes.centerlineDist;
      recalculatedOuterM = metroRes.outerBoundaryDist;

      if (recalculatedCenterlineM !== null) {
        mergedJson.metroOffsetDistance = `${recalculatedCenterlineM.toFixed(1)}m`;
      }
      if (recalculatedOuterM !== null) {
        mergedJson.clearanceOffsetDistance = `${recalculatedOuterM.toFixed(1)}m`;
        mergedJson.stationEdgeDistance = `${recalculatedOuterM.toFixed(1)}m`;
      } else {
        mergedJson.clearanceOffsetDistance = 'Không có ga trong khu vực';
      }
      mergedJson.parcelCoordinates = candidateCoords;
      mergedJson.polygonCoords = candidateCoords;

      const ringCoords: [number, number][] = candidateCoords.map((pt: [number, number]) => [pt[1], pt[0]]);
      const firstPt = ringCoords[0];
      const lastPt = ringCoords[ringCoords.length - 1];
      if (firstPt[0] !== lastPt[0] || firstPt[1] !== lastPt[1]) {
        ringCoords.push([firstPt[0], firstPt[1]]);
      }
      newCadastralGeoJsonStr = JSON.stringify({
        type: 'Polygon',
        coordinates: [ringCoords],
      });
    }

    // 3.1. Gatekeeper CAT 1/2: Bắt buộc phải có ít nhất 1 bản vẽ hoàn công
    const targetCatScore = payload.updates?.foundationCatScore ??
      payload.updates?.specs?.foundationCatScore ??
      payload.updates?.['buildingSpecs.foundation_cat_score'] ??
      mergedJson.buildingSpecs?.foundation_cat_score ??
      mergedJson.foundationCatScore;

    if (targetCatScore === 1 || targetCatScore === 2 || targetCatScore === '1' || targetCatScore === '2') {
      const specRes = await Database.query<{ as_built_drawing_photos_json: any }>(
        `SELECT as_built_drawing_photos_json FROM building_specifications WHERE report_id = $1;`,
        [actualReportId]
      );
      const existingDrawings = Array.isArray(specRes.rows[0]?.as_built_drawing_photos_json)
        ? specRes.rows[0].as_built_drawing_photos_json.filter((d: any) => !d.isDeleted && !d.is_deleted && (d.url || d.photoUrl))
        : [];

      const newDrawings = (payload.photoActions || []).filter(
        (pa: any) => (pa.category === 'AS_BUILT' || pa.photoType === 'AS_BUILT_DRAWING' || pa.targetPhotoType === 'AS_BUILT_DRAWING') && pa.action !== 'DELETE'
      );

      const deletedDrawings = (payload.photoActions || []).filter(
        (pa: any) => (pa.category === 'AS_BUILT' || pa.photoType === 'AS_BUILT_DRAWING' || pa.targetPhotoType === 'AS_BUILT_DRAWING') && pa.action === 'DELETE'
      );

      const totalDrawingsCount = existingDrawings.length + newDrawings.length - deletedDrawings.length;
      if (totalDrawingsCount <= 0) {
        throw new BadRequestError('Hồ sơ đang phân loại CAT 1/CAT 2 bắt buộc phải đính kèm ít nhất 1 bản vẽ hoàn công!');
      }
    }

    // 3.2. Tự động khởi tạo phiên bản cơ sở v0 (ORIGINAL_SUBMISSION) TRƯỚC KHI ghi đè dữ liệu chỉnh sửa lần đầu
    try {
      const verCountRes = await Database.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM survey_report_versions WHERE report_id = $1;`,
        [actualReportId]
      );
      if (Number(verCountRes.rows[0]?.count || 0) === 0) {
        const { AuditVersionService } = await import('./audit-version.service');
        const repInfo = await Database.query<{ surveyor_id: string }>(
          `SELECT surveyor_id FROM base_survey_reports WHERE id = $1;`,
          [actualReportId]
        );
        await AuditVersionService.createSnapshot(actualReportId, {
          versionTag: 'ORIGINAL_SUBMISSION',
          title: 'Bản nộp thực địa ban đầu',
          editReason: 'Khởi tạo phiên bản cơ sở tự động trước khi chỉnh sửa thẩm định lần đầu (Auto-Seed Baseline v0)',
          userId: repInfo.rows[0]?.surveyor_id,
        });
      }
    } catch (seedV0Err: any) {
      console.warn('[applyAdminSurveyEdit] Không thể tự động khởi tạo v0 trước chỉnh sửa:', seedV0Err?.message);
    }

    // 4. Lưu CSDL trong Transaction
    const txResult = await Database.transaction(async (client) => {
      await client.query(
        `UPDATE base_survey_reports 
         SET survey_data_json = $1, 
             status = CASE WHEN status = 'SUBMITTED' THEN 'UNDER_REVIEW'::report_status_enum ELSE status END,
             updated_at = NOW() 
         WHERE id = $2;`,
        [JSON.stringify(mergedJson), actualReportId]
      );

      const u = payload.updates;

      // 4.1. Cập nhật parcels đầy đủ các trường (Bảo vệ toạ độ WGS84 và cập nhật đa giác/cự ly Metro nếu có)
      let latVal: number | null = null;
      let lngVal: number | null = null;
      if (u.gpsCoords?.lat !== undefined && u.gpsCoords?.lng !== undefined) {
        latVal = Number(u.gpsCoords.lat);
        lngVal = Number(u.gpsCoords.lng);
      } else if (u.gpsCoords?.latitude !== undefined && u.gpsCoords?.longitude !== undefined) {
        latVal = Number(u.gpsCoords.latitude);
        lngVal = Number(u.gpsCoords.longitude);
      } else if (Array.isArray(u.coordinates) && u.coordinates.length >= 2) {
        const c0 = Number(u.coordinates[0]);
        const c1 = Number(u.coordinates[1]);
        if (c0 > 50 && c1 < 50) { // [lng, lat] GeoJSON standard
          lngVal = c0; latVal = c1;
        } else { // [lat, lng]
          latVal = c0; lngVal = c1;
        }
      }

      const isChildUnit = Boolean(report.unit_id) || report.report_type === 'CONDO_UNIT' || report.report_type === 'UNIT_CHILD';

      if (!isChildUnit) {
        await client.query(
          `UPDATE parcels SET
             house_number = COALESCE($1, house_number),
             street = COALESCE($2, street),
             ward = COALESCE($3, ward),
             district = COALESCE($4, district),
             owner_name = COALESCE($5, owner_name),
             owner_phone = COALESCE($6, owner_phone),
             official_cadastral_code = COALESCE($7, official_cadastral_code),
             frontage_width = COALESCE($8, frontage_width),
             lot_depth = COALESCE($9, lot_depth),
             land_area_m2 = COALESCE($10, land_area_m2),
             construction_area_m2 = COALESCE($11, construction_area_m2),
             floor_count = COALESCE($12, floor_count),
             location_geom = CASE 
               WHEN $13::float IS NOT NULL AND $14::float IS NOT NULL 
               THEN ST_SetSRID(ST_Point($14::float, $13::float), 4326) 
               ELSE location_geom 
             END,
             distance_to_centerline_m = COALESCE($16, distance_to_centerline_m),
             cadastral_polygon_geom = CASE 
               WHEN $17::text IS NOT NULL THEN ST_SetSRID(ST_GeomFromGeoJSON($17), 4326) 
               ELSE cadastral_polygon_geom 
             END,
             updated_at = NOW()
           WHERE id = $15;`,
          [
            u.houseNumber !== undefined && u.houseNumber !== '' ? u.houseNumber : null,
            u.street !== undefined && u.street !== '' ? u.street : null,
            u.ward !== undefined && u.ward !== '' ? u.ward : null,
            u.district !== undefined && u.district !== '' ? u.district : null,
            u.ownerName !== undefined && u.ownerName !== '' ? u.ownerName : null,
            u.ownerPhone !== undefined && u.ownerPhone !== '' ? u.ownerPhone : null,
            u.officialCadastralCode !== undefined && u.officialCadastralCode !== '' ? u.officialCadastralCode : null,
            u.frontageWidth !== undefined && u.frontageWidth !== '' ? Number(u.frontageWidth) : null,
            u.lotDepth !== undefined && u.lotDepth !== '' ? Number(u.lotDepth) : null,
            u.landAreaM2 !== undefined && u.landAreaM2 !== '' ? Number(u.landAreaM2) : null,
            u.constructionAreaM2 !== undefined && u.constructionAreaM2 !== '' ? Number(u.constructionAreaM2) : null,
            u.aboveFloors !== undefined && u.aboveFloors !== '' ? Number(u.aboveFloors) : null,
            latVal !== null && latVal !== undefined && !isNaN(latVal) ? Number(latVal) : null,
            lngVal !== null && lngVal !== undefined && !isNaN(lngVal) ? Number(lngVal) : null,
            report.parcel_id,
            recalculatedCenterlineM,
            newCadastralGeoJsonStr,
          ]
        );
      } else if (report.unit_id) {
        await client.query('SAVEPOINT audit_unit_update_sp;');
        try {
          await client.query(
            `UPDATE building_units SET
               owner_name = COALESCE($1, owner_name),
               owner_phone = COALESCE($2, owner_phone),
               owner_id_card = COALESCE($3, owner_id_card),
               resident_status = COALESCE($4, resident_status),
               display_code = COALESCE($5, display_code),
               updated_at = NOW()
             WHERE id = $6;`,
            [
              u.ownerName !== undefined && u.ownerName !== '' ? u.ownerName : null,
              u.ownerPhone !== undefined && u.ownerPhone !== '' ? u.ownerPhone : null,
              u.ownerIdCard !== undefined && u.ownerIdCard !== '' ? u.ownerIdCard : null,
              u.residentStatus !== undefined && u.residentStatus !== '' ? u.residentStatus : null,
              u.displayCode !== undefined && u.displayCode !== '' ? u.displayCode : null,
              report.unit_id,
            ]
          );
          await client.query('RELEASE SAVEPOINT audit_unit_update_sp;');
        } catch {
          await client.query('ROLLBACK TO SAVEPOINT audit_unit_update_sp;');
          const fallbackStatus = u.residentStatus === 'CHO_THUÊ'
            ? 'CHO_THUÊ'
            : (u.residentStatus === 'BỎ_TRỐNG_CHƯA_VỀ_Ở' || u.residentStatus === 'VẮNG_MẶT_KHÓA_CỬA' || u.residentStatus === 'ĐỂ_TRỐNG')
              ? 'ĐỂ_TRỐNG'
              : 'CHỦ_HỘ_Ở';
          await client.query(
            `UPDATE building_units SET
               owner_name = COALESCE($1, owner_name),
               owner_phone = COALESCE($2, owner_phone),
               owner_id_card = COALESCE($3, owner_id_card),
               resident_status = COALESCE($4, resident_status),
               display_code = COALESCE($5, display_code),
               updated_at = NOW()
             WHERE id = $6;`,
            [
              u.ownerName !== undefined && u.ownerName !== '' ? u.ownerName : null,
              u.ownerPhone !== undefined && u.ownerPhone !== '' ? u.ownerPhone : null,
              u.ownerIdCard !== undefined && u.ownerIdCard !== '' ? u.ownerIdCard : null,
              u.residentStatus ? fallbackStatus : null,
              u.displayCode !== undefined && u.displayCode !== '' ? u.displayCode : null,
              report.unit_id,
            ]
          );
        }
      }

      // 4.2. Cập nhật base_survey_reports metadata & survey_scopes nếu có
      const sigs = u.signatures || {};
      const exec = u.executiveSummary || {};
      const cleanSurveyDate = (u.surveyDate && typeof u.surveyDate === 'string' && u.surveyDate.trim() !== '') 
        ? u.surveyDate.trim() 
        : null;
      const summaryConclusionsVal = u.summaryConclusions !== undefined
        ? u.summaryConclusions
        : (exec.summaryConclusions !== undefined ? exec.summaryConclusions : null);
      const engRecsVal = exec.specificRecommendationsText !== undefined
        ? exec.specificRecommendationsText
        : (u.engineeringRecommendations !== undefined ? u.engineeringRecommendations : null);
      const ownerRemarksVal = sigs.ownerFeedback !== undefined
        ? sigs.ownerFeedback
        : (u.ownerFeedback !== undefined ? u.ownerFeedback : (u.ownerRemarks !== undefined ? u.ownerRemarks : null));

      await client.query(
        `UPDATE base_survey_reports SET
           survey_date = COALESCE($1, survey_date),
           surveyor_signature_url = COALESCE($2, surveyor_signature_url),
           owner_signature_url = COALESCE($3, owner_signature_url),
           owner_remarks = COALESCE($4, owner_remarks),
           engineering_recommendations = COALESCE($5, engineering_recommendations),
           summary_conclusions = COALESCE($6, summary_conclusions),
           updated_at = NOW()
         WHERE id = $7;`,
        [
          cleanSurveyDate,
          sigs.surveyorSignature || sigs.surveyorSignatureUrl || u.surveyorSignatureUrl || null,
          sigs.ownerSignature || sigs.ownerSignatureUrl || u.ownerSignatureUrl || null,
          ownerRemarksVal,
          engRecsVal,
          summaryConclusionsVal,
          actualReportId,
        ]
      );

      if (u.accessLimitation || u.surveyScope || u.inaccessibleAreas !== undefined || u.accessibilityLimitations !== undefined) {
        const accLim = mergedJson.accessLimitation || {};
        const accType = accLim.type || u.accessLimitation?.type;
        let coverage: 'TOAN_BO' | 'MOT_PHAN' | 'KHONG_THE_TIEP_CAN' = 'TOAN_BO';
        if (accType === 'LIMITED' || accType === 'PARTIAL') coverage = 'MOT_PHAN';
        else if (accType === 'ABSENT_REFUSED' || accType === 'REFUSED' || accType === 'ABSENTEE' || mergedJson.isAbsenteeSurvey) coverage = 'KHONG_THE_TIEP_CAN';

        const inaccessibleStr = Array.isArray(accLim.restrictedAreas) && accLim.restrictedAreas.length > 0
          ? accLim.restrictedAreas.join(', ')
          : (u.inaccessibleAreas !== undefined ? u.inaccessibleAreas : null);
        const limitationNotes = accLim.notes !== undefined
          ? accLim.notes
          : (accLim.mainReason !== undefined ? accLim.mainReason : (u.accessibilityLimitations !== undefined ? u.accessibilityLimitations : null));

        await client.query(
          `INSERT INTO survey_scopes (report_id, survey_coverage, inaccessible_areas, accessibility_limitations)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (report_id) DO UPDATE SET
             survey_coverage = EXCLUDED.survey_coverage,
             inaccessible_areas = COALESCE($3, survey_scopes.inaccessible_areas),
             accessibility_limitations = COALESCE($4, survey_scopes.accessibility_limitations);`,
          [actualReportId, coverage, inaccessibleStr, limitationNotes]
        );
      }

      // 4.3. Cập nhật building_specifications (UPSERT đầy đủ mọi cột kỹ thuật)
      const normStructSys = u.structureSystem !== undefined && u.structureSystem !== ''
        ? normalizeStructuralSystem(u.structureSystem)
        : null;
      const normFoundCat = u.foundationType !== undefined && u.foundationType !== ''
        ? normalizeFoundationCategory(u.foundationType)
        : null;
      const normBuildingGrade = u.objectGroup !== undefined && u.objectGroup !== ''
        ? (['GENERAL', 'IMPORTANT', 'CRITICAL'].includes(String(u.objectGroup).toUpperCase()) ? String(u.objectGroup).toUpperCase() : 'GENERAL')
        : null;

      await client.query(
        `INSERT INTO building_specifications (
           report_id, building_name, building_grade, adjacent_buildings, structural_system,
           floor_count, basement_count, foundation_category, year_of_construction, is_year_estimated,
           construction_area_m2, building_height_m, foundation_source,
           foundation_depth_m, foundation_density, foundation_spacing_m, foundation_notes,
           land_use_function
         ) VALUES (
           $12, $1, COALESCE($13::building_grade_enum, 'GENERAL'::building_grade_enum), $11, COALESCE($14::structural_system_enum, 'KHUNG_BTCT_CHIU_LUC'::structural_system_enum),
           COALESCE($2, 1), COALESCE($3, 0), COALESCE($15::foundation_category_enum, 'CAT_2_MONG_DON_BTCT'::foundation_category_enum), $5, COALESCE($6, false),
           $16, $17, $18,
           $7, $8, $9, $10,
           $4
         )
         ON CONFLICT (report_id) DO UPDATE SET
           building_name = COALESCE($1, building_specifications.building_name),
           floor_count = COALESCE($2, building_specifications.floor_count),
           basement_count = COALESCE($3, building_specifications.basement_count),
           land_use_function = COALESCE($4, building_specifications.land_use_function),
           year_of_construction = COALESCE($5, building_specifications.year_of_construction),
           is_year_estimated = COALESCE($6, building_specifications.is_year_estimated),
           foundation_depth_m = COALESCE($7, building_specifications.foundation_depth_m),
           foundation_density = COALESCE($8, building_specifications.foundation_density),
           foundation_spacing_m = COALESCE($9, building_specifications.foundation_spacing_m),
           foundation_notes = COALESCE($10, building_specifications.foundation_notes),
           adjacent_buildings = COALESCE($11, building_specifications.adjacent_buildings),
           building_grade = COALESCE($13::building_grade_enum, building_specifications.building_grade),
           structural_system = COALESCE($14::structural_system_enum, building_specifications.structural_system),
           foundation_category = COALESCE($15::foundation_category_enum, building_specifications.foundation_category),
           construction_area_m2 = COALESCE($16, building_specifications.construction_area_m2),
           building_height_m = COALESCE($17, building_specifications.building_height_m),
           foundation_source = COALESCE($18, building_specifications.foundation_source);`,
        [
          u.buildingName !== undefined ? u.buildingName : null,
          u.aboveFloors !== undefined && u.aboveFloors !== '' ? Number(u.aboveFloors) : null,
          u.undergroundFloors !== undefined && u.undergroundFloors !== '' ? Number(u.undergroundFloors) : null,
          u.usageFunction !== undefined ? u.usageFunction : null,
          u.constructionYear !== undefined && u.constructionYear !== '' ? Number(u.constructionYear) : null,
          u.isEstimatedYear !== undefined ? Boolean(u.isEstimatedYear) : null,
          u.foundationDepthM !== undefined && u.foundationDepthM !== '' ? Number(u.foundationDepthM) : null,
          u.foundationDensity !== undefined && u.foundationDensity !== '' && !isNaN(Number(u.foundationDensity)) ? Number(u.foundationDensity) : null,
          u.foundationSpacingM !== undefined && u.foundationSpacingM !== '' && !isNaN(Number(u.foundationSpacingM)) ? Number(u.foundationSpacingM) : null,
          u.foundationNotes !== undefined ? u.foundationNotes : null,
          u.adjacentBuildings ? (typeof u.adjacentBuildings === 'object' ? JSON.stringify(u.adjacentBuildings) : u.adjacentBuildings) : null,
          actualReportId,
          normBuildingGrade,
          normStructSys,
          normFoundCat,
          u.constructionAreaM2 !== undefined && u.constructionAreaM2 !== '' ? Number(u.constructionAreaM2) : null,
          u.buildingHeightM !== undefined && u.buildingHeightM !== '' ? Number(u.buildingHeightM) : null,
          u.foundationSource !== undefined ? String(u.foundationSource) : null,
        ]
      );

      // 4.4. Cập nhật historical_sensitivities (UPSERT)
      const hi = u.historyInterview;
      if (hi) {
        const qScores = [
          hi.renovationLoad ?? 0,
          hi.majorRepair ?? 0,
          hi.pastSettlement ?? 0,
          hi.neighborDamage ?? 0,
          hi.fireFloodIncident ?? 0,
        ];
        const maxQ = Math.max(...qScores.map(Number));
        const countHigh = qScores.filter((s) => Number(s) > 2).length;
        const e5Score = countHigh >= 2 ? 4 : maxQ;

        await client.query(
          `INSERT INTO historical_sensitivities (
             report_id, extended_or_renovated, previous_settlement_or_tilt, fire_or_accident,
             sensitive_equipment_present, details, e5_history_score
           ) VALUES ($7, COALESCE($1, false), COALESCE($2, false), COALESCE($3, false), COALESCE($4, false), $5, COALESCE($6, 0))
           ON CONFLICT (report_id) DO UPDATE SET
             extended_or_renovated = COALESCE($1, historical_sensitivities.extended_or_renovated),
             previous_settlement_or_tilt = COALESCE($2, historical_sensitivities.previous_settlement_or_tilt),
             fire_or_accident = COALESCE($3, historical_sensitivities.fire_or_accident),
             sensitive_equipment_present = COALESCE($4, historical_sensitivities.sensitive_equipment_present),
             details = COALESCE($5, historical_sensitivities.details),
             e5_history_score = COALESCE($6, historical_sensitivities.e5_history_score);`,
          [
            hi.renovationLoad !== undefined ? Number(hi.renovationLoad) > 0 : null,
            hi.pastSettlement !== undefined ? Number(hi.pastSettlement) > 0 : null,
            hi.fireFloodIncident !== undefined ? Number(hi.fireFloodIncident) > 0 : null,
            hi.sensitiveEquipment?.has !== undefined ? Boolean(hi.sensitiveEquipment.has) : null,
            hi.renovationNotes || hi.majorRepairNotes || hi.pastSettlementNotes || JSON.stringify(hi),
            e5Score,
            actualReportId,
          ]
        );
      }

      // 4.5. Cập nhật deformation_assessments (UPSERT kèm đồng bộ JSON ảnh P-05, P-06, P-07)
      const st = u.settlementTilt || u.deformation;
      if (st) {
        const tilt = st.buildingTilt || st.tiltAssessment || {};
        const beam = st.beamSagging || {};
        const diff = st.diffSettlement || {};
        const abn = st.abnormalCase || {};
        const lDiff = Number(diff.level) || 0;
        const lTilt = Number(tilt.level) || 0;
        const lSag = Number(beam.level) || 0;
        const e3Score = Math.min(4, Math.max(lDiff, lTilt, lSag));

        const tiltX = tilt.xPermille !== undefined && tilt.xPermille !== '' ? Number(tilt.xPermille) : (tilt.tilt_x_permille !== undefined ? Number(tilt.tilt_x_permille) : null);
        const tiltY = tilt.yPermille !== undefined && tilt.yPermille !== '' ? Number(tilt.yPermille) : (tilt.tilt_y_permille !== undefined ? Number(tilt.tilt_y_permille) : null);
        const tiltDir = tilt.direction || tilt.tilt_direction || null;
        const beamSag = beam.sagMm !== undefined && beam.sagMm !== '' ? Number(beam.sagMm) : null;
        const rawRel = String(st.reliability || '').toUpperCase();
        const normReliability = ['HIGH', 'MEDIUM', 'LOW'].includes(rawRel)
          ? rawRel
          : rawRel.includes('THẤP') ? 'LOW' : rawRel.includes('TRUNG') ? 'MEDIUM' : (st.reliability ? 'HIGH' : null);

        const diffPhotosJson = Array.isArray(diff.photos) ? JSON.stringify(diff.photos) : null;
        const tiltPhotosJson = Array.isArray(tilt.photos) ? JSON.stringify(tilt.photos) : null;
        const abnPhotosJson = Array.isArray(abn.photos) ? JSON.stringify(abn.photos) : null;

        await client.query(
          `INSERT INTO deformation_assessments (
             report_id, tilt_angle_x, tilt_angle_y, tilt_direction, beam_deflection_mm,
             measurement_reliability, e3_deformation_score,
             diff_settlement_photos_json, tilt_photos_json, abnormal_photos_json
           ) VALUES (
             $1, COALESCE($2, 0.0), COALESCE($3, 0.0), $4, COALESCE($5, 0.0),
             COALESCE($6::reliability_enum, 'HIGH'), COALESCE($7, 0),
             COALESCE($8::jsonb, '[]'::jsonb), COALESCE($9::jsonb, '[]'::jsonb), COALESCE($10::jsonb, '[]'::jsonb)
           )
           ON CONFLICT (report_id) DO UPDATE SET
             tilt_angle_x = COALESCE($2, deformation_assessments.tilt_angle_x),
             tilt_angle_y = COALESCE($3, deformation_assessments.tilt_angle_y),
             tilt_direction = COALESCE($4, deformation_assessments.tilt_direction),
             beam_deflection_mm = COALESCE($5, deformation_assessments.beam_deflection_mm),
             measurement_reliability = COALESCE($6::reliability_enum, deformation_assessments.measurement_reliability),
             e3_deformation_score = COALESCE($7, deformation_assessments.e3_deformation_score),
             diff_settlement_photos_json = COALESCE($8::jsonb, deformation_assessments.diff_settlement_photos_json),
             tilt_photos_json = COALESCE($9::jsonb, deformation_assessments.tilt_photos_json),
             abnormal_photos_json = COALESCE($10::jsonb, deformation_assessments.abnormal_photos_json);`,
          [
            actualReportId,
            tiltX,
            tiltY,
            tiltDir,
            beamSag,
            normReliability,
            e3Score,
            diffPhotosJson,
            tiltPhotosJson,
            abnPhotosJson,
          ]
        );
      }

      // 4.5b. Đồng bộ bảng survey_identification_photos nếu P01..P04 (hoặc additionalPhotos của P03) được chỉnh sửa trực tiếp trong updates
      if (u.photoP01 !== undefined || u.photoP02 !== undefined || u.photoP03 !== undefined || u.photoP04 !== undefined) {
        const syncIdentItem = async (pObj: any, stdType: string) => {
          if (!pObj || typeof pObj !== 'object') return;
          const equivTypes = getEquivalentIdentPhotoTypes(stdType);
          const isNa = Boolean(pObj.notApplicable || pObj.isNotApplicable);
          const urlVal = isNa ? null : (pObj.url || pObj.rawPhotoUrl || null);
          const naReasonVal = isNa ? (pObj.naReason || 'Không áp dụng') : null;
          const updRes = await client.query(
            `UPDATE survey_identification_photos
             SET raw_photo_url = $1, annotated_photo_url = $1, is_not_applicable = $2, na_reason = $3
             WHERE report_id = $4 AND photo_type::text = ANY($5::text[]);`,
            [urlVal, isNa, naReasonVal, actualReportId, equivTypes]
          );
          if (updRes.rowCount === 0 && (urlVal || isNa)) {
            await client.query(
              `INSERT INTO survey_identification_photos (report_id, photo_type, raw_photo_url, is_not_applicable, na_reason)
               VALUES ($1, $2, $3, $4, $5);`,
              [actualReportId, equivTypes[1] || stdType, urlVal, isNa, naReasonVal]
            );
          }
        };
        if (u.photoP01) await syncIdentItem(u.photoP01, 'P01_HOUSE_NUMBER');
        if (u.photoP02) await syncIdentItem(u.photoP02, 'P02_MAIN_FACADE');
        if (u.photoP04) await syncIdentItem(u.photoP04, 'P04_CONTEXT_STREET');
        if (u.photoP03 && typeof u.photoP03 === 'object') {
          const equivP03 = getEquivalentIdentPhotoTypes('P03_SIDE_OR_REAR');
          await client.query(
            `DELETE FROM survey_identification_photos WHERE report_id = $1 AND photo_type::text = ANY($2::text[]);`,
            [actualReportId, equivP03]
          );
          const p03IsNa = Boolean(u.photoP03.notApplicable || u.photoP03.isNotApplicable);
          const p03MainUrl = p03IsNa ? null : (u.photoP03.url || null);
          if (p03MainUrl || p03IsNa) {
            await client.query(
              `INSERT INTO survey_identification_photos (report_id, photo_type, raw_photo_url, dimensions_json, is_not_applicable, na_reason)
               VALUES ($1, 'P03_SIDE_OR_REAR', $2, $3, $4, $5);`,
              [
                actualReportId,
                p03MainUrl,
                JSON.stringify({ tag: u.photoP03.tag || 'Bên hông trái' }),
                p03IsNa,
                p03IsNa ? (u.photoP03.naReason || 'Không áp dụng') : null,
              ]
            );
          }
          if (!p03IsNa && Array.isArray(u.photoP03.additionalPhotos)) {
            for (const addItem of u.photoP03.additionalPhotos) {
              const addUrl = typeof addItem === 'string' ? addItem : addItem?.url;
              const addTag = (typeof addItem === 'object' ? addItem?.tag : null) || 'Bên hông';
              if (addUrl) {
                await client.query(
                  `INSERT INTO survey_identification_photos (report_id, photo_type, raw_photo_url, dimensions_json, is_not_applicable)
                   VALUES ($1, 'P03_SIDE_OR_REAR', $2, $3, false);`,
                  [actualReportId, addUrl, JSON.stringify({ tag: addTag, isAdditional: true })]
                );
              }
            }
          }
        }
      }

      // 4.6. Đồng bộ floor_surveys, damage_zones & defect_items nếu floors hoặc damageZones thay đổi (Reconciliation & Soft-Delete)
      if (u.floors || u.damageZones) {
        const floorsToSync = Array.isArray(u.floors) && u.floors.length > 0
          ? u.floors
          : (Array.isArray(u.damageZones) && u.damageZones.length > 0 ? [{ floorName: 'Tầng trệt', zones: u.damageZones }] : []);

        if (floorsToSync.length > 0) {
          const existingZonesRes = await client.query<{ id: string; zone_code: string; floor_name: string | null; is_deleted: boolean }>(
            `SELECT id, zone_code, floor_name, is_deleted FROM damage_zones WHERE report_id = $1;`,
            [actualReportId]
          );
          const claimedZoneIds = new Set<string>();
          const resolveExistingZoneId = (rawId: any, floorName: string, code: string): string | null => {
            const idStr = rawId ? String(rawId) : '';
            if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(idStr)) {
              const byId = existingZonesRes.rows.find((r) => r.id === idStr && !claimedZoneIds.has(r.id));
              if (byId) {
                claimedZoneIds.add(byId.id);
                return byId.id;
              }
            }
            const byFloorAndCode = existingZonesRes.rows.find(
              (r) => !claimedZoneIds.has(r.id) && (r.floor_name || '') === floorName && r.zone_code === code
            );
            if (byFloorAndCode) {
              claimedZoneIds.add(byFloorAndCode.id);
              return byFloorAndCode.id;
            }
            const byCodeOnly = existingZonesRes.rows.find(
              (r) => !claimedZoneIds.has(r.id) && r.zone_code === code
            );
            if (byCodeOnly) {
              claimedZoneIds.add(byCodeOnly.id);
              return byCodeOnly.id;
            }
            return null;
          };

          const existingDefectsRes = await client.query<{ id: string; defect_code: string; zone_id: string; is_deleted: boolean }>(
            `SELECT d.id, d.defect_code, d.zone_id, d.is_deleted
             FROM defect_items d
             JOIN damage_zones z ON d.zone_id = z.id
             WHERE z.report_id = $1;`,
            [actualReportId]
          );
          const claimedDefectIds = new Set<string>();
          const resolveExistingDefectId = (rawId: any, zoneId: string, dCode: string): string | null => {
            const idStr = rawId ? String(rawId) : '';
            if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(idStr)) {
              const byId = existingDefectsRes.rows.find(
                (d) => d.id === idStr && d.zone_id === zoneId && !claimedDefectIds.has(d.id)
              );
              if (byId) {
                claimedDefectIds.add(byId.id);
                return byId.id;
              }
            }
            const byZoneAndCode = existingDefectsRes.rows.find(
              (d) => !claimedDefectIds.has(d.id) && d.zone_id === zoneId && d.defect_code === dCode
            );
            if (byZoneAndCode) {
              claimedDefectIds.add(byZoneAndCode.id);
              return byZoneAndCode.id;
            }
            return null;
          };

          const activeZoneIds = new Set<string>();
          const activeDefectIds = new Set<string>();

          const isCrackDefect = (cat?: string | null, type?: string | null): boolean => {
            const catStr = (cat || '').toLowerCase();
            const typeStr = (type || '').toLowerCase();
            const full = `${catStr} ${typeStr}`;
            if (
              full.includes('thấm dột') ||
              full.includes('ẩm mốc') ||
              full.includes('kẹt cửa') ||
              full.includes('cong vênh') ||
              full.includes('bong rộp') ||
              full.includes('bong tróc') ||
              full.includes('rỉ sét') ||
              full.includes('water_leak') ||
              full.includes('seepage')
            ) {
              return typeStr.includes('nứt') || typeStr.includes('crack');
            }
            return full.includes('nứt') || full.includes('crack') || !full.trim();
          };

          const calcDefectBurlandGrade = (wMm: number): number => {
            if (wMm <= 0.1) return 0;
            if (wMm <= 1) return 1;
            if (wMm <= 5) return 2;
            if (wMm <= 15) return 3;
            if (wMm <= 25) return 4;
            return 5;
          };

          for (let fIdx = 0; fIdx < floorsToSync.length; fIdx++) {
            const f = floorsToSync[fIdx];
            const floorNameVal = f.floorName || f.floor_name || `Tầng ${fIdx + 1}`;
            const zones = Array.isArray(f.zones) ? f.zones : [];
            const cadZonePins = Array.isArray(f.cadZonePins) ? f.cadZonePins : [];

            for (const z of zones) {
              const isZoneDeleted = Boolean(z.isDeleted || z.is_deleted);
              const compType = normalizeComponentType(z.componentType || z.customComponentType);
              const zCode = z.zoneCode || z.zone_code || 'Z-01';
              const zFloorName = z.floorName || z.floor_name || floorNameVal;

              // Đồng bộ hai chiều tọa độ ghim giữa cadZonePins và đối tượng zone z
              const matchingCadPin = cadZonePins.find((p: any) => (p.zoneCode || p.zone_code || p.label) === zCode);
              if (matchingCadPin) {
                if (z.pinX !== undefined && z.pinY !== undefined && matchingCadPin.pinX === undefined) {
                  matchingCadPin.pinX = Number(z.pinX);
                  matchingCadPin.pinY = Number(z.pinY);
                  matchingCadPin.pin_x = Number(z.pinX);
                  matchingCadPin.pin_y = Number(z.pinY);
                } else if (matchingCadPin.pinX !== undefined || matchingCadPin.pin_x !== undefined) {
                  z.pinX = Number(matchingCadPin.pinX ?? matchingCadPin.pin_x);
                  z.pinY = Number(matchingCadPin.pinY ?? matchingCadPin.pin_y);
                }
                if (isZoneDeleted) {
                  matchingCadPin.is_deleted = true;
                  matchingCadPin.isDeleted = true;
                } else {
                  delete matchingCadPin.is_deleted;
                  delete matchingCadPin.isDeleted;
                }
              } else if ((z.pinX !== undefined || z.pin_x !== undefined) && (z.pinY !== undefined || z.pin_y !== undefined)) {
                cadZonePins.push({
                  id: `pin-z-${zCode}-${fIdx}`,
                  zoneCode: zCode,
                  label: zCode,
                  pinX: Number(z.pinX ?? z.pin_x),
                  pinY: Number(z.pinY ?? z.pin_y),
                  pin_x: Number(z.pinX ?? z.pin_x),
                  pin_y: Number(z.pinY ?? z.pin_y),
                  type: 'ZONE',
                  ...(isZoneDeleted ? { is_deleted: true, isDeleted: true } : {}),
                });
              }

              const rawDefects = Array.isArray(z.defects) ? z.defects : [];
              const activeZDefects = rawDefects.filter((d: any) => !d.isDeleted && !d.is_deleted);
              const maxZDefectBurland = activeZDefects.reduce((maxG: number, d: any) => {
                if (!isCrackDefect(d.screeningCategory, d.defectType)) return maxG;
                const dGrade =
                  d.burlandGrade !== undefined && d.burlandGrade !== null
                    ? Number(d.burlandGrade)
                    : calcDefectBurlandGrade(Number(d.widthMaxMm ?? d.width_max_mm ?? d.widthMm) || 0);
                return Math.max(maxG, dGrade);
              }, 0);
              const zBurlandGrade =
                (z.burlandGrade ?? z.burland_grade) !== undefined && (z.burlandGrade ?? z.burland_grade) !== null
                  ? Math.max(Number(z.burlandGrade ?? z.burland_grade) || 0, maxZDefectBurland)
                  : maxZDefectBurland;

              const matchedZoneId = resolveExistingZoneId(z.id, zFloorName, zCode);
              let zoneId: string;

              if (matchedZoneId) {
                zoneId = matchedZoneId;
                await client.query(
                  `UPDATE damage_zones SET
                     zone_code = $1, floor_name = $2, room_name = $3, component_type = $4,
                     wall_material = $5, functional_impact_repair_needed = $6, burland_grade = $7,
                     ctx_photo_url = COALESCE(NULLIF($8, ''), ctx_photo_url), notes = $9,
                     is_deleted = $10
                   WHERE id = $11;`,
                  [
                    zCode,
                    zFloorName,
                    z.roomName || z.room_name || 'Không gian chính',
                    compType,
                    z.wallMaterial || z.wall_material || null,
                    Boolean(z.functionalImpactRepairNeeded),
                    zBurlandGrade,
                    z.ctxPhotoUrl || z.ctx_photo_url || '',
                    z.notes || null,
                    isZoneDeleted,
                    zoneId,
                  ]
                );
              } else {
                const zRes = await client.query<{ id: string }>(
                  `INSERT INTO damage_zones (
                     report_id, zone_code, floor_name, room_name, component_type,
                     wall_material, functional_impact_repair_needed, burland_grade,
                     ctx_photo_url, notes, is_deleted
                   ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                   RETURNING id;`,
                  [
                    actualReportId,
                    zCode,
                    zFloorName,
                    z.roomName || z.room_name || 'Không gian chính',
                    compType,
                    z.wallMaterial || z.wall_material || null,
                    Boolean(z.functionalImpactRepairNeeded),
                    zBurlandGrade,
                    z.ctxPhotoUrl || z.ctx_photo_url || '',
                    z.notes || null,
                    isZoneDeleted,
                  ]
                );
                zoneId = zRes.rows[0].id;
                claimedZoneIds.add(zoneId);
              }
              z.id = zoneId;
              if (!isZoneDeleted) {
                activeZoneIds.add(zoneId);
              }

              const defects = Array.isArray(z.defects) ? z.defects : [];
              if (zoneId && defects.length > 0) {
                for (const d of defects) {
                  const isDefectDeleted = Boolean(d.isDeleted || d.is_deleted) || isZoneDeleted;
                  const dCode = d.defectCode || d.defect_code || 'D-01';
                  const actState = ['A', 'S', 'U'].includes(d.activityState) ? d.activityState : 'U';
                  const primaryCuUrl = d.cuPhotos?.[0] || d.cuPhotoUrl || d.cu_photo_url || '';
                  const extraCuUrl = d.cuPhotos?.[1] || d.extraPhotoUrl || null;
                  const cuPhotosList = Array.isArray(d.cuPhotos) && d.cuPhotos.length > 0
                    ? d.cuPhotos
                    : (primaryCuUrl ? [primaryCuUrl] : []);
                  const cuPhotosJson = JSON.stringify(cuPhotosList);
                  const primaryCuCode = d.cuPhotoCodes?.[0] || d.cuPhotoCode || d.cu_photo_code || null;

                  const matchedDefectId = resolveExistingDefectId(d.id, zoneId, dCode);
                  let defectId: string;

                  if (matchedDefectId) {
                    defectId = matchedDefectId;
                    await client.query(
                      `UPDATE defect_items SET
                         defect_code = $1, pin_x = $2, pin_y = $3, screening_category = $4, defect_type = $5,
                         crack_direction = $6, width_max_mm = $7, length_mm = $8, activity_state = $9,
                         material_degradation_e4 = $10, structural_significance_e2 = $11, has_scale_card = $12,
                         is_structural_critical = $13, cu_photo_url = COALESCE(NULLIF($14, ''), cu_photo_url),
                         extra_photo_url = COALESCE($15, extra_photo_url), pin_color = $16,
                         cu_photo_code = COALESCE($17, cu_photo_code), cu_photos_json = $18,
                         is_deleted = $19
                       WHERE id = $20;`,
                      [
                        dCode,
                        Number(d.pinX ?? d.pin_x) || 0,
                        Number(d.pinY ?? d.pin_y) || 0,
                        d.screeningCategory || d.defectType || 'CRACK',
                        d.defectType || 'HAIRLINE',
                        d.crackDirection || null,
                        Number(d.widthMaxMm ?? d.width_max_mm) || 0,
                        Number(d.lengthMm ?? d.length_mm) || 0,
                        actState,
                        Number(d.materialDegradationE4) || 0,
                        Number(d.structuralSignificanceE2) || 0,
                        d.hasScaleCard ?? d.has_scale_card ?? true,
                        d.isStructuralCritical ?? false,
                        primaryCuUrl,
                        extraCuUrl,
                        d.pinColor || '#ef4444',
                        primaryCuCode,
                        cuPhotosJson,
                        isDefectDeleted,
                        defectId,
                      ]
                    );
                  } else {
                    const dRes = await client.query<{ id: string }>(
                      `INSERT INTO defect_items (
                         zone_id, defect_code, pin_x, pin_y, screening_category, defect_type,
                         crack_direction, width_max_mm, length_mm, activity_state,
                         material_degradation_e4, structural_significance_e2, has_scale_card,
                         is_structural_critical, cu_photo_url, extra_photo_url, pin_color,
                         cu_photo_code, cu_photos_json, is_deleted
                       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
                       RETURNING id;`,
                      [
                        zoneId,
                        dCode,
                        Number(d.pinX ?? d.pin_x) || 0,
                        Number(d.pinY ?? d.pin_y) || 0,
                        d.screeningCategory || d.defectType || 'CRACK',
                        d.defectType || 'HAIRLINE',
                        d.crackDirection || null,
                        Number(d.widthMaxMm ?? d.width_max_mm) || 0,
                        Number(d.lengthMm ?? d.length_mm) || 0,
                        actState,
                        Number(d.materialDegradationE4) || 0,
                        Number(d.structuralSignificanceE2) || 0,
                        d.hasScaleCard ?? d.has_scale_card ?? true,
                        d.isStructuralCritical ?? false,
                        primaryCuUrl,
                        extraCuUrl,
                        d.pinColor || '#ef4444',
                        primaryCuCode,
                        cuPhotosJson,
                        isDefectDeleted,
                      ]
                    );
                    defectId = dRes.rows[0].id;
                    claimedDefectIds.add(defectId);
                  }
                  d.id = defectId;
                  if (!isDefectDeleted) {
                    activeDefectIds.add(defectId);
                  }
                }
              }
            }
            f.cadZonePins = cadZonePins;

            // Đồng bộ cả cấu kiện chịu lực kết cấu E vào damage_zones
            const elements = Array.isArray(f.structuralElements) ? f.structuralElements : [];
            const cadElementPins = Array.isArray(f.cadElementPins) ? f.cadElementPins : [];
            for (const el of elements) {
              const isElDeleted = Boolean(el.isDeleted || el.is_deleted);
              const compType = normalizeComponentType(el.elementType || el.componentType || 'COLUMN');
              const elCode = el.elementCode || el.zone_code || el.zoneCode || 'E-01';
              const elFloorName = el.floorName || el.floor_name || floorNameVal;

              // Đồng bộ hai chiều tọa độ ghim giữa cadElementPins và đối tượng el
              const matchingElPin = cadElementPins.find((p: any) => (p.zoneCode || p.zone_code || p.elementCode || p.label) === elCode);
              if (matchingElPin) {
                if (el.pinX !== undefined && el.pinY !== undefined && matchingElPin.pinX === undefined) {
                  matchingElPin.pinX = Number(el.pinX);
                  matchingElPin.pinY = Number(el.pinY);
                  matchingElPin.pin_x = Number(el.pinX);
                  matchingElPin.pin_y = Number(el.pinY);
                } else if (matchingElPin.pinX !== undefined || matchingElPin.pin_x !== undefined) {
                  el.pinX = Number(matchingElPin.pinX ?? matchingElPin.pin_x);
                  el.pinY = Number(matchingElPin.pinY ?? matchingElPin.pin_y);
                }
                if (isElDeleted) {
                  matchingElPin.is_deleted = true;
                  matchingElPin.isDeleted = true;
                } else {
                  delete matchingElPin.is_deleted;
                  delete matchingElPin.isDeleted;
                }
              } else if ((el.pinX !== undefined || el.pin_x !== undefined) && (el.pinY !== undefined || el.pin_y !== undefined)) {
                cadElementPins.push({
                  id: `pin-e-${elCode}-${fIdx}`,
                  zoneCode: elCode,
                  elementCode: elCode,
                  label: elCode,
                  pinX: Number(el.pinX ?? el.pin_x),
                  pinY: Number(el.pinY ?? el.pin_y),
                  pin_x: Number(el.pinX ?? el.pin_x),
                  pin_y: Number(el.pinY ?? el.pin_y),
                  type: 'STRUCTURAL',
                  ...(isElDeleted ? { is_deleted: true, isDeleted: true } : {}),
                });
              }

              const rawElDefects = Array.isArray(el.defects) ? el.defects : [];
              const activeElDefects = rawElDefects.filter((d: any) => !d.isDeleted && !d.is_deleted);
              // Theo chuẩn Burland 1977 & FE Phase 1 (Step4_BurlandSummary.tsx): Cấu kiện kết cấu BTCT E-xx không tính cấp Burland
              const elBurlandGrade =
                (el.burlandGrade ?? el.burland_grade) !== undefined && (el.burlandGrade ?? el.burland_grade) !== null
                  ? Number(el.burlandGrade ?? el.burland_grade) || 0
                  : 0;

              const matchedElZoneId = resolveExistingZoneId(el.id, elFloorName, elCode);
              let elZoneId: string;

              if (matchedElZoneId) {
                elZoneId = matchedElZoneId;
                await client.query(
                  `UPDATE damage_zones SET
                     zone_code = $1, floor_name = $2, room_name = $3, component_type = $4,
                     wall_material = $5, functional_impact_repair_needed = $6, burland_grade = $7,
                     ctx_photo_url = COALESCE(NULLIF($8, ''), ctx_photo_url), notes = $9,
                     is_deleted = $10
                   WHERE id = $11;`,
                  [
                    elCode,
                    elFloorName,
                    el.roomName || 'Cấu kiện kết cấu',
                    compType,
                    el.materialType || el.wallMaterial || 'BTCT',
                    Boolean(el.hasDamage || activeElDefects.length > 0),
                    elBurlandGrade,
                    el.ctxPhotoUrl || (Array.isArray(el.overviewPhotos) ? el.overviewPhotos[0] : '') || '',
                    el.notes || null,
                    isElDeleted,
                    elZoneId,
                  ]
                );
              } else {
                const elRes = await client.query<{ id: string }>(
                  `INSERT INTO damage_zones (
                     report_id, zone_code, floor_name, room_name, component_type,
                     wall_material, functional_impact_repair_needed, burland_grade,
                     ctx_photo_url, notes, is_deleted
                   ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                   RETURNING id;`,
                  [
                    actualReportId,
                    elCode,
                    elFloorName,
                    el.roomName || 'Cấu kiện kết cấu',
                    compType,
                    el.materialType || el.wallMaterial || 'BTCT',
                    Boolean(el.hasDamage || activeElDefects.length > 0),
                    elBurlandGrade,
                    el.ctxPhotoUrl || (Array.isArray(el.overviewPhotos) ? el.overviewPhotos[0] : '') || '',
                    el.notes || null,
                    isElDeleted,
                  ]
                );
                elZoneId = elRes.rows[0].id;
                claimedZoneIds.add(elZoneId);
              }
              el.id = elZoneId;
              if (!isElDeleted) {
                activeZoneIds.add(elZoneId);
              }

              const defects = Array.isArray(el.defects) ? el.defects : [];
              if (elZoneId && defects.length > 0) {
                for (const d of defects) {
                  const isDefectDeleted = Boolean(d.isDeleted || d.is_deleted) || isElDeleted;
                  const dCode = d.defectCode || d.defect_code || 'D-01';
                  const actState = ['A', 'S', 'U'].includes(d.activityState) ? d.activityState : 'U';
                  const primaryCuUrl = d.cuPhotos?.[0] || d.cuPhotoUrl || d.cu_photo_url || '';
                  const extraCuUrl = d.cuPhotos?.[1] || d.extraPhotoUrl || null;
                  const cuPhotosList = Array.isArray(d.cuPhotos) && d.cuPhotos.length > 0
                    ? d.cuPhotos
                    : (primaryCuUrl ? [primaryCuUrl] : []);
                  const cuPhotosJson = JSON.stringify(cuPhotosList);
                  const primaryCuCode = d.cuPhotoCodes?.[0] || d.cuPhotoCode || d.cu_photo_code || null;

                  const matchedDefectId = resolveExistingDefectId(d.id, elZoneId, dCode);
                  let defectId: string;

                  if (matchedDefectId) {
                    defectId = matchedDefectId;
                    await client.query(
                      `UPDATE defect_items SET
                         defect_code = $1, pin_x = $2, pin_y = $3, screening_category = $4, defect_type = $5,
                         crack_direction = $6, width_max_mm = $7, length_mm = $8, activity_state = $9,
                         material_degradation_e4 = $10, structural_significance_e2 = $11, has_scale_card = $12,
                         is_structural_critical = $13, cu_photo_url = COALESCE(NULLIF($14, ''), cu_photo_url),
                         extra_photo_url = COALESCE($15, extra_photo_url), pin_color = $16,
                         cu_photo_code = COALESCE($17, cu_photo_code), cu_photos_json = $18,
                         is_deleted = $19
                       WHERE id = $20;`,
                      [
                        dCode,
                        Number(d.pinX ?? d.pin_x) || 0,
                        Number(d.pinY ?? d.pin_y) || 0,
                        d.screeningCategory || d.defectType || 'CRACK',
                        d.defectType || 'HAIRLINE',
                        d.crackDirection || null,
                        Number(d.widthMaxMm ?? d.width_max_mm) || 0,
                        Number(d.lengthMm ?? d.length_mm) || 0,
                        actState,
                        Number(d.materialDegradationE4) || 0,
                        Number(d.structuralSignificanceE2) || 0,
                        d.hasScaleCard ?? d.has_scale_card ?? true,
                        d.isStructuralCritical ?? false,
                        primaryCuUrl,
                        extraCuUrl,
                        d.pinColor || '#ef4444',
                        primaryCuCode,
                        cuPhotosJson,
                        isDefectDeleted,
                        defectId,
                      ]
                    );
                  } else {
                    const dRes = await client.query<{ id: string }>(
                      `INSERT INTO defect_items (
                         zone_id, defect_code, pin_x, pin_y, screening_category, defect_type,
                         crack_direction, width_max_mm, length_mm, activity_state,
                         material_degradation_e4, structural_significance_e2, has_scale_card,
                         is_structural_critical, cu_photo_url, extra_photo_url, pin_color,
                         cu_photo_code, cu_photos_json, is_deleted
                       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
                       RETURNING id;`,
                      [
                        elZoneId,
                        dCode,
                        Number(d.pinX ?? d.pin_x) || 0,
                        Number(d.pinY ?? d.pin_y) || 0,
                        d.screeningCategory || d.defectType || 'CRACK',
                        d.defectType || 'HAIRLINE',
                        d.crackDirection || null,
                        Number(d.widthMaxMm ?? d.width_max_mm) || 0,
                        Number(d.lengthMm ?? d.length_mm) || 0,
                        actState,
                        Number(d.materialDegradationE4) || 0,
                        Number(d.structuralSignificanceE2) || 0,
                        d.hasScaleCard ?? d.has_scale_card ?? true,
                        d.isStructuralCritical ?? false,
                        primaryCuUrl,
                        extraCuUrl,
                        d.pinColor || '#ef4444',
                        primaryCuCode,
                        cuPhotosJson,
                        isDefectDeleted,
                      ]
                    );
                    defectId = dRes.rows[0].id;
                    claimedDefectIds.add(defectId);
                  }
                  d.id = defectId;
                  if (!isDefectDeleted) {
                    activeDefectIds.add(defectId);
                  }
                }
              }
            }
            f.cadElementPins = cadElementPins;
          }

          // Đồng bộ bảng SQL floor_surveys khi có danh sách tầng (u.floors)
          if (Array.isArray(u.floors) && u.floors.length > 0) {
            await client.query(`DELETE FROM floor_surveys WHERE report_id = $1;`, [actualReportId]);
            for (let i = 0; i < u.floors.length; i++) {
              const fl = u.floors[i];
              await client.query(
                `INSERT INTO floor_surveys (
                   report_id, floor_name, floor_order, overview_photos_json,
                   cad_drawing_url, cad_zone_pins_json, cad_structural_drawing_url, cad_element_pins_json, notes
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
                [
                  actualReportId,
                  fl.floorName || fl.floor_name || `Tầng ${i + 1}`,
                  i + 1,
                  JSON.stringify(fl.overviewPhotos || []),
                  fl.cadDrawingUrl || fl.cadSketchPhotoUrl || fl.cad_drawing_url || null,
                  JSON.stringify(fl.cadZonePins || []),
                  fl.cadStructuralDrawingUrl || fl.cadStructuralSketchPhotoUrl || fl.cad_structural_drawing_url || null,
                  JSON.stringify(fl.cadElementPins || []),
                  fl.notes || null,
                ]
              );
            }
            mergedJson.floors = u.floors;
            mergedJson.damageZones = u.floors.flatMap((fl: any) =>
              (Array.isArray(fl.zones) ? fl.zones : []).map((z: any) => ({
                ...z,
                floorName: z.floorName || fl.floorName,
              }))
            );
          } else if (Array.isArray(u.damageZones)) {
            mergedJson.damageZones = u.damageZones;
          }

          // Cập nhật lại survey_data_json với các UUID và tọa độ ghim đã chuẩn hóa
          await client.query(
            `UPDATE base_survey_reports SET survey_data_json = $1, updated_at = NOW() WHERE id = $2;`,
            [JSON.stringify(mergedJson), actualReportId]
          );

          // Xóa mềm các zone và defect không còn xuất hiện trong payload
          if (activeZoneIds.size > 0) {
            await client.query(
              `UPDATE damage_zones SET is_deleted = true
               WHERE report_id = $1 AND NOT (id = ANY($2::uuid[]));`,
              [actualReportId, Array.from(activeZoneIds)]
            );
          } else {
            await client.query(
              `UPDATE damage_zones SET is_deleted = true
               WHERE report_id = $1;`,
              [actualReportId]
            );
          }

          if (activeDefectIds.size > 0) {
            await client.query(
              `UPDATE defect_items SET is_deleted = true
               WHERE zone_id IN (SELECT id FROM damage_zones WHERE report_id = $1)
                 AND NOT (id = ANY($2::uuid[]));`,
              [actualReportId, Array.from(activeDefectIds)]
            );
          } else {
            await client.query(
              `UPDATE defect_items SET is_deleted = true
               WHERE zone_id IN (SELECT id FROM damage_zones WHERE report_id = $1);`,
              [actualReportId]
            );
          }

          // Đảm bảo mọi defect thuộc zone bị xóa mềm cũng được đánh dấu is_deleted = true
          await client.query(
            `UPDATE defect_items SET is_deleted = true
             WHERE zone_id IN (SELECT id FROM damage_zones WHERE report_id = $1 AND is_deleted = true);`,
            [actualReportId]
          );
        }
      }

      // 4.7. Xử lý các thao tác hình ảnh (Thêm, Xóa, Thay thế) nếu có trong payload Diff
      if (Array.isArray(payload.photoActions) && payload.photoActions.length > 0) {
        for (const pa of payload.photoActions) {
          await AuditModificationService.applySinglePhotoActionInTx(
            client,
            actualReportId,
            report.parcel_id,
            adminId,
            mergedJson,
            pa
          );
        }
        // Cập nhật lại survey_data_json sau khi photoActions cập nhật các mảng ảnh trong mergedJson
        await client.query(
          `UPDATE base_survey_reports SET survey_data_json = $1, updated_at = NOW() WHERE id = $2;`,
          [JSON.stringify(mergedJson), actualReportId]
        );
      }

      await client.query(
        `INSERT INTO system_audit_logs (
           entity_type, entity_id, action, performed_by_user_id, diff_payload, client_ip
         ) VALUES ($1, $2, $3, $4, $5, $6);`,
        [
          'BASE_SURVEY_REPORT',
          actualReportId,
          'ZONE_ADMIN_SURVEY_EDIT',
          adminId,
          JSON.stringify({
            editReason: payload.editReason,
            diff: payload.diffPayload,
            photoActionsCount: payload.photoActions?.length || 0,
            timestamp: new Date().toISOString(),
            verification: 'PASSWORD_VERIFIED',
          }),
          clientIp || null,
        ]
      );

      return {
        success: true,
        reportId: actualReportId,
        message: 'Đã lưu chỉnh sửa và ghi nhận vào Nhật ký kiểm toán thành công',
      };
    });

    // 4.7. Tự động kích hoạt tính lại toàn bộ điểm rủi ro (Raw Scores) theo Ground Truth mới SAU KHI commit
    // và đồng bộ các chỉnh sửa trực tiếp ở Bước 7 (ecs / vi) vào risk_score_cards & survey_data_json
    try {
      const { ScoringService } = await import('../../scoring/scoring.service');
      const calcRes = await ScoringService.calculatePhase1Scores(actualReportId);
      const calcScores = calcRes?.scores;

      const uObj = (payload.updates && typeof payload.updates === 'object') ? payload.updates : {};
      const uEcs = (uObj.ecs && typeof uObj.ecs === 'object') ? uObj.ecs : null;
      const uVi = (uObj.vi && typeof uObj.vi === 'object') ? uObj.vi : null;

      const curEcs = (mergedJson.ecs && typeof mergedJson.ecs === 'object') ? mergedJson.ecs : {};
      const curVi = (mergedJson.vi && typeof mergedJson.vi === 'object') ? mergedJson.vi : {};

      const hasEcsInputUpdate =
        curEcs.e1 === undefined ||
        ['floors', 'damageZones', 'burlandSummary', 'settlementTilt', 'deformation', 'historyInterview', 'operationalDefects'].some(
          (k) => uObj[k] !== undefined
        );
      const hasViInputUpdate =
        hasEcsInputUpdate ||
        curVi.v1 === undefined ||
        ['usageFunction', 'surveyCaseType', 'isVacantLand', 'objectGroup', 'structureSystem', 'foundationCatScore', 'constructionYear'].some(
          (k) => uObj[k] !== undefined
        );

      const e1 = uEcs?.e1 !== undefined ? Number(uEcs.e1) : (hasEcsInputUpdate ? (calcScores?.e1Burland ?? Number(curEcs.e1 ?? 0)) : Number(curEcs.e1 ?? calcScores?.e1Burland ?? 0));
      const e2 = uEcs?.e2 !== undefined ? Number(uEcs.e2) : (hasEcsInputUpdate ? (calcScores?.e2Structure ?? Number(curEcs.e2 ?? 0)) : Number(curEcs.e2 ?? calcScores?.e2Structure ?? 0));
      const e3 = uEcs?.e3 !== undefined ? Number(uEcs.e3) : (hasEcsInputUpdate ? (calcScores?.e3Deformation ?? Number(curEcs.e3 ?? 0)) : Number(curEcs.e3 ?? calcScores?.e3Deformation ?? 0));
      const e4 = uEcs?.e4 !== undefined ? Number(uEcs.e4) : (hasEcsInputUpdate ? (calcScores?.e4Material ?? Number(curEcs.e4 ?? 0)) : Number(curEcs.e4 ?? calcScores?.e4Material ?? 0));
      const e5 = uEcs?.e5 !== undefined ? Number(uEcs.e5) : (hasEcsInputUpdate ? (calcScores?.e5History ?? Number(curEcs.e5 ?? 0)) : Number(curEcs.e5 ?? calcScores?.e5History ?? 0));
      const e6 = uEcs?.e6 !== undefined ? Number(uEcs.e6) : (hasEcsInputUpdate ? (calcScores?.e6Function ?? Number(curEcs.e6 ?? 0)) : Number(curEcs.e6 ?? calcScores?.e6Function ?? 0));
      const totalEcs = uEcs?.totalEcs !== undefined ? Number(uEcs.totalEcs) : (e1 + e2 + e3 + e4 + e5 + e6);
      const ecsClass: 'GOOD' | 'MEDIUM' | 'DEFICIENT' | 'CRITICAL' =
        totalEcs <= 5 ? 'GOOD' : totalEcs <= 10 ? 'MEDIUM' : totalEcs <= 16 ? 'DEFICIENT' : 'CRITICAL';

      const v1 = uVi?.v1 !== undefined ? Number(uVi.v1) : (hasViInputUpdate ? (calcScores?.v1 ?? Number(curVi.v1 ?? 2)) : Number(curVi.v1 ?? calcScores?.v1 ?? 2));
      const v2 = uVi?.v2 !== undefined ? Number(uVi.v2) : (hasViInputUpdate ? (calcScores?.v2 ?? Number(curVi.v2 ?? 2)) : Number(curVi.v2 ?? calcScores?.v2 ?? 2));
      const v3 = uVi?.v3 !== undefined ? Number(uVi.v3) : (hasViInputUpdate ? (calcScores?.v3 ?? (curVi.v3 !== undefined ? Number(curVi.v3) : null)) : (curVi.v3 !== undefined ? Number(curVi.v3) : (calcScores?.v3 ?? null)));
      const v4 = uVi?.v4 !== undefined ? Number(uVi.v4) : (hasViInputUpdate ? (calcScores?.v4 ?? (curVi.v4 !== undefined ? Number(curVi.v4) : null)) : (curVi.v4 !== undefined ? Number(curVi.v4) : (calcScores?.v4 ?? null)));
      const v5 = uVi?.v5 !== undefined ? Number(uVi.v5) : (ecsClass === 'CRITICAL' ? 4 : ecsClass === 'DEFICIENT' ? 3 : ecsClass === 'MEDIUM' ? 2 : 1);
      const v6 = uVi?.v6 !== undefined ? Number(uVi.v6) : (hasViInputUpdate ? (calcScores?.v6 ?? Number(curVi.v6 ?? 1)) : Number(curVi.v6 ?? calcScores?.v6 ?? 1));

      const hasAllV = v3 !== null && v4 !== null && Number.isFinite(v3) && Number.isFinite(v4);
      const totalVi = hasAllV ? (v1 + v2 + Number(v3) + Number(v4) + v5 + v6) : null;
      const avgVi = totalVi !== null ? Number((totalVi / 6).toFixed(2)) : null;
      const viClass = avgVi === null ? null : (avgVi > 3.25 ? 'VERY_HIGH' : avgVi > 2.5 ? 'HIGH' : avgVi > 1.5 ? 'MEDIUM' : 'LOW');

      // Đồng bộ chỉnh sửa Impact (I1..I4) và BRA (LOW/MEDIUM/HIGH/VERY_HIGH) từ Bước 8 (executiveSummary)
      const uExec = (payload.updates?.executiveSummary && typeof payload.updates.executiveSummary === 'object')
        ? payload.updates.executiveSummary
        : null;
      const rawExecImpact = String(uExec?.constructionImpactStatus || mergedJson.executiveSummary?.constructionImpactStatus || '').toUpperCase();
      const execImpactMatch = rawExecImpact.match(/\b(I[1-4])\b/);
      const explicitICode = execImpactMatch ? execImpactMatch[1] : null;
      if (uExec?.constructionImpactStatus && explicitICode) {
        mergedJson.impactAssessment = {
          ...(mergedJson.impactAssessment && typeof mergedJson.impactAssessment === 'object' ? mergedJson.impactAssessment : {}),
          iCode: explicitICode,
          code: explicitICode,
        };
      }

      const rawExecBra = String(uExec?.braStatus || '').toUpperCase();
      let explicitBraPair: { code: string; vi: string; en: string } | null = null;
      if (rawExecBra === 'LOW' || rawExecBra === 'VERY_LOW') {
        explicitBraPair = { code: 'LOW', vi: 'Rủi ro thấp', en: 'Low Risk' };
      } else if (rawExecBra === 'MEDIUM' || rawExecBra === 'MODERATE') {
        explicitBraPair = { code: 'MEDIUM', vi: 'Rủi ro trung bình', en: 'Medium Risk' };
      } else if (rawExecBra === 'HIGH') {
        explicitBraPair = { code: 'HIGH', vi: 'Rủi ro cao', en: 'High Risk' };
      } else if (rawExecBra === 'VERY_HIGH' || rawExecBra === 'CRITICAL') {
        explicitBraPair = { code: 'VERY_HIGH', vi: 'Rủi ro rất cao', en: 'Very High Risk' };
      }

      if (explicitBraPair) {
        mergedJson.braAssessment = {
          ...(mergedJson.braAssessment && typeof mergedJson.braAssessment === 'object' ? mergedJson.braAssessment : {}),
          finalRiskLevelVi: explicitBraPair.vi,
          finalRiskLevelEn: explicitBraPair.en,
          riskLevelVi: explicitBraPair.vi,
          riskLevelEn: explicitBraPair.en,
          braStatus: explicitBraPair.code,
        };
      } else if (uVi || uEcs) {
        // Nếu chỉ sửa điểm thành phần ở Bước 7 mà không ép cứng BRA ở Bước 8, xóa cache braAssessment cũ để tính lại theo ma trận V × I
        delete mergedJson.braAssessment;
        if (mergedJson.executiveSummary && typeof mergedJson.executiveSummary === 'object') {
          delete mergedJson.executiveSummary.braStatus;
        }
      }

      const explicitImpactNum = explicitICode ? Number(explicitICode.replace('I', '')) : null;

      await Database.query(
        `UPDATE risk_score_cards SET
           e1_burland_score = $2,
           e2_structure_score = $3,
           e3_deformation_score = $4,
           e4_material_score = $5,
           e5_history_score = $6,
           e6_overall_function_score = $7,
           total_ecs_score = $8,
           ecs_class = $9,
           v1_importance_score = $10,
           v2_structure_score = $11,
           v3_foundation_score = $12,
           v4_age_score = $13,
           v5_ecs_score = $14,
           v6_sensitivity_score = $15,
           avg_vi_score = $16,
           vi_class = $17,
           overridden_impact_level_i = COALESCE($18, overridden_impact_level_i),
           overridden_bra = COALESCE($19, overridden_bra)
         WHERE report_id = $1;`,
        [
          actualReportId,
          e1, e2, e3, e4, e5, e6,
          totalEcs, ecsClass,
          v1, v2, v3, v4, v5, v6,
          avgVi, viClass,
          explicitImpactNum,
          explicitBraPair?.code || null,
        ]
      );

      mergedJson.ecs = {
        ...curEcs,
        e1, e2, e3, e4, e5, e6,
        totalEcs,
        ecsClass,
      };
      mergedJson.vi = {
        ...curVi,
        v1, v2, v3, v4, v5, v6,
        ...(totalVi !== null ? { totalVi } : {}),
        ...(avgVi !== null ? { viAvg: avgVi, avgVi } : {}),
        ...(viClass !== null ? { viClass } : {}),
      };
      await Database.query(
        `UPDATE base_survey_reports SET survey_data_json = $1 WHERE id = $2;`,
        [JSON.stringify(mergedJson), actualReportId]
      );

      // Kiểm tra nếu hồ sơ đã có phán quyết kỹ sư trưởng (Engineering Judgement)
      const judgementCheck = await Database.query<{
        is_engineering_judgement_applied: boolean;
        engineering_judgement_action: string;
      }>(
        `SELECT is_engineering_judgement_applied, engineering_judgement_action FROM risk_score_cards WHERE report_id = $1;`,
        [actualReportId]
      );
      if (judgementCheck.rows[0]?.is_engineering_judgement_applied) {
        await Database.query(
          `INSERT INTO system_audit_logs (
             entity_type, entity_id, action, performed_by_user_id, diff_payload
           ) VALUES ($1, $2, $3, $4, $5);`,
          [
            'BASE_SURVEY_REPORT',
            actualReportId,
            'RAW_SCORES_CHANGED_AFTER_JUDGEMENT',
            adminId,
            JSON.stringify({
              reportId: actualReportId,
              message: 'Dữ liệu đo đạc hiện trường đã thay đổi sau khi Kỹ sư trưởng đưa ra phán quyết can thiệp điểm. Cần xem xét lại nếu cần thiết.',
              timestamp: new Date().toISOString(),
            }),
          ]
        );
      }
    } catch (scoreErr) {
      console.error('[applyAdminSurveyEdit] Lỗi khi tự động tính lại điểm số:', scoreErr);
    }

    // Tự động tạo bản chụp Snapshot bất biến cho phiên bản chỉnh sửa Diff
    try {
      const { AuditVersionService } = await import('./audit-version.service');
      await AuditVersionService.createSnapshot(actualReportId, {
        versionTag: 'ADMIN_DIFF_SAVE',
        title: `Chỉnh sửa thông số hồ sơ (${payload.diffPayload?.length || 0} mục thay đổi${payload.photoActions?.length ? `, ${payload.photoActions.length} thao tác ảnh` : ''})`,
        editReason: payload.editReason,
        userId: adminId,
        clientIp,
        diffSummary: payload.diffPayload,
      });
    } catch (snapErr) {
      console.error('[applyAdminSurveyEdit] Không thể tạo snapshot phiên bản:', snapErr);
    }

    return txResult;
  }

  /**
   * Lưu các thay đổi thẩm định staged (theo UC-03 & UC-08 test suite)
   * Tự động xác thực Gatekeeper CAT 1/2, lưu các trường thay đổi, thực thi photo actions và tạo Snapshot v(n+1)
   */
  static async saveStagedModifications(
    reportId: string,
    adminId: string,
    params: {
      editReason: string;
      adminPassword?: string;
      fieldChanges?: Array<{ fieldKey: string; fieldLabel?: string; oldValue?: any; newValue: any }>;
      stagedPhotoActions?: Array<{
        category: string;
        action: 'ADD' | 'DELETE' | 'REPLACE' | 'RESTORE';
        photoType?: string;
        photoUrl?: string;
        photoTitle?: string;
        targetPhotoId?: string;
        editReason?: string;
        reason?: string;
        caption?: string;
      }>;
      customSnapshotData?: any;
    },
    clientIp?: string
  ): Promise<{ success: boolean; versionNumber: number; snapshotId: string }> {
    // 1. Kiểm tra hồ sơ tồn tại
    const repRes = await Database.query<{ id: string; parcel_id: string; status: string; survey_data_json: any }>(
      `SELECT id, parcel_id, status, survey_data_json FROM base_survey_reports WHERE (id = $1 OR parcel_id = $1) LIMIT 1;`,
      [reportId]
    );
    if (!repRes.rows[0]) {
      throw new NotFoundError(`Không tìm thấy hồ sơ khảo sát với ID: ${reportId}`);
    }
    const report = repRes.rows[0];
    const actualReportId = report.id;
    const parcelId = report.parcel_id;

    // 2. Gatekeeper: Kiểm tra ràng buộc bản vẽ hoàn công với CAT 1/CAT 2
    let targetCatScore: any = undefined;
    for (const fc of params.fieldChanges || []) {
      if (
        fc.fieldKey === 'foundationCatScore' ||
        fc.fieldKey === 'buildingSpecs.foundation_cat_score' ||
        fc.fieldKey === 'specs.foundationCatScore'
      ) {
        targetCatScore = fc.newValue;
      }
    }

    if (targetCatScore === undefined) {
      // Check existing in DB
      const curSpec = await Database.query<{ foundation_category: string | null }>(
        `SELECT foundation_category FROM building_specifications WHERE report_id = $1;`,
        [actualReportId]
      );
      const catEnum = curSpec.rows[0]?.foundation_category;
      if (catEnum) {
        targetCatScore = catEnum.startsWith('CAT_1') ? 1 :
          catEnum.startsWith('CAT_2') ? 2 :
          catEnum.startsWith('CAT_3') ? 3 :
          catEnum.startsWith('CAT_4') ? 4 : 5;
      }
    }

    if (targetCatScore === 1 || targetCatScore === 2 || targetCatScore === '1' || targetCatScore === '2') {
      const specRes = await Database.query<{ as_built_drawing_photos_json: any }>(
        `SELECT as_built_drawing_photos_json FROM building_specifications WHERE report_id = $1;`,
        [actualReportId]
      );
      const existingDrawings = Array.isArray(specRes.rows[0]?.as_built_drawing_photos_json)
        ? specRes.rows[0].as_built_drawing_photos_json.filter((d: any) => !d.isDeleted && !d.is_deleted && (d.url || d.photoUrl))
        : [];

      const newDrawings = (params.stagedPhotoActions || []).filter(
        (pa) => (pa.category === 'AS_BUILT' || pa.photoType === 'AS_BUILT_DRAWING') && pa.action !== 'DELETE'
      );
      const deletedDrawings = (params.stagedPhotoActions || []).filter(
        (pa) => (pa.category === 'AS_BUILT' || pa.photoType === 'AS_BUILT_DRAWING') && pa.action === 'DELETE'
      );

      const totalDrawings = existingDrawings.length + newDrawings.length - deletedDrawings.length;
      if (totalDrawings <= 0) {
        throw new BadRequestError('Hồ sơ đang phân loại CAT 1/CAT 2 bắt buộc phải đính kèm ít nhất 1 bản vẽ hoàn công!');
      }
    }

    // 3. Thực thi lưu trữ trong Transaction
    const existingJson = typeof report.survey_data_json === 'string'
      ? JSON.parse(report.survey_data_json)
      : (report.survey_data_json || {});

    const diffPayload: any[] = [];
    const updates: Record<string, any> = {};

    for (const fc of params.fieldChanges || []) {
      diffPayload.push({
        field: fc.fieldKey,
        label: fc.fieldLabel || fc.fieldKey,
        oldValue: fc.oldValue ?? null,
        newValue: fc.newValue,
      });

      if (fc.fieldKey === 'foundationCatScore') {
        updates['foundationCatScore'] = fc.newValue;
        updates['buildingSpecs.foundation_cat_score'] = fc.newValue;
      } else if (fc.fieldKey.startsWith('buildingSpecs.')) {
        const sub = fc.fieldKey.replace('buildingSpecs.', '');
        if (!updates.buildingSpecs) updates.buildingSpecs = {};
        updates.buildingSpecs[sub] = fc.newValue;
        updates[fc.fieldKey] = fc.newValue;
      } else {
        updates[fc.fieldKey] = fc.newValue;
      }
    }

    const mergedJson = {
      ...existingJson,
      ...updates,
      _lastAdminEdit: {
        adminId,
        timestamp: new Date().toISOString(),
        reason: params.editReason,
        diffCount: diffPayload.length,
      },
    };

    // 3.0. Tự động khởi tạo phiên bản cơ sở v0 (ORIGINAL_SUBMISSION) TRƯỚC KHI ghi đè dữ liệu chỉnh sửa lần đầu
    try {
      const verCountRes = await Database.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM survey_report_versions WHERE report_id = $1;`,
        [actualReportId]
      );
      if (Number(verCountRes.rows[0]?.count || 0) === 0) {
        const { AuditVersionService } = await import('./audit-version.service');
        const repInfo = await Database.query<{ surveyor_id: string }>(
          `SELECT surveyor_id FROM base_survey_reports WHERE id = $1;`,
          [actualReportId]
        );
        await AuditVersionService.createSnapshot(actualReportId, {
          versionTag: 'ORIGINAL_SUBMISSION',
          title: 'Bản nộp thực địa ban đầu',
          editReason: 'Khởi tạo phiên bản cơ sở tự động trước khi chỉnh sửa thẩm định lần đầu (Auto-Seed Baseline v0)',
          userId: repInfo.rows[0]?.surveyor_id,
        });
      }
    } catch (seedV0Err: any) {
      console.warn('[saveStagedModifications] Không thể tự động khởi tạo v0 trước chỉnh sửa:', seedV0Err?.message);
    }

    await Database.transaction(async (client) => {
      // 3.1. Cập nhật base_survey_reports
      await client.query(
        `UPDATE base_survey_reports SET survey_data_json = $1, updated_at = NOW() WHERE id = $2;`,
        [JSON.stringify(mergedJson), actualReportId]
      );

      // 3.2. Cập nhật building_specifications nếu có
      for (const fc of params.fieldChanges || []) {
        if (fc.fieldKey === 'foundationCatScore' || fc.fieldKey === 'buildingSpecs.foundation_cat_score') {
          const catNum = Number(fc.newValue);
          const catEnum =
            catNum === 1 ? 'CAT_1_MONG_NONG_GIA_CO' :
            catNum === 2 ? 'CAT_2_MONG_DON_BTCT' :
            catNum === 3 ? 'CAT_3_MONG_BANG_BTCT' :
            catNum === 4 ? 'CAT_4_MONG_COC_BTCT' : 'CAT_5_KHONG_XAC_DINH';
          await client.query(
            `UPDATE building_specifications SET foundation_category = $1::foundation_category_enum WHERE report_id = $2;`,
            [catEnum, actualReportId]
          );
        } else if (fc.fieldKey === 'buildingSpecs.floor_count') {
          await client.query(
            `UPDATE building_specifications SET floor_count = $1 WHERE report_id = $2;`,
            [Number(fc.newValue), actualReportId]
          );
        }
      }

      // 3.3. Cập nhật thông tin thửa đất và chủ hộ vào bảng parcels nếu có
      const parcelUpdates: Record<string, any> = {};
      for (const fc of params.fieldChanges || []) {
        if (fc.fieldKey === 'ownerName') parcelUpdates.owner_name = fc.newValue;
        if (fc.fieldKey === 'houseNumber') parcelUpdates.house_number = fc.newValue;
        if (fc.fieldKey === 'street') parcelUpdates.street = fc.newValue;
        if (fc.fieldKey === 'ward') parcelUpdates.ward = fc.newValue;
        if (fc.fieldKey === 'district') parcelUpdates.district = fc.newValue;
        if (fc.fieldKey === 'ownerPhone') parcelUpdates.owner_phone = fc.newValue;
        if (fc.fieldKey === 'officialCadastralCode') parcelUpdates.official_cadastral_code = fc.newValue;
        if (fc.fieldKey === 'frontageWidth') parcelUpdates.frontage_width = Number(fc.newValue);
        if (fc.fieldKey === 'lotDepth') parcelUpdates.lot_depth = Number(fc.newValue);
        if (fc.fieldKey === 'landAreaM2') parcelUpdates.land_area_m2 = Number(fc.newValue);
        if (fc.fieldKey === 'constructionAreaM2') parcelUpdates.construction_area_m2 = Number(fc.newValue);
        if (fc.fieldKey === 'floorCount' || fc.fieldKey === 'aboveFloors') parcelUpdates.floor_count = Number(fc.newValue);
      }

      if (Object.keys(parcelUpdates).length > 0) {
        const setClauses: string[] = [];
        const values: any[] = [];
        let pIdx = 1;
        for (const [col, val] of Object.entries(parcelUpdates)) {
          setClauses.push(`${col} = $${pIdx++}`);
          values.push(val);
        }
        setClauses.push('updated_at = NOW()');
        values.push(parcelId);
        await client.query(
          `UPDATE parcels SET ${setClauses.join(', ')} WHERE id = $${pIdx};`,
          values
        );
      }

      // 3.4. Thực thi photo actions
      for (const pa of params.stagedPhotoActions || []) {
        const photoItem: PhotoActionItem = {
          action: pa.action,
          category: pa.category as any,
          targetPhotoType: pa.photoType,
          newPhotoUrl: pa.photoUrl,
          oldPhotoUrl: undefined,
          targetPhotoId: pa.targetPhotoId,
          caption: pa.photoTitle || pa.caption,
          reason: pa.editReason || pa.reason || params.editReason,
        };
        await AuditModificationService.applySinglePhotoActionInTx(
          client,
          actualReportId,
          parcelId,
          adminId,
          mergedJson,
          photoItem
        );
      }
    });

    // 4. Tạo snapshot bất biến v(n+1)
    const { AuditVersionService } = await import('./audit-version.service');
    const snapResult = await AuditVersionService.createSnapshot(actualReportId, {
      versionTag: 'ADMIN_DIFF_SAVE',
      title: params.editReason,
      editReason: params.editReason,
      userId: adminId,
      clientIp: clientIp || '127.0.0.1',
      diffSummary: diffPayload,
      customSnapshotData: params.customSnapshotData,
    });

    return {
      success: true,
      versionNumber: snapResult.versionNumber,
      snapshotId: snapResult.id,
    };
  }

  /**
   * Thay thế một bức ảnh hiện trường bằng mã 6 số ngẫu nhiên
   */
  static async replaceReportPhoto(
    reportId: string,
    adminId: string,
    payload: {
      targetPhotoType: string;
      targetPhotoId?: string;
      defectId?: string;
      zoneId?: string;
      photoIndex?: number;
      newPhotoUrl: string;
      clientPin: string;
      replacementReason: string;
    },
    clientIp?: string
  ) {
    if (!payload.clientPin || payload.clientPin.length !== 6) {
      throw new BadRequestError('Mã xác thực bảo mật phải đúng 6 chữ số.');
    }
    if (!payload.newPhotoUrl || !payload.newPhotoUrl.trim()) {
      throw new BadRequestError('Vui lòng chọn ảnh mới để thay thế.');
    }

    const reportRes = await Database.query<{
      id: string;
      parcel_id: string;
      status: string;
      survey_data_json: any;
    }>(
      `SELECT id, parcel_id, status, survey_data_json FROM base_survey_reports WHERE (id = $1 OR parcel_id = $1) LIMIT 1;`,
      [reportId]
    );
    if (!reportRes.rows[0]) {
      throw new NotFoundError(`Không tìm thấy hồ sơ khảo sát với ID: ${reportId}`);
    }
    const report = reportRes.rows[0];
    if (report.status === 'APPROVED') {
      throw new ForbiddenError('Hồ sơ khảo sát này đã được phê duyệt chính thức và bị khóa bất biến, không thể thay thế ảnh.');
    }

    const actualReportId = report.id;
    let oldPhotoUrl = '';

    const txResult = await Database.transaction(async (client) => {
      if ((payload.targetPhotoType === 'DEFECT_CU' || payload.targetPhotoType === 'DEFECT_CLOSEUP') && (payload.defectId || payload.targetPhotoId)) {
        const dRes = await client.query(
          `SELECT d.id, d.cu_photo_url, d.cu_photos_json 
           FROM defect_items d
           JOIN damage_zones z ON d.zone_id = z.id
           WHERE z.report_id = $3 AND (d.id::text = $1 OR d.defect_code = $2);`,
          [payload.defectId || null, payload.targetPhotoId || null, actualReportId]
        );
        if (!dRes.rows[0]) {
          throw new NotFoundError('Không tìm thấy khuyết tật tương ứng trong hồ sơ này');
        }
        const dItem = dRes.rows[0];
        oldPhotoUrl = dItem.cu_photo_url;
        const photos = Array.isArray(dItem.cu_photos_json) ? dItem.cu_photos_json : [];
        const idx = Number(payload.photoIndex) || 0;
        if (photos.length > idx) {
          photos[idx] = payload.newPhotoUrl;
        } else {
          photos.push(payload.newPhotoUrl);
        }
        await client.query(
          `UPDATE defect_items 
           SET cu_photo_url = $1, cu_photos_json = $2 
           WHERE id = $3;`,
          [payload.photoIndex === 0 || !dItem.cu_photo_url ? payload.newPhotoUrl : dItem.cu_photo_url, JSON.stringify(photos), dItem.id]
        );
      } else if (payload.targetPhotoType === 'ZONE_CTX' && (payload.zoneId || payload.targetPhotoId)) {
        const zRes = await client.query(
          `SELECT id, ctx_photo_url FROM damage_zones WHERE report_id = $3 AND (id::text = $1 OR zone_code = $2);`,
          [payload.zoneId || null, payload.targetPhotoId || null, actualReportId]
        );
        if (!zRes.rows[0]) {
          throw new NotFoundError('Không tìm thấy vùng hư hại tương ứng trong hồ sơ này');
        }
        oldPhotoUrl = zRes.rows[0].ctx_photo_url;
        await client.query(
          `UPDATE damage_zones SET ctx_photo_url = $1 WHERE id = $2;`,
          [payload.newPhotoUrl, zRes.rows[0].id]
        );
      } else if (payload.targetPhotoType === 'FLOOR_CAD' || payload.targetPhotoType === 'FLOOR_PLAN') {
        const fRes = await client.query(
          `SELECT id, cad_photo_url FROM building_floor_plans WHERE id::text = $1 OR (parcel_id = $2 AND floor_number = $3::numeric) LIMIT 1;`,
          [payload.targetPhotoId || null, report.parcel_id, Number(payload.photoIndex) || 1]
        );
        if (fRes.rows[0]) {
          oldPhotoUrl = fRes.rows[0].cad_photo_url;
          await client.query(
            `UPDATE building_floor_plans SET cad_photo_url = $1, updated_at = NOW() WHERE id = $2;`,
            [payload.newPhotoUrl, fRes.rows[0].id]
          );
        }
      } else {
        const sData = typeof report.survey_data_json === 'string'
          ? JSON.parse(report.survey_data_json)
          : (report.survey_data_json || {});
        if (payload.targetPhotoId) {
          oldPhotoUrl = getDeepProp(sData, payload.targetPhotoId) || sData[payload.targetPhotoId] || '';
          setDeepProp(sData, payload.targetPhotoId, payload.newPhotoUrl);
          await client.query(
            `UPDATE base_survey_reports SET survey_data_json = $1 WHERE id = $2;`,
            [JSON.stringify(sData), actualReportId]
          );
        }

        // Đồng bộ chữ ký nếu là trường chữ ký KSV hoặc chủ nhà
        if (payload.targetPhotoType === 'SIGNATURE_SURVEYOR' || payload.targetPhotoId?.toLowerCase().includes('surveyor')) {
          await client.query(
            `UPDATE base_survey_reports SET surveyor_signature_url = $1 WHERE id = $2;`,
            [payload.newPhotoUrl, actualReportId]
          );
        } else if (payload.targetPhotoType === 'SIGNATURE_OWNER' || payload.targetPhotoId?.toLowerCase().includes('owner')) {
          await client.query(
            `UPDATE base_survey_reports SET owner_signature_url = $1 WHERE id = $2;`,
            [payload.newPhotoUrl, actualReportId]
          );
        }
      }

      await client.query(
        `INSERT INTO system_audit_logs (
           entity_type, entity_id, action, performed_by_user_id, diff_payload, client_ip
         ) VALUES ($1, $2, $3, $4, $5, $6);`,
        [
          'BASE_SURVEY_REPORT',
          actualReportId,
          'ZONE_ADMIN_REPLACE_PHOTO',
          adminId,
          JSON.stringify({
            targetPhotoType: payload.targetPhotoType,
            targetPhotoId: payload.targetPhotoId,
            photoIndex: payload.photoIndex,
            oldPhotoUrl,
            newPhotoUrl: payload.newPhotoUrl,
            clientPin: payload.clientPin,
            replacementReason: payload.replacementReason,
            timestamp: new Date().toISOString(),
          }),
          clientIp || null,
        ]
      );

      return {
        success: true,
        message: 'Đã thay thế ảnh và lưu vết kiểm toán thành công',
        oldPhotoUrl,
        newPhotoUrl: payload.newPhotoUrl,
      };
    });

    // Tự động tạo bản chụp Snapshot bất biến cho phiên bản thay thế ảnh
    try {
      const { AuditVersionService } = await import('./audit-version.service');
      await AuditVersionService.createSnapshot(actualReportId, {
        versionTag: 'PHOTO_REPLACEMENT',
        title: `Thay thế ảnh khảo sát [${payload.targetPhotoType}]`,
        editReason: payload.replacementReason,
        userId: adminId,
        clientIp,
        diffSummary: [
          {
            field: payload.targetPhotoId || payload.targetPhotoType,
            label: `Ảnh [${payload.targetPhotoType}]`,
            oldValue: oldPhotoUrl,
            newValue: payload.newPhotoUrl,
          },
        ],
      });
    } catch (snapErr) {
      console.error('[replaceReportPhoto] Không thể tạo snapshot phiên bản:', snapErr);
    }

    return txResult;
  }

  /**
   * Điều chuyển hồ sơ sang thửa đất khác (khi KSV tích nhầm thửa do nhà san sát)
   */
  static async reassignReportParcel(
    reportId: string,
    targetParcelIdOrCode: string,
    adminId: string,
    reason: string,
    clientIp?: string
  ) {
    const repRes = await Database.query<{
      id: string;
      parcel_id: string;
      unit_id: string | null;
      report_type: string | null;
      zone_id: string;
      project_parcel_code: string;
    }>(
      `SELECT r.id, r.parcel_id, r.unit_id, r.report_type, p.zone_id, p.project_parcel_code 
       FROM base_survey_reports r
       JOIN parcels p ON r.parcel_id = p.id
       WHERE r.id = $1 AND r.deleted_at IS NULL;`,
      [reportId]
    );
    if (!repRes.rows[0]) {
      throw new NotFoundError(`Không tìm thấy hồ sơ với ID: ${reportId}`);
    }

    const repRow = repRes.rows[0];
    if (
      repRow.unit_id ||
      ['CONDO_UNIT', 'UNIT_CHILD', 'MASTER_AREA', 'CONDO_MASTER_AREA'].includes(repRow.report_type || '')
    ) {
      throw new BadRequestError(
        'Hồ sơ căn hộ con hoặc khu vực mặt bằng chung cư không được phép hoán đổi ranh thửa đất GIS của toàn bộ tòa nhà mẹ. Vui lòng sử dụng chức năng "Hoán đổi vị trí CAD" trong Quản lý Tòa nhà Chung cư.'
      );
    }

    const oldParcelId = repRow.parcel_id;
    const currentZoneId = repRow.zone_id;

    // Làm sạch chuỗi đầu vào triệt để (loại bỏ ngoặc vuông [], ngoặc kép "", ngoặc đơn '', escape, khoảng trắng)
    const cleanTarget = (targetParcelIdOrCode || '')
      .trim()
      .replace(/[\[\]"'\\]/g, '')
      .trim();

    if (!cleanTarget) {
      throw new BadRequestError('Mã hoặc ID thửa đất đích không được để trống');
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanTarget);
    const targetRes = await Database.query<{ id: string; project_parcel_code: string; zone_id: string }>(
      isUuid
        ? `SELECT id, project_parcel_code, zone_id FROM parcels WHERE id = $1;`
        : `SELECT id, project_parcel_code, zone_id FROM parcels 
           WHERE (
             project_parcel_code = $1 
             OR official_cadastral_code = $1
             OR project_parcel_code ILIKE $1
             OR official_cadastral_code ILIKE $1
             OR (project_parcel_code ILIKE ('%' || $1) AND zone_id = $2)
           )
           ORDER BY 
             (CASE WHEN project_parcel_code = $1 THEN 1 WHEN project_parcel_code ILIKE $1 THEN 2 ELSE 3 END) ASC
           LIMIT 1;`,
      isUuid ? [cleanTarget] : [cleanTarget, currentZoneId]
    );

    const targetParcel = targetRes.rows[0];
    if (!targetParcel) {
      throw new NotFoundError(`Không tìm thấy thửa đất đích với thông tin: [${cleanTarget}]. Vui lòng kiểm tra lại mã dự án hoặc mã địa chính.`);
    }

    if (oldParcelId === targetParcel.id) {
      throw new BadRequestError(`Thửa đất đích [${targetParcel.project_parcel_code}] trùng với thửa đất hiện tại của hồ sơ`);
    }

    if (targetParcel.zone_id && currentZoneId && targetParcel.zone_id !== currentZoneId) {
      throw new BadRequestError(
        `Thửa đất đích [${targetParcel.project_parcel_code}] thuộc phân khu ${targetParcel.zone_id}, khác với phân khu ${currentZoneId} của hồ sơ hiện tại. Không thể hoán đổi liên phân khu!`
      );
    }

    const effectiveReason = reason || 'Điều chuyển vị trí ranh đất không gian GIS do KSV tích nhầm polygon trên bản đồ';
    const swapResult = await CadastralService.swapParcelGeometries(
      oldParcelId,
      targetParcel.id,
      adminId,
      effectiveReason,
      clientIp
    );

    try {
      const { AuditVersionService } = await import('./audit-version.service');
      await AuditVersionService.createSnapshot(reportId, {
        versionTag: 'PARCEL_SWAP',
        title: `Hoán đổi vị trí ranh đất GIS với thửa [${targetParcel.project_parcel_code}]`,
        editReason: effectiveReason,
        userId: adminId,
        clientIp,
        diffSummary: [
          {
            field: 'cadastral_polygon_geom',
            label: 'Ranh giới không gian GIS',
            oldValue: repRow.project_parcel_code,
            newValue: targetParcel.project_parcel_code,
          },
        ],
      });
    } catch (snapErr) {
      console.error('[reassignReportParcel] Không thể tạo snapshot phiên bản:', snapErr);
    }

    return {
      success: true,
      message: swapResult.message,
      reportId,
      oldParcelId,
      targetParcelId: targetParcel.id,
      newParcelCode: swapResult.parcelA.projectParcelCode,
    };
  }

  /**
   * Hoán đổi vị trí ranh đất không gian GIS giữa 2 hồ sơ khảo sát
   */
  static async swapReportParcels(
    reportAId: string,
    reportBId: string,
    adminId: string,
    reason: string,
    clientIp?: string
  ) {
    const repARes = await Database.query<{
      id: string;
      parcel_id: string;
      unit_id: string | null;
      report_type: string | null;
    }>(
      `SELECT id, parcel_id, unit_id, report_type FROM base_survey_reports WHERE id = $1 AND deleted_at IS NULL;`,
      [reportAId]
    );
    const repBRes = await Database.query<{
      id: string;
      parcel_id: string;
      unit_id: string | null;
      report_type: string | null;
    }>(
      `SELECT id, parcel_id, unit_id, report_type FROM base_survey_reports WHERE id = $1 AND deleted_at IS NULL;`,
      [reportBId]
    );

    if (!repARes.rows[0]) throw new NotFoundError(`Không tìm thấy hồ sơ A với ID: ${reportAId}`);
    if (!repBRes.rows[0]) throw new NotFoundError(`Không tìm thấy hồ sơ B với ID: ${reportBId}`);

    const repA = repARes.rows[0];
    const repB = repBRes.rows[0];

    if (
      repA.unit_id ||
      repB.unit_id ||
      ['CONDO_UNIT', 'UNIT_CHILD', 'MASTER_AREA', 'CONDO_MASTER_AREA'].includes(repA.report_type || '') ||
      ['CONDO_UNIT', 'UNIT_CHILD', 'MASTER_AREA', 'CONDO_MASTER_AREA'].includes(repB.report_type || '')
    ) {
      throw new BadRequestError(
        'Hồ sơ căn hộ con hoặc khu vực mặt bằng chung cư không được phép hoán đổi ranh thửa đất GIS của toàn bộ tòa nhà mẹ. Vui lòng sử dụng chức năng "Hoán đổi vị trí CAD" trong Quản lý Tòa nhà Chung cư.'
      );
    }

    const parcelAId = repA.parcel_id;
    const parcelBId = repB.parcel_id;

    if (parcelAId === parcelBId) {
      throw new BadRequestError('Hai hồ sơ đang thuộc cùng một thửa đất, không thể hoán đổi');
    }

    const effectiveReason = reason || 'Hoán đổi vị trí ranh đất không gian GIS giữa 2 hồ sơ liền kề bị tích chéo';
    const swapResult = await CadastralService.swapParcelGeometries(
      parcelAId,
      parcelBId,
      adminId,
      effectiveReason,
      clientIp
    );

    try {
      const { AuditVersionService } = await import('./audit-version.service');
      await AuditVersionService.createSnapshot(reportAId, {
        versionTag: 'PARCEL_SWAP',
        title: `Hoán đổi ranh đất GIS với thửa [${swapResult.parcelB.projectParcelCode}]`,
        editReason: effectiveReason,
        userId: adminId,
        clientIp,
        diffSummary: [
          {
            field: 'cadastral_polygon_geom',
            label: 'Ranh giới không gian GIS',
            oldValue: swapResult.parcelA.projectParcelCode,
            newValue: swapResult.parcelB.projectParcelCode,
          },
        ],
      });
      await AuditVersionService.createSnapshot(reportBId, {
        versionTag: 'PARCEL_SWAP',
        title: `Hoán đổi ranh đất GIS với thửa [${swapResult.parcelA.projectParcelCode}]`,
        editReason: effectiveReason,
        userId: adminId,
        clientIp,
        diffSummary: [
          {
            field: 'cadastral_polygon_geom',
            label: 'Ranh giới không gian GIS',
            oldValue: swapResult.parcelB.projectParcelCode,
            newValue: swapResult.parcelA.projectParcelCode,
          },
        ],
      });
    } catch (snapErr) {
      console.error('[swapReportParcels] Không thể tạo snapshot phiên bản:', snapErr);
    }

    return {
      success: true,
      message: swapResult.message,
      reportAId,
      reportBId,
      swappedParcels: {
        reportA: swapResult.parcelA,
        reportB: swapResult.parcelB,
      },
    };
  }

  /**
   * Tìm kiếm danh sách ứng viên thửa đất trong phân khu khả dĩ để hoán đổi ranh không gian GIS
   * Hỗ trợ 100% tất cả thửa đất trong phân khu (cả chưa khảo sát lẫn đã khảo sát).
   * Hỗ trợ tìm kiếm tiếng Việt không dấu (unaccent) trên:
   * - Mã dự án (project_parcel_code)
   * - Số tờ/số thửa (official_cadastral_code)
   * - Số nhà (house_number)
   * - Tên đường (street)
   * - Tên chủ hộ (owner_name)
   * - Mã báo cáo (report_code)
   * - Tên KSV (surveyor_name)
   */
  static async searchSwapCandidates(
    zoneId?: string,
    excludeReportId?: string,
    search?: string,
    excludeParcelId?: string
  ) {
    const params: any[] = [];
    const whereConditions: string[] = ['1=1'];

    // 1. Phân giải zoneId: nếu không truyền trực tiếp, tự động tra cứu từ excludeReportId hoặc excludeParcelId
    let resolvedZoneId = zoneId;
    if (!resolvedZoneId && excludeReportId) {
      const zRes = await Database.query<{ zone_id: string }>(
        `SELECT p.zone_id FROM base_survey_reports r JOIN parcels p ON r.parcel_id = p.id WHERE r.id = $1::uuid;`,
        [excludeReportId]
      );
      if (zRes.rows[0]?.zone_id) {
        resolvedZoneId = zRes.rows[0].zone_id;
      }
    } else if (!resolvedZoneId && excludeParcelId) {
      const zRes = await Database.query<{ zone_id: string }>(
        `SELECT zone_id FROM parcels WHERE id = $1::uuid;`,
        [excludeParcelId]
      );
      if (zRes.rows[0]?.zone_id) {
        resolvedZoneId = zRes.rows[0].zone_id;
      }
    }

    if (resolvedZoneId) {
      params.push(resolvedZoneId);
      whereConditions.push(`p.zone_id = $${params.length}`);
    }

    // 2. Loại trừ chính thửa / hồ sơ hiện tại
    if (excludeReportId) {
      params.push(excludeReportId);
      const repIdx = params.length;
      whereConditions.push(`p.id != COALESCE((SELECT parcel_id FROM base_survey_reports WHERE id = $${repIdx}::uuid), '00000000-0000-0000-0000-000000000000'::uuid)`);
    }

    if (excludeParcelId) {
      params.push(excludeParcelId);
      whereConditions.push(`p.id != $${params.length}::uuid`);
    }

    // 3. Xử lý từ khóa tìm kiếm (hỗ trợ cả có dấu và không dấu qua unaccent)
    const cleanedSearch = (search || '').trim().replace(/[\[\]"'\\]/g, '').trim();
    if (cleanedSearch) {
      params.push(cleanedSearch);
      const pIdx = params.length;
      whereConditions.push(`(
        p.project_parcel_code ILIKE ('%' || $${pIdx} || '%') OR
        p.official_cadastral_code ILIKE ('%' || $${pIdx} || '%') OR
        p.house_number ILIKE ('%' || $${pIdx} || '%') OR
        unaccent(COALESCE(p.street, '')) ILIKE unaccent('%' || $${pIdx} || '%') OR
        unaccent(COALESCE(p.owner_name, '')) ILIKE unaccent('%' || $${pIdx} || '%') OR
        COALESCE(r.report_code, '') ILIKE ('%' || $${pIdx} || '%') OR
        unaccent(COALESCE(u.full_name, u_p.full_name, '')) ILIKE unaccent('%' || $${pIdx} || '%')
      )`);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const query = `
      SELECT 
        p.id AS parcel_id,
        p.project_parcel_code,
        p.official_cadastral_code,
        p.house_number,
        p.street,
        p.ward,
        p.district,
        p.owner_name,
        p.owner_phone,
        p.land_area_m2,
        p.construction_area_m2,
        p.survey_status,
        r.id AS report_id,
        r.report_code,
        r.status AS report_status,
        COALESCE(u.full_name, u_p.full_name) AS surveyor_name
      FROM parcels p
      LEFT JOIN LATERAL (
        SELECT id, report_code, status, surveyor_id 
        FROM base_survey_reports 
        WHERE parcel_id = p.id 
        ORDER BY updated_at DESC LIMIT 1
      ) r ON true
      LEFT JOIN users u ON r.surveyor_id = u.id
      LEFT JOIN users u_p ON p.assigned_surveyor_id = u_p.id
      ${whereClause}
      ORDER BY 
        (CASE WHEN r.id IS NOT NULL THEN 0 ELSE 1 END) ASC,
        p.project_parcel_code ASC
      LIMIT 80;
    `;

    const res = await Database.query(query, params);
    return res.rows;
  }

  /**
   * Áp dụng một thao tác ảnh (ADD, DELETE, REPLACE) trong Transaction DB
   */
  static async applySinglePhotoActionInTx(
    client: any,
    reportId: string,
    parcelId: string,
    adminId: string,
    surveyJson: any,
    pa: PhotoActionItem
  ) {
    const action = pa.action;
    const cat = pa.category || 'GENERAL';
    const type = pa.targetPhotoType || 'PHOTO';
    const photoCode = pa.photoCode || `HCM_M2.${reportId.slice(0, 8)}_${type}`;
    const stdName = pa.standardizedFilename || `M2__${Date.now()}.jpg`;
    const hash = pa.sha256Hash || computeSha256(pa.newPhotoUrl || pa.oldPhotoUrl || Date.now().toString());

    if (action === 'ROTATE') {
      const rawAngle = Number(pa.rotation ?? pa.metadata?.rotation ?? 0);
      const normalizedAngle = ((rawAngle % 360) + 360) % 360;

      // 1. Cập nhật survey_data_json.photoRotations
      if (!surveyJson.photoRotations || typeof surveyJson.photoRotations !== 'object') {
        surveyJson.photoRotations = {};
      }
      if (pa.photoCode) {
        surveyJson.photoRotations[pa.photoCode] = normalizedAngle;
      }
      if (pa.targetPhotoId) {
        surveyJson.photoRotations[pa.targetPhotoId] = normalizedAngle;
      }
      if (pa.targetPhotoType) {
        surveyJson.photoRotations[pa.targetPhotoType] = normalizedAngle;
      }

      // 2. Ghi trực tiếp thuộc tính rotation vào đối tượng ảnh trong survey_data_json nếu khớp
      if (cat === 'IDENTIFICATION' || ['P01', 'P02', 'P03', 'P04'].includes(type.toUpperCase())) {
        const camelKey = `photo${type.toUpperCase().replace(/[^P0-9]/g, '')}`;
        if (surveyJson[camelKey] && typeof surveyJson[camelKey] === 'object') {
          surveyJson[camelKey].rotation = normalizedAngle;
        }
        if (surveyJson.identificationPhotos?.[camelKey] && typeof surveyJson.identificationPhotos[camelKey] === 'object') {
          surveyJson.identificationPhotos[camelKey].rotation = normalizedAngle;
        }
      }

      // 3. Cập nhật metadata_json trong survey_photo_registry nếu tồn tại
      try {
        await client.query(
          `UPDATE survey_photo_registry 
           SET metadata_json = jsonb_set(COALESCE(metadata_json, '{}'::jsonb), '{rotation}', $1::jsonb)
           WHERE report_id = $2 AND (photo_code = $3 OR photo_type = $4 OR photo_url = $5);`,
          [JSON.stringify(normalizedAngle), reportId, pa.photoCode || null, type, pa.oldPhotoUrl || pa.newPhotoUrl || null]
        );
      } catch (regErr) {
        // Fallback an toàn nếu bảng hoặc bản ghi chưa tồn tại
      }

      return;
    }

    if (action === 'REPLACE' || action === 'RESTORE') {
      const newUrl = pa.newPhotoUrl || '';
      const oldUrl = pa.oldPhotoUrl || '';

      // 1. Cập nhật bảng quan hệ
      if (cat === 'DEFECT_CU' || type === 'DEFECT_CU' || type === 'CU') {
        const dRes = await client.query(
          `SELECT d.id, d.cu_photo_url, d.cu_photos_json 
           FROM defect_items d
           JOIN damage_zones z ON d.zone_id = z.id
           WHERE z.report_id = $3 AND (d.id::text = $1 OR d.defect_code = $2);`,
          [pa.targetPhotoId || null, pa.targetPhotoId || null, reportId]
        );
        if (dRes.rows[0]) {
          const dItem = dRes.rows[0];
          const photos = Array.isArray(dItem.cu_photos_json) ? dItem.cu_photos_json : [];
          const idx = Number(pa.photoIndex) || 0;
          if (photos.length > idx) {
            photos[idx] = newUrl;
          } else {
            photos.push(newUrl);
          }
          await client.query(
            `UPDATE defect_items SET cu_photo_url = $1, cu_photos_json = $2 WHERE id = $3;`,
            [idx === 0 || !dItem.cu_photo_url ? newUrl : dItem.cu_photo_url, JSON.stringify(photos), dItem.id]
          );
        }
      } else if (cat === 'ZONE_CTX' || type === 'ZONE_CTX' || type === 'CTX') {
        await client.query(
          `UPDATE damage_zones SET ctx_photo_url = $1 WHERE report_id = $4 AND (id::text = $2 OR zone_code = $3);`,
          [newUrl, pa.targetPhotoId || null, pa.targetPhotoId || null, reportId]
        );
      } else if (cat === 'CAD_FLOOR' || type === 'FLOOR_CAD' || type === 'CAD') {
        const floorNum = Number(pa.photoIndex) || 1;
        await client.query(
          `UPDATE building_floor_plans SET cad_photo_url = $1, updated_at = NOW() WHERE id::text = $2 OR (parcel_id = $3 AND floor_number = $4);`,
          [newUrl, pa.targetPhotoId || null, parcelId, floorNum]
        );
        if (Array.isArray(surveyJson.floors)) {
          for (const fl of surveyJson.floors) {
            if (fl.id === pa.targetPhotoId || fl.floorNumber === floorNum) {
              if (type.includes('STRUCT')) {
                fl.cadStructuralSketchPhotoUrl = newUrl;
              } else {
                fl.cadArchitecturalSketchPhotoUrl = newUrl;
              }
            }
          }
        }
      } else if (cat === 'ELEMENT_CTX' || cat === 'ELEMENT_OVERVIEW') {
        if (Array.isArray(surveyJson.floors)) {
          for (const fl of surveyJson.floors) {
            if (Array.isArray(fl.structuralElements)) {
              for (const el of fl.structuralElements) {
                if (el.id === pa.targetPhotoId || el.elementCode === pa.targetPhotoId || el.elementCode === pa.defectCode) {
                  if (cat === 'ELEMENT_CTX' || type === 'CTX') {
                    el.ctxPhotoUrl = newUrl;
                  } else {
                    if (!Array.isArray(el.overviewPhotos)) el.overviewPhotos = [];
                    const pIdx = Number(pa.photoIndex) || 0;
                    if (el.overviewPhotos.length > pIdx) {
                      el.overviewPhotos[pIdx] = newUrl;
                    } else {
                      el.overviewPhotos.push(newUrl);
                    }
                  }
                  break;
                }
              }
            }
          }
        }
      } else if (cat === 'BEAM_SAGGING') {
        if (!surveyJson.settlementTilt) surveyJson.settlementTilt = {};
        if (!surveyJson.settlementTilt.beamSagging) surveyJson.settlementTilt.beamSagging = {};
        if (!Array.isArray(surveyJson.settlementTilt.beamSagging.photos)) {
          surveyJson.settlementTilt.beamSagging.photos = [];
        }
        const pIdx = Number(pa.photoIndex) || 0;
        if (surveyJson.settlementTilt.beamSagging.photos.length > pIdx) {
          surveyJson.settlementTilt.beamSagging.photos[pIdx] = { url: newUrl, photoCode };
        } else {
          surveyJson.settlementTilt.beamSagging.photos.push({ url: newUrl, photoCode });
        }
        surveyJson.settlementTilt.beamSagging.photoUrl = newUrl;
      } else if (cat === 'IDENTIFICATION' || ['P01', 'P02', 'P03', 'P04'].includes(type.toUpperCase())) {
        const equivTypes = getEquivalentIdentPhotoTypes(type);
        await client.query(
          `UPDATE survey_identification_photos 
           SET raw_photo_url = $1, annotated_photo_url = $1, is_not_applicable = false, na_reason = null 
           WHERE report_id = $2 AND photo_type::text = ANY($3::text[]);`,
          [newUrl, reportId, equivTypes]
        );
        const camelKey = `photo${type.toUpperCase().replace(/[^P0-9]/g, '')}`;
        if (!surveyJson[camelKey]) surveyJson[camelKey] = {};
        surveyJson[camelKey].url = newUrl;
        surveyJson[camelKey].notApplicable = false;
        surveyJson[camelKey].naReason = null;
      } else if (cat === 'SIGNATURE') {
        if (type.includes('SURVEYOR') || pa.targetPhotoId?.toLowerCase().includes('surveyor')) {
          await client.query(`UPDATE base_survey_reports SET surveyor_signature_url = $1 WHERE id = $2;`, [newUrl, reportId]);
          if (!surveyJson.signatures) surveyJson.signatures = {};
          surveyJson.signatures.surveyorSignatureUrl = newUrl;
          surveyJson.signatures.surveyorSignature = newUrl;
          surveyJson.surveyorSignatureUrl = newUrl;
        } else if (type.includes('OWNER') || pa.targetPhotoId?.toLowerCase().includes('owner')) {
          await client.query(`UPDATE base_survey_reports SET owner_signature_url = $1 WHERE id = $2;`, [newUrl, reportId]);
          if (!surveyJson.signatures) surveyJson.signatures = {};
          surveyJson.signatures.ownerSignatureUrl = newUrl;
          surveyJson.signatures.ownerSignature = newUrl;
          surveyJson.ownerSignatureUrl = newUrl;
        }
      } else if (cat === 'MINUTES' || type === 'WORKING_MINUTES') {
        const replaceInList = (list: any[]) => {
          if (!Array.isArray(list)) return;
          const idx = Number(pa.photoIndex);
          if (!isNaN(idx) && idx >= 0 && idx < list.length) {
            if (typeof list[idx] === 'string') {
              list[idx] = newUrl;
            } else {
              list[idx] = { ...list[idx], url: newUrl, photoCode: photoCode || list[idx].photoCode };
            }
          } else if (oldUrl) {
            for (let i = 0; i < list.length; i++) {
              if ((typeof list[i] === 'string' && list[i] === oldUrl) || list[i]?.url === oldUrl) {
                if (typeof list[i] === 'string') {
                  list[i] = newUrl;
                } else {
                  list[i] = { ...list[i], url: newUrl };
                }
                break;
              }
            }
          }
        };
        replaceInList(surveyJson.workingMinutesPhotos);
        if (surveyJson.signatures?.workingMinutesPhotos) {
          replaceInList(surveyJson.signatures.workingMinutesPhotos);
        }
      }

      // 2. Cập nhật survey_data_json nếu có path targetPhotoId
      if (pa.targetPhotoId) {
        mutateSurveyJsonPhoto(surveyJson, pa.targetPhotoId, pa.photoIndex, 'REPLACE', newUrl, oldUrl, {
          photoCode,
          caption: pa.caption,
        });
      }

      // 3. Cập nhật survey_photo_registry
      if (oldUrl) {
        // Cơ chế Tự Lành (Self-Healing Lineage): Kiểm tra nếu oldUrl chưa có trong registry thì chèn trước
        const oldCheck = await client.query(
          `SELECT id FROM survey_photo_registry WHERE report_id = $1 AND photo_url = $2 LIMIT 1;`,
          [reportId, oldUrl]
        );
        if (!oldCheck.rows[0]) {
          await client.query(
            `INSERT INTO survey_photo_registry (
               report_id, parcel_id, photo_category, photo_type, photo_code, photo_url,
               standardized_filename, sha256_hash, size_bytes, mime_type, status,
               action_type, action_reason, actor_id, actor_role, metadata_json
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ACTIVE', 'INITIAL_SURVEY', 'Khởi tạo ảnh gốc thực địa (Self-Healing Lineage)', $11, 'SURVEYOR', $12);`,
            [
              reportId, parcelId, cat, type, photoCode, oldUrl,
              `M2__initial_${photoCode}.jpg`, computeSha256(oldUrl), null, 'image/jpeg',
              adminId, JSON.stringify({ isInitialBaseline: true })
            ]
          );
        }

        await client.query(
          `UPDATE survey_photo_registry 
           SET status = 'SUPERSEDED', superseded_by_url = $1, updated_at = NOW() 
           WHERE report_id = $2 AND (photo_url = $3 OR photo_code = $4) AND status = 'ACTIVE';`,
          [newUrl, reportId, oldUrl, photoCode]
        );
      }

      const regActionType = action === 'RESTORE' ? 'RESTORE' : 'REPLACE';
      await client.query(
        `INSERT INTO survey_photo_registry (
           report_id, parcel_id, photo_category, photo_type, photo_code, photo_url,
           standardized_filename, sha256_hash, size_bytes, mime_type, status,
           replacement_for_url, action_type, action_reason, actor_id, actor_role, metadata_json
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ACTIVE', $11, $12, $13, $14, 'ZONE_ADMIN', $15);`,
        [
          reportId, parcelId, cat, type, photoCode, newUrl,
          stdName, hash, pa.sizeBytes || null, pa.mimeType || 'image/jpeg',
          oldUrl || null, regActionType, pa.reason, adminId, JSON.stringify(pa.metadata || {})
        ]
      );

    } else if (action === 'ADD') {
      const urlsToAdd = pa.newPhotoUrls && pa.newPhotoUrls.length > 0 
        ? pa.newPhotoUrls 
        : (pa.newPhotoUrl ? [pa.newPhotoUrl] : []);

      for (let i = 0; i < urlsToAdd.length; i++) {
        const url = urlsToAdd[i];
        const itemCode = urlsToAdd.length > 1 ? `${photoCode}_${String(i + 1).padStart(2, '0')}` : photoCode;
        const itemFilename = urlsToAdd.length > 1 ? stdName.replace(/\.jpg$/, `_${i + 1}.jpg`) : stdName;
        const itemHash = computeSha256(url);

        // 1. Cập nhật quan hệ
        if (cat === 'DEFECT_CU' || type === 'DEFECT_CU' || type === 'CU') {
          const dRes = await client.query(
            `SELECT id, cu_photo_url, cu_photos_json FROM defect_items WHERE id::text = $1 OR defect_code = $2;`,
            [pa.targetPhotoId || null, pa.targetPhotoId || null]
          );
          if (dRes.rows[0]) {
            const dItem = dRes.rows[0];
            const photos = Array.isArray(dItem.cu_photos_json) ? dItem.cu_photos_json : [];
            photos.push(url);
            await client.query(
              `UPDATE defect_items SET cu_photos_json = $1 WHERE id = $2;`,
              [JSON.stringify(photos), dItem.id]
            );
          } else {
            // Tạo mới defect_item liên kết với zone_id kèm tọa độ ghim pin_x, pin_y
            const zCode = pa.metadata?.zoneCode || pa.targetPhotoId;
            let targetZoneId = null;
            if (zCode) {
              const zRes = await client.query(
                `SELECT id FROM damage_zones WHERE report_id = $1 AND (zone_code = $2 OR id::text = $2) LIMIT 1;`,
                [reportId, zCode]
              );
              targetZoneId = zRes.rows[0]?.id || null;
            }
            if (!targetZoneId) {
              const zResDefault = await client.query(
                `SELECT id FROM damage_zones WHERE report_id = $1 ORDER BY id ASC LIMIT 1;`,
                [reportId]
              );
              targetZoneId = zResDefault.rows[0]?.id || null;
            }

            const pX = Number(pa.pinX ?? pa.metadata?.pinX ?? 50);
            const pY = Number(pa.pinY ?? pa.metadata?.pinY ?? 50);
            const dCode = pa.defectCode || pa.targetPhotoId || `D-${String(Date.now()).slice(-3)}`;
            const wMm = Number(pa.metadata?.widthMaxMm ?? pa.widthMaxMm ?? 0);
            const lMm = Number(pa.metadata?.lengthMm ?? pa.lengthMm ?? 0);
            const scrCat = pa.metadata?.screeningCategory || 'CRACK';
            const defType = pa.metadata?.defectType || 'HAIRLINE';
            const actState = pa.metadata?.activityState || 'U';

            if (targetZoneId) {
              await client.query(
                `INSERT INTO defect_items (
                   zone_id, defect_code, pin_x, pin_y, cu_photo_url, cu_photos_json,
                   screening_category, defect_type, activity_state,
                   width_max_mm, length_mm, material_degradation_e4, structural_significance_e2,
                   has_scale_card, is_structural_critical, pin_color
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, 0, true, false, '#ef4444');`,
                [targetZoneId, dCode, pX, pY, url, JSON.stringify([url]), scrCat, defType, actState, wMm, lMm]
              );
            }

            // Đồng bộ vào survey_data_json (cả fl.zones và fl.structuralElements)
            if (Array.isArray(surveyJson.floors)) {
              for (const fl of surveyJson.floors) {
                if (Array.isArray(fl.zones)) {
                  for (const zn of fl.zones) {
                    if (zn.zoneCode === zCode || zn.zone_code === zCode || !zCode) {
                      if (!Array.isArray(zn.defects)) zn.defects = [];
                      zn.defects.push({
                        id: `defect_${Date.now()}`,
                        defectCode: dCode,
                        pinX: pX,
                        pinY: pY,
                        widthMaxMm: wMm,
                        lengthMm: lMm,
                        cuPhotoUrl: url,
                        cuPhotos: [url],
                        screeningCategory: scrCat,
                        defectType: defType,
                        activityState: actState,
                      });
                      break;
                    }
                  }
                }
                if (Array.isArray(fl.structuralElements)) {
                  for (const el of fl.structuralElements) {
                    if (el.elementCode === zCode || el.id === zCode) {
                      if (!Array.isArray(el.defects)) el.defects = [];
                      el.defects.push({
                        id: `defect_${Date.now()}`,
                        defectCode: dCode,
                        pinX: pX,
                        pinY: pY,
                        widthMaxMm: wMm,
                        lengthMm: lMm,
                        cuPhotoUrl: url,
                        cuPhotos: [url],
                        screeningCategory: scrCat,
                        defectType: defType,
                        activityState: actState,
                      });
                      break;
                    }
                  }
                }
              }
            }
          }
        } else if (cat === 'AS_BUILT') {
          const specRes = await client.query(`SELECT id, as_built_drawing_photos_json FROM building_specifications WHERE report_id = $1;`, [reportId]);
          if (specRes.rows[0]) {
            const cur = Array.isArray(specRes.rows[0].as_built_drawing_photos_json) ? specRes.rows[0].as_built_drawing_photos_json : [];
            cur.push({ url, caption: pa.caption || 'Bản vẽ bổ sung', uploadedAt: new Date().toISOString() });
            await client.query(`UPDATE building_specifications SET as_built_drawing_photos_json = $1 WHERE report_id = $2;`, [JSON.stringify(cur), reportId]);
          }
        } else if (cat === 'ELEMENT_OVERVIEW' || cat === 'ELEMENT_CTX') {
          if (Array.isArray(surveyJson.floors)) {
            for (const fl of surveyJson.floors) {
              if (Array.isArray(fl.structuralElements)) {
                for (const el of fl.structuralElements) {
                  if (el.id === pa.targetPhotoId || el.elementCode === pa.targetPhotoId) {
                    if (!Array.isArray(el.overviewPhotos)) el.overviewPhotos = [];
                    el.overviewPhotos.push(url);
                    break;
                  }
                }
              }
            }
          }
        } else if (cat === 'BEAM_SAGGING') {
          if (!surveyJson.settlementTilt) surveyJson.settlementTilt = {};
          if (!surveyJson.settlementTilt.beamSagging) surveyJson.settlementTilt.beamSagging = {};
          if (!Array.isArray(surveyJson.settlementTilt.beamSagging.photos)) {
            surveyJson.settlementTilt.beamSagging.photos = [];
          }
          surveyJson.settlementTilt.beamSagging.photos.push({ url, caption: pa.caption || 'Ảnh võng dầm bổ sung', photoCode: itemCode });
        } else if (cat === 'MINUTES' || type === 'WORKING_MINUTES') {
          if (!surveyJson.signatures) surveyJson.signatures = {};
          if (!Array.isArray(surveyJson.signatures.workingMinutesPhotos)) {
            surveyJson.signatures.workingMinutesPhotos = Array.isArray(surveyJson.workingMinutesPhotos) ? [...surveyJson.workingMinutesPhotos] : [];
          }
          const newMin = { url, photoCode: itemCode, caption: pa.caption || `Trang biên bản ${surveyJson.signatures.workingMinutesPhotos.length + 1}` };
          surveyJson.signatures.workingMinutesPhotos.push(newMin);
          surveyJson.workingMinutesPhotos = [...surveyJson.signatures.workingMinutesPhotos];
        } else if (cat === 'IDENTIFICATION' || ['P01', 'P02', 'P03', 'P04'].includes(type.toUpperCase()) || type.startsWith('P0')) {
          const equivTypes = getEquivalentIdentPhotoTypes(type);
          await client.query(
            `UPDATE survey_identification_photos 
             SET raw_photo_url = $1, annotated_photo_url = $1, is_not_applicable = false, na_reason = null 
             WHERE report_id = $2 AND (photo_type::text = $3 OR photo_type::text = ANY($4::text[]));`,
            [url, reportId, type, equivTypes]
          );
          const camelKey = `photo${type.toUpperCase().replace(/[^P0-9]/g, '').slice(0, 3)}`;
          if (!surveyJson[camelKey]) surveyJson[camelKey] = {};
          surveyJson[camelKey].url = url;
          surveyJson[camelKey].notApplicable = false;
          surveyJson[camelKey].naReason = null;

          if (type.includes('SUPPLEMENTARY') || pa.photoIndex !== undefined) {
            if (!surveyJson.photoP03) surveyJson.photoP03 = {};
            if (!Array.isArray(surveyJson.photoP03.additionalPhotos)) {
              surveyJson.photoP03.additionalPhotos = [];
            }
            surveyJson.photoP03.additionalPhotos.push(url);
          }
        }

        // 2. Cập nhật survey_data_json
        if (cat === 'OVERVIEW' && !pa.targetPhotoId) {
          if (!surveyJson.overviewPhotos) surveyJson.overviewPhotos = {};
          if (!Array.isArray(surveyJson.overviewPhotos.otherOverviewPhotos)) surveyJson.overviewPhotos.otherOverviewPhotos = [];
          surveyJson.overviewPhotos.otherOverviewPhotos.push({ url, caption: pa.caption || 'Ảnh toàn cảnh bổ sung', addedAt: new Date().toISOString() });
        } else if (cat === 'MINUTES' && !pa.targetPhotoId) {
          if (!Array.isArray(surveyJson.workingMinutesPhotos)) surveyJson.workingMinutesPhotos = [];
          surveyJson.workingMinutesPhotos.push({ url, caption: pa.caption || `Trang biên bản ${surveyJson.workingMinutesPhotos.length + 1}`, addedAt: new Date().toISOString() });
        } else if (cat === 'ABSENCE_NOTICE' && !pa.targetPhotoId) {
          if (!Array.isArray(surveyJson.absenteeNoticePhotos)) surveyJson.absenteeNoticePhotos = [];
          surveyJson.absenteeNoticePhotos.push({ url, caption: pa.caption || 'Ảnh giấy hẹn dán cửa', addedAt: new Date().toISOString() });
        } else if (pa.targetPhotoId) {
          mutateSurveyJsonPhoto(surveyJson, pa.targetPhotoId, pa.photoIndex, 'ADD', url, undefined, {
            photoCode: itemCode,
            caption: pa.caption,
          });
        }

        // 3. Ghi vào survey_photo_registry
        await client.query(
          `INSERT INTO survey_photo_registry (
             report_id, parcel_id, photo_category, photo_type, photo_code, photo_url,
             standardized_filename, sha256_hash, size_bytes, mime_type, status,
             action_type, action_reason, actor_id, actor_role, metadata_json
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ACTIVE', 'ADD', $11, $12, 'ZONE_ADMIN', $13);`,
          [
            reportId, parcelId, cat, type, itemCode, url,
            itemFilename, itemHash, pa.sizeBytes || null, pa.mimeType || 'image/jpeg',
            pa.reason, adminId, JSON.stringify({ caption: pa.caption, ...pa.metadata })
          ]
        );
      }

    } else if (action === 'DELETE') {
      const targetUrl = pa.oldPhotoUrl || '';

      // 1. EC-01: Khuyết tật CU
      if (cat === 'DEFECT_CU' || type === 'DEFECT_CU' || type === 'CU') {
        if (pa.deleteDefectItem) {
          await client.query(
            `UPDATE defect_items SET is_deleted = true 
             WHERE zone_id IN (SELECT id FROM damage_zones WHERE report_id = $3)
               AND (id::text = $1 OR defect_code = $2);`,
            [pa.targetPhotoId || null, pa.targetPhotoId || null, reportId]
          );
        } else {
          const dRes = await client.query(
            `SELECT d.id, d.cu_photo_url, d.cu_photos_json 
             FROM defect_items d
             JOIN damage_zones z ON d.zone_id = z.id
             WHERE z.report_id = $3 AND (d.id::text = $1 OR d.defect_code = $2);`,
            [pa.targetPhotoId || null, pa.targetPhotoId || null, reportId]
          );
          if (dRes.rows[0]) {
            const dItem = dRes.rows[0];
            let photos = Array.isArray(dItem.cu_photos_json) ? dItem.cu_photos_json : [];
            photos = photos.filter((p: any) => (typeof p === 'string' ? p !== targetUrl : p?.url !== targetUrl));
            const newPrimary = photos.length > 0 ? (typeof photos[0] === 'string' ? photos[0] : photos[0]?.url) : '';
            await client.query(
              `UPDATE defect_items SET cu_photo_url = $1, cu_photos_json = $2 WHERE id = $3;`,
              [newPrimary, JSON.stringify(photos), dItem.id]
            );
          }
        }
        if (Array.isArray(surveyJson.floors)) {
          for (const fl of surveyJson.floors) {
            if (Array.isArray(fl.zones)) {
              for (const zn of fl.zones) {
                if (Array.isArray(zn.defects)) {
                  for (const df of zn.defects) {
                    if (
                      df.id === pa.targetPhotoId ||
                      df.defectCode === pa.targetPhotoId ||
                      df.defectCode === photoCode ||
                      df.defectCode === pa.defectCode ||
                      (targetUrl && (df.cuPhotoUrl === targetUrl || (Array.isArray(df.cuPhotos) && df.cuPhotos.includes(targetUrl))))
                    ) {
                      if (pa.deleteDefectItem) {
                        df.isDeleted = true;
                      } else if (Array.isArray(df.cuPhotos)) {
                        df.cuPhotos = df.cuPhotos.filter((p: any) => (typeof p === 'string' ? p !== targetUrl : p?.url !== targetUrl));
                        df.cuPhotoUrl = df.cuPhotos.length > 0 ? (typeof df.cuPhotos[0] === 'string' ? df.cuPhotos[0] : df.cuPhotos[0]?.url) : null;
                      } else if (df.cuPhotoUrl === targetUrl) {
                        df.cuPhotoUrl = null;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      } else if (cat === 'ZONE_CTX' || type === 'ZONE_CTX' || type === 'CTX') {
        await client.query(
          `UPDATE damage_zones SET ctx_photo_url = '' 
           WHERE report_id = $3 AND (id::text = $1 OR zone_code = $2);`,
          [pa.targetPhotoId || null, pa.targetPhotoId || null, reportId]
        );
        if (Array.isArray(surveyJson.floors)) {
          for (const fl of surveyJson.floors) {
            if (Array.isArray(fl.zones)) {
              for (const zn of fl.zones) {
                if (
                  zn.id === pa.targetPhotoId ||
                  zn.zoneCode === pa.targetPhotoId ||
                  zn.zoneCode === photoCode ||
                  (targetUrl && zn.ctxPhotoUrl === targetUrl)
                ) {
                  zn.ctxPhotoUrl = null;
                }
              }
            }
          }
        }
      } else if (cat === 'CAD_FLOOR' || type === 'FLOOR_CAD' || type === 'CAD') {
        const floorNum = Number(pa.photoIndex) || 1;
        await client.query(
          `UPDATE building_floor_plans SET cad_photo_url = NULL, updated_at = NOW() WHERE id::text = $1 OR (parcel_id = $2 AND floor_number = $3);`,
          [pa.targetPhotoId || null, parcelId, floorNum]
        );
        if (Array.isArray(surveyJson.floors)) {
          for (const fl of surveyJson.floors) {
            if (fl.id === pa.targetPhotoId || fl.floorNumber === floorNum) {
              if (type.includes('STRUCT')) {
                fl.cadStructuralSketchPhotoUrl = null;
              } else {
                fl.cadArchitecturalSketchPhotoUrl = null;
              }
            }
          }
        }
      } else if (cat === 'ELEMENT_CTX' || cat === 'ELEMENT_OVERVIEW') {
        if (Array.isArray(surveyJson.floors)) {
          for (const fl of surveyJson.floors) {
            if (Array.isArray(fl.structuralElements)) {
              for (const el of fl.structuralElements) {
                if (el.id === pa.targetPhotoId || el.elementCode === pa.targetPhotoId) {
                  if (cat === 'ELEMENT_CTX' || type === 'CTX') {
                    el.ctxPhotoUrl = null;
                  } else if (Array.isArray(el.overviewPhotos)) {
                    if (pa.photoIndex !== undefined && Number(pa.photoIndex) >= 0) {
                      el.overviewPhotos.splice(Number(pa.photoIndex), 1);
                    } else if (targetUrl) {
                      el.overviewPhotos = el.overviewPhotos.filter((u: string) => u !== targetUrl);
                    }
                  }
                  break;
                }
              }
            }
          }
        }
      } else if (cat === 'BEAM_SAGGING') {
        if (surveyJson.settlementTilt?.beamSagging?.photos) {
          if (pa.photoIndex !== undefined && Number(pa.photoIndex) >= 0) {
            surveyJson.settlementTilt.beamSagging.photos.splice(Number(pa.photoIndex), 1);
          } else if (targetUrl) {
            surveyJson.settlementTilt.beamSagging.photos = surveyJson.settlementTilt.beamSagging.photos.filter((p: any) => (typeof p === 'string' ? p : p.url) !== targetUrl);
          }
        }
      } else if (cat === 'IDENTIFICATION' || ['P01', 'P02', 'P03', 'P04'].includes(type.toUpperCase())) {
        const equivTypes = getEquivalentIdentPhotoTypes(type);
        const naReason = pa.naReason || pa.reason || 'Không áp dụng theo xác nhận của Quản trị viên';
        await client.query(
          `UPDATE survey_identification_photos 
           SET raw_photo_url = NULL, annotated_photo_url = NULL, is_not_applicable = true, na_reason = $1 
           WHERE report_id = $2 AND photo_type::text = ANY($3::text[]);`,
          [naReason, reportId, equivTypes]
        );
        const cleanType = type.toUpperCase().replace(/[^P0-9]/g, '');
        const pKey = cleanType.toLowerCase();
        const camelKey = `photo${cleanType}`;

        const updateNaObj = (obj: any) => {
          if (!obj) return;
          obj.url = null;
          obj.rawPhotoUrl = null;
          obj.annotatedPhotoUrl = null;
          obj.notApplicable = true;
          obj.isNotApplicable = true;
          obj.naReason = naReason;
        };

        if (!surveyJson[camelKey]) surveyJson[camelKey] = {};
        updateNaObj(surveyJson[camelKey]);

        if (surveyJson[pKey]) updateNaObj(surveyJson[pKey]);
        if (surveyJson.identificationPhotos) {
          if (surveyJson.identificationPhotos[camelKey]) updateNaObj(surveyJson.identificationPhotos[camelKey]);
          if (surveyJson.identificationPhotos[pKey]) updateNaObj(surveyJson.identificationPhotos[pKey]);
        }
      }

      // 2. Gỡ khỏi mảng trong survey_data_json nếu có
      if (cat === 'OVERVIEW' && surveyJson.overviewPhotos?.otherOverviewPhotos) {
        surveyJson.overviewPhotos.otherOverviewPhotos = surveyJson.overviewPhotos.otherOverviewPhotos.filter(
          (p: any) => (typeof p === 'string' ? p !== targetUrl : p?.url !== targetUrl)
        );
      } else if (cat === 'MINUTES' || type === 'WORKING_MINUTES') {
        const deleteFromList = (list: any[]) => {
          if (!Array.isArray(list)) return list;
          const idx = Number(pa.photoIndex);
          if (!isNaN(idx) && idx >= 0 && idx < list.length) {
            list.splice(idx, 1);
            return list;
          } else if (targetUrl) {
            return list.filter((p: any) => (typeof p === 'string' ? p !== targetUrl : p?.url !== targetUrl));
          }
          return list;
        };
        if (surveyJson.workingMinutesPhotos) {
          surveyJson.workingMinutesPhotos = deleteFromList(surveyJson.workingMinutesPhotos);
        }
        if (surveyJson.signatures?.workingMinutesPhotos) {
          surveyJson.signatures.workingMinutesPhotos = deleteFromList(surveyJson.signatures.workingMinutesPhotos);
        }
      } else if (cat === 'SIGNATURE' || type.includes('SIGNATURE')) {
        if (type.includes('SURVEYOR') || pa.targetPhotoId?.toLowerCase().includes('surveyor')) {
          await client.query(`UPDATE base_survey_reports SET surveyor_signature_url = NULL, updated_at = NOW() WHERE id = $1;`, [reportId]);
          if (surveyJson.signatures) surveyJson.signatures.surveyorSignatureUrl = null;
          surveyJson.surveyorSignatureUrl = null;
        } else if (type.includes('OWNER') || pa.targetPhotoId?.toLowerCase().includes('owner')) {
          await client.query(`UPDATE base_survey_reports SET owner_signature_url = NULL, updated_at = NOW() WHERE id = $1;`, [reportId]);
          if (surveyJson.signatures) surveyJson.signatures.ownerSignatureUrl = null;
          surveyJson.ownerSignatureUrl = null;
        }
      } else if (cat === 'ABSENCE_NOTICE') {
        if (Array.isArray(surveyJson.absenteeNoticePhotos)) {
          surveyJson.absenteeNoticePhotos = surveyJson.absenteeNoticePhotos.filter(
            (p: any) => (typeof p === 'string' ? p !== targetUrl : p?.url !== targetUrl)
          );
        }
      } else if (cat === 'MINUTES' || type === 'WORKING_MINUTES') {
        const removeFromList = (list: any[]) => {
          if (!Array.isArray(list)) return list;
          return list.filter((p: any) => (typeof p === 'string' ? p !== targetUrl : p?.url !== targetUrl));
        };
        if (surveyJson.workingMinutesPhotos) {
          surveyJson.workingMinutesPhotos = removeFromList(surveyJson.workingMinutesPhotos);
        }
        if (surveyJson.signatures?.workingMinutesPhotos) {
          surveyJson.signatures.workingMinutesPhotos = removeFromList(surveyJson.signatures.workingMinutesPhotos);
        }
      } else if (pa.targetPhotoId) {
        mutateSurveyJsonPhoto(surveyJson, pa.targetPhotoId, pa.photoIndex, 'DELETE', undefined, targetUrl);
      }

      // 3. Cập nhật survey_photo_registry: đánh dấu DELETED
      const regRes = await client.query(
        `UPDATE survey_photo_registry 
         SET status = 'DELETED', is_deleted = true, deleted_at = NOW(), deleted_by_id = $1, action_reason = $2 
         WHERE report_id = $3 AND (photo_url = $4 OR photo_code = $5);`,
        [adminId, pa.reason, reportId, targetUrl, photoCode]
      );

      if (regRes.rowCount === 0) {
        await client.query(
          `INSERT INTO survey_photo_registry (
             report_id, parcel_id, photo_category, photo_type, photo_code, photo_url,
             standardized_filename, sha256_hash, status, is_deleted, deleted_at, deleted_by_id,
             action_type, action_reason, actor_id, actor_role
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'DELETED', true, NOW(), $9, 'DELETE', $10, $9, 'ZONE_ADMIN');`,
          [
            reportId, parcelId, cat, type, photoCode, targetUrl || 'unknown',
            stdName, hash, adminId, pa.reason
          ]
        );
      }
    } else if (action === 'RESTORE') {
      const restoredUrl = pa.newPhotoUrl || pa.oldPhotoUrl || '';
      if (!restoredUrl) {
        throw new BadRequestError('Không tìm thấy URL ảnh để thực hiện khôi phục (RESTORE).');
      }

      // 1. Cập nhật các bảng quan hệ nghiệp vụ
      if (cat === 'IDENTIFICATION' || ['P01', 'P02', 'P03', 'P04'].includes(type.toUpperCase())) {
        const equivTypes = getEquivalentIdentPhotoTypes(type);
        await client.query(
          `UPDATE survey_identification_photos 
           SET raw_photo_url = $1, annotated_photo_url = $1, is_not_applicable = false, na_reason = null 
           WHERE report_id = $2 AND photo_type::text = ANY($3::text[]);`,
          [restoredUrl, reportId, equivTypes]
        );
        const pKey = type.toLowerCase();
        if (surveyJson[pKey]) {
          surveyJson[pKey].url = restoredUrl;
          surveyJson[pKey].isNotApplicable = false;
          surveyJson[pKey].naReason = null;
        }
        const camelKey = `photo${type.toUpperCase().replace(/[^P0-9]/g, '')}`;
        if (!surveyJson[camelKey]) surveyJson[camelKey] = {};
        surveyJson[camelKey].url = restoredUrl;
        surveyJson[camelKey].notApplicable = false;
        surveyJson[camelKey].naReason = null;
      } else if (cat === 'DEFECT_CU' || type === 'CU') {
        const defectId = pa.defectId || pa.defectCode || pa.targetPhotoId;
        if (defectId) {
          await client.query(
            `UPDATE defect_items 
             SET cu_photo_url = $1, is_deleted = false 
             WHERE id::text = $2 OR defect_code = $2;`,
            [restoredUrl, defectId]
          );
        }
      } else if (cat === 'ZONE_CTX' || type === 'CTX') {
        const zoneId = pa.metadata?.zone_id || pa.targetPhotoId;
        if (zoneId) {
          await client.query(
            `UPDATE damage_zones 
             SET ctx_photo_url = $1, is_deleted = false 
             WHERE id::text = $2 OR zone_code = $2;`,
            [restoredUrl, zoneId]
          );
        }
      } else if (cat === 'CAD_FLOOR' || type === 'CAD') {
        const floorPlanId = pa.metadata?.floor_plan_id || pa.targetPhotoId;
        if (floorPlanId) {
          await client.query(
            `UPDATE building_floor_plans 
             SET cad_photo_url = $1, updated_at = NOW() 
             WHERE id::text = $2;`,
            [restoredUrl, floorPlanId]
          );
        }
      } else if (cat === 'SIGNATURE') {
        if (type.includes('SURVEYOR') || pa.targetPhotoId?.toLowerCase().includes('surveyor')) {
          await client.query(`UPDATE base_survey_reports SET surveyor_signature_url = $1 WHERE id = $2;`, [restoredUrl, reportId]);
          if (!surveyJson.signatures) surveyJson.signatures = {};
          surveyJson.signatures.surveyorSignatureUrl = restoredUrl;
          surveyJson.surveyorSignatureUrl = restoredUrl;
        } else if (type.includes('OWNER') || pa.targetPhotoId?.toLowerCase().includes('owner')) {
          await client.query(`UPDATE base_survey_reports SET owner_signature_url = $1 WHERE id = $2;`, [restoredUrl, reportId]);
          if (!surveyJson.signatures) surveyJson.signatures = {};
          surveyJson.signatures.ownerSignatureUrl = restoredUrl;
          surveyJson.ownerSignatureUrl = restoredUrl;
        }
      } else if (cat === 'MINUTES' || type === 'WORKING_MINUTES') {
        const restoreInList = (list: any[]) => {
          if (!Array.isArray(list)) return;
          const idx = Number(pa.photoIndex);
          if (!isNaN(idx) && idx >= 0 && idx < list.length) {
            if (typeof list[idx] === 'string') {
              list[idx] = restoredUrl;
            } else {
              list[idx] = { ...list[idx], url: restoredUrl };
            }
          } else {
            list.push({ url: restoredUrl, photoCode });
          }
        };
        if (!surveyJson.workingMinutesPhotos) surveyJson.workingMinutesPhotos = [];
        restoreInList(surveyJson.workingMinutesPhotos);
        if (surveyJson.signatures?.workingMinutesPhotos) {
          restoreInList(surveyJson.signatures.workingMinutesPhotos);
        }
      }

      // 2. Cập nhật survey_data_json nếu có targetPhotoId
      if (pa.targetPhotoId) {
        mutateSurveyJsonPhoto(surveyJson, pa.targetPhotoId, pa.photoIndex, 'RESTORE', restoredUrl, undefined, {
          photoCode,
          caption: pa.caption,
        });
      }

      // 3. Đánh dấu bản ghi ACTIVE hiện tại của photoCode thành SUPERSEDED
      let prevActiveUrl = '';
      const curActiveRes = await client.query(
        `SELECT id, photo_url FROM survey_photo_registry 
         WHERE report_id = $1 AND photo_code = $2 AND status = 'ACTIVE' LIMIT 1;`,
        [reportId, photoCode]
      );
      if (curActiveRes.rows[0]) {
        prevActiveUrl = curActiveRes.rows[0].photo_url;
        await client.query(
          `UPDATE survey_photo_registry 
           SET status = 'SUPERSEDED', superseded_by_url = $1, updated_at = NOW() 
           WHERE id = $2;`,
          [restoredUrl, curActiveRes.rows[0].id]
        );
      }

      // 4. Thêm bản ghi mới trong survey_photo_registry với status = 'ACTIVE' và action_type = 'RESTORE'
      await client.query(
        `INSERT INTO survey_photo_registry (
           report_id, parcel_id, photo_category, photo_type, photo_code, photo_url,
           standardized_filename, sha256_hash, status, replacement_for_url, is_deleted,
           action_type, action_reason, actor_id, actor_role, metadata_json
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', $9, false, 'RESTORE', $10, $11, 'ZONE_ADMIN', $12);`,
        [
          reportId, parcelId, cat, type, photoCode, restoredUrl,
          stdName, hash, prevActiveUrl || null, pa.reason, adminId,
          JSON.stringify({ restoredAt: new Date().toISOString(), ...pa.metadata })
        ]
      );
    }

    // Đồng bộ ngược mảng ảnh trong surveyJson.settlementTilt sang bảng deformation_assessments (nếu có)
    if (surveyJson.settlementTilt) {
      const st = surveyJson.settlementTilt;
      const diffPhotosJson = Array.isArray(st.diffSettlement?.photos) ? JSON.stringify(st.diffSettlement.photos) : null;
      const tiltPhotosJson = Array.isArray(st.buildingTilt?.photos) ? JSON.stringify(st.buildingTilt.photos) : null;
      const abnPhotosJson = Array.isArray(st.abnormalCase?.photos) ? JSON.stringify(st.abnormalCase.photos) : null;
      if (diffPhotosJson !== null || tiltPhotosJson !== null || abnPhotosJson !== null) {
        await client.query(
          `UPDATE deformation_assessments SET
             diff_settlement_photos_json = COALESCE($2::jsonb, diff_settlement_photos_json),
             tilt_photos_json = COALESCE($3::jsonb, tilt_photos_json),
             abnormal_photos_json = COALESCE($4::jsonb, abnormal_photos_json)
           WHERE report_id = $1;`,
          [reportId, diffPhotosJson, tiltPhotosJson, abnPhotosJson]
        );
      }
    }
  }

  /**
   * Thực hiện thao tác ảnh đơn lẻ trực tiếp
   */
  static async executePhotoAction(
    reportId: string,
    adminId: string,
    photoAction: PhotoActionItem,
    clientIp?: string
  ) {
    if (!photoAction.reason || !photoAction.reason.trim()) {
      throw new BadRequestError('Bắt buộc nhập lý do điều chỉnh ảnh để lưu vết kiểm toán.');
    }

    const repRes = await Database.query<{ id: string; parcel_id: string; status: string; survey_data_json: any }>(
      `SELECT id, parcel_id, status, survey_data_json FROM base_survey_reports WHERE (id = $1 OR parcel_id = $1) LIMIT 1;`,
      [reportId]
    );
    if (!repRes.rows[0]) {
      throw new NotFoundError(`Không tìm thấy hồ sơ khảo sát với ID: ${reportId}`);
    }
    const report = repRes.rows[0];
    if (report.status === 'APPROVED') {
      throw new ForbiddenError('Hồ sơ khảo sát này đã được phê duyệt chính thức và bị khóa bất biến.');
    }

    const actualReportId = report.id;
    const surveyJson = typeof report.survey_data_json === 'string'
      ? JSON.parse(report.survey_data_json)
      : (report.survey_data_json || {});

    const txResult = await Database.transaction(async (client) => {
      await AuditModificationService.applySinglePhotoActionInTx(
        client,
        actualReportId,
        report.parcel_id,
        adminId,
        surveyJson,
        photoAction
      );

      await client.query(
        `UPDATE base_survey_reports SET survey_data_json = $1, updated_at = NOW() WHERE id = $2;`,
        [JSON.stringify(surveyJson), actualReportId]
      );

      await client.query(
        `INSERT INTO system_audit_logs (
           entity_type, entity_id, action, performed_by_user_id, diff_payload, client_ip
         ) VALUES ($1, $2, $3, $4, $5, $6);`,
        [
          'BASE_SURVEY_REPORT',
          actualReportId,
          `PHOTO_ACTION_${photoAction.action}`,
          adminId,
          JSON.stringify({
            photoAction,
            timestamp: new Date().toISOString(),
          }),
          clientIp || null,
        ]
      );

      return {
        success: true,
        message: `Đã thực hiện thao tác ${photoAction.action} ảnh thành công`,
      };
    });

    try {
      const { AuditVersionService } = await import('./audit-version.service');
      await AuditVersionService.createSnapshot(actualReportId, {
        versionTag: 'PHOTO_MODIFICATION',
        title: `Thao tác ảnh [${photoAction.action}] cho mục ${photoAction.category}`,
        editReason: photoAction.reason,
        userId: adminId,
        clientIp,
        diffSummary: [
          {
            field: photoAction.targetPhotoId || photoAction.category,
            label: `Thao tác ảnh ${photoAction.action} (${photoAction.category})`,
            oldValue: photoAction.oldPhotoUrl || 'None',
            newValue: photoAction.newPhotoUrl || 'None',
          },
        ],
      });
    } catch (snapErr) {
      console.error('[executePhotoAction] Không thể tạo snapshot phiên bản:', snapErr);
    }

    return txResult;
  }

  /**
   * Tự động đăng ký tất cả các ảnh thực địa hiện có vào survey_photo_registry
   * Áp dụng khi nộp hồ sơ, khi tạo baseline v0 hoặc cơ chế Tự Lành (Self-Healing) cho hồ sơ cũ
   */
  static async seedInitialReportPhotos(reportId: string, client?: any): Promise<number> {
    const dbClient = (client && typeof client.query === 'function') ? client : Database;

    const repRes = await dbClient.query(
      `SELECT r.id, r.parcel_id, r.surveyor_id, r.survey_data_json, r.surveyor_signature_url, r.owner_signature_url,
              r.created_at, p.project_parcel_code
       FROM base_survey_reports r
       JOIN parcels p ON r.parcel_id = p.id
       WHERE (r.id = $1 OR r.parcel_id = $1)
       LIMIT 1;`,
      [reportId]
    );
    if (!repRes.rows[0]) return 0;

    const rep = repRes.rows[0];
    const actualReportId = rep.id;
    const parcelId = rep.parcel_id;
    const surveyorId = rep.surveyor_id || null;
    const parcelCode = rep.project_parcel_code || actualReportId.slice(0, 8);
    const createdAt = rep.created_at || new Date();

    const surveyJson = typeof rep.survey_data_json === 'string'
      ? JSON.parse(rep.survey_data_json)
      : (rep.survey_data_json || {});

    const itemsToSeed: Array<{
      category: string;
      type: string;
      code: string;
      url: string;
      filename: string;
      metadata?: any;
    }> = [];

    // 1. Ảnh định danh P01..P04 từ survey_identification_photos
    const identRes = await dbClient.query(
      `SELECT * FROM survey_identification_photos WHERE report_id = $1;`,
      [actualReportId]
    );
    for (const p of identRes.rows) {
      const url = (p.raw_photo_url || p.annotated_photo_url || '').trim();
      if (url && !p.is_not_applicable) {
        let pType = p.photo_type || 'P01';
        if (pType === 'P01_HOUSE_NUMBER') pType = 'P01';
        if (pType === 'P02_MAIN_FACADE') pType = 'P02';
        if (pType.includes('P03')) pType = 'P03';
        if (pType === 'P04_CONTEXT_STREET') pType = 'P04';
        const pCode = p.photo_code || `HCM_M2.${parcelCode}_${pType}`;
        itemsToSeed.push({
          category: 'IDENTIFICATION',
          type: pType,
          code: pCode,
          url,
          filename: `M2__initial_${pType}.jpg`,
          metadata: { isNotApplicable: false },
        });
      }
    }

    // 2. Ảnh định danh từ survey_data_json (nếu bảng quan hệ chưa có)
    const checkJsonIdent = (key: string, stdType: string) => {
      const item = surveyJson[key];
      if (item && !item.notApplicable) {
        const u = (item.url || item.photoUrl || item.rawPhotoUrl || '').trim();
        if (u && !itemsToSeed.some((x) => x.url === u)) {
          itemsToSeed.push({
            category: 'IDENTIFICATION',
            type: stdType,
            code: item.photoCode || `HCM_M2.${parcelCode}_${stdType}`,
            url: u,
            filename: `M2__initial_${stdType}.jpg`,
          });
        }
        // Ảnh phụ P03
        if (stdType === 'P03' && Array.isArray(item.additionalPhotos)) {
          item.additionalPhotos.forEach((ex: any, idx: number) => {
            const exUrl = (typeof ex === 'string' ? ex : (ex?.url || ex?.photoUrl || '')).trim();
            if (exUrl && !itemsToSeed.some((x) => x.url === exUrl)) {
              itemsToSeed.push({
                category: 'IDENTIFICATION',
                type: 'P03',
                code: ex.photoCode || `HCM_M2.${parcelCode}_P03_ADD_${idx + 1}`,
                url: exUrl,
                filename: `M2__initial_P03_extra_${idx + 1}.jpg`,
                metadata: { isExtra: true, extraIndex: idx },
              });
            }
          });
        }
      }
    };
    checkJsonIdent('photoP01', 'P01');
    checkJsonIdent('photoP02', 'P02');
    checkJsonIdent('photoP03', 'P03');
    checkJsonIdent('photoP04', 'P04');

    // 3. Ảnh vùng hư hại damage_zones (CTX) & defect_items (CU)
    const zonesRes = await dbClient.query(
      `SELECT z.id, z.zone_code, z.ctx_photo_url, z.ctx_photo_code
       FROM damage_zones z WHERE z.report_id = $1 AND z.is_deleted = false;`,
      [actualReportId]
    );
    for (const z of zonesRes.rows) {
      const ctxUrl = (z.ctx_photo_url || '').trim();
      if (ctxUrl) {
        itemsToSeed.push({
          category: 'ZONE_CTX',
          type: 'CTX',
          code: z.ctx_photo_code || z.zone_code || `Z_CTX`,
          url: ctxUrl,
          filename: `M2__initial_CTX_${z.zone_code || z.id}.jpg`,
          metadata: { zoneId: z.id, zoneCode: z.zone_code },
        });
      }
    }

    const defectsRes = await dbClient.query(
      `SELECT d.id, d.defect_code, d.cu_photo_url, d.cu_photo_code, d.cu_photos_json, d.zone_id, z.zone_code
       FROM defect_items d
       JOIN damage_zones z ON d.zone_id = z.id
       WHERE z.report_id = $1 AND d.is_deleted = false;`,
      [actualReportId]
    );
    for (const d of defectsRes.rows) {
      const cuUrl = (d.cu_photo_url || '').trim();
      if (cuUrl) {
        itemsToSeed.push({
          category: 'DEFECT_CU',
          type: 'CU',
          code: d.cu_photo_code || d.defect_code || `D_CU`,
          url: cuUrl,
          filename: `M2__initial_CU_${d.defect_code || d.id}.jpg`,
          metadata: { defectId: d.id, defectCode: d.defect_code, zoneId: d.zone_id, zoneCode: d.zone_code },
        });
      }
      const cuList = Array.isArray(d.cu_photos_json) ? d.cu_photos_json : [];
      cuList.forEach((u: any, idx: number) => {
        const strUrl = (typeof u === 'string' ? u : (u?.url || '')).trim();
        if (strUrl && !itemsToSeed.some((x) => x.url === strUrl)) {
          itemsToSeed.push({
            category: 'DEFECT_CU',
            type: 'CU',
            code: `${d.defect_code || 'D'}_CU_${idx + 1}`,
            url: strUrl,
            filename: `M2__initial_CU_${d.defect_code || d.id}_${idx + 1}.jpg`,
            metadata: { defectId: d.id, defectCode: d.defect_code, photoIndex: idx },
          });
        }
      });
    }

    // 4. Step 5 Settlement & Tilt photos
    const st = surveyJson.settlementTilt || {};
    if (Array.isArray(st.beamSagging?.photos)) {
      st.beamSagging.photos.forEach((p: any, idx: number) => {
        const u = (typeof p === 'string' ? p : (p?.url || '')).trim();
        if (u) {
          itemsToSeed.push({
            category: 'SETTLEMENT_TILT',
            type: 'BEAM_SAGGING',
            code: p?.photoCode || `BEAM_SAG_${idx + 1}`,
            url: u,
            filename: `M2__initial_sag_${idx + 1}.jpg`,
          });
        }
      });
    }
    if (Array.isArray(st.diffSettlement?.photos)) {
      st.diffSettlement.photos.forEach((p: any, idx: number) => {
        const u = (typeof p === 'string' ? p : (p?.url || '')).trim();
        if (u) {
          itemsToSeed.push({
            category: 'SETTLEMENT_TILT',
            type: 'SETTLEMENT_DIFF',
            code: p?.photoCode || `SETTLE_DIFF_${idx + 1}`,
            url: u,
            filename: `M2__initial_diff_${idx + 1}.jpg`,
          });
        }
      });
    }
    if (Array.isArray(st.buildingTilt?.photos)) {
      st.buildingTilt.photos.forEach((p: any, idx: number) => {
        const u = (typeof p === 'string' ? p : (p?.url || '')).trim();
        if (u) {
          itemsToSeed.push({
            category: 'SETTLEMENT_TILT',
            type: 'BUILDING_TILT',
            code: p?.photoCode || `TILT_${idx + 1}`,
            url: u,
            filename: `M2__initial_tilt_${idx + 1}.jpg`,
          });
        }
      });
    }

    // 5. Đất trống & Công trình xây dựng
    if (Array.isArray(surveyJson.vacantLandPhotos)) {
      surveyJson.vacantLandPhotos.forEach((p: any, idx: number) => {
        const u = (typeof p === 'string' ? p : (p?.url || '')).trim();
        if (u) {
          itemsToSeed.push({
            category: 'OVERVIEW',
            type: 'VACANT_LAND',
            code: p?.photoCode || `VACANT_${idx + 1}`,
            url: u,
            filename: `M2__initial_vacant_${idx + 1}.jpg`,
          });
        }
      });
    }
    if (Array.isArray(surveyJson.underConstructionPhotos)) {
      surveyJson.underConstructionPhotos.forEach((p: any, idx: number) => {
        const u = (typeof p === 'string' ? p : (p?.url || '')).trim();
        if (u) {
          itemsToSeed.push({
            category: 'OVERVIEW',
            type: 'UNDER_CONSTRUCTION',
            code: p?.photoCode || `CONST_${idx + 1}`,
            url: u,
            filename: `M2__initial_const_${idx + 1}.jpg`,
          });
        }
      });
    }

    // 6. Chữ ký
    if (rep.surveyor_signature_url) {
      itemsToSeed.push({
        category: 'SIGNATURE',
        type: 'SURVEYOR_SIGNATURE',
        code: `SIG_SURVEYOR`,
        url: rep.surveyor_signature_url.trim(),
        filename: `M2__initial_sig_surveyor.png`,
      });
    }
    if (rep.owner_signature_url) {
      itemsToSeed.push({
        category: 'SIGNATURE',
        type: 'OWNER_SIGNATURE',
        code: `SIG_OWNER`,
        url: rep.owner_signature_url.trim(),
        filename: `M2__initial_sig_owner.png`,
      });
    }

    let insertedCount = 0;
    for (const item of itemsToSeed) {
      const exist = await dbClient.query(
        `SELECT id FROM survey_photo_registry WHERE report_id = $1 AND photo_url = $2 LIMIT 1;`,
        [actualReportId, item.url]
      );
      if (!exist.rows[0]) {
        await dbClient.query(
          `INSERT INTO survey_photo_registry (
             report_id, parcel_id, photo_category, photo_type, photo_code, photo_url,
             standardized_filename, sha256_hash, size_bytes, mime_type, status,
             action_type, action_reason, actor_id, actor_role, metadata_json, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ACTIVE', 'INITIAL_SURVEY', 'Khởi tạo ảnh khảo sát thực địa ban đầu', $11, 'SURVEYOR', $12, $13, $13);`,
          [
            actualReportId,
            parcelId,
            item.category,
            item.type,
            item.code,
            item.url,
            item.filename,
            computeSha256(item.url),
            null,
            'image/jpeg',
            surveyorId,
            JSON.stringify(item.metadata || {}),
            createdAt,
          ]
        );
        insertedCount++;
      }
    }

    return insertedCount;
  }

  /**
   * Truy xuất toàn bộ lịch sử vòng đời ảnh của một hồ sơ khảo sát (hỗ trợ bộ lọc)
   */
  static async getPhotoAuditRegistry(
    reportId: string,
    filters?: {
      photoCode?: string;
      photoType?: string;
      category?: string;
      currentPhotoUrl?: string;
      includeDeleted?: boolean;
    }
  ) {
    const repRes = await Database.query<{ id: string }>(
      `SELECT id FROM base_survey_reports WHERE (id = $1 OR parcel_id = $1) LIMIT 1;`,
      [reportId]
    );
    if (!repRes.rows[0]) {
      throw new NotFoundError(`Không tìm thấy hồ sơ khảo sát với ID: ${reportId}`);
    }
    const actualReportId = repRes.rows[0].id;

    // Cơ chế Tự Lành (Self-Healing Lineage): Nếu registry chưa có dòng nào, tự động seed toàn bộ ảnh của hồ sơ
    const countRes = await Database.query<{ count: string }>(
      `SELECT count(*) FROM survey_photo_registry WHERE report_id = $1;`,
      [actualReportId]
    );
    if (Number(countRes.rows[0]?.count || 0) === 0) {
      try {
        await this.seedInitialReportPhotos(actualReportId);
      } catch (e: any) {
        console.warn('⚠️ [GET PHOTO REGISTRY] Auto-seed warning:', e?.message);
      }
    }

    const params: any[] = [actualReportId];
    let whereClause = `WHERE r.report_id = $1`;

    if (filters?.currentPhotoUrl && filters.currentPhotoUrl.trim()) {
      const u = filters.currentPhotoUrl.trim();
      params.push(u);
      const uIdx = params.length;

      if (filters?.photoCode) {
        const cleanCode = filters.photoCode.trim();
        params.push(`%${cleanCode}%`);
        const cIdx = params.length;
        whereClause += ` AND (
          r.photo_url = $${uIdx} 
          OR r.superseded_by_url = $${uIdx} 
          OR r.replacement_for_url = $${uIdx}
          OR r.photo_code ILIKE $${cIdx}
          OR r.photo_type ILIKE $${cIdx}
        )`;
      } else {
        whereClause += ` AND (
          r.photo_url = $${uIdx} 
          OR r.superseded_by_url = $${uIdx} 
          OR r.replacement_for_url = $${uIdx}
          OR r.photo_url IN (
            SELECT r2.replacement_for_url FROM survey_photo_registry r2 
            WHERE r2.report_id = $1 AND (r2.photo_url = $${uIdx} OR r2.superseded_by_url = $${uIdx})
          )
          OR r.superseded_by_url IN (
            SELECT r3.photo_url FROM survey_photo_registry r3 
            WHERE r3.report_id = $1 AND (r3.photo_url = $${uIdx} OR r3.replacement_for_url = $${uIdx})
          )
        )`;
      }
    } else {
      if (filters?.photoCode) {
        const cleanCode = filters.photoCode.trim();
        params.push(`%${cleanCode}%`);
        const pIdx = params.length;
        whereClause += ` AND (r.photo_code ILIKE $${pIdx} OR r.photo_type ILIKE $${pIdx})`;
      }
      if (filters?.photoType) {
        const cleanType = filters.photoType.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        params.push(`%${cleanType}%`);
        const pIdx = params.length;
        whereClause += ` AND (
          UPPER(r.photo_type) ILIKE $${pIdx}
          OR REPLACE(UPPER(r.photo_type), '_', '') ILIKE $${pIdx}
          OR REPLACE(UPPER(r.photo_code), '_', '') ILIKE $${pIdx}
        )`;
      }
    }

    if (filters?.category) {
      params.push(filters.category.trim().toUpperCase());
      whereClause += ` AND UPPER(r.photo_category) = $${params.length}`;
    }
    if (filters?.includeDeleted === false) {
      whereClause += ` AND r.is_deleted = false`;
    }

    const res = await Database.query(
      `SELECT r.*, u.full_name as actor_name, d.full_name as deleted_by_name
       FROM survey_photo_registry r
       LEFT JOIN users u ON r.actor_id = u.id
       LEFT JOIN users d ON r.deleted_by_id = d.id
       ${whereClause}
       ORDER BY r.created_at DESC;`,
      params
    );
    return res.rows;
  }

  /**
   * Khôi phục (RESTORE) một bức ảnh cũ từ survey_photo_registry làm ảnh chính
   */
  static async restoreReportPhoto(
    reportId: string,
    adminId: string,
    payload: {
      registryPhotoId: string;
      restoreReason: string;
      adminPassword?: string;
    },
    clientIp?: string
  ) {
    if (!payload.registryPhotoId) {
      throw new BadRequestError('Bắt buộc cung cấp mã ID ảnh lịch sử (registryPhotoId) cần khôi phục.');
    }
    if (!payload.restoreReason || !payload.restoreReason.trim()) {
      throw new BadRequestError('Bắt buộc nhập lý do khôi phục ảnh để lưu vết kiểm toán.');
    }

    const reportRes = await Database.query<{
      id: string;
      parcel_id: string;
      status: string;
      survey_data_json: any;
    }>(
      `SELECT id, parcel_id, status, survey_data_json FROM base_survey_reports WHERE (id = $1 OR parcel_id = $1) LIMIT 1;`,
      [reportId]
    );
    if (!reportRes.rows[0]) {
      throw new NotFoundError(`Không tìm thấy hồ sơ khảo sát với ID: ${reportId}`);
    }
    const report = reportRes.rows[0];
    if (report.status === 'APPROVED') {
      throw new ForbiddenError('Hồ sơ khảo sát này đã được phê duyệt chính thức và bị khóa bất biến, không thể khôi phục ảnh.');
    }

    const actualReportId = report.id;

    // 1. Tìm bản ghi ảnh cần khôi phục
    const targetPhotoRes = await Database.query<any>(
      `SELECT * FROM survey_photo_registry WHERE id = $1 AND report_id = $2 LIMIT 1;`,
      [payload.registryPhotoId, actualReportId]
    );
    if (!targetPhotoRes.rows[0]) {
      throw new NotFoundError(`Không tìm thấy bản ghi ảnh trong sổ cái kiểm toán với ID: ${payload.registryPhotoId}`);
    }
    const targetPhoto = targetPhotoRes.rows[0];
    const restoredUrl = targetPhoto.photo_url;
    const cat = targetPhoto.photo_category;
    const type = targetPhoto.photo_type;
    const photoCode = targetPhoto.photo_code;

    // 2. Lấy thông tin user
    const userRes = await Database.query<{ full_name: string; role: string }>(
      `SELECT full_name, role FROM users WHERE id = $1;`,
      [adminId]
    );
    const actorName = userRes.rows[0]?.full_name || 'Quản trị viên';

    let previousActiveUrl = '';

    const txResult = await Database.transaction(async (client) => {
      // 2.1. Đánh dấu bản ghi ACTIVE hiện tại của photo_code này (nếu có) thành SUPERSEDED
      const curActiveRes = await client.query(
        `SELECT id, photo_url FROM survey_photo_registry 
         WHERE report_id = $1 AND photo_code = $2 AND status = 'ACTIVE' LIMIT 1;`,
        [actualReportId, photoCode]
      );
      if (curActiveRes.rows[0]) {
        previousActiveUrl = curActiveRes.rows[0].photo_url;
        await client.query(
          `UPDATE survey_photo_registry 
           SET status = 'SUPERSEDED', superseded_by_url = $1, updated_at = NOW() 
           WHERE id = $2;`,
          [restoredUrl, curActiveRes.rows[0].id]
        );
      }

      // 2.2. Ghi bản ghi mới với action_type = 'RESTORE', status = 'ACTIVE'
      const newRegistryRes = await client.query(
        `INSERT INTO survey_photo_registry (
           report_id, parcel_id, photo_category, photo_type, photo_code, photo_url,
           storage_key, original_filename, standardized_filename, sha256_hash,
           size_bytes, mime_type, status, replacement_for_url, is_deleted,
           action_type, action_reason, actor_id, actor_role, metadata_json
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9, $10,
           $11, $12, 'ACTIVE', $13, false,
           'RESTORE', $14, $15, 'ZONE_ADMIN', $16
         ) RETURNING id;`,
        [
          actualReportId,
          report.parcel_id,
          cat,
          type,
          photoCode,
          restoredUrl,
          targetPhoto.storage_key || null,
          targetPhoto.original_filename || null,
          targetPhoto.standardized_filename || `M2__RESTORE_${Date.now()}.jpg`,
          targetPhoto.sha256_hash || computeSha256(restoredUrl),
          targetPhoto.size_bytes || null,
          targetPhoto.mime_type || 'image/jpeg',
          previousActiveUrl || null,
          payload.restoreReason,
          adminId,
          JSON.stringify({
            restoredFromRegistryId: targetPhoto.id,
            restoredAt: new Date().toISOString(),
            ...(typeof targetPhoto.metadata_json === 'object' ? targetPhoto.metadata_json : {})
          })
        ]
      );

      // 2.3. Cập nhật bảng dữ liệu nghiệp vụ
      const sData = typeof report.survey_data_json === 'string'
        ? JSON.parse(report.survey_data_json)
        : (report.survey_data_json || {});

      const meta = typeof targetPhoto.metadata_json === 'object' ? targetPhoto.metadata_json : {};

      if (cat === 'IDENTIFICATION' || ['P01', 'P02', 'P03', 'P04'].includes(type.toUpperCase())) {
        const equivTypes = getEquivalentIdentPhotoTypes(type);
        await client.query(
          `UPDATE survey_identification_photos 
           SET raw_photo_url = $1, annotated_photo_url = $1, is_not_applicable = false, na_reason = null 
           WHERE report_id = $2 AND photo_type::text = ANY($3::text[]);`,
          [restoredUrl, actualReportId, equivTypes]
        );

        const camelKey = `photo${type.toUpperCase().replace(/[^P0-9]/g, '')}`;
        if (!sData[camelKey]) sData[camelKey] = {};
        sData[camelKey].url = restoredUrl;
        sData[camelKey].notApplicable = false;
        sData[camelKey].naReason = null;
      } else if (cat === 'DEFECT_CU' || type === 'CU') {
        const defectId = meta?.defect_id || meta?.targetPhotoId;
        if (defectId) {
          await client.query(
            `UPDATE defect_items 
             SET cu_photo_url = $1, is_deleted = false 
             WHERE id::text = $2 OR defect_code = $2;`,
            [restoredUrl, defectId]
          );
        }
      } else if (cat === 'ZONE_CTX' || type === 'CTX') {
        const zoneId = meta?.zone_id || meta?.targetPhotoId;
        if (zoneId) {
          await client.query(
            `UPDATE damage_zones 
             SET ctx_photo_url = $1, is_deleted = false 
             WHERE id::text = $2 OR zone_code = $2;`,
            [restoredUrl, zoneId]
          );
        }
      } else if (cat === 'CAD_FLOOR' || type === 'CAD') {
        const floorPlanId = meta?.floor_plan_id || meta?.targetPhotoId;
        if (floorPlanId) {
          await client.query(
            `UPDATE building_floor_plans 
             SET cad_photo_url = $1, updated_at = NOW() 
             WHERE id::text = $2;`,
            [restoredUrl, floorPlanId]
          );
        }
      }

      if (meta?.targetPhotoId) {
        mutateSurveyJsonPhoto(sData, meta.targetPhotoId, meta.photoIndex, 'RESTORE', restoredUrl);
      }

      await client.query(
        `UPDATE base_survey_reports 
         SET survey_data_json = $1, updated_at = NOW() 
         WHERE id = $2;`,
        [JSON.stringify(sData), actualReportId]
      );

      // 2.4. Ghi system_audit_logs
      await client.query(
        `INSERT INTO system_audit_logs (
           entity_type, entity_id, action, performed_by_user_id, diff_payload, client_ip
         ) VALUES ($1, $2, $3, $4, $5, $6);`,
        [
          'BASE_SURVEY_REPORT',
          actualReportId,
          'ZONE_ADMIN_RESTORE_PHOTO',
          adminId,
          JSON.stringify({
            photoCategory: cat,
            photoType: type,
            photoCode,
            restoredUrl,
            previousActiveUrl,
            registryPhotoId: payload.registryPhotoId,
            restoreReason: payload.restoreReason,
            actorName,
            timestamp: new Date().toISOString(),
          }),
          clientIp || null,
        ]
      );

      return {
        success: true,
        message: `Đã khôi phục ảnh [${photoCode}] về phiên bản cũ thành công`,
        restoredUrl,
        photoCode,
        registryId: newRegistryRes.rows[0].id,
      };
    });

    // 3. Tự động tạo bản chụp Snapshot bất biến cho phiên bản khôi phục ảnh
    try {
      const { AuditVersionService } = await import('./audit-version.service');
      await AuditVersionService.createSnapshot(actualReportId, {
        versionTag: 'PHOTO_RESTORE',
        title: `Khôi phục ảnh [${type}] về phiên bản lưu trữ trước đây`,
        editReason: payload.restoreReason,
        userId: adminId,
        clientIp,
        diffSummary: [
          {
            field: photoCode,
            label: `Ảnh [${type}] - Khôi phục`,
            oldValue: previousActiveUrl || 'N/A',
            newValue: restoredUrl,
          },
        ],
      });
    } catch (snapErr) {
      console.error('[restoreReportPhoto] Không thể tạo snapshot phiên bản:', snapErr);
    }

    return txResult;
  }

  /**
   * Khóa phiên chỉnh sửa độc quyền (Exclusive Audit Lock 15 phút)
   * Chống xung đột khi 2 người cùng mở và sửa 1 hồ sơ
   */
  static async acquireAuditLock(
    reportId: string,
    userId: string
  ): Promise<{ acquired: boolean; lockedByUserId?: string; lockedByName?: string; expiresAt?: string; message?: string }> {
    const repRes = await Database.query<{ id: string }>(
      `SELECT id FROM base_survey_reports WHERE id = $1 OR parcel_id = $1 LIMIT 1;`,
      [reportId]
    );
    if (!repRes.rows[0]) throw new NotFoundError(`Không tìm thấy hồ sơ với ID: ${reportId}`);
    const actualReportId = repRes.rows[0].id;

    // Kiểm tra khóa hiện tại
    const curRes = await Database.query<{
      locked_by_user_id: string;
      full_name: string;
      expires_at: string;
      is_active: boolean;
    }>(
      `SELECT l.locked_by_user_id, u.full_name, l.expires_at, (l.expires_at > NOW()) AS is_active
       FROM survey_audit_locks l
       JOIN users u ON l.locked_by_user_id = u.id
       WHERE l.report_id = $1;`,
      [actualReportId]
    );

    const lock = curRes.rows[0];
    if (lock && lock.is_active && lock.locked_by_user_id !== userId) {
      return {
        acquired: false,
        lockedByUserId: lock.locked_by_user_id,
        lockedByName: lock.full_name,
        expiresAt: lock.expires_at,
        message: `Hồ sơ đang được hiệu chỉnh bởi ${lock.full_name} (khóa độc quyền còn hiệu lực). Vui lòng thử lại sau.`,
      };
    }

    // Cấp hoặc gia hạn khóa 15 phút
    const upsertRes = await Database.query<{ expires_at: string }>(
      `INSERT INTO survey_audit_locks (report_id, locked_by_user_id, locked_at, expires_at)
       VALUES ($1, $2, NOW(), NOW() + INTERVAL '15 minutes')
       ON CONFLICT (report_id) DO UPDATE SET
         locked_by_user_id = EXCLUDED.locked_by_user_id,
         locked_at = NOW(),
         expires_at = NOW() + INTERVAL '15 minutes'
       RETURNING expires_at;`,
      [actualReportId, userId]
    );

    return {
      acquired: true,
      lockedByUserId: userId,
      expiresAt: upsertRes.rows[0].expires_at,
    };
  }

  /**
   * Giải phóng khóa phiên chỉnh sửa độc quyền
   */
  static async releaseAuditLock(reportId: string, userId: string): Promise<boolean> {
    const repRes = await Database.query<{ id: string }>(
      `SELECT id FROM base_survey_reports WHERE id = $1 OR parcel_id = $1 LIMIT 1;`,
      [reportId]
    );
    if (!repRes.rows[0]) return false;
    const actualReportId = repRes.rows[0].id;

    if (userId === 'FORCE') {
      await Database.query(
        `DELETE FROM survey_audit_locks WHERE report_id = $1;`,
        [actualReportId]
      );
    } else {
      await Database.query(
        `DELETE FROM survey_audit_locks WHERE report_id = $1 AND locked_by_user_id = $2;`,
        [actualReportId, userId]
      );
    }
    return true;
  }

  /**
   * Kiểm tra trạng thái khóa phiên của hồ sơ
   */
  static async checkAuditLock(
    reportId: string,
    currentUserId?: string
  ): Promise<{ isLocked: boolean; lockedByOther: boolean; lockedByName?: string; expiresAt?: string }> {
    const repRes = await Database.query<{ id: string }>(
      `SELECT id FROM base_survey_reports WHERE id = $1 OR parcel_id = $1 LIMIT 1;`,
      [reportId]
    );
    if (!repRes.rows[0]) return { isLocked: false, lockedByOther: false };
    const actualReportId = repRes.rows[0].id;

    const res = await Database.query<{
      locked_by_user_id: string;
      full_name: string;
      expires_at: string;
    }>(
      `SELECT l.locked_by_user_id, u.full_name, l.expires_at
       FROM survey_audit_locks l
       JOIN users u ON l.locked_by_user_id = u.id
       WHERE l.report_id = $1 AND l.expires_at > NOW();`,
      [actualReportId]
    );

    const lock = res.rows[0];
    if (!lock) return { isLocked: false, lockedByOther: false };

    const lockedByOther = Boolean(currentUserId && lock.locked_by_user_id !== currentUserId);
    return {
      isLocked: true,
      lockedByOther,
      lockedByName: lock.full_name,
      expiresAt: lock.expires_at,
    };
  }
}

