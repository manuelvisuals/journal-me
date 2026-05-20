"use client";

import { createClient } from "@/lib/supabase/client";
import { todayISO } from "@/lib/format";
import type { Entry } from "@/lib/types";

export type DataMode = "demo" | "auth";

export type SaveEntryInput = {
  transcript: string;
  durationSeconds: number;
};

const DEMO_KEY_PREFIX = "journalme-entry-";

function demoKey(dateISO: string) {
  return `${DEMO_KEY_PREFIX}${dateISO}`;
}

function makeDemoEntry(input: SaveEntryInput, dateISO: string): Entry {
  const firstSentence = input.transcript.trim().split(/(?<=[.!?])\s/)[0] ?? "";
  const minutes = Math.max(1, Math.round(input.durationSeconds / 60));
  return {
    id: `demo-${dateISO}`,
    entryDate: dateISO,
    transcript: input.transcript,
    durationSeconds: input.durationSeconds,
    headline: `Giornata raccontata in ${minutes} minut${minutes === 1 ? "o" : "i"}`,
    snippet: firstSentence.slice(0, 240),
    areas: [],
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
    return JSON.parse(raw) as Entry;
  } catch {
    return null;
  }
}

async function saveDemoEntry(
  input: SaveEntryInput,
  dateISO: string,
): Promise<Entry> {
  const entry = makeDemoEntry(input, dateISO);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(demoKey(dateISO), JSON.stringify(entry));
  }
  return entry;
}

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
    areas: [],
    metrics: null,
    goals: [],
    createdAt: data.created_at as string,
  };
}

async function saveAuthEntry(
  input: SaveEntryInput,
  dateISO: string,
): Promise<Entry> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const firstSentence = input.transcript.trim().split(/(?<=[.!?])\s/)[0] ?? "";
  const minutes = Math.max(1, Math.round(input.durationSeconds / 60));
  const headline = `Giornata raccontata in ${minutes} minut${minutes === 1 ? "o" : "i"}`;
  const snippet = firstSentence.slice(0, 240);

  const { data, error } = await supabase
    .from("entries")
    .upsert(
      {
        user_id: user.id,
        entry_date: dateISO,
        transcript: input.transcript,
        headline,
        snippet,
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
    headline,
    snippet,
    areas: [],
    metrics: null,
    goals: [],
    createdAt: data.created_at as string,
  };
}

export async function loadTodayEntry(mode: DataMode): Promise<Entry | null> {
  const dateISO = todayISO();
  return mode === "demo"
    ? loadDemoEntry(dateISO)
    : loadAuthEntry(dateISO);
}

export async function saveTodayEntry(
  mode: DataMode,
  input: SaveEntryInput,
): Promise<Entry> {
  const dateISO = todayISO();
  return mode === "demo"
    ? saveDemoEntry(input, dateISO)
    : saveAuthEntry(input, dateISO);
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
        out.push(JSON.parse(raw) as Entry);
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
      "id, entry_date, transcript, headline, snippet, mood, weight_kg, sleep_hours, sleep_label, created_at",
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
    areas: [],
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
