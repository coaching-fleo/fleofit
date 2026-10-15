# Messaggio a tutti — Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** il coach scrive un messaggio, tutti gli atleti ricevono una push e lo ritrovano in una bacheca «Dal coach» che lo conserva.

**Architecture:** una tabella additiva `messaggi_coach` (lettura a tutti gli autenticati, scrittura agli admin meno il demo). L'app salva il messaggio, poi chiama `send-reminders` con il modo nuovo `broadcast`, che scrive una riga in `notifications` per atleta e manda le push, saltando chi l'ha già ricevuta. La regola «fissati + dalla tua iscrizione» e l'ordine della bacheca sono logica pura in `src/lib/messaggiCoach.js`; quella del server in `supabase/functions/send-reminders/broadcast.ts`, testata da vitest come `estrai-note/regole.ts`.

**Tech Stack:** React 19, React Router 7, Tailwind 4, Supabase (Postgres + RLS + Edge Function Deno), vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-15-messaggio-a-tutti-design.md`

## Global Constraints

- 🔒 La tabella si applica **solo dopo un sì esplicito del committente** (CLAUDE.md §0-bis); la applica lui dal SQL editor. Senza quel sì ci si ferma alla fine del Task 1.
- Si lavora e si fa commit su `app`; **niente push** né `app:main` senza richiesta. Commit con i file per nome.
- Lista di scrittura della tabella = `ADMIN_EMAILS` **meno** `demo@fleofit.it`, in `USING` **e** `WITH CHECK`.
- `testo`: da 1 a 2.000 caratteri dopo `btrim`. Niente titolo.
- Titolo della notifica: `Messaggio dal coach`. `notifications.message` = **testo intero**; corpo della push = `anteprima(testo)` (≈120 caratteri, taglio su parola, `…`).
- `notifications.route` = `/messaggi?m=<id>`.
- Destinatari: `athletes` con `deleted_at` nullo, **compresi in pausa**, esclusi `COACHING_ID` e il mittente.
- Chiavi localStorage: `fleofit_messaggio_bozza`, `fleofit_messaggi_visto_fino`, sempre con `leggiJson`/`scriviJson` di `src/lib/offlineQueue.js`.
- Copy fisse: «Messaggio a tutti», «Dal coach», «Fissa in cima», «Arriverà a N atleti», «Mandare a N atleti? Ognuno riceverà una notifica.», «Il messaggio è in bacheca, ma la notifica non è partita», «Riprova», «Nell'account di prova i messaggi non partono», «Qui troverai i messaggi del coach», «modificato», «Sparirà dalla bacheca; chi ha già ricevuto la notifica la vede ancora».
- Modali con `createPortal`, conferme con `CustomConfirm`, mai `alert`/`confirm`. Foglio con `useBottomSheet`, X con `aria-label="Chiudi"`.
- Badge solo con `sincronizzaBadge`. Aggiornamenti ottimistici con rollback.
- Niente plugin nuovi; colori dai token (§6), nessun colore nuovo.
- Ogni test nuovo si vede fallire rompendo apposta il codice che copre.

## Review Focus

1. **Testo di soli spazi o a capo** → Invia disattivato; il database lo rifiuterebbe comunque (`btrim`). Test nel Task 6.
2. **Deep link a un messaggio eliminato** (`/messaggi?m=<id>` che non esiste più) → la pagina si apre normale, senza evidenza e senza errori. Test nel Task 5.
3. **`user.created_at` assente** (sessione vecchia, demo) → l'atleta vede **tutto**, non niente: nascondere per un dato mancante sarebbe peggio. Test nel Task 3.
4. **Atleta senza push registrata** → riceve comunque la riga in `notifications`. Test nel Task 2.
5. **Coach che simula l'atleta** (`adminRoleOverride = 'athlete'`) → vede la bacheca di sola lettura, senza bottone né menu. Test nel Task 5.

---

### Task 1: La tabella `messaggi_coach` (file SQL, poi STOP)

**Files:**
- Create: `supabase/schema/messaggi_coach_2026-10-15.sql`

**Interfaces:**
- Produces: tabella `public.messaggi_coach(id uuid, testo text, fissato boolean, autore uuid, creato_at timestamptz, modificato_at timestamptz)`.

- [ ] **Step 1: Scrivere il file** sul modello di `come_stai_2026-10-13.sql`: intestazione (data, sì del committente, additiva, perché la lista di scrittura esclude il demo), colonne e check della spec §1, indice `messaggi_coach_creato on (creato_at desc)`, RLS attiva, due policy:
  - `"messaggi_coach lettura"`: `for select to authenticated using (true)`;
  - `"messaggi_coach scrittura admin"`: `for all to authenticated`, `using` e `with check` = `(auth.jwt() ->> 'email') = any (array['coaching@federicoleo.it','alessandro.patrone@hotmail.it','federico_leo@hotmail.it','federico.leo88@gmail.com'])`.
  In coda, commentati: la query di verifica (`select policyname, cmd from pg_policies where tablename = 'messaggi_coach';` → due righe, SELECT e ALL) e il rollback (`drop table public.messaggi_coach;`).
- [ ] **Step 2: Commit**
```bash
git add supabase/schema/messaggi_coach_2026-10-15.sql
git commit -m "Messaggio a tutti: la tabella, in attesa del sì"
```
- [ ] **Step 3: 🛑 FERMARSI.** Chiedere al committente il sì esplicito e che applichi il file. Dopo, verificare con `supabase db query --linked "select policyname, cmd from pg_policies where tablename = 'messaggi_coach'"` → due righe. I Task 2–4 si possono scrivere e testare intanto (non toccano il database vero); il Task 2 Step 6 (deploy) e ogni prova reale aspettano.

---

### Task 2: Il modo `broadcast` in `send-reminders`

**Files:**
- Create: `supabase/functions/send-reminders/broadcast.ts`
- Modify: `supabase/functions/send-reminders/index.ts` (lista `soloAdmin`, nuovo blocco `if (mode === 'broadcast')` prima di `immediate`)
- Test: `src/lib/__tests__/broadcastServer.test.js`

**Interfaces:**
- Consumes: `isAdminEmail` da `../_shared/admin.ts`.
- Produces (da `broadcast.ts`, puro, senza Deno):
  - `TITOLO_BROADCAST = 'Messaggio dal coach'`
  - `EMAIL_DEMO = 'demo@fleofit.it'`
  - `puoInviareBroadcast(email: string | null): boolean` — admin e non demo
  - `anteprima(testo: string, max = 120): string` — spazi compressi; se più lungo di `max`, tagliato all'ultimo spazio entro `max` più `…`
  - `routeMessaggio(id: string): string` → `/messaggi?m=<id>`
  - `destinatariBroadcast(atleti: {id, deleted_at}[], opz: { mittenteId: string, coachingId: string, giaNotificati: string[] }): string[]` — id degli atleti
  - Risposta della funzione: `{ success: true, sent: number, saltati: number }`; 403 `{ error: 'Non autorizzato' }`; 404 `{ error: 'Messaggio non trovato' }`.

- [ ] **Step 1: Test che falliscono**, in `broadcastServer.test.js`:
  - `puoInviareBroadcast`: `true` per `'coaching@federicoleo.it'` e `' Federico.Leo88@gmail.com '`; `false` per `'demo@fleofit.it'`, `'atleta@x.it'`, `null`.
  - `anteprima('Ciao a tutti')` → `'Ciao a tutti'`; un testo di 300 caratteri con parole → lunghezza ≤ 121, finisce con `'…'`, non spezza una parola; `'riga uno\n\nriga  due'` → `'riga uno riga due'`.
  - `routeMessaggio('abc')` → `'/messaggi?m=abc'`.
  - `destinatariBroadcast` con atleti `a1` (attivo), `a2` (`deleted_at: 1700000000000`), `COACHING_ID`, `m1` (mittente), `a3` (già notificato), `a4` (attivo, in pausa: nessun campo diverso) → `['a1','a4']`.
- [ ] **Step 2: Eseguire** `npx vitest run src/lib/__tests__/broadcastServer.test.js` → FAIL (modulo mancante).
- [ ] **Step 3: Scrivere `broadcast.ts`** con le firme sopra.
- [ ] **Step 4: Eseguire** lo stesso comando → PASS. Rompere `puoInviareBroadcast` (togliere il controllo sul demo) e vedere fallire; ripristinare.
- [ ] **Step 5: Il blocco in `index.ts`.** Aggiungere `'broadcast'` a `soloAdmin`; prima del controllo generico, se `mode === 'broadcast' && !puoInviareBroadcast(chiamante.email)` → 403. Il blocco:
  1. legge `messaggi_coach` per `body.record_id` con `maybeSingle()`; assente → 404;
  2. legge `athletes` (`id, deleted_at`) e le `notifications` con `route = routeMessaggio(id)` (`user_id`);
  3. `destinatariBroadcast(…, { mittenteId: autore del messaggio, coachingId: '0118e43f-8791-4fd6-8032-bee028334c99', giaNotificati })`; nessuno → `{ success: true, sent: 0, saltati: n }`;
  4. un solo `insert` in `notifications` (`title: TITOLO_BROADCAST`, `message: testo intero`, `route`) con `.select()`;
  5. `push_subscriptions` con `.in('user_id', destinatari)`; per ogni subscription `sendPush(sub, TITOLO_BROADCAST, anteprima(testo), route, idNotificaDiQuelUtente)`; `Promise.all`;
  6. risposta `{ success: true, sent, saltati }`.
  Un atleta senza subscription ha comunque la sua riga (Review Focus 4): il punto 4 non dipende dal punto 5.
- [ ] **Step 6: Deploy, solo dopo il sì del Task 1 e con conferma del committente** (colpisce anche il sito e i cron): `supabase functions deploy send-reminders`. Il mattino dopo controllare nei log che `morning` sia andato come sempre.
- [ ] **Step 7: Commit**
```bash
git add supabase/functions/send-reminders/broadcast.ts supabase/functions/send-reminders/index.ts src/lib/__tests__/broadcastServer.test.js
git commit -m "send-reminders: il modo broadcast, senza doppioni e chiuso al demo"
```

---

### Task 3: La logica della bacheca

**Files:**
- Create: `src/lib/messaggiCoach.js`
- Test: `src/lib/__tests__/messaggiCoach.test.js`

**Interfaces:**
- Consumes: `anteprima`, `routeMessaggio`, `puoInviareBroadcast` da `../../supabase/functions/send-reminders/broadcast.ts` (riesportati: una definizione sola).
- Produces:
  - `CHIAVE_BOZZA = 'fleofit_messaggio_bozza'`, `CHIAVE_VISTO = 'fleofit_messaggi_visto_fino'`, `MAX_CARATTERI = 2000`
  - `visibiliPer(messaggi, { iscrittoIl: string | null, coach: boolean }): Messaggio[]`
  - `ordina(messaggi): Messaggio[]` — fissati prima, ognuno dei due gruppi dal `creato_at` più recente; non muta l'input
  - `daMostrareInHome(messaggi, vistoFino: string | null): Messaggio | null` — il più recente con `creato_at > vistoFino` (tutti se `null`)
  - `testoValido(testo: string): boolean` — `trim()` lungo da 1 a `MAX_CARATTERI`
  - `Messaggio = { id, testo, fissato, autore, creato_at, modificato_at }`

- [ ] **Step 1: Test che falliscono:**
  - `visibiliPer`: con `iscrittoIl: '2026-10-01T10:00:00Z'` un messaggio vecchio non fissato è escluso, uno vecchio fissato e uno nuovo inclusi; `coach: true` → tutti; `iscrittoIl: null` → tutti (Review Focus 3).
  - `ordina`: `[nuovo, vecchioFissato, medio, nuovoFissato]` → `[nuovoFissato, vecchioFissato, nuovo, medio]`; l'array originale resta uguale.
  - `daMostrareInHome`: `[]` → `null`; `vistoFino` uguale al più recente → `null`; più vecchio → il più recente; `null` → il più recente. Un fissato vecchio già visto non ricompare.
  - `testoValido`: `''`, `'   \n  '` → `false` (Review Focus 1); `'Ciao'` → `true`; 2.000 caratteri → `true`; 2.001 → `false`.
- [ ] **Step 2: Eseguire** `npx vitest run src/lib/__tests__/messaggiCoach.test.js` → FAIL.
- [ ] **Step 3: Scrivere `messaggiCoach.js`.** Confronti di date con `new Date(x).getTime()`, mai fra stringhe (i formati di Supabase e di `auth` differiscono).
- [ ] **Step 4: Eseguire** → PASS. Rompere la clausola `fissato ||` e vedere fallire; ripristinare.
- [ ] **Step 5: Commit**
```bash
git add src/lib/messaggiCoach.js src/lib/__tests__/messaggiCoach.test.js
git commit -m "Messaggio a tutti: chi vede cosa, e in che ordine"
```

---

### Task 4: La presentazione

**Files:**
- Create: `src/components/MessaggiUI.jsx` (sola presentazione, come gli altri `*UI.jsx`)
- Test: `src/components/__tests__/MessaggiUI.test.jsx`

**Interfaces:**
- Consumes: `anteprima` (Task 3); le date con `date-fns` e il locale `it`.
- Produces:
  - `RigaMessaggio({ messaggio, evidenziato, coach, onMenu })` — testo con a capo preservati (`whitespace-pre-line`), data `d MMM · HH:mm`, «modificato» se `modificato_at`, puntina (`Pin` di lucide) se fissato, bottone menu (`aria-label="Azioni messaggio"`) solo se `coach`; `id={'messaggio-' + id}`
  - `ListaMessaggi({ messaggi, evidenziatoId, coach, onMenu })` — già ordinati dal chiamante; vuota → «Qui troverai i messaggi del coach» con l'empty state del §6
  - `CardDalCoach({ messaggio, onApri })` — card di Home: etichetta «Dal coach», `anteprima(testo)`, tocco → `onApri`

- [ ] **Step 1: Test che falliscono:** `ListaMessaggi` vuota mostra la frase dell'empty state; un fissato mostra la puntina; `coach: false` → nessun bottone «Azioni messaggio»; `coach: true` → c'è; `modificato_at` → «modificato»; `CardDalCoach` mostra al massimo l'anteprima e chiama `onApri` al tocco.
- [ ] **Step 2: Eseguire** `npx vitest run src/components/__tests__/MessaggiUI.test.jsx` → FAIL.
- [ ] **Step 3: Scrivere i tre componenti.** Card con il pattern del §6 (`bg-[#1e1e1e] border border-[#2a2a2a] rounded-3xl`), puntina e accento in `brand`.
- [ ] **Step 4: Eseguire** → PASS; rompere la condizione `coach` e vedere fallire.
- [ ] **Step 5: Commit**
```bash
git add src/components/MessaggiUI.jsx src/components/__tests__/MessaggiUI.test.jsx
git commit -m "Messaggio a tutti: righe, lista e card"
```

---

### Task 5: La pagina `/messaggi` (lettura, deep link, notifiche lette)

**Files:**
- Create: `src/pages/Messaggi.jsx`
- Modify: `src/App.jsx` (`const Messaggi = lazy(() => import('./pages/Messaggi'))`, `<Route path="/messaggi" element={<Messaggi />} />` dentro `ProtectedRoute`)
- Test: `src/pages/__tests__/Messaggi.test.jsx`

**Interfaces:**
- Consumes: `visibiliPer`, `ordina`, `CHIAVE_VISTO` (Task 3); `ListaMessaggi` (Task 4); `useAuth()` → `{ user, role }`; `sincronizzaBadge(conteggio, userId, supabase)`; `scriviJson`.
- Produces: la rotta `/messaggi`, con `?m=<id>` opzionale. Il Task 6 aggiunge alla stessa pagina il ramo coach.

- [ ] **Step 1: Test che falliscono** (`montaPagina` + `fintoSupabase`):
  - atleta con `user.created_at` = 1 ottobre: vede il fissato vecchio e il nuovo, non l'avviso vecchio; nessun bottone «Messaggio a tutti» né «Azioni messaggio»;
  - `role: 'athlete'` con l'email di un admin (simulazione) → stessa vista dell'atleta (Review Focus 5);
  - all'apertura c'è un `update` su `notifications` con `is_read: true` e filtro `route` che comincia per `/messaggi` (`.like('route', '/messaggi%')`), e `CHIAVE_VISTO` vale il `creato_at` del più recente;
  - `percorso: '/messaggi?m=x9'` con `x9` inesistente → la lista c'è, nessun elemento evidenziato, nessun errore in console (Review Focus 2);
  - `?m=<esistente>` → quella riga ha l'evidenza (`data-evidenziato="true"`).
- [ ] **Step 2: Eseguire** `npx vitest run src/pages/__tests__/Messaggi.test.jsx` → FAIL.
- [ ] **Step 3: Scrivere `Messaggi.jsx`.** Testata con safe area e titolo «Dal coach», contenitore `.cascata`, fondo `pb-[var(--fondo-pagina)]`. Carica `messaggi_coach` (`order('creato_at', { ascending: false })`), poi `ordina(visibiliPer(…, { iscrittoIl: user.created_at ?? null, coach: role !== 'athlete' }))`. Con `?m=` scorre alla riga (`scrollIntoView({ block: 'center' })`) e la evidenzia per 2 secondi. Segna lette le notifiche, poi conta le non lette e chiama `sincronizzaBadge`.
- [ ] **Step 4: Eseguire** → PASS; rompere il `like` e vedere fallire.
- [ ] **Step 5: Commit**
```bash
git add src/pages/Messaggi.jsx src/App.jsx src/pages/__tests__/Messaggi.test.jsx
git commit -m "Messaggio a tutti: la bacheca «Dal coach»"
```

---

### Task 6: Il coach scrive, invia e gestisce

**Files:**
- Create: `src/components/FoglioMessaggio.jsx`
- Modify: `src/pages/Messaggi.jsx` (bottone «Messaggio a tutti» e menu, solo per il coach)
- Test: `src/pages/__tests__/MessaggiCoach.test.jsx`

**Interfaces:**
- Consumes: `testoValido`, `MAX_CARATTERI`, `CHIAVE_BOZZA`, `puoInviareBroadcast` (Task 3); `useBottomSheet`; `CustomConfirm`; `leggiJson`/`scriviJson`; `COACHING_ID`.
- Produces:
  - `FoglioMessaggio({ aperto, onChiudi, numeroAtleti, demo, iniziale, onInviato })` — `iniziale` = messaggio da modificare (allora niente push e niente bozza)
  - In `Messaggi.jsx`, `?scrivi=1` apre il foglio all'arrivo (lo usa il Task 7).

- [ ] **Step 1: Test che falliscono** (`role: 'admin'`):
  - «Arriverà a N atleti» conta solo gli atleti attivi senza `COACHING_ID`, compresi quelli in pausa;
  - testo vuoto o di soli spazi → Invia disattivato; 2.001 caratteri → contatore in errore e Invia disattivato;
  - Invia → `CustomConfirm` con «Mandare a 2 atleti? Ognuno riceverà una notifica.»; conferma → `insert` in `messaggi_coach` con `{ testo, fissato }`, poi `functions.invoke('send-reminders', { body: { mode: 'broadcast', record_id } })`, la bozza cancellata;
  - `invoke` che restituisce `error` → «Il messaggio è in bacheca, ma la notifica non è partita» e «Riprova»; Riprova richiama `invoke` con lo **stesso** `record_id` e nessun nuovo `insert`;
  - utente `demo@fleofit.it` → Invia disattivato e la scritta «Nell'account di prova i messaggi non partono», nessun `insert`;
  - chiudere il foglio con del testo e riaprirlo → il testo è ancora lì (`CHIAVE_BOZZA`);
  - menu: «Fissa» fa `update({ fissato: true })` e la riga sale in cima subito (ottimistico); con `messaggi_coach` in errore torna giù; «Modifica» fa `update({ testo, modificato_at })` **senza** `invoke`; «Elimina» chiede conferma con «Sparirà dalla bacheca; chi ha già ricevuto la notifica la vede ancora» e poi `delete`.
- [ ] **Step 2: Eseguire** `npx vitest run src/pages/__tests__/MessaggiCoach.test.jsx` → FAIL.
- [ ] **Step 3: Scrivere `FoglioMessaggio.jsx`** (bottom sheet via `createPortal`, `rounded-t-3xl`, maniglia, X `aria-label="Chiudi"`, interruttore «Fissa in cima», CTA primaria del §6) e il ramo coach di `Messaggi.jsx` (numero atleti da `athletes`, menu con le tre azioni, ottimismo con rollback). Il blocco del demo si decide con `puoInviareBroadcast(user.email)`.
- [ ] **Step 4: Eseguire** → PASS; rompere il blocco del demo e il «niente invoke in modifica», vedere fallire ciascuno.
- [ ] **Step 5: Commit**
```bash
git add src/components/FoglioMessaggio.jsx src/pages/Messaggi.jsx src/pages/__tests__/MessaggiCoach.test.jsx
git commit -m "Messaggio a tutti: il coach scrive, invia, fissa, corregge"
```

---

### Task 7: Le entrate (Home atleta, Home coach, desktop)

**Files:**
- Modify: `src/pages/Home.jsx` (ramo atleta: carica i messaggi, mostra `CardDalCoach` sotto `HeroOggi`; ramo coach: passa `onMessaggio`)
- Modify: `src/components/HomeCoachTelefono.jsx` (una `RigaDestinazione` «Messaggio a tutti» prima di Report e Archivio, icona `Megaphone`)
- Modify: `src/components/HomeCoachDesktop.jsx` (lo stesso)
- Modify: `src/components/BarraLaterale.jsx` (voce `{ a: '/messaggi', icona: Megaphone, etichetta: 'Messaggi' }` dopo Archivio)
- Test: `src/pages/__tests__/HomeMessaggi.test.jsx`

**Interfaces:**
- Consumes: `visibiliPer`, `daMostrareInHome`, `CHIAVE_VISTO` (Task 3); `CardDalCoach` (Task 4); la rotta `/messaggi` e `?scrivi=1` (Task 5–6).
- Produces: `onMessaggio: () => void` fra le prop di `HomeCoachTelefono` e `HomeCoachDesktop`, che fa `navigate('/messaggi?scrivi=1')`.

- [ ] **Step 1: Test che falliscono:** atleta con un messaggio non visto → «Dal coach» in Home e il tocco porta a `/messaggi`; con `CHIAVE_VISTO` uguale al più recente → nessuna card; senza messaggi → nessuna card e nessuno spazio vuoto; un avviso precedente all'iscrizione non fa comparire la card. Coach (`HomeCoach.test.jsx` come modello) → c'è «Messaggio a tutti».
- [ ] **Step 2: Eseguire** `npx vitest run src/pages/__tests__/HomeMessaggi.test.jsx` → FAIL.
- [ ] **Step 3: Collegare.** In Home la lettura dei messaggi va **fuori** dal percorso critico del primo caricamento (dopo i workout, come le notifiche) e un suo errore non tocca il resto della pagina. Nessun import pesante in `Home.jsx`: `MessaggiUI` è piccolo, ma controllare che `index` resti intorno ai 594 KB (`npm run build`).
- [ ] **Step 4: Eseguire** il test → PASS, poi `npm test` intero (base: 1748 test più i nuovi, tutti verdi) e `npx eslint src` (nessun problema nuovo rispetto ai 26).
- [ ] **Step 5: Commit**
```bash
git add src/pages/Home.jsx src/components/HomeCoachTelefono.jsx src/components/HomeCoachDesktop.jsx src/components/BarraLaterale.jsx src/pages/__tests__/HomeMessaggi.test.jsx
git commit -m "Messaggio a tutti: le entrate in Home e sul desktop"
```

---

### Task 8: Ambiente di prova, backup e memoria

**Files:**
- Modify: `src/demoSemi.js` (`messaggi_coach` in `semi()`, `VERSIONE_SEME` 10 → 11)
- Modify: `src/supabaseDemo.js` (`created_at` su `UTENTE` se manca; `invoke('send-reminders')` con `mode: 'broadcast'` → `{ data: { success: true, sent: <atleti>, saltati: 0 }, error: null }`)
- Modify: `.github/workflows/db-backup.yml` (`messaggi_coach` in `TABLES`)
- Create: `docs/memoria/messaggi.md`
- Modify: `CLAUDE.md` (§4 una riga, §8 le due chiavi, §11 la riga dell'indice), `docs/memoria/database.md` (tabella, policy con la lista senza demo, modo `broadcast`), `DEVLOG.md` (novità 1.2.2), `BACKLOG.md`
- Test: `src/__tests__/demoMessaggi.test.js`

- [ ] **Step 1: Test che fallisce:** i semi contengono quattro messaggi, uno fissato e uno con `creato_at` precedente al `created_at` dell'utente demo, e `visibiliPer` sui semi ne lascia tre.
- [ ] **Step 2: Eseguire** `npx vitest run src/__tests__/demoMessaggi.test.js` → FAIL; scrivere i semi con date relative a oggi; → PASS.
- [ ] **Step 3: Backup e documentazione.** `docs/memoria/messaggi.md`: perché bacheca e non solo notifica, la regola dell'iscrizione (ordine, non segretezza), il demo escluso dalla scrittura, il testo intero nelle notifiche e la conseguenza sull'eliminazione, le versioni vecchie. Aggiornare la memoria `chat-e-broadcast` (resta aperta la chat col singolo atleta).
- [ ] **Step 4: Verifica finale:** `npm test`, `npx eslint src`, `npm run build` (pesi del §2), `npm run demo` e `npm run demo:atleta` aperti nel browser: bacheca, card, foglio, Invia nel demo.
- [ ] **Step 5: Commit**
```bash
git add src/demoSemi.js src/supabaseDemo.js src/__tests__/demoMessaggi.test.js .github/workflows/db-backup.yml docs/memoria/messaggi.md docs/memoria/database.md CLAUDE.md DEVLOG.md BACKLOG.md
git commit -m "Messaggio a tutti: ambiente di prova, backup e memoria"
```
- [ ] **Step 6: Prove sul telefono, del committente**: push vera su iOS e Android, tocco sulla notifica → messaggio evidenziato, badge che torna a zero aprendo la bacheca, foglio chiuso col tasto indietro su Android.
