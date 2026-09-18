# Bộ câu hỏi & Biểu mẫu Khảo sát Hiện trạng Công trình (KSQH - Metro 2)

> [!IMPORTANT]
> **LƯU Ý DÀNH CHO AI AGENT & DEVELOPER (TÀI LIỆU ĐANG TIẾP TỤC HOÀN THIỆN & MỞ RỘNG):**
> Tài liệu này là **bản đặc tả cơ sở (Baseline Specification)** cho biểu mẫu và quy trình khảo sát Đợt 1. Tài liệu **CHƯA PHẢI LÀ BẢN ĐẦY ĐỦ 100% TUYỆT ĐỐI** và sẽ tiếp tục được mở rộng chi tiết trong quá trình code và phát triển sản phẩm. Khi triển khai code thực tế, Agent/Developer cần nắm vững rằng hệ thống sẽ phát sinh thêm các trường dữ liệu thực địa, tùy chọn phụ và cần chủ động hoàn thiện cả code lẫn cập nhật ngược lại tài liệu này.

Dưới đây là **BỘ BIỂU MẪU KHẢO SÁT HỢP NHẤT DUY NHẤT** được sắp xếp theo đúng **trình tự thời gian thực địa của Cán bộ Khảo sát** (Từ lúc đứng ngoài nhà ➔ Phỏng vấn chủ hộ ➔ Khảo sát từng phòng ➔ Đo đạc lún nghiêng ➔ Tự động tính điểm ECS/VI ➔ Chốt biên bản & Ký tên).

---

## BỘ CÂU HỎI KHẢO SÁT HỢP NHẤT (SINGLE UNIFIED SURVEY FORM)

### BƯỚC 1: Tiếp cận ngoài nhà & Nhận diện Công trình
*Thực hiện ngay khi cán bộ vừa đến vị trí công trình.*

- [ ] **Mã Quản lý Dự án (Project Parcel Code):** `B-XXXXX` (Được sắp xếp quản lý theo lý trình tuyến Metro 2)
- [ ] **Mã Địa chính Gốc (Official Cadastral Code / KS003):** `KS003-XXXX` (Số tờ - Số thửa bản đồ địa chính nhà nước)
- [ ] **Tên công trình (Building Name):** (Nhập text tên riêng tòa nhà / biển hiệu thương mại / cơ quan - VD: `ABC Shop`, `Ngân hàng XXX`, `BHXanh`, `Cty May DEF`... Không phải mục công năng. Để trống nếu là nhà dân không có biển hiệu).
- [ ] **Địa chỉ (Address):** (Nhập text - Đối chiếu thực tế với sơ đồ quy hoạch)
- [ ] **Chủ sở hữu / Người sử dụng (Owner / User):** (Nhập text tên chủ nhà hoặc người đại diện)
- [ ] **Nhóm đối tượng / Phân loại & Xếp hạng sơ bộ (Survey Object Category):** (Chọn 1 trong 4 nhóm theo Tiêu chí áp dụng):
  - [ ] `Critical Building` - **Công trình trọng yếu:** (Bệnh viện, công trình được bảo tồn, công trình vận hành đặc biệt, hoặc có hậu quả cao nếu bị ảnh hưởng).
  - [ ] `Important Building` - **Công trình quan trọng:** (Từ 5 tầng trở lên hoặc có thiết bị/vật liệu nhạy cảm).
  - [ ] `General Building` - **Công trình thông thường:** (Công trình dân dụng thông thường dưới 5 tầng).
  - [ ] `Poor Structural Integrity` - **Kết cấu hiện trạng kém:** (Có hư hỏng / suy giảm chất lượng kết cấu rõ rệt).
- [ ] **Công trình liền kề theo các hướng (Adjacent Structures - Left / Right / Rear):**
  - **Bên trái:** (Chọn: `Nhà phố / Nhà dân` | `Cao tầng / Chung cư` | `Bệnh viện / Y tế` | `Trường học` | `Công viên / Cây xanh` | `Đất trống` | `Cơ sở tôn giáo (Chùa, Nhà thờ)` | `Không biết / Không rõ (Bị che khuất)` | `Khác...`)
  - **Bên phải:** (Chọn: `Nhà phố / Nhà dân` | `Cao tầng / Chung cư` | `Bệnh viện / Y tế` | `Trường học` | `Công viên / Cây xanh` | `Đất trống` | `Cơ sở tôn giáo (Chùa, Nhà thờ)` | `Không biết / Không rõ (Bị che khuất)` | `Khác...`)
  - **Phía sau:** (Chọn: `Nhà phố / Nhà dân` | `Cao tầng / Chung cư` | `Bệnh viện / Y tế` | `Trường học` | `Công viên / Cây xanh` | `Đất trống` | `Hẻm / Đường nội bộ` | `Không biết / Không rõ (Bị che khuất)` | `Khác...`)
- [ ] **Thông tin tuyến Metro & GIS (Hệ thống tự động bắt từ GPS):**
  - Lý trình (Chainage): *(Tự động)*
  - Khoảng cách tới tim tuyến Metro: *(Tự động)*
  - Khoảng cách tới ranh giải phóng mặt bằng: *(Tự động)*
  - Tọa độ GPS / GIS: *(Tự động bắt khi check-in)*
- [ ] **Chụp 4 Bộ Ảnh Định Danh (Có Watermark GPS & Thời gian | Hỗ trợ nút chọn "Không tồn tại / N/A"):**
  - **`P-01` (Biển số nhà / Biển tên cơ quan):**
    - [ ] `Có ảnh`: Chụp ảnh biển số nhà / biển tên cơ quan rõ nét.
    - [ ] `Không tồn tại (N/A)`: (Nhà không gắn biển số / Đất trống / Không có biển hiệu ➔ Cho phép bấm Next).
  - **`P-02` (Mặt đứng chính diện):**
    - [ ] `Có ảnh`: Chụp trực diện toàn bộ mặt tiền ngôi nhà. Sau khi chụp, PWA cung cấp các công cụ tương tác:
      - 🔴 **Icon Chấm tròn (Đa giác đứng / Polygon Corners):** Chạm mảng $N$ điểm góc ($N \ge 3$) bao quanh ngôi nhà (hỗ trợ nhà mái xéo, chữ L, giật cấp $N$ đỉnh giúp AI nhận diện khung nhà).
      - ➖ **Icon Line ngang (Đường phân tầng / Floor Split Lines):** Kéo các đường ngang phân tầng (Tầng trệt, Lầu 1, Lầu 2, Mái...).
      - ✏️ **Vẽ tay & Ghi kích thước (Freehand Note):** Chế độ cầm bút / chạm tay vẽ note kích thước trực tiếp lên ảnh ($W, H, h_1, h_2...$).
    - [ ] `Không tồn tại (N/A) / Bị che khuất`: (Mặt tiền bị che khuất hoàn toàn bởi công trình phía trước / Hẻm quá hẹp ➔ Nhập lý do và cho phép Next).
  - **`P-03` (Mặt bên hoặc mặt sau tiếp cận - Hỗ trợ chụp nhiều ảnh):**
    - [ ] `Có ảnh (Hỗ trợ chụp nhiều ảnh)`: Cho phép chụp nhiều góc với các nhãn lựa chọn: `Bên hông trái`, `Bên hông phải`, `Phía sau tiếp cận`, `Khác`.
    - [ ] `Không tồn tại (N/A)`: (Nhà phố liền kề 2 bên sát vách không có mặt hông ➔ Cho phép bấm Next).
  - **`P-04` (Bối cảnh tổng thể lấy cả đường/ngõ):**
    - [ ] `Có ảnh`: Chụp bối cảnh không gian tiếp cận đường/ngõ.
    - [ ] `Không tồn tại (N/A)`: (Nhập lý do ➔ Cho phép bấm Next).

---

### BƯỚC 2: Phỏng vấn Chủ hộ (Kiến trúc, Lịch sử & Nhạy cảm)
*Hỏi chuyện chủ nhà/người đại diện tại phòng khách hoặc sân trước.*

#### 2.1. Kiến trúc & Kết cấu nền:
- [ ] **Công năng sử dụng (Use):** (Chọn: `Nhà ở gia đình` | `Cửa hàng / Shop / Bách hóa` | `Quán ăn / Nhà hàng / Cafe` | `Văn phòng / Trụ sở cty` | `Khách sạn / Nhà nghỉ / Căn hộ DV` | `Bệnh viện / Y tế` | `Trường học / Đào tạo` | `Kho hàng / Xưởng sản xuất` | `Cơ sở tôn giáo (Chùa, Nhà thờ)` | `Công trình công cộng` | `Khác (Nhập chi tiết...)`)
- [ ] **Số tầng:** Số tầng nổi: _____ | Số tầng hầm: _____
- [ ] **Năm xây dựng / Tuổi thọ (Age):** (Nhập số năm - Tick chọn "Ước tính" nếu cần)
- [ ] **Hệ kết cấu chịu lực (Structural System):** (Chọn: `RC` - BTCT / `Steel` - Khung thép / `Masonry` - Tường gạch chịu lực / `Mixed` - Hỗn hợp / `Other` - Khác)
- [ X] **Dạng chịu lực (Structural Form):** (Chọn: `Frame` - Hệ khung / `Wall` - Tường chịu lực / `Mixed` - Hỗn hợp khung & tường / `Other` - Khác)
- [ ] **Loại móng (Foundation):** (Chọn: `Shallow` - Móng nông / `Wood` - Cừ tràm / `PC` - Cọc ép BTCT / `CIP` - Cọc khoan nhồi / `Unknown` - Không rõ)
- [ ] **Kích thước cọc (Pile Dimension):** (Nhập text - VD: `D600mm`, `250x250mm`... Để trống nếu không biết)
- [ ] **Bản vẽ hoàn công / Bản vẽ kết cấu:** (Chụp ảnh hoặc upload bản vẽ hoàn công nếu chủ nhà có lưu giữ)
- [ ] **Đánh giá Nguồn thông tin móng (CAT Foundation):**
  - Điểm CAT móng: (Nhập từ 1 đến 5 /5)
  - Nguồn thông tin (Source): (Multi-select: `Drawing` - Bản vẽ thiết kế / `Owner` - Chủ nhà khai / `Site` - Khảo sát thực địa)

#### 2.2. Lịch sử & Yếu tố Nhạy cảm (Chuẩn hóa tự động map điểm E5 trong bảng ECS):
- [ ] **Cơi nới / Thay đổi tải trọng:** (Chọn: `0đ - Không` / `1đ - Nhẹ / Đã xử lý` / `2đ - Nhiều / Chưa rõ` / `3-4đ - Thay đổi lớn / Nghiêm trọng`)
- [ ] **Sửa chữa lớn / Cải tạo kết cấu:** (Chọn: `0đ - Không` / `1đ - Nhẹ / Đã xử lý` / `2đ - Nhiều / Chưa rõ` / `3đ - Cải tạo lớn`)
- [ ] **Lún / Nghiêng ghi nhận trước đây:** (Chọn: `0đ - Không` / `1đ - Nhẹ / Đã ổn định` / `2đ - Rõ / Tiếp diễn` / `3đ - Nghiêm trọng`)
- [ ] **Hư hỏng do công trình lân cận gây ra:** (Chọn: `0đ - Không` / `1đ - Nhẹ` / `2đ - Đáng kể` / `3đ - Tranh chấp / Nghiêm trọng`)
- [ ] **Sự cố nghiêm trọng (Hỏa hoạn / Ngập lụt / Cháy nổ):** (Chọn: `0đ - Không` / `1đ - Nhẹ / Đã khắc phục` / `2đ - Trung bình / Chưa rõ` / `3đ - Nghiêm trọng`)
- [ ] **Thiết bị / Hoạt động nhạy cảm (Phòng lab, máy MRI/X-quang, đồ cổ, thư viện...):** (Chọn: `Không` / `Có` - Nhập mô tả chi tiết)
- [ ] **Tình trạng sử dụng hiện tại (Occupancy Status):** (Chọn: `Đang sử dụng 100%` / `Đang sử dụng một phần` / `Bỏ trống / Không sử dụng`)
- [ ] **Vận hành liên tục 24/7:** (Chọn: `Không` / `Có - Vận hành 24/7 (Bệnh viện, Data Center, Khách sạn, Nhà máy...)`)

---

### BƯỚC 3: Khảo sát Hiện trạng Chi tiết Theo Cấp Bậc (Tầng > Vùng Z > Khuyết tật D)
*Cán bộ khảo sát di chuyển và ghi nhận dữ liệu theo phân cấp cấu trúc công trình: Tầng (Floor) ➔ Vùng khảo sát (Zone Z) ➔ Điểm khuyết tật (Defect D) ➔ Sơ đồ mặt bằng CAD tầng.*

#### 3.1. Phân Cấp Tầng (Floor Level):
- [ ] **Chọn hoặc Thêm Tầng đang khảo sát:** (`Tầng hầm`, `Tầng 1 (Trệt)`, `Lầu 1 (Tầng 2)`, `Lầu 2 (Tầng 3)`, `Tầng lửng`, `Sân thượng / Mái`...).
- [ ] **Ảnh chụp tổng quan tầng (Floor Overview Photos):** Chụp nhiều ảnh góc rộng bao quát không gian của tầng.
- [ ] **Sơ đồ phác thảo kỹ thuật tầng (Floor CAD Sketch) & Chấm ghim Vị trí Vùng Z:**
  - Chụp ảnh hoặc tải lên bản vẽ CAD / sơ đồ phác thảo bố cục tầng (phòng ngủ, WC, hành lang...).
  - Thao tác chạm trực tiếp lên sơ đồ để **thả ghim (Square Badge) chỉ thị vị trí các Vùng `Z-01`, `Z-02`...** nằm ở đâu trong mặt bằng tầng.
- [ ] **Thanh điều hướng chuyển tầng (Floor Footer Navigation):** Nằm ngay dưới bản vẽ CAD ở cuối tầng, cho phép chuyển nhanh sang Tầng trước, Tầng tiếp theo hoặc Tạo tầng mới mà không cần cuộn ngược lên đầu trang.

#### 3.2. Phân Cấp Vùng Khảo Sát (Zone Level - Z-xx thuộc Tầng):
*Một tầng có thể có nhiều Vùng khảo sát (Z-01, Z-02...). Mỗi Vùng đại diện cho một mảng tường / không gian phòng cụ thể.*
- [ ] **Mã Vùng:** Tự động đánh số liên tục (`Z-01`, `Z-02`, `Z-03`...).
- [ ] **Tên Phòng / Không gian:** Chọn từ danh sách phổ biến (`Phòng khách`, `Phòng ngủ trước`, `Phòng ngủ sau`, `Phòng ngủ 1`, `Phòng ngủ 2`, `Bếp / Ăn`, `Ban công / Lô gia`, `Nhà vệ sinh / WC`, `Cầu thang / Hành lang`, `Sân thượng / Sân phơi`, `Phòng thờ`, `Gara / Nhà xe`, `Kho`) hoặc chọn `Khác` để nhập trực tiếp.
- [ ] **Cấu kiện chịu lực / Mảng vách:** (`Tường gạch vữa xi măng`, `Cột BTCT`, `Dầm BTCT`, `Sàn BTCT`, `Cầu thang BTCT`, `Mái / Sê nô`, `Khung thép`, `Khác`).
- [ ] **Vật liệu bề mặt cấu kiện:** Chọn từ danh sách phổ biến (`Tường gạch trát vữa XM sơn nước`, `Bê tông cốt thép (BTCT)`, `Tường gạch ốp gạch men`, `Tường gạch quét vôi`, `Tường / Vách thạch cao`, `Gỗ / Ván công nghiệp`, `Vách kính khung nhôm`) hoặc chọn `Khác` để nhập trực tiếp.
- [ ] **Ảnh hưởng chức năng / Cần sửa chữa:** (Chọn: `Không` / `Có - Cần sửa chữa` [Hệ thống tự động cộng 2 điểm vào chỉ số E6 tổng thể]).
- [ ] **Chốt Burland Grade sơ bộ (Rút gọn):**
  - `Grade 0 - Không đáng kể`
  - `Grade 1 - Rất nhẹ`
  - `Grade 2 - Nhẹ`
  - `Grade 3 - Trung bình`
  - `Grade 4 - Nặng`
  - `Grade 5 - Rất nặng`
  *(Có nút tra cứu quy chuẩn Burland để mở bảng tra cứu đầy đủ khi cần).*
- [ ] **Ảnh bối cảnh Vùng (Photo CTX):** Chụp bao quát mảng tường/cấu kiện để làm nền canvas thả ghim khuyết tật.

#### 3.3. Phân Cấp Khuyết Tật / Vết Nứt (Defect Level - D-xx thuộc Vùng Z-xx):
*Thả ghim trực tiếp lên Ảnh bối cảnh (Photo CTX) của Vùng Z-xx để định vị vết nứt (Hiển thị dạng biểu tượng vuông - Square Pin/Badge):*
- [ ] **Chạm mảng nứt để thả ghim:** Mã tự động `D-01`, `D-02`, `D-03`... kèm tọa độ pixel $(X\%, Y\%)$.
- [ ] **Chỉ số sàng lọc:** (`Nứt tường / Vữa trát`, `Nứt kết cấu Cột / Dầm / Sàn`, `Lún võng cấu kiện`, `Thấm dột / Ẩm mốc`, `Bong tróc vữa lộ cốt thép`, `Mất tiết diện bê tông`, `Kẹt cửa / Biến dạng khung`, `Tái nứt / Phát triển nứt cũ`).
- [ ] **Dạng nứt & Cấu kiện:** Chọn từ danh sách phổ biến (`Nứt xiên 45° (Cắt gãy / Biến dạng lún)`, `Nứt dọc / Nứt đứng chịu lực`, `Nứt ngang cấu kiện`, `Nứt chân chim / Mạng nhện vữa trát`, `Nứt ziczac theo mạch vữa gạch`, `Nứt góc cửa sổ / Cửa đi`, `Nứt tiếp giáp Cột - Tường`, `Nứt tiếp giáp Dầm - Tường`, `Nứt tách mép tấm sàn BTCT`, `Bong tróc vữa lộ cốt thép`, `Thấm dột / Ẩm mốc loang lổ`) hoặc chọn `Khác` để nhập trực tiếp.
- [ ] **Kích thước vết nứt:** Bề rộng lớn nhất $w_{\max}$ (mm), Chiều dài $L$ (mm), Hướng nứt.
- [ ] **Trạng thái hoạt động:** `U - Chưa rõ / Đang kiểm tra` / `S - Ổn định` / `A - Đang phát triển`.
- [ ] **Ý nghĩa kết cấu:** (`Không ảnh hưởng`, `Thấp`, `Trung bình`, `Cao`, `Rất nguy hiểm / Cảnh báo sập` [Tự động map điểm E2 tương ứng 0-4]).
- [ ] **Mức độ Suy giảm Vật liệu / Bong tróc / Rỉ thép:** (`Không / Rất nhẹ`, `Cục bộ (Bong tróc nhẹ)`, `Đáng kể (Bong mảng rộng, rỉ rác)`, `Nặng (Bong diện rộng, cốt thép rỉ)`, `Ảnh hưởng chịu lực (Rỉ đứt thép, mất tiết diện)` [Tự động map điểm E4 tương ứng 0-4]).
- [ ] **Ảnh cận cảnh vết nứt có thước đo (Photo CU):** Đặt thước đo Crack Scale Card sát khe nứt và chụp.

---

### BƯỚC 4: Đánh giá Lún – Nghiêng – Biến dạng
*Thực hiện đánh giá hoặc đo đạc các biến dạng hình học công trình (Hệ thống tự động map điểm E3 vào bảng ECS).*

- [ ] **1. Lún chênh:** (`Không có dấu hiệu`, `Nghi ngờ / Nhẹ`, `Rõ nhưng ổn định`, `Tiến triển / Nghiêm trọng`, `Mất ổn định`)
- [ ] **2. Nghiêng công trình:** (`Không`, `Nhẹ`, `Rõ`, `Nghiêm trọng` | Tỉ lệ nghiêng mặt trước X % và mặt hông Y %)
- [ ] **3. Nghiêng sàn:** (`Không`, `Nhẹ`, `Rõ`)
- [ ] **4. Võng dầm / Sàn:** (`Không`, `Nhẹ`, `Rõ`)
- [ ] **5. Nguồn xác định dữ liệu:** (Multi-select: Quan sát mắt thường / Đo nhanh bằng thiết bị / Bản vẽ thiết kế / Chủ nhà)
- [ ] **6. Độ tin cậy dữ liệu:** (Chọn: `Cao` / `Trung bình` / `Thấp`)
- [ ] **7. Yêu cầu Đo đạc / Quan trắc bổ sung:** (Chọn: `Không` / `Có` | Nhận xét: ______)

---

### BƯỚC 5: Xác nhận Phạm vi & Điều chỉnh Ranh Thửa Đất GIS (Sau khi đi hết các tầng)
*Sau khi cán bộ đã đi hết các tầng, nắm trọn vẹn hiện trạng không gian toà nhà và ranh giới thực tế.*

- [ ] **1. Phạm vi đã khảo sát (Survey Scope):** (Tự động tích chọn trước `Bên ngoài / Mặt tiền (P-01 → P-04)` và toàn bộ các Tầng đã ghi nhận dữ liệu ở Bước 3; hỗ trợ chọn thêm: `Mái / Sân thượng / Sê-nô`, `Tầng hầm / Bán hầm`, `Khu phụ / Sân sau / Giếng trời`).
- [ ] **2. Hạn chế tiếp cận (Access Limitations):** (Chọn: `Không có hạn chế (Tiếp cận 100%)` / `Có hạn chế tiếp cận`):
  - **Vị trí / Khu vực bị hạn chế:** Chọn từ danh sách phổ biến (`Các tầng lầu trên cao`, `Mái/Sân thượng`, `Tầng hầm/Bán hầm`, `Phòng ngủ/Khu vực riêng tư`, `Phòng kho khóa cửa`, `Khu phụ`, `Toàn bộ bên trong nhà`, `Khác...`).
  - **Phân rã tầng lầu bị hạn chế (Khi tick chọn "Các tầng lầu trên cao"):**
    - Hệ thống hiển thị danh sách các ô chọn tầng (`Lầu 1`, `Lầu 2`, `Lầu 3`, `Lầu 4`, `Lầu 5`...).
    - **Cơ chế vô hiệu hóa an toàn:** Toàn bộ các tầng lầu **đã có dữ liệu khảo sát ở Bước 3** sẽ bị **VÔ HIỆU HÓA (Disabled)** kèm huy hiệu `Đã KS ở B3` để ngăn chặn surveyor đánh nhầm mâu thuẫn dữ liệu.
    - Cuối danh sách có nút `+ Thêm lầu cao hơn` (mở rộng thêm `Lầu 6`, `Lầu 7`... đối với nhà nhiều tầng).
  - **Nguyên nhân chính:** Chọn từ danh sách phổ biến (`Chỉ đồng ý cho xem tầng trệt`, `Chủ nhà đi vắng/Khóa cửa`, `Chủ nhà không cho phép`, `Khu vực nguy hiểm`, `Kẹt cửa/Mất chìa khóa`, `Khu vực chứa tài sản nhạy cảm`, `Khác...`).
  - **Ghi chú diễn giải:** Nhập text mô tả chi tiết biên bản hiện trường.
- [ ] **3. Kiểm tra Đối soát Kích thước & Điều chỉnh Ranh Thửa Đất trên GIS (Cadastral Boundary & Mutation Engine):**
  - **Hiển thị kích thước thửa ban đầu:** Thẻ giao diện sáng (Light theme) hiển thị trực quan thông số hình học thửa đất trên nền bản đồ PostGIS: Mặt tiền ($W$), Chiều sâu ($D$), Diện tích thửa gốc ($S_{\text{đất}}\text{ m}^2$), Mã quản lý dự án (`B-XXXXX`) và Mã địa chính gốc (`KS003-XXXX`).
  - **3 Trạng thái nghiệp vụ & Động cơ tương tác:**
    1. **`1. Khớp ranh (MATCH)` - Xác nhận 100% diện tích:**
       - Bản đồ Leaflet hiển thị duy nhất 1 mình thửa đất hiện tại trên hệ tọa độ chuẩn quy hoạch.
       - Tự động xác nhận ranh công trình xây dựng thực tế trùng khớp 100% ranh thửa đất địa chính ($S_{\text{xd}} = S_{\text{đất}}\text{ m}^2$) mà không cần tùy chọn thừa.
       - Bấm nút *Xác nhận Khớp ranh 100% & Lưu hồ sơ*.
    2. **`2. Tách thửa (SPLIT)` - 2 Màu phân biệt & Metadata Đất thừa:**
       - Bản đồ GIS hiển thị 2 màu phân biệt: **Màu 1 (Hổ phách `#f59e0b` cho Căn A / Đang khảo sát)** và **Màu 2 (Cam Đỏ `#ea580c` cho Căn B / Phần còn dư / Đất thừa)**.
       - Cung cấp 2 Option biên tập:
         - *Option 1 (Kéo nắn điểm mút / Trượt ranh phân cắt):* Tự động tính toán diện tích $S_A, S_B\text{ m}^2$ theo thời gian thực.
         - *Option 2 (Vẽ lại đường bao các ô):* Khuôn mẫu Nhà chữ L (cắt góc sân hông/căn sau), Chia trước/sau, Chia dọc, Đa giác tự do.
       - **Cấp mã động theo $B_{\max}$:** Mã dự án mới được cấp phát tuần tự dựa trên giá trị lớn nhất hiện hữu trong CSDL ($B_{\max}+1, B_{\max}+2 > 07000$).
       - **Đồng bộ công năng & Metadata Đất thừa:** Danh mục công năng đồng bộ 100% với hệ thống (Nhà ở, Cửa hàng, Quán ăn, Văn phòng, Khách sạn...) và bổ sung tùy chọn mặc định `⚠️ Đất thừa / Sai số biên ranh (RESIDUAL_SURPLUS)`.
       - Khi chọn *Đất thừa*, metadata của lô đất tự động lưu vết nguồn gốc: `residualParentParcelCode`, `residualParentCadastralCode`, `residualMetadataNote` phục vụ truy xuất sau này.
       - **Quy tắc kỹ thuật xử lý mé sai số:** Mọi phần diện tích dôi dư mặc định thuộc về Căn B (Thửa thứ 2). Khi khảo sát Căn B, surveyor chỉ việc vẽ đúng ranh căn đó và phần mé thừa tự động tính là lô phụ.
    3. **`3. Gộp thửa (MERGE)` - Multi-Select chọn nhiều thửa & Render 10 ô gần nhất:**
       - Bản đồ Leaflet hiển thị **10 thửa đất thực tế gần nhất** từ CSDL.
       - Thửa đang khảo sát **SÁNG ĐÈN NỔI BẬT** (Neon Cyan `#38bdf8` / `#0284c7`).
       - Cho phép **Multi-select chọn nhiều thửa liền kề** (2, 3 hoặc nhiều thửa) để gộp chung vào 1 khối công trình mà không dùng popup che đè bản đồ.
       - **Quy tắc Bất biến & Dual-ID:** Hệ thống tự động so sánh mã, giữ mã nhỏ nhất làm Thửa đại diện chính, toàn bộ các thửa phụ còn lại chuyển trạng thái `MERGED_DEPRECATED` và tính toán tổng diện tích gộp $S_{\text{gộp}} = S_{\text{chính}} + \sum S_{\text{phụ}}\text{ m}^2$.
       - Gửi Đề xuất Gộp thửa lên Zone Admin phê duyệt (`POST /api/v1/mutations/propose`).


---

### BƯỚC 6: Tự động Tính Điểm Kỹ thuật ECS & VI (Auto Calculations 100%)

#### 6.1. Bảng Điểm Hiện Hữu ECS (Auto-Calculated từ Bước 2, 3, 4):
- [ ] **Chỉ số ECS (Điểm 0–4 từng mục):**
  - `E1` (Hư hỏng tường/khối xây): *(Tự động map từ Burland Grade)*
  - `E2` (Khuyết tật kết cấu cột/dầm/sàn): *(Tự động map từ Ý nghĩa kết cấu D-xx)*
  - `E3` (Lún/nghiêng/võng): *(Tự động map từ Bước 4 Lún nghiêng)*
  - `E4` (Suy giảm vật liệu/độ bền): *(Tự động map từ Mức độ suy giảm D-xx)*
  - `E5` (Lịch sử/cơi nới/sự cố): *(Tự động map từ Bước 2.2 Lịch sử phỏng vấn)*
  - **`E6` Tình trạng chức năng / Tổng thể:** (Chọn: `0` - Tốt / `1` - TB / `2` - Kém / `3-4` - Nguy cấp | Tự động gợi ý từ các Vùng Z)
- [ ] **Tổng ECS:** $\Sigma E = \_\_\_/24$ | **Phân hạng ECS Class:** (`Good` [0-5] / `Medium` [6-10] / `Deficient` [11-16] / `Critical` [17-24])
- [ ] **Engineering Judgement (Quyền Can thiệp của Kỹ sư):** (Chọn: `Giữ nguyên` / `Nâng hạng` / `Hạ hạng` | Lý do: ________ - *Cảnh báo: Nếu có cờ kết cấu Critical hoặc Lún nghiêng nghiêm trọng (E2 $\ge 3$ hoặc E3 $\ge 3$) ➔ Khóa an toàn không cho hạ hạng ECS*)

#### 6.2. Bảng Chỉ số Dễ Tổn thương VI (Chọn Option Tinh Gọn + Pre-selected):
- [ ] **V1. Công năng & Quy mô:** (Chọn 1 trong 4 option: `1đ - Bỏ hoang` / `2đ - General (Thông thường)` / `3đ - Important (Quan trọng)` / `4đ - Critical (Trọng yếu)` | Tự động đề xuất từ Nhóm đối tượng Bước 1)
- [ ] **V2. Hệ kết cấu chịu lực:** (Chọn 1 trong 4 option: `1đ - Khung BTCT toàn khối` / `2đ - Khung BTCT + tường gạch` / `3đ - Tường gạch chịu lực/Khung thép cũ` / `4đ - Tường không giằng/Mất ổn định`)
- [ ] **V3. Loại móng & Nền đất:** `[TỰ ĐỘNG MAP TỪ CAT MÓNG BƯỚC 2.1: 1-4 điểm]`
- [ ] **V4. Tuổi đời / Cơi nới:** (Chọn 1 trong 4 option: `1đ - < 10 năm` / `2đ - 10-25 năm` / `3đ - 25-40 năm` / `4đ - > 40 năm/Cơi nới`)
- [ ] **V5. Hiện trạng kỹ thuật ECS:** `[TỰ ĐỘNG MAP TỪ ECS CLASS MỤC 6.1: 1-4 điểm]`
- [ ] **V6. Thiết bị nhạy cảm:** (Chọn 1 trong 4 option: `1đ - Không có` / `2đ - Gia dụng` / `3đ - Văn phòng/KD` / `4đ - Y tế/Thí nghiệm 24/7`)
- [ ] **Tổng VI ($\Sigma V$) & Điểm TB ($V_{\text{avg}}$) ➔ Phân hạng VI Class:** (`Low` / `Medium` / `High` / `Very High`)

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

### BƯỚC 7: Tổng hợp Kết luận & Đề xuất Kỹ thuật (Executive Summary Dashboard)
- [ ] **BCS / ECS:** *(Tự động tổng hợp)* Score /24 & ECS Class (`Good` / `Medium` / `Deficient` / `Critical` - Kèm hạng điều chỉnh sau can thiệp)
- [ ] **Burland:** *(Tự động tổng hợp)* Grade Chủ đạo & Grade Cục bộ lớn nhất
- [ ] **Structural Flag (Cờ kết cấu):** *(Tự động tổng hợp)* (`None` / `Low` / `Moderate` / `High` / `Critical`)
- [ ] **Vulnerability (VI):** *(Tự động tổng hợp)* Điểm $V_{\text{avg}}$ & VI Class (`Low` / `Medium` / `High` / `Very High`)
- [ ] **Construction Impact (Tác động thi công):** (Mặc định: `Pending` - Tùy chọn: `Low [I=1]`, `Medium [I=2]`, `High [I=3]`, `Very High [I=4]`)
- [ ] **BRA (Baseline Risk Assessment):** (Mặc định: `Pending` - Tùy chọn: `Low`, `Medium`, `High`, `Very High`)
- [ ] **Khuyết tật / Rủi ro chính:** (Nhập text mô tả tổng quát khuyết tật nổi bật nhất)
- [ ] **Kiến nghị cụ thể:** (Nhập text đề xuất giải pháp kỹ thuật / quan trắc)

---

### BƯỚC 8: Chốt Biên bản & Ký Xác nhận Hiện trường 3 Bên
- [ ] **Tổng số Tầng, Vùng & Khuyết tật đã ghi nhận:** *(Hệ thống tự đếm và hiển thị thanh thống kê)*
- [ ] **Ý kiến / Phản hồi nguyên văn của Chủ hộ:** (Nhập text)
- [ ] **Ảnh Chữ ký / Ảnh Cán bộ Khảo sát (Prepared by):** Họ tên, Chức vụ, Ngày khảo sát, Ký tay trên màn hình hoặc Chụp ảnh chữ ký/chân dung tại hiện trường.
- [ ] **Ảnh Chữ ký / Ảnh Người kiểm tra (Checked by):** Họ tên, Chức vụ, Ngày kiểm tra, Ký tay trên màn hình hoặc Chụp ảnh chữ ký.
- [ ] **Ảnh Chữ ký / Ảnh Chủ sở hữu (Owner/Representative):** Họ tên, Vai trò, Ngày ký, Ký tay trên màn hình hoặc Chụp ảnh chữ ký/chân dung tại hiện trường.

