# Il recupero da Garmin nella scheda atleta — piano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** rifare la card «Recupero · da Garmin» della scheda atleta come sezione «Recupero» a tessere (frase, sonno, quattro tessere con le colonnine delle 7 notti, «Come ha detto di stare»).

**Architecture:** tutta la logica (medie, scarti, segnali, frase, colonnine) in una funzione pura `riepilogoRecupero` di `src/lib/recuperoGarmin.js`; `CardRecupero.jsx` la riceve già calcolata e la disegna; `AthleteDetail.jsx` legge 42 giorni di giornate e la risposta di oggi a «Come stai».

**Tech Stack:** React 19, Tailwind 4, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-26-recupero-garmin-scheda-design.md` · lavagna `tools/design-garmin-scheda/index.html` (proposta 1).

## Global Constraints
- Nessuna migrazione, nessun dato nuovo da Garmin; si leggono solo `garmin_giornate` e `come_stai`.
- Nessun colore nuovo: fuori norma = `orange-400` (`#fb923c`); il resto grigi e bianchi. Tessere `bg-[#18181b]`, bordo `border-white/[.08]`, raggio 26px.
- Nessun punteggio unico, nessuna linea, nessun cursore.
- Nessuno zero inventato: un dato che manca non ha tessera; una notte senza dato è uno spazio vuoto fra le colonnine.
- Tinta e colonnine arancioni **solo** per HRV, FC, sonno con un segnale di `segnaliRecupero`; Body Battery e stress mai.
- Testo dell'interfaccia in italiano; seconda persona sul proprio profilo (`proprio: true`).
- `CardRecupero` resta caricata con `lazy()`.
- I test nuovi si vedono fallire prima (CLAUDE.md §9, ultimo punto).

## Review Focus
1. Atleta collegato da 5 notti → frase «Servono 14 notti…: ne ha 5», nessuna pillola, nessuna riga della media (test in Task 1 e 2).
2. Ultimo dato di 3 giorni fa → la tessera dice il giorno («lun 23»), non «stanotte» (Task 1: `etichettaGiorno`).
3. Riga con `sonno: {}` o solo `giornata` → nessuna tessera Sonno e nessun «0 h» (Task 2).
4. Atleta senza risposta oggi a «Come stai» → niente tessera «Come ha detto di stare» e niente nota nella frase (Task 1 e 2).
5. Cambio di atleta nella scheda → mai le giornate o il «Come stai» dell'atleta di prima (Task 3).

---

### Task 1: `riepilogoRecupero`, la logica pura

**Files:**
- Modify: `src/lib/recuperoGarmin.js`
- Test: `src/lib/__tests__/recuperoGarmin.test.js` (nuovo `describe('riepilogoRecupero')`)

**Interfaces:**
- Consumes: `segnaliRecupero`, `oggiItalia`, `GIORNI_RIFERIMENTO`, `MINIMO_GIORNI` (stesso file); `DOMANDE`, `parolaRisposta` di `src/lib/comeStai.js`.
- Produces:
  ```js
  export const GIORNI_LETTURA = 42 // 28 di riferimento + 14 di fila massima
  export function riepilogoRecupero(righe, { comeStai = null, oggi = new Date(), proprio = false } = {})
  // → null se nessuna riga ha un dato; altrimenti:
  // {
  //   stato: 'segnali' | 'norma' | 'pochi',
  //   titolo: string,          // 'Da guardare' | 'Nella norma' | 'Si sta facendo un\'idea'
  //   giorni: number|null,     // la fila più lunga dei segnali ('da 3 notti'), solo con 'segnali'
  //   frase: { forte: string|null, testo: string, nota: string|null },
  //   sonno: null | { giorno, ore, mediaOre, punteggio, mediaPunteggio,
  //                   fasi: { profondo, rem, leggero, sveglio } /* minuti, chiavi assenti se mancano */, fuori },
  //   tessere: Array<{ chiave: 'hrv'|'fc'|'bb'|'stress', giorno, valore, media, scarto, fuori,
  //                    notti: Array<{ giorno, valore: number|null, fila: boolean }> /* sempre 7, l'ultima = oggi */ }>,
  //   comeStai: null | { sonno, energia, dolori, stress },
  // }
  export function etichettaGiorno(giorno, oggi = new Date()) // 'stanotte' per oggi o ieri, se no 'lun 23'
  ```
  Campi letti: `hrv.media_notte`, `giornata.fc_riposo`, `giornata.body_battery_carica` (bb), `giornata.stress_medio`, `sonno.ore`, `sonno.punteggio`, `sonno.profondo_min|rem_min|leggero_min|sveglio_min`.

Regole (dalla spec):
- **media** di una metrica = media dei valori nei 28 giorni prima di `inizio`, dove `inizio` è il primo giorno della fila del segnale se la metrica ne ha uno, altrimenti l'ultimo giorno con un dato; `null` sotto i 14 valori. `scarto` = valore − media (per hrv in %: `Math.round((v/m − 1) × 100)`), `null` se manca la media.
- `fuori` = la metrica ha un segnale (hrv, fc, sonno). `fila` di una notte = quel giorno è nella fila del segnale.
- **stato**: `'segnali'` se `segnaliRecupero` ne trova; altrimenti `'pochi'` se nessuna metrica ha una media; altrimenti `'norma'`.
- **frase** (terza persona; `proprio` → seconda):
  - segnali: `forte` = «Dorme poco e recupera meno del solito:» (sonno + hrv/fc) · «Recupera meno del solito:» (solo hrv/fc) · «Dorme poco:» (solo sonno); `testo` = le parti in quest'ordine, separate da «, »: `HRV −15%`, `FC a riposo +6`, `sotto le 6 ore di sonno`, chiuso da «.».
  - norma: `forte` null, `testo` «Tutto nella sua norma nelle ultime notti.»
  - pochi: `testo` «Servono 14 notti per conoscere la sua media: ne ha N.» (N = giorni distinti con almeno un dato).
  - `nota`: se `comeStai` ha risposte ≤ 2, «Stamattina ha detto: energia «Poca», sonno «Pessimo».» (ordine di `DOMANDE`, parole di `parolaRisposta`); altrimenti null.
  - seconda persona: «Dormi poco e recuperi meno del solito:», «Recuperi…», «Dormi poco:», «Tutto nella tua norma…», «…la tua media: ne hai N.», «Stamattina hai detto: …».
- **tessere**: nell'ordine hrv, fc, bb, stress, solo quelle con almeno un valore nelle 42 giornate.

- [ ] **Step 1: Write the failing tests** (in `recuperoGarmin.test.js`, con gli helper `giorno(i)` già del file e `OGGI` fisso)
  - `'righe vuote o senza dati → null'`: `riepilogoRecupero([])` e `riepilogoRecupero([{ giorno: giorno(0) }])` sono `null`.
  - `'28 notti normali + 3 storte → segnali, frase completa'`: hrv 60→51, fc 52→58, sonno 7,4→5,5 → `stato 'segnali'`, `giorni 3`, `frase.forte 'Dorme poco e recupera meno del solito:'`, `frase.testo 'HRV −15%, FC a riposo +6, sotto le 6 ore di sonno.'`; tessera hrv `fuori true`, `media 60`, `scarto -15`, le ultime tre `notti` con `fila true` e le prime quattro `false`.
  - `'bb e stress non sono mai fuori'`: con bb da 62 a 30 per 3 notti → tessera bb `fuori false`, `scarto -32`, tutte le `notti` con `fila false`.
  - `'5 notti → pochi'`: `stato 'pochi'`, `frase.testo 'Servono 14 notti per conoscere la sua media: ne ha 5.'`, ogni tessera `media null`, `scarto null`.
  - `'20 notti normali → norma'`: `frase.testo 'Tutto nella sua norma nelle ultime notti.'`, `giorni null`.
  - `'proprio: seconda persona'`: lo scenario storto con `proprio: true` → `forte 'Dormi poco e recuperi meno del solito:'`; lo scenario pochi → `'…la tua media: ne hai 5.'`.
  - `'come stai: nota solo con risposte ≤ 2'`: `{ sonno: 1, energia: 2, dolori: 3, stress: 4 }` → `nota 'Stamattina ha detto: sonno «Pessimo», energia «Poca».'`; `{ sonno: 3, energia: 3, dolori: 3, stress: 3 }` → `nota null`; `comeStai` restituito così com'è.
  - `'una notte senza dato è valore null nelle colonnine'`: manca `giorno(2)` → `notti[4].valore === null`.
  - `'fasi e punteggio del sonno'`: `sonno: { ore: 5.3, punteggio: 57, profondo_min: 45, rem_min: 50, leggero_min: 220, sveglio_min: 25 }` → `sonno.fasi` uguale a `{ profondo: 45, rem: 50, leggero: 220, sveglio: 25 }`; senza le fasi → `fasi` `{}`.
  - `'etichettaGiorno'`: oggi e ieri → `'stanotte'`; tre giorni fa (lun 26/10/2026 con OGGI 29/10) → `'lun 26'`.
- [ ] **Step 2: Run** `npx vitest run src/lib/__tests__/recuperoGarmin.test.js` → FAIL (`riepilogoRecupero is not a function`).
- [ ] **Step 3: Implement** `riepilogoRecupero`, `etichettaGiorno` e `GIORNI_LETTURA` in `src/lib/recuperoGarmin.js`, riusando `valoriPer`, `filaFinoAdOggi`/`riferimentoPrima` (aggiungi a `METRICHE` le voci `bb` ed `stress`, lasciando invariati i segnali, che restano su hrv/fc/sonno; `serieRecupero` continua a usare solo le prime tre: passagli la lista esplicita). Per la fila di ogni metrica usa i `giorni` del suo segnale (la fila finisce nell'ultimo giorno con dato).
- [ ] **Step 4: Run** lo stesso comando → PASS, e anche i test vecchi del file.
- [ ] **Step 5: Commit**
  ```bash
  git add src/lib/recuperoGarmin.js src/lib/__tests__/recuperoGarmin.test.js
  git commit -m "Recupero Garmin: riepilogoRecupero, la frase e le colonnine delle 7 notti"
  ```

### Task 2: `CardRecupero` a tessere

**Files:**
- Modify (riscrittura): `src/components/CardRecupero.jsx`
- Test: `src/components/__tests__/CardRecupero.test.jsx` (si riscrive: i test vecchi descrivono la card che sparisce)

**Interfaces:**
- Consumes: il ritorno di `riepilogoRecupero` e `etichettaGiorno` (Task 1); `TitoloSezione` di `SchedaAtletaUI.jsx`.
- Produces: `export default function CardRecupero({ riepilogo, oggi = new Date() })` → `null` se `riepilogo` è `null`. Radice `<section aria-label="Recupero">` con dentro `TitoloSezione titolo="Recupero" dettaglio="da Garmin"`.

Disegno come la lavagna (proposta 1), con questi attributi per i test: `data-stato` sulla tessera della frase, `data-tessera="sonno|hrv|fc|bb|stress|come-stai"`, `data-fuori` sulle tessere tinte, `data-notte` su ogni colonnina (`data-vuota` se `valore` è null), `data-media-riga` sulla riga tratteggiata. Pillole: hrv «−15% sulla media», fc/bb/stress «+6 sulla media», sonno «−2h 05m dalla media», scarto arrotondato a 0 → «come la media», senza media nessuna pillola. Icone `lucide-react`: `Watch`, `Moon`, `Activity`, `Heart`, `BatteryCharging`, `Gauge`, `Smile`. Riga finale grigia «Ultimo dato: {etichettaGiorno} · medie sulle 4 settimane».

- [ ] **Step 1: Write the failing tests**
  - `'riepilogo null → niente nel DOM'`.
  - `'scenario storto: frase, tessere tinte, colonnine arancioni'`: `data-stato="segnali"`, testo «Da guardare» e «da 3 notti»; `[data-tessera="hrv"][data-fuori]` c'è, `[data-tessera="bb"][data-fuori]` no; in hrv 7 `[data-notte]` e la pillola «−15% sulla media».
  - `'pochi: niente pillole né riga della media'`: nessun testo che contenga «sulla media», nessun `[data-media-riga]`.
  - `'una notte vuota è uno spazio, non una colonnina'`: un `[data-notte][data-vuota]` senza altezza (`style.height` vuoto).
  - `'sonno senza dato: nessuna tessera e nessun zero'`: riepilogo con `sonno: null` → nessun `[data-tessera="sonno"]` e il testo non matcha `/\b0 ?h/`.
  - `'come stai assente → nessuna tessera'`; presente → quattro valori «x/5».
  - `'ultimo dato vecchio → il giorno al posto di stanotte'`.
- [ ] **Step 2: Run** `npx vitest run src/components/__tests__/CardRecupero.test.jsx` → FAIL.
- [ ] **Step 3: Implement** la nuova `CardRecupero.jsx`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit**
  ```bash
  git add src/components/CardRecupero.jsx src/components/__tests__/CardRecupero.test.jsx
  git commit -m "Recupero Garmin: la card diventa una sezione a tessere"
  ```

### Task 3: cablaggio nella scheda, demo, documenti

**Files:**
- Modify: `src/pages/AthleteDetail.jsx` (effetto delle giornate, `pRecupero`, `pDati`)
- Modify: `src/__tests__/demoGarmin.test.jsx`
- Modify: `DESIGN.md` («La scheda atleta»), `docs/memoria/garmin.md` (Fase 2, nuova sottosezione «La sezione Recupero, 26/11/2026»), `docs/memoria/scheda-atleta.md` (riga in «9-scheda-ridisegnata»), `DEVLOG.md`, `BACKLOG.md` se c'è una voce sul recupero
- Add: `tools/design-garmin-scheda/index.html` e la spec, nello stesso commit

**Interfaces:**
- Consumes: `riepilogoRecupero`, `GIORNI_LETTURA` (Task 1), `CardRecupero({ riepilogo })` (Task 2), `leggiComeStai(athleteId, giorno)` di `src/lib/comeStai.js` (torna riga, `null` o `undefined`).

- [ ] **Step 1: Write the failing test** in `demoGarmin.test.jsx`: `'la scheda di Sara mostra la sezione Recupero con le tessere'` — monta `/athletes/at-sara` come coach (helper `montaPagina` già usato nei test della scheda), aspetta `region` «Recupero», controlla «Da guardare», `[data-tessera="hrv"][data-fuori]` e `[data-tessera="come-stai"]` (Sara ha la risposta di oggi nei semi).
- [ ] **Step 2: Run** `npx vitest run src/__tests__/demoGarmin.test.jsx` → FAIL.
- [ ] **Step 3: Implement**
  - L'effetto delle giornate legge `GIORNI_LETTURA` giorni (da `oggi − 41`), e accanto `leggiComeStai(id, oggiItalia())` in uno stato `comeStaiOggi` azzerato a ogni cambio di `id` insieme a `giornate` (`undefined`/errore → `null`).
  - `riepilogo = useMemo(() => riepilogoRecupero(giornate, { comeStai: comeStaiOggi, proprio: isOwnProfile }), …)`.
  - `pRecupero` = `<Suspense fallback={null}><CardRecupero riepilogo={riepilogo} /></Suspense>` quando `riepilogo` non è null, **fuori** da `pDati`: subito dopo nello stesso ordine di pagina (telefono e colonna sinistra del desktop).
- [ ] **Step 4: Run** `npm test` → tutto verde; `npm run build` → nessun errore, e `index` non cresce più di ~1 KB (CLAUDE.md §2).
- [ ] **Step 5: Verifica a occhio** con `npm run demo` (preview), `/athletes/at-sara` da telefono (375×812) e desktop: screenshot delle tessere.
- [ ] **Step 6: Documenti** (DESIGN, memoria, DEVLOG) e **commit**
  ```bash
  git add src/pages/AthleteDetail.jsx src/__tests__/demoGarmin.test.jsx DESIGN.md docs/memoria/garmin.md docs/memoria/scheda-atleta.md DEVLOG.md tools/design-garmin-scheda/index.html docs/superpowers/specs/2026-11-26-recupero-garmin-scheda-design.md docs/superpowers/plans/2026-11-26-recupero-garmin-scheda.md
  git commit -m "Scheda atleta: la sezione Recupero da Garmin a tessere"
  ```
