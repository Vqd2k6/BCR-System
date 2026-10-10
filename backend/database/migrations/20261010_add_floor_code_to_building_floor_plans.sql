-- Migration: Bổ sung cột floor_code vào bảng building_floor_plans
-- Mục đích: Lưu trữ mã quy ước tầng chuẩn (MEZZ, SB, B01, G, F08, TECH, TUM, ROOF) phục vụ xuất báo cáo tự động và sinh Photo ID

ALTER TABLE building_floor_plans
  ADD COLUMN IF NOT EXISTS floor_code VARCHAR(32);

CREATE INDEX IF NOT EXISTS idx_floor_plans_floor_code ON building_floor_plans(parcel_id, floor_code);
