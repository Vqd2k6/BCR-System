/**
 * ============================================================================
 * REPORT PRELOAD & ROTATION ITEMS HELPER
 * Trích xuất danh sách URL ảnh và ánh xạ góc xoay chuẩn hóa chiều (photoRotations)
 * trước khi nạp Base64 vào bộ nhớ đệm.
 * ============================================================================
 */

export function extractAllImageUrls(obj: any, urls: Set<string> = new Set()): string[] {
  if (!obj) return [];
  if (typeof obj === 'string') {
    if (obj.startsWith('http://') || obj.startsWith('https://') || obj.startsWith('/uploads/') || obj.startsWith('uploads/')) {
      if (/\.(jpg|jpeg|png|webp)/i.test(obj) || obj.includes('/surveys/')) {
        urls.add(obj);
      }
    }
  } else if (Array.isArray(obj)) {
    for (const item of obj) extractAllImageUrls(item, urls);
  } else if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) extractAllImageUrls(obj[key], urls);
  }
  return Array.from(urls);
}

export function buildPreloadRotationItems(
  activeReport: any,
  allPhotoUrls: string[],
  rotMap: Record<string, number>
): Array<string | { url: string; rotation?: number }> {
  const items: Array<string | { url: string; rotation?: number }> = [...allPhotoUrls];
  if (!rotMap || Object.keys(rotMap).length === 0) return items;

  const json = activeReport?.survey_data_json || {};
  const addRot = (url: any, rot: any) => {
    if (typeof url === 'string' && url.trim() && Number(rot)) {
      items.push({ url: url.trim(), rotation: Number(rot) });
    }
  };

  for (const [k, v] of Object.entries(rotMap)) {
    if ((k.startsWith('http') || k.startsWith('/') || k.startsWith('uploads/')) && Number(v)) {
      addRot(k, v);
    }
  }

  const p01Url = json.photoP01?.url || (typeof json.photoP01 === 'string' ? json.photoP01 : '') || json.photos?.p01 || json.step1Photos?.p01HouseNumberUrl;
  addRot(p01Url, rotMap['P-01'] ?? rotMap['photoP01'] ?? rotMap[p01Url]);
  const p02Url = json.photoP02?.url || (typeof json.photoP02 === 'string' ? json.photoP02 : '') || json.photos?.p02 || json.step1Photos?.p02MainFacadeUrl;
  addRot(p02Url, rotMap['P-02'] ?? rotMap['photoP02'] ?? rotMap[p02Url]);
  const p03Url = json.photoP03?.url || (typeof json.photoP03 === 'string' ? json.photoP03 : '') || json.photos?.p03 || json.step1Photos?.p03SideRearUrl;
  addRot(p03Url, rotMap['P-03'] ?? rotMap['photoP03'] ?? rotMap[p03Url]);
  if (Array.isArray(json.photoP03?.additionalPhotos)) {
    json.photoP03.additionalPhotos.forEach((addItem: any, idx: number) => {
      const addUrl = typeof addItem === 'string' ? addItem : addItem?.url;
      const origTag = (typeof addItem === 'object' ? addItem?.tag : undefined) || `P03_0${idx + 2}`;
      addRot(addUrl, rotMap[`photoP03_extra_${idx}`] ?? rotMap[`P-03-EXTRA-${idx + 1}`] ?? rotMap[origTag] ?? rotMap[addUrl]);
    });
  }
  const p04Url = json.photoP04?.url || (typeof json.photoP04 === 'string' ? json.photoP04 : '') || json.photos?.p04 || json.step1Photos?.p04ContextStreetUrl;
  addRot(p04Url, rotMap['P-04'] ?? rotMap['photoP04'] ?? rotMap[p04Url]);

  if (Array.isArray(json.vacantLandPhotos)) {
    json.vacantLandPhotos.forEach((item: any, idx: number) => {
      const u = typeof item === 'string' ? item : item?.url || item?.photoUrl;
      addRot(u, rotMap[`vacantLand_${idx}`] ?? rotMap[u]);
    });
  }
  if (Array.isArray(json.underConstructionPhotos)) {
    json.underConstructionPhotos.forEach((item: any, idx: number) => {
      const u = typeof item === 'string' ? item : item?.url || item?.photoUrl;
      addRot(u, rotMap[`underConstruction_${idx}`] ?? rotMap[u]);
    });
  }

  const st = json.settlementTilt || activeReport?.deformation || {};
  const extractDeformUrls = (node: any): string[] => {
    if (!node) return [];
    const list: string[] = [];
    if (Array.isArray(node.photos)) {
      node.photos.forEach((p: any) => {
        const u = typeof p === 'string' ? p : p?.url || p?.photoUrl;
        if (u) list.push(u);
      });
    } else if (node.photoUrl) {
      list.push(node.photoUrl);
    }
    return list;
  };
  extractDeformUrls(st.diffSettlement).forEach((u, idx) => {
    addRot(u, rotMap[idx === 0 ? 'diffSettlement' : `diffSettlement_${idx}`] ?? rotMap[`diffSettlement_${idx}`] ?? rotMap['P-06'] ?? rotMap['photoP06'] ?? rotMap[u]);
  });
  extractDeformUrls(st.buildingTilt).forEach((u, idx) => {
    addRot(u, rotMap[idx === 0 ? 'buildingTilt' : `buildingTilt_${idx}`] ?? rotMap[`buildingTilt_${idx}`] ?? rotMap['P-05'] ?? rotMap['photoP05'] ?? rotMap[u]);
  });
  extractDeformUrls(st.beamSagging).forEach((u, idx) => {
    addRot(u, rotMap[idx === 0 ? 'beamSagging' : `beamSagging_${idx}`] ?? rotMap[`beamSagging_${idx}`] ?? rotMap[u]);
  });
  extractDeformUrls(st.abnormalCase).forEach((u, idx) => {
    addRot(u, rotMap[idx === 0 ? 'abnormalCase' : `abnormalCase_${idx}`] ?? rotMap[`abnormalCase_${idx}`] ?? rotMap['P-07'] ?? rotMap['photoP07'] ?? rotMap[u]);
  });

  const asBuiltList = json.asBuiltDrawingPhotos || json.asBuiltDrawingFiles || json.asBuiltDrawings || activeReport?.as_built_drawings || [];
  if (Array.isArray(asBuiltList)) {
    asBuiltList.forEach((item: any, idx: number) => {
      const u = typeof item === 'string' ? item : item?.url || item?.photoUrl;
      const code = item?.photoCode || `CAT-DWG-${String(idx + 1).padStart(2, '0')}`;
      addRot(u, item?.rotation ?? rotMap[`asBuiltDrawing_${idx}`] ?? rotMap[code] ?? rotMap[u]);
    });
  }

  const rawFloors = json.floors || activeReport?.floors || [];
  if (Array.isArray(rawFloors)) {
    rawFloors.forEach((fl: any, fIdx: number) => {
      const floorIndex = fIdx + 1;
      const cadUrl = fl?.damageMapUrl || fl?.cadSketchPhotoUrl || fl?.cad_drawing_url || fl?.cadArchUrl || fl?.cadDrawingUrl;
      addRot(
        cadUrl,
        fl?.cadRotation ??
          fl?.cadSketchRotation ??
          rotMap[`floor_${fl?.id || fIdx}_cad`] ??
          rotMap[`floor_${fl?.id || floorIndex}_cad`] ??
          rotMap[`floor_${fIdx}_cad`] ??
          rotMap[`cad_${fl?.id || floorIndex}`] ??
          rotMap[cadUrl]
      );

      const structCadUrl = fl?.structuralMapUrl || fl?.cadStructuralSketchPhotoUrl || fl?.cad_structural_drawing_url || fl?.cadStructuralDrawingUrl;
      addRot(
        structCadUrl,
        fl?.structuralCadRotation ??
          rotMap[`floor_${fl?.id || fIdx}_cad_struct`] ??
          rotMap[`floor_${fl?.id || floorIndex}_cad_struct`] ??
          rotMap[`floor_${fl?.id || floorIndex}_structural_cad`] ??
          rotMap[structCadUrl]
      );

      const zones = Array.isArray(fl?.zones) ? fl.zones : [];
      zones.forEach((z: any) => {
        const zCode = z?.zoneCode || 'Z-01';
        const zId = z?.id ? String(z.id) : '';
        const baseZKey = zId ? (zId.startsWith('zone_') ? zId : `zone_${zId}`) : `zone_f${fIdx}_z${zCode}`;
        const zCtx = z?.ctxPhotoUrl || z?.photoUrl;
        addRot(
          zCtx,
          z?.ctxRotation ??
            rotMap[`${baseZKey}_ctx`] ??
            rotMap[`zone_f${fIdx}_z${zCode}_ctx`] ??
            rotMap[`zone_${z?.id || zCode}_ctx`] ??
            rotMap[`zone_${z?.id || zCode}_photo`] ??
            rotMap[zCode] ??
            rotMap[zCtx]
        );
        if (Array.isArray(z?.overviewPhotos)) {
          z.overviewPhotos.forEach((ovItem: any, ovIdx: number) => {
            const ovUrl = typeof ovItem === 'string' ? ovItem : ovItem?.url;
            addRot(ovUrl, rotMap[`${baseZKey}_ov_${ovIdx}`] ?? rotMap[`zone_f${fIdx}_z${zCode}_ov_${ovIdx}`] ?? rotMap[`${baseZKey}_ctx`] ?? rotMap[ovUrl]);
          });
        }
        const defects = Array.isArray(z?.defects) ? z.defects : [];
        defects.forEach((d: any, dIdx: number) => {
          const dCode = d?.defectCode || `D-${String(dIdx + 1).padStart(2, '0')}`;
          const rawCu0 = Array.isArray(d?.cuPhotos) && d.cuPhotos.length > 0 ? d.cuPhotos[0] : '';
          const cuUrl = d?.closeUpPhotoUrl || d?.cuPhotoUrl || (typeof rawCu0 === 'string' ? rawCu0 : rawCu0?.url) || '';
          addRot(
            cuUrl,
            d?.cuRotation ??
              rotMap[`defect_${d?.id}_cu`] ??
              rotMap[`defect_${d?.id}_cu_0`] ??
              rotMap[`defect_f${fIdx}_z${zCode}_${d?.id}_cu`] ??
              rotMap[`defect_f${fIdx}_z${zCode}_${d?.id}_cu_0`] ??
              rotMap[`defect_f${fIdx}_z${zCode}_d${dCode}_cu`] ??
              rotMap[`defect_f${fIdx}_z${zCode}_d${dCode}_cu_0`] ??
              rotMap[`defect_${d?.id || dCode}_cu`] ??
              rotMap[dCode] ??
              rotMap[cuUrl]
          );
          const rawCu1 = Array.isArray(d?.cuPhotos) && d.cuPhotos.length > 1 ? d.cuPhotos[1] : undefined;
          const extraCuUrl = (typeof rawCu1 === 'string' ? rawCu1 : rawCu1?.url) || d?.extraPhotoUrl || d?.extraCuPhotoUrl;
          addRot(
            extraCuUrl,
            d?.extraCuRotation ??
              rotMap[`defect_${d?.id}_cu_1`] ??
              rotMap[`defect_f${fIdx}_z${zCode}_${d?.id}_cu_1`] ??
              rotMap[`defect_f${fIdx}_z${zCode}_d${dCode}_cu_1`] ??
              rotMap[`defect_f${fIdx}_z${zCode}_${d?.id}_extra_cu`] ??
              rotMap[`defect_f${fIdx}_z${zCode}_d${dCode}_extra_cu`] ??
              rotMap[extraCuUrl]
          );
        });
      });

      const elements = Array.isArray(fl?.structuralElements) ? fl.structuralElements : [];
      elements.forEach((e: any) => {
        const eCode = e?.elementCode || 'E-01';
        const eId = e?.id ? String(e.id) : '';
        const baseEKey = eId ? (eId.startsWith('elem_') ? eId : `elem_${eId}`) : `elem_f${fIdx}_e${eCode}`;
        const eCtx = e?.ctxPhotoUrl || e?.photoUrl;
        addRot(
          eCtx,
          e?.ctxRotation ??
            rotMap[`${baseEKey}_ctx`] ??
            rotMap[`elem_f${fIdx}_e${eCode}_ctx`] ??
            rotMap[`element_f${fIdx}_e${eCode}_ctx`] ??
            rotMap[`element_${e?.id || eCode}_ctx`] ??
            rotMap[`element_${e?.id || eCode}_photo`] ??
            rotMap[eCode] ??
            rotMap[eCtx]
        );
        if (Array.isArray(e?.overviewPhotos)) {
          e.overviewPhotos.forEach((ovItem: any, ovIdx: number) => {
            const ovUrl = typeof ovItem === 'string' ? ovItem : ovItem?.url;
            addRot(ovUrl, rotMap[`${baseEKey}_ov_${ovIdx}`] ?? rotMap[`elem_f${fIdx}_e${eCode}_ov_${ovIdx}`] ?? rotMap[`${baseEKey}_ctx`] ?? rotMap[ovUrl]);
          });
        }
        const eDefects = Array.isArray(e?.defects) ? e.defects : [];
        eDefects.forEach((d: any, dIdx: number) => {
          const dCode = d?.defectCode || `D-${String(dIdx + 1).padStart(2, '0')}`;
          const rawCu0 = Array.isArray(d?.cuPhotos) && d.cuPhotos.length > 0 ? d.cuPhotos[0] : '';
          const cuUrl = d?.closeUpPhotoUrl || d?.cuPhotoUrl || (typeof rawCu0 === 'string' ? rawCu0 : rawCu0?.url) || '';
          addRot(
            cuUrl,
            d?.cuRotation ??
              rotMap[`defect_${d?.id}_cu`] ??
              rotMap[`defect_${d?.id}_cu_0`] ??
              rotMap[`defect_f${fIdx}_e${eCode}_${d?.id}_cu`] ??
              rotMap[`defect_f${fIdx}_e${eCode}_${d?.id}_cu_0`] ??
              rotMap[`defect_f${fIdx}_e${eCode}_d${dCode}_cu`] ??
              rotMap[`defect_f${fIdx}_e${eCode}_d${dCode}_cu_0`] ??
              rotMap[`defect_${d?.id || dCode}_cu`] ??
              rotMap[dCode] ??
              rotMap[cuUrl]
          );
          const rawCu1 = Array.isArray(d?.cuPhotos) && d.cuPhotos.length > 1 ? d.cuPhotos[1] : undefined;
          const extraCuUrl = (typeof rawCu1 === 'string' ? rawCu1 : rawCu1?.url) || d?.extraPhotoUrl || d?.extraCuPhotoUrl;
          addRot(
            extraCuUrl,
            d?.extraCuRotation ??
              rotMap[`defect_${d?.id}_cu_1`] ??
              rotMap[`defect_f${fIdx}_e${eCode}_${d?.id}_cu_1`] ??
              rotMap[`defect_f${fIdx}_e${eCode}_d${dCode}_cu_1`] ??
              rotMap[`defect_f${fIdx}_e${eCode}_${d?.id}_extra_cu`] ??
              rotMap[`defect_f${fIdx}_e${eCode}_d${dCode}_extra_cu`] ??
              rotMap[extraCuUrl]
          );
        });
      });
    });
  }

  const minutesList = json.signatures?.workingMinutesPhotos || json.workingMinutesPhotos || [];
  if (Array.isArray(minutesList)) {
    minutesList.forEach((m: any, idx: number) => {
      const u = typeof m === 'string' ? m : m?.url || m?.photoUrl;
      addRot(u, rotMap[`minutes_${idx}`] ?? rotMap[`MINUTES-${idx + 1}`] ?? rotMap[u]);
    });
  }
  const absLogs = json.absenceLogs || [];
  if (Array.isArray(absLogs)) {
    absLogs.forEach((log: any, idx: number) => {
      const u = log?.photoUrl || log?.url;
      addRot(u, rotMap[`absenceNotice_${idx}`] ?? rotMap[u]);
    });
  }

  return items;
}

