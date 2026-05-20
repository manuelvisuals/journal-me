"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TabBar } from "@/components/ui/tab-bar";
import { GlossarySection } from "@/components/settings/glossary-section";
import { createClient } from "@/lib/supabase/client";
import type { DataMode } from "@/lib/data/entries";

type Props = {
  mode: DataMode;
  email: string | null;
  isAnonymous: boolean;
  initialGlossary: string[];
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
  initialGlossary,
  latestRecap,
}: Props) {
  const router = useRouter();
  const [glossary, setGlossary] = useState<string[]>(initialGlossary);
  const [signingOut, setSigningOut] = useState<boolean>(false);

  const handleLogout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    // Legacy demo cookie cleanup, just in case.
    document.cookie =
      "journalme-demo=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/login");
  };

  return (
    <main
      className="mx-auto flex w-full max-w-[440px] flex-1 flex-col"
      style={{ minHeight: "100dvh" }}
    >
      <header className="jm-altro-head">
        <h1 className="jm-altro-h">Altro</h1>
      </header>

      <div className="flex-1 overflow-y-auto" style={{ padding: "0 0 22px" }}>
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

        <GlossarySection
          mode={mode}
          initial={glossary}
          onChange={setGlossary}
        />

        <section className="jm-set-section">
          <div className="jm-set-section-h">Account</div>
          {email && (
            <div className="jm-set-row">
              <span className="lbl">Email</span>
              <span className="v">{email}</span>
            </div>
          )}
          {isAnonymous && (
            <div className="jm-set-row">
              <span className="lbl">Account</span>
              <span className="v">Ospite (cloud)</span>
            </div>
          )}
          <div className="jm-set-row">
            <span className="lbl">Versione</span>
            <span className="v">0.5.0</span>
          </div>
        </section>

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
      </div>

      <TabBar active="settings" />
    </main>
  );
}
