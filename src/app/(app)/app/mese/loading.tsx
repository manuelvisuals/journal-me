"use client";

import { TabBar } from "@/components/ui/tab-bar";
import { useT } from "@/lib/i18n";

/**
 * Mese-specific loading skeleton. Mirrors the day list (big day number on the
 * left, entry title to the right) rather than the generic avatar+chips layout,
 * so the placeholder matches what actually loads. Shown only on a cold/uncached
 * visit; with the router cache, revisiting Mese is instant and this never flashes.
 */
export default function Loading() {
  const t = useT();
  return (
    <>
      <div
        className="flex flex-1 flex-col"
        style={{ padding: "0 24px", paddingTop: "calc(24px + var(--jm-safe-top))", minHeight: 0 }}
        aria-busy="true"
        aria-label={t("Caricamento")}
      >
        {/* Month title */}
        <div
          className="jm-skel"
          style={{ height: 26, width: 168, marginBottom: 24 }}
        />

        {/* Day rows */}
        {Array.from({ length: 11 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center"
            style={{
              gap: 16,
              padding: "16px 0",
              borderBottom: "1px solid var(--color-line)",
              opacity: 1 - i * 0.06,
            }}
          >
            <div
              className="flex flex-col items-center"
              style={{ width: 34, gap: 6, flexShrink: 0 }}
            >
              <div className="jm-skel" style={{ height: 22, width: 24 }} />
              <div className="jm-skel" style={{ height: 8, width: 20 }} />
            </div>
            <div
              className="jm-skel"
              style={{ height: 13, width: `${42 + (i % 4) * 11}%` }}
            />
          </div>
        ))}
      </div>
      <TabBar active="month" />
    </>
  );
}
