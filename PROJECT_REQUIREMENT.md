# Tài liệu Đặc tả Yêu cầu (PRD) - Hệ thống Khảo sát Hiện trạng Công trình (KSQH - Metro 2)

> Phiên bản tài liệu này được tổng hợp từ cuộc phỏng vấn yêu cầu ban đầu và toàn bộ quá trình phát triển các biểu mẫu (Phase 1, Phase 2). Bạn có thể dùng tài liệu này làm **Requirement Document** chuẩn để giao việc cho các team xây dựng lại (re-build) ứng dụng.
> 
> **Lưu ý Kiến trúc:** Tài liệu này đã được điều chỉnh định hướng sang xây dựng ứng dụng dạng **PWA (Progressive Web App)** nhằm tránh thời gian chờ kiểm duyệt trên App Store/Play Store, giúp triển khai tức thì.

---

## 1. Tổng quan dự án (Project Overview)
- **Mục tiêu:** Xây dựng hệ thống PWA (Web App dùng trên Mobile) & Web Admin hỗ trợ cán bộ hiện trường thu thập thông tin ngoại thất, nội thất, kết cấu của các công trình (nhà ở, trường học,...) nằm trong vùng ảnh hưởng của dự án xây dựng tuyến Metro số 2.
- **Mục đích sử dụng dữ liệu:** Làm căn cứ pháp lý, ghi nhận hiện trạng (Baseline Condition Survey) trước khi thi công. Dùng để đối chiếu, đền bù hoặc khước từ đền bù nếu có tranh chấp, khiếu nại về nứt/sập/lún do thi công Metro gây ra sau này.

---

## 2. Phân quyền và Nền tảng (Roles & Platforms)

### 2.1. Phân quyền người dùng (User Roles)
Hệ thống áp dụng mô hình phân cấp 3 lớp:
1. **Super Admin (Quản trị cấp cao):** Quản lý toàn bộ dữ liệu, bản đồ quy hoạch tổng thể (GIS), tạo và giao việc (gán Zone) cho các Admin cấp dưới.
2. **Zone Admin (Quản lý phân khu):** Quản lý dữ liệu trong khu vực/nhà ga được giao. Phân công task trực tiếp cho cán bộ hiện trường và **kiểm duyệt** kết quả sau khi khảo sát xong.
3. **Surveyor (Cán bộ hiện trường):** Người trực tiếp cầm thiết bị điền form, chụp ảnh, vẽ sơ đồ và nộp dữ liệu. 

### 2.2. Nền tảng (Platforms)
- **Thiết bị:** Ứng dụng PWA hoạt động đa nền tảng (iOS Safari, Android Chrome). Cán bộ hiện trường sẽ dùng tính năng **"Add to Home Screen" (Thêm vào Màn hình chính)** để trải nghiệm như một App Native (ẩn thanh địa chỉ). Web Portal dành cho Admin trên PC.
- **Hạ tầng mạng:** Ưu tiên hoạt động trực tuyến (mạng 5G bao phủ tốt ở trung tâm thành phố), nhưng có khả năng hoạt động tạm thời khi rớt mạng.

---

## 3. Yêu cầu Chức năng Cốt lõi (Core Features)

### 3.1. Bản đồ và Không gian (Map & GIS)
- **Dữ liệu nền:** Sử dụng hệ thống bản đồ (như Mapbox/Google Maps).
- **Lớp Overlay (KML/GeoJSON):** Hiển thị chính xác **đường line ranh giới Metro 2** và các ranh giới thửa đất/lô đất. Cho phép bật/tắt (ẩn/hiện) các lớp bản đồ.
- **Định vị & Vẽ bản đồ:**
  - Tự động bắt toạ độ qua Geolocation API (HTML5) khi Surveyor check-in.
  - Sau khi khảo sát xong tòa nhà (hoặc toàn bộ lô), Surveyor có thể **vẽ lại đường bao đa giác (Polygon)** của công trình để đồng bộ ngược lại hệ thống GIS của Admin (vì bản đồ quy hoạch cũ có thể sai lệch so với thực tế).

### 3.2. Chế độ Ngoại tuyến (Offline-First / Offline Fallback)
- **Use-case:** Khi đi sâu vào tầng hầm, phòng kín hoặc lên tầng cao mất sóng, PWA lưu tạm dữ liệu bằng IndexedDB / Service Workers.
- **Quy trình Đồng bộ khắt khe:** Vì trình duyệt iOS Safari có tính năng tự dọn dẹp IndexedDB khi hết dung lượng, hệ thống yêu cầu quy trình đồng bộ chặt chẽ: Surveyor **phải bấm Sync (Đồng bộ) ngay lập tức** khi ra khỏi toà nhà có sóng 5G. Không lưu ngâm dữ liệu trên trình duyệt trong nhiều ngày.

### 3.3. Quản lý Hình ảnh (Media Management)
- **Truy cập Camera:** Dùng thẻ `<input type="file" accept="image/*" capture="camera">` để gọi Native Camera, mang lại độ nét tốt nhất trên PWA. Quy mô dự kiến: ~7.000 hộ x 20 ảnh/hộ. 
- **Watermark Tự động:** 
  - Ảnh P01-P04, Ảnh khuyết tật CTX, CU bắt buộc có Watermark (Mã công trình, Toạ độ GPS, Thời gian).
  - Khuyến nghị: Thực hiện đóng Watermark phía **Server (Backend)** ngay khi ảnh được upload lên để giảm tải RAM cho trình duyệt Mobile, tránh gây crash Safari.

### 3.4. Ghim Khuyết tật trên Sơ đồ (Defect Pinning on Sketch)
- Tải bản vẽ (CAD/Floorplan) hoặc chụp phác thảo tay.
- Chạm (Touch/Tap) lên ảnh để thả Pin mã khuyết tật (VD: `D-01`).
- **Kỹ thuật Web:** Vùng không gian vẽ/thả ghim (Canvas) bắt buộc phải khoá thao tác cuộn trang của trình duyệt (`touch-action: none; overflow: hidden`) để chống xung đột với thao tác vuốt của iOS.

---

## 4. Đặc tả Biểu mẫu Khảo sát (Survey Forms)

Quy trình khảo sát một công trình chia làm 2 Giai đoạn (Phases). 

### 4.1. Phase 1: BCS, ECS, BRA (Đánh giá sơ bộ & Rủi ro)
Mục đích: Chấm điểm rủi ro, phân loại mức độ nhạy cảm của toà nhà.
- **Bước 1:** Thông tin công trình (Chủ hộ, địa chỉ, năm xây dựng).
- **Bước 2:** Ảnh định danh (P-01 Biển số nhà, P-02 Mặt đứng, P-03 Phụ, P-04 Bối cảnh).
- **Bước 3:** Phạm vi khảo sát (Đã khảo sát phần nào, chưa khảo sát phần nào).
- **Bước 4:** Đặc điểm & Móng (Loại nhà, số tầng, kết cấu chịu lực, loại móng).
- **Bước 5:** Lịch sử & Nhạy cảm (Đã sửa chữa lớn chưa, có ngập nước không).
- **Bước 6:** Thang đo hư hỏng Burland (Từ 0 - Không đáng kể đến 5 - Rất nghiêm trọng).
- **Bước 7:** ECS (Đánh giá tình trạng hiện hữu - Điểm từ 0 đến 5 cho Tường, Cột, Dầm, Thấm dột). Tính ra ECS Tối đa.
- **Bước 8:** Data & VI (Độ hoàn thiện dữ liệu và Chỉ số dễ tổn thương).
- **Bước 9:** Tác động thi công (Mức độ tác động dự kiến của Metro tới toà nhà).
- **Bước 10:** Tổng kết (BRA) và kết luận (Có cần Monitoring hay không).

### 4.2. Phase 2: Pre-Construction BCS (Đánh giá chi tiết Khuyết tật)
Mục đích: Đi từng phòng, ghi nhận từng vết nứt, độ lún trước khi đào hầm.
- **Bước 1:** Khởi tạo (Kế thừa thông tin từ Phase 1).
- **Bước 2:** Phạm vi tiếp cận (Đầy đủ, Một phần, Hạn chế, Từ chối) và chụp lại ảnh P01, P02.
- **Bước 3:** Lập danh sách lưới các phòng/Khu vực.
- **Bước 4:** Ghi nhận Khuyết tật (Defects). Kích thước (Rộng x Dài). Chụp Ảnh bối cảnh (CTX) và Ảnh cận (CU).
- **Bước 5:** Đo đạc lún/nghiêng (Sử dụng máy toàn đạc/dây dọi).
- **Bước 6:** Vẽ Sơ đồ vị trí khuyết tật (Defect Pinning - Dùng Canvas).
- **Bước 7:** Tổng kết, lấy chữ ký điện tử của Cán bộ khảo sát và Chủ hộ (Xác nhận hiện trạng).

---

## 5. Lộ trình Triển khai Đề xuất (Deployment Strategy)
1. **Giai đoạn 1 (Thiết kế UI/UX & PWA Demo):** Xây dựng luồng chạy thử. Đảm bảo form nhập liệu hợp lý, thao tác mượt mà trên Mobile Safari/Chrome.
2. **Giai đoạn 2 (Thiết kế Database & Backend):** Dựa vào UI/UX đã chốt để thiết kế lược đồ CSDL (PostgreSQL + PostGIS). Phát triển API. Tích hợp tính năng tự động Watermark ảnh ở Backend.
3. **Giai đoạn 3 (Tích hợp & Offline Sync):** Gắn API vào PWA. Xử lý triệt để bài toán IndexedDB và Service Worker cho Offline Sync. Xây dựng tài liệu hướng dẫn "Add to Home Screen" cho cán bộ hiện trường.
4. **Giai đoạn 4 (Triển khai & Vận hành):** Public link PWA cho cán bộ cài đặt. Cập nhật dữ liệu GIS, phân Zone thật. Tiến hành thu thập dữ liệu.
