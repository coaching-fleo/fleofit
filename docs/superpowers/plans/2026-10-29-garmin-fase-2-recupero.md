# Garmin Fase 2 · Recupero — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Garmin manda sonno, HRV e i dati della giornata; FLEOFIT li salva in `garmin_giornate`, ne ricava tre segnali di recupero per il coach («Da guardare») e mostra a coach e atleta l'andamento di 4 settimane.

**Architecture:** Il webhook `garmin-webhook` riceve i Push `dailies`, `sleeps`, `hrv` e scrive UNA colonna jsonb per invio (upsert su `athlete_id, giorno`). La logica dei segnali è pura in `src/lib/recuperoGarmin.js`, letta da Home coach (via `cosaGuardare`) e da una card pigra nella scheda atleta / profilo. Nessuna migrazione: la tabella c'è già.

**Tech Stack:** Deno Edge Functions (supabase-js 2.39.3), React 19, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-27-garmin-design.md` §4 (Fase 2), §6, §9, §10. Memoria: `docs/memoria/garmin.md`.

## Global Constraints

- 🔒 Schema congelato: **nessuna migrazione**. `garmin_giornate` esiste già: `athlete_id uuid, giorno date, giornata jsonb, sonno jsonb, hrv jsonb, aggiornato_at timestamptz`, chiave `(athlete_id, giorno)`, la leggono l'atleta e il suo coach (RLS già applicata).
- Le Edge Function non importano da `src/`: la logica condivisa sta in `supabase/functions/_shared/*.ts`, provata da Vitest in `src/lib/__tests__/`.
- Il webhook risponde **200 subito** e lavora in sottofondo (`inSottofondo`, come la Fase 1).
- Si salva **solo** se il collegamento è `attivo` e ha il permesso `HEALTH_EXPORT`. Un atleta eliminato → `scollegaAtleta(..., 'eliminato')`, come in `garmin-webhook/attivita.ts`.
- **Mai peso né composizione corporea** (regola del committente): nessun Push `bodyComps`, nessun backfill `bodyComps`.
- Si salvano **solo i campi elencati** qui sotto, nient'altro dal payload (minimo per privacy).
- Riferimento personale = media degli ultimi **28** giorni; con meno di **14** valori nel riferimento → niente segnale e «—». Segnali solo se durano **3** giorni di fila. HRV oltre il **10%** sotto la media; FC a riposo oltre **5** battiti sopra; sonno sotto **6** ore.
- Nessuna push per i segnali: si leggono in «Da guardare».
- Il foglio «Come stai» **non** mostra numeri Garmin.
- Colori: nessuno nuovo, le voci Garmin sono grigie. Italiano in interfaccia e commenti.
- Pesi dei chunk: `index` resta intorno ai 594 KB; la card nuova si carica con `lazy()`; niente librerie nuove.
- Commit: file per nome, mai `git add -A`/`.`; ci sono modifiche altrui non salvate nella cartella (mai committarle, annullarle o metterle da parte: se un file le ha, si mette in stage solo il proprio pezzo con `git apply --cached`). Nessun push. Nessun comando `supabase`.
- Un test nuovo si vede fallire (rompendo apposta il codice) prima di fidarsi del verde.

## Formato verificato (Swagger del portale, 29/10/2026)

- `ClientDaily`: `userId`, `summaryId`, `calendarDate` (`yyyy-MM-dd`), `steps`, `activeKilocalories`, `moderateIntensityDurationInSeconds`, `vigorousIntensityDurationInSeconds`, `restingHeartRateInBeatsPerMinute`, `averageStressLevel`, `bodyBatteryChargedValue`, `bodyBatteryDrainedValue`, `durationInSeconds`.
- `ClientSleep`: `userId`, `summaryId`, `calendarDate`, `durationInSeconds`, `deepSleepDurationInSeconds`, `lightSleepDurationInSeconds`, `remSleepInSeconds`, `awakeDurationInSeconds`, `overallSleepScore` (`{ value, qualifierKey }`), `validation`.
- `ClientHRVSummary`: `userId`, `summaryId`, `calendarDate`, `lastNightAvg`, `lastNight5MinHigh`. ⚠️ **Non c'è uno «stato HRV» di Garmin** (la spec lo nominava): non si salva.
- Il **livello** di Body Battery sta solo in `ClientStress` (endpoint *Stress*): non lo prendiamo. Della giornata salviamo `carica`/`scarica` di `ClientDaily`.
- Backfill: `GET /rest/backfill/dailies|sleeps|hrv?summaryStartTimeInSeconds=…&summaryEndTimeInSeconds=…`, risposta 202 (come `activities`).
- Portale, *Endpoint Configuration*: «HEALTH - Dailies», «HEALTH - Sleeps», «HEALTH - HRV Summary».
- ⚠️ DA VERIFICARE al primo Push vero: le chiavi del corpo `dailies`, `sleeps`, `hrv` (formato standard dei Push, non scritto nello Swagger).

## Rulings (decisi in fase di piano)

- **Giorno** = `calendarDate` di Garmin, così com'è (è già il giorno locale dell'atleta; per il sonno è il giorno del risveglio).
- **Ore di sonno** = `deep + light + rem` (secondi → ore); se sono tutti assenti, `durationInSeconds`. Il sonno sveglio non conta.
- **Più invii dello stesso giorno**: vince l'ultimo arrivato per quella colonna (Garmin rimanda la giornata man mano che si riempie).
- **Finestra del riferimento**: i 28 giorni **prima** dei 3 giorni del segnale (così il calo non abbassa la sua stessa media).
- **«Di fila»**: i 3 giorni consecutivi che finiscono nell'ultimo giorno con un dato, e quell'ultimo giorno è **oggi o ieri**; un giorno senza il dato rompe la fila. Se la fila è più lunga, il testo dice quanti giorni (fino a 14).
- **Sonno sotto 6 ore**: non ha bisogno del riferimento (è una soglia della spec, non una media): basta la fila di 3 notti.

## Review Focus

1. Garmin rimanda lo stesso giorno più volte, anche in ordine diverso (sonno prima della giornata, HRV dopo): ogni invio tocca **solo la sua colonna**, le altre restano. → test in Task 2.
2. Un atleta con 10 giorni di dati: nessun segnale, «—» per la media, ma i valori nella card si vedono. → test in Task 4 e Task 6.
3. Il segnale si spegne da solo: una notte buona in mezzo, o l'ultimo dato vecchio di 2 giorni → nessun segnale. → test in Task 4.
4. Collegamento non `attivo` o senza `HEALTH_EXPORT` (l'atleta ha tolto i dati di salute su Connect): niente si salva. → test in Task 2.
5. Un atleta senza Garmin: card assente, «Da guardare» uguale a oggi, nessun errore se la tabella non risponde. → test in Task 5 e Task 6.

---

### Task 1: Leggere i Push del recupero

**Files:**
- Create: `supabase/functions/_shared/giornateGarmin.ts`
- Create: `src/lib/__tests__/fixtures/garminGiornate.json` (payload inventato, un lotto per chiave)
- Test: `src/lib/__tests__/giornateGarmin.test.js`

**Interfaces:**
- Produces: `type VoceGiornata = { garmin_user_id: string; giorno: string; colonna: 'giornata' | 'sonno' | 'hrv'; valore: Record<string, number | string> }`; `leggiGiornate(corpo: unknown): VoceGiornata[]`; `CHIAVI_GIORNATE = { dailies: 'giornata', sleeps: 'sonno', hrv: 'hrv' }`.

Il `valore` per colonna (solo questi campi; un campo assente o non numerico **non** compare):
- `giornata`: `passi` (steps), `calorie` (activeKilocalories), `minuti_intensi` (round((moderate + 2·vigorous)/60), come Garmin conta gli intensi), `fc_riposo` (restingHeartRateInBeatsPerMinute), `stress_medio` (averageStressLevel, solo se ≥ 0: Garmin usa −1 per «non misurato»), `body_battery_carica`, `body_battery_scarica`.
- `sonno`: `ore` (vedi Rulings, arrotondato a 2 decimali), `profondo_min`, `leggero_min`, `rem_min`, `sveglio_min`, `punteggio` (overallSleepScore.value), `qualita` (overallSleepScore.qualifierKey).
- `hrv`: `media_notte` (lastNightAvg), `picco_5min` (lastNight5MinHigh).

- [ ] **Step 1: Test** — `leggiGiornate` sul fixture: una voce per riepilogo con la colonna giusta; `giorno` = `calendarDate`; `minuti_intensi` = (moderate + 2·vigorous)/60 arrotondato; `stress_medio` −1 assente; `ore` del sonno = (deep+light+rem)/3600; sonno senza fasi → `durationInSeconds/3600`; riepilogo senza `userId` o senza `calendarDate` valida (`/^\d{4}-\d{2}-\d{2}$/`) scartato; chiavi sconosciute (`bodyComps`, `stressDetails`) ignorate; corpo non oggetto → `[]`; nessun campo estraneo (es. `timeOffsetHeartRateSamples`, `sleepLevelsMap`) nel `valore`.
- [ ] **Step 2:** Esegui `npx vitest run src/lib/__tests__/giornateGarmin.test.js` → FAIL.
- [ ] **Step 3:** Implementa in `giornateGarmin.ts` (puro, nessun import Deno; stesso stile di `_shared/attivitaGarmin.ts`).
- [ ] **Step 4:** Test → PASS; rompi un campo apposta e vedilo fallire.
- [ ] **Step 5:** Commit `Garmin: leggere sonno, HRV e giornata dai Push`.

### Task 2: Il webhook salva le giornate

**Files:**
- Create: `supabase/functions/garmin-webhook/giornate.ts`
- Modify: `supabase/functions/garmin-webhook/index.ts` (in sottofondo, accanto a `gestisciAttivita`)
- Test: `src/lib/__tests__/garminWebhookGiornate.test.js` (con un finto `admin` come i test della Fase 1, se esistono; altrimenti estrai la decisione in una funzione pura `daSalvare(collegamento, permessi)` in `giornateGarmin.ts` e prova quella)

**Interfaces:**
- Consumes: `leggiGiornate`, `VoceGiornata` (Task 1); `scollegaAtleta` di `_shared/garmin.ts`; la ricerca del collegamento per `garmin_user_id` come in `garmin-webhook/attivita.ts`.
- Produces: `gestisciGiornate(admin, voci: VoceGiornata[]): Promise<void>`.

Per ogni voce: trova il collegamento; atleta eliminato → `scollegaAtleta`; salva solo se `stato === 'attivo'` e `permessi` contiene `HEALTH_EXPORT`; poi `upsert([{ athlete_id, giorno, [colonna]: valore, aggiornato_at: now }], { onConflict: 'athlete_id,giorno' })` — **solo quella colonna** nel record, così le altre restano. Ogni voce col suo try/catch e un `console.warn` senza dati personali.

- [ ] **Step 1: Test** — tre voci dello stesso giorno in ordine sonno, giornata, hrv: tre upsert, ognuno con una sola colonna jsonb; collegamento `sospeso` o senza `HEALTH_EXPORT` → nessun upsert; atleta eliminato → `scollegaAtleta` chiamato, nessun upsert; un errore su una voce non ferma le altre.
- [ ] **Step 2:** FAIL. **Step 3:** Implementa e collega in `index.ts` (il corpo è letto una volta sola; `leggiAttivita` e `leggiGiornate` sullo stesso corpo). **Step 4:** PASS + prova a rompere.
- [ ] **Step 5:** Commit `Garmin: il webhook salva sonno, HRV e giornata`.

### Task 3: Backfill di 30 giorni al collegamento

**Files:**
- Modify: `supabase/functions/_shared/garmin.ts` (`chiediBackfillAttivita` → generale)
- Modify: `supabase/functions/garmin-auth/index.ts` (`chiediBackfill`)
- Test: il test esistente di `_shared/garmin.ts` se c'è; altrimenti un test della costruzione dell'indirizzo

**Interfaces:**
- Produces: `chiediBackfillGarmin(access: string, tipo: 'activities' | 'dailies' | 'sleeps' | 'hrv', daSec: number, aSec: number): Promise<void>`; `chiediBackfillAttivita` resta come alias (o i chiamanti passano a quella nuova, nello stesso commit).

`chiediBackfill` di `garmin-auth` chiede i quattro tipi in sequenza, ognuno col suo try/catch (un 4xx su `hrv` non ferma `sleeps`). Così il riferimento di 14 giorni c'è dal primo giorno.

- [ ] **Step 1: Test** dell'indirizzo per `dailies` (`/rest/backfill/dailies?summaryStartTimeInSeconds=…&summaryEndTimeInSeconds=…`) e che `bodyComps` non sia un tipo ammesso (tipo TypeScript + nessuna chiamata nel codice: `grep -n bodyComps supabase/functions` vuoto).
- [ ] **Step 2–4:** FAIL → implementa → PASS.
- [ ] **Step 5:** Commit `Garmin: al collegamento si chiedono anche 30 giorni di recupero`.

### Task 4: I segnali e le serie — `src/lib/recuperoGarmin.js`

**Files:**
- Create: `src/lib/recuperoGarmin.js`
- Test: `src/lib/__tests__/recuperoGarmin.test.js`

**Interfaces:**
- Consumes: righe di `garmin_giornate` (`{ athlete_id, giorno, giornata, sonno, hrv }`).
- Produces:
  - costanti `GIORNI_RIFERIMENTO = 28`, `MINIMO_GIORNI = 14`, `GIORNI_DI_FILA = 3`, `SCARTO_HRV = 0.10`, `SCARTO_FC = 5`, `ORE_SONNO = 6`;
  - `METRICHE = [{ chiave: 'sonno', etichetta: 'Sonno', unita: 'h', leggi: r => r.sonno?.ore }, { chiave: 'hrv', etichetta: 'HRV notturna', unita: 'ms', leggi: r => r.hrv?.media_notte }, { chiave: 'fc', etichetta: 'FC a riposo', unita: 'bpm', leggi: r => r.giornata?.fc_riposo }]`;
  - `serieRecupero(righe, oggi = new Date()) → { [chiave]: { punti: Array<{ giorno, valore: number | null }>, media: number | null } }` — 28 giorni che finiscono oggi (giorni senza dato = `null`), `media` = media dei valori dei 28 giorni se sono almeno 14, altrimenti `null`;
  - `segnaliRecupero(righe, oggi = new Date()) → Array<{ tipo: 'hrv' | 'fc' | 'sonno', giorni: number, testo: string }>` — righe di UN atleta;
  - `segnaliTeam(atleti, righe, oggi) → Array<{ id, nome, foto, segnali }>` solo per chi ne ha almeno uno.

Testi esatti: `HRV sotto la sua media da ${n} notti`, `FC a riposo sopra la sua media da ${n} giorni`, `Dorme meno di 6 ore da ${n} notti`.
Date in Italia (`Europe/Rome`) come `oggiItalia` di `_shared/garminTraining.ts`; la settimana non c'entra.

- [ ] **Step 1: Test**:
  - 28 giorni di HRV a 60 poi 3 notti a 53 (−11,7%) che finiscono ieri → segnale `hrv`, `giorni: 3`; a 54,5 (−9%) → nessuno;
  - FC a riposo media 50, 3 giorni a 56 → `fc`; a 55 → nessuno (serve **oltre** 5);
  - 10 giorni di dati soltanto → nessun segnale HRV/FC e `media: null`; i punti ci sono;
  - sonno 5,5 h per 3 notti, senza storico → `sonno`; 5,5 / 7 / 5,5 → nessuno;
  - fila che finisce l'altro ieri → nessuno;
  - fila di 5 → `giorni: 5`, testo «da 5 notti»;
  - il riferimento esclude i giorni della fila (6 notti basse dopo 28 normali: la media resta quella normale);
  - righe di altri atleti in `segnaliTeam` non si mescolano.
- [ ] **Step 2–4:** FAIL → implementa → PASS + prova a rompere una soglia.
- [ ] **Step 5:** Aggiungi in fondo allo stesso file le letture, con lo stile di `leggiComeStaiFra` in `src/lib/comeStai.js` (errore o tabella assente → `[]`, **a pagine** da mille): `leggiGiornate(supabase, athleteId, da, a)` e `leggiGiornateFra(supabase, da, a)` che selezionano solo `athlete_id, giorno, giornata, sonno, hrv`. Test con il finto supabase di `src/test/fintoSupabase.js`.
- [ ] **Step 6:** Commit `Garmin: i segnali di recupero`.

### Task 5: «Da guardare» del coach

**Files:**
- Modify: `src/lib/cosaGuardare.js` (nuovo parametro `recupero = []`)
- Modify: `src/pages/Home.jsx` (carica `leggiGiornateFra` degli ultimi 31 giorni accanto a `leggiComeStaiFra`, nello stesso effetto o in uno gemello; calcola `segnaliTeam`)
- Modify: `src/components/HomeCoachDesktop.jsx`, `src/components/HomeCoachTelefono.jsx` (passano `recupero` a `cosaGuardare`)
- Test: `src/lib/__tests__/cosaGuardare.test.js` (esistente o nuovo)

**Interfaces:**
- Consumes: `segnaliTeam`, `leggiGiornateFra` (Task 4).
- Produces: voci `{ chiave: 'r-<id>-<tipo>', tipo: 'recupero', dato, nome, foto, riga: testo, avviso: false, rpe: null, azione: 'Scheda' }`, una per segnale, **dopo** feedback e **prima** di fermi e scaduti. L'azione «Scheda» porta a `/athletes/<id>` come per i fermi.

- [ ] **Step 1: Test** — `cosaGuardare` senza `recupero` → identico a oggi (stessa lista, stesso ordine); con un atleta con due segnali → due voci `recupero` con i testi del Task 4, nel punto giusto.
- [ ] **Step 2–4:** FAIL → implementa → PASS. In Home un errore di lettura non rompe niente (`[]`).
- [ ] **Step 5:** Controlla che la voce `recupero` si veda nella demo (`npm run demo`, Home coach) dopo il Task 7, o nel test della pagina se c'è.
- [ ] **Step 6:** Commit `Garmin: i segnali di recupero in «Da guardare»`.

### Task 6: La card «Recupero» nella scheda atleta e nel profilo

**Files:**
- Create: `src/components/CardRecupero.jsx` (caricata con `lazy()` da `AthleteDetail.jsx`)
- Modify: `src/pages/AthleteDetail.jsx` (legge `leggiGiornate` degli ultimi 28 giorni per l'atleta mostrato; serve sia `/athletes/:id` sia `/profile`)
- Test: `src/components/__tests__/CardRecupero.test.jsx`

**Interfaces:**
- Consumes: `serieRecupero`, `METRICHE`, `leggiGiornate` (Task 4).

Contenuto: titolo «Recupero · da Garmin», per ogni metrica una riga con etichetta, ultimo valore (con unità; sonno come `7 h 20′`), «media 4 sett.» (o «—» se `media` è `null`) e una linea di 28 punti in SVG inline con la linea tratteggiata della media (niente librerie; se in `src/components/grafici/` c'è già un componente a linea riusabile, usa quello). Colori grigi/bianchi esistenti, nessun colore nuovo. La card **non compare** se l'atleta non ha nessuna riga nei 28 giorni. Una metrica senza nessun valore non mostra la riga. Mettila vicino all'andamento «Come stai» della scheda, se c'è; altrimenti dopo le statistiche.

- [ ] **Step 1: Test** — con 20 giorni di dati: tre righe, la media in numero; con 10 giorni: valori e «—» al posto della media; senza righe: niente nel DOM; solo sonno: una riga sola.
- [ ] **Step 2–4:** FAIL → implementa → PASS. Il foglio `FoglioComeStai` non si tocca.
- [ ] **Step 5:** `npm run build` e controlla: `index` intorno ai 594 KB, `CardRecupero` in un chunk suo.
- [ ] **Step 6:** Commit `Garmin: la card del recupero`.

### Task 7: Demo, memoria, passi del committente

**Files:**
- Modify: `src/demoSemi.js` (alza `VERSIONE_SEME`; `garmin_giornate` per Sara: 35 giorni normali + le ultime 3 notti con HRV −15% e sonno 5 h 30′, così nella demo si vedono card e segnali)
- Modify: `docs/memoria/garmin.md` (sezione «Fase 2 · Recupero»: formato verificato, rulings di questo piano, cosa resta da verificare, i passi del committente; riga di stato in cima)
- Modify: `CLAUDE.md` §11 solo per aggiungere i nomi dei file nuovi alla riga di `garmin.md` (solo il tuo pezzo: c'è un pezzo altrui non salvato nel file)
- Test: il test demo esistente (`demoGarmin.test.js`) esteso alle giornate

Passi del committente da scrivere in `garmin.md`:
1. Portale, *Endpoint Configuration*: attivare «HEALTH - Dailies», «HEALTH - Sleeps», «HEALTH - HRV Summary», stesso indirizzo del webhook.
2. `supabase functions deploy garmin-webhook --no-verify-jwt` e `supabase functions deploy garmin-auth --no-verify-jwt`.
3. Scollegare e ricollegare Garmin sull'atleta di prova (parte il backfill di 30 giorni), poi: `select giorno, giornata is not null as g, sonno is not null as s, hrv is not null as h from garmin_giornate order by giorno desc limit 10;`
4. Aprire la scheda dell'atleta di prova e il suo profilo: card «Recupero».

- [ ] **Step 1–3:** demo + test → PASS; memoria; `npm test` intero (CreaWorkoutBuilder, CreaWorkoutIA, ReportSettimanale sono instabili sotto carico: si rilanciano da soli).
- [ ] **Step 4:** Commit `Garmin: memoria della Fase 2 (recupero)`.
