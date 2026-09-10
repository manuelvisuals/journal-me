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
import { ospiteAttivo } from "@/lib/ospite/flag";
import { statoOspiteInTasca } from "@/lib/ospite/stato";
import { REGALO_DI_FABBRICA } from "@/lib/regalo";
import { usePianoNoto } from "@/lib/plan";
import { openPremiumWall, prodottiInTasca, prodottiPremium } from "@/modules/abbonamento";
import type { ProdottoNegozio } from "@/modules/abbonamento";
import { FoglioDifferenze, SegnoDayalogue } from "@/modules/accesso";

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
 *
 * IL REGALO SI DICE DOPO, NON PRIMA (Manuel, 10 settembre 2026). Chi sceglie
 * Free non trova nessun "in regalo" nella card: lo scopre nella schermata
 * SUBITO DOPO, come un benvenuto. Due motivi. Uno: nella card, accanto ai 14
 * giorni di Apple, erano due offerte gratuite affiancate e chi legge non
 * capiva quale stesse prendendo. Due: un regalo annunciato mentre stai
 * ancora scegliendo e un argomento di vendita; dato dopo che hai scelto e un
 * regalo. La schermata dice anche cosa NON contiene, se no il gratis sembra
 * premium e premium non si compra piu.
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
   * La seconda schermata: il regalo di benvenuto. Si accende solo dopo aver
   * scelto Free, e solo se c'e davvero qualcosa da regalare.
   */
  const [regaloVisto, setRegaloVisto] = useState<boolean>(false);

  /**
   * Quante giornate in regalo dire. Il numero VERO lo tiene il server
   * (tabella `regalo`, pannello admin) e arriva con /api/ospite/stato: se il
   * dispositivo l'ha gia sentito una volta si usa quello, altrimenti il
   * valore di fabbrica. Qui NON si chiama la rete: siamo nella schermata di
   * chi ha appena scelto di restare sul telefono.
   */
  const inTasca = typeof window === "undefined" ? null : statoOspiteInTasca();
  const giornateRegalo = inTasca?.max ?? REGALO_DI_FABBRICA.giornatePerOspite;
  const regaloDaDire =
    ospiteAttivo() && giornateRegalo > 0 && (inTasca === null || inTasca.rimaste > 0);

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
    setStarting(false);
    if (regaloDaDire) {
      setRegaloVisto(true);
      return;
    }
    router.replace("/app");
  };

  // La splash aspetta il primo segnale di schermata pronta.
  useEffect(() => {
    signalReady();
  }, []);

  if (regaloVisto) {
    return (
      <main className="jm-screen jm-benv jm-benv-dono mx-auto w-full max-w-[440px] flex-1">
        <div className="jm-dono-segno">
          <SegnoDayalogue size={54} />
        </div>
        <h1 className="jm-benv-hero">{t("Regalo di benvenuto")}</h1>
        <p className="jm-dono-p">
          {t(
            "{n} giornate con l'AI accesa, incluse. Racconti a voce, lei trascrive e scrive titolo e sintesi della giornata.",
            { n: String(giornateRegalo) },
          )}
        </p>
        <p className="jm-dono-p jm-dono-oltre">
          {t(
            "E' un assaggio. Premium fa anche i recap del mese, del semestre e dell'anno, tiene una copia criptata nel cloud e ti segue su tutti i dispositivi.",
          )}
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            markWelcomeSeen();
            router.replace("/app");
          }}
        >
          {t("Continua")}
        </button>
      </main>
    );
  }

  return (
    <main className="jm-screen jm-benv mx-auto w-full max-w-[440px] flex-1">
      {/* Titolo su due righe: dove spezzare lo decide la traduzione. */}
      <h1 className="jm-benv-hero" style={{ whiteSpace: "pre-line" }}>
        {t("Come vuoi iniziare?")}
      </h1>
      <p className="jm-benv-sub">
        {t("Puoi cambiare idea dopo. Quello che hai scritto viene con te.")}
      </p>

      <div className="jm-benv-cards">
        <div className="jm-benv-card">
          <div className="jm-benv-testa">
            <SegnoDayalogue />
            <span className="jm-benv-nome">
              Dayalogue <b>FREE</b>
            </span>
          </div>
          <ul className="jm-benv-list">
            <li>{t("Scrivi la tua giornata, con obiettivi, peso, sonno e umore")}</li>
            <li>{t("Mese e Memo")}</li>
            <li>{t("Tutto resta su questo telefono")}</li>
          </ul>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              if (!postLogin) {
                void startLocal();
                return;
              }
              // Il regalo segue la persona (7 settembre 2026): vale anche
              // per un account sul piano free, sullo stesso braccialetto.
              if (regaloDaDire) {
                setRegaloVisto(true);
                return;
              }
              enter();
            }}
            disabled={starting || waiting}
          >
            {starting ? t("preparo...") : t("Inizia con Free")}
          </button>
        </div>

        <div className="jm-benv-card pick">
          <div className="jm-benv-testa">
            <SegnoDayalogue />
            <span className="jm-benv-nome">
              Dayalogue <b>PREMIUM</b>
            </span>
          </div>
          <ul className="jm-benv-list">
            <li>{t("Racconti a voce e si trascrive da solo")}</li>
            <li>{t("Titolo, sintesi e recap del mese, del semestre, dell'anno")}</li>
            <li>{t("Copia criptata nel cloud, su tutti i tuoi dispositivi")}</li>
          </ul>
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
            {prova > 0 ? t("Prova {n}gg gratis", { n: String(prova) }) : t("Passa a premium")}
          </button>
          {rigaPrezzo && <p className="jm-benv-sotto">{rigaPrezzo}</p>}
        </div>
      </div>

      <button type="button" className="jm-benv-vedi" onClick={() => setDifferenze(true)}>
        {t("Vedi tutte le differenze")}
      </button>

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

      {/* La riga in fondo (Manuel, 10 settembre 2026): una sola, e tecnica.
          Prima erano quattro frasi che spiegavano tre cose diverse. Qui si
          dice l'unico fatto che conta e si dice con il suo nome: la
          cifratura e AES-256-GCM (src/lib/cassaforte/serratura.ts), la
          chiave nasce sul dispositivo dal codice di recupero (PBKDF2-SHA256,
          600.000 giri) e non parte mai. Il resto (l'AI, la cancellazione) sta
          dove serve: nel foglio delle differenze e nelle Impostazioni. */}
      <p className="jm-benv-foot">
        {t(
          "Le tue giornate sono cifrate sul dispositivo con AES-256-GCM. La chiave resta sul tuo telefono: senza, nel cloud non si legge nulla.",
        )}
      </p>

      {differenze && <FoglioDifferenze onClose={() => setDifferenze(false)} />}
    </main>
  );
}
