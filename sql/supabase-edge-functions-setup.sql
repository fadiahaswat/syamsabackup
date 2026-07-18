-- ==========================================
-- SUPABASE EDGE FUNCTION: Send Push Notification
-- ==========================================
-- Deploy this function to handle push notification triggers
-- ==========================================

-- 1. Create table for push subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  keys JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(user_id, endpoint)
);

-- 2. Create indexes
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON push_subscriptions(is_active) WHERE is_active = TRUE;

-- 3. Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 4. Create policies (users can manage their own subscriptions)
CREATE POLICY "Users can view own subscriptions"
  ON push_subscriptions FOR SELECT
  USING (user_id = auth.jwt() ->> 'sub' OR user_id = auth.jwt() ->> 'email');

CREATE POLICY "Users can insert own subscriptions"
  ON push_subscriptions FOR INSERT
  WITH CHECK (user_id = auth.jwt() ->> 'sub' OR user_id = auth.jwt() ->> 'email');

CREATE POLICY "Users can update own subscriptions"
  ON push_subscriptions FOR UPDATE
  USING (user_id = auth.jwt() ->> 'sub' OR user_id = auth.jwt() ->> 'email');

-- 5. Create function to store subscription
CREATE OR REPLACE FUNCTION store_push_subscription(
  p_user_id TEXT,
  p_endpoint TEXT,
  p_keys JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sub_id UUID;
BEGIN
  INSERT INTO push_subscriptions (user_id, endpoint, keys)
  VALUES (p_user_id, p_endpoint, p_keys)
  ON CONFLICT (user_id, endpoint)
  DO UPDATE SET keys = p_keys, last_used = NOW(), is_active = TRUE
  RETURNING id INTO sub_id;
  RETURN sub_id;
END;
$$;

-- 6. Create function to get all active subscriptions for a user
CREATE OR REPLACE FUNCTION get_push_subscriptions(p_user_id TEXT)
RETURNS TABLE(id UUID, endpoint TEXT, keys JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT ps.id, ps.endpoint, ps.keys
  FROM push_subscriptions ps
  WHERE ps.user_id = p_user_id AND ps.is_active = TRUE;
END;
$$;

-- 7. Create function to remove inactive subscriptions
CREATE OR REPLACE FUNCTION cleanup_inactive_subscriptions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete subscriptions not used in 30 days
  WITH deleted AS (
    DELETE FROM push_subscriptions
    WHERE last_used < NOW() - INTERVAL '30 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  RETURN deleted_count;
END;
$$;
