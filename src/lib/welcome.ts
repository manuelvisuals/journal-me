/**
 * Il benvenuto post-accesso ("gratis o premium"): quando riproporlo.
 *
 * Dal 24 agosto 2026 l'ordine d'ingresso e: /login -> codice -> /benvenuto
 * -> dentro. Fino al 27 agosto il flag "visto" si cancellava al logout, e
 * il risultato era il bug segnalato da Manuel: esci, rientri, e l'app ti
 * richiede gratis-o-premium come se non ti conoscesse.
 *
 * La regola nuova (Manuel, 27 agosto 2026):
 *
 *  - la PRIMA volta su questo dispositivo la scelta si vede sempre;
 *  - poi si RIPROPONE solo ai gratis, ogni BENVENUTO_OGNI accessi — un
 *    promemoria, non un pedaggio;
 *  - la schermata offre "non chiedermelo piu": chi la spunta non la rivede
 *    mai piu (e gli si dice che premium resta a portata di Impostazioni);
 *  - ai premium non si richiede MAI: ci pensa /benvenuto stessa, che
 *    quando il piano risulta premium entra da sola (il piano al momento
 *    del login non e ancora noto, quindi il filtro non puo stare qui).
 *
 * Tutto in localStorage: vale per dispositivo, sopravvive al logout (e il
 * punto della correzione), e non costa una colonna su profiles.
 */

const K_VISTO = "jm.welcomeSeen";
const K_ACCESSI = "jm.benv.accessi";
const K_STOP = "jm.benv.stop";

/** Ogni quanti accessi la scelta torna a farsi vedere (solo gratis). */
export const BENVENUTO_OGNI = 10;

export function welcomeSeen(): boolean {
  try {
    return window.localStorage.getItem(K_VISTO) === "1";
  } catch {
    // storage negato: si finisce dentro senza benvenuto, mai bloccati fuori
    return true;
  }
}

/** La scelta e stata vista adesso: il conto degli accessi riparte. */
export function markWelcomeSeen(): void {
  try {
    window.localStorage.setItem(K_VISTO, "1");
    window.localStorage.setItem(K_ACCESSI, "0");
  } catch {
    // pazienza: al prossimo accesso la rivede
  }
}

/** "Non chiedermelo piu": deciso dall'utente, per sempre, revocabile. */
export function nonChiederePiu(attivo: boolean): void {
  try {
    if (attivo) window.localStorage.setItem(K_STOP, "1");
    else window.localStorage.removeItem(K_STOP);
  } catch {
    // storage negato: al peggio la domanda torna
  }
}

export function haChiestoSilenzio(): boolean {
  try {
    return window.localStorage.getItem(K_STOP) === "1";
  } catch {
    return false;
  }
}

/**
 * Registra un accesso riuscito e dice se stavolta tocca /benvenuto.
 * Va chiamata UNA volta per login (la chiama afterLogin, in /login).
 */
export function registraAccesso(): boolean {
  try {
    if (!welcomeSeen()) return true;
    if (haChiestoSilenzio()) return false;
    const n = (parseInt(window.localStorage.getItem(K_ACCESSI) ?? "0", 10) || 0) + 1;
    window.localStorage.setItem(K_ACCESSI, String(n));
    // Al decimo si mostra; markWelcomeSeen (al passaggio) riparte da zero.
    return n >= BENVENUTO_OGNI;
  } catch {
    // storage negato: dritti dentro, mai bloccati su una domanda
    return false;
  }
}
