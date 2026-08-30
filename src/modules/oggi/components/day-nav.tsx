"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DatePickerPopover } from "@/modules/oggi/components/date-picker-popover";
import {
  compactDayDate,
  parseISODate,
  relativeDayLabel,
  todayISO,
} from "@/lib/format";
import { useT } from "@/lib/i18n";

/**
 * La testata che cambia giorno (mockup navigazione-giorno.html, variante A,
 * scelta da Manuel il 29 agosto 2026).
 *
 * Due piani: sopra come si chiama il giorno ("Oggi", "Ieri", "Mercoledi"),
 * sotto la data esatta. Ai lati due frecce; il centro apre il calendario
 * che il modulo ha gia (date-picker-popover.tsx).
 *
 * LA REGOLA CHE NON SI PIEGA: il passato si sfoglia senza fondo, il futuro
 * no. Sull'oggi la freccia destra e spenta e nessuna strada — freccia,
 * dito o tastiera — porta a domani. Il diario del domani sarebbe una
 * promessa che l'app non puo mantenere.
 *
 * Dove va il giorno scelto:
 *   - oggi          -> "/" (Oggi e la casa di oggi, con il microfono)
 *   - altro giorno  -> onVai, se la schermata sa cambiare da sola
 *                      (day-client lo fa: resta sul posto e scorre);
 *                      altrimenti /giorno?d=YYYY-MM-DD.
 */

/** Il giorno prima, in formato YYYY-MM-DD. */
export function giornoPrima(iso: string): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() - 1);
  return todayISO(d);
}

/** Il giorno dopo, in formato YYYY-MM-DD. */
export function giornoDopo(iso: string): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + 1);
  return todayISO(d);
}

/**
 * Il muro: questa data e oltre oggi?
 * Il confronto e fra stringhe YYYY-MM-DD, che si ordinano da sole: niente
 * fusi orari, niente ore, niente sorprese a mezzanotte.
 */
export function eFuturo(iso: string): boolean {
  return iso > todayISO();
}

type Props = {
  /** La giornata mostrata adesso, YYYY-MM-DD. */
  date: string;
  /**
   * Se c'e, il cambio giorno lo gestisce la schermata senza cambiare
   * pagina. Non viene chiamato per "oggi": quello e sempre "/".
   */
  onVai?: (iso: string) => void;
  /**
   * Ogni volta che questo numero cresce, compare per un secondo e mezzo la
   * riga che spiega il muro. Lo alza chi intercetta un gesto verso domani
   * (day-swipe): la freccia, da spenta, non puo dirlo da sola.
   */
  muro?: number;
  /**
   * Toglie il nome del giorno SUL TELEFONO, lasciando solo la data.
   * Lo passa Oggi (30 agosto 2026, scelta di Manuel): li sopra c'e gia la
   * barra dell'app che dice "Oggi", e la parola finiva scritta due volte a
   * pochi pixel di distanza. Da lg la barra non esiste e il nome resta.
   * Su /giorno NON si passa: li il nome ("Ieri", "Mercoledi") e l'unica
   * cosa che ti dice che giorno stai guardando.
   */
  senzaNomeSulTelefono?: boolean;
};

export function DayNav({
  date,
  onVai,
  muro = 0,
  senzaNomeSulTelefono = false,
}: Props) {
  const t = useT();
  const router = useRouter();
  const [calendario, setCalendario] = useState(false);
  const [sussurro, setSussurro] = useState(false);
  /* Il colpo contro il muro arriva da fuori come un numero che cresce.
     Si confronta durante il disegno e non dentro un effetto: cosi la riga
     compare nello stesso istante del gesto, senza un giro in piu. */
  const [ultimoMuro, setUltimoMuro] = useState(muro);
  if (muro !== ultimoMuro) {
    setUltimoMuro(muro);
    setSussurro(muro > 0);
  }

  const oggi = todayISO();
  const suOggi = date >= oggi;
  const dataObj = parseISODate(date);

  const vai = useCallback(
    (iso: string) => {
      if (eFuturo(iso)) return;
      if (iso === todayISO()) {
        router.push("/");
        return;
      }
      if (onVai) {
        onVai(iso);
        return;
      }
      router.push(`/giorno?d=${iso}`);
    },
    [onVai, router],
  );

  /* Acceso dal gesto, spento da solo dopo un secondo e mezzo. */
  useEffect(() => {
    if (!sussurro) return;
    const id = setTimeout(() => setSussurro(false), 1500);
    return () => clearTimeout(id);
  }, [sussurro]);

  /* Le frecce della tastiera, per il desktop: li il dito non c'e.
     Mai mentre si scrive, o cambierebbe giorno a chi sposta il cursore. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || el?.isContentEditable) return;
      if (e.key === "ArrowLeft") vai(giornoPrima(date));
      if (e.key === "ArrowRight" && !suOggi) vai(giornoDopo(date));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [date, suOggi, vai]);

  return (
    <div className="jm-day-nav">
      <button
        type="button"
        className="jm-day-nav-arw"
        aria-label={t("Giorno prima")}
        onClick={() => vai(giornoPrima(date))}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          width="19"
          height="19"
          aria-hidden="true"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <button
        type="button"
        className="jm-day-nav-ctr"
        aria-label={t("Scegli il giorno")}
        onClick={() => setCalendario(true)}
        suppressHydrationWarning
      >
        <span
          className={`jm-day-nav-rel${
            senzaNomeSulTelefono ? " jm-solo-desktop" : ""
          }`}
        >
          {relativeDayLabel(dataObj, parseISODate(oggi))}
        </span>
        <span className="jm-day-nav-abs">{compactDayDate(dataObj)}</span>
      </button>

      <button
        type="button"
        className="jm-day-nav-arw"
        aria-label={t("Giorno dopo")}
        disabled={suOggi}
        onClick={() => vai(giornoDopo(date))}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          width="19"
          height="19"
          aria-hidden="true"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>

      {/* Il muro non e un errore: e un bordo. Nessuna vibrazione, nessun
          toast rosso — una riga che si dissolve. */}
      <div
        className={`jm-day-nav-muro${sussurro ? " on" : ""}`}
        role="status"
        aria-live="polite"
      >
        {sussurro ? t("Domani non e ancora successo") : ""}
      </div>

      <DatePickerPopover
        open={calendario}
        selected={date}
        onSelect={(iso) => {
          setCalendario(false);
          vai(iso);
        }}
        onClose={() => setCalendario(false)}
      />
    </div>
  );
}
