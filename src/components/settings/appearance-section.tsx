"use client";

import type { CSSProperties } from "react";
import { cssVarsFor, FONTS, THEMES } from "@/themes";
import {
  setAppearance,
  setTheme,
  useAppearance,
  useResolvedMode,
  useThemeId,
} from "@/themes/runtime";
import type { Appearance } from "@/themes";

/**
 * Altro > Aspetto (SPEC-temi §5, mockup design/mockups/temi.html §04).
 *
 * Lo switch chiaro/scuro/sistema sta SOPRA la griglia dei temi e vale per
 * tutti: non si cambia tema per accendere la luce. Le anteprime si
 * aggiornano di conseguenza — ogni card renderizza con le custom property
 * del SUO tema nel modo selezionato, via style inline (le variabili scoped
 * sulla card vincono su quelle di <html>).
 */

const APPEARANCE_OPTIONS: { value: Appearance; label: string }[] = [
  { value: "light", label: "Chiaro" },
  { value: "dark", label: "Scuro" },
  { value: "system", label: "Sistema" },
];

export function AppearanceSection() {
  const themeId = useThemeId();
  const appearance = useAppearance();
  const mode = useResolvedMode();

  return (
    <section className="jm-set-section">
      <div className="jm-set-section-h">Aspetto</div>
      <div className="jm-set-section-hint">
        Il tema cambia solo come si vede l&apos;app. Le tue giornate non le
        tocca nessuno.
      </div>

      <div className="jm-appearance-row">
        <div className="jm-appearance-copy">
          <div className="jm-appearance-t">Chiaro o scuro</div>
          <div className="jm-appearance-p">
            Vale per qualsiasi tema. Con Sistema segue il dispositivo.
          </div>
        </div>
        <div className="jm-seg" role="radiogroup" aria-label="Chiaro o scuro">
          {APPEARANCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={appearance === opt.value}
              className={`jm-seg-opt${appearance === opt.value ? " on" : ""}`}
              onClick={() => setAppearance(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="jm-theme-grid">
        {THEMES.map((t) => {
          const active = t.id === themeId;
          const vars = cssVarsFor(t, mode) as CSSProperties;
          return (
            <button
              key={t.id}
              type="button"
              className={`jm-theme-card${active ? " on" : ""}`}
              onClick={() => setTheme(t.id)}
              aria-pressed={active}
            >
              <span className="jm-theme-prev" style={vars}>
                <span className="jm-theme-prev-t">la telefonata rimandata</span>
                <span className="jm-theme-prev-p">
                  Trentadue minuti, e una frase alla fine.
                </span>
                <span className="jm-theme-sw" aria-hidden="true">
                  <i className="sw-accent" />
                  <i className="sw-surface" />
                  <i className="sw-ink" />
                  <i className="sw-faint" />
                </span>
              </span>
              <span className="jm-theme-meta">
                <span className="jm-theme-name">{t.name}</span>
                <span className="jm-theme-fonts">
                  {t.typography.fontUi === t.typography.fontProse
                    ? FONTS[t.typography.fontUi].name
                    : `${FONTS[t.typography.fontUi].name} + ${FONTS[t.typography.fontProse].name}`}
                  {active ? " . attivo" : ""}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="jm-theme-footnote">
        Ogni tema esiste in chiaro e in scuro, e passa un controllo automatico
        sul contrasto: un tema che rende il testo illeggibile non diventa
        selezionabile.
      </div>
    </section>
  );
}
