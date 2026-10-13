import { describe, it, expect } from 'vitest'
import { ultimeSedute } from '../ultimeSedute'
import { COACHING_ID } from '../constants'

// Le ultime sedute chiuse della Home coach desktop (piano fase 2, #4).
// I casi: l'RPE che manca non diventa 5, il coach non è un atleta, e
// l'elenco è per GIORNO perché `athlete_workouts` non ha un orario.

const OGGI = new Date('2026-10-14T10:00:00')
const atleta = (id, name) => ({ id, name, surname: 'Rossi', photo_url: null, notes: '' })
let n = 0
const riga = (athlete_id, completed_date, { status = 'completed', notes = null, voce = null } = {}) => ({
  id: `aw-${++n}`, athlete_id, completed_date, status, notes, voice_note_url: voce,
  workouts: { id: `w-${n}`, title: 'Sled push · EM 40′ @8', sections: { category: 'Hyrox' } },
})

describe('ultimeSedute', () => {
  const atleti = [atleta('a1', 'Anna'), atleta('a2', 'Bruno'), atleta(COACHING_ID, 'Coach')]

  it('solo completate, ultimi 7 giorni, più recenti prima', () => {
    const elenco = ultimeSedute([
      riga('a1', '2026-10-10'), riga('a2', '2026-10-14'), riga('a1', '2026-10-13', { status: 'pending' }),
      riga('a1', '2026-10-07'), riga('a2', '2026-10-08'), // il 7 è l'ottavo giorno: fuori
    ], atleti, { oggi: OGGI })
    expect(elenco.map(e => e.data)).toEqual(['2026-10-14', '2026-10-10', '2026-10-08'])
    expect(elenco[0]).toMatchObject({ atletaId: 'a2', nome: 'Bruno Rossi', giorno: 'oggi', titolo: 'Sled push' })
  })

  it('RPE solo se dichiarato, mai un 5 inventato', () => {
    const [con, senza] = ultimeSedute([
      riga('a1', '2026-10-14', { notes: '[RPE: 8/10]\n[GRADIMENTO: si]\nDura' }), riga('a1', '2026-10-13'),
    ], atleti, { oggi: OGGI })
    expect(con).toMatchObject({ rpe: 8, gradimento: 'si', haNota: true, giorno: 'oggi' })
    expect(senza).toMatchObject({ rpe: null, gradimento: null, haNota: false, giorno: 'ieri' })
  })

  it('il coach e chi non è in rubrica restano fuori, e il limite vale', () => {
    const righe = [riga(COACHING_ID, '2026-10-14'), riga('cancellato', '2026-10-14'),
      ...Array.from({ length: 30 }, () => riga('a1', '2026-10-12'))]
    const elenco = ultimeSedute(righe, atleti, { oggi: OGGI, limite: 20 })
    expect(elenco).toHaveLength(20)
    expect(elenco.every(e => e.atletaId === 'a1')).toBe(true)
    expect(elenco[0].giorno).toBe('lun 12')
  })
})
