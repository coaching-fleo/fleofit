import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { montaPagina } from '../../test/montaPagina'

// Perché questi test esistono
// ────────────────────────────
// La scheda di un modello del catalogo (/scarpe/modello/:id) è la STESSA per
// tutti, ma i tasti cambiano col ruolo: l'atleta ha «Ce l'ho», il coach
// «Modifica», l'account del revisore (demo@fleofit.it) nessuno dei due, perché
// la policy del catalogo gli nega le scritture. Gli errori che non danno
// errore a schermo: un dato mancante che sparisce invece di essere «—», una
// soglia che non arriva da `vita_km`, un peso fuori scala che si salva.

const dati = await vi.hoisted(async () => ({ modello: null }))

vi.mock('../../lib/scarpeDb', async (originale) => {
  const vero = await originale()
  return {
    tabelleAssenti: vero.tabelleAssenti,
    numeroKm: vero.numeroKm,
    leggiModello: vi.fn(async () => dati.modello),
    aggiornaModelloCatalogo: vi.fn(async (id, c) => ({ ...dati.modello, id, ...c })),
    caricaFotoModello: vi.fn(async () => 'https://esempio.invalid/f.webp?v=1'),
    aggiungiScarpa: vi.fn(async ({ athleteId }) => ({ id: 'nuova', athlete_id: athleteId })),
    rendiPrincipale: vi.fn(async () => {}),
  }
})
vi.mock('../../lib/alert', () => ({ mostraErrore: vi.fn(), mostraSuccesso: vi.fn(), mostraAlert: vi.fn() }))
vi.mock('../../lib/fotoScarpa', async (originale) => ({
  ...(await originale()),
  riduciFoto: vi.fn(async () => ({ blob: new Blob(['x']), est: 'webp', trasparente: false })),
}))

const db = await import('../../lib/scarpeDb')
const ModelloScarpa = (await import('../ModelloScarpa')).default

const MODELLO = { id: 'm1', marca: 'Hoka', modello: 'Speedgoat 6', tipo: 'trail', drop_mm: 8, vita_km: 800 }
const ATLETA = { id: 'a1', email: 'a@f.it' }
const COACH = { id: 'c1', email: 'c@f.it' }
const REVISORE = { id: 'd1', email: 'demo@fleofit.it' }
const monta = (user, role) => montaPagina(<ModelloScarpa />, { user, role, percorso: '/scarpe/modello/m1', rotta: '/scarpe/modello/:id' })

beforeEach(() => {
  vi.clearAllMocks()
  dati.modello = { ...MODELLO }
})

describe('scheda del modello', () => {
  it('atleta: le 8 etichette, il dato presente e «—» per gli altri; «Ce l\'ho» sì, «Modifica» no', async () => {
    monta(ATLETA, 'athlete')
    await screen.findByRole('heading', { name: 'Speedgoat 6' })
    for (const e of ['Ammortizzamento', 'Stabilità', 'Piastra', 'Drop', 'Peso', 'Altezza al tallone', 'Uso ideale', 'Vita stimata']) {
      expect(screen.getByText(e)).toBeInTheDocument()
    }
    expect(screen.getByText('8 mm')).toBeInTheDocument()
    expect(screen.getByText('800 km')).toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(6)
    expect(screen.getByRole('button', { name: /Ce l'ho/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Modifica/ })).not.toBeInTheDocument()
  })

  it('mostra la pillola del livello', async () => {
    dati.modello = { ...MODELLO, livello: 'intermedio' }
    monta(ATLETA, 'athlete')
    expect(await screen.findByText('Intermedio')).toBeInTheDocument()
  })

  it('«Ce l\'ho» apre il foglio e salva con il modello intero (la soglia viene da vita_km)', async () => {
    monta(ATLETA, 'athlete')
    await userEvent.click(await screen.findByRole('button', { name: /Ce l'ho/ }))
    const foglio = await screen.findByRole('dialog', { name: 'Hoka Speedgoat 6' })
    await userEvent.click(within(foglio).getByRole('button', { name: 'Salva' }))
    await waitFor(() => expect(db.aggiungiScarpa).toHaveBeenCalledWith(expect.objectContaining({
      athleteId: 'a1', catalogo: expect.objectContaining({ id: 'm1', vita_km: 800 }),
    })))
  })

  it('coach: «Modifica» e «Carica foto», niente «Ce l\'ho»', async () => {
    monta(COACH, 'admin')
    await screen.findByRole('heading', { name: 'Speedgoat 6' })
    expect(screen.getByRole('button', { name: /Modifica/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Carica foto/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ce l'ho/ })).not.toBeInTheDocument()
  })

  it('revisore (demo@fleofit.it): né «Modifica» né «Carica foto»', async () => {
    monta(REVISORE, 'admin')
    await screen.findByRole('heading', { name: 'Speedgoat 6' })
    expect(screen.queryByRole('button', { name: /Modifica/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Carica foto/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ce l'ho/ })).not.toBeInTheDocument()
  })

  it('«Pagina ufficiale» c\'è solo con l\'indirizzo; il credito della foto solo con la foto', async () => {
    monta(ATLETA, 'athlete')
    await screen.findByRole('heading', { name: 'Speedgoat 6' })
    expect(screen.queryByRole('button', { name: /Pagina ufficiale/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/Foto: © del marchio/)).not.toBeInTheDocument()
  })

  it('con url_ufficiale e foto_url compaiono entrambi', async () => {
    dati.modello = { ...MODELLO, url_ufficiale: 'https://hoka.example/sg6', foto_url: 'https://esempio.invalid/f.webp' }
    monta(ATLETA, 'athlete')
    expect(await screen.findByRole('button', { name: /Pagina ufficiale/ })).toBeInTheDocument()
    expect(screen.getByText(/Foto: © del marchio/)).toBeInTheDocument()
  })

  it('modello inesistente: «Modello non trovato»', async () => {
    dati.modello = null
    monta(ATLETA, 'athlete')
    expect(await screen.findByText('Modello non trovato')).toBeInTheDocument()
  })
})

describe('foglio del modello completo (coach)', () => {
  const apri = async () => {
    monta(COACH, 'admin')
    await userEvent.click(await screen.findByRole('button', { name: /Modifica/ }))
    return screen.findByRole('dialog', { name: 'Modifica modello' })
  }

  it('un peso di 600 g mostra l\'errore e spegne «Salva»', async () => {
    const foglio = await apri()
    await userEvent.type(within(foglio).getByLabelText('Peso (g)'), '600')
    expect(within(foglio).getByText(/Il peso deve stare fra 100 e 500/)).toBeInTheDocument()
    expect(within(foglio).getByRole('button', { name: 'Salva' })).toBeDisabled()
  })

  it('i campi a scelta sono Filtro; «Uso ideale» ne accetta più d\'uno', async () => {
    const foglio = await apri()
    const amm = within(within(foglio).getByRole('group', { name: 'Ammortizzamento' }))
    await userEvent.click(amm.getByRole('button', { name: 'Alto' }))
    expect(amm.getByRole('button', { name: 'Alto' })).toHaveAttribute('aria-pressed', 'true')
    const uso = within(within(foglio).getByRole('group', { name: 'Uso ideale' }))
    await userEvent.click(uso.getByRole('button', { name: 'Lento' }))
    await userEvent.click(uso.getByRole('button', { name: 'Gara' }))
    expect(uso.getByRole('button', { name: 'Lento' })).toHaveAttribute('aria-pressed', 'true')
    expect(uso.getByRole('button', { name: 'Gara' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(within(foglio).getByRole('button', { name: 'Salva' }))
    await waitFor(() => expect(db.aggiornaModelloCatalogo).toHaveBeenCalledWith('m1', expect.objectContaining({
      ammortizzamento: 'alto', uso: ['lento', 'gara'], drop_mm: 8,
    })))
    // senza toccare la foto: la modifica non deve azzerarla
    expect(db.aggiornaModelloCatalogo.mock.calls[0][1]).not.toHaveProperty('foto_url')
  })

  it('una foto con lo sfondo avvisa e si carica comunque', async () => {
    const foglio = await apri()
    const file = new File(['x'], 'scarpa.jpg', { type: 'image/jpeg' })
    await userEvent.upload(foglio.querySelector('input[type="file"]'), file)
    expect(await within(foglio).findByText(/Questa foto ha lo sfondo/)).toBeInTheDocument()
    expect(db.caricaFotoModello).toHaveBeenCalledWith('m1', expect.objectContaining({ est: 'webp', trasparente: false }))
  })
})
