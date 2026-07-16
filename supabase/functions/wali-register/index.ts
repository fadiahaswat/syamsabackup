import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await request.json();
    const nis = String(body.nis || "").trim();
    const kelas = String(body.kelas || "").trim();
    const studentName = String(body.namaSantri || "").trim();
    const guardianName = String(body.namaWali || "").trim();
    const phone = String(body.noHP || "").replace(/[^0-9+]/g, "");
    const email = String(body.email || "").trim().toLowerCase() || null;
    if (!/^\d{3,20}$/.test(nis) || kelas.length < 1 || kelas.length > 50 || studentName.length < 2 || guardianName.length < 2 || phone.length < 8) {
      return json({ success: false, message: "Data pendaftaran tidak valid" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data, error } = await admin.from("wali_registration_requests").insert({
      nis,
      kelas,
      student_name: studentName.slice(0, 150),
      guardian_name: guardianName.slice(0, 150),
      phone: phone.slice(0, 30),
      email,
    }).select("id,status").single();
    if (error?.code === "23505") {
      return json({ success: true, status: "pending", duplicate: true });
    }
    if (error) throw error;
    return json({ success: true, id: data.id, status: data.status }, 201);
  } catch (error) {
    console.error("wali-register", error);
    return json({ success: false, message: "Pendaftaran gagal" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
