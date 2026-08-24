---
name: FLEOFIT
description: Coaching Hyrox e Running — la lavagna scura di un coach, con un solo tratto giallo che dice cosa conta.
colors:
  brand: "#f1ba17"
  bg: "#0B0B0B"
  surface: "#222222"
  surface2: "#2a2a2a"
  card: "#1e1e1e"
  well: "#111111"
  running: "#0094C6"
  custom: "#D11149"
  event: "#ffffff"
  ai: "#a855f7"
  border-default: "#333333"
  border-strong: "#383838"
  border-max: "#444444"
  success: "#22c55e"
  live: "#ef4444"
  offline: "#f97316"
typography:
  display:
    fontFamily: "Inter, sans-serif"
    fontSize: "3rem"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Inter, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 900
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.05em"
  numeral:
    fontFamily: "Inter, sans-serif"
    fontSize: "7.5rem"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.05em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "#000000"
    rounded: "{rounded.md}"
    padding: "14px 24px"
  button-primary-hover:
    backgroundColor: "#ffcd19"
    textColor: "#000000"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.surface2}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  button-secondary-hover:
    backgroundColor: "{colors.border-default}"
    textColor: "#ffffff"
  button-icon:
    backgroundColor: "{colors.surface2}"
    textColor: "#ffffff"
    rounded: "{rounded.full}"
    size: "44px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "#ffffff"
    rounded: "{rounded.xl}"
    padding: "20px"
  input:
    backgroundColor: "{colors.well}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  chip-category:
    backgroundColor: "rgba(241, 186, 23, 0.1)"
    textColor: "{colors.brand}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  nav-bar:
    backgroundColor: "{colors.surface}"
    textColor: "#9ca3af"
    height: "64px"
  nav-item-active:
    textColor: "{colors.brand}"
  picker-well:
    backgroundColor: "{colors.bg}"
    rounded: "{rounded.md}"
    height: "144px"
---

# Design System: FLEOFIT

## Overview

**Creative North Star: "La Lavagna del Coach"**

FLEOFIT è una superficie scura su cui una sola mano scrive. Il fondo quasi-nero non è
un tema, è la lavagna: sta lì per sparire, per far esistere solo quello che il coach ha
deciso che oggi conta. Il giallo brand è il gesso — compare poco, e ogni volta che compare
significa "questo". Tutto il resto del sistema è grigio ordinato: quattro toni di superficie
e quattro pesi di bordo che costruiscono la gerarchia senza mai alzare la voce.

Il carattere dei componenti è **tattile e sicuro di sé**. Raggi ampi (24px sulle card,
12px su bottoni e input), superfici generose, feedback aptico su ogni picker e ogni slider,
scala al tocco sugli elementi selezionati. Non è un documento da leggere: è un oggetto da
usare con una mano sola, spesso di fretta, spesso appena prima o appena dopo un allenamento.
La densità informativa è alta dove serve al coach (il builder), e bassissima dove serve
all'atleta (la Home dice una cosa sola: cosa fai oggi).

La codifica per categoria è la seconda struttura portante, dopo la gerarchia tonale. Ogni
disciplina ha la sua corsia cromatica — giallo Hyrox, blu Running, rosso Custom, bianco
Evento — e quel colore attraversa coerentemente il puntino nel calendario settimanale, il
bordo in hover, la pillola di categoria, l'icona in filigrana e il glow del bottone. Chi usa
l'app impara il colore prima della parola.

**Anti-riferimenti confermati:** l'app fitness generalista (gradienti saturi, illustrazioni
allegre, badge, coriandoli, gamification) e la dashboard SaaS enterprise (griglie di widget
grigi, tabelle dense senza gerarchia, look da pannello di amministrazione). FLEOFIT non deve
somigliare a nessuna delle due.

**Key Characteristics:**
- Dark mode only, quattro toni di superficie, nessun tema chiaro previsto.
- Un solo accento primario, usato con parsimonia; il colore aggiuntivo è sempre semantico.
- Peso tipografico (900 / 700) come strumento di gerarchia, non corpo tipografico.
- Colonna singola mobile-first: praticamente nessun breakpoint in 12.800 righe di UI.
- Superfici piatte, profondità per tono e bordo; l'ombra è stato, non atmosfera.
- Raggi ampi e forme piene: cerchi per le azioni-icona, pillole per gli stati.

## Colors

Una palette quasi interamente acromatica, con un solo accento caldo e tre colori-corsia che
esistono per identificare la disciplina, mai per decorare.

### Primary
- **Gesso Ambra** (`#f1ba17`): l'accento del sistema e il colore della categoria **Hyrox**.
  Marca la CTA primaria (fondo pieno, testo nero), la voce attiva della navbar, il bordo in
  focus di ogni input, il giorno selezionato nel date picker, il valore attivo negli scroll
  picker, la "FIT" del logo. È il colore più usato del progetto (416 occorrenze) proprio
  perché è sempre lo stesso gesto: qui.

### Secondary
- **Blu Cianografia** (`#0094C6`): la categoria **Running**. Governa il builder di corsa,
  i picker di passo e durata, i puntini di corsa nel calendario settimanale e il focus degli
  input nel contesto running.

### Tertiary
- **Rosso Correzione** (`#D11149`): la categoria **Custom / allenamento autonomo**, cioè ciò
  che l'atleta ha aggiunto di suo. È deliberatamente il colore più "a mano libera" del set.
- **Bianco Evento** (`#ffffff`): la categoria **Evento / Gara**. Il bianco pieno è il segnale
  più forte disponibile su fondo nero, ed è riservato all'obiettivo in calendario.
- **Viola IA** (`#a855f7`): esclusivamente il percorso di generazione con IA e la dettatura
  vocale nel builder. Non è un colore di brand: è l'etichetta di "questo l'ha proposto la
  macchina, controllalo".

### Neutral
- **Ardesia** (`#0B0B0B`): il fondo di ogni pagina e il pozzetto degli scroll picker.
- **Superficie Card** (`#1e1e1e`): card, modali, bottom sheet, header. Il livello su cui
  vive quasi tutto il contenuto.
- **Superficie Cromo** (`#222222`): navbar fissa e blocchi del builder — le parti di
  interfaccia che non sono contenuto.
- **Superficie in Rilievo** (`#2a2a2a`): bottoni secondari, avatar placeholder, indicatore
  del toggle segmentato, e il bordo più tenue del sistema.
- **Pozzetto** (`#111111`): tutto ciò che è incassato — campi input, contenitori di toggle,
  celle di dato dentro una card. È l'unico tono che va "sotto" la card.
- **Bordi** (`#333333` default · `#383838` marcato · `#444444` massimo): tre gradini di
  contrasto crescente; `#2a2a2a` fa da quarto gradino, il più tenue.
- **Testo** (bianco → `gray-300` → `gray-400` → `gray-500`): gerarchia discendente rigida.
  `gray-400` (#9ca3af, 6.57:1 sulla card) è il **pavimento del testo informativo**.
  ⚠️ Aggiornato il 24/08/2026: `gray-600` (#4b5563) è stato **eliminato dal sistema** — su
  pozzetto dava 2.50:1, sotto anche il minimo per il testo grande. Le sue 22 occorrenze sono
  passate a `gray-400`. `gray-500` (3.45:1) sopravvive solo su elementi disattivati, mai su
  testo che l'utente deve leggere.

### Semantic
- **Verde Completato** (`#22c55e` / `green-500`): workout completato. Unico verde del sistema.
- **Rosso Live** (`#ef4444` / `red-500`): sessione live (Live Coach Cam), cardio BLE attivo,
  azioni distruttive.
- **Arancio Offline** (`#f97316` / `orange-500`): banner Modalità Offline. Non ha altri usi.

### Named Rules

**La Regola del Tratto Unico.** Il Gesso Ambra marca ciò che è attivo, primario o Hyrox.
Mai come sfondo di una superficie grande, mai due CTA gialle piene nella stessa schermata.
Test: se in una vista il giallo copre più del 10% dei pixel, non è più un tratto, è vernice.

**La Regola della Corsia.** Ogni categoria ha un colore e uno solo, e quel colore si propaga
in modo coerente a puntino, bordo in hover, pillola, icona in filigrana e glow. Non si
inventa un quinto colore-categoria e non si usa un colore-corsia per un elemento che non
appartiene a quella categoria.

**La Regola del Nero Sopra il Giallo.** Su Gesso Ambra pieno il testo è nero (`#000`), mai
bianco. Vale per CTA, pillole piene e giorno selezionato. Stesso principio sul Bianco Evento.

## Typography

**Famiglia unica:** `Inter, sans-serif` (dichiarata in `src/index.css`).

> ⚠️ **Stato reale, da sapere:** Inter non è caricato da nessuna parte — nessun `@font-face`,
> nessun link a Google Fonts, nessun pacchetto npm. Sul dispositivo il fallback `sans-serif`
> di WebKit iOS è **Helvetica**: l'app spedita oggi non rende in Inter. La scala qui sotto è
> reale, la famiglia è un'intenzione non ancora realizzata. Va risolta scegliendo: caricare
> Inter come asset locale, oppure adottare esplicitamente `-apple-system` e progettare su
> San Francisco.

**Carattere:** neutro-geometrico, senza personalità propria, tutto affidato al peso.
Il sistema usa due pesi come strumento di gerarchia (900 e 700) e due come supporto
(500 e 400), non una scala di corpi.

### Hierarchy
- **Display** (900, `3rem`, lh 1, `tracking-tight`): solo il logo nella schermata di
  benvenuto. Un uso, uno soltanto.
- **Headline** (900, `1.875rem`, lh 1.1, `tracking-tight`): titolo di pagina, saluto in Home,
  logo in header. È il livello che apre ogni schermata.
- **Title** (700, `1.125rem`): titolo di card, intestazione di modale, nome del blocco.
- **Body** (400/500, `0.875rem`, lh 1.5): il corpo reale dell'interfaccia. `text-sm` e
  `text-xs` insieme coprono 333 dei 583 usi tipografici del progetto: questo è un sistema
  che vive in piccolo e compensa col peso.
- **Label** (700, `0.75rem` / `0.6875rem`, `tracking-wider`, MAIUSCOLO): etichette di campo,
  pillole di stato, intestazioni di sezione, giorni della settimana.
  ⚠️ Aggiornato il 24/08/2026: **pavimento tipografico a 11px**, dal minimo iOS. Le 44 occorrenze
  di `text-[9px]` e `text-[10px]` sono passate a `text-[11px]`.
- **Numeral** (900, fino a `7.5rem`, `tracking-tighter`): il cronometro del timer guidato e i
  numeri della TV Dashboard. È l'unico punto in cui la tipografia diventa il contenuto.

### Named Rules

**La Regola del Peso, non del Corpo.** La gerarchia si costruisce con il peso (900 → 700 →
500 → 400) e con il colore del testo, non moltiplicando i corpi. Prima di introdurre una
nuova taglia, verifica che il livello non esista già con un peso diverso.

**La Regola del Maiuscolo Solo Etichetta.** Il maiuscolo con `tracking-wider` appartiene alle
etichette e alle pillole. Titoli, corpo e bottoni non vanno mai in maiuscolo.

**La Regola del Logo.** Il marchio è sempre `FLEO` bianco + `FIT` in Gesso Ambra, peso 900,
`tracking-tight`, in un unico `<h1>`. Nessuna variante di colore, spaziatura o peso.

## Layout

Il modello spaziale è **una colonna sola, pensata per il pollice**. In 12.800 righe di UI
compaiono 17 prefissi `sm:` e un solo `md:`: il desktop non è un layout diverso, è la stessa
colonna centrata (`max-w-2xl` per il contenuto, `max-w-sm` / `max-w-md` per modali e dialoghi).
Non esiste una griglia multi-colonna se non per micro-strutture locali (`grid-cols-7` del
calendario, coppie di statistiche).

**Guscio di pagina**, identico ovunque: `min-h-screen` su fondo Ardesia, gutter orizzontale
`px-4` (16px), apertura `pt-[calc(env(safe-area-inset-top)+1rem)]` e chiusura `pb-24` (96px)
per stare sopra la navbar fissa da 64px.

**Ritmo di spaziatura**, di fatto una scala a sei passi: `gap-1` (4px) per elementi
attaccati, `gap-2` (8px) e `gap-3` (12px) come default di gruppo, `gap-4` (16px) tra sezioni,
`p-4` (16px) per contenitori interni, `p-5` / `p-6` (20/24px) per le card di primo livello.
`gap-2` e `gap-3` da soli valgono 226 usi: sono il battito del sistema.

**Densità a due velocità.** La Home dell'atleta è rada e centrata su un'informazione sola;
il builder del coach è denso, con blocchi impilati, picker affiancati e controlli ravvicinati.
Sono deliberatamente due regimi diversi dello stesso sistema.

### Named Rules

**La Regola della Colonna Unica.** Mobile-first non come compromesso ma come formato: ogni
nuova schermata nasce come colonna singola. Un breakpoint si introduce solo per raffinare
una micro-struttura, mai per riorganizzare la pagina.

**La Regola del Doppio Margine iOS.** Ogni pagina apre con la safe area
(`pt-[calc(env(safe-area-inset-top)+1rem)]`) e chiude con
`pb-[calc(6rem+env(safe-area-inset-bottom))]`. Una schermata che non rispetta entrambi i lati è
rotta su iPhone, non "quasi giusta".
⚠️ Aggiornato il 24/08/2026: prima la navbar era `h-16` senza inset inferiore e le pagine usavano
`pb-24` fisso — l'home indicator si sovrapponeva alle etichette della navbar. Ora la navbar è
`h-[calc(4rem+env(safe-area-inset-bottom))]` con `pb-[env(safe-area-inset-bottom)]`, e le pagine
riservano lo stesso spazio.

## Elevation & Depth

Il sistema è **piatto**. La profondità nasce da una scala tonale e da quattro pesi di bordo,
non dalle ombre. Le superfici non fluttuano: si annidano.

**La scala dei quattro toni**, dal fondo alla superficie: Ardesia `#0B0B0B` (pagina) →
`#1e1e1e` (card) → `#2a2a2a` (rilievo: bottone secondario, indicatore del toggle) e, in
direzione opposta, `#111111` (pozzetto: input, contenitori incassati). Il pozzetto è l'unico
livello che scende sotto la card.

L'ombra esiste, ma ha un solo mestiere: **dire che qualcosa è attivo**. Il glow colorato
(`shadow-lg shadow-[#f1ba17]/20`) accompagna la CTA primaria, il giorno selezionato, la
pillola di stato del workout di oggi. `shadow-2xl` è riservato alle modali, dove serve a
staccare il dialogo dall'overlay `bg-black/85`.

### Shadow Vocabulary
- **Glow di stato** (`box-shadow: 0 10px 15px -3px rgba(241,186,23,0.2)` — Tailwind
  `shadow-lg shadow-[#f1ba17]/20`, declinato nel colore della categoria): elemento attivo,
  primario o selezionato.
- **Alone di puntino** (`box-shadow: 0 0 8px rgba(241,186,23,0.4)`): i pallini del calendario
  settimanale, dove segnala il giorno completato in quella categoria.
- **Stacco di modale** (`shadow-2xl`): solo dialoghi, bottom sheet e date picker.

### Named Rules

**La Regola Piatto + Glow di Stato.** Le superfici sono piatte e si distinguono per tono e
bordo. L'ombra colorata è riservata a ciò che è attivo, primario o selezionato: è stato, non
atmosfera. Un elemento a riposo non ha mai un glow.

**La Regola dei Gradini.** Un elemento non salta un gradino della scala tonale: non si mette
una superficie `#2a2a2a` direttamente sul fondo `#0B0B0B` senza la card intermedia, e non si
annida un pozzetto dentro un pozzetto.

## Shapes

Il linguaggio delle forme è **pieno e arrotondato**, con quattro raggi e nessuna geometria
decorativa. Non ci sono angoli vivi in tutta l'interfaccia, e non ci sono forme irregolari,
tagli diagonali o mascherature.

- **24px** (`rounded-3xl`): card di primo livello, modali, bottom sheet (solo in alto:
  `rounded-t-3xl`). È il raggio che dice "questo è un contenitore".
- **16px** (`rounded-2xl`): card interne, contenitori di toggle, bottoni a piena larghezza
  dentro una card.
- **12px** (`rounded-xl`): il raggio di default del sistema — input, bottoni, pillole di
  blocco. Con 186 usi è la forma più frequente del progetto.
- **8px** (`rounded-lg`): dettagli minuti, tracce di slider, micro-etichette.
- **Cerchio pieno** (`rounded-full`): tutto ciò che è azione-icona (44×44 o 40×40), stato,
  avatar, pillola di categoria, giorno del calendario, puntino della settimana. 137 usi.

Il **bordo** è un elemento strutturale quanto il colore: quasi ogni superficie ne ha uno di
1px, e il passaggio da `#2a2a2a` a `#333` a `#383838` a `#444` è il modo in cui il sistema
dice quanto un elemento è importante senza cambiargli il fondo.

### Named Rules

**La Regola dei Quattro Raggi.** 24 / 16 / 12 / cerchio. Un raggio nuovo (`rounded-md`,
raggi arbitrari in `rem`) è un'eccezione da giustificare, non una scelta libera: le poche
occorrenze esistenti sono residui, non precedenti.

**La Regola del Cerchio d'Azione.** Un'azione rappresentata da una sola icona è sempre un
cerchio pieno; un'azione con testo è sempre un rettangolo a 12px. Non si mescolano.

## Components

### Buttons
- **Forma:** angoli generosi (12px, `rounded-xl`); a piena larghezza dentro le card.
- **Primaria:** fondo Gesso Ambra pieno, testo nero, peso 700-900, padding verticale 12-14px
  (`py-3` / `py-3.5`). Nelle azioni conclusive porta il glow di stato
  (`shadow-lg shadow-[#f1ba17]/20`).
- **Hover / Active:** `hover:brightness-110` (mai un secondo colore), transizione 300ms
  `ease-out`. Su iOS l'hover non esiste: il feedback reale è aptico
  (`Haptics.impact({ style: ImpactStyle.Light })`) più una micro-scala.
- **Secondaria:** fondo `#2a2a2a`, testo bianco, peso 600 — `hover:bg-[#333]`. È il bottone
  di "Annulla" e di ogni azione non conclusiva.
- **Icona:** cerchio pieno 44×44 (o 40×40) su `#2a2a2a` o `#1e1e1e` con bordo `#333`,
  icona lucide 18-22px, colore `gray-400` → bianco in hover.
- **Disabilitato:** `disabled:opacity-50`, nessun cambio di colore.

### Cards / Containers
- **Angoli:** 24px (`rounded-3xl`); 16px per le card annidate.
- **Fondo:** `#1e1e1e`, bordo 1px `#2a2a2a`.
- **Padding interno:** 20px (`p-5`) o 24px (`p-6`); 16px per le card interne.
- **Hover:** il bordo passa al colore della categoria (`hover:border-[#f1ba17]` e derivati).
  È l'unico effetto di hover previsto sulle card: nessun sollevamento, nessuna ombra.
- **Icona in filigrana:** molte card portano un'icona lucide da 64-80px in
  `absolute top-0 right-0 p-6 opacity-10 -rotate-12`, che sale a `opacity-20` in hover.
  È la firma visiva più riconoscibile del sistema.

### Inputs / Fields
- **Stile:** pozzetto `#111` con bordo `#333`, testo bianco, placeholder `gray-600`,
  padding `12px 16px`, raggio 12px.
- **Focus:** `focus:outline-none` + `focus:border-[#f1ba17]` — il bordo cambia colore e basta.
  Nel contesto Running il bordo diventa `#0094C6`, in quello Custom `#D11149`: **il focus
  parla la lingua della categoria in cui si trova**.
- **iOS:** `font-size: 16px` forzato su input/textarea/select (regola `@supports` in
  `index.css`) per impedire lo zoom automatico della tastiera. Non rimuovere.

### Chips / Pillole
- **Stile:** `bg-<colore>/10`, testo `<colore>`, bordo `<colore>/30`, `rounded-full`,
  `text-xs`/`text-[10px]` peso 700. La versione piena (fondo pieno + testo nero) è riservata
  allo stato del workout di oggi.

### Navigation
- **Barra inferiore fissa:** altezza 64px, fondo `#222222`, bordo superiore `#333`, `z-50`.
- **Voci:** icona lucide 22px sopra etichetta `text-xs`, colonna centrata.
- **Stato attivo:** icona ed etichetta in Gesso Ambra; a riposo `gray-400`. Nessun
  indicatore, nessuna sottolineatura, nessuno sfondo: solo il colore.
- **Composizione variabile per ruolo:** l'atleta vede Home / Calendario / Profilo, il coach
  Home / Workout / Calendario / Atleti.

### Modals & Sheets
- **Overlay:** `bg-black/85`, sempre montato via `createPortal(…, document.body)`.
- **Contenuto:** card `#1e1e1e` a 24px con `shadow-2xl`, `max-w-sm` / `max-w-md`.
- **Ingresso:** `animate-in fade-in zoom-in-[0.96] duration-300 ease-out`, oppure la classe
  `.modal-transition` (scala 0.95 → 1 in 200ms su `cubic-bezier(0.16, 1, 0.3, 1)`).
- **Scala di z-index, da rispettare:** `[60]` builder · `[100]` Home · `[120]` date picker ·
  `[150]` alert e conferme. L'alert sta sempre sopra tutto.
- **Bottom sheet** (centro notifiche): `rounded-t-3xl`, altezza `80vh`, maniglia grigia
  centrata, chiusura con swipe verso il basso oltre 100px.

### Scroll Picker (componente firma)
Il selettore in stile iOS che governa tempi, round, chili, metri e passi nel builder: un
pozzetto Ardesia alto 144px con bordo `#383838`, righe da 40px in `snap-y snap-mandatory`,
scrollbar nascosta, e una finestra di selezione fissa disegnata come doppio bordo
orizzontale nel colore della categoria. Il valore attivo passa da `gray-600` a colore pieno
e da `text-sm` a `text-base` peso 700. Ogni scatto emette un impulso aptico leggero.
È il componente che più di ogni altro fa sembrare l'app nativa: non sostituirlo con un
`<select>`.

### Toggle Segmentato (componente firma)
Contenitore pozzetto `#111` con `p-1.5`, bordo `#333`, raggio 16px, e un indicatore assoluto
`#2a2a2a` a raggio 12px che trasla di `translate-x-full` in 300ms `ease-out`. Le etichette
sono maiuscole `text-xs` peso 700, colorate nella corsia attiva. Usato per lista/calendario,
tempo/distanza, passo/velocità, reps/metri.

### Empty States
Bordo tratteggiato (`border-dashed`, `#2a2a2a` o `#383838`), raggio 16px, `p-6`, testo
centrato `gray-500`, spesso con icona in cerchio grigio. Il tratteggio è il segnale
condiviso di "qui non c'è ancora niente, ma può esserci".

### Skeleton Loading
`bg-[#1e1e1e] border border-[#2a2a2a] rounded-2xl` con altezza fissa (`h-16`, `h-20`) e
`animate-pulse`. Nessuno shimmer, nessun gradiente in movimento.

## Do's and Don'ts

### Do:
- **Do** trattare `#0B0B0B → #1e1e1e → #2a2a2a` (più il pozzetto `#111`) come l'unica fonte
  di profondità, e il bordo 1px come parte strutturale della forma.
- **Do** far parlare il focus e l'hover **la lingua della categoria** in cui si trovano:
  giallo in Hyrox, `#0094C6` in Running, `#D11149` in Custom, bianco negli Eventi.
- **Do** montare ogni modale con `createPortal(…, document.body)` e rispettare la scala di
  z-index (60 / 100 / 120 / 150).
- **Do** usare `CustomAlert` e `CustomConfirm` per ogni messaggio o conferma.
- **Do** accompagnare picker, slider e completamenti con feedback aptico
  (`Haptics.impact`), con fallback `navigator.vibrate()` sul web.
- **Do** aprire ogni pagina con la safe area iOS e chiuderla con `pb-24`.
- **Do** mantenere 300ms `ease-out` come tempo standard delle transizioni e
  `cubic-bezier(0.16, 1, 0.3, 1)` per gli ingressi di pagina e modale.
- **Do** dare al testo su fondo Gesso Ambra o Bianco Evento il colore nero.

### Don't:
- **Don't** usare `alert()` o `confirm()` nativi: rompono sia il tono sia il layer di modali.
- **Don't** mettere due CTA gialle piene nella stessa schermata, né usare il Gesso Ambra come
  fondo di una superficie grande.
- **Don't** introdurre un quinto colore-categoria, né riusare un colore-corsia fuori dalla
  sua categoria.
- **Don't** aggiungere ombre a elementi a riposo: l'ombra è stato, non atmosfera.
- **Don't** introdurre raggi fuori dalla scala 24 / 16 / 12 / cerchio.
- **Don't** costruire layout multi-colonna o dashboard a griglia di widget: il sistema è una
  colonna sola e l'anti-riferimento "dashboard SaaS" è esplicito.
- **Don't** aggiungere gradienti saturi, illustrazioni allegre, badge, coriandoli o
  gamification: è l'anti-riferimento "app fitness generalista".
- **Don't** progettare o proporre un tema chiaro: il sistema è dark-only per scelta.
- **Don't** scendere sotto `font-size: 16px` su input/textarea/select su iOS, né sotto
  **11px** su qualunque testo, né usare `text-gray-600` (2.50:1: è stato rimosso dal sistema).
- **Don't** lasciare un bottone solo-icona senza `aria-label`: VoiceOver lo annuncia come
  "pulsante" e basta. Tutti e 92 quelli esistenti sono stati etichettati il 24/08/2026.
- **Don't** reintrodurre `user-scalable=no` o `maximum-scale` nel viewport: il pinch-to-zoom è
  la scappatoia di chi non vede bene.
- **Don't** sostituire lo scroll picker con controlli HTML nativi (`<select>`, `<input
  type="time">`): è il componente che rende l'app credibile come app.
