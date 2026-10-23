/**
 * ============================================================================
 * REPORT V2 SERVICE (ORCHESTRATOR)
 * Điều phối dữ liệu, tính toán ViewModel, biên dịch Handlebars và xuất PDF V2
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import Handlebars from 'handlebars';
import { SurveyRepository } from '../survey/survey.repository';
import { NotFoundError } from '../../common/errors/problem-details';
import { ReportV2ViewModelMapper } from './mappers/report-v2-viewmodel.mapper';
import { PdfRenderV2Engine } from './engine/pdf-render-v2.engine';
import { applyOverridesToReportV2 } from './utils/report-override-v2.utils';
import { ReportV2ViewModel } from './report-v2.types';
import { ReportWatermarkCanvasService } from './services/report-watermark-canvas.service';
import { maskReportPii } from '../../common/utils/pii.utils';
import { preloadImageOrientations } from '../report/generators/residential/residential.image-sniff';
import { ReportImageResolver } from './services/report-image-resolver.service';
import { ReportFontsService } from './services/report-fonts.service';
import { ReportConfigService } from '../report_config/report-config.service';
import type { ReportContentConfig } from '../report_config/report-config.types';
import { extractParcelPolygonCoords, preloadSatelliteTiles } from './utils/metro-spatial.utils';

function extractAllImageUrls(obj: any, urls: Set<string> = new Set()): string[] {
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

function buildPreloadRotationItems(
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

  // Direct URL keys in rotMap
  for (const [k, v] of Object.entries(rotMap)) {
    if ((k.startsWith('http') || k.startsWith('/') || k.startsWith('uploads/')) && Number(v)) {
      addRot(k, v);
    }
  }

  // Step 1: P-01 .. P-04 + P-03 extra + Vacant Land + Under Construction
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

  // Step 2: Deformation / Settlement / Tilt / Sagging / Abnormal
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

  // Step 3: As-Built Drawings (Section XII)
  const asBuiltList = json.asBuiltDrawingPhotos || json.asBuiltDrawingFiles || json.asBuiltDrawings || activeReport?.as_built_drawings || [];
  if (Array.isArray(asBuiltList)) {
    asBuiltList.forEach((item: any, idx: number) => {
      const u = typeof item === 'string' ? item : item?.url || item?.photoUrl;
      const code = item?.photoCode || `CAT-DWG-${String(idx + 1).padStart(2, '0')}`;
      addRot(u, item?.rotation ?? rotMap[`asBuiltDrawing_${idx}`] ?? rotMap[code] ?? rotMap[u]);
    });
  }

  // Step 4: Floors, CAD, Zones Z, Elements E, Defects D
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

  // Step 9: Working minutes & Absence notices
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

export class ReportV2Service {
  private static cachedTemplate: Handlebars.TemplateDelegate | null = null;
  private static cachedStyles: string | null = null;
  private static partialsRegistered = false;
  private static cachedTemplatesMtime = 0;

  /** mtime mới nhất của index.hbs, styles.css và các partial (dùng để làm mới cache khi dev) */
  private static latestTemplateMtime(): number {
    const dir = path.join(__dirname, 'templates/residential');
    let latest = 0;
    for (const sub of ['', 'partials']) {
      const d = path.join(dir, sub);
      if (!fs.existsSync(d)) continue;
      for (const f of fs.readdirSync(d)) {
        if (!/\.(hbs|css)$/.test(f)) continue;
        latest = Math.max(latest, fs.statSync(path.join(d, f)).mtimeMs);
      }
    }
    return latest;
  }

  /**
   * Đăng ký các helper và partials Handlebars cần thiết
   */
  public static registerHelpersAndPartials(baseDir?: string): void {
    Handlebars.registerHelper('eq', (a, b) => a === b);
    Handlebars.registerHelper('ne', (a, b) => a !== b);
    Handlebars.registerHelper('gt', (a, b) => Number(a) > Number(b));
    Handlebars.registerHelper('gte', (a, b) => Number(a) >= Number(b));
    Handlebars.registerHelper('lt', (a, b) => Number(a) < Number(b));
    Handlebars.registerHelper('lte', (a, b) => Number(a) <= Number(b));
    Handlebars.registerHelper('or', function(...args: any[]) {
      args.pop();
      return args.some(Boolean);
    });
    Handlebars.registerHelper('and', function(...args: any[]) {
      args.pop();
      return args.every(Boolean);
    });

    const partialsDir = baseDir || path.join(__dirname, 'templates/residential/partials');
    if (fs.existsSync(partialsDir)) {
      const partialFiles = fs.readdirSync(partialsDir).filter((f) => f.endsWith('.hbs'));
      for (const file of partialFiles) {
        const partialName = file.replace(/\.hbs$/, '');
        const content = fs.readFileSync(path.join(partialsDir, file), 'utf8');
        Handlebars.registerPartial(partialName, content);
      }
    }
    this.partialsRegistered = true;
  }

  /**
   * Khởi tạo hoặc lấy template Handlebars đã biên dịch
   */
  public static getCompiledTemplate(): {
    template: Handlebars.TemplateDelegate;
    styles: string;
  } {
    // ts-node-dev chỉ restart khi .ts đổi: ngoài production, nạp lại template nếu file .hbs/.css đã được sửa
    if (process.env.NODE_ENV !== 'production' && this.cachedTemplate) {
      const mtime = this.latestTemplateMtime();
      if (mtime > this.cachedTemplatesMtime) {
        this.cachedTemplate = null;
        this.cachedStyles = null;
      }
    }
    if (!this.cachedTemplate || !this.cachedStyles) {
      this.cachedTemplatesMtime = this.latestTemplateMtime();
      const templatePath = path.join(__dirname, 'templates/residential/index.hbs');
      const stylesPath = path.join(__dirname, 'templates/residential/styles.css');

      if (!fs.existsSync(templatePath)) {
        throw new Error(`Không tìm thấy file template Handlebars tại: ${templatePath}`);
      }
      if (!fs.existsSync(stylesPath)) {
        throw new Error(`Không tìm thấy file CSS Paged Media tại: ${stylesPath}`);
      }

      this.registerHelpersAndPartials();

      const templateSource = fs.readFileSync(templatePath, 'utf8');
      const baseStyles = fs.readFileSync(stylesPath, 'utf8');
      const fontStyles = ReportFontsService.getFontCss();
      this.cachedStyles = `${fontStyles}\n${baseStyles}`;

      this.cachedTemplate = Handlebars.compile(templateSource);
    }

    return {
      template: this.cachedTemplate,
      styles: this.cachedStyles,
    };
  }

  /**
   * Phân giải hồ sơ khảo sát theo ID, report_code hoặc mã thửa đất
   */
  public static async resolveReport(identifier: string): Promise<any> {
    if (!identifier || typeof identifier !== 'string') {
      throw new NotFoundError('Mã định danh hồ sơ không hợp lệ');
    }
    let rawReport = await SurveyRepository.findReportById(identifier);
    if (!rawReport) {
      const p = await SurveyRepository.findLatestPhase1ReportByParcelId(identifier);
      rawReport = p?.report || null;
    }
    if (!rawReport || !rawReport.id) {
      throw new NotFoundError(`Không tìm thấy hồ sơ khảo sát V2 với ID hoặc mã thửa: ${identifier}`);
    }
    return rawReport;
  }

  /**
   * Biên dịch mã HTML xem trước cho Báo cáo V2
   */
  public static async generateResidentialHtml(
    identifier: string,
    overrides?: any,
    maskPii: boolean = false,
    enableWatermark: boolean = true
  ): Promise<{ html: string; viewModel: ReportV2ViewModel }> {
    const rawReport = await this.resolveReport(identifier);
    return this.generateResidentialHtmlFromReport(rawReport, overrides, maskPii, enableWatermark);
  }

  /**
   * Dựng HTML từ bản ghi đã được resolve (V3 truyền bản ghi đã gắn điểm từ snapshot APPROVED_RELEASE)
   */
  public static async generateResidentialHtmlFromReport(
    rawReport: any,
    overrides?: any,
    maskPii: boolean = false,
    enableWatermark: boolean = true
  ): Promise<{ html: string; viewModel: ReportV2ViewModel }> {
    let activeReport = applyOverridesToReportV2(rawReport, overrides);
    if (maskPii) {
      activeReport = maskReportPii(activeReport);
    }

    const isCondoUnit = activeReport.report_type === 'CONDO_UNIT' || Boolean(activeReport.unit_id) || Boolean(activeReport.survey_data_json?.unitCode);
    if (isCondoUnit) {
      const { CondoUnitReportGenerator } = await import('../report/generators/condo-unit.generator');
      const viewModel = CondoUnitReportGenerator.buildViewModel(activeReport);
      if (maskPii) {
        (viewModel as any).isPiiMasked = true;
      }
      const html = CondoUnitReportGenerator.generateHtml(viewModel);
      return { html, viewModel: viewModel as any };
    }

    // 1. Phân tích trước tỷ lệ khung ảnh và nhúng Base64 100% ảnh khảo sát (bao gồm cả Cloud R2)
    const allPhotoUrls = extractAllImageUrls(activeReport);
    const photoRotationsMap = activeReport.survey_data_json?.photoRotations || activeReport.photoRotations || {};
    await preloadImageOrientations(allPhotoUrls);
    const preloadItems = buildPreloadRotationItems(activeReport, allPhotoUrls, photoRotationsMap);
    await ReportImageResolver.preloadAndResolveAll(preloadItems, photoRotationsMap);

    // 1.1. Tải trước ảnh vệ tinh Esri World Imagery cho sơ đồ không gian trang bìa
    try {
      const polygonCoords = extractParcelPolygonCoords(activeReport, activeReport.survey_data_json);
      if (polygonCoords) {
        await preloadSatelliteTiles(polygonCoords);
      }
    } catch (e) {
      // Graceful fallback nếu không tải được tile vệ tinh
    }

    // 2. Tải cấu hình nội dung chuẩn báo cáo (Q1, Q5)
    const config: ReportContentConfig =
      activeReport.reportContentConfig || (await ReportConfigService.getActiveConfig());

    // 3. Chuyển đổi và tính toán toàn bộ ViewModel
    const viewModel = ReportV2ViewModelMapper.buildViewModel(activeReport, overrides, config);
    if (maskPii) {
      (viewModel as any).isPiiMasked = true;
    }

    // 2. Dập watermark in-memory theo chuẩn commit 3ff0fab cho các ảnh chưa có dấu nếu enableWatermark = true
    const effectiveWatermark = maskPii ? true : enableWatermark;
    if (effectiveWatermark) {
      await ReportWatermarkCanvasService.applyWatermarksToViewModel(viewModel);
    }

    // 3. Biên dịch mã HTML
    const { template, styles } = this.getCompiledTemplate();
    const html = template({
      ...viewModel,
      styles,
      isPiiMasked: maskPii,
      isGuestWatermark: maskPii,
      enableWatermark: effectiveWatermark,
      isDraft: String(activeReport.status || '').toUpperCase() !== 'APPROVED',
    });

    return { html, viewModel };
  }

  /**
   * Xuất Báo cáo V2 ra PDF Buffer chuẩn A4
   */
  public static async generateResidentialPdf(
    identifier: string,
    overrides?: any,
    enableWatermark: boolean = true
  ): Promise<{
    pdfBuffer: Buffer;
    reportNo: string;
    buildingId: string;
    viewModel: ReportV2ViewModel;
  }> {
    const { html, viewModel } = await this.generateResidentialHtml(identifier, overrides, false, enableWatermark);

    const bId = (viewModel as any).metadata?.buildingId || (viewModel as any).buildingId || 'BCS';
    const rNo = (viewModel as any).metadata?.reportNo || (viewModel as any).reportCode || 'REPORT';

    const pdfBuffer = await PdfRenderV2Engine.renderHtmlToPdf(html, {
      buildingId: bId,
      reportNo: rNo,
      headerTitle: 'LIÊN DANH CRLG–CRSRI–TT | DỰ ÁN METRO 2 BẾN THÀNH - THAM LƯƠNG',
    });

    return {
      pdfBuffer,
      reportNo: rNo,
      buildingId: bId,
      viewModel,
    };
  }
}
