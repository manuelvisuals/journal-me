"use client";

import { useEffect, useMemo, useState } from "react";

type MisureHero = {
  x: number;
  y: number;
  width: number;
  title: number;
};

const INIZIALI: MisureHero = { x: 50, y: 230, width: 440, title: 76 };

const CONTROLLI = [
  { nome: "x", etichetta: "Telefono: posizione orizzontale", min: 25, max: 75, unita: "%" },
  { nome: "y", etichetta: "Telefono: posizione verticale", min: 60, max: 520, unita: "px" },
  { nome: "width", etichetta: "Telefono: larghezza", min: 260, max: 680, unita: "px" },
  { nome: "title", etichetta: "Titolo: dimensione", min: 40, max: 86, unita: "px" },
] as const;

/** Isola client temporanea, montata dal server soltanto con ?debugHero=1. */
export function DebugHero() {
  const [misure, setMisure] = useState<MisureHero>(INIZIALI);
  const [copiato, setCopiato] = useState("");

  useEffect(() => {
    const home = document.querySelector<HTMLElement>(".jm-sito4");
    if (!home) return;
    home.style.setProperty("--jm-hero-phone-x", `${misure.x}%`);
    home.style.setProperty("--jm-hero-phone-y", `${misure.y}px`);
    home.style.setProperty("--jm-hero-phone-width", `${misure.width}px`);
    home.style.setProperty("--jm-hero-title-size", `${misure.title}px`);
  }, [misure]);

  const risultato = useMemo(
    () => `telefono_x=${misure.x}%; telefono_y=${misure.y}px; telefono_larghezza=${misure.width}px; headline=${misure.title}px`,
    [misure],
  );

  async function copia() {
    try {
      await navigator.clipboard.writeText(risultato);
      setCopiato("Copiato");
    } catch {
      setCopiato("Seleziona e copia la riga qui sopra");
    }
  }

  return (
    <aside className="jm-sito4-debug" aria-label="Controlli temporanei della hero">
      <div className="jm-sito4-debug-testa">
        <strong>Regola la hero</strong>
        <button type="button" onClick={() => { setMisure(INIZIALI); setCopiato(""); }}>Ripristina</button>
      </div>
      {CONTROLLI.map((controllo) => (
        <label key={controllo.nome}>
          <span>{controllo.etichetta}</span>
          <output>{misure[controllo.nome]}{controllo.unita}</output>
          <input
            type="range"
            name={controllo.nome}
            min={controllo.min}
            max={controllo.max}
            value={misure[controllo.nome]}
            onChange={(evento) => {
              setMisure((correnti) => ({ ...correnti, [controllo.nome]: Number(evento.target.value) }));
              setCopiato("");
            }}
          />
        </label>
      ))}
      <textarea readOnly rows={2} value={risultato} aria-label="Valori da inviare" />
      <div className="jm-sito4-debug-azioni">
        <button type="button" onClick={copia}>Copia i valori</button>
        <span aria-live="polite">{copiato}</span>
      </div>
    </aside>
  );
}
