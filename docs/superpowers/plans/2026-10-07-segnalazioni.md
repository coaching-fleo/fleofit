# Segnala un problema — piano d'implementazione

> **Per chi esegue:** SOTTO-SKILL RICHIESTA: superpowers:subagent-driven-development
> (consigliata) o superpowers:executing-plans, un task alla volta. I passi usano le
> caselle (`- [ ]`) per tenere il conto.

**Obiettivo:** un modulo a tre passi in Impostazioni che spedisce una segnalazione al
coach per email, senza uscire dall'app.

**Architettura:** logica pura in `src/lib/segnalazione.js` (tipi, domande, validazione,
dati tecnici, testo). Presentazione nel foglio `src/components/FoglioSegnalazione.jsx`,
collegato da `Settings.jsx`, che invoca la nuova Edge Function `segnalazione`. La
funzione verifica il JWT, applica i limiti con le regole pure di `regole.ts` e spedisce
con l'API di Resend.

**Stack:** React 19, Vitest + Testing Library, Capacitor (`@capacitor/app`,
`@capacitor/core`), Supabase Edge Function (Deno), Resend REST API.

**Spec:** `docs/superpowers/specs/2026-10-07-segnalazioni-design.md`

## Vincoli globali
- 🔒 Nessuna migrazione, tabella o policy (CLAUDE.md regola 0-bis).
- Testi dell'interfaccia e commenti in **italiano**; nomi come nei file vicini.
- Mai `alert()`/`confirm()`; foglio con `createPortal(…, document.body)` e `useBottomSheet`.
- Aptica solo da `src/lib/aptica.js` (`vibraScelta`, `vibraSuccesso`, `vibraErrore`).
- localStorage solo con `leggiJson`/`scriviJson` di `src/lib/offlineQueue.js`.
- Colori solo dai token esistenti (`brand`, grigi del §6); niente palette nuove.
- Commit: file aggiunti **per nome**, mai `git add -A` / `git add .`. Nell'albero ci sono
  modifiche estranee (righello) che non vanno incluse.
- Ogni test nuovo va visto **fallire** rompendo apposta il codice che copre (CLAUDE.md §9).
- Limiti, identici fra client e server: descrizione **10–4.000** caratteri · **≤ 3**
  immagini · **≤ 1,5 MB** per immagine decodificata · tecnici **≤ 2.048** byte JSON ·
  **5** invii/ora per utente (solo server, best-effort).
- Destinatario predefinito `coaching@federicoleo.it`; mittente predefinito
  `FLEOFIT <onboarding@resend.dev>`.

## Punti da guardare in revisione
1. **Descrizione di soli spazi** («          »): deve contare come vuota. La validazione
   lavora sul testo `trim()`-ato, sia nel client sia nel server (test nel Task 1 e nel Task 4).
2. **Foglio chiuso a metà e riaperto**: la bozza riprende tipo, risposte e descrizione,
   ma le immagini no (non stanno in localStorage). Il riepilogo non deve dire «2 immagini»
   se non ce ne sono (test nel Task 2).
3. **Doppio tocco su «Invia»**: deve partire una sola richiesta. Il bottone è
   disabilitato mentre `inviando` (test nel Task 2).
4. **Caratteri HTML nella descrizione** (`<script>`, `&`): nella mail HTML vanno con
   l'escape (test nel Task 4 su `htmlSegnalazione`).
5. **Tasto indietro di Android a metà flusso**: torna al passo precedente e non chiude
   tutto, perché il bottone si chiama esattamente «Indietro» e al passo 1 «Chiudi»
   (test nel Task 2 sull'etichetta).

---

### Task 1: logica pura `segnalazione.js`

**File:**
- Crea: `src/lib/segnalazione.js`
- Test: `src/lib/__tests__/segnalazione.test.js`

**Interfacce prodotte:**
- `CHIAVE_BOZZA = 'fleofit_segnalazione_bozza'`
- `LIMITI = { descrizioneMin: 10, descrizioneMax: 4000, immaginiMax: 3, byteImmagineMax: 1_572_864, byteTecniciMax: 2048 }`
- `TIPI: Array<{ id, titolo, dettaglio, icona }>`, nell'ordine `bug, lenta, notifiche, timer, accesso, idea`.
  Titoli: «Qualcosa non funziona», «Si blocca o è lenta», «Notifiche», «Timer e
  allenamento», «Accesso e account», «Un'idea». `icona` è il nome di un'icona lucide
  (stringa), così il file resta senza React.
- `domandePer(tipo): Array<{ id, testo, opzioni: string[] }>`: 0–3 domande. `idea` → `[]`.
  Testi decisi qui. Per `notifiche` serve almeno
  `{ id: 'quando', testo: 'Cosa succede?', opzioni: ['Non arrivano mai', 'Arrivano in ritardo', 'Arrivano doppie'] }`.
  Per `timer`, `{ id: 'cosa', testo: 'Cosa succede?', opzioni: ['Si ferma', 'Il suono non parte', 'I tempi sono sbagliati'] }`.
  Per tutti tranne `idea`, l'ultima domanda è
  `{ id: 'frequenza', testo: 'Quanto spesso?', opzioni: ['Sempre', 'A volte', 'Una volta sola'] }`.
- `bozzaVuota(): { tipo: null, risposte: {}, descrizione: '' }`
- `validaSegnalazione({ tipo, descrizione, immagini }): { ok: boolean, errore: string|null }`:
  lavora sulla descrizione `trim()`-ata. Messaggi: «Scegli di cosa si tratta», «Scrivi
  almeno 10 caratteri», «Massimo 4.000 caratteri», «Massimo 3 immagini».
- `datiTecnici({ versione, piattaforma, userAgent, ruolo, online, inCoda, ora, lingua, fuso }): Array<{ etichetta, valore }>`:
  righe in quest'ordine, **senza** quelle a `null`/`undefined` (es. la versione sul web).
  Etichette: Versione, Piattaforma, Dispositivo, Ruolo, Rete («online»/«offline»),
  In coda offline, Data e ora (`d MMM yyyy, HH:mm`, locale `it`), Lingua, Fuso orario.
- `corpoRichiesta({ tipo, risposte, descrizione, tecnici, immagini }): object`: il body
  per `functions.invoke`, cioè
  `{ tipo, risposte: [{ domanda, risposta }], descrizione: trim, tecnici: { [etichetta]: valore }, immagini: [{ nome, base64 }] }`.
  Le risposte vengono convertite dagli id ai testi di `domandePer`.

- [ ] **Passo 1: scrivere i test che falliscono**, con almeno:
  - `TIPI.map(t => t.id)` uguale a `['bug','lenta','notifiche','timer','accesso','idea']`
  - `domandePer('idea')` → `[]`; `domandePer('notifiche')[0].opzioni` contiene `'Arrivano doppie'`
  - `validaSegnalazione({ tipo: 'bug', descrizione: '          ', immagini: [] }).errore === 'Scrivi almeno 10 caratteri'`
  - `validaSegnalazione({ tipo: null, … }).errore === 'Scegli di cosa si tratta'`
  - 4 immagini → `'Massimo 3 immagini'`; 4.001 caratteri → `'Massimo 4.000 caratteri'`
  - `datiTecnici({ versione: null, piattaforma: 'web', … })` non contiene l'etichetta `'Versione'`
  - `datiTecnici({ online: false, … })` contiene `{ etichetta: 'Rete', valore: 'offline' }`
  - `corpoRichiesta({ tipo: 'notifiche', risposte: { quando: 'Arrivano doppie' }, descrizione: '  x…  ', … })`
    → `risposte[0]` uguale a `{ domanda: 'Cosa succede?', risposta: 'Arrivano doppie' }`, descrizione rifilata
- [ ] **Passo 2:** `npx vitest run src/lib/__tests__/segnalazione.test.js` → FAIL (modulo mancante)
- [ ] **Passo 3: implementare** `src/lib/segnalazione.js` con le firme qui sopra
- [ ] **Passo 4:** stesso comando → PASS; poi rompere apposta `trim()` in `validaSegnalazione`
  e vedere fallire il test degli spazi; rimettere a posto
- [ ] **Passo 5: commit**
  ```bash
  git add src/lib/segnalazione.js src/lib/__tests__/segnalazione.test.js
  git commit -m "Segnalazioni: tipi, domande, validazione e dati tecnici"
  ```

### Task 2: il foglio `FoglioSegnalazione`

**File:**
- Crea: `src/components/FoglioSegnalazione.jsx`
- Crea: `src/lib/immagineRidotta.js` (`dimensioniRidotte(l, a, max = 1280): { larghezza, altezza }`
  pura, più `riduciImmagine(file): Promise<{ nome, base64 }>` con canvas e JPEG 0,7)
- Test: `src/components/__tests__/FoglioSegnalazione.test.jsx`,
  `src/lib/__tests__/immagineRidotta.test.js` (solo `dimensioniRidotte`)

**Interfacce:**
- Consuma: tutto il Task 1; `useBottomSheet(onChiudi)`; `leggiJson`/`scriviJson`.
- Produce: `<FoglioSegnalazione onChiudi onInvia notificheSpente onAttivaNotifiche tecnici />`
  - `onInvia(corpo) => Promise<void>`: risolve se va bene, rigetta con un `Error` se no
  - `notificheSpente: boolean`, `onAttivaNotifiche: () => void`
  - `tecnici: Array<{ etichetta, valore }>` (già calcolati da `Settings`)

Comportamento:
- Passo 1: le sei righe dei tipi; tocco → `vibraScelta`, tipo nella bozza, passo 2.
- Passo 2: le domande come gruppi di pillole (`role="radiogroup"`, ogni pillola
  `role="radio"` con `aria-checked`); `textarea` con contatore «n/4000»; bottone
  «Aggiungi screenshot» (`<input type="file" accept="image/*" multiple hidden>`),
  anteprime con una X `aria-label="Rimuovi immagine"`; con `notificheSpente &&
  tipo === 'notifiche'` un riquadro «Le notifiche su questo dispositivo sono spente» +
  bottone «Attivale». Bottone «Continua» disabilitato finché `validaSegnalazione` non è ok.
- Passo 3: riepilogo e `<details>` «Dati tecnici allegati» con le righe di `tecnici`;
  «Invia» (disabilitato mentre `inviando`). Successo → `vibraSuccesso`, bozza cancellata
  (`scriviJson(CHIAVE_BOZZA, null)` oppure `removeItem` in un try), schermata «Grazie,
  Federico la legge» con il bottone «Chiudi». Errore → `vibraErrore`, messaggio
  dell'errore, il bottone diventa «Riprova». Con `navigator.onLine === false` il bottone
  è disabilitato e dice «Sei offline — la bozza resta qui».
- Bottone in testata: «Chiudi» al passo 1 e dopo l'invio, «Indietro» ai passi 2 e 3.
- Bozza: letta all'apertura con `leggiJson(CHIAVE_BOZZA, bozzaVuota())`, scritta a ogni
  modifica di tipo, risposte o descrizione. Se la bozza ha un tipo, si riapre al passo 2.

- [ ] **Passo 1: scrivere i test che falliscono**
  - `dimensioniRidotte(4000, 3000)` → `{ larghezza: 1280, altezza: 960 }`; `dimensioniRidotte(800, 600)` invariato
  - tocco «Notifiche» → compare «Cosa succede?»; il bottone in testata si chiama «Indietro»
  - al passo 1 il bottone in testata si chiama «Chiudi»
  - «Continua» disabilitato con descrizione «   »; abilitato con 10+ caratteri
  - `notificheSpente` + tipo notifiche → «Attivale» chiama `onAttivaNotifiche`; con tipo `bug` il riquadro non c'è
  - doppio clic su «Invia» con `onInvia` che resta in attesa → `onInvia` chiamato **una** volta
  - `onInvia` rigetta con `new Error('Rete assente')` → si vedono «Rete assente» e «Riprova»; la bozza in localStorage è ancora lì
  - successo → «Grazie, Federico la legge», `localStorage` senza `fleofit_segnalazione_bozza`
  - bozza preesistente `{ tipo: 'timer', descrizione: 'si ferma al round 3', risposte: {} }` → si apre al passo 2 con il testo; il riepilogo **non** dice «immagini»
- [ ] **Passo 2:** `npx vitest run src/components/__tests__/FoglioSegnalazione.test.jsx src/lib/__tests__/immagineRidotta.test.js` → FAIL
- [ ] **Passo 3: implementare** il componente e `immagineRidotta.js` (stile di `FoglioCodici`:
  velo `bg-black/85 z-[100]`, foglio `bg-[#141416] rounded-t-3xl max-h-[85dvh]`, maniglia)
- [ ] **Passo 4:** stesso comando → PASS; rompere apposta la guardia `inviando` e vedere
  fallire il test del doppio clic; rimettere a posto
- [ ] **Passo 5: commit**
  ```bash
  git add src/components/FoglioSegnalazione.jsx src/lib/immagineRidotta.js src/components/__tests__/FoglioSegnalazione.test.jsx src/lib/__tests__/immagineRidotta.test.js
  git commit -m "Segnalazioni: il foglio a tre passi con bozza e screenshot"
  ```

### Task 3: collegamento in Impostazioni

**File:**
- Modifica: `src/pages/Settings.jsx` (stato `foglioSegnalazioneAperto`, `Sezione «Aiuto»`
  fra il blocco `role === 'admin'` e «Elimina il mio account», montaggio del foglio)
- Test: `src/pages/__tests__/Segnalazione.test.jsx` (stessi mock di `Impostazioni.test.jsx`)

**Interfacce:**
- Consuma: Task 1 (`datiTecnici`), Task 2 (`FoglioSegnalazione`).
- `onInvia = async (corpo) => { const { data, error } = await supabase.functions.invoke('segnalazione', { body: corpo }); if (error || data?.error) throw new Error(data?.error || 'Invio non riuscito. Riprova tra poco.') }`
- `tecnici = datiTecnici({ versione, piattaforma: Capacitor.getPlatform(), userAgent: navigator.userAgent, ruolo: etichettaRuolo(role, { anteprimaAtleta: isSimulatingAthlete }), online: navigator.onLine, inCoda: leggiCoda().length, ora: new Date(), lingua: navigator.language, fuso: Intl.DateTimeFormat().resolvedOptions().timeZone })`
- `notificheSpente = !notificationsEnabled`, `onAttivaNotifiche = toggleNotifiche`
- Riga: `RigaAzione icona={LifeBuoy} titolo="Segnala un problema" dettaglio="Arriva direttamente a Federico"`

- [ ] **Passo 1: scrivere i test che falliscono**
  - atleta e coach: la riga «Segnala un problema» c'è, dentro la sezione con `aria-label="Aiuto"`
  - flusso completo (Notifiche → risposta → descrizione → Continua → Invia) →
    `finto.supabase.functions.invoke` chiamato con `'segnalazione'` e un `body` con
    `tipo: 'notifiche'`, `descrizione` uguale al testo scritto e `tecnici.Ruolo` presente
  - `invoke` che risolve `{ data: { error: 'Troppe segnalazioni' } }` → si vede «Troppe segnalazioni»
  (Se `fintoSupabase` non espone `functions.invoke`, aggiungerlo lì come `vi.fn`
  sostituibile dal test, senza cambiare gli altri usi.)
- [ ] **Passo 2:** `npx vitest run src/pages/__tests__/Segnalazione.test.jsx` → FAIL
- [ ] **Passo 3: implementare** in `Settings.jsx`
- [ ] **Passo 4:** stesso comando → PASS; poi `npm test` completo → tutti verdi
  (erano 1160 più i nuovi); `npm run lint` → non oltre i 42 problemi attuali
- [ ] **Passo 5: commit**
  ```bash
  git add src/pages/Settings.jsx src/pages/__tests__/Segnalazione.test.jsx src/test/fintoSupabase.js
  git commit -m "Impostazioni: gruppo Aiuto con «Segnala un problema»"
  ```
  (`src/test/fintoSupabase.js` solo se è stato toccato.)

### Task 4: Edge Function `segnalazione`

**File:**
- Crea: `supabase/functions/segnalazione/regole.ts`: puro, senza import Deno o URL.
  Esporta `LIMITI` (stessi valori del Task 1), `TIPI_VALIDI`, `TITOLI_TIPO`,
  `validaCorpo(corpo): string | null` (messaggio d'errore o `null`),
  `oggettoSegnalazione(tipo, nome): string` → `[FLEOFIT] Notifiche · Sofia Rossi`,
  `testoSegnalazione(corpo, nome, email): string`,
  `htmlSegnalazione(corpo, nome, email): string` (con l'escape di `& < > " '`),
  `limitatore(max = 5, finestraMs = 3_600_000)` → `{ consenti(id, ora = Date.now()): boolean }`
- Crea: `supabase/functions/segnalazione/index.ts`: CORS come `ai-workout`; utente da
  `createClient(URL, ANON).auth.getUser(token)` (401 se manca); `validaCorpo` → 400;
  `limitatore.consenti(user.id)` → 429 «Troppe segnalazioni, riprova fra un'ora»; nome da
  `athletes` con il service role (ripiego sull'email); `fetch('https://api.resend.com/emails')`
  con `Authorization: Bearer ${RESEND_API_KEY}`, `from` (`SEGNALAZIONI_MITTENTE` o il
  predefinito), `to` (`SEGNALAZIONI_DESTINATARIO` o il predefinito), `reply_to` = email
  dell'utente, `subject`, `text`, `html`,
  `attachments: immagini.map(i => ({ filename: i.nome, content: i.base64 }))`.
  Se Resend risponde non-2xx → 502 `{ error: 'Invio non riuscito. Riprova tra poco.' }`
  e `console.error` con status e corpo. Senza `RESEND_API_KEY` → 500 con un `console.error` esplicito.
- Test: `src/lib/__tests__/segnalazioneServer.test.js` (importa
  `../../../supabase/functions/segnalazione/regole.ts`: Vitest compila il TS)

- [ ] **Passo 1: scrivere i test che falliscono**
  - `LIMITI` di `regole.ts` deep-equal `LIMITI` di `src/lib/segnalazione.js` (stessa idea di `colori.test.js`)
  - `TIPI_VALIDI` uguale a `TIPI.map(t => t.id)` del client
  - `validaCorpo({ tipo: 'bug', descrizione: '          ', immagini: [], tecnici: {} })` → non `null`
  - `validaCorpo` con `tipo: 'hack'` → non `null`; con un'immagine il cui base64 decodifica oltre 1,5 MB → non `null`
  - `oggettoSegnalazione('notifiche', 'Sofia Rossi') === '[FLEOFIT] Notifiche · Sofia Rossi'`
  - `htmlSegnalazione({ descrizione: '<script>&', … })` contiene `&lt;script&gt;&amp;` e non `<script>`
  - `limitatore(5)`: cinque `consenti('u')` true, il sesto false; con `ora` + 3.600.001 ms di nuovo true
- [ ] **Passo 2:** `npx vitest run src/lib/__tests__/segnalazioneServer.test.js` → FAIL
- [ ] **Passo 3: implementare** `regole.ts` e `index.ts`
- [ ] **Passo 4:** stesso comando → PASS; rompere apposta l'escape di `&` e vederlo fallire; rimettere a posto
- [ ] **Passo 5: commit**
  ```bash
  git add supabase/functions/segnalazione/regole.ts supabase/functions/segnalazione/index.ts src/lib/__tests__/segnalazioneServer.test.js
  git commit -m "Edge Function segnalazione: verifica l'utente e spedisce con Resend"
  ```
- [ ] **Passo 6: deploy, solo dopo che il committente ha creato la chiave e dato l'ok:**
  ```bash
  npx supabase secrets set RESEND_API_KEY=... --project-ref riyqtcssllupakjtoehj
  npx supabase functions deploy segnalazione --project-ref riyqtcssllupakjtoehj
  ```
  La chiave la scrive il committente, non chi esegue. Poi una segnalazione di prova
  dall'app → la mail arriva a `coaching@federicoleo.it`.

### Task 5: prova nell'ambiente demo e memoria

**File:**
- Modifica: `docs/memoria/impostazioni.md` (sezione nuova «Segnala un problema»: perché
  la mail la manda il server, perché niente tabella, limite best-effort, fase 2 rimandata)
- Modifica: `CLAUDE.md` §8, aggiungere `fleofit_segnalazione_bozza` all'elenco delle chiavi
  (è una regola che vale ovunque, quindi questa riga va proprio qui)
- Modifica: `BACKLOG.md` (voce «Segnalazioni fase 2: link Segnala negli avvisi d'errore»
  + «tabella dedicata dopo l'approvazione App Store, se servirà»)

- [ ] **Passo 1:** `npm run demo` (da `.claude/launch.json` con `preview_start`) →
  Impostazioni → Segnala un problema: percorrere i tre passi, verificare in console il log
  `[demo] Edge Function non chiamata: segnalazione` con il corpo atteso, e fare uno screenshot di ogni passo
- [ ] **Passo 2:** ridimensionare a `mobile` (375×812): nessuno scorrimento orizzontale,
  il foglio non finisce sotto la safe area
- [ ] **Passo 3:** scrivere le tre note di documentazione
- [ ] **Passo 4: commit**
  ```bash
  git add docs/memoria/impostazioni.md CLAUDE.md BACKLOG.md docs/superpowers/specs/2026-10-07-segnalazioni-design.md docs/superpowers/plans/2026-10-07-segnalazioni.md
  git commit -m "Segnalazioni: memoria, chiave localStorage e fase 2 nel backlog"
  ```
  ⚠️ `CLAUDE.md` ha già modifiche estranee non salvate (righello): prima del commit,
  `git diff CLAUDE.md`; se ci sono righe di altri lavori, mettere in stage solo la propria
  (patch con il solo blocco nuovo → `git apply --cached`), perché `git add -p` è
  interattivo e qui non si può usare.
- [ ] **Passo 5 (fuori da questo piano, a mano):** `npm run ios` / `npm run android` e una
  prova sul dispositivo dopo il deploy del Task 4.
