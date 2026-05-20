"use client";

import { createClient } from "@/lib/supabase/client";
import type { DataMode } from "@/lib/data/entries";

const DEMO_KEY = "journalme-glossary";

function parseGlossary(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is string => typeof t === "string" && t.trim().length > 0);
}

async function loadDemo(): Promise<string[]> {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DEMO_KEY);
    if (!raw) return [];
    return parseGlossary(JSON.parse(raw));
  } catch {
    return [];
  }
}

async function saveDemo(terms: string[]): Promise<void> {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEMO_KEY, JSON.stringify(terms));
}

async function loadAuth(): Promise<string[]> {
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

async function saveAuth(terms: string[]): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { error } = await supabase
    .from("user_settings")
    .upsert(
      { user_id: user.id, glossary: terms },
      { onConflict: "user_id" },
    );
  if (error) throw new Error(error.message);
}

export async function loadGlossary(mode: DataMode): Promise<string[]> {
  return mode === "demo" ? loadDemo() : loadAuth();
}

export async function saveGlossary(
  mode: DataMode,
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
  return mode === "demo" ? saveDemo(clean) : saveAuth(clean);
}
