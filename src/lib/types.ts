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
  weightKg: number | null;
  sleepHours: number | null;
  sleepMinutes: number | null;
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
