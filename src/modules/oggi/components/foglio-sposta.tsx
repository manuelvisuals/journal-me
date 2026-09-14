"use client";

/**
 * "Sposto sul 13?" — la conferma prima di spostare un racconto su un altro
 * giorno (14 settembre 2026, mockup MOCKUP-sposta-giorno.html, 1B 2C 3C).
 *
 * Due passi, e il secondo esiste solo quando serve:
 *  1. la conferma, con davanti il pezzo che si sposta e cosa succede al
 *     giorno che lo riceve (ha gia un racconto, o non ce l'ha);
 *  2. SOLO se il giorno di partenza resta senza una parola, la domanda su
 *     cosa farne (risposta 2C di Manuel: chiedimelo ogni volta). Si chiede
 *     PRIMA di scrivere, non dopo: cosi non esiste un momento in cui la
 *     giornata e gia svuotata e nessuno ha ancora deciso.
 *
 * Il testo lo passa il chiamante e non si rilegge dal database: nell'editor
 * ci possono essere correzioni non ancora salvate, e spostare una versione
 * vecchia del racconto sarebbe il modo piu silenzioso di perdere una frase.
 */

import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { useT } from "@/lib/i18n";
import { compactDayDate, parseISODate, relativeDayLabel, todayISO } from "@/lib/format";
import { getStore } from "@/lib/data/store";
import { senzaUltimoPezzo, ultimoPezzo } from "@/modules/oggi/pezzi";
import {
  spostaUltimoPezzo,
  type EsitoSposta,
  type GiornoVuoto,
} from "@/modules/oggi/sposta-giorno";
import type { Entry } from "@/lib/types";

/** Quanto se ne mostra: due righe bastano a riconoscerlo, non a rileggerlo. */
const ANTEPRIMA_MAX = 180;

function accorcia(testo: string): string {
  const t = testo.trim();
  return t.length <= ANTEPRIMA_MAX ? t : `${t.slice(0, ANTEPRIMA_MAX).trimEnd()}...`;
}

function nomeGiorno(iso: string): string {
  const d = parseISODate(iso);
  return `${relativeDayLabel(d, parseISODate(todayISO()))} · ${compactDayDate(d)}`;
}

export function FoglioSposta({
  da,
  a,
  transcript,
  onAnnulla,
  onFatto,
  onErrore,
}: {
  da: string;
  a: string;
  transcript: string;
  onAnnulla: () => void;
  onFatto: (esito: EsitoSposta) => void;
  onErrore: (messaggio: string) => void;
}) {
  const t = useT();
  const [passo, setPasso] = useState<"conferma" | "vuoto" | "lavoro">("conferma");
  /* La giornata che riceve: serve solo a dire la frase giusta ("ha gia un
     racconto" oppure "e vuoto"). Finche non si sa, la frase non si dice:
     meglio una riga in meno che una riga sbagliata. */
  const [destinazione, setDestinazione] = useState<Entry | null | undefined>(undefined);
  const [letta, setLetta] = useState<string>("");
  if (letta !== a) {
    setLetta(a);
    setDestinazione(undefined);
    void getStore()
      .loadEntryForDate(a)
      .then((e) => setDestinazione(e))
      .catch(() => setDestinazione(null));
  }

  const pezzo = ultimoPezzo(transcript);
  const restaVuoto = senzaUltimoPezzo(transcript) === "";
  const destinazionePiena = !!destinazione?.transcript?.trim();

  async function esegui(giornoVuoto: GiornoVuoto) {
    setPasso("lavoro");
    try {
      const esito = await spostaUltimoPezzo({ da, a, transcript, giornoVuoto });
      onFatto(esito);
    } catch {
      onErrore(t("Non sono riuscito a spostarlo. Riprova fra poco."));
    }
  }

  if (passo === "vuoto") {
    return (
      <Sheet label={t("Il giorno di partenza resta senza racconto")} onClose={onAnnulla}>
        <div className="jm-sposta">
          <p className="jm-sposta-tit">{t("Qui non resta nessun racconto")}</p>
          <p className="jm-sposta-d">
            {t("Foto, peso, sonno e umore restano dove sono: sono del giorno, non del racconto.")}
          </p>
          <div className="jm-sposta-tasti">
            <button type="button" className="jm-sposta-b" onClick={() => void esegui("lascia")}>
              {t("Lasciala vuota")}
            </button>
            <button type="button" className="jm-sposta-b forte" onClick={() => void esegui("cancella")}>
              {t("Cancella la giornata")}
            </button>
          </div>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet label={t("Sposta su un altro giorno")} onClose={onAnnulla}>
      <div className="jm-sposta">
        <p className="jm-sposta-tit">
          {t("Sposto su")} {nomeGiorno(a)}?
        </p>
        <p className="jm-sposta-d">{t("Si sposta l'ultimo pezzo di questa giornata.")}</p>
        <p className="jm-sposta-pezzo">{accorcia(pezzo)}</p>
        {destinazione === undefined ? null : destinazionePiena ? (
          <p className="jm-sposta-d">
            {t("Quel giorno ha gia un racconto: questo va in fondo, sotto un separatore.")}
          </p>
        ) : (
          <p className="jm-sposta-d">{t("Quel giorno e vuoto: questo diventa il suo racconto.")}</p>
        )}
        <p className="jm-sposta-d">
          {restaVuoto
            ? t("Il giorno che riceve viene riscritto da capo: titolo, sintesi e aree.")
            : t("Tutti e due i giorni vengono riscritti da capo: titolo, sintesi e aree.")}
        </p>
        <div className="jm-sposta-tasti">
          <button
            type="button"
            className="jm-sposta-b"
            onClick={onAnnulla}
            disabled={passo === "lavoro"}
          >
            {t("Annulla")}
          </button>
          <button
            type="button"
            className="jm-sposta-b forte"
            disabled={passo === "lavoro" || pezzo === ""}
            onClick={() => {
              if (restaVuoto) setPasso("vuoto");
              else void esegui("lascia");
            }}
          >
            {passo === "lavoro" ? t("Sto spostando...") : t("Sposta")}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
