"use client";

import { createClient } from "@/lib/supabase/client";
import type { DataMode } from "@/lib/data/entries";
import type { Remember, RememberKind, RememberSource } from "@/lib/types";

const VALID_KINDS: ReadonlySet<RememberKind> = new Set([
  "persona",
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

/**
 * Load just the names of saved people (remembers with kind = 'persona').
 * Used to (a) dedupe AI-extracted people against the user's existing roster,
 * and (b) feed proper names to the transcription model as in-vocabulary terms
 * (replacing the removed Glossario).
 */
export async function loadPersonaNames(_mode?: DataMode): Promise<string[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("remembers")
    .select("text")
    .eq("kind", "persona")
    .order("created_at", { ascending: false });
  if (!data) return [];
  const seen = new Set<string>();
  const names: string[] = [];
  for (const d of data) {
    const t = typeof d.text === "string" ? d.text.trim() : "";
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    names.push(t);
  }
  return names;
}

/**
 * Bulk-insert new people into the roster (remembers, kind = 'persona',
 * source = 'extracted'). Skips names that already exist (case-insensitive).
 * Returns the names actually inserted.
 */
export async function addPersonas(
  _mode: DataMode,
  names: string[],
  sourceEntryId?: string | null,
): Promise<string[]> {
  const clean = names.map((n) => n.trim()).filter((n) => n.length > 0);
  if (clean.length === 0) return [];

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Dedupe against what's already saved.
  const existing = await loadPersonaNames("auth");
  const existingLower = new Set(existing.map((e) => e.toLowerCase()));

  const seen = new Set<string>();
  const toInsert: string[] = [];
  for (const n of clean) {
    const k = n.toLowerCase();
    if (existingLower.has(k) || seen.has(k)) continue;
    seen.add(k);
    toInsert.push(n);
  }
  if (toInsert.length === 0) return [];

  const rows = toInsert.map((text) => ({
    user_id: user.id,
    text,
    kind: "persona" as const,
    source: "extracted" as const,
    source_entry_id: sourceEntryId ?? null,
  }));
  const { error } = await supabase.from("remembers").insert(rows);
  if (error) throw new Error(error.message);
  return toInsert;
}

/**
 * Update the kind of an existing remember. Used after AI auto-classification
 * reclassifies a manually-saved 'nota' into a more specific bucket.
 */
export async function updateRememberKind(
  _mode: DataMode,
  id: string,
  kind: RememberKind,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("remembers")
    .update({ kind })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
