import { describe, it, expect } from 'vitest'
import {
  righeDaGarmin, nomeTipoAttivita, TIPI_ATTIVITA, durataGarmin, minutiVeri,
  annullaAbbinamento, abbinaA,
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
    expect(r).toEqual({ error: null, tornaDaFare: true })
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
    expect(r).toEqual({ error: null, tornaDaFare: false })
    expect(f.chiamateA('garmin_attivita', 'update')[0].args[0]).toEqual({ athlete_workout_id: null, abbinamento: 'atleta' })
    expect(f.chiamateA('athlete_workouts', 'update')).toHaveLength(0)
  })

  it('se l\'attività non si libera, il workout non si tocca', async () => {
    const f = fintoSupabase({}, { erroreSu: ['garmin_attivita'] })
    const r = await annullaAbbinamento(f.supabase, corsa)
    expect(r.error).toBeTruthy()
    expect(f.chiamateA('athlete_workouts', 'update')).toHaveLength(0)
  })
})

describe('abbinaA', () => {
  it('abbina con «atleta» e completa il workout', async () => {
    const f = fintoSupabase()
    const r = await abbinaA(f.supabase, { ...corsa, athlete_workout_id: null, abbinamento: 'atleta' }, 'aw2')
    expect(r).toEqual({ error: null })
    expect(f.chiamateA('garmin_attivita', 'update')[0].args[0]).toEqual({ athlete_workout_id: 'aw2', abbinamento: 'atleta' })
    expect(f.chiamateA('athlete_workouts', 'update')[0].args[0]).toEqual({ status: 'completed' })
  })
})
