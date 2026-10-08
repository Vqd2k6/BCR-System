-- ============================================================================
-- MIGRATION: 20261009_fix_user_admin_integrity_and_casing.sql
-- Dự án: Hệ Thống Khảo Sát Hiện Trạng Tuyến Metro Số 2 (BCS Platform)
-- Phân hệ: Quản trị Người Dùng & Phân quyền RBAC (User Admin Hub)
-- ============================================================================

-- 1. Bổ sung các cột mở rộng cho bảng users nếu chưa có
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS signature_image_url TEXT,
  ADD COLUMN IF NOT EXISTS surveyor_code VARCHAR(16);

-- 2. Đánh chỉ mục tìm kiếm và kiểm tra trùng lặp
CREATE INDEX IF NOT EXISTS idx_users_surveyor_code ON users(surveyor_code);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- 3. Chuyển đổi ràng buộc UNIQUE(username) sang Partial Index (WHERE deleted_at IS NULL)
-- Cho phép tài khoản đã soft-delete không làm tắc nghẽn việc tạo mới/khôi phục
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'users' AND constraint_name = 'users_username_key'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_username_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_active_unique 
  ON users(username) WHERE deleted_at IS NULL;

-- 4. Đảm bảo khóa ngoại parcels.assigned_surveyor_id có ON DELETE SET NULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'parcels' AND column_name = 'assigned_surveyor_id'
  ) THEN
    BEGIN
      ALTER TABLE parcels DROP CONSTRAINT IF EXISTS parcels_assigned_surveyor_id_fkey;
      ALTER TABLE parcels ADD CONSTRAINT parcels_assigned_surveyor_id_fkey 
        FOREIGN KEY (assigned_surveyor_id) REFERENCES users(id) ON DELETE SET NULL;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
END $$;
