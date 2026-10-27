# Programmazione automatica con IA — design

Data: 26/10/2026 · stato: **in revisione dal committente**
Nessun codice e nessuna migrazione: lo schema è congelato (CLAUDE.md §0, regola 0-bis).
Ogni tabella proposta al §10 richiede un sì esplicito separato.

## 1. Obiettivo

Oggi «Genera con IA» (`CreateWorkout.jsx`, Edge Function `ai-workout`) scrive **un
workout alla volta**. Si vuole che l'IA prepari un'intera **programmazione su più
settimane per ciascun atleta di un coach**, partendo dai parametri dell'atleta e dal
**metodo del coach**, con pochissimo lavoro del coach, e che la adatti ai feedback
(RPE, gradimento, «Come stai oggi», note).

**Riuscito quando:** un coach configura il proprio metodo una volta (~10 minuti), un
atleta compila il questionario (~3 minuti), e da lì ogni settimana il coach trova le
sedute pronte, nello stile suo, e le approva cambiandone poco. La metrica è il §6.5:
la quota di sedute approvate **senza modifiche o con piccole modifiche**.

## 2. Decisioni del committente (26/10/2026)

| # | Decisione |
|---|---|
| P1 | È un **prodotto da vendere ad altri coach**: costi, margine e separazione fra coach sono requisiti |
| P2 | Modello di prezzo da proporre nello studio (§7.3) |
| P3 | **Bozza da approvare**: niente arriva all'atleta senza l'approvazione del coach |
| P4 | Orizzonte: **scheletro fino alla gara + sedute scritte una settimana alla volta** |
| P5 | I parametri li compila **l'atleta** con un questionario; il coach li vede, corregge e conferma |
| P6 | Infortuni e limitazioni **anche dall'atleta**, quindi servono consenso esplicito e informativa aggiornata |
| P7 | Metodo del coach = **procedura guidata + stile dai suoi workout + correzioni che diventano regole** confermate. Per un coach senza storico l'importazione dei workout è **da definire** in un lavoro successivo |
| P8 | Adattamento **settimanale + allarmi** a metà settimana, sempre come proposta al coach |
| P9 | Le categorie della settimana le decide il **profilo dell'atleta** (Hyrox, solo corsa, solo palestra, ibrido); il metodo dice come si compone la settimana per ciascun profilo |
| P10 | Architettura **A, «scheletro controllato»**: l'IA propone e scrive, il codice tiene i numeri del metodo e verifica ogni seduta. Il fornitore dell'IA (cloud o locale) resta intercambiabile |

## 3. Architettura in una pagina

```
Questionario atleta ─┐                      ┌─ Metodo del coach (4 strati, §5)
Valutazione coach ───┼─► PROFILO (versioni) │
Dati calcolati ──────┘          │           │
                                ▼           ▼
                 ┌──────── SCHELETRO (IA propone, codice verifica) ──► coach approva una volta
                 │
   ogni settimana▼
   Riassunto feedback (codice) ─► IA scrive le sedute ─► VALIDATORE (codice) ─┐
                                        ▲                     │ errore: 1 rifacimento
                                        └─────────────────────┘
                                                              ▼
              workout veri NON assegnati ─► revisione del coach nel builder ─► «Approva settimana»
                                                              │                    │
                                     correzioni ─► proposte di regola     assegnazioni (athlete_workouts)
   ogni giorno: regole d'allarme (codice) ─► proposta di modifica (IA) ─► coach accetta / rifiuta
```

Le tre regole che reggono tutto:
- **L'IA non è una fonte di numeri.** Durate, carico e progressione li controlla il
  codice con gli strumenti che esistono già (`durataBlocco` e `stimaWorkout`,
  `preparaBlocchiIA`, `preparaFasiIA`, `preparaGymIA`, `trovaEsercizio`). È la stessa
  lezione di «Dalle note» (`validaEstrazione`).
- **Le sedute sono workout nel formato `sections` di oggi**, quindi si aprono e si
  cambiano nel builder (regola 5-ter) e funzionano su web, iOS e Android senza
  schermate nuove per l'atleta.
- **Niente arriva all'atleta senza il coach** (P3), compresi gli adattamenti (P8).

## 4. I parametri dell'atleta

Il **questionario** lo compila l'atleta (~3 minuti, al primo accesso o quando il coach
lo chiede). Il coach lo vede, lo corregge e lo conferma. Il profilo ha **versioni**:
ogni programmazione ricorda con quale versione è nata.

| Gruppo | Campi | Chi |
|---|---|---|
| Obiettivo | disciplina (Hyrox · Corsa · Palestra · Ibrido); obiettivo (gara · migliorare un tempo · forma generale · forza · dimagrimento); gara dal calendario (`Event`) oppure data e tipo; tempo obiettivo | atleta |
| Disponibilità | sedute a settimana, giorni possibili, minuti massimi per seduta, giorno della seduta chiave o del lungo | atleta |
| Attrezzatura | palestra Hyrox completa · palestra normale · casa · solo corsa; ergometri (SkiErg, Rowing, bike); sled sì/no | atleta |
| Livello e riferimenti | anni di allenamento, gare fatte, tempi recenti (5 km, 10 km, ultima Hyrox), carichi abituali (facoltativi) | atleta |
| Fisico | età (da `athletes.birth_date`), peso e altezza (già in `athletes`), sesso (divisioni e pesi delle stazioni Hyrox) | atleta |
| Salute ⚠️ | infortuni attuali o passati, dolori, condizioni da sapere, cosa evitare | atleta, **solo con consenso salute esplicito e separato** |
| Valutazione del coach | livello (principiante → élite), priorità, vincoli operativi («niente salti per 3 settimane»), note per l'IA | solo coach, l'atleta non la vede |
| Calcolati | aderenza e RPE a 30 giorni (`andamento.js`), carico settimanale reale (`stimaWorkout`), tendenze di «Dalle note», ultimi «Come stai» | app |

Regole:
1. **Senza consenso salute, i campi salute non esistono**: il questionario li salta e
   all'IA arrivano solo i vincoli operativi del coach. Il consenso e l'informativa si
   legano alla spec `2026-10-14-consenso-privacy-design.md` (voce in stand-by nel BACKLOG)
   e sono **bloccanti** per la raccolta dei dati di salute.
2. **All'IA il profilo arriva pseudonimizzato**: niente nome, id, email, foto. Età in
   fascia, gara come «tra 11 settimane», il resto come dati.
3. **Un campo mancante non si inventa**: è «non dichiarato», e il metodo decide il valore
   prudente (CLAUDE.md §9, «nessun numero si inventa»).

## 5. Il metodo del coach

Un documento strutturato **per coach**, con versioni, in quattro strati. Il codice legge
i primi due come numeri; l'IA li legge tutti.

1. **Procedura guidata** (~10 minuti al primo uso, si può rifare):
   - *settimana tipo per profilo*: per Hyrox, Corsa, Palestra e Ibrido, quante sedute di
     ciascuna categoria con N sedute disponibili; dove stanno i giorni duri; giorni duri
     mai consecutivi sì/no;
   - *periodizzazione*: fasi verso la gara (base → costruzione → specifico → scarico) e
     loro durata; scarico ogni 3 o 4 settimane e di quanto; tapering degli ultimi 7–14 giorni;
   - *volumi per livello*: minuti a settimana, progressione massima settimana su settimana,
     RPE medio atteso, quota di lavoro duro;
   - *riscaldamento e defaticamento*: sempre, mai, o per categoria, con la durata.
2. **Preferenze e divieti**: esercizi preferiti e vietati, tipi di blocco preferiti, zone
   e passi che usa, come chiama le cose, lunghezza e tono delle note per l'atleta.
3. **Lo stile, dai suoi workout**: a ogni generazione l'app sceglie fra i workout del coach
   (libreria privata, decisione D6 del multi-coach) gli **esempi più vicini**: stessa
   categoria, fase e livello, preferendo quelli completati con RPE vicino all'atteso e
   gradimento buono. Il coach può anche indicare 5–10 workout «modello». Il filtro è sui
   dati, senza database vettoriali finché basta. Senza storico si usano esempi neutri
   (l'importazione per i coach nuovi è da definire, P7).
4. **Regole imparate**: quando il coach corregge una seduta generata, l'app confronta prima
   e dopo e, se la correzione sembra una regola, la **propone** («Non metti mai il Sled Push
   il lunedì: lo salvo come regola?»). Diventa una regola solo con il sì del coach; si può
   sempre vedere, modificare, cancellare.

Regole:
- **Il metodo è privato del coach**: nessun altro coach lo vede né l'IA lo usa per altri.
  La separazione la fa la RLS. Gli admin lo leggono, coerenti con la decisione D2.
- **Il metodo è una configurazione in chiaro, non un prompt nascosto**: il coach vede
  cosa l'IA sa di lui.

## 6. Il flusso

### 6.1 Avvio della programmazione
1. Profilo confermato e metodo presente → il coach preme **«Crea programmazione»**.
2. L'IA propone lo **scheletro** fino alla gara (8–12 settimane se non c'è gara): fasi,
   obiettivo e minuti previsti per settimana, sedute per categoria. Il codice lo confronta
   con il metodo (progressione massima, scarichi, tapering, sedute disponibili) e corregge
   o rimanda indietro ciò che non torna.
3. Il coach vede il percorso (una riga per settimana) e lo modifica o approva **una volta**.

### 6.2 La settimana
4. **Domenica notte** (o subito, su richiesta) l'IA scrive le sedute della settimana dopo.
   Riceve: metodo, esempi del coach, profilo, obiettivo della settimana, riassunto dei
   feedback. Restituisce workout nel formato `sections` per la categoria di ciascuna seduta,
   riusando le istruzioni di formato di `CATEGORIE_IA`.
5. Il **validatore** controlla ogni seduta: formato (le funzioni `prepara*` di oggi), nomi
   del picker, durata entro ±15% dell'obiettivo, esercizi vietati, attrezzatura
   dell'atleta, vincoli di salute. Una seduta che non passa torna all'IA **una volta** con
   l'errore; se fallisce ancora resta marcata «da rivedere», con il motivo.
6. Le sedute sono **workout veri non assegnati**: stanno nella libreria del coach, legate
   alla programmazione e nascoste dall'archivio normale. L'atleta non le vede perché
   `vedo_workout` (multi-coach) passa da `athlete_workouts`, e un'assegnazione non c'è ancora.
7. Il coach riceve una notifica («Settimana 4 di Marco pronta») e apre la **revisione**:
   le sedute della settimana, ognuna con due righe di «perché» («RPE medio 8,7 contro 7
   atteso: volume −15%»). Le cambia **nel builder di oggi** o chiede una modifica a parole
   («Genera con IA» in modalità modifica).
8. **«Approva settimana»** crea le assegnazioni: l'atleta trova le sedute nel calendario.
   Per ogni seduta si registra quanto l'ha cambiata il coach (§6.5), e le correzioni
   diventano proposte di regola (§5, strato 4).

### 6.3 Il riassunto dei feedback
Lo fa il **codice**, non l'IA: aderenza, RPE dichiarato contro atteso (`rpeDichiarato`,
**mai** `parseNotesAndRpe`), gradimento (`gradimento.js`), medie di «Come stai», estratti di
«Dalle note» (`note_estratte`). All'IA arrivano numeri e citazioni brevi, non le note intere:
meno token e meno dati personali.

### 6.4 Gli allarmi a metà settimana
Una regola di codice gira ogni mattina. Scatta su: «Come stai» molto basso per 2 giorni,
seduta saltata, RPE ≥ 9 dove era atteso ≤ 7, nota con parole di dolore. Allora l'IA prepara
una **proposta di modifica** delle sedute rimaste; il coach la accetta, la cambia o la
rifiuta. Senza il coach non cambia niente per l'atleta.

### 6.5 La misura della qualità in produzione
Per ogni seduta approvata: `nessuna` modifica · `piccola` (numeri, un esercizio) · `rifatta`.
È la metrica vera, per coach e per modello: dice quando le istruzioni peggiorano.

### 6.6 Casi limite
- **Il profilo cambia** (nuova gara, infortunio): si rigenera lo scheletro dalla settimana
  successiva; le settimane approvate non si toccano.
- **Il coach non approva** entro l'inizio della settimana: le sedute restano bozze,
  l'atleta non riceve nulla e il coach riceve un promemoria. Mai pubblicazione automatica (P3).
- **IA non disponibile** (quota, errore): si passa alla riserva (§7.2); se fallisce anche
  quella, la settimana resta «da generare» con un messaggio breve (lezione di `erroreIA.js`).
- **Un'app vecchia** non conosce le programmazioni: vede solo workout e assegnazioni normali,
  quindi funziona senza modifiche.

## 7. La scelta dell'IA, i costi e il prezzo

### 7.1 Consumo stimato
Per atleta al mese (prudente): generazione settimanale ×4,3 con ~20% di rifacimenti,
scheletro ripartito sui mesi, ~8 modifiche chieste dal coach, ~2 allarmi →
**≈ 175k token in ingresso e 85k in uscita** (il ragionamento del modello si paga come
uscita). Circa metà è «pesante» (scheletro e settimane), metà «leggera» (modifiche e allarmi).
Le stime vanno confermate con le misure reali della fase 0 (§9).

### 7.2 Le opzioni (prezzi di listino, ottobre 2026)

| Opzione | $/atleta/mese | Note |
|---|---|---|
| Groq `gpt-oss-120b`, tutto | ≈ 0,08 | già in uso, Zero Data Retention; qualità da verificare sul piano lungo |
| Gemini 2.5 Flash a pagamento, tutto | ≈ 0,27 | il piano a pagamento non usa i dati; modello vecchio, rischio ritiro |
| Gemini 3.6/3.8 Flash, tutto | ≈ 0,45 oggi, ≈ 0,90 dal 01/01/2027 | prezzo raddoppiato da gennaio |
| Claude Sonnet 5.5, tutto | ≈ 1,20 | il più forte dei modelli medi; dati API non usati per addestrare |
| **Raccomandato: Sonnet 5.5 in Batch notturno (scheletro e settimane) + Groq (modifiche e allarmi)** | **≈ 0,40** | Batch −50%; ≈ 0,76 senza Batch |
| Claude Opus 5.5, tutto | ≈ 2,40 | eccessivo per questo compito |
| Self-hosting, 1 H100 in affitto UE | ≈ 1.800 $ fissi | conviene rispetto al raccomandato oltre ~4–5.000 atleti |
| Mac Studio 128 GB in sede, `gpt-oss-120b` | ≈ 165 € fissi (ammortamento 3 anni + corrente) | solo per il notturno (~4–5 minuti per settimana-atleta); conviene oltre ~450 atleti |

**Raccomandazione.** Il modello si sceglie con una **gara sul banco di prova** (§8):
Sonnet 5.5, Gemini Flash a pagamento e Groq `gpt-oss-120b`. Vince il più economico che
supera la soglia. Ci si aspetta la combinazione «Sonnet in Batch + Groq».

Regole fisse:
- il fornitore è una configurazione con una riserva, come oggi in `ai-workout`;
- **mai piani gratuiti**: il fornitore usa i dati e il limite è di 20 richieste al giorno;
- a ogni fornitore va solo il profilo pseudonimizzato, e solo a chi non conserva o non
  usa i dati (ZDR o piano a pagamento senza uso dei dati).

**Il modello locale** si aggiunge più avanti come fornitore del notturno, senza cambiare
l'architettura. Pro: i dati di salute non escono. Contro: tunnel sicuro verso le Edge
Function, manutenzione, una macchina che può spegnersi (serve comunque la riserva cloud) e
modifiche interattive lente (1–2 minuti). Ha senso da qualche centinaio di atleti, o per
una scelta di privacy.

### 7.3 Proposta di prezzo
Abbonamento del coach, a fasce di **atleti attivi con una programmazione**:

| Fascia | Prezzo | Atleti | IA nel caso peggiore (Sonnet senza Batch ≈ 1,10 €) | IA prevista (≈ 0,37 €) | Margine sull'IA, caso previsto |
|---|---|---|---|---|---|
| Solo | 29 €/mese | fino a 10 | 11 € | 3,7 € | ≈ 87% |
| Pro | 69 €/mese | fino a 30 | 33 € | 11 € | ≈ 84% |
| Studio | 149 €/mese | fino a 80 | 88 € | 30 € | ≈ 80% |
| Oltre | +1,50 €/atleta | — | 1,10 € | 0,37 € | ≈ 75% |

Protezioni del margine:
- **uso corretto** per atleta al mese (es. 1 scheletro, 6 rigenerazioni di settimana,
  40 modifiche); oltre, le richieste vanno al modello economico;
- **contatore** dei token e del costo per coach (tabella `uso_ia`), per vedere subito chi
  costa più di quanto paga.

Il margine vero va calcolato sommando anche i costi fissi non legati all'IA (Supabase,
Store, assistenza, commissioni sui pagamenti), che non dipendono dal numero di atleti.
Abbonamenti e pagamenti negli Store sono un progetto a parte (fase 4, §9).

## 8. «Addestrare» la soluzione e valutarla

### 8.1 Cosa facciamo noi
1. **Istruzioni di sistema** per scheletro e settimana, divise per categoria come
   `CATEGORIE_IA`: si riusano le istruzioni di formato esistenti, più una parte sul
   «programmare» (leggere obiettivo, fase e feedback). **Ogni categoria nuova porta con sé
   anche la sua parte di programmazione**: è un'estensione della regola 5-bis, con un test
   guardiano come `iaCategorie.test.js`.
2. **Esempi** (few-shot) scelti a ogni chiamata fra i workout **del coach stesso** (§5, strato 3).
3. **Recupero dei dati** (RAG): profilo, riassunto dei feedback, «Dalle note» ed esempi
   entrano come dati strutturati. Il metodo sta in testa al prompt e non cambia fra un
   atleta e l'altro dello stesso coach: così si sfrutta la cache dei fornitori (input in
   cache a circa il 10% del prezzo).
4. **Il banco di prova**: **30 casi inventati** (mai dati veri), come
   `tools/prova-estrai-note/`. Discipline, livelli, gara vicina e lontana, infortunio,
   feedback «troppo duro», tre metodi di coach diversi. Ogni modello e ogni modifica alle
   istruzioni si misura su tutti i 30:
   - *controlli automatici*: formato valido, durata entro ±15%, progressione e scarichi
     del metodo, nessun esercizio vietato, attrezzatura e vincoli di salute rispettati;
   - *giudizio del coach* (una volta per candidato, alla cieca): «la firmerei così / con
     piccole correzioni / la rifarei»;
   - *soglia per la produzione*: **100%** dei controlli di salute (un vincolo violato
     boccia il caso), **≥ 95%** degli altri controlli, **≥ 70%** «la firmerei» con al
     massimo piccole correzioni.
5. **Misura in produzione** (§6.5), per coach e per modello.

### 8.2 Cosa fa il coach
- Al primo uso: la procedura guidata (~10 minuti) e, se vuole, i workout «modello».
- Ogni settimana: rivede, corregge nel builder, approva; conferma o scarta le proposte di regola.
- Ogni tanto: rilegge metodo e regole imparate, sempre visibili in chiaro.

### 8.3 Fine-tuning: no nella prima versione
- Un coach ha decine di workout, non migliaia, e il metodo cambia: le regole nuove devono
  valere subito, non al prossimo addestramento.
- Un modello per coach costa da mantenere e lega a un fornitore.
- **Quando riconsiderarlo**: con migliaia di settimane approvate con poche modifiche **e**
  il consenso dei coach, si può addestrare un unico modello open (es. per il notturno in
  self-hosting). Si decide confrontandolo sul banco di prova.

## 9. Fasi

| Fase | Cosa | Migrazioni |
|---|---|---|
| 0 | Banco di prova (30 casi inventati) e gara fra modelli in `tools/`: decide modello e costi veri | **nessuna** |
| 1 | Questionario, consenso salute, valutazione del coach, metodo | `questionario_atleta`, `salute_atleta`, `valutazione_atleta`, `metodo_coach`, `regole_metodo` |
| 2 | Scheletro, settimana, validatore, revisione e approvazione, contatore dei costi | `programmazioni`, `programmazione_sedute`, `uso_ia` |
| 3 | Allarmi e regole imparate | `proposte_adattamento` (+ uso degli stati di `regole_metodo`) |
| 4 | Abbonamenti, fasce e tetti d'uso | spec separata |

## 10. Migrazioni proposte (NON applicate)

Tutte **nuove e additive**: nessuna tabella e nessuna policy esistente cambia. La RLS segue
le funzioni del multi-coach (`e_admin()`, `mio_atleta()`). **Ognuna richiede un sì esplicito
separato** (regola 0-bis); quando arriva, il file va in `supabase/schema/` con la data.

| Tabella | Colonne principali | RLS |
|---|---|---|
| `questionario_atleta` | `athlete_id`, `versione`, `risposte` jsonb (obiettivo, disponibilità, attrezzatura, livello, sesso), `inviato_at`, `confermato_da`, `confermato_at`; chiave `(athlete_id, versione)` | l'atleta le sue; i suoi coach (`mio_atleta`) e gli admin leggono e confermano |
| `salute_atleta` | `athlete_id` (chiave), `testo`, `da_evitare`, `consenso_id`, `aggiornato_at`. **Separata**, per cancellarla da sola e limitare chi la vede | l'atleta (solo con consenso); i suoi coach e gli admin leggono |
| `valutazione_atleta` | `athlete_id`, `coach_id`, `livello`, `priorita`, `vincoli`, `note_ia`, `aggiornato_at` | i coach dell'atleta e gli admin; **l'atleta no** |
| `metodo_coach` | `coach_id`, `versione`, `impostazioni` jsonb, `preferenze` jsonb, `esempi` uuid[], `attivo` | il coach stesso; gli admin leggono |
| `regole_metodo` | `id`, `coach_id`, `testo`, `origine` (proposta / manuale), `stato` (proposta / attiva / scartata), `workout_origine`, `creato_at` | il coach stesso; gli admin leggono |
| `programmazioni` | `id`, `athlete_id`, `coach_id`, `gara_id` (workout `Event`), `inizio`, `fine`, `scheletro` jsonb, `versione_profilo`, `versione_metodo`, `stato` (bozza / attiva / chiusa) | il coach della programmazione e gli admin; **l'atleta no** |
| `programmazione_sedute` | `programmazione_id`, `settimana`, `giorno`, `workout_id`, `stato` (bozza / da_rivedere / approvata), `perche`, `modello`, `modifica_coach` (nessuna / piccola / rifatta) | come `programmazioni` |
| `proposte_adattamento` | `id`, `programmazione_id`, `motivo`, `proposta` jsonb, `stato` (aperta / accettata / rifiutata), `creato_at` | come `programmazioni` |
| `uso_ia` | `coach_id`, `quando`, `funzione`, `modello`, `token_in`, `token_out`, `costo_stimato` | solo admin in lettura; scrive solo la Edge Function |

Da approvare insieme, anche se fuori dallo schema:
- una **Edge Function nuova** `programma-ia`, separata da `ai-workout` per non toccare
  l'app pubblicata (che la usa per «Genera con IA»);
- due **cron**: la settimana della domenica notte (in Batch) e gli allarmi del mattino;
- **consenso salute e informativa aggiornata** (§4, regola 1), con l'aggiornamento della
  privacy policy pubblicata su GitHub Pages (`ios-version`) e delle schede privacy degli Store;
- l'aggiunta di queste tabelle al **backup notturno** (`db-backup.yml`).

## 11. Come si prova senza toccare la produzione

Oggi web, iOS e Android usano **un solo database di produzione**, senza staging
(CLAUDE.md §4). Regola di questo lavoro: **niente si sviluppa né si prova sul database di
produzione.** Quattro livelli, nell'ordine in cui si usano.

### 11.1 Senza database: fase 0 e ambiente di prova
- **Fase 0** (banco di prova, §8.1 punto 4): uno script in `tools/`, come
  `tools/prova-estrai-note/`. Legge casi inventati da file, chiama i modelli candidati,
  scrive i risultati in locale. Non apre mai una connessione al database.
- **Schermate nuove** (questionario, procedura del metodo, scheletro, revisione della
  settimana, proposte d'allarme) su `npm run demo`, `demo:coach` e `demo:atleta`: le tabelle
  nuove si aggiungono a `supabaseDemo.js` e i dati inventati a `demoSemi.js`, come per
  «Dalle note» (`PROPOSTE_DEMO`). Nell'ambiente di prova l'IA non c'è: le risposte arrivano
  già pronte nei semi, ma passano dallo **stesso validatore** del §6.2.
- I test (`npm test`) coprono validatore, riassunto dei feedback, regole d'allarme e
  controlli dello scheletro: sono logica pura in `src/lib/`, senza database.

### 11.2 Database di staging nel cloud (raccomandato prima della prima migrazione)
- Un **secondo progetto Supabase**, separato dalla produzione, con atleti, coach e workout
  **inventati**. Mai copie di dati veri: ci sono dati di salute.
- La struttura si prende dalla produzione esportando **solo lo schema** (una lettura,
  permessa dalla regola 0-bis), poi si applicano le migrazioni proposte al §10.
- Qui si provano: le policy RLS (un coach non vede metodo, atleti e programmazioni di un
  altro; l'atleta non vede bozze, valutazione e scheletro), la Edge Function `programma-ia`
  con le chiavi IA di prova, i cron, il Batch notturno, le notifiche.
- L'app sceglie il database con le variabili d'ambiente: la preview di Vercel del branch
  `app`, l'emulatore Android e le build di sviluppo iOS puntano allo staging; `main` e le
  build per gli Store restano sulla produzione. **Prima di ogni archivio per App Store** si
  aggiunge un controllo: nel bundle non deve comparire l'URL dello staging (come i controlli
  di CLAUDE.md §9).
- Il piano gratuito di Supabase permette due progetti. Creare lo staging è una **decisione
  del committente** (un servizio e delle chiavi in più da gestire).

### 11.3 Database locale (facoltativo)
La CLI di Supabase con Docker avvia sul PC una copia completa (Postgres, login, storage,
Edge Function); il progetto ha già `supabase/config.toml`. È utile per provare una migrazione
dieci volte in un'ora, ma su questo PC oggi mancano Docker e la CLI. Lo staging del §11.2 la
rende non necessaria.

### 11.4 Rilascio sicuro in produzione
1. **Tabelle solo additive** (§10): un'app vecchia sugli Store non le conosce e continua a
   funzionare; le sedute approvate sono workout e assegnazioni normali.
2. **Edge Function separata** `programma-ia`: `ai-workout`, usata da «Genera con IA»
   nell'app pubblicata, non cambia.
3. **L'app tollera le tabelle mancanti**: se una migrazione non è applicata la sezione non
   compare, senza errori a schermo (lo stesso schema di `tabellaAssente` in
   `_shared/staff.ts`).
4. **Funzione spenta di default**: il codice arriva nell'app nascosto e si accende per un
   **coach di prova** (per esempio un account demo con atleti finti), poi per un coach vero,
   poi per tutti. L'interruttore sta lato server, così si spegne senza pubblicare un
   aggiornamento sugli Store: una variabile della Edge Function `programma-ia` con le email
   dei coach abilitati, che l'app legge chiedendo alla funzione. Nessuna tabella in più.
5. **Ordine per ogni migrazione**: staging → prova sul telefono → **sì esplicito del
   committente** → applicazione in produzione dal SQL editor, con il file datato in
   `supabase/schema/` → verifica con letture → aggiunta al backup notturno.
6. **Tornare indietro**: ogni file di migrazione porta in fondo il suo `drop` commentato
   (come `multi_coach_2026-10-15.sql`). Spegnere l'interruttore basta a nascondere la
   funzione mentre si decide.

## 12. Fuori da questo design
- L'importazione dei workout per un coach senza storico (P7): un design a parte. Il punto
  di partenza naturale sono «Da un testo scritto» e la foto.
- Abbonamenti, pagamenti in-app e fatturazione (fase 4).
- La pubblicazione automatica senza approvazione: esclusa (P3).
- I dati di salute come categoria o grafico in «Dalle note» (BACKLOG #67): qui la salute
  serve solo come vincolo per programmare.
