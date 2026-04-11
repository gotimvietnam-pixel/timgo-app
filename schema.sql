-- ========================================
-- 🟣 TÍM GO v2.0 — Supabase Schema
-- Chạy trong Supabase SQL Editor
-- ========================================

-- 1. Users (Admin + Driver)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'driver')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
  vehicle_plate TEXT,
  vehicle_type TEXT DEFAULT 'xe_may',
  commission_type TEXT DEFAULT 'percent',
  commission_value INTEGER DEFAULT 20,
  online BOOLEAN DEFAULT false,
  wallet INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Trips
CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  driver_id TEXT REFERENCES users(id),
  trip_number INTEGER,
  amount INTEGER NOT NULL DEFAULT 0,
  note TEXT DEFAULT '',
  payment_status TEXT DEFAULT 'paid' CHECK (payment_status IN ('paid', 'debt')),
  payment_method TEXT DEFAULT 'cash',
  service_type TEXT DEFAULT 'xe_om',
  distance_km REAL DEFAULT 0,
  customer_name TEXT DEFAULT '',
  customer_phone TEXT DEFAULT '',
  running_total INTEGER DEFAULT 0,
  commission_amount INTEGER DEFAULT 0,
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  trip_id TEXT,
  driver_id TEXT REFERENCES users(id),
  amount INTEGER NOT NULL DEFAULT 0,
  service_type TEXT,
  distance_km REAL DEFAULT 0,
  commission INTEGER DEFAULT 0,
  payment_status TEXT DEFAULT 'paid',
  payment_method TEXT DEFAULT 'cash',
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Debts
CREATE TABLE IF NOT EXISTS debts (
  id TEXT PRIMARY KEY,
  trip_id TEXT,
  driver_id TEXT REFERENCES users(id),
  amount INTEGER NOT NULL DEFAULT 0,
  customer_name TEXT DEFAULT '',
  customer_phone TEXT DEFAULT '',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'cancelled')),
  note TEXT DEFAULT '',
  date DATE DEFAULT CURRENT_DATE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Wallet History
CREATE TABLE IF NOT EXISTS wallet_history (
  id TEXT PRIMARY KEY,
  driver_id TEXT REFERENCES users(id),
  type TEXT CHECK (type IN ('deposit', 'withdraw')),
  amount INTEGER NOT NULL DEFAULT 0,
  balance INTEGER DEFAULT 0,
  note TEXT DEFAULT '',
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Activity Log
CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_name TEXT,
  action TEXT,
  detail TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Pricing Config (JSON)
CREATE TABLE IF NOT EXISTS pricing (
  id TEXT PRIMARY KEY DEFAULT 'default',
  config JSONB NOT NULL
);

-- 8. Settings (JSON)
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  config JSONB NOT NULL
);

-- ========================================
-- INDEXES
-- ========================================
CREATE INDEX IF NOT EXISTS idx_trips_driver ON trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_trips_date ON trips(date);
CREATE INDEX IF NOT EXISTS idx_debts_driver ON debts(driver_id);
CREATE INDEX IF NOT EXISTS idx_debts_status ON debts(status);
CREATE INDEX IF NOT EXISTS idx_wallet_driver ON wallet_history(driver_id);
CREATE INDEX IF NOT EXISTS idx_log_created ON activity_log(created_at);

-- ========================================
-- RLS (Row Level Security) — cho phép anon key access
-- ========================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Policy: cho phép tất cả (dùng anon key) — đơn giản cho MVP
CREATE POLICY "Allow all" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON trips FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON debts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON wallet_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON activity_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON pricing FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON settings FOR ALL USING (true) WITH CHECK (true);
