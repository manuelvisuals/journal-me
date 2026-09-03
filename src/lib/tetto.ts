/**
 * Tetti di tempo (SPEC-ospite-e-cassaforte.md, R11).
 *
 * Regola: nessuna attesa di rete, in nessun punto dell'app, puo durare
 * indefinitamente. Il 3 settembre 2026 la trascrizione e rimasta su "sto
 * trascrivendo" per sempre col telefono senza rete: la chiamata protetta
 * dal tetto di 120 s aveva DAVANTI due attese senza tetto (la lettura del
 * glossario via Supabase e il recupero del gettone in apiFetch). Referto in
 * src/modules/oggi/PROVA-trascrizione.md.
 *
 * Qui vivono i tre attrezzi, e solo questi:
 *
 *  - `conTetto(promessa, ms)`: la promessa deve risolversi entro `ms`,
 *    altrimenti rifiuta con un AbortError. Per le attese che non sono una
 *    fetch (una lettura dallo store, un getSession).
 *  - `conSegnale(promessa, signal)`: come sopra, ma legata a un
 *    AbortController gia esistente: serve a mettere sotto lo STESSO
 *    cronometro piu attese in fila (SPEC R11: il tetto vale sull'intera
 *    operazione, non sul singolo pezzo).
 *  - `fetchConTetto(ms)`: una `fetch` che aggiunge un segnale di abort a ogni
 *    richiesta che non ne porta gia uno. E cio che si consegna al client
 *    Supabase (`global.fetch`, opzione standard di supabase-js): cosi ogni
 *    lettura, scrittura, upload e rinnovo del gettone ha un tetto, in un
 *    punto solo.
 *
 * L'errore ha SEMPRE `name === "AbortError"`, come quello che `fetch` lancia
 * quando viene interrotta: chi gia gestisce l'abort di apiFetch gestisce
 * anche questi senza imparare un nome nuovo.
 */

export function erroreTetto(cosa?: string): Error {
  const msg = cosa ? `Tempo scaduto: ${cosa}` : "Tempo scaduto";
  if (typeof DOMException !== "undefined") {
    return new DOMException(msg, "AbortError");
  }
  const e = new Error(msg);
  e.name = "AbortError";
  return e;
}

/** True se l'errore e un tetto scaduto o una fetch interrotta. */
export function eTettoScaduto(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: unknown }).name === "AbortError"
  );
}

/**
 * La promessa deve finire entro `ms`, altrimenti rifiuta con AbortError.
 * La promessa sottostante NON viene fermata (una Promise non si puo
 * cancellare): semplicemente si smette di aspettarla.
 */
export function conTetto<T>(
  promessa: Promise<T>,
  ms: number,
  cosa?: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(erroreTetto(cosa)), ms);
    promessa.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/**
 * La promessa deve finire prima che `signal` scatti, altrimenti rifiuta con
 * AbortError. Se il segnale e gia scattato rifiuta subito.
 */
export function conSegnale<T>(
  promessa: Promise<T>,
  signal: AbortSignal,
  cosa?: string,
): Promise<T> {
  if (signal.aborted) return Promise.reject(erroreTetto(cosa));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(erroreTetto(cosa));
    signal.addEventListener("abort", onAbort, { once: true });
    promessa.then(
      (v) => {
        signal.removeEventListener("abort", onAbort);
        resolve(v);
      },
      (e) => {
        signal.removeEventListener("abort", onAbort);
        reject(e);
      },
    );
  });
}

/**
 * Una `fetch` con un tetto di `ms` su ogni richiesta che non porta gia un
 * proprio `signal`. Chi passa un segnale suo tiene il suo: la regola e "un
 * tetto c'e sempre", non "il tetto e questo".
 *
 * Niente `AbortSignal.any` ne `AbortSignal.timeout`: arrivano tardi su
 * WebKit, e il guscio iOS gira anche su telefoni non aggiornati.
 */
export function fetchConTetto(ms: number): typeof fetch {
  return (input, init) => {
    if (init?.signal) return fetch(input, init);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(erroreTetto("rete")), ms);
    return fetch(input, { ...init, signal: ctrl.signal }).finally(() =>
      clearTimeout(timer),
    );
  };
}
