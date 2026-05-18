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
