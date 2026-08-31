"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useStorageMode } from "@/lib/data/store";
import { ensureEveningReminder } from "@/lib/native/reminders";

type CloudAuth = "unknown" | "in" | "out";

function isPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/app/benvenuto") ||
    // Le pagine legali sono pubbliche per definizione: il sito le linka in
    // fondo e App Store Connect pretende un indirizzo che si apra senza
    // account. Prima non erano in questo elenco e chi arrivava su /privacy
    // senza sessione veniva rimbalzato al login, cioe la pagina piu
    // pubblica dell'app era l'unica che chiedeva le chiavi.
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/termini")
  );
}

/**
 * Client-side gate a TRE esiti (SPEC-v2 §7.1). Sostituiva src/proxy.ts (il
 * middleware Next), che non puo esistere in un bundle statico.
 *
 * 1. Modalita LOCALE: si entra, e il client Supabase non viene costruito
 *    affatto — un token scaduto in storage con autoRefreshToken genererebbe
 *    una richiesta di rete, e la promessa della modalita locale e
 *    "nemmeno una" (SPEC-v2 §1).
 * 2. Modalita CLOUD (o nessuna): il client esiste (import dinamico) e vale
 *    la regola di sempre — sessione = app, niente sessione = fuori.
 * 3. NIENTE: ne flag locale ne sessione -> /benvenuto, la scelta. /login
 *    resta raggiungibile dalla card premium.
 *
 * Mentre modalita e sessione si leggono, questo non renderizza nulla: la
 * splash e ancora sullo schermo, quindi nessun flash di schermate sbagliate.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const mode = useStorageMode();
  const [auth, setAuth] = useState<CloudAuth>("unknown");

  useEffect(() => {
    // Solo FUORI dalla modalita locale il client Supabase esiste. Anche con
    // esito "none" il listener serve: e cio che vede il login riuscito su
    // /login e fa entrare senza ricaricare.
    if (mode === "resolving" || mode === "local") return;
    let alive = true;
    let unsubscribe: (() => void) | null = null;

    void import("@/lib/supabase/client").then(({ createClient }) => {
      if (!alive) return;
      const supabase = createClient();

      supabase.auth.getSession().then(({ data }) => {
        if (alive) setAuth(data.session ? "in" : "out");
      });

      const { data: sub } = supabase.auth.onAuthStateChange(
        (_event, session) => {
          if (alive) setAuth(session ? "in" : "out");
        },
      );
      unsubscribe = () => sub.subscription.unsubscribe();
    });

    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, [mode]);

  const publicPath = isPublicPath(pathname);
  const entered = mode === "local" || auth === "in";
  const settledOut = mode !== "resolving" && mode !== "local" && auth === "out";

  // Ask for the notification permission once inside, never on the login
  // screen: a permission sheet in front of a stranger gets denied. Vale
  // anche in locale: le notifiche sono locali, zero rete.
  useEffect(() => {
    if (entered) void ensureEveningReminder();
  }, [entered]);

  useEffect(() => {
    if (settledOut && !publicPath) {
      // Dal 24 agosto 2026 la prima schermata e il LOGIN, non piu il bivio
      // (deciso da Manuel: "app si apre e c'e una schermata di login").
      // /benvenuto non sparisce: diventa cio che si vede DOPO l'accesso, e
      // la via senza account resta la riga in fondo al login, che c'era
      // gia — "Tienilo solo su questo dispositivo".
      router.replace("/login");
    } else if (auth === "in" && pathname === "/login") {
      // Chi ha gia una sessione non resta sul login. /benvenuto NON e piu
      // in questo elenco: adesso e la schermata post-accesso, quindi ci si
      // arriva PROPRIO con la sessione in tasca, e rimbalzarla a / la
      // renderebbe irraggiungibile. Ci pensa lei a portare dentro.
      // In modalita locale /login deve restare raggiungibile: e la strada
      // del "prova premium" (muro, PR 10) — rimbalzarlo a / era un vicolo
      // cieco. La migrazione locale->cloud vera e propria arriva con §7.2.
      router.replace("/app");
    }
  }, [settledOut, auth, publicPath, pathname, router]);

  if (mode === "resolving") return null;
  if (!entered && auth === "unknown" && !publicPath) return null;
  if (settledOut && !publicPath) return null;

  return <>{children}</>;
}
