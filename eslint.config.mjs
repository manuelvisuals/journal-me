import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * I confini fra moduli (ARCHITETTURA.md, passo A — 23 agosto 2026).
 *
 * Ogni modulo puo importare lo scheletro e se stesso; degli ALTRI moduli,
 * niente. Per ora la regola e un WARNING: fotografa gli attraversamenti
 * esistenti senza rompere nessuno. Diventera errore al passo D, quando i
 * moduli avranno un index.ts come porta.
 *
 * Le cartelle di un modulo stanno insieme anche se sono piu di una: e la
 * stessa tabella di ARCHITETTURA.md §2.
 */
const MODULE_DIRS = {
  oggi: ["src/components/today", "src/components/day", "src/components/aree"],
  mese: ["src/components/mese"],
  ricorda: ["src/components/remember", "src/components/persona"],
  recap: ["src/components/recap"],
  impostazioni: ["src/components/settings", "src/components/consumi"],
  accesso: ["src/app/login", "src/app/benvenuto"],
  palestra: ["src/app/palestra"],
};

const boundaryOverrides = Object.entries(MODULE_DIRS).map(([name, dirs]) => {
  const others = Object.entries(MODULE_DIRS)
    .filter(([n]) => n !== name)
    .flatMap(([, d]) => d)
    .map((d) => d.replace(/^src/, "@") + "/*");
  return {
    files: dirs.map((d) => `${d}/**/*.{ts,tsx}`),
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: others,
              message: `Confine fra moduli (ARCHITETTURA.md): "${name}" non importa dagli altri moduli. Se il pezzo serve a tutti, va promosso nello scheletro (components/ui): dillo a Manuel.`,
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
