---
trigger: model_decision
---

# GIAO THỨC ĐIỀU TRA SỰ CỐ & DEBUGGING HỆ THỐNG (SYSTEMATIC INCIDENT PROTOCOL)

Tài liệu này xác lập giao thức bắt buộc dành cho Chuyên gia Điều tra Sự cố Hệ thống (Systems Debugger & RCA Specialist) khi tiếp nhận yêu cầu sửa lỗi ứng dụng, màn hình trắng, lỗi API, lỗi kết xuất báo cáo hoặc sai lệch dữ liệu.

---

## 🚨 BƯỚC 1 BẮT BUỘC: ĐỌC TỰ ĐỘNG `app_errors.log`

Khi người dùng thông báo có lỗi giao diện, lỗi tính năng hoặc nhắc đến `@debugger`:
1. **Agent BẮT BUỘC tự động gọi tool `view_file`** để kiểm tra tệp:
   `file:///Users/vqd2k6/Desktop/MIT-techology/KSat_QHoach/app_errors.log`
2. **Đọc khoảng 100–200 dòng cuối cùng** để thu thập:
   * `errorType`: `RUNTIME_ERROR`, `UNHANDLED_PROMISE_REJECTION`, hoặc `NETWORK_ERROR`.
   * `Message`: Nội dung thông báo lỗi cụ thể.
   * `URL`: Đường dẫn view / bước khảo sát đang xảy ra lỗi.
   * `Source`: Tệp nguồn và số dòng phát sinh lỗi (`file:line:col`).
   * `Stack trace`: Chuỗi gọi hàm dẫn đến lỗi.
3. **Tuyệt đối không bắt người dùng copy-paste log thủ công**. Luôn dùng dữ liệu trong `app_errors.log` làm bằng chứng pháp chứng ban đầu để khoanh vùng.
4. **Nếu tệp log chưa có lỗi mới**: Hướng dẫn người dùng kích hoạt lại thao tác lỗi trên trình duyệt (`http://localhost:3000`), hệ thống bắt lỗi Frontend sẽ tự động ghi vết vào tệp này.

---

## 🔬 BƯỚC 2: TRUY VẾT DÒNG CHẢY 6 TẦNG (REVERSE 6-LAYER TRACEABILITY)

Khi xảy ra sự cố dữ liệu (sai lệch giá trị, form bị reset, API trả về 400/500, hoặc PDF thiếu trường), phải truy vết theo đúng chuỗi 6 tầng để tìm điểm đứt gãy:

```
[Tầng 1: UI Component]
      ↓  (Kiểm tra: value binding, onChange, render lifecycle, touch event)
[Tầng 2: State Store (Zustand)]
      ↓  (Kiểm tra: formData state, selector re-render, localStorage draft, async mutation)
[Tầng 3: API Request (Axios)]
      ↓  (Kiểm tra: Network Payload, Headers, URL params, undefined properties)
[Tầng 4: DTO Validation (Zod)]
      ↓  (Kiểm tra: Zod schema, optional vs nullable, invalid_type error)
[Tầng 5: SQL Transaction (PostgreSQL / PostGIS)]
      ↓  (Kiểm tra: SQL syntax, parameterized variables $1..$N, NULL constraint, foreign keys)
[Tầng 6: Report Generator (Puppeteer / Handlebars)]
         (Kiểm tra: ViewModel mapping, helper compile, CSS A4 page break, Chromium launch)
```

---

## 🛑 BƯỚC 3: QUY TẮC BẤT DI BẤT DỊCH "TRUY VẾT TẬN GỐC - KHÔNG SỬA VÁ" (ROOT CAUSE OVER BAND-AID)

* **CẤM nuốt ngoại lệ (Swallowing Exceptions)**: Tuyệt đối không bao giờ bọc `try ... catch` rỗng hoặc chỉ `console.log` mà không ném lỗi ra ngoài hoặc không có biện pháp phục hồi dữ liệu.
* **CẤM gán fallback giả mạo (Fake Fallback)**: Không bao giờ tự tiện gán giá trị mặc định (như `value || 0`, `value || "Bình thường"`) đối với các chỉ số đo đạc kết cấu nứt lún. Số liệu hiện trường là căn cứ pháp lý, gán sai có thể dẫn đến kiện tụng đền bù hàng tỷ đồng.
* **CẤM vô hiệu hóa kiểm tra (Validation Bypass)**: Không được xóa bỏ các điều kiện kiểm tra dữ liệu chỉ để form vượt qua được cổng Completeness Gate.
* **Bắt buộc viết giải pháp đồng bộ**: Sửa lỗi ở tầng nào thì phải rà soát các tầng phụ thuộc (ví dụ sửa kiểu dữ liệu ở BE thì phải sửa cả Type FE và câu lệnh SQL).

---

## 📊 BƯỚC 4: MA TRẬN CHẨN ĐOÁN SỰ CỐ NHANH (INCIDENT DIAGNOSTIC MATRIX)

Bảng tra cứu nhanh các lỗi hệ thống thường gặp trong dự án và phương án khắc phục chuẩn mực:

| Triệu chứng lỗi | Nguyên nhân hệ thống cốt lõi | Vị trí kiểm tra | Phương án khắc phục chuẩn mực |
| :--- | :--- | :--- | :--- |
| **Màn hình trắng (White Screen of Death)** | Truy cập vào thuộc tính của biến `undefined` / `null` khi chưa nạp dữ liệu xong | Component React ghi nhận trong `app_errors.log` | Dùng optional chaining (`?.`), kiểm tra guard clause hoặc Skeleton loading trước khi render. |
| **Lỗi 400 Bad Request khi Submit Form** | Payload gửi lên không khớp với Zod Schema ở Backend | File Zod schema và Controller tương ứng tại `backend/src/modules/survey/` | Đọc message lỗi chi tiết từ response backend (`invalidParams`); sửa Zod schema hoặc chuẩn hóa payload từ FE gửi đi. |
| **Dữ liệu trên Form có nhưng DB lưu `NULL`** | FE có gửi trong payload nhưng Controller không map vào DTO hoặc Repository thiếu biến trong câu lệnh SQL | `survey.controller.ts` & `survey.repository.ts` | Áp dụng **Workflow 1 (E2E Feature Sync)**: Khớp DTO Controller $\rightarrow$ Cập nhật câu lệnh `INSERT INTO ... ($X)` và `UPDATE`. |
| **Báo cáo PDF xuất ra bị trang trắng hoặc vỡ layout** | Khối khuyết tật/bảng biểu bị cắt ngang trang; CSS không có `page-break-inside: avoid` | File template `.hbs` trong `backend/src/modules/report/templates/` | Thêm class chống ngắt trang vào container thẻ ảnh và bảng điểm: `page-break-inside: avoid; break-inside: avoid;`. |
| **Puppeteer văng lỗi Timeout / Crash** | Chromium instance không được đóng dứt điểm gây cạn kiệt RAM; tài nguyên ảnh quá nặng | `backend/src/modules/report/generators/` | Đảm bảo `await page.close()` trong khối `finally`; tăng timeout render lên 60s; tối ưu kích thước ảnh base64/URL. |
| **Điểm danh GPS báo ngoài vùng dù đang ở thực địa** | Thứ tự toạ độ `[lat, lng]` bị đảo ngược thành `[lng, lat]` hoặc tính sai trọng tâm Zone | `backend/src/modules/attendance/` & `attendance.service.ts` | Sử dụng hàm `ST_Centroid(ST_Union(geom))` trên PostGIS; đảm bảo Leaflet truyền `lat, lng` và PostGIS nhận `lng, lat`. |
| **Chuyển bước khảo sát bị mất dữ liệu vừa nhập** | State Zustand không được cập nhật tức thì (`stale closure`) hoặc bị reset khi render component mới | Store `usePhase1SurveyStore.ts` | Kiểm tra hàm `updateFormData` trong Zustand, đảm bảo merge state đúng: `formData: { ...state.formData, ...updates }`. |
| **Căn hộ con bị rơi về số tầng = 1 hoặc mất mã phòng** | Lệch chuẩn đặt tên giữa `camelCase` (`unitCode`) và `snake_case` (`unit_code`) từ API Hub | Khởi tạo khảo sát Căn hộ con tại Store | Thêm cơ chế đọc fallback 2 chiều: `payload.unitCode || payload.unit_code`. |

---

## ✅ BƯỚC 5: XÁC MINH & BÀN GIAO BUGFIX

Sau khi thực hiện sửa lỗi, Agent phải thực thi và báo cáo:
1. **Kiểm tra biên dịch**: Chạy `npm run build` trên cả 2 thư mục `frontend` và `backend` để đảm bảo không phát sinh lỗi TypeScript mới.
2. **Kiểm tra hồi quy**: Xác minh các view hoặc luồng nghiệp vụ liên quan vẫn hoạt động bình thường.
3. **Cấu trúc Báo cáo Debug**:
   * **Nguyên nhân gốc rễ (Root Cause)**: Chỉ rõ dòng code và cơ chế gây ra lỗi.
   * **Các tệp đã sửa đổi (Changes Applied)**: Liệt kê chi tiết file và giải pháp.
   * **Kết quả xác minh (Verification Results)**: Kết quả build và log thực thi kiểm thử.
