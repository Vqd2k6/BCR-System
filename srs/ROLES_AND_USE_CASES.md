# Đặc tả Phân quyền & Kịch bản Sử dụng (SRS - Roles, Permissions & Use Cases)

> Tài liệu đặc tả chuẩn hóaMa trận Phân quyền (RBAC) và Chi tiết các Use Case chính cho Hệ thống Khảo sát Hiện trạng Công trình Metro 2.

---

## 1. MA TRẬN PHÂN QUYỀN VÀ NỀN TẢNG (ROLES & PERMISSION MATRIX)

Hệ thống áp dụng mô hình kiểm soát truy cập dựa trên vai trò **RBAC (Role-Based Access Control)** gồm 5 vai trò chính:

### 1.1. Danh sách Vai trò (Role Descriptions)

| Mã Vai trò | Tên Vai trò | Nền tảng sử dụng | Mô tả chức năng & Trách nhiệm |
| :---: | :--- | :---: | :--- |
| **SUPER_ADMIN** | Quản trị viên Cấp cao | Web Admin | Quản lý toàn bộ hệ thống, tạo tài khoản Admin/Manager, cấu hình lớp GIS Metro 2, cài đặt trọng số rủi ro, xuất báo cáo tổng toàn dự án. |
| **ZONE_ADMIN** | Quản lý Phân khu | Web Admin | Quản lý công trình trong khu vực ga/tuyến được gán. Phân công task cho Surveyor, duyệt hoặc trả về hồ sơ khảo sát, theo dõi tiến độ. |
| **SURVEYOR** | Cán bộ Khảo sát Hiện trường | Mobile PWA / App | Trực tiếp đi hiện trường, thu thập dữ liệu theo luồng 9 bước hợp nhất, chụp ảnh watermark, ghim khuyết tật $D-xx$, lấy chữ ký chủ nhà, đồng bộ dữ liệu. |
| **CONTRACTOR** | Đại diện Nhà thầu / Tư vấn | Web Portal | Đăng nhập Web xem hồ sơ đã duyệt của Zone Admin, soi vạch thước mm bằng kính lúp $400\%$, ký số thẩm định trước khi đào TBM. |
| **LOCAL_OFFICIAL** | Đại diện UBND Phường / TDP | Web / Mobile | Xem biên bản hiện trạng, xác nhận tính pháp lý của hồ sơ khảo sát phục vụ đền bù / giải quyết tranh chấp. |

---

### 1.2. Ma trận Chi tiết Quyền hạn (Permissions Matrix)

| Chức năng / Hành động | SUPER_ADMIN | ZONE_ADMIN | SURVEYOR | CONTRACTOR | LOCAL_OFFICIAL |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Quản lý Tài khoản & Phân quyền** |  Full |  Xem |  Không |  Không |  Không |
| **Tạo mới / Bật tắt Lớp GIS Metro** |  Full |  Xem |  Xem |  Xem |  Xem |
| **Phân công Task Khảo sát (Assign)** |  Full |  Full |  Không |  Không |  Không |
| **Thực hiện Khảo sát & Chụp ảnh hiện trường** |  Tùy chọn |  Tùy chọn |  Full |  Không |  Không |
| **Ký số Điện tử trên Mobile (Khảo sát viên)** |  Không |  Không |  Full |  Không |  Không |
| **Ký số Điện tử trên Mobile (Chủ nhà)** |  Không |  Không |  Hỗ trợ |  Không |  Không |
| **Thẩm định Hồ sơ Split-Pane & Soi vạch thước** |  Full |  Full |  Không |  Full |  Xem |
| **Phê duyệt (Approve) / Trả về (Reject)** |  Full |  Full |  Không |  Ký duyệt |  Ký duyệt |
| **Sửa đổi Dữ liệu Khảo sát sau khi Duyệt** |  Khoá |  Khoá |  Khoá |  Khoá |  Khoá |
| **Xuất Báo cáo Pháp lý (PDF / Excel / GIS)** |  Full |  Full |  Chỉ xem |  Full |  Xem |

---

## 2. CHI TIẾT CÁC KỊCH BẢN SỬ DỤNG (USE CASE SPECIFICATIONS)

---

### USE CASE 01: PHÂN CÔNG TÁC KHẢO SÁT THEO PHÂN KHU (ZONE & TASK ASSIGNMENT)

- **Mục đích:** Zone Admin gán danh sách các công trình (theo thửa đất/nhà ga) cho cán bộ khảo sát hiện trường.
- **Tác nhân (Actor):** Zone Admin, Super Admin.
- **Tiền điều kiện (Pre-conditions):** Danh sách công trình và tài khoản Surveyor đã được khởi tạo trong hệ thống.
- **Luồng sự kiện chính (Main Flow):**
  1. Zone Admin đăng nhập Web Portal, chọn Phân khu/Nhà ga đang quản lý (VD: *Ga S9 - Bà Quẹo*).
  2. Hệ thống hiển thị bản đồ GIS chứa các đa giác thửa đất và danh sách công trình chưa khảo sát.
  3. Zone Admin chọn danh sách công trình (hoặc quét khoanh vùng trên bản đồ) và chọn Surveyor chịu trách nhiệm.
  4. Zone Admin bấm **"Phân công Task"**.
  5. Hệ thống ghi nhận trạng thái task là `ASSIGNED` và gửi thông báo Real-time (Push Notification) đến thiết bị của Surveyor.
- **Luồng ngoại lệ (Alternative Flow):**
  - *Surveyor xin chuyển task:* Nếu Surveyor báo bận/ốm, Zone Admin có thể chọn Re-assign sang Surveyor khác.

---

### USE CASE 02: KHẢO SÁT HỆN TRƯỜNG HỢP NHẤT (UNIFIED FIELD SURVEYING)

- **Mục đích:** Surveyor thực hiện thu thập dữ liệu công trình theo luồng 9 bước hợp nhất trực tiếp tại hiện trường.
- **Tác nhân (Actor):** Surveyor (Cán bộ hiện trường), Chủ sở hữu / Người sử dụng nhà.
- **Tiền điều kiện:** Công trình đã được gán cho Surveyor và ứng dụng di động đã sẵn sàng.
- **Luồng sự kiện chính (Main Flow):**
  1. **Bước 1 (Check-in & Định danh):** Surveyor đến trước nhà, App tự động bắt GPS, hiển thị Lý trình Metro & Khoảng cách tim tuyến. Surveyor chụp 4 ảnh định danh ($P-01 \to P-04$) tự động chèn Watermark GPS & Thời gian.
  2. **Bước 2 (Phỏng vấn chủ hộ):** Surveyor ghi nhận thông số kết cấu (số tầng, móng, năm XD) và phỏng vấn 6 yếu tố nhạy cảm (cơi nới, sửa chữa, lún nghiêng cũ, sự cố).
  3. **Bước 3 (Khảo sát mảng tường & Ghim khuyết tật):**
     - Surveyor chọn Tầng/Phòng, đứng lùi lại chụp **1 Ảnh Bối cảnh (`Photo CTX`)**.
     - App tự động tạo Vùng hư hỏng `Z-01` và chốt Grade Burland sơ bộ ngay dưới hình.
     - Surveyor chạm trực tiếp lên bức ảnh để thả ghim các vết nứt `D-01`, `D-02`...
     - Surveyor bấm vào từng ghim, tiến lại gần đặt thước đo khe nứt (Crack Scale Card) và chụp **Ảnh Cận cảnh (`Photo CU`)**, nhập bề rộng $w_{\max}$ (mm), chiều dài (mm), dạng nứt.
  4. **Bước 4 (Đo lún nghiêng):** Surveyor nhập thông số nghiêng nhà X/Y %, nghiêng sàn %, võng dầm/sàn.
  5. **Bước 5 (Phạm vi tiếp cận):** Xác nhận các khu vực đã khảo sát được và lý do nếu bị hạn chế.
  6. **Bước 6 (Kiểm tra chất lượng Data Gate):** App tự động kiểm tra xem đã đủ bản vẽ phác thảo chưa và có ghim $D-xx$ nào bị thiếu ảnh cận cảnh không.
  7. **Bước 7 (Tự động tính ECS & VI):** App tự động quy đổi điểm $E1 \to E5$ (Bảng ECS) và điểm $V3, V5$ (Chỉ số VI). Surveyor kéo thanh trượt Slider 1-4 cho các tiêu chí VI còn lại.
  8. **Bước 8 (Tổng hợp kết luận):** App xuất màn hình Dashboard tóm tắt toàn bộ chỉ số rủi ro.
  9. **Bước 9 (Ký số xác nhận):** Surveyor ký tên, Người kiểm tra ký tên, và Chủ nhà ký ngón tay trực tiếp trên màn hình cảm ứng xoay ngang toàn màn hình.
- **Luồng ngoại lệ (Alternative Flow):**
  - *Rớt mạng 5G:* App tự động lưu nháp 3 giây/lần vào SQLite/IndexedDB và lưu vào Hàng đợi Đồng bộ ngầm (Sync Queue). Khi có mạng lại, hệ thống tự động đẩy dữ liệu về Server.

---

### USE CASE 03: GHIM KHUYẾT TẬT TRÊN BẢN VẼ TAY (INTERACTIVE SKETCH PINNING)

- **Mục đích:** Đặt các ghim khuyết tật $D-01, D-02\dots$ lên sơ đồ mặt bằng phác thảo để định vị không gian.
- **Tác nhân:** Surveyor.
- **Luồng sự kiện chính:**
  1. Surveyor dùng giấy A4 vẽ phác thảo mặt bằng phòng/tầng và các vết nứt.
  2. Surveyor dùng App chụp ảnh tờ giấy phác thảo đó (`Damage Map / Sketch`).
  3. Màn hình chỉnh sửa ảnh mở ra, hỗ trợ thao tác phóng to 300% (Pinch-to-Zoom).
  4. Surveyor chạm ngón tay vào vị trí tương ứng trên ảnh mặt bằng để thả các điểm ghim `D-01`, `D-02`...
  5. Nút ghim tự động đổi màu theo độ nguy hiểm (🟢 Xanh: Nứt nhẹ <1mm, 🟡 Vàng: Nứt vừa 1-5mm, 🔴 Đỏ: Nứt nguy hiểm >5mm hoặc nứt kết cấu).

---

### USE CASE 04: THẨM ĐỊNH HỒ SƠ & SOI VẠCH THƯỚC TRÊN WEB PORTAL (SPLIT-PANE AUDIT)

- **Mục đích:** Zone Admin và Đại diện Nhà thầu thi công thẩm định tính chính xác của hồ sơ hiện trường trước khi ký duyệt.
- **Tác nhân (Actor):** Zone Admin, Contractor, Auditor.
- **Luồng sự kiện chính:**
  1. Đăng nhập Web Portal, chọn danh sách hồ sơ khảo sát ở trạng thái `SUBMITTED`.
  2. Mở màn hình thẩm định dạng **Chia đôi Đối soát (Split-Pane)**:
     - *Nửa bên trái:* Hiển thị bản vẽ mặt bằng có các ghim $D-01, D-02\dots$
     - *Nửa bên phải:* Chi tiết thông số vết nứt và Cặp ảnh CTX (Bối cảnh) + CU (Cận cảnh).
  3. Kỹ sư rê chuột lên bức ảnh Cận cảnh (`Photo CU`) để kích hoạt **Kính lúp Phóng to 400% (Zoom Loupe)**, đọc rõ từng vạch milimet trên thước đo áp sát vết nứt.
  4. Kỹ sư kiểm tra **Radar cảnh báo GPS**: Hệ thống đối soát vị trí GPS lúc chụp ảnh với tâm nhà. Nếu khoảng cách $>50\text{ m}$, viền nhấp nháy đỏ cảnh báo gian lận.
  5. Nếu dữ liệu chuẩn xác, Kỹ sư bấm phím tắt `A` (Approve) hoặc nút **"Phê duyệt & Ký số"**.
  6. Nếu dữ liệu bị mờ/thiếu, Kỹ sư bấm phím tắt `R` (Reject), nhập lý do trả về và gửi yêu cầu Surveyor khảo sát lại.

---

### USE CASE 05: KÝ SỐ LAI 3 BÊN VÀ XUẤT BÁO CÁO PHÁP LÝ (HYBRID SIGNING & REPORTING)

- **Mục đích:** Chốt hồ sơ pháp lý hoàn chỉnh có đủ chữ ký của các bên liên quan phục vụ làm căn cứ đền bù / giải tỏa / đối chiếu bồi thường về sau.
- **Tác nhân:** Surveyor, Chủ nhà, Zone Admin, Contractor, Local Official.
- **Luồng sự kiện chính:**
  1. **Ký số tầng 1 (Tại hiện trường - Mobile):** Surveyor và Chủ hộ ký ngón tay trên điện thoại (được đóng dấu Watermark GPS + Timestamp + Hash chữ ký).
  2. **Ký số tầng 2 (Tại văn phòng - Web):** Zone Admin, Nhà thầu thi công và Đại diện UBND Phường/Tổ dân phố đăng nhập tài khoản Web Portal ký xác nhận điện tử.
  3. **Xuất báo cáo pháp lý:**
     - Sau khi đủ chữ ký, hệ thống tự động khóa hồ sơ (Read-Only) để chống chỉnh sửa (Chain of Custody).
     - Hệ thống xuất file Báo cáo chuẩn **PDF/A Pháp lý** có chứa đầy đủ thông số ECS, VI, hình ảnh watermark và chữ ký 3 bên.
     - Đồng thời, hệ thống tự động cập nhật đường ranh đa giác (Polygon Footprint) của công trình vừa khảo sát lên **Lớp Bản đồ GIS Quy hoạch**.

---

## 3. TỔNG KẾT BÀN GIAO Dev (DEV HANDOFF CHECKLIST)

- [x] **SURVEY_QUESTIONS.md:** Bộ câu hỏi & Biểu mẫu Khảo sát Hợp nhất 9 Bước.
- [x] **ROLES_AND_USE_CASES.md:** Ma trận Phân quyền 5 Vai trò & 5 Use Case cốt lõi.
- [x] **PROJECT_REQUIREMENT.md:** Tài liệu Đặc tả Yêu cầu Hệ thống PWA & Web Admin.
