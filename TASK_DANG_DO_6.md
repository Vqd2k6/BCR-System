# Task dang dở 6: Export mẫu các Case Nhà dân (`residential_v2`) để đánh giá Output

Cập nhật: 16/11/2026. Nhánh `dev`. Trạng thái: **Đã chốt plan, chưa thực hiện** (nguồn plan: `implementation_plan.md` phiên họp 15/11/2026).

---

## Mục tiêu

Xuất **mỗi kịch bản nhà dân tiêu biểu thành 1 file PDF độc lập** qua đúng pipeline render thật (`ReportService.renderDraftPdf` với `chromeHeaderFooter` + `tocTwoPass` + watermark canvas), kèm báo cáo tổng hợp định lượng và hướng dẫn kiểm tra từng file (`summary.md`).

File dự kiến tạo mới: `backend/src/scripts/export_v2_sample_cases.ts`  
Thư mục đầu ra dự kiến: `backend/test_output/v2_samples/`

---

## Quyết định đã chốt

1. **Cách chọn hồ sơ đầu vào**: Script **tự động quét DB và gợi ý** danh sách ứng viên phù hợp cho từng case (hỗ trợ `--discover` để xem danh sách gợi ý trước khi xuất, đồng thời tự fallback sang ứng viên dự phòng nếu gặp lỗi watermark/QC).
2. **Định dạng đầu ra**: Chỉ xuất **file PDF + file tổng hợp `summary.md`** (không xuất ảnh PNG). Trong `summary.md` phải ghi rõ **tên từng file PDF đi kèm checklist cụ thể những điểm cần kiểm tra bằng mắt** cho file đó.

---

## Bộ Case Nhà dân tiêu biểu cần Export (Mỗi Case 1 PDF)

| Mã Case | Kịch bản đại diện | Tiêu chí chọn hồ sơ từ DB (`STANDALONE`) | Điểm cần đánh giá trên PDF |
| :--- | :--- | :--- | :--- |
| **`01_baseline_standard`** | Nhà dân điển hình (2–3 tầng, có cả tầng nứt & tầng sạch) | Ưu tiên `C&C-05-B-0001` (`c0f4e305-...`) hoặc nhà 2–3 tầng có khuyết tật nhẹ | Đối chiếu trực tiếp với mẫu `ST01`, kiểm tra header/footer, bìa, mục lục, PL1–PL3 |
| **`02_multi_storey`** | **Nhà nhiều tầng** (≥ 4–5 tầng, có hầm/lửng/sân thượng) | Hồ sơ có `floors.length >= 4` | Mục lục dài (`A2.x`, `A3.x`), ngắt trang từng tầng, lặp header/footer ổn định |
| **`03_photo_heavy`** | **Nhà nhiều hình** | Hồ sơ có nhiều ảnh PL1, nhiều khuyết tật + cận cảnh 3+, nhiều ảnh đối chứng PL3 (ví dụ `2e7c0d2f-...`) | Lưới 2 cột `.v2-photo-grid`, thẳng hàng caption ảnh đứng/ngang, dung lượng PDF & thời gian render |
| **`04_zero_defects`** | **Nhà không vết nứt** | Tổng khuyết tật = `0` trên toàn bộ các tầng | Mục VI–IX không bị trống/NaN (ECS Good, Low Risk), PL2 hiện *"Không ghi nhận khuyết tật"*, PL3 vẫn bung đủ ảnh Z/E |
| **`05_dual_cad`** | **Nhà có đủ CAD Kiến trúc (Z) + Kết cấu (E)** | Có ít nhất 1 tầng `hasStructuralCadMap === true` | Khối `.v2-cad.is-dual` xếp gọn, ghim `Z` (xanh) và `E` (đỏ) đúng tọa độ |
| **`06_zone_exempt_no_cad`** | **Nhà có tầng miễn Vùng Z hoặc tầng sạch chưa có CAD** | Tầng `hasZones === false` hoặc tầng `!hasCadMap` có ảnh tổng quan (ví dụ `3f945b15-...`) | Tầng không bị rơi mất khỏi báo cáo; ảnh đối chứng lên đầy đủ ở PL3 |
| **`07_high_risk_bra`** | **Nhà rủi ro Trung bình / Cao** (`Burland >= 3` hoặc `Overall >= Medium`) | Hồ sơ có điểm BRA / ECS mức Poor–Dangerous hoặc Medium–High Risk | Highlight `.is-current` trên bảng ECS, Ma trận rủi ro, bảng BRA không bị rớt dòng cuối sang trang mới |
| **`08_special_status`** *(tùy chọn)* | **Nhà vắng chủ / Đất trống / Đang thi công** | `isAbsenteeSurvey` / `isVacantLand` / `isUnderConstruction` | Nội dung thích ứng và nhóm ảnh `P-VL-*` / `P-UC-*` ở PL1 |

---

## Thiết kế triển khai (`backend/src/scripts/export_v2_sample_cases.ts`)

1. **Truy vấn & Phân loại ứng viên từ DB (`survey_reports`)**:
   - Chỉ lọc hồ sơ nhà dân riêng lẻ dùng được cho `residential_v2` (kiểm tra bằng `resolveReportTemplateKind(raw) === 'STANDALONE'`, loại `CONDO_UNIT` và `BUILDING_MASTER`).
   - Duyệt danh sách hồ sơ theo độ ưu tiên (`APPROVED` hoặc nháp mới cập nhật gần nhất), phân tích nhanh `survey_data_json` để gán ứng viên vào từng slot trong 8 case trên (mỗi case giữ tối đa 3–5 ứng viên dự phòng phòng trường hợp ứng viên đầu bị lỗi watermark ảnh nguồn).

2. **Render PDF qua Pipeline thật & Xử lý Gate**:
   - Gọi `ReportService.resolve(id)` → `ReportService.renderDraftPdf(resolved, undefined, true, undefined, 'residential_v2')` (`backend/src/modules/report/services/report.service.ts#L781`).
   - Nếu ứng viên gặp `WatermarkIncompleteError` hoặc lỗi chưa duyệt crop QC: ghi nhận vào log và **tự động chuyển sang ứng viên dự phòng tiếp theo** của case đó để đảm bảo cuối cùng mỗi case đều có file PDF sạch hợp lệ.
   - Tham số CLI hỗ trợ:
     - `--discover` (chỉ quét DB và in bảng gợi ý `reportId` / `buildingId` cho từng case, chưa render PDF)
     - `--cases=01,02,04` (chạy chọn lọc một vài case)
     - `--ids=<case>:<reportId>` (ép dùng `reportId` chỉ định cho 1 case)
     - `--out=<dir>` (mặc định `backend/test_output/v2_samples/`)

3. **Kiểm định tự động sau khi xuất từng PDF**:
   - Dùng lại các hàm có sẵn trong `backend/src/modules/report/engine/pdf-page-analysis.ts`:
     - `analyzePdfPages(pdfBuffer)` kiểm tra số trang & phát hiện tràn lề.
     - `readTocPageNumbers(pdfBuffer, headings)` đối chiếu 100% số trang in trong Mục lục khớp trang thật.
   - Ghi file tổng hợp `backend/test_output/v2_samples/summary.md` gồm:
     - Bảng chỉ số: `Case | Tên file PDF | Building ID | Report ID | Pages | Size (MB) | Render Time | TOC Match | Margin Check | Ảnh (PL1 / PL2 / PL3)`.
     - **Mục "Hướng dẫn kiểm tra từng file PDF"**: liệt kê rõ từng tên file PDF vừa xuất kèm danh sách các trang/mục và điểm cụ thể cần mở ra kiểm tra bằng mắt.

---

## Kiểm chứng khi thực hiện

```bash
cd backend
# Bước 1: Quét DB và xem gợi ý ứng viên
npx ts-node --transpile-only src/scripts/export_v2_sample_cases.ts --discover

# Bước 2: Chạy thử 1–2 case hoặc chạy toàn bộ
npx ts-node --transpile-only src/scripts/export_v2_sample_cases.ts --cases=01_baseline_standard,04_zero_defects
npx ts-node --transpile-only src/scripts/export_v2_sample_cases.ts
```

Kiểm tra thủ công:
- Mở `backend/test_output/v2_samples/summary.md` xác nhận `TOC Match = OK`, `Margin Check = OK`.
- Mở trực tiếp từng file PDF theo checklist trong `summary.md` để nghiệm thu trực quan trước khi chốt phát hành `residential_v2`.
