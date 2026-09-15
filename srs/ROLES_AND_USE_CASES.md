# Đặc tả Phân quyền & Kịch bản Sử dụng (SRS - Roles, Permissions & Use Cases)

> Tài liệu đặc tả chuẩn hóa Ma trận Phân quyền (RBAC) 4 Vai trò cốt lõi và Chi tiết các Kịch bản Sử dụng (Use Cases) cho Hệ thống Khảo sát Hiện trạng Công trình Metro 2.

---

## 1. MA TRẬN PHÂN QUYỀN VÀ NỀN TẢNG (ROLES & PERMISSION MATRIX)

Hệ thống áp dụng mô hình kiểm soát truy cập dựa trên vai trò **RBAC (Role-Based Access Control)** được đơn giản hóa chuẩn xác thành 4 vai trò chính:

### 1.1. Danh sách 4 Vai trò Cốt lõi (Role Descriptions)

| Mã Vai trò | Tên Vai trò | Nền tảng sử dụng | Mô tả chức năng & Trách nhiệm chính |
| :---: | :--- | :---: | :--- |
| **`SUPER_ADMIN`** | Quản trị viên Cấp cao | Web Admin | Quản lý toàn bộ hệ thống, quản lý tài khoản, cấu hình lớp GIS Metro 2, cài đặt trọng số rủi ro ranh giới, xem dashboard tổng quan toàn tuyến. |
| **`ZONE_ADMIN`** | Quản lý Phân khu | Web Admin | Quản lý các công trình theo Phân khu/Nhà ga được gán. Phân công task cho Surveyor, duyệt/trả về hồ sơ khảo sát, thực hiện quyền Kỹ sư (Engineering Judgement). |
| **`SURVEYOR`** | Cán bộ Khảo sát Hiện trường | Mobile PWA / App | Trực tiếp đi hiện trường thu thập dữ liệu theo luồng 9 bước hợp nhất, chụp ảnh watermark, thả ghim khuyết tật $D-xx$, lấy chữ ký chủ nhà, đồng bộ offline. |
| **`CONTRACTOR`** | Đại diện Nhà thầu / Tư vấn | Web Portal | Đăng nhập Web xem đối soát hồ sơ đã duyệt của Zone Admin, soi vạch thước mm bằng kính lúp $400\%$, ký số chốt hồ sơ pháp lý trước khi đào TBM. |

---

### 1.2. Ma trận Chi tiết Quyền hạn (Permissions Matrix)

| Chức năng / Hành động Hệ thống | SUPER_ADMIN | ZONE_ADMIN | SURVEYOR | CONTRACTOR |
| :--- | :---: | :---: | :---: | :---: |
| **Quản lý Tài khoản & Phân quyền User** |  Full |  Xem |  Không |  Không |
| **Quản lý Lớp GIS Metro 2 (Ranh GPMB, Tim tuyến)** |  Full |  Xem |  Xem |  Xem |
| **Phân công Task Khảo sát (Assign Task)** |  Full |  Full |  Không |  Không |
| **Thực hiện Khảo sát & Chụp ảnh hiện trường** |  Tùy chọn |  Tùy chọn |  Full |  Không |
| **Thả Ghim Khuyết tật $D-xx$ trên Ảnh bối cảnh** |  Tùy chọn |  Tùy chọn |  Full |  Không |
| **Lấy Chữ ký Điện tử Chủ hộ (Mobile E-Sign)** |  Không |  Không |  Full |  Không |
| **Thẩm định Hồ sơ Split-Pane (Kính lúp 400%)** |  Full |  Full |  Không |  Full |
| **Phê duyệt (Approve) / Trả về (Reject)** |  Full |  Full |  Không |  Ký duyệt |
| **Quyền Can thiệp Kỹ sư (Engineering Judgement)** |  Full |  Full |  Không |  Xem |
| **Xuất Báo cáo Pháp lý (PDF/A & GIS Footprints)** |  Full |  Full |  Xem |  Full |

---

## 2. ĐẶC TẢ CHI TIẾT CHỨC NĂNG TỪNG VAI TRÒ (DETAILED ROLE SPECIFICATIONS)

### 2.1. Quản trị viên Cấp cao (`SUPER_ADMIN`)
- **Quản lý Hệ thống & Tài khoản:** Tạo mới, khóa, phân quyền cho các tài khoản `ZONE_ADMIN`, `SURVEYOR`, `CONTRACTOR`.
- **Quản lý Dữ liệu GIS Quy hoạch:** Quản lý các lớp bản đồ GIS (GeoJSON/KML) chứa đường tim tuyến Metro 2, ranh giới giải phóng mặt bằng, ranh giới 11 nhà ga và các thửa đất.
- **Cấu hình Trọng số & Công thức Rủi ro:** Tùy chỉnh quy tắc ECS, ngưỡng chỉ số rủi ro VI, Burland Grade rules.
- **Executive Master Dashboard:** Thống kê tổng quan toàn tuyến (~7.000 căn): Số lượng đã khảo sát, số lượng đã duyệt, số lượng công trình rủi ro `CRITICAL`.
- **Nhật ký Hệ thống (Audit Log & Chain of Custody):** Truy vết lịch sử mọi thao tác đăng nhập, sửa đổi dữ liệu, phê duyệt và xuất báo cáo.

### 2.2. Quản lý Phân khu (`ZONE_ADMIN`)
- **Quản lý Task theo Phân khu:** Chọn Phân khu/Nhà ga phụ trách (VD: *Ga S9 - Bà Quẹo*), khoanh vùng công trình trên bản đồ GIS và phân công cho `SURVEYOR`.
- **Theo dõi Tiến độ Hiện trường:** Theo dõi tọa độ check-in GPS real-time của Surveyor, tiến độ khảo sát hàng ngày.
- **Thẩm định Hồ sơ Hiện trường:** 
  - Xem chi tiết hồ sơ 9 bước gửi về từ Surveyor.
  - Xem đối soát màn hình chia đôi (Split-Pane View), kiểm tra cặp ảnh CTX + CU, ghim khuyết tật $D-xx$.
  - Phê duyệt (`Approve`) hoặc Trả về (`Reject`) yêu cầu Surveyor khảo sát bổ sung.
- **Thực hiện Quyền Kỹ sư (Engineering Judgement):** Có quyền Nâng/Hạ phân hạng ECS/VI nếu có căn cứ kỹ thuật (kèm ô bắt buộc nhập lý do; bị khoá không cho hạ hạng nếu có cờ `Critical`).

### 2.3. Cán bộ Khảo sát Hiện trường (`SURVEYOR`)
- **Đăng nhập & Đồng bộ Offline (Mobile App / PWA):** Xem danh sách task được gán. Hỗ trợ lưu nháp 3 giây/lần và đồng bộ ngoại tuyến (IndexedDB/SQLite) khi mất sóng 5G.
- **Check-in GPS & Chụp Ảnh Định Danh:** Tự động bắt tọa độ GPS, hiển thị lý trình Metro. Chụp 4 ảnh định danh $P-01 \to P-04$ có Watermark GPS & Thời gian thực.
- **Khảo sát Thực địa 9 Bước Hợp nhất:**
  - **Phỏng vấn chủ hộ:** Thu thập công năng, kết cấu, loại móng (CAT 1-5), lịch sử cơi nới/sửa chữa và yếu tố nhạy cảm.
  - **Chụp ảnh Bối cảnh & Thả ghim Real-Time:** 1 Ảnh bối cảnh (`Photo CTX`) = 1 Vùng `Z-01`. Chạm tay thả ghim $D-01, D-02\dots$ trực tiếp trên hình.
  - **Chụp Cận cảnh có thước:** Tiến lại gần ghim $D-xx$ đặt thước đo khe nứt và chụp Ảnh Cận cảnh (`Photo CU`), nhập bề rộng max $w_{\max}$, chiều dài $L$.
  - **Đo lún nghiêng:** Nhập chỉ số nghiêng X/Y%, nghiêng sàn, võng dầm.
- **Lấy Chữ ký Điện tử Chủ hộ:** Mở bảng ký cảm ứng toàn màn hình xoay ngang để Chủ hộ ký ngón tay xác nhận biên bản.

### 2.4. Đại diện Nhà thầu thi công / Tư vấn (`CONTRACTOR`)
- **Thẩm định Hồ sơ Độc lập (Web Portal):** Đăng nhập Web Portal xem đối soát các hồ sơ khảo sát đã qua bước kiểm duyệt của `ZONE_ADMIN`.
- **Kính lúp Phóng đại 400% (High-Precision Zoom Loupe):** Rê chuột lên ảnh cận cảnh `Photo CU` để kích hoạt kính lúp soi từng vạch milimet trên thước đo áp sát vết nứt.
- **Radar Cảnh báo Gian lận GPS (Dual-GPS Anti-fraud Radar):** Hệ thống tự đối soát tọa độ chụp ảnh với tọa độ công trình, viền đỏ nhấp nháy nếu lệch $>50\text{ m}$.
- **Ký số Chốt Hồ sơ Pháp lý:** Đăng nhập tài khoản ký số thẩm định trước khi bắt đầu công tác đào hầm TBM / thi công ngầm.
- **Tải Báo cáo Pháp lý (PDF/A Export):** Tải về bộ báo cáo chuẩn PDF/A đầy đủ hình ảnh watermark và chữ ký xác nhận phục vụ căn cứ đền bù / giải tỏa.

---

## 3. CHI TIẾT CÁC KỊCH BẢN SỬ DỤNG (USE CASE SPECIFICATIONS)

---

### USE CASE 01: PHÂN CÔNG TASK KHẢO SÁT (ZONE & TASK ASSIGNMENT)
- **Tác nhân:** `ZONE_ADMIN`, `SUPER_ADMIN`.
- **Luồng thực hiện:**
  1. `ZONE_ADMIN` đăng nhập Web Portal, chọn Phân khu/Nhà ga được giao.
  2. Hệ thống hiển thị bản đồ GIS chứa các thửa đất và công trình.
  3. `ZONE_ADMIN` khoanh vùng công trình và chọn `SURVEYOR` phụ trách.
  4. Bấm **"Phân công Task"**. Hệ thống gửi thông báo Real-time đến di động của `SURVEYOR`.

---

### USE CASE 02: KHẢO SÁT HỆN TRƯỜNG HỢP NHẤT (UNIFIED FIELD SURVEYING)
- **Tác nhân:** `SURVEYOR`, Chủ sở hữu công trình.
- **Luồng thực hiện:**
  1. **Check-in GPS:** Bắt tọa độ, chụp 4 ảnh định danh $P-01 \to P-04$ có Watermark.
  2. **Phỏng vấn chủ hộ:** Thu thập thông tin móng (CAT 1-5), kết cấu, lịch sử cơi nới/sửa chữa.
  3. **Chụp bối cảnh & Thả ghim $D-xx$:** Chụp 1 ảnh bối cảnh mảng tường (`Photo CTX`) ➔ Tự động tạo Vùng `Z-01` ➔ Chạm thả ghim $D-01, D-02\dots$ ➔ Tiến lại gần chụp ảnh Cận cảnh (`Photo CU`) có thước đo khe nứt.
  4. **Đo lún nghiêng:** Nhập chỉ số nghiêng X/Y%, nghiêng sàn, võng dầm.
  5. **Auto Calculation:** Hệ thống tự động quy đổi điểm ECS ($E1 \to E5$) và điểm VI ($V3, V5$). `SURVEYOR` kéo thanh trượt Slider 1-4 có Note mô tả cho các tiêu chí VI còn lại.
  6. **Lấy chữ ký:** `SURVEYOR` ký tên và cho Chủ hộ ký ngón tay trên bảng ký xoay ngang toàn màn hình.

---

### USE CASE 03: GHIM KHUYẾT TẬT TRÊN BẢN VẼ TAY (INTERACTIVE SKETCH PINNING)
- **Tác nhân:** `SURVEYOR`.
- **Luồng thực hiện:**
  1. `SURVEYOR` chụp ảnh tờ giấy vẽ phác thảo tay mặt bằng (`Damage Map / Sketch`).
  2. Màn hình hỗ trợ phóng to 300% (Pinch-to-Zoom).
  3. `SURVEYOR` chạm ngón tay để thả các điểm ghim $D-01, D-02\dots$ Nút ghim tự động đổi màu theo độ nguy hiểm (🟢 Green <1mm, 🟡 Yellow 1-5mm, 🔴 Red >5mm hoặc nứt kết cấu).

---

### USE CASE 04: THẨM ĐỊNH HỒ SƠ & SOI VẠCH THƯỚC (SPLIT-PANE AUDIT & ZOOM LOUPE)
- **Tác nhân:** `ZONE_ADMIN`, `CONTRACTOR`.
- **Luồng thực hiện:**
  1. Đăng nhập Web Portal, mở màn hình **Chia đôi Đối soát (Split-Pane)**. Nửa trái xem sơ đồ phác thảo có ghim $D-xx$, nửa phải xem cặp ảnh CTX+CU.
  2. Rê chuột lên ảnh cận cảnh `Photo CU` kích hoạt **Kính lúp 400%** soi vạch milimet trên thước đo.
  3. Kiểm tra Radar GPS cảnh báo sai lệch $>50\text{ m}$.
  4. Bấm phím tắt `A` (**Phê duyệt & Ký số**) hoặc phím `R` (**Trả về** kèm lý do).

---

### USE CASE 05: KÝ SỐ CHIẾN LƯỢC & XUẤT BÁO CÁO PHÁP LÝ (E-SIGNING & REPORTING)
- **Tác nhân:** `SURVEYOR`, Chủ hộ, `ZONE_ADMIN`, `CONTRACTOR`.
- **Luồng thực hiện:**
  1. `SURVEYOR` và Chủ hộ ký điện tử trực tiếp trên di động (kèm GPS + Timestamp).
  2. `ZONE_ADMIN` và `CONTRACTOR` đăng nhập Web Portal ký số thẩm định.
  3. Hồ sơ tự động chuyển sang trạng thái khoá chống chỉnh sửa (Read-Only / Chain of Custody).
  4. Hệ thống xuất file **Báo cáo chuẩn PDF/A Pháp lý** và tự động cập nhật ranh đa giác (Polygon Footprint) lên Bản đồ GIS.
