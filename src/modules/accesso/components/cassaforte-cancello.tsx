"use client";

/**
 * Il cancello della cassaforte (SPEC ospite-e-cassaforte R8; mockup
 * design/mockups/codice-di-recupero.html, schermate 01 e 02).
 *
 * Montato dallo scheletro (AuthGate) SOLO in modalita cloud, quando la
 * cassaforte non e aperta su questo dispositivo:
 *
 *  - "assente": la cassaforte non esiste ancora -> si crea, e la persona
 *    vede le otto parole UNA volta: screenshot consigliato per primo, tasto
 *    Copia, casella "le ho salvate" che accende il tasto (scelta di Manuel,
 *    3 settembre 2026). Nessuna X: non si salta.
 *  - "chiusa": esiste sul server ma questo dispositivo non ha la chiave ->
 *    si chiedono le parole. L'errore dice QUALE parola non esiste, non
 *    "codice sbagliato". "Non ho il codice" dice la verita e le tre strade.
 *
 * Il tasto "Ricomincia da zero" e a due passi: la seconda conferma ripete
 * il numero di giornate che andranno perse.
 */
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import {
  creaCassaforte,
  ricominciaDaZero,
  sbloccaConParole,
  type StatoCassaforte,
} from "@/lib/cassaforte";
import { N_PAROLE, spezzaParole, parolaEsiste } from "@/lib/cassaforte/parole";
import { formatDate, parseISODate } from "@/lib/format";

type Props = {
  stato: Exclude<StatoCassaforte, "aperta" | "risolvendo" | "locale">;
  userId: string;
  /** Quante giornate chiuse ci sono sul server, e la piu vecchia (per dirlo). */
  giornate?: { quante: number; dal: string | null };
  onAperta: () => void;
};

export function CassaforteCancello({ stato, userId, giornate, onAperta }: Props) {
  if (stato === "assente") {
    return <ParoleNuove userId={userId} onFatto={onAperta} />;
  }
  return <ChiediParole userId={userId} giornate={giornate} onAperta={onAperta} />;
}

/* ---------------------- 01: le otto parole, una volta ---------------------- */

export function ParoleNuove({
  userId,
  onFatto,
  titolo,
  intro,
  crea,
}: {
  userId: string;
  onFatto: () => void;
  titolo?: string;
  intro?: string;
  /** Come si ottengono le parole: di default creando la cassaforte. */
  crea?: () => Promise<string[]>;
}) {
  const t = useT();
  const [parole, setParole] = useState<string[] | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [salvate, setSalvate] = useState(false);
  const [copiato, setCopiato] = useState(false);

  useEffect(() => {
    let vivo = true;
    (crea ?? (() => creaCassaforte(userId)))()
      .then((p) => {
        if (vivo) setParole(p);
      })
      .catch((e: unknown) => {
        if (vivo) setErrore((e as Error)?.message ?? String(e));
      });
    return () => {
      vivo = false;
    };
  }, [userId, crea]);

  async function copia() {
    if (!parole) return;
    try {
      await navigator.clipboard.writeText(parole.join(" "));
      setCopiato(true);
      setTimeout(() => setCopiato(false), 2500);
    } catch {
      setCopiato(false);
    }
  }

  return (
    <main className="jm-login-cassa">
      <div className="jm-login-cassa-col">
        <p className="jm-login-cassa-sopra">{t("Il tuo codice di recupero")}</p>
        <h1 className="jm-login-cassa-h1">{titolo ?? t("Otto parole. Sono la chiave del tuo diario.")}</h1>
        <p className="jm-login-cassa-p">
          {intro ??
            t(
              "Da adesso ogni giornata viene chiusa a chiave sul telefono prima di partire: sul server arriva un blocco illeggibile, e nessuno, nemmeno chi ha fatto questa app, puo aprirlo.",
            )}
        </p>

        {errore ? (
          <p className="jm-login-cassa-errore">{errore}</p>
        ) : (
          <ol className="jm-login-cassa-parole" aria-label={t("Il tuo codice di recupero")}>
            {(parole ?? Array.from({ length: N_PAROLE }, () => "")).map((p, i) => (
              <li key={i}>
                <i>{i + 1}</i>
                <span>{p || "•••••"}</span>
              </li>
            ))}
          </ol>
        )}

        <p className="jm-login-cassa-avviso">
          {t("Se perdi queste parole e perdi tutti i tuoi dispositivi, il diario non lo recupera nessuno. Neanche noi.")}
        </p>
        <p className="jm-login-cassa-p">
          <b>{t("Fai uno screenshot adesso")}</b>
          {", "}
          {t("o copiale: tienile in un posto che apri solo tu.")}
        </p>

        <Button variant="ghost" onClick={copia} disabled={!parole}>
          {copiato ? t("Copiate") : t("Copia le parole")}
        </Button>

        <label className="jm-login-cassa-check">
          <input
            type="checkbox"
            checked={salvate}
            onChange={(e) => setSalvate(e.target.checked)}
            disabled={!parole}
          />
          <span>{t("Le ho salvate")}</span>
        </label>

        <Button onClick={onFatto} disabled={!salvate || !parole}>
          {t("Ho capito, continua")}
        </Button>
      </div>
    </main>
  );
}

/* ---------------------- 02: un dispositivo senza la chiave ---------------------- */

function primaSconosciuta(parole: string[]): { posizione: number; parola: string } | null {
  for (let i = 0; i < parole.length; i++) {
    if (!parolaEsiste(parole[i])) return { posizione: i + 1, parola: parole[i] };
  }
  return null;
}

function ChiediParole({
  userId,
  giornate,
  onAperta,
}: {
  userId: string;
  giornate?: { quante: number; dal: string | null };
  onAperta: () => void;
}) {
  const t = useT();
  const [testo, setTesto] = useState("");
  const [busy, setBusy] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [nonHoIlCodice, setNonHoIlCodice] = useState(false);
  const [azzeraPasso, setAzzeraPasso] = useState<0 | 1>(0);
  const [paroleNuove, setParoleNuove] = useState(false);

  const creaDaZero = useCallback(() => ricominciaDaZero(userId), [userId]);
  const parole = spezzaParole(testo);
  // La prima parola che non esiste, se c'e: si segnala PRIMA di provare.
  const sconosciuta = primaSconosciuta(parole);
  const pronto = parole.length === N_PAROLE && !sconosciuta;

  async function apri() {
    setBusy(true);
    setErrore(null);
    try {
      const esito = await sbloccaConParole(userId, testo);
      if (esito.ok) {
        onAperta();
        return;
      }
      const m = esito.motivo;
      if (m.motivo === "sconosciuta") {
        setErrore(
          t("La parola numero {n} non esiste nell'elenco. Controlla: \"{parola}\".")
            .replace("{n}", String(m.posizione))
            .replace("{parola}", m.parola),
        );
      } else if (m.motivo === "numero") {
        setErrore(
          t("Servono {n} parole: ne hai scritte {q}.")
            .replace("{n}", String(N_PAROLE))
            .replace("{q}", String(m.quante)),
        );
      } else if (m.motivo === "controllo") {
        setErrore(t("Le parole esistono tutte, ma non nell'ordine giusto o non tutte di questo diario. Ricontrolla l'ordine."));
      } else {
        setErrore(t("Queste parole sono di un altro diario: non aprono questo."));
      }
    } catch (e) {
      setErrore((e as Error)?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  const n = giornate?.quante ?? 0;
  const dal = giornate?.dal
    ? formatDate(parseISODate(giornate.dal), { day: "numeric", month: "long" })
    : null;

  if (paroleNuove) {
    return (
      <ParoleNuove
        userId={userId}
        onFatto={onAperta}
        titolo={t("Un diario nuovo. Otto parole nuove.")}
        crea={creaDaZero}
      />
    );
  }

  if (nonHoIlCodice) {
    return (
      <main className="jm-login-cassa">
        <div className="jm-login-cassa-col">
          <p className="jm-login-cassa-sopra">{t("Non ho il codice")}</p>
          <h1 className="jm-login-cassa-h1">{t("Senza il codice, questo dispositivo non puo aprire il diario.")}</h1>
          <p className="jm-login-cassa-p">
            {t("Non esiste un \"ho dimenticato la password\": la chiave non ce l'abbiamo, e per questo il diario e tuo e basta.")}
          </p>
          <p className="jm-login-cassa-p">{t("Le strade che restano:")}</p>
          <ol className="jm-login-cassa-strade">
            <li>{t("Un iPhone, iPad o Mac con lo stesso Apple ID che ha gia aperto il diario: la chiave arriva da sola col portachiavi di iCloud, e da li puoi rivedere le parole in Impostazioni > Cassaforte.")}</li>
            <li>{t("Un file di backup salvato in passato: si importa e si legge da qui.")}</li>
            <li>
              {t("Ricominciare da zero, con un diario nuovo e un codice nuovo.")}{" "}
              {n > 0
                ? t("Le {n} giornate chiuse restano sul server, illeggibili, finche non le cancelli tu.").replace("{n}", String(n))
                : null}
            </li>
          </ol>
          {azzeraPasso === 0 ? (
            <Button variant="ghost" onClick={() => setAzzeraPasso(1)}>
              {t("Ricomincia da zero")}
            </Button>
          ) : (
            <>
              <p className="jm-login-cassa-avviso">
                {n > 0
                  ? t("Sicuro? Le {n} giornate chiuse non si potranno piu leggere, da nessun dispositivo.").replace("{n}", String(n))
                  : t("Sicuro? Il diario riparte vuoto, con un codice nuovo.")}
              </p>
              <Button onClick={() => setParoleNuove(true)}>{t("Si, ricomincia da zero")}</Button>
            </>
          )}
          <button type="button" className="jm-login-cassa-quiet" onClick={() => { setNonHoIlCodice(false); setAzzeraPasso(0); }}>
            {t("Indietro")}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="jm-login-cassa">
      <div className="jm-login-cassa-col">
        <p className="jm-login-cassa-sopra">{t("Il tuo diario e chiuso a chiave")}</p>
        <h1 className="jm-login-cassa-h1">
          {n > 0 && dal
            ? t("Ci sono {n} giornate, dal {dal}. Questo dispositivo non ha la chiave.")
                .replace("{n}", String(n))
                .replace("{dal}", dal)
            : t("Questo dispositivo non ha la chiave del tuo diario.")}
        </h1>
        <p className="jm-login-cassa-p">
          {t("Scrivi le otto parole del codice di recupero, nell'ordine. Le hai ricevute quando hai creato l'account.")}
        </p>
        <textarea
          className="jm-login-cassa-campo"
          value={testo}
          onChange={(e) => {
            setTesto(e.target.value);
            setErrore(null);
          }}
          placeholder={t("albero finestra dodici ...")}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          rows={3}
          aria-label={t("Il tuo codice di recupero")}
        />
        {sconosciuta ? (
          <p className="jm-login-cassa-errore">
            {t("La parola numero {n} non esiste nell'elenco. Controlla: \"{parola}\".")
              .replace("{n}", String(sconosciuta.posizione))
              .replace("{parola}", sconosciuta.parola)}
          </p>
        ) : errore ? (
          <p className="jm-login-cassa-errore">{errore}</p>
        ) : (
          <p className="jm-login-cassa-hint">{t("Le maiuscole e gli accenti non contano. Puoi incollarle tutte insieme.")}</p>
        )}
        <Button onClick={apri} disabled={!pronto || busy}>
          {busy ? t("Apro...") : t("Apri il diario")}
        </Button>
        <button type="button" className="jm-login-cassa-quiet" onClick={() => setNonHoIlCodice(true)}>
          {t("Non ho il codice")}
        </button>
      </div>
    </main>
  );
}
