# Đặc tả Phân quyền & Kịch bản Sử dụng (SRS - Roles, Permissions & Use Cases)

> Tài liệu đặc tả chuẩn hóa Ma trận Phân quyền (RBAC) 4 Vai trò cốt lõi và Chi tiết các Kịch bản Sử dụng (Use Cases) cho Hệ thống Khảo sát Hiện trạng Công trình Metro 2.

---

## 1. MA TRẬN PHÂN QUYỀN VÀ NỀN TẢNG (ROLES & PERMISSION MATRIX)

Hệ thống áp dụng mô hình kiểm soát truy cập dựa trên vai trò **RBAC (Role-Based Access Control)** được chuẩn hóa thành 4 vai trò chính:

### 1.1. Danh sách 4 Vai trò Cốt lõi (Role Descriptions)

| Mã Vai trò | Tên Vai trò | Nền tảng sử dụng | Mô tả chức năng & Trách nhiệm chính |
| :---: | :--- | :---: | :--- |
| **`SUPER_ADMIN`** | Quản trị viên Cấp cao | Web Admin | Quản lý hệ thống, quản lý tài khoản, cấu hình lớp GIS Metro 2, xem Executive Master Dashboard toàn tuyến, **xuất Bộ Hồ sơ Báo cáo Tổng hợp toàn tuyến (~7.000 căn)** cho Chủ đầu tư MAUR/Nhà thầu TBM. |
| **`ZONE_ADMIN`** | Quản lý Phân khu | Web Admin | Quản lý Phân khu/Ga. Phân công task, xem Dashboard thống kê công việc & chấm công Surveyor; thẩm định hồ sơ Split-Pane, phê duyệt/trả về, thực hiện quyền Kỹ sư, **xuất Bộ Hồ sơ Báo cáo Tổng hợp theo Phân khu/Nhà ga** theo tuần/tháng. |
| **`SURVEYOR`** | Cán bộ Khảo sát Hiện trường | Mobile PWA / App | Check-in chấm công hiện trường (GPS + khai báo người đi cùng), thực hiện thu thập dữ liệu 9 bước hợp nhất, đối soát & vẽ lại ranh thửa biến động (Bước 5), chụp ảnh chữ ký xác nhận của cán bộ/chủ hộ, đồng bộ offline. |
| **`CONTRACTOR`** | Khách vãng lai / Đơn vị quan sát | Web Viewer (Public/Private Link) | Truy cập dưới dạng Khách (Guest) qua link chia sẻ (có passcode/token). Xem bản đồ GIS quy hoạch phân lô, theo dõi tiến độ khảo sát, xem thông tin lô đất và **tải các Bộ Báo cáo đã công bố** (Read-Only). |

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
| **Vẽ lại Ranh Thửa Đất Biến động (Bước 5)** | Không | Phê duyệt | Đề xuất / Vẽ | Không |
| **Chụp Ảnh Chữ ký / Ảnh Cán bộ & Chủ hộ Xác nhận** | Không | Không | Full | Không |
| **Thẩm định Hồ sơ Split-Pane (Kính lúp 400%)** | Full | Full | Không | Xem |
| **Phê duyệt (Approve) / Trả về (Reject) Báo cáo** | Full | Full | Không | Không |
| **Quyền Can thiệp Kỹ sư (Engineering Judgement)** | Full | Full | Không | Không |
| **Xem Bản đồ Quy hoạch các Lô & Trạng thái Khảo sát** | Full | Full | Full | Full (Read-Only) |
| **Xuất Báo cáo Pháp lý Đơn lẻ (PDF/A)** | Full | Full | Xem | Xem (Được phép) |
| **Xuất Bộ Hồ sơ Báo cáo Tổng hợp (`CompiledReportBatch`)** | Full (Toàn tuyến) | Full (Phân khu) | Không | Tải file công bố |

---

## 2. ĐẶC TẢ CHI TIẾT CHỨC NĂNG TỪNG VAI TRÒ (DETAILED ROLE SPECIFICATIONS)

### 2.1. Quản trị viên Cấp cao (`SUPER_ADMIN`)
- **Quản lý Hệ thống & Tài khoản:** Tạo mới, khóa, phân quyền cho các tài khoản `ZONE_ADMIN`, `SURVEYOR`.
- **Quản lý Dữ liệu GIS Quy hoạch:** Quản lý các lớp bản đồ GIS (GeoJSON/KML) chứa đường tim tuyến Metro 2, ranh giới giải phóng mặt bằng, ranh giới 11 nhà ga và các thửa đất/lô đất.
- **Executive Master Dashboard:** Thống kê tổng quan toàn tuyến (~7.000 căn): Số lượng đã khảo sát, số lượng đã duyệt, số lượng công trình rủi ro `CRITICAL`.
- **Xuất Bộ Hồ sơ Báo cáo Toàn Tuyến (Master Cadastral Dossier):** Đóng gói toàn bộ báo cáo đã duyệt của toàn tuyến hoặc gói thầu liên phân khu (Gói CP2, CP3) dạng PDF Book / ZIP Archive phục vụ bàn giao mốc pháp lý cho Nhà thầu đào hầm TBM.
- **Nhật ký Hệ thống (Audit Log & Chain of Custody):** Truy vết lịch sử mọi thao tác đăng nhập, sửa đổi dữ liệu, phê duyệt và xuất báo cáo.

### 2.2. Quản lý Phân khu (`ZONE_ADMIN`)
- **Quản lý Task theo Phân khu:** Chọn Phân khu/Nhà ga phụ trách (VD: *Ga S9 - Bà Quẹo*), khoanh vùng công trình trên bản đồ GIS và phân công cho `SURVEYOR`.
- **Dashboard Thống kê Công việc & Chấm công:**
  - Lọc theo khoảng thời gian (ngày, tuần, tháng).
  - Thống kê chi tiết số lượng báo cáo: **Đã hoàn thành**, **Đã phê duyệt**, **Đang chờ duyệt**, **Trả về**.
  - Thống kê hiệu suất làm việc & số ngày chấm công của từng `SURVEYOR`.
- **Thẩm định Hồ sơ Hiện trường & Duyệt Biến động Ranh Thửa:** 
  - Xem chi tiết Báo cáo khảo sát 9 bước gửi về từ Surveyor.
  - Màn hình đối soát chia đôi (Split-Pane View), dùng kính lúp 400% kiểm tra vạch mm trên ảnh cận cảnh `Photo CU`, đối soát vị trí ghim khuyết tật $D-xx$.
  - Đối soát và phê duyệt các đề xuất biến động ranh thửa (Tách/Gộp thửa) do Surveyor vẽ tại hiện trường.
  - Phê duyệt (`Approve`) hoặc Trả về (`Reject`) hồ sơ.
- **Xuất Bộ Hồ sơ Báo cáo Phân Khu (Zone Cadastral Dossier):** Xuất toàn bộ các thửa đất đã duyệt trong phân khu phụ trách theo tuần/tháng để báo cáo cho Ban QLĐS (MAUR).
- **Thực hiện Quyền Kỹ sư (Engineering Judgement):** Có quyền Nâng/Hạ phân hạng ECS/VI nếu có căn cứ kỹ thuật (bị khoá không cho hạ hạng nếu có cờ `Critical`).

### 2.3. Cán bộ Khảo sát Hiện trường (`SURVEYOR`)
- **Check-in Chấm công Hiện trường (Timekeeping Check-in):** Check-in GPS real-time, chụp ảnh selfie/hiện trường, khai báo danh sách người đi cùng.
- **Đăng nhập & Đồng bộ Offline (Mobile App / PWA):** Tự động lưu nháp 3 giây/lần và đồng bộ ngoại tuyến.
- **Lập Báo cáo Khảo sát Hiện trạng (Luồng 9 bước Hợp nhất):**
  - **Bước 1:** Chụp 4 ảnh định danh $P-01 \to P-04$ có Watermark GPS & Thời gian thực.
  - **Bước 2:** Phỏng vấn chủ hộ thu thập công năng, móng (CAT 1-5), kết cấu, lịch sử cơi nới/sửa chữa.
  - **Bước 3:** Khảo sát từng tầng: 1 Ảnh bối cảnh (`Photo CTX`) = 1 Vùng `Z-xx` ➔ Thả ghim $D-xx$ ➔ Chụp cận cảnh (`Photo CU`) có thước đo khe nứt.
  - **Bước 4:** Đo lún nghiêng X/Y%, nghiêng sàn, võng dầm.
  - **Bước 5:** Xác nhận phạm vi đã đi và **Đối soát / Vẽ lại Ranh Thửa Đất trên GIS** nếu có biến động tách/gộp thửa.
  - **Bước 6 - 9:** Tự động tính điểm ECS/VI, tổng hợp kiến nghị và chụp ảnh chữ ký/xác nhận của cán bộ & chủ hộ.

### 2.4. Khách vãng lai / Đơn vị quan sát (`CONTRACTOR / GUEST`)
- **Chế độ Truy cập Khách (Guest Mode & Link Sharing):** Truy cập qua đường link chia sẻ (Public Link hoặc Private Link kèm passcode).
- **Xem Bản đồ Quy hoạch GIS & Trạng thái Lô đất:** Quan sát trực quan bản đồ phân lô, xem mã màu trạng thái khảo sát (Đã xong / Chưa xong).
- **Tra cứu Thông tin Lô đất & Tải Báo cáo:** Xem thông tin tổng quan, xem báo cáo đơn lẻ trực tuyến hoặc tải về các Bộ Báo cáo Tổng hợp đã được xuất bản (Read-only format).

---

## 3. CHI TIẾT CÁC KỊCH BẢN SỬ DỤNG (USE CASE SPECIFICATIONS)

---

### USE CASE 01: DASHBOARD THỐNG KÊ & PHÂN CÔNG TASK PHÂN KHU (ZONE ANALYTICS & TASK ASSIGNMENT)
- **Tác nhân:** `ZONE_ADMIN`, `SUPER_ADMIN`.
- **Mục tiêu:** Thống kê tiến độ báo cáo, quản lý chấm công Surveyor và phân công task khảo sát theo phân khu.
- **Luồng thực hiện:**
  1. `ZONE_ADMIN` đăng nhập Web Portal, chọn Phân khu/Nhà ga phụ trách.
  2. **Xem Dashboard thống kê:** Lọc theo khoảng thời gian, xem biểu đồ báo cáo hoàn thành/duyệt/chờ duyệt và bảng chấm công Surveyor.
  3. **Phân công Task:** Khoanh vùng thửa đất trên GIS, gán task cho `SURVEYOR` phụ trách. Thông báo tự động gửi đến Mobile PWA của Surveyor.

---

### USE CASE 02: CHECK-IN CHẤM CÔNG & LẬP BÁO CÁO KHẢO SÁT HỆN TRƯỜNG (FIELD TIMEKEEPING & SURVEY REPORTING)
- **Tác nhân:** `SURVEYOR`, Chủ sở hữu công trình.
- **Mục tiêu:** Check-in chấm công ngày làm việc và tiến hành khảo sát thực địa (Phase 1 Baseline hoặc Phase 2 Pre-construction Delta).
- **Luồng thực hiện Khảo sát Giai đoạn 1 (Phase 1 Baseline):**
  1. **Check-in Chấm công:** Bắt GPS, chụp ảnh selfie/hiện trường, điền danh sách người đi cùng.
  2. **Chụp 4 ảnh định danh ($P-01 \to P-04$):** Chụp có Watermark GPS & Thời gian (Hỗ trợ AI đa giác đứng và phân tầng).
  3. **Phỏng vấn chủ hộ:** Thu thập thông tin móng (CAT 1-5), kết cấu, lịch sử sự cố.
  4. **Khảo sát từng tầng & Thả ghim $D-xx$:** Chụp ảnh bối cảnh `Photo CTX` (tự tạo Vùng `Z-xx`) ➔ Chạm thả ghim $D-xx$ ➔ Chụp cận cảnh `Photo CU` có thước đo khe nứt.
  5. **Đo lún nghiêng:** Nhập tỉ lệ nghiêng X/Y%, nghiêng sàn, võng dầm.
  6. **Xác nhận phạm vi & Vẽ lại ranh thửa GIS (Bước 5):** Sau khi đã đi hết các tầng, nếu phát hiện thửa bị tách làm 2 căn hoặc gộp thửa, dùng công cụ **Polygon Split/Edit Tool** vẽ lại ranh. Hệ thống tự động cấp mã mới từ dải số mở rộng (không làm xô lệch các thửa khác).
  7. **Auto Scoring & Chụp ảnh xác nhận:** Hệ thống tự động tính điểm ECS/VI. Cán bộ chụp ảnh chữ ký trên giấy hoặc ảnh cán bộ khảo sát / người kiểm tra tại hiện trường. Báo cáo hoàn chỉnh gửi về hệ thống.

- **Luồng thực hiện Khảo sát Giai đoạn 2 (Phase 2 Pre-Construction Delta Verification):**
  1. **Tự động Kế thừa & Đối soát theo Vị trí đứng:** Khi cán bộ chọn Tầng & Phòng đang đứng, PWA tự động `GET` danh sách các Vùng `Z-xx` của GĐ1 kèm ảnh `Photo CTX` và vị trí ghim $D-xx$ cũ.
  2. **Xử lý trên Vùng Hiện hữu (`Z-xx` cũ):**
     - Chạm ghim cũ $D-xx$: Đo lại $w_2, L_2$ ➔ Hệ thống tự tính biến thiên $\Delta w, \Delta L$ ➔ Chọn trạng thái (`Không đổi`, `Phát triển`, `Đã sửa`) ➔ Chụp ảnh $CU$ mới có thước đo.
     - Chấm thêm vết nứt mới: Chạm trực tiếp lên `Photo CTX` cũ để thả ghim mới màu đỏ $D-new$, nhập kích thước và chụp $CU$ có thước đo.
  3. **Mở rộng Khu vực / Vùng Mới Xuất Hiện (`Z-xx` mới):** Bấm `[+ Thêm Vùng Mới]` ➔ Hệ thống tạo `Z-new` ➔ Chụp `Photo CTX` mới ➔ Chấm các ghim $D-new$ mới và chụp $CU$ có thước đo.
  4. **Kiểm tra Checklist 10 Mục Phụ lục A, Tổng hợp Biến động & Ký tên 4 Bên:** Hệ thống tự động kiểm tra tính đầy đủ của hồ sơ, đối chiếu dữ liệu với GĐ1 và hỗ trợ ký số/chụp ảnh xác nhận 4 bên.

---

### USE CASE 03: GHIM KHUYẾT TẬT TRÊN SƠ ĐỒ PHÁC THẢO TAY (INTERACTIVE DAMAGE PINNING)
- **Tác nhân:** `SURVEYOR`.
- **Mục tiêu:** Trực quan hóa các điểm tổn thương $D-xx$ trên bản vẽ phác thảo tay mặt bằng/mặt đứng công trình.
- **Luồng thực hiện:**
  1. `SURVEYOR` chụp ảnh bản vẽ phác thảo tay (`Damage Map / Sketch`).
  2. Màn hình PWA hỗ trợ phóng to 300% (Pinch-to-Zoom).
  3. `SURVEYOR` chạm ngón tay để thả các điểm ghim $D-01, D-02\dots$ 
  4. Nút ghim tự động đổi màu theo độ rộng khe nứt (🟢 Green <1mm, 🟡 Yellow 1-5mm, 🔴 Red >5mm hoặc nứt kết cấu).

---

### USE CASE 04: THẨM ĐỊNH HỒ SƠ & PHÊ DUYỆT BÁO CÁO (SPLIT-PANE AUDIT & APPROVAL)
- **Tác nhân:** `ZONE_ADMIN`.
- **Mục tiêu:** Đối soát tính chính xác của Báo cáo khảo sát, duyệt biến động ranh thửa và phê duyệt báo cáo.
- **Luồng thực hiện:**
  1. `ZONE_ADMIN` đăng nhập Web Portal, mở màn hình **Chia đôi Đối soát (Split-Pane)**. Nửa trái xem sơ đồ phác thảo có ghim $D-xx$, nửa phải xem cặp ảnh CTX+CU.
  2. Rê chuột lên ảnh cận cảnh `Photo CU` kích hoạt **Kính lúp 400%** soi vạch milimet trên thước đo áp sát vết nứt.
  3. Nếu có biến động tách/gộp thửa, xem so sánh đa giác cũ/mới và bấm **"Duyệt Biến Động Thửa"**.
  4. Xem điểm số ECS, VI. Nếu cần can thiệp kỹ thuật, nhập lý do vào ô **Engineering Judgement**.
  5. Bấm phím tắt `A` (**Phê duyệt Báo cáo**) hoặc phím `R` (**Trả về** kèm lý do yêu cầu khảo sát lại).

---

### USE CASE 05: TRUY CẬP VÀ XEM BẢN ĐỒ QUY HOẠCH DÀNH CHO KHÁCH (GUEST PUBLIC GIS & PARCEL MONITORING)
- **Tác nhân:** `CONTRACTOR` / Khách vãng lai (Guest Viewer).
- **Mục tiêu:** Tra cứu thông tin quy hoạch, vị trí các lô đất và theo dõi tiến độ khảo sát trên GIS.
- **Luồng thực hiện:**
  1. Khách truy cập vào hệ thống qua Public Link hoặc Private Link (nhập passcode bảo mật nếu có).
  2. Màn hình hiển thị Bản đồ GIS tương tác toàn khu vực dự án Metro 2.
  3. Quan sát các thửa đất được tô màu thể hiện trạng thái khảo sát (Hoàn thành / Chưa hoàn thành).
  4. Nhấp chọn 1 lô đất bất kỳ để xem thông tin tổng quan và đọc trực tuyến hoặc tải file PDF/A báo cáo đã duyệt.

---

### USE CASE 06: XUẤT BỘ HỒ SƠ BÁO CÁO TỔNG HỢP PHÂN KHU & TOÀN TUYẾN (COMPILED CADASTRAL DOSSIER EXPORT)
- **Tác nhân:** `ZONE_ADMIN` (Phân khu), `SUPER_ADMIN` (Toàn tuyến), `CONTRACTOR` (Tải file đã công bố).
- **Mục tiêu:** Đóng gói và xuất khẩu bộ tài liệu báo cáo hàng loạt các thửa đất đã duyệt kèm sơ đồ GIS và bảng kê danh mục phục vụ bàn giao pháp lý.
- **Luồng thực hiện:**
  1. **Khởi tạo Đợt Xuất:**
     - `ZONE_ADMIN` (hoặc `SUPER_ADMIN`) truy cập mục **"Xuất Báo Cáo Hàng Loạt (Batch Export)"** trên Web Admin.
     - Lựa chọn phạm vi: Phân khu/Nhà ga hoặc Toàn tuyến.
     - Lựa chọn khoảng thời gian (Từ ngày... Đến ngày...).
     - Lựa chọn định dạng xuất: `PDF Book Compilation` (Sách báo cáo gộp trang) | `ZIP Archive` (Bộ file PDF/A riêng lẻ kèm Excel & GeoJSON).
  2. **Hệ thống Xử lý Thông minh:**
     - Tự động gom nhóm các thửa phát sinh do tách thửa (VD: `B-07001` tự động nằm liền sau thửa gốc `B-00002`).
     - Tạo Mục lục điện tử, Bản đồ GIS thu nhỏ của phân khu, Bảng kê danh mục thửa và Bảng tổng hợp rủi ro ECS/VI.
     - Đóng gói file và sinh mã băm kiểm tra tính toàn vẹn `checksumSha256`.
  3. **Tải về & Công bố:**
     - `ZONE_ADMIN` / `SUPER_ADMIN` tải file về phục vụ bàn giao cho Ban Quản lý Đường sắt Đô thị (MAUR) và Nhà thầu đào hầm TBM.
     - Bật cờ `isPublishedToGuests = true` để cho phép `CONTRACTOR / GUEST` tải về từ giao diện Web Viewer.
