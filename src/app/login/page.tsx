"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

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
  const [guestLoading, setGuestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email = emailOverride !== null ? emailOverride : (savedEmail ?? "");
  const isReturning = savedEmail !== null;

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setLoading(true);
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

  /**
   * "App tour": entra senza email.
   *
   * Era un login sull'account condiviso `demo@journal.me` via /api/demo, con la
   * password in una env var. Quell'account non esiste nel database ricreato il
   * 12 agosto, da cui il "Demo non disponibile". Ora usa l'accesso anonimo di
   * Supabase: crea un utente vero, con un suo user_id, quindi le RLS valgono
   * come sempre e il trigger su auth.users semina i micro-obiettivi.
   *
   * Le giornate scritte cosi restano su quell'utente anonimo: entrare piu
   * tardi con l'email significa un altro account e un diario vuoto. Si puo
   * collegare l'email all'utente anonimo (updateUser) per non perdere niente,
   * ma non e ancora implementato.
   */
  async function enterAsGuest() {
    setError(null);
    setGuestLoading(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInAnonymously();
    if (authError) {
      setGuestLoading(false);
      setError(
        authError.message.toLowerCase().includes("disabled") ||
          authError.message.toLowerCase().includes("not enabled")
          ? "L'accesso rapido e disattivato sul progetto Supabase."
          : authError.message,
      );
      return;
    }
    router.replace("/");
  }

  async function verifyCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (code.length !== CODE_LENGTH) return;
    setError(null);
    setVerifying(true);
    const supabase = createClient();
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
    router.replace("/");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-7 py-10">
      <div className="w-full max-w-sm">
        <p
          className="text-center text-[22px] font-semibold mb-16 tracking-tight"
          style={{ letterSpacing: "-0.01em" }}
        >
          Journal
          <span
            className="text-accent"
            style={{ textShadow: "0 0 12px rgba(227,161,95,0.55)" }}
          >
            .
          </span>
          me
        </p>

        {sent ? (
          <>
            <h1
              className="text-center text-[32px] leading-[1.1] mb-3 text-ink"
              style={{ fontWeight: 650, letterSpacing: "-0.025em" }}
            >
              Il codice
            </h1>
            <p className="text-center text-sm text-ink-muted leading-[1.55] mb-9 px-3">
              Sei cifre inviate a{" "}
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
                  fontSize: 30,
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
                {verifying ? "Controllo..." : "Entra"}
              </Button>
              {error && (
                <p className="text-center text-[12px] text-danger mt-3">
                  {error}
                </p>
              )}
            </form>

            <p className="text-center text-[11px] text-ink-faint leading-[1.6] mt-7">
              Non arriva? Guarda nello spam, oppure{" "}
              <button
                onClick={() => void sendCode()}
                disabled={loading}
                className="text-accent font-semibold"
              >
                {loading ? "invio..." : "chiedine un altro"}
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
                Cambia email
              </button>
            </p>
          </>
        ) : (
          <>
            <h1
              className="text-center text-[32px] leading-[1.1] mb-3 text-ink"
              style={{ fontWeight: 650, letterSpacing: "-0.025em" }}
            >
              {isReturning ? "Bentornato" : "Benvenuto"}
            </h1>
            <p className="text-center text-sm text-ink-muted leading-[1.55] mb-11 px-3">
              {isReturning
                ? "Inserisci l'email che hai usato l'ultima volta: ti mando un codice."
                : "Inserisci la tua email. Ti mando un codice di sei cifre, niente password."}
            </p>
            <form onSubmit={sendCode}>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmailOverride(e.target.value)}
                placeholder="tu@dominio.com"
                className="input-base mb-3.5"
                disabled={loading}
                autoComplete="email"
                inputMode="email"
              />
              <Button type="submit" disabled={loading || !email}>
                {loading ? "Sto inviando..." : "Mandami il codice"}
              </Button>
              {error && (
                <p className="text-center text-[12px] text-danger mt-3">
                  {error}
                </p>
              )}
            </form>
            <div className="flex items-center gap-2.5 my-[22px]">
              <div
                className="flex-1 h-px"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,229,214,0.075), transparent)",
                }}
              ></div>
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-ink-faint">
                oppure
              </span>
              <div
                className="flex-1 h-px"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,229,214,0.075), transparent)",
                }}
              ></div>
            </div>
            <Button
              variant="ghost"
              onClick={() => void enterAsGuest()}
              disabled={guestLoading}
            >
              {guestLoading ? "Apertura..." : "App tour"}
              {!guestLoading && (
                <span
                  className="text-[9px] px-[7px] py-[3px] rounded-md text-accent"
                  style={{
                    background: "rgba(227,161,95,0.12)",
                    border: "1px solid rgba(227,161,95,0.20)",
                    letterSpacing: "0.10em",
                  }}
                >
                  DEMO
                </span>
              )}
            </Button>
            <p className="text-center text-[11px] text-ink-faint leading-[1.6] mt-7">
              Il codice vale un&apos;ora.
              <br />
              App tour: entri subito, senza email.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
