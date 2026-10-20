# KẾ HOẠCH TRIỂN KHAI PHÁT TRIỂN HỆ THỐNG KHẢO SÁT HIỆN TRẠNG CÔNG TRÌNH (KSQH METRO 2)
> **Tài liệu Bàn giao Kỹ thuật & Yêu cầu Chức năng (Technical Specification & Dev Handoff Plan)**  
> **Áp dụng chuẩn hóa 100% theo 2 biểu mẫu kỹ thuật:**  
> - `Phase 1_BCS_ECS_BRA.docx`: Khảo sát nền, tính điểm ECS, chỉ số tổn thương VI, ma trận rủi ro BRA.  
> - `Phase 2_Pre Constuction BCS.docx`: Khảo sát chi tiết chốt chặn trước thi công, sổ khuyết tật (Defect Register), chụp ảnh có thước đo mm, số hóa bản vẽ tay, so sánh Delta GĐ1-GĐ2, ký số 2 tầng (Mobile + Web).

---

## 1. NGUYÊN TẮC NGHIỆP VỤ & PHÂN TÁCH RẠCH RÒI 2 PHASE

```
   ┌─────────────────────────────────────────────────────────────────────────────┐
   │                HỆ THỐNG KHẢO SÁT HIỆN TRẠNG CÔNG TRÌNH METRO 2              │
   └──────────────────────────────────────┬──────────────────────────────────────┘
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
   ┌─────────────────────────────┐                 ┌─────────────────────────────┐
   │  GIAI ĐOẠN 1: PHASE 1 BCS   │                 │ GIAI ĐOẠN 2: PRE-CONSTRUCT. │
   │  (Khảo sát Nền & Đánh giá)  │                 │ (Khảo sát Chi tiết Chốt)    │
   ├─────────────────────────────┤                 ├─────────────────────────────┤
   │ 1. Thông tin công trình     │                 │ 1. Kế thừa dữ liệu Phase 1  │
   │ 2. Phạm vi & 4 ảnh định danh│                 │ 2. Phạm vi tiếp cận chi tiết│
   │ 3. Lịch sử & Nhạy cảm       │                 │ 3. Biến động từ sau Phase 1 │
   │ 4. Sàng lọc BCS (8 nhóm)    │                 │ 4. Khảo sát theo Tầng/Phòng │
   │ 5. Sổ khuyết tật sơ bộ      │                 │ 5. SỔ KHUYẾT TẬT (D-01..99) │
   │ 6. Dấu hiệu lún/nghiêng     │ ── KẾ THỪA ───► │ 6. Đo lún/nghiêng nhanh     │
   │ 7. Hồ sơ ảnh khuyết tật     │    (BẮT BUỘC)   │ 7. Ảnh bối cảnh CTX +       │
   │ 8. Sơ đồ vị trí khuyết tật  │                 │    Ảnh cận cảnh thước đo CU │
   │ 9. Thang hư hỏng Burland    │                 │ 8. Ảnh chụp bản vẽ vẽ tay   │
   │ 10. Cờ kết cấu & Override   │                 │ 9. SO SÁNH DELTA VẾT NỨT    │
   │ 11. Tính điểm ECS (E1-E6)   │                 │ 10. Tóm tắt & Cảnh báo nguy │
   │ 12. Cổng kiểm tra Data Gate │                 │ 11. Ý kiến chủ sở hữu       │
   │ 13. Tính chỉ số VI (V1-V6)  │                 │ 12. KÝ SỐ 4 BÊN (Mobile+Web)│
   │ 14. Tác động Metro (AutoGIS)│                 │ 13. CHECKLIST PHỤ LỤC A     │
   │ 15. Ma trận rủi ro BRA      │                 │ 14. MÃ HÓA ẢNH PHỤ LỤC B    │
   │ 16. Khuyến nghị & Xác nhận  │                 └─────────────────────────────┘
   └─────────────────────────────┘
```

---

## 2. ĐẶC TẢ CHI TIẾT TỪNG TRƯỜNG DỮ LIỆU PHASE 1 (PHASE 1 SPECIFICATION)

| Mục biểu mẫu | Tên trường / Chỉ số | Loại dữ liệu / Tùy chọn | Mô tả nghiệp vụ & Thuật toán xử lý |
| :--- | :--- | :--- | :--- |
| **Mục 1: Thông tin công trình** | `building_id` / Mã CT | `VARCHAR(50)` | Mã định danh chuẩn: `B-Quận-Ga-SốThứTự` (VD: `B-Q03-S09-0128`). |
| | `building_name` / Tên CT | `VARCHAR(150)` | Tên tòa nhà hoặc họ tên chủ hộ. |
| | `address` / Địa chỉ | `TEXT` | Số nhà, tên đường, Phường, Quận. |
| | `owner_info` / Chủ sở hữu | `TEXT` | Họ tên, SĐT, CCCD người đại diện. |
| | `building_use` / Công năng | `ENUM` | `Nhà ở`, `Cửa hàng`, `Văn phòng`, `Khách sạn`, `Công cộng`, `Khác`. |
| | `importance_group` / Nhóm | `ENUM` | `General` (Phổ thông), `Important` (Quan trọng), `Critical` (Đặc biệt). |
| | `storeys_above` / `storeys_basement` | `INT` / `INT` | Số tầng nổi (Trệt + lầu) / Số tầng hầm. |
| | `construction_year` / Năm XD | `INT`, `BOOLEAN` | Năm xây dựng + Checkbox xác nhận `Ước tính`. |
| | `structural_system` / Hệ kết cấu | `ENUM` | `RC` (BTCT), `Steel` (Thép), `Masonry` (Gạch/Đá), `Mixed` (Hỗn hợp), `Other`. |
| | `structural_form` / Chịu lực | `ENUM` | `Frame` (Khung), `Wall` (Tường chịu lực), `Mixed`, `Other`. |
| | `foundation_type` / Loại móng | `ENUM` | `Shallow` (Nông), `Wood` (Cừ tràm), `PC` (Cọc BTCT), `CIP` (Cọc khoan nhồi), `Unknown`. |
| | `foundation_cat` / CAT móng | `INT (1-5)` | Mức độ tin cậy thông tin móng (Cat 1: Có bản vẽ; Cat 5: Không rõ). |
| | `foundation_source` / Nguồn | `ENUM` | `Drawing` (Bản vẽ), `Owner` (Chủ nhà nói), `Site` (Khảo sát thực địa). |
| | `access_condition` / Tiếp cận | `ENUM` | `Đầy đủ`, `Một phần`, `Chỉ ngoài`, `Từ chối/vắng`. |
| | `adjacent_context` / Liền kề | `ENUM` | `Nhà phố`, `Cao tầng`, `Công cộng`, `Đất trống`, `Khác`. |
| **Mục 2: Phạm vi & Ảnh định danh** | `surveyed_scope` / Phạm vi | `MULTI-CHOICE` | `Ngoài`, `Trong`, `Mái`, `Hầm`, `Khu phụ`. |
| | `access_restriction` / Hạn chế | `BOOLEAN` + `TEXT` | Có/Không + Lý do hạn chế nếu có. |
| | `photo_p01` (Số nhà/biển tên) | `PHOTO + WATERMARK` | Mã `B-XXXX-P01` (Bắt buộc). |
| | `photo_p02` (Mặt đứng chính) | `PHOTO + WATERMARK` | Mã `B-XXXX-P02` (Bắt buộc). |
| | `photo_p03` (Bên/sau) | `PHOTO + WATERMARK` | Mã `B-XXXX-P03` (Tùy chọn). |
| | `photo_p04` (Bối cảnh tổng thể) | `PHOTO + WATERMARK` | Mã `B-XXXX-P04` (Bắt buộc). |
| | `chainage_km` & `distance_to_metro` | `AUTO POSTGIS` | Tự động tính từ tọa độ GPS và tim tuyến Metro. |
| **Mục 3: Lịch sử & Nhạy cảm** | 6 Yếu tố nhạy cảm | `ENUM(Có/Không/Chưa rõ)` | Cơi nới; Sửa chữa lớn; Lún/nghiêng cũ; Hư hỏng do CT lân cận; Hỏa hoạn/ngập; Thiết bị nhạy cảm. |
| | Tình trạng sử dụng | `ENUM` | `Đầy đủ`, `Một phần`, `Không sử dụng`, `Vận hành liên tục (24/7)`. |
| **Mục 4: BCS Sàng lọc Hiện trạng** | 8 Nhóm chỉ báo hiện tượng | `CHECKBOX + TEXT` | 1. Nứt tường; 2. Nứt kết cấu chịu lực; 3. Lún/nghiêng/võng; 4. Thấm ẩm; 5. Bong tróc/ăn mòn cốt thép; 6. Mất tiết diện/hư liên kết; 7. Kẹt cửa/nứt góc cửa; 8. Dấu hiệu đang phát triển/tái nứt. |
| **Mục 5-8: Sổ khuyết tật sơ bộ** | `preliminary_defects` | `LIST (D-01..D-09)` | Vị trí, Loại khuyết tật, $w_{max}$ (mm), Chiều dài (m), Hướng nứt, Ảnh ID, Ghi chú. |
| **Mục 9: Thang đo Burland** | `burland_predominant` | `INT (0-5)` | Cấp độ nứt tường phổ biến nhất (Grade 0: <0.1mm $\rightarrow$ Grade 5: >25mm). |
| | `burland_local_max` | `INT (0-5)` | Cấp độ nứt tường lớn nhất cục bộ. |
| **Mục 10: Structural Override** | `structural_flag` | `ENUM` | `NONE`, `LOW`, `MODERATE`, `HIGH`, `CRITICAL`. Kích hoạt khi có nứt kết cấu. |
| **Mục 11: Điểm hiện trạng ECS** | $E_1$: Nứt kết cấu chịu lực | `INT (0-4)` | 0=Không; 1=Cục bộ $\le 0.2mm$; 2=Đáng kể $\le 1mm$; 3=Nặng $>1mm$; 4=Nguy cấp. |
| | $E_2$: Nứt tường/khối xây | `INT (0-4)` | 0=Không; 1=Burland 1-2; 2=Burland 3; 3=Burland 4; 4=Burland 5. |
| | $E_3$: Lún/nghiêng/võng | `INT (0-4)` | 0=Không; 1=Nhẹ; 2=Đáng kể; 3=Nặng; 4=Nguy hiểm. |
| | $E_4$: Thấm ẩm/bong tróc/rỉ | `INT (0-4)` | 0=Không; 1=Cục bộ; 2=Đáng kể; 3=Nặng lộ rỉ thép; 4=Phá hủy. |
| | $E_5$: Lịch sử/cơi nới/sự cố | `INT (0-4)` | 0=Không; 1=Nhẹ đã xử lý; 2=Nhiều/chưa rõ; 3-4=Thay đổi lớn/sự cố. |
| | $E_6$: Chức năng/tổng thể | `INT (0-4)` | 0=Tốt; 1=Trung bình; 2=Kém; 3-4=Nguy cấp. |
| | $\Sigma E$ (Tổng điểm ECS) | `INT (0-24)` | $\Sigma E = E_1 + E_2 + E_3 + E_4 + E_5 + E_6$. |
| | $ECS_{class}$ | `ENUM` | `GOOD` [0-5], `MEDIUM` [6-10], `DEFICIENT` [11-16], `CRITICAL` [17-24]. |
| | **Luật Override bắt buộc** | `RULE` | **Nếu $E_1 \ge 3$ hoặc $E_3 \ge 3 \rightarrow$ Cấm gán GOOD/MEDIUM, bắt buộc $\ge$ DEFICIENT**. |
| **Mục 12: Data Completeness Gate** | 6 Cổng kiểm tra đủ dữ liệu | `BOOLEAN` | Thông tin móng; Ảnh/damage mapping; Khảo sát bên trong; Dữ liệu lún; Bản vẽ; Structural review. Cho phép sang BRA: `Có`, `Có điều kiện`, `Chưa`. |
| **Mục 13: Chỉ số Tổn thương VI** | $V_1$: Công năng/hậu quả | `INT (1-4)` | General=1, Important=2, Critical=4. |
| | $V_2$: Hệ kết cấu | `INT (1-4)` | Robust=1, Moderate=2, Masonry/irregular=3, Fragile=4. |
| | $V_3$: Móng | `INT (1-4)` | Tự động ánh xạ từ `foundation_cat` (Cat 1=1 $\rightarrow$ Cat 5=4). |
| | $V_4$: Tuổi đời/cơi nới | `INT (1-4)` | Mới=1, Trung bình=2, Cũ=3, Rất cũ=4. |
| | $V_5$: Hiện trạng ECS | `INT (1-4)` | Tự động ánh xạ từ $ECS_{class}$ (Good=1, Medium=2, Deficient=3, Critical=4). |
| | $V_6$: Thiết bị nhạy cảm | `INT (1-4)` | Không=1, Thấp=2, Cao=3, Rất cao=4. |
| | $VI_{avg}$ (Điểm trung bình) | `FLOAT (1.0-4.0)` | $VI_{avg} = \frac{\sum V_i}{6}$. Phân loại: `Low` ($\le 1.5$), `Medium` (1.5-2.5), `High` (2.5-3.25), `Very High` ($>3.25$). |
| **Mục 14: Tác động Thi công (I)** | Thông số Metro & Dự báo | `AUTO / INPUT` | Loại CT Metro; Lý trình [Auto]; Khoảng cách [Auto]; Lún $S_{max}$; Góc $\theta$; Rung $PPV$. Cấp $I$: $I_1$ Thấp $\rightarrow I_4$ Rất cao hoặc `Pending`. |
| **Mục 15: Ma trận Rủi ro BRA** | Kết quả $BRA = V \times I$ | `ENUM` | `LOW`, `MEDIUM`, `HIGH`, `VERY_HIGH` hoặc `PENDING`. |
| **Mục 16: Khuyến nghị Hành động** | Hành động tối thiểu | `ENUM` | Lưu baseline / Thiết lập quan trắc / Khảo sát chi tiết / Hold point gia cường. |
| **Mục 18: Record Control** | Phê duyệt hồ sơ Phase 1 | `USER & TIME` | Cán bộ khảo sát, Người kiểm tra, Zone Manager duyệt (`APPROVED`). |

---

## 3. ĐẶC TẢ CHI TIẾT TỪNG TRƯỜNG DỮ LIỆU PHASE 2 (PHASE 2 SPECIFICATION)

| Mục biểu mẫu | Tên trường / Chỉ số | Loại dữ liệu / Tùy chọn | Mô tả nghiệp vụ & Thuật toán xử lý |
| :--- | :--- | :--- | :--- |
| **Mục 1: Thông tin & Tham chiếu P1** | `building_id` & `phase1_ref_id` | `UUID & VARCHAR` | **Bắt buộc liên kết khóa ngoại với hồ sơ Phase 1 đã duyệt (`APPROVED`)**. |
| | Thông tin công trình & Đội KS | `INHERITED + TEXT` | Tự động nạp tên, địa chỉ, chủ hộ; Nhập ngày KS GĐ2, Mã đội KS, Trưởng nhóm. |
| **Mục 2: Phạm vi & Tiếp cận chi tiết** | `access_status` | `ENUM` | `Đầy đủ`, `Một phần`, `Bị hạn chế`, `Từ chối/Vắng mặt`. |
| | `restriction_reason` | `ENUM + TEXT` | Chủ nhà vắng, Khóa cửa, Khu vực nguy hiểm, Chủ nhà từ chối, Khác. |
| | `surveyed_areas` / Khu vực | `MULTI-CHOICE` | Mặt tiền, Mái, Sân rào, Trệt/Tầng 1, Tầng 2, Tầng 3+, Tầng hầm, Khu phụ. |
| | 4 Ảnh nhận dạng hiện trường | `PHOTOS` | P-01 (Biển số), P-02 (Mặt đứng), P-03 (Bên/Sau), P-04 (Bối cảnh). |
| **Mục 3: Biến động sau Phase 1** | `repairs_since_phase1` | `BOOLEAN + TEXT` | Có sửa chữa/cải tạo/cơi nới mới kể từ Phase 1 không + Mô tả. |
| | `new_external_damages` | `BOOLEAN + TEXT` | Có hư hại mới do nguyên nhân khác (lân cận đào móng, ngập...) không. |
| | `current_usage_state` | `ENUM` | `Ổn định`, `Đang sửa chữa`, `Bỏ trống`, `Đổi công năng`. |
| **Mục 4: Khảo sát theo Tầng/Phòng** | `room_by_room_matrix` | `LIST MATRIX` | Tầng $\rightarrow$ Phòng/Khu vực $\rightarrow$ Cấu kiện (Cột, Dầm, Tường, Sàn, Trần, Cửa, Cầu thang) $\rightarrow$ Trạng thái (Bình thường / Có khuyết tật). |
| **Mục 5: SỔ KHUYẾT TẬT CHI TIẾT** | `defect_code` / Mã KT | `VARCHAR(20)` | Đánh số thứ tự tăng dần: `D-01`, `D-02`, `D-03`... |
| | `location_detail` / Vị trí | `TEXT` | Tầng, Tên phòng, Cấu kiện, Vật liệu (BTCT, Gạch, Thép, Vữa trát...). |
| | `defect_type` / Loại khuyết tật | `ENUM` | `Nứt`, `Lún/Nghiêng`, `Võng/Biến dạng`, `Bong tróc/Tách lớp`, `Ăn mòn/Lộ thép`, `Thấm/Ẩm`, `Hư hỏng hoàn thiện`, `Kẹt cửa`. |
| | `max_crack_width_mm` ($w_{max}$) | `FLOAT` | **Bề rộng vết nứt lớn nhất (mm)** đo bằng thước đo khe nứt (Crack Scale). |
| | `crack_length_m` ($L$) | `FLOAT` | Chiều dài vết nứt (mét) hoặc diện tích hư hỏng ($m^2$). |
| | `crack_direction` / Hướng nứt | `ENUM` | `Chéo 45°`, `Thẳng đứng`, `Nằm ngang`, `Ziczac mạch vữa`, `Chữ X`, `Mạng nhện`, `Ngẫu nhiên`. |
| | `activity_status` / Hoạt động | `ENUM` | `Tĩnh (Không đổi)`, `Đang phát triển`, `Đã sửa tái nứt`, `Chưa rõ`. |
| | **`comparison_with_phase1` (DELTA)** | `ENUM` | **`Không đổi (Unchanged)`**, **`Phát triển rộng hơn`**, **`Phát triển dài hơn`**, **`Đã sửa chữa`**, **`Mới ghi nhận (New)`**. |
| **Mục 6: Dấu hiệu lún/nghiêng** | Đo đạc biến dạng nhanh | `TABLE` | Vị trí đo; Đối tượng; Độ lệch (mm/độ); Phương pháp (Dây rọi, Laser, Nivô); Ảnh; Nhận xét. |
| **Mục 7: Hồ sơ ảnh khuyết tật** | **Ảnh bối cảnh (`CTX`)** | `PHOTO + WATERMARK` | Thể hiện toàn cảnh vị trí vết nứt trong phòng/khu vực (Mã: `B-XXXX-Fxx-Rxx-Dxx-CTX`). |
| | **Ảnh cận cảnh (`CU`)** | `PHOTO + WATERMARK` | **BẮT BUỘC có thước đo tỷ lệ hệ mét áp sát vết nứt** (Mã: `B-XXXX-Fxx-Rxx-Dxx-CU`). |
| **Mục 8: Bản vẽ sơ đồ phác thảo** | `hand_drawn_sketch_photo` | `PHOTO + PINNING` | **Chụp ảnh tờ giấy vẽ phác thảo tay mặt bằng + Chạm ngón tay để ghim các mã `D-01`, `D-02` lên ảnh**. |
| **Mục 9: So sánh Delta & Tóm tắt** | Thống kê số lượng | `AUTO STATS` | Tổng số khuyết tật; Số ảnh; Số bản vẽ; Đếm số vết nứt mới / phát triển. |
| | **`has_critical_damage_alert`** | `BOOLEAN` | **CẢNH BÁO NGUY CẤP (Có $\rightarrow$ Báo động khẩn cấp ngay cho CĐT/Tư vấn)**. |
| | `monitoring_demand` | `MULTI-CHOICE` | Nhu cầu quan trắc bổ sung: `Không`, `Lún`, `Nghiêng`, `Nứt`, `Rung`. |
| | `overall_condition_summary` | `ENUM` | `Ổn định theo quan sát`, `Có hư hỏng cần theo dõi`, `Cần đánh giá chuyên sâu`. |
| **Mục 11: Ý kiến chủ sở hữu** | `owner_comments` | `TEXT` | Ghi nhận nguyên văn ý kiến của chủ hộ tại hiện trường (hoặc chọn `Không có ý kiến khác`). |
| **Mục 12: Ký số lai 4 bên** | **1. Chủ sở hữu / Người sử dụng** | `E-SIGN MOBILE` | Ký trực tiếp trên màn hình cảm ứng điện thoại (kèm GPS + Timestamp). |
| | **2. Cán bộ khảo sát / Liên danh** | `E-SIGN MOBILE` | Ký trực tiếp trên màn hình cảm ứng điện thoại. |
| | **3. Đại diện Nhà thầu thi công** | `E-SIGN WEB` | Đăng nhập tài khoản Web Portal để thẩm định và ký số sau. |
| | **4. Chính quyền / Đại diện TDP** | `E-SIGN WEB` | Đăng nhập tài khoản Web Portal để ký xác nhận sau. |
| | `is_refused` / Từ chối ký | `BOOLEAN + TEXT` | Lập biên bản từ chối khảo sát / vắng mặt kèm lý do theo luật. |
| **Phụ lục A: Checklist Nghiệm thu** | 10 Tiêu chí Gatekeeper | `CHECKLIST` | Kiểm tra tự động trước khi Submit: Đủ 4 ảnh nhận diện, đủ cặp ảnh CTX+CU, có bản vẽ tay, có chữ ký... |
| **Phụ lục B: Quy tắc mã ảnh** | Chuẩn hóa tên file | `RULE ENGINE` | Sinh mã tự động không cho sửa tự do để bảo đảm tính chuỗi hành trình chứng cứ (Chain of Custody). |

---

## 4. ĐẶC TẢ TỐI ƯU HÓA TRẢI NGHIỆM GIAO DIỆN HIỆN TRƯỜNG (FIELD UI/UX OPTIMIZATION SPECIFICATION)

Khảo sát thực địa ~7.000 căn nhà tại TP.HCM diễn ra trong điều kiện khắc nghiệt: trời nắng gắt chói màn hình, ngõ hẻm tối, nhà chật hẹp, cán bộ một tay cầm điện thoại, một tay cầm thước đo hoặc bút ghi chép. Vì vậy, UI/UX được tối ưu theo 8 tiêu chuẩn công thái học hiện trường:

```
                  ┌──────────────────────────────────────────────────────────┐
                  │    8 TIÊU CHUẨN TỐI ƯU UI/UX CHO KHẢO SÁT THỰC ĐỊA       │
                  └─────────────────────────────┬────────────────────────────┘
                                                │
       ┌────────────────────────┬───────────────┴───────────────┬────────────────────────┐
       ▼                        ▼                               ▼                        ▼
┌──────────────┐        ┌──────────────┐                ┌──────────────┐         ┌──────────────┐
│  THUMB ZONE  │        │ CHỐNG CHÓI   │                │ CAMERA HUD   │         │ KÝ SỐ LỚN    │
│  THAO TÁC 1  │        │ NẮNG GẮT     │                │ KHUNG CĂN    │         │ CHỦ HỘ       │
│  TAY TIỆN LỢI│        │ HIGH CONTRAST│                │ THƯỚC ĐO MM  │         │ THÂN THIỆN   │
└──────────────┘        └──────────────┘                └──────────────┘         └──────────────┘
       ▲                        ▲                               ▲                        ▲
       │                        │                               │                        │
┌──────────────┐        ┌──────────────┐                ┌──────────────┐         ┌──────────────┐
│ NHẬP GIỌNG   │        │ GHIM BẢN VẼ  │                │ TIẾN ĐỘ &    │         │ TỰ ĐỘNG LƯU  │
│ NÓI & CHIPS  │        │ TAY MÀU SẮC  │                │ CẢNH BÁO THIẾU│       │ 3S / OFFLINE │
│ CHỌN NHANH   │        │ PIN ZOOM 3X  │                │ CHECKLIST HUD│         │ PIN YẾU VẪN AN│
└──────────────┘        └──────────────┘                └──────────────┘         └──────────────┘
```

### 4.1. Công thái học Một tay (One-Handed Thumb Zone Ergonomics)
- **Khu vực tương tác chính**: 100% các nút hành động quan trọng (*Tiếp tục, Chụp ảnh, Thêm khuyết tật, Lưu nháp*) được đặt ở **dưới cùng màn hình (Bottom Sheet / Fixed Bottom Bar)** trong tầm với của ngón cái.
- **Kích thước vùng chạm (Touch Target)**: Tối thiểu $48 \times 48\text{ dp}$, khoảng cách giữa các nút $\ge 12\text{ dp}$ để không bị bấm nhầm khi cán bộ đang đi lại hoặc đeo găng tay.
- **Bộ nút tăng giảm nhanh (+ / - Steppers)** cho trường bề rộng vết nứt $w_{max}$ (nhảy theo bước $0.1\text{ mm}$ hoặc $0.5\text{ mm}$) thay vì bắt buộc gõ bàn phím ảo.

### 4.2. Chế độ Chống chói nắng Ngoài trời (Sunlight High-Contrast Mode)
- **Giao diện Nền sáng Siêu tương phản (Ultra High Contrast)**: Tỷ lệ tương phản chữ/nền $\ge 7:1$ (chuẩn WCAG AAA) giúp cán bộ nhìn rõ từng con số khi đứng ngoài đường dưới ánh nắng gắt $38^\circ\text{C}$.
- **Font chữ kỹ thuật rõ ràng**: Sử dụng font *Inter* hoặc *Outfit* kích thước lớn ($\ge 16\text{ sp}$ cho nội dung và $\ge 20\text{ sp}$ cho tiêu đề), các mã định danh (`B-0128`, `D-01`) hiển thị font *JetBrains Mono* in đậm.

### 4.3. Nhập liệu Siêu tốc: Danh mục Chọn nhanh (Chips) & Giọng nói (Voice-to-Text)
- **Thư viện Chip từ khóa kỹ thuật có sẵn**: Cán bộ không cần gõ bàn phím chữ dài, chỉ cần chạm chọn các chip:
  - *Vị trí:* `[Mặt tiền]`, `[Phòng khách]`, `[Bếp]`, `[Cột C1]`, `[Dầm D2]`, `[Góc cửa]`.
  - *Mô tả khuyết tật:* `[Nứt chân chim]`, `[Nứt chéo 45°]`, `[Thấm chân tường]`, `[Bong rộp vữa]`, `[Rỉ thép lộ thiên]`.
- **Nhập giọng nói tiếng Việt chuyên ngành (Voice-to-Text Button)**: Tích hợp micro ghi âm chuyển giọng nói thành văn bản cho phần "Ý kiến chủ hộ" và "Ghi chú đặc biệt".

### 4.4. Camera HUD Thông minh & Tự động Cặp đôi Ảnh (Smart Capture HUD)
- **Giao diện Camera chuyên dụng**:
  - Khi chụp ảnh bối cảnh (`CTX`): Hiện khung lưới $3 \times 3$ và thước thủy điện tử (Level indicator) để tránh chụp bị nghiêng.
  - Khi chụp ảnh cận cảnh (`CU`): **Hiện khung định vị chữ nhật màu vàng gợi ý đặt Thước đo khe nứt (Crack Scale Card)**.
- **Chế độ Chụp liên hoàn Cặp ảnh (One-Flow CTX + CU Capture)**: Chụp xong ảnh bối cảnh CTX, camera tự động chuyển sang chế độ cận cảnh CU mà không cần bấm thoát ra ngoài danh sách, giảm 60% số thao tác chạm.

### 4.5. UI Ghim Điểm Khuyết Tật trên Bản vẽ Tay (Pinch-to-Zoom & Pinning)
- **Thao tác 2 ngón phóng to thu nhỏ (Pinch-to-Zoom)** tờ giấy vẽ phác thảo tay lên đến 300%.
- **Chạm 1 chạm để thả ghim (Tap-to-Pin)**:
  - Ghim tự động gán mã tăng dần `D-01`, `D-02`...
  - Màu sắc ghim phân loại trực quan theo mức độ nguy hiểm:
    - 🟢 *Xanh lá:* Nứt nhẹ chân chim ($w < 1\text{ mm}$, Burland Grade 0–1).
    - 🟡 *Vàng:* Nứt trung bình ($w = 1 - 5\text{ mm}$, Burland Grade 2).
    - 🔴 *Đỏ:* Nứt kết cấu / Nguy hiểm ($w > 5\text{ mm}$ hoặc nứt cột dầm).

### 4.6. Khung Ký số Toàn màn hình Thân thiện với Người lớn tuổi (Senior-Friendly E-Sign Pad)
- Khi đến bước ký số của chủ nhà, app tự động xoay ngang màn hình (Landscape) mở ra **Bảng ký số cảm ứng cực lớn (Full Screen)**:
  - Nét mực điện tử mịn màng, rõ nét, dễ viết bằng ngón tay.
  - Hiển thị tóm tắt bằng tiếng Việt cỡ chữ lớn: *"Tôi xác nhận đã cùng đoàn khảo sát ghi nhận hiện trạng căn nhà..."*.
  - Nút **`🗑️ Ký lại`** và nút **`✅ Xác nhận`** to, màu sắc tương phản rõ ràng.

### 4.7. Thanh Chỉ báo Tiến độ & Cảnh báo Thiếu sót (HUD Completeness Gauge)
- Phía trên cùng màn hình luôn có thanh đo tiến độ hoàn thành (%):
  - Khi còn thiếu trường dữ liệu bắt buộc (VD: *Chưa chụp ảnh cận cảnh CU của D-02* hoặc *Chưa đánh giá móng*), hệ thống hiện dòng cảnh báo màu cam: `⚠️ Còn thiếu 1 ảnh thước đo tại D-02`.
  - Bấm vào cảnh báo sẽ tự động cuộn màn hình đến đúng vị trí còn thiếu.

### 4.8. Chế độ Tự động Lưu Nháp 3 Giây & An toàn Pin (Auto-Save & Crash-Proof)
- Tự động lưu toàn bộ dữ liệu vào CSDL cục bộ trên máy sau mỗi 3 giây. Nếu điện thoại hết pin đột ngột hoặc bị tắt app, khi bật lại cán bộ chỉ cần mở app là tiếp tục đúng bước đang làm dở mà không mất 1 dòng dữ liệu nào.

---

## 5. TỐI ƯU GIAO DIỆN THẨM ĐỊNH WEB PORTAL (WEB AUDIT UI OPTIMIZATION)

Dành cho Zone Manager, Đại diện Nhà thầu và Chính quyền địa phương duyệt hồ sơ tại văn phòng:

1. **Màn hình Chia đôi Đối soát (Split-Pane Inspection)**:
   - *Nửa bên trái:* Hiển thị ảnh bản vẽ vẽ tay có gắn các ghim khuyết tật $D-01, D-02$. Click vào ghim nào thì bên phải tự động nhảy đến chi tiết vết nứt đó.
   - *Nửa bên phải:* Bảng thông số kỹ thuật + Cặp ảnh CTX và CU.
2. **Kính lúp Soi Vạch Thước Đo (High-Precision Zoom Loupe)**: Rê chuột lên ảnh cận cảnh `CU` sẽ kích hoạt kính lúp phóng to $400\%$ để thẩm định viên đọc rõ từng vạch milimet trên thước đo khe nứt của ảnh hiện trường.
3. **Thanh Radar Kiểm tra Sai lệch GPS (Dual-GPS Anti-fraud Radar)**: Hiển thị vòng tròn khoảng cách giữa tọa độ lúc chụp ảnh và tọa độ tâm nhà. Nếu lệch $>50\text{ m}$ sẽ nhấp nháy viền đỏ cảnh báo.
4. **Phím tắt Duyệt Nhanh (Auditor Hotkeys)**:
   - `Phím A`: Phê duyệt hồ sơ (*Approve*).
   - `Phím R`: Mở hộp thoại trả về (*Reject*).
   - `Phím Phải / Trái`: Chuyển nhanh sang công trình tiếp theo.

---

## 6. LỘ TRÌNH PHÂN CHIA SPRINT BÀN GIAO CHO ĐỘI DEV (DEV BACKLOG)

| Sprint | Phân hệ | Nhiệm vụ chi tiết bàn giao cho Dev | Tiêu chí nghiệm thu (DoD) |
| :--- | :--- | :--- | :--- |
| **Sprint 1** | **CSDL & Core Backend** | - Xây dựng schema PostGIS đầy đủ 100% các trường của Phase 1 & 2.<br>- Xây dựng Auth & RBAC 5 vai trò (Admin, Manager, Surveyor, Contractor, Official).<br>- Tích hợp S3/Cloudflare R2 presigned upload. | CSDL PostgreSQL sẵn sàng, Postman Collection test đầy đủ API auth và media. |
| **Sprint 2** | **Assessment & Rule Engine** | - Lập trình module tính toán: ECS, Override rule, VI, CAT móng, ma trận BRA.<br>- Cài đặt PostGIS tự động tính Chainage và khoảng cách tim hầm.<br>- Cài đặt **Prerequisite Middleware** khóa Phase 2 khi chưa duyệt Phase 1. | 100% Unit test pass các ca kiểm thử biên (Edge Cases) về override kết cấu và khóa kế thừa. |
| **Sprint 3** | **Mobile Phase 1 (UI Tối ưu Công thái học)** | - Xây dựng Wizard Phase 1 đầy đủ 18 mục với UI High-Contrast, Thumb zone.<br>- Camera tự động in Watermark pháp lý.<br>- Chip chọn nhanh và Stepper tăng giảm kích thước nứt. | Cán bộ khảo sát xong 1 căn nhà Phase 1 chuẩn 100% biểu mẫu trên điện thoại mượt mà. |
| **Sprint 4** | **Mobile Phase 2 & Sổ Khuyết Tật (UI Ghim & Ký số)** | - Xây dựng Wizard Phase 2 kế thừa dữ liệu Phase 1.<br>- Module chụp ảnh bản vẽ vẽ tay và Pinch-to-zoom chạm ghim $D-01..D-99$.<br>- Camera HUD có khung căn thước đo khe nứt và chụp liên hoàn CTX+CU.<br>- Bảng ký số cảm ứng xoay ngang toàn màn hình cho Chủ hộ và Surveyor. | Hoàn thành trọn vẹn hồ sơ Phase 2 ngoài hiện trường có chữ ký lưu về server. |
| **Sprint 5** | **Web Portal Thẩm Định & Ký Số (UI Split-Pane)** | - Màn hình Thẩm định động: Chia đôi đối soát bản vẽ tay có ghim và ảnh cận cảnh.<br>- Kính lúp soi vạch thước mm $400\%$ và Radar cảnh báo sai lệch GPS $>50\text{ m}$.<br>- Cổng ký số trên Web cho Nhà thầu và Đại diện Tổ dân phố / UBND Phường.<br>- Phê duyệt $\rightarrow$ Cập nhật ngược Footprint đa giác mái nhà lên bản đồ GIS. | Quy trình thẩm định và ký số 4 bên hoàn tất trên Web Portal. |
| **Sprint 6** | **Offline SQLite Sync & UAT** | - Cài đặt `sqflite` và `path_provider` trên Mobile.<br>- Thiết kế `LocalDatabaseService` (Bảng `drafts`, `offline_queue`).<br>- Nâng cấp `DraftService` tự động lưu 3 giây/lần (Timer).<br>- Background worker / Connectivity listener tự động đồng bộ (sync) hồ sơ khi có mạng.<br>- Tích hợp thông báo UI: "Đang lưu nháp...", "Đã đồng bộ cục bộ". | App hoạt động ổn định 100% kể cả khi mất sóng, không mất dữ liệu. |

## 6.1 KẾ HOẠCH KỸ THUẬT SPRINT 6: OFFLINE SQLITE

> [!IMPORTANT]  
> **Cần ý kiến phê duyệt**: Bạn có đồng ý với kiến trúc SQLite dưới đây trước khi tôi bắt đầu code không?

### 1. Cấu trúc CSDL SQLite (Local)
Sử dụng package `sqflite`. Sẽ có 2 bảng chính:
- `drafts` (Lưu nháp thời gian thực): `id`, `phase`, `building_id`, `json_data`, `last_saved`
- `sync_queue` (Hàng đợi đồng bộ): `id`, `endpoint`, `payload_json`, `status`, `retry_count`

### 2. Auto-save Engine
- Trong `phase1_wizard_view.dart` và `phase2_wizard_view.dart`, thiết lập một `Timer.periodic` chạy mỗi 3 giây.
- Mỗi 3 giây, serialize toàn bộ Model hiện tại thành JSON và UPSERT vào bảng `drafts`.

### 3. Background Sync (Đồng bộ ngầm)
- Khi nộp hồ sơ (`submitPhase1` / `submitPhase2`), nếu có mạng: Gửi lên server.
- Nếu không có mạng (`DioException` kết nối): Lưu payload vào `sync_queue` và báo "Đã lưu offline".
- Mỗi khi app khởi động lại hoặc có mạng (dùng `connectivity_plus`), hệ thống tự động quét `sync_queue` và gửi lại các hồ sơ bị kẹt.

### 4. Thay đổi mã nguồn (Dự kiến)
- **[MODIFY]** `pubspec.yaml` (Thêm `sqflite`, `path_provider`, `connectivity_plus`).
- **[NEW]** `lib/services/local_db_service.dart` (Khởi tạo DB, tạo bảng).
- **[MODIFY]** `lib/services/draft_service.dart` (Chuyển từ SharedPreferences sang SQLite).
- **[MODIFY]** `lib/services/api_service.dart` (Bắt lỗi mạng và ghi vào hàng đợi `sync_queue`).
- **[MODIFY]** `lib/views/phase1_wizard_view.dart` & `phase2_wizard_view.dart` (Tích hợp Auto-save Timer và Sync indicator).

---

## 7. KẾ HOẠCH KIỂM THỬ & ĐÁNH GIÁ (TESTING & VERIFICATION PLAN)

### 7.1. Automated Unit Tests (Kiểm thử Tự động)
1. **Test Prerequisite Enforcement**: Tạo Phase 2 khi Phase 1 đang ở trạng thái `SUBMITTED` $\rightarrow$ API trả về `400 Bad Request: Phase 1 must be APPROVED first`.
2. **Test Structural Override**: Đánh giá $E_1 = 3$ (Nứt cột chịu lực), tổng điểm $\Sigma E = 3$ $\rightarrow$ Hệ thống bắt buộc xuất ra `Structural Flag = CRITICAL` và không cho phép phân loại `GOOD`.
3. **Test Delta Tracking**: Khi khuyết tật $D-01$ ở Phase 1 có $w = 0.3\text{ mm}$, sang Phase 2 đo được $w = 0.8\text{ mm} \rightarrow$ Tự động gán trạng thái `comparison_with_phase1 = DEVELOPED_WIDER`.

### 7.2. Field UAT (Kiểm thử Hiện trường Thực tế)
- Thử nghiệm trên 20 công trình thực tế dọc đường Cách Mạng Tháng Tám (Ga S9 - Bà Quẹo):
  - Cán bộ vẽ sơ đồ mặt bằng ra giấy A4, dùng app chụp lại và chấm ghim 5 vết nứt dưới trời nắng gắt.
  - Sử dụng khung HUD camera chụp ảnh cận cảnh kèm thước đo khe nứt (Crack Card).
  - Cho chủ hộ lớn tuổi ký ngón tay trên bảng ký số toàn màn hình xoay ngang.
  - Mở Web Portal tại văn phòng, Nhà thầu và Đại diện Tổ dân phố đăng nhập dùng kính lúp soi vạch thước mm và ký duyệt.
