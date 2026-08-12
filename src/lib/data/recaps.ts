"use client";

import { createClient } from "@/lib/supabase/client";
import { apiUrl } from "@/lib/api";
import type { DataMode } from "@/lib/data/entries";
import { loadMonthEntries } from "@/lib/data/entries";
import type { Entry, Recap, RecapPeriod } from "@/lib/types";

export async function loadRecaps(_mode: DataMode): Promise<Recap[]> {
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

export async function updateRecap(
  _mode: DataMode,
  id: string,
  patch: { title?: string; snippet?: string; body?: string },
): Promise<Recap> {
  const supabase = createClient();
  const dbPatch: Record<string, unknown> = {};
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.snippet !== undefined) dbPatch.snippet = patch.snippet;
  if (patch.body !== undefined) dbPatch.body = patch.body;
  const { data, error } = await supabase
    .from("recaps")
    .update(dbPatch)
    .eq("id", id)
    .select(
      "id, period_type, period_start, period_end, title, snippet, body, generated_at",
    )
    .single();
  if (error || !data) throw new Error(error?.message ?? "DB error");
  return {
    id: data.id as string,
    periodType: data.period_type as RecapPeriod,
    periodStart: data.period_start as string,
    periodEnd: data.period_end as string,
    title: data.title as string,
    snippet: data.snippet as string,
    body: data.body as string,
    generatedAt: data.generated_at as string,
  };
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
  if (periodType === "month") {
    const [y, m] = periodStart.split("-").map(Number);
    return loadMonthEntries(mode, y, m);
  }
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

  const resp = await fetch(apiUrl("/api/recap/generate"), {
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
    id: data.id as string,
    periodType,
    periodStart,
    periodEnd,
    title: ai.title,
    snippet: ai.snippet,
    body: ai.body,
    generatedAt: data.generated_at as string,
  };
}
