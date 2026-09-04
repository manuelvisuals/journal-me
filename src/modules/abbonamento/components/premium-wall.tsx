"use client";

/**
 * Il muro premium (mockup due-modalita §04). Compare SOLO quando l'utente
 * tocca una funzione premium (microfono, Recap, pattern) — mai all'avvio,
 * mai a interrompere la scrittura. Il tasto secondario e sempre un'uscita
 * gratuita: la versione gratis non va mai messa in un vicolo cieco.
 *
 * Store modulo (stesso pattern di palette e focus): chiunque puo aprirlo
 * con openPremiumWall(feature, onDismiss?) senza prop-drilling. Il
 * componente e montato una volta nel guscio e funziona anche sotto lg:
 * il muro serve soprattutto al telefono gratis.
 *
 * DAL 4 SETTEMBRE 2026 (mockup abbonamento-iphone.html v3, deciso da
 * Manuel): dentro il guscio iOS il muro e A SCHEDE — un prodotto per
 * scheda, prezzo e prova letti da Apple (negozio-ios.ts), oggi il solo
 * mensile, l'annuale quando l'interruttore del pannello lo accende — e il
 * tasto apre il foglio di acquisto di Apple (In-App Purchase). In locale
 * (l'ospite) il tasto porta prima al login: premium e dell'account. Sul
 * web non si compra: il muro rimanda all'App Store. Il codice Stripe resta
 * (fakeCheckout per l'ambiente di prova) ma non e piu la strada del web.
 *
 * Il muro "regalo" (SPEC R3, ospite a giornate finite) e lo stesso muro con
 * un altro titolo: si apre da solo sull'evento `jm:regalo-finito` di
 * apiFetch, e la sua uscita gratuita e "Continua senza AI".
 */

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { APP_STORE_URL, PREMIUM_PRICE_LABEL, PREMIUM_PROVA_GIORNI } from "@/lib/pricing";
import { fakeCheckoutEnabled } from "@/lib/dev-checkout";
import { useT } from "@/lib/i18n";
import {
  ascoltaTransazioni,
  compraPremium,
  negozioDisponibile,
  prodottiPremium,
  ripristinaAcquisti,
  type ProdottoNegozio,
} from "@/modules/abbonamento/negozio-ios";
import { openPremiumWelcome } from "@/modules/abbonamento/components/premium-welcome";

/**
 * "regalo" = l'ospite che ha finito le giornate in regalo (SPEC R3).
 * "presentazione" = il foglio dopo la PRIMA giornata chiusa dall'AI
 * (mockup premium-senza-password, decisione A2 di Manuel): il regalo si
 * presenta una volta sola, e premium ha un nome.
 */
export type WallFeature = "voice" | "aiSummary" | "recap" | "patterns" | "regalo" | "presentazione";

type WallState = {
  feature: WallFeature;
  /** Uscita gratuita contestuale (es. mic -> apri la scrittura a mano). */
  onDismiss?: () => void;
  /** Per "regalo": quante giornate erano (per dirlo nel titolo). */
  max?: number;
  /** Per "presentazione": quante giornate restano in regalo. */
  rimaste?: number;
} | null;

let state: WallState = null;
const listeners = new Set<() => void>();
function emit(): void {
  for (const l of listeners) l();
}

export function openPremiumWall(
  feature: WallFeature,
  onDismiss?: () => void,
  extra?: { max?: number; rimaste?: number },
): void {
  state = { feature, onDismiss, max: extra?.max, rimaste: extra?.rimaste };
  emit();
}

export function closePremiumWall(): void {
  state = null;
  emit();
}

function useWallState(): WallState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => null,
  );
}

/**
 * I titoli del muro vanno su due righe. Prima erano JSX con un <br/> in
 * mezzo: cosi il punto dove spezzare era deciso dall'italiano e in inglese
 * cadeva a caso. Ora sono stringhe con un a capo dentro, la traduzione
 * decide dove spezzare, e `.jm-wall-t` lo rispetta (white-space: pre-line).
 */
const TITLES: Record<WallFeature, string> = {
  voice: "Per raccontare a voce\nserve premium",
  aiSummary: "Per il titolo e la sintesi\nserve premium",
  recap: "Per i recap del mese\nserve premium",
  patterns: "Per le letture sui pattern\nserve premium",
  regalo: "Le giornate con l'AI\nin regalo sono finite",
  presentazione: "L'AI ha chiuso\nquesta giornata per te",
};

const FEATURES: { t: string; p: string }[] = [
  {
    t: "Racconti e basta",
    p: "Voce, titolo, sintesi, aree, persone, recap.",
  },
  {
    t: "Su tutti i dispositivi",
    p: "Chiuso a chiave, con backup ogni notte.",
  },
];

/** Il nome del periodo per il tasto e la nota ("al mese", "all'anno"). */
const PERIODI: Record<string, string> = {
  mese: "al mese",
  anno: "all'anno",
  settimana: "alla settimana",
  giorno: "al giorno",
};

export function PremiumWall() {
  const t = useT();
  const wall = useWallState();
  const router = useRouter();
  const [cloudNote, setCloudNote] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  // I prodotti letti per QUESTA apertura del muro: legati allo stato con
  // cui si e aperto, cosi un'apertura nuova riparte da "un attimo..."
  // senza dover azzerare niente dentro un effetto.
  const [carico, setCarico] = useState<{ per: WallState; lista: ProdottoNegozio[] } | null>(null);
  const [scelto, setScelto] = useState<string | null>(null);
  const prodotti = carico && carico.per === wall ? carico.lista : null;
  const [errore, setErrore] = useState<string | null>(null);
  const negozio = negozioDisponibile();

  const dismiss = () => {
    const after = state?.onDismiss;
    closePremiumWall();
    setCloudNote(false);
    setErrore(null);
    after?.();
  };

  // Le transazioni che arrivano da sole (rinnovi, acquisti approvati dopo)
  // e il muro dell'ospite a regalo finito: si ascoltano una volta, qui,
  // perche questo componente e montato una volta sola nel guscio.
  useEffect(() => {
    ascoltaTransazioni();
    const suRegalo = (e: Event) => {
      const d = (e as CustomEvent<{ max?: number }>).detail;
      openPremiumWall("regalo", undefined, { max: d?.max });
    };
    window.addEventListener("jm:regalo-finito", suRegalo);
    return () => window.removeEventListener("jm:regalo-finito", suRegalo);
  }, []);

  // Esc = uscita gratuita, come il tasto "non ora".
  useEffect(() => {
    if (!wall) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.isComposing) dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      setCloudNote(false);
    };
  }, [wall]);

  // Le schede: i prodotti come li dice Apple. L'interruttore dell'annuale
  // arriva da /api/ospite/stato (stessa origine, senza testo: e nell'elenco
  // chiuso della promessa sulla rete), cosi vale anche per l'ospite.
  useEffect(() => {
    if (!wall || !negozio) return;
    let vivo = true;
    const per = wall;
    (async () => {
      let annuale = false;
      try {
        const r = await apiFetch("/api/ospite/stato");
        if (r.ok) annuale = ((await r.json()) as { annualeAttivo?: boolean }).annualeAttivo === true;
      } catch {
        // senza risposta: solo il mensile
      }
      const lista = await prodottiPremium(annuale);
      if (!vivo) return;
      setCarico({ per, lista });
      setScelto(lista[0]?.id ?? null);
    })();
    return () => {
      vivo = false;
    };
  }, [wall, negozio]);

  if (!wall) return null;

  const regalo = wall.feature === "regalo";
  const presentazione = wall.feature === "presentazione";
  const prodotto = prodotti?.find((p) => p.id === scelto) ?? prodotti?.[0] ?? null;
  const prova = prodotto && prodotto.provaGiorni && prodotto.provaDisponibile !== false ? prodotto.provaGiorni : 0;

  /** Il tasto pieno dentro il guscio: compra (o prima l'account). */
  const compra = async () => {
    if (busy) return;
    // L'ospite compra come tutti: il foglio di Apple, nessun login in mezzo
    // (mockup premium-senza-password, B1). Il server scrive il premium sul
    // braccialetto del telefono; l'email arriva quando vuole il backup.
    if (!prodotto) return;
    setBusy(true);
    setErrore(null);
    const esito = await compraPremium(prodotto.id);
    setBusy(false);
    if (esito.esito === "premium") {
      closePremiumWall();
      openPremiumWelcome();
      return;
    }
    if (esito.esito === "in_attesa") {
      setErrore(t("L'acquisto aspetta un'approvazione (In famiglia): premium si accende da solo appena arriva."));
      return;
    }
    if (esito.esito === "errore") setErrore(esito.messaggio);
  };

  const ripristina = async () => {
    if (busy) return;
    setBusy(true);
    setErrore(null);
    const esito = await ripristinaAcquisti();
    setBusy(false);
    if (esito.esito === "premium") {
      closePremiumWall();
      openPremiumWelcome();
      return;
    }
    if (esito.esito === "errore") setErrore(esito.messaggio);
  };

  /** Il tasto pieno sul web: nessun acquisto qui, si va all'App Store. */
  const vaiAllAppStore = () => {
    // Sul web l'ospite non compra (niente Stripe, decisione di Manuel):
    // stesso rimando all'App Store di chi ha un account.
    // Ambiente di prova: il pagamento simulato resta la strada per provare
    // l'app da premium sul web (checkout-finto).
    if (fakeCheckoutEnabled()) {
      closePremiumWall();
      router.push("/app/checkout-finto");
      return;
    }
    if (APP_STORE_URL) {
      window.location.href = APP_STORE_URL;
      return;
    }
    setCloudNote(true);
  };

  const titolo =
    regalo && wall.max
      ? t("Le {n} giornate con l'AI\nin regalo sono finite", { n: String(wall.max) })
      : t(TITLES[wall.feature]);
  const sottotitolo = presentazione
    ? wall.rimaste !== undefined && wall.rimaste > 0
      ? t("Titolo, sintesi e aree li ha scritti lei. Ne hai altre {n} giornate in regalo, senza fare niente. Poi, se ti piace, questo e premium.", { n: String(wall.rimaste) })
      : t("Titolo, sintesi e aree li ha scritti lei. Le prime giornate sono in regalo, senza fare niente. Poi, se ti piace, questo e premium.")
    : regalo
      ? t("Grazie di averle usate. Puoi continuare a scrivere ogni giorno: manca solo la parte fatta dall'AI.")
      : negozio
        ? t("Una prova gratis per provare tutto. Poi, se ti piace, resta.")
        : t("Premium si attiva dall'app per iPhone: {n} giorni gratis, poi {prezzo}. Con lo stesso account vale anche qui.", {
            n: String(PREMIUM_PROVA_GIORNI),
            prezzo: PREMIUM_PRICE_LABEL,
          });

  return (
    <div
      className="jm-wall-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={t("Premium")}
      onClick={dismiss}
    >
      <div className="jm-wall" onClick={(e) => e.stopPropagation()}>
        <div className="jm-wall-t">{titolo}</div>
        <div className="jm-wall-p">{sottotitolo}</div>

        {negozio && (
          <div className="jm-wall-schede" data-testid="jm-wall-schede">
            {prodotti === null && <div className="jm-wall-scheda jm-wall-scheda-attesa">{t("un attimo...")}</div>}
            {prodotti?.map((p) => {
              const on = p.id === scelto;
              const pr = p.provaGiorni && p.provaDisponibile !== false ? p.provaGiorni : 0;
              return (
                <button
                  type="button"
                  key={p.id}
                  className={on ? "jm-wall-scheda on" : "jm-wall-scheda"}
                  onClick={() => setScelto(p.id)}
                  data-prodotto={p.chiave}
                >
                  <span className="k">
                    <b>{p.chiave === "annuale" ? t("Annuale") : t("Mensile")}</b>
                    <span className="pr">{`${p.prezzo} ${t(PERIODI[p.periodo] ?? "al mese")}`}</span>
                    <i>{on ? "\u2713" : ""}</i>
                  </span>
                  <span className="p">
                    {pr > 0
                      ? t("{n} giorni gratis, poi {prezzo} {periodo}. Disdici quando vuoi.", {
                          n: String(pr),
                          prezzo: p.prezzo,
                          periodo: t(PERIODI[p.periodo] ?? "al mese"),
                        })
                      : t("Disdici quando vuoi.")}
                  </span>
                </button>
              );
            })}
            {prodotti !== null && prodotti.length === 0 && (
              <div className="jm-wall-scheda jm-wall-scheda-attesa">
                {t("Il negozio non risponde: riprova fra poco.")}
              </div>
            )}
          </div>
        )}

        {FEATURES.map((f) => (
          <div key={f.t} className="jm-wall-feat">
            <i />
            <div>
              <div className="t">{t(f.t)}</div>
              <div className="p">{t(f.p)}</div>
            </div>
          </div>
        ))}

        {errore && <div className="jm-wall-note" role="alert">{errore}</div>}
        {cloudNote && (
          <div className="jm-wall-note">
            {t("L'app per iPhone sta arrivando sull'App Store: premium si attiva da li.")}
          </div>
        )}

        {negozio ? (
          <button
            type="button"
            className="btn-primary"
            onClick={() => void compra()}
            disabled={busy || !prodotto}
          >
            {busy
              ? t("un attimo...")
              : prova > 0
                ? t("Prova gratis {n} giorni", { n: String(prova) })
                : prodotto
                  ? `${t("Abbonati")} . ${prodotto.prezzo} ${t(PERIODI[prodotto.periodo] ?? "al mese")}`
                  : t("Passa a premium")}
          </button>
        ) : (
          <button type="button" className="btn-primary" onClick={vaiAllAppStore} disabled={busy}>
            {t("Scarica dayalogue per iPhone")}
          </button>
        )}
        <button type="button" className="btn-ghost" onClick={dismiss}>
          {regalo ? t("Continua senza AI") : t("non ora")}
        </button>

        <div className="jm-wall-quiet">
          {negozio && (
            <button type="button" onClick={() => void ripristina()} disabled={busy}>
              {t("Ripristina acquisti")}
            </button>
          )}
        </div>

        {negozio && prodotto && (
          <div className="jm-wall-nota">
            {prova > 0
              ? t("Dopo la prova si rinnova da solo a {prezzo} {periodo}, finche non lo disdici dalle Impostazioni di Apple.", {
                  prezzo: prodotto.prezzo,
                  periodo: t(PERIODI[prodotto.periodo] ?? "al mese"),
                })
              : t("Si rinnova da solo a {prezzo} {periodo}, finche non lo disdici dalle Impostazioni di Apple.", {
                  prezzo: prodotto.prezzo,
                  periodo: t(PERIODI[prodotto.periodo] ?? "al mese"),
                })}{" "}
            <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" target="_blank" rel="noreferrer">{t("Termini")}</a> &middot; <a href="/privacy">{t("Privacy")}</a>
          </div>
        )}
      </div>
    </div>
  );
}
