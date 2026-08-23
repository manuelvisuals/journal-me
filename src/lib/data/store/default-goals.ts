/**
 * Le etichette dei micro-goal di default, in UN SOLO posto (SPEC-v2 §2.4).
 *
 * Su cloud le semina il trigger Postgres `seed_default_goals` di
 * supabase/migrations/010_default_goals.sql (che resta la fonte per i
 * nuovi utenti cloud: questa lista deve restare identica a quella). In
 * locale le semina LocalStore alla CREAZIONE del database — solo alla
 * creazione, mai come fallback a runtime: la regola HANDOVER §7
 * "micro-goal 100% da DB" esiste per impedire fallback che mascherano
 * query rotte, e un seed esplicito non e un fallback.
 *
 * Perche proprio queste sei: sono formulate al POSITIVO (i micro-goal
 * sono tracker neutri, non voti — "mosso il corpo" descrive una cosa
 * fatta, "no junkfood" descrive una colpa evitata e trasforma il diario
 * in una pagella), sono universali per eta e situazione, e coprono le
 * quattro aree che l'AI usa gia per riassumere la giornata. La lista
 * precedente era l'elenco personale scritto come esempio a maggio 2026.
 */
export const DEFAULT_GOAL_LABELS: readonly string[] = [
  "mosso il corpo",
  "stato all'aria aperta",
  "dormito abbastanza",
  "visto qualcuno",
  "tempo per me",
  "letto qualcosa",
];
