"use client";

import { createClient } from "@/lib/supabase/client";
import type { DataMode } from "@/lib/data/entries";
import { loadMonthEntries } from "@/lib/data/entries";
import type { Entry, Recap, RecapPeriod } from "@/lib/types";

const DEMO_KEY = "journalme-recaps";

function parseRecaps(raw: unknown): Recap[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (r): r is Recap =>
      typeof r === "object" &&
      r !== null &&
      typeof (r as { id?: unknown }).id === "string" &&
      typeof (r as { title?: unknown }).title === "string",
  );
}

async function loadDemo(): Promise<Recap[]> {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DEMO_KEY);
    if (!raw) return [];
    return parseRecaps(JSON.parse(raw));
  } catch {
    return [];
  }
}

async function saveDemo(recaps: Recap[]): Promise<void> {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEMO_KEY, JSON.stringify(recaps));
}

async function loadAuth(): Promise<Recap[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("recaps")
    .select(
      "id, period_type, period_start, period_end, title, snippet, body, generated_at",
    )
    .order("period_start", { ascending: false });
  if (!data) return [];
  return data.map((d) => ({
    id: d.id as string,
    periodType: d.period_type as RecapPeriod,
    periodStart: d.period_start as string,
    periodEnd: d.period_end as string,
    title: d.title as string,
    snippet: d.snippet as string,
    body: d.body as string,
    generatedAt: d.generated_at as string,
  }));
}

export async function loadRecaps(mode: DataMode): Promise<Recap[]> {
  return mode === "demo" ? loadDemo() : loadAuth();
}

/* ----------------- Period helpers ----------------- */

export function monthBoundaries(year: number, month: number) {
  const m = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `${year}-${m}-01`,
    end: `${year}-${m}-${String(lastDay).padStart(2, "0")}`,
  };
}

/* ----------------- Generate ----------------- */

async function loadEntriesForPeriod(
  mode: DataMode,
  periodType: RecapPeriod,
  periodStart: string,
): Promise<Entry[]> {
  // For MVP, only monthly is implemented end-to-end. Semester/year
  // would aggregate across months.
  if (periodType === "month") {
    const [y, m] = periodStart.split("-").map(Number);
    return loadMonthEntries(mode, y, m);
  }
  // Semester: 6 months including start. Year: 12 months.
  const [y, m] = periodStart.split("-").map(Number);
  const months = periodType === "semester" ? 6 : 12;
  const out: Entry[] = [];
  for (let i = 0; i < months; i++) {
    const monthIndex = m - 1 + i;
    const ty = y + Math.floor(monthIndex / 12);
    const tm = (monthIndex % 12) + 1;
    out.push(...(await loadMonthEntries(mode, ty, tm)));
  }
  return out;
}

export async function generateAndSaveRecap(
  mode: DataMode,
  periodType: RecapPeriod,
  periodStart: string,
  periodEnd: string,
): Promise<Recap> {
  const entries = await loadEntriesForPeriod(mode, periodType, periodStart);
  const usable = entries.filter((e) => e.transcript.trim().length > 0);
  if (usable.length === 0) {
    throw new Error("Nessuna giornata raccontata in questo periodo.");
  }

  const resp = await fetch("/api/recap/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      periodType,
      periodStart,
      periodEnd,
      entries: usable.map((e) => ({
        entryDate: e.entryDate,
        transcript: e.transcript,
        headline: e.headline,
        snippet: e.snippet,
      })),
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`AI error: ${txt.slice(0, 200)}`);
  }
  const ai = (await resp.json()) as {
    title: string;
    snippet: string;
    body: string;
  };

  const recap: Recap = {
    id:
      mode === "demo"
        ? `demo-${periodType}-${periodStart}`
        : crypto.randomUUID(),
    periodType,
    periodStart,
    periodEnd,
    title: ai.title,
    snippet: ai.snippet,
    body: ai.body,
    generatedAt: new Date().toISOString(),
  };

  if (mode === "demo") {
    const all = await loadDemo();
    const without = all.filter(
      (r) => !(r.periodType === periodType && r.periodStart === periodStart),
    );
    await saveDemo([recap, ...without]);
    return recap;
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("recaps")
    .upsert(
      {
        user_id: user.id,
        period_type: periodType,
        period_start: periodStart,
        period_end: periodEnd,
        title: ai.title,
        snippet: ai.snippet,
        body: ai.body,
      },
      { onConflict: "user_id,period_type,period_start" },
    )
    .select("id, generated_at")
    .single();

  if (error || !data) throw new Error(error?.message ?? "DB error");

  return {
    ...recap,
    id: data.id as string,
    generatedAt: data.generated_at as string,
  };
}
