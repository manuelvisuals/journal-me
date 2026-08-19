"use client";

/**
 * Modalita focus (SPEC-v2 §5.5): spariscono le rail, l'header e il footer,
 * resta la colonna di testo e una scritta minuscola "esc per uscire".
 *
 * Lo stato vive in sessionStorage, NON in meta: e una preferenza del
 * momento, non una configurazione. Il lato visivo e tutto CSS: un
 * attributo `data-focus` su <html> (gia suppressHydrationWarning per il
 * boot dei temi) e le regole stanno nel blocco lg di globals.css — sotto
 * lg l'attributo non ha alcun effetto.
 *
 * Cmd+Shift+F arriva con la PR 8 (use-shortcuts); qui ci sono il bottone
 * e l'uscita con Esc.
 */

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const KEY = "jm.focus";

let focusOn = false;
let restored = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function applyDom(): void {
  if (typeof document === "undefined") return;
  if (focusOn) document.documentElement.setAttribute("data-focus", "1");
  else document.documentElement.removeAttribute("data-focus");
}

export function setFocusMode(on: boolean): void {
  focusOn = on;
  try {
    if (on) window.sessionStorage.setItem(KEY, "1");
    else window.sessionStorage.removeItem(KEY);
  } catch {
    // niente persistenza: vale comunque per la sessione corrente
  }
  applyDom();
  emit();
}

/** Ripristino da sessionStorage, una volta, DOPO il mount (niente side
 *  effect in render): un reload in focus riparte in focus. */
function restoreOnce(): void {
  if (restored) return;
  restored = true;
  let saved = false;
  try {
    saved = window.sessionStorage.getItem(KEY) === "1";
  } catch {
    saved = false;
  }
  if (saved) setFocusMode(true);
}

export function useFocusMode(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => focusOn,
    () => false,
  );
}

export function FocusToggle() {
  const on = useFocusMode();

  useEffect(() => {
    restoreOnce();
  }, []);

  // Esc esce dal focus (SPEC-v2 §5.4). Listener attivo solo quando serve.
  useEffect(() => {
    if (!on) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.isComposing) setFocusMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [on]);

  return (
    <>
      <button
        type="button"
        className="jm-focus-btn"
        aria-label={on ? "Esci dalla modalita focus" : "Modalita focus"}
        aria-pressed={on}
        onClick={() => setFocusMode(!on)}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          width="14"
          height="14"
          aria-hidden="true"
        >
          <path d="M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5" />
        </svg>
      </button>
      {/* La nota va in un portal su body: in focus l'header (dove vive il
          bottone) e display:none e si porterebbe dietro anche la nota. */}
      {on &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="jm-focus-note">esc per uscire</div>,
          document.body,
        )}
    </>
  );
}
