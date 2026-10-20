# SỔ TAY HƯỚNG DẪN DI CHUYỂN & CẬP NHẬT CSDL PRODUCTION AN TOÀN
## TÍNH NĂNG: CHỤP NHIỀU ẢNH CẬN CẢNH (MULTI-PHOTO) CHO KHUYẾT TẬT D-XX
**Hệ thống:** Khảo Sát Hiện Trạng Công Trình Tuyến Metro Số 2 (BCS Platform)  
**Tài liệu:** Vận hành & Triển khai CSDL Production ngoài giờ làm việc  
**Mục tiêu:** An toàn tuyệt đối 100% &bull; Không mất/hỏng dữ liệu &bull; Zero Downtime  

---

## 📅 1. QUY ƯỚC THỜI GIAN & NGUYÊN TẮC VẬN HÀNH

- **Khung giờ thực hiện khuyến nghị:** **Từ 22:00 đến 05:00 sáng hôm sau** (hoặc vào ngày nghỉ cuối tuần).
- **Lý do không cập nhật trong giờ hành chính:** 
  - Khảo sát viên hiện trường đang trực tiếp điểm danh GPS, chụp ảnh vết nứt và nộp hồ sơ.
  - Cập nhật giữa giờ làm việc dễ gây nghẽn phiên làm việc, xóa bộ nhớ cache PWA khi chưa kịp đồng bộ (sync) ảnh lên Cloudflare R2.
- **Thời lượng thao tác ước tính:** **Dưới 15 phút** (thời gian chạy lệnh CSDL chỉ mất < 0.5 giây).
- **Downtime ước tính:** **0 phút (Zero-Downtime)**. Lệnh `ADD COLUMN ... DEFAULT` trên PostgreSQL 11+ là cập nhật metadata catalog, không lock bảng và không ghi đè dữ liệu.

---

## 📋 2. DANH MỤC KIỂM TRA TRƯỚC GIỜ G (PRE-FLIGHT CHECKLIST)

Trước khi bắt đầu, người phụ trách kỹ thuật (DevOps / Lead Engineer) cần kiểm tra:
- [ ] Thông báo nội bộ trên nhóm Zalo/Telegram: *"Hệ thống bảo trì cập nhật định kỳ từ 22:00 - 22:15, các KSV vui lòng bấm Đồng bộ (Sync) dữ liệu trước giờ này"*.
- [ ] Đã có quyền truy cập vào Cloud Server / VPS / Docker / Cloud Database (Supabase / Render / Neon / AWS RDS).
- [ ] Đã cài đặt sẵn công cụ dòng lệnh `psql` hoặc có quyền mở SQL Editor trên Cloud Console.
- [ ] Đĩa cứng máy chủ còn trống tối thiểu **2 GB** để chứa bản backup CSDL.

---

## 🛡️ BƯỚC 1: SAO LƯU TOÀN BỘ CSDL PRODUCTION (FULL BACKUP)

> [!IMPORTANT]
> **BẮT BUỘC THỰC HIỆN TRƯỚC TIÊN.** Không bao giờ chạy bất kỳ lệnh migration nào trên Production nếu chưa tạo bản sao lưu có timestamp.

### Cách 1: Sử dụng lệnh `pg_dump` qua Terminal (Khuyến nghị)

Mở terminal máy chủ hoặc máy kỹ thuật có kết nối tới Cloud DB, chạy lệnh:

```bash
# Thiết lập biến thông tin kết nối Production
export PROD_DB_HOST="<IP_HOẶC_DOMAIN_CLOUD_DB>"
export PROD_DB_PORT="5432"
export PROD_DB_NAME="metro2_gis_db"
export PROD_DB_USER="metro2_user"

# Tạo thư mục chứa backup nếu chưa có
mkdir -p ~/backups_metro2

# Chạy sao lưu toàn vẹn (Full Custom Format, nén cao cấp)
pg_dump -h $PROD_DB_HOST -p $PROD_DB_PORT -U $PROD_DB_USER -d $PROD_DB_NAME \
  -F c -b -v -f ~/backups_metro2/prod_backup_pre_multiphoto_$(date +%Y%m%d_%H%M%S).dump
```

*Nếu Production chạy trên Docker container (ví dụ `metro2_postgres_postgis`):*
```bash
docker exec metro2_postgres_postgis pg_dump -U metro2_user -d metro2_gis_db -F c -b -v \
  > ~/backups_metro2/prod_docker_backup_$(date +%Y%m%d_%H%M%S).dump
```

### Kiểm tra xác nhận file sao lưu hợp lệ:
```bash
ls -lh ~/backups_metro2/
# Đảm bảo file .dump có dung lượng > 0 MB (thông thường từ vài MB đến vài trăm MB tùy lượng hồ sơ).
```

---

## 🗄️ BƯỚC 2: CHẠY SQL MIGRATION BỔ SUNG CỘT CSDL

Tệp SQL chuẩn mực đã được lưu sẵn tại:  
[`backend/database/migrations/20261001_multi_photo_defect_d.sql`](file:///Users/vqd2k6/Desktop/MIT-techology/KSat_QHoach/backend/database/migrations/20261001_multi_photo_defect_d.sql)

### Nội dung lệnh SQL được thực thi:
```sql
BEGIN;

-- 1. Bổ sung cột lưu trữ mảng JSONB các ảnh cận cảnh (Purely Additive)
ALTER TABLE defect_items
    ADD COLUMN IF NOT EXISTS cu_photos_json JSONB DEFAULT '[]'::jsonb;

-- 2. Đảm bảo cột mã ảnh đã được đánh chỉ mục
CREATE INDEX IF NOT EXISTS idx_defect_items_cu_photo_code 
    ON defect_items(cu_photo_code);

-- 3. Đính kèm chú thích trường dữ liệu
COMMENT ON COLUMN defect_items.cu_photos_json IS 'Mảng JSON lưu trữ danh sách tất cả các ảnh cận cảnh CU có thước đo nứt của điểm khuyết tật D-xx';

COMMIT;
```

### Cách thực thi:
- **Lựa chọn A (Qua Terminal):**
  ```bash
  psql -h $PROD_DB_HOST -p $PROD_DB_PORT -U $PROD_DB_USER -d $PROD_DB_NAME \
    -f backend/database/migrations/20261001_multi_photo_defect_d.sql
  ```
- **Lựa chọn B (Qua Docker exec):**
  ```bash
  docker exec -i metro2_postgres_postgis psql -U metro2_user -d metro2_gis_db \
    < backend/database/migrations/20261001_multi_photo_defect_d.sql
  ```
- **Lựa chọn C (Qua Cloud Dashboard SQL Console - Supabase/Neon/Render):**
  Copy toàn bộ đoạn mã SQL trên, paste vào khung chạy SQL Query và bấm **Run**.

### Kiểm tra xác nhận cột đã tạo thành công:
Chạy câu query sau:
```sql
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'defect_items' 
  AND column_name IN ('cu_photo_url', 'cu_photos_json');
```
*Kết quả đạt yêu cầu:* Thấy xuất hiện cả 2 dòng:
- `cu_photo_url | text | null | YES`
- `cu_photos_json | jsonb | '[]'::jsonb | YES`

---

## 🚀 BƯỚC 3: DEPLOY BACKEND SERVICE

1. **Kéo mã nguồn mới nhất:**
   ```bash
   cd /path/to/backend
   git pull origin main  # hoặc nhánh deploy tương ứng
   ```

2. **Cài đặt & Build:**
   ```bash
   npm install --production=false
   npm run build
   ```
   *Yêu cầu:* Lệnh build hoàn tất với `exit code 0`.

3. **Khởi động lại tiến trình Backend:**
   - *Nếu dùng PM2:*
     ```bash
     pm2 reload metro2-backend --update-env
     # hoặc
     pm2 restart metro2-backend
     ```
   - *Nếu dùng Docker Compose:*
     ```bash
     docker compose up -d --build backend
     ```
   - *Nếu dùng Systemd:*
     ```bash
     sudo systemctl restart metro2-backend
     ```

4. **Kiểm tra Health Check:**
   ```bash
   curl -s http://localhost:4000/health
   # Phải trả về: {"status":"UP","service":"Metro 2 Survey & BCA Platform API",...}
   ```

---

## 🌐 BƯỚC 4: DEPLOY FRONTEND PWA

1. **Build Frontend Bundle:**
   ```bash
   cd /path/to/frontend
   git pull origin main
   npm install
   npm run build
   ```
   *Kết quả:* Tạo thư mục `dist/` đầy đủ tài nguyên HTML/JS/CSS.

2. **Đồng bộ lên Web Server / Nginx / Cloud Storage:**
   - *Nếu dùng Nginx tự host:*
     ```bash
     sudo cp -r dist/* /var/www/metro2-frontend/
     sudo nginx -s reload
     ```
   - *Nếu dùng Cloudflare Pages / Vercel:* Hệ thống CI/CD sẽ tự động build và deploy ngay khi push git.

3. **Cập nhật Service Worker:**
   - Phiên bản PWA mới sẽ tự động cập nhật ngầm cho các thiết bị Surveyor khi họ kết nối mạng vào sáng hôm sau.

---

## ✅ BƯỚC 5: BỘ 3 CÂU LỆNH HẬU KIỂM TOÀN DIỆN (POST-FLIGHT SMOKE TEST)

Sau khi deploy xong, hãy chạy các phép thử sau để đảm bảo hệ thống đạt độ tin cậy tuyệt đối:

### 1. Kiểm tra không có bất kỳ hồ sơ khảo sát nào bị mất dữ liệu
```sql
SELECT 
    status, 
    count(*) AS total_reports 
FROM base_survey_reports 
GROUP BY status;
```
*(Số lượng hồ sơ ở mỗi trạng thái `DRAFT`, `SUBMITTED`, `APPROVED` phải bằng đúng số lượng trước khi nâng cấp).*

### 2. Kiểm tra các điểm khuyết tật cũ vẫn giữ nguyên ảnh
```sql
SELECT 
    id, 
    report_code, 
    jsonb_path_query_array(survey_data_json, '$.floors[*].zones[*].defects[*].cuPhotoUrl') AS cu_photos
FROM base_survey_reports
WHERE survey_data_json IS NOT NULL
LIMIT 5;
```
*(Kết quả: Mọi điểm D cũ vẫn giữ nguyên đường dẫn ảnh `/uploads/...` ban đầu).*

### 3. Kiểm tra trực tiếp trên trình duyệt Web (Giao diện KSV)
- Đăng nhập tài khoản Surveyor.
- Mở một hồ sơ nháp hiện có, vào **Bước 3 (Ghi sổ khuyết tật CAD)**.
- Bấm vào một điểm vết nứt $D-01$ đã có:
  - **Xác nhận 1:** Ảnh cũ lập tức xuất hiện ở vị trí **`Ảnh 1 (Chính)`** trong lưới ảnh thumbnail.
  - **Xác nhận 2:** Bấm biểu tượng kính lúp 🔍 &rarr; Màn hình phóng to ảnh nét, dùng 2 ngón tay hoặc chuột cuộn zoom mượt mà, đọc rõ vạch thước đo nứt.
  - **Xác nhận 3:** Thử chụp thêm 1 ảnh vị trí khác &rarr; Ảnh thứ 2 xuất hiện dạng `Ảnh #2` kèm Photo Code `..._CU_02`.
  - **Xác nhận 4:** Bấm **Lưu nháp**, F5 tải lại trang &rarr; Cả 2 ảnh vẫn nguyên vẹn 100%.

---

## 🚨 BƯỚC 6: QUY TRÌNH HOÀN TRẢ KHẨN CẤP (EMERGENCY ROLLBACK)

Trong trường hợp hy hữu xảy ra lỗi ngoài ý muốn, thực hiện theo đúng thứ tự 3 bước sau để đưa hệ thống về trạng thái ban đầu:

### 1. Rollback Frontend & Backend
```bash
git checkout <COMMIT_HASH_TRƯỚC_KHI_DEPLOY>
# Build và restart lại service backend/frontend
```

### 2. Rollback CSDL (Chỉ mất 5 giây)
Vì thay đổi chỉ là thêm cột `cu_photos_json` và không hề sửa đổi cột cũ, nếu muốn xóa bỏ cột này để khôi phục cấu trúc schema cũ:
```sql
BEGIN;
ALTER TABLE defect_items DROP COLUMN IF EXISTS cu_photos_json;
COMMIT;
```

### 3. Phục hồi từ bản Full Dump (Chỉ dùng khi CSDL bị lỗi vật lý nghiêm trọng):
```bash
pg_restore -h $PROD_DB_HOST -p $PROD_DB_PORT -U $PROD_DB_USER -d $PROD_DB_NAME \
  --clean --if-exists ~/backups_metro2/prod_backup_pre_multiphoto_*.dump
```

---

## 📞 7. LIÊN HỆ HỖ TRỢ KỸ THUẬT

- **Tài liệu tham chiếu kiến trúc:** [QUY CHUẨN KIẾN TRÚC & LỖI HỆ THỐNG NỀN TẢNG](file:///.agents/rules/architectural_standards_and_system_rules.md)
- **Tài liệu quy trình đồng bộ:** [HỆ THỐNG QUY TRÌNH TOÀN TRÌNH](file:///.agents/rules/system_workflows.md)
- **Giao thức điều tra sự cố:** [GIAO THỨC ĐIỀU TRA SỰ CỐ & DEBUGGING](file:///.agents/rules/systematic_debugging_and_incident_protocol.md)
