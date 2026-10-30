import { describe, it, expect } from 'vitest'
import {
  righeDaGarmin, nomeTipoAttivita, TIPI_ATTIVITA, durataGarmin, minutiVeri,
  annullaAbbinamento, abbinaA, vociLibere, candidatiAbbina, dispositivoGarmin, fonteGarmin, leggiAttivitaPeriodo,
} from '../attivitaGarmin'
import { fintoSupabase } from '../../test/fintoSupabase'

const corsa = {
  garmin_id: 'g1', tipo: 'RUNNING', durata_s: 2520, distanza_m: 8200,
  athlete_workout_id: 'aw1', abbinamento: 'auto',
  dati: { fc_media: 152, fc_max: 178, velocita_media_ms: 1000 / 307, dislivello_m: 120, calorie: 640, dispositivo: 'Forerunner 265' },
}

const valori = (righe) => Object.fromEntries(righe.map(r => [r.etichetta, r.valore]))

describe('righeDaGarmin', () => {
  it('ogni campo nel suo formato', () => {
    expect(valori(righeDaGarmin(corsa))).toEqual({
      Durata: '42′',
      Distanza: '8,2 km',
      Passo: '5:07 /km',
      'FC media': '152 bpm',
      'FC max': '178 bpm',
      Dislivello: '120 m',
      Calorie: '640 kcal',
    })
  })

  it('oltre l\'ora: «1 h 05′»', () => {
    expect(durataGarmin(3900)).toBe('1 h 05′')
    expect(valori(righeDaGarmin({ ...corsa, durata_s: 3900 })).Durata).toBe('1 h 05′')
  })

  it('un dato assente o zero non compare', () => {
    const righe = righeDaGarmin({ tipo: 'RUNNING', durata_s: 1800, distanza_m: 0, dati: { fc_media: null } })
    expect(righe).toEqual([{ etichetta: 'Durata', valore: '30′' }])
    expect(righeDaGarmin({ tipo: 'RUNNING' })).toEqual([])
    expect(righeDaGarmin(null)).toEqual([])
  })

  it('il passo solo per i tipi di corsa', () => {
    const forza = { ...corsa, tipo: 'STRENGTH_TRAINING' }
    expect(valori(righeDaGarmin(forza)).Passo).toBeUndefined()
    expect(valori(righeDaGarmin({ ...corsa, tipo: 'TREADMILL_RUNNING' })).Passo).toBe('5:07 /km')
    expect(valori(righeDaGarmin({ ...corsa, tipo: 'TRAIL_RUNNING' })).Passo).toBe('5:07 /km')
    expect(valori(righeDaGarmin({ ...corsa, tipo: 'TRACK_RUNNING' })).Passo).toBe('5:07 /km')
  })
})

describe('nomeTipoAttivita', () => {
  it('i tipi in italiano, «Attività» per gli sconosciuti', () => {
    expect(nomeTipoAttivita('RUNNING')).toBe('Corsa')
    expect(nomeTipoAttivita('INDOOR_ROWING')).toBe('Vogatore')
    expect(nomeTipoAttivita('BOH')).toBe('Attività')
    expect(nomeTipoAttivita(undefined)).toBe('Attività')
    expect(Object.keys(TIPI_ATTIVITA)).toHaveLength(9)
  })
})

describe('minutiVeri', () => {
  it('arrotonda la durata, null se manca', () => {
    expect(minutiVeri({ durata_s: 2520 })).toBe(42)
    expect(minutiVeri({ durata_s: 0 })).toBeNull()
    expect(minutiVeri(null)).toBeNull()
  })
})

describe('annullaAbbinamento', () => {
  it('completato da Garmin: l\'attività si libera e il workout torna da fare', async () => {
    const f = fintoSupabase()
    const r = await annullaAbbinamento(f.supabase, corsa)
    expect(r).toEqual({ error: null, tornaDaFare: true, fallito: null })
    const att = f.chiamateA('garmin_attivita', 'update')
    expect(att).toHaveLength(1)
    expect(att[0].args[0]).toEqual({ athlete_workout_id: null, abbinamento: 'atleta' })
    const aw = f.chiamateA('athlete_workouts', 'update')
    expect(aw).toHaveLength(1)
    expect(aw[0].args[0]).toEqual({ status: 'pending' })
    expect(f.chiamateA('athlete_workouts', 'eq')[0].args).toEqual(['id', 'aw1'])
  })

  it('abbinata dall\'atleta: l\'attività si libera, il workout resta com\'è', async () => {
    const f = fintoSupabase()
    const r = await annullaAbbinamento(f.supabase, { ...corsa, abbinamento: 'atleta' })
    expect(r).toEqual({ error: null, tornaDaFare: false, fallito: null })
    expect(f.chiamateA('garmin_attivita', 'update')[0].args[0]).toEqual({ athlete_workout_id: null, abbinamento: 'atleta' })
    expect(f.chiamateA('athlete_workouts', 'update')).toHaveLength(0)
  })

  it('se l\'attività non si libera, il workout non si tocca', async () => {
    const f = fintoSupabase({}, { erroreSu: ['garmin_attivita'] })
    const r = await annullaAbbinamento(f.supabase, corsa)
    expect(r.error).toBeTruthy()
    expect(r.fallito).toBe('attivita')
    expect(f.chiamateA('athlete_workouts', 'update')).toHaveLength(0)
  })

  it('attività staccata ma workout non rimesso: dice che è fallito il workout', async () => {
    const f = fintoSupabase({}, { erroreSu: ['athlete_workouts'] })
    const r = await annullaAbbinamento(f.supabase, corsa)
    expect(r.error).toBeTruthy()
    expect(r).toMatchObject({ tornaDaFare: false, fallito: 'workout' })
    expect(f.chiamateA('garmin_attivita', 'update')).toHaveLength(1)
  })
})

describe('abbinaA', () => {
  const libera = { ...corsa, athlete_workout_id: null, abbinamento: 'atleta' }

  it('abbina con «atleta» solo se ancora libera, e completa il workout', async () => {
    const f = fintoSupabase({ garmin_attivita: [{ garmin_id: 'g1' }] })
    const r = await abbinaA(f.supabase, libera, 'aw2')
    expect(r).toEqual({ error: null })
    expect(f.chiamateA('garmin_attivita', 'update')[0].args[0]).toEqual({ athlete_workout_id: 'aw2', abbinamento: 'atleta' })
    expect(f.chiamateA('garmin_attivita', 'is')[0].args).toEqual(['athlete_workout_id', null])
    expect(f.chiamateA('athlete_workouts', 'update')[0].args[0]).toEqual({ status: 'completed' })
    // su un workout già completato lo stato non si riscrive
    expect(f.chiamateA('athlete_workouts', 'neq')[0].args).toEqual(['status', 'completed'])
  })

  it('un\'attività già abbinata nel frattempo: errore, il workout non è toccato', async () => {
    const f = fintoSupabase({ garmin_attivita: [] })
    const r = await abbinaA(f.supabase, libera, 'aw2')
    expect(r.error).toBeTruthy()
    expect(f.chiamateA('athlete_workouts', 'update')).toHaveLength(0)
  })
})

describe('vociLibere', () => {
  const libera = { garmin_id: 'g9', giorno: '2026-10-28', tipo: 'RUNNING', durata_s: 2520, athlete_workout_id: null }

  it('«Garmin · Corsa 42′», solo le attività libere di quel giorno', () => {
    const attivita = [
      libera,
      { ...libera, garmin_id: 'g10', athlete_workout_id: 'aw1' },
      { ...libera, garmin_id: 'g11', giorno: '2026-10-27' },
    ]
    expect(vociLibere(attivita, '2026-10-28')).toEqual([{ id: 'g9', testo: 'Garmin · Corsa 42′', attivita: libera }])
  })

  it('🔴 con il modello noto la voce dice «Garmin Forerunner 265» (linee guida di marchio Garmin)', () => {
    const a = { ...libera, dati: { dispositivo: 'Forerunner 265' } }
    expect(vociLibere([a], '2026-10-28')[0].testo).toBe('Garmin Forerunner 265 · Corsa 42′')
  })

  it('senza durata niente «0′», e un tipo sconosciuto è «Attività»', () => {
    const a = { ...libera, tipo: 'PADEL', durata_s: null }
    expect(vociLibere([a], '2026-10-28')[0].testo).toBe('Garmin · Attività')
  })

  it('niente attività, niente voci', () => {
    expect(vociLibere(undefined, '2026-10-28')).toEqual([])
    expect(vociLibere([], '2026-10-28')).toEqual([])
  })
})

describe('candidatiAbbina', () => {
  const aw = (aw_id, date, status = 'pending') => ({ id: 'w-' + aw_id, aw_id, title: 'Lavoro', date, status })

  it('il giorno stesso, quello prima e quello dopo; fuori finestra no', () => {
    const lista = [
      aw('a', '2026-10-26'), aw('b', '2026-10-27'), aw('c', '2026-10-28'),
      aw('d', '2026-10-29'), aw('e', '2026-10-30'),
    ]
    expect(candidatiAbbina(lista, '2026-10-28').map(w => w.aw_id)).toEqual(['c', 'b', 'd'])
  })

  it('a cavallo del mese e dell\'anno', () => {
    const lista = [aw('a', '2026-12-31'), aw('b', '2027-01-02'), aw('c', '2026-12-30')]
    expect(candidatiAbbina(lista, '2027-01-01').map(w => w.aw_id)).toEqual(['a', 'b'])
  })

  it('le righe senza assegnazione sono escluse', () => {
    const lista = [{ id: 'w', date: '2026-10-28', status: 'pending' }, aw('b', '2026-10-28')]
    expect(candidatiAbbina(lista, '2026-10-28').map(w => w.aw_id)).toEqual(['b'])
  })

  it('i completati si offrono, dopo i da fare, se non hanno già un\'attività', () => {
    const lista = [aw('a', '2026-10-28', 'completed'), aw('b', '2026-10-28'), aw('c', '2026-10-28', 'completed'), aw('d', '2026-10-27')]
    const attivita = [{ garmin_id: 'g1', athlete_workout_id: 'c' }, { garmin_id: 'g2', athlete_workout_id: null }]
    expect(candidatiAbbina(lista, '2026-10-28', attivita).map(w => w.aw_id)).toEqual(['b', 'd', 'a'])
  })

  it('niente assegnazioni, nessun candidato', () => {
    expect(candidatiAbbina(undefined, '2026-10-28')).toEqual([])
  })
})

describe('dispositivoGarmin', () => {
  it('il nome dell\'orologio, o vuoto', () => {
    expect(dispositivoGarmin({ dati: { dispositivo: ' Forerunner 265 ' } })).toBe('Forerunner 265')
    expect(dispositivoGarmin({ dati: { dispositivo: 42 } })).toBe('')
    expect(dispositivoGarmin(null)).toBe('')
  })

  it('«unknown» non è un orologio', () => {
    expect(dispositivoGarmin({ dati: { dispositivo: 'unknown' } })).toBe('')
    expect(dispositivoGarmin({ dati: { dispositivo: 'Unknown Device' } })).toBe('')
  })
})

describe('fonteGarmin', () => {
  it('🔴 «Garmin [modello]», o solo «Garmin» se il modello manca (linee guida di marchio Garmin)', () => {
    expect(fonteGarmin({ dati: { dispositivo: 'Forerunner 265' } })).toBe('Garmin Forerunner 265')
    expect(fonteGarmin({ dati: {} })).toBe('Garmin')
    expect(fonteGarmin(null)).toBe('Garmin')
  })

  it('non raddoppia «Garmin» se il nome dell\'orologio lo porta già', () => {
    expect(fonteGarmin({ dati: { dispositivo: 'Garmin Venu 3' } })).toBe('Garmin Venu 3')
  })
})

describe('leggiAttivitaPeriodo', () => {
  it('una sola lettura: l\'atleta, il periodo, abbinate comprese', async () => {
    const f = fintoSupabase({ garmin_attivita: [{ garmin_id: 'g1' }] })
    const righe = await leggiAttivitaPeriodo(f.supabase, 'at1', '2026-10-01', '2026-10-31')
    expect(righe).toEqual([{ garmin_id: 'g1' }])
    expect(f.chiamateA('garmin_attivita', 'select')).toHaveLength(1)
    expect(f.chiamateA('garmin_attivita', 'eq')[0].args).toEqual(['athlete_id', 'at1'])
    expect(f.chiamateA('garmin_attivita', 'is')).toHaveLength(0)
    expect(f.chiamateA('garmin_attivita', 'gte')[0].args).toEqual(['giorno', '2026-10-01'])
    expect(f.chiamateA('garmin_attivita', 'lte')[0].args).toEqual(['giorno', '2026-10-31'])
  })

  it('un errore di lettura vale come nessuna attività', async () => {
    const f = fintoSupabase({}, { erroreSu: ['garmin_attivita'] })
    expect(await leggiAttivitaPeriodo(f.supabase, 'at1', '2026-10-01', '2026-10-31')).toEqual([])
    expect(await leggiAttivitaPeriodo(null, 'at1', '2026-10-01', '2026-10-31')).toEqual([])
  })
})
