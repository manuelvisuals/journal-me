"use client";

/**
 * La striscia delle foto di un giorno, e il visore a schermo pieno
 * (mockup design/mockups/foto-rullino.html, approvato il 1 settembre 2026).
 *
 * Tre forme, una regola:
 *  - STRISCIA: quattro miniature al massimo; se ce ne sono di piu, la
 *    quarta casella dice quante altre ("+3") e apre la griglia SUL POSTO,
 *    senza cambiare pagina.
 *  - GRIGLIA: tutte le foto, quattro per riga.
 *  - VISORE: fondo nero, si sfoglia col dito, chiudi in alto a sinistra e
 *    elimina in basso a destra come nell'app Foto — un gesto raro non
 *    merita l'angolo piu in vista. Mentre la foto intera arriva si vede la
 *    miniatura ingrandita, mai un rettangolo vuoto.
 *
 * Se il giorno non ha foto il componente non disegna NIENTE: una giornata
 * senza foto non cambia di un pixel.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRitiraDock } from "@/components/ui/dock-sipario";
import {
  EVENTO_FOTO,
  aggiungiFoto as aggiungiFotoDati,
  annunciaFoto,
  elencoFoto,
  eliminaFoto,
  urlIntera,
  urlMiniatura,
  type FotoGiornata,
  type ModoFoto,
} from "@/modules/oggi/foto";
import { useStorageMode } from "@/lib/data/store";
import { formatDate, parseISODate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { toast } from "@/components/ui/toast";

const IN_STRISCIA = 4;

export function FotoGiorno({ date }: { date: string }) {
  const t = useT();
  const risolta = useStorageMode();
  const modo: ModoFoto | null =
    risolta === "local" || risolta === "cloud" ? risolta : null;

  const [foto, setFoto] = useState<FotoGiornata[]>([]);
  const [miniature, setMiniature] = useState<Record<string, string>>({});
  const [griglia, setGriglia] = useState<boolean>(false);
  const [aperta, setAperta] = useState<number | null>(null);
  /* Il campanello: aggiungere o togliere foto lo fa suonare (EVENTO_FOTO)
     e l'effetto qui sotto rilegge l'elenco. */
  const [giro, setGiro] = useState<number>(0);

  /* Cambio di giorno = stato azzerato, DURANTE il render e non in un
     effetto (il pattern che React documenta per "adjusting state when
     props change"; l'effetto con setState e vietato dal lint). */
  const [perData, setPerData] = useState<string>(date);
  if (perData !== date) {
    setPerData(date);
    setFoto([]);
    setGriglia(false);
    setAperta(null);
  }

  useEffect(() => {
    if (!modo) return;
    let vivo = true;
    void (async () => {
      let lista: FotoGiornata[];
      try {
        lista = await elencoFoto(modo, date);
      } catch {
        // Un elenco che non arriva non deve rompere la giornata: la
        // striscia semplicemente non compare, e al prossimo giro si riprova.
        return;
      }
      if (!vivo) return;
      setFoto(lista);
      // Le miniature arrivano una a una e si mostrano appena pronte:
      // aspettare l'ultima per disegnare la prima sarebbe la lentezza
      // che questa striscia esiste per non avere.
      for (const f of lista) {
        void urlMiniatura(modo, f).then((url) => {
          if (vivo && url) {
            setMiniature((m) => (m[f.id] === url ? m : { ...m, [f.id]: url }));
          }
        });
      }
    })();
    return () => {
      vivo = false;
    };
  }, [modo, date, giro]);

  useEffect(() => {
    const su = (e: Event) => {
      const day = (e as CustomEvent<{ day?: string }>).detail?.day;
      if (!day || day === date) setGiro((n) => n + 1);
    };
    window.addEventListener(EVENTO_FOTO, su);
    return () => window.removeEventListener(EVENTO_FOTO, su);
  }, [date]);

  if (!modo || foto.length === 0) return null;

  const oltre = foto.length - (IN_STRISCIA - 1);
  const mostraTile = !griglia && foto.length > IN_STRISCIA;
  const visibili = griglia
    ? foto
    : foto.slice(0, foto.length > IN_STRISCIA ? IN_STRISCIA - 1 : foto.length);

  return (
    <div className="jm-foto-wrap">
      <div className="jm-fv-social-l">{t("Foto del giorno")}</div>
      <div className={griglia ? "jm-foto-griglia" : "jm-foto-strip"}>
        {visibili.map((f, i) => (
          <button
            key={f.id}
            type="button"
            className="jm-foto-th"
            onClick={() => setAperta(i)}
            aria-label={t("foto {indice} di {totale}", {
              indice: String(i + 1),
              totale: String(foto.length),
            })}
          >
            {/* Blob locale o del bucket privato: next/image non sa
                ottimizzarlo, e la miniatura E gia l'ottimizzazione. */}
            {miniature[f.id] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={miniature[f.id]} alt="" loading="lazy" />
            )}
          </button>
        ))}
        {mostraTile && (
          <button
            type="button"
            className="jm-foto-th jm-foto-more"
            onClick={() => setGriglia(true)}
            aria-label={t("Mostra tutte le {n} foto", { n: String(foto.length) })}
          >
            +{oltre}
          </button>
        )}
      </div>

      {aperta !== null && foto[aperta] && (
        <VisoreFoto
          modo={modo}
          foto={foto}
          indice={aperta}
          miniature={miniature}
          onVai={setAperta}
          onChiudi={() => setAperta(null)}
          onEliminata={(f) => {
            setFoto((prima) => {
              const dopo = prima.filter((x) => x.id !== f.id);
              setAperta((idx) =>
                idx === null || dopo.length === 0
                  ? null
                  : Math.min(idx, dopo.length - 1),
              );
              return dopo;
            });
            annunciaFoto(date);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------- il visore a schermo pieno ------------------- */

function VisoreFoto({
  modo,
  foto,
  indice,
  miniature,
  onVai,
  onChiudi,
  onEliminata,
}: {
  modo: ModoFoto;
  foto: FotoGiornata[];
  indice: number;
  miniature: Record<string, string>;
  onVai: (i: number) => void;
  onChiudi: () => void;
  onEliminata: (f: FotoGiornata) => void;
}) {
  const t = useT();
  /* Superficie a schermo pieno: il dock non esiste finche e aperta
     (dock-sipario.ts). */
  useRitiraDock();
  const corrente = foto[indice];
  const [intere, setIntere] = useState<Record<string, string>>({});
  const [eliminando, setEliminando] = useState<boolean>(false);
  const tocco = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!corrente || intere[corrente.id]) return;
    let vivo = true;
    void urlIntera(modo, corrente).then((url) => {
      if (vivo && url) setIntere((m) => ({ ...m, [corrente.id]: url }));
    });
    return () => {
      vivo = false;
    };
  }, [modo, corrente, intere]);

  const prima = useCallback(() => {
    if (indice > 0) onVai(indice - 1);
  }, [indice, onVai]);
  const dopo = useCallback(() => {
    if (indice < foto.length - 1) onVai(indice + 1);
  }, [indice, foto.length, onVai]);

  useEffect(() => {
    const suTasto = (e: KeyboardEvent) => {
      if (e.key === "Escape") onChiudi();
      else if (e.key === "ArrowLeft") prima();
      else if (e.key === "ArrowRight") dopo();
    };
    window.addEventListener("keydown", suTasto);
    return () => window.removeEventListener("keydown", suTasto);
  }, [onChiudi, prima, dopo]);

  const elimina = async () => {
    if (eliminando || !corrente) return;
    if (!confirm(t("Togliere questa foto dalla giornata? Il rullino resta com'e."))) {
      return;
    }
    setEliminando(true);
    try {
      await eliminaFoto(modo, corrente);
      toast.ok(t("Foto eliminata"));
      onEliminata(corrente);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Errore"));
    } finally {
      setEliminando(false);
    }
  };

  if (!corrente) return null;
  const src = intere[corrente.id] ?? miniature[corrente.id] ?? null;
  const giorno = formatDate(parseISODate(corrente.day), {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div
      className="jm-foto-visore"
      role="dialog"
      aria-modal="true"
      aria-label={t("foto {indice} di {totale}", {
        indice: String(indice + 1),
        totale: String(foto.length),
      })}
      // Inline: la regola `body > *` di base.css (position relative,
      // z-index 1) batte le classi — stessa strada dell'overlay di
      // registrazione. La safe-area si prende con env(), come tutti gli
      // overlay a schermo pieno: stanno SOPRA la barra in alto.
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "#000",
        display: "flex",
        flexDirection: "column",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      onTouchStart={(e) => {
        tocco.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }}
      onTouchEnd={(e) => {
        const via = tocco.current;
        tocco.current = null;
        if (!via) return;
        const dx = e.changedTouches[0].clientX - via.x;
        const dy = e.changedTouches[0].clientY - via.y;
        if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
        if (dx > 0) prima();
        else dopo();
      }}
    >
      <div className="jm-foto-v-top">
        <button
          type="button"
          className="jm-foto-v-btn"
          onClick={onChiudi}
          aria-label={t("Chiudi")}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="jm-foto-v-corpo">
        {src && (
          // eslint-disable-next-line @next/next/no-img-element -- blob URL
          <img src={src} alt="" />
        )}
      </div>

      <div className="jm-foto-v-fondo">
        <span className="jm-foto-v-spazio" aria-hidden="true" />
        <div className="jm-foto-v-centro">
          <div className="jm-foto-v-conta">
            {t("{indice} di {totale}", {
              indice: String(indice + 1),
              totale: String(foto.length),
            })}
          </div>
          <div className="jm-foto-v-data">{giorno}</div>
        </div>
        <button
          type="button"
          className="jm-foto-v-btn"
          onClick={() => void elimina()}
          disabled={eliminando}
          aria-label={t("Elimina dalla giornata")}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ----------------------- la scelta dal rullino -------------------------- */

/**
 * Aggiunge al giorno i file scelti e avvisa chi mostra la striscia.
 * Vive qui e non in AddToDay perche il lavoro (ridurre, salvare,
 * annunciare) e delle foto, non del foglio.
 */
export async function aggiungiDalRullino(
  modo: ModoFoto,
  date: string,
  files: ArrayLike<File>,
  t: (k: string, p?: Record<string, string>) => string,
): Promise<void> {
  toast.loading(t("Aggiungo le foto..."));
  try {
    const fatte = await aggiungiFotoDati(modo, date, files);
    if (fatte === 0) {
      toast.error(t("Non sono riuscito ad aggiungere le foto. Riprova."));
      return;
    }
    annunciaFoto(date);
    toast.ok(
      fatte === 1 ? t("Foto aggiunta") : t("{n} foto aggiunte", { n: String(fatte) }),
    );
  } catch (err) {
    toast.error(
      err instanceof Error ? err.message : t("Non sono riuscito ad aggiungere le foto. Riprova."),
    );
  }
}
