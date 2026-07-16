import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return json({ success: false, message: "Sesi admin diperlukan" }, 401);

    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return json({ success: false, message: "Sesi tidak valid" }, 401);

    const appUser = await requireAdmin(admin, authData.user.id);
    const body = await request.json();
    const action = String(body.action || "");

    if (action === "list") {
      const { data, error } = await admin
        .from("wali_credentials")
        .select("nis,is_active,updated_at")
        .order("nis");
      if (error) throw error;
      return json({ success: true, data });
    }

    if (action === "set_password" || action === "reset_password") {
      const nis = normalizeNis(body.nis);
      const { data: credential, error } = await admin
        .from("wali_credentials")
        .select("auth_user_id")
        .eq("nis", nis)
        .maybeSingle();
      if (error) throw error;
      if (!credential) return json({ success: false, message: "Akun wali belum diprovisikan" }, 404);

      const temporaryPassword = action === "reset_password"
        ? createTemporaryPassword()
        : String(body.password || "");
      if (temporaryPassword.length < 12) {
        return json({ success: false, message: "Password minimal 12 karakter" }, 400);
      }

      const { error: updateError } = await admin.auth.admin.updateUserById(
        credential.auth_user_id,
        { password: temporaryPassword },
      );
      if (updateError) throw updateError;
      await admin.from("wali_credentials").update({
        is_active: true,
        updated_at: new Date().toISOString(),
      }).eq("nis", nis);

      return json({
        success: true,
        temporaryPassword: action === "reset_password" ? temporaryPassword : undefined,
      });
    }

    if (action === "approve_registration") {
      const requestId = String(body.requestId || "");
      const { data: registration, error: registrationError } = await admin
        .from("wali_registration_requests")
        .select("*")
        .eq("id", requestId)
        .eq("status", "pending")
        .maybeSingle();
      if (registrationError) throw registrationError;
      if (!registration) return json({ success: false, message: "Pendaftaran tidak ditemukan" }, 404);

      const nis = normalizeNis(registration.nis);
      const { data: existing } = await admin
        .from("wali_credentials")
        .select("nis")
        .eq("nis", nis)
        .maybeSingle();
      if (existing) return json({ success: false, message: "Akun wali sudah ada" }, 409);

      const temporaryPassword = String(body.password || "") || createTemporaryPassword();
      if (temporaryPassword.length < 12) {
        return json({ success: false, message: "Password minimal 12 karakter" }, 400);
      }
      const syntheticEmail = `wali.${nis}@accounts.syamsa.invalid`;
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: syntheticEmail,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: { name: registration.guardian_name, nis },
      });
      if (createError || !created.user) throw createError || new Error("Gagal membuat akun wali");

      try {
        const userId = created.user.id;
        const now = new Date().toISOString();
        const { error: profileError } = await admin.from("users").insert({
          id: userId,
          auth_user_id: userId,
          email: syntheticEmail,
          name: registration.guardian_name,
          auth_provider: "wali",
          metadata: { phone: registration.phone, contact_email: registration.email },
        });
        if (profileError) throw profileError;

        const { error: linkError } = await admin.from("wali_students").insert({
          id: `wali_${userId}_${nis}`,
          user_id: userId,
          nis,
          kelas: registration.kelas,
          relationship: "wali",
        });
        if (linkError) throw linkError;

        const { error: credentialError } = await admin.from("wali_credentials").insert({
          nis,
          auth_user_id: userId,
          auth_email: syntheticEmail,
        });
        if (credentialError) throw credentialError;

        const { error: roleError } = await admin.from("user_roles").insert({
          id: `ur_${crypto.randomUUID()}`,
          user_id: userId,
          role_id: "role_wali",
          kelas: registration.kelas,
          assigned_by: appUser.id,
          assigned_at: now,
          is_active: true,
        });
        if (roleError) throw roleError;

        const { error: reviewError } = await admin.from("wali_registration_requests").update({
          status: "approved",
          reviewed_by: appUser.id,
          reviewed_at: now,
        }).eq("id", registration.id);
        if (reviewError) throw reviewError;
      } catch (error) {
        await admin.auth.admin.deleteUser(created.user.id);
        throw error;
      }

      return json({ success: true, nis, temporaryPassword });
    }

    return json({ success: false, message: "Aksi tidak dikenali" }, 400);
  } catch (error) {
    console.error("wali-admin", error);
    const message = error instanceof Error ? error.message : "Operasi admin gagal";
    const status = message === "Akses admin diperlukan" ? 403 : 500;
    return json({ success: false, message }, status);
  }
});

async function requireAdmin(client: ReturnType<typeof createClient>, authUserId: string) {
  const { data: appUser, error } = await client
    .from("users")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error || !appUser) throw new Error("Akses admin diperlukan");

  const { data: assignments, error: assignmentError } = await client
    .from("user_roles")
    .select("role_id")
    .eq("user_id", appUser.id)
    .eq("is_active", true);
  if (assignmentError) throw assignmentError;
  const roleIds = (assignments || []).map((item) => item.role_id);
  if (!roleIds.length) throw new Error("Akses admin diperlukan");

  const { data: roles, error: roleError } = await client
    .from("roles")
    .select("name")
    .in("id", roleIds);
  if (roleError) throw roleError;
  if (!(roles || []).some((role) => ["superadmin", "admin"].includes(role.name))) {
    throw new Error("Akses admin diperlukan");
  }
  return appUser;
}

function normalizeNis(value: unknown) {
  const nis = String(value || "").trim();
  if (!/^\d{3,20}$/.test(nis)) throw new Error("NIS tidak valid");
  return nis;
}

function createTemporaryPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  const token = Array.from(bytes, (byte) => (byte % 36).toString(36)).join("");
  return `Sy!${token}`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
