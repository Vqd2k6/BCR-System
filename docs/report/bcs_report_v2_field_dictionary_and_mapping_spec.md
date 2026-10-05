# BỘ QUY CHUẨN TỪ ĐIỂN DỮ LIỆU & RÀNG BUỘC SONG NGỮ (BCS REPORT V2)
## FIELD DICTIONARY & BILINGUAL MAPPING SPECIFICATION

> **Dự án:** Tuyến Tàu điện ngầm số 2 TP.HCM (Bến Thành – Tham Lương) – Hợp đồng EPC THACO–CREC  
> **Tiêu chuẩn kiểm thử:** Hồ sơ Báo cáo Khảo sát Hiện trạng Giai đoạn 1 (Phase 1 BCS Report) – **Liên danh CRLG – CRSRI – TT**  
> **Văn bản pháp lý nền tảng:** [`docs/DB_GIS.md`](file:///Users/vqd2k6/Desktop/MIT-techology/KSat_QHoach/docs/DB_GIS.md) & [`docs/report/report_v2_architecture_blueprint.md`](file:///Users/vqd2k6/Desktop/MIT-techology/KSat_QHoach/docs/report/report_v2_architecture_blueprint.md)  
> **Mục đích:** Quy định chặt chẽ toàn bộ các giá trị hợp lệ, thuật ngữ song ngữ kỹ thuật (Tiếng Việt – Tiếng Anh), công thức tính toán và ràng buộc dữ liệu đầu vào. **Nghiêm cấm tự ý bịa từ ngữ, dùng sai thuật ngữ chuyên ngành xây dựng ngầm hoặc để khuyết thiếu song ngữ trong báo cáo.**

---

## 1. QUY CHUẨN ĐỊNH DANH HỒ SƠ & MÃ BÁO CÁO (IDENTIFIERS)

| STT | Tên Trường | Thuật Ngữ Tiếng Anh | Cấu Trúc / Quy Tắc Tạo Mã | Ví Dụ Cụ Thể | Ghi Chú |
|:---:|:---|:---|:---|:---|:---|
| 1 | **Doc.No / Số hiệu báo cáo** | Document No. / Report No. | `R-{seq5}-{segmentType}-({stationCode})-R{rev2}` | `R-00054-C&C-(ST05)-R00` | Đồng nhất 100% giữa Running Header và Mục I |
| 2 | **Mã công trình** | Building ID | `B-{seq5}-{segmentType} ({stationCode})` | `B-00054-C&C (ST05)` | Định danh tòa nhà trên bình đồ GIS |
| 3 | **Mã khảo sát** | Survey ID | `P-{hex4}` (4 ký tự đầu UUID) | `P-2BA5` | Khóa chính phiên khảo sát |
| 4 | **Mã địa chính** | Cadastral Code | 12 chữ số mã SQHKT / Địa chính | `271330130338` | Số thửa 338, Tờ bản đồ 13 |
| 5 | **Số lưu chiểu** | Filing No. | `Số: {seq5}/BCS-P1/CRLG-{year}` | `Số: 00054/BCS-P1/CRLG-2026` | Quản lý văn thư lưu trữ |
| 6 | **Phiên bản** | Revision | 2 chữ số: `00`, `01`, `02` | `00` (Gốc) | Tăng khi có cập nhật sau phúc tra |

---

## 2. BẢNG QUY ĐỊNH 22 PHÂN ĐOẠN TUYẾN (METRO SEGMENTS / ZONES)

Trích xuất trực tiếp từ bảng cơ sở dữ liệu PostGIS `metro_segments`:

| Zone ID | Tên Đoạn Tuyến (Tiếng Việt) | Section / Zone (Tiếng Anh) | Loại Thi Công | Lý Trình Bắt Đầu | Lý Trình Kết Thúc |
|:---:|:---|:---|:---:|:---:|:---:|
| `ZONE_01` | Zone 1: Ga S1 Bến Thành (C&C) | Zone 1: S1 Ben Thanh Station (C&C) | `C&C` | Km 0+000 | Km 0+350 |
| `ZONE_02` | Zone 2: Hầm TBM Bến Thành $\to$ Tao Đàn (POR) | Zone 2: TBM Tunnel Ben Thanh to Tao Dan (POR) | `POR` | Km 0+350 | Km 1+035 |
| `ZONE_03` | Zone 3: Ga S2 Tao Đàn (C&C) | Zone 3: S2 Tao Dan Station (C&C) | `C&C` | Km 1+035 | Km 1+250 |
| `ZONE_04` | Zone 4: Hầm TBM Tao Đàn $\to$ Dân Chủ (POR) | Zone 4: TBM Tunnel Tao Dan to Dan Chu (POR) | `POR` | Km 1+250 | Km 2+000 |
| `ZONE_05` | Zone 5: Ga S3 Dân Chủ (C&C) | Zone 5: S3 Dan Chu Station (C&C) | `C&C` | Km 2+000 | Km 2+200 |
| `ZONE_06` | Zone 6: Hầm TBM Dân Chủ $\to$ Hòa Hưng (POR) | Zone 6: TBM Tunnel Dan Chu to Hoa Hung (POR) | `POR` | Km 2+200 | Km 3+078 |
| `ZONE_07` | Zone 7: Ga S4 Hòa Hưng (C&C) | Zone 7: S4 Hoa Hung Station (C&C) | `C&C` | Km 3+078 | Km 3+280 |
| `ZONE_08` | Zone 8: Hầm TBM Hòa Hưng $\to$ Lê Thị Riêng (POR) | Zone 8: TBM Tunnel Hoa Hung to Le Thi Rieng (POR) | `POR` | Km 3+280 | Km 4+090 |
| `ZONE_09` | Zone 9: Ga S5 Lê Thị Riêng (C&C) | Zone 9: S5 Le Thi Rieng Station (C&C) | `C&C` | Km 4+090 | Km 4+300 |
| `ZONE_10` | Zone 10: Hầm TBM Lê Thị Riêng $\to$ Phạm Văn Hai (POR) | Zone 10: TBM Tunnel Le Thi Rieng to Pham Van Hai (POR) | `POR` | Km 4+300 | Km 4+808 |
| `ZONE_11` | Zone 11: Ga S6 Phạm Văn Hai (C&C) | Zone 11: S6 Pham Van Hai Station (C&C) | `C&C` | Km 4+808 | Km 5+010 |
| `ZONE_12` | Zone 12: Hầm TBM Phạm Văn Hai $\to$ Bảy Hiền (POR) | Zone 12: TBM Tunnel Pham Van Hai to Bay Hien (POR) | `POR` | Km 5+010 | Km 5+500 |
| `ZONE_13` | Zone 13: Ga S7 Bảy Hiền (C&C) | Zone 13: S7 Bay Hien Station (C&C) | `C&C` | Km 5+500 | Km 5+750 |
| `ZONE_14` | Zone 14: Hầm TBM Bảy Hiền $\to$ Nguyễn Hồng Đào (POR) | Zone 14: TBM Tunnel Bay Hien to Nguyen Hong Dao (POR) | `POR` | Km 5+750 | Km 6+700 |
| `ZONE_15` | Zone 15: Ga S8 Nguyễn Hồng Đào (C&C) | Zone 15: S8 Nguyen Hong Dao Station (C&C) | `C&C` | Km 6+700 | Km 6+910 |
| `ZONE_16` | Zone 16: Hầm TBM Nguyễn Hồng Đào $\to$ Bà Quẹo (POR) | Zone 16: TBM Tunnel Nguyen Hong Dao to Ba Queo (POR) | `POR` | Km 6+910 | Km 7+900 |
| `ZONE_17` | Zone 17: Ga S9 Bà Quẹo (C&C) | Zone 17: S9 Ba Queo Station (C&C) | `C&C` | Km 7+900 | Km 8+120 |
| `ZONE_18` | Zone 18: Hầm TBM Bà Quẹo $\to$ Phạm Văn Bạch (POR) | Zone 18: TBM Tunnel Ba Queo to Pham Van Bach (POR) | `POR` | Km 8+120 | Km 9+050 |
| `ZONE_19` | Zone 19: Ga S10 Phạm Văn Bạch (C&C) | Zone 19: S10 Pham Van Bach Station (C&C) | `C&C` | Km 9+050 | Km 9+260 |
| `ZONE_20` | Zone 20: Hầm TBM & Portal S10 $\to$ S11 (POR) | Zone 20: TBM Tunnel & Portal S10 to S11 (POR) | `POR` | Km 9+260 | Km 10+100 |
| `ZONE_21` | Zone 21: Ga S11 Tân Bình (C&C) | Zone 21: S11 Tan Binh Station (C&C) | `C&C` | Km 10+100 | Km 10+320 |
| `ZONE_22` | Zone 22: Depot Tham Lương (DEP) | Zone 22: Tham Luong Depot (DEP) | `DEP` | Km 10+320 | Km 11+040 |

---

## 3. BẢNG QUY ĐỊNH 4 HẠNG MỤC METRO LIÊN QUAN (CONSTRUCTION TYPES)

Ràng buộc chặt theo ENUM PostGIS `metro_construction_type_enum`:

| Mã ENUM | Tên Tiếng Việt | Tên Tiếng Anh | Định Nghĩa Kỹ Thuật Dự Án Metro 2 |
|:---:|:---|:---|:---|
| **`C&C`** | **Đào hở (Cut-and-Cover)** | **Cut-and-Cover** | Áp dụng cho các nhà ga ngầm (S1 đến S11), giếng thông gió và đoạn hố đào chuyển tiếp bằng tường vây D-wall. |
| **`POR`** | **Hầm khoan ngầm / Cửa hầm (Bored / Portal)** | **Bored / Underground / Portal** | Áp dụng cho các đoạn tuyến hầm tròn thi công bằng khiên đào TBM (đường kính ngoài $D=6.6\text{m}$) và giếng phóng/tiếp nhận. |
| **`ELV`** | **Cầu cạn trên cao (Elevated)** | **Elevated Viaduct** | Áp dụng cho đoạn cầu cạn chuyển tiếp từ hầm lên mặt đất trước khi vào Depot. |
| **`DEP`** | **Khu Depot (Depot)** | **Depot Area** | Áp dụng cho toàn bộ khu bảo dưỡng kỹ thuật, xưởng sửa chữa đầu máy toa xe Tham Lương. |

---

## 4. TỪ ĐIỂN SONG NGỮ MỤC I: THÔNG TIN CHUNG (SECTION I)

| Trường Dữ Liệu | Tiêu Đề Tiếng Việt | Tiêu Đề Tiếng Anh | Quy Tắc Lấy Dữ Liệu / Thuật Ngữ Chuẩn Hóa |
|:---|:---|:---|:---|
| `projectTitle` | Dự án | Project | Vi: *Tuyến Metro Số 2 TPHCM (Bến Thành - Tham Lương)*<br>En: *Ho Chi Minh City Mass Rapid Transit Line 2, Ben Thanh – Tham Luong Route* |
| `buildingId` | Mã công trình | Building ID | Chuỗi chuẩn hóa: `B-00054-C&C (ST05)` |
| `surveyId` | Mã khảo sát (*) | Survey ID | Chuỗi chuẩn hóa: `P-2BA5` |
| `reportNo` | Số hiệu báo cáo (*) | Report No. | Chuỗi chuẩn hóa: `R-00054-C&C-(ST05)-R00` |
| `buildingName` | Tên công trình | Building Name | Vi: `Nhà ở gia đình` $\to$ En: `Private Residential Townhouse`<br>Vi: `Nhà ở kết hợp kinh doanh` $\to$ En: `Shophouse / Mixed-use Townhouse`<br>Vi: `Tòa nhà văn phòng` $\to$ En: `Commercial Office Building` |
| `address` | Địa chỉ | Address | Vi: `Số ... Đường ..., P. ..., Q. ..., TP.HCM, Việt Nam`<br>En: `No. ... St., Ward ..., Dist. ..., HCMC, Viet Nam` |
| `cadastralCode` | Mã địa chính (*) | Cadastral Code | 12 chữ số theo bản đồ địa chính |
| `ownerOccupant` | Chủ sở hữu / Người sử dụng | Owner-Occupant | Vi: `Chủ hộ thửa {sothua} (Tờ {soto})`<br>En: `Property Owner of Plot {sothua} (Sheet {soto})`<br>Hoặc tên thật nếu có: `Ông/Bà ...` $\to$ `Mr./Ms. ...` |
| `contactPhone` | Số điện thoại liên hệ (*) | Contact phone | Chuỗi số điện thoại hoặc `Chưa ghi nhận` / `Not recorded` |
| `surveyConsultant` | Đơn vị khảo sát | Survey Consultant | Vi: *Liên danh CRLG – CRSRI – TT*<br>En: *CRLG – CRSRI – TT Joint Venture* |
| `epcContractor` | Nhà thầu EPC (*) | EPC Contractor | `THACO - CREC` |
| `sectionZone` | Đoạn tuyến / Khu vực (*) | Section / Zone | Tra cứu tự động từ Bảng 2. Ví dụ:<br>Vi: `Zone 9: Ga S5 Lê Thị Riêng (C&C) [Lý trình: Km 4+090 – Km 4+300]`<br>En: `Zone 9: S5 Le Thi Rieng Station (C&C) [Chainage: Km 4+090 – Km 4+300]` |
| `relatedMetroWorks` | Hạng mục Metro liên quan (*) | Related Metro works | 4 Checkbox song ngữ: `C&C`, `POR`, `ELV`, `DEP` |
| `gpsCoords` | Tọa độ GPS (*) | GPS Coordinates | Tọa độ WGS84: `Lat, Lng` (lấy 6 chữ số thập phân) |
| `surveyDate` | Ngày khảo sát | Survey Date | **Thời gian thực tế lúc KSV khảo sát**: `DD/MM/YYYY` hoặc `DD/MM/YYYY (HH:mm)`. **Tuyệt đối không dùng thời gian hiện tại của máy tính**. |

---

## 5. TỪ ĐIỂN SONG NGỮ MỤC II: THÔNG TIN CƠ BẢN VỀ TÒA NHÀ (SECTION II)

| Trường Dữ Liệu | Tiêu Đề Tiếng Việt | Tiêu Đề Tiếng Anh | Quy Tắc Tính Toán & Thuật Ngữ Chuẩn Hóa |
|:---|:---|:---|:---|
| `use` | Công năng sử dụng | Building Use | Khớp với `buildingName`: Vi: *Nhà ở gia đình* / En: *Private Residential Townhouse* |
| `storeysDisplay` | Số tầng | Storeys | Vi: `Nổi: {n} tầng; Hầm: {m}`<br>En: `Above ground: {n} storeys; Basement: {m}` |
| `floorAreaM2` & `footprintM2` | Diện tích sàn (m²) | Total floor area (m²) | **Quy chuẩn 3 chỉ số diện tích:**<br>1. *Diện tích đất ban đầu:* $S_{\text{đất}} = \text{parcels.land\_area\_m2}$<br>2. *Diện tích xây dựng tầng trệt:* $S_{\text{xd}} = \text{specs.construction\_area\_m2}$ (khảo sát viên đo)<br>3. *Tổng diện tích sàn:* $S_{\text{sàn}} = S_{\text{xd}} \times \text{Số tầng nổi}$<br>**Hiển thị:**<br>Vi: `Tổng diện tích sàn: {S_san} m² (Diện tích đất: {S_dat} m² \| Diện tích xây dựng tầng trệt: {S_xd} m²)`<br>En: `Total floor area: {S_san} m² (Land plot: {S_dat} m² \| Ground floor footprint: {S_xd} m²)` |
| `mainDimensions` | Kích thước chính | Main dimensions | **Trích xuất từ đa giác ranh thửa đất ban đầu** (`ST_OrientedEnvelope`):<br>- Chiều rộng mặt tiền $W = \min(side_a, side_b)$<br>- Chiều sâu $L = \max(side_a, side_b)$<br>- Chiều cao công trình $H = \text{building\_height\_m}$<br>**Hiển thị:**<br>Vi: `Mặt tiền {W} m × Chiều sâu {L} m (Chiều cao: {H} m)`<br>En: `Width {W} m × Length {L} m (Height: {H} m)` |
| `maxHeightM` & `typicalStoreyHeightM` | Chiều cao (m) | Height (m) | Vi: `Cao nhất: {H} m \| Tầng điển hình: {h_dienhinh} m`<br>En: `Max height: {H} m \| Typical storey: {h_dienhinh} m` |
| `yearConstructed` | Năm xây dựng | Year constructed | Vi: `{YYYY} (Ước tính / Xác thực)`<br>En: `{YYYY} (Estimated / Verified)` |
| `distanceToMetroAlignmentM` | Khoảng cách đến Metro (m) | Distance to Metro works (m) | **2 khoảng cách kỹ thuật:**<br>1. *Tim tuyến:* $D_{\text{tim}} = \text{ST\_Distance(footprint, centerline)}$<br>2. *Biên hố đào/kết cấu:* $D_{\text{bien}} = \max(0, D_{\text{tim}} - 15.0\text{m})$<br>**Hiển thị:**<br>Vi: `Tim tuyến: {D_tim} m \| Biên kết cấu: {D_bien} m`<br>En: `To alignment centerline: {D_tim} m \| To excavation boundary: {D_bien} m` |
| `clearanceOffsetM` | Khoảng cách tĩnh không (*) | Clearance (m) | **Tính theo cao độ đỉnh hầm âm 25.0 m:**<br>- *Độ sâu đỉnh hầm Metro:* $Z_{\text{metro}} = -25.0\text{ m}$<br>- *Độ sâu đáy móng công trình:* $D_{\text{móng}}$ (mặc định $3.0\text{m}$ với móng nông, $15\text{m}$ với cọc)<br>- *Tĩnh không đứng:* $\Delta Z = 25.0 - D_{\text{móng}}$ (ví dụ $25 - 3 = 22.0\text{ m}$)<br>- *Tĩnh không không gian 3D:* $D_{3D} = \sqrt{D_{\text{tim}}^2 + \Delta Z^2}$<br>**Hiển thị:**<br>Vi: `Tĩnh không đứng: {dZ} m (Đỉnh hầm: -25.0 m, Đáy móng: -{D_mong} m) \| Tĩnh không 3D: {D_3D} m`<br>En: `Vertical clearance: {dZ} m (Tunnel depth: -25.0 m, Foundation: -{D_mong} m) \| 3D clearance: {D_3D} m` |
| `surveyCategory` | Nhóm đối tượng khảo sát (*) | Survey category | Vi: *Công trình thông thường – Khảo sát bình thường (từ móng đến mái)*<br>En: *General building – Normal survey (from foundation to roof)* |

---

## 6. TỪ ĐIỂN SONG NGỮ MỤC III: LỊCH SỬ VÀ TÌNH TRẠNG SỬ DỤNG (SECTION III)

> ⚠️ **LƯU Ý NGHIỆP VỤ QUAN TRỌNG:**  
> - **Biểu mẫu khảo sát Phase 1 KHÔNG CÓ trường "Hoạt động liên tục 24/7"**. Trường này đã bị loại bỏ hoàn toàn khỏi Bảng Mục III để tránh bịa đặt thông tin.  
> - Tất cả các chỉ số lịch sử được trích xuất trực tiếp từ Bước 2.2 (`historyInterview` trong `survey_data_json` và bảng `historical_sensitivities`).

| Khóa Trường | Giá trị Đầu Vào (DB / Form KSV) | Tiếng Việt Hiển Thị | Tiếng Anh Hiển Thị (English) | Ghi Chú Nghiệp Vụ |
|:---|:---|:---|:---|:---|
| `changeOfUse` | `renovationLoad = 0`<br>`renovationLoad = 1`<br>`renovationLoad = 2`<br>`renovationLoad = 3` | Chưa ghi nhận<br>Nhẹ – Đã xử lý ổn định<br>Nhiều – Chưa rõ kết cấu<br>Thay đổi lớn – Ảnh hưởng tải trọng | Not recorded<br>Minor – Stabilised<br>Moderate – Unclear structure<br>Major – Significant loading change | Câu hỏi 1 (Bước 2.2): Thay đổi công năng / tải trọng |
| `extension` | `renovationLoad = 0`<br>`renovationLoad = 1`<br>`renovationLoad >= 2` | Không ghi nhận<br>Có cơi nới nhẹ / sửa chữa nhỏ<br>Có cơi nới / mở rộng quy mô lớn | Not recorded<br>Minor extension reported<br>Substantial extension reported | Câu hỏi 1 (Bước 2.2): Cơi nới, mở rộng |
| `structuralAlteration` | `majorRepair = 0`<br>`majorRepair = 1`<br>`majorRepair >= 2` | Chưa ghi nhận<br>Có cải tạo nhẹ kết cấu<br>Có cải tạo lớn ảnh hưởng chịu lực | Not recorded<br>Minor structural alteration<br>Major structural alteration | Câu hỏi 2 (Bước 2.2): Cải tạo kết cấu |
| `majorRepair` | `majorRepair = 0`<br>`majorRepair = 1`<br>`majorRepair = 2`<br>`majorRepair = 3` | Không<br>Có – Nhẹ, đã xử lý ổn định<br>Có – Nhiều, chưa rõ hồ sơ hoàn công<br>Có – Cải tạo lớn ảnh hưởng chịu lực | No<br>Yes – Minor, stabilised<br>Yes – Substantial, unverified documentation<br>Yes – Major structural repair | Câu hỏi 2 (Bước 2.2): Sửa chữa lớn gần đây |
| `fireAndFlooding` | `fireFloodIncident = 0`<br>`fireFloodIncident = 1`<br>`fireFloodIncident = 2`<br>`fireFloodIncident = 3` | Cháy: Không \| Ngập lụt: Không<br>Cháy: Không \| Ngập lụt: Nhẹ (đã khắc phục)<br>Có sự cố trung bình (chưa rõ ảnh hưởng)<br>Có sự cố nghiêm trọng (ảnh hưởng kết cấu) | Fire: None \| Flooding: None<br>Fire: None \| Flooding: Minor (remediated)<br>Moderate fire/flooding incident recorded<br>Severe fire/flooding incident recorded | Câu hỏi 5 (Bước 2.2): Sự cố nghiêm trọng |
| `previousSettlementTilt` | `pastSettlement = 0`<br>`pastSettlement = 1`<br>`pastSettlement = 2`<br>`pastSettlement = 3` | Không phát hiện lún nghiêng trước đây<br>Có ghi nhận lún nghiêng nhẹ (đã ổn định)<br>Có ghi nhận lún nghiêng rõ (tiếp diễn)<br>Có sự cố lún nghiêng nghiêm trọng | No prior settlement or tilt observed<br>Minor past settlement/tilt reported (stabilised)<br>Evident ongoing settlement/tilt reported<br>Severe settlement/tilt incident reported | Câu hỏi 3 (Bước 2.2): Lún nghiêng quá khứ |
| `occupancyStatus` | Chuỗi `usageStatus` chứa "Đầy đủ"<br>Chứa "một phần"<br>Chứa "Bỏ trống" hoặc "Không sử dụng" | Đang sử dụng bình thường (100%)<br>Đang sử dụng một phần<br>Bỏ trống – Không sử dụng | In normal full use (100%)<br>Partially occupied<br>Vacant / Unoccupied | Phỏng vấn tình trạng sử dụng |
| `sensitiveEquipment` | `sensitiveEquipment.has = true`<br>`sensitiveEquipment.has = false` | Có: {sensitiveEquipment.description}<br>Không có thiết bị nhạy cảm rung động | Yes: {sensitiveEquipment.description}<br>No vibration-sensitive equipment | Y tế, phòng lab, máy đo chính xác |
| `damageByAdjacentWorks`| `neighborDamage = 0`<br>`neighborDamage = 1`<br>`neighborDamage = 2`<br>`neighborDamage = 3` | Không<br>Có – Nhẹ, đã bồi thường/khắc phục<br>Có – Ảnh hưởng đáng kể<br>Có – Tranh chấp / Ảnh hưởng nghiêm trọng | No<br>Yes – Minor, compensated/repaired<br>Yes – Substantial damage<br>Yes – Severe damage / Disputed | Câu hỏi 4 (Bước 2.2): Ảnh hưởng lân cận |
| `informationSource` | Mặc định thực tế | Phỏng vấn chủ hộ, Quan sát hiện trường | Property owner interview, Site observation | Nguồn thông tin pháp lý |

---

## 7. TỪ ĐIỂN SONG NGỮ MỤC IV: ĐẶC ĐIỂM KẾT CẤU VÀ MÓNG (SECTION IV)

> ⚠️ **LƯU Ý NGHIỆP VỤ QUAN TRỌNG:**  
> 1. **Phân biệt rõ ràng 100% giữa "Loại hình kết cấu" và "Hình thức kết cấu":**  
>    - **Loại hình kết cấu (Structural Type / Material System):** Hệ chịu lực theo vật liệu (Khung BTCT toàn khối, Khung thép tiền chế, Tường gạch chịu lực).  
>    - **Hình thức kết cấu (Structural Form / Typology):** Hình thái kiến trúc không gian đô thị (Nhà phố liên kế, Nhà riêng lẻ độc lập, Tòa nhà chung cư).  
> 2. **Trường "Tình trạng nền đất xung quanh":** Biểu mẫu hiện trường Phase 1 **không thu thập** mục này. Đã **LOẠI BỎ HOÀN TOÀN** khỏi Bảng Mục IV để nghiêm cấm hành vi tự ý bịa đặt nội dung.  
> 3. **Lỗi `[object Object]` tại Độ sâu móng:** Đã sửa triệt để bằng cách bóc tách chuỗi số mét `{depth} m` kèm song ngữ chuẩn.

| Khóa Trường | Giá trị Đầu Vào (DB / Form KSV) | Tiếng Việt Hiển Thị | Tiếng Anh Hiển Thị (English) |
|:---|:---|:---|:---|
| `structuralType`<br>*(Loại hình kết cấu)* | `RC` / Chứa `BTCT`<br>`Steel` / Chứa `thép`<br>`Masonry` / Chứa `gạch`<br>`Mixed` / Chứa `hỗn hợp`<br>`Other` / Khác | Khung bê tông cốt thép toàn khối (RC)<br>Khung kết cấu thép tiền chế<br>Tường gạch chịu lực<br>Kết cấu hỗn hợp (BTCT kết hợp gạch/thép)<br>Kết cấu khác (gỗ / tạm bợ) | Reinforced Concrete (RC) Frame (columns, beams, slabs)<br>Pre-engineered Steel Structure<br>Load-bearing Brick Masonry<br>Composite / Mixed Structural System<br>Other / Timber / Temporary Structure |
| `structuralForm`<br>*(Hình thức kết cấu)* | `ROW_HOUSE` / Nhà phố<br>`STANDALONE` / Biệt lập<br>`CONDOMINIUM` / Chung cư<br>`COMMERCIAL` / Thương mại | Nhà phố liên kế nhiều tầng (Row / Terraced House)<br>Nhà riêng lẻ độc lập (Detached Single House)<br>Tòa nhà chung cư / Căn hộ nhiều tầng<br>Tòa nhà thương mại / Dịch vụ | Terraced Row House<br>Standalone / Detached House<br>Multi-storey Condominium / Apartment Building<br>Commercial / Shophouse Building |
| `foundationType`<br>*(Loại móng)* | `Shallow` / Móng nông<br>`PC` / Móng cọc ép<br>`CIP` / Cọc khoan nhồi<br>`Wood` / Cừ tràm<br>`Unknown` / Không rõ | Móng nông (Móng băng / Móng đơn / Móng bè)<br>Móng cọc ép bê tông cốt thép (PC)<br>Móng cọc khoan nhồi (CIP)<br>Móng cừ tràm gia cố nền<br>Chưa xác định rõ thông tin móng | Shallow Foundation (Strip / Pad / Raft)<br>Precast Reinforced Concrete Driven Pile<br>Cast-in-place Bored Pile<br>Melaleuca Wooden Pile Foundation<br>Unverified / Unknown Foundation Type |
| `pileSize`<br>*(Kích thước cọc/móng)* | Có số đo trong `pileDimensionMm`<br>Móng nông hoặc rỗng | {pileDimensionMm} (Ví dụ: 25 × 25 cm)<br>Móng nông – Không dùng cọc | {pileDimensionMm} (e.g. 25 × 25 cm)<br>Shallow foundation – No piles |
| `foundationDepth`<br>*(Độ sâu móng)* | Có số đo trong `foundationDepthM`<br>Để trống / Chưa đo | {depth} m (Độ sâu đáy móng so với cốt nền)<br>Chưa xác định độ sâu đáy móng | {depth} m (Foundation base depth from ground level)<br>Unverified foundation depth |
| `visibleStructuralCondition`<br>*(Tình trạng kết cấu quan sát được)* | Có vết nứt chịu lực $\ge$ Grade 3<br>Chỉ có nứt hoàn thiện $\le$ Grade 2<br>Không có khuyết tật nào | Ghi nhận khuyết tật kết cấu cục bộ (xem Mục VI & Phụ lục 2)<br>Cấu kiện chịu lực chính ổn định; ghi nhận nứt vữa hoàn thiện<br>Cấu kiện chịu lực chính (cột, dầm, sàn) nguyên vẹn, ổn định | Localised structural defects observed (see Section VI & App. 2)<br>Main load-bearing elements intact; minor plaster cracks observed<br>Main load-bearing elements (columns, beams, slabs) intact and stable |
| `adjacentBuildings`<br>*(Công trình liền kề)* | Trích xuất từ `adjacentBuildings` JSON | Trái: {left}; Phải: {right}; Sau: {back}<br>*(Dịch chuẩn: Nhà phố / Nhà dân, Hẻm / Đường nội bộ, Đất trống)* | Left: {leftEn}; Right: {rightEn}; Rear: {backEn}<br>*(Standard: Residential Townhouse, Alley / Internal Road, Vacant Land)* |
| `foundationEvidence`<br>*(Căn cứ xác định móng)* | `foundationCatScore = 1`<br>`foundationCatScore = 2`<br>`foundationCatScore = 3`<br>`foundationCatScore = 4`<br>`foundationCatScore = 5` | Hồ sơ hoàn công được phê duyệt (CAT 1)<br>Bản vẽ thiết kế kết cấu do chủ hộ lưu giữ (CAT 2)<br>Phỏng vấn chủ hộ xác nhận (CAT 3)<br>Suy luận chuyên môn KSV tại hiện trường (CAT 4)<br>Chưa có hồ sơ móng (CAT 5) | Approved as-built documentation (CAT 1)<br>Design drawings kept by owner (CAT 2)<br>Property owner statement (CAT 3)<br>Surveyor on-site engineering assessment (CAT 4)<br>Unverified / No foundation documentation (CAT 5) |
| `remarks`<br>*(Ghi chú kỹ thuật)* | Có `foundationNotes`<br>Để trống | {foundationNotes}<br>Dữ liệu hệ kết cấu và móng được tổng hợp từ thông tin hiện trường và khảo sát trực quan. | Surveyor note: {translatedNotes}<br>Structural and foundation data gathered from site information and visual inspection. |

---

## 8. TỪ ĐIỂN SONG NGỮ MỤC V: ĐỘ NGHIÊNG/LÚN - GHI NHẬN SƠ BỘ (SECTION V)

> ⚠️ **LƯU Ý NGHIỆP VỤ & SỬA LỖI PARSER:**  
> 1. **Lỗi `()` và `X = 0.000‰ ()`:** Đã sửa triệt để bằng cách đồng bộ tên trường (`beamDeflection` thay vì lệch tên `beamSlabDeflection`, `location` song ngữ thay vì gọi sai `.location.vi` trên trường `details`).  
> 2. **Xử lý số liệu đo đạc Laser vs Quan sát ngoại quan:**  
>    - Nếu `xPermille` hoặc `sagMm` có số liệu thực tế $\implies$ Parse thành số định dạng: `X = ... ‰ ; Y = ... ‰` hoặc `f = ... mm`.  
>    - Nếu KSV không đo bằng laser mà chỉ quan sát $\implies$ Hiển thị rõ: `Quan sát ngoại quan / Visual check`. Không tự bịa số `0.000‰` như thể đã đo đạc máy móc.  
> 3. **Mã ảnh minh chứng:** Chỉ hiển thị mã ảnh (P-05, P-06, P-07) khi hồ sơ có nạp ảnh thực tế tương ứng. Tuyệt đối không hardcode text `(ảnh P-06)` giả định.

| Tiêu Chí Đánh Giá | Chỉ Số Đầu Vào | Cột Hiện Tượng (Observed) | Vị Trí & Chi Tiết Ghi Nhận (Tiếng Việt) | Vị Trí & Chi Tiết Ghi Nhận (Tiếng Anh) |
|:---|:---|:---:|:---|:---|
| **Lún lệch quan sát được**<br>*(Differential settlement)* | `diffSettlement.level > 0` hoặc có `notes`<br><br>`diffSettlement.level = 0` | **CÓ / YES**<br><br>Không / None | {notes} [Mã ảnh: {photoCode}]<br><br>Không phát hiện lún chênh bất thường tại móng{photoCode ? ' [Ảnh: ' + photoCode + ']' : ''} | {notesEn} [Photo: {photoCode}]<br><br>No abnormal differential settlement observed at foundation{photoCode ? ' [Photo: ' + photoCode + ']' : ''} |
| **Suy thoái cấu kiện kết cấu**<br>*(Component deterioration)* | Có khuyết tật nứt vỡ/bong tróc/lộ thép $\ge$ Grade 3<br><br>Không có | **CÓ / YES**<br><br>Không / None | Ghi nhận dấu hiệu thoái hóa cấu kiện bê tông/cốt thép (xem chi tiết Mục VI)<br><br>Không phát hiện dấu hiệu suy thoái nghiêm trọng của vật liệu kết cấu | Component deterioration observed (see Section VI for details)<br><br>No critical structural material deterioration observed |
| **Dấu hiệu sửa chữa trước đây**<br>*(Evidence of repairs)* | `majorRepair > 0` hoặc có ghi nhận sửa chữa<br><br>`majorRepair = 0` | **CÓ / YES**<br><br>Không / None | Chủ hộ ghi nhận có sửa chữa trước đây, hiện trạng ổn định<br><br>Không phát hiện dấu vết sửa chữa, gia cường kết cấu lớn | Owner reported past repairs, currently stable<br><br>No signs of major past structural repairs or strengthening |
| **Sụp đổ / Hư hỏng nghiêm trọng**<br>*(Collapse / Severe Failure)* | Có sự cố sụp đổ<br><br>Không có | **CÓ / YES**<br><br>Không / None | Ghi nhận hư hỏng nghiêm trọng / sụp đổ cục bộ<br><br>Không ghi nhận bất kỳ dấu hiệu sụp đổ hoặc hư hỏng nghiêm trọng nào | Local failure or severe collapse observed<br><br>No collapse or severe structural damage observed |
| **Độ nghiêng thân nhà**<br>*(Building inclination)* | `buildingTilt.level > 0`<br><br><br>`buildingTilt.level = 0` | **CÓ / YES**<br><br><br>Không / None | {measuredText} – Phát hiện độ nghiêng (Mức {level}/4){direction ? ', hướng ' + direction : ''} [Ảnh: {photoCode}]<br><br>{measuredText ? measuredText + ' – ' : ''}Thân nhà thẳng đứng, độ nghiêng trong giới hạn cho phép{photoCode ? ' [Ảnh: ' + photoCode + ']' : ''} | {measuredTextEn} – Tilt observed (Level {level}/4){direction ? ', dir. ' + direction : ''} [Photo: {photoCode}]<br><br>{measuredTextEn ? measuredTextEn + ' – ' : ''}Building upright, inclination within permissible limits{photoCode ? ' [Photo: ' + photoCode + ']' : ''} |
| **Độ võng dầm / sàn**<br>*(Deflection of beam/floor)* | `beamSagging.level > 0` hoặc `sagMm > 0`<br><br>`beamSagging.level = 0` | **CÓ / YES**<br><br>Không / None | Ghi nhận độ võng dầm/sàn (f = {sagMm} mm){position ? ' tại ' + position : ''}<br><br>Không phát hiện hiện tượng võng dầm, sàn kết cấu bằng mắt thường | Deflection recorded (f = {sagMm} mm){position ? ' at ' + position : ''}<br><br>No visual deflection of structural beams or floor slabs observed |

---

## 9. CÔNG THỨC HÌNH HỌC & POSTGIS TOÁN HỌC ÁP DỤNG TRONG MAPPER

```sql
-- 1. Kích thước cạnh dài, cạnh rộng từ đa giác ranh thửa (ST_OrientedEnvelope):
WITH bbox AS (
  SELECT ST_OrientedEnvelope(cadastral_polygon_geom) AS env
  FROM parcels WHERE id = $1
)
SELECT 
  ROUND(ST_Distance(ST_PointN(ST_ExteriorRing(env), 1)::geography, ST_PointN(ST_ExteriorRing(env), 2)::geography)::numeric, 1) AS side_1,
  ROUND(ST_Distance(ST_PointN(ST_ExteriorRing(env), 2)::geography, ST_PointN(ST_ExteriorRing(env), 3)::geography)::numeric, 1) AS side_2
FROM bbox;

-- 2. Khoảng cách vuông góc tới tim tuyến Metro:
SELECT ROUND(ST_Distance(p.footprint_polygon_geom::geography, s.centerline_geom::geography)::numeric, 1) AS dist_centerline
FROM parcels p, metro_segments s
WHERE p.id = $1 AND s.segment_code = p.zone_id;

-- 3. Tĩnh không đứng và Tĩnh không 3D với hầm âm 25m:
-- dZ = 25.0 - foundation_depth_m
-- D_3D = SQRT(POWER(dist_centerline, 2) + POWER(dZ, 2))
```

---

## 10. TỪ ĐIỂN SONG NGỮ MỤC VI: TỔNG HỢP & PHÂN TÍCH HIỆN TRẠNG KHUYẾT TẬT (SECTION VI)

> ⚠️ **LƯU Ý NGHIỆP VỤ & RÀNG BUỘC TỪ GIAO DIỆN KHẢO SÁT (STEP 3) - HIỆU CHỈNH CHUẨN HOÁ:**  
> 1. **Thu thập đồng thời cả Vùng Kiến trúc ($Z$) và Cấu kiện Kết cấu ($E$):**  
>    - Tuyệt đối không được bỏ sót các khuyết tật trên Cột/Dầm/Sàn ($fl.structuralElements$).  
> 2. **Phân loại chính xác Vết nứt vs Phi vết nứt (`isCrackRelated`):**  
>    - Sử dụng chuẩn `isCrackRelated(d.screeningCategory, d.defectType)` từ `defectHelpers.ts`.  
>    - Các khuyết tật dạng vết nứt: bắt buộc có bề rộng lớn nhất $w_{max} (mm)$ và chiều dài $L (m)$.  
>    - Các khuyết tật phi vết nứt (thấm ẩm, bong rộp sơn vôi, kẹt cửa): **không ép gán số $w=0.0\text{ mm}$**, phân loại đúng vào nhóm chuyên biệt tương ứng.  
> 3. **Cấu trúc tinh gọn chuẩn hóa gồm đúng 2 bảng kỹ thuật:**  
>    - **Không sử dụng Dashboard cards hay Banner tóm tắt phía trên:** Tránh trùng lặp thông tin với bảng bên dưới.  
>    - **Bảng VI.1 - Ma trận phân bố khuyết tật theo từng tầng (Floor Distribution Matrix):**  
>      - Cột 6: Đổi thành `Bong rộp & Khác (Spalling & Other)` để bao quát toàn bộ các khuyết tật phi vết nứt và phi thấm ẩm. Tổng 4 cột khuyết tật (Nứt K.Cấu + Nứt Tường + Thấm ẩm + Bong rộp & Khác) bằng đúng 100% tổng số khuyết tật công trình.  
>      - Hàng cuối cùng: Bổ sung hàng `Tổng / Total` tổng kết toàn bộ số đối tượng khảo sát, số khuyết tật từng nhóm, $w_{max}$ toàn nhà và tổng số khuyết tật.  
>      - Quy tắc ngắn gọn: Tầng nào không có khuyết tật thì ghi rõ `Không / None`, không viết câu nhận định dài dòng.  
>    - **Bảng VI.2 - Danh mục 8 nhóm BCS Checklist chuẩn quốc tế:**  
>      - Khảo sát đầy đủ 8 nhóm chuẩn quốc tế, tính toán động từ CSDL.  
>      - Quy tắc ngắn gọn: Tiêu chí nào không có ghi nhận (`recorded === false`) thì hiển thị dứt khoát `Không / None` tại cả cột Ghi nhận lẫn cột Vị trí & Chi tiết, tuyệt đối không đưa các câu văn vở suy đoán.

### 10.1. Danh mục 8 nhóm BCS Checklist chuẩn quốc tế

| STT | Nhóm (Group) | Chỉ Báo Khuyết Tật (Defect Indicator) | Quy Tắc Tính Toán Từ CSDL | Tiêu Chí Đánh Giá Rủi Ro |
|:---:|:---|:---|:---|:---:|
| 1 | **Nứt**<br>*(Cracking)* | Nứt cấu kiện kết cấu chịu lực (Cột/Dầm/Sàn)<br><span class="text-muted">Cracks in structural members</span> | Lọc khuyết tật có `isCrackRelated === true` nằm trên Cấu kiện $E$ hoặc có category `Nứt cấu kiện kết cấu chịu lực` | $w > 1.0\text{mm} \implies \text{Cao (High)}$<br>$w \le 1.0\text{mm} \implies \text{Trung bình}$ |
| 2 | **Nứt**<br>*(Cracking)* | Nứt tường gạch / khối xây chèn<br><span class="text-muted">Cracks in masonry / infill walls</span> | Lọc khuyết tật nứt nằm trên Vùng $Z$ có type chứa `tường`, `mạch vữa`, `ziczac`, `tiếp giáp` | $w \ge 5.0\text{mm} \implies \text{Cao}$<br>$w \ge 1.0\text{mm} \implies \text{Trung bình}$<br>$w < 1.0\text{mm} \implies \text{Thấp}$ |
| 3 | **Nứt**<br>*(Cracking)* | Nứt lớp vữa trát / hoàn thiện kiến trúc<br><span class="text-muted">Cracks in plaster / surface finishes</span> | Lọc khuyết tật nứt chân chim, mạng nhện vữa trát ($w < 0.5\text{mm}$) hoặc nứt góc trần/khuôn cửa | Thấp (Low) / Thẩm mỹ |
| 4 | **Nước**<br>*(Water)* | Thấm nước / Rò rỉ / Ẩm mốc loang lổ<br><span class="text-muted">Water seepage, dampness & efflorescence</span> | Lọc khuyết tật có category/type chứa `Thấm dột`, `Ẩm mốc` | Vị trí diện rộng $\implies$ Trung bình |
| 5 | **Suy giảm**<br>*(Deterioration)* | Bong rộp sơn vôi / Phồng rộp gạch ốp lát<br><span class="text-muted">Blistering of paint & spalling tiles</span> | Lọc khuyết tật có category/type chứa `Bong rộp`, `Bong tróc`, `Bong tách` | Thấp (Low) |
| 6 | **Suy giảm**<br>*(Deterioration)* | Rỉ cốt thép / Vỡ trơ thép chịu lực<br><span class="text-muted">Rebar corrosion & concrete spalling</span> | Lọc khuyết tật có type `Vỡ bê tông / Trơ rỉ cốt thép` | Cao (High) / Nguy hiểm |
| 7 | **Biến dạng**<br>*(Deformation)* | Biến dạng hình học (Nghiêng, lún chênh, võng)<br><span class="text-muted">Tilt, differential settlement & deflection</span> | Đồng bộ từ Mục V (`Section 5 Tilt & Settlement`) | Theo cấp độ đo lường |
| 8 | **Hư hỏng**<br>*(Damage)* | Hư hỏng cơ học & Kẹt cửa đi / Cửa sổ<br><span class="text-muted">Mechanical damage & sticking doors</span> | Lọc khuyết tật có category/type chứa `Kẹt cửa`, `Cong vênh` | Thấp / Trung bình |

---

## 11. TỪ ĐIỂN SONG NGỮ MỤC VII: PHÂN LOẠI MỨC ĐỘ HƯ HẠI THEO BURLAND (SECTION VII)

> ⚠️ **LƯU Ý NGHIỆP VỤ & RÀNG BUỘC TỪ GIAO DIỆN KHẢO SÁT (STEP 4):**  
> 1. **Tôn trọng dữ liệu KSV đã chốt tại Bước 4 (`formData.burlandSummary`):**  
>    - `predominantGrade`, `localMaxGrade`, `governingZoneCode`, `governingZoneDescription`, `representativeness`, `structuralFlagLevel`, `needStructuralEngineerReview`.  
> 2. **Công thức tiêu chuẩn Burland (1977) & BRE Digest 251:**  
>    - $w \le 0.1\text{mm} \to \text{Cấp 0 (Negligible)}$  
>    - $0.1 < w \le 1.0\text{mm} \to \text{Cấp 1 (Very slight)}$  
>    - $1.0 < w \le 5.0\text{mm} \to \text{Cấp 2 (Slight)}$  
>    - $5.0 < w \le 15.0\text{mm} \to \text{Cấp 3 (Moderate)}$  
>    - $15.0 < w \le 25.0\text{mm} \to \text{Cấp 4 (Severe)}$  
>    - $w > 25.0\text{mm} \to \text{Cấp 5 (Very severe)}$  
> 3. **Bảng phân bổ đối tượng toàn công trình (Burland Distribution Matrix):**  
>    - Thống kê tỷ lệ phân bổ trên 100% đối tượng khảo sát ($Z$ và $E$) để chứng minh tính đại diện của cấp chủ đạo và cấp cục bộ lớn nhất.  
> 4. **Điều khoản pháp lý bảo hiểm (Insurance Legal Baseline):**  
>    - Xác lập ranh giới trách nhiệm bồi thường: Chỉ xem xét bồi thường cho vết nứt phát sinh mới hoàn toàn ngoài báo cáo hoặc vết nứt cũ phát triển tăng bề rộng vượt $w_{max}$ ban đầu do tác động thi công Metro.

### 11.1. Bảng Tiêu chuẩn 6 Cấp độ Burland (1977) (Bảng VII.1 & Bảng VII.2)

| Cấp (Grade) | Mức Độ Hư Hại (Category) | Bề Rộng Nứt ($w_{max}$) | Mô Tả Đặc Trưng & Mức Sửa Chữa Điển Hình | Ghi Nhận Hiện Trạng |
|:---:|:---|:---:|:---|:---:|
| **0** | **Không đáng kể**<br><span class="text-muted">Negligible</span> | $\le 0.1\text{ mm}$ | Vết nứt chân chim cực nhỏ; không cần sửa chữa xử lý.<br><span class="text-muted">Hairline cracks; no repair required.</span> | Đánh dấu `☒ Có` nếu là Cấp lớn nhất |
| **1** | **Rất nhẹ**<br><span class="text-muted">Very Slight</span> | $0.1 - 1.0\text{ mm}$ | Vết nứt tinh xảo, dễ dàng xử lý trong trang trí/bả mastic thông thường.<br><span class="text-muted">Fine cracks, easily treated during normal decoration.</span> | Đánh dấu `☒ Có` nếu là Cấp lớn nhất |
| **2** | **Nhẹ**<br><span class="text-muted">Slight</span> | $1.0 - 5.0\text{ mm}$ | Vết nứt dễ trám vá vữa; có thể cần miết lại mạch; cửa đi/sổ có thể hơi kẹt nhẹ.<br><span class="text-muted">Cracks easily filled; doors/windows may stick slightly.</span> | Đánh dấu `☒ Có` nếu là Cấp lớn nhất |
| **3** | **Trung bình**<br><span class="text-muted">Moderate</span> | $5.0 - 15.0\text{ mm}$ | Cần đục trát lại mạch vữa, chèn lại khối xây; khả năng chống thấm bị suy giảm; kẹt cửa.<br><span class="text-muted">Cracks require masonry repointing; weather-tightness impaired.</span> | Đánh dấu `☒ Có` nếu là Cấp lớn nhất |
| **4** | **Nặng**<br><span class="text-muted">Severe</span> | $15.0 - 25.0\text{ mm}$ | Hư hỏng trên diện rộng, tường xây lệch chuyển, dầm sàn võng nứt; gối tựa bị ảnh hưởng.<br><span class="text-muted">Extensive damage, walls leaning, beams deflect noticeably.</span> | Đánh dấu `☒ Có` nếu là Cấp lớn nhất |
| **5** | **Rất nặng**<br><span class="text-muted">Very Severe</span> | $> 25.0\text{ mm}$ | Nguy cơ sụp đổ từng phần, yêu cầu chống đỡ khẩn cấp hoặc tái thiết cấu kiện.<br><span class="text-muted">Structural danger, partial collapse risk requiring urgent propping.</span> | Đánh dấu `☒ Có` nếu là Cấp lớn nhất |

### 11.2. Bảng Minh Chứng Phân Loại Burland Theo Vùng Khảo Sát (Bảng VII.3)

| Cột Bảng VII.3 | Tên Trường Song Ngữ | Nguồn Dữ Liệu | Định Dạng Hiển Thị Chuẩn |
|:---|:---|:---|:---|
| **Vùng** | `Zone` | `zoneCode` | Mã phân vùng kỹ thuật: Z-01, Z-02, ... |
| **Vị trí** | `Location` | `floorName` – `location` | Tầng khảo sát và vị trí khảo sát cụ thể |
| **Vật liệu tường** | `Wall material` | `wallMaterial` | Bê tông, gạch nung, đá granite, thạch cao... |
| **$w_{max}$ (mm)** | `Max crack width` | `wmaxMm` | Bề rộng vết nứt lớn nhất ghi nhận tại vùng (hoặc `–`) |
| **Số vết nứt** | `No. of cracks` | `crackCount` | Số lượng vết nứt đếm được |
| **Cấp Burland** | `Burland grade` | `burlandGrade` | Phân cấp Burland tương ứng: Cấp 0, Cấp 1, Cấp 2, ... |

> 🎨 **QUY CHUẨN THIẾT KẾ MÀU SẮC ĐỒNG BỘ TRUNG TÍNH (COLOR HARMONY RULE):**  
> - Toàn bộ Chương VII sử dụng hệ màu trung tính (slate/monochrome) đồng bộ với các Chương I, II, III, IV, V, VI của Biên bản.  
> - Nghiêm cấm dùng màu nền vàng rực rỡ (`#fef3c7`, `#fffbeb`) hoặc màu chữ cam/nâu (`#b45309`, `#d97706`) hay xanh dương rực rỡ trên bảng và thẻ kết luận để đảm bảo tính trang trọng, nghiêm túc của hồ sơ pháp lý kỹ thuật.  
> - Hàng cấp hiện tại trong Bảng VII.1 được đánh dấu bằng ký hiệu `☒ Có` (chữ đen đậm, nền `#f8fafc` tinh tế); các hàng khác để `☐ Không` mờ nhạt chuẩn mực.  
> - Bảng VII.3 giữ nền trắng sạch sẽ, các chỉ số $w_{max}$ và cấp độ hiển thị chữ đen/slate rõ nét.

---

## 12. QUY CHUẨN ĐÁNH GIÁ TÌNH TRẠNG & MA TRẬN RỦI RO PHASE 1 (SECTION VIII: ECS, VI, I, BRA)

> ⚠️ **LÝ DO KỸ THUẬT & CƠ SỞ KHOA HỌC THAY THẾ KHUNG A-B-C-D-E:**  
> 1. **Bất cập của khung A-B-C-D-E trong Báo cáo Khảo sát Hiện trạng Giai đoạn 1 (Phase 1 BCS):**  
>    - Khung chấm điểm A-B-C-D-E vốn được thiết kế cho giai đoạn thi công (Construction Phase / Phase 2+), trong đó chỉ số **A (Tác động thi công / Hư hỏng dự đoán)** đòi hỏi kết quả chạy mô phỏng số Plaxis 3D hoặc đường cong phễu lún Peck ($S_{max}$, góc vặn $\beta$, độ võng $\Delta/L$, vận tốc dao động hạt PPV).  
>    - Tại thời điểm khảo sát Phase 1, dự án chưa có số liệu quan trắc chạy mô hình động, dẫn đến mục A luôn ở trạng thái **"Chờ / Pending"** và điểm BRA hiển thị dạng dang dở **"26 + A"**. Điều này làm cho báo cáo trông thiếu hoàn thiện, gây khó khăn cho Chủ đầu tư MAUR, TVGS và đơn vị Bảo hiểm nghiệm thu hồ sơ hiện trạng.  
> 2. **Sự phù hợp 100% của bộ chỉ số ECS, VI, I, BRA trích xuất từ Giao diện Khảo sát (Survey Phase 1):**  
>    - Toàn bộ tham số đầu vào của **ECS (0–24)** và **VI (1.00–4.00)**, **Impact ($I_1 - I_4$)** và **BRA (Ma trận $4 \times 4$)** được lấy mẫu nguyên vẹn theo các module tính toán hiện trường: `ecsCalculator.ts`, `viCalculator.ts` và `braEngine.ts`.  
>    - Ma trận kết hợp **$V \times I \to \text{BRA}$** cho ra kết luận cấp rủi ro rõ ràng (Low / Medium / High / Very High) với ô giao điểm được **Highlight nổi bật**, đảm bảo tính minh bạch, nhất quán và giá trị pháp lý cao nhất cho hồ sơ BCS Phase 1.

### 12.1. Đánh giá Điểm Hiện trạng Công trình (ECS - Existing Condition Score)

Công thức tổng hợp chuẩn khảo sát (`ecsCalculator.ts`):
$$\text{Total ECS} = E_1 + E_2 + E_3 + E_4 + E_5 + E_6 \quad (\text{Thang điểm từ } 0 \text{ đến } 24)$$

| Mã Chỉ Số | Tiêu Chí Đánh Giá (Criteria) | Thang | Nguồn Thu Thập Hiện Trường | Quy Tắc Chấm Điểm Chuẩn Khảo Sát (`ecsCalculator.ts`) |
|:---:|:---|:---:|:---|:---|
| **$E_1$** | **Hư hỏng nhìn thấy tường / khối xây**<br><span class="text-muted">Visible damage to walls / masonry</span> | $0 - 4$ | Cấp Burland cục bộ lớn nhất Mục VII (`burlandSummary.localMaxGrade`) | - Burland Cấp 0–1 ($w \le 1.0\text{mm}$): **0 điểm**<br>- Burland Cấp 2 ($1 < w \le 5\text{mm}$): **1 điểm**<br>- Burland Cấp 3 ($5 < w \le 15\text{mm}$): **2 điểm**<br>- Burland Cấp 4 ($15 < w \le 25\text{mm}$): **3 điểm**<br>- Burland Cấp 5 ($w > 25\text{mm}$): **4 điểm** |
| **$E_2$** | **Khuyết tật kết cấu cột/dầm/sàn/tường**<br><span class="text-muted">Structural defects significance</span> | $0 - 4$ | $\max(\text{structuralSignificanceE2}, \text{structuralFlagLevel})$ | - Không có khuyết tật kết cấu / Cờ `NONE`: **0 điểm**<br>- Khuyết tật nhẹ / Cờ `LOW`: **1 điểm**<br>- Khuyết tật trung bình / Cờ `MODERATE`: **2 điểm**<br>- Nứt kết cấu nghiêm trọng / Cờ `HIGH`: **3 điểm**<br>- Nguy cơ mất an toàn chịu lực / Cờ `CRITICAL`: **4 điểm** |
| **$E_3$** | **Biến dạng Lún / Nghiêng / Võng**<br><span class="text-muted">Deformation (Settlement / Tilt / Deflection)</span> | $0 - 4$ | $\max(\text{diffSettlement.level}, \text{buildingTilt.level}, \text{beamSagging.level})$ | - Hình học bình thường / Mức 0: **0 điểm**<br>- Nghi ngờ / Nghiêng lún nhẹ / Mức 1: **1 điểm**<br>- Rõ ràng ổn định lâu năm / Mức 2: **2 điểm**<br>- Tiến triển / Kẹt cửa / Mức 3: **3 điểm**<br>- Biến dạng nguy cấp / Mức 4: **4 điểm** |
| **$E_4$** | **Suy giảm vật liệu / độ bền lâu**<br><span class="text-muted">Material degradation</span> | $0 - 4$ | $\max(\text{materialDegradationE4})$ quét toàn bộ khuyết tật D-xx | - Vật liệu chắc đặc, không phong hóa: **0 điểm**<br>- Bong tróc nhẹ vữa/sơn cục bộ: **1 điểm**<br>- Thấm ẩm diện rộng, mục vữa: **2 điểm**<br>- Nứt tách lớp, trơ rỉ cốt thép: **3 điểm**<br>- Cốt thép ăn mòn đứt gãy, bê tông mục nát: **4 điểm** |
| **$E_5$** | **Lịch sử / cơi nới / sự cố & toàn vẹn**<br><span class="text-muted">Historical sensitivity & past incidents</span> | $0 - 4$ | 5 câu hỏi phỏng vấn lịch sử Mục III (`historyInterview`) | - $\max(\text{scores})$ của 5 câu hỏi lịch sử (0 đến 4đ).<br>- **Cơ chế cộng hưởng rủi ro**: Nếu có $\ge 2$ trường cùng đạt $\ge 3$đ (vừa cơi nới nặng vừa từng lún nứt) $\implies E_5 = 4\text{ điểm}$. |
| **$E_6$** | **Tình trạng chức năng / tổng thể**<br><span class="text-muted">Overall serviceability & functional condition</span> | $0 - 4$ | $\max(\text{functionalImpactE6}, \text{zoneCountScore})$ | - Không ảnh hưởng công năng: **0 điểm**<br>- Ẩm mốc nhẹ hoặc kẹt 1–2 cửa / $\le 2$ vùng sửa chữa: **1 điểm**<br>- Thấm nước hoặc kẹt 2–5 cửa / $\le 4$ vùng sửa chữa: **2 điểm**<br>- Dột thành dòng hoặc kẹt $> 5$ cửa / $> 4$ vùng sửa chữa: **3 điểm**<br>- Rò rỉ chập điện hoặc chắn lối thoát nạn: **4 điểm** |

#### Bảng Phân Cấp Hiện Trạng ECS (ECS Classification Table)

| Khoảng Điểm Total ECS | Phân Cấp ECS (Việt) | ECS Classification (English) | Định Nghĩa Kỹ Thuật Dự Án Metro 2 |
|:---:|:---|:---|:---|
| **$0 - 5$** | **TỐT** | **GOOD** | Công trình trong điều kiện khai thác tốt; kết cấu ổn định; rủi ro nội tại rất thấp. |
| **$6 - 10$** | **TRUNG BÌNH** | **MEDIUM** | Có một số khuyết tật hoàn thiện hoặc suy giảm vật liệu thông thường; kết cấu ổn định; theo dõi định kỳ. |
| **$11 - 16$** | **KÉM** | **DEFICIENT (POOR)** | Xuất hiện khuyết tật kết cấu hoặc biến dạng lún nghiêng đáng kể; yêu cầu kiểm tra kỹ thuật trước khi thi công. |
| **$\ge 17$** | **NGUY HIỂM** | **CRITICAL (DANGEROUS)** | Xuống cấp nghiêm trọng, nguy cơ mất ổn định kết cấu; bắt buộc có biện pháp chống đỡ/gia cường khẩn cấp. |

---

### 12.2. Đánh giá Chỉ số Dễ bị Tổn thương (VI - Vulnerability Index)

Công thức tổng hợp chuẩn khảo sát (`viCalculator.ts`):
$$VI_{avg} = \frac{V_1 + V_2 + V_3 + V_4 + V_5 + V_6}{6.0} \quad (\text{Thang điểm từ } 1.00 \text{ đến } 4.00)$$

| Mã Chỉ Số | Tiêu Chí Thành Phần | Thang | Nguồn Dữ Liệu Khảo Sát | Quy Tắc Chấm Điểm Chuẩn Khảo Sát (`viCalculator.ts`) |
|:---:|:---|:---:|:---|:---|
| **$V_1$** | **Công năng & Quy mô**<br><span class="text-muted">Building importance & use</span> | $0 - 4$ | Công năng Mục I & II (`usageFunction`, `objectGroup`) | - `Normal` (Đất trống / Nhà bỏ trống): **0 điểm**<br>- `General` (Nhà ở gia đình, nhà dân thông thường): **2 điểm**<br>- `Important` (Nhà phố kinh doanh đông người, trường học, mini condo): **3 điểm**<br>- `Critical` (Bệnh viện lớn, di tích lịch sử, cơ quan trọng yếu): **4 điểm** |
| **$V_2$** | **Hệ kết cấu chịu lực**<br><span class="text-muted">Structural system</span> | $1 - 4$ | Hệ kết cấu chịu lực Mục IV (`structureSystem`) | - Khung bê tông cốt thép (BTCT) toàn khối: **1 điểm**<br>- Khung BTCT kết hợp tường chèn gạch: **2 điểm**<br>- Tường gạch chịu lực / thép cũ: **3 điểm**<br>- Kết cấu tạm, vách gỗ mái tôn, kém ổn định: **4 điểm** |
| **$V_3$** | **Loại móng & Nền đất**<br><span class="text-muted">Foundation type & information certainty</span> | $1 - 4$ | Điểm CAT móng Mục IV (`foundationCatScore`) | - Cat 1–2 (Móng cọc có bản vẽ thiết kế / hoàn công xác minh): **1 điểm**<br>- Cat 3 (Móng băng / móng cọc qua phỏng vấn chủ nhà/thợ): **2 điểm**<br>- Cat 4 (Móng nông / móng đơn / cừ tràm suy luận theo tập quán): **3 điểm**<br>- Cat 5 (Không rõ loại móng trên nền bùn sét đất yếu): **4 điểm** |
| **$V_4$** | **Tuổi đời / Cơi nới**<br><span class="text-muted">Building age / Extension</span> | $1 - 4$ | Năm xây dựng Mục II & Cơi nới Mục III | - Tuổi đời $< 10$ năm: **1 điểm**<br>- Tuổi đời $10 - 25$ năm: **2 điểm**<br>- Tuổi đời $25 - 40$ năm: **3 điểm**<br>- Tuổi đời $> 40$ năm HOẶC cơi nới tăng tải trọng nặng ($\ge 3$đ): **4 điểm** |
| **$V_5$** | **Hiện trạng kỹ thuật ECS**<br><span class="text-muted">Existing condition ECS</span> | $1 - 4$ | Phân hạng ECS Class ở Bảng VIII.1 | - ECS Good ($0 - 5$đ): **1 điểm**<br>- ECS Medium ($6 - 10$đ): **2 điểm**<br>- ECS Deficient ($11 - 16$đ): **3 điểm**<br>- ECS Critical ($\ge 17$đ): **4 điểm** |
| **$V_6$** | **Thiết bị nhạy cảm & Vận hành**<br><span class="text-muted">Vibration sensitivity & occupancy</span> | $1 - 4$ | Khảo sát thiết bị nhạy cảm Mục III | - Không có thiết bị nhạy cảm: **1 điểm**<br>- Thiết bị gia dụng dân dụng thông thường: **2 điểm**<br>- Văn phòng / Kinh doanh / Thiết bị nhạy rung: **3 điểm**<br>- Y tế / Phòng lab / Vận hành liên tục 24/7: **4 điểm** |

#### Bảng Phân Cấp Tính Dễ Bị Tổn Thương VI (VI Classification Table)

| Khoảng Điểm Trung Bình $VI_{avg}$ | Phân Hạng VI | Tên Gọi Kỹ Thuật (English) | Mã Rủi Ro Ma Trận | Mức Độ Nhạy Cảm Với Chuyển Vị Đất Nền |
|:---:|:---|:---|:---:|:---|
| **$VI_{avg} \le 1.50$** | **THẤP** | **LOW** | **V1** | Kết cấu kiên cố, móng sâu, khả năng hấp thụ biến dạng tốt; ít nhạy cảm. |
| **$1.50 < VI_{avg} \le 2.50$** | **TRUNG BÌNH** | **MEDIUM** | **V2** | Mức độ nhạy cảm tiêu chuẩn đối với nhà phố đô thị hiện hữu. |
| **$2.50 < VI_{avg} \le 3.25$** | **CAO** | **HIGH** | **V3** | Nhà có kết cấu kém dẻo dai hoặc móng nông; nhạy cảm cao với lún lệch và rung động. |
| **$VI_{avg} > 3.25$** | **RẤT CAO** | **VERY HIGH** | **V4** | Nhà rất yếu hoặc công trình đặc thù; dễ tổn thương ngay cả khi chuyển vị nhỏ. |

---

### 12.3. Cấp Tác Động Thi Công Dự Kiến ($I$: $I_1 - I_4$) (`braEngine.ts`)

Xác định tự động dựa trên **Khoảng cách tính toán $d$** (Ưu tiên: khoảng cách mép ga / biên hố đào; Fallback: khoảng cách tim tuyến Metro):

| Cấp Tác Động ($I$) | Tên Gọi Kỹ Thuật | Nhóm Công Trình Thông Thường (General) | Nhóm Trọng Yếu / Nhạy Cảm (Critical / Important) |
|:---:|:---|:---:|:---:|
| **$I_1$** | **Tác động Thấp (Low Impact)** | $d \ge 20\text{ m}$ | $d \ge 30\text{ m}$ |
| **$I_2$** | **Tác động Trung bình (Medium Impact)** | $10\text{ m} \le d < 20\text{ m}$ | $20\text{ m} \le d < 30\text{ m}$ |
| **$I_3$** | **Tác động Cao (High Impact)** | $5\text{ m} \le d < 10\text{ m}$ | $10\text{ m} \le d < 20\text{ m}$ |
| **$I_4$** | **Tác động Rất cao (Very High Impact)** | $d < 5\text{ m}$ | $d < 10\text{ m}$ |

---

### 12.4. Ma Trận Đánh Giá Rủi Ro Cơ Sở BRA ($4 \times 4$ Matrix) (`braEngine.ts`)

Bảng tra cứu ma trận $4 \times 4$ kết hợp giữa **Cấp tổn thương ($V_1 - V_4$)** và **Cấp tác động thi công ($I_1 - I_4$)**:

| Phân Cấp $V$ \ Cấp $I$ | $I_1$ (Low) | $I_2$ (Medium) | $I_3$ (High) | $I_4$ (Very High) |
|:---|:---:|:---:|:---:|:---:|
| **V1 (Low)** | **Low** | **Low** | **Medium** | **High** |
| **V2 (Medium)** | **Low** | **Medium** | **Medium** | **High** |
| **V3 (High)** | **Medium** | **Medium** | **High** | **Very High** |
| **V4 (Very High)** | **High** | **High** | **Very High** | **Very High** |

> 🎯 **QUY CHUẨN THIẾT KẾ MÀU SẮC ĐỒNG NHẤT (UNIFIED SEMANTIC DESIGN SYSTEM):**  
> Báo cáo tuân thủ nghiêm ngặt nguyên tắc: **Không dùng quá nhiều màu (chống hiệu ứng bàn cờ lòe loẹt), nhưng không dùng quá nhiều màu đen (chống cảm giác tối tăm, thô cứng)**. Màu sắc được sử dụng theo 4 quy ước đồng nhất:
> 1. **Màu Nhận diện & Tiêu đề (Tech Navy `#0f3b6c`):**
>    - Dùng cho Tiêu đề Chương (`h2.chapter-header`), viền khung trang bìa, tiêu đề bảng `th`, tiêu đề khung kết luận và dòng tổng kết quả.
> 2. **Màu Lưới & Nội dung (Refined Slate):**
>    - Toàn bộ đường lưới bảng biểu chuyển từ đen `#000000` sang **xám Slate kỹ thuật `#cbd5e1`** tạo nét vẽ mảnh mai, thanh lịch.
>    - Chữ nội dung dùng Slate đậm `#1e293b` (êm mắt), chữ tiếng Anh dùng Slate nhạt `#64748b`.
> 3. **Quy tắc hiển thị Ma trận Rủi ro (Bảng VIII.3):**
>    - 15 ô không thuộc kết quả đánh giá giữ nền trắng `#ffffff`, viền xám `#cbd5e1`, chữ xám `#475569`.
>    - **CHỈ DUY NHẤT 1 ô giao điểm hiện tại $(V_k, I_m)$** được thắp sáng (highlight) bằng màu trạng thái ngữ nghĩa tương ứng với Cấp rủi ro của tòa nhà.
> 4. **Bảng màu Ngữ nghĩa Cấp độ Rủi ro & Khuyết tật (Semantic Risk Badges):**
>    - **R1 - Thấp / An toàn (Low Risk / Grade 0):** Nền `#f0fdf4`, viền `#16a34a`, chữ `#166534`.
>    - **R2 - Trung bình / Theo dõi (Medium Risk / Grade 1-2):** Nền `#fefce8`, viền `#ca8a04`, chữ `#854d0e`.
>    - **R3 - Cao / Cảnh giác (High Risk / Grade 3):** Nền `#fff7ed`, viền `#ea580c`, chữ `#9a3412`.
>    - **R4 - Rất cao / Nguy hiểm (Very High Risk / Grade 4-5):** Nền `#fef2f2`, viền `#dc2626`, chữ `#991b1b`.
>    - *Khung Kết luận Đánh giá Rủi ro*: Có vạch nhấn viền trái (`border-left: 4px solid`) và nhãn phân cấp đồng bộ 100% với màu của ô Highlight phía trên.

> 🔒 **QUY TẮC KHÓA AN TOÀN KỸ THUẬT (ENGINEERING JUDGEMENT SAFETY LOCK):**  
> - Nghiêm cấm mọi hành vi can thiệp của Kỹ sư để hạ cấp rủi ro (DOWNGRADE) nếu công trình đang mang **Cờ kết cấu nguy cấp ($E_2 \ge 3$)** hoặc **Điểm lún nghiêng ($E_3 \ge 3$)**.  
> - Mọi trường hợp can thiệp chuyên môn (Engineering Judgement) phải được ghi rõ họ tên Kỹ sư trưởng, lý do kỹ thuật và lưu vết trong bảng `risk_score_cards`.



