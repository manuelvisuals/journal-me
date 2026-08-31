"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TabBar } from "@/components/ui/tab-bar";
import { signalReady } from "@/lib/app-ready";
import { isModuleActive } from "@/lib/modules";
import { useT } from "@/lib/i18n";

/**
 * /palestra — il modulo Palestra, primo passo.
 *
 * COSA C'E OGGI, detto senza giri di parole: la sezione esiste, si accende e
 * si spegne, prende il suo posto nella barra. Quello che ancora non c'e e il
 * contenuto: registrare serie e ripetizioni ha bisogno di un posto dove
 * salvarle, cioe della tabella dei fatti (src/modules/oggi/SPEC-fatti.md), che non e ancora
 * costruita.
 *
 * Questa schermata lo DICE, invece di far finta. Una sezione vuota che
 * promette con una grafica finta e il modo piu rapido per far perdere
 * fiducia a chi la apre due volte.
 *
 * Chi arriva qui con il modulo spento (un vecchio indirizzo, un segnalibro)
 * viene rimandato a Oggi: la sezione, per lui, non esiste.
 */
export default function PalestraPage() {
  const t = useT();
  const router = useRouter();

  useEffect(() => {
    if (!isModuleActive("palestra")) {
      router.replace("/app");
      return;
    }
    signalReady();
  }, [router]);

  return (
    <>
      <main className="jm-screen mx-auto flex w-full max-w-[440px] lg:max-w-none flex-1 flex-col">
        <header className="jm-col-head">
          {/* Sul telefono il nome e nella barra in alto; da lg resta qui. */}
          <h1 className="jm-st-h1 jm-solo-desktop">{t("Palestra")}</h1>
          <p className="jm-st-sub">
            {t("Allenamenti, serie e progressi.")}
          </p>
        </header>

        <div className="jm-mod-soon">
          <div className="jm-mod-soon-ic" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M6 7v10M18 7v10M4 9h4M16 9h4M8 12h8" />
            </svg>
          </div>
          <div className="jm-mod-soon-h">{t("La sezione c'e, il dentro no")}</div>
          <p className="jm-mod-soon-p">
            {t(
              "Registrare serie e ripetizioni ha bisogno di un posto dove salvarle, e quel posto lo sto costruendo. Intanto quello che racconti sulla palestra finisce comunque nella giornata, sotto Movimento.",
            )}
          </p>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => router.push("/app")}
          >
            {t("Torna a Oggi")}
          </button>
        </div>
      </main>
      <TabBar active="module" />
    </>
  );
}
