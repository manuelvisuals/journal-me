"use client";

import { useEffect, useState } from "react";
import { RememberClient } from "@/modules/ricorda/components/remember-client";
import RememberLoading from "./loading";
import { loadRemembers } from "@/lib/data/remembers";
import { signalReady } from "@/lib/app-ready";
import type { Remember } from "@/lib/types";

export default function RememberPage() {
  const [initial, setInitial] = useState<Remember[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const items = await loadRemembers("auth");
      if (!alive) return;
      setInitial(items);
      signalReady();
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!initial) return <RememberLoading />;

  return <RememberClient mode="auth" initial={initial} />;
}
