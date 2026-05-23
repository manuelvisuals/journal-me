import { createClient } from "@/lib/supabase/server";
import { SettingsClient } from "@/components/settings/settings-client";
import type { GoalDef } from "@/lib/types";

const MONTH_NAMES_IT = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

function periodLabelFor(
  periodType: string,
  periodStart: string,
): string {
  const [y, m] = periodStart.split("-").map(Number);
  if (periodType === "month") {
    return `${MONTH_NAMES_IT[m - 1]} ${y}`;
  }
  if (periodType === "semester") {
    return `Semestre ${m <= 6 ? 1 : 2} ${y}`;
  }
  return `Anno ${y}`;
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initialGoals: GoalDef[] = [];
  let latestRecap: { title: string; periodLabel: string } | null = null;
  if (user) {
    const { data: goalsData } = await supabase
      .from("goals")
      .select("id, label, is_ai_suggested, position")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    initialGoals = (goalsData ?? [])
      .filter((g) => typeof g.label === "string" && (g.label as string).trim())
      .map((g) => ({
        id: g.id as string,
        label: g.label as string,
        isAiSuggested: !!g.is_ai_suggested,
      }));

    // Most recent recap (across all periods) as a teaser inside the Recap
    // card. Fetched server-side so the card is filled on first paint.
    const { data: recapData } = await supabase
      .from("recaps")
      .select("title, period_type, period_start, generated_at")
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recapData?.title && recapData?.period_type && recapData?.period_start) {
      latestRecap = {
        title: recapData.title as string,
        periodLabel: periodLabelFor(
          recapData.period_type as string,
          recapData.period_start as string,
        ),
      };
    }
  }

  // Anonymous Supabase users have no email; we treat that as a special label.
  const isAnonymous = !!user && !user.email;

  return (
    <SettingsClient
      mode="auth"
      email={user?.email ?? null}
      isAnonymous={isAnonymous}
      initialGoals={initialGoals}
      latestRecap={latestRecap}
    />
  );
}
