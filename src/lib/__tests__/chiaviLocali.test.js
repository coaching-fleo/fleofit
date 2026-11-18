import { describe, it, expect } from 'vitest'
import { traslocaChiavi } from '../chiaviLocali'

function storageFinto(iniziale = {}) {
  const m = new Map(Object.entries(iniziale))
  return {
    get length() { return m.size },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    dump: () => Object.fromEntries(m),
  }
}

describe('traslocaChiavi', () => {
  it('sposta fleofit_* in pushfit_* e cancella le vecchie', () => {
    const s = storageFinto({ fleofit_name_u1: 'Sara', fleofit_offline_queue: '[{"id":1}]' })
    expect(traslocaChiavi(s)).toBe(2)
    expect(s.dump()).toEqual({ pushfit_name_u1: 'Sara', pushfit_offline_queue: '[{"id":1}]' })
  })

  it('se la chiave nuova c\'è già vince la nuova, e la vecchia sparisce', () => {
    const s = storageFinto({ fleofit_motivation: 'vecchia', pushfit_motivation: 'nuova' })
    expect(traslocaChiavi(s)).toBe(0)
    expect(s.dump()).toEqual({ pushfit_motivation: 'nuova' })
  })

  it('la seconda volta non fa niente', () => {
    const s = storageFinto({ fleofit_invite_code: 'ABC' })
    traslocaChiavi(s)
    expect(traslocaChiavi(s)).toBe(0)
    expect(s.dump()).toEqual({ pushfit_invite_code: 'ABC' })
  })

  it('non tocca adminRoleOverride né la sessione di Supabase', () => {
    const s = storageFinto({ adminRoleOverride: 'athlete', 'sb-x-auth-token': '{}' })
    expect(traslocaChiavi(s)).toBe(0)
    expect(s.dump()).toEqual({ adminRoleOverride: 'athlete', 'sb-x-auth-token': '{}' })
  })

  it('con uno storage che lancia non blocca l\'avvio', () => {
    const rotto = { get length() { throw new Error('privato') } }
    expect(traslocaChiavi(rotto)).toBe(0)
    expect(traslocaChiavi(undefined)).toBe(0)
  })
})
