# Bộ Câu Hỏi & Biểu Mẫu Khảo Sát Hiện Trạng Đợt 2 (Phase 2 - Pre-Construction BCS Form)

> [!IMPORTANT]
> **LƯU Ý DÀNH CHO AI AGENT & DEVELOPER (TÀI LIỆU ĐANG TIẾP TỤC HOÀN THIỆN & MỞ RỘNG):**
> Tài liệu này là **bản đặc tả cơ sở (Baseline Specification)** cho biểu mẫu và quy trình khảo sát Đợt 2 (Phiếu 02). Tài liệu **CHƯA PHẢI LÀ BẢN ĐẦY ĐỦ 100% TUYỆT ĐỐI** và sẽ tiếp tục được mở rộng chi tiết trong quá trình code và phát triển sản phẩm. Khi triển khai code thực tế, Agent/Developer cần nắm vững rằng hệ thống sẽ phát sinh thêm các trường dữ liệu thực địa, tùy chọn phụ và cần chủ động hoàn thiện cả code lẫn cập nhật ngược lại tài liệu này.

> **MỤC ĐÍCH:** Xác lập và xác nhận hiện trạng gần nhất của công trình ngay trước khi thi công ngầm / đào hầm TBM; kế thừa hồ sơ Giai đoạn 1 và ghi nhận có hệ thống các hư hỏng/khuyết tật biến động hoặc mới phát sinh bằng mô tả, đo đạc, ảnh và sơ đồ vị trí; làm hồ sơ cơ sở để đối chiếu khi có phản ánh/hư hỏng trong quá trình hoặc sau thi công, phục vụ đánh giá trách nhiệm, khiếu nại, bồi thường/bảo hiểm theo hợp đồng, đơn bảo hiểm và quy định áp dụng.
>
> *(Chuẩn hóa **100% đầy đủ dữ liệu gốc** từ `docs/Phase 2_Pre Constuction BCS.docx` (Phiếu 02) và được thiết kế, trình bày đồng bộ theo **9 Bước thực địa tuần tự của Cán bộ Khảo sát** giống Phase 1, đánh dấu rõ ràng các trường dữ liệu **[KẾ THỪA TỪ GĐ1]** và **[MỚI GĐ2]** để tối ưu hóa trải nghiệm khảo sát thực tế trên Mobile PWA).*

---

## BẢNG ĐỐI CHIẾU CẤU TRÚC: DOCS GỐC (12 MỤC) ➔ TRÌNH TỰ THỰC ĐỊA PWA (9 BƯỚC)

| Mục trong Tài liệu Gốc (`docs/Phase 2_Pre Constuction BCS.docx`) | Vị trí trong Quy trình Thực địa 9 Bước trên Ứng dụng Mobile | Cơ chế Kế thừa & Nhập liệu |
| :--- | :--- | :--- |
| **Mục 1:** Thông tin nhận dạng và phạm vi khảo sát | **BƯỚC 1:** Tiếp cận ngoài nhà & Nhận diện công trình GĐ2 | Kế thừa thông tin chung từ GĐ1; Nhập mới đoạn tuyến, mục tiêu, cấp KS, thành phần |
| **Mục 2:** Xác nhận lại các đặc trưng chính công trình | **BƯỚC 2:** Phỏng vấn chủ hộ & Xác nhận biến động sau GĐ1 | Kế thừa kết cấu/móng GĐ1; Nhập mới biến động cơi nới/sửa chữa/tải trọng sau GĐ1 |
| **Mục 3:** Ảnh nhận dạng / Ảnh tổng thể (`P-01`, `P-02`) | **BƯỚC 1:** Tiếp cận ngoài nhà (Công cụ Đa giác đứng & Cắt tầng) | Chụp mới `P-01`, `P-02` (Hỗ trợ AI nắn thẳng + Floor split line + Nút N/A) |
| **Mục 4:** Ghi nhận hiện trạng theo khu vực / cấu kiện | **BƯỚC 3.1:** Khảo sát hiện trạng từng tầng & cấu kiện | Ma trận đánh giá theo chuỗi phát sinh động từng Tầng / Không gian |
| **Mục 5:** Bảng ghi nhận khuyết tật / Damage Register | **BƯỚC 3.2:** Sổ khuyết tật $D-01 \to D-xx$ (Kế thừa & Thêm mới) | Hiển thị lại vết nứt GĐ1 để đối soát biến động + Thả ghim thêm vết nứt mới GĐ2 |
| **Mục 6:** Dấu hiệu lún – nghiêng – biến dạng (nếu có) | **BƯỚC 4:** Đánh giá & Đo đạc lún – nghiêng – biến dạng GĐ2 | Đo đạc nhanh hiện trường, so sánh biến thiên $\Delta$ độ nghiêng/lún so với GĐ1 |
| **Mục 7:** Hồ sơ ảnh khuyết tật (`Photo CTX` + `Photo CU`) | **BƯỚC 3.2:** Hồ sơ ảnh khuyết tật đa lớp có thước tỷ lệ | 01 ảnh bối cảnh (`CTX`) + 01 ảnh cận cảnh kèm thước đo (`CU`) |
| **Mục 8:** Sơ đồ vị trí khuyết tật / Damage Location Sketch | **BƯỚC 6.1:** Sơ đồ vị trí khuyết tật & Damage Mapping | Phác thảo mặt bằng/mặt đứng ghim vị trí $D-xx$ hoặc nhập mã bản vẽ CAD |
| **Mục 9:** So sánh với GĐ1 và Tóm tắt hiện trạng | **BƯỚC 7:** So sánh với Giai đoạn 1 & Tóm tắt hiện trạng | Tự động tổng hợp biến động, chốt nhu cầu quan trắc, NDT & kết luận |
| **Mục 10:** Xác nhận hiện trạng trước thi công (Pháp lý mẫu) | **BƯỚC 8.1:** Cam kết pháp lý mẫu chuẩn Phiếu 02 | Điều khoản pháp lý hiển thị tự động trên biên bản bàn giao |
| **Mục 11:** Ý kiến của Chủ sở hữu / Người sử dụng | **BƯỚC 8.2:** Ghi nhận ý kiến phản hồi của Chủ nhà | Nhập text ý kiến chủ nhà trước khi ký tên |
| **Mục 12:** Xác nhận và Chữ ký (4 Bên) | **BƯỚC 9:** Chốt biên bản & Chụp ảnh xác nhận (4 Bên) | Ký số / Chụp ảnh chữ ký 4 bên; Lập biên bản từ chối nếu không hợp tác |
| **Phụ lục A:** Checklist hoàn thành hồ sơ Phase 2 (10 Mục) | **BƯỚC 6.2:** Cổng kiểm soát chất lượng (Quality Gate) | Hệ thống tự động kiểm tra 10 tiêu chí Đạt / Thiếu / N/A |
| **Phụ lục B:** Quy tắc đặt mã ảnh tối thiểu | **Toàn bộ hệ thống:** Tự động sinh mã ảnh chuẩn hóa | Sinh mã duy nhất: `P-01`, `CTX`, `CU`, `01`... gắn với ID công trình |

---

## BỘ BIỂU MẪU KHẢO SÁT GIAI ĐOẠN 2 HỢP NHẤT (SINGLE UNIFIED PHASE 2 SURVEY FORM)

---

### BƯỚC 1: Tiếp Cận Ngoài Nhà, Nhận Diện Công Trình & Chụp Ảnh Tổng Thể GĐ2
*Thực hiện ngay khi cán bộ vừa đến vị trí công trình trước nhà. Hệ thống tự động đồng bộ và hiển thị dữ liệu gốc từ Giai đoạn 1.*

#### 1.1. Thông tin Hành chính & Kế thừa Nhận dạng:
- [ ] **Mã Quản lý Dự án (Building / Parcel ID):** `B-XXXXX` `[KẾ THỪA TỪ GĐ1]` *(Không đổi, quản lý theo lý trình tuyến)*
- [ ] **Mã Địa chính Gốc (Official Cadastral ID / KS003):** `KS003-XXXX` `[KẾ THỪA TỪ GĐ1]` *(Số tờ - Số thửa địa chính nhà nước)*
- [ ] **Tham chiếu Giai đoạn 1 (Phase 1 Ref Doc./Rev.):** `REPORT-PHASE1-XXXXX` `[KẾ THỪA TỰ ĐỘNG]` *(Ngày duyệt GĐ1: __/__/____)*
- [ ] **Tên công trình:** (Nhập text - VD: Nhà ở gia đình, Trụ sở Cty A, Trường học...) `[KẾ THỪA TỪ GĐ1]`
- [ ] **Địa chỉ:** (Nhập text - Đối chiếu thực tế số nhà, tên đường) `[KẾ THỪA TỪ GĐ1]`
- [ ] **Chủ sở hữu / Người sử dụng:** (Nhập text tên chủ nhà hoặc người đại diện) `[KẾ THỪA TỪ GĐ1]`
- [ ] **Đầu mối liên hệ (Contact):** (Số điện thoại / Email) `[KẾ THỪA TỪ GĐ1]`

#### 1.2. Thông tin Tổ chức Khảo sát Giai đoạn 2:
- [ ] **Đoạn thi công (Work section):** (Nhập text - VD: Đoạn tuyến Ga S9 Bà Quẹo ➔ Ga S10 Phạm Văn Bạch) `[MỚI GĐ2]`
- [ ] **Ngày – giờ khảo sát Phase 2:** `___/___/____` ; `____–____` `[MỚI GĐ2]`
- [ ] **Mục tiêu khảo sát (Survey Purpose):** `[MỚI GĐ2]`
  - [x] `Baseline trước thi công` (Khảo sát chốt hiện trạng trước khi kích đào hầm/thi công ngầm)
  - [ ] `Kiểm tra lại` (Re-survey / Kiểm tra bổ sung đột xuất)
- [ ] **Cấp khảo sát (Survey Level):** `[MỚI GĐ2]`
  - [ ] `L2-A` (Cơ bản: Nhà ngoài phạm vi lún chính / ít nhạy cảm)
  - [ ] `L2-B` (Tiêu chuẩn: Nhà nằm trong đới ảnh hưởng lún đào hầm)
  - [ ] `L2-C` (Chuyên sâu: Công trình di tích, nhạy cảm cao, kết cấu yếu)
- [ ] **Thành phần chứng kiến:** (Nhập text họ tên các bên tham gia: Cán bộ KS, Đại diện Chủ đầu tư/Tư vấn, Chủ nhà...) `[MỚI GĐ2]`
- [ ] **Điều kiện đặc biệt:** (Nhập text: Thời tiết mưa/nắng, công trình đang sửa chữa, hẻm cụt khó tiếp cận...) `[MỚI GĐ2]`

#### 1.3. Chụp 2 Ảnh Nhận Dạng / Tổng Thể Phase 2 (Có Watermark GPS & Thời gian thực | Hỗ trợ nút chọn "N/A"):
- **`Ảnh P-01` – Số nhà / Biển tên + Mặt đứng chính:**
  - [ ] `Có ảnh`: Chụp trực diện toàn bộ mặt tiền công trình. Sau khi chụp, PWA cung cấp 2 công cụ tương tác:
    - 🔴 **Icon Chấm tròn (Đa giác đứng / Polygon Corners):** Chạm các điểm góc mặt tiền để định vị khung nhà cho AI nắn thẳng (Perspective Correction).
    - ➖ **Icon Line ngang (Đường phân tầng / Floor Split Lines):** Kéo các đường ngang phân chia các tầng (Tầng trệt, Lầu 1, Lầu 2, Mái...).
    - ✏️ **Ghi kích thước:** Chiều cao từng tầng ($h_1, h_2...$), chiều cao tổng ($H_{tot}$), chiều rộng mặt tiền ($W$).
  - [ ] `Không tồn tại (N/A) / Bị che khuất`: (Nhà không gắn biển số / Mặt tiền bị che khuất hoàn toàn ➔ Nhập lý do và cho phép Next).
- **`Ảnh P-02` – Toàn cảnh công trình và bối cảnh tuyến / đường:**
  - [ ] `Có ảnh`: Chụp bao quát công trình gắn liền lòng đường, vỉa hè tuyến Metro 2.
  - [ ] `Không tồn tại (N/A)`: (Nhập lý do ➔ Cho phép Next).
*(Mỗi ảnh tự động dập watermark: Mã ảnh – Ngày/giờ – Tọa độ GPS/Hướng chụp. Ảnh gốc được lưu giữ nguyên bản không can thiệp).*

---

### BƯỚC 2: Phỏng Vấn Chủ Hộ & Xác Nhận Biến Động Đặc Trưng Sau Giai Đoạn 1
*Hỏi chuyện chủ nhà tại phòng khách/sân trước. Hệ thống hiển thị sẵn toàn bộ thông số kết cấu GĐ1 để đối soát nhanh.*

#### 2.1. Xác nhận lại các đặc trưng kết cấu chính:
- [ ] **Công năng sử dụng (Use):** `[KẾ THỪA TỪ GĐ1]` (Nhà ở / Cửa hàng / Văn phòng / Khách sạn / Công cộng / Khác)
- [ ] **Số tầng:** Số tầng nổi: _____ | Số tầng hầm: _____ `[KẾ THỪA TỪ GĐ1]`
- [ ] **Hệ kết cấu chính:** (Chọn: `BTCT` / `Xây gạch` / `Thép` / `Hỗn hợp` / `Khác`) `[KẾ THỪA TỪ GĐ1]`
- [ ] **Dạng chịu lực:** (Chọn: `Khung` / `Tường chịu lực` / `Khác`) `[KẾ THỪA TỪ GĐ1]`
- [ ] **Loại móng:** (Chọn: `Móng nông` / `Cừ tràm` / `Cọc ép BTCT` / `Cọc nhồi` / `Chưa rõ`) `[KẾ THỪA TỪ GĐ1]`
- [ ] **CAT thông tin móng (Độ tin cậy móng):** (Điểm CAT: `1` ☐ `2` ☐ `3` ☐ `4` ☐ `5` /5) `[KẾ THỪA TỪ GĐ1]`

#### 2.2. Ghi nhận biến động phát sinh sau Giai đoạn 1:
- [ ] **Cơi nới / cải tạo sau GĐ1:** `[MỚI GĐ2]`
  - [ ] `Không`
  - [ ] `Có` ➔ Mô tả chi tiết (vị trí cơi nới, thêm tầng lửng, ban công...): ________________________
- [ ] **Sửa chữa hư hỏng sau GĐ1:** `[MỚI GĐ2]`
  - [ ] `Không`
  - [ ] `Có` ➔ Mô tả chi tiết (trám trét nứt, sơn lại, gia cố kết cấu...): ________________________
- [ ] **Thay đổi công năng / tải trọng sau GĐ1:** `[MỚI GĐ2]`
  - [ ] `Không`
  - [ ] `Có` ➔ Mô tả chi tiết (chuyển nhà ở thành kho hàng nặng, xưởng sản xuất...): ________________________
- [ ] **Thay đổi khác:** (Nhập text mô tả các biến động khác nếu có) `[MỚI GĐ2]`
- [ ] **Kết luận xác nhận đặc trưng sau GĐ1:** `[MỚI GĐ2]`
  - [ ] `Không thay đổi đáng kể so với GĐ1`
  - [ ] `Có thay đổi – đã ghi rõ ở trên`

---

### BƯỚC 3: Khảo Sát Hiện Trạng Từng Tầng, Cấu Kiện & Sổ Ghi Nhận Khuyết Tật $D-xx$
*Cán bộ đi dạo kiểm tra lần lượt qua từng Tầng/Phòng theo vị trí đứng thực tế. Ứng dụng tự động truy xuất dữ liệu khuyết tật GĐ1 tương ứng với vị trí đứng để cán bộ đối chiếu trực tiếp trên màn hình, hỗ trợ chấm thêm điểm khuyết tật trên Vùng cũ hoặc tạo Vùng mới nếu xuất hiện khu vực mới.*

*(Thực hiện lặp lại cho từng Tầng: Tầng hầm ➔ Tầng trệt ➔ Tầng 1 ➔ Tầng 2 ➔ Tầng mái... phát sinh động mảng `DamageZone[]`)*

---

#### 3.1. Định vị & Tự động Lọc Vùng Khảo sát theo Vị trí đứng (Location-Based Filter):
- [ ] **Chọn Vị trí đứng hiện tại:** (Chọn Tầng: `Tầng trệt` / `Lầu 1` / `Lầu 2`... ➔ Chọn Phòng/Khu vực: `Phòng khách`, `Phòng ngủ 1`, `Hành lang`, `Bếp`...)
- [ ] **Hệ thống tự động GET dữ liệu GĐ1 tại vị trí này:**
  - Ứng dụng tự động tải và hiển thị danh sách các Vùng `Z-xx` đã ghi nhận tại GĐ1 ở phòng này, kèm ảnh bối cảnh (`Photo CTX`) và toàn bộ các điểm ghim khuyết tật $D-xx$ cũ trên hình.
  - Trên màn hình luôn có sẵn nút hành động nổi bật: **`[+ Thêm Vùng Khảo Sát Mới (Z-new)]`** (dành cho khu vực mới cơi nới hoặc Phase 1 chưa vào được).

---

#### 3.2. CƠ CHẾ A: Đối Soát & Chấm Thêm Điểm Trên VÙNG HIỆN HỮU (`Z-xx` Kế Thừa Từ GĐ1):
*Cán bộ chọn Vùng hiện hữu (VD: `Vùng Z-01 - Tường gạch phòng khách`) ➔ Màn hình hiển thị ảnh bối cảnh `Photo CTX` của Phase 1 với các chấm ghim màu vàng ($D-01, D-02...$):*

1. **Đối soát khuyết tật cũ ($D-01, D-02...$):**
   - Chạm vào từng ghim cũ để xem thông số GĐ1 ($w_1, L_1$).
   - Đo lại kích thước thực tế ngoài hiện trường: Bề rộng $w_2 = \_\_\_\text{mm}$ | Chiều dài $L_2 = \_\_\_\text{mm}$.
   - Hệ thống tự động tính độ biến thiên: $\Delta w = w_2 - w_1$ (mm) | $\Delta L = L_2 - L_1$ (mm).
   - Chọn đánh giá trạng thái biến động:
     - [ ] `Không đổi` (Ổn định: $w_2 = w_1, L_2 = L_1$ ➔ Ghim đổi sang màu **Xanh lá**).
     - [ ] `Phát triển` (Rộng thêm $\Delta w > 0$ hoặc Dài thêm $\Delta L > 0$ ➔ Ghim đổi sang màu **Cam cảnh báo**).
     - [ ] `Đã sửa` (Chủ nhà đã tự trám trét / sơn bả lại sau GĐ1 ➔ Ghim đổi sang màu **Xám**).
   - Chụp ảnh cận cảnh Phase 2 (`B-XXXX-Fxx-Rxx-Dxx-CU`) áp sát **Thước đo khe nứt (Crack Scale Card)**.

2. **Chấm thêm điểm khuyết tật mới lên Vùng cũ (`Z-xx`):**
   - Nếu quan sát thấy trên mảng tường `Z-xx` này xuất hiện thêm vết nứt mới sau GĐ1: Cán bộ chỉ cần **chạm tay trực tiếp lên ảnh bối cảnh `Photo CTX`** tại vị trí vết nứt mới.
   - Hệ thống tự động thả ghim mới màu **Đỏ**: **`D-04 (MỚI)`**, **`D-05 (MỚI)`**...
   - Nhập chỉ số: Loại khuyết tật, Bề rộng $w_2$ (mm), Chiều dài $L_2$ (mm), Hướng nứt, Cấu kiện.
   - Chụp ảnh cận cảnh Phase 2 (`Photo CU`) kèm thước đo khe nứt.
   - Hệ thống tự động gán trạng thái: `MỚI GHI NHẬN`.

---

#### 3.3. CƠ CHẾ B: Thêm KHU VỰC / VÙNG MỚI XUẤT HIỆN (`Z-xx` Mới Phát Sinh Tại GĐ2):
*Áp dụng khi cán bộ phát hiện khu vực mới xuất hiện (Chủ nhà mới xây thêm phòng sau nhà, cơi nới thêm gác lửng/ban công, hoặc phòng kho Phase 1 bị khóa nay mở cửa cho vào):*

1. **Khởi tạo Vùng mới:**
   - Cán bộ bấm nút **`[+ Thêm Vùng Khảo Sát Mới (Z-new)]`**.
   - Hệ thống tự động cấp mã Vùng tiếp theo: **`Z-04 (MỚI)`**, **`Z-05 (MỚI)`**... gắn nhãn `[MỚI GĐ2]`.
2. **Chụp Ảnh Bối Cảnh Mới (`Photo CTX`):**
   - Cán bộ lùi lại chụp 1 ảnh bối cảnh bao quát mảng tường/cấu kiện của khu vực mới này.
3. **Đánh giá nhanh tình trạng Cấu kiện Vùng mới (Ma trận Mục 4 Docs gốc):**
   - Tình trạng Sàn/Trần: (Ổn định / Nứt vỡ / Võng...)
   - Tình trạng Tường: (Ổn định / Nứt xiên / Nứt chân chim / Thấm...)
   - Tình trạng Cột/Dầm: (Ổn định / Nứt dầm / Lộ cốt thép...)
   - Thấm / Bong tróc: (Không / Thấm ẩm / Bong tróc vữa...)
   - Biến dạng / Lún–Nghiêng: (Không / Nghi ngờ lún chênh / Nghiêng sàn...)
4. **Chấm thả các điểm khuyết tật mới lên Vùng mới:**
   - Chạm tay lên ảnh bối cảnh vừa chụp để thả các ghim: **`D-06 (MỚI)`**, **`D-07 (MỚI)`**...
   - Nhập thông số đo đạc ($w, L$, dạng nứt) và chụp ảnh cận cảnh kèm thước (`Photo CU`) cho từng ghim mới.

---

#### 3.4. Bảng Sổ Ghi Nhận Khuyết Tật Hợp Nhất (Damage Register - Chuỗi phát sinh $D-01 \to D-xx$):

| ID Khuyết tật | Vùng / Tầng / KV | Vị trí – Cấu kiện | Loại khuyết tật | Bề rộng $w$ (mm) | Chiều dài $L$ (mm) | Hướng / Dạng nứt | Mã Ảnh liên kết | Nguồn gốc & Trạng thái Biến động |
| :---: | :--- | :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| **`D-01`** | `Z-01` (Trệt - P.Khách) | Tường gạch trục 2 | Nứt xiên hoàn thiện | $w_2 = 0.5$ | $L_2 = 300$ | Xiên $45^\circ$ góc cửa | `B-XXXX-F01-R01-D01-CU` | `[GĐ1 Kế thừa]` ➔ **Không đổi** |
| **`D-02`** | `Z-02` (Lầu 1 - P.Ngủ) | Dầm BTCT trục B | Nứt uốn dầm | $w_2 = 0.8$ | $L_2 = 650$ | Thẳng đứng đáy dầm | `B-XXXX-F02-R01-D02-CU` | `[GĐ1 Kế thừa]` ➔ **Phát triển (+0.3mm)** |
| **`D-03`** | `Z-01` (Trệt - P.Khách) | Tường ngăn WC | Nứt chân chim | -- | -- | Mạng nhện | `B-XXXX-F01-R02-D03-CU` | `[GĐ1 Kế thừa]` ➔ **Đã sửa (Trám bả)** |
| **`D-04`** | `Z-01` (Trệt - P.Khách) | Mép chân tường trục 1 | Nứt ngang chân tường | $w_2 = 0.6$ | $L_2 = 500$ | Nằm ngang | `B-XXXX-F01-R01-D04-CU` | `[GĐ2 Chấm thêm trên Z cũ]` ➔ **MỚI GHI NHẬN** |
| **`D-05`** | `Z-04 (MỚI)` (Gác lửng mới) | Tường cơi nới mới | Nứt mối nối tường | $w_2 = 1.2$ | $L_2 = 800$ | Dọc khe tiếp giáp | `B-XXXX-F02-R02-D05-CU` | `[GĐ2 Tạo Z mới & D mới]` ➔ **MỚI GHI NHẬN** |

- **Phân loại khuyết tật điển hình (Theo Docs gốc):** Nứt, Lún/Nghiêng, Võng/Biến dạng, Bong tróc, Tách lớp, Ăn mòn, Thấm/Ẩm, Hư hỏng hoàn thiện, Cửa đi/Cửa sổ hoạt động bất thường.
- **Hồ sơ ảnh khuyết tật đa lớp:** Mỗi khuyết tật bắt buộc gồm:
  - `Ảnh D-xx-CTX`: Ảnh bối cảnh/vị trí khuyết tật trong không gian phòng.
  - `Ảnh D-xx-CU`: Ảnh chụp cận cảnh vết nứt có áp sát **Thước tỷ lệ hệ mét (Crack Scale Card)**.

---

### BƯỚC 4: Đánh Giá & Đo Đạc Lún – Nghiêng – Biến Dạng Phase 2
*Ghi nhận các phép đo nhanh tại hiện trường nhằm lập hồ sơ hiện trạng (không thay thế chương trình quan trắc được phê duyệt).*

| STT | Vị trí / Điểm đo | Đối tượng đo | Giá trị / Chỉ báo đo được | Phương pháp đo | Mã Ảnh / ID thiết bị | Nhận xét chuyên môn |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | Góc tường mặt tiền trục 1-A | Nghiêng tường ngoài | Nghiêng mặt trước $X = 0.35\%$ ($\Delta X = +0.05\%$) | Thước laser / Nivo điện tử | `B-XXXX-MEAS-01` | Nghiêng trong giới hạn cho phép |
| **2** | Mặt hông tiếp giáp hẻm trục A-B | Nghiêng mặt hông | Nghiêng mặt hông $Y = 0.20\%$ ($\Delta Y = 0.00\%$) | Quả dọi / Máy toàn đạc | `B-XXXX-MEAS-02` | Không biến động so với GĐ1 |
| **3** | Sàn phòng khách Tầng trệt | Nghiêng sàn | Độ nghiêng sàn: $0.15\%$ | Máy thủy bình mini | `B-XXXX-MEAS-03` | Bề mặt phẳng ổn định |
| **4** | Dầm BTCT chính nhịp L=5m | Võng dầm | Độ võng lớn nhất: $f = 6.0\text{ mm}$ | Thước đo laser | `B-XXXX-MEAS-04` | Độ võng ổn định |

- [ ] **Phương pháp đo áp dụng:** (Multi-select: `Quan sát mắt thường` / `Thước nivo` / `Máy laser cầm tay` / `Quả dọi` / `Máy toàn đạc`)
- [ ] **Độ tin cậy dữ liệu đo:** (Chọn: `Cao` / `Trung bình` / `Thấp`)

---

### BƯỚC 5: Xác Nhận Phạm Vi & Đối Soát Ranh Thửa Đất GIS (Sau khi đi hết các tầng)
*Thực hiện sau khi cán bộ đã đi hết toàn bộ các phòng/tầng, nắm trọn vẹn không gian ngôi nhà và ranh giới thực tế.*

- [ ] **Phạm vi tiếp cận thực tế:** `[MỚI GĐ2]`
  - [ ] `Toàn bộ` (Khảo sát đầy đủ tất cả các tầng, phòng và mái)
  - [ ] `Một phần` (Có khu vực bị hạn chế tiếp cận)
- [ ] **Khu vực không tiếp cận (nếu có):** (Nhập text mô tả chi tiết: VD phòng kho khóa cửa, mái tôn dốc nguy hiểm không trèo được...) `[MỚI GĐ2]`
- [ ] **Kiểm tra Đối soát & Điều chỉnh Ranh Thửa Đất trên GIS:**
  - [ ] `Khớp ranh GĐ1`: Ranh giới thực tế khớp hoàn toàn với polygon thửa đất bản đồ quy hoạch.
  - [ ] `Biến động xây cơi nới / Tách thửa`: Phát sinh xây lấn ranh hoặc chia tách thêm căn mới ➔ Bật công cụ **Polygon Split/Edit Tool** vẽ lại ranh giới thực tế trên GIS ➔ Hệ thống ghi nhận biến động và cấp ID mới theo cơ chế Dual-ID.

---

### BƯỚC 6: Sơ Đồ Vị Trí Khuyết Tật & Cổng Kiểm Soát Chất Lượng Hồ Sơ (Data Quality Gate)

#### 6.1. Sơ đồ Vị trí Khuyết tật (Damage Location Sketch - Mục 8 Docs gốc):
- [ ] **Ảnh chụp bản vẽ phác thảo tay mặt bằng / mặt đứng:** Cán bộ phác họa vị trí các tầng và chạm thả các mã khuyết tật `$D-01, D-02...$` lên sơ đồ.
- [ ] **Số hiệu bản vẽ Damage Mapping (nếu có bản vẽ CAD riêng):** `________________________`

#### 6.2. Cổng Kiểm soát Chất lượng Hồ sơ (Checklist 10 Tiêu chí Phụ lục A):
*Hệ thống tự động quét kiểm tra toàn bộ hồ sơ trước khi cho phép chuyển sang bước tổng kết:*

| STT | Nội dung kiểm tra theo Phụ lục A | Trạng thái kiểm tra | Tham chiếu / Ghi chú |
| :---: | :--- | :---: | :--- |
| **1** | Đã xác nhận mã công trình, địa chỉ, đoạn thi công và tham chiếu Giai đoạn 1 | `Đạt` ☐ `Thiếu` ☐ `N/A` ☐ | `Mục 1 & Bước 1` |
| **2** | Đã ghi phạm vi tiếp cận và khu vực không tiếp cận | `Đạt` ☐ `Thiếu` ☐ `N/A` ☐ | `Mục 1 & Bước 5` |
| **3** | Đã chụp ảnh số nhà/biển tên, mặt đứng và bối cảnh công trình (`P-01`, `P-02`) | `Đạt` ☐ `Thiếu` ☐ `N/A` ☐ | `Mục 3 & Bước 1.3` |
| **4** | Đã kiểm tra các tầng/phòng/khu vực có thể tiếp cận | `Đạt` ☐ `Thiếu` ☐ `N/A` ☐ | `Mục 4 & Bước 3.1` |
| **5** | Khuyết tật đã được gán ID và ghi vị trí, loại, kích thước theo khả năng | `Đạt` ☐ `Thiếu` ☐ `N/A` ☐ | `Mục 5 & Bước 3.2` |
| **6** | Mỗi khuyết tật đáng kể có ảnh bối cảnh (`CTX`) và ảnh cận cảnh kèm thước (`CU`) | `Đạt` ☐ `Thiếu` ☐ `N/A` ☐ | `Mục 7 & Bước 3.2` |
| **7** | Đã lập sơ đồ/bản vẽ vị trí khuyết tật hoặc ghi số hiệu damage mapping | `Đạt` ☐ `Thiếu` ☐ `N/A` ☐ | `Mục 8 & Bước 6.1` |
| **8** | Đã so sánh với Giai đoạn 1 và ghi rõ thay đổi/sửa chữa/khuyết tật mới | `Đạt` ☐ `Thiếu` ☐ `N/A` ☐ | `Mục 9 & Bước 7` |
| **9** | Đã ghi kết luận hiện trạng, nhu cầu quan trắc/NDT/bảo vệ nếu cần | `Đạt` ☐ `Thiếu` ☐ `N/A` ☐ | `Mục 9 & Bước 7` |
| **10** | Đã lấy ý kiến/chữ ký hoặc lập hồ sơ từ chối/vắng mặt; dữ liệu gốc đã sao lưu | `Đạt` ☐ `Thiếu` ☐ `N/A` ☐ | `Mục 12 & Bước 9` |

---

### BƯỚC 7: So Sánh Với Giai Đoạn 1, Tóm Tắt Hiện Trạng & Đề Xuất Quan Trắc (Mục 9 Docs gốc)
*Hệ thống tự động tổng hợp số liệu thống kê và đối chiếu biến động giữa Phase 1 và Phase 2:*

- [ ] **Tổng hợp biến động khuyết tật so với GĐ1:** `[MỚI GĐ2]`
  - [ ] `Không đổi` (Tất cả vết nứt cũ giữ nguyên kích thước, không có vết nứt mới)
  - [ ] `Phát triển` (Vết nứt cũ tăng bề rộng hoặc kéo dài thêm)
  - [ ] `Đã sửa` (Chủ nhà đã tự trám trét / cải tạo sau GĐ1)
  - [ ] `Mới ghi nhận` (Phát sinh khuyết tật mới chưa có trong hồ sơ GĐ1)
- [ ] **Thống kê khối lượng dữ liệu hồ sơ Phase 2:**
  - Tổng số ID khuyết tật: `_____` vết (GĐ1: `___` vết | GĐ2 phát sinh thêm: `___` vết mới)
  - Tổng số ảnh gốc đã chụp và lưu trữ: `_____` ảnh
  - Số bản vẽ / phác họa đính kèm: `_____` bản
- [ ] **Hạn chế dữ liệu:** (Nhập text - VD: Góc tường phòng ngủ bị tủ che khuất...) `[MỚI GĐ2]`
- [ ] **Hư hỏng đáng chú ý nhất:** (Nhập text mô tả hư hỏng nghiêm trọng nhất quan sát được) `[MỚI GĐ2]`
- [ ] **Có dấu hiệu nguy cấp?** `[MỚI GĐ2]`
  - [ ] `Không`
  - [ ] `Có` ➔ **HỆ THỐNG TỰ ĐỘNG BẬT CẢNH BÁO ĐỎ GỬI VỀ ZONE ADMIN & BAN DỰ ÁN MAUR**
- [ ] **Nhu cầu quan trắc bổ sung (Monitoring Needs):** (Multi-select: `Không` / `Lún` / `Nghiêng` / `Nứt` / `Rung`) `[MỚI GĐ2]`
- [ ] **Khảo sát / Thí nghiệm không phá hủy (NDT) bổ sung:** `[MỚI GĐ2]`
  - [ ] `Không`
  - [ ] `Có` ➔ Loại thí nghiệm NDT: (Siêu âm bê tông / Bật nẩy Schmidt / Đo dao động rung...)
- [ ] **Kết luận hiện trạng Phase 2:** `[MỚI GĐ2]`
  - [ ] `Ổn định theo quan sát`
  - [ ] `Có hư hỏng hiện hữu cần theo dõi`
  - [ ] `Cần đánh giá chuyên sâu`

---

### BƯỚC 8: Cam Kết Pháp Lý Mẫu & Ghi Nhận Ý Kiến Chủ Hộ (Mục 10 & 11 Docs gốc)

#### 8.1. Xác nhận hiện trạng trước thi công (Cam kết pháp lý chuẩn theo Phiếu 02):
> *"Qua khảo sát trong phạm vi tiếp cận được, các bên xác nhận Phiếu 02 và các ảnh/bản vẽ kèm theo phản ánh hiện trạng quan sát được của công trình tại thời điểm khảo sát. Các khuyết tật hiện hữu chính đã được ghi nhận và mã hóa để làm mốc đối chiếu trong quá trình thi công.*
>
> *Phiếu này là hồ sơ hiện trạng cơ sở phục vụ đối chiếu kỹ thuật và xử lý phản ánh/khiếu nại, bồi thường hoặc bảo hiểm (nếu phát sinh) theo hợp đồng, điều kiện bảo hiểm và quy định pháp luật áp dụng; bản thân chữ ký trên phiếu không mặc nhiên xác lập trách nhiệm, không phải sự từ bỏ quyền pháp lý và không miễn trừ nghĩa vụ của bất kỳ bên nào."*

#### 8.2. Ý kiến của Chủ sở hữu / Người sử dụng:
- [ ] `Không có ý kiến khác`
- [ ] `Có ý kiến`: ____________________________________________________________________________________

---

### BƯỚC 9: Chốt Biên Bản & Chụp Ảnh Xác Nhận Hiện Trường 4 Bên (Mục 12 Docs gốc)
*Hệ thống hỗ trợ ký số trực tiếp trên màn hình cảm ứng điện thoại hoặc chụp ảnh chữ ký trên biên bản giấy/chụp ảnh cán bộ tại hiện trường:*

```
+------------------------------------+------------------------------------+
|  1. CHỦ SỞ HỮU / NGƯỜI SỬ DỤNG      |  2. ĐẠI DIỆN LIÊN DANH             |
|                                    |     CRLG – CRSRI – TT              |
|  Chữ ký / Ký số / Chụp ảnh chân dung|  Chữ ký / Ký số / Ảnh cán bộ hiện trường|
|  Họ tên: ________________________  |  Họ tên: ________________________  |
|  Ngày: ___/___/____                |  Ngày: ___/___/____                |
+------------------------------------+------------------------------------+
|  3. ĐẠI DIỆN NHÀ THẦU / KHÁCH HÀNG  |  4. NGƯỜI LÀM CHỨNG / ĐỊA PHƯƠNG   |
|     (Nếu tham gia)                 |     (Nếu áp dụng)                  |
|  Chữ ký / Ký số                    |  Chữ ký / Ký số                    |
|  Họ tên: ________________________  |  Họ tên: ________________________  |
|  Ngày: ___/___/____                |  Ngày: ___/___/____                |
+------------------------------------+------------------------------------+
```

- [ ] **Trường hợp từ chối ký / vắng mặt:** Áp dụng *Biên bản hạn chế tiếp cận / Từ chối khảo sát* và ghi rõ số tài liệu tham chiếu: `______________________`.

---

## PHỤ LỤC: QUY TẮC ĐẶT MÃ ẢNH TỐI THIỂU PHASE 2 (PHỤ LỤC B DOCS GỐC)

| Loại ảnh | Cú pháp mã ảnh chuẩn | Ví dụ mã thực tế | Yêu cầu nghiệp vụ & Tiêu chuẩn kỹ thuật |
| :--- | :--- | :--- | :--- |
| **Ảnh nhận dạng** | `B-XXXX-P01` / `P02` | `B-00105-P01` | Chụp biển số nhà/biển tên + Mặt đứng chính (Có chấm đa giác góc nhà & line phân tầng) |
| **Ảnh bối cảnh khuyết tật** | `B-XXXX-Fxx-Rxx-Dxx-CTX` | `B-00105-F02-R03-D05-CTX` | Thể hiện vị trí khuyết tật bao quát trong phòng/khu vực |
| **Ảnh cận cảnh khuyết tật** | `B-XXXX-Fxx-Rxx-Dxx-CU` | `B-00105-F02-R03-D05-CU` | Áp sát thước tỷ lệ hệ mét (Crack scale card) vào vị trí vết nứt |
| **Ảnh bổ sung** | `B-XXXX-Fxx-Rxx-Dxx-01` | `B-00105-F02-R03-D05-01` | Ảnh bổ sung góc chụp khác; không chỉnh sửa làm thay đổi nội dung chứng cứ |

> *Ghi chú: Mã ảnh có thể điều chỉnh theo hệ thống mã hóa được Dự án / Kỹ sư phê duyệt; yêu cầu cốt lõi là bảo đảm **liên kết duy nhất giữa Công trình – Tầng/Phòng – Khuyết tật – Ảnh**.*
