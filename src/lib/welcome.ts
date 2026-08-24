/**
 * Il benvenuto post-accesso: visto o no, su questo dispositivo.
 *
 * Dal 24 agosto 2026 l'ordine d'ingresso e: /login -> codice -> /benvenuto
 * -> dentro. La schermata di /benvenuto non puo pero ricomparire a ogni
 * accesso: chi rientra dal telefono la mattina non deve rispondere di nuovo
 * "gratis o premium". Un flag locale basta e non costa una colonna nel
 * database — se cambi dispositivo la rivedi una volta, che e il male minore
 * rispetto a una scrittura in piu su profiles a ogni login.
 */

const KEY = "jm.welcomeSeen";

export function welcomeSeen(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    // storage negato: si finisce dentro senza benvenuto, mai bloccati fuori
    return true;
  }
}

export function markWelcomeSeen(): void {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    // pazienza: al prossimo accesso la rivede
  }
}

/** Al logout si dimentica, come il piano e la scansione dell'archivio. */
export function clearWelcomeSeen(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // niente da rimuovere
  }
}
