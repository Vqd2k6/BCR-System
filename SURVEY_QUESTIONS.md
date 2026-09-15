# Bộ câu hỏi & Biểu mẫu Khảo sát Hiện trạng Công trình (KSQH - Metro 2)

Dưới đây là toàn bộ danh sách các câu hỏi, trường thông tin và thao tác cần thu thập tại hiện trường. **Trình tự khảo sát và các Chuẩn Enum được tối ưu khớp 100% giữa Lúc Thu Thập ➔ Bảng Tính Điểm Kỹ Thuật (ECS / Burland / BRA)** giúp tự động hóa toàn bộ quá trình tính điểm mà không bị lệch chuẩn.

---

## PHẦN A: KHẢO SÁT GIAI ĐOẠN 1 (PHASE 1 - Sơ bộ & Rủi ro)

### Bước 1: Đến nơi và Nhận diện (Ngoài công trình)
*Lúc này cán bộ đang đứng trước công trình để đối chiếu địa chỉ và thông tin định danh.*
- [ ] **Mã công trình (Building ID):** (Kế thừa từ hệ thống phân công)
- [ ] **Tên công trình (Building Name):** (Nhập text - VD: Nhà ở gia đình, Trụ sở Cty A, Trường học...)
- [ ] **Địa chỉ (Address):** (Nhập text - Đối chiếu thực tế với sơ đồ quy hoạch)
- [ ] **Chủ sở hữu / Người sử dụng (Owner / User):** (Nhập text tên chủ nhà hoặc người đại diện)
- [ ] **Nhóm đối tượng (Importance Group):** (Chọn: General - Thông thường / Important - Quan trọng / Critical - Rất quan trọng)
- [ ] **Công trình liền kề (Adjacent Structures):** (Chọn: Nhà phố / Cao tầng / Công cộng / Đất trống / Khác)
- [ ] **Thông tin tuyến Metro & GIS (Hệ thống tự động tính từ GPS):**
  - Lý trình (Chainage): (Tự động)
  - Khoảng cách tới tim tuyến Metro: (Tự động)
  - Khoảng cách tới ranh giải phóng mặt bằng: (Tự động)
  - Tọa độ GPS / GIS: (Tự động bắt khi check-in)
- [ ] **Chụp ảnh định danh:**
  - `P-01`: Chụp biển số nhà / Biển tên cơ quan (Có Watermark GPS & Thời gian).
  - `P-02`: Chụp mặt đứng chính (Có Watermark GPS, cho phép ghi chú / vẽ kích thước trực tiếp lên ảnh).
  - `P-03`: Chụp mặt bên hoặc mặt sau tiếp cận (Có Watermark GPS, cho phép ghi chú / vẽ kích thước).
  - `P-04`: Chụp bối cảnh tổng thể lấy cả đường/ngõ.

### Bước 2: Đánh giá Kiến trúc & Kết cấu cơ bản
*Quan sát ngoại quan và bước vào trong để ghi nhận các thông số kết cấu chính.*
- [ ] **Công năng sử dụng (Use):** (Chọn: Nhà ở / Cửa hàng / Văn phòng / Khách sạn / Công cộng / Khác)
- [ ] **Số tầng:**
  - Số tầng nổi: (Nhập số)
  - Số tầng hầm: (Nhập số)
- [ ] **Năm xây dựng / Tuổi thọ (Age):** (Nhập số năm - Tick chọn "Ước tính" nếu chủ nhà không nhớ chính xác)
- [ ] **Hệ kết cấu chịu lực (Structural System):** (Chọn: RC - Bê tông cốt thép / Steel - Khung thép / Masonry - Tường gạch chịu lực / Mixed - Hỗn hợp / Other - Khác)
- [ ] **Dạng chịu lực (Form):** (Chọn: Frame - Hệ khung chịu lực / Wall - Tường chịu lực / Mixed - Hỗn hợp / Other - Khác)
- [ ] **Loại móng (Foundation):** (Chọn: Shallow - Móng nông / Wood - Cọc gỗ/cừ tràm / PC - Cọc BTCT đúc sẵn / CIP - Cọc nhồi đổ tại chỗ / Unknown - Không rõ)
- [ ] **Đánh giá Nguồn thông tin móng (CAT Foundation):**
  - Điểm CAT móng: (Nhập từ 1 đến 5 /5)
  - Nguồn thông tin (Source): (Multi-select: Drawing - Bản vẽ thiết kế / Owner - Chủ nhà cung cấp / Site - Khảo sát thực địa)

### Bước 3: Phỏng vấn Lịch sử, Sử dụng & Yếu tố Nhạy cảm (Đã điều chỉnh chuẩn Enum cho E5)
*Hỏi chuyện người đại diện hoặc chủ nhà để nắm lịch sử toà nhà (các Enum được chuẩn hóa để tự động tính điểm E5 trong bảng ECS).*
- [ ] **Cơi nới / Thay đổi tải trọng:** (Chọn: `Không` [0đ] / `Nhẹ / Đã xử lý` [1đ] / `Nhiều / Chưa rõ` [2đ] / `Thay đổi lớn` [3-4đ])
- [ ] **Sửa chữa lớn / Cải tạo kết cấu:** (Chọn: `Không` [0đ] / `Nhẹ / Đã xử lý` [1đ] / `Nhiều / Chưa rõ` [2đ] / `Thay đổi lớn` [3-4đ])
- [ ] **Lún / Nghiêng ghi nhận trước đây:** (Chọn: `Không` [0đ] / `Nhẹ / Đã xử lý` [1đ] / `Nhiều / Chưa rõ` [2đ] / `Nghiêm trọng` [3-4đ])
- [ ] **Hư hỏng do công trình lân cận gây ra:** (Chọn: `Không` [0đ] / `Nhẹ / Đã xử lý` [1đ] / `Nhiều / Chưa rõ` [2đ] / `Nghiêm trọng` [3-4đ])
- [ ] **Sự cố nghiêm trọng (Hỏa hoạn / Ngập lụt / Sự cố khác):** (Chọn: `Không` [0đ] / `Nhẹ / Đã xử lý` [1đ] / `Nhiều / Chưa rõ` [2đ] / `Sự cố lớn` [3-4đ])
- [ ] **Thiết bị / Hoạt động nhạy cảm (VD: Phòng thí nghiệm, máy y tế, đồ cổ...):** (Chọn: Không / Có - Nhập mô tả chi tiết: ________)
- [ ] **Tình trạng sử dụng hiện tại:** (Chọn: Đầy đủ / Một phần / Không sử dụng)
- [ ] **Vận hành liên tục 24/7:** (Chọn: Không / Có)

### Bước 4: Đánh giá Tình trạng Hiện hữu Sơ bộ (ECS - Nhìn nhanh 1 vòng)
- [ ] **E1. Tường / Vách:** (Chọn điểm 0-5)
- [ ] **E2. Kết cấu chịu lực (Cột/Vách):** (Chọn điểm 0-5)
- [ ] **E3. Dầm / Sàn:** (Chọn điểm 0-5)
- [ ] **E4. Bê tông / Cốt thép:** (Chọn điểm 0-5)
- [ ] **E5. Thấm dột / Ăn mòn:** (Chọn điểm 0-5)

### Bước 5: Chấm điểm Hư hỏng Tổng thể (Burland Scale)
*(Có nút trợ giúp (?) hiển thị bảng tra cứu quy chuẩn Burland Grade 0-5 tại Mục 7 bên dưới)*
- [ ] **Điểm Burland sơ bộ:** (Chọn 0: Không đáng kể / 1: Rất nhẹ / 2: Nhẹ / 3: Trung bình / 4: Nghiêm trọng / 5: Rất nghiêm trọng).
- [ ] **Dấu hiệu cảnh báo kết cấu (Structural Flag):** (Chọn: Không có / Nứt >3mm / Võng sàn / Nghiêng lún / Khác)

### Bước 6: Xác nhận Phạm vi & Hạn chế Tiếp cận Khảo sát
- [ ] **Phạm vi đã khảo sát (Survey Scope):** (Multi-select: Ngoài / Trong / Mái / Hầm / Khu phụ)
- [ ] **Hạn chế tiếp cận (Access Limitations):** (Chọn: Không / Có - Ghi chú cụ thể lý do)

### Bước 7: Kết luận & Chữ ký Phase 1
- [ ] **Kết luận:** Có cần thực hiện Phase 2 (Khảo sát đo vẽ chi tiết khuyết tật từng tầng) hay không? (Có / Không)
- [ ] **Chữ ký xác nhận của Surveyor.**

---
---

## PHẦN B: KHẢO SÁT GIAI ĐOẠN 2 & HỢP NHẤT SỔ KHUYẾT TẬT (PHASE 2 - CHUẨN HÓA ENUM MAPPING 100% VỚI ECS)

> **THIẾT KẾ ĐỘT PHÁ TỰ ĐỘNG HÓA BẢNG 8 & BẢNG 11 (ECS AUTOMATION):**
> Các Enum thu thập tại Bước 2 (Khuyết tật $D-xx$) và Bước 3 (Lún nghiêng) được **chuẩn hóa khớp 100% với các tiêu chí E1–E6 trong Bảng ECS (Mục 11)**. Khảo sát viên chọn đúng thực tế hiện trường ➔ Hệ thống tự động quy đổi ra điểm ECS chính xác tuyệt đối mà không cần tính toán thủ công.

### Bước 1: Khởi tạo Buổi khảo sát Chi tiết
- [ ] **Mức độ tiếp cận hôm nay:** (Đầy đủ / Một phần / Bị hạn chế / Bị từ chối/vắng mặt)
- [ ] **Chụp ảnh kiểm chứng hôm nay:** `P-01` (Biển số nhà) và `P-02` (Mặt đứng chính).

### Bước 2: Quy trình Khảo sát Vùng Hư Hỏng Z-xx (Damage Zone Workflow)

#### 2.1. Chọn Tầng & Không gian:
- [ ] **Tầng:** (Tầng hầm / Tầng trệt / Tầng 1 / Tầng 2 / Tầng mái...)
- [ ] **Phòng / Vị trí cụ thể:** (Phòng khách, Phòng ngủ 1, Bếp...)
- [ ] **Tường / Vật liệu mảng vách:** (BTCT, Tường gạch chịu lực, Khung thép...)

#### 2.2. Chụp Ảnh Bối Cảnh ➔ Tự động Tạo Vùng Z-xx & Nhập thông số Bảng 8 ngay tại chỗ:
- [ ] **Chụp 1 Ảnh Bối cảnh (Photo CTX):** Đứng lùi lại chụp bao quát mảng tường/cấu kiện.
  - *(App tự động gắn Mã Vùng: `Z-01`, `Z-02`... tương ứng với bức ảnh bối cảnh này)*
- [ ] **Điền thông số Bảng 8 ngay dưới bức ảnh vừa chụp:**
  - **Ảnh hưởng chức năng / Cần sửa chữa:** (Chọn: Có / Không)
  - **Đánh giá Grade Burland cho Vùng này:** (Chọn từ Grade 0 đến Grade 5 - *Có nút (?) trợ giúp tra cứu quy chuẩn Burland*)

#### 2.3. Thả Ghim Khuyết tật trực tiếp lên Ảnh Bối cảnh Vùng Z-xx:
- [ ] **Chạm lên vết nứt 1:** Thả ghim mã `D-01`.
- [ ] **Chạm lên vết nứt 2:** Thả ghim mã `D-02`.
- [ ] **Chạm lên vết nứt 3:** Thả ghim mã `D-03`.

#### 2.4. Nhập Chi tiết & Chụp Cận Cảnh cho từng Ghim D-xx (Enum đã chuẩn hóa cho E2 & E4):
*Bấm vào từng ghim (`D-01`, `D-02`...) trên hình Vùng Z-xx để nhập:*

##### Khuyết tật `D-xx`:
- [ ] **Chỉ số sàng lọc (Section 4 Indicator):** (Nứt tường hoàn thiện / Nứt kết cấu cột-dầm / Lún võng / Thấm dột / Bong tróc lộ thép / Mất tiết diện / Kẹt cửa / Tái nứt)
- [ ] **Cấu kiện / Vật liệu:** (BTCT / Tường gạch / Khung thép / Gỗ / Khác)
- [ ] **Dạng nứt:** (Xiên / Ziczac / Dọc / Ngang / Chân chim / Phồng rộp...)
- [ ] **Kích thước:** Max Width (mm) & Length (mm) & Hướng nứt.
- [ ] **Trạng thái Hoạt động:** `U` (Chưa rõ) / `S` (Ổn định/cũ) / `A` (Đang phát triển)
- [ ] **Mức độ Suy giảm Vật liệu / Bong tróc / Rỉ thép (Chuẩn hóa tự động map điểm E4 trong ECS):**
  - `Không / Nhẹ` [0đ] (Vết nứt sạch, không bong tróc)
  - `Cục bộ` [1đ] (Bong tróc rữa vữa nhẹ cục bộ)
  - `Đáng kể` [2đ] (Bong tróc mảng rộng, rỉ rác cốt thép)
  - `Nặng` [3đ] (Bong tróc diện rộng, cốt thép rỉ mảng lớn)
  - `Ảnh hưởng khả năng chịu lực` [4đ] (Rỉ đứt cốt thép, mất tiết diện bê tông nghiêm trọng)
- [ ] **Ý nghĩa Kết cấu (Structural Significance - Chuẩn hóa tự động map điểm E2 trong ECS):**
  - `N/A` [0đ] (Không ảnh hưởng kết cấu)
  - `Low` [1đ] (Ảnh hưởng thấp)
  - `Moderate` [2đ] (Ảnh hưởng trung bình)
  - `High` [3đ] (Ảnh hưởng cao)
  - `Critical` [4đ] (Rất nguy hiểm / Cảnh báo sập)
- [ ] **Chụp Ảnh Cận Cảnh (Photo CU):** Tiến lại gần vết nứt `D-xx` đặt thước đo và chụp.

---

### Bước 3: Đánh giá Lún - Nghiêng - Biến dạng (Mục 6 - Chuẩn hóa Enum khớp 100% với điểm E3 trong ECS)
*Thực hiện đánh giá các hiện tượng biến dạng hình học của công trình (Enum được chuẩn hóa trùng khớp với tiêu chí điểm E3):*

- [ ] **1. Lún chênh (Differential Settlement):**
  - Trạng thái: (Chọn: `Không` [0đ] / `Nghi ngờ / Nhẹ` [1đ] / `Rõ nhưng ổn định` [2đ] / `Tiến triển / Nghiêm trọng` [3đ] / `Mất ổn định` [4đ])
  - Vị trí lún chênh (nếu Có): (Nhập text vị trí)
- [ ] **2. Nghiêng công trình (Overall Building Tilt):**
  - Trạng thái: (Chọn: `Không` [0đ] / `Nghi ngờ / Nhẹ` [1đ] / `Rõ nhưng ổn định` [2đ] / `Tiến triển / Nghiêm trọng` [3đ] / `Mất ổn định` [4đ])
  - Độ nghiêng mặt trước (X): (Nhập số %)
  - Độ nghiêng mặt bên hông (Y): (Nhập số %)
- [ ] **3. Nghiêng sàn (Floor Tilt):**
  - Trạng thái: (Chọn: `Không` [0đ] / `Nghi ngờ / Nhẹ` [1đ] / `Rõ nhưng ổn định` [2đ] / `Tiến triển / Nghiêm trọng` [3đ] / `Mất ổn định` [4đ])
  - Độ nghiêng sàn: (Nhập số %)
- [ ] **4. Võng dầm / Sàn (Beam / Slab Deflection):**
  - Trạng thái: (Chọn: `Không` [0đ] / `Nghi ngờ / Nhẹ` [1đ] / `Rõ nhưng ổn định` [2đ] / `Tiến triển / Nghiêm trọng` [3đ] / `Mất ổn định` [4đ])
  - Vị trí võng (nếu Có): (Nhập text vị trí)
- [ ] **5. Nguồn xác định dữ liệu:** (Quan sát mắt thường / Đo nhanh / Bản vẽ thiết kế / Chủ nhà)
- [ ] **6. Độ tin cậy dữ liệu:** (Cao / Trung bình / Thấp)
- [ ] **7. Yêu cầu Đo đạc / Quan trắc bổ sung:** (Không / Có | Nhận xét: ______)

---

### BẢNG TRA CỨU QUY CHUẨN BURLAND (Cheat Sheet Tooltip trên App)

| Grade | Mức độ | Mô tả / Mức sửa chữa điển hình | Bề rộng nứt xấp xỉ |
| :---: | :---: | :--- | :---: |
| **0** | Negligible | Nứt tóc; thực tế không cần sửa chữa. | $\le 0.1$ mm |
| **1** | Very slight | Nứt mảnh, dễ xử lý trong trang trí/bảo trì thông thường. | $\sim 0.1 - 1$ mm |
| **2** | Slight | Nứt dễ trám; có thể cần trang trí lại/miết mạch; cửa có thể hơi kẹt. | $\sim 1 - 5$ mm |
| **3** | Moderate | Cần mở rộng/vá nứt, sửa cục bộ khối xây; nhiều vết $>3$mm, kẹt cửa/ảnh hưởng chức năng. | $\sim 5 - 15$ mm |
| **4** | Severe | Sửa chữa lớn/thay thế cục bộ; tường biến dạng; có thể ảnh hưởng gối tựa/liên kết. | $\sim 15 - 25$ mm |
| **5** | Very severe | Hư hỏng rất nặng; có thể cần chống đỡ/xây lại một phần hoặc toàn bộ. | $\ge 25$ mm |

---

### Bước 4: Kiểm soát Chất lượng Dữ liệu Ảnh & Sơ đồ (Mục 10 Phiếu gốc - Data Quality Gate)
- [ ] **Sơ đồ phác thảo vị trí khuyết tật (Damage Map / Sketch):** (Tự động kiểm tra: `Có` / `Không` / `N/A`)
- [ ] **Liên kết Mã Ảnh - Khuyết tật (Defect - Photo Integrity Link):** (Tự động quét: `ĐỦ` / `THIẾU` - Cảnh báo nếu ghim D-xx thiếu ảnh cận cảnh)

---

### Bước 5: Bảng ECS - Đánh giá Tình trạng Hiện hữu (Mục 11 Phiếu gốc - Auto-Calculated 100%)

> **BẢNG CHUYỂN ĐỔI TỰ ĐỘNG KHỚP 100% VỚI CÁC ENUM TRÊN:**

- [ ] **Bảng chỉ số ECS (Tự động tính điểm 0–4 dựa vào các Enum đã chuẩn hóa):**
  - `E1` (Hư hỏng tường/khối xây): (Tự động map từ Burland Grade: Grade 0-1 ➔ 0đ, Grade 2 ➔ 1đ, Grade 3 ➔ 2đ, Grade 4 ➔ 3đ, Grade 5 ➔ 4đ)
  - `E2` (Khuyết tật kết cấu cột/dầm/sàn): (Tự động map từ Ý nghĩa kết cấu D-xx: N/A ➔ 0đ, Low ➔ 1đ, Moderate ➔ 2đ, High ➔ 3đ, Critical ➔ 4đ)
  - `E3` (Lún/nghiêng/võng): (Tự động map từ Mục 3 Lún nghiêng: Không ➔ 0đ, Nghi ngờ/Nhẹ ➔ 1đ, Rõ nhưng ổn định ➔ 2đ, Tiến triển/Nghiêm trọng ➔ 3đ, Mất ổn định ➔ 4đ)
  - `E4` (Suy giảm vật liệu/độ bền): (Tự động map từ Mức độ suy giảm D-xx: Không/Nhẹ ➔ 0đ, Cục bộ ➔ 1đ, Đáng kể ➔ 2đ, Nặng ➔ 3đ, Ảnh hưởng chịu lực ➔ 4đ)
  - `E5` (Lịch sử/cơi nới/sự cố): (Tự động map từ Phỏng vấn Mục 3: Không ➔ 0đ, Nhẹ/Đã xử lý ➔ 1đ, Nhiều/Chưa rõ ➔ 2đ, Thay đổi lớn/Sự cố ➔ 3-4đ)
  - **`E6` Tình trạng chức năng / Tổng thể:** (Khảo sát viên chọn: `0` - Tốt / `1` - TB / `2` - Kém / `3-4` - Nguy cấp)
- [ ] **Tổng ECS:** $\Sigma E = \_\_\_/24$ *(Tự động cộng sum E1..E6)*
- [ ] **Phân hạng ECS Class:** (Tự động quy đổi: `0-5`: Good / `6-10`: Medium / `11-16`: Deficient / `17-24`: Critical)
- [ ] **Engineering Judgement (Nhận định Can thiệp của Kỹ sư):**
  - Hành động: (Chọn: `Giữ nguyên` / `Nâng hạng` / `Hạ hạng`)
  - Lý do can thiệp: (Nhập text - *Ràng buộc khoá: Nếu có Cờ kết cấu Critical ➔ Khoá không cho Hạ hạng ECS!*)

---

### Bước 6: Kiểm tra Đủ Dữ liệu (Mục 12 Phiếu gốc - Data Completeness Gate)
- [ ] **Thông tin móng:** (Tự động: Cat ___/5 | `Đủ` / `Chưa đủ`)
- [ ] **Khảo sát bên trong:** (Tự động: `Đã khảo sát` / `Hạn chế`)
- [ ] **Hồ sơ / Bản vẽ:** (Tự chọn: `Có` / `Một phần` / `Không`)
- [ ] **Ảnh & Damage Mapping:** (Tự động: `Đủ` / `Thiếu`)
- [ ] **Dữ liệu lún / nghiêng:** (Tự động: `Đủ` / `Cần đo`)
- [ ] **Structural Review (Thẩm định kết cấu):** (Chọn: `N/A` / `Đủ` / `Pending`)
- [ ] **Cho phép sang BRA (Phê duyệt chốt hồ sơ):** (Chọn: `Có` / `Có điều kiện` / `Chưa`)
- [ ] **Lý do / Điều kiện phê duyệt:** (Nhập text)

---

### Bước 7: Chốt Biên bản & Lấy Chữ ký Điện tử
- [ ] **Tổng số Vùng & Khuyết tật đã ghi nhận:** (Hệ thống tự đếm)
- [ ] **Các khu vực bị hạn chế / Không thể tiếp cận:** (Nhập text)
- [ ] **Mô tả khuyết tật đáng chú ý nhất:** (Nhập text)
- [ ] **Ý kiến / Phản hồi của Chủ hộ:** (Nhập text)
- [ ] **Chữ ký điện tử của Cán bộ khảo sát (Surveyor).**
- [ ] **Chữ ký điện tử của Chủ hộ / Người đại diện.**
