import { describe, it, expect } from 'vitest'
import { contenutoBanner } from '../bannerScarpe'

const mod = (id, marca, modello, foto_url, tipo = 'gara') => ({ id, marca, modello, foto_url, tipo })
const scarpa = (o) => ({ id: 's', catalogo_id: null, marca: 'Nike', modello: 'Pegasus', principale: false, ritirata_at: null, km: 120, stato: 'ok', ...o })

describe('contenutoBanner — atleta', () => {
  const catalogo = [mod('m1', 'Asics', 'Novablast', 'u1', 'ammortizzata'), mod('m2', 'Nike', 'Pegasus', 'u2', 'gara')]

  it('una scarpa da cambiare vince sulla principale', () => {
    const scarpe = [scarpa({ id: 'a', principale: true, modello: 'Alfa', km: 100 }),
      scarpa({ id: 'b', modello: 'Beta', stato: 'oltre', km: 800, catalogo_id: 'm2' })]
    expect(contenutoBanner({ ruolo: 'atleta', scarpe, catalogo })).toEqual({
      titolo: 'Beta è da cambiare', bottone: 'Scegli la nuova', foto: 'u2', tipo: 'gara' })
  })
  it('la principale attiva, con i km', () => {
    const scarpe = [scarpa({ id: 'a', modello: 'Alfa' }), scarpa({ id: 'b', modello: 'Beta', principale: true, km: 1200 })]
    const r = contenutoBanner({ ruolo: 'atleta', scarpe, catalogo })
    expect(r.titolo).toBe('Beta · 1.200 km')
    expect(r.bottone).toBe('Le mie scarpe')
  })
  it('senza principale, la prima attiva (ritirate escluse)', () => {
    const scarpe = [scarpa({ id: 'r', modello: 'Ritirata', ritirata_at: '2026-01-01' }), scarpa({ id: 'a', modello: 'Alfa' })]
    expect(contenutoBanner({ ruolo: 'atleta', scarpe, catalogo }).titolo).toBe('Alfa · 120 km')
  })
  it('una scarpa ritirata «oltre» non conta', () => {
    const scarpe = [scarpa({ modello: 'Vecchia', stato: 'oltre', ritirata_at: 'x' }), scarpa({ id: 'a', modello: 'Alfa' })]
    expect(contenutoBanner({ ruolo: 'atleta', scarpe, catalogo }).titolo).toBe('Alfa · 120 km')
  })
  it('nessuna attiva: invito, con la foto del primo modello con foto', () => {
    const cat = [mod('x', 'Aaa', 'Senza', null), ...catalogo]
    expect(contenutoBanner({ ruolo: 'atleta', scarpe: [scarpa({ ritirata_at: 'x' })], catalogo: cat })).toEqual({
      titolo: 'Tieni il conto dei km delle tue scarpe', bottone: 'Aggiungi la tua', foto: 'u1', tipo: 'allenamento' })
  })
  it('scarpa a mano: niente foto, tipo allenamento', () => {
    const r = contenutoBanner({ ruolo: 'atleta', scarpe: [scarpa({})], catalogo })
    expect(r.foto).toBeNull()
    expect(r.tipo).toBe('allenamento')
  })
  it('catalogo non letto: la scarpa si mostra comunque', () => {
    const r = contenutoBanner({ ruolo: 'atleta', scarpe: [scarpa({ catalogo_id: 'm2' })], catalogo: null })
    expect(r.foto).toBeNull()
    expect(r.titolo).toBe('Pegasus · 120 km')
  })
})

describe('contenutoBanner — coach', () => {
  it('conta i modelli e prende il primo con foto in ordine alfabetico', () => {
    const catalogo = Array.from({ length: 112 }, (_, i) => mod(`k${i}`, 'Zeta', `M${i}`, null))
    catalogo.push(mod('b', 'Brooks', 'Ghost', 'ub', 'ammortizzata'), mod('a', 'Asics', 'Gel', 'ua', 'trail'))
    expect(contenutoBanner({ ruolo: 'coach', catalogo })).toEqual({
      titolo: 'Il catalogo scarpe · 114 modelli', bottone: 'Apri', foto: 'ua', tipo: 'trail' })
  })
  it('catalogo vuoto: null', () => {
    expect(contenutoBanner({ ruolo: 'coach', catalogo: [] })).toBeNull()
  })
})
