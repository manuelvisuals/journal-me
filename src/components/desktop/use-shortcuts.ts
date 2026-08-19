"use client";

/**
 * Le scorciatoie desktop, registrate in UN solo posto (SPEC-v2 §5.4):
 *
 *   Cmd+S        salva la giornata senza AI
 *   Cmd+Invio    salva ed elabora con AI
 *   Cmd+K        palette comandi
 *   Cmd+Shift+F  modalita focus (solo su Oggi, dove esiste l'editor)
 *   Cmd+Shift+R  apre la registrazione
 *   Esc          gestito da chi lo possiede (palette, focus, overlay)
 *
 * Regole della spec rispettate qui:
 * - `event.isComposing` si salta (un utente che scrive in cinese non deve
 *   perdere caratteri);
 * - metaKey su Mac, ctrlKey altrove — mai tutti e due alla cieca;
 * - niente Cmd+1..5 (nel browser cambia scheda) e niente lettere nude
 *   (la colonna centrale e un editor sempre a fuoco);
 * - sotto lg le scorciatoie non esistono.
 *
 * Cmd+S/Cmd+Invio dentro l'editor li gestisce l'editor stesso (che ha il
 * testo) e fa preventDefault: qui si controlla `defaultPrevented` e non si
 * spara due volte. Fuori dal fuoco dell'editor, l'evento `jm:shortcut`
 * arriva comunque all'editor montato via CustomEvent.
 */

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toggleFocusMode } from "@/components/desktop/focus-toggle";
import {
  closePalette,
  togglePalette,
} from "@/components/desktop/command-palette";

export type EditorShortcut = "save" | "saveAI";

export const SHORTCUT_EVENT = "jm:shortcut";

function isMac(): boolean {
  return (
    typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
  );
}

export function useShortcuts(): void {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      // L'editor (o un altro campo) ha gia gestito e prevenuto: stop.
      if (e.defaultPrevented) return;
      if (!window.matchMedia("(min-width: 1024px)").matches) return;
      // Sulle pagine d'ingresso (layout bare) le scorciatoie non esistono.
      if (
        pathname.startsWith("/login") ||
        pathname.startsWith("/auth") ||
        pathname.startsWith("/benvenuto")
      ) {
        return;
      }

      const mod = isMac() ? e.metaKey : e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();

      if (e.shiftKey && key === "f") {
        e.preventDefault();
        if (pathname === "/") toggleFocusMode();
        return;
      }
      if (e.shiftKey && key === "r") {
        e.preventDefault();
        closePalette();
        router.push("/?record=1");
        return;
      }
      if (!e.shiftKey && key === "k") {
        e.preventDefault();
        togglePalette();
        return;
      }
      if (!e.shiftKey && key === "s") {
        // Sempre preventDefault: il salva-pagina del browser dentro
        // un'app e comunque un errore.
        e.preventDefault();
        window.dispatchEvent(
          new CustomEvent<EditorShortcut>(SHORTCUT_EVENT, { detail: "save" }),
        );
        return;
      }
      if (!e.shiftKey && e.key === "Enter") {
        window.dispatchEvent(
          new CustomEvent<EditorShortcut>(SHORTCUT_EVENT, { detail: "saveAI" }),
        );
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, pathname]);
}
