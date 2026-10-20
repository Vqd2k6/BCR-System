# 🚀 HƯỚNG DẪN CHẠY DỰ ÁN LOCAL BẰNG 1 DÒNG LỆNH DUY NHẤT

> **Dự án:** Nền tảng Khảo sát Đánh giá Hiện trạng Công trình Tuyến Metro Số 2 (Bến Thành – Tham Lương)  
> **Kiến trúc:** Micro-monorepo (PostgreSQL 16 PostGIS + Node.js Express Backend + React Vite PWA Frontend)

---

## ⚡ 1 DÒNG LỆNH DUY NHẤT (COPY & PASTE VÀO TERMINAL)

Mở **Terminal** tại thư mục dự án và dán dòng lệnh sau:

```bash
./start-local.sh
```

*(Hoặc nếu bạn đứng ở bất kỳ đâu trên máy tính Mac):*

```bash
cd /Users/vqd2k6/Desktop/MIT-techology/KSat_QHoach && ./start-local.sh
```

*(Cách khác nếu thích dùng npm):*

```bash
npm start
```

---

## 🛠️ SCRIPT NÀY TỰ ĐỘNG LÀM NHỮNG GÌ?

Khi bạn chạy lệnh trên, hệ thống sẽ tự động thực hiện từ A đến Z:
1. **Kiểm tra Docker Desktop**: Tự động bật và kết nối container PostgreSQL 16 + PostGIS (`metro2_postgres_postgis`) trên cổng **5433**. Chờ CSDL đạt trạng thái `healthy`.
2. **Kiểm tra Thư viện**: Tự động phát hiện và chạy `npm install` cho cả Backend và Frontend nếu máy chưa tải `node_modules`.
3. **Giải phóng Cổng (Port Conflict Auto-resolve)**: Tự động diệt các tiến trình cũ nếu cổng **4000** (Backend) hoặc **3000** (Frontend) đang bị treo.
4. **Khởi chạy đồng thời**:
   - Backend API chạy tại: `http://localhost:4000/api/v1`
   - Frontend PWA chạy tại: `http://localhost:3000`
5. **Tự động mở trình duyệt**: Tự mở `http://localhost:3000` trên Safari/Chrome của bạn.

---

## 🌐 DANH SÁCH ĐƯỜNG DẪN DỊCH VỤ

| Thành phần | Giao thức / Port | Đường dẫn kiểm tra |
| :--- | :--- | :--- |
| **Giao diện Khảo sát (Frontend PWA)** | HTTP : 3000 | [`http://localhost:3000`](http://localhost:3000) |
| **Dịch vụ API (Backend Service)** | HTTP : 4000 | [`http://localhost:4000/api/v1`](http://localhost:4000/api/v1) |
| **Kiểm tra trạng thái (Health Check)** | HTTP : 4000 | [`http://localhost:4000/health`](http://localhost:4000/health) |
| **CSDL Không gian PostGIS** | TCP : 5433 | `localhost:5433` (DB: `metro2_gis_db`, User: `metro2_user`) |

---

## 🔑 TÀI KHOẢN ĐĂNG NHẬP MẪU

Dữ liệu đã có sẵn các tài khoản phân quyền đúng chuẩn:

| Vai trò | Tên đăng nhập (`username`) | Mật khẩu (`password`) | Mô tả quyền hạn |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `superadmin` | `Admin@123` | Quản trị toàn tuyến Metro 2, quản lý người dùng, duyệt hồ sơ đặc biệt |
| **Zone Admin** | `zoneadmin_s9` | `Admin@123` | Quản lý Ga S9 (Bà Quẹo), duyệt hồ sơ khảo sát, ký số xác nhận |
| **Surveyor** | `surveyor_s9_01` | `Password@123` | Cán bộ hiện trường: điểm danh GPS, chụp ảnh, gắn khuyết tật CAD |
| **Surveyor 2** | `surveyor_s9_02` | `Password@123` | Khảo sát viên phụ thuộc khu vực Ga S9 |
| **Contractor** | `contractor_guest` | `Password@123` | Nhà thầu thi công hầm TBM tra cứu và theo dõi hiện trạng |

---

## 🛑 CÁCH DỪNG HỆ THỐNG

- Tại cửa sổ Terminal đang chạy, chỉ cần nhấn:
  ```text
  Ctrl + C
  ```
- Script đã được tích hợp cơ chế **Graceful Shutdown**: Tự động tắt sạch cả Backend và Frontend, không bao giờ để lại tiến trình ngầm làm kẹt cổng mạng.

---

## ⚠️ XỬ LÝ SỰ CỐ THƯỜNG GẶP (TROUBLESHOOTING)

### 1. Báo lỗi `Docker daemon chưa chạy`
- **Nguyên nhân**: Ứng dụng Docker Desktop trên macOS chưa được bật.
- **Khắc phục**: Mở ứng dụng **Docker** trong thư mục Applications (hoặc Spotlight: gõ Docker -> Enter), chờ biểu tượng cá voi màu xanh sáng lên, sau đó gõ lại `./start-local.sh`.

### 2. Muốn reset lại dữ liệu sạch ban đầu (Reset Data)
Nếu bạn muốn đặt lại toàn bộ database về trạng thái ban đầu:
```bash
docker exec -i metro2_postgres_postgis psql -U metro2_user -d metro2_gis_db < database/reset_clean_production.sql
```
