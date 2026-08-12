"use client";

import { isNative } from "@/lib/native/platform";

/**
 * The evening nudge.
 *
 * A local notification, not a push: the reminder is "it is 21:30, tell me about
 * your day", which the phone already knows without asking a server. That skips
 * APNs certificates, a device-token table and a cron on Vercel — and it keeps
 * firing when there is no signal, which on a mountain is the normal case.
 */
const REMINDER_ID = 1;
const HOUR = 21;
const MINUTE = 30;

export async function ensureEveningReminder(): Promise<void> {
  if (!isNative()) return;

  try {
    const { LocalNotifications } = await import(
      "@capacitor/local-notifications"
    );

    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== "granted") {
      const asked = await LocalNotifications.requestPermissions();
      if (asked.display !== "granted") return;
    }

    // Rescheduling the same id every launch would be harmless but noisy; skip
    // if it is already in the queue.
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.some((n) => n.id === REMINDER_ID)) return;

    await LocalNotifications.schedule({
      notifications: [
        {
          id: REMINDER_ID,
          title: "Com'e andata oggi?",
          body: "Due minuti di voce, e la giornata resta.",
          schedule: {
            // `on` without a day repeats daily at that time, in device-local
            // time — which is what "sera" means here, wherever he is.
            on: { hour: HOUR, minute: MINUTE },
            allowWhileIdle: true,
          },
        },
      ],
    });
  } catch {
    // A missing reminder must never keep the app from opening.
  }
}
