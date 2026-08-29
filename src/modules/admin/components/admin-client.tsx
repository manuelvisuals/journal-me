"use client";

/**
 * Il pannello admin: le impostazioni globali dell'app. Prima schermata: le
 * Aree. Mockup approvato: design/mockups/admin.html (ramo
 * worker-admin-mockup).
 *
 * CHI NON E ADMIN NON VEDE NIENTE. Il controllo vero sta sul server
 * (src/modules/admin/server.ts): questa pagina chiede GET /api/admin/aree
 * e, se la risposta e un no, non disegna nulla. Nessun messaggio, nessun
 * "non autorizzato": la pagina per chiunque altro semplicemente non esiste.
 *
 * COME SI SALVA. Ogni modifica (nome, testo, interruttore, ordine, area
 * nuova) resta locale finche non si preme "Salva le modifiche": UNA
 * scrittura sola, tutta insieme, sulla rotta admin. La chiave di un'area
 * esistente non si tocca mai; quella di un'area nuova e il nome del giorno
 * in cui nasce, e da li e ferma (il campo si congela al salvataggio).
 */

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { signalReady } from "@/lib/app-ready";
import { useStorageMode } from "@/lib/data/store";
import { useT } from "@/lib/i18n";

type Riga = {
  chiave: string;
  nome: string;
  nome_en: string;
  cosa_ci_va: string;
  ordine: number;
  icona: string | null;
  attiva: boolean;
  /** Nata in questa visita e mai salvata: la chiave segue ancora il nome. */
  nuova?: boolean;
};

type Stato = "carico" | "negato" | "pronto";

export function AdminClient() {
  const t = useT();
  const mode = useStorageMode();
  const [stato, setStato] = useState<Stato>("carico");
  const [righe, setRighe] = useState<Riga[]>([]);
  const [aperta, setAperta] = useState<string | null>(null);
  const [sporco, setSporco] = useState(false);
  const [salvataggio, setSalvataggio] = useState<"" | "in-corso" | "fatto" | "errore">("");
  const [erroreTesto, setErroreTesto] = useState("");

  // Il pannello esiste solo per un account cloud: in modalita locale non si
  // fa NEMMENO UNA richiesta di rete (SPEC-v2 §1), e senza sessione non c'e
  // niente da chiedere. E lo stesso "niente" di chi non e admin: si deriva
  // dal render (niente setState sincrono in un effect, lint React 19).
  const negatoSenzaCloud = mode !== "resolving" && mode !== "cloud";

  useEffect(() => {
    // Solo la splash: chi non entra non deve restarci sotto 4 secondi.
    if (negatoSenzaCloud) signalReady();
  }, [negatoSenzaCloud]);

  useEffect(() => {
    if (mode !== "cloud") return;
    let alive = true;
    (async () => {
      try {
        const resp = await apiFetch("/api/admin/aree", { method: "GET" });
        if (!alive) return;
        if (!resp.ok) {
          setStato("negato");
          signalReady();
          return;
        }
        const data = (await resp.json()) as { aree?: Riga[] };
        if (!alive) return;
        setRighe((data.aree ?? []).map((r) => ({ ...r })));
        setStato("pronto");
        signalReady();
      } catch {
        if (alive) {
          setStato("negato");
          signalReady();
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [mode]);

  // La pagina di chi non e admin: niente. Anche mentre carica: comparire e
  // poi sparire direbbe comunque che qui c'era qualcosa.
  if (negatoSenzaCloud || stato !== "pronto") return null;

  const ordinate = [...righe].sort((a, b) => a.ordine - b.ordine);

  function tocca(chiave: string, patch: Partial<Riga>) {
    setRighe((prev) =>
      prev.map((r) => (r.chiave === chiave ? { ...r, ...patch } : r)),
    );
    setSporco(true);
    setSalvataggio("");
  }

  /** Il nome di un'area NUOVA e ancora anche la sua chiave. */
  function toccaNome(chiave: string, nome: string) {
    setRighe((prev) =>
      prev.map((r) => {
        if (r.chiave !== chiave) return r;
        const next: Riga = { ...r, nome };
        if (r.nuova) next.chiave = nome.trim();
        return next;
      }),
    );
    if (aperta === chiave) {
      const r = righe.find((x) => x.chiave === chiave);
      if (r?.nuova) setAperta(nome.trim());
    }
    setSporco(true);
    setSalvataggio("");
  }

  function sposta(chiave: string, direzione: -1 | 1) {
    const i = ordinate.findIndex((r) => r.chiave === chiave);
    const j = i + direzione;
    if (i < 0 || j < 0 || j >= ordinate.length) return;
    const a = ordinate[i];
    const b = ordinate[j];
    setRighe((prev) =>
      prev.map((r) => {
        if (r.chiave === a.chiave) return { ...r, ordine: b.ordine };
        if (r.chiave === b.chiave) return { ...r, ordine: a.ordine };
        return r;
      }),
    );
    setSporco(true);
    setSalvataggio("");
  }

  function aggiungi() {
    // Una nuova alla volta: finche non ha un nome, la sua chiave e vuota e
    // una seconda riga vuota le si incollerebbe addosso.
    const giaVuota = righe.find((r) => r.nuova && r.chiave === "");
    if (giaVuota) {
      setAperta(giaVuota.chiave);
      return;
    }
    const massimo = righe.reduce((m, r) => Math.max(m, r.ordine), 0);
    const nuova: Riga = {
      chiave: "",
      nome: "",
      nome_en: "",
      cosa_ci_va: "",
      ordine: massimo + 10,
      icona: null,
      attiva: true,
      nuova: true,
    };
    setRighe((prev) => [...prev, nuova]);
    setAperta("");
    setSporco(true);
    setSalvataggio("");
  }

  async function salva() {
    const pulite = righe.filter((r) => r.chiave.trim() !== "" || r.nome.trim() !== "");
    const incomplete = pulite.filter(
      (r) => r.chiave.trim() === "" || r.nome.trim() === "" || r.nome_en.trim() === "",
    );
    if (incomplete.length > 0) {
      setSalvataggio("errore");
      setErroreTesto(t("A un'area manca il nome (italiano o inglese): completala o toglila."));
      return;
    }
    setSalvataggio("in-corso");
    setErroreTesto("");
    try {
      const resp = await apiFetch("/api/admin/aree", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aree: pulite.map((r) => ({
            chiave: r.chiave,
            nome: r.nome,
            nome_en: r.nome_en,
            cosa_ci_va: r.cosa_ci_va,
            ordine: r.ordine,
            icona: r.icona,
            attiva: r.attiva,
          })),
        }),
      });
      if (!resp.ok) {
        const data = (await resp.json().catch(() => null)) as { error?: string } | null;
        setSalvataggio("errore");
        setErroreTesto(data?.error ?? t("Il salvataggio non e riuscito. Riprova."));
        return;
      }
      // Da adesso le chiavi nuove sono ferme: non seguono piu il nome.
      setRighe((prev) => prev.map((r) => ({ ...r, nuova: false })));
      setSporco(false);
      setSalvataggio("fatto");
    } catch {
      setSalvataggio("errore");
      setErroreTesto(t("Il salvataggio non e riuscito. Riprova."));
    }
  }

  const rigaAperta = aperta === null ? null : righe.find((r) => r.chiave === aperta) ?? null;

  return (
    <div className="jm-adm">
      <aside className="jm-adm-rail">
        <div className="jm-adm-brand">
          dayalogue<i>.</i>
        </div>
        <div className="jm-adm-brand-sub">{t("Admin")}</div>
        <nav className="jm-adm-nav">
          <span className="jm-adm-nav-on">
            {t("Aree")} <em>{righe.length}</em>
          </span>
          <span className="jm-adm-nav-off">{t("Obiettivi di default")}</span>
          <span className="jm-adm-nav-off">{t("Messaggio di benvenuto")}</span>
          <span className="jm-adm-nav-off">{t("Modelli AI")}</span>
          <span className="jm-adm-nav-off">{t("Piani e limiti")}</span>
        </nav>
        <div className="jm-adm-who">
          <b>madh52@gmail.com</b>
          {t("l'unico che entra qui")}
        </div>
      </aside>

      <main className="jm-adm-main">
        <div className="jm-adm-bar">
          <div>
            <h1 className="jm-adm-h1">{t("Aree")}</h1>
            <p className="jm-adm-sub">
              {t(
                "Le caselle in cui l'AI divide una giornata. L'ordine e quello in cui si leggono nella schermata del giorno.",
              )}
            </p>
          </div>
          <div className="jm-adm-bar-actions">
            <button type="button" className="jm-adm-btn ghost" onClick={aggiungi}>
              {t("Aggiungi area")}
            </button>
            <button
              type="button"
              className="jm-adm-btn"
              disabled={!sporco || salvataggio === "in-corso"}
              onClick={salva}
            >
              {salvataggio === "in-corso" ? t("Salvataggio...") : t("Salva le modifiche")}
            </button>
          </div>
        </div>

        {salvataggio === "fatto" && (
          <p className="jm-adm-esito ok">
            {t("Salvato. La prossima giornata raccontata usa gia queste aree.")}
          </p>
        )}
        {salvataggio === "errore" && <p className="jm-adm-esito no">{erroreTesto}</p>}

        <div className="jm-adm-tbl">
          <div className="jm-adm-tr head">
            <div />
            <div>{t("Nome")}</div>
            <div>{t("Inglese")}</div>
            <div>{t("Cosa ci va (lo legge l'AI)")}</div>
            <div>{t("Attiva")}</div>
          </div>
          {ordinate.map((r, i) => (
            <div
              key={r.nuova ? `nuova-${i}` : r.chiave}
              className={`jm-adm-tr${r.nuova ? " nuova" : ""}${aperta === r.chiave ? " sel" : ""}`}
              onClick={() => setAperta(r.chiave)}
            >
              <div className="jm-adm-move" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  aria-label={t("Sposta su")}
                  disabled={i === 0}
                  onClick={() => sposta(r.chiave, -1)}
                >
                  &#8593;
                </button>
                <button
                  type="button"
                  aria-label={t("Sposta giu")}
                  disabled={i === ordinate.length - 1}
                  onClick={() => sposta(r.chiave, 1)}
                >
                  &#8595;
                </button>
              </div>
              <div>
                <div className="jm-adm-nome">
                  {r.nome || t("(senza nome)")}
                  {r.nuova && <span className="jm-adm-badge">{t("nuova")}</span>}
                </div>
                <div className="jm-adm-chiave">{r.chiave || "—"}</div>
              </div>
              <div className="jm-adm-en">{r.nome_en}</div>
              <div className="jm-adm-desc">{r.cosa_ci_va}</div>
              <div onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={r.attiva}
                  aria-label={t("Attiva")}
                  className={`jm-adm-sw${r.attiva ? "" : " off"}`}
                  onClick={() => tocca(r.chiave, { attiva: !r.attiva })}
                />
              </div>
            </div>
          ))}
        </div>

        {rigaAperta && (
          <section className="jm-adm-panel">
            <h3>{rigaAperta.nome || t("Area nuova")}</h3>
            <div className="jm-adm-grid">
              <label className="jm-adm-f">
                <span>{t("Nome (italiano)")}</span>
                <input
                  value={rigaAperta.nome}
                  onChange={(e) => toccaNome(rigaAperta.chiave, e.target.value)}
                />
              </label>
              <label className="jm-adm-f">
                <span>{t("Nome (inglese)")}</span>
                <input
                  value={rigaAperta.nome_en}
                  onChange={(e) => tocca(rigaAperta.chiave, { nome_en: e.target.value })}
                />
              </label>
              <label className="jm-adm-f full">
                <span>{t("Chiave")}</span>
                <input className="mono" value={rigaAperta.chiave} disabled readOnly />
                <small>
                  {t(
                    "Si sceglie una volta e non si cambia piu: e cio che viene scritto dentro ogni giornata. Per un'area nuova e il nome con cui nasce.",
                  )}
                </small>
              </label>
              <label className="jm-adm-f full">
                <span>{t("Cosa ci va")}</span>
                <textarea
                  rows={3}
                  value={rigaAperta.cosa_ci_va}
                  onChange={(e) => tocca(rigaAperta.chiave, { cosa_ci_va: e.target.value })}
                />
                <small>
                  {t(
                    "Finisce nelle istruzioni dell'AI, parola per parola. Le frasi che dicono cosa NON ci va sono quelle che funzionano meglio.",
                  )}
                </small>
              </label>
              <label className="jm-adm-f">
                <span>{t("Icona")}</span>
                <input
                  className="mono"
                  value={rigaAperta.icona ?? ""}
                  onChange={(e) =>
                    tocca(rigaAperta.chiave, {
                      icona: e.target.value.trim() === "" ? null : e.target.value,
                    })
                  }
                />
                <small>
                  {t(
                    "Facoltativa. I disegni esistenti: lavoro, relazioni, cibo, movimento, emozioni. Vuota = nessun disegno (Corpo non ne ha mai avuto uno).",
                  )}
                </small>
              </label>
            </div>
            <div className="jm-adm-actions">
              <button
                type="button"
                className="jm-adm-btn ghost"
                onClick={() => setAperta(null)}
              >
                {t("Chiudi")}
              </button>
            </div>
          </section>
        )}

        <section className="jm-adm-warn">
          <div className="t">{t("Prima di salvare, tre cose che succedono davvero")}</div>
          <ul>
            <li>
              {t(
                "Le giornate gia salvate non si riclassificano: cio che e stato assegnato resta dov'e.",
              )}
            </li>
            <li>
              {t(
                "Ogni casella in piu e una scelta in piu per l'AI: con troppe caselle, qualcuna restera vuota quasi sempre.",
              )}
            </li>
            <li>
              {t(
                "Un'area spenta non cancella nulla: smette di essere assegnata da oggi, e le giornate vecchie continuano a mostrarla.",
              )}
            </li>
          </ul>
        </section>

        <p className="jm-adm-nota">
          {t(
            "Chi tiene il diario sul telefono in modalita locale vede le aree cotte dentro il pacchetto: le aree nuove arrivano li solo con una build nuova dell'app.",
          )}
        </p>
      </main>
    </div>
  );
}
