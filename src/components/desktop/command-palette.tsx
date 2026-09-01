"use client";

/**
 * La palette comandi, Cmd+K (SPEC-v2 §5.4): naviga e cattura in Ricorda.
 * E la navigazione da tastiera del desktop — niente Cmd+1..5 (nel browser
 * cambiano scheda), si passa da qui.
 *
 * Lo stato aperta/chiusa e un mini store modulo (stesso pattern del focus):
 * cosi use-shortcuts la apre senza prop-drilling attraverso il guscio.
 * La ricerca full-text NON e qui (spec §10.4, fuori dalle 11 PR): la
 * palette filtra i comandi e cattura appunti, non cerca nel diario.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toggleFocusMode } from "@/components/desktop/focus-toggle";
import { useIsDesktop } from "@/components/desktop/use-is-desktop";
import { addRemember } from "@/lib/data/remembers";
import { useStorageMode } from "@/lib/data/store";
import { useT } from "@/lib/i18n";

/* ----------------- store aperta/chiusa ----------------- */

let isOpen = false;
const listeners = new Set<() => void>();
function emit(): void {
  for (const l of listeners) l();
}

export function openPalette(): void {
  isOpen = true;
  emit();
}

export function closePalette(): void {
  isOpen = false;
  emit();
}

export function togglePalette(): void {
  isOpen = !isOpen;
  emit();
}

export function usePaletteOpen(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => isOpen,
    () => false,
  );
}

/* ----------------- comandi ----------------- */

type Command = {
  id: string;
  group: string;
  label: string;
  run: () => void | Promise<void>;
};

/* ----------------- componente ----------------- */

export function CommandPalette() {
  const t = useT();
  const open = usePaletteOpen();
  const isDesktop = useIsDesktop();
  const router = useRouter();
  const pathname = usePathname();
  const storageMode = useStorageMode();
  const [query, setQuery] = useState<string>("");
  const [selected, setSelected] = useState<number>(0);
  const [captured, setCaptured] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reset a ogni apertura: query pulita, selezione in cima. queueMicrotask
  // per la regola set-state-in-effect di React 19 (HANDOVER §7).
  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setQuery("");
      setSelected(0);
      setCaptured(null);
    });
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  if (!open || !isDesktop) return null;

  const navCommands: Command[] = [
    { id: "oggi", group: t("Vai a"), label: t("Oggi"), run: () => router.push("/app") },
    { id: "mese", group: t("Vai a"), label: t("Mese"), run: () => router.push("/app/mese") },
    { id: "ricorda", group: t("Vai a"), label: t("Memo"), run: () => router.push("/app/remember") },
    { id: "recap", group: t("Vai a"), label: "Recap", run: () => router.push("/app/recap") },
    { id: "altro", group: t("Vai a"), label: t("Impostazioni"), run: () => router.push("/app/settings") },
    {
      id: "record",
      group: t("Azioni"),
      label:
        storageMode === "local" ? t("Scrivi la giornata") : t("Racconta a voce"),
      run: () => router.push("/app?record=1"),
    },
    // Il focus esiste solo dove esiste l'editor (Oggi).
    ...(pathname === "/app"
      ? [
          {
            id: "focus",
            group: t("Azioni"),
            label: t("Modalita focus"),
            run: () => toggleFocusMode(),
          },
        ]
      : []),
  ];

  const q = query.trim().toLowerCase();
  const filtered = q
    ? navCommands.filter((c) => c.label.toLowerCase().includes(q))
    : navCommands;

  // Cattura rapida: qualsiasi testo digitato puo finire in Ricorda.
  const commands: Command[] = [...filtered];
  if (query.trim().length > 0) {
    commands.push({
      id: "capture",
      group: t("Memo"),
      label: t('Salva in Memo: "{testo}"', { testo: query.trim() }),
      run: async () => {
        await addRemember("auth", query.trim(), "nota");
      },
    });
  }

  const sel = Math.min(selected, Math.max(commands.length - 1, 0));

  const execute = async (cmd: Command) => {
    if (cmd.id === "capture") {
      try {
        await cmd.run();
        // Feedback dentro la palette, poi si chiude da sola: la cattura
        // non deve portarti via dalla pagina dove stai.
        setCaptured(query.trim());
        setQuery("");
        setSelected(0);
        window.setTimeout(() => closePalette(), 900);
      } catch {
        setCaptured(null);
      }
      return;
    }
    closePalette();
    void cmd.run();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closePalette();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, commands.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = commands[sel];
      if (cmd) void execute(cmd);
    }
  };

  let lastGroup = "";

  return (
    <div
      className="jm-pal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t("Palette comandi")}
      onClick={() => closePalette()}
    >
      <div className="jm-pal" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="jm-pal-input"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(0);
            setCaptured(null);
          }}
          onKeyDown={onKeyDown}
          placeholder={t("Dove vuoi andare? O scrivi una cosa da ricordare...")}
          spellCheck={false}
          aria-label={t("Cerca un comando")}
        />
        <div className="jm-pal-list" role="listbox">
          {captured && (
            <div className="jm-pal-done">
              {t("salvato in Memo: {testo}", { testo: captured })}
            </div>
          )}
          {commands.length === 0 && !captured && (
            <div className="jm-pal-empty">
              {t("niente da fare con questo testo.")}
            </div>
          )}
          {commands.map((cmd, i) => {
            const showGroup = cmd.group !== lastGroup;
            lastGroup = cmd.group;
            return (
              <div key={cmd.id}>
                {showGroup && <div className="jm-pal-l">{cmd.group}</div>}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === sel}
                  className={`jm-pal-item${i === sel ? " sel" : ""}`}
                  onMouseEnter={() => setSelected(i)}
                  onClick={() => void execute(cmd)}
                >
                  {cmd.label}
                </button>
              </div>
            );
          })}
        </div>
        <div className="jm-pal-foot">
          <span>
            {t("frecce per muoverti . invio per eseguire . esc per chiudere")}
          </span>
        </div>
      </div>
    </div>
  );
}
