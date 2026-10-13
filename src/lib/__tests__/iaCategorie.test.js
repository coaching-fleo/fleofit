import { describe, it, expect } from 'vitest'
import sorgente from '../../pages/CreateWorkout.jsx?raw'
import { IA_PER_CATEGORIA, iaDellaCategoria, haGiaContenuto } from '../iaCategorie'
import { preparaFasiIA, fasiPerIA } from '../blocchiIA'
import {
  CATEGORIE_IA, categoriaIA, promptCategoria, risultatoDaTesto, richiestaGroq, istruzioniModifica,
} from '../../../supabase/functions/ai-workout/regole.ts'

// Regola del committente (12/10/2026): «Genera con IA» su TUTTE le categorie
// del builder, anche quelle che verranno. Le categorie si leggono dal
// sorgente di CreateWorkout.jsx, così una categoria nuova fa fallire questo
// test finché non ha la sua voce qui e sul server.
const categorieDelBuilder = () => {
  const blocco = sorgente.match(/const CATEGORIE = \[([\s\S]*?)\n\]/)[1]
  return [...blocco.matchAll(/id:\s*'([^']+)'/g)].map(m => m[1])
}

describe('ogni categoria del builder ha «Genera con IA»', () => {
  it('le categorie si leggono davvero dal sorgente', () => {
    expect(categorieDelBuilder()).toEqual(expect.arrayContaining(['Hyrox', 'Running', 'Custom']))
  })
  it.each(categorieDelBuilder())('%s ha la sua voce nell\'app e nella Edge Function', (c) => {
    expect(iaDellaCategoria(c)).not.toBeNull()
    expect(CATEGORIE_IA[c]).toBeDefined()
    // La chiave della risposta è la stessa dalle due parti.
    expect(IA_PER_CATEGORIA[c].chiave).toBe(CATEGORIE_IA[c].chiave)
    expect(categoriaIA(c)).toBe(c)
  })
  it('il builder sa dove sta l\'allenamento di ogni categoria', () => {
    for (const c of categorieDelBuilder()) {
      expect(sorgente).toMatch(new RegExp(`contenutoIA = \\{[^}]*\\b${c}:`))
      expect(sorgente).toMatch(new RegExp(`impostaContenutoIA = \\{[^}]*\\b${c}:`))
    }
  })
})

describe('ai-workout: la categoria della richiesta', () => {
  it('senza categoria è Hyrox, come chiedeva l\'app prima', () => {
    expect(categoriaIA(undefined)).toBe('Hyrox')
    expect(categoriaIA('')).toBe('Hyrox')
  })
  it('una categoria sconosciuta non diventa Hyrox di nascosto', () => {
    expect(categoriaIA('Nuoto')).toBeNull()
    expect(categoriaIA('toString')).toBeNull()
  })
  it('il prompt della Corsa chiede fasi, quello Custom una descrizione', () => {
    expect(promptCategoria('Running', '8x400')).toMatch(/"repeat"/)
    expect(promptCategoria('Running', '8x400')).toContain('Testo dettato dall\'utente: "8x400"')
    expect(promptCategoria('Custom', 'circuito')).toMatch(/"testo"/)
    expect(promptCategoria('Hyrox', 'emom')).toMatch(/"EMOM"/)
  })
  it('la modifica manda l\'allenamento attuale, per ogni forma', () => {
    expect(istruzioniModifica([{ type: 'run', duration: '5 km' }], 'Running')).toMatch(/elenco di fasi[\s\S]*"5 km"|"5 km"[\s\S]*elenco di fasi/)
    expect(istruzioniModifica('3 giri di squat', 'Custom')).toContain('3 giri di squat')
    expect(istruzioniModifica('   ', 'Custom')).toBeNull()
    expect(istruzioniModifica([], 'Running')).toBeNull()
  })
  it('legge il risultato nella forma della categoria', () => {
    const fasi = [{ type: 'run', duration: '5 km' }]
    expect(risultatoDaTesto(JSON.stringify(fasi), 'Running')).toEqual(fasi)
    expect(risultatoDaTesto(JSON.stringify({ steps: fasi }), 'Running')).toEqual(fasi)
    expect(risultatoDaTesto(JSON.stringify({ blocks: fasi }), 'Running')).toBeNull()
    expect(risultatoDaTesto('{"testo": " Fai 3 giri "}', 'Custom')).toBe('Fai 3 giri')
    expect(risultatoDaTesto('{"testo": ""}', 'Custom')).toBeNull()
    expect(risultatoDaTesto('non json', 'Custom')).toBeNull()
  })
  it('la riserva Groq chiede l\'oggetto con la chiave giusta', () => {
    expect(richiestaGroq('P', 'm', 'Running').messages[0].content).toContain('"steps"')
    expect(richiestaGroq('P', 'm', 'Custom').messages[0].content).toContain('"testo"')
  })
})

describe('le fasi scritte dall\'IA diventano quelle del picker', () => {
  it('normalizza durate, passi e intensità', () => {
    const [f] = preparaFasiIA([{ type: 'run', duration: '15 minuti', pace: '4:30 /km', paceMax: '4:40 /km', intensity: 6 }])
    expect(f).toMatchObject({
      type: 'run', duration: '15 min', pace: '4:30 - 4:40 /km', paceMin: '4:30 /km', paceMax: '4:40 /km', intensity: '6',
    })
    expect(typeof f.id).toBe('number')
  })
  it('le ripetute tengono veloce e recupero, e un recupero non detto resta vuoto', () => {
    const [r] = preparaFasiIA([{ type: 'repeat', rounds: '8', runDuration: '400m', runPace: '3:45', runIntensity: '9' }])
    expect(r).toMatchObject({
      type: 'repeat', rounds: '8', runDuration: '400m', runPace: '3:45 /km', runIntensity: '9',
      recDuration: '', recPace: 'Libero', recIntensity: '3',
    })
  })
  it('un tipo che non esiste diventa corsa, una zona resta zona', () => {
    const [f] = preparaFasiIA([{ type: 'sprint', duration: '5 km', pace: 'Z2' }])
    expect(f).toMatchObject({ type: 'run', pace: 'Z2', paceMax: '-', intensity: '5' })
  })
  it('scarta quello che non è una fase', () => {
    expect(preparaFasiIA(null)).toEqual([])
    expect(preparaFasiIA([null, 'x'])).toEqual([])
  })
  it('all\'IA le fasi vanno senza id', () => {
    expect(fasiPerIA([{ id: 0.3, type: 'run' }])).toEqual([{ type: 'run' }])
  })
})

describe('haGiaContenuto', () => {
  it('una lista piena o un testo scritto fanno una modifica', () => {
    expect(haGiaContenuto([{}])).toBe(true)
    expect(haGiaContenuto('ciao')).toBe(true)
    expect(haGiaContenuto([])).toBe(false)
    expect(haGiaContenuto('  ')).toBe(false)
    expect(haGiaContenuto(undefined)).toBe(false)
  })
})
