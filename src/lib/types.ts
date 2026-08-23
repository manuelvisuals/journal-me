/**
 * Domain types for Journal.me.
 * Kept minimal — only what the UI actually consumes today.
 */

export type Mood = "great" | "good" | "neutral" | "low" | "bad";

export type GoalDot = {
  id: string;
  label: string;
  on: boolean;
};

export type AreaSummary = {
  label: string;
  text: string;
};

export type EntryMetrics = {
  /** Body weight in kg. */
  weightKg: number | null;
  /** Sleep duration in fractional hours (7.2 = 7h 12). */
  sleepHours: number | null;
  /** Mood emoji bucket. */
  mood: Mood | null;
};

export type Entry = {
  id: string;
  /** YYYY-MM-DD in local timezone. */
  entryDate: string;
  /** Raw transcript text, source of truth. */
  transcript: string;
  /** Approximate duration of the recording, in seconds. */
  durationSeconds: number;
  /** AI-generated headline (or placeholder for MVP). */
  headline: string | null;
  /** AI-generated short snippet (or first sentence for MVP). */
  snippet: string | null;
  /** Macro-area summaries (Lavoro / Relazioni / Corpo / ...). */
  areas: AreaSummary[];
  /** Metric snapshot at the time of the entry. */
  metrics: EntryMetrics | null;
  /** Goal-dot state at the time of the entry. */
  goals: GoalDot[];
  /** Names of people related to this day (Social section). */
  people: string[];
  /**
   * Il titolo l'ha scritto l'utente: nessuna rielaborazione AI lo tocca.
   * Deciso il 22 agosto 2026, e senza strada indietro dall'app: se lo
   * scrivi, e tuo.
   */
  headlineLocked?: boolean;
  /** ISO timestamp of when the entry was saved. */
  createdAt: string;
};

/** A configurable micro-goal definition (lives in the `goals` table). */
export type GoalDef = {
  id: string;
  label: string;
  isAiSuggested: boolean;
};

export type RecapPeriod = "month" | "semester" | "year";

export type Recap = {
  id: string;
  periodType: RecapPeriod;
  /** YYYY-MM-DD inclusive. */
  periodStart: string;
  periodEnd: string;
  title: string;
  snippet: string;
  body: string;
  generatedAt: string;
};

export type RememberKind =
  | "persona"
  | "todo"
  | "nota"
  | "luogo"
  | "idea";

export type RememberSource = "manual" | "extracted";

export type Remember = {
  id: string;
  text: string;
  kind: RememberKind;
  source: RememberSource;
  sourceEntryId: string | null;
  createdAt: string;
};

/**
 * Un FATTO: un giorno, un tipo, un'etichetta (SPEC-fatti.md §3).
 *
 * "Pizza", "panca piana" e "Christian" sono la stessa struttura con `kind`
 * diverso. E cio che permette di rispondere a "quante volte ho mangiato la
 * pizza a maggio" senza aggiungere una tabella per argomento.
 */
export type FactKind = "cibo" | "attivita" | "persona" | "lavoro" | "luogo";

/**
 * Un soprannome, e la cosa che sta dietro.
 *
 * Nel racconto dici "mio fratello", "da Charlie", "in palestra". L'AI non
 * puo sapere da sola chi sia tuo fratello, ne che "da Charlie" sia un
 * ristorante e non un amico: sono cose che sai solo tu. Quando te lo chiede
 * e rispondi, la risposta finisce qui e non te la chiede mai piu.
 *
 * Il racconto NON viene mai riscritto: continua a dire "mio fratello". Il
 * soprannome si applica quando si MOSTRA, quindi vale anche sulle giornate
 * di marzo, senza migrare niente.
 */
export type Alias = {
  /** Di che specie e la cosa vera: una persona, un luogo, un cibo... */
  kind: FactKind;
  /** Come lo dici tu, gia normalizzato in minuscolo senza accenti. */
  alias: string;
  /** Chi o cosa e davvero, nella grafia da mostrare: "Daniele". */
  labelKey: string;
};

export type Fact = {
  id: string;
  /** YYYY-MM-DD */
  entryDate: string;
  kind: FactKind;
  /** Come l'hai detto tu: "una margherita da Gino". Si mostra questa. */
  label: string;
  /** La forma con cui si conta: "pizza". Vedi SPEC-fatti §3.3. */
  labelKey: string;
  /** Quello che e stato detto e nient'altro: minuti, serie, pasto. */
  attrs: Record<string, unknown>;
  /** 0..1. Sotto soglia il fatto chiede conferma invece di contare zitto. */
  confidence: number | null;
  /**
   * 'manual' e cio che hai scritto tu. Una rilettura del testo rifa i fatti
   * 'ai' del giorno e non tocca mai i 'manual'.
   */
  origin: "ai" | "manual";
};

/** Un fatto appena letto dal testo, prima di avere un id. */
export type NewFact = Omit<Fact, "id" | "entryDate">;
