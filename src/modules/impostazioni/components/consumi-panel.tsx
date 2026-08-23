"use client";

/**
 * Consumi AI — mockup design/mockups/consumi-ai.html, approvato.
 *
 * Due pezzi che vivono insieme perche leggono lo stesso dato: la RIGA in
 * Impostazioni (che mostra gia il totale: chi la apre lo fa per il
 * dettaglio, non per scoprire se ha speso) e il PANNELLO.
 *
 * Tre regole del disegno, e nessuna e cosmetica:
 *
 * 1. **Le voci sono attivita, non route.** "Trascrizione della voce", non
 *    "transcribe"; e le tre route che mettono in ordine il racconto
 *    (split-by-date, extract-people, classify) sono una voce sola, perche
 *    da fuori sono un gesto solo. Un elenco di nomi tecnici non aiuta a
 *    decidere niente.
 * 2. **Il vuoto dice perche e vuoto.** "Questo mese l'AI non l'hai ancora
 *    usata", mai "nessun dato": zero e una risposta giusta per chi scrive
 *    a mano, e va detta come tale.
 * 3. **L'errore si vede scritto.** Una schermata che resta vuota dopo un
 *    500 farebbe credere di non aver speso niente, che e la bugia peggiore
 *    che possa dire questa schermata.
 *
 * La riga NON esiste in modalita locale: la decide chi la monta
 * (settings-client), e `loadUsage` si rifiuta comunque di partire fuori
 * dal cloud. Una riga spenta con la targhetta premium sarebbe solo un modo
 * elegante di dire di no a chi non puo dire di si.
 */

import { useCallback, useEffect, useState } from "react";
import { SetRow } from "@/modules/impostazioni/components/rows";
import { loadUsage, type UsageActivityId, type UsageSummary } from "@/lib/data/usage";
import {
  formatDate,
  formatDecimal,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import { useT } from "@/lib/i18n";

type Load =
  | { state: "loading" }
  | { state: "ready"; usage: UsageSummary }
  | { state: "error"; message: string };

function useUsage(): { load: Load; retry: () => void } {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    loadUsage(attempt > 0)
      .then((usage) => {
        if (alive) setLoad({ state: "ready", usage });
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setLoad({
          state: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  // Lo stato torna in attesa QUI e non dentro l'effetto: setState sincrono
  // dentro un effetto e vietato dal lint di React 19 (HANDOVER §7), e in un
  // gestore di evento e la cosa giusta comunque.
  const retry = useCallback(() => {
    setLoad({ state: "loading" });
    setAttempt((n) => n + 1);
  }, []);
  return { load, retry };
}

/* ----------------------- formattazione ----------------------- */

/**
 * Il costo, sempre in dollari: il listino di OpenAI e in dollari e
 * convertirlo in euro con un cambio inventato aggiungerebbe un secondo
 * errore sopra a una stima.
 */
function money(usd: number): string {
  return `${formatDecimal(usd, 2)} $`;
}

/** Sotto il centesimo "0,00 $" sembra gratis: si dice che e poco, non zero. */
function moneyOrLess(usd: number, t: ReturnType<typeof useT>): string {
  if (usd > 0 && usd < 0.005) return t("meno di {v}", { v: money(0.01) });
  return money(usd);
}

/**
 * I titoli, scritti a mano uno per uno invece che in una mappa. Non e
 * pignoleria: `scripts/verify-i18n.mjs` legge le frasi passate a t() con
 * un'analisi statica, e una mappa `t(TITOLI[id])` le renderebbe invisibili
 * — cioe traduzioni orfane a ogni controllo, o peggio niente inglese.
 */
function activityTitle(
  id: UsageActivityId,
  t: ReturnType<typeof useT>,
): string {
  if (id === "transcribe") return t("Trascrizione della voce");
  if (id === "recap") return t("Recap del mese");
  if (id === "process-entry") return t("Titoli e sintesi delle giornate");
  return t("Persone, date e note di Ricorda");
}

/** Il conteggio umano sotto ogni voce: registrazioni e minuti, o chiamate. */
function activityDetail(
  id: UsageActivityId,
  calls: number,
  audioSeconds: number,
  t: ReturnType<typeof useT>,
): string {
  if (id === "transcribe") {
    if (audioSeconds <= 0) {
      return calls === 1
        ? t("1 registrazione")
        : t("{n} registrazioni", { n: calls });
    }
    const m = Math.max(1, Math.round(audioSeconds / 60));
    return calls === 1
      ? t("1 registrazione . {m} minuti", { m })
      : t("{n} registrazioni . {m} minuti", { n: calls, m });
  }
  if (id === "recap") {
    return t("{n} recap . il modello grande", { n: calls });
  }
  if (id === "process-entry") {
    return calls === 1 ? t("1 giornata") : t("{n} giornate", { n: calls });
  }
  return calls === 1
    ? t("1 chiamata in tutto")
    : t("{n} chiamate in tutto", { n: calls });
}

/** "Agosto 2026" con l'iniziale maiuscola, dal mese aggregato dalla route. */
function monthLabel(monthStartISO: string): string {
  const raw = formatDate(monthStartISO, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/* ----------------------- la riga in Impostazioni ----------------------- */

/**
 * La riga del gruppo Account. Il valore a destra e il totale del mese: e
 * il motivo per cui questa riga esiste al posto di un semplice link.
 */
export function ConsumiRow({ onOpen }: { onOpen: () => void }) {
  const t = useT();
  const { load } = useUsage();

  const value =
    load.state === "ready"
      ? t("circa {v}", { v: moneyOrLess(load.usage.totalUsd, t) })
      : load.state === "error"
        ? t("non disponibile")
        : undefined;

  return (
    <SetRow
      title={t("Consumi AI")}
      desc={t("Quanto e costato questo mese")}
      value={value}
      onClick={onOpen}
    />
  );
}

/**
 * La stessa riga, per la rail destra del desktop. Li l'elenco non e fatto
 * di SetRow ma di coppie chiave/valore (.jm-st-rrow), e questa e l'unica
 * di quelle coppie che porta da qualche parte: quindi e un bottone vero,
 * con il chevron, e non una riga che si clicca per intuito.
 */
export function ConsumiRailRow({ onOpen }: { onOpen: () => void }) {
  const t = useT();
  const { load } = useUsage();

  return (
    <button
      type="button"
      className="jm-st-rrow jm-cs-rrow"
      onClick={onOpen}
    >
      <span className="k">{t("Consumi AI")}</span>
      <span className="v">
        {load.state === "ready"
          ? t("circa {v}", { v: moneyOrLess(load.usage.totalUsd, t) })
          : load.state === "error"
            ? t("non disponibile")
            : ""}
        <svg className="jm-cs-chev" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </span>
    </button>
  );
}

/* ----------------------- il pannello ----------------------- */

export function ConsumiPanel() {
  const t = useT();
  const { load, retry } = useUsage();

  if (load.state === "loading") {
    return (
      <div className="jm-cs">
        <p className="jm-cs-wait" role="status">
          {t("Sto leggendo i consumi...")}
        </p>
      </div>
    );
  }

  if (load.state === "error") {
    return (
      <div className="jm-cs">
        <div className="jm-cs-err" role="alert">
          <div className="jm-cs-err-t">
            {t("Non sono riuscito a leggere i consumi")}
          </div>
          <p className="jm-cs-err-p">
            {t(
              "La richiesta non e andata a buon fine, quindi questa schermata non sa dirti niente: non vuol dire che non hai speso.",
            )}
          </p>
          <p className="jm-cs-err-d">{load.message}</p>
          <button type="button" className="jm-cs-retry" onClick={retry}>
            {t("Riprova")}
          </button>
        </div>
      </div>
    );
  }

  const u = load.usage;

  return (
    <div className="jm-cs">
      <div className="jm-cs-sub">
        {t("{mese}, dal giorno 1", { mese: monthLabel(u.monthStart) })}
      </div>

      {/* La barra della quota mensile inclusa nel piano, "come quella di
          Claude" (richiesta di Manuel, 19 ago). Si disegna solo se il tier
          ha un tetto in plan_limits: senza tetto una barra sarebbe una
          percentuale di niente. A zero resta: dire "0%" a chi non ha ancora
          usato l'AI e un'informazione, non un errore. */}
      {u.pct !== null && (
        <div className="jm-usage">
          <div className="jm-usage-top">
            <span className="jm-usage-t">
              {t("Quota inclusa nell'abbonamento")}
            </span>
            <span className="jm-usage-pct" suppressHydrationWarning>
              {formatPercent(Math.min(u.pct, 999) / 100, 0)}
            </span>
          </div>
          <div
            className="jm-usage-bar"
            role="progressbar"
            aria-valuenow={Math.max(0, Math.min(100, u.pct))}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={`jm-usage-fill${u.pct >= 90 ? " warn" : ""}`}
              style={{ width: `${Math.max(0, Math.min(100, u.pct))}%` }}
            />
          </div>
          <div className="jm-usage-sub" suppressHydrationWarning>
            {t(
              "{n} token usati questo mese. La quota si azzera il primo del mese.",
              { n: formatNumber(u.totalTokens) },
            )}
          </div>
        </div>
      )}

      {u.empty ? (
        <div className="jm-cs-empty">
          <div className="jm-cs-empty-t">
            {t("Questo mese l'AI non l'hai ancora usata")}
          </div>
          <p className="jm-cs-empty-p">
            {t(
              "Il conto riparte da zero il primo di ogni mese. Compare qualcosa appena racconti una giornata a voce o chiudi una giornata col riassunto.",
            )}
          </p>
        </div>
      ) : (
        <>
          <div className="jm-cs-total">
            <div className="jm-cs-total-v">
              {formatDecimal(u.totalUsd, 2)}
              <span className="jm-cs-cur">$</span>
            </div>
            <div className="jm-cs-total-k">
              <span>{summaryLine(u, t)}</span>
              {u.days > 0 && u.totalUsd > 0 && (
                <span>
                  {t("Circa {c} centesimi a giornata.", {
                    c: formatDecimal((u.totalUsd * 100) / u.days, 1),
                  })}
                </span>
              )}
            </div>
          </div>

          <div className="jm-cs-gl">{t("Da cosa arriva")}</div>

          <div className="jm-cs-list">
            {u.activities.map((a) => (
              <div className="jm-cs-row" key={a.id}>
                <div className="jm-cs-main">
                  <div className="jm-cs-t">{activityTitle(a.id, t)}</div>
                  <div className="jm-cs-d">
                    {activityDetail(a.id, a.calls, a.audioSeconds, t)}
                  </div>
                  <div className={`jm-cs-bar${a.share < 0.05 ? " faint" : ""}`}>
                    <i style={{ width: `${Math.round(a.share * 100)}%` }} />
                  </div>
                </div>
                <div className="jm-cs-v">
                  {moneyOrLess(a.usd, t)}
                  <small>{formatPercent(a.share, 0)}</small>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="jm-cs-note">
        <div className="jm-cs-note-t">{t("E una stima, non la tua bolletta")}</div>
        <p className="jm-cs-note-p">
          {t("I token sono quelli")} <b>{t("ufficiali")}</b>{" "}
          {t(
            "che OpenAI riporta a ogni risposta, quindi il conteggio e esatto. Il prezzo no: e un listino salvato ad agosto 2026 in",
          )}{" "}
          <code>ai-usage.ts</code>
          {t(
            ", e se OpenAI lo cambia questa cifra resta indietro finche non lo aggiorni. Il conto vero e sul tuo pannello OpenAI.",
          )}
        </p>
      </div>
    </div>
  );
}

/** "Stima su 17 giornate, di cui 12 raccontate a voce." */
function summaryLine(u: UsageSummary, t: ReturnType<typeof useT>): string {
  if (u.days > 0) {
    if (u.recordings > 0) {
      return u.days === 1
        ? t("Stima su una giornata, raccontata a voce.")
        : t("Stima su {d} giornate, di cui {r} raccontate a voce.", {
            d: u.days,
            r: u.recordings,
          });
    }
    return u.days === 1
      ? t("Stima su una giornata.")
      : t("Stima su {d} giornate.", { d: u.days });
  }
  if (u.recordings > 0) {
    return u.recordings === 1
      ? t("Stima su una registrazione.")
      : t("Stima su {r} registrazioni.", { r: u.recordings });
  }
  return t("Stima sulle chiamate di questo mese.");
}
