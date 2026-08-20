"use client";

/**
 * Impostazioni (ex "Altro") — mockup design/mockups/impostazioni.html §03/§04,
 * approvato da Manuel il 20 agosto 2026.
 *
 * Cosa e cambiato e perche. "Altro" era un cassetto: banner, card Recap,
 * temi, obiettivi a chip, dati, account e logout tutti aperti nella stessa
 * colonna, uno sotto l'altro, senza gerarchia. Adesso e un elenco a gruppi
 * dove ogni riga dice la cosa E il suo valore attuale, e cio che ha bisogno
 * di spazio (obiettivi, temi, "dove sono le mie giornate") si apre in un
 * pannello suo.
 *
 * Su desktop l'identita passa nella rail destra: chi sei e contesto, non
 * un'impostazione, e la colonna centrale resta solo impostazioni. La card
 * Recap sparisce da qui su desktop perche Recap e gia nella rail sinistra;
 * sul telefono resta, perche li la tab bar non ha uno slot per Recap.
 *
 * DUE RIGHE DEL MOCKUP NON SONO QUI, di proposito:
 *  - "Promemoria della sera": l'app non ha nessun sistema di notifiche.
 *    Una riga che mostra "21:30" senza che arrivi mai niente sarebbe una
 *    bugia dell'interfaccia, come il "primo mese incluso" tolto stamattina.
 *  - "Lingua": arriva col bilingue vero (task 27). Un selettore che non
 *    traduce niente e la stessa bugia.
 * Tutte e due tornano nel momento in cui esiste la cosa che promettono.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { TabBar } from "@/components/ui/tab-bar";
import { RailRight } from "@/components/desktop/rail-right";
import { PanelHead, SetGroup, SetRow } from "@/components/settings/rows";
import { GoalsPanel, ThemePanel, WherePanel } from "@/components/settings/panels";
import { BackupBanner } from "@/components/settings/data-section";
import {
  eraseLocalData,
  exportBackup,
  importBackup,
  importReportText,
} from "@/lib/backup/backup";
import { getStore, useStorageMode } from "@/lib/data/store";
import { APP_VERSION } from "@/lib/data/store/types";
import { formatNumber } from "@/lib/format";
import { clearPlanCache, usePlan } from "@/lib/plan";
import { openPremiumWall } from "@/components/premium-wall";
import { PREMIUM_PRICE_LABEL } from "@/lib/pricing";
import { THEMES } from "@/themes";
import { setAppearance, useAppearance, useThemeId } from "@/themes/runtime";
import type { Appearance } from "@/themes";
import type { DataMode } from "@/lib/data/entries";
import type { GoalDef } from "@/lib/types";

type Props = {
  mode: DataMode;
  email: string | null;
  isAnonymous: boolean;
  initialGoals: GoalDef[];
  latestRecap: { title: string; periodLabel: string } | null;
};

type Panel = "root" | "goals" | "theme" | "where";

const PANEL_TITLES: Record<Exclude<Panel, "root">, string> = {
  goals: "Obiettivi",
  theme: "Tema",
  where: "Dove sono le mie giornate",
};

const APPEARANCE_OPTIONS: { value: Appearance; label: string; short: string }[] = [
  { value: "light", label: "Chiaro", short: "Ch" },
  { value: "dark", label: "Scuro", short: "Sc" },
  { value: "system", label: "Sistema", short: "Sist" },
];

type Busy = "idle" | "export" | "import" | "erase";

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
  const plan = usePlan();
  const themeId = useThemeId();
  const appearance = useAppearance();

  const [panel, setPanel] = useState<Panel>("root");
  const [goals, setGoals] = useState<GoalDef[]>(initialGoals);
  const [entryCount, setEntryCount] = useState<number | null>(null);
  const [busy, setBusy] = useState<Busy>("idle");
  const [note, setNote] = useState<string | null>(null);
  const [noteErr, setNoteErr] = useState<boolean>(false);
  const [eraseArmed, setEraseArmed] = useState<boolean>(false);
  const [signingOut, setSigningOut] = useState<boolean>(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Il numero di giornate serve alla riga "Esporta un backup": un backup di
  // cui non sai la dimensione non lo fa nessuno. Vale in tutte e due le
  // modalita — countEntries e nel contratto dello store.
  useEffect(() => {
    if (storageMode === "resolving") return;
    let alive = true;
    void getStore()
      .countEntries()
      .then((n) => {
        if (alive) setEntryCount(n);
      })
      .catch(() => {
        // Nessun conteggio: la riga resta senza valore, non si inventa.
      });
    return () => {
      alive = false;
    };
  }, [storageMode, busy]);

  const say = (text: string, err = false) => {
    setNote(text);
    setNoteErr(err);
  };

  const handleExport = async () => {
    if (busy !== "idle") return;
    setBusy("export");
    say("");
    try {
      const n = await exportBackup();
      say(
        `Backup esportato: ${formatNumber(n)} ${n === 1 ? "giornata" : "giornate"}. Mettilo dove tieni le cose che non vuoi perdere.`,
      );
    } catch (err) {
      say(err instanceof Error ? err.message : "Export non riuscito.", true);
    } finally {
      setBusy("idle");
    }
  };

  const handleImportFile = async (file: File | null) => {
    if (!file || busy !== "idle") return;
    setBusy("import");
    say("");
    try {
      say(importReportText(await importBackup(file)));
    } catch (err) {
      say(err instanceof Error ? err.message : "Import non riuscito.", true);
    } finally {
      setBusy("idle");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleErase = async () => {
    if (busy !== "idle") return;
    if (!eraseArmed) {
      setEraseArmed(true);
      return;
    }
    setBusy("erase");
    say("");
    try {
      await eraseLocalData();
      setEraseArmed(false);
      say("Fatto. Questo dispositivo non contiene piu nessuna giornata.");
    } catch (err) {
      say(
        err instanceof Error ? err.message : "Cancellazione non riuscita.",
        true,
      );
    } finally {
      setBusy("idle");
    }
  };

  const handleLogout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    // Solo cloud: in locale questo bottone non esiste (niente account).
    const { createClient } = await import("@/lib/supabase/client");
    await createClient().auth.signOut();
    // Il piano e cache in localStorage ("jm.plan") ed e OTTIMISTA: senza
    // questa riga restava "premium" addosso al browser dopo il logout, e
    // il prossimo account gratis vedeva la UI premium finche il refresh in
    // background non lo smentiva (con un 402 a sorpresa alla prima azione,
    // proprio cio che SPEC-v2 §3.3 vieta).
    clearPlanCache();
    document.cookie =
      "journalme-demo=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/login");
  };

  const themeName = THEMES.find((t) => t.id === themeId)?.name ?? "";
  const accountName = isLocal
    ? "Questo dispositivo"
    : (email?.split("@")[0] ?? "Ospite");

  return (
    <main
      className="mx-auto flex w-full max-w-[440px] lg:max-w-none flex-1 flex-col"
      style={{ minHeight: "100dvh" }}
    >
      {panel === "root" ? (
        <header className="jm-col-head">
          <h1 className="jm-st-h1">Impostazioni</h1>
          <p className="jm-st-sub">Come funziona e come si vede il tuo diario.</p>
        </header>
      ) : (
        <PanelHead title={PANEL_TITLES[panel]} onBack={() => setPanel("root")} />
      )}

      <div className="jm-st-scroll">
        {panel === "goals" && (
          <GoalsPanel mode={mode} goals={goals} setGoals={setGoals} />
        )}
        {panel === "theme" && <ThemePanel />}
        {panel === "where" && <WherePanel />}

        {panel === "root" && (
          <>
            {/* Solo in locale, quando l'ultimo backup e vecchio: il dovere di
                dire che il diario esiste in un posto solo (SPEC-v2 §4.4). */}
            <BackupBanner />

            {/* Recap solo sul telefono: su desktop e gia nella rail sinistra. */}
            <Link
              href="/recap"
              className="jm-st-recap jm-st-phoneonly"
              aria-label="Apri Recap"
            >
              <span className="meta">Recap</span>
              <span className="title">Le tue giornate, raccontate.</span>
              <span className="sub">
                Mensili, semestrali, annuali. Una prosa narrativa che rilegge i
                tuoi mesi senza giudizio.
              </span>
              <span className="last">
                {latestRecap
                  ? `${latestRecap.periodLabel} . ${latestRecap.title}`
                  : "Nessun recap generato ancora"}
              </span>
            </Link>

            <SetGroup label="Il diario">
              <SetRow
                title="Obiettivi"
                desc="Le caselle che accendi ogni giorno."
                value={`${formatNumber(goals.length)} ${goals.length === 1 ? "attivo" : "attivi"}`}
                onClick={() => setPanel("goals")}
              />
            </SetGroup>

            <SetGroup label="Aspetto">
              <SetRow
                title="Tema"
                desc={`${formatNumber(THEMES.length)} temi inclusi, tutti in chiaro e in scuro.`}
                value={themeName}
                onClick={() => setPanel("theme")}
              />
              <SetRow
                title="Chiaro o scuro"
                desc="Vale per qualsiasi tema. Con Sistema segue il dispositivo."
                control={
                  <span
                    className="jm-st-seg"
                    role="radiogroup"
                    aria-label="Chiaro o scuro"
                  >
                    {APPEARANCE_OPTIONS.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        role="radio"
                        aria-checked={appearance === o.value}
                        aria-label={o.label}
                        className={appearance === o.value ? "on" : undefined}
                        onClick={() => setAppearance(o.value)}
                      >
                        <span className="lg">{o.label}</span>
                        <span className="sm">{o.short}</span>
                      </button>
                    ))}
                  </span>
                }
              />
            </SetGroup>

            <SetGroup label="I tuoi dati">
              <SetRow
                title="Esporta un backup"
                desc="Un solo file con tutto: giornate, obiettivi, metriche, Ricorda."
                value={
                  busy === "export"
                    ? "esporto..."
                    : entryCount == null
                      ? undefined
                      : `${formatNumber(entryCount)} ${entryCount === 1 ? "giornata" : "giornate"}`
                }
                onClick={() => void handleExport()}
                disabled={busy !== "idle"}
              />
              <SetRow
                title="Importa un backup"
                desc="Aggiunge le giornate che mancano. Quelle che hai gia non le tocca."
                value={busy === "import" ? "importo..." : undefined}
                onClick={() => fileRef.current?.click()}
                disabled={busy !== "idle"}
              />
              <SetRow
                title="Dove sono le mie giornate"
                desc="Cosa esce da questo dispositivo, e cosa no."
                onClick={() => setPanel("where")}
              />
            </SetGroup>

            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => void handleImportFile(e.target.files?.[0] ?? null)}
            />

            {note && (
              <div className={`jm-st-note${noteErr ? " err" : ""}`} role="status">
                {note}
              </div>
            )}

            {/* L'account sul telefono: su desktop vive nella rail destra. */}
            <div className="jm-st-phoneonly">
              <SetGroup label="Account">
                {isLocal ? (
                  <SetRow title="Dove" value="Solo su questo dispositivo" />
                ) : (
                  <>
                    {email && <SetRow title="Email" value={email} />}
                    {isAnonymous && <SetRow title="Account" value="Ospite (cloud)" />}
                    <SetRow
                      title="Piano"
                      value={plan === "premium" ? "Premium" : "Gratis"}
                    />
                  </>
                )}
                <SetRow title="Versione" value={APP_VERSION} />
                {!isLocal && (
                  <SetRow
                    title="Esci dall'account"
                    danger
                    chevron={false}
                    value={signingOut ? "esco..." : undefined}
                    onClick={() => void handleLogout()}
                    disabled={signingOut}
                  />
                )}
              </SetGroup>
            </div>

            {isLocal && (
              <SetGroup label="Zona pericolosa">
                <SetRow
                  title="Cancella tutte le giornate"
                  desc={
                    eraseArmed
                      ? "Sicuro? Le elimina da questo dispositivo. Non si torna indietro."
                      : "Da questo dispositivo. Non si torna indietro."
                  }
                  value={
                    busy === "erase"
                      ? "cancello..."
                      : eraseArmed
                        ? "si, cancella"
                        : undefined
                  }
                  danger
                  chevron={!eraseArmed}
                  onClick={() => void handleErase()}
                  disabled={busy !== "idle"}
                />
              </SetGroup>
            )}
          </>
        )}
      </div>

      {/* Rail destra: l'identita, non le impostazioni. Sotto lg non esiste. */}
      <RailRight>
        <div className="jm-st-acct">
          {/* L'iniziale viene dal NOME mostrato, non dall'email: in locale
              l'email non esiste e l'avatar diventava un punto interrogativo
              accanto a "Questo dispositivo". */}
          <div className="jm-st-av" aria-hidden="true">
            {accountName.slice(0, 1).toUpperCase()}
          </div>
          <div className="jm-st-nm">{accountName}</div>
          {!isLocal && email && <div className="jm-st-em">{email}</div>}
          {isLocal ? (
            <span className="jm-st-pill">Locale</span>
          ) : (
            <span className="jm-st-pill">
              {plan === "premium" ? "Premium" : "Gratis"}
            </span>
          )}
        </div>

        <div className="jm-st-rr">
          <div className="jm-railr-l">Account</div>
          {isLocal ? (
            <div className="jm-st-rrow">
              <span className="k">Dove</span>
              <span className="v">Solo su questo dispositivo</span>
            </div>
          ) : (
            <div className="jm-st-rrow">
              <span className="k">Piano</span>
              <span className="v">
                {plan === "premium" ? `Premium . ${PREMIUM_PRICE_LABEL}` : "Gratis"}
              </span>
            </div>
          )}
          <div className="jm-st-rrow">
            <span className="k">Versione</span>
            <span className="v">{APP_VERSION}</span>
          </div>

          {!isLocal && plan !== "premium" && (
            <button
              type="button"
              className="jm-st-out"
              onClick={() => openPremiumWall("aiSummary")}
            >
              Passa a Premium
            </button>
          )}
          {!isLocal && (
            <button
              type="button"
              className="jm-st-out danger"
              onClick={() => void handleLogout()}
              disabled={signingOut}
            >
              {signingOut ? "Esco..." : "Esci dall'account"}
            </button>
          )}
        </div>
      </RailRight>

      <TabBar active="settings" />
    </main>
  );
}
