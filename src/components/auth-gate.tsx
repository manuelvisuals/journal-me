"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useStorageMode } from "@/lib/data/store";
import { ensureEveningReminder } from "@/lib/native/reminders";
import {
  ascoltaCassaforte,
  cancelloDaMostrare,
  erroreCassaforte,
  giornateChiuse,
  passaCancello,
  risolviCassaforte,
  segnaModalitaLocale,
  statoCassaforte,
} from "@/lib/cassaforte";
import { CassaforteCancello } from "@/modules/accesso";

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
  const [userId, setUserId] = useState<string | null>(null);
  const cassaforte = useSyncExternalStore(ascoltaCassaforte, statoCassaforte, () => "risolvendo" as const);
  // Il cancello resta a schermo finche la persona non lo passa: creare la
  // cassaforte la apre subito, ma le otto parole vanno viste e salvate
  // PRIMA di entrare (mockup 01: "Ho capito, continua").
  const cancello = useSyncExternalStore(ascoltaCassaforte, cancelloDaMostrare, () => null);

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
        if (!alive) return;
        setAuth(data.session ? "in" : "out");
        setUserId(data.session?.user?.id ?? null);
      });

      const { data: sub } = supabase.auth.onAuthStateChange(
        (_event, session) => {
          if (!alive) return;
          setAuth(session ? "in" : "out");
          setUserId(session?.user?.id ?? null);
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

  /*
   * LA CASSAFORTE (SPEC ospite-e-cassaforte R6-R8). Con la sessione cloud
   * in tasca si guarda se questo dispositivo ha la chiave del diario:
   * "aperta" -> dentro; "assente" (mai creata) o "chiusa" (creata altrove,
   * chiave non qui) -> il cancello del modulo accesso, che mostra le otto
   * parole o le chiede. In locale non c'e niente da chiudere: lo si dice
   * subito, cosi nessuno aspetta. Le pagine pubbliche (login, privacy)
   * non hanno bisogno della chiave.
   */
  useEffect(() => {
    if (mode === "local") {
      segnaModalitaLocale();
      return;
    }
    if (auth === "in" && userId) void risolviCassaforte(userId).catch(() => undefined);
  }, [mode, auth, userId]);
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

  if (mode !== "local" && auth === "in" && userId && !publicPath) {
    if (cassaforte === "risolvendo") return null;
    if (cassaforte === "errore") {
      // Il server della cassaforte non ha risposto (rete, o migration 021
      // non ancora applicata): si dice, e si riprova. Testo semplice e non
      // tradotto di proposito: e una schermata da manutenzione.
      return (
        <main className="min-h-screen flex flex-col items-center justify-center px-7 py-10 text-center">
          <p className="text-ink" style={{ maxWidth: "24rem", lineHeight: 1.5 }}>
            La cassaforte non risponde: {erroreCassaforte()}
          </p>
          <button
            type="button"
            className="btn-ghost mt-6"
            style={{ maxWidth: "16rem" }}
            onClick={() => void risolviCassaforte(userId)}
          >
            Riprova
          </button>
        </main>
      );
    }
    if (cancello) {
      return (
        <CassaforteCancello
          stato={cancello}
          userId={userId}
          giornate={giornateChiuse() ?? undefined}
          onAperta={() => {
            passaCancello();
            void risolviCassaforte(userId);
          }}
        />
      );
    }
  }

  return <>{children}</>;
}
