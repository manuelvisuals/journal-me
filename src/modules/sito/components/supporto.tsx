"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { LinguaSito } from "@/modules/sito/seo";
import { testiDi } from "@/modules/sito/testi";

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
 * COSA VIAGGIA OLTRE A CIO CHE SI SCRIVE: browser e misura dello schermo.
 * Non e profilazione, e la meta delle risposte: "non si vede il tasto"
 * quasi sempre vuol dire una larghezza che non avevamo previsto. Non c'e
 * nessun identificativo, nessun cookie, nessuna analisi.
 */

const MAX_IMMAGINI = 3;
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

export function ModuloSupporto({ lingua }: { lingua: LinguaSito }) {
  const t = testiDi(lingua).supporto;
  const inputFile = useRef<HTMLInputElement | null>(null);

  const [oggetto, setOggetto] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [email, setEmail] = useState("");
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
          contesto: {
            ua: navigator.userAgent,
            schermo: `${window.innerWidth}x${window.innerHeight}`,
            lingua_browser: navigator.language,
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
