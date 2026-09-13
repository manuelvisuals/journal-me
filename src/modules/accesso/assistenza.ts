"use client";

/**
 * Dove porta la linguetta Feedback: l'assistenza del sito.
 *
 * PERCHE ESISTE QUESTO FILE (13 settembre 2026). La linguetta c'era in ogni
 * schermata dell'app ma non apriva niente: la sua destinazione si legge dal
 * pannello admin (la riga in fondo al messaggio di benvenuto) ed era vuota,
 * quindi era un bottone che non fa nulla. Manuel ha scelto di collegarla
 * alla pagina che esiste gia, dayalogue.com/support, portandosi dietro cio
 * che l'app sa gia di chi scrive (mockup MOCKUP-supporto-e-feedback.html,
 * opzione C).
 *
 * IL PANNELLO VINCE ANCORA. Se un giorno Manuel scrive un indirizzo li
 * dentro, quello batte questo: la linguetta e sempre stata "portami dove
 * dice il pannello", e questa e la destinazione di fabbrica, non una
 * sostituzione.
 *
 * DAL TELEFONO SI ESCE PER FORZA. Le pagine del sito NON stanno dentro il
 * pacchetto dell'app (si chiamano page.web.tsx apposta, per non finire
 * nella build iOS): dentro il guscio "/support" non esiste, quindi li
 * l'indirizzo deve essere quello intero e si apre il browser. Sul web,
 * dove il sito e la stessa origine, resta relativo e non si perde la
 * finestra.
 *
 * QUELLO CHE SI PORTA DIETRO non e un'identita e non prova niente: e un
 * campo in meno da riempire per chi sta gia scrivendo, e due righe in fondo
 * all'email che dicono da dove arriva. La pagina lo tratta come tale
 * (modules/sito/supporto-indirizzo.ts).
 */

import { useEffect, useState } from "react";
import { useStorageMode } from "@/lib/data/store";

// L'indirizzo vero e proprio sta in assistenza-url.ts: e codice puro, senza
// React e senza alias, cosi il banco lo prova senza montare niente.

/**
 * L'email della sessione in tasca, senza toccare la rete: getSession legge
 * la copia locale. Da ospite (modalita locale) resta null e non si monta
 * nessun client — la promessa "in locale non si fa rete" vale anche qui.
 */
export function useEmailInTasca(): string | null {
  const mode = useStorageMode();
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    if (mode !== "cloud") return;
    let vivo = true;
    let stacca: (() => void) | null = null;
    void import("@/lib/supabase/client").then(({ createClient }) => {
      if (!vivo) return;
      const auth = createClient().auth;
      void auth.getSession().then(({ data }) => {
        if (vivo) setEmail(data.session?.user?.email ?? null);
      });
      const { data } = auth.onAuthStateChange((_evento, sessione) => {
        if (vivo) setEmail(sessione?.user?.email ?? null);
      });
      stacca = () => data.subscription.unsubscribe();
    });
    return () => {
      vivo = false;
      stacca?.();
    };
  }, [mode]);
  // Da ospite non c'e nessuna email, qualunque cosa dica lo stato: cosi il
  // valore torna null al logout senza un setState nell'effetto.
  return mode === "cloud" ? email : null;
}

/**
 * "1.0 (10)": versione e numero di build del pacchetto iOS. Sul web non
 * esiste e resta vuota — li la versione e "quella di adesso", perche il
 * sito si aggiorna da solo a ogni deploy.
 */
export function useVersioneApp(): string {
  const [versione, setVersione] = useState("");
  useEffect(() => {
    let vivo = true;
    void import("@/lib/native/platform").then(({ isNative }) => {
      if (!vivo || !isNative()) return;
      void import("@capacitor/app")
        .then(({ App }) => App.getInfo())
        .then((info) => {
          if (vivo) setVersione(`${info.version} (${info.build})`);
        })
        .catch(() => {
          // Nessuna versione: l'email arrivera senza quella riga, che e
          // molto meglio di una linguetta che non si apre.
        });
    });
    return () => {
      vivo = false;
    };
  }, []);
  return versione;
}
