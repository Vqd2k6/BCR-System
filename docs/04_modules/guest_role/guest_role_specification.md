# TÀI LIỆU ĐẶC TẢ KIẾN TRÚC & HƯỚNG DẪN PHÁT TRIỂN: ROLE GUEST (CHỦ ĐẦU TƯ)
**Dự án:** Hệ thống Khảo sát Hiện trạng & Đánh giá Rủi ro Công trình Tuyến Metro Số 2 (BCR-System)  
**Tác giả:** IT Dev Consultant / Solutions Architect  
**Đối tượng bàn giao:** Lead Architect, Frontend Developers, Backend Developers, QA/QC  
**Trạng thái:** Bản thảo kiến trúc hoàn chỉnh (Architectural Specification)

---

## 1. TỔNG QUAN NGHIỆP VỤ & MỤC TIÊU HỆ THỐNG (EXECUTIVE SUMMARY)

### 1.1. Bối cảnh & Mục tiêu
Hệ thống hiện tại đang phục vụ 3 nhóm đối tượng:
1. `SURVEYOR`: Kỹ sư khảo sát hiện trường (PWA Mobile, chụp ảnh, chấm CAD, ký biên bản).
2. `ZONE_ADMIN`: Quản lý khu vực / Ga (kiểm duyệt hồ sơ, phân công, quản lý tiến độ zone).
3. `SUPER_ADMIN`: Lãnh đạo dự án / Tổng quản trị (toàn quyền hệ thống, phê duyệt cấp cao, quản trị tài khoản).

Role **`GUEST` (Chủ Đầu Tư - CĐT / Ban Quản Lý Đường Sắt Đô Thị MAUR)** là vai trò mới được thiết kế đặc thù để phục vụ công tác **giám sát, chỉ đạo điều hành và nắm bắt rủi ro công trình** dọc hành lang tuyến Metro Số 2 mà không can thiệp vào quy trình tác nghiệp của kỹ sư hiện trường.

### 1.2. Các nguyên tắc cốt lõi (Core Principles)
- **Zero-Trust Read-Only (Chỉ Đọc Tuyệt Đối):** Tài khoản `GUEST` tuyệt đối không có quyền tạo mới, chỉnh sửa, xóa, duyệt hay từ chối bất kỳ dữ liệu nào.
- **No-Download Anti-Leakage (Chống thất thoát dữ liệu):** Không cấp quyền tải báo cáo PDF hoặc xuất file Excel để bảo vệ tài liệu kỹ thuật nội bộ của liên danh tư vấn.
- **PII Masking (Bảo vệ thông tin cá nhân người dân):** Ẩn/che mờ số điện thoại, số căn cước công dân (CCCD) của chủ hộ theo quy định pháp luật về bảo vệ dữ liệu cá nhân.
- **Desktop Split-Screen UI (Giao diện màn hình đôi chuyên nghiệp):** Cột trái là Executive Dashboard (KPIs, biểu đồ BRA, danh sách lọc), Cột phải là Bản đồ số GIS tương tác hỗ trợ chuyển đổi lớp màu (Thematic Color Switcher).
- **Zone-Level Scoping:** Super Admin có thể phân quyền Guest theo từng Zone cụ thể hoặc toàn tuyến.

---

## 2. KIẾN TRÚC PHÂN QUYỀN & BẢO MẬT (SECURITY & RBAC ARCHITECTURE)

### 2.1. Định danh Role kỹ thuật
- **Database Enum:** `user_role` mở rộng thêm giá trị `'GUEST'`.
  ```sql
  ALTER TYPE user_role ADD VALUE 'GUEST';
  ```
- **TypeScript Type Definition:**
  ```typescript
  export type UserRole = 'SUPER_ADMIN' | 'ZONE_ADMIN' | 'SURVEYOR' | 'CONTRACTOR' | 'GUEST';
  ```

### 2.2. Phân vùng truy cập dữ liệu (Data Scoping)
- Trong bảng `users`, trường `assigned_zone_id` xác định phạm vi:
  - Nếu `assigned_zone_id IS NULL`: Guest có quyền xem toàn tuyến (Tất cả các Ga/Zone: Bến Thành, Tao Đàn, Dân Chủ, Hòa Hưng, v.v.).
  - Nếu `assigned_zone_id = 'zone_01'`: Guest chỉ truy vấn và quan sát các thửa đất thuộc Zone 1.

### 2.3. Quy chuẩn che mờ dữ liệu cá nhân (PII Masking Engine)
Backend API khi serialize dữ liệu trả về cho role `GUEST` phải chạy qua bộ lọc bảo vệ:
- **Số điện thoại chủ hộ:** Giữ lại 3 số đầu và 3 số cuối (Ví dụ: `090****123`).
- **Số CCCD / CMND:** Giữ lại 3 số đầu (Ví dụ: `079*********`).
- **File chữ ký & ảnh nhạy cảm:** Không trả về chữ ký nội bộ của người dân nếu không cần thiết; ảnh hiện trường đóng watermark bảo mật chống chụp màn hình trái phép.

### 2.4. Khóa cứng Endpoints (Backend API Guarding)
| Endpoint | Quyền Role GUEST | Xử lý Backend |
| :--- | :--- | :--- |
| `GET /api/v1/parcels` | ✅ Cho phép (kèm PII Masking & Zone filter) | Trả về danh sách thửa đất trong phạm vi |
| `GET /api/v1/parcels/:id/phase1-report` | ✅ Cho phép (kèm PII Masking) | Trả về chi tiết báo cáo dạng chỉ đọc |
| `GET /api/v1/zones/stats` | ✅ Cho phép | Trả về tổng hợp KPI theo Zone |
| `POST /api/v1/parcels/*` | ❌ Bị chặn | HTTP 403 Forbidden |
| `PUT /api/v1/parcels/*` | ❌ Bị chặn | HTTP 403 Forbidden |
| `POST /api/v1/reports/*/export-pdf` | ❌ Bị chặn | HTTP 403 Forbidden |
| `GET /api/v1/admin/export-excel` | ❌ Bị chặn | HTTP 403 Forbidden |

---

## 3. THIẾT KẾ GIAO DIỆN & TRẢI NGHIỆM NGƯỜI DÙNG (UI/UX SPECIFICATION)

### 3.1. Bố cục tổng thể (Desktop Split-Screen)
```
+---------------------------------------------------------------------------------------------------+
|  [LOGO] HỆ THỐNG GIÁM SÁT METRO SỐ 2 - DÀNH CHO CHỦ ĐẦU TƯ         [Zone: Ga Bến Thành v]  [User] |
+----------------------------------------------------+----------------------------------------------+
|  CỘT TRÁI: EXECUTIVE DASHBOARD (Width: 42%)        |  CỘT PHẢI: BẢN ĐỒ SỐ GIS (Width: 58%)        |
|                                                    |                                              |
|  [THẺ 1: TIẾN ĐỘ TỔNG QUAN (KPIs)]                |  [Nút chuyển màu: Tiến độ | Rủi ro BRA]      |
|  - Tổng căn: 120 | Đã duyệt: 75 (62.5%)           |                                              |
|  - Chờ duyệt: 20 | Đang đo: 15 | Vắng: 10          |                                              |
|                                                    |             [BẢN ĐỒ GIS TƯƠNG TÁC]           |
|  [THẺ 2: BIỂU ĐỒ DONUT RỦI RO BRA]                 |             (Các thửa đất tô màu             |
|  - Rất cao: 8 căn (Đỏ)   - Cao: 22 căn (Cam)       |              theo chế độ đang chọn)          |
|  - T.Bình: 45 căn (Vàng) - Thấp: 45 căn (Xanh)    |                                              |
|                                                    |                                              |
|  [BẢNG TRA CỨU & DANH SÁCH THỬA ĐẤT]               |                                              |
|  [Search input: Số nhà, mã thửa...]                |                                              |
|  +-----------------------------------------------+ |                                              |
|  | C&C-01-B-0046 | 214 Phạm Hồng Thái | Đã duyệt | |                                              |
|  | C&C-01-B-0047 | 216 Phạm Hồng Thái | Vắng nhà | |                                              |
|  +-----------------------------------------------+ |                                              |
|                                                    |                                              |
|  [CARD TÓM TẮT CĂN ĐANG CHỌN (FOCUSED PARCEL)]     |                                              |
|  - Thửa: C&C-01-B-0046 | Chủ hộ: Nguyễn V** A     |                                              |
|  - Cấp rủi ro: BRA Cao (Cam) | Cự ly tim: 3.2m    |                                              |
|  - [Xem chi tiết hồ sơ khảo sát ➔]                 |                                              |
+----------------------------------------------------+----------------------------------------------+
```

### 3.2. Chi tiết Cột Trái (Executive Dashboard Panel)

#### 1. Thẻ 1: Chỉ số Tiến độ Khảo sát (Progress KPI Card)
- **Tổng số công trình (Total Assigned):** Tổng số căn thuộc Zone được giao.
- **Tiến độ hoàn thành:** Thanh phần trăm (`Progress Bar`) kết hợp số lượng:
  - 🟢 **Đã duyệt chính thức (`APPROVED`):** Hiển thị rõ số lượng và tỷ lệ %.
  - 🔵 **Đã nộp chờ duyệt (`SUBMITTED`):** Số lượng hồ sơ đang trên bàn Zone Admin.
  - 🟠 **Đang thực hiện (`IN_PROGRESS`):** Số lượng các căn kỹ sư đang khảo sát dở dang.
  - 🟣 **Vắng nhà tồn đọng (`ABSENTEE`):** Số lượng các căn dán giấy hẹn chưa tiếp cận được.
  - ⚪ **Chưa khảo sát (`PENDING`):** Các căn trong kế hoạch sắp tới.

#### 2. Thẻ 2: Phân bố Rủi ro Cơ sở (BRA Donut Chart)
- **Biểu đồ tròn / Donut:** Trực quan hóa 4 cấp độ rủi ro địa kỹ thuật & kết cấu:
  - 🔴 **Rất cao (Very High - Cấp IV):** Đỏ rực (`#dc2626`).
  - 🟠 **Cao (High - Cấp III):** Cam đậm (`#ea580c`).
  - 🟡 **Trung bình (Medium - Cấp II):** Vàng (`#eab308`).
  - 🟢 **Thấp (Low - Cấp I):** Xanh lục lá (`#16a34a`).
- **Tương tác lọc (Cross-filtering Option B):** Khi CĐT bấm vào một miếng màu trên biểu đồ (ví dụ: bấm vào nhóm *"Rất cao"*), Bảng danh sách căn nhà bên dưới sẽ tự động lọc chỉ hiển thị các căn thuộc cấp rủi ro đó. Bản đồ GIS bên phải vẫn giữ nguyên toàn bộ để bảo toàn góc nhìn không gian tổng thể.

#### 3. Bảng danh sách & Tra cứu căn (Parcel Directory Table)
- Hỗ trợ ô tìm kiếm nhanh theo: Mã thửa đất, Số nhà, Tên đường.
- Cột dữ liệu: Mã thửa, Địa chỉ, Trạng thái khảo sát (Badge), Cấp rủi ro BRA (Badge).
- Khi nhấp chọn 1 hàng: Bản đồ bên phải tự động bay tới (flyTo / panTo) thửa đất đó và mở thẻ thông tin tóm tắt.

#### 4. Thẻ tóm tắt căn đang chọn (Focused Parcel Card)
- Xuất hiện ghim ở đáy panel trái khi CĐT click vào 1 thửa đất bất kỳ trên bản đồ hoặc trong bảng.
- Hiển thị:
  - Ảnh đại diện mặt tiền P-02 (Tap-to-zoom).
  - Địa chỉ & Tên chủ hộ (đã che mờ PII: `Nguyễn V*** A - 098****456`).
  - Cự ly đo đạc đến mép ga / tim hầm Metro (VD: `3.5m - Vùng ảnh hưởng trực tiếp`).
  - Kết luận kỹ sư & Phân hạng ECS / VI / BRA.
  - **Nút hành động:** `[Xem Chi Tiết Hồ Sơ Khảo Sát ➔]` (Mở Modal toàn cảnh).

---

### 3.3. Chi tiết Cột Phải (Bản Đồ Số GIS Tương Tác)

#### 1. Bộ chuyển đổi chế độ phối màu (Thematic Color Switcher)
Nút gạt cố định (Floating Toggle) góc trên bản đồ cho phép CĐT đổi chế độ hiển thị màu thửa đất:

- **Chế độ 1: Phối màu theo Tiến độ Khảo sát (Mặc định):**
  - 🟢 Xanh lục (`#16a34a`): Đã duyệt (`APPROVED`)
  - 🔵 Xanh dương (`#0284c7`): Đã nộp chờ duyệt (`SUBMITTED`)
  - 🟠 Vàng cam (`#f59e0b`): Đang khảo sát (`IN_PROGRESS`)
  - 🟣 Tím (`#9333ea`): Báo vắng nhà (`ABSENTEE`)
  - 🔴 Đỏ nhạt (`#ef4444`): Bị từ chối cần đo lại (`REJECTED`)
  - ⚪ Xám nhạt (`#94a3b8`): Chưa khảo sát (`PENDING`)
  - 🟤 Nâu cam (`#c2410c`): Nhà đang xây dở / Đất trống

- **Chế độ 2: Phối màu theo Cấp độ Rủi ro BRA:**
  - 🔴 Đỏ sẫm (`#b91c1c`): Rủi ro Rất cao (Very High Risk)
  - 🟠 Cam đậm (`#ea580c`): Rủi ro Cao (High Risk)
  - 🟡 Vàng (`#eab308`): Rủi ro Trung bình (Medium Risk)
  - 🟢 Xanh lục (`#16a34a`): Rủi ro Thấp (Low Risk)
  - ⚪ Xám (`#cbd5e1`): Chưa có dữ liệu / Chưa khảo sát

#### 2. Lớp ranh quy hoạch & Tim tuyến Metro Số 2
- Hiển thị đường tim hầm Metro màu đỏ nét đứt.
- Hiển thị ranh các nhà ga ngầm (Station Boundary Polygon).
- Hiển thị dải đệm vùng ảnh hưởng (Buffer Zone 0-5m và 5-15m) với độ trong suốt 15%.

---

### 3.4. Giao diện xem chi tiết hồ sơ (Full Survey Form - Read Only Modal)
Khi CĐT bấm nút *"Xem Chi Tiết Hồ Sơ Khảo Sát"*, hệ thống mở cửa sổ toàn màn hình (Modal/Drawer) sử dụng lại toàn bộ cấu trúc 9 bước của `SurveyPhase1Page`:
- Áp dụng triệt để cơ chế **"Triple-Lock Read-Only"**:
  - Store: `isReadOnly: true`.
  - DOM: `data-survey-readonly="true"`.
  - Vô hiệu hóa toàn bộ `input`, `textarea`, `select`, `checkbox`.
  - Ẩn toàn bộ nút thêm tầng, thêm vùng hư hỏng Z, thêm cấu kiện E.
  - Sơ đồ CAD_01, CAD_02 và sơ đồ vết nứt chỉ cho phép di chuyển, phóng to thu nhỏ (Pan/Zoom) xem vị trí ghim khuyết tật.
  - Ẩn tuyệt đối nút tải file PDF / In báo cáo.

---

## 4. KẾ HOẠCH TRIỂN KHAI CHO DEVELOPER & ARCHITECT

### 4.1. Nhiệm vụ Backend (Backend Tasks)
1. **Migration Database:** Thêm role `'GUEST'` vào enum Postgres.
2. **Cập nhật User Service & Controller:** Cho phép Super Admin tạo user với role `GUEST` và gán `assigned_zone_id`.
3. **Triển khai PII Masking Serializer:** Viết helper `maskSensitiveData(parcel, userRole)` để tự động che mờ SĐT và CCCD khi role là `GUEST`.
4. **Bảo vệ Endpoint Export:** Cập nhật middleware chặn triệt để mọi request tải PDF/Excel đối với role `GUEST`.

### 4.2. Nhiệm vụ Frontend (Frontend Tasks)
1. **Types & Auth Context:** Mở rộng `UserRole = ... | 'GUEST'`. Cập nhật `AuthContext` và bộ điều hướng `App.tsx`.
2. **Xây dựng module Guest Portal:**
   - Tạo thư mục: `frontend/src/features/guest-portal/`
   - Tạo trang chính: `GuestDashboardPage.tsx`
   - Tạo các component con:
     - `GuestSplitLayout.tsx`: Quản lý chia cột Responsive.
     - `GuestKpiSummaryCard.tsx`: Thẻ tiến độ khảo sát.
     - `GuestBraDonutChart.tsx`: Biểu đồ phân tích rủi ro BRA.
     - `GuestParcelListTable.tsx`: Bảng tra cứu danh sách có tìm kiếm.
     - `GuestFocusedParcelCard.tsx`: Thẻ thông tin nhanh thửa đất.
     - `GuestMapThematicToggle.tsx`: Nút chuyển đổi màu Tiến độ vs. Rủi ro.
3. **Cập nhật Admin Portal (User Management):**
   - Bổ sung tùy chọn `GUEST (Chủ Đầu Tư)` trong dropdown chọn vai trò của Modal tạo/sửa người dùng (`UserEditModal.tsx`).

---

## 5. BẢNG TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA FOR QA/QC)

| Mã kiểm thử | Kịch bản kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- |
| **TC-01** | Super Admin tạo tài khoản Role `GUEST` gán cho Zone 1 | Tài khoản đăng nhập thành công, chỉ thấy dữ liệu Zone 1 |
| **TC-02** | Super Admin tạo tài khoản Role `GUEST` không gán Zone | Tài khoản thấy toàn bộ danh sách các Zone của tuyến Metro Số 2 |
| **TC-03** | Đăng nhập bằng tài khoản `GUEST` | Giao diện hiển thị trực tiếp dạng Split-Screen (Trái: Dashboard, Phải: GIS) |
| **TC-04** | Kiểm tra thông tin cá nhân của chủ hộ | Số điện thoại và số CCCD được che mờ (VD: `090****123`, `079*********`) |
| **TC-05** | Nhấp chọn miếng màu trên Biểu đồ Donut Rủi ro BRA | Bảng danh sách căn nhà bên dưới tự động lọc theo cấp rủi ro tương ứng |
| **TC-06** | Nhấp nút chuyển màu trên Bản đồ GIS | Bản đồ chuyển đổi mượt mà giữa màu Tiến độ và màu Rủi ro BRA |
| **TC-07** | Nhấp chọn một thửa đất trên Bản đồ GIS | Cột trái tự động hiển thị Thẻ tóm tắt căn tương ứng kèm ảnh mặt tiền |
| **TC-08** | Mở form khảo sát chi tiết từ Thẻ tóm tắt | Mở form 9 bước ở chế độ Chỉ Đọc (không thể sửa bất kỳ dữ liệu nào) |
| **TC-09** | Thử tìm nút Tải PDF hoặc Xuất Excel trên giao diện Guest | Không có bất kỳ nút tải/xuất file nào hiển thị |
| **TC-10** | Dùng Postman gọi trực tiếp API POST/PUT hoặc Export PDF với token của Guest | Backend trả về mã lỗi `403 Forbidden` |

---

*Tài liệu này là căn cứ kỹ thuật chính thức để Lead Architect duyệt và phân bổ task chi tiết cho Sprint tiếp theo.*
