"use client";

import { useEffect, useState } from "react";
import { TodayClient } from "@/components/today/today-client";
import { TabBar } from "@/components/ui/tab-bar";
import { loadTodayEntry } from "@/lib/data/entries";
import { loadGoalDefs } from "@/lib/data/goals";
import { signalReady } from "@/lib/app-ready";
import type { Entry, GoalDef } from "@/lib/types";

type Boot = { entry: Entry | null; goalDefs: GoalDef[] };

/**
 * Today used to be a server component that queried Supabase with the session
 * cookie and handed the result to TodayClient. The screen now loads its own
 * data in the app: the bundle ships inside the iOS binary, so there is no
 * server render to wait for — the shell paints from local files and only the
 * data crosses the network.
 */
export default function Home() {
  const [boot, setBoot] = useState<Boot | null>(null);
  const [autoRecord, setAutoRecord] = useState(false);

  useEffect(() => {
    // Read once from the URL instead of useSearchParams(): the static export
    // would otherwise demand a Suspense boundary around the whole page.
    const params = new URLSearchParams(window.location.search);
    const wantsRecord = params.get("record") === "1";

    let alive = true;
    (async () => {
      const [entry, goalDefs] = await Promise.all([
        loadTodayEntry(),
        loadGoalDefs(),
      ]);
      if (!alive) return;
      setAutoRecord(wantsRecord);
      setBoot({ entry, goalDefs });
      signalReady();
    })();

    return () => {
      alive = false;
    };
  }, []);

  if (!boot) return <TodaySkeleton />;

  return (
    <TodayClient
      mode="auth"
      initialEntry={boot.entry}
      goalDefs={boot.goalDefs}
      autoRecord={autoRecord}
    />
  );
}

/**
 * Placeholder in the shape of the filled day (title, two snippet lines, metric
 * cards) so the layout does not jump when the entry lands. On a cold launch the
 * splash still covers this; it shows on a returning-to-Today navigation.
 */
function TodaySkeleton() {
  return (
    <>
      <div
        className="mx-auto flex w-full max-w-[440px] flex-1 flex-col"
        style={{ padding: "24px 24px 0", minHeight: 0 }}
        aria-busy="true"
        aria-label="Caricamento"
      >
        <div className="jm-skel" style={{ height: 11, width: 104, marginBottom: 20 }} />
        <div className="jm-skel" style={{ height: 26, width: "84%", marginBottom: 14 }} />
        <div className="jm-skel" style={{ height: 14, width: "96%", marginBottom: 8 }} />
        <div className="jm-skel" style={{ height: 14, width: "58%", marginBottom: 26 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <div className="jm-skel" style={{ flex: 1, height: 62, borderRadius: 14 }} />
          <div className="jm-skel" style={{ flex: 1, height: 62, borderRadius: 14 }} />
          <div className="jm-skel" style={{ flex: 1, height: 62, borderRadius: 14 }} />
        </div>
      </div>
      <TabBar active="today" />
    </>
  );
}
