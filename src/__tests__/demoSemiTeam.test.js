import { describe, it, expect } from 'vitest'
import { semi, VERSIONE_SEME, COACH_DEMO } from '../demoSemi'

// Il team della demo (INVENTATO): serve a vedere in `npm run demo` il lato coach
// e in `demo:atleta` i due lati dell'atleta — Sara dentro (testa a testa con
// Luca), Giulia con l'invito in attesa (DEMO_ATLETA=at-giulia).
describe('il team della demo', () => {
  const db = semi()

  it('la versione dei semi è almeno 21', () => {
    expect(VERSIONE_SEME).toBeGreaterThanOrEqual(21)
  })

  it('un team del coach finto, con la classifica visibile', () => {
    expect(db.team).toHaveLength(1)
    expect(db.team[0]).toMatchObject({ id: 't-doppia', coach_id: COACH_DEMO.id, classifica_visibile: true, chiuso_il: null })
  })

  it('Sara e Luca dentro, Giulia invitata', () => {
    const stato = Object.fromEntries(db.team_membri.map(m => [m.atleta_id, m.stato]))
    expect(stato).toEqual({ 'at-sara': 'dentro', 'at-luca': 'dentro', 'at-giulia': 'invitato' })
  })

  it('due sfide chiuse e una aperta, sui workout della demo', () => {
    expect(db.team_sfide.filter(s => s.chiusa_il)).toHaveLength(2)
    expect(db.team_sfide.filter(s => !s.chiusa_il)).toHaveLength(1)
    for (const s of db.team_sfide) expect(db.workouts.some(w => w.id === s.workout_id)).toBe(true)
  })

  it('i risultati delle chiuse danno una vittoria a testa', () => {
    const chiuse = db.team_sfide.filter(s => s.chiusa_il)
    const vincitori = chiuse.map((s) => {
      const r = db.team_risultati.filter(x => x.sfida_id === s.id)
      const migliore = s.verso === 'minore' ? Math.min(...r.map(x => x.valore)) : Math.max(...r.map(x => x.valore))
      return r.find(x => x.valore === migliore).atleta_id
    })
    expect(vincitori.sort()).toEqual(['at-luca', 'at-sara'])
  })

  it("Giulia ha la notifica dell'invito", () => {
    expect(db.notifications.some(n => n.user_id === 'at-giulia' && n.route === '/team/invito/t-doppia')).toBe(true)
  })

  it('nella demo la funzione è accesa', () => {
    expect(db.funzioni_app).toContainEqual(expect.objectContaining({ nome: 'team', stato: 'tutti' }))
  })
})
