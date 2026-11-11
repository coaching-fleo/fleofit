import { describe, it, expect } from 'vitest'
import { oggiPerStato, oggiPerCategoria, ordinaOggi, giorniDaProgrammare, scopertiTreGiorni, filtraPerNome, righeCalendario } from '../riepilogoCoach'

const cella = (data, quando, categorie = []) => ({ data, quando, chips: categorie.map((c, i) => ({ id: `${data}-${i}`, workoutId: `w-${data}-${i}`, categoria: c, completato: false, titolo: 'X' })) })
const giorni = [
  { data: '2026-11-10', etichetta: 'oggi', oggi: true },
  { data: '2026-11-11', etichetta: 'mer 11', oggi: false },
  { data: '2026-11-12', etichetta: 'gio 12', oggi: false },
  { data: '2026-11-13', etichetta: 'ven 13', oggi: false },
]
const riga = (id, cat) => ({ id, nome: id, foto: null, celle: giorni.map((g, i) => cella(g.data, i === 0 ? 'oggi' : 'futuro', cat[i])) })

describe('riepilogoCoach', () => {
  it('oggiPerStato conta da fare, in corso e fatti', () => {
    const righe = ['completato', 'completato', 'in corso', 'da fare', 'da fare', 'da fare'].map(stato => ({ stato }))
    expect(oggiPerStato(righe)).toEqual({ daFare: 3, inCorso: 1, fatti: 2, totale: 6 })
    expect(oggiPerStato([])).toEqual({ daFare: 0, inCorso: 0, fatti: 0, totale: 0 })
  })

  it('oggiPerCategoria tiene l\'ordine fisso e lascia fuori le gare', () => {
    const righe = ['Running', 'Hyrox', 'Event', 'Hyrox'].map(categoria => ({ categoria }))
    expect(oggiPerCategoria(righe)).toEqual([['Hyrox', 2], ['Running', 1]])
  })

  it('ordinaOggi: sta male, in corso, da fare, fatti; non tocca l\'originale', () => {
    const righe = [{ nome: 'Bea', stato: 'completato' }, { nome: 'Ada', stato: 'da fare' },
      { nome: 'Cia', stato: 'da fare', allarme: true }, { nome: 'Dan', stato: 'in corso' }]
    expect(ordinaOggi(righe).map(r => r.nome)).toEqual(['Cia', 'Dan', 'Ada', 'Bea'])
    expect(righe[0].nome).toBe('Bea')
  })

  it('giorniDaProgrammare: futuro vuoto da programmare, oggi vuoto no, una gara conta come programmato', () => {
    const piano = { giorni, righe: [
      riga('a', [[], [], ['Event'], ['Hyrox']]),
      riga('b', [['Hyrox'], ['Running'], [], ['Gym']]),
    ] }
    const [oggi, mer, gio] = giorniDaProgrammare(piano)
    expect(oggi.daProgrammare).toEqual([])
    expect(oggi.programmati.map(r => r.id)).toEqual(['b'])
    expect(mer.daProgrammare.map(r => r.id)).toEqual(['a'])
    expect(gio.programmati.map(r => r.id)).toEqual(['a'])
    expect(gio.daProgrammare.map(r => r.id)).toEqual(['b'])
    expect(gio.perCategoria).toEqual([['Event', 1]])
  })

  it('scopertiTreGiorni: il primo giorno vuoto da domani, oggi non conta', () => {
    const piano = { giorni, righe: [
      riga('a', [['Hyrox'], ['Hyrox'], [], []]),
      riga('b', [[], ['Hyrox'], ['Gym'], ['Running']]),
    ] }
    const s = scopertiTreGiorni(piano)
    expect(s.map(r => r.id)).toEqual(['a'])
    expect(s[0].primoScoperto).toBe('2026-11-12')
    expect(s[0].scoperti).toEqual(['2026-11-12', '2026-11-13'])
  })

  it('filtraPerNome ignora accenti, maiuscole e spazi', () => {
    const persone = [{ nome: 'Nicolò Rossi' }, { nome: 'Marco Bianchi' }]
    expect(filtraPerNome(persone, 'nicolo').map(p => p.nome)).toEqual(['Nicolò Rossi'])
    expect(filtraPerNome(persone, 'MARCO').map(p => p.nome)).toEqual(['Marco Bianchi'])
    expect(filtraPerNome(persone, '  ')).toHaveLength(2)
  })

  describe('righeCalendario', () => {
    // 25 atleti: i dispari sono scoperti domani, i pari hanno tutto programmato.
    const cella = (data, quando, vuota) => ({ data, quando, chips: vuota ? [] : [{ titolo: 'x' }] })
    const riga = (i) => ({ id: `a${i}`, nome: `Atleta ${i}`, celle: [
      cella('d0', 'oggi', false), cella('d1', 'futuro', i % 2 === 1), cella('d2', 'futuro', false), cella('d3', 'futuro', false),
    ] })
    const piano = (n) => ({ giorni: [], righe: Array.from({ length: n }, (_, i) => riga(i)) })

    it('fino a 20 atleti le righe restano tutte, nel loro ordine', () => {
      const r = righeCalendario(piano(20))
      expect(r.nascoste).toBe(0)
      expect(r.righe.map(x => x.id)).toEqual(piano(20).righe.map(x => x.id))
    })

    it('oltre 20 prima chi è scoperto, poi gli altri, e solo 20', () => {
      const r = righeCalendario(piano(25))
      expect(r.righe).toHaveLength(20)
      expect(r.nascoste).toBe(5)
      // 12 scoperti (1, 3, … 23) in testa
      expect(r.righe.slice(0, 12).every(x => Number(x.id.slice(1)) % 2 === 1)).toBe(true)
      expect(r.righe.slice(12).every(x => Number(x.id.slice(1)) % 2 === 0)).toBe(true)
    })
  })
})
