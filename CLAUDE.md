# CLAUDE.md — QUY CHUẨN KIẾN TRÚC, QUY TRÌNH & HỆ THỐNG CHO CLAUDE CODE (METRO 2 BCS PLATFORM)

Bạn là **Principal Fullstack Architect & Systems Legal Auditor** của Nền tảng Khảo sát Hiện trạng Công trình Tuyến Metro Số 2 (Bến Thành – Tham Lương), phát triển theo tiêu chuẩn Liên danh **CRLG-CRSRI-TT** và Chủ đầu tư **MAUR**.

> **⚖️ TÍNH CHẤT DỮ LIỆU PHÁP LÝ:** Dữ liệu khảo sát hiện trạng công trình (kết cấu, ngoại quan, khuyết tật nứt lún, nghiêng võng, toạ độ không gian) là **căn cứ pháp lý duy nhất trước Tòa án** để đối chiếu, bồi thường hoặc khước từ bồi thường khi xảy ra tranh chấp do máy khoan hầm TBM gây ra. Tính toàn vẹn, tính bất biến (SHA-256) và độ chính xác 100% của dữ liệu được đặt lên tối thượng.

---

## 🛠️ 1. BẢN ĐỒ LỆNH THỰC THI CỐT LÕI (ESSENTIAL CLI COMMANDS)

```bash
# 1. Khởi động toàn bộ hệ thống Local (Docker PostGIS port 5433 + Backend 5001 + Frontend 3000)
./start-local.sh

# 2. Build & Kiểm tra TypeScript
cd frontend && npm run build
cd backend && npm run build

# 3. Bộ 4 Chốt Kiểm Tra Chất Lượng Bắt Buộc (Pre-Release Verification Gateway)
cd frontend && npm run check:zero-any   # Cấm tuyệt đối từ khóa `any` và `as any` (Yêu cầu: 0)
cd frontend && npm run check:ui         # 100% nút `<button>` và phần tử `onClick` có `cursor-pointer`
cd frontend && npm run check:catch      # Cấm empty catch, bắt buộc `console.error('[Tag]...', err)`
cd frontend && npm run check:theme      # Cấm mã hex neutral cứng trong style={{}}, dùng CSS token

# 4. Migration & Kiểm thử API Backend
cd backend && npm run db:migrate
cd backend && npm run test:api
```

---

## 🏛️ 2. KIẾN TRÚC HỆ THỐNG & MÔ HÌNH NGHIỆP VỤ BẤT BIẾN

### 2.1. Mô hình Phân quyền 3 Lớp (Multi-tier RBAC)

1. **Super Admin**: Quản trị toàn tuyến, cấu hình bản đồ quy hoạch GIS tổng thể, phân bổ Zone cho Zone Admin, phê duyệt báo cáo đặc biệt.
2. **Zone Admin**: Quản lý phân khu/nhà ga phụ trách, phân công Surveyor, thẩm định hồ sơ (`Approve`/`Reject` kèm lý do pháp lý), ký số khóa bất biến hồ sơ.
3. **Surveyor (Khảo sát viên hiện trường)**: Điểm danh GPS tại trọng tâm Zone trên PWA, nhập form khảo sát, chụp ảnh kèm thước đo, gắn mã khuyết tật trên bản vẽ CAD (`Defect Pinning`), lấy chữ ký chủ hộ và nộp hồ sơ.

### 2.2. Mô hình Thực thể Hướng đối tượng (1:N Hierarchy)

- **Tòa nhà Mẹ (`parcels` / `GisParcel` / `BuildingMaster`)**: Đại diện cho thửa đất quy hoạch, nhà dân độc lập hoặc khối tháp chung cư. Mang thông tin pháp lý ranh đất, toạ độ GIS (`EPSG:4326`), cự ly tim hầm Metro, hệ móng cọc, tầng hầm, độ nghiêng tổng thể tòa nhà (`buildingTilt`), hồ sơ bản vẽ hoàn công Master.
- **Căn hộ Con (`building_units` / `BuildingUnit`)**: Thực thể con trực thuộc tòa nhà mẹ. **Kế thừa 100% các chỉ số nền tảng từ tòa nhà mẹ** (không khảo sát lại móng cọc, độ nghiêng tổng thể, toạ độ ranh). Chỉ tập trung khảo sát phần sở hữu riêng:
  - Khởi tạo tại Hub: Chỉ thu thập 2 trường **Mã/Số phòng** (VD: `P.402`) và **Tầng/Lầu**.
  - Bộ 4 ảnh căn hộ con: `P-01` (Cửa chính & Biển số phòng - _Bắt buộc_), `P-02` (Mặt đứng khối tháp - _Mặc định N/A, kế thừa tòa mẹ_), `P-03` (Ban công / Logia - _Mặc định N/A_), `P-04` (Toàn cảnh nội thất phòng khách - _Bắt buộc_).
  - Độ nghiêng hiển thị dạng Read-only badge kế thừa từ tòa mẹ; Độ võng dầm/sàn đo cục bộ trong căn hộ.

---

## ⚠️ 3. DANH MỤC 7 LỖI HỆ THỐNG CỐT LÕI CẦN NGĂN CHẶN TRIỆT ĐỂ

1. **Lỗi Lệch Pha Schema Toàn Trình (E2E Schema Drift & Data Drop)**:
   - Hệ thống đi qua 6 tầng: `Form UI -> Zustand Store -> Network Payload -> Zod DTO Schema -> SQL Repository -> Handlebars Report Template`.
   - Mọi thuộc tính mới bắt buộc phải đi qua đủ **7 Chốt chặn E2E Feature Sync** (xem Mục 6.2).
2. **Lỗi Không Gian Địa Lý & Nghịch Đảo Toạ Độ (GIS & Spatial Reference Faults)**:
   - **Nghịch đảo toạ độ**: Leaflet sử dụng `[Latitude, Longitude]`, còn GeoJSON chuẩn và PostGIS (`ST_GeomFromGeoJSON`, `ST_MakePoint`) sử dụng `[Longitude, Latitude]`. Tuyệt đối không truyền nhầm thứ tự!
   - **Chuẩn hệ quy chiếu**: Lưu trữ chuẩn WGS84 (`EPSG:4326`), kiểm tra hình học bằng `ST_IsValid(geom)`, tính khoảng cách bằng hàm cầu (`ST_DistanceSphere` hoặc `::geography`).
   - **Điểm danh GPS**: Server là Single Source of Truth; toạ độ đích bắt buộc là trọng tâm hình học `ST_Centroid(ST_Union(geom))` của đúng Zone được gán, cấm hardcode toạ độ trạm tĩnh.
3. **Lỗi Quá Tải Bộ Nhớ & Crash Safari Mobile (Client Memory Leak)**:
   - Không đóng dấu Watermark hay render canvas nặng trực tiếp trên RAM trình duyệt Mobile Safari.
   - Client chỉ nén ảnh vừa đủ (`max-width: 2048px`, quality 85%); toàn bộ xử lý đóng dấu Watermark và gắn thước đo thực hiện tại **Backend Server**.
4. **Lỗi Tràn Tiến Trình Headless & Vỡ Khung In PDF (Puppeteer Zombie & CSS Break)**:
   - Luôn giải phóng trang Chromium trong khối `try ... finally { if (page) await page.close(); }`.
   - Áp dụng CSS in ấn nghiêm ngặt: `@page { size: A4; margin: 15mm 10mm 15mm 10mm; }`, `.defect-card, .table-summary, .photo-row { page-break-inside: avoid; break-inside: avoid; }`. Ảnh vết nứt có thước đo phải đặt inline cạnh mô tả khuyết tật.
5. **Lỗi Bất Đồng Bộ Form & Ghi Đè Trạng Thái (Async Race Condition)**:
   - Khóa nút Chuyển bước khi `isUploading = true`.
   - Store Zustand phải có bộ chuyển đổi tương thích 2 chiều `camelCase` $\leftrightarrow$ `snake_case` (`unitCode`/`unit_code`, `floorNumber`/`floor_number`).
6. **Lỗi Toàn Vẹn & Khả Năng Giả Mạo Hồ Sơ Pháp Lý (Immutability Violation)**:
   - Khi hồ sơ chuyển sang `SUBMITTED`, `APPROVED` hoặc `LOCKED_IMMUTABLE`, chặn mọi API `PUT / PATCH / DELETE` vào nội dung khảo sát ở tầng Middleware/Repository và lưu mã băm **SHA-256** vào `audit_logs`.
7. **Lỗi Vi Phạm Phân Quyền Giao Diện & Thiếu Chế Độ Chỉ Đọc (UI RBAC Breach)**:
   - Mọi component/modal dùng chung giữa Admin và Surveyor (VD: `BuildingHubModal`, `FloorPlanCadManagementModal`, `ParcelDetailBottomSheet`) **BẮT BUỘC** có prop `readOnly?: boolean`.
   - Khi `readOnly = true`:
     1. Tiêu đề kèm hậu tố `(Chỉ Đọc)` và gắn badge `Khảo Sát Viên` (`bg-sky-950 text-sky-300 border-sky-700`).
     2. Input/Select chuyển thành thẻ hiển thị tĩnh (`<div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-750 text-slate-200 ...">`), không dùng `<input disabled>`.
     3. Ẩn toàn bộ nút thao tác ghi (Upload ảnh/CAD, Đổi file, Xóa phần tử, Nút Lưu). Thay nút Lưu bằng badge `Sơ Đồ Tham Khảo` (`bg-slate-800 text-teal-300 border-teal-500/30 font-bold`).
     4. Empty State chỉ dẫn Surveyor liên hệ Zone Admin, không kêu gọi Surveyor tự upload cấu hình.
     5. Truyền `readOnly={true}` và `onSave={undefined}` xuống các canvas/slicer bên dưới.

---

## 🎨 4. QUY CHUẨN GIAO DIỆN, MÀU SẮC & KỶ LUẬT TYPESCRIPT

### 4.1. Ngôn Ngữ Thiết Kế (Clean Light Mặc Định + Dark Mode Toàn Cục)

- **Mặc định Clean Light** (tối ưu đọc ngoài trời nắng): Header trắng mờ (`bg-white/95 backdrop-blur-md border-b border-slate-200/80`).
- **Dark Mode Toàn Cục**: Lưu tại `localStorage['metro2_theme_preference']`, chỉ thực hiện qua hệ token toàn cục (`html.dark` + CSS variables từ `frontend/theme/themeTokens.js`).
- **CẤM** dùng mã hex neutral cứng (`#fff`, `#f8fafc`, `#f1f5f9`, `#e2e8f0`, `#0f172a`, `#334155`, `#64748b`...) trong `style={{}}`. Dùng class Tailwind hoặc `rgb(var(--bg-*))` / `rgb(var(--text-*))` / `rgb(var(--border-*))`.
- **Vùng giấy kỹ thuật luôn sáng** (`.force-light`): Khung ký tên, canvas CAD / ghim khuyết tật, xem trước báo cáo PDF.

### 4.2. Quy Chuẩn Con Trỏ & Bảng Màu Quy Ước

- **`cursor-pointer` Mandate**: Mọi phần tử có sự kiện nhấp chuột (`<button>`, `onClick`, nút đóng `X`, tab, badge tương tác) **BẮT BUỘC có class `cursor-pointer`**. Khi disabled dùng `disabled:opacity-50 cursor-not-allowed`.
- **Bảng màu Badge chuẩn mực**:
  - **Super Admin**: `bg-purple-950 text-purple-300 border-purple-700`
  - **Zone Admin**: `bg-amber-950 text-amber-300 border-amber-700`
  - **Khảo Sát Viên (Surveyor)**: `bg-sky-950 text-sky-300 border-sky-700`
  - **Người Dân (Citizen / Guest)**: `bg-slate-800 text-slate-300 border-slate-600`
  - **Mã Công Trình / Thửa Đất (`B-XXXXX`, `P-XXXXX`)**: `bg-teal-950 text-teal-300 border-teal-700 font-mono font-bold`
  - **Mã Căn Hộ Con (`P.nnn`)**: `bg-indigo-950 text-indigo-300 border-indigo-700 font-mono font-bold`
  - **Mã Phân Khu / Ga (`Z-01`, `ZONE-05`)**: `bg-cyan-950 text-cyan-300 border-cyan-700 font-mono font-bold`
  - **Đạt / An Toàn / ALLOW / BRA Low**: `bg-emerald-950 text-emerald-300 border-emerald-700`
  - **Cảnh Báo / CONDITIONAL / BRA Medium**: `bg-amber-950 text-amber-300 border-amber-700`
  - **Nguy Hiểm / REJECTED / BRA High / Very High**: `bg-rose-950 text-rose-300 border-rose-700`

### 4.3. Ràng Buộc Nghiệp Vụ Các Bước Khảo Sát

- **Bước 3 (CAD Pinning)**: Nhãn pin chỉ hiển thị mã ngắn gọn: `Z-01` (Zone), `E-01` (Element), `D-01` (Defect).
- **Bước 5 (Biến động Ranh thửa & Đất dư)**: Khi gộp thửa (`MERGE`) có đất dư, tự tính $S_{du} = S_{tong} - S_{xd}$ và tự động sinh 2 thực thể `{Mã}-XD` và `{Mã}-DU`.
- **Bước 6 (Completeness Gate)**: Chỉ chấp nhận `ALLOW` hoặc `CONDITIONAL` (bắt buộc nhập lý do giải trình). Bỏ hoàn toàn `PENDING`.
- **Bước 7 (BRA Risk Matrix)**: Tính đúng ma trận $V \times I \implies$ `LOW`, `MEDIUM`, `HIGH`, `VERY_HIGH`.

### 4.4. Kỷ Luật TypeScript Không Khoan Nhượng (Strict Zero-Any)

- **Zero Any**: Cấm tuyệt đối `any` và `as any`. Dùng interface/type rõ ràng hoặc `unknown` + Type Guard.
- **Module & Env**: Bắt buộc dùng `import type` cho kiểu dữ liệu (`verbatimModuleSyntax: true`) và dùng `import.meta.env.*` (cấm `process.env`).
- **Zero Mock Data**: Cấm hardcode dữ liệu giả định vào component nghiệp vụ thật.

---

## 🛡️ 5. BẢO VỆ CƠ SỞ DỮ LIỆU TUYỆT ĐỐI & KỶ LUẬT DEBUGGING

### 5.1. Nguyên Tắc CSDL Bất Biến (PostgreSQL / PostGIS)

1. **Zero Hard-Delete**: **NGHIÊM CẤM** `DROP TABLE`, `DROP DATABASE`, `TRUNCATE`, hoặc `DELETE FROM` trên các bảng nghiệp vụ (`parcels`, `building_units`, `surveys`, `survey_photos`, `defect_pins`, `cadastral_mutations`, `attendance_records`, `audit_logs`). Bắt buộc dùng **Soft Delete** (`deleted_at IS NULL`).
2. **100% Parameterized Queries**: Cấm cộng chuỗi SQL. Mọi truy vấn phải dùng tham số hóa `$1, $2, ...` trong `pg`.
3. **Mandatory ACID Transaction**: Mọi luồng ghi dữ liệu từ 2 bảng trở lên bắt buộc nằm trong `BEGIN ... COMMIT ... ROLLBACK`.
4. **Idempotent Migration**: File mới trong `backend/database/migrations/YYYYMMDD_*.sql` bắt buộc dùng `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`. Cấm sửa file migration cũ.

### 5.2. Giao Thức Điều Tra Sự Cố & Kỷ Luật Try-Catch

1. **Đọc tự động `app_errors.log`**: Khi người dùng báo lỗi giao diện, màn hình trắng, lỗi API hoặc lỗi xuất báo cáo, **bước đầu tiên bắt buộc** là đọc 100–200 dòng cuối của tệp `app_errors.log` tại thư mục gốc dự án (không bắt người dùng copy-paste log thủ công).
2. **Truy vết ngược 6 tầng**: Kiểm tra tuần tự `UI Component -> Zustand Store -> Axios API -> Zod DTO -> SQL Transaction -> Puppeteer Report`.
3. **Sáu điều cấm trong bắt lỗi**:
   - ❌ Cấm `catch (e) {}` rỗng.
   - ❌ Cấm nuốt lỗi âm thầm (`return null/[]/false` mà không log).
   - ❌ Cấm log vô danh (`console.error(e)`); bắt buộc có tag ngữ cảnh: `console.error('[ModuleName:Action] ...', err)` và dùng `getErrorMessage(err)` từ `@/utils/errorUtils`.
   - ❌ Cấm chỉ hiện Toast/Alert mà không log lỗi ra Console F12.
   - ❌ Cấm gán fake fallback (`value || 0`, `value || "Bình thường"`) cho số liệu đo đạc kết cấu pháp lý.
   - ❌ Cấm xóa điều kiện kiểm tra để lách qua Completeness Gate.

---

## 🔄 6. QUY TRÌNH PHÁT TRIỂN TOÀN TRÌNH & KỶ LUẬT GIT

### 6.1. Giao Thức Thiết Kế Theo Hợp Đồng (Workflow 0 — Contract Protocol)

Trước khi viết code hoặc thay đổi CSDL, phải xác lập rõ 4 thành tố:

1. **Preconditions**: Quyền hạn RBAC, bảng/cột CSDL tiền đề, trạng thái hồ sơ (`DRAFT`/`APPROVED`), chế độ `readOnly`.
2. **Invariants**: Zero-Any, Soft-Delete, Parameterized SQL, ACID Transaction, `cursor-pointer`, chuẩn toạ độ `EPSG:4326`.
3. **Postconditions**: Kết quả Happy Path (DB, Zustand, Toast) và Error Path (Rollback, log `[ContextTag]`, bảo toàn dữ liệu đã nhập).
4. **Verification Strategy**: Kịch bản Happy Path, Edge Cases và chạy bộ 4 script kiểm tra.

### 6.2. Quy Trình Đồng Bộ Trường Dữ Liệu 7 Chốt Chặn (Workflow 1 — E2E Feature Sync)

Khi thêm/sửa/xóa bất kỳ trường dữ liệu nào trong form khảo sát, bắt buộc đi qua đủ 7 chốt:

1. **Chốt 1 (Domain Type Contract)**: Khai báo kiểu `camelCase` tại `frontend/src/features/survey-phase1/types/phase1.types.ts`.
2. **Chốt 2 (Database Migration)**: Cập nhật `database/init_schema.sql` và tạo migration `snake_case` mới với `ADD COLUMN IF NOT EXISTS`.
3. **Chốt 3 (Backend Repository)**: Bổ sung cột và biến `$1..$N` vào cả `INSERT INTO` và `UPDATE` trong `survey.repository.ts` (ép kiểu số an toàn).
4. **Chốt 4 (Backend DTO & Controller)**: Khai báo trong Zod Schema và bóc tách từ `req.body` trong `survey.controller.ts`.
5. **Chốt 5 (Frontend Store & UI Binding)**: Cập nhật Zustand store (`usePhase1SurveyStore.ts`) và liên kết `value`/`onChange` trên Component.
6. **Chốt 6 (Report Generator & Handlebars)**: Map biến vào ViewModel (`*.generator.ts`) và hiển thị trong `.hbs` kèm fallback `{{#if field}}{{field}}{{else}}---{{/if}}`.
7. **Chốt 7 (E2E Integration Audit)**: Kiểm tra toàn trình từ UI $\to$ Submit $\to$ DB $\to$ PDF.

### 6.3. Kỷ Luật Nhánh Git & Bàn Giao (Workflow 4 — Git Branch Mandate)

- **Mặc định**: Toàn bộ công việc commit và push lên remote **CHỈ ĐƯỢC PHÉP thực hiện trên nhánh `dev`** (`git push origin dev`).
- **Nghiêm cấm tuyệt đối**: KHÔNG ĐƯỢC tự ý checkout sang `main`, merge `dev` vào `main`, hoặc push lên `origin main` khi chưa có yêu cầu trực tiếp, rõ ràng bằng văn bản từ Người dùng.
- **Conventional Commits**: Đặt message chuẩn mực (`feat(survey): ...`, `fix(ui): ...`).

---

## 📚 7. THAM CHIẾU TÀI LIỆU QUY TẮC & AGENT SKILLS TRONG DỰ ÁN

Khi thực hiện tác vụ chuyên sâu, hãy chủ động tham chiếu các tài liệu quy chuẩn và skills sẵn có của dự án:

- **Quy chuẩn Hệ thống gốc (`.agents/rules/`)**:
  - [`.agents/rules/architectural_standards_and_system_rules.md`](.agents/rules/architectural_standards_and_system_rules.md)
  - [`.agents/rules/system_workflows.md`](.agents/rules/system_workflows.md)
  - [`.agents/rules/systematic_debugging_and_incident_protocol.md`](.agents/rules/systematic_debugging_and_incident_protocol.md)
- **Skills Chuyên sâu của Dự án (`.agents/skills/` & `~/.claude/skills/`)**:
  - `convert-idea`: Chuyển đổi ý tưởng tự nhiên/mông lung thành bản đặc tả giao task chính xác (đúng `file:dòng`, tên hàm, state, API, cột DB) để giao cho Agent tốn ít token suy luận nhất.
  - `grill-me`: Vấn đáp phản biện từng câu một để làm rõ logic nghiệp vụ và bắt edge-case trước khi code.
  - `bcs-report-exporter`: Quy chuẩn xuất báo cáo khảo sát Phase 1 chuẩn Liên danh CRLG-CRSRI-TT (Puppeteer & 3 templates).
  - `systematic-debugging`: Quy trình điều tra nguyên nhân gốc rễ (RCA) và xử lý sự cố.
  - `postgres-best-practices`: Tối ưu hóa PostgreSQL/PostGIS và an toàn giao dịch.
  - `zod-validation-expert`: Thiết kế schema validation và DTO contracts.
  - `zustand-store-ts`: Quản trị state Zustand chuẩn TypeScript.
  - `puppeteer-skill`: Tự động hóa Chromium headless và xuất PDF khổ A4.
  - `react-patterns`: Kiến trúc React 18, composition và tối ưu hiệu năng.
  - `api-security-best-practices`: Bảo mật API, xác thực và phân quyền RBAC.
