"use client";

import { createClient } from "@/lib/supabase/client";
import { todayISO } from "@/lib/format";
import type {
  AreaSummary,
  Entry,
  EntryMetrics,
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

export const DEFAULT_GOAL_LABELS = [
  "scopato",
  "no alcol",
  "no junkfood",
  "no sbirciato ex",
  "camminato",
  "visto sunset",
] as const;

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
    const resp = await fetch("/api/split-by-date", {
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
    const resp = await fetch("/api/process-entry", {
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

function buildGoals(labelsOn: string[]): GoalDot[] {
  const on = new Set(labelsOn.map((s) => s.toLowerCase()));
  return DEFAULT_GOAL_LABELS.map((label) => ({
    id: label,
    label,
    on: on.has(label.toLowerCase()),
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
    goals: buildGoals([]),
    createdAt: new Date().toISOString(),
  };
}

/* ----------------- Load ----------------- */

async function loadEntryRow(dateISO: string): Promise<Entry | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("entries")
    .select(
      "id, entry_date, transcript, headline, snippet, areas, mood, weight_kg, sleep_hours, goals_on, created_at",
    )
    .eq("entry_date", dateISO)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id as string,
    entryDate: data.entry_date as string,
    transcript: (data.transcript as string) ?? "",
    durationSeconds: 0,
    headline: (data.headline as string) ?? null,
    snippet: (data.snippet as string) ?? null,
    areas: parseAreasJson(data.areas),
    metrics: buildMetrics(data.weight_kg, data.sleep_hours, data.mood),
    goals: buildGoals(parseStringArray(data.goals_on)),
    createdAt: data.created_at as string,
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

  const { data, error } = await supabase
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
    )
    .select("id, created_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to save entry");
  }

  return {
    id: data.id as string,
    entryDate: dateISO,
    transcript,
    durationSeconds,
    headline: ai.headline,
    snippet: ai.snippet,
    areas: ai.areas,
    metrics: null,
    goals: [],
    createdAt: data.created_at as string,
  };
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
  const { data, error } = await supabase
    .from("entries")
    .select(
      "id, entry_date, transcript, headline, snippet, areas, mood, weight_kg, sleep_hours, goals_on, created_at",
    )
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
    goals: buildGoals(parseStringArray(d.goals_on)),
    createdAt: d.created_at as string,
  }));
}
