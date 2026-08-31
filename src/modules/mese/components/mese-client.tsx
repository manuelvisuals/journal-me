"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { TabBar } from "@/components/ui/tab-bar";
import { AppBarAzione } from "@/components/ui/app-bar";
import { JumpPicker } from "@/modules/mese/components/jump-picker";
import { MonthSection } from "@/modules/mese/components/month-section";
import { MeseGrid } from "@/modules/mese/components/mese-grid";
import { MeseMini } from "@/modules/mese/components/mese-mini";
import { setVistaGriglia, useVistaGriglia } from "@/modules/mese/vista";
import { DaySwipe } from "@/modules/oggi";
import { useIsDesktop } from "@/components/desktop/use-is-desktop";
import { formatMonthTitle, daysInMonth, nowAppParts } from "@/lib/format";
import { useT } from "@/lib/i18n";
import {
  loadMonthEntries,
  type DataMode,
} from "@/lib/data/entries";
import type { Entry } from "@/lib/types";

/**
 * Un mese avanti o indietro, senza mai costruire una Date: il mese come
 * indice assoluto non ha casi limite a dicembre e non tocca il fuso, che
 * qui sarebbe l'unico modo di sbagliare (HANDOVER, la regola su APP_TZ).
 */
function stepMonth(
  m: { year: number; month: number },
  delta: number,
): { year: number; month: number } {
  const idx = m.year * 12 + (m.month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

type LoadedMonth = {
  year: number;
  month: number; // 1-based
  entries: Entry[];
};

type Props = {
  mode: DataMode;
  initialMonth: LoadedMonth;
};

export function MeseClient({ mode, initialMonth }: Props) {
  const t = useT();
  const router = useRouter();
  const [loaded, setLoaded] = useState<LoadedMonth[]>([initialMonth]);
  const [currentMonth, setCurrentMonth] = useState<{
    year: number;
    month: number;
  }>({ year: initialMonth.year, month: initialMonth.month });
  const [pickerOpen, setPickerOpen] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  // Day currently navigating to its detail view — drives the row spinner so
  // the tap never feels like a freeze while the server renders the day.
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [, startNav] = useTransition();

  // Today, captured once on mount. useState with lazy init so it's stable
  // across renders without triggering the react-hooks/refs rule.
  const [today] = useState<{ year: number; month: number; day: number }>(
    () => nowAppParts(),
  );

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // --- Mese a griglia, solo desktop (PR 9, SPEC-v2 §5.6) ---
  // Cache separata dal feed: il feed e una LISTA ordinata dal piu recente
  // al piu vecchio e appenderci un mese arbitrario dal picker romperebbe
  // l'ordine cronologico sotto lg.
  const isDesktop = useIsDesktop();
  // Lista o griglia sul telefono: la scelta si ricorda (vista.ts).
  const griglia = useVistaGriglia();
  const [deskMonth, setDeskMonth] = useState<{ year: number; month: number }>({
    year: initialMonth.year,
    month: initialMonth.month,
  });
  const [deskCache, setDeskCache] = useState<Record<string, Entry[]>>({
    [`${initialMonth.year}-${initialMonth.month}`]: initialMonth.entries,
  });
  /* I mesi gia chiesti (non ancora per forza arrivati): vedi leggi(). */
  const chiesti = useRef<Set<string>>(
    new Set([`${initialMonth.year}-${initialMonth.month}`]),
  );
  const deskKey = `${deskMonth.year}-${deskMonth.month}`;
  const deskEntries = deskCache[deskKey];

  useEffect(() => {
    // La stessa cache serve alla griglia grande (desktop) e a quella
    // compatta del telefono: e sempre "un mese per volta".
    if (!isDesktop && !griglia) return;
    let cancelled = false;

    /* Il mese che serve ADESSO, e subito dopo i due vicini.
       Il precaricamento non e una rifinitura: il dito che sfoglia arriva
       sul mese vicino in 260ms, e senza questo ogni sfogliata mostrerebbe
       l'attesa anche quando la risposta e a un passo. Il mese davanti si
       legge solo se esiste davvero (oltre oggi non c'e niente da leggere:
       sarebbe una chiamata di rete per tornare sempre vuota). */
    const leggi = async (m: { year: number; month: number }) => {
      const k = `${m.year}-${m.month}`;
      /* Il registro dei mesi gia chiesti sta in un ref e non nello stato:
         serve a non chiedere due volte lo stesso mese, e leggerlo dallo
         stato qui dentro vorrebbe dire rimettere deskCache fra le
         dipendenze, cioe rifare il giro a ogni mese che arriva. */
      if (chiesti.current.has(k)) return;
      chiesti.current.add(k);
      const entries = await loadMonthEntries(mode, m.year, m.month);
      if (cancelled) return;
      setDeskCache((prev) =>
        prev[k] !== undefined ? prev : { ...prev, [k]: entries },
      );
    };

    void (async () => {
      await leggi(deskMonth);
      if (cancelled) return;
      await leggi(stepMonth(deskMonth, -1));
      if (cancelled) return;
      const dopo = stepMonth(deskMonth, 1);
      const nelFuturo =
        dopo.year > today.year ||
        (dopo.year === today.year && dopo.month > today.month);
      if (!nelFuturo) await leggi(dopo);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop, griglia, deskKey]);

  // initialMonth.entries is always populated server-side now.

  const loadOlder = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    const oldest = loaded[loaded.length - 1];
    let prevYear = oldest.year;
    let prevMonth = oldest.month - 1;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear -= 1;
    }
    const entries = await loadMonthEntries(mode, prevYear, prevMonth);
    setLoaded((prev) => [
      ...prev,
      { year: prevYear, month: prevMonth, entries },
    ]);
    setLoadingMore(false);
  }, [loaded, loadingMore, mode]);

  // Sentinel-based infinite scroll for loading older months.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void loadOlder();
        }
      },
      { rootMargin: "200px 0px 0px 0px", threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadOlder]);

  // Header sticky: observe each <section data-jm-month> and update title to
  // whichever section currently occupies the top of the viewport area.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const sections = container.querySelectorAll<HTMLElement>("section[data-jm-month]");
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the topmost intersecting section.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length === 0) return;
        const m = visible[0].target.getAttribute("data-jm-month");
        if (!m) return;
        const [y, mo] = m.split("-").map(Number);
        setCurrentMonth((prev) =>
          prev.year === y && prev.month === mo ? prev : { year: y, month: mo },
        );
      },
      {
        root: null,
        // Trigger when section is in the strip just under the sticky header
        // (~64px tall). The negative bottom margin means we only care about
        // sections crossing the top region.
        rootMargin: "-64px 0px -80% 0px",
        threshold: 0,
      },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [loaded]);

  const handlePickerSelect = async (year: number, month: number) => {
    setPickerOpen(false);
    // Su desktop il picker cambia il mese della griglia, non scrolla il feed.
    if (isDesktop || griglia) {
      setDeskMonth({ year, month });
      return;
    }
    // Already loaded?
    const existing = loaded.find((m) => m.year === year && m.month === month);
    if (existing) {
      scrollToMonth(year, month);
      return;
    }
    // Target must be older than oldest (picker disables future months).
    const oldest = loaded[loaded.length - 1];
    if (year > oldest.year || (year === oldest.year && month >= oldest.month)) {
      // Shouldn't reach here: picker disables future, and same-month already handled.
      return;
    }
    // Load all intervening months in series, then scroll.
    setLoadingMore(true);
    const next: LoadedMonth[] = [...loaded];
    let curY = oldest.year;
    let curM = oldest.month;
    while (curY > year || (curY === year && curM > month)) {
      curM -= 1;
      if (curM === 0) {
        curM = 12;
        curY -= 1;
      }
      const entries = await loadMonthEntries(mode, curY, curM);
      next.push({ year: curY, month: curM, entries });
    }
    setLoaded(next);
    setLoadingMore(false);
    // Wait a tick for the DOM, then scroll.
    requestAnimationFrame(() => scrollToMonth(year, month));
  };

  const scrollToMonth = (year: number, month: number) => {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const el = document.querySelector(`section[data-jm-month="${key}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Counter "X / Y": X = entries this month, Y = days passed (or total if past)
  const visibleMonth = loaded.find(
    (m) => m.year === currentMonth.year && m.month === currentMonth.month,
  );
  const counter = visibleMonth ? counterFor(visibleMonth, today) : null;

  // In griglia si guarda UN mese per volta, come sul computer: il titolo,
  // il contatore e le frecce parlano di quello, non di cio che il feed ha
  // sotto il dito (il feed in griglia non esiste piu).
  const mesePieno = isDesktop || griglia ? deskMonth : currentMonth;
  const counterGriglia =
    griglia && deskEntries !== undefined
      ? counterFor(
          { year: deskMonth.year, month: deskMonth.month, entries: deskEntries },
          today,
        )
      : null;
  const contatore = griglia ? counterGriglia : counter;
  const meseCorrente =
    deskMonth.year === today.year && deskMonth.month === today.month;

  return (
    <main
      ref={scrollRef}
      className="jm-screen mx-auto flex w-full max-w-[440px] lg:max-w-none flex-1 flex-col"
    >
      {/* Mese a griglia: esiste solo da lg (CSS), il telefono non lo vede */}
      {deskEntries !== undefined && (
        <MeseGrid
          year={deskMonth.year}
          month={deskMonth.month}
          entries={deskEntries}
          today={today}
          onTitleClick={() => setPickerOpen(true)}
          onStep={(delta) => setDeskMonth((m) => stepMonth(m, delta))}
          onDayClick={(iso) => {
            setPendingDate(iso);
            startNav(() => {
              router.push(`/app/giorno?d=${iso}`);
            });
          }}
          onWriteToday={() => router.push("/app")}
        />
      )}

      {/* IL TASTO DELLA VISTA E SALITO NELLA BARRA IN ALTO (mockup
          mese-testata.html, strada A, 30 agosto 2026): non cambia COSA
          guardi ma COME lo guardi, quindi non stava nella riga del mese,
          che e navigazione. E dove Calendario di Apple mette lo stesso
          comando. Da lg la barra non si disegna e il tasto sparisce con
          lei: giusto, perche sul computer comanda sempre la griglia
          grande. */}
      <AppBarAzione>
        <button
          type="button"
          className="jm-mese-vista"
          aria-pressed={griglia}
          aria-label={
            griglia ? t("Torna alla lista") : t("Vedi il mese a griglia")
          }
          onClick={() => setVistaGriglia(!griglia)}
        >
          {griglia ? (
            /* Una LISTA: righe corte col puntino davanti. NON tre righe
               uguali: quel disegno in iOS vuol dire "menu", cioe apre un
               cassetto di comandi, e il tasto prometteva una cosa e ne
               dava un'altra. */
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="4.5" cy="7" r="1.3" />
              <circle cx="4.5" cy="12" r="1.3" />
              <circle cx="4.5" cy="17" r="1.3" />
              <path d="M9 7h11M9 12h11M9 17h11" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
              <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
              <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
              <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
            </svg>
          )}
        </button>
      </AppBarAzione>

      {/* La riga del mese (solo telefono: da lg comanda la griglia).
          Il top NON e piu zero: sopra c'e la barra dell'app (sticky anche
          lei), e un mese incollato a zero le finirebbe sotto. */}
      <header
        className={`jm-month-header${griglia ? " nav" : ""} lg:hidden`}
        style={{ position: "sticky", top: "var(--jm-appbar-h)" }}
      >
        {/* In griglia la riga e un navigatore e basta: freccia, nome,
            freccia. Le due frecce stanno in due colonne di larghezza
            FISSA agli estremi, cosi non si spostano di un pixel quando
            il nome passa da "Maggio" a "Settembre" (richiesta di Manuel,
            30 agosto 2026). Il titolo vive nella colonna elastica in
            mezzo e resta il tasto che apre il salto lungo. */}
        {griglia && (
          <button
            type="button"
            className="jm-mese-nav"
            onClick={() => setDeskMonth((m) => stepMonth(m, -1))}
            aria-label={t("Mese precedente")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}

        <button
          type="button"
          className="jm-month-title"
          onClick={() => setPickerOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={pickerOpen}
        >
          <span className="jm-month-nome" suppressHydrationWarning>
            {formatMonthTitle(mesePieno.year, mesePieno.month)}
          </span>
          <span className="jm-month-chevron">&#9662;</span>
        </button>

        {griglia ? (
          /* Sul mese corrente la freccia si SPEGNE e non sparisce:
             sparire rimetterebbe in movimento la riga che stiamo
             inchiodando. */
          <button
            type="button"
            className="jm-mese-nav"
            onClick={() => setDeskMonth((m) => stepMonth(m, 1))}
            disabled={meseCorrente}
            aria-label={t("Mese successivo")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        ) : (
          /* Nella lista non ci sono frecce (il mese lo si scorre) e il
             contatore torna al suo posto a destra. */
          contatore && (
            <span className="jm-month-count">
              {contatore.done} / {contatore.total}
            </span>
          )
        )}
      </header>

      {/* Griglia compatta: UN mese, quanto sta nello schermo, senza il
          mese dopo che sbava da sotto. Il feed non c'e proprio: non e
          nascosto, non e montato. */}
      {griglia && (
        <div className="jm-mese-solo lg:hidden">
          {/* Si sfoglia col dito, con lo STESSO gesto della giornata
              (@/modules/oggi, day-swipe): trascini verso destra e arriva
              il mese prima, che entra da sinistra — dov'e la freccia "<".
              Le due strade, le frecce e il dito, non si contraddicono mai.
              Il gesto tiene ferma la pagina mentre il dito va di lato, ed
              e il motivo per cui si riusa questo invece di riscriverne uno:
              quella parte era gia costata un giro di correzioni.
              L'intestazione resta FUORI dal piano che scorre: e lei a dire
              dove sei finito, e deve stare ferma per poterlo dire. */}
          <DaySwipe
            onPrima={() => setDeskMonth((m) => stepMonth(m, -1))}
            onDopo={() => setDeskMonth((m) => stepMonth(m, 1))}
            muroDopo={meseCorrente}
          >
            {deskEntries === undefined ? (
              /* Un attimo di attesa, non un mese vuoto: disegnare trentun
                 quadratini spenti mentre li stiamo ancora leggendo direbbe
                 "non hai raccontato niente", che e falso. */
              <div className="jm-mese-attesa">
                <span className="jm-dot-pulse" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            ) : (
              <MeseMini
                /* Cambiando mese il quadratino scelto non ha piu senso:
                   la chiave lo fa ripartire pulito invece di lasciare
                   selezionato il 26 di un mese che non stai piu guardando. */
                key={deskKey}
                year={deskMonth.year}
                month={deskMonth.month}
                entries={deskEntries}
                today={today}
                onDayClick={(iso) => {
                  setPendingDate(iso);
                  startNav(() => {
                    router.push(`/app/giorno?d=${iso}`);
                  });
                }}
              />
            )}
          </DaySwipe>
        </div>
      )}

      {/* Day list (solo telefono: da lg c'e la griglia) */}
      {!griglia && (
      <div className="jm-day-list lg:hidden">
        {loaded.map((m, idx) => (
          <MonthSection
            key={`${m.year}-${m.month}`}
            year={m.year}
            month={m.month}
            entries={m.entries}
            // The first (most recent) month is implicitly labeled by the
            // sticky page header. Subsequent months get an inline divider.
            showHeader={idx > 0}
            loadingDate={pendingDate}
            onDayClick={(year, month, day) => {
              const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              setPendingDate(iso);
              startNav(() => {
                router.push(`/app/giorno?d=${iso}`);
              });
            }}
          />
        ))}
        <div ref={sentinelRef} style={{ height: 1 }} aria-hidden="true" />
        {loadingMore && (
          <div
            style={{
              padding: 16,
              textAlign: "center",
              fontSize: "calc(11px * var(--jm-ui-scale))",
              fontWeight: 600,
              color: "var(--color-ink-faint)",
              letterSpacing: "0.20em",
              textTransform: "uppercase",
            }}
          >
            {t("carico...")}
          </div>
        )}
      </div>
      )}

      <TabBar active="month" />

      <JumpPicker
        open={pickerOpen}
        currentYear={mesePieno.year}
        currentMonth={mesePieno.month}
        todayYear={today.year}
        todayMonth={today.month}
        onSelect={handlePickerSelect}
        onClose={() => setPickerOpen(false)}
      />
    </main>
  );
}

function counterFor(
  m: LoadedMonth,
  today: { year: number; month: number; day: number },
) {
  const isCurrent = m.year === today.year && m.month === today.month;
  const total = isCurrent ? today.day : daysInMonth(m.year, m.month);
  const done = m.entries.length;
  return { done, total };
}
