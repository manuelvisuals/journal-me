"use client";

/**
 * La schermata "Messaggio di benvenuto" del pannello admin.
 * Mockup approvato: design/mockups/messaggio-benvenuto.html (par. 04).
 *
 * COSA GOVERNA. Il riquadro che si apre una volta per ogni apertura
 * dell'app (src/modules/accesso/components/saluto-avvio.tsx). Testo in due
 * lingue, foto, i due loghi, l'interruttore e il tasto che fa cadere tutti
 * i "non mostrare piu".
 *
 * COME SI SALVA. Come per le Aree: le modifiche restano locali finche' non
 * si preme "Salva le modifiche", poi parte UNA scrittura sola. Il tasto
 * "Mostralo di nuovo" e' invece un'azione a se' e resta spento finche' ci
 * sono modifiche non salvate: rimettere in giro un messaggio con il testo
 * vecchio sarebbe il contrario di cio' che si voleva.
 *
 * LE IMMAGINI SI RIDUCONO QUI, NEL BROWSER. La riga ha un tetto di 48 KB
 * per immagine (migration 018): mandare il file originale e prenderne un
 * errore sarebbe far scoprire il limite a chi ha gia' aspettato il
 * caricamento. La foto si ritaglia al centro in quadrato (320px, JPEG); i
 * loghi si riducono dentro 256px e restano PNG, perche' hanno il fondo
 * trasparente e in JPEG diventerebbero un rettangolo bianco.
 */

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useT } from "@/lib/i18n";

type Dati = {
  attivo: boolean;
  versione: number;
  occhiello: string;
  promessa: string;
  evidenza: string;
  testo: string;
  firma: string;
  bottone: string;
  contatto_riga: string;
  contatto_url: string;
  occhiello_en: string;
  promessa_en: string;
  evidenza_en: string;
  testo_en: string;
  firma_en: string;
  bottone_en: string;
  contatto_riga_en: string;
  foto_data: string | null;
  logo_tema_chiaro_data: string | null;
  logo_tema_scuro_data: string | null;
};

const LATO_FOTO = 320;
const QUALITA_FOTO = 0.82;
const LATO_LOGO = 256;

/** Il file scelto, gia' ridotto: quadrato per la foto, dentro il riquadro per il logo. */
function riduci(file: File, quadrata: boolean): Promise<string> {
  return new Promise((risolvi, rifiuta) => {
    const lettore = new FileReader();
    lettore.onerror = () => rifiuta(new Error("lettura"));
    lettore.onload = () => {
      const im = new Image();
      im.onerror = () => rifiuta(new Error("immagine"));
      im.onload = () => {
        const tela = document.createElement("canvas");
        const ctx = tela.getContext("2d");
        if (!ctx) {
          rifiuta(new Error("canvas"));
          return;
        }
        if (quadrata) {
          // Ritaglio al centro: il lato corto decide.
          const lato = Math.min(im.width, im.height);
          const sx = (im.width - lato) / 2;
          const sy = (im.height - lato) / 2;
          tela.width = LATO_FOTO;
          tela.height = LATO_FOTO;
          // Fondo pieno: un PNG con trasparenza diventerebbe nero in JPEG.
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, LATO_FOTO, LATO_FOTO);
          ctx.drawImage(im, sx, sy, lato, lato, 0, 0, LATO_FOTO, LATO_FOTO);
          risolvi(tela.toDataURL("image/jpeg", QUALITA_FOTO));
          return;
        }
        const k = Math.min(LATO_LOGO / im.width, LATO_LOGO / im.height, 1);
        tela.width = Math.max(1, Math.round(im.width * k));
        tela.height = Math.max(1, Math.round(im.height * k));
        ctx.drawImage(im, 0, 0, tela.width, tela.height);
        risolvi(tela.toDataURL("image/png"));
      };
      im.src = String(lettore.result);
    };
    lettore.readAsDataURL(file);
  });
}

function SceltaImmagine({
  etichetta,
  aiuto,
  valore,
  difabbrica,
  tonda,
  fondoScuro,
  onScegli,
  onTogli,
}: {
  etichetta: string;
  aiuto: string;
  valore: string | null;
  difabbrica: string;
  tonda: boolean;
  fondoScuro?: boolean;
  onScegli: (dataUrl: string) => void;
  onTogli: () => void;
}) {
  const t = useT();
  const input = useRef<HTMLInputElement | null>(null);
  const [errore, setErrore] = useState("");

  async function scegli(file: File | undefined) {
    if (!file) return;
    setErrore("");
    try {
      const ridotta = await riduci(file, tonda);
      if (ridotta.length > 65536) {
        setErrore(t("L'immagine resta troppo grande anche dopo la riduzione: provane un'altra."));
        return;
      }
      onScegli(ridotta);
    } catch {
      setErrore(t("Questa immagine non si riesce ad aprire."));
    }
  }

  return (
    <div className="jm-adm-img">
      <div className="jm-adm-img-prov">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={tonda ? "tonda" : "quadra"}
          style={fondoScuro ? { background: "#241418" } : undefined}
          src={valore ?? difabbrica}
          alt=""
        />
        <div className="jm-adm-img-txt">
          <b>{etichetta}</b>
          {valore ? t("Sostituita da te") : t("Quella di fabbrica")}
        </div>
      </div>
      <div className="jm-adm-img-azioni">
        <button type="button" className="jm-adm-btn ghost" onClick={() => input.current?.click()}>
          {t("Scegli un file")}
        </button>
        <button
          type="button"
          className="jm-adm-btn ghost"
          disabled={valore === null}
          onClick={onTogli}
        >
          {t("Rimetti quella di fabbrica")}
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          void scegli(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <p className="jm-adm-img-aiuto">{errore || aiuto}</p>
    </div>
  );
}

export function BenvenutoSchermata() {
  const t = useT();
  const [dati, setDati] = useState<Dati | null>(null);
  const [errorePrimo, setErrorePrimo] = useState("");
  const [sporco, setSporco] = useState(false);
  const [salvataggio, setSalvataggio] = useState<"" | "in-corso" | "fatto" | "errore">("");
  const [erroreTesto, setErroreTesto] = useState("");
  const [rimesso, setRimesso] = useState(false);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const resp = await apiFetch("/api/admin/benvenuto", { method: "GET" });
        const body = (await resp.json().catch(() => null)) as
          | { benvenuto?: Dati; error?: string }
          | null;
        if (!vivo) return;
        if (!resp.ok || !body?.benvenuto) {
          setErrorePrimo(body?.error ?? t("Non sono riuscito a leggere il messaggio."));
          return;
        }
        setDati(body.benvenuto);
      } catch {
        if (vivo) setErrorePrimo(t("Non sono riuscito a leggere il messaggio."));
      }
    })();
    return () => {
      vivo = false;
    };
    // t e' stabile per render; la lettura si fa una volta sola.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function tocca(patch: Partial<Dati>) {
    setDati((prev) => (prev ? { ...prev, ...patch } : prev));
    setSporco(true);
    setSalvataggio("");
    setRimesso(false);
  }

  async function salva() {
    if (!dati) return;
    setSalvataggio("in-corso");
    setErroreTesto("");
    try {
      const resp = await apiFetch("/api/admin/benvenuto", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dati),
      });
      const body = (await resp.json().catch(() => null)) as
        | { benvenuto?: Dati; error?: string }
        | null;
      if (!resp.ok || !body?.benvenuto) {
        setSalvataggio("errore");
        setErroreTesto(body?.error ?? t("Il salvataggio non e riuscito. Riprova."));
        return;
      }
      setDati(body.benvenuto);
      setSporco(false);
      setSalvataggio("fatto");
    } catch {
      setSalvataggio("errore");
      setErroreTesto(t("Il salvataggio non e riuscito. Riprova."));
    }
  }

  async function mostraDiNuovo() {
    if (!dati) return;
    setSalvataggio("in-corso");
    setErroreTesto("");
    try {
      const resp = await apiFetch("/api/admin/benvenuto", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mostraDiNuovo: true }),
      });
      const body = (await resp.json().catch(() => null)) as
        | { benvenuto?: Dati; error?: string }
        | null;
      if (!resp.ok || !body?.benvenuto) {
        setSalvataggio("errore");
        setErroreTesto(body?.error ?? t("Il salvataggio non e riuscito. Riprova."));
        return;
      }
      setDati(body.benvenuto);
      setSalvataggio("");
      setRimesso(true);
    } catch {
      setSalvataggio("errore");
      setErroreTesto(t("Il salvataggio non e riuscito. Riprova."));
    }
  }

  if (errorePrimo) {
    return (
      <main className="jm-adm-main">
        <h1 className="jm-adm-h1">{t("Messaggio di benvenuto")}</h1>
        <p className="jm-adm-esito no">{errorePrimo}</p>
      </main>
    );
  }
  if (!dati) return <main className="jm-adm-main" />;

  return (
    <main className="jm-adm-main">
      <div className="jm-adm-bar">
        <div>
          <h1 className="jm-adm-h1">{t("Messaggio di benvenuto")}</h1>
          <p className="jm-adm-sub">
            {t(
              "Il riquadro che si apre una volta per ogni apertura dell'app. Si cambia da qui, senza rifare l'app: al prossimo avvio i telefoni collegati leggono il testo nuovo.",
            )}
          </p>
        </div>
        <div className="jm-adm-bar-actions">
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
          {t("Salvato. Chi apre l'app da adesso legge il testo nuovo.")}
        </p>
      )}
      {salvataggio === "errore" && <p className="jm-adm-esito no">{erroreTesto}</p>}
      {rimesso && (
        <p className="jm-adm-esito ok">
          {t("Fatto: al prossimo avvio il messaggio torna per tutti, una volta.")}
        </p>
      )}

      <section className="jm-adm-sez">
        <div className="jm-adm-sez-riga">
          <div>
            <div className="jm-adm-sez-t">{t("Mostra il messaggio")}</div>
            <p className="jm-adm-sez-d">{t("Spento, non lo vede piu nessuno.")}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={dati.attivo}
            aria-label={t("Mostra il messaggio")}
            className={`jm-adm-sw${dati.attivo ? "" : " off"}`}
            onClick={() => tocca({ attivo: !dati.attivo })}
          />
        </div>
      </section>

      <section className="jm-adm-sez">
        <div className="jm-adm-sez-riga">
          <div>
            <div className="jm-adm-sez-t">{t("Mostralo di nuovo a tutti")}</div>
            <p className="jm-adm-sez-d">
              {t(
                "Chi ha spuntato \"non mostrare piu\" non vedrebbe il testo nuovo. Questo tasto azzera tutte le spunte: al prossimo avvio il messaggio torna per tutti, una volta.",
              )}
            </p>
          </div>
          <button
            type="button"
            className="jm-adm-btn ghost"
            disabled={sporco || salvataggio === "in-corso"}
            onClick={mostraDiNuovo}
            title={sporco ? t("Salva prima le modifiche.") : undefined}
          >
            {t("Mostralo di nuovo")}
          </button>
        </div>
      </section>

      <section className="jm-adm-sez">
        <div className="jm-adm-sez-t">{t("Il testo")}</div>
        <p className="jm-adm-sez-d">
          {t(
            "Se l'inglese resta vuoto, chi ha il telefono in inglese vede l'italiano: meglio una frase nella lingua sbagliata che un riquadro vuoto.",
          )}
        </p>
        <div className="jm-adm-due">
          <div>
            <div className="jm-adm-lin">{t("Italiano")}</div>
            <label className="jm-adm-f">
              <span>{t("Occhiello")}</span>
              <input value={dati.occhiello} onChange={(e) => tocca({ occhiello: e.target.value })} />
            </label>
            <label className="jm-adm-f">
              <span>{t("Promessa")}</span>
              <textarea
                rows={3}
                value={dati.promessa}
                onChange={(e) => tocca({ promessa: e.target.value })}
              />
            </label>
            <label className="jm-adm-f">
              <span>{t("Riga in evidenza")}</span>
              <input value={dati.evidenza} onChange={(e) => tocca({ evidenza: e.target.value })} />
            </label>
            <label className="jm-adm-f">
              <span>{t("Il testo")}</span>
              <textarea
                rows={9}
                value={dati.testo}
                onChange={(e) => tocca({ testo: e.target.value })}
              />
              <small>{t("Riga vuota = paragrafo nuovo. *fra asterischi* = grassetto.")}</small>
            </label>
            <label className="jm-adm-f">
              <span>{t("Firma")}</span>
              <input value={dati.firma} onChange={(e) => tocca({ firma: e.target.value })} />
            </label>
            <label className="jm-adm-f">
              <span>{t("Testo del bottone")}</span>
              <input value={dati.bottone} onChange={(e) => tocca({ bottone: e.target.value })} />
            </label>
            <label className="jm-adm-f">
              <span>{t("Riga in fondo (facoltativa)")}</span>
              <input
                value={dati.contatto_riga}
                onChange={(e) => tocca({ contatto_riga: e.target.value })}
              />
            </label>
          </div>

          <div>
            <div className="jm-adm-lin">{t("Inglese")}</div>
            <label className="jm-adm-f">
              <span>{t("Occhiello")}</span>
              <input
                value={dati.occhiello_en}
                onChange={(e) => tocca({ occhiello_en: e.target.value })}
              />
            </label>
            <label className="jm-adm-f">
              <span>{t("Promessa")}</span>
              <textarea
                rows={3}
                value={dati.promessa_en}
                onChange={(e) => tocca({ promessa_en: e.target.value })}
              />
            </label>
            <label className="jm-adm-f">
              <span>{t("Riga in evidenza")}</span>
              <input
                value={dati.evidenza_en}
                onChange={(e) => tocca({ evidenza_en: e.target.value })}
              />
            </label>
            <label className="jm-adm-f">
              <span>{t("Il testo")}</span>
              <textarea
                rows={9}
                value={dati.testo_en}
                onChange={(e) => tocca({ testo_en: e.target.value })}
              />
              <small>{t("Riga vuota = paragrafo nuovo. *fra asterischi* = grassetto.")}</small>
            </label>
            <label className="jm-adm-f">
              <span>{t("Firma")}</span>
              <input value={dati.firma_en} onChange={(e) => tocca({ firma_en: e.target.value })} />
            </label>
            <label className="jm-adm-f">
              <span>{t("Testo del bottone")}</span>
              <input
                value={dati.bottone_en}
                onChange={(e) => tocca({ bottone_en: e.target.value })}
              />
            </label>
            <label className="jm-adm-f">
              <span>{t("Riga in fondo (facoltativa)")}</span>
              <input
                value={dati.contatto_riga_en}
                onChange={(e) => tocca({ contatto_riga_en: e.target.value })}
              />
            </label>
          </div>
        </div>

        <label className="jm-adm-f jm-adm-f-largo">
          <span>{t("Indirizzo della riga in fondo")}</span>
          <input
            className="mono"
            placeholder="https://..."
            value={dati.contatto_url}
            onChange={(e) => tocca({ contatto_url: e.target.value })}
          />
          <small>
            {t(
              "Vuoto, la riga in fondo non compare e la linguetta Feedback resta muta: un invito che non porta da nessuna parte e una promessa rotta al primo tocco. Appena c'e un indirizzo, si accendono tutte e due.",
            )}
          </small>
        </label>
      </section>

      <section className="jm-adm-sez">
        <div className="jm-adm-sez-t">{t("La foto")}</div>
        <p className="jm-adm-sez-d">
          {t("Quella tonda sopra il bordo. Si ritaglia al centro in quadrato e si riduce a 320px.")}
        </p>
        <SceltaImmagine
          etichetta={t("La foto")}
          aiuto={t("PNG o JPEG. Viene ritagliata al centro: se conta l'inquadratura, ritagliala prima tu.")}
          valore={dati.foto_data}
          difabbrica="/benvenuto-foto.jpg"
          tonda
          onScegli={(v) => tocca({ foto_data: v })}
          onTogli={() => tocca({ foto_data: null })}
        />
      </section>

      <section className="jm-adm-sez">
        <div className="jm-adm-sez-t">{t("Il logo")}</div>
        <p className="jm-adm-sez-d">
          {t(
            "Di fabbrica sono i due loghi dell'app, scelti da soli in base al tema. Qui si mette un logo diverso solo per il benvenuto, senza toccare splash, login e rail.",
          )}
        </p>
        <SceltaImmagine
          etichetta={t("Sui temi chiari")}
          aiuto={t("PNG con fondo trasparente. Sta sopra un fondo chiaro, quindi serve un segno scuro.")}
          valore={dati.logo_tema_chiaro_data}
          difabbrica="/logo.png"
          tonda={false}
          onScegli={(v) => tocca({ logo_tema_chiaro_data: v })}
          onTogli={() => tocca({ logo_tema_chiaro_data: null })}
        />
        <SceltaImmagine
          etichetta={t("Sui temi scuri")}
          aiuto={t("PNG con fondo trasparente. Sta sopra un fondo scuro, quindi serve un segno chiaro.")}
          valore={dati.logo_tema_scuro_data}
          difabbrica="/logo-chiaro.png"
          tonda={false}
          fondoScuro
          onScegli={(v) => tocca({ logo_tema_scuro_data: v })}
          onTogli={() => tocca({ logo_tema_scuro_data: null })}
        />
      </section>

      <section className="jm-adm-warn">
        <div className="t">{t("Tre cose che succedono davvero")}</div>
        <ul>
          <li>
            {t(
              "Il testo nuovo si vede al prossimo avvio dell'app, non subito su chi la sta gia usando.",
            )}
          </li>
          <li>
            {t(
              "Chi tiene il diario sul telefono in modalita locale non chiede niente alla rete: vede il testo cotto dentro il pacchetto, e quello nuovo arriva li solo con una build nuova dell'app.",
            )}
          </li>
          <li>
            {t(
              "Foto e loghi viaggiano dentro la riga, non in un deposito file: il tetto e 48 KB per immagine, come per la foto profilo.",
            )}
          </li>
        </ul>
      </section>
    </main>
  );
}
