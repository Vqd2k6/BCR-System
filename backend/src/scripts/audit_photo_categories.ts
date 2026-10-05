import { pool } from '../database/db';
import * as fs from 'fs';
import * as path from 'path';

async function auditAllParcelsPhotos() {
  const codes = ['C&C-05-B-0054', 'C&C-05-B-0056', 'C&C-05-B-0058', 'C&C-05-B-0154', 'C&C-05-B-0156', 'C&C-05-B-0158'];

  const reportSummary: any[] = [];

  for (const c of codes) {
    const rptRes = await pool.query(
      `SELECT r.id, r.report_code, r.owner_signature_url, r.surveyor_signature_url, r.survey_data_json 
       FROM parcels p 
       JOIN base_survey_reports r ON r.parcel_id = p.id 
       WHERE p.project_parcel_code = $1`,
      [c]
    );
    if (rptRes.rows.length === 0) continue;
    const reportId = rptRes.rows[0].id;
    const sjson = rptRes.rows[0].survey_data_json || {};

    // 1. Exterior / Identification photos
    const ident = await pool.query(
      `SELECT photo_type, photo_code, raw_photo_url FROM survey_identification_photos WHERE report_id = $1`,
      [reportId]
    );

    // 2. Overview room/space photos from floors & zones
    let totalOverviewPhotos = 0;
    const overviewList: string[] = [];
    if (sjson.floors && Array.isArray(sjson.floors)) {
      for (const fl of sjson.floors) {
        if (Array.isArray(fl.overviewPhotos)) {
          totalOverviewPhotos += fl.overviewPhotos.length;
          fl.overviewPhotos.forEach((p: any) => overviewList.push(typeof p === 'string' ? p : p.url));
        }
        if (Array.isArray(fl.zones)) {
          for (const zn of fl.zones) {
            if (Array.isArray(zn.overviewPhotos)) {
              totalOverviewPhotos += zn.overviewPhotos.length;
              zn.overviewPhotos.forEach((p: any) => overviewList.push(typeof p === 'string' ? p : p.url));
            }
          }
        }
        if (Array.isArray(fl.structuralElements)) {
          for (const se of fl.structuralElements) {
            if (Array.isArray(se.overviewPhotos)) {
              totalOverviewPhotos += se.overviewPhotos.length;
              se.overviewPhotos.forEach((p: any) => overviewList.push(typeof p === 'string' ? p : p.url));
            }
          }
        }
      }
    }

    // 3. Context photos (Zone Ctx) - both damaged zones and undamaged zones
    let totalCtxPhotos = 0;
    let undamagedZonesWithPhotos = 0;
    let damagedZonesWithPhotos = 0;
    if (sjson.floors && Array.isArray(sjson.floors)) {
      for (const fl of sjson.floors) {
        if (Array.isArray(fl.zones)) {
          for (const zn of fl.zones) {
            if (zn.ctxPhotoUrl) {
              totalCtxPhotos++;
              if (zn.defects && zn.defects.length > 0) damagedZonesWithPhotos++;
              else undamagedZonesWithPhotos++;
            }
          }
        }
        if (Array.isArray(fl.structuralElements)) {
          for (const se of fl.structuralElements) {
            if (se.ctxPhotoUrl) totalCtxPhotos++;
          }
        }
      }
    }

    // 4. Defect CU photos (close-up) and Extra CU photos
    let totalDefectItems = 0;
    let totalCuPhotos = 0;
    let defectsWithMultipleCuPhotos = 0;
    if (sjson.floors && Array.isArray(sjson.floors)) {
      for (const fl of sjson.floors) {
        if (Array.isArray(fl.zones)) {
          for (const zn of fl.zones) {
            if (Array.isArray(zn.defects)) {
              for (const df of zn.defects) {
                totalDefectItems++;
                const count = Array.isArray(df.cuPhotos) ? df.cuPhotos.length : (df.cuPhotoUrl ? 1 : 0);
                totalCuPhotos += count;
                if (count > 1) defectsWithMultipleCuPhotos++;
              }
            }
          }
        }
        if (Array.isArray(fl.structuralElements)) {
          for (const se of fl.structuralElements) {
            if (Array.isArray(se.defects)) {
              for (const df of se.defects) {
                totalDefectItems++;
                const count = Array.isArray(df.cuPhotos) ? df.cuPhotos.length : (df.cuPhotoUrl ? 1 : 0);
                totalCuPhotos += count;
                if (count > 1) defectsWithMultipleCuPhotos++;
              }
            }
          }
        }
      }
    }

    // 5. Floor CAD drawings & sketches
    let floorCadDrawings = 0;
    if (sjson.floors && Array.isArray(sjson.floors)) {
      for (const fl of sjson.floors) {
        if (fl.cadDrawingUrl || fl.cadSketchPhotoUrl) floorCadDrawings++;
        if (fl.cadStructuralDrawingUrl || fl.cadStructuralSketchPhotoUrl) floorCadDrawings++;
      }
    }

    // 6. Tilt & Settlement measurement photos
    const tiltPhoto = Boolean(sjson.settlementTilt?.buildingTilt?.photoUrl);
    const settlePhoto = Boolean(sjson.settlementTilt?.diffSettlement?.photoUrl);

    // 7. Signed minutes & signatures
    const minutesCount = sjson.signatures?.signedRecordPhotos?.length || sjson.signedMinutesPhotos?.length || 0;
    const hasOwnerSig = Boolean(rptRes.rows[0].owner_signature_url || sjson.signatures?.ownerSignatureUrl);
    const hasSurveyorSig = Boolean(rptRes.rows[0].surveyor_signature_url || sjson.signatures?.surveyorSignatureUrl);

    reportSummary.push({
      parcel: c,
      identPhotos: ident.rows.length,
      overviewPhotos: totalOverviewPhotos,
      ctxPhotos: totalCtxPhotos,
      undamagedZonesPhotos: undamagedZonesWithPhotos,
      damagedZonesPhotos: damagedZonesWithPhotos,
      defectItems: totalDefectItems,
      cuPhotos: totalCuPhotos,
      defectsWithMultipleCu: defectsWithMultipleCuPhotos,
      floorCadDrawings,
      tiltPhoto,
      settlePhoto,
      minutesPages: minutesCount,
      hasSignatures: hasOwnerSig && hasSurveyorSig,
    });
  }

  console.table(reportSummary);
  await pool.end();
}

auditAllParcelsPhotos();
