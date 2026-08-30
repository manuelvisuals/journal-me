"use client";

import { TabBar } from "@/components/ui/tab-bar";
import { useT } from "@/lib/i18n";

/**
 * Lo scheletro di Impostazioni: titolo, sottotitolo e tre gruppi di righe.
 * Deve somigliare alla pagina vera, altrimenti il caricamento sembra un
 * salto. Si vede solo alla prima visita a freddo.
 */
function Group({ rows }: { rows: number }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div
        className="jm-skel"
        style={{ height: 10, width: 84, borderRadius: 6, marginBottom: 10 }}
      />
      <div className="jm-skel" style={{ height: rows * 56, borderRadius: 16 }} />
    </div>
  );
}

export default function Loading() {
  const t = useT();
  return (
    <>
      <div
        className="flex flex-1 flex-col"
        style={{
          padding: "0 24px",
          paddingTop: "calc(26px + var(--jm-safe-top))",
          minHeight: 0,
        }}
        aria-busy="true"
        aria-label={t("Caricamento")}
      >
        <div className="jm-skel" style={{ height: 26, width: 190, marginBottom: 10 }} />
        <div className="jm-skel" style={{ height: 13, width: 250, marginBottom: 28 }} />
        <Group rows={1} />
        <Group rows={2} />
        <Group rows={3} />
      </div>
      <TabBar active="settings" />
    </>
  );
}
