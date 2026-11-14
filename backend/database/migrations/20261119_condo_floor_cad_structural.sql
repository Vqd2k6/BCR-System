-- ============================================================================
-- Chung cư GĐ C (15/11/2026): CAD kết cấu (CAD_E) theo tầng + Kho tài nguyên CAD tầng.
-- Phương án 1A: mỗi tầng 1 CAD_Z (cad_photo_url, đã có), 1 CAD_E (cad_structural_url)
-- và kho nhiều tờ (cad_resources_json: [{ id, title, category CAD_Z|CAD_E|OTHER, url, createdAt, createdBy, deletedAt }]).
-- Mỗi U/M có CAD_E riêng đã cắt (unit_structural_cad_url) + khung cắt trên CAD_E tầng (cad_structural_bbox).
-- Tờ trong kho chỉ xóa mềm (deletedAt). Idempotent.
-- ============================================================================

ALTER TABLE building_floor_plans ADD COLUMN IF NOT EXISTS cad_structural_url TEXT;
ALTER TABLE building_floor_plans ADD COLUMN IF NOT EXISTS cad_resources_json JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE building_units ADD COLUMN IF NOT EXISTS unit_structural_cad_url TEXT;
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS cad_structural_bbox JSONB;

COMMENT ON COLUMN building_floor_plans.cad_structural_url IS 'CAD kết cấu (E) chính của tầng; kế thừa theo applicable_floors như cad_photo_url';
COMMENT ON COLUMN building_floor_plans.cad_resources_json IS 'Kho tờ CAD bổ sung của tầng; phần tử chỉ xóa mềm (deletedAt), không bỏ khỏi mảng';
COMMENT ON COLUMN building_units.unit_structural_cad_url IS 'Ảnh CAD_E đã cắt cho U/M (nguồn nạp ban đầu cho phiếu; phiếu giữ bản độc lập)';
COMMENT ON COLUMN building_units.cad_structural_bbox IS 'Khung cắt U/M trên CAD_E tầng (% ảnh), khác cad_bbox trên CAD_Z';
