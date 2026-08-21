"use client";

/**
 * La cache in memoria delle letture, e il precaricamento.
 *
 * Perche (richiesta di Manuel del 21 agosto 2026: "passare da una
 * schermata all'altra e lentissimo"). Ogni schermata dell'app carica i suoi
 * dati al montaggio: Oggi chiede la giornata e i micro-goal, Mese chiede il
 * mese, Ricorda la sua lista, Impostazioni obiettivi e recap. In cloud ogni
 * richiesta e un giro fino a Supabase, e ogni volta che torni su una
 * schermata gia vista quel giro si rifa da capo: da fuori sembra che l'app
 * ci pensi su ogni volta che tocchi un tab.
 *
 * COSA FA. Due cose semplici, e nessuna delle due tocca le schermate:
 *
 *  1. RICORDA cio che ha gia letto, per un minuto. La seconda visita a una
 *     schermata non aspetta la rete: disegna con quello che ha e intanto
 *     rilegge in sottofondo (`stale-while-revalidate`). Se il dato e
 *     cambiato la schermata si aggiorna da sola un istante dopo.
 *
 *  2. PRECARICA il resto appena la prima schermata e pronta. Mentre leggi
 *     Oggi, in sottofondo arrivano il mese, Ricorda e i recap: quando
 *     tocchi il tab sono gia li.
 *
 * PERCHE STA QUI E NON DENTRO LE PAGINE. Le funzioni pubbliche di
 * src/lib/data/* sono l'unico punto d'accesso ai dati (SPEC-v2 §2.2):
 * mettendo la cache dentro quelle, ogni schermata la eredita senza sapere
 * che esiste, e non c'e il rischio che una pagina nuova se la dimentichi.
 *
 * INVALIDAZIONE, GROSSOLANA DI PROPOSITO. Qualsiasi scrittura svuota tutta
 * la cache. Si potrebbe invalidare per chiave, ma una giornata salvata
 * cambia anche il conteggio del mese, i micro-goal di quel giorno e magari
 * un remember estratto: tenere quella mappa aggiornata a mano e il tipo di
 * cosa che si rompe in silenzio sei mesi dopo. Svuotare tutto costa una
 * rilettura e non sbaglia mai.
 *
 * In modalita locale la cache non serve (IndexedDB e gia immediata) ma non
 * fa danno, e tenerla accesa sempre evita due comportamenti diversi da
 * ricordare.
 */

const TTL_MS = 60_000;

type Entry<T> = { at: number; value: T };

const store = new Map<string, Entry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

/** Svuota tutto. La chiama ogni scrittura (vedi src/lib/data/*.ts). */
export function invalidateAll(): void {
  store.clear();
  inFlight.clear();
}

/**
 * Legge dalla cache se e fresca, altrimenti chiama `loader`.
 *
 * Se una lettura identica e gia in volo si aspetta quella invece di
 * aprirne una seconda: senza, montare due componenti che chiedono la
 * stessa cosa (succede: Oggi e la rail chiedono gli stessi micro-goal)
 * raddoppia le richieste.
 */
export async function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && Date.now() - hit.at < TTL_MS) {
    // Fresco: si risponde subito. Niente rilettura, o si perde il senso.
    return hit.value;
  }

  const running = inFlight.get(key) as Promise<T> | undefined;
  if (running) return running;

  const p = loader()
    .then((value) => {
      store.set(key, { at: Date.now(), value });
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });
  inFlight.set(key, p);

  // Scaduto ma presente: si risponde con il vecchio e si rilegge in
  // sottofondo. E il motivo per cui tornare su una schermata e istantaneo
  // anche dopo un minuto.
  if (hit) {
    void p.catch(() => undefined);
    return hit.value;
  }
  return p;
}

/** Cio che c'e in cache adesso, senza chiedere niente a nessuno. */
export function peek<T>(key: string): T | undefined {
  return store.get(key)?.value as T | undefined;
}
