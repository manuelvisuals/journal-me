import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DayClient } from "@/components/day/day-client";
import type {
  AreaSummary,
  Entry,
  EntryMetrics,
  GoalDot,
  Mood,
} from "@/lib/types";

type Params = { date: string };

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseAreasField(value: unknown): AreaSummary[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (v): v is { label: unknown; text: unknown } =>
        !!v && typeof v === "object",
    )
    .map((v) => ({
      label: typeof v.label === "string" ? v.label : "",
      text: typeof v.text === "string" ? v.text : "",
    }))
    .filter((a) => a.label.length > 0);
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

const VALID_MOODS: ReadonlySet<Mood> = new Set([
  "great",
  "good",
  "neutral",
  "low",
  "bad",
]);

export default async function DayPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { date } = await params;
  if (!ISO_RE.test(date)) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let entry: Entry | null = null;
  if (user) {
    const COLS_FULL =
      "id, entry_date, transcript, duration_seconds, headline, snippet, areas, weight_kg, sleep_hours, mood, goals_on, people, created_at";
    const COLS_BASE =
      "id, entry_date, transcript, duration_seconds, headline, snippet, areas, weight_kg, sleep_hours, mood, goals_on, created_at";

    const [{ data: goalsData }, entryRes] = await Promise.all([
      supabase
        .from("goals")
        .select("id, label, position")
        .order("position", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("entries")
        .select(COLS_FULL)
        .eq("entry_date", date)
        .maybeSingle(),
    ]);

    // Defensive: fall back to base columns if migration 005 (people) is not
    // applied yet.
    let data = entryRes.data as Record<string, unknown> | null;
    if (entryRes.error) {
      const base = await supabase
        .from("entries")
        .select(COLS_BASE)
        .eq("entry_date", date)
        .maybeSingle();
      data = base.data as Record<string, unknown> | null;
    }

    const goalDefs = (goalsData ?? []).filter(
      (g) => typeof g.label === "string" && (g.label as string).trim().length > 0,
    );

    if (data) {
      const metrics: EntryMetrics = {
        weightKg:
          typeof data.weight_kg === "number" ? (data.weight_kg as number) : null,
        sleepHours:
          typeof data.sleep_hours === "number"
            ? (data.sleep_hours as number)
            : null,
        mood:
          typeof data.mood === "string" && VALID_MOODS.has(data.mood as Mood)
            ? (data.mood as Mood)
            : null,
      };
      const goalsOn = parseStringArray(data.goals_on);
      const goals: GoalDot[] = goalDefs.map((g) => ({
        id: g.id as string,
        label: g.label as string,
        on: goalsOn.some(
          (x) => x.toLowerCase() === (g.label as string).toLowerCase(),
        ),
      }));
      entry = {
        id: data.id as string,
        entryDate: data.entry_date as string,
        transcript: (data.transcript as string) ?? "",
        durationSeconds: (data.duration_seconds as number) ?? 0,
        headline: (data.headline as string | null) ?? null,
        snippet: (data.snippet as string | null) ?? null,
        areas: parseAreasField(data.areas),
        metrics,
        goals,
        people: parseStringArray(data.people),
        createdAt: (data.created_at as string) ?? "",
      };
    }
  }

  return <DayClient mode="auth" date={date} initialEntry={entry} />;
}
