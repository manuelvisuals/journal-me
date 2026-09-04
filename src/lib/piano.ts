/**
 * Un premium con una scadenza passata e un free. In un posto solo, usato
 * dal server (requirePremium, la guardia dell'ospite) e dal client (plan.ts).
 *
 * Fino al 4 settembre 2026 `current_period_end` era solo un'annotazione:
 * Stripe abbassava il piano col suo webhook e nessuno guardava la data. Con
 * l'acquisto Apple la data conta due volte: e la scadenza vera
 * dell'abbonamento (le notifiche di Apple la aggiornano, ma se una si
 * perde la data resta la verita) ed e il mese di grazia dei profili
 * `ios-v1` (migration 024), che devono scadere da soli senza che nessuno
 * li tocchi.
 *
 * `null` = senza scadenza (manuale, o un piano che non ne ha).
 */
export function pianoEffettivo(
  riga: { plan?: string | null; current_period_end?: string | null } | null | undefined,
  adesso: number = Date.now(),
): "free" | "premium" {
  if (!riga || riga.plan !== "premium") return "free";
  const fine = riga.current_period_end;
  if (!fine) return "premium";
  const t = Date.parse(fine);
  if (!Number.isFinite(t)) return "premium";
  return t > adesso ? "premium" : "free";
}
