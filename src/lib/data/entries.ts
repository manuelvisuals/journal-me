"use client";

import { createClient } from "@/lib/supabase/client";
import { todayISO } from "@/lib/format";
import type { AreaSummary, Entry } from "@/lib/types";

export type DataMode = "demo" | "auth";

export type SaveEntryInput = {
  transcript: string;
  durationSeconds: number;
};

const DEMO_KEY_PREFIX = "journalme-entry-";

function demoKey(dateISO: string) {
  return `${DEMO_KEY_PREFIX}${dateISO}`;
}

/* ----------------- AI processing ----------------- */

type AIFields = {
  headline: string;
  snippet: string;
  areas: AreaSummary[];
};

function fallbackAIFields(transcript: string, durationSeconds: number): AIFields {
  const firstSentence = transcript.trim().split(/(?<=[.!?])\s/)[0] ?? "";
  const minutes = Math.max(1, Math.round(durationSeconds / 60));
  return {
    headline: `Giornata raccontata in ${minutes} minut${minutes === 1 ? "o" : "i"}`,
    snippet: firstSentence.slice(0, 240),
    areas: [],
  };
}

async function processTranscript(
  transcript: string,
  durationSeconds: number,
): Promise<AIFields> {
  try {
    const resp = await fetch("/api/process-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript }),
    });
    if (!resp.ok) {
      return fallbackAIFields(transcript, durationSeconds);
    }
    const data = (await resp.json()) as Partial<AIFields>;
    if (!data.headline || !data.snippet) {
      return fallbackAIFields(transcript, durationSeconds);
    }
    return {
      headline: data.headline,
      snippet: data.snippet,
      areas: Array.isArray(data.areas) ? data.areas : [],
    };
  } catch {
    return fallbackAIFields(transcript, durationSeconds);
  }
}

/* ----------------- Demo (localStorage) ----------------- */

function buildDemoEntry(
  input: SaveEntryInput,
  ai: AIFields,
  dateISO: string,
): Entry {
  return {
    id: `demo-${dateISO}`,
    entryDate: dateISO,
    transcript: input.transcript,
    durationSeconds: input.durationSeconds,
    headline: ai.headline,
    snippet: ai.snippet,
    areas: ai.areas,
    metrics: null,
    goals: [],
    createdAt: new Date().toISOString(),
  };
}

async function loadDemoEntry(dateISO: string): Promise<Entry | null> {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(demoKey(dateISO));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Entry;
    // Backfill areas for entries persisted before the AI integration.
    if (!Array.isArray(parsed.areas)) parsed.areas = [];
    return parsed;
  } catch {
    return null;
  }
}

async function saveDemoEntry(
  input: SaveEntryInput,
  ai: AIFields,
  dateISO: string,
): Promise<Entry> {
  const entry = buildDemoEntry(input, ai, dateISO);
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
  input: SaveEntryInput,
  ai: AIFields,
  dateISO: string,
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
        transcript: input.transcript,
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
    transcript: input.transcript,
    durationSeconds: input.durationSeconds,
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
  const dateISO = todayISO();
  return mode === "demo" ? loadDemoEntry(dateISO) : loadAuthEntry(dateISO);
}

export async function saveTodayEntry(
  mode: DataMode,
  input: SaveEntryInput,
): Promise<Entry> {
  const dateISO = todayISO();
  const ai = await processTranscript(input.transcript, input.durationSeconds);
  return mode === "demo"
    ? saveDemoEntry(input, ai, dateISO)
    : saveAuthEntry(input, ai, dateISO);
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
