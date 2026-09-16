# HỆ THỐNG KHẢO SÁT QUY HOẠCH HIỆN TRẠNG CÔNG TRÌNH - METRO 2 BẾN THÀNH – THAM LƯƠNG

> **Dự án:** Ứng dụng Khảo sát Đánh giá Hiện trạng & Rủi ro Công trình (Building Condition Assessment - BCA) phục vụ Dự án Tuyến Đường sắt Đô thị Metro Số 2 (Bến Thành – Tham Lương).  
> **Phương pháp tiếp cận:** **API First & Specification-Driven Development** (Đặc tả chi tiết toàn diện trước khi triển khai code).

---

## 📚 HỆ THỐNG TÀI LIỆU ĐẶC TẢ CHUẨN KỸ THUẬT & API

Toàn bộ hệ sinh thái kỹ thuật của dự án được quy chuẩn chặt chẽ trong thư mục `srs/` và `docs/`:

1. **Đặc tả RESTful API (API Specification & Contract):** [`srs/API_SPECIFICATION.md`](file:///Users/vqd2k6/Desktop/MIT-techology/KSat_QHoach/srs/API_SPECIFICATION.md)
   * Định nghĩa toàn bộ 12 phân hệ nghiệp vụ, 28 REST endpoints.
   * Cấu trúc JSON Request/Response, chuẩn lỗi RFC 7807, ma trận phân quyền RBAC 4 cấp, tọa độ PostGIS GeoJSON WGS84.
2. **Chuẩn OpenAPI 3.1.0:** [`docs/openapi.yaml`](file:///Users/vqd2k6/Desktop/MIT-techology/KSat_QHoach/docs/openapi.yaml)
   * Sẵn sàng import trực tiếp vào Swagger UI, Postman, Insomnia hoặc sinh code SDK tự động.
3. **Mô hình Lớp OOP & Schema CSDL:** [`srs/CLASS_DIAGRAM.md`](file:///Users/vqd2k6/Desktop/MIT-techology/KSat_QHoach/srs/CLASS_DIAGRAM.md)
4. **Quy tắc Nghiệp vụ & Kiến trúc Mã kép (Dual-ID):** [`srs/Business_Logic.md`](file:///Users/vqd2k6/Desktop/MIT-techology/KSat_QHoach/srs/Business_Logic.md)
5. **Sơ đồ Tuần tự Chi tiết (Sequence Diagrams):** [`srs/SEQUENCE_DIAGRAMS.md`](file:///Users/vqd2k6/Desktop/MIT-techology/KSat_QHoach/srs/SEQUENCE_DIAGRAMS.md)
6. **Sơ đồ Hoạt động theo Vai trò (Activity Diagrams):** [`srs/ACTIVITY_DIAGRAMS.md`](file:///Users/vqd2k6/Desktop/MIT-techology/KSat_QHoach/srs/ACTIVITY_DIAGRAMS.md)
7. **Biểu mẫu Khảo sát Thực địa Phase 1 & Phase 2:** [`srs/Phase1_Docs.md`](file:///Users/vqd2k6/Desktop/MIT-techology/KSat_QHoach/srs/Phase1_Docs.md) & [`srs/Phase2_Docs.md`](file:///Users/vqd2k6/Desktop/MIT-techology/KSat_QHoach/srs/Phase2_Docs.md)
8. **Phương án Triển khai Hạ tầng & Docker Compose:** [`srs/DEPLOYMENT_OPTIONS.md`](file:///Users/vqd2k6/Desktop/MIT-techology/KSat_QHoach/srs/DEPLOYMENT_OPTIONS.md)

---

## 🗄️ CẤU TRÚC THƯ MỤC CHUẨN

```text
/KSat_QHoach/
├── srs/                        # Toàn bộ 10 tài liệu đặc tả chuẩn kỹ thuật & API Contract
│   ├── API_SPECIFICATION.md    # Đặc tả chi tiết 28 Endpoints RESTful API & JSON Schema
│   ├── SEQUENCE_DIAGRAMS.md    # Sơ đồ tương tác tuần tự giữa các Actor & Service
│   ├── ACTIVITY_DIAGRAMS.md    # Sơ đồ hoạt động theo 4 vai trò người dùng
│   ├── CLASS_DIAGRAM.md        # Mô hình lớp OOP & 21 bảng CSDL PostGIS
│   ├── Business_Logic.md       # Ràng buộc bất biến Mã kép & Giao dịch Tách/Gộp thửa
│   ├── Phase1_Docs.md          # 9 Bước khảo sát hiện trạng nền
│   ├── Phase2_Docs.md          # Đối soát Delta vết nứt & Đánh giá đền bù
│   ├── SURVEY_QUESTIONS.md     # Cây câu hỏi phỏng vấn kết cấu & móng CAT 1-5
│   ├── ROLES_AND_USE_CASES.md  # Ma trận phân quyền & Use Cases
│   └── DEPLOYMENT_OPTIONS.md   # Thiết kế hạ tầng triển khai On-Premise & Cloud
├── docs/                       # Tài liệu mở rộng & OpenAPI Contract
│   ├── openapi.yaml            # File chuẩn OpenAPI 3.1.0 cho Swagger / Postman
│   └── IMPLEMENTATION_PLAN.md  # Kế hoạch lộ trình phát triển kỹ thuật
└── database/                   # CSDL Không gian PostgreSQL 16 + PostGIS
    ├── init_schema.sql         # 21 bảng CSDL, UUID, PostGIS Geometry & Triggers
    └── seed_data.sql           # Dữ liệu hạt giống: 11 Ga Metro 2, User mẫu, Thửa đất Dual-ID
```
