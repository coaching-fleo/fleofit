import { describe, it, expect } from 'vitest'
import { eDesktop } from '../useDesktop'

// La regola del committente (13/10/2026): il desktop è solo per i coach.
describe('eDesktop', () => {
  it('il coach su schermo largo ha il desktop', () => {
    expect(eDesktop(true, 'admin')).toBe(true)
  })
  it("l'atleta no, nemmeno su schermo largo (anche l'admin che simula l'atleta)", () => {
    expect(eDesktop(true, 'athlete')).toBe(false)
  })
  it('su schermo stretto nessuno', () => {
    expect(eDesktop(false, 'admin')).toBe(false)
  })
  it('finché il ruolo non è noto, niente desktop: non deve lampeggiare', () => {
    expect(eDesktop(true, null)).toBe(false)
  })
})
