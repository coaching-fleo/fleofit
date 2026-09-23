import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { startOfWeek, format } from 'date-fns'
import { montaPagina } from '../../test/montaPagina'
import { durataWorkout } from '../../lib/statistiche'

// Perché questo test esiste
// ─────────────────────────
// 🔴 Fino al 23/09/2026 la Home calcolava i minuti della settimana con una
// QUARTA copia dello stimatore di durata, scritta inline dentro
// `applicaStoricoAtleta`. Il suo `parseTime` non riconosceva le distanze: su
// una fase `repeat` con `runDuration: '800m'` faceva `parseInt('800m')` = 800
// e lo contava come **800 minuti per giro**.
//
// Misurato nell'ambiente di prova (Sara Villa, «Ripetute 6×800»): la Home
// dichiarava **4876 minuti** per la settimana, e il recap post-allenamento —
// due tocchi più in là — ne diceva **105**. Nessuno dei due dava errore, ed è
// la ragione per cui il difetto è sopravvissuto: si vede solo mettendo due
// schermate una accanto all'altra.
//
// ⚠️ Il caso che lo prende è per forza una corsa a RIPETUTE definita a
// DISTANZA: su un Hyrox le due formule coincidevano, e su una corsa a tempo
// anche — il vecchio `parseTime` sbagliava solo dove il valore finisce per
// «m» senza essere «min».

const dati = await vi.hoisted(async () => ({ righe: [] }))
const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({ athlete_workouts: dati.righe, notifications: [] }))
})
vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))
vi.mock('@capacitor/network', () => ({
  Network: {
    getStatus: vi.fn(() => Promise.resolve({ connected: true })),
    addListener: vi.fn(() => Promise.resolve({ remove: vi.fn() })),
  },
}))

const Home = (await import('../Home')).default

/** 10' di riscaldamento + 6×(800m + 2') + 8' di defaticamento. */
const RIPETUTE = {
  category: 'Running',
  steps: [
    { id: 1, type: 'warmup', duration: '10 min', intensity: '3' },
    { id: 2, type: 'repeat', rounds: '6', runDuration: '800m', recDuration: '2 min', runIntensity: '8' },
    { id: 3, type: 'cooldown', duration: '8 min', intensity: '2' },
  ],
}

/** Il giorno `n` della settimana in corso (0 = lunedì), sempre dentro la finestra. */
const giornoDellaSettimana = (n) => {
  const d = startOfWeek(new Date(), { weekStartsOn: 1 })
  d.setDate(d.getDate() + n)
  return format(d, 'yyyy-MM-dd')
}

const seduta = (n, rpe) => ({
  id: `aw${n}`,
  completed_date: giornoDellaSettimana(n),
  status: 'completed',
  notes: rpe == null ? null : `[RPE: ${rpe}/10]\n`,
  workouts: { id: `w${n}`, title: `Ripetute 6×800 · ${n}`, sections: RIPETUTE },
})

/** La cella «Volume · RPE» del bento. */
const cellaVolume = () => within(screen.getByText('Volume · RPE').closest('div'))

beforeEach(() => {
  // Tre completate: sotto MINIMO_PRECEDENTI la Home mostra la cella bloccata
  // al posto del volume, e il test verificherebbe un'altra schermata.
  // ⚠️ La terza è SENZA RPE dichiarato, ed è il caso dell'altra metà del test.
  dati.righe = [seduta(0, 8), seduta(1, 6), seduta(2, null)]
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('i minuti della settimana nella Home', () => {
  it('su una corsa a ripetute misurata in METRI dice i minuti, non le ore', async () => {
    // 59 minuti a seduta secondo `durataWorkout`, che è la funzione che usano
    // la scheda, il calendario, il report e il recap. Con il vecchio parser
    // locale ogni seduta ne dichiarava 4830.
    const attesi = durataWorkout(RIPETUTE) * 3
    expect(attesi).toBeLessThan(400)   // la guardia sull'ordine di grandezza

    montaPagina(<Home />)
    await waitFor(() => expect(screen.getByText('Volume · RPE')).toBeInTheDocument())
    expect(cellaVolume().getByText(String(attesi))).toBeInTheDocument()
  })

  it('usa la STESSA funzione di tutte le altre schermate', async () => {
    // ⚠️ Non è una ripetizione del test sopra: quello fissa un ordine di
    // grandezza, questo fissa l'IDENTITÀ con `durataWorkout`. Una terza
    // formula che sbagliasse di poco — cinque minuti su sessanta — passerebbe
    // il primo e cadrebbe qui, ed è esattamente il difetto che non si nota.
    dati.righe = [seduta(0, 8), seduta(1, 8), seduta(2, 8), seduta(3, 8)]
    montaPagina(<Home />)
    await waitFor(() => expect(screen.getByText('Volume · RPE')).toBeInTheDocument())
    expect(cellaVolume().getByText(String(durataWorkout(RIPETUTE) * 4))).toBeInTheDocument()
  })

  it("l'RPE medio non conta il 5 di ripiego di chi non l'ha segnato", async () => {
    // 8 e 6 dichiarati, il terzo in bianco: la media è 7,0 e non 6,3.
    // `parseNotesAndRpe` torna 5 dove il marcatore manca, e quel 5 entrerebbe
    // nella media come se fosse una misura — è la regola di §9-octies, ed è
    // anche ciò che rende questo numero uguale a quello del recap.
    montaPagina(<Home />)
    await waitFor(() => expect(screen.getByText('Volume · RPE')).toBeInTheDocument())
    expect(cellaVolume().getByText('7.0')).toBeInTheDocument()
    expect(cellaVolume().queryByText('6.3')).not.toBeInTheDocument()
  })

  it("senza nessun RPE dichiarato scrive «-», non un numero inventato", async () => {
    dati.righe = [seduta(0, null), seduta(1, null), seduta(2, null)]
    montaPagina(<Home />)
    await waitFor(() => expect(screen.getByText('Volume · RPE')).toBeInTheDocument())
    expect(cellaVolume().getByText('-')).toBeInTheDocument()
  })
})
