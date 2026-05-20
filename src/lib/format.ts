export const LOCALE = "it-IT" as const;

export function formatNumber(
  n: number,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(LOCALE, options).format(n);
}

export function formatCurrency(n: number, currency: string = "EUR"): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
  }).format(n);
}

export function formatPercent(n: number, fractionDigits: number = 1): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n);
}

export function formatDecimal(n: number, fractionDigits: number = 2): string {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n);
}

export function formatDate(
  d: Date | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(LOCALE, options).format(date);
}

/**
 * Italian short day header, like "Lun . 18 Mag".
 * Uses non-breaking separator and capitalizes the day/month abbreviations.
 */
export function formatDayHeader(d: Date = new Date()): string {
  const weekday = new Intl.DateTimeFormat(LOCALE, { weekday: "short" })
    .format(d)
    .replace(/\.$/, "");
  const day = d.getDate();
  const month = new Intl.DateTimeFormat(LOCALE, { month: "short" })
    .format(d)
    .replace(/\.$/, "");
  const cap = (s: string) =>
    s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  return `${cap(weekday)} . ${day} ${cap(month)}`;
}

/**
 * Date as YYYY-MM-DD in the local timezone (for DB entry_date keys).
 */
export function todayISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Format a duration in seconds as MM:SS (no hours). */
export function formatDurationMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}
