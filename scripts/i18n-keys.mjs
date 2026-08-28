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

/**
 * Via i commenti: dentro c'e la documentazione di t(), non stringhe vere.
 *
 * Si cammina il file invece di usare due sostituzioni, perche le due
 * sostituzioni non sanno distinguere un commento da una stringa che
 * CONTIENE i caratteri di un commento. Il 28 agosto 2026 e successo per
 * davvero: `accept="image/*"` in un campo file ha aperto un finto blocco
 * di commento, la chiusura e finita 2.284 caratteri piu in la, e tre
 * frasi passate a t() sono sparite dall'analisi — con verify-i18n che le
 * dichiarava "traduzioni orfane". Un banco che accusa il codice giusto e
 * peggio di un banco che non c'e, perche lo si crede.
 */
function stripComments(src) {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];

    // Stringhe e template: si copiano intere, senza guardarci dentro.
    if (c === '"' || c === "'" || c === "`") {
      const apice = c;
      out += c;
      i++;
      while (i < src.length) {
        if (src[i] === "\\") {
          out += src[i] + (src[i + 1] ?? "");
          i += 2;
          continue;
        }
        out += src[i];
        if (src[i] === apice) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }

    if (c === "/" && d === "*") {
      const fine = src.indexOf("*/", i + 2);
      i = fine === -1 ? src.length : fine + 2;
      continue;
    }

    if (c === "/" && d === "/") {
      const fine = src.indexOf("\n", i);
      i = fine === -1 ? src.length : fine;
      continue;
    }

    out += c;
    i++;
  }
  return out;
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
