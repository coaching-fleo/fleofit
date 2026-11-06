# Landing `/benvenuto` (dal 02/11/2026)

Pagina pubblica, **solo web**: nessuno ci arriva dall'app nativa. Rotta in `App.jsx`,
codice in `src/pages/Landing.jsx` + `Landing.css` (classi tutte `lp-`) + `landingDati.js`.

## A chi parla
Ai **coach** (Hyrox, running, palestra), non agli atleti — decisione del committente.
- Unica azione: **Accedi** (più «Schermata TV»). Nessuna richiesta d'accesso via mail:
  l'accesso è su invito.
- **Non si nomina Federico Leo** nei testi (decisione del committente).
- Niente numeri, recensioni o prezzi inventati. Non dire che c'è su Android: non è sul
  Play Store. Si dice «iPhone e browser».

## Il telefono che si muove, e si tocca
Ispirato ad aster.video: lo scroll lo muove e lo porta di capitolo in capitolo, e intanto
la persona lo **usa** (decisione del committente, 02/11/2026: gli screenshot fermi non
bastavano). `POSE.largo` e `POSE.stretto` (sotto gli 860 px) hanno **una posa in più dei
capitoli** (l'apertura): chi aggiunge un capitolo aggiunge una posa a entrambe.
- Dentro gira **un'app finta**, `src/pages/LandingApp.jsx` + `LandingApp.css` (classi
  `lm-`): Home coach, builder (apri blocco, cambia tipo, aggiungi, elimina, «Genera con IA»
  con Annulla, Assegna), calendario, atleti e scheda atleta. 🔴 **Non tocca il database né
  la rete**: stato in memoria e dati di esempio inventati. Non importare mai
  `supabaseClient` lì dentro.
- È disegnata in **pixel a 402×874** e scalata da un `ResizeObserver` sulla larghezza dello
  schermo del telefono: si scrive come una pagina normale, senza le unità `em` del telefono.
- Ogni capitolo porta l'app a una `scena` (`SCENE` in LandingApp) e mostra «cosa provare».
  Il cambio scena tocca solo dove si è (tab, foglio, blocco aperto): i blocchi modificati restano.
- **Si deve vedere che è un oggetto in 3D e che si tocca** (committente, 02/11/2026):
  - 30 lastre `lp-spessore` (≈ 72 pt: più spesso di un iPhone vero, lo ha chiesto il
    committente), tasti sui fianchi
    (`lp-tasto`, lastrine girate di 90°), riflesso sul vetro che segue la rotazione (`--luce`),
    prospettiva 1200 px (900 su telefono), rotazioni fino a 46°. Sul computer `ry` resta
    sempre negativo: con il telefono a destra, un `ry` positivo nasconde il fianco;
  - la posa disegnata **insegue** quella voluta (lerp 0,12 a ogni fotogramma) con un leggero
    ondeggiare continuo; il giro di `requestAnimationFrame` si ferma fuori schermo;
  - col mouse sopra si raddrizza (× 0,3), si avvicina e si piega verso il puntatore;
  - l'etichetta gialla «Toccalo, funziona» galleggia davanti al telefono finché nessuno lo
    tocca; dentro l'app un cerchio pulsa sul punto da provare (`QUI` in LandingApp), una
    volta per capitolo, finché la persona non tocca.
- Palco e apertura hanno `pointer-events: none`; il telefono e il testo attivo `auto`.
- 🔴 **I testi dei capitoli NON scorrono** (correzione del committente, 02/11/2026, guardando
  aster.video da telefono): stanno dentro la vista appiccicata (`.lp-testi`), impilati nella
  stessa cella, e si danno il cambio con dissolvenza e 12 px di salita. I `.lp-capitolo`
  sono solo spazio da scorrere. Così il telefono resta al suo posto e nessuna scritta ci
  passa sopra. Su telefono: dispositivo in alto, testo nella fascia sotto.
- `attivo` vale 0 finché il telefono non è salito al suo posto (`p < 0.85`): niente testo di
  capitolo sopra l'apertura.
- ⚠️ L'app finta imita quella vera a mano: se l'app cambia aspetto, va riallineata.

### Zoom, testo che sale, indice (03/11/2026, richiesta del committente)
- **Linea del tempo**: apertura alta A, ogni capitolo `.lp-capitolo` 150vh, coda 50vh.
  `p = sc < A ? sc/A : 1 + (sc-A)/C`; capitolo `floor(p)`, frazione `f`. La posa cambia
  fra f 0,6 e 1.
- **Zoom sui dettagli**: `avvicina(f)` sale fra f 0,1 e 0,26, tiene, scende fra 0,42 e
  0,58. Il punto da ingrandire è `CAPITOLI[i].zoom` (`fx`, `fy` in frazioni dello schermo,
  `s` ingrandimento; su telefono × 0,7). Durante lo zoom le rotazioni calano del 65%.
  La traslazione è `-(f-0,5) × lato × Z × scala`: con `(Z-1)` il dettaglio restava in alto.
- **Il testo sale con lo scroll** (`--g` sul contenitore, `--corsa-testo` 240 px, 64 su
  telefono): serve a far capire che la pagina scorre. Il testo non attivo esce verso l'alto.
- **Apertura**: la posa 0 sul computer si calcola dal fondo di `.lp-nota`, così il telefono
  sta sotto i testi e non ci passa sopra. Bottone «Scorri» → primo capitolo.
- **Su telefono** la vista misura la fascia del testo (`--fascia`) e una `mask-image` sfuma il
  telefono sopra: lo zoom non copre le scritte.
- **Indice** (`Indice`, a sinistra, fisso): `VOCI` elenca capitoli e sezioni; `posizione(id)`
  porta i capitoli all'inizio del loro spazio (+2 px) e le sezioni 72 px sotto il bordo;
  `vaiA` scorre liscio (subito con movimento ridotto). Chi aggiunge un capitolo o una sezione
  aggiunge una voce.

## La schermata da computer
`src/assets/landing/builder-desktop.webp` è una cattura vera dall'ambiente di prova
(`npm run demo`) fatta con `tools/landing-schermate/cattura.mjs` (puppeteer-core + Chrome
installato), convertita con `cwebp`. Tagliata in modo da **escludere** il nome del coach.
Trappole della cattura: `networkidle0` non arriva mai (si aspetta a tempo); il builder apre
un `beforeunload` che blocca il secondo `goto` (pagina nuova per ogni cattura e
`dialog.accept()`); `sips -c` taglia dal centro, si usa `clip` di puppeteer.

## SEO
`useTestaPagina` mette titolo, description, canonical, Open Graph e JSON-LD (`WebPage`,
`SoftwareApplication` **senza offers né valutazioni**, `FAQPage`) e li toglie all'uscita.
La FAQ del JSON-LD è la stessa costante `FAQ` mostrata a schermo: devono coincidere.
⚠️ È una SPA: i crawler che non eseguono JavaScript vedono solo `index.html`.
