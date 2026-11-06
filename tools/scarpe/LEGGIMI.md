# Scarpe: schede e foto dei 12 modelli di prova

- `schede.json` — i 12 modelli di `scarpe_catalogo()` (`src/demoSemi.js`), con i dati tecnici presi dalle
  pagine **ufficiali** dei marchi. `null` = la pagina ufficiale non dà il dato (o non era raggiungibile):
  mai riempito con siti di recensioni. `fonti` dice da quale URL viene ogni numero e, dove diversa da
  US 9 uomo, la taglia del peso.
- `scontorna.swift` — toglie lo sfondo a una foto prodotto (Vision, macOS 14+), ritaglia al soggetto,
  lato lungo 800 px, PNG con trasparenza: `swift tools/scarpe/scontorna.swift ingresso uscita.png`.
  Esce con codice 1 se non trova un soggetto.
- `foto/<slug>.png` — le foto scontornate.

## Criterio della valutazione FLEOFIT
- `ammortizzamento` da `stack_mm` (tallone): <30 basso, 30–35 medio, 36–40 alto, >40 massimo.
  Senza stack: tipo `ammortizzata` → alto, altrimenti `null`.
- `stabilita`: `sostegno` se il marchio la dichiara stabile/supportive, altrimenti `neutra`.
- `livello`: `avanzato` se piastra carbonio o tipo `gara`; `principiante` se `sostegno` o
  ammortizzamento massimo; altrimenti `intermedio`. Mai `null`.
- `uso`: gara → gara, ripetute; allenamento con piastra nylon/TPU → ritmo, ripetute; allenamento →
  lento, ritmo (anche con piastra carbonio, come per Puma); ammortizzata → lento; trail → trail.

## Affidabilità dei dati
Per Nike, Adidas, Asics, Hoka, Brooks e New Balance le pagine ufficiali non erano leggibili direttamente (403/404/406):
i numeri vengono da estratti dei domini ufficiali e vanno **ricontrollati**. Puma, Saucony e On sono stati letti dalle pagine.

## Foto
Ci sono solo 3 foto su 12 (Saucony, Puma, On): le altre 9 si caricheranno dopo dall'app.
Le foto sono © dei marchi e sono **provvisorie** (scelte dal committente per la prova), non una licenza.
Vanno sostituite prima di una pubblicazione vera.

## Caricamento
Si caricano con `carica-foto.sh` (Task 3) **solo dopo il sì esplicito** alla migrazione: finché lo schema
è congelato (CLAUDE.md §0, regola 0-bis) niente va nel database né nel bucket.
