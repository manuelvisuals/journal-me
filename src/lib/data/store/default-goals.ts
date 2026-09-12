/**
 * Le etichette dei micro-goal di fabbrica, in UN SOLO posto (SPEC-v2 §2.4),
 * NELLE DUE LINGUE (decisione di Manuel, 12 settembre 2026, opzione 1:
 * "devono essere O in inglese O in italiano").
 *
 * Fino al 12 settembre 2026 nascevano in italiano per chiunque: in locale
 * le seminava LocalStore alla creazione del database, in cloud il trigger
 * Postgres `seed_default_goals` (migration 010) alla nascita dell'utente,
 * che di lingue non sa niente. Un utente inglese si trovava sei caselle in
 * italiano, e il revisore Apple pure. Da oggi:
 *
 *  - in locale LocalStore semina `etichetteDiFabbrica(getLang())` alla
 *    creazione del database — solo alla creazione, mai come fallback a
 *    runtime (HANDOVER §7 "micro-goal 100% da DB");
 *  - in cloud il trigger NON c'e piu (migration 029): al primo accesso
 *    l'app chiede al server di seminarli nella lingua del dispositivo
 *    (`/api/account/obiettivi-di-fabbrica`, modulo impostazioni), e il
 *    server segna `profiles.goals_seeded_at` perche succeda UNA volta sola
 *    — anche se poi la persona li cancella tutti;
 *  - la migrazione ospite -> account (lib/ospite/migrazione.ts) NON fa
 *    salire gli obiettivi di fabbrica in NESSUNA delle due lingue.
 *
 * Perche proprio queste sei: sono formulate al POSITIVO (i micro-goal
 * sono tracker neutri, non voti — "mosso il corpo" descrive una cosa
 * fatta, "no junkfood" descrive una colpa evitata e trasforma il diario
 * in una pagella), sono universali per eta e situazione, e coprono le
 * quattro aree che l'AI usa gia per riassumere la giornata. Le inglesi
 * sono le stesse che il loader dell'account demo usa dall'8 settembre
 * (scripts/carica-account-demo.mjs, OBIETTIVI_EN): una lista sola anche li.
 *
 * Senza import, di proposito: la legge anche la rotta server.
 */
export type LinguaObiettivi = "it" | "en";

export const DEFAULT_GOAL_LABELS_IT: readonly string[] = [
  "mosso il corpo",
  "stato all'aria aperta",
  "dormito abbastanza",
  "visto qualcuno",
  "tempo per me",
  "letto qualcosa",
];

export const DEFAULT_GOAL_LABELS_EN: readonly string[] = [
  "moved my body",
  "been outdoors",
  "slept enough",
  "seen someone",
  "time for myself",
  "read something",
];

/** Le sei etichette nella lingua chiesta (tutto cio che non e "en" e italiano). */
export function etichetteDiFabbrica(lingua: string | null | undefined): readonly string[] {
  return lingua === "en" ? DEFAULT_GOAL_LABELS_EN : DEFAULT_GOAL_LABELS_IT;
}

/** Tutte le etichette di fabbrica, in minuscolo, in tutte e due le lingue: per riconoscerle. */
export const TUTTE_LE_ETICHETTE_DI_FABBRICA: ReadonlySet<string> = new Set(
  [...DEFAULT_GOAL_LABELS_IT, ...DEFAULT_GOAL_LABELS_EN].map((l) => l.toLowerCase()),
);

export function eDiFabbrica(label: string | null | undefined): boolean {
  return TUTTE_LE_ETICHETTE_DI_FABBRICA.has((label ?? "").trim().toLowerCase());
}

/** Compatibilita: la lista italiana, come prima del 12 settembre 2026. */
export const DEFAULT_GOAL_LABELS: readonly string[] = DEFAULT_GOAL_LABELS_IT;
