# Đặc Tả Nguồn Dữ Liệu & Công Thức Các Cột Trong File Excel Báo Cáo Tiến Độ (`A..AB`)

Tài liệu này mô tả chi tiết cấu trúc **File Excel Báo Cáo Tiến Độ Khảo Sát Hiện Trạng Công Trình** được xuất bởi plugin [`progress-report`](./index.ts): gồm **Khối Bảng Tổng Hợp đầu trang (Dòng 1–8)** và **Bảng Chi Tiết 28 Cột `A..AB` (từ Dòng 9 trở đi)**.

---

## Phần 1. Đơn Vị Dòng Dữ Liệu (Granularity) & Nguồn Bảng CSDL

Truy vấn SQL nằm tại [`data/pg-progress.datasource.ts`](./data/pg-progress.datasource.ts):
1. **Nhà dân / Công trình độc lập (`kind = 'BUILDING'`)**:
   - Lấy từ bảng `parcels` (với `deleted_at IS NULL`) thuộc `zone_id` đang chọn, **trừ** các thửa chung cư đã được bóc tách căn hộ con (`building_units`).
   - Kết nối hồ sơ khảo sát qua `LATERAL` từ `base_survey_reports` với **thứ tự ưu tiên trạng thái đã nộp/duyệt trước** (`APPROVED` → `UNDER_REVIEW` → `SUBMITTED` → `REJECTED` → `DRAFT`), sau đó mới ưu tiên `p.active_phase1_report_id` và `updated_at DESC`.
   - Ngoài ra có nhánh `sub_dim` (`LATERAL`) quét riêng tất cả các hồ sơ `APPROVED / UNDER_REVIEW / SUBMITTED` của thửa đất để lấy bổ sung kích thước `Dài (lotDepth)`, `Rộng (frontageWidth)`, `Cao (buildingHeightM)` nếu hồ sơ đã duyệt bổ sung.
2. **Căn hộ chung cư (`kind = 'CONDO_UNIT'`)**:
   - Khi thửa đất có bản ghi trong `building_units`, hệ thống xuất **mỗi căn hộ con trên 1 dòng riêng**, gom dưới 1 **dòng tòa mẹ nền tím nhạt** (không đánh STT, không tính vào bảng tổng hợp). Dòng này đọc từ hồ sơ `BUILDING_MASTER`; thiếu hồ sơ thì móng, số tầng, độ nghiêng hiện `---`.
   - Căn hộ con kế thừa thông tin chung của tòa mẹ (Số nhà tòa nhà, Đường, Phường, Tên chung cư, Năm xây dựng, Khoảng cách GIS tới Metro) từ `parcels` + hồ sơ Master (`unit_id IS NULL`).

3. **Xuất toàn tuyến (`zoneId = ALL`)**: mỗi zone là **1 sheet độc lập**, nội dung như xuất riêng zone đó. Xem trước trên giao diện vẫn là bảng gộp toàn tuyến.

---

## Phần 2. Khối Đầu Trang & Bảng Tổng Hợp (Dòng 1 – Dòng 8)

Định nghĩa tại [`columns/templates/daily-progress-station.template.ts`](./columns/templates/daily-progress-station.template.ts) và [`summary/summary.calculator.ts`](./summary/summary.calculator.ts):

| Dòng Excel | Ô / Vùng Gộp | Nội dung hiển thị | Cách tính / Nguồn lấy số liệu |
| :--- | :--- | :--- | :--- |
| **Dòng 1** | `A1:AB1` | `BÁO CÁO KHẢO SÁT HIỆN TRẠNG CÔNG TRÌNH KHU VỰC ẢNH HƯỞNG TUYẾN METRO 2.1 GA <MÃ_GA>` | Tự động trích mã ga từ tên Zone (`Ga S5` → `ST05`). |
| **Dòng 2** | `A2:AB2` | Kỳ báo cáo: `Ngày dd/mm/yyyy` \| `Từ ngày ... đến ngày ...` \| `Lũy kế từ trước đến ngày ...` | Sinh tự động theo chế độ thời gian (`TODAY`, `DATE_RANGE`, `ALL_TIME`) tại [`rules/time-window.ts`](./rules/time-window.ts). |
| **Dòng 3** | `D3:I3` | Tiêu đề 6 cột bảng tổng hợp | `Số lượng cần khảo sát` (`D3`), `Số lượng đã khảo sát` (`E3`), `Không tiếp cận được` (`F3`), `Công trình có thông tin kết cấu móng` (`G3`), `Công trình cần theo dõi` (`H3`), `Công trình có nguy cơ cao` (`I3`). |
| **Dòng 4** | `C4:I4` | Nhóm **Phải Tuyến** | Thống kê các dòng có `alignmentSide = 'RIGHT'`. |
| **Dòng 5** | `C5:I5` | Nhóm **Trái Tuyến** | Thống kê các dòng có `alignmentSide = 'LEFT'`. |
| **Dòng 6** | `C6:I6` | **TỔNG SỐ LƯỢNG** | Tổng cộng Phải Tuyến + Trái Tuyến (+ Chưa rõ phía nếu có). |
| **Dòng 4–6** | `K4:L6` | Chú giải màu (Legend) | `K4: #E49EDD` = `Không tiếp cận được`<br>`K5: #FFFF00` = `ECS Kém / BRA Trung bình`<br>`K6: #FF0000` = `ECS Nguy hiểm / BRA Cao - Rất cao` |

---

## Phần 3. Bảng Chi Tiết 28 Cột (`A..AB`, Header ở Dòng 9–10, Dữ liệu từ Dòng 11)

Định nghĩa cột nằm tại [`columns/common.columns.ts`](./columns/common.columns.ts) và logic chuẩn hóa nằm tại [`rules/record.normalizer.ts`](./rules/record.normalizer.ts):

| Cột Excel | Key định danh | Nhóm Header (Dòng 9) | Tên Cột (Dòng 10) | Kiểu / Định dạng | Nguồn lấy dữ liệu & Thứ tự ưu tiên (Fallback) |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **A** | `COL.stt` | `STT` | `STT` | Số nguyên (`#,##0`) | Đánh số thứ tự tăng dần `1, 2, 3...` liên tục toàn sheet sau khi xếp Phần I (nhà dân) → Phần II (căn hộ gom theo tòa mẹ, theo tầng). Dòng Phần I/II và dòng tòa mẹ không đánh số. |
| **B** | `COL.startDate` | `Ngày bắt đầu KS` | `Ngày bắt đầu KS` | Ngày (`dd/mm/yyyy`) | Ưu tiên: `survey_data_json.surveyDate` → `base_survey_reports.survey_date` → `base_survey_reports.created_at` → `survey_absence_logs.first_recorded_at` (nếu vắng mặt). Quy đổi về ngày lịch múi giờ `Asia/Ho_Chi_Minh`. |
| **C** | `COL.endDate` | `Ngày hoàn thành KS` | `Ngày hoàn thành KS` | Ngày (`dd/mm/yyyy`) | - Nếu `Không tiếp cận được` hoặc hồ sơ mới ở trạng thái `DRAFT`: **Để trống**.<br>- Nếu đã `SUBMITTED / UNDER_REVIEW / APPROVED`: lấy `base_survey_reports.submitted_at` → `updated_at` → `startDate`. |
| **D** | `COL.area` | `Khu vực KS` | `Khu vực KS` | Chuỗi | Ghép `<Mã_Ga> <Phía_Tuyến>`, ví dụ: `ST05 Phải Tuyến`, `ST05 Trái Tuyến`. |
| **E** | `COL.houseNumber` | `Địa chỉ Công Trình` | `Số nhà` | Chuỗi | - **Nhà dân**: `survey_data_json.houseNumber` → `parcels.house_number` → tách số đầu từ `survey_data_json.address`.<br>- **Căn hộ con**: Ghép `<Mã_Căn> - <Tầng>`, ví dụ `B3 - Lầu 1`, `1.16`. |
| **F** | `COL.street` | `Địa chỉ Công Trình` | `Đường` | Chuỗi | `survey_data_json.street` → `master_json.street` → `parcels.street` → tách tên đường sau dấu phẩy từ `survey_data_json.address`. |
| **G** | `COL.ward` | `Địa chỉ Công Trình` | `Phường` | Chuỗi | `survey_data_json.ward` → `master_json.ward` → `parcels.ward`. |
| **H** | `COL.buildingName` | `Tên công trình- Số căn hộ (nếu có)` | `Tên công trình- Số căn hộ (nếu có)` | Chuỗi | - **Nhà dân**: `building_specifications.building_name` → `survey_data_json.buildingName`.<br>- **Căn hộ con**: Lấy tên tòa chung cư mẹ (`Chung cư 552-558`). |
| **I** | `COL.ownerName` | `Chủ sở hữu hoặc người sử dụng` | `Chủ sở hữu hoặc người sử dụng` | Chuỗi | `survey_data_json.ownerName` → `parcels.owner_name` / `building_units.owner_name` (lọc bỏ chuỗi placeholder địa chính `"Chủ hộ thửa..."`). |
| **J** | `COL.ownerPhone` | `Chủ sở hữu hoặc người sử dụng` | `Số điện thoại liên hệ` | Chuỗi | `survey_data_json.ownerPhone` → `parcels.owner_phone` / `building_units.owner_phone`. |
| **K** | `COL.landUse` | `Công năng sử dụng` | `Công năng sử dụng` | Chuỗi | `survey_data_json.usageFunction` → `building_specifications.land_use_function`, chuẩn hóa tại [`rules/usage-normalizer.ts`](./rules/usage-normalizer.ts) về `Nhà ở gia đình`, `Cửa hàng / Kinh doanh`, `Văn phòng`, `Khách sạn / Nhà nghỉ`, `Chung cư`, `Căn hộ chung cư`, `Hỗn hợp (Ở / Cửa hàng / VP)`, `Kho hàng / Xưởng sản xuất`; giá trị khác giữ nguyên (bỏ tiền tố `Khác:`). Tòa nhà không có dữ liệu thì để trống. |
| **L** | `COL.lengthM` | `Kích thước chính (m)` | `Dài` | Số thực (`0.0`) | - **Căn hộ con**: **Để trống (`null`)**.<br>- **Nhà dân**: Ưu tiên lấy từ hồ sơ đã nộp/duyệt `sub_dim.sub_lot_depth` (`SUBMITTED / UNDER_REVIEW / APPROVED`) → `survey_data_json.lotDepth` / `buildingLength` / `lengthM` → `parcels.lot_depth`. Không có thì để trống (`null`). |
| **M** | `COL.widthM` | `Kích thước chính (m)` | `Rộng` | Số thực (`0.0`) | - **Căn hộ con**: **Để trống (`null`)**.<br>- **Nhà dân**: Ưu tiên lấy từ hồ sơ đã nộp/duyệt `sub_dim.sub_frontage_width` (`SUBMITTED / UNDER_REVIEW / APPROVED`) → `survey_data_json.frontageWidth` → `parcels.frontage_width`. Không có thì để trống (`null`). |
| **N** | `COL.heightM` | `Kích thước chính (m)` | `Cao` | Số thực (`0.0`) | - **Căn hộ con**: **Để trống (`null`)**.<br>- **Nhà dân**: Ưu tiên lấy từ hồ sơ đã nộp/duyệt `sub_dim.sub_building_height` (`SUBMITTED / UNDER_REVIEW / APPROVED`) → `building_specifications.building_height_m` → `survey_data_json.buildingHeightM`. Không có thì để trống (`null`). |
| **O** | `COL.foundationType` | `KC móng` | `Loại móng` | Chuỗi | Quy đổi về 4 nhãn chuẩn: `Móng nông`, `Móng cọc`, `Móng cọc khoan nhồi`, `Không rõ` (Căn hộ con để trống). |
| **P** | `COL.foundationDepthM` | `KC móng` | `Chiều sâu móng` | Số thực (`0.0`) | `building_specifications.foundation_depth_m` → `survey_data_json.foundationDepthM` / `foundationDepth` (> 0). |
| **Q** | `COL.floors` | `Số tầng` | `Số tầng` | Số hoặc Chuỗi | Nhà dân: số tầng (`1, 2, 3...`). Căn hộ con: `"Trệt"`, `"Lầu 1"`, `"Lầu 2"`... |
| **R** | `COL.totalRooms` | `Tổng số phòng` | `Tổng số phòng` | Số nguyên | **Để trống (`null`)** theo quyết định nghiệp vụ. |
| **S** | `COL.constructionYear` | `Năm XD` | `Năm XD` | Số nguyên (`0`) | `building_specifications.construction_year` → `survey_data_json.constructionYear` → `master_year`. |
| **T** | `COL.condition` | `Tình trạng hiện tại (ECS)` | `Tình trạng hiện tại (ECS)` | Chuỗi + Tô màu | **Phân loại ECS (4 mức + Không tiếp cận)**: `Tốt` (`GOOD`), `Trung bình` (`MEDIUM`), `Kém` (`DEFICIENT`, vàng `#FFFF00`), `Nguy hiểm` (`CRITICAL`, đỏ `#FF0000`), `Không tiếp cận được` (`INACCESSIBLE`, hồng `#E49EDD`). |
| **U** | `COL.braRisk` | `Mức độ đánh giá rủi ro (BRA)` | `Mức độ đánh giá rủi ro (BRA)` | Chuỗi + Tô màu | **Phân loại BRA (4 mức)** tính lại từ **khoảng cách GIS hiện tại (`I1..I4`) × cấp tổn thương (`V1..V4`)** qua ma trận chuẩn 4×4 `BRA_MATRIX_LOOKUP`: `Thấp` (`LOW`), `Trung bình` (`MEDIUM`, vàng `#FFFF00`), `Cao` (`HIGH`, đỏ `#FF0000`), `Rất cao` (`VERY_HIGH`, đỏ `#FF0000`). |
| **V** | `COL.designUnit` | `Hồ sơ ` | `ĐV thiết kế` | Chuỗi | **Để trống (`""`)** theo quyết định nghiệp vụ. |
| **W** | `COL.constructionUnit` | `Hồ sơ ` | `ĐV thi công` | Chuỗi | **Để trống (`""`)** theo quyết định nghiệp vụ. |
| **X** | `COL.asBuiltDoc` | `Hồ sơ ` | `Hoàn công` | Chuỗi | `"Có"` / `"Không"` (Căn hộ con để trống). |
| **Y** | `COL.distanceCenterlineM` | `Khoảng cách đến CT Metro` | `Tim tuyến` | Số thực (`0.0`) | **Tính trực tiếp từ hình học GIS hiện tại**: khoảng cách ngắn nhất từ đa giác ranh `COALESCE(p.footprint_polygon_geom, p.cadastral_polygon_geom)` (hoặc điểm `p.location_geom`) tới 537 đỉnh tim tuyến Metro số 2 ([`geo/metro2-centerline.ts`](./geo/metro2-centerline.ts)). |
| **Z** | `COL.distanceEdgeM` | `Khoảng cách đến CT Metro` | `Biên KC` | Số thực (`0.0`) | **Tính trực tiếp từ hình học GIS hiện tại**: khoảng cách ngắn nhất từ đa giác ranh tới 12 đường bao kết cấu nhà ga / depot chuẩn CAD MAUR ([`geo/metro2-stations.ts`](./geo/metro2-stations.ts)) trong phạm vi `< 300m`. |
| **AA** | `COL.surveyStatus` | `Trạng thái KS` | `Trạng thái KS` | Chuỗi | `Đang khảo sát` \| `Hoàn thành khảo sát, đang làm báo cáo` \| `Hoàn thành khảo sát và báo cáo` \| `Hoàn thành khảo sát và báo cáo (Đã ký)`. |
| **AB** | `COL.notes` | `Ghi chú` | `Ghi chú` | Chuỗi | Ghép nối ghi chú hiện trường và lịch sử ghi nhận vắng mặt. |
