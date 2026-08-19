"use client";

import { createPortal } from "react-dom";
import { useSyncExternalStore } from "react";

/**
 * Lo slot della rail destra (SPEC-v2 §5.2): ogni pagina rende
 * <RailRight>...</RailRight> col proprio contenuto, e il contenuto finisce
 * nella colonna di destra del guscio desktop via portal. Sotto lg la rail
 * non esiste (il target e hidden) e il contenuto non si vede.
 */

const TARGET_ID = "jm-rail-right";

function subscribeNoop(): () => void {
  return () => {};
}

export function RailRight({ children }: { children: React.ReactNode }) {
  // Mount flag senza setState-in-effect (pattern gia usato dall'overlay).
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  if (!mounted) return null;
  const target = document.getElementById(TARGET_ID);
  if (!target) return null;
  return createPortal(children, target);
}

export function RailRightTarget() {
  return <aside id={TARGET_ID} className="jm-rail-r" />;
}
