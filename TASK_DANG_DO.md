# Task dang dở: bảo toàn ảnh, rollback, thẩm định chung cư

Cập nhật: 02/11/2026. Nhánh `dev`.

## Trạng thái hiện tại

- Đã push `dev` (`c42afb0`) và merge sang `main`: `ccdb5a5` (backend), `b4fb9a1` (frontend), `014e067` (test), `c42afb0` (sửa lỗi tìm được khi soát trước main).
- Đã push `dev` (`b9c7311`) và merge sang `main` (`ec25b2d`): Miễn Z, lớp phủ định danh căn vắng, gán ảnh có sẵn. Có migration `20261102_add_has_zones_to_floor_surveys.sql`. Backup trước khi merge: `cloud_snapshot_20261102_102627.json`. Chưa xác nhận trên production.
- 8 mục kiểm tra trên app và rollback tầng `U-003`: người dùng đã xác nhận đạt.
- DB thật và cloud chưa bị ghi gì từ các việc dưới đây.
- Chưa commit, cố ý để lại: 2 file `.jpeg` ở thư mục gốc, `source_templete/`, `CLAUDE.md`, `.agents/skills/convert-idea/`. Cần tự quyết giữ hay bỏ.

## Việc tiếp theo, theo thứ tự

### 1. Đưa lên production

- [x] Đối chiếu test đỏ với code sạch `af9a197`: xem mục "Test đỏ đã biết".
- [x] Push `dev`.
- [x] Backup cloud: `backend/backups/cloud_snapshots/cloud_snapshot_20261102_020747.json`.
- [x] Merge `dev` sang `main`.
- [ ] Xác nhận bản mới đã chạy trên production. Phải xong bước này trước khi gắn ảnh trên cloud. Không có migration mới; cột cần dùng đã đối chiếu với snapshot 01/11.
- [ ] Gắn lại ảnh `blob` trên cloud (xem mục 2).
- [ ] Xóa token R2 chỉ đọc trong Cloudflare và trong `backend/.env` nếu không dùng nữa.

### 2. Gắn lại 34 ảnh `blob` (cần đồng ý rõ trước khi ghi)

16 hồ sơ (7 đã nộp, 9 bản nháp). Script đã chạy thử trên DB test: 33 ảnh gắn được, chạy lại không đổi gì.

Ảnh `C&C-05-B-0164 / Z-01` thứ 3 có 2 object giống hệt nhau (cùng SHA-256), dùng bản `27a8bd`:

```bash
cd backend
# Xem trước, không ghi
npx ts-node src/scripts/repair_orphan_blob_photos.ts \
  --choose "photo_1791083305213_drkml=surveys/C_C-05-B-0164/CTX/HCM_M2__C_C-05-B-0164__F00_Z-01_CTX_03_1791083305221_27a8bd.jpg"
# Ghi thật: trỏ kết nối DB tới cloud, thêm --apply --confirm-real-db
```

Script từ chối ghi ngoài `metro2_audit_test` nếu thiếu `--confirm-real-db`. Local đồng bộ từ cloud nên chỉ sửa local sẽ bị ghi đè.

### 3. Hoàn tất bảo toàn ảnh

Mức cao:

- [ ] Đối chiếu 53 hồ sơ có v0 là `ADMIN_DIFF_SAVE` với `cloud_snapshot_20261016_053945.json`. Chưa xác minh v0 chụp trước hay sau khi sửa.
- [ ] Nhánh Admin sửa tại chỗ (`survey.controller.ts`, `allowLockedReport`) chưa tự tạo version trước khi ghi đè.
- [ ] Test rollback theo từng loại ảnh: P-01 đến P-04, CAD, overview, CTX, CU, biên bản, hoàn công, vắng chủ, `SAG`, lún nghiêng.
- [ ] Đo độ lệch tọa độ ranh thửa sau rollback. Rollback ghi lại `cadastral_polygon_geom`, `location_geom` với sai khác ở các chữ số cuối, chưa biết bao nhiêu mét.

Mức vừa:

- [ ] Chặn xóa ảnh CU cuối có thông báo rõ: `D-xx phải còn ít nhất 1 ảnh cận cảnh`. Hiện bị chặn do lỗi `NOT NULL` ở `audit-modification.service.ts`, Admin gặp lỗi DB thô.
- [ ] Sửa TC13, TC14 để kiểm tra đúng việc bị chặn. Viết lại TC19 tự tạo hồ sơ, vì P-01 của hồ sơ `43d992fa` đang `ACTIVE`, test đã cũ.
- [ ] Ghi registry khi đổi ảnh tổng quan qua form.
- [ ] Bổ sung registry cho 1.104 CTX và 421 CU cũ. Ghi DB nên cần duyệt riêng.

Mức thấp:

- [ ] `floor_surveys`, `survey_identification_photos` vẫn xóa hàng rồi ghi lại vì chưa có cột xóa mềm. Muốn bỏ cần migration; URL cũ đã được giữ trong registry.

### 4. PDF chung cư (để sau)

Hiện chỉ có template `residential` và `minutes`, chưa có mẫu cho Căn hộ, Khu vực chung, Tháp. Cần biết mẫu theo chuẩn nào hoặc có file mẫu của Liên danh. Phần đọc CTX và thứ tự Z đã ở tầng dữ liệu nên mẫu mới dùng lại được.

## Cần người dùng quyết định

- [ ] 66 vùng CTX đọc ra rỗng: Admin gán lại ở vùng có D ghim trên ảnh cũ. Chưa đếm số vùng như vậy.
- [ ] Mô tả cải tạo của 15 căn có đưa vào PDF không. Hiện không mapper nào đọc.
- [ ] Lệch E6 và tổng ECS giữa SQL và frontend.
- [ ] Backfill 12 hồ sơ và 2 hồ sơ `NORMAL` có cờ vắng.
- [ ] `report-consistency-gate.ts` kiểm PARTIAL/REFUSED nhưng không kiểm LIMITED.
- [ ] Master Studio chưa hiển thị khu vực tự nhập ở mục tiếp cận.

## Bối cảnh cần nhớ

- **Ảnh Z-04 `ac71`:** cột `damage_zones.ctx_photo_url` nhiễm 342 vùng do `UPDATE` thiếu `report_id` ngày 17/10. JSON đúng. Người dùng quyết định không ghi DB, sửa ở tầng đọc bằng `overlayZoneCtxFromJson`. Đường đọc mới từ `damage_zones` để hiển thị phải đi qua hàm này.
- **Ảnh là căn cứ pháp lý:** mọi ảnh phải được bảo toàn và rollback được. Xóa ở thẩm định là xóa mềm; không có code xóa file trên R2.
- **Bản version `ADMIN_DIFF_SAVE`:** chụp sau khi sửa. Muốn về trước khi sửa thì chọn bản trước đó.
- **Test đỏ đã biết (đều đỏ trên code sạch `af9a197`):** `test-audit-to-report` 3 ca (TC-S3 `lengthM` hiện "1850 m", TC-S8 BRA ra trung bình thay vì cao, TC-PHOTO-ORIENTATION); `var_flaws` 6 ca (TC33, 34, 40, 69, 77, 97; code sạch đỏ 7); `test_deleted_photo...` 3 ca (TC13, 14, 19). TC-S3 và TC-S8 liên quan nội dung PDF, nên xem trước khi làm PDF chung cư.

## Lệnh kiểm tra

Test ghi dữ liệu chỉ chạy với `DB_NAME=metro2_audit_test`.

```bash
cd backend
DB_NAME=metro2_audit_test npx ts-node src/scripts/test_condo_rollback_field_matrix.ts
DB_NAME=metro2_audit_test npx ts-node src/scripts/test_rollback_field_matrix.ts
DB_NAME=metro2_audit_test npx ts-node src/scripts/test_condo_audit_integration.ts
DB_NAME=metro2_audit_test npx ts-node src/scripts/test_survey_resave_preservation.ts
DB_NAME=metro2_audit_test npx ts-node src/scripts/test_zone_ctx_overlay.ts
npx ts-node src/scripts/audit_orphan_blob_photos.ts   # Chỉ đọc, cần token R2
```

# Kế hoạch: PDF tải về bị ngắt đoạn, trống nhiều (preview thì mượt)

## Goal Description

Trong ảnh bạn gửi, PDF có Mục III, IV, V mỗi mục chiếm **một trang riêng nhưng chỉ đầy ~40–45%**, phần còn lại trống. Preview HTML thì liền mạch. Mục tiêu: PDF chảy liên tục như preview, không còn khoảng trống do ngắt trang cưỡng bức.

## Nguyên nhân gốc (đã đối chiếu code)

Preview và PDF dùng **hai chế độ CSS khác nhau** của cùng một template ([styles.css](file:///Users/vqd2k6/.gemini/antigravity/worktrees/KSat_QHoach/fix_report_watermark_ocr/backend/src/modules/report/templates/residential/styles.css)):

|                      | Preview (`@media screen`)                                 | PDF (`@media print`, Puppeteer)                                              |
| -------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `.a4-page-sheet`     | Khối cao tự do, `min-height: 297mm`, có bóng, **tự giãn** | `break-after: page !important` → **mỗi sheet bắt đầu trang mới**             |
| `.page-break` (L165) | Không có tác dụng trên màn hình                           | `break-before: page` → **ép sang trang mới**                                 |
| `tr`, `.avoid-break` | Vô nghĩa                                                  | `break-inside: avoid` → đẩy nguyên khối xuống trang sau, để lại khoảng trống |

Ba chỗ ép ngắt trang khớp đúng ảnh của bạn:

1. [page-04-sections-3-4.hbs:52](file:///Users/vqd2k6/.gemini/antigravity/worktrees/KSat_QHoach/fix_report_watermark_ocr/backend/src/modules/report/templates/residential/partials/page-04-sections-3-4.hbs#L52): `<h2 class="chapter-header page-break">` Mục **IV** → III và IV tách trang.
2. Hết sheet III+IV → `break-after: page` → Mục **V** (sheet mới, [page-05](file:///Users/vqd2k6/.gemini/antigravity/worktrees/KSat_QHoach/fix_report_watermark_ocr/backend/src/modules/report/templates/residential/partials/page-05-sections-5-6-summary.hbs)) sang trang mới.
3. [page-05-sections-5-6-summary.hbs:83](file:///Users/vqd2k6/.gemini/antigravity/worktrees/KSat_QHoach/fix_report_watermark_ocr/backend/src/modules/report/templates/residential/partials/page-05-sections-5-6-summary.hbs#L83): `page-break` Mục **VI**.

Toàn báo cáo có ~27 `a4-page-sheet`, mỗi cái ép một trang mới nên mọi mục ngắn đều để trống cuối trang. Preview không bị vì trên màn hình sheet chỉ là khung giấy giả, không ngắt thật.

> [!NOTE]
> Dòng "DRAFT – KHÔNG CÓ GIÁ TRỊ PHÁP LÝ" trong ảnh là bản xuất trước khi tôi gỡ banner (commit `e959edc`), không liên quan lỗi này.

## Open Questions

> [!IMPORTANT]
> Bạn muốn mức gom trang nào? Tôi đề xuất **Phương án A**.
>
> - **A (đề xuất, ít rủi ro):** chỉ bỏ ép ngắt ở các mục ngắn I–VI (bỏ `page-break` ở IV, VI và cho III→IV→V→VI chảy liên tục). Các phần lớn (bìa, chữ ký, phụ lục ảnh, CAD, biên bản) giữ nguyên mỗi phần một trang mới.
> - **B (gom mạnh):** cho toàn bộ thân báo cáo (Mục I → IX) chảy liên tục, chỉ ngắt trước phụ lục.
> - **C:** giữ mỗi Mục một trang nhưng giảm khoảng trống bằng cách thu nhỏ lề/cỡ chữ (không khuyến nghị, đổi định dạng pháp lý).
>
> Ngoài ra: có bắt buộc Mục I, II, VII, VIII, IX phải bắt đầu trang mới (theo mẫu 0410 của chủ đầu tư) không?

## Proposed Changes (theo Phương án A)

### Template

#### [MODIFY] page-04-sections-3-4.hbs

Bỏ class `page-break` ở `<h2 ... sec-4>` (giữ `chapter-header`; CSS đã có `break-after: avoid` để tiêu đề không mồ côi).

#### [MODIFY] page-05-sections-5-6-summary.hbs

Bỏ `page-break` ở `<h2 ... sec-6>`.

#### [MODIFY] styles.css (`@media print`)

Thêm lớp mới để các sheet liền kề nhau không bị cắt trang:

```css
@media print {
  /* Sheet chảy liền: không ép trang mới sau nó */
  .a4-page-sheet.flow-continue {
    break-after: auto !important;
    page-break-after: auto !important;
    break-inside: auto !important;
  }
  .a4-page-sheet.flow-continue + .a4-page-sheet {
    padding-top: 0 !important;
  }
}
```

và gắn `flow-continue` cho sheet III–IV (page-04) để nối với sheet V–VI (page-05). Sửa `page-break-inside: avoid !important` của `.a4-page-sheet` thành `auto` cho các sheet này (hiện chỉ "avoid" nên khi sheet dài hơn trang dễ nhảy trang sớm).

#### Giảm khoảng trống phụ

Kiểm tra `.avoid-break` trên khối lớn (`break-inside: avoid` ở L427, L770, L1170–1178): chỉ giữ cho khối nhỏ (ảnh+chú thích), bỏ cho khối bảng dài.

## Verification Plan

### Automated

- Render PDF một hồ sơ mẫu bằng script có sẵn và đếm trang/độ trống bằng `pdfjs-dist` (đã là dependency): so số trang và % vùng trắng cuối mỗi trang trước/sau.
- `cd backend && npx tsc --noEmit`; chạy lại `test_report_v3_business_cases.ts` để chắc template không vỡ.

### Manual

- Xuất lại căn trong ảnh (Mục III–V): kỳ vọng III+IV chung một trang, V+VI nối tiếp, không còn nửa trang trống.
- Kiểm tra mục lục (số trang `tocPageNumbers`) vẫn khớp sau khi gom trang; nếu lệch tôi sẽ chỉnh bộ tính số trang.

> [!WARNING]
> Gom trang làm **số trang mục lục thay đổi** so với các bản đã phát hành trước. Rev đã lưu trên R2 không bị đổi, chỉ PDF tạo mới.
