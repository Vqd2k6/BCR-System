# Checklist nghiệm thu – Báo cáo BCS V3

Script: `cd backend && NODE_OPTIONS=--max-old-space-size=6144 npx ts-node src/scripts/test_report_v3_business_cases.ts`
(Test ghi vào DB local: duyệt 6 hồ sơ + tạo Rev. Để chạy lại sạch: `DELETE FROM report_releases;` và xóa `backend/storage/report-releases/`.)

## Kết quả lần chạy cuối: 50/50 PASS (21 ca thuần + 29 ca tích hợp)

| Nhóm | Ca | Kiểm chứng |
|---|---|---|
| Điểm V1–V4/VI | A01–A07 | V3 theo CAT, V4 theo tuổi/cơi nới, thiếu dữ liệu → null, phân hạng VI |
| Snapshot | A08–A12 | Hash ổn định, resolveScores, Zod, apply snapshot |
| Hạ tầng | A13–A15, A21 | Escape HTML header/footer, RenderQueue (song song 2, timeout), gỡ batch-export |
| Quyền/Rev | A16–A17 | Zone Admin đúng khu/Super Admin; lý do ≥ 10 ký tự |
| Mapper | A18–A20 | Survey ID, 2 ô ký, không tự sinh kết luận |
| 6 hồ sơ thật | B1–B3 | DRAFT HTML: không auto-text, không "26 + A", không nhãn kiểm soát, không NaN |
| APPROVE | B4–B6 | Snapshot trong transaction; duyệt lần 2 → 409; điểm snapshot = resolve nguồn |
| Final/Rev | B7–B13 | Rev 00 + SHA, xuất lại cùng file, lock song song, Rev 01/02 + audit, phát hiện sửa file |
| Biên | B14–B19 | Chưa APPROVED → 409, Final không watermark, soft-delete, header an toàn, DRAFT PDF, bỏ overrides |

## Chưa được kiểm chứng
- Nhà vắng chủ / đất trống: không có dữ liệu DB → chỉ test đơn vị tổng hợp (A07).
- Kiểm tra bằng mắt PDF trên Preview/in thật chưa thực hiện.
- Dữ liệu 6 hồ sơ được duyệt thử **trên DB local** (D16); không chạm production.
- UI "Phát hành Rev mới": mới kiểm bằng build/lint, chưa thao tác thủ công trên trình duyệt.
