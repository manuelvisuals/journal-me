"use client";

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
};

export function SettingsClient({
  mode,
  email,
  isAnonymous,
  initialGlossary,
}: Props) {
  const router = useRouter();
  const [glossary, setGlossary] = useState<string[]>(initialGlossary);
  const [signingOut, setSigningOut] = useState<boolean>(false);

  const handleBack = () => {
    router.back();
  };

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
      <header className="jm-set-head">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Indietro"
          className="jm-set-back"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            width="16"
            height="16"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="jm-set-title">Impostazioni</div>
      </header>

      <div className="flex-1 overflow-y-auto" style={{ padding: "18px 0 22px" }}>
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
          <button
            type="button"
            onClick={handleLogout}
            disabled={signingOut}
            className="jm-set-row action"
            style={{
              background: "transparent",
              border: "none",
              width: "100%",
              fontFamily: "inherit",
              padding: "14px 0",
              cursor: signingOut ? "not-allowed" : "pointer",
            }}
          >
            <span className="lbl">{signingOut ? "Logout in corso..." : "Logout"}</span>
            <span className="v">&rsaquo;</span>
          </button>
        </section>

        <section className="jm-set-section">
          <div className="jm-set-section-h">Info</div>
          <div className="jm-set-row">
            <span className="lbl">Versione</span>
            <span className="v">0.5.0</span>
          </div>
        </section>
      </div>

      <TabBar active="settings" />
    </main>
  );
}
