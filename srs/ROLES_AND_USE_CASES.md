# Đặc tả Phân quyền & Kịch bản Sử dụng (SRS - Roles, Permissions & Use Cases)

> Tài liệu đặc tả chuẩn hóa Ma trận Phân quyền (RBAC) 4 Vai trò cốt lõi và Chi tiết các Kịch bản Sử dụng (Use Cases) cho Hệ thống Khảo sát Hiện trạng Công trình Metro 2.

---

## 1. MA TRẬN PHÂN QUYỀN VÀ NỀN TẢNG (ROLES & PERMISSION MATRIX)

Hệ thống áp dụng mô hình kiểm soát truy cập dựa trên vai trò **RBAC (Role-Based Access Control)** được chuẩn hóa thành 4 vai trò chính:

### 1.1. Danh sách 4 Vai trò Cốt lõi (Role Descriptions)

| Mã Vai trò | Tên Vai trò | Nền tảng sử dụng | Mô tả chức năng & Trách nhiệm chính |
| :---: | :--- | :---: | :--- |
| **`SUPER_ADMIN`** | Quản trị viên Cấp cao | Web Admin | Quản lý hệ thống, quản lý tài khoản, cấu hình lớp GIS Metro 2, xem Executive Master Dashboard toàn tuyến. (*Lưu ý: Quy tắc ma trận ECS, VI, Burland Grade được cố định theo chuẩn mẫu dự án gốc*). |
| **`ZONE_ADMIN`** | Quản lý Phân khu | Web Admin | Quản lý Phân khu/Ga. Phân công task, xem Dashboard thống kê công việc (Báo cáo đã xong, duyệt, chờ duyệt) & thống kê ngày làm việc/chấm công của Surveyor; thẩm định hồ sơ Split-Pane, phê duyệt/trả về và thực hiện quyền Kỹ sư. |
| **`SURVEYOR`** | Cán bộ Khảo sát Hiện trường | Mobile PWA / App | Check-in chấm công hiện trường (GPS + khai báo người đi cùng), thực hiện thu thập dữ liệu 9 bước hợp nhất để lập Báo cáo Hiện trạng, thả ghim khuyết tật $D-xx$, lấy chữ ký chủ hộ, đồng bộ offline. |
| **`CONTRACTOR`** | Khách vãng lai / Đơn vị quan sát | Web Viewer (Public/Private Link) | Truy cập dưới dạng Khách (Guest) qua link chia sẻ (có passcode/token). Xem bản đồ GIS quy hoạch các lô đất dự án Metro 2, theo dõi tiến độ công trình (lô nào đã xong), xem thông tin chi tiết và báo cáo đã duyệt của các lô. |

---

### 1.2. Ma trận Chi tiết Quyền hạn (Permissions Matrix)

| Chức năng / Hành động Hệ thống | SUPER_ADMIN | ZONE_ADMIN | SURVEYOR | CONTRACTOR / GUEST |
| :--- | :---: | :---: | :---: | :---: |
| **Quản lý Tài khoản & Phân quyền User** | Full | Xem | Không | Không |
| **Quản lý Lớp GIS Metro 2 (Ranh GPMB, Tim tuyến)** | Full | Xem | Xem | Xem |
| **Phân công Task Khảo sát (Assign Task)** | Full | Full | Không | Không |
| **Dashboard Thống kê Tiến độ & Chấm công** | Full (Toàn tuyến) | Full (Phân khu) | Không | Không |
| **Check-in Chấm công Hiện trường (Kèm Người đi cùng)** | Không | Xem | Full | Không |
| **Lập Báo cáo Khảo sát Hiện trạng (9 Bước)** | Không | Không | Full | Không |
| **Thả Ghim Khuyết tật $D-xx$ trên Ảnh bối cảnh** | Không | Không | Full | Không |
| **Lấy Chữ ký Điện tử Chủ hộ (Mobile E-Sign)** | Không | Không | Full | Không |
| **Thẩm định Hồ sơ Split-Pane (Kính lúp 400%)** | Full | Full | Không | Xem |
| **Phê duyệt (Approve) / Trả về (Reject) Báo cáo** | Full | Full | Không | Không |
| **Quyền Can thiệp Kỹ sư (Engineering Judgement)** | Full | Full | Không | Không |
| **Xem Bản đồ Quy hoạch các Lô & Trạng thái Khảo sát** | Full | Full | Full | Full (Read-Only) |
| **Xuất Báo cáo Pháp lý (PDF/A)** | Full | Full | Xem | Xem (Được phép) |

---

## 2. ĐẶC TẢ CHI TIẾT CHỨC NĂNG TỪNG VAI TRÒ (DETAILED ROLE SPECIFICATIONS)

### 2.1. Quản trị viên Cấp cao (`SUPER_ADMIN`)
- **Quản lý Hệ thống & Tài khoản:** Tạo mới, khóa, phân quyền cho các tài khoản `ZONE_ADMIN`, `SURVEYOR`.
- **Quản lý Dữ liệu GIS Quy hoạch:** Quản lý các lớp bản đồ GIS (GeoJSON/KML) chứa đường tim tuyến Metro 2, ranh giới giải phóng mặt bằng, ranh giới 11 nhà ga và các thửa đất/lô đất.
- **Executive Master Dashboard:** Thống kê tổng quan toàn tuyến (~7.000 căn): Số lượng đã khảo sát, số lượng đã duyệt, số lượng công trình rủi ro `CRITICAL`.
- **Hệ thống Quy chuẩn Cố định:** Áp dụng cố định bộ quy tắc ma trận chấm điểm ECS (E1-E5), VI (V1-V5) và phân hạng Burland theo mẫu gốc dự án ban đầu.
- **Nhật ký Hệ thống (Audit Log & Chain of Custody):** Truy vết lịch sử mọi thao tác đăng nhập, sửa đổi dữ liệu, phê duyệt và xuất báo cáo.

### 2.2. Quản lý Phân khu (`ZONE_ADMIN`)
- **Quản lý Task theo Phân khu:** Chọn Phân khu/Nhà ga phụ trách (VD: *Ga S9 - Bà Quẹo*), khoanh vùng công trình trên bản đồ GIS và phân công cho `SURVEYOR`.
- **Dashboard Thống kê Công việc & Chấm công:**
  - Lọc theo khoảng thời gian (ngày, tuần, tháng).
  - Thống kê chi tiết số lượng báo cáo: **Đã hoàn thành**, **Đã phê duyệt**, **Đang chờ duyệt**, **Trả về**.
  - Thống kê hiệu suất làm việc & số ngày chấm công của từng `SURVEYOR` (tổng báo cáo thực hiện, số ngày check-in hiện trường, tỷ lệ hồ sơ đạt chuẩn).
- **Thẩm định Hồ sơ Hiện trường:** 
  - Xem chi tiết Báo cáo khảo sát 9 bước gửi về từ Surveyor.
  - Màn hình đối soát chia đôi (Split-Pane View), dùng kính lúp 400% kiểm tra vạch mm trên ảnh cận cảnh `Photo CU`, đối soát vị trí ghim khuyết tật $D-xx$.
  - Phê duyệt (`Approve`) hoặc Trả về (`Reject`) yêu cầu Surveyor khảo sát bổ sung.
- **Thực hiện Quyền Kỹ sư (Engineering Judgement):** Có quyền Nâng/Hạ phân hạng ECS/VI nếu có căn cứ kỹ thuật (kèm ô bắt buộc nhập lý do; bị khoá không cho hạ hạng nếu có cờ `Critical`).

### 2.3. Cán bộ Khảo sát Hiện trường (`SURVEYOR`)
- **Check-in Chấm công Hiện trường (Timekeeping Check-in):**
  - Thực hiện Check-in khi đến vị trí công trình/phân khu.
  - Tự động lưu tọa độ GPS, ngày giờ real-time và chụp ảnh định danh selfie/hiện trường.
  - Cho phép nhập/chọn danh sách **Người đi cùng (Accompanying Team Members)** nếu đi khảo sát theo tổ đội. Dữ liệu này được đẩy về cho Zone Admin theo dõi thống kê ngày làm việc.
- **Đăng nhập & Đồng bộ Offline (Mobile App / PWA):** Xem danh sách task được gán. Hỗ trợ tự động lưu nháp 3 giây/lần và đồng bộ ngoại tuyến khi mất kết nối mạng.
- **Lập Báo cáo Khảo sát Hiện trạng (Luồng 9 bước Hợp nhất):**
  - **Chụp 4 ảnh định danh:** Chụp ảnh góc $P-01 \to P-04$ có Watermark GPS & Thời gian thực.
  - **Phỏng vấn chủ hộ:** Thu thập công năng, kết cấu, loại móng (CAT 1-5), lịch sử cơi nới/sửa chữa và yếu tố nhạy cảm.
  - **Chụp ảnh Bối cảnh & Thả ghim Real-Time:** 1 Ảnh bối cảnh (`Photo CTX`) = 1 Vùng `Z-01`. Chạm tay thả ghim $D-01, D-02\dots$ trực tiếp trên hình.
  - **Chụp Cận cảnh có thước:** Tiến lại gần ghim $D-xx$ đặt thước đo áp sát khe nứt và chụp Ảnh Cận cảnh (`Photo CU`), nhập bề rộng max $w_{\max}$, chiều dài $L$.
  - **Đo lún nghiêng:** Nhập chỉ số nghiêng X/Y%, nghiêng sàn, võng dầm.
- **Lấy Chữ ký Điện tử Chủ hộ:** Mở bảng ký cảm ứng toàn màn hình xoay ngang để Chủ hộ và Surveyor ký xác nhận hoàn thành báo cáo.

### 2.4. Khách vãng lai / Đơn vị quan sát (`CONTRACTOR / GUEST`)
- **Chế độ Truy cập Khách (Guest Mode & Link Sharing):**
  - Được truy cập hệ thống qua đường link công khai hoặc link chia sẻ giới hạn (Private Link kèm Passcode/Token bảo mật).
  - Không cần quy trình phê duyệt hồ sơ phức tạp hay ký số.
- **Xem Bản đồ Quy hoạch GIS & Trạng thái Lô đất:**
  - Trực quan hóa bản đồ quy hoạch dự án Metro 2 với các lô đất/thửa đất được mã hóa màu theo trạng thái: 🟢 *Đã khảo sát & duyệt*, 🟡 *Đang khảo sát*, ⚪ *Chưa khảo sát*.
- **Tra cứu Thông tin & Xem Báo cáo Lô đất:**
  - Nhấp vào từng lô đất/công trình trên bản đồ để xem thông tin tổng quan hiện trạng (Loại kết cấu, số tầng, phân hạng ECS/VI).
  - Tải về hoặc xem trực tuyến file Báo cáo Khảo sát Hiện trạng đã được duyệt (Read-only format).

---

## 3. CHI TIẾT CÁC KỊCH BẢN SỬ DỤNG (USE CASE SPECIFICATIONS)

---

### USE CASE 01: DASHBOARD THỐNG KÊ & PHÂN CÔNG TASK PHÂN KHU (ZONE ANALYTICS & TASK ASSIGNMENT)
- **Tác nhân:** `ZONE_ADMIN`, `SUPER_ADMIN`.
- **Mục tiêu:** Thống kê tiến độ báo cáo, quản lý chấm công Surveyor và phân công task khảo sát theo phân khu.
- **Luồng thực hiện:**
  1. `ZONE_ADMIN` đăng nhập Web Portal, chọn Phân khu/Nhà ga phụ trách.
  2. **Xem Dashboard thống kê:** 
     - Lựa chọn khoảng thời gian (Từ ngày... Đến ngày...).
     - Quan sát biểu đồ tổng hợp: Báo cáo hoàn thành, Đã duyệt, Chờ duyệt, Trả về.
     - Quan sát bảng thống kê Surveyor: Danh sách Surveyor, số ngày check-in chấm công, tổng số báo cáo đã gửi, tỷ lệ hồ sơ đạt yêu cầu.
  3. **Phân công Task:**
     - Xem bản đồ GIS phân khu, khoanh vùng hoặc chọn các lô đất chưa khảo sát.
     - Gán task cho `SURVEYOR` tương ứng.
     - Bấm **"Phân công Task"**. Thông báo Real-time tự động gửi đến Mobile PWA của Surveyor.

---

### USE CASE 02: CHECK-IN CHẤM CÔNG & LẬP BÁO CÁO KHẢO SÁT HỆN TRƯỜNG (FIELD TIMEKEEPING & SURVEY REPORTING)
- **Tác nhân:** `SURVEYOR`, Chủ sở hữu công trình.
- **Mục tiêu:** Thực hiện check-in chấm công ngày làm việc và tiến hành thu thập số liệu hiện trạng lập Báo cáo Khảo sát.
- **Luồng thực hiện:**
  1. **Bước 1: Check-in Chấm công (Timekeeping):**
     - `SURVEYOR` mở PWA tại hiện trường, bấm **"Check-in Chấm công"**.
     - Hệ thống định vị GPS real-time, chụp 1 ảnh selfie/hiện trường.
     - Điền danh sách **Người đi cùng** (nếu có tổ đội 2-3 người). Bấm **"Xác nhận Check-in"**.
  2. **Bước 2: Chụp 4 ảnh định danh:** Chụp ảnh góc $P-01 \to P-04$ có Watermark GPS & Thời gian.
  3. **Bước 3: Phỏng vấn chủ hộ:** Thu thập thông tin móng (CAT 1-5), kết cấu, lịch sử cơi nới/sửa chữa.
  4. **Bước 4: Chụp bối cảnh & Thả ghim $D-xx$:** Chụp 1 ảnh bối cảnh mảng tường (`Photo CTX`) ➔ Tự động tạo Vùng `Z-01` ➔ Chạm thả ghim $D-01, D-02\dots$ ➔ Tiến lại gần chụp ảnh Cận cảnh (`Photo CU`) có thước đo khe nứt.
  5. **Bước 5: Đo lún nghiêng:** Nhập chỉ số nghiêng X/Y%, nghiêng sàn, võng dầm.
  6. **Bước 6: Auto Calculation & Slider:** Hệ thống tự động quy đổi điểm ECS ($E1 \to E5$) và điểm VI ($V3, V5$). `SURVEYOR` kéo thanh trượt Slider 1-4 có Note mô tả cho các tiêu chí VI còn lại.
  7. **Bước 7: Ký xác nhận Báo cáo:** `SURVEYOR` ký tên và cho Chủ hộ ký ngón tay trên bảng ký xoay ngang. Báo cáo hoàn chỉnh được tự động gửi về hệ thống (hoặc lưu nháp đồng bộ khi có mạng).

---

### USE CASE 03: GHIM KHUYẾT TẬT TRÊN SƠ ĐỒ PHÁC THẢO TAY (INTERACTIVE DAMAGE PINNING)
- **Tác nhân:** `SURVEYOR`.
- **Mục tiêu:** Trực quan hóa các điểm tổn thương $D-xx$ trên bản vẽ phác thảo tay mặt bằng/mặt đứng công trình.
- **Luồng thực hiện:**
  1. `SURVEYOR` chụp ảnh tờ giấy vẽ phác thảo tay mặt bằng (`Damage Map / Sketch`).
  2. Màn hình PWA hỗ trợ phóng to 300% (Pinch-to-Zoom).
  3. `SURVEYOR` chạm ngón tay để thả các điểm ghim $D-01, D-02\dots$ 
  4. Nút ghim tự động đổi màu theo độ rộng khe nứt (🟢 Green <1mm, 🟡 Yellow 1-5mm, 🔴 Red >5mm hoặc nứt kết cấu).

---

### USE CASE 04: THẨM ĐỊNH HỒ SƠ & PHÊ DUYỆT BÁO CÁO (SPLIT-PANE AUDIT & APPROVAL)
- **Tác nhân:** `ZONE_ADMIN`.
- **Mục tiêu:** Đối soát tính chính xác của Báo cáo khảo sát từ hiện trường gửi về và thực hiện phê duyệt.
- **Luồng thực hiện:**
  1. `ZONE_ADMIN` đăng nhập Web Portal, mở màn hình **Chia đôi Đối soát (Split-Pane)**. Nửa trái xem sơ đồ phác thảo có ghim $D-xx$, nửa phải xem cặp ảnh CTX+CU.
  2. Rê chuột lên ảnh cận cảnh `Photo CU` kích hoạt **Kính lúp 400%** soi vạch milimet trên thước đo áp sát vết nứt.
  3. Kiểm tra Radar GPS cảnh báo sai lệch $>50\text{ m}$.
  4. Xem các điểm số ECS, VI. Nếu cần can thiệp kỹ thuật, nhập lý do vào ô **Engineering Judgement**.
  5. Bấm phím tắt `A` (**Phê duyệt Báo cáo**) hoặc phím `R` (**Trả về** kèm lý do yêu cầu khảo sát lại).

---

### USE CASE 05: TRUY CẬP VÀ XEM BẢN ĐỒ QUY HOẠCH DÀNH CHO KHÁCH (GUEST PUBLIC GIS & PARCEL MONITORING)
- **Tác nhân:** `CONTRACTOR` / Khách vãng lai (Guest Viewer).
- **Mục tiêu:** Tra cứu thông tin quy hoạch, vị trí các lô đất/công trình và theo dõi tiến độ hoàn thành khảo sát trên GIS.
- **Luồng thực hiện:**
  1. Khách truy cập vào hệ thống qua URL Public Link hoặc Shared Private Link (nhập passcode bảo mật nếu có).
  2. Màn hình hiển thị Bản đồ GIS tương tác toàn khu vực dự án Metro 2.
  3. Quan sát các thửa đất/lô đất được tô màu thể hiện trạng thái khảo sát (Hoàn thành / Chưa hoàn thành).
  4. Nhấp chọn 1 lô đất bất kỳ để xem thông tin tổng quan (Số nhà, diện tích, kết cấu, phân hạng rủi ro).
  5. Nếu lô đất đã hoàn thành và được phê duyệt, bấm nút **"Xem Báo cáo Hiện trạng"** để đọc trực tuyến hoặc tải file PDF/A báo cáo.
