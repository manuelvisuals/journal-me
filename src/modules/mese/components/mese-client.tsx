"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { TabBar } from "@/components/ui/tab-bar";
import { JumpPicker } from "@/modules/mese/components/jump-picker";
import { MonthSection } from "@/modules/mese/components/month-section";
import { MeseGrid } from "@/modules/mese/components/mese-grid";
import { MeseMini } from "@/modules/mese/components/mese-mini";
import { setVistaGriglia, useVistaGriglia } from "@/modules/mese/vista";
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
  const deskKey = `${deskMonth.year}-${deskMonth.month}`;
  const deskEntries = deskCache[deskKey];

  useEffect(() => {
    // La stessa cache serve alla griglia grande (desktop) e a quella
    // compatta del telefono: e sempre "un mese per volta".
    if ((!isDesktop && !griglia) || deskCache[deskKey] !== undefined) return;
    let cancelled = false;
    void (async () => {
      const entries = await loadMonthEntries(
        mode,
        deskMonth.year,
        deskMonth.month,
      );
      if (cancelled) return;
      setDeskCache((prev) => ({ ...prev, [deskKey]: entries }));
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
              router.push(`/giorno?d=${iso}`);
            });
          }}
          onWriteToday={() => router.push("/")}
        />
      )}

      {/* Sticky month header (solo telefono: da lg comanda la griglia).
          Il top NON e piu zero: sopra c'e la barra dell'app (sticky anche
          lei), e un mese incollato a zero le finirebbe sotto. */}
      <header
        className="jm-month-header lg:hidden"
        style={{ position: "sticky", top: "var(--jm-appbar-h)" }}
      >
        <button
          type="button"
          className="jm-month-title"
          onClick={() => setPickerOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={pickerOpen}
        >
          <span suppressHydrationWarning>
            {formatMonthTitle(mesePieno.year, mesePieno.month)}
          </span>
          <span className="jm-month-chevron">&#9662;</span>
        </button>
        <span className="jm-month-right">
          {/* In griglia il mese non si scorre piu: si cambia con le frecce,
              come sul computer. Il salto lungo resta sul titolo. */}
          {griglia && (
            <span className="jm-mese-navpair">
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
            </span>
          )}
          {/* Il contatore sta nella lista. In griglia sparisce: le due
              frecce hanno bisogno di quello spazio, e il conto dei giorni
              raccontati la griglia lo dice gia coi quadratini pieni. */}
          {!griglia && contatore && (
            <span className="jm-month-count">
              {contatore.done} / {contatore.total}
            </span>
          )}
          {/* Lista <-> griglia. Un solo bottone, nello stesso punto:
              acceso mostra la lista (la via del ritorno), spento mostra
              i quadratini (la via dell'andata). */}
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
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
                <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
                <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
                <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
              </svg>
            )}
          </button>
        </span>
      </header>

      {/* Griglia compatta: UN mese, quanto sta nello schermo, senza il
          mese dopo che sbava da sotto. Il feed non c'e proprio: non e
          nascosto, non e montato. */}
      {griglia && deskEntries !== undefined && (
        <div className="jm-mese-solo lg:hidden">
          <MeseMini
            year={deskMonth.year}
            month={deskMonth.month}
            entries={deskEntries}
            today={today}
            onDayClick={(iso) => {
              setPendingDate(iso);
              startNav(() => {
                router.push(`/giorno?d=${iso}`);
              });
            }}
          />
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
                router.push(`/giorno?d=${iso}`);
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
