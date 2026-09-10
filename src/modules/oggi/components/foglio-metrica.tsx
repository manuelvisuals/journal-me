"use client";

/**
 * Il foglio di una misura: peso, sonno o mood, scelti con le ruote.
 * (Mockup MOCKUP-ruote-metriche.html, approvato da Manuel il 10 settembre
 * 2026: foglio dal basso, numero grande che cambia mentre scorri, due
 * ruote per chili e decimi, ore + minuti a passi di 30, mood con faccia e
 * parola. Sue due aggiunte: sonno a 30 minuti, peso che parte
 * dall'ultimo inserito.)
 *
 * PERCHE LE RUOTE E NON LA TASTIERA. Sul telefono un campo numerico
 * apre la tastiera, copre mezza pagina e chiede di scrivere "53,4" con
 * il dito; una ruota chiede un gesto solo. E per il peso il gesto e
 * quasi sempre "un decimo in piu o in meno di ieri": per questo, quando
 * la giornata non ha ancora un peso, la ruota parte dall'ULTIMO peso
 * registrato nelle giornate prima, non da un numero a caso.
 *
 * Il foglio non tocca i dati: torna il valore (o null per "togli") a chi
 * lo ha aperto, che lo salva come faceva con i campi di prima.
 */

import { useEffect, useMemo, useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Ruota, type VoceRuota } from "@/components/ui/ruota";
import { loadMonthEntries } from "@/lib/data/entries";
import { formatDecimal } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { Mood } from "@/lib/types";

export type MisuraFoglio =
  | { tipo: "peso"; valore: number | null }
  | { tipo: "sonno"; valore: number | null }
  | { tipo: "mood"; valore: Mood | null };

type Props = {
  misura: MisuraFoglio;
  /** La giornata: serve per cercare l'ultimo peso PRIMA di lei. */
  dateISO: string;
  onCommit: (valore: number | Mood | null) => void;
  onClose: () => void;
};

/** Peso di partenza quando non c'e niente da cui partire: nessun numero e giusto, questo e neutro. */
const PESO_DI_FABBRICA = 70;
const SONNO_DI_FABBRICA = 7;
const PESO_MIN = 20;
const PESO_MAX = 300;

export const MOOD_VOCI: { value: Mood; emoji: string; label: string }[] = [
  { value: "great", emoji: "\u{1F60A}", label: "molto bene" },
  { value: "good", emoji: "\u{1F642}", label: "bene" },
  { value: "neutral", emoji: "\u{1F610}", label: "cosi cosi" },
  { value: "low", emoji: "\u{1F614}", label: "giu" },
  { value: "bad", emoji: "\u{1F641}", label: "male" },
];

/**
 * L'ultimo peso scritto in una giornata PRIMA di quella data: si guarda
 * il mese della giornata e quello prima. Due mesi bastano: chi si pesa lo
 * fa spesso, e chi non si pesa da tre mesi riparte volentieri da capo.
 */
export async function ultimoPesoPrima(dateISO: string): Promise<number | null> {
  const [y, m] = dateISO.split("-").map(Number);
  const mesi: [number, number][] = [[y, m], m === 1 ? [y - 1, 12] : [y, m - 1]];
  for (const [anno, mese] of mesi) {
    let entries;
    try {
      entries = await loadMonthEntries("auth", anno, mese);
    } catch {
      continue;
    }
    const prima = entries
      .filter((e) => e.entryDate < dateISO && e.metrics?.weightKg != null)
      .sort((a, b) => (a.entryDate < b.entryDate ? 1 : -1));
    const peso = prima[0]?.metrics?.weightKg;
    if (peso != null) return peso;
  }
  return null;
}

export function FoglioMetrica({ misura, dateISO, onCommit, onClose }: Props) {
  const t = useT();
  const titolo =
    misura.tipo === "peso" ? t("peso") : misura.tipo === "sonno" ? t("sonno") : t("mood");

  return (
    <Sheet label={titolo} onClose={onClose}>
      <div className="jm-ruote-top">
        <span className="jm-ruote-t">{titolo}</span>
        <button type="button" className="jm-ruote-x" onClick={onClose}>
          {t("Annulla")}
        </button>
      </div>
      {misura.tipo === "peso" && (
        <Peso valore={misura.valore} dateISO={dateISO} onCommit={onCommit} t={t} />
      )}
      {misura.tipo === "sonno" && <Sonno valore={misura.valore} onCommit={onCommit} t={t} />}
      {misura.tipo === "mood" && <MoodRuota valore={misura.valore} onCommit={onCommit} t={t} />}
    </Sheet>
  );
}

type T = (s: string, vars?: Record<string, string | number>) => string;

function Tasti({ onTogli, onFatto, t }: { onTogli: () => void; onFatto: () => void; t: T }) {
  return (
    <div className="jm-ruote-btns">
      <button type="button" className="btn-ghost jm-ruote-togli" onClick={onTogli}>
        {t("Togli")}
      </button>
      <button type="button" className="btn-primary jm-ruote-fatto" onClick={onFatto}>
        {t("Fatto")}
      </button>
    </div>
  );
}

/* ---------------- peso: chili e decimi ---------------- */
function Peso({
  valore,
  dateISO,
  onCommit,
  t,
}: {
  valore: number | null;
  dateISO: string;
  onCommit: (v: number | null) => void;
  t: T;
}) {
  // Il punto di partenza: il peso della giornata; se manca, l'ultimo
  // registrato prima (arriva in un attimo, la ruota si sposta da sola);
  // se non c'e nemmeno quello, un numero neutro.
  const [kg, setKg] = useState<number>(Math.floor(valore ?? PESO_DI_FABBRICA));
  const [dec, setDec] = useState<number>(
    valore != null ? Math.round((valore - Math.floor(valore)) * 10) % 10 : 0,
  );
  const [pronto, setPronto] = useState<boolean>(valore != null);

  useEffect(() => {
    if (valore != null) return;
    let vivo = true;
    void ultimoPesoPrima(dateISO).then((p) => {
      if (!vivo) return;
      if (p != null) {
        setKg(Math.floor(p));
        setDec(Math.round((p - Math.floor(p)) * 10) % 10);
      }
      setPronto(true);
    });
    return () => {
      vivo = false;
    };
  }, [valore, dateISO]);

  const vociKg = useMemo<VoceRuota[]>(
    () =>
      Array.from({ length: PESO_MAX - PESO_MIN + 1 }, (_, i) => ({
        chiave: String(PESO_MIN + i),
        testo: String(PESO_MIN + i),
      })),
    [],
  );
  const vociDec = useMemo<VoceRuota[]>(
    () => Array.from({ length: 10 }, (_, i) => ({ chiave: String(i), testo: String(i) })),
    [],
  );
  const numero = kg + dec / 10;

  return (
    <>
      <div className="jm-ruote-big" aria-live="polite">
        {formatDecimal(numero, 1)}
        <small>kg</small>
      </div>
      {/* Le ruote nascono quando si sa da dove partire: montarle prima e
          poi spostarle farebbe vedere un salto. */}
      {pronto ? (
        <div className="jm-ruote">
          <div className="jm-ruote-band" aria-hidden="true" />
          <Ruota
            voci={vociKg}
            valore={String(kg)}
            onChange={(c) => setKg(Number(c))}
            className="jm-ruota-kg"
            ariaLabel={t("chili")}
          />
          <span className="jm-ruote-unit">,</span>
          <Ruota
            voci={vociDec}
            valore={String(dec)}
            onChange={(c) => setDec(Number(c))}
            className="jm-ruota-dec"
            ariaLabel={t("decimi di chilo")}
          />
          <span className="jm-ruote-unit">kg</span>
        </div>
      ) : (
        <div className="jm-ruote" aria-hidden="true" />
      )}
      <Tasti onTogli={() => onCommit(null)} onFatto={() => onCommit(Math.round(numero * 10) / 10)} t={t} />
    </>
  );
}

/* ---------------- sonno: ore e mezz'ore ---------------- */
function Sonno({
  valore,
  onCommit,
  t,
}: {
  valore: number | null;
  onCommit: (v: number | null) => void;
  t: T;
}) {
  // I minuti vanno a passi di 30 (scelta di Manuel): un valore vecchio a
  // 15 o 45 si arrotonda alla mezz'ora piu vicina, ore comprese.
  const totale = valore != null ? Math.min(23 * 60 + 30, Math.round((valore * 60) / 30) * 30) : SONNO_DI_FABBRICA * 60;
  const [h, setH] = useState<number>(Math.floor(totale / 60));
  const [m, setM] = useState<number>(totale % 60);

  const vociH = useMemo<VoceRuota[]>(
    () => Array.from({ length: 24 }, (_, i) => ({ chiave: String(i), testo: String(i) })),
    [],
  );
  const vociM = useMemo<VoceRuota[]>(
    () => [0, 30].map((v) => ({ chiave: String(v), testo: String(v).padStart(2, "0") })),
    [],
  );

  return (
    <>
      <div className="jm-ruote-big" aria-live="polite">
        {h}h {String(m).padStart(2, "0")}
      </div>
      <div className="jm-ruote">
        <div className="jm-ruote-band" aria-hidden="true" />
        <Ruota voci={vociH} valore={String(h)} onChange={(c) => setH(Number(c))} className="jm-ruota-h" ariaLabel={t("Ore di sonno")} />
        <span className="jm-ruote-unit">h</span>
        <Ruota voci={vociM} valore={String(m)} onChange={(c) => setM(Number(c))} className="jm-ruota-m" ariaLabel={t("Minuti di sonno")} />
        <span className="jm-ruote-unit">min</span>
      </div>
      <Tasti onTogli={() => onCommit(null)} onFatto={() => onCommit(h + m / 60)} t={t} />
    </>
  );
}

/* ---------------- mood: la faccia e la parola ---------------- */
function MoodRuota({
  valore,
  onCommit,
  t,
}: {
  valore: Mood | null;
  onCommit: (v: Mood | null) => void;
  t: T;
}) {
  const [mood, setMood] = useState<Mood>(valore ?? "neutral");
  const voci = useMemo<VoceRuota[]>(
    () =>
      MOOD_VOCI.map((o) => ({
        chiave: o.value,
        testo: (
          <>
            <span className="jm-ruota-faccia" aria-hidden="true">{o.emoji}</span>
            <span className="jm-ruota-parola">{t(o.label)}</span>
          </>
        ),
      })),
    [t],
  );
  const scelto = MOOD_VOCI.find((o) => o.value === mood) ?? MOOD_VOCI[2];

  return (
    <>
      <div className="jm-ruote-big" aria-live="polite">
        <span aria-hidden="true">{scelto.emoji}</span>
        <small>{t(scelto.label)}</small>
      </div>
      <div className="jm-ruote">
        <div className="jm-ruote-band" aria-hidden="true" />
        <Ruota voci={voci} valore={mood} onChange={(c) => setMood(c as Mood)} className="jm-ruota-mood" ariaLabel={t("mood")} />
      </div>
      <Tasti onTogli={() => onCommit(null)} onFatto={() => onCommit(mood)} t={t} />
    </>
  );
}
