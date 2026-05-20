"use client";

import { createClient } from "@/lib/supabase/client";
import type { DataMode } from "@/lib/data/entries";
import type { Remember, RememberKind, RememberSource } from "@/lib/types";

const VALID_KINDS: ReadonlySet<RememberKind> = new Set([
  "persona",
  "libro",
  "todo",
  "nota",
  "luogo",
  "idea",
]);
const VALID_SOURCES: ReadonlySet<RememberSource> = new Set([
  "manual",
  "extracted",
]);

export async function loadRemembers(_mode: DataMode): Promise<Remember[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("remembers")
    .select("id, text, kind, source, source_entry_id, created_at")
    .order("created_at", { ascending: false });
  if (!data) return [];
  return data
    .filter((d) => VALID_KINDS.has(d.kind as RememberKind))
    .map((d) => ({
      id: d.id as string,
      text: d.text as string,
      kind: d.kind as RememberKind,
      source: VALID_SOURCES.has(d.source as RememberSource)
        ? (d.source as RememberSource)
        : "manual",
      sourceEntryId: (d.source_entry_id as string | null) ?? null,
      createdAt: d.created_at as string,
    }));
}

export async function addRemember(
  _mode: DataMode,
  text: string,
  kind: RememberKind,
): Promise<Remember> {
  const clean = text.trim();
  if (!clean) throw new Error("Text required");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("remembers")
    .insert({
      user_id: user.id,
      text: clean,
      kind,
      source: "manual",
    })
    .select("id, created_at")
    .single();
  if (error || !data) throw new Error(error?.message ?? "DB error");
  return {
    id: data.id as string,
    text: clean,
    kind,
    source: "manual",
    sourceEntryId: null,
    createdAt: data.created_at as string,
  };
}

export async function deleteRemember(
  _mode: DataMode,
  id: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("remembers").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
