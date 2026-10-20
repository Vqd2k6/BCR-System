# QUY CHUẨN ĐỊNH DANH MÃ TẦNG, MÃ CĂN HỘ, MÃ KHU VỰC VÀ ẢNH KHẢO SÁT HIỆN TRƯỜNG DỰ ÁN METRO 2

**Mã hiệu tiêu chuẩn:** `METRO2-BCS-CODING-STD-2026`  
**Dự án:** Tuyến Tàu điện ngầm số 2 TP.HCM (Bến Thành – Tham Lương)  
**Phạm vi áp dụng:** Gói thầu CP2 / Khảo sát hiện trạng công trình (Phase 1 & Phase 2 BCS Report)  
**Đơn vị ban hành & giám sát:** Ban Quản lý Đường sắt Đô thị (MAUR) – Liên danh CRLG-CRSRI-TT – THACO-CREC  

---

## 1. NGUYÊN TẮC THIẾT KẾ CỐT LÕI (CORE PRINCIPLES)

1. **Tính Pháp Lý Tối Thượng**:
   Mọi dữ liệu khảo sát hiện trạng nứt lún, nghiêng võng là **căn cứ pháp lý duy nhất** để đối chiếu bồi thường thiệt hại khi máy khoan hầm TBM đi qua khu dân cư. Mã định danh không được phép trùng lặp, không được phép thay đổi sau khi hồ sơ đã duyệt.
2. **Quản Lý Tầng Trực Tiếp Bằng Trường Dữ Liệu (`floor_code`)**:
   Hệ thống không sử dụng thuật toán phỏng đoán phức tạp. Khi Zone Admin thêm hoặc chỉnh sửa tầng trong CAD Studio, **hệ thống cung cấp trường dữ liệu trực tiếp `Mã tầng (Floor Code)`** (ví dụ: `MEZZ`, `SB`, `B01`, `G`, `F08`, `TECH`, `TUM`, `ROOF`...) để người dùng tự xác lập hoặc chọn từ danh mục chuẩn.
3. **Kế Thừa 100% Theo Cấu Trúc Cha - Con**:
   - Thửa đất / Tòa nhà mẹ (`BuildingMaster`) mang mã `[ZONE]-[LOẠI]-[STT]` (VD: `C&C-05-B-0039` hoặc `B-0039`).
   - Căn hộ con (`BuildingUnit`) kế thừa toàn bộ móng, hầm, toạ độ GIS, độ nghiêng khối nhà từ tòa mẹ.
   - Vết nứt và ảnh chụp kế thừa mã căn hộ / mã khu vực dùng chung làm tiền tố.

---

## 2. BẢNG QUY ƯỚC MÃ TẦNG ĐẦY ĐỦ NGOÀI THỰC TẾ (FLOOR NOMENCLATURE)

Quy chuẩn bao phủ 100% các loại hình công trình thực tế tại Việt Nam theo **TCVN 9411:2012**, **QCVN 04:2021/BXD**, **QCVN 06:2022/BXD**:

| STT | Loại Tầng Thực Tế | Ký Hiệu Mã Tầng (`floor_code`) | Số Tầng Kỹ Thuật (`floor_number`) | Mã Căn Hộ Con (`unit_code`) | Mã Khu Vực Dùng Chung (`master_area_code`) | Ý Nghĩa Kỹ Thuật & Căn Cứ Báo Cáo BCS |
|:---:|---|---|---|---|---|---|
| **1** | **Tầng Hầm Sâu (B3, B4...)** | `B03`, `B04`... | `-3`, `-4` | N/A (hoặc kho tư nhân) | `TB03.01`, `TB03.02` | Hầm kỹ thuật cơ điện, bể ngầm, cự ly gần tim hầm khiên đào TBM nhất. |
| **2** | **Tầng Hầm Tiêu Chuẩn** | `B01`, `B02` | `-1`, `-2` | N/A | `TB01.01`, `TB02.01` | Hầm đỗ xe ô tô/xe máy, trạm sạc, phòng kỹ thuật tòa nhà. |
| **3** | **Tầng Bán Hầm** | `SB` *(Semi-Basement)* | `-0.5` | N/A (hoặc `SB.01`) | `TSB.01`, `TSB.02` | Sàn nằm 1/2 nổi trên mặt đất, 1/2 chìm. Thường làm bãi xe hoặc thương mại dịch vụ. |
| **4** | **Tầng Trệt / Sảnh Đón** | `G` *(hoặc `F00`)* | `0` | `G.01`, `G.02` (hoặc `SH.01`) | `TG.01`, `TG.02` | Sảnh đón lễ tân, Shophouse khối đế, phòng BQL, phòng sinh hoạt cộng đồng. |
| **5** | **Tầng Lửng Trệt (Mezzanine)** | `MEZZ` *(hoặc `TL`)* | `0.5` | `MEZZ.01`, `MEZZ.02` | `TMEZZ.01`, `TMEZZ.02` | Sàn lửng đúc hoặc sàn lửng thép của tầng trệt. Rất phổ biến ở nhà phố và shophouse khối đế. |
| **6** | **Tầng Lửng Của Lầu Nổi** | `M01`, `M02`... | `1.5`, `2.5` | `M01.01`, `M01.02` | `TM01.01`, `TM02.01` | Tầng lửng trung gian giữa Lầu 1 và Lầu 2 (thường gặp ở khối thương mại / rạp chiếu phim). |
| **7** | **Tầng Lầu Nổi Tiêu Chuẩn** | `F01`, `F02` ... `F99` | `1`, `2` ... `99` | `01.01`, `02.01` ... `08.02` | `T01.01`, `T08.01` | Căn hộ ở cư dân tiêu chuẩn, hành lang chung, sảnh thang máy từng tầng. |
| **8** | **Tầng Kỹ Thuật (MEP)** | `TECH` *(hoặc `KT`)* | Số nguyên (VD `12`) | N/A | `TKT.01`, `TTECH.01` | Tầng bố trí máy phát điện, trạm biến áp, quạt thông gió, chiller làm lạnh. |
| **9** | **Tầng Lánh Nạn (Refuge)** | `REF` *(hoặc `LN`)* | Số nguyên (VD `20`) | N/A | `TREF.01`, `TLN.01` | Gian lánh nạn bắt buộc theo QCVN 06:2022 cho chung cư trên 100m. |
| **10** | **Căn Hộ Penthouse / Duplex** | `PH`, `DP` | Tầng cao nhất (VD `25`) | `PH.01`, `DP.01` | `TPH.01` | Căn hộ thông tầng hoặc căn hộ áp mái cao cấp sở hữu riêng. |
| **11** | **Tầng Áp Mái / Tum** | `TUM` | Số tầng đỉnh tháp | `TUM.01` (nếu có) | `TTUM.01`, `TTUM.02` | Tum che buồng thang máy, phòng giặt, phòng kỹ thuật thang máy. |
| **12** | **Sân Thượng** | `TERRACE` *(hoặc `ST`)* | Số tầng đỉnh tháp | N/A | `TST.01`, `TST.02` | Sân thượng lộ thiên dùng chung cư dân, vườn trên mái. |
| **13** | **Tầng Mái** | `ROOF` | Số tầng đỉnh tháp | N/A | `TROOF.01`, `TROOF.02` | Sàn mái bê tông, bồn nước mái, hệ thống chống sét, sàn đỗ trực thăng (Helipad). |

---

## 3. CÚ PHÁP MÃ CĂN HỘ CON & KHU VỰC DÙNG CHUNG

### 3.1. Căn hộ con sở hữu riêng (Unit):
Cú pháp: `[MÃ_TẦNG].[SỐ_CĂN]`
* Tầng nổi tiêu chuẩn: `08.01`, `08.02`, `12.05`
* Tầng lửng trệt: `MEZZ.01`, `MEZZ.02`
* Tầng lửng lầu 1: `M01.01`, `M01.02`
* Tầng trệt: `G.01`, `G.02` (hoặc `SH.01` cho Shophouse)
* Penthouse: `PH.01`, `PH.02`

### 3.2. Khu vực dùng chung của khối tháp (Master Area):
Cú pháp: `T[MÃ_TẦNG].[SỐ_THỨ_TỰ]`
* Tầng hầm 1: `TB01.01` (Bãi xe máy), `TB01.02` (Bãi xe ô tô)
* Tầng bán hầm: `TSB.01` (Bãi xe bán hầm)
* Tầng trệt: `TG.01` (Sảnh đón tòa nhà), `TG.02` (Phòng sinh hoạt cộng đồng)
* Tầng lửng: `TMEZZ.01` (Sảnh chung tầng lửng)
* Tầng kỹ thuật: `TKT.01` (Phòng máy phát điện), `TKT.02` (Phòng bơm tăng áp)
* Tầng lánh nạn: `TLN.01` (Gian lánh nạn thoát hiểm)
* Tầng mái: `TROOF.01` (Sàn mái bê tông), `TROOF.02` (Khu bồn nước mái)

### 3.3. Nguyên Tắc Phân Tách: Lưu Trữ Ngầm (Storage) vs. Hiển Thị Giao Diện (Display):
Nhằm giải quyết triệt để vấn đề nhãn tên căn/thửa quá dài gây tràn ô hoặc lấn sang căn/thửa liền kề trên màn hình Surveyor:
1. **Tầng Lưu Trữ Ngầm (CSDL & Báo Cáo BCS Pháp Lý):**
   - Lưu trữ 100% cấu trúc mã chuẩn: `floor_code = 'F08'`, `unit_code = '08.01'`, `photo_code = 'HCM_M2.B0039_08.01_Z01_D01_CU_01'`.
   - Toàn bộ việc sinh mã diễn ra tự động ngầm dưới hệ thống khi tạo tầng / vẽ ô.
2. **Tầng Hiển Thị Trực Quan (Giao Diện Surveyor & CAD Canvas):**
   - Chỉ hiển thị nhãn số ngắn gọn lọt lòng trong ô: **`01`**, **`02`**, **`03`** (đối với căn hộ) hoặc **`M01`**, **`M02`** (đối với khu master).
   - Áp dụng bất biến CSS rào chắn chống tràn: `overflow: hidden`, `text-overflow: ellipsis`, `max-width: 100%`, `white-space: nowrap`. Tuyệt đối không cho phép chữ tràn ra ngoài viền ô hoặc che khuất ô bên cạnh.
   - Mã chuẩn đầy đủ luôn sẵn sàng ở tooltip (`title`) khi di chuột hoặc xem chi tiết.

---

## 4. QUY CHUẨN ĐỊNH DANH ẢNH HIỆN TRƯỜNG (PHOTO CODING MATRIX)

Cấu trúc định danh ảnh theo chuẩn `METRO2-BCS-PHOTO-STD-2026`:

$$\mathbf{HCM\_M2. [MÃ\_CÔNG\_TRÌNH] \_ [VỊ\_TRÍ\_TẦNG / MÃ\_CĂN] \_ [MÃ\_VÙNG] \_ [MÃ\_NỨT] \_ [LOẠI\_ẢNH] \_ [STT]}$$

```
                ┌─── Tiền tố Dự án Metro Tuyến số 2 TP.HCM cố định
                │
                │       ┌─── Mã thửa đất (B05272)
                │       │
                │       │        ┌─── Vị trí tầng (MEZZ, B01, F03, ROOF) hoặc Mã Căn (08.02)
                │       │        │
                │       │        │     ┌─── Vùng khuyết tật (Z02) hoặc Cột/Dầm (C01, B02)
                │       │        │     │
                │       │        │     │     ┌─── Mã vết nứt trong sổ khuyết tật (D01, D02)
                │       │        │     │     │
                │       │        │     │     │     ┌─── Loại ảnh: CTX, CU, P01, P04, OVERVIEW
                │       │        │     │     │     │
                │       │        │     │     │     │     ┌─── Số thứ tự ảnh cùng vị trí (_01, _02)
                ▼       ▼        ▼     ▼     ▼     ▼     ▼
        HCM_M2. B05272 _ MEZZ.01 _ Z01 _ D01 _ CU _ 01
```

### Bảng Ánh Xạ Ảnh Tự Động Đổ Vào Biểu Mẫu Báo Cáo BCS Phase 1:

| Loại Ảnh Hiện Trường | Cú Pháp Mã Ảnh Chuẩn | Vị Trí Tự Động Đổ Trong Báo Cáo | Quy Cách Kỹ Thuật |
|---|---|---|---|
| **Ảnh P-01 Biển số nhà / Số phòng** | `HCM_M2.B0039_01.01_P01_01` | Báo cáo Căn hộ con: Mục Nhận dạng | Chiếm trọn 100% khung hiển thị |
| **Ảnh P-02 Mặt đứng toàn cảnh** | `HCM_M2.B0039_EXT_P02_01` | Báo cáo Master: Mục 1.2 Ngoại thất | Góc chụp bao quát chiều cao khối tháp |
| **Ảnh P-03 Mặt bên hẻm hông** | `HCM_M2.B0039_EXT_P03_01` | Báo cáo Master: Mục 1.2 Ngoại thất | Khe lún hoặc ranh tiếp giáp nhà lân cận |
| **Ảnh P-04 Lộ giới vỉa hè** | `HCM_M2.B0039_EXT_P04_01` | Báo cáo Master: Mục 1.2 Ngoại thất | Hiện trạng mặt đường vỉa hè tiếp giáp |
| **Ảnh Mặt bằng CAD có ghim pin** | `HCM_M2.B0039_F01_CAD_ARCH_01` | Phụ lục C: Damage Mapping | Bản vẽ CAD tầng kèm các ghim Z, E, D |
| **Ảnh Bối Cảnh Khuyết Tật (Context)** | `HCM_M2.B0039_01.01_Z01_D01_CTX_01` | Phụ lục D: Cặp ảnh đối chiếu (Bên trái) | Toàn cảnh mảng tường / cấu kiện nứt |
| **Ảnh Cận Cảnh Có Thước Đo (Close-Up)** | `HCM_M2.B0039_01.01_Z01_D01_CU_01` | Phụ lục D: Cặp ảnh đối chiếu (Bên phải) | **BẮT BUỘC có thước đo nứt (Crack gauge)** |

---

## 5. THIẾT KẾ THEO HỢP ĐỒNG (PRECONDITIONS, POSTCONDITIONS & INVARIANTS)

Tuân thủ nghiêm ngặt **Workflow 0** của `.agents/rules/system_workflows.md`:

### 5.1. Preconditions (Tiền Điều Kiện)
1. **Phân Quyền RBAC**:
   - Thao tác thêm tầng, sửa mã tầng, upload CAD, vẽ phân vùng: Chỉ cấp quyền cho `Super Admin` và `Zone Admin`.
   - Cán bộ hiện trường (`Surveyor`) chỉ mở ở chế độ xem tĩnh `readOnly = true`.
2. **Trạng Thái Thửa Đất / Tòa Nhà Mẹ**:
   - Bản ghi thửa đất trong `parcels` phải ở trạng thái kích hoạt (`deleted_at IS NULL`).
   - Tầng thao tác không nằm trong mảng `deleted_floors`.
3. **Tính Hợp Lệ Của Tệp CAD/PDF**:
   - Định dạng chấp nhận: `application/pdf`, `image/png`, `image/jpeg`, `image/webp`, `image/svg+xml`.
   - Dung lượng tệp $\le 50\text{MB}$.
   - Độ phân giải ảnh trích xuất từ PDF: Chiều rộng tối thiểu $1200\text{px}$, tỷ lệ khung hình bảo toàn.
4. **Giới Hạn Tọa Độ Chuẩn Hóa**:
   - Mọi bounding box và polygon phân vùng phải thỏa mãn:
     $$0.00 \le x_1 < x_2 \le 100.00\%, \quad 0.00 \le y_1 < y_2 \le 100.00\%$$

### 5.2. Postconditions (Hậu Điều Kiện)
1. **Happy Path (Thành Công)**:
   - Bản ghi trong bảng `building_floor_plans` được cập nhật/thêm mới với đầy đủ: `floor_number`, `floor_name`, `floor_code`, `cad_photo_url`, `scope`, `area_type`.
   - Các căn hộ con và khu vực master trong `building_units` nhận mã `unit_code` chuẩn hóa theo tiền tố `floor_code`.
   - Ảnh chụp hiện trường tự động nhận mã Photo ID chuẩn `HCM_M2.[PARCEL]_[FLOOR/UNIT]_[ZONE]_[DEFECT]_[TYPE]_[INDEX]`.
   - Động cơ xuất báo cáo PDF (Puppeteer + Handlebars) lọc đúng ảnh theo mã và đổ đúng vào các bảng biểu Phụ lục C và Phụ lục D.
2. **Error Path (Xử Lý Sự Cố)**:
   - Tệp lỗi hoặc không đúng định dạng: Từ chối ngay lập tức tại Client/Gateway kèm thông báo lỗi tiếng Việt; không ghi vào CSDL.
   - Lỗi cơ sở dữ liệu: Database Transaction thực hiện `ROLLBACK 100%`, không sinh bản ghi mồ côi (orphan records).
   - Ngoại lệ bắt buộc được in ra Console qua `console.error('[CAD_STUDIO_COORDS_OR_MAPPER] ...', err)` trước khi hiển thị Toast.
   - Form dữ liệu nháp của các tầng khác trên Zustand store được bảo toàn.

### 5.3. Invariants & Safety Constraints (Ràng Buộc Bất Biến)
1. **Bất Biến Tọa Độ Tỷ Lệ Phần Trăm (Normalized Invariance)**:
   - Tọa độ $x_{\text{norm}}, y_{\text{norm}} \in [0, 100\%]$ độc lập hoàn toàn với mức độ zoom canvas ($S$), độ trượt pan ($P_x, P_y$), độ phân giải màn hình thiết bị và tỷ lệ in ấn A4.
2. **Bảo Vệ Cơ Sở Dữ Liệu Tuyệt Đối (Zero Hard-Delete)**:
   - Cấm hoàn toàn câu lệnh `DELETE FROM parcels` hoặc `DELETE FROM building_units`. Chỉ sử dụng cơ chế Soft-delete (`deleted_at IS NULL`) hoặc mảng `deleted_floors`.
3. **Bất Biến Hồ Sơ Đã Duyệt (Immutability)**:
   - Tầng hoặc căn hộ đã có hồ sơ khảo sát ở trạng thái `SUBMITTED` hoặc `APPROVED` bị khóa cứng: cấm xóa tầng, cấm đổi mã căn hộ.
4. **Kỷ Luật TypeScript Không Khoan Nhượng (Zero Any Mandate)**:
   - Tuyệt đối không dùng `any` hoặc `as any` trên toàn bộ codebase.

---

## 6. DANH MỤC TEST CASES KIỂM CHUẨN (TC-01 ĐẾN TC-06)

* **TC-01: Kiểm thử Tầng Lửng (Mezzanine)**:
  - Input: `floor_name = "Tầng Lửng"`, `floor_code = "MEZZ"`.
  - Expected: Các ô căn hộ sinh mã: `MEZZ.01`, `MEZZ.02`. Ảnh cửa phòng sinh mã: `HCM_M2.B0039_MEZZ.01_P01_01`.
* **TC-02: Kiểm thử Tầng Bán Hầm & Đa Tầng Hầm (Semi-Basement & Basements)**:
  - Input: `floor_name = "Tầng Bán Hầm"`, `floor_code = "SB"`.
  - Expected: Khu vực master sinh mã: `TSB.01` (Bãi đỗ xe bán hầm). Vết nứt dầm sinh Photo ID: `HCM_M2.B0039_TSB.01_Z01_D01_CU_01`.
* **TC-03: Kiểm thử Tầng Kỹ Thuật (MEP) & Tầng Lánh Nạn (Refuge)**:
  - Input: `floor_name = "Tầng Kỹ Thuật Điện"`, `floor_code = "TECH"`.
  - Expected: Mã khu vực master: `TKT.01`. Scope tự động khóa ở `MASTER` (màu hổ phách).
* **TC-04: Kiểm thử Tầng Tum, Sân Thượng & Tầng Mái**:
  - Input: `floor_name = "Sàn Mái Tòa Tháp"`, `floor_code = "ROOF"`.
  - Expected: Mã khu vực master: `TROOF.01`. Ảnh nứt sàn mái: `HCM_M2.B0039_TROOF.01_Z01_D01_CU_01`.
* **TC-05: Kiểm thử Tính Bất Biến Toạ Độ Khi Zoom / Pan / Xuất Báo Cáo PDF A4**:
  - Input: Bản vẽ CAD độ phân giải $4000 \times 3000\text{px}$. Vẽ ô căn hộ tại $x=15.250\%, y=22.800\%$.
  - Thao tác: Zoom lên 3.5x, Pan sang vị trí khác, thu nhỏ cửa sổ về iPhone 375px, render PDF A4 ($210 \times 297\text{mm}$).
  - Expected: Sai số vị trí vật lý trên bản in giấy: $\Delta = 0.00\text{mm}$.
* **TC-06: Kiểm thử Động Cơ Báo Cáo Tự Động & Ánh Xạ Photo ID (E2E ViewModel)**:
  - Input: Tòa tháp `B-0039` gồm hồ sơ tầng lửng `MEZZ.01` và tầng hầm `TB01.01`.
  - Expected: Báo cáo PDF xuất ra tự động nhận diện đúng cặp ảnh `CTX` và `CU` có thước đo nứt đổ vào Phụ lục D mà không bị thiếu sót dữ liệu.
