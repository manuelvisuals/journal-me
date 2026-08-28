"use client";

/**
 * La foto profilo: la riga, le tre scelte, il ritaglio.
 * (Mockup design/mockups/foto-profilo-flusso.html, approvato da Manuel il
 * 28 agosto 2026.)
 *
 * Tutto il mestiere sta qui dentro e la riga si monta con una riga sola in
 * settings-client: il foglio, i due campi file, il ritaglio a schermo pieno,
 * il ridimensionamento e il salvataggio. Chi guarda la foto — il pallino
 * nell'intestazione e quello della rail — non sa niente di tutto questo: legge
 * `useFotoProfilo()` dalla porta del modulo.
 *
 * PERCHE IL RITAGLIO ESISTE. Non e un vezzo: senza, una foto da 4 MB
 * partirebbe intera per essere mostrata dentro un cerchio da 44 pixel. Qui
 * l'immagine viene ritagliata quadrata e ridisegnata a 256px in JPEG (~10 KB)
 * PRIMA di lasciare il telefono. E anche la ragione per cui il vincolo di
 * taglia sta nello schema (migration 016) e non solo in questa funzione.
 *
 * PERCHE DUE RIGHE PER "SCATTA" E "SCEGLI". Sul web sono lo stesso campo
 * file; dentro il guscio iOS `capture` porta alla fotocamera e senza porta
 * alla libreria. Due strade vere, quindi due righe — non una che si comporta
 * in due modi a seconda di dove gira.
 */

import { useEffect, useRef, useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { useT } from "@/lib/i18n";
import { SetRow } from "@/modules/impostazioni/components/rows";
import {
  salvaFotoProfilo,
  useFotoProfilo,
} from "@/modules/impostazioni/foto-profilo";
import {
  calcolaRitaglio,
  LATO_AVATAR,
  limitaSpostamento,
  QUALITA_AVATAR,
  scalaBase as scalaCheRiempie,
  ZOOM_MAX_AVATAR,
} from "@/modules/impostazioni/avatar-contract";

type Props = {
  /** L'iniziale da mostrare quando la foto non c'e. */
  iniziale: string;
  /** Per far comparire l'esito nella nota che le Impostazioni hanno gia. */
  onNota?: (testo: string, errore?: boolean) => void;
  /**
   * Due porte per la stessa cosa, perche le due superfici sono diverse:
   * sul telefono l'account e un gruppo di righe (`riga`), sul computer e
   * il ritratto nella rail destra, e li si tocca quello (`avatar`) —
   * come su Gmail o Slack. Il foglio che si apre e lo stesso.
   */
  variant?: "riga" | "avatar";
};

export function FotoProfiloRow({ iniziale, onNota, variant = "riga" }: Props) {
  const t = useT();
  const foto = useFotoProfilo();
  const [foglio, setFoglio] = useState(false);
  const [sorgente, setSorgente] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const daLibreria = useRef<HTMLInputElement>(null);
  const daFotocamera = useRef<HTMLInputElement>(null);

  const leggiFile = (file: File | null) => {
    if (!file) return;
    const lettore = new FileReader();
    lettore.onload = () => {
      setFoglio(false);
      setSorgente(String(lettore.result));
    };
    lettore.onerror = () => {
      setFoglio(false);
      onNota?.(t("Non sono riuscito a leggere questa immagine."), true);
    };
    lettore.readAsDataURL(file);
  };

  const salva = async (dati: string | null) => {
    setSalvo(true);
    try {
      await salvaFotoProfilo(dati);
      onNota?.(
        dati === null
          ? t("Foto tolta. Resta la tua iniziale.")
          : t("Foto profilo aggiornata."),
      );
    } catch (err) {
      onNota?.(
        err instanceof Error ? err.message : t("Salvataggio non riuscito"),
        true,
      );
    } finally {
      setSalvo(false);
      setSorgente(null);
    }
  };

  return (
    <>
      {variant === "riga" ? (
        <SetRow
          title={t("Foto profilo")}
          desc={t("Come ti vedi nel pallino in alto.")}
          control={
            <span className="jm-foto-mini" aria-hidden="true">
              {foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={foto} alt="" />
              ) : (
                iniziale
              )}
            </span>
          }
          onClick={() => setFoglio(true)}
          disabled={salvo}
          chevron
        />
      ) : (
        <button
          type="button"
          className="jm-foto-avbtn"
          onClick={() => setFoglio(true)}
          disabled={salvo}
          aria-label={t("Foto profilo")}
        >
          <span className="jm-st-av" aria-hidden="true">
            {foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={foto} alt="" />
            ) : (
              iniziale
            )}
          </span>
          <span className="jm-foto-avhov" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M3 7h3l2-2h8l2 2h3v13H3z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </span>
        </button>
      )}

      {/* I due campi: sul web fanno la stessa cosa, dentro il guscio iOS no. */}
      <input
        ref={daLibreria}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => leggiFile(e.target.files?.[0] ?? null)}
      />
      <input
        ref={daFotocamera}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => leggiFile(e.target.files?.[0] ?? null)}
      />

      {foglio && (
        <Sheet label={t("Foto profilo")} onClose={() => setFoglio(false)}>
          <div className="jm-foto-shhead">
            <span className="jm-foto-shav" aria-hidden="true">
              {foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={foto} alt="" />
              ) : (
                iniziale
              )}
            </span>
            <span className="jm-foto-shtxt">
              <span className="n">{t("Foto profilo")}</span>
              <span className="e">
                {t("Resta su questo account, non nel diario")}
              </span>
            </span>
          </div>

          <button
            type="button"
            className="jm-sheet-row"
            onClick={() => daFotocamera.current?.click()}
          >
            <span className="jm-sheet-ic" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M3 7h3l2-2h8l2 2h3v13H3z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </span>
            <span className="jm-sheet-txt">
              <span className="jm-sheet-t">{t("Scatta una foto")}</span>
            </span>
          </button>

          <button
            type="button"
            className="jm-sheet-row"
            onClick={() => daLibreria.current?.click()}
          >
            <span className="jm-sheet-ic" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M3 16l5-5 4 4 3-3 6 6" />
                <circle cx="8.5" cy="9" r="1.5" />
              </svg>
            </span>
            <span className="jm-sheet-txt">
              <span className="jm-sheet-t">{t("Scegli dalla libreria")}</span>
            </span>
          </button>

          {/* Solo se una foto c'e: un "togli" che non toglie niente e una
              riga che mente. */}
          {foto && (
            <>
              <div className="jm-foto-shsep" />
              <button
                type="button"
                className="jm-sheet-row jm-foto-danger"
                onClick={() => {
                  setFoglio(false);
                  void salva(null);
                }}
              >
                <span className="jm-sheet-ic" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
                  </svg>
                </span>
                <span className="jm-sheet-txt">
                  <span className="jm-sheet-t">
                    {t("Togli la foto, torna all'iniziale")}
                  </span>
                </span>
              </button>
            </>
          )}
        </Sheet>
      )}

      {sorgente && (
        <RitaglioSchermo
          sorgente={sorgente}
          occupato={salvo}
          onAnnulla={() => setSorgente(null)}
          onConferma={(dati) => void salva(dati)}
        />
      )}
    </>
  );
}

/**
 * Il ritaglio, a schermo pieno.
 *
 * Il cerchio che vedi E il ritaglio: quello che sta dentro parte, quello che
 * sta fuori no. La foto si trascina col dito (o col mouse) e si ingrandisce
 * col cursore, e non puo scoprire i bordi — gli spostamenti sono limitati
 * dalla misura dell'immagine, non lasciati liberi con un buco nero a lato.
 */
function RitaglioSchermo({
  sorgente,
  occupato,
  onAnnulla,
  onConferma,
}: {
  sorgente: string;
  occupato: boolean;
  onAnnulla: () => void;
  onConferma: (dati: string) => void;
}) {
  const t = useT();
  const palco = useRef<HTMLDivElement>(null);
  const trascino = useRef<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  /**
   * L'immagine caricata e il lato del palco stanno nello STATO, non in due
   * ref. Non e pignoleria: quello che si disegna dipende da entrambi, e un
   * valore da cui dipende il disegno letto durante il render e proprio cio
   * che React non garantisce aggiornato (react-hooks/refs). Il ref resta
   * solo per misurare l'elemento e per il trascinamento, che sono eventi.
   */
  const [im, setIm] = useState<{ el: HTMLImageElement; w: number; h: number } | null>(
    null,
  );
  const [lato, setLato] = useState(0);

  useEffect(() => {
    let vivo = true;
    const el = new Image();
    el.onload = () => {
      if (vivo) setIm({ el, w: el.naturalWidth, h: el.naturalHeight });
    };
    el.src = sorgente;
    return () => {
      vivo = false;
    };
  }, [sorgente]);

  // Il palco e quadrato ma la sua misura dipende dallo schermo: si misura,
  // non si indovina, e si rimisura se la finestra cambia (o se la tastiera
  // del telefono entra e esce).
  useEffect(() => {
    const nodo = palco.current;
    if (!nodo) return;
    const misura = () => setLato(nodo.clientWidth);
    misura();
    const ro = new ResizeObserver(misura);
    ro.observe(nodo);
    return () => ro.disconnect();
  }, []);

  const pronta = im !== null && lato > 0;

  // Scala, limiti e ritaglio vengono da avatar-contract.ts: e aritmetica,
  // e l'aritmetica si prova in Node invece di guardarla a occhio.
  const base = im ? scalaCheRiempie(im.w, im.h, lato) : 1;
  const k = base * zoom;

  const limita = (x: number, y: number, kk: number) =>
    im
      ? limitaSpostamento({ larghezza: im.w, altezza: im.h, lato, k: kk, x, y })
      : { x, y };

  const cambiaZoom = (z: number) => {
    setZoom(z);
    setOff((o) => limita(o.x, o.y, base * z));
  };

  const giu = (e: React.PointerEvent) => {
    trascino.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const muovi = (e: React.PointerEvent) => {
    const p = trascino.current;
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    trascino.current = { x: e.clientX, y: e.clientY };
    setOff((o) => limita(o.x + dx, o.y + dy, k));
  };
  const su = () => {
    trascino.current = null;
  };

  /**
   * Il ritaglio vero. Quello che si vede e quello che parte: la stessa
   * matematica del riquadro a schermo, applicata ai pixel dell'immagine.
   */
  const conferma = () => {
    if (!im || !lato) return;
    const r = calcolaRitaglio({
      larghezza: im.w,
      altezza: im.h,
      lato,
      k,
      off,
    });

    const tela = document.createElement("canvas");
    tela.width = LATO_AVATAR;
    tela.height = LATO_AVATAR;
    const ctx = tela.getContext("2d");
    if (!ctx) return;
    // Fondo pieno: un PNG con trasparenza diventerebbe nero in JPEG.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, LATO_AVATAR, LATO_AVATAR);
    ctx.drawImage(im.el, r.sx, r.sy, r.lato, r.lato, 0, 0, LATO_AVATAR, LATO_AVATAR);
    onConferma(tela.toDataURL("image/jpeg", QUALITA_AVATAR));
  };

  return (
    <div
      className="jm-foto-crop"
      role="dialog"
      aria-modal="true"
      aria-label={t("Sposta e ingrandisci")}
    >
      <div className="jm-foto-croptop">
        <button type="button" className="jm-foto-cropx" onClick={onAnnulla}>
          {t("Annulla")}
        </button>
        <span className="jm-foto-cropt">{t("Sposta e ingrandisci")}</span>
        <span className="jm-foto-cropsp" aria-hidden="true" />
      </div>

      <div
        className="jm-foto-palco"
        ref={palco}
        onPointerDown={giu}
        onPointerMove={muovi}
        onPointerUp={su}
        onPointerCancel={su}
      >
        {pronta && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="jm-foto-img"
            src={sorgente}
            alt=""
            draggable={false}
            style={{
              width: im.w * k,
              height: im.h * k,
              transform: `translate(calc(-50% + ${off.x}px), calc(-50% + ${off.y}px))`,
            }}
          />
        )}
        <div className="jm-foto-maschera" aria-hidden="true" />
      </div>

      <div className="jm-foto-cropfoot">
        <label className="jm-foto-zoom">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5M8 11h6" />
          </svg>
          <input
            type="range"
            min={1}
            max={ZOOM_MAX_AVATAR}
            step={0.01}
            value={zoom}
            onChange={(e) => cambiaZoom(Number(e.target.value))}
            aria-label={t("Ingrandisci")}
          />
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5M8 11h6M11 8v6" />
          </svg>
        </label>
        <button
          type="button"
          className="btn-primary jm-foto-usa"
          onClick={conferma}
          disabled={!pronta || occupato}
        >
          {occupato ? t("salvo...") : t("Usa questa foto")}
        </button>
      </div>
    </div>
  );
}
