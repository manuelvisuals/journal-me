/**
 * Le cassettine: una giornata = una busta chiusa a chiave sul dispositivo
 * (SPEC ospite-e-cassaforte, R6 R7, §6-bis; migration 021).
 *
 * Questo file e l'UNICO punto in cui una giornata cloud viene chiusa e
 * aperta. CloudStore gli delega tutto cio che riguarda `entries` e `facts`:
 * le schermate non sanno che esiste una chiave (SPEC §8), e CloudStore sa
 * solo che chiede e riceve `Contenuto`.
 *
 * Dentro la busta sta TUTTO il contenuto del giorno: testo, titolo, sintesi,
 * aree, persone, misure, obiettivi accesi, durata, e i fatti estratti. Fuori,
 * in chiaro, solo cio che il server usa senza guardare dentro: utente,
 * giorno, versione, peso, date.
 *
 * Il numero di versione (R7): ogni scrittura e "leggi (v), modifica, scrivi
 * con v attesa". Se il server risponde `versione_superata` qualcun altro ha
 * scritto nel frattempo: si rilegge, e si lancia ConflittoVersione con le
 * DUE versioni. Non si sceglie da soli, non si cancella niente: decide la
 * persona (modulo oggi, foglio del conflitto).
 *
 * Le giornate ancora in chiaro (R12): se per un giorno non c'e cassettina ma
 * c'e una riga in `entries`, si legge quella. Alla PRIMA scrittura su quel
 * giorno la riga in chiaro entra nella cassettina e viene cancellata (con i
 * suoi fatti): il passaggio esplicito di Impostazioni fa lo stesso, per
 * tutte le giornate, in fila.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { chiavi } from "@/lib/cassaforte";
import {
  apri,
  bustaDaTesto,
  chiudi,
  testoDaBusta,
  BustaNonApribile,
} from "@/lib/cassaforte/serratura";
import type { AreaSummary, EntryMetrics, Fact, NewFact } from "@/lib/types";

/** Cio che sta dentro una busta. Campi stabili: si aggiunge, non si rinomina. */
export type Contenuto = {
  transcript: string;
  headline: string | null;
  snippet: string | null;
  areas: AreaSummary[];
  people: string[];
  metrics: EntryMetrics;
  goalsOn: string[];
  headlineLocked: boolean;
  durationSeconds: number;
  facts: FattoChiuso[];
  createdAt: string;
};

/** Un fatto dentro la busta: come Fact, senza entryDate (e il giorno della busta). */
export type FattoChiuso = Omit<Fact, "entryDate">;

export type Cassettina = {
  giorno: string;
  v: number;
  contenuto: Contenuto;
  updatedAt: string;
};

export function contenutoVuoto(createdAt = new Date().toISOString()): Contenuto {
  return {
    transcript: "",
    headline: null,
    snippet: null,
    areas: [],
    people: [],
    metrics: { weightKg: null, sleepHours: null, mood: null },
    goalsOn: [],
    headlineLocked: false,
    durationSeconds: 0,
    facts: [],
    createdAt,
  };
}

/** Il conflitto di versione (R7): le due versioni, e nessuna scelta automatica. */
export class ConflittoVersione extends Error {
  readonly giorno: string;
  /** Cio che questo dispositivo voleva scrivere. */
  readonly mia: Contenuto;
  /** Cio che sta sul server, scritto altrove. */
  readonly loro: Cassettina;
  constructor(giorno: string, mia: Contenuto, loro: Cassettina) {
    super(`La giornata ${giorno} e stata modificata altrove`);
    this.name = "ConflittoVersione";
    this.giorno = giorno;
    this.mia = mia;
    this.loro = loro;
  }
}

/**
 * Chi vuole sapere di un conflitto appena nasce (il foglio del modulo oggi)
 * si registra qui: la cassettina lo avvisa PRIMA di lanciare l'errore, cosi
 * qualunque scrittura, da qualunque schermata, apre lo stesso foglio.
 */
const ascoltatoriConflitto = new Set<(c: ConflittoVersione) => void>();
export function suConflitto(cb: (c: ConflittoVersione) => void): () => void {
  ascoltatoriConflitto.add(cb);
  return () => ascoltatoriConflitto.delete(cb);
}

export function eConflittoVersione(e: unknown): e is ConflittoVersione {
  return e instanceof ConflittoVersione || (e as { name?: string })?.name === "ConflittoVersione";
}

type RigaCassettina = {
  giorno: string;
  v: number;
  busta: string;
  updated_at: string;
  created_at: string;
};

/** La riga in chiaro di `entries`, letta da CloudStore (R12). */
export type RigaInChiaro = {
  id: string;
  contenuto: Contenuto;
};

export type Ripiego = {
  /** La riga in chiaro per un giorno, o null. */
  leggiInChiaro(giorno: string): Promise<RigaInChiaro | null>;
  /** Le righe in chiaro di un intervallo (estremi inclusi). */
  leggiInChiaroTra(da: string, a: string): Promise<Map<string, RigaInChiaro>>;
  /** Cancella la riga in chiaro e i suoi fatti: e entrata nella cassettina. */
  cancellaInChiaro(giorno: string): Promise<void>;
};

function nuovoId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export class Cassettine {
  constructor(
    private readonly sb: () => SupabaseClient,
    private readonly userId: () => Promise<string>,
    private readonly ripiego: Ripiego,
  ) {}

  private async apriRiga(r: RigaCassettina): Promise<Cassettina> {
    const b = bustaDaTesto(r.busta);
    if (!b) throw new BustaNonApribile("Cassettina senza busta");
    const contenuto = await apri<Partial<Contenuto>>(chiavi().aes, b);
    return {
      giorno: r.giorno,
      v: r.v,
      contenuto: { ...contenutoVuoto(r.created_at), ...contenuto },
      updatedAt: r.updated_at,
    };
  }

  /** La cassettina di un giorno (senza ripiego). */
  async leggiCassettina(giorno: string): Promise<Cassettina | null> {
    const { data, error } = await this.sb()
      .from("cassettine")
      .select("giorno, v, busta, updated_at, created_at")
      .eq("giorno", giorno)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return this.apriRiga(data as RigaCassettina);
  }

  /** Il contenuto di un giorno: cassettina, altrimenti riga in chiaro, altrimenti null. */
  async leggi(giorno: string): Promise<Contenuto | null> {
    const c = await this.leggiCassettina(giorno);
    if (c) return c.contenuto;
    const chiara = await this.ripiego.leggiInChiaro(giorno);
    return chiara?.contenuto ?? null;
  }

  /** I contenuti di un intervallo (estremi inclusi), giorno -> contenuto, dal piu recente. */
  async leggiTra(da: string, a: string): Promise<Map<string, Contenuto>> {
    const { data, error } = await this.sb()
      .from("cassettine")
      .select("giorno, v, busta, updated_at, created_at")
      .gte("giorno", da)
      .lte("giorno", a)
      .order("giorno", { ascending: false });
    if (error) throw new Error(error.message);
    const out = new Map<string, Contenuto>();
    const aperte = await Promise.all(
      ((data ?? []) as RigaCassettina[]).map((r) => this.apriRiga(r)),
    );
    for (const c of aperte) out.set(c.giorno, c.contenuto);
    const chiare = await this.ripiego.leggiInChiaroTra(da, a);
    for (const [g, r] of chiare) if (!out.has(g)) out.set(g, r.contenuto);
    return new Map([...out.entries()].sort((x, y) => (x[0] < y[0] ? 1 : -1)));
  }

  /** Tutti i contenuti, dal piu vecchio (backup). */
  async leggiTutte(): Promise<Map<string, Contenuto>> {
    const tutte = await this.leggiTra("0001-01-01", "9999-12-31");
    return new Map([...tutte.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1)));
  }

  async conta(): Promise<{ chiuse: number; inChiaro: number }> {
    const sb = this.sb();
    const [c, e] = await Promise.all([
      sb.from("cassettine").select("giorno", { count: "exact", head: true }),
      sb.from("entries").select("id", { count: "exact", head: true }),
    ]);
    return { chiuse: c.count ?? 0, inChiaro: e.count ?? 0 };
  }

  private async chiama(giorno: string, vAttesa: number, contenuto: Contenuto): Promise<number> {
    const busta = testoDaBusta(await chiudi(chiavi().aes, contenuto));
    const { data, error } = await this.sb().rpc("salva_cassettina", {
      p_giorno: giorno,
      p_v_attesa: vAttesa,
      p_busta: busta,
    });
    if (error) {
      if (/versione_superata/.test(error.message)) {
        const loro = await this.leggiCassettina(giorno);
        if (loro) {
          const c = new ConflittoVersione(giorno, contenuto, loro);
          for (const a of ascoltatoriConflitto) a(c);
          throw c;
        }
      }
      throw new Error(error.message);
    }
    return typeof data === "number" ? data : vAttesa + 1;
  }

  /**
   * Legge, modifica, scrive con la versione attesa. `modifica` riceve il
   * contenuto corrente (o un contenuto vuoto se il giorno non esiste) e
   * restituisce quello nuovo. Se il giorno era ancora in chiaro, entra nella
   * cassettina e la riga in chiaro sparisce.
   */
  async modifica(
    giorno: string,
    modifica: (corrente: Contenuto, esisteva: boolean) => Contenuto,
  ): Promise<Contenuto> {
    const c = await this.leggiCassettina(giorno);
    if (c) {
      const nuovo = modifica(c.contenuto, true);
      await this.chiama(giorno, c.v, nuovo);
      return nuovo;
    }
    const chiara = await this.ripiego.leggiInChiaro(giorno);
    const nuovo = modifica(chiara?.contenuto ?? contenutoVuoto(), !!chiara);
    await this.chiama(giorno, 0, nuovo);
    if (chiara) await this.ripiego.cancellaInChiaro(giorno);
    return nuovo;
  }

  /**
   * Scrive sopra la versione che ha vinto un conflitto: la persona ha scelto,
   * e la scrittura va a buon fine qualunque sia la versione corrente (si
   * rilegge la v attuale e si scrive quella). Se nel frattempo c'e stata
   * un'ALTRA scrittura, e un conflitto nuovo e si rilancia.
   */
  async sovrascrivi(giorno: string, contenuto: Contenuto): Promise<Contenuto> {
    const c = await this.leggiCassettina(giorno);
    await this.chiama(giorno, c?.v ?? 0, contenuto);
    return contenuto;
  }

  async cancella(giorno: string): Promise<void> {
    const userId = await this.userId();
    const { error } = await this.sb()
      .from("cassettine")
      .delete()
      .eq("user_id", userId)
      .eq("giorno", giorno);
    if (error) throw new Error(error.message);
    await this.ripiego.cancellaInChiaro(giorno);
  }

  /** Un fatto nuovo con un id suo (i fatti nella busta non hanno una tabella). */
  static fatto(giorno: string, f: NewFact): FattoChiuso {
    void giorno;
    return {
      id: nuovoId(),
      kind: f.kind,
      label: f.label,
      labelKey: f.labelKey,
      attrs: f.attrs ?? {},
      confidence: f.confidence ?? null,
      origin: f.origin ?? "ai",
    };
  }

  /**
   * Il passaggio esplicito (R12): ogni giornata ancora in chiaro entra nella
   * cassettina, una per volta, e la riga in chiaro sparisce. Ogni giornata e
   * o di qua o di la, mai a meta: se si interrompe, si riprende da dove era.
   */
  async portaTutteNellaCassaforte(avanza?: (fatte: number, totale: number) => void): Promise<number> {
    const chiare = await this.ripiego.leggiInChiaroTra("0001-01-01", "9999-12-31");
    const giorni = [...chiare.keys()].sort();
    let fatte = 0;
    for (const g of giorni) {
      const gia = await this.leggiCassettina(g);
      if (gia) {
        // Esiste gia una cassettina: la riga in chiaro e un doppione vecchio.
        await this.ripiego.cancellaInChiaro(g);
      } else {
        await this.chiama(g, 0, chiare.get(g)!.contenuto);
        await this.ripiego.cancellaInChiaro(g);
      }
      fatte++;
      avanza?.(fatte, giorni.length);
    }
    return fatte;
  }
}
