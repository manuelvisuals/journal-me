"use client";

import { createClient } from "@/lib/supabase/client";
import { todayISO } from "@/lib/format";
import type { AreaSummary, Entry } from "@/lib/types";

export type DataMode = "demo" | "auth";

export type RecordingInput = {
  transcript: string;
  durationSeconds: number;
  /** Default date for segments without explicit temporal markers (YYYY-MM-DD). */
  defaultDate: string;
};

const DEMO_KEY_PREFIX = "journalme-entry-";
const SEGMENT_SEP = "\n---\n";

function demoKey(dateISO: string) {
  return `${DEMO_KEY_PREFIX}${dateISO}`;
}

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

/* ----------------- Demo (localStorage) ----------------- */

async function loadDemoEntry(dateISO: string): Promise<Entry | null> {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(demoKey(dateISO));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Entry;
    if (!Array.isArray(parsed.areas)) parsed.areas = [];
    return parsed;
  } catch {
    return null;
  }
}

async function saveDemoEntry(
  dateISO: string,
  transcript: string,
  ai: AIFields,
  durationSeconds: number,
): Promise<Entry> {
  const entry: Entry = {
    id: `demo-${dateISO}`,
    entryDate: dateISO,
    transcript,
    durationSeconds,
    headline: ai.headline,
    snippet: ai.snippet,
    areas: ai.areas,
    metrics: null,
    goals: [],
    createdAt: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(demoKey(dateISO), JSON.stringify(entry));
  }
  return entry;
}

/* ----------------- Auth (Supabase) ----------------- */

async function loadAuthEntry(dateISO: string): Promise<Entry | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("entries")
    .select(
      "id, entry_date, transcript, headline, snippet, areas, mood, weight_kg, sleep_hours, sleep_label, created_at",
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
    metrics: null,
    goals: [],
    createdAt: data.created_at as string,
  };
}

async function saveAuthEntry(
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

/* ----------------- Public API ----------------- */

export async function loadTodayEntry(mode: DataMode): Promise<Entry | null> {
  return loadEntryForDate(mode, todayISO());
}

export async function loadEntryForDate(
  mode: DataMode,
  dateISO: string,
): Promise<Entry | null> {
  return mode === "demo" ? loadDemoEntry(dateISO) : loadAuthEntry(dateISO);
}

/**
 * Save a recording. Default behavior: append to the entry of `defaultDate`
 * (the chip-selected target), regenerate AI summary on the full transcript.
 * If the AI detects relative date markers (ieri, stamattina, ...), the
 * transcript is split and dispatched silently to multiple days.
 */
export async function saveRecording(
  mode: DataMode,
  input: RecordingInput,
): Promise<Entry[]> {
  const segments = await callSplitByDate(input.transcript, input.defaultDate);
  const saved: Entry[] = [];

  // Process in series so that two segments on the same date don't race.
  for (const seg of segments) {
    const existing = await loadEntryForDate(mode, seg.date);
    const fullTranscript = existing?.transcript
      ? existing.transcript + SEGMENT_SEP + seg.text.trim()
      : seg.text.trim();
    const ai = await callProcessEntry(fullTranscript);
    const dur = seg.date === input.defaultDate ? input.durationSeconds : 0;
    const entry =
      mode === "demo"
        ? await saveDemoEntry(seg.date, fullTranscript, ai, dur)
        : await saveAuthEntry(seg.date, fullTranscript, ai, dur);
    saved.push(entry);
  }

  return saved;
}

/**
 * Re-process an already-saved entry after the user manually edits its
 * transcript (transcript editor flow). Replaces — does NOT append.
 */
export async function updateEntryTranscript(
  mode: DataMode,
  dateISO: string,
  newTranscript: string,
): Promise<Entry> {
  const ai = await callProcessEntry(newTranscript);
  return mode === "demo"
    ? saveDemoEntry(dateISO, newTranscript, ai, 0)
    : saveAuthEntry(dateISO, newTranscript, ai, 0);
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

async function loadDemoMonth(year: number, month: number): Promise<Entry[]> {
  if (typeof window === "undefined") return [];
  const { start, end } = monthBounds(year, month);
  const out: Entry[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(DEMO_KEY_PREFIX)) continue;
      const date = k.slice(DEMO_KEY_PREFIX.length);
      if (date < start || date > end) continue;
      const raw = window.localStorage.getItem(k);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as Entry;
        if (!Array.isArray(parsed.areas)) parsed.areas = [];
        out.push(parsed);
      } catch {
        // ignore corrupted entries
      }
    }
  } catch {
    return [];
  }
  out.sort((a, b) => (a.entryDate < b.entryDate ? 1 : -1));
  return out;
}

async function loadAuthMonth(year: number, month: number): Promise<Entry[]> {
  const supabase = createClient();
  const { start, end } = monthBounds(year, month);
  const { data, error } = await supabase
    .from("entries")
    .select(
      "id, entry_date, transcript, headline, snippet, areas, mood, weight_kg, sleep_hours, sleep_label, created_at",
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
    metrics: null,
    goals: [],
    createdAt: d.created_at as string,
  }));
}

export async function loadMonthEntries(
  mode: DataMode,
  year: number,
  month: number,
): Promise<Entry[]> {
  return mode === "demo"
    ? loadDemoMonth(year, month)
    : loadAuthMonth(year, month);
}
