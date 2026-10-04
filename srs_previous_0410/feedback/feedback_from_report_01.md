# YÊU CẦU ĐIỀU CHỈNH & BỔ SUNG HỆ THỐNG TỪ THIẾT KẾ BÁO CÁO (BCS REPORT FEEDBACK #01)
## (Tài liệu bàn giao kỹ thuật cho Đội ngũ Lập trình viên - Dev Team)

Tài liệu này tổng hợp toàn bộ các phản hồi nghiệp vụ, quy chuẩn pháp lý và yêu cầu kỹ thuật phát sinh từ quá trình rà soát Báo cáo Khảo sát Hiện trạng Phase 1 (chuẩn Liên danh CRLG–CRSRI–TT và Ban Quản lý Đường sắt Đô thị MAUR / Nhà thầu EPC THACO-CREC), làm căn cứ để đội ngũ Lập trình viên (Dev Team) hoàn thiện cơ sở dữ liệu, API backend và giao diện khảo sát frontend.

---

## 1. QUY ƯỚC MÃ ĐỊNH DANH KHẢO SÁT VIÊN (SURVEYOR ID) & QUẢN LÝ TÀI KHOẢN
- **Hiện trạng**: Hệ thống đang thiếu mã định danh `Survey ID` của từng Khảo sát viên; trường Survey ID trên báo cáo đang bị tự động ghép chuỗi giả lập.
- **Quy ước chuẩn**:
  $$\text{Surveyor ID} = \mathbf{P\text{-}XXXX}$$
  *Trong đó: $XXXX$ là 4 chữ số cuối cùng trong số điện thoại (`phone`) của Khảo sát viên (VD: SĐT `0903456789` $\rightarrow$ Mã Surveyor ID là `P-6789`).*
- **Yêu cầu Dev triển khai**:
  1. **Validation**: Đối với tài khoản có vai trò `role = 'SURVEYOR'`, trường số điện thoại `phone` là **bắt buộc**.
  2. **Database Migration**: Bổ sung cột `surveyor_code VARCHAR(16)` vào bảng `users`.
  3. **Backend Service**: Khi tạo hoặc cập nhật tài khoản Surveyor, tự động sinh:
     `surveyor_code = 'P-' || RIGHT(REGEXP_REPLACE(phone, '\D', '', 'g'), 4)`.
  4. **Report Generator**: Tự động lấy mã `P-XXXX` này điền vào ô Survey ID trên Trang bìa và Bảng Document Control của Báo cáo.
  5. **Frontend Profile**: Nếu tài khoản cũ chưa có SĐT, hệ thống nhắc nhở cập nhật SĐT cá nhân trong profile để kích hoạt mã định danh trước khi nộp hồ sơ khảo sát.

---

## 2. LẤY ĐỊA CHỈ THỰC TẾ TỪ KHẢO SÁT PHASE 1 (KHÔNG DÙNG ĐỊA CHỈ MẶC ĐỊNH GIS)
- **Hiện trạng**: Báo cáo đang lấy địa chỉ từ dữ liệu ban đầu của thửa đất GIS.
- **Bản chất nghiệp vụ thực tế**:
  - Dữ liệu địa chính/ranh thửa quy hoạch ban đầu được nhập từ Sở Quy hoạch Kiến trúc (SQHKT) lên hệ thống bản đồ GIS có thể đã cũ, chưa cập nhật việc đổi tên đường mới, chia tách số nhà hoặc số nhà tạm.
  - Tại **Bước 1 của khảo sát Phase 1**, Khảo sát viên đã đến tận thực địa hiện trường, đối chiếu biển số nhà thực tế và điền số nhà, tên đường hiện hữu vào form (`formData.houseNumber`, `formData.street`).
- **Yêu cầu Dev triển khai**:
  1. Báo cáo Report **bắt buộc phải lấy địa chỉ thực tế được ghi nhận từ khảo sát Phase 1** (`house_number` và `street` khảo sát).
  2. Tuyệt đối không lấy địa chỉ mặc định cũ trên GIS nếu khảo sát Phase 1 đã cập nhật thông tin mới.
  3. Khi Surveyor lưu/nộp hồ sơ Bước 1 Phase 1, backend tự động đồng bộ địa chỉ thực tế này vào `parcels.house_number`, `parcels.street` và lưu vết vào `base_survey_reports` làm căn cứ pháp lý đối soát.

---

## 3. NGÀY KHẢO SÁT BÁO CÁO (SURVEY DATE)
- **Hiện trạng**: Ngày trên báo cáo đôi lúc bị nhầm với ngày xuất file PDF hoặc ngày duyệt hồ sơ.
- **Yêu cầu Dev triển khai**:
  1. `surveyDate` trên trang bìa, bảng Document Control và khung chữ ký **bắt buộc phải là Ngày mà Khảo sát viên thực tế tiến hành khảo sát Phase 1 tại hiện trường** (`base_survey_reports.survey_date`).
  2. Định dạng ngày hiển thị chuẩn Việt Nam: `DD/MM/YYYY`.

---

## 4. QUẢN LÝ PHIÊN BẢN BÁO CÁO (REVISION CONTROL - REV.) THEO THỬA ĐẤT
- **Hiện trạng**: Biến `Rev.` đang để mặc định chuỗi `'00'`.
- **Yêu cầu Dev triển khai**:
  1. `Rev.` phải gắn chặt với từng Thửa đất / Hồ sơ khảo sát:
     - Khi xuất báo cáo lần đầu tiên: hiển thị `Rev. 00`.
     - Nếu sau này hồ sơ được mở khóa (Re-opened) để bổ sung/chỉnh sửa thông tin (bổ sung ảnh, sửa vết nứt, cập nhật số đo lún...) và được phê duyệt xuất lại, hệ thống phải **tự động tăng lên `Rev. 01`, `Rev. 02`...**
  2. **Database Migration**: Bổ sung cột `export_revision INT NOT NULL DEFAULT 0` trong bảng `base_survey_reports`.
  3. **Backend Logic**: Mỗi khi Zone Admin duyệt lại hoặc kích hoạt xuất lại hồ sơ đã từng xuất, tự động thực hiện:
     `UPDATE base_survey_reports SET export_revision = export_revision + 1 WHERE id = $1`.

---

## 5. CHUẨN HÓA 3 CẤP KÝ DUYỆT BÁO CÁO & TRUY XUẤT SUPER ADMIN
- **Quy chuẩn 3 cấp ký duyệt văn bản kỹ thuật CRLG**:
  1. **Người lập (Prepared by)**: Là **Khảo sát viên (Surveyor)** trực tiếp thực hiện khảo sát tại hiện trường.
  2. **Kiểm tra (Checked by)**: Là **Zone Admin** phụ trách giám sát và quản lý kỹ thuật của phân khu ga đó.
  3. **Phê duyệt (Approved by)**: Là **Super Admin** - người quản lý cấp cao nhất đã tạo ra tài khoản Zone Admin đó.
- **KẾT QUẢ KIỂM TRA TRONG CODE THEO YÊU CẦU CỦA USER**:
  - Đã rà soát trực tiếp class `AuthRepository`, `UserEntity` và bảng `users` trong database.
  - **Kết luận**: Hiện tại bảng `users` **chưa có trường `created_by_user_id`** và không có bất kỳ class nào lưu vết được Super Admin nào đã tạo ra Zone Admin.
- **Yêu cầu Dev triển khai**:
  1. **Database Migration**:
     ```sql
     ALTER TABLE users ADD COLUMN created_by_user_id UUID REFERENCES users(id);
     ```
  2. **Backend Auth Module**:
     - Cập nhật `AuthRepository.createUser` và `user-admin.controller.ts`: Khi Super Admin đăng nhập và tạo tài khoản Zone Admin mới, tự động lưu `created_by_user_id = req.user.id`.
  3. **Query xuất Báo cáo**:
     - `Prepared by`: Lấy từ `base_survey_reports.surveyor_id`.
     - `Checked by`: Lấy từ `base_survey_reports.zone_admin_id`.
     - `Approved by`: Truy xuất ngược Super Admin từ `users.created_by_user_id` của Zone Admin đó (`SELECT u_super.* FROM users u_super JOIN users za ON za.created_by_user_id = u_super.id WHERE za.id = r.zone_admin_id`).
  4. **Fallback logic an toàn**: Với các Zone Admin cũ trong database chưa có `created_by_user_id`, hệ thống tự động fallback lấy Super Admin đang hoạt động đầu tiên (`SELECT * FROM users WHERE role = 'SUPER_ADMIN' AND status = 'ACTIVE' ORDER BY created_at ASC LIMIT 1`).

---

## 6. THUỘC TÍNH ẢNH CHỮ KÝ (`signature_image_url`) CỦA TÀI KHOẢN NGƯỜI DÙNG
- **Hiện trạng**: Khung chữ ký đang dùng nét vẽ canvas tạm thời hoặc để trống.
- **Yêu cầu Dev triển khai**:
  1. **Database Migration**:
     ```sql
     ALTER TABLE users ADD COLUMN signature_image_url TEXT;
     ```
  2. **User Profile Settings**: Trong màn hình Hồ sơ cá nhân (Profile Settings), cho phép người dùng có các role `SURVEYOR`, `ZONE_ADMIN`, `SUPER_ADMIN` tải lên **File ảnh chữ ký chuẩn** (ảnh chụp chữ ký thật, nền trắng hoặc PNG trong suốt).
  3. **Report Generator**:
     - Tự động lấy ảnh chữ ký từ attribute `users.signature_image_url` của 3 tài khoản tương ứng để chèn vào khung ký tên của trang bìa, bảng Document Control và Phụ lục F.
     - Không sử dụng chữ ký số chứng thư số phức tạp hay nét vẽ cảm ứng giả lập.

---

## 7. LOẠI BỎ MÃ BĂM SHA-256 CHECKSUM VÀ MÃ QR TRA CỨU
- **Yêu cầu**:
  - Bỏ hoàn toàn khối hiển thị **Mã băm SHA-256 Checksum** và **Mã QR tra cứu điện tử** ở cuối báo cáo.
  - Lý do: Báo cáo kỹ thuật in ấn nộp đối tác tập trung vào chữ ký sống/ảnh chữ ký và nội dung kỹ thuật theo đúng mẫu hồ sơ công trường, không đưa các thành phần công nghệ gây rối trang in.

---

## 8. NGUYÊN TẮC CỐT LÕI: ĐỂ TRỐNG NẾU KHÔNG CÓ THỰC TẾ (TUYỆT ĐỐI KHÔNG DÙNG DUMMY TEXT)
- **Quy tắc bất biến**:
  - Đối với tất cả các mục ghi chú phát sinh tại hiện trường:
    - Ghi chú cơi nới, sửa chữa kết cấu (`extendedOrRenovatedNotes`)
    - Ghi chú lún, nghiêng cũ (`previousSettlementNotes`)
    - Ghi chú sự cố hỏa hoạn, ngập lụt (`fireOrAccidentNotes`)
    - Ghi chú thiết bị nhạy cảm rung động (`sensitiveEquipmentNotes`)
    - Ghi chú tự do lịch sử công trình (`historyDetailsNote`)
    - Nhận xét của Kỹ sư về biến dạng (`deformationEngineerComments`)
    - Ghi chú tầng (`floors[i].notes`)
    - Ghi chú vùng kiến trúc Z (`zones[j].notes`)
    - Ghi chú vết nứt D (`defects[k].notes`)
    - Ý kiến chuyên gia rà soát BRA (`braEngineeringReviewNotes`)
    - Tóm tắt kết luận hiện trạng (`summaryConclusions`)
    - Kiến nghị kỹ thuật bảo vệ & quan trắc (`engineeringRecommendations`)
    - Ý kiến, yêu cầu phản ánh của Chủ nhà (`ownerRemarks`)
    - Độ võng dầm/sàn (`beamDeflectionMm`): Nếu không đo được thì để trống, không gán `0.0`.
    - Độ nghiêng công trình (`tiltAngleX`, `tiltAngleY`): Nếu không đo được thì để trống.
  - **LOGIC XỬ LÝ**:
    - **NẾU CÓ TRONG KHẢO SÁT PHASE 1 $\rightarrow$ LẤY ĐIỀN VÀO BÁO CÁO**.
    - **NẾU KHÔNG CÓ $\rightarrow$ ĐỂ TRỐNG HOÀN TOÀN (`""`) HOẶC HIỂN THỊ DẤU GẠCH NGANG NHẸ (`--`)**.
    - **TUYỆT ĐỐI KHÔNG TỰ ĐỘNG ĐIỀN CHỮ MẪU / CHỮ GIẢ LẬP (DUMMY TEXT)** (như: *"Không có cơi nới...", "Chủ nhà không ghi nhận...", "Không có ý kiến..."*). Mọi dòng chữ trên báo cáo đều mang giá trị pháp lý đền bù nên chỉ ghi nhận những gì thực tế có tại hiện trường.

---

## 9. BỔ SUNG "DIỆN TÍCH SÀN XÂY DỰNG" & "CHIỀU CAO CÔNG TRÌNH" VÀO BIỂU MẪU KHẢO SÁT
- **Hiện trạng**:
  - Biểu mẫu khảo sát Phase 1 tại Bước 2 (Phỏng vấn & Kết cấu) chưa có 2 ô nhập liệu cho Diện tích sàn và Chiều cao, khiến báo cáo phải lấy tạm diện tích thửa đất GIS và tự nhân giả định chiều cao ($floors \times 3.6m$).
- **Yêu cầu Dev triển khai**:
  1. **Frontend (Bước 2: Phỏng vấn chủ hộ & Thông số kỹ thuật kết cấu)**:
     - Bổ sung 2 ô input nhập số:
       - `Diện tích sàn xây dựng (m²)`: trường `constructionAreaM2` (Input số thập phân, placeholder: *VD: 120.5*).
       - `Chiều cao công trình (m)`: trường `buildingHeightM` (Input số thập phân, placeholder: *VD: 11.8*).
  2. **Database Migration**:
     ```sql
     ALTER TABLE building_specifications ADD COLUMN construction_area_m2 NUMERIC(10,2);
     ALTER TABLE building_specifications ADD COLUMN building_height_m NUMERIC(6,2);
     ALTER TABLE building_specifications ADD COLUMN foundation_source VARCHAR(64);
     ```
  3. **Backend DTO & Service**:
     - Cập nhật `BuildingSpecsDto` để nhận 2 trường này khi lưu Bước 2.
     - Cập nhật `SurveyRepository.saveBuildingSpecs` để lưu vào database.
  4. **Report Generator**:
     - Đọc trực tiếp 2 trường này từ `building_specifications`.
     - Nếu chưa nhập $\rightarrow$ hiển thị dấu gạch ngang `--`, **tuyệt đối không tự động nhân $3.6m$ và không lấy diện tích đất**.

---

## 10. TỔNG HỢP SQL MIGRATION SCRIPT CHO DEV CHẠY NGAY

```sql
-- ============================================================================
-- BCS REPORT FEEDBACK #01 - DATABASE MIGRATION SCRIPT
-- ============================================================================

-- 1. Bổ sung liên kết Super Admin tạo Zone Admin & Thuộc tính Chữ ký số / Mã Surveyor
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS signature_image_url TEXT,
  ADD COLUMN IF NOT EXISTS surveyor_code VARCHAR(16);

-- Tự động sinh surveyor_code cho các Surveyor hiện có nếu có SĐT
UPDATE users 
SET surveyor_code = 'P-' || RIGHT(REGEXP_REPLACE(phone, '\D', '', 'g'), 4)
WHERE role = 'SURVEYOR' AND phone IS NOT NULL AND (surveyor_code IS NULL OR surveyor_code = '');

-- 2. Bổ sung trường Diện tích sàn, Chiều cao và Nguồn móng vào building_specifications
ALTER TABLE building_specifications
  ADD COLUMN IF NOT EXISTS construction_area_m2 NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS building_height_m NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS foundation_source VARCHAR(64);

-- 3. Bổ sung Revision Counter vào base_survey_reports
ALTER TABLE base_survey_reports
  ADD COLUMN IF NOT EXISTS export_revision INT NOT NULL DEFAULT 0;
```

---

## 11. DANH SÁCH FILE VÀ CHECKLIST BÀN GIAO CHO DEV TEAM

| STT | Phân hệ | File cần can thiệp | Nội dung cần xử lý |
| :---: | :--- | :--- | :--- |
| 1 | **Database** | `database/migrations/xxx_report_feedback_01.sql` | Chạy đoạn script SQL ở Mục 10. |
| 2 | **Auth Backend** | `backend/src/modules/auth/auth.repository.ts` | Bổ sung `created_by_user_id`, `signature_image_url`, `surveyor_code` vào `UserEntity` và `createUser`. |
| 3 | **Auth Backend** | `backend/src/modules/auth/user-admin.controller.ts` | Truyền `req.user.id` vào `created_by_user_id` khi Super Admin tạo tài khoản Zone Admin. |
| 4 | **Survey Backend**| `backend/src/modules/survey/survey.dto.ts` | Bổ sung `constructionAreaM2`, `buildingHeightM`, `foundationSource` vào DTO Bước 2. |
| 5 | **Survey Backend**| `backend/src/modules/survey/survey.repository.ts` | Bổ sung lưu/đọc `construction_area_m2`, `building_height_m`, `export_revision` và join lấy `signature_image_url`, `created_by_user_id`. |
| 6 | **Frontend Wizard**| `frontend/src/features/survey-phase1/components/Step2_OwnerInterview.tsx` | Bố trí 2 ô input nhập `Diện tích sàn xây dựng (m²)` và `Chiều cao công trình (m)`. |
| 7 | **Frontend Store** | `frontend/src/features/survey-phase1/store/usePhase1SurveyStore.ts` | Bổ sung `constructionAreaM2`, `buildingHeightM` vào `Phase1SurveyFormData`. |
| 8 | **Report Module** | `backend/src/modules/report/generators/residential.generator.ts` | Đã cập nhật: Bỏ SHA-256/QR, Survey ID `P-XXXX`, không nhân giả định chiều cao, để trống các note nếu không có. |
