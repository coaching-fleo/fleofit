import { describe, it, expect, vi, beforeEach } from 'vitest'

// Gli interruttori delle funzioni (06/11/2026). setup.js li finge sempre accesi:
// qui si prova il modulo vero, con un finto Supabase che risponde come vogliamo.
vi.unmock('../funzioniApp')

const ctrl = vi.hoisted(() => ({ risposta: { data: null, error: null }, lancia: false, letture: 0 }))
vi.mock('../../supabaseClient', () => ({ supabase: {
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => {
    ctrl.letture += 1
    if (ctrl.lancia) throw new Error('rete assente')
    return ctrl.risposta
  } }) }) }),
} }))

const { funzioneVisibile, statoFunzione, funzioneAttiva, impostaRuoloFunzioni, azzeraFunzioni } = await import('../funzioniApp')

beforeEach(() => {
  azzeraFunzioni()
  localStorage.clear()
  ctrl.risposta = { data: null, error: null }
  ctrl.lancia = false
  ctrl.letture = 0
})

describe('funzioneVisibile', () => {
  it('«tutti» la mostra a ogni ruolo', () => {
    for (const r of ['athlete', 'coach', 'admin', null]) expect(funzioneVisibile('tutti', r)).toBe(true)
  })
  it('«admin» la mostra solo agli admin', () => {
    expect(funzioneVisibile('admin', 'admin')).toBe(true)
    expect(funzioneVisibile('admin', 'coach')).toBe(false)
    expect(funzioneVisibile('admin', 'athlete')).toBe(false)
    expect(funzioneVisibile('admin', null)).toBe(false)
  })
  it('«spenta» e ogni valore sconosciuto la nascondono', () => {
    for (const s of ['spenta', undefined, null, 'TUTTI', 'si']) expect(funzioneVisibile(s, 'admin')).toBe(false)
  })
})

describe('statoFunzione', () => {
  it('legge la riga e la ricorda per il resto dell\'avvio', async () => {
    ctrl.risposta = { data: { stato: 'tutti' }, error: null }
    expect(await statoFunzione('scarpe')).toBe('tutti')
    expect(await statoFunzione('scarpe')).toBe('tutti')
    expect(ctrl.letture).toBe(1)
  })
  it('riga assente = spenta', async () => {
    expect(await statoFunzione('scarpe')).toBe('spenta')
  })
  it('uno stato che non conosce = spenta', async () => {
    ctrl.risposta = { data: { stato: 'acceso' }, error: null }
    expect(await statoFunzione('scarpe')).toBe('spenta')
  })
  it('database che non risponde e nessuna risposta salvata = spenta', async () => {
    ctrl.risposta = { data: null, error: { code: 'PGRST205' } }
    expect(await statoFunzione('scarpe')).toBe('spenta')
    azzeraFunzioni(); ctrl.lancia = true
    expect(await statoFunzione('scarpe')).toBe('spenta')
  })
  it('senza rete usa l\'ultima risposta salvata su questo dispositivo', async () => {
    ctrl.risposta = { data: { stato: 'tutti' }, error: null }
    await statoFunzione('scarpe')
    azzeraFunzioni(); ctrl.lancia = true
    expect(await statoFunzione('scarpe')).toBe('tutti')
  })
  it('una funzione spenta dopo essere stata accesa si spegne anche nella memoria', async () => {
    ctrl.risposta = { data: { stato: 'tutti' }, error: null }
    await statoFunzione('scarpe')
    azzeraFunzioni(); ctrl.risposta = { data: { stato: 'spenta' }, error: null }
    await statoFunzione('scarpe')
    azzeraFunzioni(); ctrl.lancia = true
    expect(await statoFunzione('scarpe')).toBe('spenta')
  })
})

describe('funzioneAttiva', () => {
  it('usa il ruolo impostato da chi tiene AuthContext', async () => {
    ctrl.risposta = { data: { stato: 'admin' }, error: null }
    impostaRuoloFunzioni('athlete')
    expect(await funzioneAttiva('scarpe')).toBe(false)
    impostaRuoloFunzioni('admin')
    expect(await funzioneAttiva('scarpe')).toBe(true)
  })
})
