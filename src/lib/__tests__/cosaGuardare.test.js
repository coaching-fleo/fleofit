import { describe, it, expect } from 'vitest'
import { cosaGuardare } from '../cosaGuardare'

describe('cosaGuardare — la lista «Da guardare» del desktop', () => {
  it('mette in fila feedback, poi fermi, poi scaduti', () => {
    const voci = cosaGuardare({
      feedback: [{ id: 1, nome: 'Marco', testo: 'Tutto liscio', rpe: 4 }],
      fermi: [{ id: 'a', nome: 'Paolo', giorni: 9 }],
      scaduti: [{ id: 's', nome: 'Sara', titolo: 'EMOM', quando: 'lunedì' }],
    })
    expect(voci.map(v => v.tipo)).toEqual(['feedback', 'fermo', 'scaduto'])
  })

  it('una nota vocale senza testo si «ascolta», una nota scritta si «legge»', () => {
    const [vocale, scritta] = cosaGuardare({
      feedback: [
        { id: 1, nome: 'Giulia', haVocale: true, titolo: 'Corsa · 8×400', rpe: 8 },
        { id: 2, nome: 'Luca', haVocale: true, testo: 'Gambe pesanti', rpe: 7 },
      ],
    })
    expect(vocale.azione).toBe('Ascolta')
    expect(vocale.riga).toBe('Nota vocale su «Corsa · 8×400»')
    expect(scritta.azione).toBe('Leggi')
    expect(scritta.riga).toBe('«Gambe pesanti»')
  })

  it('senza RPE dichiarato non inventa un numero', () => {
    const [v] = cosaGuardare({ feedback: [{ id: 1, nome: 'Elena', testo: 'ok' }] })
    expect(v.rpe).toBeNull()
  })

  it('chi è fermo oltre la finestra lo dice con il «+»', () => {
    const [v] = cosaGuardare({ fermi: [{ id: 'a', nome: 'Paolo', giorni: 45, oltre: true }] })
    expect(v.riga).toBe('Non si allena da 45+ giorni')
    expect(v.azione).toBe('Scheda')
  })

  it('niente da guardare è una lista vuota', () => {
    expect(cosaGuardare({})).toEqual([])
  })
})
