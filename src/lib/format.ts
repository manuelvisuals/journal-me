import { localeTag, t } from "@/lib/i18n";

/**
 * Il locale non e piu una costante: dal bilingue (task 27) segue la lingua
 * scelta. `localeTag()` risponde "it-IT" o "en-GB". Resta una FUNZIONE e
 * non un valore letto una volta sola: cambiare lingua da Impostazioni deve
 * cambiare subito virgole decimali e nomi dei mesi, senza un reload.
 */
function loc(): string {
  return localeTag();
}

export function formatNumber(
  n: number,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(loc(), options).format(n);
}

export function formatCurrency(n: number, currency: string = "EUR"): string {
  return new Intl.NumberFormat(loc(), {
    style: "currency",
    currency,
  }).format(n);
}

export function formatPercent(n: number, fractionDigits: number = 1): string {
  return new Intl.NumberFormat(loc(), {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n);
}

export function formatDecimal(n: number, fractionDigits: number = 2): string {
  return new Intl.NumberFormat(loc(), {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n);
}

export function formatDate(
  d: Date | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(loc(), options).format(date);
}

/**
 * Manuel's timezone. The app is single-user (Italy), and "today" must be
 * computed in ONE timezone — otherwise the server (UTC on Vercel) and the
 * client (Europe/Rome) disagree by a day around UTC midnight, which for a
 * night-time journaling app means a recording can land on the wrong day and
 * the Today view can show a different date than the one the entry saved to.
 */
export const APP_TZ = "Europe/Rome" as const;

/** Current calendar date in APP_TZ, as numeric parts. Stable on server+client. */
export function nowAppParts(): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  // `type` e non `t`: `t` ora e la funzione di traduzione importata in
  // cima, e ombreggiarla qui dentro si legge male.
  const val = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: val("year"), month: val("month"), day: val("day") };
}

/** A Date positioned at noon of today's APP_TZ calendar date (display-safe). */
function appNoonDate(): Date {
  const { year, month, day } = nowAppParts();
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/**
 * Intestazione breve del giorno, tipo "Lun . 18 Mag" (in inglese
 * "Mon . 18 May").
 * Uses non-breaking separator and capitalizes the day/month abbreviations.
 * With no argument it reflects today's date in APP_TZ (consistent SSR/CSR).
 */
export function formatDayHeader(d: Date = appNoonDate()): string {
  const weekday = new Intl.DateTimeFormat(loc(), { weekday: "short" })
    .format(d)
    .replace(/\.$/, "");
  const day = d.getDate();
  const month = new Intl.DateTimeFormat(loc(), { month: "short" })
    .format(d)
    .replace(/\.$/, "");
  const cap = (s: string) =>
    s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  return `${cap(weekday)} . ${day} ${cap(month)}`;
}

/**
 * Date as YYYY-MM-DD for DB entry_date keys. With no argument it returns
 * today's date in APP_TZ (so server and client always agree); with an explicit
 * Date it formats that date's local parts.
 */
export function todayISO(d?: Date): string {
  if (d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  const { year, month, day } = nowAppParts();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Format a duration in seconds as MM:SS (no hours). */
export function formatDurationMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/** "Maggio 2026" / "May 2026" — nome del mese per esteso + anno. */
export function formatMonthTitle(year: number, month: number): string {
  const d = new Date(year, month - 1, 1);
  const m = new Intl.DateTimeFormat(loc(), { month: "long" }).format(d);
  const cap = m.charAt(0).toUpperCase() + m.slice(1);
  return `${cap} ${year}`;
}

/** Abbreviazione del mese, con l'iniziale grande e senza punto: "Mag". */
export function shortMonthAbbr(year: number, month: number): string {
  const d = new Date(year, month - 1, 1);
  const m = new Intl.DateTimeFormat(loc(), { month: "short" })
    .format(d)
    .replace(/\.$/, "");
  return m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
}

/** Giorno della settimana abbreviato: "Mer", "Gio", "Wed", "Thu". */
export function shortWeekday(d: Date): string {
  const w = new Intl.DateTimeFormat(loc(), { weekday: "short" })
    .format(d)
    .replace(/\.$/, "");
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

/** Number of days in the given (1-based) month. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Build "YYYY-MM-DD" key from year/month(1-based)/day. */
export function dateKey(year: number, month: number, day: number): string {
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

/** Format a sleep duration in fractional hours as "Xh YY" (e.g. 7.2 -> "7h 12"). */
export function formatSleep(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${String(m).padStart(2, "0")}`;
}

/** Parse "YYYY-MM-DD" into a Date at local midday (timezone-safe for display). */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

/** Compact display "Mer . 20 Mag" for a Date. */
export function compactDayDate(d: Date): string {
  const wd = new Intl.DateTimeFormat(loc(), { weekday: "short" })
    .format(d)
    .replace(/\.$/, "");
  const day = d.getDate();
  const month = new Intl.DateTimeFormat(loc(), { month: "short" })
    .format(d)
    .replace(/\.$/, "");
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  return `${cap(wd)} ${day} ${cap(month)}`;
}

/** Giorno della settimana per esteso: "Lunedi", "Monday". */
export function fullWeekday(d: Date): string {
  const w = new Intl.DateTimeFormat(loc(), { weekday: "long" }).format(d);
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

/**
 * Relative label for a date vs today:
 *   target === today           -> "Oggi"
 *   target === today - 1 day   -> "Ieri"
 *   else within last 6 days    -> full weekday name ("Lunedi")
 *   else                       -> compactDayDate fallback
 */
export function relativeDayLabel(target: Date, today: Date): string {
  const ms = today.setHours(12, 0, 0, 0) - new Date(target).setHours(12, 0, 0, 0);
  const days = Math.round(ms / (24 * 60 * 60 * 1000));
  if (days === 0) return t("Oggi");
  if (days === 1) return t("Ieri");
  if (days >= 2 && days <= 6) return fullWeekday(target);
  return compactDayDate(target);
}
