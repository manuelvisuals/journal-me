import { createClient } from "@/lib/supabase/server";
import { RememberClient } from "@/components/remember/remember-client";
import type { Remember, RememberKind, RememberSource } from "@/lib/types";

const VALID_KINDS: ReadonlySet<RememberKind> = new Set([
  "persona",
  "todo",
  "nota",
  "luogo",
  "idea",
]);

export default async function RememberPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initial: Remember[] = [];
  if (user) {
    const { data } = await supabase
      .from("remembers")
      .select("id, text, kind, source, source_entry_id, created_at")
      .order("created_at", { ascending: false });
    if (data) {
      initial = data
        .filter((d) => VALID_KINDS.has(d.kind as RememberKind))
        .map((d) => ({
          id: d.id as string,
          text: d.text as string,
          kind: d.kind as RememberKind,
          source:
            d.source === "extracted"
              ? ("extracted" as RememberSource)
              : ("manual" as RememberSource),
          sourceEntryId: (d.source_entry_id as string | null) ?? null,
          createdAt: d.created_at as string,
        }));
    }
  }

  return <RememberClient mode="auth" initial={initial} />;
}
