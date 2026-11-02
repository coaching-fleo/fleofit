# Tornare indietro: «scegliere il workout dal QR della TV»

Se la funzione non piace, ecco come toglierla senza perdere nient'altro.

## Il punto di partenza

- Prima di questo lavoro l'ultimo commit era **`aba7fec`** («TV: collegarsi con il QR, e il codice
  si collega da solo alla quarta cifra»). Su quel commit c'è un tag locale:
  **`prima-scelta-tv-2026-11-02`** (solo su questo Mac, non su GitHub).
- Prima del QR c'era invece `dfd562b`: tornare lì toglie **anche** il QR. Non è questo il piano.

## Caso 1 — non ancora salvato su GitHub

Si scartano solo i file di questo lavoro (le modifiche di altre sessioni restano):

```bash
git checkout -- src/pages/WorkoutDetail.jsx src/components/FoglioCollegaTV.jsx src/pages/WorkoutsArchive.jsx src/components/ArchivioUI.jsx src/lib/categorie.js src/lib/linkTimer.js src/lib/__tests__/linkTimer.test.js src/pages/__tests__/WorkoutDetailTV.test.jsx docs/memoria/scheda-workout.md BACKLOG.md
rm src/lib/sceltaTV.js src/lib/__tests__/sceltaTV.test.js src/pages/CollegaTV.jsx src/components/FoglioChiediTV.jsx src/pages/__tests__/CollegaTV.test.jsx src/pages/__tests__/ArchivioTV.test.jsx
```

🔴 `src/App.jsx` e `CLAUDE.md` **non** vanno ripristinati con `git checkout`: contengono anche
modifiche di altre sessioni. A mano si tolgono solo:
- in `src/App.jsx`: l'import `lazy` di `CollegaTV`, la `<Route path="/collega-tv/:codice" …>` e,
  nel ramo `eLinkDellaTV` di `DeeplinkHandler`, la navigazione (torna a `return` e basta);
- in `CLAUDE.md`: `sceltaTV.js`, `CollegaTV` e `FoglioChiediTV` nella riga §11 e, nelle rotte §8,
  `/collega-tv/:codice` e le note su `?tv=`/`chiedi=1` di `/workout/:id` e `/archive`.

## Caso 2 — già salvato su GitHub (branch `app`)

Il lavoro starà in uno o più commit dopo `aba7fec`. Si trovano con:

```bash
git log --oneline prima-scelta-tv-2026-11-02..app
```

⚠️ L'elenco mostra **anche altri lavori** fatti dopo il tag (per esempio i commit «Scarpe: spec del
design» e «Scarpe: piano di implementazione»): quelli **non** si annullano. Si sceglie solo il commit
della scelta TV.

Si annulla **solo** il commit di questo lavoro (quelli di altre sessioni restano), con un commit
nuovo che lo disfa — niente si cancella dalla storia:

```bash
git revert <sha-del-commit-della-scelta-tv>
git push origin app
```

Se nello stesso commit fossero finite anche modifiche di altre sessioni, `git revert` toglierebbe
anche quelle: in quel caso si fa come nel Caso 1, a mano, e si salva.

## Caso 3 — già pubblicato sul sito (`app:main`)

Dopo il Caso 2: `git push origin app:main`. Sul sito la funzione non si vede (il link `fleofit://`
esiste solo nell'app), quindi non c'è urgenza.

## Le app sugli Store

Questa funzione arriva solo con una versione nuova dell'app. Se è già sugli Store, si toglie con la
versione successiva; nel frattempo il danno massimo è una pagina di scelta che compare dopo aver
inquadrato il QR con la fotocamera.
