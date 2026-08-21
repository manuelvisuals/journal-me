"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { signalReady } from "@/lib/app-ready";
import { forcePlanRefresh, setPlanNow, usePlan } from "@/lib/plan";
import { PREMIUM_PRICE_AMOUNT, PREMIUM_PRICE_PERIOD } from "@/lib/pricing";
import { toast } from "@/components/ui/toast";
import { openPremiumWelcome } from "@/components/premium-welcome";
import { useT } from "@/lib/i18n";

/**
 * La schermata di pagamento finta. Volutamente spoglia: niente marchio,
 * niente rassicurazioni, e la fascia in alto lo dice in chiaro.
 *
 * Il prezzo e SBARRATO. Un prezzo pieno su una pagina che non incassa e il
 * modo piu rapido per dimenticarsi che e una prova — e questa pagina finira
 * per stare online, accesa, per settimane.
 */
export function CheckoutFintoClient() {
  const t = useT();
  const router = useRouter();
  const plan = usePlan();
  const [busy, setBusy] = useState<boolean>(false);
  const [failed, setFailed] = useState<boolean>(false);

  useEffect(() => {
    signalReady();
  }, []);

  const call = async (next: "premium" | "free") => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    toast.loading(
      next === "premium" ? t("Attivo il premium...") : t("Torno al piano gratis..."),
    );
    try {
      const resp = await apiFetch("/api/dev-checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: next }),
      });
      if (!resp.ok) {
        const data = (await resp.json().catch(() => null)) as {
          error?: string;
        } | null;
        toast.error(data?.error ?? t("Non sono riuscito a cambiare il piano."));
        setBusy(false);
        return;
      }
      // Il piano si scrive subito anche qui, senza aspettare la rilettura:
      // la schermata dopo deve gia essere quella giusta, o il popup di
      // congratulazioni arriverebbe su un'app ancora bloccata.
      setPlanNow(next);
      void forcePlanRefresh();
      toast.hide();
      if (next === "premium") {
        openPremiumWelcome();
        router.replace("/");
      } else {
        toast.ok(t("Sei tornato al piano gratis"));
        setBusy(false);
      }
    } catch {
      toast.error(t("Non sono riuscito a cambiare il piano."));
      setBusy(false);
    }
  };

  // Il fallimento non chiama nessuna rotta: non c'e niente da far fallire
  // sul server, e il punto e proprio vedere cosa mostra l'app quando un
  // pagamento non va a buon fine.
  const simulateFailure = () => {
    setFailed(true);
    toast.error(t("Pagamento non riuscito. Sei ancora al piano gratis."));
  };

  return (
    <main className="jm-screen jm-ck mx-auto flex w-full max-w-[440px] flex-1 flex-col">
      <div className="jm-ck-bar">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="10" width="16" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
        {t("pagamento simulato . nessun addebito")}
      </div>

      <div className="jm-ck-mid">
        <span className="jm-ck-tag">
          <i aria-hidden="true" />
          {t("ambiente di prova")}
        </span>
        <h1 className="jm-ck-t">{t("Journal.me\nPremium")}</h1>
        <p className="jm-ck-p">
          {t(
            "Questa pagina non e collegata a nessun sistema di pagamento. Serve a provare l'app come la vede chi ha pagato.",
          )}
        </p>
        <div className="jm-ck-amount">
          <span className="n">{PREMIUM_PRICE_AMOUNT}</span>
          <span className="per">{t(PREMIUM_PRICE_PERIOD)}</span>
        </div>
        <div className="jm-ck-strike">{t("Non verra addebitato nulla.")}</div>

        {failed && (
          <div className="jm-ck-err" role="status">
            {t(
              "Il pagamento non e andato a buon fine. Non e stato addebitato nulla e il tuo piano non e cambiato.",
            )}
          </div>
        )}
      </div>

      <div className="jm-ck-btns">
        <button
          type="button"
          className="btn-primary"
          onClick={() => void call("premium")}
          disabled={busy}
        >
          {busy ? t("un attimo...") : t("Simula pagamento riuscito")}
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={simulateFailure}
          disabled={busy}
        >
          {t("Simula pagamento fallito")}
        </button>
        <button
          type="button"
          className="jm-ck-quiet"
          onClick={() => router.replace("/")}
          disabled={busy}
        >
          {t("Annulla e torna al diario")}
        </button>
        {/* Senza la strada inversa il primo giro di prova brucia l'account:
            resti premium e il percorso non si puo piu rifare da capo. */}
        {plan === "premium" && (
          <button
            type="button"
            className="jm-ck-quiet"
            onClick={() => void call("free")}
            disabled={busy}
          >
            {t("Riporta questo account al piano gratis")}
          </button>
        )}
      </div>

      <div className="jm-ck-foot">
        {t(
          "Pagina visibile solo in ambiente di prova e solo agli account autorizzati. Il piano viene scritto dal server, mai dal browser.",
        )}
      </div>
    </main>
  );
}
