# Home coach «Riepilogo» (proposta B3) — design

Data: 10/11/2026 · Approvato in sessione (brainstorming) · Prototipo: `tools/design-home/proposta-b3.html`

## Perché

La Home coach di oggi (cruscotto del 14/10/2026) elenca le **persone**: chi si allena oggi,
la griglia atleti × giorni, la lista «Da smaltire». Con 11 atleti funziona, con centinaia
diventa una pagina infinita. La B3 mostra **numeri** e lascia le persone dietro ogni numero:
la Home ha la stessa lunghezza con 11 o con 500 atleti.

Successo: con qualsiasi numero di atleti il coach capisce la giornata senza scorrere a lungo,
e da ogni numero arriva in un tocco alle persone e all'azione (aprire, programmare).

## Decisioni prese

| Domanda | Scelta |
|---|---|
| La Home di oggi | Resta nell'app, dietro un interruttore **«Home classica»** in Impostazioni, per dispositivo |
| Tab bar con il «+» centrale | **No**: la tab bar non cambia. Eventuale lavoro a parte |
| «Analisi» in fondo alla Home | **Solo desktop** (sul telefono Analisi rimanda al Report). Adattarla al telefono è lavoro a parte |
| Piattaforme | Telefono **e** desktop coach (il desktop resta solo per i coach) |
| Database | **Nessuna** modifica e **nessuna** lettura nuova: si usano i dati che la Home carica già |

## Cosa c'è in pagina (telefono, dall'alto)

Testata, barra di ricerca, Live Coach Cam e banner Scarpe **restano quelli di oggi**
(`Home.jsx`, `HomeCoachUI.jsx`). Cambia il corpo:

1. **Card gialla «Oggi»** — «X di Y hanno già finito», cerchio con la percentuale. Dentro,
   tre numeri toccabili: **da fare · in corso · fatti**, e una barra divisa per categoria con
   la legenda (Hyrox, Corsa, Gym, Libero) e i conteggi. Unica superficie gialla piena.
2. **Allarme** (solo se ce n'è almeno uno) — «N atleti stanno male e oggi hanno un
   allenamento intenso» → «Vedi chi». Con uno solo: il nome. Stessa regola di oggi
   (`oggiConComeSta`: intensità ≥ 8 e almeno una risposta ≤ 2 a «Come stai»).
3. **Due card affiancate** — «Feedback da leggere» (→ Leggi) e «Da programmare» = atleti con
   almeno un giorno scoperto nei prossimi 3 (→ Programma).
4. **In allenamento oggi** — fila di card con la foto, scorre a destra. Ordine: sta male,
   in corso, da fare, fatti (spenti). Arrivano **20 alla volta** mentre si scorre; in coda
   «+N · Vedi tutti». «Tutti» accanto al titolo apre la lista di oggi.
5. **Prossimi giorni** — una card per **giorno**, 14 giorni da oggi, scorre a destra.
   Oggi: quanti si allenano. Gli altri: il numero arancione «da programmare» e «N già
   programmati», una barretta per categoria. Tutti programmati = ✓ verde. Link «Calendario».
6. **Da guardare** — quattro contatori: Feedback da leggere, Fermi da 5+ giorni,
   Allenamenti scaduti, Da rivedere nel programma. Zero = ✓ verde e riga spenta, mai «0».
7. **Il team** — 2×2: aderenza 7 gg, come sta il team, RPE medio, prossima gara
   (i numeri di `PolsoTeam`, stesse frasi).
8. **Gare in arrivo** — le prossime 3 gare, una riga per gara con **quanti atleti**,
   non i volti uno per uno. Tocco → la gara.
9. **Report settimanale** — riga in fondo. Sul desktop, accanto, **Analisi**.

Il **desktop** ha gli stessi pezzi in griglia: card gialla larga due colonne con le due card
accanto, allarme, fila delle foto, giorni in riga, poi tre colonne (Da guardare · Il team ·
Gare), in fondo Analisi e Report. Testata del desktop come oggi (saluto, Messaggi,
Nuovo workout).

## Il foglio con la lista

Ogni numero e ogni contatore apre **un foglio**: dal basso sul telefono (stesso meccanismo
di `useBottomSheet`, trascinamento per chiudere, X con `aria-label="Chiudi"` per il tasto
indietro Android), a destra sul desktop. Dentro: titolo, «N atleti», campo **Cerca per
nome**, **filtri** a pillola con il conteggio, la lista a blocchi di 60 («Mostra altri»).

| Aperto da | Filtri | Tocco su una riga |
|---|---|---|
| Oggi (e da fare / in corso / fatti) | Tutti, Da fare, In corso, Fatto, categorie | l'allenamento di quell'atleta (`apriSeduta`) |
| Allarme | — | l'allenamento da alleggerire (come «Alleggerisci» oggi) |
| Feedback | Tutti, categorie | il feedback (`apriFeedback`, lo segna letto) |
| Da programmare (card blu) | Tutti, uno per ciascuno dei 3 giorni | il builder con atleta e primo giorno scoperto (`/create?athlete_id=…&date=…`) |
| Un giorno | Da programmare, Programmati, Tutti (oggi parte da Programmati) | da programmare → builder con atleta e data; programmato → la seduta |
| Fermi | — (ordinati per giorni di fermo) | la scheda atleta |
| Scaduti | — | la seduta |
| Da rivedere | — | la scheda atleta |

Il foglio non ha azioni di massa (niente «segna tutti», «sposta tutti»): erano nel prototipo
ma sono funzioni nuove, fuori da questo lavoro.

## I dati

Nessuna lettura nuova. Tutto viene da ciò che `Home.jsx` carica già per il cruscotto.

- **Due tagli da togliere per le liste**: oggi `fermiInHome` è tagliato a 4
  (`MASSIMO_FERMI_IN_HOME`) e `allenamentiScaduti` a 5 (`limite`). La Riepilogo riceve le
  liste **intere**; la Home classica resta com'è.
- **Conti nuovi, puri e testati**, in `src/lib/riepilogoCoach.js`:
  - `oggiPerStato(righe)` → `{ daFare, inCorso, fatti, totale }`
  - `oggiPerCategoria(righe)` → conteggi per Hyrox, Running, Gym, Custom (gli eventi esclusi)
  - `giorniDaProgrammare(piano)` → per ogni giorno di `pianoGiorni`: programmati, da
    programmare, conteggio per categoria, e gli atleti di ciascun gruppo
  - `scopertiTreGiorni(piano)` → gli atleti con almeno un giorno vuoto fra domani e i due dopo, con il primo giorno scoperto
  - `filtraPerNome(persone, testo)` → la ricerca del foglio (senza accenti, senza maiuscole)
  - `ordinaOggi(righe)` → l'ordine della fila (sta male, in corso, da fare, fatti)
- Le regole di sempre valgono: **chi è in pausa è fuori** dai conti (lo fanno già
  `atletiSeguiti` e le funzioni di `statisticheCoach`), **nessuno zero** in pagina,
  frasi semplici e sugli allenamenti, non sulla persona (`home-coach.md`, trappola 7).
- «Da programmare» conta da **domani** (oggi già è «chi si allena»), come la copertura.

## L'interruttore «Home classica»

- `src/lib/homeClassica.js`: `leggiHomeClassica()` / `scriviHomeClassica(bool)` su
  `localStorage.fleofit_home_classica`, con `leggiJson`/`scriviJson`. Assente = Riepilogo.
- Impostazioni (solo coach/admin): riga con interruttore «Home classica» e la riga sotto
  «La Home coach di prima, con le persone in elenco». Vale per questo dispositivo.
- `Home.jsx` sceglie fra `HomeCoachTelefono`/`HomeCoachDesktop` (classica) e
  `HomeRiepilogoTelefono`/`HomeRiepilogoDesktop`. **Tutte pigre**: chi usa la Riepilogo non
  scarica la classica e viceversa; l'atleta non scarica nessuna delle due.
- Nuova chiave in `CLAUDE.md` §8.

## File

| File | Cosa |
|---|---|
| `src/lib/riepilogoCoach.js` + test | i conti sopra |
| `src/lib/homeClassica.js` + test | l'interruttore |
| `src/components/RiepilogoCoachUI.jsx` | i pezzi: card gialla, allarme, card affiancate, fila foto, giorni, contatori, team, gare, destinazioni |
| `src/components/FoglioListaCoach.jsx` | il foglio/pannello con ricerca e filtri |
| `src/components/HomeRiepilogoTelefono.jsx` · `HomeRiepilogoDesktop.jsx` | le due disposizioni, pigre |
| `src/pages/Home.jsx` | la scelta fra classica e Riepilogo, le liste intere |
| `src/pages/Settings.jsx` (o `ImpostazioniUI`) | la riga dell'interruttore |
| `docs/memoria/home-coach.md`, `CLAUDE.md` §8 e §11 | la memoria |

`CruscottoCoachUI`, `HomeCoachTelefono`, `HomeCoachDesktop`, `useCruscottoCoach` **non si
cambiano**: sono la Home classica.

## Pesi da controllare

- `index` non deve crescere oltre qualche centinaio di byte (solo la scelta in `Home.jsx`
  e `homeClassica.js`): i pezzi nuovi stanno nei chunk pigri.
- `useCruscottoCoach` (che porta `dalleNote`) resta importato **solo** dai chunk pigri del
  coach: la Riepilogo lo usa da `HomeRiepilogo*`, mai da `Home.jsx`.

## Test

- Unitari su `riepilogoCoach.js` e `homeClassica.js`, ognuno visto fallire rompendo il
  codice apposta (CLAUDE.md §9).
- Un test di pagina: Home coach montata con l'interruttore spento mostra la Riepilogo,
  acceso mostra la classica.
- `npm test`, `npx eslint` sui file toccati, `npm run build` con i pesi del §2.
- Prova nell'ambiente demo (`npm run demo`) nel browser: telefono e desktop, apertura dei
  fogli, ricerca, filtri. Sul telefono vero prova il committente (`npm run ios`).

## Fuori da questo lavoro

Il «+» centrale nella tab bar · Analisi sul telefono · azioni di massa nel foglio ·
spostare i conti nel database (servirà con molte centinaia di atleti: richiede una
funzione nuova, quindi un sì al disgelo dello schema).
