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
      for (const d of lista) {
        if (tabella === "braccialetti" && righe.some((r) => r.segreto_hash === d.segreto_hash)) {
          return rispondi(409, { code: "23505", message: "duplicate key value violates unique constraint" });
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
