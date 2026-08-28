"use client";

/**
 * Il nome, con la pennina per cambiarlo.
 * (Mockup design/mockups/nome-profilo.html, approvato da Manuel il 28
 * agosto 2026: "sul computer perfetto, sul telefono A".)
 *
 * Due pezzi, due superfici:
 *
 *  - `NomeRiga` — la colonna destra del computer: il nome, e accanto una
 *    pennina che compare al passaggio del mouse. Cliccandola il nome
 *    diventa un campo LI DOV'E, senza cambiare schermata: Invio salva, Esc
 *    annulla. La pennina non e fissa di proposito: una matita sempre
 *    accanto al nome, su una colonna che si guarda dieci volte al giorno,
 *    diventa rumore. Resta pero raggiungibile da tastiera (:focus-visible).
 *
 *  - `NomePanel` — la schermata del telefono, aperta dalla pennina che sta
 *    nella testata del menu dell'account (scheletro). Li lo spazio c'e, e
 *    un campo grande col contatore e piu onesto di un input minuscolo
 *    dentro un foglio.
 *
 * Cosa NON fanno: inventare il nome. Il nome mostrato quando non ne hai
 * scelto uno lo decide `nomeMostrato` in profilo-contract.ts, in un posto
 * solo — prima viveva in due, ed era la premessa di due nomi diversi nella
 * stessa schermata.
 */

import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { formatNumber } from "@/lib/format";
import { NOME_MAX, normalizzaNome } from "@/modules/impostazioni/profilo-contract";
import { salvaNomeProfilo, useProfilo } from "@/modules/impostazioni/profilo";

type Comuni = {
  /** L'email, per sapere su cosa si ricade quando il nome si svuota. */
  email: string | null;
  /** Il nome mostrato adesso: gia risolto da chi ci chiama. */
  mostrato: string;
  onNota?: (testo: string, errore?: boolean) => void;
};

/**
 * La riga del computer: nome + pennina, e la modifica in linea.
 * Non le serve l'email — su cosa si ricade svuotando il campo lo dice la
 * schermata del telefono, che ha lo spazio per spiegarlo; qui il campo e
 * largo tre centimetri e una frase in piu non ci sta.
 */
export function NomeRiga({ mostrato, onNota }: Omit<Comuni, "email">) {
  const t = useT();
  const [aperto, setAperto] = useState(false);
  const [testo, setTesto] = useState("");
  const [salvo, setSalvo] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  const apri = () => {
    setTesto(mostrato);
    setAperto(true);
  };

  useEffect(() => {
    if (aperto) {
      campo.current?.focus();
      campo.current?.select();
    }
  }, [aperto]);

  const conferma = async () => {
    if (salvo) return;
    const pulito = normalizzaNome(testo);
    setAperto(false);
    // Niente da fare se non e cambiato niente: si evita una scrittura
    // inutile ogni volta che si apre e si chiude il campo.
    if ((pulito ?? "") === (normalizzaNome(mostrato) ?? "") && pulito !== null) {
      return;
    }
    setSalvo(true);
    try {
      await salvaNomeProfilo(pulito);
      onNota?.(
        pulito === null
          ? t("Nome tolto. Torna quello della tua email.")
          : t("Adesso ti chiami {n}.", { n: pulito }),
      );
    } catch (err) {
      onNota?.(
        err instanceof Error ? err.message : t("Salvataggio non riuscito"),
        true,
      );
    } finally {
      setSalvo(false);
    }
  };

  if (!aperto) {
    return (
      <div className="jm-nome-riga">
        <div className="jm-st-nm">{mostrato}</div>
        <button
          type="button"
          className="jm-nome-penna"
          onClick={apri}
          disabled={salvo}
          aria-label={t("Cambia il tuo nome")}
        >
          <IconaPenna />
        </button>
      </div>
    );
  }

  return (
    <div className="jm-nome-edit">
      <input
        ref={campo}
        value={testo}
        maxLength={NOME_MAX}
        onChange={(e) => setTesto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void conferma();
          // Esc ANNULLA: chiude senza scrivere niente. E il patto di
          // qualunque campo che si apre in linea.
          if (e.key === "Escape") setAperto(false);
        }}
        aria-label={t("Il tuo nome")}
      />
      <button
        type="button"
        className="jm-nome-mini on"
        onClick={() => void conferma()}
        aria-label={t("Salva")}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 12l5 5L20 6" />
        </svg>
      </button>
      <button
        type="button"
        className="jm-nome-mini"
        onClick={() => setAperto(false)}
        aria-label={t("Annulla")}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}

/** La schermata del telefono, aperta dalla pennina nel menu. */
export function NomePanel({
  email,
  mostrato,
  onFatto,
  onNota,
}: Comuni & { onFatto: () => void }) {
  const t = useT();
  const profilo = useProfilo();
  const [testo, setTesto] = useState(mostrato);
  const [salvo, setSalvo] = useState(false);
  const pulito = normalizzaNome(testo);
  const scelto = profilo?.nome ?? null;
  // Il fondo su cui si ricade: si mostra in chiaro, cosi svuotare il campo
  // non e un salto nel buio.
  const ripiego = email && email.includes("@") ? email.split("@")[0] : t("ospite");

  const salva = async () => {
    if (salvo) return;
    setSalvo(true);
    try {
      await salvaNomeProfilo(pulito);
      onNota?.(
        pulito === null
          ? t("Nome tolto. Torna quello della tua email.")
          : t("Adesso ti chiami {n}.", { n: pulito }),
      );
      onFatto();
    } catch (err) {
      onNota?.(
        err instanceof Error ? err.message : t("Salvataggio non riuscito"),
        true,
      );
    } finally {
      setSalvo(false);
    }
  };

  return (
    <>
      <p className="jm-st-lede">
        {t("Come vuoi essere chiamato dentro l'app. L'email non cambia.")}
      </p>

      <input
        className="jm-nome-campo"
        value={testo}
        maxLength={NOME_MAX}
        autoComplete="name"
        onChange={(e) => setTesto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void salva();
        }}
        aria-label={t("Il tuo nome")}
      />
      <div className="jm-nome-conta">
        {`${formatNumber(testo.length)}/${formatNumber(NOME_MAX)}`}
      </div>

      {/* Svuotare il campo e una scelta legittima: si dice cosa succede,
          invece di lasciare indovinare. */}
      {pulito === null && (
        <p className="jm-nome-avviso">
          {t("Senza nome l'app ti chiama {n}, come la tua email.", { n: ripiego })}
        </p>
      )}

      <button
        type="button"
        className="btn-primary jm-nome-salva"
        onClick={() => void salva()}
        disabled={salvo || (pulito ?? "") === (scelto ?? "")}
      >
        {salvo ? t("salvo...") : t("Salva")}
      </button>
    </>
  );
}

export function IconaPenna() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
