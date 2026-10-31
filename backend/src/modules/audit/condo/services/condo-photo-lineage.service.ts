/**
 * ============================================================================
 * CONDO PHOTO LINEAGE & LIFECYCLE SERVICE
 * Quản lý toàn bộ vòng đời ảnh hiện trường cho 3 thực thể Chung cư:
 *   - ADD / REPLACE / DELETE (Soft-Delete) / ROTATE / RESTORE
 *   - Hỗ trợ đồng bộ cả cấu trúc phẳng (damageZones, structuralElements, areaInfo)
 *     lẫn cấu trúc tầng (floors[]) và Sổ cái bất biến survey_photo_registry.
 * ============================================================================
 */

import * as crypto from 'crypto';
import type { PoolClient } from 'pg';
import { AuditModificationService } from '../../services/audit-modification.service';
import type { CondoPhotoActionItem } from '../condo-audit.types';

function computeSha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export class CondoPhotoLineageService {
  /**
   * Thực thi một thao tác ảnh (ADD, REPLACE, DELETE, ROTATE, RESTORE) trong Transaction
   * kết hợp cập nhật các mảng phẳng đặc thù của Chung cư (damageZones, structuralElements, areaInfo)
   */
  static async applyPhotoActionInTx(
    client: PoolClient,
    reportId: string,
    parcelId: string,
    adminId: string,
    surveyJson: Record<string, unknown>,
    pa: CondoPhotoActionItem
  ): Promise<void> {
    // 1. Gọi engine chuẩn của hệ thống để ghi vào survey_photo_registry & bảng SQL
    await AuditModificationService.applySinglePhotoActionInTx(
      client,
      reportId,
      parcelId,
      adminId,
      surveyJson,
      pa
    );

    // 2. Đồng bộ bổ sung cho các cấu trúc phẳng đặc thù của Chung cư (damageZones[], structuralElements[], areaInfo)
    const action = pa.action;
    const cat = String(pa.category || 'GENERAL').toUpperCase();
    const type = String(pa.targetPhotoType || 'PHOTO').toUpperCase();
    const newUrl = String(pa.newPhotoUrl || '').trim();
    const oldUrl = String(pa.oldPhotoUrl || '').trim();
    const targetId = String(pa.targetPhotoId || pa.defectCode || pa.zoneCode || '').trim();
    const idx = Number(pa.photoIndex ?? 0);

    if (action === 'ROTATE') {
      return;
    }

    // 2a. Đồng bộ ảnh vết nứt cận cảnh (DEFECT_CU) trên mảng phẳng damageZones[] & structuralElements[]
    if (cat === 'DEFECT_CU' || type === 'DEFECT_CU' || type === 'CU') {
      const syncDefectList = (zonesOrElems: unknown) => {
        if (!Array.isArray(zonesOrElems)) return;
        for (const zItem of zonesOrElems) {
          const zObj = zItem as Record<string, unknown>;
          const defects = Array.isArray(zObj.defects) ? (zObj.defects as Array<Record<string, unknown>>) : [];
          for (const df of defects) {
            const matched =
              String(df.id || '') === targetId ||
              String(df.defectCode || df.defect_code || '') === targetId ||
              String(df.defectCode || df.defect_code || '') === String(pa.defectCode || '') ||
              (oldUrl && (df.cuPhotoUrl === oldUrl || (Array.isArray(df.cuPhotos) && df.cuPhotos.includes(oldUrl))));
            if (!matched) continue;

            const curList: string[] = Array.isArray(df.cuPhotos)
              ? (df.cuPhotos as unknown[]).map((u) => (typeof u === 'string' ? u : String((u as Record<string, unknown>)?.url || ''))).filter(Boolean)
              : df.cuPhotoUrl
                ? [String(df.cuPhotoUrl)]
                : [];

            if (action === 'REPLACE' || action === 'RESTORE') {
              if (oldUrl && curList.includes(oldUrl)) {
                df.cuPhotos = curList.map((u) => (u === oldUrl ? newUrl : u));
              } else if (curList.length > idx) {
                curList[idx] = newUrl;
                df.cuPhotos = curList;
              } else if (newUrl) {
                curList.push(newUrl);
                df.cuPhotos = curList;
              }
              if (idx === 0 || !df.cuPhotoUrl || df.cuPhotoUrl === oldUrl) {
                df.cuPhotoUrl = newUrl;
              }
            } else if (action === 'ADD') {
              const urls = Array.isArray(pa.newPhotoUrls) && pa.newPhotoUrls.length > 0 ? pa.newPhotoUrls : newUrl ? [newUrl] : [];
              for (const u of urls) {
                if (u && !curList.includes(u)) curList.push(u);
              }
              df.cuPhotos = curList;
              if (!df.cuPhotoUrl && curList[0]) df.cuPhotoUrl = curList[0];
            } else if (action === 'DELETE') {
              const filtered = oldUrl ? curList.filter((u) => u !== oldUrl) : curList.filter((_, i) => i !== idx);
              df.cuPhotos = filtered;
              df.cuPhotoUrl = filtered[0] || '';
            }
          }
        }
      };

      syncDefectList(surveyJson.damageZones);
      syncDefectList(surveyJson.structuralElements);
    }

    // 2b. Đồng bộ ảnh toàn cảnh Vùng hư hại (ZONE_CTX) hoặc Cấu kiện (ELEMENT_CTX) trên mảng phẳng
    if (cat === 'ZONE_CTX' || type === 'ZONE_CTX' || cat === 'ELEMENT_CTX' || cat === 'ELEMENT_OVERVIEW') {
      const syncZoneOrElemCtx = (list: unknown) => {
        if (!Array.isArray(list)) return;
        for (const item of list) {
          const obj = item as Record<string, unknown>;
          const code = String(obj.zoneCode || obj.zone_code || obj.elementCode || obj.element_code || '');
          const matched = String(obj.id || '') === targetId || code === targetId || (oldUrl && obj.ctxPhotoUrl === oldUrl);
          if (!matched) continue;

          if (action === 'REPLACE' || action === 'RESTORE' || action === 'ADD') {
            if (newUrl) {
              obj.ctxPhotoUrl = newUrl;
              obj.ctx_photo_url = newUrl;
            }
          } else if (action === 'DELETE') {
            obj.ctxPhotoUrl = '';
            obj.ctx_photo_url = '';
          }
        }
      };

      syncZoneOrElemCtx(surveyJson.damageZones);
      syncZoneOrElemCtx(surveyJson.structuralElements);
    }

    // 2b'. Đồng bộ dải ảnh tổng quan của Z/E trên mảng phẳng, gồm cả cột SQL mà màn thẩm định ưu tiên đọc
    if (cat === 'ZONE_OVERVIEW') {
      for (const list of [surveyJson.damageZones, surveyJson.structuralElements]) {
        if (!Array.isArray(list)) continue;
        for (const item of list as Array<Record<string, unknown>>) {
          const code = String(item.zoneCode || item.zone_code || item.elementCode || item.element_code || '');
          if (String(item.id || '') !== targetId && code !== targetId) continue;

          const current = (Array.isArray(item.overviewPhotos) ? item.overviewPhotos : [])
            .map((photo: unknown) => (typeof photo === 'string' ? photo : String((photo as Record<string, unknown>)?.url || '')))
            .filter(Boolean);
          let next = current;
          if (action === 'ADD') {
            const urls = Array.isArray(pa.newPhotoUrls) && pa.newPhotoUrls.length > 0 ? pa.newPhotoUrls : newUrl ? [newUrl] : [];
            next = [...current, ...urls.filter((url) => url && !current.includes(url))];
          } else if (action === 'REPLACE' || action === 'RESTORE') {
            next = current.includes(oldUrl) ? current.map((url) => (url === oldUrl ? newUrl : url)) : [...current, newUrl];
          } else if (action === 'DELETE') {
            next = current.filter((url) => url !== oldUrl);
          }
          item.overviewPhotos = next;
          await client.query(`UPDATE damage_zones SET overview_photos_json = $1 WHERE report_id = $2 AND id::text = $3;`, [
            JSON.stringify(next),
            reportId,
            String(item.id || ''),
          ]);
        }
      }
    }

    // 2c. Đồng bộ ảnh đặc thù Khu vực dùng chung (areaInfo.overviewPhotos & areaInfo.croppedCadUrl)
    if (cat === 'AREA_OVERVIEW' || type === 'AREA_OVERVIEW' || cat === 'CROPPED_CAD' || type === 'CROPPED_CAD') {
      const areaInfo = ((surveyJson.areaInfo as Record<string, unknown>) || {}) as Record<string, unknown>;
      if (cat === 'CROPPED_CAD' || type === 'CROPPED_CAD') {
        if (action === 'DELETE') {
          areaInfo.croppedCadUrl = '';
          surveyJson.croppedCadUrl = '';
        } else if (newUrl) {
          areaInfo.croppedCadUrl = newUrl;
          surveyJson.croppedCadUrl = newUrl;
        }
      } else {
        const curOv: Array<Record<string, unknown> | string> = Array.isArray(areaInfo.overviewPhotos)
          ? [...(areaInfo.overviewPhotos as Array<Record<string, unknown> | string>)]
          : [];
        if (action === 'ADD') {
          const urls = Array.isArray(pa.newPhotoUrls) && pa.newPhotoUrls.length > 0 ? pa.newPhotoUrls : newUrl ? [newUrl] : [];
          for (const u of urls) {
            if (u) curOv.push({ url: u, photoCode: pa.photoCode || `OV-${curOv.length + 1}`, caption: pa.caption || '' });
          }
        } else if (action === 'REPLACE' || action === 'RESTORE') {
          if (curOv.length > idx) {
            const curItem = curOv[idx];
            curOv[idx] = typeof curItem === 'object' && curItem !== null ? { ...curItem, url: newUrl } : { url: newUrl };
          } else if (newUrl) {
            curOv.push({ url: newUrl, photoCode: pa.photoCode || `OV-${curOv.length + 1}` });
          }
        } else if (action === 'DELETE') {
          if (oldUrl) {
            const filtered = curOv.filter((item) => (typeof item === 'string' ? item !== oldUrl : item?.url !== oldUrl));
            curOv.splice(0, curOv.length, ...filtered);
          } else if (idx >= 0 && idx < curOv.length) {
            curOv.splice(idx, 1);
          }
        }
        areaInfo.overviewPhotos = curOv;
      }
      surveyJson.areaInfo = areaInfo;
    }

    // 2d. Đồng bộ ảnh Bản vẽ hoàn công (AS_BUILT)
    if (cat === 'AS_BUILT' || type === 'AS_BUILT_DRAWING' || type === 'AS_BUILT') {
      const curAsBuilt: Array<Record<string, unknown> | string> = Array.isArray(surveyJson.asBuiltDrawingPhotos)
        ? [...(surveyJson.asBuiltDrawingPhotos as Array<Record<string, unknown> | string>)]
        : [];
      if (action === 'ADD') {
        const urls = Array.isArray(pa.newPhotoUrls) && pa.newPhotoUrls.length > 0 ? pa.newPhotoUrls : newUrl ? [newUrl] : [];
        for (const u of urls) {
          if (u) curAsBuilt.push({ url: u, photoCode: pa.photoCode || `AS_BUILT_${curAsBuilt.length + 1}`, notes: pa.caption || 'Bản vẽ hoàn công' });
        }
      } else if (action === 'REPLACE' || action === 'RESTORE') {
        if (curAsBuilt.length > idx) {
          const item = curAsBuilt[idx];
          curAsBuilt[idx] = typeof item === 'object' && item !== null ? { ...item, url: newUrl } : { url: newUrl };
        } else if (newUrl) {
          curAsBuilt.push({ url: newUrl, photoCode: pa.photoCode || 'AS_BUILT_01', notes: pa.caption || 'Bản vẽ hoàn công' });
        }
      } else if (action === 'DELETE') {
        if (oldUrl) {
          const filtered = curAsBuilt.filter((item) => (typeof item === 'string' ? item !== oldUrl : item?.url !== oldUrl));
          curAsBuilt.splice(0, curAsBuilt.length, ...filtered);
        } else if (idx >= 0 && idx < curAsBuilt.length) {
          curAsBuilt.splice(idx, 1);
        }
      }
      surveyJson.asBuiltDrawingPhotos = curAsBuilt;
      const firstUrl =
        curAsBuilt.length > 0
          ? typeof curAsBuilt[0] === 'string'
            ? curAsBuilt[0]
            : String((curAsBuilt[0] as Record<string, unknown>)?.url || '')
          : '';
      surveyJson.asBuiltDrawingPhotoUrl = firstUrl || null;
    }
  }

  /**
   * Đồng bộ trạng thái ACTIVE / SUPERSEDED của survey_photo_registry khi thực hiện Rollback về phiên bản v(k)
   */
  static async syncPhotoRegistryOnRollbackInTx(
    client: PoolClient,
    reportId: string,
    restoredSurveyJson: Record<string, unknown>,
    snapshotData: Record<string, unknown>
  ): Promise<void> {
    const urls: string[] = [];
    const addUrl = (val: unknown) => {
      if (!val) return;
      if (typeof val === 'string' && val.trim()) {
        urls.push(val.trim());
      } else if (typeof val === 'object') {
        const rec = val as Record<string, unknown>;
        const u = rec.url || rec.photoUrl || rec.rawPhotoUrl || rec.raw_photo_url || rec.annotated_photo_url;
        if (typeof u === 'string' && u.trim()) urls.push(u.trim());
      }
    };

    // 1. Ảnh định danh P01..P04
    const idPhotos = (restoredSurveyJson.identificationPhotos || snapshotData.identificationPhotos || {}) as Record<string, unknown>;
    for (const k of ['photoP01', 'photoP02', 'photoP03', 'photoP04']) {
      addUrl(restoredSurveyJson[k]);
      addUrl(idPhotos[k]);
    }

    // 2. Ảnh khu vực chung (areaInfo) & bản vẽ hoàn công
    const areaInfo = (restoredSurveyJson.areaInfo || {}) as Record<string, unknown>;
    addUrl(areaInfo.croppedCadUrl || restoredSurveyJson.croppedCadUrl);
    if (Array.isArray(areaInfo.overviewPhotos)) areaInfo.overviewPhotos.forEach(addUrl);
    if (Array.isArray(restoredSurveyJson.asBuiltDrawingPhotos)) restoredSurveyJson.asBuiltDrawingPhotos.forEach(addUrl);
    addUrl(restoredSurveyJson.asBuiltDrawingPhotoUrl);
    addUrl(restoredSurveyJson.unitFloorPlanSketchUrl);

    // 3. Ảnh Vùng Z, Cấu kiện E & Vết nứt D
    const collectFromZonesOrElems = (arr: unknown) => {
      if (!Array.isArray(arr)) return;
      for (const z of arr) {
        const zObj = z as Record<string, unknown>;
        if (zObj.isDeleted || zObj.is_deleted) continue;
        addUrl(zObj.ctxPhotoUrl || zObj.ctx_photo_url);
        if (Array.isArray(zObj.overviewPhotos)) zObj.overviewPhotos.forEach(addUrl);
        if (Array.isArray(zObj.defects)) {
          for (const d of zObj.defects as Array<Record<string, unknown>>) {
            if (d.isDeleted || d.is_deleted) continue;
            addUrl(d.cuPhotoUrl || d.cu_photo_url);
            if (Array.isArray(d.cuPhotos)) d.cuPhotos.forEach(addUrl);
          }
        }
      }
    };

    collectFromZonesOrElems(restoredSurveyJson.damageZones);
    collectFromZonesOrElems(restoredSurveyJson.structuralElements);
    if (Array.isArray(restoredSurveyJson.floors)) {
      for (const fl of restoredSurveyJson.floors as Array<Record<string, unknown>>) {
        addUrl(fl.cadDrawingUrl || fl.cadSketchPhotoUrl);
        collectFromZonesOrElems(fl.zones);
        collectFromZonesOrElems(fl.structuralElements);
      }
    }

    // 4. Ảnh nghiêng lún, võng dầm, chữ ký, biên bản, vắng mặt
    const st = (restoredSurveyJson.settlementTilt || {}) as Record<string, unknown>;
    for (const subKey of ['diffSettlement', 'buildingTilt', 'beamSagging', 'abnormalCase']) {
      const sub = (st[subKey] || {}) as Record<string, unknown>;
      addUrl(sub.photoUrl);
      if (Array.isArray(sub.photos)) sub.photos.forEach(addUrl);
    }

    const sigs = (restoredSurveyJson.signatures || snapshotData.signatures || {}) as Record<string, unknown>;
    addUrl(sigs.surveyorSignature || sigs.surveyorSignatureUrl || restoredSurveyJson.surveyorSignatureUrl);
    addUrl(sigs.ownerSignature || sigs.ownerSignatureUrl || restoredSurveyJson.ownerSignatureUrl);
    if (Array.isArray(sigs.workingMinutesPhotos)) sigs.workingMinutesPhotos.forEach(addUrl);
    if (Array.isArray(restoredSurveyJson.workingMinutesPhotos)) restoredSurveyJson.workingMinutesPhotos.forEach(addUrl);
    if (Array.isArray(restoredSurveyJson.absenteeNoticePhotos)) restoredSurveyJson.absenteeNoticePhotos.forEach(addUrl);

    const uniqueUrls = Array.from(new Set(urls));
    if (uniqueUrls.length > 0) {
      await client.query(
        `UPDATE survey_photo_registry SET
           status = 'ACTIVE',
           is_deleted = FALSE,
           updated_at = NOW()
         WHERE report_id = $1 AND photo_url = ANY($2::text[]);`,
        [reportId, uniqueUrls]
      );
      await client.query(
        `UPDATE survey_photo_registry SET
           status = 'SUPERSEDED',
           updated_at = NOW()
         WHERE report_id = $1 AND NOT (photo_url = ANY($2::text[]));`,
        [reportId, uniqueUrls]
      );
    } else {
      await client.query(
        `UPDATE survey_photo_registry SET status = 'SUPERSEDED', updated_at = NOW() WHERE report_id = $1;`,
        [reportId]
      );
    }
  }

  static computeHash(input: string): string {
    return computeSha256Hex(input);
  }
}

