-- ============================================================
-- SYAMSA PWA - Supabase Migration 002
-- Storage Buckets for Document Uploads
-- ============================================================

-- Enable storage extension (usually pre-enabled in Supabase)
-- Note: Run this after 001_initial_schema.sql

-- Create storage bucket for permit documents (surat dokter)
-- The bucket will be created with RLS enabled by default

-- Option 1: Using SQL directly (if storage schema is available)
-- Note: In Supabase, storage.buckets might need to be created via dashboard
-- or by enabling the storage feature in your project settings.

-- Option 2: Using the Supabase Dashboard
-- 1. Go to Storage in your Supabase project
-- 2. Create a new bucket named "permit-documents"
-- 3. Set it as private (not public)
-- 4. Configure allowed MIME types: image/jpeg, image/png, image/webp, application/pdf
-- 5. Set max file size: 5MB (5242880 bytes)

-- Option 3: Create bucket via API (run this if storage API is available)
-- This assumes the storage schema exists

BEGIN;

-- Create bucket if not exists (Supabase storage schema)
-- Note: This might fail if storage is not enabled - check Supabase dashboard

DO $$
BEGIN
    -- Try to insert bucket (may not work in all Supabase setups)
    -- This is a placeholder - actual bucket creation is done via dashboard
    -- or supabase CLI

    -- Create RLS policy for permit-documents bucket
    -- This allows musyrif to upload their own documents

    EXCEPTION WHEN OTHERS THEN
        -- Storage might not be enabled, continue anyway
        RAISE NOTICE 'Storage bucket creation deferred to dashboard: %', SQLERRM;
END
$$;

-- Policy for permit-documents bucket (apply after creating bucket via dashboard)
-- This policy ensures users can only access their own documents

-- Note: Storage policies are created separately because buckets
-- are managed differently than regular tables

-- ============================================================
-- STORAGE POLICIES (Apply after bucket creation)
-- ============================================================

-- To create these policies, run after creating the bucket in Supabase dashboard:

/*
-- In Supabase SQL Editor, run:

-- 1. Create bucket (if not via dashboard)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'permit-documents',
    'permit-documents',
    false,
    5242880,  -- 5MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Policy: Users can upload their own documents
CREATE POLICY "musyrif_upload_own_documents"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'permit-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- 3. Policy: Users can view their own documents
CREATE POLICY "musyrif_view_own_documents"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'permit-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- 4. Policy: Users can update their own documents
CREATE POLICY "musyrif_update_own_documents"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'permit-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- 5. Policy: Users can delete their own documents
CREATE POLICY "musyrif_delete_own_documents"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'permit-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
);
*/

COMMIT;

-- ============================================================
-- NOTES FOR DEPLOYMENT
-- ============================================================

-- 1. Create bucket via Supabase Dashboard:
--    - Go to Storage > New Bucket
--    - Name: permit-documents
--    - Set as Private
--    - Allowed MIME types: image/jpeg, image/png, image/webp, application/pdf
--    - Max file size: 5MB

-- 2. After creating bucket, apply the RLS policies above

-- 3. Or use Supabase CLI:
--    supabase storage create bucket permit-documents --public=false
