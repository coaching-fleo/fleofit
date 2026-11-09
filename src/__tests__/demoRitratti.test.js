import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { semi, VERSIONE_SEME } from '../demoSemi'

// I ritratti degli atleti finti (09/11/2026): servono a vedere, nella demo, come
// rendono le foto profilo al posto delle iniziali. L'errore che non si vede: un
// URL che punta a un file che non c'è dà un'immagine rotta (non le iniziali),
// e nessuno se ne accorge finché non apre la pagina giusta.
// I test girano dalla radice del progetto (npm test).
const radice = resolve(process.cwd())

describe('i ritratti della demo', () => {
  const db = semi()
  const atleti = db.athletes.filter(a => a.id.startsWith('at-'))

  it('la versione dei semi è almeno 23', () => {
    expect(VERSIONE_SEME).toBeGreaterThanOrEqual(23)
  })

  it('ogni atleta ha un ritratto, e il file esiste', () => {
    expect(atleti.length).toBeGreaterThanOrEqual(10)
    for (const a of atleti) {
      expect(a.photo_url, a.id).toMatch(/^\/tools\/demo-foto\/.+\.svg$/)
      expect(existsSync(resolve(radice, a.photo_url.slice(1))), a.photo_url).toBe(true)
    }
  })

  it('il coach finto senza nome resta senza foto (le iniziali)', () => {
    expect(db.athletes.find(a => a.id === 'coach-demo').photo_url).toBeNull()
  })
})
