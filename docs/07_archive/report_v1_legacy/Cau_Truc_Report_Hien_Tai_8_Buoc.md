# CẤU TRÚC BÁO CÁO KHẢO SÁT HIỆN TRẠNG CÔNG TRÌNH – PHASE 1 (BCS REPORT)
## DỰ ÁN TUYẾN TÀU ĐIỆN NGẦM SỐ 2 TP. HỒ CHÍ MINH (BẾN THÀNH – THAM LƯƠNG)
### Chuẩn Liên danh CRLG – CRSRI – TT & Ban Quản lý Đường sắt Đô thị (MAUR)

> **Mục đích tài liệu:** Tài liệu này mô tả chi tiết toàn bộ cấu trúc, đề mục, bảng biểu, trường dữ liệu, **kích thước và tỷ lệ khung hình ($W \times H$)** của tất cả các ảnh được chèn trong Báo cáo khảo sát hiện trạng công trình Phase 1 hiện tại (được chuẩn hóa bám sát 100% quy trình 8 bước khảo sát thực địa). Bạn có thể chỉnh sửa trực tiếp trên tài liệu này (thay đổi thứ tự các phần, chỉnh sửa kích thước khung ảnh, thêm/bớt mục) để làm căn cứ điều chỉnh template xuất PDF/HTML.

---

## 📐 BẢNG TỔNG HỢP QUY CÁCH KÍCH THƯỚC KHUNG ẢNH (W × H) TRONG BÁO CÁO

*Khổ in chuẩn: **A4 Portrait** ($210\text{mm} \times 297\text{mm}$). Căn lề `@page`: Top $18\text{mm}$, Bottom $18\text{mm}$, Left $18\text{mm}$, Right $15\text{mm}$.*  
*&rarr; **Chiều rộng lọt lòng in khả dụng:** $210 - (18 + 15) = \mathbf{177\text{ mm}}$ (xấp xỉ $670\text{ px}$ ở độ phân giải in 96 DPI của trình duyệt).*  
*&rarr; **Chiều cao lọt lòng in khả dụng:** $297 - (18 + 18) = \mathbf{261\text{ mm}}$ (xấp xỉ $986\text{ px}$).*

| STT | Tên loại ảnh & Class CSS | Vị trí xuất hiện | Bố cục Layout (Grid/Flex) | Chiều rộng khung ($W$) | Chiều cao khung ($H$) | Tỉ lệ ($W:H$) | Chế độ co dãn (`object-fit`) | Ghi chú kỹ thuật |
| :---: | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **1** | **Ảnh bìa mặt đứng P-02**<br>`.cover-photo img` | Trang bìa chính | 1 cột đơn căn giữa trang | **$177\text{ mm}$** ($100\%$ chiều rộng) | **$375\text{ px}$** ($\approx 99.2\text{ mm}$, tăng 150%) | Tự nhiên ($16:9, 3:4\dots$) | `contain` | Bo viền $1\text{pt}$ xám, padding $6\text{px}$, căn giữa hoàn hảo. Caption chân ảnh rõ nét. |
| **2** | **Tầng 1: Ảnh P-01 Biển số nhà**<br>`.photo-card-full .photo-frame-full img` | Phần 1 (Mục 1.3) | 1 cột đơn chiếm full A4 ($W_{P01} = W_{A4}$) | **$177\text{ mm}$** ($100\%$ chiều rộng A4) | **$260\text{ px}$** ($\approx 68.8\text{ mm}$) | Tự do | `contain` | Hàng 1: Chiếm trọn $100\%$ chiều rộng A4, to rõ ràng. |
| **3** | **Tầng 2: Cặp ảnh P-02 & P-03**<br>`.photo-grid-pair-2col .photo-frame-vertical img` | Phần 1 (Mục 1.3) | Lưới CSS Grid 2 cột kề nhau ($W_{P02} + W_{P03} = W_{A4}$) | **$\approx 83.5\text{ mm}$** (mỗi ô, gộp lại full A4) | **$280\text{ px}$** ($\approx 74\text{ mm}$) | Tự do | `contain` | Hàng 2: P-02 (Mặt đứng) + P-03 (Mặt bên) đứng kề nhau full A4. |
| **4** | **Tầng 3: Ảnh P-04 Bối cảnh Metro**<br>`.photo-card-full .photo-frame-full img` | Phần 1 (Mục 1.3) | 1 cột đơn chiếm full A4 ($W_{P04} = W_{A4}$) | **$177\text{ mm}$** ($100\%$ chiều rộng A4) | **$260\text{ px}$** ($\approx 68.8\text{ mm}$) | Tự do | `contain` | Hàng 3: Chiếm trọn $100\%$ chiều rộng A4, toàn cảnh vỉa hè & Metro. |
| **5** | **Ảnh bản vẽ hoàn công móng**<br>`img[alt="Bản vẽ hoàn công móng"]` | Phần 2 (Mục 2.3) | Khung đơn kỹ thuật | **$\max 177\text{ mm}$** ($100\%$) | **$\max 220\text{ px}$** ($\approx 58\text{ mm}$) | Tự nhiên | `contain` | Giữ nguyên tỷ lệ bản vẽ kỹ thuật không bị méo nét. |
| **6** | **Sơ đồ CAD kép (Damage & Kết cấu)**<br>`.cad-dual-grid .cad-box img` | Phần 3 (Từng tầng) | Lưới CSS Grid 2 cột (gap $10\text{px}$) | **$\approx 83.5\text{ mm}$** (mỗi bản vẽ) | **$320\text{ px}$** ($\approx 84.6\text{ mm}$) | Chuẩn CAD | `contain` | Chiều cao tăng lên $320\text{px}$, triệt tiêu khoảng trắng thừa hai bên. |
| **7** | **Ảnh bối cảnh tổng quan tầng**<br>`.floor-overview-card img` | Phần 3 (Từng tầng) | *Ảnh ngang / 1 ảnh:* 1 cột full A4 ($W = W_{A4}$)<br>*2 ảnh dọc:* 2 cột kề nhau ($W_1 + W_2 = W_{A4}$) | **$177\text{ mm}$** (hoặc $83.5\text{mm} \times 2$) | **$320\text{ px}$** ($\approx 84.6\text{ mm}$, **Kích thước lớn**) | Tự nhiên | `contain` | **Kích thước lớn**, thấy rõ toàn cảnh tầng, không bị crop. |
| **8** | **Ảnh khuyết tật D (Đứng riêng lẻ $W = W_{A4}$)**<br>`.defect-card-single .defect-evidence-full img` | Phần 3 (Sổ khuyết tật D) | Mỗi ảnh 1 hàng riêng lẻ ($W = W_{A4}$), không ghép đôi | **$177\text{ mm}$** ($100\%$ chiều rộng A4) | **$320\text{ px}$** ($\approx 84.6\text{ mm}$, **Bự Full**) | Tự nhiên | `contain` | *Ảnh 1:* Bối cảnh mảng tường ($W = W_{A4}$).<br>*Ảnh 2:* Cận cảnh thước đo nứt crack gauge ($W = W_{A4}$), cực kỳ to rõ, đọc chính xác từng vạch chia $0.1\text{mm}$. |
| **9** | **Ảnh đo đạc biến dạng lún nghiêng**<br>`.deformation-grid .deformation-card img` | Phần 3 (Mục 3.1) | Lưới CSS Grid 2 cột (gap $10\text{px}$) | **$\approx 84.5\text{ mm}$** (mỗi ô) | **$280\text{ px}$** ($\approx 74\text{ mm}$) | Tự nhiên | `contain` | Tăng chiều cao lên $280\text{px}$, loại bỏ khoảng trắng hở 2 bên. |
| **10** | **Ảnh Biên bản hiện trường 2 trang**<br>`.working-minutes-sheet img` | Phần 8 (Phụ lục 8.3) | Toàn trang dọc A4 độc lập | **$\max 177\text{ mm}$** ($100\%$) | **$\max 780\text{ px}$** ($\approx 206\text{ mm}$) | Chuẩn A4 đứng | `contain` | Chiếm trọn 1 trang in đứng, nạp nguyên bản biên bản viết tay 2 trang. |
| **11** | **Bộ ảnh Phụ lục Vùng Z & Cấu kiện E (Đứng riêng lẻ $W = W_{A4}$)**<br>`.appendix-photo-list-full .appendix-photo-card-full img` | Phần 8 (Phụ lục 8.4) | Mỗi ảnh 1 hàng riêng lẻ ($W = W_{A4}$), không ghép đôi | **$177\text{ mm}$** ($100\%$ chiều rộng A4) | **$320\text{ px}$** ($\approx 84.6\text{ mm}$, **Bự Full**) | Tự do | `contain` | Kích thước ảnh full chiều rộng A4, hình ảnh bự rõ nét, không bị trống trang. |
| **12** | **Chữ ký số / Chữ ký tươi 3 bên**<br>`.sig-box img.sig-img` | Bìa 2 & Phần 8 (Mục 8.2) | 3 ô chữ ký độc lập | **$\max 45\text{ mm}$** ($\approx 90\%$ ô) | **$32\text{ px} - 50\text{ px}$** ($\approx 10-13\text{ mm}$) | Tự nhiên | `contain` | Hiển thị chữ ký số hoặc ảnh chữ ký tươi nền trong suốt. |
| **12** | **Chữ ký số / Chữ ký tươi 3 bên**<br>`.sig-box img.sig-img` | Bìa 2 & Phần 8 (Mục 8.2) | 3 ô chữ ký độc lập | **$\max 45\text{ mm}$** ($\approx 90\%$ ô) | **$32\text{ px} - 50\text{ px}$** ($\approx 10-13\text{ mm}$) | Tự nhiên | `contain` | Hiển thị chữ ký số hoặc ảnh chữ ký tươi nền trong suốt. |

---

## 📑 MỤC LỤC TỔNG QUAN HỒ SƠ BÁO CÁO

```
├── [TRANG BÌA] TRANG BÌA PHÁP LÝ & ĐỊNH DANH CÔNG TRÌNH (ẢNH MẶT ĐỨNG 375PX + BẢNG 7x2)
├── [TRANG 02] KIỂM SOÁT TÀI LIỆU & QUY CHUẨN THỰC HIỆN (DOCUMENT CONTROL & METHODOLOGY)
├── PHẦN 1 (BƯỚC 1): TIẾP CẬN CÔNG TRÌNH & BỘ ẢNH ĐỊNH DANH NGOẠI THẤT (P-01 ĐẾN P-04)
├── PHẦN 2 (BƯỚC 2): THÔNG TIN PHÁP LÝ CHỦ HỘ, QUY MÔ KẾT CẤU & NỀN MÓNG CÔNG TRÌNH
├── PHẦN 3 (BƯỚC 3): KHẢO SÁT BIẾN DẠNG LÚN NGHIÊNG MẶT TIỀN & PHÂN TẦNG CHI TIẾT (CAD, Z, E, D, VÕNG DẦM)
├── PHẦN 4 (BƯỚC 4): ĐÁNH GIÁ CẤP ĐỘ HƯ HỎNG BURLAND (1977) & KHUYẾT TẬT KẾT CẤU CHỊU LỰC
├── PHẦN 5 (BƯỚC 5): PHẠM VI TIẾP CẬN KHẢO SÁT & XÁC NHẬN BIẾN ĐỘNG RANH ĐẤT GIS
├── PHẦN 6 (BƯỚC 6): TÍNH TOÁN KỸ THUẬT - BẢNG ĐIỂM HIỆN TRẠNG ECS & CHỈ SỐ DỄ TỔN THƯƠNG VI
├── PHẦN 7 (BƯỚC 7): TỔNG HỢP DASHBOARD RỦI RO METRO BRA, KẾT LUẬN & KIẾN NGHỊ KỸ THUẬT
└── PHẦN 8 (BƯỚC 8): KÝ BIÊN BẢN HIỆN TRƯỜNG 3 BÊN, Ý KIẾN CHỦ NHÀ & PHỤ LỤC TÀI LIỆU
```

---

## CHI TIẾT CẤU TRÚC TỪNG TRANG & QUY CÁCH KHUNG ẢNH

### 1. TRANG BÌA (COVER PAGE)
*Quy chuẩn in: Đóng gói trọn vẹn trong 1 trang đầu tiên, bố cục trang nghiêm, có viền bo kỹ thuật.*

- **Header Dự án:**
  - Tên Liên danh: `LIÊN DANH CRLG–CRSRI–TT`
  - Tên dự án: `DỰ ÁN XÂY DỰNG TUYẾN ĐƯỜNG SẮT ĐÔ THỊ SỐ 2 TP. HỒ CHÍ MINH (BẾN THÀNH – THAM LƯƠNG)`
- **Tiêu đề Báo cáo:**
  - Tiếng Việt: `BÁO CÁO KHẢO SÁT HIỆN TRẠNG CÔNG TRÌNH – PHASE 1`
  - Tiếng Anh: `BUILDING CONDITION SURVEY REPORT – PHASE 1`
- **Ảnh bìa nhận diện mặt đứng công trình (Tăng 50% thành 150%):**
  - **Khung ảnh:** Class `.cover-photo img`
  - **Kích thước khung:** $W = 100\%$ ($177\text{ mm}$), $H = \mathbf{375\text{ px}}$ ($\mathbf{\approx 99.2\text{ mm}}$).
  - **Chế độ hiển thị:** `object-fit: cover` (hoặc `contain`), viền $1\text{pt solid #94a3b8}$, padding $4\text{px}$, nền `#f8fafc`.
  - Nạp ảnh `P-02: Mặt đứng chính toàn cảnh`.
- **Bảng định danh thông tin bìa (Cover Metadata Table) – Bố cục 7 hàng × 2 cột ($7 \times 2$):**
  1. *Hàng 1:* Mã công trình (Building ID)
  2. *Hàng 2:* Mã khảo sát (Survey ID)
  3. *Hàng 3:* Địa chỉ công trình
  4. *Hàng 4:* Đoạn tuyến / Phân khu (Zone ID, Zone Name)
  5. *Hàng 5:* Hạng mục Metro liên quan (Metro Item Type)
  6. *Hàng 6:* Ngày khảo sát (Survey Date)
  7. *Hàng 7:* Phiên bản tài liệu (Rev. XX & Số hiệu tài liệu)
  *(Đã loại bỏ trường "Chủ sở hữu" và "Cự ly đến tim hầm" theo yêu cầu vì đã thể hiện chi tiết ở Phần 1 & Phần 2 phía sau).*
- **Footer Bìa:** `THÀNH PHỐ HỒ CHÍ MINH, NĂM 2026`

---

### 2. TRANG 2: KIỂM SOÁT TÀI LIỆU & THÔNG TIN DỰ ÁN (DOCUMENT CONTROL - 4 BẢNG CHUẨN)
*(Ngắt trang sang Trang 2 riêng biệt, gồm đúng 4 bảng biểu theo chuẩn biểu mẫu dự án CRLG)*

- **2.1. Bảng 1: Thông tin dự án & công trình (8 hàng × 2 cột):**
  - Tên dự án: `XÂY DỰNG TUYẾN ĐƯỜNG SẮT ĐÔ THỊ SỐ 2 THÀNH PHỐ HỒ CHÍ MINH (BẾN THÀNH – THAM LƯƠNG)`
  - Tên tài liệu: `Báo cáo khảo sát hiện trạng công trình – Phase 1`
  - Đơn vị thực hiện: `Liên danh CRLG–CRSRI–TT`
  - Building ID: `{{buildingId}}`
  - Survey ID: `{{surveyId}}`
  - Địa chỉ: `{{address}}`
  - Đoạn tuyến: `{{zoneName}} ({{zoneId}})`
  - Ngày khảo sát: `{{surveyDate}}`
- **2.2. Bảng 2: Bảng theo dõi sửa đổi phát hành (6 cột):**
  - Cột: `Rev.` | `Ngày` | `Mô tả phát hành` | `Lập` | `Kiểm tra` | `Phê duyệt`
  - Hàng Rev 00 (Phát hành lần đầu) & Hàng Rev 01.
- **2.3. Bảng 3: Bảng chức danh phê duyệt & chữ ký 3 bên (5 cột):**
  - Cột: `Vai trò` | `Họ và tên` | `Chức vụ` | `Chữ ký` | `Ngày`
  - Cấp 1: *Prepared by / Người lập* (Khảo sát viên hiện trường)
  - Cấp 2: *Checked by / Kiểm tra* (Kỹ sư Giám sát Zone Admin)
  - Cấp 3: *Approved by / Phê duyệt* (Chuyên gia Phê duyệt Super Admin)
  - **Khung ảnh chữ ký:** Class `.sig-img`, kích thước $W \le 45\text{ mm}$, $H = 28\text{ px} - 32\text{ px}$ ($\approx 8-9\text{ mm}$), `object-fit: contain`.
  - **Ghi chú dưới bảng:** *Ghi chú: Báo cáo Phase 1 là hồ sơ khảo sát và sàng lọc ban đầu. Hồ sơ pháp lý xác nhận hiện trạng trước thi công được thực hiện theo quy trình Phase 2 và các yêu cầu được dự án/Engineer phê duyệt.*
  - **Ký hiệu trang trí:** `✦`
- **2.4. Mục 1.1: Thông tin dự án & Bảng 4 (4 hàng × 2 cột):**
  - Đoạn văn giới thiệu mục đích thu thập dữ liệu ban đầu trước thi công Metro.
  - Bảng 4:
    + Nhà thầu EPC: `THACO-CREC`
    + Đơn vị thực hiện khảo sát: `Liên danh CRLG–CRSRI–TT`
    + Đoạn tuyến: `{{zoneName}} ({{zoneId}})`
    + Hạng mục gần công trình: `☑/☐ TBM   ☑/☐ Ga ngầm   ☑/☐ Cut & Cover   ☑/☐ Khác`

---

### 3. PHẦN 1 (BƯỚC 1): TIẾP CẬN CÔNG TRÌNH & BỘ ẢNH ĐỊNH DANH NGOẠI THẤT (P-01 ĐẾN P-04)
*(Ngắt trang sang Trang 3 riêng biệt, bắt đầu 8 bước khảo sát thực địa)*

- **1.1. Mục đích, phạm vi và trang thiết bị đo đạc kỹ thuật hiện trường:**
  - Bảng 4 thiết bị kỹ thuật chuẩn phục vụ đo đạc hiện trường:
    1. *Thiết bị chụp ảnh số có GPS:* Độ phân giải $\ge 12\text{MP}$, nhúng tọa độ WGS-84.
    2. *Thước đo bề rộng nứt (Crack Gauge):* Vạch chia $0.1\text{mm} \rightarrow 5.0\text{mm}$.
    3. *Thước laser / thước thép kỹ thuật:* Đo chiều dài nứt và kích thước phòng, sai số $\pm 1.5\text{mm}$.
    4. *Máy đo nghiêng điện tử / thước bọt nước:* Đo nghiêng thân nhà phương X/Y độ chính xác $0.1\permil$.
- **1.2. Tọa độ trắc địa GPS, tim tuyến Metro, khoảng cách tĩnh không & Nhận định loại công trình:**
  - **Bảng trắc địa & nhận định công trình (4 hàng × 2 cột đối xứng):**
    + *Hàng 1:* Tọa độ GPS WGS-84 (Lat, Lng) | Khoảng cách đến tim hầm Metro ($m$).
    + *Hàng 2:* Khoảng cách tĩnh không ($m$) | Đoạn tuyến / Ga phụ trách.
    + *Hàng 3:* Hạng mục công trình Metro | Nhóm đối tượng khảo sát (`GENERAL`, `IMPORTANT`, `SENSITIVE`).
    + *Hàng 4:* **Nhận Định Loại Công Trình** (`NORMAL`, `ABSENTEE`, `VACANT_LAND`, `UNDER_CONSTRUCTION`, `APARTMENT`) kèm badge màu trực quan.
  - **Đã ẩn trường "Lý trình tim tuyến (Chainage)"** theo đúng yêu cầu tinh gọn.
  - **Đã sáp nhập toàn bộ "Nhận Định Loại Công Trình" vào Mục 1.2** (gồm bảng nhận định và các khối thông báo/ảnh biên bản vắng nhà, hiện trạng đất trống, công trình dở dang).
- **1.3. Bộ ảnh định danh ngoại thất chuẩn (P-01 đến P-04) – Bố cục 3 tầng phân cấp chuẩn:**
  - **Tầng 1 (Hàng 1): Ảnh P-01 Biển số nhà / Tên công trình ($w_{P01} = w_{A4}$):**
    + Khung thẻ: Class `.photo-card-full` & `.photo-frame-full`.
    + Kích thước khung ảnh: $W = 100\%$ ($\mathbf{177\text{ mm}}$ toàn chiều rộng A4), $H = \mathbf{260\text{ px}}$ ($\mathbf{\approx 68.8\text{ mm}}$), `object-fit: contain`.
    + Chiếm trọn 1 hàng full width A4, hiển thị rõ ràng số nhà/biển hiệu công trình.
  - **Tầng 2 (Hàng 2): Cặp ảnh P-02 & P-03 đứng kề nhau ($w_{P02} + w_{P03} = w_{A4}$):**
    + Khung lưới: Class `.photo-grid-pair-2col` (CSS Grid 2 cột, gap: $10\text{px}$).
    + Khung ảnh: Class `.photo-frame-vertical`, kích thước $W = 100\%$ ($\mathbf{\approx 83.5\text{ mm}}$ mỗi ô), $H = \mathbf{280\text{ px}}$ ($\mathbf{\approx 74\text{ mm}}$), `object-fit: contain`.
    + P-02 (Mặt đứng chính toàn cảnh) và P-03 (Mặt bên/sau) đặt kề nhau, chiều cao lớn giúp chiều rộng 2 ảnh lấp đầy $100\%$ chiều rộng A4 mà không hở khoảng trắng.
  - **Tầng 3 (Hàng 3): Ảnh P-04 Bối cảnh đường phố & Tuyến Metro ($w_{P04} = w_{A4}$):**
    + Khung thẻ: Class `.photo-card-full` & `.photo-frame-full`.
    + Kích thước khung ảnh: $W = 100\%$ ($\mathbf{177\text{ mm}}$ toàn chiều rộng A4), $H = \mathbf{260\text{ px}}$ ($\mathbf{\approx 68.8\text{ mm}}$), `object-fit: contain`.
    + Chiếm trọn 1 hàng full width A4, hiển thị trọn vẹn toàn cảnh vỉa hè và hạ tầng Metro lân cận.
  - **Cấu trúc thẻ ảnh chuyên nghiệp (`.photo-card`):**
    + **Thanh tiêu đề thẻ (`.photo-header`):** Gồm badge định danh (`.photo-tag`: `P-01`, `P-02`, `P-03`, `P-04`) và tên loại ảnh chuẩn in hoa.
    + **Trường hợp Không áp dụng / Chưa có ảnh:** Hiển thị khối `.photo-placeholder` với lý do không áp dụng (`.placeholder-na`) rõ ràng, thẩm mỹ.
    + **Thanh thông tin kỹ thuật chân thẻ (`.photo-meta`):** Bố cục 2 hàng key-value gồm Mã ảnh, Ngày chụp, Tọa độ GPS, Khổ mặt đứng ($W \times H\text{ m}$) và Tag vị trí.
  - *Ảnh góc hông / mặt bên bổ sung (nếu có `p03AdditionalPhotos`):* Lưới ảnh phụ 2 cột, kích thước mỗi ảnh $W \approx 84.5\text{ mm} \times H = 220\text{ px}$ chuẩn hóa đồng bộ.

---

### 4. PHẦN 2 (BƯỚC 2): THÔNG TIN PHÁP LÝ CHỦ HỘ, QUY MÔ KẾT CẤU & NỀN MÓNG CÔNG TRÌNH
*(Ngắt trang sang trang mới)*

- **2.1. Thông tin pháp lý & Chủ hộ công trình:**
  - Tên chủ sở hữu / Người đại diện | Số điện thoại liên lạc.
  - Địa chỉ hiện trường | Mã thửa đất (Building ID) | Mã địa chính chính thức.
- **2.2. Quy mô kiến trúc & Hệ kết cấu chịu lực:**
  - Công năng sử dụng hiện hữu (Nhà ở gia đình / Thương mại / Khác).
  - Số tầng công trình: Số tầng nổi ($N$) | Số tầng hầm ($H$).
  - Hệ kết cấu chịu lực (Khung BTCT toàn khối, Tường gạch chịu lực, Khung thép, Hỗn hợp).
  - Năm xây dựng công trình (Xác nhận từ hồ sơ hoặc Ước tính hiện trường).
  - Diện tích sàn xây dựng ($m^2$) | Chiều cao công trình ($m$).
- **2.3. Khảo sát nền móng công trình & Đánh giá mức độ tin cậy CAT:**
  - Loại móng (Móng nông / Móng đơn / Móng băng / Móng cọc BTCT / Cừ tràm).
  - Nguồn thông tin móng (Bản vẽ hoàn công, Bản vẽ cấp phép, Chủ nhà nhớ, Kỹ sư suy đoán).
  - Phân cấp độ tin cậy móng: `CAT 1` đến `CAT 5` (dùng để tính toán chỉ số $V_3$).
  - Chiều sâu chôn móng thực tế ($m$) | Quy cách/Tiết diện cọc ($mm$).
  - Mật độ móng ($\text{SL}/m^2$) | Khoảng cách giữa các móng ($m$).
  - Ghi chú chi tiết về móng và địa chất nền.
  - **Khung ảnh Bản vẽ hoàn công móng (nếu có):**
    - Kích thước: $W = \max 100\%$ ($177\text{ mm}$), $H = \max 220\text{ px}$ ($\approx 58\text{ mm}$).
    - Chế độ hiển thị: `object-fit: contain`, viền $0.5\text{pt solid #cbd5e1}$, nền `#f8fafc`.
- **2.4. Hiện trạng công trình tiếp giáp lân cận (3 phía):**
  - Bảng tiếp giáp: *Phía bên trái (Left)* | *Phía bên phải (Right)* | *Phía sau (Back)*.
  - Ghi chú loại công trình lân cận, khe lún tiếp xúc, có chèn đệm xốp hay tiếp giáp trực tiếp.
- **2.5. Phỏng vấn lịch sử sử dụng công trình (6 chỉ tiêu kỹ thuật):**
  - Bảng 6 chỉ tiêu:
    1. *Cơi nới / Tăng tải:* Nâng tầng, đổ thêm ban công, bồn nước mái.
    2. *Sửa chữa lớn:* Gia cố móng, đập thông tường chịu lực, cải tạo kết cấu.
    3. *Lún / Nghiêng cũ:* Tiền sử nứt toác, lún chênh lệch trước đây.
    4. *Ảnh hưởng lân cận:* Tác động từ các nhà bên cạnh đào móng xây dựng.
    5. *Sự cố nghiêm trọng:* Hỏa hoạn, ngập lụt kéo dài, va chạm cơ giới.
    6. *Thiết bị nhạy cảm:* Máy móc phòng thí nghiệm, thiết bị y tế, hoạt động liên tục 24/7.
  - Ghi nhận trạng thái: `CÓ` / `KHÔNG` kèm ghi chú giải trình chi tiết.

---

### 5. PHẦN 3 (BƯỚC 3): KHẢO SÁT BIẾN DẠNG LÚN NGHIÊNG MẶT TIỀN & KHẢO SÁT PHÂN TẦNG CHI TIẾT
*(Ngắt trang sang trang mới)*

- **3.1. Kết quả đo đạc độ nghiêng thân nhà & biến dạng lún lệch mặt tiền công trình (Đưa lên trước khảo sát tầng):**
  - *Ý nghĩa kỹ thuật:* Đo đạc trắc địa lún - nghiêng được thực hiện ngay tại mặt tiền/ngoại thất công trình trước khi khảo sát sâu vào bên trong từng tầng.
  - *Bảng thông số đo đạc mặt tiền:*
    + Độ nghiêng thân nhà phương X ($\permil$) | Độ nghiêng thân nhà phương Y ($\permil$).
    + Phương pháp đo đạc hiện trường (Máy kinh vĩ, thước đo laser, quả dọi quang học...).
    + Ghi chú lún chênh lệch (nếu có).
    *(Tạm thời ẩn: "Hướng nghiêng chủ đạo", "Độ tin cậy số liệu", "Độ dốc sàn đo được" theo yêu cầu tinh giản).*
  - *Ảnh đo đạc lún nghiêng mặt tiền:*
    + Khung ảnh `.deformation-card .photo-frame` ($H = 180\text{ px}$, `object-fit: contain`).
    + Hình 3.1: Ảnh kiểm tra độ nghiêng thân nhà mặt tiền (Tilt measurement).
    + Hình 3.2: Ảnh kiểm tra lún lệch mặt tiền (Differential settlement).
  - *Nhận xét kỹ thuật:* Nhận xét chuyên môn của Kỹ sư hiện trường về biến dạng mặt tiền.

- **3.2. Khảo sát hiện trạng chi tiết từng tầng (Sơ đồ CAD, Vùng Z, Cấu kiện E, Sổ D & Độ võng dầm):**
  - **Vòng lặp chi tiết từng tầng (Duyệt qua tất cả các tầng: Trệt, Lầu 1, Lầu 2, Sân thượng...):**
    - **Header Tầng:** Tên tầng, số thứ tự, tổng số Vùng Z, số Cấu kiện E, số vết nứt D.
    - **Ghi chú tổng quan tầng:** Hiện trạng sử dụng, lát nền, trát tường của tầng.
    - **Sơ đồ mặt bằng CAD kép (Dual CAD Maps):**
      - Class `.cad-dual-grid` (grid 2 cột, gap $10\text{px}$).
      - Khung ảnh mỗi bản vẽ: Class `.cad-box img`, kích thước $W = 100\%$ ($\mathbf{\approx 83.5\text{ mm}}$), $H = \mathbf{220\text{ px}}$ ($\mathbf{\approx 58\text{ mm}}$), `object-fit: contain`, nền xám nhạt `#f8fafc`.
      - *Bản đồ 1:* Sơ đồ Bản đồ hư hỏng (Damage Map) &mdash; Ghim Pin các Vùng kiến trúc $Z$ và Vết nứt $D$.
      - *Bản đồ 2:* Sơ đồ Bản đồ kết cấu (Structural Map) &mdash; Ghim Pin các Cấu kiện cột/dầm/sàn $E$.
    - **Lưới ảnh tổng quan tầng (Floor Overview Photos - Kích thước lớn $320\text{px}$):**
      - *Trường hợp có 2 ảnh chụp đứng (Portrait):* Tự động ghép cặp trên 1 hàng (Class `.floor-overview-dual-grid`, CSS Grid 2 cột, $W_1 + W_2 = W_{A4}$, $H = \mathbf{320\text{ px}}$).
      - *Trường hợp ảnh ngang (Landscape) hoặc 1 ảnh đơn:* Mỗi ảnh xếp thành 1 hàng riêng biệt (Class `.floor-overview-grid`, $W = 100\% = W_{A4}$, $H = \mathbf{320\text{ px}}$).
      - Kích thước lớn $320\text{px}$ giúp thấy rõ toàn cảnh bao quát không gian từng tầng, không bị crop, bảo toàn tỷ lệ gốc.
    - **Bảng danh mục Vùng Kiến Trúc (Damage Zones - Z) của tầng:**
      - Mã Vùng ($Z\text{-01}, Z\text{-02}\dots$) | Tên phòng/Không gian | Cấu kiện tường / Vật liệu trát | Cấp Burland | Số vết nứt | Ghi chú.
    - **Bảng danh mục Cấu Kiện Kết Cấu Chịu Lực (Structural Elements - E) của tầng:**
      - Mã Cấu kiện ($E\text{-01}, E\text{-02}\dots$) | Loại cấu kiện (Cột BTCT, Dầm, Sàn, Tường chịu lực) | Vật liệu | Vị trí trục/phòng | Tình trạng nứt/ổn định.
    - **Sổ khuyết tật chi tiết (Defect Register) theo từng Vùng Z và Cấu kiện E:**
      - Bảng thông số: Mã khuyết tật ($D\text{-01}\dots$) | Loại nứt | Bề rộng lớn nhất $w_{\max}\text{ (mm)}$ | Chiều dài ($mm$) | Hướng nứt | Trạng thái phát triển | Cờ kết cấu $E_2$ | Ghi chú.
      - **Các thẻ ảnh khuyết tật đứng riêng lẻ ($W = W_{A4}$) – Tuyệt đối không ghép 2 ảnh 1 hàng:**
        - Khung thẻ: Class `.defect-card-single` với khung ảnh `.defect-evidence-full` ($W = 100\% = W_{A4}$, $H = \mathbf{320\text{ px}}$).
        - *Ảnh 1:* Bối cảnh mảng tường / cấu kiện (Context Photo) đứng riêng lẻ chiếm trọn full chiều rộng A4 ($177\text{mm}$).
        - *Ảnh 2:* Cận cảnh thước đo nứt crack gauge đứng riêng lẻ chiếm trọn full chiều rộng A4 ($177\text{mm}$), cực kỳ to rõ, đọc chính xác từng vạch chia $0.1\text{mm}$.
        - *Hộp metadata chân ảnh:* Mã vết nứt, phòng, bề rộng, chiều dài, trạng thái ổn định/phát triển.
    - **Thông số võng dầm bản sàn & Yêu cầu quan trắc bổ sung theo tầng (Được đưa về cuối từng tầng):**
      - Bảng đo đạc võng dầm sàn:
        + **Độ võng dầm / sàn lớn nhất ($mm$):** Vị trí đo đạc, mô tả đặc điểm võng.
        + **Yêu cầu quan trắc bổ sung:** `CẦN THIẾT LẬP MỐC QUAN TRẮC BỔ SUNG` / `Không yêu cầu`.
      - **Ảnh đo đạc võng dầm sàn tầng (nếu có):** Khung ảnh `.photo-card` ($H = 160\text{ px}$, `object-fit: contain`).

- **3.3. Bảng tổng hợp hiện trạng công trình – BCS Checklist (8 nhóm chỉ báo chuẩn):**
  - 1. Nứt khối xây | 2. Nứt kết cấu chịu lực | 3. Biến dạng lún nghiêng | 4. Nước & Thấm dột | 5. Suy giảm vật liệu/rỉ cốt thép | 6. Hư hỏng liên kết dầm cột | 7. Kẹt cửa & chức năng | 8. Nứt cũ đang phát triển.
  - Đánh giá: `CÓ` / `KHÔNG` kèm vị trí cụ thể và mức độ hư hại.

---

### 6. PHẦN 4 (BƯỚC 4): ĐÁNH GIÁ CẤP ĐỘ HƯ HỎNG BURLAND (1977) & KHUYẾT TẬT KẾT CẤU CHỊU LỰC
*(Ngắt trang sang trang mới)*

- **4.1. Đánh giá cấp độ hư hại theo thang chuẩn Burland (1977):**
  - *Bảng định nghĩa chuẩn quốc tế Burland (1977):* 6 cấp độ từ Grade 0 (Không đáng kể) đến Grade 5 (Rất nặng / Nguy cơ sập đổ), tương ứng với khoảng bề rộng nứt và phương án khắc phục điển hình.
  - *Bảng kết quả chốt hiện trường:*
    - Cấp Burland chủ đạo (Predominant Grade) &mdash; Mức nứt phổ biến nhất.
    - Cấp Burland cục bộ lớn nhất (Local Max Grade) &mdash; Vết nứt nặng nhất (quyết định điểm $E_1$).
    - Vùng chi phối rủi ro (Governing Zone Code & Mô tả mảng tường chi phối).
    - Tính đại diện của hư hỏng: `GLOBAL` (Toàn diện toàn nhà) hay `LOCAL` (Cục bộ).
- **4.2. Đánh giá cờ khuyết tật kết cấu chịu lực & Nhu cầu thẩm tra kỹ sư:**
  - Cờ khuyết tật kết cấu: `NONE` (0đ), `LOW` (1đ), `MODERATE` (2đ), `HIGH` (3đ), `CRITICAL` (4đ).
  - Nhu cầu thẩm tra của Kỹ sư kết cấu chuyên môn cao: `CẦN KỸ SƯ KẾT CẤU THẨM TRA` / `Không yêu cầu`.
- **4.4. Nhận xét kỹ thuật của Kỹ sư hiện trường về biến dạng:**
  - Đánh giá xu hướng tiến triển của lún nghiêng và cảnh báo an toàn.

---

### 7. PHẦN 5 (BƯỚC 5): PHẠM VI TIẾP CẬN KHẢO SÁT & XÁC NHẬN BIẾN ĐỘNG RANH ĐẤT GIS
*(Ngắt trang sang trang mới)*

- **5.1. Phạm vi không gian đã khảo sát thực tế:**
  - Bảng tổng hợp các khu vực/tầng thực tế được khảo sát (Mặt tiền & Ngoại quan, Tầng trệt, Tầng lửng, Lầu... hoặc các tầng bị hạn chế).
  - Trạng thái: `ĐÃ TIẾP CẬN` hoặc `CHƯA TIẾP CẬN`.
  - Ghi chú hiện trường thực tế theo từng tầng.
- **5.2. Mức độ hạn chế tiếp cận (Access Limitations):**
  - Phân loại tiếp cận: Lấy trực tiếp từ phase khảo sát (`Không có hạn chế (Tiếp cận 100%)` hoặc `Hạn chế tiếp cận một phần`).
  - Khu vực hạn chế tiếp cận: Danh sách khu vực bị hạn chế thực tế (nếu không có thì ghi `Không`).
  - Nguyên nhân hạn chế chính: Nguyên nhân thực tế từ hiện trường (nếu không có thì ghi `Không`).
  - Ghi chú / Biên bản hiện trường nếu có ghi nhận.
- **5.3. Xác nhận biến động ranh thửa đất GIS quy hoạch (Cadastral GIS Mutation):**
  - Trạng thái ranh đất: `MATCH` (Trùng khớp 100%), `SPLIT` (Tách thửa), `MERGE` (Hợp thửa), `DISCREPANCY` (Sai lệch mốc ranh).
  - Diễn giải lý do biến động ranh đất.
  - *Bảng chi tiết các thửa con phân tách (nếu có Tách thửa - SPLIT):*
    - Căn / Phân đoạn | Mã gợi ý | Diện tích ($m^2$) | Chủ sở hữu ghi nhận | Số nhà | Công năng thực tế.

---

### 8. PHẦN 6 (BƯỚC 6): TÍNH TOÁN KỸ THUẬT - BẢNG ĐIỂM HIỆN TRẠNG ECS & CHỈ SỐ DỄ TỔN THƯƠNG VI
*(Ngắt trang sang trang mới)*

- **6.1. Bảng tính điểm đánh giá tình trạng hiện hữu (Existing Condition Score - ECS):**
  - Bảng chấm điểm 6 tiêu chí nội tại (Thang điểm $0 - 24$ điểm):
    - **$E_1$ (0 - 4đ):** Hư hỏng nhìn thấy của khối xây / vữa trát (lấy theo Burland Local Max).
    - **$E_2$ (0 - 4đ):** Khuyết tật kết cấu cột / dầm / sàn / tường chịu lực.
    - **$E_3$ (0 - 4đ):** Biến dạng lún / nghiêng / võng dầm sàn.
    - **$E_4$ (0 - 4đ):** Suy giảm vật liệu, phong hóa vữa, rỉ cốt thép, thấm dột.
    - **$E_5$ (0 - 4đ):** Lịch sử cơi nới, sửa chữa, lún nứt cũ trong quá khứ.
    - **$E_6$ (0 - 4đ):** Tình trạng chức năng tổng thể và độ kín nước an toàn.
  - Tổng điểm tích lũy: $E_{\text{total}} / 24$ điểm.
  - Phân hạng ECS: `GOOD` (0-6đ: Tốt), `MEDIUM` (7-12đ: Trung bình), `DEFICIENT` (13-18đ: Kém), `CRITICAL` (19-24đ: Nguy cấp).
  - Can thiệp chuyên gia (Engineering Judgement Override cho ECS nếu có).
- **6.2. Bảng tính chỉ số dễ bị tổn thương của công trình (Vulnerability Index - VI):**
  - Bảng chấm điểm 6 yếu tố nhạy cảm (Thang điểm $1.0 - 4.0$ điểm):
    - **$V_1$ (1 - 4đ):** Năm xây dựng / Niên đại công trình.
    - **$V_2$ (1 - 4đ):** Hệ kết cấu chịu lực (BTCT, thép, tường gạch).
    - **$V_3$ (1 - 4đ):** Loại móng và cấp độ tin cậy thông tin (CAT 1-5).
    - **$V_4$ (1 - 4đ):** Chiều cao / Số tầng công trình.
    - **$V_5$ (1 - 4đ):** Hiện trạng tiếp giáp và khoảng hở với nhà bên cạnh.
    - **$V_6$ (1 - 4đ):** Mức độ sử dụng và độ nhạy cảm với rung động.
  - Điểm trung bình: $VI_{\text{avg}} = \frac{1}{6} \sum V_i$ (thang 1.0 - 4.0).
  - Phân cấp VI: `LOW` ($\le 1.5$: Thấp), `MEDIUM` ($1.6 - 2.5$: Trung bình), `HIGH` ($2.6 - 3.5$: Cao), `VERY_HIGH` ($> 3.5$: Rất cao).
  - Can thiệp chuyên gia (Engineering Judgement Override cho VI nếu có).

---

### 9. PHẦN 7 (BƯỚC 7): TỔNG HỢP DASHBOARD RỦI RO METRO BRA, KẾT LUẬN & KIẾN NGHỊ KỸ THUẬT
*(Ngắt trang sang trang mới)*

- **7.1. Bảng điều khiển chỉ số rủi ro tổng hợp (Executive Risk Dashboard):**
  - 4 Thẻ chỉ số trung tâm (Executive Cards):
    1. *Hiện trạng ECS:* Tổng điểm /24, Badge phân hạng (GOOD/MEDIUM/DEFICIENT/CRITICAL).
    2. *Chỉ số tổn thương VI:* Điểm TB /4.0, Badge phân cấp (LOW/MEDIUM/HIGH/VERY_HIGH).
    3. *Cấp tác động Metro I:* Cấp $I_1 \rightarrow I_4$, cự ly đến tim hầm.
    4. *Sàng lọc rủi ro BRA:* Mức rủi ro theo giao điểm $V \times I$.
  - Bảng tóm lược các thông số cơ học then chốt:
    - Dự báo lún tối đa $S_{\max}$ ($mm$) | Độ võng dầm/sàn lớn nhất ($mm$).
    - Độ nghiêng công trình phương X/Y ($\permil$) | Tổng số khuyết tật ghi nhận.
- **7.2. Dữ liệu tác động từ công trình Metro & Mặt cắt hình học:**
  - Hạng mục Metro tác động, Cự ly tim hầm ($m$), Khoảng cách tĩnh không ($m$).
  - Dự báo lún tối đa $S_{\max}$ ($mm$), Biến dạng góc dự báo, Vận tốc hạt đỉnh rung động PPV ($mm/s$).
  - Phân cấp tác động Metro (Impact Class $I_1 \rightarrow I_4$).
- **7.3. Sàng lọc ma trận rủi ro cơ sở (Building Risk Assessment - BRA):**
  - Bảng ma trận $4 \times 4$ giao cắt giữa Cấp tổn thương $VI$ (hàng) và Cấp tác động $I$ (cột).
  - Kết quả mức rủi ro công trình: `LOW_RISK`, `MEDIUM_RISK`, `HIGH_RISK`, `VERY_HIGH_RISK`.
  - Hành động kỹ thuật bắt buộc theo quy định của MAUR & Nhà thầu EPC.
  - Ý kiến chuyên gia rà soát rủi ro BRA.
- **7.4. Kiến nghị kỹ thuật cụ thể phục vụ thi công hầm Metro:**
  - Kiến nghị kỹ thuật cụ thể từ khảo sát hiện trường (nếu có thì điền, không có thì ghi `Không`).

---

### 10. PHẦN 8 (BƯỚC 8): KÝ BIÊN BẢN HIỆN TRƯỜNG 3 BÊN, Ý KIẾN CHỦ NHÀ & PHỤ LỤC TÀI LIỆU
*(Ngắt trang sang trang mới)*

- **8.1. Ý kiến phản hồi và nguyện vọng của Chủ sở hữu / Người sử dụng công trình:**
  - Lấy đúng nội dung phản hồi từ phase khảo sát hiện trường (nếu không có thì ghi `Không`, không tự bịa câu văn mẫu).
- **8.2. Ký biên bản xác nhận pháp lý 3 bên tại hiện trường:**
  - Khung 3 hộp chữ ký:
    1. *Khảo sát viên hiện trường (Prepared by):* Họ tên, Chữ ký số/ảnh chữ ký tươi, Ngày ký.
    2. *Chủ sở hữu / Người sử dụng công trình:* Họ tên, Chữ ký tươi tại hiện trường, Ngày ký.
    3. *Quản trị viên khu vực / Kỹ sư giám sát Zone Admin (Checked by):* Họ tên, Chữ ký, Ngày ký.
  - **Khung ảnh chữ ký:** Class `.sig-img`, kích thước $W \le 45\text{ mm}$ ($\approx 90\%$ ô), $H = 32\text{ px} - 50\text{ px}$ ($\approx 10-13\text{ mm}$), `object-fit: contain`.
- **8.3. Phụ lục: Ảnh chụp Biên bản làm việc khảo sát hiện trường (Biên bản giấy ký tại chỗ):**
  - **Khung ảnh:** Class `.working-minutes-sheet img`.
  - **Kích thước khung ảnh:** $W = \max 100\%$ ($\mathbf{\max 177\text{ mm}}$), $H = \mathbf{\max 780\text{ px}}$ ($\mathbf{\approx 206\text{ mm}}$).
  - **Chế độ hiển thị:** `object-fit: contain`, chiếm trọn vẹn 1 trang dọc A4 (có lệnh ngắt trang `page-break-before: always` giữa trang 1 và trang 2).
  - Hiển thị trọn vẹn 2 trang ảnh chụp của Biên bản làm việc hiện trường viết tay có chữ ký tươi của chủ nhà và cán bộ khảo sát.
- **8.4. Phụ lục: Bộ ảnh hiện trạng toàn cảnh các Vùng Kiến Trúc (Z) & Cấu kiện Kết cấu (E) theo từng tầng:**
  - **Khung ảnh:** Class `.appendix-photo-list-full .appendix-photo-card-full` (mỗi ảnh 1 hàng riêng lẻ chiếm trọn full chiều rộng A4).
  - **Kích thước khung ảnh:** $W = 100\%$ ($\mathbf{177\text{ mm}}$), $H = \mathbf{320\text{ px}}$ ($\mathbf{\approx 84.6\text{ mm}}$, **Bự Full**), `object-fit: contain`.
  - **Cấu trúc trình bày:** Gom nhóm theo từng tầng công trình:
    - *Mục A:* Toàn bộ ảnh bối cảnh và toàn cảnh của các Vùng Kiến Trúc ($Z$) trong tầng.
    - *Mục B:* Toàn bộ ảnh bối cảnh và chi tiết của các Cấu kiện Kết cấu Chịu lực ($E$) trong tầng.
  - Thẻ ảnh đầy đủ header mã $Z/E$, thông số vật liệu, vị trí phòng và ghi chú hiện trạng. Hình ảnh bự rõ nét, không bị trống trang.
- **Footer chân trang báo cáo:** Mã băm SHA-256 bảo đảm tính bất biến, ngày giờ xuất báo cáo, phiên bản phần mềm.

---

## 🛠️ HƯỚNG DẪN DÀNH CHO BẠN KHI ĐIỀU CHỈNH BỐ CỤC

Khi bạn cần điều chỉnh bố cục báo cáo:
1. **Di chuyển vị trí các mục:** Bạn chỉ cần cắt/dán thứ tự các khối `PHẦN` hoặc các thẻ `<tr>`, `<div>` tương ứng trong file template [residential/index.hbs](file:///Users/vqd2k6/Desktop/MIT-techology/KSat_QHoach/backend/src/modules/report/templates/residential/index.hbs).
2. **Điều chỉnh kích thước khung ảnh:**
   - Thay đổi các thông số `height`, `width`, `grid-template-columns` tại file [residential/styles.css](file:///Users/vqd2k6/Desktop/MIT-techology/KSat_QHoach/backend/src/modules/report/templates/residential/styles.css) theo đúng bảng quy cách ở đầu tài liệu này.
3. **Thêm trường dữ liệu mới:**
   - Khai báo trường trong `backend/src/modules/report/report.types.ts`.
   - Ánh xạ trường từ DB/JSON trong `backend/src/modules/report/generators/residential.generator.ts`.
   - Render ra HTML bằng thẻ Handlebars `{{ten_truong}}`.
4. **Kiểm tra trực quan ngay trên hệ thống:**
   - **Xem preview chuẩn A4 Portrait mô phỏng bàn làm việc:** Modal preview trên Frontend đã tích hợp thanh công cụ Zoom (`75% Toàn cảnh`, `100% Chuẩn A4`, `125% Phóng to`, `Vừa khung`) và khóa cứng tỷ lệ $210\text{mm} \times 297\text{mm}$ khổ đứng trên nền bàn làm việc xám đậm, có đường phân trang đứt đoạn mô phỏng từng trang A4 chân thực.
   - Xem preview trực tiếp tại: `GET http://localhost:4000/api/v1/reports/:id/preview/html`.
   - Xuất PDF chuẩn A4 tại: `GET http://localhost:4000/api/v1/reports/:id/export/pdf`.
