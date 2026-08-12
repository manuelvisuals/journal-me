"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ensureEveningReminder } from "@/lib/native/reminders";

type AuthState = "unknown" | "in" | "out";

function isPublicPath(pathname: string): boolean {
  return pathname.startsWith("/login") || pathname.startsWith("/auth");
}

/**
 * Client-side auth guard.
 *
 * Replaces `src/proxy.ts` (the Next middleware), which cannot exist in a
 * statically exported bundle: inside the iOS shell there is no server to run
 * it. The rule it enforced is unchanged — no session means /login, a session
 * on /login means the app — it just runs in the app now.
 *
 * While the session is still being read from storage this renders nothing: the
 * splash is still on screen at that point, so there is no flash of the login
 * screen for an already-logged-in user.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<AuthState>("unknown");

  useEffect(() => {
    const supabase = createClient();
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (alive) setState(data.session ? "in" : "out");
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) setState(session ? "in" : "out");
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const publicPath = isPublicPath(pathname);

  // Ask for the notification permission once there is a session, never on the
  // login screen: a permission sheet in front of a stranger gets denied.
  useEffect(() => {
    if (state === "in") void ensureEveningReminder();
  }, [state]);

  useEffect(() => {
    if (state === "out" && !publicPath) {
      router.replace("/login");
    } else if (state === "in" && pathname === "/login") {
      router.replace("/");
    }
  }, [state, publicPath, pathname, router]);

  if (state === "unknown") return null;
  if (state === "out" && !publicPath) return null;

  return <>{children}</>;
}
