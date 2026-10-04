# Đặc tả Phân quyền & Kịch bản Sử dụng (SRS - Roles, Permissions & Use Cases)

> [!IMPORTANT]
> **TÀI LIỆU ĐẶC TẢ PHÂN QUYỀN RBAC & CÁC KỊCH BẢN SỬ DỤNG KHỚP 100% VỚI HỢP ĐỒNG API:**
> Toàn bộ 4 vai trò người dùng (`SUPER_ADMIN`, `ZONE_ADMIN`, `SURVEYOR`, `CONTRACTOR_GUEST`), Ma trận phân quyền 10 nghiệp vụ, và 10 Kịch bản Sử dụng (Use Cases) đã được đồng bộ chuẩn xác với `srs/API_SPECIFICATION.md` và `srs/notchange/Business_Logic.md`.

---

## 1. MA TRẬN PHÂN QUYỀN VÀ NỀN TẢNG (ROLES & PERMISSION MATRIX)

Hệ thống áp dụng mô hình kiểm soát truy cập dựa trên vai trò **RBAC (Role-Based Access Control)** được chuẩn hóa thành 4 vai trò chính:

### 1.1. Danh sách 4 Vai trò Cốt lõi (Role Descriptions)

| Mã Vai trò | Tên Vai trò | Nền tảng sử dụng | Mô tả chức năng & Trách nhiệm chính |
| :---: | :--- | :--- :--- | :--- |
| **`SUPER_ADMIN`** | Quản trị viên Cấp cao Toàn tuyến | Web Admin | Quản lý toàn bộ hệ thống, quản lý vòng đời người dùng (tạo, sửa, đổi Ga, khóa, mở khóa, reset password, xóa), cấu hình lớp GIS Metro 2, xem Dashboard KPI 11 Ga toàn tuyến, **xuất Bộ Báo cáo Toàn tuyến 11 Ga (~7.000 căn)**, và giám sát lịch sử/thu hồi mẻ xuất. |
| **`ZONE_ADMIN`** | Quản lý Phân khu Ga | Web Admin | Quản lý Ga phụ trách. Phân công & điều chuyển task, giám sát & duyệt chấm công Surveyor (đối soát GPS & Selfie); thẩm định hồ sơ Split-Pane (Kính lúp 400% + Cờ Audit Flags), duyệt Tách thửa, phê duyệt/trả về báo cáo, thực hiện quyền Kỹ sư, và **xuất Báo cáo Chọn lọc theo Phân khu** (Theo ID chỉ định hoặc Theo ngày/tuần/tháng/rủi ro). |
| **`SURVEYOR`** | Cán bộ Khảo sát Hiện trường | Mobile PWA / App | Check-in chấm công GPS hiện trường, xem lịch sử chấm công cá nhân, quét cạn thửa đất liền kề (Ad-hoc Pick), ghi nhận vắng nhà (POSTPONED_ABSENT), thực hiện thu thập dữ liệu 9 bước hợp nhất (Phase 1 & Phase 2), đối soát & đề xuất tách thửa (Bước 5), nộp hồ sơ có chữ ký, đồng bộ offline. |
| **`CONTRACTOR`** | Nhà thầu & Khách Tra Cứu | Web Viewer (Share Link) | Truy cập qua link chia sẻ an toàn (Share Token + Passcode). Xem bản đồ GIS quy hoạch phân lô, xem tóm tắt thông số kết cấu và điểm ECS/VI, đọc trực tuyến và **tải các Bộ Báo cáo đã công bố** (Read-Only) kèm Checksum SHA-256. |

---

### 1.2. Ma trận Chi tiết Quyền hạn (Permissions Matrix)

| Chức năng / Hành động Hệ thống | SUPER_ADMIN | ZONE_ADMIN | SURVEYOR | CONTRACTOR / GUEST |
| :--- | :--- :---: | :---: | :---: | :---: |
| **Quản lý Tài khoản & Vòng đời User (Tạo, Sửa, Khóa, Reset, Xóa)** | Full | Không | Không | Không |
| **Quản lý Lớp GIS Metro 2 (Tim tuyến, ZOI 50m, Import thửa đất)** | Full | Xem | Xem | Xem |
| **Giám sát & Xác nhận Chấm công Thực địa (Verify Attendance)** | Full (Toàn tuyến) | Full (Phân khu) | Xem lịch sử mình | Không |
| **Phân công & Điều chuyển Task Khảo sát (Assign / Reassign)** | Full | Full | Không | Không |
| **Tự Chọn Thửa Đất Khảo sát Ngay (Ad-hoc Sweep Survey)** | Không | Không | Full | Không |
| **Ghi nhận Nhà Vắng / Cửa Khóa (POSTPONED_ABSENT)** | Không | Không | Full | Không |
| **Lập Hồ sơ Khảo sát Hiện trạng 9 Bước (Phase 1 & Phase 2)** | Không | Không | Full | Không |
| **Thả Ghim Khuyết tật $D-xx$, Đo Đạc $w, L$ & Chụp Ảnh CU thước mm** | Không | Không | Full | Không |
| **Đề xuất Tách/Gộp Thửa Đất Cấp Mã Dải Mở Rộng (> 07000)** | Không | Phê duyệt | Đề xuất / Vẽ | Không |
| **Thẩm định Hồ sơ Split-Pane (Kính lúp 400% + Audit Flags)** | Full | Full | Không | Xem |
| **Phê duyệt (Approve) / Trả về (Reject) Báo cáo** | Full | Full | Không | Không |
| **Quyền Can thiệp Kỹ sư (Engineering Judgement)** | Full | Full | Không | Không |
| **Xuất Báo Cáo Có Chọn Lọc (Theo ID chỉ định / Bộ lọc Thời gian)** | Full (Toàn tuyến) | Full (Phân khu) | Không | Tải file công bố |
| **Quản lý & Thu hồi Lịch sử Mẻ Xuất (Global Export Hub)** | Full | Xem mẻ của Ga | Không | Không |

---

## 2. ĐẶC TẢ CHI TIẾT 10 KỊCH BẢN SỬ DỤNG (USE CASE SPECIFICATIONS)

---

### USE CASE 01: DASHBOARD THỐNG KÊ & PHÂN CÔNG TASK PHÂN KHU (ZONE ANALYTICS & TASK ASSIGNMENT)
- **Tác nhân:** `ZONE_ADMIN`, `SUPER_ADMIN`.
- **Mục tiêu:** Thống kê tiến độ báo cáo, quản lý chấm công Surveyor và phân công/điều chuyển task khảo sát theo phân khu.
- **Luồng thực hiện:**
  1. `ZONE_ADMIN` đăng nhập Web Portal, chọn Phân khu/Nhà ga phụ trách.
  2. **Xem Dashboard thống kê:** Lọc theo khoảng thời gian Ngày/Tuần/Tháng, xem biểu đồ 6 trạng thái (`APPROVED`, `SUBMITTED`, `IN_PROGRESS`, `POSTPONED_ABSENT`, `REJECTED`, `NOT_SURVEYED`) và bảng năng suất Surveyor.
  3. **Phân công Task:** Chọn danh sách thửa đất chưa khảo sát trên GIS, gán task cho `SURVEYOR` phụ trách kèm deadline. Có thể điều chuyển task sang Surveyor khác qua `PUT /tasks/{id}/reassign`.

---

### USE CASE 02: CHẤM CÔNG GPS THỰC ĐỊA & XÁC NHẬN CHẤM CÔNG (FIELD TIMEKEEPING & VERIFICATION)
- **Tác nhân:** `SURVEYOR`, `ZONE_ADMIN`.
- **Mục tiêu:** Ghi nhận ngày công thực địa có đối soát GPS và ảnh selfie chống gian lận.
- **Luồng thực hiện:**
  1. `SURVEYOR` đến công trường Ga, mở PWA gửi tọa độ GPS thực tế và ảnh selfie (`POST /api/v1/attendance/check-in`).
  2. Hệ thống PostGIS tự động tính khoảng cách tới tâm Ga:
     - Nếu $\le 500m$: Trạng thái `PENDING_VERIFICATION`.
     - Nếu $> 500m$: Trạng thái `FLAGGED_WARNING` (Sai lệch vị trí Ga).
  3. `ZONE_ADMIN` mở danh sách chấm công (`GET /api/v1/admin/attendance`), kiểm tra vị trí trên bản đồ, xem ảnh selfie và nhấn **Xác nhận ngày công** (`POST /api/v1/admin/attendance/{id}/verify`).

---

### USE CASE 03: QUÉT CẠN THỬA ĐẤT AD-HOC & XỬ LÝ VẮNG NHÀ (AD-HOC SWEEP SURVEY & ABSENCE HANDLING)
- **Tác nhân:** `SURVEYOR`.
- **Mục tiêu:** Xử lý tình huống chủ hộ vắng nhà và linh hoạt chuyển sang khảo sát các nhà liền kề mà không bị gián đoạn công việc.
- **Luồng thực hiện:**
  1. **Khi nhà được giao đi vắng / khóa cửa:** Surveyor bấm `[Ghi nhận Vắng nhà]` (`POST /parcels/{id}/record-absence`), chụp ảnh cửa khóa làm bằng chứng. Thửa đất chuyển sang màu Tím (`POSTPONED_ABSENT`) và tăng bộ đếm số lần đến vắng mặt.
  2. **Tự nhận nhà liền kề để quét cạn:** Surveyor chạm vào thửa đất màu xám (`NOT_SURVEYED`) trên bản đồ GIS hoặc danh sách `GET /parcels/nearby` ➔ Bấm `[Nhận & Khảo sát ngay]` (`POST /parcels/{id}/start-survey`). Thửa đất chuyển sang màu Vàng (`IN_PROGRESS`) và Surveyor bắt đầu lập hồ sơ ngay.

---

### USE CASE 04: LẬP BÁO CÁO KHẢO SÁT GIAI ĐOẠN 1 (PHASE 1 BASELINE 9 BƯỚC)
- **Tác nhân:** `SURVEYOR`, Chủ sở hữu công trình.
- **Mục tiêu:** Thu thập dữ liệu hiện trạng toàn diện trước khi thi công tuyến Metro 2.
- **Luồng thực hiện:**
  1. **Bước 1 (Ảnh định danh & Polygon):** Chụp 4 ảnh $P-01 \to P-04$. Vẽ đa giác mặt đứng $N$ đỉnh bất kỳ ($N \ge 3$), vẽ đường phân tầng ngang và nhập kích thước dóng. Hệ thống tự động gửi ảnh $P-02$ vào hàng đợi AI nắn thẳng phối cảnh chuẩn CAD.
  2. **Bước 2 (Thông số kết cấu):** Phỏng vấn móng (CAT 1-5), hệ khung chịu lực, số tầng, các yếu tố lịch sử $E5$.
  3. **Bước 3 (Khảo sát hư hỏng từng tầng):** Chụp ảnh bối cảnh `Photo CTX` (tạo Vùng $Z-xx$) ➔ Thả ghim $D-xx$ trên ảnh bối cảnh ➔ Chụp cận cảnh `Photo CU` có thước đo khe nứt mm (Scale Card), đo $w_{max}$, $L$.
  4. **Bước 4 (Đo lún nghiêng):** Đo Tilt X/Y, nghiêng sàn, võng dầm bằng thước laser.
  5. **Bước 5 (Phạm vi & Đa giác Footprint):** Cập nhật ranh nhà thực tế. Nếu nhà bị chia nhỏ, dùng công cụ Tách thửa để đề xuất cấp mã từ dải mở rộng ($> 07000$).
  6. **Bước 6 - 9 (Điểm số, Kiến nghị & Chữ ký):** Tự động tổng hợp điểm $ECS/24$ và chỉ số tổn thương $VI$, chụp chữ ký chủ hộ/cán bộ và nộp hồ sơ (`SUBMITTED` - Màu Cam).

---

### USE CASE 05: LẬP BÁO CÁO KHẢO SÁT GIAI ĐOẠN 2 (PHASE 2 DELTA VERIFICATION & PRE-CONSTRUCTION)
- **Tác nhân:** `SURVEYOR`, Nhà thầu, Đơn vị độc lập, Chủ hộ.
- **Mục tiêu:** Đối soát biến động nứt, lún, nghiêng so với GĐ1 trước khi máy đào hầm TBM đi qua.
- **Luồng thực hiện:**
  1. Khởi tạo hồ sơ Phase 2 kế thừa toàn bộ dữ liệu gốc từ Phase 1 đã duyệt.
  2. Chọn Tầng & Phòng đang đứng: Hệ thống tự động lọc ảnh $CTX$ và danh sách ghim cũ $D-xx$ của Phase 1.
  3. **Đối soát ghim cũ:** Chạm ghim cũ $D-01$, đo $w_2, L_2$, chụp $CU$ mới ➔ Hệ thống tự tính biến thiên $\Delta w, \Delta L$ và gán trạng thái (`Không đổi`, `Phát triển`, `Đã sửa`).
  4. **Ghi nhận nứt mới:** Chấm thêm ghim mới màu Đỏ $D-new$ trên ảnh $CTX$ cũ hoặc tạo Vùng mới $Z-new$ nếu có khu vực mới cơi nới.
  5. Đo lại lún nghiêng và tính biến thiên $\Delta$ nghiêng.
  6. Kiểm tra Checklist 10 tiêu chí Phụ lục A (Quality Gate), tổng kết $\Delta ECS$, đưa ra phán quyết bồi thường và ký tên 4 bên.

---

### USE CASE 06: ĐỘNG CƠ CẢNH BÁO BẤT THƯỜNG & THẨM ĐỊNH SPLIT-PANE (AUDIT ALERT & REVIEW)
- **Tác nhân:** `ZONE_ADMIN`.
- **Mục tiêu:** Tự động phát hiện nghi vấn gian lận hiện trường hoặc nguy cấp kết cấu để Zone Admin ưu tiên thẩm định kỹ.
- **Luồng thực hiện:**
  1. Khi hồ sơ nộp về, Động cơ Audit Alerts tự động quét 5 quy tắc:
     - Chụp ảnh cách tâm nhà $> 50m$ (`GPS_DISTANCE_DISCREPANCY`).
     - Khảo sát nhà $\ge 2$ tầng chỉ mất $< 5$ phút (`ABNORMAL_DURATION`).
     - Ghim khuyết tật mang cờ kết cấu Critical hoặc lún nghiêng $\Delta > 0.5\%$ (`STRUCTURAL_CRITICAL`).
     - Ảnh cận cảnh thiếu thước đo vạch mm (`MISSING_SCALE_CARD`).
  2. Zone Admin mở danh sách cảnh báo (`GET /api/v1/admin/reports/audit-alerts`), nhấp vào hồ sơ để mở màn hình Split-Pane.
  3. Rê chuột lên ảnh $CU$ kích hoạt **Kính lúp 400%** soi vạch mm trên thước đo.
  4. Bấm phím tắt `A` (**Phê duyệt** $\rightarrow$ Sinh PDF/A ký số) hoặc phím tắt `R` (**Trả về** kèm lý do kỹ thuật để khảo sát lại).

---

### USE CASE 07: QUẢN TRỊ VÒNG ĐỜI NGƯỜI DÙNG & ĐIỀU CHUYỂN GA (USER LIFECYCLE MANAGEMENT)
- **Tác nhân:** `SUPER_ADMIN`.
- **Mục tiêu:** Cấp mới, điều chuyển nhân sự giữa các Ga, khóa/mở khóa tài khoản, reset mật khẩu và xóa an toàn.
- **Luồng thực hiện:**
  1. Super Admin tra cứu danh sách nhân sự toàn hệ thống với bộ lọc đa chiều (`GET /api/v1/admin/users`).
  2. Tạo mới tài khoản cho `ZONE_ADMIN`, `SURVEYOR` hoặc `GUEST` (`POST /api/v1/admin/users`).
  3. Cập nhật thông tin và điều chuyển Surveyor từ Ga này sang Ga khác (`PUT /api/v1/admin/users/{id}`).
  4. Khóa tài khoản khi vi phạm quy chế (`PUT /api/v1/admin/users/{id}/status`) hoặc đặt lại mật khẩu (`POST /api/v1/admin/users/{id}/reset-password`).
  5. Xóa tài khoản nhân sự (áp dụng Soft-delete để bảo toàn hồ sơ và chữ ký đã lập).

---

### USE CASE 08: XUẤT BÁO CÁO CÓ CHỌN LỌC PHÂN KHU (ZONE SELECTIVE EXPORT)
- **Tác nhân:** `ZONE_ADMIN`.
- **Mục tiêu:** Xuất báo cáo linh hoạt theo danh sách chỉ định hoặc theo bộ lọc thời gian phục vụ bàn giao mặt bằng thi công từng đoạn.
- **Luồng thực hiện:**
  1. Zone Admin chọn chế độ xuất (`POST /api/v1/reports/batch-export`):
     - **Chế độ 1 (Theo chỉ định):** Chọn đúng 3 căn nhà mặt tiền `["B-00105", "B-00106", "B-00107"]` để bàn giao gấp cho nhà thầu đóng cừ Larsen.
     - **Chế độ 2 (Theo tiêu chí thời gian):** Lọc theo Tuần 37, trạng thái `APPROVED`, rủi ro `VI: HIGH/VERY_HIGH`.
  2. Chọn định dạng: `PDF Book Compilation` (Sách báo cáo gộp có bìa + mục lục điện tử + bản đồ GIS), `ZIP Archive` (từng file PDF/A đơn lẻ), hoặc `Excel Summary`.
  3. Hệ thống xử lý nền (Queued $\to$ Completed) và sinh mã băm **Checksum SHA-256** bảo đảm tính toàn vẹn pháp lý.

---

### USE CASE 09: TRUNG TÂM QUẢN TRỊ XUẤT BÁO CÁO TOÀN TUYẾN (GLOBAL EXPORT MANAGEMENT HUB)
- **Tác nhân:** `SUPER_ADMIN`.
- **Mục tiêu:** Xuất báo cáo tổng thể 11 Ga Metro 2 và quản trị toàn bộ lịch sử xuất dữ liệu của toàn hệ thống.
- **Luồng thực hiện:**
  1. Super Admin khởi tạo đợt xuất tổng thể 11 Ga (~7.000 căn) phục vụ báo cáo UBND TP.HCM, MAUR và Ngân hàng KfW (`POST /api/v1/admin/reports/batch-export`).
  2. Super Admin xem danh sách toàn bộ các đợt xuất báo cáo của toàn tuyến và của từng Zone Admin (`GET /api/v1/admin/reports/exports`).
  3. Xem chi tiết mẻ xuất, kiểm tra mã băm SHA-256, hoặc **Thu hồi / Xóa mẻ xuất** khỏi hệ thống khi phát hiện dữ liệu cần cập nhật lại (`DELETE /api/v1/admin/reports/exports/{batchId}`).

---

### USE CASE 10: TRA CỨU BẢN ĐỒ QUY HOẠCH & TẢI TÀI LIỆU DÀNH CHO KHÁCH (CONTRACTOR & GUEST VIEW)
- **Tác nhân:** `CONTRACTOR` / Khách vãng lai.
- **Mục tiêu:** Tra cứu bản đồ GIS quy hoạch các công trình đã duyệt qua Share Token an toàn và tải tài liệu công bố.
- **Luồng thực hiện:**
  1. Khách truy cập qua đường link chia sẻ an toàn (Share Token + Passcode).
  2. Màn hình hiển thị Bản đồ GIS tương tác toàn khu vực tuyến Metro 2 với các mã màu trực quan.
  3. Nhấp chọn 1 lô đất bất kỳ để xem tóm tắt thông số kết cấu, điểm ECS/24, xếp hạng rủi ro VI và tải file PDF/A chính thức.
  4. Tải Tập hồ sơ hoàn chỉnh (PDF Book Compilation) kèm mã băm Checksum SHA-256.
