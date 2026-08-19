"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { resolveStorageMode } from "@/lib/data/store";
import { ensureEveningReminder } from "@/lib/native/reminders";

type AuthState = "unknown" | "in" | "out" | "local";

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
 *
 * La modalita si risolve PRIMA di toccare Supabase (SPEC-v2 §2.3): in
 * modalita locale il client non viene costruito affatto — un token scaduto
 * in storage con autoRefreshToken genererebbe una richiesta di rete, e la
 * promessa della modalita locale e "nemmeno una". Il terzo esito pieno
 * (nessuna modalita -> /benvenuto) arriva con la PR 5: oggi "none" continua
 * a comportarsi come "out" -> /login.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<AuthState>("unknown");

  useEffect(() => {
    let alive = true;
    let unsubscribe: (() => void) | null = null;

    void resolveStorageMode().then(async (mode) => {
      if (!alive) return;
      if (mode === "local") {
        setState("local");
        return;
      }
      // Solo nel ramo cloud il client Supabase esiste (import dinamico).
      const { createClient } = await import("@/lib/supabase/client");
      if (!alive) return;
      const supabase = createClient();

      supabase.auth.getSession().then(({ data }) => {
        if (alive) setState(data.session ? "in" : "out");
      });

      const { data: sub } = supabase.auth.onAuthStateChange(
        (_event, session) => {
          if (alive) setState(session ? "in" : "out");
        },
      );
      unsubscribe = () => sub.subscription.unsubscribe();
    });

    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, []);

  const publicPath = isPublicPath(pathname);

  // Ask for the notification permission once there is a session, never on the
  // login screen: a permission sheet in front of a stranger gets denied.
  // Vale anche in locale: le notifiche sono locali, zero rete.
  useEffect(() => {
    if (state === "in" || state === "local") void ensureEveningReminder();
  }, [state]);

  useEffect(() => {
    if (state === "out" && !publicPath) {
      router.replace("/login");
    } else if ((state === "in" || state === "local") && pathname === "/login") {
      router.replace("/");
    }
  }, [state, publicPath, pathname, router]);

  if (state === "unknown") return null;
  if (state === "out" && !publicPath) return null;

  return <>{children}</>;
}
