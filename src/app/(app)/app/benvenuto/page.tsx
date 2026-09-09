"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { chooseLocalMode, getStore, useStorageMode } from "@/lib/data/store";
import { LocalStore } from "@/lib/data/store/local";
import { signalReady } from "@/lib/app-ready";
import {
  PREMIUM_PRICE_AMOUNT,
  PREMIUM_PRICE_PERIOD,
} from "@/lib/pricing";
import { useT } from "@/lib/i18n";
import { isNative } from "@/lib/native/platform";
import { haChiestoSilenzio, markWelcomeSeen, nonChiederePiu } from "@/lib/welcome";
import { usePianoNoto } from "@/lib/plan";
import { openPremiumWall, prodottiInTasca, prodottiPremium } from "@/modules/abbonamento";
import type { ProdottoNegozio } from "@/modules/abbonamento";
import { FoglioDifferenze } from "@/modules/accesso";

/**
 * /benvenuto — la scelta, al primo avvio (SPEC-v2 §7.1).
 *
 * IL BIVIO CORTO (Manuel, 9 settembre 2026). Prima qui c'erano due card da
 * nove righe l'una: diciotto righe da leggere prima di aver scritto una
 * parola, e quattro di quelle righe erano identiche nelle due card. Adesso
 * ogni parte dice TRE righe — non le prime tre dell'elenco, le tre che
 * fanno la differenza — e chi vuole il confronto completo apre il foglio
 * "Vedi tutte le differenze" (modulo accesso). La schermata ha un lavoro
 * solo: far scegliere dove tenere il diario. Confrontare e un altro lavoro,
 * e chi lo vuole lo chiede.
 *
 * I DUE TASTI. Dicevano tutti e due "gratis" ("prova premium" contro
 * "inizia gratis, solo su questo telefono") e si annullavano a vicenda.
 * Adesso hanno lo stesso verbo e la differenza sta in due parole: con
 * premium, senza account. La parola "gratis" compare una volta sola, nella
 * riga sotto il tasto, che e il posto dove si parla di soldi.
 *
 * LA PROVA GRATIS LA DICE APPLE, NON QUESTA PAGINA. I 14 giorni sono un
 * "introductory offer" e Apple li concede UNA VOLTA SOLA per Apple ID: un
 * tasto che promette la prova a tutti mente a chi l'ha gia usata. Quindi la
 * riga sotto il tasto si scrive con quello che StoreKit dice di QUESTA
 * persona (prezzo gia nella sua valuta, prova solo se `provaDisponibile`).
 * Sul web non si vende e non esiste nessuna prova: li la riga dice il
 * prezzo e basta.
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
  const native = isNative();

  const enter = () => {
    markWelcomeSeen();
    router.replace("/app");
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
      router.replace("/app");
    }
    // router e stabile; enter() inline per non dipendere da una closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postLogin, pianoNoto]);

  // "Non chiedermelo piu" (solo post-login): la scelta resta scritta sul
  // dispositivo e la schermata non torna piu ogni dieci accessi.
  const [stopScelto, setStopScelto] = useState<boolean>(() => haChiestoSilenzio());

  /** Il foglio con tutte e nove le differenze. Chiuso finche non lo chiedono. */
  const [differenze, setDifferenze] = useState<boolean>(false);

  /**
   * Il mensile come lo descrive Apple. `null` = non ancora arrivato (o web,
   * dove il negozio non esiste): la riga sotto il tasto allora si scrive
   * con le costanti di pricing.ts. La cache e gia calda se il guscio ha
   * fatto precaricaProdotti() all'avvio, e in quel caso non c'e nessuna
   * attesa.
   */
  const [offerta, setOfferta] = useState<ProdottoNegozio | null>(() =>
    typeof window === "undefined" ? null : (prodottiInTasca(false)?.[0] ?? null),
  );
  useEffect(() => {
    if (offerta) return;
    let vivo = true;
    void prodottiPremium(false).then((lista) => {
      if (vivo && lista[0]) setOfferta(lista[0]);
    });
    return () => {
      vivo = false;
    };
  }, [offerta]);

  const prova =
    offerta && offerta.provaGiorni && offerta.provaDisponibile !== false ? offerta.provaGiorni : 0;
  const prezzo = offerta ? offerta.prezzo : PREMIUM_PRICE_AMOUNT;
  const periodo = offerta ? "" : ` ${t(PREMIUM_PRICE_PERIOD)}`;
  // Dentro il guscio, finche Apple non ha risposto, non si inventa nessun
  // prezzo: meglio niente riga che una cifra sbagliata per due secondi.
  const rigaPrezzo =
    native && !offerta
      ? ""
      : prova > 0
        ? t("{n} giorni gratis, poi {prezzo}. Disdici quando vuoi.", {
            n: String(prova),
            prezzo: `${prezzo}${periodo}`,
          })
        : t("{prezzo}. Disdici quando vuoi.", { prezzo: `${prezzo}${periodo}` });

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
    router.replace("/app");
  };

  // La splash aspetta il primo segnale di schermata pronta.
  useEffect(() => {
    signalReady();
  }, []);

  return (
    <main className="jm-screen jm-benv mx-auto w-full max-w-[440px] flex-1">
      {/* Titolo su due righe: dove spezzare lo decide la traduzione. */}
      <h1 className="jm-benv-hero" style={{ whiteSpace: "pre-line" }}>
        {t("Dove vuoi tenere\nil tuo diario?")}
      </h1>
      <p className="jm-benv-sub">
        {t("Puoi cambiare idea dopo. Quello che hai scritto viene con te.")}
      </p>

      <div className="jm-benv-cards">
        <div className="jm-benv-card">
          <div className="jm-benv-tag">{t("Free")}</div>
          <div className="jm-benv-t" style={{ whiteSpace: "pre-line" }}>
            {t("Scrivi tu,\nsul telefono.")}
          </div>
          <ul className="jm-benv-list">
            <li>{t("Scrivi la tua giornata, con obiettivi, peso, sonno e umore")}</li>
            <li>{t("Mese e Memo")}</li>
            <li>{t("Tutto resta su questo telefono")}</li>
          </ul>
        </div>

        <div className="jm-benv-card pick">
          <div className="jm-benv-tag">{t("Premium")}</div>
          <div className="jm-benv-t" style={{ whiteSpace: "pre-line" }}>
            {t("Tu parli.\nDayalogue scrive.")}
          </div>
          <ul className="jm-benv-list">
            <li>{t("Racconti a voce e si trascrive da solo")}</li>
            <li>{t("Titolo, sintesi e recap del mese, del semestre, dell'anno")}</li>
            <li>{t("Copia criptata nel cloud, su tutti i tuoi dispositivi")}</li>
          </ul>
        </div>
      </div>

      <button type="button" className="jm-benv-vedi" onClick={() => setDifferenze(true)}>
        {t("Vedi tutte le differenze")}
      </button>

      <div className="jm-benv-scelte">
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            if (!postLogin) {
              router.push("/login");
              return;
            }
            // Post-login il muro sa gia dove mandare: Apple se c'e il
            // negozio, l'App Store sul web. Qui non si duplica quella
            // decisione, la si chiama.
            markWelcomeSeen();
            openPremiumWall("aiSummary");
          }}
          disabled={starting || waiting}
        >
          {t("Inizia con premium")}
        </button>
        {rigaPrezzo && <p className="jm-benv-sotto">{rigaPrezzo}</p>}

        <button
          type="button"
          className="btn-ghost"
          onClick={() => (postLogin ? enter() : void startLocal())}
          disabled={starting || waiting}
        >
          {starting ? t("preparo...") : postLogin ? t("Continua gratis") : t("Inizia senza account")}
        </button>
        <p className="jm-benv-sotto">
          {postLogin
            ? t("niente voce e niente AI")
            : t("il diario resta su questo telefono")}
        </p>
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

      {/* La didascalia dice la verita del CONTESTO in cui la leggi. Prima
          del login diceva "nessun dato lascia il dispositivo: non c'e un
          server a cui mandarli": dal 4 settembre e FALSO, perche l'ospite e
          acceso di fabbrica e le prime giornate con l'AI passano dal
          server. Si dice cio che succede davvero. */}
      <p className="jm-benv-foot">
        {postLogin
          ? t("Nella versione gratis scrivi a mano: niente racconto a voce e niente AI.")
          : t("Senza account il diario resta su questo telefono.")}
        <br />
        {t(
          "Con premium le tue giornate salgono nel cloud gia criptate e la chiave resta sul tuo telefono. Quando usi l'AI il testo di quella giornata passa dai modelli AI e non viene salvato. Puoi cancellare tutto quando vuoi.",
        )}
      </p>

      {differenze && <FoglioDifferenze onClose={() => setDifferenze(false)} />}
    </main>
  );
}
