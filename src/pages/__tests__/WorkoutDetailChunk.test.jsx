import { describe, it, expect, vi } from 'vitest'

// Perché questo test esiste
// ──────────────────────────
// `jspdf` e `html-to-image` servono a due voci del menu — il PDF e la story
// Instagram — che quasi nessuna apertura di scheda tocca. Importate in testa
// finivano nel chunk della pagina: 480 KB più html2canvas (200) e index.es
// (151), cioè ~830 KB da scaricare e PARSARE su un WKWebView per leggere dei
// blocchi. Rese dinamiche, la scheda scende a ~117 KB.
//
// 🔴 Riportarle in testa non dà NESSUN errore: i test restano verdi, l'app
// funziona, e l'unico effetto è mezzo megabyte davanti a ogni apertura. Senza
// questo test la correzione si perde al primo «ottimizziamo gli import».
//
// Come funziona: la factory di `vi.mock` viene invocata alla PRIMA importazione
// del modulo finto. Se WorkoutDetail lo importasse in testa, importare la
// pagina basterebbe a farla scattare — e infatti è così che il test è stato
// verificato per mutazione.

const spia = vi.hoisted(() => ({ pdf: false, grafica: false }))

vi.mock('jspdf', () => {
  spia.pdf = true
  return { default: class {}, jsPDF: class {} }
})
vi.mock('html-to-image', () => {
  spia.grafica = true
  return { toPng: vi.fn(), toBlob: vi.fn() }
})

// ⚠️ Il timeout è esplicito e generoso, e NON è un modo di far passare un test
// lento: qui si importa a freddo il modulo più grande del progetto (2.900 righe
// più tutto il suo grafo) mentre altri cinquanta file di test girano in
// parallelo, e la sola trasformazione può superare i 5 secondi di default. Il
// test verifica la FORMA del grafo di import, non la sua velocità: lasciarlo al
// default lo rende intermittente, e un test che fallisce a caso è peggio di
// nessun test — si impara a rilanciare la suite invece di leggerlo.
const ATTESA_IMPORT = 30_000

describe('Peso del chunk della scheda workout', () => {
  it('non carica jspdf né html-to-image solo per aprire la pagina', async () => {
    await import('../WorkoutDetail')

    expect(spia.pdf).toBe(false)
    expect(spia.grafica).toBe(false)
  }, ATTESA_IMPORT)
})
