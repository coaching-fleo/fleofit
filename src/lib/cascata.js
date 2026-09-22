/**
 * La cascata, dal lato JavaScript.
 *
 * L'animazione vive tutta in `src/index.css` (`.cascata`, `.cascata-voce`) e
 * nella maggior parte dei casi non serve niente qui: si mette `cascata` sul
 * contenitore e `nth-child` fa il resto.
 *
 * ⚠️ QUESTO MODULO SERVE A UN CASO SOLO, ed è l'archivio: una lista **annidata**,
 * dove le righe stanno dentro gruppi (i mesi) e `nth-child` riparte da capo a
 * ogni gruppo. Senza un indice che scorre attraverso i gruppi, le righe di
 * settembre e quelle di agosto partirebbero tutte insieme, e la cascata
 * ricomincerebbe da zero a ogni intestazione di mese.
 *
 * 🔴 `MASSIMO_CASCATA` DEVE COINCIDERE con il tetto scritto in `src/index.css`
 * (`.cascata > *:nth-child(n+12) { --i: 11 }`). Non è una duplicazione che si
 * può togliere: classi CSS e valori JS vivono in due mondi, e una regola
 * `nth-child` non è leggibile da qui. È la stessa ragione per cui i colori di
 * marchio hanno due elenchi con un test che li confronta (CLAUDE.md §6).
 *
 * Perché esiste un tetto: l'archivio ha 171 workout in produzione. Senza,
 * l'ultima riga entrerebbe dopo più di dodici secondi — molto dopo che il dito
 * ha già cominciato a scorrere, quindi comparirebbe sotto gli occhi di chi sta
 * guardando un'altra parte della pagina.
 */
export const MASSIMO_CASCATA = 11

/**
 * Lo stile inline di una voce di cascata.
 *
 * ⚠️ Torna un oggetto stile, non una classe: la classe (`cascata-voce`) la mette
 * il chiamante, perché su alcuni elementi va sulla radice e su altri su un
 * involucro. Lo stile inline vince sulla regola `nth-child`, ed è esattamente
 * per questo che l'escape è scritto così nel CSS.
 */
export const voce = (indice) => ({ '--i': Math.min(indice, MASSIMO_CASCATA) })
