# Aggiornamento desktop: pagina «Analisi» e funzioni prese dai concorrenti — Piano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> ⚠️ **È una PROPOSTA da discutere col committente** (13/10/2026). La parte A
> confronta FLEOFIT con TrainHeroic, Coachway e CoachPlus; la parte B è il piano
> eseguibile della sola pagina **Analisi** (fase 1). Le fasi successive (parte C)
> diventano piani loro solo dopo il sì, e **quelle che chiedono una tabella nuova
> aspettano un sì esplicito** (CLAUDE.md §0, regola 0-bis).

**Goal:** dare al coach, sul desktop, una pagina di analisi a tutto schermo
(squadra e singolo atleta, su un periodo scelto) costruita **solo sui dati che
il database ha già**, e mettere in fila le funzioni dei concorrenti che valgono la pena.

**Architecture:** una rotta nuova `/analisi`, pigra, accesa solo quando `eDesktop`
è vero (web, ≥ 1024 px, coach). La logica sta in `src/lib/analisi.js`, pura e
coperta da test, e **riusa** i calcoli già esistenti (`reportSettimanale`,
`andamento`, `previsione`, `reportAtleta`): un numero mostrato in Analisi deve
coincidere con lo stesso numero mostrato nel Report. I grafici sono SVG scritti a
mano, come quelli che l'app ha già: nessuna libreria di grafici nel bundle.

**Tech Stack:** React 19, Tailwind 4 (token di `src/index.css`), date-fns, Supabase (sola lettura), Vitest.

**Spec:** questo documento (parte A per il perché, parte B per il cosa). Piano
del desktop: `docs/piano-web-desktop.md` (fase 3, punto 5 «Report»).

---

## Parte A — Cosa hanno gli altri, e cosa ne prendiamo

### A.1 Cosa offrono

| | **TrainHeroic** | **Coachway** | **CoachPlus** (DVTech, IT) |
|---|---|---|---|
| Per chi | squadre e palestre, forza | coach online «tutto in uno» | personal trainer italiani |
| **Analisi del coach** | riepilogo allenamento (volume, intensità, durata), **analisi dei carichi e massimali di lavoro**, **aderenza**, **tendenze di readiness** | punteggi del check-in (energia, allenamento, alimentazione 1–5) con **variazione sulla settimana prima**, andamento del peso, grafici delle risposte nel tempo, storico di ogni esercizio | completati / da fare, massimali, storico del peso |
| **Dati chiesti all'atleta** | **questionario di readiness** a inizio seduta, punteggi e risultati | check-in settimanale con modulo personalizzabile, misure, foto, passi, alimentazione | foto/progressi fisici, messaggi audio |
| **Cosa vede l'atleta** | classifiche di squadra, storico dei carichi | serie di giorni attivi, grafici massimo carico e massime ripetizioni, passi settimanali | programma, stato delle sedute, i propri progressi |
| **Lavoro del coach** | Coach Home con flusso attività, classifiche, schermo grande in palestra, coach assistenti | casella unica (chat + note + scheda), automazioni (sequenze di benvenuto, messaggi programmati), compiti e note per cliente, video-risposte, tag e stati dei clienti | libreria video degli esercizi (anche propri), note per cliente, tipi di cliente, collaboratori (es. nutrizionista) |
| Fuori dal nostro campo | marketplace di programmi | pianificazione pasti, pagamenti Stripe, raccolta contatti | — |

Fonti in fondo al documento. Su CoachPlus le informazioni pubbliche sono poche
(scheda App Store e note di rilascio): va provata a mano prima di copiarne qualcosa.

### A.2 Cosa ha già FLEOFIT (e gli altri no)

RPE dichiarato e **scarto dall'RPE atteso**, gradimento, note vocali, **ACWR**
(carico acuto/cronico) con verdetto per atleta, **previsione del carico prima di
assegnare**, report settimanale e report per atleta con proposte, «Dalle note»
(l'IA trasforma le note in dati), risultati delle gare HYROX, generazione con IA su
ogni categoria, calendario della squadra con trascinamento, schermo TV.
**Sul carico siamo più avanti di tutti e tre.** Ci mancano: il **punto di vista
dell'atleta prima della seduta** (readiness), il **corpo** (peso, misure, foto),
i **carichi nel tempo per esercizio**, e il **lavoro di relazione** (chat, check-in, automazioni).

### A.3 Proposte, in ordine di valore

Legenda: 🟢 si fa coi dati di oggi · 🟡 **serve una tabella nuova**, quindi un sì esplicito.

| # | Proposta | Da chi | Chi la vede | DB |
|---|---|---|---|---|
| 1 | **Pagina Analisi** desktop (parte B) | TrainHeroic, Coachway | coach | 🟢 |
| 2 | **Storico di un esercizio** in un clic: kg/metri/tempi nel tempo, dalla prescrizione e dalle note estratte | Coachway, TrainHeroic | coach (desktop), poi atleta | 🟢 |
| 3 | **Esporta** Analisi e Report in CSV e stampa/PDF | TrainHeroic | coach | 🟢 |
| 4 | **Flusso attività** in tempo reale («Marco ha chiuso Hyrox Sim · RPE 8 · nota vocale») | TrainHeroic | coach | 🟢 (Realtime su `athlete_workouts`) |
| 5 | **Copia la settimana** di un atleta su un altro o sulla settimana dopo, nel calendario team | tutti (programmi) | coach | 🟢 |
| 6 | **Readiness prima della seduta**: sonno, energia, dolori, stress da 1 a 5, in 5 secondi | TrainHeroic | atleta compila, coach analizza | 🟡 |
| 7 | **Check-in settimanale** (poche domande fisse, poi personalizzabili) con variazione sulla settimana prima | Coachway | atleta compila, coach analizza | 🟡 |
| 8 | **Peso, misure e foto dei progressi** — ⚠️ le foto NON nei bucket pubblici di oggi: serve un bucket privato | Coachway, CoachPlus | entrambi | 🟡 |
| 9 | **Massimali e carichi in %** (es. Wall Ball 9 kg, Sled 150 kg al 70% del massimo) — `personal_records` esiste già, va esteso | TrainHeroic | entrambi | 🟢 lettura / 🟡 per i massimali «di lavoro» |
| 10 | **Gruppi e tag** di atleti (es. «Gara Milano», «Principianti»), per filtrare Analisi e assegnare a un gruppo | Coachway, TrainHeroic | coach | 🟡 |
| 11 | **Note e compiti del coach** sull'atleta, e «feedback letto» condiviso fra dispositivi (BACKLOG #14-bis) | Coachway, CoachPlus | coach | 🟡 |
| 12 | **Classifica** su un workout (tempo di un For Time, round di un AMRAP), anche sullo schermo TV | TrainHeroic | entrambi | 🟡 (il punteggio va salvato da qualche parte che non sia la nota) |
| 13 | **Libreria video degli esercizi**, anche propri | CoachPlus, Coachway | atleta | 🟡 |
| 14 | **Chat** coach-atleta con audio | tutti e tre | entrambi | 🟡, ed è grande |
| 15 | Automazioni (messaggio di benvenuto, promemoria del check-in) | Coachway | — | 🟡, dopo la 7 |

**Lato atleta** (che resta sull'app mobile, per decisione del 13/10): le
proposte 2, 6, 7, 8, 9 e 12 gli danno valori nuovi — il suo storico di un
esercizio, la sua readiness, il suo peso, i suoi massimali, la sua posizione in
classifica. La serie di giorni attivi di Coachway **c'è già** (`serieGiorni`).

**Non proposti**: alimentazione, pagamenti, raccolta contatti, app col marchio di
ogni coach. Strava/Garmin restano un'idea a parte (§10): Apple Health è stato tolto
per un rifiuto di App Store (2.5.1), e un'integrazione con i dispositivi va
ripensata da capo con quella lezione.

---

## Parte B — Fase 1: la pagina «Analisi» (eseguibile, solo letture)

### B.1 Cosa c'è in pagina

Barra in alto: **periodo** (4 · 8 · 12 · 26 settimane, predefinito 8), **atleti**
(tutti, o uno), **categoria** (tutte · Hyrox · Corsa · Custom). Sotto, una griglia
a 12 colonne:

1. **Cinque numeri** con la variazione sul periodo precedente della stessa
   lunghezza: sedute completate · aderenza % · ore di allenamento · RPE medio ·
   atleti fermi. «—» dove il dato non c'è, mai zero inventato (CLAUDE.md §9).
2. **Aderenza per settimana** (linea della squadra) e accanto la **mappa
   atleti × settimane** (una cella per settimana, colore = aderenza): il colpo
   d'occhio che il telefono non può dare.
3. **Carico**: barre impilate per categoria settimana per settimana, e una
   striscia ACWR per atleta con la fascia 0,8–1,5 evidenziata (le stesse soglie
   di `ACWR_BASSO`/`ACWR_ALTO`).
4. **RPE atteso contro dichiarato** per atleta (chi sottostima e chi sovrastima).
5. **Gradimento nel tempo** e **mix di categorie/blocchi** del periodo.
6. **Tabella atleti ordinabile**: sedute, aderenza, ore, RPE medio, scarto RPE,
   ACWR, ultima seduta. Clic su una riga → la pagina si filtra su quell'atleta
   (stesso URL con `?atleta=<id>`, così si può condividere e tornare indietro).

Con un atleta scelto, i punti 2–5 diventano i suoi e compare in più la riga
«Dalle note» (sensazioni ricorrenti, da `note_estratte`) e i risultati HYROX.

### B.2 Global Constraints

- Solo desktop coach: la rotta esiste solo se `eDesktop(...)` è vero; altrimenti `/analisi` rimanda a `/report`.
- Nessuna scrittura sul database, nessuna migrazione.
- Colori: solo token e costanti di `src/lib/colori.js` (brand `#f1ba17`, running `#0094C6`, custom `#D11149`); palette invariata.
- Nessuna libreria di grafici: SVG a mano. Il chunk `index` non cresce (oggi ~619 KB con il desktop), la pagina è `lazy`.
- RPE solo con `rpeDichiarato` (mai `parseNotesAndRpe`); gradimento solo con `gradimento.js`.
- La settimana comincia di lunedì (`weekStartsOn: 1`).
- L'account `0118e43f-8791-4fd6-8032-bee028334c99` (il coach) è escluso come in `WeeklyReport`.
- Testi dell'interfaccia in italiano.

### B.3 Review Focus

1. **Più di 1500 righe nel periodo** (26 settimane × molti atleti): `WeeklyReport` legge con `.limit(1500)`. Analisi deve leggere a pagine con `.range()` finché la pagina torna piena, o dirlo a schermo — mai troncare in silenzio.
2. **Atleta in pausa** per parte del periodo: le settimane di pausa non contano come aderenza 0 (cella grigia «pausa», esclusa dalla media).
3. **Atleta arrivato a metà periodo**: le settimane prima della sua prima assegnazione sono «—», non 0%.
4. **Lettura fallita**: pagina d'errore come in `WeeklyReport`, mai grafici vuoti che sembrano una squadra ferma.
5. **Coerenza col Report**: aderenza e ACWR della settimana corrente devono coincidere al numero con quelli di `/report`.

### B.4 File

- Create: `src/lib/analisi.js` — aggregazioni pure per periodo.
- Create: `src/lib/__tests__/analisi.test.js`
- Create: `src/pages/Analisi.jsx` — lettura dati, filtri, stato URL.
- Create: `src/components/AnalisiUI.jsx` — sola presentazione.
- Create: `src/components/grafici/` — `Linea.jsx`, `BarreImpilate.jsx`, `Mappa.jsx`, `Striscia.jsx` (SVG, props semplici, nessuno stato).
- Create: `src/pages/__tests__/Analisi.test.jsx`
- Modify: `src/App.jsx` (rotta pigra), `src/components/BarraLaterale.jsx` (voce «Analisi» sotto «Report»).
- Modify: `docs/piano-web-desktop.md`, `docs/memoria/report.md`, `CLAUDE.md` §11 (riga per `analisi.js`/`Analisi.jsx`).

### Task 1: le aggregazioni (`src/lib/analisi.js`)

**Interfaces:**
- Consumes: `rpeDichiarato` (`rpe.js`), `caricoDi`, `rapportoCarico`, `scartoRpeDi`, `ACWR_BASSO`, `ACWR_ALTO` (`reportSettimanale.js`), `inPausa` (`pausa.js`), `durataWorkout` (`statistiche.js`).
- Produces:
  - `settimaneDelPeriodo(quante: number, oggi?: Date) → Array<{ inizio: Date, fine: Date, chiave: 'yyyy-MM-dd' }>` (lunedì→domenica, l'ultima è quella in corso)
  - `filtraRighe(righe, { atletaId?: string, categoria?: 'Hyrox'|'Running'|'Custom' }) → righe`
  - `numeriPeriodo(atleti, righe, settimane) → { sedute, aderenza, ore, rpeMedio, fermi }` (ogni campo `number | null`)
  - `confrontoPeriodi(corrente, precedente) → { [campo]: { valore, scarto: number|null } }`
  - `aderenzaPerSettimana(atleti, righe, settimane) → Array<{ chiave, valore: number|null }>`
  - `mappaAderenza(atleti, righe, settimane) → Array<{ atleta, celle: Array<{ chiave, valore: number|null, stato: 'ok'|'pausa'|'prima' }> }>`
  - `caricoPerCategoria(righe, settimane) → Array<{ chiave, Hyrox: number, Running: number, Custom: number }>`
  - `tabellaAnalisi(atleti, righe, settimane) → Array<{ atleta, sedute, aderenza, ore, rpeMedio, scartoRpe, acwr, ultima }>`

- [ ] **Step 1: test che falliscono** in `analisi.test.js`, con `oggi = new Date('2026-10-14')` fisso:
  - `settimaneDelPeriodo(8)` → 8 voci, la prima comincia lunedì 2026-08-24, l'ultima lunedì 2026-10-12.
  - `numeriPeriodo` su un atleta con 3 assegnate e 2 completate → `aderenza === 67`, `sedute === 2`; senza assegnate → `aderenza === null`.
  - `mappaAderenza`: atleta con prima assegnazione nella settimana 5 → celle 1–4 `stato: 'prima'`, `valore: null`.
  - atleta con `[PAUSA: …]` attivo → celle in pausa `stato: 'pausa'` ed escluse dalla media di `aderenzaPerSettimana`.
  - `tabellaAnalisi(...).acwr` della settimana in corso === `rapportoCarico(...)` calcolato come fa `reportSettimanale` sugli stessi dati (Review Focus 5).
  - `confrontoPeriodi({ sedute: 10 }, { sedute: 0 })` → `scarto: null` (niente «+∞%»).
- [ ] **Step 2:** `npx vitest run src/lib/__tests__/analisi.test.js` → FAIL (modulo mancante).
- [ ] **Step 3:** scrivere le funzioni con le firme sopra. Aderenza = completate / assegnate con data ≤ oggi, arrotondata all'intero, come in `reportSettimanale`.
- [ ] **Step 4:** stesso comando → PASS. Poi rompere apposta il calcolo della pausa e vedere il test diventare rosso (CLAUDE.md §9, ultima riga).
- [ ] **Step 5:** commit di `src/lib/analisi.js` e del test.

### Task 2: i grafici SVG (`src/components/grafici/`)

**Interfaces:**
- `Linea({ punti: Array<{ etichetta, valore: number|null }>, massimo?: number, colore: string })` — i `null` interrompono la linea.
- `BarreImpilate({ colonne: Array<{ etichetta, parti: Array<{ valore, colore }> }> })`
- `Mappa({ righe: Array<{ nome, celle: Array<{ valore: number|null, stato }> }>, colonne: string[] })` — `valore` 0–100 su scala dal grigio al brand; `pausa` a righe oblique; `prima` vuota.
- `Striscia({ voci: Array<{ nome, valore: number|null }>, fascia: [number, number] })`

- [ ] **Step 1: test** (`src/components/__tests__/grafici.test.jsx`): `Linea` con un `null` in mezzo produce **due** `<path>`; `Mappa` con 3×4 celle produce 12 `<rect>` e quelle `prima` hanno `aria-label` che contiene «nessun dato»; ogni grafico ha un `<title>` leggibile.
- [ ] **Step 2:** `npx vitest run src/components/__tests__/grafici.test.jsx` → FAIL.
- [ ] **Step 3:** scrivere i quattro componenti. Prima di farlo, caricare la skill `dataviz` per scala colori e assi.
- [ ] **Step 4:** → PASS, verificato rompendo il caso `null`.
- [ ] **Step 5:** commit.

### Task 3: la pagina (`Analisi.jsx`, `AnalisiUI.jsx`, rotta e barra laterale)

**Interfaces:**
- Consumes: tutto il Task 1 e il Task 2; `eDesktop`/`useDesktop` (`src/useDesktop.js`); `useAuth` (`App.jsx`).
- Produces: rotta `/analisi?periodo=8&atleta=<id>&categoria=Hyrox`.

- [ ] **Step 1: test** (`src/pages/__tests__/Analisi.test.jsx`, con `montaPagina` e `fintoSupabase`):
  - con 1600 righe finte la pagina chiama `.range()` due volte e la tabella conta tutte le sedute (Review Focus 1);
  - con errore di lettura compare il testo d'errore e nessun grafico;
  - clic su una riga della tabella → l'URL prende `?atleta=<id>` e il titolo diventa il nome dell'atleta;
  - fuori dal desktop (`eDesktop` falso) `/analisi` porta a `/report`.
- [ ] **Step 2:** `npx vitest run src/pages/__tests__/Analisi.test.jsx` → FAIL.
- [ ] **Step 3:** `Analisi.jsx` legge `athletes` e `athlete_workouts` (stessi campi di `WeeklyReport`, finestra = periodo × 2 per il confronto + 28 giorni di cronico) a pagine da 1000 con `.range()`; filtri nello stato dell'URL (`useSearchParams`). `AnalisiUI.jsx` impagina con `.cascata`. Rotta `lazy` in `App.jsx`, voce «Analisi» (icona `ChartLine`) in `VOCI` di `BarraLaterale.jsx`.
- [ ] **Step 4:** → PASS; poi `npm test` e `npx eslint src/lib/analisi.js src/pages/Analisi.jsx src/components/AnalisiUI.jsx src/components/grafici` senza problemi nuovi.
- [ ] **Step 5:** `npm run build`: `index-*.js` non cresce oltre il rumore (± 2 KB), compare un chunk `Analisi-*.js` a parte.
- [ ] **Step 6:** verifica nel browser con `npm run demo` a 1440 px (screenshot) e a 390 px (nessuna differenza dalla versione di prima).
- [ ] **Step 7:** aggiornare `docs/piano-web-desktop.md`, `docs/memoria/report.md`, la tabella del §11 di `CLAUDE.md`; commit coi file per nome.

---

## Parte C — Le fasi successive (piani a parte, dopo il sì)

> ✅ **Decisioni del committente, 13/10/2026**: sì alle fasi 1, 2 e 3 (solo la
> parte pre-seduta). **Esclusi per ora**: massimali (#9), peso/misure/foto (#8),
> video degli esercizi (#13). **Chat 1:1 + messaggio a tutti** (#14): voluta, ma
> non adesso. Il questionario pre-seduta si chiama **«Come stai oggi»** (in Analisi:
> colonna «Come sta»). **La migrazione NON è ancora autorizzata**: la fase 3 aspetta
> un sì esplicito. Analisi va **accanto** al Report, periodo predefinito 8 settimane.

| Fase | Contenuto | DB | Stato |
|---|---|---|---|
| 1 | Pagina Analisi (parte B) | 🟢 | ✅ approvata |
| 2 | Storico esercizio (#2) + esporta CSV/stampa (#3) + flusso attività (#4) + copia settimana (#5) | 🟢 | ✅ approvata, piano dopo la fase 1 |
| 3 | **«Come stai oggi»** (#6): una tabella additiva, foglio di 5 secondi sull'app atleta, nuove colonne in Analisi. Il check-in settimanale (#7) resta fuori per ora | 🟡 migrazione **non ancora autorizzata** | ⏸ funzione approvata, aspetta il sì al DB |
| — | Chat coach-atleta + messaggio a tutti (#14), poi automazioni (#15) | 🟡, il lavoro più grande | ⏸ in attesa |
| — | Gruppi/tag (#10), note e compiti (#11), classifiche (#12) | 🟡 | da discutere |
| — | ~~Peso, misure, foto (#8) · massimali (#9) · video (#13)~~ | — | ❌ esclusi per ora |

⚠️ Ogni fase 🟡 porta una novità anche all'app sugli Store (lato atleta): va
annunciata in `DEVLOG.md` e richiede una nuova build iOS e Android.

## Da decidere quando ne riparliamo

1. **Analisi è una pagina nuova o sostituisce `/report` sul desktop?** Proposta: nuova, accanto: il Report dice «cosa fare questa settimana», Analisi «come sta andando».
2. Periodo predefinito: 8 settimane va bene?
3. Quali delle 🟡 valgono uno sblocco dello schema? Proposta: la readiness (#6) per prima, perché costa poco all'atleta e dà ad Analisi il dato che oggi manca di più.
4. Su CoachPlus le informazioni pubbliche sono scarse: c'è qualcosa che hai visto usare e che qui non compare?

## Fonti

- TrainHeroic — [Analytics, Reporting and Activity (help center)](https://support.trainheroic.com/hc/en-us/sections/17996111205645-Analytics-Reporting-and-Activity) · [Analytics: Supercharge Your Coaching Senses](https://www.trainheroic.com/blog/analytics-supercharge-your-coaching-senses) · [Coach Home](https://www.trainheroic.com/?p=6153) · [Prezzi e funzioni](https://trainheroic.com/?p=153)
- Coachway — [coachway.io](https://coachway.io/) · [HYROX coaching software](https://coachway.io/articles/hyrox-coaching-software/)
- CoachPlus — [CoachPlusPT su App Store (IT)](https://apps.apple.com/it/app/coachpluspt/id1608347256) · [CoachPlus su App Store](https://apps.apple.com/us/app/-/id1576158679) · [scheda mwm.ai](https://mwm.ai/apps/coachplus/1576158679)
- Contesto di mercato — [FitBudd: client progress tracking](https://www.fitbudd.com/insights/best-client-progress-tracking-software-for-coaches)
