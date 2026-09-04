"use client";

/**
 * La porta dell'account (mockup design/mockups/porta-account.html, scelto
 * da Manuel il 28 agosto 2026: desktop B + iOS A).
 *
 * Il pallino con l'iniziale — che era un <div> morto in fondo alla rail —
 * diventa IL punto da cui si arriva a Impostazioni, Premium e all'uscita.
 * Due vesti, un solo contenuto:
 *
 *  - variant "rail": il blocco account della rail desktop, ora bottone;
 *    il menu e un popover ancorato sopra (Esc, click fuori e scelta
 *    chiudono; il fuoco torna sul bottone; aria-expanded segue lo stato;
 *    su /settings il bottone resta acceso — dice dove sei).
 *  - variant "testata": il pallino 44x44 nelle intestazioni del telefono;
 *    il menu e il foglio dal basso (la primitiva Sheet), chiuso dal velo.
 *
 * Le voci, dal contratto §03 — e quando compare ciascuna:
 *  - testata: nome ed email; in locale "Questo dispositivo" e "Le
 *    giornate non escono di qui";
 *  - Impostazioni -> /settings, sempre;
 *  - Passa a Premium -> openPremiumWall("aiSummary"), solo cloud non
 *    premium; nel guscio iOS l'etichetta e "Scopri Premium" e non si
 *    stampa nessun prezzo (App Store 3.1.1, stessa regola della card
 *    delle Impostazioni);
 *  - Accedi al tuo account -> /login, solo in locale, al posto delle due
 *    voci sopra;
 *  - Esci dall'account, in rosso dopo un separatore, solo cloud. E il
 *    logout VERO: src/lib/auth/logout.ts, lo stesso delle Impostazioni.
 */

import { useEffect, useRef, useState } from "react";
import { pianoEffettivo } from "@/lib/piano";
import { usePathname, useRouter } from "next/navigation";
import { resolveStorageMode, useStorageMode } from "@/lib/data/store";
import { usePlan } from "@/lib/plan";
import { isNative } from "@/lib/native/platform";
import { eseguiLogout } from "@/lib/auth/logout";
import { openPremiumWall } from "@/modules/abbonamento";
// Nome e foto li SA il modulo impostazioni (e li che si cambiano), li
// MOSTRA lo scheletro: escono dalla porta come il muro premium di
// abbonamento.
import {
  apriPannelloNome,
  useNomeMostrato,
  useProfilo,
} from "@/modules/impostazioni";
import { Sheet } from "@/components/ui/sheet";
import { useT } from "@/lib/i18n";

type Account = { email: string | null; badge: string };

/**
 * Chi sei, per il pallino e per la testata del menu: l'email e il badge del
 * piano. Il NOME non si calcola piu qui — la regola "nome scelto, altrimenti
 * l'email tagliata alla chiocciola" vive in un posto solo
 * (nomeMostrato, modulo impostazioni), perche viveva in due e un nome scelto
 * che ne raggiungesse uno solo avrebbe mostrato due nomi diversi nella
 * stessa schermata.
 */
function useAccount(): Account | null {
  const mode = useStorageMode();
  const [account, setAccount] = useState<Account | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const m = await resolveStorageMode();
      if (m === "local") {
        if (alive) setAccount({ email: null, badge: "Locale" });
        return;
      }
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!alive) return;
        const email = user?.email ?? null;
        let badge = "Cloud";
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("plan, current_period_end")
            .eq("user_id", user.id)
            .maybeSingle();
          if (pianoEffettivo(profile) === "premium") badge = "Premium";
        }
        if (alive) setAccount({ email, badge });
      } catch {
        if (alive) setAccount(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [mode]);

  return account;
}

export function AccountMenu({ variant }: { variant: "rail" | "testata" }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const mode = useStorageMode();
  const plan = usePlan();
  const account = useAccount();
  const [open, setOpen] = useState<boolean>(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const locale = mode === "local";
  const native = isNative();
  const suSettings = pathname.startsWith("/app/settings");
  const nome = useNomeMostrato(account?.email, t("ospite"));
  const mostrato = locale ? t("Questo dispositivo") : nome;
  // L'iniziale segue il NOME mostrato, non l'email: chi si chiama Manuel
  // vede una M perche si chiama Manuel, non per come e fatto il suo
  // indirizzo.
  const iniziale = account ? mostrato.slice(0, 1).toUpperCase() : "•";

  /**
   * Cosa si vede nel cerchio: la foto se c'e, altrimenti l'iniziale. Un
   * pezzo solo, usato in tutti e tre i posti (pallino del telefono, testata
   * del foglio, blocco della rail), cosi non possono divergere.
   * `alt=""`: il nome e scritto accanto in chiaro, e uno screen reader che
   * lo legge due volte non aiuta nessuno.
   */
  const foto = useProfilo()?.foto ?? null;
  const ritratto = foto ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={foto} alt="" />
  ) : (
    iniziale
  );

  /** Chiusura con ritorno del fuoco: e il contratto, non una cortesia. */
  const chiudi = (rifocalizza = true) => {
    setOpen(false);
    if (rifocalizza) btnRef.current?.focus();
  };

  // Esc e click fuori (solo popover: il foglio ha il velo, e su un
  // telefono la tastiera non e la via).
  useEffect(() => {
    if (!open || variant !== "rail") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.isComposing) chiudi();
    };
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        chiudi(false);
      }
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open, variant]);

  const vaiImpostazioni = () => {
    chiudi(false);
    router.push("/app/settings");
  };
  const vaiPremium = () => {
    chiudi(false);
    openPremiumWall("aiSummary");
  };
  const vaiLogin = () => {
    chiudi(false);
    router.push("/login");
  };
  const esci = () => {
    chiudi(false);
    void (async () => {
      await eseguiLogout();
      router.push("/login");
    })();
  };

  const testata = (
    <div className="jm-acct-head">
      <div className="n">{mostrato}</div>
      <div className="e">
        {locale
          ? t("Le giornate non escono di qui")
          : (account?.email ?? "")}
      </div>
    </div>
  );

  const voci = (classi: { i: string; sep: string }) => (
    <>
      <button type="button" className={classi.i} role="menuitem" onClick={vaiImpostazioni}>
        <IconaIngranaggio />
        {t("Impostazioni")}
      </button>
      {!locale && plan !== "premium" && (
        <button type="button" className={classi.i} role="menuitem" onClick={vaiPremium}>
          <IconaStella />
          {native ? t("Scopri Premium") : t("Passa a Premium")}
        </button>
      )}
      {locale && (
        <>
          <div className={classi.sep} />
          <button type="button" className={classi.i} role="menuitem" onClick={vaiLogin}>
            <IconaEntra />
            {t("Accedi al tuo account")}
          </button>
        </>
      )}
      {!locale && (
        <>
          <div className={classi.sep} />
          <button type="button" className={`${classi.i} danger`} role="menuitem" onClick={esci}>
            <IconaEsci />
            {t("Esci dall'account")}
          </button>
        </>
      )}
    </>
  );

  if (variant === "testata") {
    return (
      <>
        <button
          ref={btnRef}
          type="button"
          className={`jm-hd-av${suSettings ? " on" : ""}`}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={t("Il tuo account")}
          onClick={() => setOpen((v) => !v)}
        >
          <i>{ritratto}</i>
        </button>
        {open && (
          <Sheet label={t("Il tuo account")} onClose={() => chiudi(false)}>
            <div className="jm-acct-sheet-head">
              <span className="av">{ritratto}</span>
              <span style={{ minWidth: 0 }}>
                <span className="n">
                  {mostrato}
                  {/* La pennina: strada A del mockup nome-profilo.html. Non
                      modifica qui — porta alla schermata del nome, che vive
                      nelle Impostazioni. Un menu apre le cose, non le
                      contiene. */}
                  {!locale && (
                    <button
                      type="button"
                      className="jm-acct-penna"
                      aria-label={t("Cambia il tuo nome")}
                      onClick={(e) => {
                        e.stopPropagation();
                        chiudi(false);
                        apriPannelloNome();
                        router.push("/app/settings");
                      }}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </button>
                  )}
                </span>
                <span className="e">
                  {locale ? t("Le giornate non escono di qui") : (account?.email ?? "")}
                </span>
              </span>
            </div>
            {voci({ i: "jm-sheet-row jm-acct-row", sep: "jm-acct-sheet-sep" })}
          </Sheet>
        )}
      </>
    );
  }

  return (
    <div className="jm-acct-wrap" ref={wrapRef}>
      {open && (
        <div className="jm-acct-menu" role="menu">
          {testata}
          {voci({ i: "jm-acct-i", sep: "jm-acct-sep" })}
        </div>
      )}
      <button
        ref={btnRef}
        type="button"
        className={`jm-acct-btn${suSettings ? " on" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="jm-rail-avatar">{ritratto}</div>
        <div className="jm-rail-acct-txt">
          <div className="jm-rail-acct-nm">{account ? mostrato : "…"}</div>
          {account && (
            <span
              className={`jm-rail-pill${account.badge === "Premium" ? " prem" : ""}`}
            >
              {t(account.badge)}
            </span>
          )}
        </div>
        <svg className="jm-acct-chev" viewBox="0 0 24 24" aria-hidden="true">
          <path d={open ? "M6 9l6 6 6-6" : "M18 15l-6-6-6 6"} />
        </svg>
      </button>
    </div>
  );
}

/* Le icone del menu: tratti coerenti con la rail (stroke 1.7, round). */
function IconaIngranaggio() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.1 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
    </svg>
  );
}
function IconaStella() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.4l6.1-.8z" />
    </svg>
  );
}
function IconaEntra() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l-5-5 5-5M5 12h12" />
    </svg>
  );
}
function IconaEsci() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}
