# Task dang dở 5: Sửa phân hệ Chung cư (tầng, mã U/M, CAD Studio)

Cập nhật: 15/11/2026. Nhánh `dev`. GĐ A commit `4b13676`, GĐ B commit kế tiếp (chưa push). GĐ C: plan `~/.claude/plans/condo-gd-c-cad-e-floor-resources.md`, đã code C1–C6 (mục 6 plan là các mặc định cần người dùng xác nhận).

- Plan rà soát + quyết định: `~/.claude/plans/ph-n-h-chung-c-luminous-stardust.md` (plan gốc Antigravity `e36e865f`).
- Chia giai đoạn: **GĐ A (xong code)** → GĐ B (setup tầng) → GĐ C (CAD_E / Kho tài nguyên tầng, plan riêng). Report chung cư không làm đợt này (xem `TASK_DANG_DO_3.md`).

## Quyết định đã chốt
| # | Quyết định |
|---|---|
| Q1 | Chỉ Admin chuyển thửa sang Chung cư. `Step1CaseSelector.tsx` đã chỉ hiện nút cho Admin → không cần sửa. |
| Q2 | Tầng đặc biệt lặp lại đánh số `TECH`, `TECH2`...; 0.5 = `MEZZ`, 1.5 = `MEZZ2`; -0.5 = `SB`. Không dùng `M01` làm mã tầng. `floor_code` đã lưu không viết lại. |
| Q3 | Chia GĐ A → B → C. |
| Q4 | Không cần SELECT prod: DB local kéo từ prod về nên số liệu local là đủ (bên dưới). |
| Q5 | Căn đã khảo sát: ảnh CAD là bản độc lập của hồ sơ (như CAD nhà dân), chỉ nạp 1 lần lúc vào ca. `deleteFloorPlan` chỉ gỡ `floor_plan_id`, không xóa `unit_cad_url`/bbox/polygon. |
| Q6 | Bỏ mặc định giả ở store Tòa mẹ (8 căn/tầng, 32 căn, 5 tầng nổi, 1 hầm) → để trống; Bước 2 bắt nhập cả số tầng hầm (0 hợp lệ). |

## GĐ A — đã làm
- Migration `backend/database/migrations/20261118_condo_floor_numeric_integrity.sql`: `parcels.deleted_floors` INT[] → NUMERIC(4,1)[] (DO-block idempotent). Đã chạy thử 2 lần trong transaction ROLLBACK trên local. `database/init_schema.sql` đã cập nhật kiểu.
- Bảng quy tắc mã tầng dùng chung: `frontend/src/core/utils/floorCodeRules.ts` = `backend/src/modules/cadastral/utils/floor-code.rules.ts` (giống hệt từng byte; `npm run test:floor-codes` kiểm).
- `cadastral.repository.ts`: `::int` → `::numeric(4,1)`; `upsertFloorPlan` dùng `resolveFloorCode`; điều kiện khóa dùng chung `unitSurveyLockedSql` (status / phase1_report_id / EXISTS base_survey_reports) cho ON CONFLICT, soft-delete khi lưu phân vùng, xóa tầng, đếm căn đã khảo sát; `assertPartitionCodesNotClaimedElsewhere` → 409 khi mã đang ở tầng khác ngoài dải lưu, căn đã khảo sát ở tầng khác, hoặc trùng trong payload.
- `cadastral.dto.ts`: `FloorNumberSchema` chung (-5..100, bước 0.5), bỏ `.int()`.
- `condo-queue.service.ts` `getCondoProgressSummary`: lấy `floor_code`, `applicable_floors`; tầng kế thừa có CAD + `floorPlanId`; nhãn tầng qua `formatDefaultFloorLabel`; căn thiếu số tầng log lỗi thay vì ép Tầng 1.
- FE `codeFormattingUtils.ts`: `generateOptionBPartitionCode` (tiền tố đúng cho TECH/ROOF/MEZZ2/SB, STT U/M đếm riêng, tránh trùng mã toàn tòa, tính cả Master cũ `Tnn.xx`); `formatDefaultDisplayCode` tách STT sau dấu chấm (`02.03` → `203`); `formatShortUnitDisplay` không nhầm tầng TUM/TECH là Master.
- `FloorPlanCadPartitionCanvas.tsx`: ref danh sách ô mới nhất (vẽ nhanh liên tiếp không mất ô), truyền mã toàn tòa, so tầng bằng `Number()`, chặn đổi U↔M ô đã khảo sát. `CadPartitionListSidebar.tsx`: ẩn nút đổi loại khi đã khảo sát.
- `FloorPlanCadManagementModal.tsx`: `fetchAllFloorData(preserveFloor)` — lưu/xóa CAD giữ tầng đang thao tác; chuyển tầng reset CAD/dải tầng/ô, giữ `displayCode`; thêm tầng nhận 0.5/-0.5, chặn trùng số tầng/mã tầng, reset dải tầng điển hình; gợi ý số phòng dòng 587/694.
- `FloorPlanCadSidebar.tsx`: preset SB = -0.5.
- `useBuildingHubState.ts`, `Step2_UnitSpecificInformation.tsx`: Trệt (0) không còn bị ép thành 1.
- `Step1_ParentInheritanceConfirmation`, `Step3_UnitDefectsAndSettlement`, `Step4_UnitSignatures`, `useMasterAreaSurveyState`: mã tầng watermark qua `resolveSurveyFloorCode` (chỉ đổi tầng lẻ: `F0.5`→`MEZZ`, `B0.5`→`SB`; tầng nguyên giữ mã cũ để không lệch mã ảnh đã chụp).
- `Step2_CondoMasterScaleAndCat.tsx`: xóa ô số tầng/số căn thì tổng về trống.

Kiểm chứng: FE/BE build đạt; `check:zero-any`, `check:ui`, `check:catch`, `check:theme`, `test:floor-codes`, `test:condo-adapters`, `test:condo-absence-parity` đạt. **Chưa chạy migration thật, chưa test API end-to-end, chưa thử trên trình duyệt.**

## Dữ liệu local (đọc 15/11)
- 152 vị trí / 2 tòa: 140 mã `U-xxx`/`M-xxx` (đều đã khảo sát), 10 `nn.nn` (2 trong đó là MASTER), 2 `nn.Mnn`. Không có `Tnn.xx`.
- Dữ liệu tầng lệch: `floor_code` F06 ở cả tầng 6 và 7, MEZZ ở tầng 2, "Sân thượng" TERRACE ở tầng 1; dải `applicable_floors` chồng lên tầng có bản vẽ riêng (Tầng 1 → {1,3,4}). Đây là lỗi #15 (GĐ B), không sửa dữ liệu.

- Q5: `cadastral.repository.ts` `deleteFloorPlan` bước 2 chỉ gỡ `floor_plan_id`. Phiếu căn hộ đã giữ bản riêng `survey_data_json.unitCadUrl` (ảnh base64 tải R2 thành file riêng); thẩm định `resolveUnitCadUrl` lấy `building_units.unit_cad_url` khi JSON cũ thiếu → nay không còn bị xóa.
- Q6: `useCondoMasterSurveyStore.ts` mặc định để trống, tự tính tổng chỉ khi cả hai số > 0; `validateCondoMasterStep` (stepValidator.ts) chặn thiếu số tầng hầm.

## GĐ B — đã làm
- #8: copy tầng và dải tầng điển hình sinh mã qua `generateMirroredPartitionCode` (giữ STT ô gốc nếu còn trống, không còn `T06.01`); ô đã có trên tầng đích giữ nguyên mã.
- #15 BE (`atomicSyncFloorPlanAndPartitions`): 409 nếu dải gộp tầng đã có mặt bằng riêng; tầng gộp vào dải mới được gỡ khỏi dải của bản vẽ khác (hết chồng dải); tầng bị gỡ khỏi dải → xóa mềm ô CHƯA khảo sát thuộc bản vẽ này, căn đã khảo sát chỉ gỡ `floor_plan_id`; audit log ghi `detachedFloors`, `releasedFromOtherPlans`, `prunedUnitCodes`.
- #15 FE: tầng kế thừa phải chọn "Mở Tầng X để sửa chung" hoặc "Tách riêng mặt bằng cho tầng này" mới lưu được; khi lưu tự bỏ tầng có mặt bằng riêng khỏi dải và hỏi xác nhận khi thu hẹp dải (đếm ô sẽ xóa mềm / căn giữ lại).
- #16: `TypicalFloorsSelectorModal` khóa tầng có mặt bằng riêng, nhãn tầng đang theo bản vẽ khác, ô "Dải tầng Từ → Đến" thêm cả tầng chưa tạo.
- Quick Floor Setup: `QuickFloorSetupModal.tsx` + `buildQuickFloorStructure` (floorUtils, có test). Tầng dự kiến lưu nháp `localStorage['metro2_quick_floor_draft_{parcelId}']`, chỉ thành bản ghi khi nạp CAD. Tự mở khi CAD Studio của tòa chưa có tầng; nút "Nhanh" ở sidebar; Hub có banner CTA (KSV thấy hướng dẫn liên hệ Zone Admin). Cả lưới thửa (mở thẳng CAD Studio) và bottom sheet (mở Hub) đều dẫn tới đây (#12).
- #17: `SurveyorCadReadOnlyModal` dùng `deriveBuildingFloorNumbers`, không sinh tầng ảo; empty state chỉ dẫn liên hệ Zone Admin.

## GĐ C — đã làm (CAD_E + Kho tài nguyên tầng)
- C1: migration `20261119_condo_floor_cad_structural.sql` (`cad_structural_url`, `cad_resources_json`, `unit_structural_cad_url`, `cad_structural_bbox`); DTO `FloorCadResourceDto`; `upsertFloorPlan` gộp kho qua `floor-cad-resources.ts` (chỉ xóa mềm, CAD_E cũ bị thay vào kho dạng đã xóa, tối đa 20 tờ dùng); `saveUnitPartitions` ghi E từng ô với nhánh khóa căn đã khảo sát.
- C2–C3: CAD Studio có tab `[CAD_Z | CAD_E | Kho tài nguyên]` (`FloorStructuralCadPanel`, `FloorCadResourcePanel`): tải/đổi/gỡ CAD_E, áp nhanh khung Z → E (chặn lệch tỷ lệ > 2%), chỉnh khung E từng ô, kho thêm/đổi nhãn/đặt làm CAD_E chính/xóa mềm + xem tờ đã xóa; huy hiệu Z/E trên từng ô.
- C4: `CadAreaCropModal` nhận `sources` (tờ E / kho / Z, khung gắn đúng tờ); phiếu U `Step3` áp 3A (`resolveStructuralCadAutoLoad` trong `core/utils/cadSources.ts`): nạp E 1 lần khi Admin đã cắt/đặt khung E, chỉ có E chung thì banner + mở sẵn tờ E, không cắt bằng khung Z.
- C5: khu vực M parity: hook có nguồn E + tự nạp 3A; Step2 mục 2.3 CAD_E; Step4 banner gợi ý; không chép Z sang E khi tầng có CAD_E.
- C6: thẩm định đã đọc E từ JSON phiếu (không đổi); `SurveyorCadReadOnlyModal` xem Z / E / Kho (chỉ đọc).
- Test: `npm run test:floor-codes` (cadSources 3A), `cd backend && npm run test:condo-floors` (12 ca ROLLBACK).

## Việc còn lại
1. `useCondoMasterSurveyStore.ts` còn mặc định `foundationType`/`structureSystem` = phần tử đầu danh sách (ảnh hưởng ECS/VI) — chưa hỏi người dùng.
2. GĐ C: người dùng xác nhận 5 mặc định ở mục 6 plan GĐ C.
3. Dữ liệu local còn dải chồng (Tầng 1 → {1,3,4} trong khi 3, 4 có mặt bằng riêng): tự gỡ khi Admin lưu lại Tầng 1; không sửa dữ liệu bằng script.
4. Migration 20261118 + 20261119 ĐÃ chạy trên DB local (15/11, `npm run db:migrate`, dữ liệu cũ giữ nguyên); CHƯA chạy trên prod. Chưa thử trên trình duyệt (lệnh đăng nhập tài khoản dev bị chặn quyền — cần người dùng tự thử hoặc cho phép). Logic repository đã kiểm bằng `cd backend && npm run test:condo-floors` (10 ca, chạy trong transaction ROLLBACK).
