-- ============================================================
-- SYAMSA PWA - Supabase Migration 003
-- Alter permit table & configure anonymous RLS policies
-- ============================================================

-- 1. Alter permit table to store parent information
ALTER TABLE permit ADD COLUMN IF NOT EXISTS nama_wali TEXT;
ALTER TABLE permit ADD COLUMN IF NOT EXISTS alamat_wali TEXT;

-- 2. Configure anonymous SELECT policies so unauthenticated Wali mode can read master & attendance data
CREATE POLICY "Allow anonymous select kelas" ON kelas
    FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anonymous select student" ON student
    FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anonymous select attendance" ON attendance_record
    FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anonymous select permit" ON permit
    FOR SELECT TO anon USING (true);

-- 3. Configure anonymous INSERT/UPDATE policies for permits so Wali can submit per-student requests
CREATE POLICY "Allow anonymous insert permit" ON permit
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anonymous update permit" ON permit
    FOR UPDATE TO anon USING (true);
