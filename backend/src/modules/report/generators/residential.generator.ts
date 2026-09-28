import * as fs from 'fs';
import * as path from 'path';
import Handlebars from 'handlebars';
import {
  ResidentialReportViewModel,
  DefectItemReport,
  DamageZoneReport,
  FloorSurveyReport,
  BcsChecklistItem,
  ReportPhotoItem,
  StructuralElementReport,
  AdjacentBuildingSide,
  GisMutationReport,
  HistoryInterviewItemReport,
} from '../report.types';

// Đăng ký các Handlebars Helper dùng chung
Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
Handlebars.registerHelper('ne', (a: any, b: any) => a !== b);
Handlebars.registerHelper('gt', (a: any, b: any) => Number(a) > Number(b));
Handlebars.registerHelper('gte', (a: any, b: any) => Number(a) >= Number(b));
Handlebars.registerHelper('inc', (v: any) => Number(v) + 1);
Handlebars.registerHelper('or', function(...args: any[]) {
  args.pop(); // remove Handlebars options
  return args.some(Boolean);
});
Handlebars.registerHelper('and', function(...args: any[]) {
  args.pop(); // remove Handlebars options
  return args.every(Boolean);
});
Handlebars.registerHelper('isNotEmpty', (arr: any) => Array.isArray(arr) && arr.length > 0);


export class ResidentialReportGenerator {
  /**
   * Chuyển đổi dữ liệu DB sang ViewModel đầy đủ bám sát báo cáo Phase 1 CRLG
   */
  static buildViewModel(reportData: any): ResidentialReportViewModel {
    const json = reportData.survey_data_json || {};
    const specs = reportData.buildingSpecs || {};
    const history = reportData.historicalSensitivity || {};
    const deformation = reportData.deformation || {};
    const riskScores = reportData.riskScores || {};
    const floorSurveys = reportData.floorSurveys || [];
    const damageZones = reportData.damageZones || [];
    const identPhotos = reportData.identificationPhotos || [];

    // Helper map nhãn hệ kết cấu
    const structuralSystemLabels: Record<string, string> = {
      KHUNG_BTCT_CHIU_LUC: 'Khung bê tông cốt thép (BTCT) chịu lực',
      TUONG_GACH_CHIU_LUC: 'Tường gạch chịu lực',
      KET_CAU_THEP: 'Khung nhà kết cấu thép tiền chế',
      NHA_GO: 'Nhà khung gỗ truyền thống',
      KET_CAU_HON_HOP: 'Kết cấu hỗn hợp (BTCT kết hợp tường gạch)',
      'Masonry - Tường gạch chịu lực': 'Tường gạch chịu lực',
      'RC - Bê tông cốt thép': 'Khung bê tông cốt thép (BTCT) chịu lực',
    };

    // Helper map nhãn móng
    const foundationLabels: Record<string, string> = {
      CAT_1_MONG_NONG_GIA_CO: 'CAT 1: Móng nông gia cố cừ tràm / đệm cát',
      CAT_2_MONG_DON_BTCT: 'CAT 2: Móng đơn bê tông cốt thép',
      CAT_3_MONG_BANG_BTCT: 'CAT 3: Móng băng bê tông cốt thép',
      CAT_4_MONG_COC_BTCT: 'CAT 4: Móng cọc bê tông cốt thép (Cọc ép/khoan nhồi)',
      CAT_5_KHONG_XAC_DINH: 'CAT 5: Không xác định / Chưa có hồ sơ móng',
    };

    // Helper badge màu
    const getEcsBadge = (c: string) => {
      switch (c) {
        case 'GOOD': return 'badge-good';
        case 'MEDIUM': return 'badge-medium';
        case 'DEFICIENT': return 'badge-deficient';
        case 'CRITICAL': return 'badge-critical';
        default: return 'badge-medium';
      }
    };

    const getViBadge = (c: string) => {
      switch (c) {
        case 'LOW': return 'badge-good';
        case 'MEDIUM': return 'badge-medium';
        case 'HIGH': return 'badge-deficient';
        case 'VERY_HIGH': return 'badge-critical';
        default: return 'badge-medium';
      }
    };

    const getBraBadge = (c: string) => {
      if (c?.includes('LOW')) return 'badge-good';
      if (c?.includes('MEDIUM')) return 'badge-medium';
      if (c?.includes('VERY_HIGH')) return 'badge-critical';
      if (c?.includes('HIGH')) return 'badge-deficient';
      return 'badge-medium';
    };

    const burlandLabels = [
      'Không đáng kể (Negligible)',
      'Rất nhẹ (Very slight)',
      'Nhẹ (Slight)',
      'Trung bình (Moderate)',
      'Nặng (Severe)',
      'Rất nặng (Very severe)',
    ];

    const activityStateLabels: Record<string, string> = {
      U: 'Chưa rõ (Unknown)',
      S: 'Ổn định / Cũ (Stable)',
      A: 'Đang phát triển (Active)',
    };

    const structuralSigLabels: Record<number, string> = {
      0: 'Không ảnh hưởng (N/A)',
      1: 'Thấp (Low)',
      2: 'Trung bình (Moderate)',
      3: 'Cao (High)',
      4: 'Nguy cấp (Critical)',
    };

    // Tọa độ GPS mặc định
    const defaultLat = json.gpsCoords?.lat ? Number(json.gpsCoords.lat) : 10.776889;
    const defaultLng = json.gpsCoords?.lng ? Number(json.gpsCoords.lng) : 106.690833;

    // Tách bộ 4 ảnh định danh P01-P04: Ưu tiên survey_data_json trước, fallback identificationPhotos
    const getPhotoFromSurveyJson = (jsonObj: any, photoType: string): ReportPhotoItem | null => {
      if (!jsonObj) return null;
      const url = typeof jsonObj === 'string' ? jsonObj : jsonObj.url;
      if (!url) return null;
      return {
        photoId: photoType.substring(0, 8),
        photoType: photoType as any,
        url,
        isNotApplicable: Boolean(jsonObj.notApplicable),
        naReason: jsonObj.naReason || '',
        capturedAt: reportData.survey_date || new Date().toLocaleDateString('vi-VN'),
        gpsLat: defaultLat,
        gpsLng: defaultLng,
        tag: jsonObj.tag || '',
      };
    };

    const findPhotoInRelational = (type: string): ReportPhotoItem => {
      const p = identPhotos.find((item: any) => item.photo_type === type);
      if (!p) {
        return {
          photoId: 'N/A',
          photoType: type as any,
          url: '',
          isNotApplicable: false,
          capturedAt: reportData.survey_date,
          gpsLat: defaultLat,
          gpsLng: defaultLng,
        };
      }
      return {
        photoId: p.id ? p.id.substring(0, 8).toUpperCase() : 'PHOTO-ID',
        photoType: p.photo_type,
        url: p.raw_photo_url || p.annotated_photo_url || '',
        isNotApplicable: p.is_not_applicable || false,
        naReason: p.na_reason || '',
        capturedAt: p.watermark_timestamp ? new Date(p.watermark_timestamp).toLocaleString('vi-VN') : reportData.survey_date,
        gpsLat: p.watermark_lat ? Number(p.watermark_lat) : defaultLat,
        gpsLng: p.watermark_lng ? Number(p.watermark_lng) : defaultLng,
      };
    };

    const p01 = getPhotoFromSurveyJson(json.photoP01, 'P01_HOUSE_NUMBER') || findPhotoInRelational('P01_HOUSE_NUMBER');
    const p02 = getPhotoFromSurveyJson(json.photoP02, 'P02_MAIN_FACADE') || findPhotoInRelational('P02_MAIN_FACADE');
    const p03 = getPhotoFromSurveyJson(json.photoP03, 'P03_SIDE_OR_REAR') || findPhotoInRelational('P03_SIDE_OR_REAR');
    if (json.photoP03?.tag && !p03.tag) p03.tag = json.photoP03.tag;
    const p04 = getPhotoFromSurveyJson(json.photoP04, 'P04_CONTEXT_STREET') || findPhotoInRelational('P04_CONTEXT_STREET');

    // Gom khuyết tật, vùng và cấu kiện theo Tầng
    let totalDefectsCount = 0;
    let totalDamageZonesCount = 0;
    let totalStructuralElementsCount = 0;
    let floors: FloorSurveyReport[] = [];

    // Helper deduplicate photos
    const dedupePhotos = (arr: any[] | undefined, excludeUrl?: string): string[] => {
      if (!arr || !Array.isArray(arr)) return [];
      const set = new Set<string>();
      arr.forEach((p) => {
        const u = typeof p === 'string' ? p : p?.url;
        if (u && typeof u === 'string' && u !== excludeUrl) {
          set.add(u);
        }
      });
      return Array.from(set);
    };

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

        // Helper phát hiện ảnh chụp đứng (Portrait)
        const isPortraitImage = (url: string): boolean => {
          if (!url || typeof url !== 'string') return false;
          // 1. PNG Base64
          if (url.startsWith('data:image/png;base64,')) {
            try {
              const header = Buffer.from(url.slice(22, 64), 'base64');
              if (header.length >= 24) {
                const width = header.readUInt32BE(16);
                const height = header.readUInt32BE(20);
                return height > width;
              }
            } catch {
              return false;
            }
          }
          // 2. JPEG Base64
          if (url.startsWith('data:image/jpeg;base64,') || url.startsWith('data:image/jpg;base64,')) {
            try {
              const commaIdx = url.indexOf(',');
              const base64Data = url.slice(commaIdx + 1, commaIdx + 65536);
              const buf = Buffer.from(base64Data, 'base64');
              let offset = 2;
              while (offset < buf.length - 8) {
                if (buf[offset] !== 0xFF) {
                  offset++;
                  continue;
                }
                const marker = buf[offset + 1];
                if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2 || marker === 0xC3) {
                  const height = buf.readUInt16BE(offset + 5);
                  const width = buf.readUInt16BE(offset + 7);
                  return height > width;
                }
                const len = buf.readUInt16BE(offset + 2);
                offset += 2 + len;
              }
            } catch {
              return false;
            }
          }
          // 3. File cục bộ / Uploads
          if (url.includes('/uploads/') || url.startsWith('./uploads') || url.startsWith('uploads/')) {
            try {
              const cleanPath = url.replace(/^.*?\/uploads\//, 'uploads/');
              const fullPath = path.resolve(process.cwd(), cleanPath);
              if (fs.existsSync(fullPath)) {
                const buf = fs.readFileSync(fullPath);
                if (buf[0] === 0x89 && buf[1] === 0x50 && buf.length >= 24) {
                  const width = buf.readUInt32BE(16);
                  const height = buf.readUInt32BE(20);
                  return height > width;
                } else if (buf[0] === 0xFF && buf[1] === 0xD8) {
                  let offset = 2;
                  while (offset < buf.length - 8) {
                    if (buf[offset] !== 0xFF) { offset++; continue; }
                    const marker = buf[offset + 1];
                    if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2 || marker === 0xC3) {
                      const height = buf.readUInt16BE(offset + 5);
                      const width = buf.readUInt16BE(offset + 7);
                      return height > width;
                    }
                    const len = buf.readUInt16BE(offset + 2);
                    offset += 2 + len;
                  }
                }
              }
            } catch {
              return false;
            }
          }
          return false;
        };

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

    // BCS Checklist 8 nhóm chuẩn
    const bcsChecklist: BcsChecklistItem[] = [
      {
        category: 'Nứt khối xây',
        indicator: 'Nứt tường / vách ngăn / lớp trát hoàn thiện',
        hasIndicator: totalDefectsCount > 0,
        locationAndSeverity: totalDefectsCount > 0 ? `Ghi nhận ${totalDefectsCount} vết nứt tại các tầng` : 'Không phát hiện nứt rõ rệt',
      },
      {
        category: 'Nứt kết cấu',
        indicator: 'Nứt cấu kiện chịu lực (Cột, Dầm, Sàn BTCT)',
        hasIndicator: Boolean(riskScores.e2_structure_score > 0),
        locationAndSeverity: riskScores.e2_structure_score > 0 ? `Khuyết tật mức E2=${riskScores.e2_structure_score}/4 điểm` : 'Kết cấu BTCT ổn định, chưa nứt nguy hiểm',
      },
      {
        category: 'Biến dạng',
        indicator: 'Lún chênh lệch / Nghiêng công trình / Võng dầm sàn',
        hasIndicator: Boolean(deformation.beam_deflection_mm > 0 || deformation.tilt_angle_x > 0),
        locationAndSeverity: deformation.beam_deflection_mm > 0 ? `Võng ${deformation.beam_deflection_mm}mm, Nghiêng X=${deformation.tilt_angle_x}‰, Y=${deformation.tilt_angle_y}‰` : 'Chưa ghi nhận biến dạng lún nghiêng bất thường',
      },
      {
        category: 'Nước & Thấm',
        indicator: 'Thấm dột sàn mái, tường bao, rò rỉ nước',
        hasIndicator: false,
        locationAndSeverity: 'Tường khô ráo, không phát hiện thấm dột nghiêm trọng',
      },
      {
        category: 'Suy giảm vật liệu',
        indicator: 'Bong tróc bê tông, rỉ sét lộ cốt thép, phong hóa vữa',
        hasIndicator: Boolean(riskScores.e4_material_score > 0),
        locationAndSeverity: riskScores.e4_material_score > 0 ? `Mức độ suy giảm E4=${riskScores.e4_material_score}/4` : 'Bề mặt vật liệu bình thường',
      },
      {
        category: 'Hư hỏng liên kết',
        indicator: 'Mất tiết diện, hư hỏng gối tựa, nứt chân cột',
        hasIndicator: false,
        locationAndSeverity: 'Liên kết dầm cột bình thường',
      },
      {
        category: 'Kẹt cửa & Chức năng',
        indicator: 'Kẹt cửa đi, nứt chéo góc cửa, mất kín khít',
        hasIndicator: false,
        locationAndSeverity: 'Cửa đóng mở bình thường, không biến dạng khuôn cửa',
      },
      {
        category: 'Nứt phát triển',
        indicator: 'Vết nứt đang phát triển / Đã trám trét nhưng tái nứt',
        hasIndicator: false,
        locationAndSeverity: 'Chưa có dấu hiệu vết nứt cũ tái phát triển',
      },
    ];

    // Hành động tối thiểu BRA
    const braValue = json.bra?.buildingRiskBra || riskScores.building_risk_assessment_bra || json.executiveSummary?.braStatus || 'LOW_RISK';
    let braMandatoryAction = json.bra?.braMandatoryAction || 'Lưu hồ sơ baseline; quan trắc theo kế hoạch giám sát định kỳ chung của dự án.';
    if (!json.bra?.braMandatoryAction) {
      if (braValue?.toUpperCase().includes('MEDIUM')) {
        braMandatoryAction = 'BCS đầy đủ; xác nhận lại thông tin móng; thiết lập mốc đo lún và quan trắc biến dạng định kỳ.';
      } else if (braValue?.toUpperCase().includes('VERY_HIGH')) {
        braMandatoryAction = 'Đánh giá chuyên sâu bởi Structural Engineer; thiết kế biện pháp gia cường móng/chống đỡ trước khi TBM đi qua.';
      } else if (braValue?.toUpperCase().includes('HIGH')) {
        braMandatoryAction = 'Khảo sát chi tiết kết cấu và móng; lắp đặt thiết bị quan trắc tự động tăng cường; kiểm tra ngưỡng biến dạng.';
      }
    }

    // Survey ID
    const surveyorPhone = reportData.surveyor_phone || '';
    const cleanPhone = surveyorPhone.replace(/\D/g, '');
    const surveyId = cleanPhone.length >= 4 ? `P-${cleanPhone.slice(-4)}` : (reportData.surveyor_code || 'P-0000');

    // Địa chỉ thực tế
    const formatWard = (w?: string) => {
      if (!w) return '';
      return w.toLowerCase().startsWith('phường') || w.toLowerCase().startsWith('xã') ? w : `Phường ${w}`;
    };
    const formatDistrict = (d?: string) => {
      if (!d) return '';
      return d.toLowerCase().startsWith('quận') || d.toLowerCase().startsWith('huyện') || d.toLowerCase().startsWith('thành phố') || d.toLowerCase().startsWith('tp') ? d : `Quận ${d}`;
    };
    const addressParts = [
      json.houseNumber || reportData.house_number,
      json.street || reportData.street,
      formatWard(reportData.ward),
      formatDistrict(reportData.district),
    ].filter(Boolean);
    const address = addressParts.length > 0 ? addressParts.join(', ') : (reportData.address || '');

    // Revision
    const revision = reportData.export_revision !== undefined && reportData.export_revision !== null
      ? String(reportData.export_revision).padStart(2, '0')
      : '00';

    // Xử lý công trình liền kề (Adjacent buildings)
    const adjacentBuildingsList: AdjacentBuildingSide[] = [];
    if (json.adjacentBuildings) {
      if (json.adjacentBuildings.left) {
        adjacentBuildingsList.push({
          side: 'left',
          sideLabel: 'Bên trái (Left)',
          details: json.adjacentBuildings.left.details || 'Khác',
          note: json.adjacentBuildings.left.note || '',
        });
      }
      if (json.adjacentBuildings.right) {
        adjacentBuildingsList.push({
          side: 'right',
          sideLabel: 'Bên phải (Right)',
          details: json.adjacentBuildings.right.details || 'Khác',
          note: json.adjacentBuildings.right.note || '',
        });
      }
      if (json.adjacentBuildings.back) {
        adjacentBuildingsList.push({
          side: 'back',
          sideLabel: 'Phía sau (Rear)',
          details: json.adjacentBuildings.back.details || 'Khác',
          note: json.adjacentBuildings.back.note || '',
        });
      }
    }

    // Xử lý biến động ranh đất GIS (GIS Mutation)
    const rawMutation = json.gisMutationConfirmed || {};
    const gisMutation: GisMutationReport = {
      isMutated: Boolean(rawMutation.type && rawMutation.type !== 'NONE'),
      type: rawMutation.type || '',
      typeLabel: rawMutation.type === 'SPLIT' ? 'Tách thửa ranh đất' : (rawMutation.type === 'MERGE' ? 'Hợp thửa ranh đất' : 'Điều chỉnh ranh'),
      splitReason: rawMutation.details?.splitReason || rawMutation.notes || '',
      splitChildren: (rawMutation.details?.splitChildren || []).map((c: any) => ({
        label: c.label || '',
        areaM2: Number(c.areaM2 || 0),
        ownerName: c.ownerName || '',
        houseNumber: c.houseNumber || '',
        suggestedCode: c.suggestedCode || '',
        functionalType: c.functionalType || '',
      })),
    };

    // Xử lý phỏng vấn lịch sử công trình (History Interview - Lấy đúng theo dữ liệu phase, không tự ghi bừa)
    const rawHistoryInterview = json.historyInterview || {};
    const RENOVATION_LABELS: Record<number, string> = {
      0: 'Không',
      1: 'Nhẹ - Đã xử lý ổn định',
      2: 'Nhiều - Chưa rõ kết cấu',
      3: 'Thay đổi lớn - Nghiêm trọng',
    };
    const MAJOR_REPAIR_LABELS: Record<number, string> = {
      0: 'Không',
      1: 'Nhẹ - Đã xử lý',
      2: 'Nhiều - Chưa rõ hồ sơ',
      3: 'Cải tạo lớn ảnh hưởng chịu lực',
    };
    const PAST_SETTLEMENT_LABELS: Record<number, string> = {
      0: 'Không',
      1: 'Nhẹ - Đã ổn định',
      2: 'Rõ - Tiếp diễn',
      3: 'Nghiêm trọng',
    };
    const NEIGHBOR_DAMAGE_LABELS: Record<number, string> = {
      0: 'Không',
      1: 'Nhẹ - Đã bồi thường',
      2: 'Đáng kể',
      3: 'Tranh chấp - Nghiêm trọng',
    };
    const FIRE_FLOOD_LABELS: Record<number, string> = {
      0: 'Không',
      1: 'Nhẹ - Đã khắc phục',
      2: 'Trung bình - Chưa rõ mức ảnh hưởng',
      3: 'Nghiêm trọng',
    };

    const renoScore = Number(rawHistoryInterview.renovationLoad ?? (history.extended_or_renovated ? 1 : 0));
    const repairScore = Number(rawHistoryInterview.majorRepair ?? 0);
    const settScore = Number(rawHistoryInterview.pastSettlement ?? (history.previous_settlement_or_tilt ? 1 : 0));
    const neighScore = Number(rawHistoryInterview.neighborDamage ?? 0);
    const fireScore = Number(rawHistoryInterview.fireFloodIncident ?? (history.fire_or_accident ? 1 : 0));
    const hasSens = Boolean(rawHistoryInterview.sensitiveEquipment?.has || rawHistoryInterview.continuousOperation247 || history.sensitive_equipment_present);

    const historyInterviewItems: HistoryInterviewItemReport[] = [
      {
        category: 'Cơi nới / Tăng tải',
        indicator: 'Nâng tầng, thay đổi tải trọng, cơi nới quy mô xây dựng',
        hasItem: renoScore > 0,
        notes: renoScore > 0 ? (RENOVATION_LABELS[renoScore] || 'Có') : 'Không',
      },
      {
        category: 'Sửa chữa lớn',
        indicator: 'Gia cố kết cấu, đập thông tường, cải tạo lớn trong quá khứ',
        hasItem: repairScore > 0,
        notes: repairScore > 0 ? (MAJOR_REPAIR_LABELS[repairScore] || 'Có') : 'Không',
      },
      {
        category: 'Lún / Nghiêng cũ',
        indicator: 'Lịch sử lún chênh lệch, nghiêng tường, nứt kết cấu cũ',
        hasItem: settScore > 0,
        notes: settScore > 0 ? (PAST_SETTLEMENT_LABELS[settScore] || 'Có') : 'Không',
      },
      {
        category: 'Ảnh hưởng lân cận',
        indicator: 'Hư hỏng do các công trình xây dựng liền kề gây ra',
        hasItem: neighScore > 0,
        notes: neighScore > 0 ? (NEIGHBOR_DAMAGE_LABELS[neighScore] || 'Có') : 'Không',
      },
      {
        category: 'Sự cố hỏa hoạn / ngập',
        indicator: 'Hỏa hoạn, ngập lụt kéo dài, va chạm xe cơ giới',
        hasItem: fireScore > 0,
        notes: fireScore > 0 ? (FIRE_FLOOD_LABELS[fireScore] || 'Có') : 'Không',
      },
      {
        category: 'Thiết bị nhạy cảm',
        indicator: 'Thiết bị chính xác cao, hoạt động rung động liên tục 24/7',
        hasItem: hasSens,
        notes: hasSens ? (rawHistoryInterview.sensitiveEquipment?.description || 'Có ghi nhận thiết bị nhạy cảm') : 'Không',
      },
    ];

    // Xử lý ảnh biên bản làm việc hiện trường (Phụ lục F)
    let workingMinutesPhotos: string[] = [];
    if (json.signatures?.workingMinutesPhotos && Array.isArray(json.signatures.workingMinutesPhotos)) {
      workingMinutesPhotos = json.signatures.workingMinutesPhotos.filter(Boolean);
    }
    if (workingMinutesPhotos.length === 0 && reportData.official_pdf_url) {
      workingMinutesPhotos = [reportData.official_pdf_url];
    }

    // Chi tiết móng
    const foundationDepthM = json.foundationDepthM !== undefined && json.foundationDepthM !== null && json.foundationDepthM !== ''
      ? json.foundationDepthM
      : (specs.foundation_depth_m || '--');
    const pileDimensionMm = json.pileDimensionMm || (json.pileWidthMm && json.pileLengthMm ? `${json.pileWidthMm} x ${json.pileLengthMm} mm` : '');

    // Đánh giá Burland
    const rawBurland = json.burlandSummary || {};
    const burlandPredominantGrade = rawBurland.predominantGrade !== undefined
      ? Number(rawBurland.predominantGrade)
      : Number(riskScores.e1_burland_score || 0);
    const burlandLocalMaxGrade = rawBurland.localMaxGrade !== undefined
      ? Number(rawBurland.localMaxGrade)
      : Number(riskScores.e1_burland_score || 0);

    // Nhãn nhóm đối tượng & phân loại khảo sát
    const objectGroupLabels: Record<string, string> = {
      GENERAL: 'Công trình thông thường (Nhà dân cư / Trụ sở thương mại thấp tầng)',
      IMPORTANT: 'Công trình quan trọng / Tập trung đông người (Trường học, Bệnh viện, Khách sạn)',
      SENSITIVE: 'Công trình đặc biệt nhạy cảm với biến dạng (Di tích lịch sử, Tòa nhà công nghệ cao)',
    };

    const surveyCaseLabels: Record<string, string> = {
      NORMAL: 'Khảo sát bình thường (Đầy đủ từ móng đến mái)',
      ABSENTEE: 'Chủ hộ vắng mặt / Không tiếp cận được hiện trường',
      VACANT_LAND: 'Khu đất trống chưa có công trình xây dựng kiên cố',
      APARTMENT: 'Căn hộ con trong khối nhà chung cư / Tập thể',
      UNDER_CONSTRUCTION: 'Công trình đang thi công dở dang',
    };

    const structuralFlagLabels: Record<string, string> = {
      NONE: 'None - Không có cờ kết cấu (0đ)',
      LOW: 'Low - Cờ kết cấu thấp (1đ)',
      MODERATE: 'Moderate - Cờ kết cấu trung bình (2đ)',
      HIGH: 'High - Cờ kết cấu cao / Nguy cơ chịu lực (3đ)',
      CRITICAL: 'Critical - Cờ kết cấu nguy cấp / Cảnh báo sập (4đ)',
    };

    const currentCase = json.surveyCaseType || (json.isAbsenteeSurvey ? 'ABSENTEE' : (json.isVacantLand ? 'VACANT_LAND' : 'NORMAL'));
    const currentObjectGroup = json.objectGroup || 'GENERAL';
    const rawBurlandStructFlag = rawBurland.structuralFlagLevel || 'NONE';

    return {
      projectName: 'DỰ ÁN XÂY DỰNG TUYẾN ĐƯỜNG SẮT ĐÔ THỊ SỐ 2 TP. HỒ CHÍ MINH (BẾN THÀNH – THAM LƯƠNG)',
      metroLineName: 'Tuyến Metro Số 2 (Bến Thành – Tham Lương)',
      reportCode: reportData.report_code || 'BCS-P1-CRLG-001',
      buildingId: reportData.project_parcel_code || json.projectParcelCode || 'B-00000',
      officialCadastralCode: json.officialCadastralCode || reportData.official_cadastral_code || '',
      surveyId,
      address,
      houseNumber: json.houseNumber || reportData.house_number || '',
      street: json.street || reportData.street || '',
      ward: reportData.ward || '',
      district: reportData.district || '',
      zoneId: reportData.zone_id || 'ZONE_01',
      zoneName: `Khu vực Ga ${reportData.zone_id || 'ZONE_01'}`,
      chainage: json.chainage || reportData.chainage || 'Km 0+000',
      distanceToTunnelMeters: json.metroOffsetDistance ? parseFloat(json.metroOffsetDistance) : (reportData.distance_to_tunnel_meters ? Number(reportData.distance_to_tunnel_meters) : 15.0),
      clearanceOffsetDistanceM: json.clearanceOffsetDistance || reportData.clearance_offset_distance_m || '',
      metroItemType: reportData.metro_item_type || 'Đào hầm bằng khiên đào TBM ngầm',
      isTbm: (() => {
        const t = (reportData.metro_item_type || json.metroItemType || 'TBM').toLowerCase();
        return t.includes('tbm') || t.includes('khiên') || (!t.includes('ga') && !t.includes('cut'));
      })(),
      isStation: (() => {
        const t = (reportData.metro_item_type || json.metroItemType || '').toLowerCase();
        return t.includes('ga') || t.includes('station');
      })(),
      isCutAndCover: (() => {
        const t = (reportData.metro_item_type || json.metroItemType || '').toLowerCase();
        return t.includes('cut') || t.includes('đào hở') || t.includes('c&c');
      })(),
      isOtherMetro: (() => {
        const t = (reportData.metro_item_type || json.metroItemType || '').toLowerCase();
        return !t.includes('tbm') && !t.includes('khiên') && !t.includes('ga') && !t.includes('station') && !t.includes('cut') && !t.includes('đào hở') && !t.includes('c&c') && t.length > 0;
      })(),
      surveyDate: json.surveyDate ? new Date(json.surveyDate).toLocaleDateString('vi-VN') : (reportData.survey_date ? new Date(reportData.survey_date).toLocaleDateString('vi-VN') : new Date().toLocaleDateString('vi-VN')),
      revision,
      preparedByName: json.surveyorName || reportData.surveyor_name || json.signatures?.preparedBy?.fullName || 'Khảo sát viên Hiện trường',
      preparedByTitle: 'Khảo sát viên Hiện trường (Prepared by)',
      checkedByName: json.zoneAdminName || reportData.zone_admin_name || json.signatures?.checkedBy?.fullName || 'Zone Admin',
      checkedByTitle: 'Kỹ sư Giám sát Zone Admin (Checked by)',
      approvedByName: reportData.super_admin_name || 'Super Admin',
      approvedByTitle: 'Chuyên gia Phê duyệt Super Admin (Approved by)',
      facadeCoverPhotoUrl: p02.url,

      // Dashboard
      totalEcsScore: json.ecs?.totalEcs !== undefined ? Number(json.ecs.totalEcs) : Number(riskScores.total_ecs_score || 0),
      ecsClass: json.ecs?.ecsClass || riskScores.ecs_class || 'GOOD',
      ecsBadgeClass: getEcsBadge(json.ecs?.ecsClass || riskScores.ecs_class || 'GOOD'),
      avgViScore: json.vi?.viAvg !== undefined ? Number(json.vi.viAvg) : Number(riskScores.avg_vi_score || 1.0),
      viClass: json.vi?.viClass || riskScores.vi_class || 'LOW',
      viBadgeClass: getViBadge(json.vi?.viClass || riskScores.vi_class || 'LOW'),
      constructionImpactLevelI: json.bra?.constructionImpactLevel !== undefined ? Number(json.bra.constructionImpactLevel) : (json.executiveSummary?.constructionImpactStatus ? parseInt(json.executiveSummary.constructionImpactStatus.replace(/\D/g, '') || '2') : Number(riskScores.construction_impact_level_i || 2)),
      impactBadgeClass: 'badge-medium',
      buildingRiskAssessmentBra: braValue,
      braBadgeClass: getBraBadge(braValue),
      predictedSettlementSmax: json.bra?.predictedSettlementSmax !== undefined ? Number(json.bra.predictedSettlementSmax) : (reportData.predicted_settlement_smax ? Number(reportData.predicted_settlement_smax) : 0),
      angularDistortion: json.bra?.angularDistortion || reportData.angular_distortion || '',
      vibrationPpv: json.bra?.vibrationPpv !== undefined ? Number(json.bra.vibrationPpv) : (reportData.vibration_ppv ? Number(reportData.vibration_ppv) : 0),

      // Building specs
      buildingName: json.buildingName || specs.building_name || '',
      ownerName: json.ownerName || reportData.owner_name || '',
      ownerPhone: json.ownerPhone || reportData.owner_phone || '',
      landUseFunction: json.usageFunction || specs.land_use_function || 'Nhà ở riêng lẻ',
      floorCount: Number(json.aboveFloors || specs.floor_count || reportData.floor_count || 1),
      basementCount: Number(json.undergroundFloors || specs.basement_count || 0),
      structuralSystem: json.structureSystem || specs.structural_system || 'KHUNG_BTCT_CHIU_LUC',
      structuralSystemLabel: structuralSystemLabels[json.structureSystem] || structuralSystemLabels[specs.structural_system] || json.structureSystem || specs.structural_system || 'Khung BTCT chịu lực',
      foundationCategory: json.foundationCatScore ? `CAT ${json.foundationCatScore}` : (specs.foundation_category || ''),
      foundationCategoryLabel: json.foundationType || foundationLabels[specs.foundation_category] || 'Móng nông / Móng đơn BTCT',
      foundationInfoSource: json.foundationSource || specs.foundation_source || 'Quan sát hiện trường',
      foundationDepthM,
      pileDimensionMm,
      foundationDensity: json.foundationDensity || '',
      foundationSpacingM: json.foundationSpacingM || '',
      foundationNotes: json.foundationNotes || '',
      constructionAreaM2: json.constructionAreaM2 || (specs.construction_area_m2 ? Number(specs.construction_area_m2) : ''),
      buildingHeightM: json.buildingHeightM || (specs.building_height_m ? Number(specs.building_height_m) : ''),
      estimatedHeightM: json.buildingHeightM || (specs.building_height_m ? Number(specs.building_height_m) : ''),
      yearOfConstruction: json.constructionYear || specs.year_of_construction || '',
      isYearEstimated: Boolean(json.isEstimatedYear !== undefined ? json.isEstimatedYear : specs.is_year_estimated),
      asBuiltDrawingPhotoUrl: json.asBuiltDrawingPhotoUrl || '',
      asBuiltDrawingFiles: Array.isArray(json.asBuiltDrawingFiles) ? json.asBuiltDrawingFiles : [],
      isAbsenteeSurvey: Boolean(json.isAbsenteeSurvey),
      absenteeReason: json.absenteeReason || '',
      vacantLandStatus: json.vacantLandStatus || '',
      vacantLandNotes: json.vacantLandNotes || '',
      p02WidthM: json.photoP02?.widthM || '',
      p02HeightM: json.photoP02?.heightM || '',
      adjacentBuildingsNote: specs.adjacent_buildings || '',
      adjacentBuildingsList,

      // GIS Mutation
      gisMutation,

      // History & Notes
      extendedOrRenovated: Boolean(rawHistoryInterview.renovationLoad || history.extended_or_renovated),
      extendedOrRenovatedNotes: rawHistoryInterview.renovationLoad ? 'Đã từng cơi nới / nâng tầng' : '',
      previousSettlementOrTilt: Boolean(rawHistoryInterview.pastSettlement || history.previous_settlement_or_tilt),
      previousSettlementNotes: rawHistoryInterview.pastSettlement ? 'Có ghi nhận hiện tượng lún nứt cũ' : '',
      fireOrAccident: Boolean(rawHistoryInterview.fireFloodIncident || history.fire_or_accident),
      fireOrAccidentNotes: rawHistoryInterview.fireFloodIncident ? 'Có sự cố trong quá khứ' : '',
      sensitiveEquipmentPresent: Boolean(rawHistoryInterview.sensitiveEquipment?.has || rawHistoryInterview.continuousOperation247 || history.sensitive_equipment_present),
      sensitiveEquipmentNotes: rawHistoryInterview.sensitiveEquipment?.description || '',
      historyDetailsNote: rawHistoryInterview.usageStatus ? `Tình trạng sử dụng: ${rawHistoryInterview.usageStatus}` : '',
      historyInterviewItems,

      // Step 1: GPS, Object Group & Survey Case
      gpsLat: defaultLat,
      gpsLng: defaultLng,
      objectGroup: currentObjectGroup,
      objectGroupLabel: objectGroupLabels[currentObjectGroup] || currentObjectGroup,
      surveyCaseType: currentCase,
      surveyCaseLabel: surveyCaseLabels[currentCase] || currentCase,
      absenteeMinutesPhotos: (json.absenteeMinutesPhotos || []).filter(Boolean),
      vacantLandPhotos: (json.vacantLandPhotos || []).filter(Boolean),
      underConstructionPhotos: (json.underConstructionPhotos || []).filter(Boolean),
      constructionStageNotes: json.constructionStageNotes || '',
      p03Tag: p03.tag || json.photoP03?.tag || 'Bên hông trái',
      p03AdditionalPhotos: (json.photoP03?.additionalPhotos || []).filter(Boolean),

      // Scope & Access Limitations (Step 5 - Lấy trực tiếp từ phase khảo sát, không đưa bừa tầng/khu vực không có)
      surveyScopeItems: (() => {
        const items: { areaName: string; isAccessed: boolean; notes: string }[] = [];
        if (p01.url || p02.url || p04.url) {
          items.push({
            areaName: 'Mặt tiền & Ngoại quan công trình',
            isAccessed: true,
            notes: 'Đã khảo sát và chụp bộ ảnh định danh ngoại quan (P-01 đến P-04)',
          });
        }
        floors.forEach((f) => {
          const zCount = (f.zones || []).length;
          const eCount = (f.structuralElements || []).length;
          items.push({
            areaName: f.floorName,
            isAccessed: true,
            notes: f.notes ? f.notes : `Đã khảo sát ${zCount} vùng Z, ${eCount} cấu kiện E`,
          });
        });

        const accType = json.accessLimitation?.type || 'FULL_100';
        const rawRestrictedAreas = Array.isArray(json.accessLimitation?.restrictedAreas) ? json.accessLimitation.restrictedAreas.filter(Boolean) : [];
        const rawRestrictedFloors = Array.isArray(json.accessLimitation?.restrictedFloorLevels) ? json.accessLimitation.restrictedFloorLevels.filter(Boolean) : [];
        const mainReason = json.accessLimitation?.mainReason || json.absenteeReason || '';
        const aNotes = json.accessLimitation?.notes || '';

        if (accType === 'LIMITED') {
          rawRestrictedAreas.forEach((area: string) => {
            if (area === 'Các tầng lầu trên cao' && rawRestrictedFloors.length > 0) {
              rawRestrictedFloors.forEach((fl: string) => {
                items.push({
                  areaName: `Tầng bị hạn chế: ${fl}`,
                  isAccessed: false,
                  notes: mainReason || aNotes || 'Chưa tiếp cận được',
                });
              });
            } else {
              items.push({
                areaName: area,
                isAccessed: false,
                notes: mainReason || aNotes || 'Chưa tiếp cận được',
              });
            }
          });
        } else if (accType === 'ABSENT_REFUSED' || accType === 'ABSENTEE') {
          items.push({
            areaName: 'Bên trong toàn bộ công trình',
            isAccessed: false,
            notes: mainReason || 'Chủ hộ vắng mặt / Không tiếp cận được hiện trường',
          });
        }
        return items;
      })(),
      surveyedFloorsList: json.surveyScope?.surveyedFloors || (json.floors ? json.floors.map((f: any) => f.floorName) : ['Tầng trệt']),
      accessLimitationType: json.accessLimitation?.type || 'FULL_100',
      accessLimitationLabel: (() => {
        const accType = json.accessLimitation?.type || 'FULL_100';
        if (accType === 'LIMITED') return 'Hạn chế tiếp cận một phần';
        if (accType === 'ABSENT_REFUSED' || accType === 'ABSENTEE') return 'Vắng mặt / Không thể tiếp cận';
        return 'Không có hạn chế (Tiếp cận 100%)';
      })(),
      restrictedAreasList: (json.accessLimitation?.restrictedAreas || []).filter(Boolean),
      restrictedAreasDisplay: (() => {
        const accType = json.accessLimitation?.type || 'FULL_100';
        if (accType === 'LIMITED') {
          const rawRestrictedAreas = Array.isArray(json.accessLimitation?.restrictedAreas) ? json.accessLimitation.restrictedAreas.filter(Boolean) : [];
          const rawRestrictedFloors = Array.isArray(json.accessLimitation?.restrictedFloorLevels) ? json.accessLimitation.restrictedFloorLevels.filter(Boolean) : [];
          const allRestricted = [...rawRestrictedAreas, ...rawRestrictedFloors].filter((v, i, a) => a.indexOf(v) === i && v !== 'Các tầng lầu trên cao');
          return allRestricted.length > 0 ? allRestricted.join(', ') : 'Không';
        }
        if (accType === 'ABSENT_REFUSED' || accType === 'ABSENTEE') return 'Toàn bộ không gian bên trong công trình';
        return 'Không';
      })(),
      accessMainReason: json.accessLimitation?.mainReason || '',
      accessMainReasonDisplay: (() => {
        const accType = json.accessLimitation?.type || 'FULL_100';
        const reason = json.accessLimitation?.mainReason || json.absenteeReason || '';
        return (accType !== 'FULL_100' && reason) ? reason : 'Không';
      })(),
      accessNotes: json.accessLimitation?.notes || '',
      accessNotesDisplay: json.accessLimitation?.notes || 'Không',

      p01,
      p02,
      p03,
      p04,

      bcsChecklist,
      floors,
      totalDefectsCount,
      totalDamageZonesCount,
      totalStructuralElementsCount,

      // Deformation (Step 4)
      tiltAngleX: Number(json.settlementTilt?.buildingTilt?.xPermille || deformation.tilt_angle_x || 0.0),
      tiltAngleY: Number(json.settlementTilt?.buildingTilt?.yPermille || deformation.tilt_angle_y || 0.0),
      tiltDirection: json.settlementTilt?.buildingTilt?.direction || deformation.tilt_direction || 'Chưa phát hiện nghiêng',
      floorSlopeRatio: Number(deformation.floor_slope_ratio || 0.0),
      beamDeflectionMm: Number(json.settlementTilt?.beamSagging?.sagMm || deformation.beam_deflection_mm || 0.0),
      measurementMethod: (json.settlementTilt?.dataSource && json.settlementTilt.dataSource.join(', ')) || deformation.measurement_method || 'Quan sát trực quan',
      measurementReliability: json.settlementTilt?.reliability || deformation.measurement_reliability || 'HIGH',
      requiresAdditionalMonitoring: Boolean(json.settlementTilt?.needAdditionalMonitoring?.required || deformation.beam_deflection_mm > 5.0 || deformation.tilt_angle_x > 2.0),
      deformationEngineerComments: json.settlementTilt?.needAdditionalMonitoring?.notes || deformation.engineer_comments || deformation.tilt_evolution_verdict || '',
      buildingTiltPhotoUrl: json.settlementTilt?.buildingTilt?.photoUrl || '',
      diffSettlementPhotoUrl: json.settlementTilt?.diffSettlement?.photoUrl || '',
      beamSaggingPhotoUrl: json.settlementTilt?.beamSagging?.photoUrl || '',
      diffSettlementLevel: json.settlementTilt?.diffSettlement?.level !== undefined ? Number(json.settlementTilt.diffSettlement.level) : 0,
      diffSettlementPosition: json.settlementTilt?.diffSettlement?.position || '',
      diffSettlementNotes: json.settlementTilt?.diffSettlement?.notes || '',
      buildingTiltLevel: json.settlementTilt?.buildingTilt?.level !== undefined ? Number(json.settlementTilt.buildingTilt.level) : 0,
      buildingTiltNotes: json.settlementTilt?.buildingTilt?.notes || '',
      beamSaggingLevel: json.settlementTilt?.beamSagging?.level !== undefined ? Number(json.settlementTilt.beamSagging.level) : 0,
      beamSaggingPosition: json.settlementTilt?.beamSagging?.position || '',
      beamSaggingDesc: json.settlementTilt?.beamSagging?.description || '',

      // Burland 1977 (Step 4)
      burlandPredominantGrade,
      burlandPredominantLabel: burlandLabels[burlandPredominantGrade] || 'Grade 0',
      burlandLocalMaxGrade,
      burlandLocalMaxLabel: burlandLabels[burlandLocalMaxGrade] || 'Grade 0',
      burlandGoverningZoneCode: rawBurland.governingZoneCode || '',
      burlandGoverningZoneDesc: rawBurland.governingZoneDescription || '',
      burlandStructuralFlagLevel: rawBurlandStructFlag,
      burlandStructuralFlagLevelLabel: structuralFlagLabels[rawBurlandStructFlag] || rawBurlandStructFlag,
      burlandRepresentativeness: rawBurland.representativeness || 'GLOBAL',
      burlandRepresentativenessLabel: rawBurland.representativeness === 'LOCAL' ? 'Cục bộ (Chỉ xuất hiện tại một vài khu vực)' : 'Toàn công trình (Đại diện chung toàn nhà)',
      structuralDefectFlag: totalDefectsCount > 0 ? (rawBurlandStructFlag !== 'NONE' ? `Cờ cảnh báo: ${structuralFlagLabels[rawBurlandStructFlag] || rawBurlandStructFlag}` : 'Nứt phi kết cấu khối xây') : 'Không có khuyết tật kết cấu',
      requiresStructuralReview: Boolean(rawBurland.needStructuralEngineerReview),

      // ECS (Step 6)
      ecsE1: json.ecs?.e1 !== undefined ? Number(json.ecs.e1) : Number(riskScores.e1_burland_score || 0),
      ecsE2: json.ecs?.e2 !== undefined ? Number(json.ecs.e2) : Number(riskScores.e2_structure_score || 0),
      ecsE3: json.ecs?.e3 !== undefined ? Number(json.ecs.e3) : Number(riskScores.e3_deformation_score || 0),
      ecsE4: json.ecs?.e4 !== undefined ? Number(json.ecs.e4) : Number(riskScores.e4_material_score || 0),
      ecsE5: json.ecs?.e5 !== undefined ? Number(json.ecs.e5) : Number(riskScores.e5_history_score || 0),
      ecsE6: json.ecs?.e6 !== undefined ? Number(json.ecs.e6) : Number(riskScores.e6_overall_function_score || 0),
      ecsJudgementApplied: Boolean(json.ecs?.engineeringJudgement?.action && json.ecs.engineeringJudgement.action !== 'KEEP' || riskScores.is_engineering_judgement_applied),
      ecsJudgementAction: json.ecs?.engineeringJudgement?.action || riskScores.engineering_judgement_action || 'KEEP',
      ecsJudgementReason: json.ecs?.engineeringJudgement?.reason || riskScores.engineering_judgement_reason || '',
      qualityGates: [],
      gateDecisionStatus: json.gateDecision?.decision || 'ALLOW',
      gateDecisionLabel: json.gateDecision?.decision === 'ALLOW' ? 'Đủ điều kiện chuyển tiếp (ALLOW)' : (json.gateDecision?.decision === 'CONDITIONAL' ? 'Chấp thuận có điều kiện (CONDITIONAL)' : 'Chưa đạt yêu cầu (BLOCK)'),
      gateDecisionReason: json.gateDecision?.reason || '',

      // VI (Step 6)
      viV1: json.vi?.v1 !== undefined ? Number(json.vi.v1) : Number(riskScores.v1_importance_score || 1.0),
      viV2: json.vi?.v2 !== undefined ? Number(json.vi.v2) : Number(riskScores.v2_structure_score || 1.0),
      viV3: json.vi?.v3 !== undefined ? Number(json.vi.v3) : Number(riskScores.v3_foundation_score || 1.0),
      viV4: json.vi?.v4 !== undefined ? Number(json.vi.v4) : Number(riskScores.v4_age_score || 1.0),
      viV5: json.vi?.v5 !== undefined ? Number(json.vi.v5) : Number(riskScores.v5_ecs_score || 1.0),
      viV6: json.vi?.v6 !== undefined ? Number(json.vi.v6) : Number(riskScores.v6_sensitivity_score || 1.0),
      viJudgementApplied: Boolean(json.vi?.engineeringJudgement?.action && json.vi.engineeringJudgement.action !== 'KEEP'),
      viJudgementAction: json.vi?.engineeringJudgement?.action || 'KEEP',
      viJudgementReason: json.vi?.engineeringJudgement?.reason || '',

      // Metro & BRA
      braMatrixCell: `V=${json.vi?.viClass || riskScores.vi_class || 'LOW'} × I=${json.executiveSummary?.constructionImpactStatus || 'I2'}`,
      braMandatoryAction,
      braEngineeringReviewNotes: reportData.bra_engineering_review_notes || '',

      // Recommendations & Remarks (Lấy đúng theo phase, không bịa)
      summaryConclusions: (json.executiveSummary?.keyRisksDefectsText || reportData.summary_conclusions || '').trim(),
      engineeringRecommendations: (() => {
        const rawRec = json.executiveSummary?.specificRecommendationsText || reportData.engineering_recommendations;
        return (rawRec && typeof rawRec === 'string' && rawRec.trim() && rawRec.trim() !== 'Không') ? rawRec.trim() : 'Không';
      })(),
      ownerRemarks: (() => {
        const rawRemarks = json.ownerRemarks || json.signatures?.ownerFeedback || reportData.owner_remarks;
        return (rawRemarks && typeof rawRemarks === 'string' && rawRemarks.trim() && rawRemarks.trim() !== 'Không') ? rawRemarks.trim() : 'Không';
      })(),
      requiresPhase2: true,
      requiresMonitoring: true,

      // Signatures
      surveyorSignatureUrl: reportData.surveyor_signature_url,
      surveyorSignatureImg: reportData.surveyor_signature_img || reportData.surveyor_signature_url || '',
      ownerSignatureUrl: reportData.owner_signature_url,
      ownerSignatureImg: reportData.owner_signature_url || '',
      zoneAdminSignatureUrl: reportData.zone_admin_signature_url,
      zoneAdminSignatureImg: reportData.zone_admin_signature_img || reportData.zone_admin_signature_url || '',
      superAdminSignatureImg: reportData.super_admin_signature_img || '',
      fieldWorkMinutesPhotoUrl: reportData.official_pdf_url || '',
      workingMinutesPhotos,
      generatedAt: new Date().toLocaleString('vi-VN'),
    };
  }

  /**
   * Tạo chuỗi HTML hoàn chỉnh từ ViewModel và Template Handlebars
   */
  static generateHtml(viewModel: ResidentialReportViewModel): string {
    const candidateDirs = [
      path.resolve(__dirname, '../templates/residential'),
      path.resolve(__dirname, '../../../../src/modules/report/templates/residential'),
      path.resolve(__dirname, '../../../src/modules/report/templates/residential'),
      path.resolve(process.cwd(), 'src/modules/report/templates/residential'),
      path.resolve(process.cwd(), 'backend/src/modules/report/templates/residential'),
      path.resolve(process.cwd(), 'dist/modules/report/templates/residential'),
      path.resolve(process.cwd(), 'backend/dist/modules/report/templates/residential'),
    ];
    let templateDir = candidateDirs.find((d) => fs.existsSync(path.join(d, 'index.hbs'))) || candidateDirs[0];
    const templatePath = path.join(templateDir, 'index.hbs');
    const stylesPath = path.join(templateDir, 'styles.css');

    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const styles = fs.readFileSync(stylesPath, 'utf8');

    const compiledTemplate = Handlebars.compile(templateSource);
    return compiledTemplate({
      ...viewModel,
      styles,
    });
  }
}
