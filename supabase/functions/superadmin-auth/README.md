# Superadmin Auth Edge Function

Secure authentication for Superadmin access using Supabase Edge Functions.

## Setup

### 1. Generate Password Hash

Generate a SHA-256 hash of your desired password:

```bash
# Using OpenSSL (macOS/Linux/WSL)
echo -n "YourPassword123" | openssl dgst -sha256

# Or use an online tool and copy the hash
```

### 2. Deploy Edge Function

```bash
# Login to Supabase CLI
supabase login

# Link to your project
supabase link --project-ref <your-project-ref>

# Deploy the function
supabase functions deploy superadmin-auth
```

### 3. Set Secrets

```bash
# Set the password hash (REQUIRED)
supabase secrets set SUPERADMIN_PASSWORD_HASH=<your-sha256-hash>

# Optionally set a custom admin email
supabase secrets set SUPERADMIN_EMAIL=admin@yourdomain.com
```

### 4. Enable in Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions** → **superadmin-auth**
3. Verify the function is active

## Testing

```bash
# Test locally
supabase functions serve superadmin-auth --env-file .env.local

# Or test with curl
curl -X POST https://<your-project>.supabase.co/functions/v1/superadmin-auth \
  -H "Content-Type: application/json" \
  -d '{"password": "YourPassword123"}'
```

## Security Notes

- Password is never stored in plain text
- Hash comparison happens server-side
- Rate limiting recommended (consider adding to Edge Function)
- Consider adding failed attempt tracking
