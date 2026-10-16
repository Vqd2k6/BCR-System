-- ==============================================================================
-- Migration: 20261016_add_engineering_judgement_columns_to_risk_score_cards.sql
-- Description: Bổ sung 10 cột lưu trữ Phán quyết Kỹ sư trưởng (Engineering Judgement Override)
--              và điểm số ghi đè cho bảng risk_score_cards.
-- ==============================================================================

ALTER TABLE risk_score_cards
    ADD COLUMN IF NOT EXISTS overridden_burland_grade INT,
    ADD COLUMN IF NOT EXISTS overridden_total_ecs INT,
    ADD COLUMN IF NOT EXISTS overridden_ecs_class VARCHAR(32),
    ADD COLUMN IF NOT EXISTS overridden_importance_score NUMERIC(4,2),
    ADD COLUMN IF NOT EXISTS overridden_avg_vi NUMERIC(4,2),
    ADD COLUMN IF NOT EXISTS overridden_vi_class VARCHAR(32),
    ADD COLUMN IF NOT EXISTS overridden_impact_level_i INT,
    ADD COLUMN IF NOT EXISTS overridden_bra VARCHAR(32),
    ADD COLUMN IF NOT EXISTS judgement_engineer_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS judgement_applied_at TIMESTAMPTZ;

-- Tạo index tra cứu hồ sơ có can thiệp kỹ thuật
CREATE INDEX IF NOT EXISTS idx_risk_score_cards_judgement 
ON risk_score_cards(is_engineering_judgement_applied);
