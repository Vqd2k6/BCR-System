# Bản Đồ Định Vị Nhanh Codebase Metro 2 BCS (`metro2-code-map.md`)

Dùng tài liệu này trong Bước 1 của `convert-idea` để nhảy thẳng tới đúng file cần đọc mà không phải quét toàn bộ dự án.

---

## 1. Frontend (`frontend/src/`)

### 1.1. Ba Luồng Khảo Sát Chính (Wizards & Stores)
1. **Nhà dân độc lập (`survey-phase1`)**:
   * **Store**: `frontend/src/features/survey-phase1/store/usePhase1SurveyStore.ts`
   * **Types**: `frontend/src/features/survey-phase1/types/phase1.types.ts`
   * **9 Bước khảo sát (`frontend/src/features/survey-phase1/components/`)**:
     * `Step1_BuildingIdentification.tsx`: Định danh công trình & bộ 4 ảnh `P-01`..`P-04`.
     * `Step2_OwnerInterview.tsx`: Phỏng vấn chủ hộ & pháp lý.
     * `Step3_FloorHierarchySurvey.tsx`: Phân tầng, mặt bằng CAD & ghim khuyết tật (`Z-01`, `E-01`, `D-01`).
     * `Step4_BurlandSummary.tsx`: Tổng hợp phân cấp hư hại Burland.
     * `Step5_SettlementTiltSurvey.tsx`: Đo lún, độ nghiêng tổng thể & độ võng.
     * `Step6_ScopeAndGisMutation.tsx`: Phạm vi khảo sát & biến động ranh thửa GIS (`MERGE`, đất dư `{Mã}-XD`, `{Mã}-DU`).
     * `Step7_TechnicalCalculations.tsx`: Cổng kiểm tra dữ liệu (Completeness Gate: `ALLOW` / `CONDITIONAL`) & Ma trận rủi ro BRA ($V \times I$).
     * `Step8_ExecutiveDashboard.tsx`: Tổng hợp kết quả khảo sát.
     * `Step9_FieldSignatures.tsx`: Ký số hiện trường & nộp hồ sơ.
2. **Chung cư Tổng thể / Tòa Mẹ (`survey-condo-master`)**:
   * **Store**: `frontend/src/features/survey-condo-master/store/useCondoMasterSurveyStore.ts`
   * **Thư mục**: `frontend/src/features/survey-condo-master/`
3. **Căn hộ Con (`survey-condo-unit`)**:
   * **Store**: `frontend/src/features/survey-condo-unit/store/useCondoUnitSurveyStore.ts`
   * **Thư mục**: `frontend/src/features/survey-condo-unit/` (kế thừa móng, tầng hầm, tọa độ GIS, cự ly tim hầm, độ nghiêng từ tòa mẹ).

### 1.2. Bản Đồ GIS, Mặt Bằng CAD & Component Dùng Chung
* **Bản đồ quét hiện trường (Sweep Map)**: `frontend/src/components/gis/sweep-map/` (`components/ParcelDetailBottomSheet.tsx`, `components/SweepMapHeader.tsx`, `hooks/useSweepMapState.ts`).
* **Biên tập địa chính (Cadastral Editor)**: `frontend/src/components/gis/cadastral-editor/`.
* **Canvas & CAD Pinning (`frontend/src/components/canvas/`)**:
  * `DefectPinningCanvas.tsx`, `FloorCadPinningCanvas.tsx`, `FloorPlanCadPartitionCanvas.tsx`, `FacadePolygonCanvas.tsx`, `SignaturePad.tsx`.
* **Chụp ảnh & Chú thích**: `frontend/src/components/common/photo-capture/`, `frontend/src/components/common/ImageAnnotationModal.tsx`.
* **Điểm danh GPS**: `frontend/src/components/attendance/`.
* **Quản trị & Thẩm định**: `frontend/src/features/admin-portal/`, `frontend/src/features/zone-management/`, `frontend/src/features/progress-report/`.
* **Theme & Tiện ích**: `frontend/src/core/theme/useThemeStore.ts`, `frontend/src/utils/errorUtils.ts` (`getErrorMessage`).

---

## 2. Backend (`backend/src/`)

* **Entrypoint & Routes**: `backend/src/app.ts`, `backend/src/server.ts`.
* **Module Khảo sát (`backend/src/modules/survey/`)**:
  * `survey.controller.ts` · `survey.dto.ts` (Zod validation) · `survey.service.ts` · `survey.repository.ts` · `survey-package.mapper.ts`.
* **Module Thẩm định & Khóa Hồ sơ (`backend/src/modules/audit/`)**:
  * `audit.controller.ts` · `audit.dto.ts` · `audit.service.ts` · `services/audit-modification.service.ts` · `condo/` (duyệt & niêm phong chung cư).
* **Module Địa chính & GIS (`backend/src/modules/cadastral/`)**:
  * `cadastral.controller.ts` · `cadastral.dto.ts` · `cadastral.service.ts` · `cadastral.repository.ts`.
* **Module Điểm danh GPS (`backend/src/modules/attendance/`)**:
  * Tính khoảng cách PostGIS tới trọng tâm `ST_Centroid(ST_Union(geom))` của Zone.
* **Module Báo cáo PDF/DOCX (`backend/src/modules/report/`)**:
  * `report.controller.ts` · `report.types.ts` · `engine/` (Puppeteer & DOCX) · `mappers/` · `services/` · `snapshot/` · `templates/` (3 mẫu: `residential`, `condo-master`, `condo-unit`).
* **Module Chấm điểm & Tiến độ**: `backend/src/modules/scoring/`, `backend/src/modules/progress-report/`.

---

## 3. Cơ Sở Dữ Liệu (`database/` & `backend/src/database/`)

* **Schema gốc**: `database/init_schema.sql`.
* **Migrations**: `backend/src/database/migrations/` (hoặc `database/migrations/`).
* **Các bảng cốt lõi**: `parcels` (Tòa mẹ / Thửa đất), `building_units` (Căn hộ con), `surveys` (Hồ sơ khảo sát & `survey_data_json`), `survey_photos`, `defect_pins`, `cadastral_mutations`, `attendance_records`, `audit_logs` / `system_audit_logs`.

