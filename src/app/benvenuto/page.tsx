"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { chooseLocalMode, getStore, useStorageMode } from "@/lib/data/store";
import { LocalStore } from "@/lib/data/store/local";
import { signalReady } from "@/lib/app-ready";
import {
  PREMIUM_HAS_FREE_TRIAL,
  PREMIUM_PRICE_AMOUNT,
  PREMIUM_PRICE_PERIOD,
} from "@/lib/pricing";
import { useT } from "@/lib/i18n";
import { isNative } from "@/lib/native/platform";
import { haChiestoSilenzio, markWelcomeSeen, nonChiederePiu } from "@/lib/welcome";
import { usePianoNoto } from "@/lib/plan";
import { openPremiumWall, startPremiumV1 } from "@/modules/abbonamento";
import { toast } from "@/components/ui/toast";

/**
 * /benvenuto — la scelta, al primo avvio (SPEC-v2 §7.1, mockup
 * due-modalita.html §01, adattato alla colonna telefono).
 *
 * Nessuna delle due modalita e presentata come "quella giusta": la gratis e
 * un prodotto finito, non una versione mutilata. La riga in fondo e quella
 * che copre legalmente, e sta QUI, non in un PDF che nessuno apre.
 */
export default function BenvenutoPage() {
  const t = useT();
  const router = useRouter();
  const [starting, setStarting] = useState<boolean>(false);
  // Dal 24 agosto 2026 questa schermata si vede DOPO il login, non prima:
  // arrivandoci con una sessione cloud in tasca, "gratis" non vuol piu dire
  // "niente account" ma "piano free", e i due bottoni devono portare
  // dentro invece che al bivio. Chi ci capita senza sessione (un vecchio
  // segnalibro) trova il comportamento di sempre.
  const mode = useStorageMode();
  const postLogin = mode === "cloud";
  // La modalita si risolve in un istante ma non a render zero: finche non
  // si sa, i bottoni non partono. Un click in quel millisecondo sceglierebbe
  // la modalita locale a un utente che ha appena fatto l'accesso.
  const waiting = mode === "resolving";
  // Dentro il guscio iOS non si mostrano prezzi ne inviti a comprare
  // (App Store 3.1.1): la pagina resta questa, parola per parola.
  // Sparisce la riga del prezzo, e il bottone della card Premium diventa
  // "inizia premium" (v1 gratis, deciso da Manuel il 27 agosto: vedi
  // PREMIUM_IOS_V1_GRATIS in src/lib/pricing.ts).
  const native = isNative();

  const enter = () => {
    markWelcomeSeen();
    router.replace("/");
  };

  // Ai premium questa domanda non si fa MAI (Manuel, 27 agosto 2026): un
  // abbonato che rientra non deve scegliere niente. Il piano pero al login
  // non e ancora noto, quindi il filtro sta qui: appena risulta premium si
  // entra da soli. usePianoNoto e senza ottimismo di proposito — con
  // usePlan ("premium finche non si sa") entrerebbero da soli TUTTI.
  const pianoNoto = usePianoNoto();
  useEffect(() => {
    if (postLogin && pianoNoto === "premium") {
      markWelcomeSeen();
      router.replace("/");
    }
    // router e stabile; enter() inline per non dipendere da una closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postLogin, pianoNoto]);

  // "Non chiedermelo piu" (solo post-login): la scelta resta scritta sul
  // dispositivo e la schermata non torna piu ogni dieci accessi.
  const [stopScelto, setStopScelto] = useState<boolean>(() => haChiestoSilenzio());

  // La card Premium dentro il guscio iOS (v1): il tasto c'e di nuovo, dice
  // solo "inizia premium" (niente prezzo,
  // niente lessico da acquisto — App Store 3.1.1) e attiva il premium
  // DAVVERO, gratis, via startPremiumV1. La decisione e il percorso di
  // upgrade al pagamento vero sono scritti in un punto solo:
  // PREMIUM_IOS_V1_GRATIS in src/lib/pricing.ts.
  const [premiumBusy, setPremiumBusy] = useState<boolean>(false);
  const startPremiumIos = async () => {
    if (premiumBusy) return;
    setPremiumBusy(true);
    const ok = await startPremiumV1();
    if (ok) {
      markWelcomeSeen();
      router.replace("/");
      return;
    }
    toast.error(t("Non sono riuscito ad attivare il premium. Riprova."));
    setPremiumBusy(false);
  };

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
      className="jm-screen jm-benv mx-auto w-full max-w-[440px] flex-1"
    >
      {/* Titolo su due righe: dove spezzare lo decide la traduzione. */}
      <h1 className="jm-benv-hero" style={{ whiteSpace: "pre-line" }}>
        {t("Dove vuoi tenere\nil tuo diario?")}
      </h1>
      <p className="jm-benv-sub">
        {t("Puoi cambiare idea dopo. Quello che hai scritto viene con te.")}
      </p>

      <div className="jm-benv-cards">
        <div className="jm-benv-card">
          <div className="jm-benv-tag">{t("Gratis, per sempre")}</div>
          <div className="jm-benv-t">{t("Solo su questo dispositivo")}</div>
          <p className="jm-benv-p">
            {t(
              "Le tue giornate restano qui. Nessun account, nessun server, nessuno che possa leggerle. Nemmeno io.",
            )}
          </p>
          <ul className="jm-benv-list">
            <li>{t("Scrivi la giornata, quando vuoi")}</li>
            <li>{t("Obiettivi, peso, sonno, umore")}</li>
            <li>{t("Mese e Ricorda")}</li>
            <li>{t("Backup su file, quando vuoi tu")}</li>
            <li className="no">{t("Niente racconto a voce")}</li>
            <li className="no">{t("Niente titoli, sintesi e recap AI")}</li>
            <li className="no">{t("Un dispositivo solo")}</li>
          </ul>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => (postLogin ? enter() : void startLocal())}
            disabled={starting || waiting}
          >
            {starting ? t("preparo...") : t("inizia gratis")}
          </button>
        </div>

        <div className="jm-benv-card pick">
          <div className="jm-benv-tag">{t("Premium")}</div>
          <div className="jm-benv-t">{t("Nel cloud, con l'AI")}</div>
          <p className="jm-benv-p">
            {t(
              "Il diario ti segue ovunque. Racconti a voce e ci pensa lui a scriverlo, riassumerlo e ricordartelo.",
            )}
          </p>
          <ul className="jm-benv-list">
            <li>{t("Tutto quello della versione gratis")}</li>
            <li>{t("Racconti a voce, si trascrive da solo")}</li>
            <li>{t("Titolo, sintesi e macro-aree della giornata")}</li>
            <li>{t("Recap mensili, semestrali, annuali")}</li>
            <li>{t("Mac, iPhone, iPad sempre allineati")}</li>
          </ul>
          {/* Il prezzo viene da src/lib/pricing.ts, non da qui: era
              scritto a mano e prometteva anche "primo mese incluso", che
              nessuna parte del codice mantiene (il checkout Stripe non ha
              trial). Si dice cio che succede davvero. */}
          {!native && (
            <div className="jm-benv-price">
              <b>{PREMIUM_PRICE_AMOUNT}</b> {PREMIUM_PRICE_PERIOD}
              {PREMIUM_HAS_FREE_TRIAL ? ` . ${t("primo mese incluso")}` : ""}
            </div>
          )}
          {native ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                if (!postLogin) {
                  router.push("/login");
                  return;
                }
                void startPremiumIos();
              }}
              disabled={starting || waiting || premiumBusy}
            >
              {premiumBusy ? t("un attimo...") : t("inizia premium")}
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                if (!postLogin) {
                  router.push("/login");
                  return;
                }
                // Post-login il muro sa gia dove mandare: Stripe se
                // configurato, il pagamento simulato in prova. Qui non si
                // duplica quella decisione, la si chiama.
                markWelcomeSeen();
                openPremiumWall("aiSummary");
              }}
              disabled={starting || waiting}
            >
              {t("prova premium")}
            </button>
          )}
        </div>
      </div>

      {/* "Non chiedermelo piu" (Manuel, 27 agosto 2026): la scelta torna
          ogni dieci accessi ai gratis, e questa spunta la spegne per
          sempre. Alla spunta si risponde con una porta aperta, non con un
          addio: premium resta a un tocco dalle Impostazioni. */}
      {postLogin && (
        <div className="jm-benv-stop-wrap">
          <label className="jm-benv-stop">
            <input
              type="checkbox"
              checked={stopScelto}
              onChange={(e) => {
                setStopScelto(e.target.checked);
                nonChiederePiu(e.target.checked);
              }}
            />
            <span>{t("Non chiedermelo piu")}</span>
          </label>
          {stopScelto && (
            <p className="jm-benv-stop-nota">
              {t(
                "Va bene. Quando vorrai passare a premium, potrai farlo dalle Impostazioni.",
              )}
            </p>
          )}
        </div>
      )}

      {/* La didascalia dice la verita del CONTESTO in cui la leggi (Manuel,
          27 agosto 2026). Prima del login "gratis" vuol dire "solo su questo
          dispositivo" e la vecchia frase e esatta. DOPO il login "gratis" e
          il piano free di un account cloud: dire "nessun dato lascia il
          dispositivo" li sarebbe falso. */}
      <p className="jm-benv-foot">
        {postLogin
          ? t(
              "Nella versione gratis scrivi a mano: niente racconto a voce e niente AI.",
            )
          : t(
              "Nella versione gratis nessun dato lascia il dispositivo: non c'e un server a cui mandarli.",
            )}
        <br />
        {t(
          "Nella versione premium le tue giornate vengono salvate cifrate e il testo passa dai modelli AI per essere riassunto. Puoi cancellare tutto in qualsiasi momento.",
        )}
      </p>
    </main>
  );
}
