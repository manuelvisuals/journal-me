"use client";

/**
 * Il pannello admin: le impostazioni globali dell'app. Mockup approvati:
 * design/mockups/admin.html (Aree) e design/mockups/messaggio-benvenuto.html
 * (Messaggio di benvenuto).
 *
 * CHI NON E ADMIN NON VEDE NIENTE. Il controllo vero sta sul server
 * (src/modules/admin/server/guardia.ts): questa pagina chiede
 * GET /api/admin/aree e, se la risposta e' un no, non disegna nulla.
 * Nessun messaggio, nessun "non autorizzato": la pagina per chiunque altro
 * semplicemente non esiste.
 *
 * QUI STA SOLO IL GUSCIO. La guardia, la rail e la voce scelta. Ogni voce
 * del menu e' un file suo in components/: quando il pannello aveva una
 * schermata sola stava tutto qui dentro, e alla seconda sarebbe diventato
 * il file piu' lungo del modulo.
 *
 * PERCHE LE AREE SI CARICANO ANCHE QUANDO NON LE STAI GUARDANDO. Quella
 * lettura e' la guardia: e' cio' che dice se sei admin, e va fatta prima di
 * disegnare qualunque schermata. Il conteggio accanto alla voce "Aree" e'
 * solo un effetto collaterale gratuito.
 */

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { signalReady } from "@/lib/app-ready";
import { useStorageMode } from "@/lib/data/store";
import { useT } from "@/lib/i18n";
import { AreeSchermata, type Riga } from "@/modules/admin/components/aree-schermata";
import { BenvenutoSchermata } from "@/modules/admin/components/benvenuto-schermata";

type Stato = "carico" | "negato" | "pronto";
type Voce = "aree" | "benvenuto";

export function AdminClient() {
  const t = useT();
  const mode = useStorageMode();
  const [stato, setStato] = useState<Stato>("carico");
  const [righe, setRighe] = useState<Riga[]>([]);
  const [voce, setVoce] = useState<Voce>("aree");

  // Il pannello esiste solo per un account cloud: in modalita locale non si
  // fa NEMMENO UNA richiesta di rete (SPEC-v2 §1), e senza sessione non c'e
  // niente da chiedere. E lo stesso "niente" di chi non e admin: si deriva
  // dal render (niente setState sincrono in un effect, lint React 19).
  const negatoSenzaCloud = mode !== "resolving" && mode !== "cloud";

  useEffect(() => {
    // Solo la splash: chi non entra non deve restarci sotto 4 secondi.
    if (negatoSenzaCloud) signalReady();
  }, [negatoSenzaCloud]);

  useEffect(() => {
    if (mode !== "cloud") return;
    let alive = true;
    (async () => {
      try {
        const resp = await apiFetch("/api/admin/aree", { method: "GET" });
        if (!alive) return;
        if (!resp.ok) {
          setStato("negato");
          signalReady();
          return;
        }
        const data = (await resp.json()) as { aree?: Riga[] };
        if (!alive) return;
        setRighe((data.aree ?? []).map((r) => ({ ...r })));
        setStato("pronto");
        signalReady();
      } catch {
        if (alive) {
          setStato("negato");
          signalReady();
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [mode]);

  // La pagina di chi non e admin: niente. Anche mentre carica: comparire e
  // poi sparire direbbe comunque che qui c'era qualcosa.
  if (negatoSenzaCloud || stato !== "pronto") return null;

  return (
    <div className="jm-adm">
      <aside className="jm-adm-rail">
        <div className="jm-adm-brand">
          dayalogue<i>.</i>
        </div>
        <div className="jm-adm-brand-sub">{t("Admin")}</div>
        <nav className="jm-adm-nav">
          <button
            type="button"
            className={`jm-adm-nav-v${voce === "aree" ? " on" : ""}`}
            aria-current={voce === "aree" ? "page" : undefined}
            onClick={() => setVoce("aree")}
          >
            {t("Aree")} <em>{righe.length}</em>
          </button>
          <span className="jm-adm-nav-off">{t("Obiettivi di default")}</span>
          <button
            type="button"
            className={`jm-adm-nav-v${voce === "benvenuto" ? " on" : ""}`}
            aria-current={voce === "benvenuto" ? "page" : undefined}
            onClick={() => setVoce("benvenuto")}
          >
            {t("Messaggio di benvenuto")}
          </button>
          <span className="jm-adm-nav-off">{t("Modelli AI")}</span>
          <span className="jm-adm-nav-off">{t("Piani e limiti")}</span>
        </nav>
        <div className="jm-adm-who">
          <b>madh52@gmail.com</b>
          {t("l'unico che entra qui")}
        </div>
      </aside>

      {voce === "aree" ? (
        <AreeSchermata righe={righe} setRighe={setRighe} />
      ) : (
        <BenvenutoSchermata />
      )}
    </div>
  );
}
