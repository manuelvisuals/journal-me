"use client";

import { createClient } from "@/lib/supabase/client";
import type { DataMode } from "@/lib/data/entries";

function parseGlossary(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is string => typeof t === "string" && t.trim().length > 0);
}

export async function loadGlossary(_mode: DataMode): Promise<string[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("user_settings")
    .select("glossary")
    .eq("user_id", user.id)
    .maybeSingle();
  return parseGlossary(data?.glossary);
}

export async function saveGlossary(
  _mode: DataMode,
  terms: string[],
): Promise<void> {
  // Normalize: trim, dedupe (case-insensitive), drop empty.
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const t of terms) {
    const trimmed = t.trim();
    if (!trimmed) continue;
    const k = trimmed.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    clean.push(trimmed);
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { error } = await supabase
    .from("user_settings")
    .upsert(
      { user_id: user.id, glossary: clean },
      { onConflict: "user_id" },
    );
  if (error) throw new Error(error.message);
}
