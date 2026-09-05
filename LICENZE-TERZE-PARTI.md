# Licenze di terze parti

Qui dentro sta tutto cio che in dayalogue non e stato scritto per dayalogue e
porta una licenza altrui. Oggi e una lista sola, quella dei colori dei temi;
quando entrera altro materiale di terzi si aggiunge una sezione qui, non un
file nuovo.

Regola: un avviso di licenza non si toglie mai, nemmeno quando i valori
vengono ritoccati. Se sono stati ritoccati, la modifica si dichiara.

---

## I nove temi regalati (5 settembre 2026)

Nove temi arrivati da **Nikita Rodionov**, che li ha regalati dalla sua
applicazione personale per macOS. Il campo `author` di ognuno porta il suo
nome. Il racconto completo, i valori e il conto del contrasto stanno in
`SPEC-temi-regalati.md`; i file sono in `src/themes/`.

In tutti e nove sono stati cambiati tre valori (`inkFaint`, `shadow`,
`accentHi`) e aggiunti due (`accentPressed`, `success`), e in tutti e nove la
tipografia non e sua. Il capitolo 1 della spec dice esattamente cosa e suo e
cosa no.

### Tokyo Night (`src/themes/tokyo.ts`) - Apache License 2.0

Origine: https://github.com/folke/tokyonight.nvim
Set chiaro: Tokyo Night Day, stesso repository (`extras/lua/tokyonight_day.lua`).

    Copyright (c) 2023 Folke Lemaitre

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

**Modifiche dichiarate** (Apache 2.0, sezione 4b). I valori non sono quelli
originali in due punti:

- scuro `inkFaint`: `#7A82AB` -> `#888FB4` (contrasto su `surface` da 3,89 a
  4,60, per superare il minimo AA di 4,5)
- chiaro `accent`: `#2E7DE9` -> `#1A71E7` (contrasto col testo del bottone da
  4,02 a 4,61)
- piu i cambi comuni a tutti e nove i temi: `shadow` portato a colore base
  (`#000000`, l opacita la mette il CSS), `accentHi` ricavato come accento piu
  chiaro del 12 per cento, `accentPressed` e `success` aggiunti perche il
  contratto dei temi li richiede e nell originale non esistevano.

### Nord (`src/themes/nord.ts`) - MIT

Origine: https://github.com/nordtheme/nord
Set chiaro: gruppi Snow Storm (nord4-nord6) e Polar Night (nord0-nord3), gia
dentro la palette ufficiale.

    Copyright (c) 2016-present Sven Greb

    Permission is hereby granted, free of charge, to any person obtaining a
    copy of this software and associated documentation files (the "Software"),
    to deal in the Software without restriction, including without limitation
    the rights to use, copy, modify, merge, publish, distribute, sublicense,
    and/or sell copies of the Software, and to permit persons to whom the
    Software is furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
    FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
    DEALINGS IN THE SOFTWARE.

Modifiche: scuro `inkFaint` `#95A0B3` -> `#A7B0C0`; chiaro `accent`
`#5E81AC` -> `#5477A3`; piu i cambi comuni ai nove.

### Gruvbox (`src/themes/gruvbox.ts`) - MIT/X11

Origine: https://github.com/morhetz/gruvbox (licenza dichiarata nel README).
Set chiaro: light0/light1/light2, dark0-dark3 e i colori faded_*, dallo stesso
`colors/gruvbox.vim`.

    Copyright (c) 2018 Pavel Pertsev

    Permission is hereby granted, free of charge, to any person obtaining a
    copy of this software and associated documentation files (the "Software"),
    to deal in the Software without restriction, including without limitation
    the rights to use, copy, modify, merge, publish, distribute, sublicense,
    and/or sell copies of the Software, and to permit persons to whom the
    Software is furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
    FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
    DEALINGS IN THE SOFTWARE.

Modifiche: scuro `inkFaint` `#A08F73` -> `#B0A28B`; piu i cambi comuni ai nove.

### Catppuccin (`src/themes/catppuccin.ts`) - MIT

Origine: https://github.com/catppuccin/palette
Set scuro: gusto Macchiato. Set chiaro: gusto Latte, dallo stesso
`palette.json`.

    Copyright (c) 2021 Catppuccin

    Permission is hereby granted, free of charge, to any person obtaining a
    copy of this software and associated documentation files (the "Software"),
    to deal in the Software without restriction, including without limitation
    the rights to use, copy, modify, merge, publish, distribute, sublicense,
    and/or sell copies of the Software, and to permit persons to whom the
    Software is furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
    FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
    DEALINGS IN THE SOFTWARE.

Modifiche: scuro `inkFaint` `#8087A2` -> `#989EB4`; piu i cambi comuni ai nove.

### Ametista (`src/themes/ametista.ts`) - situazione mista, da leggere

Il nome Ametista e di dayalogue. I colori no, e non vengono da un posto solo.

- **Set scuro**: Dracula, MIT, Copyright (c) 2023 Dracula Theme
  (https://github.com/dracula/dracula-theme). Testo della MIT come sopra.
  Materiale libero, nessun problema.
- **Set chiaro**: sono i valori di **Alucard**, il tema chiaro ufficiale di
  Dracula, che fa parte di **Dracula PRO**, un prodotto a pagamento. Sono stati
  ripresi da https://github.com/jaljoue/dracula-alucard.nvim, un repository di
  terzi che li ripubblica **senza alcun file di licenza**. Non e materiale
  libero e non c e una licenza che ne autorizzi l uso.

Il 5 settembre 2026 Manuel ha deciso di tenerli e di rinominare il tema:
si chiama Ametista e non porta ne il nome Dracula ne il nome Alucard.
Il nome e cambiato **per non usare marchi altrui, non per far perdere le tracce
di dove vengono quei colori** - ed e per questo che sta scritto qui.

Come liberarsene, se un giorno serve: rifare da zero il solo set `light` di
`ametista` partendo dal suo `dark`, che e MIT. Mezz ora di lavoro; il resto del
tema non si tocca.

### Korall ardesia, Korall, Grafit, Ocean

Palette dell autore, non derivate da progetti pubblici. I set chiari non
esistevano nei suoi file (erano `light: null`) e sono stati disegnati per
dayalogue.

---

## Font

I woff2 in `src/fonts/` (Inter, Newsreader, Spectral, EB Garamond, DM Sans,
Cormorant Garamond, IBM Plex Mono) sono sotto SIL Open Font License 1.1. La
OFL chiede che il testo della licenza viaggi insieme ai font: accanto ai woff2
oggi NON c e, e va aggiunto. Un file `src/fonts/OFL.txt` con il testo della
licenza e l elenco delle famiglie basta a mettere le cose a posto.
