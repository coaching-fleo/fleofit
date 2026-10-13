# Desktop fase 2: storico esercizio, esporta, ultime sedute, copia settimana — Piano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** le quattro proposte 🟢 approvate il 13/10/2026 (#2, #3, #4, #5 del piano
`2026-10-13-desktop-analisi-e-confronto.md`), tutte senza toccare lo schema.

**Architecture:** come per la fase 1: logica pura in `src/lib/` con test, componenti
desktop pigri, nessuna libreria nuova. Le scritture (solo il Task 4) sono `insert` su
`athlete_workouts`, la stessa operazione che il calendario team fa già trascinando.

**Tech Stack:** React 19, Tailwind 4, date-fns, Supabase, Vitest.

**Spec:** `docs/superpowers/plans/2026-10-13-desktop-analisi-e-confronto.md`, parte A.3
righe #2–#5 e le decisioni del committente nella parte C.

## Global Constraints

- Solo desktop coach (`eDesktop`): sotto i 1024 px e nelle app native non cambia niente.
- Nessuna migrazione, nessuna tabella o colonna nuova, nessuna modifica a Realtime.
- Palette invariata; grafici con i componenti di `src/components/grafici/`.
- RPE con `rpeDichiarato`, gradimento con `gradimentoDi`, settimana da lunedì.
- Mai `alert()`/`confirm()`: `CustomConfirm` (CLAUDE.md §8).
- Il chunk `index` non cresce.

## Review Focus

1. **Copia settimana su un giorno già occupato dallo stesso workout**: non si duplica (salta e lo dice).
2. **Copia di una settimana con sedute già fatte**: le copie nascono `pending`, mai `completed`.
3. **Esercizio con kg scritto in modi diversi** («9», «9kg», «9 kg», «-»): stesso numero o nessun punto, mai NaN nel grafico.
4. **CSV aperto in Excel italiano**: separatore `;`, virgola decimale, BOM UTF-8, nomi con `;` o `"` quotati.
5. **Ultime sedute senza ora**: `athlete_workouts` non ha un orario, quindi l'elenco è per giorno e non promette un «tempo reale» che non c'è.

## Ruling di progetto (prima di cominciare)

- **#4 «flusso attività in tempo reale» diventa «Ultime sedute chiuse»**: `athlete_workouts`
  non ha `created_at` né un orario di completamento, e mettere la tabella in Realtime è
  una modifica di configurazione del database condiviso. Si mostra l'elenco per giorno,
  aggiornato quando la finestra torna in primo piano.

---

### Task 1: storico di un esercizio (Analisi, vista atleta)

**Files:**
- Create: `src/lib/storicoEsercizio.js`, `src/lib/__tests__/storicoEsercizio.test.js`
- Create: `src/components/StoricoEsercizio.jsx`
- Modify: `src/pages/Analisi.jsx` (riquadro in fondo, solo con un atleta scelto)

**Interfaces:**
- Produces:
  - `eserciziDi(righe) → Array<{ nome, sedute }>` — gli esercizi delle sedute completate, più frequenti prima (riusa `movimentiDi` di `reportAtleta.js`).
  - `storicoEsercizio(righe, nome, estratti = []) → Array<{ data, workoutId, kg: number|null, metri: number|null, reps: number|null, risultati: Array<{ misura, valore, unita, citazione }> }>` in ordine di data; `estratti` sono righe di `note_estratte` (da `leggiEstratti`), di cui si prendono i `risultati` con `esercizio === nome` della stessa `athlete_workout_id`.

- [ ] **Step 1: test** `storicoEsercizio.test.js`: kg «9», «9kg», «9 kg» → `9`; «-» → `null`; due occorrenze nella stessa seduta (12 e 16 kg) → `16`; una seduta Running non compare; un risultato estratto «Wall Balls · tempo 6:40» finisce nella seduta giusta; `eserciziDi` ordina per sedute decrescenti.
- [ ] **Step 2:** `npx vitest run src/lib/__tests__/storicoEsercizio.test.js` → FAIL (modulo mancante).
- [ ] **Step 3:** implementare con `getNormalizedBlocks` (`timerSequence.js`) per i blocchi, i parser numerici già in `reportAtleta.js` se esportabili, altrimenti locali.
- [ ] **Step 4:** → PASS; mutazione sul massimo per seduta vista fallire.
- [ ] **Step 5:** `StoricoEsercizio.jsx`: un menu a tendina degli esercizi, una `Linea` dei kg (scala `massimo` = kg più alto × 1,2, `unita="kg"`) e sotto una tabella data · prescritto · dichiarato nelle note. In `Analisi.jsx` gli estratti si leggono con `leggiEstratti(atletaId)` solo quando c'è un atleta scelto; se la lettura fallisce la colonna «dichiarato» resta «—» (le note sono un di più). Test in `Analisi.test.jsx`: con un atleta scelto compare il riquadro «Storico di un esercizio»; senza, no.
- [ ] **Step 6:** commit.

### Task 2: esporta CSV e stampa (Analisi)

**Files:**
- Create: `src/lib/esportaCsv.js`, `src/lib/__tests__/esportaCsv.test.js`
- Modify: `src/components/AnalisiUI.jsx` (due bottoni nella testata), `src/pages/Analisi.jsx`, `src/index.css` (regole `@media print`)

**Interfaces:**
- Produces: `csvDa(colonne: Array<{ titolo, valore: (riga) => string|number|null }>, righe) → string` (BOM + righe separate da `\r\n`, campi da `;`) e `nomeFileAnalisi(periodo, atleta?, oggi) → 'fleofit-analisi-8sett-2026-10-14.csv'` (con il nome dell'atleta in minuscolo se scelto).

- [ ] **Step 1: test**: `1.5` → `1,5`; `null` → campo vuoto; `Rossi; Anna` → `"Rossi; Anna"`; `"` raddoppiate; la stringa comincia con `﻿`; nome del file come sopra.
- [ ] **Step 2:** → FAIL. **Step 3:** implementare. **Step 4:** → PASS.
- [ ] **Step 5:** «Esporta CSV» scarica la tabella atleti (stesse colonne della tabella, valori grezzi, non «3 giorni fa» ma la data) con `Blob` + `<a download>`; «Stampa» chiama `window.print()`. In `index.css`, `@media print`: barra laterale e bottoni nascosti (`print:hidden`), `print-color-adjust: exact` sul body perché il tema è solo scuro. Test in `Analisi.test.jsx`: il clic su «Esporta CSV» chiama `URL.createObjectURL` con un Blob il cui testo contiene la riga dell'atleta.
- [ ] **Step 6:** commit.

### Task 3: ultime sedute chiuse (Home coach desktop)

**Files:**
- Create: `src/lib/ultimeSedute.js`, `src/lib/__tests__/ultimeSedute.test.js`
- Modify: `src/components/HomeCoachDesktop.jsx` (sezione nuova sotto «Oggi»), `src/pages/Home.jsx` (passa le righe già caricate; ricarica al ritorno della finestra in primo piano, solo desktop)

**Interfaces:**
- Produces: `ultimeSedute(assegnazioni, atleti, { giorni = 7, limite = 20, oggi }) → Array<{ id, atletaId, nome, foto, titolo, workoutId, data, giorno: 'oggi'|'ieri'|'lun 12', rpe: number|null, gradimento, haNota, haVocale }>` — solo `completed`, ultime `giorni`, più recenti prima, coach escluso.

- [ ] **Step 1: test**: ordine per data decrescente; una pending non compare; una di 8 giorni fa non compare; `rpe` null senza marcatore (mai 5); il coach (`COACHING_ID`) escluso; `limite` rispettato.
- [ ] **Step 2–4:** FAIL → implementare → PASS.
- [ ] **Step 5:** la sezione «Ultime sedute chiuse» elenca le righe raggruppate per giorno; clic → `/workout/<id>?athlete_id=<uid>`. Prima di scriverla leggere `docs/memoria/home-coach.md` e il pezzo di `Home.jsx` che prepara `feedback` (le righe sono già lì: niente lettura nuova se la finestra caricata copre 7 giorni). Test in `HomeCoach.test.jsx` (desktop simulato con `matchMedia`): compare la sezione con il nome dell'atleta.
- [ ] **Step 6:** commit.

### Task 4: copia la settimana (calendario team)

**Files:**
- Modify: `src/lib/calendarioTeam.js` (+ test in `src/lib/__tests__/calendarioTeam.test.js`), `src/pages/CalendarioTeam.jsx`

**Interfaces:**
- Produces: `copiaSettimana(assegnazioni, { daAtleta, aAtleta, giorni: string[], scartoGiorni: 0|7 }) → { nuove: Array<{ athlete_id, workout_id, completed_date, status: 'pending' }>, saltate: number }` — le sedute di `daAtleta` nei `giorni` (la settimana mostrata), spostate di `scartoGiorni`, assegnate ad `aAtleta`; saltate quelle che `aAtleta` ha già con lo stesso `workout_id` alla stessa data.

- [ ] **Step 1: test**: settimana dopo (`scartoGiorni: 7`) sposta le date di 7 giorni; a un altro atleta (`0`) tiene le date; una seduta completata nasce `pending`; un doppione esistente → `saltate: 1`; una gara (`category: 'Event'`) si copia come le altre.
- [ ] **Step 2–4:** FAIL → implementare → PASS.
- [ ] **Step 5:** in `CalendarioTeam.jsx`, accanto al nome di ogni atleta un menu «Copia settimana»: «nella settimana dopo» o «a…» (elenco atleti). Conferma con `CustomConfirm` («Copio 4 allenamenti a Bruno, 12–18 ott?»), poi un `insert` unico, la push `immediate` per ogni riga nuova (come `assegna`) e l'avviso «4 copiati, 1 già presente». Leggere prima `docs/memoria/calendario.md`.
- [ ] **Step 6:** commit.

### Chiusura

- [ ] `npm test`, `npx eslint` sui file toccati, `npm run build` (chunk `index` invariato), prova nel browser con `npm run demo` a 1440 e 375 px.
- [ ] Aggiornare `docs/piano-web-desktop.md`, `docs/memoria/report.md` (storico, CSV), `docs/memoria/home-coach.md` (ultime sedute), `docs/memoria/calendario.md` (copia settimana), e la tabella del §11 di `CLAUDE.md` per i file nuovi.
