"use client";

import { useEffect, useRef, useState } from "react";
import {
  backupBannerState,
  eraseLocalData,
  exportBackup,
  importBackup,
  importReportText,
  type BackupBannerState,
} from "@/lib/backup/backup";
import { useStorageMode } from "@/lib/data/store";
import { formatNumber } from "@/lib/format";

/**
 * Altro > I tuoi dati (SPEC-v2 §4, mockup due-modalita.html §03).
 *
 * Il punto piu delicato della versione gratis: se il dispositivo si rompe,
 * il diario e finito. L'app lo dice chiaramente e rompe le scatole quando
 * l'ultimo backup e vecchio. Non e una funzione nascosta: e un dovere.
 */

type Busy = "idle" | "export" | "import" | "erase";

export function DataSection() {
  const mode = useStorageMode();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<Busy>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eraseArmed, setEraseArmed] = useState<boolean>(false);

  const isLocal = mode === "local";

  const handleExport = async () => {
    if (busy !== "idle") return;
    setBusy("export");
    setError(null);
    setMessage(null);
    try {
      const n = await exportBackup();
      setMessage(
        `Backup esportato: ${formatNumber(n)} ${n === 1 ? "giornata" : "giornate"}. Mettilo dove tieni le cose che non vuoi perdere.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export non riuscito.");
    } finally {
      setBusy("idle");
    }
  };

  const handleImportFile = async (file: File | null) => {
    if (!file || busy !== "idle") return;
    setBusy("import");
    setError(null);
    setMessage(null);
    try {
      const report = await importBackup(file);
      setMessage(importReportText(report));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import non riuscito.");
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
    setError(null);
    setMessage(null);
    try {
      await eraseLocalData();
      setEraseArmed(false);
      setMessage("Fatto. Questo dispositivo non contiene piu nessuna giornata.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancellazione non riuscita.");
    } finally {
      setBusy("idle");
    }
  };

  return (
    <section className="jm-set-section">
      <div className="jm-set-section-h">I tuoi dati</div>

      <div className="jm-data-box">
        <div className="jm-data-row">
          <div className="jm-data-copy">
            <div className="jm-data-t">Esporta un backup</div>
            <div className="jm-data-p">
              Un solo file con tutto: giornate, obiettivi, metriche, Ricorda.
            </div>
          </div>
          <button
            type="button"
            className="jm-data-btn primary"
            onClick={() => void handleExport()}
            disabled={busy !== "idle"}
          >
            {busy === "export" ? "esporto..." : "esporta"}
          </button>
        </div>
        <div className="jm-data-row">
          <div className="jm-data-copy">
            <div className="jm-data-t">Importa un backup</div>
            <div className="jm-data-p">
              Aggiunge le giornate che mancano. Quelle che hai gia non vengono
              toccate.
            </div>
          </div>
          <button
            type="button"
            className="jm-data-btn"
            onClick={() => fileRef.current?.click()}
            disabled={busy !== "idle"}
          >
            {busy === "import" ? "importo..." : "scegli file"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => void handleImportFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>

      {(message || error) && (
        <div className={`jm-data-note${error ? " err" : ""}`}>
          {error ?? message}
        </div>
      )}

      <div className="jm-data-box" style={{ marginTop: 14 }}>
        {isLocal ? (
          <>
            <div className="jm-data-row">
              <div className="jm-data-copy">
                <div className="jm-data-t">Solo su questo dispositivo</div>
                <div className="jm-data-p">
                  Nessuna riga del tuo diario e mai uscita da qui. Non c&apos;e
                  un account, non c&apos;e un server, non c&apos;e niente da
                  chiedere di cancellare.
                </div>
              </div>
            </div>
            <div className="jm-data-row">
              <div className="jm-data-copy">
                <div className="jm-data-t danger">Cancella tutto</div>
                <div className="jm-data-p">
                  {eraseArmed
                    ? "Sicuro? Elimina ogni giornata da questo dispositivo. Non e recuperabile."
                    : "Elimina le giornate da questo dispositivo. Non e recuperabile."}
                </div>
              </div>
              <button
                type="button"
                className="jm-data-btn danger"
                onClick={() => void handleErase()}
                disabled={busy !== "idle"}
              >
                {busy === "erase"
                  ? "cancello..."
                  : eraseArmed
                    ? "si, cancella"
                    : "cancella"}
              </button>
            </div>
          </>
        ) : (
          <div className="jm-data-row">
            <div className="jm-data-copy">
              <div className="jm-data-t">Nel cloud, sul tuo account</div>
              <div className="jm-data-p">
                Le giornate vivono sul tuo account e ti seguono su ogni
                dispositivo. L&apos;export qui sopra e una copia in piu, tua.
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Il banner rosso-ambra in cima ad Altro (solo modalita locale): compare se
 * l'ultimo backup e piu vecchio di 14 giorni, o non esiste e ci sono almeno
 * 7 giornate. Mai su Oggi.
 */
export function BackupBanner() {
  const mode = useStorageMode();
  const [state, setState] = useState<BackupBannerState | null>(null);

  useEffect(() => {
    if (mode !== "local") return;
    let alive = true;
    void backupBannerState().then((s) => {
      if (alive) setState(s);
    });
    return () => {
      alive = false;
    };
  }, [mode]);

  if (mode !== "local" || !state?.show) return null;

  const title =
    state.daysSince === null
      ? "Non hai mai fatto un backup"
      : `Non fai un backup da ${formatNumber(state.daysSince)} giorni`;

  return (
    <div className="jm-backup-warn">
      <div className="jm-backup-warn-t">{title}</div>
      <div className="jm-backup-warn-p">
        Le tue {formatNumber(state.entryCount)} giornate esistono solo su questo
        dispositivo. Se si rompe o lo formatti, non c&apos;e nessuna copia da
        nessuna parte: non esiste un server dove cercarle. Esporta il file e
        mettilo dove tieni le cose che non vuoi perdere.
      </div>
    </div>
  );
}
