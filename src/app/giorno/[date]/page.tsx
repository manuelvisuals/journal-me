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

const DEFAULT_GOAL_LABELS = [
  "scopato",
  "no alcol",
  "no junkfood",
  "no sbirciato ex",
  "camminato",
  "visto sunset",
];

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
    const { data } = await supabase
      .from("entries")
      .select(
        "id, entry_date, transcript, duration_seconds, headline, snippet, areas, weight_kg, sleep_hours, mood, goals_on, created_at",
      )
      .eq("entry_date", date)
      .maybeSingle();

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
      const goals: GoalDot[] = DEFAULT_GOAL_LABELS.map((label) => ({
        id: label,
        label,
        on: goalsOn.some((g) => g.toLowerCase() === label.toLowerCase()),
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
        createdAt: (data.created_at as string) ?? "",
      };
    }
  }

  return <DayClient mode="auth" date={date} initialEntry={entry} />;
}
