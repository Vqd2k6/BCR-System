import { ExportParcelItem } from '../types';

export const getMockDemoParcels = (zone: string): ExportParcelItem[] => [
  {
    id: 'p-s9-015',
    projectParcelCode: 'S9-P015',
    officialCadastralCode: '315-08-TPB',
    houseNumber: '142',
    street: 'Lý Thường Kiệt',
    ownerName: 'Nguyễn Văn Hoàng',
    surveyStatus: 'APPROVED',
    buildingType: 'STANDALONE',
    floorCount: 3,
    activePhase1ReportId: 'rep-s9-015',
    ecsClass: 'MEDIUM',
    viClass: 'MEDIUM',
    braClass: 'MEDIUM_RISK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p-s9-018',
    projectParcelCode: 'S9-P018',
    officialCadastralCode: '315-12-TPB',
    houseNumber: '146/2',
    street: 'Lý Thường Kiệt',
    ownerName: 'Trần Thị Thu Hà',
    surveyStatus: 'COMPLETED',
    buildingType: 'STANDALONE',
    floorCount: 2,
    activePhase1ReportId: 'rep-s9-018',
    ecsClass: 'GOOD',
    viClass: 'LOW',
    braClass: 'LOW_RISK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p-s9-022',
    projectParcelCode: 'S9-P022',
    officialCadastralCode: '315-19-TPB',
    houseNumber: '150',
    street: 'Lý Thường Kiệt (Chung Cư Bảy Hiền)',
    ownerName: 'BQT Chung Cư Bảy Hiền',
    surveyStatus: 'APPROVED',
    buildingType: 'CONDO_MASTER',
    floorCount: 12,
    activePhase1ReportId: 'rep-s9-022',
    ecsClass: 'DEFICIENT',
    viClass: 'HIGH',
    braClass: 'HIGH_RISK',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'p-s9-025',
    projectParcelCode: 'S9-P025',
    officialCadastralCode: '315-24-TPB',
    houseNumber: '154',
    street: 'Lý Thường Kiệt',
    ownerName: 'Lê Văn Tùng',
    surveyStatus: 'SUBMITTED',
    buildingType: 'STANDALONE',
    floorCount: 4,
    activePhase1ReportId: 'rep-s9-025',
    ecsClass: 'GOOD',
    viClass: 'MEDIUM',
    braClass: 'LOW_RISK',
    updatedAt: new Date().toISOString(),
  },
];

export const generateMockHtmlPreview = (p: ExportParcelItem) => `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <title>BÁO CÁO KHẢO SÁT HIỆN TRẠNG PHASE 1 - ${p.projectParcelCode}</title>
    <style>
      body { font-family: 'Times New Roman', serif; margin: 30px; color: #1e293b; background: #fff; }
      .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 15px; }
      .header h3 { margin: 0; font-size: 14pt; font-weight: bold; }
      .header h2 { margin: 5px 0; font-size: 16pt; color: #0284c7; font-weight: bold; }
      .info-table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11pt; }
      .info-table td, .info-table th { border: 1px solid #cbd5e1; padding: 8px; }
      .info-table th { background: #f1f5f9; text-align: left; }
      .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 10pt; }
      .badge-good { background: #dcfce7; color: #166534; }
      .badge-medium { background: #fef3c7; color: #92400e; }
      .signature-box { margin-top: 40px; display: flex; justify-content: space-between; text-align: center; }
    </style>
  </head>
  <body>
    <div class="header">
      <h3>DỰ ÁN XÂY DỰNG TUYẾN TÀU ĐIỆN NGẦM SỐ 2 TP.HCM (BẾN THÀNH - THAM LƯƠNG)</h3>
      <h2>BÁO CÁO KHẢO SÁT HIỆN TRẠNG CÔNG TRÌNH (PHASE 1 BCS REPORT)</h2>
      <div>Mã hồ sơ: <strong>REPORT-${p.projectParcelCode}-PHASE1</strong> | Ngày lập: ${new Date().toLocaleDateString('vi-VN')}</div>
    </div>

    <table class="info-table">
      <tr>
        <th>Mã thửa đất dự án:</th>
        <td><strong>${p.projectParcelCode}</strong> (Số tờ/thửa: ${p.officialCadastralCode || '315-08'})</td>
      </tr>
      <tr>
        <th>Địa chỉ công trình:</th>
        <td>Số ${p.houseNumber} Dường ${p.street}, Q. Tân Bình, TP.HCM</td>
      </tr>
      <tr>
        <th>Chủ sở hữu / Người quản lý:</th>
        <td><strong>${p.ownerName}</strong></td>
      </tr>
      <tr>
        <th>Hệ kết cấu chịu lực:</th>
        <td>Khung bê tông cốt thép (BTCT) chịu lực + Tường gạch xây bao chèn</td>
      </tr>
      <tr>
        <th>Số tầng / Chiều cao:</th>
        <td>${p.floorCount} tầng | Diện tích XD: 120.5 m²</td>
      </tr>
      <tr>
        <th>Tình trạng ECS / Rủi ro Metro:</th>
        <td>
          <span class="badge badge-${p.ecsClass === 'GOOD' ? 'good' : 'medium'}">Đánh giá ECS: ${p.ecsClass || 'GOOD'}</span>
          <span class="badge badge-good">Dễ tổn thương VI: ${p.viClass || 'LOW'}</span>
        </td>
      </tr>
    </table>

    <h4 style="margin-top: 25px; font-size: 12pt; text-transform: uppercase;">1. Sổ Khuyết Tật Hiện Trạng (Defect Register)</h4>
    <table class="info-table">
      <thead>
        <tr>
          <th>Mã vết nứt</th>
          <th>Vị trí (Tầng / Vùng)</th>
          <th>Mô tả khuyết tật</th>
          <th>Bề rộng (mm)</th>
          <th>Đánh giá nguy hại</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>D-01</td>
          <td>Tầng 1 (Z-01 Phòng khách)</td>
          <td>Vết nứt chân chim tường gạch góc cửa đi</td>
          <td>0.3 mm</td>
          <td>Nhiều (Không kết cấu)</td>
        </tr>
        <tr>
          <td>D-02</td>
          <td>Tầng 2 (Z-02 Ban công)</td>
          <td>Vết nứt ngang mép dầm bê tông sàn</td>
          <td>0.5 mm</td>
          <td>Theo dõi Phase 2</td>
        </tr>
      </tbody>
    </table>

    <div class="signature-box">
      <div>
        <div><strong>CHỦ SỞ HỮU CÔNG TRÌNH</strong></div>
        <div style="height: 60px; margin-top: 10px; color: #64748b;">(Đã ký xác nhận hiện trường)</div>
        <div><strong>${p.ownerName}</strong></div>
      </div>
      <div>
        <div><strong>CÁN BỘ KHẢO SÁT LIÊN DANH CRLG</strong></div>
        <div style="height: 60px; margin-top: 10px; color: #0284c7;">✍️ Nguyễn Văn Khảo Sát</div>
        <div><strong>KTV. Nguyễn Văn Khảo Sát</strong></div>
      </div>
    </div>
  </body>
  </html>
`;

export const generateMockReportData = (p: ExportParcelItem, token?: string | null) => ({
  reportId: p.activePhase1ReportId || p.id,
  projectParcelCode: p.projectParcelCode,
  officialCadastralCode: p.officialCadastralCode || '315-08',
  ownerName: p.ownerName,
  address: `${p.houseNumber} ${p.street}`,
  buildingSpecs: {
    buildingName: `Nhà dân cư ${p.houseNumber} ${p.street}`,
    structuralSystem: 'KHUNG_BTCT_CHIU_LUC',
    foundationCategory: 'CAT_4_MONG_COC_BTCT',
    floorCount: p.floorCount,
    yearOfConstruction: 2018,
  },
  riskScores: {
    totalEcsScore: 4,
    ecsClass: p.ecsClass || 'GOOD',
    avgViScore: 3,
    viClass: p.viClass || 'LOW',
    braClass: p.braClass || 'LOW_RISK',
  },
  defectsCount: 2,
  jwtBearerVerified: !!token,
  generatedAt: new Date().toISOString(),
});
