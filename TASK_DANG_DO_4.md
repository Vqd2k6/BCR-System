# Task dang dở 4: Bản đồ GIS chuyên đề (8 layout data visualization)

Cập nhật: 14/11/2026. Nhánh `dev`.

## Trạng thái hiện tại

- **Đã code xong** backend + frontend cho 8 layout: Hiện trạng khảo sát (có sẵn), Năm xây dựng, Móng & Kết cấu, Tình trạng kết cấu (ECS), Burland, Chỉ số dễ tổn thương (VI), BRA, Số tầng.
- Plan đã duyệt: `~/.claude/plans/hi-n-t-i-d-n-reactive-wave.md` (bản hiệu chỉnh từ plan Gemini). Plan là nguồn chi tiết; file này ghi tiến độ, quyết định và lỗi phát hiện.
- **Đã kiểm tra tự động** (xem mục 3). **CHƯA test trên trình duyệt.**
- Đã commit và push lên `dev` (14/11/2026) để chuyển sang sửa lỗi gấp khác.

---

## 1. Quyết định đã chốt

| # | Quyết định |
|---|---|
| Q1 | Nguồn hồ sơ (Admin và Guest như nhau): chỉ PHASE_1 cấp thửa (`unit_id IS NULL`, không lấy `CONDO_UNIT`/`UNIT_CHILD`), ưu tiên APPROVED > UNDER_REVIEW > SUBMITTED. Thửa chỉ có DRAFT/REJECTED là "Chưa có số liệu". Hồ sơ chưa APPROVED vẽ viền nét đứt. |
| Q2 | Guest thấy cùng dữ liệu với Admin; endpoint không trả PII (không chủ hộ, SĐT, ảnh, hình học). |
| Q3 | Zone = ALL: tắt các layout chuyên đề (chỉ còn Hiện trạng khảo sát); backend trả 400. |
| Q4 | BRA/ECS/VI/Burland khớp đúng PDF Mục VIII: dùng chung hàm resolver với mapper PDF. |
| Q5 | BRA trên bản đồ = ma trận V×I Bước 7 cho mọi thửa, kể cả thửa phát hành bằng template v2 (A–E). |
| Q6 | Surveyor không có layout chuyên đề, không gọi API. CONTRACTOR ngoài phạm vi (không có bản đồ). |
| Q7 | Cấm đọc các cột SQL có DEFAULT giả: `building_specifications.foundation_category` (CAT_2), `.structural_system` (KHUNG_BTCT), `.floor_count` (1), `.basement_count` (0); `parcels.floor_count` (1); `risk_score_cards.building_risk_assessment_bra` (LOW_RISK). Số tầng / hầm / hệ kết cấu chỉ lấy từ JSON khảo sát. |
| Q8 | Năm XD thiếu ⇒ "Chưa có số liệu" (không dùng mặc định 1999). Nhóm tuổi theo `v4FromAge`: <10 / 10–25 / 26–40 / >40, năm hiện tại tính theo giờ VN (UTC+7). |
| Q9 | Burland chỉ lấy `burlandSummary.localMaxGrade` (0–5) như PDF; không dùng `e1_burland_score`, `overridden_burland_grade`, `damage_zones`. |

---

## 2. Việc đã làm

### Backend
- `report/mappers/sections/risk-resolvers.ts` (mới): tách nguyên văn logic ECS / VI / Impact / BRA / Burland từ mapper Mục VIII thành hàm thuần. `section-8-risk-assessment.mapper.ts` gọi lại các hàm này.
- Module mới `modules/gis-visualization/` (types, rules, repository, service, controller, routes, index). Mount 1 dòng ở `app.ts`.
  - `GET /api/v1/gis-visualization/thematic?zoneId=` — SUPER_ADMIN, ZONE_ADMIN, GUEST; `resolveZoneMapScope` thu hẹp Zone cho Zone Admin / Guest.
  - 1 query `LEFT JOIN LATERAL`, 100% tham số hóa, không SELECT geometry, `lifecycle_status='ACTIVE'`, alias Zone qua `CadastralRepository.getZoneAliases`.
- `src/scripts/test_gis_visualization_rules.ts`: 16 test `node:assert`. Chạy: `cd backend && npx ts-node --transpile-only src/scripts/test_gis_visualization_rules.ts`.

### Frontend
- Module mới `features/gis-visualization/`: types, api, registry (8 layout + thang màu + sub-mode), binding, overlay, hook `useThematicMap`.
  - Móng & Kết cấu có 3 sub-mode (loại móng / hệ kết cấu / CAT); Số tầng có 2 (tầng nổi / tầng hầm).
  - Chú giải có số thửa, %, bấm để lọc nhóm; tooltip khi rê chuột (chỉ ở chế độ chuyên đề).
  - Cache theo Zone 2 phút; layout lưu `sessionStorage['metro2_gis_thematic_layout']`; lỗi API ⇒ log `[GisVisualization:fetch]`, banner, quay về Hiện trạng khảo sát.
- Bản đồ dùng chung: `shared/types.ts` (thay `thematicMode` bằng `thematic` + `thematicOverlay`), `ParcelsLayer.tsx` (WORKFLOW giữ nguyên từng giá trị màu), `LeafletSweepMap.tsx`, `SweepMapFilterModal.tsx` (chú giải động; WORKFLOW bổ sung dòng REJECTED và viền tím chung cư).
- Tích hợp: `App.tsx` (chỉ khi `role === 'SUPER_ADMIN'`), `ZoneManagerDashboardPage.tsx` (nạp theo Zone App đã tải `parcels`), `GuestDashboardPage.tsx`.
- Guest: xóa `GuestMapThematicToggle.tsx`; `getParcelBraRiskLevel` bỏ đoán theo khoảng cách (trước đây mọi thửa đã KS đều thành "Trung bình"), giờ dùng cấp BRA thật từ API, thiếu thì `UNASSESSED`.

### Lệch so với plan
- Burland không dùng fallback `overridden_burland_grade` / `damage_zones` (PDF không đọc).
- Đếm nhóm làm ở frontend (khớp đúng các thửa đang hiển thị) thay vì `summaries` server.
- 8 file thang màu gộp vào 1 file registry.
- Số tầng / kết cấu chỉ từ JSON (thêm 3 cột DEFAULT giả vào danh sách cấm).
- Chú giải gộp vào overlay bản đồ thay vì thanh thống kê riêng.

---

## 3. Kết quả kiểm tra

| Kiểm tra | Kết quả |
|---|---|
| Mapper Mục VIII trước/sau khi tách resolver | Giống hệt trên 664/664 hồ sơ PHASE_1 |
| Bản đồ ↔ PDF Mục VIII (BRA/ECS/VI) | Khớp 418/418 thửa có hồ sơ (3.198 thửa, 9 Zone); query toàn tuyến 719 ms |
| Test rules | 16/16 pass |
| Phân quyền API | SA 200; SA + ALL 400; ZA 200 (ALL ⇒ Zone được gán); Guest 200; Surveyor 403; không token 401 |
| PII trong payload | Không có |
| 4 chốt FE (zero-any, ui, catch, theme) + build FE/BE | Pass |

---

## 4. Chưa làm

1. **Test trình duyệt** với Zone Admin, Super Admin, Guest, Surveyor (Surveyor phải không thấy bộ chọn, không có request `/gis-visualization`); Light/Dark; mobile (thanh layout cuộn ngang, chú giải gập).
2. Kiểm tra ở Hiện trạng khảo sát không phát request `/gis-visualization` (trừ Guest, Guest nạp sẵn để có BRA thật).
3. Đối chiếu tay 3–5 thửa mẫu mỗi layout với PDF đã xuất.
4. Cân nhắc giảm payload (~150 KB / 302 thửa) nếu Zone lớn chậm.

---

## 5. Lỗi phát hiện trong quá trình làm (có sẵn, CHƯA sửa)

1. **Lệch Zone của Zone Admin được gán ALL:** đổi Zone trên màn ZoneManager thì `selectedZone` cục bộ đổi nhưng App vẫn giữ `parcels` của Zone cũ (`App.tsx` `selectedZone` vs `ZoneManagerDashboardPage.tsx` state riêng). Bản đồ chuyên đề đã nối theo `parcelsZoneId` nên không lệch, nhưng lỗi gốc vẫn còn.
2. **PDF Mục II lấy số tầng từ cột SQL DEFAULT giả** (`floor_count=1`) khi JSON thiếu. 26 hồ sơ có số tầng SQL khác JSON.
3. **Trộn thang Burland với E1:** `audit/services/audit-review.service.ts:273` và `audit/condo/services/condo-queue.service.ts:422` COALESCE `localMaxGrade` (0–5) với `e1_burland_score` (thang điểm E1, grade 0 và 1 đều = 0).
4. **`overridden_avg_vi` > 4 ở ~6 hồ sơ cũ** (lưu nhầm tổng điểm thay vì trung bình): mỗi lần mở bản đồ ghi log cảnh báo `[RiskResolvers:viAvg]`.
5. **Dữ liệu `foundationType` cũ** có chuỗi `CAT_n` thay vì chuỗi móng chuẩn — đã phân loại được trong `classifyFoundation`, nhưng nên chuẩn hóa dữ liệu.

---

## Lưu ý khi quay lại
- Đọc file này + plan. Mọi chỉ số mới trên bản đồ phải đi qua `risk-resolvers.ts` hoặc `gis-visualization.rules.ts`, không tự đọc cột SQL.
- Nếu sửa logic Mục VIII của PDF thì sửa trong `risk-resolvers.ts` để bản đồ đổi theo.

---

## 6. Đợt cải tiến 17/11/2026: thang màu, bộ lọc chỉ định, chỉ số khi click

Plan: `~/.claude/plans/t-i-mu-n-b-sung-effervescent-music.md` (hiệu chỉnh từ plan Gemini). Chỉ sửa frontend, chưa commit.

### Quyết định
| # | Quyết định |
|---|---|
| Q10 | 4 hệ màu: sequential (Năm XD, Số tầng, CAT), risk_heatmap (ECS/Burland/VI/BRA: mức thấp xanh bạc hà nhạt opacity 0,35–0,42, cao dần vàng→cam→đỏ→đỏ thẫm opacity tới 0,9), qualitative Okabe-Ito (Móng, Kết cấu), binary (Tầng hầm). "Không rõ" móng/kết cấu giữ xám ấm #78716c để khác xám "Chưa đánh giá". |
| Q11 | Viền tách khỏi nền: #334155 (thửa thường), #7c3aed (chung cư), #94a3b8 (chưa đánh giá / bị lọc ra). |
| Q12 | Bộ lọc chỉ định độc lập layout, giữ khi đổi layout và đổi Zone (`sessionStorage['metro2_gis_precision_filter']`). Tiêu chí bật mà thửa thiếu giá trị ⇒ không khớp. AND giữa tiêu chí, OR trong tập chọn. Có hiệu lực cả ở WORKFLOW. |
| Q13 | Làm mờ nền (DIM, mặc định) / Chỉ hiện thửa khớp (ISOLATE). ISOLATE: "Chọn tất cả" hàng loạt chỉ lấy thửa đang hiện; thửa đang chọn luôn được vẽ. |
| Q14 | Prefetch số liệu ở Zone Admin, Super Admin (App.tsx), Guest khi Zone cụ thể. Click thửa: lưới 7 chỉ số chuyên đề + trạng thái hồ sơ (bảng chi tiết Admin, thẻ Guest thay ô BRA đơn). Khảo sát viên không có. |
| Q15 | Màu biểu đồ BRA Guest (`getBraColor`) lấy từ `BRA_SCALE`. |

### Đã làm
- `registry/thematicLayouts.registry.ts`: `scaleType`, `group`, `fillOpacity`, bảng màu mới, export các thang; bộ chọn chia 3 nhóm.
- `registry/thematicFilter.ts` (mới) + `frontend/scripts/thematic-filter.test.ts` (`npm run test:thematic-filter`).
- `registry/thematicBinding.ts`: viền riêng, opacity theo nhóm, nhận `matchedIds`, đếm `{ total, matched }`.
- `components/ThematicPrecisionFilterPanel.tsx`, `components/ParcelThematicMetricsGrid.tsx` (mới); `ThematicMapOverlay.tsx` viết lại (bộ chọn nhóm thu gọn, nút lọc + chip + số khớp + DIM/ISOLATE, gradient + thanh phân bố ở chú giải).
- `hooks/useThematicMap.tsx`: trả thêm `layoutId`, `filterMatch`, `renderParcelInsights`.
- Bản đồ dùng chung: `shared/types.ts` (`ThematicFilterMatch`, `thematicFilterMatch`, `renderParcelInsights`), `LeafletSweepMap.tsx` (`visibleParcels`), `ParcelsLayer.tsx` (mờ ở WORKFLOW), `ParcelDetailBottomSheet.tsx` (slot `insights`, giới hạn cao 75vh).
- Lệch plan: thay prop `thematicMetricsById` bằng render-prop `renderParcelInsights` để `components/gis` không phụ thuộc kiểu của feature.

### Kiểm tra
- build, zero-any, theme, ui, catch: pass. Test lọc: pass.
- Giả lập Deuteranopia: các cặp màu rủi ro ΔE ≥ 20, riêng Burland Cấp 0/Cấp 1 ΔE 11 (cùng xanh nhạt, khác độ đậm).
- **CHƯA test trình duyệt** (mục 4 vẫn còn nguyên + kịch bản lọc ở plan).
