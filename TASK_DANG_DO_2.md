# Task dang dở 2: Phân quyền theo chức năng và nhiều Zone cho từng tài khoản

Cập nhật: 04/11/2026. Nhánh `dev`.

## Trạng thái hiện tại

- Plan đã lập và đã vấn đáp (grill-me), **chưa code dòng nào**, chưa có migration.
- Khi thực thi: làm tuần tự theo mục "6. Lộ trình triển khai", bắt đầu từ GĐ 0. Mỗi GĐ một commit trên `dev`.
- Bản gốc của plan: `~/.claude/plans/open-hi-n-t-i-c-c-sleepy-dewdrop.md`.

---


## Context

Hiện tại quyền gắn chết theo vai trò:
- Backend có 136 lời gọi `requireRoles(...)` (chủ yếu trong `backend/src/app.ts:84-312`) và khoảng 40 chỗ kiểm tra `role === ...` viết thẳng trong service/controller.
- Frontend có 71 phép so sánh `role ===` trên 30 file và 138 cờ suy ra (`isAdmin`, `canApproveOrReject`...).
- Mỗi tài khoản chỉ có 1 Zone: `users.assigned_zone_id VARCHAR(32)`. Mỗi Zone chỉ có 1 admin: `metro_zones.assigned_admin_id`.

Vì vậy:
- KSV làm 2 Zone (02 và 07) không khai được. Khi KSV chuyển chỗ, Super Admin phải tự sửa.
- Không chia việc được giữa các Zone Admin, ví dụ A chỉ thẩm định, B chỉ sửa lô đất, D chỉ duyệt công.
- Khi khảo sát còn thấy lỗ hổng phạm vi Zone:
  - Approve/Reject/sửa hồ sơ không kiểm tra Zone của hồ sơ.
  - Danh sách thẩm định nhận `?zoneId` tùy ý (`audit.controller.ts:27,41,71,390,403`).
  - `assignSurveyor` không kiểm tra Zone.
  - `isZoneMatchOrAllPrivilege` (`cadastral.service.ts:506`) trả `true` khi Zone Admin **chưa được gán Zone**.

Mục tiêu:
- Mỗi tài khoản có một **danh sách Zone** và một **tập chức năng**. Super Admin tick chọn trong trần của vai trò.
- Super Admin gán hoặc gỡ nhiều Zone cho KSV ngay trên một màn hình, không phải tạo lại tài khoản.
- Mọi thay đổi quyền được ghi audit để làm căn cứ pháp lý.

### Quyết định đã chốt với người dùng
1. **Vai trò là trần.** Mỗi vai trò có tập chức năng tối đa và các preset. Chỉ tick được tập con, không cấp chức năng vượt vai trò (KSV không bao giờ có quyền duyệt).
2. **Một danh sách Zone cho cả tài khoản.** Mọi chức năng của tài khoản áp dụng trên toàn bộ các Zone đó.
3. **Chỉ Super Admin gán hoặc gỡ Zone cho KSV.** Zone Admin không can thiệp. (Đảo lại lựa chọn ban đầu "Zone Admin có quyền phân công", người dùng xác nhận ở Câu 7b của phiên vấn đáp.)

---

## 1. Hợp đồng (Workflow 0)

- **Preconditions**
  - Chỉ Super Admin sửa chức năng và Zone của mọi tài khoản, kể cả Zone của KSV.
  - Tạo, khóa và đặt lại mật khẩu tài khoản vẫn chỉ do Super Admin, như hiện nay (`app.ts:257-263`).
  - Zone được gán phải tồn tại trong `metro_zones` với `is_active = true`.
- **Invariants**
  - Super Admin luôn có toàn quyền trên toàn tuyến và không bị giới hạn.
  - Chức năng có hiệu lực = các grant đang còn ∩ trần của vai trò.
  - Không có grant nào thì không có quyền (fail-closed).
  - Gán và gỡ đều là xóa mềm (`revoked_at`), không `DELETE`.
  - Ghi cấu hình quyền và `system_audit_logs` trong cùng một transaction.
  - 100% SQL tham số hóa. Zero-any.
- **Postconditions**
  - Thay đổi có hiệu lực ngay ở request kế tiếp, vì `authenticateJwt` đã đọc DB mỗi request.
  - Frontend nhận 403 có mã `CAPABILITY_DENIED` thì gọi `refreshProfile()`.
  - Error path: rollback, log `[Rbac:...]`, form giữ nguyên dữ liệu đã nhập.
- **Không phá hành vi cũ khi deploy**
  - Backfill cấp preset "Đầy đủ" của vai trò và Zone hiện tại cho mọi tài khoản.
  - Riêng chặn Zone với KSV chạy chế độ shadow (chỉ log) trước khi bật thật.

---

## 2. Danh mục chức năng (capability catalog)

Danh mục nằm ở một nơi duy nhất: `backend/src/common/rbac/capabilities.ts`, gồm `CAPABILITIES` (const), `ROLE_CEILING`, `ROLE_PRESETS` và type `Capability`.

| Key | Ý nghĩa | Trần | Route / UI hiện tại |
|---|---|---|---|
| `survey.perform` | Nhập form, ảnh, ghim CAD, nháp, nộp hồ sơ | SURVEYOR, ZONE_ADMIN | `app.ts:152-182` (S+Z+SA) |
| `survey.revert_own` | Rút hồ sơ của mình về nháp | SURVEYOR | `app.ts:213-214` (nhánh KSV) |
| `attendance.checkin` | Điểm danh GPS và check-out | SURVEYOR, ZONE_ADMIN | `app.ts:114-117` |
| `audit.view` | Xem hàng đợi và hồ sơ thẩm định (chỉ đọc) | ZONE_ADMIN | GET trong `app.ts:201-232` |
| `audit.decide` | Approve, Reject, duyệt lô, duyệt vắng chủ, ký khóa | ZONE_ADMIN | approve/reject/batch-approve/approve-absentee |
| `audit.modify` | Sửa hồ sơ khi thẩm định, thay ảnh, rollback version, CRUD chung cư | ZONE_ADMIN | audit-edit, `audit-modification.service`, `condo-crud-engine` |
| `audit.revert` | Trả hồ sơ người khác về nháp hoặc đang làm | ZONE_ADMIN | `app.ts:213-214` (nhánh admin) |
| `parcel.edit` | Tách/gộp, dời/sửa hình GIS, chuyển chung cư, loại trừ, căn, bản vẽ tầng, phân khu, lifecycle, loại công trình | ZONE_ADMIN | `app.ts:124-148, 233-238`, `ParcelDetailBottomSheet.tsx:552-798` |
| `parcel.assign_surveyor` | Giao lô cho KSV | ZONE_ADMIN | `app.ts:146` |
| `attendance.review` | Xem, xác nhận, xác nhận hàng loạt công | ZONE_ADMIN | `app.ts:189-198` |
| `attendance.period_lock` | Khóa kỳ công tháng (SHA-256) | ZONE_ADMIN | `app.ts:189-198` |
| `report.export` | Xuất PDF, biên bản hàng loạt, Phase 1 export, xem báo cáo tiến độ | ZONE_ADMIN | `app.ts:283-301`, `progress-report.routes.ts` |
| `report.release` | Phát hành bản báo cáo | ZONE_ADMIN | `report-release.service` |
| `cad_lab.use` | Image Lab, CAD Studio | ZONE_ADMIN | `app.ts:94-98` |

**Route chỉ cho SUPER_ADMIN giữ nguyên `requireRoles('SUPER_ADMIN')`:** 22 route gồm unlock approved, unlock kỳ công, lịch sử biến động, quản lý Zone, quản lý user, cấu hình báo cáo và tiến độ. Không đưa các quyền này vào catalog cấp được, để giảm phạm vi sửa.

**Quyền nền luôn có với Zone Admin** (người dùng chốt, Câu 2): xem dashboard thống kê và bản đồ chỉ đọc của các Zone mình phụ trách, gồm cả bottom sheet thông tin lô. Không cần grant.
- Mở **hồ sơ khảo sát chi tiết** (Phase 1, Condo master/unit, PDF preview, Audit Studio) và **hàng đợi thẩm định** đều cần `audit.view`. Các route GET hiện chỉ có `authenticateJwt` như `/reports/phase1/:id` và `/reports/:id` phải thêm kiểm tra: ZONE_ADMIN thiếu `audit.view` thì 403. KSV vẫn mở được hồ sơ của mình.
- Ví dụ: D (chỉ chấm công) thấy bản đồ để đối chiếu vị trí điểm danh nhưng không mở được hồ sơ. B (chỉ lô đất) sửa lô trên bản đồ nhưng không vào được hàng đợi thẩm định.

**Preset**
- `ZA_FULL`: tất cả mục ZONE_ADMIN. Đây là tài khoản C và là mặc định khi backfill.
- `ZA_AUDIT`: `audit.view`, `audit.decide`, `audit.modify`, `audit.revert`, `report.export`. Đây là tài khoản A.
- `ZA_PARCEL`: `parcel.edit`, `parcel.assign_surveyor`. Đây là tài khoản B.
- `ZA_ATTENDANCE`: `attendance.review`, `attendance.period_lock`. Đây là tài khoản D.
- `SV_FULL`: `survey.perform`, `survey.revert_own`, `attendance.checkin`.

Preset chỉ là bộ tick nhanh trên UI. DB lưu từng chức năng riêng lẻ.

---

## 3. CSDL — migration `backend/database/migrations/20261105_user_access_scopes.sql`

Ghi cả vào `database/init_schema.sql`. Chép file sang `database/migrations/` để hai thư mục không lệch thêm (xem ghi chú runner ở mục 8).

```sql
CREATE TABLE IF NOT EXISTS user_zone_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  zone_code VARCHAR(32) NOT NULL,          -- mã chuẩn hóa UPPER; 'ALL' = toàn tuyến (chỉ ZONE_ADMIN/GUEST)
  is_primary BOOLEAN NOT NULL DEFAULT false,-- Zone mặc định khi điểm danh/mở bản đồ
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ, revoked_by UUID REFERENCES users(id), revoke_reason TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_zone_active ON user_zone_assignments(user_id, zone_code) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_zone_primary ON user_zone_assignments(user_id) WHERE revoked_at IS NULL AND is_primary;
CREATE INDEX IF NOT EXISTS idx_user_zone_zone ON user_zone_assignments(zone_code) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS user_capability_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  capability_key VARCHAR(64) NOT NULL,
  granted_by UUID REFERENCES users(id), granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ, revoked_by UUID REFERENCES users(id), revoke_reason TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_cap_active ON user_capability_grants(user_id, capability_key) WHERE revoked_at IS NULL;

ALTER TABLE timekeeping_checkins ADD COLUMN IF NOT EXISTS assigned_zones_at_checkin TEXT[];
```

**Backfill trong cùng file, idempotent bằng `ON CONFLICT DO NOTHING` / `WHERE NOT EXISTS`**
- Mỗi user có `assigned_zone_id` thì tạo 1 dòng Zone với `is_primary = true`.
- Mỗi user thuộc SURVEYOR hoặc ZONE_ADMIN thì tạo các grant theo preset FULL của vai trò. `assigned_by` / `granted_by` để NULL, gắn nhãn hệ thống `SYSTEM_BACKFILL` trong `system_audit_logs`.
- Danh sách key preset được ghi literal trong SQL. Test sẽ đối chiếu với `ROLE_PRESETS` (xem mục 7).

**Hai cột cũ được giữ**
- `users.assigned_zone_id` thành "Zone chính". Ghi song song (dual-write) mỗi khi `is_primary` đổi, để các chỗ chưa chuyển như report, snapshot hay guest vẫn chạy.
- `metro_zones.assigned_admin_id` chỉ còn để hiển thị "admin chính", không dùng để phân quyền nữa. Một Zone giờ có nhiều admin, ví dụ A, B và D cùng Zone 02.

---

## 4. Backend

### 4.1 Lõi RBAC (`backend/src/common/rbac/`)
- `capabilities.ts`: catalog, trần, preset, và `effectiveCapabilities(role, grants)`.
- `zone-scope.ts`:
  - `type ZoneScope = { all: boolean; zones: string[] }`.
  - `canAccessZone(user, zoneCode)` mở rộng alias qua `CadastralRepository.getZoneAliases` (`cadastral/cadastral.repository.ts:246-307`).
  - `assertZoneAccess(user, zoneCode)` ném 403.
  - `resolveRequestedZones(user, requested)` trả danh sách Zone được phép để lọc SQL: `= ANY($n)`, có mở alias.
  - `assertRecordInScope(user, { surveyId | parcelId | unitId })` đọc `parcels.zone_id` rồi kiểm tra.
- Gộp ba bản alias đang lệch nhau về một nguồn là `getZoneAliases`. Hai bản phải bỏ là `cadastral.service.ts:514-538` (thêm mã ST0x vào map gốc) và `cadastral-geometry.service.ts:~310`.

### 4.2 Guard (`backend/src/common/guards/auth.guard.ts`)
- Thêm vào `JwtPayload`: `capabilities: Capability[]`, `zoneScope: ZoneScope`, `primaryZoneId`. Giữ `assignedZoneId` (bằng Zone chính) cho các chỗ chưa chuyển.
- Mở rộng câu SELECT ở dòng 50 và 115: 1 query `LEFT JOIN LATERAL` gom `array_agg` Zone và grant đang còn. Không thêm round-trip.
- Middleware mới `requireCapability(...caps)` (khớp bất kỳ):
  - Trả 403 với `code: 'CAPABILITY_DENIED'` và `required`.
  - SUPER_ADMIN luôn qua.
  - Vẫn kiểm tra trần theo vai trò.
- Thay `requireRoles(...)` bằng `requireCapability(...)` cho khoảng 110 route dùng chung trong `app.ts` và `progress-report.routes.ts`, theo bảng ở mục 2. Route CONTRACTOR/GUEST/SA-only không đổi.

### 4.3 Vá chỗ chưa chặn Zone. Mọi hàm dưới đây đổi sang `zoneScope`
- `modules/report/utils/zone-access.utils.ts:5` (`canAccessZone`): chuyển thành re-export từ `common/rbac/zone-scope.ts`.
- `modules/cadastral/utils/zone-scope.utils.ts:16` (`resolveZoneMapScope`).
- `modules/attendance/attendance.rules.ts:54-78`: `resolveAdminZoneScope`, `canAdminAccessCheckInZone`, `isZoneWithinAssignment`.
- `cadastral.service.ts:504-568`: `isZoneMatchOrAllPrivilege` / `assertUserCanModifyParcel`. Sửa lỗi "chưa có Zone thì toàn quyền" thành "chưa có Zone thì không có quyền".
- `cadastral-geometry.service.ts:304-310`: bỏ `hasAllZonesPrivilege = !normalizedAssigned`.
- `audit.controller.ts:27,41,71,390,403`:
  - `?zoneId` phải đi qua `resolveRequestedZones`.
  - SQL đổi `p.zone_id = $n` thành `= ANY($n)` tại `audit-review.service.ts:67-70`, `audit-alerts.service.ts:83` và `condo-queue.service.ts:170`.
- Hành động trên một hồ sơ gọi `assertRecordInScope` trước khi ghi: approve, reject, audit-edit, rollback, thao tác ảnh, revert, approve-absentee, batch-approve.
- `assignSurveyor` (`cadastral.controller.ts:478`, `cadastral.service.ts:376`):
  - Lô phải trong phạm vi người giao.
  - KSV được giao phải có Zone của lô. Nếu không có, trả 409 kèm gợi ý gán Zone trước.
- `user-admin.controller.ts:16` và `progress-report.controller.ts:24-26`: lọc theo danh sách Zone.
- `audit-version.service.ts:276`: bỏ danh sách vai trò hardcode (có cả vai trò không tồn tại), thay bằng `audit.modify`.
- Phạm vi của KSV (người dùng chốt, Câu 3): KSV **chỉ xem và chỉ ghi** trong các Zone được gán. Có cờ `config.rbac.enforceSurveyorZone`, mặc định `false`; khi tắt chỉ log `console.warn('[Rbac:ShadowZoneViolation]', {...})` (xem GĐ 6). Áp dụng cho:
  - Route khảo sát (`app.ts:152-182`): `assertRecordInScope` trên mọi route đọc chi tiết và ghi hồ sơ.
  - `/parcels/zone-map` và `/parcels/:id`: `resolveZoneMapScope` (`cadastral/utils/zone-scope.utils.ts:16`) thu hẹp cả KSV, không chỉ Zone Admin.
  - Frontend: bộ chọn Zone của KSV ở `SweepMapHeader.tsx:117-135` chỉ hiện Zone được gán (GĐ 4, không cần chờ cờ).
  - Muốn làm Zone khác thì Super Admin gán thêm Zone (Câu 7b). Không có chế độ "xem Zone khác chỉ đọc". Rủi ro đã chấp nhận: hỗ trợ gấp sang Zone khác phải chờ Super Admin.

### 4.4 Chấm công nhiều Zone
- `GET /attendance/assigned-zone` (`attendance.controller.ts:114-124`) trả thêm `assignedZones[]` và `primaryZoneId`.
- `AttendanceRepository.getUserAssignedZone` (`attendance.repository.ts:248-254`) chuyển thành `getUserZoneScope`.
- `checkIn` (`attendance.service.ts:137-261`):
  - Đổi `isZoneWithinAssignment(scope, selected)`. Cờ `ZONE_NOT_ASSIGNED` chỉ bật khi Zone đã chọn nằm ngoài **toàn bộ** danh sách.
  - Ghi `assigned_zones_at_checkin` (mảng) bên cạnh `assigned_zone_at_checkin` (Zone chính).
- Tâm Zone vẫn tính bằng `resolveZoneCentroidAndDistance` theo Zone KSV chọn. Không hardcode.
- **Duyệt công theo Zone điểm danh** (người dùng chốt, Câu 6). Mỗi ca thuộc Zone nơi điểm danh (`timekeeping_checkins.zone_id`). Zone Admin có `attendance.review` trên Zone đó duyệt ca, Zone Admin có `attendance.period_lock` khóa kỳ của Zone đó. Cơ chế `attendance_periods` UNIQUE(zone_id, period_month) không đổi. Ví dụ: KSV A có 12 ca Zone 02 do D duyệt và 8 ca Zone 07 do E duyệt.
- Tính tiền công: `AttendanceRepository.getAttendanceSummary` (`attendance.repository.ts:594`) đã gom theo `surveyor_id` trên danh sách Zone, nên Super Admin chọn "Toàn tuyến" sẽ có tổng 20 ca. Bổ sung:
  - cột tách số ca theo từng Zone (`zoneBreakdown: { zoneCode, approvedDays, periodLocked }[]`),
  - cờ "chưa khóa đủ kỳ" khi còn Zone nào của KSV trong tháng chưa khóa,
  - CSV export (`exportSummaryCsv`) có cùng các cột.
- Zone Admin có nhiều Zone thì thấy tổng trên các Zone mình phụ trách; ca ở Zone ngoài phạm vi không hiện.

### 4.5 API quản lý quyền (`modules/auth/`, mở rộng `user-admin.controller.ts` và `auth.repository.ts`, DTO Zod trong `auth.dto.ts`)
- `GET /admin/rbac/catalog`: catalog, trần, preset và nhãn tiếng Việt. Mọi admin xem được.
- `GET /admin/users/:id/access`: Zone, chức năng và lịch sử grant/revoke.
- `PUT /admin/users/:id/access` (SUPER_ADMIN): body `{ zoneCodes[], primaryZoneCode, capabilities[], reason }`.
  - Zod kiểm tra: key nằm trong catalog, nằm trong trần vai trò, Zone tồn tại và active, Zone chính thuộc danh sách, `reason` không rỗng.
  - Repository tính diff rồi `BEGIN`:
    - revoke dòng thừa,
    - insert dòng mới,
    - cập nhật `users.assigned_zone_id`,
    - ghi `system_audit_logs` với action `USER_ACCESS_CHANGED` và `diff_payload {before, after, reason}`,
    - `COMMIT`.
  - Lỗi thì `ROLLBACK`.
- **Gỡ Zone khi KSV còn việc dở** (người dùng chốt, Câu 4). Áp dụng trong `PUT /admin/users/:id/access`:
  - Hồ sơ KSV là người lập (`surveyor_id`) và đang `DRAFT` / `REJECTED` (`report_status_enum`, `init_schema.sql:109`) ở Zone bị gỡ: KSV **vẫn sửa và nộp được**. `assertRecordInScope` có ngoại lệ `isOwnUnfinishedReport`. KSV không mở được hồ sơ mới ở Zone đó.
  - Lô có `assigned_surveyor_id` = KSV, thuộc Zone bị gỡ và chưa có hồ sơ của KSV (`NOT_SURVEYED` / `ASSIGNED_TO_ME`) thì tự bỏ giao: `assigned_surveyor_id = NULL`, `ASSIGNED_TO_ME` về `NOT_SURVEYED`. Làm trong cùng transaction với việc gỡ Zone, và ghi danh sách lô vào `diff_payload.unassignedParcelIds`.
  - Lô đã có hồ sơ dở thì giữ nguyên người được giao.
  - Endpoint xem trước `GET /admin/users/:id/zones/:zoneCode/impact` (SUPER_ADMIN) trả `{ draftCount, rejectedCount, toUnassignParcelCount }` để UI hiện trước khi xác nhận.
  - KSV quay lại Zone cũ để hoàn tất thì điểm danh ở đó bị cờ `ZONE_NOT_ASSIGNED` và phải ghi lý do, đúng luật hiện hành.
- Đổi vai trò qua `updateUser` (`auth.repository.ts:224-295`): trong cùng transaction, revoke mọi grant vượt trần mới rồi cấp preset FULL của vai trò mới.
- `restoreAndOverwriteUser` (`auth.repository.ts:174-222`): revoke grant và Zone cũ trước khi cấp mới.
- `createUser`: nhận thêm `zoneCodes[]` và `capabilities[]`. Mặc định là preset FULL của vai trò.
- `assignZoneAdmin` (`cadastral-ingestion.service.ts:584-648`): ghi `user_zone_assignments` thay cho việc ghi đè, và không xóa Zone khác của admin. Đồng thời sửa con trỏ `assigned_admin_id` cũ bị bỏ quên.
- `/auth/login` và `/auth/me` (`auth.service.ts:50-63`, `auth.controller.ts`) trả `capabilities`, `assignedZones` và `primaryZoneId`.

### 4.6 Bằng chứng pháp lý
- `diff_payload` của approve, reject và khóa ký số thêm `actorAccess: { role, capabilities, zones }` tại thời điểm thao tác. Mục đích là chứng minh trước Tòa rằng người duyệt có thẩm quyền đúng Zone.
- Giữ nguyên tên action cũ như `ZONE_ADMIN_APPROVE_REPORT`, để không vỡ lịch sử và báo cáo.
- **Không chặn tự duyệt** (người dùng chốt, Câu 1): Zone Admin có cả `survey.perform` và `audit.decide` vẫn được Approve/Reject hồ sơ do chính mình khảo sát, như hiện tại. Bù lại, `actorAccess` ghi thêm cờ `isSelfReview: boolean` (người duyệt = `surveys.surveyor_id` hoặc `parcels.assigned_surveyor_id`) để tra cứu được về sau. Rủi ro pháp lý đã chấp nhận: xem mục "Quyết định đã chốt".

---

## 5. Frontend

### 5.1 Lõi
- `context/AuthContext.tsx`:
  - `UserProfile` (6-17) thêm `capabilities: Capability[]`, `assignedZones: string[]`, `primaryZoneId`.
  - Chuẩn hóa camel/snake ở **cả hai** chỗ: `syncUserProfileFromApi` (51-91) và `login` (130-157).
  - Thiếu trường thì để `[]` (fail-closed).
- File mới `core/rbac/capabilities.ts`: union `Capability` bản sao của backend, kèm script kiểm tra đồng bộ (mục 7).
- File mới `core/rbac/can.ts`: các hàm thuần `can(user, cap)`, `canAny`, `canAccessZone(user, zone)`. File mới `core/rbac/useCan.ts`: hook bọc các hàm đó.
- `core/types/domain.types.ts:5-14`: bỏ `UserProfile` trùng, dùng bản trong AuthContext.
- Interceptor axios: gặp 403 có `code === 'CAPABILITY_DENIED'` thì gọi `refreshProfile()` rồi toast "Quyền của bạn vừa thay đổi". Có `console.error('[Rbac:Denied]', err)`.

### 5.2 Zone
- `utils/zoneScope.ts`:
  - Thêm `getAllowedZones(user)`.
  - `getLockedZone` chỉ trả về Zone khi danh sách có đúng 1 Zone.
  - `isUnassignedZoneAdmin` dựa trên danh sách rỗng.
- Bộ chọn Zone chỉ hiện các Zone được phép. Có 1 Zone thì hiện nhãn khóa. Các chỗ cần đổi:
  - `SweepMapHeader.tsx:117-135`
  - `ZoneAdminSidebar.tsx:177-202` (cùng `ZoneAdminAppShell.tsx:85`, `ZoneManagerDashboardPage.tsx:98-112,265`)
  - `TimekeepingHeader.tsx:34-42`
  - `useTimekeepingState.ts:87-115`: mặc định là `primaryZoneId`, bỏ fallback `'ZONE_09'`
  - `useCompanionCheckInState.ts`
  - `AdminAttendanceManagementView.tsx:26-27`
  - `usePhase1ExportData.ts:20-45`
  - `GuestDashboardPage.tsx:57-70`
- `App.tsx:95-126`: `selectedZone` phải thuộc danh sách được phép. Nếu không, rơi về `primaryZoneId`. Bỏ `DEFAULT_ZONE` hardcode cho user có Zone.

### 5.3 Điều hướng
- `utils/rbacNavigationGuard.ts:8-25`: `ROLE_ALLOWED_TABS` chuyển thành `getAllowedTabs(user)`, suy từ chức năng. Ví dụ `admin-export` cần `report.export`.
- `ZoneAdminSidebar.tsx:83-122`, mỗi mục có `requires`:
  - `review` cần `audit.view`
  - `parcels` cần `parcel.edit` hoặc `parcel.assign_surveyor`
  - `export` cần `report.export`
  - `attendance` cần `attendance.review`
  - `dashboard` và `map` luôn có
- `ZoneManagerDashboardPage.tsx:328-456`: view mặc định là mục đầu tiên được phép. Không có chức năng nào thì hiện empty state "Tài khoản chưa được cấp chức năng — liên hệ Super Admin".

### 5.4 Thay kiểm tra vai trò bằng `can()`, theo từng module
Áp cùng một mẫu: nút ghi thì ẩn khi thiếu quyền; màn hồ sơ thiếu quyền sửa thì vào `readOnly` theo đúng quy chuẩn Mục 3.7 của CLAUDE.md (hậu tố "(Chỉ Đọc)", thẻ tĩnh, ẩn nút ghi).
- **Thẩm định:**
  - `SurveyPhase1Page.tsx:1018` (`canApproveOrReject` = `audit.decide`), cùng 1192, 1309, 1319.
  - `useAdminViewLock.ts:22-30`: `isViewOnlyForAdmin` = thiếu `audit.modify`.
  - `SurveyReviewBanner.tsx:54`, `AbsenteeReviewView.tsx:350`, `ZoneAuditReviewQueue.tsx:236,526`, `AuditStudioModal.tsx`, `RejectReportModal.tsx`, `CondoTowerUnitQueue.tsx:379`, `UnitInspectionDrawer.tsx`, `useSurveyorHomeState.ts:22,194,253`, `ParcelCardItem.tsx:224`.
  - Các component hiện chỉ được bảo vệ bằng vị trí mount phải tự gọi `can()`.
- **Lô đất / GIS / CAD:**
  - `ParcelDetailBottomSheet.tsx:552-810` dùng `parcel.edit`. Lịch sử biến động vẫn chỉ cho SA.
  - `UnifiedGisMutationModal`: bỏ prop `role` hardcode tại `AdminGisMutationTab.tsx:436` và `AuditStep6ScopeGisMutation.tsx:948`.
  - Các file `BuildingHubModal.tsx:25,161,211`, `BuildingHubHeader.tsx`, `BuildingUnitList.tsx` và `FloorCadSurveySection.tsx` dùng `parcel.edit`. Thiếu quyền thì `readOnly={true}`, `onSave={undefined}`.
- **Chấm công:** `AdminAttendanceManagementView.tsx:18,24` nhận các cờ từ `can('attendance.review' | 'attendance.period_lock')`. `AttendanceMonthlySummaryTab.tsx:161` vẫn chỉ cho SA.
- **Báo cáo:** `Phase1ExportModuleBox.tsx:107-165` dùng `report.export`.
- **Khảo sát:** các trang Condo, Step1 và `MasterSurveyViewModal` dùng `survey.perform` hoặc `audit.modify`.
- Dọn code chết `app/routes/AppRoutes.tsx` và `app/layouts/SurveyorLayout.tsx`, vì không có chỗ nào import. Cần xác nhận trước khi xóa.

### 5.5 Giao diện quản trị
- **Super Admin:**
  - Thêm panel `UserAccessPanel.tsx` vào `features/admin-portal/components/`, gắn trong `UserEditModal.tsx`. Panel thay ô chọn 1 Zone ở dòng 338-350. Gồm:
    - Chọn nhiều Zone dạng chip (badge `bg-cyan-950 text-cyan-300 border-cyan-700 font-mono`), chọn Zone chính bằng radio.
    - Checklist chức năng nhóm theo module. Chỉ hiện mục trong trần của vai trò đang chọn.
    - Nút preset: Đầy đủ, Chỉ thẩm định, Chỉ lô đất, Chỉ chấm công.
    - Ô lý do bắt buộc.
    - Tab "Lịch sử phân quyền" lấy từ `GET /admin/users/:id/access`.
  - `UserManagementTab.tsx`: cột hiển thị danh sách Zone và số chức năng, bộ lọc Zone đổi sang lọc giao.
  - `services/userService.ts:12,50,59`: thêm `zoneCodes`, `primaryZoneCode`, `capabilities`, cùng hai hàm `getUserAccess` và `updateUserAccess`.
  - Trong `UserAccessPanel`, khi Super Admin bỏ chip một Zone của KSV: gọi endpoint `impact` rồi hiện hộp xác nhận, ví dụ "3 hồ sơ nháp và 1 hồ sơ bị trả về KSV vẫn được hoàn tất; 5 lô chưa bắt đầu sẽ bỏ giao". Bắt buộc nhập lý do.
- Zone Admin không có màn phân công Zone cho KSV. Danh sách KSV ở màn giao lô (`parcel.assign_surveyor`) chỉ gồm KSV đã có Zone của lô.
- Mọi nút có `cursor-pointer`, khi disabled có `disabled:opacity-50 cursor-not-allowed`. Không dùng hex neutral. Badge đúng bảng màu ở Mục 4.2 của CLAUDE.md.

---

## 6. Lộ trình triển khai (mỗi giai đoạn commit riêng trên `dev`)

| GĐ | Nội dung | Hành vi với người dùng |
|---|---|---|
| 0 | Gộp alias Zone, tạo `common/rbac/zone-scope.ts`, vá các lỗ hổng phạm vi ở 4.3 (trừ route của KSV) | Đóng lỗ hổng. Zone Admin chưa gán Zone mất quyền sửa toàn tuyến |
| 1 | Migration và backfill. Guard nạp `capabilities` / `zoneScope`. `/auth/me` trả thêm trường | Không đổi, vì ai cũng có preset FULL |
| 2 | `requireCapability` thay `requireRoles` trên route dùng chung. Chấm công nhiều Zone | Không đổi |
| 3 | API quản lý quyền và `UserAccessPanel` | Super Admin bắt đầu chia quyền A/B/C/D, gán nhiều Zone |
| 4 | Frontend: `useCan`, sidebar, bộ chọn Zone, readOnly theo chức năng | UI khớp quyền |
| 5 | Báo cáo công tổng theo KSV nhiều Zone (4.4) | Super Admin tính tiền công trên mọi Zone |
| 6 | Xem log `[Rbac:ShadowZoneViolation]` khoảng 1 tuần, bổ sung Zone cho KSV bị log, rồi bật `enforceSurveyorZone=true` | KSV chỉ ghi được trong Zone của mình |

Trước khi đưa GĐ 1 lên cloud: backup snapshot như quy trình `TASK_DANG_DO.md`.

---

## 7. Kiểm thử

**Backend: test mới `backend/src/scripts/test_rbac_capabilities.ts`**
Chạy trên DB test `metro2_audit_test`, theo mẫu `test_attendance_admin_audit.ts`. Kịch bản:
1. Zone Admin A chỉ có `ZA_AUDIT`:
   - approve trong Zone 02 thì 200,
   - sửa lô thì 403 `CAPABILITY_DENIED`,
   - approve hồ sơ ở Zone 07 thì 403,
   - approve hồ sơ do chính A khảo sát thì 200 và `diff_payload.actorAccess.isSelfReview = true`.
2. Tài khoản B chỉ có `ZA_PARCEL`: sửa lô thì 200, approve thì 403, xem hàng đợi thẩm định thì 403.
3. Tài khoản D chỉ có `ZA_ATTENDANCE`:
   - xác nhận hàng loạt và khóa kỳ thì 200, unlock kỳ thì 403 (SA only),
   - `/parcels/zone-map` thì 200, `/reports/phase1/:id` thì 403 (Câu 2).
3b. KSV A có 12 ca ở Zone 02 và 8 ca ở Zone 07 (Câu 6):
   - D (Zone 02) chỉ thấy và duyệt 12 ca; duyệt ca Zone 07 thì 403,
   - summary toàn tuyến của SA ra 20 ca, `zoneBreakdown` có 2 dòng, cờ "chưa khóa đủ kỳ" bật khi mới khóa Zone 02.
4. KSV có Zone [02, 07]:
   - check-in ở 07 không bật cờ `ZONE_NOT_ASSIGNED`,
   - check-in ở 05 bật cờ và bắt buộc lý do,
   - `assigned_zones_at_checkin` có đủ 2 Zone.
5. Gán Zone cho KSV:
   - Zone Admin gọi `PUT /admin/users/:id/access` thì 403,
   - Super Admin gỡ Zone 02 của KSV có 1 nháp, 1 bị trả về và 2 lô chưa bắt đầu: KSV vẫn lưu và nộp được 2 hồ sơ dở, không tạo được hồ sơ mới ở Zone 02, 2 lô bị bỏ giao, có `unassignedParcelIds` trong audit,
   - giao lô Zone 07 cho KSV chưa có Zone 07 thì 409.
6. Đổi vai trò từ ZONE_ADMIN sang SURVEYOR: grant vượt trần bị revoke, có dòng audit.
7. Thu hồi chức năng làm request kế tiếp với token cũ bị 403 ngay.
8. Zone Admin không có Zone: mọi thao tác ghi đều 403. Đây là regression cho lỗi ở `cadastral.service.ts:506`.
9. Đặt `?zoneId=ZONE_07` trên danh sách thẩm định khi chỉ có Zone 02 thì 403.
10. Super Admin cố cấp `audit.decide` cho KSV thì 400, vì vượt trần.
11. Backfill chạy 2 lần không sinh dòng trùng. Key preset trong SQL khớp `ROLE_PRESETS`.

**Các test và lệnh khác**
- Chạy lại `test_zone_map_scope.ts`, `test_attendance_admin_audit.ts`, `test_zone_admin_change_password.ts` và `npm run test:api`.
- Frontend: thêm `npm run test:rbac` theo mẫu esbuild như `test:restricted-area`. Test hàm thuần `can()`, `getAllowedTabs()`, `getAllowedZones()`, và so khớp union `Capability` với catalog backend.
- Chốt bắt buộc: `npm run build` ở cả hai thư mục, `check:zero-any`, `check:ui`, `check:catch`, `check:theme`.
- Thử tay bằng `./start-local.sh`:
  - Đăng nhập lần lượt 4 Zone Admin A/B/C/D và 1 KSV hai Zone.
  - Kiểm tra sidebar, nút, chế độ Chỉ Đọc và bộ chọn Zone.
  - Điểm danh ở cả hai Zone.
  - Super Admin đổi quyền khi người kia đang mở màn hình: thao tác kế tiếp bị chặn và profile tự làm mới.

---

## 8. Rủi ro và ghi chú

- **Runner migration:** nếu chạy từ thư mục gốc, runner chọn `database/migrations/` trước. Thư mục này đang thiếu 2 file mới nhất (`migration-runner.ts:21-38`). Phải chạy `cd backend && npm run db:migrate` và chép file sang cả hai thư mục.
- **`authenticateJwt` nặng hơn** vì thêm `LATERAL` / `array_agg`. Có index `user_id` qua unique partial index nên vẫn là 1 round-trip. Đo trước và sau.
- **Dữ liệu cũ dùng `'ALL'` / `'ALL_ZONES'`:** backfill chuẩn hóa về `'ALL'`. Chỉ giữ cho ZONE_ADMIN và GUEST. KSV có `'ALL'` sẽ được liệt kê để Super Admin quyết định.
- Không sửa migration cũ. Không hard-delete. Tên action audit cũ giữ nguyên.

---

## Quyết định đã chốt
| # | Quyết định | Lý do / rủi ro đã chấp nhận | Bước bị ảnh hưởng |
|---|---|---|---|
| 1 | Vai trò là trần; Super Admin tick tập con chức năng cho từng tài khoản | KSV không bao giờ được cấp quyền duyệt | Mục 2, 4.2, 4.5 |
| 2 | Một danh sách Zone cho cả tài khoản, không chia Zone theo từng chức năng | Đơn giản khi cấu hình và khi kiểm toán | Mục 3, 4.1 |
| 3 | Không chặn tự duyệt: Zone Admin vừa khảo sát vừa duyệt được cùng một hồ sơ (Câu 1) | **Rủi ro đã chấp nhận:** hồ sơ do một người vừa đo vừa duyệt dễ bị bên kia bác trước Tòa. Bù lại bằng cờ `isSelfReview` trong `actorAccess` | 4.6 |
| 4 | Dashboard và bản đồ chỉ đọc là quyền nền của mọi Zone Admin; mở hồ sơ chi tiết hoặc hàng đợi thẩm định cần `audit.view` (Câu 2) | D cần bản đồ để đối chiếu điểm danh nhưng không cần xem hồ sơ | Mục 2, 4.3 |
| 5 | KSV chỉ xem và ghi trong Zone được gán; không có chế độ xem Zone khác (Câu 3) | Không lộ thông tin chủ hộ của Zone khác | 4.3, 5.2, GĐ 6 |
| 6 | Gỡ Zone: KSV vẫn hoàn tất hồ sơ `DRAFT`/`REJECTED` của chính mình; lô chưa bắt đầu tự bỏ giao (Câu 4) | Số liệu đã đo không bị treo, hồ sơ không do hai người đo | 4.5, 5.5 |
| 7 | Không có ngày hết hạn cho phân công Zone; gỡ thủ công (Câu 5) | **Rủi ro đã chấp nhận:** KSV được mượn sang Zone khác vẫn giữ quyền nếu không ai nhớ gỡ | Mục 3 (không thêm cột) |
| 8 | Duyệt và khóa công theo Zone điểm danh; Super Admin có báo cáo tổng theo KSV kèm tách theo Zone (Câu 6) | Khớp cơ chế khóa kỳ SHA-256 theo Zone đang có | 4.4, GĐ 5 |
| 9 | Chỉ Super Admin gán/gỡ Zone cho KSV; bỏ quyền `surveyor.assign_zone` và màn phân công của Zone Admin. Tạo/khóa/đặt lại mật khẩu vẫn ở Super Admin (Câu 7, 7b) | Đảo lựa chọn trước plan. **Rủi ro đã chấp nhận:** mọi điều động KSV, kể cả hỗ trợ gấp, phải chờ Super Admin, vì KSV bị chặn ngoài Zone (QĐ 5) | Context, Mục 1, 2, 4.5, 5.3, 5.5, 6, 7 |

## Edge cases
| Tình huống | Hành vi mong đợi | Bước xử lý | Cách kiểm thử |
|---|---|---|---|
| Zone Admin chưa được gán Zone gọi API sửa lô | 403; trước đây được sửa toàn tuyến | 4.3 (`cadastral.service.ts:506`) | Test 8 |
| Zone Admin chỉ có Zone 02 truyền `?zoneId=ZONE_07` vào danh sách thẩm định | 403 | 4.3 | Test 9 |
| Super Admin thu hồi `audit.decide` trong lúc Zone Admin đang mở hồ sơ | Bấm Approve nhận 403 `CAPABILITY_DENIED`; frontend làm mới profile, ẩn nút | 4.2, 5.1 | Test 7, thử tay |
| Gỡ Zone khi KSV còn nháp, hồ sơ bị trả về và lô chưa bắt đầu | Hồ sơ dở vẫn hoàn tất được; lô chưa bắt đầu bị bỏ giao trong cùng transaction | 4.5 | Test 5 |
| KSV quay lại Zone cũ để hoàn tất hồ sơ dở | Điểm danh bị cờ `ZONE_NOT_ASSIGNED`, phải ghi lý do | 4.4, 4.5 | Test 4 (Zone ngoài danh sách) |
| KSV có 2 Zone, mỗi Zone do một Zone Admin chấm công | Mỗi người chỉ duyệt ca ở Zone mình; Super Admin thấy tổng | 4.4 | Test 3b |
| Giao lô Zone 07 cho KSV chưa có Zone 07 | 409 kèm gợi ý nhờ Super Admin gán Zone | 4.3 (`assignSurveyor`) | Test 5 |
| Zone Admin tự duyệt hồ sơ do chính mình khảo sát | Cho phép; audit có `isSelfReview: true` | 4.6 | Thêm vào test 1: kiểm tra cờ trong `diff_payload` |
| Đổi vai trò ZONE_ADMIN sang SURVEYOR | Grant vượt trần bị revoke, cấp preset SV_FULL, có audit | 4.5 | Test 6 |

## Câu hỏi còn mở
- Không còn.
