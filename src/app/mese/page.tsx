"use client";

import { useEffect, useState } from "react";
import { MeseClient } from "@/modules/mese/components/mese-client";
import MeseLoading from "./loading";
import { loadMonthEntries } from "@/lib/data/entries";
import { nowAppParts } from "@/lib/format";
import { signalReady } from "@/lib/app-ready";
import type { Entry } from "@/lib/types";

type Month = { year: number; month: number; entries: Entry[] };

export default function MesePage() {
  const [initialMonth, setInitialMonth] = useState<Month | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      // "Today" only ever comes from nowAppParts() (Europe/Rome). Raw
      // new Date().getMonth() would put the app a day out around midnight.
      const { year, month } = nowAppParts();
      const entries = await loadMonthEntries("auth", year, month);
      if (!alive) return;
      setInitialMonth({ year, month, entries });
      signalReady();
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!initialMonth) return <MeseLoading />;

  return <MeseClient mode="auth" initialMonth={initialMonth} />;
}
