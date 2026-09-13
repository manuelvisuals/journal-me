"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { LinguaSito } from "@/modules/sito/seo";
import { testiDi } from "@/modules/sito/testi";
import {
  CAMPO_ESCA,
  MAX_IMMAGINI,
  MIN_MS_COMPILAZIONE,
} from "@/modules/sito/supporto-regole";

/**
 * Il modulo di assistenza di dayalogue.com/support.
 *
 * E l'UNICO pezzo di client del sito, e ha una buona ragione per esserlo:
 * qui si scrive e si allega. Tutto il resto della pagina (intestazione,
 * titolo, piede) e server-rendered dalla pagina che lo monta.
 *
 * LE IMMAGINI SI RIMPICCIOLISCONO QUI, NEL BROWSER. Una foto di iPhone e
 * 3-4 MB; ridotta a 1280px di lato lungo in JPEG diventa ~150 KB. Farlo
 * qui vuol dire che la rete di chi ci scrive da un treno regge, e che il
 * database non si riempie di roba che nessuno guardera mai a piena
 * risoluzione. Stessa scelta della foto profilo (migration 016): per
 * questa taglia un deposito file con le sue policy e i suoi URL firmati e
 * piu infrastruttura di quanta ne risparmi.
 *
 * LE DUE TRAPPOLE PER I ROBOT NON SI VEDONO E NON COSTANO UN CLIC (13
 * settembre 2026, scelta di Manuel: niente captcha). Un campo esca fuori
 * campo che solo un programma compila, e l'orologio: meno di tre secondi
 * dall'apertura non e una persona. Le regole NON vivono qui ma in
 * supporto-regole.ts, condivise con la rotta: se stessero in due posti
 * divergerebbero, e divergerebbero nel modo peggiore (il modulo dice "ok" e
 * il server dice "no").
 *
 * QUANDO SI ARRIVA DALLA LINGUETTA FEEDBACK DELL'APP la pagina riceve
 * l'email di chi sta scrivendo, la versione e la schermata di partenza:
 * arrivano dall'indirizzo e la PAGINA li passa qui come proprieta, gia
 * scritti nell'HTML del server. Leggerli qui dal browser vorrebbe dire un
 * primo render diverso fra server e client, cioe il difetto di idratazione
 * che si paga con una schermata che sfarfalla.
 *
 * COSA VIAGGIA OLTRE A CIO CHE SI SCRIVE: browser e misura dello schermo.
 * Non e profilazione, e la meta delle risposte: "non si vede il tasto"
 * quasi sempre vuol dire una larghezza che non avevamo previsto. Non c'e
 * nessun identificativo, nessun cookie, nessuna analisi.
 */

const LATO_MAX = 1280;
const QUALITA = 0.72;

async function riduci(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scala = Math.min(1, LATO_MAX / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scala));
    const h = Math.max(1, Math.round(bitmap.height * scala));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    return canvas.toDataURL("image/jpeg", QUALITA);
  } catch {
    return null;
  }
}

function emailPlausibile(v: string): boolean {
  // Volutamente larga: non e questo il posto dove decidere se un indirizzo
  // esiste. Serve solo a fermare la distrazione ("mario@" senza dominio).
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}

/** Cio che la linguetta dell'app sa gia di chi scrive. Tutto facoltativo:
 *  chi arriva da Google non ha niente di tutto questo. */
export type Precompilato = {
  email?: string;
  /** "app" quando si arriva dalla linguetta Feedback. */
  da?: string;
  versione?: string;
  schermata?: string;
};

export function ModuloSupporto({
  lingua,
  precompilato,
}: {
  lingua: LinguaSito;
  precompilato?: Precompilato;
}) {
  const t = testiDi(lingua).supporto;
  const inputFile = useRef<HTMLInputElement | null>(null);

  const [oggetto, setOggetto] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [email, setEmail] = useState(precompilato?.email ?? "");
  const [esca, setEsca] = useState("");

  // L'orologio parte al MONTAGGIO, non al primo tasto premuto: un robot che
  // compila e spedisce non preme niente, e una persona che apre la pagina e
  // legge sta gia consumando quel tempo senza accorgersene.
  const apertura = useRef<number>(0);
  useEffect(() => {
    apertura.current = Date.now();
  }, []);
  const [immagini, setImmagini] = useState<string[]>([]);
  const [stato, setStato] = useState<"" | "invio" | "fatto">("");
  const [errore, setErrore] = useState("");

  async function scegliFile(e: React.ChangeEvent<HTMLInputElement>) {
    const scelti = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (scelti.length === 0) return;
    if (immagini.length + scelti.length > MAX_IMMAGINI) {
      setErrore(t.troppeImmagini);
      return;
    }
    setErrore("");
    const ridotte: string[] = [];
    for (const f of scelti) {
      const d = await riduci(f);
      if (d) ridotte.push(d);
    }
    setImmagini((prec) => [...prec, ...ridotte].slice(0, MAX_IMMAGINI));
  }

  async function invia() {
    if (stato === "invio") return;
    if (oggetto.trim().length < 3) {
      setErrore(t.serveOggetto);
      return;
    }
    if (descrizione.trim().length < 10) {
      setErrore(t.serveDescrizione);
      return;
    }
    if (!emailPlausibile(email)) {
      setErrore(t.serveEmail);
      return;
    }
    setErrore("");
    setStato("invio");
    // Se una persona velocissima arriva prima della soglia non si rifiuta:
    // si aspetta il pezzetto che manca e si spedisce lo stesso. Il freno e
    // contro i robot, e un robot non aspetta.
    const passato = Date.now() - apertura.current;
    if (passato < MIN_MS_COMPILAZIONE) {
      await new Promise((r) => setTimeout(r, MIN_MS_COMPILAZIONE - passato + 60));
    }
    try {
      const resp = await fetch("/api/sito/supporto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oggetto: oggetto.trim(),
          descrizione: descrizione.trim(),
          email: email.trim(),
          lingua,
          immagini,
          msDaApertura: Date.now() - apertura.current,
          [CAMPO_ESCA]: esca,
          contesto: {
            ua: navigator.userAgent,
            schermo: `${window.innerWidth}x${window.innerHeight}`,
            lingua_browser: navigator.language,
            da: precompilato?.da ?? "",
            versione: precompilato?.versione ?? "",
            schermata: precompilato?.schermata ?? "",
          },
        }),
      });
      if (!resp.ok) throw new Error(String(resp.status));
      setStato("fatto");
    } catch {
      setStato("");
      setErrore(t.errore);
    }
  }

  if (stato === "fatto") {
    return (
      <div className="jm-sito-fatto">
        <p className="t">{t.fatto}</p>
        <p className="d">{t.fattoTesto}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="jm-sito-campo">
        <label htmlFor="jm-sup-oggetto">{t.oggetto}</label>
        <input
          id="jm-sup-oggetto"
          className="jm-sito-in"
          value={oggetto}
          maxLength={200}
          onChange={(e) => setOggetto(e.target.value)}
        />
      </div>

      <div className="jm-sito-campo">
        <label htmlFor="jm-sup-desc">{t.descrizione}</label>
        <textarea
          id="jm-sup-desc"
          className="jm-sito-in"
          value={descrizione}
          maxLength={5000}
          placeholder={t.descrizioneAiuto}
          onChange={(e) => setDescrizione(e.target.value)}
        />
      </div>

      <div className="jm-sito-campo">
        <label>{t.schermate}</label>
        <div className="jm-sito-foto">
          {immagini.map((src, i) => (
            <figure key={i}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" />
              <button
                type="button"
                className="x"
                aria-label="x"
                onClick={() => setImmagini((p) => p.filter((_, j) => j !== i))}
              >
                &times;
              </button>
            </figure>
          ))}
          {immagini.length < MAX_IMMAGINI ? (
            <button type="button" onClick={() => inputFile.current?.click()}>
              +
            </button>
          ) : null}
        </div>
        <input
          ref={inputFile}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={scegliFile}
        />
        <p className="jm-sito-aiuto">{t.schermateAiuto}</p>
      </div>

      <div className="jm-sito-campo">
        <label htmlFor="jm-sup-email">{t.email}</label>
        <input
          id="jm-sup-email"
          className="jm-sito-in"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          maxLength={320}
          onChange={(e) => setEmail(e.target.value)}
        />
        <p className="jm-sito-aiuto">{t.emailAiuto}</p>
      </div>

      {/* IL CAMPO ESCA. Non e display:none e non e hidden: alcuni robot
          saltano cio che e spento. E fuori campo, non raggiungibile col
          tabulatore e dichiarato invisibile ai lettori di schermo, quindi
          per una persona non esiste in nessuno dei modi in cui si usa una
          pagina. */}
      <div className="jm-sito-esca" aria-hidden="true">
        <label htmlFor={CAMPO_ESCA}>Azienda</label>
        <input
          id={CAMPO_ESCA}
          name={CAMPO_ESCA}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={esca}
          onChange={(e) => setEsca(e.target.value)}
        />
      </div>

      <div className="jm-sito-azioni">
        {errore ? <p className="jm-sito-err">{errore}</p> : null}
        <Link href="/" className="jm-sito-b g">
          {t.annulla}
        </Link>
        <button
          type="button"
          className="jm-sito-b p"
          disabled={stato === "invio"}
          onClick={invia}
        >
          {stato === "invio" ? t.inviando : t.invia}
        </button>
      </div>
    </div>
  );
}
