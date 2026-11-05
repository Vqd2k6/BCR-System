---
name: convert-idea
description: >-
  Chuyển đổi mô tả ý tưởng tự nhiên, ngắn gọn hoặc còn mông lung của người dùng thành một bản mô tả
  nghiệp vụ và kỹ thuật chính xác, ngắn gọn, gắn chặt với code hiện thực (đúng đường dẫn file, dòng code,
  tên hàm, state, API, cột DB) để giao task trực tiếp cho coding agent mà tốn ít token suy luận nhất.
  Kích hoạt khi người dùng gọi /convert-idea, hoặc nói "convert idea", "chuyển ý tưởng", "chuẩn hóa yêu cầu",
  "viết lại mô tả task", "biến mô tả này thành prompt giao task", "viết spec ngắn gọn từ ý tưởng này".
---

# Convert Idea — Chuyển Ý Tưởng Tự Nhiên Thành Đặc Tả Giao Task Tối Ưu Token

Mục tiêu: Người dùng chỉ cần nói ý tưởng bằng ngôn ngữ tự nhiên đơn giản. Bạn đọc nhanh code hiện thực để neo mọi khái niệm mông lung vào đúng thực thể trong codebase, rồi xuất ra một **Prompt Giao Task ngắn gọn, chính xác tuyệt đối** để Agent thực thi bắt tay vào sửa đúng chỗ ngay lập tức mà không tốn token dò tìm hay tự suy diễn.

**Không sửa code dự án trong bước này.** Sản phẩm duy nhất là bản đặc tả giao task đã được neo vào code thật.

---

## 1. Quy trình 3 bước (Thực hiện nhanh, ít đọc thừa)

### Bước 1: Định vị Code hiện thực (Fast Code Grounding)
1. Đọc [references/metro2-code-map.md](references/metro2-code-map.md) để xác định ngay phân hệ liên quan mà không cần quét toàn bộ repo.
2. Dùng công cụ tìm kiếm (`grep` / `read_file`) nhảy thẳng vào các file đích để lấy **tên thật trong code**:
   * **UI / Component**: Đường dẫn file `.tsx`, tên component, dòng code (`file:dòng`), các props hiện có (đặc biệt là `readOnly`).
   * **State / Store**: Store nào (`usePhase1SurveyStore`, `useCondoMasterSurveyStore`, `useCondoUnitSurveyStore`), tên trường `camelCase` và action cập nhật.
   * **API / Backend**: Route nào, hàm nào trong Controller/Service/Repository, Zod schema nào.
   * **Database**: Bảng nào (`parcels`, `building_units`, `surveys`, `survey_photos`, `defect_pins`,...), tên cột `snake_case` hay nằm trong `survey_data_json`.
   * **Báo cáo (nếu liên quan)**: Generator nào (`residential`, `condo-master`, `condo-unit`) và file `.hbs` nào.

### Bước 2: Khử mơ hồ & Tự động gắn quy chuẩn dự án
1. **Tự động điền các ràng buộc bất biến từ `CLAUDE.md`** vào bản đặc tả mà không hỏi lại người dùng:
   * Phân quyền 3 lớp (`Super Admin`, `Zone Admin`, `Surveyor`) & prop `readOnly?: boolean` nếu component dùng chung.
   * Ranh giới thực thể: Nhà dân (`survey-phase1`), Tòa mẹ (`survey-condo-master`), Căn hộ con (`survey-condo-unit` — kế thừa móng/nghiêng/tọa độ từ tòa mẹ).
   * Bất biến pháp lý: Chặn ghi khi hồ sơ đã `APPROVED` / `LOCKED_IMMUTABLE`; nếu Zone Admin sửa ở `SUBMITTED`/`UNDER_REVIEW` phải qua luồng audit.
   * Kỷ luật kỹ thuật: Zero-Any, `import type`, `cursor-pointer`, CSS token (không mã hex neutral cứng), `console.error('[Tag]...', err)`, Soft Delete (`deleted_at IS NULL`), SQL tham số hóa `$1..$N`, ACID Transaction.
2. **Khi nào mới hỏi lại người dùng?**
   * Mọi thứ tra được từ code thì **cấm hỏi**.
   * Chỉ dừng lại hỏi tối đa **1–2 câu cực ngắn (kèm phương án khuyến nghị)** khi ý tưởng của người dùng có thể hiểu theo 2 hướng nghiệp vụ hoàn toàn trái ngược nhau, hoặc mâu thuẫn trực tiếp với logic đang chạy trong code (`file:dòng`).
   * Nếu ý tưởng đã rõ hướng, xuất thẳng bản đặc tả ngay trong lượt đầu tiên.

### Bước 3: Xuất "Prompt Giao Task Tối Ưu Token"
Trình bày đầu ra trong một khối code markdown (` ```markdown ... ``` `) để người dùng copy giao thẳng cho Agent (hoặc gõ "thực thi luôn").

---

## 2. Khuôn mẫu đầu ra (Bắt buộc ngắn gọn, mật độ thông tin cao)

Viết súc tích theo đúng 4 mục dưới đây. Bỏ các câu dẫn dắt rườm rà; mỗi gạch đầu dòng phải chỉ thẳng vào tên biến, tên hàm, đường dẫn file thật:

````markdown
# TASK: <Tiêu đề ngắn gọn, rõ hành động>

## 1. Nghiệp vụ cốt lõi
- **Tác nhân & Bối cảnh**: <Vai trò (Surveyor / Zone Admin / Super Admin) · Màn hình / Bước khảo sát · Luồng thực thể (Nhà dân / Tòa mẹ / Căn hộ con)>.
- **Hành vi hiện tại**: <Mô tả 1 câu trạng thái code đang chạy tại `file:dòng`>.
- **Hành vi cần đạt**: <Mô tả chính xác điều phải xảy ra khi thao tác thành công và khi gặp lỗi>.

## 2. Định vị Code đích (Agent sửa thẳng, không cần tìm kiếm lại)
- **Frontend UI**: `<path/to/Component.tsx:dòng>` — `<tên component / hàm xử lý>`
- **Frontend Store / Types**: `<path/to/store.ts:dòng>` — `<tên state / action / interface>`
- **Backend DTO / Controller / Service**: `<path/to/file.ts:dòng>` — `<tên schema / hàm>`
- **Repository / Database**: `<path/to/repository.ts:dòng>` · Bảng `<table_name>`, cột `<column_name>`
- **Report Engine** *(nếu có)*: `<path/to/generator.ts:dòng>` & `<path/to/template.hbs:dòng>`
*(Chỉ liệt kê các tầng thật sự bị tác động bởi task này)*

## 3. Chi tiết thực thi từng bước
1. **[Tầng 1 - ...]**: <Chỉ dẫn cụ thể: thêm/sửa trường gì, kiểu dữ liệu gì, điều kiện rẽ nhánh ra sao>.
2. **[Tầng 2 - ...]**: <Chỉ dẫn cụ thể: câu query SQL `$1..$N`, mapping `camelCase` <-> `snake_case`, xử lý UI `readOnly`>.
3. **[Tầng 3 - ...]**: <...>.

## 4. Ca biên (Edge Cases) & Tiêu chí nghiệm thu
- **Chặn ca biên**: <Nêu 2–3 ca biên cụ thể của task: ví dụ hồ sơ đã `APPROVED`, giá trị `null` không được gán giả `0`, đang `isUploading` không cho chuyển bước, thứ tự tọa độ `[lat, lng]` vs `[lng, lat]`>.
- **Kiểm tra bắt buộc**: `cd frontend && npm run build && npm run check:zero-any && npm run check:ui && npm run check:catch && npm run check:theme` (và `cd backend && npm run build` nếu sửa backend).
````

---

## 3. Nguyên tắc giữ bản đặc tả tốn ít token nhất cho Agent nhận task
1. **Neo bằng địa chỉ thật (`file:dòng` + tên symbol)**: Khi Agent nhận task đã biết chính xác `frontend/src/features/survey-phase1/store/usePhase1SurveyStore.ts:142`, nó chỉ cần `read_file` đúng đoạn đó thay vì gọi 10 lệnh `grep`/`find`.
2. **Nêu rõ tên biến ở cả 2 đầu**: Viết rõ `foundationDepthM` (FE) $\leftrightarrow$ `foundation_depth_m` (DB `surveys`) để Agent không tự đặt tên lệch nhau.
3. **Loại bỏ lý thuyết chung chung**: Không chép lại toàn bộ nội dung `CLAUDE.md` vào prompt giao task; chỉ ghi những ràng buộc trực tiếp chạm vào các file của task đó.

