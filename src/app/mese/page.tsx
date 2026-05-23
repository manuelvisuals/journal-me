import { createClient } from "@/lib/supabase/server";
import { MeseClient } from "@/components/mese/mese-client";
import type { AreaSummary, Entry, GoalDot, Mood } from "@/lib/types";

const VALID_MOODS: ReadonlySet<Mood> = new Set([
  "great",
  "good",
  "neutral",
  "low",
  "bad",
]);

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string");
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

export default async function MesePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  let entries: Entry[] = [];
  if (user) {
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const [{ data: goalsData }, { data }] = await Promise.all([
      supabase
        .from("goals")
        .select("id, label, position")
        .order("position", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("entries")
        .select(
          "id, entry_date, transcript, headline, snippet, areas, mood, weight_kg, sleep_hours, goals_on, created_at",
        )
        .gte("entry_date", start)
        .lte("entry_date", end)
        .order("entry_date", { ascending: false }),
    ]);

    const goalDefs = (goalsData ?? []).filter(
      (g) => typeof g.label === "string" && (g.label as string).trim().length > 0,
    );

    if (data) {
      entries = data.map((d) => {
        const goalsOn = parseStringArray(d.goals_on);
        const goals: GoalDot[] = goalDefs.map((g) => ({
          id: g.id as string,
          label: g.label as string,
          on: goalsOn.some(
            (x) => x.toLowerCase() === (g.label as string).toLowerCase(),
          ),
        }));
        return {
          id: d.id as string,
          entryDate: d.entry_date as string,
          transcript: (d.transcript as string) ?? "",
          durationSeconds: 0,
          headline: (d.headline as string) ?? null,
          snippet: (d.snippet as string) ?? null,
          areas: parseAreas(d.areas),
          metrics: {
            weightKg:
              typeof d.weight_kg === "number" ? (d.weight_kg as number) : null,
            sleepHours:
              typeof d.sleep_hours === "number"
                ? (d.sleep_hours as number)
                : null,
            mood:
              typeof d.mood === "string" && VALID_MOODS.has(d.mood as Mood)
                ? (d.mood as Mood)
                : null,
          },
          goals,
          people: [],
          createdAt: d.created_at as string,
        };
      });
    }
  }

  return <MeseClient mode="auth" initialMonth={{ year, month, entries }} />;
}
