# Task dang dở 3: Module xuất Report Chung cư (Tòa mẹ · Khu vực chung M · Căn hộ U)

Cập nhật: 13/11/2026. Nhánh `dev`.

## Trạng thái hiện tại

- **Tạm dừng** vì phần nhà dân sắp có thay đổi lớn. Khi quay lại: đọc file này, rồi đọc phần thay đổi nhà dân đã làm trong khoảng tạm dừng (mục "Lưu ý khi quay lại") trước khi code tiếp.
- Plan đã duyệt và đã vấn đáp 6 câu: `~/.claude/plans/hi-n-t-i-modun-xu-t-optimized-raven.md`. Plan là nguồn chi tiết từng trường; file này chỉ ghi tiến độ và quyết định.
- **Đã code xong:** GĐ0 (nền) và tab "Báo Cáo Chung Cư" (làm sớm phần UI của GĐ4).
- **Đã commit và push lên `dev`** ngày 14/11/2026: `634b2ed` (GĐ0) và `8c0a3a2` (tab).
- **Chưa làm:** GĐ1 (căn U), GĐ2 (khu vực M), GĐ3 (Tòa mẹ + xương cá), GĐ5 (ZIP).

---

## 1. Quyết định đã chốt

| # | Quyết định |
|---|---|
| Q1 | Cây xương cá trong PDF Tòa mẹ lấy dữ liệu sống lúc xuất nháp hoặc phát hành Rev. Không đòi M/U APPROVED, vì nhà thầu cần tiến độ sơ bộ; khi chốt thì phát hành Rev mới. Mỗi Rev đóng băng cây của riêng nó (SHA-256). PDF ghi "Số liệu tổng hợp đến hh:mm dd/mm/yyyy". Rev Tòa mẹ vẫn cần Tòa mẹ APPROVED. |
| Q2 | Số hiệu con = số hiệu Tòa mẹ nối hậu tố mã căn. Đã code: `R-{seq}-{seg}-({loc})-{UNITCODE}-R{rev}`; số lưu trữ `Số: {seq}-{UNIT}/BCS-P1/CRLG-2026`. |
| Q3 | Report M/U đánh số chương lại liền mạch. Chương I có 1 dòng tham chiếu Hồ sơ Tòa mẹ. |
| Q4 | M không tiếp cận được có nhánh B giống căn vắng (có `survey_absence_logs` hoặc Admin đặt LOCKED). PARTIAL vẫn in đủ. |
| Q5 | Report con không in ECS/BRA của Tòa mẹ. Giá trị pháp lý của M/U là bộ Z/E/D đối chứng. |
| Q6 | Đợt này xuất từng file. ZIP cả tòa làm ở giai đoạn sau. |
| Q7 | Nơi đặt: **một tab riêng "Báo Cáo Chung Cư"** trong module Xuất Phase 1, là chỗ duy nhất xem/xuất mọi report Tòa mẹ, M, U. Tab chỉ hiện với Zone Admin và Super Admin. |

---

## 2. Việc đã làm

### GĐ0 — Nền (backend)
- `report/services/report-template-kind.ts` (mới): `resolveReportTemplateKind(raw)` trả `STANDALONE | BUILDING_MASTER | MASTER_AREA | CONDO_UNIT`. Có `unit_id` thì phân loại bằng `classifyCondoEntityKind`; không có `unit_id` mà `building_type` là `CONDOMINIUM`/`CONDO` thì là `BUILDING_MASTER`.
- `report/services/report.service.ts`:
  - Cache template theo kind (`templateCache: Map`).
  - Thư mục theo kind: `residential`, `condo-master`, `condo-area`, `condo-unit`.
  - Nếu thư mục của kind chưa có `index.hbs` thì dùng `residential`. Vì vậy hiện tại mọi hồ sơ chung cư vẫn render bằng template nhà dân.
  - Kind chung cư dùng `Handlebars.create()` riêng: đăng ký partial nhà dân trước, partial của kind sau (được ghi đè cùng tên); `styles.css` dùng chung.
- `cadastral-info.mapper.ts`: `formatReportNo` / `formatFilingNo` nhận thêm `childUnitCode`; thêm `normalizeChildUnitCode`.
- `metadata-and-cover.mapper.ts`: hồ sơ con (có `unit_id`) dùng mã căn. Nếu thiếu mã căn thì log `[MetadataMapper:reportNo]`.
- `survey-base.repository.ts` `findReportById`:
  - Chỉ fallback tên/SĐT chủ về `p.owner_name` khi `r.unit_id IS NULL`.
  - Select thêm `bu.unit_type` và `bu.display_code AS unit_display_code`.
- `snapshot-builder.ts`: đóng băng `frozenUnitIdentity` (`unit_code`, `unit_type`, `unit_display_code`, `unit_floor_number`) và `report_type` vào `frozenReportData`. Nằm ngoài phần băm nên không đổi SHA-256 của Rev cũ.
- `snapshot-applier.ts`: hồ sơ con không bị chủ thửa đóng băng (liên hệ BQL) ghi đè lên chủ căn.

Đã kiểm chứng GĐ0:
- HTML của 4 hồ sơ nhà dân/Tòa mẹ giống hệt bản trước (byte-identical).
- U-105 ra `R-00129-C&C-(ST05)-U-105-R01`; M-025 ra `...-M-025-R01`.
- M-025 không còn in liên hệ BQL làm chủ hộ, mà in "--". Nhãn "Chủ Hộ" vẫn còn; sẽ bỏ ở GĐ2.

### Tab "Báo Cáo Chung Cư" (phần UI của GĐ4, làm sớm)
- `frontend/.../phase1-export/components/CondoReportsTab.tsx` (mới):
  - Trái: danh sách tòa từ `GET /admin/condo/towers?zoneId`.
  - Phải: thẻ Tòa mẹ, rồi từng tầng (cao xuống thấp; mỗi tầng M trước, U sau). Lấy từ `GET /admin/condo/:parcelId/progress-summary` (`floorMatrix`).
  - Lọc theo tầng, theo loại (M/U), tìm theo mã hoặc chủ hộ.
  - Nút Xem/PDF dùng lại `handleOpenPreview` và `handleExportSinglePdf` của nhà dân.
- `Phase1ExportModuleBox.tsx`:
  - Thêm tab `CONDO`.
  - Với Zone Admin/Super Admin, bảng "Báo Cáo Kỹ Thuật" ẩn các dòng chung cư và hiện dải báo kèm nút chuyển sang tab mới.
  - Vai trò khác giữ nguyên như cũ.
- Backend `condo-queue.service.ts`:
  - Lọc `deleted_at IS NULL` cho report tòa, report căn và report Tòa mẹ.
  - Mỗi ô có thêm `reportStatus`.
  - Thay đổi này ảnh hưởng cả hàng đợi thẩm định chung cư (theo hướng đúng hơn).
- Kiểu dữ liệu: `reportStatus` được thêm vào `condo-audit.types.ts` (cả BE và FE).

Đã kiểm chứng:
- FE `npm run build` qua; 4 chốt `check:zero-any`, `check:ui`, `check:catch`, `check:theme` đều sạch; BE `tsc` qua.
- Smoke test service trên DB local: 2 tòa; tòa C&C-01-B-0289 có 12 ô, 11 ô có report.
- **Chưa** mở tab trên trình duyệt để kiểm tra bằng mắt.

---

## 3. File thay đổi của task này (đã commit)

```
backend/src/modules/report/services/report-template-kind.ts          (mới)
backend/src/modules/report/services/report.service.ts
backend/src/modules/report/mappers/cadastral-info.mapper.ts
backend/src/modules/report/mappers/sections/metadata-and-cover.mapper.ts
backend/src/modules/report/snapshot/snapshot-builder.ts
backend/src/modules/report/snapshot/snapshot-applier.ts
backend/src/modules/survey/repositories/survey-base.repository.ts
backend/src/modules/audit/condo/condo-audit.types.ts
backend/src/modules/audit/condo/services/condo-queue.service.ts
frontend/src/features/zone-management/components/Phase1ExportModuleBox.tsx
frontend/src/features/zone-management/components/phase1-export/components/CondoReportsTab.tsx   (mới)
frontend/src/features/zone-management/components/review-queue/condo/types/condo-audit.types.ts
```

**KHÔNG thuộc task này, không động vào:** `TASK_DANG_DO.md` (đang sửa dở của người dùng), thư mục `Xuất 11.11/`, các script `backend/scripts/export-1111-*.ts`.

Đã commit: `634b2ed` feat(report) GĐ0, `8c0a3a2` feat(export) tab.

---

## 4. Vấn đề mở

1. **Tòa mẹ trùng report:** tòa C&C-01-B-0289 có 2 report `BUILDING_MASTER` chưa xóa:
   - `f03f4dcd` SUBMITTED, tạo 10/10 02:25.
   - `6a80431d` DRAFT, tạo 10/10 02:27. Đây cũng là `parcels.active_phase1_report_id`.

   Tab hiện chọn bản mới nhất theo `created_at`, nên đang khớp bản active. Chưa quyết: có nên ưu tiên rõ ràng `active_phase1_report_id` và/hoặc hiện cảnh báo "tòa có nhiều report Tòa mẹ" hay không. Cần hỏi người dùng; dữ liệu đó có thể cần Admin xử lý bằng xóa mềm.
2. `test_report_station_code_and_logo` có 1 ca fail ("Ảnh upload 29/09/2026 → đã có watermark"). Ca này fail giống hệt trước khi đổi code, không do task này gây ra.
3. Nhận diện chung cư ở `Phase1ParcelsTable.tsx` (so với `CONDO_MASTER`/`CONDO_UNIT` thay vì `CONDOMINIUM`/`CONDO`), mục 5 của plan, chưa sửa. Với Admin thì tab mới đã che vấn đề này; vai trò khác vẫn bị.

---

## 5. Bước tiếp theo (theo plan)

1. Kiểm tra tab trên UI, chốt vấn đề mở 1.
2. **GĐ1 — Căn U** (`templates/condo-unit/` + `report/mappers/condo/condo-unit-report.mapper.ts`):
   - Nhánh đủ: 9 trường I; II lịch sử + bảng biến dạng; III sơ đồ căn; IV khuyết tật (áp `projectCondoZonesToFloors` để sửa lỗi U không in vùng); V Burland; VI kết luận; VII xác nhận; PL1–PL3.
   - Nhánh B (vắng): chuyển logic từ `condo-absent-projection.ts`, `condo-unit-absent.mapper.ts`, `page-04-absent-unit-notice.hbs`. Xác định vắng chỉ qua `condo-absence.resolver.ts`.
   - Định danh đọc qua `resolveIdentityValue` (lớp phủ Admin), không fallback `parcels.owner_name`.
3. **GĐ2 — Khu vực M** (`templates/condo-area/`): 7 trường I, định vị trên mặt bằng tầng, nhánh B; bỏ nhãn "Chủ Hộ".
4. **GĐ3 — Tòa mẹ** (`templates/condo-master/`): I/II/bìa, xương cá VI (tổng hợp) + VII (từng tầng), PL1 mặt bằng tầng, chụp cây khi phát hành Rev. Tách logic `floorMatrix` ở `condo-queue.service.ts` thành hàm dùng chung, không viết hai bản.
5. Bổ sung vào `progress-summary` cho mỗi ô: `childReportNo`, `latestReleaseRev`, `isAbsentee`; hiển thị trong tab.
6. **GĐ5 (sau):** ZIP cả tòa / theo tầng, dùng lại job ZIP của biên bản.

Kiểm thử mỗi GĐ: xem mục 7 của plan (mở rộng `test_report_pagination.ts` theo kind; hồi quy nhà dân phải byte-identical; M/U không có chữ ECS/BRA; mask PII với GUEST).

---

## 6. Lưu ý khi quay lại (do thay đổi lớn ở nhà dân)

- Template chung cư **dùng lại partial nhà dân** (`templates/residential/partials`) và các mapper section (`Section6`, `Section7BurlandMapper`, `Section9`, appendix 1–4). Sau đợt sửa nhà dân phải rà lại:
  - Tên partial, khóa ViewModel và thứ tự Mục có đổi không. Plan giả định bố cục Mục I–XII, Mục lục 2 lượt, header/footer hộp lề.
  - `buildViewModel` và pipeline ảnh/watermark (`assertWatermarkComplete`, Photo QC, resurvey) có đổi chữ ký không; mapper chung cư phải đưa mọi URL ảnh qua cùng collector ở lượt chạy khô.
  - `metadata-and-cover.mapper.ts`, `cadastral-info.mapper.ts`, `report.service.ts`, `snapshot-*` có bị sửa cùng chỗ với GĐ0 không. Nếu GĐ0 chưa commit trước đợt sửa nhà dân, sẽ dễ xung đột ở các file này.
- GĐ0 + tab đã lên `dev` (634b2ed, 8c0a3a2) trước đợt sửa nhà dân; nếu đợt đó sửa trùng file, xem diff từ 8c0a3a2.
- Sau khi nhà dân đổi xong, chạy lại phép so HTML nhà dân trước/sau, để chắc phần cache template theo kind không làm lệch bản mới.
- Memory liên quan: `condo-report-export-decisions`, `condo-absent-legacy-data`, `report-pdf-pagination-decisions`.
