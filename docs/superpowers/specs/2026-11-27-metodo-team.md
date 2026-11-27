# Metodo del team PUSHFIT — regole raccolte dal coach

Data: 27/11/2026 · risposte del coach, raccolte in sessione. Alimentano `REGOLE_PREDEFINITE`
(`src/lib/pianoIA/regole.js`) e le istruzioni dell'IA (spec `2026-11-27-pushfit-ai-design.md`).

## 1. Scarico e tapering

**Senza gara vicina**
- Ciclo **3 settimane di carico + 1 di scarico**.
- Le 3 settimane di carico vanno **in progressione** (ognuna più della precedente).
- Settimana di scarico: **volume −20%** e **intensità più bassa**.
- Principiante: la settimana di scarico toglie solo il **10%** di volume (invece del 20%).

**Con gara vicina (tapering)**
- Tapering di **10–15 giorni** prima della gara.
- Si abbassa **solo il volume**; l'**intensità resta alta**.
- Volume: **−20% la penultima settimana**, **−30% l'ultima** (settimana della gara).

## 2. Progressione

- Da una settimana di carico alla successiva il volume sale del **5–10%**.
- **Non sale all'infinito**: ci sono dei **tetti massimi** di volume settimanale (da definire, §2.1).
- Dopo lo scarico il nuovo blocco **riparte dal livello dell'ultimo carico**, sempre tenendo conto del tetto finale.
- Crescono **sia il volume sia l'intensità**.

### 2.1 Tetti massimi

**Cosa si conta**
- I minuti che contano sono quelli **del blocco centrale**: il workout effettivo, dentro i blocchi.
- **Riscaldamento, Cash In e Cash Out non contano** nei minuti della settimana.
- Quindi la durata **totale** delle sedute può superare il tetto: il tetto vale sui minuti centrali.
- Il tempo che l'atleta dichiara nel questionario resta la durata **totale** della seduta
  (riscaldamento e Cash In/Out compresi): serve a far stare la seduta nel suo tempo, non a misurare il carico.

**Minuti centrali a settimana**

| Livello | All'inizio | Tetto massimo |
|---|---|---|
| Principiante | 120′ (es. 3 × 40′) | 240′ |
| Intermedio | 180′ (es. 3–4 × 50′) | 360′ |
| Avanzato | 270′ (es. 4–5 × 60′) | 540′ |

**Blocco centrale di una singola seduta (massimo)**

| Livello | Seduta normale | Lungo di corsa |
|---|---|---|
| Principiante | 45′ | da definire |
| Intermedio | 60′ | da definire |
| Avanzato | 75′ | 90′ |

> ⏳ Ancora aperto in §2.1: il tetto delle sedute Hyrox «molto dure» a settimana. Il coach dice
> che dipende dal tipo di blocco (AMRAP, For Time, ON/OFF) e che **il lavoro più duro è quello
> molto corto**. La corsa si tratta a parte, più avanti.

## 3. L'obiettivo dell'atleta: formato di gara e tempo

> ⚠️ Il coach lo dice chiaro: **questi sono riferimenti ed esempi, non ricette da copiare
> identiche.** L'IA li usa per capire la direzione, non come numeri fissi.

**Il formato cambia tantissimo**
- Prima di tutto va capito l'obiettivo: **singola, doppia o staffetta** Hyrox. Sempre insieme al livello.
- **Lontano dalle gare** gli allenamenti possono essere gli stessi per tutti i formati.
- **Vicino all'obiettivo**, e soprattutto per chi è più avanzato, si va **sullo specifico** del formato.

**Il tempo obiettivo cambia il tipo di lavoro** (numeri d'esempio)
- Da **1h30 in su**: si lavora in modo generale.
- Fra **1h20 e 1h**: si comincia a cercare un tempo accettabile, lavoro più mirato.
- **Sotto l'ora**: allenamenti **molto più specifici**, con **più volume**.

**Singola e doppia: da ricordare sempre**
- Nella **doppia** ci si scambia durante gli esercizi, quindi l'**effort è molto più alto**.
- La **corsa** in doppia si fa insieme, non ci si scambia; ma si corre **almeno 10″/km più forte**
  della singola.
- Sugli **ergometri** fra singola e doppia il passo di gara può cambiare anche di **20″ ogni 500 m**.
- La **singola** si corre più piano, perché negli esercizi non ci si scambia.
- Quindi chi prepara la doppia va **abituato a tenere quei passi in allenamento**, con delle pause.

**Come si allena l'intensità della doppia (esempio)**
- Workout **ON/OFF**: tanta intensità, poco volume.
- Progressione d'esempio di settimana in settimana: **50″ on / 10″ off → 40″/20″ → 30″/30″**.
  Il lavoro si accorcia e la pausa cresce, così il passo può salire.

**Staffetta (non è una priorità, ma va saputa)**
- Effort **altissimo**: in 4 ci sono 8 stazioni, quindi **2 stazioni a testa**, quasi mai attaccate.
- In gara: **1 km di corsa molto forte** (effort anche 8), poi **una sola stazione**, fatta quasi a
  massimale. Cambio, e più avanti si rifà.
- Allenamento: corsa forte + una stazione al massimo, con lunghe pause in mezzo.

## 4. Aumentare l'intensità negli esercizi: carico E volume

> 🔴 Da ricordare sempre.

- «Aumentare l'intensità» in esercizi come **wall ball, affondi con sandbag**, ecc. **non vuol dire
  solo più peso**.
- Lavorare **a volte** (non sempre) con un carico **più alto di quello di gara** è utile.
- Ma è altrettanto importante lavorare con **più volume rispetto alla gara**, con il peso di gara.
- Esempio: se l'atleta in gara usa la palla da 6 kg e in allenamento fa solo 5 wall ball con
  quella da 12, diventa più forte, ma alle **100 wall ball** di fine gara farà fatica.
- Quindi si alternano: **sovraccarico** (poche ripetizioni, peso più alto) e **sovravolume**
  (più ripetizioni o metri della gara, peso di gara).

## 5. Categorie e pesi di gara

Wall ball, dette dal coach:

| Categoria | Wall ball |
|---|---|
| Donne Open | 4 kg |
| Donne Pro | 6 kg |
| Uomini Open | 6 kg |
| Uomini Pro | 9 kg |
| **Mixed (doppia mista)** | pesi dell'**Uomo Open**: la donna si deve adattare |

### 5.1 Tutti i pesi di gara (confermati dal coach il 27/11/2026, stagione in corso)

| | Donne Open | Donne Pro | Uomini Open | Uomini Pro |
|---|---|---|---|---|
| Sled push (50 m) | 102 kg | 152 kg | 152 kg | 202 kg |
| Sled pull (50 m) | 78 kg | 103 kg | 103 kg | 153 kg |
| Farmer carry (200 m) | 2 × 16 kg | 2 × 24 kg | 2 × 24 kg | 2 × 32 kg |
| Sandbag lunges (100 m) | 10 kg | 20 kg | 20 kg | 30 kg |
| Wall ball (100 rip.) | 4 kg | 6 kg | 6 kg | 9 kg |
| Altezza bersaglio wall ball | 2,70 m | 2,70 m | 3,00 m | 3,00 m |

- La **Mixed** usa i pesi dell'Uomo Open.
- ⚠️ I pesi possono cambiare da una stagione all'altra: a ogni stagione nuova si ricontrollano.
- Le regole di gara si vedranno più avanti.

## 6. La settimana di allenamento (programmazione per livello)

> ⚠️ Anche qui: è un **esempio** di settimana molto produttiva, non uno schema fisso.

### 6.1 Atleta avanzato (alta fascia): settimana d'esempio

**Lavoro specifico e muscolare**
- **2 sedute di forza in palestra**, distanziate di qualche giorno.
- **3 workout Hyrox**, diversi fra loro per dare **sia volume sia alta intensità**
  (esempio: uno AMRAP, uno ON/OFF, …).

**Lavoro aerobico**
- **4 sedute di corsa**: **2 lente** e **1–2 di qualità**.
- Le due di qualità non sono tutte e due ripetute: esempio, **ripetute** un giorno (con le pause)
  e **fartlek** l'altro. (La corsa si approfondisce più avanti.)
- **3 sedute di bici**, anche a **bassa intensità**: fanno molto bene.

**Ergometri (SkiErg, Rower)**
- Totale fin qui: 2 + 3 + 4 + 3 = **12 allenamenti**. L'ideale sarebbe una seduta dedicata agli
  ergometri, che porterebbe a **13**: confermato dal coach, 12 + gli ergometri.
- Quindi, nella maggior parte dei casi, row e ski si mettono **dentro i Cash In e Cash Out** dei
  workout Hyrox.

**Vicino alla gara**
- Si valuta di scendere da **2 a 1 seduta di palestra**.

### 6.2 Bici: la cadenza

> 🔴 Da ricordare sempre.

- Dare sempre una **cadenza consigliata di 80–90 pedalate al minuto**: pedalata **agile**.
- È molto importante per l'Hyrox.

**Chi non ha la bici**
- Qualcuno dirà che **non ha la bici** a disposizione, o che **non è abituato**.
- Servono delle **alternative** alla bici. Quelle decise col coach:

| Alternativa | Principiante | Intermedio | Avanzato | Attenzione |
|---|---|---|---|---|
| **Camminata in salita** (tapis) | solo **ogni tanto** | **no**, da non proporre di regola | **no**, da non proporre di regola | impattante, anche se molto meno della corsa |
| **Ellittica** | sì | no | no | solo per i livelli bassi |
| **Rower / SkiErg in Z2**, seduta lunga | no | no | **sì** | solo l'avanzato regge una seduta lunga di Z2 sugli ergometri |
| **Nuoto** | sì, se nuota | sì, se nuota | sì, se nuota | va chiesto nel **primo questionario** se è uno che nuota |
| **Corsa lenta in più** | no | quasi mai | quasi mai | correre lento è traumatico: solo per un **runner leggero, con tanta esperienza sulle gambe** |

- 📝 Nel **primo questionario** vanno chieste due cose: se ha **la bici** (o è abituato a usarla) e se **nuota**.

### 6.3 Le lacune dell'atleta decidono dove mettere il tempo

- Bisogna capire **le lacune** di ogni atleta, anche con **test veri e propri**.
- Si guarda la velocità di corsa, ma anche **quanta forza e massa muscolare** ha.
- Esempio: un **runner** molto veloce ma poco forte → **più tempo in palestra** per rinforzarlo.
- Nell'Hyrox la corsa è importante, ma la **forza è molto importante**, soprattutto per un **Pro**.

### 6.4 Intermedio e principiante: cosa si toglie

Partendo dai 12 allenamenti dell'avanzato (13 con gli ergometri), si toglie. Esempi:
- **Gli ergometri** vanno solo dentro i Cash In/Cash Out, niente seduta dedicata.
- **Meno lavoro aerobico**: la bici si toglie o si riduce.
- **Le corse**: 2, 3 o 4 a seconda dell'atleta.

**Intermedio: settimana di riferimento** (proposta accettata come **base**, non come regola fissa)

| | Avanzato | Intermedio |
|---|---|---|
| Forza in palestra | 2 | 2 |
| Workout Hyrox | 3 | 2 |
| Corsa | 4 (2 lente, 1–2 qualità) | 3 (2 lente, 1 qualità) |
| Bici | 3 | 1 |
| Ergometri | nei Cash In/Out | nei Cash In/Out |
| **Totale** | **12** (13 con ergometri) | **8** |


**Principiante: settimana di riferimento** (base, non regola fissa)

| | Intermedio | Principiante |
|---|---|---|
| Forza in palestra | 2 | **di solito 1**, a volte **anche 0** |
| Workout Hyrox | 2 | 2 |
| Corsa | 3 (2 lente, 1 qualità) | 2 (lente, con qualche allungo) |
| Bici | 1 | 0 |
| **Totale** | **8** | **4–5** |

### 6.7 Prima l'atleta, poi lo standard

> 🔴 Da ricordare sempre: **lo standard è il punto di partenza, poi si adatta a chi abbiamo davanti.**

- Esempio: chi **arriva dalla palestra** ed è già **molto forte** (massimali alti) → la forza può
  scendere a **1 seduta**, e il posto liberato va a **una corsa o una bici in più**.
- Per intermedi e avanzati **almeno 1 seduta di forza in palestra resta sempre**. Solo un
  principiante può arrivare a **0**.
- Per capire chi abbiamo davanti servono i **test**, ripetuti **a intervalli regolari**
  (ogni quanto: §7, da definire).
- Fra le cose da misurare: il **rapporto peso-potenza** di ogni atleta.

### 6.5 Corsa compromessa

- Dentro i workout Hyrox si mette **la corsa**, di solito sul **tapis roulant**.
- Così l'atleta impara a fare **gli esercizi dopo la corsa**, quando è stanco, **e viceversa**.
- È molto importante, ma **non va messa sempre**.

### 6.6 Doppi allenamenti e intensità nella stessa giornata

> 🔴 Regola base, **per tutti i livelli**.

- **Mai due sedute ad alta intensità nello stesso giorno.**
  Esempio vietato: ripetute la mattina e workout ad alta intensità il pomeriggio.
- In generale, gli allenamenti ad alta intensità vanno **tenuti lontani** fra loro.
- Per gli avanzati, con i doppi allenamenti, va pensato bene **cosa si fa in ogni giornata**.

## 7. I test

> ⏳ **Da sviluppare più avanti, insieme** (anche con altre idee proposte da Claude). Per ora sono
> **linee guida** del coach, non test definitivi. Voce nel BACKLOG.

- I test servono a capire **chi abbiamo davanti** (§6.7) e vanno ripetuti **a intervalli regolari**
  (ogni quanto: da decidere).
- I test **cambiano fra chi prepara la singola e chi prepara la doppia**.

| Test | Doppia | Singola |
|---|---|---|
| Corsa | **3000 m** (intensità molto alta) | **5000 m**, una seduta a sé |
| Ergometri | **1000 m**: uno su **SkiErg** e uno su **Rower** | **2000 m**: uno su **SkiErg** e uno su **Rower** |
| Wall ball | **50** wall ball | **100** wall ball |

- Da aggiungere: come misurare **forza** e **rapporto peso-potenza**, ogni quanto ripetere i test,
  e come si leggono i risultati (cosa cambia nel piano).

## 8. Principianti: cosa sì e cosa no

**Sì**
- **Tutte le 8 stazioni** dell'Hyrox, da subito: non bisogna aver paura di fargliele fare.
- **Corsa compromessa** (corsa e stazioni attaccate): sì.
- **ON/OFF corti** (es. 30″/30″): sì, ma con **intensità sotto l'8**, mai a tutta.

**No**
- **Niente sovraccarichi**: mai pesi più alti di quelli che userà **nella sua gara**
  (es. Donna Open wall ball 4 kg, Uomo Open 6 kg). Il riferimento è sempre la sua categoria (§5.1).
- **Niente esercizi complementari che portano a sovraccarico.** Esempio: **thruster** e
  **front squat** fanno molto bene alla wall ball, ma si fanno con più peso della palla di gara,
  quindi a un principiante **no**.
- **Niente simulazioni di gara intere.**
- **Due sedute nello stesso giorno**: di base **no**. Dipende dall'atleta, ma è l'eccezione.

## 9. Sicurezza dei carichi (per tutti)

> 🔴 Da ricordare sempre: serve anche a **tutelarci**.

- Stare **molto attenti a non dare carichi strani o esagerati**, a nessun livello.
- Vale per **tutti gli esercizi dove si sovraccarica**, anche quelli che sembrano poco pericolosi:
  per esempio **sled push e sled pull**. Gli infortuni sono dietro l'angolo.

## 10. Mobilità prima dell'allenamento

- Prima dell'allenamento dare importanza alla **mobilità attiva** (dinamica), non statica.
- **Mai consigliare stretching statico prima** dell'allenamento: può essere pericoloso.
- Il coach chiede di **non scriverlo troppo grosso**: va messo nel riscaldamento in modo
  discreto, ma deve esserci sempre.

## 11. Sostituzioni dell'attrezzatura (casa o palestra normale)

**Principio**
- Gli esercizi si possono sostituire, **ma poco**.
- Se non c'è una sostituzione buona e sicura, **piuttosto l'esercizio non si propone**.

| Manca | Sostituzione |
|---|---|
| **Slitta** (push e pull) | **nessuna**: senza slitta push e pull **non si propongono**, si mette **un altro esercizio** (non un finto sled). 🔴 **Mai l'auto in folle** |
| **SkiErg** | **nessuna**, di base non si sostituisce (l'elastico non serve) |
| **Rower** | **nessuna** (né bici né elastico al posto del rower) |
| **Wall ball** | thruster con **manubrio leggero**; squat con **palla medica lanciata in alto**; **wall ball senza lancio**, solo con la spinta della palla verso l'alto |
| **Sandbag** (affondi) | affondi con **i manubri tenuti in mano** (preferiti); va bene anche il manubrio tenuto al petto |

**Variante degli affondi (ogni tanto)**
- Invece degli affondi camminati: affondi **sul posto**, **in avanti** o **indietro**.
- Servono soprattutto a sviluppare **più forza sui glutei**.

## 12. Scelta dei workout dall'archivio del team

- PUSHFIT AI usa **prima i workout del coach** nell'archivio; ne crea uno nuovo solo se non ne
  trova uno adatto.
- Si sceglie in base a: **livello**, **fase** del piano (carico, scarico, tapering), **formato**
  della gara (singola o doppia), **attrezzatura** che l'atleta ha (§11). **Mai i workout di test.**
- **Si possono adattare** (round, durate, intensità, esercizi): non si usano per forza identici.
- I pesi seguono la **categoria** dell'atleta (§5.1), ma l'adattamento **non guarda solo i pesi**:
  si valuta **tutto dell'atleta** (livello, lacune, test, storia, come sta, tempo a disposizione,
  attrezzatura), come al §6.7.

## 13. Simulazione intera di gara (per tutti i livelli)

- **Di base non si propone**, a nessun livello.
- Se l'atleta la vuole fare lui: **al massimo 1–2 volte all'anno**.
- Perché: insegna come funziona una gara, ma è un'altra cosa. Senza tifo e senza la carica della gara
  si va a **intensità più bassa**, quindi **il volume diventa troppo lungo**.
  Esempio: chi fa la gara in 1h20 in simulazione ci mette 1h30.
- **Al posto della simulazione**, vicino alla gara: **prove di simulazione a volume ridotto**, anche in
  palestra. Esempi:
  - esercizi **completi** e corsa **a metà**;
  - oppure **metà e metà** (metà esercizi, metà corsa).
- ⏳ Come costruire queste prove: da parlarne col coach.
