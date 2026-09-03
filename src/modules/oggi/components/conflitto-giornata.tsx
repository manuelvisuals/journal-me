"use client";

/**
 * La giornata modificata altrove (SPEC ospite-e-cassaforte R7; mockup
 * design/mockups/codice-di-recupero.html, schermata 03).
 *
 * Il server ha rifiutato una scrittura perche la versione non era piu
 * quella corrente: qualcun altro (un altro dispositivo della stessa
 * persona) ha scritto nel frattempo. Qui si mostrano le DUE versioni e si
 * lascia scegliere: tieni quella, tieni questa, o tutte e due (l'altra
 * finisce in fondo al racconto, sotto un separatore: niente sparisce).
 *
 * Stesso impianto del muro premium: store di modulo, montato UNA volta dal
 * guscio, aperto da chiunque intercetti un ConflittoVersione (la facciata
 * dei dati, src/lib/data/entries.ts, lo fa per tutti).
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { formatDate, parseISODate } from "@/lib/format";
import { invalidateAll } from "@/lib/data/cache";
import { risolviConflitto } from "@/lib/data/entries";
import { suConflitto, type ConflittoVersione, type Contenuto } from "@/lib/data/store/cassettine";
import { useRitiraDock } from "@/components/ui/dock-sipario";

let conflitto: ConflittoVersione | null = null;
const listeners = new Set<() => void>();
function notify() {
  for (const l of listeners) l();
}

export function apriConflitto(c: ConflittoVersione): void {
  conflitto = c;
  notify();
}

export function chiudiConflitto(): void {
  conflitto = null;
  notify();
}

function useConflitto(): ConflittoVersione | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => conflitto,
    () => null,
  );
}

export const SEPARATORE_ALTRA_VERSIONE = "\n\n--- dall'altra versione ---\n\n";

/** Le due versioni unite: la scelta in testa, l'altra in fondo, sotto un separatore. */
export function unisciVersioni(scelta: Contenuto, altra: Contenuto): Contenuto {
  const coda = altra.transcript.trim();
  if (!coda || coda === scelta.transcript.trim()) return scelta;
  return {
    ...scelta,
    transcript: `${scelta.transcript.trimEnd()}${SEPARATORE_ALTRA_VERSIONE}${coda}`,
  };
}

/** Le frasi che stanno in una versione e non nell'altra, per evidenziarle. */
function frasiDiverse(a: string, b: string): Set<string> {
  const frasi = (s: string) => s.split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
  const altre = new Set(frasi(b));
  return new Set(frasi(a).filter((f) => !altre.has(f)));
}

function Anteprima({ testo, diverse }: { testo: string; diverse: Set<string> }) {
  const pezzi = testo.split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
  return (
    <p className="jm-conflitto-p">
      {pezzi.map((f, i) => (
        <span key={i}>
          {diverse.has(f) ? <mark>{f}</mark> : f}{" "}
        </span>
      ))}
    </p>
  );
}

export function ConflittoGiornata() {
  const c = useConflitto();
  // Le cassettine avvisano qui ogni conflitto, da qualunque scrittura.
  useEffect(() => suConflitto(apriConflitto), []);
  if (!c) return null;
  return <Foglio c={c} />;
}

function Foglio({ c }: { c: ConflittoVersione }) {
  const t = useT();
  useRitiraDock();
  const [busy, setBusy] = useState<null | "mia" | "loro" | "tutte">(null);
  const [errore, setErrore] = useState<string | null>(null);

  const diverseLoro = frasiDiverse(c.loro.contenuto.transcript, c.mia.transcript);
  const diverseMie = frasiDiverse(c.mia.transcript, c.loro.contenuto.transcript);
  const quando = formatDate(new Date(c.loro.updatedAt), { hour: "2-digit", minute: "2-digit" });
  const giorno = formatDate(parseISODate(c.giorno), { weekday: "long", day: "numeric", month: "long" });

  async function scegli(quale: "mia" | "loro" | "tutte") {
    setBusy(quale);
    setErrore(null);
    try {
      if (quale === "loro") {
        // Vince cio che sta sul server: non si scrive niente, si rilegge.
        invalidateAll();
      } else if (quale === "mia") {
        await risolviConflitto(c.giorno, c.mia);
      } else {
        await risolviConflitto(c.giorno, unisciVersioni(c.loro.contenuto, c.mia));
      }
      chiudiConflitto();
      window.dispatchEvent(new CustomEvent("jm:conflitto-risolto", { detail: { giorno: c.giorno, scelta: quale } }));
    } catch (e) {
      setErrore((e as Error)?.message ?? String(e));
      setBusy(null);
    }
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="jm-conflitto" role="dialog" aria-modal="true" aria-label={t("Giornata modificata altrove")}>
      <div className="jm-conflitto-box">
        <div className="jm-conflitto-testa">
          <span className="jm-conflitto-titolo">{t("Giornata modificata altrove")}</span>
        </div>
        <h2 className="jm-conflitto-h2">
          {t("{giorno} e cambiata su un altro dispositivo mentre la scrivevi qui.").replace("{giorno}", giorno)}
        </h2>
        <p className="jm-conflitto-intro">
          {t("Ci sono due versioni. Scegli quale tenere, oppure tienile tutte e due: l'altra finisce in fondo al racconto.")}
        </p>

        <div className="jm-conflitto-ver">
          <div className="jm-conflitto-k">
            <span>{t("Sull'altro dispositivo")}</span>
            <b>{quando}</b>
          </div>
          {c.loro.contenuto.headline ? <div className="jm-conflitto-t">{c.loro.contenuto.headline}</div> : null}
          <Anteprima testo={c.loro.contenuto.transcript} diverse={diverseLoro} />
          <Button variant="ghost" onClick={() => scegli("loro")} disabled={busy !== null}>
            {busy === "loro" ? t("Un attimo...") : t("Tieni questa")}
          </Button>
        </div>

        <div className="jm-conflitto-ver jm-conflitto-mia">
          <div className="jm-conflitto-k">
            <span>{t("Qui, non ancora salvata")}</span>
            <b>{t("adesso")}</b>
          </div>
          {c.mia.headline ? <div className="jm-conflitto-t">{c.mia.headline}</div> : null}
          <Anteprima testo={c.mia.transcript} diverse={diverseMie} />
          <Button onClick={() => scegli("mia")} disabled={busy !== null}>
            {busy === "mia" ? t("Un attimo...") : t("Tieni questa")}
          </Button>
        </div>

        <Button variant="ghost" className="jm-conflitto-tutte" onClick={() => scegli("tutte")} disabled={busy !== null}>
          {busy === "tutte" ? t("Un attimo...") : t("Tienile tutte e due")}
        </Button>
        {errore ? <p className="jm-conflitto-errore">{errore}</p> : null}
      </div>
    </div>,
    document.body,
  );
}
