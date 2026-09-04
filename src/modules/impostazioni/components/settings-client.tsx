"use client";

/**
 * Impostazioni (ex "Altro") — mockup design/mockups/impostazioni.html §03/§04,
 * approvato da Manuel il 20 agosto 2026.
 *
 * Cosa e cambiato e perche. "Altro" era un cassetto: banner, card Recap,
 * temi, obiettivi a chip, dati, account e logout tutti aperti nella stessa
 * colonna, uno sotto l'altro, senza gerarchia. Adesso e un elenco a gruppi
 * dove ogni riga dice la cosa E il suo valore attuale, e cio che ha bisogno
 * di spazio (obiettivi, temi, "dove sono le mie giornate") si apre in un
 * pannello suo.
 *
 * Su desktop l'identita passa nella rail destra: chi sei e contesto, non
 * un'impostazione, e la colonna centrale resta solo impostazioni. La card
 * Recap sparisce da qui su desktop perche Recap e gia nella rail sinistra;
 * sul telefono resta, perche li la tab bar non ha uno slot per Recap.
 *
 * UNA RIGA DEL MOCKUP NON E QUI, di proposito: "Promemoria della sera".
 * L'app non ha nessun sistema di notifiche, e una riga che mostra "21:30"
 * senza che arrivi mai niente sarebbe una bugia dell'interfaccia, come il
 * "primo mese incluso" tolto la mattina dello stesso giorno. Torna nel
 * momento in cui esistono le notifiche.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { TabBar } from "@/components/ui/tab-bar";
import { RailRight } from "@/components/desktop/rail-right";
import { PanelHead, SetGroup, SetRow } from "@/modules/impostazioni/components/rows";
import {
  GoalsPanel,
  LanguagePanel,
  LANG_NAMES,
  ModuliPanel,
  TextSizePanel,
  ThemePanel,
  WherePanel,
  CassafortePanel,
} from "@/modules/impostazioni/components/panels";
import { contaCassaforte } from "@/lib/data/cassaforte";
import { BackupBanner } from "@/modules/impostazioni/components/data-section";
import { FotoProfiloRow } from "@/modules/impostazioni/components/foto-row";
import { NomePanel, NomeRiga } from "@/modules/impostazioni/components/nome-riga";
import { useNomeMostrato, useRichiestaNome } from "@/modules/impostazioni/profilo";
import { useActiveModules } from "@/lib/modules";
import {
  ConsumiPanel,
  ConsumiRailRow,
  ConsumiRow,
} from "@/modules/impostazioni/components/consumi-panel";
import {
  eraseLocalData,
  exportBackup,
  importBackup,
  importReportText,
} from "@/lib/backup/backup";
import { getStore, useStorageMode } from "@/lib/data/store";
import { APP_VERSION } from "@/lib/data/store/types";
import { BUILD_INFO } from "@/modules/impostazioni/build-info";
import { formatDate, formatNumber } from "@/lib/format";
import { toast } from "@/components/ui/toast";
import { useDettaglioPiano, usePlan } from "@/lib/plan";
import { eseguiLogout } from "@/lib/auth/logout";

import {
  gestisciAbbonamento,
  negozioDisponibile,
  openPremiumWall,
  ripristinaAcquisti,
} from "@/modules/abbonamento";
import {
  PREMIUM_PRICE_AMOUNT,
  PREMIUM_PRICE_LABEL,
  PREMIUM_PRICE_PERIOD,
  PREMIUM_PROVA_GIORNI,
} from "@/lib/pricing";
import { isNative } from "@/lib/native/platform";
import {
  biometriaDisponibile,
  disattivaFaceId,
  provaEAttivaFaceId,
  useFaceIdAttivo,
} from "@/lib/native/face-id";
import { useLang, useLangPref, useT } from "@/lib/i18n";
import { UI_SCALE_LABELS, useUiScale } from "@/lib/ui-scale";
import { THEMES } from "@/themes";
import { setAppearance, useAppearance, useThemeId } from "@/themes/runtime";
import type { Appearance } from "@/themes";
import type { DataMode } from "@/lib/data/entries";
import type { GoalDef } from "@/lib/types";

type Props = {
  mode: DataMode;
  email: string | null;
  isAnonymous: boolean;
  initialGoals: GoalDef[];
  latestRecap: { title: string; periodLabel: string } | null;
};

type Panel =
  | "root" | "goals" | "theme" | "where" | "language" | "textsize" | "consumi"
  | "moduli" | "nome" | "cassaforte";

const PANEL_TITLES: Record<Exclude<Panel, "root">, string> = {
  goals: "Obiettivi",
  theme: "Tema",
  where: "Dove sono le mie giornate",
  language: "Lingua",
  textsize: "Dimensione del testo",
  consumi: "Consumi AI",
  moduli: "Moduli",
  nome: "Il tuo nome",
  cassaforte: "Cassaforte",
};

const APPEARANCE_OPTIONS: { value: Appearance; label: string; short: string }[] = [
  { value: "light", label: "Chiaro", short: "Ch" },
  { value: "dark", label: "Scuro", short: "Sc" },
  { value: "system", label: "Sistema", short: "Sist" },
];

type Busy = "idle" | "export" | "import" | "erase" | "deleteAccount";

export function SettingsClient({
  mode,
  email,
  isAnonymous,
  initialGoals,
  latestRecap,
}: Props) {
  const router = useRouter();
  const storageMode = useStorageMode();
  const isLocal = storageMode === "local";
  const plan = usePlan();
  const dettaglioPiano = useDettaglioPiano();
  const themeId = useThemeId();
  const appearance = useAppearance();
  const t = useT();
  const lang = useLang();
  const langPref = useLangPref();
  const uiScale = useUiScale();

  const [panel, setPanel] = useState<Panel>("root");
  const [goals, setGoals] = useState<GoalDef[]>(initialGoals);
  const [entryCount, setEntryCount] = useState<number | null>(null);
  const [busy, setBusy] = useState<Busy>("idle");
  const [note, setNote] = useState<string | null>(null);
  const [noteErr, setNoteErr] = useState<boolean>(false);
  const [eraseArmed, setEraseArmed] = useState<boolean>(false);
  const [deleteArmed, setDeleteArmed] = useState<boolean>(false);
  const [signingOut, setSigningOut] = useState<boolean>(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /**
   * L'interruttore Face ID (1 settembre 2026): la riga esiste solo nel
   * guscio iOS e solo se il telefono ha davvero la biometria — un
   * interruttore che non puo accendere niente e una bugia di interfaccia.
   * Accenderlo fa una prova VERA (permesso di sistema compreso): si salva
   * "on" solo se il volto ha aperto davvero. Le regole e la memoria stanno
   * in src/lib/native/face-id.ts, le stesse della proposta dopo il login.
   */
  const faceIdOn = useFaceIdAttivo();
  const [faceIdRow, setFaceIdRow] = useState<boolean>(false);
  const [faceIdBusy, setFaceIdBusy] = useState<boolean>(false);

  // La riga Cassaforte dice lo stato vero: quante giornate (e righe) sono
  // ancora in chiaro sul server, o "tutto chiuso a chiave" (SPEC R12).
  const [cassaforteValore, setCassaforteValore] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (isLocal || storageMode === "resolving") return;
    let alive = true;
    void contaCassaforte()
      .then((s) => {
        if (!alive) return;
        const n = s.inChiaro + s.righeInChiaro;
        setCassaforteValore(
          n === 0
            ? t("Tutto chiuso a chiave")
            : s.inChiaro > 0
              ? t("{n} giornate in chiaro", { n: formatNumber(s.inChiaro) })
              : t("{n} righe in chiaro", { n: formatNumber(n) }),
        );
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [isLocal, storageMode, t]);
  useEffect(() => {
    if (!isNative()) return;
    let alive = true;
    void biometriaDisponibile().then((ok) => {
      if (alive && ok) setFaceIdRow(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  const toggleFaceId = () => {
    if (faceIdBusy) return;
    if (faceIdOn) {
      disattivaFaceId();
      return;
    }
    setFaceIdBusy(true);
    void provaEAttivaFaceId(t("Apri il tuo diario")).then((ok) => {
      setFaceIdBusy(false);
      if (!ok) say(t("Face ID non attivato: la prova non e riuscita."), true);
    });
  };

  // Il numero di giornate serve alla riga "Esporta un backup": un backup di
  // cui non sai la dimensione non lo fa nessuno. Vale in tutte e due le
  // modalita — countEntries e nel contratto dello store.
  useEffect(() => {
    if (storageMode === "resolving") return;
    let alive = true;
    void getStore()
      .countEntries()
      .then((n) => {
        if (alive) setEntryCount(n);
      })
      .catch(() => {
        // Nessun conteggio: la riga resta senza valore, non si inventa.
      });
    return () => {
      alive = false;
    };
  }, [storageMode, busy]);

  const say = (text: string, err = false) => {
    setNote(text);
    setNoteErr(err);
  };

  const handleExport = async () => {
    if (busy !== "idle") return;
    setBusy("export");
    say("");
    try {
      const n = await exportBackup();
      say(
        t(
          "Backup esportato: {n} {giornate}. Mettilo dove tieni le cose che non vuoi perdere.",
          {
            n: formatNumber(n),
            giornate: n === 1 ? t("giornata") : t("giornate"),
          },
        ),
      );
    } catch (err) {
      say(err instanceof Error ? err.message : t("Export non riuscito."), true);
    } finally {
      setBusy("idle");
    }
  };

  const handleImportFile = async (file: File | null) => {
    if (!file || busy !== "idle") return;
    setBusy("import");
    say("");
    try {
      say(importReportText(await importBackup(file)));
    } catch (err) {
      say(err instanceof Error ? err.message : t("Import non riuscito."), true);
    } finally {
      setBusy("idle");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleErase = async () => {
    if (busy !== "idle") return;
    if (!eraseArmed) {
      setEraseArmed(true);
      return;
    }
    setBusy("erase");
    say("");
    try {
      await eraseLocalData();
      setEraseArmed(false);
      say(t("Fatto. Questo dispositivo non contiene piu nessuna giornata."));
    } catch (err) {
      say(
        err instanceof Error ? err.message : t("Cancellazione non riuscita."),
        true,
      );
    } finally {
      setBusy("idle");
    }
  };

  const ripristina = async () => {
    toast.loading(t("Chiedo ad Apple..."));
    const esito = await ripristinaAcquisti();
    if (esito.esito === "premium") toast.ok(t("Premium ripristinato."));
    else if (esito.esito === "errore") toast.error(esito.messaggio);
    else toast.ok(t("Niente da ripristinare."));
  };

  const handleLogout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    // Solo cloud: in locale questo bottone non esiste (niente account).
    // I passi veri — e le loro cicatrici — vivono in src/lib/auth/logout.ts
    // (mockup porta-account §03): il menu dell'account chiama la stessa
    // funzione, cosi i due logout non possono divergere mai piu.
    await eseguiLogout();
    router.push("/login");
  };

  /**
   * Cancellazione dell'ACCOUNT (App Store 5.1.1(v), PIANO-APPSTORE §1b):
   * due tocchi come la zona pericolosa locale, poi la route autenticata
   * elimina l'utente Supabase e la cascata porta via tutte le sue righe.
   * Dopo, questo browser torna vergine: via la sessione, la cache del
   * piano, la memoria della scansione e la scelta della modalita — il
   * prossimo avvio riparte da /benvenuto.
   */
  const handleDeleteAccount = async () => {
    if (busy !== "idle") return;
    if (!deleteArmed) {
      setDeleteArmed(true);
      return;
    }
    setBusy("deleteAccount");
    say("");
    try {
      const { apiFetch } = await import("@/lib/api");
      const resp = await apiFetch("/api/account/delete", { method: "POST" });
      if (!resp.ok) throw new Error(t("Cancellazione non riuscita."));
      // La coda della cancellazione E un logout (stessi passi, stesse
      // cicatrici): si usa quello vero, piu il pezzo suo — dimenticare la
      // modalita, perche l'account non esiste piu.
      await eseguiLogout();
      try {
        window.localStorage.removeItem("jm.mode");
      } catch {}
      router.push("/app/benvenuto");
    } catch (err) {
      setDeleteArmed(false);
      say(
        err instanceof Error ? err.message : t("Cancellazione non riuscita."),
        true,
      );
      setBusy("idle");
    }
  };

  const moduliAttivi = useActiveModules();

  // La pennina sta nella testata del menu dell'account, che e scheletro:
  // chiede di aprire questa schermata passando dallo store del modulo,
  // invece che da un parametro nell'indirizzo (che in Next 16 vorrebbe un
  // Suspense attorno a mezza pagina per una cosa che dura un istante).
  const richiestaNome = useRichiestaNome();
  const [nomeVisto, setNomeVisto] = useState(richiestaNome);
  if (richiestaNome !== nomeVisto) {
    // Aggiustare lo stato DURANTE il render e il pattern che React
    // documenta per reagire a un valore esterno che cambia: React rifa
    // subito il render senza mostrare nulla in mezzo. Dentro un useEffect
    // invece si vedrebbe un fotogramma della schermata sbagliata, ed e
    // anche cio che il lint vieta (react-hooks/set-state-in-effect).
    setNomeVisto(richiestaNome);
    setPanel("nome");
  }

  const themeName = THEMES.find((t) => t.id === themeId)?.name ?? "";
  // Il nome mostrato ha UNA sola regola, e vive in profilo-contract.ts:
  // nome scelto, altrimenti l'email tagliata alla chiocciola. Prima quella
  // regola era scritta qui E in account-menu.tsx, e un nome scelto che
  // raggiungesse un solo dei due avrebbe mostrato due nomi diversi nella
  // stessa schermata.
  const nomeCloud = useNomeMostrato(email, t("Ospite"));
  const accountName = isLocal ? "Questo dispositivo" : nomeCloud;

  return (
    <main
      className="jm-screen mx-auto flex w-full max-w-[440px] lg:max-w-none flex-1 flex-col"
    >
      {panel === "root" ? (
        <header className="jm-col-head">
          {/* Il titolo e nella barra in alto (30 agosto 2026, mockup
              pallino-ovunque, strada B). Da lg la barra non c'e: li il
              titolo resta, perche la rail dice dove sei ma non ha una
              testata di pagina. */}
          <h1 className="jm-st-h1 jm-solo-desktop">{t("Impostazioni")}</h1>
          <p className="jm-st-sub">
            {t("Come funziona e come si vede il tuo diario.")}
          </p>
        </header>
      ) : (
        <PanelHead title={t(PANEL_TITLES[panel])} onBack={() => setPanel("root")} />
      )}

      <div className="jm-st-scroll">
        {panel === "goals" && (
          <GoalsPanel mode={mode} goals={goals} setGoals={setGoals} />
        )}
        {panel === "theme" && <ThemePanel />}
        {panel === "language" && <LanguagePanel />}
        {panel === "textsize" && <TextSizePanel />}
        {panel === "where" && <WherePanel />}
        {panel === "cassaforte" && <CassafortePanel />}
        {panel === "consumi" && <ConsumiPanel />}
        {panel === "moduli" && <ModuliPanel />}
        {panel === "nome" && (
          <NomePanel
            email={email}
            mostrato={accountName}
            onNota={say}
            onFatto={() => setPanel("root")}
          />
        )}

        {panel === "root" && (
          <>
            {/* Solo in locale, quando l'ultimo backup e vecchio: il dovere di
                dire che il diario esiste in un posto solo (SPEC-v2 §4.4). */}
            <BackupBanner />

            {/* Recap solo sul telefono: su desktop e gia nella rail sinistra. */}
            <Link
              href="/app/recap"
              className="jm-st-recap jm-st-phoneonly"
              aria-label={t("Apri Recap")}
            >
              <span className="meta">Recap</span>
              <span className="title">{t("Le tue giornate, raccontate.")}</span>
              <span className="sub">
                {t(
                  "Mensili, semestrali, annuali. Una prosa narrativa che rilegge i tuoi mesi senza giudizio.",
                )}
              </span>
              <span className="last">
                {latestRecap
                  ? `${latestRecap.periodLabel} . ${latestRecap.title}`
                  : t("Nessun recap generato ancora")}
              </span>
            </Link>

            <SetGroup label={t("Il diario")}>
              <SetRow
                title={t("Obiettivi")}
                desc={t("Le caselle che accendi ogni giorno.")}
                value={`${formatNumber(goals.length)} ${goals.length === 1 ? t("attivo") : t("attivi")}`}
                onClick={() => setPanel("goals")}
              />
              <SetRow
                title={t("Moduli")}
                desc={t("Sezioni in piu: palestra, cibo, sonno.")}
                value={
                  moduliAttivi.length === 0
                    ? t("nessuno")
                    : moduliAttivi.map((m) => t(m.label)).join(" . ")
                }
                onClick={() => setPanel("moduli")}
              />
              {/* Sul telefono un modulo acceso prende il posto di Ricorda
                  nella barra in basso: questa riga e la strada che gli
                  resta, e per questo non e nascosta dietro il modulo. */}
              <SetRow
                title={t("Memo")}
                desc={t("Persone, posti e idee salvate al volo.")}
                onClick={() => router.push("/app/remember")}
                chevron
              />
            </SetGroup>

            <SetGroup label={t("Lingua e aspetto")}>
              <SetRow
                title={t("Lingua")}
                desc={t("Al primo avvio segue la lingua del dispositivo.")}
                value={
                  langPref === "system"
                    ? `${LANG_NAMES[lang]} . ${t("automatica")}`
                    : LANG_NAMES[lang]
                }
                onClick={() => setPanel("language")}
              />
              <SetRow
                title={t("Tema")}
                desc={t("{n} temi inclusi, tutti in chiaro e in scuro.", {
                  n: formatNumber(THEMES.length),
                })}
                value={themeName}
                onClick={() => setPanel("theme")}
              />
              <SetRow
                title={t("Dimensione del testo")}
                desc={t("Ingrandisce tutta l'app, non solo le scritte.")}
                value={t(UI_SCALE_LABELS[String(uiScale)])}
                onClick={() => setPanel("textsize")}
              />
              <SetRow
                title={t("Chiaro o scuro")}
                desc={t("Vale per qualsiasi tema. Con Sistema segue il dispositivo.")}
                control={
                  <span
                    className="jm-st-seg"
                    role="radiogroup"
                    aria-label={t("Chiaro o scuro")}
                  >
                    {APPEARANCE_OPTIONS.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        role="radio"
                        aria-checked={appearance === o.value}
                        aria-label={t(o.label)}
                        className={appearance === o.value ? "on" : undefined}
                        onClick={() => setAppearance(o.value)}
                      >
                        <span className="lg">{t(o.label)}</span>
                        <span className="sm">{t(o.short)}</span>
                      </button>
                    ))}
                  </span>
                }
              />
            </SetGroup>

            <SetGroup label={t("I tuoi dati")}>
              <SetRow
                title={t("Esporta un backup")}
                desc={t(
                  "Un solo file con tutto: giornate, obiettivi, metriche, Memo.",
                )}
                value={
                  busy === "export"
                    ? t("esporto...")
                    : entryCount == null
                      ? undefined
                      : `${formatNumber(entryCount)} ${entryCount === 1 ? t("giornata") : t("giornate")}`
                }
                onClick={() => void handleExport()}
                disabled={busy !== "idle"}
              />
              <SetRow
                title={t("Importa un backup")}
                desc={t(
                  "Aggiunge le giornate che mancano. Quelle che hai gia non le tocca.",
                )}
                value={busy === "import" ? t("importo...") : undefined}
                onClick={() => fileRef.current?.click()}
                disabled={busy !== "idle"}
              />
              <SetRow
                title={t("Dove sono le mie giornate")}
                desc={t("Cosa esce da questo dispositivo, e cosa no.")}
                onClick={() => setPanel("where")}
              />
              {!isLocal && (
                <SetRow
                  title={t("Cassaforte")}
                  desc={t("Chiusa a chiave sul dispositivo: nessuno legge il tuo diario, noi compresi.")}
                  value={cassaforteValore}
                  onClick={() => setPanel("cassaforte")}
                />
              )}
              {faceIdRow && (
                <SetRow
                  title={t("Face ID")}
                  desc={t("Il volto al posto del codice, quando apri l'app.")}
                  control={
                    <button
                      type="button"
                      role="switch"
                      aria-checked={faceIdOn}
                      aria-label={t("Face ID")}
                      className={`jm-sw${faceIdOn ? " on" : ""}`}
                      onClick={toggleFaceId}
                      disabled={faceIdBusy}
                    >
                      <i aria-hidden="true" />
                    </button>
                  }
                />
              )}
            </SetGroup>

            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => void handleImportFile(e.target.files?.[0] ?? null)}
            />

            {note && (
              <div className={`jm-st-note${noteErr ? " err" : ""}`} role="status">
                {note}
              </div>
            )}

            {/* L'account sul telefono: su desktop vive nella rail destra. */}
            <div className="jm-st-phoneonly">
              {!isLocal && plan !== "premium" && <PremiumInvite />}
              <SetGroup label={t("Account")}>
                {isLocal ? (
                  <>
                    <SetRow
                      title={t("Dove")}
                      value={t("Solo su questo dispositivo")}
                    />
                    {/* La via del ritorno. Chi sceglie "sul telefono" da
                        /benvenuto finiva in un vicolo cieco: in locale non
                        c'e account, non c'e piano, non c'e logout, e da
                        queste impostazioni non esisteva NESSUN modo di
                        accedere. L'unica uscita era premere il microfono e
                        passare dal muro premium — cioe scoprirla per caso.
                        Un revisore Apple che sceglie "sul telefono" resta
                        chiuso fuori dal proprio account: e un motivo di
                        rifiuto, oltre che una trappola per chiunque. */}
                    <SetRow
                      title={t("Accedi al tuo account")}
                      desc={t(
                        "Le giornate che hai gia scritto qui salgono nel cloud al primo accesso.",
                      )}
                      onClick={() => router.push("/login")}
                    />
                  </>
                ) : (
                  <>
                    {/* Prima riga del gruppo: e la sola che si CAMBIA, le
                        altre si leggono e basta. Mostra a destra la foto
                        attuale, come tutte le righe di questo elenco
                        mostrano il proprio valore. */}
                    <FotoProfiloRow
                      iniziale={accountName.slice(0, 1).toUpperCase()}
                      onNota={say}
                    />
                    {email && <SetRow title={t("Email")} value={email} />}
                    {isAnonymous && (
                      <SetRow title={t("Account")} value={t("Ospite (cloud)")} />
                    )}
                    <SetRow
                      title={t("Piano")}
                      value={
                        plan === "premium"
                          ? dettaglioPiano.source === "apple" && dettaglioPiano.periodEnd
                            ? t("Premium fino al {data}", {
                                data: formatDate(new Date(dettaglioPiano.periodEnd), {
                                  day: "numeric",
                                  month: "long",
                                }),
                              })
                            : t("Premium")
                          : t("Gratis")
                      }
                    />
                    {/* L'abbonamento di Apple (mockup abbonamento-iphone.html
                        v3, 02): si cambia o si disdice dalla pagina di Apple,
                        non da noi. "Ripristina acquisti" c'e sempre dentro il
                        guscio, anche per chi non ha mai comprato: Apple lo
                        vuole raggiungibile. */}
                    {negozioDisponibile() && dettaglioPiano.source === "apple" && (
                      <SetRow
                        title={t("Gestisci abbonamento")}
                        value={t("Apple")}
                        onClick={() => void gestisciAbbonamento()}
                      />
                    )}
                    {negozioDisponibile() && (
                      <SetRow
                        title={t("Ripristina acquisti")}
                        onClick={() => void ripristina()}
                      />
                    )}
                    <ConsumiRow onOpen={() => setPanel("consumi")} />
                  </>
                )}
                <SetRow title={t("Versione")} value={APP_VERSION} />
                {/* La riga che risponde a "quale codice ho davvero addosso":
                    il commit da cui e nato questo pacchetto. */}
                <SetRow title={t("Pacchetto")} value={BUILD_INFO} chevron={false} />
                {!isLocal && (
                  <SetRow
                    title={t("Esci dall'account")}
                    danger
                    chevron={false}
                    value={signingOut ? t("esco...") : undefined}
                    onClick={() => void handleLogout()}
                    disabled={signingOut}
                  />
                )}
              </SetGroup>
            </div>

            {!isLocal && (
              <SetGroup label={t("Zona pericolosa")}>
                <SetRow
                  title={t("Elimina l'account")}
                  desc={
                    deleteArmed
                      ? t(
                          "Sicuro? Account e giornate spariscono anche dal cloud. Non si torna indietro.",
                        )
                      : t("Cancella l'account e tutte le giornate dal cloud.")
                  }
                  value={
                    busy === "deleteAccount"
                      ? t("elimino...")
                      : deleteArmed
                        ? t("si, elimina")
                        : undefined
                  }
                  danger
                  chevron={!deleteArmed}
                  onClick={() => void handleDeleteAccount()}
                  disabled={busy !== "idle"}
                />
              </SetGroup>
            )}

            {isLocal && (
              <SetGroup label={t("Zona pericolosa")}>
                <SetRow
                  title={t("Cancella tutte le giornate")}
                  desc={
                    eraseArmed
                      ? t(
                          "Sicuro? Le elimina da questo dispositivo. Non si torna indietro.",
                        )
                      : t("Da questo dispositivo. Non si torna indietro.")
                  }
                  value={
                    busy === "erase"
                      ? t("cancello...")
                      : eraseArmed
                        ? t("si, cancella")
                        : undefined
                  }
                  danger
                  chevron={!eraseArmed}
                  onClick={() => void handleErase()}
                  disabled={busy !== "idle"}
                />
              </SetGroup>
            )}
          </>
        )}
      </div>

      {/* Rail destra: l'identita, non le impostazioni. Sotto lg non esiste. */}
      <RailRight>
        <div className="jm-st-acct">
          {/* L'iniziale viene dal NOME mostrato, non dall'email: in locale
              l'email non esiste e l'avatar diventava un punto interrogativo
              accanto a "Questo dispositivo".
              In cloud il ritratto e la PORTA alla foto profilo: sul computer
              non esiste il gruppo Account del telefono, e senza questo non
              ci sarebbe nessun modo di cambiarla. In locale resta un
              disegno: senza account non c'e nessuna foto da tenere. */}
          {isLocal ? (
            <div className="jm-st-av" aria-hidden="true">
              {accountName.slice(0, 1).toUpperCase()}
            </div>
          ) : (
            <FotoProfiloRow
              variant="avatar"
              iniziale={accountName.slice(0, 1).toUpperCase()}
              onNota={say}
            />
          )}
          {isLocal ? (
            <div className="jm-st-nm">{t(accountName)}</div>
          ) : (
            <NomeRiga mostrato={accountName} onNota={say} />
          )}
          {!isLocal && email && <div className="jm-st-em">{email}</div>}
          {isLocal ? (
            <span className="jm-st-pill">{t("Locale")}</span>
          ) : (
            <span
              className={plan === "premium" ? "jm-st-pill on" : "jm-st-pill"}
            >
              {plan === "premium" ? t("Premium") : t("Gratis")}
            </span>
          )}
        </div>

        <div className="jm-st-rr">
          <div className="jm-railr-l">{t("Account")}</div>
          {isLocal ? (
            <div className="jm-st-rrow">
              <span className="k">{t("Dove")}</span>
              <span className="v">{t("Solo su questo dispositivo")}</span>
            </div>
          ) : (
            <div className="jm-st-rrow">
              <span className="k">{t("Piano")}</span>
              <span className="v">
                {plan === "premium"
                  ? `${t("Premium")} . ${PREMIUM_PRICE_LABEL}`
                  : t("Gratis")}
              </span>
            </div>
          )}
          {!isLocal && <ConsumiRailRow onOpen={() => setPanel("consumi")} />}
          <div className="jm-st-rrow">
            <span className="k">{t("Versione")}</span>
            <span className="v">{APP_VERSION}</span>
          </div>
          <div className="jm-st-rrow">
            <span className="k">{t("Pacchetto")}</span>
            <span className="v">{BUILD_INFO}</span>
          </div>

          {isLocal && (
            <button
              type="button"
              className="jm-st-out"
              onClick={() => router.push("/login")}
            >
              {t("Accedi al tuo account")}
            </button>
          )}
          {!isLocal && plan !== "premium" && (
            <button
              type="button"
              className="jm-st-out"
              onClick={() => openPremiumWall("aiSummary")}
            >
              {t("Passa a Premium")}
            </button>
          )}
          {!isLocal && (
            <button
              type="button"
              className="jm-st-out danger"
              onClick={() => void handleLogout()}
              disabled={signingOut}
            >
              {signingOut ? t("Esco...") : t("Esci dall'account")}
            </button>
          )}
        </div>
      </RailRight>

      <TabBar active="settings" />
    </main>
  );
}

/**
 * L'invito a passare a premium, sul TELEFONO (mockup C, scelto da Manuel il
 * 24 agosto 2026 — `mockup-piano-premium.html`).
 *
 * Perche serviva. Nella colonna destra del desktop il bottone "Passa a
 * Premium" c'e da sempre; sul telefono no, e la riga "Piano" diceva "Gratis"
 * e finiva li. Chi apriva le impostazioni per abbonarsi non trovava NIENTE
 * da toccare: non una scelta di disegno, un buco.
 *
 * Perche non e un bottone d'acquisto. Dentro il guscio iOS non si puo
 * vendere ne rimandare a un acquisto esterno (App Store 3.1.1). Qui non si
 * vende: si apre il muro premium, che sa gia distinguere i due mondi — sul
 * web offre l'abbonamento, dentro l'app dice soltanto che l'acquisto in-app
 * sta arrivando. Quello che si aggiunge e la PORTA, non la cassa.
 *
 * Il prezzo, per la stessa ragione, si stampa solo fuori dal guscio: su
 * iPhone la riga sparisce e il bottone smette di promettere un pagamento
 * ("Scopri Premium" invece di "Passa a Premium"). Un prezzo scritto dentro
 * l'app e esattamente cio che fa bocciare una submission.
 */
function PremiumInvite() {
  const t = useT();
  const native = isNative();
  return (
    <div className="jm-st-inv">
      <div className="jm-st-inv-t">{t("Il diario a voce e spento")}</div>
      <p className="jm-st-inv-p">
        {t(
          "Trascrizione e rielaborazione girano su un server e costano a ogni minuto registrato.",
        )}
      </p>
      <ul className="jm-st-inv-l">
        <li>{t("Racconti e basta: parli, il testo si scrive")}</li>
        <li>{t("Titolo, sintesi e macro-aree di ogni giornata")}</li>
        <li>{t("Recap del mese e letture sui pattern")}</li>
      </ul>
      <button
        type="button"
        className="btn-primary jm-st-inv-b"
        onClick={() => openPremiumWall("aiSummary")}
      >
        {t("Passa a Premium")}
      </button>
      <div className="jm-st-inv-n">
        {native
          ? `${t("{n} giorni gratis", { n: String(PREMIUM_PROVA_GIORNI) })}, ${t("poi")} ${PREMIUM_PRICE_AMOUNT} ${t(PREMIUM_PRICE_PERIOD)} . ${t("disdici quando vuoi")}`
          : t("Si attiva dall'app per iPhone")}
      </div>
    </div>
  );
}

