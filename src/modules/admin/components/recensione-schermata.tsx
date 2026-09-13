"use client";

/**
 * La voce "Recensione" del pannello admin (13 settembre 2026; mockup
 * design/mockups/admin-iscritti.html, sezione 04, approvato da Manuel).
 *
 * L'interruttore che sveglia il foglio delle stelle di Apple dentro tutte
 * le app gia installate: il pezzo nativo e nel binario (dalla build 4),
 * questa riga sul server e cio che lo accende. Spenta di fabbrica.
 *
 * Due cose si scelgono: acceso/spento, e dopo quante giornate salvate su
 * quel telefono si chiede. Tre numeri si leggono: le richieste fatte da
 * sempre, quelle del mese, l'ultima. Sono le volte in cui un'app ha CHIESTO
 * il foglio ad Apple: se il foglio e comparso e se la persona ha scritto,
 * Apple non lo dice a nessuno.
 *
 * Si salva come le altre voci: le modifiche restano locali finche non si
 * preme "Salva", poi UNA scrittura (PUT /api/admin/recensione) e il server
 * dimentica la cache: le app la rileggono entro un giorno.
 */

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatDate, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { Recensione } from "@/lib/recensione-contract";

type Richieste = { totali: number; mese: number; ultima: string | null };
type Risposta = { recensione?: Recensione | null; updatedAt?: string | null; richieste?: Richieste; error?: string };

export function RecensioneSchermata() {
  const t = useT();
  const [salvato, setSalvato] = useState<Recensione | null>(null);
  const [bozza, setBozza] = useState<Recensione | null>(null);
  const [richieste, setRichieste] = useState<Richieste | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [errorePrimo, setErrorePrimo] = useState("");
  const [salvataggio, setSalvataggio] = useState<"" | "in-corso" | "fatto" | "errore">("");
  const [erroreTesto, setErroreTesto] = useState("");

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const resp = await apiFetch("/api/admin/recensione", { method: "GET" });
        const body = (await resp.json().catch(() => null)) as Risposta | null;
        if (!vivo) return;
        if (!resp.ok || !body?.recensione) {
          setErrorePrimo(body?.error ?? t("Non sono riuscito a leggere la recensione."));
          return;
        }
        setSalvato(body.recensione);
        setBozza(body.recensione);
        setRichieste(body.richieste ?? { totali: 0, mese: 0, ultima: null });
        setUpdatedAt(body.updatedAt ?? null);
      } catch {
        if (vivo) setErrorePrimo(t("Non sono riuscito a leggere la recensione."));
      }
    })();
    return () => {
      vivo = false;
    };
    // Una lettura sola al montaggio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sporco = !!bozza && !!salvato && (bozza.attiva !== salvato.attiva || bozza.giornateMinime !== salvato.giornateMinime);

  function tocca(patch: Partial<Recensione>) {
    setBozza((prev) => (prev ? { ...prev, ...patch } : prev));
    setSalvataggio("");
  }

  async function salva() {
    if (!bozza) return;
    setSalvataggio("in-corso");
    setErroreTesto("");
    try {
      const resp = await apiFetch("/api/admin/recensione", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attiva: bozza.attiva, giornate_minime: bozza.giornateMinime }),
      });
      const body = (await resp.json().catch(() => null)) as Risposta | null;
      if (!resp.ok || !body?.recensione) {
        setSalvataggio("errore");
        setErroreTesto(body?.error ?? t("Il salvataggio non e riuscito. Riprova."));
        return;
      }
      setSalvato(body.recensione);
      setBozza(body.recensione);
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
        <h1 className="jm-adm-h1">{t("Recensione")}</h1>
        <p className="jm-adm-esito no">{errorePrimo}</p>
      </main>
    );
  }
  if (!bozza || !salvato || !richieste) return <main className="jm-adm-main" />;

  return (
    <main className="jm-adm-main jm-adm-isc jm-adm-rec">
      <div className="jm-adm-isc-testa">
        <h1 className="jm-adm-h1">{t("Recensione")}</h1>
      </div>

      <div className="jm-adm-isc-numeri due">
        <div className="jm-adm-isc-box">
          <div className="k">{t("La richiesta")}</div>
          <div className="jm-adm-isc-seg2" role="radiogroup" aria-label={t("La richiesta")}>
            <button type="button" role="radio" aria-checked={!bozza.attiva} className={!bozza.attiva ? "on" : ""} onClick={() => tocca({ attiva: false })}>
              {t("Spenta")}
            </button>
            <button type="button" role="radio" aria-checked={bozza.attiva} className={bozza.attiva ? "on" : ""} onClick={() => tocca({ attiva: true })}>
              {t("Accesa")}
            </button>
          </div>
          <p className="nota">{t("Vale subito per tutte le app installate. Apple mostra il foglio al massimo tre volte l'anno per persona, e non dice se ha scritto la recensione.")}</p>
        </div>
        <div className="jm-adm-isc-box">
          <div className="k">{t("Quando")}</div>
          <label className="jm-adm-rec-campo">
            <input
              type="number"
              min={0}
              max={1000}
              value={bozza.giornateMinime}
              aria-label={t("Giornate salvate prima di chiedere")}
              onChange={(e) => tocca({ giornateMinime: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
            />
            <span>{t("giornate salvate, poi si chiede")}</span>
          </label>
          <p className="nota">{t("Nel momento in cui la giornata e appena salvata, mai all'avvio. Non piu di una richiesta ogni 120 giorni per telefono.")}</p>
        </div>
      </div>

      <div className="jm-adm-isc-numeri tre">
        <div className="jm-adm-isc-box">
          <div className="k">{t("Richieste")}</div>
          <div className="n">{formatNumber(richieste.totali)}<small>{t("da sempre")}</small></div>
        </div>
        <div className="jm-adm-isc-box">
          <div className="k">{t("Questo mese")}</div>
          <div className="n">{formatNumber(richieste.mese)}<small>{formatDate(new Date(), { month: "long" })}</small></div>
        </div>
        <div className="jm-adm-isc-box">
          <div className="k">{t("Ultima")}</div>
          <div className="n">
            {richieste.ultima ? formatDate(richieste.ultima, { day: "numeric", month: "short" }) : "–"}
            <small>{richieste.ultima ? formatDate(richieste.ultima, { hour: "2-digit", minute: "2-digit" }) : t("nessuna richiesta")}</small>
          </div>
        </div>
      </div>

      <div className="jm-adm-actions">
        <button type="button" className="jm-adm-btn" disabled={!sporco || salvataggio === "in-corso"} onClick={salva}>
          {salvataggio === "in-corso" ? t("Salvataggio...") : t("Salva le modifiche")}
        </button>
        <button type="button" className="jm-adm-btn ghost" disabled={!sporco} onClick={() => { setBozza(salvato); setSalvataggio(""); }}>
          {t("Annulla")}
        </button>
        {salvataggio === "fatto" && <span className="jm-adm-esito ok">{t("Salvato. Le app la rileggono entro un giorno.")}</span>}
        {salvataggio === "errore" && <span className="jm-adm-esito no">{erroreTesto}</span>}
        {salvataggio === "" && updatedAt && (
          <span className="jm-adm-ultima">{t("L'ultima modifica: {data}", { data: formatDate(updatedAt, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) })}</span>
        )}
      </div>
    </main>
  );
}
