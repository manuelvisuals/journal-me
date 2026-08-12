"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { apiUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";

const LAST_EMAIL_KEY = "journalme-last-email";

function readLastEmail(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LAST_EMAIL_KEY);
}

function subscribeToLastEmail(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export default function LoginPage() {
  const savedEmail = useSyncExternalStore(
    subscribeToLastEmail,
    readLastEmail,
    () => null,
  );

  const router = useRouter();
  const [emailOverride, setEmailOverride] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email = emailOverride !== null ? emailOverride : (savedEmail ?? "");
  const isReturning = savedEmail !== null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    localStorage.setItem(LAST_EMAIL_KEY, email);
    setSent(true);
  }

  async function handleDemo() {
    setDemoLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/demo"), { method: "POST" });
      if (!res.ok) throw new Error("Demo non disponibile");
      router.push("/");
      router.refresh();
    } catch (e) {
      setDemoLoading(false);
      setError(e instanceof Error ? e.message : "Errore demo");
    }
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
            <div
              className="w-[72px] h-[72px] mx-auto mb-8 rounded-full flex items-center justify-center bg-surface"
              style={{
                border: "1px solid rgba(227,161,95,0.55)",
                boxShadow:
                  "0 0 28px rgba(227,161,95,0.20), inset 0 1px 0 rgba(255,255,255,0.05)",
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="#E3A15F"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="30"
                height="30"
              >
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <h1
              className="text-center text-[32px] leading-[1.1] mb-3 text-ink"
              style={{ fontWeight: 650, letterSpacing: "-0.025em" }}
            >
              Controlla la mail
            </h1>
            <p className="text-center text-sm text-ink-muted leading-[1.55] mb-11 px-3">
              Link inviato a{" "}
              <span className="text-accent font-semibold">{email}</span>. Aprilo
              dall&apos;iPhone per entrare.
            </p>
            <p className="text-center text-[11px] text-ink-faint leading-[1.6]">
              Non ti arriva? Guarda nello spam
              <br />
              oppure{" "}
              <button
                onClick={() => {
                  setSent(false);
                  setError(null);
                }}
                className="text-accent font-semibold"
              >
                prova un&apos;altra email
              </button>
              .
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
                ? "Inserisci l'email che hai usato l'ultima volta."
                : "Inserisci la tua email. Ti mando un link di accesso istantaneo, niente password."}
            </p>
            <form onSubmit={handleSubmit}>
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
                {loading ? "Sto inviando..." : "Mandami il link"}
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
              onClick={handleDemo}
              disabled={demoLoading}
            >
              {demoLoading ? "Apertura..." : "App tour"}
              {!demoLoading && (
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
              Link valido 10 minuti.
              <br />
              Demo: entri subito senza account.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
