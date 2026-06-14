import { TabBar } from "@/components/ui/tab-bar";

/**
 * Recap-specific loading skeleton: title + period segmented control + the
 * generate card. Matches the real layout; shown only on a cold/uncached visit.
 */
export default function Loading() {
  return (
    <>
      <div
        className="flex flex-1 flex-col"
        style={{ padding: "24px 24px 0", minHeight: 0 }}
        aria-busy="true"
        aria-label="Caricamento"
      >
        <div
          className="jm-skel"
          style={{ height: 26, width: 140, marginBottom: 22 }}
        />
        {/* Mensili / Semestrali / Annuali segmented control */}
        <div
          className="jm-skel"
          style={{
            height: 44,
            width: "100%",
            borderRadius: 999,
            marginBottom: 24,
          }}
        />
        {/* Generate card */}
        <div
          className="jm-skel"
          style={{ height: 150, width: "100%", borderRadius: 18 }}
        />
      </div>
      <TabBar active="settings" />
    </>
  );
}
