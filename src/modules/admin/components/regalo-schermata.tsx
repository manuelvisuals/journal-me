"use client";

/**
 * La schermata "Regalo AI" del pannello admin (SPEC R4; mockup
 * design/mockups/ospite-primo-avvio.html, schermata 05, approvata da Manuel
 * il 4 settembre 2026). Prende il posto del segnaposto "Piani e limiti".
 *
 * Quattro cose, tutte cambiabili senza deploy: l'interruttore del regalo,
 * le giornate per ospite, il tetto mensile, e quanto e stato speso questo
 * mese (letto da ai_usage, in euro stimati, mai da una tabella pubblica).
 * Piu l'interruttore dell'ANNUALE (migration 024, decisione del 4
 * settembre): il prodotto puo esistere su App Store Connect e restare
 * nascosto finche questo e spento.
 *
 * COME SI SALVA. Come per le Aree e il benvenuto: le modifiche restano
 * locali finche non si preme "Salva le modifiche", poi parte UNA scrittura
 * (PUT /api/admin/regalo), e il server dimentica la sua cache: la guardia
 * delle route AI rilegge entro mezzo minuto.
 */

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { Regalo } from "@/lib/regalo";

type Mese = { spesoUsd: number; spesoEur: number; ospiti: number; giornate: number };
type Risposta = { regalo?: Regalo | null; updatedAt?: string | null; mese?: Mese; error?: string };

export function RegaloSchermata() {
  const t = useT();
  const [salvato, setSalvato] = useState<Regalo | null>(null);
  const [bozza, setBozza] = useState<Regalo | null>(null);
  const [mese, setMese] = useState<Mese | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [errorePrimo, setErrorePrimo] = useState("");
  const [salvataggio, setSalvataggio] = useState<"" | "in-corso" | "fatto" | "errore">("");
  const [erroreTesto, setErroreTesto] = useState("");

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const resp = await apiFetch("/api/admin/regalo", { method: "GET" });
        const body = (await resp.json().catch(() => null)) as Risposta | null;
        if (!vivo) return;
        if (!resp.ok || !body?.regalo) {
          setErrorePrimo(body?.error ?? t("Non sono riuscito a leggere il regalo."));
          return;
        }
        setSalvato(body.regalo);
        setBozza(body.regalo);
        setMese(body.mese ?? null);
        setUpdatedAt(body.updatedAt ?? null);
      } catch {
        if (vivo) setErrorePrimo(t("Non sono riuscito a leggere il regalo."));
      }
    })();
    return () => {
      vivo = false;
    };
    // t e stabile per render; la lettura si fa una volta sola.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sporco =
    !!bozza &&
    !!salvato &&
    (bozza.attivo !== salvato.attivo ||
      bozza.annualeAttivo !== salvato.annualeAttivo ||
      bozza.giornatePerOspite !== salvato.giornatePerOspite ||
      bozza.tettoMensileEur !== salvato.tettoMensileEur);

  function tocca(patch: Partial<Regalo>) {
    setBozza((prev) => (prev ? { ...prev, ...patch } : prev));
    setSalvataggio("");
  }

  async function salva() {
    if (!bozza) return;
    setSalvataggio("in-corso");
    setErroreTesto("");
    try {
      const resp = await apiFetch("/api/admin/regalo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attivo: bozza.attivo,
          annuale_attivo: bozza.annualeAttivo,
          giornate_per_ospite: bozza.giornatePerOspite,
          tetto_mensile_eur: bozza.tettoMensileEur,
        }),
      });
      const body = (await resp.json().catch(() => null)) as Risposta | null;
      if (!resp.ok || !body?.regalo) {
        setSalvataggio("errore");
        setErroreTesto(body?.error ?? t("Il salvataggio non e riuscito. Riprova."));
        return;
      }
      setSalvato(body.regalo);
      setBozza(body.regalo);
      setUpdatedAt(new Date().toISOString());
      setSalvataggio("fatto");
    } catch {
      setSalvataggio("errore");
      setErroreTesto(t("Il salvataggio non e riuscito. Riprova."));
    }
  }

  if (errorePrimo) {
    return (
      <main className="jm-adm-main">
        <h1 className="jm-adm-h1">{t("Regalo AI")}</h1>
        <p className="jm-adm-esito no">{errorePrimo}</p>
      </main>
    );
  }
  if (!bozza || !salvato) return <main className="jm-adm-main" />;

  const tetto = bozza.tettoMensileEur;
  const spesoEur = mese?.spesoEur ?? 0;
  const quota = tetto > 0 ? Math.min(1, spesoEur / tetto) : 0;

  return (
    <main className="jm-adm-main">
      <div className="jm-adm-bar">
        <div>
          <h1 className="jm-adm-h1">{t("Regalo AI")}</h1>
          <p className="jm-adm-sub">
            {t(
              "Le giornate con l'AI che regali a chi apre l'app senza account, e il tetto di spesa oltre il quale il regalo si spegne da solo. Si cambia qui e vale subito: nessun deploy.",
            )}
          </p>
        </div>
        <div className="jm-adm-bar-actions">
          {sporco && (
            <button
              type="button"
              className="jm-adm-btn ghost"
              disabled={salvataggio === "in-corso"}
              onClick={() => {
                setBozza(salvato);
                setSalvataggio("");
              }}
            >
              {t("Annulla")}
            </button>
          )}
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
        <p className="jm-adm-esito ok">{t("Salvato. Vale da adesso, entro mezzo minuto.")}</p>
      )}
      {salvataggio === "errore" && <p className="jm-adm-esito no">{erroreTesto}</p>}

      <section className="jm-adm-sez">
        <div className="jm-adm-sez-riga">
          <div>
            <div className="jm-adm-sez-t">{t("Il regalo")}</div>
            <p className="jm-adm-sez-d">
              {t(
                "Spento: gli ospiti nuovi non ricevono AI, chi ha gia iniziato una giornata la finisce. Le giornate gia scritte non cambiano.",
              )}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={bozza.attivo}
            aria-label={t("Il regalo")}
            className={`jm-adm-sw${bozza.attivo ? "" : " off"}`}
            onClick={() => tocca({ attivo: !bozza.attivo })}
          />
        </div>
      </section>

      <section className="jm-adm-sez">
        <div className="jm-adm-sez-t">{t("Giornate per ospite")}</div>
        <p className="jm-adm-sez-d">
          {t(
            "Una giornata conta una volta sola, anche se l'ospite la riapre. Cambiarlo vale per tutti, anche per chi e a meta.",
          )}
        </p>
        <label className="jm-adm-f jm-adm-f-num">
          <span>{t("Giornate con l'AI, una volta per dispositivo")}</span>
          <input
            type="number"
            min={0}
            max={1000}
            step={1}
            value={bozza.giornatePerOspite}
            onChange={(e) => tocca({ giornatePerOspite: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
          />
        </label>
      </section>

      <section className="jm-adm-sez">
        <div className="jm-adm-sez-t">{t("Tetto mensile")}</div>
        <p className="jm-adm-sez-d">
          {t(
            "Superato il tetto, il regalo si spegne da solo fino al primo del mese dopo. L'interruttore sopra resta com'e. Stimato sui listini in ai-usage.ts, cambio fisso.",
          )}
        </p>
        <label className="jm-adm-f jm-adm-f-num">
          <span>{t("EUR al mese")}</span>
          <input
            type="number"
            min={0}
            max={1000000}
            step={1}
            value={bozza.tettoMensileEur}
            onChange={(e) => tocca({ tettoMensileEur: Math.max(0, Number(e.target.value) || 0) })}
          />
        </label>
      </section>

      <section className="jm-adm-sez">
        <div className="jm-adm-sez-t">{t("Speso questo mese")}</div>
        <p className="jm-adm-sez-d">
          {t(
            "Somma delle chiamate AI degli ospiti da inizio mese (in euro stimati, cambio fisso). Gli abbonati non entrano nel conto.",
          )}
        </p>
        <div className="jm-adm-speso" data-speso-eur={spesoEur.toFixed(6)}>
          <b>{formatCurrency(spesoEur)}</b> {t("su")} {formatCurrency(tetto)} . {formatNumber(mese?.ospiti ?? 0)}{" "}
          {t("ospiti")} . {formatNumber(mese?.giornate ?? 0)} {t("giornate")}
        </div>
        <div className="jm-adm-barra" aria-hidden="true">
          <i style={{ width: `${Math.round(quota * 100)}%` }} />
        </div>
      </section>

      <section className="jm-adm-sez">
        <div className="jm-adm-sez-riga">
          <div>
            <div className="jm-adm-sez-t">{t("Annuale in vendita")}</div>
            <p className="jm-adm-sez-d">
              {t(
                "Acceso, il muro premium mostra anche la scheda dell'abbonamento annuale. Il prodotto deve esistere su App Store Connect (com.manuelvisuals.journalme.premium.annuale): se non c'e, la scheda non compare e nessuno se ne accorge.",
              )}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={bozza.annualeAttivo}
            aria-label={t("Annuale in vendita")}
            className={`jm-adm-sw${bozza.annualeAttivo ? "" : " off"}`}
            onClick={() => tocca({ annualeAttivo: !bozza.annualeAttivo })}
          />
        </div>
      </section>

      {updatedAt && (
        <p className="jm-adm-ultima">
          {t("L'ultima modifica: {data}", {
            data: formatDate(new Date(updatedAt), {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }),
          })}
        </p>
      )}
    </main>
  );
}
