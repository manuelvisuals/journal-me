import { TabBar } from "@/components/ui/tab-bar";

/**
 * Altro-specific loading skeleton: title + Recap card + micro-goal chips +
 * account rows. Matches the real layout; shown only on a cold/uncached visit.
 */
export default function Loading() {
  return (
    <>
      <div
        className="flex flex-1 flex-col"
        style={{ padding: "0 24px", paddingTop: "calc(24px + env(safe-area-inset-top, 0px))", minHeight: 0 }}
        aria-busy="true"
        aria-label="Caricamento"
      >
        <div
          className="jm-skel"
          style={{ height: 26, width: 130, marginBottom: 22 }}
        />
        {/* Recap card */}
        <div
          className="jm-skel"
          style={{
            height: 140,
            width: "100%",
            borderRadius: 18,
            marginBottom: 26,
          }}
        />
        {/* Micro-goal section: label + chips + add input */}
        <div
          className="jm-skel"
          style={{ height: 10, width: 90, borderRadius: 6, marginBottom: 14 }}
        />
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 14,
          }}
        >
          {[108, 78, 96, 90, 64].map((w, i) => (
            <div
              key={i}
              className="jm-skel"
              style={{ height: 32, width: w, borderRadius: 999 }}
            />
          ))}
        </div>
        <div
          className="jm-skel"
          style={{
            height: 52,
            width: "100%",
            borderRadius: 14,
            marginBottom: 26,
          }}
        />
        {/* Account rows */}
        <div
          className="jm-skel"
          style={{ height: 10, width: 80, borderRadius: 6, marginBottom: 16 }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 18,
          }}
        >
          <div className="jm-skel" style={{ height: 13, width: 60 }} />
          <div className="jm-skel" style={{ height: 13, width: 120 }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div className="jm-skel" style={{ height: 13, width: 70 }} />
          <div className="jm-skel" style={{ height: 13, width: 46 }} />
        </div>
      </div>
      <TabBar active="settings" />
    </>
  );
}
