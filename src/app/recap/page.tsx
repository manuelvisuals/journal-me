import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { RecapClient } from "@/components/recap/recap-client";
import type { Recap, RecapPeriod } from "@/lib/types";

export default async function RecapPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cookieStore = await cookies();
  const isDemo = cookieStore.get("journalme-demo")?.value === "1";

  const mode: "demo" | "auth" = user ? "auth" : isDemo ? "demo" : "demo";

  let initialRecaps: Recap[] = [];
  if (user) {
    const { data } = await supabase
      .from("recaps")
      .select(
        "id, period_type, period_start, period_end, title, snippet, body, generated_at",
      )
      .order("period_start", { ascending: false });
    if (data) {
      initialRecaps = data.map((d) => ({
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
  }

  return <RecapClient mode={mode} initialRecaps={initialRecaps} />;
}
