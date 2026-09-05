# SPEC - I nove temi regalati

Scritta il 5 settembre 2026. E il mandato per la sessione scheletro che scrivera questi temi
in `src/themes/`. Chi apre quella sessione legge PRIMA `ARCHITETTURA.md`, `SPEC-temi.md` e
`AGENTS.md`, poi questo file, e non deve ricalcolare niente: i valori qui sotto sono gia
verificati e passano il validatore.

Origine: un amico di Manuel, **Nikita Rodionov**, ha regalato i temi della sua applicazione
personale per macOS. Ne ha dati dieci, tutti scuri. Manuel ne ha scelti nove: fuori Vampire,
il tema base della sua stessa famiglia.

Le tappe stanno nei mockup:
`design/mockups/temi-regalo.html` (i temi nella schermata vera, chiaro e scuro),
`design/mockups/temi-regalo-licenze.html` (le licenze),
`design/mockups/temi-regalo-cosa-ho-cambiato.html` (cosa e cambiato rispetto ai suoi file).

---

## 1. Cosa e suo e cosa no

Dei diciotto valori di ogni set **scuro**, tredici sono esattamente i suoi: `bg`, `bgApp`,
`surface`, `surface2`, `ink`, `inkMuted`, `accent`, `onAccent`, `danger`, `line`, `glow`,
`warmth`, `grain`. Tre sono stati cambiati e due aggiunti. **I set chiari non sono suoi**:
nel suo file erano tutti `light: null`.

| Valore | Cosa e successo |
|---|---|
| `inkFaint` | Alzato di due-tre punti di luminosita, tinta e saturazione ferme. Nel suo file tutti e dieci i temi stavano fra 3,46 e 4,45 su `inkFaint/surface`, sotto il minimo AA di 4,5. E la stessa correzione gia fatta al tema `wine` (SPEC-temi cap. 6). |
| `shadow` | Da `rgba(0,0,0,0.75)` a `#000000`: nel contratto `shadow` e un colore base e l opacita la mette il CSS. Reversibile senza effetti visibili. |
| `accentHi` | Lui ci metteva l accento con alfa `1A`, cioe uno sfondo tenue al 10 per cento. In dayalogue `accentHi` colora capolettera e stati attivi: al 10 per cento sarebbe invisibile. Sostituito con l accento piu chiaro del 12 per cento, che e il suo stesso `brightness(1.12)` del passaggio col mouse. |
| `accentPressed` | Assente nel suo file. Ricavato: accento piu scuro del 12 per cento. |
| `success` | Assente nel suo file. Nel suo codice la conferma e disegnata con l accento (`.ok{background:var(--neon)}`), quindi `success` e uguale ad `accent`. |

La **tipografia** non e sua e non poteva esserlo: la sua app usa San Francisco per tutto, con
prosa a 12,5px e titoli a 13px, sotto i minimi del contratto (13, 15, 14). Di suo restano i
raggi (`8/12/16/18`, pillola `99`) e `motion.press` a `0.94`.

## 2. Le regole applicate, non le scelte a occhio

Due sole, uguali per tutti, cosi che chiunque possa rifarle e ottenere gli stessi numeri:

1. **inkFaint**: alzare (nel buio) o abbassare (nella luce) la luminosita a tinta e saturazione
   ferme, finche `inkFaint/surface` arriva a **4,6** (margine voluto sopra il 4,5 di legge).
2. **Accento in chiaro**: scurire a tinta ferma finche `onAccent/accent` arriva a 4,6; se
   serve, ancora finche `accent/bgApp` arriva a 3,05. Ha morso due volte soltanto, Tokyo Night
   e Nord, e di poco: sotto ogni tema c e scritto quanto.

Nessun set chiaro e stato ricavato invertendo il suo scuro: `SPEC-temi.md` lo vieta, e a ragione.

## 3. Il conto del contrasto

Diciotto set su diciotto passano tutte e sei le coppie. Il piu tirato e Tokyo Night in chiaro,
4,52 su `ink/bgApp`: e la palette ufficiale e non e stata ritoccata per guadagnare margine.

| Tema | Modo | ink/bgApp | ink/surface | inkMuted/surface | inkFaint/surface | onAccent/accent | accent/bgApp |
|---|---|---|---|---|---|---|---|
| Korall ardesia | chiaro | 14.03 | 15.79 | 8.33 | 4.95 | 4.86 | 4.32 |
| Korall ardesia | scuro | 14.81 | 13.36 | 7.88 | 4.63 | 7.72 | 6.96 |
| Korall | chiaro | 15.32 | 16.53 | 8.93 | 5.39 | 4.86 | 4.50 |
| Korall | scuro | 15.05 | 13.97 | 8.87 | 4.60 | 7.72 | 7.53 |
| Ametista | chiaro | 15.89 | 16.48 | 8.86 | 5.77 | 6.24 | 6.02 |
| Ametista | scuro | 13.36 | 11.06 | 6.95 | 4.63 | 7.61 | 5.90 |
| Tokyo Night | chiaro | 4.52 | 5.85 | 6.47 | 4.80 | 4.61 | 3.56 |
| Tokyo Night | scuro | 10.59 | 9.02 | 6.90 | 4.60 | 7.43 | 6.79 |
| Nord | chiaro | 10.84 | 12.49 | 8.63 | 7.38 | 4.62 | 4.01 |
| Nord | scuro | 10.84 | 8.73 | 7.45 | 4.61 | 8.15 | 6.24 |
| Gruvbox | chiaro | 12.99 | 13.39 | 8.01 | 5.92 | 5.40 | 5.40 |
| Gruvbox | scuro | 12.99 | 10.22 | 6.76 | 4.63 | 6.93 | 5.84 |
| Catppuccin | chiaro | 7.06 | 7.99 | 6.25 | 4.94 | 5.41 | 4.79 |
| Catppuccin | scuro | 9.92 | 8.30 | 6.83 | 4.62 | 8.49 | 6.84 |
| Grafit | chiaro | 15.12 | 16.49 | 8.78 | 5.22 | 5.10 | 4.68 |
| Grafit | scuro | 13.68 | 11.79 | 7.87 | 4.65 | 9.96 | 9.94 |
| Ocean | chiaro | 16.13 | 17.85 | 8.96 | 5.25 | 5.93 | 5.36 |
| Ocean | scuro | 14.48 | 12.56 | 9.37 | 4.62 | 7.83 | 8.33 |

## 4. Licenze, e la decisione su Ametista

Cinque delle nove palette sono pubbliche e famose. Quattro sono liberamente utilizzabili e la
loro meta chiara viene dallo stesso repository e dalla stessa licenza: **Tokyo Night**
(Apache 2.0), **Nord** (MIT), **Gruvbox** (MIT/X11), **Catppuccin** (MIT). Per Apache 2.0 va
conservato l avviso di licenza e vanno segnalate le modifiche.

**Dracula e diverso, e va detto per intero.** La palette scura e MIT e si usa senza problemi.
Il tema chiaro ufficiale, Alucard, fa invece parte di Dracula PRO, che e un prodotto a
pagamento; i valori usati qui vengono da un repository di terzi che li ripubblica **senza
alcun file di licenza**. Messo davanti a questo, il 5 settembre 2026 Manuel ha deciso di
tenerli e di rinominare il tema: si chiama **Ametista** e non porta ne il nome Dracula ne il
nome Alucard.

Questa spec scrive la provenienza per esteso apposta: il nome e cambiato per non usare marchi
altrui, **non** per far perdere le tracce di dove vengono quei colori. Chi in futuro volesse
liberarsene deve solo rifare il set `light` di `ametista` partendo dal suo `dark`, che e MIT:
mezz ora di lavoro, e il resto del tema non si tocca.

## 5. Cosa deve fare la sessione scheletro

1. Un file per tema in `src/themes/<id>.ts`, coi valori dei blocchi JSON qui sotto: sono gia
   nella forma del tipo `Theme` di `contract.ts`.
2. Registrarli in `src/themes/index.ts`. `DEFAULT_THEME_ID` **non** cambia: resta `minimal`.
3. Far girare `validateTheme` su tutti e nove e confermare zero `ContrastIssue`. Se un numero
   non torna, il colpevole e la trascrizione, non i valori.
4. Il campo `author` di ogni tema e `"Nikita Rodionov"`. L amico non chiede attribuzione, ma
   il campo esiste e la verita costa zero.
5. Per Tokyo Night: mettere l avviso di licenza Apache 2.0 dove il progetto tiene le note di
   terze parti, e segnalare che i valori sono stati modificati (`inkFaint`, `accentHi`).
6. Banchi prima del push: `npx tsc --noEmit`, `npx eslint .`, `node scripts/verify-i18n.mjs`.
   I nomi dei temi passano da `t()` come tutto il resto del testo a schermo.
7. `src/themes/` e scheletro: la sessione va aperta quando nessun altra chat sta scrivendo CSS
   o temi (`WORKERS.md`, `AGENTS.md` par. 1 e 2).

## 6. I nove temi

L identita di un tema e il suo `id`, non il numero: la numerazione qui sotto e solo l ordine di questa lista, mentre nel mockup `temi-regalo.html` i temi sono numerati da 01 a 10 perche li c e anche Vampire, che Manuel ha escluso.

### 1. Korall ardesia (`ardesia`)

Font: **inter** (UI) + **spectral** (prosa), prosa a 18px.

**Provenienza.** Tema proprio dell autore.

Il set chiaro non esisteva: disegnato in questa sessione, tenendo il fondo freddo come dice la sua intenzione.

**Nota.** Rinominato il 5 settembre 2026, scelta di Manuel. L autore lo definiva come Vampire con l accento ammorbidito, ma Vampire non entra in dayalogue e due temi non possono chiamarsi Korall. "Ardesia" dice la cosa che davvero lo distingue dall altro Korall: il fondo grigio-azzurro freddo contro il fondo bruno caldo. Non si e usato "Korall scuro" perche in dayalogue "chiaro" e "scuro" sono i due modi di ogni tema, e un tema chiamato "scuro" acceso in modo chiaro e una contraddizione a schermo.

**Correzioni applicate:**
  - scuro inkFaint #8B8DA0 -> #9092A4 (4.35 -> 4.63 su surface)

```json
{
  "id": "ardesia",
  "name": "Korall ardesia",
  "author": "Nikita Rodionov",
  "typography": {
    "fontUi": "inter",
    "fontProse": "spectral",
    "sizes": {
      "display": 40,
      "chapter": 28,
      "pageHeader": 24,
      "headline": 26,
      "title": 21,
      "prose": 18,
      "body": 14,
      "meta": 12,
      "label": 11,
      "metric": 32
    },
    "weights": {
      "headline": 600,
      "prose": 400,
      "label": 650,
      "metric": 300
    },
    "tracking": {
      "headline": "-0.022em",
      "label": "0.06em"
    },
    "lineHeight": {
      "display": 1.1,
      "editorial": 1.2,
      "prose": 1.6,
      "body": 1.45
    }
  },
  "shape": {
    "radius": {
      "sm": 8,
      "md": 12,
      "lg": 16,
      "xl": 18,
      "pill": 99,
      "circle": "50%"
    },
    "borderWidth": {
      "hairline": 1,
      "strong": 2
    }
  },
  "space": 1,
  "motion": {
    "press": 0.94
  },
  "light": {
    "bg": "#DEDFE8",
    "bgApp": "#F1F1F6",
    "surface": "#FFFFFF",
    "surface2": "#E7E8F0",
    "ink": "#21222C",
    "inkMuted": "#4B4D5E",
    "inkFaint": "#6C6F84",
    "accent": "#B0574F",
    "accentHi": "#D0675D",
    "accentPressed": "#974B44",
    "onAccent": "#FFFFFF",
    "success": "#1F7A4C",
    "danger": "#B3261E",
    "line": "rgba(33, 34, 44, 0.10)",
    "shadow": "#353646",
    "glow": "transparent",
    "warmth": "radial-gradient(100% 60% at 18% -12%, rgba(176, 87, 79, 0.045), transparent 68%)",
    "grain": 0
  },
  "dark": {
    "bg": "#191A21",
    "bgApp": "#21222C",
    "surface": "#282A36",
    "surface2": "#343746",
    "ink": "#F8F8F2",
    "inkMuted": "#BFC0CC",
    "inkFaint": "#9092A4",
    "accent": "#FF8A8A",
    "accentHi": "#FF9B9B",
    "accentPressed": "#E07979",
    "onAccent": "#2B1214",
    "success": "#FF8A8A",
    "danger": "#F0736A",
    "line": "rgba(255, 255, 255, 0.07)",
    "shadow": "#000000",
    "glow": "#FF8A8A",
    "warmth": "radial-gradient(100% 60% at 18% -12%, rgba(255, 138, 138, 0.06), transparent 68%)",
    "grain": 0
  }
}
```

### 2. Korall (`korall`)

Font: **dm-sans** (UI) + **eb-garamond** (prosa), prosa a 21px.

**Provenienza.** Tema proprio dell autore.

Il set chiaro non esisteva: disegnato in questa sessione, tenendo il fondo caldo come dice la sua intenzione.

**Correzioni applicate:**
  - scuro inkFaint #8F8286 -> #94878B (4.30 -> 4.60 su surface)

```json
{
  "id": "korall",
  "name": "Korall",
  "author": "Nikita Rodionov",
  "typography": {
    "fontUi": "dm-sans",
    "fontProse": "eb-garamond",
    "sizes": {
      "display": 40,
      "chapter": 28,
      "pageHeader": 24,
      "headline": 26,
      "title": 21,
      "prose": 21,
      "body": 14,
      "meta": 12,
      "label": 11,
      "metric": 32
    },
    "weights": {
      "headline": 600,
      "prose": 400,
      "label": 650,
      "metric": 300
    },
    "tracking": {
      "headline": "-0.022em",
      "label": "0.06em"
    },
    "lineHeight": {
      "display": 1.1,
      "editorial": 1.2,
      "prose": 1.6,
      "body": 1.45
    }
  },
  "shape": {
    "radius": {
      "sm": 8,
      "md": 12,
      "lg": 16,
      "xl": 18,
      "pill": 99,
      "circle": "50%"
    },
    "borderWidth": {
      "hairline": 1,
      "strong": 2
    }
  },
  "space": 1,
  "motion": {
    "press": 0.94
  },
  "light": {
    "bg": "#EEE3E1",
    "bgApp": "#FBF5F4",
    "surface": "#FFFFFF",
    "surface2": "#F3E9E7",
    "ink": "#241D1F",
    "inkMuted": "#54464A",
    "inkFaint": "#7A6569",
    "accent": "#B0574F",
    "accentHi": "#D0675D",
    "accentPressed": "#974B44",
    "onAccent": "#FFFFFF",
    "success": "#3F7355",
    "danger": "#A83A3A",
    "line": "rgba(36, 29, 31, 0.10)",
    "shadow": "#3A2E32",
    "glow": "transparent",
    "warmth": "radial-gradient(100% 60% at 18% -12%, rgba(176, 87, 79, 0.045), transparent 68%)",
    "grain": 0
  },
  "dark": {
    "bg": "#171416",
    "bgApp": "#1E1B1D",
    "surface": "#262124",
    "surface2": "#332C30",
    "ink": "#F6EFEF",
    "inkMuted": "#CBBFC1",
    "inkFaint": "#94878B",
    "accent": "#FF8A8A",
    "accentHi": "#FF9B9B",
    "accentPressed": "#E07979",
    "onAccent": "#2B1214",
    "success": "#FF8A8A",
    "danger": "#F0736A",
    "line": "rgba(255, 255, 255, 0.07)",
    "shadow": "#000000",
    "glow": "#FF8A8A",
    "warmth": "radial-gradient(100% 60% at 18% -12%, rgba(255, 138, 138, 0.06), transparent 68%)",
    "grain": 0
  }
}
```

### 3. Ametista (`ametista`)

Font: **inter** (UI) + **eb-garamond** (prosa), prosa a 21px.

**Provenienza.** Palette scura: Dracula, MIT, Copyright (c) 2023 Dracula Theme (github.com/dracula/dracula-theme).

Set chiaro: i valori di Alucard, il tema chiaro ufficiale di Dracula, che fa parte di Dracula PRO (prodotto a pagamento); ripresi da github.com/jaljoue/dracula-alucard.nvim, repository privo di file di licenza. NON e materiale libero. Decisione di Manuel del 5 settembre 2026: tenerli e rinominare il tema, che da qui in avanti si chiama Ametista e non porta ne il nome Dracula ne il nome Alucard.

**Nota.** Rinominato. Vedi la riga sulla provenienza: il nome e cambiato per non usare marchi altrui, NON per nascondere da dove vengono i valori chiari.

**Correzioni applicate:**
  - scuro inkFaint #8E91A8 -> #9FA1B5 (3.80 -> 4.63 su surface)

```json
{
  "id": "ametista",
  "name": "Ametista",
  "author": "Nikita Rodionov",
  "typography": {
    "fontUi": "inter",
    "fontProse": "eb-garamond",
    "sizes": {
      "display": 40,
      "chapter": 28,
      "pageHeader": 24,
      "headline": 26,
      "title": 21,
      "prose": 21,
      "body": 14,
      "meta": 12,
      "label": 11,
      "metric": 32
    },
    "weights": {
      "headline": 600,
      "prose": 400,
      "label": 650,
      "metric": 300
    },
    "tracking": {
      "headline": "-0.022em",
      "label": "0.06em"
    },
    "lineHeight": {
      "display": 1.1,
      "editorial": 1.2,
      "prose": 1.6,
      "body": 1.45
    }
  },
  "shape": {
    "radius": {
      "sm": 8,
      "md": 12,
      "lg": 16,
      "xl": 18,
      "pill": 99,
      "circle": "50%"
    },
    "borderWidth": {
      "hairline": 1,
      "strong": 2
    }
  },
  "space": 1,
  "motion": {
    "press": 0.94
  },
  "light": {
    "bg": "#F5F1E3",
    "bgApp": "#FFFBEB",
    "surface": "#FFFFFF",
    "surface2": "#F5F1E3",
    "ink": "#1F1F1F",
    "inkMuted": "#4A4A4A",
    "inkFaint": "#6C664B",
    "accent": "#644AC9",
    "accentHi": "#7657ED",
    "accentPressed": "#5640AD",
    "onAccent": "#FFFFFF",
    "success": "#14710A",
    "danger": "#CB3A2A",
    "line": "rgba(31, 31, 31, 0.10)",
    "shadow": "#323232",
    "glow": "transparent",
    "warmth": "radial-gradient(100% 60% at 18% -12%, rgba(100, 74, 201, 0.045), transparent 68%)",
    "grain": 0
  },
  "dark": {
    "bg": "#21222C",
    "bgApp": "#282A36",
    "surface": "#343746",
    "surface2": "#414458",
    "ink": "#F8F8F2",
    "inkMuted": "#C4C6D4",
    "inkFaint": "#9FA1B5",
    "accent": "#BD93F9",
    "accentHi": "#D4A5FF",
    "accentPressed": "#A681DB",
    "onAccent": "#17102A",
    "success": "#BD93F9",
    "danger": "#F0736A",
    "line": "rgba(255, 255, 255, 0.07)",
    "shadow": "#000000",
    "glow": "#BD93F9",
    "warmth": "radial-gradient(100% 60% at 18% -12%, rgba(189, 147, 249, 0.06), transparent 68%)",
    "grain": 0
  }
}
```

### 4. Tokyo Night (`tokyo`)

Font: **ibm-plex-mono** (UI) + **newsreader** (prosa), prosa a 19px.

**Provenienza.** Tokyo Night, Apache License 2.0 (github.com/folke/tokyonight.nvim).

Set chiaro: Tokyo Night Day, stesso repository e stessa licenza (extras/lua/tokyonight_day.lua). Apache 2.0 chiede di conservare l avviso di licenza e di segnalare le modifiche.

**Correzioni applicate:**
  - scuro inkFaint #7A82AB -> #888FB4 (3.89 -> 4.60 su surface)
  - chiaro accent #2E7DE9 -> #1A71E7 (4.02 -> 4.61 col testo del bottone)

```json
{
  "id": "tokyo",
  "name": "Tokyo Night",
  "author": "Nikita Rodionov",
  "typography": {
    "fontUi": "ibm-plex-mono",
    "fontProse": "newsreader",
    "sizes": {
      "display": 40,
      "chapter": 28,
      "pageHeader": 24,
      "headline": 26,
      "title": 21,
      "prose": 19,
      "body": 14,
      "meta": 12,
      "label": 11,
      "metric": 32
    },
    "weights": {
      "headline": 600,
      "prose": 400,
      "label": 650,
      "metric": 300
    },
    "tracking": {
      "headline": "-0.022em",
      "label": "0.10em"
    },
    "lineHeight": {
      "display": 1.1,
      "editorial": 1.2,
      "prose": 1.6,
      "body": 1.45
    }
  },
  "shape": {
    "radius": {
      "sm": 8,
      "md": 12,
      "lg": 16,
      "xl": 18,
      "pill": 99,
      "circle": "50%"
    },
    "borderWidth": {
      "hairline": 1,
      "strong": 2
    }
  },
  "space": 1,
  "motion": {
    "press": 0.94
  },
  "light": {
    "bg": "#D0D5E3",
    "bgApp": "#E1E2E7",
    "surface": "#FFFFFF",
    "surface2": "#D8DCEA",
    "ink": "#3760BF",
    "inkMuted": "#4A5A9E",
    "inkFaint": "#68709A",
    "accent": "#1A71E7",
    "accentHi": "#1F85FF",
    "accentPressed": "#1661C7",
    "onAccent": "#FFFFFF",
    "success": "#587539",
    "danger": "#C64343",
    "line": "rgba(55, 96, 191, 0.10)",
    "shadow": "#3760BF",
    "glow": "transparent",
    "warmth": "radial-gradient(100% 60% at 18% -12%, rgba(26, 113, 231, 0.045), transparent 68%)",
    "grain": 0
  },
  "dark": {
    "bg": "#16161E",
    "bgApp": "#1A1B26",
    "surface": "#24283B",
    "surface2": "#2F3549",
    "ink": "#C0CAF5",
    "inkMuted": "#A9B1D6",
    "inkFaint": "#888FB4",
    "accent": "#7AA2F7",
    "accentHi": "#89B5FF",
    "accentPressed": "#6B8FD9",
    "onAccent": "#0B1220",
    "success": "#7AA2F7",
    "danger": "#F0736A",
    "line": "rgba(255, 255, 255, 0.07)",
    "shadow": "#000000",
    "glow": "#7AA2F7",
    "warmth": "radial-gradient(100% 60% at 18% -12%, rgba(122, 162, 247, 0.06), transparent 68%)",
    "grain": 0
  }
}
```

### 5. Nord (`nord`)

Font: **dm-sans** (UI) + **newsreader** (prosa), prosa a 19px.

**Provenienza.** Nord, MIT, Copyright (c) 2016-present Sven Greb (github.com/nordtheme/nord).

Set chiaro: gruppi Snow Storm (nord4-nord6) e Polar Night (nord0-nord3), gia dentro la palette ufficiale.

**Correzioni applicate:**
  - scuro inkFaint #95A0B3 -> #A7B0C0 (3.81 -> 4.61 su surface)
  - chiaro accent #5E81AC -> #5477A3 (4.03 -> 4.62 col testo del bottone)

```json
{
  "id": "nord",
  "name": "Nord",
  "author": "Nikita Rodionov",
  "typography": {
    "fontUi": "dm-sans",
    "fontProse": "newsreader",
    "sizes": {
      "display": 40,
      "chapter": 28,
      "pageHeader": 24,
      "headline": 26,
      "title": 21,
      "prose": 19,
      "body": 14,
      "meta": 12,
      "label": 11,
      "metric": 32
    },
    "weights": {
      "headline": 600,
      "prose": 400,
      "label": 650,
      "metric": 300
    },
    "tracking": {
      "headline": "-0.022em",
      "label": "0.06em"
    },
    "lineHeight": {
      "display": 1.1,
      "editorial": 1.2,
      "prose": 1.6,
      "body": 1.45
    }
  },
  "shape": {
    "radius": {
      "sm": 8,
      "md": 12,
      "lg": 16,
      "xl": 18,
      "pill": 99,
      "circle": "50%"
    },
    "borderWidth": {
      "hairline": 1,
      "strong": 2
    }
  },
  "space": 1,
  "motion": {
    "press": 0.94
  },
  "light": {
    "bg": "#D8DEE9",
    "bgApp": "#ECEFF4",
    "surface": "#FFFFFF",
    "surface2": "#E5E9F0",
    "ink": "#2E3440",
    "inkMuted": "#434C5E",
    "inkFaint": "#4C566A",
    "accent": "#5477A3",
    "accentHi": "#638CC0",
    "accentPressed": "#48668C",
    "onAccent": "#FFFFFF",
    "success": "#4A6E4F",
    "danger": "#A5454E",
    "line": "rgba(46, 52, 64, 0.10)",
    "shadow": "#4A5366",
    "glow": "transparent",
    "warmth": "radial-gradient(100% 60% at 18% -12%, rgba(84, 119, 163, 0.045), transparent 68%)",
    "grain": 0
  },
  "dark": {
    "bg": "#272C36",
    "bgApp": "#2E3440",
    "surface": "#3B4252",
    "surface2": "#434C5E",
    "ink": "#ECEFF4",
    "inkMuted": "#D8DEE9",
    "inkFaint": "#A7B0C0",
    "accent": "#88C0D0",
    "accentHi": "#98D7E9",
    "accentPressed": "#78A9B7",
    "onAccent": "#12222A",
    "success": "#88C0D0",
    "danger": "#F0736A",
    "line": "rgba(255, 255, 255, 0.07)",
    "shadow": "#000000",
    "glow": "#88C0D0",
    "warmth": "radial-gradient(100% 60% at 18% -12%, rgba(136, 192, 208, 0.06), transparent 68%)",
    "grain": 0
  }
}
```

### 6. Gruvbox (`gruvbox`)

Font: **ibm-plex-mono** (UI) + **eb-garamond** (prosa), prosa a 21px.

**Provenienza.** Gruvbox, MIT/X11, dichiarata nel README (github.com/morhetz/gruvbox).

Set chiaro: light0/light1/light2, dark0-dark3 e i colori faded_*, dallo stesso colors/gruvbox.vim.

**Correzioni applicate:**
  - scuro inkFaint #A08F73 -> #B0A28B (3.68 -> 4.63 su surface)

```json
{
  "id": "gruvbox",
  "name": "Gruvbox",
  "author": "Nikita Rodionov",
  "typography": {
    "fontUi": "ibm-plex-mono",
    "fontProse": "eb-garamond",
    "sizes": {
      "display": 40,
      "chapter": 28,
      "pageHeader": 24,
      "headline": 26,
      "title": 21,
      "prose": 21,
      "body": 14,
      "meta": 12,
      "label": 11,
      "metric": 32
    },
    "weights": {
      "headline": 600,
      "prose": 400,
      "label": 650,
      "metric": 300
    },
    "tracking": {
      "headline": "-0.022em",
      "label": "0.10em"
    },
    "lineHeight": {
      "display": 1.1,
      "editorial": 1.2,
      "prose": 1.6,
      "body": 1.45
    }
  },
  "shape": {
    "radius": {
      "sm": 8,
      "md": 12,
      "lg": 16,
      "xl": 18,
      "pill": 99,
      "circle": "50%"
    },
    "borderWidth": {
      "hairline": 1,
      "strong": 2
    }
  },
  "space": 1,
  "motion": {
    "press": 0.94
  },
  "light": {
    "bg": "#EBDBB2",
    "bgApp": "#FBF1C7",
    "surface": "#F9F5D7",
    "surface2": "#EBDBB2",
    "ink": "#282828",
    "inkMuted": "#504945",
    "inkFaint": "#665C54",
    "accent": "#AF3A03",
    "accentHi": "#CE4404",
    "accentPressed": "#963203",
    "onAccent": "#FBF1C7",
    "success": "#427B58",
    "danger": "#9D0006",
    "line": "rgba(40, 40, 40, 0.10)",
    "shadow": "#404040",
    "glow": "transparent",
    "warmth": "radial-gradient(100% 60% at 18% -12%, rgba(175, 58, 3, 0.045), transparent 68%)",
    "grain": 0
  },
  "dark": {
    "bg": "#1F1F1F",
    "bgApp": "#282828",
    "surface": "#3C3836",
    "surface2": "#504945",
    "ink": "#FBF1C7",
    "inkMuted": "#D5C4A1",
    "inkFaint": "#B0A28B",
    "accent": "#FE8019",
    "accentHi": "#FF8F1C",
    "accentPressed": "#E07116",
    "onAccent": "#2A1403",
    "success": "#FE8019",
    "danger": "#F0736A",
    "line": "rgba(255, 255, 255, 0.07)",
    "shadow": "#000000",
    "glow": "#FE8019",
    "warmth": "radial-gradient(100% 60% at 18% -12%, rgba(254, 128, 25, 0.06), transparent 68%)",
    "grain": 0
  }
}
```

### 7. Catppuccin (`catppuccin`)

Font: **dm-sans** (UI) + **cormorant-garamond** (prosa), prosa a 22px.

**Provenienza.** Catppuccin, MIT, Copyright (c) 2021 Catppuccin (github.com/catppuccin/palette).

Set chiaro: gusto Latte, dallo stesso palette.json.

**Correzioni applicate:**
  - scuro inkFaint #8087A2 -> #989EB4 (3.46 -> 4.62 su surface)

```json
{
  "id": "catppuccin",
  "name": "Catppuccin",
  "author": "Nikita Rodionov",
  "typography": {
    "fontUi": "dm-sans",
    "fontProse": "cormorant-garamond",
    "sizes": {
      "display": 40,
      "chapter": 28,
      "pageHeader": 24,
      "headline": 26,
      "title": 21,
      "prose": 22,
      "body": 14,
      "meta": 12,
      "label": 11,
      "metric": 32
    },
    "weights": {
      "headline": 600,
      "prose": 500,
      "label": 650,
      "metric": 300
    },
    "tracking": {
      "headline": "-0.022em",
      "label": "0.16em"
    },
    "lineHeight": {
      "display": 1.1,
      "editorial": 1.2,
      "prose": 1.6,
      "body": 1.45
    }
  },
  "shape": {
    "radius": {
      "sm": 8,
      "md": 12,
      "lg": 16,
      "xl": 18,
      "pill": 99,
      "circle": "50%"
    },
    "borderWidth": {
      "hairline": 1,
      "strong": 2
    }
  },
  "space": 1,
  "motion": {
    "press": 0.94
  },
  "light": {
    "bg": "#DCE0E8",
    "bgApp": "#EFF1F5",
    "surface": "#FFFFFF",
    "surface2": "#E6E9EF",
    "ink": "#4C4F69",
    "inkMuted": "#5C5F77",
    "inkFaint": "#6C6F85",
    "accent": "#8839EF",
    "accentHi": "#A043FF",
    "accentPressed": "#7531CE",
    "onAccent": "#FFFFFF",
    "success": "#40A02B",
    "danger": "#D20F39",
    "line": "rgba(76, 79, 105, 0.10)",
    "shadow": "#4C4F69",
    "glow": "transparent",
    "warmth": "radial-gradient(100% 60% at 18% -12%, rgba(136, 57, 239, 0.045), transparent 68%)",
    "grain": 0
  },
  "dark": {
    "bg": "#1E2030",
    "bgApp": "#24273A",
    "surface": "#303446",
    "surface2": "#3E4459",
    "ink": "#CAD3F5",
    "inkMuted": "#B8C0E0",
    "inkFaint": "#989EB4",
    "accent": "#C6A0F6",
    "accentHi": "#DEB3FF",
    "accentPressed": "#AE8DD8",
    "onAccent": "#1B0F2B",
    "success": "#C6A0F6",
    "danger": "#F0736A",
    "line": "rgba(255, 255, 255, 0.07)",
    "shadow": "#000000",
    "glow": "#C6A0F6",
    "warmth": "radial-gradient(100% 60% at 18% -12%, rgba(198, 160, 246, 0.06), transparent 68%)",
    "grain": 0
  }
}
```

### 8. Grafit (`grafit`)

Font: **inter** (UI) + **newsreader** (prosa), prosa a 19px.

**Provenienza.** Tema proprio dell autore.

Il set chiaro non esisteva: disegnato in questa sessione, fondo neutro e un solo accento vivo.

**Correzioni applicate:**
  - scuro inkFaint #7A828F -> #8D949F (3.67 -> 4.65 su surface)

```json
{
  "id": "grafit",
  "name": "Grafit",
  "author": "Nikita Rodionov",
  "typography": {
    "fontUi": "inter",
    "fontProse": "newsreader",
    "sizes": {
      "display": 40,
      "chapter": 28,
      "pageHeader": 24,
      "headline": 26,
      "title": 21,
      "prose": 19,
      "body": 14,
      "meta": 12,
      "label": 11,
      "metric": 32
    },
    "weights": {
      "headline": 600,
      "prose": 400,
      "label": 650,
      "metric": 300
    },
    "tracking": {
      "headline": "-0.022em",
      "label": "0.06em"
    },
    "lineHeight": {
      "display": 1.1,
      "editorial": 1.2,
      "prose": 1.6,
      "body": 1.45
    }
  },
  "shape": {
    "radius": {
      "sm": 8,
      "md": 12,
      "lg": 16,
      "xl": 18,
      "pill": 99,
      "circle": "50%"
    },
    "borderWidth": {
      "hairline": 1,
      "strong": 2
    }
  },
  "space": 1,
  "motion": {
    "press": 0.94
  },
  "light": {
    "bg": "#E4E7EB",
    "bgApp": "#F4F5F7",
    "surface": "#FFFFFF",
    "surface2": "#EBEDF1",
    "ink": "#1C1F26",
    "inkMuted": "#454B55",
    "inkFaint": "#666D78",
    "accent": "#0E7C6B",
    "accentHi": "#11927E",
    "accentPressed": "#0C6B5C",
    "onAccent": "#FFFFFF",
    "success": "#0E7C6B",
    "danger": "#B3352F",
    "line": "rgba(28, 31, 38, 0.10)",
    "shadow": "#2D323D",
    "glow": "transparent",
    "warmth": "radial-gradient(100% 60% at 18% -12%, rgba(14, 124, 107, 0.045), transparent 68%)",
    "grain": 0
  },
  "dark": {
    "bg": "#171A20",
    "bgApp": "#1C1F26",
    "surface": "#262B34",
    "surface2": "#2E343E",
    "ink": "#E8EAED",
    "inkMuted": "#BFC0CC",
    "inkFaint": "#8D949F",
    "accent": "#2DE1C2",
    "accentHi": "#32FCD9",
    "accentPressed": "#28C6AB",
    "onAccent": "#10221F",
    "success": "#2DE1C2",
    "danger": "#F0736A",
    "line": "rgba(255, 255, 255, 0.07)",
    "shadow": "#000000",
    "glow": "#2DE1C2",
    "warmth": "radial-gradient(100% 60% at 18% -12%, rgba(45, 225, 194, 0.06), transparent 68%)",
    "grain": 0
  }
}
```

### 9. Ocean (`ocean`)

Font: **dm-sans** (UI) + **spectral** (prosa), prosa a 19px.

**Provenienza.** Tema proprio dell autore.

Il set chiaro non esisteva: disegnato in questa sessione, tenendo il fondo profondo.

**Correzioni applicate:**
  - scuro inkFaint #7C8AA5 -> #7F8DA7 (4.45 -> 4.62 su surface)

```json
{
  "id": "ocean",
  "name": "Ocean",
  "author": "Nikita Rodionov",
  "typography": {
    "fontUi": "dm-sans",
    "fontProse": "spectral",
    "sizes": {
      "display": 40,
      "chapter": 28,
      "pageHeader": 24,
      "headline": 26,
      "title": 21,
      "prose": 19,
      "body": 14,
      "meta": 12,
      "label": 11,
      "metric": 32
    },
    "weights": {
      "headline": 600,
      "prose": 400,
      "label": 650,
      "metric": 300
    },
    "tracking": {
      "headline": "-0.022em",
      "label": "0.06em"
    },
    "lineHeight": {
      "display": 1.1,
      "editorial": 1.2,
      "prose": 1.6,
      "body": 1.45
    }
  },
  "shape": {
    "radius": {
      "sm": 8,
      "md": 12,
      "lg": 16,
      "xl": 18,
      "pill": 99,
      "circle": "50%"
    },
    "borderWidth": {
      "hairline": 1,
      "strong": 2
    }
  },
  "space": 1,
  "motion": {
    "press": 0.94
  },
  "light": {
    "bg": "#DCE5EF",
    "bgApp": "#EFF4F9",
    "surface": "#FFFFFF",
    "surface2": "#E6EDF5",
    "ink": "#0F172A",
    "inkMuted": "#3C4A61",
    "inkFaint": "#5E6D84",
    "accent": "#0369A1",
    "accentHi": "#047CBE",
    "accentPressed": "#035A8A",
    "onAccent": "#FFFFFF",
    "success": "#166534",
    "danger": "#B3261E",
    "line": "rgba(15, 23, 42, 0.10)",
    "shadow": "#182543",
    "glow": "transparent",
    "warmth": "radial-gradient(100% 60% at 18% -12%, rgba(3, 105, 161, 0.045), transparent 68%)",
    "grain": 0
  },
  "dark": {
    "bg": "#0B1220",
    "bgApp": "#0F172A",
    "surface": "#1B2438",
    "surface2": "#273349",
    "ink": "#E2E8F0",
    "inkMuted": "#C0CADB",
    "inkFaint": "#7F8DA7",
    "accent": "#38BDF8",
    "accentHi": "#3FD4FF",
    "accentPressed": "#31A6DA",
    "onAccent": "#04202E",
    "success": "#38BDF8",
    "danger": "#F0736A",
    "line": "rgba(255, 255, 255, 0.07)",
    "shadow": "#000000",
    "glow": "#38BDF8",
    "warmth": "radial-gradient(100% 60% at 18% -12%, rgba(56, 189, 248, 0.06), transparent 68%)",
    "grain": 0
  }
}
```

