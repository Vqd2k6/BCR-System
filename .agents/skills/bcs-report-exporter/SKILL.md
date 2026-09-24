---
name: bcs-report-exporter
description: >-
  Quy chuẩn và hướng dẫn kỹ thuật xuất Báo cáo khảo sát hiện trạng công trình (Phase 1 BCS Report)
  theo chuẩn Liên danh CRLG-CRSRI-TT cho công trình nhà dân cư, toà nhà mẹ và căn hộ con.
  Cung cấp data mapping matrix, cấu trúc template DOCX/PDF và giải pháp lập trình backend.
---

# BỘ HƯỚNG DẪN KỸ THUẬT & DATA MAPPING XUẤT BÁO CÁO HIỆN TRẠNG (BCS REPORT EXPORT)

Tài liệu này là cẩm nang hướng dẫn lập trình viên (Developer) triển khai Engine xuất báo cáo khảo sát hiện trạng Phase 1 dưới định dạng `.docx` và `.pdf`, tuân thủ 100% mẫu chuẩn của **Liên danh CRLG–CRSRI–TT** tại `srs/export_report/Mau_Bao_cao_Khao_sat_Hien_trang_Phase1_CRLG-CRSRI-TT.docx.md`.

---

## 1. DATA MAPPING MATRIX: TỪ SYSTEM DATA SANG BÁO CÁO CRLG–CRSRI–TT

| Mục Báo Cáo | Tiêu đề bảng | Nguồn dữ liệu hệ thống (`Phase1SurveyFormData` / `BuildingUnit`) | Xử lý đặc thù cho Căn hộ con (Condo Unit) |
| :--- | :--- | :--- | :--- |
| **Bìa & Kiểm soát** | Building ID & Survey ID | `formData.projectParcelCode`, `formData.id` | Mã căn hộ: `[BuildingID]-[unitCode]` (VD: `B-05272-P402`) |
| **Bìa & Kiểm soát** | Địa chỉ & Đoạn tuyến | `formData.houseNumber`, `formData.street`, `formData.chainage` | Thêm: *Căn hộ [unitCode], Tầng [floorNumber], Tòa [buildingName]* |
| **Phần 1.2** | Vị trí công trình | Tọa độ GPS `formData.gpsCoords`, cự ly `formData.metroOffsetDistance` | Kế thừa từ Tòa nhà mẹ (Vị trí khối tháp so với tim hầm) |
| **Phần 3.1** | Nhận dạng công trình | `ownerName`, `usageFunction`, `aboveFloors`, `constructionYear` | Họ tên chủ căn hộ; Tầng căn hộ tọa lạc (hoặc Duplex 2 tầng) |
| **Phần 3.2** | Kết cấu & Móng | `structureSystem`, `foundationType`, `foundationCatScore` | Ghi chú: *Kế thừa từ hồ sơ móng cọc/tầng hầm Tòa nhà mẹ* |
| **Phần 3.3** | Lịch sử & Nhạy cảm | `formData.historyInterview` | Bóc tách: *Cải tạo đập tường trong căn* và *Thấm dột từ tầng trên* |
| **Phần 4.2** | Hồ sơ 4 ảnh định danh | `formData.photoP01` đến `formData.photoP04` | P01 (Cửa/Biển căn); P04 (Phòng khách); P02 & P03 (Ghi N/A) |
| **Phần 5** | BCS Checklist hiện trạng | `formData.settlementTilt`, `formData.floors[].defects` | Thống kê số lượng vết nứt quan sát được trong phạm vi căn hộ |
| **Phần 6.1** | Sổ khuyết tật Defect Register | Danh sách mảng `formData.floors[].zones[].defects[]` | Sinh bảng bảng mã `D-01, D-02...`, vị trí phòng, bề rộng $w$, ảnh |
| **Phần 6.2** | Sơ đồ hư hỏng Damage Map | Ảnh xuất từ `FloorCadPinningCanvas` (Base64 PNG) | Chèn ảnh mặt bằng căn hộ có ghim các điểm $Z$, $E$, $D$ |
| **Phần 7** | Lún – Nghiêng – Biến dạng | `buildingTilt` và `beamSagging` | Nghiêng: Kế thừa Tòa mẹ; Võng: Đo võng trần/sàn căn hộ |
| **Phần 8** | Đánh giá Burland | `burlandSummary.predominantGrade`, `localMaxGrade` | Đánh giá hư hại nứt vách ngăn/tường bao nội bộ căn hộ |
| **Phần 9** | Điểm hiện trạng ECS | `formData.ecs` ($E_1$ đến $E_6$, tổng $\Sigma E$, phân hạng ECS) | Tự động tính toán từ các hư hại thực tế trong căn hộ |
| **Phần 10** | Chỉ số tổn thương VI | `formData.vi` ($V_1$ đến $V_6$, tổng $\Sigma V$, phân hạng VI) | Kế thừa hệ số kết cấu tòa mẹ kết hợp cao độ tầng căn hộ |
| **Phần 11** | Tác động Metro (Impact $I$) | `formData.constructionImpactStatus` ($I_1$ đến $I_4$) | Kế thừa cự ly tim hầm Metro của Tòa nhà mẹ |
| **Phần 12** | Ma trận rủi ro BRA | `formData.braStatus` ($V \times I \implies$ Low/Medium/High/Very High) | Đánh giá rủi ro cơ sở phục vụ kế hoạch bảo hiểm/đền bù |
| **Phần 13** | Kết luận & Kiến nghị | `formData.executiveSummary.specificRecommendationsText` | Kiến nghị quan trắc biến dạng nội thất khi TBM đào qua |
| **Phụ lục D** | Hồ sơ ảnh có thước đo | Mảng ảnh chi tiết các vết nứt (`photoUrl` có crack gauge) | Chèn ảnh cận cảnh từng vết nứt kèm thước đo mm và GPS |
| **Phụ lục F** | Biên bản hiện trường | `formData.signatures` (Chữ ký KSV, Chủ hộ, Cán bộ giám sát) | Chèn ảnh biên bản làm việc hiện trường bằng giấy đã ký |

---

## 2. KIẾN TRÚC ENGINE XUẤT BÁO CÁO (BACKEND IMPLEMENTATION PLAN)

### 2.1. Thư viện khuyến nghị:
- **Tạo file DOCX**: Dùng thư viện `docx` (npm: `docx`) hoặc `docxtemplater` kết hợp với template Word mẫu (`.docx`) có sẵn placeholder (`{projectParcelCode}`, `{ownerName}`, v.v.).
- **Chuyển đổi DOCX $\rightarrow$ PDF**:
  - Cách 1: Sử dụng **LibreOffice headless** trong Docker container (`libreoffice --headless --convert-to pdf`).
  - Cách 2: Render trực tiếp qua HTML template bằng **Puppeteer / Chromium Headless** để có độ chính xác pixel tuyệt đối, hỗ trợ header/footer lặp trang.

### 2.2. Skeleton Code: Service xuất Báo cáo Căn hộ con (`ReportExportService.ts`):
```typescript
import { Document, Packer, Paragraph, Table, TextRun, ImageRun } from 'docx';
import { Phase1SurveyFormData } from '../types/phase1.types';

export class ReportExportService {
  /**
   * Tạo tài liệu DOCX cho Báo cáo Khảo sát Căn hộ con
   */
  static async generateCondoUnitReportDocx(data: Phase1SurveyFormData): Promise<Buffer> {
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            // Trang Bìa
            new Paragraph({
              children: [
                new TextRun({ text: 'LIÊN DANH CRLG–CRSRI–TT', bold: true, size: 24 }),
                new TextRun({ text: '\nDỰ ÁN TUYẾN ĐƯỜNG SẮT ĐÔ THỊ SỐ 2 TP.HCM', bold: true, size: 28 }),
                new TextRun({ text: '\nBÁO CÁO KHẢO SÁT HIỆN TRẠNG CĂN HỘ CON – PHASE 1', bold: true, size: 32, color: '003366' }),
                new TextRun({ text: `\nCĂN HỘ: ${data.unitCode || 'N/A'} - TẦNG ${data.unitFloorNumber || 1}`, bold: true, size: 26 }),
                new TextRun({ text: `\nTHUỘC TÒA NHÀ: ${data.parentBuildingInfo?.buildingName || 'CHUNG CƯ'}`, size: 22 }),
              ],
            }),
            // Bảng thông tin nhận dạng
            this.createIdentificationTable(data),
            // Sổ khuyết tật Defect Register
            this.createDefectRegisterTable(data),
            // Đánh giá ECS, VI, BRA
            this.createRiskAssessmentTable(data),
          ],
        },
      ],
    });

    return await Packer.toBuffer(doc);
  }

  private static createIdentificationTable(data: Phase1SurveyFormData): Table {
    // Render bảng nhận dạng căn hộ con & kế thừa toà mẹ
    // ...
    return new Table({ rows: [] });
  }

  private static createDefectRegisterTable(data: Phase1SurveyFormData): Table {
    // Render bảng danh sách vết nứt D-01, D-02...
    // ...
    return new Table({ rows: [] });
  }

  private static createRiskAssessmentTable(data: Phase1SurveyFormData): Table {
    // Render bảng tổng hợp ECS, VI, BRA
    // ...
    return new Table({ rows: [] });
  }
}
```

---

## 3. CHECKLIST KIỂM ĐỊNH PHÁP LÝ BÁO CÁO TRƯỚC KHI XUẤT:
1. [ ] **Mã định danh đầy đủ**: Có đủ Building ID, Unit Code, Tầng lầu, Ngày giờ khảo sát.
2. [ ] **Toàn vẹn số liệu**: Điểm ECS (0-24), điểm VI (6-24), ma trận BRA ($V \times I$) phải khớp 100% với số liệu đã duyệt trên hệ thống web.
3. [ ] **Độ phân giải ảnh**: Ảnh khuyết tật phải nhìn rõ vạch chia trên thước đo nứt (Crack gauge $\ge 0.1\text{mm}$).
4. [ ] **Chữ ký số & Đóng dấu**: Phụ lục F phải có đầy đủ chữ ký hoặc ảnh chụp biên bản hiện trường có xác nhận của chủ căn hộ.
