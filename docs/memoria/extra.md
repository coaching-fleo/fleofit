# Sezione Extra

> Scritto il 12/11/2026. Spec: `docs/superpowers/specs/2026-11-12-sezione-extra-design.md`, piano:
> `docs/superpowers/plans/2026-11-12-sezione-extra.md`. Lavoro fatto su `app`, da `68349e7`.

Le funzioni «extra» (le Scarpe; più avanti palestre, biglietti) hanno **un ingresso solo**:
- **atleta**: la voce **Extra** nella barra, prima di Profilo, solo se almeno un extra è acceso per lui;
- **coach, telefono**: «Archivio» è diventato **«Libreria»**, col selettore *Workout · Extra*
  (`/archive?vista=extra`). Sempre su *Workout* all'apertura; niente selettore se tutto è spento,
  nello `/storico` dell'atleta e in modalità TV (`?tv=`);
- **desktop**: la voce «Extra» nella barra laterale (`/extra`); lì la voce dell'archivio resta «Archivio».
Spariti: «Catalogo scarpe» in Impostazioni, la voce «Scarpe» della barra laterale, `BannerScarpe`.

## Aggiungere un extra
1. Una voce in `EXTRA` di `src/lib/extra.js` (id, nome, icona, `interruttore`, `rotta`, `ruoli`,
   `descrizione` per ruolo, e se serve `stato` e `avviso` come `import()` pigri).
2. La rotta in `App.jsx` **dentro** `<SoloSeAccesa nome="<interruttore>">`.
3. La riga `{ nome: '<interruttore>', stato: 'tutti', … }` nel seme di `src/demoSemi.js`.
4. La riga in `funzioni_app` (un dato, non una migrazione): `spenta` / `admin` / `tutti`.
5. Se l'extra manda push: partono solo con l'interruttore acceso per quella persona, controllato da
   `send-reminders` leggendo `funzioni_app` (regola della spec §3, ancora nessun extra la usa).
`src/lib/__tests__/extra.test.js` fallisce se manca il 2 o il 3.

## Come è fatto
- `useExtra()`: gli extra accesi per chi guarda, `null` finché non si sa (allora la voce non c'è).
  Admin che simula l'atleta = atleta.
- `useAvvisiExtra()`: **una memoria condivisa** (`useSyncExternalStore`) fra tutte le copie. ⚠️ Con uno
  stato per copia, chiusa la card in Home il pallino della barra restava acceso (trovato nella demo).
  Due letture che partono insieme diventano una.
- Card «Dagli Extra» (`DagliExtra.jsx`): **in fondo** alla Home (atleta, Riepilogo telefono e desktop,
  Home classica), mai in alto: arriva dopo una lettura e sposterebbe gli allenamenti. Un avviso solo, `alta`
  prima di `normale`, «+N negli Extra». La X si chiama «Chiudi l'avviso». Il tasto indietro di Android
  non la tocca perché la card sta dentro `#root`: `indietroAndroid.js` cerca la X solo nelle modali in
  portale. ⚠️ Messa in un foglio con `createPortal`, il tasto indietro premerebbe questa X (`/^chiudi/i`
  vale anche per «Chiudi l'avviso»).
- Gli avvisi chiusi stanno in `fleofit_extra_visti_<uid>`: due persone sullo stesso telefono non si
  nascondono gli avvisi a vicenda.
- La card non porta margine suo: nella Home la distanza la dà il contenitore (`gap`); solo la Home
  atleta, che non ha `gap`, le passa `className="mt-8"`.
- Libreria: il cambio di vista passa di nuovo `location.state`, o si perde `daBarra` e compare la freccia
  «indietro» (trovato nella demo). Sul desktop `?vista=extra` rimanda a `/extra`.

## Pesi
`index` da **627,93 KB** (già sopra la soglia di 620 prima del lavoro) a **631,15 KB**: +3,2, cioè registro,
`useExtra`, `useAvvisiExtra`, `avvisiExtra` e due icone, che la barra deve avere. Pagina e card sono pigre
(`Extra` 1,05 KB, `DagliExtra` 0,44 KB). Lint invariato: 29 problemi, come al commit di partenza.
