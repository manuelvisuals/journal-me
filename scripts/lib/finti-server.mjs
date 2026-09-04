// Due finti LATO SERVER per i banchi dell'ospite (SPEC R2 R3 R4).
//
// Il Supabase finto di supabase-finto.mjs vive dentro Playwright e vede solo
// cio che esce dal BROWSER. La quota dell'ospite pero si conta sul server
// (R2): sono le route /api a parlare col database col service role, e
// Playwright non le intercetta. Quindi qui ci sono due server HTTP veri,
// sulla stessa macchina, a cui il dev server viene puntato con due env:
//
//   JM_SUPABASE_URL_SERVER=http://127.0.0.1:<porta>   (entitlement.ts)
//   OPENAI_BASE_URL=http://127.0.0.1:<porta>          (server/openai.ts)
//
// Il Supabase finto del server copre il sottoinsieme di PostgREST che la
// guardia usa (regalo, braccialetti, braccialetto_giornate, ai_usage,
// profiles, auth/v1/user) e le tre funzioni SQL della migration 023 con la
// STESSA logica: usa_giornata_ospite, speso_regalo_mese,
// riassunto_regalo_mese. L'OpenAI finto risponde a chat/completions con un
// JSON valido per lo schema richiesto (journal_summary, date_segments,
// day_facts, chiarimenti, remember_classification) e a audio/transcriptions
// con un testo fisso, sempre con un campo usage: cosi logAiUsage scrive
// righe vere con un costo, e il tetto di R4 ha qualcosa da sommare.
//
// I banchi leggono e cambiano lo stato direttamente (finto.tabelle), cosi
// possono simulare "il tetto e stato abbassato dal pannello" senza passare
// da /admin.

import { createServer } from "node:http";

/** Le chiavi di unicita, come i `unique` delle migration. */
const UNICHE = {
  braccialetti: ["segreto_hash"],
  profiles: ["user_id"],
  apple_notifiche: ["notification_uuid"],
};

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function leggiCorpo(req) {
  return new Promise((resolve) => {
    const pezzi = [];
    req.on("data", (c) => pezzi.push(c));
    req.on("end", () => resolve(Buffer.concat(pezzi).toString("utf8")));
  });
}

function inizioMeseUtc() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

export class SupabaseFintoServer {
  constructor() {
    this.tabelle = {
      regalo: [
        {
          id: 1,
          attivo: true,
          giornate_per_ospite: 10,
          tetto_mensile_eur: 100,
          cambio_usd_eur: 0.92,
          annuale_attivo: false,
          updated_at: new Date().toISOString(),
        },
      ],
      braccialetti: [],
      braccialetto_giornate: [],
      ai_usage: [],
      profiles: [],
    };
    /** Gli utenti che il finto riconosce dal gettone: token -> { id, email }. */
    this.utenti = new Map();
    this.registro = [];
    this.server = null;
    this.porta = 0;
  }

  tab(nome) {
    if (!this.tabelle[nome]) this.tabelle[nome] = [];
    return this.tabelle[nome];
  }

  get regalo() {
    return this.tabelle.regalo[0];
  }

  filtra(righe, params) {
    let out = righe;
    for (const [k, v] of params) {
      if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(k)) continue;
      const m = /^(eq|neq|gte|lte|gt|lt|is|in)\.(.*)$/s.exec(v);
      if (!m) continue;
      const [, op, raw] = m;
      out = out.filter((r) => {
        const x = r[k];
        switch (op) {
          case "eq": return String(x) === raw;
          case "neq": return String(x) !== raw;
          case "gte": return String(x) >= raw;
          case "lte": return String(x) <= raw;
          case "gt": return String(x) > raw;
          case "lt": return String(x) < raw;
          case "is": return raw === "null" ? x === null || x === undefined : raw === "true" ? x === true : x === false;
          case "in": return raw.replace(/^\(|\)$/g, "").split(",").map((s) => s.replace(/^"|"$/g, "")).includes(String(x));
          default: return true;
        }
      });
    }
    const limit = params.get("limit");
    if (limit) out = out.slice(0, Number(limit));
    return out;
  }

  proietta(righe, select) {
    if (!select || select === "*") return righe;
    const cols = select.split(",").map((s) => s.trim()).filter(Boolean);
    return righe.map((r) => Object.fromEntries(cols.map((c) => [c, r[c] ?? null])));
  }

  /* La stessa logica della funzione SQL della migration 023. */
  usaGiornata({ p_braccialetto_id, p_giorno, p_max, p_blocca_nuove }) {
    const b = this.tab("braccialetti").find((r) => r.id === p_braccialetto_id);
    if (!b) return { esito: "bloccato", usate: 0, gia: false };
    const mie = this.tab("braccialetto_giornate").filter((r) => r.braccialetto_id === p_braccialetto_id);
    const n = mie.length;
    if (mie.some((r) => r.giorno === p_giorno)) return { esito: "ok", usate: n, gia: true };
    if (p_blocca_nuove) return { esito: "bloccato", usate: n, gia: false };
    if (n >= p_max) return { esito: "quota", usate: n, gia: false };
    this.tab("braccialetto_giornate").push({ braccialetto_id: p_braccialetto_id, giorno: p_giorno, creato_il: new Date().toISOString() });
    return { esito: "ok", usate: n + 1, gia: false };
  }

  /** La funzione SQL adotta_braccialetto della migration 025, in JS. */
  adottaBraccialetto({ p_braccialetto_id, p_user_id }) {
    const b = this.tab("braccialetti").find((r) => r.id === p_braccialetto_id);
    if (!b) return { esito: "assente" };
    b.user_id = p_user_id;
    const valido = b.plan === "premium" && b.current_period_end && new Date(b.current_period_end) > new Date();
    if (!valido) return { esito: "legato", premium_spostato: false };
    const altro = this.tab("profiles").find((p) => p.apple_original_transaction_id === b.apple_original_transaction_id && p.user_id !== p_user_id);
    if (altro) return { esito: "legato", premium_spostato: false, motivo: "transazione_di_altro_account" };
    let prof = this.tab("profiles").find((p) => p.user_id === p_user_id);
    if (prof && prof.plan === "premium" && prof.current_period_end && new Date(prof.current_period_end) >= new Date(b.current_period_end)) {
      return { esito: "legato", premium_spostato: false, motivo: "profilo_gia_premium" };
    }
    const fino = b.current_period_end;
    const campi = { plan: "premium", plan_source: b.plan_source ?? "apple", current_period_end: fino, apple_original_transaction_id: b.apple_original_transaction_id, apple_product_id: b.apple_product_id, apple_environment: b.apple_environment };
    Object.assign(b, { plan: "free", plan_source: null, current_period_end: null, apple_original_transaction_id: null, apple_product_id: null, apple_environment: null, apple_ultimo_avviso: null });
    if (!prof) { prof = { user_id: p_user_id }; this.tab("profiles").push(prof); }
    Object.assign(prof, campi);
    return { esito: "legato", premium_spostato: true, fino };
  }

  spesoMese() {
    const da = inizioMeseUtc();
    return this.tab("ai_usage")
      .filter((r) => r.regalo && r.created_at >= da)
      .reduce((s, r) => s + Number(r.costo_usd ?? 0), 0);
  }

  async gestisci(req, res) {
    const url = new URL(req.url, "http://x");
    const corpo = await leggiCorpo(req);
    const voce = { metodo: req.method, url: url.pathname + url.search, corpo };
    this.registro.push(voce);
    const rispondi = (status, body, headers = {}) => {
      res.writeHead(status, { "content-type": "application/json", ...headers });
      res.end(body === undefined ? "" : JSON.stringify(body));
    };

    if (url.pathname.startsWith("/auth/v1/user")) {
      const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      const u = this.utenti.get(token);
      if (!u) return rispondi(401, { message: "invalid token" });
      return rispondi(200, { id: u.id, email: u.email ?? null, aud: "authenticated", role: "authenticated" });
    }

    if (url.pathname === "/rest/v1/rpc/usa_giornata_ospite") {
      return rispondi(200, this.usaGiornata(JSON.parse(corpo || "{}")));
    }
    if (url.pathname === "/rest/v1/rpc/adotta_braccialetto") {
      return rispondi(200, this.adottaBraccialetto(JSON.parse(corpo || "{}")));
    }
    if (url.pathname === "/rest/v1/rpc/speso_regalo_mese") {
      return rispondi(200, this.spesoMese());
    }
    if (url.pathname === "/rest/v1/rpc/riassunto_regalo_mese") {
      const da = inizioMeseUtc();
      const righe = this.tab("ai_usage").filter((r) => r.regalo && r.created_at >= da);
      return rispondi(200, {
        speso_usd: this.spesoMese(),
        ospiti: new Set(righe.map((r) => r.braccialetto_id)).size,
        giornate: this.tab("braccialetto_giornate").filter((r) => r.creato_il >= da).length,
      });
    }
    if (url.pathname.startsWith("/rest/v1/rpc/")) return rispondi(404, { message: "rpc non gestita: " + url.pathname });

    const tabella = url.pathname.replace("/rest/v1/", "");
    if (!url.pathname.startsWith("/rest/v1/")) return rispondi(404, { message: "non gestito" });
    const righe = this.tab(tabella);
    const params = url.searchParams;
    const prefer = req.headers.prefer ?? "";
    const accept = req.headers.accept ?? "";
    const singolo = /vnd\.pgrst\.object/.test(accept);

    if (req.method === "GET" || req.method === "HEAD") {
      const trovate = this.proietta(this.filtra(righe, params), params.get("select"));
      if (singolo) {
        if (trovate.length === 0) return rispondi(406, { code: "PGRST116", message: "0 rows" });
        return rispondi(200, trovate[0]);
      }
      return rispondi(200, trovate);
    }
    if (req.method === "POST") {
      const dati = JSON.parse(corpo || "[]");
      const lista = Array.isArray(dati) ? dati : [dati];
      const inserite = [];
      const chiavi = UNICHE[tabella];
      const merge = /merge-duplicates/.test(prefer);
      for (const d of lista) {
        if (chiavi) {
          const i = righe.findIndex((r) => chiavi.every((k) => String(r[k]) === String(d[k])));
          if (i >= 0) {
            if (!merge) return rispondi(409, { code: "23505", message: "duplicate key value violates unique constraint" });
            Object.assign(righe[i], d);
            inserite.push(righe[i]);
            continue;
          }
        }
        if (tabella === "ai_usage" && !d.user_id && !d.braccialetto_id) {
          return rispondi(400, { code: "23514", message: "ai_usage_chi_ha_chiamato" });
        }
        const riga = { id: uuid(), created_at: new Date().toISOString(), creato_il: new Date().toISOString(), ...d };
        righe.push(riga);
        inserite.push(riga);
      }
      const out = this.proietta(inserite, params.get("select"));
      if (!/return=representation/.test(prefer)) return rispondi(201, undefined);
      return rispondi(201, singolo ? out[0] : out);
    }
    if (req.method === "PATCH") {
      const d = JSON.parse(corpo || "{}");
      const bersaglio = this.filtra(righe, params);
      for (const r of bersaglio) Object.assign(r, d);
      const out = this.proietta(bersaglio, params.get("select"));
      if (!/return=representation/.test(prefer)) return rispondi(204, undefined);
      return rispondi(200, singolo ? out[0] ?? null : out);
    }
    if (req.method === "DELETE") {
      const bersaglio = new Set(this.filtra(righe, params));
      this.tabelle[tabella] = righe.filter((r) => !bersaglio.has(r));
      return rispondi(204, undefined);
    }
    return rispondi(404, { message: "non gestito" });
  }

  async avvia(porta = 0) {
    this.server = createServer((req, res) => {
      this.gestisci(req, res).catch((e) => {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ message: String(e) }));
      });
    });
    await new Promise((r) => this.server.listen(porta, "127.0.0.1", r));
    this.porta = this.server.address().port;
    return `http://127.0.0.1:${this.porta}`;
  }

  async ferma() {
    if (this.server) await new Promise((r) => this.server.close(r));
  }
}

/** Un OpenAI finto: risposte valide per ogni schema, con usage, senza rete. */
export class OpenAIFinto {
  constructor() {
    this.chiamate = [];
    this.server = null;
    this.porta = 0;
    /** Il testo che la trascrizione finta restituisce. */
    this.trascrizione = "Oggi ho passato la giornata a provare l'app come ospite.";
  }

  rispostaPer(body) {
    const nome = body?.response_format?.json_schema?.name ?? "";
    const oggi = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
    const ultimo = body?.messages?.filter((m) => m.role === "user").at(-1)?.content ?? "";
    switch (nome) {
      case "journal_summary":
        return {
          headline: "giornata da ospite, AI accesa",
          snippet: String(ultimo).slice(0, 120) || "Una giornata di prova.",
          areas: [{ label: "Lavoro", text: "Ha provato l'app." }],
          metrics: { weightKg: null, sleepHours: null, mood: null },
        };
      case "date_segments":
        return { segments: [{ date: oggi, text: String(ultimo) }] };
      case "day_facts":
        return { facts: [] };
      case "chiarimenti":
        return { domande: [] };
      case "remember_classification":
        return { kind: "nota", title: String(ultimo).slice(0, 40) };
      default:
        return {};
    }
  }

  async gestisci(req, res) {
    const url = new URL(req.url, "http://x");
    const corpo = await leggiCorpo(req);
    this.chiamate.push({ url: url.pathname, auth: req.headers.authorization ?? "" });
    res.setHeader("content-type", "application/json");
    if (url.pathname === "/v1/chat/completions") {
      let body = {};
      try { body = JSON.parse(corpo); } catch {}
      const content = JSON.stringify(this.rispostaPer(body));
      res.end(JSON.stringify({
        id: "chatcmpl-finto",
        model: body.model ?? "gpt-4o-mini",
        choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
        usage: { prompt_tokens: 1000, completion_tokens: 200, total_tokens: 1200 },
      }));
      return;
    }
    if (url.pathname === "/v1/audio/transcriptions") {
      res.end(JSON.stringify({
        text: this.trascrizione,
        usage: { type: "tokens", input_tokens: 600, output_tokens: 20, total_tokens: 620 },
      }));
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "non gestito" }));
  }

  async avvia(porta = 0) {
    this.server = createServer((req, res) => {
      this.gestisci(req, res).catch((e) => {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: String(e) }));
      });
    });
    await new Promise((r) => this.server.listen(porta, "127.0.0.1", r));
    this.porta = this.server.address().port;
    return `http://127.0.0.1:${this.porta}`;
  }

  async ferma() {
    if (this.server) await new Promise((r) => this.server.close(r));
  }
}


/**
 * Un App Store Server API finto: risponde a GET /inApps/v1/transactions/{id}
 * SOLO se il gettone JWT e firmato con la chiave di scripts/lib/
 * apple-chiave-finta.txt (cosi il banco prova che il server firma bene) e
 * conosce la transazione. I banchi registrano le transazioni con
 * `transazioni.set(id, { ...campi })`; il corpo torna come JWS finto
 * (firma non verificata dal server, per scelta: e la TLS verso Apple a
 * fare fede, e qui Apple e questo processo).
 */
import { createPublicKey, createVerify } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const QUI = dirname(fileURLToPath(import.meta.url));
// La chiave finta e un .txt (non .pem: *.pem e ignorato da git) con una riga
// di avvertenza in testa: si legge dal BEGIN in poi.
const testoChiave = readFileSync(join(QUI, "apple-chiave-finta.txt"), "utf8");
export const CHIAVE_APPLE_FINTA_PEM = testoChiave.slice(testoChiave.indexOf("-----BEGIN"));
export const KEY_ID_FINTO = "FINTOKEY01";
export const ISSUER_ID_FINTO = "00000000-finto-issuer";

export function jwsFinto(payload) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "ES256", x5c: ["finto"] })}.${b64(payload)}.firma-finta`;
}

export class AppleFinto {
  constructor() {
    /** transactionId -> il corpo della transazione (campi come Apple) */
    this.transazioni = new Map();
    this.chiamate = [];
    this.server = null;
    this.porta = 0;
    this.pubblica = createPublicKey(CHIAVE_APPLE_FINTA_PEM);
  }

  gettoneValido(auth) {
    const tok = (auth ?? "").replace(/^Bearer\s+/i, "");
    const parti = tok.split(".");
    if (parti.length !== 3) return { ok: false, motivo: "non e un JWT" };
    let h, p;
    try {
      h = JSON.parse(Buffer.from(parti[0], "base64url").toString("utf8"));
      p = JSON.parse(Buffer.from(parti[1], "base64url").toString("utf8"));
    } catch {
      return { ok: false, motivo: "intestazione o corpo illeggibili" };
    }
    if (h.alg !== "ES256" || h.kid !== KEY_ID_FINTO) return { ok: false, motivo: "alg o kid sbagliati" };
    if (p.iss !== ISSUER_ID_FINTO || p.aud !== "appstoreconnect-v1") return { ok: false, motivo: "iss o aud sbagliati" };
    const adesso = Math.floor(Date.now() / 1000);
    if (typeof p.exp !== "number" || p.exp < adesso || p.exp - adesso > 3600) return { ok: false, motivo: "exp" };
    const v = createVerify("SHA256");
    v.update(`${parti[0]}.${parti[1]}`);
    v.end();
    const firma = Buffer.from(parti[2], "base64url");
    const ok = v.verify({ key: this.pubblica, dsaEncoding: "ieee-p1363" }, firma);
    return ok ? { ok: true, bid: p.bid } : { ok: false, motivo: "firma non valida" };
  }

  async gestisci(req, res) {
    const url = new URL(req.url, "http://x");
    await leggiCorpo(req);
    const g = this.gettoneValido(req.headers.authorization);
    this.chiamate.push({ url: url.pathname, gettone: g });
    res.setHeader("content-type", "application/json");
    if (!g.ok) {
      res.statusCode = 401;
      res.end(JSON.stringify({ errorCode: 4040000, errorMessage: "gettone: " + g.motivo }));
      return;
    }
    const m = /^\/inApps\/v1\/transactions\/([^/]+)$/.exec(url.pathname);
    if (m) {
      const t = this.transazioni.get(decodeURIComponent(m[1]));
      if (!t) {
        res.statusCode = 404;
        res.end(JSON.stringify({ errorCode: 4040010, errorMessage: "Transaction id not found." }));
        return;
      }
      res.end(JSON.stringify({ signedTransactionInfo: jwsFinto(t) }));
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ errorCode: 4040000, errorMessage: "non gestito" }));
  }

  async avvia(porta = 0) {
    this.server = createServer((req, res) => {
      this.gestisci(req, res).catch((e) => {
        res.statusCode = 500;
        res.end(JSON.stringify({ errorMessage: String(e) }));
      });
    });
    await new Promise((r) => this.server.listen(porta, "127.0.0.1", r));
    this.porta = this.server.address().port;
    return `http://127.0.0.1:${this.porta}`;
  }

  async ferma() {
    if (this.server) await new Promise((r) => this.server.close(r));
  }
}
