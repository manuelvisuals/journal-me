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
import { conferma } from "@/components/ui/conferma";
import { toast } from "@/components/ui/toast";
import { formatCurrency, formatDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { AccountIscritto, OspiteIscritto, Percorso } from "@/modules/admin/server/iscritti";

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
type ColonnaOspite = "chi" | "dal" | "uso" | "percorso";
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
  const ora = formatDate(iso, { hour: "2-digit", minute: "2-digit" });
  const oggi = new Date();
  const inizioOggi = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate()).getTime();
  if (ms >= inizioOggi) return `${t("oggi")}, ${ora}`;
  if (ms >= inizioOggi - GIORNO) return `${t("ieri")}, ${ora}`;
  // L'anno solo se non e questo: la riga dell'ispettore e una sola.
  const stessoAnno = new Date(ms).getFullYear() === oggi.getFullYear();
  return `${formatDate(iso, stessoAnno ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" })}, ${ora}`;
}

/** Quante tappe sono raggiunte (per ordinare la colonna Percorso). */
function tappeRaggiunte(p: Percorso): number {
  return (p.prova ? 1 : 0) + (p.provaCompletata ? 1 : 0) + (p.account ? 1 : 0) + (p.premium ? 1 : 0);
}

/**
 * LA LINEA DELLA METROPOLITANA (mockup sez. 07, richiesta di Manuel:
 * "capire esattamente a che punto sono"). Quattro fermate fisse; pallino
 * pieno e tratto continuo fino a dove la persona e arrivata, tratteggio e
 * pallini vuoti per quello che manca. L'ultima fermata dice come e finita:
 * Premium, Premium a mano (pallino con l'anello), oppure Inattivo in grigio
 * quando la linea si e fermata prima della fine. `grande` = la versione
 * dell'ispettore, con le date sotto le fermate raggiunte.
 */
function LineaPercorso({ p, grande, t }: { p: Percorso; grande?: boolean; t: (s: string) => string }) {
  const data = (iso: string | null) => (grande && iso ? `, ${formatDate(iso, { day: "numeric", month: "short" })}` : "");
  const inattivo = p.fine === "inattivo";
  type Fermata = { nome: string; raggiunta: boolean; stile: "" | "vuota" | "grigia" | "mano"; forte?: boolean };
  const fermate: Fermata[] = [
    { nome: `${t("Prova")}${data(p.prova)}`, raggiunta: !!p.prova, stile: p.prova ? "" : "vuota" },
    { nome: `${t("Prova completata")}${data(p.provaCompletata)}`, raggiunta: !!p.provaCompletata, stile: p.provaCompletata ? "" : "vuota" },
  ];
  if (inattivo) {
    // La linea si e fermata: l'ultima fermata e grigia e si chiama col suo nome.
    fermate.push({ nome: t("Inattivo"), raggiunta: true, stile: "grigia", forte: true });
  } else {
    fermate.push({ nome: `${t("Account")}${data(p.account)}`, raggiunta: !!p.account, stile: p.account ? "" : "vuota" });
    fermate.push({
      nome: p.fine === "mano" ? t("Premium a mano") : t("Premium"),
      raggiunta: !!p.premium || p.fine === "premium" || p.fine === "mano",
      stile: p.fine === "mano" ? "mano" : p.premium || p.fine === "premium" ? "" : "vuota",
      forte: p.fine === "premium" || p.fine === "mano",
    });
  }
  return (
    <div className={`jm-adm-metro${grande ? " grande" : ""}`} aria-label={t("Percorso")}>
      {fermate.map((f, i) => {
        const prossima = fermate[i + 1];
        // Continuo solo fra due fermate raggiunte; grigio verso "Inattivo"; tratteggio altrimenti.
        const segmento = prossima ? (prossima.stile === "grigia" ? "grigio" : prossima.raggiunta && f.raggiunta ? "" : "tratt") : null;
        return (
          <span key={f.nome} className="jm-adm-metro-f">
            <span className={`st ${f.stile}`}><i /><span className={f.forte ? "forte" : ""}>{f.nome}</span></span>
            {segmento !== null && <span className={`seg ${segmento}`} />}
          </span>
        );
      })}
    </div>
  );
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
  // I numeri della scheda Ospiti sono le fermate: si contano qui, dalla lista.
  const tappe = useMemo(() => ({
    inProva: ospiti.filter((o) => o.percorso.prova && !o.percorso.provaCompletata && !o.percorso.account && o.percorso.fine !== "inattivo").length,
    completata: ospiti.filter((o) => o.percorso.provaCompletata && !o.percorso.account && o.percorso.fine !== "inattivo").length,
    conAccount: ospiti.filter((o) => !!o.percorso.account).length,
    premium: ospiti.filter((o) => o.percorso.fine === "premium" || o.percorso.fine === "mano").length,
    inattivi: ospiti.filter((o) => o.percorso.fine === "inattivo").length,
  }), [ospiti]);
  const [scelto, setScelto] = useState<string | null>(null);
  const [cambio, setCambio] = useState<"" | "in-corso">("");
  const [modificaPiano, setModificaPiano] = useState(false);

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
        case "percorso": return tappeRaggiunte(o.percorso) + (o.percorso.fine === "inattivo" ? -0.5 : 0);
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
    if (!persona || persona.piano === piano) {
      setModificaPiano(false);
      return;
    }
    const ok = await conferma(
      piano === "free"
        ? {
            titolo: t("Passare a Gratis?"),
            testo: <><b>{persona.email}</b> {t("perde subito l'AI e il cloud. Le giornate restano sue. Si puo rimettere Premium in qualunque momento.")}</>,
            azione: t("Passa a Gratis"),
          }
        : {
            titolo: t("Passare a Premium?"),
            testo: <><b>{persona.email}</b> {t("ha subito l'AI e il cloud, senza scadenza e senza pagare. Si puo togliere in qualunque momento.")}</>,
            azione: t("Passa a Premium"),
          },
    );
    if (!ok) {
      setModificaPiano(false);
      return;
    }
    setCambio("in-corso");
    try {
      const resp = await apiFetch("/api/admin/iscritti", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: persona.id, piano }),
      });
      const body = (await resp.json().catch(() => null)) as { piano?: "free" | "premium"; fonte?: string | null; messaggio?: string; error?: string } | null;
      if (!resp.ok || !body?.piano) {
        toast.error(body?.messaggio ?? body?.error ?? t("Il salvataggio non e riuscito. Riprova."));
        return;
      }
      const fonte = body.fonte === "apple" || body.fonte === "manual" || body.fonte === "stripe" ? body.fonte : null;
      setAccount((prev) => prev.map((a) => (a.id === persona.id ? { ...a, piano: body.piano as "free" | "premium", fonte, scadenza: null } : a)));
      setNumeri((prev) => {
        if (!prev) return prev;
        const delta = piano === "premium" ? 1 : -1;
        return { ...prev, premium: prev.premium + delta, premiumMano: Math.max(0, prev.premiumMano + delta) };
      });
      toast.ok(piano === "premium" ? t("Ora e Premium.") : t("Ora e Gratis."));
    } catch {
      toast.error(t("Il salvataggio non e riuscito. Riprova."));
    } finally {
      setCambio("");
      setModificaPiano(false);
    }
  }

  async function eliminaAccount() {
    if (!persona) return;
    const email = persona.email;
    const ok = await conferma({
      titolo: t("Eliminare l'account?"),
      testo: <>{t("Cancella")} <b>{email}</b>{t(": account, giornate, cassaforte, foto. Non si torna indietro. Per confermare scrivi l'email.")}</>,
      azione: t("Elimina"),
      pericolo: true,
      scrivi: email,
      scriviAiuto: t("scrivi l'email qui"),
    });
    if (!ok) return;
    const id = toast.loading(t("Elimino..."));
    try {
      const resp = await apiFetch("/api/admin/iscritti", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: persona.id }),
      });
      const body = (await resp.json().catch(() => null)) as { ok?: boolean; messaggio?: string; error?: string } | null;
      if (!resp.ok || !body?.ok) {
        toast.error(body?.messaggio ?? body?.error ?? t("Non sono riuscito a eliminare l'account."));
        return;
      }
      const eraPremium = persona.piano === "premium";
      setAccount((prev) => prev.filter((a) => a.id !== persona.id));
      setNumeri((prev) => (prev ? { ...prev, account: prev.account - 1, premium: prev.premium - (eraPremium ? 1 : 0) } : prev));
      onConteggio?.(account.length - 1);
      setScelto(null);
      toast.ok(t("Account eliminato."));
    } catch {
      toast.error(t("Non sono riuscito a eliminare l'account."));
    } finally {
      toast.hide(id);
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
    { col: "percorso", testo: t("Percorso") },
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
  const fonteLunga = (a: AccountIscritto): string => {
    if (a.fonte === "apple") {
      const data = a.scadenza ? formatDate(a.scadenza, { day: "numeric", month: "short" }) : "";
      if (a.piano === "premium") return data ? `${t("Apple, rinnova il")} ${data}` : "Apple";
      return data ? `${t("Apple, scaduto il")} ${data}` : t("Apple, scaduto");
    }
    if (a.fonte === "manual" && a.piano === "premium") return t("a mano, senza scadenza");
    if (a.fonte === "stripe") return "Stripe";
    return "";
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

      {scheda === "account" ? (
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
      ) : (
        <div className="jm-adm-isc-numeri">
          <div className="jm-adm-isc-box">
            <div className="k">{t("In prova")}</div>
            <div className="n">{tappe.inProva}<small>{t("hanno ancora giornate in regalo")}</small></div>
          </div>
          <div className="jm-adm-isc-box">
            <div className="k">{t("Prova completata")}</div>
            <div className="n">{tappe.completata}<small>{t("senza account")}</small></div>
          </div>
          <div className="jm-adm-isc-box">
            <div className="k">{t("Con account")}</div>
            <div className="n">{tappe.conAccount}<small>{t("di cui")} {tappe.premium} Premium</small></div>
          </div>
          <div className="jm-adm-isc-box">
            <div className="k">{t("Inattivi")}</div>
            <div className="n">{tappe.inattivi}<small>{t("niente da 30 giorni")}</small></div>
          </div>
        </div>
      )}

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
                onClick={() => { setScelto(a.id); setModificaPiano(false); }}
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
                <div><LineaPercorso p={o.percorso} t={t} /></div>
              </div>
            ))}
            {ospitiVisti.length === 0 && <div className="jm-adm-isc-vuoto">{t("Nessun ospite corrisponde.")}</div>}
          </div>
        )}

        {scheda === "account" && persona && (
          <aside className="jm-adm-isc-isp">
            <h2 title={persona.nome ?? persona.email}>{persona.nome ?? persona.email}</h2>
            <div className="mail" title={persona.email}>{persona.nome ? persona.email : t("senza nome")}</div>
            <div className="righe">
              <div className="r"><b>{t("Iscritto")}</b><span>{quandoLungo(persona.iscrittoIl, t)}</span></div>
              <div className="r"><b>{t("Ultimo accesso")}</b><span>{quandoLungo(persona.ultimoAccesso, t)}</span></div>
              <div className="r"><b>{t("Giornate")}</b><span>{persona.giornate}</span></div>
              <div className="r"><b>{t("AI, mese")}</b><span>{eur(persona.aiEurMese)}</span></div>
              <div className="r"><b>{t("Cassaforte")}</b><span>{persona.cassaforte ? t("chiusa") : t("aperta")}</span></div>
              {persona.apple && (
                <div className="r">
                  <b>Apple</b>
                  <span title={[persona.apple.ambiente, persona.apple.prodotto, persona.apple.avviso].filter(Boolean).join(", ")}>
                    {[persona.apple.ambiente && persona.apple.ambiente !== "Production" ? persona.apple.ambiente : null, persona.scadenza ? `${persona.piano === "premium" ? t("rinnova il") : t("scaduto il")} ${formatDate(persona.scadenza, { day: "numeric", month: "short" })}` : null].filter(Boolean).join(", ") || "—"}
                  </span>
                </div>
              )}
            </div>
            <div className="sez-percorso">
              <b className="k">{t("Percorso")}</b>
              <LineaPercorso p={persona.percorso} grande t={t} />
            </div>
            <div className="piano">
              <b className="k">{t("Piano")}</b>
              <div className="v">
                <div>
                  {persona.piano === "premium" ? t("Premium") : t("Gratis")}
                  <small>{fonteLunga(persona)}</small>
                </div>
                {!governatoDaApple && !modificaPiano && (
                  <button type="button" className="lnk" onClick={() => setModificaPiano(true)}>{t("Modifica")}</button>
                )}
                {!governatoDaApple && modificaPiano && (
                  <button type="button" className="lnk" onClick={() => setModificaPiano(false)}>{t("Annulla")}</button>
                )}
              </div>
              {modificaPiano && (
                <select
                  className="sel"
                  aria-label={t("Piano")}
                  value={persona.piano}
                  disabled={cambio === "in-corso"}
                  onChange={(e) => void cambiaPiano(e.target.value === "premium" ? "premium" : "free")}
                >
                  <option value="free">{t("Gratis")}</option>
                  <option value="premium">{t("Premium")}</option>
                </select>
              )}
            </div>
            <div className="azioni">
              <button type="button" className="btn d" disabled={persona.email.toLowerCase() === "madh52@gmail.com"} onClick={() => void eliminaAccount()}>
                {t("Elimina l'account...")}
              </button>
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}
