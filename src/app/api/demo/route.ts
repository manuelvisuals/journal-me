import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * "App tour" entry point. Signs the visitor into a single shared Supabase
 * account 'demo@journal.me'. All demo visitors share that account — they
 * see and edit the same data. Acceptable trade-off for an app tour with
 * no real user identity required.
 *
 * Required Vercel env vars:
 *   DEMO_USER_EMAIL    (defaults to "demo@journal.me")
 *   DEMO_USER_PASSWORD (the password set in Supabase Dashboard for the
 *                       demo user)
 */
const DEFAULT_DEMO_EMAIL = "demo@journal.me";

export async function POST() {
  const email = process.env.DEMO_USER_EMAIL ?? DEFAULT_DEMO_EMAIL;
  const password = process.env.DEMO_USER_PASSWORD;
  if (!password) {
    return NextResponse.json(
      { error: "DEMO_USER_PASSWORD not configured on the server" },
      { status: 500 },
    );
  }

  const supabase = await createClient();

  const {
    data: { user: existing },
  } = await supabase.auth.getUser();
  if (existing) {
    return NextResponse.json({ ok: true, already: true });
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    return NextResponse.json(
      { error: `Demo sign-in failed: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
