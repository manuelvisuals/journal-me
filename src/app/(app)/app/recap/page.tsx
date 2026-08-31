"use client";

import { useEffect, useState } from "react";
import { RecapClient } from "@/modules/recap/components/recap-client";
import RecapLoading from "./loading";
import { loadRecaps } from "@/lib/data/recaps";
import { signalReady } from "@/lib/app-ready";
import type { Recap } from "@/lib/types";

export default function RecapPage() {
  const [initialRecaps, setInitialRecaps] = useState<Recap[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const recaps = await loadRecaps("auth");
      if (!alive) return;
      setInitialRecaps(recaps);
      signalReady();
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!initialRecaps) return <RecapLoading />;

  return <RecapClient mode="auth" initialRecaps={initialRecaps} />;
}
