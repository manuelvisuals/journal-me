"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TabBar } from "@/components/ui/tab-bar";
import { GoalsSection } from "@/components/settings/goals-section";
import { AppearanceSection } from "@/components/settings/appearance-section";
import { BackupBanner, DataSection } from "@/components/settings/data-section";
import { useStorageMode } from "@/lib/data/store";
import { APP_VERSION } from "@/lib/data/store/types";
import type { DataMode } from "@/lib/data/entries";
import type { GoalDef } from "@/lib/types";

type Props = {
  mode: DataMode;
  email: string | null;
  isAnonymous: boolean;
  initialGoals: GoalDef[];
  /** Latest recap across periods — shown as a teaser inside the Recap card. */
  latestRecap: {
    title: string;
    periodLabel: string;
  } | null;
};

export function SettingsClient({
  mode,
  email,
  isAnonymous,
  initialGoals,
  latestRecap,
}: Props) {
  const router = useRouter();
  const storageMode = useStorageMode();
  const isLocal = storageMode === "local";
  const [signingOut, setSigningOut] = useState<boolean>(false);

  const handleLogout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    // Solo cloud: in locale questo bottone non esiste (niente account).
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    // Legacy demo cookie cleanup, just in case.
    document.cookie =
      "journalme-demo=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/login");
  };

  return (
    <main
      className="mx-auto flex w-full max-w-[440px] lg:max-w-[1000px] flex-1 flex-col"
      style={{ minHeight: "100dvh" }}
    >
      <header className="jm-altro-head">
        <h1 className="jm-altro-h">Altro</h1>
      </header>

      <div className="flex-1 overflow-y-auto" style={{ padding: "0 0 22px" }}>
        {/* Solo in locale, quando l'ultimo backup e vecchio: il dovere di
            dire che il diario esiste in un posto solo (SPEC-v2 §4.4). */}
        <BackupBanner />
        {/* Recap card — premium editorial entry point. Opens /recap. */}
        <Link href="/recap" className="jm-recap-card" aria-label="Apri Recap">
          <div className="meta">Recap</div>
          <div className="title">Le tue giornate, raccontate.</div>
          <div className="sub">
            Mensili, semestrali, annuali. Una prosa narrativa che rilegge i
            tuoi mesi senza giudizio.
          </div>
          <div className="last">
            <span className="lbl">Ultimo</span>
            <span className="name">
              {latestRecap
                ? `${latestRecap.periodLabel} . ${latestRecap.title}`
                : "Nessun recap generato ancora"}
            </span>
            <span className="chev" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="12"
                height="12"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </span>
          </div>
        </Link>

        <AppearanceSection />

        <GoalsSection mode={mode} initial={initialGoals} />

        <DataSection />

        <section className="jm-set-section">
          <div className="jm-set-section-h">Account</div>
          {isLocal && (
            <div className="jm-set-row">
              <span className="lbl">Dove</span>
              <span className="v">Solo su questo dispositivo</span>
            </div>
          )}
          {!isLocal && email && (
            <div className="jm-set-row">
              <span className="lbl">Email</span>
              <span className="v">{email}</span>
            </div>
          )}
          {!isLocal && isAnonymous && (
            <div className="jm-set-row">
              <span className="lbl">Account</span>
              <span className="v">Ospite (cloud)</span>
            </div>
          )}
          <div className="jm-set-row">
            <span className="lbl">Versione</span>
            <span className="v">{APP_VERSION}</span>
          </div>
        </section>

        {!isLocal && (
          <div className="jm-logout-wrap">
            <button
              type="button"
              onClick={handleLogout}
              disabled={signingOut}
              className="jm-logout-btn"
            >
              {signingOut ? "Logout in corso..." : "Esci dall'account"}
            </button>
          </div>
        )}
      </div>

      <TabBar active="settings" />
    </main>
  );
}
