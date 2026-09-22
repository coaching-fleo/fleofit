import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Perché questo test esiste
// ──────────────────────────
// `index.html` dipinge il PRIMO FOTOGRAMMA dell'apertura prima che React
// esista: senza, dall'avvio dell'app alle prime forme passavano 1,7 secondi di
// nero (misurato sul simulatore il 22/09/2026), perché l'animazione non può
// cominciare prima che la webview si avvii, il bundle arrivi e React monti.
//
// 🔴 È UNA COPIA, E LA COPIA È INEVITABILE: il foglio di stile e il bundle
// arrivano dopo, quindi nel pre-disegno non si può usare né Tailwind né una
// classe di `src/index.css`. Quello che si può fare è impedire che le due metà
// divergano — perché quando divergono il sintomo è uno SCALINO DI COLORE
// nell'istante del passaggio di consegne, che nessun errore segnala e che in
// jsdom non si vede.
//
// ⚠️ Legge i file dal disco invece di montare qualcosa: è l'unico modo di
// guardare `index.html`, che non passa mai per React.

const leggi = (f) => readFileSync(resolve(process.cwd(), f), 'utf8')

describe('il pre-disegno dell\'apertura', () => {
  it('usa lo STESSO gradiente di `.apertura`', () => {
    const css = leggi('src/index.css')
    const html = leggi('index.html')

    // Il gradiente dichiarato da `.apertura` in src/index.css.
    const dalCss = /\.apertura\s*\{[^}]*?background:\s*(radial-gradient\([^;]*?\));/s.exec(css)
    expect(dalCss, 'src/index.css: `.apertura` non dichiara più un gradiente').not.toBeNull()

    const dalHtml = /#apertura-prima\s*\{[^}]*?background:\s*(radial-gradient\([^;]*?\));/s.exec(html)
    expect(dalHtml, 'index.html: il pre-disegno non dichiara più un gradiente').not.toBeNull()

    const normale = (s) => s.replace(/\s+/g, ' ').trim()
    expect(normale(dalHtml[1])).toBe(normale(dalCss[1]))
  })

  // 🔴 Deve stare DENTRO #root: `createRoot().render()` svuota il contenitore
  // al primo render, ed è così che il pre-disegno se ne va da solo. Fuori da
  // #root resterebbe in pagina per sempre, sopra l'app, che è un modo di
  // rendere l'applicazione inutilizzabile senza un solo errore in console.
  //
  // ⚠️ SI LEGGE L'ALBERO, NON IL TESTO. La prima versione di questo test usava
  // un'espressione regolare fra `<div id="root">` e `</div>`, e NON prendeva la
  // mutazione: spostando il pre-disegno fuori da #root, la regex si allungava
  // fino al `</div>` successivo e continuava a trovarcelo dentro. Verificato.
  it('sta dentro #root, o non se ne andrebbe mai', () => {
    const doc = new DOMParser().parseFromString(leggi('index.html'), 'text/html')
    const root = doc.getElementById('root')
    expect(root, 'index.html: manca #root').not.toBeNull()
    expect(root.querySelector('#apertura-prima')).not.toBeNull()
    // E non deve essercene una seconda copia altrove nel documento.
    expect(doc.querySelectorAll('#apertura-prima')).toHaveLength(1)
  })

  // ⚠️ Il marchio del pre-disegno e quello di React devono avere lo stesso
  // corpo: sono lo stesso logo nello stesso punto a un fotogramma di distanza,
  // e un salto di dimensione lì si legge come uno sfarfallio.
  it('il marchio ha lo stesso corpo di quello di React', () => {
    const html = leggi('index.html')
    const jsx = leggi('src/components/Apertura.jsx')
    expect(/#apertura-prima h1\s*\{[^}]*font-size:\s*44px/s.test(html)).toBe(true)
    expect(jsx).toContain('text-[44px]')
  })
})
