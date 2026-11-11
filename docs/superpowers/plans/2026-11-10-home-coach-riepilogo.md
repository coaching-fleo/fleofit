# Home coach «Riepilogo» (B3) — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** sostituire il corpo della Home coach (telefono e desktop) con la «Riepilogo» della proposta B3 — numeri che aprono liste — lasciando la Home di oggi dietro l'interruttore «Home classica».

**Architecture:** i conti nuovi sono funzioni pure in `src/lib/riepilogoCoach.js`, sopra i dati che `useCruscottoCoach` e `statisticheCoach` già producono. La presentazione sta in `RiepilogoCoachUI.jsx` (pezzi) e `FoglioListaCoach.jsx` (il foglio con ricerca e filtri), montati da due disposizioni pigre `HomeRiepilogoTelefono` / `HomeRiepilogoDesktop`. `Home.jsx` sceglie fra classica e Riepilogo con `src/lib/homeClassica.js`.

**Tech Stack:** React 19, Tailwind 4 (token in `src/index.css`), lucide-react, date-fns `it`, Vitest + Testing Library (`src/test/montaPagina.jsx`, `src/test/fintoSupabase.js`).

**Spec:** `docs/superpowers/specs/2026-11-10-home-coach-riepilogo-design.md`

## Global Constraints

- Nessuna modifica al database, nessuna lettura nuova: solo i dati che `Home.jsx` carica già.
- Chi è in pausa è fuori da ogni conto e lista (lo garantiscono `atletiSeguiti` / `pianoGiorni` / `statisticheCoach`: non ricontare a mano).
- In pagina mai uno «0»: al suo posto ✓ verde (contatori, card affiancate, giorni). Mai inventare un numero: dato assente = «—».
- Frasi semplici e sugli allenamenti, non sulla persona (`docs/memoria/home-coach.md`, trappola 7).
- La tab bar non cambia. «Analisi» compare solo nella disposizione desktop.
- Palette invariata: `bg-brand`, `running`, `gym`, `custom`, superfici `#1e1e1e`/`#161618`/`#2a2a2a` (CLAUDE.md §6). Le categorie si colorano con `corsia()` di `src/lib/categorie.js`.
- Ogni modale/foglio con `createPortal(…, document.body)`; la X ha `aria-label="Chiudi"` (tasto indietro Android, `src/lib/indietroAndroid.js`).
- `useCruscottoCoach` e tutto `RiepilogoCoachUI`/`FoglioListaCoach` si importano **solo** dai chunk pigri `HomeRiepilogo*`, mai da `Home.jsx` (peso di `index`, CLAUDE.md §2).
- localStorage solo con `leggiJson`/`scriviJson` di `src/lib/offlineQueue.js`.
- Aptica solo dai verbi di `src/lib/aptica.js` (`battito` all'apertura di un foglio).
- Ogni test nuovo si vede fallire rompendo apposta il codice che copre (CLAUDE.md §9).
- **Niente commit e niente push**: il committente salva con la sua fascia. Le modifiche restano nel working tree.

## Review Focus

1. **Liste lunghe (centinaia di righe)**: il foglio mostra 60 righe e «Mostra altri», la fila di oggi 20 card e poi altre 20 scorrendo; nessuna persona resta irraggiungibile → test nel Task 3 e Task 4.
2. **Ricerca con accenti e maiuscole** («nicolo» trova «Nicolò», «MARCO» trova «Marco») → test nel Task 1 (`filtraPerNome`).
3. **Giornata vuota** (nessuno assegnato oggi, nessun feedback, tutti programmati): niente «0 di 0», niente barra vuota; card gialla dice «Nessun allenamento oggi», contatori ✓ → test nel Task 4.
4. **Giorno con solo una gara (Event)**: conta come programmato, non come buco → test nel Task 1 (`giorniDaProgrammare`).
5. **Interruttore spento/acceso e cambio di ruolo**: l'atleta non scarica né vede nessuna delle due Home coach; con «Home classica» accesa torna il cruscotto di oggi → test nel Task 6.

---

### Task 1: i conti della Riepilogo

**Files:**
- Create: `src/lib/riepilogoCoach.js`
- Test: `src/lib/__tests__/riepilogoCoach.test.js`

**Interfaces:**
- Consumes: righe di `oggiConComeSta` (`{ id, nome, foto, workoutId, titolo, categoria, stato: 'completato'|'in corso'|'da fare', rpe, intensita, allarme, avviso, motivi }`); `piano` di `pianoGiorni` (`{ giorni: [{data, etichetta, oggi}], righe: [{id, nome, foto, celle: [{data, quando: 'passato'|'oggi'|'futuro', chips: [{categoria, workoutId, completato, titolo}]}]}] }`).
- Produces:
  - `CATEGORIE_RIEPILOGO = ['Hyrox', 'Running', 'Gym', 'Custom']`
  - `oggiPerStato(righe) → { daFare, inCorso, fatti, totale }`
  - `oggiPerCategoria(righe) → Array<[categoria, n]>` nell'ordine di `CATEGORIE_RIEPILOGO`, solo `n > 0`, `Event` escluso
  - `ordinaOggi(righe) → righe` nuova lista: `allarme` prima, poi `in corso`, `da fare`, `completato`; a parità per `nome` (`localeCompare`)
  - `giorniDaProgrammare(piano) → Array<{ data, etichetta, oggi, programmati: riga[], daProgrammare: riga[], perCategoria: Array<[categoria, n]> }>` — `programmati` = righe con almeno una chip in quella cella (anche solo `Event`); `daProgrammare` = righe con cella vuota **e** `quando === 'futuro'` (oggi e passato mai «da programmare»); `perCategoria` conta le chip per categoria incluso `Event`, solo `n > 0`
  - `scopertiTreGiorni(piano, { giorni = 3 } = {}) → Array<riga & { primoScoperto: 'yyyy-MM-dd', scoperti: string[] }>` — celle con indice 1…`giorni` (oggi escluso) vuote e future
  - `filtraPerNome(persone, testo) → persone` — confronto su `p.nome` senza accenti (`normalize('NFD')` + rimozione diacritici) e senza maiuscole; testo vuoto/spazi = tutti

- [ ] **Step 1: scrivere i test**

`describe('riepilogoCoach')` con almeno:
  - `oggiPerStato` su 2 completati, 1 in corso, 3 da fare → `{ daFare: 3, inCorso: 1, fatti: 2, totale: 6 }`; su `[]` → tutti 0.
  - `oggiPerCategoria` con Hyrox×2, Running×1, Event×1 → `[['Hyrox', 2], ['Running', 1]]`.
  - `ordinaOggi`: `[{nome:'Bea',stato:'completato'},{nome:'Ada',stato:'da fare'},{nome:'Cia',stato:'da fare',allarme:true},{nome:'Dan',stato:'in corso'}]` → nomi `['Cia','Dan','Ada','Bea']`; l'array di partenza non cambia.
  - `giorniDaProgrammare` su un piano di 3 giorni (oggi + 2), 3 atleti: cella futura vuota → in `daProgrammare`; cella di oggi vuota → in nessuna delle due liste; cella futura con sola chip `Event` → in `programmati` e `perCategoria` contiene `['Event', 1]`.
  - `scopertiTreGiorni`: atleta vuoto il 2° e 3° giorno → `primoScoperto` = data del 2° giorno, `scoperti` lunghi 2; atleta coperto domani, dopodomani e il giorno dopo → escluso; cella di oggi vuota non conta.
  - `filtraPerNome([{nome:'Nicolò Rossi'},{nome:'Marco Bianchi'}], 'nicolo')` → solo Nicolò; `'MARCO'` → solo Marco; `'  '` → entrambi.

- [ ] **Step 2: eseguirli e vederli fallire**

Run: `npx vitest run src/lib/__tests__/riepilogoCoach.test.js`
Expected: FAIL, modulo `../riepilogoCoach` non trovato.

- [ ] **Step 3: implementare `src/lib/riepilogoCoach.js`** con le firme sopra. Funzioni pure, nessun import da React; commento in testa che rimanda alla spec.

- [ ] **Step 4: eseguirli e vederli passare**, poi rompere apposta una riga per funzione (es. togliere il filtro `quando === 'futuro'`, togliere la normalizzazione degli accenti) e vedere fallire il test corrispondente; ripristinare.

Run: `npx vitest run src/lib/__tests__/riepilogoCoach.test.js` → PASS.

---

### Task 2: l'interruttore «Home classica»

**Files:**
- Create: `src/lib/homeClassica.js`
- Test: `src/lib/__tests__/homeClassica.test.js`
- Modify: `src/pages/Settings.jsx` (sezione dello staff, vicino a «Anteprima come atleta» / `adminRoleOverride`)
- Modify: `CLAUDE.md` §8 (elenco chiavi localStorage)

**Interfaces:**
- Produces: `CHIAVE_HOME_CLASSICA = 'fleofit_home_classica'`, `leggiHomeClassica(storage = globalThis.localStorage) → boolean` (assente, rotto o non booleano = `false`), `scriviHomeClassica(valore: boolean, storage = globalThis.localStorage) → void`.

- [ ] **Step 1: test** — assente → `false`; dopo `scriviHomeClassica(true)` → `true`; valore `'"si"'` salvato a mano → `false`; storage che lancia su `getItem` → `false` senza eccezioni.
- [ ] **Step 2: vederli fallire** — `npx vitest run src/lib/__tests__/homeClassica.test.js` → FAIL.
- [ ] **Step 3: implementare** con `leggiJson`/`scriviJson`.
- [ ] **Step 4: vederli passare**, rompere (`return true` fisso) e vederli fallire, ripristinare.
- [ ] **Step 5: riga in Impostazioni** — `RigaInterruttore` (da `ImpostazioniUI.jsx`) visibile solo se `role !== 'athlete'`: `titolo="Home classica"`, `dettaglio="La Home coach di prima, con le persone in elenco. Vale su questo dispositivo."`, stato iniziale da `leggiHomeClassica()`, `onCambia` → `scriviHomeClassica(v)` + aggiorna lo stato locale.
- [ ] **Step 6: test di pagina** in `src/pages/__tests__/Impostazioni.test.jsx`: da coach il `role="switch"` «Home classica» c'è e il tocco scrive `true` in `localStorage.fleofit_home_classica`; da atleta non c'è. Vederlo fallire togliendo la guardia di ruolo.
- [ ] **Step 7:** aggiungere `fleofit_home_classica` (true = Home coach di prima su questo dispositivo, `src/lib/homeClassica.js`) all'elenco del §8 di `CLAUDE.md`.

---

### Task 3: il foglio con la lista

**Files:**
- Create: `src/components/FoglioListaCoach.jsx`
- Test: `src/components/__tests__/FoglioListaCoach.test.jsx` (o `src/__tests__/` se la cartella componenti non ha test: seguire dove stanno gli altri test dei componenti)

**Interfaces:**
- Consumes: `filtraPerNome` (Task 1), `useBottomSheet` (`src/useBottomSheet.js`), `battito` (`src/lib/aptica.js`), `corsia` (`src/lib/categorie.js`).
- Produces: `export const BLOCCO_LISTA = 60` e `export default function FoglioListaCoach({ titolo, persone, filtri = [], filtroIniziale = 0, laterale = false, onScegli, onChiudi })`
  - `persone`: `Array<{ chiave: string, nome: string, foto?: string|null, sotto: string, categoria?: string, pillola?: { testo: string, tono: 'ok'|'vivo'|'neutro' } }>`
  - `filtri`: `Array<{ etichetta: string, prova: ((p) => boolean) | null }>` — `null` = tutti; ogni pillola mostra il proprio conteggio
  - `laterale`: false = foglio dal basso (telefono), true = pannello a destra largo 440px a tutta altezza (desktop)
  - `onScegli(persona)` al tocco di una riga; `onChiudi()` da X, velo, trascinamento

- [ ] **Step 1: test** (render diretto, niente pagina):
  - con 150 persone: si vedono 60 righe e il bottone «Mostra altri 60 di 90»; dopo il tocco 120; dopo il secondo 150 e il bottone sparisce.
  - scrivendo «nicolo» nel campo «Cerca per nome» resta solo «Nicolò …» e il sottotitolo dice «1 atleta per «nicolo»».
  - con filtri `[{etichetta:'Tutti',prova:null},{etichetta:'Fatto',prova:p=>p.categoria==='Hyrox'}]` le pillole mostrano i conteggi; il tocco sulla seconda restringe la lista.
  - ricerca senza risultati → testo «Nessuno con questo nome.»
  - il tocco su una riga chiama `onScegli` con quella persona; il bottone con `aria-label="Chiudi"` chiama `onChiudi`.
- [ ] **Step 2: vederli fallire** — `npx vitest run <file>` → FAIL.
- [ ] **Step 3: implementare.** Portale su `document.body`; velo `bg-black/60`; struttura dal prototipo (`tools/design-home/proposta-b3.html`, classi `.foglio`): maniglia (solo telefono), titolo `text-[19px] font-black`, «N atleti», campo `rounded-[14px] bg-[#0f0f10]` con focus `border-brand`, pillole (attiva bianca piena), righe con barretta di categoria 4px, volto 38px, nome e `sotto` troncati, pillola o chevron. Il cambio di filtro o di testo riporta a 60 righe. `battito()` all'apertura.
- [ ] **Step 4: vederli passare**, rompere (es. `slice` senza limite) e vedere fallire il test dei 60, ripristinare.

---

### Task 4: i pezzi della Riepilogo

**Files:**
- Create: `src/components/RiepilogoCoachUI.jsx`
- Test: `src/components/__tests__/RiepilogoCoachUI.test.jsx` (stessa cartella del Task 3)

**Interfaces:**
- Consumes: `oggiPerStato`, `oggiPerCategoria`, `giorniDaProgrammare` (Task 1) — **già calcolati dal chiamante**, qui solo presentazione; `corsia`; `Volto` da `CruscottoCoachUI.jsx`.
- Produces (tutti named export, `compatto` = telefono):
  - `export const BLOCCO_FILA = 20`
  - `CartaOggi({ stati, perCategoria, percentuale, onApri(filtro: 'tutti'|'da fare'|'in corso'|'fatto'), compatto })` — card gialla. `stati.totale === 0` → «Nessun allenamento oggi», niente cerchio, niente barra.
  - `AvvisoStannoMale({ righe, onApri, onApriUno(riga) })` — `null` se `righe` è vuoto; con 1 riga: «{nome} sta male e oggi ha un allenamento intenso» + «Apri» → `onApriUno`; con più: «{n} atleti stanno male e oggi hanno un allenamento intenso» + «Vedi chi» → `onApri`. Sotto: «Hanno dormito poco o hanno poca energia.» (al singolare per uno).
  - `CoppiaAzioni({ feedback: number, scoperti: number, onFeedback, onProgramma })` — zero = «✓» e sotto «tutti letti» / «tutti programmati».
  - `FilaOggi({ righe, onApri(riga), onTutti, compatto })` — `righe` già ordinate (`ordinaOggi`); prime `BLOCCO_FILA`, poi altre 20 quando lo scorrimento orizzontale arriva a 400px dalla fine; in coda card «+N · Vedi tutti» → `onTutti`. Card: foto 148×196 (desktop 160×214), pillola categoria, pillola stato («Sta male» rossa piena, «In corso», «Da fare», «RPE n» se fatto e dichiarato, altrimenti «Fatto»), fatti con opacità 60%. Senza foto: `Volto` con iniziali grande al centro.
  - `GiorniProssimi({ giorni, onApri(giorno), onCalendario, compatto })` — card 118px che scorrono (desktop: griglia a colonne da 124px che scorre se serve); oggi = «{programmati.length} si allenano»; altri = numero arancione `daProgrammare.length` + «da programmare» e «{programmati.length} già programmati»; zero da programmare = ✓ verde + «tutti programmati»; barretta per categoria da `perCategoria`.
  - `ContatoriDaGuardare({ feedback, fermi, scaduti, segnali, onApri(tipo: 'feedback'|'fermi'|'scaduti'|'segnali') })` — quattro righe con icone `MessageCircle`, `PauseCircle`, `Clock`, `ChartNoAxesColumn` e i testi del prototipo; zero = ✓ verde e riga a opacità 50%.
  - `TeamQuattro({ polso })` — stessi valori e frasi di `PolsoTeam` (`CruscottoCoachUI.jsx`) in griglia 2×2; dato assente «—».
  - `GareRighe({ gare, onApri })` — prime 3 di `gareInArrivo`; riga: giorni mancanti nel riquadro colorato per categoria, nome, data, «{n} atleti»; `null` se vuoto.
  - `Destinazioni({ analisi: boolean, onReport, onAnalisi })` — «Report settimanale» sempre, «Analisi» solo se `analisi`.

- [ ] **Step 1: test** — `CoppiaAzioni` con `feedback=0` mostra «✓» e non «0»; `ContatoriDaGuardare` con tutti zero non contiene il testo «0»; `CartaOggi` con totale 0 mostra «Nessun allenamento oggi»; `FilaOggi` con 50 righe mostra 20 card e «+30»; `AvvisoStannoMale` con `[]` non rende niente, con 3 righe dice «3 atleti stanno male»; `Destinazioni` con `analisi={false}` non ha «Analisi».
- [ ] **Step 2: vederli fallire.**
- [ ] **Step 3: implementare** riprendendo misure e classi dal prototipo, tradotte in Tailwind con i token. Nessun calcolo oltre al rendering.
- [ ] **Step 4: vederli passare**; rompere (zero mostrato come «0») e vedere fallire; ripristinare.

---

### Task 5: le due disposizioni

**Files:**
- Create: `src/components/HomeRiepilogoTelefono.jsx`, `src/components/HomeRiepilogoDesktop.jsx`

**Interfaces:**
- Consumes: `useCruscottoCoach({ …, settimana: false })` (14 giorni **anche sul desktop**), le funzioni del Task 1, `FoglioListaCoach` (Task 3), i pezzi del Task 4, `BannerScarpe` pigro.
- Produces: `export default function HomeRiepilogoTelefono(props)` / `HomeRiepilogoDesktop(props)` con **le stesse props** di oggi di `HomeCoachTelefono` / `HomeCoachDesktop`, più `onCrea({ atletaId, data })` e `onAnalisi()` (solo desktop). `fermi` e `scaduti` arrivano interi (Task 6).

- [ ] **Step 1: telefono** — ordine: `CartaOggi`, `AvvisoStannoMale`, `CoppiaAzioni`, titolo «In allenamento oggi» + «Tutti» con `FilaOggi`, «Prossimi giorni» + «Calendario» con `GiorniProssimi`, «Da guardare» con `ContatoriDaGuardare`, «Il team» con `TeamQuattro`, «Gare in arrivo» con `GareRighe`, `BannerScarpe`, `Destinazioni analisi={false}`. Titoli di sezione `text-[18px] font-extrabold`.
- [ ] **Step 2: desktop** — testata come `HomeCoachDesktop` di oggi (data, saluto, Messaggi, Nuovo workout, notifiche, Live); poi griglia 4 colonne con `CartaOggi` su 2 e `CoppiaAzioni`; `AvvisoStannoMale`; `FilaOggi`; `GiorniProssimi`; tre colonne (Da guardare · Il team · Gare); `BannerScarpe`; `Destinazioni analisi`. `fraseDelGiorno` **non** si porta (la card gialla la sostituisce).
- [ ] **Step 3: un solo stato `lista`** (`null` | `{ tipo, giorno?, filtro? }`) per disposizione e una funzione `listaDi(tipo)` che costruisce `{ titolo, persone, filtri, filtroIniziale, onScegli }` secondo la tabella della spec:

| tipo | persone (`sotto`) | filtri | onScegli |
|---|---|---|---|
| `oggi` | righe di oggi ordinate (`titolo`, pillola stato) | Tutti, Da fare, In corso, Fatto, poi le categorie presenti | `onApriSeduta({ workoutId, atletaId: id })` |
| `allarmi` | righe con `allarme` (`motivi.join(' · ')`) | — | `onApriSeduta` |
| `feedback` | `feedback` (`titolo · quando`) | Tutti, poi le categorie presenti (dalla `categoria` dell'elemento; se `feedbackNuovi` non la porta, ricavarla dall'assegnazione con `categoriaDi`) | `onApriFeedback(dato)` |
| `scoperti` | `scopertiTreGiorni` (`Scoperto: mer 11, gio 12`) | Tutti + uno per giorno | `onCrea({ atletaId, data: primoScoperto })` |
| `giorno` | `programmati` + `daProgrammare` di quel giorno | Da programmare, Programmati, Tutti (oggi: parte da Programmati) | da programmare → `onCrea({ atletaId, data })`; programmato → `onApriSeduta` sulla prima chip |
| `fermi` | `fermi` interi, ordinati per giorni (`Nessun allenamento da N giorni`) | — | `onApriAtleta` |
| `scaduti` | `scaduti` interi (`titolo · quando`) | — | `onApriScaduto` |
| `segnali` | `segnali` (`testo` del segnale) | — | `onApriAtleta({ id: atletaId })` |

  `FoglioListaCoach` montato solo se `lista` non è null, `laterale` sul desktop. Le funzioni `ordinaOggi`, `oggiPerStato`, … in `useMemo`.
- [ ] **Step 4: verifica** — `npx eslint src/components/HomeRiepilogoTelefono.jsx src/components/HomeRiepilogoDesktop.jsx src/components/RiepilogoCoachUI.jsx src/components/FoglioListaCoach.jsx src/lib/riepilogoCoach.js src/lib/homeClassica.js` → nessun errore.

---

### Task 6: Home.jsx sceglie

**Files:**
- Modify: `src/pages/Home.jsx` (import pigri in testa vicino a `HomeCoachDesktop`/`HomeCoachTelefono`; il blocco desktop e il blocco `role !== 'athlete' && !desktop`)
- Modify: `src/pages/__tests__/HomeCoach.test.jsx` e gli altri test Home coach che si aspettano il cruscotto (`HomeCascata`, `CoachVuoto`, … — trovarli con `grep -l "Da smaltire\|Prossimi giorni\|Il polso" src/pages/__tests__`)
- Create: `src/pages/__tests__/HomeRiepilogo.test.jsx`

**Interfaces:**
- Consumes: `leggiHomeClassica` (Task 2), le due disposizioni (Task 5).

- [ ] **Step 1: test di pagina** `HomeRiepilogo.test.jsx` (stesso impianto di `HomeCoach.test.jsx`: `montaPagina`, `fintoSupabase`, ruolo `admin`):
  - interruttore assente → c'è «In allenamento oggi» e il bottone «Da guardare»/«Feedback da leggere», non c'è «Da smaltire»;
  - `localStorage.fleofit_home_classica = 'true'` → c'è il cruscotto di oggi («Da smaltire»), non «In allenamento oggi»;
  - con 6 atleti fermi, il contatore «Fermi da 5+ giorni» dice 6 (non 4: il taglio della classica non si applica);
  - da atleta: nessuna delle due.
  - il tocco su «Feedback da leggere» apre un dialogo con il campo «Cerca per nome».
- [ ] **Step 2: vederli fallire.**
- [ ] **Step 3: implementare** — `const homeClassica = useMemo(() => leggiHomeClassica(), [])`; `HomeRiepilogoTelefono`/`HomeRiepilogoDesktop` con `lazy()`; se `homeClassica` le disposizioni di oggi con le props di oggi (`fermiInHome`, scaduti limitati), altrimenti le nuove con `fermi` intero, `allenamentiScaduti(atletiCoach, assegnazioniCoach, { limite: Infinity })` mappato con `quandoScaduto`, `onCrea={({ atletaId, data }) => navigate(`/create?athlete_id=${atletaId}&date=${data}`)}`, `onAnalisi={() => navigate('/analisi')}`. Testata, `BarraRicerca`, `BannerLive`, offline e modali restano invariati.
- [ ] **Step 4: test esistenti** — nei test che verificano il cruscotto aggiungere in `beforeEach` `localStorage.setItem('fleofit_home_classica', 'true')` (stanno provando la classica, che resta). Non cambiare le loro asserzioni.
- [ ] **Step 5:** `npm test` → tutto verde (conteggio atteso: 3070 + i nuovi). Rompere la scelta (invertire la condizione) e vedere fallire `HomeRiepilogo.test.jsx`; ripristinare.

---

### Task 7: pesi, prova nel browser, memoria

**Files:**
- Modify: `docs/memoria/home-coach.md` (sezione nuova `## 9-riepilogo. La Home coach «Riepilogo» (10/11/2026)`), `CLAUDE.md` §11 (riga di `home-coach.md`: aggiungere `riepilogoCoach.js`, `homeClassica.js`, `RiepilogoCoachUI`, `FoglioListaCoach`, `HomeRiepilogoTelefono`, `HomeRiepilogoDesktop`)

- [ ] **Step 1: build** — `npm run build`. Expected: `index` entro +1 KB dai 616,77 KB (CLAUDE.md §2); nessun chunk `index` con `dalleNote` dentro (`grep -l "estrai" dist/assets/index-*.js` non stampa niente). Annotare i pesi dei due chunk nuovi.
- [ ] **Step 2: lint** — `npx eslint src` non aggiunge problemi rispetto ai 26 del 27/10 nei file toccati.
- [ ] **Step 3: prova demo** — `preview_start` `demo` (coach): telefono (375×812) e desktop (1440×1000). Controllare: card gialla e tre numeri, fila delle foto che scorre, giorni, contatori con ✓, apertura e chiusura di ogni foglio, ricerca, filtri, «Programma» che porta a `/create?athlete_id=…&date=…`, Impostazioni → «Home classica» che riporta il cruscotto. Console senza errori. Screenshot finale.
- [ ] **Step 4: memoria** — in `home-coach.md`: cosa è la Riepilogo, l'interruttore, i due tagli tolti solo per la Riepilogo, le liste a blocchi (60 / 20), cosa è rimasto fuori (azioni di massa, «+» centrale, Analisi sul telefono, conti nel database).
- [ ] **Step 5:** `npm run ios` per la prova del committente sul telefono; dire cosa provare.
