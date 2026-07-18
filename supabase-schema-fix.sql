-- ==========================================
-- SYAMSA PWA - Supabase Schema Fix
-- Run this in Supabase SQL Editor
-- ==========================================

-- 1. Tambah kolom yang missing ke permits table
ALTER TABLE permits
ADD COLUMN IF NOT EXISTS nama TEXT,
ADD COLUMN IF NOT EXISTS nama_wali TEXT,
ADD COLUMN IF NOT EXISTS alamat_wali TEXT,
ADD COLUMN IF NOT EXISTS start_time_limit TIME,
ADD COLUMN IF NOT EXISTS end_time_limit TIME,
ADD COLUMN IF NOT EXISTS destination TEXT,
ADD COLUMN IF NOT EXISTS requested_by TEXT DEFAULT 'wali',
ADD COLUMN IF NOT EXISTS status_label TEXT,
ADD COLUMN IF NOT EXISTS approvedBy TEXT,
ADD COLUMN IF NOT EXISTS approvedAt TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejectedBy TEXT,
ADD COLUMN IF NOT EXISTS rejectedAt TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejectReason TEXT,
ADD COLUMN IF NOT EXISTS studentId TEXT,
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS hasDocument BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_overdue BOOLEAN DEFAULT FALSE;

-- 2. Buat exit_tickets table baru (gunakan TEXT untuk permit_id agar match dengan permits.id)
CREATE TABLE IF NOT EXISTS exit_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permit_id TEXT,  -- TEXT agar match dengan permits.id yang mungkin TEXT
    student_nis TEXT,
    student_name TEXT,
    student_class TEXT,
    wali_name TEXT,
    wali_address TEXT,
    destination TEXT,
    reason TEXT,
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    approver_name TEXT,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable realtime untuk permits dan exit_tickets
-- (jalankan di SQL Editor atau via Supabase Dashboard > Database > Replication)
-- ALTER PUBLICATION supabase_realtime ADD TABLE permits;
-- ALTER PUBLICATION supabase_realtime ADD TABLE exit_tickets;

-- 4. Buat indexes untuk performa query
CREATE INDEX IF NOT EXISTS idx_permits_nis ON permits(nis);
CREATE INDEX IF NOT EXISTS idx_permits_status ON permits(status);
CREATE INDEX IF NOT EXISTS idx_permits_kelas ON permits(kelas);
CREATE INDEX IF NOT EXISTS idx_permits_category ON permits(category);
CREATE INDEX IF NOT EXISTS idx_exit_tickets_permit_id ON exit_tickets(permit_id);

-- 5. Buat function untuk trigger realtime update pada permits
CREATE OR REPLACE FUNCTION public.handle_permits_changes()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'permits_changes',
    json_build_object(
      'operation', TG_OP,
      'record', row_to_json(NEW),
      'old_record', row_to_json(OLD)
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS permits_realtime_trigger ON permits;
CREATE TRIGGER permits_realtime_trigger
  AFTER INSERT OR UPDATE OR DELETE ON permits
  FOR EACH ROW EXECUTE FUNCTION public.handle_permits_changes();

-- 6. Buat function untuk notifications realtime
CREATE OR REPLACE FUNCTION public.handle_notifications_changes()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'notifications_changes',
    json_build_object(
      'operation', TG_OP,
      'record', row_to_json(NEW),
      'old_record', row_to_json(OLD)
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS notifications_realtime_trigger ON notifications;
CREATE TRIGGER notifications_realtime_trigger
  AFTER INSERT OR UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION public.handle_notifications_changes();

-- 7. Verifikasi
SELECT 'Schema fix completed!' as status;
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'permits' ORDER BY ordinal_position;
