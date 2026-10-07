# Home coach e atleta in pausa

> Spostato da `CLAUDE.md` il 07/10/2026, **senza cambiare il testo**. I rimandi
> «§9-…» puntano a sezioni che ora stanno in altri file di questa cartella:
> si trovano con `grep -rn '^## 9-<nome>' docs/memoria`. L'indice è in `CLAUDE.md`.

## 9-nonies. Il rework della Home coach (27/08/2026)

Nasce dallo stesso progetto Claude Design della Home atleta
(`4a238081-a3ee-4f59-ae34-100f29d55601`), artboard `Home Coach.dc.html`, opzione **2b**.
Come per l'atleta, la logica di `Home.jsx` non è stata riscritta: sono cambiati il JSX del
ramo coach, la query che lo alimenta, e i numeri che quel ramo mostra.

### Il problema, in una riga
La Home coach non conteneva **un solo dato**: era un menù. Logo, CTA «Crea Workout», lista
delle attività di oggi e ieri, due card verso destinazioni che sono **già nella navbar**,
bottone archivio. L'unica informazione presente — chi ha fatto cosa ieri — è la meno utile
la mattina, perché guarda indietro. Quello che il coach non vedeva è **chi sta per sparire**.

### ⚠️ L'eroe è cambiato in corsa, ed è la cosa da sapere prima di tutto
La prima stesura del 27/08 metteva in cima **«richiedono attenzione»**. La revisione dello
stesso giorno dell'artboard `2b` lo ha sostituito con i **feedback**, e la ragione non è
estetica: chi è fermo da nove giorni **lo è ancora fra un'ora**, mentre una nota non letta è
l'unica cosa in pagina che ha già **un mittente in attesa**. Chi è fermo non è sparito — è
sceso sotto la CTA, con lo stesso dato di prima. Se questo documento e il codice dovessero mai
contraddirsi su quale sia l'eroe, la fonte è `src/pages/Home.jsx`, ramo `role !== 'athlete'`.

### Cosa c'è ora, nell'ordine in cui sta in pagina
1. **L'eroe: «feedback nuovi»** — le note (con RPE) e le note vocali che il coach non ha
   ancora aperto. Ogni riga porta **la citazione**, non solo il nome: un contatore senza il
   testo obbliga ad aprire quattro schermate per sapere se una delle quattro era urgente.
   Tre citazioni in pagina (`FEEDBACK_IN_HOME`), il resto dietro un «+N altri».
   ⚠️ Il numero grande è `elementi.length` (le cose da leggere), **non** `totale`
   (che somma vocali e note, e per una riga con entrambe vale due).
2. **La squadra della giornata** — «5/7 completati», la barra a segmenti, i volti con
   l'anello colorato e l'RPE sotto. Sostituisce la lista «Attività oggi e ieri», che
   elencava gli eventi uno per uno senza mai far vedere l'insieme. Il giorno si cambia in
   fondo alla card: ieri è consultazione, la domanda della mattina è su oggi.
3. **La CTA «Crea workout»**, unica superficie gialla piena della pagina.
4. **Archivio** (e **Profilo** solo per `admin`), in forma di riga.
5. **«Richiedono attenzione»** — nessun allenamento *completato* da 5 giorni o più. Una
   condizione sola, di proposito: è l'unica a cui la risposta è sempre la stessa, una
   telefonata. Massimo quattro nomi (`MASSIMO_FERMI_IN_HOME`): oltre, smette di essere una
   chiamata all'azione e diventa una lista, e una lista non si chiama.
6. **Copertura 3 giorni** — quanti atleti hanno almeno un allenamento assegnato da oggi a
   fra due giorni. Non è vanità: è l'unico numero della Home che dice «devi programmare adesso».
7. **Allenamenti scaduti** — in fondo, in forma di lista: è lavoro da smaltire, non un
   allarme. Accanto all'atleta fermo si mescolavano due problemi di segno opposto.

**La Live Coach Cam** resta una barra sopra l'eroe, non una sezione con un titolo: dura
quanto un allenamento, e per 23 ore al giorno quel titolo stava sopra il vuoto.

### 🔴 «Manda promemoria» NON è stato implementato, ed è una scelta obbligata
L'artboard mette un bottone «Manda promemoria» nella card degli atleti fermi. **Non c'è
nessun modo di farlo funzionare dal client**, e vale la pena scriverlo perché sembra una
dimenticanza:
- la policy RLS di `notifications` è `auth.uid() = user_id`, quindi il coach **non può
  inserire una notifica per un altro utente** (§4-bis: è una delle policy scritte bene);
- `send-reminders` non ha una modalità «promemoria a QUESTO atleta»: `immediate` manda
  «Nuovo Allenamento!», che è un altro messaggio. Aggiungerla è un **deploy** di una
  funzione **condivisa con la web app in produzione** (§1.1), non una modifica di UI.

Al suo posto la **riga intera è il bersaglio** e apre la scheda dell'atleta. È anche più
corretto del design: con più nomi elencati, un «Apri» in fondo alla card non dice quale
atleta apre. La voce sta in BACKLOG.

### ⚠️ Il ramo atleta NON si vede più dalla Home coach (28/08/2026)
Fino al 28/08 il ramo atleta era renderizzato per `role === 'athlete' || role === 'admin'`:
in fondo alla Home coach comparivano quindi l'**allenamento di oggi** (o «Giorno di rest»),
l'**anello della settimana**, **Serie** e **Volume · RPE**. Erano i numeri di *una* persona
in una pagina che parla di dodici, e per il coach dicevano sempre rest — il suo account è
escluso da chi si segue (`COACHING_ID`), quindi non ha allenamenti propri. Il bento
compariva **sempre**, anche senza un dato: `weeklyStatus` nasce già con sette giorni, quindi
`weeklyStatus.length > 0` era vero al primo render.
Ora il ramo atleta è `role === 'athlete'` e basta, **e con esso non parte più la query sullo
storico personale** (due `select` in meno a ogni apertura della Home coach). Chi vuole quella
vista passa da **Impostazioni → «Anteprima come atleta»**, che mette `adminRoleOverride` e
rende la Home atleta intera.
Insieme è uscita la riga **«Profilo»**: era l'unico collegamento a `/profile` per l'admin, e
resta raggiungibile dalla stessa anteprima, dove la navbar ne ha la voce.
✅ **E dal 28/08/2026 nemmeno la testata** (chiuso il giorno stesso). Il corpo era stato
separato, il ramo della **testata** no: guardava anch'esso `role === 'athlete' || role ===
'admin'`, quindi sopra una pagina che parla di dodici persone il coach leggeva il saluto
dell'atleta — «Buongiorno, Federico», la settimana ISO e la frase motivazionale del giorno.
`HeaderCoach` («ven 28 agosto · 9 atleti · 2 in pausa» + «FLEOFIT Coach») **esisteva già ed
era codice irraggiungibile**: l'unico ruolo che lo apriva era `'coach'`, che l'onboarding non
assegna (`App.jsx`). Ora la regola della testata è la stessa del corpo — `role === 'athlete'`
di qua, tutti gli altri di là — ed è la testata dell'artboard `Home Coach.dc.html` 2b.
⚠️ È anche la ragione per cui i **test storici** di questa sezione montano `'coach'` e non si
erano accorti di niente: i tre test nuovi montano `'admin'`, l'unico ruolo che esiste davvero.
Il numero di atleti è `atletiCoach.length`, che **esclude già `COACHING_ID`** (il filtro sta
nel fetch): è quello della rubrica, non uno più grande. Chi è in pausa **resta nel totale** e
si dichiara a parte, altrimenti i numeri delle sezioni sotto — che la pausa la escludono —
sembrerebbero sbagliati.

### Cosa è uscito
Le card **«Calendario»** e **«Atleti»**: sono già due voci della navbar coach (verificato in
`Navbar.jsx`), e vale il corollario della Regola dell'Eroe Unico applicato all'atleta il 26/08.
L'**archivio resta**, come riga sotto la CTA: è materiale di lavoro del coach, non una
destinazione duplicata. Il **Profilo** resta anch'esso come riga, ma **solo per `admin`**:
è l'unico ruolo che non ha quella voce in navbar. Resta una sola superficie gialla piena in
pagina, «Crea workout», come da Regola del Tratto Unico.

### Una query sola al posto di cinque
`Home.jsx` carica ora `athletes` (righe, non solo il conteggio) e **un unico** `athlete_workouts`
sulla finestra `[oggi − 45 giorni, oggi + 2]`, con i join su `athletes` e `workouts`. Fermi,
scaduti, copertura, feedback e squadra della giornata sono tutti `useMemo` su quelle due liste:
cinque `select` sullo stesso intervallo sarebbero stati cinque round trip per gli stessi dati.

### ⚠️ Le cinque trappole di questo codice
1. **`athlete_workouts` non ha `created_at`.** Quindi «feedback nuovo» **non può** voler dire
   «arrivato dopo il tuo ultimo accesso»: vuol dire «che non hai ancora aperto», e l'elenco
   degli id già letti sta in `localStorage.fleofit_feedback_visti_<uid>`. Conseguenza da
   conoscere prima di dire che è un bug: **il "letto" è per dispositivo, non per account**.
   L'alternativa richiederebbe una colonna, e lo schema è congelato (regola 0-bis).
2. **L'elenco dei già letti si legge in un `useMemo`, non in un `useEffect` con `setState`.**
   Non è stile: con l'effetto, scrivere i letti farebbe sparire la lista **sotto le dita del
   coach** nello stesso istante in cui la apre. Così il valore si rilegge solo quando cambiano
   i dati, cioè al prossimo caricamento — che è quando il contatore deve scendere.
3. **`voice_note_url` è UNA colonna per una comunicazione bidirezionale** (CLAUDE.md §4): non
   esiste modo di sapere se l'ha registrata l'atleta o il coach. Si contano perciò solo le
   assegnazioni **completate**, dove la nota accompagna il completamento. È un'approssimazione
   voluta, non una svista.
4. **Aprire un feedback segna letto SOLO quello.** Fino alla revisione il gesto era «apro la
   lista, li leggo tutti», perché la lista era chiusa e il numero era l'unica cosa visibile.
   Ora le citazioni sono in pagina: azzerare l'arretrato al primo tocco cancellerebbe tre
   feedback che il coach non ha ancora guardato. C'è un test che lo prende.
5. **«In corso» viene dalla presenza Realtime, non dal database.** `athlete_workouts` non ha
   uno stato «iniziato»: l'unica fonte che distingua «non ha ancora finito» da «lo sta facendo
   adesso» è il canale `global_live_workouts` della Live Coach Cam. La presenza è indicizzata
   per `athleteWorkoutId` (è la chiave con cui `WorkoutDetail` fa `track`), quindi l'`athlete_id`
   si ricava dall'assegnazione già caricata — nessuna query in più, nessuna modifica a
   `WorkoutDetail`. Conseguenza voluta: **gli atleti che corrono non compaiono mai «in corso»**,
   perché la corsa non ha il timer guidato e quindi non traccia presenza (§7).

### 🔴 Il difetto che il filtro dell'account coach nascondeva
`stats.athletes` contava `athletes` **senza escludere `COACHING_ID`**, mentre `Athletes.jsx` lo
esclude da sempre: la vecchia card «Atleti» diceva quindi un numero diverso da quello della
rubrica. Innocuo finché era solo un'etichetta; con l'eroe non lo è più — il coach sarebbe
comparso **fra i propri atleti fermi** ogni volta che non si allena, e avrebbe falsato anche la
copertura. Ora il filtro è nella Home, ed è coperto da un test.

### Il codice morto che il rework ha lasciato indietro, e che è stato rimosso
`attivitaRecente` (in `statisticheCoach.js`) e i componenti `CellaFeedback`, `CellaCopertura`,
`EsitoAttivita`, `VuotoSezione` (in `HomeCoachUI.jsx`) non avevano più chiamanti dopo la
revisione: sono stati cancellati insieme ai loro test, invece di restare come terza copia di
qualcosa che nessuno chiama (§9 punto 2). `HeroAttenzione`/`HeroTuttiAttivi` sono diventati
`SezioneAttenzione`/`TuttiAttivi`: **il nome dice il rango**, e chiamare «Hero» qualcosa che
sta sotto la CTA è il modo in cui il prossimo lettore rimette l'ordine sbagliato.

---

## 9-decies. «Atleta in pausa» (27/08/2026)

Richiesta del committente: un atleta che avvisa di volersi fermare non deve più comparire fra
quelli che **richiedono attenzione** nella Home coach, ma deve restare nella rubrica con tutto
il suo storico.

### 🔴 Perché NON è una colonna, e cosa comporta
`athletes.is_paused` sarebbe una migrazione, e **lo schema è congelato** fino all'approvazione
su App Store (regola 0-bis): il database è uno solo e serve anche la web app in produzione,
senza staging. Lo stato vive quindi dentro `athletes.notes` — la nota che il coach scrive
per l'atleta — nel
prefisso `[PAUSA: yyyy-MM-dd]`, con **lo stesso meccanismo già usato per l'RPE** dentro
`athlete_workouts.notes` (§4). Tutto passa da `src/lib/pausa.js`.

Le tre conseguenze da conoscere **prima** di dire che è un bug:
1. **La web app su `main` non conosce il marcatore.** Se il coach modifica la nota da
   lì, il prefisso può sparire e l'atleta torna fra quelli da chiamare. È lo stesso rischio
   dell'RPE (§1.1), ma si comporta meglio: il guasto è **visibile** — l'atleta ricompare — e si
   ripara con un tocco. Non perde dati.
2. **Chiunque scriva `athletes.notes` deve passare da `formatNotePausa`.** La modale «Modifica
   profilo» faceva `.update({ notes: form.notes })` con il testo grezzo: senza il round-trip,
   ogni «Salva» avrebbe cancellato la pausa **in silenzio**. C'è un test che lo prende.
3. **Il marcatore vale SOLO in testa alla nota.** Altrimenti bastava che il coach scrivesse
   «ne parliamo, magari [PAUSA] a settembre» perché un atleta sparisse dagli allarmi senza che
   nessuno l'avesse deciso.

### Dove la pausa ha effetto, e dove no
| Superficie | Effetto | Perché |
|---|---|---|
| Home → **Richiedono attenzione** | esce | è la richiesta |
| Home → **denominatore dell'eroe** e **Copertura 3 gg** | esce dal totale | «2 di 7» quando due dei nove si sono fermati. Contarlo fra i «senza allenamento» vorrebbe dire chiedere al coach di programmare per chi ha chiesto di fermarsi |
| Home → **Allenamenti scaduti** | esce | uno scaduto di chi è in pausa non è lavoro da smaltire: è la conseguenza attesa. Resta visibile nella sua scheda |
| Home → **header** | «9 atleti · 2 in pausa» | senza, i numeri sotto contraddicono la rubrica e sembrano sbagliati |
| Home → **Attività oggi e ieri** | **resta** | è consultazione di ciò che è successo davvero. Se un atleta in pausa si allena, il coach deve vederlo — ed è il segnale per riattivarlo |
| **Atleti** (rubrica) | resta, con la pillola «In pausa» | è la lista in cui deve restare, ed è l'unico posto dove il coach si accorge di averne messo in pausa uno e dimenticato |

`atletiFermi`, `allenamentiScaduti` e `copertura` applicano il filtro **da sé** invece di
aspettarsi una lista già ripulita dal chiamante: sono le funzioni che producono un allarme e un
totale, e chi si dimentica il filtro non ottiene un errore — ottiene una telefonata a chi aveva
chiesto di non essere chiamato.

### ⚠️ Due dettagli di interfaccia che non sono estetica
- **La conferma c'è solo per METTERE in pausa, non per toglierla.** Mettere in pausa spegne un
  allarme, e uno spegnimento per errore non si nota. Toglierla riaccende, e un allarme di troppo
  si vede da solo.
- **La pillola «In pausa» è nascosta all'atleta.** `AthleteDetail` è anche `/profile`, cioè la
  scheda che l'atleta vede di sé: la pausa è uno stato interno della programmazione del coach, e
  mostrarla lì vorrebbe dire comunicare «ti ho messo in disparte» con una pillola arancione
  invece che parlandoci.

> ⚠️ **`athletes.notes` è VISIBILE all'atleta, ed è giusto così.** Confermato dal committente il
> 27/08/2026: è una nota che il coach scrive *per* l'atleta, non su di lui, e `AthleteDetail` la
> rende senza guardia di ruolo di proposito. Chi legge «note private» in una vecchia versione di
> questo documento non lo prenda per un difetto da correggere.
> Due conseguenze per la pausa, entrambe già gestite:
> - il marcatore **non si vede mai** — né nella scheda né nel campo della modale di modifica —
>   perché ovunque si mostra `parseNotePausa(...).testo` e mai il valore grezzo;
> - **anche l'atleta può salvare quella nota** (il bottone «Modifica» su `/profile` non è
>   riservato al coach), e il round-trip di `formatNotePausa` nella modale vale per entrambi i
>   ruoli: salvare il proprio profilo **non** annulla la pausa. C'è un test.
>
> Resta vero che il valore grezzo è raggiungibile dall'atleta per altre vie (l'export JSON, una
> chiamata all'API): il marcatore nasconde lo stato dall'interfaccia, non lo cifra.

---
