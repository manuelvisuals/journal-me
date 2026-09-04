import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, requireUser } from "@/lib/server/entitlement";
import { pianoEffettivo } from "@/lib/piano";
import {
  aggiungiSpesaUsd,
  leggiRegalo,
  sopraIlTetto,
  spesoRegaloMeseUsd,
} from "@/lib/server/regalo";
import {
  ERRORE_REGALO_FINITO,
  HEADER_BRACCIALETTO,
  type MotivoRegaloFinito,
} from "@/lib/regalo";

/**
 * La quarta guardia (SPEC-ospite-e-cassaforte R2 R3 R4; referto par. 10):
 * una route AI e aperta a chi e PREMIUM oppure a un OSPITE con un
 * braccialetto che ha ancora giornate in regalo.
 *
 * Il braccialetto e un segreto casuale che il dispositivo genera alla prima
 * apertura e tiene nel portachiavi iCloud (o in IndexedDB sul web); arriva
 * nell'intestazione `x-jm-braccialetto`. Qui se ne calcola l'hash e si
 * cerca (o si crea) la riga in `braccialetti`. Il server non sa chi e la
 * persona: sa solo "questo braccialetto ha usato N giornate su M".
 *
 * L'ordine delle decisioni:
 *   1. c'e un gettone valido e il piano e premium  -> dentro, senza contare;
 *   2. c'e un braccialetto                          -> si chiede al database
 *      di spendere una giornata (usa_giornata_ospite, sotto lock di riga);
 *      se il gettone c'e ma il piano e gratis, il braccialetto viene LEGATO
 *      a quell'utente: e l'ospite diventato account, e la quota non
 *      ricomincia (R2);
 *   3. niente di tutto questo                       -> 401/402 come oggi.
 *
 * Il tetto di spesa (R4): la spesa del mese si legge in memoria (regalo.ts)
 * e, se supera il tetto o il regalo e spento, si passano `blocca_nuove` al
 * database: chi ha GIA una riga per il giorno di oggi finisce la giornata,
 * chi non l'ha riceve 402 `regalo_finito`. La decisione e del database, in
 * una transazione: due chiamate parallele dello stesso braccialetto non
 * prendono due giornate al prezzo di una.
 *
 * Cosa conta come "una giornata": un giorno del calendario (APP_TZ) in cui
 * l'AI ha lavorato per quel braccialetto. Rilavorare lo stesso giorno
 * (riaprire, aggiungere, correggere, la trascrizione e poi il riassunto)
 * costa una giornata sola. Proposta C del mockup, in attesa dell'ok.
 *
 * `consuma: false` controlla senza spendere: e per il warm-up della
 * trascrizione (GET), che parte all'apertura di Oggi e non deve bruciare
 * una giornata a chi ha solo aperto l'app.
 */

/** Chi ha fatto la chiamata, nella forma che logAiUsage vuole. */
export type Chiamante = {
  userId: string | null;
  braccialettoId: string | null;
  /** true = questa chiamata la paga il regalo (conta nel tetto). */
  regalo: boolean;
};

export type EsitoGuardia = {
  chi: Chiamante;
  tipo: "premium" | "ospite";
  /** Solo per l'ospite: quante giornate ha usato e quante ne ha in tutto. */
  usate?: number;
  max?: number;
};

type EsitoRpc = { esito?: string; usate?: number; gia?: boolean };

/**
 * "Oggi" nel fuso dell'app (APP_TZ di format.ts, Europe/Rome), ricalcolato
 * qui per non trascinare il runtime i18n del client dentro una route. Server
 * (UTC) e telefono devono contare la stessa giornata intorno a mezzanotte.
 */
function oggiISO(): string {
  const parti = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const v = (t: string) => parti.find((p) => p.type === t)?.value ?? "";
  return `${v("year")}-${v("month")}-${v("day")}`;
}

const RE_SEGRETO = /^[A-Za-z0-9_-]{32,128}$/;
const RE_GIORNO = /^\d{4}-\d{2}-\d{2}$/;

export function hashBraccialetto(segreto: string): string {
  return createHash("sha256").update(segreto, "utf8").digest("hex");
}

export function segretoDalla(req: NextRequest): string | null {
  const s = (req.headers.get(HEADER_BRACCIALETTO) ?? "").trim();
  return RE_SEGRETO.test(s) ? s : null;
}

/** Il giorno su cui l'AI lavora: dall'intestazione se il client lo dice, oggi altrimenti. */
function giornoDalla(req: NextRequest): string {
  const g = (req.headers.get("x-jm-giorno") ?? "").trim();
  return RE_GIORNO.test(g) ? g : oggiISO();
}

function regaloFinito(motivo: MotivoRegaloFinito, usate: number, max: number): NextResponse {
  return NextResponse.json(
    { error: ERRORE_REGALO_FINITO, motivo, usate, max },
    { status: 402 },
  );
}

/**
 * Trova il braccialetto dal segreto, creandolo se non esiste, e lo lega
 * all'utente se c'e un utente e il braccialetto non ne ha ancora uno.
 * Risponde con l'id, o null se il database non collabora.
 */
export async function braccialettoDaSegreto(
  segreto: string,
  userId: string | null,
  { crea }: { crea: boolean },
): Promise<string | null> {
  const admin = getAdminClient();
  if (!admin) return null;
  const hash = hashBraccialetto(segreto);
  const { data: riga, error } = await admin
    .from("braccialetti")
    .select("id,user_id")
    .eq("segreto_hash", hash)
    .maybeSingle();
  if (error) return null;
  if (riga) {
    if (userId && !riga.user_id) {
      await admin.from("braccialetti").update({ user_id: userId }).eq("id", riga.id);
    }
    return riga.id as string;
  }
  if (!crea) return null;
  const { data: nuova, error: errIns } = await admin
    .from("braccialetti")
    .insert({ segreto_hash: hash, user_id: userId })
    .select("id")
    .single();
  if (errIns || !nuova) {
    // Due prime chiamate in parallelo: la seconda trova la riga che la prima
    // ha appena scritto.
    const { data: di_nuovo } = await admin
      .from("braccialetti")
      .select("id")
      .eq("segreto_hash", hash)
      .maybeSingle();
    return (di_nuovo?.id as string | undefined) ?? null;
  }
  return nuova.id as string;
}

/**
 * Il premium che vive sul BRACCIALETTO (migration 025: comprato dall'ospite
 * con il foglio di Apple, senza email). Torna la scadenza se e valido.
 */
export async function premiumDelBraccialetto(braccialettoId: string): Promise<string | null> {
  const admin = getAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("braccialetti")
    .select("plan, current_period_end")
    .eq("id", braccialettoId)
    .maybeSingle();
  if (!data) return null;
  const riga = data as { plan?: string | null; current_period_end?: string | null };
  return pianoEffettivo(riga) === "premium" ? (riga.current_period_end ?? null) : null;
}

/** Il piano EFFETTIVO dell'utente (scadenza compresa), o null se non si legge. */
async function pianoDi(userId: string): Promise<string | null> {
  const admin = getAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("profiles")
    .select("plan, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return pianoEffettivo(data as { plan?: string | null; current_period_end?: string | null });
}

export async function requireOspiteOPremium(
  req: NextRequest,
  { consuma = true }: { consuma?: boolean } = {},
): Promise<EsitoGuardia | NextResponse> {
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Entitlement not configured (missing Supabase env)" },
      { status: 500 },
    );
  }

  // 1. Il gettone, se c'e. Un gettone presente ma non valido e un 401 come
  //    oggi: non si scivola in silenzio sull'ospite.
  let userId: string | null = null;
  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Bearer ")) {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    userId = user.userId;
    const piano = await pianoDi(userId);
    if (piano === "premium") {
      return { chi: { userId, braccialettoId: null, regalo: false }, tipo: "premium" };
    }
  }

  // 2. Il braccialetto.
  const segreto = segretoDalla(req);
  if (!segreto) {
    if (userId) return NextResponse.json({ error: "Premium required" }, { status: 402 });
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  const regalo = await leggiRegalo();
  const braccialettoId = await braccialettoDaSegreto(segreto, userId, { crea: true });
  if (!braccialettoId) {
    return NextResponse.json({ error: "Cannot read braccialetti" }, { status: 500 });
  }

  // Il premium comprato senza email vive sul braccialetto: e un premium
  // a tutti gli effetti, non conta giornate e non entra nel tetto.
  if (await premiumDelBraccialetto(braccialettoId)) {
    return { chi: { userId, braccialettoId, regalo: false }, tipo: "premium" };
  }

  const speso = await spesoRegaloMeseUsd();
  const tetto = sopraIlTetto(regalo, speso);
  const bloccaNuove = !regalo.attivo || tetto;
  const giorno = giornoDalla(req);
  const max = regalo.giornatePerOspite;

  let esito: EsitoRpc;
  if (consuma) {
    const { data, error } = await admin.rpc("usa_giornata_ospite", {
      p_braccialetto_id: braccialettoId,
      p_giorno: giorno,
      p_max: max,
      p_blocca_nuove: bloccaNuove,
    });
    if (error) {
      return NextResponse.json(
        { error: `Cannot count the gift: ${error.message}` },
        { status: 500 },
      );
    }
    esito = (data ?? {}) as EsitoRpc;
  } else {
    esito = await soloControllo(braccialettoId, giorno, max, bloccaNuove);
  }

  const usate = typeof esito.usate === "number" ? esito.usate : 0;
  if (esito.esito !== "ok") {
    const motivo: MotivoRegaloFinito =
      esito.esito === "quota" ? "quota" : !regalo.attivo ? "spento" : "tetto";
    return regaloFinito(motivo, usate, max);
  }

  return {
    chi: { userId, braccialettoId, regalo: true },
    tipo: "ospite",
    usate,
    max,
  };
}

/** La stessa decisione di usa_giornata_ospite, ma in lettura: non spende. */
async function soloControllo(
  braccialettoId: string,
  giorno: string,
  max: number,
  bloccaNuove: boolean,
): Promise<EsitoRpc> {
  const admin = getAdminClient();
  if (!admin) return { esito: "bloccato", usate: 0 };
  const { data, error } = await admin
    .from("braccialetto_giornate")
    .select("giorno")
    .eq("braccialetto_id", braccialettoId);
  if (error) return { esito: "bloccato", usate: 0 };
  const righe = (data ?? []) as { giorno: string }[];
  const usate = righe.length;
  if (righe.some((r) => r.giorno === giorno)) return { esito: "ok", usate, gia: true };
  if (bloccaNuove) return { esito: "bloccato", usate };
  if (usate >= max) return { esito: "quota", usate };
  return { esito: "ok", usate };
}

/**
 * Lo stato del regalo per il dispositivo che chiede (GET /api/ospite/stato):
 * quante giornate ha usato, quante ne ha, se oggi e gia coperta. Non crea
 * il braccialetto e non spende niente. Serve alla riga "AI in regalo" di
 * Impostazioni e ai banchi.
 */
export async function statoOspite(req: NextRequest): Promise<NextResponse> {
  const regalo = await leggiRegalo();
  const speso = await spesoRegaloMeseUsd();
  const segreto = segretoDalla(req);
  const base = {
    attivo: regalo.attivo,
    max: regalo.giornatePerOspite,
    sopraIlTetto: sopraIlTetto(regalo, speso),
    // L'interruttore dell'annuale (migration 024): il muro premium lo legge
    // da qui, che e nell'elenco chiuso della promessa sulla rete.
    annualeAttivo: regalo.annualeAttivo,
  };
  if (!segreto) return NextResponse.json({ ...base, usate: 0, rimaste: regalo.giornatePerOspite, oggi: false });
  const id = await braccialettoDaSegreto(segreto, null, { crea: false });
  if (!id) return NextResponse.json({ ...base, usate: 0, rimaste: regalo.giornatePerOspite, oggi: false });
  const esito = await soloControllo(id, oggiISO(), regalo.giornatePerOspite, false);
  const usate = esito.usate ?? 0;
  return NextResponse.json({
    ...base,
    usate,
    rimaste: Math.max(0, regalo.giornatePerOspite - usate),
    oggi: esito.gia === true,
    // Il premium sul braccialetto (migration 025): la scadenza, o null.
    premiumFino: await premiumDelBraccialetto(id),
  });
}

/** Da chiamare dopo logAiUsage: il tetto si aggiorna senza aspettare la cache. */
export { aggiungiSpesaUsd };
