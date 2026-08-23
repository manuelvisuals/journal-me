"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DayClient } from "@/modules/oggi/components/day-client";
import DayLoading from "./loading";
import { loadEntryForDate } from "@/lib/data/entries";
import { signalReady } from "@/lib/app-ready";
import type { Entry } from "@/lib/types";

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

type Boot = { date: string; entry: Entry | null };

/**
 * Day detail. Was `/giorno/[date]`; a dynamic segment cannot be prerendered in
 * a static export without listing every possible day up front, so the date
 * travels as `?d=YYYY-MM-DD` and the page reads it in the app.
 */
export default function DayPage() {
  const router = useRouter();
  const [boot, setBoot] = useState<Boot | null>(null);

  useEffect(() => {
    const date = new URLSearchParams(window.location.search).get("d") ?? "";
    if (!ISO_RE.test(date)) {
      router.replace("/mese");
      return;
    }

    let alive = true;
    (async () => {
      const entry = await loadEntryForDate("auth", date);
      if (!alive) return;
      setBoot({ date, entry });
      signalReady();
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  if (!boot) return <DayLoading />;

  return <DayClient mode="auth" date={boot.date} initialEntry={boot.entry} />;
}
