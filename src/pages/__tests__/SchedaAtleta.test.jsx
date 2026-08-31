import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { montaPagina, oggi } from '../../test/montaPagina'

// Perché questi test esistono
// ────────────────────────────
// Il rework del 28/08 (CLAUDE.md §9-terdecies) non ha toccato un solo campo di
// Supabase: ha spostato le cose. È esattamente il tipo di cambiamento che si
// rompe in silenzio — una sezione che sparisce, un numero che resta ma parla di
// un'altra finestra, un comando che diventa irraggiungibile. Niente di tutto
// questo dà errore a schermo.
//
// I casi presi qui sono quelli in cui la pagina resterebbe **verde e sbagliata**:
//  · il denominatore dell'anello (aderenza) contro il numero di allenamenti;
//  · la barra fissa che comparirebbe anche all'atleta, che non può assegnare;
//  · le sezioni che il redesign NON toglie e che sarebbe facile perdere per
//    strada — «Prossimi allenamenti» in testa a tutte;
//  · i comandi del menu, che devono restare FUORI dalla pagina finché non lo
//    si apre, altrimenti il menu non ha tolto niente.

const dati = await vi.hoisted(async () => ({ atleta: null, assegnazioni: [], pr: [] }))
const finto = await vi.hoisted(async () => {
  const { fintoSupabase } = await import('../../test/fintoSupabase')
  return fintoSupabase(() => ({
    athletes: [dati.atleta],
    athlete_workouts: dati.assegnazioni,
    personal_records: dati.pr,
  }))
})
vi.mock('../../supabaseClient', () => ({ supabase: finto.supabase }))

const AthleteDetail = (await import('../AthleteDetail')).default

const ATLETA = {
  id: 'a1', name: 'Marco', surname: 'Ferrero', photo_url: null,
  weight: 74, height: 178, birth_date: '1997-04-03',
  instagram_url: null, strava_url: null, notes: null,
}

const giorno = (scarto) => new Date(Date.now() + scarto * 86400000).toISOString().split('T')[0]
const amrap = (minuti) => ({ category: 'Hyrox', blocks: [{ type: 'AMRAP', params: { duration: `${minuti} min` } }] })

let seq = 0
const riga = (data, stato, { rpe = null, titolo = 'Hyrox Strength', minuti = 40 } = {}) => ({
  id: `aw${++seq}`, completed_date: data, status: stato,
  notes: rpe == null ? null : `[RPE: ${rpe}/10]\nnota`,
  voice_note_url: null,
  workouts: { id: `w${seq}`, title: titolo, sections: amrap(minuti) },
})

// ⚠️ Il coach si monta sulla ROTTA `/athletes/:id`, non su `/`. Senza il
// parametro la pagina ricade sull'id dell'utente loggato, si crede sul proprio
// profilo e nasconde la barra fissa: il test passerebbe verificando un'altra
// pagina. E il ruolo è `admin`, che è quello che l'onboarding assegna davvero.
const comeCoach = () => montaPagina(<AthleteDetail />, {
  role: 'admin', user: { id: 'coach', email: 'c@f.it' },
  percorso: '/athletes/a1', rotta: '/athletes/:id',
})
const comeAtleta = () => montaPagina(<AthleteDetail />, { role: 'athlete', user: { id: 'a1', email: 'a@f.it' } })
const attendi = () => waitFor(() => expect(screen.getByRole('heading', { name: /Marco Ferrero/ })).toBeInTheDocument())
const apriMenu = async () => {
  await userEvent.click(screen.getByLabelText('Altre azioni'))
  return screen.findByRole('menu')
}

beforeEach(() => {
  seq = 0
  dati.atleta = { ...ATLETA }
  dati.pr = []
  dati.assegnazioni = [
    riga(giorno(-2), 'completed', { rpe: 8 }),
    riga(giorno(-4), 'pending'),                       // saltato: pesa sull'aderenza
    riga(oggi(), 'pending', { titolo: 'Hyrox Strength #4' }),
    riga(giorno(2), 'pending', { titolo: 'Long Run 14 km' }),
  ]
  finto.chiamate.length = 0
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('L\'eroe «come sta andando»', () => {
  it('l\'anello porta l\'aderenza, non il numero di allenamenti', async () => {
    // 🔴 Il difetto che non darebbe errore: il denominatore. Sono TRE, non
    // quattro: il quarto è programmato fra due giorni, e un allenamento che non
    // è ancora arrivato non può essere «saltato». Contarlo farebbe scendere
    // l'aderenza di ogni atleta ogni volta che il coach gli programma qualcosa.
    comeCoach()
    await attendi()
    expect(screen.getByText(/Come sta andando · 30 giorni/)).toBeInTheDocument()
    expect(screen.getByLabelText('Aderenza 33%, 1/3 allenamenti')).toBeInTheDocument()
  })

  it('dà del tu sul proprio profilo, e della terza persona al coach', async () => {
    comeAtleta()
    await attendi()
    expect(screen.getByText(/Come stai andando · 30 giorni/)).toBeInTheDocument()
  })

  it('la frase accompagna i numeri invece di lasciarli soli', async () => {
    comeCoach()
    await attendi()
    // Non è decorazione: è la riga su cui si decide se caricare o scaricare, e
    // senza di essa due grafici restano due grafici.
    expect(screen.getByText(/Carico (in salita|in calo|stabile)|Prima settimana con carico/)).toBeInTheDocument()
  })
})

describe('Le tre tab', () => {
  it('non ci sono più, e i loro numeri sono in pagina', async () => {
    comeCoach()
    await attendi()
    expect(screen.queryByRole('button', { name: /^Statistiche$/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Diario$/ })).not.toBeInTheDocument()
    // I quattro grafici della tab sono diventati l'anello e le due celle.
    expect(screen.getByText('Volume')).toBeInTheDocument()
    expect(screen.getByText('Sforzo')).toBeInTheDocument()
  })

  it('lo storico nasce CHIUSO e dice quanti ce ne sono prima di aprirlo', async () => {
    comeCoach()
    await attendi()
    const riga = screen.getByRole('button', { name: /Storico allenamenti/ })
    expect(riga).toHaveAttribute('aria-expanded', 'false')
    // ⚠️ È la differenza fra una riga e una tab: la tab nasconde il contenuto E
    // la sua esistenza. Il conteggio dice cosa c'è dentro senza aprirla.
    expect(within(riga).getByText('2')).toBeInTheDocument()

    await userEvent.click(riga)
    expect(riga).toHaveAttribute('aria-expanded', 'true')
    await waitFor(() => expect(screen.getByRole('button', { name: /Elenco/ })).toBeInTheDocument())
  })

  it('l\'atleta non ha il calendario dentro lo storico', async () => {
    // È una vista di programmazione, e l'atleta non programma.
    comeAtleta()
    await attendi()
    await userEvent.click(screen.getByRole('button', { name: /Storico allenamenti/ }))
    expect(screen.queryByRole('button', { name: /Calendario/ })).not.toBeInTheDocument()
  })
})

describe('Il menu delle tre puntine', () => {
  it('tiene Esporta, Modifica e Pausa FUORI dalla pagina', async () => {
    comeCoach()
    await attendi()
    // Se fossero raggiungibili senza aprirlo, il menu non avrebbe tolto niente:
    // erano tre bottoni dello stesso peso sopra il contenuto.
    expect(screen.queryByText('Esporta dati')).not.toBeInTheDocument()
    expect(screen.queryByText('Modifica scheda')).not.toBeInTheDocument()

    const menu = await apriMenu()
    expect(within(menu).getByRole('menuitem', { name: 'Esporta dati' })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: /Metti Marco in pausa/ })).toBeInTheDocument()
  })

  it('all\'atleta non offre né esportazione né pausa', async () => {
    comeAtleta()
    await attendi()
    const menu = await apriMenu()
    expect(within(menu).getByRole('menuitem', { name: 'Modifica scheda' })).toBeInTheDocument()
    expect(within(menu).queryByRole('menuitem', { name: /Esporta/ })).not.toBeInTheDocument()
    expect(within(menu).queryByRole('menuitem', { name: /pausa/i })).not.toBeInTheDocument()
  })
})

describe('La barra fissa', () => {
  it('porta Assegna e Crea al coach', async () => {
    comeCoach()
    await attendi()
    expect(screen.getByRole('button', { name: /Assegna/ })).toBeInTheDocument()
    expect(screen.getByLabelText(/Crea un workout per questo atleta/)).toBeInTheDocument()
  })

  it('non esiste sul proprio profilo', async () => {
    // 🔴 L'atleta non può assegnarsi un workout: la policy RLS lo rifiuterebbe,
    // e il bottone offrirebbe un'azione che fallisce.
    comeAtleta()
    await attendi()
    expect(screen.queryByRole('button', { name: /Assegna/ })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Crea un workout/)).not.toBeInTheDocument()
    // Al suo posto il gesto che gli appartiene.
    expect(screen.getByRole('button', { name: /Aggiungi allenamento libero/ })).toBeInTheDocument()
  })
})

describe('Quello che il redesign NON toglie', () => {
  it('«Prossimi allenamenti» resta in pagina', async () => {
    // ⚠️ L'artboard disegna una giornata e si ferma a «Oggi». Togliere i
    // programmati vorrebbe dire che il coach non vede più cos'ha assegnato
    // senza aprire il calendario, e l'atleta non sa cosa lo aspetta domani.
    comeCoach()
    await attendi()
    expect(screen.getByText('Prossimi allenamenti')).toBeInTheDocument()
    expect(screen.getByText('Long Run 14 km')).toBeInTheDocument()
  })

  it('l\'allenamento di oggi è in pagina, non dentro una sezione da aprire', async () => {
    comeCoach()
    await attendi()
    expect(screen.getByText('Oggi')).toBeInTheDocument()
    expect(screen.getByText('Hyrox Strength #4')).toBeInTheDocument()
  })
})

describe('L\'anagrafica', () => {
  it('è una riga sola sotto il nome', async () => {
    comeCoach()
    await attendi()
    expect(screen.getByText(/anni · 178 cm · 74 kg · 4 workout/)).toBeInTheDocument()
  })

  it('salta i campi vuoti invece di scrivere «N/A»', async () => {
    // Una cella che dice «non lo so» occupava lo stesso spazio di una che dice
    // qualcosa: erano quattro celle da 22px in mezzo schermo.
    dati.atleta = { ...ATLETA, height: null, weight: null, birth_date: null }
    comeCoach()
    await attendi()
    expect(screen.getByText('4 workout')).toBeInTheDocument()
    expect(screen.queryByText(/N\/A/)).not.toBeInTheDocument()
  })
})
