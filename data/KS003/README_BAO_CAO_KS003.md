# BÁO CÁO TỔNG HỢP & PHÂN TÍCH DỮ LIỆU QUY HOẠCH ĐÔ THỊ TP. HỒ CHÍ MINH
## ĐỢT KHẢO SÁT: KS003 — HÀNH LANG TUYẾN METRO SỐ 2 (BẾN THÀNH – THAM LƯƠNG)
### PHỤC VỤ CÔNG TÁC KHẢO SÁT HIỆN TRẠNG CÔNG TRÌNH XÂY DỰNG & NHÀ Ở TRÊN ĐẤT

---

**Kính gửi:** Ban Giám Đốc / Trưởng Phòng Đầu Tư, Pháp Lý & Khảo Sát Hiện Trạng  
**Đơn vị thực hiện:** Bộ phận Khảo sát Dữ liệu Quy hoạch Tự động  
**Thời gian hoàn thành:** 14/09/2026  
**Dữ liệu nguồn:** Hệ thống Thông tin Quy hoạch Đô thị — Sở Quy hoạch & Kiến trúc TP.HCM (SQHKT)  
**File đính kèm bàn giao:**
1. 📊 **Excel Phân Tích Hiện Trạng Công Trình & Nhà Ở (7 Sheet):** [Bao_Cao_Phan_Tich_Quy_Hoach_KS003.xlsx](file:///Users/vqd2k6/Desktop/Project/QuyHoach/data/output/KS003/Bao_Cao_Phan_Tich_Quy_Hoach_KS003.xlsx)
2. 🗺️ **Bản Đồ Quy Hoạch Trực Quan Tương Tác:** [ban_do_quy_hoach.html](file:///Users/vqd2k6/Desktop/Project/QuyHoach/data/output/KS003/ban_do_quy_hoach.html)
3. 📁 **Excel Dữ Liệu Gốc Đầy Đủ:** [KS003.xlsx](file:///Users/vqd2k6/Desktop/Project/QuyHoach/data/output/KS003/KS003.xlsx)

---

## 1. TÓM TẮT ĐIỀU HÀNH (EXECUTIVE SUMMARY)

Đợt khảo sát **KS003** được thực hiện dọc theo hành lang tuyến **Metro Số 2 (Bến Thành – Tham Lương)** đi qua 6 quận (Quận 1, Quận 3, Quận 10, Tân Bình, Tân Phú, Quận 12) với độ phân giải siêu mịn **2 mét** (331,268 điểm toạ độ quét).

Mục tiêu trọng tâm: **Trích xuất và nhận diện toàn bộ các thửa đất có nhà ở, khu dân cư hoặc công trình xây dựng (thương mại, dịch vụ, cơ quan, trụ sở, trường học, bệnh viện, cao ốc phức hợp)** nhằm phục vụ công tác đối soát hiện trạng và khảo sát thực địa.

Hệ thống đã trích xuất thành công **6,431 thửa đất địa chính** và **11,113 ô quy hoạch chi tiết 1/2000**.

> [!IMPORTANT]
> **Đặc điểm trọng tâm của bộ dữ liệu:**
> - Toàn bộ dữ liệu giữ **nguyên bản chi tiết thô 72 danh mục SQHKT**, bảo toàn các mã ô `[Mã Ô]`, tên chức năng chi tiết, diện tích m² và tỷ lệ % của từng ô (ví dụ: `• Đất giao thông: 1,160.11 m² (14.5%) • [III.9] Dân cư dự kiến: 1,597.30 m² (20.0%) • [II.25] Ga Depot: 4,988.29 m² (62.4%)`).
> - Tập trung phân loại các thửa **có nhà ở** (4,884 thửa) và các thửa **có công trình xây dựng** (1,151 thửa) để đội khảo sát dễ dàng định vị, kiểm tra thực địa các công trình kiến trúc.

### 📌 Các Chỉ Số Cốt Lõi Về Nhà Ở & Công Trình (KS003):

| Chỉ số Khảo sát | Giá trị Định lượng | Tỷ lệ % | Ý nghĩa Phục vụ Khảo sát Thực địa |
| :--- | :---: | :---: | :--- |
| **Tổng số thửa đất khảo sát** | **6,431 thửa** | **100,0%** | Toàn bộ bất động sản trong hành lang tuyến Metro số 2 |
| **Tổng diện tích khảo sát** | **2,870,880.3 m²** | **~ 287.09 ha** | Quy mô hành lang khảo sát |
| **Tổng số ô phân khu chi tiết** | **11,113 ô** | **72 loại mục đích** | Dữ liệu quy hoạch phân khu chi tiết 1/2000 |
| **THỬA CÓ NHÀ Ở / DÂN CƯ** | **4,884 thửa** | **75.94%** | Các lô đất có nhà ở đô thị, khu dân cư hiện hữu, cải tạo |
| **THỬA CÓ CÔNG TRÌNH XÂY DỰNG** | **1,151 thửa** | **17.90%** | Đất có công trình TMDV, cơ quan, trường học, bệnh viện, phức hợp |
| **TỔNG THỬA CÓ NHÀ Ở HOẶC CÔNG TRÌNH** | **5,819 thửa** | **90.48%** | **Tệp đối tượng chính cần đi khảo sát thực địa hiện trạng** |
| **Thửa dính lộ giới mở đường** | **4,350 thửa** | **67.64%** | Nhà ở / công trình tiếp giáp mặt tiền CMT8, Trường Chinh |
| **Thửa thuộc dự án 1/500 & ĐCCB** | **650 bản ghi (649 thửa)** | **10.09%** | Các công trình dự án lớn (Ga Depot, cao ốc, khu tái định cư...) |

---

## 2. PHÂN BỔ NHÀ Ở & CÔNG TRÌNH THEO 6 QUẬN / HUYỆN

### 📊 Bảng Thống Kê Hiện Trạng Xây Dựng Từng Quận (KS003):

| STT | Quận / Huyện | Tổng Thửa | Tỷ Lệ (%) | Tổng DT (m²) | Thửa Có Nhà Ở | Tỷ Lệ Nhà Ở (%) | Thửa Có Công Trình XD | Tỷ Lệ CT (%) | Tổng Thửa Có Nhà Ở Hoặc CT | Thửa Có DA 1/500 & ĐCCB |
| :-: | :--- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 1 | **Quận Tân Bình** | **3,277** | 50.96% | 772,000.1 | **2,889** | 88.16% | **203** | 6.19% | **2,939 (89.7%)** | 191 |
| 2 | **Quận 3** | **1,433** | 22.28% | 325,670.6 | **1,121** | 78.23% | **229** | 15.98% | **1,322 (92.3%)** | 43 |
| 3 | **Quận 10** | **861** | 13.39% | 395,699.0 | **793** | 92.10% | **34** | 3.95% | **812 (94.3%)** | 361 |
| 4 | **Quận 1** | **513** | 7.98% | 393,520.2 | **0** | 0.00% | **471** | 91.81% | **471 (91.8%)** | 42 |
| 5 | **Quận Tân Phú** | **313** | 4.87% | 735,939.6 | **59** | 18.85% | **199** | 63.58% | **247 (78.9%)** | 0 |
| 6 | **Quận 12** | **34** | 0.53% | 248,050.8 | **22** | 64.71% | **15** | 44.12% | **28 (82.4%)** | 12 |
| - | **TỔNG CỘNG** | **6,431** | **100,00%** | **2,870,880.3** | **4,884** | **75.94%** | **1,151** | **17.90%** | **5,819 (90.48%)** | **649** |

### 🔍 Nhận Xét Phục Vụ Khảo Sát Hiện Trạng:
* **Tân Bình (3.277 thửa - 50,96%):** Chiếm hơn 1 nửa toàn bộ khối lượng khảo sát, trong đó có **2.889 thửa nhà ở** (88,16%) và 203 thửa công trình. Mật độ dân cư dày đặc dọc hành lang Trường Chinh, CMT8, Hoàng Văn Thụ.
* **Quận 3 (1.433 thửa - 22,28%):** Có 1.121 thửa nhà ở (78,23%) và 229 thửa công trình thương mại dịch vụ cao cấp, khách sạn, trụ sở cơ quan.
* **Quận 10 (861 thửa - 13,39%):** Có tới 793 thửa nhà ở (92,10%) và 361 thửa có hồ sơ đồ án 1/500 & điều chỉnh cục bộ.
* **Quận 1 (513 thửa - 7,98%):** Tập trung **471 thửa công trình xây dựng (91,81%)** (tòa nhà văn phòng hạng A/B, khách sạn, trung tâm thương mại, di tích, cơ quan ngoại giao).
* **Quận Tân Phú (313 thửa) & Quận 12 (34 thửa):** Sở hữu diện tích khuôn viên thửa đất lớn (Ga Depot Tham Lương, khu công nghiệp, trạm cấp nước).

---

## 3. DANH MỤC THỐNG KÊ CHI TIẾT 72 LOẠI MỤC ĐÍCH SỬ DỤNG ĐẤT THÔ (RAW)

Toàn bộ 72 loại đất thô được giữ nguyên vẹn từ dữ liệu Sở QHKT:

| STT | Tên Loại Đất Thô (SQHKT) | Phân Loại Tham Khảo | Số Ô Xuất Hiện | Số Thửa Tiếp Giáp | Tổng Diện Tích Ô (m²) | Tỷ Lệ (%) | Mật Độ Max (%) | HSSDĐ Max | Tầng Cao Max |
| :-: | :--- | :--- | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 1 | `Đất giao thông` | Giao Thông | 4,663 | 4,350 | 986,039.5 | 34.35% | - | - | - |
| 2 | `Đất hỗn hợp` | Phức Hợp / Hỗn Hợp | 59 | 55 | 444,971.1 | 15.50% | 45.0% | 13.5 | - |
| 3 | `Đất ở` | Đất Ở / Nhà Ở | 1,849 | 1,846 | 157,357.5 | 5.48% | 66.8% | 5.3 | - |
| 4 | `Đất công viên cây xanh` | Cây Xanh / TDTT | 27 | 26 | 152,974.6 | 5.33% | 10.0% | 0.1 | - |
| 5 | `Đất quân sự` | Quốc Phòng | 2 | 2 | 140,245.2 | 4.89% | - | - | - |
| 6 | `Đất ở - hiện hữu` | Đất Ở / Nhà Ở | 935 | 922 | 84,529.8 | 2.94% | - | 1.7 | - |
| 7 | `Dân cư dự kiến` | Đất Ở / Nhà Ở | 26 | 19 | 68,175.7 | 2.37% | 30.0% | 4.0 | - |
| 8 | `Đất công trình dịch vụ công cộng` | Công Trình Công Cộng | 166 | 165 | 67,078.9 | 2.34% | 49.0% | 5.8 | - |
| 9 | `Đất phức hợp` | Phức Hợp / Hỗn Hợp | 498 | 474 | 65,379.7 | 2.28% | 100.0% | 16.0 | - |
| 10 | `Mặt nước` | Mặt Nước / Thủy Triều | 12 | 8 | 53,887.8 | 1.88% | - | - | - |
| 11 | `Đất ở hiện hữu` | Đất Ở / Nhà Ở | 450 | 450 | 50,918.8 | 1.77% | - | - | - |
| 12 | `Đất giáo dục` | Công Trình Giáo Dục | 55 | 55 | 48,497.4 | 1.69% | 60.0% | 3.5 | 6.0 |
| 13 | `Đất công trình công cộng - y tế` | Công Trình Y Tế | 5 | 4 | 40,845.8 | 1.42% | 60.0% | 3.2 | - |
| 14 | `Đất công nghiệp` | Công Nghiệp & Hạ Tầng | 5 | 5 | 38,235.8 | 1.33% | - | - | - |
| 15 | `Đất cây xanh - thể dục thể thao` | Cây Xanh / TDTT | 2 | 2 | 34,578.8 | 1.20% | 10.0% | 0.1 | - |
| 16 | `Cây xanh cách ly` | Cây Xanh / TDTT | 19 | 19 | 33,616.7 | 1.17% | - | - | - |
| 17 | `Đất cây xanh cách ly` | Cây Xanh / TDTT | 29 | 29 | 29,448.3 | 1.03% | - | - | - |
| 18 | `Đất ở chỉnh trang` | Đất Ở / Nhà Ở | 482 | 482 | 24,413.3 | 0.85% | - | 1.8 | - |
| 19 | `Đất sử dụng hỗn hợp` | Phức Hợp / Hỗn Hợp | 84 | 84 | 24,179.4 | 0.84% | 65.0% | 13.0 | - |
| 20 | `Đất công trình tôn giáo` | Tôn Giáo / Di Tích | 32 | 32 | 24,082.2 | 0.84% | 60.0% | 2.5 | - |
| 21 | `Dân cư hiện hữu cải tạo` | Đất Ở / Nhà Ở | 300 | 300 | 23,720.6 | 0.83% | 60.0% | 3.0 | - |
| 22 | `Đất phức hợp - chủ đạo chức năng khách sạn` | Phức Hợp / Hỗn Hợp | 46 | 38 | 21,299.7 | 0.74% | 80.0% | 5.0 | - |
| 23 | `Đất nhóm nhà ở hiện trạng` | Đất Ở / Nhà Ở | 350 | 350 | 20,489.6 | 0.71% | - | - | - |
| 24 | `Đất quảng trường` | Công Trình Công Cộng | 32 | 32 | 20,035.6 | 0.70% | 5.0% | 0.1 | - |
| 25 | `Đất ở hiện hữu - cải tạo` | Đất Ở / Nhà Ở | 136 | 132 | 18,282.6 | 0.64% | 60.0% | 3.5 | 5.0 |
| 26 | `Đất thương mại dịch vụ` | Thương Mại - Dịch Vụ | 47 | 46 | 16,498.6 | 0.57% | 40.0% | 3.5 | 1.0 |
| 27 | `Đất công trình công cộng` | Công Trình Công Cộng | 56 | 56 | 15,722.6 | 0.55% | 66.8% | 5.3 | - |
| 28 | `Đất hành chính` | Cơ Quan / Hành Chính | 40 | 40 | 14,682.2 | 0.51% | 80.0% | 5.0 | - |
| 29 | `Đất dân cư cải tạo` | Đất Ở / Nhà Ở | 292 | 292 | 14,626.0 | 0.51% | 75.0% | 1.8 | - |
| 30 | `CV - thể dục thể thao - VH` | Cây Xanh / TDTT | 101 | 99 | 13,881.2 | 0.48% | - | - | - |
| 31 | `Công viên cây xanh` | Cây Xanh / TDTT | 4 | 3 | 11,825.2 | 0.41% | - | - | - |
| 32 | `Ga Depot` | Ga Depot Metro | 5 | 5 | 10,353.6 | 0.36% | 30.0% | 2.0 | - |
| 33 | `Đất trường học` | Công Trình Giáo Dục | 25 | 24 | 9,384.7 | 0.33% | 66.8% | 3.5 | - |
| 34 | `Đất tôn giáo` | Tôn Giáo / Di Tích | 10 | 10 | 9,079.8 | 0.32% | 55.0% | 1.8 | - |
| 35 | `Đất công trình công cộng - giáo dục` | Công Trình Giáo Dục | 6 | 4 | 8,197.6 | 0.29% | 60.0% | 2.4 | - |
| 36 | `Công trình thương mại - dịch vụ` | Thương Mại - Dịch Vụ | 9 | 9 | 6,304.4 | 0.22% | 50.0% | 2.0 | - |
| 37 | `Đất cơ quan - SXKD` | Cơ Quan / Hành Chính | 8 | 8 | 5,968.0 | 0.21% | 66.8% | 5.3 | - |
| 38 | `Khu nhà ở hiện hữu không cho xây dựng mới` | Đất Ở / Nhà Ở | 23 | 23 | 5,829.7 | 0.20% | - | - | - |
| 39 | `Đất cây xanh công viên - thể dục thể thao` | Cây Xanh / TDTT | 2 | 2 | 5,748.8 | 0.20% | 18.0% | 0.5 | 1.0 |
| 40 | `Đất kho tàng bến bãi` | Công Nghiệp & Hạ Tầng | 1 | 1 | 5,595.1 | 0.19% | 30.0% | 0.9 | - |
| 41 | `Đất nhóm nhà ở hiện hữu` | Đất Ở / Nhà Ở | 46 | 46 | 4,427.2 | 0.15% | 60.0% | 2.4 | - |
| 42 | `Đất công cộng (Thương mại, dịch vụ)` | Thương Mại - Dịch Vụ | 4 | 4 | 4,095.3 | 0.14% | 60.0% | 10.8 | - |
| 43 | `Đất phức hợp - chủ đạo chức năng văn hóa/giải trí` | Phức Hợp / Hỗn Hợp | 9 | 9 | 3,903.2 | 0.14% | 100.0% | 2.0 | - |
| 44 | `Công trình giáo dục` | Công Trình Giáo Dục | 4 | 4 | 3,363.9 | 0.12% | 35.0% | 2.0 | - |
| 45 | `Dân cư hiện hữu` | Đất Ở / Nhà Ở | 5 | 4 | 2,865.5 | 0.10% | 40.0% | 3.5 | - |
| 46 | `Đất y tế` | Công Trình Y Tế | 22 | 22 | 2,595.0 | 0.09% | 57.5% | 3.7 | - |
| 47 | `Đất ở dự kiến chỉnh trang - xây dựng mới` | Đất Ở / Nhà Ở | 42 | 42 | 2,272.3 | 0.08% | 40.0% | 5.2 | - |
| 48 | `Sông rạch, mặt nước` | Mặt Nước / Thủy Triều | 2 | 2 | 2,076.4 | 0.07% | - | - | - |
| 49 | `Đất nhóm nhà ở hiện hữu chỉnh trang` | Đất Ở / Nhà Ở | 12 | 11 | 1,997.1 | 0.07% | 85.0% | 2.5 | - |
| 50 | `Phức hợp` | Phức Hợp / Hỗn Hợp | 9 | 9 | 1,784.9 | 0.06% | 70.0% | 4.0 | - |
| 51 | `Đất cây xanh phục vụ công cộng` | Công Trình Công Cộng | 1 | 1 | 1,776.4 | 0.06% | - | - | - |
| 52 | `Khu dân cư hiện hữu cải tạo chỉnh trang` | Đất Ở / Nhà Ở | 11 | 11 | 1,666.0 | 0.06% | 80.0% | 4.4 | - |
| 53 | `Đất phức hợp - chủ đạo chức năng ở` | Phức Hợp / Hỗn Hợp | 8 | 8 | 1,653.7 | 0.06% | 80.0% | 3.0 | - |
| 54 | `Đất tôn giáo di tích` | Tôn Giáo / Di Tích | 4 | 4 | 1,055.7 | 0.04% | 57.5% | 3.5 | - |
| 55 | `Công trình hành chánh - y tế` | Cơ Quan / Hành Chính | 6 | 6 | 1,045.9 | 0.04% | - | - | - |
| 56 | `Đất tôn giáo, di tích` | Tôn Giáo / Di Tích | 4 | 4 | 681.0 | 0.02% | 65.0% | 5.3 | - |
| 57 | `Đất công trình công cộng - hành chính` | Cơ Quan / Hành Chính | 3 | 3 | 601.6 | 0.02% | 70.0% | 2.1 | - |
| 58 | `Kênh - rạch` | Mặt Nước / Thủy Triều | 3 | 3 | 536.4 | 0.02% | - | - | - |
| 59 | `Đất công trình đầu mối hạ tầng kỹ thuật` | Công Trình Công Cộng | 2 | 2 | 431.4 | 0.02% | - | - | - |
| 60 | `Đất cây xanh` | Cây Xanh / TDTT | 2 | 2 | 422.8 | 0.01% | 5.0% | 0.1 | 1.0 |
| 61 | `Đất công viên cây xanh - thể dục thể thao` | Cây Xanh / TDTT | 1 | 1 | 349.6 | 0.01% | - | 1.8 | - |
| 62 | `Đất công trình giáo dục` | Công Trình Giáo Dục | 3 | 3 | 170.1 | 0.01% | 40.0% | 1.2 | - |
| 63 | `Đất ở - xây dựng mới` | Đất Ở / Nhà Ở | 3 | 3 | 146.3 | 0.01% | - | 4.5 | - |
| 64 | `Đất ở xây dựng mới` | Đất Ở / Nhà Ở | 1 | 1 | 116.6 | 0.00% | - | - | - |
| 65 | `Trạm cấp nước` | Công Nghiệp & Hạ Tầng | 1 | 1 | 77.4 | 0.00% | - | - | - |
| 66 | `Đất hạ tầng kỹ thuật` | Khác | 1 | 1 | 71.6 | 0.00% | 26.8% | 0.5 | 3.0 |
| 67 | `Đất quốc phòng` | Quốc Phòng | 1 | 1 | 59.7 | 0.00% | - | - | - |
| 68 | `Đất khác` | Khác | 3 | 3 | 46.5 | 0.00% | 57.5% | 2.9 | - |
| 69 | `Đất tiểu thủ công nghiệp` | Công Nghiệp & Hạ Tầng | 1 | 1 | 8.4 | 0.00% | - | 1.8 | - |
| 70 | `Đất nhóm nhà ở xây dựng mới` | Đất Ở / Nhà Ở | 2 | 2 | 6.8 | 0.00% | 41.0% | 5.3 | - |
| 71 | `Đất công cộng đơn vị ở` | Công Trình Công Cộng | 3 | 3 | 6.3 | 0.00% | 50.9% | 6.1 | 17.0 |
| 72 | `Cây xanh công viên - thể dục thể thao` | Cây Xanh / TDTT | 1 | 1 | 3.7 | 0.00% | - | 0.1 | 1.0 |

---

## 4. HƯỚNG DẪN SỬ DỤNG 7 SHEET TRONG FILE EXCEL BÁO CÁO

File báo cáo [Bao_Cao_Phan_Tich_Quy_Hoach_KS003.xlsx](file:///Users/vqd2k6/Desktop/Project/QuyHoach/data/output/KS003/Bao_Cao_Phan_Tich_Quy_Hoach_KS003.xlsx) được thiết kế tối ưu cho công tác khảo sát thực địa:

| Sheet | Tên Sheet | Số Lượng Dòng | Chức Năng & Mục Đích Phục Vụ Khảo Sát |
| :--- | :--- | :---: | :--- |
| **Sheet 1** | `📊 1. Dashboard & KPIs` | Tổng hợp | Bảng chỉ số điều hành, tóm tắt tổng diện tích, tỷ lệ nhà ở, công trình xây dựng, phân bổ theo 6 quận. |
| **Sheet 2** | `📚 2. Thống Kê 72 Loại Đất Thô` | 72 dòng | Danh mục gốc của SQHKT, thống kê số ô, số thửa, tổng m², tỷ lệ % và các chỉ tiêu quy hoạch (Mật độ, HSSDĐ, Tầng cao). |
| **Sheet 3** | `🔍 3. Chi Tiết 11,113 Ô QH` | 11,113 dòng | Chi tiết từng ô quy hoạch thành phần kèm mã ô `[Mã Ô]`, tên loại đất, diện tích m², tỷ lệ % chiếm thửa. |
| **Sheet 4** | `🏡 4. Thửa Có Đất Ở - Nhà Ở` | **4,884 thửa** | Danh sách các thửa đất có chức năng **Đất ở / Nhà ở / Dân cư**, hiển thị diện tích nhà ở, tỷ lệ %, chỉ tiêu tầng cao, mật độ, HSSDĐ. |
| **Sheet 5** | `🏢 5. Thửa Có Công Trình XD` | **1,151 thửa** | Danh sách các thửa có **Công trình xây dựng** (TMDV, Cơ quan, Bệnh viện, Trường học, Phức hợp...), sắp xếp theo quy mô diện tích công trình giảm dần. |
| **Sheet 6** | `🏗️ 6. Toàn Bộ Nhà Ở & CT (5819)` | **5,819 thửa** | **Tệp dữ liệu tổng hợp quan trọng nhất (90.48% tổng khảo sát)** để đội khảo sát mang đi thực địa kiểm tra toàn bộ nhà ở và công trình. |
| **Sheet 7** | `🏛️ 7. Dự Án 1-500 & DCCB` | **650 bản ghi** | Danh mục các thửa đất nằm trong ranh đồ án quy hoạch 1/500 và các quyết định điều chỉnh cục bộ quy hoạch. |

> [!TIP]
> **Tính năng Tương tác trong File Excel:**
> * **Chú thích trực tiếp trên Header (Tooltip Comments):** Đã gắn ghi chú giải thích chi tiết ý nghĩa và công thức tính cho toàn bộ các tiêu đề cột (Header) trên cả 7 sheet. Chỉ cần rê chuột vào ô header để xem giải thích.
> * **Bộ lọc AutoFilter:** Đã bật sẵn cho tất cả các bảng dữ liệu để dễ dàng lọc theo Quận, Phường, Loại công trình, Tầng cao, Lộ giới.
> * **Cố định tiêu đề (Freeze Panes):** Giữ cố định tiêu đề và các cột định danh để cuộn dữ liệu mượt mà.

---

## 5. TỪ ĐIỂN TRA CỨU & Ý NGHĨA CÁC CHỈ TIÊU QUY HOẠCH TRÊN HEADER

Dưới đây là bảng giải nghĩa chi tiết các thông số kỹ thuật xuất hiện trong báo cáo và file Excel:

### 📐 1. Nhóm Chỉ Tiêu Quy Hoạch - Kiến Trúc
* **`Tầng Cao Max` / `Tầng Cao Cho Phép (tầng)`:**
  * **Định nghĩa:** Số tầng nổi tối đa được phép xây dựng công trình theo đồ án quy hoạch phân khu 1/2000 hoặc quy hoạch chi tiết 1/500 đã được cơ quan nhà nước có thẩm quyền phê duyệt.
  * **Ý nghĩa thực tế:** Khống chế chiều cao không gian đô thị, làm căn cứ cấp Giấy phép xây dựng (GPXD). Không bao gồm tầng hầm, tầng lửng và tum thang (theo QCVN 04:2021/BXD).
* **`Mật Độ XD Max (%)` (Building Coverage Ratio - BCR):**
  * **Định nghĩa:** Tỷ lệ diện tích chiếm đất của công trình kiến trúc xây dựng trên tổng diện tích lô đất.
  * **Công thức:** 
    $$\text{Mật Độ XD (\%)} = \frac{\text{Diện Tích Chiếm Đất Của Công Trình (m²)}}{\text{Tổng Diện Tích Thửa Đất (m²)}} \times 100\%$$
  * **Ví dụ:** Lô đất 100 m² có mật độ XD 60% thì diện tích xây dựng tầng trệt tối đa là 60 m², còn lại 40 m² bắt buộc làm khoảng lùi, sân vườn, cây xanh.
* **`HSSDĐ Max` (Hệ Số Sử Dụng Đất / Floor Area Ratio - FAR):**
  * **Định nghĩa:** Tỷ số giữa tổng diện tích sàn xây dựng của toàn bộ các tầng trong công trình (không bao gồm diện tích sàn tầng hầm, tầng kỹ thuật, mái) với tổng diện tích lô đất.
  * **Công thức:**
    $$\text{HSSDĐ} = \frac{\text{Tổng Diện Tích Sàn Xây Dựng Tất Cả Các Tầng (m²)}}{\text{Tổng Diện Tích Thửa Đất (m²)}}$$
  * **Ví dụ:** Thửa đất 200 m² có HSSDĐ = 3.5 thì tổng diện tích sàn xây dựng tối đa của toàn bộ tòa nhà là $200 \times 3.5 = 700\text{ m²}$.
* **`Dự Án 1/500 & ĐCCB`:**
  * **Định nghĩa:** Tình trạng pháp lý quy hoạch chi tiết của thửa đất.
  * **Có QH 1/500:** Thửa đất nằm trong ranh giới đồ án Quy hoạch chi tiết tỷ lệ 1/500 đã được phê duyệt.
  * **Có ĐCCB:** Thửa đất có Quyết định Điều chỉnh cục bộ đồ án quy hoạch phân khu 1/2000 do UBND TP.HCM ban hành.
* **`Lộ Giới Tiếp Giáp` / `Độ Rộng Lộ Giới (m)`:**
  * **Định nghĩa:** Khoảng cách giữa hai chỉ giới đường đỏ của tuyến đường tiếp giáp thửa đất (bao gồm lòng đường, vỉa hè và dải phân cách).
  * **Ý nghĩa thực tế:** Xác định khoảng lùi xây dựng bắt buộc và phần diện tích đất nằm trong hành lang an toàn giao thông sẽ bị thu hồi khi nhà nước mở rộng đường.

---

## 6. DANH SÁCH 34 LOẠI ĐẤT THÔ ĐƯỢC PHÂN LOẠI LÀ "CÔNG TRÌNH XÂY DỰNG"

Để phục vụ công tác khảo sát thực địa, hệ thống đã trích xuất toàn bộ 34 danh mục đất công trình (phi nhà ở) theo chuẩn SQHKT:

1. `Đất hỗn hợp` (Phức hợp cao ốc, văn phòng, căn hộ)
2. `Đất phức hợp` (Tổ hợp dịch vụ đa chức năng)
3. `Đất thương mại dịch vụ` / `Công trình thương mại - dịch vụ` / `Đất công cộng (Thương mại, dịch vụ)`
4. `Đất hành chính` / `Đất cơ quan - SXKD` / `Công trình hành chánh - y tế` / `Đất công trình công cộng - hành chính`
5. `Đất giáo dục` / `Đất trường học` / `Đất công trình giáo dục` / `Công trình giáo dục` / `Đất công trình công cộng - giáo dục`
6. `Đất y tế` / `Đất công trình công cộng - y tế`
7. `Đất phức hợp - chủ đạo khách sạn`
8. `Ga Depot` (Ga Depot Metro Tham Lương)
9. `Đất công trình dịch vụ công cộng` / `Đất công trình công cộng` / `Đất công cộng đơn vị ở`
10. `Đất công nghiệp` / `Đất tiểu thủ công nghiệp` / `Đất kho tàng bến bãi`
11. `Đất công trình tôn giáo` / `Đất tôn giáo` / `Đất tôn giáo di tích` / `Đất tôn giáo, di tích`
12. `Đất quảng trường`
13. `Đất công trình đầu mối HTKT` / `Trạm cấp nước` / `Đất hạ tầng kỹ thuật`

---

## 7. BẢN ĐỒ QUY HOẠCH TƯƠNG TÁC (INTERACTIVE GIS MAP)

Bản đồ tương tác đã được cập nhật hoàn chỉnh tại [ban_do_quy_hoach.html](file:///Users/vqd2k6/Desktop/Project/QuyHoach/data/output/KS003/ban_do_quy_hoach.html):
* **Lưới điểm quét siêu mịn 2m:** Hiển thị toàn bộ **331,268 điểm lưới toạ độ** bằng Canvas Renderer tối ưu hiệu năng 60 FPS.
* **Màu sắc trạng thái điểm:**
  * 🟢 **Xanh lá:** Điểm đã quét thành công có thông tin thửa đất địa chính.
  * 🟡 **Vàng:** Điểm thuộc đất giao thông / lộ giới / đất công cộng.
  * ⚪ **Xám:** Điểm lưới khoảng cách định vị.
* **Nút bấm `👁️ Ẩn/Hiện chấm`:** Bật tắt tức thì 0ms nhờ cơ chế Leaflet Custom Map Pane (`gridPointsPane`).
* **Hiển thị Ranh Thửa & Tuyến Đường KML:** Vẽ đầy đủ các đa giác ranh thửa và hướng tuyến Metro Số 2.

---

### 📞 LIÊN HỆ & HỖ TRỢ KỸ THUẬT
* **Bộ phận Dữ liệu & GIS Quy hoạch**
* **Dự án:** Quét & Phân tích Quy hoạch Đô thị Tự động TP.HCM (Metro Line 2)
