---
trigger: model_decision
---

# QUY CHUẨN KIẾN TRÚC & LỖI HỆ THỐNG NỀN TẢNG (METRO 2 BCS PLATFORM)

Tài liệu này xác lập các tiêu chuẩn kiến trúc, ranh giới hệ thống, phân tích **6 Lỗi Hệ thống Cốt lõi** và các **Nguyên tắc Nghiệp vụ Bất biến** cho Nền tảng Khảo sát Hiện trạng Công trình Tuyến Metro Số 2 (Building Condition Survey - BCS Platform).

---

## 🏛️ PHẦN 1: TỔNG QUAN KIẾN TRÚC & RANH GIỚI HỆ THỐNG (SYSTEM BOUNDARIES)

### 1.1. Mục tiêu Tối thượng của Hệ thống
Thu thập, chuẩn hóa và bảo toàn số liệu hiện trạng công trình (kết cấu, ngoại quan, khuyết tật nứt lún, nghiêng võng, toạ độ không gian) của các tòa nhà nằm trong hành lang ảnh hưởng của dự án Metro 2.
> **Tính chất dữ liệu:** Dữ liệu khảo sát là **căn cứ pháp lý duy nhất** để đối chiếu, bồi thường hoặc khước từ bồi thường khi có tranh chấp nứt/sập/lún do thi công máy khoan hầm TBM gây ra. Do đó, tính toàn vẹn, tính bất biến và độ chính xác của dữ liệu được đặt lên hàng đầu.

### 1.2. Mô hình Phân quyền 3 Lớp (Multi-tier RBAC)
1. **Super Admin**: Quản trị dữ liệu toàn tuyến, cấu hình bản đồ quy hoạch GIS tổng thể, phân bổ Zone cho Zone Admin, phê duyệt báo cáo đặc biệt.
2. **Zone Admin**: Quản lý phân khu/nhà ga phụ trách. Phân công công việc cho Surveyor, kiểm duyệt hồ sơ khảo sát (Approve/Reject kèm lý do pháp lý), ký số xác nhận hồ sơ trước khi khóa bất biến.
3. **Surveyor (Cán bộ hiện trường)**: Sử dụng thiết bị di động (PWA) để điểm danh GPS tại Zone, nhập liệu form khảo sát, chụp ảnh đính kèm watermark/thước đo, gắn mã khuyết tật trên bản vẽ CAD (Defect Pinning), lấy chữ ký chủ hộ và nộp hồ sơ.

### 1.3. Mô hình Thực thể Hướng đối tượng (1:N Hierarchy)
Hệ thống quản lý công trình theo cấu trúc cha - con chặt chẽ:
* **Tòa nhà Mẹ (GisParcel / BuildingMaster)**: Đại diện cho thửa đất quy hoạch, khối tháp chung cư, công trình lớn. Mang thông tin pháp lý ranh đất, toạ độ GIS, cự ly tim hầm Metro, hệ móng cọc, tầng hầm, độ nghiêng tổng thể tòa nhà (`buildingTilt`), hồ sơ bản vẽ hoàn công Master.
* **Căn hộ Con (BuildingUnit)**: Thực thể con trực thuộc tòa nhà mẹ. **Kế thừa 100% các chỉ số nền tảng từ tòa nhà mẹ** (không khảo sát lại móng cọc, độ nghiêng tổng thể, toạ độ ranh). Chỉ tập trung khảo sát sở hữu riêng: hiện trạng nội thất, nứt tường ngăn, nứt sàn/trần cục bộ, thấm dột từ tầng trên và lấy chữ ký của chủ sở hữu căn hộ.

---

## ⚠️ PHẦN 2: DANH MỤC 6 LỖI HỆ THỐNG CỐT LÕI (SYSTEMIC ARCHITECTURAL FAULTS)

Đây là các điểm đứt gãy kiến trúc mang tính hệ thống cần được ngăn chặn triệt để trong mọi tác vụ lập trình:

### 1. Lỗi Lệch Pha Schema Toàn Trình (End-to-End Schema Drift & Data Drop)
* **Bản chất lỗi:** Hệ thống có 6 tầng truyền tải dữ liệu: `Form UI -> Zustand Store -> Network Payload -> Zod DTO Schema -> SQL Repository -> Handlebars Report Template`. Chỉ cần 1 thuộc tính mới bị thiếu ở 1 mắt xích thì toàn bộ dữ liệu sẽ bị "rơi rụng" âm thầm:
  * FE gửi nhưng BE không khai báo trong Zod DTO $\rightarrow$ Payload bị lọc mất hoặc văng lỗi `400 Bad Request`.
  * BE nhận nhưng Repository không đưa biến vào câu lệnh `INSERT/UPDATE` SQL $\rightarrow$ CSDL lưu giá trị `NULL`.
  * CSDL đã lưu nhưng ViewModel Generator không map biến vào View $\rightarrow$ Báo cáo PDF xuất ra bị trống dữ liệu.
* **Quy tắc phòng ngừa:** Mọi thuộc tính mới bắt buộc phải được đồng bộ theo đúng **Quy trình E2E Feature Sync** (xem file `system_workflows.md`).

### 2. Lỗi Không Gian Địa Lý & Nghịch Đảo Toạ Độ (GIS & Spatial Reference Faults)
* **Bản chất lỗi:**
  * **Nghịch đảo toạ độ:** Leaflet map sử dụng thứ tự `[Latitude, Longitude]`, trong khi GeoJSON chuẩn và PostGIS (`ST_GeomFromGeoJSON`) sử dụng thứ tự `[Longitude, Latitude]`. Việc truyền nhầm thứ tự làm toạ độ công trình bay ra ngoài lãnh thổ Việt Nam.
  * **Lệch hệ quy chiếu (SRID):** Toạ độ GPS thu thập là WGS84 (EPSG:4326). Nếu tính khoảng cách trên mặt phẳng phẳng mà không dùng hàm trắc địa (`ST_DistanceSphere` hoặc `geography`), sai số có thể lên đến hàng trăm mét.
  * **Lệch thuật toán điểm danh:** Client tính khoảng cách bằng công thức Haversine thuần với toạ độ ước lượng, trong khi Server tính bằng PostGIS so với trọng tâm hình học (`ST_Centroid`) của Zone $\rightarrow$ Dẫn đến tình trạng "Giao diện hiện đủ cự ly nhưng bấm nộp thì bị từ chối".
* **Quy tắc phòng ngừa:**
  * Server là chân lý duy nhất (Single Source of Truth) trong mọi phép tính khoảng cách và hình học.
  * Mọi trường toạ độ lưu trữ phải chuẩn hóa WGS84 (EPSG:4326), toạ độ polygon ranh đất phải được kiểm tra tính hợp lệ (`ST_IsValid`).

### 3. Lỗi Quá Tải Bộ Nhớ & Tràn Bộ Đệm PWA Mobile (Client Memory Leak & Safari Crash)
* **Bản chất lỗi:** Mỗi công trình chụp trung bình 20–50 ảnh chất lượng cao (12MP–48MP từ camera điện thoại). Nếu thực hiện đóng watermark, gắn thước đo hoặc render canvas trực tiếp trên RAM trình duyệt Mobile Safari:
  * Trình duyệt iOS Safari sẽ cạn kiệt RAM (>1.5GB) và tự động tải lại trang (`WebProcess crash`), làm mất toàn bộ form đang nhập dở.
  * Cơ chế tự dọn dẹp bộ nhớ của iOS sẽ tự xoá dữ liệu IndexedDB nếu bộ nhớ máy gần đầy hoặc để ngâm ứng dụng qua nhiều ngày.
* **Quy tắc phòng ngừa:**
  * Toàn bộ thao tác đóng dấu Watermark (Toạ độ GPS, Mã công trình, Timestamp) và gắn thước đo phải được xử lý ở **Backend Server** khi nhận stream ảnh.
  * Client chỉ nén ảnh vừa đủ trước khi gửi (`max-width: 2048px`, chất lượng 85%) và ưu tiên upload trực tiếp qua AWS S3 Presigned URL.
  * Bắt buộc nhắc nhở Surveyor bấm Đồng bộ (Sync) ngay khi có sóng 5G/WiFi, không lưu trữ hồ sơ ngoại tuyến ngâm ngày qua ngày.

### 4. Lỗi Tràn Tiến Trình Headless & Vỡ Khung In PDF (Puppeteer Zombie & CSS Media Break)
* **Bản chất lỗi:**
  * **Puppeteer Zombie:** Mỗi lần export report, nếu không giải phóng `browser` hoặc `page` trong khối `finally { await page.close(); }`, các tiến trình Chromium ngầm sẽ tích tụ, chiếm dụng 100% CPU/RAM của server.
  * **Vỡ khung in ấn:** Render PDF trên nền web có sự khác biệt giữa màn hình và giấy in A4: hình ảnh bị cắt đôi ở đường ngắt trang, bảng biểu tràn lề, header/footer đè lên nội dung bảng.
* **Quy tắc phòng ngừa:**
  * Sử dụng Browser Pool hoặc mô hình khởi tạo - đóng dứt điểm có Timeout cho Puppeteer.
  * Sử dụng CSS in ấn nghiêm ngặt: `page-break-inside: avoid;`, `break-inside: avoid;`, thiết lập `@page { size: A4; margin: 15mm 10mm 15mm 10mm; }`.

### 5. Lỗi Bất Đồng Bộ Dữ Liệu & Ghi Đè Trạng Thái Form (Async Race Condition & Form Reset)
* **Bản chất lỗi:**
  * Người dùng đang upload ảnh lớn (chờ 3–5 giây), đồng thời bấm "Chuyển bước" $\rightarrow$ State của bước mới ghi đè lên store làm mất URL ảnh vừa upload xong.
  * Tồn tại 2 store song song hoặc không đồng nhất cách đặt tên biến giữa `camelCase` (Frontend TypeScript) và `snake_case` (Backend Database) dẫn đến dữ liệu kế thừa rơi về rỗng hoặc mặc định là 1.
* **Quy tắc phòng ngừa:**
  * Bắt buộc có trạng thái `isUploading` và khóa nút Chuyển bước cho tới khi các tác vụ async hoàn tất.
  * Store Zustand phải có bộ chuyển đổi tương thích 2 chiều (`camelCase` $\leftrightarrow$ `snake_case`) cho các trường cốt lõi (`unitCode`/`unit_code`, `floorNumber`/`floor_number`).

### 6. Lỗi Toàn Vẹn & Khả Năng Giả Mạo Hồ Sơ Pháp Lý (Data Immutability & Audit Violation)
* **Bản chất lỗi:** Dữ liệu sau khi đã được thẩm định và có chữ ký số hiện trường vẫn có thể bị chỉnh sửa trực tiếp thông qua các API cập nhật thông thường, làm mất giá trị pháp lý khi ra tòa đối chiếu đền bù.
* **Quy tắc phòng ngừa:**
  * Áp dụng State Machine nghiêm ngặt: Khi hồ sơ chuyển sang trạng thái `SUBMITTED` hoặc `APPROVED`, mọi API `PUT / PATCH` vào nội dung khảo sát phải bị chặn lại ở tầng Middleware.
  * Sau khi Zone Admin ký duyệt, hệ thống phải tự động tính toán mã băm SHA-256 trên toàn bộ payload hồ sơ và lưu vào bảng Audit Log.

### 7. Lỗi Vi Phạm Phân Quyền Giao Diện & Mù Chế Độ Chỉ Đọc (UI RBAC Breach & Missing ReadOnly Guard)
* **Bản chất lỗi:** 
  * Các component/modal nghiệp vụ cấu hình kỹ thuật (quản lý CAD mặt bằng tầng, chia cắt căn hộ, gộp thửa, thiết lập mốc toạ độ) được sử dụng chung giữa **Zone Admin** và **Surveyor**. Khi Agent không khai báo prop `readOnly?: boolean;`, Surveyor ở hiện trường có thể thao tác vào các chức năng quản trị cấp phân khu (Upload CAD, sửa dải tầng, xóa phân vùng, bấm nút Lưu đồng bộ), đe dọa trực tiếp đến tính toàn vẹn cấu hình.
  * Khi ở chế độ xem, Agent giữ nguyên `<input disabled>` gây cảm giác form bị đơ, không chuyển sang thẻ hiển thị tĩnh (read-only view card).
  * Empty State không phân hóa vai trò: Đưa ra thông báo kêu gọi Surveyor tải file CAD lên, trong khi trách nhiệm đó thuộc về Zone Admin trên Cổng Quản Trị.
* **Quy tắc phòng ngừa:**
  * Mọi component nghiệp vụ dùng chung giữa Admin và Surveyor **BẮT BUỘC** có prop `readOnly?: boolean` (mặc định `false` hoặc `readOnly={!isAdmin}`).
  * Khi `readOnly = true`:
    1. Tiêu đề hiển thị kèm hậu tố `(Chỉ Đọc)` và gắn badge vai trò rõ ràng: `Khảo Sát Viên` (`bg-sky-950 text-sky-300 border-sky-700`).
    2. Input/Select biến thành thẻ hiển thị tĩnh (`<div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-750 text-slate-200 ...">`).
    3. Ẩn toàn bộ nút thao tác ghi (Upload ảnh, Đổi file CAD, Xóa phần tử, Nút Lưu). Thay thế nút Lưu bằng badge thông tin chỉ đọc (VD: `<div className="... bg-slate-800 text-teal-300 border border-teal-500/30"><Layers ... /><span>Sơ Đồ Tham Khảo</span></div>`).
    4. Thông báo Empty State phải chỉ dẫn Surveyor liên hệ Zone Admin, không kêu gọi Surveyor thực hiện hành vi quản trị: *"Tầng này hiện chưa được cấu hình bản vẽ CAD mặt bằng kiến trúc. Vui lòng liên hệ Zone Admin cập nhật trên Cổng Quản Trị."*
    5. Truyền `readOnly={true}` và `onSave={undefined}` xuống các canvas/slicer bên dưới.

---

## 📌 PHẦN 3: NGUYÊN TẮC NGHIỆP VỤ BẤT BIẾN (DOMAIN CONSTRAINTS)
*(Đúc kết từ thực tế hiện trường và yêu cầu của Chủ đầu tư MAUR / Liên danh EPC)*

### 1. Điểm danh GPS Phân Khu
* Toạ độ mục tiêu điểm danh bắt buộc phải là trọng tâm hình học (`ST_Centroid(ST_Union(geom))`) của **đúng Zone/Ga mà nhân sự đó được gán**, tuyệt đối không hardcode toạ độ trạm cố định.
* Khoảng cách hiển thị ở bước Preview và khoảng cách kiểm tra khi Submit phải dùng chung 1 công thức và cùng 1 toạ độ đích.

### 2. Mã Định Danh Pinning trên Mặt Bằng CAD (Bước 3)
* Nhãn thẻ pin ghim trên mặt bằng CAD chỉ được hiển thị mã ngắn gọn:
  * **`Z-01`, `Z-02`**: Vùng kiến trúc (Zone).
  * **`E-01`, `E-02`**: Cấu kiện kết cấu (Element).
  * **`D-01`, `D-02`**: Khuyết tật / Vết nứt (Defect).
* Cấm hiển thị chuỗi dài dòng làm che khuất bản vẽ kỹ thuật trên màn hình điện thoại.

### 3. Biến động Ranh thửa GIS & Gộp thửa có đất dư (Bước 5)
* Khi công trình gộp thửa (`MERGE`): Cho phép chọn *Xây dựng 100%* hoặc *Xây dựng 1 phần (Có đất dư)*.
* Nếu có đất dư: KSV nhập diện tích xây dựng thực tế ($S_{xd}$), hệ thống tự tính $S_{du} = S_{tong} - S_{xd}$ và tự động sinh 2 mã thực thể riêng biệt: Thửa nhà chính (`{Mã}-XD`) và Thửa đất dư (`{Mã}-DU`) để quản lý đền bù.

### 4. Cổng Kiểm Tra Dữ Liệu Hiện Trường (Completeness Gate - Bước 6)
* Chỉ chấp nhận 2 trạng thái dứt khoát: **`ALLOW`** (Đạt 100%) hoặc **`CONDITIONAL`** (Cho phép có điều kiện, bắt buộc nhập lý do giải trình). Bỏ hoàn toàn trạng thái trung gian `PENDING`.
* Tiêu chí Kết cấu (Structural Review): Trích xuất trực tiếp từ kết quả Bước 4 (`formData.burlandSummary.needStructuralEngineerReview`).
* Tiêu chí Bản vẽ hoàn công: Nhị phân `Có` hoặc `Không`. Riêng Căn hộ con tự động ghi nhận đạt (kế thừa từ tòa Master).

### 5. Đánh Giá Rủi Ro Cơ Sở BRA (Bước 7)
* Bỏ hoàn toàn các đoạn văn bản nhận định cảm tính không có quy ước.
* Bắt buộc tính toán đúng ma trận chuẩn $V \times I \implies$ Phân hạng rủi ro kỹ thuật (`LOW`, `MEDIUM`, `HIGH`, `VERY_HIGH`).

### 6. Quy chuẩn Form Khảo sát Căn Hộ Con (Condo Unit)
* **Khởi tạo tại Hub**: Chỉ thu thập 2 trường: **Mã/Số phòng** (VD: `P.402`) và **Tầng/Lầu**. Không thu thập tên và số điện thoại chủ hộ ở bước khởi tạo.
* **Kế thừa**: Căn hộ con kế thừa toàn bộ hệ móng, tầng hầm, toạ độ GIS, cự ly tim hầm và độ nghiêng tổng thể từ Tòa nhà mẹ.
* **Bộ 4 ảnh căn hộ con**:
  * `P-01`: Cửa chính & Biển số phòng (*Bắt buộc*).
  * `P-02`: Mặt đứng khối tháp (*Mặc định tick N/A*, kế thừa tòa mẹ).
  * `P-03`: Ban công / Logia (*Mặc định tick N/A*).
  * `P-04`: Toàn cảnh nội thất phòng khách (*Bắt buộc*).
* **Đo nghiêng & Đo võng**: Độ nghiêng hiển thị dạng Read-only badge kế thừa từ tòa mẹ; Độ võng dầm/sàn được đo và ghi nhận cục bộ bên trong căn hộ.

### 7. Ngôn Ngữ Thiết Kế (Unified Clean Light Theme)
* Toàn bộ Wizard (Nhà dân, Chung cư tổng thể, Căn hộ con) dùng chung phong cách Clean Light: Nền sáng cao cấp, header trắng mờ (`bg-white/95 backdrop-blur-md border-b border-slate-200/80`), tab chỉ dẫn bước rõ ràng, nút lưu nháp phản hồi trực quan.
* Cấm đưa giao diện sang nền đen / dark mode cục bộ gây lệch tone và khó đọc ngoài trời nắng.

### 8. Quy Chuẩn Component Dùng Chung & Chế Độ Chỉ Đọc (Shared Component ReadOnly Standard)
* Khi một component được mở từ cả Admin Portal và Surveyor App (ví dụ: `BuildingHubModal`, `FloorPlanCadManagementModal`, `ParcelDetailBottomSheet`):
  * **Admin Mode (`readOnly=false`)**: Cho phép Upload, Chỉnh sửa thông số, Vẽ phân vùng, Thay đổi liên kết, Lưu CSDL.
  * **Surveyor Mode (`readOnly=true`)**: Chỉ xem sơ đồ, xem vị trí căn hộ, zoom/pan bản vẽ, không có bất kỳ nút chỉnh sửa cấu hình nào.

### 9. Quy Chuẩn UX/UI Tương Tác & Con Trỏ Chuột (`cursor-pointer` Mandate)
* Mọi phần tử có sự kiện nhấp chuột (`<button>`, `onClick`, nút đóng `X`, tab chuyển đổi, badge tương tác) **BẮT BUỘC phải có class `cursor-pointer`**.
* Nếu phần tử ở trạng thái disabled: Bắt buộc dùng `disabled:opacity-50 cursor-not-allowed`.
* Phải có phản hồi thị giác: `hover:opacity-80` hoặc `hover:bg-...`, `active:scale-95`, `transition-all`.

### 10. Bảng Màu Quy Ước Cho Badge & Tác Vụ (Standardized Semantic Color Palette)
* Toàn bộ hệ thống giao diện tuân thủ bảng màu quy ước chuẩn mực:
  * **Super Admin**: `bg-purple-950 text-purple-300 border-purple-700`
  * **Zone Admin**: `bg-amber-950 text-amber-300 border-amber-700`
  * **Khảo Sát Viên (Surveyor)**: `bg-sky-950 text-sky-300 border-sky-700`
  * **Người Dân (Citizen / Guest)**: `bg-slate-800 text-slate-300 border-slate-600`
  * **Mã Công Trình / Thửa Đất (`B-XXXXX`, `P-XXXXX`)**: `bg-teal-950 text-teal-300 border-teal-700 font-mono font-bold`
  * **Mã Căn Hộ Con (`P.nnn`)**: `bg-indigo-950 text-indigo-300 border-indigo-700 font-mono font-bold`
  * **Mã Phân Khu / Ga (`Z-01`, `ZONE-05`)**: `bg-cyan-950 text-cyan-300 border-cyan-700 font-mono font-bold`
  * **Trạng Thái Đạt / An Toàn / ALLOW / BRA Low**: `bg-emerald-950 text-emerald-300 border-emerald-700`
  * **Trạng Thái Cảnh Báo / CONDITIONAL / BRA Medium**: `bg-amber-950 text-amber-300 border-amber-700`
  * **Trạng Thái Nguy Hiểm / REJECTED / BRA High / Very High**: `bg-rose-950 text-rose-300 border-rose-700`
  * **Sơ Đồ Tham Khảo (Chế độ Read-only)**: `bg-slate-800 text-teal-300 border-teal-500/30 font-bold`

### 11. Kỷ Luật TypeScript & Môi Trường Vite Không Khoan Nhượng (Strict Zero-Any Mandate)
* **Zero Any**: Cấm tuyệt đối từ khóa `any` và ép kiểu `as any` trên toàn bộ codebase. Bắt buộc định nghĩa interface/type rõ ràng hoặc dùng `unknown` kèm Type Guard.
* **Error Catching**: Mọi khối `catch (err: unknown)` phải dùng `getErrorMessage(err)` từ `@/utils/errorUtils`.
* **Vite Env**: Cấm sử dụng `process.env`. Toàn bộ biến môi trường phải dùng `import.meta.env.*` đã được type trong `src/vite-env.d.ts`.
* **Module Syntax**: Bắt buộc dùng `import type` cho tất cả các import chỉ chứa kiểu dữ liệu (`verbatimModuleSyntax: true`).
* **Zero Mock Data**: Tuyệt đối không hardcode dữ liệu giả định vào component nghiệp vụ thật. Luôn xử lý Zero State từ API thật.

### 12. Kỷ Luật Bắt Lỗi & Minh Bạch Observability (Try-Catch & Error Transparency)
* `try ... catch` là để ném ra lỗi có ngữ cảnh hoặc phục hồi có kiểm soát, **TUYỆT ĐỐI CẤM DÙNG ĐỂ GIẤU LỖI**.
* **Cấm Empty Catch**: Nghiêm cấm khối `catch {}` rỗng hoặc catch nuốt lỗi âm thầm (`return null/[]/false` mà không log).
* **Bắt buộc Log có Context Tag**: Mọi khối `catch` bắt buộc phải có ít nhất một lệnh `console.error('[ContextTag] ...', err)` hoặc `throw err`.
* **Không Alert-Only**: Bắt buộc log đối tượng lỗi ra Console trước khi hiển thị Toast/Alert cho người dùng để Dev có thể F12 debug tức thì.

---

## 🛡️ PHẦN 4: NGUYÊN TẮC BẢO VỆ CƠ SỞ DỮ LIỆU TUYỆT ĐỐI (DATABASE INTEGRITY & SAFETY)
*(Dữ liệu BCS Metro 2 là căn cứ pháp lý duy nhất trước Tòa án. Mọi tổn thất dữ liệu đều là lỗi nghiêm trọng bậc 1)*

### 4.1. Cấm Tuyệt Đối Xóa Cứng (Zero Hard-Delete Mandate)
* **NGHIÊM CẤM** các câu lệnh: `DROP TABLE`, `DROP DATABASE`, `TRUNCATE`, hoặc `DELETE FROM` trên toàn bộ bảng nghiệp vụ: `parcels`, `building_units`, `surveys`, `survey_photos`, `defect_pins`, `cadastral_mutations`, `attendance_records`, `audit_logs`.
* Bắt buộc sử dụng cơ chế **Soft Delete**: `deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL`. Các truy vấn nghiệp vụ phải luôn có điều kiện phòng vệ: `WHERE deleted_at IS NULL`.

### 4.2. Tính Lũy Kế An Toàn Của Migration (Idempotent Migration Standard)
* Mọi file migration mới trong `backend/database/migrations/YYYYMMDD_*.sql` phải tuân thủ tính an toàn lũy kế:
  * Thêm cột: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...;`
  * Tạo bảng: `CREATE TABLE IF NOT EXISTS ...;`
  * Tạo chỉ mục: `CREATE INDEX IF NOT EXISTS ...;`
* **CẤM** chỉnh sửa file migration cũ đã từng được chạy trên staging/production. Mọi sửa đổi phải được viết vào file migration mới tiếp theo.
* **CẤM** chạy `ALTER TABLE ... DROP COLUMN` mà chưa qua quy trình deprecation 2 pha.

### 4.3. Bắt Buộc Giao Dịch ACID Đầy Đủ (Mandatory Transaction Boundary)
* Mọi luồng xử lý ghi dữ liệu liên quan từ 2 bảng trở lên hoặc liên quan đến cập nhật cấu trúc (VD: Chia cắt căn hộ con từ CAD, biến động gộp thửa đất dư, duyệt hồ sơ băm SHA-256):
  * **BẮT BUỘC** thực thi trong một Database Transaction (`BEGIN ... COMMIT ... ROLLBACK`).
  * Nếu có bất kỳ lỗi nào ở bước trung gian, toàn bộ thao tác phải được Rollback 100%, tuyệt đối không để lại bản ghi rác mồ côi (orphan records).

### 4.4. Phòng Chống SQL Injection Tuyệt Đối (Parameterized Queries Only)
* Cấm hoàn toàn việc cộng chuỗi trong câu truy vấn SQL (`string concatenation` hoặc `template literals`).
* 100% câu truy vấn phải sử dụng biến tham số hóa (`$1, $2, ...` trong `pg`).

### 4.5. Khóa Bất Biến Dữ Liệu Hồ Sơ Đã Duyệt (Approved Record Immutability)
* Khi hồ sơ chuyển sang trạng thái `APPROVED` hoặc `LOCKED_IMMUTABLE`, middleware backend và trigger CSDL phải từ chối mọi thao tác `UPDATE/DELETE` trên hồ sơ đó.
