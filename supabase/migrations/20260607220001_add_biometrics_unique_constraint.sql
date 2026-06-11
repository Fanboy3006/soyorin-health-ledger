-- ═══════════════════════════════════════════════════════════════════
-- Migration: Add unique constraint on biometrics(date, user_id)
-- 用于 health-webhook 的 upsert 操作
-- ═══════════════════════════════════════════════════════════════════

-- 添加唯一约束，支持 ON CONFLICT
ALTER TABLE biometrics ADD CONSTRAINT biometrics_date_user_id_key UNIQUE (date, user_id);

-- 添加缺失字段
ALTER TABLE biometrics ADD COLUMN IF NOT EXISTS body_fat_pct FLOAT;
ALTER TABLE biometrics ADD COLUMN IF NOT EXISTS steps INTEGER;
ALTER TABLE biometrics ADD COLUMN IF NOT EXISTS calories_burned INTEGER;
