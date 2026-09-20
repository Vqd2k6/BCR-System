# Bộ câu hỏi & Biểu mẫu Khảo sát Hiện trạng Công trình (KSQH - Metro 2)

> [!IMPORTANT]
> **LƯU Ý DÀNH CHO AI AGENT & DEVELOPER (TÀI LIỆU ĐANG TIẾP TỤC HOÀN THIỆN & MỞ RỘNG):**
> Tài liệu này là **bản đặc tả cơ sở (Baseline Specification)** cho biểu mẫu và quy trình khảo sát Đợt 1. Tài liệu **CHƯA PHẢI LÀ BẢN ĐẦY ĐỦ 100% TUYỆT ĐỐI** và sẽ tiếp tục được mở rộng chi tiết trong quá trình code và phát triển sản phẩm. Khi triển khai code thực tế, Agent/Developer cần nắm vững rằng hệ thống sẽ phát sinh thêm các trường dữ liệu thực địa, tùy chọn phụ và cần chủ động hoàn thiện cả code lẫn cập nhật ngược lại tài liệu này.

Dưới đây là **BỘ BIỂU MẪU KHẢO SÁT HỢP NHẤT DUY NHẤT** được sắp xếp theo đúng **trình tự thời gian thực địa của Cán bộ Khảo sát** (Từ lúc đứng ngoài nhà ➔ Phỏng vấn chủ hộ ➔ Khảo sát chụp ảnh từng phòng ➔ Chốt kết luận Burland & Cờ kết cấu ➔ Đo đạc lún nghiêng ➔ Điều chỉnh ranh GIS ➔ Qua cổng kiểm tra dữ liệu ➔ Tự động tính điểm ECS/VI ➔ Dashboard & Ký tên).

---

## BỘ CÂU HỎI KHẢO SÁT HỢP NHẤT (SINGLE UNIFIED SURVEY FORM)

### BƯỚC 1: Tiếp cận ngoài nhà & Nhận diện Công trình
*Thực hiện ngay khi cán bộ vừa đến vị trí công trình.*

- [ ] **Mã Quản lý Dự án (Project Parcel Code):** `B-XXXXX` (Được sắp xếp quản lý theo lý trình tuyến Metro 2)
- [ ] **Mã Địa chính Gốc (Official Cadastral Code / KS003):** `KS003-XXXX` (Số tờ - Số thửa bản đồ địa chính nhà nước)
- [ ] **Tên công trình (Building Name):** (Nhập text tên riêng tòa nhà / biển hiệu thương mại / cơ quan - VD: `ABC Shop`, `Ngân hàng XXX`, `BHXanh`, `Cty May DEF`... Không phải mục công năng. Để trống nếu là nhà dân không có biển hiệu).
- [ ] **Địa chỉ (Address):** (Nhập text - Đối chiếu thực tế với sơ đồ quy hoạch)
- [ ] **Chủ sở hữu / Người sử dụng (Owner / User):** (Nhập text tên chủ nhà hoặc người đại diện)
- [ ] **Nhóm đối tượng / Phân loại sơ bộ (Survey Object Category):** (Chọn 1 trong 3 nhóm chuẩn theo Docx):
  - [ ] `General Building` - **Công trình thông thường:** (Công trình dân dụng thông thường dưới 5 tầng).
  - [ ] `Important Building` - **Công trình quan trọng:** (Từ 5 tầng trở lên hoặc có thiết bị/vật liệu nhạy cảm).
  - [ ] `Critical Building` - **Công trình trọng yếu:** (Bệnh viện, công trình được bảo tồn, công trình vận hành đặc biệt, hoặc có hậu quả cao nếu bị ảnh hưởng).
- [ ] **Công trình liền kề theo các hướng (Adjacent Structures - Left / Right / Rear):**
  - **Bên trái:** (Chọn: `Nhà phố / Nhà dân` | `Cao tầng / Chung cư` | `Bệnh viện / Y tế` | `Trường học` | `Công viên / Cây xanh` | `Đất trống` | `Cơ sở tôn giáo (Chùa, Nhà thờ)` | `Không biết / Không rõ (Bị che khuất)` | `Khác...`)
  - **Bên phải:** (Chọn: `Nhà phố / Nhà dân` | `Cao tầng / Chung cư` | `Bệnh viện / Y tế` | `Trường học` | `Công viên / Cây xanh` | `Đất trống` | `Cơ sở tôn giáo (Chùa, Nhà thờ)` | `Không biết / Không rõ (Bị che khuất)` | `Khác...`)
  - **Phía sau:** (Chọn: `Nhà phố / Nhà dân` | `Cao tầng / Chung cư` | `Bệnh viện / Y tế` | `Trường học` | `Công viên / Cây xanh` | `Đất trống` | `Hẻm / Đường nội bộ` | `Không biết / Không rõ (Bị che khuất)` | `Khác...`)
- [ ] **Thông tin tuyến Metro & GIS (Hệ thống tự động bắt từ GPS):**
  - Lý trình (Chainage): *(Tự động)*
  - Khoảng cách tới tim tuyến Metro: *(Tự động)*
  - Khoảng cách tới ranh giải phóng mặt bằng: *(Tự động)*
  - Tọa độ GPS / GIS: *(Tự động bắt khi check-in)*
- [ ] **Chụp 4 Bộ Ảnh Định Danh Ngoại Thất (Có Watermark GPS & Thời gian | Hỗ trợ nút chọn "Không tồn tại / N/A"):**
  - **`P-01` (Biển số nhà / Biển tên cơ quan):**
    - [ ] `Có ảnh`: Chụp ảnh biển số nhà / biển tên cơ quan rõ nét.
    - [ ] `Không tồn tại (N/A)`: (Nhà không gắn biển số / Đất trống / Không có biển hiệu ➔ Cho phép bấm Next).
  - **`P-02` (Mặt đứng chính diện):**
    - [ ] `Có ảnh`: Chụp trực diện toàn bộ mặt tiền ngôi nhà. Sau khi chụp, PWA cung cấp các công cụ tương tác:
      - 🔴 **Icon Chấm tròn (Đa giác đứng / Polygon Corners):** Chạm mảng $N$ điểm góc ($N \ge 3$) bao quanh ngôi nhà (hỗ trợ nhà mái xéo, chữ L, giật cấp $N$ đỉnh giúp AI nhận diện khung nhà).
      - ➖ **Icon Line ngang (Đường phân tầng / Floor Split Lines):** Kéo các đường ngang phân tầng (`Tầng trệt`, `Tầng 1`, `Tầng 2`, `Mái`...).
      - ✏️ **Vẽ tay & Ghi kích thước (Freehand Note):** Chế độ cầm bút / chạm tay vẽ note kích thước trực tiếp lên ảnh ($W, H, h_1, h_2...$).
    - [ ] `Không tồn tại (N/A) / Bị che khuất`: (Mặt tiền bị che khuất hoàn toàn bởi công trình phía trước / Hẻm quá hẹp ➔ Nhập lý do và cho phép Next).
  - **`P-03` (Mặt bên hoặc mặt sau tiếp cận - Hỗ trợ chụp nhiều ảnh):**
    - [ ] `Có ảnh (Hỗ trợ chụp nhiều ảnh)`: Cho phép chụp nhiều góc với các nhãn lựa chọn: `Bên hông trái`, `Bên hông phải`, `Phía sau tiếp cận`, `Khác`.
    - [ ] `Không tồn tại (N/A)`: (Nhà phố liền kề 2 bên sát vách không có mặt hông ➔ Cho phép bấm Next).
  - **`P-04` (Bối cảnh tổng thể lấy cả đường/ngõ):**
    - [ ] `Có ảnh`: Chụp bối cảnh không gian tiếp cận đường/ngõ.
    - [ ] `Không tồn tại (N/A)`: (Nhập lý do ➔ Cho phép bấm Next).

- [ ] **Khảo sát trực quan Lún chênh & Nghiêng công trình ngoài nhà (Building Tilt & Settlement Overview):**
  - *Đánh giá mức độ biến dạng hình học khối nhà theo 4 Level chuẩn (kèm mức 0đ cơ sở). Mỗi mục có nút trợ giúp `?` hiển thị biểu hiện vật lý thực địa:*
  - **1. Lún chênh quan sát ngoài nhà / Tầng trệt:** 
    - [ ] **Mức độ (Level):**
      - `0đ - Không`: Không phát hiện dấu hiệu lún chênh.
      - `1đ - Nghi ngờ / Rất nhẹ (Chớm vi phạm thẩm mỹ)` *(Vết nứt chân chim tiếp giáp móng-tường, chớm tách khe nhẹ)*
      - `2đ - Rõ nhưng ổn định (Ảnh hưởng sử dụng)` *(Lún nền trệt 1–2cm, cửa bắt đầu rít nhẹ)*
      - `3đ - Tiến triển / Nghiêm trọng (Nguy hiểm kết cấu)` *(Lún nứt tách khối nhà, cửa kẹt cứng, biến dạng tăng)*
      - `4đ - Mất ổn định / Nguy cấp (Nguy cơ sập đổ)` *(Lún sụt trượt móng nghiêm trọng, nguy cơ đổ sập)*
    - [ ] **Thông tin bổ sung (Additional details):** Vị trí cụ thể (`______`), Ảnh chụp chi tiết vết lún.
  - **2. Độ nghiêng công trình (Mặt tiền / Khối nhà):**
    - [ ] **Mức độ (Level):**
      - `0đ - Không`: Khối nhà thẳng đứng bình thường.
      - `1đ - Nghi ngờ / Rất nhẹ (Chớm vi phạm thẩm mỹ)` *(Độ nghiêng $< 2‰$, khó nhận biết bằng mắt thường)*
      - `2đ - Rõ nhưng ổn định (Ảnh hưởng sử dụng)` *(Độ nghiêng $2 - 5‰$, nhìn thấy hơi nghiêng)*
      - `3đ - Tiến triển / Nghiêm trọng (Nguy hiểm kết cấu)` *(Độ nghiêng $5 - 10‰$, nghiêng rõ rệt, kết cấu chịu tải lệch)*
      - `4đ - Mất ổn định / Nguy cấp (Nguy cơ sập đổ)` *(Độ nghiêng $> 10‰$, mất ổn định tổng thể tòa nhà)*
    - [ ] **Thông tin bổ sung (Additional details):** Độ nghiêng $X = \_\_\_\text{ ‰}$, $Y = \_\_\_\text{ ‰}$, Hướng nghiêng (`Trước` | `Sau` | `Trái` | `Phải`).
  - **3. Độ tin cậy dữ liệu:** (Chọn: `Cao` | `Trung bình` | `Thấp`)
  - **4. Nguồn xác định dữ liệu:** (Multi-select: `Quan sát trực quan` | `Đo nhanh thước/laser` | `Hồ sơ bản vẽ` | `Chủ nhà khai`)

> [!IMPORTANT]
> ### 🚪 QUY TRÌNH KIỂM SOÁT BÁO VẮNG NHÀ (Absentee Survey Flow):
> - **Nguyên tắc chống gian lận & bỏ sót hiện trường:** Hệ thống **TUYỆT ĐỐI KHÔNG CHO PHÉP** cán bộ khảo sát chỉ bấm nút báo vắng rồi gửi báo cáo ngay lập tức về server.
> - **Cơ chế hoạt động:**
>   1. Khi tới trước ngôi nhà, nếu chủ nhà đi vắng / khóa cửa / không tiếp cận được bên trong, cán bộ bấm nút **`Báo Vắng Nhà (Khảo sát Ngoại cảnh)`**.
>   2. Hệ thống chuyển sang **Chế độ Khảo sát Vắng**: Yêu cầu cán bộ phải hoàn thành **100% tất cả các trường thông tin của BƯỚC 1** (Định danh, 3 giáp ranh, GPS/Metro, Chụp đủ 4 bộ ảnh $P\text{-01} \dots P\text{-04}$ kèm vẽ đa giác đứng Polygon, Cụm Lún/Nghiêng ngoài nhà, Lý do vắng nhà).
>   3. Khi và chỉ khi toàn bộ dữ liệu ngoại cảnh của Bước 1 được điền đầy đủ và hợp lệ, hệ thống mới gắn nhãn `ABSENT_EXTERIOR_COMPLETED` và kích hoạt nút **`Nộp Báo Cáo Vắng Nhà Về Server`**.
>   4. Báo cáo vắng nhà được lưu trữ đầy đủ căn cứ pháp lý ngoại thất, làm cơ sở hẹn lịch khảo sát lại đợt tiếp theo.

---

### BƯỚC 2: Phỏng vấn Chủ hộ (Kiến trúc, Lịch sử tính E5 & Yếu tố Nhạy cảm)
*Hỏi chuyện chủ nhà/người đại diện tại phòng khách hoặc sân trước.*

#### 2.1. Kiến trúc & Kết cấu nền:
- [ ] **Công năng sử dụng (Use):** (Chọn: `Nhà ở gia đình` | `Cửa hàng / Shop / Bách hóa` | `Quán ăn / Nhà hàng / Cafe` | `Văn phòng / Trụ sở cty` | `Khách sạn / Nhà nghỉ / Căn hộ DV` | `Bệnh viện / Y tế` | `Trường học / Đào tạo` | `Kho hàng / Xưởng sản xuất` | `Cơ sở tôn giáo (Chùa, Nhà thờ)` | `Công trình công cộng` | `Khác (Nhập chi tiết...)`)
- [ ] **Số tầng:** Số tầng nổi: _____ | Số tầng hầm: _____ *(Quy ước: Tầng trệt tính là tầng nổi đầu tiên)*
- [ ] **Năm xây dựng / Tuổi thọ (Age):** (Nhập số năm - Tick chọn "Ước tính" nếu cần)
- [ ] **Hệ kết cấu chịu lực (Structural System):** (Chọn: `RC` - BTCT / `Steel` - Khung thép / `Masonry` - Tường gạch chịu lực / `Mixed` - Hỗn hợp / `Other` - Khác)
- [ ] **Loại móng (Foundation):** (Chọn: `Shallow` - Móng nông / `Wood` - Cừ tràm / `PC` - Cọc ép BTCT / `CIP` - Cọc khoan nhồi / `Unknown` - Không rõ)
- [ ] **Kích thước cọc / móng (Pile/Foundation Dimension):** (Nhập text - VD: `D600mm`, `250x250mm`... Để trống nếu không biết)
- [ ] **Bản vẽ hoàn công / Bản vẽ kết cấu & Cơ chế đánh giá tự động CAT Foundation (Thang 1 đến 5 điểm):**
  - **Trường hợp A: Có bản vẽ hoàn công / kết cấu (Điền đầy đủ thông tin móng & cọc):**
    - Cán bộ tải lên / chụp ảnh bản vẽ hoàn công.
    - Bên dưới ảnh bản vẽ xuất hiện **2 option lựa chọn nguồn xác thực**:
      - [ ] `Xác nhận từ Chính quyền / Đơn vị thiết kế` ➔ Tự động gán **Mức 1 (Cat 1 - Dữ liệu chuẩn xác thực)**
      - [ ] `Phỏng vấn chủ nhà (có lưu giữ bản vẽ)` ➔ Tự động gán **Mức 2 (Cat 2 - Có bản vẽ từ chủ hộ)**
  - **Trường hợp B: Không có bản vẽ hoàn công (Surveyor tích chọn "N/A - Không có bản vẽ"):**
    - Khi tích chọn `N/A`, hệ thống ẩn khung upload và hiển thị **2 nút bấm lựa chọn**:
      - [ ] `Phỏng vấn chủ hộ` ➔ Tự động gán **Mức 3 (Cat 3 - Chủ nhà nhớ và khai thông tin móng/cọc)**
      - [ ] `Tự suy luận từ kinh nghiệm hiện trường` ➔ Tự động gán **Mức 4 (Cat 4 - Ước lượng theo số tầng, niên đại, kết cấu)**
  - **Trường hợp C: Hoàn toàn không có thông tin móng & cọc:**
    - Khi không có dữ liệu móng/cọc, không có bản vẽ và không thể suy luận ➔ Tự động gán **Mức 5 (Cat 5 - Không rõ thông tin móng)**

#### 2.2. Lịch sử & Yếu tố Nhạy cảm (Khảo sát lịch sử phục vụ riêng cho tính chỉ số E5 trong bảng ECS):
> [!NOTE]
> Đây là các câu hỏi phỏng vấn về **lịch sử quá khứ** của công trình do chủ nhà cung cấp, phục vụ riêng cho việc tính chỉ số $E_5$. Các hư hỏng/vết nứt hiện trạng sẽ được ghi nhận độc lập ở Bước 3 và Bước 4.

- [ ] **1. Cơi nới - Thay đổi tải trọng trong quá khứ:** (Chọn: `0đ - Không` | `1đ - Nhẹ - Đã xử lý ổn định` | `2đ - Nhiều - Chưa rõ kết cấu` | `3đ - Thay đổi lớn - Nghiêm trọng`)
- [ ] **2. Sửa chữa lớn - Cải tạo kết cấu:** (Chọn: `0đ - Không` | `1đ - Nhẹ - Đã xử lý` | `2đ - Nhiều - Chưa rõ hồ sơ` | `3đ - Cải tạo lớn ảnh hưởng chịu lực`)
- [ ] **3. Lún - Nghiêng ghi nhận trước đây:** (Chọn: `0đ - Không` | `1đ - Nhẹ - Đã ổn định` | `2đ - Rõ - Tiếp diễn` | `3đ - Nghiêm trọng`)
- [ ] **4. Hư hỏng do công trình lân cận gây ra:** (Chọn: `0đ - Không` | `1đ - Nhẹ - Đã bồi thường` | `2đ - Đáng kể` | `3đ - Tranh chấp - Nghiêm trọng`)
- [ ] **5. Sự cố nghiêm trọng (Hỏa hoạn - Ngập lụt - Nổ):** (Chọn: `0đ - Không` | `1đ - Nhẹ - Đã khắc phục` | `2đ - Trung bình - Chưa rõ mức ảnh hưởng` | `3đ - Nghiêm trọng`)
- [ ] **Thiết bị - Hoạt động nhạy cảm:** (Chọn: `Không có` | `Có` - Nhập mô tả: Phòng lab, máy MRI/X-quang, đồ cổ, thư viện...)
- [ ] **Tình trạng sử dụng hiện tại (Occupancy Status):** (Chọn: `Đầy đủ` | `Đang sử dụng một phần` | `Bỏ trống - Không sử dụng`)
- [ ] **Vận hành liên tục 24/7:** (Chọn: `Không` | `Có - Vận hành 24/7 (Bệnh viện, Data Center, Khách sạn, Nhà máy...)`)

---

### BƯỚC 3: Khảo sát Hiện trạng Chi tiết Theo Cấp Bậc (Tầng > Vùng Z > Khuyết tật D)
*Cán bộ khảo sát di chuyển và ghi nhận dữ liệu theo phân cấp cấu trúc công trình: Tầng (Floor) ➔ Vùng khảo sát (Zone Z) ➔ Điểm khuyết tật (Defect D) ➔ Sơ đồ mặt bằng CAD tầng.*

#### 3.1. Phân Cấp Tầng (Floor Level):
- [ ] **Chọn hoặc Thêm Tầng đang khảo sát:** (`Tầng hầm`, `Tầng trệt`, `Tầng 1`, `Tầng 2`, `Tầng 3`, `Tầng lửng`, `Sân thượng / Mái`...).
- [ ] **Ảnh chụp tổng quan tầng (Floor Overview Photos):** Chụp nhiều ảnh góc rộng bao quát không gian của tầng.
- [ ] **Sơ đồ phác thảo kỹ thuật tầng (Floor CAD Sketch) & Chấm ghim Vị trí Vùng Z:**
  - Chụp ảnh hoặc tải lên bản vẽ CAD / sơ đồ phác thảo bố cục tầng (phòng khách, phòng ngủ, WC, hành lang...).
  - Thao tác chạm trực tiếp lên sơ đồ để **thả ghim (Square Badge) chỉ thị vị trí các Vùng `Z-01`, `Z-02`...** nằm ở đâu trong mặt bằng tầng.
- [ ] **Thanh điều hướng chuyển tầng (Floor Footer Navigation):** Nằm ngay dưới bản vẽ CAD ở cuối tầng, cho phép chuyển nhanh sang Tầng trước, Tầng tiếp theo hoặc Tạo tầng mới mà không cần cuộn ngược lên đầu trang.

#### 3.2. Phân Cấp Vùng Khảo Sát (Zone Level - Z-xx thuộc Tầng):
*Một tầng có thể có nhiều Vùng khảo sát (Z-01, Z-02...). Mỗi Vùng đại diện cho một mảng tường / không gian phòng cụ thể.*
- [ ] **Mã Vùng:** Tự động đánh số liên tục (`Z-01`, `Z-02`, `Z-03`...).
- [ ] **Tên Phòng / Không gian:** Chọn từ danh sách phổ biến (`Phòng khách`, `Phòng ngủ trước`, `Phòng ngủ sau`, `Phòng ngủ 1`, `Phòng ngủ 2`, `Bếp / Ăn`, `Ban công / Lô gia`, `Nhà vệ sinh / WC`, `Cầu thang / Hành lang`, `Sân thượng / Sân phơi`, `Phòng thờ`, `Gara / Nhà xe`, `Kho`) hoặc chọn `Khác` để nhập trực tiếp.
- [ ] **Cấu kiện chịu lực / Mảng vách:** (`Tường gạch vữa xi măng`, `Cột BTCT`, `Dầm BTCT`, `Sàn BTCT`, `Cầu thang BTCT`, `Mái / Sê nô`, `Khung thép`, `Khác`).
- [ ] **Vật liệu bề mặt cấu kiện:** Chọn từ danh sách phổ biến (`Tường gạch trát vữa XM sơn nước`, `Bê tông cốt thép (BTCT)`, `Tường gạch ốp gạch men`, `Tường gạch quét vôi`, `Tường / Vách thạch cao`, `Gỗ / Ván công nghiệp`, `Vách kính khung nhôm`) hoặc chọn `Khác` để nhập trực tiếp.
- [ ] **Ảnh hưởng chức năng / Cần sửa chữa:** (Chọn: `Không` / `Có - Cần sửa chữa` [Hệ thống tự động cộng điểm vào chỉ số E6 tổng thể]).
- [ ] **Chốt Burland Grade sơ bộ (Rút gọn):**
  - `Grade 0 - Không đáng kể (<=0.1mm)`
  - `Grade 1 - Rất nhẹ (~0.1-1mm)`
  - `Grade 2 - Nhẹ (~1-5mm)`
  - `Grade 3 - Trung bình (~5-15mm)`
  - `Grade 4 - Nặng (~15-25mm)`
  - `Grade 5 - Rất nặng (>=25mm)`
- [ ] **Ảnh bối cảnh Vùng (Photo CTX):** Chụp bao quát mảng tường/cấu kiện để làm nền canvas thả ghim khuyết tật.

#### 3.3. Phân Cấp Khuyết Tật / Vết Nứt (Defect Level - D-xx thuộc Vùng Z-xx):
*Thả ghim trực tiếp lên Ảnh bối cảnh (Photo CTX) của Vùng Z-xx để định vị vết nứt (Hiển thị dạng biểu tượng vuông - Square Pin/Badge):*
- [ ] **Chạm mảng nứt để thả ghim:** Mã tự động `D-01`, `D-02`, `D-03`... kèm tọa độ pixel $(X\%, Y\%)$.
- [ ] **Chỉ số sàng lọc & Định lượng khuyết tật (Ánh xạ 8 nhóm chỉ báo BCS - Nguồn tự động tính E2, E4, E6):**
  - **1. Nứt tường / Vữa trát / Hoàn thiện:** (Phục vụ đối chiếu cấp Burland $E_1$)
  - **2. Nứt cấu kiện kết cấu (Cột / Dầm / Sàn / Tường chịu lực):** (Phục vụ cờ kết cấu $E_2$)
  - **3. Lún chênh / Võng cấu kiện:** (Phục vụ đối soát $E_3$)
  - **4. Thấm dột / Ẩm mốc / Rò nước (Nguồn tính E6):** (Chọn mức độ: `Ẩm mốc - 1đ` | `Thấm nước - 2đ` | `Dột nước - 3đ` | `Rò nước / Ngập tràn - 4đ`)
  - **5. Bong tróc / Ăn mòn / Lộ cốt thép / Mục (Nguồn tính E4):** (Chọn mức độ: `Nhẹ - 1đ` | `Bong tróc / Ăn mòn rõ - 2đ` | `Bong mảng lớn / Lộ cốt thép rỉ - 3đ` | `Mất tiết diện / Mất khả năng chịu lực - 4đ`)
  - **6. Mất tiết diện / Hư hỏng gối tựa / Liên kết:** (Phục vụ cờ kết cấu $E_2$)
  - **7. Kẹt cửa / Biến dạng khung cửa (Nguồn tính E6):** (Chọn số lượng/mức độ: `0 cửa - 0đ` | `1-2 cửa - 1đ` | `2-5 cửa - 2đ` | `>5 cửa - 3đ` | `Cửa kẹt cứng không đóng/mở được - 4đ`)
  - **8. Tái nứt / Phát triển nứt cũ:** (Phục vụ phân loại tính chất hoạt động)
- [ ] **Dạng nứt & Cấu kiện:** Chọn từ danh sách phổ biến (`Nứt xiên 45° (Cắt gãy / Lún chênh)`, `Nứt dọc / Nứt đứng chịu lực`, `Nứt ngang cấu kiện`, `Nứt chân chim / Mạng nhện vữa trát`, `Nứt ziczac theo mạch vữa gạch`, `Nứt góc cửa sổ / Cửa đi`, `Nứt tiếp giáp Cột - Tường`, `Nứt tiếp giáp Dầm - Tường`, `Nứt tách mép tấm sàn BTCT`, `Bong tróc vữa lộ cốt thép`, `Thấm dột / Ẩm mốc loang lổ`) hoặc chọn `Khác` để nhập trực tiếp.
- [ ] **Kích thước vết nứt:** Bề rộng lớn nhất $w_{\max}$ (mm), Chiều dài $L$ (mm), Hướng nứt.
- [ ] **Trạng thái hoạt động:** `U - Chưa rõ / Đang kiểm tra (Unknown)` / `S - Ổn định / Nứt cũ (Stable)` / `A - Đang phát triển / Nghi ngờ hoạt động (Active)`.
- [ ] **Ý nghĩa kết cấu:** (`None / N/A - Không ảnh hưởng` [0đ], `Low - Thấp` [1đ], `Moderate - Trung bình` [2đ], `High - Cao` [3đ], `Critical - Rất nguy hiểm / Cảnh báo sập` [4đ] [Tự động map điểm E2 tương ứng 0-4]).
- [ ] **Mức độ Suy giảm Vật liệu / Bong tróc / Rỉ thép:** (`Không / Rất nhẹ` [0đ], `Cục bộ (Bong tróc nhẹ)` [1đ], `Đáng kể (Bong mảng rộng, rỉ rác)` [2đ], `Nặng (Bong diện rộng, cốt thép rỉ)` [3đ], `Ảnh hưởng chịu lực (Rỉ đứt thép, mất tiết diện)` [4đ] [Tự động map điểm E4 tương ứng 0-4]).
- [ ] **Ảnh cận cảnh vết nứt có thước đo (Photo CU):** Đặt thước đo Crack Scale Card sát khe nứt và chụp.

---

### BƯỚC 4: Kết luận Burland & Đánh giá Cờ Kết cấu (Theo đúng Mục 9 Docx)
*Thực hiện NGAY SAU KHI khảo sát chụp ảnh xong các tầng — khi hình ảnh và mức độ hư hại thực tế còn tươi mới nhất trong tâm trí cán bộ khảo sát.*

- [ ] **1. Burland chủ đạo (Predominant Grade):** `Grade ___` *(Tự động tổng hợp mức độ phổ biến nhất từ các Vùng Z)*
- [ ] **2. Burland cục bộ lớn nhất (Local Max Grade):** `Grade ___` *(Tự động lấy Grade cao nhất ghi nhận trong toàn bộ công trình)*
- [ ] **3. Vùng chi phối (Governing Zone):** Chọn mã `Z-____` (VD: `Z-02`) | Mô tả mảng tường/khu vực: `______________________`
- [ ] **4. Tính đại diện (Representativeness):** (Chọn: `Toàn công trình` | `Cục bộ`)
- [ ] **5. Cờ khuyết tật kết cấu (Structural Defect Flag):** (Chọn / Tự động tổng hợp: `None` | `Low` | `Moderate` | `High` | `Critical`)
- [ ] **6. Cần Structural Engineer review:** (Chọn: `Không` | `Có`)

> [!NOTE]
> **Quy tắc kỹ thuật cốt lõi (Docx Mục 9):**
> Không lấy trung bình số học các Grade Burland. Grade cục bộ lớn nhất phải được báo riêng; kết luận toàn công trình cần nêu rõ cả mức chủ đạo và mức cục bộ lớn nhất.

#### BẢNG TRA CỨU QUY CHUẨN BURLAND (Cheat Sheet Tooltip trên App)

| Grade | Mức độ | Mô tả / Mức sửa chữa điển hình | Bề rộng nứt xấp xỉ |
| :---: | :--- | :--- | :--- :
| **0** | Negligible | Nứt tóc; thực tế không cần sửa chữa. | $\le 0.1$ mm |
| **1** | Very slight | Nứt mảnh, dễ xử lý trong trang trí/bảo trì thông thường. | $\sim 0.1 - 1$ mm |
| **2** | Slight | Nứt dễ trám; có thể cần trang trí lại/miết mạch; cửa có thể hơi kẹt. | $\sim 1 - 5$ mm |
| **3** | Moderate | Cần mở rộng/vá nứt, sửa cục bộ khối xây; nhiều vết $>3$mm, kẹt cửa/ảnh hưởng chức năng. | $\sim 5 - 15$ mm |
| **4** | Severe | Sửa chữa lớn/thay thế cục bộ; tường biến dạng; có thể ảnh hưởng gối tựa/liên kết. | $\sim 15 - 25$ mm |
| **5** | Very severe | Hư hỏng rất nặng; có thể cần chống đỡ/xây lại một phần hoặc toàn bộ. | $\ge 25$ mm |

---

### BƯỚC 5: Tổng hợp Biến dạng Kết cấu & Đo đạc Bổ sung
*Hệ thống tự động liên kết số liệu Lún chênh & Độ nghiêng công trình đã khảo sát từ Bước 1; Cán bộ khảo sát ghi nhận thêm hiện tượng võng dầm/sàn bên trong.*

- [ ] **1. Số liệu Lún chênh & Nghiêng công trình:** *(Tự động đồng bộ từ Bước 1: Level Lún chênh trệt/ngoài nhà, Level Độ nghiêng $X, Y\text{ ‰}$, Độ tin cậy dữ liệu)*
- [ ] **2. Võng dầm / Sàn kết cấu bên trong:**
  - [ ] **Mức độ (Level):**
    - `0đ - Không`: Dầm/sàn phẳng phiu bình thường.
    - `1đ - Nghi ngờ / Rất nhẹ (Chớm vi phạm thẩm mỹ)` *(Võng nhẹ mặt đáy chưa nhìn thấy rõ bằng mắt thường)*
    - `2đ - Rõ nhưng ổn định (Ảnh hưởng sử dụng)` *(Võng nhìn thấy bằng mắt thường nhưng đã ổn định, không nứt)*
    - `3đ - Tiến triển / Nghiêm trọng (Nguy hiểm kết cấu)` *(Võng lớn kèm nứt chữ V giữa nhịp dầm/sàn, rung khi đi lại)*
    - `4đ - Mất ổn định / Nguy cấp (Nguy cơ sập đổ)` *(Võng quá giới hạn cho phép, nguy cơ sập gãy kết cấu sàn/dầm)*
  - [ ] **Thông tin bổ sung (Additional details):** Vị trí cấu kiện (`______`), Độ võng ước tính (mm), Mô tả hiện tượng.
- [ ] **3. Cần đo / Quan trắc bổ sung chuyên sâu:** (Chọn: `Không` | `Có` ➔ Nhận xét: `__________________`)

---

### BƯỚC 6: Xác nhận Phạm vi, Hạn chế & Điều chỉnh Ranh Thửa Đất GIS
*Sau khi cán bộ đã đi hết các tầng, nắm trọn vẹn hiện trạng không gian toà nhà và ranh giới thực tế.*

- [ ] **6.1. Phạm vi đã khảo sát (Survey Scope):** (Tự động tích chọn trước `Bên ngoài / Mặt tiền (P-01 → P-04)` và toàn bộ các Tầng đã ghi nhận dữ liệu ở Bước 3; hỗ trợ chọn thêm: `Mái / Sân thượng / Sê-nô`, `Tầng hầm / Bán hầm`, `Khu phụ / Sân sau / Giếng trời`).
- [ ] **6.2. Hạn chế tiếp cận (Access Limitations):** (Chọn: `Không có hạn chế (Tiếp cận 100%)` / `Có hạn chế tiếp cận` / `Từ chối / Vắng mặt`):
  - **Vị trí / Khu vực bị hạn chế:** Chọn từ danh sách phổ biến (`Các tầng lầu trên cao`, `Mái/Sân thượng`, `Tầng hầm`, `Phòng ngủ/Khu vực riêng tư`, `Phòng kho khóa cửa`, `Khu phụ`, `Toàn bộ bên trong nhà`, `Khác...`).
  - **Phân rã tầng lầu bị hạn chế (Khi tick chọn "Các tầng lầu trên cao"):**
    - Hệ thống hiển thị danh sách các ô chọn tầng (`Tầng 1`, `Tầng 2`, `Tầng 3`, `Tầng 4`...).
    - **Cơ chế vô hiệu hóa an toàn:** Toàn bộ các tầng lầu **đã có dữ liệu khảo sát ở Bước 3** sẽ bị **VÔ HIỆU HÓA (Disabled)** kèm huy hiệu `Đã KS ở B3` để ngăn chặn surveyor đánh nhầm mâu thuẫn dữ liệu.
    - Cuối danh sách có nút `+ Thêm tầng cao hơn` (mở rộng thêm `Tầng 5`, `Tầng 6`... đối với nhà nhiều tầng).
  - **Nguyên nhân chính:** Chọn từ danh sách phổ biến (`Chỉ đồng ý cho xem tầng trệt`, `Chủ nhà đi vắng/Khóa cửa`, `Chủ nhà không cho phép`, `Khu vực nguy hiểm`, `Kẹt cửa/Mất chìa khóa`, `Khu vực chứa tài sản nhạy cảm`, `Khác...`).
  - **Ghi chú diễn giải:** Nhập text mô tả chi tiết biên bản hiện trường.
- [ ] **6.3. Kiểm tra Đối soát Kích thước & Điều chỉnh Ranh Thửa Đất trên GIS (Cadastral Boundary & Mutation Engine):**
  - **Hiển thị kích thước thửa ban đầu:** Thẻ giao diện sáng (Light theme) hiển thị trực quan thông số hình học thửa đất trên nền bản đồ PostGIS: Mặt tiền ($W$), Chiều sâu ($D$), Diện tích thửa gốc ($S_{\text{đất}}\text{ m}^2$), Mã quản lý dự án (`B-XXXXX`) và Mã địa chính gốc (`KS003-XXXX`).
  - **3 Trạng thái nghiệp vụ & Động cơ tương tác:**
    1. **`1. Khớp ranh (MATCH)` - Xác nhận 100% diện tích:**
       - Bản đồ Leaflet hiển thị duy nhất 1 mình thửa đất hiện tại trên hệ tọa độ chuẩn quy hoạch.
       - Tự động xác nhận ranh công trình xây dựng thực tế trùng khớp 100% ranh thửa đất địa chính ($S_{\text{xd}} = S_{\text{đất}}\text{ m}^2$).
       - Bấm nút *Xác nhận Khớp ranh 100% & Lưu hồ sơ*.
    2. **`2. Tách thửa (SPLIT)` - 2 Màu phân biệt & Metadata Đất thừa:**
       - Bản đồ GIS hiển thị 2 màu phân biệt: **Màu 1 (Hổ phách `#f59e0b` cho Căn A / Đang khảo sát)** và **Màu 2 (Cam Đỏ `#ea580c` cho Căn B / Phần còn dư / Đất thừa)**.
       - Cung cấp 2 Option biên tập:
         - *Option 1 (Kéo nắn điểm mút / Trượt ranh phân cắt):* Tự động tính toán diện tích $S_A, S_B\text{ m}^2$ theo thời gian thực.
         - *Option 2 (Vẽ lại đường bao các ô):* Khuôn mẫu Nhà chữ L (cắt góc sân hông/căn sau), Chia trước/sau, Chia dọc, Đa giác tự do.
       - **Cấp mã động theo $B_{\max}$:** Mã dự án mới được cấp phát tuần tự dựa trên giá trị lớn nhất hiện hữu trong CSDL ($B_{\max}+1, B_{\max}+2 > 07000$).
       - **Đồng bộ công năng & Metadata Đất thừa:** Danh mục công năng đồng bộ 100% với hệ thống (Nhà ở, Cửa hàng, Quán ăn, Văn phòng, Khách sạn...) và bổ sung tùy chọn mặc định `⚠️ Đất thừa / Sai số biên ranh (RESIDUAL_SURPLUS)`.
       - Khi chọn *Đất thừa*, metadata của lô đất tự động lưu vết nguồn gốc: `residualParentParcelCode`, `residualParentCadastralCode`, `residualMetadataNote` phục vụ truy xuất sau này.
    3. **`3. Gộp thửa (MERGE)` - Multi-Select chọn nhiều thửa & Render 10 ô gần nhất:**
       - Bản đồ Leaflet hiển thị **10 thửa đất thực tế gần nhất** từ CSDL.
       - Thửa đang khảo sát **SÁNG ĐÈN NỔI BẬT** (Neon Cyan `#38bdf8` / `#0284c7`).
       - Cho phép **Multi-select chọn nhiều thửa liền kề** (2, 3 hoặc nhiều thửa) để gộp chung vào 1 khối công trình.
       - **Quy tắc Bất biến & Dual-ID:** Hệ thống tự động so sánh mã, giữ mã nhỏ nhất $B_{\min}$ làm Thửa đại diện chính, toàn bộ các thửa phụ còn lại chuyển trạng thái `MERGED_DEPRECATED` và tính toán tổng diện tích gộp $S_{\text{gộp}} = S_{\text{chính}} + \sum S_{\text{phụ}}\text{ m}^2$.

---

### CỔNG KIỂM TRA ĐỦ DỮ LIỆU (DATA COMPLETENESS GATE)
*Hệ thống tự động quét kiểm tra 6 tiêu chí kỹ thuật trước khi chuyển sang tính toán kết luận:*

- [ ] **1. Thông tin móng:** Tự động check đã có điểm CAT móng hay chưa (`Đủ` / `Chưa đủ`).
- [ ] **2. Ảnh & Damage Mapping:** Tự động check đủ 4 ảnh P-01..04, ảnh Vùng CTX và ghim khuyết tật D-xx (`Đủ` / `Thiếu`).
- [ ] **3. Khảo sát bên trong:** Tự động trích xuất từ Bước 6.1 & 6.2 (`Đã khảo sát 100%` / `Hạn chế` / `Vắng mặt`).
- [ ] **4. Dữ liệu lún/nghiêng:** Tự động trích xuất từ Bước 1 & Bước 5 (`Đủ` / `Cần đo thêm`).
- [ ] **5. Hồ sơ/bản vẽ kết cấu:** Tự động check file đính kèm ở Bước 2.1 (`Có` / `Một phần` / `Không`).
- [ ] **6. Structural Review:** Tự động cảnh báo Pending nếu có khuyết tật $E_2 \ge 3$ hoặc Cờ kết cấu High/Critical (`N/A` / `Đủ` / `Pending`).
- [ ] **Quyết định Cổng (Gate Decision BRA):** (Chọn: `Cho phép chuyển tiếp` / `Có điều kiện` / `Chưa đủ - Pending` | Nhập lý do điều kiện).

---

### BƯỚC 7: Tự động Tính Điểm Kỹ thuật ECS & VI (Auto Calculations 100%)

#### 7.1. Bảng Điểm Hiện Hữu ECS (11. ECS – EXISTING CONDITION SCORE):
> **Ghi chú chuẩn Docx:** *ECS là thang sàng lọc của dự án; phải được Engineer/Project phê duyệt trước khi dùng làm tiêu chí hợp đồng. Burland chỉ là một đầu vào đối với hư hỏng tường/khối xây, không thay thế đánh giá khuyết tật kết cấu.*

| Mã | Tiêu chí đánh giá | 0 | 1 | 2 | 3–4 | Nguồn lấy dữ liệu & Công thức tính toán (Mapping Logic) | Điểm |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **E1** | Hư hỏng nhìn thấy tường/khối xây | Burland 0–1 | Burland 2 | Burland 3 | Burland 4=3; 5=4 | **Nguồn:** `Burland Grade` lớn nhất từ các Vùng $Z\text{-xx}$ (Bước 3 / Bước 4)<br>➔ **Quy tắc:** $B \le 1 \to 0\text{đ}$; $B=2 \to 1\text{đ}$; $B=3 \to 2\text{đ}$; $B=4 \to 3\text{đ}$; $B=5 \to 4\text{đ}$ | `___` |
| **E2** | Khuyết tật kết cấu cột/dầm/sàn/tường chịu lực | Không | Low | Moderate | High=3; Critical=4 | **Nguồn:** `Ý nghĩa kết cấu` của Defect $D\text{-xx}$ (Bước 3.3) & `Cờ kết cấu` (Bước 4)<br>➔ **Quy tắc:** $\max(\text{Mức độ cờ kết cấu})$: $\text{None} \to 0\text{đ}$; $\text{Low} \to 1\text{đ}$; $\text{Mod} \to 2\text{đ}$; $\text{High} \to 3\text{đ}$; $\text{Critical} \to 4\text{đ}$ | `___` |
| **E3** | Lún/nghiêng/võng/biến dạng | Không | Nghi ngờ/nhẹ | Rõ nhưng ổn định | Tiến triển/nghiêm trọng=3; mất ổn định=4 | **Nguồn:** Level Lún chênh & Nghiêng tại **Bước 1** + Level Võng dầm/sàn tại **Bước 5**<br>➔ **Quy tắc:** $\max(\text{Level Lún}, \text{Level Nghiêng}, \text{Level Võng})$ ($0 \to 4\text{đ}$) | `___` |
| **E4** | Suy giảm vật liệu/độ bền | Không/nhẹ | Cục bộ | Đáng kể | Nặng=3; ảnh hưởng khả năng chịu lực=4 | **Nguồn:** Trường `Mức độ suy giảm vật liệu` (chịu lực) của toàn bộ Defect $D\text{-xx}$ (Bước 3.3)<br>➔ **Quy tắc:** $\max(\text{Mức độ suy giảm } D\text{-xx})$: Không $\to 0\text{đ}$; Nhẹ $\to 1\text{đ}$; Bong tróc/ăn mòn rõ $\to 2\text{đ}$; Bong rộng/lộ thép/suy giảm đáng kể $\to 3\text{đ}$; Mất tiết diện/Mất khả năng chịu lực $\to 4\text{đ}$ | `___` |
| **E5** | Lịch sử/cơi nới/sự cố & tính toàn vẹn | Không | Nhẹ/đã xử lý | Nhiều/chưa rõ | Thay đổi lớn/sự cố đáng kể=3–4 | **Nguồn:** 5 câu hỏi phỏng vấn lịch sử tại **Bước 2.2**<br>➔ **Quy tắc:** $\text{MaxScore} = \max(\text{5 câu B2.2})$. Nếu có từ 2 trường thông tin cùng $> 2$ (tức cùng đạt mức $3\text{đ}$) và bằng nhau thì $E_5 = 3 + 1 = 4\text{đ}$; các trường hợp còn lại $E_5 = \text{MaxScore}$ | `___` |
| **E6** | Tình trạng chức năng/tổng thể | Tốt | TB | Kém | Nguy cấp/không bảo đảm sử dụng=4 | **Nguồn:** Khuyết tật Thấm dột ($1-4\text{đ}$), Kẹt cửa ($1-4\text{đ}$) tại **Bước 3.3** + `Cần sửa chữa` tại **Bước 3.2**<br>➔ **Quy tắc:** $\max(\text{Thấm dột}, \text{Kẹt cửa}, \text{Sửa chữa } Z)$: $0\text{đ} \to 0\text{đ}$; $1\text{đ} \to 1\text{đ}$; $2\text{đ} \to 2\text{đ}$; $3-4\text{đ} \to 3-4\text{đ}$ | `___` |

**Tổng hợp & Đánh giá ECS:**
- [ ] **Tổng ECS:** $\Sigma E = \_\_\_/24$
- [ ] **Quy đổi đề xuất:** `0–5 Good` \| `6–10 Medium` \| `11–16 Deficient` \| `17–24 Critical`
- [ ] **ECS Class:** [ ] `Good`  [ ] `Medium`  [ ] `Deficient`  [ ] `Critical`
- [ ] **Burland predominant:** Grade `____` *(Trích xuất từ Bước 4)*
- [ ] **Burland local max:** Grade `____` *(Trích xuất từ Bước 4)*
- [ ] **Structural flag:** [ ] `None`  [ ] `Low`  [ ] `Moderate`  [ ] `High`  [ ] `Critical` *(Trích xuất từ Bước 4)*
- [ ] **Engineering judgement:** [ ] `Giữ`  [ ] `Nâng`  [ ] `Hạ` \| **Lý do:** `____________________`
- [ ] **ECS override (Khóa an toàn):** *Critical structural issue $\Rightarrow$ không được hạ ECS chỉ vì Burland thấp ($E_2 \ge 3$ hoặc $E_3 \ge 3$).*

> [!NOTE]
> ### 📘 GIẢI THÍCH CHI TIẾT CƠ CHẾ TỰ ĐỘNG CHẤM CHỈ SỐ E4 (Suy giảm vật liệu / Độ bền):
> 1. **Ý nghĩa pháp lý trong dự án Metro (Căn cứ đền bù / Khước từ đền bù):**
>    - Khi thi công Metro (khoan hầm TBM, ép cọc, đào hở), rung chấn và lún đất dễ khiến các mảng bê tông/vữa **vốn đã bị rỉ sét, mục rỗng, phong hóa từ trước** bị rơi rụng hoặc nứt toác.
>    - **Nếu App đã ghi nhận $E_4 \ge 2$ (kèm ảnh cận cảnh Photo CU trơ thép rỉ, vữa bong):** Dự án có bằng chứng xác nhận kết cấu đã suy giảm từ trước $\Rightarrow$ **Căn cứ từ chối hoặc giới hạn phạm vi đền bù**.
>    - **Nếu $E_4 = 0$ (vật liệu nguyên vẹn):** Mọi hư hỏng phát sinh sau này là do Metro gây ra $\Rightarrow$ **Căn cứ bồi thường thỏa đáng**.
> 2. **Thang điểm 5 mức của $E_4$:**
>    - `0 điểm (Không / Rất nhẹ)`: Vật liệu bê tông, gạch, vữa bình thường; chỉ bám bẩn bề mặt.
>    - `1 điểm (Cục bộ)`: Rộp sơn, bong tróc nhẹ lớp trát ngoài tại 1-2 vị trí nhỏ (chưa lộ gạch/thép).
>    - `2 điểm (Đáng kể)`: Bong mảng vữa lớn, ẩm mốc ngấm sâu, phong hóa mạch vữa gạch nhiều nơi.
>    - `3 điểm (Nặng)`: Bê tông bảo vệ bị nứt bung, **lộ cốt thép bên trong bị rỉ sét**, gỗ mục ruỗng.
>    - `4 điểm (Ảnh hưởng chịu lực)`: **Cốt thép rỉ nặng đứt gãy, tiết diện dầm/cột/sàn bị suy giảm nghiêm trọng**, bê tông vỡ vụn.
> 3. **Thuật toán Tự động tính toán (Auto-Engine):**
>    - Hệ thống tự động quét toàn bộ các khuyết tật $D\text{-01}, D\text{-02}, D\text{-03}\dots$ đã ghi nhận ở Bước 3.3 trên tất cả các tầng.
>    - Công thức: $$E_4 = \max_{i} (\text{Điểm suy giảm vật liệu của Defect } D_i)$$

> [!NOTE]
> ### 📜 GIẢI THÍCH CHI TIẾT CƠ CHẾ TỰ ĐỘNG CHẤM CHỈ SỐ E5 (Lịch sử cơi nới, sửa chữa & Cộng hưởng rủi ro):
> 1. **Ý nghĩa pháp lý:** Các công trình có tiền sử cơi nới thêm tầng, từng bị lún nứt cũ hoặc chịu sự cố hỏa hoạn/ngập úng có độ nhạy cảm và nguy cơ suy thoái kết cấu rất cao khi tuyến hầm Metro thi công.
> 2. **Thuật toán Cộng hưởng rủi ro (Risk Resonance Logic):**
>    - Tính điểm lớn nhất của 5 câu hỏi phỏng vấn lịch sử Bước 2.2: $\text{MaxScore} = \max(\text{Cơi nới}, \text{Sửa chữa}, \text{Lún cũ}, \text{Lân cận}, \text{Sự cố})$.
>    - Đếm số lượng câu hỏi có điểm bằng $\text{MaxScore}$: $\text{CountMax}$.
>    - **Quy tắc:**
>      - Nếu $\text{MaxScore} > 0$ và $\text{CountMax} \ge 2$ (tồn tại từ 2 yếu tố rủi ro cùng đạt mức cao nhất) $\Rightarrow$ **Cộng thêm 1 điểm gia số rủi ro**:
>        $$E_5 = \min(\text{MaxScore} + 1, 4)$$
>      - Ngược lại (chỉ có 1 yếu tố hoặc tất cả bằng 0đ):
>        $$E_5 = \text{MaxScore}$$
>    - *Ví dụ:* Cơi nới = 2đ (Nhiều), Lún nghiêng cũ = 2đ (Rõ tiếp diễn) $\Rightarrow \text{Max} = 2$, có 2 yếu tố $\Rightarrow E_5 = 2 + 1 = \mathbf{3\text{ điểm}}$.

> [!NOTE]
> ### 🚪 GIẢI THÍCH CHI TIẾT CƠ CHẾ TỰ ĐỘNG CHẤM CHỈ SỐ E6 (Tình trạng chức năng & Khả năng vận hành):
> 1. **Ý nghĩa pháp lý trong dự án Metro (Căn cứ đền bù / Khước từ đền bù):**
>    - Khi thi công hầm ngầm, rung chấn và lún không đều rất dễ làm vặn vẹo khung bao cửa dẫn đến **kẹt cửa, không đóng mở được**, hoặc gây nứt rách các lớp màng chống thấm dẫn đến **thấm ngấm, rò rỉ nước**.
>    - **Nếu App đã ghi nhận hiện trạng ban đầu $E_6 \ge 2$ (kèm ảnh hiện trường cửa đã kẹt sẵn, tường/trần đã ẩm mốc rò rỉ):** Dự án có căn cứ chứng minh các hư hỏng công năng này đã tồn tại từ trước $\Rightarrow$ **Căn cứ từ chối bồi thường các hư hỏng chức năng cũ**.
>    - **Nếu $E_6 = 0$ (mọi cửa đóng mở trơn tru, không thấm dột):** Sau này nếu nhà bị kẹt cửa hoặc rò rỉ nước do ảnh hưởng của Metro $\Rightarrow$ **Căn cứ bồi thường / sửa chữa thỏa đáng cho người dân**.
> 2. **Thang điểm 5 mức của $E_6$:**
>    - `0 điểm (Tốt / Nguyên vẹn)`: Không kẹt cửa, không thấm dột, toàn bộ các không gian sử dụng bình thường.
>    - `1 điểm (TB - Ảnh hưởng nhẹ)`: Ẩm mốc nhẹ bề mặt (1đ) HOẶC kẹt 1–2 cánh cửa nhẹ nhưng vẫn đóng/mở được (1đ).
>    - `2 điểm (Kém - Ảnh hưởng đáng kể)`: Thấm nước loang lổ (2đ) HOẶC kẹt 2–5 cánh cửa (2đ) HOẶC có $\ge 3$ Vùng ghi nhận cần sửa chữa.
>    - `3 điểm (Nguy cấp / Hư hỏng nặng)`: Dột nước từng giọt (3đ) HOẶC kẹt $>5$ cánh cửa (3đ).
>    - `4 điểm (Mất công năng hoàn toàn)`: Rò nước chảy thành dòng / ngập úng (4đ) HOẶC Cửa chính/cửa phòng bị kẹt cứng hoàn toàn không thể đóng/mở được (4đ), đe dọa an toàn thoát hiểm và sử dụng.
> 3. **Thuật toán Tự động tính toán (Auto-Engine):**
>    - Hệ thống tự động quét toàn bộ các khuyết tật $D\text{-xx}$ thuộc nhóm Thấm dột & Kẹt cửa tại Bước 3.3 và cờ Cần sửa chữa tại Bước 3.2.
>    - Công thức:
>      $$E_6 = \max \Big( \max_i(\text{Điểm Thấm dột } D_i), \max_i(\text{Điểm Kẹt cửa } D_i), \text{Điểm sửa chữa các Vùng } Z \Big)$$

#### 7.2. Bảng Chỉ số Dễ Tổn thương VI (13. VI – VULNERABILITY INDEX):
> **Ghi chú chuẩn Docx:** *VI phản ánh độ nhạy cảm của công trình trước các tác động lún/rung do thi công ngầm. Điểm số từ 1 (ít nhạy cảm) đến 4 (rất nhạy cảm).*

| Mã | Tiêu chí đánh giá | 1 | 2 | 3 | 4 | Nguồn lấy dữ liệu & Công thức tính toán (Mapping Logic) | Điểm |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **V1** | Công năng & Quy mô | General (1đ) | Important (2đ) | — | Critical (4đ) | **Nguồn:** `Nhóm đối tượng` tại **Bước 1**<br>➔ **Quy tắc:** $\text{General} \to 1\text{đ}$; $\text{Important} \to 2\text{đ}$; $\text{Critical} \to 4\text{đ}$ | `___` |
| **V2** | Hệ kết cấu chịu lực | Khung BTCT toàn khối (1đ) | Khung BTCT + tường gạch (2đ) | Tường gạch chịu lực / thép cũ (3đ) | Tường không giằng / mất ổn định (4đ) | **Nguồn:** Khảo sát kết cấu tại **Bước 2.1**<br>➔ **Quy tắc:** Chọn 1 trong 4 loại hình kết cấu chịu lực ($1 \to 4\text{đ}$) | `___` |
| **V3** | Loại móng & Nền đất | Deep / cọc tốt (Cat 1-2) | Cọc ma sát / nông tốt (Cat 3) | Nông / tự suy luận (Cat 4) | Nền yếu / không rõ (Cat 5) | **Nguồn:** Điểm CAT móng tại **Bước 2.1** ($1 \to 5\text{đ}$)<br>➔ **Quy tắc:** $\text{Cat } 1-2 \to 1\text{đ}$; $\text{Cat } 3 \to 2\text{đ}$; $\text{Cat } 4 \to 3\text{đ}$ (nếu Cat 4 thì $+1\text{đ}$ rủi ro); $\text{Cat } 5 \to 4\text{đ}$ | `___` |
| **V4** | Tuổi đời / Cơi nới | $< 10\text{ năm}$ (1đ) | $10 - 25\text{ năm}$ (2đ) | $25 - 40\text{ năm}$ (3đ) | $> 40\text{ năm}$ / Cơi nới (4đ) | **Nguồn:** Năm xây dựng tại **Bước 2.1** & Cơi nới tại **Bước 2.2**<br>➔ **Quy tắc:** Tự động tính theo tuổi thọ công trình ($1 \to 4\text{đ}$) | `___` |
| **V5** | Hiện trạng kỹ thuật | ECS Good (1đ) | ECS Medium (2đ) | ECS Deficient (3đ) | ECS Critical (4đ) | **Nguồn:** Phân hạng `ECS Class` tại **Mục 7.1**<br>➔ **Quy tắc:** $\text{Good} \to 1\text{đ}$; $\text{Medium} \to 2\text{đ}$; $\text{Deficient} \to 3\text{đ}$; $\text{Critical} \to 4\text{đ}$ | `___` |
| **V6** | Thiết bị nhạy cảm | Không có (1đ) | Dân dụng (2đ) | Văn phòng / KD (3đ) | Y tế / TN (4đ) | **Nguồn:** Câu hỏi thiết bị nhạy cảm tại **Bước 2.2**<br>➔ **Quy tắc:** Chọn 1 trong 4 mức độ ảnh hưởng thiết bị ($1 \to 4\text{đ}$) | `___` |

**Tổng hợp & Đánh giá VI:**
- [ ] **Tổng điểm VI:** $\Sigma V = \_\_\_/24$
- [ ] **Điểm trung bình:** $V_{\text{avg}} = \Sigma V / 6 = \_\_\_$
- [ ] **Phân hạng VI Class đề xuất:**
  - `Low`: $V_{\text{avg}} \le 1.5$
  - `Medium`: $1.5 < V_{\text{avg}} \le 2.5$
  - `High`: $2.5 < V_{\text{avg}} \le 3.25$
  - `Very High`: $V_{\text{avg}} > 3.25$
- [ ] **Engineering judgement:** [ ] `Giữ`  [ ] `Nâng`  [ ] `Hạ` \| **Lý do:** `____________________`

---

### BƯỚC 8: Tổng hợp Kết luận Toàn diện & Đề xuất Kỹ thuật (Executive Summary Dashboard)
- [ ] **BCS / ECS:** *(Tự động tổng hợp)* Score /24 & ECS Class (`Good` / `Medium` / `Deficient` / `Critical` - Kèm hạng điều chỉnh sau can thiệp)
- [ ] **Burland & Cờ kết cấu:** *(Tự động trích xuất từ Bước 4)* Grade Chủ đạo, Grade Max, Vùng chi phối & Cờ kết cấu
- [ ] **Vulnerability (VI):** *(Tự động tổng hợp)* Điểm $V_{\text{avg}}$ & VI Class (`Low` / `Medium` / `High` / `Very High`)
- [ ] **Construction Impact (Tác động thi công):** Mặc định `Pending` *(Chờ số liệu thiết kế được phê duyệt)*
- [ ] **BRA (Baseline Risk Assessment):** Mặc định `Pending` *(Chờ phê duyệt)*
- [ ] **Khuyết tật / Rủi ro chính:** (Nhập text mô tả tổng quát khuyết tật nổi bật nhất)
- [ ] **Kiến nghị cụ thể:** (Nhập text đề xuất giải pháp kỹ thuật / quan trắc)

---

### BƯỚC 9: Chốt Biên bản & Ký Xác nhận Hiện trường 3 Bên
- [ ] **Tổng số Tầng, Vùng & Khuyết tật đã ghi nhận:** *(Hệ thống tự đếm và hiển thị thanh thống kê)*
- [ ] **Ý kiến / Phản hồi nguyên văn của Chủ hộ:** (Nhập text)
- [ ] **Ảnh Chữ ký / Ảnh Cán bộ Khảo sát (Prepared by):** Họ tên, Chức vụ, Ngày khảo sát, Ký tay trên màn hình hoặc Chụp ảnh chữ ký/chân dung tại hiện trường.
- [ ] **Ảnh Chữ ký / Ảnh Người kiểm tra (Checked by):** Họ tên, Chức vụ, Ngày kiểm tra, Ký tay trên màn hình hoặc Chụp ảnh chữ ký.
- [ ] **Ảnh Chữ ký / Ảnh Chủ sở hữu (Owner/Representative):** Họ tên, Vai trò, Ngày ký, Ký tay trên màn hình hoặc Chụp ảnh chữ ký/chân dung tại hiện trường.
