# HỆ THỐNG KHẢO SÁT HIỆN TRẠNG CÔNG TRÌNH (KSQH METRO 2)
> **Dự án:** Ứng dụng Khảo sát Đánh giá Hiện trạng Công trình (Building Condition Assessment - BCA) phục vụ Dự án Tuyến Đường sắt Đô thị Metro Số 2 (Bến Thành – Tham Lương).  
> **Quy mô khảo sát:** ~7.000 công trình (nhà ở riêng lẻ, trường học, công trình công cộng, TMDV...) dọc hành lang tuyến.  
> **Mục tiêu cốt lõi:** Thu thập số liệu chi tiết, bằng chứng hình ảnh hiện trạng kiến trúc - kết cấu của các công trình làm căn cứ pháp lý phục vụ việc xác định hoặc khước từ đền bù khi có tranh chấp/tác động lún nứt từ quá trình thi công và vận hành Metro.

---

## 🌟 TOÀN BỘ CÁC PHÂN HỆ ĐÃ XÂY DỰNG HOÀN CHỈNH

```
/Users/vqd2k6/Desktop/Project/KSat_QHoach/
├── index.html                   # 🌐 Giao diện Prototype Demo (Nền sáng - Light Theme) [Port 3000]
├── css/ & js/                   # Thư viện giao diện, bản đồ Leaflet Esri, Dual-GPS Canvas
├── database_schema.sql          # 🗄️ CSDL không gian PostgreSQL 15+ & PostGIS 3+
├── backend/                     # 🚀 Backend REST API (Node.js/Express + PostGIS + R2) [Port 5050]
│   ├── package.json
│   ├── src/
│   │   ├── server.js            # Express API Server
│   │   ├── config/              # PostgreSQL Pool & Cloudflare R2 Client
│   │   ├── routes/              # Auth, Zones, Buildings, Media
│   │   └── scripts/             # Seed data script
└── mobile_app/                  # 📱 Ứng dụng Di Động Flutter Native (iOS & Android)
    ├── pubspec.yaml             # flutter_map, geolocator, camera, dio
    ├── lib/
    │   ├── main.dart            # Light Theme Material 3
    │   ├── services/            # GpsService, WatermarkService, ApiService
    │   ├── widgets/             # CrackPainterCanvas, FootprintMapWidget
    │   └── views/               # LoginView, ZoneListView, SurveyWizardView
    ├── android/                 # AndroidManifest (Camera, Fine GPS permissions)
    └── ios/                     # Info.plist (NSCamera, NSLocation permissions)
```

---

## 1. TỔNG QUAN HỆ THỐNG & KIẾN TRÚC PHÂN QUYỀN

### 1.1. Mô hình Phân quyền 3 Cấp (3-Tier RBAC)
```
[ CẤP 1: SUPER ADMIN ] (Chủ đầu tư / Ban QLDA Metro / IT Lead)
          │
          ▼
[ CẤP 2: ZONE MANAGER / REVIEWER ] (Tổ trưởng / Điều phối viên phân đoạn)
          │
          ▼
[ CẤP 3: FIELD SURVEYOR ] (Cán bộ khảo sát hiện trường - Mobile App)
```

| Cấp bậc | Vai trò | Quyền hạn & Trách nhiệm chính | Nền tảng |
| :--- | :--- | :--- | :--- |
| **Cấp 1** | **Super Admin** *(Ban QLDA / CĐT)* | - Quản lý toàn bộ gói thầu, 6 quận huyện dọc tuyến Metro số 2.<br>- Xem Dashboard tiến độ toàn tuyến trên bản đồ số GIS.<br>- Quản lý và cấp tài khoản nội bộ cho Zone Manager, cấu hình hệ thống. | Web Admin Portal |
| **Cấp 2** | **Zone Manager** *(Điều phối / Duyệt)* | - Quản lý khu vực/phân đoạn được giao (theo Ga/Gói thầu/Quận).<br>- **Vẽ phân vùng khảo sát (Survey Zones)** & giao việc cho từng Surveyor.<br>- **Kiểm duyệt hồ sơ hiện trường:** Duyệt (*Approve*) hoặc Trả về (*Reject* kèm lý do).<br>- Giám sát cờ cảnh báo gian lận GPS (>50m). | Web Admin Portal |
| **Cấp 3** | **Field Surveyor** *(Cán bộ hiện trường)* | - Đăng nhập tài khoản nội bộ trên Mobile App.<br>- Nhận khu vực được giao, tiến hành **khảo sát quét cạn (Sweep Survey)** từng công trình.<br>- Bắt GPS ngầm, chỉnh ghim tâm nhà, vẽ footprint sau khảo sát.<br>- Chụp ảnh đóng watermark, vẽ sơ đồ vết nứt, nộp hồ sơ chờ duyệt. | Mobile App (iOS / Android) |

---

## 2. CHIẾN LƯỢC KHẢO SÁT QUÉT CẠN & CẬP NHẬT NGƯỢC DỮ LIỆU GIS (REVERSE GIS RECONCILIATION)

> [!NOTE]
> **Thực tế quy hoạch đô thị:** Dữ liệu bản đồ quy hoạch/địa chính cấp bởi cơ quan nhà nước có thể có độ trễ thời gian, hoặc trên thực tế một thửa đất quy hoạch lớn đã bị chia nhỏ thành 5-7 căn nhà thực tế (nhà chia nhỏ, sổ chung, xây xen kẹt, cơi nới). Do đó, hệ thống áp dụng chiến lược **Bàn giao Phân vùng & Quét cạn thực địa (Zone-based Exhaustive Sweep)**.

### Quy trình nghiệp vụ Khảo sát Thực địa & Cập nhật GIS:
```
[ 1. Zone Manager vẽ Polygon Phân vùng & Giao việc ]
                        │
                        ▼
[ 2. Surveyor đến thực địa, đi quét cạn từng công trình trong vùng ]
                        │
                        ▼
[ 3. Tạo hồ sơ công trình mới: Bắt GPS ngầm + Chỉnh ghim tâm nhà ]
                        │
                        ▼
[ 4. Khảo sát chi tiết Cây cấu kiện: Ngoại thất, các Tầng, Phòng, Cấu kiện ]
                        │
                        ▼
[ 5. Chụp ảnh Watermark + Đo đạc & Vẽ đánh dấu vết nứt/hư hỏng ]
                        │
                        ▼
[ 6. Vẽ Đa giác Đường bao ngôi nhà (Building Footprint Polygon) ]
                        │
                        ▼
[ 7. Surveyor Nộp hồ sơ (Submitted) ]
                        │
                        ▼
[ 8. Zone Manager Kiểm tra & Phê duyệt (Approved) ]
                        │
                        ▼
[ 9. Tự động Cập nhật Ngược Footprint vào Bản đồ GIS Trung tâm ]
```

---

## 3. HƯỚNG DẪN VẬN HÀNH & TRẢI NGHIỆM

### 1. Trải nghiệm Giao diện Demo Prototype (Nền sáng - Light Theme)
- Mở trình duyệt tại: **[http://localhost:3000](http://localhost:3000)**
- Chế độ **Xem Song Song (Split View)**: Trực tiếp thao tác giả lập điện thoại và thấy dữ liệu đồng bộ sang Web Admin để duyệt.
- Nút **`📊 Bảng Điều Phối & Thống Kê`** có thể ẩn/mở linh hoạt.

### 2. Khởi chạy Backend API
```bash
cd backend
npm start
# API chạy tại http://localhost:5050
# Health check: http://localhost:5050/api/health
```

### 3. Khởi chạy Ứng dụng Di động Flutter
```bash
cd mobile_app
flutter pub get
flutter run
```

---

## 4. TÍNH TOÁN DUNG LƯỢNG LƯU TRỮ HÌNH ẢNH & CHI PHÍ DỰ TÍNH

| Thông số | Giá trị định lượng | Ghi chú |
| :--- | :--- | :--- |
| **Tổng số công trình** | **~ 7.000 hộ / công trình** | Dọc 6 quận tuyến Metro 2 |
| **Số ảnh trung bình / hộ** | **~ 20 ảnh / công trình** | Ngoại thất, các tầng, chi tiết nứt |
| **Tổng số lượng ảnh toàn dự án** | **140.000 bức ảnh** | 7.000 × 20 |
| **Dung lượng ảnh gốc chất lượng cao** | **~ 4.0 - 5.0 MB / ảnh** | Độ phân giải 12MP - 48MP nguyên bản |
| **TỔNG DUNG LƯỢNG LƯU TRỮ ẢNH** | **~ 560 GB - 700 GB** | ~ 0.6 - 0.7 Terabyte (TB) |
| **Dung lượng dự phòng an toàn (+20%)** | **~ 850 GB - 1 TB** | Dự phòng công trình lớn chụp nhiều ảnh |
| **Chi phí lưu trữ đề xuất (`Cloudflare R2`)** | **~$15 / tháng (~ 375.000 VNĐ)** | **$0 chi phí tải về (Zero Egress Fee)** |
