"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isNative } from "@/lib/native/platform";

type LockState = "checking" | "locked" | "open";

/**
 * Face ID gate for the iOS shell.
 *
 * A diary is the one thing on a phone that should not be readable by whoever
 * picks it up unlocked. The gate runs on launch and again when the app comes
 * back from the background after RELOCK_AFTER_MS — a few seconds in another app
 * should not mean a Face ID prompt, an hour in a pocket should.
 *
 * On the web this renders its children untouched: there is no biometry to ask.
 * Device passcode is accepted as a fallback so a failed scan can never lock him
 * out of his own journal.
 */
const RELOCK_AFTER_MS = 3 * 60 * 1000;

export function BiometricLock({ children }: { children: React.ReactNode }) {
  const native = isNative();
  const [state, setState] = useState<LockState>(native ? "checking" : "open");
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
        reason: "Apri il tuo diario",
        cancelTitle: "Annulla",
        allowDeviceCredential: true,
        iosFallbackTitle: "Usa il codice",
      });
      setState("open");
    } catch {
      setState("locked");
    } finally {
      running.current = false;
    }
  }, []);

  useEffect(() => {
    if (!native) return;

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
        if (since !== null && Date.now() - since > RELOCK_AFTER_MS) {
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
  }, [native, unlock]);

  if (state === "open") return <>{children}</>;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-7">
      <p
        className="mb-2 text-[calc(22px*var(--jm-ui-scale))] font-semibold tracking-tight"
        style={{ letterSpacing: "-0.01em" }}
      >
        Journal
        <span
          className="text-accent"
          style={{ textShadow: "0 0 12px color-mix(in oklab, var(--color-glow) 55%, transparent)" }}
        >
          .
        </span>
        me
      </p>
      {state === "locked" && (
        <button
          onClick={() => {
            setState("checking");
            void unlock();
          }}
          className="mt-6 text-sm font-semibold text-accent"
        >
          Sblocca
        </button>
      )}
    </main>
  );
}
