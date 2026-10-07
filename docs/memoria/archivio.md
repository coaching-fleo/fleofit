# L'archivio

> Spostato da `CLAUDE.md` il 07/10/2026, **senza cambiare il testo**. I rimandi
> «§9-…» puntano a sezioni che ora stanno in altri file di questa cartella:
> si trovano con `grep -rn '^## 9-<nome>' docs/memoria`. L'indice è in `CLAUDE.md`.

## 9-sedecies. Il rework dell'archivio (31/08/2026)

Stesso progetto Claude Design degli altri cinque schermi
(`4a238081-a3ee-4f59-ae34-100f29d55601`), artboard `Archivio Workout.dc.html`,
opzione **1b**. Come per gli altri: **nessun campo di Supabase cambia forma**,
le due query restano quelle di prima. Cambia il JSX, cambia l'ordine, e per la
prima volta la pagina dice dei numeri.

### Il problema, in una riga
Era una lista piatta di card identiche ordinate per data di **creazione**, senza
raggruppamenti e senza scala: con dieci workout funziona, con i 171 in
produzione è uno scroll cieco. L'unico strumento di riduzione era un campo di
testo — se non ricordavi il titolo esatto, non avevi una strada.

### Cosa c'è ora
1. **Una testata sola.** Erano due `h1` (il logo FLEOFIT e «Archivio Workout»)
   più un sottotitolo che ripeteva il titolo: tre righe prima di vedere un
   workout, su una schermata che si raggiunge da un link chiamato «Archivio».
   Ora è «Archivio» più una riga che dice la scala (carattere normale, come nell'artboard: il monospazio resta alle sole intestazioni dei mesi — riallineato il 02/10/2026) — «128 workout
   · 3 corsie» — e che **sotto filtro cambia domanda**: «12 di 128 workout», che
   è l'unica cosa che resta da sapere quando la lista si accorcia sotto le dita.
2. **La ricerca è diventata un filtro.** Una fila di chip per corsia con il
   conteggio dentro: si riduce con un tocco, senza digitare.
3. **Il tempo dà la struttura.** I workout si raggruppano per mese, con
   l'intestazione in monospazio e il conteggio a destra.
4. **Righe dense.** 60px: spina di corsia, titolo, meta compresso e a destra il
   numero degli assegnati come **cifra**. La categoria è la spina, non un chip.

### ⚠️ Le sette cose da sapere prima di rimetterci mano

1. 🔴 **L'ordine è cambiato, ed è il raggruppamento a pretenderlo.** La query
   torna per `created_at`, ma la data **mostrata** è un'altra (`workouts.date`
   per il coach, `completed_date` per l'atleta). Finché la lista era piatta la
   differenza non si vedeva; i gruppi per mese pretendono che le date siano
   monotone, o lo stesso mese ricompare in tre punti dello scroll. `ordinaPerData`
   ordina per la data mostrata e tiene `created_at` come **spareggio**.
   ⚠️ La `Map` di `raggruppaPerMese` deduplica le chiavi da sé, quindi un test
   scritto con l'elemento più recente in testa **passa anche senza ordinare**:
   il caso che prende la mutazione ha il workout di luglio per primo (§9-sexies,
   di nuovo — è successo scrivendo questi test).
2. 🔴 **I chip si DERIVANO dai dati, non si scrivono a mano.** La query del
   coach esclude Custom ed Evento (`fetchWorkouts`), quindi un chip «Libero»
   fisso sarebbe sempre a zero — un filtro che non filtra niente e che, premuto,
   svuota la pagina. `conteggiPerCorsia` produce solo le corsie che hanno
   qualcosa dietro, e sotto le due corsie i chip non compaiono affatto.
3. 🔴 **Su una corsa mista non si dichiara nessun totale.** «400m di corsa e
   1 min di recupero» ha **due** totali veri e nessuno dei due è la lunghezza
   dell'allenamento: sommarli darebbe un numero plausibile e inventato, che è il
   caso peggiore. Lì la riga dice solo «8 fasi». Il totale compare quando tutte
   le fasi parlano la stessa unità.
   ⚠️ E `riepilogoCorsa` **non usa `parseDuration`**: quella toglie le lettere e
   legge il numero come minuti, quindi «400m» diventa 6h40m (BACKLOG #29). Su
   una scheda si nota; in una riga larga 200px diventa un «400′» che nessuno
   mette in dubbio.
4. **Le durate vengono da `stimaWorkout`**, la stessa funzione del riepilogo del
   builder e di quello della scheda. Se l'archivio dicesse «52′» dove la scheda
   dice «48′», nessuno dei due numeri sarebbe sbagliato da solo e non ci sarebbe
   modo di accorgersene.
5. **Custom ed Evento dicono solo il giorno.** Non hanno blocchi da contare né
   una durata da stimare, e «0 blocchi · 0′» sarebbe una bugia con l'aria di un
   dato — la stessa regola di `DurataBlocco` (§9-undecies punto 2).
6. **La colonna di destra è la stessa e le domande sono due.** Il coach vede a
   quante persone ha dato quel workout, l'atleta se l'ha fatto: a decidere è il
   ruolo di chi guarda, come il verso della nota vocale (§9-duodecies punto 7).
   ⚠️ Non è solo nascosto: la query dell'atleta **non carica** `athlete_workouts(id)`,
   quindi mostrare il contatore vorrebbe dire stampare `0` a tutti.
7. **L'intestazione del mese NON è appiccicata**, e non è una dimenticanza.
   Sarebbe dovuta stare a `top-<altezza della testata>`, ma quell'altezza cambia
   — il sottotitolo può mancare, i chip essere due o cinque — e un `top`
   sbagliato non dà errore: incolla l'intestazione a metà dei filtri. La testata
   **sì**, perché su una schermata di sola lista i filtri sono l'unico comando
   che c'è: se scorrono via, per cambiare corsia si deve risalire tutto lo
   scroll appena fatto, cioè proprio quando la lista è lunga.
   ⚠️ La safe area la porta la testata, non la pagina: un `pt` sul contenitore
   lascerebbe scorrere il contenuto sotto la barra di stato.

### 🔴 Tornando da un workout l'archivio riprende dov'era (02/10/2026)
`ScrollInCima` (§9-noviesdecies) non tocca lo scorrimento sui ritorni, ma non bastava:
l'archivio si rimontava con lo **scheletro**, che è corto, la pagina si accorciava e il
browser schiacciava lo scorrimento in cima — quando la lista arrivava non c'era più niente
da riprendere. Ora `WorkoutsArchive` tiene in una `Map` **di modulo** lista, ricerca,
filtro e posizione, **per voce di history** (`location.key`):
- vale solo su un ritorno (`POP`) a QUELLA voce: un'apertura nuova dell'archivio riparte
  dall'inizio, e la chiave `default` (prima pagina della sessione) non si memorizza;
- la ricarica dopo il ritorno è **silenziosa**: rimettere lo scheletro butterebbe via la
  posizione appena rimessa;
- le righe **non rifanno la cascata**: ci sono già, e farle rientrare direbbe «pagina nuova».
  Al suo posto la lista rientra **da sinistra** con `.ritorno-entra` (05/10/2026), il rovescio
  di `.passo-entra` con stessa durata, distanza e curva: senza, il ritorno era un taglio secco.
  La testata `sticky` resta ferma, come all'andata;
- ⚠️ salvataggio e ripristino stanno in un `useLayoutEffect`: la sua pulizia gira prima che
  `ScrollInCima` porti in cima la pagina nuova, quindi legge ancora la posizione vera.
✅ **Dal 05/10/2026 vale anche per la rubrica atleti** (posizione, vista e ricerca), e il
meccanismo sta in `src/useRipresa.js`: `useRipresa` va chiamato PRIMA degli `useState` (che
ci si inizializzano), `useRicorda` DOPO (ha bisogno dei loro valori). Il `nome` della pagina
entra nella chiave, così due liste non si scambiano mai lo stato.
⚠️ Il calendario **non è stato verificato**: se mostra lo scheletro al ritorno ha lo stesso
difetto, e la cura è la stessa — due righe con quei due hook.

### 🔴 Il difetto latente che il rework ha chiuso
Il filtro faceva `w.title.toLowerCase()` **nudo**. `workouts.title` può essere
`null` sui workout anteriori al titolo automatico del 24/08/2026 (§5), e un
`null` lì dentro non svuotava la ricerca: si portava via la pagina intera.
Ora il testo cercabile si costruisce con `filter(Boolean)`, e la riga senza
titolo si chiama «Senza titolo».

### La ricerca ora mantiene quello che il placeholder promette
Il campo diceva «Cerca per nome o categoria» e cercava esattamente quelli. Il
placeholder dell'artboard dice «Cerca titolo, blocco, esercizio», e
`testoCercabile` è la ragione per cui non è una promessa a vuoto: scandaglia
tipi di blocco, nomi degli esercizi, note e ritmi.
⚠️ L'indice si costruisce **una volta per lista** in un `useMemo`, non a ogni
tasto premuto: sono 171 workout da scandagliare nel jsonb.

### Cosa NON è stato implementato, e perché
- ~~**Il pannello «filtri avanzati»**~~ → **i filtri per tipo di blocco ci sono dal
  05/10/2026, ma NON come pannello.** Sono una **riga sua sotto le corsie** (`FiltriTipo`),
  a colonne uguali: ON/OFF, EMOM, AMRAP, For Time, Interval (fuori Cash In, Cash Out, Rest
  e WarmUp, che sono la cornice di quasi ogni seduta). 🔴 Ci sono volute tre stesure, tutte
  bocciate dal committente lo stesso giorno per ragioni che valgono anche altrove: dietro
  un'icona con un foglio **costava due tocchi in più**; in coda alla fila delle corsie
  **bisognava scorrere** per vederli. Regola che ne esce: **nessun filtro fuori schermo** —
  anche le corsie ora vanno a capo invece di scorrere. Senza conteggio nel chip: non ci
  sta in ~70px, e il totale lo dice la testata. Le corsie si escludono fra
  loro, i tipi si **sommano** (OR); «Tutti» azzera entrambi; i tipi si derivano dai dati
  (`conteggiPerTipo`). ⚠️ `tipiBlocco` passa da `getNormalizedBlocks`, o i workout
  legacy sparirebbero da ogni filtro.
  Quanto segue era la ragione per cui il pannello non c'era: Un bottone che non fa niente **accanto a filtri che
  funzionano** è peggio che non averlo — è la stessa regola del badge numerico
  sulla navbar (§9-quaterdecies) e del `rpeAtteso` che torna `null` invece di 5.
- **La voce «Archivio» nella tab bar.** L'artboard 1b la disegna, ma è lo stesso
  caso di `Scheda Atleta.dc.html`: il navbar dell'artboard è **sfondo di scena**,
  non un pezzo di design. La navbar vera non ha quella voce (§9-quaterdecies),
  e l'archivio si raggiunge dalla Home.

### I file nuovi
`src/lib/rigaArchivio.js` (logica pura, 30 test) e
`src/components/ArchivioUI.jsx` (sola presentazione), più `CARTA_RIGA` in
`lib/stiliCard.js`: la carta sollevata in formato riga, raggio e ombra
proporzionati a 60px invece che a una card intera.
⚠️ È una **costante nuova** e non `CARD` con il raggio sovrascritto:
`rounded-2xl` e `rounded-[22px]` hanno la stessa specificità, e a decidere è
l'ordine nel foglio di stile, non l'ordine nella stringa di classi.

---
