"use client";

import { useT } from "@/lib/i18n";

/**
 * Generic loading skeleton shown while a route's data is being fetched on its
 * first (uncached) visit. With the router cache, revisits are instant and this
 * never flashes — so the user sees either an instant screen or a clearly
 * animated "loading" placeholder, never a frozen one.
 *
 * E comunque INVISIBILE per i primi 400 ms (classe jm-skel-attesa,
 * base.css): quando la cache risponde in fretta lo scheletro non deve
 * balenare (2 settembre 2026, richiesta di Manuel).
 */
export function PageSkeleton() {
  const t = useT();
  return (
    <div
      className="jm-skel-attesa flex flex-1 flex-col"
      style={{ padding: "0 24px", paddingTop: "calc(24px + var(--jm-safe-top))", minHeight: 0 }}
      aria-busy="true"
      aria-label={t("Caricamento")}
    >
      {/* Title */}
      <div
        className="jm-skel"
        style={{ height: 28, width: 150, marginBottom: 22 }}
      />

      {/* Filter chips row */}
      <div className="flex" style={{ gap: 8, marginBottom: 24 }}>
        {[64, 78, 58, 70].map((w, i) => (
          <div
            key={i}
            className="jm-skel"
            style={{ height: 30, width: w, borderRadius: 999, flexShrink: 0 }}
          />
        ))}
      </div>

      {/* List rows */}
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center"
          style={{
            gap: 14,
            padding: "14px 0",
            borderBottom: "1px solid var(--color-line)",
            opacity: 1 - i * 0.08,
          }}
        >
          <div
            className="jm-skel"
            style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0 }}
          />
          <div className="flex-1">
            <div
              className="jm-skel"
              style={{ height: 13, width: "42%", marginBottom: 9 }}
            />
            <div className="jm-skel" style={{ height: 11, width: "68%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}
