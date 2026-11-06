# Le gare di corsa dal calendario FIDAL — design

Data: 04/11/2026 · Approvato in sessione: approccio 1 (Edge Function che legge fidal.it).
Segue il flusso Hyrox di «Nuovo evento» (`docs/memoria/calendario.md`, 9-gare-hyrox).

## Cosa vuole il committente

Come per le gare HYROX, in «Nuovo evento» si sceglie anche una **gara di corsa** da un elenco che
si aggiorna da solo, invece di scriverla a mano. La fonte è il **calendario FIDAL**
(`https://www.fidal.it/calendario.php`): solo gare in Italia. Le gare estere restano scritte a mano
(«Altro»): World Athletics e Ahotu non hanno un'interfaccia aperta e affidabile.

## Decisioni prese con il committente

- **Quali gare**: calendario **nazionale e regionale**, solo tipo **STRADA**, **TRAIL** e
  **MONTAGNA/TRAIL**. Fuori pista indoor/outdoor, cross, marcia, nordic walking, ultramaratona
  (su strada e trail), le gare **annullate** e quelle per ragazzi.
- **Dove**: dentro la scheda «Prossima gara», un interruttore **Hyrox | Corsa** sopra la lista. Le
  tre schede del foglio restano tre. «Già corsa» resta solo HYROX (i tempi FIDAL sono un'altra cosa).
- **Filtri**: ricerca (nome e città) + **menu della regione** + **pillole della distanza**.

## Cosa si legge su fidal.it

- `calendario.php?anno=<a>&mese=<m>&livello=COD|REG&submit=Invia`: una pagina per mese e livello.
  Si leggono il **mese corrente e i 6 successivi**, nazionale e regionale: 14 pagine, 4 alla volta.
  Con un User-Agent da browser rispondono 200 senza chiave (provato il 04/11/2026: novembre 2026
  = 91 gare nazionali, 168 regionali, tutti i tipi).
- Ogni gara è una riga di tabella: `<td>` data (`08/11` o `21-22/11`) · livello (`<abbr>`
  N/R/P…) · `<a href=".../calendario/<slug>/COD14771">nome</a>` con sotto un `<font>` corsivo
  (sottotitolo, a volte la distanza) · tipo (`STRADA`, `TRAIL`, `CROSS`…) · città (`Crema (CR)`,
  a volte `Trestina PG`, `Roma RM`).
- «Annullata - …» all'inizio del nome = annullata.
- ⚠️ Nessuna interfaccia ufficiale: si legge la pagina, come hyrox.com. Se un giorno cambia, si
  salva la pagina nuova al posto della copia nei test e si guarda quale test cade.

## La gara, come la restituisce il server

```js
{ id: 'COD14771',            // codice FIDAL dal link: stabile
  nome: 'Trofeo del Mare',   // ripulito: niente «XIII^», niente «Annullata»
  dal: '2026-11-01', al: '2026-11-01',
  tipo: 'strada' | 'trail',  // MONTAGNA/TRAIL → trail
  citta: 'Bagheria', provincia: 'PA', regione: 'sicilia',
  distanza: '5k' | '10k' | 'mezza' | 'maratona' | 'trail' | 'altre',
  livello: 'nazionale' | 'regionale',
  url: 'https://www.fidal.it/calendario/XIII^-Trofeo-del-Mare/COD14771' }
```

- **Anno**: la pagina scrive solo `gg/mm`; l'anno è quello della pagina richiesta.
- **Regione**: dalla sigla della provincia con una tabella fissa `PROVINCE` (107 sigle → 20
  regioni). Un test fallisce se le copie dei test contengono una sigla che la tabella non ha.
  Sigla sconosciuta → `regione: ''`: la gara compare in «Tutta Italia», non sparisce.
- **Distanza**, in quest'ordine: tipo trail → `trail`; poi il testo di nome + sottotitolo:
  `42.195`/«maratona» (non «mezza», «maratonina», «ultra») → `maratona`; `21.0975`/«mezza»/
  «half»/«maratonina» → `mezza`; 10 km (`10km`, `10k`, `10 km`, «ten», `KM 10,700` arrotondato da
  9,5 a 10,9) → `10k`; 5 km (4,5–5,9) → `5k`; altrimenti `altre`. «Metà Mezza» → `altre`.
- **Una gara con più distanze** compare come più righe (FIDAL le elenca così: «Lago Maggiore
  Marathon - 10 km», «- Mezza Maratona», «- Maratona»), ognuna con il suo id.
- **Ordine e doppioni**: la lista finale è deduplicata per id (una pagina letta due volte non
  raddoppia le gare) e ordinata per `dal`, poi per nome.
- **Ragazzi**: fuori i nomi con «kids», «giovani», «esordienti», «ragazzi», «cadetti», «baby».

## Il server: Edge Function `gare-corsa`

- `supabase/functions/gare-corsa/index.ts` (scarica, copia in memoria, risponde) e `regole.ts`
  (lettura pura, provata). Stessa forma di `gare-hyrox`: CORS, `{ gare, aggiornate }`.
- Copia in memoria **6 ore**. Nessun secret, nessuna tabella. `main` non la chiama: pubblicarla
  non tocca il sito.
- Una pagina che non risponde o non si legge viene saltata (e scritta nel log); la funzione
  risponde errore solo se **tutte** le pagine falliscono.

## Nel telefono

### `src/lib/gare.js` (nuovo, comune)
Escono da `gareHyrox.js` le funzioni che non sanno di HYROX: `normalizza`, `gareFuture`,
`giorniGara`, `periodoGara`, `blocchettoData`, `quandoGara`, `perMese`, `giornoProposto`.
`gareHyrox.js` le **riesporta**: nessun import esistente cambia.

### `src/lib/gareCorsa.js` (nuovo)
- `caricaGareCorsa(supabase)`: come `caricaGare`, con `fleofit_cache_gare_corsa` (12 ore,
  `versione`, `formaAttuale`), copia vecchia se il server non risponde, altrimenti
  `errore: 'Calendario FIDAL non disponibile in questo momento.'`.
- `REGIONI` (slug → nome), `DISTANZE` (ordine e etichette: 5 km · 10 km · Mezza · Maratona ·
  Trail · Altre), `filtraCorsa(gare, { regione, distanza, ricerca })` (ricerca su nome e città,
  senza accenti, tutte le parole), `regioniPresenti`.
- `sectionsEventoCorsa(gara)`: `{ category: 'Event', isEvent: true, isAutonomous: true,
  corsa: { id, distanza, tipo, citta, provincia, regione, url, dal, al } }`.
  ⚠️ **Mai una chiave `hyrox`**: `RisultatoGara`, `InvitoRisultato`, `risultatoGara.js` e la
  scheda la leggono per cercare il tempo su results.hyrox.com.
- Regione scelta ricordata in `fleofit_corsa_regione` (con `leggiJson`/`scriviJson`).

### `src/components/GareCorsa.jsx` (nuovo, pigro)
Caricato con `lazy` da `NuovoEvento`, come `GarePassate`: il foglio si apre anche dalla Home e il
chunk d'ingresso non deve crescere.
- **Lista**: ricerca + bottone regione (apre un foglio dal basso: «Tutta Italia» + le regioni
  presenti) + fila di pillole distanza (Tutte + `DISTANZE`, solo quelle presenti). Raggruppata per
  mese con il conteggio. Scheletri in caricamento; errore → testo + «Scrivi l'evento a mano».
- **Riga** (~64 px, non la card con foto): blocchetto data a sinistra · nome (una riga, troncato)
  e sotto «Città (PR) · Regione» · a destra pillola distanza azzurra (`running`), niente pillola
  per `altre`. Bordo che va all'azzurro in hover/tocco.
- **Gara scelta**: card alta senza foto, fondo `#161616`, filigrana della distanza («42K», «21K»,
  «10K», «5K», «TRAIL»), blocchetto data, nome grande, «Città · Regione», «Tra N giorni»; sotto
  «Cambia gara» e «Pagina FIDAL ↗».
- Il componente riceve `onScegli(gara)` e `gara`/`onCambia`: giorno di gara, nome nel calendario
  e salvataggio restano in `NuovoEvento`, uguali per Hyrox e Corsa.

### `NuovoEvento.jsx`
- In «Prossima gara», sopra la lista, levetta **Hyrox | Corsa** (stile dei toggle segmentati);
  accento giallo con Hyrox, azzurro con Corsa. All'apertura è sempre Hyrox.
- Stato `garaCorsa` accanto a `gara`; `handleSave` usa `sectionsEventoCorsa` quando la gara
  viene da Corsa. Giorno di gara e «Nome nel calendario» come oggi, colore azzurro con Corsa.

### Demo
`gareCorsaFinte()` in `src/supabaseDemo.js` (quattro gare, date relative a oggi: una maratona,
una mezza, una 10 km regionale, un trail), restituite per `functions.invoke('gare-corsa')`.

## Prove (ognuna vista fallire prima)

- `regole.ts` su due copie vere: `src/lib/__tests__/fixtures/fidal-2026-11-cod.html` e
  `fidal-2026-11-reg.html` — numero di gare tenute, una gara nazionale e una regionale lette per
  intero, gara su due giorni, annullata esclusa, cross esclusa, ragazzi esclusi, città senza
  parentesi.
- Distanza: tabella di casi (`42.195km`, «Maratonina», «Mezza Maratona», «Half», «KM 10,700»,
  «10K», «Ten», «5km», «Metà Mezza», «33 km», trail).
- `PROVINCE` copre ogni sigla delle copie; 20 regioni.
- `gareCorsa.js`: copia fresca/vecchia/assente, `filtraCorsa`, `sectionsEventoCorsa` senza `hyrox`.
- `gare.js`: i test esistenti di `gareHyrox` restano verdi senza cambiarli.
- Pagina: `NuovoEvento` → Corsa → scelta di una gara → salvataggio con `sections.corsa`.

## Fuori da questo lavoro

Gare estere; risultati FIDAL dopo la gara; filtro per data; mappa.

## Pubblicazione

`supabase functions deploy gare-corsa` (non tocca il sito). Nell'app arriva con la 1.2.3 e con il
prossimo `app:main`. A lavoro finito: `docs/memoria/calendario.md` (sezione nuova 9-gare-corsa),
la riga di `gare-corsa` e di `fleofit_cache_gare_corsa`/`fleofit_corsa_regione` in CLAUDE.md
(§4 Edge Function, §8 chiavi), DEVLOG.
