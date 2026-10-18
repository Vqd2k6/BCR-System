# Báo cáo BCS Phase 1 – Hồ sơ bàn giao V3

> Phạm vi: nhà dân độc lập (NORMAL), xuất PDF. Không có DOCX, không xuất hàng loạt.

## 1. Quyết định nghiệp vụ đã chốt (tóm tắt)
- APPROVED = báo cáo **Final** (khóa + SHA-256). Chưa APPROVED = **DRAFT** (watermark "DRAFT – KHÔNG CÓ GIÁ TRỊ PHÁP LÝ").
- Rev chỉ tăng qua "Phát hành Rev mới" (Zone Admin đúng khu / Super Admin, lý do ≥ 10 ký tự, có audit log). Mỗi Rev có file riêng; xuất lại Rev cũ trả đúng file cũ.
- Điểm lấy từ snapshot `APPROVED_RELEASE` (ghi trong cùng transaction với APPROVE). Thiếu dữ liệu → in `--`, không điền mặc định.
- Báo cáo chỉ dùng dữ liệu đã duyệt; overrides từ client bị bỏ qua khi APPROVED.
- Chữ ký 2 cấp: Người lập (ngày khảo sát) – Kiểm tra/Duyệt (Zone Admin, ngày APPROVE).
- Không tự sinh kết luận; chỉ in nội dung đã nhập hoặc `--`.
- V3/V4 theo chuẩn FE `viCalculator.ts` (V3 theo CAT; V4 theo tuổi, cơi nới nặng → 4).

## 2. Kiến trúc
`backend/src/modules/report_v3/`: `report-snapshot.*` (Zod, hash), `render-queue.ts` (đồng thời mặc định 2, env `REPORT_RENDER_CONCURRENCY`), `report-v3.service.ts`, `report-release.service.ts` (file `backend/storage/report-releases/{reportId}/rev-NN.pdf`, advisory lock), `report-v3.controller.ts`. Template/engine vẫn dùng `report_v2`.

## 3. API
| Method | Path | Mô tả |
|---|---|---|
| GET | `/v3/reports/:id/export/pdf[?rev=]` | APPROVED → Final (tạo Rev 00 lần đầu); khác → DRAFT |
| GET/POST | `/v3/reports/:id/preview/html` | Xem trước (POST overrides chỉ có tác dụng với DRAFT) |
| GET | `/v3/reports/:id/releases` | Danh sách Rev + SHA-256 |
| POST | `/v3/reports/:id/releases` | `{reason}` – phát hành Rev mới |

Đã gỡ: `batch-export`, `/admin/reports/exports` (giả lập). Giữ: bảng `compiled_report_batches`, endpoint guest.

## 4. Dữ liệu
Migration `backend/database/migrations/20261019_risk_score_cards_nullable_vi_and_report_v3.sql` (idempotent): V3/V4/avg/class nullable, `base_survey_reports.deleted_at`, bảng `report_releases`. Đồng bộ `database/init_schema.sql`.

## 5. Lưu ý đã biết (chưa xử lý)
- Hash snapshot lấy lúc APPROVE; SHA-256 file tạo ở lần xuất Final đầu (Rev 00).
- HTML V2 nhúng ảnh base64 → 15–190 MB/hồ sơ; PDF vẫn render được nhưng nặng. Nên chuyển sang ảnh tham chiếu/nén.
- `ReportWatermarkCanvasService` log "Requesting main frame too early!" và fallback ảnh gốc (lỗi có sẵn của V2).
- `__reportReady` timeout 60s khi header/footer test – chỉ cảnh báo.
- Mã V1 (`modules/report`) chưa xóa – chờ nghiệm thu; guest preview vẫn dùng `/v2`.
- Điểm Survey ID in `--` trên dữ liệu local vì `users.phone` trống.

## 6. Nghiệm thu
Xem [06_ACCEPTANCE_CHECKLIST.md](06_ACCEPTANCE_CHECKLIST.md).

## 7. Backlog
- Giảm dung lượng HTML/ảnh; sửa watermark canvas.
- Gỡ V1 sau nghiệm thu; chuyển guest sang V3.
- Mẫu căn hộ con / chung cư tổng thể / DOCX / ma trận Excel: **Chưa triển khai**.
- UI liệt kê danh sách Rev + tải theo `?rev=`.
