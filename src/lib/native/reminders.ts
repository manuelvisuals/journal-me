"use client";

import { isNative } from "@/lib/native/platform";
import { t } from "@/lib/i18n";

/**
 * The evening nudge.
 *
 * A local notification, not a push: the reminder is "it is 21:30, tell me about
 * your day", which the phone already knows without asking a server. That skips
 * APNs certificates, a device-token table and a cron on Vercel — and it keeps
 * firing when there is no signal, which on a mountain is the normal case.
 *
 * QUANDO SI CHIEDE IL PERMESSO (9 settembre 2026, scelta di Manuel: B1).
 * Prima la richiesta di iOS partiva appena si "entrava" nell'app, e con
 * l'ospite di fabbrica si entra al primo avvio: la finestra compariva nel
 * primo secondo, a uno sconosciuto senza una riga scritta. Adesso ci sono
 * due porte:
 *  - `proponiPromemoriaSerale()` — CHIEDE il permesso. Si chiama una volta
 *    che una giornata e stata salvata (save-recording.ts), quando la frase
 *    "com'e andata oggi?" alle 21:30 ha un senso per chi la riceve.
 *  - `sincronizzaPromemoriaSerale()` — NON chiede mai niente. All'avvio
 *    rimette in coda la notifica se il permesso c'e gia (dopo una
 *    reinstallazione, o se l'utente l'ha acceso dalle Impostazioni di iOS).
 * Un no resta un no: iOS non ripropone la finestra, e noi nemmeno.
 */
const REMINDER_ID = 1;
const HOUR = 21;
const MINUTE = 30;

type Plugin = typeof import("@capacitor/local-notifications").LocalNotifications;

async function plugin(): Promise<Plugin> {
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  return LocalNotifications;
}

async function mettiInCoda(ln: Plugin): Promise<void> {
  // Rescheduling the same id every launch would be harmless but noisy; skip
  // if it is already in the queue.
  const pending = await ln.getPending();
  if (pending.notifications.some((n) => n.id === REMINDER_ID)) return;

  await ln.schedule({
    notifications: [
      {
        id: REMINDER_ID,
        title: t("Com'e andata oggi?"),
        body: t("Due minuti di voce, e la giornata resta."),
        schedule: {
          // `on` without a day repeats daily at that time, in device-local
          // time — which is what "sera" means here, wherever he is.
          on: { hour: HOUR, minute: MINUTE },
          allowWhileIdle: true,
        },
      },
    ],
  });
}

/** Dopo una giornata salvata: chiede il permesso (la prima volta) e mette in coda. */
export async function proponiPromemoriaSerale(): Promise<void> {
  if (!isNative()) return;
  try {
    const ln = await plugin();
    const stato = await ln.checkPermissions();
    if (stato.display !== "granted") {
      const risposta = await ln.requestPermissions();
      if (risposta.display !== "granted") return;
    }
    await mettiInCoda(ln);
  } catch {
    // A missing reminder must never keep the app from opening.
  }
}

/** All'avvio: rimette in coda solo se il permesso c'e gia. Zero finestre. */
export async function sincronizzaPromemoriaSerale(): Promise<void> {
  if (!isNative()) return;
  try {
    const ln = await plugin();
    const stato = await ln.checkPermissions();
    if (stato.display !== "granted") return;
    await mettiInCoda(ln);
  } catch {
    // Idem: un promemoria che manca non deve bloccare l'app.
  }
}
