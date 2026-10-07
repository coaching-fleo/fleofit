# Home atleta

> Spostato da `CLAUDE.md` il 07/10/2026, **senza cambiare il testo**. I rimandi
> «§9-…» puntano a sezioni che ora stanno in altri file di questa cartella:
> si trovano con `grep -rn '^## 9-<nome>' docs/memoria`. L'indice è in `CLAUDE.md`.

## 9-octies. Il rework della Home atleta (26/08/2026)

Nasce da un design di **Claude Design** (progetto `4a238081-a3ee-4f59-ae34-100f29d55601`,
artboard `Home Atleta.dc.html`, opzione **1b**). La logica di `Home.jsx` — fetch, swipe di
completamento, modale RPE, coda offline, notifiche realtime — **non è stata toccata**: è
cambiato il JSX del ramo atleta e il modo in cui i dati vengono presentati.

### Cosa cambia, e perché
- **Un solo eroe.** L'allenamento di oggi occupa il primo schermo da solo: titolo a 29px, tre
  metadati, CTA piena. Prima arrivava dopo due schermate, con lo stesso peso visivo della card
  «Calendario» — ed è l'unica informazione per cui l'atleta apre l'app.
- **Lo slider a due slide è sparito.** Nascondeva le statistiche settimanali dietro un gesto
  che niente segnalava. Ora sono celle del bento: anello 3/5 + serie di giorni + volume/RPE.
- **Profondità vera.** Ombra proiettata neutra + hairline interna chiara. Vedi *La Regola
  della Carta Sollevata* in DESIGN.md: limita, senza contraddirla, la regola «piatto + glow».
- **Tre destinazioni tolte dalla Home dell'atleta** (Calendario, Profilo, Archivio): le prime
  due sono voci della navbar, la terza si apre dal Calendario. **Per il coach restano**: sono
  la sua unica via verso Atleti e archivio.
- **Il badge delle notifiche è un pallino, non un numero.** Il conteggio esatto lo dà il
  centro notifiche — ma vive anche nell'`aria-label` del bottone, altrimenti sparirebbe per
  chi usa VoiceOver. Il test lo verifica lì.
- **La frase motivazionale è rimasta**, come terza riga piccola dell'header: il design non la
  prevedeva, ma `getDailyMotivation` con anti-ripetizione è una funzione vera e cancellarla
  non era nello scopo del rework. Se si vuole toglierla, è una decisione di prodotto.

### ⚠️ Le tre trappole di questo codice
1. **`HeroOggi` non può avere animazioni CSS sul nodo radice.** È l'elemento su cui lo swipe
   scrive `style.transform` a ogni movimento del dito, e un'animazione con `fill: both`
   **vince sullo stile inline**: la card resterebbe ferma sotto il dito. L'entrata
   `hero-transition` sta sul contenitore, che non viene mai trasformato.
2. **La struttura del wrapper dello swipe è un contratto.** `swipeInizio` cerca il pannello
   verde con `el.parentElement.querySelector('[data-swipe-panel]')`: il pannello e la card
   devono restare fratelli dentro lo stesso `relative overflow-hidden`.
3. **`CARD`, `LABEL` e `corsia` NON sono esportate** da `HomeAtletaUI.jsx`, di proposito:
   esportare qualcosa che non è un componente fa perdere il Fast Refresh all'intero file
   (`react-refresh/only-export-components`).

### La query dell'atleta è stata allargata a 60 giorni
Partiva dal lunedì di questa settimana (`gte weekStartStr`, `limit 30`). Serie di giorni,
sparkline e RPE medio guardano **indietro**: con la vecchia finestra la serie avrebbe letto
zero ogni lunedì mattina. Ora `GIORNI_STORICO = 60` e `limit(400)`. I filtri esistenti
(oggi, prossimi, evento, settimana) sono tutti per data, quindi non cambiano.

### 🔴 Due difetti trovati SCRIVENDO i test, non leggendo il codice
Gli helper di `src/lib/statistiche.js` esistevano già ma non erano coperti. Entrambi
producevano un numero plausibile e sbagliato, cioè il caso peggiore.

1. **La serie non si spezzava mai.** La regola «un giorno di rest programmato non spezza la
   serie» era senza tetto: un atleta che si è allenato **una volta quaranta giorni fa** e mai
   più leggeva «Serie: 1 giorno», perché i trentanove giorni vuoti erano tutti rest
   programmato. Ora si attraversano al massimo `MASSIMO_REST_CONSECUTIVI = 3` giorni di fila.
2. **`mediaRpeCategoria` contava un 5 inventato.** `parseNotesAndRpe` torna `{ rpe: 5 }`
   quando il marcatore `[RPE: n/10]` non c'è — è il valore giusto per il cursore della
   modale, ma è un ripiego travestito da misura. Il guardiano `Number.isFinite(rpe)` non
   proteggeva da niente: 5 è finito. Chi non compila mai l'RPE vedeva «5» presentato come la
   propria media storica. Ora esiste **`rpeDichiarato()`** in `src/lib/rpe.js`, che torna
   `null` quando il dato non c'è.
   ⚠️ **`calcolaStatistiche` ha ancora lo stesso guardiano inerte** (`load` e
   `distribuzioneRpe`): non è stato toccato perché cambierebbe i numeri che il coach vede
   oggi, ed è una decisione di prodotto, non una correzione. Vedi BACKLOG.

## 9-duodetricies. Gli stati senza storico della Home atleta (09/09/2026)

Stesso progetto Claude Design degli altri dieci schermi
(`4a238081-a3ee-4f59-ae34-100f29d55601`), documento
`codice/ISTRUZIONI-STATI-VUOTI.md`, stati **2a** (giorno 1), **2b** (prima
settimana) e **2c** (giorno di riposo). Come per gli altri: **nessun campo di
Supabase cambia forma**, nessuna query nuova, nessuna dipendenza nuova. La
logica di `Home.jsx` — fetch, swipe di completamento, modale RPE, coda offline,
notifiche realtime — non è stata toccata.

### Il problema, in una riga
La Home era scritta per un atleta che ha già uno storico, e per chi non ce l'ha
mostrava **quattro zeri perfettamente corretti**: anello 0/0, «Serie: 0 giorni»,
«Volume · RPE 0 min», e «In arrivo» vuoto. Cioè quattro numeri veri che dicono a
chi ha appena installato l'app che è **già indietro**.

### 🔴 LA REGOLA, ED È UNA SOLA
*Nessuna cella mostra uno zero. Al posto di un dato che non esiste ancora va la
cosa che lo farà esistere.* È la stessa famiglia di `rpeAtteso` che torna `null`
invece di 5 (§9-octies), del `—` di `DurataBlocco` (§9-undecies punto 2) e del
`—` della rubrica (§9-septdecies punto 3) — ma applicata a **una schermata
intera** invece che a una cella.
**Corollario:** una cella che si sbloccherà dichiara la soglia e il progresso
(«Media RPE · si accende dopo 3 allenamenti · 1/3»), e la soglia si scrive solo
quando c'è un progresso da raccontare: `0/1` è di nuovo lo zero che la regola
toglie, ed è la ragione per cui `soglia` di `CellaBloccata` è **facoltativa**.

### Cosa c'è ora
- **2a · Giorno 1** — blocco giallo «*Federico Leo* ti segue da oggi» con la
  scorciatoia al profilo, la domanda sull'obiettivo, la card per registrare il
  primo allenamento, e le tre righe di «Come funziona».
- **2b · Prima settimana** — l'anello si chiama «Settimana 1 · **iniziata**»
  invece di «completati», e la colonna destra del bento porta «Primo dato»
  (minuti, giorno e RPE di quella seduta) più la cella bloccata della media RPE.
  Sotto, `BannerObiettivoVuoto` al posto del countdown.
- **2c · Riposo** — al posto del tratteggio «Recupera le energie»: la corsia
  Running, i minuti chiusi in settimana, la card del carico con lo scarto sulla
  precedente, cosa arriva dopo, e «Ho fatto qualcosa comunque».

### ⚠️ Le nove cose da sapere prima di rimetterci mano

1. 🔴 **Il ramo del giorno 1 CHIUDE la pagina, non è una card in più.** Se
   restasse sopra l'albero esistente, sotto di esso ci sarebbero ancora i
   quattro zeri — cioè il difetto intero, con un cappello sopra. C'è un test che
   cade solo su questa forma.
2. 🔴 **`{weeklyStatus.length > 0 && …}` non proteggeva da niente**, ed è la
   ragione per cui il difetto è sopravvissuto: `weeklyStatus` nasce **già con
   sette giorni** (`useState` con inizializzatore, in cima a `Home.jsx`), quindi
   quella condizione è sempre vera. È lo stesso difetto trovato sulla Home coach
   il 28/08 (§9-nonies) sullo stesso identico stato.
3. 🔴 **`primaSettimana` si conta sui COMPLETATI, mai su `storicoAtleta.length`.**
   Quelle righe comprendono gli assegnati ancora da fare: un atleta con cinque
   allenamenti in programma e nessuno fatto ha `length === 5`, quindi con quel
   criterio uscirebbe dalla prima settimana e leggerebbe «Serie: 0 giorni» e
   «0 min». È il caso che il conteggio delle righe lascia passare, e c'è un test.
4. 🔴 **`storicoAtleta` è in ordine ASCENDENTE** (`.order('completed_date',
   { ascending: true })` nel fetch), quindi «il primo dato» è `completati[0]`.
   Il documento di design lo dava per discendente e diceva di verificarlo: con
   un solo completato `[0]` e `.at(-1)` coincidono, quindi la mutazione si vede
   solo da due allenamenti in su — il test ne usa due apposta.
5. 🔴 **`CellaPrimoDato` porta i minuti di QUELL'allenamento, non
   `weeklyStats.time`.** Il primo completato può essere della settimana scorsa,
   e allora il totale settimanale vale 0: la cella scriverebbe «0 min» sotto una
   data e un RPE veri. Il test lo prende mettendo il primo completato **fuori**
   dalla settimana in corso — è l'unica configurazione in cui le due letture si
   separano.
6. 🔴 **`minutiSettimana` misura la settimana di CALENDARIO (lunedì-domenica),
   non una finestra mobile di sette giorni.** È la correzione fatta rispetto al
   documento di design: il numero accanto a cui vive — `weeklyStats.time` — è
   calcolato su `startOfWeek(…, { weekStartsOn: 1 })`, e una finestra mobile
   avrebbe prodotto uno scarto che non corrisponde al totale sopra di esso. È la
   regola del LUNEDÌ di §9-septdecies punto 4 e §9-vicies, per la quarta volta.
   Il caso che lo prende è la **domenica precedente**, che una finestra mobile
   conterebbe dentro la settimana in corso.
7. 🔴 **`scartoMinutiSettimana` torna `null`, non lo scarto**, quando la
   settimana precedente è vuota: «+214 min sulla scorsa» su una settimana in cui
   l'atleta non esisteva è un dato finto, e la card lo omette da sé. Vale anche
   quando la settimana scorsa ha solo assegnati **non fatti**: un allenamento
   saltato non è un termine di paragone.
8. ⚠️ **`CardDomani` mostra il PRIMO in arrivo, non «domani».** Se il prossimo
   assegnato è fra tre giorni, l'etichetta «Domani» è una riga che mente e
   nessun errore la segnala: il chiamante calcola `differenceInDays` e passa
   «In arrivo».
9. ⚠️ **Il riposo programmato e «il coach non ha assegnato niente» sono la
   stessa riga nei dati.** `todayWorkouts.length === 0` copre entrambi, e non
   esiste un campo che dica «oggi è rest». La frase «È parte del piano» è vera
   nel primo caso; è la versione onesta possibile finché quel campo non c'è, e
   chi non ha **niente in assoluto** lo intercetta prima il ramo del giorno 1.

### Il nome del coach è una costante, e non poteva essere altro
`src/lib/coach.js`. Dal lato atleta il nome del coach **non è interrogabile**:
lo schema non ha un `coach_id` — i coach sono un elenco di email dentro le
policy RLS (§4-bis), cioè uno studio con un coach solo — e `athletes` si legge
solo per la propria riga o da admin. È lo stesso muro contro cui sbatte già
`CardInvitoValido` in `LoginUI` (§9-septvicies punto 1), che per questo scrive
«Il tuo coach ti ha invitato» invece di un nome. Il giorno in cui esistono più
coach, quella è l'unica riga da sostituire con una lettura vera — e
`BenvenutoCoach` funziona anche senza: senza `coach` scrive «Il tuo coach ti
segue da oggi».

### 🔴 «Fissa l'obiettivo» apre il modale dell'allenamento libero, e va detto
Un obiettivo dell'atleta **non è una tabella**: gli eventi sono workout di
categoria `Event` che assegna il coach, e una colonna nuova su `athletes` è
vietata dal congelamento dello schema (regola 0-bis). `onFissa` punta perciò a
`setAutonomousModalOpen(true)`: la card non mente — chiede una data, e una data
la si può mettere. Farlo nascere direttamente come `Event`, così che compaia nel
calendario e nel `BannerObiettivo` esistente, è la strada a costo zero indicata
dal design ed è **in BACKLOG**, non implementata.

### ⚠️ Le classi dell'entrata sono state SOSTITUITE, non copiate
Il documento di design usa `animate-in fade-in slide-in-from-bottom-2`,
scrivendo che «arriva da tw-animate-css». **In questo progetto tw-animate-css
NON è installato** e quelle classi generano zero CSS (§9-duodecies punto 1 e
§9-quindecies punto 1, verificato sul bundle: `grep -c "animate-in"
dist/assets/*.css` → 0). Sarebbe stata la terza volta che lo stesso difetto
entra da una porta diversa. Qui l'entrata è `hero-transition`, il keyframe vero
di `src/index.css`, che è esattamente «sale di 8px mentre appare».

### 🔴 Il difetto che solo la pagina a 393px ha mostrato
`CardDomani` metteva `capitalize` sull'**intera** riga di meta, e
`text-transform: capitalize` non conosce le frasi: maiuscola **ogni parola**, e
si leggeva «Gio 10 · 2 **B**locchi · 56′». Nessun test lo avrebbe preso — nel
DOM il testo è già quello giusto, a cambiarlo è il foglio di stile. Ora
`capitalize` sta sul solo nome del giorno. È lo stesso genere di difetto del
conto alla rovescia del cestino (§9-septdecies punto 7), delle quattro celle del
builder (§9-quatervicies) e della riga «Non ho un codice» (§9-septvicies).

### Il codice morto che il rework ha lasciato indietro, ed è stato rimosso
**`HeroRest`** in `HomeAtletaUI.jsx` — il tratteggio «Giorno di rest · Recupera
le energie» — non ha più chiamanti: cancellato subito invece di restare
esportato «finché questa versione non è in produzione», che è il modo in cui una
correzione ne raggiunge due su tre (§9 punto 2). Con lui è uscito l'import di
`CalendarDays`, che era suo soltanto.

### I test, e le due mutazioni che erano nate invisibili
`src/lib/__tests__/statistiche-vuoti.test.js` (16) e
`src/pages/__tests__/HomeVuoti.test.jsx` (19), tutti verificati per mutazione:
**tredici mutazioni provate, tredici prese**. Due sono state riscritte perché la
mutazione le superava, ed è la stessa lezione di §9-sexies:
- «mostra il primo allenamento come dato» nasceva con **un solo** completato, e
  lì `completati[0]` e `.at(-1)` sono lo stesso oggetto: l'ordine di
  `storicoAtleta` non era coperto da niente. Ora ne usa due, e il secondo vale
  anche come totale della settimana — così la stessa asserzione prende sia
  l'ordine sia la lettura di `weeklyStats.time`.
- «con soli assegnati e nessun completato resta la prima settimana» non esisteva:
  con il conteggio delle righe il test sarebbe stato verde e l'atleta con cinque
  allenamenti in programma avrebbe letto quattro zeri.

⚠️ **Due test storici sono stati riscritti, e per il motivo giusto.** In
`NavigazioneApp.test.jsx` il marcatore «Giorno di rest» era la prova che la Home
fosse ancora a schermo: quel finto atleta ha `athlete_workouts: []`, quindi ora
vede il **giorno 1**. In `HomeCoach.test.jsx` l'assertion «l'admin non vede il
ramo atleta» sarebbe diventata **trivialmente vera** — quella stringa non esiste
più in tutta l'app — e ora guarda «ti segue da oggi», che è ciò che il coach
vedrebbe davvero rimettendo `role === 'admin'` accanto a `role === 'athlete'`:
il suo account è escluso da chi si segue (`COACHING_ID`), quindi non ha
storico, quindi per la Home è al giorno 1.

### I file nuovi
`src/lib/coach.js`, `src/lib/statistiche.js` (tre funzioni appese:
`senzaStorico`, `minutiSettimana`, `scartoMinutiSettimana`, più
`MINIMO_PRECEDENTI` che diventa esportata — è la stessa soglia con cui
`mediaRpeCategoria` già tace, e due «3» scritti a mano direbbero «si accende
dopo 3 allenamenti» accendendola al quarto) e
`src/components/HomeAtletaVuotiUI.jsx` (sola presentazione).
`AnelloSettimana` prende due prop facoltative, `etichetta` e `stato`: i valori
numerici non cambiano, cambia solo come si chiamano.

### Cosa NON è stato fatto, e perché
- **L'obiettivo non nasce come `Event`** (vedi sopra): è in BACKLOG.
- **`fattiSettimana`/`assegnatiSettimana` non sono passate ad `AnelloSettimana`**,
  che continua a ridurle al suo interno. Sono lo stesso `useMemo` e la stessa
  sorgente, quindi non possono divergere; cambiare il contratto di un componente
  già coperto da test per risparmiare una riduzione su sette elementi è un
  rischio senza guadagno.
- **La ridondanza fra `HeroRiposo` e `CardSettimanaChiusa` è rimasta.** Sul
  riposo della prima settimana lo schermo dice «82 minuti in 2 giorni», poi
  «82 min · 2 / 3», poi l'anello «2/3»: tre volte gli stessi due numeri. Il
  disegno chiede entrambi, e nessuno dei due è sbagliato — la frase è il perché,
  la card è il dato — ma è una decisione di prodotto, non di implementazione:
  voce in BACKLOG.

---
