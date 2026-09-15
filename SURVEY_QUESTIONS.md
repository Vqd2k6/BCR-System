# Bộ câu hỏi & Biểu mẫu Khảo sát Hiện trạng Công trình (KSQH - Metro 2)

Dưới đây là toàn bộ danh sách các câu hỏi, trường thông tin và thao tác cần thu thập tại hiện trường. **Trình tự khảo sát được thiết kế hợp nhất theo Quy trình Khảo sát Từng Tầng (Floor-by-Floor Workflow)** giúp khảo sát viên vừa đi vừa kiểm tra không bị sót và không bị nhập trùng lặp dữ liệu.

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

### Bước 3: Phỏng vấn Lịch sử, Sử dụng & Yếu tố Nhạy cảm
*Hỏi chuyện người đại diện hoặc chủ nhà để nắm lịch sử toà nhà và các đặc điểm đặc biệt.*
- [ ] **Cơi nới / Thay đổi tải trọng:** (Chọn: Không / Có / Chưa rõ)
- [ ] **Sửa chữa lớn / Cải tạo kết cấu:** (Chọn: Không / Có / Chưa rõ)
- [ ] **Lún / Nghiêng ghi nhận trước đây:** (Chọn: Không / Có / Chưa rõ)
- [ ] **Hư hỏng do công trình lân cận gây ra:** (Chọn: Không / Có / Chưa rõ)
- [ ] **Sự cố nghiêm trọng (Hỏa hoạn / Ngập lụt / Sự cố khác):** (Chọn: Không / Có / Chưa rõ)
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
- [ ] **Điểm Burland:** (Chọn 0: Không đáng kể / 1: Rất nhẹ / 2: Nhẹ / 3: Trung bình / 4: Nghiêm trọng / 5: Rất nghiêm trọng).
- [ ] **Dấu hiệu cảnh báo kết cấu (Structural Flag):** (Chọn: Không có / Nứt >3mm / Võng sàn / Nghiêng lún / Khác)

### Bước 6: Xác nhận Phạm vi & Hạn chế Tiếp cận Khảo sát
- [ ] **Phạm vi đã khảo sát (Survey Scope):** (Multi-select: Ngoài / Trong / Mái / Hầm / Khu phụ)
- [ ] **Hạn chế tiếp cận (Access Limitations):** (Chọn: Không / Có - Ghi chú cụ thể lý do)

### Bước 7: Kết luận & Chữ ký Phase 1
- [ ] **Kết luận:** Có cần thực hiện Phase 2 (Khảo sát đo vẽ chi tiết khuyết tật từng tầng) hay không? (Có / Không)
- [ ] **Chữ ký xác nhận của Surveyor.**

---
---

## PHẦN B: KHẢO SÁT GIAI ĐOẠN 2 & HỢP NHẤT SỔ KHUYẾT TẬT (PHASE 2 - THỰC ĐỊA TỪNG TẦNG)

> **THIẾT KẾ HỢP NHẤT (UI/UX DESIGN):** 
> Thay vì tách rời Mục 4 (Checklist sàng lọc) và Mục 5 (Sổ khuyết tật), ứng dụng sẽ triển khai luồng **Khảo sát theo Tầng / Phòng**. Khảo sát viên đi đến đâu (Tầng 1 -> Tầng 2 -> Tầng 3...), chọn Tầng/Phòng đó. Với mỗi dấu hiệu ghi nhận ("CÓ"), hệ thống sẽ tự động mở Form điền Khuyết tật tương ứng và gán mã duy nhất (`D-01`, `D-02`...) ngay lập tức.

### Bước 1: Khởi tạo Buổi khảo sát Chi tiết
- [ ] **Mức độ tiếp cận hôm nay:** (Đầy đủ / Một phần / Bị hạn chế / Bị từ chối/vắng mặt)
- [ ] **Chụp ảnh kiểm chứng hôm nay:** `P-01` (Biển số nhà) và `P-02` (Mặt đứng chính).

### Bước 2: Luồng Khảo sát Từng Tầng (Loop từng Tầng / Khu vực)
*Thực hiện lặp lại cho Tầng Hầm -> Tầng Trệt -> Tầng 1 -> Tầng 2 -> Mái...*

#### 2.1. Chọn Tầng & Khu vực đang đứng:
- [ ] **Tầng:** (Chọn: Tầng hầm / Tầng trệt / Tầng 1 / Tầng 2 / Tầng mái / Khu phụ...)
- [ ] **Tên Phòng / Không gian cụ thể:** (Nhập text - VD: Phòng khách, Phòng ngủ 1, Hành lang, Bếp...)

#### 2.2. Danh mục Sàng lọc Chỉ số Hư hỏng (Screening Checklist per Floor):
*(Bật/Tắt "Có" hoặc "Không" cho các nhóm chỉ số hư hỏng tại Tầng/Phòng này)*

1. **[ ] Nứt tường / Khối xây / Hoàn thiện** (Non-structural wall cracks)
2. **[ ] Nứt cấu kiện kết cấu** (Cột / Dầm / Sàn / Tường chịu lực)
3. **[ ] Biến dạng / Lún chênh / Nghiêng / Võng cục bộ**
4. **[ ] Thấm / Rò rỉ nước / Rêu mốc**
5. **[ ] Bong tróc / Ăn mòn / Lộ thép rỉ / Mục gỗ**
6. **[ ] Mất tiết diện / Hư gối đỡ / Hư liên kết cấu kiện**
7. **[ ] Kẹt cửa / Nứt quanh khuôn cửa / Mất kín nước**
8. **[ ] Dấu hiệu khuyết tật đang phát triển / Đã sửa chữa nhưng bị tái nứt**

#### 2.3. Nhập Sổ Khuyết tật Chi tiết (Khi chọn "CÓ" ở bất kỳ mục nào trên):
*Hệ thống tự động sinh Mã Khuyết tật duy nhất: `D-01`, `D-02`, `D-03`... và yêu cầu điền:*

- [ ] **Mã khuyết tật (Defect ID):** (Tự động tạo: D-01, D-02...)
- [ ] **Vị trí chi tiết:** (Chọn/Nhập: Vách trước / Vách sau / Bên hông / Trần / Góc sàn...)
- [ ] **Cấu kiện / Vật liệu:** (Chọn: BTCT / Tường gạch / Khung thép / Gỗ / Khác)
- [ ] **Loại / Dạng nứt:** (Chọn: Xiên / Ziczac / Dọc / Ngang / Chân chim / Phồng rộp / Khác)
- [ ] **Bề rộng lớn nhất (Max Width):** (Nhập số mm - VD: `1.5` mm)
- [ ] **Chiều dài vết nứt (Length):** (Nhập số mm hoặc m - VD: `1200` mm)
- [ ] **Hướng vết nứt (Orientation):** (Nhập góc hoặc hướng - VD: `45°`, `50°`, Ngang, Dọc)
- [ ] **Trạng thái Hoạt động (Activity Status):**
  - `U` - Unknown (Chưa rõ)
  - `S` - Stable / Old (Ổn định / Vết nứt cũ)
  - `A` - Active / Suspected Active (Đang phát triển / Nghi ngờ đang phát triển)
- [ ] **Ý nghĩa Kết cấu (Structural Significance):**
  - `N/A` - Không ảnh hưởng kết cấu
  - `Low` - Mức độ Thấp
  - `Moderate` - Mức độ Trung bình
  - `High` - Mức độ Cao
  - `Critical` - Nguy hiểm / Cần xử lý khẩn cấp
- [ ] **Chụp ảnh minh chứng khuyết tật:**
  - `Photo CTX` (Context): Ảnh bối cảnh chụp xa để biết vị trí vết nứt ở đâu trên mảng tường.
  - `Photo CU` (Close-Up): Ảnh chụp cận cảnh kèm thước đo bề rộng nứt (Crack ruler).

---

### Bước 3: Sơ đồ Phác thảo & Ghim Vị trí Lỗi (Sketch Pinning)
*Sau khi thu thập xong danh sách vết nứt D-01, D-02... của toàn nhà:*
- [ ] **Tải lên / Chụp ảnh bản vẽ mặt bằng hoặc sơ đồ phác tay.**
- [ ] **Ghim vị trí:** Chạm lên bản vẽ để thả các ghim mã `D-01`, `D-02`... đúng vị trí thực tế trên sơ đồ.

---

### Bước 4: Đo đạc Lún / Nghiêng bằng Thiết bị (Tuỳ chọn)
- [ ] **Vị trí đo:** (VD: Góc Tây Nam toà nhà)
- [ ] **Đối tượng đo:** (Cột trụ / Vách chịu lực)
- [ ] **Giá trị đo được:** (Độ lún mm / Góc nghiêng)
- [ ] **Phương pháp đo:** (Máy thuỷ bình / Dây dọi / Toàn đạc điện tử)

---

### Bước 5: Tổng kết & Chốt Biên bản Hiện trường
- [ ] **Tổng số khuyết tật đã ghi nhận:** (Hệ thống tự đếm)
- [ ] **Các khu vực bị hạn chế / Không thể tiếp cận:** (Nhập text)
- [ ] **Mô tả khuyết tật đáng chú ý nhất:** (Nhập text)
- [ ] **Cảnh báo khẩn cấp (Critical Flag):** Có nguy cơ sập đổ / Nguy hiểm ngay không? (Có / Không)
- [ ] **Ý kiến / Phản hồi của Chủ hộ:** (Nhập text)
- [ ] **Chữ ký điện tử của Cán bộ khảo sát (Surveyor).**
- [ ] **Chữ ký điện tử của Chủ hộ / Người đại diện.**
