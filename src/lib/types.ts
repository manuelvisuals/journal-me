/**
 * Domain types for Journal.me.
 * Kept minimal — only what the UI actually consumes today.
 */

export type Mood = "great" | "good" | "neutral" | "low" | "bad";

export type GoalDot = {
  id: string;
  label: string;
  on: boolean;
};

export type AreaSummary = {
  label: string;
  text: string;
};

export type EntryMetrics = {
  /** Body weight in kg. */
  weightKg: number | null;
  /** Sleep duration in fractional hours (7.2 = 7h 12). */
  sleepHours: number | null;
  /** Mood emoji bucket. */
  mood: Mood | null;
};

export type Entry = {
  id: string;
  /** YYYY-MM-DD in local timezone. */
  entryDate: string;
  /** Raw transcript text, source of truth. */
  transcript: string;
  /** Approximate duration of the recording, in seconds. */
  durationSeconds: number;
  /** AI-generated headline (or placeholder for MVP). */
  headline: string | null;
  /** AI-generated short snippet (or first sentence for MVP). */
  snippet: string | null;
  /** Macro-area summaries (Lavoro / Relazioni / Corpo / ...). */
  areas: AreaSummary[];
  /** Metric snapshot at the time of the entry. */
  metrics: EntryMetrics | null;
  /** Goal-dot state at the time of the entry. */
  goals: GoalDot[];
  /** ISO timestamp of when the entry was saved. */
  createdAt: string;
};

export type RecapPeriod = "month" | "semester" | "year";

export type Recap = {
  id: string;
  periodType: RecapPeriod;
  /** YYYY-MM-DD inclusive. */
  periodStart: string;
  periodEnd: string;
  title: string;
  snippet: string;
  body: string;
  generatedAt: string;
};

export type RememberKind =
  | "persona"
  | "todo"
  | "nota"
  | "luogo"
  | "idea";

export type RememberSource = "manual" | "extracted";

export type Remember = {
  id: string;
  text: string;
  kind: RememberKind;
  source: RememberSource;
  sourceEntryId: string | null;
  createdAt: string;
};
