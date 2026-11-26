# Il recupero da Garmin nella scheda atleta — design

> 26/11/2026. Lavagna: `tools/design-garmin-scheda/index.html` (proposta 1, «colonnine»).
> Primo passo del lavoro «sistemare i dati presi dal Garmin»: qui solo la sezione
> recupero della scheda atleta.

## Perché
La card «Recupero · da Garmin» (`CardRecupero.jsx`) è l'ultimo pezzo della scheda atleta
con la grafica vecchia (card `#1e1e1e`, titolo piccolo, tre lineette). Il committente
la vuole nello stile della scheda ridisegnata e nella forma delle sue reference
(tessere separate, numero grande, pillola del confronto, tessera tinta quando qualcosa
non va), e vuole mostrare più dati, quelli che le altre app e i coach usano.

Cosa dicono i coach (ricerca del 26/11): contano le **tendenze rispetto alla media
dell'atleta**, più segnali concordi, e i dati dell'orologio **accanto a come l'atleta
dice di stare**; troppi numeri sono un difetto.

## Obiettivi
- Una sezione «Recupero» (titolo `TitoloSezione`, dettaglio «da Garmin») sotto
  «Come sta andando», fatta di tessere.
- In testa **la frase**: cosa non va e da quanto, scritta in parole.
- Più dati, tutti già salvati in `garmin_giornate`: punteggio e fasi del sonno, Body
  Battery (carica), stress medio, accanto a sonno, HRV e FC a riposo.
- «Come ha detto di stare» (tabella `come_stai`) nella stessa sezione.

## Non obiettivi / da non fare
- **Nessun punteggio unico 0–100** (scelta del committente: la frase sì, il punteggio no).
- **Nessuna linea** e nessun cursore in fondo alle tessere (provati e scartati).
- Nessun grafico del sonno a scalini: Garmin ci manda solo i totali delle fasi.
- Niente vetro: dalle reference si prendono le forme, non l'effetto.
- Nessun colore nuovo: l'arancione dei dati fuori norma è `orange-400` (`#fb923c`),
  già usato nella scheda per gli scarti negativi.
- Nessuna migrazione, nessun dato nuovo chiesto a Garmin.
- Fuori da questo passo: la riga «Garmin dal…» dell'anagrafica, le attività libere
  nel calendario, la Home del coach.

## Approcci considerati
- **A · quattro numeri due per due** ← scelto, poi portato nella forma delle reference.
- B · una riga per dato con la fascia della normalità: più ricco, ma lungo.
- C · le ultime 7 notti in tabella, dati e sensazione affiancati: racconta la settimana,
  ma i numeri si leggono male.
- Per il fondo delle tessere: cursore sulla normalità (scartato, «poco intuitivo»),
  linea dei 28 giorni (scartata), stanotte contro di solito, scala a tre →
  **colonnine delle ultime 7 notti** (scelta: l'unica che dice da quando dura).

## Com'è fatta (deciso con il committente sulla lavagna)
Dall'alto:
1. **Tessera «Da guardare»** (tinta arancione, icona orologio, «da N notti» a destra):
   la frase dai segnali di `segnaliRecupero`, più «Stamattina ha detto energia 2 su 5»
   in grigio se una risposta di oggi in `come_stai` è ≤ 2.
2. **Tessera larga «Sonno»**: ore e minuti grandi con la pillola dello scarto dalla
   media, il punteggio con la sua media, la barra delle fasi e sotto le quattro fasi in
   colonna (profondo, REM, leggero, sveglio).
3. **Quattro tessere due per due**: HRV notte, FC a riposo, Body Battery (carica della
   notte), Stress (media del giorno, su 100). Icona e nome, numero grande con l'unità
   piccola, pillola dello scarto dalla media, in fondo le **colonnine delle ultime 7
   notti** con la media tratteggiata.
4. **Tessera «Come ha detto di stare»**: le quattro risposte di oggi in x/5 con cinque
   tacche; ≤ 2 in arancione.
5. Riga grigia della fonte: «Ultimo dato: stanotte · medie sulle 4 settimane».

Forma (da `DESIGN.md`, aggiornare la sezione «La scheda atleta»): tessere `#18181b`,
bordo bianco all'8%, raggio 26px, numero ~38px peso 800, pillole tonde; la tessera
fuori norma ha la sfumatura arancione e il bordo arancione al 28%.

## Regole (scelte di Claude, da correggere se servono)
- **Quando una tessera è tinta**: solo se la sua metrica ha un segnale in
  `segnaliRecupero` (HRV, FC, sonno). Body Battery e stress non hanno una soglia, quindi
  non si tingono mai e la loro pillola resta grigia: niente soglie nuove inventate.
- **Le colonnine arancioni** sono i giorni della fila del segnale, nient'altro.
- **La media** è quella di `serieRecupero` (28 giorni, almeno 14 valori). Senza media:
  niente pillola né riga tratteggiata, e al posto della frase «Servono 15 notti per
  conoscere la sua media: ne ha N» (corretto dopo la revisione: la media vuole 14 valori prima dell'ultima notte) (la soglia con il progresso, regola dello zero).
- **Nessun segnale e media nota**: la tessera della frase c'è, neutra, «Tutto nella sua
  norma nelle ultime notti».
- **Un dato che manca non ha tessera** (né zero né «—» al posto del numero). Senza
  nessuna riga Garmin la sezione non esiste, come oggi.
- **Una notte senza dato** è uno spazio vuoto fra le colonnine, non una colonnina a zero.
- **«Come ha detto di stare»**: solo la risposta di oggi; se non c'è, la tessera non
  c'è.
- **Il valore mostrato** è quello dell'ultimo giorno con un dato; se non è oggi o ieri,
  la tessera dice il giorno («lun 24») al posto di «stanotte».
- **Sul proprio profilo** (l'atleta su `/profile`) la frase passa alla seconda persona
  («la tua media», «stamattina hai detto»).
- **Desktop**: le stesse tessere nella colonna di sinistra, dove sta oggi la card.

## Lasciato a chi costruisce
- Dove stanno i pezzi: la logica pura (frase, scarti, colonnine) in
  `src/lib/recuperoGarmin.js` con i test; la presentazione in `CardRecupero.jsx`
  riscritta (resta pigra con `lazy()`).
- La lettura di `come_stai` di oggi in `AthleteDetail` (la policy la permette già al
  coach dell'atleta).
- I semi del demo (`garmin_giornate` di Sara ha già tutti i campi; serve una riga
  `come_stai` di oggi) e la memoria in `docs/memoria/garmin.md`.
