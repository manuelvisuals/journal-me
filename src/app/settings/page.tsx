import { createClient } from "@/lib/supabase/server";
import { SettingsClient } from "@/components/settings/settings-client";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  // Anonymous Supabase users have no email; we treat that as a special label.
  const isAnonymous = !!user && !user.email;

  return (
    <SettingsClient
      mode="auth"
      email={user?.email ?? null}
      isAnonymous={isAnonymous}
      initialGlossary={initialGlossary}
    />
  );
}
