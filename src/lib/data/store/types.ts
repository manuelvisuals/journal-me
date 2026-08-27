import type {
  Alias,
  DayExclusion,
  Domanda,
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
  /**
   * Le misure del risveglio dette ESPLICITAMENTE nel racconto (Manuel, 27
   * agosto 2026): peso in kg, ore esatte di sonno, umore al risveglio.
   *
   * Dentro ogni campo, null = "il testo non lo dice" e NON TOCCA il valore
   * salvato: solo un valore vero compila (o aggiorna) il campo dell'app.
   * Il testo e king anche qui: se dici il peso a voce, il numero detto
   * vince su quello inserito a mano.
   *
   * Come i fatti, non le scrive `saveProcessedEntry`: le applica
   * saveRecording con `updateMetric`, dopo il salvataggio.
   */
  metrics?: Partial<EntryMetrics>;
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
  /**
   * Scrive il titolo a mano e lo blocca: da qui in poi nessuna
   * rielaborazione AI lo sovrascrive (vedi Entry.headlineLocked).
   */
  saveHeadline(dateISO: string, headline: string): Promise<Entry>;

  /**
   * Riscrive SOLO le aree di una giornata, senza rileggere il testo.
   *
   * Serve alle risposte ai chiarimenti (src/lib/chiarimenti.ts): quando dici
   * che la piscina di oggi era stare con gli amici, la giornata non va
   * rianalizzata — si sa gia dove mettere quella riga, e rianalizzare
   * cambierebbe anche cose che non avevi chiesto di cambiare.
   */
  saveAreas(dateISO: string, areas: AreaSummary[]): Promise<Entry>;
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

  /* fatti (src/modules/oggi/SPEC-fatti.md §3) */

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

  /* soprannomi (fact_aliases, migrazione 011) */

  /**
   * I soprannomi gia chiariti: "mio fratello" e Daniele, "da Charlie" e un
   * posto. Si leggono per DUE motivi, e servono tutti e due:
   *   1. per mostrare il nome vero al posto del soprannome, ovunque;
   *   2. per passarli al modello, che cosi non richiede una cosa gia decisa.
   */
  loadAliases(): Promise<Alias[]>;
  /**
   * Scrive un soprannome chiarito. Se esisteva gia, lo sostituisce: cambiare
   * idea su chi sia "mio fratello" deve essere possibile.
   */
  saveAlias(alias: Alias): Promise<Alias[]>;

  /* cose tolte a mano da una giornata (migrazione 013) */

  /**
   * Cosa hai tolto da questa giornata. Si legge insieme alle persone e ai
   * luoghi e si applica quando si MOSTRA: cosi la rilettura del testo, che
   * rifa tutto da zero, non puo rimettere dentro cio che avevi tolto.
   */
  loadExclusions(dateISO: string): Promise<DayExclusion[]>;
  /** Toglie una persona o un luogo da una giornata. */
  addExclusion(e: DayExclusion): Promise<void>;
  /** Ci ripensa: la rimette. */
  removeExclusion(e: DayExclusion): Promise<void>;

  /* le domande dell'AI, in coda (migrazione 014) */

  /**
   * Tutte le domande ANCORA APERTE, di tutte le giornate.
   *
   * Si legge tutto il diario e non solo il giorno di oggi perche la regola e
   * questa: ogni volta che l'AI elabora qualcosa, chiede anche l'arretrato.
   * Una domanda saltata torna; una risposta data non torna mai.
   */
  loadOpenQuestions(): Promise<Domanda[]>;
  /**
   * Mette in coda le domande nate dall'analisi di una giornata.
   *
   * Le domande gia RISPOSTE per quella giornata non si riaprono: e cio che
   * impedisce alla stessa domanda di episodio ("la piscina di oggi era sport
   * o compagnia?") di tornare a ogni rilettura del testo.
   */
  saveOpenQuestions(dateISO: string, domande: Domanda[]): Promise<void>;
  /** Segna una domanda come decisa. `risposta` null = "non saprei", che e una risposta. */
  answerQuestion(id: string, risposta: string | null): Promise<void>;
  /**
   * Le giornate su cui l'AI ha gia detto la sua, con una domanda o con un
   * silenzio. Serve alla scansione dell'archivio per riprendere da dove si
   * era fermata invece di ricominciare da capo, che costerebbe due volte.
   */
  loadQuestionDates(): Promise<string[]>;

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
