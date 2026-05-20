import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { TodayClient } from "@/components/today/today-client";
import { todayISO } from "@/lib/format";
import type { Entry } from "@/lib/types";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cookieStore = await cookies();
  const isDemo = cookieStore.get("journalme-demo")?.value === "1";

  const mode: "demo" | "auth" = user ? "auth" : isDemo ? "demo" : "demo";

  // For auth mode, try to fetch today's entry server-side so the first paint
  // is correct (filled view if entry exists, empty otherwise).
  let initialEntry: Entry | null = null;
  if (user) {
    const dateISO = todayISO();
    const { data } = await supabase
      .from("entries")
      .select("id, entry_date, transcript, headline, snippet, created_at")
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
        areas: [],
        metrics: null,
        goals: [],
        createdAt: data.created_at as string,
      };
    }
  }

  return <TodayClient mode={mode} initialEntry={initialEntry} />;
}
