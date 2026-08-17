"use client";

import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api";
import { todayISO } from "@/lib/format";
import { loadGoalDefs } from "@/lib/data/goals";
import type {
  AreaSummary,
  Entry,
  EntryMetrics,
  GoalDef,
  GoalDot,
  Mood,
} from "@/lib/types";

/**
 * After the move to Supabase Anonymous Auth, every user has a real
 * user_id (regular or anon). DataMode is kept as a type alias for
 * call-site compatibility but always equals "auth" in practice — there
 * is no longer a localStorage path.
 */
export type DataMode = "auth";

export type RecordingInput = {
  transcript: string;
  durationSeconds: number;
  /** Default date for segments without explicit temporal markers (YYYY-MM-DD). */
  defaultDate: string;
};

const SEGMENT_SEP = "\n---\n";

/* ----------------- AI processing ----------------- */

type AIFields = {
  headline: string;
  snippet: string;
  areas: AreaSummary[];
};

type DateSegment = { date: string; text: string };

function fallbackAIFields(transcript: string): AIFields {
  const firstSentence = transcript.trim().split(/(?<=[.!?])\s/)[0] ?? "";
  return {
    headline: "Giornata raccontata",
    snippet: firstSentence.slice(0, 240),
    areas: [],
  };
}

async function callSplitByDate(
  transcript: string,
  defaultDate: string,
): Promise<DateSegment[]> {
  try {
    const resp = await apiFetch("/api/split-by-date", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, defaultDate }),
    });
    if (!resp.ok) return [{ date: defaultDate, text: transcript }];
    const data = (await resp.json()) as { segments?: DateSegment[] };
    if (!data.segments || data.segments.length === 0) {
      return [{ date: defaultDate, text: transcript }];
    }
    return data.segments;
  } catch {
    return [{ date: defaultDate, text: transcript }];
  }
}

async function callProcessEntry(transcript: string): Promise<AIFields> {
  try {
    const resp = await apiFetch("/api/process-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript }),
    });
    if (!resp.ok) return fallbackAIFields(transcript);
    const data = (await resp.json()) as Partial<AIFields>;
    if (!data.headline || !data.snippet) return fallbackAIFields(transcript);
    return {
      headline: data.headline,
      snippet: data.snippet,
      areas: Array.isArray(data.areas) ? data.areas : [],
    };
  } catch {
    return fallbackAIFields(transcript);
  }
}

/* ----------------- Shared helpers ----------------- */

function parseAreasJson(raw: unknown): AreaSummary[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter(
      (x): x is AreaSummary =>
        typeof x === "object" &&
        x !== null &&
        typeof (x as { label?: unknown }).label === "string" &&
        typeof (x as { text?: unknown }).text === "string",
    );
  }
  return [];
}

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

/**
 * Build the goal-dot list for an entry by merging the user's live goal
 * definitions (from the `goals` table) with the labels that were "on" for
 * that day. No hardcoded fallback: if the user has no goal definitions, the
 * result is an empty list and the dot area renders nothing.
 */
function buildGoals(defs: GoalDef[], labelsOn: string[]): GoalDot[] {
  const on = new Set(labelsOn.map((s) => s.toLowerCase()));
  return defs.map((d) => ({
    id: d.id,
    label: d.label,
    on: on.has(d.label.toLowerCase()),
  }));
}

const VALID_MOODS: ReadonlySet<string> = new Set([
  "great",
  "good",
  "neutral",
  "low",
  "bad",
]);

function parseMood(raw: unknown): Mood | null {
  if (typeof raw !== "string") return null;
  return VALID_MOODS.has(raw) ? (raw as Mood) : null;
}

function buildMetrics(
  weightKg: unknown,
  sleepHours: unknown,
  mood: unknown,
): EntryMetrics {
  return {
    weightKg: typeof weightKg === "number" ? weightKg : null,
    sleepHours: typeof sleepHours === "number" ? sleepHours : null,
    mood: parseMood(mood),
  };
}

function blankMetrics(): EntryMetrics {
  return { weightKg: null, sleepHours: null, mood: null };
}

function blankEntryShell(dateISO: string): Entry {
  return {
    id: `pending-${dateISO}`,
    entryDate: dateISO,
    transcript: "",
    durationSeconds: 0,
    headline: null,
    snippet: null,
    areas: [],
    metrics: blankMetrics(),
    goals: [],
    people: [],
    createdAt: new Date().toISOString(),
  };
}

/* ----------------- Load ----------------- */

const ENTRY_COLS_FULL =
  "id, entry_date, transcript, headline, snippet, areas, mood, weight_kg, sleep_hours, goals_on, people, created_at";
const ENTRY_COLS_BASE =
  "id, entry_date, transcript, headline, snippet, areas, mood, weight_kg, sleep_hours, goals_on, created_at";

async function loadEntryRow(
  dateISO: string,
  defs?: GoalDef[],
): Promise<Entry | null> {
  const supabase = createClient();
  const goalDefs = defs ?? (await loadGoalDefs());
  // Defensive: the `people` column ships with migration 005. If it hasn't
  // been applied yet, the full select errors — fall back to the base columns
  // so entries still load (Social pills just stay empty until the migration).
  const full = await supabase
    .from("entries")
    .select(ENTRY_COLS_FULL)
    .eq("entry_date", dateISO)
    .maybeSingle();
  let row = full.data as Record<string, unknown> | null;
  if (full.error) {
    const base = await supabase
      .from("entries")
      .select(ENTRY_COLS_BASE)
      .eq("entry_date", dateISO)
      .maybeSingle();
    if (base.error) return null;
    row = base.data as Record<string, unknown> | null;
  }
  if (!row) return null;
  return {
    id: row.id as string,
    entryDate: row.entry_date as string,
    transcript: (row.transcript as string) ?? "",
    durationSeconds: 0,
    headline: (row.headline as string) ?? null,
    snippet: (row.snippet as string) ?? null,
    areas: parseAreasJson(row.areas),
    metrics: buildMetrics(row.weight_kg, row.sleep_hours, row.mood),
    goals: buildGoals(goalDefs, parseStringArray(row.goals_on)),
    people: parseStringArray(row.people),
    createdAt: row.created_at as string,
  };
}

/* ----------------- Save (recording) ----------------- */

async function saveEntryRow(
  dateISO: string,
  transcript: string,
  ai: AIFields,
  durationSeconds: number,
): Promise<Entry> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("entries")
    .upsert(
      {
        user_id: user.id,
        entry_date: dateISO,
        transcript,
        headline: ai.headline,
        snippet: ai.snippet,
        areas: ai.areas,
      },
      { onConflict: "user_id,entry_date" },
    );

  if (error) {
    throw new Error(error.message ?? "Failed to save entry");
  }

  // Reload so the returned entry is fully hydrated (metrics, goals from the
  // live definitions, people) instead of stubbed — fixes metrics/goals not
  // showing right after a recording until a manual reload.
  const reloaded = await loadEntryRow(dateISO);
  if (reloaded) return { ...reloaded, durationSeconds };
  return blankEntryShell(dateISO);
}

/* ----------------- Public API ----------------- */

export async function loadTodayEntry(_mode?: DataMode): Promise<Entry | null> {
  return loadEntryRow(todayISO());
}

export async function loadEntryForDate(
  _mode: DataMode,
  dateISO: string,
): Promise<Entry | null> {
  return loadEntryRow(dateISO);
}

export async function saveRecording(
  _mode: DataMode,
  input: RecordingInput,
): Promise<Entry[]> {
  const segments = await callSplitByDate(input.transcript, input.defaultDate);
  const saved: Entry[] = [];

  for (const seg of segments) {
    const existing = await loadEntryRow(seg.date);
    const fullTranscript = existing?.transcript
      ? existing.transcript + SEGMENT_SEP + seg.text.trim()
      : seg.text.trim();
    const ai = await callProcessEntry(fullTranscript);
    const dur = seg.date === input.defaultDate ? input.durationSeconds : 0;
    saved.push(await saveEntryRow(seg.date, fullTranscript, ai, dur));
  }

  return saved;
}

export async function updateEntryTranscript(
  _mode: DataMode,
  dateISO: string,
  newTranscript: string,
): Promise<Entry> {
  const ai = await callProcessEntry(newTranscript);
  return saveEntryRow(dateISO, newTranscript, ai, 0);
}

export async function deleteEntry(
  _mode: DataMode,
  dateISO: string,
): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { error } = await supabase
    .from("entries")
    .delete()
    .eq("user_id", user.id)
    .eq("entry_date", dateISO);
  if (error) throw new Error(error.message);
}

export async function updateMetric(
  _mode: DataMode,
  dateISO: string,
  patch: Partial<EntryMetrics>,
): Promise<Entry> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const dbPatch: Record<string, unknown> = {};
  if (Object.prototype.hasOwnProperty.call(patch, "weightKg")) {
    dbPatch.weight_kg = patch.weightKg;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "sleepHours")) {
    dbPatch.sleep_hours = patch.sleepHours;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "mood")) {
    dbPatch.mood = patch.mood;
  }

  const { error } = await supabase
    .from("entries")
    .upsert(
      { user_id: user.id, entry_date: dateISO, ...dbPatch },
      { onConflict: "user_id,entry_date" },
    );
  if (error) throw new Error(error.message);

  return (await loadEntryRow(dateISO)) ?? blankEntryShell(dateISO);
}

export async function toggleGoal(
  _mode: DataMode,
  dateISO: string,
  label: string,
): Promise<Entry> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: existingRow } = await supabase
    .from("entries")
    .select("goals_on")
    .eq("entry_date", dateISO)
    .maybeSingle();

  const current = parseStringArray(existingRow?.goals_on);
  const norm = label.toLowerCase();
  const has = current.some((x) => x.toLowerCase() === norm);
  const next = has
    ? current.filter((x) => x.toLowerCase() !== norm)
    : [...current, label];

  const { error } = await supabase
    .from("entries")
    .upsert(
      { user_id: user.id, entry_date: dateISO, goals_on: next },
      { onConflict: "user_id,entry_date" },
    );
  if (error) throw new Error(error.message);

  return (await loadEntryRow(dateISO)) ?? blankEntryShell(dateISO);
}

/* ----------------- Month range loader ----------------- */

function monthBounds(year: number, month: number): { start: string; end: string } {
  const m = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `${year}-${m}-01`,
    end: `${year}-${m}-${String(lastDay).padStart(2, "0")}`,
  };
}

export async function loadMonthEntries(
  _mode: DataMode,
  year: number,
  month: number,
): Promise<Entry[]> {
  const supabase = createClient();
  const { start, end } = monthBounds(year, month);
  const goalDefs = await loadGoalDefs();
  // Month rows don't render people, so we skip that column here (also keeps
  // this query working regardless of migration 005 state).
  const { data, error } = await supabase
    .from("entries")
    .select(ENTRY_COLS_BASE)
    .gte("entry_date", start)
    .lte("entry_date", end)
    .order("entry_date", { ascending: false });
  if (error || !data) return [];
  return data.map((d) => ({
    id: d.id as string,
    entryDate: d.entry_date as string,
    transcript: (d.transcript as string) ?? "",
    durationSeconds: 0,
    headline: (d.headline as string) ?? null,
    snippet: (d.snippet as string) ?? null,
    areas: parseAreasJson(d.areas),
    metrics: buildMetrics(d.weight_kg, d.sleep_hours, d.mood),
    goals: buildGoals(goalDefs, parseStringArray(d.goals_on)),
    people: [],
    createdAt: d.created_at as string,
  }));
}

/**
 * Upsert just the `people` column for a day (the Social-section names).
 * Called after the post-recording people-review step.
 */
export async function saveEntryPeople(
  _mode: DataMode,
  dateISO: string,
  people: string[],
): Promise<Entry> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Normalize: trim, drop empty, dedupe (case-insensitive, keep first casing).
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const p of people) {
    const t = p.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    clean.push(t);
  }

  // UPDATE only — never create a blank row here. People are always attached
  // to an entry that the recording already created; creating a row with only
  // `people` would show a headline-less "empty" entry (BUG1).
  const { error } = await supabase
    .from("entries")
    .update({ people: clean })
    .eq("user_id", user.id)
    .eq("entry_date", dateISO);
  // Tolerate a missing `people` column (migration 005 not yet applied): the
  // new people are still saved to Remember > Persone by the caller; only the
  // per-day Social link is deferred until the migration runs.
  if (error && !/people/i.test(error.message)) {
    throw new Error(error.message);
  }

  return (await loadEntryRow(dateISO)) ?? blankEntryShell(dateISO);
}
