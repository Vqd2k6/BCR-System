-- Migration: 20261102_add_users_token_version.sql
-- Mục đích: Thu hồi JWT đã cấp khi đổi/đặt lại mật khẩu. Guard so claim tokenVersion với cột này.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
