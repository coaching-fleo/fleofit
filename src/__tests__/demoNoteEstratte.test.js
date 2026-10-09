import { describe, it, expect } from 'vitest'
import { semi, PROPOSTE_DEMO } from '../demoSemi'
import { testoPulito } from '../../supabase/functions/estrai-note/regole.ts'
import { copertura, serieRisultati, modificheFrequenti, righeStato } from '../lib/dalleNote'

// Perché questi test esistono
// ────────────────────────────
// I grafici «Dalle note» si guardano nell'ambiente di prova (`npm run demo`),
// e lì gli estratti non vengono da un'IA: sono scritti a mano. Il rischio è
// una demo che mostra dati che la funzione vera SCARTEREBBE — una citazione
// che non sta nella nota, un numero che non c'è. Per questo i semi passano
// dalle stesse regole del server, e qui si verifica che non ne perdano una.

const db = semi()
const perAtleta = (id) => ({
  workouts: db.athlete_workouts.filter(a => a.athlete_id === id),
  estratti: db.note_estratte.filter(e => e.athlete_id === id),
})

describe('gli estratti della demo', () => {
  it('ogni proposta scritta a mano sopravvive alla validazione', () => {
    for (const [testo, proposta] of Object.entries(PROPOSTE_DEMO)) {
      const riga = db.note_estratte.find(e => {
        const aw = db.athlete_workouts.find(a => a.id === e.athlete_workout_id)
        return testoPulito(aw.notes) === testo
      })
      expect(riga, testo).toBeTruthy()
      const { stato, risultati, sensazioni } = riga.estrazione
      expect(stato.length, testo).toBe((proposta.stato ?? []).length)
      expect(risultati.length, testo).toBe((proposta.risultati ?? []).length)
      expect(sensazioni.modifiche.length, testo).toBe((proposta.sensazioni?.modifiche ?? []).length)
      expect(sensazioni.seduta.difficolta, testo).toBe(proposta.sensazioni?.seduta?.difficolta ?? null)
      expect(sensazioni.parti.length, testo).toBe((proposta.sensazioni?.parti ?? []).length)
    }
  })

  it('nessuna nota resta «in analisi» nella demo', () => {
    for (const a of db.athletes) {
      const { workouts, estratti } = perAtleta(a.id)
      expect(copertura(workouts, estratti).inAttesa, a.name).toBe(0)
    }
  })

  it('Elena ha una serie di tre tempi sulle wall balls', () => {
    const [serie] = serieRisultati(perAtleta('at-elena').estratti)
    expect(serie.etichetta).toBe('Wall Balls · tempo')
    expect(serie.punti).toHaveLength(3)
    expect(serie.migliorato).toBe(true)
  })

  it('Giulia salta i burpees più di una volta', () => {
    const [prima] = modificheFrequenti(perAtleta('at-giulia').estratti)
    expect(prima).toMatchObject({ esercizio: 'Burpees Broad Jump', tipo: 'saltato' })
    expect(prima.volte).toBeGreaterThanOrEqual(2)
  })

  it('Luca è stanco, e almeno un giorno coincide con una seduta da RPE 8', () => {
    const { workouts, estratti } = perAtleta('at-luca')
    const stanchezza = righeStato(estratti, workouts, 90).find(r => r.fattore === 'stanchezza')
    expect(stanchezza.giorni.length).toBeGreaterThanOrEqual(2)
    expect(stanchezza.giorni.some(g => stanchezza.durissime.includes(g.data))).toBe(true)
  })
})
