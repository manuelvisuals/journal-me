import type {
  AreaSummary,
  Fact,
  Entry,
  EntryMetrics,
  GoalDef,
  NewFact,
  Recap,
  Remember,
  RememberKind,
} from "@/lib/types";

/**
 * Il contratto dei dati (SPEC-v2 §2.2): un'interfaccia, due implementazioni
 * (CloudStore ora, LocalStore con la PR 3), una factory.
 *
 * Le funzioni pubbliche storiche di src/lib/data/* restano al loro posto con
 * nome e firma invariati (primo parametro `_mode` compreso) e diventano
 * wrapper sottili sopra lo store: nessun call-site cambia comportamento.
 *
 * NON stanno qui, per scelta: `saveRecording` e `generateAndSaveRecap`.
 * Non sono accesso ai dati ma orchestrazione che chiama /api/* — vivono in
 * src/lib/actions/ e controllano can() prima di partire. E li che la regola
 * "in locale nemmeno una richiesta di rete" si difende davvero.
 */

export type StorageMode = "local" | "cloud";

/** I campi prodotti dall'AI (o dal fallback) per una giornata. */
export type AIFields = {
  headline: string;
  snippet: string;
  areas: AreaSummary[];
  /**
   * Le persone nominate nel testo, lette dallo stesso testo completo del
   * riassunto (decisione di Manuel del 21 agosto 2026: "il testo di tutta la
   * giornata e king").
   *
   * ASSENTE (undefined) significa NON TOCCARE quelle salvate, e non "nessuna
   * persona". La differenza e tutto: una lettura andata storta, che torna
   * vuota su un testo pieno di nomi, non deve poter cancellare la lista
   * buona di ieri. Lista vuota esplicita, invece, e una risposta vera:
   * quel testo non nomina nessuno.
   */
  people?: string[];
  /**
   * I fatti letti dallo stesso testo (SPEC-fatti §4). Assente = non letti,
   * e vale la stessa regola di `people`: non si tocca cio che e salvato.
   *
   * Non li scrive `saveProcessedEntry`: i fatti hanno una tabella loro e
   * vogliono l'id della giornata, che esiste solo DOPO il salvataggio.
   * Li scrive saveRecording, subito dopo, con `replaceAiFacts`.
   */
  facts?: NewFact[];
};

export interface JournalStore {
  readonly mode: StorageMode;

  /* entries */
  loadTodayEntry(): Promise<Entry | null>;
  loadEntryForDate(dateISO: string): Promise<Entry | null>;
  loadMonthEntries(year: number, month: number): Promise<Entry[]>;
  /**
   * Tutte le giornate, dalla piu vecchia alla piu recente.
   *
   * Serve alla Scheda Persona (src/lib/data/people.ts): "quando ho visto
   * Christian l'ultima volta" non e una domanda su un mese, e una domanda su
   * tutta la storia. Esisteva gia dentro tutti e due gli store per il
   * backup: qui diventa pubblica invece di essere riscritta una seconda
   * volta con un nome diverso.
   */
  loadAllEntries(): Promise<Entry[]>;
  /** Quante giornate esistono (per il banner backup e i testi "N giornate"). */
  countEntries(): Promise<number>;
  deleteEntry(dateISO: string): Promise<void>;
  updateEntryTranscript(dateISO: string, text: string): Promise<Entry>;
  updateMetric(dateISO: string, patch: Partial<EntryMetrics>): Promise<Entry>;
  toggleGoal(dateISO: string, label: string): Promise<Entry>;
  saveEntryPeople(dateISO: string, people: string[]): Promise<Entry>;
  /**
   * La primitiva di persistenza usata dall'azione saveRecording: salva una
   * giornata gia elaborata (upsert per data, transcript completo + campi AI).
   * Non e nell'elenco della spec §2.2, ed e un'aggiunta necessaria: senza,
   * l'azione dovrebbe scrivere su Supabase in proprio e lo store non sarebbe
   * l'unico punto di accesso ai dati.
   */
  saveProcessedEntry(
    dateISO: string,
    transcript: string,
    ai: AIFields,
    durationSeconds: number,
  ): Promise<Entry>;

  /* fatti (SPEC-fatti.md §3) */

  /**
   * Rifa i fatti 'ai' di una giornata: cancella quelli vecchi e scrive i
   * nuovi, in un colpo solo.
   *
   * PERCHE CANCELLA PRIMA. Il testo della giornata e l'unica autorita
   * (decisione del 21 agosto 2026): se una frase sparisce dal racconto, il
   * fatto che ne derivava deve sparire con lei, o i conteggi raccontano una
   * giornata che non esiste piu.
   *
   * PERCHE SOLO GLI 'ai'. Quelli scritti a mano dall'utente non si toccano:
   * un'AI non cancella cio che ha scritto una persona.
   */
  replaceAiFacts(dateISO: string, facts: NewFact[]): Promise<Fact[]>;
  loadFactsForDate(dateISO: string): Promise<Fact[]>;
  /** Per i conteggi: tutti i fatti di un mese. */
  loadFactsForMonth(year: number, month: number): Promise<Fact[]>;
  /**
   * Le etichette che questo utente usa gia, dalla piu frequente. Si passano
   * al modello perche le RIUSI invece di inventarne di simili: e meta della
   * normalizzazione, e senza, "panca" e "panca piana" restano due cose.
   */
  loadKnownLabels(limit?: number): Promise<string[]>;

  /* goals */
  loadGoalDefs(): Promise<GoalDef[]>;
  addGoal(label: string): Promise<GoalDef>;
  removeGoal(id: string): Promise<void>;

  /* remembers */
  loadRemembers(): Promise<Remember[]>;
  addRemember(text: string, kind: RememberKind): Promise<Remember>;
  deleteRemember(id: string): Promise<void>;
  updateRememberKind(id: string, kind: RememberKind): Promise<void>;
  loadPersonaNames(): Promise<string[]>;
  addPersonas(names: string[], sourceEntryId?: string | null): Promise<string[]>;

  /* recaps */
  loadRecaps(): Promise<Recap[]>;
  updateRecap(
    id: string,
    patch: { title?: string; snippet?: string; body?: string },
  ): Promise<Recap>;
  /** Persistenza usata dall'azione generateAndSaveRecap (upsert per periodo). */
  saveRecap(input: {
    periodType: Recap["periodType"];
    periodStart: string;
    periodEnd: string;
    title: string;
    snippet: string;
    body: string;
  }): Promise<Recap>;

  /* backup (SPEC-v2 §4) */
  exportAll(): Promise<BackupFile>;
  importAll(file: BackupFile): Promise<ImportReport>;
}

/* ------------------------------------------------------------------ */
/* Backup v1 (SPEC-v2 §4.1)                                            */
/* ------------------------------------------------------------------ */

export const BACKUP_FORMAT = "journal.me/backup" as const;
export const BACKUP_VERSION = 1 as const;
export const APP_VERSION = "0.6.0";

/**
 * Un solo JSON, leggibile fra dieci anni. Gli oggetti negli array sono
 * ESATTAMENTE i tipi di src/lib/types.ts, nessuna trasformazione. Gli id non
 * si trasportano: in import vengono rigenerati e `sourceEntryId` azzerato
 * (il backup v1 non trasporta il legame entry-remember, vedi §4.3).
 */
export type BackupFile = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  source: { mode: StorageMode; app: string };
  counts: { entries: number; goals: number; remembers: number; recaps: number };
  entries: Entry[];
  goals: GoalDef[];
  remembers: Remember[];
  recaps: Recap[];
};

/** Strategia merge, mai replace: il report dice cosa e successo davvero. */
export type ImportReport = {
  entries: { added: number; skipped: number };
  goals: { added: number; skipped: number };
  remembers: { added: number; skipped: number };
  recaps: { added: number; skipped: number };
};
