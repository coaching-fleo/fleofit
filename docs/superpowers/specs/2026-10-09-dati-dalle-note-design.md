# Dati dalle note — design

> 09/10/2026 · branch `app` · stato: **specifica da approvare**.
> Due decisioni restano al committente (§7): senza, si sviluppa sull'ambiente di
> prova ma non si rilascia.

## 1. Il problema

Il coach decide su due segnali: **fatto / non fatto** e **RPE** (più gradimento).
Tutto il resto di ciò che l'atleta racconta — tempi, carichi, «troppo facile»,
«ho saltato i burpees», «settimana pesante al lavoro» — sta nel testo libero di
`athlete_workouts.notes`, e per saperlo bisogna rileggere le note una per una.

L'obiettivo **non** è chiedere più dati all'atleta: è trasformare in dati quelli
che scrive già, **una volta sola**, secondo uno **standard fisso**, salvati sul
server legati all'atleta, e mostrarli in **grafici dedicati nella scheda atleta**.

## 2. Perimetro

**Dentro (v1)**
- Solo note **scritte** dall'atleta alla chiusura di un allenamento.
- Tre categorie: **risultati dichiarati**, **sensazioni sul workout**, **stato**
  limitato a fattori non sanitari.
- Grafici nella scheda atleta, solo coach.

**Fuori (v1), di proposito**
- **Note vocali**: richiedono trascrizione, fase successiva.
- **Dolori e infortuni**, **sonno**, **stress**, **malattia**, **ciclo**,
  **alimentazione**: dati relativi alla salute (GDPR art. 9; per Apple, «Salute e
  fitness»). Entrano in una v2 solo dopo le verifiche del §7.2. Lo standard ha il
  campo `versione` apposta.
- Uso dei dati in `/report/:id`, nella Home coach e come strumento della ricerca IA:
  lo standard è pensato per servirli, ma non fanno parte di questo progetto.
- Un tasto «analizza tutto lo storico»: il recupero avviene a gruppi, apertura dopo
  apertura (§5).

## 3. Lo standard `estrazione` v1

Un oggetto per nota analizzata, **anche vuoto**: una nota senza niente di utile è
«già letta» e non torna all'IA.

```jsonc
{
  "versione": 1,
  "athlete_workout_id": "uuid",
  "athlete_id": "uuid",
  "data": "2026-10-09",            // completed_date dell'assegnazione
  "impronta": "sha1 del testo ripulito",
  "stato": [{
    "fattore": "stanchezza" | "motivazione" | "viaggio" | "lavoro",
    "segno": -1 | 0 | 1,           // peggio del normale / normale / meglio
    "citazione": "gambe distrutte da ieri"
  }],
  "risultati": [{
    "esercizio": "Wall Balls",     // solo nomi presenti nel workout, altrimenti null
    "misura": "tempo" | "kg" | "reps" | "round" | "distanza" | "passo",
    "valore": 400,
    "unita": "s" | "kg" | "reps" | "round" | "m" | "s/km",
    "citazione": "wall balls 9kg finite in 6:40"
  }],
  "sensazioni": {
    "difficolta": "troppo_facile" | "giusta" | "troppo_dura" | null,
    "citazione": "string | null",
    "modifiche": [{
      "tipo": "saltato" | "ridotto" | "sostituito" | "aggiunto",
      "esercizio": "Burpees" | null,
      "citazione": "burpees saltati, spalla"
    }]
  }
}
```

Note sullo standard:
- **`segno`, non un voto.** Da «stanco morto» si ricava «peggio del normale», non un 3/10.
- **Una citazione può generare più voci**: «wall balls 9kg finite in 6:40» →
  `kg: 9` e `tempo: 400 s`, entrambe con la stessa citazione.
- **Normalizzazione**: tempi in secondi, distanze in metri, passo in secondi/km.
- Una modifica che cita un motivo sanitario («spalla») si salva come modifica; il
  motivo **non** si estrae (v1 non ha dolori), resta solo dentro la citazione.

### Le regole che lo tengono onesto
Controllate dalla funzione (`regole.ts`), **non** affidate all'IA. Una voce che non
passa si scarta da sola; la nota non si scarta.
1. La `citazione` deve comparire **nel testo della nota** (confronto senza
   maiuscole, spazi multipli e accenti).
2. Ogni numero di un risultato deve comparire **nella sua citazione**
   («6:40» → 400 s solo se «6:40» c'è).
3. `esercizio` deve essere uno dei nomi del workout passati all'IA; altrimenti `null`.
4. `fattore`, `misura`, `unita`, `tipo`, `difficolta` solo dalle liste chiuse.
5. **Un fattore non citato non esiste**: nessuna voce di default.
6. RPE e gradimento **non** si estraggono: si tolgono dal testo prima dell'invio
   con la stessa logica di `src/lib/rpe.js` e `src/lib/gradimento.js`.

## 4. I grafici — sezione «Dalle note» della scheda atleta

- **Dove**: `AthleteDetail`, sotto il bento e prima di «Prossimo obiettivo».
- **Solo coach**: stessa guardia di ruolo della pillola «In pausa» (la scheda è
  anche `/profile` dell'atleta).
- **Componente caricato su richiesta**: `src/components/DalleNoteUI.jsx` con
  `React.lazy`, per non pesare sul chunk della scheda. SVG scritto a mano come
  l'anello e la linea del volume già presenti: **nessuna libreria di grafici**.
- **Finestra**: 30 / 90 / 365 giorni, di partenza 90.
- **Riga di copertura** in testa: «38 note analizzate su 41 · 3 in analisi», oppure
  «analisi sospesa: riprova più tardi».

### Le tre card
1. **Risultati** — una mini-linea per *esercizio + misura* (es. «Wall Balls · tempo»)
   con **almeno 2 valori**; con un valore solo: «6:40 · 9 ott, unico dato». Il
   confronto con il valore precedente tiene conto del verso: per `tempo` e `passo`
   meglio = più basso.
2. **Sensazioni** — barre per settimana divise in troppo facile / giusta / troppo
   dura; sotto, **«Modificati più spesso»**: esercizi saltati, ridotti o sostituiti,
   con il conteggio. Tocco su una voce → citazioni con data e workout.
3. **Stato** — una riga per fattore **citato almeno una volta**: striscia di giorni
   colorata per segno, con una tacca nei giorni con **RPE ≥ 8** (da `rpeDichiarato`).

### Stati vuoti (regola §9: nessuno zero)
- Card senza dati nella finestra → una riga, es. «Nessun risultato nelle note degli
  ultimi 90 giorni». Nessun grafico a zero.
- Atleta che non scrive note nel periodo → «Sofia non ha scritto note in questo
  periodo», nessuna card.

### Colori
Palette invariata (CLAUDE.md regola 3): brand giallo per gli accenti, scala RPE
esistente (verde → giallo → arancione → rosso) per difficoltà e segno, grigi delle
superfici. Nessun colore nuovo.

## 5. L'estrazione

### Edge Function `estrai-note` (nuova)
- **Solo admin**, con `_shared/admin.ts`. La web app su `main` non la chiama: un
  deploy non tocca la produzione web.
- **Azioni**: `leggi` (gli estratti di un atleta + i conteggi di copertura) ed
  `estrai` (le note mancanti di un atleta).

### Il giro di `estrai`, per un atleta
1. Legge da sola, con la chiave di servizio, le assegnazioni **completate con testo**
   dell'atleta e gli esercizi dei loro workout. Il testo **non** arriva dal telefono.
2. Ripulisce il testo (via marcatori RPE e gradimento), calcola l'impronta, scarta le
   note già estratte con stessa impronta e stessa `versione`.
3. Manda le mancanti all'IA **a gruppi di 15, al massimo 3 gruppi per chiamata**.
   Ad ogni nota: **solo il testo ripulito e i nomi degli esercizi** — niente nome
   dell'atleta, niente id, niente data (l'aggancio avviene con un indice locale).
4. **Solo Groq** (`_shared/groq.ts`, modello JSON, temperatura 0). **Nessuna riserva
   Gemini**: il piano gratuito di Google può usare i dati (§7.2).
5. Valida con `regole.ts` (§3) e salva **una riga per nota**, anche vuota, con un
   upsert su `athlete_workout_id`.

### Quando parte
All'apertura della scheda atleta da parte del coach: prima `leggi` (si disegna
subito), poi `estrai` in sottofondo se ci sono note mancanti, poi una nuova `leggi`.
Un atleta con molto storico si recupera in più aperture, e la copertura lo dice.

### Dati che cambiano
- Nota modificata → impronta diversa → rianalisi.
- Nota svuotata o assegnazione tornata a «da fare» → l'estratto si cancella.
- Atleta cancellato → vedi §7.1 (con la tabella sparisce in cascata).

### Errori
- **Groq giù o quota finita**: niente si salva, le note restano «in analisi», la
  scheda funziona con gli estratti esistenti e la copertura lo dice. Mai un errore a
  tutta pagina.
- **Risposta IA malformata per un gruppo**: il gruppo non si salva e riprova alla
  prossima apertura. Una voce malformata si scarta da sola (§3).
- **Due dispositivi insieme**: l'upsert rende idempotente il salvataggio.

### Lato client
`src/lib/noteEstratte.js` — l'unico punto che parla con la funzione:
`leggiEstratti(athleteId)`, `estraiMancanti(athleteId)`.
`src/lib/dalleNote.js` — funzioni pure per i grafici: serie dei risultati,
settimane delle sensazioni, strisce dello stato, conteggio delle modifiche,
stati vuoti.

## 6. Verifica
- **`supabase/functions/estrai-note/regole.ts`** con vitest: citazione assente →
  voce scartata; numero assente dalla citazione → scartata; «6:40» → 400 s;
  «4:55/km» → 295 s/km; «1,2 km» → 1200 m; esercizio fuori dal workout → `null`;
  valori fuori lista → scartati; marcatori RPE e gradimento tolti; impronta stabile
  sullo stesso testo.
- **`src/lib/dalleNote.js`**: verso del confronto per tempo/passo, linea solo da 2
  valori, fattori mai citati assenti, finestre 30/90/365, nessuno zero.
- **`DalleNoteUI`** con `montaPagina`: nascosta all'atleta, copertura, stati vuoti,
  analisi sospesa.
- **Ogni test si vede fallire** rompendo apposta il codice che copre (CLAUDE.md §9).
- **Set di prova a mano**: ~25 note realistiche in italiano (abbreviazioni, errori di
  battitura, frasi miste) con l'estrazione attesa scritta a mano, per misurare la
  qualità prima del rilascio. Non entra nella suite: la risposta dell'IA non è
  deterministica.
- **Ambiente di prova**: i semi di `npm run demo` ricevono note ricche e i loro
  estratti, così i grafici si vedono senza dati veri.

## 7. Decisioni del committente

### 7.1 Dove si salvano gli estratti
Lo schema è congelato (CLAUDE.md regola 0-bis) e nessuna tabella esistente ha un
posto adatto. Le due strade:

| | **A · Tabella `note_estratte`** (consigliata) | **B · Bucket Storage privato** |
|---|---|---|
| Cosa serve | **una migrazione**: sblocco esplicito dello schema | un bucket nuovo `estratti`, privato, **senza policy** (solo chiave di servizio) |
| Forma | una riga per nota: `athlete_workout_id` (PK, FK → `athlete_workouts` ON DELETE CASCADE), `athlete_id`, `data`, `impronta`, `versione`, `estrazione jsonb`, `creato_at` | un file `estratti/<athlete_id>.json` per atleta |
| Policy | lettura e scrittura **solo admin**, sia `USING` sia `WITH CHECK`, con la stessa lista di `ADMIN_EMAILS` e `_shared/admin.ts` | nessuna: accesso solo dalla funzione |
| Atleta cancellato | sparisce in cascata con la sua storia | il file resta orfano: serve una pulizia apposta |
| Impatto su `main` | nessuno: una tabella che `main` non conosce non cambia niente | nessuno |
| Domani | è la destinazione finale | va travasata in tabella |

Il codice isola il salvataggio in `estrai-note` e `noteEstratte.js`: la scelta cambia
solo quei due punti. ⚠️ Gli altri due bucket sono **pubblici**: un bucket pubblico qui
è escluso.

### 7.2 Privacy dell'IA
Anche senza le categorie sanitarie, **all'IA arriva il testo intero della nota**, e
l'atleta può scriverci di tutto. Prima di usare `estrai-note` con atleti veri:
1. Attivare la **Zero Data Retention** in GroqCloud → Data Controls.
2. Leggere Services Agreement e DPA di Groq (console.groq.com/docs/legal) e
   confermare che **non addestra sui dati dei clienti** (oggi lo dicono solo fonti
   secondarie).
3. Valutare se l'informativa privacy dell'app deve citare l'elaborazione delle note
   con un fornitore IA, e se l'etichetta App Store va aggiornata.
4. Collegato: la voce **#62** del backlog (la ricerca manda già estratti delle note a
   Gemini gratuito) ha lo stesso problema, in forma più grave.

## 8. File toccati
| File | |
|---|---|
| `supabase/functions/estrai-note/index.ts`, `regole.ts`, `deno.json` | nuovi |
| `src/lib/noteEstratte.js`, `src/lib/dalleNote.js` (+ test) | nuovi |
| `src/components/DalleNoteUI.jsx` (+ test) | nuovo |
| `src/pages/AthleteDetail.jsx` / `SchedaAtletaUI.jsx` | la sezione, caricata pigra, solo coach |
| semi dell'ambiente di prova | note ricche ed estratti |
| `docs/memoria/scheda-atleta.md`, `database.md`, `BACKLOG.md` | documentazione |
| migrazione **oppure** creazione bucket | solo dopo la decisione §7.1 |
