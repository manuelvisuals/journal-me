"use client";

/**
 * La voce "Iscritti" del pannello admin (13 settembre 2026; mockup
 * design/mockups/admin-iscritti.html v2, approvato da Manuel con le
 * scelte A2 B2 C2 e dopo il polish visivo):
 *
 *   - una testata a una riga: titolo, il segmented Account / Ospiti, la
 *     ricerca;
 *   - quattro numeri;
 *   - l'elenco a cinque colonne, ordinabile CLICCANDO LE INTESTAZIONI
 *     (un clic = crescente, il secondo = decrescente; richiesta di Manuel
 *     del 13 settembre), di fabbrica gli ultimi iscritti in cima (C2);
 *   - l'ispettore a destra per la riga scelta, con il piano cambiabile a
 *     mano (B2) — spento quando lo governa l'App Store.
 *
 * Tutto arriva da GET /api/admin/iscritti (server/iscritti.ts) in una
 * lettura sola; ordinamento e ricerca sono locali, perche le persone sono
 * decine e un giro al server per riordinare sarebbe rumore. Il piano si
 * scrive con PUT sulla stessa rotta.
 *
 * Il contenuto delle giornate NON si vede: e cifrato con la chiave che
 * sta sul telefono. Qui le giornate si contano.
 */

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { AccountIscritto, OspiteIscritto } from "@/modules/admin/server/iscritti";

type Numeri = {
  account: number;
  nuoviSettimana: number;
  premium: number;
  premiumApple: number;
  premiumMano: number;
  ospiti: number;
  ospitiAttivi: number;
  aiEurMese: number;
};
type Risposta = { numeri?: Numeri; account?: AccountIscritto[]; ospiti?: OspiteIscritto[]; error?: string };

type Scheda = "account" | "ospiti";
type ColonnaAccount = "chi" | "iscritto" | "accesso" | "piano" | "giornate";
type ColonnaOspite = "chi" | "dal" | "uso" | "regalo" | "esito";
type Verso = "su" | "giu";

const GIORNO = 86_400_000;

/** "oggi", "ieri", oppure la data corta. `null` = mai. */
function quando(iso: string | null, t: (s: string) => string): string {
  if (!iso) return t("mai");
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return t("mai");
  const oggi = new Date();
  const inizioOggi = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate()).getTime();
  if (ms >= inizioOggi) return t("oggi");
  if (ms >= inizioOggi - GIORNO) return t("ieri");
  return formatDate(iso, { day: "numeric", month: "short" });
}

function quandoLungo(iso: string | null, t: (s: string) => string): string {
  if (!iso) return t("mai");
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return t("mai");
  return formatDate(iso, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** L'ordine del piano quando si clicca quella colonna: gratis, poi scaduto, poi premium. */
function pesoPiano(a: AccountIscritto): number {
  if (a.piano === "premium") return a.fonte === "apple" ? 3 : 2;
  return a.fonte === "apple" ? 1 : 0;
}

function confronta(a: string | number | null, b: string | number | null): number {
  if (a === b) return 0;
  if (a === null || a === "") return -1;
  if (b === null || b === "") return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { sensitivity: "base", numeric: true });
}

export function IscrittiSchermata({ onConteggio }: { onConteggio?: (n: number) => void }) {
  const t = useT();
  const [numeri, setNumeri] = useState<Numeri | null>(null);
  const [account, setAccount] = useState<AccountIscritto[]>([]);
  const [ospiti, setOspiti] = useState<OspiteIscritto[]>([]);
  const [errore, setErrore] = useState("");
  const [scheda, setScheda] = useState<Scheda>("account");
  const [cerca, setCerca] = useState("");
  const [ordAccount, setOrdAccount] = useState<{ col: ColonnaAccount; verso: Verso }>({ col: "iscritto", verso: "giu" });
  const [ordOspiti, setOrdOspiti] = useState<{ col: ColonnaOspite; verso: Verso }>({ col: "dal", verso: "giu" });
  const [scelto, setScelto] = useState<string | null>(null);
  const [cambio, setCambio] = useState<"" | "in-corso" | "errore">("");
  const [cambioTesto, setCambioTesto] = useState("");

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const resp = await apiFetch("/api/admin/iscritti", { method: "GET" });
        const body = (await resp.json().catch(() => null)) as Risposta | null;
        if (!vivo) return;
        if (!resp.ok || !body?.numeri) {
          setErrore(body?.error ?? t("Non sono riuscito a leggere gli iscritti."));
          return;
        }
        setNumeri(body.numeri);
        setAccount(body.account ?? []);
        setOspiti(body.ospiti ?? []);
        onConteggio?.(body.numeri.account);
      } catch {
        if (vivo) setErrore(t("Non sono riuscito a leggere gli iscritti."));
      }
    })();
    return () => {
      vivo = false;
    };
    // Una lettura sola al montaggio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtro = cerca.trim().toLowerCase();

  const accountVisti = useMemo(() => {
    const lista = filtro
      ? account.filter((a) => a.email.toLowerCase().includes(filtro) || (a.nome ?? "").toLowerCase().includes(filtro))
      : account.slice();
    const { col, verso } = ordAccount;
    const chiave = (a: AccountIscritto): string | number | null => {
      switch (col) {
        case "chi": return (a.nome ?? a.email).toLowerCase();
        case "iscritto": return Date.parse(a.iscrittoIl) || 0;
        case "accesso": return a.ultimoAccesso ? Date.parse(a.ultimoAccesso) || 0 : null;
        case "piano": return pesoPiano(a);
        case "giornate": return a.giornate;
      }
    };
    lista.sort((x, y) => {
      const c = confronta(chiave(x), chiave(y));
      return verso === "su" ? c : -c;
    });
    return lista;
  }, [account, filtro, ordAccount]);

  const ospitiVisti = useMemo(() => {
    const lista = filtro
      ? ospiti.filter((o) => o.id.toLowerCase().includes(filtro) || (o.esito.email ?? "").toLowerCase().includes(filtro))
      : ospiti.slice();
    const { col, verso } = ordOspiti;
    const chiave = (o: OspiteIscritto): string | number | null => {
      switch (col) {
        case "chi": return o.id;
        case "dal": return Date.parse(o.dal) || 0;
        case "uso": return Date.parse(o.ultimoUso) || 0;
        case "regalo": return o.usate;
        case "esito": return o.esito.tipo === "account" ? 2 : o.esito.tipo === "finito" ? 1 : 0;
      }
    };
    lista.sort((x, y) => {
      const c = confronta(chiave(x), chiave(y));
      return verso === "su" ? c : -c;
    });
    return lista;
  }, [ospiti, filtro, ordOspiti]);

  const persona = scelto ? account.find((a) => a.id === scelto) ?? null : null;

  function ordinaAccount(col: ColonnaAccount) {
    setOrdAccount((prev) => (prev.col === col ? { col, verso: prev.verso === "su" ? "giu" : "su" } : { col, verso: "su" }));
  }
  function ordinaOspiti(col: ColonnaOspite) {
    setOrdOspiti((prev) => (prev.col === col ? { col, verso: prev.verso === "su" ? "giu" : "su" } : { col, verso: "su" }));
  }

  async function cambiaPiano(piano: "free" | "premium") {
    if (!persona || persona.piano === piano) return;
    setCambio("in-corso");
    setCambioTesto("");
    try {
      const resp = await apiFetch("/api/admin/iscritti", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: persona.id, piano }),
      });
      const body = (await resp.json().catch(() => null)) as { piano?: "free" | "premium"; fonte?: string | null; messaggio?: string; error?: string } | null;
      if (!resp.ok || !body?.piano) {
        setCambio("errore");
        setCambioTesto(body?.messaggio ?? body?.error ?? t("Il salvataggio non e riuscito. Riprova."));
        return;
      }
      const fonte = body.fonte === "apple" || body.fonte === "manual" || body.fonte === "stripe" ? body.fonte : null;
      setAccount((prev) => prev.map((a) => (a.id === persona.id ? { ...a, piano: body.piano as "free" | "premium", fonte, scadenza: null } : a)));
      setNumeri((prev) => {
        if (!prev) return prev;
        const delta = piano === "premium" ? 1 : -1;
        return { ...prev, premium: prev.premium + delta, premiumMano: Math.max(0, prev.premiumMano + delta) };
      });
      setCambio("");
    } catch {
      setCambio("errore");
      setCambioTesto(t("Il salvataggio non e riuscito. Riprova."));
    }
  }

  const eur = (n: number) => formatCurrency(Math.round(n * 100) / 100, "EUR");

  if (errore) {
    return (
      <main className="jm-adm-main">
        <h1 className="jm-adm-h1">{t("Iscritti")}</h1>
        <p className="jm-adm-esito no">{errore}</p>
      </main>
    );
  }
  if (!numeri) return <main className="jm-adm-main" />;

  const testaAccount: { col: ColonnaAccount; testo: string; num?: boolean }[] = [
    { col: "chi", testo: t("Account") },
    { col: "iscritto", testo: t("Iscritto") },
    { col: "accesso", testo: t("Accesso") },
    { col: "piano", testo: t("Piano") },
    { col: "giornate", testo: t("Giornate"), num: true },
  ];
  const testaOspiti: { col: ColonnaOspite; testo: string; num?: boolean }[] = [
    { col: "chi", testo: t("Ospite") },
    { col: "dal", testo: t("Dal") },
    { col: "uso", testo: t("Ultimo uso") },
    { col: "regalo", testo: t("Regalo") },
    { col: "esito", testo: t("Esito") },
  ];

  const freccia = (attiva: boolean, verso: Verso) => (attiva ? (verso === "su" ? " ▴" : " ▾") : "");

  const pill = (a: AccountIscritto) => {
    if (a.piano === "premium") return <span className="jm-adm-isc-pill prem"><i />{t("Premium")}</span>;
    if (a.fonte === "apple") return <span className="jm-adm-isc-pill scad"><i />{t("Scaduto")}</span>;
    return <span className="jm-adm-isc-pill"><i />{t("Gratis")}</span>;
  };
  const fonte = (a: AccountIscritto): string => {
    if (a.fonte === "apple") {
      if (a.piano === "premium" && a.scadenza) return `${t("Apple, rinnova il")} ${formatDate(a.scadenza, { day: "numeric", month: "short" })}`;
      if (a.scadenza) return `${t("Apple, dal")} ${formatDate(a.scadenza, { day: "numeric", month: "short" })}`;
      return "Apple";
    }
    if (a.fonte === "manual" && a.piano === "premium") return t("a mano");
    if (a.fonte === "stripe") return "Stripe";
    return "";
  };
  const esito = (o: OspiteIscritto): string => {
    if (o.esito.tipo === "account") return `${t("con account")} ${o.esito.email || "—"}`;
    if (o.esito.tipo === "finito") return t("finito, senza account");
    return t("in corso");
  };

  const governatoDaApple = !!persona && persona.fonte === "apple" && persona.piano === "premium";

  return (
    <main className="jm-adm-main jm-adm-isc">
      <div className="jm-adm-isc-testa">
        <h1 className="jm-adm-h1">{t("Iscritti")}</h1>
        <div className="jm-adm-isc-seg" role="tablist">
          <button type="button" role="tab" aria-selected={scheda === "account"} className={scheda === "account" ? "on" : ""} onClick={() => setScheda("account")}>
            {t("Account")}<em>{numeri.account}</em>
          </button>
          <button type="button" role="tab" aria-selected={scheda === "ospiti"} className={scheda === "ospiti" ? "on" : ""} onClick={() => setScheda("ospiti")}>
            {t("Ospiti")}<em>{numeri.ospiti}</em>
          </button>
        </div>
        <input
          className="jm-adm-isc-cerca"
          type="search"
          value={cerca}
          onChange={(e) => setCerca(e.target.value)}
          placeholder={t("Cerca")}
          aria-label={t("Cerca")}
        />
      </div>

      <div className="jm-adm-isc-numeri">
        <div className="jm-adm-isc-box">
          <div className="k">{t("Account")}</div>
          <div className="n">{numeri.account}<small>{numeri.nuoviSettimana} {t("in piu questa settimana")}</small></div>
        </div>
        <div className="jm-adm-isc-box">
          <div className="k">{t("Premium")}</div>
          <div className="n">{numeri.premium}<small>{numeri.premiumApple} Apple, {numeri.premiumMano} {t("a mano")}</small></div>
        </div>
        <div className="jm-adm-isc-box">
          <div className="k">{t("Ospiti attivi")}</div>
          <div className="n">{numeri.ospitiAttivi}<small>{t("su")} {numeri.ospiti}, {t("negli ultimi 30 giorni")}</small></div>
        </div>
        <div className="jm-adm-isc-box">
          <div className="k">{t("AI, questo mese")}</div>
          <div className="n">{eur(numeri.aiEurMese)}<small>{t("tutti gli utenti, stima")}</small></div>
        </div>
      </div>

      <div className="jm-adm-isc-corpo">
        {scheda === "account" && (
          <div className="jm-adm-isc-tbl" role="table">
            <div className="jm-adm-isc-tr head" role="row">
              {testaAccount.map((c) => (
                <button
                  key={c.col}
                  type="button"
                  className={`${c.num ? "num r" : ""}${ordAccount.col === c.col ? " on" : ""}`}
                  onClick={() => ordinaAccount(c.col)}
                >
                  {c.testo}{freccia(ordAccount.col === c.col, ordAccount.verso)}
                </button>
              ))}
            </div>
            {accountVisti.map((a) => (
              <div
                key={a.id}
                role="row"
                className={`jm-adm-isc-tr${scelto === a.id ? " sel" : ""}`}
                onClick={() => { setScelto(a.id); setCambio(""); setCambioTesto(""); }}
              >
                <div className="chi"><b>{a.nome ?? a.email}</b><span>{a.nome ? a.email : t("senza nome")}</span></div>
                <div className="num">{quando(a.iscrittoIl, t)}</div>
                <div className="num">{quando(a.ultimoAccesso, t)}</div>
                <div>{pill(a)}{fonte(a) ? <span className="jm-adm-isc-fonte">{fonte(a)}</span> : null}</div>
                <div className="num r">{a.giornate}</div>
              </div>
            ))}
            {accountVisti.length === 0 && <div className="jm-adm-isc-vuoto">{t("Nessun account corrisponde.")}</div>}
          </div>
        )}

        {scheda === "ospiti" && (
          <div className="jm-adm-isc-tbl" role="table">
            <div className="jm-adm-isc-tr osp head" role="row">
              {testaOspiti.map((c) => (
                <button
                  key={c.col}
                  type="button"
                  className={ordOspiti.col === c.col ? "on" : ""}
                  onClick={() => ordinaOspiti(c.col)}
                >
                  {c.testo}{freccia(ordOspiti.col === c.col, ordOspiti.verso)}
                </button>
              ))}
            </div>
            {ospitiVisti.map((o) => (
              <div key={o.id} role="row" className="jm-adm-isc-tr osp">
                <div className="chi"><b>{o.id.slice(0, 4)}&hellip;{o.id.slice(-2)}</b><span>{o.devicecheck ? "iPhone" : t("senza DeviceCheck")}</span></div>
                <div className="num">{quando(o.dal, t)}</div>
                <div className="num">{quando(o.ultimoUso, t)}</div>
                <div className="num">{o.usate} {t("di")} {o.max}</div>
                <div className="num">{esito(o)}</div>
              </div>
            ))}
            {ospitiVisti.length === 0 && <div className="jm-adm-isc-vuoto">{t("Nessun ospite corrisponde.")}</div>}
          </div>
        )}

        {scheda === "account" && persona && (
          <aside className="jm-adm-isc-isp">
            <h2>{persona.nome ?? persona.email}</h2>
            <div className="mail">{persona.nome ? persona.email : t("senza nome")}</div>
            <div className="sez kv">
              <div><b>{t("Iscritto")}</b><span>{quandoLungo(persona.iscrittoIl, t)}</span></div>
              <div><b>{t("Accesso")}</b><span>{quandoLungo(persona.ultimoAccesso, t)}</span></div>
              <div><b>{t("Giornate")}</b><span>{persona.giornate}</span></div>
              <div><b>{t("AI, questo mese")}</b><span>{eur(persona.aiEurMese)}</span></div>
              <div><b>{t("Cassaforte")}</b><span>{persona.cassaforte ? t("chiusa") : t("aperta")}</span></div>
              <div><b>{t("Da ospite")}</b><span>{persona.ospitePrima ? `${t("si, dal")} ${quando(persona.ospitePrima, t)}` : t("mai ospite")}</span></div>
            </div>
            {persona.apple && (
              <div className="sez kv una">
                <div>
                  <b>Apple</b>
                  <span>
                    {[persona.apple.ambiente, persona.apple.prodotto?.split(".").pop(), persona.scadenza ? `${persona.piano === "premium" ? t("rinnova il") : t("scaduto il")} ${formatDate(persona.scadenza, { day: "numeric", month: "short" })}` : null, persona.apple.avviso ? `${t("ultimo avviso")} ${persona.apple.avviso}` : null]
                      .filter(Boolean)
                      .join(". ")}
                  </span>
                </div>
              </div>
            )}
            <div className="sez">
              <b className="k">{t("Piano")}</b>
              <div className={`jm-adm-isc-seg2${governatoDaApple ? " spento" : ""}`} role="radiogroup" aria-label={t("Piano")}>
                <button type="button" role="radio" aria-checked={persona.piano === "free"} className={persona.piano === "free" ? "on" : ""} disabled={governatoDaApple || cambio === "in-corso"} onClick={() => cambiaPiano("free")}>
                  {t("Gratis")}
                </button>
                <button type="button" role="radio" aria-checked={persona.piano === "premium"} className={persona.piano === "premium" ? "on" : ""} disabled={governatoDaApple || cambio === "in-corso"} onClick={() => cambiaPiano("premium")}>
                  {t("Premium")}
                </button>
              </div>
              <p className={`nota${cambio === "errore" ? " no" : ""}`}>
                {cambio === "errore"
                  ? cambioTesto
                  : governatoDaApple
                    ? t("Lo governa l'App Store: qui non si tocca.")
                    : persona.piano === "premium"
                      ? t("Premium a mano, senza scadenza. Se un giorno paga con Apple, Apple sovrascrive.")
                      : t("Cambiarlo scrive il piano a mano, senza scadenza.")}
              </p>
            </div>
          </aside>
        )}
      </div>
      <p className="jm-adm-isc-pie">{t("Le giornate sono chiuse nella cassaforte: qui si contano, non si leggono.")}</p>
    </main>
  );
}
