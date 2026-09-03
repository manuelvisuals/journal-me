// Un Supabase finto per i banchi, dentro Playwright: intercetta le richieste
// verso `https://sbfinto.supabase.co` e risponde come PostgREST, con le
// tabelle in memoria. Serve a due cose che nel sandbox non si possono fare
// altrimenti: provare la cassaforte end-to-end (SPEC R6 R7 R8) e VEDERE cio
// che lascia il dispositivo — ogni richiesta viene registrata, corpo
// compreso, ed e su quel registro che il banco cerca le parole del testo.
//
// Copre il sottoinsieme di PostgREST che l'app usa: select con eq/gte/lte/
// lt/is/in, order, limit, count=exact (HEAD), insert/upsert (Prefer:
// resolution=merge-duplicates), update, delete, e la RPC salva_cassettina
// con la stessa logica di versione della migration 021.

export const SB_HOST = "sbfinto.supabase.co";
export const UTENTE_ID = "00000000-0000-4000-8000-000000000001";

export function jwtFinto(exp, sub = UTENTE_ID) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({
    sub,
    aud: "authenticated",
    role: "authenticated",
    email: "banco@dayalogue.test",
    session_id: "banco",
    exp,
  })}.firma-finta`;
}

export function sessioneFinta(sub = UTENTE_ID) {
  const exp = Math.floor(Date.now() / 1000) + 6 * 3600;
  return {
    access_token: jwtFinto(exp, sub),
    refresh_token: "refresh-finto",
    token_type: "bearer",
    expires_in: 6 * 3600,
    expires_at: exp,
    user: {
      id: sub,
      aud: "authenticated",
      role: "authenticated",
      email: "banco@dayalogue.test",
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-01-01T00:00:00Z",
    },
  };
}

/** Le chiavi di unicita per gli upsert (come i `unique` delle migration). */
const UNICHE = {
  entries: ["user_id", "entry_date"],
  cassettine: ["user_id", "giorno"],
  cassaforte_utente: ["user_id"],
  recaps: ["user_id", "period_type", "period_start"],
  fact_aliases: ["user_id", "kind", "alias"],
  day_exclusions: ["user_id", "entry_date", "kind", "label_key"],
  open_questions: ["user_id", "entry_date", "azione", "soggetto_key"],
  user_settings: ["user_id"],
  profiles: ["user_id"],
};

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export class SupabaseFinto {
  constructor({ utente = UTENTE_ID, tabelle = {} } = {}) {
    this.utente = utente;
    this.tabelle = { profiles: [{ user_id: utente, plan: "premium" }], ...tabelle };
    /** Ogni richiesta arrivata: { metodo, url, corpo, risposta } */
    this.registro = [];
    /** Gancio per i banchi: chiamato PRIMA della prossima salva_cassettina (poi si spegne).
        Serve a simulare un altro dispositivo che scrive fra la lettura e la scrittura. */
    this.primaDellaProssimaScrittura = null;
  }

  tab(nome) {
    if (!this.tabelle[nome]) this.tabelle[nome] = [];
    return this.tabelle[nome];
  }

  filtra(righe, params) {
    let out = righe;
    for (const [k, v] of params) {
      if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(k)) continue;
      const m = /^(eq|neq|gte|lte|gt|lt|is|in|like|ilike)\.(.*)$/s.exec(v);
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
    const order = params.get("order");
    if (order) {
      const [col, dir] = order.split(".");
      out = [...out].sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (dir === "desc" ? -1 : 1));
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

  /** Gestisce una richiesta e risponde. `route` e la Route di Playwright. */
  async gestisci(route) {
    const req = route.request();
    const url = new URL(req.url());
    const metodo = req.method();
    const corpo = req.postData() ?? null;
    const voce = { metodo, url: url.pathname + url.search, corpo, risposta: null };
    this.registro.push(voce);
    const rispondi = (status, body, headers = {}) => {
      voce.risposta = { status, body };
      return route.fulfill({
        status,
        contentType: "application/json",
        headers,
        body: body === undefined ? "" : JSON.stringify(body),
      });
    };

    if (url.pathname.startsWith("/auth/v1/user")) return rispondi(200, sessioneFinta(this.utente).user);
    if (url.pathname.startsWith("/auth/v1/")) return rispondi(200, {});

    if (url.pathname.startsWith("/rest/v1/rpc/salva_cassettina")) {
      const p = JSON.parse(corpo ?? "{}");
      const righe = this.tab("cassettine");
      if (this.primaDellaProssimaScrittura) {
        const g = this.primaDellaProssimaScrittura;
        this.primaDellaProssimaScrittura = null;
        g(righe, p);
      }
      const i = righe.findIndex((r) => r.user_id === this.utente && r.giorno === p.p_giorno);
      const now = new Date().toISOString();
      if (i < 0) {
        if (p.p_v_attesa !== 0) return rispondi(400, { code: "P0001", message: "versione_superata", details: null, hint: null });
        righe.push({ user_id: this.utente, giorno: p.p_giorno, v: 1, busta: p.p_busta, bytes: p.p_busta.length, created_at: now, updated_at: now });
        return rispondi(200, 1);
      }
      if (righe[i].v !== p.p_v_attesa) return rispondi(400, { code: "P0001", message: "versione_superata", details: null, hint: null });
      righe[i] = { ...righe[i], v: righe[i].v + 1, busta: p.p_busta, bytes: p.p_busta.length, updated_at: now };
      return rispondi(200, righe[i].v);
    }
    if (url.pathname.startsWith("/rest/v1/rpc/")) return rispondi(200, null);

    const tabella = url.pathname.replace("/rest/v1/", "");
    const righe = this.tab(tabella);
    const params = url.searchParams;
    const prefer = req.headers()["prefer"] ?? "";

    if (metodo === "GET" || metodo === "HEAD") {
      const trovate = this.filtra(righe.filter((r) => r.user_id === this.utente || r.user_id === undefined), params);
      const headers = /count=exact/.test(prefer) ? { "content-range": `0-${Math.max(trovate.length - 1, 0)}/${trovate.length}` } : {};
      if (metodo === "HEAD") return rispondi(200, undefined, headers);
      return rispondi(200, this.proietta(trovate, params.get("select")), headers);
    }
    if (metodo === "POST") {
      const dati = JSON.parse(corpo ?? "[]");
      const lista = Array.isArray(dati) ? dati : [dati];
      const chiavi = UNICHE[tabella];
      const merge = /merge-duplicates/.test(prefer);
      const inserite = [];
      for (const d of lista) {
        const riga = { id: uuid(), created_at: new Date().toISOString(), ...d };
        if (chiavi) {
          const i = righe.findIndex((r) => chiavi.every((k) => String(r[k]) === String(riga[k])));
          if (i >= 0) {
            if (!merge) return rispondi(409, { code: "23505", message: "duplicate key value violates unique constraint" });
            righe[i] = { ...righe[i], ...d };
            inserite.push(righe[i]);
            continue;
          }
        }
        righe.push(riga);
        inserite.push(riga);
      }
      return rispondi(201, /return=representation/.test(prefer) ? this.proietta(inserite, params.get("select")) : undefined);
    }
    if (metodo === "PATCH") {
      const d = JSON.parse(corpo ?? "{}");
      const bersaglio = this.filtra(righe, params);
      for (const r of bersaglio) Object.assign(r, d);
      return rispondi(200, /return=representation/.test(prefer) ? this.proietta(bersaglio, params.get("select")) : undefined);
    }
    if (metodo === "DELETE") {
      const bersaglio = new Set(this.filtra(righe, params));
      this.tabelle[tabella] = righe.filter((r) => !bersaglio.has(r));
      return rispondi(200, undefined);
    }
    return rispondi(404, { message: "non gestito" });
  }

  /** Tutto cio che e uscito dal dispositivo verso Supabase, come testo unico. */
  tuttoCioCheEUscito() {
    return this.registro.map((v) => `${v.metodo} ${v.url}\n${v.corpo ?? ""}`).join("\n");
  }
}

/** Monta il finto su un contesto Playwright e prepara la sessione. */
export async function montaSupabaseFinto(ctx, finto, { seme = null } = {}) {
  await ctx.route(`**/${SB_HOST}/**`, (route) => finto.gestisci(route));
  await ctx.addInitScript(
    ({ sessione, seme }) => {
      try {
        window.localStorage.setItem("sb-sbfinto-auth-token", JSON.stringify(sessione));
        window.localStorage.setItem("jm.plan", "premium");
        window.localStorage.setItem("jm.saluto.silenzio", "sid:banco#v1");
        window.localStorage.setItem("journalme-rec-primer", "1");
        // niente scansione dell'archivio al primo premium (scan-archivio.ts):
        // e una scrittura spontanea che confonderebbe i conti dei banchi
        window.localStorage.setItem("jm:archivio-letto", "1");
      } catch {}
      // Il seme della cassaforte, gia sul dispositivo (IndexedDB journalme-chiave).
      if (seme) {
        const req = indexedDB.open("journalme-chiave", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("semi");
        req.onsuccess = () => {
          const tx = req.result.transaction("semi", "readwrite");
          tx.objectStore("semi").put(seme.valore, seme.conto);
        };
      }
    },
    { sessione: sessioneFinta(finto.utente), seme },
  );
}
