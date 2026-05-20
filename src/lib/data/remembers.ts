"use client";

import { createClient } from "@/lib/supabase/client";
import type { DataMode } from "@/lib/data/entries";
import type { Remember, RememberKind, RememberSource } from "@/lib/types";

const DEMO_KEY = "journalme-remembers";

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

function parseList(raw: unknown): Remember[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (r): r is Remember =>
      typeof r === "object" &&
      r !== null &&
      typeof (r as { id?: unknown }).id === "string" &&
      typeof (r as { text?: unknown }).text === "string" &&
      VALID_KINDS.has((r as { kind?: unknown }).kind as RememberKind),
  );
}

async function loadDemo(): Promise<Remember[]> {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DEMO_KEY);
    if (!raw) return [];
    return parseList(JSON.parse(raw));
  } catch {
    return [];
  }
}

async function saveDemo(list: Remember[]): Promise<void> {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEMO_KEY, JSON.stringify(list));
}

async function loadAuth(): Promise<Remember[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("remembers")
    .select("id, text, kind, source, source_entry_id, created_at")
    .order("created_at", { ascending: false });
  if (!data) return [];
  return data.map((d) => ({
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

export async function loadRemembers(mode: DataMode): Promise<Remember[]> {
  return mode === "demo" ? loadDemo() : loadAuth();
}

export async function addRemember(
  mode: DataMode,
  text: string,
  kind: RememberKind,
): Promise<Remember> {
  const clean = text.trim();
  if (!clean) throw new Error("Text required");

  if (mode === "demo") {
    const list = await loadDemo();
    const rem: Remember = {
      id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: clean,
      kind,
      source: "manual",
      sourceEntryId: null,
      createdAt: new Date().toISOString(),
    };
    await saveDemo([rem, ...list]);
    return rem;
  }

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
  mode: DataMode,
  id: string,
): Promise<void> {
  if (mode === "demo") {
    const list = await loadDemo();
    await saveDemo(list.filter((r) => r.id !== id));
    return;
  }
  const supabase = createClient();
  const { error } = await supabase.from("remembers").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
