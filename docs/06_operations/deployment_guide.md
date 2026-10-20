# Tài Liệu Đặc Tả & Lựa Chọn Phương Án Triển Khai Hệ Thống (System Deployment Options)

> [!IMPORTANT]
> **LƯU Ý DÀNH CHO AI AGENT & DEVELOPER (TÀI LIỆU ĐANG TIẾP TỤC HOÀN THIỆN & MỞ RỘNG):**
> Tài liệu này là **bản đặc tả cơ sở (Baseline Specification)** cho các tùy chọn hạ tầng và cấu hình triển khai hệ thống. Tài liệu **CHƯA PHẢI LÀ BẢN ĐẦY ĐỦ 100% TUYỆT ĐỐI** và sẽ tiếp tục được bổ sung thêm các script CI/CD, biến môi trường `.env`, cấu hình bảo mật firewall trong quá trình code và phát triển sản phẩm. Khi triển khai code thực tế, Agent/Developer cần nắm vững rằng hệ thống sẽ phát sinh thêm các cấu hình tối ưu hạ tầng và cần chủ động hoàn thiện cả code lẫn cập nhật ngược lại tài liệu này.

> **MỤC ĐÍCH:** Hướng dẫn toàn diện các phương án triển khai (Deployment Architecture) cho Hệ thống Khảo sát Quy hoạch Hiện trạng Công trình Tuyến Metro 2. Tài liệu cung cấp lộ trình từ giai đoạn **Thử nghiệm Demo Miễn phí 0đ** (khi chưa có server vật lý) đến **Triển khai VPS Cloud giá rẻ** và **Bàn giao On-Premise chính thức cho Ban Quản lý Dự án MAUR**.

---

## 1. KIẾN TRÚC TỔNG THỂ CÁC THÀNH PHẦN HỆ THỐNG

```
                             [ NGƯỜI DÙNG HỆ THỐNG ]
                                        │
           ┌────────────────────────────┴────────────────────────────┐
           ▼                                                         ▼
[ Mobile PWA (Surveyor) ]                                [ Web Portal (Admin/Guest) ]
(Điện thoại ngoài hiện trường)                           (Máy tính văn phòng / Tablet)
           │                                                         │
           └────────────────────────────┬────────────────────────────┘
                                        ▼ (HTTPS / WSS)
                        [ CỔNG BẢO MẬT & REVERSE PROXY ]
                           (Cloudflare / Nginx / Caddy)
                                        │
                                        ▼
                           [ BACKEND API APPLICATION ]
                       (NodeJS NestJS/Express hoặc Python FastAPI)
                                        │
                      ┌─────────────────┴─────────────────┐
                      ▼                                   ▼
          [ CƠ SỞ DỮ LIỆU ĐỊA CHÍNH ]             [ LƯU TRỮ ẢNH BẰNG CHỨNG ]
            PostgreSQL 16 + PostGIS                 S3-Compatible Object Storage
          (Lưu text, số, JSONB, toạ độ)           (Lưu file ảnh gốc, CTX, CU, WebP)
```

---

## 2. OPTION 1: TRIỂN KHAI THỬ NGHIỆM & DEMO MIỄN PHÍ (CHI PHÍ 0 VNĐ)
*Phương án tối ưu nhất trong giai đoạn phát triển và thử nghiệm. Bạn hoàn toàn không cần mua server, chỉ cần đẩy code lên GitHub là có ngay đường link HTTPS trực tiếp trên điện thoại để đi khảo sát thử nghiệm.*

### 2.1. Cấu hình các dịch vụ Cloud Free-Tier:

| Thành phần | Nền tảng Đề xuất | Gói Miễn phí (Free Tier) | Nhiệm vụ & Tính năng |
| :--- | :--- | :--- | :--- |
| **Frontend (PWA & Web)** | **Vercel** hoặc **Cloudflare Pages** | Miễn phí 100% | - Tự động build khi push code lên GitHub.<br>- Cấp tên miền HTTPS miễn phí: `https://metro2-survey.vercel.app`.<br>- Mạng lưới CDN toàn cầu, tải trang < 1 giây trên 4G. |
| **Backend API** | **Render.com** hoặc **Railway.app** | 750 giờ/tháng (Free) | - Chạy API NodeJS / Python.<br>- Tự động cấp SSL HTTPS.<br>- Tự động restart khi có sự cố. |
| **Database (PostgreSQL)** | **Supabase** hoặc **Neon.tech** | 500 MB DB (Free) | - PostgreSQL 16 tích hợp sẵn extension **PostGIS** xử lý toạ độ polygon ranh thửa.<br>- Giao diện Web quản lý dữ liệu trực quan như Excel.<br>- Tự động sao lưu dữ liệu. |
| **Storage lưu ảnh** | **Cloudflare R2** hoặc **Supabase Storage** | 10 GB lưu trữ (Free) | - Lưu trữ toàn bộ ảnh gốc $P-01, P-02, CTX, CU$.<br>- **Miễn phí 100% chi phí băng thông tải ảnh (Zero Egress Fee)**. |

### 2.2. Luồng Vận Hành Tự Động (CI/CD Pipeline 0đ):
```
[ Code trên máy tính ] ──(git push)──> [ GitHub Repository ]
                                              │
               ┌──────────────────────────────┼──────────────────────────────┐
               ▼                              ▼                              ▼
     [ Vercel / Cloudflare ]           [ Render Backend ]          [ Supabase Database ]
      (Tự động deploy Web)            (Tự động deploy API)         (Lưu bảng & PostGIS)
```

---

## 3. OPTION 2: TRIỂN KHAI MÁY CHỦ ẢO VPS CLOUD GIÁ RẺ (~100k – 150k VNĐ/THÁNG)
*Phù hợp khi dự án bắt đầu triển khai diện rộng cho 5 – 20 cán bộ khảo sát cùng lúc, dữ liệu cần tập trung trên 1 máy chủ đặt tại Việt Nam.*

### 3.1. Cấu hình phần cứng VPS đề xuất:
- **Nhà cung cấp:** Vietnix, BKNS, TinoHost, Viettel IDC, Hetzner, DigitalOcean.
- **Cấu hình:** 2 vCPU, 2GB - 4GB RAM, 40GB - 80GB SSD NVMe.
- **Hệ điều hành:** Ubuntu 22.04 LTS hoặc 24.04 LTS.
- **Chi phí dự kiến:** ~100.000đ – 180.000đ / tháng.

### 3.2. Mô hình Đóng gói Toàn diện với Docker Compose (`docker-compose.yml`):
Toàn bộ hệ sinh thái được đóng gói thành các container độc lập, chỉ cần chạy đúng **1 lệnh**:
```bash
docker compose up -d
```

#### File mẫu cấu hình chuẩn `docker-compose.yml`:
```yaml
version: '3.8'

services:
  # 1. Reverse Proxy & Tự động cấp SSL HTTPS
  caddy_gateway:
    image: caddy:2-alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - frontend_web
      - backend_api

  # 2. Frontend Web Portal & PWA
  frontend_web:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    restart: always
    environment:
      - VITE_API_BASE_URL=https://survey.metro2.vn/api/v1

  # 3. Backend API Core
  backend_api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: always
    environment:
      - DATABASE_URL=postgresql://metro_user:metro_pass@db_postgres:5432/metro2_survey
      - S3_ENDPOINT=http://minio_storage:9000
      - S3_ACCESS_KEY=metro_minio_admin
      - S3_SECRET_KEY=metro_minio_secret_key
      - S3_BUCKET_NAME=metro2-photos
    depends_on:
      - db_postgres
      - minio_storage

  # 4. Database PostgreSQL 16 + PostGIS
  db_postgres:
    image: postgis/postgis:16-3.4-alpine
    restart: always
    environment:
      - POSTGRES_DB=metro2_survey
      - POSTGRES_USER=metro_user
      - POSTGRES_PASSWORD=metro_pass
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database_schema_v2.sql:/docker-entrypoint-initdb.d/init.sql

  # 5. Object Storage MinIO (S3 Nội bộ lưu ảnh bằng chứng)
  minio_storage:
    image: minio/minio:latest
    restart: always
    command: server /data --console-address ":9001"
    environment:
      - MINIO_ROOT_USER=metro_minio_admin
      - MINIO_ROOT_PASSWORD=metro_minio_secret_key
    volumes:
      - minio_data:/data

volumes:
  caddy_data:
  caddy_config:
  postgres_data:
  minio_data:
```

---

## 4. OPTION 3: TRIỂN KHAI BÀN GIAO ON-PREMISE CHO BAN DỰ ÁN MAUR
*Áp dụng khi dự án bước vào giai đoạn nghiệm thu chính thức, bàn giao toàn bộ hệ thống để chạy trên hạ tầng máy chủ nội bộ (Intranet) của Ban Quản lý Đường sắt Đô thị (MAUR) hoặc Liên danh Tư vấn CRLG–CRSRI–TT.*

### 4.1. Tiêu Chuẩn Kỹ Thuật Bàn Giao:
1. **Độc lập Hạ tầng (Self-contained):** Hệ thống không phụ thuộc vào bất kỳ dịch vụ đám mây bên ngoài nào; toàn bộ API, Database PostGIS, và Object Storage (MinIO) đều chạy khép kín trong mạng nội bộ Intranet/VPN.
2. **An Toàn Thông Tin & Chống Giả Mạo:**
   - Mã băm kiểm tra tính toàn vẹn `checksumSha256` cho từng bức ảnh gốc.
   - Lưu vết toàn bộ hành vi chỉnh sửa/phê duyệt qua bảng `audit_logs`.
   - Phân quyền nghiêm ngặt 4 cấp (`SUPER_ADMIN`, `ZONE_ADMIN`, `SURVEYOR`, `CONTRACTOR`).
3. **Sao Lưu & Phục Hồi Thảm Họa Tự Động (Automated Backup & Disaster Recovery):**
   - Cronjob tự động backup dữ liệu database hàng ngày vào lúc 00:00:
     ```bash
     0 0 * * * pg_dump -U metro_user metro2_survey | gzip > /backups/db_$(date +\%Y\%m\%d).sql.gz
     ```
   - Snapshot tự động toàn bộ ổ đĩa MinIO lưu trữ ảnh sang máy chủ lưu trữ thứ cấp (Secondary Backup Server).

---

## 5. BẢNG SO SÁNH TỔNG QUAN 3 PHƯƠNG ÁN TRIỂN KHAI

| Tiêu chí Đánh giá | Option 1: Cloud Free-Tier | Option 2: VPS Cloud Giá Rẻ | Option 3: On-Premise MAUR |
| :--- | :---: | :---: | :---: |
| **Chi phí hạ tầng** | **0 VNĐ** | **~100k - 180k VNĐ / tháng** | Theo ngân sách dự án |
| **Độ phức tạp cài đặt** | Cực kỳ dễ (Tự động) | Đơn giản (1 lệnh Docker) | Tiêu chuẩn doanh nghiệp |
| **Yêu cầu máy chủ vật lý** | Không cần | Không cần (Dùng Cloud VPS) | Có (Server nội bộ MAUR) |
| **Tốc độ truy cập mạng 4G** | Cực nhanh (CDN toàn cầu) | Rất nhanh (Server Việt Nam) | Phụ thuộc đường truyền VPN |
| **Quy mô đáp ứng** | Demo / 1 - 3 người thử nghiệm | 10 - 50 cán bộ đồng thời | Toàn tuyến (Hàng trăm người) |
| **Bảo mật & Chủ quyền dữ liệu** | Đám mây công cộng | Đám mây riêng có mã hóa | Tuyệt đối an toàn nội bộ |
| **Mục đích sử dụng** | **Giai đoạn Code & Demo ngay** | **Giai đoạn Khảo sát thử nghiệm** | **Bàn giao Pháp lý chính thức** |

---

## 6. LỘ TRÌNH THỰC HIỆN KHUYẾN NGHỊ (RECOMMENDED ROADMAP)

```
[ BƯỚC 1: Code & Test trên máy tính ] (Localhost: Frontend + Backend + DB)
                   │
                   ▼
[ BƯỚC 2: Triển khai Option 1 (0 VNĐ) ] ──> Gửi link cho Sếp & Khách hàng test trên Mobile
                   │
                   ▼
[ BƯỚC 3: Triển khai Option 2 (VPS Giá rẻ) ] ──> Cán bộ đi hiện trường khảo sát diện rộng
                   │
                   ▼
[ BƯỚC 4: Đóng gói Docker Option 3 ] ──> Bàn giao nghiệm thu cho Ban Dự án MAUR
```
