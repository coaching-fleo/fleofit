# Gare di corsa dal calendario FIDAL — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** in «Nuovo evento» → «Prossima gara» si sceglie, oltre alle HYROX, una gara di corsa dal calendario FIDAL (nazionale e regionale, strada e trail), che si aggiorna da sola.

**Architecture:** una Edge Function nuova `gare-corsa` legge 14 pagine mensili di fidal.it (lettura pura in `regole.ts`, provata su copie vere) e tiene una copia di 6 ore; il telefono la chiama tramite `src/lib/gareCorsa.js` (copia di 12 ore) e la mostra in `GareCorsa.jsx`, caricato pigro da `NuovoEvento.jsx`. L'evento salvato è quello di sempre con `sections.corsa`.

**Tech Stack:** React 19, Vitest + Testing Library, Supabase Edge Functions (Deno), Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-11-04-gare-corsa-design.md`

## Global Constraints

- Nessuna migrazione, nessuna tabella, nessun secret (schema congelato, CLAUDE.md §0-bis).
- Interfaccia e commenti in italiano; nomi come nei file vicini (`gareHyrox.js`, `gare-hyrox/regole.ts`).
- Mai una chiave `hyrox` in `sections` di un evento di corsa.
- Colori solo dai token: accento Corsa = `running` (`#0094C6`), Hyrox = `brand`. Niente palette nuove.
- localStorage solo con `leggiJson`/`scriviJson` di `src/lib/offlineQueue.js`; chiavi `fleofit_cache_gare_corsa`, `fleofit_corsa_regione`.
- Aptica solo da `src/lib/aptica.js` (`vibraScelta` sulle scelte).
- `GareCorsa.jsx` si importa solo con `lazy` (il chunk `index` non deve crescere, CLAUDE.md §2).
- Ogni modale/foglio con `createPortal(…, document.body)`; il foglio regione si chiude con una X `aria-label="Chiudi"` (tasto indietro Android).
- Ogni test nuovo va visto fallire rompendo apposta il codice che copre (CLAUDE.md §9).
- Commit su `app`, file aggiunti per nome. Il deploy della funzione e il push si fanno solo su richiesta del committente.

## Review Focus

1. **Gara a cavallo d'anno** (pagina di gennaio letta a dicembre, o «30-31/12» / «31/12-01/01»): l'anno è quello della pagina, e se il mese di fine è minore di quello d'inizio la fine va all'anno dopo → test in Task 1.
2. **Città senza parentesi o senza provincia** («Trestina PG», «Roma RM», «Dakar --»): provincia letta lo stesso, e una gara senza sigla italiana resta con `regione: ''` (non sparisce, non va in una regione a caso). Le gare fuori Italia del calendario nazionale («Dakar») escono → test in Task 1.
3. **Entità HTML nei nomi** (`Citta&#039;`, `Met&agrave;`, `&amp;`): il nome mostrato è decodificato → test in Task 1.
4. **Il server risponde una lista di forma vecchia o vuota**: non si salva nel telefono e non si mostra «nessuna gara» come se fosse vero → test in Task 4.
5. **Ricerca + regione + distanza insieme che non trovano niente**: «Nessuna gara trovata» e i filtri restano azzerabili (pillola «Tutte», «Tutta Italia») → test in Task 5.

---

## File

| File | Cosa fa |
|---|---|
| `supabase/functions/gare-corsa/regole.ts` (nuovo) | lettura pura della pagina FIDAL, `PROVINCE`, distanza, mesi da leggere, unione |
| `supabase/functions/gare-corsa/index.ts` (nuovo) | scarica, copia in memoria, risponde |
| `src/lib/__tests__/fixtures/fidal-cod.html`, `fidal-reg.html` (nuovi) | copie vere, ridotte |
| `src/lib/__tests__/gareCorsaServer.test.js` (nuovo) | prove di `regole.ts` |
| `src/lib/gare.js` (nuovo) | funzioni comuni uscite da `gareHyrox.js` |
| `src/lib/gareHyrox.js` (modifica) | le riesporta |
| `src/lib/gareCorsa.js` + `__tests__/gareCorsa.test.js` (nuovi) | caricamento, filtri, `sectionsEventoCorsa` |
| `src/components/GareCorsa.jsx` (nuovo) | lista, righe, foglio regione, card della gara scelta |
| `src/components/NuovoEvento.jsx` (modifica) | levetta Hyrox \| Corsa, stato, salvataggio |
| `src/components/__tests__/NuovoEvento.test.jsx` (nuovo) | prova della pagina |
| `src/supabaseDemo.js` (modifica) | `gareCorsaFinte()` |

---

### Task 1: La lettura della pagina FIDAL (`regole.ts`)

**Files:**
- Create: `supabase/functions/gare-corsa/regole.ts`
- Create: `src/lib/__tests__/fixtures/fidal-cod.html`, `src/lib/__tests__/fixtures/fidal-reg.html`
- Test: `src/lib/__tests__/gareCorsaServer.test.js`

**Interfaces:**
- Produces:
  - `type GaraCorsa = { id: string, nome: string, dal: string, al: string, tipo: 'strada'|'trail', citta: string, provincia: string, regione: string, distanza: 'maratona'|'mezza'|'10k'|'5k'|'trail'|'altre', livello: 'nazionale'|'regionale', url: string }`
  - `URL_CALENDARIO = 'https://www.fidal.it/calendario.php'`
  - `urlMese(anno: number, mese: number, livello: 'COD'|'REG'): string` → `${URL_CALENDARIO}?anno=…&mese=…&livello=…&submit=Invia`
  - `leggiGareCorsa(html: string, anno: number): GaraCorsa[]`
  - `distanzaDa(testo: string, tipo: string): GaraCorsa['distanza']`
  - `luogo(testo: string): { citta: string, provincia: string }`
  - `PROVINCE: Record<string, string>` (sigla → slug regione: `'lombardia'`, `'valle-d-aosta'`, `'trentino-alto-adige'`, `'friuli-venezia-giulia'`, `'emilia-romagna'`, …; 20 slug)
  - `mesiDaLeggere(oggi: string /* yyyy-MM-dd */): { anno: number, mese: number }[]` → 7 elementi, dal mese corrente
  - `unisci(liste: GaraCorsa[][]): GaraCorsa[]` → dedup per `id`, ordinate per `dal` poi `nome` (`localeCompare('it')`)

- [ ] **Step 1: Salvare le copie vere**

```bash
curl -s -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36" "https://www.fidal.it/calendario.php?anno=2026&mese=11&livello=COD&submit=Invia" -o /tmp/cod.html
curl -s -A "…stesso UA…" "https://www.fidal.it/calendario.php?anno=2026&mese=11&livello=REG&submit=Invia" -o /tmp/reg.html
```

Ridurle a mano (come `find-my-race.html`): tenere testata della pagina e la `<table>` del calendario con queste righe, intatte:
- `fidal-cod.html`: «XXVII^ Maratona di Ravenna Citta' d'Arte» (42.195km), «XIV^ Ravenna Half Marathon», «XIII^ Trofeo del Mare» (10km, Bagheria (PA)), «XIII^ Rome 5k» (Roma RM), «Annullata - II^ Nuraghes Marathon Sardinia», «XV^ Cross della Valsugana» (CROSS), «XII^ Mezza Maratona Int.le Citta' di Caserta» (21-22/11), «GIOCHI OLIMPICI GIOVANILI OUTDOOR Dakar» (08-10/11, città `--`), «XV^ Lago Maggiore Marathon - 33 km», «III^ Trullincorsa UNESCO Trail» (TRAIL).
- `fidal-reg.html`: «Egnazia 9.5», «Trofeo del Mare Kids», «XII STRACASAGIOVE - KM 10,700», «Metà Mezza» (Trestina PG), «Autun Run», una riga CROSS, una gara di tipo `MONTAGNA/TRAIL` (cercarla nel mese 11 o, se manca, in un mese dove c'è e aggiungere la riga).

- [ ] **Step 2: Scrivere i test che falliscono** (`gareCorsaServer.test.js`, blocco «Perché questi test esistono» come in `gareHyroxServer.test.js`)

```js
import cod from './fixtures/fidal-cod.html?raw'
import reg from './fixtures/fidal-reg.html?raw'
import { leggiGareCorsa, distanzaDa, luogo, PROVINCE, mesiDaLeggere, unisci, urlMese } from '../../../supabase/functions/gare-corsa/regole.ts'

it('una gara nazionale letta per intero', () => {
  expect(leggiGareCorsa(cod, 2026).find(g => g.id === 'COD14771')).toEqual({
    id: 'COD14771', nome: 'Trofeo del Mare', dal: '2026-11-01', al: '2026-11-01', tipo: 'strada',
    citta: 'Bagheria', provincia: 'PA', regione: 'sicilia', distanza: '10k', livello: 'nazionale',
    url: 'https://www.fidal.it/calendario/XIII^-Trofeo-del-Mare/COD14771',
  })
})
it('gara di due giorni', () => { /* Caserta: dal '2026-11-21', al '2026-11-22', distanza 'mezza' */ })
it('escono annullate, cross, ragazzi e gare fuori Italia', () => {
  const nomi = [...leggiGareCorsa(cod, 2026), ...leggiGareCorsa(reg, 2026)].map(g => g.nome).join('|')
  for (const via of ['Nuraghes', 'Valsugana', 'Kids', 'GIOCHI OLIMPICI']) expect(nomi).not.toContain(via)
})
it('nome decodificato e senza edizione', () => { /* «Maratona di Ravenna Citta' d'Arte», «Metà Mezza» */ })
it('regionale: livello e città senza parentesi', () => { /* Metà Mezza → citta 'Trestina', provincia 'PG', regione 'umbria', livello 'regionale' */ })
it('MONTAGNA/TRAIL diventa trail', () => { /* tipo 'trail', distanza 'trail' */ })
it.each([
  ['42.195km', 'STRADA', 'maratona'], ['Maratonina Citta di Crema', 'STRADA', 'mezza'],
  ['Mezza Maratona', 'STRADA', 'mezza'], ['Ravenna Half Marathon', 'STRADA', 'mezza'],
  ['21.0975km', 'STRADA', 'mezza'], ['XII STRACASAGIOVE - KM 10,700', 'STRADA', '10k'],
  ['Milano21 (10K)', 'STRADA', '10k'], ['Savona Ten 10K', 'STRADA', '10k'], ['Rome 5k', 'STRADA', '5k'],
  ['Egnazia 9.5', 'STRADA', '10k'], ['Metà Mezza', 'STRADA', 'altre'],
  ['Lago Maggiore Marathon - 33 km', 'STRADA', 'altre'], ['Ultramaratona del Mare', 'STRADA', 'altre'],
  ['Qualunque', 'TRAIL', 'trail'], ['Autun Run', 'STRADA', 'altre'],
])('distanzaDa(%s, %s) = %s', (t, tipo, atteso) => expect(distanzaDa(t, tipo)).toBe(atteso))
it('luogo', () => {
  expect(luogo('Crema (CR)')).toEqual({ citta: 'Crema', provincia: 'CR' })
  expect(luogo('Roma RM')).toEqual({ citta: 'Roma', provincia: 'RM' })
  expect(luogo('Dakar --')).toEqual({ citta: 'Dakar', provincia: '' })
})
it('PROVINCE copre ogni sigla delle copie e ha 20 regioni', () => { /* new Set(Object.values(PROVINCE)).size === 20; ogni provincia letta ∈ PROVINCE */ })
it('mesiDaLeggere a cavallo d\'anno', () => {
  expect(mesiDaLeggere('2026-11-04')).toEqual([[2026,11],[2026,12],[2027,1],[2027,2],[2027,3],[2027,4],[2027,5]].map(([anno, mese]) => ({ anno, mese })))
})
it('gara a cavallo d\'anno', () => { /* riga sintetica «30/12-02/01» in una tabella minima, anno 2026 → dal '2026-12-30', al '2027-01-02' */ })
it('unisci deduplica e ordina', () => { /* due liste con lo stesso id → una volta; ordine per dal poi nome */ })
it('urlMese', () => expect(urlMese(2027, 1, 'REG')).toBe('https://www.fidal.it/calendario.php?anno=2027&mese=1&livello=REG&submit=Invia'))
```

- [ ] **Step 3: Eseguire e vedere che falliscono** — `npx vitest run src/lib/__tests__/gareCorsaServer.test.js` → FAIL (modulo mancante).

- [ ] **Step 4: Scrivere `regole.ts`**
  - Righe: regex sulle `<tr>` del calendario; celle `<td>` in ordine data · livello (`<abbr>`) · nome (`<a href=…>` + `<font>` corsivo) · tipo · città. Livello dal suffisso dell'id (`COD` → nazionale, `REG` → regionale).
  - Tipi tenuti: `STRADA` → `strada`; `TRAIL`, `MONTAGNA/TRAIL` → `trail`. Tutto il resto esce.
  - Fuori: nome che inizia con «Annullata»; `/\b(kids|giovan|esordient|ragazz|cadett|baby)/i` su nome + sottotitolo; `provincia === ''`.
  - Nome: decodificare le entità (riusare l'idea di `decodifica` di `gare-hyrox/regole.ts`, copiandola qui: le funzioni Deno non condividono file fuori da `_shared`), togliere `^[IVXLCDM]+\^?\s+`, «Annullata - », spazi doppi.
  - Distanza: nell'ordine della spec; numero in km da `(\d+[.,]?\d*)\s*km|km\s*(\d+[.,]?\d*)|(\d+)\s*k\b`, con 9,5–10,9 → `10k`, 4,5–5,9 → `5k`, 21,0–21,2 → `mezza`, 42,0–42,3 → `maratona`; «ultra» → `altre` prima di «maratona»; «metà mezza» → `altre` prima di «mezza»; «ten» come parola → `10k`.
  - `PROVINCE`: le 107 sigle italiane (incluse `SU`, `MB`, `BT`, `FM`, `VS`, `CI`, `OT`, `OG`, `AO`, `BZ`, `TN`) → slug regione.

- [ ] **Step 5: Eseguire e vedere che passano**, poi rompere apposta una regola (es. togliere il filtro «Annullata») e vedere il test cadere; rimetterla.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/gare-corsa/regole.ts src/lib/__tests__/gareCorsaServer.test.js src/lib/__tests__/fixtures/fidal-cod.html src/lib/__tests__/fixtures/fidal-reg.html
git commit -m "Gare di corsa: la lettura del calendario FIDAL"
```

---

### Task 2: La Edge Function `gare-corsa`

**Files:**
- Create: `supabase/functions/gare-corsa/index.ts`

**Interfaces:**
- Consumes: `urlMese`, `leggiGareCorsa`, `mesiDaLeggere`, `unisci` (Task 1).
- Produces: `POST /functions/v1/gare-corsa`, corpo ignorato → `200 { gare: GaraCorsa[], aggiornate: string /* ISO */ }`; `502 { errore }` solo se tutte le 14 pagine falliscono.

- [ ] **Step 1: Scrivere `index.ts`** sul modello di `gare-hyrox/index.ts`: stessi `corsHeaders`, `OPTIONS`, `INTESTAZIONI` (User-Agent da browser, `Accept-Language: it`), `fetch` con `AbortSignal.timeout(10_000)`, `DURATA_COPIA = 6 * 3_600_000`. Le 14 pagine (`mesiDaLeggere(oggi)` × `['COD','REG']`) con una coda e **4** lavoratori; una pagina che fallisce → `console.warn` e lista vuota per lei. `oggi` in fuso `Europe/Rome`. Commento in testa: perché dal server, perché una funzione nuova, nessun secret.
- [ ] **Step 2: Verifica locale della lettura vera** (Deno non è nel progetto: si prova `regole.ts` con Node sulle pagine scaricate)

```bash
node --experimental-strip-types -e "import('./supabase/functions/gare-corsa/regole.ts').then(async r=>{const h=await (await fetch(r.urlMese(2026,12,'REG'),{headers:{'User-Agent':'Mozilla/5.0'}})).text();const g=r.leggiGareCorsa(h,2026);console.log(g.length, g.filter(x=>!x.regione).length, g.slice(0,3))})"
```
Atteso: decine di gare, `0` senza regione, oggetti completi.
- [ ] **Step 3: Commit** — `git add supabase/functions/gare-corsa/index.ts` · «Gare di corsa: la Edge Function gare-corsa».

---

### Task 3: Le funzioni comuni in `src/lib/gare.js`

**Files:**
- Create: `src/lib/gare.js`
- Modify: `src/lib/gareHyrox.js`

**Interfaces:**
- Produces: `normalizza`, `gareFuture`, `giorniGara`, `periodoGara`, `blocchettoData`, `quandoGara`, `perMese`, `giornoProposto` — stesse firme di oggi, esportate da `gare.js` e **riesportate** da `gareHyrox.js` (`export { … } from './gare'`).

- [ ] **Step 1:** Spostare le otto funzioni (con i loro commenti) in `gare.js`; `normalizza` diventa esportata. `gareHyrox.js` le importa per uso interno e le riesporta.
- [ ] **Step 2:** `npx vitest run src/lib/__tests__/gareHyrox.test.js src/components/__tests__/GarePassate.test.jsx` → PASS senza toccare i test.
- [ ] **Step 3: Commit** — `git add src/lib/gare.js src/lib/gareHyrox.js` · «Gare: le funzioni comuni escono da gareHyrox».

---

### Task 4: `src/lib/gareCorsa.js`

**Files:**
- Create: `src/lib/gareCorsa.js`
- Test: `src/lib/__tests__/gareCorsa.test.js`

**Interfaces:**
- Consumes: `normalizza` (Task 3); forma `GaraCorsa` (Task 1); `leggiJson`/`scriviJson`.
- Produces:
  - `CHIAVE_CACHE_GARE_CORSA = 'fleofit_cache_gare_corsa'`, `CHIAVE_REGIONE = 'fleofit_corsa_regione'`
  - `REGIONI: Record<string, string>` (slug → «Lombardia», «Valle d'Aosta», «Trentino-Alto Adige», …)
  - `DISTANZE: { id, etichetta, filigrana }[]` in ordine: `5k`/«5 km»/«5K» · `10k`/«10 km»/«10K» · `mezza`/«Mezza»/«21K» · `maratona`/«Maratona»/«42K» · `trail`/«Trail»/«TRAIL» · `altre`/«Altre»/`''`
  - `formaAttuale(gare): boolean` (ogni gara ha `id`, `dal`, `distanza`, `regione` come stringa)
  - `caricaGareCorsa(supabase, { adesso, storage }): Promise<{ gare, errore }>` — come `caricaGare`: `functions.invoke('gare-corsa', { body: {} })`, 12 ore, `VERSIONE_CACHE = 1`, errore `'Calendario FIDAL non disponibile in questo momento.'`
  - `filtraCorsa(gare, { regione = '', distanza = '', ricerca = '' }): GaraCorsa[]` — ricerca su `nome` + `citta`, tutte le parole, senza accenti
  - `regioniPresenti(gare): string[]` (ordinate per nome), `distanzePresenti(gare): string[]` (ordine di `DISTANZE`)
  - `leggiRegione(storage)`, `scriviRegione(slug, storage)`
  - `sectionsEventoCorsa(gara): object` — vedi spec

- [ ] **Step 1: Test che falliscono**
  - `caricaGareCorsa`: copia fresca → nessuna chiamata; copia scaduta + server ok → nuova copia salvata; server in errore + copia vecchia → copia vecchia; server in errore senza copia → `{ gare: [], errore: 'Calendario FIDAL non disponibile in questo momento.' }`; **server con lista vuota o di forma vecchia** (Review Focus 4) → non salvata, e con lista vuota senza copia → `errore` valorizzato.
  - `filtraCorsa`: `{ regione: 'lombardia', distanza: 'mezza', ricerca: 'crema' }` su quattro gare → una; `ricerca: 'meta'` trova «Metà Mezza»; tutti vuoti → tutte.
  - `sectionsEventoCorsa(gara)`: `toEqual({ category: 'Event', isEvent: true, isAutonomous: true, corsa: { id, distanza, tipo, citta, provincia, regione, url, dal, al } })` e `not.toHaveProperty('hyrox')`.
  - `REGIONI` ha 20 chiavi e contiene ogni valore di `PROVINCE` (import da `regole.ts`).
- [ ] **Step 2:** `npx vitest run src/lib/__tests__/gareCorsa.test.js` → FAIL.
- [ ] **Step 3:** Scrivere `gareCorsa.js`.
- [ ] **Step 4:** → PASS; rompere `sectionsEventoCorsa` aggiungendo `hyrox: {}` e vedere cadere il test.
- [ ] **Step 5: Commit** — `git add src/lib/gareCorsa.js src/lib/__tests__/gareCorsa.test.js` · «Gare di corsa: caricamento, filtri e salvataggio».

---

### Task 5: Il foglio — `GareCorsa.jsx`, levetta in `NuovoEvento`, demo

**Files:**
- Create: `src/components/GareCorsa.jsx`
- Modify: `src/components/NuovoEvento.jsx`, `src/supabaseDemo.js`
- Test: `src/components/__tests__/NuovoEvento.test.jsx`

**Interfaces:**
- Consumes: Task 3 (`blocchettoData`, `quandoGara`, `perMese`, `periodoGara`), Task 4 (tutto).
- Produces: `export default function GareCorsa({ oggi, gara, onScegli, onCambia, onAltro })` — senza `gara` mostra la lista (carica da sé con `caricaGareCorsa(supabase)`), con `gara` la card grande + «Cambia gara» (`onCambia`) + «Pagina FIDAL ↗» (`gara.url`, `target="_blank"`).

- [ ] **Step 1: Test di pagina che fallisce** (`NuovoEvento.test.jsx`, `fintoSupabase` come `GarePassate.test.jsx`; `functions.invoke` risponde `{ gare: [] }` per `gare-hyrox` e quattro gare di corsa per `gare-corsa`):
  - «Prossima gara» → tocco su «Corsa» → compaiono le righe raggruppate per mese;
  - pillola «Mezza» → resta solo la mezza; tocco sulla riga → card con «Pagina FIDAL»; «Aggiungi al Calendario» → l'insert su `workouts` ha `sections.corsa.id` e nessun `sections.hyrox`;
  - **Review Focus 5**: ricerca «zzz» → «Nessuna gara trovata»; «Tutte» e «Tutta Italia» restano toccabili;
  - foglio regione: scegliere «Lombardia» → solo le lombarde, e `localStorage['fleofit_corsa_regione']` scritto; riaprendo il foglio la regione è già quella.
- [ ] **Step 2:** `npx vitest run src/components/__tests__/NuovoEvento.test.jsx` → FAIL.
- [ ] **Step 3: `GareCorsa.jsx`** come da spec («Nel telefono → GareCorsa.jsx»): ricerca (`aria-label="Cerca gara di corsa"`, placeholder «Cerca gara o città», focus `border-running`); bottone regione con `ChevronDown` che apre un foglio dal basso (`createPortal`, `rounded-t-3xl`, maniglia, X `aria-label="Chiudi"`, voci «Tutta Italia» + `regioniPresenti`); pillole distanza (`distanzePresenti`, attiva `bg-white text-black`, come le pillole continente); sezioni per mese con `LABEL` e conteggio; riga `button` con `aria-label="<nome>, <periodoGara>"`, `rounded-2xl bg-[#1e1e1e] border border-[#2a2a2a] hover:border-running`, blocchetto data, nome `truncate`, sotto `Città (PR) · Regione` in `text-gray-400`, pillola `bg-running/10 text-running border border-running/30 rounded-full text-xs font-bold`; scheletri `h-16 animate-pulse`; errore → testo + «Scrivi l'evento a mano» (`onAltro`). Card scelta: `h-52 rounded-3xl bg-[#161616]`, filigrana `DISTANZE[…].filigrana` come il codice HYROX in `CardGara`, `quandoGara` in pillola (`bg-running/15 text-running` per «Oggi»/«In corso»).
- [ ] **Step 4: `NuovoEvento.jsx`**: `const GareCorsa = lazy(() => import('./GareCorsa'))`; stato `sport` (`'hyrox'|'corsa'`, parte da `'hyrox'`) e `garaCorsa`; levetta a due voci sotto le schede quando `modo === 'hyrox'` (toggle segmentato con indicatore che trasla, testo attivo `text-brand` o `text-running`); `scegliGaraCorsa` imposta titolo = `gara.nome` e `date = giornoProposto(gara, dataIniziale)`; `garaInUso`/`pronto`/`mostraSalva` tengono conto di `sport`; `handleSave` usa `sectionsEventoCorsa(garaCorsa)` con Corsa; pillole del giorno e «Nome nel calendario» condivise, accento `running` con Corsa. Aggiornare il commento in testa (tre modi + levetta).
- [ ] **Step 5: Demo**: in `supabaseDemo.js`, accanto a `gare-hyrox`, `if (nome === 'gare-corsa') return { data: { gare: gareCorsaFinte() }, error: null }`; `gareCorsaFinte()` con quattro gare (maratona nazionale Veneto, mezza nazionale Lombardia, 10 km regionale Lazio, trail regionale Trentino) a +12, +25, +40, +60 giorni da oggi.
- [ ] **Step 6:** test → PASS; rompere apposta (es. `handleSave` che usa `sectionsEvento`) e vederlo cadere.
- [ ] **Step 7: Verifica nel browser** (`npm run demo`, preview): Calendario → + → Corsa; screenshot di lista, foglio regione, card scelta; console senza errori.
- [ ] **Step 8: Commit** — `git add src/components/GareCorsa.jsx src/components/NuovoEvento.jsx src/supabaseDemo.js src/components/__tests__/NuovoEvento.test.jsx` · «Gare di corsa: la scelta in Nuovo evento».

---

### Task 6: Pesi, suite intera e memoria

**Files:**
- Modify: `docs/memoria/calendario.md`, `CLAUDE.md`, `DEVLOG.md`

- [ ] **Step 1:** `npm run build` → `index` resta intorno ai 603 KB (± 2) e compare un chunk `GareCorsa-*.js` separato.
- [ ] **Step 2:** `npm test` → tutto verde; `npx eslint src/lib/gare.js src/lib/gareCorsa.js src/components/GareCorsa.jsx src/components/NuovoEvento.jsx` → nessun problema nuovo.
- [ ] **Step 3: Memoria**: sezione `## 9-gare-corsa` in `calendario.md` (fonte, cosa si tiene, `sections.corsa` e perché non `hyrox`, come si aggiornano le copie dei test); in CLAUDE.md la riga `gare-corsa` fra le Edge Function (§4), le due chiavi in §8, `GareCorsa`/`gareCorsa.js`/`gare.js` nella riga `calendario.md` del §11, il conteggio dei test; voce in `DEVLOG.md`.
- [ ] **Step 4: Commit** — `git add docs/memoria/calendario.md CLAUDE.md DEVLOG.md` · «Gare di corsa: memoria».
- [ ] **Step 5:** Dire al committente che serve `supabase functions deploy gare-corsa` (non tocca il sito) e farlo solo al suo sì.
