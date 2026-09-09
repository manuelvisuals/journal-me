"use client";

/**
 * Chi e "il revisore": l'account che Apple usa per provare l'app.
 *
 * Decisione di Manuel del 9 settembre 2026, guardando gli screenshot per
 * l'App Store: la linguetta Feedback sul bordo destro non deve comparire
 * sull'account di revisione (appreview@...). Non e un segreto: e il nome
 * dell'account demo, e sta gia nelle note di revisione. L'elenco vero delle
 * email di revisione vive sul server (JM_REVIEW_EMAILS, review-login.ts);
 * qui basta la forma dell'indirizzo, perche il dispositivo non deve
 * chiedere niente alla rete per saperlo: la sessione e gia in tasca.
 */

import { useEffect, useState } from "react";
import { useStorageMode } from "@/lib/data/store";

export function emailDiRevisione(email: string | null | undefined): boolean {
  return /^appreview@/i.test((email ?? "").trim());
}

/**
 * Vero quando la sessione in tasca e dell'account di revisione. Da ospite
 * (modalita locale) e sempre falso e non si tocca nessun client. Segue il
 * login e il logout senza ricaricare.
 */
export function useRevisore(): boolean {
  const mode = useStorageMode();
  const [revisore, setRevisore] = useState<boolean>(false);
  useEffect(() => {
    if (mode !== "cloud") return;
    let vivo = true;
    let stacca: (() => void) | null = null;
    void import("@/lib/supabase/client").then(({ createClient }) => {
      if (!vivo) return;
      const auth = createClient().auth;
      // getSession legge la copia locale: niente rete.
      void auth.getSession().then(({ data }) => {
        if (vivo) setRevisore(emailDiRevisione(data.session?.user?.email));
      });
      const { data } = auth.onAuthStateChange((_evento, sessione) => {
        if (vivo) setRevisore(emailDiRevisione(sessione?.user?.email));
      });
      stacca = () => data.subscription.unsubscribe();
    });
    return () => {
      vivo = false;
      stacca?.();
    };
  }, [mode]);
  // Da ospite non c'e nessun revisore, qualunque cosa dica lo stato: cosi
  // il valore torna falso al logout anche senza un setState nell'effetto.
  return mode === "cloud" && revisore;
}
