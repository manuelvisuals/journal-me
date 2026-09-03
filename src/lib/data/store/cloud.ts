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
import { chiaveAlias, dividiNomi } from "@/lib/aliases";
import type {
  Alias,
  DayExclusion,
  Domanda,
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
import { Cassettine, type Contenuto, type RigaInChiaro } from "./cassettine";
import { apriRiga, chiudiRiga, improntaDi } from "./buste";

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

  /* ----------------- giornate: le cassettine ----------------- */

  /**
   * Da qui in giu ogni giornata cloud e una CASSETTINA (store/cassettine.ts):
   * chiusa a chiave sul dispositivo, versionata dal server. Le righe in
   * chiaro di `entries` e `facts` restano leggibili finche la persona non
   * le porta nella cassaforte (R12), e questo store le legge come RIPIEGO.
   */
  private readonly cassettine = new Cassettine(
    () => this.supabase(),
    () => this.userId(),
    {
      leggiInChiaro: (g) => this.leggiRigaInChiaro(g),
      leggiInChiaroTra: (da, a) => this.leggiRigheInChiaroTra(da, a),
      cancellaInChiaro: (g) => this.cancellaRigaInChiaro(g),
    },
  );

  private rowToContenuto(row: Record<string, unknown>, facts: Fact[]): Contenuto {
    return {
      transcript: (row.transcript as string) ?? "",
      headline: (row.headline as string) ?? null,
      snippet: (row.snippet as string) ?? null,
      areas: parseAreasJson(row.areas),
      people: parseStringArray(row.people),
      metrics: buildMetrics(row.weight_kg, row.sleep_hours, row.mood),
      goalsOn: parseStringArray(row.goals_on),
      headlineLocked: row.headline_locked === true,
      durationSeconds: 0,
      facts: facts.map((f) => {
        const { entryDate: _d, ...resto } = f;
        return resto;
      }),
      createdAt: (row.created_at as string) ?? new Date().toISOString(),
    };
  }

  private async leggiRigaInChiaro(giorno: string): Promise<RigaInChiaro | null> {
    const supabase = this.supabase();
    const full = await supabase
      .from("entries")
      .select(ENTRY_COLS_FULL)
      .eq("entry_date", giorno)
      .maybeSingle();
    let row = full.data as Record<string, unknown> | null;
    if (full.error) {
      const base = await supabase
        .from("entries")
        .select(ENTRY_COLS_BASE)
        .eq("entry_date", giorno)
        .maybeSingle();
      if (base.error) return null;
      row = base.data as Record<string, unknown> | null;
    }
    if (!row) return null;
    const facts = await this.leggiFattiInChiaro(giorno, giorno);
    return { id: row.id as string, contenuto: this.rowToContenuto(row, facts) };
  }

  private async leggiRigheInChiaroTra(da: string, a: string): Promise<Map<string, RigaInChiaro>> {
    const supabase = this.supabase();
    const full = await supabase
      .from("entries")
      .select(ENTRY_COLS_FULL)
      .gte("entry_date", da)
      .lte("entry_date", a)
      .order("entry_date", { ascending: false });
    let rows = full.data as Record<string, unknown>[] | null;
    if (full.error) {
      const base = await supabase
        .from("entries")
        .select(ENTRY_COLS_BASE)
        .gte("entry_date", da)
        .lte("entry_date", a)
        .order("entry_date", { ascending: false });
      if (base.error || !base.data) return new Map();
      rows = base.data as Record<string, unknown>[];
    }
    const out = new Map<string, RigaInChiaro>();
    if (!rows || rows.length === 0) return out;
    const fatti = await this.leggiFattiInChiaro(da, a);
    const perGiorno = new Map<string, Fact[]>();
    for (const f of fatti) {
      const l = perGiorno.get(f.entryDate) ?? [];
      l.push(f);
      perGiorno.set(f.entryDate, l);
    }
    for (const r of rows) {
      const g = r.entry_date as string;
      out.set(g, { id: r.id as string, contenuto: this.rowToContenuto(r, perGiorno.get(g) ?? []) });
    }
    return out;
  }

  private async leggiFattiInChiaro(da: string, a: string): Promise<Fact[]> {
    const userId = await this.userId();
    const { data, error } = await this.supabase()
      .from("facts")
      .select("*")
      .eq("user_id", userId)
      .gte("entry_date", da)
      .lte("entry_date", a)
      .order("created_at", { ascending: true });
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map((r) => this.factRow(r));
  }

  private async cancellaRigaInChiaro(giorno: string): Promise<void> {
    const userId = await this.userId();
    const supabase = this.supabase();
    await supabase.from("facts").delete().eq("user_id", userId).eq("entry_date", giorno);
    const { error } = await supabase
      .from("entries")
      .delete()
      .eq("user_id", userId)
      .eq("entry_date", giorno);
    if (error) throw new Error(error.message);
  }

  private contenutoToEntry(giorno: string, c: Contenuto, goalDefs: GoalDef[]): Entry {
    return {
      id: `c:${giorno}`,
      entryDate: giorno,
      transcript: c.transcript,
      durationSeconds: c.durationSeconds,
      headline: c.headline,
      snippet: c.snippet,
      areas: c.areas,
      metrics: c.metrics,
      goals: buildGoals(goalDefs, c.goalsOn),
      people: c.people,
      headlineLocked: c.headlineLocked,
      createdAt: c.createdAt,
    };
  }

  /** Quante giornate sono chiuse e quante ancora in chiaro (Impostazioni > Cassaforte). */
  async contaGiornate(): Promise<{ chiuse: number; inChiaro: number }> {
    return this.cassettine.conta();
  }

  /**
   * Il passaggio esplicito nella cassaforte (R12): prima le giornate in
   * chiaro (una cassettina ciascuna), poi le righe in chiaro delle altre
   * tabelle (memo, recap, domande, soprannomi, esclusioni), che ricevono la
   * loro busta. Ogni riga e o di qua o di la, mai a meta: se si interrompe,
   * si riprende da dove era.
   */
  async portaNellaCassaforte(avanza?: (fatte: number, totale: number) => void): Promise<number> {
    const giornate = await this.cassettine.portaTutteNellaCassaforte(avanza);
    await this.portaRigheNellaCassaforte();
    return giornate;
  }

  /** Quante righe (oltre alle giornate) sono ancora in chiaro. */
  async contaRigheInChiaro(): Promise<number> {
    const sb = this.supabase();
    const tabelle = ["remembers", "recaps", "open_questions", "fact_aliases", "day_exclusions"];
    let n = 0;
    for (const t of tabelle) {
      const { count } = await sb.from(t).select("id", { count: "exact", head: true }).is("busta", null);
      n += count ?? 0;
    }
    return n;
  }

  private async portaRigheNellaCassaforte(): Promise<void> {
    const userId = await this.userId();
    const sb = this.supabase();

    const memo = await sb.from("remembers").select("id, text").eq("user_id", userId).is("busta", null);
    for (const r of (memo.data ?? []) as { id: string; text: string }[]) {
      await sb
        .from("remembers")
        .update({ text: "", busta: await chiudiRiga({ text: r.text ?? "" }) })
        .eq("user_id", userId)
        .eq("id", r.id);
    }

    const recaps = await sb.from("recaps").select("id, title, snippet, body").eq("user_id", userId).is("busta", null);
    for (const r of (recaps.data ?? []) as { id: string; title: string; snippet: string; body: string }[]) {
      await sb
        .from("recaps")
        .update({
          title: "",
          snippet: "",
          body: "",
          busta: await chiudiRiga({ title: r.title ?? "", snippet: r.snippet ?? "", body: r.body ?? "" }),
        })
        .eq("user_id", userId)
        .eq("id", r.id);
    }

    const domande = await sb.from("open_questions").select("*").eq("user_id", userId).is("busta", null);
    for (const r of (domande.data ?? []) as Record<string, unknown>[]) {
      const dentro: Record<string, unknown> = {
        soggetto: r.soggetto ?? "",
        citazione: r.citazione ?? "",
        testo: r.testo ?? "",
        perche: r.perche ?? "",
        opzioni: Array.isArray(r.opzioni) ? r.opzioni : [],
      };
      if (typeof r.risposta === "string") dentro.risposta = r.risposta;
      await sb
        .from("open_questions")
        .update({
          soggetto: "",
          soggetto_key: await improntaDi(String(r.soggetto_key ?? "")),
          citazione: "",
          testo: "",
          perche: "",
          opzioni: [],
          risposta: typeof r.risposta === "string" ? "nella-busta" : null,
          busta: await chiudiRiga(dentro),
        })
        .eq("user_id", userId)
        .eq("id", r.id);
    }

    const alias = await sb.from("fact_aliases").select("kind, alias, label_key").eq("user_id", userId).is("busta", null);
    for (const r of (alias.data ?? []) as { kind: string; alias: string; label_key: string }[]) {
      await sb
        .from("fact_aliases")
        .update({
          alias: await improntaDi(r.alias),
          label_key: "",
          busta: await chiudiRiga({ alias: r.alias, labelKeys: dividiNomi(r.label_key ?? "") }),
        })
        .eq("user_id", userId)
        .eq("kind", r.kind)
        .eq("alias", r.alias);
    }

    const escl = await sb.from("day_exclusions").select("entry_date, kind, label_key").eq("user_id", userId).is("busta", null);
    for (const r of (escl.data ?? []) as { entry_date: string; kind: string; label_key: string }[]) {
      await sb
        .from("day_exclusions")
        .update({
          label_key: await improntaDi(r.label_key),
          busta: await chiudiRiga({ labelKey: r.label_key }),
        })
        .eq("user_id", userId)
        .eq("entry_date", r.entry_date)
        .eq("kind", r.kind)
        .eq("label_key", r.label_key);
    }
  }

  /** Dopo un conflitto: scrive la versione che la persona ha scelto. */
  async scriviVersioneScelta(giorno: string, contenuto: Contenuto): Promise<Entry> {
    const c = await this.cassettine.sovrascrivi(giorno, contenuto);
    return this.contenutoToEntry(giorno, c, await this.loadGoalDefs());
  }

  /* ----------------- entries ----------------- */

  private async loadEntryRow(dateISO: string, defs?: GoalDef[]): Promise<Entry | null> {
    const goalDefs = defs ?? (await this.loadGoalDefs());
    const c = await this.cassettine.leggi(dateISO);
    return c ? this.contenutoToEntry(dateISO, c, goalDefs) : null;
  }

  async loadTodayEntry(): Promise<Entry | null> {
    return this.loadEntryRow(todayISO());
  }

  async loadEntryForDate(dateISO: string): Promise<Entry | null> {
    return this.loadEntryRow(dateISO);
  }

  async loadMonthEntries(year: number, month: number): Promise<Entry[]> {
    const m = String(month).padStart(2, "0");
    const lastDay = new Date(year, month, 0).getDate();
    const start = `${year}-${m}-01`;
    const end = `${year}-${m}-${String(lastDay).padStart(2, "0")}`;
    const goalDefs = await this.loadGoalDefs();
    const tra = await this.cassettine.leggiTra(start, end);
    return [...tra.entries()].map(([g, c]) => this.contenutoToEntry(g, c, goalDefs));
  }

  async countEntries(): Promise<number> {
    const { chiuse, inChiaro } = await this.cassettine.conta();
    return chiuse + inChiaro;
  }

  async deleteEntry(dateISO: string): Promise<void> {
    await this.cassettine.cancella(dateISO);
  }

  private async modificaGiornata(
    dateISO: string,
    fn: (c: Contenuto, esisteva: boolean) => Contenuto,
  ): Promise<Entry> {
    const c = await this.cassettine.modifica(dateISO, fn);
    return this.contenutoToEntry(dateISO, c, await this.loadGoalDefs());
  }

  async saveProcessedEntry(
    dateISO: string,
    transcript: string,
    ai: AIFields,
    durationSeconds: number,
  ): Promise<Entry> {
    // `people` entra SOLO se l'analisi lo ha prodotto: assente vuol dire
    // "non toccare" (AIFields in store/types.ts). Il titolo scritto a mano
    // vince su qualunque rilettura (migration 012, ora dentro la busta).
    const e = await this.modificaGiornata(dateISO, (c) => ({
      ...c,
      transcript,
      snippet: ai.snippet,
      areas: ai.areas,
      headline: c.headlineLocked ? c.headline : ai.headline,
      people: ai.people ?? c.people,
      durationSeconds: durationSeconds || c.durationSeconds,
    }));
    return { ...e, durationSeconds };
  }

  async saveHeadline(dateISO: string, headline: string): Promise<Entry> {
    return this.modificaGiornata(dateISO, (c) => ({
      ...c,
      headline: headline.trim(),
      headlineLocked: true,
    }));
  }

  async saveAreas(dateISO: string, areas: AreaSummary[]): Promise<Entry> {
    return this.modificaGiornata(dateISO, (c) => ({ ...c, areas }));
  }

  async updateEntryTranscript(dateISO: string, text: string): Promise<Entry> {
    // NOTA (spec §2.2): la ri-elaborazione AI del transcript modificato NON
    // sta qui — la fa l'azione reprocessEntryTranscript (src/lib/actions).
    // Questo metodo salva e basta, preservando i campi AI esistenti.
    return this.modificaGiornata(dateISO, (c) => ({ ...c, transcript: text }));
  }

  async updateMetric(dateISO: string, patch: Partial<EntryMetrics>): Promise<Entry> {
    return this.modificaGiornata(dateISO, (c) => ({
      ...c,
      metrics: {
        weightKg: Object.prototype.hasOwnProperty.call(patch, "weightKg")
          ? (patch.weightKg ?? null)
          : c.metrics.weightKg,
        sleepHours: Object.prototype.hasOwnProperty.call(patch, "sleepHours")
          ? (patch.sleepHours ?? null)
          : c.metrics.sleepHours,
        mood: Object.prototype.hasOwnProperty.call(patch, "mood")
          ? (patch.mood ?? null)
          : c.metrics.mood,
      },
    }));
  }

  async toggleGoal(dateISO: string, label: string): Promise<Entry> {
    return this.modificaGiornata(dateISO, (c) => {
      const norm = label.toLowerCase();
      const has = c.goalsOn.some((x) => x.toLowerCase() === norm);
      return {
        ...c,
        goalsOn: has ? c.goalsOn.filter((x) => x.toLowerCase() !== norm) : [...c.goalsOn, label],
      };
    });
  }

  async saveEntryPeople(dateISO: string, people: string[]): Promise<Entry> {
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
    // Solo su una giornata che esiste: mai creare una riga vuota qui (BUG1).
    const c = await this.cassettine.leggi(dateISO);
    if (!c) return blankEntryShell(dateISO);
    return this.modificaGiornata(dateISO, (cc) => ({ ...cc, people: clean }));
  }

  /* ----------------- fatti (SPEC-fatti §3): dentro la busta ----------------- */

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
    // Si sostituiscono SOLO i fatti letti dall'AI per quel giorno: quelli
    // scritti a mano restano, sempre.
    const c = await this.cassettine.modifica(dateISO, (cc) => ({
      ...cc,
      facts: [
        ...cc.facts.filter((f) => f.origin === "manual"),
        ...facts.map((f) => Cassettine.fatto(dateISO, f)),
      ],
    }));
    return c.facts.map((f) => ({ ...f, entryDate: dateISO }));
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
    // Una casella sola puo contenere piu nomi (vedi dividiNomi): le righe
    // scritte prima del 31 agosto 2026 ne hanno uno e si leggono uguale.
    // Le righe nuove hanno tutto nella busta e l'impronta al posto
    // dell'alias (buste.ts); quelle vecchie si leggono dalle colonne.
    const out: Alias[] = [];
    for (const r of data as Record<string, unknown>[]) {
      const dentro = await apriRiga<{ alias: string; labelKeys: string[] }>(r.busta).catch(() => null);
      out.push({
        kind: String(r.kind) as Alias["kind"],
        alias: dentro ? dentro.alias : String(r.alias),
        labelKeys: dentro ? dentro.labelKeys : dividiNomi(String(r.label_key)),
      });
    }
    return out;
  }

  async saveAlias(alias: Alias): Promise<Alias[]> {
    const userId = await this.userId();
    const { error } = await this.supabase()
      .from("fact_aliases")
      .upsert(
        {
          user_id: userId,
          kind: alias.kind,
          alias: await improntaDi(alias.alias),
          label_key: "",
          busta: await chiudiRiga({ alias: alias.alias, labelKeys: alias.labelKeys }),
        },
        { onConflict: "user_id,kind,alias" },
      );
    if (error) throw new Error(error.message);
    // Se la stessa riga esisteva in chiaro (prima della cassaforte) ora e
    // un doppione: via.
    await this.supabase()
      .from("fact_aliases")
      .delete()
      .eq("user_id", userId)
      .eq("kind", alias.kind)
      .eq("alias", alias.alias);
    return this.loadAliases();
  }

  async loadExclusions(dateISO: string): Promise<DayExclusion[]> {
    const userId = await this.userId();
    const { data, error } = await this.supabase()
      .from("day_exclusions")
      .select("entry_date, kind, label_key")
      .eq("user_id", userId)
      .eq("entry_date", dateISO);
    // Se la lettura fallisce si mostra tutto: e meglio rivedere una persona
    // che avevi tolto, che una giornata che non si apre.
    if (error || !data) return [];
    const out: DayExclusion[] = [];
    for (const r of data as Record<string, unknown>[]) {
      const dentro = await apriRiga<{ labelKey: string }>(r.busta).catch(() => null);
      out.push({
        entryDate: String(r.entry_date),
        kind: String(r.kind) as DayExclusion["kind"],
        labelKey: dentro ? dentro.labelKey : String(r.label_key),
      });
    }
    return out;
  }

  async addExclusion(e: DayExclusion): Promise<void> {
    const userId = await this.userId();
    const { error } = await this.supabase()
      .from("day_exclusions")
      .upsert(
        {
          user_id: userId,
          entry_date: e.entryDate,
          kind: e.kind,
          label_key: await improntaDi(e.labelKey),
          busta: await chiudiRiga({ labelKey: e.labelKey }),
        },
        { onConflict: "user_id,entry_date,kind,label_key" },
      );
    if (error) throw new Error(error.message);
  }

  async removeExclusion(e: DayExclusion): Promise<void> {
    const userId = await this.userId();
    const { error } = await this.supabase()
      .from("day_exclusions")
      .delete()
      .eq("user_id", userId)
      .eq("entry_date", e.entryDate)
      .eq("kind", e.kind)
      // sia la riga nuova (impronta) sia una eventuale riga vecchia (in chiaro)
      .in("label_key", [await improntaDi(e.labelKey), e.labelKey]);
    if (error) throw new Error(error.message);
  }

  async loadOpenQuestions(): Promise<Domanda[]> {
    const userId = await this.userId();
    const { data, error } = await this.supabase()
      .from("open_questions")
      .select("*")
      .eq("user_id", userId)
      .is("risposta", null)
      // Le piu recenti per prime: si risponde meglio a un dubbio su ieri che
      // a uno su marzo, e chi si stanca a meta ha sistemato le cose fresche.
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: true });
    if (error || !data) return [];
    const out: Domanda[] = [];
    for (const r of data as Record<string, unknown>[]) out.push(await this.domandaAperta(r));
    return out;
  }

  /** Una domanda dalla riga: dalla busta se c'e, altrimenti dalle colonne. */
  private async domandaAperta(r: Record<string, unknown>): Promise<Domanda> {
    const dentro = await apriRiga<Partial<Domanda> & { risposta?: string | null }>(r.busta).catch(() => null);
    if (!dentro) return domandaRow(r);
    return domandaRow({ ...r, ...dentro, opzioni: dentro.opzioni ?? [] });
  }

  async saveOpenQuestions(dateISO: string, domande: Domanda[]): Promise<void> {
    const userId = await this.userId();
    const supabase = this.supabase();

    // Le domande di questa giornata ancora aperte si buttano e si rifanno:
    // il testo e cambiato, e i dubbi di prima potrebbero non esserlo piu.
    // Quelle gia RISPOSTE restano dove sono, e non si riaprono.
    const { error: delErr } = await supabase
      .from("open_questions")
      .delete()
      .eq("user_id", userId)
      .eq("entry_date", dateISO)
      .is("risposta", null);
    if (delErr) throw new Error(delErr.message);

    if (domande.length === 0) return;

    const { data: decise } = await supabase
      .from("open_questions")
      .select("azione, soggetto_key")
      .eq("user_id", userId)
      .eq("entry_date", dateISO)
      .not("risposta", "is", null);
    // Le righe decise portano l'impronta (nuove) o la chiave in chiaro
    // (vecchie): si confrontano tutte e due.
    const giaDeciso = new Set(
      ((decise as Record<string, unknown>[]) ?? []).map(
        (r) => `${r.azione}|${r.soggetto_key}`,
      ),
    );

    const righe: Record<string, unknown>[] = [];
    for (const d of domande) {
      const chiara = chiaveAlias(d.soggetto);
      const impr = await improntaDi(chiara);
      if (giaDeciso.has(`${d.azione}|${chiara}`) || giaDeciso.has(`${d.azione}|${impr}`)) continue;
      righe.push({
        user_id: userId,
        entry_date: dateISO,
        specie: d.specie,
        azione: d.azione,
        soggetto: "",
        soggetto_key: impr,
        citazione: "",
        testo: "",
        perche: "",
        opzioni: [],
        libero: d.libero,
        busta: await chiudiRiga({
          soggetto: d.soggetto,
          citazione: d.citazione,
          testo: d.testo,
          perche: d.perche,
          opzioni: d.opzioni,
        }),
      });
    }
    if (righe.length === 0) return;

    const { error } = await supabase
      .from("open_questions")
      .upsert(righe, { onConflict: "user_id,entry_date,azione,soggetto_key" });
    if (error) throw new Error(error.message);
  }

  async answerQuestion(id: string, risposta: string | null): Promise<void> {
    const userId = await this.userId();
    const supabase = this.supabase();
    // La risposta e contenuto: va nella busta. La colonna `risposta` resta
    // solo come marcatore "e stata risposta" (i filtri is null / not null
    // continuano a funzionare senza leggere niente).
    const { data: riga } = await supabase
      .from("open_questions")
      .select("busta")
      .eq("user_id", userId)
      .eq("id", id)
      .maybeSingle();
    const dentro = (await apriRiga<Record<string, unknown>>((riga as { busta?: unknown } | null)?.busta).catch(() => null)) ?? {};
    // Una domanda saltata resta aperta: "non adesso" non e "mai piu".
    // Solo "non saprei" e una risposta, e si scrive come tale.
    const vera = risposta ?? "non-saprei";
    const patch: Record<string, unknown> = {
      risposta: "nella-busta",
      answered_at: new Date().toISOString(),
      busta: await chiudiRiga({ ...dentro, risposta: vera }),
    };
    const { error } = await supabase
      .from("open_questions")
      .update(patch)
      .eq("user_id", userId)
      .eq("id", id);
    if (error) throw new Error(error.message);
  }

  async loadQuestionDates(): Promise<string[]> {
    const userId = await this.userId();
    const { data, error } = await this.supabase()
      .from("open_questions")
      .select("entry_date")
      .eq("user_id", userId);
    if (error || !data) return [];
    return [
      ...new Set((data as Record<string, unknown>[]).map((r) => String(r.entry_date))),
    ];
  }

  async loadFactsForDate(dateISO: string): Promise<Fact[]> {
    const c = await this.cassettine.leggi(dateISO);
    return (c?.facts ?? []).map((f) => ({ ...f, entryDate: dateISO }));
  }

  async loadFactsForMonth(year: number, month: number): Promise<Fact[]> {
    const m = String(month).padStart(2, "0");
    const lastDay = new Date(year, month, 0).getDate();
    const tra = await this.cassettine.leggiTra(
      `${year}-${m}-01`,
      `${year}-${m}-${String(lastDay).padStart(2, "0")}`,
    );
    const out: Fact[] = [];
    for (const [g, c] of tra) for (const f of c.facts) out.push({ ...f, entryDate: g });
    return out;
  }

  async loadKnownLabels(limit = 120): Promise<string[]> {
    // Le etichette che uno usa davvero ricompaiono spesso: bastano gli
    // ultimi tre mesi di giornate (non c'e piu una tabella da interrogare,
    // i fatti stanno nelle buste).
    const oggi = todayISO();
    const da = new Date(oggi);
    da.setDate(da.getDate() - 92);
    const tra = await this.cassettine.leggiTra(da.toISOString().slice(0, 10), oggi);
    const conteggio = new Map<string, number>();
    for (const c of tra.values()) {
      for (const f of c.facts) {
        const k = (f.labelKey ?? "").trim();
        if (!k) continue;
        conteggio.set(k, (conteggio.get(k) ?? 0) + 1);
      }
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
      .select("id, text, kind, source, source_entry_id, created_at, busta")
      .order("created_at", { ascending: false });
    if (!data) return [];
    const out: Remember[] = [];
    for (const d of data.filter((d) => VALID_KINDS.has(d.kind as RememberKind))) {
      const dentro = await apriRiga<{ text: string }>(d.busta).catch(() => null);
      out.push({
        id: d.id as string,
        text: dentro ? dentro.text : (d.text as string),
        kind: d.kind as RememberKind,
        source: VALID_SOURCES.has(d.source as RememberSource)
          ? (d.source as RememberSource)
          : "manual",
        sourceEntryId: (d.source_entry_id as string | null) ?? null,
        createdAt: d.created_at as string,
      });
    }
    return out;
  }

  async addRemember(text: string, kind: RememberKind): Promise<Remember> {
    const clean = text.trim();
    if (!clean) throw new Error("Text required");
    const userId = await this.userId();
    const { data, error } = await this.supabase()
      .from("remembers")
      .insert({
        user_id: userId,
        text: "",
        busta: await chiudiRiga({ text: clean }),
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
      .select("text, busta")
      .eq("kind", "persona")
      .order("created_at", { ascending: false });
    if (!data) return [];
    const seen = new Set<string>();
    const names: string[] = [];
    for (const d of data) {
      const dentro = await apriRiga<{ text: string }>(d.busta).catch(() => null);
      const grezzo = dentro ? dentro.text : d.text;
      const t = typeof grezzo === "string" ? grezzo.trim() : "";
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
    const rows: Record<string, unknown>[] = [];
    for (const text of toInsert) {
      rows.push({
        user_id: userId,
        text: "",
        busta: await chiudiRiga({ text }),
        kind: "persona" as const,
        source: "extracted" as const,
        // Le giornate sono cassettine senza uuid: il legame alla giornata
        // d'origine non si scrive piu (era un `on delete set null`).
        source_entry_id: sourceEntryId && !sourceEntryId.startsWith("c:") ? sourceEntryId : null,
      });
    }
    const { error } = await this.supabase().from("remembers").insert(rows);
    if (error) throw new Error(error.message);
    return toInsert;
  }

  /* ----------------- recaps ----------------- */

  async loadRecaps(): Promise<Recap[]> {
    const { data } = await this.supabase()
      .from("recaps")
      .select(
        "id, period_type, period_start, period_end, title, snippet, body, generated_at, busta",
      )
      .order("period_start", { ascending: false });
    if (!data) return [];
    const out: Recap[] = [];
    for (const d of data) {
      const dentro = await apriRiga<{ title: string; snippet: string; body: string }>(d.busta).catch(() => null);
      out.push({
        id: d.id as string,
        periodType: d.period_type as RecapPeriod,
        periodStart: d.period_start as string,
        periodEnd: d.period_end as string,
        title: dentro ? dentro.title : (d.title as string),
        snippet: dentro ? dentro.snippet : (d.snippet as string),
        body: dentro ? dentro.body : (d.body as string),
        generatedAt: d.generated_at as string,
      });
    }
    return out;
  }

  async updateRecap(
    id: string,
    patch: { title?: string; snippet?: string; body?: string },
  ): Promise<Recap> {
    // Si legge la riga (busta o colonne), si applica la modifica, si
    // riscrive TUTTO nella busta: da qui in poi le colonne restano vuote.
    const corrente = (await this.loadRecaps()).find((r) => r.id === id);
    if (!corrente) throw new Error("Recap non trovato");
    const nuovo = {
      title: patch.title ?? corrente.title,
      snippet: patch.snippet ?? corrente.snippet,
      body: patch.body ?? corrente.body,
    };
    const { error } = await this.supabase()
      .from("recaps")
      .update({ title: "", snippet: "", body: "", busta: await chiudiRiga(nuovo) })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ...corrente, ...nuovo };
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
          title: "",
          snippet: "",
          body: "",
          busta: await chiudiRiga({ title: input.title, snippet: input.snippet, body: input.body }),
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
    const goalDefs = await this.loadGoalDefs();
    const tutte = await this.cassettine.leggiTutte();
    return [...tutte.entries()].map(([g, c]) => this.contenutoToEntry(g, c, goalDefs));
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
    // l'esistente sia vuoto. Gli id non si trasportano. Ogni giornata
    // importata entra direttamente nella cassaforte.
    for (const e of file.entries ?? []) {
      if (!e?.entryDate) continue;
      const existing = await this.cassettine.leggi(e.entryDate);
      if (existing && existing.transcript.trim().length > 0) {
        report.entries.skipped++;
        continue;
      }
      await this.cassettine.modifica(e.entryDate, (c) => ({
        ...c,
        transcript: e.transcript ?? "",
        headline: e.headline ?? null,
        snippet: e.snippet ?? null,
        areas: e.areas ?? [],
        metrics: {
          weightKg: e.metrics?.weightKg ?? null,
          sleepHours: e.metrics?.sleepHours ?? null,
          mood: e.metrics?.mood ?? null,
        },
        goalsOn: (e.goals ?? []).filter((g) => g.on).map((g) => g.label),
        people: e.people ?? [],
        headlineLocked: e.headlineLocked === true,
        createdAt: e.createdAt ?? c.createdAt,
      }));
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

/** Da riga del database a domanda. Gli opzioni sono jsonb: si difendono. */
function domandaRow(r: Record<string, unknown>): Domanda {
  const opzioni = Array.isArray(r.opzioni)
    ? (r.opzioni as Record<string, unknown>[]).map((o) => ({
        valore: String(o.valore ?? ""),
        etichetta: String(o.etichetta ?? o.valore ?? ""),
        sotto: String(o.sotto ?? ""),
        nomeVero: String(o.nomeVero ?? ""),
      }))
    : [];
  return {
    id: String(r.id),
    entryDate: String(r.entry_date),
    specie: r.specie === "identita" ? "identita" : "episodio",
    azione: String(r.azione) as Domanda["azione"],
    soggetto: String(r.soggetto ?? ""),
    citazione: String(r.citazione ?? ""),
    testo: String(r.testo ?? ""),
    perche: String(r.perche ?? ""),
    opzioni,
    libero: r.libero === true,
  };
}
