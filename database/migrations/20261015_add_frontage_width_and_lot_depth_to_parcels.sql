-- Migration: Add frontage_width and lot_depth to parcels table
-- Date: 2026-10-15
-- Author: Antigravity IDE

ALTER TABLE parcels ADD COLUMN IF NOT EXISTS frontage_width NUMERIC(10,2);
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS lot_depth NUMERIC(10,2);

COMMENT ON COLUMN parcels.frontage_width IS 'Bề rộng mặt tiền thửa đất (mét)';
COMMENT ON COLUMN parcels.lot_depth IS 'Chiều sâu thửa đất (mét)';
