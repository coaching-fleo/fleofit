# Template PDF del coach — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** il PDF della scheda porta il nome del coach che ha creato il workout e le sue «note aggiuntive», scritte una volta nelle Impostazioni.

**Architecture:** una tabella additiva `pdf_coach` (una riga per coach) letta all'esportazione; la logica sta in un modulo puro `src/lib/templatePdf.js`; `buildPDFDoc` in `WorkoutDetail.jsx` la usa per intestazione e riquadro finale; un foglio nelle Impostazioni («Solo coach») la scrive.

**Tech Stack:** React 19, Supabase (Postgres + RLS), jsPDF (caricato pigro), Vitest + jsdom.

**Spec:** `docs/superpowers/specs/2026-11-11-template-pdf-design.md`

## Global Constraints

- Limiti: `nome_firma` 1–60 caratteri dopo `btrim`, `note_finali` ≤ 600 caratteri; vuoto = `null`.
- Intestazione: `' - Coach <nome>'` dopo `FLEOFIT`; senza nome nient'altro. Mai «Federico Leo» scritto nel codice.
- Titolo del riquadro: `NOTE AGGIUNTIVE`, giallo brand `(241, 186, 23)`, bold 11; testo `(200, 200, 200)` normal 10, larghezza 165 mm, x 20.
- Il riquadro non deve toccare il glossario a y 240 mm: se non entra, `addPage` + sfondo `(23, 23, 23)` su `0,0,210,297` + y 20.
- Errore, rete giù, tabella assente (`42P01`/`PGRST205`): il PDF si esporta lo stesso, senza nome e senza note.
- `jspdf` resta importato solo dentro `caricaPdf()`. Niente import nuovi pesanti in file condivisi.
- Scrittura vietata a `demo@fleofit.it` (RLS con `puo_scrivere_messaggi()`).
- Interfaccia e commenti in italiano; mai `alert()`, solo `CustomAlert`.
- Nessun commit né push dentro il piano: li decide il committente (fascia «Salva e pubblica»).

## Review Focus

1. Workout con `creato_da` di un admin che non è coach dell'atleta → l'atleta non legge la riga: si deve passare al template di chi esporta (l'atleta: nessuno) senza errori. Test in Task 2.
2. Note lunghe (600 caratteri con a-capo) su un workout già lungo → pagina nuova con sfondo scuro, mai testo sopra il glossario. Test in Task 2.
3. Nome con soli spazi o note con soli a-capo salvati dal foglio → diventano `null`, non un'intestazione «Coach   ». Test in Task 2.
4. Migrazione non ancora applicata (app nuova, database vecchio) → foglio delle Impostazioni mostra un errore leggibile al salvataggio, PDF identico a oggi senza nome. Test in Task 2 (lettura) e Task 4 (salvataggio).
5. `creato_da` nullo (workout autonomi vecchi) → si usa il template di chi esporta. Test in Task 2.

---

### Task 1: Migrazione `pdf_coach` e backup

**Files:**
- Create: `supabase/schema/pdf_coach_2026-11-11.sql`
- Modify: `.github/workflows/db-backup.yml` (riga `TABLES` e commento come quelli di `messaggi_coach`/`modelli_blocco`)
- Modify: `src/demoSemi.js` (`pdf_coach` in `semi()`, `VERSIONE_SEME` 23 → 24)
- Modify: `src/supabaseDemo.js` (predefinito `aggiornato_at` per `pdf_coach` nell'insert/upsert)

**Interfaces:**
- Produces: tabella `public.pdf_coach(coach_id uuid pk, nome_firma text, note_finali text, aggiornato_at timestamptz)`; semi demo con una riga per `COACH` (`nome_firma: 'Federico Leo'`, `note_finali` di esempio).

- [ ] **Step 1: Scrivere il SQL** con: intestazione nello stile di `messaggi_coach_2026-10-15.sql` (data, sì del committente dell'11/11/2026, additiva, chi legge/scrive); `create table` come nello spec; `enable row level security`; policy `pdf_coach lettura` (select: `coach_id = auth.uid() or public.e_staff() or public.e_mio_coach(coach_id)`); policy `pdf_coach scrittura` (all: `using` e `with check` entrambi `coach_id = auth.uid() and public.puo_scrivere_messaggi()`); semina:

```sql
insert into public.pdf_coach (coach_id, nome_firma)
select u.id, nullif(left(btrim(coalesce(a.name, '') || ' ' || coalesce(a.surname, '')), 60), '')
from public.staff s
join auth.users u on lower(u.email) = s.email
left join public.athletes a on a.id = u.id
on conflict (coach_id) do nothing;
```

  In coda, commentati: la query di verifica (`select policyname, cmd from pg_policies where tablename = 'pdf_coach';` → due righe, SELECT e ALL; `select count(*) from public.pdf_coach;` = numero dello staff con account) e il rollback (`drop table public.pdf_coach;`).

- [ ] **Step 2: Backup**: aggiungere `pdf_coach:coach_id` in fondo a `TABLES` di `db-backup.yml`, con un commento «pdf_coach (11/11/2026): template PDF del coach».

- [ ] **Step 3: Demo**: riga in `semi()` e predefinito `{ aggiornato_at: new Date().toISOString() }` per `pdf_coach` in `supabaseDemo.js`.

- [ ] **Step 4: Verifica**: `npm test -- demo` → PASS (i test dell'ambiente di prova restano verdi). Il SQL **non** si esegue: lo applica a mano il committente.

---

### Task 2: `src/lib/templatePdf.js`

**Files:**
- Create: `src/lib/templatePdf.js`
- Test: `src/lib/__tests__/templatePdf.test.js`

**Interfaces:**
- Produces:
  - `LIMITI_PDF = { nome: 60, note: 600 }`
  - `pulisciTemplate({ nome, note }) → { nome_firma: string|null, note_finali: string|null }`
  - `leggiTemplatePdf(supabase, { creatoDa, utente }) → Promise<{ nome: string|null, note: string|null }>` — mai rifiuta.
  - `salvaTemplatePdf(supabase, uid, { nome, note }) → Promise<{ errore: string|null }>` — upsert su `pdf_coach` con `onConflict: 'coach_id'`, `aggiornato_at` = adesso; tabella assente → `errore: 'Funzione non ancora attiva: manca la tabella nel database.'`.
  - `intestazioneCoach(nome) → string`
  - `scriviNoteAggiuntive(doc, y, note) → number` — disegna il riquadro su un doc jsPDF e torna la nuova y; con `note` vuoto non disegna e torna `y`.

- [ ] **Step 1: Test che falliscono** (con `fintoSupabase` di `src/test/fintoSupabase.js` o un finto locale che risponde per `coach_id`):
  - `pulisciTemplate({ nome: '  Mario Rossi ', note: '\n\n' })` → `{ nome_firma: 'Mario Rossi', note_finali: null }`; nome di 70 caratteri → tagliato a 60; note di 700 → 600.
  - `leggiTemplatePdf` con riga per `creatoDa` → `{ nome: 'Mario Rossi', note: 'Scrivimi su WhatsApp' }`.
  - `creatoDa` senza riga (o non leggibile) e riga per `utente` → template di `utente`.
  - `creatoDa: null` → template di `utente`.
  - errore `{ code: 'PGRST205' }` → `{ nome: null, note: null }`; promessa che rifiuta → stesso risultato.
  - `intestazioneCoach('Mario Rossi')` → `' - Coach Mario Rossi'`; `intestazioneCoach(null)` e `('  ')` → `''`.
  - `scriviNoteAggiuntive(docFinto, 100, '')` → `100` e nessuna chiamata a `text`.
  - `scriviNoteAggiuntive(docFinto, 100, 'Ciao')` → un `text('NOTE AGGIUNTIVE', 20, …)` e la y torna > 100.
  - con y di partenza 230 e note che non entrano prima di 240 → `addPage` chiamato una volta, `rect(0, 0, 210, 297, 'F')` dopo l'`addPage`, titolo scritto a y 20.
  - `salvaTemplatePdf` con errore `42P01` → `errore` con il testo sopra; con successo → `{ errore: null }` e l'upsert ha ricevuto `coach_id: uid` e i campi puliti.

  Il `docFinto` registra `text`, `addPage`, `rect`, `setFillColor`, `setTextColor`, `setFont`, `setFontSize`, `setDrawColor`, `line` e implementa `splitTextToSize(t, w)` come `t.split('\n')`.

- [ ] **Step 2:** `npx vitest run src/lib/__tests__/templatePdf.test.js` → FAIL (modulo inesistente).

- [ ] **Step 3: Implementare** le sei esportazioni. In `leggiTemplatePdf` una sola query: `.from('pdf_coach').select('coach_id, nome_firma, note_finali').in('coach_id', [creatoDa, utente].filter(Boolean))`, poi si sceglie la riga di `creatoDa`, altrimenti quella di `utente`. `scriviNoteAggiuntive`: linea divisoria come quella di «NOTE COACH», titolo, `splitTextToSize(note, 165)`, altezza `righe * 5 + 12`; se `y + altezza > 236` pagina nuova prima del titolo.

- [ ] **Step 4:** stesso comando → PASS. Poi rompere apposta `intestazioneCoach` e il controllo di pagina nuova, vedere i test cadere, ripristinare.

---

### Task 3: il PDF usa il template

**Files:**
- Modify: `src/pages/WorkoutDetail.jsx` (`buildPDFDoc`: intestazione e riquadro prima del glossario)
- Test: `src/pages/__tests__/WorkoutDetailPdf.test.jsx`

**Interfaces:**
- Consumes: `leggiTemplatePdf`, `intestazioneCoach`, `scriviNoteAggiuntive` (Task 2); `workout.creato_da`; `user.id` dal contesto già presente nel file.

- [ ] **Step 1: Test che fallisce**, costruito come `WorkoutDetailRecap.test.jsx` ma con un `jspdf` finto che salva in un array globale ogni `text(...)` e ha `save` vuoto, `splitTextToSize` come nel Task 2, `getTextWidth` → `10`, `addImage`/`output` vuoti. Il finto Supabase risponde a `pdf_coach` con `{ coach_id: <creato_da del workout>, nome_firma: 'Mario Rossi', note_finali: 'Scrivimi su WhatsApp' }`. Aprire il menu della scheda e premere «Esporta PDF»; attendere che `save` sia chiamato.
  - `test('intestazione col nome del coach')`: fra i testi c'è `' - Coach Mario Rossi'` e nessuno contiene `'Federico Leo'`.
  - `test('note aggiuntive solo se ci sono')`: c'è `'NOTE AGGIUNTIVE'`; con `pdf_coach` vuota non c'è, e non c'è testo che contenga `'Coach'` dopo `FLEO`/`FIT`.

- [ ] **Step 2:** `npx vitest run src/pages/__tests__/WorkoutDetailPdf.test.jsx` → FAIL (c'è «Federico Leo»).

- [ ] **Step 3:** in `buildPDFDoc`, prima dell'header, `const template = await leggiTemplatePdf(supabase, { creatoDa: workout.creato_da, utente: user?.id })`; il testo `' - Coach Federico Leo'` diventa `intestazioneCoach(template.nome)`, scritto solo se non vuoto; dopo il blocco «Note coach», `y = scriviNoteAggiuntive(doc, y, template.note)`. Il resto del PDF non cambia.

- [ ] **Step 4:** stesso comando → PASS; poi `npx vitest run src/pages/__tests__/WorkoutDetail` → tutti PASS (inclusa la guardia del chunk in `WorkoutDetailChunk.test.jsx`). Rompere apposta (togliere la chiamata a `scriviNoteAggiuntive`), vedere il test cadere, ripristinare.

---

### Task 4: Impostazioni → «PDF delle schede»

**Files:**
- Create: `src/components/FoglioPdf.jsx`
- Modify: `src/pages/Settings.jsx` (riga in `pCoach` dopo «Codici invito», stato di apertura, lettura e salvataggio)
- Test: `src/components/__tests__/FoglioPdf.test.jsx`

**Interfaces:**
- Consumes: `LIMITI_PDF`, `leggiTemplatePdf`, `salvaTemplatePdf` (Task 2).
- Produces: `<FoglioPdf aperto valori={{ nome, note }} nomeAccount onSalva={async ({ nome, note }) => ({ errore })} onChiudi />` — solo presentazione, niente `supabase` dentro (patto dei `*UI`/`Foglio*`).

- [ ] **Step 1: Test che falliscono**:
  - `test('contatore delle note')`: scrivere 10 caratteri nell'area → si vede `10 / 600`; l'area ha `maxLength` 600, il campo nome 60.
  - `test('il placeholder del nome è il nome dell account')`: `nomeAccount='Mario Rossi'` → placeholder `Mario Rossi`.
  - `test('salva e chiude')`: «Salva» chiama `onSalva` con i valori scritti e poi `onChiudi`.
  - `test('errore resta aperto')`: `onSalva` risolve `{ errore: 'Funzione non ancora attiva: manca la tabella nel database.' }` → il testo compare, `onChiudi` non chiamato.
  - `test('si chiude con Annulla')`: bottone con testo esatto «Annulla» (serve a `indietroAndroid.js`).

- [ ] **Step 2:** `npx vitest run src/components/__tests__/FoglioPdf.test.jsx` → FAIL.

- [ ] **Step 3: Foglio**: bottom sheet in `createPortal(…, document.body)` con `useBottomSheet` (come il menu della scheda), titolo «PDF delle schede», sottotitolo «Nome e note in fondo a tutti i tuoi PDF», campo «Nome in intestazione», area «Note aggiuntive» (5 righe), contatore, bottoni «Annulla» e «Salva» (CTA brand). Stili da `stiliCard.js`.

- [ ] **Step 4: Settings**: `RigaAzione` con icona `FileText`, titolo «PDF delle schede», dettaglio = nome salvato o «Nome e note in fondo ai tuoi PDF»; all'apertura `leggiTemplatePdf(supabase, { creatoDa: user.id, utente: user.id })`; `onSalva` chiama `salvaTemplatePdf` e, se va, `vibraSuccesso()` e aggiorna il dettaglio; `nomeAccount` = la variabile `nome` già in pagina.

- [ ] **Step 5:** test del Task 4 → PASS; `npx vitest run src/pages/__tests__/Impostazioni` → PASS. Rompere apposta il controllo dell'errore nel foglio, vedere cadere, ripristinare.

---

### Task 5: Verifica finale e memoria

**Files:**
- Modify: `CLAUDE.md` (§0 0-bis: undicesima eccezione, «scritta, da applicare a mano»; tabella §4: riga `pdf_coach`)
- Modify: `docs/memoria/scheda-workout.md` (sezione nuova «Template PDF del coach (11/11/2026)»: di chi è il template, fallback, limiti, perché all'esportazione)
- Modify: `BACKLOG.md` solo se c'è una voce sul PDF da chiudere
- Modify: `DEVLOG.md` (novità per il prossimo aggiornamento)

- [ ] **Step 1:** `npm test` → tutti PASS (erano 3070 al 06/11; annotare il numero nuovo).
- [ ] **Step 2:** `npx eslint src/lib/templatePdf.js src/components/FoglioPdf.jsx src/pages/WorkoutDetail.jsx src/pages/Settings.jsx` → nessun problema nuovo nei file toccati.
- [ ] **Step 3:** `npm run build` → `index` resta sotto 620 KB (margine ~4 KB) e `WorkoutDetail` intorno a 107 KB; se `index` sale di più di 1 KB, `templatePdf.js` è finito nel chunk d'ingresso: va importato solo da `WorkoutDetail` e `Settings`.
- [ ] **Step 4:** `npm run demo` e prova nel browser: Impostazioni → «PDF delle schede», salvare nome e note, aprire una scheda, «Esporta PDF», controllare intestazione e riquadro.
- [ ] **Step 5:** aggiornare i documenti sopra.
