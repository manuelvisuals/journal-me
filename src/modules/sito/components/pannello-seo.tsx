"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useT } from "@/lib/i18n";
import {
  LIMITI,
  PAGINE,
  SEO_DI_FABBRICA,
  seoDaRiga,
  type LinguaSito,
  type PaginaSito,
  type RigaSeo,
} from "@/modules/sito/seo";

/**
 * Il pannello SEO dentro /admin (mockup design/mockups/sito-seo.html §04).
 *
 * Si sceglie la pagina e la lingua, e si scrivono le due cose che contano:
 * il titolo e la descrizione. Sotto, l'anteprima di come esce nel risultato
 * di Google.
 *
 * IL CONTATORE NON TAGLIA, AVVISA. Sessanta caratteri per il titolo e 155
 * per la descrizione non sono un limite tecnico: sono la lunghezza oltre la
 * quale Google taglia la frase con i puntini. Tagliare noi vorrebbe dire
 * decidere al posto suo dove finisce il pensiero; il numero che diventa
 * rosso lo dice e basta.
 *
 * QUELLO CHE QUESTO PANNELLO NON FA. Non tocca le frasi che si leggono
 * nella pagina (l'eroe, le domande, il piede): quelle vivono nel codice in
 * due lingue e si cambiano come si cambia un prodotto, con un mockup. Se un
 * giorno servira cambiarle da qui, sara una decisione, non uno scivolamento.
 */

type Stato = "carico" | "negato" | "pronto";

const VUOTA_PER_PAGINA = (p: PaginaSito): RigaSeo => ({ ...SEO_DI_FABBRICA[p] });

export function PannelloSeo() {
  const t = useT();
  const [stato, setStato] = useState<Stato>("carico");
  const [righe, setRighe] = useState<Record<string, RigaSeo>>({});
  const [pagina, setPagina] = useState<PaginaSito>("home");
  const [lingua, setLingua] = useState<LinguaSito>("it");
  const [sporco, setSporco] = useState(false);
  const [salvataggio, setSalvataggio] = useState<"" | "in-corso" | "fatto" | "errore">("");
  const [erroreTesto, setErroreTesto] = useState("");

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const resp = await apiFetch("/api/sito/seo", { method: "GET" });
        if (!vivo) return;
        if (!resp.ok) {
          setStato("negato");
          return;
        }
        const json = (await resp.json()) as { seo?: Record<string, unknown>[] };
        const mappa: Record<string, RigaSeo> = {};
        for (const p of PAGINE) mappa[p] = VUOTA_PER_PAGINA(p);
        for (const g of json.seo ?? []) {
          const riga = seoDaRiga(g);
          if (riga) mappa[riga.pagina] = riga;
        }
        setRighe(mappa);
        setStato("pronto");
      } catch {
        if (vivo) setStato("negato");
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  if (stato === "carico" || stato === "negato") return null;

  const riga = righe[pagina] ?? VUOTA_PER_PAGINA(pagina);
  const campoTitolo = lingua === "it" ? "titolo_it" : "titolo_en";
  const campoDesc = lingua === "it" ? "descrizione_it" : "descrizione_en";
  const campoOg = lingua === "it" ? "og_titolo_it" : "og_titolo_en";

  function cambia(campo: keyof RigaSeo, valore: string | boolean | null) {
    setRighe((prec) => ({
      ...prec,
      [pagina]: { ...(prec[pagina] ?? VUOTA_PER_PAGINA(pagina)), [campo]: valore },
    }));
    setSporco(true);
    setSalvataggio("");
  }

  async function salva() {
    if (salvataggio === "in-corso") return;
    setSalvataggio("in-corso");
    setErroreTesto("");
    try {
      const resp = await apiFetch("/api/sito/seo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(riga),
      });
      if (!resp.ok) {
        const json = (await resp.json().catch(() => ({}))) as { error?: string };
        setErroreTesto(json.error ?? String(resp.status));
        setSalvataggio("errore");
        return;
      }
      setSporco(false);
      setSalvataggio("fatto");
    } catch (e) {
      setErroreTesto(e instanceof Error ? e.message : "errore");
      setSalvataggio("errore");
    }
  }

  const indirizzo =
    "dayalogue.com" +
    (lingua === "en" ? "/en" : "") +
    (pagina === "support" ? "/support" : "");

  const conta = (valore: string, limite: number) => (
    <span className={valore.length > limite ? "lungo" : undefined}>
      {valore.length} / {limite}
    </span>
  );

  return (
    <div className="jm-sito-pan">
      <div className="jm-sito-gruppo">
        <p className="tit">{t("Pagina")}</p>
        <div className="jm-sito-riga">
          <div className="jm-sito-pan-scelte">
            {PAGINE.map((p) => (
              <button
                key={p}
                type="button"
                className={p === pagina ? "on" : undefined}
                onClick={() => setPagina(p)}
              >
                {p === "home" ? t("Pagina iniziale") : t("Assistenza")}
              </button>
            ))}
          </div>
          <div className="jm-sito-pan-scelte">
            {(["it", "en"] as const).map((l) => (
              <button
                key={l}
                type="button"
                className={l === lingua ? "on" : undefined}
                onClick={() => setLingua(l)}
              >
                {l === "it" ? t("Italiano") : t("Inglese")}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="jm-sito-gruppo">
        <p className="tit">{t("Come esce su Google")}</p>

        <div className="jm-sito-riga">
          <p className="k">{t("Titolo")}</p>
          <input
            className="jm-sito-in"
            value={riga[campoTitolo]}
            maxLength={200}
            onChange={(e) => cambia(campoTitolo, e.target.value)}
          />
          <p className="jm-sito-conta">
            <span>{t("Quello che si legge nella scheda del browser e in cima al risultato.")}</span>
            {conta(riga[campoTitolo], LIMITI.titolo)}
          </p>
        </div>

        <div className="jm-sito-riga">
          <p className="k">{t("Descrizione")}</p>
          <textarea
            className="jm-sito-in"
            style={{ minHeight: 84 }}
            value={riga[campoDesc]}
            maxLength={500}
            onChange={(e) => cambia(campoDesc, e.target.value)}
          />
          <p className="jm-sito-conta">
            <span>{t("Le due righe sotto il titolo, nel risultato di ricerca.")}</span>
            {conta(riga[campoDesc], LIMITI.descrizione)}
          </p>
        </div>

        <div className="jm-sito-riga">
          <p className="k">{t("Anteprima")}</p>
          <div className="jm-sito-anteprima">
            <p className="u">{indirizzo}</p>
            <p className="t">
              {riga[campoTitolo].trim() ||
                (lingua === "it"
                  ? SEO_DI_FABBRICA[pagina].titolo_it
                  : SEO_DI_FABBRICA[pagina].titolo_en)}
            </p>
            <p className="d">
              {riga[campoDesc].trim() ||
                (lingua === "it"
                  ? SEO_DI_FABBRICA[pagina].descrizione_it
                  : SEO_DI_FABBRICA[pagina].descrizione_en)}
            </p>
          </div>
        </div>
      </div>

      <div className="jm-sito-gruppo">
        <p className="tit">{t("Quando lo condividi")}</p>
        <div className="jm-sito-riga">
          <p className="k">{t("Titolo per i social")}</p>
          <input
            className="jm-sito-in"
            value={riga[campoOg]}
            maxLength={200}
            onChange={(e) => cambia(campoOg, e.target.value)}
          />
          <p className="jm-sito-conta">
            <span>{t("Vuoto = usa il titolo qui sopra.")}</span>
            {conta(riga[campoOg], LIMITI.ogTitolo)}
          </p>
        </div>
        <div className="jm-sito-riga">
          <p className="k">{t("Immagine di anteprima")}</p>
          <input
            className="jm-sito-in"
            value={riga.og_immagine ?? ""}
            maxLength={500}
            placeholder="/og-home.png"
            onChange={(e) => cambia("og_immagine", e.target.value)}
          />
          <p className="jm-sito-conta">
            <span>{t("L'indirizzo dell'immagine, 1200x630. Vuoto = nessuna immagine.")}</span>
          </p>
        </div>
      </div>

      <div className="jm-sito-gruppo">
        <p className="tit">{t("Visibilita")}</p>
        <div className="jm-sito-riga jm-sito-interr">
          <div>
            <p className="k">{t("Fatti trovare da Google")}</p>
            <p className="jm-sito-conta">
              <span>
                {t("Spento, la pagina resta online ma chiede ai motori di non indicizzarla.")}
              </span>
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={riga.indicizzabile}
            aria-label={t("Fatti trovare da Google")}
            className={riga.indicizzabile ? "jm-sito-sw on" : "jm-sito-sw"}
            onClick={() => cambia("indicizzabile", !riga.indicizzabile)}
          />
        </div>
      </div>

      <div className="jm-sito-salva">
        {salvataggio === "errore" ? (
          <span className="jm-sito-err">{erroreTesto}</span>
        ) : null}
        {salvataggio === "fatto" ? (
          <span className="jm-sito-conta">{t("Salvato")}</span>
        ) : null}
        <button
          type="button"
          className="jm-sito-b p"
          disabled={!sporco || salvataggio === "in-corso"}
          onClick={salva}
        >
          {salvataggio === "in-corso" ? t("Salvo...") : t("Salva le modifiche")}
        </button>
      </div>
    </div>
  );
}
