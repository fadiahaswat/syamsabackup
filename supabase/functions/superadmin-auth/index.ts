/**
 * Supabase Edge Function: superadmin-auth
 *
 * Secure authentication for Superadmin access.
 * Verifies password against stored hash in environment variables.
 *
 * DEPLOYMENT:
 * Set the SUPERADMIN_PASSWORD_HASH secret via:
 * supabase secrets set SUPERADMIN_PASSWORD_HASH=<sha256-hash>
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createHash } from "https://deno.land/std@0.177.0/hash/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AuthRequest {
  password: string;
}

interface AuthResponse {
  success: boolean;
  email?: string;
  error?: string;
}

/**
 * Hash password using SHA-256
 */
async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verify superadmin credentials
 */
async function verifySuperadmin(password: string): Promise<{ valid: boolean; email?: string }> {
  // Get stored hash from environment (set via: supabase secrets set)
  const storedHash = Deno.env.get("SUPERADMIN_PASSWORD_HASH");

  if (!storedHash) {
    console.error("[superadmin-auth] SUPERADMIN_PASSWORD_HASH not configured");
    return { valid: false };
  }

  // Hash the input password and compare
  const inputHash = await hashPassword(password);

  if (inputHash === storedHash) {
    return {
      valid: true,
      email: Deno.env.get("SUPERADMIN_EMAIL") || "admin@syamsa.local"
    };
  }

  return { valid: false };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse request body
    const { password }: AuthRequest = await req.json();

    if (!password) {
      const response: AuthResponse = { success: false, error: "Password required" };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify credentials
    const result = await verifySuperadmin(password);

    if (result.valid) {
      console.log("[superadmin-auth] Authentication successful");
      const response: AuthResponse = { success: true, email: result.email };
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      console.warn("[superadmin-auth] Authentication failed - invalid password");
      const response: AuthResponse = { success: false, error: "Invalid password" };
      return new Response(JSON.stringify(response), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("[superadmin-auth] Error:", error);
    const response: AuthResponse = { success: false, error: "Internal server error" };
    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
