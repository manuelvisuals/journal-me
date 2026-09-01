"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Marchio } from "@/components/brand/marchio";
import { isNative } from "@/lib/native/platform";
import { faceIdAttivo } from "@/lib/native/face-id";
import { useT } from "@/lib/i18n";

type LockState = "checking" | "locked" | "open";

/**
 * Face ID gate for the iOS shell.
 *
 * A diary is the one thing on a phone that should not be readable by whoever
 * picks it up unlocked. The gate runs on launch and again when the app comes
 * back from the background after RELOCK_AFTER_MS — a few seconds in another app
 * should not mean a Face ID prompt, an hour in a pocket should.
 *
 * DAL 1 SETTEMBRE 2026 il lucchetto e OPT-IN (richiesta di Manuel): si
 * accende solo se Face ID e stato attivato — dalla proposta che compare dopo
 * il codice a sei cifre, o dall'interruttore nelle Impostazioni
 * (src/lib/native/face-id.ts). Prima chiedeva il volto al primo avvio, prima
 * ancora del login: la richiesta di permesso iOS compariva a uno sconosciuto.
 *
 * On the web this renders its children untouched: there is no biometry to ask.
 * Device passcode is accepted as a fallback so a failed scan can never lock him
 * out of his own journal.
 */
const RELOCK_AFTER_MS = 3 * 60 * 1000;

export function BiometricLock({ children }: { children: React.ReactNode }) {
  const t = useT();
  // Letta UNA volta al montaggio: accendere l'interruttore non blinda l'app
  // sotto i piedi di chi la sta gia usando — vale dal prossimo avvio.
  const [armato] = useState<boolean>(() => isNative() && faceIdAttivo());
  const [state, setState] = useState<LockState>(armato ? "checking" : "open");
  const backgroundedAt = useRef<number | null>(null);
  const running = useRef(false);

  const unlock = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      const { BiometricAuth } = await import(
        "@aparajita/capacitor-biometric-auth"
      );
      const info = await BiometricAuth.checkBiometry();
      // No Face ID enrolled and no passcode set: locking would be a door with
      // no key. Let him in rather than bricking the app.
      if (!info.isAvailable && !info.deviceIsSecure) {
        setState("open");
        return;
      }
      await BiometricAuth.authenticate({
        reason: t("Apri il tuo diario"),
        cancelTitle: t("Annulla"),
        allowDeviceCredential: true,
        iosFallbackTitle: t("Usa il codice"),
      });
      setState("open");
    } catch {
      setState("locked");
    } finally {
      running.current = false;
    }
  }, [t]);

  useEffect(() => {
    if (!armato) return;

    // Deferred by a tick on purpose: kicking the Face ID sheet off inside the
    // effect body makes React re-render mid-commit (and the lint rule that
    // catches cascading renders is right to complain).
    const kickoff = setTimeout(() => void unlock(), 0);

    let remove: (() => void) | undefined;
    (async () => {
      const { App } = await import("@capacitor/app");
      const handle = await App.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) {
          backgroundedAt.current = Date.now();
          return;
        }
        const since = backgroundedAt.current;
        backgroundedAt.current = null;
        // Il rientro dal background richiude solo se Face ID e ANCORA
        // attivo: l'interruttore delle Impostazioni vale subito, qui.
        if (
          since !== null &&
          Date.now() - since > RELOCK_AFTER_MS &&
          faceIdAttivo()
        ) {
          setState("checking");
          void unlock();
        }
      });
      remove = () => {
        void handle.remove();
      };
    })();

    return () => {
      clearTimeout(kickoff);
      remove?.();
    };
  }, [armato, unlock]);

  if (state === "open") return <>{children}</>;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-7">
      <p className="mb-2">
        <Marchio className="jm-marchio-22" />
      </p>
      {state === "locked" && (
        <button
          onClick={() => {
            setState("checking");
            void unlock();
          }}
          className="mt-6 text-sm font-semibold text-accent"
        >
          {t("Sblocca")}
        </button>
      )}
    </main>
  );
}
