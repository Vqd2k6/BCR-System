-- Theo dõi tiến độ job xuất ZIP biên bản hiện trường trên compiled_report_batches
ALTER TABLE compiled_report_batches ADD COLUMN IF NOT EXISTS progress_done INTEGER NOT NULL DEFAULT 0;
ALTER TABLE compiled_report_batches ADD COLUMN IF NOT EXISTS progress_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE compiled_report_batches ADD COLUMN IF NOT EXISTS failed_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE compiled_report_batches ADD COLUMN IF NOT EXISTS current_item VARCHAR(128);
ALTER TABLE compiled_report_batches ADD COLUMN IF NOT EXISTS file_path TEXT;
