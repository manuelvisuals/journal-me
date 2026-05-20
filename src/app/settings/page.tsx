import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { SettingsClient } from "@/components/settings/settings-client";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cookieStore = await cookies();
  const isDemo = cookieStore.get("journalme-demo")?.value === "1";

  const mode: "demo" | "auth" = user ? "auth" : isDemo ? "demo" : "demo";

  let initialGlossary: string[] = [];
  if (user) {
    const { data } = await supabase
      .from("user_settings")
      .select("glossary")
      .eq("user_id", user.id)
      .maybeSingle();
    if (Array.isArray(data?.glossary)) {
      initialGlossary = (data.glossary as unknown[]).filter(
        (t): t is string => typeof t === "string",
      );
    }
  }

  return (
    <SettingsClient
      mode={mode}
      email={user?.email ?? null}
      initialGlossary={initialGlossary}
    />
  );
}
