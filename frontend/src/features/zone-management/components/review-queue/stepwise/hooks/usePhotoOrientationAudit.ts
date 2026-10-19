import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  evaluateResidentialOrientation,
  RESIDENTIAL_PHOTO_RULES,
  normalizeRotationAngle,
  type PhotoOrientationType,
  type ExpectedOrientation,
} from '../utils/residentialPhotoOrientationStandards';

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
}

export interface AuditedPhotoItem {
  key: string;
  ruleKey: string;
  photoCode?: string;
  title: string;
  photoUrl: string;
  stepId: string;
  domElementId: string;
}

// Global in-memory cache kích thước ảnh để tránh load lại nhiều lần
const imageDimensionsCache = new Map<string, { width: number; height: number }>();

export function usePhotoOrientationAudit(data: Record<string, unknown> | null | undefined) {
  // Lấy dữ liệu survey_data_json gốc
  const surveyJson = useMemo(() => {
    if (!data) return {};
    const raw = data.survey_data_json || data;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
    return (raw || {}) as Record<string, unknown>;
  }, [data]);

  // Quản lý staged rotations (các góc xoay do Thẩm định viên thay đổi)
  const [stagedPhotoRotations, setStagedPhotoRotations] = useState<Record<string, number>>(() => {
    const existing = (surveyJson.photoRotations || {}) as Record<string, number>;
    return { ...existing };
  });

  // State lưu kích thước ảnh đã đo được
  const [measuredDimensions, setMeasuredDimensions] = useState<Record<string, { width: number; height: number }>>({});

  // Cập nhật góc xoay cho 1 ảnh cụ thể (Thẩm định viên chủ động xoay)
  const setPhotoRotation = useCallback((photoKey: string, rotationDeg: number) => {
    const norm = normalizeRotationAngle(rotationDeg);
    setStagedPhotoRotations((prev) => ({
      ...prev,
      [photoKey]: norm,
    }));
  }, []);

  // Lấy góc xoay hiện tại của 1 ảnh
  const getPhotoRotation = useCallback(
    (photoKey: string): number => {
      if (photoKey in stagedPhotoRotations) {
        return stagedPhotoRotations[photoKey];
      }
      const existingRotations = (surveyJson.photoRotations || {}) as Record<string, number>;
      return existingRotations[photoKey] || 0;
    },
    [stagedPhotoRotations, surveyJson]
  );

  // 1. Thu thập toàn bộ danh sách ảnh cần kiểm toán trong hồ sơ Nhà Dân
  const photoCandidates = useMemo<AuditedPhotoItem[]>(() => {
    const list: AuditedPhotoItem[] = [];

    // Helper an toàn trích xuất URL & photoCode
    const getPhotoInfo = (obj: unknown): { url: string; code?: string } => {
      if (!obj) return { url: '' };
      if (typeof obj === 'string') return { url: obj };
      if (typeof obj === 'object') {
        const o = obj as { url?: string; photoUrl?: string; photoCode?: string };
        return {
          url: o.url || o.photoUrl || '',
          code: o.photoCode,
        };
      }
      return { url: '' };
    };

    // Nhóm P: Bước 1
    const p1 = (surveyJson.identificationPhotos || {}) as Record<string, unknown>;
    const p01 = getPhotoInfo(p1.photoP01 || surveyJson.photoP01);
    if (p01.url) {
      list.push({
        key: 'photoP01',
        ruleKey: 'photoP01',
        photoCode: p01.code || 'P-01',
        title: 'Biển số nhà & cổng chính',
        photoUrl: p01.url,
        stepId: 'step-1',
        domElementId: 'audit-photo-card-P-01',
      });
    }

    const p02 = getPhotoInfo(p1.photoP02 || surveyJson.photoP02);
    if (p02.url) {
      list.push({
        key: 'photoP02',
        ruleKey: 'photoP02',
        photoCode: p02.code || 'P-02',
        title: 'Mặt đứng chính & phân tầng',
        photoUrl: p02.url,
        stepId: 'step-1',
        domElementId: 'audit-photo-card-P-02',
      });
    }

    const p03 = getPhotoInfo(p1.photoP03 || surveyJson.photoP03);
    if (p03.url) {
      list.push({
        key: 'photoP03',
        ruleKey: 'photoP03',
        photoCode: p03.code || 'P-03',
        title: 'Mặt bên & hẻm hông',
        photoUrl: p03.url,
        stepId: 'step-1',
        domElementId: 'audit-photo-card-P-03',
      });
    }

    const p04 = getPhotoInfo(p1.photoP04 || surveyJson.photoP04);
    if (p04.url) {
      list.push({
        key: 'photoP04',
        ruleKey: 'photoP04',
        photoCode: p04.code || 'P-04',
        title: 'Mặt đường & vỉa hè',
        photoUrl: p04.url,
        stepId: 'step-1',
        domElementId: 'audit-photo-card-P-04',
      });
    }

    // Nhóm Bước 2: Đo Biến Dạng & Lún Nghiêng
    const st = (surveyJson.settlementTilt || {}) as Record<string, unknown>;
    const tilt = (st.buildingTilt || surveyJson.buildingTilt || {}) as Record<string, unknown>;
    const tiltInfo = getPhotoInfo(tilt.photoUrl || (Array.isArray(tilt.photos) ? tilt.photos[0] : null));
    if (tiltInfo.url) {
      list.push({
        key: 'buildingTilt',
        ruleKey: 'buildingTilt',
        photoCode: tiltInfo.code || 'TILT',
        title: 'Ảnh đo độ nghiêng thân nhà',
        photoUrl: tiltInfo.url,
        stepId: 'step-2',
        domElementId: 'audit-photo-card-building-tilt',
      });
    }

    const sag = (st.beamSagging || surveyJson.beamSagging || {}) as Record<string, unknown>;
    const sagInfo = getPhotoInfo(sag.photoUrl || (Array.isArray(sag.photos) ? sag.photos[0] : null));
    if (sagInfo.url) {
      list.push({
        key: 'beamSagging',
        ruleKey: 'beamSagging',
        photoCode: sagInfo.code || 'SAG',
        title: 'Ảnh đo độ võng dầm sàn',
        photoUrl: sagInfo.url,
        stepId: 'step-2',
        domElementId: 'audit-photo-card-beam-sagging',
      });
    }

    const settle = (st.diffSettlement || surveyJson.diffSettlement || {}) as Record<string, unknown>;
    const settleInfo = getPhotoInfo(settle.photoUrl || (Array.isArray(settle.photos) ? settle.photos[0] : null));
    if (settleInfo.url) {
      list.push({
        key: 'diffSettlement',
        ruleKey: 'diffSettlement',
        photoCode: settleInfo.code || 'SETTLE',
        title: 'Ảnh lún lệch chân tường',
        photoUrl: settleInfo.url,
        stepId: 'step-2',
        domElementId: 'audit-photo-card-diff-settlement',
      });
    }

    // Nhóm Bước 4: Damage Zones (Z_CTX)
    const zones = (surveyJson.damage_zones || surveyJson.damageZones || []) as Array<Record<string, unknown>>;
    if (Array.isArray(zones)) {
      zones.forEach((z, zIdx) => {
        const ctxUrl = (z.ctx_photo_url || z.ctxPhotoUrl || '') as string;
        const zCode = (z.zone_code || z.zoneCode || `Z-${String(zIdx + 1).padStart(2, '0')}`) as string;
        if (ctxUrl) {
          list.push({
            key: `zone_${z.id || zCode}_ctx`,
            ruleKey: 'Z_CTX',
            photoCode: `${zCode}-CTX`,
            title: `Bối cảnh Vùng ${zCode}`,
            photoUrl: ctxUrl,
            stepId: 'step-4',
            domElementId: `audit-photo-card-zone-${zCode}`,
          });
        }
      });
    }

    // Nhóm Bước 4: Defect Items (D_CU)
    const defects = (surveyJson.defect_items || surveyJson.defectItems || []) as Array<Record<string, unknown>>;
    if (Array.isArray(defects)) {
      defects.forEach((d, dIdx) => {
        const cuUrl = (d.cu_photo_url || d.cuPhotoUrl || '') as string;
        const dCode = (d.defect_code || d.defectCode || `D-${String(dIdx + 1).padStart(2, '0')}`) as string;
        if (cuUrl) {
          list.push({
            key: `defect_${d.id || dCode}_cu`,
            ruleKey: 'D_CU',
            photoCode: `${dCode}-CU`,
            title: `Cận cảnh vết nứt ${dCode}`,
            photoUrl: cuUrl,
            stepId: 'step-4',
            domElementId: `audit-photo-card-defect-${dCode}`,
          });
        }
      });
    }

    // Nhóm Bước 9: Biên Bản Khảo Sát Hiện Trường A4
    const sigs = (surveyJson.signatures || {}) as Record<string, unknown>;
    const minutes = (sigs.workingMinutesPhotos || surveyJson.workingMinutesPhotos || []) as Array<string | { url?: string; photoCode?: string }>;
    if (Array.isArray(minutes)) {
      minutes.forEach((m, mIdx) => {
        const mInfo = getPhotoInfo(m);
        if (mInfo.url) {
          list.push({
            key: `minutes_${mIdx}`,
            ruleKey: 'MINUTES',
            photoCode: mInfo.code || `MINUTES-${mIdx + 1}`,
            title: `Biên bản hiện trường trang ${mIdx + 1}`,
            photoUrl: mInfo.url,
            stepId: 'step-9',
            domElementId: `audit-photo-card-minutes-${mIdx}`,
          });
        }
      });
    }

    // Nhóm Bước 3: Tầng & Bản vẽ CAD, Vùng Z, Khuyết tật D trong surveyJson.floors
    const floors = (surveyJson.floors || []) as Array<Record<string, unknown>>;
    if (Array.isArray(floors)) {
      floors.forEach((f, fIdx) => {
        const floorName = (f.floorName || `Tầng ${fIdx + 1}`) as string;
        const cadUrl = (f.cadSketchPhotoUrl || f.cadPhotoUrl || '') as string;
        if (cadUrl) {
          list.push({
            key: `floor_${f.id || fIdx}_cad`,
            ruleKey: 'CAD_SKETCH',
            photoCode: `CAD-${fIdx + 1}`,
            title: `Bản vẽ CAD ${floorName}`,
            photoUrl: cadUrl,
            stepId: 'step-3',
            domElementId: `audit-cad-sketch-${fIdx}`,
          });
        }

        const fZones = (f.zones || []) as Array<Record<string, unknown>>;
        if (Array.isArray(fZones)) {
          fZones.forEach((z, zIdx) => {
            const zCode = (z.zoneCode || `Z-${String(zIdx + 1).padStart(2, '0')}`) as string;
            const ctxUrl = (z.ctxPhotoUrl || '') as string;
            if (ctxUrl) {
              list.push({
                key: `zone_${z.id || zCode}_ctx`,
                ruleKey: 'Z_CTX',
                photoCode: `${zCode}-CTX`,
                title: `Bối cảnh Vùng ${zCode} (${floorName})`,
                photoUrl: ctxUrl,
                stepId: 'step-3',
                domElementId: `audit-photo-card-zone-${zCode}`,
              });
            }

            const zDefects = (z.defects || []) as Array<Record<string, unknown>>;
            if (Array.isArray(zDefects)) {
              zDefects.forEach((d) => {
                const dCode = (d.defectCode || 'D') as string;
                const cuUrl = (d.cuPhotoUrl || (Array.isArray(d.cuPhotos) ? d.cuPhotos[0] : '')) as string;
                if (cuUrl) {
                  list.push({
                    key: `defect_${d.id || dCode}_cu`,
                    ruleKey: 'D_CU',
                    photoCode: `${dCode}-CU`,
                    title: `Cận cảnh thước đo nứt ${dCode} (${floorName})`,
                    photoUrl: cuUrl,
                    stepId: 'step-3',
                    domElementId: `audit-photo-card-defect-${dCode}`,
                  });
                }
              });
            }
          });
        }
      });
    }

    return list;
  }, [surveyJson]);

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

  // 3. Đánh giá toàn bộ vi phạm hướng ảnh theo quy chuẩn FE Nhà Dân (KHÔNG tự động xoay ngầm)
  const violations = useMemo<PhotoOrientationViolation[]>(() => {
    const list: PhotoOrientationViolation[] = [];

    photoCandidates.forEach((item) => {
      const dims = measuredDimensions[item.photoUrl] || imageDimensionsCache.get(item.photoUrl);
      if (!dims || dims.width === 0 || dims.height === 0) {
        // Chưa nạp xong kích thước ảnh -> tạm thời chưa gắn lỗi
        return;
      }

      const currentRotation = stagedPhotoRotations[item.key] ?? getPhotoRotation(item.key);
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
        });
      }
    });

    return list;
  }, [photoCandidates, measuredDimensions, stagedPhotoRotations, getPhotoRotation]);

  // Phân loại vi phạm thành 2 nhóm: Bắt buộc (Strict) vs Khuyến nghị (Advisory)
  const strictViolations = useMemo(() => violations.filter((v) => v.isStrict), [violations]);
  const advisoryViolations = useMemo(() => violations.filter((v) => !v.isStrict), [violations]);

  // Tra cứu vi phạm nhanh theo key, photoCode hoặc domElementId
  const violationsMap = useMemo(() => {
    const map = new Map<string, PhotoOrientationViolation>();
    violations.forEach((v) => {
      map.set(v.key, v);
      if (v.photoCode) map.set(v.photoCode, v);
      if (v.domElementId) map.set(v.domElementId, v);
    });
    return map;
  }, [violations]);

  // Helper tra cứu trạng thái xoay của từng ảnh cho các Card con
  const getPhotoOrientationStatus = useCallback(
    (keyOrCode: string) => {
      const violation = violationsMap.get(keyOrCode);
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
    isAutoRotated: (_key: string) => false, // Đã loại bỏ tự động xoay ngầm
    photoCandidatesCount: photoCandidates.length,
  };
}
