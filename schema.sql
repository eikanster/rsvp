-- RSVP unified tables (lives in JIAI D1: jayibrahim-db)
-- Separate from existing wedding_rsvp / dinner_rsvp tables

CREATE TABLE IF NOT EXISTS rsvp (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL DEFAULT 'wedding',
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  attendance TEXT NOT NULL,
  pax INTEGER DEFAULT 0,
  accommodation INTEGER DEFAULT 0,
  amount INTEGER DEFAULT 0,
  message TEXT DEFAULT '',
  payment_status TEXT DEFAULT 'free',
  checkout_id TEXT DEFAULT NULL,
  timestamp TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(category, key)
);

CREATE INDEX IF NOT EXISTS idx_rsvp_category ON rsvp(category);
CREATE INDEX IF NOT EXISTS idx_config_category ON config(category);
