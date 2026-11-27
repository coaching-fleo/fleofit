# PUSHFIT AI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Costruire il motore «coach-led + IA» di PUSHFIT: questionario → scelta del programma del team → adattamento IA → validatore → adattamento continuo, e misurare su un banco di prova quali modelli usare e quanto costano.

**Architecture:** La logica (questionario, scelta del programma, regole del metodo, validatore, differenze, riassunto dei feedback, costi) è **pura** in `src/lib/pianoIA/` e coperta da test; l'IA riceve richieste costruite da `supabase/functions/_shared/pianoIA/richieste.ts` (senza import, come `_shared/groq.ts`) e restituisce **differenze** in JSON con schema, mai sedute intere. Il codice sceglie, l'IA adatta, il codice verifica; se la verifica fallisce due volte resta la seduta del team.

**Tech Stack:** React 19 + Vite 8, vitest 4, Supabase Edge Function (Deno) dalla fase 2, `@anthropic-ai/sdk` (Claude Sonnet 5.5 / Haiku 5.5 / Opus 5.5), Groq `openai/gpt-oss-120b` come riserva.

**Spec:** `docs/superpowers/specs/2026-11-27-pushfit-ai-design.md` (si legge insieme a questo piano; dove tace vale `2026-10-26-programmazione-ia-design.md`).

## Come è diviso questo piano

La spec ha sei fasi indipendenti (§13). Qui:
- **Tabella di marcia** di tutte le fasi, con il loro sblocco;
- **Fase 0 in dettaglio** (Task 1–10): si costruisce **subito**, senza database e senza migrazioni;
- le fasi 1–5 avranno ciascuna **un piano suo**, scritto quando si sblocca, perché dipendono dai numeri della fase 0 e da sì espliciti sulle migrazioni.

| Fase | Cosa | Sblocco | Piano |
|---|---|---|---|
| 0 | Logica pura + banco di prova + gara fra modelli | nessuno (solo le chiavi API per le prove, a pagamento) | **questo documento** |
| 0-bis | Progetto Supabase di **staging** con schema copiato e dati inventati | **sì del committente** (secondo progetto) | passi manuali, Task 11 |
| 1 | Strumenti del team: Libreria IA, Programmi base, Regole; il team scrive 6–8 programmi | sì su `libreria_ia`, `programmi_base`, `regole_metodo` (staging) | `…-pushfit-ai-fase1.md` |
| 2 | Iscrizione aperta, questionario, consenso salute, Edge Function `piano-ia` (adattamento), «Il tuo piano» | sì su `questionario_utente`, `salute_utente`, `piani`, `piano_sedute`, `uso_ia`; informativa aggiornata | `…-fase2.md` |
| 3 | Analisi dopo la seduta, tocco sui carichi, test ogni 4 settimane, revisione settimanale in batch, allarmi, cron | sì su `analisi_sedute`, `test_utente` | `…-fase3.md` |
| 4 | Abbonamento (RevenueCat), paywall, prova gratuita, «Qualità», tetti | sì su `abbonamenti`; account RevenueCat e prodotti negli Store | `…-fase4.md` |
| 5 | Beta chiusa (TestFlight / test interno Play), rilascio con l'interruttore `piano_ia` | decisione del committente | checklist in `docs/memoria/app-store.md` |

## Global Constraints

- Si lavora **solo** sul branch `pushfit-ai`. Niente push su `app` né `app:main`; i commit si fanno aggiungendo i file per nome.
- **Nessuna migrazione e nessuna scrittura sul database di produzione** (`riyqtcssllupakjtoehj`) in questa fase. Letture permesse, ma non servono.
- Lingua di interfaccia, commenti e messaggi: **italiano**. Nomi misti come nel resto di `src/lib/`.
- Test in `src/lib/pianoIA/__tests__/*.test.js` (il glob di `vitest.config.js` è `src/**/__tests__/**`).
- `src/lib/pianoIA/` non importa React, Capacitor, Supabase, `jspdf`, `html-to-image`: è logica pura.
- `supabase/functions/_shared/pianoIA/richieste.ts` **senza import** (si prova con vitest e si usa da Deno).
- Modelli, ID esatti: `claude-sonnet-5-5`, `claude-haiku-5-5`, `claude-opus-5-5`; Groq `openai/gpt-oss-120b`.
- Prezzi in $ per milione di token (spec §8.1): Haiku 5.5 0,10 / 0,50; Sonnet 5.5 2 / 10, cache 0,10; Opus 5.5 4 / 20, cache 0,20; Batch −50%.
- Su Sonnet 5.5 e Opus 5.5: niente `thinking: disabled`, niente `tool_choice` forzato → **`output_config.format`** con schema JSON; `fallbacks: "default"` con beta `server-side-fallback-2026-07-01` sulle chiamate **non** batch (il Batch lo rifiuta).
- L'RPE si legge **solo** con `rpeDichiarato` (`src/lib/rpe.js`); la durata **solo** con `durataBlocco` / `rpeAtteso` di `src/lib/stimaWorkout.js`; i nomi con `trovaEsercizio`.
- Nessun numero inventato: un dato mancante è `null`, mai `0`.
- Il banco di prova usa **solo casi inventati**; le chiavi API solo da variabili d'ambiente, mai in un file.
- Settimana da lunedì (`giorni`: 1 = lunedì … 7 = domenica).

## Review Focus

1. **Risposte incomplete** («non so» il 5 km, nessun tempo Hyrox, peso vuoto): il profilo esce con `null` e il livello prudente, nessun `NaN` → Task 1.
2. **Gara troppo vicina o già passata**: nessun programma «compresso» oltre 3 settimane; gara passata = trattata come «senza gara» → Task 2.
3. **Differenze dell'IA che puntano a blocchi o esercizi inesistenti**, o a un esercizio non del picker: ignorate o rifiutate, mai un crash → Task 5.
4. **Attrezzatura «casa» con un programma che chiede la slitta**: la seduta non passa la verifica senza sostituzione; il ripiego resta valido solo se la sostituzione c'è → Task 4 e 5.
5. **Utente senza sedute completate**: riassunto con `null` (non `0`), nessun allarme falso → Task 6.

---

## Task 1: Questionario, sicurezza e profilo per l'IA

**Files:**
- Create: `src/lib/pianoIA/questionario.js`
- Test: `src/lib/pianoIA/__tests__/questionario.test.js`

**Interfaces:**
- Produces:
  - `Risposte` (oggetto): `{ obiettivo: 'prima_gara'|'migliorare'|'senza_gara', gara: {data:'yyyy-MM-dd', nome:string}|null, categoria: {divisione:'open'|'pro', formato:'singolo'|'doppio'|'staffetta', sesso:'uomo'|'donna'}, tempoObiettivoMin: number|null, ultimoTempoHyroxMin: number|null, tempo5kSec: number|null, anniAllenamento: number|null, stazioniDeboli: string[], sedute: number, giorni: number[], minutiSeduta: number, attrezzatura: {luogo:'hyrox'|'palestra'|'casa', skierg:boolean, rower:boolean, slitta:boolean, wallBall:boolean}, eta: number|null, pesoKg: number|null, sicurezza: {petto:boolean, svenimenti:boolean, cuore:boolean, gravidanza:boolean, intervento:boolean}, esclusioni: string[], salute: string|null }`
  - `DOMANDE_SICUREZZA` — array di `{ id, testo }` con id `petto|svenimenti|cuore|gravidanza|intervento`
  - `ETA_MINIMA = 18`
  - `validaRisposte(r: Risposte) -> { ok: boolean, errori: string[] }`
  - `controlloSicurezza(r: Risposte) -> { stop: boolean, motivo: 'eta'|'sicurezza'|null }`
  - `livelloStimato(r: Risposte) -> 'principiante'|'intermedio'|'avanzato'`
  - `settimaneAllaGara(r: Risposte, oggi: Date) -> number|null`
  - `profiloPerIA(r: Risposte, oggi: Date) -> { obiettivo, settimaneAllaGara, categoria, livello, fasciaEta, sedute, giorni, minutiSeduta, attrezzatura, stazioniDeboli, tempo5kSec, ultimoTempoHyroxMin, tempoObiettivoMin, esclusioni }` — **niente** nome, email, id, data di nascita, testo salute grezzo

- [ ] **Step 1: Scrivere i test che falliscono**

```js
describe('questionario', () => {
  it('validaRisposte rifiuta sedute fuori 2–6, giorni meno delle sedute, minuti < 20', () => {
    expect(validaRisposte({ ...base, sedute: 7 }).errori).toContain('sedute')
    expect(validaRisposte({ ...base, sedute: 4, giorni: [1, 3, 5] }).errori).toContain('giorni')
    expect(validaRisposte({ ...base, minutiSeduta: 15 }).errori).toContain('minutiSeduta')
    expect(validaRisposte(base).ok).toBe(true)
  })
  it('obiettivo diverso da senza_gara richiede la gara', () => {
    expect(validaRisposte({ ...base, obiettivo: 'prima_gara', gara: null }).errori).toContain('gara')
  })
  it('controlloSicurezza ferma sotto 18 anni e con un sì alle domande di sicurezza', () => {
    expect(controlloSicurezza({ ...base, eta: 17 })).toEqual({ stop: true, motivo: 'eta' })
    expect(controlloSicurezza({ ...base, sicurezza: { ...noSicurezza, cuore: true } })).toEqual({ stop: true, motivo: 'sicurezza' })
    expect(controlloSicurezza(base)).toEqual({ stop: false, motivo: null })
  })
  it('livelloStimato', () => {
    expect(livelloStimato({ ...base, anniAllenamento: 0.5, ultimoTempoHyroxMin: null })).toBe('principiante')
    expect(livelloStimato({ ...base, anniAllenamento: 1, ultimoTempoHyroxMin: 74 })).toBe('avanzato')
    expect(livelloStimato({ ...base, anniAllenamento: 3, ultimoTempoHyroxMin: null })).toBe('avanzato')
    expect(livelloStimato({ ...base, anniAllenamento: 2, ultimoTempoHyroxMin: 95 })).toBe('intermedio')
    expect(livelloStimato({ ...base, anniAllenamento: null, ultimoTempoHyroxMin: null })).toBe('principiante')
  })
  it('settimaneAllaGara arrotonda per difetto, null senza gara o se la gara è passata', () => {
    const oggi = new Date('2026-11-27')
    expect(settimaneAllaGara({ ...base, gara: { data: '2027-02-26', nome: 'X' } }, oggi)).toBe(13)
    expect(settimaneAllaGara({ ...base, gara: { data: '2026-11-01', nome: 'X' } }, oggi)).toBeNull()
    expect(settimaneAllaGara({ ...base, gara: null }, oggi)).toBeNull()
  })
  it('profiloPerIA pseudonimizza e lascia null i dati mancanti', () => {
    const p = profiloPerIA({ ...base, eta: 34, tempo5kSec: null, pesoKg: null, salute: 'ginocchio dx' }, new Date('2026-11-27'))
    expect(p.fasciaEta).toBe('30-39')
    expect(p.tempo5kSec).toBeNull()
    expect(JSON.stringify(p)).not.toMatch(/ginocchio|nome|email/)
    expect(Object.values(p).some(v => Number.isNaN(v))).toBe(false)
  })
})
```
(`base` e `noSicurezza` sono fixture valide in testa al file: obiettivo `migliorare`, gara fra 13 settimane, 4 sedute, giorni `[1,2,4,6]`, 60 minuti, luogo `palestra`, età 30, tutte le risposte di sicurezza `false`.)

- [ ] **Step 2: Eseguire e vederli fallire**
Run: `npx vitest run src/lib/pianoIA/__tests__/questionario.test.js` — Expected: FAIL, modulo assente.

- [ ] **Step 3: Implementare in `src/lib/pianoIA/questionario.js`**
Regole del livello: `ultimoTempoHyroxMin < 75` o `anniAllenamento >= 3` → avanzato; `anniAllenamento < 1` (o `null`) **e** nessun tempo Hyrox → principiante; il resto intermedio. Fasce d'età di 10 anni (`'18-29'`, `'30-39'`, …, `'60+'`); `null` se manca. Le esclusioni passano, il testo `salute` no (lo userà solo il validatore, fase 2).

- [ ] **Step 4: Eseguire e vederli passare**; poi rompere apposta la soglia dei 18 anni e vedere il test fallire (CLAUDE.md §9), e rimetterla.

- [ ] **Step 5: Commit**
```bash
git add src/lib/pianoIA/questionario.js src/lib/pianoIA/__tests__/questionario.test.js
git commit -m "Piano IA: questionario, controllo di sicurezza e profilo pseudonimizzato"
```

## Task 2: Programmi base e scelta del programma

**Files:**
- Create: `src/lib/pianoIA/programmi.js`
- Test: `src/lib/pianoIA/__tests__/programmi.test.js`

**Interfaces:**
- Consumes: `profiloPerIA` (Task 1)
- Produces:
  - `ProgrammaBase`: `{ id, nome, famiglia: 'prima_gara'|'migliorare'|'senza_gara'|'ripresa', livello, sedute: number, settimane: Settimana[] }`, `Settimana`: `{ n, fase: 'base'|'costruzione'|'specifico'|'scarico'|'gara', minuti: number, sedute: SedutaBase[] }`, `SedutaBase`: `{ posto: number, focus: string, dura: boolean, minuti: number, test?: boolean, sections: object }` (`sections` nel formato di CLAUDE.md §5)
  - `validaProgramma(p) -> string[]` (errori; vuoto = valido)
  - `punteggioProgramma(p, profilo) -> number` (0–100; 0 = escluso)
  - `SOGLIA_PROGRAMMA = 60`
  - `scegliProgramma(programmi, profilo) -> { programma, punteggio, settimaneUsate: number[] } | null` — `settimaneUsate` è la sequenza di indici di settimana del programma da usare (accorciata o allungata per far tornare la gara)

- [ ] **Step 1: Scrivere i test che falliscono**

```js
it('famiglia diversa = escluso', () => expect(punteggioProgramma({ ...p12x4, famiglia: 'prima_gara' }, profiloMigliorare)).toBe(0))
it('sedute: uguali +40, ±1 +20, ±2 escluso', () => {
  expect(punteggioProgramma(p12x4, { ...profiloMigliorare, sedute: 4 })).toBe(100)
  expect(punteggioProgramma(p12x4, { ...profiloMigliorare, sedute: 5 })).toBe(80)
  expect(punteggioProgramma(p12x4, { ...profiloMigliorare, sedute: 6 })).toBe(0)
})
it('livello: uguale +30, adiacente +10, opposto escluso', () => {
  expect(punteggioProgramma(p12x4, { ...profiloMigliorare, livello: 'avanzato' })).toBe(80)
  expect(punteggioProgramma({ ...p12x4, livello: 'principiante' }, { ...profiloMigliorare, livello: 'avanzato' })).toBe(0)
})
it('settimane alla gara: da L a L+4 +30, da L-3 a L-1 +15, fuori escluso', () => {
  expect(punteggioProgramma(p12x4, { ...profiloMigliorare, settimaneAllaGara: 16 })).toBe(100)
  expect(punteggioProgramma(p12x4, { ...profiloMigliorare, settimaneAllaGara: 9 })).toBe(85)
  expect(punteggioProgramma(p12x4, { ...profiloMigliorare, settimaneAllaGara: 8 })).toBe(0)
})
it('senza gara: famiglia senza_gara vale +30 per le settimane', () =>
  expect(punteggioProgramma(p8senza, profiloSenzaGara)).toBe(100))
it('scegliProgramma: il migliore sopra soglia, null sotto', () => {
  expect(scegliProgramma([p12x4, p12x3], { ...profiloMigliorare, sedute: 3 }).programma.id).toBe(p12x3.id)
  expect(scegliProgramma([p12x4], { ...profiloMigliorare, sedute: 6 })).toBeNull()
})
it('settimaneUsate: allunga ripetendo le settimane di base, accorcia togliendo le prime di base, mai lo scarico né le ultime 2', () => {
  expect(scegliProgramma([p12x4], { ...profiloMigliorare, settimaneAllaGara: 14 }).settimaneUsate).toEqual([0, 1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  expect(scegliProgramma([p12x4], { ...profiloMigliorare, settimaneAllaGara: 10 }).settimaneUsate).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
})
it('validaProgramma: sedute per settimana = sedute del programma, minuti > 0, ultima settimana fase gara se famiglia con gara', () => {
  expect(validaProgramma(p12x4)).toEqual([])
  expect(validaProgramma({ ...p12x4, settimane: p12x4.settimane.slice(0, -1) })).toContain('ultima settimana non è gara')
})
```
(fixture `p12x4`, `p12x3`, `p8senza` in `src/lib/pianoIA/__tests__/fixtureProgrammi.js`: settimane 0–1 `base`, scarico alla 3 e alla 7, ultima `gara`.)

- [ ] **Step 2: Eseguire e vederli fallire.** Run: `npx vitest run src/lib/pianoIA/__tests__/programmi.test.js`
- [ ] **Step 3: Implementare in `src/lib/pianoIA/programmi.js`.** Pesi: sedute 40/20/0, livello 30/10/0, settimane 30/15/0; un componente a 0 → totale 0. Ordine di pari merito: meno settimane da aggiungere o togliere. Senza gara `settimaneUsate` = tutte le settimane del programma.
- [ ] **Step 4: Eseguire e vederli passare.**
- [ ] **Step 5: Commit** — `git add` dei tre file, messaggio «Piano IA: programmi base e scelta del programma».

## Task 3: Regole del metodo e verifica dello scheletro

**Files:**
- Create: `src/lib/pianoIA/regole.js`
- Test: `src/lib/pianoIA/__tests__/regole.test.js`

**Interfaces:**
- Produces:
  - `REGOLE_PREDEFINITE = { progressioneMax: 0.10, scaricoOgni: 4, scaricoRiduzione: 0.30, taperingGiorni: 10, maiDuriConsecutivi: true }`
  - `Scheletro`: `Array<{ n: number, fase: string, minuti: number }>`
  - `verificaScheletro(scheletro, regole = REGOLE_PREDEFINITE) -> Array<{ settimana: number, regola: 'progressione'|'scarico'|'tapering', messaggio: string }>`
  - `verificaSettimana(sedute: Array<{giorno:number, dura:boolean}>, regole) -> string[]`

- [ ] **Step 1: Test che falliscono**
```js
it('progressione: +10% passa, +11% no; dopo uno scarico si confronta con la settimana prima dello scarico', () => { … })
it('scarico: manca uno scarico entro 4 settimane di carico → errore sulla 5ª', () => { … })
it('scarico: deve essere almeno −30% rispetto alla settimana prima', () => { … })
it('tapering: l’ultima settimana (gara) sotto la penultima', () => { … })
it('due sedute dure in giorni consecutivi → errore; domenica e lunedì contano come consecutivi', () => {
  expect(verificaSettimana([{ giorno: 7, dura: true }, { giorno: 1, dura: true }], REGOLE_PREDEFINITE)).toHaveLength(1)
})
```
(ognuno con uno scheletro di 6–8 righe scritto nel test e il numero esatto di errori atteso.)
- [ ] **Step 2: Eseguire, FAIL.** `npx vitest run src/lib/pianoIA/__tests__/regole.test.js`
- [ ] **Step 3: Implementare.** I parametri di una regola del team (`regole_metodo.parametri`, fase 1) sovrascrivono quelli predefiniti con `{ ...REGOLE_PREDEFINITE, ...parametri }`.
- [ ] **Step 4: PASS.**
- [ ] **Step 5: Commit** — «Piano IA: regole del metodo e verifica dello scheletro».

## Task 4: Attrezzatura e validatore della seduta

**Files:**
- Create: `src/lib/pianoIA/attrezzatura.js`, `src/lib/pianoIA/validaSeduta.js`
- Test: `src/lib/pianoIA/__tests__/validaSeduta.test.js`

**Interfaces:**
- Consumes: `preparaBlocchiIA`, `preparaFasiIA` (`src/lib/blocchiIA.js`); `durataBlocco` (`src/lib/stimaWorkout.js`); `trovaEsercizio` (`src/lib/esercizi.js`); gym con `src/lib/gym.js`
- Produces:
  - `richiede(nome: string) -> Array<'slitta'|'skierg'|'rower'|'wallBall'|'palestra'>` (es. `Sled Push` → `['slitta']`, `SkiErg` → `['skierg']`, `Burpees` → `[]`)
  - `disponibile(nome: string, attrezzatura) -> boolean` (`luogo: 'hyrox'` = tutto; `'casa'` = niente `palestra`)
  - `validaSeduta(sections, { minutiPrevisti: number, attrezzatura, esclusioni: string[] }) -> { ok: boolean, errori: Array<{ tipo: 'formato'|'nome'|'durata'|'attrezzatura'|'esclusione', dettaglio: string }>, sections }` — `sections` normalizzate (con gli `id` client-side)
  - `TOLLERANZA_DURATA = 0.15`

- [ ] **Step 1: Test che falliscono**
```js
it('una seduta Hyrox del team valida passa e torna con gli id', () => { const r = validaSeduta(sedutaHyrox, opz); expect(r.ok).toBe(true); expect(r.sections.blocks[0].id).toBeTypeOf('number') })
it('nome fuori dal picker → errore nome', () => expect(tipi(validaSeduta(conEsercizio('Skii Erg Sprint'), opz))).toContain('nome'))
it('durata oltre ±15% dei minuti previsti → errore durata', () => expect(tipi(validaSeduta(sedutaHyrox, { ...opz, minutiPrevisti: 30 }))).toContain('durata'))
it('Sled Push con luogo casa → errore attrezzatura', () => expect(tipi(validaSeduta(conEsercizio('Sled Push'), { ...opz, attrezzatura: casa }))).toContain('attrezzatura'))
it('esercizio escluso dall’utente → errore esclusione (anche scritto in minuscolo)', () => expect(tipi(validaSeduta(conEsercizio('Wall Balls'), { ...opz, esclusioni: ['wall balls'] }))).toContain('esclusione'))
it('sections non oggetto o senza blocks/steps/gym → errore formato, nessuna eccezione', () => expect(tipi(validaSeduta(null, opz))).toEqual(['formato']))
it('seduta Running e Gym usano la loro durata', () => { … })
```
(`opz` = 60 minuti previsti, palestra Hyrox, nessuna esclusione; `sedutaHyrox` da `fixtureProgrammi.js`, durata stimata ~60′.)
- [ ] **Step 2: FAIL.** `npx vitest run src/lib/pianoIA/__tests__/validaSeduta.test.js`
- [ ] **Step 3: Implementare.** Durata = somma di `durataBlocco` (Hyrox) / durata delle fasi (Running) / gym con `secondiGym`; minuti in più o in meno oltre `TOLLERANZA_DURATA` → errore. Il nome è valido se `trovaEsercizio(nome)` lo trova.
- [ ] **Step 4: PASS.**
- [ ] **Step 5: Commit** — «Piano IA: attrezzatura e validatore della seduta».

## Task 5: Differenze dell'IA e ripiego sulla seduta del team

**Files:**
- Create: `src/lib/pianoIA/differenze.js`
- Test: `src/lib/pianoIA/__tests__/differenze.test.js`

**Interfaces:**
- Consumes: `validaSeduta` (Task 4)
- Produces:
  - `Differenza`: `{ op: 'sostituisci', blocco: number, esercizio: number, con: string } | { op: 'numero', blocco: number, esercizio: number|null, campo: 'reps'|'meters'|'kg'|'exTime'|'rounds'|'duration'|'timecap'|'on'|'off'|'interval', valore: string } | { op: 'togli', blocco: number, esercizio: number }` (indici 0-based; `esercizio: null` = parametro del blocco)
  - `SCHEMA_DIFFERENZE` — schema JSON (per `output_config.format`) di `{ differenze: Differenza[], perche: string }`, con `additionalProperties: false`
  - `applicaDifferenze(sections, differenze) -> { sections, ignorate: Differenza[] }` — non muta l'originale
  - `adattaSeduta(sedutaTeam, differenze, opzioniValidazione) -> { sections, origine: 'adattata'|'team', errori }` — applica, valida; se non valida torna la seduta del team **validata** con `origine: 'team'`

- [ ] **Step 1: Test che falliscono**
```js
it('sostituisci cambia il nome e tiene numeri e posizione', () => { … expect(b.exercises[1]).toMatchObject({ name: 'Rowing', meters: '1000m' }) })
it('numero cambia solo quel campo', () => { … })
it('indici inesistenti, op sconosciute o campi non ammessi finiscono in ignorate, senza eccezioni', () => {
  const r = applicaDifferenze(sedutaHyrox.sections, [{ op: 'togli', blocco: 9, esercizio: 0 }, { op: 'esplodi' }, { op: 'numero', blocco: 0, esercizio: 0, campo: 'id', valore: '1' }])
  expect(r.ignorate).toHaveLength(3); expect(r.sections).toEqual(sedutaHyrox.sections)
})
it('applicaDifferenze non muta l’oggetto in ingresso', () => { … })
it('adattaSeduta: Sled Push sostituito con un esercizio disponibile a casa → adattata', () => { … expect(r.origine).toBe('adattata') })
it('adattaSeduta: differenze che lasciano la slitta a casa → torna la seduta del team con origine team', () => { … expect(r.origine).toBe('team') })
it('SCHEMA_DIFFERENZE vieta campi extra', () => expect(SCHEMA_DIFFERENZE.additionalProperties).toBe(false))
```
- [ ] **Step 2: FAIL.** · **Step 3: Implementare.** (`structuredClone` per non mutare.) · **Step 4: PASS.**
- [ ] **Step 5: Commit** — «Piano IA: differenze dell'IA e ripiego sulla seduta del team».

> Nota per la fase 2: se anche la seduta del team non passa (es. slitta a casa senza sostituzione), `adattaSeduta` torna `errori` non vuoti con `origine: 'team'`; la fase 2 decide la sostituzione predefinita. Il test lo fissa: `errori.length > 0`.

## Task 6: Riassunto dei feedback e allarmi

**Files:**
- Create: `src/lib/pianoIA/riassunto.js`
- Test: `src/lib/pianoIA/__tests__/riassunto.test.js`

**Interfaces:**
- Consumes: `rpeDichiarato` (`src/lib/rpe.js`), `rpeAtteso` (`src/lib/stimaWorkout.js`)
- Produces:
  - `SedutaStorica`: `{ data: 'yyyy-MM-dd', status: 'completed'|'pending'|string, notes: string|null, blocks: object[], carichi: 'si'|'meno'|'piu'|null }`
  - `riassuntoFeedback({ sedute: SedutaStorica[], comeStai: Array<{data, sonno, energia, dolori, stress}>, oggi: Date }) -> { aderenza7: number|null, aderenza28: number|null, rpeScarto: number|null, carichi: { meno: number, piu: number }, comeStaiMedia: number|null, sedutePassate: number }` — `rpeScarto` = media di (dichiarato − atteso) sulle ultime 4 completate con RPE
  - `PAROLE_DOLORE` (array, minuscole: `dolore`, `male`, `fitta`, `infortun`, `strappo`, `tendin`, `gonfio`)
  - `allarmi({ riassunto, sedute, comeStai, oggi }) -> Array<'come_stai_basso'|'due_saltate'|'rpe_alto'|'dolore'>`

- [ ] **Step 1: Test che falliscono**
```js
it('nessuna seduta passata → tutti null, sedutePassate 0, nessun allarme', () => {
  const r = riassuntoFeedback({ sedute: [], comeStai: [], oggi })
  expect(r).toMatchObject({ aderenza7: null, aderenza28: null, rpeScarto: null, comeStaiMedia: null, sedutePassate: 0 })
  expect(allarmi({ riassunto: r, sedute: [], comeStai: [], oggi })).toEqual([])
})
it('aderenza = completate / passate nella finestra; le future non contano', () => { … expect(r.aderenza7).toBe(0.75) })
it('rpeScarto usa rpeDichiarato: una nota senza RPE non vale 5', () => { … })
it('come_stai_basso: media ≤ 2 per due giorni di fila', () => { … })
it('due_saltate: le ultime due passate non completate', () => { … })
it('rpe_alto: RPE ≥ 9 dove l’atteso è ≤ 7, sull’ultima completata', () => { … })
it('dolore: parola di dolore nell’ultima nota, senza distinguere maiuscole', () => { … })
```
- [ ] **Step 2: FAIL.** · **Step 3: Implementare.** · **Step 4: PASS**, poi sostituire per prova `rpeDichiarato` con `parseNotesAndRpe` e vedere il test dell'RPE mancante fallire; ripristinare.
- [ ] **Step 5: Commit** — «Piano IA: riassunto dei feedback e allarmi».

## Task 7: Costi delle chiamate e scenari

**Files:**
- Create: `src/lib/pianoIA/costi.js`
- Test: `src/lib/pianoIA/__tests__/costi.test.js`

**Interfaces:**
- Produces:
  - `PREZZI` — `{ 'claude-haiku-5-5': { in: 0.10, out: 0.50, cache: 0.10 }, 'claude-sonnet-5-5': { in: 2, out: 10, cache: 0.10 }, 'claude-opus-5-5': { in: 4, out: 20, cache: 0.20 }, 'openai/gpt-oss-120b': { in, out, cache } }` ($ per milione; i prezzi Groq si compilano in fase 0 dal listino, con la data in un commento)
  - `costoChiamata({ modello, tokenIn, tokenInCache = 0, tokenOut, batch = false }) -> number` ($; `tokenIn` = token **non** in cache)
  - `costoMensileUtente(ipotesi) -> { voci: Record<string, number>, totale: number }` con `ipotesi` = `{ seduteMese, quotaRete, rifacimenti, mesiFraPiani, adattamento: {in, cache, out}, revisione: {in, cache, out}, analisi: {in, out} }`
  - `IPOTESI_SPEC` — i valori della spec §9.1

- [ ] **Step 1: Test che falliscono**
```js
it('adattamento della spec: 10k + 20k in cache + 12k in uscita su Sonnet ≈ 0,142 $', () =>
  expect(costoChiamata({ modello: 'claude-sonnet-5-5', tokenIn: 10_000, tokenInCache: 20_000, tokenOut: 12_000 })).toBeCloseTo(0.142, 3))
it('batch dimezza', () => expect(costoChiamata({ modello: 'claude-sonnet-5-5', tokenIn: 10_000, tokenInCache: 15_000, tokenOut: 8_000, batch: true })).toBeCloseTo(0.0508, 3))
it('analisi Haiku 6k/1,5k ≈ 0,00135 $', () => expect(costoChiamata({ modello: 'claude-haiku-5-5', tokenIn: 6_000, tokenOut: 1_500 })).toBeCloseTo(0.00135, 5))
it('costoMensileUtente(IPOTESI_SPEC) torna il totale della spec, fra 0,40 e 0,46 $', () => {
  const t = costoMensileUtente(IPOTESI_SPEC).totale; expect(t).toBeGreaterThan(0.40); expect(t).toBeLessThan(0.46)
})
it('modello sconosciuto → eccezione con il nome', () => expect(() => costoChiamata({ modello: 'x', tokenIn: 1, tokenOut: 1 })).toThrow('x'))
```
- [ ] **Step 2: FAIL.** · **Step 3: Implementare.** · **Step 4: PASS.**
- [ ] **Step 5: Commit** — «Piano IA: costi delle chiamate e scenari».

## Task 8: Le richieste all'IA

**Files:**
- Create: `supabase/functions/_shared/pianoIA/richieste.ts`
- Test: `src/lib/pianoIA/__tests__/richieste.test.js`

**Interfaces:**
- Consumes: forme di `profiloPerIA` (Task 1), `SedutaBase` (Task 2), `SCHEMA_DIFFERENZE` (Task 5; lo schema si **copia** nel `.ts`, e un test controlla che i due coincidano, come `colori.test.js`)
- Produces:
  - `ISTRUZIONI_ADATTAMENTO: string`, `ISTRUZIONI_ANALISI: string` — testo fisso, **nessuna data né dato utente** (prefisso in cache)
  - `richiestaAdattamento({ modello, regole, sedute: SedutaBase[], profilo, batch = false }) -> object` — corpo per `client.messages.create`: `system` = istruzioni + regole del team con `cache_control: { type: 'ephemeral' }`; un messaggio `user` con profilo e sedute in JSON; `output_config: { format: { type: 'json_schema', schema: { sedute: [{ posto, differenze, perche }] } }, effort: 'medium' }`; `max_tokens: 16000`; senza `batch`, anche `betas: ['server-side-fallback-2026-07-01']` e `fallbacks: 'default'`
  - `richiestaAnalisi({ modello, riassunto, seduta, prossime: SedutaBase[] }) -> object` — stessa forma, `effort: 'low'`, `max_tokens: 4000`, schema `{ prossime: [{ posto, differenze }], frase: string }` (la frase per l'utente, ≤ 140 caratteri)
  - `richiestaGroqAnalisi(...)` — la stessa analisi nel formato di `chatGroq` (`_shared/groq.ts`), per la gara fra modelli
  - `leggiRisposta(message) -> { ok: boolean, dati: object|null, motivo: 'refusal'|'max_tokens'|'json'|null }` — controlla `stop_reason` prima del contenuto

- [ ] **Step 1: Test che falliscono**
```js
it('il system è identico fra due utenti diversi (cache)', () => expect(richiestaAdattamento(a).system).toEqual(richiestaAdattamento(b).system))
it('nel system non ci sono date né dati del profilo', () => expect(JSON.stringify(richiestaAdattamento(a).system)).not.toMatch(/\d{4}-\d{2}-\d{2}|30-39/))
it('in batch niente fallbacks; fuori batch fallbacks default', () => { … })
it('nessun thinking disabled e nessun tool_choice', () => { const r = richiestaAdattamento(a); expect(r.thinking).toBeUndefined(); expect(r.tool_choice).toBeUndefined() })
it('lo schema delle differenze coincide con SCHEMA_DIFFERENZE di src/lib/pianoIA/differenze.js', () => { … })
it('leggiRisposta: refusal, max_tokens e JSON rotto non lanciano', () => { … })
```
- [ ] **Step 2: FAIL.** `npx vitest run src/lib/pianoIA/__tests__/richieste.test.js`
- [ ] **Step 3: Implementare.** Le istruzioni dicono, in italiano: rispetta la struttura del programma del coach; cambia solo quello che il profilo richiede (attrezzatura, esclusioni, carichi per categoria e sesso, volume per livello, stazioni deboli); rispondi solo con differenze; nomi degli esercizi solo dal picker; mai diagnosi. Le istruzioni di formato dei blocchi si riprendono da `CATEGORIE_IA` di `ai-workout/regole.ts` dove servono.
- [ ] **Step 4: PASS.**
- [ ] **Step 5: Commit** — «Piano IA: richieste all'IA, schema e lettura della risposta».

## Task 9: Banco di prova e gara fra modelli

**Files:**
- Create: `tools/prova-piano-ia/casi.json` (30 utenti inventati), `tools/prova-piano-ia/programmi.json` (3 programmi d'esempio inventati: 12 settimane × 3 e × 4 «migliorare», 8 × 3 «senza gara»), `tools/prova-piano-ia/prova.mjs`, `tools/prova-piano-ia/LEGGIMI.md`
- Modify: `package.json` (devDependency `@anthropic-ai/sdk`), `.gitignore` (`tools/prova-piano-ia/risultati/`)

**Interfaces:**
- Consumes: Task 1, 2, 4, 5, 6, 7, 8
- Produces: `risultati/<aaaa-mm-gg>-<compito>-<modello>.json` (per caso: esito del validatore, origine, token, costo, secondi) e `risultati/<data>-riepilogo.md` (tabella per modello: % salute rispettata, % altri controlli, quota ripiego, token medi, costo medio, latenza p50/p90) + `risultati/<data>-giudizio.md` (le sedute di ogni caso con i candidati in ordine casuale, etichettati A/B/C, per i coach)

- [ ] **Step 1: Scrivere i 30 casi.** Coprono, almeno: 6 per programma d'esempio; 4 senza programma vicino (6 sedute × 30′, gara fra 5 settimane, principiante con 6 sedute, avanzato con 2); 4 a casa; 3 con «non so» il 5 km; 3 con un'esclusione; 2 con feedback «troppo duro» per 3 settimane e 2 «troppo facile» (storico inventato per l'analisi); 2 donne Pro e 2 doppio/staffetta. Ogni caso ha `id`, `risposte` (forma `Risposte`), `storico` facoltativo e `atteso` (`programma` id o `null`).
- [ ] **Step 2: Controllo a secco senza IA.** `node tools/prova-piano-ia/prova.mjs --secco` → per ogni caso stampa il programma scelto (Task 2) e verifica che coincida con `atteso`; Expected: 30/30. Questo modo non chiama nessuna IA e non richiede chiavi.
- [ ] **Step 3: Implementare i compiti `adattamento` e `analisi`.** `--compito adattamento --modello claude-sonnet-5-5|claude-opus-5-5` e `--compito analisi --modello claude-haiku-5-5|openai/gpt-oss-120b`; flag `--batch` per misurare la revisione in Batch. Client `new Anthropic()` (credenziali dall'ambiente); Groq con `chatGroq`. Ogni risposta passa da `leggiRisposta` → `adattaSeduta`; i token da `usage` → `costoChiamata`.
- [ ] **Step 4: Prova da un caso.** `ANTHROPIC_API_KEY=… node tools/prova-piano-ia/prova.mjs --compito adattamento --modello claude-sonnet-5-5 --solo caso-01` → Expected: un file in `risultati/`, costo < 0,30 $. ⚠️ Costa soldi veri: **si lancia solo con il sì del committente** sul budget (stima per il giro completo: < 20 $).
- [ ] **Step 5: Commit** (senza `risultati/`) — «Piano IA: banco di prova e gara fra modelli».

## Task 10: Esito della fase 0 nella spec

**Files:**
- Modify: `docs/superpowers/specs/2026-11-27-pushfit-ai-design.md` (§8.1, §9, §10.3)
- Create: `docs/memoria/piano-ia.md` (la memoria dell'argomento) e la riga in CLAUDE.md §11 (`src/lib/pianoIA/`, `tools/prova-piano-ia/`, `_shared/pianoIA/` → `piano-ia.md`)

- [ ] **Step 1:** Giro completo sui 30 casi per i 4 candidati (dopo il sì sul budget), giudizio dei 2 coach sul foglio alla cieca.
- [ ] **Step 2:** Scrivere in §8.1 il modello scelto per compito (il più economico sopra soglia: salute 100%, altri controlli ≥ 95%, ≤ 20% «la rifarei») e in §9–§10.3 i token e i costi **misurati** al posto delle stime.
- [ ] **Step 3:** `npm test` → tutto verde; `npx eslint src/lib/pianoIA` → 0 problemi.
- [ ] **Step 4: Commit** — «Piano IA: esito della fase 0».

## Task 11 (manuale, fase 0-bis): lo staging

Passi del committente, con l'aiuto di chi costruisce; nessun codice:
1. Creare un secondo progetto Supabase (`pushfit-staging`).
2. Esportare **solo lo schema** dalla produzione (`supabase db dump --schema-only`, lettura) e applicarlo allo staging.
3. Dati inventati: un coach di sistema «PUSHFIT», 3 coach del team finti, 10 utenti finti.
4. Variabili `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` dello staging per la preview Vercel del branch `pushfit-ai` (Environment «Preview», filtrato sul branch).
5. Controllo pre-archivio aggiunto a CLAUDE.md §9: `grep -l "<id dello staging>" ios/App/App/public/assets/*.js` non deve stampare niente.
