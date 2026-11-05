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
