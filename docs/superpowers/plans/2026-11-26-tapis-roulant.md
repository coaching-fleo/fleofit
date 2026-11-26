# Corsa · versione «Tapis roulant» — piano di lavoro

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** nella scheda di una Corsa l'atleta passa da `Outdoor` a `Tapis roulant` e vede i ritmi in km/h; un'attività Garmin `TREADMILL_RUNNING` abbinata mostra «Su tapis roulant».

**Architecture:** una funzione pura (`src/lib/tapisRoulant.js`) trasforma una copia degli `steps` con i ritmi convertiti; `WorkoutDetail` tiene la scelta nello stato e passa a `RunningList` gli steps originali o quelli convertiti. Il segno Garmin legge `tipo`, già selezionato da `leggiAttivitaGarmin`.

**Tech Stack:** React 19, Vitest + Testing Library, `fintoSupabase`.

**Spec:** `docs/superpowers/specs/2026-11-26-tapis-roulant-design.md`

## Global Constraints

- Nessuna migrazione, nessuna Edge Function toccata, formato di `workouts.sections` invariato (§0-bis).
- Etichette esatte: `Outdoor` · `Tapis roulant` · `Su tapis roulant`.
- Conversione: `km/h = 60 / minuti al km`, arrotondata a 0,1, **virgola** decimale, unità ` km/h`; intervallo dal più lento al più veloce, separato da ` – ` (lineetta con spazi).
- Si convertono solo ritmi `m:ss /km` o `m:ss - m:ss /km`; tutto il resto (`Libero`, `Camminata`, `Da fermo`, `Z1`–`Z5`, `All out`, `Gara`, testi misti) resta com'è.
- L'interruttore parte da `Outdoor` a ogni apertura; nessun localStorage.
- Ripetute lette **solo** con `partiRipetuta` (CLAUDE.md §5).
- Ogni test nuovo si vede fallire rompendo apposta il codice (CLAUDE.md §9).

## Note dalla lettura del codice (cambiano il design, già decise)

- **Il timer guidato non esiste per la Corsa** (`haTimerGuidato` in `timerSequence.js`): il punto 4 della spec non ha niente da fare.
- **La TV legge il workout dal database** (`TVDashboard.jsx`, select su `workouts`): seguire la scelta vorrebbe dire cambiare il protocollo della TV → resta Outdoor, come previsto dalla spec.
- **PDF e story** restano la versione del coach (Outdoor): la spec parla della scheda.
- **L'interruttore compare solo se almeno un ritmo si converte** (mia scelta: con sole zone non cambierebbe niente a schermo).

## Review Focus

1. Ritmi scritti con la lineetta lunga o senza spazi (`5:00–5:30 /km`, `5:00-5:30 /km`): vanno convertiti come quello standard.
2. Intervallo scritto al contrario (`5:30 - 5:00 /km`): stessa uscita, `10,9 – 12,0 km/h`.
3. Ripetuta nel formato vecchio (`runPace`/`recPace`, senza `parti`): converte entrambe le parti.
4. `0:00 /km` o un ritmo senza minuti: nessuna velocità inventata, resta il testo.
5. Coach che apre la scheda: vede lo stesso interruttore (non è solo dell'atleta) e lo stesso «Su tapis roulant».

---

### Task 1: la conversione

**Files:**
- Create: `src/lib/tapisRoulant.js`
- Test: `src/lib/__tests__/tapisRoulant.test.js`

**Interfaces:**
- Produces:
  - `velocitaDaPasso(passo: string): string | null`
  - `stepsTapis(steps: object[]): object[]` — copia; `step.pace` convertito dove si può; per `type === 'repeat'` la copia ha `parti: partiRipetuta(step).map(p => ({ ...p, pace: convertito o p.pace }))`; l'originale non cambia.
  - `haRitmiConvertibili(steps: object[]): boolean`

- [ ] **Step 1: test**

```js
describe('velocitaDaPasso', () => {
  it('un ritmo', () => {
    expect(velocitaDaPasso('5:00 /km')).toBe('12,0 km/h')
    expect(velocitaDaPasso('4:10 /km')).toBe('14,4 km/h')
    expect(velocitaDaPasso('6:40 /km')).toBe('9,0 km/h')
  })
  it('un intervallo, dal più lento al più veloce, in ogni verso e scrittura', () => {
    for (const p of ['5:00 - 5:30 /km', '5:30 - 5:00 /km', '5:00–5:30 /km', '5:00-5:30 /km'])
      expect(velocitaDaPasso(p)).toBe('10,9 – 12,0 km/h')
  })
  it('non inventa niente', () => {
    for (const p of ['Libero', 'Camminata', 'Da fermo', 'Z3', 'All out', 'Gara', '', null, undefined, '0:00 /km', '5:00 - Z3'])
      expect(velocitaDaPasso(p)).toBeNull()
  })
})
describe('stepsTapis', () => {
  // un run '5:00 /km' → pace '12,0 km/h'; un warmup 'Z2' → 'Z2'; duration e notes intatti
  // ripetuta vecchia { type:'repeat', rounds:'6', runDuration:'400m', runPace:'4:00 /km', recDuration:'1 min', recPace:'Libero' }
  //   → parti[0].pace '15,0 km/h', parti[1].pace 'Libero', parti.length 2
  // ripetuta con parti (3 parti) → tutte e tre convertite dove si può
  // l'array e gli step originali non sono mutati (deep equal con una copia fatta prima)
})
describe('haRitmiConvertibili', () => {
  // true con un solo '5:00 /km' anche dentro una parte di ripetuta; false con sole zone o con []
})
```

- [ ] **Step 2:** `npx vitest run src/lib/__tests__/tapisRoulant.test.js` → FAIL (modulo mancante).
- [ ] **Step 3:** implementare. Riconoscere con un'unica regex ancorata, `/^\s*(\d{1,2}):([0-5]\d)\s*(?:[-–]\s*(\d{1,2}):([0-5]\d)\s*)?\/km\s*$/`; secondi ≤ 0 → `null`; formattare con `toFixed(1).replace('.', ',')`.
- [ ] **Step 4:** stesso comando → PASS; poi rompere apposta (es. togliere l'ordinamento) e vedere fallire il test giusto, poi ripristinare.
- [ ] **Step 5: commit**

```bash
git add src/lib/tapisRoulant.js src/lib/__tests__/tapisRoulant.test.js
git commit -m "Corsa: conversione dei ritmi in km/h per il tapis roulant"
```

### Task 2: l'interruttore nella scheda

**Files:**
- Modify: `src/pages/WorkoutDetail.jsx` (il ramo `isRunning ?` che monta `<RunningList steps=…>`, nel blocco del contenuto della scheda)
- Create: `src/components/InterruttoreTapis.jsx`
- Test: `src/pages/__tests__/WorkoutDetailTapis.test.jsx` (impianto copiato da `WorkoutDetailGarmin.test.jsx`)

**Interfaces:**
- Consumes: `stepsTapis`, `haRitmiConvertibili` (Task 1).
- Produces: `InterruttoreTapis({ tapis: boolean, onCambia: (tapis: boolean) => void })` — toggle segmentato del §6 (`bg-[#111] p-1.5 rounded-2xl border border-[#333]`, indicatore che trasla 300ms, colore attivo `running`), due `button` con testo `Outdoor` e `Tapis roulant`, `aria-pressed` sul selezionato; `battito()` di `aptica.js` al cambio.

- [ ] **Step 1: test di pagina**

```js
// sections: { category:'Running', steps:[{ id:1, type:'run', duration:'5 km', pace:'5:00 - 5:30 /km' }, { id:2, type:'cooldown', duration:'10 min', pace:'Z1' }] }
it('parte da Outdoor con i ritmi del coach', …)        // vede '@5:00 - 5:30 /km', Outdoor aria-pressed=true
it('Tapis roulant mostra i km/h, le zone restano', …)   // click 'Tapis roulant' → '@10,9 – 12,0 km/h' e '@Z1'; il ritmo in /km non c'è più
it('si torna a Outdoor', …)
it('con sole zone l\'interruttore non c\'è', …)        // steps con pace 'Z2' → queryByText('Tapis roulant') null
it('lo vede anche il coach', …)                        // apri({ ruolo:'admin' }) → interruttore presente
it('Hyrox non ha l\'interruttore', …)
```

- [ ] **Step 2:** `npx vitest run src/pages/__tests__/WorkoutDetailTapis.test.jsx` → FAIL.
- [ ] **Step 3:** in `WorkoutDetail` aggiungere `const [tapis, setTapis] = useState(false)`; nel ramo `isRunning` calcolare gli steps come oggi (`s?.steps || s?.main?.steps || []`), mostrare `<InterruttoreTapis>` sopra la card solo se `haRitmiConvertibili(steps)`, e passare `tapis ? stepsTapis(steps) : steps` a `RunningList`. PDF, story, testo condiviso e TV non si toccano.
- [ ] **Step 4:** test → PASS; rompere apposta (passare sempre `steps`) e vedere fallire; `npx vitest run src/pages/__tests__/WorkoutDetail*` tutto verde; `npm run build` e controllare che il chunk `WorkoutDetail` non salga oltre ~1 KB (CLAUDE.md §2).
- [ ] **Step 5: commit**

```bash
git add src/components/InterruttoreTapis.jsx src/pages/WorkoutDetail.jsx src/pages/__tests__/WorkoutDetailTapis.test.jsx
git commit -m "Scheda Corsa: interruttore Outdoor | Tapis roulant"
```

### Task 3: «Su tapis roulant» dal Garmin, e la memoria

**Files:**
- Modify: `src/lib/attivitaGarmin.js` (accanto a `fonteGarmin`)
- Modify: `src/components/CardDaGarmin.jsx`
- Modify: `docs/memoria/scheda-workout.md`, `docs/memoria/garmin.md`
- Test: `src/lib/__tests__/attivitaGarminApp.test.js`, `src/pages/__tests__/WorkoutDetailGarmin.test.jsx`

**Interfaces:**
- Produces: `suTapisRoulant(attivita): boolean` — `attivita?.tipo === 'TREADMILL_RUNNING'`.

- [ ] **Step 1: test**

```js
// attivitaGarminApp.test.js
expect(suTapisRoulant({ tipo: 'TREADMILL_RUNNING' })).toBe(true)
expect(suTapisRoulant({ tipo: 'RUNNING' })).toBe(false)
expect(suTapisRoulant(null)).toBe(false)
// WorkoutDetailGarmin.test.jsx
it('un\'attività sul tapis roulant lo dice, all\'atleta e al coach', …)  // ATTIVITA con tipo 'TREADMILL_RUNNING' → getByText('Su tapis roulant'), sia ruolo athlete sia admin
it('una corsa all\'aperto no', …)                                         // tipo 'RUNNING' → queryByText('Su tapis roulant') null
```

- [ ] **Step 2:** i due file di test → FAIL.
- [ ] **Step 3:** in `CardDaGarmin`, se `suTapisRoulant(attivita)`, una pillola `Su tapis roulant` (stile badge del §6, grigio come la card) prima di `<RigheGarmin>`.
- [ ] **Step 4:** test → PASS; rompere apposta (`'RUNNING'` al posto di `'TREADMILL_RUNNING'`) e vedere fallire; poi `npm test` intero verde e `npx eslint src/lib/tapisRoulant.js src/components/InterruttoreTapis.jsx src/components/CardDaGarmin.jsx` pulito.
- [ ] **Step 5:** memoria: in `scheda-workout.md` una sezione «Tapis roulant (26/11/2026)» con le quattro note dalla lettura del codice qui sopra; in `garmin.md` una riga: `TREADMILL_RUNNING` → «Su tapis roulant» nella card, nessun cambio lato orologio. Aggiungere i nuovi file alla riga di `scheda-workout.md` nel §11 di `CLAUDE.md`.
- [ ] **Step 6: commit**

```bash
git add src/lib/attivitaGarmin.js src/components/CardDaGarmin.jsx src/lib/__tests__/attivitaGarminApp.test.js src/pages/__tests__/WorkoutDetailGarmin.test.jsx docs/memoria/scheda-workout.md docs/memoria/garmin.md CLAUDE.md docs/superpowers/specs/2026-11-26-tapis-roulant-design.md docs/superpowers/plans/2026-11-26-tapis-roulant.md
git commit -m "Garmin: «Su tapis roulant» sulle corse fatte al chiuso"
```
