import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { nis, password } = await request.json();
    if (!nis || !password || String(password).length < 8) {
      return json({ success: false, message: "Kredensial tidak valid" }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: credential, error: credentialError } = await admin
      .from("wali_credentials")
      .select("nis,auth_user_id,auth_email,is_active")
      .eq("nis", String(nis).trim())
      .maybeSingle();

    if (credentialError || !credential?.is_active) {
      return json({ success: false, message: "Akun wali tidak aktif" }, 401);
    }

    const authClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email: credential.auth_email,
      password: String(password),
    });
    if (authError || !authData.session) {
      return json({ success: false, message: "NIS atau password salah" }, 401);
    }

    const { data: link } = await admin
      .from("wali_students")
      .select("nis,kelas,relationship")
      .eq("user_id", authData.user.id)
      .eq("nis", credential.nis)
      .eq("is_active", true)
      .maybeSingle();

    if (!link) {
      return json({ success: false, message: "Relasi wali dan santri belum terdaftar" }, 403);
    }

    return json({
      success: true,
      access_token: authData.session.access_token,
      refresh_token: authData.session.refresh_token,
      expires_at: authData.session.expires_at,
      user: { id: authData.user.id, nis: link.nis, kelas: link.kelas, role: "wali" },
    });
  } catch (error) {
    console.error("wali-auth", error);
    return json({ success: false, message: "Autentikasi gagal" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
