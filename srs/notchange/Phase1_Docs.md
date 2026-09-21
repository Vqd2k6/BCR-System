# Bộ câu hỏi & Biểu mẫu Khảo sát Hiện trạng Công trình (KSQH - Metro 2)

> [!IMPORTANT]
> **LƯU Ý DÀNH CHO AI AGENT & DEVELOPER (TÀI LIỆU ĐANG TIẾP TỤC HOÀN THIỆN & MỞ RỘNG):**
> Tài liệu này là **bản đặc tả cơ sở (Baseline Specification)** cho biểu mẫu và quy trình khảo sát Đợt 1. Tài liệu đã được đồng bộ 100% với giao diện và logic tính toán thực tế của ứng dụng PWA Metro 2. Khi triển khai code thực tế hoặc mở rộng tính năng, Agent/Developer cần duy trì tính nhất quán giữa tài liệu này và source code hệ thống.

Dưới đây là **BỘ BIỂU MẪU KHẢO SÁT HỢP NHẤT DUY NHẤT** được sắp xếp theo đúng **trình tự thời gian thực địa của Cán bộ Khảo sát** (Từ lúc đứng ngoài nhà ➔ Phỏng vấn chủ hộ ➔ Khảo sát sơ đồ CAD & chụp ảnh tuần tự mảng tường Z / kết cấu E ➔ Chốt kết luận Burland & Cờ kết cấu ➔ Đo đạc võng kết cấu ➔ Điều chỉnh ranh GIS ➔ Qua cổng kiểm tra dữ liệu ➔ Tự động tính điểm ECS/VI ➔ Dashboard & Chụp ảnh chữ ký / Biên bản).

---

## BỘ CÂU HỎI KHẢO SÁT HỢP NHẤT (SINGLE UNIFIED SURVEY FORM)

### BƯỚC 1: Tiếp cận ngoài nhà & Nhận diện Công trình
*Thực hiện ngay khi cán bộ vừa đến vị trí công trình.*

- [ ] **Mã Quản lý Dự án (Project Parcel Code):** `B-XXXXX` (Được sắp xếp quản lý theo lý trình tuyến Metro 2)
- [ ] **Mã Địa chính Gốc (Official Cadastral Code / KS003):** `KS003-XXXX` (Số tờ - Số thửa bản đồ địa chính nhà nước)
- [ ] **Tên công trình (Building Name):** (Nhập text tên riêng tòa nhà / biển hiệu thương mại / cơ quan - VD: `ABC Shop`, `Ngân hàng XXX`, `BHXanh`, `Cty May DEF`... Không phải mục công năng. Để trống nếu là nhà dân không có biển hiệu).
- [ ] **Địa chỉ (Address):** (Nhập text - Đối chiếu thực tế với sơ đồ quy hoạch)
- [ ] **Chủ sở hữu / Người sử dụng (Owner / User):** (Nhập text tên chủ nhà hoặc người đại diện)
- [ ] **1.2. Nhóm Đối Tượng Công Trình (Survey Object Category):** (Chọn 1 trong 3 nhóm chuẩn theo Docx):
  - [ ] `General Building` - **Công trình thông thường:** (Công trình dân dụng thông thường dưới 5 tầng).
  - [ ] `Important Building` - **Công trình quan trọng:** (Từ 5 tầng trở lên hoặc có thiết bị/vật liệu nhạy cảm).
  - [ ] `Critical Building` - **Công trình trọng yếu:** (Bệnh viện, công trình được bảo tồn, công trình vận hành đặc biệt, hoặc có hậu quả cao nếu bị ảnh hưởng).
- [ ] **1.3. Thông tin tuyến Metro & GIS (Hệ thống tự động bắt từ GPS - Kèm Popover hướng dẫn):**
  - Lý trình (Chainage): *(Tự động)*
  - Khoảng cách tới tim tuyến Metro: *(Tự động)*
  - Khoảng cách tới ranh giải phóng mặt bằng: *(Tự động)*
  - Tọa độ GPS / GIS: *(Tự động bắt khi check-in)*
- [ ] **1.4. Công trình liền kề theo các hướng (Adjacent Structures - Left / Right / Rear):**
  - **Bên trái:** (Chọn: `Nhà phố / Nhà dân` | `Cao tầng / Chung cư` | `Bệnh viện / Y tế` | `Trường học` | `Công viên / Cây xanh` | `Đất trống` | `Cơ sở tôn giáo (Chùa, Nhà thờ)` | `Không biết / Không rõ (Bị che khuất)` | `Khác...`)
  - **Bên phải:** (Chọn: `Nhà phố / Nhà dân` | `Cao tầng / Chung cư` | `Bệnh viện / Y tế` | `Trường học` | `Công viên / Cây xanh` | `Đất trống` | `Cơ sở tôn giáo (Chùa, Nhà thờ)` | `Không biết / Không rõ (Bị che khuất)` | `Khác...`)
  - **Phía sau:** (Chọn: `Nhà phố / Nhà dân` | `Cao tầng / Chung cư` | `Bệnh viện / Y tế` | `Trường học` | `Công viên / Cây xanh` | `Đất trống` | `Hẻm / Đường nội bộ` | `Không biết / Không rõ (Bị che khuất)` | `Khác...`)

- [ ] **1.5. Chụp 4 Bộ Ảnh Định Danh Ngoại Thất (Có Watermark GPS & Thời gian | Hỗ trợ nút chọn "Không tồn tại / N/A"):**
  - **`P-01` (Biển số nhà / Biển tên cơ quan):**
    - [ ] `Có ảnh`: Chụp ảnh biển số nhà / biển tên cơ quan rõ nét.
    - [ ] `Không tồn tại (N/A)`: (Nhà không gắn biển số / Đất trống / Không có biển hiệu ➔ Cho phép bấm Next).
  - **`P-02` (Mặt đứng chính diện):**
    - [ ] `Có ảnh`: Chụp trực diện toàn bộ mặt tiền ngôi nhà (Hỗ trợ tỷ lệ ảnh dọc 9:16 và ngang 4:3 linh hoạt). Sau khi chụp, PWA cung cấp các công cụ tương tác:
      - 🔴 **Icon Chấm tròn (Đa giác đứng / Polygon Corners):** Chạm mảng $N$ điểm góc ($N \ge 3$) bao quanh ngôi nhà (hỗ trợ nhà mái xéo, chữ L, giật cấp $N$ đỉnh giúp AI nhận diện khung nhà).
      - ➖ **Icon Line ngang (Đường phân tầng / Floor Split Lines):** Kéo các đường ngang phân tầng (`Tầng trệt`, `Tầng 1`, `Tầng 2`, `Mái`...).
      - ✏️ **Vẽ tay & Ghi kích thước (Freehand Note):** Chế độ cầm bút / chạm tay vẽ note kích thước trực tiếp lên ảnh ($W, H, h_1, h_2...$).
      - Nút **"Lưu & Đóng"** tường minh sau khi hoàn tất thao tác.
    - [ ] `Không tồn tại (N/A) / Bị che khuất`: (Mặt tiền bị che khuất hoàn toàn bởi công trình phía trước / Hẻm quá hẹp ➔ Nhập lý do và cho phép Next).
  - **`P-03` (Mặt bên hoặc mặt sau tiếp cận - Hỗ trợ chụp nhiều ảnh):**
    - [ ] `Có ảnh (Hỗ trợ chụp nhiều ảnh)`: Cho phép chụp nhiều góc với các nhãn lựa chọn: `Bên hông trái`, `Bên hông phải`, `Phía sau tiếp cận`, `Khác`.
    - [ ] `Không tồn tại (N/A)`: (Nhà phố liền kề 2 bên sát vách không có mặt hông ➔ Cho phép bấm Next).
  - **`P-04` (Bối cảnh tổng thể lấy cả đường/ngõ):**
    - [ ] `Có ảnh`: Chụp bối cảnh không gian tiếp cận đường/ngõ.
    - [ ] `Không tồn tại (N/A)`: (Nhập lý do ➔ Cho phép bấm Next).

- [ ] **1.6. Khảo sát trực quan Lún chênh & Nghiêng công trình ngoài nhà (Building Tilt & Settlement Overview):**
  - **1. Lún chênh quan sát ngoài nhà / Tầng trệt:** 
    - [ ] **Mức độ (Level):**
      - `Level 0`: Không có dấu hiệu.
      - `Level 1`: Chớm nứt chân tường / Sân nền tiếp giáp.
      - `Level 2`: Tách khe lún rõ rệt ($\Delta h < 20$mm).
      - `Level 3`: Lún lệch nghiêm trọng ($\Delta h \ge 20$mm).
    - [ ] **Thông tin bổ sung (Additional details):** Vị trí cụ thể (`______`), Ảnh chụp chi tiết vết lún.
  - **2. Độ nghiêng công trình (Mặt tiền / Khối nhà):**
    - [ ] **Mức độ (Level):**
      - `Level 0`: Khối nhà thẳng đứng bình thường.
      - `Level 1`: Nghiêng nhẹ khó nhận biết bằng mắt thường ($< 2‰$).
      - `Level 2`: Nhìn thấy hơi nghiêng ($2 - 5‰$).
      - `Level 3`: Nghiêng rõ rệt ($5 - 10‰$).
      - `Level 4`: Mất ổn định tổng thể tòa nhà ($> 10‰$).
    - [ ] **Thông tin bổ sung (Additional details):** Độ nghiêng $X = \_\_\_\text{ ‰}$, $Y = \_\_\_\text{ ‰}$.

- [ ] **1.7. Tình Trạng Tiếp Cận Hiện Trường & Phương Thức Khảo Sát (Survey Mode Decision at end of Step 1):**
  *Quyết định phương thức khảo sát được đặt ở CUỐI BƯỚC 1 nhằm đảm bảo toàn bộ dữ liệu ngoại thất (Định danh, GPS, 3 công trình liền kề, 4 bộ ảnh P-01...P-04, Lún/Nghiêng) luôn được thu thập đầy đủ trước khi rẽ nhánh xử lý.*
  
  - 🏠 **Option 1: `NORMAL` (Nhà dân / Công trình thông thường):**
    - Áp dụng cho các công trình nhà ở, thương mại độc lập, tiếp cận được bên trong.
    - Quy trình: Tiếp tục thực hiện đầy đủ luồng khảo sát 9 bước theo chuẩn Phase 1.
  
  - 🚪 **Option 2: `ABSENTEE` (Vắng nhà / Không tiếp cận được bên trong):**
    - Áp dụng khi chủ nhà đi vắng, khóa cửa, hoặc từ chối hợp tác khảo sát bên trong.
    - Chuyển thẳng đến giao diện kết thúc hồ sơ vắng nhà.
    - Cung cấp mục chụp / tải lên **Biên bản thông báo vắng nhà** (`absenteeMinutesPhotos` - *cho phép chụp/up nhiều ảnh*).
    - Lựa chọn lý do vắng nhà (`Khóa cửa đi vắng`, `Chủ nhà hẹn quay lại sau`, `Từ chối cho vào nhà`, `Nhà bỏ hoang`, `Khác...`).
    - Yêu cầu xác nhận 100% dữ liệu ngoại thất Bước 1 hợp lệ ➔ Kích hoạt nút **`Xác nhận & Nộp Hồ Sơ Vắng Nhà`** (`ABSENT_EXTERIOR_COMPLETED`).
  
  - 🏢 **Option 3: `APARTMENT` (Chung cư / Tòa nhà nhiều căn hộ):**
    - Áp dụng cho các tòa nhà chung cư, cao ốc cư trú nhiều chủ sở hữu.
    - **Tự động điều chỉnh trường thông tin:**
      - Nhóm đối tượng công trình tự động khóa/chuyển sang `Important Building` (Công trình quan trọng $\ge 5$ tầng).
      - Công năng sử dụng mặc định là `Chung cư / Căn hộ DV`.
    - **Phạm vi khảo sát đặc thù:** Chỉ khảo sát các **khu vực dùng chung (Common Areas)** của tòa nhà như: Tầng hầm móng, sân thượng/mái, sảnh đón, hành lang, buồng thang bộ, hộp gen/kỹ thuật chung.
    - Các căn hộ riêng lẻ bên trong tòa nhà được quản lý định danh dưới dạng các **căn hộ con (Sub-units)** và sẽ được khảo sát độc lập bằng phiếu khảo sát con.
  
  - 🏗️ **Option 4: `UNDER_CONSTRUCTION` (Nhà đang xây dựng / Đang thi công):**
    - Áp dụng cho các công trình đang trong quá trình đào móng, đổ sàn, xây thô hoặc hoàn thiện.
    - Chỉ thu thập các trường dữ liệu ngoại cảnh của Bước 1 (định danh, địa chỉ, GPS, ranh giới).
    - **Bổ sung trường thu thập chuyên biệt:**
      - Bộ ảnh chụp hiện trạng thi công (`underConstructionPhotos` - *cho phép chụp nhiều ảnh góc rộng & chi tiết*: đào móng, cột dầm thô, cốp pha, giàn giáo, sàn đang thi công).
      - Ghi chú giai đoạn thi công (`constructionStageNotes`: Giai đoạn móng, thô tầng N, hoàn thiện...).
    - Kích hoạt nút **`Xác nhận & Hoàn Tất Khảo Sát Đang Thi Công`** để nộp hồ sơ.

---

### BƯỚC 2: Phỏng vấn Chủ hộ (Kiến trúc, Lịch sử tính E5 & Yếu tố Nhạy cảm)
*Hỏi chuyện chủ nhà/người đại diện tại phòng khách hoặc sân trước.*

#### 2.1. Khảo Sát Kiến Trúc, Kết Cấu Nền:
- [ ] **Công năng sử dụng (Use):** (Chọn: `Nhà ở gia đình` | `Cửa hàng / Shop / Bách hóa` | `Quán ăn / Nhà hàng / Cafe` | `Văn phòng / Trụ sở cty` | `Khách sạn / Nhà nghỉ / Căn hộ DV` | `Bệnh viện / Y tế` | `Trường học / Đào tạo` | `Kho hàng / Xưởng sản xuất` | `Cơ sở tôn giáo (Chùa, Nhà thờ)` | `Công trình công cộng` | `Khác` ➔ *Hiển thị ô nhập text chi tiết*).
- [ ] **Số tầng:** Số tầng nổi: _____ | Số tầng hầm: _____ *(Quy ước: Tầng trệt tính là tầng nổi đầu tiên)*
- [ ] **Năm xây dựng / Tuổi thọ (Age):** (Nhập số năm - Tick chọn "Ước tính" nếu cần)
- [ ] **Hệ kết cấu chịu lực (Structural System - Kèm Popover giải thích):** (Chọn: `RC` - Khung BTCT toàn khối / `Steel` - Khung thép / `Masonry` - Tường gạch chịu lực / `Mixed` - Hỗn hợp / `Other` - Khác)
- [ ] **Loại móng (Foundation):** (Chọn: `Shallow` - Móng nông / `Wood` - Cừ tràm / `PC` - Cọc ép BTCT / `CIP` - Cọc khoan nhồi / `Unknown` - Không rõ)
- [ ] **Kích thước cọc / móng (Pile/Foundation Dimension):** (Nhập text - VD: `D600mm`, `250x250mm`... Để trống nếu không biết)
- [ ] **Đánh giá CAT (Kèm Popover giải thích quy tắc kỹ thuật ngầm):**
  - **Trường hợp A: Có bản vẽ hoàn công / kết cấu:**
    - Cán bộ tải lên / chụp ảnh bản vẽ hoàn công.
    - Lựa chọn nguồn xác thực: `Xác nhận từ Chính quyền / Đơn vị thiết kế` (Cat 1) HOẶC `Phỏng vấn chủ nhà có lưu bản vẽ` (Cat 2).
  - **Trường hợp B: Không có bản vẽ hoàn công (Tích chọn N/A):**
    - Lựa chọn: `Phỏng vấn chủ hộ khai nhớ` (Cat 3) HOẶC `Tự suy luận kinh nghiệm hiện trường` (Cat 4).
  - **Trường hợp C: Hoàn toàn không có thông tin móng & cọc:** (Cat 5 - Mặc định rủi ro).

#### 2.2. Lịch Sử & Yếu Tố Nhạy Cảm
*Các câu hỏi phỏng vấn quá khứ do chủ nhà cung cấp. Hư hỏng hiện trạng của công trình trong lịch sử.*

- [ ] **1. Cơi nới - Thay đổi tải trọng trong quá khứ:** (Chọn: `Không` | `Nhẹ - Đã xử lý ổn định` | `Nhiều - Chưa rõ kết cấu` | `Thay đổi lớn - Nghiêm trọng`)
- [ ] **2. Sửa chữa lớn - Cải tạo kết cấu:** (Chọn: `Không` | `Nhẹ - Đã xử lý` | `Nhiều - Chưa rõ hồ sơ` | `Cải tạo lớn ảnh hưởng chịu lực`)
- [ ] **3. Lún - Nghiêng ghi nhận trước đây:** (Chọn: `Không` | `Nhẹ - Đã ổn định` | `Rõ - Tiếp diễn` | `Nghiêm trọng`)
- [ ] **4. Hư hỏng do công trình lân cận gây ra:** (Chọn: `Không` | `Nhẹ - Đã bồi thường` | `Đáng kể` | `Tranh chấp - Nghiêm trọng`)
- [ ] **5. Sự cố nghiêm trọng (Hỏa hoạn - Ngập lụt - Nổ):** (Chọn: `Không` | `Nhẹ - Đã khắc phục` | `Trung bình - Chưa rõ mức ảnh hưởng` | `Nghiêm trọng`)
- [ ] **Thiết bị - Hoạt động nhạy cảm:** (Chọn: `Không có` | `Có` - Nhập mô tả: Phòng lab, máy MRI/X-quang, đồ cổ, thư viện...)
- [ ] **Tình trạng sử dụng hiện tại (Occupancy Status):** (Chọn: `Đầy đủ` | `Đang sử dụng một phần` | `Bỏ trống - Không sử dụng`)

---

### BƯỚC 3: Khảo sát Hiện trạng Chi tiết Theo Cấp Bậc (Tầng > CAD_01 Vùng Z > CAD_02 Vùng E > Khuyết tật D)
*Cán bộ khảo sát ghi nhận dữ liệu theo 2 khối thẻ nghiệp vụ tách biệt trên mỗi tầng: Khối 1 (Sơ đồ CAD_01 & Vùng Kiến trúc Z) ở đầu trang ➔ Khối 2 (Sơ đồ CAD_02 & Vùng Kết cấu E) ở cuối trang.*

#### 3.1. Sơ Đồ CAD_01 & Khảo Sát Mảng Tường Kiến Trúc (Vùng Z-xx):
- [ ] **Sơ đồ CAD_01 & Cơ chế tự động sinh Vùng Z khi chạm ghim:**
  - Cán bộ chụp/tải lên bản vẽ mặt bằng kiến trúc `CAD_01`.
  - Mở Canvas chấm ghim: **Mỗi lần chạm tay lên sơ đồ CAD_01, hệ thống tự động tăng mã (`Z-01`, `Z-02`...) và tự động sinh ra Vùng khảo sát tương ứng ngoài danh sách**. Khi đóng modal CAD là có ngay form điền thông tin cho từng Z.
  - **Khóa an toàn:** Nếu bấm nút *"Thêm Vùng Z"* khi số lượng vùng Z đã tạo đủ với số ghim trên CAD_01, hệ thống sẽ **tự động mở modal CAD_01** để cán bộ chấm vị trí cho Vùng mới trước.
- [ ] **Khảo sát tuần tự từng Vùng Z & Cơ chế kế thừa thông tin (Inheritance):**
  - Khảo sát lần lượt từ `Z-01` ➔ `Z-02`... Khi bấm chuyển sang Vùng tiếp theo, hệ thống tự động kế thừa các giá trị từ Vùng trước (Tên phòng, Cấu kiện, Vật liệu hoàn thiện), cán bộ chỉ cần chỉnh sửa nếu có thay đổi.
  - **Tên Phòng / Không gian:** (`Phòng khách`, `Phòng ngủ trước`, `Phòng ngủ sau`, `Phòng ngủ 1/2/3`, `Bếp / Ăn`, `Ban công / Lô gia`, `WC`, `Cầu thang / Hành lang`, `Sân thượng / Phơi`, `Phòng thờ`, `Gara`, `Kho`, `Khác...`).
  - **Cấu kiện mảng vách kiến trúc:** (`Tường gạch vữa xi măng`, `Vách thạch cao / Vách nhẹ`, `Sàn / Nền lát gạch men`, `Nền bê tông hoàn thiện`, `Trần thạch cao / La phông`, `Cầu thang xây gạch / Ốp đá`, `Mảng tường giáp ranh`, `Khác...`).
  - **Vật liệu bề mặt hoàn thiện:** (`Tường gạch trát vữa XM sơn nước`, `Tường gạch ốp gạch men`, `Tường gạch quét vôi`, `Vách thạch cao sơn nước`, `Gỗ / Ván CN`, `Vách kính khung nhôm`, `Khác...`).
  - **Ảnh tổng quan Vùng Z (Multi-photos):** Cho phép chụp nhiều ảnh bao quát mảng tường / không gian phòng.
  - **Quy tắc ghi nhận hư hại:**
    - *Nếu không có hư hại:* Chỉ cần chụp ảnh tổng quan ➔ Hoàn thành Vùng Z (`✅ Nguyên vẹn • Không nứt`).
    - *Nếu có hư hại:* Tích chọn *"Có vết nứt/hư hỏng"* ➔ Chụp Ảnh bối cảnh chính (Photo CTX) và thả ghim các điểm khuyết tật $D\text{-01}, D\text{-02}\dots$
  - **Cơ chế tự động:** Hệ thống tự động tính Burland Grade của Vùng Z và cờ Cần sửa chữa từ danh sách các điểm $D$ bên trong, không yêu cầu cán bộ nhập tay.

#### 3.2. Sơ Đồ CAD_02 & Khảo Sát Cấu Kiện Kết Cấu Chịu Lực (Vùng E-xx):
- [ ] **Sơ đồ CAD_02 & Cơ chế tự động sinh Vùng E khi chạm ghim:**
  - Cán bộ chụp/tải lên bản vẽ mặt bằng kết cấu `CAD_02` (hoặc bấm 1 click nút *"Dùng lại ảnh CAD_01"* nếu dùng chung bản vẽ).
  - Mở Canvas chấm ghim: **Mỗi lần chạm tay lên sơ đồ CAD_02, hệ thống tự động tăng mã (`E-01`, `E-02`...) và tự động sinh ra Vùng kết cấu tương ứng ngoài danh sách**.
  - **Khóa an toàn:** Nếu bấm nút *"Thêm Vùng E"* khi số lượng cấu kiện E đã tạo đủ với số ghim trên CAD_02, hệ thống sẽ **tự động mở modal CAD_02** để cán bộ chấm vị trí cho Cấu kiện mới trước.
- [ ] **Khảo sát tuần tự từng Vùng E & Kế thừa thông tin:**
  - **Vị trí / Thuộc không gian:** (`Phòng khách`, `Phòng ngủ`, `Hành lang`, `Trục kết cấu...`, `Khác...`).
  - **Loại cấu kiện chịu lực:** (`Cột BTCT`, `Dầm BTCT (Dầm chính / Dầm phụ)`, `Bản sàn BTCT chịu lực`, `Cột thép / Dầm thép`, `Khung thép định hình`, `Tường BTCT / Vách thang máy`, `Cầu thang BTCT chịu lực`, `Gối tựa / Mối nối liên kết chịu lực`, `Khác...`).
  - **Loại vật liệu kết cấu:** (`Bê tông cốt thép (BTCT) đổ toàn khối`, `Bê tông cốt thép lắp ghép / đúc sẵn`, `Thép hình / Thép cán nóng`, `Kết cấu liên hợp Thép - Bê tông`, `Khác...`).
  - **Ảnh tổng quan cấu kiện E (Multi-photos):** Cho phép chụp nhiều góc cận/rộng của cấu kiện chịu lực.
  - **Quy tắc ghi nhận hư hại kết cấu:**
    - *Nếu ổn định/nguyên vẹn:* Hoàn tất Vùng E (`✅ Kết cấu ổn định • Nguyên vẹn`).
    - *Nếu có khuyết tật kết cấu:* Tích chọn *"Có hư hỏng kết cấu"* ➔ Thả ghim các điểm khuyết tật kết cấu $D\text{-01}, D\text{-02}\dots$ (nứt dầm, nứt cột, trơ cốt thép rỉ, biến dạng...).

#### 3.3. Ghi Sổ Chi Tiết Điểm Khuyết Tật & Cơ Chế Đổi Màu Ghim D-xx:
- [ ] **Thả ghim trực tiếp lên Photo CTX & Trạng thái màu sắc của Icon vuông:**
  - Mã tự động `D-01`, `D-02`... kèm tọa độ pixel $(X\%, Y\%)$.
  - **🟢 Màu Xanh Lá (Emerald/Green):** Điểm $D$ đã điền đầy đủ thông tin (có ảnh cận cảnh Photo CU hoặc đã có ghi chú/kích thước).
  - **🟠 Màu Vàng Hổ Phách (Amber/Orange):** Điểm $D$ mới chấm, đang chờ điền thông tin chi tiết.
  - **🔴 Màu Đỏ (Red):** Điểm $D$ nguy cấp kết cấu ($E_2 \ge 3$ hoặc cảnh báo sập).
  - **🔵 Màu Xanh Dương (Royal Blue):** Điểm $D$ đang được click chọn chỉnh sửa trên màn hình.
- [ ] **Nhóm chỉ báo & Dạng nứt:**
  - Nhóm chỉ báo BCS: Nứt tường vữa / Nứt cấu kiện kết cấu / Lún võng / Thấm dột ẩm mốc / Bong tróc trơ thép / Mất tiết diện gối tựa / Kẹt cửa / Nứt tái phát.
  - Dạng nứt: Nứt xiên 45°, Nứt dọc/đứng chịu lực, Nứt ngang, Nứt chân chim, Nứt ziczac mạch vữa, Nứt góc cửa, Nứt tiếp giáp Cột-Tường, Nứt tiếp giáp Dầm-Tường, Nứt mép sàn, Bong tróc vữa lộ thép rỉ...
- [ ] **Định lượng kích thước & Hoạt tính:** Bề rộng lớn nhất $w_{\max}$ (mm), Chiều dài $L$ (mm), Hướng nứt, Trạng thái hoạt tính (`U` Chưa rõ / `S` Ổn định / `A` Đang phát triển).
- [ ] **Đánh giá mức độ ảnh hưởng kỹ thuật:**
  - Ý nghĩa kết cấu (Nguồn tính $E_2$): `None` (0đ) | `Low` (1đ) | `Moderate` (2đ) | `High` (3đ) | `Critical` (4đ).
  - Suy giảm vật liệu (Nguồn tính $E_4$): `Không` (0đ) | `Cục bộ` (1đ) | `Đáng kể` (2đ) | `Nặng/Trơ thép` (3đ) | `Ảnh hưởng chịu lực/Mất tiết diện` (4đ).
  - Ảnh hưởng chức năng (Nguồn tính $E_6$): Thấm dột ($1-4$đ), Kẹt cửa ($1-4$đ).
- [ ] **Ảnh chụp cận cảnh vết nứt có thước đo Crack Scale Card (Photo CU).**

---

### BƯỚC 4: Kết luận Burland & Đánh giá Cờ Kết cấu
*Thực hiện NGAY SAU KHI khảo sát chụp ảnh xong các tầng — khi hình ảnh và mức độ hư hại thực tế còn tươi mới nhất trong tâm trí cán bộ khảo sát.*

- [ ] **4.1. Tổng Hợp Burland Toàn Công Trình (Kèm Popover Bảng tra cứu Cheat Sheet chuẩn Burland):**
  - **Burland chủ đạo (Predominant):** (Chọn: `Không hư hỏng` | `Rất nhẹ` | `Nhẹ` | `Trung bình` | `Nặng đến rất nặng`) *(Tự động gợi ý từ các Vùng Z & E)*
  - **Burland cục bộ lớn nhất (Local Max):** (Chọn: `Không hư hỏng` | `Rất nhẹ` | `Nhẹ` | `Trung bình` | `Nặng đến rất nặng`) *(Tự động lấy Grade cao nhất)*
  - **Vùng chi phối (Governing Zone):** Chọn mã `Z-____` hoặc `E-____` | Mô tả mảng tường/cấu kiện.
  - **Tính đại diện (Representativeness):** (Chọn: `Toàn công trình` | `Cục bộ`)
- [ ] **4.2. Đánh Giá Cờ Khuyết Tật Kết Cấu (Kèm Popover giải thích thang đánh giá):**
  - Cờ kết cấu đánh giá độc lập các khuyết tật cột/dầm/sàn/tường chịu lực: (Chọn: `None - Không có cờ kết cấu` | `Low - Cờ kết cấu thấp` | `Moderate - Cờ kết cấu trung bình` | `High - Cờ kết cấu cao / Nguy cơ chịu lực` | `Critical - Cờ kết cấu nguy cấp / Cảnh báo sập`).
  - **Cần Structural Engineer review:** (Chọn: `Không` | `Có`)

---

### BƯỚC 5: Tổng hợp Biến dạng Kết cấu & Đo đạc Bổ sung
*Số liệu Lún chênh & Độ nghiêng công trình đã khảo sát ở Bước 1; Cán bộ khảo sát ghi nhận thêm hiện tượng võng dầm/sàn bên trong.*

- [ ] **1. Võng dầm / Sàn kết cấu bên trong:**
  - [ ] **Mức độ (Level):**
    - `Level 0`: Dầm/sàn phẳng phiu bình thường.
    - `Level 1`: Võng nhẹ mặt đáy chưa nhìn thấy rõ bằng mắt thường.
    - `Level 2`: Võng nhìn thấy bằng mắt thường nhưng đã ổn định, không nứt.
    - `Level 3`: Võng lớn kèm nứt chữ V giữa nhịp dầm/sàn, rung khi đi lại.
    - `Level 4`: Võng quá giới hạn cho phép, nguy cơ sập gãy kết cấu sàn/dầm.
  - [ ] **Thông tin bổ sung (Additional details):** Vị trí cấu kiện (`______`), Độ võng ước tính (mm), Mô tả hiện tượng.
- [ ] **2. Cần đo / Quan trắc bổ sung chuyên sâu:** (Chọn: `Không` | `Có` ➔ Nhận xét: `__________________`)

---

### BƯỚC 6: Xác nhận Phạm vi, Hạn chế & Điều chỉnh Ranh Thửa Đất GIS
*Sau khi cán bộ đã đi hết các tầng, nắm trọn vẹn hiện trạng không gian toà nhà và ranh giới thực tế.*

- [ ] **6.1. Phạm Vi Không Gian Đã Khảo Sát (Survey Scope):**
  - Tự động kết xuất cây cấu trúc: `Bên ngoài / Mặt tiền (P-01 → P-04)` ➔ Danh sách Tầng ➔ Các Vùng Kiến Trúc $Z$ (Tên phòng, Số khuyết tật) & Vùng Kết Cấu $E$ (Loại cấu kiện, Số khuyết tật) từ Bước 3 để cán bộ xác nhận lại.
  - Hỗ trợ chọn thêm không gian bổ sung: `Mái / Sân thượng / Sê-nô`, `Tầng hầm / Bán hầm`, `Khu phụ / Sân sau / Giếng trời`.
- [ ] **6.2. Hạn Chế Tiếp Cận (Access Limitations):** (Chọn: `Không có hạn chế (Tiếp cận 100%)` / `Có hạn chế tiếp cận một phần`):
  - **Vị trí / Khu vực bị hạn chế:** Chọn từ danh sách (`Các tầng lầu trên cao`, `Mái/Sân thượng`, `Tầng hầm`, `Phòng ngủ/Khu vực riêng tư`, `Phòng kho khóa cửa`, `Khác` ➔ *Nhập text chi tiết*).
  - **Phân rã tầng lầu bị hạn chế:** Tự động vô hiệu hóa (disabled) các tầng đã có dữ liệu ở Bước 3 để tránh mâu thuẫn.
  - **Nguyên nhân chính hạn chế tiếp cận:** Chọn từ danh sách (`Chỉ đồng ý cho xem tầng trệt`, `Chủ nhà đi vắng/Khóa cửa`, `Chủ nhà không cho phép`, `Khu vực nguy hiểm`, `Kẹt cửa/Mất chìa khóa`, `Khu vực chứa tài sản nhạy cảm`, `Khác` ➔ *Nhập text chi tiết*).
  - **Ghi chú diễn giải:** Nhập text mô tả chi tiết biên bản hiện trường.
- [ ] **6.3. Kiểm tra Đối soát Kích thước & Điều chỉnh Ranh Thửa Đất trên GIS (Cadastral Boundary & Mutation Engine):**
  - **Hiển thị kích thước thửa ban đầu:** Mặt tiền ($W$), Chiều sâu ($D$), Diện tích thửa gốc ($S_{\text{đất}}\text{ m}^2$), Mã quản lý dự án (`B-XXXXX`) và Mã địa chính gốc (`KS003-XXXX`).
  - **3 Trạng thái nghiệp vụ & Động cơ tương tác:**
    1. **`1. Khớp ranh (MATCH)` - Xác nhận 100% diện tích:** Xác nhận ranh xây dựng trùng khớp 100% ranh thửa đất địa chính ($S_{\text{xd}} = S_{\text{đất}}\text{ m}^2$).
    2. **`2. Tách thửa (SPLIT)` - 2 Màu phân biệt & Metadata Đất thừa:** Hiển thị Màu 1 (Hổ phách cho Căn A / Đang khảo sát) và Màu 2 (Cam Đỏ cho Căn B / Phần còn dư / Đất thừa). Cấp mã động $B_{\max}+1$, metadata lưu vết nguồn gốc thửa cha.
    3. **`3. Gộp thửa (MERGE)` - Multi-Select chọn nhiều thửa liền kề:** Chọn 2 hoặc nhiều thửa liền kề, giữ mã nhỏ nhất $B_{\min}$ làm thửa chính, các thửa phụ chuyển `MERGED_DEPRECATED`, tính tổng diện tích gộp.

---

### CỔNG KIỂM TRA ĐỦ DỮ LIỆU (DATA COMPLETENESS GATE)
*Hệ thống tự động quét kiểm tra 6 tiêu chí kỹ thuật trước khi chuyển sang tính toán kết luận:*

- [ ] **1. Thông tin móng:** Tự động check điểm CAT móng (`Đủ` / `Chưa đủ`).
- [ ] **2. Ảnh & Damage Mapping:** Tự động check đủ 4 ảnh P-01..04, ảnh Vùng CTX và ghim khuyết tật D-xx trong cả Z và E (`Đủ` / `Thiếu`).
- [ ] **3. Khảo sát bên trong:** Tự động trích xuất từ Bước 6.1 & 6.2 (`Đã khảo sát 100%` / `Hạn chế` / `Vắng mặt`).
- [ ] **4. Dữ liệu lún/nghiêng:** Tự động trích xuất từ Bước 1 & Bước 5 (`Đủ` / `Cần đo thêm`).
- [ ] **5. Hồ sơ/bản vẽ kết cấu:** Tự động check file đính kèm ở Bước 2.1 (`Có` / `Một phần` / `Không`).
- [ ] **6. Structural Review:** Tự động cảnh báo Pending nếu có khuyết tật $E_2 \ge 3$ hoặc Cờ kết cấu High/Critical (`N/A` / `Đủ` / `Pending`).
- [ ] **Quyết định Cổng (Gate Decision BRA):** (Chọn: `Cho phép chuyển tiếp` / `Có điều kiện` / `Chưa đủ - Pending` | Nhập lý do điều kiện).

---

### BƯỚC 7: Tự động Tính Điểm Kỹ thuật ECS & VI (Auto Calculations 100%)

#### 7.1. Bảng Điểm Hiện Hữu ECS (11. ECS – EXISTING CONDITION SCORE):
*Ghi chú: Toàn bộ nguồn Map và quy tắc tính toán chi tiết của từng tiêu chí $E_1 \dots E_6$ được tích hợp trong biểu tượng Info Popover cạnh tiêu chí.*

| Mã | Tiêu chí đánh giá | 0 | 1 | 2 | 3–4 | Điểm |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| **E1** | Hư hỏng nhìn thấy tường/khối xây | Burland 0–1 | Burland 2 | Burland 3 | Burland 4=3; 5=4 | `___` |
| **E2** | Khuyết tật kết cấu cột/dầm/sàn/tường chịu lực | Không | Low | Moderate | High=3; Critical=4 | `___` |
| **E3** | Lún/nghiêng/võng/biến dạng | Không | Nghi ngờ/nhẹ | Rõ nhưng ổn định | Tiến triển/nghiêm trọng=3; mất ổn định=4 | `___` |
| **E4** | Suy giảm vật liệu/độ bền | Không/nhẹ | Cục bộ | Đáng kể | Nặng=3; ảnh hưởng khả năng chịu lực=4 | `___` |
| **E5** | Lịch sử/cơi nới/sự cố & tính toàn vẹn | Không | Nhẹ/đã xử lý | Nhiều/chưa rõ | Thay đổi lớn/sự cố đáng kể=3–4 | `___` |
| **E6** | Tình trạng chức năng/tổng thể | Tốt | TB | Kém | Nguy cấp/không bảo đảm sử dụng=4 | `___` |

**Tổng hợp & Đánh giá ECS:**
- [ ] **Tổng ECS:** $\Sigma E = \_\_\_/24$
- [ ] **Quy đổi đề xuất:** `0–5 Good` \| `6–10 Medium` \| `11–16 Deficient` \| `17–24 Critical`
- [ ] **ECS Class:** [ ] `Good`  [ ] `Medium`  [ ] `Deficient`  [ ] `Critical`
- [ ] **Burland predominant:** Grade `____` *(Trích xuất từ Bước 4)*
- [ ] **Burland local max:** Grade `____` *(Trích xuất từ Bước 4)*
- [ ] **Structural flag:** [ ] `None`  [ ] `Low`  [ ] `Moderate`  [ ] `High`  [ ] `Critical` *(Trích xuất từ Bước 4)*
- [ ] **Engineering judgement:** [ ] `Giữ`  [ ] `Nâng`  [ ] `Hạ` \| **Lý do:** `____________________`
- [ ] **ECS override (Khóa an toàn):** *Critical structural issue $\Rightarrow$ không được hạ ECS chỉ vì Burland thấp ($E_2 \ge 3$ hoặc $E_3 \ge 3$).*

#### 7.2. Bảng Chỉ số Dễ Tổn thương VI (13. VI – VULNERABILITY INDEX):
*Ghi chú: Toàn bộ nguồn Map và quy tắc tính toán chi tiết của từng tiêu chí $V_1 \dots V_6$ được tích hợp trong biểu tượng Info Popover cạnh tiêu chí.*

| Mã | Tiêu chí đánh giá | 1 | 2 | 3 | 4 | Điểm |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| **V1** | Công năng & Quy mô | General (1đ) | Important (2đ) | — | Critical (4đ) | `___` |
| **V2** | Hệ kết cấu chịu lực | Khung BTCT toàn khối (1đ) | Khung BTCT + tường gạch (2đ) | Tường gạch chịu lực / thép cũ (3đ) | Tường không giằng / mất ổn định (4đ) | `___` |
| **V3** | Loại móng & Nền đất | Deep / cọc tốt (Cat 1-2) | Cọc ma sát / nông tốt (Cat 3) | Nông / tự suy luận (Cat 4) | Nền yếu / không rõ (Cat 5) | `___` |
| **V4** | Tuổi đời / Cơi nới | $< 10\text{ năm}$ (1đ) | $10 - 25\text{ năm}$ (2đ) | $25 - 40\text{ năm}$ (3đ) | $> 40\text{ năm}$ / Cơi nới (4đ) | `___` |
| **V5** | Hiện trạng kỹ thuật | ECS Good (1đ) | ECS Medium (2đ) | ECS Deficient (3đ) | ECS Critical (4đ) | `___` |
| **V6** | Thiết bị nhạy cảm | Không có (1đ) | Dân dụng (2đ) | Văn phòng / KD (3đ) | Y tế / TN (4đ) | `___` |

**Tổng hợp & Đánh giá VI:**
- [ ] **Tổng điểm VI:** $\Sigma V = \_\_\_/24$
- [ ] **Điểm trung bình:** $V_{\text{avg}} = \Sigma V / 6 = \_\_\_$
- [ ] **Phân hạng VI Class đề xuất:** `Low` ($\le 1.5$) | `Medium` ($1.5 - 2.5$) | `High` ($2.5 - 3.25$) | `Very High` ($> 3.25$).
- [ ] **Engineering judgement:** [ ] `Giữ`  [ ] `Nâng`  [ ] `Hạ` \| **Lý do:** `____________________`

---

### BƯỚC 8: Tổng hợp Kết luận Toàn diện & Đề xuất Kỹ thuật (Executive Summary Dashboard)
- [ ] **BCS / ECS:** Score /24 & ECS Class (`Good` / `Medium` / `Deficient` / `Critical`)
- [ ] **Burland & Cờ kết cấu:** Grade Chủ đạo, Grade Max, Vùng chi phối & Cờ kết cấu
- [ ] **Vulnerability (VI):** Điểm $V_{\text{avg}}$ & VI Class (`Low` / `Medium` / `High` / `Very High`)
- [ ] **Construction Impact (Tác động thi công):** Mặc định `Pending` *(Chờ số liệu thiết kế)*
- [ ] **BRA (Baseline Risk Assessment):** Mặc định `Pending` *(Chờ phê duyệt)*
- [ ] **Khuyết tật / Rủi ro chính:** (Nhập text mô tả tổng quát)
- [ ] **Kiến nghị cụ thể:** (Nhập text đề xuất giải pháp kỹ thuật / quan trắc)

---

### BƯỚC 9: Chốt Biên bản & Ký Xác nhận Hiện trường
- [ ] **Thống kê tổng số Tầng, Vùng (Z & E) & Khuyết tật D đã ghi nhận.**
- [ ] **Ý kiến / Phản hồi nguyên văn của Chủ hộ:** (Nhập text).
- [ ] **Ảnh Chữ ký Cán bộ Khảo sát (Prepared by):** Họ tên, Chức vụ, Ngày khảo sát, Chụp ảnh chữ ký giấy hoặc tải tệp ảnh lên (kèm xem trước & chụp lại).
- [ ] **Ảnh Chữ ký Chủ sở hữu (Owner/Representative):** Họ tên, Vai trò, Ngày ký, Chụp ảnh chữ ký giấy hoặc tải tệp ảnh lên (kèm xem trước & chụp lại).
- [ ] **Ảnh chụp Biên bản làm việc hiện trường (Working Minutes Photos):** Cho phép chụp / tải lên nhiều ảnh biên bản giấy đã ký tại hiện trường làm cơ sở lưu trữ pháp lý.
