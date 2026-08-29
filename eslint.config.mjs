import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * I confini fra moduli (ARCHITETTURA.md; ERRORE dal passo D, 23 ago 2026).
 *
 * Ogni modulo vive in src/modules/<nome>/ e importa lo scheletro e se
 * stesso; degli ALTRI moduli importa SOLO la porta (l'index.ts, cioe
 * "@/modules/<nome>" nudo). L'interno altrui e fuori confine.
 */
const MODULES = [
  "oggi", "mese", "ricorda", "recap", "impostazioni",
  "accesso", "abbonamento", "palestra", "admin",
];

const boundaryOverrides = MODULES.map((name) => {
  const others = MODULES.filter((n) => n !== name);
  return {
    files: [`src/modules/${name}/**/*.{ts,tsx}`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              // Dei moduli ALTRUI si importa solo la porta (@/modules/<nome>),
              // mai l'interno (@/modules/<nome>/...).
              group: others.map((n) => `@/modules/${n}/*`),
              message: `Confine fra moduli (ARCHITETTURA.md): "${name}" importa dagli altri moduli solo la porta index.ts (import ... from "@/modules/<nome>"). Se il pezzo serve a tutti, va promosso nello scheletro: dillo a Manuel.`,
            },
          ],
        },
      ],
    },
  };
});

const eslintConfig = defineConfig([
  ...boundaryOverrides,
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated: the static export and the copy of it that ships in the app.
    ".next-mobile/**",
    "ios/**",
  ]),
  {
    rules: {
      // Il primo parametro `_mode` delle funzioni in src/lib/data/* e
      // deliberato (SPEC-v2 §2.2: le firme storiche restano identiche,
      // la modalita la decide la factory). Non e codice dimenticato, e
      // non deve continuare a produrre warning a ogni lint.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
