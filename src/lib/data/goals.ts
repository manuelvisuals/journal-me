"use client";

import { createClient } from "@/lib/supabase/client";
import type { DataMode } from "@/lib/data/entries";
import type { GoalDef } from "@/lib/types";

/**
 * Micro-goal definitions live in the per-user `goals` table (seeded with the
 * user's defaults by a trigger on auth.users). There is NO hardcoded fallback:
 * if a user has no goals, the goal-dot area is simply empty.
 */
export async function loadGoalDefs(_mode?: DataMode): Promise<GoalDef[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("goals")
    .select("id, label, is_ai_suggested, position")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data
    .filter((g) => typeof g.label === "string" && g.label.trim().length > 0)
    .map((g) => ({
      id: g.id as string,
      label: g.label as string,
      isAiSuggested: !!g.is_ai_suggested,
    }));
}

export async function addGoal(
  _mode: DataMode,
  label: string,
): Promise<GoalDef> {
  const clean = label.trim();
  if (!clean) throw new Error("Label required");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Next position = max(position) + 1, so new goals append to the end.
  const { data: existing } = await supabase
    .from("goals")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition =
    existing && typeof existing.position === "number"
      ? (existing.position as number) + 1
      : 0;

  const { data, error } = await supabase
    .from("goals")
    .insert({
      user_id: user.id,
      label: clean,
      position: nextPosition,
      is_ai_suggested: false,
    })
    .select("id, label, is_ai_suggested")
    .single();
  if (error || !data) throw new Error(error?.message ?? "DB error");
  return {
    id: data.id as string,
    label: data.label as string,
    isAiSuggested: !!data.is_ai_suggested,
  };
}

export async function removeGoal(_mode: DataMode, id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
