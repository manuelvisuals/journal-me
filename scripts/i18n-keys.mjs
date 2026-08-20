// Estrae tutte le frasi passate a t("...") / t('...') nel codice.
// Usato sia da verify-i18n.mjs sia a mano per riempire il catalogo.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

const RE = /(?<![A-Za-z0-9_$.])t\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;

/** Via i commenti: dentro c'e la documentazione di t(), non stringhe vere. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

export function collectKeys(root = "src") {
  const keys = new Map();
  for (const file of walk(root)) {
    const src = stripComments(readFileSync(file, "utf8"));
    for (const m of src.matchAll(RE)) {
      const raw = m[1];
      let value;
      try {
        value = JSON.parse(raw[0] === "'" ? `"${raw.slice(1, -1).replace(/"/g, '\\"')}"` : raw);
      } catch {
        continue;
      }
      if (!keys.has(value)) keys.set(value, []);
      keys.get(value).push(file);
    }
  }
  return keys;
}

if (process.argv[1]?.endsWith("i18n-keys.mjs")) {
  const keys = collectKeys();
  console.log(JSON.stringify([...keys.keys()], null, 2));
}
