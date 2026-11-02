-- Migration: 20261102_add_has_zones_to_floor_surveys.sql
-- Mục đích: Lưu cờ miễn Vùng Z khi chủ nhà chỉ cho chụp tổng quan tầng và lý do hạn chế tiếp cận chi tiết.
ALTER TABLE floor_surveys
  ADD COLUMN IF NOT EXISTS has_zones BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS no_zones_reason TEXT;
