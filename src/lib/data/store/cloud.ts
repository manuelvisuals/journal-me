"use client";

/**
 * CloudStore: il codice che viveva in src/lib/data/{entries,goals,remembers,
 * recaps}.ts, spostato dietro l'interfaccia JournalStore (SPEC-v2 §2.6).
 * Spostamento, non riscrittura. Particolarita gia pagate e da non perdere:
 *
 * - `entries` NON ha la colonna duration_seconds: metterla in un select rompe
 *   silenziosamente tutta la query (BUG2 di maggio).
 * - Le letture di `people` sono difensive: se la colonna manca (migration 005
 *   non applicata) si ricade sulle colonne base.
 * - `saveEntryPeople` e solo UPDATE, mai INSERT: una riga creata con soli
 *   people mostrerebbe una giornata senza headline (BUG1).
 */

import { createClient } from "@/lib/supabase/client";
import { todayISO } from "@/lib/format";
import type {
  Alias,
  AreaSummary,
  Entry,
  EntryMetrics,
  Fact,
  GoalDef,
  GoalDot,
  Mood,
  NewFact,
  Recap,
  RecapPeriod,
  Remember,
  RememberKind,
  RememberSource,
} from "@/lib/types";
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
import { t } from "@/lib/i18n";

/* ----------------- helpers condivisi (da entries.ts) ----------------- */

function parseAreasJson(raw: unknown): AreaSummary[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter(
      (x): x is AreaSummary =>
        typeof x === "object" &&
        x !== null &&
        typeof (x as { label?: unknown }).label === "string" &&
        typeof (x as { text?: unknown }).text === "string",
    );
  }
  return [];
}

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

function buildGoals(defs: GoalDef[], labelsOn: string[]): GoalDot[] {
  const on = new Set(labelsOn.map((s) => s.toLowerCase()));
  return defs.map((d) => ({
    id: d.id,
    label: d.label,
    on: on.has(d.label.toLowerCase()),
  }));
}

const VALID_MOODS: ReadonlySet<string> = new Set([
  "great",
  "good",
  "neutral",
  "low",
  "bad",
]);

function parseMood(raw: unknown): Mood | null {
  if (typeof raw !== "string") return null;
  return VALID_MOODS.has(raw) ? (raw as Mood) : null;
}

function buildMetrics(
  weightKg: unknown,
  sleepHours: unknown,
  mood: unknown,
): EntryMetrics {
  return {
    weightKg: typeof weightKg === "number" ? weightKg : null,
    sleepHours: typeof sleepHours === "number" ? sleepHours : null,
    mood: parseMood(mood),
  };
}

function blankMetrics(): EntryMetrics {
  return { weightKg: null, sleepHours: null, mood: null };
}

function blankEntryShell(dateISO: string): Entry {
  return {
    id: `pending-${dateISO}`,
    entryDate: dateISO,
    transcript: "",
    durationSeconds: 0,
    headline: null,
    snippet: null,
    areas: [],
    metrics: blankMetrics(),
    goals: [],
    people: [],
    createdAt: new Date().toISOString(),
  };
}

const ENTRY_COLS_FULL =
  "id, entry_date, transcript, headline, snippet, areas, mood, weight_kg, sleep_hours, goals_on, people, headline_locked, created_at";
const ENTRY_COLS_BASE =
  "id, entry_date, transcript, headline, snippet, areas, mood, weight_kg, sleep_hours, goals_on, created_at";

const VALID_KINDS: ReadonlySet<RememberKind> = new Set([
  "persona",
  "todo",
  "nota",
  "luogo",
  "idea",
]);
const VALID_SOURCES: ReadonlySet<RememberSource> = new Set([
  "manual",
  "extracted",
]);

function rowToEntry(row: Record<string, unknown>, goalDefs: GoalDef[]): Entry {
  return {
    id: row.id as string,
    entryDate: row.entry_date as string,
    transcript: (row.transcript as string) ?? "",
    durationSeconds: 0,
    headline: (row.headline as string) ?? null,
    snippet: (row.snippet as string) ?? null,
    areas: parseAreasJson(row.areas),
    metrics: buildMetrics(row.weight_kg, row.sleep_hours, row.mood),
    goals: buildGoals(goalDefs, parseStringArray(row.goals_on)),
    people: parseStringArray(row.people),
    headlineLocked: row.headline_locked === true,
    createdAt: row.created_at as string,
  };
}

/* -------------------------------- store -------------------------------- */

export class CloudStore implements JournalStore {
  readonly mode: StorageMode = "cloud";

  private supabase() {
    return createClient();
  }

  /**
   * L'id dell'utente, per ogni lettura e ogni scrittura.
   *
   * PRIMA passava da `auth.getUser()`, che NON legge la sessione salvata:
   * fa una chiamata di rete a Supabase per farsi validare il token, a ogni
   * singola operazione. Due conseguenze, viste tutte e due dal vivo il 22
   * agosto 2026:
   *
   *  - un intoppo di rete di mezzo secondo faceva tornare `user` nullo, e la
   *    giornata non si salvava con scritto in faccia "Not authenticated" —
   *    in inglese, e per giunta falso: la sessione era validissima;
   *  - ogni salvataggio pagava un giro di rete in piu prima di cominciare.
   *
   * Ora si legge la sessione gia in memoria (`getSession`), che non tocca la
   * rete. Non e un buco di sicurezza: chi puo scrivere davvero lo decide il
   * database riga per riga con le regole RLS — se questo id fosse sbagliato,
   * la scrittura verrebbe rifiutata li. `getUser()` resta come seconda
   * strada per il primo avvio, quando la sessione non e ancora in memoria.
   *
   * Non si tiene in cache: `getSession()` e gia locale, e ricordarselo
   * significherebbe scrivere con l'identita di ieri dopo un cambio account.
   */
  private async userId(): Promise<string> {
    const supabase = this.supabase();
    const { data: sessione } = await supabase.auth.getSession();
    const fromSession = sessione.session?.user?.id;
    if (fromSession) return fromSession;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    return user.id;
  }

  /* ----------------- entries ----------------- */

  private async loadEntryRow(
    dateISO: string,
    defs?: GoalDef[],
  ): Promise<Entry | null> {
    const supabase = this.supabase();
    const goalDefs = defs ?? (await this.loadGoalDefs());
    // Defensive: the `people` column ships with migration 005. If it hasn't
    // been applied yet, the full select errors — fall back to the base columns
    // so entries still load (Social pills just stay empty).
    const full = await supabase
      .from("entries")
      .select(ENTRY_COLS_FULL)
      .eq("entry_date", dateISO)
      .maybeSingle();
    let row = full.data as Record<string, unknown> | null;
    if (full.error) {
      const base = await supabase
        .from("entries")
        .select(ENTRY_COLS_BASE)
        .eq("entry_date", dateISO)
        .maybeSingle();
      if (base.error) return null;
      row = base.data as Record<string, unknown> | null;
    }
    if (!row) return null;
    return rowToEntry(row, goalDefs);
  }

  async loadTodayEntry(): Promise<Entry | null> {
    return this.loadEntryRow(todayISO());
  }

  async loadEntryForDate(dateISO: string): Promise<Entry | null> {
    return this.loadEntryRow(dateISO);
  }

  async loadMonthEntries(year: number, month: number): Promise<Entry[]> {
    const supabase = this.supabase();
    const m = String(month).padStart(2, "0");
    const lastDay = new Date(year, month, 0).getDate();
    const start = `${year}-${m}-01`;
    const end = `${year}-${m}-${String(lastDay).padStart(2, "0")}`;
    const goalDefs = await this.loadGoalDefs();
    // Month rows don't render people, so we skip that column here (also keeps
    // this query working regardless of migration 005 state).
    const { data, error } = await supabase
      .from("entries")
      .select(ENTRY_COLS_BASE)
      .gte("entry_date", start)
      .lte("entry_date", end)
      .order("entry_date", { ascending: false });
    if (error || !data) return [];
    return data.map((d) => ({
      ...rowToEntry(d as Record<string, unknown>, goalDefs),
      people: [],
    }));
  }

  async countEntries(): Promise<number> {
    const { count } = await this.supabase()
      .from("entries")
      .select("id", { count: "exact", head: true });
    return count ?? 0;
  }

  async deleteEntry(dateISO: string): Promise<void> {
    const userId = await this.userId();
    const { error } = await this.supabase()
      .from("entries")
      .delete()
      .eq("user_id", userId)
      .eq("entry_date", dateISO);
    if (error) throw new Error(error.message);
  }

  async saveProcessedEntry(
    dateISO: string,
    transcript: string,
    ai: AIFields,
    durationSeconds: number,
  ): Promise<Entry> {
    const userId = await this.userId();
    // `people` entra nella riga SOLO se l'analisi lo ha prodotto: assente
    // vuol dire "non toccare", vedi AIFields in store/types.ts.
    // Il titolo scritto a mano vince su qualunque rilettura: si guarda
    // prima se questa giornata lo ha bloccato, e in quel caso non lo si
    // manda nemmeno. Vedi migration 012.
    const { data: prima } = await this.supabase()
      .from("entries")
      .select("headline_locked")
      .eq("user_id", userId)
      .eq("entry_date", dateISO)
      .maybeSingle();
    const bloccato = (prima as { headline_locked?: boolean } | null)
      ?.headline_locked === true;

    const row: Record<string, unknown> = {
      user_id: userId,
      entry_date: dateISO,
      transcript,
      snippet: ai.snippet,
      areas: ai.areas,
    };
    if (!bloccato) row.headline = ai.headline;
    if (ai.people) row.people = ai.people;
    const { error } = await this.supabase()
      .from("entries")
      .upsert(row, { onConflict: "user_id,entry_date" });
    if (error) {
      throw new Error(error.message ?? "Failed to save entry");
    }
    // Reload so the returned entry is fully hydrated (metrics, goals from the
    // live definitions, people) instead of stubbed.
    const reloaded = await this.loadEntryRow(dateISO);
    if (reloaded) return { ...reloaded, durationSeconds };
    return blankEntryShell(dateISO);
  }

  async saveHeadline(dateISO: string, headline: string): Promise<Entry> {
    const userId = await this.userId();
    const { error } = await this.supabase()
      .from("entries")
      .update({ headline: headline.trim(), headline_locked: true })
      .eq("user_id", userId)
      .eq("entry_date", dateISO);
    if (error) throw new Error(error.message);
    const reloaded = await this.loadEntryRow(dateISO);
    return reloaded ?? blankEntryShell(dateISO);
  }

  async saveAreas(dateISO: string, areas: AreaSummary[]): Promise<Entry> {
    const userId = await this.userId();
    const { error } = await this.supabase()
      .from("entries")
      .update({ areas })
      .eq("user_id", userId)
      .eq("entry_date", dateISO);
    if (error) throw new Error(error.message);
    const reloaded = await this.loadEntryRow(dateISO);
    return reloaded ?? blankEntryShell(dateISO);
  }

  async updateEntryTranscript(dateISO: string, text: string): Promise<Entry> {
    // NOTA (spec §2.2): la ri-elaborazione AI del transcript modificato NON
    // sta qui — la fa l'azione reprocessEntryTranscript (src/lib/actions),
    // che chiama /api/process-entry e poi saveProcessedEntry. Questo metodo
    // salva e basta, preservando i campi AI esistenti: e cio che potra fare
    // anche LocalStore senza toccare la rete.
    const existing = await this.loadEntryRow(dateISO);
    return this.saveProcessedEntry(
      dateISO,
      text,
      {
        headline: existing?.headline ?? "",
        snippet: existing?.snippet ?? "",
        areas: existing?.areas ?? [],
      },
      0,
    );
  }

  async updateMetric(
    dateISO: string,
    patch: Partial<EntryMetrics>,
  ): Promise<Entry> {
    const userId = await this.userId();
    const dbPatch: Record<string, unknown> = {};
    if (Object.prototype.hasOwnProperty.call(patch, "weightKg")) {
      dbPatch.weight_kg = patch.weightKg;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "sleepHours")) {
      dbPatch.sleep_hours = patch.sleepHours;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "mood")) {
      dbPatch.mood = patch.mood;
    }
    const { error } = await this.supabase()
      .from("entries")
      .upsert(
        { user_id: userId, entry_date: dateISO, ...dbPatch },
        { onConflict: "user_id,entry_date" },
      );
    if (error) throw new Error(error.message);
    return (await this.loadEntryRow(dateISO)) ?? blankEntryShell(dateISO);
  }

  async toggleGoal(dateISO: string, label: string): Promise<Entry> {
    const userId = await this.userId();
    const { data: existingRow } = await this.supabase()
      .from("entries")
      .select("goals_on")
      .eq("entry_date", dateISO)
      .maybeSingle();

    const current = parseStringArray(existingRow?.goals_on);
    const norm = label.toLowerCase();
    const has = current.some((x) => x.toLowerCase() === norm);
    const next = has
      ? current.filter((x) => x.toLowerCase() !== norm)
      : [...current, label];

    const { error } = await this.supabase()
      .from("entries")
      .upsert(
        { user_id: userId, entry_date: dateISO, goals_on: next },
        { onConflict: "user_id,entry_date" },
      );
    if (error) throw new Error(error.message);
    return (await this.loadEntryRow(dateISO)) ?? blankEntryShell(dateISO);
  }

  async saveEntryPeople(dateISO: string, people: string[]): Promise<Entry> {
    const userId = await this.userId();
    // Normalize: trim, drop empty, dedupe (case-insensitive, keep first casing).
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
    // UPDATE only — never create a blank row here (BUG1).
    const { error } = await this.supabase()
      .from("entries")
      .update({ people: clean })
      .eq("user_id", userId)
      .eq("entry_date", dateISO);
    // Tolerate a missing `people` column (migration 005 not yet applied).
    if (error && !/people/i.test(error.message)) {
      throw new Error(error.message);
    }
    return (await this.loadEntryRow(dateISO)) ?? blankEntryShell(dateISO);
  }

  /* ----------------- fatti (SPEC-fatti §3) ----------------- */

  private factRow(r: Record<string, unknown>): Fact {
    return {
      id: r.id as string,
      entryDate: r.entry_date as string,
      kind: r.kind as Fact["kind"],
      label: (r.label as string) ?? "",
      labelKey: (r.label_key as string) ?? "",
      attrs:
        r.attrs && typeof r.attrs === "object"
          ? (r.attrs as Record<string, unknown>)
          : {},
      confidence: typeof r.confidence === "number" ? r.confidence : null,
      origin: r.origin === "manual" ? "manual" : "ai",
    };
  }

  async replaceAiFacts(dateISO: string, facts: NewFact[]): Promise<Fact[]> {
    const userId = await this.userId();
    const supabase = this.supabase();

    // Prima si cancellano SOLO i fatti letti dall'AI per quel giorno: quelli
    // scritti a mano restano, sempre.
    const { error: delError } = await supabase
      .from("facts")
      .delete()
      .eq("user_id", userId)
      .eq("entry_date", dateISO)
      .eq("origin", "ai");
    if (delError) throw new Error(delError.message);

    if (facts.length === 0) return this.loadFactsForDate(dateISO);

    // entry_id: se la giornata esiste, i fatti spariscono con lei.
    const { data: entryRow } = await supabase
      .from("entries")
      .select("id")
      .eq("user_id", userId)
      .eq("entry_date", dateISO)
      .maybeSingle();
    const entryId = (entryRow as { id?: string } | null)?.id ?? null;

    const { error } = await supabase.from("facts").insert(
      facts.map((f) => ({
        user_id: userId,
        entry_id: entryId,
        entry_date: dateISO,
        kind: f.kind,
        label: f.label,
        label_key: f.labelKey,
        attrs: f.attrs ?? {},
        confidence: f.confidence,
        origin: f.origin ?? "ai",
      })),
    );
    if (error) throw new Error(error.message);
    return this.loadFactsForDate(dateISO);
  }

  async loadAliases(): Promise<Alias[]> {
    const userId = await this.userId();
    const { data, error } = await this.supabase()
      .from("fact_aliases")
      .select("kind, alias, label_key")
      .eq("user_id", userId);
    // Un soprannome mancante fa tornare il soprannome al posto del nome: e
    // brutto, ma e molto meglio di una giornata che non si apre.
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map((r) => ({
      kind: String(r.kind) as Alias["kind"],
      alias: String(r.alias),
      labelKey: String(r.label_key),
    }));
  }

  async saveAlias(alias: Alias): Promise<Alias[]> {
    const userId = await this.userId();
    const { error } = await this.supabase()
      .from("fact_aliases")
      .upsert(
        {
          user_id: userId,
          kind: alias.kind,
          alias: alias.alias,
          label_key: alias.labelKey,
        },
        { onConflict: "user_id,kind,alias" },
      );
    if (error) throw new Error(error.message);
    return this.loadAliases();
  }

  async loadFactsForDate(dateISO: string): Promise<Fact[]> {
    const userId = await this.userId();
    const { data, error } = await this.supabase()
      .from("facts")
      .select("*")
      .eq("user_id", userId)
      .eq("entry_date", dateISO)
      .order("created_at", { ascending: true });
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map((r) => this.factRow(r));
  }

  async loadFactsForMonth(year: number, month: number): Promise<Fact[]> {
    const userId = await this.userId();
    const from = `${year}-${String(month).padStart(2, "0")}-01`;
    const to =
      month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const { data, error } = await this.supabase()
      .from("facts")
      .select("*")
      .eq("user_id", userId)
      .gte("entry_date", from)
      .lt("entry_date", to)
      .order("entry_date", { ascending: false });
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map((r) => this.factRow(r));
  }

  async loadKnownLabels(limit = 120): Promise<string[]> {
    const userId = await this.userId();
    // Le ultime 600 righe bastano: le etichette che uno usa davvero
    // ricompaiono spesso, e una query di aggregazione qui non vale la pena.
    const { data, error } = await this.supabase()
      .from("facts")
      .select("label_key")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(600);
    if (error || !data) return [];
    const conteggio = new Map<string, number>();
    for (const r of data as { label_key?: string }[]) {
      const k = (r.label_key ?? "").trim();
      if (!k) continue;
      conteggio.set(k, (conteggio.get(k) ?? 0) + 1);
    }
    return [...conteggio.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([k]) => k);
  }

  /* ----------------- goals ----------------- */

  async loadGoalDefs(): Promise<GoalDef[]> {
    const { data, error } = await this.supabase()
      .from("goals")
      .select("id, label, is_ai_suggested, position")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error || !data) return [];
    return data
      .filter((g) => typeof g.label === "string" && g.label.trim().length > 0)
      .map((g) => ({
        id: g.id as string,
        label: g.label as string,
        isAiSuggested: !!g.is_ai_suggested,
      }));
  }

  async addGoal(label: string): Promise<GoalDef> {
    const clean = label.trim();
    if (!clean) throw new Error("Label required");
    const userId = await this.userId();
    // Next position = max(position) + 1, so new goals append to the end.
    const { data: existing } = await this.supabase()
      .from("goals")
      .select("position")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextPosition =
      existing && typeof existing.position === "number"
        ? (existing.position as number) + 1
        : 0;
    const { data, error } = await this.supabase()
      .from("goals")
      .insert({
        user_id: userId,
        label: clean,
        position: nextPosition,
        is_ai_suggested: false,
      })
      .select("id, label, is_ai_suggested")
      .single();
    if (error || !data) throw new Error(error?.message ?? "DB error");
    return {
      id: data.id as string,
      label: data.label as string,
      isAiSuggested: !!data.is_ai_suggested,
    };
  }

  async removeGoal(id: string): Promise<void> {
    const { error } = await this.supabase().from("goals").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  /* ----------------- remembers ----------------- */

  async loadRemembers(): Promise<Remember[]> {
    const { data } = await this.supabase()
      .from("remembers")
      .select("id, text, kind, source, source_entry_id, created_at")
      .order("created_at", { ascending: false });
    if (!data) return [];
    return data
      .filter((d) => VALID_KINDS.has(d.kind as RememberKind))
      .map((d) => ({
        id: d.id as string,
        text: d.text as string,
        kind: d.kind as RememberKind,
        source: VALID_SOURCES.has(d.source as RememberSource)
          ? (d.source as RememberSource)
          : "manual",
        sourceEntryId: (d.source_entry_id as string | null) ?? null,
        createdAt: d.created_at as string,
      }));
  }

  async addRemember(text: string, kind: RememberKind): Promise<Remember> {
    const clean = text.trim();
    if (!clean) throw new Error("Text required");
    const userId = await this.userId();
    const { data, error } = await this.supabase()
      .from("remembers")
      .insert({
        user_id: userId,
        text: clean,
        kind,
        source: "manual",
      })
      .select("id, created_at")
      .single();
    if (error || !data) throw new Error(error?.message ?? "DB error");
    return {
      id: data.id as string,
      text: clean,
      kind,
      source: "manual",
      sourceEntryId: null,
      createdAt: data.created_at as string,
    };
  }

  async deleteRemember(id: string): Promise<void> {
    const { error } = await this.supabase()
      .from("remembers")
      .delete()
      .eq("id", id);
    if (error) throw new Error(error.message);
  }

  async updateRememberKind(id: string, kind: RememberKind): Promise<void> {
    const { error } = await this.supabase()
      .from("remembers")
      .update({ kind })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }

  async loadPersonaNames(): Promise<string[]> {
    const { data } = await this.supabase()
      .from("remembers")
      .select("text")
      .eq("kind", "persona")
      .order("created_at", { ascending: false });
    if (!data) return [];
    const seen = new Set<string>();
    const names: string[] = [];
    for (const d of data) {
      const t = typeof d.text === "string" ? d.text.trim() : "";
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
    const userId = await this.userId();
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
    const rows = toInsert.map((text) => ({
      user_id: userId,
      text,
      kind: "persona" as const,
      source: "extracted" as const,
      source_entry_id: sourceEntryId ?? null,
    }));
    const { error } = await this.supabase().from("remembers").insert(rows);
    if (error) throw new Error(error.message);
    return toInsert;
  }

  /* ----------------- recaps ----------------- */

  async loadRecaps(): Promise<Recap[]> {
    const { data } = await this.supabase()
      .from("recaps")
      .select(
        "id, period_type, period_start, period_end, title, snippet, body, generated_at",
      )
      .order("period_start", { ascending: false });
    if (!data) return [];
    return data.map((d) => ({
      id: d.id as string,
      periodType: d.period_type as RecapPeriod,
      periodStart: d.period_start as string,
      periodEnd: d.period_end as string,
      title: d.title as string,
      snippet: d.snippet as string,
      body: d.body as string,
      generatedAt: d.generated_at as string,
    }));
  }

  async updateRecap(
    id: string,
    patch: { title?: string; snippet?: string; body?: string },
  ): Promise<Recap> {
    const dbPatch: Record<string, unknown> = {};
    if (patch.title !== undefined) dbPatch.title = patch.title;
    if (patch.snippet !== undefined) dbPatch.snippet = patch.snippet;
    if (patch.body !== undefined) dbPatch.body = patch.body;
    const { data, error } = await this.supabase()
      .from("recaps")
      .update(dbPatch)
      .eq("id", id)
      .select(
        "id, period_type, period_start, period_end, title, snippet, body, generated_at",
      )
      .single();
    if (error || !data) throw new Error(error?.message ?? "DB error");
    return {
      id: data.id as string,
      periodType: data.period_type as RecapPeriod,
      periodStart: data.period_start as string,
      periodEnd: data.period_end as string,
      title: data.title as string,
      snippet: data.snippet as string,
      body: data.body as string,
      generatedAt: data.generated_at as string,
    };
  }

  async saveRecap(input: {
    periodType: RecapPeriod;
    periodStart: string;
    periodEnd: string;
    title: string;
    snippet: string;
    body: string;
  }): Promise<Recap> {
    const userId = await this.userId();
    const { data, error } = await this.supabase()
      .from("recaps")
      .upsert(
        {
          user_id: userId,
          period_type: input.periodType,
          period_start: input.periodStart,
          period_end: input.periodEnd,
          title: input.title,
          snippet: input.snippet,
          body: input.body,
        },
        { onConflict: "user_id,period_type,period_start" },
      )
      .select("id, generated_at")
      .single();
    if (error || !data) throw new Error(error?.message ?? "DB error");
    return {
      id: data.id as string,
      periodType: input.periodType,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      title: input.title,
      snippet: input.snippet,
      body: input.body,
      generatedAt: data.generated_at as string,
    };
  }

  /* ----------------- backup (SPEC-v2 §4) ----------------- */

  async loadAllEntries(): Promise<Entry[]> {
    const supabase = this.supabase();
    const goalDefs = await this.loadGoalDefs();
    const full = await supabase
      .from("entries")
      .select(ENTRY_COLS_FULL)
      .order("entry_date", { ascending: true });
    let rows = full.data as Record<string, unknown>[] | null;
    if (full.error) {
      const base = await supabase
        .from("entries")
        .select(ENTRY_COLS_BASE)
        .order("entry_date", { ascending: true });
      if (base.error || !base.data) return [];
      rows = base.data as Record<string, unknown>[];
    }
    if (!rows) return [];
    return rows.map((r) => rowToEntry(r, goalDefs));
  }

  async exportAll(): Promise<BackupFile> {
    const [entries, goals, remembers, recaps] = await Promise.all([
      this.loadAllEntries(),
      this.loadGoalDefs(),
      this.loadRemembers(),
      this.loadRecaps(),
    ]);
    return {
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
  }

  async importAll(file: BackupFile): Promise<ImportReport> {
    if (file.format !== BACKUP_FORMAT || file.version !== BACKUP_VERSION) {
      throw new Error(t("File di backup non riconosciuto."));
    }
    const userId = await this.userId();
    const supabase = this.supabase();
    const report: ImportReport = {
      entries: { added: 0, skipped: 0 },
      goals: { added: 0, skipped: 0 },
      remembers: { added: 0, skipped: 0 },
      recaps: { added: 0, skipped: 0 },
    };

    // entries: chiave naturale entryDate; salta se esiste, a meno che
    // l'esistente sia vuoto. Gli id non si trasportano.
    const goalDefs = await this.loadGoalDefs();
    for (const e of file.entries ?? []) {
      if (!e?.entryDate) continue;
      const existing = await this.loadEntryRow(e.entryDate, goalDefs);
      if (existing && existing.transcript.trim().length > 0) {
        report.entries.skipped++;
        continue;
      }
      const payload: Record<string, unknown> = {
        user_id: userId,
        entry_date: e.entryDate,
        transcript: e.transcript ?? "",
        headline: e.headline,
        snippet: e.snippet,
        areas: e.areas ?? [],
        mood: e.metrics?.mood ?? null,
        weight_kg: e.metrics?.weightKg ?? null,
        sleep_hours: e.metrics?.sleepHours ?? null,
        goals_on: (e.goals ?? []).filter((g) => g.on).map((g) => g.label),
      };
      const { error } = await supabase
        .from("entries")
        .upsert(payload, { onConflict: "user_id,entry_date" });
      if (error) throw new Error(error.message);
      // people a parte, con la tolleranza sulla colonna mancante
      if (e.people && e.people.length > 0) {
        await this.saveEntryPeople(e.entryDate, e.people);
      }
      report.entries.added++;
    }

    // goals: chiave label case-insensitive; salta se esiste.
    const existingGoals = await this.loadGoalDefs();
    const goalLabels = new Set(existingGoals.map((g) => g.label.toLowerCase()));
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

    // remembers: chiave text+kind; salta se esiste. sourceEntryId azzerato:
    // il backup v1 non trasporta il legame entry-remember (§4.3).
    const existingRemembers = await this.loadRemembers();
    const rememberKeys = new Set(
      existingRemembers.map((r) => `${r.kind}::${r.text.toLowerCase()}`),
    );
    for (const r of file.remembers ?? []) {
      const text = r?.text?.trim();
      if (!text || !VALID_KINDS.has(r.kind)) continue;
      const key = `${r.kind}::${text.toLowerCase()}`;
      if (rememberKeys.has(key)) {
        report.remembers.skipped++;
        continue;
      }
      const { error } = await supabase.from("remembers").insert({
        user_id: userId,
        text,
        kind: r.kind,
        source: VALID_SOURCES.has(r.source) ? r.source : "manual",
        source_entry_id: null,
      });
      if (error) throw new Error(error.message);
      rememberKeys.add(key);
      report.remembers.added++;
    }

    // recaps: chiave periodType+periodStart; salta se esiste.
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
      await this.saveRecap({
        periodType: r.periodType,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        title: r.title,
        snippet: r.snippet,
        body: r.body,
      });
      recapKeys.add(key);
      report.recaps.added++;
    }

    return report;
  }
}
