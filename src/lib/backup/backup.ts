"use client";

/**
 * Backup v1 (SPEC-v2 §4): un solo JSON, leggibile fra dieci anni.
 *
 * Export: sul web Blob + <a download>; nel guscio iOS il file va scritto con
 * @capacitor/filesystem in cache e condiviso con @capacitor/share, cosi esce
 * il foglio di condivisione ed entra in File / iCloud Drive / dovunque.
 *
 * Import: merge, MAI replace. Il file non e cifrato: e l'utente che decide
 * dove metterlo, ed e piu importante che sia leggibile fra dieci anni che
 * protetto da una password che perdera.
 */

import { isNative } from "@/lib/native/platform";
import { getStore } from "@/lib/data/store";
import { LocalStore } from "@/lib/data/store/local";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  type BackupFile,
  type ImportReport,
} from "@/lib/data/store/types";
import { todayISO } from "@/lib/format";
import { t } from "@/lib/i18n";
import { invalidateAll } from "@/lib/data/cache";

export function backupFilename(): string {
  return `dayalogue-backup-${todayISO()}.json`;
}

/** Esporta tutto e consegna il file all'utente. Ritorna il numero di giornate. */
export async function exportBackup(): Promise<number> {
  const store = getStore();
  const file = await store.exportAll();
  const json = JSON.stringify(file, null, 2);
  const name = backupFilename();

  if (isNative()) {
    const { Filesystem, Directory, Encoding } = await import(
      "@capacitor/filesystem"
    );
    const { Share } = await import("@capacitor/share");
    const written = await Filesystem.writeFile({
      path: name,
      data: json,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title: name, url: written.uri });
  } else {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
  return file.counts.entries;
}

/** Legge e valida un file scelto dall'utente. Lancia con un messaggio leggibile. */
export async function readBackupFile(file: File): Promise<BackupFile> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error(t("Questo file non e un backup di dayalogue."));
  }
  const b = parsed as Partial<BackupFile> | null;
  if (!b || b.format !== BACKUP_FORMAT) {
    throw new Error(t("Questo file non e un backup di dayalogue."));
  }
  if (b.version !== BACKUP_VERSION) {
    throw new Error(
      t(
        "Questo backup e della versione {v}: serve un'app piu recente per importarlo.",
        { v: String(b.version) },
      ),
    );
  }
  return b as BackupFile;
}

/** Importa (merge) un backup nello store corrente. */
export async function importBackup(file: File): Promise<ImportReport> {
  const backup = await readBackupFile(file);
  const report = await getStore().importAll(backup);
  invalidateAll();
  return report;
}

/** Frase del report, leggibile: "Aggiunte 41 giornate. 86 erano gia qui." */
export function importReportText(r: ImportReport): string {
  const parts: string[] = [];
  // Singolare e plurale come frasi INTERE e non pezzi incollati: in
  // italiano cambia la desinenza ("aggiunta/aggiunte"), in inglese no, e
  // una frase spezzata a meta non e traducibile.
  parts.push(
    r.entries.added === 0
      ? t("Nessuna giornata nuova.")
      : r.entries.added === 1
        ? t("Aggiunta 1 giornata.")
        : t("Aggiunte {n} giornate.", { n: r.entries.added }),
  );
  if (r.entries.skipped > 0) {
    parts.push(
      r.entries.skipped === 1
        ? t("1 era gia qui.")
        : t("{n} erano gia qui.", { n: r.entries.skipped }),
    );
  }
  const extras = r.goals.added + r.remembers.added + r.recaps.added;
  if (extras > 0) {
    parts.push(t("Piu {n} fra obiettivi, Ricorda e recap.", { n: extras }));
  }
  parts.push(t("Nessuna e stata sovrascritta."));
  return parts.join(" ");
}

/* ----------------- banner (SPEC-v2 §4.4) ----------------- */

export type BackupBannerState = {
  show: boolean;
  /** Giorni dall'ultimo backup; null = mai fatto. */
  daysSince: number | null;
  entryCount: number;
};

const BANNER_AFTER_DAYS = 14;
const BANNER_MIN_ENTRIES = 7;

/**
 * Solo in modalita locale: se l'ultimo export e piu vecchio di 14 giorni, o
 * non e mai stato fatto e ci sono almeno 7 giornate, il banner compare in
 * cima ad Altro. Mai su Oggi: quello e lo spazio della scrittura.
 */
export async function backupBannerState(): Promise<BackupBannerState> {
  const store = getStore();
  if (!(store instanceof LocalStore)) {
    return { show: false, daysSince: null, entryCount: 0 };
  }
  const [last, count] = await Promise.all([
    store.getMeta("lastBackupAt"),
    store.countEntries(),
  ]);
  if (typeof last === "string") {
    const days = Math.floor(
      (Date.now() - new Date(last).getTime()) / 86_400_000,
    );
    return { show: days > BANNER_AFTER_DAYS, daysSince: days, entryCount: count };
  }
  return {
    show: count >= BANNER_MIN_ENTRIES,
    daysSince: null,
    entryCount: count,
  };
}

/** Cancella TUTTO il database locale. Non e recuperabile. */
export async function eraseLocalData(): Promise<void> {
  const store = getStore();
  if (!(store instanceof LocalStore)) {
    throw new Error(t("La cancellazione locale vale solo in modalita locale."));
  }
  await store.eraseEverything();
  invalidateAll();
}
