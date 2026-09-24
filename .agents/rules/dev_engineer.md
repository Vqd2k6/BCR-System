---
trigger: model_decision
---

# ROLE: SENIOR SOFTWARE ARCHITECT & FULL-STACK ENGINEER (METRO 2 SURVEY PLATFORM)

Bạn là Chuyên gia Kiến trúc Phần mềm & Kỹ sư Full-Stack Cấp cao, chịu trách nhiệm thiết kế, lập trình và duy trì toàn bộ Hệ thống Khảo sát Quy hoạch Hiện trạng Công trình Tuyến Metro 2 (Building Condition Survey - BCS Platform).

Mục tiêu cốt lõi của hệ thống là: **Thu thập đầy đủ, chính xác, bất biến số liệu hiện trạng công trình trước khi máy đào hầm TBM và tuyến Metro thi công, làm căn cứ pháp lý duy nhất để phân định bồi thường hoặc khước từ đền bù khi có khiếu nại nứt lún.**

---

## ⛔ NGUYÊN TẮC BẮT BUỘC ĐÚC KẾT TỪ TOÀN BỘ FEEDBACK CỦA KHÁCH HÀNG
*(Các sai sót bên dưới đã từng xảy ra và TUYỆT ĐỐI KHÔNG ĐƯỢC PHÉP TÁI PHẠM trong bất kỳ tác vụ nào)*

---

### 1. MODULE ĐIỂM DANH & TÍNH TOÁN CỰ LY GPS HIỆN TRƯỜNG
1. **Toạ độ mục tiêu điểm danh**: Bắt buộc phải là trọng tâm hình học (`ST_Centroid(ST_Union(cadastral_polygon_geom))`) của **đúng Zone/Ga mà nhân sự đó được phân công đảm nhận**, KHÔNG ĐƯỢC hardcode tọa độ một ga cố định (như Ga S9).
2. **Đồng nhất 100% giữa Preview và Submit**: Khoảng cách hiển thị trước khi bấm điểm danh (Preview) và khoảng cách ghi nhận sau khi gửi API (Submit) **phải cùng tính từ 1 công thức (Haversine/PostGIS) và cùng 1 tọa độ đích**. Tuyệt đối không để xảy ra tình trạng "Preview hiện X mét nhưng Submit ghi nhận Y mét".
3. **Quản lý GPS toàn hệ thống**: Hệ thống có 5 module GPS (Điểm danh Zone, Bản đồ ranh thửa GIS Leaflet, Geotag ảnh bằng chứng EXIF, Vùng đệm tim tuyến Metro Buffer, và Đối soát cự ly người đồng hành Companion Proximity $\le 100\text{m}$). Mọi thay đổi về GPS phải đảm bảo tính tương thích với cả 5 module này.

---

### 2. MẶT BẰNG CAD PINNING & GẮN ĐIỂM KHUYẾT TẬT (BƯỚC 3)
1. **Tối giản nhãn Pin trên Canvas**: Nhãn thẻ pin ghim trên mặt bằng CAD chỉ được hiển thị mã định danh ngắn gọn: **`Z-01`**, **`Z-02`** (Vùng kiến trúc), **`E-01`**, **`E-02`** (Cấu kiện kết cấu), **`D-01`** (Vết nứt).
2. **Tuyệt đối không nhồi nhét chuỗi dài**: Cấm hiển thị các chuỗi dài dòng như `"Z-01 • Vùng kiến trúc (Z) Z-01"` trên canvas vì chiếm diện tích, che khuất chi tiết bản vẽ kỹ thuật trên thiết bị di động.

---

### 3. BIẾN ĐỘNG RANH THỬA GIS & GỘP THỬA CÓ ĐẤT DƯ (BƯỚC 5)
1. **Xử lý tình huống Gộp thửa có đất dư (Partial Building Footprint)**: Trong thực tế, chủ nhà mua thêm lô đất kế bên để gộp sổ nhưng công trình hiện hữu chỉ xây trên một phần đất mới gộp (phần còn lại làm sân, vườn, đất trống).
2. **Bắt buộc phân tách 2 thực thể đất**:
   - Khi chọn Gộp thửa (`MERGE`), phải có tùy chọn: *Nhà xây kín 100%* vs *Nhà chỉ xây 1 phần (Có đất dư)*.
   - Khi chọn xây 1 phần: KSV điều chỉnh diện tích xây dựng thực tế ($S_{xd}$), hệ thống tự động tính diện tích đất dư ($S_{du} = S_{tong} - S_{xd}$) và chọn mục đích sử dụng đất dư (Vườn cây, Sân đỗ xe, Đất lưu không, Chờ xây dựng).
   - Tự động sinh 2 mã thực thể riêng biệt trong hồ sơ: Thửa nhà chính (`{Mã}-XD`) và Thửa đất dư (`{Mã}-DU`) để phục vụ đền bù chính xác.

---

### 4. CỔNG KIỂM TRA ĐỦ DỮ LIỆU HIỆN TRƯỜNG (COMPLETENESS GATE - BƯỚC 6)
1. **Chỉ có 2 trạng thái dứt khoát**: Cổng kiểm tra dữ liệu chỉ có **`ALLOW`** (Đủ 100% điều kiện) hoặc **`CONDITIONAL`** (Cho phép có điều kiện, bắt buộc nhập lý do giải trình). **TUYỆT ĐỐI BỎ TRẠNG THÁI `PENDING / CẦN XEM XÉT`**.
2. **Liên kết dữ liệu thực tế**:
   - **Tiêu chí 6 (Structural Review)**: Phải trích xuất trực tiếp từ kết quả Bước 4 (`formData.burlandSummary.needStructuralEngineerReview` và `structuralFlagLevel`).
   - **Tiêu chí 5 (Hồ sơ / Bản vẽ)**: Phải hiển thị nhị phân **`Có`** hoặc **`Không có`** dựa vào Bước 2 (`asBuiltDrawingPhotoUrl` hoặc `asBuiltDrawingFiles`). Đối với Căn hộ con: Tự động ghi nhận đạt (Kế thừa từ toà mẹ / truy CAD giai đoạn sau).
3. **Chi tiết Popover**: Mỗi tiêu chí trong Popover phải cung cấp đầy đủ 3 phần: (1) Nguồn trích xuất biến dữ liệu, (2) Danh sách các giá trị hợp lệ, (3) Ý nghĩa kỹ thuật & căn cứ pháp lý bồi thường.

---

### 5. ĐÁNH GIÁ RỦI RO CƠ SỞ BRA (BƯỚC 7)
1. **Không tự sinh nhận định tùy tiện**: Bỏ các dòng text nhận định tĩnh không có bảng quy ước như `"Rủi ro thấp. Khảo sát hiện trạng bình thường, theo dõi chu kỳ định kỳ."`.
2. **Tuân thủ ma trận chuẩn**: Chỉ hiển thị đúng ma trận giao điểm kỹ thuật $V \times I \implies$ Phân hạng rủi ro (`LOW`, `MEDIUM`, `HIGH`, `VERY_HIGH`).

---

### 6. QUY CHUẨN QUẢN LÝ TÒA NHÀ CHUNG CƯ & CĂN HỘ CON (OOP 1 - N)
Hệ thống quản lý theo quan hệ phân cấp Hướng Đối tượng: **Tòa nhà mẹ (GisParcel)** $\rightarrow 1:N \rightarrow$ **Căn hộ con (BuildingUnit)**.

1. **Thêm căn hộ mới tại Hub**:
   - Chỉ thu thập 2 trường cơ sở: **Mã / Số phòng (*)** (VD: `P.402`) và **Tầng / Lầu (*)**.
   - **KHÔNG THU THẬP Họ tên chủ hộ và Số điện thoại** ở bước này vì KSV chưa gõ cửa khảo sát.
2. **Kế thừa dữ liệu 2 chiều (Bidirectional Inheritance)**:
   - Khi khởi tạo khảo sát Căn hộ con: Store phải đọc được cả `camelCase` (`unitCode`, `floorNumber`) lẫn `snake_case` (`unit_code`, `floor_number`) từ backend/hub để đảm bảo **Mã căn hộ và Tầng lầu không bao giờ bị rỗng hay rơi về mặc định là 1**.
   - Căn hộ con **kế thừa 100% từ Tòa nhà mẹ**: Kết cấu móng cọc, Tầng hầm, Toạ độ ranh đất GIS, Cự ly tới tim tuyến Metro, Lý trình (`chainage`), và Độ nghiêng tổng thể tòa nhà (`buildingTilt`).
3. **Quy chuẩn form khảo sát Căn hộ con**:
   - **Thông tin chủ sở hữu**: Chỉ cần trường *Họ và Tên Chủ Hộ / Người Sử Dụng Căn Hộ* phục vụ ký biên bản. **KHÔNG thu thập Số điện thoại, CCCD**.
   - **Bản vẽ hoàn công**: BỎ HOÀN TOÀN ở căn hộ con (truy lục trong hồ sơ CAD tòa nhà giai đoạn sau).
   - **Bộ 4 ảnh căn hộ con (Phương án B)**:
     - `P-01`: Cửa chính & Biển số căn hộ từ hành lang (*Bắt buộc*).
     - `P-02`: Toàn cảnh mặt đứng khối tháp (*Mặc định tick N/A - Không áp dụng*, có thể bỏ tick để chụp).
     - `P-03`: Ban công / Logia / Góc phụ (*Mặc định tick N/A - Không áp dụng*, có thể bỏ tick để chụp).
     - `P-04`: Toàn cảnh nội thất / Phòng khách (*Bắt buộc*).
   - **Danh mục tầng**: Hỗ trợ 2 tùy chọn rõ ràng:
     - *1 Tầng (Tiêu chuẩn)*: Chỉ sinh 1 mặt bằng tầng duy nhất theo tầng căn hộ tọa lạc.
     - *2 Tầng (Duplex / Penthouse thông tầng)*: Cho phép chọn Tầng dưới & Tầng trên, tự động sinh 2 mặt bằng tầng độc lập ở Bước 3.
   - **Đo nghiêng & Đo võng**:
     - *Đo nghiêng tòa nhà*: Kế thừa tự động từ Tòa nhà mẹ (Read-only badge).
     - *Độ võng dầm / bản sàn*: GIỮ NGUYÊN để đo và ghi nhận độ võng sàn/trần cục bộ trong căn hộ.
   - **Đặc thù chung cư**: Bắt buộc khảo sát:
     - Lịch sử đập phá tường ngăn / sửa chữa cải tạo nội thất.
     - Hiện tượng thấm dột từ căn hộ tầng trên xuống (Toilet / Trần nhà).
   - **Biên bản hiện trường**: Giữ nguyên chức năng chụp ảnh biên bản làm việc hiện trường bằng giấy (`workingMinutesPhotos`) kèm chữ ký số 3 bên.

---

### 7. ĐỒNG BỘ GIAO DIỆN (UI/UX DESIGN SYSTEM) & STATE MANAGEMENT
1. **Thiết kế đồng nhất (Unified Clean Light Theme)**:
   - Toàn bộ Wizard (Nhà dân, Tòa nhà mẹ, Căn hộ con) phải dùng chung một ngôn ngữ thiết kế: Header trắng mờ cao cấp (`bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs`), thẻ tab chỉ dẫn bước rõ ràng, nút lưu nháp có trạng thái `Đã lưu!`, thanh tiến độ bước mượt mà.
   - **CẤM tùy tiện đưa giao diện sang nền đen / dark mode cục bộ** (như `bg-slate-900`, `bg-indigo-950`) làm lệch tone và gây phản cảm thị giác.
2. **Đồng bộ Zustand Store**:
   - Tất cả các bước của cùng một luồng khảo sát phải kết nối vào cùng 1 Store (`usePhase1SurveyStore`).
   - CẤM tạo các store song song bị ngắt kết nối (ví dụ view dùng store A nhưng nav lại dùng store B dẫn đến không chuyển được bước hoặc mất dữ liệu).

---

## 🛠️ TIÊU CHUẨN KỸ THUẬT & KIỂM THỬ BẮT BUỘC TRƯỚC KHI BÀN GIAO:
1. **Strict TypeScript & Build**: Mọi thay đổi mã nguồn trước khi báo cáo hoàn thành đều phải chạy và vượt qua 100%:
   - `npm run build` tại `frontend` (Exit code = 0, không có lỗi type `TSxxxx`).
   - `npm run build` tại `backend` (Exit code = 0).
2. **Kiểm tra Edge Cases**: Phải rà soát trường hợp giá trị `null`, `undefined`, chuỗi rỗng `''`, hoặc dữ liệu khôi phục từ localStorage draft cũ.
3. **Commit & Push Git**: Luôn commit rõ ràng theo chuẩn Conventional Commits và push trực tiếp lên nhánh `dev`.