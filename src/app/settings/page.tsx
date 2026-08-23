"use client";

import { useEffect, useState } from "react";
import { SettingsClient } from "@/components/settings/settings-client";
import SettingsLoading from "./loading";
import { resolveStorageMode } from "@/lib/data/store";
import { loadGoalDefs } from "@/lib/data/goals";
import { loadRecaps } from "@/lib/data/recaps";
import { signalReady } from "@/lib/app-ready";
import { recapPeriodLabel } from "@/lib/recap-labels";
import type { GoalDef } from "@/lib/types";

type Boot = {
  email: string | null;
  isAnonymous: boolean;
  goals: GoalDef[];
  latestRecap: { title: string; periodLabel: string } | null;
};

export default function SettingsPage() {
  const [boot, setBoot] = useState<Boot | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      // In modalita locale il client Supabase non si costruisce nemmeno:
      // niente email da mostrare, e i dati arrivano da IndexedDB via store.
      const mode = await resolveStorageMode();
      let user: { email?: string | null } | null = null;
      if (mode !== "local") {
        const { createClient } = await import("@/lib/supabase/client");
        const { data } = await createClient().auth.getUser();
        user = data.user;
      }
      const [goals, recaps] = await Promise.all([
        loadGoalDefs(),
        loadRecaps("auth"),
      ]);
      if (!alive) return;
      // The newest recap across all periods, as the teaser inside the Recap card.
      const newest = [...recaps].sort((a, b) =>
        b.generatedAt.localeCompare(a.generatedAt),
      )[0];

      setBoot({
        email: user?.email ?? null,
        // Anonymous Supabase users have no email; that is a distinct label.
        isAnonymous: !!user && !user.email,
        goals,
        latestRecap: newest
          ? {
              title: newest.title,
              periodLabel: recapPeriodLabel(newest.periodType, newest.periodStart),
            }
          : null,
      });
      signalReady();
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!boot) return <SettingsLoading />;

  return (
    <SettingsClient
      mode="auth"
      email={boot.email}
      isAnonymous={boot.isAnonymous}
      initialGoals={boot.goals}
      latestRecap={boot.latestRecap}
    />
  );
}
