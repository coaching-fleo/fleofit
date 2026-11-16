# Gruppi di atleti — piano di realizzazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** il coach crea gruppi di propri atleti e, nel foglio «Assegna Workout», tocca un gruppo per spuntarne tutti i membri.

**Architecture:** una tabella additiva `gruppi_atleti` (una policy, come `modelli_blocco`), logica pura in `src/lib/gruppiAtleti.js`, accesso al database in `src/lib/gruppiAtletiDb.js` (tabella assente = funzione nascosta), una riga di chip in `WorkoutDetail` e un foglio di gestione aperto dalla pagina Atleti.

**Tech Stack:** React 19, Supabase, Vitest + `src/test/fintoSupabase.js`, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-11-16-gruppi-atleti-design.md`

## Global Constraints
- Tabella `public.gruppi_atleti(id uuid, coach uuid default auth.uid(), nome text 1–40 trimmato, atleti uuid[] default '{}', creato_at, modificato_at)`; policy unica `coach = auth.uid() and public.e_staff()` in USING e WITH CHECK.
- Migrazione **scritta, non applicata**: la applica il committente dal SQL editor. Controllare la sintassi col parser di Postgres (`@libpg-query/parser`, come per i Team).
- Senza tabella (`42P01`, `PGRST205`) l'app nasconde chip, «Salva come gruppo» e bottone «Gruppi», **mai un alert**.
- Nessun interruttore in `funzioni_app`. Nessuna schermata lato atleta: bottone e chip solo per `role !== 'athlete'`.
- Nome: 1–40 caratteri dopo il trim, non doppio fra i gruppi del coach (maiuscole ignorate).
- Modali con `createPortal`, X con `aria-label="Chiudi"` (tasto indietro Android), `CustomConfirm` per eliminare, mai `alert()`.
- Il foglio di gestione si importa **pigro** (`lazy`) in `Athletes.jsx`; in `WorkoutDetail` entra solo il piccolo `GruppiUI.jsx` (il chunk `WorkoutDetail` non deve salire di più di ~3 KB).
- Testi in italiano. Colori dai token (`brand`), nessun colore nuovo.

## Review Focus
1. Un id nel gruppo che il coach non vede più (atleta cancellato, passato ad altro coach): non deve comparire né essere assegnato, né contare nel numero del chip → test in Task 2 (`membriVisibili`) e Task 4.
2. Gruppo i cui membri visibili sono zero: il chip si mostra spento con «0» e il tocco non fa nulla → test in Task 4.
3. Tocco su un gruppo con alcuni membri già scelti a mano: aggiunge i mancanti, non toglie nessuno; solo se erano **tutti** scelti li toglie → test in Task 2 (`alternaGruppo`).
4. Nome doppio o vuoto in «Salva come gruppo» e nell'editor: errore nel foglio, nessuna insert → test in Task 3 e Task 5.
5. Tabella non ancora applicata: nessun chip, nessun bottone, nessun errore a schermo → test in Task 3 e Task 4.

---

### Task 1: Migrazione, backup e ambiente di prova

**Files:**
- Create: `supabase/schema/gruppi_atleti_2026-11-16.sql`
- Modify: `.github/workflows/db-backup.yml` (commento + `gruppi_atleti` in `TABLES`)
- Modify: `src/supabaseDemo.js` (predefiniti di insert: `creato_at`, `modificato_at: null`), `src/demoSemi.js` (due gruppi d'esempio del coach demo)

- [ ] Scrivere la SQL sul modello di `modelli_blocco_2026-10-16.sql`: intestazione con data e «dodicesima eccezione, sì del committente 16/11/2026 (“A, nel database”)», `begin … commit`, tabella, indice su `coach`, RLS, policy «gruppi_atleti del coach», query di verifica e rollback commentati.
- [ ] Verificare: `node -e` con `parseSync` di `@libpg-query/parser` sul file → nessuna eccezione.
- [ ] Aggiungere la tabella al backup e all'ambiente di prova; `npm run demo` si avvia senza errori in console.
- [ ] Commit: `git add` dei quattro file per nome — «Gruppi di atleti: la migrazione (da applicare)».

### Task 2: Logica pura

**Files:**
- Create: `src/lib/gruppiAtleti.js`, `src/lib/__tests__/gruppiAtleti.test.js`

**Interfaces — Produces:**
- `NOME_MAX = 40`
- `nomeGruppoValido(nome: string, gruppi: {id,nome}[], idEscluso?: string) => string | null` — `null` se va bene, altrimenti il messaggio: `'Scrivi un nome.'`, `'Massimo 40 caratteri.'`, `'Hai già un gruppo con questo nome.'`
- `membriVisibili(gruppo: {atleti: string[]}, atleti: {id,name,surname}[]) => atleta[]` — solo quelli presenti in `atleti`, nell'ordine di `atleti`
- `statoGruppo(gruppo, scelti: {id}[], atleti) => 'tutti' | 'alcuni' | 'nessuno' | 'vuoto'`
- `alternaGruppo(gruppo, scelti: atleta[], atleti) => atleta[]` — `'tutti'` → toglie i membri; altrimenti aggiunge i mancanti in coda; `'vuoto'` → `scelti` invariato
- `gruppoUguale(gruppi, ids: string[]) => gruppo | null` — stesso insieme di id visibili (per nascondere «Salva come gruppo»)

- [ ] Test: `membriVisibili` scarta l'id sconosciuto; `statoGruppo` dà `'vuoto'` con soli id sconosciuti; `alternaGruppo` con 1 di 3 già scelto → 3 scelti, l'atleta scelto a mano fuori dal gruppo resta; con 3 di 3 → tolti solo i 3; `nomeGruppoValido('  ', …)`, 41 caratteri, `'hyrox'` contro `'Hyrox'` (e `idEscluso` lo permette); `gruppoUguale` ignora l'ordine.
- [ ] Vederli fallire (`npx vitest run src/lib/__tests__/gruppiAtleti.test.js`), implementare, vederli passare; rompere apposta `alternaGruppo` e vedere un test rosso.
- [ ] Commit.

### Task 3: Accesso al database

**Files:**
- Create: `src/lib/gruppiAtletiDb.js`, `src/lib/__tests__/gruppiAtletiDb.test.js`

**Interfaces — Consumes:** `nomeGruppoValido` (Task 2). **Produces:**
- `elencoGruppi() => Promise<{ disponibile: boolean, gruppi: gruppo[] }>` — ordinati per nome (`localeCompare` `it`); tabella assente → `{ disponibile: false, gruppi: [] }`; altro errore → throw
- `creaGruppo({ coach, nome, atleti }, gruppi) => Promise<gruppo>` — valida con `nomeGruppoValido`, trimma, throw `Error(messaggio)` senza toccare il database
- `aggiornaGruppo(id, { nome, atleti }, gruppi) => Promise<gruppo>` — scrive anche `modificato_at`
- `eliminaGruppo(id) => Promise<void>`
- `coach` esplicito come in `modelliBloccoDb.js` (l'ambiente di prova non applica `auth.uid()`).

- [ ] Test con `fintoSupabase` (modello `modelliBloccoDb.test.js`): ordine per nome; errore `PGRST205` → `disponibile: false`; nome doppio → reject e **nessuna** chiamata `insert`; `aggiornaGruppo` manda `modificato_at`; `eliminaGruppo` filtra per `id`.
- [ ] Rosso, implementazione, verde. Commit.

### Task 4: I gruppi nel foglio «Assegna Workout»

**Files:**
- Create: `src/components/GruppiUI.jsx` — `ChipGruppi({ gruppi, scelti, atleti, onAlterna })` e `FoglioNomeGruppo({ conteggio, onSalva, onChiudi })` (`onSalva(nome)` torna un messaggio d'errore o `null`)
- Modify: `src/pages/WorkoutDetail.jsx` (passo 1 del foglio di assegnazione, `apriAssegna`)
- Test: `src/pages/__tests__/` — il file di pagina di WorkoutDetail già esistente per l'assegnazione (cercarlo con `grep -l "Assegna Workout" src/**/__tests__`), altrimenti uno nuovo con `montaPagina`

**Interfaces — Consumes:** Task 2 e Task 3.

- [ ] Test: con due gruppi nel finto database il foglio mostra «Gruppi» e i due chip col numero dei membri visibili; tocco su un chip → «Procedi (N)»; secondo tocco → bottone sparito; gruppo con soli id sconosciuti → chip disabilitato «0»; tabella assente → nessuna riga «Gruppi» e nessun alert; con 2 atleti scelti a mano compare «Salva come gruppo», salvando con nome nuovo parte una `insert` su `gruppi_atleti` con quei due id e il chip appare; con nome doppio l'errore resta nel foglio.
- [ ] `apriAssegna` carica `elencoGruppi()` (errore → `console.warn`, nessun chip). Chip a scorrimento orizzontale (`hide-scrollbar`) fra ricerca e «Seleziona atleti»; stato `'tutti'` = `bg-brand text-black`, altrimenti stile `bg-[#2a2a2a] border-[#333]`. «Salva come gruppo» link `text-brand text-xs` accanto a «Seleziona tutti», visibile con ≥2 scelti e `gruppoUguale` nullo.
- [ ] `npm run build`: annotare il peso del chunk `WorkoutDetail` (prima/dopo).
- [ ] Rosso, implementazione, verde, rottura apposta. Commit.

### Task 5: Gestione dalla pagina Atleti

**Files:**
- Create: `src/components/FoglioGruppi.jsx` — elenco + editor nello stesso foglio (`useBottomSheet`, `Foglio` di `FoglioMessaggio`)
- Modify: `src/pages/Athletes.jsx` (bottone «Gruppi» in `azioneSecondaria` accanto a «Team», foglio `lazy`), `src/components/AtletiDesktop.jsx` (prop `onGruppi`, bottone quieto accanto a «Nuovo atleta»)
- Test: test di pagina di Athletes (esistente se c'è, sennò nuovo con `montaPagina`)

- [ ] Test: bottone «Gruppi» visibile al coach con tabella presente, assente con tabella assente; elenco con nome e «N atleti»; «Nuovo gruppo» → nome + spunte (con ricerca) → «Salva» crea; tocco su un gruppo → editor precompilato, togliere un atleta e salvare manda `update` con gli id rimasti; «Elimina gruppo» chiede `CustomConfirm` e poi cancella; nome doppio → errore nel foglio.
- [ ] Atleti nell'editor = lista attivi + in pausa già caricata dalla pagina (non i cancellati). Riga elenco: nome, «N atleti» (visibili), prime tre facce.
- [ ] Rosso, implementazione, verde, rottura apposta. Commit.

### Task 6: Memoria e verifica finale

**Files:**
- Modify: `CLAUDE.md` (§0-bis dodicesima eccezione ⏳ da applicare; §4 riga `gruppi_atleti`; §11 indice → `atleti.md`), `docs/memoria/atleti.md` (sezione «Gruppi»), `BACKLOG.md` se tocca

- [ ] `npm test` tutto verde (annotare il numero); `npx eslint` sui file nuovi senza problemi; `npm run build` ok.
- [ ] Prova in `npm run demo` nel browser: chip, «Salva come gruppo», foglio Gruppi, telefono e desktop; screenshot.
- [ ] Commit.
