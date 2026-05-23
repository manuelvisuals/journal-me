"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { TabBar } from "@/components/ui/tab-bar";
import { JumpPicker } from "@/components/mese/jump-picker";
import { MonthSection } from "@/components/mese/month-section";
import { formatMonthTitle, daysInMonth, nowAppParts } from "@/lib/format";
import {
  loadMonthEntries,
  type DataMode,
} from "@/lib/data/entries";
import type { Entry } from "@/lib/types";

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

  return (
    <main
      ref={scrollRef}
      className="mx-auto flex w-full max-w-[440px] flex-1 flex-col"
      style={{ minHeight: "100dvh" }}
    >
      {/* Sticky month header */}
      <header
        className="jm-month-header"
        style={{ position: "sticky", top: 0 }}
      >
        <button
          type="button"
          className="jm-month-title"
          onClick={() => setPickerOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={pickerOpen}
        >
          <span suppressHydrationWarning>
            {formatMonthTitle(currentMonth.year, currentMonth.month)}
          </span>
          <span className="jm-month-chevron">&#9662;</span>
        </button>
        {counter && (
          <span className="jm-month-count">
            {counter.done} / {counter.total}
          </span>
        )}
      </header>

      {/* Day list */}
      <div className="jm-day-list">
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
                router.push(`/giorno/${iso}`);
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
              fontSize: 11,
              fontWeight: 600,
              color: "var(--color-ink-faint)",
              letterSpacing: "0.20em",
              textTransform: "uppercase",
            }}
          >
            carico...
          </div>
        )}
      </div>

      <TabBar active="month" />

      <JumpPicker
        open={pickerOpen}
        currentYear={currentMonth.year}
        currentMonth={currentMonth.month}
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
