"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { chooseLocalMode, getStore } from "@/lib/data/store";
import { LocalStore } from "@/lib/data/store/local";
import { signalReady } from "@/lib/app-ready";
import {
  PREMIUM_HAS_FREE_TRIAL,
  PREMIUM_PRICE_AMOUNT,
  PREMIUM_PRICE_PERIOD,
} from "@/lib/pricing";

/**
 * /benvenuto — la scelta, al primo avvio (SPEC-v2 §7.1, mockup
 * due-modalita.html §01, adattato alla colonna telefono).
 *
 * Nessuna delle due modalita e presentata come "quella giusta": la gratis e
 * un prodotto finito, non una versione mutilata. La riga in fondo e quella
 * che copre legalmente, e sta QUI, non in un PDF che nessuno apre.
 */
export default function BenvenutoPage() {
  const router = useRouter();
  const [starting, setStarting] = useState<boolean>(false);

  const startLocal = async () => {
    if (starting) return;
    setStarting(true);
    chooseLocalMode();
    const store = getStore();
    if (store instanceof LocalStore) {
      // navigator.storage.persist() va chiesto DOPO un gesto dell'utente,
      // o il browser nega in silenzio (SPEC-v2 §2.5). Questo click lo e.
      await store.requestPersistence().catch(() => false);
      await store.setMeta("onboardingDone", true).catch(() => undefined);
    }
    router.replace("/");
  };

  // La splash aspetta il primo segnale di schermata pronta.
  useEffect(() => {
    signalReady();
  }, []);

  return (
    <main
      className="jm-benv mx-auto w-full max-w-[440px] flex-1"
      style={{ minHeight: "100dvh" }}
    >
      <h1 className="jm-benv-hero">
        Dove vuoi tenere
        <br />
        il tuo diario?
      </h1>
      <p className="jm-benv-sub">
        Puoi cambiare idea dopo. Quello che hai scritto viene con te.
      </p>

      <div className="jm-benv-cards">
        <div className="jm-benv-card">
          <div className="jm-benv-tag">Gratis, per sempre</div>
          <div className="jm-benv-t">Solo su questo dispositivo</div>
          <p className="jm-benv-p">
            Le tue giornate restano qui. Nessun account, nessun server, nessuno
            che possa leggerle. Nemmeno io.
          </p>
          <ul className="jm-benv-list">
            <li>Scrivi la giornata, quando vuoi</li>
            <li>Obiettivi, peso, sonno, umore</li>
            <li>Mese e Ricorda</li>
            <li>Backup su file, quando vuoi tu</li>
            <li className="no">Niente racconto a voce</li>
            <li className="no">Niente titoli, sintesi e recap AI</li>
            <li className="no">Un dispositivo solo</li>
          </ul>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => void startLocal()}
            disabled={starting}
          >
            {starting ? "preparo..." : "inizia cosi"}
          </button>
        </div>

        <div className="jm-benv-card pick">
          <div className="jm-benv-tag">Premium</div>
          <div className="jm-benv-t">Nel cloud, con l&apos;AI</div>
          <p className="jm-benv-p">
            Il diario ti segue ovunque. Racconti a voce e ci pensa lui a
            scriverlo, riassumerlo e ricordartelo.
          </p>
          <ul className="jm-benv-list">
            <li>Tutto quello della versione gratis</li>
            <li>Racconti a voce, si trascrive da solo</li>
            <li>Titolo, sintesi e macro-aree della giornata</li>
            <li>Recap mensili, semestrali, annuali</li>
            <li>Mac, iPhone, iPad sempre allineati</li>
          </ul>
          {/* Il prezzo viene da src/lib/pricing.ts, non da qui: era
              scritto a mano e prometteva anche "primo mese incluso", che
              nessuna parte del codice mantiene (il checkout Stripe non ha
              trial). Si dice cio che succede davvero. */}
          <div className="jm-benv-price">
            <b>{PREMIUM_PRICE_AMOUNT}</b> {PREMIUM_PRICE_PERIOD}
            {PREMIUM_HAS_FREE_TRIAL ? " . primo mese incluso" : ""}
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => router.push("/login")}
            disabled={starting}
          >
            prova premium
          </button>
        </div>
      </div>

      <p className="jm-benv-foot">
        Nella versione gratis nessun dato lascia il dispositivo: non c&apos;e
        un server a cui mandarli.
        <br />
        Nella versione premium le tue giornate vengono salvate cifrate e il
        testo passa dai modelli AI per essere riassunto. Puoi cancellare tutto
        in qualsiasi momento.
      </p>
    </main>
  );
}
