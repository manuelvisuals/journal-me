"use client";

/**
 * Il muro premium (mockup due-modalita §04). Compare SOLO quando l'utente
 * tocca una funzione premium (microfono, Recap, pattern) — mai all'avvio,
 * mai a interrompere la scrittura. Il tasto secondario e sempre un'uscita
 * gratuita: la versione gratis non va mai messa in un vicolo cieco.
 *
 * Store modulo (stesso pattern di palette e focus): chiunque puo aprirlo
 * con openPremiumWall(feature, onDismiss?) senza prop-drilling. Il
 * componente e montato una volta nel guscio e funziona anche sotto lg:
 * il muro serve soprattutto al telefono gratis.
 *
 * Prezzo: NON ancora deciso (aperto per la PR 11) — il bottone dice solo
 * "prova premium". L'acquisto vero arriva con Stripe (PR 11): oggi il
 * primario porta al login (in locale, dove premium = farsi un account);
 * in cloud gratis spiega che l'abbonamento sta arrivando.
 */

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { PREMIUM_PRICE_LABEL } from "@/lib/pricing";
import { fakeCheckoutEnabled } from "@/lib/dev-checkout";
import { useStorageMode } from "@/lib/data/store";
import { useT } from "@/lib/i18n";
import { isNative } from "@/lib/native/platform";

export type WallFeature = "voice" | "aiSummary" | "recap" | "patterns";

type WallState = {
  feature: WallFeature;
  /** Uscita gratuita contestuale (es. mic -> apri la scrittura a mano). */
  onDismiss?: () => void;
} | null;

let state: WallState = null;
const listeners = new Set<() => void>();
function emit(): void {
  for (const l of listeners) l();
}

export function openPremiumWall(
  feature: WallFeature,
  onDismiss?: () => void,
): void {
  state = { feature, onDismiss };
  emit();
}

export function closePremiumWall(): void {
  state = null;
  emit();
}

function useWallState(): WallState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => null,
  );
}

/**
 * I titoli del muro vanno su due righe. Prima erano JSX con un <br/> in
 * mezzo: cosi il punto dove spezzare era deciso dall'italiano e in inglese
 * cadeva a caso. Ora sono stringhe con un a capo dentro, la traduzione
 * decide dove spezzare, e `.jm-wall-t` lo rispetta (white-space: pre-line).
 */
const TITLES: Record<WallFeature, string> = {
  voice: "Per raccontare a voce\nserve premium",
  aiSummary: "Per il titolo e la sintesi\nserve premium",
  recap: "Per i recap del mese\nserve premium",
  patterns: "Per le letture sui pattern\nserve premium",
};

const FEATURES: { t: string; p: string }[] = [
  {
    t: "Racconti e basta",
    p: "Parli in italiano, il testo si scrive da solo. Correggi i nomi e sei a posto.",
  },
  {
    t: "Titolo, sintesi, macro-aree",
    p: "Ogni giornata riassunta in una riga e divisa fra lavoro, relazioni, corpo, emozioni.",
  },
  {
    t: "Recap e pattern",
    p: "Il racconto del mese, e cosa cambia davvero quando cammini o dormi di piu.",
  },
  {
    t: "Su tutti i dispositivi",
    p: "Le giornate che hai gia scritto qui salgono nel cloud al primo accesso.",
  },
];

export function PremiumWall() {
  const t = useT();
  const wall = useWallState();
  const router = useRouter();
  const mode = useStorageMode();
  const [cloudNote, setCloudNote] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);

  const dismiss = () => {
    const after = state?.onDismiss;
    closePremiumWall();
    setCloudNote(false);
    after?.();
  };

  // Esc = uscita gratuita, come il tasto "non ora".
  useEffect(() => {
    if (!wall) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.isComposing) dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      setCloudNote(false);
    };
  }, [wall]);

  if (!wall) return null;

  const tryPremium = async () => {
    if (mode === "local") {
      // Premium = account: si passa dal login. La scelta locale resta
      // finche non completa l'accesso (clearLocalMode arriva col flusso
      // di migrazione, §7.2).
      closePremiumWall();
      setCloudNote(false);
      router.push("/login");
      return;
    }
    // Ambiente di prova: al posto di Stripe c'e il pagamento simulato
    // (/checkout-finto). Serve a provare l'app da premium finche le chiavi
    // vere non ci sono; in produzione l'interruttore e spento e questa riga
    // non esiste nemmeno.
    if (fakeCheckoutEnabled()) {
      closePremiumWall();
      setCloudNote(false);
      router.push("/checkout-finto");
      return;
    }
    // Cloud: si apre Stripe Checkout (PR 11). Se Stripe non e ancora
    // configurato la route risponde 503 e qui si dice la verita.
    if (busy) return;
    setBusy(true);
    try {
      const resp = await apiFetch("/api/stripe/checkout", { method: "POST" });
      if (resp.ok) {
        const data = (await resp.json()) as { url?: string };
        if (data.url) {
          window.location.href = data.url;
          return;
        }
      }
      setCloudNote(true);
    } catch {
      setCloudNote(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="jm-wall-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={t("Premium")}
      onClick={dismiss}
    >
      <div className="jm-wall" onClick={(e) => e.stopPropagation()}>
        <div className="jm-wall-t">{t(TITLES[wall.feature])}</div>
        <div className="jm-wall-p">
          {t(
            "La trascrizione e la rielaborazione girano su un server e costano a ogni minuto registrato. Per questo non posso regalarle: le paghi tu o le pago io.",
          )}
        </div>
        {FEATURES.map((f) => (
          <div key={f.t} className="jm-wall-feat">
            <i />
            <div>
              <div className="t">{t(f.t)}</div>
              <div className="p">{t(f.p)}</div>
            </div>
          </div>
        ))}
        {/* Dentro il guscio iOS l'acquisto NON esiste (App Store 3.1.1,
            deciso da Manuel il 23 ago: v1 senza acquisto su iOS). Niente
            bottone col prezzo, niente inviti a comprare altrove: solo la
            verita, e - per chi un account ce l'ha gia - la via del login.
            L'In-App Purchase arriva in un aggiornamento. */}
        {(cloudNote || isNative()) && (
          <div className="jm-wall-note">
            {t(
              "L'abbonamento si attiva a breve: l'acquisto dentro l'app sta arrivando.",
            )}
          </div>
        )}
        {isNative() ? (
          mode === "local" && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                closePremiumWall();
                setCloudNote(false);
                router.push("/login");
              }}
            >
              {t("Ho gia un account")}
            </button>
          )
        ) : (
          <button
            type="button"
            className="btn-primary"
            onClick={() => void tryPremium()}
            disabled={busy}
          >
            {busy
              ? t("un attimo...")
              : `${t("prova premium")} . ${PREMIUM_PRICE_LABEL}`}
          </button>
        )}
        <button type="button" className="btn-ghost" onClick={dismiss}>
          {t("non ora")}
        </button>
      </div>
    </div>
  );
}
