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
