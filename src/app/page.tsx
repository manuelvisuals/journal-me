import { createClient } from "@/lib/supabase/server";
import { TodayClient } from "@/components/today/today-client";
import { todayISO } from "@/lib/format";
import type { Entry } from "@/lib/types";

type SearchParams = Promise<{ record?: string }>;

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
  if (user) {
    const dateISO = todayISO();
    const { data } = await supabase
      .from("entries")
      .select("id, entry_date, transcript, headline, snippet, areas, created_at")
      .eq("entry_date", dateISO)
      .maybeSingle();
    if (data) {
      initialEntry = {
        id: data.id as string,
        entryDate: data.entry_date as string,
        transcript: (data.transcript as string) ?? "",
        durationSeconds: 0,
        headline: (data.headline as string) ?? null,
        snippet: (data.snippet as string) ?? null,
        areas: parseAreas(data.areas),
        metrics: null,
        goals: [],
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
      autoRecord={autoRecord}
    />
  );
}

function parseAreas(raw: unknown): { label: string; text: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is { label: string; text: string } =>
      typeof x === "object" &&
      x !== null &&
      typeof (x as { label?: unknown }).label === "string" &&
      typeof (x as { text?: unknown }).text === "string",
  );
}
