-- ========================================
-- 🟣 TÍM GO v3.0 Pro — Migration Script
-- Chạy trong Supabase SQL Editor để upgrade
-- ========================================

-- 1. Thêm 'pending' vào status check constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'blocked', 'pending'));

-- 2. Cho phép phone = NULL (TX Zalo chưa có SĐT)
ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;
-- Bỏ UNIQUE constraint cũ nếu có, thêm lại cho phép NULL
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_key;
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique ON users(phone) WHERE phone IS NOT NULL AND phone != '';

-- 3. Cho phép password_hash = NULL (TX Zalo không dùng MK)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- 4. Thêm cột Zalo OAuth
ALTER TABLE users ADD COLUMN IF NOT EXISTS zalo_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS zalo_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS zalo_avatar TEXT;

-- 5. Thêm cột CCCD
ALTER TABLE users ADD COLUMN IF NOT EXISTS cccd TEXT;

-- ✅ DONE! Giờ TX có thể đăng ký qua Zalo với status='pending'
