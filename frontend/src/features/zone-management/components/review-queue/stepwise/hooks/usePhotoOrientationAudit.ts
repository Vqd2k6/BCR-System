import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  evaluateResidentialOrientation,
  RESIDENTIAL_PHOTO_RULES,
  normalizeRotationAngle,
  type PhotoOrientationType,
  type ExpectedOrientation,
} from '../utils/residentialPhotoOrientationStandards';
import type { PhotoActionPayload } from '../../AuditPhotoActionModal';

export interface PhotoOrientationViolation {
  key: string;
  photoCode?: string;
  title: string;
  photoUrl: string;
  stepId: string;
  domElementId: string;
  currentOrientation: PhotoOrientationType;
  expectedOrientation: ExpectedOrientation;
  effectiveRotation: number;
  suggestedRotation?: number;
  isStrict: boolean;
  message: string;
  floorIndex?: number;
  zoneCode?: string;
  defectCode?: string;
  photoIndex?: number;
}

export interface AuditedPhotoItem {
  key: string;
  ruleKey: string;
  photoCode?: string;
  title: string;
  photoUrl: string;
  stepId: string;
  domElementId: string;
  floorIndex?: number;
  zoneCode?: string;
  defectCode?: string;
  photoIndex?: number;
  aliases?: string[];
}

// Global in-memory cache kích thước ảnh để tránh load lại nhiều lần
const imageDimensionsCache = new Map<string, { width: number; height: number }>();

export function usePhotoOrientationAudit(
  data: Record<string, unknown> | null | undefined,
  formState?: Record<string, unknown>,
  stagedPhotoActions?: PhotoActionPayload[]
) {
  // Lấy dữ liệu survey_data_json gốc kết hợp với dữ liệu thực tế từ formState & rightPane
  const surveyJson = useMemo(() => {
    const base: Record<string, unknown> = {};
    if (data) {
      const raw = data.surveyJson || data.survey_data_json || data;
      if (typeof raw === 'string') {
        try {
          Object.assign(base, JSON.parse(raw) as Record<string, unknown>);
        } catch {
          // ignore invalid json
        }
      } else if (raw && typeof raw === 'object') {
        Object.assign(base, raw as Record<string, unknown>);
      }
      const rightPane = (data.rightPane || {}) as Record<string, unknown>;
      if (rightPane.identificationPhotos && typeof rightPane.identificationPhotos === 'object') {
        base.identificationPhotos = {
          ...((base.identificationPhotos as Record<string, unknown>) || {}),
          ...(rightPane.identificationPhotos as Record<string, unknown>),
        };
      }
    }
    if (formState && typeof formState === 'object') {
      for (const [k, v] of Object.entries(formState)) {
        if (v !== undefined) {
          base[k] = v;
        }
      }
    }
    return base;
  }, [data, formState]);

  // Quản lý staged rotations (các góc xoay do Thẩm định viên thay đổi)
  const [stagedPhotoRotations, setStagedPhotoRotations] = useState<Record<string, number>>(() => {
    const existing = (surveyJson.photoRotations || {}) as Record<string, number>;
    return { ...existing };
  });

  // Đồng bộ stagedPhotoRotations khi formState.photoRotations thay đổi (ví dụ khi Hủy / Rollback / Mở hồ sơ mới)
  useEffect(() => {
    const fromForm = formState?.photoRotations as Record<string, number> | undefined;
    if (fromForm && typeof fromForm === 'object') {
      setStagedPhotoRotations((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(fromForm)) return prev;
        return { ...fromForm };
      });
    } else if (surveyJson.photoRotations && typeof surveyJson.photoRotations === 'object' && !formState) {
      const existing = surveyJson.photoRotations as Record<string, number>;
      setStagedPhotoRotations((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(existing)) return prev;
        return { ...existing };
      });
    }
  }, [formState?.photoRotations, surveyJson.photoRotations]);

  // State lưu kích thước ảnh đã đo được
  const [measuredDimensions, setMeasuredDimensions] = useState<Record<string, { width: number; height: number }>>({});

  // Cập nhật góc xoay cho 1 ảnh cụ thể (Thẩm định viên chủ động xoay)
  const setPhotoRotation = useCallback((photoKey: string, rotationDeg: number, photoUrl?: string) => {
    const norm = normalizeRotationAngle(rotationDeg);
    setStagedPhotoRotations((prev) => ({
      ...prev,
      [photoKey]: norm,
      ...(photoUrl ? { [photoUrl]: norm } : {}),
    }));
  }, []);

  // Lấy góc xoay hiện tại của 1 ảnh (hỗ trợ đọc theo photoKey, aliases và photoUrl)
  const getPhotoRotation = useCallback(
    (photoKey: string, photoUrl?: string, aliases?: string[]): number => {
      if (photoKey in stagedPhotoRotations) {
        return stagedPhotoRotations[photoKey];
      }
      if (aliases) {
        for (const alias of aliases) {
          if (alias && alias in stagedPhotoRotations) {
            return stagedPhotoRotations[alias];
          }
        }
      }
      if (photoUrl && photoUrl in stagedPhotoRotations) {
        return stagedPhotoRotations[photoUrl];
      }
      const existingRotations = (surveyJson.photoRotations || {}) as Record<string, number>;
      if (photoKey in existingRotations) {
        return existingRotations[photoKey];
      }
      if (aliases) {
        for (const alias of aliases) {
          if (alias && alias in existingRotations) {
            return existingRotations[alias];
          }
        }
      }
      if (photoUrl && photoUrl in existingRotations) {
        return existingRotations[photoUrl];
      }
      return 0;
    },
    [stagedPhotoRotations, surveyJson]
  );

  // Helper áp dụng stagedPhotoActions (Thay thế / Xóa ảnh trong phiên) lên URL gốc
  const resolveUrlWithStagedActions = useCallback(
    (rawUrl: string, targetPhotoId?: string, photoIndex?: number): string => {
      if (!rawUrl || typeof rawUrl !== 'string') return '';
      if (!stagedPhotoActions || stagedPhotoActions.length === 0) return rawUrl;

      let currentUrl = rawUrl;
      for (const act of stagedPhotoActions) {
        const matchesUrl = act.oldPhotoUrl && act.oldPhotoUrl === rawUrl;
        const matchesTarget =
          targetPhotoId &&
          act.targetPhotoId === targetPhotoId &&
          (photoIndex === undefined || act.photoIndex === undefined || act.photoIndex === photoIndex);

        if (matchesUrl || matchesTarget) {
          if (act.action === 'DELETE') {
            return '';
          }
          if (act.action === 'REPLACE' && act.newPhotoUrl) {
            currentUrl = act.newPhotoUrl;
          }
        }
      }
      return currentUrl;
    },
    [stagedPhotoActions]
  );

  // 1. Thu thập toàn bộ danh sách ảnh cần kiểm toán trong hồ sơ Nhà Dân (24 vị trí ảnh)
  const photoCandidates = useMemo<AuditedPhotoItem[]>(() => {
    const list: AuditedPhotoItem[] = [];
    const seenKeys = new Set<string>();

    const addCandidate = (item: AuditedPhotoItem) => {
      if (!item.photoUrl || typeof item.photoUrl !== 'string' || item.photoUrl.trim() === '') return;
      if (seenKeys.has(item.key)) return; // Khử trùng lặp theo key vị trí độc lập, KHÔNG khử theo URL
      seenKeys.add(item.key);
      list.push(item);
    };

    // Helper an toàn trích xuất URL, photoCode & trạng thái N/A / Deleted
    const getPhotoInfo = (
      obj: unknown
    ): {
      url: string;
      code?: string;
      notApplicable?: boolean;
      isDeleted?: boolean;
      additionalPhotos?: unknown[];
    } => {
      if (!obj) return { url: '' };
      if (typeof obj === 'string') return { url: obj };
      if (typeof obj === 'object') {
        const o = obj as {
          url?: string;
          photoUrl?: string;
          raw_photo_url?: string;
          annotated_photo_url?: string;
          photoCode?: string;
          notApplicable?: boolean;
          isNotApplicable?: boolean;
          isDeleted?: boolean;
          is_deleted?: boolean;
          additionalPhotos?: unknown[];
        };
        const notApplicable = Boolean(o.notApplicable ?? o.isNotApplicable);
        const isDeleted = Boolean(o.isDeleted ?? o.is_deleted);
        if (notApplicable || isDeleted) {
          return { url: '', notApplicable, isDeleted };
        }
        return {
          url: o.url || o.photoUrl || o.raw_photo_url || o.annotated_photo_url || '',
          code: o.photoCode,
          notApplicable,
          isDeleted,
          additionalPhotos: Array.isArray(o.additionalPhotos) ? o.additionalPhotos : undefined,
        };
      }
      return { url: '' };
    };

    // =========================================================================
    // BƯỚC 1: NHẬN DIỆN & HIỆN TRẠNG TỔNG QUAN (P-01..P-04, P-03 phụ, Đất trống, Đang XD)
    // =========================================================================
    const p1 = (surveyJson.identificationPhotos || {}) as Record<string, unknown>;

    const p01 = getPhotoInfo(p1.photoP01 || surveyJson.photoP01);
    const p01Url = resolveUrlWithStagedActions(p01.url, 'photoP01');
    if (p01Url && !p01.notApplicable) {
      addCandidate({
        key: 'photoP01',
        ruleKey: 'photoP01',
        photoCode: p01.code || 'P-01',
        title: 'Biển số nhà & cổng chính (P-01)',
        photoUrl: p01Url,
        stepId: 'step-1',
        domElementId: 'audit-photo-card-P-01',
        aliases: ['P-01', 'P01'],
      });
    }

    const p02 = getPhotoInfo(p1.photoP02 || surveyJson.photoP02);
    const p02Url = resolveUrlWithStagedActions(p02.url, 'photoP02');
    if (p02Url && !p02.notApplicable) {
      addCandidate({
        key: 'photoP02',
        ruleKey: 'photoP02',
        photoCode: p02.code || 'P-02',
        title: 'Mặt đứng chính & phân tầng (P-02)',
        photoUrl: p02Url,
        stepId: 'step-1',
        domElementId: 'audit-photo-card-P-02',
        aliases: ['P-02', 'P02'],
      });
    }

    const p03 = getPhotoInfo(p1.photoP03 || surveyJson.photoP03);
    const p03Url = resolveUrlWithStagedActions(p03.url, 'photoP03');
    const p03Code = p03.code || 'P-03_1';
    if (p03Url && !p03.notApplicable) {
      addCandidate({
        key: 'photoP03',
        ruleKey: 'photoP03',
        photoCode: p03Code,
        title: 'Mặt bên & hẻm hông chính (P-03)',
        photoUrl: p03Url,
        stepId: 'step-1',
        domElementId: `audit-photo-card-${p03Code}`,
        aliases: ['P-03', 'P03', 'P-03_1'],
      });
    }

    // Các ảnh P-03 bổ sung (tối đa +2 ảnh mặt bên thứ 2 / mặt sau)
    if (Array.isArray(p03.additionalPhotos)) {
      p03.additionalPhotos.forEach((extra, extraIdx) => {
        const extraInfo = getPhotoInfo(extra);
        const extraUrl = resolveUrlWithStagedActions(
          extraInfo.url,
          'identificationPhotos.photoP03.additionalPhotos',
          extraIdx
        );
        const extraCode = extraInfo.code || `P-03_${extraIdx + 2}`;
        if (extraUrl && !extraInfo.notApplicable && !extraInfo.isDeleted) {
          addCandidate({
            key: `photoP03_extra_${extraIdx}`,
            ruleKey: 'photoP03',
            photoCode: extraCode,
            title: `Mặt bên / mặt sau bổ sung #${extraIdx + 1} (${extraCode})`,
            photoUrl: extraUrl,
            stepId: 'step-1',
            domElementId: `audit-photo-card-${extraCode}`,
            photoIndex: extraIdx,
            aliases: [extraCode, `P-03_${extraIdx + 2}`],
          });
        }
      });
    }

    const p04 = getPhotoInfo(p1.photoP04 || surveyJson.photoP04);
    const p04Url = resolveUrlWithStagedActions(p04.url, 'photoP04');
    if (p04Url && !p04.notApplicable) {
      addCandidate({
        key: 'photoP04',
        ruleKey: 'photoP04',
        photoCode: p04.code || 'P-04',
        title: 'Mặt đường & vỉa hè (P-04)',
        photoUrl: p04Url,
        stepId: 'step-1',
        domElementId: 'audit-photo-card-P-04',
        aliases: ['P-04', 'P04'],
      });
    }

    // Ảnh hiện trạng đất trống (vacantLandPhotos)
    const vacantPhotos = Array.isArray(surveyJson.vacantLandPhotos) ? surveyJson.vacantLandPhotos : [];
    vacantPhotos.forEach((vp, vIdx) => {
      const vpInfo = getPhotoInfo(vp);
      const vpUrl = resolveUrlWithStagedActions(vpInfo.url, 'vacantLandPhotos', vIdx);
      if (vpUrl && !vpInfo.isDeleted) {
        addCandidate({
          key: `vacantLand_${vIdx}`,
          ruleKey: 'vacantLand',
          photoCode: vpInfo.code || `VACANT_${vIdx + 1}`,
          title: `Ảnh hiện trạng đất trống #${vIdx + 1}`,
          photoUrl: vpUrl,
          stepId: 'step-1',
          domElementId: `audit-photo-card-vacant-land-${vIdx}`,
          photoIndex: vIdx,
          aliases: [vpInfo.code || `VACANT_LAND_${vIdx + 1}`],
        });
      }
    });

    // Ảnh công trình đang xây dựng (underConstructionPhotos)
    const ucPhotos = Array.isArray(surveyJson.underConstructionPhotos) ? surveyJson.underConstructionPhotos : [];
    ucPhotos.forEach((ucp, ucIdx) => {
      const ucpInfo = getPhotoInfo(ucp);
      const ucpUrl = resolveUrlWithStagedActions(ucpInfo.url, 'underConstructionPhotos', ucIdx);
      if (ucpUrl && !ucpInfo.isDeleted) {
        addCandidate({
          key: `underConstruction_${ucIdx}`,
          ruleKey: 'underConstruction',
          photoCode: ucpInfo.code || `UC_${ucIdx + 1}`,
          title: `Ảnh công trình đang xây dựng #${ucIdx + 1}`,
          photoUrl: ucpUrl,
          stepId: 'step-1',
          domElementId: `audit-photo-card-under-construction-${ucIdx}`,
          photoIndex: ucIdx,
          aliases: [ucpInfo.code || `UNDER_CONSTRUCTION_${ucIdx + 1}`],
        });
      }
    });

    // =========================================================================
    // BƯỚC 2: ĐO BIẾN DẠNG, LÚN NGHIÊNG & BẤT THƯỜNG (AuditStep5SettlementTilt)
    // =========================================================================
    const st = (surveyJson.settlementTilt || {}) as Record<string, unknown>;

    const tilt = (st.buildingTilt || surveyJson.buildingTilt || {}) as Record<string, unknown>;
    const tiltPhotos =
      Array.isArray(tilt.photos) && tilt.photos.length > 0
        ? tilt.photos
        : tilt.photoUrl
          ? [tilt.photoUrl]
          : [];
    tiltPhotos.forEach((tp, pIdx) => {
      const tpInfo = getPhotoInfo(tp);
      const tpUrl = resolveUrlWithStagedActions(tpInfo.url, 'settlementTilt.buildingTilt.photos', pIdx);
      if (tpUrl && !tpInfo.isDeleted) {
        const key = tiltPhotos.length > 1 ? `buildingTilt_${pIdx}` : 'buildingTilt';
        const code = tpInfo.code || (tiltPhotos.length > 1 ? `TILT_${pIdx + 1}` : 'P-05');
        addCandidate({
          key,
          ruleKey: 'buildingTilt',
          photoCode: code,
          title: tiltPhotos.length > 1 ? `Ảnh đo độ nghiêng thân nhà #${pIdx + 1}` : 'Ảnh đo độ nghiêng thân nhà (P-05)',
          photoUrl: tpUrl,
          stepId: 'step-2',
          domElementId: `audit-photo-card-building-tilt-${pIdx}`,
          photoIndex: pIdx,
          aliases: [`buildingTilt_${pIdx}`, 'buildingTilt', code, 'P-05', `TILT_0${pIdx + 1}`],
        });
      }
    });

    const sag = (st.beamSagging || surveyJson.beamSagging || {}) as Record<string, unknown>;
    const sagPhotos =
      Array.isArray(sag.photos) && sag.photos.length > 0
        ? sag.photos
        : sag.photoUrl
          ? [sag.photoUrl]
          : [];
    sagPhotos.forEach((sp, pIdx) => {
      const spInfo = getPhotoInfo(sp);
      const spUrl = resolveUrlWithStagedActions(spInfo.url, 'settlementTilt.beamSagging.photos', pIdx);
      if (spUrl && !spInfo.isDeleted) {
        const key = sagPhotos.length > 1 ? `beamSagging_${pIdx}` : 'beamSagging';
        const code = spInfo.code || (sagPhotos.length > 1 ? `SAG_${pIdx + 1}` : 'SAG_01');
        addCandidate({
          key,
          ruleKey: 'beamSagging',
          photoCode: code,
          title: sagPhotos.length > 1 ? `Ảnh đo độ võng dầm sàn #${pIdx + 1}` : 'Ảnh đo độ võng dầm sàn',
          photoUrl: spUrl,
          stepId: 'step-2',
          domElementId: `audit-photo-card-beam-sagging-${pIdx}`,
          photoIndex: pIdx,
          aliases: [`beamSagging_${pIdx}`, 'beamSagging', code, `SAG_0${pIdx + 1}`],
        });
      }
    });

    const settle = (st.diffSettlement || surveyJson.diffSettlement || {}) as Record<string, unknown>;
    const settlePhotos =
      Array.isArray(settle.photos) && settle.photos.length > 0
        ? settle.photos
        : settle.photoUrl
          ? [settle.photoUrl]
          : [];
    settlePhotos.forEach((sep, pIdx) => {
      const sepInfo = getPhotoInfo(sep);
      const sepUrl = resolveUrlWithStagedActions(sepInfo.url, 'settlementTilt.diffSettlement.photos', pIdx);
      if (sepUrl && !sepInfo.isDeleted) {
        const key = settlePhotos.length > 1 ? `diffSettlement_${pIdx}` : 'diffSettlement';
        const code = sepInfo.code || (settlePhotos.length > 1 ? `SETTLE_${pIdx + 1}` : 'P-06');
        addCandidate({
          key,
          ruleKey: 'diffSettlement',
          photoCode: code,
          title: settlePhotos.length > 1 ? `Ảnh lún lệch chân tường #${pIdx + 1}` : 'Ảnh lún lệch chân tường (P-06)',
          photoUrl: sepUrl,
          stepId: 'step-2',
          domElementId: `audit-photo-card-diff-settlement-${pIdx}`,
          photoIndex: pIdx,
          aliases: [`diffSettlement_${pIdx}`, 'diffSettlement', code, 'P-06', `SETTLE_0${pIdx + 1}`],
        });
      }
    });

    const abnormal = (st.abnormalCase || surveyJson.abnormalCase || {}) as Record<string, unknown>;
    const abnormalPhotos =
      Array.isArray(abnormal.photos) && abnormal.photos.length > 0
        ? abnormal.photos
        : abnormal.photoUrl
          ? [abnormal.photoUrl]
          : [];
    abnormalPhotos.forEach((abp, pIdx) => {
      const abpInfo = getPhotoInfo(abp);
      const abpUrl = resolveUrlWithStagedActions(abpInfo.url, 'settlementTilt.abnormalCase.photos', pIdx);
      if (abpUrl && !abpInfo.isDeleted) {
        const key = abnormalPhotos.length > 1 ? `abnormalCase_${pIdx}` : 'abnormalCase';
        const code = abpInfo.code || (abnormalPhotos.length > 1 ? `ANOMALY_${pIdx + 1}` : 'P-07');
        addCandidate({
          key,
          ruleKey: 'abnormalCase',
          photoCode: code,
          title: abnormalPhotos.length > 1 ? `Ảnh hiện trạng bất thường #${pIdx + 1}` : 'Ảnh hiện trạng bất thường (P-07)',
          photoUrl: abpUrl,
          stepId: 'step-2',
          domElementId: `audit-photo-card-abnormal-${pIdx}`,
          photoIndex: pIdx,
          aliases: [`abnormalCase_${pIdx}`, 'abnormalCase', code, 'P-07', `ANOMALY_0${pIdx + 1}`],
        });
      }
    });

    // =========================================================================
    // BƯỚC 3: KẾT CẤU, NỀN MÓNG & BẢN VẼ HOÀN CÔNG (AuditStep2OwnerInterview)
    // =========================================================================
    const rawAsBuilt =
      Array.isArray(surveyJson.asBuiltDrawingPhotos) && surveyJson.asBuiltDrawingPhotos.length > 0
        ? surveyJson.asBuiltDrawingPhotos
        : surveyJson.asBuiltDrawingPhotoUrl
          ? [{ url: surveyJson.asBuiltDrawingPhotoUrl, photoCode: 'CAT-DWG-01' }]
          : [];
    rawAsBuilt.forEach((dwg, dIdx) => {
      const dwgInfo = getPhotoInfo(dwg);
      const dwgUrl = resolveUrlWithStagedActions(dwgInfo.url, 'asBuiltDrawingPhotos', dIdx);
      if (dwgUrl && !dwgInfo.isDeleted) {
        const code = dwgInfo.code || `CAT-DWG-${String(dIdx + 1).padStart(2, '0')}`;
        addCandidate({
          key: `asBuiltDrawing_${dIdx}`,
          ruleKey: 'AS_BUILT_DRAWING',
          photoCode: code,
          title: `Bản vẽ hoàn công / thiết kế móng #${dIdx + 1}`,
          photoUrl: dwgUrl,
          stepId: 'step-3',
          domElementId: `audit-photo-card-asbuilt-${dIdx}`,
          photoIndex: dIdx,
          aliases: [code, `AS_BUILT_${dIdx + 1}`],
        });
      }
    });

    // =========================================================================
    // BƯỚC 4: TẦNG, SƠ ĐỒ CAD, VÙNG Z, CẤU KIỆN E & KHUYẾT TẬT D (AuditStep3FloorDefects)
    // =========================================================================
    const floors = (surveyJson.floors || []) as Array<Record<string, unknown>>;
    const hasFloors = Array.isArray(floors) && floors.length > 0;

    if (hasFloors) {
      floors.forEach((f, fIdx) => {
        if (f.isDeleted || f.is_deleted) return;
        const floorName = (f.floorName || `Tầng ${fIdx + 1}`) as string;
        const fId = f.id ? String(f.id) : '';

        // 1. Sơ đồ CAD kiến trúc mặt bằng tầng (CAD_01)
        const rawCadUrl = (f.cadSketchPhotoUrl || f.damageMapUrl || f.cadPhotoUrl || '') as string;
        const cadUrl = resolveUrlWithStagedActions(rawCadUrl, `floors[${fIdx}].cadSketchPhotoUrl`);
        const floorCadKey = fId ? (fId.startsWith('floor_') ? `${fId}_cad` : `floor_${fId}_cad`) : `floor_${fIdx}_cad`;
        if (cadUrl) {
          addCandidate({
            key: floorCadKey,
            ruleKey: 'CAD_SKETCH',
            photoCode: `CAD-${fIdx + 1}`,
            title: `Sơ đồ mặt bằng kiến trúc ${floorName}`,
            photoUrl: cadUrl,
            stepId: 'step-4',
            domElementId: `audit-cad-sketch-${fIdx}`,
            floorIndex: fIdx,
            aliases: [`floor_${fIdx}_cad`, `floor_${fIdx + 1}_cad`, `cad_${fId || fIdx + 1}`],
          });
        }

        // 2. Sơ đồ CAD kết cấu mặt bằng tầng (CAD_02) nếu có tách riêng
        const rawStructCadUrl = (f.cadStructuralSketchPhotoUrl || f.structuralMapUrl || '') as string;
        const structCadUrl = resolveUrlWithStagedActions(rawStructCadUrl, `floors[${fIdx}].cadStructuralSketchPhotoUrl`);
        if (structCadUrl && structCadUrl !== cadUrl) {
          const structCadKey = fId
            ? fId.startsWith('floor_')
              ? `${fId}_structural_cad`
              : `floor_${fId}_structural_cad`
            : `floor_${fIdx}_structural_cad`;
          addCandidate({
            key: structCadKey,
            ruleKey: 'CAD_SKETCH',
            photoCode: `CAD-STRUCT-${fIdx + 1}`,
            title: `Sơ đồ mặt bằng kết cấu ${floorName}`,
            photoUrl: structCadUrl,
            stepId: 'step-4',
            domElementId: `audit-cad-struct-sketch-${fIdx}`,
            floorIndex: fIdx,
            aliases: [`floor_${fIdx}_structural_cad`, `floor_${fIdx + 1}_structural_cad`],
          });
        }

        // 3. Nhánh Vùng khảo sát kiến trúc Z (f.zones)
        const fZones = (f.zones || []) as Array<Record<string, unknown>>;
        if (Array.isArray(fZones)) {
          fZones.forEach((z, zIdx) => {
            if (z.isDeleted || z.is_deleted) return;
            const zCode = (z.zoneCode || z.zone_code || `Z-${String(zIdx + 1).padStart(2, '0')}`) as string;
            const rawCtxUrl = (z.ctxPhotoUrl || z.ctx_photo_url || '') as string;
            const ctxUrl = resolveUrlWithStagedActions(rawCtxUrl, `floors[${fIdx}].zones[${zIdx}].ctxPhotoUrl`);
            const zId = z.id ? String(z.id) : '';
            const isZoneUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(zId);
            const zoneKey =
              zId && isZoneUuid
                ? zId.startsWith('zone_')
                  ? `${zId}_ctx`
                  : `zone_${zId}_ctx`
                : `zone_f${fIdx}_z${zCode}_ctx`;

            if (ctxUrl) {
              addCandidate({
                key: zoneKey,
                ruleKey: 'Z_CTX',
                photoCode: `${zCode}-CTX`,
                title: `Bối cảnh Vùng ${zCode} (${floorName})`,
                photoUrl: ctxUrl,
                stepId: 'step-4',
                domElementId: `audit-photo-card-f${fIdx}-zone-${zCode}`,
                floorIndex: fIdx,
                zoneCode: zCode,
                aliases: [`zone_f${fIdx}_z${zCode}_ctx`, `zone_${zId || zCode}_ctx`, zCode],
              });
            }

            // Ảnh tổng quan Vùng Z (z.overviewPhotos)
            const zOverviews = Array.isArray(z.overviewPhotos) ? z.overviewPhotos : [];
            zOverviews.forEach((ovRaw, ovIdx) => {
              const ovInfo = getPhotoInfo(ovRaw);
              if (!ovInfo.url || ovInfo.isDeleted) return;
              // Nếu trùng URL với ctxPhotoUrl của chính vùng đó thì bỏ qua để tránh báo 2 lần trên cùng 1 vùng
              if (ovInfo.url === ctxUrl) return;
              const ovKey = `zone_f${fIdx}_z${zCode}_ov_${ovIdx}`;
              addCandidate({
                key: ovKey,
                ruleKey: 'Z_OV',
                photoCode: `${zCode}-OV-${ovIdx + 1}`,
                title: `Ảnh tổng quan ${zCode} #${ovIdx + 1} (${floorName})`,
                photoUrl: ovInfo.url,
                stepId: 'step-4',
                domElementId: `audit-photo-card-f${fIdx}-zone-${zCode}`,
                floorIndex: fIdx,
                zoneCode: zCode,
                photoIndex: ovIdx,
              });
            });

            // Khuyết tật D trong Vùng Z
            const zDefects = (z.defects || []) as Array<Record<string, unknown>>;
            if (Array.isArray(zDefects)) {
              zDefects.forEach((d, dIdx) => {
                if (d.isDeleted || d.is_deleted) return;
                const dCode = (d.defectCode || d.defect_code || `D-${String(dIdx + 1).padStart(2, '0')}`) as string;
                const cuPhotos =
                  Array.isArray(d.cuPhotos) && d.cuPhotos.length > 0
                    ? d.cuPhotos
                    : d.cuPhotoUrl
                      ? [d.cuPhotoUrl]
                      : d.cu_photo_url
                        ? [d.cu_photo_url]
                        : [];

                cuPhotos.forEach((cuRaw, cuIdx) => {
                  const cuInfo = getPhotoInfo(cuRaw);
                  if (!cuInfo.url || cuInfo.isDeleted) return;
                  const cuUrl = resolveUrlWithStagedActions(cuInfo.url);
                  if (!cuUrl) return;

                  const hasMultiCu = cuPhotos.length > 1;
                  const dId = d.id ? String(d.id) : '';
                  const isDefectUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(dId);
                  const defectKey =
                    dId && isDefectUuid
                      ? dId.startsWith('defect_')
                        ? `${dId}_cu${hasMultiCu ? `_${cuIdx}` : ''}`
                        : `defect_${dId}_cu${hasMultiCu ? `_${cuIdx}` : ''}`
                      : dId
                        ? `defect_f${fIdx}_z${zCode}_${dId}_cu${hasMultiCu ? `_${cuIdx}` : ''}`
                        : `defect_f${fIdx}_z${zCode}_d${dCode}_cu${hasMultiCu ? `_${cuIdx}` : ''}`;
                  const cuSuffix = hasMultiCu ? ` #${cuIdx + 1}` : '';

                  addCandidate({
                    key: defectKey,
                    ruleKey: 'D_CU',
                    photoCode: `${dCode}-CU${cuSuffix}`,
                    title: `Cận cảnh thước đo nứt ${dCode}${cuSuffix} (${floorName} - ${zCode})`,
                    photoUrl: cuUrl,
                    stepId: 'step-4',
                    domElementId: `audit-photo-card-f${fIdx}-z${zCode}-defect-${dCode}${hasMultiCu ? `-${cuIdx}` : ''}`,
                    floorIndex: fIdx,
                    zoneCode: zCode,
                    defectCode: dCode,
                    photoIndex: cuIdx,
                    aliases: [
                      `defect_f${fIdx}_z${zCode}_d${dCode}_cu`,
                      cuIdx === 1 ? `defect_f${fIdx}_z${zCode}_d${dCode}_extra_cu` : '',
                      cuIdx === 1 && dId ? `defect_${dId}_extra_cu` : '',
                    ].filter(Boolean),
                  });
                });
              });
            }
          });
        }

        // 4. Nhánh Cấu kiện kết cấu BTCT E (f.structuralElements — E_COL, E_BEAM, E_SLAB & D_CU bên trong E)
        const fElements = (f.structuralElements || []) as Array<Record<string, unknown>>;
        if (Array.isArray(fElements)) {
          fElements.forEach((el, eIdx) => {
            if (el.isDeleted || el.is_deleted) return;
            const eCode = (el.elementCode || el.element_code || el.zoneCode || `E-${String(eIdx + 1).padStart(2, '0')}`) as string;
            const elType = String(el.elementType || el.element_type || 'COLUMN').toUpperCase();
            const elemRuleKey =
              elType === 'BEAM' ? 'E_BEAM' : elType === 'SLAB' || elType === 'CEILING' ? 'E_SLAB' : 'E_COL';
            const elId = el.id ? String(el.id) : '';
            const isElemUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(elId);

            // Ảnh bối cảnh cấu kiện E (ctxPhotoUrl hoặc overviewPhotos[0])
            const rawElCtx = (el.ctxPhotoUrl || el.ctx_photo_url || '') as string;
            const elOverviews = Array.isArray(el.overviewPhotos) ? el.overviewPhotos : [];
            const fallbackElOv = elOverviews.length > 0 ? getPhotoInfo(elOverviews[0]).url : '';
            const elCtxUrl = resolveUrlWithStagedActions(rawElCtx || fallbackElOv);

            const elemCtxKey =
              elId && isElemUuid
                ? elId.startsWith('element_')
                  ? `${elId}_ctx`
                  : `element_${elId}_ctx`
                : `element_f${fIdx}_e${eCode}_ctx`;

            if (elCtxUrl) {
              addCandidate({
                key: elemCtxKey,
                ruleKey: elemRuleKey,
                photoCode: `${eCode}-CTX`,
                title: `Bối cảnh Cấu kiện ${eCode} (${floorName})`,
                photoUrl: elCtxUrl,
                stepId: 'step-4',
                domElementId: `audit-photo-card-f${fIdx}-elem-${eCode}`,
                floorIndex: fIdx,
                zoneCode: eCode,
                aliases: [`element_f${fIdx}_e${eCode}_ctx`, `zone_f${fIdx}_z${eCode}_ctx`, `zone_${elId || eCode}_ctx`, eCode],
              });
            }

            // Các ảnh tổng quan bổ sung của Cấu kiện E
            elOverviews.forEach((ovRaw, ovIdx) => {
              const ovInfo = getPhotoInfo(ovRaw);
              if (!ovInfo.url || ovInfo.isDeleted || ovInfo.url === elCtxUrl) return;
              addCandidate({
                key: `element_f${fIdx}_e${eCode}_ov_${ovIdx}`,
                ruleKey: elemRuleKey,
                photoCode: `${eCode}-OV-${ovIdx + 1}`,
                title: `Ảnh tổng quan Cấu kiện ${eCode} #${ovIdx + 1} (${floorName})`,
                photoUrl: ovInfo.url,
                stepId: 'step-4',
                domElementId: `audit-photo-card-f${fIdx}-elem-${eCode}-ov-${ovIdx}`,
                floorIndex: fIdx,
                zoneCode: eCode,
                photoIndex: ovIdx,
              });
            });

            // Khuyết tật D bên trong Cấu kiện E
            const elDefects = (el.defects || []) as Array<Record<string, unknown>>;
            if (Array.isArray(elDefects)) {
              elDefects.forEach((d, dIdx) => {
                if (d.isDeleted || d.is_deleted) return;
                const dCode = (d.defectCode || d.defect_code || `D-${String(dIdx + 1).padStart(2, '0')}`) as string;
                const cuPhotos =
                  Array.isArray(d.cuPhotos) && d.cuPhotos.length > 0
                    ? d.cuPhotos
                    : d.cuPhotoUrl
                      ? [d.cuPhotoUrl]
                      : d.cu_photo_url
                        ? [d.cu_photo_url]
                        : [];

                cuPhotos.forEach((cuRaw, cuIdx) => {
                  const cuInfo = getPhotoInfo(cuRaw);
                  if (!cuInfo.url || cuInfo.isDeleted) return;
                  const cuUrl = resolveUrlWithStagedActions(cuInfo.url);
                  if (!cuUrl) return;

                  const hasMultiCu = cuPhotos.length > 1;
                  const dId = d.id ? String(d.id) : '';
                  const isDefectUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(dId);
                  const defectKey =
                    dId && isDefectUuid
                      ? dId.startsWith('defect_')
                        ? `${dId}_cu${hasMultiCu ? `_${cuIdx}` : ''}`
                        : `defect_${dId}_cu${hasMultiCu ? `_${cuIdx}` : ''}`
                      : dId
                        ? `defect_f${fIdx}_e${eCode}_${dId}_cu${hasMultiCu ? `_${cuIdx}` : ''}`
                        : `defect_f${fIdx}_e${eCode}_d${dCode}_cu${hasMultiCu ? `_${cuIdx}` : ''}`;
                  const cuSuffix = hasMultiCu ? ` #${cuIdx + 1}` : '';

                  addCandidate({
                    key: defectKey,
                    ruleKey: 'D_CU',
                    photoCode: `${dCode}-CU${cuSuffix}`,
                    title: `Cận cảnh thước đo nứt ${dCode}${cuSuffix} (${floorName} - ${eCode})`,
                    photoUrl: cuUrl,
                    stepId: 'step-4',
                    domElementId: `audit-photo-card-f${fIdx}-e${eCode}-defect-${dCode}${hasMultiCu ? `-${cuIdx}` : ''}`,
                    floorIndex: fIdx,
                    zoneCode: eCode,
                    defectCode: dCode,
                    photoIndex: cuIdx,
                    aliases: [
                      `defect_f${fIdx}_e${eCode}_d${dCode}_cu`,
                      `defect_f${fIdx}_z${eCode}_d${dCode}_cu`,
                      cuIdx === 1 ? `defect_f${fIdx}_z${eCode}_d${dCode}_extra_cu` : '',
                    ].filter(Boolean),
                  });
                });
              });
            }
          });
        }
      });
    } else {
      // Fallback khi hồ sơ chỉ có mảng phẳng damageZones
      const zones = (surveyJson.damage_zones || surveyJson.damageZones || []) as Array<Record<string, unknown>>;
      if (Array.isArray(zones)) {
        zones.forEach((z, zIdx) => {
          if (z.isDeleted || z.is_deleted) return;
          const ctxUrl = (z.ctx_photo_url || z.ctxPhotoUrl || '') as string;
          const zCode = (z.zone_code || z.zoneCode || `Z-${String(zIdx + 1).padStart(2, '0')}`) as string;
          if (ctxUrl) {
            addCandidate({
              key: `zone_${z.id || zCode}_ctx`,
              ruleKey: 'Z_CTX',
              photoCode: `${zCode}-CTX`,
              title: `Bối cảnh Vùng ${zCode}`,
              photoUrl: ctxUrl,
              stepId: 'step-4',
              domElementId: `audit-photo-card-zone-${zCode}`,
              zoneCode: zCode,
            });
          }
        });
      }

      const defects = (surveyJson.defect_items || surveyJson.defectItems || []) as Array<Record<string, unknown>>;
      if (Array.isArray(defects)) {
        defects.forEach((d, dIdx) => {
          if (d.isDeleted || d.is_deleted) return;
          const cuUrl = (d.cu_photo_url || d.cuPhotoUrl || '') as string;
          const dCode = (d.defect_code || d.defectCode || `D-${String(dIdx + 1).padStart(2, '0')}`) as string;
          const dId = d.id ? String(d.id) : '';
          const isDefectUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(dId);
          if (cuUrl) {
            addCandidate({
              key: dId && isDefectUuid ? `defect_${dId}_cu` : `defect_flat_${dIdx}_${dCode}_cu`,
              ruleKey: 'D_CU',
              photoCode: `${dCode}-CU`,
              title: `Cận cảnh vết nứt ${dCode}`,
              photoUrl: cuUrl,
              stepId: 'step-4',
              domElementId: `audit-photo-card-defect-${dCode}`,
              defectCode: dCode,
            });
          }
        });
      }
    }

    // =========================================================================
    // BƯỚC 9: BIÊN BẢN HIỆN TRƯỜNG & THÔNG BÁO VẮNG MẶT (AuditStep9SignaturesAbsence)
    // =========================================================================
    const sigs = (surveyJson.signatures || {}) as Record<string, unknown>;
    const minutes = (sigs.workingMinutesPhotos || surveyJson.workingMinutesPhotos || []) as Array<
      string | { url?: string; photoUrl?: string; photoCode?: string }
    >;
    if (Array.isArray(minutes)) {
      minutes.forEach((m, mIdx) => {
        const mInfo = getPhotoInfo(m);
        const mUrl = resolveUrlWithStagedActions(mInfo.url, 'signatures.workingMinutesPhotos', mIdx);
        if (mUrl && !mInfo.isDeleted) {
          addCandidate({
            key: `minutes_${mIdx}`,
            ruleKey: 'MINUTES',
            photoCode: mInfo.code || `MINUTES-${mIdx + 1}`,
            title: `Biên bản hiện trường trang ${mIdx + 1}`,
            photoUrl: mUrl,
            stepId: 'step-9',
            domElementId: `audit-photo-card-minutes-${mIdx}`,
            photoIndex: mIdx,
            aliases: [`DOC_MINUTES_${mIdx + 1}`],
          });
        }
      });
    }

    // Ảnh thông báo vắng mặt (absenceLogs / absenteeMinutesPhotos)
    const absenceLogs = Array.isArray(surveyJson.absenceLogs) ? surveyJson.absenceLogs : [];
    absenceLogs.forEach((logRaw, aIdx) => {
      const logObj = (logRaw || {}) as { photoUrl?: string; photo_url?: string; url?: string; photoCode?: string };
      const aUrl = logObj.photoUrl || logObj.photo_url || logObj.url || '';
      if (aUrl) {
        addCandidate({
          key: `absenceNotice_${aIdx}`,
          ruleKey: 'ABSENCE_NOTICE',
          photoCode: logObj.photoCode || `ABSENCE-${aIdx + 1}`,
          title: `Ảnh thông báo vắng mặt lần ${aIdx + 1}`,
          photoUrl: aUrl,
          stepId: 'step-9',
          domElementId: `audit-photo-card-absence-${aIdx}`,
          photoIndex: aIdx,
        });
      }
    });

    return list;
  }, [surveyJson, resolveUrlWithStagedActions]);

  // 2. Đo kích thước naturalWidth & naturalHeight của các ảnh
  useEffect(() => {
    let isSubscribed = true;

    photoCandidates.forEach((item) => {
      const url = item.photoUrl;
      if (!url) return;

      if (imageDimensionsCache.has(url)) {
        const cached = imageDimensionsCache.get(url)!;
        setMeasuredDimensions((prev) => {
          if (prev[url]?.width === cached.width && prev[url]?.height === cached.height) return prev;
          return { ...prev, [url]: cached };
        });
        return;
      }

      const img = new Image();
      img.onload = () => {
        if (!isSubscribed) return;
        const dims = { width: img.naturalWidth, height: img.naturalHeight };
        imageDimensionsCache.set(url, dims);
        setMeasuredDimensions((prev) => ({ ...prev, [url]: dims }));
      };
      img.src = url;
    });

    return () => {
      isSubscribed = false;
    };
  }, [photoCandidates]);

  // 3. Đánh giá toàn bộ vi phạm hướng ảnh theo quy chuẩn Nhà Dân
  const violations = useMemo<PhotoOrientationViolation[]>(() => {
    const list: PhotoOrientationViolation[] = [];

    photoCandidates.forEach((item) => {
      const dims = measuredDimensions[item.photoUrl] || imageDimensionsCache.get(item.photoUrl);
      if (!dims || dims.width === 0 || dims.height === 0) {
        return;
      }

      const currentRotation = getPhotoRotation(item.key, item.photoUrl, item.aliases);
      const evalRes = evaluateResidentialOrientation(dims.width, dims.height, currentRotation, item.ruleKey);

      if (!evalRes.isValid) {
        const ruleDef = RESIDENTIAL_PHOTO_RULES[item.ruleKey];
        list.push({
          key: item.key,
          photoCode: item.photoCode,
          title: item.title,
          photoUrl: item.photoUrl,
          stepId: item.stepId,
          domElementId: item.domElementId,
          currentOrientation: evalRes.currentOrientation,
          expectedOrientation: evalRes.expected,
          effectiveRotation: evalRes.effectiveRotation,
          suggestedRotation: evalRes.suggestedRotation,
          isStrict: ruleDef?.isStrict ?? false,
          message: evalRes.message,
          floorIndex: item.floorIndex,
          zoneCode: item.zoneCode,
          defectCode: item.defectCode,
          photoIndex: item.photoIndex,
        });
      }
    });

    return list;
  }, [photoCandidates, measuredDimensions, getPhotoRotation]);

  // Phân loại vi phạm thành 2 nhóm: Bắt buộc (Strict) vs Khuyến nghị (Advisory)
  const strictViolations = useMemo(() => violations.filter((v) => v.isStrict), [violations]);
  const advisoryViolations = useMemo(() => violations.filter((v) => !v.isStrict), [violations]);

  // Tra cứu vi phạm nhanh theo key, aliases, photoUrl, domElementId, hoặc photoCode
  const violationsMap = useMemo(() => {
    const map = new Map<string, PhotoOrientationViolation>();
    violations.forEach((v) => {
      map.set(v.key, v);
      if (v.photoUrl) map.set(v.photoUrl, v);
      if (v.domElementId) map.set(v.domElementId, v);
      if (v.photoCode) map.set(v.photoCode, v);
      const candidate = photoCandidates.find((c) => c.key === v.key);
      if (candidate?.aliases) {
        candidate.aliases.forEach((alias) => {
          if (alias) map.set(alias, v);
        });
      }
    });
    return map;
  }, [violations, photoCandidates]);

  // Helper tra cứu trạng thái xoay của từng ảnh cho các Card con
  const getPhotoOrientationStatus = useCallback(
    (keyOrCodeOrUrl: string) => {
      const violation = violationsMap.get(keyOrCodeOrUrl);
      return {
        hasMismatch: Boolean(violation),
        violation,
        isStrict: violation?.isStrict ?? false,
        suggestedRotation: violation?.suggestedRotation,
        expected: violation?.expectedOrientation,
      };
    },
    [violationsMap]
  );

  const hasMismatchedPhotos = violations.length > 0;
  const hasStrictViolations = strictViolations.length > 0;
  const hasAdvisoryViolations = advisoryViolations.length > 0;
  const mismatchedCount = violations.length;
  const strictCount = strictViolations.length;
  const advisoryCount = advisoryViolations.length;

  return {
    violations,
    strictViolations,
    advisoryViolations,
    violationsMap,
    hasMismatchedPhotos,
    hasStrictViolations,
    hasAdvisoryViolations,
    mismatchedCount,
    strictCount,
    advisoryCount,
    stagedPhotoRotations,
    setPhotoRotation,
    getPhotoRotation,
    getPhotoOrientationStatus,
    isAutoRotated: (_key: string) => false,
    photoCandidatesCount: photoCandidates.length,
  };
}

