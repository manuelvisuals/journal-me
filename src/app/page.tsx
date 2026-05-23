import { createClient } from "@/lib/supabase/server";
import { TodayClient } from "@/components/today/today-client";
import { todayISO } from "@/lib/format";
import type {
  AreaSummary,
  Entry,
  EntryMetrics,
  GoalDef,
  GoalDot,
  Mood,
} from "@/lib/types";

type SearchParams = Promise<{ record?: string }>;

const VALID_MOODS: ReadonlySet<Mood> = new Set([
  "great",
  "good",
  "neutral",
  "low",
  "bad",
]);

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // proxy.ts already redirects unauthenticated users to /login; if we got
  // here without a user something's odd — render an empty shell.
  let initialEntry: Entry | null = null;
  let goalDefs: GoalDef[] = [];
  if (user) {
    const dateISO = todayISO();

    const [{ data: goalsData }, { data }] = await Promise.all([
      supabase
        .from("goals")
        .select("id, label, is_ai_suggested, position")
        .order("position", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("entries")
        .select(
          "id, entry_date, transcript, headline, snippet, areas, mood, weight_kg, sleep_hours, goals_on, people, created_at",
        )
        .eq("entry_date", dateISO)
        .maybeSingle(),
    ]);

    goalDefs = (goalsData ?? [])
      .filter((g) => typeof g.label === "string" && (g.label as string).trim())
      .map((g) => ({
        id: g.id as string,
        label: g.label as string,
        isAiSuggested: !!g.is_ai_suggested,
      }));

    if (data) {
      const metrics: EntryMetrics = {
        weightKg: typeof data.weight_kg === "number" ? data.weight_kg : null,
        sleepHours:
          typeof data.sleep_hours === "number" ? data.sleep_hours : null,
        mood:
          typeof data.mood === "string" && VALID_MOODS.has(data.mood as Mood)
            ? (data.mood as Mood)
            : null,
      };
      const goalsOn = parseStringArray(data.goals_on);
      const goals: GoalDot[] = goalDefs.map((d) => ({
        id: d.id,
        label: d.label,
        on: goalsOn.some((g) => g.toLowerCase() === d.label.toLowerCase()),
      }));
      initialEntry = {
        id: data.id as string,
        entryDate: data.entry_date as string,
        transcript: (data.transcript as string) ?? "",
        durationSeconds: 0,
        headline: (data.headline as string) ?? null,
        snippet: (data.snippet as string) ?? null,
        areas: parseAreas(data.areas),
        metrics,
        goals,
        people: parseStringArray(data.people),
        createdAt: data.created_at as string,
      };
    }
  }

  const sp = await searchParams;
  const autoRecord = sp.record === "1";

  return (
    <TodayClient
      mode="auth"
      initialEntry={initialEntry}
      goalDefs={goalDefs}
      autoRecord={autoRecord}
    />
  );
}

function parseAreas(raw: unknown): AreaSummary[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is AreaSummary =>
      typeof x === "object" &&
      x !== null &&
      typeof (x as { label?: unknown }).label === "string" &&
      typeof (x as { text?: unknown }).text === "string",
  );
}

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string");
}
