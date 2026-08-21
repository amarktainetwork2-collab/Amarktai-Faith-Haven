ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS plan_code VARCHAR(64) NOT NULL DEFAULT 'individual';

CREATE INDEX IF NOT EXISTS payments_plan_status_idx ON payments (plan_code, status, created_at DESC);
