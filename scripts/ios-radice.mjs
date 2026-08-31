/**
 * LA RADICE DEL PACCHETTO iOS (31 agosto 2026).
 *
 * Dal 31 agosto `/` non e piu l'app ma il sito pubblico, e il sito NON entra
 * nel pacchetto del telefono: le sue pagine si chiamano `page.web.tsx` e la
 * build mobile (`pageExtensions: ["tsx"]`) le ignora. Conseguenza da
 * risolvere qui: l'export statico non ha piu nessun `index.html` alla radice,
 * e WKWebView apre esattamente quello.
 *
 * Questo script scrive quel file: tre righe che mandano il guscio su
 * `./app/`, cioe la schermata Oggi. Non e un ripiego elegante mascherato —
 * e un reindirizzamento vero, che pero costa zero rete (sono file locali) e
 * avviene sotto la splash, quindi non si vede.
 *
 * PERCHE NON COPIARE `app/index.html` ALLA RADICE. Perche l'indirizzo
 * conta: il router di Next leggerebbe "/" e la barra in alto, la rail e le
 * scorciatoie cercherebbero "/app" per accendere la voce giusta. Meglio un
 * salto onesto che un'app che si crede altrove.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = ".next-mobile";
const DENTRO = join(DIR, "app", "index.html");
const RADICE = join(DIR, "index.html");

if (!existsSync(DIR)) {
  console.error(
    `ios-radice: manca ${DIR}. Esegui prima JM_MOBILE=1 next build.`,
  );
  process.exit(1);
}

if (!existsSync(DENTRO)) {
  console.error(
    `ios-radice: manca ${DENTRO}. L'export non ha prodotto la schermata Oggi: ` +
      "non scrivo un reindirizzamento verso il vuoto.",
  );
  process.exit(1);
}

const html = `<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8" />
    <title>dayalogue</title>
    <meta http-equiv="refresh" content="0; url=./app/" />
    <style>
      html,
      body {
        margin: 0;
        height: 100%;
        background: #050304;
      }
    </style>
    <script>
      location.replace("./app/");
    </script>
  </head>
  <body></body>
</html>
`;

mkdirSync(DIR, { recursive: true });
writeFileSync(RADICE, html, "utf8");
console.log(`ios-radice: scritto ${RADICE} -> ./app/`);
