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
  CHIAMATE_PER_GIORNATA,
  ERRORE_REGALO_FINITO,
  HEADER_BRACCIALETTO,
  HEADER_GIORNO,
  type MotivoRegaloFinito,
} from "@/lib/regalo";
import { configurato as deviceCheckConfigurato, interrogaDispositivo, segnaRegaloDato } from "@/lib/server/devicecheck";

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
 * PREMIUM VUOLE UN ACCOUNT (Manuel, 10 settembre 2026): il braccialetto
 * porta il REGALO, non l'abbonamento. Fino a ieri un braccialetto poteva
 * avere un premium sopra (migration 025) e passava di qui senza contare
 * niente; adesso premium si legge solo dal profilo. La riga sul
 * braccialetto resta dov'e e adotta_braccialetto la porta sull'account
 * appena la persona mette l'email.
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
 * Cosa conta come "una giornata" (decisione 4A di Manuel, 10 settembre
 * 2026): un giorno DEL DIARIO su cui l'AI ha lavorato per quel braccialetto.
 * Il client dice quale nell'intestazione `x-jm-giorno` (il giorno della
 * pagina aperta: oggi, o ieri riaperto); se non lo dice vale oggi nel fuso
 * dell'app. Rilavorare lo stesso giorno (riaprire, aggiungere, correggere,
 * la trascrizione e poi il riassunto) costa una giornata sola, MA ha un
 * tetto di chiamate (CHIAMATE_PER_GIORNATA): senza, un client che manda
 * sempre lo stesso giorno avrebbe AI illimitata per una giornata sola. Il
 * giorno dichiarato si accetta solo se e un giorno vero, non nel futuro
 * (con un giorno di tolleranza per chi vive a est di Roma) e non prima del
 * 2000: fuori da li vale oggi.
 *
 * DA DOVE NASCE UN BRACCIALETTO (decisione 2A). Non piu qui: fino al 10
 * settembre 2026 la guardia creava una riga per qualunque segreto ben
 * formato, cioe regalava dieci giornate a ogni curl. Adesso il braccialetto
 * nasce SOLO da POST /api/ospite/braccialetto (registraBraccialetto, sotto),
 * che con DeviceCheck acceso vuole un token del dispositivo verificato da
 * Apple e il bit "regalo gia dato" spento. Un segreto che il server non
 * conosce riceve 402 regalo_finito con motivo `solo_app`.
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

/** Quanti giorni dopo "oggi a Roma" si accettano ancora: chi vive a est di
 *  Roma e gia a domani per qualche ora. Un anno indietro basta a chiunque
 *  riapra una giornata vecchia; oltre, e un client che inventa. */
const TOLLERANZA_AVANTI_GIORNI = 1;
const TOLLERANZA_INDIETRO_GIORNI = 366;

/**
 * Il giorno del diario su cui l'AI lavora: dall'intestazione se il client
 * lo dice ed e plausibile, oggi altrimenti. Esportata per i banchi.
 */
export function giornoDalla(req: NextRequest, oggi: string = oggiISO()): string {
  const g = (req.headers.get(HEADER_GIORNO) ?? "").trim();
  if (!RE_GIORNO.test(g)) return oggi;
  const t = Date.parse(`${g}T00:00:00Z`);
  const t0 = Date.parse(`${oggi}T00:00:00Z`);
  if (!Number.isFinite(t) || !Number.isFinite(t0)) return oggi;
  // Un giorno che non esiste (2026-02-31) si normalizza a un altro: non vale.
  if (new Date(t).toISOString().slice(0, 10) !== g) return oggi;
  const giorni = Math.round((t - t0) / 86_400_000);
  if (giorni > TOLLERANZA_AVANTI_GIORNI || giorni < -TOLLERANZA_INDIETRO_GIORNI) return oggi;
  return g;
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
  // Il braccialetto deve gia esistere: nasce da registraBraccialetto, non da
  // qui (2A). Un segreto sconosciuto e un dispositivo che non si e potuto
  // registrare (il web con DeviceCheck acceso, o un telefono che il regalo
  // l'ha gia avuto) oppure un curl: in entrambi i casi niente regalo.
  const braccialettoId = await braccialettoDaSegreto(segreto, userId, { crea: false });
  if (!braccialettoId) {
    if (userId) return NextResponse.json({ error: "Premium required" }, { status: 402 });
    return regaloFinito("solo_app", 0, regalo.giornatePerOspite);
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
      p_max_chiamate: CHIAMATE_PER_GIORNATA,
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
      esito.esito === "quota"
        ? "quota"
        : esito.esito === "chiamate"
          ? "chiamate"
          : !regalo.attivo
            ? "spento"
            : "tetto";
    return regaloFinito(motivo, usate, max);
  }

  return {
    chi: { userId, braccialettoId, regalo: true },
    tipo: "ospite",
    usate,
    max,
  };
}

/**
 * POST /api/ospite/braccialetto: il braccialetto NASCE (decisione 2A).
 *
 * Il dispositivo ha generato il segreto e lo presenta nell'intestazione;
 * nel corpo, se e il guscio iOS, il token DeviceCheck ({ token }). Qui:
 *   1. se la riga esiste gia -> 200 { esito: "gia" } (e si lega all'utente
 *      se c'e un gettone e la riga non ne ha uno: l'ospite diventato account);
 *   2. con DeviceCheck ACCESO sul server: senza token -> 403 `solo_app`
 *      (il web, o un curl); token che Apple non riconosce -> 403
 *      `token_non_valido`; bit "regalo gia dato" acceso -> 409 `regalo_gia_dato`
 *      (un telefono cancellato e reinstallato: il regalo l'ha gia avuto);
 *      Apple muta -> 503, si riprova al prossimo avvio; altrimenti si
 *      accende il bit e nasce la riga;
 *   3. con DeviceCheck SPENTO (sviluppo, banchi, e la produzione finche la
 *      chiave non e su Vercel): nasce la riga e basta, come prima.
 * Non spende niente e non conta niente: il conto lo fa la guardia.
 */
export async function registraBraccialetto(req: NextRequest): Promise<NextResponse> {
  // Un guasto NOSTRO (database muto, env mancanti) e "rimandato", con 200:
  // la registrazione parte a ogni avvio ed e la prima chiamata dell'app, e un
  // 5xx qui finirebbe nella console del browser come errore a ogni apertura
  // (i banchi senza il Supabase finto lo vedevano). Il client riprova alla
  // prossima apertura; intanto l'AI, se la chiama, riceve solo_app e riprova
  // a registrare da li.
  const rimandato = (motivo: string) => NextResponse.json({ esito: "rimandato", motivo });
  const admin = getAdminClient();
  if (!admin) return rimandato("Entitlement not configured (missing Supabase env)");
  const segreto = segretoDalla(req);
  if (!segreto) return NextResponse.json({ error: "Missing braccialetto" }, { status: 400 });

  // Il gettone, se c'e e vale, lega la riga alla persona. Se e scaduto NON
  // si risponde 401: il braccialetto e del dispositivo, non dell'account, e
  // un telefono con la sessione vecchia deve potersi registrare lo stesso
  // (la riga si leghera alla prima chiamata AI con un gettone buono).
  let userId: string | null = null;
  if ((req.headers.get("authorization") ?? "").startsWith("Bearer ")) {
    const user = await requireUser(req);
    if (!(user instanceof NextResponse)) userId = user.userId;
  }

  const { data: rigaGia, error: errLettura } = await admin
    .from("braccialetti")
    .select("id,user_id")
    .eq("segreto_hash", hashBraccialetto(segreto))
    .maybeSingle();
  if (errLettura) return rimandato(errLettura.message);
  if (rigaGia) {
    if (userId && !rigaGia.user_id) {
      await admin.from("braccialetti").update({ user_id: userId }).eq("id", rigaGia.id);
    }
    return NextResponse.json({ esito: "gia", devicecheck: deviceCheckConfigurato() });
  }

  let token = "";
  try {
    const body = (await req.json()) as { token?: unknown };
    token = typeof body?.token === "string" ? body.token.trim() : "";
  } catch {
    token = "";
  }

  let conDeviceCheck = false;
  if (deviceCheckConfigurato()) {
    if (!token) {
      return NextResponse.json({ error: "solo_app", messaggio: "Il regalo dell'AI si accende dall'app per iPhone." }, { status: 403 });
    }
    const verdetto = await interrogaDispositivo(token);
    if (verdetto.esito === "token_non_valido") {
      return NextResponse.json({ error: "token_non_valido" }, { status: 403 });
    }
    if (verdetto.esito === "gia_dato") {
      return NextResponse.json({ error: "regalo_gia_dato", messaggio: "Questo dispositivo ha gia ricevuto le giornate in regalo." }, { status: 409 });
    }
    if (verdetto.esito === "non_disponibile") {
      return NextResponse.json({ error: "devicecheck_non_disponibile", messaggio: verdetto.motivo }, { status: 503 });
    }
    // Prima il bit, poi la riga: se il bit non si accende non nasce niente,
    // cosi un guasto non regala due volte.
    if (!(await segnaRegaloDato(token, verdetto.ambiente))) {
      return NextResponse.json({ error: "devicecheck_non_disponibile", messaggio: "Apple non ha registrato il dispositivo." }, { status: 503 });
    }
    conDeviceCheck = true;
  }

  const hash = hashBraccialetto(segreto);
  const { error } = await admin
    .from("braccialetti")
    .insert({ segreto_hash: hash, user_id: userId, devicecheck: conDeviceCheck });
  if (error && error.code !== "23505") return rimandato(error.message);
  return NextResponse.json({ esito: error ? "gia" : "nato", devicecheck: conDeviceCheck });
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
  // `registrato`: il server conosce questo braccialetto? Falso sul web con
  // DeviceCheck acceso, e per un dispositivo che il regalo l'ha gia avuto:
  // le schermate lo dicono invece di promettere dieci giornate che non
  // arriveranno (2A).
  if (!segreto) return NextResponse.json({ ...base, usate: 0, rimaste: regalo.giornatePerOspite, oggi: false, registrato: false });
  const id = await braccialettoDaSegreto(segreto, null, { crea: false });
  if (!id) return NextResponse.json({ ...base, usate: 0, rimaste: regalo.giornatePerOspite, oggi: false, registrato: false });
  const esito = await soloControllo(id, giornoDalla(req), regalo.giornatePerOspite, false);
  const usate = esito.usate ?? 0;
  return NextResponse.json({
    ...base,
    usate,
    rimaste: Math.max(0, regalo.giornatePerOspite - usate),
    oggi: esito.gia === true,
    registrato: true,
  });
}

/** Da chiamare dopo logAiUsage: il tetto si aggiorna senza aspettare la cache. */
export { aggiungiSpesaUsd };
