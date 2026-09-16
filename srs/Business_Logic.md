# Quy Tắc Nghiệp Vụ Hệ Thống (Business Logic Specification)

> Tài liệu đặc tả các Quy tắc Nghiệp vụ cốt lõi, Kiến trúc Mã kép Dual-ID, Cơ chế Quản lý Biến động Thửa đất, Bộ máy Tính điểm Kỹ thuật (ECS/VI) và Quy trình Xuất Báo cáo Hàng loạt cho Dự án Khảo sát Hiện trạng Tuyến Metro 2.

---

## 1. KIẾN TRÚC MÃ KÉP (DUAL-ID ARCHITECTURE) & CƠ CHẾ CẤP MÃ BẤT BIẾN `B-XXXXX`

### 1.1. Kiến trúc Định danh Kép cho Thửa Đất (Dual-ID System)
Mỗi thửa đất trong hệ thống được định danh đồng thời bởi **2 Mã (Dual-ID)** phục vụ 2 mục đích riêng biệt:

1. **`officialCadastralCode` (Mã Địa chính Gốc / Dữ liệu KS003):**
   - Mã định danh địa chính nhà nước thu thập từ dữ liệu cào ban đầu (`data/KS003`) hoặc thông tin Số tờ - Số thửa bản đồ địa chính của Bộ TN&MT (VD: `KS003-P1024`, `Tờ 15 - Thửa 89`).
   - Giúp đối soát và bảo đảm giá trị pháp lý với cơ sở dữ liệu đất đai của Nhà nước khi bàn giao đền bù giải phóng mặt bằng.

2. **`projectParcelCode` (Mã Quản lý Dự án Tuyến Metro 2 - `B-XXXXX`):**
   - Mã số được hệ thống sắp xếp (sort) tuần tự theo lý trình tim tuyến Metro 2 từ Ga S1 đến Ga S11 (từ `B-00001` đến `B-07000`) để phục vụ quản lý dự án, phân công task cho Surveyor và kiểm soát tiến độ khảo sát.
   - Kiểm soát biến động thực địa (Tách / Gộp thửa) theo cơ chế Dải số Phát sinh Mở rộng.

---

### 1.2. Nguyên tắc Bất biến của Mã Dự Án `B-XXXXX` (Immutability Principle)
- **Định dạng chuẩn:** Mã công trình/thửa đất cố định theo quy chuẩn **`B-XXXXX`** (Tiền tố `B-` và đúng 5 chữ số từ `B-00001` đến `B-99999`).
- **Nguyên tắc cốt lõi:** Khi một mã `B-XXXXX` đã được cấp phát và xuất Báo cáo Khảo sát gửi đi, mã này là **MÃ BẤT BIẾN (IMMUTABLE)**.
- **Quy tắc cấm:** Tuyệt đối **KHÔNG ĐƯỢC PHÉP chèn số vào giữa (Insert In-between)** làm tịnh tiến đẩy số $+1$ các thửa phía sau.
  *(Ví dụ: Khi phát sinh tách thửa tại `B-00002`, tuyệt đối không chèn làm `B-00005` bị đẩy thành `B-00006`, đảm bảo hồ sơ đã phát hành trong quá khứ không bao giờ bị lệch ID).*

---

### 1.3. Cơ chế Dải số Phát sinh Mở rộng (High-Range Sequential Extension Pool)

Dữ liệu ban đầu cào về có $N$ thửa đất (Ví dụ: Tuyến Metro 2 có $N = 7.000$ thửa ban đầu, từ `B-00001` đến `B-07000`).

```
[ Dải số Ban đầu: B-00001 -> B-07000 ] ──> [ Dải số Phát sinh Thực địa: B-07001 -> B-99999 ]
```

#### A. Kịch bản Tách Thửa (Parcel Split)
Khi cán bộ khảo sát thực địa phát hiện 1 thửa gốc thực tế đã bị chia thành $k$ căn nhà độc lập:
1. **Mảnh 1 (Nhà chính/Địa chỉ gốc):** Giữ nguyên mã gốc **`B-00002`**.
2. **Mảnh 2 (Nhà phát sinh 1):** Hệ thống tự động lấy mã tiếp theo lớn nhất trong hệ thống: **`B-07001`**.
3. **Mảnh 3 (Nếu có - Nhà phát sinh 2):** Cấp tiếp mã **`B-07002`**.
4. **Liên kết Phả hệ (Lineage Metadata):** Thửa phát sinh `B-07001` lưu thông tin:
   - `parentParcelCode`: `"B-00002"`
   - `mutationType`: `SPLIT`
   - `mutationReason`: `"Chủ nhà xây ngăn chia thành 2 căn 12A và 12B"`
5. **Kết quả:** Thửa `B-00005` đã khảo sát hôm qua **VẪN LÀ `B-00005` MÃI MÃI, ZERO XÔ LỆCH**.

#### B. Kịch bản Gộp Thửa (Parcel Merge)
Khi 2 hoặc nhiều thửa đất liền kề (Ví dụ: `B-00002` và `B-00003`) thực tế đã xây chung 1 toà nhà:
1. Sử dụng mã của **thửa có số nhỏ hơn làm mã đại diện chính: `B-00002`**.
2. Thửa `B-00003` được chuyển trạng thái: `MERGED_DEPRECATED`, trường `mergedIntoParcelCode = "B-00002"`.
3. Báo cáo của `B-00002` sẽ tổng hợp toàn bộ ranh giới và ghi chú diện tích đã bao gồm thửa `B-00003`.

---

## 2. QUY TRÌNH BIẾN ĐỘNG RANH THỬA TRÊN GIS (CADASTRAL WORKFLOW)

### 2.1. Vị trí thực hiện trong Luồng Khảo sát: **BƯỚC 5**
> [!NOTE]
> Do mật độ đô thị TP.HCM cao và các toà nhà san sát nhau, cán bộ khảo sát **phải đi hết toàn bộ các tầng và không gian trong nhà (từ Bước 1 đến Bước 4)** rồi mới tiến hành đối soát và vẽ lại đường bao ranh đất tại **Bước 5**. Điều này đảm bảo cảm nhận về diện tích, ranh giới và số lượng căn nhà là chính xác 100%, tránh vẽ sai lệch.

### 2.2. Trình tự Thao tác & Cơ chế Hiển thị Phân lớp GIS (Multi-Layer GIS Display)

Để bảo đảm tính an toàn dữ liệu, hệ thống chia làm **2 Lớp GIS**:
1. **Lớp Bản đồ Đang Khảo sát của Surveyor (Surveyor Working Draft Layer):**
   - Khi Surveyor thực hiện cắt thửa tại Bước 5, trên màn hình di động của Surveyor sẽ **CẬP NHẬT NGAY LẬP TỨC** thành 2 thửa `B-00002` và `B-07001` (hiển thị viền cam nét đứt biểu thị trạng thái dự thảo).
   - Nhờ đó, Surveyor có thể lập tức tạo 2 Báo cáo độc lập và gán số liệu/ảnh cho từng căn nhà mà không bị nghẽn công việc.
2. **Lớp Bản đồ Quy hoạch Chính thức (Official Master GIS Layer - Cho Admin & Guest):**
   - **CHƯA CẬP NHẬT CHÍNH THỨC**.
   - Trên bản đồ chung của toàn dự án, thửa gốc `B-00002` sẽ nhấp nháy cờ cảnh báo màu cam: `PENDING_MUTATION_APPROVAL` (Đang có đề xuất biến động ranh từ hiện trường).

---

### 2.3. Cơ chế Xử lý khi Bị Trả Về / Từ Chối (Rejection & Rollback Handling)

Hệ thống phân biệt rõ ràng **2 Cấp độ Reject** với quy trình xử lý tự động:

#### Cấp độ 1: Zone Admin REJECT Đề xuất Biến động Ranh Thửa (Reject Mutation)
*Áp dụng khi Surveyor vẽ nhầm ranh, lấn ranh hàng xóm, hoặc thực tế chỉ là 1 căn nhà 1 chủ có 2 cửa:*
1. **Hủy bỏ Đề xuất Biến động:** Bản ghi `ParcelMutationEvent` chuyển sang trạng thái `REJECTED` kèm lý do từ chối của Admin.
2. **Khôi phục Thửa gốc (Rollback):** Thửa gốc `B-00002` được gỡ bỏ cờ cảnh báo, trở lại trạng thái `ACTIVE` bình thường với ranh giới đa giác ban đầu.
3. **Thu hồi Thửa phát sinh:** Thửa tạm `B-07001` chuyển trạng thái `MUTATION_VOID` (vô hiệu hóa, thu hồi mã `B-07001` về kho số tái sử dụng để không làm rác Database).
4. **Hủy Báo cáo rác & Điều chỉnh Task:** Báo cáo tạm của `B-07001` tự động bị hủy. Báo cáo của `B-00002` được trả về cho Surveyor để gộp nội dung thành 1 báo cáo duy nhất cho căn nhà.

#### Cấp độ 2: Zone Admin DUYỆT Ranh Thửa (Approve Mutation) nhưng REJECT Báo cáo Kỹ thuật (Reject Report Data)
*Áp dụng khi việc tách 2 nhà là đúng thực tế, nhưng Báo cáo của thửa `B-07001` bị thiếu ảnh vết nứt hoặc chưa đo lún nghiêng:*
1. **Ranh đất chính thức có hiệu lực:** `ParcelMutationEvent` chuyển thành `APPROVED`. Hai thửa `B-00002` và `B-07001` chính thức cập nhật lên **Official Master GIS Layer** toàn hệ thống.
2. **Chỉ trả về Báo cáo bị lỗi:** `SurveyReport` của thửa `B-07001` chuyển sang trạng thái `REJECTED` (Yêu cầu Surveyor bổ sung ảnh/số liệu kỹ thuật).
3. **Không Rollback ranh đất:** Ranh giới đất đã đúng thực tế nên được giữ nguyên vẹn trên GIS.

---

## 3. BỘ MÁY TÍNH ĐIỂM KỸ THUẬT TỰ ĐỘNG (ECS & VI SCORING ENGINE)

### 3.1. Bảng Điểm Hiện Trạng ECS ($\Sigma E \le 24$)
- **$E1$ (Hư hỏng tường/khối xây):** Tự động trích xuất từ **Burland Grade lớn nhất** của các Vùng $Z-xx$ ($0 \to 4$ điểm).
- **$E2$ (Khuyết tật kết cấu cột/dầm/sàn):** Tự động trích xuất từ **Ý nghĩa kết cấu lớn nhất** của các ghim $D-xx$ ($0 \to 4$ điểm).
- **$E3$ (Lún/nghiêng/võng):** Tự động tính từ số liệu đo lún nghiêng tại Bước 4 ($0 \to 4$ điểm).
- **$E4$ (Suy giảm vật liệu/rỉ thép):** Tự động trích xuất từ **Mức độ suy giảm lớn nhất** của các ghim $D-xx$ ($0 \to 4$ điểm).
- **$E5$ (Lịch sử cơi nới/sự cố):** Tự động tính từ kết quả phỏng vấn Bước 2.2 ($0 \to 4$ điểm).
- **$E6$ (Tình trạng chức năng tổng thể):** Cán bộ đánh giá trực tiếp ($0 \to 4$ điểm).
- **Tổng điểm ECS ($\Sigma E$):**
  - $\Sigma E \in [0, 5]$: `GOOD` (Tốt)
  - $\Sigma E \in [6, 10]$: `MEDIUM` (Trung bình)
  - $\Sigma E \in [11, 16]$: `DEFICIENT` (Kém)
  - $\Sigma E \in [17, 24]$: `CRITICAL` (Nguy cấp)

### 3.2. Quy tắc Can thiệp Kỹ sư (Engineering Judgement Rules)
- Zone Admin có quyền điều chỉnh phân hạng ECS nếu có căn cứ kỹ thuật.
- **Quy tắc Khoá an toàn (Safety Lock):** Nếu công trình có bất kỳ khuyết tật nào mang cờ `Critical` (Vết nứt $>5$mm phá hoại dầm/cột chịu lực hoặc nghiêng $>1.5\%$), hệ thống **KHOÁ CHẶT chức năng Hạ hạng**, bắt buộc giữ nguyên phân hạng nguy hiểm để bảo vệ an toàn cho dự án Metro.

---

## 4. QUY TRÌNH XUẤT BÁO CÁO TỔNG HỢP HÀNG LOẠT (COMPILED DOSSIER EXPORT)

### 4.1. Hai Cấp độ Báo cáo trong Hệ thống
1. **Báo cáo Đơn vị (Single Parcel Legal Report):** File PDF/A của từng thửa đất `B-XXXXX` đơn lẻ gồm đầy đủ 9 bước, ảnh định danh có watermark, sổ khuyết tật $D-xx$, bản vẽ phác thảo và ảnh chữ ký xác nhận.
2. **Bộ Hồ sơ Báo cáo Tổng hợp (Compiled Cadastral Dossier - `CompiledReportBatch`):** Tập hợp toàn bộ báo cáo của một Phân khu/Nhà ga hoặc toàn tuyến trong một khoảng thời gian (ngày, tuần, tháng), đóng gói kèm Sơ đồ GIS tổng hợp và Bảng kê danh mục thửa đất.

---

### 4.2. Phân Quyền & Ai Là Người Tạo Báo cáo Tổng Hợp?

| Vai trò | Phạm vi & Thẩm quyền Xuất Báo cáo Tổng hợp | Mục đích sử dụng |
| :--- | :--- | :--- |
| **`ZONE_ADMIN`** | **Xuất Bộ Báo cáo Phân khu (Zone Dossier):** Xuất toàn bộ các thửa đất đã duyệt trong Phân khu/Nhà ga mình phụ trách theo khoảng thời gian (ngày/tuần/tháng). | Báo cáo tiến độ tuần/tháng cho Ban QLĐS (MAUR) và đối soát nội bộ phân khu. |
| **`SUPER_ADMIN`** | **Xuất Bộ Báo cáo Toàn tuyến (Master Dossier):** Xuất toàn bộ ~7.000 thửa đất toàn tuyến hoặc gói thầu liên phân khu (Gói CP2, CP3...). | Bàn giao mốc pháp lý chính thức cho Nhà thầu thi công hầm TBM trước khi khởi công. |
| **`CONTRACTOR / GUEST`** | **Tải Bộ Báo cáo Đã Công Bố (Published Dossiers):** Chỉ được tải các file báo cáo tổng hợp đã được duyệt xuất bản (Read-only). | Tham khảo hiện trạng các lô đất phục vụ biện pháp thi công. |

---

### 4.3. Cấu trúc Thực thể `CompiledReportBatch` trong Cơ sở Dữ liệu

```typescript
class CompiledReportBatch {
    id: UUID;
    batchCode: String;               // VD: "DOSSIER-GA-S09-W38-2026"
    zoneId: UUID;                    // Gắn với Phân khu (hoặc null nếu toàn tuyến)
    timeRangeStart: DateTime;        // Từ ngày
    timeRangeEnd: DateTime;          // Đến ngày
    totalParcelsIncluded: Int;       // Tổng số thửa trong đợt xuất
    parcelCodesList: List<String>;   // ["B-00001", "B-00002", "B-07001", "B-00005"...]
    
    // Xuất bản & Phân quyền
    exportedByUserId: UUID;          // ID của ZoneAdmin hoặc SuperAdmin thực hiện
    exportFormat: ExportFormatEnum;  // PDF_BOOK | ZIP_ARCHIVE | EXCEL_GEOJSON
    fileDownloadUrl: String;         // Link tải file nén / PDF sách
    fileSizeBytes: Long;             // Dung lượng file
    checksumSha256: String;          // Mã băm kiểm tra tính toàn vẹn pháp lý
    
    isPublishedToGuests: Boolean;    // Cho phép Contractor/Guest tải về
    createdAt: DateTime;
}
```

---

### 4.4. Quy tắc Nhóm Thông Minh khi Xuất Báo Cáo (Smart Lineage Grouping)
Khi xuất Bộ báo cáo tổng hợp hàng loạt theo ngày/tuần:
- Hệ thống tự động sắp xếp theo thứ tự địa lý dọc tim tuyến Metro.
- Các thửa phát sinh do tách thửa (như `B-07001`) sẽ được **tự động gom nhóm hiển thị ngay sau thửa gốc `B-00002`** trong mục lục báo cáo, kèm nhãn chú thích: *(Thửa phát sinh tách từ B-00002)*.
- Nhờ đó, người đọc hồ sơ luôn thấy các công trình nằm cạnh nhau trên thực địa được sắp xếp liền kề trong tập báo cáo, trong khi mã định danh `B-00005` của các thửa khác hoàn toàn bất biến và không bị xô lệch.
