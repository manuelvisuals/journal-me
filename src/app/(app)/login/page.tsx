"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Marchio } from "@/components/brand/marchio";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { registraAccesso } from "@/lib/welcome";
import { clearLocalMode, getStore } from "@/lib/data/store";
import { segnaMigrazioneDaFare } from "@/lib/ospite/migrazione";
import {
  deveProporreFaceId,
  MAX_PROPOSTE_FACE_ID,
  provaEAttivaFaceId,
  registraRifiutoFaceId,
} from "@/lib/native/face-id";

const LAST_EMAIL_KEY = "journalme-last-email";
const CODE_LENGTH = 6;

function readLastEmail(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LAST_EMAIL_KEY);
}

function subscribeToLastEmail(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

/**
 * Login a codice numerico.
 *
 * Era un magic link: Supabase mandava una mail con un URL, l'URL apriva Safari,
 * Safari apriva l'app. Dentro un guscio nativo quella catena e fragile — e
 * appena il progetto Supabase e stato ricreato si e rotta subito, perche il
 * link portava a `localhost:3000` (il Site URL di default di un progetto nuovo).
 *
 * Il codice a sei cifre non ha URL, quindi non ha niente da configurare e
 * niente da rompere: la mail porta un numero, il numero si digita nell'app.
 * Perche arrivi un numero e non un link, i template mail del progetto Supabase
 * devono contenere `{{ .Token }}` — sia "Magic Link" sia "Confirm signup",
 * perche al primo accesso di un'email nuova Supabase usa il secondo.
 */
export default function LoginPage() {
  const t = useT();
  const savedEmail = useSyncExternalStore(
    subscribeToLastEmail,
    readLastEmail,
    () => null,
  );

  const router = useRouter();
  const [emailOverride, setEmailOverride] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  /**
   * Dove si va dopo un codice giusto. Al PRIMO accesso su questo
   * dispositivo si passa da /benvenuto — la schermata "gratis o premium",
   * che dal 24 agosto 2026 sta qui invece che prima del login. Poi la
   * scelta si RIPROPONE ogni dieci accessi ai gratis (Manuel, 27 agosto
   * 2026), salvo "non chiedermelo piu": tutta la regola vive in
   * src/lib/welcome.ts (registraAccesso). Ai premium ci pensa /benvenuto
   * stessa, che quando il piano risulta premium entra da sola.
   */
  /**
   * FACE ID, SOLO DOPO IL CODICE (1 settembre 2026, richiesta di Manuel).
   *
   * La proposta compare qui — a codice giusto, mai prima — e solo nel
   * guscio iOS con la biometria vera. Un si vale per sempre; un no la fa
   * ricomparire al prossimo codice, per tre volte; al terzo no un
   * messaggio dice che non lo chiederemo piu e indica le Impostazioni
   * (dove vive l'interruttore). Le regole stanno in
   * src/lib/native/face-id.ts.
   */
  const [faceIdFase, setFaceIdFase] = useState<null | "proposta" | "basta">(
    null,
  );
  const [faceIdBusy, setFaceIdBusy] = useState(false);

  /** Dopo un codice giusto: la proposta Face ID se tocca, altrimenti via. */
  async function dopoCodice() {
    if (await deveProporreFaceId()) {
      setFaceIdFase("proposta");
      return;
    }
    router.replace(afterLogin());
  }

  const faceIdSi = () => {
    if (faceIdBusy) return;
    setFaceIdBusy(true);
    void (async () => {
      // Il permesso di sistema e la prima scansione arrivano ADESSO, su un
      // gesto esplicito: mai piu il dialogo di iOS a freddo all'avvio.
      await provaEAttivaFaceId(t("Apri il tuo diario"));
      router.replace(afterLogin());
    })();
  };

  const faceIdNo = () => {
    if (faceIdBusy) return;
    if (registraRifiutoFaceId() >= MAX_PROPOSTE_FACE_ID) {
      setFaceIdFase("basta");
      return;
    }
    router.replace(afterLogin());
  };

  function afterLogin(): string {
    // L'ospite che mette l'email (mockup premium-senza-password, C1): le
    // giornate scritte sul telefono devono salire, e il braccialetto (con
    // il premium comprato senza email, se c'e) va legato all'account. Lo
    // fa il cancello (auth-gate) appena la cassaforte e aperta: qui si
    // lascia solo il promemoria.
    if (getStore().mode === "local") segnaMigrazioneDaFare();
    // La modalita e in cache in un modulo, non nell'indirizzo: senza questa
    // riga resterebbe "none" (com'era un istante fa, prima della sessione)
    // e /benvenuto crederebbe di stare PRIMA del login. Rileggerla e
    // l'unico modo di dirle che adesso c'e un account.
    clearLocalMode();
    return registraAccesso() ? "/app/benvenuto" : "/app";
  }

  /** "Non ora": la schermata non e un bivio (mockup premium-senza-password, D1). Si torna dov'eri. */
  const nonOra = () => {
    if (window.history.length > 1) router.back();
    else router.replace("/app");
  };
  const [error, setError] = useState<string | null>(null);
  // Accesso del revisore Apple (PIANO-APPSTORE §1c): se il server dice che
  // questa email e da revisione, il codice non viaggia via email — e quello
  // fisso delle Review Notes, verificato lato server.
  const [reviewMode, setReviewMode] = useState(false);

  const email = emailOverride !== null ? emailOverride : (savedEmail ?? "");
  const isReturning = savedEmail !== null;

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setLoading(true);
    // La porta del revisore: chiede al server se questa email e da
    // revisione. Per chiunque non lo sia la risposta e no e non cambia
    // niente; se la porta non e configurata, idem.
    try {
      const { apiFetch } = await import("@/lib/api");
      const probe = await apiFetch("/api/review-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (probe.ok) {
        const data = (await probe.json()) as { review?: boolean };
        if (data.review) {
          setReviewMode(true);
          setLoading(false);
          localStorage.setItem(LAST_EMAIL_KEY, email);
          setCode("");
          setSent(true);
          return;
        }
      }
    } catch {
      // La porta non risponde: si prosegue col flusso vero.
    }
    setReviewMode(false);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      // Nessun emailRedirectTo: non c'e nessun link da seguire.
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    localStorage.setItem(LAST_EMAIL_KEY, email);
    setCode("");
    setSent(true);
  }

  async function verifyCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (code.length !== CODE_LENGTH) return;
    setError(null);
    setVerifying(true);
    const supabase = createClient();
    if (reviewMode) {
      // Il codice fisso va al server, che se e giusto risponde con l'hash
      // di un magic link: lo scambio qui sotto produce una sessione IDENTICA
      // a una vera. Nessun percorso speciale dopo il login.
      try {
        const { apiFetch } = await import("@/lib/api");
        const resp = await apiFetch("/api/review-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code }),
        });
        if (!resp.ok) throw new Error("codice");
        const { tokenHash } = (await resp.json()) as { tokenHash: string };
        const { error: authError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "magiclink",
        });
        if (authError) throw new Error(authError.message);
        setVerifying(false);
        await dopoCodice();
        return;
      } catch {
        setVerifying(false);
        setError("Codice non valido. Ricontrolla le sei cifre.");
        return;
      }
    }
    // type "email" copre sia il primo accesso (signup) sia i successivi
    // (magiclink): e Supabase a sapere quale token ha emesso.
    const { error: authError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    setVerifying(false);
    if (authError) {
      setError(
        authError.message.toLowerCase().includes("expired")
          ? "Codice scaduto. Chiedine uno nuovo."
          : "Codice non valido. Ricontrolla le sei cifre.",
      );
      return;
    }
    await dopoCodice();
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-7 py-10">
      <div className="w-full max-w-sm">
        <p className="text-center mb-16">
          <Marchio className="jm-marchio-22" />
        </p>

        {faceIdFase !== null ? (
          <>
            {/* La proposta e il congedo parlano la lingua del login: titolo
                grande, una riga di spiegazione, un bottone pieno e uno
                fantasma. Tutto a token (theme-aware) e tutto via t()
                (bilingue). */}
            <h1
              className="text-center text-[calc(32px*var(--jm-ui-scale))] leading-[1.1] mb-3 text-ink"
              style={{ fontWeight: 650, letterSpacing: "-0.025em" }}
            >
              {faceIdFase === "proposta"
                ? t("Vuoi usare Face ID?")
                : t("Non te lo chiederemo piu")}
            </h1>
            <p className="text-center text-sm text-ink-muted leading-[1.55] mb-9 px-3">
              {faceIdFase === "proposta"
                ? t(
                    "Il diario si apre col tuo volto, senza codice. Puoi cambiare idea quando vuoi dalle Impostazioni.",
                  )
                : t(
                    "Se vuoi attivare Face ID, basta farlo dalle Impostazioni.",
                  )}
            </p>
            {faceIdFase === "proposta" ? (
              <>
                <Button onClick={faceIdSi} disabled={faceIdBusy}>
                  {faceIdBusy ? t("Un attimo...") : t("Attiva Face ID")}
                </Button>
                <div className="mt-3">
                  <Button variant="ghost" onClick={faceIdNo} disabled={faceIdBusy}>
                    {t("Non ora")}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Button
                  onClick={() => router.replace(afterLogin())}
                  disabled={faceIdBusy}
                >
                  {t("Capito")}
                </Button>
                <div className="mt-3">
                  <Button variant="ghost" onClick={faceIdSi} disabled={faceIdBusy}>
                    {faceIdBusy ? t("Un attimo...") : t("Attivalo ora")}
                  </Button>
                </div>
              </>
            )}
          </>
        ) : sent ? (
          <>
            <h1
              className="text-center text-[calc(32px*var(--jm-ui-scale))] leading-[1.1] mb-3 text-ink"
              style={{ fontWeight: 650, letterSpacing: "-0.025em" }}
            >
              {t("Il codice")}
            </h1>
            <p className="text-center text-sm text-ink-muted leading-[1.55] mb-9 px-3">
              {t("Sei cifre inviate a")}{" "}
              <span className="text-accent font-semibold">{email}</span>.
            </p>

            <form onSubmit={verifyCode}>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={CODE_LENGTH}
                value={code}
                onChange={(e) => {
                  setError(null);
                  setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH));
                }}
                placeholder="000000"
                autoFocus
                className="input-base mb-3.5"
                style={{
                  textAlign: "center",
                  fontSize: "calc(30px * var(--jm-ui-scale))",
                  fontWeight: 600,
                  letterSpacing: "0.34em",
                  textIndent: "0.34em",
                  fontFamily:
                    "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
                }}
                disabled={verifying}
              />
              <Button
                type="submit"
                disabled={verifying || code.length !== CODE_LENGTH}
              >
                {verifying ? t("Controllo...") : t("Entra")}
              </Button>
              {error && (
                <p className="text-center text-[calc(12px*var(--jm-ui-scale))] text-danger mt-3">
                  {error}
                </p>
              )}
            </form>

            <p className="text-center text-[calc(11px*var(--jm-ui-scale))] text-ink-faint leading-[1.6] mt-7">
              {t("Non arriva? Guarda nello spam, oppure")}{" "}
              <button
                onClick={() => void sendCode()}
                disabled={loading}
                className="text-accent font-semibold"
              >
                {loading ? t("invio...") : t("chiedine un altro")}
              </button>
              .
              <br />
              <button
                onClick={() => {
                  setSent(false);
                  setCode("");
                  setError(null);
                }}
                className="text-accent font-semibold mt-1"
              >
                {t("Cambia email")}
              </button>
            </p>
          </>
        ) : (
          <>
            <h1
              className="text-center text-[calc(32px*var(--jm-ui-scale))] leading-[1.1] mb-3 text-ink"
              style={{ fontWeight: 650, letterSpacing: "-0.025em" }}
            >
              {isReturning ? t("Bentornato") : t("Le tue giornate, anche altrove.")}
            </h1>
            <p className="text-center text-sm text-ink-muted leading-[1.55] mb-11 px-3">
              {isReturning
                ? t(
                    "Inserisci l'email che hai usato l'ultima volta: ti mando un codice.",
                  )
                : t(
                    "Metti una email: le giornate salgono chiuse a chiave ogni notte e le ritrovi su iPad e sul computer. Ti mando un codice di sei cifre. Mai una password.",
                  )}
            </p>
            <form onSubmit={sendCode}>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmailOverride(e.target.value)}
                placeholder={t("tu@dominio.com")}
                className="input-base mb-3.5"
                disabled={loading}
                autoComplete="email"
                inputMode="email"
              />
              <Button type="submit" disabled={loading || !email}>
                {loading ? t("Sto inviando...") : t("Mandami il codice")}
              </Button>
              {error && (
                <p className="text-center text-[calc(12px*var(--jm-ui-scale))] text-danger mt-3">
                  {error}
                </p>
              )}
            </form>
            <div className="mt-3">
              <Button variant="ghost" onClick={nonOra} disabled={loading}>
                {t("Non ora")}
              </Button>
            </div>
            <p className="text-center text-[calc(11px*var(--jm-ui-scale))] text-ink-faint leading-[1.6] mt-7">
              {t("Il codice vale un'ora.")}
              <br />
              {t("Le giornate che hai gia scritto qui restano, e salgono al primo accesso.")}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
