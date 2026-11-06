// Perché questi test esistono: le caratteristiche di una scarpa (ammortizzamento,
// drop, peso…) si leggono e si validano in UN posto, per catalogo, scheda e
// editor. Un dato mancante deve restare «—» (mai 0, mai riga nascosta) e un
// valore fuori limite deve fermarsi prima del database.
import { describe, it, expect } from 'vitest'
import { righeCaratteristiche, validaModello, sogliaProposta, LIVELLI, OPZIONI, LIMITI } from '../caratteristicheScarpa'

const ETICHETTE = ['Ammortizzamento', 'Stabilità', 'Piastra', 'Drop', 'Peso', 'Altezza al tallone', 'Uso ideale', 'Vita stimata']

describe('righeCaratteristiche', () => {
  it('sempre 8 righe nell\'ordine fisso, tutte «—» se mancano i dati', () => {
    const r = righeCaratteristiche({})
    expect(r.map(x => x.etichetta)).toEqual(ETICHETTE)
    expect(r.every(x => x.valore === '—')).toBe(true)
  })
  it('valori pronti da mostrare', () => {
    const r = righeCaratteristiche({ drop_mm: 8, peso_g: 245, stack_mm: 38, piastra: 'nylon_tpu', uso: ['lento', 'ritmo'], vita_km: 700 })
    const v = Object.fromEntries(r.map(x => [x.etichetta, x.valore]))
    expect(v.Drop).toBe('8 mm')
    expect(v.Peso).toBe('245 g')
    expect(v['Altezza al tallone']).toBe('38 mm')
    expect(v.Piastra).toBe('Nylon/TPU')
    expect(v['Uso ideale']).toBe('Lento · Ritmo')
    expect(v['Vita stimata']).toBe('700 km')
  })
  it('i decimali hanno la virgola', () =>
    expect(righeCaratteristiche({ stack_mm: 39.5 }).find(x => x.chiave === 'stack_mm').valore).toBe('39,5 mm'))
  it('zero è un dato', () =>
    expect(righeCaratteristiche({ drop_mm: 0 }).find(x => x.chiave === 'drop_mm').valore).toBe('0 mm'))
  it('uso: valori ignoti scartati, vuoto o null = «—»', () => {
    const uso = (u) => righeCaratteristiche({ uso: u }).find(x => x.chiave === 'uso').valore
    expect(uso(['lento', 'volo'])).toBe('Lento')
    expect(uso([])).toBe('—')
    expect(uso(null)).toBe('—')
  })
})

describe('validaModello', () => {
  const base = { marca: 'Hoka', modello: 'Clifton 10' }
  it('fuori limite = errore', () => {
    expect(validaModello({ ...base, drop_mm: '17' }).errori.drop_mm).toBeDefined()
    expect(validaModello({ ...base, peso_g: '99' }).errori.peso_g).toBeDefined()
    expect(validaModello({ ...base, peso_g: '501' }).errori.peso_g).toBeDefined()
  })
  it('valore ok, intero per peso e vita', () => {
    const r = validaModello({ ...base, peso_g: '245', vita_km: '700,4' })
    expect(r.errori).toEqual({})
    expect(r.dati.peso_g).toBe(245)
    expect(r.dati.vita_km).toBe(700)
  })
  it('URL non https = errore (url_ufficiale e foto_url)', () => {
    expect(validaModello({ ...base, url_ufficiale: 'http://x' }).errori.url_ufficiale).toBeDefined()
    expect(validaModello({ ...base, foto_url: 'http://x' }).errori.foto_url).toBeDefined()
    expect(validaModello({ ...base, url_ufficiale: 'https://x.it' }).errori).toEqual({})
  })
  it('vuoti = null, nessun errore', () => {
    const r = validaModello({ ...base, drop_mm: '', peso_g: null, url_ufficiale: '', livello: '', uso: [] })
    expect(r.errori).toEqual({})
    expect(r.dati.drop_mm).toBeNull()
    expect(r.dati.peso_g).toBeNull()
    expect(r.dati.url_ufficiale).toBeNull()
    expect(r.dati.livello).toBeNull()
  })
  it('marca e modello obbligatori', () => {
    const r = validaModello({ marca: ' ', modello: '' })
    expect(r.errori.marca).toBeDefined()
    expect(r.errori.modello).toBeDefined()
  })
  it('valore di un elenco non ammesso = errore; uso ignoto scartato in silenzio', () => {
    expect(validaModello({ ...base, livello: 'esperto' }).errori.livello).toBeDefined()
    expect(validaModello({ ...base, piastra: 'legno' }).errori.piastra).toBeDefined()
    const r = validaModello({ ...base, uso: ['lento', 'volo'] })
    expect(r.errori).toEqual({})
    expect(r.dati.uso).toEqual(['lento'])
  })
  it('tipo: solo i valori del catalogo, vuoto = null', () => {
    expect(validaModello({ ...base, tipo: 'gara' }).dati.tipo).toBe('gara')
    expect(validaModello({ ...base, tipo: '' }).dati.tipo).toBeNull()
    expect(validaModello({ ...base, tipo: 'sprint' }).errori.tipo).toBeDefined()
  })
  it('ignora le chiavi sconosciute', () => {
    const r = validaModello({ ...base, slug: 'x', fonti: {}, fonte_foto: 'y' })
    expect(Object.keys(r.dati)).not.toContain('slug')
    expect(Object.keys(r.dati)).not.toContain('fonti')
    expect(Object.keys(r.dati)).not.toContain('fonte_foto')
  })
  it('parziale: valida e restituisce solo le chiavi presenti', () => {
    const r = validaModello({ foto_url: 'https://x/y.png' }, { parziale: true })
    expect(r.errori).toEqual({})
    expect(r.dati).toEqual({ foto_url: 'https://x/y.png' })
  })
  it('parziale: marca presente ma vuota = errore; fuori limite = errore', () => {
    expect(validaModello({ marca: '' }, { parziale: true }).errori.marca).toBeDefined()
    expect(validaModello({ peso_g: 50 }, { parziale: true }).errori.peso_g).toBeDefined()
  })
})

describe('sogliaProposta', () => {
  it('vita_km valida', () => expect(sogliaProposta({ vita_km: 900 })).toBe(900))
  it('altrimenti 700', () => {
    expect(sogliaProposta({})).toBe(700)
    expect(sogliaProposta({ vita_km: 50 })).toBe(700)
  })
})

describe('costanti', () => {
  it('livelli, opzioni, limiti', () => {
    expect(LIVELLI.map(l => l.valore)).toEqual(['principiante', 'intermedio', 'avanzato'])
    expect(OPZIONI.uso.map(o => o.valore)).toEqual(['lento', 'ritmo', 'ripetute', 'gara', 'trail'])
    expect(LIMITI.peso_g).toEqual([100, 500])
  })
})
