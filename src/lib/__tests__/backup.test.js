import { describe, it, expect, vi, beforeEach } from 'vitest'

// Esportazione e ripristino del database dalle Impostazioni (13/10/2026).
// 🔴 Prima ogni tabella si leggeva con `.limit(10000)`, ma il server ne
// restituisce al massimo MILLE senza dirlo: un backup con più di mille
// assegnazioni usciva troncato, e lo si scopriva solo al ripristino.
// I casi: le pagine, la tabella che non esiste ancora (come_stai prima della
// migrazione), l'errore che non deve produrre un file a metà, l'ordine del
// ripristino (prima gli atleti, poi ciò che punta a loro).

const ctrl = await vi.hoisted(async () => ({ righe: {}, pagine: {}, assenti: [], guasti: [] }))
const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  // Ogni lettura di una tabella restituisce la pagina successiva da 1000.
  const pagina = (t) => {
    const n = ctrl.pagine[t] || 0
    ctrl.pagine[t] = n + 1
    return (ctrl.righe[t] || []).slice(n * 1000, (n + 1) * 1000)
  }
  return fintoSupabase(() => new Proxy({}, { get: (_, t) => pagina(t) }), {
    erroreSu: () => [...ctrl.assenti, ...ctrl.guasti],
    codiceErrore: 'PGRST205',
  })
})
vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))

const { TABELLE_BACKUP, esportaTutto, ripristinaTutto } = await import('../backup')

const righe = (n, extra = {}) => Array.from({ length: n }, (_, i) => ({ id: `r${i}`, ...extra }))

beforeEach(() => {
  ctrl.righe = {}
  ctrl.pagine = {}
  ctrl.assenti = []
  ctrl.guasti = []
  finto.chiamate.length = 0
})

describe('backup', () => {
  it('le tabelle, nell\'ordine in cui si ripristinano', () => {
    expect(TABELLE_BACKUP).toEqual(['athletes', 'workouts', 'athlete_workouts', 'come_stai'])
  })

  it('legge a pagine: oltre mille righe non se ne perde nessuna', async () => {
    ctrl.righe = { athletes: righe(3), workouts: righe(10), athlete_workouts: righe(2500), come_stai: righe(4) }
    const backup = await esportaTutto()
    expect(backup.type).toBe('full_backup')
    expect(backup.athlete_workouts).toHaveLength(2500)
    expect(backup.come_stai).toHaveLength(4)
    expect(finto.chiamateA('athlete_workouts', 'range')).toHaveLength(3)
  })

  it('una tabella che non esiste ancora non c\'è nel file, e lo dice', async () => {
    ctrl.righe = { athletes: righe(1), workouts: righe(1), athlete_workouts: righe(1) }
    ctrl.assenti = ['come_stai']
    const backup = await esportaTutto()
    expect(backup.come_stai).toBeUndefined()
    expect(backup.tabelle_assenti).toEqual(['come_stai'])
  })

  it('il ripristino va in ordine, a blocchi, e salta la tabella che non esiste', async () => {
    ctrl.assenti = ['come_stai']
    const esito = await ripristinaTutto({
      type: 'full_backup', athletes: righe(2), workouts: righe(1), athlete_workouts: righe(1200), come_stai: righe(3),
    })
    const upsert = finto.chiamate.filter(c => c.metodo === 'upsert').map(c => c.tabella)
    expect(upsert).toEqual(['athletes', 'workouts', 'athlete_workouts', 'athlete_workouts', 'athlete_workouts', 'come_stai'])
    expect(esito.saltate).toEqual(['come_stai'])
  })

  it('un file di prima (senza come_stai) si ripristina come sempre', async () => {
    const esito = await ripristinaTutto({ type: 'full_backup', athletes: righe(1), workouts: [], athlete_workouts: [] })
    expect(esito.saltate).toEqual([])
    expect(finto.chiamate.filter(c => c.metodo === 'upsert').map(c => c.tabella)).toEqual(['athletes'])
  })

  it('un file che non è un backup completo viene rifiutato', async () => {
    await expect(ripristinaTutto({ type: 'altro' })).rejects.toThrow(/non valido/)
  })
})
