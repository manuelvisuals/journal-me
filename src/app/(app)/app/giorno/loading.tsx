/**
 * Route-level loading UI for the Day detail. Shown automatically by the App
 * Router while the server component fetches the day's entry, so the tap from
 * Mese lands on a premium skeleton instead of a blank/frozen screen.
 */
export default function DayLoading() {
  return (
    <main
      className="jm-screen mx-auto flex w-full max-w-[440px] lg:max-w-none flex-1 flex-col"
      aria-busy="true"
    >
      <header className="jm-day-head">
        <span className="jm-skel" style={{ width: 28, height: 28, borderRadius: 8 }} />
        <span className="jm-skel" style={{ width: 140, height: 14, borderRadius: 6 }} />
        <span style={{ width: 28 }} />
      </header>

      <div style={{ padding: "8px 24px 0" }}>
        <span
          className="jm-skel"
          style={{ display: "block", width: "82%", height: 26, borderRadius: 8, margin: "8px 0 12px" }}
        />
        <span className="jm-skel" style={{ display: "block", width: "96%", height: 14, borderRadius: 6, marginBottom: 7 }} />
        <span className="jm-skel" style={{ display: "block", width: "55%", height: 14, borderRadius: 6, marginBottom: 22 }} />

        <span className="jm-skel" style={{ display: "block", width: "100%", height: 60, borderRadius: 12, marginBottom: 12 }} />
        <span className="jm-skel" style={{ display: "block", width: "100%", height: 60, borderRadius: 12, marginBottom: 22 }} />

        <div style={{ display: "flex", gap: 8 }}>
          <span className="jm-skel" style={{ flex: 1, height: 62, borderRadius: 14 }} />
          <span className="jm-skel" style={{ flex: 1, height: 62, borderRadius: 14 }} />
          <span className="jm-skel" style={{ flex: 1, height: 62, borderRadius: 14 }} />
        </div>
      </div>
    </main>
  );
}
