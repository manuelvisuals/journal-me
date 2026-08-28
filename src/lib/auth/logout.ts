"use client";

/**
 * IL logout, in un posto solo (mockup porta-account §03, il tranello 1).
 *
 * Non e `signOut()`: sono quattro passi piu la navigazione, e ognuno ha
 * una cicatrice dietro. Il 23 agosto 2026 questa stessa sequenza e stata
 * costruita due volte da due chat diverse; il 28, col menu dell'account
 * che ne aveva bisogno, il rischio si ripresentava identico. Da qui in
 * poi chi vuole far uscire l'utente chiama QUESTA funzione — il menu
 * dell'account e le Impostazioni gia lo fanno — e poi porta a /login.
 *
 * I passi, e le loro cicatrici:
 *  1. signOut di Supabase — l'unico passo ovvio;
 *  2. clearPlanCache — il piano in localStorage ("jm.plan") e OTTIMISTA:
 *     senza, restava "premium" addosso al browser dopo il logout, e il
 *     prossimo account gratis vedeva la UI premium fino al 402 a sorpresa
 *     (vietato da SPEC-v2 §3.3);
 *  3. dimenticaScansione — il prossimo account ha un altro diario, e il
 *     browser non deve credere di averlo gia letto (scan-archivio.ts);
 *  4. il cookie della demo, azzerato.
 *
 * Cosa NON si tocca, di proposito: il benvenuto post-accesso
 * (src/lib/welcome.ts) sopravvive al logout dal 27 agosto — cancellarlo
 * era il bug "esci, rientri, e ti richiede gratis-o-premium".
 *
 * La navigazione a /login resta al chiamante: il router di Next e un
 * hook e vive nei componenti, non qui.
 */

import { clearPlanCache } from "@/lib/plan";
import { dimenticaScansione } from "@/lib/actions/scan-archivio";

export async function eseguiLogout(): Promise<void> {
  const { createClient } = await import("@/lib/supabase/client");
  await createClient().auth.signOut();
  clearPlanCache();
  dimenticaScansione();
  try {
    document.cookie =
      "journalme-demo=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  } catch {
    // Niente document (o cookie negati): il resto del logout e gia fatto.
  }
}
