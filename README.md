# HỆ THỐNG KHẢO SÁT QUY HOẠCH HIỆN TRẠNG CÔNG TRÌNH - METRO 2 BẾN THÀNH – THAM LƯƠNG

> **Dự án:** Ứng dụng Khảo sát Đánh giá Hiện trạng Công trình (Building Condition Assessment - BCA) phục vụ Tuyến Metro Số 2 (Bến Thành – Tham Lương).  
> **Kiến trúc:** Clean Architecture & Modular Microservices (PostgreSQL 16/PostGIS + Node.js REST API + PWA Mobile + Web Admin Portal).

---

## 🏗️ CẤU TRÚC THƯ MỤC DỰ ÁN

```text
/KSat_QHoach/
├── docker-compose.yml          # Điều phối 4 dịch vụ: PostGIS, Backend API, MinIO S3, Caddy
├── Caddyfile                   # Cấu hình Caddy Reverse Proxy & Web Server
├── database/                   # Khởi tạo CSDL Không gian PostGIS
│   ├── init_schema.sql         # 21 bảng CSDL, UUID, PostGIS Geometry & Spatial Indices
│   └── seed_data.sql           # Dữ liệu mẫu: 11 ga Metro 2, tài khoản mẫu, thửa đất Dual-ID
├── backend/                    # Core Backend RESTful API
│   ├── src/
│   │   ├── config/db.js        # Pool kết nối PostgreSQL
│   │   ├── middlewares/auth.js # Xác thực JWT & Phân quyền RBAC 4 cấp
│   │   ├── routes/api.js       # 14 REST Endpoints theo Sequence Diagrams
│   │   └── server.js           # Express Server & Health Check
│   ├── Dockerfile
│   └── package.json
├── frontend/                   # Ứng dụng giao diện người dùng
│   ├── mobile_pwa/index.html   # Mobile PWA cho Cán bộ Khảo sát (Field Surveyor)
│   └── web_admin/index.html    # Web Portal cho Tổ trưởng (Zone Admin) & Lãnh đạo (Super Admin)
└── srs/                        # Toàn bộ 9 tài liệu đặc tả chuẩn kỹ thuật & nghiệp vụ
```

---

## 🚀 HƯỚNG DẪN KHỞI CHẠY HỆ THỐNG

### Cách 1: Khởi chạy toàn bộ với Docker Compose (Khuyên dùng - 1 Lệnh)

Đảm bảo máy tính đã cài đặt **Docker Desktop** và đang chạy.

1. **Khởi chạy tất cả dịch vụ trong background:**
   ```bash
   docker compose up -d
   ```

2. **Truy cập các phân hệ ứng dụng:**
   - **Cổng Web Admin Portal:** [http://localhost:8080/admin](http://localhost:8080/admin) *(hoặc [http://localhost:8080](http://localhost:8080))*
   - **Ứng dụng Mobile PWA Surveyor:** [http://localhost:8080/pwa](http://localhost:8080/pwa)
   - **Backend REST API Health:** [http://localhost:5050/health](http://localhost:5050/health) *(hoặc qua proxy [http://localhost:8080/health](http://localhost:8080/health))*
   - **MinIO S3 Storage Console:** [http://localhost:9001](http://localhost:9001) *(User: `metro_minio_admin` / Pass: `metro_minio_secret_key`)*
   - **PostgreSQL PostGIS Database:** `localhost:5433` *(Database: `metro2_survey`, User: `metro_user`, Pass: `metro_pass`)*

3. **Dừng hệ thống:**
   ```bash
   docker compose down
   ```

---

### Cách 2: Khởi chạy trực tiếp trên máy cục bộ (Local Development)

#### 1. Khởi chạy Backend API
```bash
cd backend
npm install
npm start
```
*API sẽ chạy tại: `http://localhost:5000` (Kiểm tra: `http://localhost:5000/health`)*

#### 2. Khởi chạy Giao diện Frontend
Bạn có thể mở trực tiếp file HTML hoặc dùng `npx serve` / `Live Server`:
- **Web Admin Portal:** Mở file `frontend/web_admin/index.html` trong trình duyệt.
- **Mobile PWA Surveyor:** Mở file `frontend/mobile_pwa/index.html` trong trình duyệt (khuyên dùng chế độ Inspect F12 / Mobile Device View).

Hoặc chạy lệnh serve:
```bash
npx serve -l 8080 frontend
# Web Admin: http://localhost:8080/web_admin/
# Mobile PWA: http://localhost:8080/mobile_pwa/
```

---

## 🔐 TÀI KHOẢN TRẢI NGHIỆM MẪU (SEED DATA)

| Vai trò (Role) | Username | Password | Quyền hạn & Phân đoạn |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `superadmin` | `Admin@123` | Toàn quyền quản trị 11 Ga Metro 2, duyệt tách/gộp thửa đất |
| **Zone Admin** | `zoneadmin_s9` | `Admin@123` | Quản lý & duyệt hồ sơ khu vực Ga S9 (Bà Quẹo) |
| **Surveyor** | `surveyor_01` | `Survey@123` | Cán bộ hiện trường, thực hiện khảo sát 9 bước Phase 1 & 2 |
| **Contractor** | `guest_contractor` | `Guest@123` | Nhà thầu xây lắp Metro, tra cứu báo cáo & tải PDF/CAD |
