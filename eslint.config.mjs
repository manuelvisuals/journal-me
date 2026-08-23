import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
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
