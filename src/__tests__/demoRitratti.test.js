import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { semi, VERSIONE_SEME } from '../demoSemi'

// I ritratti delle persone finte della demo (09/11/2026, foto Unsplash dal 18/11, per
// tutti dal 25/11). L'errore che non si vede: un URL che punta a un file che non c'è dà
// un'immagine rotta (non le iniziali), e nessuno se ne accorge finché non apre la pagina
// giusta. E una foto ripetuta fa sembrare la stessa persona due atleti diversi.
// I test girano dalla radice del progetto (npm test).
const radice = resolve(process.cwd())

describe('i ritratti della demo', () => {
  const db = semi()

  it('la versione dei semi è almeno 23', () => {
    expect(VERSIONE_SEME).toBeGreaterThanOrEqual(23)
  })

  it('ogni persona ha un ritratto, e il file esiste', () => {
    expect(db.athletes.length).toBeGreaterThanOrEqual(60)
    for (const a of db.athletes) {
      expect(a.photo_url, a.id).toMatch(/^\/tools\/demo-foto\/.+\.jpg$/)
      expect(existsSync(resolve(radice, a.photo_url.slice(1))), a.photo_url).toBe(true)
    }
  })

  it('mai due persone con la stessa foto', () => {
    const url = db.athletes.map(a => a.photo_url)
    expect(new Set(url).size).toBe(url.length)
    // Lo stesso file con due nomi non lo vede il confronto degli URL: lo vede fonti.txt.
    const fonti = readFileSync(resolve(radice, 'tools/demo-foto/fonti.txt'), 'utf8')
      .split('\n').filter(r => r && !r.startsWith('#')).map(r => r.split(' '))
    const foto = fonti.map(([, f]) => f)
    expect(new Set(foto).size).toBe(foto.length)
    for (const a of db.athletes) {
      const file = a.photo_url.split('/').pop().replace('.jpg', '')
      expect(fonti.some(([id]) => id === file), `${file} manca in fonti.txt`).toBe(true)
    }
  })
})
