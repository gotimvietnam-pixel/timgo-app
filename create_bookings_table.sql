-- Tím Go: Bảng đặt xe từ khách hàng
-- Chạy lệnh này trong Supabase SQL Editor

CREATE TABLE IF NOT EXISTS bookings (
  id            BIGSERIAL PRIMARY KEY,
  ref           TEXT UNIQUE NOT NULL,         -- mã đặt xe VD: TG123456
  customer_name TEXT,
  customer_phone TEXT NOT NULL,
  pickup_address TEXT NOT NULL,
  dropoff_address TEXT NOT NULL,
  pickup_lat    FLOAT,
  pickup_lng    FLOAT,
  dropoff_lat   FLOAT,
  dropoff_lng   FLOAT,
  service_type  TEXT,                         -- xe_om, giao_hang_nho, etc.
  service_name  TEXT,
  estimated_fare INTEGER,
  estimated_km  FLOAT,
  note          TEXT,
  status        TEXT DEFAULT 'pending',       -- pending | confirmed | on_trip | done | cancelled
  driver_id     TEXT,                         -- assigned driver
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (khách không cần login)
CREATE POLICY "Allow anon insert" ON bookings
  FOR INSERT TO anon WITH CHECK (true);

-- Allow admin to read/update all
CREATE POLICY "Allow admin all" ON bookings
  FOR ALL USING (true);

-- Index cho admin panel sort theo thời gian
CREATE INDEX IF NOT EXISTS bookings_created_at_idx ON bookings(created_at DESC);
CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings(status);
