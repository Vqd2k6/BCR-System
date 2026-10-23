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
  const setPhotoRotation = useCallback((photoKey: string, rotationDeg: number, photoUrl?: string) => {
    const norm = normalizeRotationAngle(rotationDeg);
    setStagedPhotoRotations((prev) => ({
      ...prev,
      [photoKey]: norm,
      ...(photoUrl ? { [photoUrl]: norm } : {}),
    }));
  }, []);

  // Lấy góc xoay hiện tại của 1 ảnh (hỗ trợ đọc cả theo photoKey và photoUrl)
  const getPhotoRotation = useCallback(
    (photoKey: string, photoUrl?: string): number => {
      if (photoKey in stagedPhotoRotations) {
        return stagedPhotoRotations[photoKey];
      }
      if (photoUrl && photoUrl in stagedPhotoRotations) {
        return stagedPhotoRotations[photoUrl];
      }
      const existingRotations = (surveyJson.photoRotations || {}) as Record<string, number>;
      if (photoKey in existingRotations) {
        return existingRotations[photoKey];
      }
      if (photoUrl && photoUrl in existingRotations) {
        return existingRotations[photoUrl];
      }
      return 0;
    },
    [stagedPhotoRotations, surveyJson]
  );

  // 1. Thu thập toàn bộ danh sách ảnh cần kiểm toán trong hồ sơ Nhà Dân
  const photoCandidates = useMemo<AuditedPhotoItem[]>(() => {
    const list: AuditedPhotoItem[] = [];
    const seenUrls = new Set<string>();

    const addCandidate = (item: AuditedPhotoItem) => {
      if (!item.photoUrl || typeof item.photoUrl !== 'string' || item.photoUrl.trim() === '') return;
      if (seenUrls.has(item.photoUrl)) return; // Tránh quét trùng lặp tuyệt đối theo URL
      seenUrls.add(item.photoUrl);
      list.push(item);
    };

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
      addCandidate({
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
      addCandidate({
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
      addCandidate({
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
      addCandidate({
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
    const tiltPhotos = Array.isArray(tilt.photos) && tilt.photos.length > 0
      ? tilt.photos
      : (tilt.photoUrl ? [tilt.photoUrl] : []);
    tiltPhotos.forEach((tp, pIdx) => {
      const tpInfo = getPhotoInfo(tp);
      if (tpInfo.url) {
        addCandidate({
          key: tiltPhotos.length > 1 ? `buildingTilt_${pIdx}` : 'buildingTilt',
          ruleKey: 'buildingTilt',
          photoCode: tpInfo.code || (tiltPhotos.length > 1 ? `TILT_${pIdx + 1}` : 'TILT'),
          title: tiltPhotos.length > 1 ? `Ảnh đo độ nghiêng thân nhà #${pIdx + 1}` : 'Ảnh đo độ nghiêng thân nhà',
          photoUrl: tpInfo.url,
          stepId: 'step-2',
          domElementId: `audit-photo-card-building-tilt${tiltPhotos.length > 1 ? `-${pIdx}` : ''}`,
          photoIndex: pIdx,
        });
      }
    });

    const sag = (st.beamSagging || surveyJson.beamSagging || {}) as Record<string, unknown>;
    const sagPhotos = Array.isArray(sag.photos) && sag.photos.length > 0
      ? sag.photos
      : (sag.photoUrl ? [sag.photoUrl] : []);
    sagPhotos.forEach((sp, pIdx) => {
      const spInfo = getPhotoInfo(sp);
      if (spInfo.url) {
        addCandidate({
          key: sagPhotos.length > 1 ? `beamSagging_${pIdx}` : 'beamSagging',
          ruleKey: 'beamSagging',
          photoCode: spInfo.code || (sagPhotos.length > 1 ? `SAG_${pIdx + 1}` : 'SAG'),
          title: sagPhotos.length > 1 ? `Ảnh đo độ võng dầm sàn #${pIdx + 1}` : 'Ảnh đo độ võng dầm sàn',
          photoUrl: spInfo.url,
          stepId: 'step-2',
          domElementId: `audit-photo-card-beam-sagging${sagPhotos.length > 1 ? `-${pIdx}` : ''}`,
          photoIndex: pIdx,
        });
      }
    });

    const settle = (st.diffSettlement || surveyJson.diffSettlement || {}) as Record<string, unknown>;
    const settlePhotos = Array.isArray(settle.photos) && settle.photos.length > 0
      ? settle.photos
      : (settle.photoUrl ? [settle.photoUrl] : []);
    settlePhotos.forEach((sep, pIdx) => {
      const sepInfo = getPhotoInfo(sep);
      if (sepInfo.url) {
        addCandidate({
          key: settlePhotos.length > 1 ? `diffSettlement_${pIdx}` : 'diffSettlement',
          ruleKey: 'diffSettlement',
          photoCode: sepInfo.code || (settlePhotos.length > 1 ? `SETTLE_${pIdx + 1}` : 'SETTLE'),
          title: settlePhotos.length > 1 ? `Ảnh lún lệch chân tường #${pIdx + 1}` : 'Ảnh lún lệch chân tường',
          photoUrl: sepInfo.url,
          stepId: 'step-2',
          domElementId: `audit-photo-card-diff-settlement${settlePhotos.length > 1 ? `-${pIdx}` : ''}`,
          photoIndex: pIdx,
        });
      }
    });

    // Nhóm Bước 9: Biên Bản Khảo Sát Hiện Trường A4
    const sigs = (surveyJson.signatures || {}) as Record<string, unknown>;
    const minutes = (sigs.workingMinutesPhotos || surveyJson.workingMinutesPhotos || []) as Array<string | { url?: string; photoCode?: string }>;
    if (Array.isArray(minutes)) {
      minutes.forEach((m, mIdx) => {
        const mInfo = getPhotoInfo(m);
        if (mInfo.url) {
          addCandidate({
            key: `minutes_${mIdx}`,
            ruleKey: 'MINUTES',
            photoCode: mInfo.code || `MINUTES-${mIdx + 1}`,
            title: `Biên bản hiện trường trang ${mIdx + 1}`,
            photoUrl: mInfo.url,
            stepId: 'step-9',
            domElementId: `audit-photo-card-minutes-${mIdx}`,
            photoIndex: mIdx,
          });
        }
      });
    }

    // Nhóm Bước 3: Tầng & Bản vẽ CAD, Vùng Z, Khuyết tật D trong surveyJson.floors
    const floors = (surveyJson.floors || []) as Array<Record<string, unknown>>;
    const hasFloors = Array.isArray(floors) && floors.length > 0;

    if (hasFloors) {
      floors.forEach((f, fIdx) => {
        const floorName = (f.floorName || `Tầng ${fIdx + 1}`) as string;
        const cadUrl = (f.cadSketchPhotoUrl || f.cadPhotoUrl || '') as string;
        const fId = f.id ? String(f.id) : '';
        const floorCadKey = fId ? (fId.startsWith('floor_') ? `${fId}_cad` : `floor_${fId}_cad`) : `floor_${fIdx}_cad`;
        if (cadUrl) {
          addCandidate({
            key: floorCadKey,
            ruleKey: 'CAD_SKETCH',
            photoCode: `CAD-${fIdx + 1}`,
            title: `Bản vẽ CAD ${floorName}`,
            photoUrl: cadUrl,
            stepId: 'step-3',
            domElementId: `audit-cad-sketch-${fIdx}`,
            floorIndex: fIdx,
          });
        }

        const fZones = (f.zones || []) as Array<Record<string, unknown>>;
        if (Array.isArray(fZones)) {
          fZones.forEach((z, zIdx) => {
            const zCode = (z.zoneCode || z.zone_code || `Z-${String(zIdx + 1).padStart(2, '0')}`) as string;
            const ctxUrl = (z.ctxPhotoUrl || z.ctx_photo_url || '') as string;
            // Composite key phân cấp duy nhất cho Vùng Z
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
                stepId: 'step-3',
                domElementId: `audit-photo-card-f${fIdx}-zone-${zCode}`,
                floorIndex: fIdx,
                zoneCode: zCode,
              });
            }

            const zDefects = (z.defects || []) as Array<Record<string, unknown>>;
            if (Array.isArray(zDefects)) {
              zDefects.forEach((d, dIdx) => {
                const dCode = (d.defectCode || d.defect_code || `D-${String(dIdx + 1).padStart(2, '0')}`) as string;
                const cuPhotos = Array.isArray(d.cuPhotos) && d.cuPhotos.length > 0
                  ? d.cuPhotos
                  : (d.cuPhotoUrl ? [d.cuPhotoUrl] : (d.cu_photo_url ? [d.cu_photo_url] : []));

                cuPhotos.forEach((cuRaw, cuIdx) => {
                  const cuUrl = typeof cuRaw === 'string' ? cuRaw : (cuRaw?.url || '');
                  if (!cuUrl) return;
                  const hasMultiCu = cuPhotos.length > 1;
                  // Composite key phân cấp duy nhất cho từng khuyết tật và từng ảnh cận cảnh
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
                    stepId: 'step-3',
                    domElementId: `audit-photo-card-f${fIdx}-z${zCode}-defect-${dCode}${hasMultiCu ? `-${cuIdx}` : ''}`,
                    floorIndex: fIdx,
                    zoneCode: zCode,
                    defectCode: dCode,
                    photoIndex: cuIdx,
                  });
                });
              });
            }
          });
        }
      });
    } else {
      // Ưu tiên floors; chỉ quét mảng phẳng cũ khi hồ sơ hoàn toàn không có floors
      const zones = (surveyJson.damage_zones || surveyJson.damageZones || []) as Array<Record<string, unknown>>;
      if (Array.isArray(zones)) {
        zones.forEach((z, zIdx) => {
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

      const currentRotation = stagedPhotoRotations[item.key] ?? getPhotoRotation(item.key, item.photoUrl);
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
  }, [photoCandidates, measuredDimensions, stagedPhotoRotations, getPhotoRotation]);

  // Phân loại vi phạm thành 2 nhóm: Bắt buộc (Strict) vs Khuyến nghị (Advisory)
  const strictViolations = useMemo(() => violations.filter((v) => v.isStrict), [violations]);
  const advisoryViolations = useMemo(() => violations.filter((v) => !v.isStrict), [violations]);

  // Tra cứu vi phạm nhanh theo key, photoUrl, domElementId, hoặc photoCode
  const violationsMap = useMemo(() => {
    const map = new Map<string, PhotoOrientationViolation>();
    violations.forEach((v) => {
      map.set(v.key, v);
      if (v.photoUrl) map.set(v.photoUrl, v);
      if (v.domElementId) map.set(v.domElementId, v);
      if (v.photoCode) map.set(v.photoCode, v);
    });
    return map;
  }, [violations]);

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
    isAutoRotated: (_key: string) => false, // Đã loại bỏ tự động xoay ngầm
    photoCandidatesCount: photoCandidates.length,
  };
}
