/**
 * L'etichetta del periodo di un recap: "Maggio 2026", "Semestre 1 2026",
 * "Anno 2026" — e in inglese "May 2026", "Half 1 2026", "Year 2026".
 *
 * Viveva copiata in tre posti (la lista dei recap, il dettaglio, la card
 * in Impostazioni), ognuno con la sua lista dei mesi italiani scritta a
 * mano. Col bilingue quelle liste sarebbero diventate tre bug uguali:
 * ora c'e una funzione sola, e i nomi dei mesi li da Intl attraverso
 * formatMonthTitle(), che segue la lingua scelta.
 */

import { formatMonthTitle } from "@/lib/format";
import { t } from "@/lib/i18n";

export function recapPeriodLabel(
  periodType: string,
  periodStart: string,
): string {
  const [year, month] = periodStart.split("-").map(Number);
  if (periodType === "month") return formatMonthTitle(year, month);
  if (periodType === "semester") {
    return t("Semestre {n} {anno}", { n: month <= 6 ? 1 : 2, anno: year });
  }
  return t("Anno {anno}", { anno: year });
}
