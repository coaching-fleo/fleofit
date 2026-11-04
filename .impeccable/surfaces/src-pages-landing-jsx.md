---
version: 1
slug: "src-pages-landing-jsx"
primary_target: "src/pages/Landing.jsx"
related_targets: []
---

# Landing /benvenuto

Scope: pagina pubblica web `/benvenuto`, modalità Persuade. Il resto del sito (/, /login, /tv) non cambia; l'app nativa non la mostra.
Pubblico: atleti invitati da un coach e coach che valutano l'app. Azioni: Accedi (→ /login) e Schermata TV (→ /tv), sempre visibili.
Prova: il prodotto all'opera (blocco schermo, Dynamic Island, timer, builder, TV) con dati dimostrativi. Nessun numero di utenti, recensione o prezzo.

## Direction contract

THESIS: un solo workout attraversa la pagina e cambia superficie — notifica sul blocco schermo, Dynamic Island, Live Activity, builder del coach, TV della palestra. Rifiuta l'hero «titolo + bottone + griglia di card di feature».
OWN-WORLD: la lavagna scura dell'app: fondo #0B0B0B, superfici #1e1e1e/#222, un solo tratto giallo #f1ba17, azzurro #0094C6 per la corsa, verde #4ade80 per il riposo. Titoli system font 900 tracking stretto, cifre SF Rounded tabular. Pillole dei blocchi Hyrox, anello che si svuota, isola nera a molla.
STORY: chi arriva capisce che il coach decide e il workout gli arriva da solo; crede che funzioni perché lo vede funzionare; entra con Accedi o accende la TV.
FIRST VIEWPORT: barra con logo FLEO/FIT, Schermata TV e Accedi a destra. Titolo enorme su due righe a sinistra (seconda riga gialla), sottotitolo e i due tasti. A destra un iPhone sul blocco schermo: la notifica del coach entra a molla, poi la Live Activity.
FORM: «Il workout che viaggia», 7 su 7 del mio elenco, scelto dall'utente. seed:dd0dee119330499d. Interazione firma: iPhone fisso (sticky) che cambia stato allo scroll con la Dynamic Island che si allarga a molla; poi builder che compone blocchi e TV col conto alla rovescia.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
