import { describe, it, expect, vi } from 'vitest'

// Peso del chunk d'ingresso (CLAUDE.md §2): la card «Il tuo allenamento» la
// vede solo il coach, ma porta `codiceWorkout` (e con lui stima, archivio,
// statistiche). Importata in testa a Home.jsx finiva in `index`, scaricato
// anche dall'atleta all'avvio: +8 kB misurati il 18/11/2026. Va pigra.
const spia = vi.hoisted(() => ({ codice: false }))
vi.mock('../../lib/codiceWorkout', async (originale) => {
  spia.codice = true
  return await originale()
})
vi.mock('../../supabaseClient', () => ({ supabase: {} }))

describe('Peso del chunk della Home', () => {
  it('caricare Home.jsx non carica codiceWorkout', async () => {
    await import('../Home')
    expect(spia.codice).toBe(false)
  }, 30_000)
})
