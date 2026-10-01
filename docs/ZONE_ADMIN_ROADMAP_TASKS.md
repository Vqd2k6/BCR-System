# 📌 LỘ TRÌNH PHÁT TRIỂN & DANH MỤC TASK DANG DỞ: ROLE ZONE ADMIN
*Dự án: Hệ thống Khảo sát Hiện trạng Công trình Tuyến Metro Số 2 (CRLG-CRSRI-TT)*
*Ngày ghi nhận: Tháng 10/2026*

Tài liệu này lưu trữ danh mục các tính năng, giải pháp kiến trúc và module nghiệp vụ dành riêng cho vai trò **Zone Admin (Tổ Trưởng Phân Khu / Điều Phối Viên Trạm)** đã được thảo luận và thống nhất đưa vào backlog để tiếp tục phát triển trong các giai đoạn tiếp theo.

---

## 🏗️ 1. PHÂN HỆ GIAO KHOÁN & ĐIỀU PHỐI HIỆN TRƯỜNG (FIELD WORK DISPATCH)
- [ ] **Modal Phân Công Thửa Đất Tập Trung**:
  - Cho phép Zone Admin chọn nhiều thửa đất theo tuyến đường / dãy số nhà và gán cho một Cán bộ khảo sát (Surveyor).
  - Kết nối với API Backend có sẵn: `POST /admin/parcels/assign-surveyor` (`{ parcelIds, surveyorId, notes }`).
- [ ] **Thống Kê Khối Lượng Giao Khoán Thực Tế**:
  - Cập nhật bảng nhân sự trong Dashboard Zone: thay thế công thức ước lượng tạm thời bằng việc query trực tiếp số lượng thửa thực tế từ cột `parcels.assigned_surveyor_id`.
  - Hiển thị tỷ lệ hoàn thành thực tế: `[Số thửa đã approved] / [Số thửa được giao]`.
- [ ] **Điều Chuyển Thửa Đất (Re-assignment)**:
  - Cho phép đổi Surveyor phụ trách khi có nhân sự nghỉ ốm, chuyển ga hoặc tiến độ bị trễ so với kế hoạch máy khoan hầm TBM.

---

## 🏛️ 2. PHÂN HỆ QUẢN LÝ BIẾN ĐỘNG RANH THỬA & ĐIỀU CHUYỂN THỬA GIS (HOÀN TẤT)
- [x] **Zone Admin Tách Thửa Trực Tiếp Trên GIS (SPLIT)**:
  - Cho phép Zone Admin trực tiếp tách thửa thực địa (Căn A/Căn B) ngay tại màn hình thẩm định hoặc Bước 6 mà không cần qua 2 bước chờ đề xuất/duyệt.
  - Tự động cấp mã mở rộng từ kho số của Zone, kích hoạt trạng thái `ACTIVE` cho các thửa con mới và gán hồ sơ hiện hữu sang Căn A.
  - API: `POST /api/v1/admin/parcels/execute-mutation`.
- [x] **Điều Chuyển Hồ Sơ Sang Thửa Đích (Re-assign Parcel)**:
  - Giải quyết bài toán nhà san sát nhau khiến KSV tích nhầm thửa đất trên bản đồ GIS.
  - Chuyển hồ sơ sang thửa đích với 1 Transaction, hoàn nguyên thửa cũ về `NOT_SURVEYED`, ghi nhật ký kiểm toán Append-only.
  - API: `POST /api/v1/admin/reports/:id/reassign-parcel`.
- [x] **Hoán Đổi 2 Hồ Sơ Bị Tích Chéo (Swap Parcels)**:
  - Giải quyết trường hợp 2 nhà liền kề bị khảo sát chéo thửa đất.
  - Đổi chéo `parcel_id` của 2 hồ sơ trong 1 transaction an toàn tuyệt đối.
  - API: `POST /api/v1/admin/reports/swap-parcels`.
- [x] **Rà Soát Toàn Diện 9 Bước Thẩm Định (Stepwise Audit Engine)**:
  - Hoàn thiện 100% chi tiết từ Bước 1 đến Bước 9: không bỏ sót bất kỳ trường thông số, ghi chú hiện trường, điểm ghim Z-E-D, thước đo mm hay cờ kết cấu nào.
  - Cho phép hiệu chỉnh thủ công cự ly tim hầm Metro khi GPS có sai số thực địa.
- [x] **Cơ Chế Bảo Mật Xác Thực 6 Số Ngẫu Nhiên Khi Thao Tác Thửa Đất**:
  - Tự động sinh mã 6 số ngẫu nhiên monospace chống nhìn trộm, bắt buộc Admin nhập chính xác 100% mới mở khóa các thao tác Điều chuyển, Hoán đổi chéo, Tách/Gộp thửa GIS.
  - Ngăn ngừa triệt để tình trạng ấn nhầm, chạm trượt tay hoặc thao tác bất cẩn làm sai lệch dữ liệu địa chính.
- [x] **Tái Thiết Kế Cụm Nút Chụp & Xem Lại Ảnh Thực Địa (Floating Glassmorphism)**:
  - Giải quyết dứt điểm tình trạng hàng 6 nút thô kệch tràn dòng che mất bức ảnh trên điện thoại của KSV.
  - Giải phóng 100% diện tích ảnh với nút chính `[📷 Chụp lại]` dạng viên thuốc và menu `[⋯]` mở rộng thông minh (Soi nét chi tiết, Xoay 90°, Vẽ nứt, Thư viện, Xóa).


---

## 📍 3. TRUNG TÂM KIỂM SOÁT KỶ LUẬT & ĐIỂM DANH GPS (ATTENDANCE ACTION CENTER)
- [ ] **Xác Minh Điểm Danh Hợp Lệ**:
  - Bổ sung nút duyệt hoặc bác bỏ điểm danh trong bảng nhân sự.
  - Kết nối với API: `POST /admin/attendance/:id/verify`.
- [ ] **Động Cơ Cảnh Báo Gian Lận GPS (Anti-fraud Engine)**:
  - Tự động gắn cờ đỏ khi cự ly check-in của cán bộ lệch quá 500m so với trọng tâm hình học (`ST_Centroid(geom)`) của Zone được giao.
  - Yêu cầu KSV phải có giải trình hợp lý (ví dụ: mất sóng GPS tạm thời, tắc đường, đo kiểm tra ranh ngoài rìa).
- [ ] **Chốt Công Nhật & Báo Cáo Chấm Công Phân Khu**:
  - Xuất bảng tổng hợp chấm công tháng/tuần theo từng Zone để chuyển giao cho phòng Nhân sự & Ban QLDA MAUR.

---

## 🗺️ 4. BẢN ĐỒ GIS GIÁM SÁT TIẾN ĐỘ PHÂN KHU (ZONE GIS PROGRESS HEATMAP)
- [ ] **Lớp Phủ Trạng Thái Thửa Đất Trực Quan**:
  - Tô màu polygon các thửa đất trên bản đồ Leaflet/PostGIS theo tiến độ thời gian thực:
    - 🟢 *Xanh lá*: Đã phê duyệt (Approved) - An toàn pháp lý.
    - 🔵 *Xanh dương*: Đã nộp, chờ thẩm định (Submitted).
    - 🟡 *Vàng*: Đang tiến hành khảo sát dở dang (Draft/In-progress).
    - 🟣 *Tím*: Vắng chủ hộ / Không hợp tác (Postponed/Absent).
    - ⚪ *Xám*: Chưa phân công / Chưa khảo sát.
- [ ] **Bộ Lọc Theo Cán Bộ Khảo Sát Trên Map**:
  - Bật/tắt để chỉ hiển thị các thửa đất mà một Surveyor cụ thể đang phụ trách.
- [ ] **Giao Việc Trực Tiếp Trên Bản Đồ (Spatial Lasso Dispatch)**:
  - Cho phép Zone Admin dùng công cụ chọn vùng (Box/Lasso) trên bản đồ để khoanh vùng 1 dãy nhà và bấm "Giao việc cho Surveyor X".

---

## 🔒 5. CHÍNH SÁCH BẢO MẬT & PHÂN QUYỀN VÙNG (ZONE DATA SCOPING & RLS)
- [ ] **Khóa Cứng Phân Quyền Theo Zone (Zone Isolation)**:
  - Rà soát toàn bộ API: đảm bảo tài khoản role `ZONE_ADMIN` chỉ được duyệt, sửa và ký duyệt các hồ sơ thuộc đúng `assignedZoneId` của mình.
  - Ngăn chặn triệt để tình trạng Trưởng Zone S8 duyệt nhầm hồ sơ của Ga S9.
- [ ] **Chế Độ Xem Thống Kê Toàn Tuyến (Read-only Cross-zone)**:
  - Xác lập quyền xem tiến độ tổng quan toàn tuyến ở mức chỉ đọc (Read-only) nếu được Ban Giám đốc cấp phép.

---

## 📄 6. PHÂN HỆ XUẤT BÁO CÁO KHẢO SÁT PHASE 1 (BCS EXPORT ENGINE - ĐANG TẠM ẨN)
- [ ] **Hoàn Thiện Thiết Kế Mẫu Báo Cáo A4 Chuẩn Liên Danh**:
  - Chờ thống nhất layout chính thức từ Tư vấn Giám sát & Nhà thầu EPC CRLG-CRSRI-TT:
    - Template Nhà dân liền thổ (Residential Template).
    - Template Căn hộ con (Condo Unit Template).
    - Template Khối tháp Master (Condo Master Template).
- [ ] **Kích Hoạt Lại Module Export**:
  - Bật lại component `Phase1ExportModuleBox` trên Dashboard Zone khi thiết kế Handlebars HTML/PDF được nghiệm thu hoàn tất.
