-- ==========================================
-- SUPABASE SETUP: FCM Tokens Table
-- ==========================================
-- For storing Firebase Cloud Messaging tokens
-- Run in Supabase Dashboard > SQL Editor
-- ==========================================

-- 1. Create fcm_tokens table
CREATE TABLE IF NOT EXISTS fcm_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL,
  user_type TEXT DEFAULT 'anonymous',
  user_id TEXT DEFAULT 'anonymous',
  device_info TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(token)
);

-- 2. Create indexes
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user ON fcm_tokens(user_type, user_id);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_active ON fcm_tokens(is_active) WHERE is_active = TRUE;

-- 3. Enable RLS
ALTER TABLE fcm_tokens ENABLE ROW LEVEL SECURITY;

-- 4. Create policies (allow authenticated users to manage their tokens)
CREATE POLICY "Anyone can insert fcm tokens"
  ON fcm_tokens FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update own fcm tokens"
  ON fcm_tokens FOR UPDATE
  USING (
    user_type = 'anonymous'
    OR user_id = auth.jwt() ->> 'sub'
    OR user_id = auth.jwt() ->> 'email'
  );

CREATE POLICY "Anyone can view fcm tokens"
  ON fcm_tokens FOR SELECT
  USING (true);

CREATE POLICY "Anyone can delete own fcm tokens"
  ON fcm_tokens FOR DELETE
  USING (
    user_type = 'anonymous'
    OR user_id = auth.jwt() ->> 'sub'
    OR user_id = auth.jwt() ->> 'email'
  );

-- 5. Create function to cleanup old tokens
CREATE OR REPLACE FUNCTION cleanup_old_fcm_tokens()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM fcm_tokens
  WHERE updated_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
