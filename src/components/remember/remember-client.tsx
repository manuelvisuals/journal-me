"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { can } from "@/lib/capabilities";
import { TabBar } from "@/components/ui/tab-bar";
import { QuickCapture } from "@/components/remember/quick-capture";
import { RememberItem } from "@/components/remember/remember-item";
import {
  addRemember,
  deleteRemember,
  updateRememberKind,
} from "@/lib/data/remembers";
import type { DataMode } from "@/lib/data/entries";
import type { Remember, RememberKind } from "@/lib/types";

type Props = {
  mode: DataMode;
  initial: Remember[];
};

type FilterKey = "all" | RememberKind;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Tutti" },
  { key: "persona", label: "Persone" },
  { key: "todo", label: "Todo" },
  { key: "nota", label: "Note" },
  { key: "luogo", label: "Luoghi" },
  { key: "idea", label: "Idee" },
];

export function RememberClient({ mode, initial }: Props) {
  const [items, setItems] = useState<Remember[]>(initial);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [error, setError] = useState<string | null>(null);

  // Demo: hydrate from localStorage
  // initial is always populated server-side now.

  const visible =
    filter === "all" ? items : items.filter((r) => r.kind === filter);

  const handleAdd = async (text: string, kind: RememberKind) => {
    setError(null);
    try {
      const r = await addRemember(mode, text, kind);
      setItems((prev) => [r, ...prev]);
      // If the user didn't pick a specific kind (default 'nota'), ask the
      // backend to auto-classify into the right bucket. Runs async — the item
      // appears immediately in 'Note', and re-slots once the AI responds.
      // SOLO dove l'AI esiste: in locale (o in cloud gratis) niente
      // chiamata — l'appunto resta 'nota' e va benissimo (SPEC-v2 §8:
      // mai /api/* in locale).
      if (kind === "nota" && can("aiSummary")) {
        void classifyAndReslot(r.id, text);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore");
    }
  };

  const classifyAndReslot = async (id: string, text: string) => {
    try {
      const resp = await apiFetch("/api/remember/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!resp.ok) return;
      const json = (await resp.json()) as { kind?: RememberKind };
      const newKind = json.kind;
      if (!newKind || newKind === "nota") return;
      await updateRememberKind(mode, id, newKind);
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, kind: newKind } : it)),
      );
    } catch {
      // Classification is best-effort — the note already saved as 'nota'.
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await deleteRemember(mode, id);
      setItems((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore");
    }
  };

  const defaultKind: RememberKind =
    filter === "all" ? "nota" : filter;

  // Group by day band for "all" view; flat list for filtered.
  const groups = filter === "all" ? groupByBand(visible) : null;

  return (
    <main
      className="mx-auto flex w-full max-w-[440px] lg:max-w-none flex-1 flex-col relative"
      style={{ minHeight: "100dvh" }}
    >
      <header className="jm-rem-head">
        {/* "Ricorda", come la tab bar, la rail desktop e la palette. Era
            l'ultimo punto in inglese di una UI tutta italiana. */}
        <h1 className="jm-rem-h">Ricorda</h1>
        <div className="jm-rem-filter">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={filter === f.key ? "f-chip on" : "f-chip"}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      <div className="jm-rem-list">
        {visible.length === 0 ? (
          <div
            style={{
              padding: "40px 24px",
              textAlign: "center",
              fontSize: 13,
              color: "var(--color-ink-faint)",
              fontStyle: "italic",
            }}
          >
            niente da ricordare in questa categoria.
          </div>
        ) : groups ? (
          groups.map((g) => (
            <div key={g.label}>
              <div className="jm-rem-day-header">{g.label}</div>
              {g.items.map((r) => (
                <RememberItem
                  key={r.id}
                  remember={r}
                  onDelete={() => handleDelete(r.id)}
                />
              ))}
            </div>
          ))
        ) : (
          visible.map((r) => (
            <RememberItem
              key={r.id}
              remember={r}
              onDelete={() => handleDelete(r.id)}
            />
          ))
        )}
      </div>

      {error && (
        <div
          role="alert"
          style={{
            position: "absolute",
            bottom: 160,
            left: 24,
            right: 24,
            padding: 10,
            background: "var(--color-surface)",
            border: "1px solid var(--color-danger)",
            borderRadius: 10,
            color: "var(--color-danger)",
            fontSize: 12,
            zIndex: 5,
          }}
        >
          {error}
        </div>
      )}

      <QuickCapture
        mode={mode}
        defaultKind={defaultKind}
        onAdd={handleAdd}
      />

      <TabBar active="remember" />
    </main>
  );
}

type DayBand = { label: string; items: Remember[] };

function groupByBand(items: Remember[]): DayBand[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const bands: Record<string, Remember[]> = {
    Oggi: [],
    Ieri: [],
    "Settimana scorsa": [],
    "Mese scorso": [],
    "Più indietro": [],
  };

  for (const r of items) {
    const created = new Date(r.createdAt);
    created.setHours(0, 0, 0, 0);
    const diff = Math.round(
      (today.getTime() - created.getTime()) / (24 * 60 * 60 * 1000),
    );
    if (diff <= 0) bands.Oggi.push(r);
    else if (diff === 1) bands.Ieri.push(r);
    else if (diff <= 7) bands["Settimana scorsa"].push(r);
    else if (diff <= 31) bands["Mese scorso"].push(r);
    else bands["Più indietro"].push(r);
  }

  return (Object.entries(bands) as [string, Remember[]][])
    .filter(([, list]) => list.length > 0)
    .map(([label, list]) => ({ label, items: list }));
}
