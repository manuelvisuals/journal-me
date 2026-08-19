"use client";

/**
 * Runtime dei temi lato client.
 *
 * Il boot script (src/themes/boot.ts) ha gia applicato tema e appearance
 * prima del primo paint; qui vivono gli hook React e i cambi a runtime.
 *
 * - Lettura di storage sincrono SOLO via useSyncExternalStore (trappola
 *   HANDOVER §7: niente useEffect + setState).
 * - Con appearance `system` il listener su matchMedia resta attivo per
 *   tutta la sessione: il Mac cambia da solo al tramonto e l'app deve
 *   seguirlo senza un reload.
 * - Persistenza: localStorage (l'unica che il boot puo leggere in modo
 *   sincrono) + user_settings sul cloud, best-effort (migration 007).
 */

import { useSyncExternalStore } from "react";
import {
  APPEARANCE_STORAGE_KEY,
  cssVarsFor,
  DEFAULT_APPEARANCE,
  DEFAULT_THEME_ID,
  THEME_STORAGE_KEY,
  type Appearance,
  type Mode,
} from "./contract";
import { themeById } from "./index";

type Listener = () => void;
const listeners = new Set<Listener>();

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

function readTheme(): string {
  if (typeof window === "undefined") return DEFAULT_THEME_ID;
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    return v && themeById(v).id === v ? v : DEFAULT_THEME_ID;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

function readAppearance(): Appearance {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE;
  try {
    const v = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function resolveMode(appearance: Appearance): Mode {
  if (appearance !== "system") return appearance;
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** Applica (tema, modo) a <html>: attributi, custom property, color-scheme, theme-color. */
function apply(themeId: string, mode: Mode): void {
  const theme = themeById(themeId);
  const el = document.documentElement;
  el.setAttribute("data-theme", theme.id);
  el.setAttribute("data-mode", mode);
  const vars = cssVarsFor(theme, mode);
  for (const [k, v] of Object.entries(vars)) {
    el.style.setProperty(k, v);
  }
  el.style.colorScheme = mode;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", vars["--jm-bg-app"]);
}

function applyCurrent(): void {
  apply(readTheme(), resolveMode(readAppearance()));
}

/* Il listener di sistema: attaccato una volta sola, al primo uso client. */
let systemListenerAttached = false;
function ensureSystemListener(): void {
  if (systemListenerAttached || typeof window === "undefined" || !window.matchMedia) {
    return;
  }
  systemListenerAttached = true;
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (readAppearance() === "system") {
      applyCurrent();
      emit();
    }
  };
  if (typeof mq.addEventListener === "function") {
    mq.addEventListener("change", onChange);
  }
}

/** Best-effort: salva la scelta anche su user_settings (cloud). */
function persistCloud(patch: { theme?: string; appearance?: Appearance }): void {
  void (async () => {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from("user_settings")
        .upsert({ user_id: user.id, ...patch }, { onConflict: "user_id" });
    } catch {
      // Migration 007 non applicata o rete assente: la copia in localStorage basta.
    }
  })();
}

export function setTheme(id: string): void {
  const valid = themeById(id).id;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, valid);
  } catch {
    // storage pieno o negato: il tema vale comunque per la sessione
  }
  applyCurrent();
  emit();
  persistCloud({ theme: valid });
}

export function setAppearance(a: Appearance): void {
  try {
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, a);
  } catch {
    // come sopra
  }
  applyCurrent();
  emit();
  persistCloud({ appearance: a });
}

export function useThemeId(): string {
  ensureSystemListener();
  return useSyncExternalStore(subscribe, readTheme, () => DEFAULT_THEME_ID);
}

export function useAppearance(): Appearance {
  ensureSystemListener();
  return useSyncExternalStore(subscribe, readAppearance, () => DEFAULT_APPEARANCE);
}

/** Il modo effettivo corrente (per anteprime e meta). */
export function useResolvedMode(): Mode {
  ensureSystemListener();
  return useSyncExternalStore(
    subscribe,
    () => resolveMode(readAppearance()),
    () => "dark",
  );
}
