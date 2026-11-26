# Crea workout · il primo schermo «Tocca e parti» — design

Data: 26/11/2026 · Lavagna: `tools/design-crea-workout/` (versione **A**, scelta dal committente)

## Perché
Al passo 1 il bottone «Costruisci l'allenamento» finisce in fondo allo schermo (lo spinge il
`mt-auto`), e Nome e Data stanno lì anche se sono facoltativi: la data parte già giusta (oggi,
o il giorno del Calendario) e quasi nessuno la cambia. Il primo schermo deve fare una domanda
sola e lasciar partire con un tocco.

## Cosa cambia (solo telefono; il desktop non ha il passo 1 e resta com'è)
1. **Passo 1 = la domanda e le quattro card, nient'altro.** Sotto il titolo una riga:
   «Tocca per iniziare. Nome e data li cambi dopo, se servono.»
   Il tocco su una card imposta la categoria **e** va al passo 2. Spariscono la riga Nome, la
   riga Data, il separatore e il bottone «Costruisci l'allenamento» (la barra del passo 1 non
   mostra niente).
2. **La card** perde il pallino radio: a destra una freccia `ChevronRight`; l'icona è tinta del
   colore della categoria (fondo al 12%, bordo al 25%). La categoria già scelta — si torna al
   passo 1 da un workout in costruzione o in modifica — resta evidenziata come oggi.
3. **Passo 2, testata**: il titolo (con matita e codice) resta il bottone
   `aria-label="Modifica nome e data"`, ma ora **apre un foglio dal basso** con Nome (con i dadi
   del nome casuale) e Data (`CustomDatePicker`) e un bottone «Fatto». Non torna più al passo 1.
4. **Passo 2, sotto la testata**: una riga di due pillole — la categoria (colore suo, tocco =
   torna al passo 1 per cambiarla) e la data («Oggi, gio 26 nov» / «Domani, …» / «Lun 1 dic»,
   tocco = apre lo stesso foglio).
5. La freccia indietro del passo 2 torna al passo 1, come oggi. La pillola dei passi «1 / 2»
   resta.

## Cosa NON cambia
- Stato e salvataggio: `category`, `title`, `date` e la loro data iniziale (`?date=` o oggi),
  la bozza, il titolo generato, `workouts.date`, la data dell'atleta in modifica (`awId`).
- In modifica si apre ancora al passo 2.
- Modalità modello (niente passi), desktop (`CreaWorkoutDesktop`).
- Nessuna migrazione: solo interfaccia.

## Approcci considerati
- **A · Tocca e parti** (scelta): un tocco solo, il bottone sparisce; nome e data in una pillola.
  Costo: chi sbaglia categoria torna indietro con la freccia o la pillola della categoria.
- **B · Bottone in vista**: passo 1 più corto con il bottone a metà schermo. Scartata: resta un
  tocco in più senza motivo.
- **C · Tipo e partenza**: griglia 2×2 più «Come vuoi partire?» (da zero, IA, modello, testo).
  Scartata per ora: cambia anche l'ingresso al builder, lavoro più grande.

## Scelte mie (da controllare)
- L'aptica: `vibraScelta` resta solo quando la categoria cambia, come oggi.
- Il foglio nome/data usa `useBottomSheet` (maniglia, swipe giù per chiudere), via `createPortal`,
  e si chiude col tasto indietro Android (ha «Chiudi»/X).
- I test che cliccano «Costruisci l'allenamento» (`CreaWorkoutBuilder.test.jsx`,
  `RunningStepRowMemo.test.jsx`, `useTastiera.test.jsx`) passano al tocco sulla card; il test
  «Modifica nome e data» apre il foglio invece del passo 1.
- Nota in `docs/memoria/crea-workout.md` (il punto 5 di §9-undecies cambia: nome e data non
  vivono più al passo 1).
