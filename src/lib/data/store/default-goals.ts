/**
 * Le etichette dei micro-goal di default, in UN SOLO posto (SPEC-v2 §2.4).
 *
 * Su cloud le semina il trigger Postgres `seed_default_goals` di
 * supabase/migrations/001_init.sql (che resta la fonte per i nuovi utenti
 * cloud: questa lista deve restare identica a quella). In locale le seminera
 * LocalStore alla CREAZIONE del database (PR 3) — solo alla creazione, mai
 * come fallback a runtime: la regola HANDOVER §7 "micro-goal 100% da DB"
 * esiste per impedire fallback che mascherano query rotte, e un seed
 * esplicito non e un fallback.
 */
export const DEFAULT_GOAL_LABELS: readonly string[] = [
  "scopato",
  "no alcol",
  "no junkfood",
  "no sbirciato ex",
  "camminato",
  "visto sunset",
];
