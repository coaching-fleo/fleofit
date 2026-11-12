# Sezione Extra — design

Data: 12/11/2026 · Stato: design approvato in sessione, sezione per sezione («Sì,
avanti» ×2, «Sì, scrivila») · Migrazione: **nessuna** (accendere un extra = una riga
in `funzioni_app`, che è un dato).

## Perché

Arriveranno funzioni «extra», cioè fuori dal cuore dell'app (allenamenti, atleti, calendario):
oggi le **Scarpe da corsa**, più avanti la **ricerca delle palestre** e un **bot che
controlla la disponibilità dei biglietti**. Oggi ognuna si inventa il suo ingresso
(le Scarpe ne hanno tre: riga in Impostazioni, voce nella barra laterale, banner in
Home) e il committente, accese le Scarpe su `admin`, non trovava come arrivarci.

Il committente vuole che gli extra:

1. si **aprano quando servono**, da un posto unico e facile da trovare, per coach e
   atleta;
2. si **facciano notare** quando hanno qualcosa di importante da dire.

Successo: un extra nuovo si aggiunge senza toccare barra, Home e Impostazioni; chi
ha almeno un extra acceso lo trova con un tocco (atleta) o due (coach); chi non ne
ha nessuno non vede niente di nuovo.

## 1. Come ci si arriva

### Atleta (telefono)
- Barra: Home · Storico · Calendario · **Extra** · Profilo.
- La voce c'è **solo se almeno un extra è acceso per lui**. Con tutto spento la barra
  resta a quattro voci, com'è oggi.
- Rotta `/extra`.

### Coach (telefono)
- La voce «Archivio» diventa **«Libreria»** (stessa rotta `/archive`).
- La pagina apre con un selettore segmentato **Workout · Extra** (pattern dei toggle
  segmentati, CLAUDE.md §6), **sempre su Workout**.
- *Extra* = `/archive?vista=extra`: tasto indietro Android e ritorno da un extra
  tornano al selettore giusto.
- Con nessun extra acceso: niente selettore, la pagina è l'Archivio di oggi col
  titolo «Libreria».
- `/archive` e i suoi parametri (`?tv=` della TV) non cambiano.
- Lo «Storico» dell'atleta (`WorkoutsArchive storico`) **non** prende il selettore.

### Desktop (solo coach)
- `BarraLaterale`: la voce «Scarpe» diventa **«Extra»** → `/extra`, visibile se almeno
  un extra è acceso.

### Cosa sparisce
- La riga «Catalogo scarpe» in Impostazioni (`scarpeAccese` in `Settings.jsx`).
- La voce «Scarpe» in `BarraLaterale`.
- Ogni extra ha **un solo ingresso**: la sezione Extra.

## 2. La pagina e il registro

### Il registro: `src/lib/extra.js`
Un elenco, una voce per extra:

```js
{
  id: 'scarpe',
  nome: 'Scarpe da corsa',
  icona: Footprints,
  interruttore: 'scarpe',                 // riga di funzioni_app
  rotta: '/scarpe',
  ruoli: ['athlete', 'coach'],            // admin conta come coach
  descrizione: { athlete: 'I km delle tue scarpe', coach: 'Il catalogo dei modelli' },
  stato:  () => import('./extra/scarpe').then(m => m.stato),   // facoltativo
  avviso: () => import('./extra/scarpe').then(m => m.avviso),  // facoltativo
}
```

- `stato(uid, ruolo)` → stringa breve per la card («3 scarpe · una da cambiare») o
  `null`.
- `avviso(uid, ruolo)` → `{ chiave, testo, priorita: 'alta' | 'normale' }` o `null`
  (§3).
- Il registro **non importa** le pagine né la logica degli extra: solo icone e testi.
  Tutto il resto con `import()` pigro, così `index` non cresce (oggi ha ~4 KB di
  margine sotto i 620).

### `useExtra()`
Hook unico: gli extra del registro il cui ruolo combacia e il cui interruttore è
acceso per chi guarda (`funzioneVisibile` + `statoFunzione` di `funzioniApp.js`, quindi
«nel dubbio spenta» e l'admin che simula l'atleta vede da atleta). Lo usano
`Navbar`, la Libreria, `BarraLaterale` e la card in Home.

### La pagina `Extra`
- Un componente solo, montato a `/extra` (atleta, desktop) e dentro la Libreria
  (coach telefono).
- Griglia a due colonne di card (`#1e1e1e`, bordo `#2a2a2a`, `rounded-3xl`), entrata
  con `.cascata`.
- Card: icona in un cerchio, nome, sotto la riga di `stato` o, se manca, la
  `descrizione` del ruolo. Pallino giallo se l'extra ha un avviso non chiuso.
- Ordine = ordine del registro. Niente card «prossimamente».
- Il tocco apre `rotta`. Cosa mostra la rotta per ruolo lo decide l'extra (Scarpe:
  le mie scarpe all'atleta, il catalogo al coach — come oggi).
- Ogni rotta di un extra resta avvolta in `SoloSeAccesa`.

### Colori
Nessun colore nuovo (regola 3). Card neutre, accento `brand` per pallino e selettore.

## 3. Farsi notare

### La card «Dagli Extra» in Home
- **Una sola** card, qualunque sia il numero di extra con un avviso.
- Mostra l'avviso con priorità più alta (a parità, l'ordine del registro); con altri
  avvisi aperti, in fondo «+N negli Extra» → la pagina Extra.
- Posizione: **in fondo** alla Home, dove stava `BannerScarpe` — atleta, Home
  «Riepilogo» (telefono e desktop) e Home classica. *Corretto in esecuzione* (era «sotto
  l'allenamento di oggi»): la card arriva dopo una lettura, e sopra la lista spingerebbe
  in basso gli allenamenti mentre l'atleta li sta per toccare.
- Icona e nome dell'extra, testo dell'avviso, tocco → `rotta`.
- **X** che chiude quell'avviso su questo dispositivo: `fleofit_extra_visti`, chiave
  `<id>:<chiave>`, con `leggiJson`/`scriviJson`. Se l'avviso cambia, la chiave cambia
  e la card torna.
- Avvisi calcolati **dopo** il primo fotogramma; errore o assenza di rete → niente
  card (nessun avviso inventato).
- `BannerScarpe` sparisce: la sua logica diventa l'`avviso` delle Scarpe.

### Il pallino
Su voce **Extra** (atleta), selettore *Extra* della Libreria e card della pagina,
quando c'è almeno un avviso non chiuso. **Non** sulla voce «Libreria» della barra
coach.

### Le notifiche push
Le decide ogni extra nella sua spec. Regola fissata qui: la push di un extra parte
solo se il suo interruttore è acceso per quella persona; lo controlla `send-reminders`
leggendo `funzioni_app`.

## Dati e chiavi
- Nessuna tabella nuova. Un extra nuovo porta una riga in `funzioni_app` (dato) e,
  se gli servono, tabelle sue: **ogni migrazione richiede un nuovo sì** (§0-bis).
- localStorage nuova: `fleofit_extra_visti` (da aggiungere a CLAUDE.md §8).
- Demo: ogni extra ha la sua riga nel seme di `demoSemi.js`.

## Test
- `extra.test.js`, sul modello di `iaCategorie.test.js`: per ogni voce del registro
  esiste la rotta in `App.jsx`, avvolta in `SoloSeAccesa` con lo stesso
  `interruttore`, e la riga nel seme della demo. Visto fallire togliendo una delle tre.
- `useExtra`: spento / `admin` / `tutti` × ruolo, admin che simula l'atleta.
- Navbar atleta: quattro voci con tutto spento, cinque con un extra acceso.
- Libreria: niente selettore con tutto spento; `?vista=extra` apre la griglia.
- Card in Home: priorità, «+N», X che nasconde, chiave nuova che la fa tornare,
  errore → niente card.
- Pesi del build: `index` non cresce oltre il rumore; misurato prima e dopo.

## Fuori da questo lavoro
- Ricerca palestre, bot biglietti: ognuno con la sua spec.
- Riordino o preferiti degli extra da parte dell'utente.
- **Team**: resta dov'è (testata Atleti, Impostazioni). È un pezzo del rapporto fra
  atleti, non uno strumento; se un giorno lo si vuole fra gli extra, basta una voce
  nel registro.

## Attenzione
- Su `app` vale per web, iOS e Android. La barra a cinque voci dell'atleta va
  provata sul telefono (le prove le fa il committente).
- Le Scarpe arrivano sui telefoni solo con versioni che le contengono: l'interruttore
  non porta codice.
- Le app già sugli Store continuano ad avere i vecchi ingressi alle Scarpe finché non
  si aggiornano: va bene, puntano alle stesse rotte.
