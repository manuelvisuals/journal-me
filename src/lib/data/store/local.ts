"use client";

/**
 * LocalStore: la versione gratis, tutto sul dispositivo (SPEC-v2 §2.4).
 *
 * IndexedDB via `idb` — non localStorage: i transcript sono testo lungo e il
 * limite dei 5 MB si raggiunge in meno di due anni di diario. Database
 * `journalme`, versione 1. Gli id si generano con crypto.randomUUID().
 *
 * Regola che tiene in piedi tutto: in modalita locale l'app non fa NEMMENO
 * UNA richiesta di rete. Questo modulo non importa niente che parli col
 * mondo: niente supabase, niente apiFetch. Se un metodo qui dentro dovesse
 * mai fare rete, la promessa della schermata di scelta diventa una bugia.
 *
 * Micro-goal: su cloud li semina un trigger Postgres su auth.users; qui li
 * semina la creazione del database — la STESSA lista, da
 * default-goals.ts, solo alla creazione, mai come fallback a runtime
 * (HANDOVER §7).
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { todayISO } from "@/lib/format";
import type {
  AreaSummary,
  Entry,
  EntryMetrics,
  GoalDef,
  Recap,
  Remember,
  RememberKind,
} from "@/lib/types";
import { DEFAULT_GOAL_LABELS } from "./default-goals";
import {
  APP_VERSION,
  BACKUP_FORMAT,
  BACKUP_VERSION,
  type AIFields,
  type BackupFile,
  type ImportReport,
  type JournalStore,
  type StorageMode,
} from "./types";

/* ----------------- schema ----------------- */

type LocalEntryRecord = {
  id: string;
  entryDate: string;
  transcript: string;
  headline: string | null;
  snippet: string | null;
  areas: AreaSummary[];
  metrics: EntryMetrics;
  /** Le etichette accese; i GoalDot completi si costruiscono in lettura. */
  goalsOn: string[];
  people: string[];
  durationSeconds: number;
  createdAt: string;
};

type LocalGoalRecord = GoalDef & { position: number; createdAt: string };

export type DraftRecord = { entryDate: string; text: string; updatedAt: string };

type MetaRecord = { key: string; value: unknown };

interface JournalDB extends DBSchema {
  entries: { key: string; value: LocalEntryRecord };
  goals: { key: string; value: LocalGoalRecord };
  remembers: {
    key: string;
    value: Remember;
    indexes: { kind: string };
  };
  recaps: { key: string; value: Recap };
  drafts: { key: string; value: DraftRecord };
  meta: { key: string; value: MetaRecord };
}

const DB_NAME = "journalme";
const DB_VERSION = 1;

function uuid(): string {
  return crypto.randomUUID();
}

/* ----------------- store ----------------- */

export class LocalStore implements JournalStore {
  readonly mode: StorageMode = "local";

  private dbPromise: Promise<IDBPDatabase<JournalDB>> | null = null;

  private db(): Promise<IDBPDatabase<JournalDB>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<JournalDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          const entries = db.createObjectStore("entries", {
            keyPath: "entryDate",
          });
          void entries;
          db.createObjectStore("goals", { keyPath: "id" });
          const remembers = db.createObjectStore("remembers", {
            keyPath: "id",
          });
          remembers.createIndex("kind", "kind");
          db.createObjectStore("recaps", { keyPath: "id" });
          db.createObjectStore("drafts", { keyPath: "entryDate" });
          db.createObjectStore("meta", { keyPath: "key" });
        },
      }).then(async (db) => {
        // Seed dei goal di default SOLO alla creazione: se meta.schemaVersion
        // esiste, il database non e nuovo e non si tocca niente.
        const existing = await db.get("meta", "schemaVersion");
        if (!existing) {
          const tx = db.transaction(["goals", "meta"], "readwrite");
          const now = new Date().toISOString();
          let position = 0;
          for (const label of DEFAULT_GOAL_LABELS) {
            await tx.objectStore("goals").put({
              id: uuid(),
              label,
              isAiSuggested: false,
              position: position++,
              createdAt: now,
            });
          }
          await tx
            .objectStore("meta")
            .put({ key: "schemaVersion", value: DB_VERSION });
          await tx.done;
        }
        return db;
      });
    }
    return this.dbPromise;
  }

  /* ----------------- meta ----------------- */

  async getMeta(key: string): Promise<unknown> {
    const db = await this.db();
    return (await db.get("meta", key))?.value;
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    const db = await this.db();
    await db.put("meta", { key, value });
  }

  /**
   * Da chiamare UNA volta, subito dopo che l'utente ha scelto la modalita
   * locale (dopo un gesto, o il browser nega in silenzio — SPEC-v2 §2.5).
   * L'esito finisce in meta.
   */
  async requestPersistence(): Promise<boolean> {
    let granted = false;
    try {
      if (typeof navigator !== "undefined" && navigator.storage?.persist) {
        granted = await navigator.storage.persist();
      }
    } catch {
      granted = false;
    }
    await this.setMeta("storagePersisted", granted);
    return granted;
  }

  /**
   * Svuota TUTTI gli object store (giornate, obiettivi, Ricorda, recap,
   * bozze, meta). Non e recuperabile: chi la chiama deve aver gia chiesto
   * conferma due volte. Il database resta e i goal di default vengono
   * riseminati, cosi l'app riparte pulita e coerente.
   */
  async eraseEverything(): Promise<void> {
    const db = await this.db();
    const stores = [
      "entries",
      "goals",
      "remembers",
      "recaps",
      "drafts",
      "meta",
    ] as const;
    const tx = db.transaction(stores, "readwrite");
    for (const s of stores) {
      await tx.objectStore(s).clear();
    }
    await tx.done;
    // Riparti come un database appena creato: seed goal + schemaVersion.
    const tx2 = db.transaction(["goals", "meta"], "readwrite");
    const now = new Date().toISOString();
    let position = 0;
    for (const label of DEFAULT_GOAL_LABELS) {
      await tx2.objectStore("goals").put({
        id: uuid(),
        label,
        isAiSuggested: false,
        position: position++,
        createdAt: now,
      });
    }
    await tx2.objectStore("meta").put({ key: "schemaVersion", value: DB_VERSION });
    await tx2.done;
  }

  /* ----------------- drafts (SPEC-v2 §6) -----------------
   * Non fanno parte di JournalStore: la bozza e SEMPRE locale, anche per
   * gli utenti cloud (autosave dell'editor, PR 7). Vive qui perche lo
   * schema del database e uno solo e l'upgrade non va duplicato. */

  async getDraft(entryDate: string): Promise<DraftRecord | null> {
    const db = await this.db();
    return (await db.get("drafts", entryDate)) ?? null;
  }

  async putDraft(entryDate: string, text: string): Promise<void> {
    const db = await this.db();
    await db.put("drafts", {
      entryDate,
      text,
      updatedAt: new Date().toISOString(),
    });
  }

  async deleteDraft(entryDate: string): Promise<void> {
    const db = await this.db();
    await db.delete("drafts", entryDate);
  }

  /* ----------------- entries ----------------- */

  private async recordToEntry(rec: LocalEntryRecord): Promise<Entry> {
    const defs = await this.loadGoalDefs();
    return this.recordToEntryWith(rec, defs);
  }

  private recordToEntryWith(rec: LocalEntryRecord, defs: GoalDef[]): Entry {
    const on = new Set(rec.goalsOn.map((s) => s.toLowerCase()));
    return {
      id: rec.id,
      entryDate: rec.entryDate,
      transcript: rec.transcript,
      durationSeconds: rec.durationSeconds,
      headline: rec.headline,
      snippet: rec.snippet,
      areas: rec.areas,
      metrics: rec.metrics,
      goals: defs.map((d) => ({
        id: d.id,
        label: d.label,
        on: on.has(d.label.toLowerCase()),
      })),
      people: rec.people,
      createdAt: rec.createdAt,
    };
  }

  private blankRecord(dateISO: string): LocalEntryRecord {
    return {
      id: uuid(),
      entryDate: dateISO,
      transcript: "",
      headline: null,
      snippet: null,
      areas: [],
      metrics: { weightKg: null, sleepHours: null, mood: null },
      goalsOn: [],
      people: [],
      durationSeconds: 0,
      createdAt: new Date().toISOString(),
    };
  }

  async loadTodayEntry(): Promise<Entry | null> {
    return this.loadEntryForDate(todayISO());
  }

  async loadEntryForDate(dateISO: string): Promise<Entry | null> {
    const db = await this.db();
    const rec = await db.get("entries", dateISO);
    return rec ? this.recordToEntry(rec) : null;
  }

  async loadMonthEntries(year: number, month: number): Promise<Entry[]> {
    const db = await this.db();
    const m = String(month).padStart(2, "0");
    // Le date ISO si ordinano lessicograficamente: basta un bound sul keyPath.
    const range = IDBKeyRange.bound(`${year}-${m}-01`, `${year}-${m}-31`);
    const recs = await db.getAll("entries", range);
    const defs = await this.loadGoalDefs();
    return recs
      .map((r) => this.recordToEntryWith(r, defs))
      .sort((a, b) => (a.entryDate < b.entryDate ? 1 : -1));
  }

  async countEntries(): Promise<number> {
    const db = await this.db();
    return db.count("entries");
  }

  async deleteEntry(dateISO: string): Promise<void> {
    const db = await this.db();
    await db.delete("entries", dateISO);
  }

  async saveProcessedEntry(
    dateISO: string,
    transcript: string,
    ai: AIFields,
    durationSeconds: number,
  ): Promise<Entry> {
    const db = await this.db();
    const existing = await db.get("entries", dateISO);
    const rec: LocalEntryRecord = {
      ...(existing ?? this.blankRecord(dateISO)),
      transcript,
      headline: ai.headline,
      snippet: ai.snippet,
      areas: ai.areas,
      durationSeconds,
    };
    await db.put("entries", rec);
    return this.recordToEntry(rec);
  }

  async updateEntryTranscript(dateISO: string, text: string): Promise<Entry> {
    const db = await this.db();
    const existing = await db.get("entries", dateISO);
    const rec: LocalEntryRecord = {
      ...(existing ?? this.blankRecord(dateISO)),
      transcript: text,
    };
    await db.put("entries", rec);
    return this.recordToEntry(rec);
  }

  async updateMetric(
    dateISO: string,
    patch: Partial<EntryMetrics>,
  ): Promise<Entry> {
    const db = await this.db();
    const existing = (await db.get("entries", dateISO)) ?? this.blankRecord(dateISO);
    const rec: LocalEntryRecord = {
      ...existing,
      metrics: { ...existing.metrics, ...patch },
    };
    await db.put("entries", rec);
    return this.recordToEntry(rec);
  }

  async toggleGoal(dateISO: string, label: string): Promise<Entry> {
    const db = await this.db();
    const existing = (await db.get("entries", dateISO)) ?? this.blankRecord(dateISO);
    const norm = label.toLowerCase();
    const has = existing.goalsOn.some((x) => x.toLowerCase() === norm);
    const rec: LocalEntryRecord = {
      ...existing,
      goalsOn: has
        ? existing.goalsOn.filter((x) => x.toLowerCase() !== norm)
        : [...existing.goalsOn, label],
    };
    await db.put("entries", rec);
    return this.recordToEntry(rec);
  }

  async saveEntryPeople(dateISO: string, people: string[]): Promise<Entry> {
    const db = await this.db();
    const existing = await db.get("entries", dateISO);
    // Solo UPDATE, mai creare una giornata vuota con soli people (BUG1).
    if (!existing) {
      return this.recordToEntry(this.blankRecord(dateISO));
    }
    const seen = new Set<string>();
    const clean: string[] = [];
    for (const p of people) {
      const t = p.trim();
      if (!t) continue;
      const k = t.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      clean.push(t);
    }
    const rec: LocalEntryRecord = { ...existing, people: clean };
    await db.put("entries", rec);
    return this.recordToEntry(rec);
  }

  /* ----------------- goals ----------------- */

  async loadGoalDefs(): Promise<GoalDef[]> {
    const db = await this.db();
    const recs = await db.getAll("goals");
    return recs
      .sort((a, b) => a.position - b.position || (a.createdAt < b.createdAt ? -1 : 1))
      .map((g) => ({ id: g.id, label: g.label, isAiSuggested: g.isAiSuggested }));
  }

  async addGoal(label: string): Promise<GoalDef> {
    const clean = label.trim();
    if (!clean) throw new Error("Label required");
    const db = await this.db();
    const recs = await db.getAll("goals");
    const nextPosition =
      recs.length > 0 ? Math.max(...recs.map((r) => r.position)) + 1 : 0;
    const rec: LocalGoalRecord = {
      id: uuid(),
      label: clean,
      isAiSuggested: false,
      position: nextPosition,
      createdAt: new Date().toISOString(),
    };
    await db.put("goals", rec);
    return { id: rec.id, label: rec.label, isAiSuggested: false };
  }

  async removeGoal(id: string): Promise<void> {
    const db = await this.db();
    await db.delete("goals", id);
  }

  /* ----------------- remembers ----------------- */

  async loadRemembers(): Promise<Remember[]> {
    const db = await this.db();
    const recs = await db.getAll("remembers");
    return recs.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async addRemember(text: string, kind: RememberKind): Promise<Remember> {
    const clean = text.trim();
    if (!clean) throw new Error("Text required");
    const rec: Remember = {
      id: uuid(),
      text: clean,
      kind,
      source: "manual",
      sourceEntryId: null,
      createdAt: new Date().toISOString(),
    };
    const db = await this.db();
    await db.put("remembers", rec);
    return rec;
  }

  async deleteRemember(id: string): Promise<void> {
    const db = await this.db();
    await db.delete("remembers", id);
  }

  async updateRememberKind(id: string, kind: RememberKind): Promise<void> {
    const db = await this.db();
    const rec = await db.get("remembers", id);
    if (!rec) return;
    await db.put("remembers", { ...rec, kind });
  }

  async loadPersonaNames(): Promise<string[]> {
    const db = await this.db();
    const recs = await db.getAllFromIndex("remembers", "kind", "persona");
    const sorted = recs.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const seen = new Set<string>();
    const names: string[] = [];
    for (const r of sorted) {
      const t = r.text.trim();
      if (!t) continue;
      const k = t.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      names.push(t);
    }
    return names;
  }

  async addPersonas(
    names: string[],
    sourceEntryId?: string | null,
  ): Promise<string[]> {
    const clean = names.map((n) => n.trim()).filter((n) => n.length > 0);
    if (clean.length === 0) return [];
    const existing = await this.loadPersonaNames();
    const existingLower = new Set(existing.map((e) => e.toLowerCase()));
    const seen = new Set<string>();
    const toInsert: string[] = [];
    for (const n of clean) {
      const k = n.toLowerCase();
      if (existingLower.has(k) || seen.has(k)) continue;
      seen.add(k);
      toInsert.push(n);
    }
    if (toInsert.length === 0) return [];
    const db = await this.db();
    const tx = db.transaction("remembers", "readwrite");
    const now = new Date().toISOString();
    for (const text of toInsert) {
      await tx.store.put({
        id: uuid(),
        text,
        kind: "persona",
        source: "extracted",
        sourceEntryId: sourceEntryId ?? null,
        createdAt: now,
      });
    }
    await tx.done;
    return toInsert;
  }

  /* ----------------- recaps ----------------- */

  async loadRecaps(): Promise<Recap[]> {
    // La GENERAZIONE e cloud/AI; la lettura di recap importati da un backup
    // e innocua e resta possibile.
    const db = await this.db();
    const recs = await db.getAll("recaps");
    return recs.sort((a, b) => (a.periodStart < b.periodStart ? 1 : -1));
  }

  async updateRecap(): Promise<Recap> {
    // Meglio un metodo che esplode che un'interfaccia con meta dei metodi
    // opzionali (SPEC-v2 §2.2).
    throw new Error("I recap non sono disponibili in modalita locale.");
  }

  async saveRecap(): Promise<Recap> {
    throw new Error("I recap non sono disponibili in modalita locale.");
  }

  /* ----------------- backup ----------------- */

  async exportAll(): Promise<BackupFile> {
    const db = await this.db();
    const [entryRecs, goals, remembers, recaps] = await Promise.all([
      db.getAll("entries"),
      this.loadGoalDefs(),
      this.loadRemembers(),
      this.loadRecaps(),
    ]);
    const defs = await this.loadGoalDefs();
    const entries = entryRecs
      .sort((a, b) => (a.entryDate < b.entryDate ? -1 : 1))
      .map((r) => this.recordToEntryWith(r, defs));
    const file: BackupFile = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      source: { mode: this.mode, app: APP_VERSION },
      counts: {
        entries: entries.length,
        goals: goals.length,
        remembers: remembers.length,
        recaps: recaps.length,
      },
      entries,
      goals,
      remembers,
      recaps,
    };
    await this.setMeta("lastBackupAt", file.exportedAt);
    return file;
  }

  async importAll(file: BackupFile): Promise<ImportReport> {
    if (file.format !== BACKUP_FORMAT || file.version !== BACKUP_VERSION) {
      throw new Error("File di backup non riconosciuto.");
    }
    const db = await this.db();
    const report: ImportReport = {
      entries: { added: 0, skipped: 0 },
      goals: { added: 0, skipped: 0 },
      remembers: { added: 0, skipped: 0 },
      recaps: { added: 0, skipped: 0 },
    };

    // entries: chiave entryDate; salta se esiste (a meno che vuota).
    for (const e of file.entries ?? []) {
      if (!e?.entryDate) continue;
      const existing = await db.get("entries", e.entryDate);
      if (existing && existing.transcript.trim().length > 0) {
        report.entries.skipped++;
        continue;
      }
      await db.put("entries", {
        id: uuid(),
        entryDate: e.entryDate,
        transcript: e.transcript ?? "",
        headline: e.headline ?? null,
        snippet: e.snippet ?? null,
        areas: e.areas ?? [],
        metrics: e.metrics ?? { weightKg: null, sleepHours: null, mood: null },
        goalsOn: (e.goals ?? []).filter((g) => g.on).map((g) => g.label),
        people: e.people ?? [],
        durationSeconds: 0,
        createdAt: e.createdAt ?? new Date().toISOString(),
      });
      report.entries.added++;
    }

    // goals: chiave label case-insensitive.
    const goalDefs = await this.loadGoalDefs();
    const goalLabels = new Set(goalDefs.map((g) => g.label.toLowerCase()));
    for (const g of file.goals ?? []) {
      const label = g?.label?.trim();
      if (!label) continue;
      if (goalLabels.has(label.toLowerCase())) {
        report.goals.skipped++;
        continue;
      }
      await this.addGoal(label);
      goalLabels.add(label.toLowerCase());
      report.goals.added++;
    }

    // remembers: chiave text+kind; sourceEntryId azzerato (§4.3).
    const existingRemembers = await this.loadRemembers();
    const rememberKeys = new Set(
      existingRemembers.map((r) => `${r.kind}::${r.text.toLowerCase()}`),
    );
    for (const r of file.remembers ?? []) {
      const text = r?.text?.trim();
      if (!text) continue;
      const key = `${r.kind}::${text.toLowerCase()}`;
      if (rememberKeys.has(key)) {
        report.remembers.skipped++;
        continue;
      }
      await db.put("remembers", {
        id: uuid(),
        text,
        kind: r.kind,
        source: r.source === "extracted" ? "extracted" : "manual",
        sourceEntryId: null,
        createdAt: r.createdAt ?? new Date().toISOString(),
      });
      rememberKeys.add(key);
      report.remembers.added++;
    }

    // recaps: chiave periodType+periodStart.
    const existingRecaps = await this.loadRecaps();
    const recapKeys = new Set(
      existingRecaps.map((r) => `${r.periodType}::${r.periodStart}`),
    );
    for (const r of file.recaps ?? []) {
      if (!r?.periodType || !r?.periodStart) continue;
      const key = `${r.periodType}::${r.periodStart}`;
      if (recapKeys.has(key)) {
        report.recaps.skipped++;
        continue;
      }
      await db.put("recaps", { ...r, id: uuid() });
      recapKeys.add(key);
      report.recaps.added++;
    }

    return report;
  }
}
