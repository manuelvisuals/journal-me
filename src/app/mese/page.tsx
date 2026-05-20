import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { MeseClient } from "@/components/mese/mese-client";
import type { Entry } from "@/lib/types";

export default async function MesePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cookieStore = await cookies();
  const isDemo = cookieStore.get("journalme-demo")?.value === "1";
  const mode: "demo" | "auth" = user ? "auth" : isDemo ? "demo" : "demo";

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  let entries: Entry[] = [];
  if (user) {
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const { data } = await supabase
      .from("entries")
      .select(
        "id, entry_date, transcript, headline, snippet, created_at",
      )
      .gte("entry_date", start)
      .lte("entry_date", end)
      .order("entry_date", { ascending: false });
    if (data) {
      entries = data.map((d) => ({
        id: d.id as string,
        entryDate: d.entry_date as string,
        transcript: (d.transcript as string) ?? "",
        durationSeconds: 0,
        headline: (d.headline as string) ?? null,
        snippet: (d.snippet as string) ?? null,
        areas: [],
        metrics: null,
        goals: [],
        createdAt: d.created_at as string,
      }));
    }
  }

  return (
    <MeseClient
      mode={mode}
      initialMonth={{ year, month, entries }}
    />
  );
}
