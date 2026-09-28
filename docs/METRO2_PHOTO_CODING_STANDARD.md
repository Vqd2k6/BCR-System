# BỘ QUY CHUẨN ĐỊNH DANH & WATERMARK ẢNH KHẢO SÁT HIỆN TRƯỜNG DỰ ÁN METRO 2
**Mã hiệu tài liệu:** `METRO2-BCS-PHOTO-STD-2026`  
**Dự án:** Tuyến Tàu điện ngầm số 2 TP.HCM (Bến Thành – Tham Lương)  
**Phạm vi áp dụng:** Gói thầu CP2 / Khảo sát hiện trạng công trình trước và sau khi thi công khiên đào TBM (Phase 1 & Phase 2 BCS Report)  
**Đơn vị áp dụng:** Liên danh Nhà thầu & Tư vấn Giám sát (CRLG – CRSRI – TT / THACO – CREC / Ban QLDA MAUR)

---

## 1. MỤC ĐÍCH & CĂN CỨ PHÁP LÝ

1. **Bảo toàn tính toàn vẹn và bất biến của bằng chứng hiện trường**:
   - Hình ảnh khảo sát vết nứt, lún, nghiêng và hiện trạng công trình là căn cứ pháp lý quan trọng nhất để giải quyết tranh chấp, bồi thường thiệt hại khi máy đào hầm TBM đi ngầm bên dưới các khu dân cư.
   - Tránh hiện tượng nhầm lẫn giữa các thửa đất, các tầng, các vết nứt hoặc KSV sử dụng lại ảnh cũ từ dự án khác.
2. **Yêu cầu bắt buộc về dấu thị giác (Visual Watermark)**:
   - Mọi bức ảnh chụp hiện trường bắt buộc phải được đóng dấu (bake) trực tiếp vào dữ liệu pixel của bức ảnh ngay tại thời điểm chụp:
     + **Góc trên bên phải (Top-Right):** Logo liên danh nhà thầu **THACO – CREC** tỷ lệ 20% chiều rộng ảnh.
     + **Góc dưới bên phải (Bottom-Right):** Thời gian thực (Ngày, Giờ, Phút, Giây) và Mã định danh ảnh duy nhất (**Photo ID**).
3. **Định danh duy nhất xuyên suốt hệ thống (Unique Photo ID)**:
   - Mã định danh ảnh chuẩn hóa được sử dụng làm Khóa chính (`photoId` / `photoCode`) xuyên suốt:
     **Frontend (DOM `<img data-photo-code>`, Form State) $\rightarrow$ Backend API $\rightarrow$ Database (PostgreSQL Relational + JSONB) $\rightarrow$ Bản in Báo cáo Kỹ thuật BCS Report (PDF/DOCX)**.

---

## 2. CẤU TRÚC ĐỊNH DANH MÃ ẢNH CHUẨN HÓA (PHOTO CODING STANDARD)

### 2.1. Cú pháp tổng quát:
$$\mathbf{HCM\_M2. [MÃ\_CÔNG\_TRÌNH] \_ [VỊ\_TRÍ\_TẦNG] \_ [VÙNG/BỘ\_PHẬN] \_ [MÃ\_NỨT] \_ [LOẠI\_ẢNH] \_ [STT]}$$

```
                ┌─── Tiền tố Dự án Metro Tuyến số 2 TP.HCM cố định
                │
                │       ┌─── Mã thửa đất dự án (B05272) hoặc Căn hộ (P402)
                │       │
                │       │        ┌─── Vị trí tầng (Hầm B01, Lửng MEZZ, Tầng 3 F03, Mái ROOF...)
                │       │        │
                │       │        │     ┌─── Vùng khuyết tật (Z02) hoặc Cột/Dầm (C01, B02)
                │       │        │     │
                │       │        │     │     ┌─── Mã vết nứt trong sổ khuyết tật (D01, D02)
                │       │        │     │     │
                │       │        │     │     │     ┌─── Loại ảnh: CU / CTX / SETTLE / TILT / OVERVIEW / EXTRA
                │       │        │     │     │     │
                │       │        │     │     │     │     ┌─── Số thứ tự ảnh cùng vị trí chụp nhiều góc (_01, _02, _03)
                ▼       ▼        ▼     ▼     ▼     ▼     ▼
        HCM_M2. B05272 _ F03 _ Z02 _ D01 _ CU _ 01
```

---

### 2.2. Bảng Ký Hiệu Vị Trí Tầng (Floor / Level Codes)

Áp dụng cho mọi loại hình kết cấu nhà phố, biệt thự, trụ sở cơ quan và khối chung cư cao tầng:

| Mã Ký Hiệu | Tên Bộ Phận / Vị Trí Tầng | Diễn Giải Thực Tế |
| :--- | :--- | :--- |
| **`B01`**, **`B02`**, **`B03`** | Tầng Hầm (Basement 1, 2, 3) | Hầm để xe, hầm kỹ thuật ngầm sâu sát tim hầm Metro |
| **`SB`** | Bán Hầm (Semi-Basement) | Tầng bán hầm (cao trình 1/2 nổi trên mặt đất, 1/2 chìm) |
| **`F00`** | Tầng Trệt (Ground Floor) | Sảnh tầng trệt, phòng khách trệt tiếp giáp mặt đường |
| **`MEZZ`** | Tầng Lửng (Mezzanine) | Gác lửng đúc hoặc sàn lửng gỗ/thép phổ biến ở nhà phố TP.HCM |
| **`F01`**, **`F02`**, **`F03`**... | Các Tầng Lầu Nổi | Lầu 1, Lầu 2, Lầu 3... (tương ứng Tầng 2, Tầng 3, Tầng 4...) |
| **`TUM`** | Tầng Tum (Attic / Penthouse) | Phòng thờ, phòng giặt, tum thang kỹ thuật áp mái |
| **`TERRACE`** | Sân Thượng | Sân thượng lộ thiên trước/sau |
| **`ROOF`** | Mái Công Trình | Mái tôn, mái ngói hoặc sàn mái bê tông cốt thép |
| **`FOUND`** | Móng & Đà Kiềng (Foundation) | Chân móng, đà kiềng, cổ cột, hố ga kỹ thuật |
| **`EXT`** | Ngoại Thất Ngoài Nhà (Exterior) | Mặt tiền ngoài nhà, vỉa hè, lộ giới, hàng rào, ranh đất |

---

### 2.3. Bảng Ký Hiệu Loại Ảnh Khảo Sát (Photo Type Codes)

| Mã Loại Ảnh | Phân Nhóm | Ý Nghĩa Kỹ Thuật Pháp Lý |
| :--- | :--- | :--- |
| **`P01`** | Bước 1: Ngoại thất | Ảnh chụp Biển số nhà / Số hiệu căn hộ |
| **`P02`** | Bước 1: Ngoại thất | Ảnh chụp Mặt đứng chính diện bao quát toàn bộ chiều cao |
| **`P03`** | Bước 1: Ngoại thất | Ảnh chụp Mặt bên hông / Hẻm tiếp giáp / Mặt sau |
| **`P04`** | Bước 1: Ngoại thất | Ảnh chụp Vỉa hè / Mặt đường / Lộ giới tiếp giáp công trình |
| **`SETTLE`** | Bước 1: Lún Chênh (1.6.1) | Ảnh chụp hiện tượng lún chênh lệch, nứt xé chân tường, lún bậc tam cấp |
| **`TILT`** | Bước 1: Nghiêng (1.6.2) | Ảnh chụp đo độ nghiêng khối nhà, thước đo Laser/Nivo, quả dọi |
| **`ANOMALY`** | Bước 1: Bất Thường (1.6.3) | Ảnh trường hợp bất thường / ngoại lệ (rễ cây đội nền, hố ga sụt, vách độc lập) |
| **`OVERVIEW`** | Bước 3: Toàn Cảnh Sàn | Ảnh chụp góc rộng bao quát toàn bộ một tầng/sàn |
| **`CTX`** | Bước 3: Bối Cảnh (Context) | Ảnh chụp bao quát mảng tường / khu vực có khuyết tật trước khi thả ghim D-xx |
| **`CU`** | Bước 3: Cận Cảnh (Close-Up) | **Ảnh chụp cận cảnh vết nứt BẮT BUỘC kẹp thước đo tỷ lệ hệ mét** |
| **`SAGGING`** | Bước 3: Võng Kết Cấu | Ảnh đo độ võng dầm/sàn khẩu độ lớn |
| **`EXTRA`** | Ảnh Bổ Sung Phát Sinh | Ảnh hiện trường phát sinh thêm ngoài danh mục tiêu chuẩn |
| **`DOC`** | Hồ Sơ Giấy Tờ Phát Sinh | Ảnh chụp sổ hồng, giấy phép xây dựng, bản vẽ hoàn công kiến trúc |
| **`MINUTES`** | Biên Bản Hiện Trường | Ảnh chụp biên bản làm việc, chữ ký 3 bên tại hiện trường |

---

### 2.4. Quy Tắc Đánh Chỉ Số Ảnh Cùng Vị Trí (Multi-shot Index: `_01`, `_02`, `_03`...)

Khi khảo sát viên chụp **nhiều bức ảnh tại cùng một vị trí** (ví dụ: chụp thẳng, chụp nghiêng 45 độ, chụp cận cảnh điểm đầu và điểm cuối vết nứt), hệ thống tự động tăng hậu tố số thứ tự:
- `_01`: Bức ảnh thứ nhất (Góc chính diện / Tiêu chuẩn).
- `_02`: Bức ảnh thứ hai (Góc nghiêng / Bổ trợ chi tiết).
- `_03`: Bức ảnh thứ ba (Góc phóng đại / Toàn cảnh bổ sung).

---

## 3. VÍ DỤ MINH HỌA ÁP DỤNG THỰC TẾ

| Ngữ Cảnh Chụp Tại Hiện Trường | Mã Định Danh Ảnh (Photo ID) |
| :--- | :--- |
| **Vết nứt D01 ở Vùng Z02 Tầng 3 (Chụp cận cảnh có thước đo, góc thẳng)** | `HCM_M2.B05272_F03_Z02_D01_CU_01` |
| **Vết nứt D01 ở Vùng Z02 Tầng 3 (Chụp góc nghiêng 45 độ thứ 2)** | `HCM_M2.B05272_F03_Z02_D01_CU_02` |
| **Ảnh bối cảnh mảng tường Vùng Z02 Tầng 3 (Ảnh góc rộng 1)** | `HCM_M2.B05272_F03_Z02_CTX_01` |
| **Ảnh bối cảnh mảng tường Vùng Z02 Tầng 3 (Ảnh góc rộng 2)** | `HCM_M2.B05272_F03_Z02_CTX_02` |
| **Ảnh toàn cảnh sàn Tầng 3** | `HCM_M2.B05272_F03_OVERVIEW_01` |
| **Bộ 4 ảnh định danh ngoại thất (P-01 đến P-04)** | `HCM_M2.B05272_EXT_P01_01`<br>`HCM_M2.B05272_EXT_P02_01`<br>`HCM_M2.B05272_EXT_P03_01`<br>`HCM_M2.B05272_EXT_P04_01` |
| **Ảnh lún chênh lệch chân tường ở Bước 1** | `HCM_M2.B05272_SETTLE_01` (và `_02`) |
| **Ảnh đo nghiêng khối nhà ở Bước 1** | `HCM_M2.B05272_TILT_01` |
| **Hiện trạng nứt dầm sàn Tầng Hầm B1** | `HCM_M2.B05272_B01_Z01_D01_CU_01` |
| **Hiện trạng nứt dầm sàn Tầng Lửng** | `HCM_M2.B05272_MEZZ_Z01_D01_CU_01` |
| **Hiện trạng nứt sàn Sân Thượng** | `HCM_M2.B05272_TERRACE_Z01_D01_CU_01` |
| **Ảnh căn hộ chung cư (Căn P.402, Tầng 4, Phòng khách PK, Vết nứt D01)** | `HCM_M2.P402_F04_PK_D01_CU_01` |
| **Ảnh bổ sung phát sinh tại hiện trường** | `HCM_M2.B05272_EXTRA_01` |
| **Ảnh chụp sổ hồng / bản vẽ hoàn công** | `HCM_M2.B05272_DOC_01` |

---

## 4. QUY CÁCH DẬP DẤU THỊ GIÁC (CANVAS WATERMARK SPECIFICATION)

1. **Logo THACO – CREC (Góc Trên Bên Phải):**
   - **Nguồn ảnh:** Base64 Data URL nhúng sẵn (`logoThacoCrecBase64.ts`) kết hợp fallback đường dẫn tĩnh; đảm bảo **100% hoạt động offline, không bị lỗi CORS hoặc 404** ngay cả khi KSV khảo sát dưới hầm sâu B01-B03 mất sóng 4G/Wifi.
   - **Chiều rộng:** Bằng **25%** chiều rộng của ảnh chụp (`logoWidth = Math.round(canvas.width * 0.25)`), chuẩn theo tỷ lệ mẫu thực tế dự án Metro 2.
   - **Chiều cao:** Tự động co giãn theo tỷ lệ aspect ratio gốc của logo (`logoHeight = Math.round(logoWidth * (naturalHeight / naturalWidth))`).
   - **Khoảng cách mép:** Cách mép phải 2.5% chiều rộng ảnh, cách mép trên 2.5% chiều rộng ảnh.
   - **Hiệu ứng bảo vệ tương phản:** Đổ bóng mờ sáng nhẹ phía sau (`shadowColor = 'rgba(255, 255, 255, 0.75)'`) giúp logo màu xanh dương nổi bật rõ ràng trên cả nền ảnh tường sáng lẫn mặt đường/hầm tối.
2. **Khối Văn Bản (Góc Dưới Bên Phải):**
   - **Dòng 1:** Thời gian thực tiếng Việt (Ví dụ: `28 thg 9, 2026 15:26:23`).
   - **Dòng 2:** Mã định danh ảnh chuẩn hóa (Ví dụ: `HCM_M2.B00011CC_EXT_P04_01`).
   - **Định dạng văn bản:** Font Sans-serif bold (`font-weight: 700`), cỡ chữ ~ **2.2%** chiều rộng ảnh.
   - **Hiệu ứng chống chìm:** Đổ bóng đen `shadowColor = 'rgba(0, 0, 0, 0.9)'` và viền nét đen `strokeText` với chữ trắng tinh `#FFFFFF` phủ lên trên.
   - **Căn lề:** Căn phải (`textAlign = 'right'`), cách mép phải 3% chiều rộng ảnh, cách mép dưới 3% chiều cao ảnh.

---

## 5. ÁP DỤNG TRONG HỆ THỐNG PHẦN MỀM

- **Frontend:**
  - Thẻ `<img>`: Chứa `id={photoCode}`, `data-photo-code={photoCode}`, hiển thị badge mã định danh dưới ảnh preview.
  - Form State: Lưu trữ cặp `{ photoUrl, photoCode }`.
- **Backend:**
  - `survey.dto.ts`: Validate thuộc tính `photoCode`, `cuPhotoCode`, `ctxPhotoCode`.
  - `survey.repository.ts`: Lưu vào các cột chuyên biệt trong DB và bảo toàn toàn vẹn trong JSONB `survey_data_json`.
- **Báo cáo PDF:**
  - Template Handlebars nhúng mã `photoCode` vào nhãn chú thích dưới từng ảnh kiểm toán.
