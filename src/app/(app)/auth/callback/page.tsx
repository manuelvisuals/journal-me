"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Magic-link landing.
 *
 * Was a server route handler that swapped the `?code=` for a session cookie.
 * The session now lives in the app's own storage, so the exchange has to
 * happen here, in the browser that holds the PKCE verifier — a server has no
 * way to finish a login it did not start.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const next = params.get("next") ?? "/app";

    if (!code) {
      router.replace("/login?error=auth_failed");
      return;
    }

    let alive = true;
    createClient()
      .auth.exchangeCodeForSession(code)
      .then(({ error }) => {
        if (!alive) return;
        if (error) {
          setFailed(true);
          router.replace("/login?error=auth_failed");
          return;
        }
        router.replace(next);
      });

    return () => {
      alive = false;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center px-7">
      <p className="text-sm text-ink-muted">
        {failed ? "Accesso non riuscito." : "Ti sto facendo entrare..."}
      </p>
    </main>
  );
}
