import { NextRequest, NextResponse } from "next/server";
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

/**
 * Server-side entitlement gate for the AI routes (SPEC-v2 §3.2).
 *
 * The client keeps its session in localStorage, not in cookies (see
 * src/lib/supabase/client.ts), so nothing user-related ever arrives here on
 * its own: every call must carry `Authorization: Bearer <access_token>`,
 * injected by apiFetch() in src/lib/api.ts. This helper verifies that token
 * with the service role and then reads the caller's plan from
 * public.profiles (migration 006).
 *
 * The service role client bypasses RLS: that is wanted (profiles has no
 * insert/update policy and only a "read own" select policy), and it never
 * leaves this module. SUPABASE_SERVICE_ROLE_KEY is a Vercel-only env var and
 * must never be prefixed NEXT_PUBLIC_.
 */

let admin: SupabaseClient | null = null;

function adminClient(url: string, serviceKey: string): SupabaseClient {
  if (admin) return admin;
  admin = createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

/**
 * Il client admin (service role), per chi — come il webhook Stripe — deve
 * scrivere su profiles scavalcando RLS. Ritorna null se le env mancano.
 * Non esce mai verso il browser.
 */
export function getAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return adminClient(url, serviceKey);
}

/**
 * Autenticazione senza requisito di piano (PR 11): il checkout lo apre un
 * utente GRATIS che sta comprando — chiedergli il premium sarebbe comico.
 *
 * Returns { userId, email } for any authenticated user, otherwise:
 *   401  missing or invalid bearer token
 *   500  server misconfigured (missing env)
 */
export async function requireUser(
  req: NextRequest,
): Promise<{ userId: string; email: string | null } | NextResponse> {
  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Entitlement not configured (missing Supabase env)" },
      { status: 500 },
    );
  }

  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ")
    ? header.slice("Bearer ".length).trim()
    : "";
  if (!token) {
    return NextResponse.json(
      { error: "Missing bearer token" },
      { status: 401 },
    );
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 },
    );
  }

  return { userId: data.user.id, email: data.user.email ?? null };
}

/**
 * Gate to run as the FIRST line of every /api route handler.
 *
 * Returns { userId } when the caller is an authenticated premium user,
 * otherwise a ready-made response:
 *   401  missing or invalid bearer token
 *   402  valid user, but plan !== 'premium'
 *   500  server misconfigured (missing env) or profiles unreadable
 *
 * Usage:
 *   const gate = await requirePremium(req);
 *   if (gate instanceof NextResponse) return gate;
 *   // gate.userId from here on
 */
export async function requirePremium(
  req: NextRequest,
): Promise<{ userId: string } | NextResponse> {
  const user = await requireUser(req);
  if (user instanceof NextResponse) return user;

  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Entitlement not configured (missing Supabase env)" },
      { status: 500 },
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("plan")
    .eq("user_id", user.userId)
    .maybeSingle();
  if (profileError) {
    // Most likely: migration 006 not applied yet. Surface it as a server
    // problem, not as "you are not premium".
    return NextResponse.json(
      { error: `Cannot read profile: ${profileError.message}` },
      { status: 500 },
    );
  }

  if (profile?.plan !== "premium") {
    return NextResponse.json({ error: "Premium required" }, { status: 402 });
  }

  return { userId: user.userId };
}
