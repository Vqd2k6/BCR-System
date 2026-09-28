import {
  FloorSurveyReport,
  DamageZoneReport,
  DefectItemReport,
  StructuralElementReport,
} from '../../report.types';
import {
  burlandLabels,
  activityStateLabels,
  structuralSigLabels,
} from './residential.constants';
import { isPortraitImage, dedupePhotos } from './residential.image-sniff';

export interface FloorBuildResult {
  floors: FloorSurveyReport[];
  totalDefectsCount: number;
  totalDamageZonesCount: number;
  totalStructuralElementsCount: number;
}

/**
 * Xử lý gom nhóm và định dạng danh sách Tầng, Vùng Z, Khuyết tật D và Cấu kiện E
 * Hỗ trợ nguồn từ survey_data_json (ưu tiên cao nhất) và fallback từ CSDL quan hệ
 */
export function buildFloorSurveys(json: any, reportData: any): FloorBuildResult {
  let totalDefectsCount = 0;
  let totalDamageZonesCount = 0;
  let totalStructuralElementsCount = 0;
  let floors: FloorSurveyReport[] = [];

  const deformation = reportData.deformation || {};
  const floorSurveys = reportData.floorSurveys || [];
  const damageZones = reportData.damageZones || [];

  // 1. KIỂM TRA NGUỒN DỮ LIỆU TẦNG TỪ survey_data_json (CHÍNH XÁC NHẤT)
  if (json.floors && Array.isArray(json.floors) && json.floors.length > 0) {
    floors = json.floors.map((f: any, fIdx: number) => {
      const floorName = f.floorName || `Tầng ${fIdx + 1}`;
      let floorDefectsCount = 0;

      // Vùng kiến trúc Z
      const zones: DamageZoneReport[] = (f.zones || []).map((z: any) => {
        totalDamageZonesCount++;
        const zDefects: DefectItemReport[] = (z.defects || []).map((d: any) => {
          totalDefectsCount++;
          floorDefectsCount++;
          const crackDir = d.crackDirection
            ? String(d.crackDirection).includes('°') ? String(d.crackDirection) : `${d.crackDirection}°`
            : 'Xiên / Ngẫu nhiên';

          return {
            defectCode: d.defectCode || 'D-01',
            zoneCode: z.zoneCode || 'Z-01',
            roomName: z.roomName || 'Không gian',
            componentType: z.componentType || 'Tường gạch',
            defectType: d.defectType || 'Nứt khối xây',
            screeningCategory: d.screeningCategory || 'Nứt tường gạch / Vữa trát hoàn thiện',
            crackDirection: crackDir,
            widthMaxMm: Number(d.widthMaxMm || 0.1),
            lengthMm: Number(d.lengthMm || 100),
            activityState: d.activityState || 'U',
            activityStateLabel: activityStateLabels[d.activityState || 'U'] || 'Chưa rõ',
            structuralSignificanceE2: Number(d.structuralSignificanceE2 || 0),
            structuralSignificanceLabel: structuralSigLabels[Number(d.structuralSignificanceE2 || 0)] || 'N/A',
            materialDegradationE4: Number(d.materialDegradationE4 || 0),
            materialDegradationLabel: `Mức ${d.materialDegradationE4 || 0}`,
            hasScaleCard: d.hasScaleCard !== false,
            isStructuralCritical: Boolean(d.isStructuralCritical),
            pinX: d.pinX !== undefined ? Number(d.pinX) : undefined,
            pinY: d.pinY !== undefined ? Number(d.pinY) : undefined,
            ctxPhotoUrl: z.ctxPhotoUrl || '',
            cuPhotoUrl: d.cuPhotoUrl || '',
            notes: d.notes || '',
          };
        });

        const uniqueZonePhotos = dedupePhotos(z.overviewPhotos, z.ctxPhotoUrl);

        return {
          zoneCode: z.zoneCode || 'Z-01',
          floorName,
          roomName: z.roomName || z.customRoomName || 'Không gian',
          componentType: z.componentType || z.customComponentType || 'Tường gạch',
          wallMaterial: z.wallMaterial || z.customWallMaterial || 'Trát vữa xi măng',
          functionalImpactRepairNeeded: Boolean(z.functionalImpactRepairNeeded),
          burlandGrade: Number(z.burlandGrade || 0),
          burlandLabel: burlandLabels[Number(z.burlandGrade || 0)] || 'Grade 0',
          notes: z.notes || '',
          ctxPhotoUrl: z.ctxPhotoUrl || '',
          overviewPhotos: uniqueZonePhotos,
          hasDamage: Boolean(z.hasDamage || zDefects.length > 0),
          defects: zDefects,
        };
      });

      // Cấu kiện kết cấu chịu lực E
      const structuralElements: StructuralElementReport[] = (f.structuralElements || []).map((el: any) => {
        totalStructuralElementsCount++;
        const uniqueElPhotos = dedupePhotos(el.overviewPhotos, el.ctxPhotoUrl);
        return {
          elementCode: el.elementCode || 'E-01',
          elementType: el.elementType || el.customElementType || 'Cột BTCT',
          materialType: el.materialType || el.customMaterialType || 'Bê tông cốt thép (BTCT) đổ toàn khối',
          roomName: el.roomName || el.customRoomName || 'Không gian',
          floorName,
          hasDamage: Boolean(el.hasDamage),
          notes: el.notes || '',
          ctxPhotoUrl: el.ctxPhotoUrl || '',
          overviewPhotos: uniqueElPhotos,
        };
      });

      // Ảnh toàn cảnh tầng
      const overviewPhotos = (f.overviewPhotos || []).map((p: any) => ({
        id: p.id || '',
        url: typeof p === 'string' ? p : p.url,
        caption: p.caption || '',
        isPortrait: isPortraitImage(typeof p === 'string' ? p : p.url),
      })).filter((p: any) => Boolean(p.url));

      const isDualPortrait = overviewPhotos.length === 2 && (overviewPhotos.every((p: any) => p.isPortrait) || overviewPhotos.length === 2);

      const floorBeamDeflection = f.beamDeflectionMm !== undefined
        ? Number(f.beamDeflectionMm)
        : Number(json.settlementTilt?.beamSagging?.sagMm || deformation.beam_deflection_mm || 0.0);
      const floorBeamPosition = f.beamSaggingPosition || json.settlementTilt?.beamSagging?.position || '';
      const floorBeamDesc = f.beamSaggingDesc || json.settlementTilt?.beamSagging?.description || '';
      const floorBeamPhotoUrl = f.beamSaggingPhotoUrl || json.settlementTilt?.beamSagging?.photoUrl || '';
      const floorMonitoringRequired = f.requiresAdditionalMonitoring !== undefined
        ? Boolean(f.requiresAdditionalMonitoring)
        : Boolean(json.settlementTilt?.needAdditionalMonitoring?.required || deformation.beam_deflection_mm > 5.0 || deformation.tilt_angle_x > 2.0);

      return {
        floorId: f.id || `floor_${fIdx}`,
        floorName,
        floorOrder: fIdx + 1,
        notes: f.notes || '',
        cadSketchPhotoUrl: f.cadSketchPhotoUrl || '',
        cadStructuralSketchPhotoUrl: f.cadStructuralSketchPhotoUrl || '',
        isDualPortrait,
        overviewPhotos,
        zones,
        structuralElements,
        totalDefectsInFloor: floorDefectsCount,
        beamDeflectionMm: floorBeamDeflection,
        beamSaggingPosition: floorBeamPosition,
        beamSaggingDesc: floorBeamDesc,
        beamSaggingPhotoUrl: floorBeamPhotoUrl,
        requiresAdditionalMonitoring: floorMonitoringRequired,
      };
    });
  } else {
    // 2. NẾU KHÔNG CÓ TRONG survey_data_json -> DÙNG BẢNG QUAN HỆ (FALLBACK)
    const floorsMap: Record<string, FloorSurveyReport> = {};
    if (floorSurveys.length > 0) {
      floorSurveys.forEach((f: any, idx: number) => {
        floorsMap[f.floor_name] = {
          floorName: f.floor_name,
          floorOrder: f.floor_order || idx + 1,
          notes: f.notes || '',
          cadSketchPhotoUrl: f.cad_drawing_url || '',
          cadStructuralSketchPhotoUrl: '',
          overviewPhotos: [],
          zones: [],
          structuralElements: [],
          totalDefectsInFloor: 0,
          beamDeflectionMm: Number(json.settlementTilt?.beamSagging?.sagMm || deformation.beam_deflection_mm || 0.0),
          beamSaggingPosition: json.settlementTilt?.beamSagging?.position || '',
          beamSaggingDesc: json.settlementTilt?.beamSagging?.description || '',
          beamSaggingPhotoUrl: json.settlementTilt?.beamSagging?.photoUrl || '',
          requiresAdditionalMonitoring: Boolean(json.settlementTilt?.needAdditionalMonitoring?.required || deformation.beam_deflection_mm > 5.0 || deformation.tilt_angle_x > 2.0),
        };
      });
    }

    damageZones.forEach((z: any) => {
      const flName = z.floor_name || 'Tầng trệt';
      if (!floorsMap[flName]) {
        floorsMap[flName] = {
          floorName: flName,
          floorOrder: Object.keys(floorsMap).length + 1,
          notes: '',
          zones: [],
          structuralElements: [],
          totalDefectsInFloor: 0,
        };
      }

      totalDamageZonesCount++;
      const zDefects: DefectItemReport[] = (z.defects || []).map((d: any) => {
        totalDefectsCount++;
        return {
          defectCode: d.defect_code || 'D-01',
          zoneCode: z.zone_code || 'Z-01',
          roomName: z.room_name || 'Phòng',
          componentType: z.component_type || 'Tường',
          defectType: d.defect_type || 'Nứt tường',
          screeningCategory: 'Nứt tường gạch / Vữa trát hoàn thiện',
          crackDirection: d.crack_direction || 'Xiên / Ngẫu nhiên',
          widthMaxMm: Number(d.width_max_mm || 0.1),
          lengthMm: Number(d.length_mm || 100),
          activityState: d.activity_state || 'U',
          activityStateLabel: activityStateLabels[d.activity_state || 'U'] || 'Chưa rõ',
          structuralSignificanceE2: Number(d.structural_significance_e2 || 0),
          structuralSignificanceLabel: structuralSigLabels[Number(d.structural_significance_e2 || 0)] || 'N/A',
          materialDegradationE4: Number(d.material_degradation_e4 || 0),
          materialDegradationLabel: `Mức ${d.material_degradation_e4 || 0}`,
          hasScaleCard: d.has_scale_card !== false,
          isStructuralCritical: Boolean(d.is_structural_critical),
          ctxPhotoUrl: z.ctx_photo_url || '',
          cuPhotoUrl: d.cu_photo_url || '',
          notes: d.notes || '',
        };
      });

      floorsMap[flName].totalDefectsInFloor = (floorsMap[flName].totalDefectsInFloor || 0) + zDefects.length;
      floorsMap[flName].zones.push({
        zoneCode: z.zone_code || 'Z-01',
        floorName: flName,
        roomName: z.room_name || 'Không gian',
        componentType: z.component_type || 'Tường gạch',
        wallMaterial: z.wall_material || 'Gạch xây trát vữa xi măng',
        functionalImpactRepairNeeded: Boolean(z.functional_impact_repair_needed),
        burlandGrade: Number(z.burland_grade || 0),
        burlandLabel: burlandLabels[Number(z.burland_grade || 0)] || 'Grade 0',
        notes: z.notes || '',
        ctxPhotoUrl: z.ctx_photo_url || '',
        overviewPhotos: [],
        hasDamage: zDefects.length > 0,
        defects: zDefects,
      });
    });

    floors = Object.values(floorsMap).sort((a, b) => a.floorOrder - b.floorOrder);
  }

  return {
    floors,
    totalDefectsCount,
    totalDamageZonesCount,
    totalStructuralElementsCount,
  };
}
