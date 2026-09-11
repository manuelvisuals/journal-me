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
 *  4. svuotaProfilo — nome e foto in jm.profilo sono della persona che
 *     esce, non del browser (7 settembre 2026);
 *  5. il cookie della demo, azzerato;
 *  6. lo specchio, svuotato (11 settembre 2026, con la copia cifrata delle
 *     giornate sul dispositivo): un diario che resta addosso al telefono
 *     dopo che la persona e uscita sarebbe il peggiore dei bug. Sono buste
 *     chiuse, ma non e questo il punto: non sono piu sue.
 *
 * Cosa NON si tocca, di proposito: il benvenuto post-accesso
 * (src/lib/welcome.ts) sopravvive al logout dal 27 agosto — cancellarlo
 * era il bug "esci, rientri, e ti richiede gratis-o-premium".
 *
 * La navigazione a /login resta al chiamante: il router di Next e un
 * hook e vive nei componenti, non qui.
 */

import { clearPlanCache } from "@/lib/plan";
import { svuotaSpecchio } from "@/lib/data/store/specchio";
import { dimenticaAperturaLocale } from "@/lib/cassaforte";
import { dimenticaScansione } from "@/lib/actions/scan-archivio";
import { svuotaProfilo } from "@/modules/impostazioni";

export async function eseguiLogout(): Promise<void> {
  const { createClient } = await import("@/lib/supabase/client");
  await createClient().auth.signOut();
  clearPlanCache();
  dimenticaScansione();
  // Nome e foto (jm.profilo): il prossimo account, o il prossimo ospite, e
  // un'altra persona.
  svuotaProfilo();
  await svuotaSpecchio();
  // Il segno "questa cassaforte si e gia aperta qui" e di chi esce.
  dimenticaAperturaLocale();
  try {
    document.cookie =
      "journalme-demo=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  } catch {
    // Niente document (o cookie negati): il resto del logout e gia fatto.
  }
}
