---
trigger: model_decision
---

# HỆ THỐNG QUY TRÌNH TOÀN TRÌNH (SYSTEM WORKFLOWS) - METRO 2 BCS PLATFORM

Tài liệu này định nghĩa chi tiết **5 Quy trình Vận hành & Phát triển Cốt lõi (Core Workflows)** của nền tảng, thiết lập các chốt chặn chất lượng để đảm bảo tính đồng bộ toàn trình, tính bất biến pháp lý và hiệu năng hệ thống.

---

## 📐 WORKFLOW 0: GIAO THỨC THIẾT KẾ THEO HỢP ĐỒNG (PRE/POSTCONDITIONS & INVARIANTS PROTOCOL)
*(Áp dụng BẮT BUỘC trước khi triển khai bất kỳ tính năng hoặc thực hiện một phần nhiệm vụ nào)*

Trước khi viết bất kỳ dòng mã nào hoặc thực thi câu lệnh thay đổi CSDL, Agent **BẮT BUỘC** phải công bố và phân tích rõ 4 thành tố sau trong kế hoạch:

```mermaid
graph LR
    Pre["1. Preconditions<br/>(Tiền điều kiện)"] --> Inv["2. Invariants<br/>(Ràng buộc bất biến)"]
    Inv --> Post["3. Postconditions<br/>(Hậu điều kiện)"]
    Post --> Test["4. Test Strategy<br/>(Kiểm thử toàn diện)"]
```

### 1. Preconditions (Tiền Điều Kiện)
* **Xác thực vai trò & quyền hạn (RBAC)**: Tác vụ này thuộc thẩm quyền của ai (`Super Admin`, `Zone Admin`, `Surveyor`, hay `Guest`)?
* **Dữ liệu & CSDL tiền đề**: Bảng, cột, trigger nào trong PostgreSQL phải tồn tại? Khóa ngoại và quan hệ cha con (`parcels` $\to$ `building_units`) đã sẵn sàng chưa?
* **Trạng thái hệ thống**: Form đang ở trạng thái nào (`DRAFT`, `SUBMITTED`, `APPROVED`)? Component đang ở chế độ nào (`readOnly=true` hay `false`)?

### 2. Postconditions (Hậu Điều Kiện)
* **Trạng thái sau khi hoàn thành**:
  * **Thành công (Happy Path)**: Bản ghi nào được tạo/cập nhật trong DB? Cột nào nhận giá trị gì? Store Zustand lưu state nào? Giao diện hiển thị thông báo/toast gì? Có chuyển step hay đóng modal không?
  * **Thất bại (Error Path)**: Nếu mạng đứt, payload sai schema hoặc DB rollback, hệ thống xử lý ra sao? Lỗi có được hiển thị bằng ngôn ngữ tự nhiên không? Lỗi **bắt buộc** phải được `console.error('[ContextTag] ...', err)` xuất ra console F12 kèm đối tượng lỗi gốc. Tuyệt đối cấm khối `catch` rỗng hoặc nuốt lỗi âm thầm. Dữ liệu đã nhập trên form có được bảo toàn nguyên vẹn trong store/IndexedDB không?

### 3. Invariants & Safety Constraints (Ràng Buộc Bất Biến & An Toàn)
* **Bảo vệ CSDL**: Tuyệt đối không xóa cứng dữ liệu (`deleted_at IS NULL`), câu lệnh SQL phải dùng tham số hóa `$1..$N`, các tác vụ đa bảng bắt buộc nằm trong `BEGIN ... COMMIT ... ROLLBACK`.
* **Kỷ luật Mã nguồn**: Tuyệt đối 0 `any`, 0 `as any`, không dùng `process.env`, `import type` chuẩn mực.
* **Kỷ luật Bắt lỗi**: Không có khối catch rỗng; mọi khối catch phải có `console.error` hoặc `throw`.
* **Bảo vệ ranh giới UI**: Surveyor tuyệt đối không được cấp nút thao tác ghi trong các component dùng chung. Toàn bộ nút bấm phải có `cursor-pointer`.
* **Toàn vẹn Không gian**: Giữ chuẩn toạ độ WGS84 (EPSG:4326), không nghịch đảo `[lat, lng]`.

### 4. Verification & Comprehensive Test Strategy (Chiến Lược Kiểm Thử Toàn Diện)
* Kịch bản Happy Path (kiểm tra đầy đủ luồng nghiệp vụ chuẩn).
* Kịch bản Edge Cases (dữ liệu rỗng, vượt giới hạn ký tự, mất mạng, token hết hạn).
* Bộ lệnh kiểm thử tự động bắt buộc: `npm run build`, `npm run check:zero-any`, `npm run check:ui`, `npm run check:catch`.

---

## 🔄 WORKFLOW 1: QUY TRÌNH PHÁT TRIỂN & ĐỒNG BỘ TRƯỜNG DỮ LIỆU TOÀN TRÌNH (E2E FEATURE SYNC WORKFLOW)

Quy trình này bắt buộc áp dụng khi **thêm mới, sửa đổi hoặc xóa bất kỳ trường dữ liệu nào** trong form khảo sát. Lập trình viên hoặc Agent **BẮT BUỘC** đi qua đủ 7 chốt chặn theo đúng thứ tự:

```mermaid
graph TD
    A["Chốt 1: Domain Type Contract<br/>(phase1.types.ts)"] --> B["Chốt 2: Database Migration<br/>(init_schema.sql & migrations/)"]
    B --> C["Chốt 3: Backend Repository<br/>(survey.repository.ts - SQL Queries)"]
    C --> D["Chốt 4: Backend DTO & Controller<br/>(Zod Schema & Controller mapping)"]
    D --> E["Chốt 5: Frontend Store & UI Binding<br/>(Zustand store & Input Component)"]
    E --> F["Chốt 6: Report Generator Engine<br/>(ViewModel Builder & Handlebars Template)"]
    F --> G["Chốt 7: E2E Integration Audit<br/>(Verify UI -> Submit -> DB -> PDF)"]
```

### Chi tiết 7 Chốt Chặn Kiểm Tra:

#### Chốt 1: Khai báo Domain Contract tại Frontend
* Tệp: `frontend/src/features/survey-phase1/types/phase1.types.ts` (hoặc types tương ứng).
* Xác định rõ kiểu dữ liệu: `string`, `number`, `boolean`, `string[]`, hoặc Enum.
* Tên trường tại Frontend sử dụng quy ước `camelCase` (ví dụ: `foundationDepthM`, `hasBasement`).

#### Chốt 2: CSDL & Migration (PostgreSQL / PostGIS)
* Tệp: `database/init_schema.sql` và tạo tệp migration mới trong `backend/database/migrations/YYYYMMDD_feature_name.sql`.
* Chọn kiểu dữ liệu SQL tương thích:
  * Số thực / Đo đạc: `NUMERIC(10, 2)` hoặc `DOUBLE PRECISION`.
  * Số nguyên: `INT` hoặc `SMALLINT`.
  * Logic: `BOOLEAN DEFAULT FALSE`.
  * Văn bản / Ghi chú: `TEXT` hoặc `VARCHAR(255)`.
  * Hình học không gian: `geometry(Geometry, 4326)`.
* Tên cột tại CSDL sử dụng quy ước `snake_case` (ví dụ: `foundation_depth_m`, `has_basement`).
* Cập nhật CSDL đang chạy qua Docker:
  ```bash
  docker exec metro2_postgres_postgis psql -U metro2_user -d metro2_gis_db -c "ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...;"
  ```

#### Chốt 3: Backend Repository & Truy vấn SQL
* Tệp: `backend/src/modules/survey/survey.repository.ts`.
* Cập nhật cả 2 câu lệnh:
  1. Câu lệnh `INSERT INTO`: Bổ sung tên cột vào danh sách cột và thêm biến tham số (`$1, $2, ...`).
  2. Câu lệnh `UPDATE`: Bổ sung gán giá trị (`column_name = $X`).
* Xử lý chuyển đổi kiểu an toàn trước khi gán tham số:
  * Tránh lỗi ép kiểu chuỗi rỗng vào cột số: `payload.foundationDepthM !== undefined && payload.foundationDepthM !== '' ? Number(payload.foundationDepthM) : null`.

#### Chốt 4: Backend Controller & Zod Validation DTO
* Tệp: `backend/src/modules/survey/survey.controller.ts` & file Zod Schema tương ứng.
* Bổ sung trường vào Zod Schema validation:
  ```typescript
  foundationDepthM: z.number().nullable().optional()
  ```
* Kiểm tra hàm bóc tách payload từ `req.body`: Đảm bảo trường mới được lấy ra và gán vào DTO truyền xuống Service/Repository. *(Lỗi rụng dữ liệu hay gặp nhất: FE có gửi nhưng Controller không hứng)*.

#### Chốt 5: Frontend Store & UI Data Binding
* Tệp: Store tương ứng (ví dụ: `usePhase1SurveyStore.ts`) và Component giao diện.
* Kiểm tra thẻ nhập liệu `<input>`, `<select>`, `<textarea>`:
  * Thuộc tính `value` phải liên kết trực tiếp với biến trong `formData` của store.
  * Sự kiện `onChange` phải gọi hàm update của store (ví dụ: `updateFormData({ foundationDepthM: e.target.value })`).
  * Đảm bảo giá trị mặc định (default value) không bị `undefined`.

#### Chốt 6: Report Generator Engine & Handlebars Template
* Tệp: `backend/src/modules/report/generators/residential.generator.ts` và template `.hbs` tương ứng.
* Khớp biến vào ViewModel: Map trường từ Entity Database sang đối tượng truyền vào template Handlebars.
* Cập nhật tệp Handlebars: Hiển thị trường trên bảng kỹ thuật của báo cáo, xử lý fallback nếu không có dữ liệu: `{{#if foundationDepthM}}{{foundationDepthM}} m{{else}}---{{/if}}`.

#### Chốt 7: Kiểm thử Toàn trình & Báo cáo
* Chạy thử luồng nhập liệu từ form $\rightarrow$ Bấm lưu $\rightarrow$ Kiểm tra Network payload trong DevTools $\rightarrow$ Kiểm tra bản ghi trong Postgres $\rightarrow$ Bấm xuất PDF kiểm tra hiển thị.

---

## 📋 WORKFLOW 2: VÒNG ĐỜI DỮ LIỆU KHẢO SÁT & MÁY TRẠNG THÁI (SURVEY STATE MACHINE WORKFLOW)

Quy trình quản lý vòng đời một bộ hồ sơ khảo sát công trình từ thực địa đến lưu trữ pháp lý:

```mermaid
stateDiagram-v2
    [*] --> DRAFT_OFFLINE: Khởi tạo trên PWA (IndexedDB)
    DRAFT_OFFLINE --> CHECKED_IN_GPS: Điểm danh GPS tại Zone (Centroid <= R)
    CHECKED_IN_GPS --> IN_SURVEY: Nhập liệu, Chụp ảnh Watermark, Pinning CAD
    IN_SURVEY --> COMPLETENESS_CHECK: Chạy cổng kiểm tra dữ liệu (Bước 6)
    
    COMPLETENESS_CHECK --> IN_SURVEY: Không đạt điều kiện
    COMPLETENESS_CHECK --> READY_FOR_SUBMIT: ALLOW (Đạt 100%) hoặc CONDITIONAL (Kèm giải trình)
    
    READY_FOR_SUBMIT --> SUBMITTED: KSV ký số & Gửi hồ sơ lên Cloud
    
    SUBMITTED --> UNDER_REVIEW: Zone Admin mở hồ sơ kiểm duyệt
    UNDER_REVIEW --> REJECTED: Phát hiện sai sót / Trả về hiện trường (Kèm lý do)
    REJECTED --> IN_SURVEY: KSV bổ sung số liệu
    
    UNDER_REVIEW --> APPROVED: Zone Admin thẩm định đạt & Ký số
    APPROVED --> LOCKED_IMMUTABLE: Băm mã SHA-256 toàn bộ hồ sơ
    LOCKED_IMMUTABLE --> REPORT_PUBLISHED: Xuất Báo cáo PDF/DOCX chuẩn pháp lý
    REPORT_PUBLISHED --> [*]
```

### Các Quy tắc Vận hành Trạng thái:
1. **Khởi tạo & Check-in GPS**:
   * Surveyor phải nằm trong bán kính cho phép tính từ trọng tâm hình học (`ST_Centroid`) của Zone phân công.
2. **Cổng Kiểm Tra Dữ Liệu (Completeness Gate)**:
   * Chỉ cho phép nộp khi cổng trả về `ALLOW` hoặc `CONDITIONAL`.
   * Nếu là `CONDITIONAL`: Bắt buộc phải có chuỗi giải trình lý do (ví dụ: *Chủ nhà đi vắng không vào được tầng 3*).
3. **Thẩm Định & Bất Biến (Immutability)**:
   * Khi trạng thái chuyển sang `APPROVED`, toàn bộ dữ liệu bị **LOCK** (Chặn toàn bộ API cập nhật).
   * Hệ thống sinh mã băm SHA-256 trên nội dung hồ sơ và chữ ký 3 bên (Chủ hộ, Surveyor, Zone Admin) để bảo chứng pháp lý trước Tòa án khi thi công metro.

---

## 📑 WORKFLOW 3: QUY TRÌNH KẾT XUẤT BÁO CÁO PHÁP LÝ (TECHNICAL REPORT EXPORT PIPELINE)

Quy trình tự động hóa chuyển đổi dữ liệu khảo sát thành Báo cáo kỹ thuật chuẩn Liên danh CRLG-CRSRI-TT:

```mermaid
sequenceDiagram
    autonumber
    actor Client as Client / Admin Portal
    participant API as Report Controller
    participant Engine as Report Generator
    participant S3 as AWS S3 Storage
    participant Puppeteer as Chromium Headless

    Client->>API: GET /api/reports/export/:parcelId?format=pdf
    API->>Engine: buildViewModel(parcelId)
    Engine->>Engine: Tổng hợp dữ liệu DB, tính điểm BRA, chuẩn hóa lưới ảnh
    Engine->>Engine: Compile Handlebars HTML Template với CSS A4 Paged Media
    
    alt Định dạng PDF
        Engine->>Puppeteer: newPage() -> setContent(html)
        Engine->>Puppeteer: page.pdf(format: 'A4', printBackground: true)
        Puppeteer-->>Engine: PDF Buffer
        Engine->>Puppeteer: page.close()
    else Định dạng DOCX
        Engine->>Engine: docx.DocumentGenerator.create(viewModel)
        Engine-->>Engine: DOCX Buffer
    end
    
    Engine->>S3: Upload file báo cáo (Key: reports/parcel_id_timestamp.pdf)
    S3-->>Engine: S3 Object Key
    Engine->>API: Sinh Presigned Download URL (Hạn 15 phút)
    API-->>Client: 200 OK { downloadUrl, sha256Checksum }
```

### Tiêu Chuẩn Kỹ Thuật Khi Xuất Báo Cáo:
1. **Bố cục Ngắt Trang (CSS Paged Media)**:
   * Thiết lập `@page { size: A4; margin: 15mm 10mm 15mm 10mm; }`.
   * Các khối khuyết tật, bảng điểm BRA, cặp ảnh bối cảnh (CTX) và ảnh cận (CU) bắt buộc dùng:
     ```css
     .defect-card, .table-summary, .photo-row {
       page-break-inside: avoid;
       break-inside: avoid;
     }
     ```
2. **Inline Evidence Layout**:
   * Ảnh vết nứt có thước đo phải nằm trực tiếp trên cùng hàng hoặc bên cạnh mô tả khuyết tật, không dồn hết ảnh về cuối tài liệu.
3. **Quản lý Vòng đời Puppeteer**:
   * Phải bọc khối xử lý Puppeteer trong `try ... finally { if (page) await page.close(); }` để triệt tiêu tiến trình Chromium mồ côi (Zombie processes).

---

## 🛡️ WORKFLOW 4: QUY TRÌNH KIỂM SOÁT CHẤT LƯỢNG & BÀN GIAO (PRE-RELEASE VERIFICATION GATEWAY)

Trước khi nghiệm thu bất kỳ tính năng hoặc bugfix nào, Agent và Kỹ sư phải thực hiện đúng **8 bước kiểm thử nghiêm ngặt**:

1. **Kiểm tra TypeScript & Clean Build**:
   * Frontend: `cd frontend && npm run build` (Exit code = 0, dist bundle sinh đầy đủ).
   * Backend: `cd backend && npm run build` (Exit code = 0).

2. **Kiểm tra Kỷ luật Zero-Any (AST Scan)**:
   * Chạy script: `cd frontend && npm run check:zero-any`
   * *Yêu cầu bắt buộc:* `Total AnyKeyword count: 0` và `Total as any matches: 0`.

3. **Kiểm tra Kỷ Luật Bắt Lỗi & Minh Bạch Observability (Catch Clause Audit)**:
   * Chạy script: `cd frontend && npm run check:catch`
   * *Yêu cầu bắt buộc:* Không để phát sinh khối `catch` rỗng mới, mọi khối `catch` phải có `console.error('[ContextTag] ...', err)` hoặc `throw err`.

4. **Kiểm tra Tương Tác UI & Con Trỏ Chuột (`cursor-pointer`)**:
   * Chạy script: `cd frontend && npm run check:ui`
   * *Yêu cầu bắt buộc:* 100% các nút `<button>` và phần tử có `onClick` phải có class `cursor-pointer`.

5. **Kiểm tra Phân Quyền Giao Diện (UI RBAC & ReadOnly Audit)**:
   * Đối với các component/modal dùng chung: Kiểm thử mở với `readOnly=true` (vai trò Surveyor).
   * Xác nhận không còn nút upload ảnh/CAD, nút xóa, nút sửa tên hoặc nút Submit/Lưu nào xuất hiện.

6. **Kiểm tra Tính Toàn Vẹn CSDL & An Toàn Migration (Database Safety)**:
   * Mọi câu lệnh SQL thêm cột phải có mệnh đề phòng vệ: `ADD COLUMN IF NOT EXISTS`.
   * Tuyệt đối không có lệnh `DROP TABLE`, `TRUNCATE`, `DELETE` cứng.
   * Các tác vụ ghi nhiều bảng bắt buộc nằm trong Transaction (`BEGIN ... COMMIT ... ROLLBACK`).

7. **Kiểm tra Không có Lỗi Hồi quy (Zero Regression)**:
   * Xác nhận tính tương thích với cả 3 luồng: Nhà dân thông thường, Tòa nhà chung cư mẹ, và Căn hộ con.
   * Xác nhận 5 module GPS không bị ảnh hưởng chéo.

8. **Chuẩn hóa Commit**:
   * Tuân thủ chuẩn Conventional Commits (ví dụ: `feat(survey): sync foundation depth field e2e`, `fix(ui): enforce cursor pointer and readOnly mode`).
