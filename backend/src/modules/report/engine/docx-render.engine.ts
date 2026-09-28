// ─── Import types từ 'docx' (chỉ type-checking, không emit) ─────────────────
import type {
  Document as DocxDocument,
  Packer as DocxPacker,
  Paragraph as DocxParagraph,
  TextRun as DocxTextRun,
  Table as DocxTable,
  TableRow as DocxTableRow,
  TableCell as DocxTableCell,
  ImageRun as DocxImageRun,
} from 'docx';

// ─── Import docx qua CJS entry point (tương thích ts-node-dev / CommonJS) ───
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
const docxCjs = require('docx');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  ShadingType,
  PageBreak,
  Header,
  Footer,
  ImageRun,
} = docxCjs;

import * as fs from 'fs';
import * as path from 'path';
import {
  COLOR,
  bold,
  sectionHeading,
  para,
  headerCell,
  dataCell,
  labelValueTable,
} from './docx/docx.styles';
import {
  safeImage,
  imagePara,
} from './docx/docx.image-helper';
import { ResidentialReportViewModel } from '../report.types';

// ─────────────────────────────────────────────
// MAIN: buildDocx
// ─────────────────────────────────────────────
export class DocxRenderEngine {
  static async buildDocx(vm: ResidentialReportViewModel): Promise<Buffer> {
    const children: any[] = [];

    // ═══════════════════════════════════════════════
    // TRANG BÌA
    // ═══════════════════════════════════════════════
    children.push(
      new Paragraph({
        children: [bold('LIÊN DANH CRLG – CRSRI – TT', { color: COLOR.primary, size: 24 })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 480, after: 120 },
      }),
      new Paragraph({
        children: [new TextRun({ text: 'DỰ ÁN METRO 2: BẾN THÀNH – THAM LƯƠNG', size: 22, color: COLOR.gray })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 480 },
      }),
      new Paragraph({
        children: [bold('BÁO CÁO KHẢO SÁT HIỆN TRẠNG CÔNG TRÌNH', { color: COLOR.primary, size: 32 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
      }),
      new Paragraph({
        children: [bold('PHASE 1 – GIAI ĐOẠN ĐIỀU TRA HIỆN TRẠNG (BCS)', { size: 26, color: COLOR.accent })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 480 },
      }),
    );

    // Ảnh mặt tiền trang bìa
    const coverImgParas = await imagePara(vm.facadeCoverPhotoUrl, 'Ảnh mặt đứng công trình');
    children.push(...coverImgParas);

    // Thông tin nhận dạng trang bìa
    children.push(
      new Paragraph({ children: [], spacing: { after: 240 } }),
      labelValueTable([
        ['Building ID',            vm.buildingId      || '—'],
        ['Survey ID',              vm.surveyId        || '—'],
        ['Địa chỉ công trình',     vm.address         || '—'],
        ['Đoạn tuyến',             vm.zoneName        || '—'],
        ['Hạng mục Metro liên quan', vm.metroItemType || '—'],
        ['Ngày khảo sát',          vm.surveyDate      || '—'],
        ['Rev.',                   vm.revision        || '00'],
      ]),
      new Paragraph({ children: [new PageBreak()], spacing: { after: 0 } }),
    );

    // ═══════════════════════════════════════════════
    // PHẦN 1: NHẬN DẠNG & GPS
    // ═══════════════════════════════════════════════
    children.push(sectionHeading('PHẦN 1. NHẬN DẠNG – TỌA ĐỘ GPS & THÔNG TIN TUYẾN', 1));

    children.push(
      sectionHeading('1.1. Tọa độ GPS & Khoảng cách tĩnh không', 2),
      labelValueTable([
        ['Tọa độ GPS Lat',         vm.gpsLat?.toFixed(6)    || '—'],
        ['Tọa độ GPS Lng',         vm.gpsLng?.toFixed(6)    || '—'],
        ['Khoảng cách đến tim hầm', `${vm.distanceToTunnelMeters ?? '—'} m`],
        ['Lý trình (Chainage)',    vm.chainage              || '—'],
        ['Hạng mục Metro',         vm.metroItemType         || '—'],
      ]),
    );

    children.push(
      sectionHeading('1.2. Nhận định loại công trình', 2),
      para(`Loại đối tượng: ${vm.objectGroupLabel || vm.objectGroup || '—'}`),
      para(`Trường hợp khảo sát: ${vm.surveyCaseLabel || vm.surveyCaseType || '—'}`),
    );

    // Ảnh định danh P01–P04
    children.push(sectionHeading('1.3. Ảnh định danh ngoại thất chuẩn (P-01 đến P-04)', 2));
    const photoItems: { url?: string; label: string }[] = [
      { url: vm.p01?.url, label: 'P-01: Biển số nhà' },
      { url: vm.p02?.url, label: 'P-02: Mặt đứng chính' },
      { url: vm.p03?.url, label: 'P-03: Mặt bên / hậu' },
      { url: vm.p04?.url, label: 'P-04: Bối cảnh đường phố' },
    ];
    for (const photo of photoItems) {
      const pp = await imagePara(photo.url, photo.label);
      children.push(...pp);
    }

    children.push(new Paragraph({ children: [new PageBreak()], spacing: { after: 0 } }));

    // ═══════════════════════════════════════════════
    // PHẦN 2: ĐẶC ĐIỂM CÔNG TRÌNH
    // ═══════════════════════════════════════════════
    children.push(sectionHeading('PHẦN 2. ĐẶC ĐIỂM CÔNG TRÌNH & LỊCH SỬ SỬ DỤNG', 1));

    children.push(
      sectionHeading('2.1. Thông tin chung', 2),
      labelValueTable([
        ['Tên / Chủ sở hữu',   vm.ownerName           || '—'],
        ['Điện thoại',          vm.ownerPhone          || '—'],
        ['Địa chỉ',             vm.address             || '—'],
        ['Chức năng sử dụng',   vm.landUseFunction     || '—'],
        ['Năm xây dựng',        `${vm.yearOfConstruction || '—'}${vm.isYearEstimated ? ' (ước tính)' : ''}`],
        ['Số tầng',             `${vm.floorCount ?? '—'} tầng nổi + ${vm.basementCount ?? 0} tầng hầm`],
        ['Diện tích xây dựng',  `${vm.constructionAreaM2 || '—'} m²`],
        ['Chiều cao công trình', `${vm.buildingHeightM  || '—'} m`],
      ]),
    );

    children.push(
      sectionHeading('2.2. Hệ kết cấu & Vật liệu', 2),
      labelValueTable([
        ['Hệ kết cấu chịu lực', vm.structuralSystemLabel  || vm.structuralSystem || '—'],
        ['Loại móng',            vm.foundationCategoryLabel || vm.foundationCategory || '—'],
        ['Nguồn thông tin móng', vm.foundationInfoSource   || '—'],
        ['Chiều sâu móng',       `${vm.foundationDepthM   || '—'} m`],
        ['Kích thước cọc',       vm.pileDimensionMm        || '—'],
        ['Ghi chú móng',         vm.foundationNotes        || 'Không'],
      ]),
    );

    children.push(
      sectionHeading('2.3. Công trình liền kề', 2),
      para(vm.adjacentBuildingsNote || 'Không có ghi chú đặc biệt về công trình liền kề.'),
    );
    if (vm.adjacentBuildingsList && vm.adjacentBuildingsList.length > 0) {
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ children: [headerCell('Phía'), headerCell('Chi tiết'), headerCell('Ghi chú')] }),
            ...vm.adjacentBuildingsList.map((adj, i) =>
              new TableRow({
                children: [
                  dataCell(adj.sideLabel, !!(i % 2)),
                  dataCell(adj.details,   !!(i % 2)),
                  dataCell(adj.note || '—', !!(i % 2)),
                ],
              })
            ),
          ],
        }),
      );
    }

    children.push(
      sectionHeading('2.4. Biến động GIS / Phân lô', 2),
      labelValueTable([
        ['Trạng thái biến động', vm.gisMutation?.typeLabel || '—'],
        ['Loại biến động',       vm.gisMutation?.type      || '—'],
      ]),
    );

    // 2.5 Phỏng vấn lịch sử & yếu tố nhạy cảm
    children.push(sectionHeading('2.5. Phỏng vấn lịch sử sử dụng và các yếu tố nhạy cảm', 2));
    if (vm.historyInterviewItems && vm.historyInterviewItems.length > 0) {
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                headerCell('Chỉ tiêu',    2000),
                headerCell('Ghi nhận',    1400),
                headerCell('Ghi chú hiện trường', 4000),
              ],
            }),
            ...vm.historyInterviewItems.map((item, i) =>
              new TableRow({
                children: [
                  dataCell(item.indicator,           !!(i % 2)),
                  dataCell(item.hasItem ? 'CÓ' : 'KHÔNG', !!(i % 2), {
                    bold: true,
                    color: item.hasItem ? COLOR.deficient : COLOR.good,
                  }),
                  dataCell(item.notes || 'Không', !!(i % 2)),
                ],
              })
            ),
          ],
        }),
      );
    }

    children.push(new Paragraph({ children: [new PageBreak()], spacing: { after: 0 } }));

    // ═══════════════════════════════════════════════
    // PHẦN 3: KHẢO SÁT HIỆN TRẠNG CHI TIẾT
    // ═══════════════════════════════════════════════
    children.push(sectionHeading('PHẦN 3. KHẢO SÁT HIỆN TRẠNG CHI TIẾT TỪNG TẦNG', 1));

    // 4.3 Lún nghiêng (đưa lên trước chi tiết tầng)
    children.push(
      sectionHeading('3.1. Kết quả đo đạc lún – nghiêng – biến dạng kết cấu', 2),
      labelValueTable([
        ['Góc nghiêng X',        `${vm.tiltAngleX ?? '—'}°`],
        ['Góc nghiêng Y',        `${vm.tiltAngleY ?? '—'}°`],
        ['Hướng nghiêng chủ đạo', vm.tiltDirection || '—'],
        ['Phương pháp đo',        vm.measurementMethod || '—'],
        ['Độ tin cậy đo',         vm.measurementReliability || '—'],
        ['Ghi chú kỹ sư',         vm.deformationEngineerComments || 'Không'],
      ]),
    );

    // Chi tiết từng tầng
    if (vm.floors && vm.floors.length > 0) {
      for (const floor of vm.floors) {
        children.push(sectionHeading(`📍 ${floor.floorName.toUpperCase()}`, 2));

        // Ảnh tổng quan tầng
        if (floor.overviewPhotos && floor.overviewPhotos.length > 0) {
          children.push(para('Ảnh bối cảnh tổng quan tầng:', { bold: true }));
          for (const ph of floor.overviewPhotos) {
            const pp = await imagePara(ph.url, ph.caption || '');
            children.push(...pp);
          }
        }

        // Ghi chú tầng
        if (floor.notes) children.push(para(`Ghi chú tầng: ${floor.notes}`, { indent: true }));

        // Bảng khuyết tật trong tầng
        const allDefects = floor.zones?.flatMap(z => z.defects || []) || [];
        if (allDefects.length > 0) {
          children.push(
            para(`Tổng số khuyết tật ghi nhận: ${allDefects.length}`, { bold: true }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    headerCell('Mã KT',  1000),
                    headerCell('Vùng',   1000),
                    headerCell('Cấu kiện', 2000),
                    headerCell('Loại KT', 1500),
                    headerCell('W (mm)',  800),
                    headerCell('Trạng thái', 1400),
                    headerCell('Ý nghĩa KC', 1600),
                  ],
                }),
                ...allDefects.map((d, i) =>
                  new TableRow({
                    children: [
                      dataCell(d.defectCode,               !!(i % 2)),
                      dataCell(d.zoneCode,                 !!(i % 2)),
                      dataCell(d.componentType,            !!(i % 2)),
                      dataCell(d.defectType || '—',        !!(i % 2)),
                      dataCell(`${d.widthMaxMm ?? '—'}`,   !!(i % 2)),
                      dataCell(d.activityStateLabel || d.activityState, !!(i % 2), {
                        color: d.activityState === 'A' ? COLOR.critical : undefined,
                      }),
                      dataCell(d.structuralSignificanceLabel || String(d.structuralSignificanceE2), !!(i % 2)),
                    ],
                  })
                ),
              ],
            }),
          );

          // Ảnh khuyết tật
          for (const defect of allDefects) {
            if (defect.ctxPhotoUrl || defect.cuPhotoUrl) {
              children.push(
                para(`Khuyết tật ${defect.defectCode} – ${defect.componentType}:`, { bold: true, indent: true }),
              );
              if (defect.ctxPhotoUrl) {
                const pp = await imagePara(defect.ctxPhotoUrl, `${defect.defectCode} – Ảnh bối cảnh (CTX)`);
                children.push(...pp);
              }
              if (defect.cuPhotoUrl) {
                const pp = await imagePara(defect.cuPhotoUrl, `${defect.defectCode} – Ảnh cận cảnh (CU)`);
                children.push(...pp);
              }
            }
          }
        } else {
          children.push(para('Không ghi nhận khuyết tật đáng kể trong tầng này.', { indent: true }));
        }

        // Độ võng dầm cuối tầng
        if (floor.beamDeflectionMm !== undefined) {
          children.push(para(`Độ võng dầm/sàn lớn nhất: ${floor.beamDeflectionMm} mm`, { indent: true }));
        }
        if (floor.requiresAdditionalMonitoring) {
          children.push(para('⚠ Yêu cầu quan trắc bổ sung cho tầng này.', { indent: true, color: COLOR.deficient, bold: true }));
        }
      }
    }

    children.push(new Paragraph({ children: [new PageBreak()], spacing: { after: 0 } }));

    // ═══════════════════════════════════════════════
    // PHẦN 4: DANH SÁCH KIỂM TRA BCS
    // ═══════════════════════════════════════════════
    children.push(sectionHeading('PHẦN 4. DANH SÁCH KIỂM TRA BCS', 1));
    if (vm.bcsChecklist && vm.bcsChecklist.length > 0) {
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                headerCell('Nhóm',          1600),
                headerCell('Chỉ báo',       3200),
                headerCell('Có',            800),
                headerCell('Vị trí / Mức độ', 2800),
              ],
            }),
            ...vm.bcsChecklist.map((item, i) =>
              new TableRow({
                children: [
                  dataCell(item.category,            !!(i % 2)),
                  dataCell(item.indicator,            !!(i % 2)),
                  dataCell(item.hasIndicator ? '✔' : '—', !!(i % 2), {
                    bold: item.hasIndicator,
                    color: item.hasIndicator ? COLOR.deficient : COLOR.gray,
                  }),
                  dataCell(item.locationAndSeverity  || '—', !!(i % 2)),
                ],
              })
            ),
          ],
        }),
      );
    }

    children.push(new Paragraph({ children: [new PageBreak()], spacing: { after: 0 } }));

    // ═══════════════════════════════════════════════
    // PHẦN 5: PHẠM VI KHẢO SÁT & HẠN CHẾ TIẾP CẬN
    // ═══════════════════════════════════════════════
    children.push(sectionHeading('PHẦN 5. PHẠM VI KHÔNG GIAN KHẢO SÁT & HẠN CHẾ TIẾP CẬN', 1));

    children.push(sectionHeading('5.1. Phạm vi không gian đã khảo sát thực tế', 2));
    if (vm.surveyScopeItems && vm.surveyScopeItems.length > 0) {
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                headerCell('Khu vực / Tầng', 3600),
                headerCell('Đã tiếp cận',    1400),
                headerCell('Ghi chú',         3400),
              ],
            }),
            ...vm.surveyScopeItems.map((item, i) =>
              new TableRow({
                children: [
                  dataCell(item.areaName, !!(i % 2)),
                  dataCell(item.isAccessed ? 'Đã tiếp cận' : 'Chưa tiếp cận', !!(i % 2), {
                    bold: true,
                    color: item.isAccessed ? COLOR.good : COLOR.deficient,
                  }),
                  dataCell(item.notes || '—', !!(i % 2)),
                ],
              })
            ),
          ],
        }),
      );
    } else {
      children.push(para('Không có dữ liệu phạm vi khảo sát.'));
    }

    children.push(
      sectionHeading('5.2. Mức độ hạn chế tiếp cận (Access Limitations)', 2),
      labelValueTable([
        ['Phân loại tiếp cận',        vm.accessLimitationLabel    || '—'],
        ['Khu vực hạn chế tiếp cận',  vm.restrictedAreasDisplay   || 'Không'],
        ['Nguyên nhân hạn chế chính', vm.accessMainReasonDisplay   || 'Không'],
        ['Ghi chú tiếp cận',          vm.accessNotesDisplay        || 'Không'],
      ]),
    );

    children.push(new Paragraph({ children: [new PageBreak()], spacing: { after: 0 } }));

    // ═══════════════════════════════════════════════
    // PHẦN 6: ĐÁNH GIÁ RỦI RO (ECS & VI)
    // ═══════════════════════════════════════════════
    children.push(sectionHeading('PHẦN 6. ĐÁNH GIÁ RỦI RO CÔNG TRÌNH', 1));

    children.push(
      sectionHeading('6.1. Điểm số rủi ro kết cấu hiện hữu (ECS)', 2),
      labelValueTable([
        ['Tổng điểm ECS',  `${vm.totalEcsScore ?? '—'}`],
        ['Phân loại ECS',  vm.ecsClass           || '—'],
        ['E1 – Tuổi & Lịch sử',  `${vm.ecsE1 ?? '—'}`],
        ['E2 – Kết cấu chịu lực', `${vm.ecsE2 ?? '—'}`],
        ['E3 – Vật liệu',  `${vm.ecsE3 ?? '—'}`],
        ['E4 – Khuyết tật quan sát', `${vm.ecsE4 ?? '—'}`],
        ['E5 – Móng',      `${vm.ecsE5 ?? '—'}`],
        ['E6 – Biến dạng', `${vm.ecsE6 ?? '—'}`],
      ]),
    );

    children.push(
      sectionHeading('6.2. Chỉ số mức độ dễ bị tổn thương (VI)', 2),
      labelValueTable([
        ['Điểm VI tổng hợp',   `${vm.avgViScore ?? '—'}`],
        ['Phân loại VI',        vm.viClass           || '—'],
        ['V1 – Tuổi công trình', `${vm.viV1 ?? '—'}`],
        ['V2 – Hệ kết cấu',    `${vm.viV2 ?? '—'}`],
        ['V3 – Móng',           `${vm.viV3 ?? '—'}`],
        ['V4 – Biến dạng',      `${vm.viV4 ?? '—'}`],
        ['V5 – Khuyết tật',     `${vm.viV5 ?? '—'}`],
        ['V6 – Liền kề',        `${vm.viV6 ?? '—'}`],
      ]),
    );

    children.push(new Paragraph({ children: [new PageBreak()], spacing: { after: 0 } }));

    // ═══════════════════════════════════════════════
    // PHẦN 7: KẾT LUẬN & KIẾN NGHỊ
    // ═══════════════════════════════════════════════
    children.push(sectionHeading('PHẦN 7. KẾT LUẬN & KIẾN NGHỊ KỸ THUẬT', 1));

    children.push(
      sectionHeading('7.1. Ma trận đánh giá rủi ro tổng thể (BRA)', 2),
      labelValueTable([
        ['Cấp độ tác động thi công (I)', `${vm.constructionImpactLevelI ?? '—'}`],
        ['Điểm BRA',                     vm.buildingRiskAssessmentBra || '—'],
        ['Lún dự báo lớn nhất Smax',     `${vm.predictedSettlementSmax ?? '—'} mm`],
        ['Độ lệch góc dự báo',           vm.angularDistortion         || '—'],
        ['PPV dự báo',                   `${vm.vibrationPpv ?? '—'} mm/s`],
        ['Hành động bắt buộc theo BRA',  vm.braMandatoryAction        || '—'],
      ]),
    );

    children.push(
      sectionHeading('7.2. Tóm tắt kết luận khảo sát', 2),
      para(vm.summaryConclusions || 'Không'),
    );

    children.push(
      sectionHeading('7.3. Yêu cầu Phase 2 & Quan trắc', 2),
      labelValueTable([
        ['Yêu cầu khảo sát Phase 2', vm.requiresPhase2 ? 'Có' : 'Không'],
        ['Yêu cầu quan trắc bổ sung', vm.requiresMonitoring ? 'Có' : 'Không'],
      ]),
    );

    children.push(
      sectionHeading('7.4. Kiến nghị kỹ thuật cụ thể phục vụ thi công hầm Metro', 2),
      para(vm.engineeringRecommendations || 'Không'),
    );

    children.push(new Paragraph({ children: [new PageBreak()], spacing: { after: 0 } }));

    // ═══════════════════════════════════════════════
    // PHẦN 8: Ý KIẾN CHỦ SỞ HỮU & CHỮ KÝ
    // ═══════════════════════════════════════════════
    children.push(sectionHeading('PHẦN 8. Ý KIẾN CHỦ SỞ HỮU & XÁC NHẬN', 1));

    children.push(
      sectionHeading('8.1. Ý kiến phản hồi và nguyện vọng của Chủ sở hữu / Người sử dụng công trình', 2),
      para(vm.ownerRemarks || 'Không'),
    );

    children.push(
      sectionHeading('8.2. Xác nhận & Ký tên', 2),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              headerCell('Vai trò'),
              headerCell('Họ tên'),
              headerCell('Chức danh'),
              headerCell('Chữ ký'),
            ],
          }),
          new TableRow({
            children: [
              dataCell('Người lập báo cáo'),
              dataCell(vm.preparedByName  || '—'),
              dataCell(vm.preparedByTitle || '—'),
              dataCell(''),
            ],
          }),
          new TableRow({
            children: [
              dataCell('Người kiểm tra', true),
              dataCell(vm.checkedByName  || '—', true),
              dataCell(vm.checkedByTitle || '—', true),
              dataCell('', true),
            ],
          }),
          new TableRow({
            children: [
              dataCell('Người phê duyệt'),
              dataCell(vm.approvedByName  || '—'),
              dataCell(vm.approvedByTitle || '—'),
              dataCell(''),
            ],
          }),
        ],
      }),
    );

    // ═══════════════════════════════════════════════
    // PHỤ LỤC: Ảnh tổng quan (Z & E)
    // ═══════════════════════════════════════════════
    children.push(
      new Paragraph({ children: [new PageBreak()], spacing: { after: 0 } }),
      sectionHeading('PHỤ LỤC: ẢNH TỔNG QUAN VÀ BỐI CẢNH (VÙNG Z & E)', 1),
    );

    for (const floor of vm.floors || []) {
      const zePhotos: { url: string; caption: string }[] = [];
      for (const zone of floor.zones || []) {
        if (!zone.hasDamage && zone.ctxPhotoUrl) {
          zePhotos.push({ url: zone.ctxPhotoUrl, caption: `${floor.floorName} – ${zone.roomName} (${zone.zoneCode})` });
        }
        for (const ph of zone.overviewPhotos || []) {
          zePhotos.push({ url: ph, caption: `${floor.floorName} – ${zone.roomName} Tổng quan` });
        }
      }
      if (zePhotos.length > 0) {
        children.push(para(`📷 ${floor.floorName}`, { bold: true }));
        for (const ph of zePhotos) {
          const pp = await imagePara(ph.url, ph.caption);
          children.push(...pp);
        }
      }
    }

    // ═══════════════════════════════════════════════
    // BUILD DOCUMENT
    // ═══════════════════════════════════════════════
    const doc = new Document({
      title: `BCS Phase 1 – ${vm.buildingId}`,
      description: 'Báo cáo Khảo sát Hiện trạng Công trình – Liên danh CRLG-CRSRI-TT',
      styles: {
        default: {
          document: {
            run: { font: 'Times New Roman', size: 22 },
          },
          heading1: {
            run: { bold: true, size: 28, color: COLOR.primary, allCaps: true },
            paragraph: { spacing: { before: 360, after: 160 } },
          },
          heading2: {
            run: { bold: true, size: 24, color: COLOR.accent },
            paragraph: { spacing: { before: 240, after: 120 } },
          },
          heading3: {
            run: { bold: true, size: 22, color: COLOR.primary },
            paragraph: { spacing: { before: 160, after: 80 } },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              size: { width: 11906, height: 16838 }, // A4 in TWIPs (DXA)
              margin: { top: 1440, bottom: 1440, left: 1800, right: 1440 },
            },
          },
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'LIÊN DANH CRLG–CRSRI–TT | DỰ ÁN METRO 2 (BẾN THÀNH – THAM LƯƠNG)',
                      size: 16,
                      color: COLOR.gray,
                      bold: true,
                    }),
                    new TextRun({ text: '    |    ', size: 16, color: COLOR.border }),
                    new TextRun({ text: `Mã: ${vm.buildingId}  Số: ${vm.reportCode}`, size: 16, color: COLOR.gray }),
                  ],
                  border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: COLOR.border } },
                }),
              ],
            }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'BÁO CÁO KHẢO SÁT HIỆN TRẠNG CÔNG TRÌNH – PHASE 1 (BCS)    Trang ', size: 16, color: COLOR.gray }),
                    new TextRun({ children: ['PAGE'] as any, size: 16, color: COLOR.gray }),
                    new TextRun({ text: ' / ', size: 16, color: COLOR.gray }),
                    new TextRun({ children: ['NUMPAGES'] as any, size: 16, color: COLOR.gray }),
                  ],
                  border: { top: { style: BorderStyle.SINGLE, size: 2, color: COLOR.border } },
                }),
              ],
            }),
          },
          children: children as any,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    return Buffer.from(buffer);
  }
}
